// The request handler behind api/technician.ts (kept free of the SDK import so it can be unit-tested).
// Streams Dr. Wire's replies from the Anthropic API as server-sent events.
//
// Environment variables (set in Vercel, never in code):
//   ANTHROPIC_API_KEY            required. Server-side only.
//   TECHNICIAN_MODEL             optional. Default: claude-sonnet-5-5
//   TECHNICIAN_DAILY_CAP_USD     optional. Estimated spend cap per function instance per UTC day. Default: 5
//   TECHNICIAN_ALLOWED_ORIGINS   optional. Comma-separated extra origins (the site's own origin is always allowed).
//   TECHNICIAN_RATE_PER_MIN      optional. Requests per minute per client. Default: 20
//
// Request:  POST { messages: Msg[], snapshot: object }
// Response: text/event-stream with events { type: 'text', delta } | { type: 'tool_use', id, name, input } | { type: 'done', stop_reason } | { type: 'error', message, code }
// Request bodies, audio and replies are never logged.
import { buildSystem } from './persona';
import { KNOWLEDGE } from './knowledge.generated';
import { toolDefinitions } from './actions';
import { runnerTools } from './taskRunner';

const MAX_BODY = 64 * 1024, MAX_MESSAGES = 40, MAX_TEXT = 4000, MAX_TOOL_RESULTS_PER_TURN = 8, MAX_TOKENS = 350;
const KB_TEXT = KNOWLEDGE.map(e => `## ${e.title}\n${e.text}`).join('\n\n');
const TOOLS = runnerTools(toolDefinitions());
const TOOL_NAMES = new Set(TOOLS.map(t => t.name));

type Env = Record<string, string | undefined>;
type StreamLike = { on(ev: 'text', cb: (d: string) => void): unknown; finalMessage(): Promise<{ content: any[]; stop_reason: string | null; usage?: any }>; abort?(): void };
export type Deps = { env: Env; client: () => { messages: { stream(p: any): StreamLike } }; now?: () => number };

const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });

// ——— best-effort per-instance limits (serverless instances are ephemeral; see PR notes for hard limits) ———
const hits = new Map<string, number[]>();
const spend = { day: '', usd: 0 };

function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  return fwd.split(',')[0].trim() + '|' + (req.headers.get('x-tech-session') || '').slice(0, 40);
}
function rateLimited(key: string, now: number, perMin: number): boolean {
  const arr = (hits.get(key) || []).filter(t => now - t < 60000);
  if (arr.length >= perMin) { hits.set(key, arr); return true; }
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < 60000)) hits.delete(k);
  return false;
}
function originAllowed(req: Request, env: Env): boolean {
  const origin = req.headers.get('origin'); if (!origin) return false;
  let host = ''; try { host = new URL(origin).host; } catch { return false; }
  const own = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  if (host === own) return true;
  const extra = (env.TECHNICIAN_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (extra.includes(origin)) return true;
  return env.VERCEL_ENV !== 'production' && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}

/** Validates and rebuilds the messages so only known fields reach the model. Returns an error string or the clean list. */
export function cleanMessages(raw: unknown): { ok: true; messages: any[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_MESSAGES) return { ok: false, error: 'bad_messages' };
  const out: any[] = []; let toolResultsThisTurn = 0;
  for (const m of raw) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return { ok: false, error: 'bad_messages' };
    if (typeof m.content === 'string') {
      if (m.content.length > 2000) return { ok: false, error: 'too_long' };
      if (m.role === 'user') toolResultsThisTurn = 0;
      out.push({ role: m.role, content: m.content }); continue;
    }
    if (!Array.isArray(m.content) || m.content.length > 20) return { ok: false, error: 'bad_messages' };
    const blocks: any[] = [];
    for (const b of m.content) {
      if (b?.type === 'text' && typeof b.text === 'string' && b.text.length <= MAX_TEXT && m.role === 'assistant') blocks.push({ type: 'text', text: b.text });
      else if (b?.type === 'tool_use' && m.role === 'assistant' && typeof b.id === 'string' && b.id.length <= 64 && TOOL_NAMES.has(b.name) && b.input && typeof b.input === 'object' && JSON.stringify(b.input).length <= 2000) blocks.push({ type: 'tool_use', id: b.id, name: b.name, input: b.input });
      else if (b?.type === 'tool_result' && m.role === 'user' && typeof b.tool_use_id === 'string' && b.tool_use_id.length <= 64 && typeof b.content === 'string' && b.content.length <= 2000) { toolResultsThisTurn++; blocks.push({ type: 'tool_result', tool_use_id: b.tool_use_id, content: b.content, ...(b.is_error ? { is_error: true } : {}) }); }
      else return { ok: false, error: 'bad_block' };
    }
    if (!blocks.length) return { ok: false, error: 'bad_messages' };
    out.push({ role: m.role, content: blocks });
  }
  if (out[0].role !== 'user' || out[out.length - 1].role !== 'user') return { ok: false, error: 'bad_messages' };
  if (toolResultsThisTurn > MAX_TOOL_RESULTS_PER_TURN) return { ok: false, error: 'too_many_tool_calls' };
  return { ok: true, messages: out };
}

function costUsd(u: any, env: Env): number {
  const pin = Number(env.TECHNICIAN_PRICE_IN_PER_MTOK) || 3, pout = Number(env.TECHNICIAN_PRICE_OUT_PER_MTOK) || 15;
  const inp = (u?.input_tokens || 0) * pin, out = (u?.output_tokens || 0) * pout;
  const cr = (u?.cache_read_input_tokens || 0) * pin * 0.1, cw = (u?.cache_creation_input_tokens || 0) * pin * 1.25;
  return (inp + out + cr + cw) / 1e6;
}

export function createHandler(deps: Deps) {
  const env = deps.env; const nowMs = deps.now || (() => Date.now());
  return async function handle(req: Request): Promise<Response> {
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' }, { allow: 'POST' });
    if (!originAllowed(req, env)) return json(403, { error: 'forbidden_origin' });
    if (!env.ANTHROPIC_API_KEY) return json(503, { error: 'no_key' });
    const len = Number(req.headers.get('content-length') || 0); if (len > MAX_BODY) return json(413, { error: 'too_large' });
    const perMin = Number(env.TECHNICIAN_RATE_PER_MIN) || 20;
    if (rateLimited(clientKey(req), nowMs(), perMin)) return json(429, { error: 'rate_limited' }, { 'retry-after': '30' });
    const day = new Date(nowMs()).toISOString().slice(0, 10); if (spend.day !== day) { spend.day = day; spend.usd = 0; }
    const cap = Number(env.TECHNICIAN_DAILY_CAP_USD ?? 5); if (spend.usd >= cap) return json(503, { error: 'cap_reached' });

    let body: any; try { const text = await req.text(); if (text.length > MAX_BODY) return json(413, { error: 'too_large' }); body = JSON.parse(text); } catch { return json(400, { error: 'bad_json' }); }
    const cleaned = cleanMessages(body?.messages); if (cleaned.ok === false) return json(400, { error: cleaned.error });
    let snap = ''; try { snap = JSON.stringify(body?.snapshot ?? {}); } catch { snap = '{}'; } if (snap.length > 4000) return json(413, { error: 'snapshot_too_large' });

    const system = [...buildSystem(KB_TEXT), { type: 'text' as const, text: `LIVE SNAPSHOT (the truth about the lab right now):\n${snap}` }];
    const client = deps.client();
    const enc = new TextEncoder();
    const body$ = new ReadableStream({
      async start(controller) {
        const send = (o: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
        let stream: StreamLike | null = null;
        req.signal?.addEventListener('abort', () => { try { stream?.abort?.(); } catch { /* ignore */ } });
        try {
          stream = client.messages.stream({ model: env.TECHNICIAN_MODEL || 'claude-sonnet-5-5', max_tokens: MAX_TOKENS, system, tools: TOOLS as any, messages: cleaned.messages });
          stream.on('text', d => send({ type: 'text', delta: d }));
          const final = await stream.finalMessage();
          for (const b of final.content) if (b.type === 'tool_use') send({ type: 'tool_use', id: b.id, name: b.name, input: b.input });
          spend.usd += costUsd(final.usage, env);
          send({ type: 'done', stop_reason: final.stop_reason || 'end_turn' });
        } catch (e) {
          const status = (e as any)?.status; send({ type: 'error', code: status === 429 ? 'rate_limited' : 'upstream', message: 'The AI service had a problem.' });
        } finally { controller.close(); }
      },
    });
    return new Response(body$, { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store, no-transform', 'x-accel-buffering': 'no' } });
  };
}


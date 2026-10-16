// Client for the /api/technician streaming endpoint (server-sent events).
export type Block =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };
export type Msg = { role: 'user' | 'assistant'; content: string | Block[] };
export type LLMEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'done'; stop_reason: string }
  | { type: 'error'; message: string; code?: string };

export class LLMUnavailable extends Error { constructor(msg: string, public code = 'unavailable') { super(msg); this.name = 'LLMUnavailable'; } }

/** Parses a server-sent-event stream into events. Exported for tests. */
export function parseSSE(chunk: string, carry: { buf: string }): LLMEvent[] {
  carry.buf += chunk; const out: LLMEvent[] = [];
  let i: number;
  while ((i = carry.buf.indexOf('\n\n')) >= 0) {
    const raw = carry.buf.slice(0, i); carry.buf = carry.buf.slice(i + 2);
    const data = raw.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('');
    if (!data) continue;
    try { const ev = JSON.parse(data); if (ev && typeof ev.type === 'string') out.push(ev as LLMEvent); } catch { /* ignore malformed event */ }
  }
  return out;
}

export async function streamTechnician(
  req: { messages: Msg[]; snapshot: unknown; signal?: AbortSignal; endpoint?: string; fetchImpl?: typeof fetch },
  onEvent: (e: LLMEvent) => void,
): Promise<void> {
  const f = req.fetchImpl || fetch;
  let res: Response;
  try {
    res = await f(req.endpoint || '/api/technician', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: req.messages, snapshot: req.snapshot }), signal: req.signal });
  } catch (e) { if ((e as Error).name === 'AbortError') throw e; throw new LLMUnavailable('Network error'); }
  const type = res.headers.get('content-type') || '';
  if (!res.ok) { let code = 'http_' + res.status; try { const j = await res.json(); if (j?.error) code = j.error; } catch { /* not json */ } throw new LLMUnavailable(`Server said ${res.status}`, code); }
  if (!type.includes('text/event-stream') || !res.body) throw new LLMUnavailable('No AI endpoint here (static host)', 'not_deployed');
  const reader = res.body.getReader(); const dec = new TextDecoder(); const carry = { buf: '' };
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    for (const ev of parseSSE(dec.decode(value, { stream: true }), carry)) onEvent(ev);
  }
}

/** Splits streamed text into whole sentences so speech can start before the reply is finished. */
export function createSentenceChunker(emit: (sentence: string) => void) {
  let buf = '';
  const flushable = () => { const m = buf.match(/^[\s\S]*?[.!?]+(?=\s|$)/); return m ? m[0] : null; };
  return {
    push(delta: string) { buf += delta; let s: string | null; while ((s = flushable()) && buf.length > s.length) { buf = buf.slice(s.length); if (s.trim()) emit(s.trim()); } },
    flush() { const r = buf.trim(); buf = ''; if (r) emit(r); },
  };
}

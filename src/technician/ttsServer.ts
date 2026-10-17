// Handler behind api/tts.ts: turns Dr. Wire's sentences into a natural recorded-quality voice with a neural
// text-to-speech service. It is OFF until a key is set, and the page then keeps using the browser voice.
//
// Environment (server-side only):
//   ELEVENLABS_API_KEY  (preferred)  + optional ELEVENLABS_VOICE_ID (default: Adam), ELEVENLABS_MODEL (default: eleven_flash_v2_5)
//   OPENAI_API_KEY      (otherwise)  + optional TECHNICIAN_TTS_VOICE (default: ash), TECHNICIAN_TTS_MODEL (default: gpt-4o-mini-tts)
//   TECHNICIAN_TTS_DAILY_CAP_USD (default 2), TECHNICIAN_TTS_RATE_PER_MIN (default 24), TECHNICIAN_ALLOWED_ORIGINS
// Request:  GET  -> { enabled: boolean, provider?: 'elevenlabs' | 'openai' }
//           POST { text: string } -> audio/mpeg, or { error } (429 busy, 400 bad request, 403 origin, 502 upstream, 501 not configured)
// Same guards as the other endpoints: same-origin only, per-client rate limit, a daily spend cap, short bodies. Text and audio are never logged or stored.
import { createLimiter, createSpend, clientKey, json, originAllowed, type Env } from './guards';

const MAX_BODY = 2048, MAX_TEXT = 420;
export type TtsDeps = { env: Env; fetchImpl?: typeof fetch; now?: () => number };
export type Provider = 'elevenlabs' | 'openai';

/** Rough price per character used for the daily cap (kept slightly high on purpose). */
const USD_PER_CHAR: Record<Provider, number> = { elevenlabs: 0.00015, openai: 0.00003 };
const STYLE = 'Speak as a relaxed, friendly laboratory technician in his forties. Natural conversational pace with small pauses and a slightly warm, matter-of-fact tone. Never sound like an announcer or a robot.';

export function providerOf(env: Env): Provider | null { return env.ELEVENLABS_API_KEY ? 'elevenlabs' : env.OPENAI_API_KEY ? 'openai' : null; }

export function createTtsHandler(deps: TtsDeps) {
  const env = deps.env, nowMs = deps.now || (() => Date.now()), limited = createLimiter(), spend = createSpend();
  const doFetch = () => deps.fetchImpl || fetch;
  const cap = () => Number(env.TECHNICIAN_TTS_DAILY_CAP_USD) > 0 ? Number(env.TECHNICIAN_TTS_DAILY_CAP_USD) : 2;
  const rate = () => Number(env.TECHNICIAN_TTS_RATE_PER_MIN) > 0 ? Number(env.TECHNICIAN_TTS_RATE_PER_MIN) : 24;

  async function synth(p: Provider, text: string, signal: AbortSignal): Promise<Response> {
    if (p === 'elevenlabs') {
      const voice = (env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB').replace(/[^A-Za-z0-9]/g, '');
      return doFetch()(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
        method: 'POST', signal, headers: { 'xi-api-key': env.ELEVENLABS_API_KEY!, 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: env.ELEVENLABS_MODEL || 'eleven_flash_v2_5', voice_settings: { stability: 0.42, similarity_boost: 0.75, style: 0.25, use_speaker_boost: true } }),
      });
    }
    return doFetch()('https://api.openai.com/v1/audio/speech', {
      method: 'POST', signal, headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.TECHNICIAN_TTS_MODEL || 'gpt-4o-mini-tts', voice: env.TECHNICIAN_TTS_VOICE || 'ash', input: text, instructions: STYLE, response_format: 'mp3' }),
    });
  }

  return async function handler(req: Request): Promise<Response> {
    const p = providerOf(env);
    if (req.method === 'GET') return json(200, p ? { enabled: true, provider: p } : { enabled: false });
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' }, { allow: 'GET, POST' });
    if (!originAllowed(req, env)) return json(403, { error: 'origin' });
    if (!p) return json(501, { error: 'not_configured' });
    const len = Number(req.headers.get('content-length') || 0); if (len > MAX_BODY) return json(413, { error: 'too_large' });
    let text = ''; try { const raw = await req.text(); if (raw.length > MAX_BODY) return json(413, { error: 'too_large' }); const b = JSON.parse(raw); text = typeof b?.text === 'string' ? b.text : ''; } catch { return json(400, { error: 'bad_request' }); }
    text = text.replace(/\s+/g, ' ').trim();
    if (!text || text.length > MAX_TEXT) return json(400, { error: 'bad_text' });
    const now = nowMs();
    if (limited(clientKey(req), now, rate()) || spend.over(now, cap())) return json(429, { error: 'busy' }, { 'retry-after': '30' });
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 15000);
    try {
      const r = await synth(p, text, ctl.signal);
      if (!r.ok) return json(r.status === 429 ? 429 : 502, { error: r.status === 429 ? 'busy' : 'upstream' });
      const audio = await r.arrayBuffer(); if (!audio.byteLength) return json(502, { error: 'upstream' });
      spend.add(text.length * USD_PER_CHAR[p]);
      return new Response(audio, { status: 200, headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store', 'x-tts-provider': p } });
    } catch { return json(502, { error: 'upstream' }); }
    finally { clearTimeout(timer); }
  };
}

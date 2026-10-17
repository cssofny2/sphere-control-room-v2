import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

const S = await loadTypeScript(new URL('../src/technician/ttsServer.ts', import.meta.url));
const C = await loadTypeScript(new URL('../src/technician/cloudSpeech.ts', import.meta.url));
let n = 0; const ok = (name, fn) => Promise.resolve().then(fn).then(() => { n++; console.log('PASS ' + name); });

const own = 'https://lab.example';
const post = (body, o = {}) => new Request(own + '/api/tts', { method: 'POST', headers: { origin: own, host: 'lab.example', 'content-type': 'application/json', 'x-forwarded-for': o.ip || '1.1.1.1' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const mp3 = () => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });

// ——— server ———
await ok('tts: GET reports whether the studio voice is configured', async () => {
  const off = S.createTtsHandler({ env: {} }); const on = S.createTtsHandler({ env: { OPENAI_API_KEY: 'k' } });
  assert.deepEqual(await (await off(new Request(own + '/api/tts'))).json(), { enabled: false });
  assert.deepEqual(await (await on(new Request(own + '/api/tts'))).json(), { enabled: true, provider: 'openai' });
});
await ok('tts: ElevenLabs is preferred when both keys exist', () => { assert.equal(S.providerOf({ OPENAI_API_KEY: 'a', ELEVENLABS_API_KEY: 'b' }), 'elevenlabs'); assert.equal(S.providerOf({}), null); });
await ok('tts: not configured -> 501, wrong origin -> 403, no origin -> 403', async () => {
  assert.equal((await S.createTtsHandler({ env: {} })(post({ text: 'hi' }))).status, 501);
  const h = S.createTtsHandler({ env: { OPENAI_API_KEY: 'k' }, fetchImpl: async () => mp3() });
  assert.equal((await h(new Request(own + '/api/tts', { method: 'POST', headers: { origin: 'https://evil.example', host: 'lab.example' }, body: '{"text":"hi"}' }))).status, 403);
  assert.equal((await h(new Request(own + '/api/tts', { method: 'POST', headers: { host: 'lab.example' }, body: '{"text":"hi"}' }))).status, 403);
});
await ok('tts: bad bodies are rejected (empty, too long, not json, other methods)', async () => {
  const h = S.createTtsHandler({ env: { OPENAI_API_KEY: 'k' }, fetchImpl: async () => mp3() });
  assert.equal((await h(post({ text: '   ' }))).status, 400); assert.equal((await h(post({ text: 'x'.repeat(500) }))).status, 400);
  assert.equal((await h(post('not json'))).status, 400); assert.equal((await h(new Request(own + '/api/tts', { method: 'PUT' }))).status, 405);
});
await ok('tts: OpenAI request carries the text, never the key in the response, and returns audio', async () => {
  let seen = null; const h = S.createTtsHandler({ env: { OPENAI_API_KEY: 'sk-secret' }, fetchImpl: async (u, i) => { seen = { u, i }; return mp3(); } });
  const r = await h(post({ text: 'Hello there.' })); assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'audio/mpeg'); assert.equal((await r.arrayBuffer()).byteLength, 4);
  assert.match(seen.u, /api\.openai\.com\/v1\/audio\/speech/); assert.equal(JSON.parse(seen.i.body).input, 'Hello there.'); assert.equal(seen.i.headers.authorization, 'Bearer sk-secret');
  assert.ok(![...r.headers.values()].some(v => /sk-secret/.test(v)));
});
await ok('tts: ElevenLabs request uses the voice id and key header', async () => {
  let seen = null; const h = S.createTtsHandler({ env: { ELEVENLABS_API_KEY: 'xi-k', ELEVENLABS_VOICE_ID: 'abc123' }, fetchImpl: async (u, i) => { seen = { u, i }; return mp3(); } });
  assert.equal((await h(post({ text: 'Hi.' }))).status, 200); assert.match(seen.u, /text-to-speech\/abc123\?/); assert.equal(seen.i.headers['xi-api-key'], 'xi-k');
});
await ok('tts: per-client rate limit and daily spend cap -> 429', async () => {
  const h = S.createTtsHandler({ env: { OPENAI_API_KEY: 'k', TECHNICIAN_TTS_RATE_PER_MIN: '2' }, fetchImpl: async () => mp3(), now: () => 1_000_000 });
  assert.equal((await h(post({ text: 'a.' }))).status, 200); assert.equal((await h(post({ text: 'b.' }))).status, 200); assert.equal((await h(post({ text: 'c.' }))).status, 429);
  assert.equal((await h(post({ text: 'd.' }, { ip: '9.9.9.9' }))).status, 200);
  const c = S.createTtsHandler({ env: { ELEVENLABS_API_KEY: 'k', TECHNICIAN_TTS_DAILY_CAP_USD: '0.01' }, fetchImpl: async () => mp3() });
  assert.equal((await c(post({ text: 'x'.repeat(100) }))).status, 200); assert.equal((await c(post({ text: 'y.' }, { ip: '2.2.2.2' }))).status, 429);
});
await ok('tts: upstream errors become 502, upstream 429 stays 429, and nothing leaks', async () => {
  const bad = S.createTtsHandler({ env: { OPENAI_API_KEY: 'k' }, fetchImpl: async () => new Response('boom', { status: 500 }) }); const r = await bad(post({ text: 'hi.' })); assert.equal(r.status, 502); assert.deepEqual(await r.json(), { error: 'upstream' });
  assert.equal((await S.createTtsHandler({ env: { OPENAI_API_KEY: 'k' }, fetchImpl: async () => new Response('', { status: 429 }) })(post({ text: 'hi.' }))).status, 429);
  assert.equal((await S.createTtsHandler({ env: { OPENAI_API_KEY: 'k' }, fetchImpl: async () => { throw new Error('net'); } })(post({ text: 'hi.' }))).status, 502);
});

// ——— client ———
await ok('voice: chunks start short, keep decimals together and never cut mid-sentence', () => {
  const t = 'Power on the VNA first. The centre is 230.5 kilohertz and the span is five. Then calibrate it, which takes about a minute, and finally start the scan when the chamber is cold.';
  const c = C.chunkForVoice(t); assert.ok(c.length >= 2); assert.ok(c[0].length <= 125); assert.match(c.join(' '), /230\.5 kilohertz/); assert.equal(c.join(' ').replace(/\s+/g, ' '), t);
  assert.deepEqual(C.chunkForVoice('  '), []); assert.ok(C.chunkForVoice('word '.repeat(200)).every(x => x.length <= 400));
});
const fakeBase = () => { const said = []; let sp = []; return { said, supported: { listen: true, speak: true }, listen() { }, stopListening() { }, isListening: () => false, onTranscript: () => () => { }, onError: () => () => { }, onSpeaking(cb) { sp.push(cb); return () => { }; }, speak(t) { said.push(t); return Promise.resolve(); }, cancel() { }, isSpeaking: () => false, dispose() { } }; };
const fakeAudio = log => url => { const a = { url, onplaying: null, onended: null, onerror: null, pause() { }, play() { log.push(url); setTimeout(() => { a.onplaying?.(); setTimeout(() => a.onended?.(), 5); }, 1); return Promise.resolve(); } }; return a; };
const fetchFor = (cfg) => async (u, i = {}) => {
  if ((i.method || 'GET') === 'GET') return new Response(JSON.stringify({ enabled: cfg.enabled }), { status: 200, headers: { 'content-type': 'application/json' } });
  cfg.posts.push(JSON.parse(i.body).text); if (cfg.failAt !== undefined && cfg.posts.length > cfg.failAt) return new Response('x', { status: 502 });
  return new Response(new Uint8Array([9, 9, 9]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
};
await ok('voice: with the service on, Dr. Wire plays recorded-quality audio (pronounced text), not the browser voice', async () => {
  const base = fakeBase(), played = [], cfg = { enabled: true, posts: [] }; const v = C.withCloudVoice(base, { fetchImpl: fetchFor(cfg), makeAudio: fakeAudio(played) });
  const ev = []; v.onSpeaking((s) => ev.push(s));
  await v.speak('Dr. Wire here. The V N A is ready.'); assert.equal(base.said.length, 0); assert.ok(played.length >= 1); assert.match(cfg.posts.join(' '), /Doctor Wire/); assert.equal(ev[0], true); assert.equal(ev.at(-1), false); assert.equal(v.cloud.available(), true);
});
await ok('voice: with the service off or missing, the browser voice is used and no audio is requested', async () => {
  const base = fakeBase(), played = [], cfg = { enabled: false, posts: [] }; const v = C.withCloudVoice(base, { fetchImpl: fetchFor(cfg), makeAudio: fakeAudio(played) });
  await v.speak('Hello there.'); assert.deepEqual(base.said, ['Hello there.']); assert.equal(played.length, 0); assert.equal(cfg.posts.length, 0); assert.equal(v.cloud.available(), false);
  const base2 = fakeBase(); const v2 = C.withCloudVoice(base2, { fetchImpl: async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }), makeAudio: fakeAudio([]) });
  await v2.speak('Hi.'); assert.deepEqual(base2.said, ['Hi.']);
  const v3 = C.withCloudVoice(fakeBase(), { fetchImpl: async () => { throw new Error('offline'); } }); await v3.speak('Hi.'); assert.equal(v3.cloud.available(), false);
});
await ok('voice: a failure part-way hands the rest of the sentence to the browser voice (never silent)', async () => {
  const base = fakeBase(), played = [], cfg = { enabled: true, posts: [], failAt: 1 }; const v = C.withCloudVoice(base, { fetchImpl: fetchFor(cfg), makeAudio: fakeAudio(played) });
  await v.speak('First short sentence here. ' + 'A much longer second sentence follows with several more words in it to force another chunk. '.repeat(2));
  assert.equal(played.length, 1); assert.equal(base.said.length, 1); assert.match(base.said[0], /longer second sentence/);
});
await ok('voice: the studio voice can be switched off and cancel stops playback', async () => {
  const base = fakeBase(), played = [], cfg = { enabled: true, posts: [] }; const v = C.withCloudVoice(base, { fetchImpl: fetchFor(cfg), makeAudio: fakeAudio(played) });
  await v.cloud.ready(); v.cloud.setEnabled(false); await v.speak('Quiet please.'); assert.deepEqual(base.said, ['Quiet please.']); assert.equal(played.length, 0);
  v.cloud.setEnabled(true); const p = v.speak('Another one.'); v.cancel(); await p; assert.ok(!v.isSpeaking());
});

console.log(`${n} tts tests passed`);

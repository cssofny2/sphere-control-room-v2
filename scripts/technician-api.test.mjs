import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

const API = await loadTypeScript(new URL('../src/technician/server.ts', import.meta.url));
const L = await loadTypeScript(new URL('../src/technician/llm.ts', import.meta.url));
const env = { ANTHROPIC_API_KEY: 'test-key', VERCEL_ENV: 'production', TECHNICIAN_DAILY_CAP_USD: '1' };

// A fake Anthropic client that records what it was asked and streams a canned reply.
function fake(reply) {
  const calls = [];
  return { calls, client: () => ({ messages: { stream(params) { calls.push(params); const cbs = []; return { on(ev, cb) { cbs.push(cb); }, async finalMessage() { for (const t of reply.text || []) cbs.forEach(cb => cb(t)); return { content: reply.content || [], stop_reason: reply.stop || 'end_turn', usage: reply.usage || { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 17000 } }; } }; } } }) };
}
let nowT = Date.UTC(2026, 9, 16, 12);
const mk = (reply, e = env) => { const f = fake(reply); const handler = API.createHandler({ env: e, client: f.client, now: () => nowT }); return { handler, f }; };
const req = (body, o = {}) => { const h = { 'content-type': 'application/json', host: 'lab.spheredesci.org', 'x-forwarded-for': o.ip || '1.2.3.4', ...(o.headers || {}) }; if (o.origin !== null) h.origin = o.origin ?? 'https://lab.spheredesci.org'; return new Request('https://lab.spheredesci.org/api/technician', { method: o.method || 'POST', headers: h, body: o.method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }); };
const good = { messages: [{ role: 'user', content: 'hi' }], snapshot: { power: true } };
const read = async res => { const carry = { buf: '' }; const out = []; const dec = new TextDecoder(); const r = res.body.getReader(); for (;;) { const { done, value } = await r.read(); if (done) break; out.push(...L.parseSSE(dec.decode(value), carry)); } return out; };

// streams text, tool calls and done; system prompt is cached; model/max tokens set; snapshot included
{ const { handler, f } = mk({ text: ['Hello ', 'there.'], content: [{ type: 'tool_use', id: 'tu_1', name: 'run_task', input: { task: 'pump_down' } }], stop: 'tool_use' });
  const res = await handler(req(good)); assert.equal(res.status, 200); assert.match(res.headers.get('content-type'), /text\/event-stream/);
  const ev = await read(res); assert.deepEqual(ev.map(e => e.type), ['text', 'text', 'tool_use', 'done']); assert.equal(ev[2].name, 'run_task'); assert.equal(ev[3].stop_reason, 'tool_use');
  const p = f.calls[0]; assert.equal(p.model, 'claude-sonnet-5-5'); assert.equal(p.max_tokens, 350); assert.ok(p.system[1].cache_control?.type === 'ephemeral'); assert.match(p.system[1].text, /KNOWLEDGE/); assert.match(p.system.at(-1).text, /LIVE SNAPSHOT.*"power":true/s);
  assert.ok(p.tools.some(t => t.name === 'run_task') && p.tools.some(t => t.name === 'move_stage')); console.log('PASS streams text/tool_use/done with cached knowledge, model and max_tokens'); }
// model override
{ const { handler, f } = mk({ text: ['x'] }, { ...env, TECHNICIAN_MODEL: 'claude-opus-5-5' }); await read(await handler(req(good, { ip: '9.9.9.9' }))); assert.equal(f.calls[0].model, 'claude-opus-5-5'); console.log('PASS TECHNICIAN_MODEL overrides the default'); }
// origin
{ const { handler } = mk({ text: ['x'] }); assert.equal((await handler(req(good, { origin: 'https://evil.example', ip: '2.2.2.2' }))).status, 403); assert.equal((await handler(req(good, { origin: null, ip: '2.2.2.3', headers: {} }))).status, 403);
  const h2 = API.createHandler({ env: { ...env, TECHNICIAN_ALLOWED_ORIGINS: 'https://partner.example' }, client: fake({ text: ['x'] }).client, now: () => nowT }); assert.equal((await h2(req(good, { origin: 'https://partner.example', ip: '2.2.2.4' }))).status, 200); console.log('PASS origin check: foreign and missing origins are refused, allow-list works'); }
// method, key, json, size
{ const { handler } = mk({ text: ['x'] }); assert.equal((await handler(req(null, { method: 'GET' }))).status, 405);
  assert.equal((await handler(req('not json', { ip: '3.3.3.1' }))).status, 400);
  assert.equal((await handler(req({ messages: [{ role: 'user', content: 'x'.repeat(3000) }], snapshot: {} }, { ip: '3.3.3.2' }))).status, 400);
  assert.equal((await handler(req(good, { ip: '3.3.3.3', headers: { 'content-length': '999999' } }))).status, 413);
  assert.equal((await handler(req({ messages: [{ role: 'user', content: 'a' }], snapshot: { big: 'x'.repeat(5000) } }, { ip: '3.3.3.4' }))).status, 413);
  const nokey = API.createHandler({ env: { VERCEL_ENV: 'production' }, client: fake({}).client, now: () => nowT }); assert.equal((await nokey(req(good, { ip: '3.3.3.5' }))).status, 503); console.log('PASS method, JSON, size caps, and missing key are handled'); }
// message validation
{ const C = API.cleanMessages;
  assert.equal(C([]).ok, false); assert.equal(C([{ role: 'assistant', content: 'x' }]).ok, false, 'must start with user');
  assert.equal(C([{ role: 'user', content: 'a' }, { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'evil_tool', input: {} }] }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: 'ok' }] }]).ok, false, 'unknown tool refused');
  const uses = Array.from({ length: 9 }, (_, i) => ({ type: 'tool_use', id: 't' + i, name: 'home_stage', input: {} })), res = uses.map(u => ({ type: 'tool_result', tool_use_id: u.id, content: 'ok' }));
  assert.equal(C([{ role: 'user', content: 'a' }, { role: 'assistant', content: uses }, { role: 'user', content: res }]).error, 'too_many_tool_calls');
  const ok = C([{ role: 'user', content: 'a', extra: 'dropped' }, { role: 'assistant', content: [{ type: 'text', text: 'hi' }, { type: 'tool_use', id: 't', name: 'move_stage', input: { x: 1, y: 2, z: 3 } }] }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: 'Done' }] }]);
  assert.equal(ok.ok, true); assert.ok(!('extra' in ok.messages[0])); console.log('PASS messages are validated and rebuilt; tool calls per reply are capped at 8'); }
// rate limit
{ const { handler } = mk({ text: ['x'] }, { ...env, TECHNICIAN_RATE_PER_MIN: '3' }); const codes = []; for (let i = 0; i < 5; i++) codes.push((await handler(req(good, { ip: '7.7.7.7' }))).status); assert.deepEqual(codes, [200, 200, 200, 429, 429]);
  assert.equal((await handler(req(good, { ip: '8.8.8.8' }))).status, 200); nowT += 61000; assert.equal((await handler(req(good, { ip: '7.7.7.7' }))).status, 200); console.log('PASS per-client rate limit'); }
// spend cap
{ const { handler } = mk({ text: ['x'], usage: { input_tokens: 0, output_tokens: 80000 } }, { ...env, TECHNICIAN_DAILY_CAP_USD: '1' }); let r = await handler(req(good, { ip: '5.5.5.5' })); await read(r); r = await handler(req(good, { ip: '5.5.5.6' })); assert.equal(r.status, 503); assert.equal((await r.json()).error, 'cap_reached');
  nowT += 86400000; assert.equal((await handler(req(good, { ip: '5.5.5.7' }))).status, 200); console.log('PASS daily spend cap blocks and resets next day'); }
// upstream failure surfaces as an error event without leaking details
nowT += 86400000;
{ const bad = API.createHandler({ env, now: () => nowT, client: () => ({ messages: { stream() { return { on() { }, async finalMessage() { const e = new Error('secret details'); e.status = 500; throw e; } }; } } }) }); const ev = await read(await bad(req(good, { ip: '6.6.6.6' }))); assert.equal(ev[0].type, 'error'); assert.ok(!JSON.stringify(ev).includes('secret')); console.log('PASS upstream errors become a generic error event'); }

import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

const LS = await loadTypeScript(new URL('../src/technician/lookupServer.ts', import.meta.url));
const MS = await loadTypeScript(new URL('../src/technician/mailServer.ts', import.meta.url));
const ML = await loadTypeScript(new URL('../src/technician/mail.ts', import.meta.url));
const SV = await loadTypeScript(new URL('../src/technician/server.ts', import.meta.url));

const T0 = Date.UTC(2026, 9, 17, 12);
const req = (body, o = {}) => new Request('https://lab.spheredesci.org/api/x', { method: o.method || 'POST', headers: { 'content-type': 'application/json', host: 'lab.spheredesci.org', 'x-forwarded-for': o.ip || '1.1.1.1', ...(o.origin === null ? {} : { origin: o.origin || 'https://lab.spheredesci.org' }), ...(o.headers || {}) }, body: o.method === 'GET' ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
const prod = { VERCEL_ENV: 'production' };

// ——— look-up endpoint ———
{ const calls = []; const create = async p => { calls.push(p); return { content: [{ type: 'text', text: 'Copper melts at ' , citations: [{ title: 'Copper facts', url: 'https://example.org/cu' }] }, { type: 'text', text: '1,085 degrees **Celsius**.' }, { type: 'web_search_tool_result', content: [{ type: 'web_search_result', title: 'Other', url: 'https://www.other.net/a' }, { type: 'web_search_result', title: 'Bad', url: 'http://insecure.example/x' }] }], usage: { input_tokens: 1000, output_tokens: 100 } }; };
  const mk = (env = {}) => LS.createLookupHandler({ env: { ...prod, ANTHROPIC_API_KEY: 'k', ...env }, client: () => ({ messages: { create } }), now: () => T0 });
  const h = mk(); const res = await h(req({ query: 'melting point of copper' })); assert.equal(res.status, 200); const b = await res.json();
  assert.equal(b.answer, 'Copper melts at 1,085 degrees Celsius.'); assert.deepEqual(b.sources.map(s => s.domain), ['example.org', 'other.net'], 'https only, www stripped');
  assert.equal(calls[0].tools[0].type, 'web_search_20250305'); assert.equal(calls[0].tools[0].max_uses, 2); assert.match(calls[0].system, /untrusted/); assert.equal(calls[0].messages[0].content, 'melting point of copper');
  assert.equal((await h(req({ query: 'x' }, { method: 'GET', ip: '2.2.2.2' }))).status, 405); assert.equal((await h(req({ query: 'x' }, { origin: 'https://evil.example', ip: '2.2.2.3' }))).status, 403); assert.equal((await h(req({ query: 'x' }, { origin: null, ip: '2.2.2.4' }))).status, 403);
  assert.equal((await h(req({ query: '' }, { ip: '2.2.2.5' }))).status, 400); assert.equal((await h(req({ query: 'a'.repeat(300) }, { ip: '2.2.2.6' }))).status, 400); assert.equal((await h(req('nope', { ip: '2.2.2.7' }))).status, 400);
  assert.equal((await LS.createLookupHandler({ env: prod, client: () => ({ messages: { create } }) })(req({ query: 'x' }, { ip: '2.2.2.8' }))).status, 503);
  const lim = mk({ TECHNICIAN_LOOKUP_RATE_PER_MIN: '2' }); const r = []; for (let i = 0; i < 3; i++) r.push((await lim(req({ query: 'q' }, { ip: '3.3.3.3' }))).status); assert.deepEqual(r, [200, 200, 429]);
  const capH = mk({ TECHNICIAN_LOOKUP_DAILY_CAP_USD: '0.02' }); assert.equal((await capH(req({ query: 'q' }, { ip: '4.4.4.1' }))).status, 200); assert.equal((await capH(req({ query: 'q' }, { ip: '4.4.4.2' }))).status, 503);
  const bad = LS.createLookupHandler({ env: { ...prod, ANTHROPIC_API_KEY: 'k' }, client: () => ({ messages: { create: async () => { throw Object.assign(new Error('x'), { status: 500 }); } } }) }); assert.equal((await bad(req({ query: 'q' }, { ip: '5.5.5.5' }))).status, 502);
  console.log('PASS look-up endpoint: web search, https-only sources, origin, size, rate and spend limits'); }

// ——— inbound mail ———
const baseEnv = { ...prod, TECHNICIAN_EMAIL_ADDRESS: 'drwire@spheredesci.org', TECHNICIAN_EMAIL_ALLOWED_SENDERS: 'Michael <michael@example.com>, boss@example.com', TECHNICIAN_INBOUND_SECRET: 'sekret-value' };
const inboundReq = (body, secret = 'sekret-value', o = {}) => req(body, { origin: null, headers: secret === null ? {} : { 'x-inbound-secret': secret }, ...o });
{ const store = MS.memoryStore(); const h = MS.createInboundHandler({ env: baseEnv, store, now: () => T0 });
  assert.equal((await h(inboundReq({ from: 'michael@example.com', subject: 'Hi', text: 'hello' }, 'wrong'))).status, 401); assert.equal((await h(inboundReq({ from: 'michael@example.com' }, null))).status, 401);
  assert.equal((await h(inboundReq({ from: 'michael@example.com', subject: 'Hi', text: 'hello', messageId: '<a1@x>' }))).status, 200); assert.equal((await store.load()).length, 1);
  assert.deepEqual(await (await h(inboundReq({ from: 'michael@example.com', subject: 'Hi', text: 'hello', messageId: '<a1@x>' }))).json(), { ok: true, duplicate: true });
  assert.deepEqual(await (await h(inboundReq({ from: 'stranger@spam.example', subject: 'Buy', text: 'now' }))).json(), { ok: true, dropped: true }); assert.equal((await store.load()).length, 1, 'strangers are dropped');
  const pm = await h(inboundReq({ FromFull: { Email: 'BOSS@example.com' }, From: 'Boss <boss@example.com>', Subject: 'Postmark', TextBody: 'hello\u0000 there', MessageID: 'pm-1' })); assert.equal(pm.status, 200); const all = await store.load(); assert.equal(all[1].from, 'boss@example.com'); assert.equal(all[1].text, 'hello there'.replace('hello there', 'hello there')); 
  const basic = await h(req({ from: 'boss@example.com', subject: 's', text: 't', messageId: 'b1' }, { origin: null, headers: { authorization: 'Basic ' + btoa('user:sekret-value') } })); assert.equal(basic.status, 200);
  assert.equal((await MS.createInboundHandler({ env: { ...baseEnv, TECHNICIAN_EMAIL_ALLOWED_SENDERS: '' }, store })(inboundReq({ from: 'a@b.co' }))).status, 503, 'refuses to run with no allow-list');
  assert.equal((await MS.createInboundHandler({ env: { ...baseEnv, TECHNICIAN_INBOUND_SECRET: '' }, store })(inboundReq({ from: 'a@b.co' }, ''))).status, 503);
  assert.equal((await h(inboundReq({ from: 'michael@example.com', text: 'x'.repeat(5000) }, 'sekret-value', { ip: '9.9.9.9' }))).status, 200); assert.ok((await store.load()).every(m => m.text.length <= 4000));
  assert.equal((await h(inboundReq('{', 'sekret-value', { ip: '9.9.9.8' }))).status, 400); assert.equal((await h(req({}, { method: 'GET', origin: null }))).status, 405);
  console.log('PASS inbound mail: secret, allow-list, duplicates, Postmark shape, size cap'); }

// ——— mailbox for the lab page ———
{ const store = MS.memoryStore(); await store.save([{ id: 'm1', from: 'michael@example.com', subject: 'Pressure?', text: 'What is the pressure?', receivedAt: T0, messageId: '<a1@x>', delivered: false, replied: false }, { id: 'm2', from: 'rogue@evil.example', subject: 'x', text: 'y', receivedAt: T0, delivered: false, replied: false }]);
  const sends = []; const fetchImpl = async (url, init) => { sends.push({ url, init, body: JSON.parse(init.body) }); return new Response('{}', { status: 200 }); };
  const create = async p => ({ content: [{ type: 'text', text: 'Hello Michael,\n\n**It is** 760 Torr.\n\nDr. Wire' }], usage: { input_tokens: 500, output_tokens: 80 } });
  const env = { ...baseEnv, RESEND_API_KEY: 're_test', ANTHROPIC_API_KEY: 'k' };
  const h = MS.createMailHandler({ env, store, fetchImpl, client: () => ({ messages: { create } }), now: () => T0 });
  const post = async (b, o) => { const r = await h(req(b, o)); return { status: r.status, body: await r.json() }; };
  assert.deepEqual((await post({ action: 'status' })).body, { enabled: true, canSend: true, canDraft: true, durable: false, address: 'drwire@spheredesci.org' });
  assert.equal((await post({ action: 'status' }, { origin: 'https://evil.example', ip: '7.7.7.1' })).status, 403);
  const poll = (await post({ action: 'poll' })).body.mail; assert.equal(poll.length, 2); assert.equal(poll[0].id, 'm1'); assert.ok(!('messageId' in poll[0]));
  assert.equal((await post({ action: 'ack', id: 'nope' })).status, 404);
  const d = await post({ action: 'draft', id: 'm1', snapshot: { chamber: { pressure: '760 Torr' } } }); assert.equal(d.status, 200); assert.match(d.body.draft, /760 Torr/); assert.ok(!/\*/.test(d.body.draft));
  // sending: only to the stored sender, one time, only when the sender is allowed
  const s1 = await post({ action: 'send', id: 'm1', body: 'It is 760 Torr.', to: 'attacker@evil.example' }); assert.equal(s1.status, 200); assert.equal(s1.body.to, 'michael@example.com');
  const sent = sends[0]; assert.equal(sent.url, 'https://api.resend.com/emails'); assert.deepEqual(sent.body.to, ['michael@example.com']); assert.equal(sent.body.subject, 'Re: Pressure?'); assert.equal(sent.body.from, 'Dr. Wire <drwire@spheredesci.org>'); assert.equal(sent.body.headers['In-Reply-To'], '<a1@x>'); assert.match(sent.body.text, /written automatically/); assert.equal(sent.init.headers.authorization, 'Bearer re_test');
  assert.equal((await post({ action: 'send', id: 'm1', body: 'again' })).status, 409, 'one reply per message');
  assert.equal((await post({ action: 'send', id: 'm2', body: 'hi' })).status, 403, 'never replies to someone who is not on the list'); assert.equal(sends.length, 1);
  assert.equal((await post({ action: 'send', id: 'm1', body: '' })).status, 409); assert.equal((await post({ action: 'bogus' })).status, 400);
  const noSend = MS.createMailHandler({ env: { ...baseEnv }, store, fetchImpl, now: () => T0 }); const ns = await noSend(req({ action: 'send', id: 'm2', body: 'x' }, { ip: '8.8.8.8' })); assert.equal(ns.status, 503);
  const off = MS.createMailHandler({ env: { ...prod }, store }); assert.deepEqual((await (await off(req({ action: 'status' }, { ip: '8.8.8.9' }))).json()).enabled, false); assert.deepEqual((await (await off(req({ action: 'poll' }, { ip: '8.8.8.9' }))).json()).mail, []);
  const failing = MS.createMailHandler({ env, store: (() => { const s = MS.memoryStore(); s.save([{ id: 'z', from: 'boss@example.com', subject: 'q', text: 't', receivedAt: 0, delivered: false, replied: false }]); return s; })(), fetchImpl: async () => new Response('no', { status: 500 }) }); assert.equal((await failing(req({ action: 'send', id: 'z', body: 'x' }, { ip: '6.6.6.6' }))).status, 502);
  let n = 0; const limited = MS.createMailHandler({ env, store, now: () => T0 }); for (let i = 0; i < 41; i++) n = (await limited(req({ action: 'status' }, { ip: '1.9.9.9' }))).status; assert.equal(n, 429);
  console.log('PASS mailbox: poll, draft, and send only to the allowed sender, once, through the provider'); }

// ——— durable store through Upstash REST ———
{ const kv = new Map(); const f = async (url, init) => { const [cmd, key, val] = JSON.parse(init.body); assert.equal(init.headers.authorization, 'Bearer tok'); if (cmd === 'SET') { kv.set(key, val); return new Response(JSON.stringify({ result: 'OK' })); } return new Response(JSON.stringify({ result: kv.get(key) ?? null })); };
  const st = MS.upstashStore('https://x.upstash.io', 'tok', f); assert.equal(st.durable, true); assert.deepEqual(await st.load(), []); await st.save([{ id: 'a' }]); assert.deepEqual(await st.load(), [{ id: 'a' }]);
  console.log('PASS durable inbox through Upstash REST'); }

// ——— browser mail client ———
{ let polls = 0; const got = []; const queue = [[{ id: 'm1', from: 'a@b.co', subject: 's', text: 't', receivedAt: 1 }], [{ id: 'm1', from: 'a@b.co', subject: 's', text: 't', receivedAt: 1 }, { id: 'm2', from: 'a@b.co', subject: 's2', text: 't2', receivedAt: 2 }]]; let tick = null;
  const fetchImpl = async (u, init) => { const a = JSON.parse(init.body).action; if (a === 'status') return new Response(JSON.stringify({ enabled: true, canSend: true, canDraft: false, durable: true, address: 'drwire@x.org' })); if (a === 'poll') return new Response(JSON.stringify({ mail: queue[Math.min(polls++, 1)] })); return new Response(JSON.stringify({ ok: true, draft: 'D' })); };
  const c = ML.createMailClient({ fetchImpl, onMail: m => got.push(m.id), timers: { setInterval: f => { tick = f; return 1; }, clearInterval() { } } }); await c.start(); await new Promise(r => setImmediate(r)); assert.deepEqual(got, ['m1']); tick(); await new Promise(r => setTimeout(r, 5)); assert.deepEqual(got, ['m1', 'm2'], 'each message is delivered once');
  assert.equal(await c.draft('m1', {}), 'D'); assert.deepEqual(await c.send('m1', 'x'), { ok: true }); c.stop();
  const dead = ML.createMailClient({ fetchImpl: async () => new Response('<html>', { status: 404 }), onMail() { throw new Error('no'); } }); await dead.start(); assert.equal(dead.status.enabled, false);
  const down = ML.createMailClient({ fetchImpl: async () => { throw new Error('offline'); }, onMail() { } }); await down.start(); assert.equal(down.status.enabled, false);
  console.log('PASS mail client: polls only when enabled, delivers each message once, survives a static host'); }

// ——— the main AI endpoint accepts the new desk tools ———
{ const ok = SV.cleanMessages([{ role: 'user', content: 'lunch?' }, { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'order_food', input: { restaurant: "McDonald's" } }] }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'Started.' }] }]); assert.equal(ok.ok, true);
  for (const name of ['look_it_up', 'order_part']) assert.equal(SV.cleanMessages([{ role: 'user', content: 'x' }, { role: 'assistant', content: [{ type: 'tool_use', id: 't', name, input: {} }] }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: 'r' }] }]).ok, true);
  console.log('PASS the AI endpoint knows the desk tools'); }

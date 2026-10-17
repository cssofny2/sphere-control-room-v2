import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

const ST = await loadTypeScript(new URL('../src/technician/smalltalk.ts', import.meta.url));
const DK = await loadTypeScript(new URL('../src/technician/desk.ts', import.meta.url));
const CM = await loadTypeScript(new URL('../src/technician/commerce.ts', import.meta.url));
const IN = await loadTypeScript(new URL('../src/technician/intents.ts', import.meta.url));
const FL = await loadTypeScript(new URL('../src/technician/flows.ts', import.meta.url));
const TR = await loadTypeScript(new URL('../src/technician/taskRunner.ts', import.meta.url));
const C = await loadTypeScript(new URL('../src/technician/callController.ts', import.meta.url));
const D = await loadTypeScript(new URL('../src/technician/dialogue.ts', import.meta.url));
const F = await loadTypeScript(new URL('../src/technician/facts.ts', import.meta.url));
const L = await loadTypeScript(new URL('../src/technician/llm.ts', import.meta.url));
const ML = await loadTypeScript(new URL('../src/technician/mail.ts', import.meta.url));
const LC = await loadTypeScript(new URL('../src/technician/lookupClient.ts', import.meta.url));

const at = (h, m = 0, day = 14) => new Date(2026, 9, day, h, m);   // Wed 14 Oct 2026
const pick0 = { pick: () => 0 };

// 1. small talk: exact time, date and shift
{ assert.equal(ST.smallTalk('what time is it?', { now: at(13, 42) }).text, "It's 1:42 PM.");
  assert.equal(ST.smallTalk('Do you have the time', { now: at(9, 5) }).text, "It's 9:05 AM.");
  assert.match(ST.smallTalk("what's the date today", { now: at(9) }).text, /Wednesday, October 14, 2026/);
  assert.match(ST.smallTalk('what time are you working until?', { now: at(13, 40) }).text, /until five (PM|pm)|until five/i);
  assert.match(ST.smallTalk('what time are you working until?', { now: at(13, 40) }).text, /3 hours and 20 minutes/);
  assert.match(ST.smallTalk('when do you get off', { now: at(16, 30) }).text, /30 minutes/);
  assert.match(ST.smallTalk('how long are you here today', { now: at(18) }).text || '', /ended/);
  assert.match(ST.smallTalk('what time do you leave', { now: at(6, 30) }).text, /starts at eight/i);
  assert.equal(ST.smallTalk('what is the chamber pressure', { now: at(9) }), null);
  assert.equal(ST.smallTalk('what time does the VNA sweep end', { now: at(9) }), null);
  console.log('PASS small talk gives the exact time, date and shift end'); }

// 2. asking back: how is your day -> pending -> reaction -> lunch invitation near noon
{ const a = ST.smallTalk("how's your day going?", { now: at(11, 30), ...pick0 }); assert.equal(a.ask.topic, 'day'); assert.match(a.text, /how's your|how about you/i);
  const busy = ST.smallTalk('how are you', { now: at(10), alarms: 2, ...pick0 }); assert.match(busy.text, /2 open alarms/);
  const r = ST.answerPending(a.ask, 'pretty good thanks', { now: at(11, 30), ...pick0 }); assert.match(r.text, /Glad/); assert.equal(r.ask.topic, 'lunch'); assert.match(r.text, /lunch/i);
  const r2 = ST.answerPending({ topic: 'day' }, 'rough, really tired', { now: at(9), ...pick0 }); assert.match(r2.text, /Sorry|long one/); assert.equal(r2.ask, undefined);
  const neg = ST.answerPending({ topic: 'day' }, 'not so great', { now: at(9), ...pick0 }); assert.match(neg.text, /Sorry|long one/, 'negation is not positive');
  const yes = ST.answerPending({ topic: 'lunch' }, 'sure', { now: at(12), ...pick0 }); assert.equal(yes.ask.topic, 'food_place');
  const mc = ST.answerPending({ topic: 'food_place' }, "let's do McDonald's", { now: at(12), ...pick0 }); assert.equal(mc.intent.place, "McDonald's");
  const direct = ST.answerPending({ topic: 'lunch' }, 'yeah mcdonalds sounds good', { now: at(12), ...pick0 }); assert.equal(direct.intent.type, 'food');
  assert.equal(ST.answerPending({ topic: 'lunch' }, 'no thanks i already ate', { now: at(12) }).intent.type, 'lunch_declined');
  assert.equal(ST.answerPending({ topic: 'lunch' }, 'what is the pressure', { now: at(12) }), null);
  assert.equal(ST.smallTalk('want to grab something for lunch?', { now: at(12) }).ask.topic, 'lunch');
  console.log('PASS he asks questions back and reacts to the answers'); }

// 3. desk: typing is character by character, plays a key sound per character, can be cancelled
{ const keys = []; let slept = 0; const desk = DK.createDesk({ sleep: async ms => { slept += ms; await Promise.resolve(); }, onKey: ch => keys.push(ch), cps: 20 });
  const seen = []; desk.subscribe(() => { const s = desk.state.screen; if (s.kind === 'browser' && s.field === 'address') seen.push(s.typing); });
  const page = { kind: 'search', title: 'T', site: 's', lines: ['x'] };
  assert.equal(await desk.openUrl('about:websearch', page), true);
  assert.equal(keys.join(''), 'about:websearch'); assert.ok(seen.includes('abo') && seen.includes('about:websearch')); assert.equal(desk.state.screen.page.title, 'T'); assert.ok(slept > 0);
  assert.equal(await desk.search('why is the sky blue'), true); assert.equal(desk.state.screen.typing, 'why is the sky blue'); assert.equal(keys.length, 'about:websearch'.length + 'why is the sky blue'.length);
  // cancel mid-typing
  const keys2 = []; let n = 0; const d2 = DK.createDesk({ sleep: async () => { if (++n === 3) d2.cancel(); }, onKey: c => keys2.push(c) }); assert.equal(await d2.openUrl('https://example.com/a-long-address', page), false); assert.ok(keys2.length <= 4);
  // email typing and sent state
  desk.showMail({ mode: 'read', from: 'a@b.c', subject: 'Hi', body: 'Hello?', reply: '' }); assert.equal(await desk.typeReply('Hi there'), true); assert.equal(desk.state.screen.mail.reply, 'Hi there'); assert.equal(desk.state.screen.mail.mode, 'compose'); desk.markSent(); assert.equal(desk.state.screen.mail.mode, 'sent');
  // only known shopping hosts can be linked
  assert.equal(desk.setHandoff({ label: 'x', url: 'https://www.doordash.com/search/store/mcdonalds/' }), true); assert.equal(desk.setHandoff({ label: 'x', url: 'https://evil.example/doordash.com/' }), false); assert.equal(desk.setHandoff({ label: 'x', url: 'javascript:alert(1)' }), false);
  assert.ok(DK.describeScreen(desk.state.screen).join(' ').includes('reply sent'));
  console.log('PASS desk: typing, key sounds, cancel, email and link allow-list'); }

// 4. commerce: business-day ETAs, carts, requisitions
{ const wed = at(10, 0, 14); assert.equal(CM.fmtDay(CM.addBusinessDays(wed, 3)), 'Monday, October 19'); assert.equal(CM.fmtDay(CM.addBusinessDays(at(16, 0, 14), 3)), 'Tuesday, October 20', 'after the cutoff counts from tomorrow');
  assert.equal(CM.fmtDay(CM.addBusinessDays(at(10, 0, 17), 1)), 'Tuesday, October 20', 'a Saturday order counts from Monday');
  assert.match(CM.etaFor(wed, true).text, /Thursday, October 15.*expedited/);
  const cart = CM.buildCart('mcdonalds', 'a big mac and nuggets please'); assert.deepEqual(cart.items, ['Big Mac', '10-piece Chicken McNuggets']); assert.equal(cart.assumed, false);
  assert.deepEqual(CM.buildCart("McDonald's").items, ['Big Mac', 'Medium French Fries', 'Medium Drink']); assert.ok(CM.buildCart("McDonald's").assumed);
  assert.match(CM.buildCart('Joe & Sons Pizza').url, /^https:\/\/www\.doordash\.com\/search\/store\/joe%20%20sons%20pizza\/$/);
  const r = CM.buildRequisition(1, ' O-ring 150 mm ', 400, false, wed); assert.equal(r.id, 'PR-1001'); assert.equal(r.qty, 99); assert.equal(r.part, 'O-ring 150 mm');
  const store = { v: null, getItem() { return this.v; }, setItem(k, v) { this.v = v; } }; const log = CM.createOrderLog(store); log.add({ id: 'PR-1001', kind: 'requisition', title: 'x', status: 'declined', createdAt: 1, note: '' }); assert.equal(CM.createOrderLog(store).items.length, 1); assert.equal(log.nextNumber, 2);
  assert.equal(CM.createOrderLog({ getItem: () => '{bad', setItem() { } }).items.length, 0);
  console.log('PASS commerce: ETAs skip weekends, carts and requisitions are built honestly'); }

// 5. intents
{ const p = t => IN.parseCommand(t, {});
  assert.deepEqual(p('order me lunch from McDonalds on doordash'), { type: 'food', place: "McDonald's", request: 'order me lunch from McDonalds on doordash' });
  assert.equal(p('get some lunch').place, null);
  assert.deepEqual(p('please order a replacement O-ring for the door'), { type: 'part', part: 'replacement o-ring', qty: 1, urgent: false });
  assert.deepEqual(p('order 3 SMA connectors asap'), { type: 'part', part: 'sma connectors', qty: 3, urgent: true });
  assert.deepEqual(p('look up the melting point of copper'), { type: 'lookup', query: 'the melting point of copper' });
  assert.equal(p('google why is the sky blue').type, 'lookup');
  assert.equal(p('what is the order of operations'), null);
  assert.equal(p('open the door').type, 'task'); assert.equal(p('what is the pressure'), null);
  console.log('PASS intents: lunch, parts and look-ups are recognised, lab commands unchanged'); }

// ——— a full harness: runner + desk + flows + call, all with a fake clock ———
function harness(o = {}) {
  let t = 0; const clock = { now: () => t, sleep: async ms => { t += ms; await Promise.resolve(); } };
  const state = { facility: { power: true }, clock: { power: true, locked: true }, chamber: { pressure: 760, temperature: 20, targetTemp: 20, vent: false, doorOpen: false, faraday: true, isolation: true }, stage: { x: 0, y: 0, z: 0 }, vna: { power: true }, ldv: { power: true }, experiment: { records: [] }, alarms: [], failures: {} };
  const broker = TR.createConfirmBroker(); const said = []; const keys = []; const visits = []; const logs = [];
  const runner = TR.createTaskRunner({ ctx: { getState: () => state, dispatch() { }, helpers: {} }, clock, confirm: (a, b, c) => broker.ask(a, b, c), log: () => { }, actor: { goTo: async s => { visits.push(s); await clock.sleep(10); return true; }, cancel() { }, lock() { }, say: x => said.push(x) } });
  const desk = DK.createDesk({ sleep: clock.sleep, onKey: c => keys.push(c) });
  const store = { v: null, getItem() { return this.v; }, setItem(k, v) { this.v = v; } }; const orders = CM.createOrderLog(store);
  const callbacks = []; const lookups = [];
  const tech = D.createTechnician({ rng: () => 0.5 });
  const flows = FL.createFlows({ runner, desk, say: x => said.push(x), sleep: clock.sleep, now: () => at(10), callbackDelayMs: 5,
    lookup: async q => { lookups.push(q); return o.lookup ? o.lookup(q) : { ok: true, answer: 'Copper melts at 1,085 degrees Celsius. It is about 1,984 degrees Fahrenheit.', sources: [{ title: 'Copper', url: 'https://example.org/c', domain: 'example.org' }] }; },
    confirm: (text, title) => broker.ask(text, 'confirm', title), orders, callback: (m, ms) => callbacks.push({ m, ms }), mail: o.mail, answer: q => { const a = tech.ask(q, F.extractFactsPlus(state), 0); return { text: a.remark.text, known: a.known }; }, snapshot: () => ({}), log: x => logs.push(x) });
  return { runner, desk, flows, broker, said, keys, visits, orders, callbacks, lookups, logs, state, clock, tech, store };
}

// 6. look it up: walks to the desk, types, shows results, reads them; honest when search is not available
{ const H = harness(); const out = await H.flows.lookUp('what is the melting point of copper', { speak: true });
  assert.ok(H.visits.includes('workstation')); assert.ok(H.keys.length > 20, 'typed the address and the question'); assert.match(out, /Found online \(example\.org\)/);
  assert.equal(H.desk.state.screen.page.kind, 'results'); assert.ok(H.desk.state.screen.page.lines.some(l => /example\.org/.test(l)));
  assert.ok(H.said.some(x => /look it up|check on the computer|search for that|find out|web says|go look|pull that up|dig that up/i.test(x))); assert.ok(H.said.some(x => /here's what I found.*1,085/.test(x)) && H.said.some(x => /example dot org/.test(x)));
  const off = harness({ lookup: async () => ({ ok: false, code: 'not_deployed', sources: [] }) }); const o2 = await off.flows.lookUp('anything', { speak: true });
  assert.match(o2, /couldn't look that up/); assert.equal(off.desk.state.screen.page.kind, 'offline'); assert.ok(off.said.some(x => /couldn't find|came up empty|no luck|couldn't get a reliable|The reason:/.test(x))); assert.ok(!off.said.some(x => /found/i.test(x)));
  console.log('PASS look-up flow: walks, types with key sounds, shows results, reads them, and admits failure'); }

// 7. lunch: builds a cart and hands checkout to the operator; never claims it ordered
{ const H = harness(); const out = await H.flows.orderFood("McDonald's", '', { speak: true });
  assert.match(out, /NOT ordered/); assert.equal(H.desk.state.handoff.url, 'https://www.doordash.com/search/store/mcdonalds/'); assert.equal(H.desk.state.screen.page.kind, 'cart');
  assert.equal(H.orders.items[0].status, 'cart-ready'); assert.ok(H.said.some(x => /I can't use your card/.test(x))); assert.ok(!H.said.some(x => /\b(ordered|paid|placed)\b/i.test(x.replace(/not ordered/i, ''))), 'never says it was ordered');
  console.log('PASS lunch flow: cart on screen, operator checks out, nothing claimed as ordered'); }

// 8. part: needs a yes, then logs the requisition and schedules a call-back with the arrival day
{ const H = harness(); const p = H.flows.orderPart('replacement door O-ring', { speak: true });
  for (let i = 0; i < 200 && !H.broker.pending; i++) await H.clock.sleep(100);
  assert.ok(H.broker.pending, 'asks first'); assert.match(H.broker.pending.text, /PR-1001.*door O-ring.*Monday, October 19/); assert.equal(H.orders.items.length, 0, 'nothing logged before the yes');
  H.broker.answer(true); const out = await p;
  assert.equal(H.orders.items[0].status, 'requisition-submitted'); assert.match(out, /Monday, October 19.*Nothing was paid/); assert.equal(H.callbacks.length, 1); assert.equal(H.callbacks[0].ms, 5);
  assert.match(H.callbacks[0].m, /PR-1001.*Monday, October 19/);
  const N = harness(); const p2 = N.flows.orderPart('SMA connector', { urgent: true }); for (let i = 0; i < 200 && !N.broker.pending; i++) await N.clock.sleep(100); N.broker.answer(false); await p2;
  assert.equal(N.orders.items[0].status, 'declined'); assert.equal(N.callbacks.length, 0);
  console.log('PASS part flow: requisition only after a yes, call-back carries the arrival day'); }

// 9. e-mail: read it on screen, write a reply, send it only to the sender
{ const sent = []; const mail = { status: { canSend: true, canDraft: false }, async draft() { return null; }, async send(id, body) { sent.push({ id, body }); return { ok: true }; }, async ack(id) { sent.push({ ack: id }); } };
  const H = harness({ mail }); const out = await H.flows.handleMail({ id: 'm1', from: 'michael@example.com', subject: 'Pressure?', text: 'Hi Wire. How do I calibrate the VNA? Thanks.', receivedAt: 0 });
  assert.match(out, /Replied to michael@example\.com/); assert.ok(H.visits.includes('workstation')); assert.equal(H.desk.state.screen.mail.mode, 'sent'); assert.ok(H.desk.state.screen.mail.reply.length > 40); assert.ok(H.keys.length > 40);
  assert.equal(sent[0].id, 'm1'); assert.match(sent[0].body, /calibrat/i); assert.deepEqual(sent[1], { ack: 'm1' });
  const no = harness({ mail: { status: { canSend: false, canDraft: false }, draft: async () => null, send: async () => { throw new Error('must not send'); }, ack: async () => { } } });
  const o2 = await no.flows.handleMail({ id: 'm2', from: 'a@b.co', subject: 's', text: 'ok', receivedAt: 0 }); assert.match(o2, /not sent/); assert.ok(no.said.some(x => /wasn't sent/.test(x)));
  const reply = ML.offlineReply({ id: 'x', from: 'a@b.co', subject: 's', text: 'Is the zorblax flux ready? What is the pressure?', receivedAt: 0 }, q => (/pressure/.test(q) ? { text: 'It is 760 Torr.', known: true } : { text: '', known: false })); assert.match(reply, /760 Torr/); assert.match(reply, /one of your questions/);
  console.log('PASS e-mail flow: reads, types a reply, sends to the sender, and is honest when sending is off'); }

// 10. call controller: exact time, lunch conversation, unknown questions go to the computer, call-back rings
{
  const mk = (clockDate, flowsOver) => {
    const H = harness(flowsOver); const spoken = []; const bubbles = []; let rang = 0, ringOff = 0;
    const speech = { supported: { listen: false, speak: true }, listen() { }, stopListening() { }, isListening: () => false, onTranscript: () => () => { }, onError: () => () => { }, onSpeaking: () => () => { }, speak: x => { spoken.push(x); return Promise.resolve(); }, cancel() { }, isSpeaking: () => false, dispose() { } };
    const phone = { ring: on => { on ? rang++ : ringOff++; }, answer: async () => { await H.clock.sleep(10); return true; }, hangUp: async () => { }, abort() { } };
    const call = C.createCallController({ getState: () => H.state, facts: () => F.extractFactsPlus(H.state), tech: H.tech, speech, runner: H.runner, broker: H.broker, phone, beep() { }, say: b => bubbles.push(b), requestMic: async () => ({ ok: false, reason: 'off' }),
      stream: async () => { throw new L.LLMUnavailable('static host', 'not_deployed'); }, now: H.clock.now, toolWaitMs: 500, flows: H.flows, clock: () => clockDate, rng: () => 0, missedAfterMs: 50 });
    return { H, call, spoken, bubbles, counts: () => ({ rang, ringOff }) };
  };
  const flush = async () => { for (let i = 0; i < 30; i++) await new Promise(r => setImmediate(r)); };
  const X = mk(at(11, 45)); await X.call.start({ mic: false }); const origSubmit = X.call.submit; const sub = async t => { await origSubmit(t); await flush(); };
  await sub('what time is it?'); assert.ok(X.spoken.includes("It's 11:45 AM."));
  await sub('what time are you working until'); assert.ok(X.spoken.some(x => /until five PM/i.test(x)));
  await sub("how's your day going?"); assert.ok(X.spoken.some(x => /your (day|morning)|how about you/i.test(x)));
  await sub('pretty good'); assert.ok(X.spoken.some(x => /grab something for lunch/.test(x)));
  await sub('yes please'); assert.ok(X.spoken.some(x => /Where do you feel like/.test(x)));
  await sub("mcdonald's"); await flush(); for (let i = 0; i < 40; i++) await X.H.clock.sleep(200);
  assert.ok(X.H.orders.items.some(o => o.kind === 'cart' && /McDonald/.test(o.title)), 'went to the computer and built the cart'); assert.ok(X.H.said.some(x => /Open DoorDash/.test(x)));
  // an unknown question (the offline brain has no answer) is looked up at the computer and read out
  await sub('what is the boiling point of liquid nitrogen exactly'); await flush(); for (let i = 0; i < 40; i++) await X.H.clock.sleep(200);
  assert.deepEqual(X.H.lookups, ['what is the boiling point of liquid nitrogen exactly']); assert.ok(X.H.said.some(x => /here's what I found/.test(x)));
  // a part: the yes is accepted while the job is waiting, then the call-back comes in as a ringing phone
  await sub('order a replacement o-ring please'); for (let i = 0; i < 60 && !X.H.broker.pending; i++) { await flush(); await X.H.clock.sleep(200); }
  assert.ok(X.H.broker.pending); await sub('yes'); await flush(); for (let i = 0; i < 40; i++) await X.H.clock.sleep(200);
  assert.equal(X.H.orders.items.filter(o => o.kind === 'requisition').length, 1);
  await X.call.hangUp(); X.call.reset(); X.call.callBack('Your part is in.', 1); await new Promise(r => setTimeout(r, 20));
  assert.equal(X.call.incoming.message, 'Your part is in.'); assert.ok(X.counts().rang >= 2);
  X.call.answerIncoming(false); await flush(); assert.equal(X.call.state, 'connected'); assert.equal(X.spoken.at(-1), 'Your part is in.'); await X.call.hangUp();
  X.call.reset(); X.call.callBack('Missed one.', 1); await new Promise(r => setTimeout(r, 20)); assert.ok(X.call.incoming); await new Promise(r => setTimeout(r, 90)); assert.equal(X.call.incoming, null, 'unanswered call-back becomes a missed call');
  X.call.dispose();
  console.log('PASS call: exact time, lunch conversation, look-ups, part order, call-back and missed call'); }

// 11. look-up client never throws and maps failures
{ const ok = await LC.fetchLookup('q', { fetchImpl: async () => new Response(JSON.stringify({ answer: 'Yes.', sources: [{ title: 'T', url: 'https://a.org/x', domain: 'a.org' }, { nope: 1 }] }), { status: 200 }) }); assert.equal(ok.ok, true); assert.equal(ok.sources.length, 1);
  assert.equal((await LC.fetchLookup('q', { fetchImpl: async () => new Response('<html>', { status: 404 }) })).code, 'not_deployed'); assert.equal((await LC.fetchLookup('q', { fetchImpl: async () => { throw new Error('x'); } })).code, 'offline');
  assert.equal((await LC.fetchLookup('q', { fetchImpl: async () => new Response(JSON.stringify({ error: 'no_key' }), { status: 503 }) })).code, 'no_key'); assert.equal((await LC.fetchLookup('q', { fetchImpl: async () => new Response(JSON.stringify({ answer: '' }), { status: 200 }) })).code, 'no_answer');
  console.log('PASS look-up client maps every failure to an honest code'); }

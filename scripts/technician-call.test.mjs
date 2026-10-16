import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

const C = await loadTypeScript(new URL('../src/technician/callController.ts', import.meta.url));
const TR = await loadTypeScript(new URL('../src/technician/taskRunner.ts', import.meta.url));
const D = await loadTypeScript(new URL('../src/technician/dialogue.ts', import.meta.url));
const F = await loadTypeScript(new URL('../src/technician/facts.ts', import.meta.url));
const L = await loadTypeScript(new URL('../src/technician/llm.ts', import.meta.url));
const I = await loadTypeScript(new URL('../src/technician/intents.ts', import.meta.url));

const mkState = () => ({
  facility: { power: true, simulationTime: 0 }, clock: { power: true, locked: true },
  chamber: { pressure: 760, temperature: 20, targetTemp: 20, vent: false, roughing: false, turbo: false, doorOpen: false, faraday: true, isolation: true },
  stage: { x: 0, y: 0, z: 0, moving: false, settling: false, homed: true, clampActive: false, positionError: 0 }, vna: { power: true, rf: true, calibrated: false, calibrationAgeSeconds: 0, sweeping: false },
  ldv: { power: true, shutter: false, opticalQuality: 100 }, experiment: { active: false, scanActive: false, scanPaused: false, scanProgress: 0, records: [], acceptedPoints: 0, suspectPoints: 0, failedPoints: 0 }, failures: {}, alarms: [], faultDrill: {}, ui: { active: 'dashboard' },
});

function setup(o = {}) {
  let s = mkState(); const tick = () => { };
  let t = 0; const clock = { now: () => t, sleep: async ms => { t += ms; await Promise.resolve(); } };
  const dispatch = a => { if (a.type === 'PATCH') s = { ...s, [a.domain]: { ...s[a.domain], ...a.patch } }; else if (a.type === 'CALIBRATE_VNA') s = { ...s, vna: { ...s.vna, calibrated: true } }; else if (a.type === 'HOME_STAGE') s = { ...s, stage: { ...s.stage, homed: true } }; };
  const ctx = { getState: () => s, dispatch, helpers: {} };
  const broker = TR.createConfirmBroker(); const spoken = []; const events = [];
  const actor = { goTo: async () => { await clock.sleep(10); return true; }, cancel() { }, lock() { }, say: x => events.push('say:' + x) };
  const runner = TR.createTaskRunner({ ctx, actor, clock, confirm: (a, b, c) => broker.ask(a, b, c), log: () => { } });
  const listeners = { tr: [], err: [], sp: [] }; let speaking = false, listening = false;
  const speech = { supported: { listen: o.noListen ? false : true, speak: true }, listen() { listening = true; events.push('listen'); }, stopListening() { listening = false; events.push('stopListen'); }, isListening: () => listening,
    onTranscript(cb) { listeners.tr.push(cb); return () => { }; }, onError(cb) { listeners.err.push(cb); return () => { }; }, onSpeaking(cb) { listeners.sp.push(cb); return () => { }; },
    speak(x) { spoken.push(x); return Promise.resolve(); }, cancel() { events.push('cancelSpeech'); speaking = false; }, isSpeaking: () => speaking, dispose() { } };
  const tech = D.createTechnician({ rng: () => 0.5 });
  const bubbles = []; let rang = 0, ringOff = 0, answered = 0, hung = 0, aborted = 0; let tracksStopped = 0;
  let release = null; const phone = { ring: on => { on ? rang++ : ringOff++; }, answer: async () => { answered++; if (o.slowAnswer) return new Promise(r => { release = r; }); await clock.sleep(50); return !o.noAnswer; }, hangUp: async () => { hung++; }, abort: () => { aborted++; release?.(false); } };
  const call = C.createCallController({
    getState: () => s, facts: () => F.extractFactsPlus(s), tech, speech, runner, broker, phone, beep: () => { }, say: b => bubbles.push(b),
    requestMic: async () => (o.micDenied ? { ok: false, reason: 'denied' } : { ok: true, stream: { getTracks: () => [{ stop: () => { tracksStopped++; } }] } }),
    monitor: o.monitor, stream: o.stream || (async () => { throw new L.LLMUnavailable('static host', 'not_deployed'); }), now: clock.now, toolWaitMs: 500, bargeLevel: 0.2,
  });
  return { call, runner, broker, speech, spoken, events, bubbles, listeners, get s() { return s; }, set s(v) { s = v; }, setSpeaking: v => { speaking = v; }, counts: () => ({ rang, ringOff, answered, hung, aborted, tracksStopped }), clock };
}
const flush = async () => { for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r)); };

// 1. ring -> walk -> answer -> connected, with a greeting spoken, mic opened, tracks stopped on hang up
{ const X = setup(); const seen = []; X.call.subscribe(() => seen.push(X.call.state)); await X.call.start();
  assert.equal(X.call.state, 'connected'); assert.ok(seen.includes('connecting') && seen.includes('ringing')); assert.equal(X.counts().rang, 1); assert.equal(X.counts().ringOff, 1); assert.equal(X.counts().answered, 1);
  assert.ok(/Dr\. Wire speaking/.test(X.spoken[0])); assert.ok(X.events.includes('listen')); assert.equal(X.call.micState, 'ok');
  await X.call.hangUp(); assert.equal(X.call.state, 'ended'); assert.equal(X.counts().hung, 1); assert.equal(X.counts().tracksStopped, 1); assert.ok(X.events.includes('stopListen'));
  console.log('PASS call flow: ring, answer, greeting, listen, hang up releases the microphone'); }

// 2. mic denied -> text fallback still works
{ const X = setup({ micDenied: true }); await X.call.start(); assert.equal(X.call.state, 'connected'); assert.equal(X.call.micState, 'denied'); assert.ok(X.call.textOnly); assert.match(X.call.notice, /blocked/);
  await X.call.submit("What's the pressure?"); assert.ok(X.call.captions.some(c => c.who === 'wire' && /760/.test(c.text))); assert.ok(!X.events.includes('listen')); console.log('PASS mic denied: typed questions still get spoken answers'); }

// 3. hang up while ringing cancels cleanly
{ const X = setup({ slowAnswer: true }); const p = X.call.start(); await flush(); assert.equal(X.call.state, 'ringing'); await X.call.hangUp(); await p; assert.equal(X.call.state, 'ended'); assert.equal(X.counts().aborted, 1); assert.equal(X.counts().hung, 0); assert.equal(X.counts().ringOff >= 1, true); console.log('PASS hang up during the ring'); }

// 4. offline: questions use the built-in engine, commands become tasks
{ const X = setup(); await X.call.start(); await X.call.submit('how do I calibrate the VNA?'); assert.ok(X.call.captions.some(c => c.who === 'wire' && /calibrat/i.test(c.text)));
  await X.call.submit('calibrate the VNA'); await flush(); for (let i = 0; i < 20; i++) await X.clock.sleep(250); assert.equal(X.s.vna.calibrated, true); assert.ok(X.call.captions.some(c => /Watch me/.test(c.text)));
  assert.match(X.call.notice, /not set up/); assert.equal(X.call.llmDown, true); console.log('PASS offline mode answers questions and runs spoken commands'); }

// 5. LLM path: streamed text is spoken sentence by sentence; tool calls go through the runner; the 8-call cap holds
{ const turns = []; let round = 0;
  const stream = async (req, on) => { turns.push(JSON.parse(JSON.stringify(req.messages))); round++;
    if (round === 1) { on({ type: 'text', delta: 'Sure, I will home it. ' }); on({ type: 'text', delta: 'One moment' }); on({ type: 'tool_use', id: 'tu1', name: 'run_task', input: { task: 'home_stage' } }); on({ type: 'done', stop_reason: 'tool_use' }); }
    else { on({ type: 'text', delta: 'The stage is homed. ' }); on({ type: 'text', delta: 'Anything else?' }); on({ type: 'done', stop_reason: 'end_turn' }); } };
  const X = setup({ stream }); await X.call.start(); X.spoken.length = 0; await X.call.submit('home the stage please'); await flush();
  assert.deepEqual(X.spoken, ['Sure, I will home it.', 'One moment', 'The stage is homed.', 'Anything else?']);
  const second = turns[1]; assert.equal(second.at(-1).role, 'user'); assert.equal(second.at(-1).content[0].type, 'tool_result'); assert.match(second.at(-1).content[0].content, /Accepted: Home the stage/);
  assert.equal(second.at(-2).content.at(-1).type, 'tool_use'); console.log('PASS LLM turn: sentences spoken as they stream, tool call executed and result returned'); }
{ let round = 0; const results = [];
  const stream = async (req, on) => { round++; if (round === 1) { for (let i = 0; i < 10; i++) on({ type: 'tool_use', id: 'u' + i, name: 'look', input: {} }); } else { results.push(...req.messages.at(-1).content); on({ type: 'text', delta: 'Done.' }); } };
  const X = setup({ stream }); await X.call.start(); await X.call.submit('do lots'); await flush();
  const limited = results.filter(r => r.is_error && /limit/.test(r.content)); assert.equal(limited.length, 2, JSON.stringify(results.map(r => r.content))); console.log('PASS at most 8 tool calls per reply'); }

// 6. risky action asks for confirmation; the operator says yes by voice
{ const stream = async (req, on) => { if (req.messages.at(-1).role === 'user' && typeof req.messages.at(-1).content === 'string') on({ type: 'tool_use', id: 'v', name: 'vent_chamber', input: {} }); else on({ type: 'text', delta: 'Okay.' }); };
  const X = setup({ stream }); X.s = { ...X.s, chamber: { ...X.s.chamber, pressure: 1e-5, roughing: true, turbo: true } }; await X.call.start();
  const p = X.call.submit('vent the chamber'); await flush(); for (let i = 0; i < 6; i++) await X.clock.sleep(200); await flush();
  assert.ok(X.broker.pending && X.broker.pending.risk === 'destructive', 'confirmation requested'); assert.equal(X.s.chamber.vent, false);
  await X.call.submit('yes go ahead'); await flush(); for (let i = 0; i < 6; i++) await X.clock.sleep(200); await p; assert.equal(X.s.chamber.vent, true); console.log('PASS risky action waits for a spoken yes'); }

// 7. barge-in cancels speech when the mic is loud
{ let level = 0; const X = setup({ monitor: () => ({ available: true, level: () => level, dispose() { } }) }); await X.call.start(); X.setSpeaking(true);
  level = 0.5; await new Promise(r => setTimeout(r, 450)); assert.ok(X.events.includes('cancelSpeech'), 'speech cancelled by barge-in'); await X.call.hangUp(); console.log('PASS barge-in stops Dr. Wire when the operator talks over him'); }

// 8. mute stops listening and ignores transcripts
{ const X = setup(); await X.call.start(); X.call.setMuted(true); assert.ok(X.events.at(-1) === 'stopListen'); X.listeners.tr.forEach(cb => cb('what is the pressure', true)); await flush(); assert.ok(!X.call.captions.some(c => c.who === 'you'));
  X.call.setMuted(false); X.listeners.tr.forEach(cb => cb('what is the pressure', true)); await flush(); assert.ok(X.call.captions.some(c => c.who === 'you')); await X.call.hangUp(); console.log('PASS mute ignores speech until unmuted'); }

// 9. push-to-talk collects the phrase and submits on release
{ const X = setup(); await X.call.start(); X.call.setMicInput('push'); X.call.pttDown(); X.listeners.tr.forEach(cb => cb('where is the stage', true)); const p = X.call.pttUp(); await new Promise(r => setTimeout(r, 800)); await p; await flush();
  assert.ok(X.call.captions.some(c => c.who === 'you' && /where is the stage/.test(c.text))); console.log('PASS push-to-talk'); }

// 10. emergency stop and cancel by voice
{ const X = setup(); X.s = { ...X.s, ldv: { power: true, shutter: true } }; await X.call.start(); await X.call.submit('emergency stop'); assert.equal(X.s.ldv.shutter, false); console.log('PASS "emergency stop" by voice works without the AI'); }

// 11. SSE parser and sentence chunker
{ const carry = { buf: '' }; let ev = L.parseSSE('event: text\ndata: {"type":"text","delta":"Hi"}\n\nevent: do', carry); assert.equal(ev.length, 1); ev = L.parseSSE('ne\ndata: {"type":"done","stop_reason":"end_turn"}\n\n', carry); assert.equal(ev[0].type, 'done');
  const out = []; const ch = L.createSentenceChunker(s => out.push(s)); ch.push('Hello there. How a'); ch.push('re you? Fine'); ch.flush(); assert.deepEqual(out, ['Hello there.', 'How are you?', 'Fine']); console.log('PASS SSE parsing and sentence chunking'); }

// 12. intents
{ const st = { stage: { x: 1, y: 2, z: 3 } }; assert.deepEqual(I.parseCommand('please pump down the chamber'), { type: 'task', id: 'pump_down', params: {} });
  assert.deepEqual(I.parseCommand('move the stage to x 5 y -10 z 0', st), { type: 'task', id: 'move_stage', params: { x: 5, y: -10, z: 0 } });
  assert.deepEqual(I.parseCommand('move the stage x 7', st).params, { x: 7, y: 2, z: 3 }); assert.equal(I.parseCommand('why do we pump down?'), null);
  assert.equal(I.parseCommand('emergency stop').type, 'estop'); assert.equal(I.parseCommand('cancel the task').type, 'cancel'); assert.equal(I.parseCommand('start an axis scan').params.kind, 'axis');
  assert.ok(I.isYes('Yes please') && I.isNo("no, don't") && !I.isYes('maybe')); console.log('PASS spoken command parsing'); }

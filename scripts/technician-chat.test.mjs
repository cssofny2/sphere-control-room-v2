import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

const B = await loadTypeScript(new URL('../src/technician/chatBank.ts', import.meta.url));
const C = await loadTypeScript(new URL('../src/technician/chatter.ts', import.meta.url));
const T = B.ALL_TOPICS;
const mk = () => B.createChatter();
const at = (h, m = 0, d = 14) => new Date(2026, 9, d, h, m);   // Wed 14 Oct 2026 by default
const ctx = (o = {}) => ({ now: at(13), pick: () => 0, ...o });

// 1. size: ten times the old set (about 12 everyday topics and 30 lines)
{ const variants = T.reduce((n, t) => n + (typeof t.a === 'function' ? t.a(ctx()).length : t.a.length), 0);
  const examples = T.reduce((n, t) => n + t.ex.length, 0);
  assert.ok(T.length >= 120, `topics ${T.length}`); assert.ok(variants >= 360, `variants ${variants}`); assert.ok(examples >= 450, `examples ${examples}`);
  console.log(`PASS ${T.length} topics, ${variants} answer variants, ${examples} example questions`); }

// 2. integrity: unique ids, every topic has examples, at least 2 answers, nothing empty
{ const ids = new Set();
  for (const t of T) { assert.ok(!ids.has(t.id), 'duplicate id ' + t.id); ids.add(t.id); assert.ok(t.ex.length >= 2, t.id + ' needs examples');
    const vs = typeof t.a === 'function' ? t.a(ctx()) : t.a; assert.ok(vs.length >= 1 && vs.every(v => v.trim().length > 2), t.id);
    if (!t.ack && t.cat !== 'meta') assert.ok(vs.length >= 2 || t.id === 'real_name', t.id + ' needs at least two answer variants');
    for (const v of vs) assert.ok(!/[{}]|undefined|\bnull\b/.test(v), t.id + ': ' + v); }
  console.log('PASS every topic has unique id, examples and clean answers'); }

// 3. every example question reaches its own topic (this is the published list)
{ const c = mk(); const bad = [];
  for (const t of T) for (const e of t.ex) { const m = c.match(e); if (!m || m.id !== t.id) bad.push(`${t.id}: "${e}" -> ${m ? m.id : 'none'}`); }
  assert.equal(bad.length, 0, '\n' + bad.join('\n')); console.log('PASS all example questions match their own topic'); }

// 4. the personal questions the owner asked about
{ const c = mk();
  const q = (s, re) => { const r = c.reply(s, ctx()); assert.ok(r && re.test(r.text), s + ' -> ' + (r && r.text)); c.reset(); };
  q('how much do you make an hour?', /forty-six/i); q('how much do you make?', /forty-six/i); q('What is your hourly rate', /forty-six/i);
  q('how much do you make a year', /ninety-six thousand/i); 
  q('are you paid well', /./); q('do you like your job?', /./); q('are you married', /Maria/); q('do you have kids', /Theo/);
  q('do you have a dog', /Hertz/); q('what is your favorite food', /pizza|chili/i); q('how old are you', /forty-one/);
  q('are you a real person', /simulated|AI character|not a real person/i); q('are you human?', /simulated|AI/i);
  console.log('PASS get-off-work, pay and personal questions have logical, consistent answers'); }

// 5. lab and command talk never lands here
{ const c = mk(); const no = ['what is the chamber pressure', 'run the startup sequence', 'how do I calibrate the VNA', 'start a scan', 'open the laser shutter', 'what is the vna doing', 'turn on the rubidium clock', 'why is the stage drifting', 'what do you do when pressure rises', 'move the stage to x 5', 'order lunch from mcdonalds', 'pump down the chamber', 'explain the resonance peak', 'what is the temperature of the chamber', 'show me the scan data', 'which sphere are we measuring', 'is the faraday cage on', 'how does the vibrometer work', 'what is a torr', 'tell me a joke', 'what should I do next', 'give me a summary', 'what does that mean', 'how does it work', 'why', 'explain that', 'what happened', 'tell me more', 'go on', 'what is the next step', 'is everything okay', 'what is wrong', 'do you know what the alarm means', 'what time is it', 'how are you', 'when do you get off work', 'look up the boiling point of nitrogen', 'order a gasket', 'what is your plan for the scan', 'can you hear the pump', 'how long until pumpdown finishes', 'what do you think about the signal', 'do you see anything odd in the trace'];
  for (const s of no) assert.equal(c.match(s), null, 'false match: ' + s + ' -> ' + (c.match(s) || {}).id);
  console.log('PASS instrument questions and commands are never taken for small talk'); }

// 6. no repeats: asking again rotates the wording and admits it
{ const c = mk(); const seen = new Set(); let t0 = null;
  for (let i = 0; i < 4; i++) { const r = c.reply('how much do you make an hour', { now: at(10), pick: () => 0, busy: true }); seen.add(r.text); if (i === 0) t0 = r.text; }
  assert.ok(seen.size >= 3, 'wording should rotate: ' + seen.size);
  const again = c.reply('how much do you make an hour', { now: at(10), pick: () => 0, busy: true });
  assert.match(again.text, /^(Like I said|Same as before|Still the same|As I mentioned)/); assert.notEqual(again.text, t0);
  console.log('PASS repeated questions get new wording and an acknowledgement'); }

// 7. he asks back, then reacts to the answer like a person (not on every turn, never during alarms)
{ const c = mk(); const r = c.reply('do you have a dog', ctx({ pick: () => 0 })); assert.ok(r.ask && r.ask.topic === 'chat' && /\?$/.test(r.text), r.text);
  const f = c.follow('yes a golden retriever named Max', ctx()); assert.ok(f && /Dogs/i.test(f), f);
  const f2 = c.follow('what time is it', ctx()); assert.equal(f2, null, 'a question is not an answer');
  const f3 = c.follow('run the startup sequence', ctx()); assert.equal(f3, null);
  const f4 = c.follow('no not really', ctx()); assert.ok(f4 && /Fair enough|okay/i.test(f4), f4);
  const quiet = mk().reply('do you have a dog', ctx({ alarms: 2 })); assert.ok(!quiet.ask, 'no questions back during alarms');
  const busy = mk().reply('do you have a dog', ctx({ busy: true })); assert.ok(!busy.ask);
  console.log('PASS he asks back, reacts to the answer, and stays quiet during alarms'); }

// 8. time-aware answers
{ const c = mk(); assert.match(c.reply('how was your weekend', ctx({ now: at(9, 0, 12) })).text, /./);
  const mon = c.reply('how was your weekend', ctx({ now: at(9, 0, 12) })); assert.ok(mon); c.reset();
  const fri = c.reply('any plans for the weekend', ctx({ now: at(15, 0, 16) })); assert.match(fri.text, /bike|family|chili|Theo/i);
  c.reset(); assert.match(c.reply('happy Friday', ctx({ now: at(9, 0, 16) })).text, /Friday|weekend/i);
  c.reset(); assert.match(c.reply('what time do you start', ctx({ shift: { start: 7, end: 15, lunch: 11.5 } })).text, /seven/i);
  console.log('PASS answers depend on the day and the shift'); }

// 9. weather asks for a city instead of guessing
{ const c = mk(); const r = c.reply("how's the weather?", ctx()); assert.deepEqual(r.ask, { topic: 'weather' }); assert.match(r.text, /city/i);
  console.log('PASS weather asks for a city'); }

// 10. operator statements get a human reaction
{ const c = mk(); const cases = [['I am so tired', /coffee|break|recharge/i], ['I have a bad day', /sorry|rough|plate/i], ['I\'m hungry', /order|eat|fix/i], ['it is my birthday', /birthday/i], ['I got promoted', /congrat/i], ['I feel overwhelmed', /breath|step/i]];
  for (const [s, re] of cases) { const r = c.reply(s, ctx()); assert.ok(r && re.test(r.text), s + ' -> ' + (r && r.text)); c.reset(); }
  console.log('PASS statements about the operator\'s day get a human reaction'); }

// 11. the answer text is spoken-friendly: no markdown, no stray symbols, reasonable length
{ for (const t of T) for (const v of typeof t.a === 'function' ? t.a(ctx()) : t.a) { assert.ok(!/[*_`#<>]/.test(v), t.id + ': ' + v); assert.ok(v.length < 330, t.id + ' too long: ' + v.length); } console.log('PASS answers are short and speakable'); }

// 12. persona bible agrees with the answers
{ const P = await loadTypeScript(new URL('../src/technician/personaBible.ts', import.meta.url));
  assert.equal(P.BIBLE.hourly, 46); assert.ok(/46 dollars an hour/.test(P.BIBLE_PROMPT) && /simulated technician/.test(P.BIBLE_PROMPT));
  console.log('PASS persona bible is consistent with the offline answers'); }

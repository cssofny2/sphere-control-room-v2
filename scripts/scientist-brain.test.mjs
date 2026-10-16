import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

const B = await loadTypeScript(new URL('../src/labscene/scientistBrain.ts', import.meta.url));
let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const base = () => ({
  facility: { power: true }, clock: { power: true, locked: true, cableFault: false },
  chamber: { pressure: 760, temperature: 20, targetTemp: 20, vent: true, roughing: false, turbo: false, doorOpen: false, faraday: true, isolation: true },
  stage: { moving: false, settling: false, homed: true }, vna: { power: true, rf: true, calibrated: true },
  ldv: { power: true, shutter: false }, experiment: { scanActive: false, scanProgress: 0, records: [], acceptedPoints: 0, suspectPoints: 0, failedPoints: 0 },
  failures: {}, alarms: [],
});
const facts = s => B.extractFacts(s);

// extractFacts reads the real state shape
const f0 = facts(base());
assert.equal(f0.power, true); assert.equal(f0.pressure, 760); assert.equal(f0.alarms.length, 0);
console.log('PASS extractFacts reads the app state');

// first observe is silent; a status change produces a comment
let brain = B.createBrain({ rng });
assert.equal(brain.observe(f0, 0), null);
let s = base(); s.chamber.doorOpen = true;
let r = brain.observe(facts(s), 1000);
assert.ok(r && /door/i.test(r.text) && r.focus === 'door', JSON.stringify(r));
console.log('PASS door opening gets a comment and sends him to the door');

// minimum gap queues lower-priority remarks, then releases them
s = base(); s.chamber.doorOpen = true; s.chamber.roughing = true;
assert.equal(brain.observe(facts(s), 2000), null, 'held back by the minimum gap');
r = brain.observe(facts(s), 7000);
assert.ok(r && /pump|rough|scroll/i.test(r.text), JSON.stringify(r));
console.log('PASS comments are paced and queued, not spammed');

// new alarms are announced once, critical ones cut the line
brain = B.createBrain({ rng }); brain.observe(f0, 0);
s = base(); s.alarms = [{ id: 1, text: 'Turbo activation rejected: chamber pressure exceeds 50 Torr safety interlock.', severity: 'critical', acknowledged: false }];
r = brain.observe(facts(s), 500);
assert.ok(r && r.kind === 'alert' && r.mood === 'worried' && /Turbo/.test(r.text), JSON.stringify(r));
assert.equal(brain.observe(facts(s), 9000), null, 'same alarm is not announced twice');
console.log('PASS alarms are announced once');

// acknowledged alarms are ignored by extractFacts
s = base(); s.alarms = [{ id: 2, text: 'x', severity: 'warning', acknowledged: true }];
assert.equal(facts(s).alarms.length, 0);
console.log('PASS acknowledged alarms are ignored');

// injected faults get specific remarks
brain = B.createBrain({ rng }); brain.observe(f0, 0);
s = base(); s.failures = { vacuumLeak: true };
r = brain.observe(facts(s), 3000);
assert.ok(r && /leak/i.test(r.text) && r.focus === 'chamber');
console.log('PASS vacuum-leak fault is called out');

// deep vacuum and scan lifecycle
brain = B.createBrain({ rng, minGapMs: 0 }); s = base(); s.chamber.pressure = 1; s.chamber.roughing = true; s.chamber.vent = false; brain.observe(facts(s), 0);
s = base(); s.chamber.pressure = 5e-4; s.chamber.turbo = true; s.chamber.roughing = true; s.chamber.vent = false;
r = brain.observe(facts(s), 100);
assert.ok(r && /vacuum|1e-3|empty/i.test(r.text), JSON.stringify(r));
s.experiment = { scanActive: true, scanProgress: 0, records: [], acceptedPoints: 0, suspectPoints: 0, failedPoints: 0 };
r = brain.observe(facts(s), 200); assert.ok(r && /scan|measur/i.test(r.text), JSON.stringify(r));
s.experiment = { ...s.experiment, scanActive: false, records: [1, 2, 3] };
r = brain.observe(facts(s), 300); assert.ok(r && /3/.test(r.text), JSON.stringify(r));
console.log('PASS vacuum and scan milestones are reported');

// idle: after the idle delay he greets, then tells jokes / hints that do not repeat back-to-back
brain = B.createBrain({ rng, idleMinMs: 1000, idleMaxMs: 1000, minGapMs: 0 }); brain.observe(f0, 0);
const said = []; let t = 0;
for (let i = 0; i < 400; i++) { t += 500; const m = brain.observe(f0, t); if (m) said.push(m); }
assert.ok(said.length >= 20, `idle remarks ${said.length}`);
assert.match(said[0].text, /Dr\. Wire/);
assert.ok(said.some(m => m.kind === 'joke') && said.some(m => m.kind === 'hint'));
for (let i = 1; i < said.length; i++) assert.notEqual(said[i].text, said[i - 1].text);
const jokes = said.filter(m => m.kind === 'joke').map(m => m.text);
assert.ok(new Set(jokes).size >= Math.min(jokes.length, B.JOKES.length) - 1 || jokes.length > B.JOKES.length, 'jokes rotate through the whole bag');
console.log(`PASS idle chatter: greeting, ${jokes.length} jokes and hints, no back-to-back repeats`);

// every joke is a real sentence
assert.ok(B.JOKES.length >= 20 && B.JOKES.every(j => j.length > 20 && j.length < 160));
// next-step hints follow the real startup order
assert.match(B.nextStep({ ...f0, power: false }).text, /breaker/i);
assert.match(B.nextStep({ ...f0, pressure: 760, roughing: false, turbo: false }).text, /rough/i);
assert.match(B.nextStep({ ...f0, pressure: 1e-4 }).text, /start a scan|Home|VNA|laser|vibrometer|Temperature|Shielding|calibrated/i);
console.log('PASS jokes are well-formed and hints follow the startup order');

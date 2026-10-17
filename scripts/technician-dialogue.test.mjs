import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

const D = await loadTypeScript(new URL('../src/technician/dialogue.ts', import.meta.url));
const F = await loadTypeScript(new URL('../src/technician/facts.ts', import.meta.url));
const A = await loadTypeScript(new URL('../src/technician/answer.ts', import.meta.url));
const J = await loadTypeScript(new URL('../src/technician/jokes.ts', import.meta.url));
const K = await loadTypeScript(new URL('../src/technician/knowledge.generated.ts', import.meta.url));

let seed = 11; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const base = () => ({
  facility: { power: true, simulationTime: 0 }, clock: { power: true, locked: true, cableFault: false },
  chamber: { pressure: 760, temperature: 20, targetTemp: 20, vent: true, roughing: false, turbo: false, doorOpen: false, faraday: true, isolation: true },
  stage: { x: 0, y: 0, z: 0, moving: false, settling: false, homed: true, positionError: 0 }, vna: { power: true, rf: true, calibrated: true, calibrationAgeSeconds: 10 },
  ldv: { power: true, shutter: false, opticalQuality: 100 }, experiment: { scanActive: false, scanProgress: 0, records: [], acceptedPoints: 0, suspectPoints: 0, failedPoints: 0 },
  failures: {}, alarms: [], faultDrill: {},
});
const fp = s => F.extractFactsPlus(s);
const mk = (o = {}) => D.createTechnician({ rng, ...o });
const settle = (t, s, at) => t.observe(fp(s), at);

// 1. stage script quotes live values
{ const t = mk(); const s = base(); settle(t, s, 0);
  s.chamber.roughing = true; s.chamber.pressure = 300; const r = settle(t, s, 1000);
  assert.ok(r && /300 Torr/.test(r.text) && r.category === 'stage', JSON.stringify(r));
  assert.ok(r.why.length > 10); console.log('PASS stage script quotes live pressure and logs why'); }

// 2. fault script: headline, cause, effect, check, fix, hold at full verbosity
{ const t = mk({ settings: { verbosity: 1 } }); const s = base(); settle(t, s, 0);
  s.failures.vacuumLeak = true; const r = settle(t, s, 1000);
  assert.ok(r && r.kind === 'alert' && r.safety && r.lines.length === 6, JSON.stringify(r));
  for (const w of ['Cause', 'Effect', 'Check', 'Fix', 'Hold off']) assert.ok(r.text.includes(w), w);
  console.log('PASS fault script has cause/effect/check/fix/hold'); }

// 3. verbosity trimming keeps the fix for faults
{ const t = mk({ settings: { verbosity: 0 } }); const s = base(); settle(t, s, 0);
  s.failures.ldvMisalign = true; const r = settle(t, s, 1000);
  assert.equal(r.lines.length, 2, JSON.stringify(r.lines)); assert.ok(/Pause|hold off|Keep the shutter|Fix/i.test(r.text));
  console.log('PASS low verbosity still keeps the closing instruction'); }

// 4. blind drill does not name the fault
{ const t = mk(); const s = base(); settle(t, s, 0);
  s.failures.clockDrift = true; s.faultDrill = { hiddenKey: 'clockDrift', revealed: false };
  const r = settle(t, s, 1000); assert.ok(r && !/drift|clock/i.test(r.text.replace(/reference/gi, '')) , r.text);
  console.log('PASS blind fault drill is not spoiled'); }

// 5. trend: pressure creeping up while pumping, before any leak flag
{ const t = mk(); const s = base(); s.chamber.roughing = true; s.chamber.vent = false; s.chamber.pressure = 20; settle(t, s, 0);
  let got = null; for (let i = 1; i <= 8; i++) { s.chamber.pressure = 20 + i * 6; const r = settle(t, s, i * 1500); if (r && r.category === 'trend') got = r; }
  assert.ok(got && /creeping up/.test(got.text), JSON.stringify(got)); console.log('PASS early trend warning for rising pressure'); }

// 6. escalation: unresolved alarm gets stronger over time
{ const t = mk({ escalationMs: [1000, 3000, 6000], minGapMs: 100 }); const s = base(); settle(t, s, 0);
  s.alarms = [{ id: 1, text: 'RF shielding disabled: VNA data may be corrupted.', severity: 'warning', acknowledged: false }];
  const seen = []; for (let t0 = 500; t0 <= 12000; t0 += 500) { const r = t.observe(fp(s), t0); if (r) seen.push(r); }
  assert.ok(seen[0].category === 'alarm', 'first: alarm'); const cats = seen.map(x => x.key);
  assert.ok(cats.some(k => k.startsWith('esc:1:1')) && cats.some(k => k.endsWith(':2')) && cats.some(k => k.endsWith(':3')), cats.join(','));
  assert.ok(/blocking/.test(seen.find(x => x.key.endsWith(':3')).text)); console.log('PASS alarms escalate through three levels'); }

// 7. no jokes during safety events or open alarms, but jokes happen when calm
{ const t = mk({ idleMinMs: 100, idleMaxMs: 200, minGapMs: 100, settings: { jokeFreq: 1, mode: 'chatty' } });
  const s = base(); s.chamber.vent = false; s.chamber.pressure = 1e-5; s.chamber.turbo = true; settle(t, s, 0);
  let jokes = 0; for (let k = 1; k < 200; k++) { const r = t.observe(fp(s), k * 700); if (r && r.category === 'joke') jokes++; }
  assert.ok(jokes > 0, 'jokes when calm'); console.log(`PASS jokes appear when calm (${jokes})`);
  const t2 = mk({ idleMinMs: 100, idleMaxMs: 200, minGapMs: 100, settings: { jokeFreq: 1, mode: 'chatty' } });
  const s2 = base(); settle(t2, s2, 0); s2.failures.vacuumLeak = true; s2.alarms = [{ id: 9, text: 'Fault simulator: Vacuum leak active.', severity: 'warning', acknowledged: false }];
  let bad = 0; for (let k = 1; k < 300; k++) { const r = t2.observe(fp(s2), k * 700); if (r && r.category === 'joke') bad++; }
  assert.equal(bad, 0); const c = t2.chat(fp(s2), 999999); assert.notEqual(c.category, 'joke'); console.log('PASS no jokes during a safety event'); }

// 8. laser + open door is a safety alert
{ const t = mk(); const s = base(); s.ldv.shutter = true; settle(t, s, 0); s.chamber.doorOpen = true;
  const r = settle(t, s, 1000); assert.ok(r && r.safety && /laser/i.test(r.text), JSON.stringify(r)); console.log('PASS laser with open door raises a safety alert'); }

// 9. findings summary after a scan, with memory
{ const t = mk(); const s = base(); s.experiment.scanActive = true; s.experiment.scanProgress = 0.5; settle(t, s, 0);
  s.experiment.scanActive = false; s.experiment.records = new Array(9).fill({}); s.experiment.acceptedPoints = 8; s.experiment.suspectPoints = 1; s.experiment.failedPoints = 0;
  const r = settle(t, s, 1000); assert.ok(r && r.category === 'finding' && /9 records/.test(r.text) && /8 accepted/.test(r.text), JSON.stringify(r));
  assert.equal(t.memory.scansDone, 1); assert.ok(/1 scan/.test(t.sessionSummary(fp(s)))); console.log('PASS post-scan findings summary and session memory'); }

// 10. quiet mode only speaks for alerts; coach explains; settings change behaviour
{ const t = mk({ settings: { mode: 'quiet' } }); const s = base(); settle(t, s, 0);
  s.chamber.faraday = false; assert.equal(settle(t, s, 1000), null, 'quiet ignores low-priority status');
  s.failures.emiSpike = true; const r = settle(t, s, 3000); assert.ok(r && r.kind === 'alert'); console.log('PASS quiet mode speaks only for important things'); }

// 11. questions: live state, knowledge, unknown
{ const t = mk(); const s = base(); s.chamber.pressure = 5e-4; const f = fp(s);
  let a = t.ask("What's the pressure right now?", f, 10); assert.ok(a.known && /5\.0e-4 Torr/.test(a.remark.text), a.remark.text);
  a = t.ask('Why do we need a Faraday cage?', f, 20); assert.ok(a.known && /RF|electromagnetic|interference|radio/i.test(a.remark.text), a.remark.text);
  a = t.ask('What is the capital of France?', f, 30); assert.ok(!a.known && /don'?t know|no idea|not sure|drawing a blank|don'?t have an answer|not something i know|wish i could|outside what/i.test(a.remark.text), a.remark.text); assert.ok(t.memory.unanswered.length === 1);
  a = t.ask('How do I pump down the chamber?', f, 40); assert.ok(a.known && /roughing/i.test(a.remark.text), a.remark.text);
  a = t.ask('Are we ready to measure?', f, 50); assert.ok(a.known && /Not yet|good to measure/.test(a.remark.text));
  console.log('PASS questions: live state, knowledge, and "I don\'t know"'); }

// 12. jokes: at least 60 new, unique, and none duplicated from the old list
{ const old = (await loadTypeScript(new URL('../src/labscene/scientistBrain.ts', import.meta.url))).JOKES;
  const txt = J.NEW_JOKES.map(j => j.text); assert.ok(txt.length >= 60, String(txt.length)); assert.equal(new Set(txt).size, txt.length);
  assert.ok(txt.every(x => !old.includes(x))); assert.ok(txt.every(x => !/\b(damn|hell|crap|stupid|idiot|sex)\b/i.test(x))); console.log(`PASS ${txt.length} new unique clean jokes`); }

// 13. every "why" is present in the log
{ const t = mk(); const s = base(); settle(t, s, 0); s.clock.locked = false; settle(t, s, 100000);
  assert.ok(t.log.length >= 1 && t.log.every(l => l.why && t.explain(l.id) === l.why)); console.log('PASS every line in the log can explain itself'); }

// 14. knowledge base content sanity
assert.ok(K.KNOWLEDGE.length > 150); assert.ok(K.KNOWLEDGE.some(e => e.id.startsWith('ov.')) && K.KNOWLEDGE.some(e => e.id.startsWith('faults.')));
console.log(`PASS knowledge base has ${K.KNOWLEDGE.length} entries from the repo`);

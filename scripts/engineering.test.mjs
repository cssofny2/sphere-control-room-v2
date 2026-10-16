import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

const P = await loadTypeScript(new URL('../src/engineering/parts.ts', import.meta.url));
const mk = (o = {}) => {
  const b = structuredClone({
    facility: { power: true }, clock: { power: true, locked: true, cableFault: false },
    chamber: { pressure: 1e-5, temperature: 20, targetTemp: 20, vent: false, roughing: true, turbo: true, roughingRpm: 100, turboRpm: 100, faraday: true, isolation: true, doorOpen: false },
    stage: { x: 0, y: 0, z: 0, moving: false, settling: false, homed: true, clampActive: false },
    vna: { power: true, rf: true, calibrated: true, calibrationAgeSeconds: 60 }, ldv: { power: true, shutter: true, opticalQuality: 95 },
    scope: { power: true, timebase: 10 }, experiment: { scanActive: false, records: [] }, failures: {}, alarms: [], faultDrill: {},
  });
  for (const k of Object.keys(o)) b[k] = typeof o[k] === 'object' && !Array.isArray(o[k]) ? { ...b[k], ...o[k] } : o[k];
  return b;
};
const link = (s, id) => P.signalLinks(s).find(l => l.id === id);
const health = (s, id) => P.PART_BY_ID[id].health(s);

// registry shape: unique ids and tags, every help key exists
{
  const help = await import('node:fs').then(fs => fs.readFileSync(new URL('../src/overview/overviewHelp.ts', import.meta.url), 'utf8'));
  assert.equal(new Set(P.PARTS.map(p => p.id)).size, P.PARTS.length);
  assert.equal(new Set(P.PARTS.map(p => p.tag)).size, P.PARTS.length);
  for (const p of P.PARTS) { assert.ok(help.includes(`"${p.help}"`), `help key ${p.help} for ${p.id}`); assert.ok(['ok', 'warn', 'fail', 'off'].includes(p.health(mk()).state)); assert.ok(p.values(mk()).length > 0); }
  console.log(`PASS ${P.PARTS.length} parts have unique tags, real help keys, health and values`);
}
// healthy lab
{ const s = mk(); for (const id of ['chamber', 'roughing', 'turbo', 'clock', 'stage']) assert.equal(health(s, id).state, 'ok', id); assert.deepEqual(P.signalLinks(s).filter(l => l.state !== 'ok').map(l => l.id), []); assert.deepEqual(P.partsWithProblems(s), []); console.log('PASS a healthy lab has no broken links or problem parts'); }
// power off
{ const s = mk({ facility: { power: false } }); assert.equal(health(s, 'chamber').state, 'off'); assert.equal(health(s, 'breaker').state, 'off'); assert.equal(link(s, 'motion').state, 'broken'); console.log('PASS breaker open turns parts off and breaks links'); }
// broken reference link
{ const s = mk({ failures: { clockDrift: true } }); assert.equal(link(s, 'ref-vna').state, 'broken'); assert.match(link(s, 'ref-vna').reason, /drift/i); assert.equal(health(s, 'clock').state, 'fail');
  const s2 = mk({ clock: { cableFault: true } }); assert.equal(link(s2, 'ref-ldv').state, 'broken'); assert.equal(link(mk({ clock: { power: false, locked: false } }), 'ref-scope').state, 'broken');
  console.log('PASS clock drift, cable fault or clock off break the 10 MHz reference links'); }
// degraded rf path
{ const s = mk({ chamber: { faraday: false } }); assert.equal(link(s, 'rf-drive').state, 'degraded'); assert.match(link(s, 'rf-drive').reason, /cage/i);
  assert.equal(link(mk({ failures: { emiSpike: true } }), 'rf-drive').state, 'degraded'); assert.equal(link(mk({ vna: { rf: false } }), 'rf-drive').state, 'broken');
  assert.equal(link(mk({ chamber: { isolation: false } }), 'velocity').state, 'degraded'); console.log('PASS RF and velocity links degrade with cage off, EMI or no isolation'); }
// laser link
{ assert.equal(link(mk({ ldv: { shutter: false } }), 'laser').state, 'broken'); assert.equal(link(mk({ failures: { ldvMisalign: true } }), 'laser').state, 'degraded'); assert.equal(link(mk({ ldv: { opticalQuality: 40 } }), 'laser').state, 'degraded'); console.log('PASS laser link follows shutter, misalignment and optical quality'); }
// motion link
{ assert.equal(link(mk({ stage: { clampActive: true } }), 'motion').state, 'degraded'); assert.equal(link(mk({ chamber: { doorOpen: true } }), 'motion').state, 'degraded'); console.log('PASS stage command link degrades with clamp or open door'); }
// failed parts link to alarms
{ const s = mk({ failures: { vacuumLeak: true }, alarms: [{ id: 7, text: 'Vacuum leak detected: pressure rising', acknowledged: false, severity: 'critical' }, { id: 8, text: 'Unrelated thing', acknowledged: false }] });
  const pr = P.partsWithProblems(s); const ch = pr.filter(x => x.partId === 'chamber'); assert.ok(ch.some(x => x.kind === 'fault')); assert.ok(ch.some(x => x.kind === 'alarm' && x.alarmId === 7)); assert.ok(!pr.some(x => x.alarmId === 8));
  const acked = mk({ alarms: [{ id: 7, text: 'Vacuum leak', acknowledged: true }] }); assert.equal(P.partsWithProblems(acked).length, 0);
  console.log('PASS failed parts carry their alarm id; acknowledged alarms drop out'); }
// blind drill hides the culprit
{ const s = mk({ failures: { clockDrift: true }, faultDrill: { hiddenKey: 'clockDrift', revealed: false } }); assert.ok(!P.partsWithProblems(s).some(x => x.kind === 'fault')); assert.ok(P.partsWithProblems({ ...s, faultDrill: { hiddenKey: 'clockDrift', revealed: true } }).some(x => x.kind === 'fault')); console.log('PASS blind fault drill does not point at the failed part until revealed'); }
// turbo above 50 Torr is a failure
{ assert.equal(health(mk({ chamber: { pressure: 300, turbo: true } }), 'turbo').state, 'fail'); console.log('PASS turbo running above 50 Torr is flagged'); }
// every fault key maps to a part
{ for (const k of ['clockDrift', 'ldvMisalign', 'vacuumLeak', 'emiSpike', 'stageBacklash']) { assert.ok(P.PARTS.some(p => p.faults.includes(k)), k); const s = mk({ failures: { [k]: true } }); assert.ok(P.PARTS.some(p => p.faults.includes(k) && p.health(s).state === 'fail'), `${k} shows as fail on its part`); } console.log('PASS every injectable fault maps to a part that shows it as failed'); }
// lab picks
{ assert.equal(P.partForLabPick('stage'), 'stage'); assert.equal(P.partForLabPick('pumps'), 'roughing'); assert.equal(P.partForLabPick('rack'), 'clock'); assert.equal(P.partForLabPick('clock'), null, 'the wall clock is not the rubidium clock'); assert.equal(P.partForLabPick('nope'), null); console.log('PASS lab click names map to parts'); }
// sparkline history
{ let h = []; for (let t = 0; t < 200; t++) h = P.pushSample(h, mk(), t); assert.equal(h.length, 90); h = P.pushSample(h, mk(), 199.2); assert.equal(h.length, 90); console.log('PASS history keeps a rolling window and ignores sub-second repeats'); }
// pressure formatting
{ assert.equal(P.fmtP(760), '760 Torr'); assert.equal(P.fmtP(5), '5.0 Torr'); assert.match(P.fmtP(1e-5), /e-5/); console.log('PASS pressure formatting'); }

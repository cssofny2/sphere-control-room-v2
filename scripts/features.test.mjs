import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

const op = await loadTypeScript(new URL('../src/features/operator.ts', import.meta.url));
const alerts = await loadTypeScript(new URL('../src/features/alerts.ts', import.meta.url));
const scope = await loadTypeScript(new URL('../src/features/scopeModel.ts', import.meta.url));
const ldv = await loadTypeScript(new URL('../src/features/ldvModel.ts', import.meta.url));
const act = await loadTypeScript(new URL('../src/features/activity.ts', import.meta.url));

// ── operator profile
assert.equal(op.deriveInitials('Michael P Goodman'), 'MPG');
assert.equal(op.deriveInitials('', 'mike'), 'M');
const p = op.sanitizeProfile({ name: '  Ada <b>Lovelace</b> ', nickname: 'Ada', initials: '' });
assert.ok(!/[<>]/.test(p.name), 'markup is stripped');
assert.equal(op.operatorTag(p), p.initials);
assert.equal(op.operatorCallName({ name: 'Ada Lovelace', nickname: '', initials: 'AL' }), 'Ada');
assert.equal(op.operatorBriefing({ name: '', nickname: '', initials: '' }), '');
console.log('PASS operator profile: initials, sanitising, call name');

// ── state fixture
const base = () => ({
  facility: { power: true, simulationTime: 100, speed: 1 }, clock: { power: true, locked: true, warmup: 15 },
  chamber: { pressure: 1e-4, temperature: 20, targetTemp: 20, vent: false, doorOpen: false, faraday: true, isolation: true, roughing: false, turbo: false, roughingRpm: 0, turboRpm: 0, thermostat: true },
  stage: { x: 0, y: 0, z: 0, homed: true, moving: false, settling: false, motionId: 0 },
  vna: { power: true, rf: true, calibrated: true, calibrationAgeSeconds: 10, continuous: true, sweeping: false, center: 230500, sourcePowerDbm: -10, trace: [] },
  ldv: { power: true, shutter: true, opticalQuality: 95, alignmentX: 0, alignmentY: 0, focus: 0, grid: 64, mode: '2,0', range: '20 mm/s/V', filter: '10 MHz' },
  scope: { power: true, running: true, booting: false, timebase: 10, triggerSource: 'CH1', triggerLevel: 0, triggerSlope: 'rising', holdMode: 'auto', acqCount: 0,
    channels: { ch1: { enabled: true, scale: 0.2, offset: 0, coupling: 'AC', source: 'rf_monitor' }, ch2: { enabled: false, scale: 0.2, offset: 0, coupling: 'AC', source: 'ldv_output' }, ch3: { enabled: false, scale: 1, offset: 0, coupling: 'DC', source: 'clock_reference' }, ch4: { enabled: true, scale: 0.1, offset: 0, coupling: 'AC', source: 'environmental_probe' } } },
  experiment: { records: [], active: false, scanActive: false }, failures: {}, alarms: [], model: { rfNoise: true, vibration: true }, operator: { name: '', nickname: '', initials: '' },
});

// ── alerts: each of the four words fires for the right reason
{
  const s = base(); assert.equal(alerts.getAlert(s, 'vna').level, 'running');
  s.chamber.faraday = false; assert.equal(alerts.getAlert(s, 'chamber').level, 'attention');
  const e = base(); e.failures.vacuumLeak = true; e.chamber.roughing = true; assert.equal(alerts.getAlert(e, 'pumps').level, 'error');
  const k = base(); k.chamber.roughing = true; k.chamber.doorOpen = true; assert.equal(alerts.getAlert(k, 'pumps').level, 'stuck');
  const c = base(); c.clock.locked = false; c.clock.warmup = 3; assert.equal(alerts.getAlert(c, 'clock').level, 'running');
  const off = base(); off.facility.power = false; assert.equal(alerts.getAlert(off, 'vna').level, 'idle');
  console.log('PASS alerts: running, stuck, error and needs-attention are each derived from state');
}

// ── scope: it changes with the lab, triggers, measures
{
  const s = base(), f0 = 230500;
  const on = scope.acquireScope(s, 1, f0);
  assert.equal(on.triggerState, 'triggered');
  const m = on.measure.ch1; assert.ok(Math.abs(m.freq - 230500) / 230500 < 0.02, `RF monitor reads ~230.5 kHz (got ${m.freq})`);
  const vppOn = m.vpp; s.vna.rf = false;
  assert.ok(scope.acquireScope(s, 1, f0).measure.ch1.vpp < vppOn / 5, 'RF off removes the tone');
  s.vna.rf = true; s.scope.channels.ch1.source = 'environmental_probe'; s.scope.timebase = 5000;
  const quiet = scope.acquireScope(s, 1, f0).measure.ch1.vpp; s.chamber.faraday = false;
  const hum = scope.acquireScope(s, 1, f0).measure.ch1;
  assert.ok(hum.vpp > quiet * 3, 'Faraday off shows mains hum'); assert.ok(Math.abs(hum.freq - 60) < 6, `hum measures ~60 Hz (got ${hum.freq})`);
  s.scope.holdMode = 'normal'; s.scope.triggerLevel = 1.9; s.scope.channels.ch1.source = 'rf_monitor'; s.scope.timebase = 10;
  assert.equal(scope.acquireScope(s, 1, f0).triggerState, 'armed', 'a trigger level above the wave leaves the scope armed');
  const spec = scope.fft(Array.from({ length: 1000 }, (_, i) => Math.sin((2 * Math.PI * 100 * i) / 1000)), 1000);
  assert.ok(Math.abs(spec.peakF - 100) < 3, 'FFT finds the tone');
  assert.ok(scope.SCOPE_SCENARIOS.length >= 8 && scope.SCOPE_SCENARIOS.every(x => x.prereq.length && x.steps.length));
  console.log('PASS scope: waveforms follow the lab, trigger arms/locks, FFT and measurements work');
}

// ── LDV: scans depend on conditions, stall reasons are explained
{
  const s = base(); const o = { f0: 230500, grid: 64, id: 'scan-test', iso: '2026-11-04T12:00:00Z', clock: '12:00:00', operator: 'MG' };
  const good = ldv.generateScan(s, 'modemap', o);
  assert.equal(good.field.length, 64); assert.equal(good.verdict, 'good');
  s.ldv.opticalQuality = 15; s.chamber.isolation = false;
  const bad = ldv.generateScan(s, 'modemap', o); assert.notEqual(bad.verdict, 'good'); assert.ok(bad.summary.some(t => t.startsWith('Why:')));
  for (const id of ldv.LDV_SCENARIOS.map(x => x.id)) { const r = ldv.generateScan(base(), id, o); assert.ok(r.summary.length && r.verdictText, id); }
  const t = base(); t.ldv.shutter = false; assert.match(ldv.stallReason(t), /shutter/i);
  const u = base(); u.ldv.filter = '100 kHz'; assert.ok(ldv.generateScan(u, 'point', o).peakVel < good.peakVel / 3, '100 kHz filter cuts the resonance');
  assert.ok(ldv.scanSeconds('modemap', 900) > ldv.scanSeconds('modemap', 16));
  console.log('PASS LDV scans: six scenarios, conditions change the verdict, stalls are explained');
}

// ── live operation feed explains changes in plain English
{
  const p0 = base(), n0 = base(); n0.chamber = { ...n0.chamber, roughing: true };
  const a = act.deriveActivities(p0, n0); assert.equal(a.length, 1); assert.equal(a[0].anim, 'rough'); assert.ok(a[0].effects.length && a[0].what);
  const n1 = base(); n1.stage = { ...n1.stage, x: 10, motionId: 1 };
  assert.ok(act.deriveActivities(p0, n1).some(x => x.anim === 'stage' && /Hz/.test(x.effects.join(' '))));
  const off = base(); off.facility = { ...off.facility, power: false }; const down = act.deriveActivities(p0, off); assert.equal(down.length, 1, 'a breaker change is reported alone');
  assert.equal(act.deriveActivities(p0, base()).length, 0, 'no change, no entry');
  act.pushActivities(a, 'MG', 1000); act.pushActivities(a, 'MG', 1500);
  assert.equal(act.getActivities().length, 1, 'repeated identical actions are merged'); assert.equal(act.getActivities()[0].count, 2);
  console.log('PASS live operation feed: explanations, breaker handling, merging');
}

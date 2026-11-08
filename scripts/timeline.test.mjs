import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadTypeScript } from './load-typescript.mjs';

const T = await loadTypeScript(new URL('../src/features/telemetry.ts', import.meta.url));
const route = await loadTypeScript(new URL('../src/features/route.ts', import.meta.url));

const S = (t, o = {}) => ({ t, pressureTorr: 1, temperatureC: 22, f0Hz: 230500, x: 0, y: 0, z: 0, turboPct: 0, ...o });

{
  const r = new T.Ring(5);
  assert.equal(r.due(0), true);
  assert.equal(r.push(S(0)), true);
  assert.equal(r.push(S(0.4)), false, 'samples closer than one second are skipped');
  assert.equal(r.due(0.4), false); assert.equal(r.due(1), true);
  for (let t = 1; t <= 9; t++) r.push(S(t));
  assert.equal(r.length, 5, 'the ring is bounded');
  assert.deepEqual(r.toArray().map(s => s.t), [5, 6, 7, 8, 9], 'the oldest samples drop first');
  r.push(S(2));
  assert.deepEqual(r.toArray().map(s => s.t), [2], 'time going backwards (breaker reset) starts a fresh history');
  assert.ok(new T.Ring().capacity === 3600);
  console.log('PASS ring is bounded, skips too-close samples and restarts when time goes backwards');
}
{
  const s = T.sampleOf({ facility: { simulationTime: 12 }, chamber: { pressure: 0.5, temperature: 21.5, turboRpm: 80 }, stage: { x: 1, y: 2, z: 3, actualX: 1.5, actualY: 2, actualZ: 3 } }, 230501.25);
  assert.deepEqual(s, { t: 12, pressureTorr: 0.5, temperatureC: 21.5, f0Hz: 230501.25, x: 1.5, y: 2, z: 3, turboPct: 80 });
  assert.equal(T.sampleOf({ facility: { simulationTime: 1 }, chamber: { pressure: 1, temperature: 1 }, stage: { x: 4, y: 5, z: 6 } }, null).x, 4, 'commanded position is used when no actual position exists');
  console.log('PASS samples read actual positions and carry a null resonance when the VNA is off');
}
{
  const pts = Array.from({ length: 3600 }, (_, i) => S(i, { pressureTorr: i === 1800 ? 500 : 1e-4 }));
  const d = T.downsample(pts, 300, s => s.pressureTorr);
  assert.ok(d.length <= 300 && d.length > 50, `got ${d.length}`);
  assert.equal(d[0].t, 0); assert.equal(d[d.length - 1].t, 3599, 'first and last points are kept');
  assert.ok(d.some(p => p.pressureTorr === 500), 'a one-second spike survives downsampling');
  assert.ok(d.every((p, i) => i === 0 || p.t >= d[i - 1].t), 'time order is kept');
  const small = pts.slice(0, 10); assert.equal(T.downsample(small, 300, s => s.pressureTorr).length, 10);
  const nulls = pts.slice(0, 1000).map((p, i) => ({ ...p, f0Hz: i % 2 ? null : 230500 })); assert.ok(T.downsample(nulls, 100, s => s.f0Hz).length <= 100, 'null values are handled');
  console.log('PASS downsampling keeps the endpoints, the extremes and the order');
}
{
  const ev = [
    { simulationTime: 10, level: 'info', subsystem: 'STAGE', text: 'Stage command accepted' },
    { simulationTime: 20, level: 'warning', subsystem: 'CHAMBER', text: 'Pressure rising' },
    { simulationTime: 21, level: 'info', subsystem: 'VNA', text: 'Sweep complete: 1 Hz' },
    { simulationTime: 25, level: 'critical', subsystem: 'CLOCK', text: 'Lock lost' },
    { level: 'info', subsystem: 'X', text: 'no time' }, { simulationTime: NaN, text: 'bad' },
  ];
  const rec = [{ id: 'a', resonance: 230500.5, contract: { simulationTime: 22 } }, { id: 'b', resonance: 1, contract: null }];
  const m = T.markersFrom(ev, rec);
  assert.deepEqual(m.map(x => [x.t, x.kind]), [[10, 'action'], [20, 'alarm'], [22, 'measurement'], [25, 'alarm']], 'sweep chatter and untimed items are dropped; order is by time');
  assert.match(m[2].label, /230500\.50 Hz/);
  assert.deepEqual(T.markersFrom(ev, rec, 20, 22).map(x => x.t), [20, 22], 'the window clips markers');
  console.log('PASS markers line up with the simulation clock and clip to the window');
}
{
  const pts = [S(0), S(1), S(2), S(10)];
  assert.equal(T.sampleAt(pts, -1), null); assert.equal(T.sampleAt(pts, 0).t, 0);
  assert.equal(T.sampleAt(pts, 1.9).t, 1, 'the reading at or before the cursor'); assert.equal(T.sampleAt(pts, 99).t, 10);
  assert.equal(T.sampleAt([], 5), null);
  console.log('PASS scrubbing returns the reading at or before the cursor');
}
{
  const csv = T.telemetryCsv([S(0), S(1, { f0Hz: null }), S(2)], [{ t: 1, kind: 'alarm', label: 'CLOCK: lock, lost' }]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 4);
  assert.equal(lines[0], 'sim_time_s,pressure_torr,temperature_c,f0_hz,x_mm,y_mm,z_mm,turbo_pct,marker');
  assert.equal(lines[1].endsWith(','), true, 'rows with no marker end empty');
  assert.ok(lines[2].includes('"alarm: CLOCK: lock, lost"') && lines[2].includes(',,'), 'markers are quoted and a missing resonance is empty');
  console.log('PASS CSV export has one row per sample with escaped markers');
}
{
  const app = fs.readFileSync(new URL('../src/MetrologyLabV3.tsx', import.meta.url), 'utf8');
  assert.ok(/installTelemetry\(\)/.test(app) && /<Timeline \/>/.test(app) && /"timeline", "Live Timeline"/.test(app));
  assert.equal(route.pageFromHash('#/timeline'), 'timeline');
  console.log('PASS the timeline page is in the navigation, sampling from start-up, and linkable');
}

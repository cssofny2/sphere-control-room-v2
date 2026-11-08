import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadTypeScript } from './load-typescript.mjs';

const S = await loadTypeScript(new URL('../src/spatial/field.ts', import.meta.url));
const M = await loadTypeScript(new URL('../src/simulation/model.ts', import.meta.url));
const F = await loadTypeScript(new URL('../src/simulation/measurement.ts', import.meta.url));

const base = (x, y, z, t) => ({
  stage: { x, y, z, actualX: x, actualY: y, actualZ: z }, chamber: { temperature: 20, pressure: 1e-4, faraday: true },
  model: { location: true, temperature: false, pressure: false, clockDrift: false, fixtureDrift: false, rfNoise: true },
  clock: { locked: true }, failures: {},
  vna: { center: 230500, span: 8000, startFrequency: 0, stopFrequency: 0, points: 801, ifbw: 100, averagingEnabled: false, averagingCount: 1, traceMath: 'none', reference: [] },
  facility: { seed: 3, simulationTime: t },
});
/** Measures the real model through the real fit, like a scan would. */
const measure = (x, y, z, t = x * 7 + y * 13 + z * 3) => { const m = F.measureTrace(M.buildSweep(base(x, y, z, t)), M.BASE_FREQUENCY); return { x, y, z, resonance: m.resonance, uncertaintyHz: m.uncertaintyHz, fit: m.fit }; };

{
  const pts = []; let t = 0;
  for (const v of [-20, 0, 20]) { pts.push(measure(v, 0, 0, ++t), measure(0, v, 0, ++t), measure(0, 0, v, ++t)); }
  pts.push(measure(10, 10, 10, ++t), measure(-10, 15, -5, ++t));
  const f = S.fitField(pts);
  assert.equal(f.ok, true, f.reason);
  const truth = M.LOCATION_HZ_PER_MM;
  for (const c of f.coefficients) assert.ok(Math.abs(c.hzPerMm - truth[c.axis]) < Math.max(0.05, 4 * c.sigma), `${c.axis}: ${c.hzPerMm} vs ${truth[c.axis]} (sigma ${c.sigma})`);
  assert.ok(f.r2 > 0.9999 && f.rmsResidualHz < 0.5);
  assert.deepEqual(f.unconstrained, []);
  assert.ok(Math.abs(f.interceptHz - 230500) < 0.5, `intercept ${f.interceptHz}`);
  console.log('PASS the field fit recovers the model sensitivity (45.2, -12.5, 80.1 Hz/mm) from measured data');
}
{
  const line = [-20, -10, 0, 10, 20].map((x, i) => measure(x, 0, 0, i + 1));
  const f = S.fitField(line);
  assert.equal(f.ok, true); assert.deepEqual(f.unconstrained, ['y', 'z']); assert.deepEqual(f.coefficients.map(c => c.axis), ['x']);
  assert.ok(Math.abs(f.coefficients[0].hzPerMm - 45.2) < 0.1);
  assert.equal(S.fitField(line.slice(0, 2)).ok, false);
  assert.equal(S.fitField([measure(0, 0, 0, 1), measure(0, 0, 0, 2), measure(0, 0, 0, 3), measure(0, 0, 0, 4)]).ok, false, 'no spread means no slope');
  assert.equal(S.fitField([]).ok, false);
  const withBad = [...line, { ...measure(30, 0, 0, 9), resonance: 1e6, fit: { ok: false } }, { ...measure(-30, 0, 0, 8), resonance: 1e6, excluded: true }];
  assert.ok(Math.abs(S.fitField(withBad).coefficients[0].hzPerMm - 45.2) < 0.1, 'failed fits and excluded records are ignored');
  console.log('PASS unconstrained axes are reported, degenerate and bad data are refused or ignored');
}
{
  assert.equal(S.coverage([]), 0);
  const one = S.coverage([{ x: 0, y: 0, z: 0, resonance: 1 }]);
  const two = S.coverage([{ x: 0, y: 0, z: 0, resonance: 1 }, { x: 25, y: 25, z: 25, resonance: 1 }]);
  assert.ok(one > 0 && one < 0.1 && two > one, `coverage grows with points (${one}, ${two})`);
  const dense = []; for (const x of [-30, -15, 0, 15, 30]) for (const y of [-30, -15, 0, 15, 30]) for (const z of [-30, -15, 0, 15, 30]) dense.push({ x, y, z, resonance: 1 });
  assert.ok(S.coverage(dense) > 0.95);
  console.log('PASS coverage is a real volume fraction, not records divided by 25');
}
{
  const s0 = S.suggestPoints([], 3);
  assert.deepEqual([s0[0].x, s0[0].y, s0[0].z], [0, 0, 0]); assert.equal(s0.length, 3);
  const dense = []; for (const x of [-30, -10, 10, 30]) for (const y of [-30, -10, 10, 30]) for (const z of [-30, -10, 10]) dense.push({ x, y, z, resonance: 1 });
  const gap = S.suggestPoints(dense, 1)[0];
  assert.equal(gap.z, 35, 'the unmeasured z layer is suggested first');
  const a = S.suggestPoints(dense, 4), b = S.suggestPoints(dense, 4);
  assert.deepEqual(a, b, 'suggestions are deterministic');
  assert.ok(a.every(p => Math.abs(p.x) <= 35 && Math.abs(p.y) <= 35 && Math.abs(p.z) <= 35));
  const spread = S.suggestPoints([{ x: 0, y: 0, z: 0, resonance: 1 }], 4);
  for (let i = 0; i < spread.length; i++) for (let j = i + 1; j < spread.length; j++) assert.ok(Math.hypot(spread[i].x - spread[j].x, spread[i].y - spread[j].y, spread[i].z - spread[j].z) >= 10, 'suggestions spread out');
  console.log('PASS the planner starts at the centre, fills gaps, is deterministic and spreads suggestions');
}
{
  const app = fs.readFileSync(new URL('../src/MetrologyLabV3.tsx', import.meta.url), 'utf8');
  assert.ok(/<FieldAnalysis/.test(app));
  assert.ok(!/records\.length \/ 25/.test(app), 'the records/25 coverage placeholder is gone');
  console.log('PASS the Spatial Field page uses the field analysis and real coverage');
}

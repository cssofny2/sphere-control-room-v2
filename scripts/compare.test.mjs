import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadTypeScript } from './load-typescript.mjs';

const C = await loadTypeScript(new URL('../src/analysis/compare.ts', import.meta.url));

let id = 0;
const rec = (x, f, o = {}) => ({ id: `r${++id}`, runId: 'r', x, y: 0, z: 0, resonance: f, uncertaintyHz: 0.05, fit: { ok: true }, timestamp: `2026-11-08T00:00:${String(id % 60).padStart(2, '0')}Z`, temp: 22, pressure: 1e-4, clockLocked: true, faradayEnabled: true, isolationEnabled: true, vnaCalibrated: true, modelVersion: 'm2', ...o });
const A = { label: 'A', records: [rec(-10, 100), rec(0, 200), rec(10, 300)] };
const B = { label: 'B', records: [rec(-10, 100.05), rec(0, 205), rec(10, 300.02)] };

{
  const c = C.compareRuns([A, B]);
  assert.equal(c.rows.length, 3); assert.equal(c.matched, 3); assert.equal(c.axis, 'x');
  assert.deepEqual(c.rows.map(r => r.x), [-10, 0, 10], 'rows sorted by position');
  const mid = c.rows[1].deltas[1];
  assert.equal(mid.deltaHz, 5); assert.ok(Math.abs(mid.uHz - Math.hypot(0.05, 0.05)) < 1e-12);
  assert.equal(mid.significant, true);
  assert.equal(c.rows[0].deltas[1].significant, false, 'a difference inside the combined uncertainty is not flagged');
  assert.equal(c.rows[0].deltas[0], null, 'the baseline has no delta');
  assert.ok(Math.abs(c.meanDeltaHz[1] - (0.05 + 5 + 0.02) / 3) < 1e-9);
  assert.equal(c.conditions.length, 0);
  assert.ok(c.notes.some(n => /1 of 3 shared positions/.test(n)));
  console.log('PASS positions match, deltas carry combined uncertainty, significance is flagged');
}
{
  const hot = { label: 'Hot', records: A.records.map(r => ({ ...r, id: r.id + 'h', temp: 25, clockLocked: false, modelVersion: 'm1' })) };
  const c = C.compareRuns([A, hot]);
  const names = c.conditions.map(d => d.name);
  assert.ok(names.includes('Temperature (median)') && names.includes('Reference clock locked') && names.includes('Model version'));
  assert.deepEqual(c.conditions.find(d => d.name === 'Reference clock locked').values, ['always', 'never']);
  assert.ok(!names.includes('Faraday cage on'));
  const p = C.compareRuns([A, { label: 'Air', records: A.records.map(r => ({ ...r, id: r.id + 'p', pressure: 100 })) }]);
  assert.ok(p.conditions.some(d => d.name === 'Pressure (median)'));
  console.log('PASS differing conditions are listed, equal ones are not');
}
{
  const partial = { label: 'P', records: [rec(0, 201), rec(20, 400)] };
  const c = C.compareRuns([A, partial]);
  assert.equal(c.rows.length, 4); assert.equal(c.matched, 1);
  assert.equal(c.rows.find(r => r.x === 20).deltas[1], null, 'a position only one run measured has no delta');
  const none = C.compareRuns([A, { label: 'Z', records: [rec(30, 1)] }]);
  assert.equal(none.matched, 0); assert.ok(none.notes.some(n => /share no measured position/.test(n)));
  assert.ok(C.compareRuns([A]).notes[0].includes('at least two'));
  assert.equal(C.compareRuns([]).rows.length, 0);
  const failed = C.compareRuns([A, { label: 'F', records: [rec(0, 999, { fit: { ok: false } })] }]);
  assert.equal(failed.rows.find(r => r.x === 0).cells[1], null, 'failed fits are not compared');
  const yaxis = C.compareRuns([{ label: 'Y', records: [{ ...rec(0, 1), y: -30 }, { ...rec(0, 2), y: 30 }] }, A]);
  assert.equal(yaxis.axis, 'y');
  console.log('PASS partial overlap, no overlap, too few runs, failed fits and axis choice');
}
{
  const app = fs.readFileSync(new URL('../src/MetrologyLabV3.tsx', import.meta.url), 'utf8');
  assert.ok(/<RunCompare/.test(app));
  console.log('PASS comparison is wired into Experiment Runs');
}

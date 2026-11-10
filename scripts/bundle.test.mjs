import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadTypeScript } from './load-typescript.mjs';

const B = await loadTypeScript(new URL('../src/domain/bundle.ts', import.meta.url));
const R = await loadTypeScript(new URL('../src/simulation/replay.ts', import.meta.url));
const M = await loadTypeScript(new URL('../src/simulation/model.ts', import.meta.url));
const F = await loadTypeScript(new URL('../src/simulation/measurement.ts', import.meta.url));
const L = await loadTypeScript(new URL('../src/protocol/loc1.ts', import.meta.url));
const I = await loadTypeScript(new URL('../src/features/exportImage.ts', import.meta.url));

/** Builds a record the way performSweep does: capture settings plus a fitted trace. */
function makeRecord(i) {
  const s = {
    stage: { x: i, y: 0, z: 0, actualX: i, actualY: 0, actualZ: 0 }, chamber: { temperature: 22, pressure: 1e-4, faraday: true },
    model: { location: true, temperature: true, pressure: true, clockDrift: true, fixtureDrift: true, rfNoise: true },
    clock: { locked: true }, failures: {},
    vna: { center: 230500, span: 5000, startFrequency: 228000, stopFrequency: 233000, points: 401, ifbw: 100, averagingEnabled: false, averagingCount: 1, traceMath: 'none', reference: [] },
    facility: { seed: 7, simulationTime: 3.7 * i },
  };
  const m = F.measureTrace(M.buildSweep(s), M.BASE_FREQUENCY);
  return {
    id: `acq-${i}`, runId: 'run-1', timestamp: `2026-11-08T00:00:${String(i).padStart(2, '0')}.000Z`, x: i, y: 0, z: 0,
    resonance: m.resonance, q: m.q, uncertaintyHz: m.uncertaintyHz, fit: m.fit, clockLocked: true,
    contract: { simulationTime: s.facility.simulationTime, position: { x: i, y: 0, z: 0 }, settings: {
      seed: 7, modelEffects: s.model,
      vna: { centerHz: 230500, spanHz: 5000, points: 401, ifBandwidthHz: 100, averagingEnabled: false, averagingCount: 1 },
      environment: { temperatureC: 22, pressureTorr: 1e-4, faradayEnabled: true, isolationEnabled: true } } },
  };
}
const records = [1, 2, 3, 4, 5].map(makeRecord);
const input = { records, notebook: [{ id: 'n1', text: 'hello' }], appVersion: '2.0.0', commit: 'abc1234', now: new Date('2026-11-08T00:00:00Z') };
const clone = o => JSON.parse(JSON.stringify(o));

const bundle = await B.buildBundle(input);
assert.equal(bundle.format, 'sphere-repro-bundle');
assert.match(bundle.checksum.value, /^[0-9a-f]{64}$/);
assert.deepEqual(bundle.runs, [{ runId: 'run-1', records: 5 }]);
assert.equal(bundle.loc1Schema.fields.length, 25);
assert.deepEqual(Object.keys(bundle.loc1Records[0]), [...L.LOC1_FIELDS]);
assert.equal(bundle.loc1Records[0].monotonic_time_s, 3.7);
assert.equal(bundle.loc1Records[0].baseline_ratio, null, 'unavailable physical quantities are not fabricated');
const ok = await B.validateBundle(clone(bundle), 1000);
assert.equal(ok.ok, true, JSON.stringify(ok.issues));
assert.equal(ok.bundle.records.length, 5);
assert.equal(ok.warnings.length, 0);
assert.equal((await B.buildBundle(input)).checksum.value, bundle.checksum.value, 'same data gives the same checksum');
console.log('PASS bundle round-trips with a stable SHA-256');

{
  const row = L.toLoc1Record({ id: 'import-1', resonance: 230501, resonanceShift: 1, dataOrigin: 'imported' }, 0, 'abc');
  const csvRows = B.parseCsv(L.toLoc1Csv([row]));
  assert.deepEqual(csvRows[0], [...L.LOC1_FIELDS]);
  assert.equal(csvRows[1].length, 25);
  assert.equal(row.data_origin, 'IMPORTED');
  assert.equal(row.configuration_hash, 'abc');
  const image = I.svgDocument([], '#000', 12, 'Test');
  assert.match(image.svg, /Not a photograph of existing equipment/);
  assert.match(image.svg, /Copper artifact not to scale\./);
  console.log('PASS LOC-1 exports contain exactly 25 fields and chart renders carry the evidentiary caption');
}

{
  const t = clone(bundle); t.records[0].resonance += 0.001;
  const r = await B.validateBundle(t); assert.equal(r.ok, false); assert.match(r.issues[0].message, /Checksum mismatch/);
  const keys = clone(bundle); keys.notebook[0] = JSON.parse('{"__proto__":{"x":1}}');
  assert.equal((await B.validateBundle(keys)).ok, false, 'prototype-pollution keys are refused');
  const nan = clone(bundle); nan.records[1].x = 'a';
  assert.equal((await B.validateBundle(nan)).ok, false);
  const far = clone(bundle); far.records[1].x = 99;
  assert.ok((await B.validateBundle(far)).issues.some(i => /35 mm/.test(i.message)));
  const dup = clone(bundle); dup.records[1].id = dup.records[0].id;
  assert.ok((await B.validateBundle(dup)).issues.some(i => /Duplicate/.test(i.message)));
  const ver = clone(bundle); ver.schemaVersion = 9;
  assert.equal((await B.validateBundle(ver)).ok, false);
  assert.equal((await B.validateBundle(null)).ok, false);
  assert.equal((await B.validateBundle([])).ok, false);
  assert.equal((await B.validateBundle({ format: 'other' })).ok, false);
  assert.equal((await B.validateBundle(clone(bundle), B.MAX_BUNDLE_BYTES + 1)).ok, false, 'oversize files are refused');
  const big = { ...clone(bundle), records: new Array(B.MAX_BUNDLE_RECORDS + 1).fill({}) };
  assert.equal((await B.validateBundle(big)).ok, false);
  let deep = {}; const root = deep; for (let i = 0; i < 20; i++) { deep.a = {}; deep = deep.a; }
  const dd = clone(bundle); dd.notebook[0] = root;
  assert.equal((await B.validateBundle(dd)).ok, false, 'deep nesting is refused');
  console.log('PASS tampering, hostile keys, bad values, duplicates, versions and size limits are refused');
}
{
  const old = clone(bundle); old.modelVersion = 'sphere-teaching-model-v1';
  const { checksum, ...p } = old; old.checksum.value = await B.sha256Hex(B.canonicalJson(p));
  const r = await B.validateBundle(old); assert.equal(r.ok, true); assert.ok(r.warnings[0].includes('model-v1'));
  console.log('PASS a different model version imports with a warning');
}
{
  const sum = R.replayAll(records);
  assert.equal(sum.match, 5, `all freshly made records must reproduce (max delta ${sum.maxDeltaHz})`);
  assert.ok(sum.maxDeltaHz < 1e-6);
  const edited = records.map((r, i) => (i === 2 ? { ...r, resonance: r.resonance + 0.5 } : r));
  const e = R.replayAll(edited); assert.equal(e.differs, 1); assert.equal(e.rows[2].verdict, 'differs');
  const noCtx = R.replayAll([{ ...records[0], contract: null }, { ...records[1], fit: { ok: false } }]);
  assert.equal(noCtx.skipped, 2);
  console.log('PASS replay reproduces recorded resonances and flags edited or unverifiable ones');
}
{
  const text = 'run_id,timestamp,x_mm,y_mm,z_mm,resonance_hz,q,note\r\nA,2026-11-08T00:00:00Z,1,2,3,230501.5,4500,"hello, ""world"""\nA,,4,5,6,230502,,"multi\nline"\nA,,99,0,0,230500,,out of range\nA,,x,0,0,1,,bad\n';
  const rows = B.parseCsv(text);
  assert.equal(rows.length, 5); assert.equal(rows[1][7], 'hello, "world"'); assert.equal(rows[2][7], 'multi\nline');
  const map = B.autoMap(rows[0]);
  assert.deepEqual(map, { x: 2, y: 3, z: 4, resonance: 5, timestamp: 1, q: 6, runId: 0 });
  const r = B.csvToRecords(rows, map, 'IMPORT');
  assert.equal(r.records.length, 2); assert.equal(r.issues.length, 2);
  assert.equal(r.records[0].runId, 'A'); assert.equal(r.records[0].resonance, 230501.5); assert.equal(r.records[0].q, 4500);
  assert.equal(B.csvToRecords([['a', 'b']], B.autoMap(['a', 'b']), 'I').missing.length, 4);
  const exported = 'run_id,timestamp,x_mm,y_mm,z_mm,resonance_hz,s11_db,q,valid,temperature_c,pressure_torr,uncertainty_hz,fit_ok\nr,t,1,2,3,230500,-30,4500,true,22,0.0001,0.04,true';
  const m2 = B.autoMap(B.parseCsv(exported)[0]);
  assert.ok(m2.x === 2 && m2.resonance === 5 && m2.uncertaintyHz === 11, 'our own CSV export maps automatically');
  console.log('PASS CSV parsing, auto-mapping, validation and own-export round trip');
}
{
  const app = fs.readFileSync(new URL('../src/MetrologyLabV3.tsx', import.meta.url), 'utf8');
  assert.ok(/buildBundle\(/.test(app) && /BundleImport/.test(app));
  assert.ok(!/JSON\.stringify\(state, null, 2\)/.test(app), 'export no longer dumps the whole app state');
  assert.ok(/toLoc1Csv/.test(app.slice(app.indexOf('const exportCsv'), app.indexOf('const exportJson'))), 'CSV export uses the standardized LOC-1 schema');
  console.log('PASS exports use bundles and escaped CSV');
}

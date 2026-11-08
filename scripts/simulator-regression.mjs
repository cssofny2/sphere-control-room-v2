import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseSync, transformSync } from 'rolldown/utils';
import { loadTypeScript } from './load-typescript.mjs';
const planModule = await loadTypeScript(new URL('../src/simulation/plan.ts', import.meta.url));
const runModule = await loadTypeScript(new URL('../src/domain/run.ts', import.meta.url));
const operatorModule = await loadTypeScript(new URL('../src/features/operator.ts', import.meta.url));
const scopeModule = await loadTypeScript(new URL('../src/features/scopeModel.ts', import.meta.url));
const ldvModule = await loadTypeScript(new URL('../src/features/ldvModel.ts', import.meta.url));
const modelModule = await loadTypeScript(new URL('../src/simulation/model.ts', import.meta.url));
const sessionsModule = await loadTypeScript(new URL('../src/persistence/sessions.ts', import.meta.url));
const measurementModule = await loadTypeScript(new URL('../src/simulation/measurement.ts', import.meta.url));

// Exercise the actual simulator helpers, not a duplicated physics model.
const source = fs.readFileSync(new URL('../src/MetrologyLabV3.tsx', import.meta.url), 'utf8');
const ast = parseSync('simulator.tsx', source).program;
const names = new Set([
  'AMBIENT_C', 'LIMIT_MM', 'WARMUP_SECONDS', 'TUTORIAL_VIDEOS',
  'initialState', 'clamp', 'uid', 'now', 'fmtPressure', 'FAULT_CATALOG',
  'addEvent', 'addAlarm', 'getMeasurementValidation', 'evaluateScanRecord',
  'createSerpentineScanPlan', 'reducer',
  'buildScope', 'getPumpLifecycle', 'tick', 'buildQualitySummary',
  'getAxisPlanInput',
]);
const selected = ast.body.filter(node => {
  if (node.type === 'FunctionDeclaration') return names.has(node.id?.name);
  if (node.type === 'VariableDeclaration') return node.declarations.some(d => names.has(d.id.name));
  return false;
}).map(node => source.slice(node.start, node.end)).join('\n');
const js = transformSync('simulator.ts', selected).code;
const sandbox = { ...planModule, ...runModule, ...operatorModule, ...scopeModule, ...ldvModule, ...modelModule, ...measurementModule, ...sessionsModule };
vm.runInNewContext(`${js}\nglobalThis.logic={initialState,reducer,tick,getMeasurementValidation,evaluateScanRecord,buildSweep,trueFrequency,buildQualitySummary};`, sandbox);
const L = sandbox.logic;
const fresh = () => JSON.parse(JSON.stringify(L.initialState));
const step = (s, count = 200) => {
  for (let i = 0; i < count; i++) s = L.tick(s, 0.05);
  return s;
};

let s = fresh();
s.facility.power = true;
s.facility.speed = 60;
s.chamber.vent = false;
s.chamber.roughing = true;
s = step(s, 200);
assert.ok(s.chamber.pressure < 50, 'roughing must reach turbo crossover');
s.chamber.turbo = true;
s = step(s, 400);
assert.ok(s.chamber.pressure < 1e-3, 'roughing must not floor pressure above high vacuum');
assert.ok(Number.isFinite(s.chamber.pressure), 'pressure must remain finite');
assert.ok(s.chamber.turboRpm > 90, 'turbo should spin up');
console.log('PASS pump lifecycle reaches high vacuum');

s = fresh();
s.facility.power = true;
s.facility.speed = 10;
s.chamber.vent = false;
s = L.reducer(s, { type: 'MOVE_STAGE', position: { x: 10, y: -10, z: 5 } });
assert.equal(s.stage.actualX, 0, 'commanded position must not teleport actual position');
assert.equal(s.stage.moving, true);
s = step(s, 500);
assert.ok(Math.abs(s.stage.actualX - 10) < 0.025);
assert.equal(s.stage.settling, false);
assert.equal(s.stage.moving, false);
console.log('PASS stage servo moves and settles');

s = fresh();
s.facility.power = true;
s.ldv.power = true;
s.ldv.shutter = true;
s.failures.ldvMisalign = true;
s = step(s, 2);
assert.ok(s.ldv.opticalQuality < 60, 'LDV fault must degrade optical return');
console.log('PASS fault affects optical telemetry');

s = fresh();
s.facility.power = true;
s.vna.power = true;
s.vna.rf = true;
s.chamber.vent = false;
s = L.reducer(s, { type: 'START_SCAN' });
assert.equal(s.experiment.scanPath.length, 25);
const bad = L.evaluateScanRecord({ valid: false, clockLocked: false, ldvSignal: 0 }, s);
s = L.reducer(s, { type: 'QUALITY_DECISION', quality: bad });
assert.equal(s.experiment.scanStep, 'rescan_prepare');
assert.equal(s.experiment.rescanCounts['0'], 1);
assert.equal(s.vna.averagingEnabled, true);
assert.equal(s.vna.ifbw, 50);
s = L.reducer(s, { type: 'QUALITY_DECISION', quality: bad });
s = L.reducer(s, { type: 'QUALITY_DECISION', quality: bad });
assert.equal(s.experiment.rescanCounts['0'], 2);
assert.equal(s.experiment.failedPoints, 1);
assert.equal(s.experiment.scanStep, 'quality_complete');
console.log('PASS adaptive retries use real VNA settings and stop at limit');

{
  const good = { valid: true, clockLocked: true, vnaCalibrated: true, faradayEnabled: true, isolationEnabled: true, ldvSignal: 90, uncertaintyHz: 0.05, fit: { ok: true } };
  assert.equal(L.evaluateScanRecord(good, s).status, 'accepted', 'a clean fitted record is accepted');
  const noFit = L.evaluateScanRecord({ ...good, fit: { ok: false, reason: 'no_dip' }, uncertaintyHz: 12.5 }, s);
  assert.equal(noFit.status, 'failed', 'a failed resonance fit is a critical quality failure');
  assert.ok(noFit.failed.includes('fit') && noFit.failed.includes('uncertainty'));
  const noisy = L.evaluateScanRecord({ ...good, uncertaintyHz: 1.4 }, s);
  assert.equal(noisy.status, 'suspect', 'uncertainty above 1 Hz is suspect, not failed');
  console.log('PASS quality gate uses fit convergence and computed uncertainty');
}

s.experiment.scanPaused = true;
s.experiment.scanStep = 'fault';
s = L.reducer(s, { type: 'RESUME_SCAN' });
assert.equal(s.experiment.scanStep, 'command');
assert.equal(s.experiment.scanPaused, false);
s = L.reducer(s, { type: 'ABORT_SCAN' });
assert.equal(s.experiment.active, false);
assert.equal(s.experiment.scanActive, false);
console.log('PASS interlock resume and abort');

s = fresh();
s.notebook = [{ id: 'test', text: 'Retain this observation.' }];
s = L.reducer(s, { type: 'POWER', value: false });
assert.equal(s.notebook.length, 1);
assert.equal(s.facility.power, false);
console.log('PASS notebook survives breaker reset');

s = fresh();
s.clock.locked = true;
s.failures.clockDrift = true;
assert.equal(L.getMeasurementValidation(s).rules[0].status, 'Fail');
s.stage.x = 20;
s.stage.actualX = 0;
const center = L.trueFrequency(s);
s.stage.actualX = 20;
assert.ok(L.trueFrequency(s) > center, 'resonance must follow actual stage coordinates');
console.log('PASS validation and resonance use instrument state');

s = fresh();
s.facility.power = true;
s.vna.power = true;
s.vna.rf = true;
s.chamber.vent = false;
const before = JSON.parse(JSON.stringify(s));
s.experiment.step = 0;
const denied = L.reducer(s, { type: 'START_SCAN', kind: 'axis' });
assert.equal(denied.experiment.id, null);
assert.equal(denied.experiment.active, false);
assert.equal(denied.experiment.contract, null);
assert.deepEqual(denied.stage, before.stage);
assert.ok(denied.experiment.planErrors.some(issue => issue.field === 'step'));
s.experiment.step = 5;
s.experiment.randomized = false;
s = L.reducer(s, { type: 'START_SCAN', kind: 'axis' });
assert.equal(s.experiment.scanPath.length, 27);
assert.equal(s.experiment.contract.plan.orderedPoints.length, 9);
assert.equal(s.experiment.contract.initialSettings.seed, s.facility.seed);
assert.deepEqual(Array.from(s.experiment.scanPath.slice(0, 3), p => p.repeatIndex), [1, 2, 3]);
const owned = s.experiment;
const duplicate = L.reducer(s, { type: 'START_SCAN', kind: 'axis' });
assert.equal(duplicate.experiment, owned, 'duplicate start must not replace owner/plan/records');
const duplicateManual = L.reducer(s, { type: 'START_RUN' });
assert.equal(duplicateManual.experiment, owned);
console.log('PASS reducer rejection and accepted typed custom plan ownership');

const record = { id: 'acquisition-test', runId: s.experiment.id, contract: { id: 'acquisition-test', runId: s.experiment.id }, x: 0, y: 0, z: 0 };
assert.equal(L.reducer(s, { type: 'RECORD' }), s);
assert.equal(L.reducer(s, { type: 'RECORD', record: { ...record, id: '' } }), s);
const wrong = L.reducer(s, { type: 'RECORD', record: { ...record, runId: 'wrong-run' } });
assert.equal(wrong, s);
s = L.reducer(s, { type: 'RECORD', record });
assert.equal(s.experiment.captureCount, 1);
assert.equal(L.reducer(s, { type: 'RECORD', record }), s);
s = L.reducer(s, { type: 'STOP_RUN' });
assert.equal(s.experiment.contract.status, 'cancelled');
assert.equal(L.reducer(s, { type: 'RECORD', record: { ...record, id: 'late-acquisition', contract: { id: 'late-acquisition', runId: s.experiment.id } } }), s);
assert.equal(s.experiment.records.length, 1);
console.log('PASS run-bound identity/deduplication guard without claiming full runner cancellation');

{
  // Changing the VNA span invalidates calibration and must keep the operator-visible alarm.
  const base = fresh();
  base.vna.calibrated = true;
  const changed = L.reducer(base, { type: 'PATCH', domain: 'vna', patch: { span: 1234 } });
  assert.equal(changed.vna.calibrated, false);
  assert.equal(changed.alarms.filter(a => /calibration invalidated/i.test(a.text)).length, 1);
  assert.equal(base.vna.calibrated, true, 'input state must not be mutated');
  const quiet = L.reducer(fresh(), { type: 'PATCH', domain: 'vna', patch: { span: 1234 } });
  assert.equal(quiet.alarms.length, 0, 'no alarm when the VNA was not calibrated');
  const unrelated = L.reducer(base, { type: 'PATCH', domain: 'vna', patch: { rf: true } });
  assert.equal(unrelated.vna.calibrated, true);
  assert.equal(unrelated.alarms.length, 0);
  console.log('PASS VNA span change keeps the calibration-invalidated alarm');
}

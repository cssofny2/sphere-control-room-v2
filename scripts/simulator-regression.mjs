import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseSync, transformSync } from 'rolldown/utils';

// Exercise the actual simulator helpers, not a duplicated physics model.
const source = fs.readFileSync(new URL('../src/MetrologyLabV3.tsx', import.meta.url), 'utf8');
const ast = parseSync('simulator.tsx', source).program;
const names = new Set([
  'BASE_FREQUENCY', 'AMBIENT_C', 'LIMIT_MM', 'WARMUP_SECONDS', 'TUTORIAL_VIDEOS',
  'initialState', 'clamp', 'uid', 'now', 'fmtPressure', 'FAULT_CATALOG',
  'addEvent', 'addAlarm', 'getMeasurementValidation', 'evaluateScanRecord',
  'createSerpentineScanPlan', 'reducer', 'noise', 'trueFrequency', 'buildSweep',
  'buildScope', 'getPumpLifecycle', 'tick', 'buildQualitySummary',
]);
const selected = ast.body.filter(node => {
  if (node.type === 'FunctionDeclaration') return names.has(node.id?.name);
  if (node.type === 'VariableDeclaration') return node.declarations.some(d => names.has(d.id.name));
  return false;
}).map(node => source.slice(node.start, node.end)).join('\n');
const js = transformSync('simulator.ts', selected).code;
const sandbox = {};
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

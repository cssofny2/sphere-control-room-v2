import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseSync, transformSync } from 'rolldown/utils';

const source = fs.readFileSync(new URL('../src/MetrologyLabV3.tsx', import.meta.url), 'utf8');
const ast = parseSync('simulator.tsx', source).program;
const declarations = new Map();
let stopEffect;
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclaration') {
    for (const declaration of node.declarations) {
      if (['clearSweepTimers', 'performSweep'].includes(declaration.id?.name)) {
        declarations.set(declaration.id.name, source.slice(node.start, node.end));
      }
    }
  }
  if (node.type === 'CallExpression' && node.callee?.name === 'useEffect') {
    const callback = node.arguments[0];
    const text = callback && source.slice(callback.start, callback.end);
    if (text?.includes('!state.experiment.active') && text.includes('clearSweepTimers()')) {
      assert.equal(stopEffect, undefined, 'Expected one inactive-run cleanup effect');
      stopEffect = text;
    }
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') visit(value);
  }
}
visit(ast);
assert.ok(stopEffect, 'Missing inactive-run cleanup effect');
assert.equal(declarations.size, 2, 'Missing sweep or timer cleanup implementation');
const extracted = `
${declarations.get('clearSweepTimers')}
globalThis.createSweep = (state) => {
  ${declarations.get('performSweep')}
  return performSweep;
};
globalThis.runStopEffect = (state) => (${stopEffect})();
`;
const code = transformSync('sweep-race.ts', extracted).code;

function fixture(reduced) {
  let now = 0, identity = 0, timerId = 0;
  const timers = new Map(), actions = [];
  let current = {
    facility: { mode: 'operator', power: true },
    experiment: { active: true, scanActive: false, id: 'run-A', captureCount: 0,
      currentScanIndex: 0, rescanCounts: {}, records: [],
      contract: { id: 'run-A', status: 'running', plan: { acquisitions: [] } } },
    vna: { sweeping: false, acquisitionPhase: 'idle', calibrated: true, power: true, rf: true },
    stage: { x: 0, y: 0, z: 0 },
    chamber: { pressure: 0.1, temperature: 22, faraday: true, isolation: true },
    clock: { locked: true, cableFault: false },
    failures: { clockDrift: false },
    ldv: { power: true, shutter: true, opticalQuality: 1 },
  };
  const context = {
    window: {
      setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; },
      clearTimeout(id) { timers.delete(id); },
    },
    sweepTimers: { current: [] },
    sweepRunId: { current: null },
    FX: { reduced },
    BASE_FREQUENCY: 230500,
    MODEL_VERSION: 'test-model',
    validationResult: { overall: 'VALID' },
    buildSweep: () => [{ freq: 230500, s11: -20 }],
    captureSettings: () => ({}),
    createIdentifier: kind => `${kind}-${++identity}`,
    dispatch(action) {
      actions.push(action);
      if (action.type === 'PATCH') current = { ...current, [action.domain]: { ...current[action.domain], ...action.patch } };
      if (action.type === 'RECORD') current = { ...current, experiment: { ...current.experiment, records: [...current.experiment.records, action.record] } };
    },
  };
  vm.runInNewContext(code, context);
  return {
    get state() { return current; },
    get pending() { return timers.size; },
    actions,
    sweep() { context.createSweep(current)(); },
    stop(status = 'cancelled') {
      current = { ...current, experiment: { ...current.experiment, active: false,
        contract: { ...current.experiment.contract, status } } };
      context.runStopEffect(current);
    },
    restart() {
      current = { ...current, experiment: { ...current.experiment, active: true,
        id: 'run-B', records: [], captureCount: 0,
        contract: { ...current.experiment.contract, id: 'run-B', status: 'running' } } };
      context.runStopEffect(current);
    },
    advance(target) {
      while (true) {
        const entry = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry) break;
        now = entry[1].at;
        timers.delete(entry[0]);
        entry[1].callback();
      }
      now = target;
    },
  };
}

for (const reduced of [false, true]) {
  const duration = reduced ? 40 : 1650;
  {
    const f = fixture(reduced);
    f.sweep();
    f.advance(duration);
    assert.equal(f.state.vna.sweeping, false);
    assert.equal(f.state.vna.acquisitionPhase, 'complete');
    assert.equal(f.state.experiment.records.length, 1);
    assert.equal(f.pending, 1, 'Delayed idle callback must still exist before Stop');
    f.stop();
    assert.equal(f.pending, 0, 'Stop after completion must cancel the delayed idle callback');
    assert.equal(f.state.vna.acquisitionPhase, 'idle');
    assert.equal(f.state.vna.recordPacket, false);
    const actionCount = f.actions.length;
    f.advance(duration + 1000);
    assert.equal(f.actions.length, actionCount, 'No callback may dispatch after Stop cleanup');
    assert.equal(f.state.experiment.records.length, 1, 'Committed record must remain');
  }
  {
    const f = fixture(reduced);
    f.sweep();
    f.advance(duration * 0.75);
    f.stop();
    assert.equal(f.pending, 0);
    assert.equal(f.state.vna.resonanceHold, false);
    f.advance(duration + 1000);
    assert.equal(f.state.experiment.records.length, 0, 'Partial sweep must not commit');
  }
  {
    const f = fixture(reduced);
    f.sweep();
    f.advance(duration);
    f.stop('completed');
    assert.equal(f.pending, 1, 'Natural completion must preserve the existing pulse timing');
    f.advance(duration + 850);
    assert.equal(f.state.vna.acquisitionPhase, 'idle');
  }
}
console.log('PASS actual sweep Stop race, partial-sweep cancellation, retained records, and natural completion at normal/reduced-motion durations');

// Regression for a final active state after batched Stop/Start: ownership must change.
for (const reduced of [false, true]) {
  const f = fixture(reduced);
  f.sweep();
  assert.equal(f.pending, 4);
  f.restart();
  assert.equal(f.pending, 0, 'Changed run owner must cancel old sweep timers');
  assert.equal(f.state.vna.sweeping, false);
  assert.equal(f.state.vna.acquisitionPhase, 'idle');
  const actionCount = f.actions.length;
  f.advance((reduced ? 40 : 1650) + 1000);
  assert.equal(f.actions.length, actionCount, 'Previous owner must not dispatch into the new run');
  assert.equal(f.state.experiment.id, 'run-B');
  assert.equal(f.state.experiment.records.length, 0);
}
console.log('PASS sweep ownership change cancels old timers at normal/reduced-motion durations');

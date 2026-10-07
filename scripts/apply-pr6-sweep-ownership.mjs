import assert from 'node:assert/strict';
import fs from 'node:fs';

const sourcePath = 'src/MetrologyLabV3.tsx';
const testPath = 'scripts/sweep-race.test.mjs';
let source = fs.readFileSync(sourcePath, 'utf8');
let test = fs.readFileSync(testPath, 'utf8');
const replacements = [
  ['  const sweepTimers = useRef<ReturnType<typeof window.setTimeout>[]>([]);', '  const sweepTimers = useRef<ReturnType<typeof window.setTimeout>[]>([]);\n  const sweepRunId = useRef<string | null>(null);'],
  ['    sweepTimers.current = [];\n  };', '    sweepTimers.current = [];\n    sweepRunId.current = null;\n  };'],
  ['    const cancelled = state.experiment.contract?.status === "cancelled";\n    if (!state.experiment.active && (state.vna.sweeping || cancelled)) {', '    const cancelled = state.experiment.contract?.status === "cancelled";\n    const ownerChanged = sweepRunId.current !== null && sweepRunId.current !== state.experiment.id;\n    if (ownerChanged || (!state.experiment.active && (state.vna.sweeping || cancelled))) {'],
  ['  }, [state.experiment.active, state.experiment.contract?.status]);', '  }, [state.experiment.active, state.experiment.contract?.status, state.experiment.id]);'],
  ['    clearSweepTimers();\n    const trace = buildSweep(state);', '    clearSweepTimers();\n    sweepRunId.current = state.experiment.active ? state.experiment.id : null;\n    const trace = buildSweep(state);'],
];
if (source.includes('  const sweepRunId = useRef<string | null>(null);')) {
  for (const [, after] of replacements) assert.ok(source.includes(after), 'Incomplete ownership fix; refusing automatic repair');
} else {
  for (const [before, after] of replacements) {
    assert.equal(source.split(before).length, 2, 'Unexpected source context; refusing automatic repair');
    source = source.replace(before, after);
  }
}
const fixtureAnchor = '    sweepTimers: { current: [] },';
if (!test.includes('    sweepRunId: { current: null },')) {
  assert.equal(test.split(fixtureAnchor).length, 2, 'Unexpected timer fixture');
  test = test.replace(fixtureAnchor, fixtureAnchor + '\n    sweepRunId: { current: null },');
}
const restartMethod = `    restart() {
      current = { ...current, experiment: { ...current.experiment, active: true,
        id: 'run-B', records: [], captureCount: 0,
        contract: { ...current.experiment.contract, id: 'run-B', status: 'running' } } };
      context.runStopEffect(current);
    },
`;
const restartTests = `
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
`;
if (!test.includes("PASS sweep ownership change cancels old timers")) {
  assert.equal(test.split('    advance(target) {').length, 2, 'Unexpected clock fixture');
  test = test.replace('    advance(target) {', restartMethod + '    advance(target) {') + restartTests;
} else {
  assert.ok(test.includes(restartMethod), 'Incomplete restart fixture');
  assert.ok(test.includes(restartTests), 'Unexpected restart regression content');
}
fs.writeFileSync(sourcePath, source);
fs.writeFileSync(testPath, test);
console.log('Reviewed sweep ownership patch and regressions are present.');

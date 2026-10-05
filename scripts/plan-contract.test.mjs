import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

const P = await loadTypeScript(new URL('../src/simulation/plan.ts', import.meta.url));
const R = await loadTypeScript(new URL('../src/domain/run.ts', import.meta.url));
const input = { axis: 'x', start: -20, stop: 20, step: 5, repeats: 3, seed: 73421, randomized: false, anchor: { x: 0, y: 0, z: 0 } };
const plan = patch => {
  const result = P.buildAxisPlan({ ...input, ...patch });
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.plan;
};
const rejected = (patch, field) => {
  const result = P.buildAxisPlan({ ...input, ...patch });
  assert.equal(result.ok, false, JSON.stringify(patch));
  assert.ok(result.issues.some(issue => issue.field === field), JSON.stringify(result));
};

const a = plan();
assert.deepEqual(a.orderedPoints.map(p => p.x), [-20, -15, -10, -5, 0, 5, 10, 15, 20]);
assert.equal(a.acquisitions.length, 27);
assert.deepEqual(a.acquisitions.slice(0, 3).map(p => p.repeatIndex), [1, 2, 3]);
assert.equal(new Set(a.acquisitions.map(p => p.id)).size, 27);
assert.ok(a.acquisitions.every(p => p.runId === a.runId && a.orderedPoints.some(point => point.id === p.pointId)));
console.log('PASS nine ordered positions and 27 distinct planned acquisitions');

for (const step of [0, -1, NaN, Infinity, -Infinity, '5']) rejected({ step }, 'step');
for (const start of [NaN, Infinity, -36]) rejected({ start }, 'start');
rejected({ stop: 36 }, 'stop');
rejected({ start: 20, stop: -20 }, 'stop');
for (const repeats of [0, -1, 101, 1.2, NaN, Infinity, null, '3']) rejected({ repeats }, 'repeats');
for (const seed of [-1, 0x100000000, 1.2, NaN, null, '1']) rejected({ seed }, 'seed');
rejected({ axis: 'q' }, 'axis');
rejected({ randomized: 'true' }, 'randomized');
rejected({ randomized: null }, 'randomized');
rejected({ anchor: { x: 0, y: Infinity, z: 0 } }, 'anchor.y');
rejected({ anchor: { x: 0, y: 36, z: 0 } }, 'anchor.y');
rejected({ step: 1e-300 }, 'acquisitions');
rejected({ step: 0.001 }, 'acquisitions');
assert.equal(plan({ start: 0, stop: 9.99, step: 0.01, repeats: 1 }).acquisitions.length, 1000);
rejected({ start: 0, stop: 10, step: 0.01, repeats: 1 }, 'acquisitions');
assert.equal(P.buildAxisPlan(input, { ...P.DEFAULT_PLAN_LIMITS, maxAcquisitions: 20 }).ok, false);
assert.equal(P.buildAxisPlan(input, { ...P.DEFAULT_PLAN_LIMITS, maxRepeats: 0 }).ok, false);
console.log('PASS finite/range/direction/repeat/seed checks and exact acquisition caps');

const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
let identities = 0;
Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: () => `identity-${++identities}` } });
try {
  assert.equal(P.buildAxisPlan({ ...input, step: 0 }).ok, false);
  assert.equal(P.buildAxisPlan({ ...input, step: 1e-300 }).ok, false);
  assert.equal(identities, 0, 'invalid plans must not allocate point/acquisition/run identities');
} finally {
  if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
  else delete globalThis.crypto;
}
console.log('PASS invalid inputs rejected before identity/point allocation');

const shuffledA = plan({ randomized: true }), shuffledB = plan({ randomized: true });
assert.deepEqual(shuffledA.executionPoints.map(p => p.x), shuffledB.executionPoints.map(p => p.x));
assert.notEqual(shuffledA.runId, shuffledB.runId);
assert.notEqual(shuffledA.id, shuffledB.id);
assert.equal(new Set(shuffledA.executionPoints.map(p => p.pointIndex)).size, 9);
assert.notDeepEqual(shuffledA.executionPoints.map(p => p.x), plan({ randomized: true, seed: 42 }).executionPoints.map(p => p.x));
assert.equal(new Set([...shuffledA.acquisitions, ...shuffledB.acquisitions].map(p => p.id)).size, 54);
console.log('PASS seeded Fisher-Yates order with independent identities');

const fractional = plan({ start: 0, stop: 1, step: 0.3, repeats: 1 });
assert.equal(fractional.orderedPoints.length, 4);
assert.ok(fractional.orderedPoints.at(-1).x < 1);
assert.ok(fractional.notes[0].includes('not included'));
assert.deepEqual(plan({ start: 0, stop: 0.3, step: 0.1, repeats: 1 }).orderedPoints.map(p => p.x), [0, 0.1, 0.2, 0.3]);
assert.equal(plan({ start: 5, stop: 5, step: 1, repeats: 2 }).acquisitions.length, 2);
const tiny = plan({ start: 0, stop: 1e-13, step: 9e-14, repeats: 1 });
assert.ok(tiny.orderedPoints.at(-1).x < 1e-13);
assert.ok(tiny.notes[0].includes('not included'));
console.log('PASS endpoint policy and decimal boundaries');

const grid = Array.from({ length: 25 }, (_, i) => ({ x: (i % 5 - 2) * 10, y: (Math.floor(i / 5) - 2) * 10, z: 0 }));
const gridResult = P.buildPointPlan({ positions: grid, seed: 0, repeats: 1 });
assert.equal(gridResult.ok, true);
assert.equal(gridResult.plan.acquisitions.length, 25);
assert.equal(P.buildPointPlan({ positions: [{ x: 36, y: 0, z: 0 }], seed: 0 }).ok, false);
assert.equal(P.buildPointPlan({ positions: Array(1001).fill(grid[0]), seed: 0 }).ok, false);
const manual = P.buildPointPlan({ kind: 'manual', positions: [grid[0]], seed: 73421 });
assert.equal(manual.ok, true);
assert.equal(manual.plan.acquisitions.length, 0);
assert.deepEqual(manual.plan.settings.anchor, grid[0]);
console.log('PASS bounded point plans and explicit manual recording contract');

const state = {
  facility: { seed: input.seed, speed: 1 }, model: { location: true },
  stage: { x: 20, y: 0, z: 0, actualX: 19.5, actualY: 0, actualZ: 0 },
  vna: { center: 230500, span: 5000, points: 401, ifbw: 100, averagingEnabled: false, averagingCount: 4 },
  chamber: { temperature: 22, pressure: 760, faraday: true, isolation: true },
};
const contract = R.createRunContract(a, state, 12.5);
assert.equal(contract.id, a.runId);
assert.equal(contract.dataOrigin, 'simulation');
assert.equal(contract.schemaVersion, 1);
assert.equal(contract.simulationStartTime, 12.5);
assert.equal(contract.initialSettings.positionMm.x, 19.5);
state.vna.ifbw = 25;
state.model.location = false;
assert.equal(contract.initialSettings.vna.ifBandwidthHz, 100);
assert.equal(contract.initialSettings.modelEffects.location, true);
assert.equal(R.captureSettings(state).vna.ifBandwidthHz, 25);
assert.throws(() => R.createRunContract(a, state, NaN));
assert.deepEqual(JSON.parse(JSON.stringify(contract)), contract);
console.log('PASS serializable versioned run contract and copied initial/acquisition settings');

for (let i = 0; i < 200; i++) {
  const generated = plan({ start: -35 + i * 0.1, stop: 35, step: 0.5 + (i % 10) * 0.1, repeats: 1 + i % 5, seed: i, randomized: true });
  assert.ok(generated.acquisitions.length <= 1000);
  assert.ok(generated.orderedPoints.every(p => p.x >= -35 && p.x <= 35));
  assert.equal(new Set(generated.executionPoints.map(p => p.id)).size, generated.orderedPoints.length);
}
console.log('PASS 200 bounded plan property fixtures');

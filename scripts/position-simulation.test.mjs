import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

const sim = await loadTypeScript(new URL('../src/protocol/positionSimulation.ts', import.meta.url));

const config = overrides => ({
  mode: 'null',
  seed: 104729,
  replicatesPerPosition: 5,
  nominalTestFrequencyHz: 230500,
  nominalReferenceFrequencyHz: 230500,
  fitNoiseStdHz: 0.02,
  sharedClockNoiseStdPpb: 10,
  hypothesisShiftPpm: 1,
  temperatureDifferenceK: 0.02,
  thermalCoefficientPpmPerK: -100,
  maxTemperatureDifferenceK: 0.01,
  clockLocked: true,
  ...overrides,
});

{
  const first = sim.simulatePositionRun(config({ fitNoiseStdHz: 0 }));
  const second = sim.simulatePositionRun(config({ fitNoiseStdHz: 0 }));
  assert.deepEqual(first, second, 'same seed and settings reproduce observations exactly');
  assert.equal(first.synthetic, true);
  assert.equal(first.observations.length, 10);
  assert.equal(first.configuration.seed, 104729);
  assert.equal(first.configuration.replicatesPerPosition, 5);
  assert.ok(Math.abs(first.contrastPpm) < 1e-6, 'common clock error cancels in the simultaneous test/reference ratio');
  console.log('PASS null A/B run is deterministic and common clock error cancels');
}

{
  const injected = sim.simulatePositionRun(config({
    mode: 'hypothetical_injection',
    fitNoiseStdHz: 0,
    hypothesisShiftPpm: 1,
  }));
  assert.ok(Math.abs(injected.contrastPpm - 1) < 1e-6);
  assert.deepEqual(injected.qualityFlags, []);
  console.log('PASS hypothetical effect follows B position and remains separate from null mode');
}

{
  const challenge = sim.simulatePositionRun(config({
    mode: 'artifact_challenge',
    fitNoiseStdHz: 0,
    replicatesPerPosition: 2,
  }));
  assert.ok(Math.abs(challenge.contrastPpm - -2) < 1e-6);
  assert.ok(challenge.qualityFlags.includes('temperature_tolerance_exceeded'));
  assert.equal(challenge.observations.length, 4, 'quality-flagged observations are retained');
  assert.ok(challenge.observations.filter(item => item.position === 'B').every(item => item.qualityFlags.includes('temperature_tolerance_exceeded')));
  console.log('PASS thermal challenge creates a flagged, retained artifact rather than a valid location result');
}

{
  const unlocked = sim.simulatePositionRun(config({ clockLocked: false, replicatesPerPosition: 1 }));
  assert.ok(unlocked.qualityFlags.includes('clock_unlocked'));
  assert.equal(unlocked.observations.length, 2);
  assert.throws(() => sim.simulatePositionRun(config({ replicatesPerPosition: 0 })), /replicatesPerPosition/);
  assert.throws(() => sim.simulatePositionRun(config({ replicatesPerPosition: 101 })), /must not exceed 100/);
  console.log('PASS clock faults remain visible and invalid replicate counts are rejected');
}

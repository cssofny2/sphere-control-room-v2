export type PositionScenario = 'null' | 'artifact_challenge' | 'hypothetical_injection';
export type TestPosition = 'A' | 'B';

export interface PositionSimulationConfig {
  mode: PositionScenario;
  seed: number;
  replicatesPerPosition: number;
  nominalTestFrequencyHz: number;
  nominalReferenceFrequencyHz: number;
  fitNoiseStdHz: number;
  sharedClockNoiseStdPpb: number;
  hypothesisShiftPpm: number;
  temperatureDifferenceK: number;
  thermalCoefficientPpmPerK: number;
  maxTemperatureDifferenceK: number;
  clockLocked: boolean;
}

export interface PositionObservation {
  position: TestPosition;
  replicate: number;
  testFrequencyHz: number;
  referenceFrequencyHz: number;
  normalizedRatioPpm: number;
  temperatureDifferenceK: number;
  qualityFlags: string[];
}

export interface PositionSimulationRun {
  synthetic: true;
  mode: PositionScenario;
  seed: number;
  configuration: PositionSimulationConfig;
  observations: PositionObservation[];
  meanRatioPpm: Record<TestPosition, number>;
  contrastPpm: number;
  qualityFlags: string[];
}

function assertFinite(name: string, value: number, min: number): void {
  if (!Number.isFinite(value) || value < min) throw new RangeError(`${name} must be finite and at least ${min}.`);
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function normalRandom(random: () => number): number {
  const u = Math.max(Number.EPSILON, random());
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function simulatePositionRun(config: PositionSimulationConfig): PositionSimulationRun {
  assertFinite('seed', config.seed, 0);
  assertFinite('replicatesPerPosition', config.replicatesPerPosition, 1);
  assertFinite('nominalTestFrequencyHz', config.nominalTestFrequencyHz, Number.EPSILON);
  assertFinite('nominalReferenceFrequencyHz', config.nominalReferenceFrequencyHz, Number.EPSILON);
  assertFinite('fitNoiseStdHz', config.fitNoiseStdHz, 0);
  assertFinite('sharedClockNoiseStdPpb', config.sharedClockNoiseStdPpb, 0);
  assertFinite('maxTemperatureDifferenceK', config.maxTemperatureDifferenceK, 0);
  if (!Number.isInteger(config.seed) || !Number.isInteger(config.replicatesPerPosition)) {
    throw new RangeError('Seed and replicate count must be integers.');
  }
  if (config.seed > 4294967295) throw new RangeError('Seed must fit in an unsigned 32-bit integer.');
  if (config.replicatesPerPosition > 100) throw new RangeError('Replicate count must not exceed 100.');
  if (!['null', 'artifact_challenge', 'hypothetical_injection'].includes(config.mode)) {
    throw new RangeError('Unknown position simulation mode.');
  }
  if (!Number.isFinite(config.hypothesisShiftPpm) || !Number.isFinite(config.temperatureDifferenceK) ||
      !Number.isFinite(config.thermalCoefficientPpmPerK)) {
    throw new RangeError('Scenario parameters must be finite.');
  }

  const random = seededRandom(config.seed);
  const baselineRatio = config.nominalTestFrequencyHz / config.nominalReferenceFrequencyHz;
  const observations: PositionObservation[] = [];

  for (const position of ['A', 'B'] as const) {
    const positionEffectPpm = position === 'B'
      ? (config.mode === 'hypothetical_injection'
        ? config.hypothesisShiftPpm
        : config.mode === 'artifact_challenge'
          ? config.temperatureDifferenceK * config.thermalCoefficientPpmPerK
          : 0)
      : 0;
    const temperatureDifferenceK = position === 'B' && config.mode === 'artifact_challenge'
      ? config.temperatureDifferenceK
      : 0;

    for (let replicate = 1; replicate <= config.replicatesPerPosition; replicate++) {
      const sharedClockScale = 1 + normalRandom(random) * config.sharedClockNoiseStdPpb * 1e-9;
      const testFrequencyHz = (
        config.nominalTestFrequencyHz * (1 + positionEffectPpm * 1e-6) +
        normalRandom(random) * config.fitNoiseStdHz
      ) * sharedClockScale;
      const referenceFrequencyHz = (
        config.nominalReferenceFrequencyHz + normalRandom(random) * config.fitNoiseStdHz
      ) * sharedClockScale;
      const normalizedRatioPpm = 1e6 * (
        testFrequencyHz / referenceFrequencyHz / baselineRatio - 1
      );
      const qualityFlags: string[] = [];

      if (Math.abs(temperatureDifferenceK) > config.maxTemperatureDifferenceK) {
        qualityFlags.push('temperature_tolerance_exceeded');
      }
      if (!config.clockLocked) qualityFlags.push('clock_unlocked');

      observations.push({
        position,
        replicate,
        testFrequencyHz,
        referenceFrequencyHz,
        normalizedRatioPpm,
        temperatureDifferenceK,
        qualityFlags,
      });
    }
  }

  const meanRatioPpm = {
    A: mean(observations.filter(item => item.position === 'A').map(item => item.normalizedRatioPpm)),
    B: mean(observations.filter(item => item.position === 'B').map(item => item.normalizedRatioPpm)),
  };
  const qualityFlags = [...new Set(observations.flatMap(item => item.qualityFlags))];

  return {
    synthetic: true,
    mode: config.mode,
    seed: config.seed,
    configuration: { ...config },
    observations,
    meanRatioPpm,
    contrastPpm: meanRatioPpm.B - meanRatioPpm.A,
    qualityFlags,
  };
}

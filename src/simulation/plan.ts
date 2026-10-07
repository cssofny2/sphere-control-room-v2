import {
  createIdentifier, MODEL_VERSION, RUN_SCHEMA_VERSION,
  type Axis, type Coordinates, type PlannedPoint, type PlanSettings, type RunPlan,
} from '../domain/run';
import type { PlannedAcquisition } from '../domain/acquisition';

export interface PlanLimits {
  readonly travelLimitMm: number;
  readonly maxAcquisitions: number;
  readonly maxRepeats: number;
}
export const DEFAULT_PLAN_LIMITS: PlanLimits = Object.freeze({
  travelLimitMm: 35, maxAcquisitions: 1000, maxRepeats: 100,
});
export interface PlanIssue { readonly field: string; readonly message: string }
export type PlanResult = { readonly ok: true; readonly plan: RunPlan }
  | { readonly ok: false; readonly issues: readonly PlanIssue[] };
export interface ValidatedAxisSettings {
  readonly settings: PlanSettings & { readonly axis: Axis; readonly startMm: number; readonly stopMm: number; readonly stepMm: number };
  readonly pointCount: number;
  readonly endpointIncluded: boolean;
}
export type AxisValidation = { readonly ok: true; readonly value: ValidatedAxisSettings }
  | { readonly ok: false; readonly issues: readonly PlanIssue[] };
const object = (input: unknown): Record<string, unknown> =>
  typeof input === 'object' && input !== null && !Array.isArray(input) ? input as Record<string, unknown> : {};

function validateLimits(limits: PlanLimits): readonly PlanIssue[] {
  return Number.isFinite(limits.travelLimitMm) && limits.travelLimitMm > 0
    && Number.isSafeInteger(limits.maxAcquisitions) && limits.maxAcquisitions > 0
    && Number.isSafeInteger(limits.maxRepeats) && limits.maxRepeats > 0
    ? [] : [{ field: 'limits', message: 'Plan limits must be finite positive values; counts must be safe integers.' }];
}

function finite(value: unknown, field: string, issues: PlanIssue[]): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    issues.push({ field, message: `${field} must be a finite number.` }); return null;
  }
  return value;
}

function common(input: Record<string, unknown>, limits: PlanLimits, issues: PlanIssue[]) {
  const repeats = finite(input.repeats === undefined ? 1 : input.repeats, 'repeats', issues);
  const seed = finite(input.seed, 'seed', issues);
  const randomized = input.randomized === undefined ? false : input.randomized;
  if (repeats !== null && (!Number.isInteger(repeats) || repeats < 1 || repeats > limits.maxRepeats))
    issues.push({ field: 'repeats', message: `Repeats must be an integer from 1 to ${limits.maxRepeats}.` });
  if (seed !== null && (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff))
    issues.push({ field: 'seed', message: 'Seed must be an integer from 0 to 4294967295.' });
  if (typeof randomized !== 'boolean') issues.push({ field: 'randomized', message: 'Randomized must be true or false.' });
  const rawAnchor = input.anchor === undefined ? { x: 0, y: 0, z: 0 } : object(input.anchor);
  const coordinates = (['x', 'y', 'z'] as const).map(axis => {
    const value = finite(rawAnchor[axis], `anchor.${axis}`, issues);
    if (value !== null && Math.abs(value) > limits.travelLimitMm)
      issues.push({ field: `anchor.${axis}`, message: `Position must be within ±${limits.travelLimitMm} mm.` });
    return value;
  });
  const [x, y, z] = coordinates;
  if (repeats === null || seed === null || typeof randomized !== 'boolean' || x === null || y === null || z === null) return null;
  return { repeats, seed, randomized, anchor: { x, y, z } };
}

/** No point arrays or IDs are created before this validator succeeds. */
export function validateAxisSettings(input: unknown, limits: PlanLimits = DEFAULT_PLAN_LIMITS): AxisValidation {
  const issues: PlanIssue[] = [...validateLimits(limits)];
  if (issues.length) return { ok: false, issues };
  const raw = object(input);
  const c = common(raw, limits, issues);
  const axis = raw.axis === 'x' || raw.axis === 'y' || raw.axis === 'z' ? raw.axis : null;
  if (!axis) issues.push({ field: 'axis', message: 'Scan axis must be X, Y, or Z.' });
  const start = finite(raw.start, 'start', issues), stop = finite(raw.stop, 'stop', issues), step = finite(raw.step, 'step', issues);
  if (start !== null && Math.abs(start) > limits.travelLimitMm) issues.push({ field: 'start', message: `Start must be within ±${limits.travelLimitMm} mm.` });
  if (stop !== null && Math.abs(stop) > limits.travelLimitMm) issues.push({ field: 'stop', message: `Stop must be within ±${limits.travelLimitMm} mm.` });
  if (step !== null && step <= 0) issues.push({ field: 'step', message: 'Step must be greater than zero.' });
  if (start !== null && stop !== null && start > stop) issues.push({ field: 'stop', message: 'Stop must be greater than or equal to Start.' });
  if (issues.length || !c || !axis || start === null || stop === null || step === null) return { ok: false, issues };
  const quotient = (stop - start) / step;
  const tolerance = Math.min(1e-9, Number.EPSILON * Math.max(1, Math.abs(quotient)) * 8);
  const pointCount = Math.floor(quotient + tolerance) + 1;
  if (!Number.isSafeInteger(pointCount) || pointCount < 1 || pointCount > Math.floor(limits.maxAcquisitions / c.repeats))
    return { ok: false, issues: [{ field: 'acquisitions', message: `Plan exceeds the ${limits.maxAcquisitions} planned-acquisition limit (points × repeats). Increase Step or reduce the range/repeats.` }] };
  const last = start + (pointCount - 1) * step;
  const endpointTolerance = Number.EPSILON * Math.max(Math.abs(start), Math.abs(stop), Math.abs(step), Number.MIN_VALUE) * 16;
  const endpointIncluded = Math.abs(last - stop) <= endpointTolerance;
  return { ok: true, value: {
    settings: { kind: 'axis', axis, startMm: start, stopMm: stop, stepMm: step, ...c },
    pointCount, endpointIncluded,
  } };
}

export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function assemble(settings: PlanSettings, coordinates: readonly Coordinates[], notes: string[]): RunPlan {
  const runId = createIdentifier('run');
  const orderedPoints: PlannedPoint[] = coordinates.map((position, pointIndex) => ({
    ...position, id: createIdentifier('point'), pointIndex,
    kind: position.x === 0 && position.y === 0 && position.z === 0 ? 'reference' : 'measurement',
  }));
  const executionPoints = settings.randomized ? seededShuffle(orderedPoints, settings.seed) : [...orderedPoints];
  const acquisitions: PlannedAcquisition[] = [];
  for (const point of settings.kind === 'manual' ? [] : executionPoints) {
    for (let repeatIndex = 1; repeatIndex <= settings.repeats; repeatIndex++) {
      acquisitions.push({
        id: createIdentifier('acquisition'), runId, pointId: point.id, pointIndex: point.pointIndex,
        acquisitionIndex: acquisitions.length, repeatIndex, position: { x: point.x, y: point.y, z: point.z },
      });
    }
  }
  if (acquisitions.length > 200) notes.push('This plan exceeds the current 200-record in-memory ledger window. Durable retention is not yet available.');
  return {
    id: createIdentifier('plan'), runId, schemaVersion: RUN_SCHEMA_VERSION, modelVersion: MODEL_VERSION,
    dataOrigin: 'simulation', units: { position: 'mm', frequency: 'Hz', time: 's' },
    settings, orderedPoints, executionPoints, acquisitions, notes,
  };
}

export function buildAxisPlan(input: unknown, limits: PlanLimits = DEFAULT_PLAN_LIMITS): PlanResult {
  const validation = validateAxisSettings(input, limits);
  if (validation.ok === false) return validation;
  const { settings, pointCount, endpointIncluded } = validation.value;
  const coordinates = Array.from({ length: pointCount }, (_, i) => ({
    ...settings.anchor,
    [settings.axis]: endpointIncluded && i === pointCount - 1 ? settings.stopMm : settings.startMm + i * settings.stepMm,
  }));
  const notes = endpointIncluded ? [] : [`Final endpoint ${settings.stopMm} mm is not included; the last ordered point is ${Number(coordinates[pointCount - 1][settings.axis].toPrecision(12))} mm.`];
  return { ok: true, plan: assemble(settings, coordinates, notes) };
}

export function buildPointPlan(input: unknown, limits: PlanLimits = DEFAULT_PLAN_LIMITS): PlanResult {
  const issues: PlanIssue[] = [...validateLimits(limits)];
  if (issues.length) return { ok: false, issues };
  const raw = object(input), c = common(raw, limits, issues);
  const positions = raw.positions;
  if (!Array.isArray(positions) || !positions.length) issues.push({ field: 'positions', message: 'At least one planned position is required.' });
  if (Array.isArray(positions) && c && positions.length > Math.floor(limits.maxAcquisitions / c.repeats))
    issues.push({ field: 'acquisitions', message: `Plan exceeds the ${limits.maxAcquisitions} planned-acquisition limit.` });
  if (raw.kind === 'manual' && Array.isArray(positions) && (positions.length !== 1 || c?.repeats !== 1))
    issues.push({ field: 'positions', message: 'A manual recording snapshot requires one position and does not schedule repeats.' });
  if (issues.length || !c || !Array.isArray(positions)) return { ok: false, issues };
  const coordinates: Coordinates[] = [];
  positions.forEach((entry, i) => {
    const p = object(entry), values = (['x', 'y', 'z'] as const).map(axis => {
      const value = finite(p[axis], `positions[${i}].${axis}`, issues);
      if (value !== null && Math.abs(value) > limits.travelLimitMm) issues.push({ field: `positions[${i}].${axis}`, message: `Position must be within ±${limits.travelLimitMm} mm.` });
      return value;
    });
    if (values.every(v => v !== null)) coordinates.push({ x: values[0] as number, y: values[1] as number, z: values[2] as number });
  });
  if (issues.length) return { ok: false, issues };
  return { ok: true, plan: assemble({
    kind: raw.kind === 'manual' ? 'manual' : 'serpentine', axis: null, startMm: null, stopMm: null, stepMm: null, ...c,
    anchor: raw.kind === 'manual' ? coordinates[0] : c.anchor,
  }, coordinates, []) };
}

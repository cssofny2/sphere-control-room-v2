import type { PlannedAcquisition } from './acquisition';

export type Identifier<K extends string> = string & { readonly __kind: K };
export type RunId = Identifier<'run'>;
export type PlanId = Identifier<'plan'>;
export type PointId = Identifier<'point'>;
export type AcquisitionId = Identifier<'acquisition'>;
export type EventId = Identifier<'event'>;
export type Axis = 'x' | 'y' | 'z';
export type RunStatus = 'running' | 'paused' | 'cancelled' | 'completed' | 'faulted';
export const RUN_SCHEMA_VERSION = 1 as const;
export const MODEL_VERSION = 'sphere-teaching-model-v1';

let identityCounter = 0;
export function createIdentifier<K extends string>(kind: K): Identifier<K> {
  const token = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${++identityCounter}-${Math.random().toString(36).slice(2)}`;
  return `${kind}-${token}` as Identifier<K>;
}

export interface Coordinates {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface PlannedPoint extends Coordinates {
  readonly id: PointId;
  readonly pointIndex: number;
  readonly kind: 'measurement' | 'reference';
}

export interface PlanSettings {
  readonly kind: 'axis' | 'serpentine' | 'manual';
  readonly axis: Axis | null;
  readonly startMm: number | null;
  readonly stopMm: number | null;
  readonly stepMm: number | null;
  readonly anchor: Coordinates;
  readonly repeats: number;
  readonly randomized: boolean;
  readonly seed: number;
}

export interface RunPlan {
  readonly id: PlanId;
  readonly runId: RunId;
  readonly schemaVersion: typeof RUN_SCHEMA_VERSION;
  readonly modelVersion: string;
  readonly dataOrigin: 'simulation';
  readonly units: { readonly position: 'mm'; readonly frequency: 'Hz'; readonly time: 's' };
  readonly settings: PlanSettings;
  readonly orderedPoints: readonly PlannedPoint[];
  readonly executionPoints: readonly PlannedPoint[];
  readonly acquisitions: readonly PlannedAcquisition[];
  readonly notes: readonly string[];
}

export interface CaptureSettings {
  readonly seed: number;
  readonly simulationSpeed: number;
  readonly modelEffects: Readonly<Record<string, boolean>>;
  readonly positionMm: Coordinates;
  readonly vna: {
    readonly centerHz: number; readonly spanHz: number; readonly points: number;
    readonly ifBandwidthHz: number; readonly averagingEnabled: boolean; readonly averagingCount: number;
  };
  readonly environment: {
    readonly temperatureC: number; readonly pressureTorr: number;
    readonly faradayEnabled: boolean; readonly isolationEnabled: boolean;
  };
}

export interface SnapshotInput {
  facility: { seed: number; speed: number };
  model: Record<string, boolean>;
  stage: { x: number; y: number; z: number; actualX?: number; actualY?: number; actualZ?: number };
  vna: { center: number; span: number; points: number; ifbw: number; averagingEnabled: boolean; averagingCount: number };
  chamber: { temperature: number; pressure: number; faraday: boolean; isolation: boolean };
}

export function captureSettings(state: SnapshotInput): CaptureSettings {
  return {
    seed: state.facility.seed, simulationSpeed: state.facility.speed,
    modelEffects: { ...state.model },
    positionMm: { x: state.stage.actualX ?? state.stage.x, y: state.stage.actualY ?? state.stage.y, z: state.stage.actualZ ?? state.stage.z },
    vna: {
      centerHz: state.vna.center, spanHz: state.vna.span, points: state.vna.points,
      ifBandwidthHz: state.vna.ifbw, averagingEnabled: state.vna.averagingEnabled,
      averagingCount: state.vna.averagingCount,
    },
    environment: {
      temperatureC: state.chamber.temperature, pressureTorr: state.chamber.pressure,
      faradayEnabled: state.chamber.faraday, isolationEnabled: state.chamber.isolation,
    },
  };
}

export interface RunContract {
  readonly id: RunId;
  readonly schemaVersion: typeof RUN_SCHEMA_VERSION;
  readonly modelVersion: string;
  readonly dataOrigin: 'simulation';
  readonly createdAt: string;
  readonly simulationStartTime: number;
  readonly initialSettings: CaptureSettings;
  readonly plan: RunPlan;
  readonly status: RunStatus;
}

export function createRunContract(plan: RunPlan, state: SnapshotInput, simulationTime: number): RunContract {
  if (!Number.isFinite(simulationTime) || simulationTime < 0) throw new RangeError('Simulation time must be finite and nonnegative.');
  if (state.facility.seed !== plan.settings.seed) throw new Error('Initial capture seed must match the accepted plan seed.');
  return {
    id: plan.runId, schemaVersion: RUN_SCHEMA_VERSION, modelVersion: MODEL_VERSION,
    dataOrigin: 'simulation', createdAt: new Date().toISOString(),
    simulationStartTime: simulationTime, initialSettings: captureSettings(state), plan, status: 'running',
  };
}

export interface AxisPlanDraft {
  readonly axis: Axis;
  readonly start: number;
  readonly stop: number;
  readonly step: number;
  readonly repeats: number;
  readonly randomized: boolean;
  readonly seed: number;
  readonly anchor: Coordinates;
}

export interface SimulationEvent {
  readonly id: EventId;
  readonly time: string;
  readonly simulationTime: number;
  readonly subsystem: string;
  readonly text: string;
  readonly level: 'info' | 'warning' | 'critical';
  readonly x: number | null;
  readonly y: number | null;
  readonly z: number | null;
  readonly runId: RunId | null;
}

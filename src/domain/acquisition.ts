import type { AcquisitionId, CaptureSettings, Coordinates, PointId, RunId } from './run';

export interface PlannedAcquisition {
  readonly id: AcquisitionId;
  readonly runId: RunId;
  readonly pointId: PointId;
  readonly pointIndex: number;
  readonly acquisitionIndex: number;
  readonly repeatIndex: number;
  readonly position: Coordinates;
}

export interface AcquisitionContract {
  readonly id: AcquisitionId;
  readonly runId: RunId;
  readonly pointId: PointId | null;
  readonly plannedAcquisitionId: AcquisitionId | null;
  readonly acquisitionIndex: number;
  readonly repeatIndex: number;
  readonly attemptIndex: number;
  readonly dataOrigin: 'simulation';
  readonly modelVersion: string;
  readonly simulationTime: number;
  readonly timestamp: string;
  readonly position: Coordinates;
  readonly settings: CaptureSettings;
}

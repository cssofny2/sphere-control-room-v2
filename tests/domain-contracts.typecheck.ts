import type { RunId, AcquisitionId, RunPlan } from '../src/domain/run';
import type { AcquisitionContract } from '../src/domain/acquisition';

declare const acquisitionId: AcquisitionId;
// @ts-expect-error acquisition and run identities are not interchangeable
const runId: RunId = acquisitionId;
declare const plan: RunPlan;
// @ts-expect-error plan units cannot be mutated to an unsupported unit
plan.units.position = 'cm';
declare const acquisition: AcquisitionContract;
// @ts-expect-error a simulation capture cannot silently become physical data
acquisition.dataOrigin = 'physical';
// @ts-expect-error capture metadata is immutable at the typed boundary
acquisition.repeatIndex = 2;
void runId;

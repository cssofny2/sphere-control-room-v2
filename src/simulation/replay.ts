// Re-checks stored measurements: rebuilds each record's S11 trace from the settings saved with it and fits it again.
// The trace noise is seeded by the facility seed and the simulation time, so a record made by the same model version
// reproduces its resonance. This is a consistency check of the recorded numbers, not a claim of full run replay.
import { buildSweep, BASE_FREQUENCY, type SweepState } from './model';
import { measureTrace } from './measurement';

export interface ReplayableRecord {
  readonly id: string;
  readonly resonance: number;
  readonly uncertaintyHz?: number;
  readonly clockLocked?: boolean;
  readonly fit?: { readonly ok: boolean } | null;
  readonly contract?: {
    readonly simulationTime?: number;
    readonly position?: { x: number; y: number; z: number };
    readonly settings?: {
      readonly seed: number; readonly modelEffects?: Record<string, boolean>;
      readonly vna: { centerHz: number; spanHz: number; points: number; ifBandwidthHz: number; averagingEnabled: boolean; averagingCount: number };
      readonly environment: { temperatureC: number; pressureTorr: number; faradayEnabled: boolean; isolationEnabled: boolean };
    };
  } | null;
}

export type ReplayVerdict = 'match' | 'differs' | 'skipped';
export interface ReplayRow { readonly id: string; readonly verdict: ReplayVerdict; readonly deltaHz: number | null; readonly reason?: string }
export interface ReplaySummary { readonly rows: readonly ReplayRow[]; readonly match: number; readonly differs: number; readonly skipped: number; readonly maxDeltaHz: number }

/** Largest resonance difference (Hz) still counted as reproduced. */
export const REPLAY_TOLERANCE_HZ = 0.01;

export function replayRecord(r: ReplayableRecord): ReplayRow {
  const c = r.contract, s = c?.settings;
  if (!c || !s || !c.position || typeof c.simulationTime !== 'number') return { id: r.id, verdict: 'skipped', deltaHz: null, reason: 'No capture settings were stored with this record.' };
  if (r.fit && r.fit.ok === false) return { id: r.id, verdict: 'skipped', deltaHz: null, reason: 'Its fit failed when recorded.' };
  if (!(s.vna.spanHz > 0) || !(s.vna.centerHz > 0)) return { id: r.id, verdict: 'skipped', deltaHz: null, reason: 'Sweep range was not stored.' };
  const state: SweepState = {
    stage: { x: c.position.x, y: c.position.y, z: c.position.z, actualX: c.position.x, actualY: c.position.y, actualZ: c.position.z },
    chamber: { temperature: s.environment.temperatureC, pressure: s.environment.pressureTorr, faraday: s.environment.faradayEnabled },
    model: s.modelEffects ?? {}, clock: { locked: r.clockLocked !== false }, failures: {},
    vna: { center: s.vna.centerHz, span: s.vna.spanHz, startFrequency: 0, stopFrequency: 0, points: s.vna.points, ifbw: s.vna.ifBandwidthHz,
      averagingEnabled: s.vna.averagingEnabled, averagingCount: s.vna.averagingCount, traceMath: 'none', reference: [] },
    facility: { seed: s.seed, simulationTime: c.simulationTime },
  };
  const m = measureTrace(buildSweep(state), BASE_FREQUENCY);
  if (!m.fit.ok) return { id: r.id, verdict: 'differs', deltaHz: null, reason: `Replay fit failed: ${m.problem}` };
  const d = m.resonance - r.resonance;
  return { id: r.id, verdict: Math.abs(d) <= REPLAY_TOLERANCE_HZ ? 'match' : 'differs', deltaHz: d,
    reason: Math.abs(d) <= REPLAY_TOLERANCE_HZ ? undefined : 'Different model version, an unrecorded fault, or edited values.' };
}

export function replayAll(records: readonly ReplayableRecord[]): ReplaySummary {
  const rows = records.map(replayRecord);
  return {
    rows, match: rows.filter(r => r.verdict === 'match').length, differs: rows.filter(r => r.verdict === 'differs').length,
    skipped: rows.filter(r => r.verdict === 'skipped').length, maxDeltaHz: rows.reduce((m, r) => Math.max(m, Math.abs(r.deltaHz ?? 0)), 0),
  };
}

// Uncertainty budget: where each position's uncertainty comes from, and a pooled repeatability for the whole run.
// It reuses the lab's own Type A policy (see simulation/stats.ts) so the numbers agree with the rest of the app.
import { summarizePositions, type PositionSummary, type StatRecord } from '../simulation/stats';

export interface BudgetRow {
  readonly key: string; readonly x: number; readonly y: number; readonly z: number; readonly n: number;
  readonly meanHz: number;
  /** SD / sqrt(n), null with fewer than two repeats. */
  readonly repeatabilityHz: number | null;
  /** Propagated fit uncertainty of the mean, null when the fit gave none. */
  readonly fitHz: number | null;
  readonly standardHz: number | null; readonly expandedHz: number | null; readonly k: number | null;
  /** Which component set the standard uncertainty. */
  readonly dominant: 'repeatability' | 'fit' | 'none';
}
export interface RunBudget {
  readonly rows: BudgetRow[];
  /** Pooled standard deviation of repeats over every position with 2+ repeats, and its degrees of freedom. */
  readonly pooledSdHz: number | null; readonly pooledDof: number;
  /** Rectangular drift term, 0 when no drift was supplied. */
  readonly driftHz: number;
  /** Worst-case standard uncertainty among the rows combined with the drift term in quadrature. */
  readonly worstCombinedHz: number | null;
}

export function runBudget(records: readonly StatRecord[], drift: { slopeHzPerS: number; durationS: number } | null = null): RunBudget {
  const sums: PositionSummary[] = summarizePositions(records);
  const rows: BudgetRow[] = sums.map(s => {
    const rep = s.semHz, fit = s.fitUHz;
    const dominant: BudgetRow['dominant'] = s.standardUncertaintyHz === null ? 'none' : rep !== null && (fit === null || rep >= fit) ? 'repeatability' : 'fit';
    return { key: s.key, x: s.x, y: s.y, z: s.z, n: s.n, meanHz: s.meanHz, repeatabilityHz: rep, fitHz: fit, standardHz: s.standardUncertaintyHz, expandedHz: s.expandedUncertaintyHz, k: s.coverageFactor, dominant };
  });
  let ss = 0, dof = 0;
  for (const s of sums) if (s.n >= 2 && s.sdHz !== null) { ss += (s.n - 1) * s.sdHz * s.sdHz; dof += s.n - 1; }
  const driftHz = drift && drift.durationS > 0 && Number.isFinite(drift.slopeHzPerS) ? Math.abs(drift.slopeHzPerS) * drift.durationS / 2 / Math.sqrt(3) : 0;
  const stds = rows.map(r => r.standardHz).filter((v): v is number => v !== null);
  return { rows, pooledSdHz: dof > 0 ? Math.sqrt(ss / dof) : null, pooledDof: dof, driftHz, worstCombinedHz: stds.length ? Math.hypot(Math.max(...stds), driftHz) : null };
}

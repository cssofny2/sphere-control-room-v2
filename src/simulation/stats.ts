// Per-position repeatability statistics for an experiment run.
//
// Uncertainty policy (Type A only): the standard uncertainty of a position's mean resonance is the larger of
//   - the standard error of the mean of the repeats (SD / sqrt(n)), and
//   - the fit uncertainty propagated to the mean (sqrt(sum of u_i^2) / n).
// Taking the larger is deliberately conservative, because the SEM is unreliable for small n. The coverage factor is
// Student's t for n - 1 degrees of freedom when the SEM governs, and 2 when only the fit uncertainty is available.
// A repeat that was rescanned after failing its quality checks is counted once, by its latest attempt: the earlier
// attempts of the same planned point and repeat are not independent repeats, so they are reported as superseded.

export interface StatRecord {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly pointId?: string | null;
  readonly resonance: number;
  readonly uncertaintyHz?: number;
  readonly fit?: { readonly ok: boolean } | null;
  readonly excluded?: boolean;
  /** Which planned repeat of the point this is (1-based). Used with `pointId` and `attemptIndex` to find rescans. */
  readonly repeatIndex?: number;
  /** 1 for the first try, 2 for the first rescan, and so on. */
  readonly attemptIndex?: number;
}

export interface PositionSummary {
  readonly key: string;
  readonly pointId: string | null;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Repeats that contribute to the statistics. */
  readonly n: number;
  /** Repeats whose fit failed (not in the statistics). */
  readonly failed: number;
  /** Earlier attempts replaced by a rescan of the same planned repeat (not in the statistics). */
  readonly superseded: number;
  readonly meanHz: number;
  readonly sdHz: number | null;
  readonly semHz: number | null;
  readonly fitUHz: number | null;
  readonly standardUncertaintyHz: number | null;
  readonly coverageFactor: number | null;
  readonly expandedUncertaintyHz: number | null;
  readonly rangeHz: number;
}

/** Two-sided 95 % Student's t critical values for 1 to 30 degrees of freedom. */
const T975 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131,
  2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
export function studentT95(dof: number): number {
  if (!Number.isFinite(dof) || dof < 1) return NaN;
  return dof <= 30 ? T975[Math.floor(dof) - 1] : 1.96;
}

/** Welford's single-pass mean and sample variance. */
export function meanAndSd(values: readonly number[]): { n: number; mean: number; sd: number | null } {
  let n = 0, mean = 0, m2 = 0;
  for (const v of values) { n++; const delta = v - mean; mean += delta / n; m2 += delta * (v - mean); }
  return { n, mean: n ? mean : NaN, sd: n > 1 ? Math.sqrt(m2 / (n - 1)) : null };
}

const q1 = (v: number) => (Math.round(v * 10) / 10 + 0).toFixed(1);
const keyOf = (r: StatRecord) => (r.pointId ? `point:${r.pointId}` : `xyz:${q1(r.x)},${q1(r.y)},${q1(r.z)}`);

/**
 * Groups records by planned point (or by position to 0.1 mm when they were captured by hand) and summarises each
 * group. Pass records oldest-first; groups come back in order of first appearance.
 */
export function summarizePositions(records: readonly StatRecord[]): PositionSummary[] {
  const groups = new Map<string, StatRecord[]>();
  for (const r of records) {
    if (r.excluded || !Number.isFinite(r.resonance)) continue;
    const k = keyOf(r);
    const g = groups.get(k);
    if (g) g.push(r); else groups.set(k, [r]);
  }
  const out: PositionSummary[] = [];
  for (const [key, group] of groups) {
    let all = group, superseded = 0;
    if (group[0].pointId) {
      // Only records that say which repeat and attempt they are can be recognised as rescans.
      const tagged = (r: StatRecord): r is StatRecord & { repeatIndex: number; attemptIndex: number } =>
        r.repeatIndex !== undefined && r.attemptIndex !== undefined;
      const latest = new Map<number, StatRecord & { attemptIndex: number }>();
      for (const r of group) {
        if (!tagged(r)) continue;
        const held = latest.get(r.repeatIndex);
        if (!held || r.attemptIndex >= held.attemptIndex) latest.set(r.repeatIndex, r);
      }
      all = group.filter(r => !tagged(r) || latest.get(r.repeatIndex) === r);
      superseded = group.length - all.length;
    }
    const used = all.filter(r => r.fit?.ok !== false);
    const failed = all.length - used.length;
    const pos = (used.length ? used : all);
    const x = pos.reduce((s, r) => s + r.x, 0) / pos.length, y = pos.reduce((s, r) => s + r.y, 0) / pos.length, z = pos.reduce((s, r) => s + r.z, 0) / pos.length;
    if (!used.length) {
      out.push({ key, pointId: all[0].pointId ?? null, x, y, z, n: 0, failed, superseded, meanHz: NaN, sdHz: null, semHz: null, fitUHz: null,
        standardUncertaintyHz: null, coverageFactor: null, expandedUncertaintyHz: null, rangeHz: 0 });
      continue;
    }
    const f = used.map(r => r.resonance), { n, mean, sd } = meanAndSd(f);
    const us = used.map(r => r.uncertaintyHz).filter((u): u is number => typeof u === 'number' && Number.isFinite(u) && u >= 0);
    const fitU = us.length === n ? Math.sqrt(us.reduce((s, u) => s + u * u, 0)) / n : null;
    const sem = sd === null ? null : sd / Math.sqrt(n);
    let u: number | null, k: number | null;
    if (sem !== null && (fitU === null || sem >= fitU)) { u = sem; k = studentT95(n - 1); }
    else if (fitU !== null) { u = fitU; k = 2; }
    else { u = null; k = null; }
    out.push({
      key, pointId: all[0].pointId ?? null, x, y, z, n, failed, superseded, meanHz: mean, sdHz: sd, semHz: sem, fitUHz: fitU,
      standardUncertaintyHz: u, coverageFactor: k, expandedUncertaintyHz: u !== null && k !== null ? u * k : null,
      rangeHz: Math.max(...f) - Math.min(...f),
    });
  }
  return out;
}

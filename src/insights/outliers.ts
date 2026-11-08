// Robust outlier screening with the modified z-score (median and MAD), which a single bad value cannot hide from.

export interface OutlierFlag { readonly index: number; readonly value: number; readonly score: number }
export interface OutlierResult { readonly n: number; readonly median: number; readonly mad: number; readonly flags: OutlierFlag[] }

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Iglewicz-Hoaglin modified z-score. 3.5 is the usual cut-off. Needs at least 3 finite values. */
export function screenOutliers(values: readonly number[], threshold = 3.5): OutlierResult {
  const idx: number[] = [], v: number[] = [];
  values.forEach((x, i) => { if (Number.isFinite(x)) { idx.push(i); v.push(x); } });
  if (v.length < 3) return { n: v.length, median: v.length ? median(v) : NaN, mad: NaN, flags: [] };
  const med = median(v), mad = median(v.map(x => Math.abs(x - med)));
  const meanAd = v.reduce((a, x) => a + Math.abs(x - med), 0) / v.length;
  const flags: OutlierFlag[] = [];
  v.forEach((x, k) => {
    const dev = Math.abs(x - med);
    if (dev === 0) return;
    // MAD of 0 happens when more than half the values agree; fall back to the mean absolute deviation then.
    const score = mad > 0 ? 0.6745 * dev / mad : dev / (1.253314 * meanAd);
    if (score > threshold) flags.push({ index: idx[k], value: x, score });
  });
  return { n: v.length, median: med, mad, flags };
}

export interface ScreenRecord { readonly x: number; readonly y: number; readonly z: number; readonly pointId?: string | null; readonly resonance: number; readonly excluded?: boolean }
export interface RecordOutlier { readonly recordIndex: number; readonly position: string; readonly resonance: number; readonly score: number; readonly medianHz: number }

const q1 = (v: number) => (Math.round(v * 10) / 10 + 0).toFixed(1);
/** Screens the repeats at each position (needs 3 or more) and reports the records that stand apart from their siblings. */
export function screenRecords(records: readonly ScreenRecord[], threshold = 3.5): RecordOutlier[] {
  const groups = new Map<string, number[]>();
  records.forEach((r, i) => {
    if (r.excluded || !Number.isFinite(r.resonance)) return;
    const k = r.pointId ? `point:${r.pointId}` : `xyz:${q1(r.x)},${q1(r.y)},${q1(r.z)}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(i);
  });
  const out: RecordOutlier[] = [];
  for (const [k, ids] of groups) {
    if (ids.length < 3) continue;
    const res = screenOutliers(ids.map(i => records[i].resonance), threshold);
    for (const f of res.flags) {
      const r = records[ids[f.index]];
      out.push({ recordIndex: ids[f.index], position: k.startsWith('xyz:') ? `(${k.slice(4)}) mm` : `${r.x}, ${r.y}, ${r.z} mm`, resonance: r.resonance, score: f.score, medianHz: res.median });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

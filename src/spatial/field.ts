// Spatial field analysis: a weighted linear fit of resonance against position, and a planner that suggests where to
// measure next. Pure functions over plain records.

export interface FieldRecord {
  readonly x: number; readonly y: number; readonly z: number; readonly resonance: number;
  readonly uncertaintyHz?: number; readonly excluded?: boolean; readonly fit?: { readonly ok: boolean } | null;
}
export type Axis = 'x' | 'y' | 'z';
export const AXES: readonly Axis[] = ['x', 'y', 'z'];
export const TRAVEL_MM = 35;

export interface Coefficient { readonly axis: Axis; readonly hzPerMm: number; readonly sigma: number }
export interface FieldFit {
  readonly ok: true;
  readonly interceptHz: number;
  readonly coefficients: readonly Coefficient[];
  /** Axes the data cannot constrain (too little spread in that coordinate). */
  readonly unconstrained: readonly Axis[];
  readonly rmsResidualHz: number;
  readonly r2: number;
  readonly n: number;
  readonly dof: number;
}
export type FieldFitResult = FieldFit | { readonly ok: false; readonly reason: string };

/** An axis needs at least this spread (mm) in the data before its slope is estimated. */
export const MIN_SPREAD_MM = 2;

function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (!(Math.abs(M[p][c]) > 1e-12)) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}
function invert(A: number[][]): number[][] | null {
  const n = A.length, cols: number[][] = [];
  for (let j = 0; j < n; j++) { const c = solve(A, Array.from({ length: n }, (_, i) => (i === j ? 1 : 0))); if (!c) return null; cols.push(c); }
  return Array.from({ length: n }, (_, i) => cols.map(c => c[i]));
}

const usable = (r: FieldRecord) => !r.excluded && r.fit?.ok !== false && [r.x, r.y, r.z, r.resonance].every(Number.isFinite);

/**
 * Weighted least squares of resonance on the axes that vary, with coefficient uncertainties scaled by the residual
 * scatter. Axes with too little spread are left out and reported as unconstrained rather than given a made-up slope.
 */
export function fitField(records: readonly FieldRecord[]): FieldFitResult {
  const rs = records.filter(usable);
  if (rs.length < 3) return { ok: false, reason: 'At least 3 usable measurements are needed.' };
  const spread = (a: Axis) => Math.max(...rs.map(r => r[a])) - Math.min(...rs.map(r => r[a]));
  const axes = AXES.filter(a => spread(a) >= MIN_SPREAD_MM), unconstrained = AXES.filter(a => !axes.includes(a));
  if (!axes.length) return { ok: false, reason: 'All measurements are at one position, so no slope can be fitted.' };
  const p = axes.length + 1, n = rs.length;
  if (n <= p) return { ok: false, reason: `${p} parameters need more than ${p} measurements (have ${n}).` };
  const center = Object.fromEntries(axes.map(a => [a, rs.reduce((s, r) => s + r[a], 0) / n])) as Record<Axis, number>;
  const row = (r: FieldRecord) => [1, ...axes.map(a => r[a] - center[a])];
  const w = rs.map(r => { const u = r.uncertaintyHz; return u && u > 0 ? 1 / (u * u) : 1; });
  const wmean = w.reduce((s, v) => s + v, 0) / n;
  const wn = w.map(v => v / wmean);
  const XtWX = Array.from({ length: p }, () => new Array<number>(p).fill(0)), XtWy = new Array<number>(p).fill(0);
  rs.forEach((r, i) => { const x = row(r); for (let a = 0; a < p; a++) { XtWy[a] += wn[i] * x[a] * r.resonance; for (let b = 0; b < p; b++) XtWX[a][b] += wn[i] * x[a] * x[b]; } });
  const beta = solve(XtWX, XtWy), inv = invert(XtWX);
  if (!beta || !inv) return { ok: false, reason: 'The positions are collinear in a way the fit cannot separate.' };
  let ssr = 0, sst = 0; const ybar = rs.reduce((s, r, i) => s + wn[i] * r.resonance, 0) / wn.reduce((s, v) => s + v, 0);
  rs.forEach((r, i) => { const x = row(r); const pred = x.reduce((s, v, k) => s + v * beta[k], 0); ssr += wn[i] * (r.resonance - pred) ** 2; sst += wn[i] * (r.resonance - ybar) ** 2; });
  const dof = n - p, s2 = ssr / dof;
  const coefficients = axes.map((a, k) => ({ axis: a, hzPerMm: beta[k + 1], sigma: Math.sqrt(Math.max(0, s2 * inv[k + 1][k + 1])) }));
  const interceptHz = beta[0] - axes.reduce((s, a, k) => s + beta[k + 1] * center[a], 0) + 0;
  return { ok: true, interceptHz, coefficients, unconstrained, rmsResidualHz: Math.sqrt(ssr / n), r2: sst > 0 ? 1 - ssr / sst : 0, n, dof };
}

export interface Suggestion { readonly x: number; readonly y: number; readonly z: number; readonly nearestMm: number; readonly reason: string }
const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const grid = (step: number) => { const v: number[] = []; for (let t = -TRAVEL_MM; t <= TRAVEL_MM + 1e-9; t += step) v.push(Math.round(t * 100) / 100); return v; };

/** Share of the stage cube lying within `radiusMm` of a measured point (deterministic 5 mm sampling). */
export function coverage(records: readonly FieldRecord[], radiusMm = 10): number {
  const pts = records.filter(usable), g = grid(5);
  if (!pts.length) return 0;
  let inside = 0, total = 0;
  for (const x of g) for (const y of g) for (const z of g) { total++; if (pts.some(p => dist(p, { x, y, z }) <= radiusMm)) inside++; }
  return inside / total;
}

/**
 * Next points to measure: a maximin choice that always picks the grid point farthest from everything measured (or
 * already suggested), so the list spreads out. Early on it reaches the corners, which also pins down the slopes best.
 */
export function suggestPoints(records: readonly FieldRecord[], count = 5, stepMm = 10): Suggestion[] {
  const have = records.filter(usable).map(r => ({ x: r.x, y: r.y, z: r.z })), out: Suggestion[] = [];
  const g = grid(stepMm), cands = g.flatMap(x => g.flatMap(y => g.map(z => ({ x, y, z }))));
  const taken = [...have];
  if (!have.length && count > 0) { out.push({ x: 0, y: 0, z: 0, nearestMm: Infinity, reason: 'Start at the centre of the stage.' }); taken.push({ x: 0, y: 0, z: 0 }); }
  for (let k = out.length; k < count; k++) {
    let best: { x: number; y: number; z: number } | null = null, bestD = -1;
    for (const c of cands) {
      const d = taken.length ? Math.min(...taken.map(t => dist(t, c))) : Math.hypot(c.x, c.y, c.z);
      const tie = Math.abs(d - bestD) < 1e-9;
      if (d > bestD + 1e-9 || (tie && best && Math.hypot(c.x, c.y, c.z) < Math.hypot(best.x, best.y, best.z))) { bestD = d; best = c; }
    }
    if (!best || bestD < stepMm / 2) break;
    out.push({ ...best, nearestMm: bestD, reason: `${bestD.toFixed(0)} mm from the nearest measurement or earlier suggestion.` });
    taken.push(best);
  }
  return out;
}

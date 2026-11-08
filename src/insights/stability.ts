// Stability analysis of a reading over time: overlapping Allan deviation and a least-squares drift estimate.
// Pure functions; nothing here touches the UI.

export interface AllanPoint { readonly tauS: number; readonly adev: number; readonly n: number }

/**
 * Overlapping Allan deviation of regularly sampled values (for example the fitted resonance in Hz, one sample every
 * `tau0S` seconds). The averaging factor m runs through powers of two while at least two averages fit. The result is
 * in the same unit as the input. Non-finite samples are dropped first, so gaps shorten the series rather than poison it.
 */
export function overlappingAllan(values: readonly number[], tau0S: number): AllanPoint[] {
  const y = values.filter(Number.isFinite);
  const N = y.length;
  if (!(tau0S > 0) || N < 3) return [];
  const cum = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) cum[i + 1] = cum[i] + y[i];
  const out: AllanPoint[] = [];
  for (let m = 1; 2 * m <= N - 1; m *= 2) {
    const J = N - 2 * m + 1;              // number of overlapping differences (at least 2)
    let sum = 0;
    for (let j = 0; j < J; j++) {
      const a = (cum[j + m] - cum[j]) / m, b = (cum[j + 2 * m] - cum[j + m]) / m;
      sum += (b - a) * (b - a);
    }
    out.push({ tauS: m * tau0S, adev: Math.sqrt(sum / (2 * J)), n: J });
  }
  return out;
}

export type NoiseKind = 'white' | 'flicker' | 'random-walk' | 'unclear';
/** Slope of log(adev) against log(tau) over the whole curve, with a plain-language reading of it. */
export function noiseHint(points: readonly AllanPoint[]): { slope: number | null; kind: NoiseKind; text: string } {
  const p = points.filter(q => q.adev > 0 && q.tauS > 0);
  if (p.length < 3) return { slope: null, kind: 'unclear', text: 'Not enough averaging times to read a noise type yet.' };
  const xs = p.map(q => Math.log(q.tauS)), ys = p.map(q => Math.log(q.adev));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const slope = den > 0 ? num / den : 0;
  if (slope < -0.25) return { slope, kind: 'white', text: 'Falling with averaging time: mostly white noise, so averaging longer helps.' };
  if (slope <= 0.25) return { slope, kind: 'flicker', text: 'Flat: a flicker floor. Averaging longer will not improve it.' };
  return { slope, kind: 'random-walk', text: 'Rising with averaging time: drift or random walk dominates. Average less, or fix the drift.' };
}

export interface Trend { readonly n: number; readonly slopePerS: number; readonly slopeSe: number; readonly intercept: number; readonly r2: number }
/** Ordinary least squares of y on t. Returns null with fewer than 3 usable points or no spread in t. */
export function linearTrend(t: readonly number[], y: readonly number[]): Trend | null {
  const pts: [number, number][] = [];
  for (let i = 0; i < Math.min(t.length, y.length); i++) if (Number.isFinite(t[i]) && Number.isFinite(y[i])) pts.push([t[i], y[i]]);
  const n = pts.length; if (n < 3) return null;
  const mt = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const [a, b] of pts) { sxx += (a - mt) ** 2; sxy += (a - mt) * (b - my); syy += (b - my) ** 2; }
  if (sxx === 0) return null;
  const slope = sxy / sxx, intercept = my - slope * mt;
  let sse = 0; for (const [a, b] of pts) sse += (b - (intercept + slope * a)) ** 2;
  const slopeSe = Math.sqrt(sse / (n - 2) / sxx);
  return { n, slopePerS: slope, slopeSe, intercept, r2: syy === 0 ? 1 : 1 - sse / syy };
}

export type DriftVerdict = 'insufficient' | 'stable' | 'drifting';
/** "Drifting" needs the slope to stand clear of its own error (|slope| > 3 se) and to move more than `minChange` over the window. */
export function driftVerdict(trend: Trend | null, spanS: number, minChange: number): DriftVerdict {
  if (!trend || !(spanS > 0)) return 'insufficient';
  const change = Math.abs(trend.slopePerS) * spanS;
  return Math.abs(trend.slopePerS) > 3 * trend.slopeSe && change > minChange ? 'drifting' : 'stable';
}

/** Standard uncertainty (rectangular) that an unknown drift of `slopePerS` over `durationS` adds to a mean. */
export const driftUncertainty = (slopePerS: number, durationS: number): number => (Number.isFinite(slopePerS) && durationS > 0 ? Math.abs(slopePerS) * durationS / 2 / Math.sqrt(3) : 0);

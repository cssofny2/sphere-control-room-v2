// Resonance measurement: fits a Lorentzian dip to an S11 trace and reports the resonance frequency, Q and their
// statistical uncertainties from the fit covariance. This replaces "take the lowest sample" and fixed placeholders.
//
// Model (the S11 magnitude in dB near one resonance):  s(f) = a + d / (1 + ((f - f0) / g)^2)
//   a = baseline (dB), d = dip depth (negative, dB), f0 = resonance (Hz), g = half width at half depth (Hz),
//   Q = f0 / (2 g) = f0 / FWHM.
// Only the statistical (Type A) uncertainty of the fit is reported. Systematic contributions (reference clock,
// calibration, stage position) are not modelled and must not be read as part of this number.

export type FitFailureReason = 'too_few_points' | 'no_dip' | 'under_resolved' | 'out_of_band' | 'singular' | 'not_converged';

export interface LorentzianFit {
  readonly ok: true;
  readonly f0Hz: number;
  readonly sigmaF0Hz: number;
  readonly q: number;
  readonly sigmaQ: number;
  readonly fwhmHz: number;
  readonly baselineDb: number;
  /** Fitted S11 at the bottom of the dip (baseline plus depth). */
  readonly minDb: number;
  readonly rmsResidualDb: number;
  readonly r2: number;
  readonly points: number;
  readonly dof: number;
  readonly iterations: number;
}
export interface FitFailure { readonly ok: false; readonly reason: FitFailureReason; readonly message: string }
export type FitResult = LorentzianFit | FitFailure;

const fail = (reason: FitFailureReason, message: string): FitFailure => ({ ok: false, reason, message });

const median = (v: readonly number[]): number => {
  if (!v.length) return NaN;
  const s = [...v].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const percentile = (v: readonly number[], p: number): number => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
};

/** Solves A x = b by Gaussian elimination with partial pivoting; null when A is (numerically) singular. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (!(Math.abs(M[piv][c]) > 1e-300)) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      if (f !== 0) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x.every(Number.isFinite) ? x : null;
}
function invert(A: number[][]): number[][] | null {
  const n = A.length, cols: number[][] = [];
  for (let j = 0; j < n; j++) {
    const col = solve(A, Array.from({ length: n }, (_, i) => (i === j ? 1 : 0)));
    if (!col) return null;
    cols.push(col);
  }
  return Array.from({ length: n }, (_, i) => cols.map(c => c[i]));
}

const MAX_ITERATIONS = 200;

/**
 * Least-squares fit of the Lorentzian dip with Levenberg-Marquardt. Works in coordinates scaled to the sweep so
 * the 4x4 normal equations stay well conditioned for frequencies in the hundreds of kilohertz.
 */
export function fitLorentzianDip(freq: ArrayLike<number>, s11: ArrayLike<number>): FitResult {
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i < freq.length; i++) if (Number.isFinite(freq[i]) && Number.isFinite(s11[i])) { xs.push(freq[i]); ys.push(s11[i]); }
  const n = xs.length;
  if (n < 8) return fail('too_few_points', `A fit needs at least 8 finite trace points; this trace has ${n}.`);

  let fmin = Infinity, fmax = -Infinity;
  for (const f of xs) { if (f < fmin) fmin = f; if (f > fmax) fmax = f; }
  const fc = (fmin + fmax) / 2, h = (fmax - fmin) / 2;
  if (!(h > 0)) return fail('too_few_points', 'The sweep has no frequency span.');
  const t = xs.map(f => (f - fc) / h);

  // Starting values from a lightly smoothed trace.
  const sm = ys.map((_, i) => { let s = 0, c = 0; for (let k = Math.max(0, i - 2); k <= Math.min(n - 1, i + 2); k++) { s += ys[k]; c++; } return s / c; });
  let imin = 0;
  for (let i = 1; i < n; i++) if (sm[i] < sm[imin]) imin = i;
  const a0 = percentile(ys, 0.85), d0 = sm[imin] - a0;
  const steps = t.slice(1).map((v, i) => Math.abs(v - t[i])).filter(v => v > 0);
  const spacing = median(steps) || 2 / n;
  const diffs = ys.slice(1).map((v, i) => v - ys[i]), md = median(diffs);
  const noise0 = 1.4826 * median(diffs.map(v => Math.abs(v - md))) / Math.SQRT2;
  const needed = Math.max(0.5, 5 * (Number.isFinite(noise0) ? noise0 : 0));
  if (!(d0 < -needed)) return fail('no_dip', `No resonance dip stands out: the deepest point is ${(-d0).toFixed(2)} dB below the baseline against about ${needed.toFixed(2)} dB of noise.`);
  const below = t.filter((_, i) => sm[i] < a0 + d0 / 2);
  const gMin = spacing / 4, gMax = 20;
  let g0 = below.length > 1 ? (Math.max(...below) - Math.min(...below)) / 2 : spacing;
  g0 = Math.min(gMax / 2, Math.max(g0, spacing / 2));

  let p = [a0, d0, t[imin], g0];
  const model = (q: number[], ti: number) => { const u = (ti - q[2]) / q[3]; return q[0] + q[1] / (1 + u * u); };
  const ssrOf = (q: number[]) => { let s = 0; for (let i = 0; i < n; i++) { const r = ys[i] - model(q, t[i]); s += r * r; } return s; };
  const normal = (q: number[]) => {
    const JtJ = Array.from({ length: 4 }, () => new Array<number>(4).fill(0)), Jtr = [0, 0, 0, 0], J = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      const u = (t[i] - q[2]) / q[3], den = 1 + u * u, L = 1 / den, k = 2 * u / (q[3] * den * den);
      J[0] = 1; J[1] = L; J[2] = q[1] * k; J[3] = q[1] * k * u;
      const r = ys[i] - (q[0] + q[1] * L);
      for (let a = 0; a < 4; a++) { Jtr[a] += J[a] * r; for (let b = a; b < 4; b++) JtJ[a][b] += J[a] * J[b]; }
    }
    for (let a = 0; a < 4; a++) for (let b = 0; b < a; b++) JtJ[a][b] = JtJ[b][a];
    return { JtJ, Jtr };
  };

  let ssr = ssrOf(p), lambda = 1e-3, iterations = 0, converged = false;
  while (iterations < MAX_ITERATIONS && !converged) {
    iterations++;
    const { JtJ, Jtr } = normal(p);
    let improved = false;
    while (lambda < 1e12) {
      const A = JtJ.map((row, i) => row.map((v, j) => (i === j ? v + lambda * Math.max(v, 1e-12) : v)));
      const step = solve(A, Jtr);
      if (step) {
        const q = p.map((v, i) => v + step[i]);
        if (q[3] > gMin * 0.5 && q[3] < gMax * 2 && Number.isFinite(q[2])) {
          const s2 = ssrOf(q);
          if (s2 < ssr) {
            const gain = ssr - s2;
            p = q; ssr = s2; lambda = Math.max(lambda / 10, 1e-12); improved = true;
            if (gain <= 1e-12 * (ssr + 1e-12) || Math.hypot(...step) < 1e-12) converged = true;
            break;
          }
        }
      }
      lambda *= 10;
    }
    if (!improved) converged = true; // no step lowers the error: numerically at the minimum
  }
  if (!converged) return fail('not_converged', `The fit did not settle after ${MAX_ITERATIONS} iterations.`);

  const [a, d, t0, g] = p;
  if (!(d < 0)) return fail('no_dip', 'The fit found a peak, not a dip.');
  if (g >= gMax * 0.999) return fail('no_dip', 'The dip is wider than the sweep, so its baseline cannot be found.');
  if (g <= gMin * 1.001) return fail('under_resolved', 'The dip is narrower than the trace point spacing.');
  if (Math.abs(t0) > 1) return fail('out_of_band', 'The resonance centre lies outside the sweep range.');
  let core = 0;
  for (const ti of t) if (Math.abs(ti - t0) <= 2 * g) core++;
  if (core < 5) return fail('under_resolved', `Only ${core} trace points fall within the dip core; at least 5 are needed.`);

  const dof = n - 4;
  if (dof < 1) return fail('too_few_points', 'No degrees of freedom are left to estimate the uncertainty.');
  const cov = invert(normal(p).JtJ);
  if (!cov) return fail('singular', 'The fit is degenerate, so its uncertainty cannot be estimated.');
  const s2 = ssr / dof;
  const varT0 = s2 * cov[2][2], varG = s2 * cov[3][3], covT0G = s2 * cov[2][3];
  if (!(varT0 >= 0) || !(varG >= 0)) return fail('singular', 'The fit covariance is not valid.');

  const f0 = fc + h * t0, gamma = h * g, q = f0 / (2 * gamma);
  const relQ = (h * Math.sqrt(varT0) / f0) ** 2 + (h * Math.sqrt(varG) / gamma) ** 2 - 2 * (h * h * covT0G) / (f0 * gamma);
  const mean = ys.reduce((s, v) => s + v, 0) / n;
  let sst = 0;
  for (const v of ys) sst += (v - mean) ** 2;
  return {
    ok: true, f0Hz: f0, sigmaF0Hz: h * Math.sqrt(varT0), q, sigmaQ: q * Math.sqrt(Math.max(0, relQ)),
    fwhmHz: 2 * gamma, baselineDb: a, minDb: a + d, rmsResidualDb: Math.sqrt(ssr / n),
    r2: sst > 0 ? 1 - ssr / sst : 0, points: n, dof, iterations,
  };
}

export interface TracePointLike { freq: number; s11: number; raw?: number }

export interface TraceFit {
  readonly fit: FitResult;
  /** Fitted curve at every trace frequency, or null when the fit failed. */
  readonly curve: readonly number[] | null;
  /** True when trace math (reference, difference, ratio) means the screen no longer shows the fitted quantity. */
  readonly displayDiffers: boolean;
}

const traceCache = new WeakMap<object, TraceFit>();

/** Fits the measured (pre-trace-math) values of a trace. Cached per trace array, so every view shares one fit. */
export function fitTrace(trace: readonly TracePointLike[]): TraceFit {
  const hit = traceCache.get(trace);
  if (hit) return hit;
  const freq = trace.map(p => p.freq), raw = trace.map(p => (p.raw !== undefined ? p.raw : p.s11));
  const fit = fitLorentzianDip(freq, raw);
  let curve: number[] | null = null;
  if (fit.ok) {
    const gamma = fit.fwhmHz / 2, d = fit.minDb - fit.baselineDb;
    curve = freq.map(f => { const u = (f - fit.f0Hz) / gamma; return fit.baselineDb + d / (1 + u * u); });
  }
  const result: TraceFit = { fit, curve, displayDiffers: trace.some(p => p.raw !== undefined && p.raw !== p.s11) };
  traceCache.set(trace, result);
  return result;
}

export type FitSummary =
  | Omit<LorentzianFit, 'iterations'>
  | FitFailure;

/** The message of a failed fit, or null for a converged one. A helper because the app compiles without strictNullChecks, where `ok` does not narrow in the else branch. */
export const failureMessage = (fit: FitResult | FitSummary): string | null => ('message' in fit ? fit.message : null);

export interface MeasuredTrace {
  /** Resonance in Hz: the fitted f0, or the lowest sample's frequency when the fit failed. */
  readonly resonance: number;
  readonly resonanceShift: number;
  readonly depth: number;
  readonly q: number;
  /** Standard (k = 1) statistical uncertainty of the resonance in Hz. When the fit failed this is the coarsest point spacing. */
  readonly uncertaintyHz: number;
  readonly fit: FitSummary;
  /** Why the fit failed, or null when it converged (spares callers the discriminated-union narrowing). */
  readonly problem: string | null;
}

/** Turns a trace into the measurement fields stored on an experiment record. */
export function measureTrace(trace: readonly TracePointLike[], baseFrequencyHz: number): MeasuredTrace {
  const { fit } = fitTrace(trace);
  if (fit.ok) {
    const { iterations: _unused, ...summary } = fit;
    void _unused;
    return { resonance: fit.f0Hz, resonanceShift: fit.f0Hz - baseFrequencyHz, depth: fit.minDb, q: fit.q, uncertaintyHz: fit.sigmaF0Hz, fit: summary, problem: null };
  }
  let lowest: TracePointLike | null = null, step = 0;
  trace.forEach((p, i) => {
    const v = p.raw !== undefined ? p.raw : p.s11;
    if (Number.isFinite(v) && (!lowest || v < (lowest.raw !== undefined ? lowest.raw : lowest.s11))) lowest = p;
    if (i > 0) step = Math.max(step, Math.abs(p.freq - trace[i - 1].freq));
  });
  const low = lowest as TracePointLike | null;
  const freq = low ? low.freq : baseFrequencyHz;
  return {
    resonance: freq, resonanceShift: freq - baseFrequencyHz,
    depth: low ? (low.raw !== undefined ? low.raw : low.s11) : 0, q: 0,
    uncertaintyHz: step > 0 ? step : 1000, fit, problem: failureMessage(fit),
  };
}

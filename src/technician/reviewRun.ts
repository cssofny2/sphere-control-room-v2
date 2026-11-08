// A deterministic review of an experiment run: what is sound, what is not, and what to do next. Everything here is
// computed from the recorded measurements, so Dr. Wire (and the Runs page) say the same true things every time.
// Nothing in a review starts a lab action.
import { summarizePositions, type PositionSummary } from '../simulation/stats';
import { coverage, fitField, type FieldRecord } from '../spatial/field';

export type Severity = 'issue' | 'warn' | 'info' | 'good';
export interface Finding { readonly id: string; readonly severity: Severity; readonly title: string; readonly detail: string; readonly action: string }

export interface ReviewRecord extends FieldRecord {
  readonly timestamp?: string;
  readonly pointId?: string | null;
  readonly repeatIndex?: number;
  readonly attemptIndex?: number;
  readonly valid?: boolean;
  readonly temp?: number;
  readonly pressure?: number;
  readonly clockLocked?: boolean;
  readonly faradayEnabled?: boolean;
  readonly isolationEnabled?: boolean;
  readonly vnaCalibrated?: boolean;
}
export interface Review { readonly count: number; readonly positions: number; readonly findings: readonly Finding[] }

const ORDER: Record<Severity, number> = { issue: 0, warn: 1, info: 2, good: 3 };
const at = (p: { x: number; y: number; z: number }) => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}) mm`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Least-squares slope of values against their index, and the slope's standard error. */
function trend(values: readonly number[]): { slope: number; se: number } {
  const n = values.length, mx = (n - 1) / 2, my = values.reduce((s, v) => s + v, 0) / n;
  let sxx = 0, sxy = 0;
  values.forEach((v, i) => { sxx += (i - mx) ** 2; sxy += (i - mx) * (v - my); });
  const slope = sxy / sxx;
  let ssr = 0;
  values.forEach((v, i) => { ssr += (v - (my + slope * (i - mx))) ** 2; });
  return { slope, se: n > 2 ? Math.sqrt(ssr / (n - 2) / sxx) : Infinity };
}

export function reviewRun(input: readonly ReviewRecord[]): Review {
  const records = [...input].filter(r => !r.excluded).sort((a, b) => String(a.timestamp ?? '').localeCompare(String(b.timestamp ?? '')));
  const f: Finding[] = [];
  if (!records.length) return { count: 0, positions: 0, findings: [{ id: 'empty', severity: 'info', title: 'No measurements yet', detail: 'The ledger is empty, so there is nothing to review.', action: 'Power up, calibrate the VNA and start a scan plan.' }] };

  const n = records.length;
  const failedFits = records.filter(r => r.fit?.ok === false).length;
  if (failedFits) f.push({ id: 'fit', severity: failedFits / n > 0.2 ? 'issue' : 'warn', title: `${plural(failedFits, 'resonance fit')} failed`, detail: `${failedFits} of ${n} measurements could not be fitted, so they are left out of the statistics.`, action: 'Check the sweep range covers the resonance and that RF is on, then repeat those points.' });

  const count = (p: (r: ReviewRecord) => boolean) => records.filter(p).length;
  const unlocked = count(r => r.clockLocked === false);
  if (unlocked) f.push({ id: 'clock', severity: 'issue', title: 'Reference clock was not locked', detail: `${unlocked} of ${n} measurements were taken without the Rubidium lock, which shifts and blurs the resonance.`, action: 'Wait for the clock to lock before measuring, then redo those points.' });
  const noShield = count(r => r.faradayEnabled === false), noIso = count(r => r.isolationEnabled === false), uncal = count(r => r.vnaCalibrated === false);
  if (noShield) f.push({ id: 'shield', severity: 'warn', title: 'Faraday cage was off', detail: `${noShield} measurements let outside radio noise into the trace.`, action: 'Switch the cage on and repeat them.' });
  if (noIso) f.push({ id: 'isolation', severity: 'warn', title: 'Vibration isolation was off', detail: `${noIso} measurements were taken with the isolation platform bypassed.`, action: 'Float the platform before measuring.' });
  if (uncal) f.push({ id: 'cal', severity: 'warn', title: 'VNA was not calibrated', detail: `${uncal} measurements were taken uncalibrated or after the calibration expired.`, action: 'Run the calibration wizard and repeat them.' });
  const invalid = count(r => r.valid === false);
  if (invalid && invalid / n > 0.3) f.push({ id: 'invalid', severity: 'warn', title: 'Many measurements failed validation', detail: `${invalid} of ${n} were marked suspect or invalid when they were taken.`, action: 'Look at which validation rules failed in the Operator Console and fix them first.' });

  const temps = records.map(r => r.temp).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (temps.length > 1 && Math.max(...temps) - Math.min(...temps) > 0.1) f.push({ id: 'temp', severity: 'warn', title: 'Temperature moved during the run', detail: `The chamber ranged over ${(Math.max(...temps) - Math.min(...temps)).toFixed(2)} °C, and temperature shifts the resonance.`, action: 'Let the thermostat settle before each point, or note the temperature with the result.' });
  const press = records.map(r => r.pressure).filter((v): v is number => typeof v === 'number' && v > 0);
  if (press.length && Math.max(...press) > 1e-3) f.push({ id: 'pressure', severity: 'warn', title: 'Pressure was above the vacuum threshold', detail: `The highest pressure was ${Math.max(...press).toExponential(1)} Torr; air loading lowers Q and shifts the resonance.`, action: 'Pump down below 1e-3 Torr before measuring.' });

  const sums = summarizePositions(records);
  const repeated = sums.filter(s => s.n >= 2);
  if (sums.length && !repeated.length) f.push({ id: 'repeats', severity: 'info', title: 'No repeated positions', detail: 'Each position was measured once, so scatter between repeats cannot be separated from a real location effect.', action: 'Set repeats per position to at least 3 in the plan.' });
  const unstable = repeated.filter((s): s is PositionSummary & { sdHz: number; fitUHz: number } => s.sdHz !== null && s.fitUHz !== null && s.fitUHz > 0 && s.sdHz > 3 * s.fitUHz && s.sdHz > 0.05);
  if (unstable.length) {
    const w = [...unstable].sort((a, b) => b.sdHz / b.fitUHz - a.sdHz / a.fitUHz)[0];
    f.push({ id: 'scatter', severity: 'warn', title: 'Repeats scatter more than the fit allows', detail: `At ${at(w)} the repeats differ by SD ${w.sdHz.toFixed(3)} Hz, ${(w.sdHz / w.fitUHz).toFixed(0)} times the fit uncertainty (${w.fitUHz.toFixed(3)} Hz). Something changed between repeats: drift, stage settling or the environment.`, action: 'Wait for the stage to settle and the temperature to hold, and randomize the order.' });
  }
  for (const s of repeated.filter(r => r.n >= 3)) {
    const vals = records.filter(r => (s.pointId ? r.pointId === s.pointId : Math.abs(r.x - s.x) < 0.15 && Math.abs(r.y - s.y) < 0.15 && Math.abs(r.z - s.z) < 0.15) && r.fit?.ok !== false).map(r => r.resonance);
    if (vals.length < 3) continue;
    const t = trend(vals), drift = t.slope * (vals.length - 1);
    if (Number.isFinite(t.se) && Math.abs(t.slope) > 3 * t.se && Math.abs(drift) > 0.1) { f.push({ id: 'drift', severity: 'warn', title: 'Resonance drifted across repeats', detail: `At ${at(s)} it moved ${drift >= 0 ? 'up' : 'down'} ${Math.abs(drift).toFixed(2)} Hz over ${vals.length} repeats in one direction, which points to drift rather than noise.`, action: 'Randomize the order so drift is not mistaken for a location effect.' }); break; }
  }

  const field = fitField(records);
  if (field.ok) {
    const parts = field.coefficients.map(c => `${c.axis.toUpperCase()} ${c.hzPerMm.toFixed(1)} ± ${c.sigma.toFixed(1)} Hz/mm`).join(', ');
    f.push({ id: 'field', severity: 'good', title: 'Position dependence is measurable', detail: `A straight-line fit gives ${parts} (R² ${field.r2.toFixed(3)}).`, action: field.unconstrained.length ? `Move along ${field.unconstrained.map(a => a.toUpperCase()).join(' and ')} too, so those slopes are known.` : 'Check the next suggested points on the Spatial Field page to tighten it.' });
    if (field.unconstrained.length) f.push({ id: 'axes', severity: 'info', title: `No spread along ${field.unconstrained.map(a => a.toUpperCase()).join(', ')}`, detail: 'Those axes never moved by 2 mm or more, so nothing can be said about how the resonance depends on them.', action: `Add points that change ${field.unconstrained.map(a => a.toUpperCase()).join(' and ')}.` });
  }
  const cov = coverage(records);
  if (sums.length >= 5 && cov < 0.05) f.push({ id: 'coverage', severity: 'info', title: 'Little of the stage is covered', detail: `Only ${(cov * 100).toFixed(1)} % of the stage volume is within 10 mm of a measurement.`, action: 'Use the suggested next points on the Spatial Field page.' });

  if (!f.some(x => x.severity === 'issue' || x.severity === 'warn')) f.unshift({ id: 'sound', severity: 'good', title: 'The run looks sound', detail: `${plural(n, 'measurement')} across ${plural(sums.length, 'position')} with no problems in the recorded conditions or the repeat scatter.`, action: 'Add positions or repeats if you need a tighter answer.' });
  f.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  return { count: n, positions: sums.length, findings: f };
}

/** What Dr. Wire says: the run in a sentence, the biggest problem with the fix, and one more thing. */
export function spokenReview(r: Review, name?: string): string {
  const lead = name ? `${name}, ` : '';
  if (!r.count) return `${lead}there is nothing in the ledger yet. Power up, calibrate the VNA, and start a scan plan, then ask me again.`;
  const [first, second] = r.findings;
  const head = `${lead}I looked at ${r.count} measurements across ${r.positions} position${r.positions === 1 ? '' : 's'}.`;
  const body = first.severity === 'good' ? `${first.title}. ${first.detail}` : `${first.title}. ${first.detail} I would ${first.action.charAt(0).toLowerCase()}${first.action.slice(1)}`;
  const more = second && second.severity !== 'good' ? ` Also: ${second.title.toLowerCase()}.` : '';
  return `${head} ${body}${more}`.replace(/\s+/g, ' ').trim();
}

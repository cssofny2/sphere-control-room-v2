// Run comparison: matches positions across runs, differences them against a baseline run with their uncertainties, and
// lists the lab conditions that differed. Pure functions; the UI only draws the result.
import { summarizePositions, type PositionSummary, type StatRecord } from '../simulation/stats';

export interface CompareRecord extends StatRecord {
  readonly temp?: number;
  readonly pressure?: number;
  readonly clockLocked?: boolean;
  readonly faradayEnabled?: boolean;
  readonly isolationEnabled?: boolean;
  readonly vnaCalibrated?: boolean;
  readonly modelVersion?: string;
  readonly timestamp?: string;
}
export interface RunInput { readonly label: string; readonly records: readonly CompareRecord[] }

export interface Cell { readonly meanHz: number; readonly uHz: number | null; readonly n: number }
export interface Row {
  readonly key: string; readonly x: number; readonly y: number; readonly z: number;
  /** One entry per run, null where that run has no usable measurement at the position. */
  readonly cells: ReadonlyArray<Cell | null>;
  /** Difference from the baseline run (run 0), per run; null for the baseline or a missing side. */
  readonly deltas: ReadonlyArray<{ readonly deltaHz: number; readonly uHz: number | null; readonly z: number | null; readonly significant: boolean } | null>;
}
export interface ConditionDiff { readonly name: string; readonly values: readonly string[] }
export interface Comparison {
  readonly labels: readonly string[];
  readonly rows: readonly Row[];
  readonly axis: 'x' | 'y' | 'z';
  readonly conditions: readonly ConditionDiff[];
  readonly matched: number;
  readonly meanDeltaHz: ReadonlyArray<number | null>;
  readonly notes: readonly string[];
}

/** |z| above this counts as a difference larger than the combined uncertainty (about 95 %). */
export const SIGNIFICANT_Z = 2;
const q1 = (v: number) => (Math.round(v * 10) / 10 + 0).toFixed(1);
const keyOf = (s: PositionSummary) => `${q1(s.x)},${q1(s.y)},${q1(s.z)}`;
const median = (v: number[]) => { if (!v.length) return NaN; const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function conditionsOf(records: readonly CompareRecord[]) {
  const frac = (f: (r: CompareRecord) => boolean | undefined) => { const v = records.map(f).filter((x): x is boolean => typeof x === 'boolean'); return v.length ? v.filter(Boolean).length / v.length : NaN; };
  return {
    temp: median(records.map(r => r.temp).filter(finite)), pressure: median(records.map(r => r.pressure).filter(finite)),
    clock: frac(r => r.clockLocked), faraday: frac(r => r.faradayEnabled), isolation: frac(r => r.isolationEnabled), calibrated: frac(r => r.vnaCalibrated),
    models: [...new Set(records.map(r => r.modelVersion).filter((m): m is string => !!m))].sort().join(', '),
  };
}
const pct = (v: number) => (Number.isNaN(v) ? 'unknown' : v === 1 ? 'always' : v === 0 ? 'never' : `${Math.round(v * 100)} % of records`);

export function compareRuns(runs: readonly RunInput[]): Comparison {
  const sums = runs.map(r => new Map(summarizePositions([...r.records].sort((a, b) => String(a.timestamp ?? '').localeCompare(String(b.timestamp ?? '')))).filter(s => s.n > 0).map(s => [keyOf(s), s])));
  const keys = new Set<string>(); sums.forEach(m => m.forEach((_, k) => keys.add(k)));
  const cell = (s?: PositionSummary): Cell | null => (s ? { meanHz: s.meanHz, uHz: s.standardUncertaintyHz, n: s.n } : null);
  const rows: Row[] = [...keys].map(key => {
    const any = sums.map(m => m.get(key)).find(Boolean) as PositionSummary;
    const cells = sums.map(m => cell(m.get(key)));
    const base = cells[0];
    const deltas = cells.map((c, i) => {
      if (i === 0 || !c || !base) return null;
      const d = c.meanHz - base.meanHz, u = c.uHz !== null && base.uHz !== null ? Math.hypot(c.uHz, base.uHz) : null;
      const z = u !== null && u > 0 ? d / u : null;
      return { deltaHz: d, uHz: u, z, significant: z !== null && Math.abs(z) > SIGNIFICANT_Z };
    });
    return { key, x: any.x, y: any.y, z: any.z, cells, deltas };
  }).sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z);

  const span = (f: (r: Row) => number) => (rows.length ? Math.max(...rows.map(f)) - Math.min(...rows.map(f)) : 0);
  const spans = { x: span(r => r.x), y: span(r => r.y), z: span(r => r.z) };
  const axis = (Object.keys(spans) as Array<'x' | 'y' | 'z'>).sort((a, b) => spans[b] - spans[a])[0];

  const meanDeltaHz = runs.map((_, i) => { const d = rows.map(r => r.deltas[i]?.deltaHz).filter(finite); return i === 0 || !d.length ? null : d.reduce((s, v) => s + v, 0) / d.length; });
  const matched = rows.filter(r => r.cells.every(Boolean)).length;

  const cs = runs.map(r => conditionsOf(r.records)), conditions: ConditionDiff[] = [];
  const add = (name: string, vals: string[]) => { if (new Set(vals).size > 1) conditions.push({ name, values: vals }); };
  const tempVals = cs.map(c => c.temp), presVals = cs.map(c => c.pressure);
  if (tempVals.filter(Number.isFinite).length > 1 && Math.max(...tempVals.filter(Number.isFinite)) - Math.min(...tempVals.filter(Number.isFinite)) > 0.05) conditions.push({ name: 'Temperature (median)', values: tempVals.map(v => (Number.isFinite(v) ? `${v.toFixed(2)} °C` : 'unknown')) });
  const pv = presVals.filter(v => Number.isFinite(v) && v > 0);
  if (pv.length > 1 && Math.max(...pv) / Math.min(...pv) > 3) conditions.push({ name: 'Pressure (median)', values: presVals.map(v => (Number.isFinite(v) ? `${v.toExponential(1)} Torr` : 'unknown')) });
  add('Reference clock locked', cs.map(c => pct(c.clock)));
  add('Faraday cage on', cs.map(c => pct(c.faraday)));
  add('Vibration isolation on', cs.map(c => pct(c.isolation)));
  add('VNA calibrated', cs.map(c => pct(c.calibrated)));
  add('Model version', cs.map(c => c.models || 'unknown'));

  const notes: string[] = [];
  if (runs.length < 2) notes.push('Pick at least two runs to compare.');
  else if (!matched && rows.length) notes.push('The runs share no measured position, so they cannot be differenced.');
  runs.forEach((_, i) => {
    if (i === 0) return;
    const sig = rows.filter(r => r.deltas[i]?.significant).length, tot = rows.filter(r => r.deltas[i]).length;
    if (tot) notes.push(`${runs[i].label} vs ${runs[0].label}: ${sig} of ${tot} shared positions differ by more than twice their combined uncertainty; mean difference ${meanDeltaHz[i]!.toFixed(3)} Hz.`);
  });
  if (conditions.length) notes.push(`Conditions that differ: ${conditions.map(c => c.name).join(', ')}. A difference in resonance may follow from these rather than from position.`);
  else if (runs.length > 1 && rows.length) notes.push('No recorded condition differs between these runs.');
  return { labels: runs.map(r => r.label), rows, axis, conditions, matched, meanDeltaHz, notes };
}

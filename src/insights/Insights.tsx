import { memo, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { telemetrySnapshot } from '../features/Timeline';
import { EmptyState } from '../features/UiBits';
import { fmtNum } from '../features/format';
import { useUnits } from '../features/useUnits';
import { fromTorr, fromCelsius } from '../features/units';
import { toast } from '../features/toast';
import { driftUncertainty, driftVerdict, linearTrend, noiseHint, overlappingAllan } from './stability';
import { screenRecords } from './outliers';
import { runBudget } from './budget';
import { conformance, validSpec, type Spec } from './conformance';
import { countByLevel, eventsCsv, filterEvents, subsystemsOf, type LogEvent } from './eventLog';
import { reportHtml } from './report';
import { safeFilename } from '../features/exportImage';

type Rec = { x: number; y: number; z: number; resonance: number; uncertaintyHz?: number; fit?: { ok: boolean } | null; excluded?: boolean; pointId?: string | null; repeatIndex?: number; attemptIndex?: number; runId?: string };

const download = (name: string, type: string, text: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
const Card = ({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) => (
  <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
    <h3 className="mb-2 border-b border-zinc-800 pb-2 text-xs font-bold uppercase text-zinc-300">{title}</h3>{children}{note && <p className="mt-2 text-xs text-zinc-500">{note}</p>}
  </section>
);

/** Analysis built from the live readings and the measurement ledger: stability, outliers, uncertainty budget, conformity, journal and a printable report. */
export const Insights = memo(function Insights({ records, events, operator }: { records: Rec[]; events: LogEvent[]; operator?: string }) {
  const units = useUnits();
  const [tick, setTick] = useState(0);
  const [series, setSeries] = useState<'f0' | 'p' | 'c'>('f0');
  const [target, setTarget] = useState(''), [tol, setTol] = useState('1');
  const [levels, setLevels] = useState<string[]>([]), [sub, setSub] = useState(''), [query, setQuery] = useState('');
  const [notes, setNotes] = useState('');

  const samples = useMemo(() => telemetrySnapshot(), [tick, records.length]);
  const pick = (s: (typeof samples)[number]) => (series === 'f0' ? s.f0Hz : series === 'p' ? fromTorr(s.pressureTorr, units.pressure) : fromCelsius(s.temperatureC, units.temperature));
  const unit = series === 'f0' ? 'Hz' : series === 'p' ? units.pressure : units.temperature;
  const ys = samples.map(pick), ts = samples.map(s => s.t);
  const allan = useMemo(() => overlappingAllan(ys, 1), [samples, series, units]);
  const hint = noiseHint(allan);
  const trend = useMemo(() => linearTrend(ts, ys), [samples, series, units]);
  const span = ts.length ? ts[ts.length - 1] - ts[0] : 0;
  const spread = ys.filter(Number.isFinite).length ? Math.max(...ys.filter(Number.isFinite) as number[]) - Math.min(...ys.filter(Number.isFinite) as number[]) : 0;
  const verdict = driftVerdict(trend, span, Math.max(spread * 0.25, series === 'f0' ? 0.05 : 0));

  const usable = records.filter(r => !r.excluded && Number.isFinite(r.resonance));
  const outliers = useMemo(() => screenRecords(records), [records]);
  const f0Trend = useMemo(() => { const s = samples.filter(x => x.f0Hz !== null); return linearTrend(s.map(x => x.t), s.map(x => x.f0Hz as number)); }, [samples]);
  const budget = useMemo(() => runBudget(records, f0Trend && span > 0 ? { slopeHzPerS: f0Trend.slopePerS, durationS: span } : null), [records, f0Trend, span]);
  const spec: Spec = { targetHz: Number(target), toleranceHz: Number(tol) };
  const specOk = target.trim() !== '' && validSpec(spec);
  const conform = useMemo(() => (specOk ? conformance(budget.rows.map(r => ({ key: `${r.x}, ${r.y}, ${r.z}`, meanHz: r.meanHz, expandedHz: r.expandedHz })), spec) : null), [budget, specOk, target, tol]);

  const shownEvents = filterEvents(events, { levels, subsystem: sub || undefined, query });
  const counts = countByLevel(events);
  const toggleLevel = (l: string) => setLevels(v => (v.includes(l) ? v.filter(x => x !== l) : [...v, l]));

  const makeReport = () => {
    const html = reportHtml({ title: 'S.P.H.E.R.E. Metrology Lab report', generatedAt: new Date().toISOString(), operator, runId: records.find(r => r.runId)?.runId, recordCount: usable.length, budget: budget.rows, pooledSdHz: budget.pooledSdHz, outliers, spec: conform ? spec : null, conformity: conform?.rows, drift: f0Trend ? { verdict: driftVerdict(f0Trend, span, 0.05), slopeHzPerS: f0Trend.slopePerS } : null, notes });
    download(safeFilename('lab report', 'html'), 'text/html;charset=utf-8', html); toast('Report saved. Open it and use Print to make a PDF.', 'success');
  };

  return (
    <div className="space-y-4 p-4" aria-label="Insights">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="text-lg font-bold">Insights</h2><p className="text-xs text-zinc-400">Stability, outliers, uncertainty and conformity from this session’s readings and ledger. Simulated data.</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => setTick(n => n + 1)} className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-700">Refresh</button>
          <button type="button" onClick={makeReport} disabled={!usable.length} className="rounded border border-sky-600 bg-sky-900 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50">Save printable report</button></div>
      </div>

      <Card title="Stability (Allan deviation and drift)" note="Allan deviation of one-second samples: how the reading’s scatter changes with averaging time. Drift needs the slope to clear 3× its own error and move more than a quarter of the observed spread.">
        <div className="mb-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Series">
          {([['f0', 'Resonance'], ['p', 'Pressure'], ['c', 'Temperature']] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={series === k} onClick={() => setSeries(k)} className={`rounded border px-3 py-1 text-xs font-semibold ${series === k ? 'border-sky-400 bg-sky-900 text-white' : 'border-zinc-600 bg-zinc-800 text-zinc-200'}`}>{series === k ? '✓ ' : ''}{l}</button>)}
        </div>
        {allan.length < 3 ? <EmptyState title="Not enough readings yet">Power the lab (and the VNA for resonance) and let simulated time run. At least a few seconds of samples are needed.</EmptyState> : (
          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <div className="h-[200px]" role="img" aria-label={`Allan deviation of ${series}, ${allan.length} averaging times`}>
              <ResponsiveContainer><LineChart data={allan} margin={{ top: 4, right: 10, bottom: 0, left: 0 }}><CartesianGrid stroke="#142030" /><XAxis dataKey="tauS" scale="log" type="number" domain={['auto', 'auto']} stroke="#6b7c90" fontSize={10} tickFormatter={v => `${v}s`} /><YAxis scale="log" domain={['auto', 'auto']} stroke="#6b7c90" fontSize={10} width={52} tickFormatter={v => Number(v).toExponential(0)} allowDataOverflow />
                <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #24384c', fontSize: 11 }} formatter={(v: number) => `${Number(v).toExponential(2)} ${unit}`} labelFormatter={v => `τ = ${v} s`} /><Line dataKey="adev" stroke="#e879f9" dot isAnimationActive={false} /></LineChart></ResponsiveContainer>
            </div>
            <div className="space-y-2 text-xs"><p><strong>Noise:</strong> {hint.text}</p>
              <p><strong>Trend:</strong> {trend ? `${trend.slopePerS.toExponential(2)} ${unit}/s ± ${trend.slopeSe.toExponential(1)}` : 'not enough data'} — <strong className={verdict === 'drifting' ? 'text-amber-300' : 'text-emerald-300'}>{verdict === 'drifting' ? 'Drifting' : verdict === 'stable' ? 'Stable' : 'Not enough data'}</strong></p>
              <p className="text-zinc-400">Window: {Math.round(span)} s of simulated time, {samples.length} samples.</p></div>
          </div>)}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={`Outlier screen (${outliers.length})`} note="Modified z-score over the repeats at each position (3 or more repeats). Flagged records are not removed; exclude them from the ledger yourself if justified.">
          {outliers.length === 0 ? <p className="text-xs text-emerald-300">✓ No outliers flagged{usable.length ? '' : ' (no data yet)'}.</p> : (
            <ul className="space-y-1 text-xs">{outliers.map(o => <li key={o.recordIndex} className="rounded border border-amber-700 bg-amber-950/40 p-2">⚠ <span className="font-mono">{o.position}</span>: {fmtNum(o.resonance)} Hz is {o.score.toFixed(1)} robust deviations from the median {fmtNum(o.medianHz)} Hz.</li>)}</ul>)}
        </Card>
        <Card title="Uncertainty budget" note="Standard uncertainty is the larger of the repeatability and fit terms (the lab’s Type A policy). The drift term, from the live trend, is combined in quadrature into the worst case.">
          {budget.rows.length === 0 ? <p className="text-xs text-zinc-400">Record measurements to see a budget.</p> : <>
            <p className="mb-2 text-xs">Pooled repeatability {budget.pooledSdHz === null ? '–' : `${fmtNum(budget.pooledSdHz, 4)} Hz`} ({budget.pooledDof} dof) · drift term {fmtNum(budget.driftHz, 4)} Hz · worst-case combined {budget.worstCombinedHz === null ? '–' : `${fmtNum(budget.worstCombinedHz, 4)} Hz`}</p>
            <div className="max-h-56 overflow-auto"><table className="w-full text-left text-xs"><thead className="text-zinc-400"><tr><th>Position</th><th>n</th><th>Repeat.</th><th>Fit</th><th>U (k)</th><th>Main</th></tr></thead><tbody>
              {budget.rows.map(r => <tr key={r.key} className="border-t border-zinc-800"><td className="font-mono">{r.x},{r.y},{r.z}</td><td>{r.n}</td><td>{r.repeatabilityHz === null ? '–' : fmtNum(r.repeatabilityHz, 4)}</td><td>{r.fitHz === null ? '–' : fmtNum(r.fitHz, 4)}</td><td>{r.expandedHz === null ? '–' : `${fmtNum(r.expandedHz, 4)} (${r.k?.toFixed(2)})`}</td><td>{r.dominant}</td></tr>)}</tbody></table></div></>}
        </Card>
      </div>

      <Card title="Conformity to a specification" note="Pass only if the whole expanded interval is inside the limits; fail only if it is wholly outside; otherwise indeterminate (guard-banded decision rule).">
        <div className="mb-2 flex flex-wrap items-end gap-3 text-xs">
          <label>Target (Hz)<input aria-label="Target frequency in hertz" inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)} className="mt-1 block w-40 rounded border border-zinc-700 bg-black p-1.5 font-mono text-sky-200" placeholder={budget.rows[0] ? String(Math.round(budget.rows[0].meanHz)) : '230500'} /></label>
          <label>± Tolerance (Hz)<input aria-label="Tolerance in hertz" inputMode="decimal" value={tol} onChange={e => setTol(e.target.value)} className="mt-1 block w-28 rounded border border-zinc-700 bg-black p-1.5 font-mono text-sky-200" /></label>
          {conform && <span role="status">✓ {conform.counts.pass} pass · ✗ {conform.counts.fail} fail · ? {conform.counts.indeterminate} indeterminate</span>}
        </div>
        {!specOk ? <p className="text-xs text-zinc-400">Enter a positive target and tolerance.</p> : conform && conform.rows.length > 0 && (
          <table className="w-full text-left text-xs"><thead className="text-zinc-400"><tr><th>Position</th><th>Deviation (Hz)</th><th>U (Hz)</th><th>Decision</th></tr></thead><tbody>
            {conform.rows.map(r => <tr key={r.key} className="border-t border-zinc-800"><td className="font-mono">{r.key}</td><td>{fmtNum(r.deviationHz, 3)}</td><td>{r.expandedHz === null ? '–' : fmtNum(r.expandedHz, 3)}</td><td className={r.decision === 'pass' ? 'text-emerald-300' : r.decision === 'fail' ? 'text-rose-300' : 'text-amber-300'}>{r.decision === 'pass' ? '✓ Pass' : r.decision === 'fail' ? '✗ Fail' : '? Indeterminate'}</td></tr>)}</tbody></table>)}
      </Card>

      <Card title={`Journal search (${shownEvents.length} of ${events.length})`}>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <input aria-label="Search the journal" placeholder="Search text, subsystem or operator" value={query} onChange={e => setQuery(e.target.value)} className="w-64 rounded border border-zinc-700 bg-black p-1.5" />
          <select aria-label="Subsystem" value={sub} onChange={e => setSub(e.target.value)} className="rounded border border-zinc-700 bg-black p-1.5"><option value="">All subsystems</option>{subsystemsOf(events).map(s => <option key={s}>{s}</option>)}</select>
          {['info', 'warning', 'critical'].map(l => <button key={l} type="button" aria-pressed={levels.includes(l)} onClick={() => toggleLevel(l)} className={`rounded border px-2 py-1 font-semibold ${levels.includes(l) ? 'border-sky-400 bg-sky-900 text-white' : 'border-zinc-600 bg-zinc-800 text-zinc-200'}`}>{levels.includes(l) ? '✓ ' : ''}{l} ({counts[l] ?? 0})</button>)}
          <button type="button" disabled={!shownEvents.length} onClick={() => download(safeFilename('journal filtered', 'csv'), 'text/csv;charset=utf-8', eventsCsv(shownEvents))} className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 font-semibold text-white hover:bg-zinc-700 disabled:opacity-50">Export CSV</button>
        </div>
        <ul className="max-h-64 space-y-1 overflow-auto text-xs">{shownEvents.slice(-200).reverse().map((e, i) => <li key={i} className="flex gap-2 border-t border-zinc-900 py-1"><span className="w-14 shrink-0 font-mono text-zinc-500">{typeof e.simulationTime === 'number' ? `${Math.floor(e.simulationTime / 60)}:${String(Math.floor(e.simulationTime % 60)).padStart(2, '0')}` : ''}</span><span className={`w-16 shrink-0 font-semibold ${e.level === 'critical' ? 'text-rose-300' : e.level === 'warning' ? 'text-amber-300' : 'text-zinc-400'}`}>{e.level === 'critical' ? '✗ critical' : e.level === 'warning' ? '⚠ warning' : 'info'}</span><span className="w-24 shrink-0 text-sky-300">{e.subsystem}</span><span>{e.text}</span></li>)}{!shownEvents.length && <li className="text-zinc-500">No matching events.</li>}</ul>
      </Card>

      <Card title="Report notes"><label className="block text-xs">Added to the printable report<textarea aria-label="Report notes" value={notes} onChange={e => setNotes(e.target.value.slice(0, 2000))} rows={3} className="mt-1 w-full rounded border border-zinc-700 bg-black p-1.5" /></label></Card>
    </div>
  );
});

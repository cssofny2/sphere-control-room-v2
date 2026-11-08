import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { onLabTransition, useLab } from '../state/labStores';
import { fitTrace } from '../simulation/measurement';
import { SaveImageButton, EmptyState } from './UiBits';
import { useUnits } from './useUnits';
import { fromTorr, fromCelsius } from './units';
import { Ring, downsample, markersFrom, sampleAt, sampleOf, telemetryCsv, type Marker, type Sample } from './telemetry';

// One ring for the whole session. It is filled whether or not the Timeline page is open.
const ring = new Ring();
const listeners = new Set<() => void>();

/** Starts sampling the lab once per simulated second. Returns a function that stops it. */
export function installTelemetry(): () => void {
  return onLabTransition((_prev, next) => {
    const t = next.facility?.simulationTime;
    if (!next.facility?.power || typeof t !== 'number' || !ring.due(t)) return;
    const trace = next.vna?.power ? next.vna.trace : null;
    const tf = trace && trace.length ? fitTrace(trace) : null;
    if (ring.push(sampleOf(next as never, tf && tf.fit.ok ? tf.fit.f0Hz : null))) listeners.forEach(f => f());
  });
}

/** Every sample still in the ring (up to an hour of simulated time), oldest first. */
export const telemetrySnapshot = (): readonly Sample[] => ring.toArray();

/** The latest telemetry samples (about the last `max`), refreshed once a second, for sparklines elsewhere in the app. */
export function useTelemetrySamples(max = 90): readonly Sample[] {
  const [, bump] = useState(0);
  useEffect(() => {
    let timer: number | null = null;
    const f = () => { if (timer === null) timer = window.setTimeout(() => { timer = null; bump(n => n + 1); }, 1000); };
    listeners.add(f);
    return () => { listeners.delete(f); if (timer !== null) window.clearTimeout(timer); };
  }, []);
  return ring.toArray().slice(-max);
}

const COLORS = { alarm: '#fb7185', action: '#94a3b8', measurement: '#5fd4ff' } as const;
const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

type Panel = { key: string; title: string; unit: string; get: (s: Sample) => number | null; log?: boolean; color: string; digits: number };
const PANELS: Panel[] = [
  { key: 'p', title: 'Chamber pressure', unit: 'Torr', get: s => s.pressureTorr, log: true, color: '#7dd3fc', digits: 2 },
  { key: 'c', title: 'Chamber temperature', unit: '°C', get: s => s.temperatureC, color: '#fbbf24', digits: 2 },
  { key: 'f', title: 'Fitted resonance (live trace)', unit: 'Hz', get: s => s.f0Hz, color: '#e879f9', digits: 2 },
  { key: 'x', title: 'Stage X position', unit: 'mm', get: s => s.x, color: '#86efac', digits: 2 },
];

/** Instrument readings, alarms, operator actions and measurements on one shared simulation clock, with a scrub-back cursor. */
// memo: the page has no props, so without it the 20 Hz lab tick re-rendered four charts every 50 ms.
export const Timeline = memo(function Timeline() {
  const [, bump] = useState(0);
  // Redraw at most once a second of real time: at 60x speed a sample arrives every few milliseconds, and four charts
  // redrawn each time made the page crawl.
  useEffect(() => {
    let timer: number | null = null;
    const f = () => { if (timer === null) timer = window.setTimeout(() => { timer = null; bump(n => n + 1); }, 1000); };
    listeners.add(f);
    return () => { listeners.delete(f); if (timer !== null) window.clearTimeout(timer); };
  }, []);
  const events = useLab(s => s.events as never[]);
  const records = useLab(s => s.experiment.records as never[]);
  const [windowS, setWindowS] = useState(600);
  const [cursor, setCursor] = useState<number | null>(null);
  const panelsRef = useRef<HTMLDivElement>(null);
  // Display units only change what is drawn; samples, the CSV export and the model stay in Torr and °C.
  const units = useUnits();
  const panels = PANELS.map(p => p.key === 'p' ? { ...p, unit: units.pressure, get: (s: Sample) => fromTorr(s.pressureTorr, units.pressure) }
    : p.key === 'c' ? { ...p, unit: units.temperature, get: (s: Sample) => fromCelsius(s.temperatureC, units.temperature) } : p);

  const all = ring.toArray();
  const end = all.length ? all[all.length - 1].t : 0;
  const shown = useMemo(() => all.filter(p => p.t >= end - windowS), [all.length, end, windowS]);
  const start = shown.length ? shown[0].t : 0;
  const markers: Marker[] = useMemo(() => markersFrom(events, records, start, end), [events, records, start, end]);
  const at = cursor === null ? null : sampleAt(all, cursor);
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([telemetryCsv(all, markersFrom(events, records))], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `sphere-telemetry-${Date.now()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Live Timeline</h1>
          <p className="mt-1 text-sm text-zinc-400">Pressure, temperature, resonance and stage position once per simulated second, with alarms, actions and measurements marked on the same clock. The last hour is kept; it is not saved after a reload.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="text-zinc-400">Window
            <select aria-label="Timeline window" value={windowS} onChange={e => setWindowS(Number(e.target.value))} className="ml-1 rounded border border-zinc-700 bg-zinc-900 p-1.5">
              <option value={120}>2 min</option><option value={600}>10 min</option><option value={1800}>30 min</option><option value={3600}>1 hour</option>
            </select>
          </label>
          <SaveImageButton targetRef={panelsRef} title="Live timeline" />
          <button onClick={exportCsv} disabled={!all.length} className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 font-semibold hover:bg-zinc-700 disabled:opacity-40">Export CSV</button>
        </div>
      </div>

      {!shown.length ? <EmptyState title="No samples yet" icon="◔">Switch the main breaker on and the lab starts recording pressure, temperature, resonance and stage position every simulated second.</EmptyState> : (
        <>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs">
            <label className="flex items-center gap-3">
              <span className="whitespace-nowrap text-zinc-400">Scrub back</span>
              <input type="range" className="flex-1" min={start} max={end} step={1} value={cursor ?? end} onChange={e => setCursor(Number(e.target.value) >= end ? null : Number(e.target.value))} aria-label="Scrub through the timeline" aria-valuetext={`${fmtT(cursor ?? end)} simulation time`} />
              <span className="font-mono text-sky-300">{fmtT(cursor ?? end)}{cursor === null ? ' (now)' : ''}</span>
            </label>
            {at && (
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-zinc-300" role="status">
                <span>P {fromTorr(at.pressureTorr, units.pressure).toExponential(1)} {units.pressure}</span><span>T {fromCelsius(at.temperatureC, units.temperature).toFixed(2)} {units.temperature}</span>
                <span>f₀ {at.f0Hz === null ? '–' : `${at.f0Hz.toFixed(2)} Hz`}</span><span>Stage {at.x.toFixed(1)}, {at.y.toFixed(1)}, {at.z.toFixed(1)} mm</span>
                <span className="text-zinc-500">A read-only look at the readings; the lab itself is unchanged.</span>
              </div>
            )}
          </div>
          <div ref={panelsRef} className="space-y-4">
          {panels.map(p => {
            const data = downsample(shown, 300, p.get).map(s => ({ t: s.t, v: p.get(s) }));
            return (
              <div key={p.key} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <div className="mb-1 text-xs font-bold uppercase text-zinc-300">{p.title} <span className="font-normal normal-case text-zinc-500">({p.unit})</span></div>
                <div className="h-[130px]" role="img" aria-label={`${p.title} over the last ${Math.round((end - start) / 60)} minutes`}>
                  <ResponsiveContainer>
                    <LineChart data={data} syncId="timeline" margin={{ top: 4, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke="#142030" />
                      <XAxis type="number" dataKey="t" domain={[start, end]} stroke="#6b7c90" fontSize={10} tickFormatter={fmtT} />
                      <YAxis scale={p.log ? 'log' : 'auto'} domain={p.log ? [fromTorr(1e-6, units.pressure), fromTorr(1000, units.pressure)] : ['auto', 'auto']} allowDataOverflow={p.log} stroke="#6b7c90" fontSize={10} width={58} tickFormatter={v => (p.log ? Number(v).toExponential(0) : Number(v).toFixed(p.digits > 1 ? 1 : 0))} />
                      <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #24384c', fontSize: 11 }} labelFormatter={v => `t ${fmtT(Number(v))}`} formatter={(v: number) => (v === null ? '–' : p.log ? `${Number(v).toExponential(2)} ${p.unit}` : `${Number(v).toFixed(p.digits)} ${p.unit}`)} />
                      {markers.filter(m => m.kind !== 'action').slice(-40).map((m, i) => <ReferenceLine key={i} x={m.t} stroke={COLORS[m.kind]} strokeOpacity={0.55} strokeDasharray={m.kind === 'alarm' ? undefined : '2 3'} />)}
                      {cursor !== null && <ReferenceLine x={cursor} stroke="#ffffff" />}
                      <Line type="monotone" dataKey="v" stroke={p.color} dot={false} strokeWidth={1.6} connectNulls={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs">
            <div className="mb-1 font-bold uppercase text-zinc-300">Events in this window <span className="font-normal normal-case text-zinc-500">(red = alarm or warning, blue = measurement)</span></div>
            <ul className="max-h-[220px] space-y-0.5 overflow-auto">
              {markers.length ? [...markers].reverse().map((m, i) => (
                <li key={i} className="flex gap-2"><button className="font-mono text-sky-300 underline-offset-2 hover:underline" onClick={() => setCursor(m.t)} aria-label={`Scrub to ${fmtT(m.t)}`}>{fmtT(m.t)}</button><span style={{ color: COLORS[m.kind] }} aria-hidden="true">●</span><span className="text-zinc-300">{m.label}</span></li>
              )) : <li className="text-zinc-500">Nothing happened in this window.</li>}
            </ul>
          </div>
        </>
      )}
    </div>
  );
});

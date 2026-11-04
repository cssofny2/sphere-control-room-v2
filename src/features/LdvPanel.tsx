import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, Download, FileText, Radar, ScanLine, Square } from 'lucide-react';
import './ldv.css';
import { LDV_ABOUT, LDV_GRIDS, LDV_MODES, LDV_SCENARIOS, LDV_SCENARIO_BY_ID, conditions, gridSide, generateScan, scanPointTotal, scanSeconds, stallReason, type LdvMode, type LdvScanResult } from './ldvModel';
import { AlignMap, HeadDiagram, HeatMap, LdvIcon, SeriesPlot, SphereView } from './LdvArt';
import { AlertBadge, AlertBanner } from './AlertBadge';
import { getAlert } from './alerts';
import { LabClock } from './LabClock';
import { operatorTag } from './operator';

const saveFile = (name: string, text: string, type: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); window.setTimeout(() => URL.revokeObjectURL(a.href), 3000); };
const fmtN = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const stampOf = (iso: string) => { const d = new Date(iso); return Number.isNaN(+d) ? iso : `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`; };

function resultCsv(r: LdvScanResult): string {
  const head = [`# SPHERE LDV scan`, `# id,${r.id}`, `# scenario,${r.title}`, `# date_time,${r.iso}`, `# operator,${r.operator || ''}`, `# f0_hz,${r.f0.toFixed(3)}`, `# q,${r.q.toFixed(0)}`, `# peak_velocity_mm_s,${r.peakVel.toFixed(4)}`, `# optical_return_pct,${r.returnPct.toFixed(1)}`, `# stage_xyz_mm,${r.position.map(v => v.toFixed(3)).join(' ')}`, `# pressure_torr,${r.pressure.toExponential(3)}`, `# temperature_c,${r.temperature.toFixed(3)}`, `# verdict,${r.verdict}`];
  if (r.field) return [...head, 'row,col,lat_deg,lon_deg,velocity_norm,velocity_mm_s', ...r.field.map((v, i) => { const row = Math.floor(i / r.n), col = i % r.n; return [row, col, (90 - ((row + 0.5) / r.n) * 180).toFixed(2), (((col + 0.5) / r.n) * 360 - 180).toFixed(2), v.toFixed(4), (v * r.peakVel).toFixed(4)].join(','); })].join('\n');
  if (r.series) return [...head, `${r.series.xLabel},${r.series.yLabel}${r.series.extra ? `,${r.series.extraLabel}` : ''}`, ...r.series.x.map((x, i) => [x, r.series!.y[i].toFixed(5), r.series!.extra ? r.series!.extra[i].toFixed(5) : ''].filter(v => v !== '').join(','))].join('\n');
  if (r.map) return [...head, 'beam_x,beam_y,return_pct', ...r.map.values.map((v, i) => `${(i % r.map!.size) - 5},${Math.floor(i / r.map!.size) - 5},${v.toFixed(1)}`)].join('\n');
  return head.join('\n');
}

function ResultView({ r, revealed = 1, live = false, unit, onAutoAlign }: { r: LdvScanResult; revealed?: number; live?: boolean; unit: 'vel' | 'disp'; onAutoAlign: () => void }) {
  const [amp, setAmp] = useState(1), [play, setPlay] = useState(true);
  const peak = unit === 'vel' ? `${fmtN(r.peakVel)} mm/s` : `${fmtN((r.peakVel * 1e6) / (2 * Math.PI * r.f0), 1)} nm`;
  return (
    <div className="lx-res-body">
      <div className="lx-res-vis">
        {r.field && <>
          <div className="lx-res-3d"><SphereView field={r.field} n={r.n} mode={r.mode} revealed={revealed} amp={amp} animate={play} size={290} />
            <div className="lx-res-ctl"><button type="button" className="lx-mini" aria-pressed={play} onClick={() => setPlay(v => !v)}>{play ? 'Pause vibration' : 'Play vibration'}</button><label>Exaggeration<input type="range" min="0.3" max="2" step="0.1" value={amp} onChange={e => setAmp(Number(e.target.value))} aria-label="Vibration exaggeration" /></label></div></div>
          <HeatMap field={r.field} n={r.n} revealed={revealed} scanRow={live ? 1 : undefined} />
        </>}
        {r.series && <SeriesPlot s={r.series} progress={live ? Math.max(0.05, revealed) : 1} color={r.scenario === 'damping' ? '#fb923c' : r.scenario === 'noise' ? '#4ade80' : '#e879f9'} />}
        {r.map && <div><AlignMap map={r.map} /><button type="button" className="lx-mini on" onClick={onAutoAlign}>Auto-align to the best spot</button></div>}
      </div>
      <div className="lx-res-info">
        <div className={`lx-verdict v-${r.verdict}`}><b>{r.verdict === 'good' ? '✔ GOOD' : r.verdict === 'fair' ? '▲ FAIR' : '✖ POOR'}</b><span>{r.verdictText}</span></div>
        <dl className="lx-kv">
          <div><dt>Resonance</dt><dd>{fmtN(r.f0 / 1000, 4)} kHz</dd></div><div><dt>Q-factor</dt><dd>{fmtN(r.q, 0)}</dd></div>
          <div><dt>Peak {unit === 'vel' ? 'velocity' : 'displacement'}</dt><dd>{peak}</dd></div><div><dt>Signal / noise</dt><dd>{fmtN(r.snr, 0)} : 1</dd></div>
          <div><dt>Optical return</dt><dd>{fmtN(r.returnPct, 0)}%</dd></div><div><dt>Stage X·Y·Z</dt><dd>{r.position.map(v => v.toFixed(1)).join(' · ')} mm</dd></div>
          <div><dt>Pressure</dt><dd>{r.pressure >= 10 ? r.pressure.toFixed(0) : r.pressure.toExponential(1)} Torr</dd></div><div><dt>Temperature</dt><dd>{fmtN(r.temperature, 2)} °C</dd></div>
        </dl>
        <ul className="lx-sum">{r.summary.map(t => <li key={t} className={t.startsWith('Why:') ? 'why' : ''}>{t}</li>)}</ul>
      </div>
    </div>
  );
}

export default function LdvPanel({ state, dispatch, f0, freqAt, HelpInfo }: { state: any; dispatch: (a: any) => void; f0: number; freqAt: (x: number, y: number, z: number) => number; HelpInfo: any }) {
  const l = state.ldv, scanning = !!l.scanActive, scenario = LDV_SCENARIO_BY_ID[l.scanScenario as keyof typeof LDV_SCENARIO_BY_ID] || LDV_SCENARIOS[0];
  const alert = getAlert(state, 'ldv'), n = gridSide(l.grid), total = scanPointTotal(scenario.id, l.grid), pct = Math.round((l.scanProgress || 0) * 100);
  const cd = conditions(state), who = operatorTag(state.operator);
  const [pressed, setPressed] = useState(false), [unit, setUnit] = useState<'vel' | 'disp'>('vel'), [viewId, setViewId] = useState<string>('latest'), [why, setWhy] = useState('');
  const resultsRef = useRef<HTMLElement>(null);
  const block = !state.facility.power ? 'Close the main breaker first' : !l.power ? 'Switch the LDV on first' : !l.shutter ? 'Open the laser shutter first' : state.chamber.doorOpen ? 'Close the chamber door first' : '';
  const stalled = scanning ? stallReason(state) : '';

  const bucket = Math.floor((state.facility.simulationTime || 0) * 3);
  const opts = (id: string) => ({ f0, grid: l.grid, id, iso: new Date().toISOString(), clock: new Date().toLocaleTimeString(), operator: who, freqAt });
  const preview = useMemo(() => generateScan(state, scenario.id, opts(l.scanId || 'preview')), [bucket, scenario.id, l.grid, l.mode, scanning, l.scanId, l.alignmentX, l.alignmentY, l.focus, l.range, l.filter, l.opticalQuality]);  // eslint-disable-line react-hooks/exhaustive-deps
  const live = useMemo(() => generateScan(state, 'point', opts('live')), [bucket, l.alignmentX, l.alignmentY, l.focus, l.power, l.shutter, l.range, l.filter]);  // eslint-disable-line react-hooks/exhaustive-deps
  const viewed: LdvScanResult | null = viewId === 'latest' ? l.scanResult : (l.scanHistory || []).find((h: LdvScanResult) => h.id === viewId) || l.scanResult;
  const shown = scanning ? preview : viewed;

  // Bring the finished result into view once, and mark it as seen when the person has looked at it.
  const wasScanning = useRef(scanning);
  useEffect(() => { if (wasScanning.current && !scanning && l.scanNew) { setViewId('latest'); resultsRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); } wasScanning.current = scanning; }, [scanning, l.scanNew]);
  useEffect(() => {
    const el = resultsRef.current; if (!el || !l.scanNew || scanning) return; let t = 0;
    const io = new IntersectionObserver(es => { window.clearTimeout(t); if (es[0]?.isIntersecting) t = window.setTimeout(() => dispatch({ type: 'LDV_SCAN_SEEN' }), 1400); }, { threshold: 0.3 });
    io.observe(el); return () => { io.disconnect(); window.clearTimeout(t); };
  }, [l.scanNew, scanning, dispatch]);

  const acquire = () => {
    setPressed(true); window.setTimeout(() => setPressed(false), 750);
    if (scanning) { dispatch({ type: 'LDV_SCAN_CANCEL' }); return; }
    if (block) setWhy(block); else setWhy('');
    dispatch({ type: 'LDV_SCAN_START', scenario: scenario.id });
  };
  useEffect(() => { if (!block) setWhy(''); }, [block]);
  const set = (patch: Record<string, any>) => dispatch({ type: 'PATCH', domain: 'ldv', patch });
  const addNote = (r: LdvScanResult) => dispatch({ type: 'NOTEBOOK_ADD', entry: { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, tag: 'result', text: `LDV ${r.title}: ${r.summary.slice(0, 2).join(' ')} Verdict ${r.verdict.toUpperCase()}.`, time: new Date().toLocaleTimeString(), simTime: Math.floor(state.facility.simulationTime), operator: who, snapshot: { f0Hz: Number(r.f0.toFixed(3)), tempC: Number(r.temperature.toFixed(3)), pressure: r.pressure >= 10 ? `${r.pressure.toFixed(1)} Torr` : `${r.pressure.toExponential(1)} Torr`, clockLocked: r.clockLocked, validation: r.verdict.toUpperCase(), stage: r.position.map(v => Number(v.toFixed(2))) } } });
  const ref = l.reference as { title: string; f0: number; peakVel: number; position: number[]; clock: string } | null;
  const secLeft = scanning ? Math.max(0, Math.ceil((1 - (l.scanProgress || 0)) * scanSeconds(scenario.id, l.grid) / Math.max(1, state.facility.speed))) : 0;

  return (
    <div className="space-y-4 lx-root">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center">Polytec PSV-500-3D Laser Vibrometer <HelpInfo termKey="ldv" /></h1>
          <p className="mt-1 text-sm text-zinc-400 max-w-3xl">Measures how the sphere’s surface vibrates, using only a laser beam, so nothing touches the sphere. Run a 3D scan to map the whole surface, or choose a scenario to check noise, damping, alignment or the location effect.</p>
        </div>
        <div className="flex items-center gap-2"><AlertBadge info={alert} showIdle name="Laser vibrometer" /><LabClock variant="block" sim={state.facility.simulationTime} /></div>
      </div>
      <AlertBanner info={alert} name="Laser vibrometer" onGo={p => dispatch({ type: 'SET_UI', patch: { active: p } })} />

      {scanning && (
        <div className={`lx-status is-scanning${stalled ? ' is-stalled' : ''}`} role="status" aria-live="polite">
          <Radar size={22} className="lx-spinicon" aria-hidden="true" />
          <div><b>{stalled ? '3D SCAN STALLED' : '3D SCAN IN PROGRESS'} — {scenario.title}</b><span>{stalled ? `${stalled} Progress is kept; the scan resumes when this is fixed.` : `Point ${Math.min(total, Math.round((l.scanProgress || 0) * total))} of ${total} · about ${secLeft} s left. The live preview is filling in the Scan results panel below.`}</span></div>
          <button type="button" className="lx-link" onClick={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Watch it fill in <ArrowDown size={13} /></button>
          <i className="lx-status-bar" style={{ width: `${pct}%` }} aria-hidden="true" />
        </div>
      )}
      {!scanning && l.scanNew && l.scanResult && (
        <div className="lx-status is-done" role="status" aria-live="polite"><span className="lx-bounce" aria-hidden="true">✔</span><div><b>3D scan complete — results are ready</b><span>{l.scanResult.title} finished at {l.scanResult.clock}. It is in the <em>Scan results</em> panel just below the controls.</span></div>
          <button type="button" className="lx-link" onClick={() => { resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); dispatch({ type: 'LDV_SCAN_SEEN' }); }}>Show me the results <ArrowDown size={13} className="lx-bounce" /></button></div>
      )}

      <div className="lx-main">
        <div className="lx-chassis" data-status={alert.level}>
          <div className="lx-chassis-h"><span className={`lx-led ${l.power ? 'on' : ''}`} aria-hidden="true" /><b>POLYTEC PSV-500-3D CONTROLLER &amp; SOFTWARE</b><span className="lx-spec">LASER CLASS 2 · 633 nm</span></div>
          <HeadDiagram power={!!l.power} shutter={!!l.shutter} scanning={scanning} stalled={!!stalled} quality={l.power && l.shutter ? l.opticalQuality ?? 0 : 0} progress={l.scanProgress || 0} />
          <div className="lx-live"><div className="lx-live-h"><b>Live vibration spectrum</b><span>one point, around the resonance · updates as you change the conditions</span></div>{l.power && l.shutter ? <SeriesPlot s={live.series!} /> : <div className="lx-live-off">Open the laser shutter to see the live spectrum.</div>}</div>
        </div>

        <div className="lx-controls">
          <div className="lx-card">
            <div className="lx-card-h">1 · Laser head <HelpInfo termKey="shutter" /></div>
            <div className="lx-toggles">
              <button type="button" className={`lx-toggle ${l.power ? 'on' : ''}`} aria-pressed={!!l.power} disabled={!state.facility.power} onClick={() => set({ power: !l.power, shutter: l.power ? false : l.shutter })}><i />LDV power <b>{l.power ? 'ON' : 'OFF'}</b></button>
              <button type="button" className={`lx-toggle laser ${l.shutter ? 'on' : ''}`} aria-pressed={!!l.shutter} disabled={!l.power} onClick={() => set({ shutter: !l.shutter })}><i />Laser shutter <b>{l.shutter ? 'OPEN' : 'CLOSED'}</b></button>
            </div>
            <div className="lx-return"><div><span>Optical return</span><b className={cd.returnPct > 60 ? 'ok' : cd.returnPct > 30 ? 'mid' : 'bad'}>{cd.returnPct.toFixed(0)}%</b></div><div className="lx-meter"><i style={{ width: `${cd.returnPct}%` }} className={cd.returnPct > 60 ? 'ok' : cd.returnPct > 30 ? 'mid' : 'bad'} /></div><small>How much of the laser light comes back from the sphere. Above 60% is healthy.</small></div>
          </div>

          <div className="lx-card">
            <div className="lx-card-h">2 · Aim &amp; focus</div>
            {([['alignmentX', 'Beam X'], ['alignmentY', 'Beam Y'], ['focus', 'Focus']] as const).map(([k, label]) => <label key={k} className="lx-slider">{label} <b>{fmtN(l[k], 1)}</b><input type="range" min="-5" max="5" step="0.1" value={l[k]} disabled={!l.power} onChange={e => set({ [k]: Number(e.target.value) })} /></label>)}
            <button type="button" className="lx-mini" disabled={!l.power} onClick={() => dispatch({ type: 'LDV_AUTO_ALIGN' })}>Auto-align</button>
          </div>

          <div className="lx-card">
            <div className="lx-card-h">3 · Choose what to measure</div>
            <label className="lx-field">Scenario<select value={scenario.id} disabled={scanning} onChange={e => set({ scanScenario: e.target.value })}>{LDV_SCENARIOS.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
            <p className="lx-hint">{scenario.goal}</p>
            <div className="lx-two">
              <label className="lx-field">Grid points<select value={l.grid} disabled={scanning || !!LDV_SCENARIO_BY_ID[scenario.id].fixed} onChange={e => set({ grid: Number(e.target.value) })}>{LDV_GRIDS.map(g => <option key={g} value={g}>{g} ({gridSide(g)}×{gridSide(g)})</option>)}</select></label>
              <label className="lx-field">Vibration mode<select value={l.mode} disabled={scanning} onChange={e => set({ mode: e.target.value })}>{(Object.keys(LDV_MODES) as LdvMode[]).map(m => <option key={m} value={m}>{LDV_MODES[m].label}</option>)}</select></label>
              <label className="lx-field">Velocity range <HelpInfo termKey="velocity_range" /><select value={l.range} onChange={e => set({ range: e.target.value })}><option>10 mm/s/V</option><option>20 mm/s/V</option><option>100 mm/s/V</option></select></label>
              <label className="lx-field">Decoder filter<select value={l.filter} onChange={e => set({ filter: e.target.value })}><option>100 kHz</option><option>1 MHz</option><option>10 MHz</option></select></label>
            </div>
          </div>

          <div className={`lx-acq-wrap ${why ? 'shake' : ''}`}>
            <div className="lx-card-h">4 · Acquire</div>
            <button type="button" className={`lx-acq ${scanning ? 'is-scanning' : block ? 'is-blocked' : 'is-ready'}${pressed ? ' is-pressed' : ''}`} aria-pressed={scanning} onClick={acquire} data-acquire-3d-scan>
              <span className="lx-acq-ico" aria-hidden="true">{scanning ? <Square size={20} /> : <ScanLine size={22} />}</span>
              <span className="lx-acq-txt"><b>{scanning ? `SCANNING… ${pct}%` : 'ACQUIRE 3D SCAN'}</b><small>{scanning ? 'Click to cancel the scan' : block || `${scenario.short} · ${LDV_SCENARIO_BY_ID[scenario.id].fixed ? `${total} points` : `${n}×${n} = ${total} points`} · about ${Math.round(scanSeconds(scenario.id, l.grid))} s`}</small></span>
              {scanning && <i className="lx-acq-bar" style={{ width: `${pct}%` }} aria-hidden="true" />}
            </button>
            {why && <p className="lx-why" role="alert">Cannot start: {why}.</p>}
            <p className="lx-acq-help"><b>What this does:</b> the scanning mirrors steer the laser spot over the sphere and measure the velocity of each point. <b>Where the result appears:</b> in the <a href="#ldv-results" onClick={e => { e.preventDefault(); resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Scan results ↓</a> panel below, which fills in live while the scan runs.</p>
          </div>
        </div>
      </div>

      <section id="ldv-results" ref={resultsRef} className={`lx-results${l.scanNew && !scanning ? ' is-new' : ''}${scanning ? ' is-live' : ''}`} aria-label="Scan results">
        <div className="lx-res-h">
          <h2>Scan results {l.scanNew && !scanning && <span className="lx-newbadge">NEW</span>}{scanning && <span className="lx-newbadge live">LIVE PREVIEW</span>}</h2>
          {shown && <span className="lx-res-meta">{shown.title} · {stampOf(shown.iso)}{shown.operator ? ` · operator ${shown.operator}` : ''}</span>}
          <span className="lx-unit" role="group" aria-label="Units"><button type="button" aria-pressed={unit === 'vel'} onClick={() => setUnit('vel')}>Velocity</button><button type="button" aria-pressed={unit === 'disp'} onClick={() => setUnit('disp')}>Displacement</button></span>
        </div>
        {shown ? <ResultView r={shown} revealed={scanning ? l.scanProgress || 0 : 1} live={scanning} unit={unit} onAutoAlign={() => dispatch({ type: 'LDV_AUTO_ALIGN' })} /> : (
          <div className="lx-empty"><ScanLine size={34} aria-hidden="true" /><b>No scan yet</b><span>Switch the LDV on, open the shutter, then press <em>ACQUIRE 3D SCAN</em>. Your result will appear right here, with a rotating 3D sphere, a surface map and the numbers behind it.</span></div>
        )}
        {shown && !scanning && (
          <div className="lx-res-actions">
            <button type="button" className="lx-mini" onClick={() => saveFile(`sphere-ldv-${shown.scenario}-${shown.iso.replace(/[:.]/g, '-')}.csv`, resultCsv(shown), 'text/csv')}><Download size={12} /> CSV</button>
            <button type="button" className="lx-mini" onClick={() => saveFile(`sphere-ldv-${shown.scenario}-${shown.iso.replace(/[:.]/g, '-')}.json`, JSON.stringify(shown, null, 2), 'application/json')}><Download size={12} /> JSON</button>
            <button type="button" className="lx-mini" onClick={() => addNote(shown)}><FileText size={12} /> Add to notebook</button>
            <button type="button" className="lx-mini" onClick={() => dispatch({ type: 'LDV_SET_REFERENCE' })} disabled={viewId !== 'latest'} title="Keep the latest scan as a baseline to compare later scans against">Keep as reference</button>
          </div>
        )}
        {shown && ref && !scanning && (
          <div className="lx-compare"><b>Compared with reference</b> ({ref.title}, {ref.clock}): Δ resonance <em>{fmtN(shown.f0 - ref.f0, 2)} Hz</em> · Δ peak velocity <em>{fmtN(((shown.peakVel - ref.peakVel) / Math.max(1e-6, ref.peakVel)) * 100, 1)}%</em> · Δ position <em>{shown.position.map((v, i) => (v - (ref.position[i] ?? 0)).toFixed(1)).join(' · ')} mm</em></div>
        )}
        {(l.scanHistory || []).length > 1 && !scanning && (
          <div className="lx-hist" role="group" aria-label="Previous scans"><span>History</span>{(l.scanHistory as LdvScanResult[]).map((h, i) => <button key={h.id} type="button" aria-pressed={(viewId === 'latest' ? i === 0 : viewId === h.id)} onClick={() => setViewId(i === 0 ? 'latest' : h.id)}>{h.title}<small>{h.clock}</small></button>)}</div>
        )}
      </section>

      <section className="lx-scenarios" aria-label="What you can do with this instrument">
        <h2>What this instrument can do in this experiment <span>— pick one, then press Acquire</span></h2>
        <div className="lx-scn-grid">
          {LDV_SCENARIOS.map(x => (
            <button key={x.id} type="button" className={`lx-scn ${scenario.id === x.id ? 'sel' : ''}`} aria-pressed={scenario.id === x.id} disabled={scanning} onClick={() => set({ scanScenario: x.id })}>
              <LdvIcon kind={x.icon} size={64} />
              <span><b>{x.title}</b><small><em>Goal:</em> {x.goal}</small><small><em>Use it when:</em> {x.when}</small><small><em>You get:</em> {x.produces}</small><small className="needs">Needs: {x.needs.join(' · ')}</small></span>
            </button>
          ))}
        </div>
      </section>

      <section className="lx-about" aria-label="About this instrument">
        <h2>About the laser vibrometer</h2>
        <div className="lx-about-grid">
          <div><p>{LDV_ABOUT.what}</p><p>{LDV_ABOUT.howHere}</p>
            <h3>The parts</h3><ol className="lx-parts">{LDV_ABOUT.parts.map(p => <li key={p}>{p}</li>)}</ol></div>
          <div><h3>Everything it can do here</h3><ul>{LDV_ABOUT.does.map(t => <li key={t}>{t}</li>)}</ul></div>
          <div><h3>Limits to keep in mind</h3><ul>{LDV_ABOUT.limits.map(t => <li key={t}>{t}</li>)}</ul></div>
        </div>
      </section>
    </div>
  );
}

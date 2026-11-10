import { useMemo, useState } from 'react';
import { LOC1_FIELDS, LOC1_SCHEMA_ID, LOC1_SCHEMA_VERSION } from './loc1';

type Props = { state: any; dispatch: (action: any) => void; records: any[]; onExportJson: () => void; onExportManifest: () => void };
type Tab = 'overview' | 'metrology' | 'controls' | 'custody' | 'roadmap';

const card = 'rounded-lg border border-zinc-800 bg-zinc-950 p-4';
const label = 'block text-[10px] font-bold uppercase tracking-widest text-zinc-500';
const input = 'mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100';

function Metric({ name, value, unit = '' }: { name: string; value: string; unit?: string }) {
  return <div className="rounded border border-zinc-800 bg-black/30 p-2"><div className="text-[10px] text-zinc-500">{name}</div><div className="mt-1 font-mono text-sm text-sky-200">{value}<span className="ml-1 text-[10px] text-zinc-500">{unit}</span></div></div>;
}

function Field({ title, value, onChange, step = 'any', min, max, disabled = false }: { title: string; value: number; onChange: (value: number) => void; step?: string; min?: number; max?: number; disabled?: boolean }) {
  return <label className="text-[11px] text-zinc-400">{title}<input className={input} type="number" step={step} min={min} max={max} disabled={disabled} value={value} onChange={event => onChange(Number(event.target.value))} /></label>;
}

function HeatMap({ title, values }: { title: string; values: number[][] }) {
  return <div><div className="mb-1 text-[10px] font-bold text-zinc-300">{title}</div><svg viewBox="0 0 160 160" role="img" aria-label={title} className="w-full max-w-[190px] rounded bg-black p-1">{values.flatMap((row, y) => row.map((value, x) => <rect key={`${x}-${y}`} x={x * 19} y={y * 19} width="17" height="17" rx="2" fill={`hsl(${210 - Math.max(0, Math.min(1, value)) * 210} 75% 48%)`}><title>{value.toFixed(3)}</title></rect>))}</svg></div>;
}

export default function ProtocolWorkspace({ state, dispatch, records, onExportJson, onExportManifest }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [uThermal, setUThermal] = useState(0.01);
  const [uClock, setUClock] = useState(0.2);
  const [uBaseline, setUBaseline] = useState(0.4);
  const [correlation, setCorrelation] = useState(0);
  const [gradient, setGradient] = useState(0.02);
  const [placementMinutes, setPlacementMinutes] = useState(30);
  const [delta, setDelta] = useState(5);
  const [contrast, setContrast] = useState(1.2);
  const [placementSe, setPlacementSe] = useState(1.2);
  const [sampleRate, setSampleRate] = useState(96000);
  const [drive, setDrive] = useState(0.4);
  const [rotation90, setRotation90] = useState(false);
  const [rotation180, setRotation180] = useState(false);
  const [sham, setSham] = useState(false);
  const [dummySwap, setDummySwap] = useState(false);
  const [sequenceHash, setSequenceHash] = useState('');
  const [sequence, setSequence] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [custodyError, setCustodyError] = useState('');
  const [tranche, setTranche] = useState(10000);
  const [quoteAmount, setQuoteAmount] = useState(1000);
  const [signoffs, setSignoffs] = useState<Record<string, boolean>>({});
  const [reviewerVotes, setReviewerVotes] = useState(0);
  const [strict, setStrict] = useState(!!state.protocol?.osfStrict);

  const f0 = Number(state.vna.center) || 230500;
  const uc = Math.sqrt((23 * uThermal) ** 2 + (f0 * uClock / 1e9) ** 2 + uBaseline ** 2 + 2 * correlation * 23 * uThermal * uBaseline);
  const powerPass = delta >= 3.3 * placementSe;
  const tostLo = contrast - 1.96 * placementSe;
  const tostHi = contrast + 1.96 * placementSe;
  const equivalent = tostLo > -delta && tostHi < delta;
  const aliasedFrequency = Math.abs(((230500 + sampleRate / 2) % sampleRate) - sampleRate / 2);
  const thermalDelta = 23 * (Number(state.chamber.temperature) - 20);
  const mac = useMemo(() => Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => {
    const r = Math.hypot(x - 3.5, y - 3.5);
    return Math.max(0, Math.min(1, 0.15 + 0.78 * Math.exp(-((r - 2.2) ** 2) / 2.4)));
  })), []);
  const ldvMac = useMemo(
    () => mac.map((row, y) => row.map((value, x) => Math.max(0, Math.min(1, value + 0.06 * Math.sin(x * 2.2 + y * 1.3))))),
    [mac]
  );
  const milestones = ['F0', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9'];
  const artifacts = [
    ['T-01', 'Test', '99.999%', '9.2 mm', 'Batch A'],
    ['R-01', 'Reference', '99.999%', '9.2 mm', 'Batch A'],
    ['S-01', 'Spare', '99.999%', '9.2 mm', 'Batch A'],
    ['D-01', 'Dummy', '99.999%', '9.2 mm', 'Batch-matched'],
  ];

  const enableStrict = (enabled: boolean) => {
    setStrict(enabled);
    dispatch({ type: 'PATCH', domain: 'protocol', patch: { osfStrict: enabled, alpha: 0.01, separationM: 0.4 } });
  };
  const makeSequence = async () => {
    setCustodyError('');
    try {
      if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is unavailable; no custody key was created.');
      const order = Array.from({ length: 12 }, (_, i) => (i % 2 ? 'B' : 'A')).sort(() => Math.random() - 0.5).join('');
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(order));
      const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
      setSequence(order);
      setSequenceHash(hash);
      setRevealed(false);
    } catch (error) {
      setCustodyError(error instanceof Error ? error.message : 'Could not create the simulated custody key.');
    }
  };
  const unlockSequence = async () => {
    setCustodyError('');
    try {
      if (!sequence || !sequenceHash || !globalThis.crypto?.subtle) throw new Error('Create a placement sequence before unblinding.');
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sequence));
      const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
      if (hash !== sequenceHash) throw new Error('Sequence hash mismatch; the blinded sequence remains locked.');
      setRevealed(true);
    } catch (error) {
      setCustodyError(error instanceof Error ? error.message : 'Could not verify the custody key.');
    }
  };
  const tabs: [Tab, string][] = [['overview', 'Overview'], ['metrology', 'Metrology'], ['controls', 'Controls'], ['custody', 'Integrity & custody'], ['roadmap', 'Governance & roadmap']];

  return (
    <div className="space-y-4">
      <header className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-zinc-100">LOC-1 Protocol Workspace</h1>
            <p className="mt-1 max-w-4xl text-xs leading-relaxed text-zinc-400">Synthetic educational modules for the proposed S.P.H.E.R.E. protocol. This workspace is not an approved preregistration, calibrated facility, or source of experimental evidence. Protocol-specific values and export fields are provisional because SPHERE-WP-001 and the LOC-1 schema were not provided in this repository.</p>
          </div>
          <span className="rounded border border-amber-500/60 bg-amber-950 px-3 py-1.5 text-xs font-black tracking-widest text-amber-200">SYNTHETIC</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Protocol workspace modules">
          {tabs.map(([id, name]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded border px-3 py-1.5 text-xs ${tab === id ? 'border-sky-400 bg-sky-500/15 text-sky-200' : 'border-zinc-700 text-zinc-400'}`}>{name}</button>)}
        </div>
      </header>

      {tab === 'overview' && <>
        <div className="grid gap-3 md:grid-cols-4">
          <Metric name="Study status" value="SIMULATED" />
          <Metric name="Artifact maximum" value="9.2" unit="mm OD" />
          <Metric name="A ↔ B nominal spacing" value={strict ? '0.400' : '0.400'} unit="m" />
          <Metric name="Records in ledger" value={String(records.length)} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <section className={card}>
            <h2 className="text-sm font-bold">Static LOC-1 positioning rail</h2>
            <p className="mt-1 text-[11px] text-zinc-500">A and B are fixed kinematic nodal mounts; the dimension is exact in this schematic, not a measured facility installation.</p>
            <svg viewBox="0 0 620 145" role="img" aria-label="Static rail with positions A and B separated by 0.40 metres" className="mt-3 w-full rounded bg-black/40">
              <line x1="88" y1="76" x2="532" y2="76" stroke="#94a3b8" strokeWidth="8" />
              <line x1="112" y1="106" x2="508" y2="106" stroke="#38bdf8" strokeWidth="1.5" />
              <path d="M112 98v16M508 98v16" stroke="#38bdf8" strokeWidth="2" />
              <g fill="#c47a54" stroke="#f3b79c" strokeWidth="2"><circle cx="112" cy="68" r="8"/><circle cx="508" cy="68" r="8"/></g>
              <text x="112" y="38" fill="#e2e8f0" fontSize="16" textAnchor="middle">A · T / R</text>
              <text x="508" y="38" fill="#e2e8f0" fontSize="16" textAnchor="middle">B · T / R</text>
              <text x="310" y="100" fill="#7dd3fc" fontSize="14" textAnchor="middle">0.400 m</text>
            </svg>
          </section>
          <section className={card}>
            <h2 className="text-sm font-bold">Controlled thermal enclosure</h2>
            <p className="mt-1 text-[11px] text-zinc-500">Protocol baseline: atmospheric pressure with optical access. Vacuum pumping is deferred in LOC-1; the legacy training simulation remains a separate model.</p>
            <div className="mt-3 grid grid-cols-2 gap-2"><Metric name="Modeled pressure" value="101.325" unit="kPa (assumption)" /><Metric name="Live simulator temperature" value={Number(state.chamber.temperature).toFixed(3)} unit="°C" /></div>
            <p className="mt-3 rounded border border-amber-800/60 bg-amber-950/30 p-2 text-[10px] text-amber-200">VNA role: Exploratory Electromagnetic Diagnostic. No confirmatory inference is represented here.</p>
          </section>
          <section className={card}>
            <h2 className="text-sm font-bold">Shared 10 MHz timebase synchronization</h2>
            <p className="mt-1 text-[10px] text-zinc-500">Rubidium/GPSDO-style lock monitor, driven by the simulator clock state. Timestamp agreement is modeled, not hardware-verified.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric name="Reference" value="10" unit="MHz" />
              <Metric name="Lock" value={state.clock.locked ? 'LOCKED' : 'UNLOCKED'} />
              <Metric name="Holdover" value={state.clock.holdover ? 'ACTIVE' : 'OFF'} />
              <Metric name="Lock age" value={Number(state.clock.timeSinceLock || 0).toFixed(1)} unit="s" />
              <Metric name="DAQ timestamp" value={state.experiment.records.length ? 'SIMULATED' : 'NO RECORD'} />
              <Metric name="Oscilloscope sync" value={state.scope.power && state.clock.locked ? 'SYNC' : 'UNSYNC'} />
              <Metric name="VNA sync" value={state.vna.power && state.clock.locked ? 'SYNC' : 'UNSYNC'} />
              <Metric name="Channel agreement" value={state.clock.locked && !state.clock.holdover ? 'MODELED' : 'DEGRADED'} />
            </div>
          </section>
        </div>
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-sm font-bold">Artifact provenance ledger · illustrative</h2><p className="mt-1 text-[10px] text-zinc-500">Metadata below are demonstration placeholders, not assay certificates.</p></div>
            <label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={strict} onChange={event => enableStrict(event.target.checked)} /> OSF strict-mode constraints (simulation)</label>
          </div>
          <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-zinc-500"><tr>{['ID', 'Role', 'Purity', 'OD', 'Batch'].map(item => <th key={item} className="border-b border-zinc-800 p-2">{item}</th>)}</tr></thead><tbody>{artifacts.map(row => <tr key={row[0]}>{row.map((cell, index) => <td key={index} className="border-b border-zinc-900 p-2 font-mono text-zinc-300">{cell}</td>)}</tr>)}</tbody></table></div>
        </section>
        <section className={card}>
          <h2 className="text-sm font-bold">Standardized 25-field export</h2>
          <p className="mt-1 text-xs text-zinc-400">{LOC1_SCHEMA_ID} v{LOC1_SCHEMA_VERSION}: unknown LOC-1 quantities remain empty rather than being fabricated. This provisional schema must be reconciled with SPHERE-WP-001 before external use.</p>
          <div className="mt-3 flex flex-wrap gap-1">{LOC1_FIELDS.map(field => <code key={field} className="rounded bg-zinc-900 px-1.5 py-1 text-[9px] text-sky-200">{field}</code>)}</div>
          <button onClick={onExportJson} className="mt-3 rounded border border-sky-500/50 px-3 py-2 text-xs font-bold text-sky-200">Download LOC-1 JSON records</button>
        </section>
      </>}

      {tab === 'metrology' && <>
        <div className="grid gap-4 xl:grid-cols-2">
          <section className={card}>
            <h2 className="text-sm font-bold">GUM first-order uncertainty budget</h2>
            <p className="mt-1 text-[10px] text-zinc-500">Illustrative Taylor propagation; covariance input is between thermal and baseline terms. Standard uncertainties below are provisional simulation values.</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field title="Thermal standard uncertainty (K)" value={uThermal} min={0} step="0.001" onChange={setUThermal} />
              <Field title="Clock relative uncertainty (ppb)" value={uClock} min={0} step="0.01" onChange={setUClock} />
              <Field title="Baseline ratio uncertainty (Hz equiv.)" value={uBaseline} min={0} step="0.01" onChange={setUBaseline} />
              <Field title="Thermal/baseline correlation ρ" value={correlation} min={-1} max={1} step="0.05" onChange={setCorrelation} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2"><Metric name="Combined standard uncertainty" value={Number.isFinite(uc) ? uc.toFixed(4) : 'Invalid'} unit="Hz" /><Metric name="Expanded uncertainty (k=2)" value={Number.isFinite(uc) ? (2 * uc).toFixed(4) : 'Invalid'} unit="Hz" /></div>
            {uc < 0 && <p role="alert" className="mt-2 text-xs text-rose-300">Covariance inputs produce negative variance; correct the inputs.</p>}
          </section>
          <section className={card}>
            <h2 className="text-sm font-bold">LMM covariate matrix · Xₚ</h2>
            <p className="mt-1 text-[10px] text-zinc-500">Example design vector; no preregistered model or inferential fit is claimed.</p>
            <div className="mt-3 grid grid-cols-2 gap-3"><Field title="Temperature gradient (K/m)" value={gradient} min={-10} max={10} step="0.001" onChange={setGradient} /><Field title="Time since placement (min)" value={placementMinutes} min={0} step="1" onChange={setPlacementMinutes} /></div>
            <div className="mt-3 overflow-x-auto"><table className="w-full text-left font-mono text-[11px]"><thead className="text-zinc-500"><tr><th className="p-2">Covariate</th><th className="p-2">Xₚ value</th><th className="p-2">Unit</th></tr></thead><tbody>{[['Intercept', '1', '—'], ['Temp gradient', gradient.toFixed(4), 'K/m'], ['Atmospheric pressure', '101.325', 'kPa (assumed)'], ['Time since placement', placementMinutes.toFixed(0), 'min']].map(row => <tr key={row[0]}>{row.map((v, i) => <td key={i} className="border-t border-zinc-800 p-2">{v}</td>)}</tr>)}</tbody></table></div>
          </section>
          <section className={card}>
            <h2 className="text-sm font-bold">MAC matrix · simulated FEA vs LDV</h2>
            <p className="mt-1 text-[10px] text-zinc-500">Synthetic mode-shape concordance illustration; predicted breathing-mode band is above 230 kHz.</p>
            <div className="mt-3 flex flex-wrap gap-6"><HeatMap title="FEA model" values={mac} /><HeatMap title="Simulated LDV" values={ldvMac} /></div>
            <p className="mt-2 text-xs text-sky-200">Mode label: breathing-mode candidate · 230.5 kHz (simulated; not a verified identification).</p>
          </section>
          <section className={card}>
            <h2 className="text-sm font-bold">TOST / SESOI contrast chart</h2>
            <div className="mt-3 grid grid-cols-2 gap-3"><Field title="Contrast Δloc (ppb)" value={contrast} step="0.1" onChange={setContrast} /><Field title="SESOI δ (ppb)" value={delta} min={0.1} step="0.1" disabled={strict} onChange={setDelta} /><Field title="Standard error (ppb)" value={placementSe} min={0.1} step="0.1" onChange={setPlacementSe} /></div>
            <svg viewBox="0 0 500 92" className="mt-3 w-full" role="img" aria-label={`Contrast confidence interval from ${tostLo.toFixed(2)} to ${tostHi.toFixed(2)} ppb and SESOI bounds plus or minus ${delta} ppb`}>
              <rect x="30" y="32" width="440" height="18" fill="#be123c" opacity=".22" /><rect x={Math.max(30, 250 - delta * 22)} y="32" width={Math.min(440, delta * 44)} height="18" fill="#059669" opacity=".45" />
              <line x1="250" y1="16" x2="250" y2="64" stroke="#cbd5e1" /><line x1={Math.max(30, Math.min(470, 250 + contrast * 22 - 1.96 * placementSe * 22))} y1="41" x2={Math.max(30, Math.min(470, 250 + contrast * 22 + 1.96 * placementSe * 22))} y2="41" stroke="#7dd3fc" strokeWidth="5" /><circle cx={Math.max(30, Math.min(470, 250 + contrast * 22))} cy="41" r="5" fill="#e0f2fe" />
              <text x="250" y="82" fill="#94a3b8" fontSize="10" textAnchor="middle">0 · green = equivalence zone; red = outside SESOI (axes illustrative)</text>
            </svg>
            <p className={`text-xs ${equivalent ? 'text-emerald-300' : 'text-amber-300'}`}>{equivalent ? 'Illustrative 95% interval falls within ±δ.' : 'Illustrative interval is not wholly within ±δ.'} Not an inferential test.</p>
          </section>
        </div>
      </>}

      {tab === 'controls' && <>
        <section className={card}>
          <h2 className="text-sm font-bold">Mandatory experimental controls · workflow gate</h2>
          <p className="mt-1 text-[10px] text-zinc-500">Training workflow only. This records operator acknowledgements; it cannot move or verify physical artifacts.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="rounded border border-zinc-800 p-3 text-xs"><input type="checkbox" checked={sham} onChange={event => setSham(event.target.checked)} className="mr-2" />Sham move: lift and replace T</label>
            <label className="rounded border border-zinc-800 p-3 text-xs"><input type="checkbox" checked={rotation90} onChange={event => setRotation90(event.target.checked)} className="mr-2" />In-place rotation: 90°</label>
            <label className="rounded border border-zinc-800 p-3 text-xs"><input type="checkbox" checked={rotation180} onChange={event => setRotation180(event.target.checked)} className="mr-2" />In-place rotation: 180°</label>
            <label className="rounded border border-zinc-800 p-3 text-xs"><input type="checkbox" checked={dummySwap} onChange={event => setDummySwap(event.target.checked)} className="mr-2" />Swap dummy artifact D</label>
          </div>
          <p className="mt-3 text-xs text-zinc-300">Control checklist: {(Number(sham) + Number(rotation90) + Number(rotation180) + Number(dummySwap))}/4 completed</p>
        </section>
        <div className="grid gap-4 md:grid-cols-2">
          <section className={card}>
            <h2 className="text-sm font-bold">Nyquist / aliasing fault injector</h2>
            <label className="mt-3 block text-xs text-zinc-300">ADC sample rate
              <select className={input} value={sampleRate} onChange={event => setSampleRate(Number(event.target.value))}><option value={96000}>96 kS/s</option><option value={192000}>192 kS/s</option><option value={1000000}>1 MS/s (comparison)</option></select>
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2"><Metric name="Signal" value="230.5" unit="kHz" /><Metric name="Nyquist" value={(sampleRate / 2000).toFixed(1)} unit="kHz" /><Metric name="Folded alias" value={(aliasedFrequency / 1000).toFixed(1)} unit="kHz" /><Metric name="Failure" value={230500 > sampleRate / 2 ? 'ALIASED' : 'PASS'} /></div>
            <p className="mt-2 text-[10px] text-amber-200">Audio-rate ADCs cannot directly resolve a 230.5 kHz signal. Illustration only.</p>
          </section>
          <section className={card}>
            <h2 className="text-sm font-bold">Thermal drift · atmospheric baseline</h2>
            <p className="mt-1 text-[10px] text-zinc-500">Requested copper coefficient modeled as 23 Hz/K around a 20 °C setpoint; pressure is held at the LOC-1 assumption of 101.325 kPa.</p>
            <div className="mt-3 grid grid-cols-2 gap-2"><Metric name="Enclosure temperature" value={Number(state.chamber.temperature).toFixed(3)} unit="°C (simulator)" /><Metric name="Modeled frequency shift" value={`${thermalDelta >= 0 ? '+' : ''}${thermalDelta.toFixed(3)}`} unit="Hz" /></div>
            <div className="mt-3"><label className="text-xs text-zinc-300">Non-contact drive amplitude: {drive.toFixed(2)} (relative)<input aria-label="Non-contact drive amplitude" className="mt-2 w-full" type="range" min="0" max="1" step="0.01" value={drive} onChange={event => setDrive(Number(event.target.value))} /></label><Metric name="Illustrative THD" value={(100 * (0.001 + 0.08 * drive ** 2)).toFixed(2)} unit="%" /></div>
          </section>
          <section className={card}>
            <h2 className="text-sm font-bold">Allan deviation · stationary reference R</h2>
            <p className="mt-1 text-[10px] text-zinc-500">Synthetic stability curve, not clock data. Post-placement settling window: 30 minutes as a provisional assumption.</p>
            <svg viewBox="0 0 360 120" role="img" aria-label="Synthetic Allan deviation decreases with averaging time" className="mt-2 w-full rounded bg-black/40">
              <path d="M28 18V96H345M30 30L80 43L135 55L190 66L245 74L300 82L340 87" fill="none" stroke="#38bdf8" strokeWidth="3" /><text x="180" y="114" fill="#94a3b8" fontSize="10" textAnchor="middle">Averaging time τ (s, illustrative)</text>
            </svg>
            <Metric name="Settling gate" value={placementMinutes >= 30 ? 'SIMULATED PASS' : 'WAIT'} unit={`${placementMinutes} / 30 min`} />
          </section>
          <section className={card}>
            <h2 className="text-sm font-bold">Celestial ephemeris covariate logger</h2>
            <p className="mt-1 text-[10px] text-zinc-500">Synthetic placeholders; no Astropy/JPL ephemeris is queried in this offline simulator.</p>
            <div className="mt-3 grid grid-cols-2 gap-2"><Metric name="GCRS velocity X" value="−29.78" unit="km/s · synthetic" /><Metric name="Sidereal orientation" value="16.40" unit="h · synthetic" /></div>
          </section>
        </div>
      </>}

      {tab === 'custody' && <>
        <div className="grid gap-4 xl:grid-cols-2">
          <section className={card}>
            <h2 className="text-sm font-bold">Blinding key custody · mock role separation</h2>
            <p className="mt-1 text-[10px] text-zinc-500">A local demonstration hash is not independent key custody or secure access control.</p>
            <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => void makeSequence()} className="rounded bg-sky-600 px-3 py-2 text-xs font-bold">Generate blinded A/B order</button><button disabled={!sequenceHash || revealed} onClick={() => void unlockSequence()} className="rounded border border-emerald-600 px-3 py-2 text-xs disabled:opacity-40">Virtual unblind</button></div>
            <p className="mt-3 break-all font-mono text-[10px] text-zinc-400">SHA-256: {sequenceHash || 'not generated'}</p>
            {revealed && <p className="mt-2 text-sm font-bold text-emerald-300">Virtual sequence revealed: {sequence}</p>}
            {custodyError && <p role="alert" className="mt-2 text-xs text-rose-300">{custodyError}</p>}
          </section>
          <section className={card}>
            <h2 className="text-sm font-bold">SHA-256 provenance manifest</h2>
            <p className="mt-1 text-[10px] text-zinc-500">Export synthetic ledger data under the SPHERE-LOC1/raw/ directory structure. Hashing is performed in the browser.</p>
            <button onClick={onExportManifest} className="mt-3 rounded border border-sky-500/50 px-3 py-2 text-xs font-bold text-sky-200">Download raw data manifest</button>
          </section>
        </div>
      </>}

      {tab === 'roadmap' && <>
        <section className={card}>
          <h2 className="text-sm font-bold">F0–F9 stage-gate tracker</h2>
          <p className="mt-1 text-[10px] text-zinc-500">Local mock sign-offs; no independent reviewers have verified these milestones.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">{milestones.map(id => <label key={id} className="rounded border border-zinc-800 p-2 text-xs"><input className="mr-2" type="checkbox" checked={!!signoffs[id]} onChange={event => setSignoffs({ ...signoffs, [id]: event.target.checked })} />{id} signed off</label>)}</div>
        </section>
        <div className="grid gap-4 xl:grid-cols-2">
          <section className={card}>
            <h2 className="text-sm font-bold">Staged tranche reconciler · mock budget</h2>
            <div className="mt-3 grid grid-cols-2 gap-3"><Field title="Initial readiness spend ($)" value={tranche} min={0} max={50000} step="100" onChange={setTranche} /><Field title="Vendor quote ($)" value={quoteAmount} min={0} step="100" onChange={setQuoteAmount} /></div>
            <div className="mt-3 h-3 overflow-hidden rounded bg-zinc-800"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, tranche / 50000 * 100))}%` }} /></div>
            <p className={`mt-2 text-xs ${quoteAmount >= 1000 ? 'text-emerald-300' : 'text-amber-300'}`}>$10,000 initial / $50,000 target · {quoteAmount >= 1000 ? 'quote threshold met' : 'vendor quote required at $1,000+'} (illustrative)</p>
          </section>
          <section className={card}>
            <h2 className="text-sm font-bold">DAO-lite treasury · demo only</h2>
            <p className="mt-1 text-[10px] text-zinc-500">Mock Safe L2 multisig custody, no token issuance or on-chain transaction.</p>
            <div className="mt-3 flex items-center gap-3"><button onClick={() => setReviewerVotes(Math.min(3, reviewerVotes + 1))} disabled={reviewerVotes >= 3} className="rounded border border-violet-500/50 px-3 py-2 text-xs disabled:opacity-40">Add virtual reviewer approval</button><Metric name="Approvals" value={`${reviewerVotes}/3`} /></div>
            <p className="mt-2 text-xs text-zinc-500">Milestone-streamed grant: {reviewerVotes >= 2 ? 'demo threshold reached' : 'awaiting two of three demo approvals'}.</p>
          </section>
          <section className={card}>
            <h2 className="text-sm font-bold">MOD-1 active-control sandbox</h2>
            <p className="mt-1 text-xs text-zinc-400">Isolated secondary simulation sequence: A1 → B → A2; no effect on primary dataset.</p>
            <div className="mt-3 flex gap-2">{['A1', 'B', 'A2'].map((point, index) => <div key={point} className={`flex-1 rounded border p-3 text-center font-mono ${index < Math.min(3, records.length) ? 'border-emerald-700 text-emerald-200' : 'border-zinc-800 text-zinc-500'}`}>{point}</div>)}</div>
            <p className="mt-2 text-[10px] text-zinc-500">Passive tuning / active feedback loop comparison is a conceptual control-model placeholder.</p>
          </section>
          <section className={card}>
            <h2 className="text-sm font-bold">Automated SESOI power validator</h2>
            <div className="mt-3 grid grid-cols-2 gap-2"><Metric name="SESOI δ" value={delta.toFixed(2)} unit="ppb" /><Metric name="Required ≥ 3.3 × SE" value={(3.3 * placementSe).toFixed(2)} unit="ppb" /></div>
            <p className={`mt-2 text-xs ${powerPass ? 'text-emerald-300' : 'text-amber-300'}`}>{powerPass ? 'Simulation threshold satisfied.' : 'Increase δ or reduce placement SE before simulated run.'} ≥90% power rule is a requested heuristic, not validated power analysis.</p>
          </section>
        </div>
      </>}
    </div>
  );
}

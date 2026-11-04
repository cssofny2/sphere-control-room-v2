import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Camera, ChevronRight, Crosshair, Play, Square, Wand2, Zap } from 'lucide-react';
import './scope.css';
import { dispatch, getLabState, useEnvironmentStore, useInstrumentStore } from '../state/labStores';
import { CH_COLOR, CHANNELS, DIVS_X, DIVS_Y, SAMPLES, SCOPE_SCENARIOS, SCOPE_SCENARIO_BY_ID, SCOPE_SOURCES, SCOPE_TIMEBASES, SCOPE_USES, SCOPE_VOLTS, fft, type ChannelCfg, type ChannelId, type ScopeSource } from './scopeModel';
import { ProbeMap, ScenarioIcon } from './ScopeArt';
import { AlertBanner, AlertBadge } from './AlertBadge';
import { getAlert } from './alerts';
import { LabClock, formatStamp } from './LabClock';
import { operatorTag } from './operator';

const fmtT = (s: number) => (s >= 1 ? `${+s.toFixed(2)} s` : s >= 1e-3 ? `${+(s * 1e3).toFixed(2)} ms` : s >= 1e-6 ? `${+(s * 1e6).toFixed(2)} µs` : `${+(s * 1e9).toFixed(0)} ns`);
const fmtV = (v: number) => { const a = Math.abs(v); return a >= 1 ? `${v.toFixed(2)} V` : a >= 1e-3 ? `${(v * 1e3).toFixed(a >= 0.1 ? 0 : 1)} mV` : `${(v * 1e6).toFixed(0)} µV`; };
const fmtF = (f: number) => (f >= 1e6 ? `${(f / 1e6).toFixed(3)} MHz` : f >= 1e3 ? `${(f / 1e3).toFixed(2)} kHz` : `${f.toFixed(1)} Hz`);
const fmtRate = (r: number) => (r >= 1e9 ? `${(r / 1e9).toFixed(1)} GSa/s` : r >= 1e6 ? `${(r / 1e6).toFixed(1)} MSa/s` : `${(r / 1e3).toFixed(0)} kSa/s`);
const set = (patch: Record<string, any>) => dispatch({ type: 'PATCH', domain: 'scope', patch });
const setCh = (channels: Record<string, ChannelCfg>, id: ChannelId, patch: Partial<ChannelCfg>) => set({ channels: { ...channels, [id]: { ...channels[id], ...patch } }, ...(id === 'ch1' && patch.scale !== undefined ? { scale: patch.scale } : {}) });

/** Whole-lab snapshot a few times a second, for scenario checks (the scope slice itself updates faster). */
function useSlowState(ms = 350): any {
  const [s, setS] = useState<any>(() => getLabState());
  useEffect(() => { const id = window.setInterval(() => setS(getLabState()), ms); return () => window.clearInterval(id); }, [ms]);
  return s;
}

const Knob = ({ value, steps, fmt, onChange, label, color = '#7dd3fc' }: { value: number; steps: number[]; fmt: (v: number) => string; onChange: (v: number) => void; label: string; color?: string }) => {
  const i = Math.max(0, steps.indexOf(value)), ang = -135 + (i / Math.max(1, steps.length - 1)) * 270;
  const go = (d: number) => onChange(steps[Math.min(steps.length - 1, Math.max(0, i + d))]);
  return (
    <div className="sx-knob" role="group" aria-label={label}>
      <button type="button" className="sx-step" onClick={() => go(-1)} aria-label={`${label} down`} disabled={i <= 0}>−</button>
      <div className="sx-knobface" onWheel={e => { e.preventDefault(); go(e.deltaY > 0 ? -1 : 1); }} title="Scroll to turn">
        <svg width="54" height="54" viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r="24" fill="#0e131b" stroke="#3a4553" strokeWidth="2" />{Array.from({ length: 11 }).map((_, k) => <line key={k} x1="27" y1="5" x2="27" y2="8" stroke="#52627a" transform={`rotate(${-135 + k * 27} 27 27)`} />)}<circle cx="27" cy="27" r="16" fill="#1a212b" stroke="#556070" /><line x1="27" y1="27" x2="27" y2="13" stroke={color} strokeWidth="3" strokeLinecap="round" style={{ transformOrigin: '27px 27px', transform: `rotate(${ang}deg)`, transition: 'transform .25s' }} /></svg>
        <b>{fmt(value)}</b>
      </div>
      <button type="button" className="sx-step" onClick={() => go(1)} aria-label={`${label} up`} disabled={i >= steps.length - 1}>+</button>
    </div>
  );
};

function BootScreen({ p }: { p: number }) {
  const tests = ['Acquisition ADC', 'Timebase PLL', 'Trigger system', 'Probe interfaces', 'Display'];
  return (
    <div className="sx-boot" role="status" aria-label="Oscilloscope starting up">
      <div className="sx-boot-logo">TEKTRONIX</div><div className="sx-boot-sub">5 SERIES MSO · 1 GHz · 12-bit</div>
      <ul>{tests.map((t, i) => <li key={t} className={p > (i + 1) / (tests.length + 0.5) ? 'ok' : ''}><span>{p > (i + 1) / (tests.length + 0.5) ? '✓' : '…'}</span>{t}</li>)}</ul>
      <div className="sx-boot-bar"><i style={{ width: `${Math.round(p * 100)}%` }} /></div>
    </div>
  );
}

function Spectrum({ samples, rate, color, label }: { samples: number[]; rate: number; color: string; label: string }) {
  const r = useMemo(() => fft(samples, rate), [samples, rate]);
  if (!r.f.length) return null;
  const maxF = r.f[r.f.length - 1], lo = -100, hi = 20;
  const pts = r.f.map((f, i) => `${((f / maxF) * 1000).toFixed(1)},${(200 - ((Math.max(lo, Math.min(hi, r.db[i])) - lo) / (hi - lo)) * 200).toFixed(1)}`).join(' ');
  return (
    <div className="sx-fft">
      <div className="sx-fft-h"><b style={{ color }}>FFT · {label}</b><span>peak {fmtF(r.peakF)} at {r.peakDb.toFixed(0)} dBV · span 0–{fmtF(maxF)}</span></div>
      <svg viewBox="0 0 1000 200" preserveAspectRatio="none" role="img" aria-label="Frequency spectrum">
        {[0, 1, 2, 3, 4].map(i => <line key={i} x1="0" x2="1000" y1={i * 50} y2={i * 50} stroke="#142030" />)}{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => <line key={i} y1="0" y2="200" x1={i * 100} x2={i * 100} stroke="#142030" />)}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        <line x1={(r.peakF / maxF) * 1000} x2={(r.peakF / maxF) * 1000} y1="0" y2="200" stroke="#fbbf24" strokeDasharray="3 4" opacity=".7" />
      </svg>
    </div>
  );
}

export const Scope = memo(function Scope({ HelpInfo }: { HelpInfo: any }) {
  const sc = useInstrumentStore(s => s.scope);
  const facilityPower = useEnvironmentStore(s => s.facility.power);
  const operator = useEnvironmentStore(s => (s as any).operator);
  const full = useSlowState();
  const svgRef = useRef<SVGSVGElement>(null);
  const hist = useRef<Record<string, string[]>>({});
  const [openScn, setOpenScn] = useState<string | null>(sc.scenario || null);
  const [saved, setSaved] = useState('');
  const channels = sc.channels as Record<ChannelId, ChannelCfg>;
  const alert = getAlert(full, 'scope');
  const ready = sc.power && !sc.booting;
  const T = DIVS_X * sc.timebase * 1e-6, rate = sc.sampleRate || (SAMPLES - 1) / T;

  const lines = useMemo(() => {
    const out: Record<string, string> = {};
    for (const id of CHANNELS) {
      const tr = sc.channelTraces?.[id] as number[] | undefined, c = channels[id];
      if (!c?.enabled || !tr?.length) continue;
      out[id] = tr.map((v, i) => `${((i * 1000) / (tr.length - 1)).toFixed(1)},${Math.max(-30, Math.min(530, 250 - (v / c.scale + c.offset) * (500 / DIVS_Y))).toFixed(1)}`).join(' ');
    }
    return out;
  }, [sc.channelTraces, channels]);
  // short phosphor-style persistence: keep the last few captures
  const lastAcq = useRef(-1);
  if (ready && sc.acqCount !== lastAcq.current) { lastAcq.current = sc.acqCount; for (const id of CHANNELS) { const h = (hist.current[id] ||= []); if (lines[id]) { h.unshift(lines[id]); h.length = Math.min(h.length, 4); } else h.length = 0; } }
  const trigCh = String(sc.triggerSource || 'CH1').toLowerCase() as ChannelId, trigCfg = channels[trigCh];
  const trigY = trigCfg ? 250 - (sc.triggerLevel / trigCfg.scale + trigCfg.offset) * (500 / DIVS_Y) : 250;
  const enabledIds = CHANNELS.filter(id => channels[id]?.enabled);
  const fftId = (sc.fftChannel && channels[sc.fftChannel as ChannelId]?.enabled ? sc.fftChannel : enabledIds[0]) as ChannelId | undefined;
  const fx = (i: number) => `${((i * 100) / DIVS_X).toFixed(1)}%`;
  const cursorA = sc.cursorA as number | null, cursorB = sc.cursorB as number | null;

  const tr0 = enabledIds[0] ? (sc.channelTraces?.[enabledIds[0]] as number[]) : [];
  const cur = cursorA != null && cursorB != null ? { dt: Math.abs(cursorB - cursorA) * T, dv: tr0?.length ? Math.abs(tr0[Math.round(cursorB * (SAMPLES - 1))] - tr0[Math.round(cursorA * (SAMPLES - 1))]) : 0 } : null;

  const click = (e: React.PointerEvent<SVGSVGElement>) => {
    if (cursorA == null && cursorB == null) return;
    const r = e.currentTarget.getBoundingClientRect(), f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    set(e.shiftKey || (cursorA != null && Math.abs(f - cursorA) > Math.abs(f - (cursorB ?? cursorA))) ? { cursorB: f } : { cursorA: f });
  };
  const status = !sc.power ? 'OFF' : sc.booting ? 'BOOT' : !sc.running ? 'STOP' : sc.triggerState === 'armed' ? 'WAIT' : sc.triggerState === 'triggered' ? "TRIG'D" : sc.triggerState === 'unstable' ? 'UNSTBL' : 'AUTO';

  const saveShot = () => {
    const el = svgRef.current; if (!el) return;
    const xml = new XMLSerializer().serializeToString(el), img = new Image(), stamp = formatStamp(new Date()), who = operatorTag(operator);
    img.onload = () => {
      const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 560; const g = cv.getContext('2d'); if (!g) return;
      g.fillStyle = '#02060a'; g.fillRect(0, 0, 1000, 560); g.drawImage(img, 0, 0, 1000, 500);
      g.fillStyle = '#9fd3f0'; g.font = '14px ui-monospace,monospace'; g.fillText(`SPHERE Tektronix 5 Series MSO  ·  ${stamp}${who ? `  ·  operator ${who}` : ''}  ·  ${fmtT(sc.timebase * 1e-6)}/div`, 12, 530);
      cv.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `sphere-scope-${stamp.replace(/[: ]/g, '-')}.png`; a.click(); window.setTimeout(() => URL.revokeObjectURL(a.href), 3000); setSaved(`Saved ${stamp}`); dispatch({ type: 'EVENT', text: 'Oscilloscope screen saved as PNG.', level: 'info', subsystem: 'SCOPE' }); }, 'image/png');
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml.includes('xmlns=') ? xml : xml.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'))}`;
  };

  const scn = openScn ? SCOPE_SCENARIO_BY_ID[openScn] : null;
  return (
    <div className="space-y-4 sx-root">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center">Tektronix 5 Series MSO — Oscilloscope <HelpInfo termKey="scope" /></h1>
          <p className="mt-1 text-sm text-zinc-400 max-w-3xl">A window onto the raw electrical and vibration signals of the experiment. Each channel is wired to one real signal in the lab, so what you see changes when you change the lab.</p>
        </div>
        <div className="flex items-center gap-2"><AlertBadge info={alert} showIdle name="Oscilloscope" /><LabClock variant="block" sim={full.facility?.simulationTime} /></div>
      </div>
      <AlertBanner info={alert} name="Oscilloscope" onGo={p => dispatch({ type: 'SET_UI', patch: { active: p } })} />

      <div className="sx-grid">
        <div className="sx-body">
          <div className="sx-head">
            <span className={`sx-pled ${sc.power ? (sc.booting ? 'boot' : 'on') : ''}`} aria-hidden="true" />
            <b>TEKTRONIX 5 SERIES MSO</b><span className="sx-spec">1 GHz · 12-bit ADC · 4 analog channels</span>
            <button type="button" className={`sx-power ${sc.power ? 'on' : ''}`} disabled={!facilityPower} aria-pressed={sc.power} onClick={() => set({ power: !sc.power, running: true })}>{sc.power ? 'Power OFF' : 'Power ON'}</button>
          </div>

          <div className="sx-screenwrap">
            <div className="sx-topbar" aria-label="Scope status line">
              <span className={`sx-state st-${status.replace(/\W/g, '')}`}>{status}</span>
              <span>H <b>{fmtT(sc.timebase * 1e-6)}</b>/div</span><span>{fmtRate(rate)}</span><span>{fmtT(T)} / screen</span>
              <span>Trig {String(sc.triggerSource)} {sc.triggerSlope === 'falling' ? '↘' : '↗'} {fmtV(sc.triggerLevel)}</span>
              <span className="sx-acq">{sc.acqCount || 0} acq</span>
            </div>
            <div className="sx-screen" data-power={sc.power ? 'on' : 'off'}>
              {!sc.power && <div className="sx-off"><span>OFF</span><small>{facilityPower ? 'Press Power ON' : 'Close the main breaker first'}</small></div>}
              {sc.power && sc.booting && <BootScreen p={sc.bootProgress || 0} />}
              <svg ref={svgRef} viewBox="0 0 1000 500" preserveAspectRatio="none" className="sx-svg" onPointerDown={click} role="img" aria-label={`Oscilloscope screen showing ${enabledIds.length} channel${enabledIds.length === 1 ? '' : 's'}`} style={{ opacity: ready ? 1 : 0.05 }}>
                <rect width="1000" height="500" fill="#03080d" />
                {Array.from({ length: DIVS_X + 1 }).map((_, i) => <line key={`v${i}`} x1={i * 100} x2={i * 100} y1="0" y2="500" stroke={i === 5 ? '#2c4258' : '#142535'} />)}
                {Array.from({ length: DIVS_Y + 1 }).map((_, i) => <line key={`h${i}`} y1={i * 62.5} y2={i * 62.5} x1="0" x2="1000" stroke={i === 4 ? '#2c4258' : '#142535'} />)}
                {Array.from({ length: 50 }).map((_, i) => <line key={`tx${i}`} x1={i * 20} x2={i * 20} y1="247" y2="253" stroke="#27405a" />)}
                {Array.from({ length: 40 }).map((_, i) => <line key={`ty${i}`} y1={i * 12.5} y2={i * 12.5} x1="497" x2="503" stroke="#27405a" />)}
                {ready && sc.persist && CHANNELS.map(id => (hist.current[id] || []).slice(1).map((p, k) => <polyline key={`${id}${k}`} points={p} fill="none" stroke={CH_COLOR[id]} strokeWidth="1.4" opacity={0.32 - k * 0.08} vectorEffect="non-scaling-stroke" />))}
                {ready && enabledIds.map(id => lines[id] && <polyline key={id} points={lines[id]} fill="none" stroke={CH_COLOR[id]} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 3px ${CH_COLOR[id]}88)` }} />)}
                {ready && trigCfg && <g><line x1="0" x2="1000" y1={trigY} y2={trigY} stroke={CH_COLOR[trigCh]} strokeDasharray="6 6" opacity=".45" /><path d={`M994 ${trigY - 6} l-12 6 l12 6z`} fill={CH_COLOR[trigCh]} /><path d="M500 0 l-6 -0 l6 8 l6 -8z" fill="#fbbf24" /></g>}
                {ready && cursorA != null && <g><line x1={cursorA * 1000} x2={cursorA * 1000} y1="0" y2="500" stroke="#fbbf24" strokeDasharray="4 4" /><text x={cursorA * 1000 + 6} y="14" fill="#fbbf24" fontSize="14" fontFamily="ui-monospace,monospace">A</text></g>}
                {ready && cursorB != null && <g><line x1={cursorB * 1000} x2={cursorB * 1000} y1="0" y2="500" stroke="#fb923c" strokeDasharray="4 4" /><text x={cursorB * 1000 + 6} y="14" fill="#fb923c" fontSize="14" fontFamily="ui-monospace,monospace">B</text></g>}
                {ready && !enabledIds.length && <text x="500" y="250" textAnchor="middle" fill="#64748b" fontSize="22" fontFamily="ui-monospace,monospace">No channels on</text>}
                {ready && sc.running && sc.triggerState === 'armed' && <text x="500" y="60" textAnchor="middle" fill="#fb923c" fontSize="22" fontFamily="ui-monospace,monospace">WAITING FOR TRIGGER</text>}
              </svg>
              <div className="sx-bottombar">
                {enabledIds.map(id => <span key={id} className="sx-chlabel" style={{ color: CH_COLOR[id], borderColor: CH_COLOR[id] }}>{id.toUpperCase()} {fmtV(channels[id].scale)}/div {channels[id].coupling}</span>)}
                <span className="sx-clock"><LabClock variant="screen" /></span>
              </div>
            </div>
          </div>

          {sc.fftEnabled && ready && fftId && sc.channelTraces?.[fftId]?.length > 0 && <Spectrum samples={sc.channelTraces[fftId]} rate={rate} color={CH_COLOR[fftId]} label={`${fftId.toUpperCase()} · ${SCOPE_SOURCES[channels[fftId].source].label}`} />}

          <div className="sx-bar" role="toolbar" aria-label="Scope controls">
            <button type="button" className={`sx-btn ${sc.running ? 'on' : ''}`} disabled={!ready} aria-pressed={sc.running} onClick={() => set({ running: !sc.running })}>{sc.running ? <><Square size={13} /> Stop</> : <><Play size={13} /> Run</>}</button>
            <button type="button" className={`sx-btn ${sc.holdMode === 'single' ? 'on' : ''}`} disabled={!ready} aria-pressed={sc.holdMode === 'single'} onClick={() => set({ holdMode: 'single', running: true, triggerState: 'armed' })} title="Arm for one capture, then stop"><Zap size={13} /> Single</button>
            <button type="button" className="sx-btn" disabled={!ready} onClick={() => dispatch({ type: 'SCOPE_AUTOSET' })} title="Pick a timebase, volts/div and trigger that suit the signals"><Wand2 size={13} /> Autoset</button>
            <button type="button" className={`sx-btn ${sc.persist ? 'on' : ''}`} disabled={!ready} aria-pressed={!!sc.persist} onClick={() => set({ persist: !sc.persist })} title="Keep fading copies of the last captures">Persistence</button>
            <button type="button" className={`sx-btn ${cursorA != null ? 'on' : ''}`} disabled={!ready} aria-pressed={cursorA != null} onClick={() => set(cursorA != null ? { cursorA: null, cursorB: null } : { cursorA: 0.3, cursorB: 0.6 })} title="Two time cursors: click the screen to place A, Shift+click to place B"><Crosshair size={13} /> Cursors</button>
            <button type="button" className={`sx-btn ${sc.fftEnabled ? 'on' : ''}`} disabled={!ready} aria-pressed={!!sc.fftEnabled} onClick={() => set({ fftEnabled: !sc.fftEnabled })} title="Show the frequency content of a channel">FFT</button>
            <button type="button" className="sx-btn" disabled={!ready} onClick={saveShot} title="Save a PNG with date, time and operator"><Camera size={13} /> Save screen</button>
            {saved && <span className="sx-saved" role="status">{saved}</span>}
          </div>

          <div className="sx-controls">
            <div className="sx-card">
              <div className="sx-card-h">Horizontal <HelpInfo termKey="timebase" /></div>
              <Knob label="Timebase" value={sc.timebase} steps={SCOPE_TIMEBASES} fmt={v => `${fmtT(v * 1e-6)}/div`} onChange={v => set({ timebase: v })} />
              <p className="sx-hint">Turn clockwise to zoom out in time. {fmtT(T)} fits on screen; the scope samples at {fmtRate(rate)}.</p>
            </div>
            <div className="sx-card">
              <div className="sx-card-h">Trigger <HelpInfo termKey="scope_trigger" /></div>
              <div className="sx-row"><label>Source<select value={sc.triggerSource} onChange={e => set({ triggerSource: e.target.value })}>{CHANNELS.map(id => <option key={id} value={id.toUpperCase()}>{id.toUpperCase()}</option>)}</select></label>
                <label>Slope<select value={sc.triggerSlope || 'rising'} onChange={e => set({ triggerSlope: e.target.value })}><option value="rising">Rising ↗</option><option value="falling">Falling ↘</option></select></label></div>
              <label className="sx-wide">Level <b>{fmtV(sc.triggerLevel)}</b><input type="range" min="-2" max="2" step="0.01" value={sc.triggerLevel} onChange={e => set({ triggerLevel: Number(e.target.value) })} aria-label="Trigger level in volts" /></label>
              <div className="sx-seg" role="group" aria-label="Sweep mode">{(['auto', 'normal', 'single'] as const).map(m => <button key={m} type="button" aria-pressed={(sc.holdMode || 'auto') === m} onClick={() => set({ holdMode: m, running: true })}>{m[0].toUpperCase() + m.slice(1)}</button>)}</div>
              <p className="sx-hint"><span className={`sx-state st-${status.replace(/\W/g, '')}`}>{status}</span> {sc.triggerState === 'armed' ? 'Nothing crosses the level. Lower it, or pick Auto.' : sc.triggerState === 'unstable' ? 'Trigger is jumping: noise or a very fast signal.' : sc.triggerState === 'triggered' ? 'Locked to the waveform: the picture is steady.' : 'Free-running picture slides across.'}</p>
            </div>
            <div className="sx-card">
              <div className="sx-card-h">Display</div>
              <label className="sx-wide">FFT channel<select value={fftId || 'ch1'} onChange={e => set({ fftChannel: e.target.value })}>{CHANNELS.map(id => <option key={id} value={id}>{id.toUpperCase()}</option>)}</select></label>
              <p className="sx-hint">Cursors: click the screen for A, Shift+click for B.{cur ? <> Δt <b>{fmtT(cur.dt)}</b> · 1/Δt <b>{fmtF(1 / Math.max(cur.dt, 1e-12))}</b> · ΔV <b>{fmtV(cur.dv)}</b></> : ''}</p>
            </div>
          </div>

          <div className="sx-channels">
            {CHANNELS.map(id => {
              const c = channels[id], m = sc.measure?.[id];
              return (
                <div key={id} className={`sx-ch ${c.enabled ? 'on' : ''}`} style={{ '--c': CH_COLOR[id] } as React.CSSProperties}>
                  <div className="sx-ch-h"><label><input type="checkbox" checked={c.enabled} onChange={e => setCh(channels, id, { enabled: e.target.checked })} disabled={!sc.power} /> <b>{id.toUpperCase()}</b></label><span>{SCOPE_SOURCES[c.source].label}</span></div>
                  <label>Watches<select value={c.source} onChange={e => setCh(channels, id, { source: e.target.value as ScopeSource })}>{(Object.keys(SCOPE_SOURCES) as ScopeSource[]).map(k => <option key={k} value={k}>{SCOPE_SOURCES[k].label}</option>)}</select></label>
                  <div className="sx-row"><label>V/div<select value={c.scale} onChange={e => setCh(channels, id, { scale: Number(e.target.value) })}>{SCOPE_VOLTS.map(v => <option key={v} value={v}>{fmtV(v)}</option>)}</select></label>
                    <label>Coupling<select value={c.coupling} onChange={e => setCh(channels, id, { coupling: e.target.value as 'AC' | 'DC' })}><option>DC</option><option>AC</option></select></label></div>
                  <label className="sx-wide">Position <b>{c.offset.toFixed(1)} div</b><input type="range" min="-4" max="4" step="0.1" value={c.offset} onChange={e => setCh(channels, id, { offset: Number(e.target.value) })} /></label>
                  <div className="sx-mini">{c.enabled && m ? <><span>{m.freq ? `${m.dense ? '≈' : ''}${fmtF(m.freq)}` : '— Hz'}</span><span>{fmtV(m.vpp)} pk-pk</span></> : <span>{c.enabled ? 'no data' : 'off'}</span>}</div>
                </div>
              );
            })}
          </div>

          <div className="sx-card sx-meas">
            <div className="sx-card-h">Measurements <span className="sx-sub">(live, from the captured screen)</span></div>
            <table><thead><tr><th>Ch</th><th>Signal</th><th>Frequency</th><th>Period</th><th>Pk-pk</th><th>RMS (AC)</th><th>Mean</th></tr></thead>
              <tbody>{enabledIds.length ? enabledIds.map(id => { const m = sc.measure?.[id]; return <tr key={id}><td style={{ color: CH_COLOR[id] }}><b>{id.toUpperCase()}</b></td><td>{SCOPE_SOURCES[channels[id].source].label}</td><td>{m?.freq ? `${m.dense ? '≈ ' : ''}${fmtF(m.freq)}` : '—'}</td><td>{m?.period ? fmtT(m.period) : '—'}</td><td>{m ? fmtV(m.vpp) : '—'}</td><td>{m ? fmtV(m.vrms) : '—'}</td><td>{m ? fmtV(m.vmean) : '—'}</td></tr>; }) : <tr><td colSpan={7}>Turn a channel on to see measurements.</td></tr>}</tbody></table>
            {enabledIds.some(id => sc.measure?.[id]?.dense) && <p className="sx-hint">“≈” means the signal is faster than the screen can resolve cycle-by-cycle (shown as a solid band); the frequency is the instrument’s nominal value. Shorten the timebase to see the cycles.</p>}
          </div>
        </div>

        <aside className="sx-side">
          <div className="sx-card">
            <div className="sx-card-h">What this scope is for in the experiment</div>
            <p className="sx-p">The VNA finds the sphere’s resonance, but it cannot tell you <em>why</em> a reading is noisy. The oscilloscope shows the raw signals underneath: the RF tone being sent in, the vibrometer’s output, the shared clock, and the room around the chamber. If a measurement looks wrong, the scope usually shows the cause.</p>
            <ul className="sx-uses">{SCOPE_USES.map(u => <li key={u.title}><b>{u.title}</b><span>{u.body}</span></li>)}</ul>
          </div>
          <div className="sx-card"><div className="sx-card-h">Where each probe is connected</div><ProbeMap channels={channels} power={!!sc.power} /><p className="sx-hint">Change “Watches” on a channel and its wire moves to another piece of equipment.</p></div>
        </aside>
      </div>

      <section className="sx-scn" aria-label="Scenarios">
        <h2>Try it: guided scenarios <span>— each loads a ready-made setup, tells you what to do in the lab, and checks your result</span></h2>
        <div className="sx-scn-grid">
          {SCOPE_SCENARIOS.map(x => <button key={x.id} type="button" className={`sx-scn-card ${openScn === x.id ? 'sel' : ''} ${full && x.check(full) ? 'done' : ''}`} aria-pressed={openScn === x.id} onClick={() => setOpenScn(openScn === x.id ? null : x.id)}><ScenarioIcon kind={x.icon} /><span><b>{x.title}</b><small>{x.goal}</small></span>{full && x.check(full) && <i className="sx-tick" aria-label="Goal met">✓</i>}</button>)}
        </div>
        {scn && (
          <div className="sx-scn-detail">
            <div className="sx-scn-top"><ScenarioIcon kind={scn.icon} size={72} /><div><h3>{scn.title}</h3><p>{scn.goal}</p></div>
              <button type="button" className="sx-btn on" disabled={!full.facility?.power || !full.scope?.power} onClick={() => dispatch({ type: 'SCOPE_SCENARIO', id: scn.id })}>Apply scope setup <ChevronRight size={13} /></button></div>
            <div className="sx-scn-cols">
              <div><h4>Why it matters</h4><p>{scn.why}</p><h4>Lab prerequisites</h4>
                <ul className="sx-pre">{scn.prereq.map(p => { const ok = p.ok(full); return <li key={p.label} className={ok ? 'ok' : ''}><span>{ok ? '✓' : '○'}</span>{p.label}{!ok && p.fix && <button type="button" onClick={() => dispatch({ type: 'PATCH', domain: p.fix!.domain, patch: p.fix!.patch })}>Do it for me</button>}</li>; })}</ul></div>
              <div><h4>Steps</h4><ol>{scn.steps.map(t => <li key={t}>{t}</li>)}</ol><h4>What you should see</h4><ul>{scn.expect.map(t => <li key={t}>{t}</li>)}</ul></div>
              <div><h4>Try this too</h4><p>{scn.tryThis}</p><div className={`sx-goal ${scn.check(full) ? 'ok' : ''}`} role="status"><span>{scn.check(full) ? '✓ Goal met' : '○ Goal not met yet'}</span>{scn.checkText}</div></div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
});

export default Scope;

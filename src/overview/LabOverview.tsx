import React, { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, ChevronRight, Cpu, Power, Radio, ScanLine,
  ShieldCheck, Target, TimerReset, Thermometer, Wind,
} from 'lucide-react';
import './overview.css';
import { HELP_KEYS, OVERVIEW_HELP, getHelp } from './overviewHelp';

/* ───────── Types ───────── */
type Lab = {
  getSubsystemVisualState: (s: any, k: string) => string;
  visualToken: (v: string) => any;
  fmtPressure: (p: number) => string;
  WARMUP_SECONDS: number;
  resolveHelp: (key: string) => any;
};
type Props = { state: any; dispatch: (a: any) => void; lab: Lab; quality: string; reduced: boolean };
type Tone = 'ok' | 'warn' | 'bad' | 'off' | '';
type Read = { l: string; h: string; v: string; tone?: Tone };
type Equip = {
  id: string; k: string; name: string; help: string; page: string; icon: any;
  x: number; y: number; w: number; h: number; nested?: boolean;
  reads: Read[]; viz?: React.ReactNode; main: string;
};
type RouteKind = 'clock' | 'rf' | 'laser' | 'laserReturn' | 'data' | 'vacuum';
type Route = { id: string; kind: RouteKind; d: string; from: string; to: string; on: boolean; label: string; badge: [number, number] };

/* ───────── Constants ───────── */
const SCENE_W = 860;
const SCENE_H = 720;
const ROUTE_COLOR: Record<RouteKind, string> = { clock: '#22d3ee', rf: '#e879f9', laser: '#facc15', laserReturn: '#fde68a', data: '#3b82f6', vacuum: '#94a3b8' };
const ROUTE_NAME: Record<RouteKind, string> = { clock: 'Clock', rf: 'RF', laser: 'Laser', laserReturn: 'Return', data: 'Data', vacuum: 'Vacuum' };
const ROUTE_HELP: Record<RouteKind, string> = { clock: 'ov.route_clock', rf: 'ov.route_rf', laser: 'ov.route_laser', laserReturn: 'ov.route_laser_return', data: 'ov.route_data', vacuum: 'ov.route_vacuum' };
const ROUTE_ALARM: Record<RouteKind, string> = { clock: 'clock', rf: 'rf|vna', laser: 'laser|ldv', laserReturn: 'laser|ldv', data: 'data', vacuum: 'vacuum|pressure|turbo' };
const ALL_LAYERS = { clock: true, rf: true, laser: true, laserReturn: true, data: true, vacuum: true };
const STATE_KEYS = ['offline', 'standby', 'ready', 'active', 'valid', 'stable', 'warning', 'fault', 'booting', 'settling', 'maintenance', 'selected'];
const STATE_PRIORITY: Record<string, number> = { fault: 0, warning: 1, maintenance: 2, booting: 3, settling: 4, active: 5, ready: 6, valid: 7, stable: 7, standby: 8, offline: 9, selected: 10 };
const TONE_HEX = { ok: '#34d399', warn: '#fbbf24', bad: '#fb7185', info: '#38bdf8', off: '#64748b' };
const PREF_KEY = 'sphere-lab-overview-prefs';

/* ───────── Small helpers ───────── */
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const num = (n: any, d = 1) => (Number.isFinite(n) ? (Math.abs(n) < 0.5 * Math.pow(10, -d) ? 0 : n).toFixed(d) : '–');
const onOff = (b: boolean) => (b ? 'ON' : 'OFF');

function loadPrefs(): any {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch { return {}; }
}
function savePrefs(p: any) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* storage can be blocked; the page still works */ }
}
function alarmRegex(k: string) {
  return new RegExp(k === 'chamber' || k === 'pumps' ? 'turbo|vacuum|pressure|door' : k === 'experiment' ? 'experiment|scan|run' : k === 'stage' ? 'stage' : k, 'i');
}
function downsample(values: number[], max = 60) {
  if (values.length <= max) return values;
  const step = values.length / max;
  return Array.from({ length: max }, (_, i) => values[Math.floor(i * step)]);
}

/* ───────── Help button context ───────── */
const HelpCtx = createContext<{ open: (k: string) => void }>({ open: () => {} });

const Q = memo(function Q({ k, big = false }: { k: string; big?: boolean }) {
  const { open } = useContext(HelpCtx);
  const title = getHelp(k).title;
  return (
    <button
      type="button"
      className={`ov-q${big ? ' is-big' : ''}`}
      aria-label={`What does “${title}” mean?`}
      title="What's this?"
      onClick={e => { e.stopPropagation(); open(k); }}
    >?</button>
  );
});
const T = ({ k, children }: { k: string; children: React.ReactNode }) => <span className="ov-term">{children}<Q k={k} /></span>;

/* ───────── Mini visuals ───────── */
function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) {
    return <svg className="ov-spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="12" x2="100" y2="12" stroke="#334155" strokeWidth="1.5" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" /></svg>;
  }
  const pts = downsample(values);
  const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
  const d = pts.map((v, i) => `${((i / (pts.length - 1)) * 100).toFixed(1)},${(21 - ((v - lo) / span) * 18).toFixed(1)}`).join(' ');
  return <svg className="ov-spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><polyline points={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>;
}
const Bar = ({ value, color }: { value: number; color?: string }) => (
  <div className="ov-bar" style={color ? ({ '--bc': color } as React.CSSProperties) : undefined}><i style={{ width: `${clamp(value, 0, 1) * 100}%` }} /></div>
);

/* ───────── Component ───────── */
export default function LabOverview({ state, dispatch, lab, quality, reduced }: Props) {
  const prefs = useMemo(loadPrefs, []);
  const [selected, setSelected] = useState<string>('chamber');
  const [view, setView] = useState<'flat' | 'tilt' | 'orbit'>(prefs.view || 'tilt');
  const [orbit, setOrbit] = useState({ rx: 16, ry: -10 });
  const [layers, setLayers] = useState<Record<RouteKind, boolean>>({ ...ALL_LAYERS });
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [showHelp, setShowHelp] = useState<boolean>(prefs.showHelp !== false);
  const [sort, setSort] = useState<'lab' | 'state' | 'name'>('lab');
  const [feedTab, setFeedTab] = useState<'alarms' | 'events'>('alarms');
  const [eventFilter, setEventFilter] = useState<'all' | 'problems'>('all');
  const [query, setQuery] = useState('');
  const [dragging, setDragging] = useState(false);
  const moved = useRef(false);

  useEffect(() => { savePrefs({ view, showHelp }); }, [view, showHelp]);

  const open = useCallback((k: string) => dispatch({ type: 'SET_UI', patch: { helpModal: lab.resolveHelp(k) } }), [dispatch, lab]);
  const helpCtx = useMemo(() => ({ open }), [open]);
  const go = (page: string) => dispatch({ type: 'SET_UI', patch: { active: page } });

  /* ───── Derived data ───── */
  const s = state, c = s.chamber, st = s.stage, v = s.vna, l = s.ldv, sc = s.scope, ck = s.clock, ex = s.experiment, f = s.facility;
  const openAlarms = (s.alarms || []).filter((a: any) => !a.acknowledged);
  const criticalCount = openAlarms.filter((a: any) => a.severity === 'critical').length;
  const faultFor = (k: string) => openAlarms.some((a: any) => alarmRegex(k).test(a.text || ''));
  const stateOf = (e: { k: string }) => (faultFor(e.k) && e.k !== 'facility' ? 'fault' : lab.getSubsystemVisualState(s, e.k));

  const clockText = !ck.power ? 'OFF' : ck.cableFault || s.failures.clockDrift ? 'FAULT' : ck.holdover ? 'HOLDOVER' : ck.locked ? 'LOCKED' : `WARMING ${Math.min(100, Math.round((ck.warmup / lab.WARMUP_SECONDS) * 100))}%`;
  const clockTone: Tone = !ck.power ? 'off' : clockText === 'LOCKED' ? 'ok' : clockText === 'FAULT' ? 'bad' : 'warn';
  const drift = c.temperature - c.targetTemp;
  const tempSteady = Math.abs(drift) < 0.03;
  const pressureFrac = clamp((Math.log10(760) - Math.log10(Math.max(c.pressure, 1e-6))) / (Math.log10(760) + 6), 0, 1);
  const pressureTrend = c.vent ? '↑' : c.roughing || c.turbo ? '↓' : '→';
  const returnPct = l.power && l.shutter ? Math.round((l.laserReturn || 0) * 100) : 0;
  const channelsOn = Object.values(sc.channels || {}).filter((ch: any) => ch.enabled).length;
  const records = ex.records || [];
  const accepted = ex.acceptedPoints || 0, suspect = ex.suspectPoints || 0, failed = ex.failedPoints || 0;
  const scoreTotal = accepted + suspect + failed;

  const equip: Equip[] = [
    {
      id: 'clock', k: 'clock', name: '10 MHz Reference', help: 'ov.clock', page: 'clock', icon: TimerReset, x: 24, y: 20, w: 196, h: 150, main: clockText,
      reads: [
        { l: 'Lock', h: 'ov.lock', v: clockText, tone: clockTone },
        { l: 'Warm-up', h: 'ov.warmup', v: `${Math.min(100, Math.round((ck.warmup / lab.WARMUP_SECONDS) * 100))}%` },
        { l: 'Output', h: 'ov.ref10', v: ck.locked ? '10 MHz' : '—', tone: ck.locked ? 'ok' : 'off' },
      ],
      viz: <Bar value={ck.power ? ck.warmup / lab.WARMUP_SECONDS : 0} color={TONE_HEX.info} />,
    },
    {
      id: 'vna', k: 'vna', name: 'E5080B VNA', help: 'ov.vna', page: 'vna', icon: Radio, x: 24, y: 194, w: 196, h: 158,
      main: v.power ? `RF ${onOff(v.rf)}` : 'OFF',
      reads: [
        { l: 'RF output', h: 'ov.rf', v: v.power ? onOff(v.rf) : 'OFF', tone: v.power && v.rf ? 'ok' : 'off' },
        { l: 'Calibration', h: 'ov.calibration', v: v.calibrated ? 'VALID' : 'NONE', tone: v.calibrated ? 'ok' : v.power ? 'warn' : 'off' },
        { l: 'S11 trace', h: 'ov.s11', v: v.trace?.length ? `${v.trace.length} pts` : 'none', tone: v.trace?.length ? '' : 'off' },
      ],
      viz: <Spark values={(v.trace || []).map((q: any) => q.s11)} color="#5fd4ff" />,
    },
    {
      id: 'scope', k: 'scope', name: 'Oscilloscope', help: 'ov.scope', page: 'scope', icon: Activity, x: 24, y: 376, w: 196, h: 160,
      main: sc.power ? (sc.running ? 'RUN' : 'STOP') : 'OFF',
      reads: [
        { l: 'Acquisition', h: 'ov.running', v: sc.power ? (sc.running ? 'RUN' : 'STOP') : 'OFF', tone: sc.power ? (sc.running ? 'ok' : 'warn') : 'off' },
        { l: 'Timebase', h: 'ov.timebase', v: `${sc.timebase} µs/div` },
        { l: 'Channels', h: 'ov.channels', v: `${channelsOn} / 4` },
      ],
      viz: <Spark values={(sc.trace || []).map((q: any) => q.value)} color="#ffe066" />,
    },
    {
      id: 'facility', k: 'facility', name: 'Power & Shielding', help: 'ov.facility', page: 'dashboard', icon: Power, x: 24, y: 560, w: 196, h: 138, main: `Breaker ${onOff(f.power)}`,
      reads: [
        { l: 'Breaker', h: 'ov.breaker', v: onOff(f.power), tone: f.power ? 'ok' : 'bad' },
        { l: 'Shielding', h: 'ov.faraday', v: onOff(c.faraday), tone: c.faraday ? 'ok' : 'warn' },
        { l: 'Isolation', h: 'ov.isolation', v: onOff(c.isolation), tone: c.isolation ? 'ok' : 'warn' },
      ],
    },
    {
      id: 'chamber', k: 'chamber', name: 'Thermal-Vac Chamber', help: 'ov.chamber', page: 'chamber', icon: Thermometer, x: 332, y: 150, w: 224, h: 240,
      main: lab.fmtPressure(c.pressure),
      reads: [
        { l: 'Pressure', h: 'ov.pressure', v: `${pressureTrend} ${lab.fmtPressure(c.pressure)}`, tone: c.pressure < 1e-3 ? 'ok' : c.pressure > 700 ? '' : 'warn' },
        { l: 'Temperature', h: 'ov.temperature', v: `${c.temperature.toFixed(2)} °C`, tone: tempSteady ? 'ok' : 'warn' },
        { l: 'Door', h: 'ov.door', v: c.doorOpen ? 'OPEN' : 'CLOSED', tone: c.doorOpen ? 'warn' : '' },
      ],
      viz: <Bar value={pressureFrac} color="#7dd3fc" />,
    },
    {
      id: 'stage', k: 'stage', name: 'XYZ Stage + Sample', help: 'ov.stage', page: 'chamber', icon: Target, x: 0, y: 0, w: 0, h: 0, nested: true,
      main: `${num(st.x)} / ${num(st.y)} / ${num(st.z)} mm`,
      reads: [
        { l: 'Position (XYZ)', h: 'ov.xyz', v: `${num(st.x)} / ${num(st.y)} / ${num(st.z)} mm` },
        { l: 'Homed', h: 'ov.homed', v: st.homed ? 'YES' : 'NO', tone: st.homed ? 'ok' : 'warn' },
        { l: 'Motion', h: 'ov.settling', v: st.moving ? 'MOVING' : st.settling ? 'SETTLING' : 'STILL', tone: st.moving || st.settling ? 'warn' : 'ok' },
      ],
    },
    {
      id: 'ldv', k: 'ldv', name: 'LDV Optical Head', help: 'ov.ldv', page: 'ldv', icon: ScanLine, x: 644, y: 20, w: 196, h: 140, main: l.power ? (l.shutter ? `Return ${returnPct}%` : 'Shutter closed') : 'OFF',
      reads: [
        { l: 'Shutter', h: 'ov.shutter', v: l.power ? (l.shutter ? 'OPEN' : 'CLOSED') : 'OFF', tone: l.power && l.shutter ? 'ok' : 'off' },
        { l: 'Return', h: 'ov.return_signal', v: `${returnPct}%`, tone: l.shutter && returnPct < 40 ? 'warn' : l.shutter ? 'ok' : 'off' },
        { l: 'Optical quality', h: 'ov.optical_quality', v: l.power ? `${Math.round(l.opticalQuality ?? 0)}%` : '—', tone: 'off' },
      ],
      viz: <Bar value={returnPct / 100} color="#e879f9" />,
    },
    {
      id: 'pumps', k: 'pumps', name: 'Vacuum Pumps', help: 'ov.pumps', page: 'chamber', icon: Wind, x: 644, y: 250, w: 196, h: 166, main: c.turbo ? 'Turbo' : c.roughing ? 'Roughing' : 'Idle',
      reads: [
        { l: 'Roughing', h: 'ov.roughing', v: `${Math.round(c.roughingRpm || 0)}%`, tone: c.roughing ? 'ok' : 'off' },
        { l: 'Turbo', h: 'ov.turbo', v: `${Math.round(c.turboRpm || 0)}%`, tone: c.turbo ? 'ok' : 'off' },
        { l: 'Phase', h: 'ov.pump_phase', v: String(c.pumpPhase || '—') },
      ],
      viz: (
        <div className="ov-pumps" aria-hidden="true">
          <div className="ov-pump-col" style={{ '--c': '#94a3b8' } as React.CSSProperties}><i style={{ height: `${clamp(c.roughingRpm || 0, 0, 100)}%` }} /></div>
          <div className="ov-pump-col" style={{ '--c': '#38bdf8' } as React.CSSProperties}><i style={{ height: `${clamp(c.turboRpm || 0, 0, 100)}%` }} /></div>
        </div>
      ),
    },
    {
      id: 'experiment', k: 'experiment', name: 'Acquisition Workstation', help: 'ov.workstation', page: 'runs', icon: Cpu, x: 332, y: 450, w: 224, h: 148, main: ex.active ? ex.id || 'ACTIVE' : 'IDLE',
      reads: [
        { l: 'Run', h: 'ov.run', v: ex.active ? String(ex.id || 'ACTIVE') : 'IDLE', tone: ex.active ? 'ok' : 'off' },
        { l: 'Records', h: 'ov.records', v: String(records.length) },
        { l: 'Scan', h: 'ov.scan_progress', v: ex.scanActive ? `${Math.round((ex.scanProgress || 0) * 100)}%` : ex.scanMessage || 'Ready' },
      ],
      viz: <Bar value={ex.scanActive ? ex.scanProgress || 0 : 0} color="#34d399" />,
    },
    {
      id: 'spatial', k: 'spatial', name: 'Data Quality Check', help: 'ov.quality', page: 'spatial', icon: ShieldCheck, x: 644, y: 450, w: 196, h: 148, main: records.length ? quality : 'NO DATA',
      reads: [
        { l: 'Accepted', h: 'ov.accepted', v: String(accepted), tone: accepted ? 'ok' : 'off' },
        { l: 'Suspect', h: 'ov.suspect', v: String(suspect), tone: suspect ? 'warn' : 'off' },
        { l: 'Failed', h: 'ov.failed', v: String(failed), tone: failed ? 'bad' : 'off' },
      ],
      viz: (
        <div className="ov-stack" aria-hidden="true">
          <i style={{ width: `${scoreTotal ? (accepted / scoreTotal) * 100 : 0}%`, background: '#34d399' }} />
          <i style={{ width: `${scoreTotal ? (suspect / scoreTotal) * 100 : 0}%`, background: '#fbbf24' }} />
          <i style={{ width: `${scoreTotal ? (failed / scoreTotal) * 100 : 0}%`, background: '#fb7185' }} />
        </div>
      ),
    },
  ];
  const byId = Object.fromEntries(equip.map(e => [e.id, e])) as Record<string, Equip>;
  const cards = equip.filter(e => !e.nested);
  const stateMap = Object.fromEntries(equip.map(e => [e.id, stateOf(e)])) as Record<string, string>;

  const routes: Route[] = [
    { id: 'clock-vna', kind: 'clock', d: 'M122 170 L122 194', from: 'clock', to: 'vna', on: ck.locked && v.power, label: '10 MHz reference to VNA', badge: [122, 182] },
    { id: 'clock-scope', kind: 'clock', d: 'M24 95 L8 95 L8 456 L24 456', from: 'clock', to: 'scope', on: ck.locked && sc.power, label: '10 MHz reference to oscilloscope', badge: [8, 275] },
    { id: 'clock-ldv', kind: 'clock', d: 'M220 60 L644 60', from: 'clock', to: 'ldv', on: ck.locked && l.power, label: '10 MHz reference to LDV', badge: [432, 60] },
    { id: 'rf', kind: 'rf', d: 'M220 273 C270 273 290 270 332 270', from: 'vna', to: 'chamber', on: v.power && v.rf, label: 'RF stimulus and return', badge: [276, 272] },
    { id: 'laser', kind: 'laser', d: 'M700 160 C690 192 620 186 556 196', from: 'ldv', to: 'chamber', on: l.power && l.shutter, label: 'LDV forward beam', badge: [640, 184] },
    { id: 'laser-return', kind: 'laserReturn', d: 'M556 218 C625 212 714 208 726 160', from: 'chamber', to: 'ldv', on: l.power && l.shutter, label: 'LDV reflected return', badge: [650, 212] },
    { id: 'data', kind: 'data', d: 'M444 390 L444 450', from: 'chamber', to: 'experiment', on: ex.active || (v.trace?.length || 0) > 0, label: 'Measurement data to workstation', badge: [444, 420] },
    { id: 'vacuum', kind: 'vacuum', d: 'M644 333 C600 333 585 312 556 308', from: 'pumps', to: 'chamber', on: c.roughing || c.turbo, label: 'Vacuum flow to pumps', badge: [600, 326] },
    { id: 'data-quality', kind: 'data', d: 'M556 524 L644 524', from: 'experiment', to: 'spatial', on: ex.active || records.length > 0, label: 'Results to quality check', badge: [600, 524] },
  ];

  const checks = [
    { key: 'ov.chk_breaker', label: 'Main power is on', ok: f.power, go: null as string | null, hint: 'Use the Power button at the top right.' },
    { key: 'ov.chk_clock', label: 'Reference clock is locked', ok: ck.locked && !s.failures.clockDrift, go: 'clock' },
    { key: 'ov.chk_shield', label: 'Shielding (Faraday cage) is on', ok: c.faraday, go: 'chamber' },
    { key: 'ov.chk_isolation', label: 'Vibration isolation is on', ok: c.isolation, go: 'chamber' },
    { key: 'ov.chk_door', label: 'Chamber door is closed', ok: !c.doorOpen, go: 'chamber' },
    { key: 'ov.chk_vacuum', label: 'Deep vacuum reached (below 0.001 Torr)', ok: c.pressure < 1e-3 && !s.failures.vacuumLeak, go: 'chamber' },
    { key: 'ov.chk_temp', label: 'Temperature steady at setpoint (±0.03 °C)', ok: tempSteady, go: 'chamber' },
    { key: 'ov.chk_vna', label: 'VNA on, transmitting and calibrated', ok: v.power && v.rf && v.calibrated, go: 'vna' },
    { key: 'ov.chk_ldv', label: 'Laser vibrometer on, shutter open', ok: l.power && l.shutter, go: 'ldv' },
    { key: 'ov.chk_stage', label: 'Stage homed and still', ok: st.homed && !st.moving && !st.settling, go: 'chamber' },
  ];
  const passed = checks.filter(x => x.ok).length;
  const poweredCount = [ck.power, v.power, sc.power, l.power].filter(Boolean).length;
  const qualityText = records.length ? String(quality).toUpperCase() : 'NO DATA';

  const tiles = [
    { k: 'ov.kpi_readiness', label: 'Readiness', icon: ShieldCheck, val: `${passed} / ${checks.length}`, sub: passed === checks.length ? 'All checks pass' : `${checks.length - passed} to fix`, hex: !f.power ? TONE_HEX.off : passed === checks.length ? TONE_HEX.ok : TONE_HEX.info, ring: (passed / checks.length) * 100 },
    { k: 'ov.kpi_online', label: 'Instruments on', icon: Power, val: `${poweredCount} / 4`, sub: 'Clock · VNA · Scope · LDV', hex: poweredCount === 4 ? TONE_HEX.ok : poweredCount ? TONE_HEX.info : TONE_HEX.off },
    { k: 'ov.kpi_alarms', label: 'Open alarms', icon: AlertTriangle, val: String(openAlarms.length), sub: `${criticalCount} critical`, hex: criticalCount ? TONE_HEX.bad : openAlarms.length ? TONE_HEX.warn : TONE_HEX.ok },
    { k: 'ov.kpi_clock', label: 'Reference clock', icon: TimerReset, val: clockText, sub: '10 MHz reference', subHelp: 'ov.ref10', hex: TONE_HEX[clockTone as 'ok' | 'warn' | 'bad' | 'off'] },
    { k: 'ov.kpi_vacuum', label: 'Vacuum', icon: Wind, val: lab.fmtPressure(c.pressure), sub: c.vent ? 'Venting ↑' : c.roughing || c.turbo ? 'Pumping down ↓' : 'Holding →', hex: c.pressure < 1e-3 ? TONE_HEX.ok : c.roughing || c.turbo ? TONE_HEX.info : TONE_HEX.off },
    { k: 'ov.kpi_temp', label: 'Temperature', icon: Thermometer, val: `${c.temperature.toFixed(2)} °C`, sub: `${drift >= 0 ? '+' : ''}${drift.toFixed(2)} °C from setpoint`, subHelp: 'ov.setpoint', hex: tempSteady ? TONE_HEX.ok : TONE_HEX.warn },
    { k: 'ov.kpi_stage', label: 'Stage position', icon: Target, val: `${num(st.x)} · ${num(st.y)} · ${num(st.z)}`, sub: 'X · Y · Z in mm', subHelp: 'ov.mm', hex: st.moving || st.settling ? TONE_HEX.warn : st.homed ? TONE_HEX.ok : TONE_HEX.warn },
    { k: 'ov.kpi_quality', label: 'Data quality', icon: CheckCircle2, val: qualityText, sub: `${accepted} ok · ${suspect} suspect · ${failed} failed`, hex: !records.length ? TONE_HEX.off : /pass|valid|good/i.test(qualityText) ? TONE_HEX.ok : /fail/i.test(qualityText) ? TONE_HEX.bad : TONE_HEX.warn },
    { k: 'ov.kpi_sim', label: 'Simulation clock', icon: Activity, val: `${Math.floor(f.simulationTime)} s`, sub: `${f.speed}× speed`, subHelp: 'ov.sim_speed', hex: TONE_HEX.info },
  ];

  /* ───── Interactions ───── */
  const tilt = reduced ? {} : {
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== 'mouse') return;
      const r = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      e.currentTarget.style.setProperty('--tx', `${(-py * 7).toFixed(2)}deg`);
      e.currentTarget.style.setProperty('--ty', `${(px * 9).toFixed(2)}deg`);
    },
    onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.style.setProperty('--tx', '0deg');
      e.currentTarget.style.setProperty('--ty', '0deg');
    },
  };

  const select = (id: string) => {
    if (moved.current) { moved.current = false; return; }
    setSelected(id);
  };
  const startDrag = (e: React.PointerEvent) => {
    if (view !== 'orbit' || e.button !== 0) return;
    const start = { x: e.clientX, y: e.clientY, rx: orbit.rx, ry: orbit.ry };
    moved.current = false;
    setDragging(true);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true;
      setOrbit({ ry: clamp(start.ry + dx * 0.25, -38, 38), rx: clamp(start.rx - dy * 0.25, 0, 58) });
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.setTimeout(() => { moved.current = false; }, 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  const resetView = () => { setView('tilt'); setOrbit({ rx: 16, ry: -10 }); setLayers({ ...ALL_LAYERS }); setProblemsOnly(false); setSort('lab'); };
  const rx = view === 'flat' ? 0 : view === 'tilt' ? 16 : orbit.rx;
  const ry = view === 'flat' ? 0 : view === 'tilt' ? 0 : orbit.ry;

  const sel = byId[selected] || byId.chamber;
  const selState = stateMap[sel.id];
  const selToken = lab.visualToken(selState);
  const selRoutes = routes.filter(r => r.from === sel.id || r.to === sel.id || (sel.id === 'stage' && (r.from === 'chamber' || r.to === 'chamber') && r.kind === 'rf'));
  const selAlarms = openAlarms.filter((a: any) => alarmRegex(sel.k).test(a.text || ''));

  const tableRows = useMemo(() => {
    const rows = equip.map((e, i) => ({ e, i }));
    if (sort === 'name') rows.sort((a, b) => a.e.name.localeCompare(b.e.name));
    if (sort === 'state') rows.sort((a, b) => (STATE_PRIORITY[stateMap[a.e.id]] ?? 9) - (STATE_PRIORITY[stateMap[b.e.id]] ?? 9) || a.i - b.i);
    return rows.map(r => r.e);
  }, [equip, sort, stateMap]);

  const events = (s.events || []).filter((ev: any) => eventFilter === 'all' || ev.level !== 'info').slice(0, 14);
  const alarmList = (s.alarms || []).slice(0, 12);
  const helpResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return HELP_KEYS.filter(k => !k.startsWith('ov.state_') || !q ? true : true)
      .map(k => ({ k, e: OVERVIEW_HELP[k] }))
      .filter(({ e }) => !q || e.title.toLowerCase().includes(q) || e.desc.toLowerCase().includes(q))
      .sort((a, b) => a.e.title.localeCompare(b.e.title))
      .slice(0, q ? 60 : 24);
  }, [query]);

  /* ───── Render ───── */
  return (
    <HelpCtx.Provider value={helpCtx}>
      <section className={`ov-root${showHelp ? '' : ' ov-help-off'}${reduced ? ' ov-reduced' : ''}`} aria-label="Living Lab Overview">
        <div className="ov-head">
          <div>
            <h1 className="ov-title">Living Lab Overview<Q k="ov.overview" big /></h1>
            <p className="ov-sub">
              See every piece of lab <T k="ov.equipment">equipment</T>, what <T k="ov.state">state</T> it is in, and how <T k="ov.signals">signals</T>,{' '}
              <T k="ov.vacuum_flow">vacuum</T> and <T k="ov.data_flow">data</T> move between them. Everything comes from one <T k="ov.live_model">live simulation model</T>.
            </p>
          </div>
          <div className="ov-toolbar">
            <div className="ov-group" role="group" aria-label="View mode">
              <span className="ov-group-label">View<Q k="ov.view_modes" /></span>
              {(['flat', 'tilt', 'orbit'] as const).map(m => (
                <span key={m} className="ov-qwrap">
                  <button type="button" className="ov-seg" aria-pressed={view === m} onClick={() => setView(m)}>{m === 'flat' ? 'Flat' : m === 'tilt' ? 'Tilted' : 'Orbit'}</button>
                </span>
              ))}
            </div>
            <span className="ov-qwrap"><button type="button" className="ov-btn" aria-pressed={problemsOnly} onClick={() => setProblemsOnly(x => !x)} style={problemsOnly ? { borderColor: '#fbbf24', color: '#fde68a' } : undefined}><AlertTriangle size={13} aria-hidden="true" /> Problems only</button><Q k="ov.problems_only" /></span>
            <span className="ov-qwrap"><button type="button" className="ov-btn" onClick={resetView}>Reset view</button><Q k="ov.reset_view" /></span>
            <span className="ov-qwrap"><button type="button" className="ov-btn" aria-pressed={showHelp} onClick={() => setShowHelp(x => !x)}>? Help icons: {showHelp ? 'On' : 'Off'}</button><Q k="ov.help_icons" /></span>
          </div>
        </div>

        <div className="ov-tiles" role="list" aria-label="Lab summary">
          {tiles.map(t => (
            <div key={t.k} role="listitem" className="ov-tile" style={{ '--c': t.hex, '--p': (t as any).ring ?? 0 } as React.CSSProperties} {...tilt}>
              {(t as any).ring !== undefined && <div className="ov-ring" aria-hidden="true" />}
              <div className="ov-tile-top"><span className="ov-tile-icon" aria-hidden="true"><t.icon size={13} /></span><T k={t.k}>{t.label}</T></div>
              <div className="ov-tile-val">{t.val}</div>
              <div className="ov-tile-sub">{(t as any).subHelp ? <T k={(t as any).subHelp}>{t.sub}</T> : t.sub}</div>
            </div>
          ))}
        </div>

        <div className="ov-main">
          <div className="ov-panel">
            <div className="ov-panel-h">
              <h2>Lab map<Q k="ov.map" /></h2>
              <div className="ov-pillrow" role="group" aria-label="Show or hide lines">
                <span className="ov-hint"><T k="ov.layers">Lines:</T></span>
                {(Object.keys(ROUTE_NAME) as RouteKind[]).map(kind => (
                  <span key={kind} className="ov-qwrap">
                    <button type="button" role="switch" aria-checked={layers[kind]} className="ov-pill" style={{ '--c': ROUTE_COLOR[kind] } as React.CSSProperties} onClick={() => setLayers(x => ({ ...x, [kind]: !x[kind] }))}><i aria-hidden="true" />{ROUTE_NAME[kind]}</button>
                    <Q k={ROUTE_HELP[kind]} />
                  </span>
                ))}
                <span className="ov-pill" style={{ '--c': '#fb7185', cursor: 'default' } as React.CSSProperties}><i aria-hidden="true" />Fault<Q k="ov.route_fault" /></span>
              </div>
            </div>
            <div className="ov-scroll">
              <div className="ov-wrap">
                <div
                  className={`ov-stage${view === 'orbit' ? ' is-orbit' : ''}${dragging ? ' is-dragging' : ''}`}
                  style={{ '--rx': `${rx}deg`, '--ry': `${ry}deg` } as React.CSSProperties}
                  onPointerDown={startDrag}
                  onDoubleClick={() => view === 'orbit' && setOrbit({ rx: 16, ry: -10 })}
                >
                  <div className="ov-plane">
                    <div className="ov-floor" aria-hidden="true" />
                    <svg className="ov-routes" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} preserveAspectRatio="none" aria-hidden="true">
                      {routes.filter(r => layers[r.kind]).map(r => {
                        const fault = openAlarms.some((a: any) => new RegExp(ROUTE_ALARM[r.kind], 'i').test(a.text || ''));
                        return <path key={r.id} d={r.d} className={`ov-route ${fault ? 'is-fault' : r.on ? 'is-on' : 'is-idle'}`} style={{ color: ROUTE_COLOR[r.kind], stroke: fault ? '#fb7185' : ROUTE_COLOR[r.kind] }}><title>{r.label}{fault ? ' (fault)' : r.on ? ' (active)' : ' (idle)'}</title></path>;
                      })}
                    </svg>
                    {routes.filter(r => layers[r.kind]).map(r => (
                      <div key={r.id} className="ov-badge" style={{ left: `calc(var(--u) * ${r.badge[0]})`, top: `calc(var(--u) * ${r.badge[1]})` }}><Q k={ROUTE_HELP[r.kind]} /></div>
                    ))}
                    {cards.map(e => {
                      const vs = stateMap[e.id];
                      const t = lab.visualToken(vs);
                      const isSel = selected === e.id || (e.id === 'chamber' && selected === 'stage' ? false : false);
                      const dim = problemsOnly && vs !== 'fault' && vs !== 'warning' && vs !== 'maintenance';
                      const Icon = e.icon;
                      return (
                        <article key={e.id} data-equip={e.id} data-state={vs} className={`ov-card st-${vs}${isSel ? ' is-selected' : ''}${dim ? ' is-dim' : ''}`}
                          style={{ '--c': t.hex, left: `calc(var(--u) * ${e.x})`, top: `calc(var(--u) * ${e.y})`, width: `calc(var(--u) * ${e.w})`, height: `calc(var(--u) * ${e.h})` } as React.CSSProperties} {...tilt}>
                          <div className="ov-shadow" aria-hidden="true" />
                          <div className="ov-card-body">
                            <button type="button" className="ov-hit" aria-pressed={isSel} aria-label={`${e.name}: ${t.label}. ${e.main}. Select to inspect.`} onClick={() => select(e.id)} />
                            <div className="ov-card-h" style={{ paddingRight: 'calc(var(--u) * 24)' }}>
                              <span className="ov-card-icon" aria-hidden="true"><Icon /></span>
                              <span className="ov-card-name">{e.name}</span><Q k={e.help} />
                            </div>
                            <div className="ov-state-line"><span className="ov-chip"><i className="ov-led" aria-hidden="true" />{t.symbol} {t.label}</span><Q k={`ov.state_${vs}`} /></div>
                            <dl className="ov-reads">
                              {e.reads.map(r => (
                                <div className="ov-read" key={r.l}><dt>{r.l}<Q k={r.h} /></dt><dd className={r.tone ? `is-${r.tone}` : ''}>{r.v}</dd></div>
                              ))}
                            </dl>
                            {e.viz && <div className="ov-viz">{e.viz}</div>}
                            {e.id === 'chamber' && (() => {
                              const sv = stateMap.stage, stt = lab.visualToken(sv), stg = byId.stage;
                              const stSel = selected === 'stage';
                              return (
                                <div className={`ov-sub-card${stSel ? ' is-selected' : ''}`} data-equip="stage" data-state={sv} style={{ '--sc': stt.hex } as React.CSSProperties}>
                                  <button type="button" className="ov-sub-hit" aria-pressed={stSel} aria-label={`XYZ Stage and sample: ${stt.label}. ${stg.main}. Select to inspect.`} onClick={() => select('stage')} />
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                    <span className="ov-card-name" style={{ display: 'inline-flex', alignItems: 'center' }}>XYZ Stage<Q k="ov.stage" /></span>
                                    <span className="ov-chip" style={{ '--c': stt.hex } as React.CSSProperties}><i className="ov-led" aria-hidden="true" />{stt.symbol} {stt.label}</span>
                                  </div>
                                  <div className="ov-axis">
                                    {(['x', 'y', 'z'] as const).map(ax => (
                                      <div key={ax}><span>{ax.toUpperCase()} {num(st[ax])}</span><Bar value={(st[ax] + 35) / 70} color={stt.hex} /></div>
                                    ))}
                                  </div>
                                  <div className="ov-hint" style={{ display: 'inline-flex', alignItems: 'center' }}><T k="ov.xyz">XYZ</T>&nbsp;in&nbsp;<T k="ov.mm">mm</T></div>
                                </div>
                              );
                            })()}
                            <button type="button" className="ov-open" aria-label={`Open the ${e.name} page`} title={`Open the ${e.name} page`} onClick={ev => { ev.stopPropagation(); go(e.page); }}><ChevronRight size={13} aria-hidden="true" /></button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <p className="ov-scrollhint">Swipe sideways to see the whole map.</p>
          </div>

          <aside className="ov-side" aria-label="Equipment inspector">
            <div className="ov-panel" style={{ '--c': selToken.hex } as React.CSSProperties}>
              <div className="ov-panel-h"><h2>Inspector<Q k="ov.inspector" /></h2></div>
              <div className="ov-insp-title">
                <span className="ov-tile-icon" style={{ '--c': selToken.hex, width: 30, height: 30 } as React.CSSProperties} aria-hidden="true"><sel.icon size={16} /></span>
                <h3>{sel.name}</h3><Q k={sel.help} big />
              </div>
              <div className="ov-state-line" style={{ marginBottom: 8 }}><span className="ov-chip" style={{ '--c': selToken.hex } as React.CSSProperties}><i className="ov-led" aria-hidden="true" />{selToken.symbol} {selToken.label}</span><Q k={`ov.state_${selState}`} /></div>
              <p className="ov-insp-desc">{getHelp(sel.help).desc}</p>

              <div className="ov-sec"><h4>Live readings<Q k="ov.live_readings" /></h4>
                <ul className="ov-list">
                  {sel.reads.map(r => <li key={r.l}><span className="ov-k">{r.l}<Q k={r.h} /></span><span className="ov-v" style={r.tone === 'ok' ? { color: '#6ee7b7' } : r.tone === 'warn' ? { color: '#fcd34d' } : r.tone === 'bad' ? { color: '#fda4af' } : undefined}>{r.v}</span></li>)}
                </ul>
              </div>

              <div className="ov-sec"><h4>Connections<Q k="ov.connections" /></h4>
                {selRoutes.length ? (
                  <ul className="ov-list">
                    {selRoutes.map(r => {
                      const fault = openAlarms.some((a: any) => new RegExp(ROUTE_ALARM[r.kind], 'i').test(a.text || ''));
                      return <li key={r.id}><span className="ov-k" style={{ color: ROUTE_COLOR[r.kind] }}>{r.label}<Q k={ROUTE_HELP[r.kind]} /></span><span className="ov-v" style={{ color: fault ? '#fda4af' : r.on ? '#6ee7b7' : '#7d8fa3' }}>{fault ? 'FAULT' : r.on ? 'ACTIVE' : 'IDLE'}<Q k={r.on ? 'ov.line_active' : 'ov.line_idle'} /></span></li>;
                    })}
                  </ul>
                ) : <div className="ov-empty" style={{ marginTop: 8 }}>This equipment has no lines on the map.</div>}
              </div>

              <div className="ov-sec"><h4>Related alarms<Q k="ov.related_alarms" /></h4>
                {selAlarms.length ? (
                  <ul className="ov-list">
                    {selAlarms.map((a: any) => <li key={a.id}><span className="ov-k" style={{ color: a.severity === 'critical' ? '#fda4af' : '#fcd34d' }}>{a.text}</span><button type="button" className="ov-btn is-small" onClick={() => dispatch({ type: 'ACK_ALARM', id: a.id })}>Ack</button></li>)}
                  </ul>
                ) : <div className="ov-empty" style={{ marginTop: 8 }}>No open alarms for this item.</div>}
              </div>

              <div className="ov-actions">
                <span className="ov-qwrap"><button type="button" className="ov-btn is-primary" onClick={() => go(sel.page)}>Open page <ChevronRight size={13} aria-hidden="true" /></button><Q k="ov.open_page" /></span>
                {sel.id === 'stage' && <span className="ov-qwrap"><button type="button" className="ov-btn" onClick={() => dispatch({ type: 'HOME_STAGE' })} disabled={!f.power}>Home stage</button><Q k="ov.home_stage" /></span>}
              </div>
            </div>

            <div className="ov-panel">
              <div className="ov-panel-h"><h2>Status key<Q k="ov.status_key" /></h2></div>
              <div className="ov-keygrid">
                {STATE_KEYS.filter(k => k !== 'selected' && k !== 'stable').map(k => {
                  const t = lab.visualToken(k);
                  return <div key={k} className="ov-keyitem" style={{ '--c': t.hex } as React.CSSProperties}><span aria-hidden="true">{t.symbol}</span><b>{t.label}</b><Q k={`ov.state_${k}`} /></div>;
                })}
              </div>
            </div>
          </aside>
        </div>

        <div className="ov-lower">
          <div className="ov-panel">
            <div className="ov-panel-h"><h2>Ready to measure?<Q k="ov.readiness" /></h2><span className="ov-hint ov-mono">{passed} of {checks.length} checks pass</span></div>
            <div className="ov-meter" role="progressbar" aria-valuemin={0} aria-valuemax={checks.length} aria-valuenow={passed} aria-label="Readiness"><i style={{ width: `${(passed / checks.length) * 100}%` }} /></div>
            {checks.map(ck2 => (
              <div key={ck2.key} className={`ov-check${ck2.ok ? ' is-ok' : ''}`}>
                <span className="ov-tick" aria-hidden="true">{ck2.ok ? '✓' : ''}</span>
                <span className="ov-check-text"><span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{ck2.ok ? 'Passing: ' : 'Not yet: '}</span>{ck2.label}<Q k={ck2.key} /></span>
                {!ck2.ok && (ck2.go ? <span className="ov-qwrap"><button type="button" className="ov-btn is-small" onClick={() => go(ck2.go as string)}>Fix it</button><Q k="ov.fix_it" /></span> : <span className="ov-hint">{ck2.hint}</span>)}
              </div>
            ))}
          </div>

          <div className="ov-panel">
            <div className="ov-panel-h">
              <div className="ov-tabs" role="tablist" aria-label="Alarms and events">
                <button type="button" role="tab" className="ov-seg" aria-selected={feedTab === 'alarms'} aria-pressed={feedTab === 'alarms'} onClick={() => setFeedTab('alarms')}>Alarms ({openAlarms.length})</button>
                <button type="button" role="tab" className="ov-seg" aria-selected={feedTab === 'events'} aria-pressed={feedTab === 'events'} onClick={() => setFeedTab('events')}>Recent events</button>
              </div>
              <Q k={feedTab === 'alarms' ? 'ov.alarms' : 'ov.events'} />
              {feedTab === 'alarms'
                ? <span className="ov-qwrap"><button type="button" className="ov-btn is-small" disabled={!openAlarms.length} onClick={() => openAlarms.forEach((a: any) => dispatch({ type: 'ACK_ALARM', id: a.id }))}>Acknowledge all</button><Q k="ov.ack" /></span>
                : <span className="ov-qwrap"><button type="button" className="ov-btn is-small" aria-pressed={eventFilter === 'problems'} onClick={() => setEventFilter(x => (x === 'all' ? 'problems' : 'all'))}>{eventFilter === 'all' ? 'Showing all' : 'Problems only'}</button><Q k="ov.event_filter" /></span>}
            </div>
            {feedTab === 'alarms' ? (
              alarmList.length ? (
                <ul className="ov-feed">
                  {alarmList.map((a: any) => (
                    <li key={a.id} className={`lv-${a.severity}`} style={a.acknowledged ? { opacity: .55 } : undefined}>
                      <div className="ov-meta"><span className="ov-tag">{String(a.severity).toUpperCase()}<Q k="ov.severity" /></span><span>{a.time}</span><span>{a.acknowledged ? 'ACKNOWLEDGED' : 'OPEN'}</span>{!a.acknowledged && <button type="button" className="ov-btn is-small" style={{ marginLeft: 'auto' }} onClick={() => dispatch({ type: 'ACK_ALARM', id: a.id })}>Acknowledge</button>}</div>
                      <div>{a.text}</div>
                    </li>
                  ))}
                </ul>
              ) : <div className="ov-empty">No alarms. When something needs attention it will show up here and on the lab map.</div>
            ) : (
              events.length ? (
                <ul className="ov-feed">
                  {events.map((ev: any) => (
                    <li key={ev.id} className={`lv-${ev.level}`}>
                      <div className="ov-meta"><span className="ov-tag">{String(ev.subsystem)}<Q k="ov.subsystem" /></span><span>{ev.time}</span><span>{String(ev.level).toUpperCase()}<Q k="ov.level" /></span><span>t+{ev.simulationTime}s<Q k="ov.sim_time" /></span></div>
                      <div>{ev.text}</div>
                    </li>
                  ))}
                </ul>
              ) : <div className="ov-empty">Nothing has happened yet. Switch the main power on to get started.</div>
            )}
          </div>

          <div className="ov-panel">
            <div className="ov-panel-h">
              <h2>Equipment at a glance<Q k="ov.table" /></h2>
              <div className="ov-group" role="group" aria-label="Sort equipment">
                <span className="ov-group-label">Sort<Q k="ov.sort" /></span>
                {(['lab', 'state', 'name'] as const).map(m => <button key={m} type="button" className="ov-seg" aria-pressed={sort === m} onClick={() => setSort(m)}>{m === 'lab' ? 'Lab order' : m === 'state' ? 'Problems first' : 'Name'}</button>)}
              </div>
            </div>
            <div className="ov-th" aria-hidden="true"><span>Equipment</span><span>State<Q k="ov.state" /></span><span>Main reading<Q k="ov.main_reading" /></span><span /></div>
            {tableRows.map(e => {
              const t = lab.visualToken(stateMap[e.id]);
              return (
                <button key={e.id} type="button" className={`ov-tr${selected === e.id ? ' is-selected' : ''}`} onClick={() => setSelected(e.id)} aria-pressed={selected === e.id}>
                  <span className="ov-name">{e.name}</span>
                  <span className="ov-chip" style={{ '--c': t.hex, justifySelf: 'start' } as React.CSSProperties}><i className="ov-led" aria-hidden="true" />{t.symbol} {t.label}</span>
                  <span className="ov-val">{e.main}</span>
                  <span aria-hidden="true" style={{ justifySelf: 'end' }}><ChevronRight size={14} /></span>
                </button>
              );
            })}
          </div>

          <div className="ov-panel">
            <div className="ov-panel-h"><h2>Help index<Q k="ov.help_index" /></h2><span className="ov-hint">{HELP_KEYS.length} terms explained</span></div>
            <input className="ov-search" type="search" placeholder="Search any term, e.g. vacuum, shutter, calibration…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search help terms" />
            <div className="ov-hresults">
              {helpResults.length ? helpResults.map(({ k, e }) => <button key={k} type="button" className="ov-hres" onClick={() => open(k)}>{e.title}</button>) : <div className="ov-empty" style={{ width: '100%' }}>No matching terms. Try a shorter word.</div>}
            </div>
          </div>
        </div>
      </section>
    </HelpCtx.Provider>
  );
}

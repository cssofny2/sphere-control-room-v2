import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronDown, ChevronUp, MonitorPlay } from 'lucide-react';
import './live.css';
import { getActivities, subscribeActivity, type Activity } from './activity';
import { getEquipmentUse, type EquipId } from './equipment';
import { ALERT_HEX, getAlert, type AlertLevel } from './alerts';
import { AlertGlyph } from './AlertBadge';
import { ActionScene } from './ActionScene';
import { LabClock, useWallClock } from './LabClock';
import { getLabState } from '../state/labStores';

const KEY = 'sphere.liveWindow.v1';
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Re-reads the simulator a few times a second (the window is always mounted, so it must stay cheap). */
function useLabSnapshot(ms = 160): any {
  const [s, setS] = useState<any>(() => getLabState());
  useEffect(() => { const id = window.setInterval(() => { const n = getLabState(); setS((p: any) => (p === n ? p : n)); }, ms); return () => window.clearInterval(id); }, [ms]);
  return s;
}

type NodeDef = { id: string; equip: EquipId | null; x: number; y: number; w: number; h: number; label: string; sub: string };
const NODES: NodeDef[] = [
  { id: 'clock', equip: 'clock', x: 6, y: 8, w: 76, h: 34, label: 'Rb CLOCK', sub: '10 MHz' },
  { id: 'vna', equip: 'vna', x: 6, y: 58, w: 76, h: 34, label: 'VNA', sub: 'S11' },
  { id: 'scope', equip: 'scope', x: 6, y: 108, w: 76, h: 34, label: 'SCOPE', sub: '4 ch' },
  { id: 'ldv', equip: 'ldv', x: 278, y: 8, w: 76, h: 34, label: 'LDV', sub: 'laser' },
  { id: 'rough', equip: 'rough', x: 278, y: 92, w: 76, h: 30, label: 'ROUGHING', sub: 'pump' },
  { id: 'turbo', equip: 'turbo', x: 278, y: 130, w: 76, h: 30, label: 'TURBO', sub: 'pump' },
  { id: 'daq', equip: 'daq', x: 120, y: 182, w: 120, h: 30, label: 'WORKSTATION', sub: 'records' },
];
const CHAMBER_EQUIP = new Set<EquipId>(['door', 'vent', 'thermo', 'faraday', 'isolation', 'stage']);
const levelStroke = (on: boolean, level: AlertLevel, active: boolean) => (level === 'error' ? ALERT_HEX.error : level === 'stuck' ? ALERT_HEX.stuck : level === 'attention' ? ALERT_HEX.attention : !on ? '#2a3646' : active ? '#34d399' : '#3d82b0');

function Diagram({ s, focus, anim }: { s: any; focus: EquipId | null; anim: string | null }) {
  const c = s.chamber, st = s.stage, v = s.vna, l = s.ldv, sc = s.scope, ck = s.clock;
  const eq = useMemo(() => Object.fromEntries(getEquipmentUse(s).map(e => [e.id, e])), [s]) as Record<EquipId, ReturnType<typeof getEquipmentUse>[number]>;
  const chamberLevel = getAlert(s, 'chamber').level, pumpLevel = getAlert(s, 'pumps').level, stageLevel = getAlert(s, 'stage').level;
  const worstChamber: AlertLevel = [chamberLevel, stageLevel].includes('error') ? 'error' : [chamberLevel, stageLevel].includes('stuck') ? 'stuck' : [chamberLevel, stageLevel].includes('attention') ? 'attention' : 'idle';
  const ax = st.actualX ?? st.x, ay = st.actualY ?? st.y, az = st.actualZ ?? st.z;
  const sx = 180 + ax * 0.9, sy = 96 - az * 0.9, sr = 9 + ay * 0.05;
  const haze = clamp((Math.log10(Math.max(c.pressure, 1e-6)) + 3) / (Math.log10(760) + 3), 0, 1);
  const nGas = Math.round(2 + 24 * haze), dT = c.temperature - c.targetTemp;
  const rfOn = !!(v.power && v.rf), laser = !!(l.power && l.shutter), scopeOn = !!(sc.power && sc.running && !sc.booting), pumping = (c.roughingRpm || 0) > 1 || (c.turboRpm || 0) > 1;
  const clockFeed = !!(ck.power && ck.locked);
  const inChamber = focus && CHAMBER_EQUIP.has(focus);
  const hot = (id: EquipId | null) => !!focus && (focus === id || (id === 'vna' && focus === 'rf'));
  const ldvSweep = !!l.scanActive && !l.scanStalled;
  const beamX = sx;
  return (
    <svg className="lw-diagram" viewBox="0 0 360 218" role="img" aria-label="Live schematic of the whole lab. Highlighted equipment is the one you just used.">
      <defs>
        <radialGradient id="lw-cu" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#ffe3c4" /><stop offset=".4" stopColor="#d9803f" /><stop offset="1" stopColor="#4a2410" /></radialGradient>
        <filter id="lw-glow"><feGaussianBlur stdDeviation="2.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {/* signal paths */}
      <g fill="none" strokeLinecap="round">
        <path className={`lw-edge ${clockFeed && v.power ? 'on' : ''}`} d="M44 42 V58" stroke="#22d3ee" />
        <path className={`lw-edge ${clockFeed && sc.power ? 'on' : ''}`} d="M6 25 H1 V125 H6" stroke="#22d3ee" />
        <path className={`lw-edge ${clockFeed && l.power ? 'on' : ''}`} d="M82 25 H278" stroke="#22d3ee" />
        <path className={`lw-edge rf ${rfOn ? 'on' : ''} ${hot('rf') || hot('vna') ? 'hot' : ''}`} d="M82 75 Q104 78 122 92" stroke="#e879f9" />
        <path className={`lw-edge ${scopeOn ? 'on' : ''}`} d="M82 125 Q104 124 122 112" stroke="#4ade80" strokeDasharray="2 4" />
        <path className={`lw-edge ${pumping ? 'on rev' : ''}`} d="M240 106 H278" stroke="#94a3b8" />
        <path className={`lw-edge ${(c.turboRpm || 0) > 1 ? 'on rev' : ''}`} d="M240 126 Q262 128 278 145" stroke="#7dd3fc" />
        <path className={`lw-edge ${eq.daq.active || (v.trace?.length || 0) > 0 ? 'on' : ''}`} d="M180 158 V182" stroke="#60a5fa" />
      </g>
      {/* chamber */}
      <g className={`lw-chamber ${inChamber ? 'hot' : ''}`}>
        <rect x="120" y="34" width="120" height="124" rx="12" fill="#07111b" stroke={levelStroke(true, worstChamber, pumping || st.moving)} strokeWidth="2.4" />
        <rect x="128" y="44" width="104" height="104" rx="7" fill="#050b12" stroke="#16283a" />
        {Math.abs(dT) > 0.03 && <rect x="128" y="44" width="104" height="104" rx="7" fill={dT > 0 ? '#fb923c' : '#38bdf8'} opacity={clamp(Math.abs(dT) / 8, 0.05, 0.28)} />}
        {Array.from({ length: nGas }).map((_, i) => <circle key={i} className={`lw-gas ${pumping ? 'pump' : ''} ${c.vent ? 'vent' : ''}`} r="1.5" cx={134 + ((i * 41) % 92)} cy={50 + ((i * 29) % 90)} fill="#9fc4e8" opacity=".75" style={{ animationDelay: `${-i * 0.37}s` }} />)}
        {c.faraday && <rect x="116" y="30" width="128" height="132" rx="14" fill="none" stroke="#fbbf24" strokeOpacity={hot('faraday') ? 1 : 0.55} strokeDasharray="4 3" className={hot('faraday') ? 'lw-pulse' : ''} />}
        {!c.isolation && <g className="lw-shake">{[140, 220].map(x => <path key={x} d={`M${x} 160 l-3 2 l6 2 l-6 2`} stroke="#fb7185" fill="none" />)}</g>}
        {c.isolation && [140, 220].map(x => <path key={x} d={`M${x} 160 l-3 2 l6 2 l-6 2 l3 2`} stroke="#a78bfa" fill="none" strokeOpacity={hot('isolation') ? 1 : 0.6} />)}
        <line x1={sx} y1={sy + sr} x2={sx} y2="146" stroke="#556377" strokeWidth="3" />
        {(st.moving || st.settling) && <circle cx={180 + st.x * 0.9} cy={96 - st.z * 0.9} r={9 + st.y * 0.05} fill="none" stroke="#fff" strokeOpacity=".65" strokeDasharray="3 3" />}
        <circle cx={sx} cy={sy} r={sr} fill="url(#lw-cu)" stroke="#fcd34d" strokeWidth=".8" className={hot('stage') ? 'lw-sphere hot' : 'lw-sphere'} />
        {laser && <g filter="url(#lw-glow)"><path d={`M316 42 L${beamX} ${sy - sr}`} stroke="#ff4d63" strokeWidth="1.6" className="lw-beam" /><circle cx={beamX} cy={sy - sr} r="2.4" fill="#ff7a8a" className="lw-spot" />{ldvSweep && <circle cx={sx} cy={sy} r="2" fill="#f5d0fe" className="lw-scanspot" />}</g>}
        {rfOn && [0, 1].map(i => <circle key={i} className="lw-rfwave" cx="128" cy="92" r="4" fill="none" stroke="#e879f9" style={{ animationDelay: `${i * 0.7}s` }} />)}
        {c.vent && <><rect x="148" y="30" width="10" height="6" fill="#16a34a" /><path className="lw-in" d="M153 18 V30" stroke="#86efac" strokeDasharray="2 3" /></>}
        <g transform="translate(238 52)"><g className={`lw-door ${c.doorOpen ? 'open' : ''}`}><rect width="6" height="86" rx="2" fill={c.doorOpen ? '#fb7185' : '#475569'} stroke="#94a3b8" /></g></g>
        <text x="180" y="30" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#9fb3c8" fontFamily="ui-monospace,monospace">CHAMBER</text>
        <text x="132" y="142" fontSize="7" fill="#9fb3c8" fontFamily="ui-monospace,monospace">{c.pressure >= 10 ? c.pressure.toFixed(0) : c.pressure.toExponential(0)} Torr · {c.temperature.toFixed(1)}°C</text>
        <text x="228" y="142" textAnchor="end" fontSize="7" fill="#9fb3c8" fontFamily="ui-monospace,monospace">{ax.toFixed(0)},{ay.toFixed(0)},{az.toFixed(0)}</text>
        {inChamber && <rect x="118" y="32" width="124" height="128" rx="13" fill="none" stroke="#fff" strokeWidth="2" className="lw-ring" />}
      </g>
      {/* equipment nodes */}
      {NODES.map(n => {
        const e = n.equip ? eq[n.equip] : null, on = !!e?.on, level = e?.level || 'idle', active = !!e?.active, isHot = hot(n.equip);
        const stroke = levelStroke(on, level, active), spin = (n.id === 'rough' && (c.roughingRpm || 0) > 1) || (n.id === 'turbo' && (c.turboRpm || 0) > 1);
        return (
          <g key={n.id} className={`lw-node ${on ? 'on' : 'off'} ${active ? 'active' : ''} ${isHot ? 'hot' : ''}`} opacity={on || level !== 'idle' ? 1 : 0.55}>
            <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="6" fill="#0c1621" stroke={stroke} strokeWidth={isHot ? 2.6 : 1.6} />
            <circle cx={n.x + 9} cy={n.y + 10} r="3" className={`lw-led ${active ? 'blink' : ''}`} fill={on ? (level === 'error' ? ALERT_HEX.error : '#22c55e') : '#475569'} />
            <text x={n.x + 16} y={n.y + 13} fontSize="8.5" fontWeight="700" fill="#dbe8f6" fontFamily="ui-monospace,monospace">{n.label}</text>
            <text x={n.x + 8} y={n.y + n.h - 7} fontSize="7" fill="#8fa3b8" fontFamily="ui-monospace,monospace">{n.id === 'scope' ? `${Object.values(sc.channels || {}).filter((q: any) => q.enabled).length} ch · ${sc.triggerState || 'off'}` : n.id === 'ldv' ? (l.scanActive ? `scan ${Math.round((l.scanProgress || 0) * 100)}%` : l.shutter ? 'laser ON' : n.sub) : n.id === 'daq' ? `${(s.experiment.records || []).length} records` : n.sub}</text>
            {spin && <g transform={`translate(${n.x + n.w - 14} ${n.y + n.h / 2})`}><g className={n.id === 'turbo' ? 'lw-fan fast' : 'lw-fan'}>{[0, 60, 120].map(a => <rect key={a} x="-8" y="-1.2" width="16" height="2.4" rx="1" fill="#cbd5e1" transform={`rotate(${a})`} />)}</g></g>}
            {level !== 'idle' && <g transform={`translate(${n.x + n.w - 15} ${n.y + 2})`}><AlertGlyph level={level} size={13} /></g>}
            {isHot && <rect x={n.x - 2} y={n.y - 2} width={n.w + 4} height={n.h + 4} rx="8" fill="none" stroke="#fff" strokeWidth="2" className="lw-ring" />}
          </g>
        );
      })}
      {anim === 'power' && <rect x="0" y="0" width="360" height="218" fill="#fbbf24" className="lw-flash" />}
      {pumpLevel === 'error' && <text x="316" y="172" textAnchor="middle" fontSize="8" fill={ALERT_HEX.error} fontFamily="ui-monospace,monospace" className="lw-blink">PUMP FAULT</text>}
    </svg>
  );
}

export default function LiveOperationWindow({ onOpenPage }: { onOpenPage?: (page: string) => void }) {
  const acts = useSyncExternalStore(subscribeActivity, getActivities, getActivities);
  const s = useLabSnapshot(160);
  const wall = useWallClock();
  const [collapsed, setCollapsed] = useState<boolean>(() => { try { const j = JSON.parse(localStorage.getItem(KEY) || '{}'); return j.collapsed ?? (typeof window !== 'undefined' && window.innerWidth < 900 || window.innerHeight < 720); } catch { return false; } });
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => { try { const j = JSON.parse(localStorage.getItem(KEY) || '{}'); return j.pos || null; } catch { return null; } });
  const [pick, setPick] = useState<number | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const root = useRef<HTMLElement>(null);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ collapsed, pos })); } catch { /* storage may be blocked */ } }, [collapsed, pos]);
  useEffect(() => { if (acts[0]) setPick(null); }, [acts[0]?.id, acts[0]?.count]);  // a new action always takes over the view
  const latest: Activity | undefined = acts[0];
  const shown: Activity | undefined = pick != null ? acts.find(a => a.id === pick) || latest : latest;
  const fresh = !!shown && pick == null && wall.getTime() - Date.parse(shown.iso) < 9000;
  const using = useMemo(() => getEquipmentUse(s).filter(e => e.active && e.id !== 'breaker'), [s]);
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const r = root.current!.getBoundingClientRect(); drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !root.current) return;
    const r = root.current.getBoundingClientRect();
    setPos({ x: clamp(e.clientX - drag.current.dx, 4, window.innerWidth - r.width - 4), y: clamp(e.clientY - drag.current.dy, 4, window.innerHeight - 40) });
  };
  const style: React.CSSProperties = pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : {};
  const level = shown?.level || 'info';
  return (
    <aside ref={root} className={`lw ${collapsed ? 'is-min' : ''}`} style={style} role="complementary" aria-label="Live operation window" data-live-window data-collapsed={collapsed ? 'true' : 'false'}>
      <div className="lw-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { drag.current = null; }} onDoubleClick={() => setPos(null)} title="Drag to move · double-click to dock">
        <span className="lw-title"><MonitorPlay size={14} aria-hidden="true" /><b>Live operation</b><i className="lw-rec" aria-hidden="true" /></span>
        <LabClock variant="screen" />
        {collapsed && shown && <span className="lw-mini" title={shown.title}>{shown.title}</span>}
        <button type="button" className="lw-btn" aria-label={collapsed ? 'Expand the live operation window' : 'Minimise the live operation window'} aria-expanded={!collapsed} onClick={() => setCollapsed(v => !v)}>{collapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>
      </div>
      {!collapsed && (
        <div className="lw-body">
          <Diagram s={s} focus={fresh ? shown!.equip : null} anim={fresh ? shown!.anim : null} />
          <div className="lw-using" aria-label="Equipment in use right now">
            <span className="lw-using-l">In use now</span>
            {using.length ? using.map(e => <span key={e.id} className="lw-pill" title={e.doing}>{e.name.replace(/ \(.*\)/, '')}</span>) : <span className="lw-none">nothing is running</span>}
          </div>
          <div className={`lw-card lv-${level}`} aria-live="polite">
            <div className="lw-scene">{shown ? <ActionScene anim={shown.anim} play={shown.id * 100 + shown.count} /> : <ActionScene anim="info" play={0} />}</div>
            <div className="lw-text">
              {shown ? (<>
                <div className="lw-meta"><span className={`lw-tag ${shown.kind}`}>{shown.kind === 'auto' ? 'AUTOMATIC' : 'YOU'}</span><time dateTime={shown.iso}>{shown.clock}</time>{shown.operator && <span className="lw-op">[{shown.operator}]</span>}{fresh && <span className="lw-now">NOW</span>}</div>
                <h4>{shown.title}{shown.count > 1 ? ` ×${shown.count}` : ''}</h4>
                <p className="lw-what">{shown.what}</p>
                <ul className="lw-fx">{shown.effects.map(f => <li key={f}>{f}</li>)}</ul>
                {shown.watch && <p className="lw-watch"><b>Watch:</b> {shown.watch}</p>}
                {onOpenPage && shown.equip && <button type="button" className="lw-link" onClick={() => onOpenPage(({ clock: 'clock', vna: 'vna', rf: 'vna', scope: 'scope', ldv: 'ldv', daq: 'runs', breaker: 'dashboard' } as Record<string, string>)[shown.equip] || 'chamber')}>Open this equipment →</button>}
              </>) : (<>
                <h4>Waiting for your first action</h4>
                <p className="lw-what">Flip a switch, move the stage or open a valve. This window shows the part that moved, plays what it does, and explains what it affects.</p>
              </>)}
            </div>
          </div>
          {acts.length > 1 && (
            <ol className="lw-hist" aria-label="Recent actions">
              {acts.slice(0, 7).map(a => <li key={a.id}><button type="button" className={`${shown?.id === a.id ? 'is-sel' : ''} lv-${a.level}`} onClick={() => setPick(a.id === acts[0].id ? null : a.id)}><time>{a.clock}</time><span>{a.title}{a.count > 1 ? ` ×${a.count}` : ''}</span></button></li>)}
            </ol>
          )}
        </div>
      )}
    </aside>
  );
}

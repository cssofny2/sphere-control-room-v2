import React from 'react';

// Small animated illustrations for each box on the lab map. Each one is drawn from the live state (a pump spins at its real speed,
// the sphere sits where the stage is, gas thins out as pressure falls ...) so the picture itself tells you what the equipment is doing.
// Everything is SVG + CSS, 170 × 56 units, and is switched off by the "reduce motion" setting (.ov-reduced).

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const down = (values: number[], n: number) => (values.length <= n ? values : Array.from({ length: n }, (_, i) => values[Math.floor((i * values.length) / n)]));
const path = (values: number[], x0: number, x1: number, y0: number, y1: number) => {
  if (values.length < 2) return '';
  const lo = Math.min(...values), hi = Math.max(...values), sp = hi - lo || 1;
  return values.map((v, i) => `${(x0 + (i / (values.length - 1)) * (x1 - x0)).toFixed(1)},${(y1 - ((v - lo) / sp) * (y1 - y0)).toFixed(1)}`).join(' ');
};
const Screen = ({ x, y, w, h, children, glow = '#38bdf8' }: { x: number; y: number; w: number; h: number; children?: React.ReactNode; glow?: string }) => (
  <g><rect x={x} y={y} width={w} height={h} rx="4" fill="#03080d" stroke="#223244" strokeWidth="1.5" /><rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} rx="3" fill="none" stroke={glow} strokeOpacity=".18" />
    {Array.from({ length: 5 }).map((_, i) => <line key={`v${i}`} x1={x + (i + 1) * (w / 6)} x2={x + (i + 1) * (w / 6)} y1={y + 2} y2={y + h - 2} stroke="#12202e" />)}{Array.from({ length: 3 }).map((_, i) => <line key={`h${i}`} y1={y + (i + 1) * (h / 4)} y2={y + (i + 1) * (h / 4)} x1={x + 2} x2={x + w - 2} stroke="#12202e" />)}{children}</g>
);

export function EquipArt({ id, s, off }: { id: string; s: any; off: boolean }) {
  const c = s.chamber, v = s.vna, l = s.ldv, sc = s.scope, ck = s.clock, st = s.stage, ex = s.experiment || {}, f = s.facility;
  let body: React.ReactNode = null;
  switch (id) {
    case 'clock': {
      const on = !!ck.power, locked = !!ck.locked, col = !on ? '#475569' : locked ? '#34d399' : '#22d3ee';
      body = (<>
        <g transform="translate(34 28)"><circle r="23" fill="#06131d" stroke={col} strokeOpacity=".4" />{[0, 60, 120].map(a => <ellipse key={a} rx="22" ry="8" fill="none" stroke={col} strokeOpacity=".7" transform={`rotate(${a})`} />)}
          {on && [14, 9, 11].map((d, i) => <g key={i} className="ova-spin" style={{ animationDuration: `${2.2 + i * 0.9}s`, transformOrigin: '0 0' }}><circle cx={22 - i * 3} cy="0" r="2.4" fill="#e0f2fe" /></g>)}<circle r="4" fill={col} className={on && !locked ? 'ova-beat' : ''} /></g>
        <g transform="translate(70 8)"><rect width="94" height="40" rx="4" fill="#03080d" stroke="#16283a" /><clipPath id="ova-clk"><rect width="94" height="40" /></clipPath>
          <g clipPath="url(#ova-clk)"><path className={on ? 'ova-scroll' : ''} d="M0 28 h6 v-18 h6 v18 h6 v-18 h6 v18 h6 v-18 h6 v18 h6 v-18 h6 v18 h6 v-18 h6 v18 h6 v-18 h6 v18 h6 v-18 h6 v18 h6 v-18 h6 v18 h6 v-18 h6 v18 h6 v-18 h6 v18 h6 v-18 h6 v18" fill="none" stroke={col} strokeWidth="2" opacity={on ? (locked ? 1 : 0.55) : 0.2} /></g>
          <text x="47" y="37" textAnchor="middle" fontSize="7" fill="#7f93a8" fontFamily="ui-monospace,monospace">{on ? (locked ? '10 MHz · LOCKED' : `WARM ${Math.min(99, Math.round(((ck.warmup || 0) / 15) * 100))}%`) : 'OFF'}</text></g>
      </>); break;
    }
    case 'vna': {
      const on = !!v.power, tr = down((v.trace || []).map((q: any) => q.s11), 50), pts = path(tr, 8, 108, 8, 42), rf = on && v.rf;
      body = (<>
        <Screen x={4} y={4} w={112} h={46} glow="#5fd4ff">
          {pts ? <polyline points={pts} fill="none" stroke="#5fd4ff" strokeWidth="1.8" opacity={on ? 1 : 0.25} /> : <line x1="8" x2="108" y1="24" y2="24" stroke="#334155" strokeDasharray="3 4" />}
          {on && v.sweeping && <line className="ova-sweep" x1="8" x2="8" y1="6" y2="48" stroke="#fbbf24" strokeWidth="1.5" />}
        </Screen>
        <g transform="translate(124 8)">{[0, 1, 2].map(i => <circle key={i} cx="8" cy={6 + i * 14} r="5" fill="#0a1118" stroke={rf ? '#e879f9' : '#475569'} strokeWidth="2" />)}</g>
        {rf && [0, 1].map(i => <circle key={i} className="ova-ripple" cx="140" cy="28" r="6" fill="none" stroke="#e879f9" style={{ animationDelay: `${i * 0.7}s` }} />)}
        <text x="146" y="52" textAnchor="middle" fontSize="7" fill="#9fb3c8" fontFamily="ui-monospace,monospace">{on ? (rf ? 'RF ON' : 'RF off') : 'OFF'}</text>
      </>); break;
    }
    case 'scope': {
      const on = !!sc.power && !sc.booting, tr = down((sc.trace || []).map((q: any) => q.value), 70), pts = path(tr, 8, 112, 8, 46), chans = sc.channels || {};
      body = (<>
        <Screen x={4} y={4} w={118} h={48} glow="#ffe066">
          {sc.booting ? <text x="63" y="32" textAnchor="middle" fontSize="8" fill="#9fd3f0" fontFamily="ui-monospace,monospace">SELF-TEST…</text> : pts && on ? <polyline points={pts} fill="none" stroke="#ffe066" strokeWidth="1.7" /> : <line x1="8" x2="118" y1="28" y2="28" stroke="#334155" strokeDasharray="3 4" />}
          {on && sc.triggerState === 'armed' && <text x="63" y="16" textAnchor="middle" fontSize="7" fill="#fb923c" fontFamily="ui-monospace,monospace">WAIT…</text>}
        </Screen>
        <g transform="translate(130 8)">{['ch1', 'ch2', 'ch3', 'ch4'].map((k, i) => { const col = ['#ffe066', '#22d3ee', '#f472b6', '#4ade80'][i]; const en = !!chans[k]?.enabled && on; return <g key={k}><circle cx="8" cy={5 + i * 11} r="4" fill={en ? col : '#0a1118'} stroke={col} strokeWidth="1.6" opacity={en ? 1 : 0.4} /><text x="18" y={8 + i * 11} fontSize="6.5" fill="#8fa3b8" fontFamily="ui-monospace,monospace">{i + 1}</text></g>; })}</g>
      </>); break;
    }
    case 'facility': {
      const on = !!f.power;
      body = (<>
        <g transform="translate(8 6)"><rect width="38" height="44" rx="5" fill="#161e29" stroke={on ? '#fbbf24' : '#475569'} strokeWidth="1.8" /><rect x="13" y="8" width="12" height="28" rx="3" fill="#0a1118" /><g style={{ transition: 'transform .4s', transformOrigin: '19px 22px', transform: on ? 'none' : 'scaleY(-1)' }}><rect x="14" y="9" width="10" height="13" rx="2" fill={on ? '#22c55e' : '#ef4444'} /></g>
          {on && <path className="ova-bolt" d="M31 4 l-6 11 h5 l-3 9 l8 -13 h-5 z" fill="#fbbf24" />}</g>
        <g transform="translate(62 6)"><rect width="40" height="44" rx="4" fill="#0a1118" stroke={c.faraday ? '#fbbf24' : '#475569'} strokeWidth="1.8" strokeDasharray="4 3" className={c.faraday && on ? 'ova-dash' : ''} />{[10, 20, 30].map(x => <line key={x} x1={x} x2={x} y1="4" y2="40" stroke="#fbbf24" strokeOpacity={c.faraday ? 0.4 : 0.1} />)}{[12, 24, 34].map(y => <line key={y} x1="4" x2="36" y1={y} y2={y} stroke="#fbbf24" strokeOpacity={c.faraday ? 0.4 : 0.1} />)}<circle cx="20" cy="22" r="6" fill="#d9803f" /></g>
        <g transform="translate(116 6)"><rect y="26" width="46" height="6" rx="2" fill="#334155" />{[8, 38].map(x => <path key={x} className={c.isolation && on ? 'ova-spring' : ''} d={`M${x} 32 l-3 3 l6 3 l-6 3 l6 3`} fill="none" stroke={c.isolation ? '#a78bfa' : '#fb7185'} strokeWidth="1.8" style={{ transformOrigin: `${x}px 32px` }} />)}<rect x="12" y="10" width="22" height="14" rx="3" fill="#1d2735" stroke="#64748b" /></g>
        <g fontSize="7" fill="#9fb3c8" fontFamily="ui-monospace,monospace" textAnchor="middle"><text x="27" y="55">AC</text><text x="82" y="55">SHIELD</text><text x="139" y="55">FLOAT</text></g>
      </>); break;
    }
    case 'chamber': {
      const haze = clamp((Math.log10(Math.max(c.pressure, 1e-6)) + 3) / (Math.log10(760) + 3), 0, 1), n = Math.round(3 + 22 * haze), dT = c.temperature - c.targetTemp;
      const ax = st.actualX ?? st.x, az = st.actualZ ?? st.z, sx = 62 + ax * 0.55, sy = 30 - az * 0.45, laser = l.power && l.shutter, pumping = (c.roughingRpm || 0) > 1 || (c.turboRpm || 0) > 1;
      body = (<>
        <rect x="6" y="6" width="112" height="46" rx="9" fill="#07111b" stroke={c.faraday ? '#7c6a3a' : '#3b4d62'} strokeWidth="2" />
        <rect x="12" y="11" width="100" height="36" rx="6" fill="#050b12" />{Math.abs(dT) > 0.03 && <rect x="12" y="11" width="100" height="36" rx="6" fill={dT > 0 ? '#fb923c' : '#38bdf8'} opacity={clamp(Math.abs(dT) / 8, 0.05, 0.3)} />}
        {Array.from({ length: n }).map((_, i) => <circle key={i} className={pumping ? 'ova-suck' : 'ova-drift'} r="1.2" cx={16 + ((i * 37) % 92)} cy={14 + ((i * 23) % 30)} fill="#9fc4e8" opacity=".75" style={{ animationDelay: `${-i * 0.4}s` }} />)}
        <line x1={sx} y1={sy} x2={sx} y2="47" stroke="#556377" strokeWidth="2.4" />{laser && <line className="ova-flick" x1="62" y1="6" x2={sx} y2={sy - 6} stroke="#ff4d63" strokeWidth="1.6" />}
        <circle cx={sx} cy={sy} r="6" fill="url(#ova-cu)" stroke="#fcd34d" strokeWidth=".6" />
        {c.doorOpen && <rect x="112" y="8" width="8" height="42" fill="#fb7185" opacity=".8" className="ova-flick" />}
        <g transform="translate(126 8)"><rect width="10" height="40" rx="5" fill="#0a1118" stroke="#64748b" /><rect x="2.5" y={40 - clamp(18 + dT * 6, 4, 36)} width="5" height={clamp(18 + dT * 6, 4, 36) - 2} rx="2.5" fill={Math.abs(dT) < 0.03 ? '#34d399' : '#fb923c'} /></g>
        <text x="152" y="22" textAnchor="middle" fontSize="7" fill="#9fb3c8" fontFamily="ui-monospace,monospace">{c.temperature.toFixed(1)}°</text><text x="152" y="34" textAnchor="middle" fontSize="6.5" fill="#7f93a8" fontFamily="ui-monospace,monospace">{c.pressure >= 10 ? c.pressure.toFixed(0) : c.pressure.toExponential(0)}</text><text x="152" y="43" textAnchor="middle" fontSize="6" fill="#64748b" fontFamily="ui-monospace,monospace">Torr</text>
      </>); break;
    }
    case 'ldv': {
      const on = !!l.power, beam = on && l.shutter, scan = on && l.scanActive && !l.scanStalled;
      body = (<>
        <rect x="8" y="4" width="46" height="16" rx="4" fill="#162434" stroke={on ? '#e879f9' : '#475569'} strokeWidth="1.8" /><circle cx="16" cy="12" r="3" fill={on ? '#d946ef' : '#475569'} className={on ? 'ova-flick' : ''} /><rect x="24" y="9" width="24" height="6" rx="2" fill="#0a1118" />
        <g className={scan ? 'ova-sweepbeam' : ''} style={{ transformOrigin: '31px 20px' }}>{beam && <path className="ova-flick" d="M31 20 L31 44" stroke="#ff4d63" strokeWidth="2" />}</g>
        <circle cx="31" cy="48" r="7" fill="url(#ova-cu)" stroke="#fcd34d" strokeWidth=".6" />{beam && <circle className="ova-beat" cx="31" cy="42" r="2" fill="#ff8a98" />}
        {beam && <path className="ova-dash" d="M38 46 C 60 40, 70 24, 62 12" fill="none" stroke="#fde68a" strokeWidth="1.4" strokeDasharray="4 4" opacity=".8" />}
        <g transform="translate(78 6)"><rect width="84" height="44" rx="5" fill="#0c1621" stroke="#16283a" /><text x="42" y="12" textAnchor="middle" fontSize="7" fill="#bae6fd" fontFamily="ui-monospace,monospace">DOPPLER → VELOCITY</text>
          <path className={beam ? 'ova-scroll-slow' : ''} d="M-10 30 q5 -14 10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0" fill="none" stroke="#5fd4ff" strokeWidth="1.6" opacity={beam ? 1 : 0.2} />
          {scan && <rect x="6" y="38" width={72 * (l.scanProgress || 0)} height="3" rx="1.5" fill="#e879f9" />}</g>
      </>); break;
    }
    case 'pumps': {
      const rr = c.roughingRpm || 0, tt = c.turboRpm || 0;
      const rotor = (cx: number, rpm: number, col: string, label: string) => (<g transform={`translate(${cx} 24)`}><circle r="19" fill="#0a1522" stroke={rpm > 1 ? col : '#475569'} strokeWidth="1.8" /><g className={rpm > 1 ? 'ova-spin' : ''} style={{ animationDuration: `${Math.max(0.25, 1.6 - rpm / 80)}s`, transformOrigin: '0 0' }}>{[0, 60, 120].map(a => <rect key={a} x="-15" y="-2" width="30" height="4" rx="2" fill={rpm > 1 ? col : '#64748b'} transform={`rotate(${a})`} />)}</g><circle r="3.4" fill="#0a1118" /><text y="33" textAnchor="middle" fontSize="7" fill="#9fb3c8" fontFamily="ui-monospace,monospace">{label} {Math.round(rpm)}%</text></g>);
      body = (<>{rotor(42, rr, '#cbd5e1', 'ROUGH')}{rotor(126, tt, '#7dd3fc', 'TURBO')}<path d="M64 24 H104" stroke="#334155" strokeWidth="5" />{(rr > 1 || tt > 1) && <path className="ova-dash" d="M104 24 H64" stroke="#7dd3fc" strokeWidth="2" strokeDasharray="4 5" />}</>); break;
    }
    case 'experiment': {
      const act = !!(ex.active || ex.scanActive), prog = ex.scanActive ? ex.scanProgress || 0 : 0;
      body = (<>
        <rect x="8" y="4" width="76" height="40" rx="4" fill="#0b1c18" stroke={act ? '#34d399' : '#334155'} strokeWidth="1.8" /><rect x="12" y="8" width="68" height="6" rx="2" fill="#07140f" /><rect x="12" y="8" width={68 * prog} height="6" rx="2" fill="#34d399" />
        {[0, 1, 2].map(i => <rect key={i} className={act ? 'ova-row' : ''} x="12" y={19 + i * 8} width={20 + ((i * 17) % 40)} height="4" rx="1.5" fill={act ? '#34d399' : '#334155'} opacity=".8" style={{ animationDelay: `${i * 0.5}s` }} />)}
        <rect x="36" y="46" width="12" height="4" fill="#334155" /><rect x="26" y="49" width="32" height="3" rx="1.5" fill="#334155" />
        <path className={act ? 'ova-dash' : ''} d="M90 24 H122" stroke={act ? '#6ee7b7' : '#334155'} strokeWidth="2" strokeDasharray="5 4" />
        <g transform="translate(124 6)"><rect width="38" height="40" rx="4" fill="#0a1118" stroke="#334155" /><text x="19" y="16" textAnchor="middle" fontSize="7" fill="#9fb3c8" fontFamily="ui-monospace,monospace">records</text><text x="19" y="32" textAnchor="middle" fontSize="14" fontWeight="700" fill="#e8f1fb" fontFamily="ui-monospace,monospace">{(ex.records || []).length}</text></g>
      </>); break;
    }
    case 'spatial': {
      const a = ex.acceptedPoints || 0, su = ex.suspectPoints || 0, fa = ex.failedPoints || 0, tot = a + su + fa, recs = (ex.records || []).slice(0, 26);
      body = (<>
        <g transform="translate(8 4)"><path d="M22 2 L40 8 V26 C40 38 32 46 22 50 C12 46 4 38 4 26 V8 Z" fill="#0a1a16" stroke={tot ? (fa ? '#fb7185' : su ? '#fbbf24' : '#34d399') : '#475569'} strokeWidth="2" />{tot > 0 && (fa ? <path d="M15 20 l14 14 M29 20 l-14 14" stroke="#fb7185" strokeWidth="3" strokeLinecap="round" /> : <path className="ova-draw" d="M13 27 l7 8 l12 -15" fill="none" stroke={su ? '#fbbf24' : '#34d399'} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />)}</g>
        <g transform="translate(58 6)"><rect width="104" height="44" rx="4" fill="#03080d" stroke="#16283a" />{recs.length ? recs.map((r: any, i: number) => <circle key={i} className="ova-pop" cx={8 + ((i * 29) % 88)} cy={8 + ((i * 17) % 28)} r="3" fill={r.valid === false ? '#fb7185' : r.uncertaintyHz > 1 ? '#fbbf24' : '#34d399'} style={{ animationDelay: `${i * 0.06}s` }} />) : <text x="52" y="26" textAnchor="middle" fontSize="7.5" fill="#64748b" fontFamily="ui-monospace,monospace">no data yet</text>}</g>
      </>); break;
    }
    default: body = null;
  }
  return (
    <svg className={`ov-art${off ? ' is-off' : ''}`} viewBox="0 0 170 56" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <defs><radialGradient id="ova-cu" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#ffe3c4" /><stop offset=".4" stopColor="#d9803f" /><stop offset="1" stopColor="#4a2410" /></radialGradient></defs>
      {body}
    </svg>
  );
}

/** Tiny XYZ gizmo for the stage sub-card. */
export function StageArt({ s, off }: { s: any; off: boolean }) {
  const st = s.stage, ax = st.actualX ?? st.x, ay = st.actualY ?? st.y, az = st.actualZ ?? st.z, moving = st.moving || st.settling;
  const px = 24 + ax * 0.32 + ay * 0.16, py = 26 - az * 0.28 + ay * 0.1;
  return (
    <svg className={`ov-art ov-art-stage${off ? ' is-off' : ''}`} viewBox="0 0 64 36" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <path d="M8 30 H56 M8 30 V4 M8 30 L22 20" stroke="#475569" strokeWidth="1.4" fill="none" /><text x="58" y="33" fontSize="6" fill="#94a3b8" fontFamily="ui-monospace,monospace">X</text><text x="11" y="6" fontSize="6" fill="#94a3b8" fontFamily="ui-monospace,monospace">Z</text><text x="23" y="19" fontSize="6" fill="#94a3b8" fontFamily="ui-monospace,monospace">Y</text>
      <line x1={px} y1={py} x2={px} y2="30" stroke="#475569" strokeDasharray="1.5 2" />{moving && <circle cx={px} cy={py} r="7" fill="none" stroke="#c084fc" className="ova-ripple" />}
      <circle cx={px} cy={py} r="4.6" fill="#d9803f" stroke="#fcd34d" strokeWidth=".6" style={{ transition: 'cx .5s, cy .5s' }} />
    </svg>
  );
}

import React from 'react';
import type { AnimKind } from './activity';

// One short looping picture per kind of action, drawn on the same little chamber so the eye learns where things are.
// Pure SVG + CSS animation (see live.css). `play` restarts the loop whenever a new action arrives (it is used as a React key).

const Chamber = ({ glow = '#38bdf8', children, sphere = true }: { glow?: string; children?: React.ReactNode; sphere?: boolean }) => (
  <g>
    <rect x="52" y="22" width="96" height="78" rx="10" fill="#07111b" stroke="#3b4d62" strokeWidth="2" />
    <rect x="58" y="28" width="84" height="66" rx="6" fill="none" stroke={glow} strokeOpacity=".25" />
    <rect x="86" y="14" width="28" height="9" rx="2" fill="#16283a" stroke="#4b6078" />
    <rect x="60" y="92" width="80" height="4" fill="#1e2c3c" />
    {sphere && <><circle cx="100" cy="66" r="9" fill="url(#as-cu)" stroke="#fcd34d" strokeWidth=".8" /><rect x="98.5" y="75" width="3" height="17" fill="#556377" /></>}
    {children}
  </g>
);
const Pump = ({ x = 156, y = 58, turbo = false, on = true }: { x?: number; y?: number; turbo?: boolean; on?: boolean }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect width="34" height="30" rx="5" fill="#122131" stroke={turbo ? '#38bdf8' : '#94a3b8'} strokeWidth="1.6" />
    <g transform="translate(17 15)"><g className={on ? (turbo ? 'as-fan as-fast' : 'as-fan') : ''}>{[0, 60, 120].map(a => <rect key={a} x="-11" y="-1.6" width="22" height="3.2" rx="1.4" fill={turbo ? '#7dd3fc' : '#cbd5e1'} transform={`rotate(${a})`} />)}<circle r="2.6" fill="#0a1118" /></g></g>
    <text x="17" y="42" textAnchor="middle" fontSize="7" fill="#9fb3c8" fontFamily="ui-monospace,monospace">{turbo ? 'TURBO' : 'ROUGH'}</text>
  </g>
);
const Gas = ({ dir = 'out', n = 9 }: { dir?: 'out' | 'in'; n?: number }) => (
  <g>{Array.from({ length: n }).map((_, i) => <circle key={i} className={dir === 'out' ? 'as-gas-out' : 'as-gas-in'} r="1.7" cx={70 + ((i * 17) % 60)} cy={36 + ((i * 29) % 50)} fill="#9fc4e8" style={{ animationDelay: `${-i * 0.33}s` }} />)}</g>
);
const Gauge = ({ rising = false }: { rising?: boolean }) => (
  <g transform="translate(168 14)"><circle r="11" cx="11" cy="11" fill="#06101a" stroke="#475569" /><line x1="11" y1="11" x2="11" y2="3.5" stroke="#7dd3fc" strokeWidth="1.6" strokeLinecap="round" className={rising ? 'as-needle-up' : 'as-needle-down'} style={{ transformOrigin: '11px 11px', transformBox: 'fill-box' }} /></g>
);
const Label = ({ t }: { t: string }) => <text x="100" y="114" textAnchor="middle" fontSize="8" fill="#9fb3c8" fontFamily="ui-monospace,monospace">{t}</text>;

export function ActionScene({ anim, play }: { anim: AnimKind; play: number }) {
  const body = (() => {
    switch (anim) {
      case 'power': return (
        <g>
          <g transform="translate(14 28)"><rect width="26" height="46" rx="4" fill="#1b2634" stroke="#64748b" /><rect x="8" y="6" width="10" height="34" rx="3" fill="#0a1118" /><g className="as-switch"><rect x="9" y="7" width="8" height="17" rx="2" fill="#22c55e" /></g></g>
          {[['CLK', 62], ['VNA', 92], ['SCP', 122], ['LDV', 152]].map(([t, x], i) => <g key={t as string} transform={`translate(${x} 34)`} className="as-boot" style={{ animationDelay: `${0.5 + i * 0.35}s` }}><rect width="26" height="24" rx="4" fill="#0f1b28" stroke="#334155" /><circle cx="13" cy="9" r="3" className="as-led" fill="#22c55e" /><text x="13" y="20" textAnchor="middle" fontSize="6.5" fill="#9fb3c8" fontFamily="ui-monospace,monospace">{t}</text></g>)}
          <path className="as-bolt" d="M44 52 L58 52 M58 52 L88 52 M88 52 L118 52 M118 52 L148 52" stroke="#fbbf24" strokeWidth="1.6" strokeDasharray="5 5" fill="none" />
          <Label t="AC power energises the rack" />
        </g>);
      case 'clock': return (
        <g>
          <g transform="translate(46 56)"><circle r="20" fill="#071420" stroke="#22d3ee" strokeOpacity=".5" />{[0, 60, 120].map(a => <ellipse key={a} rx="19" ry="7" fill="none" stroke="#22d3ee" strokeOpacity=".7" transform={`rotate(${a})`} />)}<g className="as-orbit"><circle cx="19" r="2.6" fill="#a5f3fc" /></g><circle r="3.4" fill="#22d3ee" /></g>
          <path className="as-wave-run" d="M84 56 q8 -22 16 0 t16 0 t16 0 t16 0" fill="none" stroke="#22d3ee" strokeWidth="2" />
          <text x="150" y="40" fontSize="9" fill="#a5f3fc" fontFamily="ui-monospace,monospace" textAnchor="middle">10 MHz</text>
          <rect x="132" y="66" width="36" height="12" rx="6" fill="#0a2a1c" stroke="#22c55e" /><text x="150" y="75" textAnchor="middle" fontSize="7" fill="#86efac" fontFamily="ui-monospace,monospace">LOCK</text>
          <Label t="Atomic reference warms up and locks" />
        </g>);
      case 'rough': case 'turbo': return (
        <g><Chamber /><Gas dir="out" n={anim === 'turbo' ? 5 : 11} /><path d="M148 70 H156" stroke="#64748b" strokeWidth="5" /><Pump turbo={anim === 'turbo'} /><Gauge /><Label t={anim === 'turbo' ? 'Turbo pump pulls out the last molecules' : 'Roughing pump removes most of the air'} /></g>);
      case 'vent': return (
        <g><Chamber /><rect x="94" y="8" width="12" height="7" fill="#16a34a" /><Gas dir="in" n={12} /><Gauge rising /><Label t="Vent valve lets air flow back in" /></g>);
      case 'door': return (
        <g><Chamber glow="#fb7185" /><g transform="translate(148 24)"><g className="as-door"><rect x="0" y="0" width="6" height="74" rx="2" fill="#475569" stroke="#94a3b8" /></g></g><g transform="translate(160 54)" className="as-blink"><path d="M0 14 L11 -6 L22 14 Z" fill="none" stroke="#fb7185" strokeWidth="2" /><text x="11" y="11" textAnchor="middle" fontSize="11" fill="#fb7185" fontWeight="700">!</text></g><Label t="Door state changes pumping and stage permission" /></g>);
      case 'thermal': return (
        <g><Chamber glow="#fb923c" sphere />{[72, 92, 112, 132].map((x, i) => <path key={x} className="as-heat" d={`M${x} 88 q-4 -6 0 -12 t0 -12`} fill="none" stroke="#fb923c" strokeWidth="1.8" strokeLinecap="round" style={{ animationDelay: `${i * 0.25}s` }} />)}<rect x="160" y="26" width="10" height="64" rx="5" fill="#0a1118" stroke="#64748b" /><rect className="as-mercury" x="162.5" y="30" width="5" height="58" rx="2.5" fill="#fb923c" /><Label t="Thermostat drives temperature to the setpoint" /></g>);
      case 'faraday': return (
        <g><Chamber glow="#fbbf24" /><rect className="as-cage" x="46" y="16" width="108" height="90" rx="8" fill="none" stroke="#fbbf24" strokeWidth="1.6" strokeDasharray="4 3" />{[0, 1, 2].map(i => <path key={i} className="as-bounce" d={`M12 ${40 + i * 20} q 18 -10 34 0`} fill="none" stroke="#f472b6" strokeWidth="1.6" style={{ animationDelay: `${i * 0.35}s` }} />)}<Label t="Cage blocks outside radio noise" /></g>);
      case 'isolation': return (
        <g><Chamber glow="#a78bfa" /><rect x="46" y="100" width="108" height="6" rx="2" fill="#334155" />{[58, 100, 142].map(x => <path key={x} className="as-spring" d={`M${x} 106 l-4 3 l8 3 l-8 3 l8 3 l-4 3`} fill="none" stroke="#a78bfa" strokeWidth="1.6" style={{ transformOrigin: `${x}px 106px` }} />)}<path className="as-floor" d="M20 116 h160" stroke="#64748b" strokeDasharray="3 3" /><Label t="Springs float the table above floor vibration" /></g>);
      case 'stage': case 'home': return (
        <g><Chamber /><circle cx="118" cy="52" r="9" fill="none" stroke="#fff" strokeOpacity=".7" strokeDasharray="3 3" /><circle className="as-travel" r="9" cx="82" cy="78" fill="url(#as-cu)" stroke="#fcd34d" strokeWidth=".8" /><path d="M82 78 L118 52" stroke="#7dd3fc" strokeDasharray="3 3" fill="none" /><g fontSize="7" fill="#9fb3c8" fontFamily="ui-monospace,monospace"><text x="150" y="104">X →</text><text x="150" y="114">Z ↑</text></g><Label t={anim === 'home' ? 'Stage returns to its home (0, 0, 0)' : 'The servo drives the sphere to the new spot'} /></g>);
      case 'clamp': return (
        <g><Chamber /><g className="as-jaw-l"><rect x="80" y="88" width="9" height="12" fill="#cbd5e1" /></g><g className="as-jaw-r"><rect x="111" y="88" width="9" height="12" fill="#cbd5e1" /></g><Label t="Mechanical clamp locks or frees the stage" /></g>);
      case 'rf': return (
        <g><Chamber glow="#e879f9" />{[0, 1, 2].map(i => <circle key={i} className="as-ripple" cx="42" cy="62" r="6" fill="none" stroke="#e879f9" strokeWidth="1.6" style={{ animationDelay: `${i * 0.45}s` }} />)}<rect x="14" y="48" width="26" height="28" rx="4" fill="#1a0f26" stroke="#e879f9" /><text x="27" y="65" textAnchor="middle" fontSize="7" fill="#f5d0fe" fontFamily="ui-monospace,monospace">VNA</text><path d="M40 62 H62" stroke="#e879f9" strokeWidth="2" strokeDasharray="4 3" className="as-flow" /><Label t="RF test tone travels to the sphere" /></g>);
      case 'sweep': case 'calibrate': return (
        <g><rect x="22" y="22" width="156" height="70" rx="6" fill="#06101a" stroke="#334155" />{[0, 1, 2, 3].map(i => <line key={i} x1="22" x2="178" y1={34 + i * 16} y2={34 + i * 16} stroke="#142030" />)}<path d="M26 40 C70 40 80 40 90 44 S98 82 100 84 S108 44 118 40 C140 38 160 40 174 40" fill="none" stroke="#5fd4ff" strokeWidth="2" className="as-draw" /><line className="as-cursor" x1="22" x2="22" y1="24" y2="90" stroke="#fbbf24" strokeWidth="1.6" />{anim === 'calibrate' && ['OPEN', 'SHORT', 'LOAD'].map((t, i) => <g key={t} className="as-std" style={{ animationDelay: `${i * 0.9}s` }}><rect x={60 + i * 34} y="96" width="30" height="12" rx="3" fill="#0f2233" stroke="#38bdf8" /><text x={75 + i * 34} y="105" textAnchor="middle" fontSize="6.5" fill="#bae6fd" fontFamily="ui-monospace,monospace">{t}</text></g>)}<Label t={anim === 'calibrate' ? 'Known standards remove cable errors' : 'The dip in S11 is the resonance'} /></g>);
      case 'laser': return (
        <g><Chamber glow="#fb7185" /><rect x="84" y="2" width="32" height="12" rx="3" fill="#162434" stroke="#f43f5e" /><path className="as-beam" d="M100 14 L100 57" stroke="#ff4d63" strokeWidth="2.2" /><circle className="as-spot" cx="100" cy="57" r="3.2" fill="#ff7a8a" /><Label t="Class 2 red beam hits the sphere" /></g>);
      case 'ldvscan': return (
        <g><Chamber glow="#e879f9" /><rect x="84" y="2" width="32" height="12" rx="3" fill="#162434" stroke="#e879f9" /><g className="as-scanbeam"><path d="M100 14 L100 60" stroke="#ff4d63" strokeWidth="1.8" /></g>{Array.from({ length: 25 }).map((_, i) => <circle key={i} className="as-dotfill" cx={91 + (i % 5) * 4.5} cy={57 + Math.floor(i / 5) * 4.2 - 2} r="1.4" fill="#e879f9" style={{ animationDelay: `${i * 0.12}s` }} />)}<Label t="Mirrors steer the spot over the sphere, point by point" /></g>);
      case 'scope': return (
        <g><rect x="22" y="20" width="156" height="76" rx="6" fill="#050a10" stroke="#334155" />{[0, 1, 2, 3, 4].map(i => <line key={i} x1="22" x2="178" y1={30 + i * 15} y2={30 + i * 15} stroke="#142030" />)}<g className="as-scroll"><path d="M22 58 q10 -26 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" fill="none" stroke="#ffe066" strokeWidth="1.8" /></g><Label t="Live waveform of the chosen signal" /></g>);
      case 'run': case 'record': return (
        <g><Chamber glow="#34d399" /><path d="M148 70 H164" stroke="#34d399" strokeDasharray="3 3" className="as-flow" /><rect x="164" y="36" width="30" height="56" rx="4" fill="#0b1c18" stroke="#34d399" />{[0, 1, 2, 3].map(i => <rect key={i} className="as-row" x="168" y={42 + i * 11} width="22" height="7" rx="1.5" fill="#34d399" style={{ animationDelay: `${i * 0.4}s` }} />)}{[0, 1, 2].map(i => <rect key={i} className="as-packet" x="150" y="67" width="6" height="6" rx="1" fill="#6ee7b7" style={{ animationDelay: `${i * 0.5}s` }} />)}<Label t={anim === 'record' ? 'A measurement is saved to the run' : 'The workstation records every sweep'} /></g>);
      case 'fault': case 'alarm': return (
        <g><Chamber glow="#fb7185" /><rect className="as-alarm" x="48" y="18" width="104" height="86" rx="12" fill="none" stroke="#fb7185" strokeWidth="2.4" /><g transform="translate(80 40)" className="as-blink"><path d="M20 4 L38 38 H2 Z" fill="#3a0f18" stroke="#fb7185" strokeWidth="2.4" strokeLinejoin="round" /><text x="20" y="32" textAnchor="middle" fontSize="20" fill="#fb7185" fontWeight="800">!</text></g><Label t="A fault or alarm needs attention" /></g>);
      case 'speed': return (
        <g><g transform="translate(100 56)"><circle r="30" fill="#071420" stroke="#38bdf8" strokeOpacity=".5" /><line className="as-hand-s" y2="-24" stroke="#7dd3fc" strokeWidth="2" strokeLinecap="round" /><line className="as-hand-m" y2="-16" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" /></g>{[0, 1, 2].map(i => <path key={i} className="as-chev" d={`M${148 + i * 9} 42 l9 14 l-9 14`} fill="none" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" style={{ animationDelay: `${i * 0.15}s` }} />)}<Label t="Simulated time runs faster" /></g>);
      default: return (<g><Chamber />{[0, 1].map(i => <circle key={i} className="as-ripple" cx="100" cy="66" r="9" fill="none" stroke="#38bdf8" strokeWidth="1.6" style={{ animationDelay: `${i * 0.6}s` }} />)}<Label t="Something in the lab changed" /></g>);
    }
  })();
  return (
    <svg key={play} className="as-scene" viewBox="0 0 200 120" role="img" aria-label={`Animation of: ${anim}`}>
      <defs><radialGradient id="as-cu" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#ffe3c4" /><stop offset=".4" stopColor="#d9803f" /><stop offset="1" stopColor="#4a2410" /></radialGradient></defs>
      {body}
    </svg>
  );
}

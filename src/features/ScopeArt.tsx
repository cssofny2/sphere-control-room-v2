import React from 'react';
import { CH_COLOR, CHANNELS, SCOPE_SOURCES, type ChannelCfg, type ChannelId, type ScopeSource } from './scopeModel';

/* Illustrations for the oscilloscope page: scenario thumbnails and a "where does each probe connect?" map. */

export function ScenarioIcon({ kind, size = 56 }: { kind: string; size?: number }) {
  const h = Math.round(size * 0.75);
  const inner = (() => {
    switch (kind) {
      case 'rf': return <><path className="sx-wave" d="M4 24 q6 -18 12 0 t12 0 t12 0 t12 0 t12 0" fill="none" stroke="#ffe066" strokeWidth="2.2" /><circle cx="52" cy="10" r="3" fill="#e879f9" /><path d="M46 10 a6 6 0 0 1 0 0" stroke="#e879f9" /></>;
      case 'clock': return <><path className="sx-wave" d="M4 34 V14 H14 V34 H24 V14 H34 V34 H44 V14 H54 V34" fill="none" stroke="#f472b6" strokeWidth="2.2" /><circle cx="46" cy="38" r="6" fill="none" stroke="#22d3ee" /><path d="M46 34 V38 L49 40" stroke="#22d3ee" fill="none" /></>;
      case 'hum': return <><path className="sx-wave" d="M3 24 q12 -26 24 0 t24 0" fill="none" stroke="#4ade80" strokeWidth="2.4" /><path d="M40 6 l-5 9 h5 l-4 9" stroke="#fbbf24" strokeWidth="2" fill="none" strokeLinejoin="round" /></>;
      case 'floor': return <><rect x="8" y="22" width="40" height="5" rx="2" fill="#475569" /><path className="sx-spring" d="M16 27 l-3 3 l6 3 l-6 3 l3 3 M40 27 l-3 3 l6 3 l-6 3 l3 3" fill="none" stroke="#a78bfa" strokeWidth="1.8" /><path className="sx-wave" d="M6 14 q4 -8 8 0 t8 0 t8 0 t8 0 t8 0" fill="none" stroke="#4ade80" strokeWidth="1.8" /></>;
      case 'pump': return <><circle cx="22" cy="22" r="13" fill="none" stroke="#94a3b8" strokeWidth="2" /><g className="sx-spin" style={{ transformOrigin: '22px 22px' }}>{[0, 60, 120].map(a => <rect key={a} x="11" y="21" width="22" height="2.4" rx="1" fill="#cbd5e1" transform={`rotate(${a} 22 22)`} />)}</g><path className="sx-wave" d="M40 12 q4 -6 8 0 t8 0" fill="none" stroke="#4ade80" strokeWidth="1.8" /><path className="sx-wave" d="M40 30 q3 -10 6 0 t6 0 t6 0" fill="none" stroke="#4ade80" strokeWidth="1.8" /></>;
      case 'laser': return <><rect x="22" y="3" width="14" height="8" rx="2" fill="#162434" stroke="#f43f5e" /><path className="sx-beam" d="M29 11 V30" stroke="#ff4d63" strokeWidth="2" /><circle cx="29" cy="36" r="7" fill="#d9803f" stroke="#fcd34d" /><path className="sx-wave" d="M44 26 q4 -14 8 0 t8 0" fill="none" stroke="#22d3ee" strokeWidth="1.8" /></>;
      case 'trigger': return <><path className="sx-wave" d="M3 30 q6 -22 12 0 t12 0 t12 0 t12 0 t12 0" fill="none" stroke="#ffe066" strokeWidth="2" /><line x1="3" x2="57" y1="14" y2="14" stroke="#38bdf8" strokeDasharray="3 3" /><path d="M54 9 l5 5 l-5 5z" fill="#38bdf8" /></>;
      case 'stage': return <><rect x="6" y="28" width="30" height="8" rx="2" fill="#475569" /><circle className="sx-slide" cx="16" cy="20" r="7" fill="#d9803f" stroke="#fcd34d" /><path className="sx-burst" d="M38 22 h3 v-8 h2 v16 h2 v-12 h2 v10 h2 v-6 h2 v3 h4" fill="none" stroke="#4ade80" strokeWidth="1.8" /></>;
      default: return <circle cx="30" cy="22" r="10" fill="none" stroke="#38bdf8" />;
    }
  })();
  return <svg viewBox="0 0 60 45" width={size} height={h} className="sx-icon" aria-hidden="true" focusable="false"><rect x="1" y="1" width="58" height="43" rx="6" fill="#06101a" stroke="#1d3249" />{inner}</svg>;
}

const EQUIP_POS: Record<ScopeSource, { x: number; y: number; label: string }> = {
  rf_monitor: { x: 360, y: 14, label: 'VNA RF line' },
  ldv_output: { x: 360, y: 62, label: 'LDV decoder' },
  clock_reference: { x: 360, y: 110, label: 'Rb clock 10 MHz' },
  environmental_probe: { x: 360, y: 158, label: 'Room probe' },
  accelerometer: { x: 360, y: 206, label: 'Table accelerometer' },
  stage_servo: { x: 360, y: 254, label: 'Stage amplifier' },
};
const SRC_ORDER: ScopeSource[] = ['rf_monitor', 'ldv_output', 'clock_reference', 'environmental_probe', 'accelerometer', 'stage_servo'];

/** Which probe goes where right now: each enabled channel has an animated wire to the equipment it watches. */
export function ProbeMap({ channels, power }: { channels: Record<ChannelId, ChannelCfg>; power: boolean }) {
  return (
    <svg viewBox="0 0 520 296" className="sx-probemap" role="img" aria-label="Probe map: which scope channel is wired to which piece of lab equipment">
      <rect x="6" y="40" width="120" height="196" rx="10" fill="#0e1722" stroke="#3a4a5e" strokeWidth="2" />
      <rect x="16" y="52" width="100" height="72" rx="4" fill="#03080d" stroke="#1d3249" />
      <path className={power ? 'sx-wave' : ''} d="M18 88 q8 -24 16 0 t16 0 t16 0 t16 0 t16 0" fill="none" stroke="#ffe066" strokeWidth="1.6" opacity={power ? 1 : 0.2} />
      <text x="66" y="150" textAnchor="middle" fontSize="9" fill="#9fb3c8" fontFamily="ui-monospace,monospace">OSCILLOSCOPE</text>
      {CHANNELS.map((id, i) => {
        const c = channels[id], y = 168 + i * 16;
        return <g key={id}><circle cx="30" cy={y} r="5.5" fill="#0a1118" stroke={CH_COLOR[id]} strokeWidth="2" /><text x="42" y={y + 3} fontSize="8.5" fill={CH_COLOR[id]} fontFamily="ui-monospace,monospace" fontWeight="700">{id.toUpperCase()}</text><circle cx="108" cy={y} r="3" fill={c.enabled && power ? '#22c55e' : '#334155'} /></g>;
      })}
      {SRC_ORDER.map(src => {
        const p = EQUIP_POS[src], users = CHANNELS.filter(id => channels[id].source === src);
        return (
          <g key={src}>
            <rect x={p.x} y={p.y} width="150" height="38" rx="7" fill="#0c1621" stroke={users.length ? '#3d82b0' : '#26364a'} strokeWidth="1.6" />
            <text x={p.x + 10} y={p.y + 16} fontSize="9.5" fontWeight="700" fill="#dbe8f6" fontFamily="ui-monospace,monospace">{SCOPE_SOURCES[src].label}</text>
            <text x={p.x + 10} y={p.y + 29} fontSize="8" fill="#7f93a8" fontFamily="ui-monospace,monospace">{p.label}</text>
            {users.map(id => {
              const i = CHANNELS.indexOf(id), y0 = 168 + i * 16, on = channels[id].enabled && power;
              return <path key={id} className={on ? 'sx-wire on' : 'sx-wire'} d={`M36 ${y0} C 200 ${y0}, 230 ${p.y + 19}, ${p.x} ${p.y + 19}`} fill="none" stroke={CH_COLOR[id]} strokeWidth={on ? 2.2 : 1.2} opacity={on ? 1 : 0.35} strokeDasharray={on ? '7 5' : '2 6'} />;
            })}
          </g>
        );
      })}
    </svg>
  );
}

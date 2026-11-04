import React from 'react';
import './features.css';

export type LedState = 'off' | 'on' | 'busy' | 'warn' | 'fault';
export type StartupItem = { id: string; label: string; led: LedState; text: string; step: number };

const fmtP = (p: number) => (p >= 10 ? `${p.toFixed(0)} Torr` : `${p.toExponential(0)} Torr`);

/** One row per piece of equipment, each with a power LED that lights as the item is switched on or finished. */
export function getStartupItems(s: any): StartupItem[] {
  const c = s.chamber, v = s.vna, l = s.ldv, sc = s.scope, ck = s.clock, st = s.stage, on = !!s.facility.power;
  const dT = Math.abs(c.temperature - c.targetTemp);
  const items: StartupItem[] = [
    { id: 'breaker', label: 'Main breaker', step: 1, led: on ? 'on' : 'off', text: on ? 'ON' : 'OPEN' },
    { id: 'clock', label: 'Rubidium clock', step: 2, led: !on || !ck.power ? 'off' : ck.cableFault || s.failures.clockDrift ? 'fault' : ck.locked ? 'on' : 'busy', text: !ck.power ? 'OFF' : ck.locked ? 'LOCKED' : `WARMING ${Math.min(99, Math.round(((ck.warmup || 0) / 15) * 100))}%` },
    { id: 'door', label: 'Chamber door sealed', step: 3, led: !on ? 'off' : c.doorOpen ? 'warn' : 'on', text: c.doorOpen ? 'OPEN' : 'SEALED' },
    { id: 'rough', label: 'Roughing pump', step: 4, led: !on ? 'off' : (c.roughingRpm || 0) > 1 ? (c.pressure < 50 ? 'on' : 'busy') : c.roughing ? 'busy' : 'off', text: (c.roughingRpm || 0) > 1 ? `${Math.round(c.roughingRpm)}%` : 'OFF' },
    { id: 'turbo', label: 'Turbo pump', step: 5, led: !on ? 'off' : s.chamber.turbo && c.pressure > 50 ? 'fault' : (c.turboRpm || 0) > 90 ? 'on' : c.turbo ? 'busy' : 'off', text: (c.turboRpm || 0) > 1 ? `${Math.round(c.turboRpm)}%` : 'OFF' },
    { id: 'vacuum', label: 'Deep vacuum (< 0.001 Torr)', step: 5, led: !on ? 'off' : c.pressure < 1e-3 ? 'on' : c.roughing || c.turbo ? 'busy' : 'off', text: fmtP(c.pressure) },
    { id: 'thermo', label: 'Temperature settled', step: 6, led: !on ? 'off' : dT < 0.03 ? 'on' : c.thermostat ? 'busy' : 'warn', text: dT < 0.03 ? 'STEADY' : c.thermostat ? `${(c.temperature - c.targetTemp).toFixed(2)} °C OFF` : 'THERMOSTAT OFF' },
    { id: 'shield', label: 'Faraday cage + isolation', step: 6, led: !on ? 'off' : c.faraday && c.isolation ? 'on' : 'warn', text: c.faraday && c.isolation ? 'ON' : 'CHECK' },
    { id: 'vna', label: 'Network analyzer (VNA) power', step: 7, led: on && v.power ? 'on' : 'off', text: v.power ? 'ON' : 'OFF' },
    { id: 'rf', label: 'VNA RF output + calibration', step: 7, led: !on || !v.power ? 'off' : v.rf && v.calibrated ? 'on' : v.rf ? 'warn' : 'off', text: v.rf ? (v.calibrated ? 'RF ON · CAL OK' : 'RF ON · NOT CAL') : 'RF OFF' },
    { id: 'scope', label: 'Oscilloscope', step: 8, led: !on || !sc.power ? 'off' : sc.booting ? 'busy' : 'on', text: !sc.power ? 'OFF' : sc.booting ? `SELF-TEST ${Math.round((sc.bootProgress || 0) * 100)}%` : sc.running ? 'RUNNING' : 'STOPPED' },
    { id: 'ldv', label: 'Laser vibrometer (LDV)', step: 9, led: !on || !l.power ? 'off' : l.shutter ? 'on' : 'warn', text: !l.power ? 'OFF' : l.shutter ? 'SHUTTER OPEN' : 'SHUTTER CLOSED' },
    { id: 'stage', label: 'XYZ stage homed', step: 10, led: !on ? 'off' : st.moving ? 'busy' : st.homed ? 'on' : 'warn', text: st.moving ? 'MOVING' : st.homed ? 'HOMED' : 'NOT HOMED' },
  ];
  return items;
}

export function StartupChecklist({ state, current, onPick }: { state: any; current: number; onPick: (step: number) => void }) {
  const items = getStartupItems(state), lit = items.filter(i => i.led === 'on').length;
  return (
    <div className="sc-checklist" aria-label="Equipment power checklist">
      <div className="sc-meter"><span>{lit}/{items.length} ready</span><i style={{ ['--p' as any]: `${(lit / items.length) * 100}%` }} /></div>
      <ul className="sc-list">
        {items.map(i => (
          <li key={i.id}>
            <button type="button" className={`sc-item${i.step === current ? ' is-current' : ''}${i.led === 'on' ? ' is-on' : ''}`} onClick={() => onPick(i.step)} aria-label={`${i.label}: ${i.text}. Go to step ${i.step}.`}>
              <span className={`sc-led is-${i.led}`} aria-hidden="true" />
              <span className="sc-name">{i.label}</span>
              <span className="sc-state">{i.text}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="cv-help">Each lamp lights when its equipment is switched on or its job is finished. <b>Blinking blue</b> = working on it, <b>amber</b> = needs a look, <b>red</b> = fault.</p>
    </div>
  );
}

/** Little picture of the oscilloscope for the wizard step: the power button lights, then the screen runs a self-test and draws a wave. */
export function ScopePowerArt({ power, booting, progress }: { power: boolean; booting: boolean; progress: number }) {
  return (
    <svg viewBox="0 0 280 150" className="sc-scope-art" role="img" aria-label={power ? (booting ? 'Oscilloscope running its self-test' : 'Oscilloscope showing a live waveform') : 'Oscilloscope switched off'}>
      <rect x="4" y="4" width="272" height="142" rx="12" fill="#1a2230" stroke="#3a4a5e" strokeWidth="3" />
      <rect x="16" y="16" width="190" height="104" rx="6" fill="#03080d" stroke="#0c1118" strokeWidth="3" />
      {power && !booting && <>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => <line key={i} x1={16 + i * 23.75} x2={16 + i * 23.75} y1="16" y2="120" stroke="#142535" />)}{[0, 1, 2, 3, 4].map(i => <line key={i} y1={16 + i * 26} y2={16 + i * 26} x1="16" x2="206" stroke="#142535" />)}
        <path d="M16 68 q12 -40 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0" fill="none" stroke="#ffe066" strokeWidth="2.2" style={{ strokeDasharray: 300, animation: 'sx-wave 2.4s linear infinite' }} />
        <path d="M16 84 q7 -10 14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0 t14 0" fill="none" stroke="#22d3ee" strokeWidth="1.6" opacity=".8" />
      </>}
      {power && booting && <g fontFamily="ui-monospace,monospace" textAnchor="middle"><text x="111" y="56" fontSize="15" fontWeight="800" fill="#e8f1fb" letterSpacing="3">TEKTRONIX</text><text x="111" y="74" fontSize="8" fill="#f59e0b">SELF-TEST…</text><rect x="51" y="86" width="120" height="6" rx="3" fill="#101a26" /><rect x="51" y="86" width={120 * progress} height="6" rx="3" fill="#22c55e" /></g>}
      {!power && <text x="111" y="72" textAnchor="middle" fontSize="16" fill="#3f4a58" fontFamily="ui-monospace,monospace" letterSpacing="4">OFF</text>}
      <g transform="translate(222 22)">{[0, 1, 2, 3].map(i => <g key={i} transform={`translate(${(i % 2) * 26} ${Math.floor(i / 2) * 28})`}><circle cx="12" cy="12" r="10" fill="#0e131b" stroke="#52627a" strokeWidth="2" /><line x1="12" y1="12" x2="12" y2="5" stroke="#7dd3fc" strokeWidth="2" strokeLinecap="round" transform={`rotate(${-40 + i * 30} 12 12)`} /></g>)}</g>
      <g transform="translate(224 86)">{['#ffe066', '#22d3ee', '#f472b6', '#4ade80'].map((c, i) => <circle key={c} cx={6 + i * 13} cy="8" r="5" fill="#0a1118" stroke={c} strokeWidth="2" />)}</g>
      <g transform="translate(236 118)"><circle cx="14" cy="10" r="11" fill={power ? '#3a2508' : '#1c222b'} stroke={power ? '#f59e0b' : '#52627a'} strokeWidth="2" style={power ? { filter: 'drop-shadow(0 0 6px #f59e0b)' } : undefined} /><path d="M14 4 V10 M9.5 7 a6 6 0 1 0 9 0" stroke={power ? '#fde68a' : '#8393a7'} strokeWidth="2" fill="none" strokeLinecap="round" /></g>
      <text x="16" y="138" fontSize="8" fill="#8393a7" fontFamily="ui-monospace,monospace">Tektronix 5 Series MSO · power button, bottom right</text>
    </svg>
  );
}

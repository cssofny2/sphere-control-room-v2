import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import './engineering.css';
import { PARTS, PART_BY_ID, fmtP, partsWithProblems, pushSample, signalLinks, type Health, type Sample, type SignalLink } from './parts';
import { select, useSelected } from './selection';
import { getHelp } from '../overview/overviewHelp';

const LIMIT_MM = 35; // stage travel in the simulator (the one real dimension in these drawings)

// Okabe-Ito colour-blind-safe palette. Status is never colour alone: each state also has its own shape.
const OK = '#009E73', WARN = '#E69F00', FAIL = '#D55E00', BLUE = '#0072B2', SKY = '#56B4E9', PINK = '#CC79A7';
const THEMES = {
  light: { '--e-bg': '#f4f6f8', '--e-panel': '#ffffff', '--e-canvas': '#fbfcfd', '--e-ink': '#1b2733', '--e-mute': '#5b6b7a', '--e-line': '#c9d2db', '--e-hover': '#eef2f6', '--e-sel': '#e3f0fa', '--e-fill': '#e9eef3', '--e-metal': '#cfd8e0', '--e-grid': '#e6ebf0' },
  dark: { '--e-bg': '#10161d', '--e-panel': '#18212b', '--e-canvas': '#0e141a', '--e-ink': '#e6edf3', '--e-mute': '#93a4b5', '--e-line': '#33424f', '--e-hover': '#212d39', '--e-sel': '#17354d', '--e-fill': '#1d2a36', '--e-metal': '#3a4b5a', '--e-grid': '#18222c' },
};
const themeVars = (t: 'light' | 'dark') => ({ ...THEMES[t], '--e-ok': OK, '--e-warn': WARN, '--e-fail': FAIL, '--e-off': t === 'dark' ? '#8796a5' : '#7a8794', '--e-blue': t === 'dark' ? SKY : BLUE } as unknown as React.CSSProperties);

const SVG_CSS = `
.e-t{font:600 11px ui-monospace,Menlo,monospace;fill:var(--e-ink)} .e-s{font:11px system-ui,sans-serif;fill:var(--e-mute)} .e-d{font:11px ui-monospace,monospace;fill:var(--e-blue)}
.e-body{fill:var(--e-fill);stroke:var(--e-ink);stroke-width:1.5} .e-metal{fill:var(--e-metal);stroke:var(--e-ink);stroke-width:1.5}
.e-pipe{fill:none;stroke:var(--e-ink);stroke-width:3} .e-sig{fill:none;stroke:var(--e-mute);stroke-width:1.5;stroke-dasharray:5 4}
.e-flow{fill:none;stroke:var(--e-blue);stroke-width:3.2;stroke-dasharray:9 9;animation:e-dash 1s linear infinite}
.e-flow.rev{animation-direction:reverse} .e-flow.slow{animation-duration:2.2s}
.e-link-ok{stroke:var(--e-ok)} .e-link-degraded{stroke:var(--e-warn);stroke-dasharray:3 7} .e-link-broken{stroke:var(--e-fail);stroke-dasharray:2 8;animation:none}
.e-hit{fill:transparent;stroke:none;cursor:pointer} .e-part:hover .e-ring{stroke:var(--e-blue);opacity:.7} .e-part:focus{outline:none}
.e-part:focus-visible .e-ring{stroke:var(--e-blue);opacity:1;stroke-width:2.5}
.e-ring{fill:none;stroke:transparent;stroke-width:2;stroke-dasharray:6 3} .e-sel .e-ring{stroke:var(--e-blue);opacity:1;stroke-width:2.5}
.e-pulse{fill:none;stroke:var(--e-fail);stroke-width:3;animation:e-pulse 1.3s ease-out infinite;transform-box:fill-box;transform-origin:center}
.e-dim{stroke:var(--e-blue);stroke-width:1.2;fill:none} .e-cage{fill:none;stroke:var(--e-mute);stroke-dasharray:10 5;stroke-width:1.5}
.e-off .e-body,.e-off .e-metal{opacity:.55}
@keyframes e-dash{to{stroke-dashoffset:-18}} @keyframes e-pulse{0%{opacity:.95;transform:scale(1)}100%{opacity:0;transform:scale(1.18)}}
.e-still .e-flow,.e-still .e-pulse{animation:none} .e-still .e-pulse{opacity:.9}
@media (prefers-reduced-motion:reduce){.e-flow,.e-pulse{animation:none}.e-pulse{opacity:.9}}`;

type Tab = 'pid' | 'cutaway' | 'signals';
const TABS: [Tab, string][] = [['pid', 'P&ID'], ['cutaway', 'Dimensioned cutaway'], ['signals', 'Signal path']];
const BASE_VB: Record<Tab, [number, number, number, number]> = { pid: [20, 4, 900, 636], cutaway: [0, 0, 1000, 560], signals: [0, 0, 1000, 560] };

const Badge = ({ s, size = 18 }: { s: Health; size?: number }) => {
  const c = `var(--e-${s})`;
  return <svg width={size} height={size} viewBox="-10 -10 20 20" className="eng-badge" role="img" aria-label={s === 'ok' ? 'OK' : s === 'warn' ? 'Warning' : s === 'fail' ? 'Failed' : 'Off'}>
    {s === 'ok' && <><circle r="8.5" fill={c} /><path d="M-4 0 L-1 3.5 L5 -3.5" stroke="#fff" strokeWidth="2.2" fill="none" /></>}
    {s === 'warn' && <><path d="M0 -9 L9 7 L-9 7 Z" fill={c} /><path d="M0 -3 V2" stroke="#000" strokeWidth="2" /><circle cy="5" r="1" fill="#000" /></>}
    {s === 'fail' && <><path d="M0 -9.5 L9.5 0 L0 9.5 L-9.5 0 Z" fill={c} /><path d="M-3.5 -3.5 L3.5 3.5 M3.5 -3.5 L-3.5 3.5" stroke="#fff" strokeWidth="2.2" /></>}
    {s === 'off' && <><circle r="7.5" fill="none" stroke={c} strokeWidth="2" /><path d="M-4 0 H4" stroke={c} strokeWidth="2" /></>}
  </svg>;
};

type Ctx = { state: any; sel: string | null; hover: string | null; setHover: (s: string | null) => void; pick: (id: string) => void; moved: React.MutableRefObject<boolean>; problems: ReturnType<typeof partsWithProblems> };
// One clickable part: shape drawn by children, status badge (shape + colour), tag, pulse ring and ALM pill when failed.
function PartG({ c, id, box, children, tagDy = 14, tagAnchor = 'middle' }: { c: Ctx; id: string; box: [number, number, number, number]; children?: React.ReactNode; tagDy?: number; tagAnchor?: 'middle' | 'start' }) {
  const p = PART_BY_ID[id]; const h = p.health(c.state); const [x, y, w, hh] = box;
  const prob = c.problems.find(q => q.partId === id && q.kind === 'alarm');
  const act = () => { if (!c.moved.current) c.pick(id); };
  return <g className={`e-part ${c.sel === id ? 'e-sel' : ''} ${h.state === 'off' ? 'e-off' : ''}`} tabIndex={0} role="button" aria-label={`${p.tag} ${p.label}: ${h.state === 'ok' ? 'OK' : h.state === 'warn' ? 'warning' : h.state === 'fail' ? 'failed' : 'off'}. ${h.why}`}
    data-part={id} data-health={h.state} onClick={act} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.pick(id); } }}
    onMouseEnter={() => c.setHover(id)} onMouseLeave={() => c.setHover(null)} onFocus={() => c.setHover(id)} onBlur={() => c.setHover(null)}>
    <title>{`${p.tag} ${p.label}: ${h.why}`}</title>
    {children}
    <rect className="e-hit" x={x - 4} y={y - 4} width={w + 8} height={hh + 8} />
    <rect className="e-ring" x={x - 5} y={y - 5} width={w + 10} height={hh + 10} rx="6" />
    {h.state === 'fail' && <rect className="e-pulse" data-pulse={id} x={x - 5} y={y - 5} width={w + 10} height={hh + 10} rx="6" />}
    <text className="e-t" x={tagAnchor === 'middle' ? x + w / 2 : x} y={y + hh + tagDy} textAnchor={tagAnchor}>{p.tag}</text>
    <g transform={`translate(${x + w - 2},${y + 2})`}><circle r="11" fill="var(--e-canvas)" /><Badge s={h.state} size={20} /></g>
    {h.state === 'fail' && <g onClick={e => { e.stopPropagation(); c.pick(id); }} data-alarm-link={id}><rect x={x} y={y - 22} width={prob ? 54 : 48} height="18" rx="9" fill="var(--e-fail)" /><text x={x + (prob ? 27 : 24)} y={y - 9} textAnchor="middle" fill="#fff" style={{ font: '700 12px system-ui' }}>{prob ? 'ALARM' : 'FAULT'}</text></g>}
  </g>;
}
const Pipe = ({ d, flow, rev, slow }: { d: string; flow?: boolean; rev?: boolean; slow?: boolean }) => <g><path d={d} className="e-pipe" />{flow && <path d={d} className={`e-flow ${rev ? 'rev' : ''} ${slow ? 'slow' : ''}`} markerEnd="url(#e-arrow)" />}</g>;
const Valve = ({ x, y, open }: { x: number; y: number; open: boolean }) => <g><path d={`M${x - 10},${y - 8} L${x + 10},${y + 8} L${x + 10},${y - 8} L${x - 10},${y + 8} Z`} className="e-body" style={{ fill: open ? 'var(--e-ok)' : 'var(--e-fill)' }} /></g>;
const Dim = ({ x1, y1, x2, y2, label, lx, ly, anchor = 'middle' }: { x1: number; y1: number; x2: number; y2: number; label: string; lx: number; ly: number; anchor?: 'middle' | 'start' | 'end' }) => <g><line className="e-dim" x1={x1} y1={y1} x2={x2} y2={y2} markerStart="url(#e-dimarrow)" markerEnd="url(#e-dimarrow)" /><text className="e-d" x={lx} y={ly} textAnchor={anchor}>{label}</text></g>;
const Defs = () => <defs>
  <marker id="e-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--e-blue)" /></marker>
  <marker id="e-dimarrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9 Z" fill="var(--e-blue)" /></marker>
</defs>;

function PID({ c }: { c: Ctx }) {
  const s = c.state; const rough = s.facility.power && s.chamber.roughing, turbo = s.facility.power && s.chamber.turbo && s.chamber.turboRpm > 5;
  const beam = s.facility.power && s.ldv.power && s.ldv.shutter; const open = (c.state.chamber.doorOpen);
  return <>
    <text className="e-s" x="24" y="26">P&amp;ID: process and instrument diagram (conceptual). Click any part. Blue dashes move along live flows.</text>
    <PartG c={c} id="faraday" box={[360, 120, 380, 300]} tagAnchor="start" tagDy={-308}><rect className="e-cage" x="360" y="120" width="380" height="300" rx="10" /></PartG><text className="e-s" x="410" y="112">Faraday cage</text>
    {/* vacuum piping chamber -> turbo -> valve -> roughing */}
    <Pipe d="M690,375 H790 V440" flow={turbo || rough} slow={!turbo} />
    <Pipe d="M790,500 V545" flow={turbo || rough} slow={!turbo} />
    <Valve x={790} y={528} open={rough || turbo} /><text className="e-s" x="806" y="532">V-101</text>
    <Pipe d="M790,545 V568" flow={rough} />
    {/* chamber */}
    <PartG c={c} id="chamber" box={[380, 150, 300, 250]} tagDy={-218}><rect className="e-body" x="380" y="150" width="300" height="250" rx="10" /><text className="e-d" x="392" y="388">{fmtP(s.chamber.pressure)}</text></PartG>
    <PartG c={c} id="door" box={[680, 205, 20, 140]} tagDy={14}><rect className="e-metal" x={open ? 700 : 680} y="205" width="20" height="140" /></PartG>
    <PartG c={c} id="stage" box={[440, 345, 180, 24]} tagDy={-6}><rect className="e-metal" x="440" y="345" width="180" height="24" /><path d="M450,345 v-8 h160 v8" className="e-body" /></PartG>
    <PartG c={c} id="sphere" box={[512, 292, 36, 36]} tagDy={-40}><circle className="e-metal" cx="530" cy="310" r="18" /></PartG>
    <PartG c={c} id="thermo" box={[396, 180, 32, 32]} tagDy={16}><circle className="e-body" cx="412" cy="196" r="14" /><text className="e-t" x="412" y="200" textAnchor="middle">TT</text></PartG>
    <PartG c={c} id="gauge" box={[632, 180, 32, 32]} tagDy={16}><circle className="e-body" cx="648" cy="196" r="14" /><text className="e-t" x="648" y="200" textAnchor="middle">PT</text></PartG>
    <line className="e-sig" x1="412" y1="182" x2="412" y2="150" /><line className="e-sig" x1="648" y1="182" x2="648" y2="150" /><text className="e-s" x="456" y="144">to PC-101</text>
    {/* isolation springs */}
    <PartG c={c} id="isolation" box={[370, 424, 320, 30]} tagDy={14}><rect className="e-metal" x="370" y="440" width="320" height="10" />{[410, 530, 650].map(x => <path key={x} className="e-pipe" style={{ strokeWidth: 2 }} d={`M${x},424 l6,3 -12,5 12,5 -12,5 6,3`} />)}</PartG>
    {/* laser */}
    <PartG c={c} id="ldv" box={[150, 168, 140, 64]} tagDy={14}><rect className="e-body" x="150" y="168" width="140" height="64" rx="6" /><text className="e-s" x="162" y="205">Laser vibrometer</text></PartG>
    <path d="M290,200 L512,305" stroke={PINK} strokeWidth="2.5" fill="none" strokeDasharray={beam ? '0' : '3 6'} opacity={beam ? 1 : 0.5} />
    {beam && <path d="M290,200 L512,305" className="e-flow slow" style={{ stroke: PINK }} />}
    {/* rack and PC */}
    <PartG c={c} id="breaker" box={[40, 40, 130, 44]}><rect className="e-body" x="40" y="40" width="130" height="44" rx="5" /><text className="e-s" x="52" y="67">Main breaker</text></PartG>
    <PartG c={c} id="clock" box={[40, 300, 130, 50]}><rect className="e-body" x="40" y="300" width="130" height="50" rx="5" /><text className="e-s" x="52" y="330">Rubidium clock</text></PartG>
    <PartG c={c} id="vna" box={[40, 380, 130, 50]}><rect className="e-body" x="40" y="380" width="130" height="50" rx="5" /><text className="e-s" x="52" y="410">Network analyzer</text></PartG>
    <PartG c={c} id="scope" box={[40, 460, 130, 50]}><rect className="e-body" x="40" y="460" width="130" height="50" rx="5" /><text className="e-s" x="52" y="490">Oscilloscope</text></PartG>
    <PartG c={c} id="pc" box={[260, 540, 160, 50]}><rect className="e-body" x="260" y="540" width="160" height="50" rx="5" /><text className="e-s" x="272" y="570">Workstation</text></PartG>
    {/* pumps */}
    <PartG c={c} id="turbo" box={[758, 440, 64, 60]} tagAnchor="middle" tagDy={14}><circle className="e-body" cx="790" cy="470" r="28" /><path d="M790,442 L790,498 M762,470 L818,470" stroke="var(--e-ink)" strokeWidth="1.2" /></PartG>
    <PartG c={c} id="roughing" box={[764, 568, 52, 52]} tagDy={14}><circle className="e-body" cx="790" cy="594" r="26" /><path d="M776,606 L790,580 L804,606 Z" fill="var(--e-ink)" opacity=".7" /></PartG>
    <text className="e-s" x="826" y="474">Turbo</text><text className="e-s" x="826" y="598">Roughing</text>
    {/* legend */}
    <g transform="translate(40,626)"><text className="e-s" y="0">Status shapes:</text>{(['ok', 'warn', 'fail', 'off'] as Health[]).map((h, i) => <g key={h} transform={`translate(${96 + i * 78},-5)`}><Badge s={h} /><text className="e-s" x="24" y="14">{h === 'ok' ? 'OK' : h === 'warn' ? 'Warning' : h === 'fail' ? 'Failed' : 'Off'}</text></g>)}</g>
  </>;
}

function Cutaway({ c }: { c: Ctx }) {
  const s = c.state; const sx = 500 + (s.stage.x || 0), sz = 300 - (s.stage.z || 0);
  const beam = s.facility.power && s.ldv.power && s.ldv.shutter; const leak = s.failures.vacuumLeak;
  return <>
    <text className="e-s" x="24" y="26">Side cutaway, scale 1 px = 1 mm. Wall sizes are conceptual; only the ±{LIMIT_MM} mm stage travel comes from the simulator.</text>
    <PartG c={c} id="faraday" box={[150, 62, 700, 440]} tagAnchor="start" tagDy={-432}><rect className="e-cage" x="150" y="62" width="700" height="440" rx="10" /></PartG>
    <PartG c={c} id="chamber" box={[180, 80, 640, 400]} tagDy={-326}><rect className="e-metal" x="180" y="80" width="640" height="400" rx="8" /><rect style={{ fill: 'var(--e-canvas)', stroke: 'var(--e-ink)' }} x="198" y="98" width="604" height="364" rx="4" /><text className="e-d" x="210" y="122">{fmtP(s.chamber.pressure)} · {s.chamber.temperature.toFixed(2)} °C</text></PartG>
    <PartG c={c} id="door" box={[820, 150, 22, 220]} tagDy={14}><rect className="e-metal" x="820" y="150" width="22" height="220" />{leak && <circle cx="820" cy="260" r="7" fill="none" stroke="var(--e-fail)" strokeWidth="3" />}</PartG>
    <PartG c={c} id="stage" box={[440, 372, 120, 90]} tagDy={14}><rect className="e-metal" x="440" y="440" width="120" height="22" /><rect className="e-body" x="486" y="372" width="28" height="68" /><rect className="e-metal" x={sx - 40} y="360" width="80" height="12" /></PartG>
    <rect x={500 - LIMIT_MM} y={300 - LIMIT_MM} width={LIMIT_MM * 2} height={LIMIT_MM * 2} fill="none" stroke="var(--e-blue)" strokeDasharray="3 3" />
    <PartG c={c} id="sphere" box={[sx - 18, sz - 18, 36, 36]} tagDy={-40}><circle className="e-metal" cx={sx} cy={sz} r="18" /></PartG>
    <PartG c={c} id="thermo" box={[232, 140, 28, 28]} tagDy={-22}><circle className="e-body" cx="246" cy="154" r="13" /><text className="e-t" x="246" y="158" textAnchor="middle">TT</text></PartG>
    <PartG c={c} id="gauge" box={[740, 140, 28, 28]} tagDy={-22}><circle className="e-body" cx="754" cy="154" r="13" /><text className="e-t" x="754" y="158" textAnchor="middle">PT</text></PartG>
    <PartG c={c} id="ldv" box={[20, 240, 110, 70]} tagDy={14}><rect className="e-body" x="20" y="240" width="110" height="70" rx="6" /><text className="e-s" x="30" y="280">LDV head</text></PartG>
    <circle cx="180" cy="275" r="14" fill="var(--e-sel)" stroke="var(--e-ink)" strokeWidth="1.5" /><text className="e-s" x="152" y="305">window</text>
    <path d={`M130,275 L${sx - 18},${sz}`} stroke={PINK} strokeWidth="2.5" fill="none" opacity={beam ? 1 : 0.35} strokeDasharray={beam ? '0' : '3 6'} />
    <PartG c={c} id="isolation" box={[200, 490, 600, 34]} tagDy={14}><rect className="e-metal" x="200" y="490" width="600" height="12" />{[240, 400, 600, 760].map(x => <path key={x} className="e-pipe" style={{ strokeWidth: 2 }} d={`M${x},502 l7,4 -14,6 14,6 -14,6 7,4`} />)}</PartG>
    {/* dimensions */}
    <Dim x1={180} y1={50} x2={820} y2={50} label="≈ 640 mm (conceptual)" lx={500} ly={44} />
    <Dim x1={870} y1={80} x2={870} y2={480} label="≈ 400 mm" lx={880} ly={284} anchor="start" />
    <Dim x1={500 - LIMIT_MM} y1={250} x2={500 + LIMIT_MM} y2={250} label={`±${LIMIT_MM} mm travel (X)`} lx={500} ly={240} />
    <Dim x1={440} y1={300 - LIMIT_MM} x2={440} y2={300 + LIMIT_MM} label={`±${LIMIT_MM} mm (Z)`} lx={432} ly={304} anchor="end" />
    <text className="e-d" x="560" y="330">live: X {s.stage.x.toFixed(2)}, Y {s.stage.y.toFixed(2)}, Z {s.stage.z.toFixed(2)} mm</text>
  </>;
}

const NODES: Record<string, [number, number, number, number, string]> = {
  clock: [40, 230, 150, 90, 'Rubidium clock'], vna: [330, 60, 170, 80, 'Network analyzer'], scope: [330, 240, 170, 80, 'Oscilloscope'], ldv: [330, 420, 170, 80, 'Laser vibrometer'],
  sphere: [620, 240, 150, 80, 'Test sphere'], pc: [830, 240, 150, 80, 'Workstation'], stage: [830, 420, 150, 80, 'XYZ stage'],
};
const PATHS: Record<string, { d: string; mid: [number, number] }> = {
  'ref-vna': { d: 'M190,260 C260,260 260,100 330,100', mid: [262, 170] }, 'ref-scope': { d: 'M190,280 H330', mid: [260, 272] }, 'ref-ldv': { d: 'M190,300 C260,300 260,460 330,460', mid: [262, 390] },
  'rf-drive': { d: 'M500,100 C560,100 560,260 620,260', mid: [560, 180] }, laser: { d: 'M500,460 C560,460 560,300 620,300', mid: [560, 380] }, velocity: { d: 'M375,420 V320', mid: [375, 370] },
  'data-vna': { d: 'M500,75 H905 V240', mid: [700, 75] }, 'data-ldv': { d: 'M500,495 H800 V300 H830', mid: [650, 495] }, motion: { d: 'M875,320 V420', mid: [875, 370] },
};
function Signals({ c, links, selLink, setSelLink }: { c: Ctx; links: SignalLink[]; selLink: string | null; setSelLink: (id: string | null) => void }) {
  return <>
    <text className="e-s" x="24" y="26">Signal path. Green = good, orange dotted = degraded, red dotted with ✕ = broken. Click a line for the reason.</text>
    {links.map(l => { const P = PATHS[l.id]; if (!P) return null; return <g key={l.id} data-link={l.id} data-link-state={l.state} role="button" tabIndex={0} aria-label={`${l.label}, ${l.state}. ${l.reason}`} onClick={() => { if (!c.moved.current) setSelLink(l.id); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelLink(l.id); } }}>
      <title>{`${l.label}: ${l.state}. ${l.reason}`}</title>
      <path d={P.d} fill="none" stroke="transparent" strokeWidth="16" style={{ cursor: 'pointer' }} />
      <path d={P.d} className={`e-flow slow e-link-${l.state}`} style={selLink === l.id ? { strokeWidth: 5 } : undefined} />
      <text className="e-s" x={P.mid[0]} y={P.mid[1] - 8} textAnchor="middle" style={{ paintOrder: 'stroke', stroke: 'var(--e-canvas)', strokeWidth: 4 }}>{l.label}</text>
      {l.state !== 'ok' && <g transform={`translate(${P.mid[0]},${P.mid[1] + 8})`}><circle r="11" fill="var(--e-canvas)" /><Badge s={l.state === 'broken' ? 'fail' : 'warn'} size={20} /></g>}
    </g>; })}
    {Object.keys(NODES).map(id => { const [x, y, w, h, nm] = NODES[id]; return <PartG key={id} c={c} id={id} box={[x, y, w, h]} tagDy={16}><rect className="e-body" x={x} y={y} width={w} height={h} rx="8" /><text className="e-s" x={x + 12} y={y + h / 2 + 4}>{nm}</text></PartG>; })}
  </>;
}

function Spark({ data, pick, log, lo, hi, goodMin, goodMax, label, value, thresholdText }: { data: Sample[]; pick: (s: Sample) => number; log?: boolean; lo: number; hi: number; goodMin: number; goodMax: number; label: string; value: string; thresholdText: string }) {
  const W = 260, H = 54; const f = (v: number) => { const a = log ? Math.log10(Math.max(v, 1e-9)) : v, l = log ? Math.log10(lo) : lo, h = log ? Math.log10(hi) : hi; return H - Math.max(0, Math.min(1, (a - l) / (h - l))) * H; };
  const y1 = f(goodMax), y2 = f(goodMin); const pts = data.map((d, i) => `${(i / Math.max(1, 89)) * W},${f(pick(d)).toFixed(1)}`).join(' ');
  return <div className="eng-spark"><div className="lb"><span>{label}</span><b style={{ color: 'var(--e-ink)' }}>{value}</b></div>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`${label} history. ${thresholdText}. Now ${value}`} style={{ background: 'var(--e-canvas)', border: '1px solid var(--e-line)', borderRadius: 4 }}>
      <rect x="0" y={Math.min(y1, y2)} width={W} height={Math.abs(y2 - y1)} fill={OK} opacity=".18" /><line x1="0" x2={W} y1={y1} y2={y1} stroke={OK} strokeDasharray="4 3" strokeWidth="1" />
      {pts && <polyline points={pts} fill="none" stroke="var(--e-blue)" strokeWidth="1.8" />}</svg>
    <div className="eng-note">{thresholdText}</div></div>;
}

type Props = { state: any; dispatch: (a: any) => void; onHelp: (key: string) => void; onShowInLab: (view: string) => void; reduced?: boolean };
export default function Schematic({ state, dispatch, onHelp, onShowInLab, reduced }: Props) {
  const sel = useSelected();
  const [tab, setTab] = useState<Tab>('pid');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => { try { const v = localStorage.getItem('sphere.eng.theme'); if (v === 'dark' || v === 'light') return v; } catch { /* ignore */ } return 'light'; });
  const [only, setOnly] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [selLink, setSelLink] = useState<string | null>(null);
  const [vb, setVb] = useState<[number, number, number, number]>(BASE_VB.pid);
  const [hist, setHist] = useState<Sample[]>([]);
  const stateRef = useRef(state); stateRef.current = state;
  const svgRef = useRef<SVGSVGElement>(null), wrapRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false), drag = useRef<{ x: number; y: number; vb: number[]; id: number } | null>(null);
  const still = !!reduced || (typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => { try { localStorage.setItem('sphere.eng.theme', theme); } catch { /* ignore */ } }, [theme]);
  useEffect(() => { const t0 = performance.now(); const tick = () => setHist(h => pushSample(h, stateRef.current, (performance.now() - t0) / 1000)); tick(); const i = window.setInterval(tick, 1000); return () => window.clearInterval(i); }, []);
  useLayoutEffect(() => { setVb(BASE_VB[tab]); setSelLink(null); }, [tab]);

  const problems = useMemo(() => partsWithProblems(state), [state]);
  const links = useMemo(() => signalLinks(state), [state]);
  const pick = useCallback((id: string) => { select(id); setSelLink(null); }, []);
  const ctx: Ctx = { state, sel, hover, setHover, pick, moved, problems };

  // pan / zoom
  const zoomAt = useCallback((f: number, cx = 0.5, cy = 0.5) => setVb(v => { const [x, y, w, h] = v; const [bx, by, bw, bh] = BASE_VB[tab]; const nw = Math.min(bw * 1.2, Math.max(bw / 6, w * f)), nh = nw * (bh / bw); return [x + (w - nw) * cx, y + (h - nh) * cy, nw, nh]; }), [tab]);
  useEffect(() => { const el = wrapRef.current; if (!el) return; const on = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAt(e.deltaY > 0 ? 1.12 : 1 / 1.12, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); }; el.addEventListener('wheel', on, { passive: false }); return () => el.removeEventListener('wheel', on); }, [zoomAt]);
  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, vb: [...vb], id: e.pointerId }; moved.current = false; };
  const onMove = (e: React.PointerEvent) => { const d = drag.current; if (!d || !wrapRef.current) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (!moved.current && Math.hypot(dx, dy) < 5) return; if (!moved.current) { moved.current = true; try { wrapRef.current.setPointerCapture(d.id); } catch { /* ignore */ } } const r = wrapRef.current.getBoundingClientRect(); const k = Math.max(d.vb[2] / r.width, d.vb[3] / r.height); setVb([d.vb[0] - dx * k, d.vb[1] - dy * k, d.vb[2], d.vb[3]]); };
  const onUp = () => { drag.current = null; window.setTimeout(() => { moved.current = false; }, 0); };
  const onKey = (e: React.KeyboardEvent) => { if ((e.target as Element).closest?.('[data-part],[data-link]')) { if (!['+', '-', '=', '0'].includes(e.key)) return; } const step = vb[2] * 0.08; if (e.key === '+' || e.key === '=') zoomAt(1 / 1.2); else if (e.key === '-') zoomAt(1.2); else if (e.key === '0') setVb(BASE_VB[tab]); else if (e.key === 'ArrowLeft') setVb(([x, y, w, h]) => [x - step, y, w, h]); else if (e.key === 'ArrowRight') setVb(([x, y, w, h]) => [x + step, y, w, h]); else if (e.key === 'ArrowUp') setVb(([x, y, w, h]) => [x, y - step, w, h]); else if (e.key === 'ArrowDown') setVb(([x, y, w, h]) => [x, y + step, w, h]); else return; e.preventDefault(); };

  // export
  const serialize = () => { const el = svgRef.current!; const c = el.cloneNode(true) as SVGSVGElement; const [x, y, w, h] = BASE_VB[tab]; c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); c.setAttribute('viewBox', `${x} ${y} ${w} ${h}`); c.setAttribute('width', String(w)); c.setAttribute('height', String(h)); c.classList.add('e-still'); const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); bg.setAttribute('width', String(w)); bg.setAttribute('height', String(h)); bg.setAttribute('fill', 'var(--e-canvas)'); c.insertBefore(bg, c.firstChild?.nextSibling || null); return new XMLSerializer().serializeToString(c); };
  const exportSvg = () => { const blob = new Blob([serialize()], { type: 'image/svg+xml' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sphere-${tab}.svg`; a.click(); window.setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  const exportPdf = () => { const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'; document.body.appendChild(f); const d = f.contentDocument!; d.open(); d.write(`<!doctype html><title>SPHERE ${tab}</title><style>@page{size:landscape;margin:10mm}body{margin:0}svg{width:100%;height:auto}</style>${serialize()}`); d.close(); window.setTimeout(() => { try { f.contentWindow!.focus(); f.contentWindow!.print(); } catch { /* ignore */ } window.setTimeout(() => f.remove(), 2000); }, 200); };

  const part = sel ? PART_BY_ID[sel] : null; const ph = part?.health(state);
  const hovered = hover ? PART_BY_ID[hover] : null; const hh = hovered ? getHelp(hovered.help) : null;
  const myProblems = part ? problems.filter(p => p.partId === part.id) : [];
  const myLinks = part ? links.filter(l => l.from === part.id || l.to === part.id) : [];
  const link = selLink ? links.find(l => l.id === selLink) : null;
  const list = PARTS.filter(p => !only || p.health(state).state === 'fail' || p.health(state).state === 'warn');
  const flowing = (id: string) => ((id === 'chamber' || id === 'gauge') ? 'pressure' : id === 'thermo' ? 'temp' : id === 'ldv' ? 'optical' : null);
  const kind = part ? flowing(part.id) : null;
  const show = (k: string) => !part || kind === k || (part.id === 'chamber' && k === 'temp');

  return <div className="eng-wrap"><div className={`eng-root`} data-theme={theme} data-eng-schematic style={themeVars(theme)}>
    <div className="eng-col left">
      <div className="eng-card"><h3 className="eng-h"><span>Parts</span><button className="eng-btn" aria-pressed={only} onClick={() => setOnly(o => !o)}>Problems only</button></h3>
        <div className="eng-list" role="list" aria-label="Parts list">{list.map(p => { const h = p.health(state); return <button key={p.id} role="listitem" className="eng-row" data-row={p.id} aria-current={sel === p.id} onClick={() => pick(p.id)} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}><Badge s={h.state} /><span className="tag">{p.tag}</span><span className="nm">{p.label}</span></button>; })}{!list.length && <div className="eng-note">No problems. Everything that is on looks healthy.</div>}</div></div>
    </div>
    <div className="eng-col mid">
      <div className="eng-toolbar" role="toolbar" aria-label="Schematic controls">
        <div role="tablist" aria-label="Diagram" style={{ display: 'flex', gap: 4 }}>{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className="eng-btn" data-tab={k} onClick={() => setTab(k)}>{l}</button>)}</div>
        <span className="sp" />
        <button className="eng-btn" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} aria-label="Switch light or dark theme">{theme === 'light' ? 'Dark' : 'Light'} theme</button>
        <button className="eng-btn" data-export="svg" onClick={exportSvg}>Download SVG</button>
        <button className="eng-btn" data-export="pdf" onClick={exportPdf}>Print / PDF</button>
      </div>
      {problems.length > 0 && <div className="eng-alarms" role="status" aria-label="Problems" data-problems>{problems.map((p, i) => <button key={i} className="eng-chip" onClick={() => pick(p.partId)} onMouseEnter={() => setHover(p.partId)} onMouseLeave={() => setHover(null)}><Badge s="fail" size={14} /><b>{PART_BY_ID[p.partId].tag}</b> {p.reason}</button>)}</div>}
      <div ref={wrapRef} className={`eng-svgwrap ${drag.current && moved.current ? 'dragging' : ''}`} tabIndex={0} role="group" aria-label="Diagram. Drag to pan, scroll or plus and minus to zoom, zero to reset." onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey} onClick={e => { if (!moved.current && (e.target as Element).tagName === 'svg') { select(null); setSelLink(null); } }}>
        <svg ref={svgRef} data-eng-svg={tab} className={still ? 'e-still' : ''} viewBox={vb.map(n => +n.toFixed(2)).join(' ')} style={themeVars(theme)} role="img" aria-label={TABS.find(t => t[0] === tab)![1]}>
          <title>{`SPHERE ${TABS.find(t => t[0] === tab)![1]}`}</title><style>{SVG_CSS}</style><Defs />
          {tab === 'pid' && <PID c={ctx} />}{tab === 'cutaway' && <Cutaway c={ctx} />}{tab === 'signals' && <Signals c={ctx} links={links} selLink={selLink} setSelLink={setSelLink} />}
        </svg>
        <div className="eng-zoom"><button className="eng-btn" aria-label="Zoom in" onClick={() => zoomAt(1 / 1.25)}>+</button><button className="eng-btn" aria-label="Zoom out" onClick={() => zoomAt(1.25)}>−</button><button className="eng-btn" aria-label="Reset view" onClick={() => setVb(BASE_VB[tab])}>Reset</button></div>
      </div>
      <div className="eng-cap" aria-live="polite">{hovered ? <><b>{hovered.tag} {getHelp(hovered.help).title}.</b> {hh!.desc}</> : 'Hover or focus a part for a plain-English description. Select it to inspect it. Selecting here also selects it in the realistic lab.'}</div>
    </div>
    <div className="eng-col right">
      <div className="eng-card" data-inspector>
        <h3 className="eng-h"><span>Inspector</span>{part && <button className="eng-btn" aria-label={`What is ${part.label}?`} onClick={() => onHelp(part.help)}><HelpCircle size={12} style={{ verticalAlign: -2 }} /> Help</button>}</h3>
        {link ? <>
          <div><b>{link.label}</b> <span className={`eng-pill ${link.state === 'ok' ? 'ok' : link.state === 'broken' ? 'fail' : 'warn'}`}>{link.state}</span></div>
          <p className="eng-note" style={{ fontSize: 12, color: 'var(--e-ink)' }}>{link.reason}</p>
          <div className="eng-note">From {PART_BY_ID[link.from]?.tag} to {PART_BY_ID[link.to]?.tag}</div>
          <button className="eng-btn" style={{ marginTop: 6 }} onClick={() => pick(link.state === 'ok' ? link.to : link.from)}>Inspect {PART_BY_ID[link.state === 'ok' ? link.to : link.from]?.tag}</button>
        </> : part ? <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Badge s={ph!.state} /><b style={{ fontFamily: 'ui-monospace,monospace' }}>{part.tag}</b></div>
          <div>{part.label}</div>
          <div style={{ marginTop: 4 }}><span className={`eng-pill ${ph!.state}`}>{ph!.state === 'ok' ? 'OK' : ph!.state === 'warn' ? 'Warning' : ph!.state === 'fail' ? 'Failed' : 'Off'}</span> <span className="eng-note">{ph!.why}</span></div>
          <dl className="eng-kv">{part.values(state).map(v => <React.Fragment key={v.label}><dt>{v.label}</dt><dd>{v.value}</dd></React.Fragment>)}</dl>
          {myProblems.filter(p => p.kind === 'alarm').map(p => <div key={String(p.alarmId)} className="eng-card" style={{ borderColor: 'var(--e-fail)' }} data-alarm-card><b style={{ color: 'var(--e-fail)' }}>Alarm</b> {p.reason}<div><button className="eng-btn" style={{ marginTop: 4 }} onClick={() => dispatch({ type: 'ACK_ALARM', id: p.alarmId })}>Acknowledge</button></div></div>)}
          {myProblems.some(p => p.kind === 'fault') && !myProblems.some(p => p.kind === 'alarm') && <div className="eng-note">A fault is active on this part, but no alarm is open for it.</div>}
          {myLinks.length > 0 && <><h3 className="eng-h" style={{ marginTop: 8 }}>Connections</h3>{myLinks.map(l => <button key={l.id} className="eng-row" onClick={() => { setTab('signals'); window.setTimeout(() => setSelLink(l.id), 0); }}><Badge s={l.state === 'ok' ? 'ok' : l.state === 'broken' ? 'fail' : 'warn'} size={16} /><span className="nm" style={{ color: 'var(--e-ink)' }}>{l.label}</span></button>)}</>}
          <div style={{ marginTop: 8, display: 'flex', gap: 6 }}><button className="eng-btn" data-show-lab onClick={() => onShowInLab(part.view)}>Show in realistic lab</button></div>
        </> : <div className="eng-note">Select a part in the list or the diagram to see its live values, connections and any alarm. Nothing is selected, so the live history of the chamber is shown below.</div>}
        {show('pressure') && <Spark data={hist} pick={s => s.pressure} log lo={1e-6} hi={1000} goodMin={1e-6} goodMax={1e-3} label="Pressure" value={fmtP(state.chamber.pressure)} thresholdText="Green band: below 1e-3 Torr, ready for measurement." />}
        {show('temp') && <Spark data={hist} pick={s => s.tempErr} lo={0} hi={0.5} goodMin={0} goodMax={0.03} label="Temperature error" value={`${Math.abs(state.chamber.temperature - state.chamber.targetTemp).toFixed(3)} °C`} thresholdText="Green band: within 0.03 °C of the setpoint." />}
        {show('optical') && <Spark data={hist} pick={s => s.optical} lo={0} hi={100} goodMin={70} goodMax={100} label="Optical quality" value={`${Math.round(state.ldv.opticalQuality ?? 100)}`} thresholdText="Green band: 70 or higher, a usable laser return." />}
      </div>
    </div>
  </div></div>;
}

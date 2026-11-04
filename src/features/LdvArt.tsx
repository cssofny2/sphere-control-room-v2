import React, { memo, useEffect, useRef } from 'react';
import { LDV_MODES, type LdvMode, type LdvSeries } from './ldvModel';

/* Pictures and plots for the LDV page: animated optical head, a rotating vibrating sphere, heat-maps and line plots. */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const STOPS = ['#2563eb', '#93c5fd', '#e5e7eb', '#fca5a5', '#dc2626'];
/** Diverging blue–white–red ramp for signed displacement. t in [-1, 1]. */
export function diverge(t: number): string {
  const u = (clamp(t, -1, 1) + 1) / 2, n = STOPS.length - 1, s = u * n, i = Math.min(n - 1, Math.floor(s)), f = s - i, a = hex(STOPS[i]), b = hex(STOPS[i + 1]);
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(',')})`;
}
const SEQ = ['#0b1220', '#3b0f70', '#8c2981', '#de4968', '#fe9f6d', '#fcfdbf'];
export function sequential(t: number): string {
  const u = clamp(t, 0, 1), n = SEQ.length - 1, s = u * n, i = Math.min(n - 1, Math.floor(s)), f = s - i, a = hex(SEQ[i]), b = hex(SEQ[i + 1]);
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(',')})`;
}

export function LdvIcon({ kind, size = 56 }: { kind: string; size?: number }) {
  const inner = (() => {
    switch (kind) {
      case 'sphere': return <><circle cx="30" cy="22" r="13" fill="#d9803f" stroke="#fcd34d" /><ellipse cx="30" cy="22" rx="13" ry="4.5" fill="none" stroke="#fff" strokeOpacity=".4" /><path className="lx-pulse" d="M17 22 a13 13 0 0 1 26 0" fill="none" stroke="#fb7185" strokeWidth="2" /></>;
      case 'spectrum': return <><path d="M4 38 L18 38 Q24 38 26 24 Q28 6 30 6 Q32 6 34 24 Q36 38 42 38 L56 38" fill="none" stroke="#e879f9" strokeWidth="2.2" className="lx-draw" /><line x1="30" x2="30" y1="4" y2="40" stroke="#fbbf24" strokeDasharray="2 3" /></>;
      case 'noise': return <><path className="lx-draw" d="M4 30 l3 -6 l3 9 l3 -12 l3 14 l3 -8 l3 3 l3 -14 l3 12 l3 -4 l3 6 l3 -10 l3 14 l3 -6 l3 4 l3 -8" fill="none" stroke="#4ade80" strokeWidth="1.8" /><path d="M4 38 H56" stroke="#334155" strokeDasharray="2 3" /></>;
      case 'location': return <><rect x="6" y="34" width="48" height="4" rx="2" fill="#475569" /><circle className="lx-slide" cx="14" cy="26" r="7" fill="#d9803f" stroke="#fcd34d" /><path d="M10 12 H50 M44 8 l6 4 l-6 4" stroke="#38bdf8" fill="none" strokeWidth="1.6" /></>;
      case 'decay': return <><path className="lx-draw" d="M4 22 q4 -16 8 0 t8 0 q3 -12 6 0 t6 0 q2 -8 4 0 t4 0 q1.5 -5 3 0 t3 0 q1 -3 2 0 t2 0" fill="none" stroke="#fb923c" strokeWidth="2" /><path d="M4 6 Q30 8 56 22" fill="none" stroke="#fb923c" strokeDasharray="3 3" opacity=".6" /></>;
      case 'align': return <><rect x="8" y="5" width="44" height="34" rx="4" fill="#0b1220" stroke="#334155" />{[0, 1, 2, 3, 4, 5].map(r => [0, 1, 2, 3, 4, 5, 6, 7].map(c => <rect key={`${r}${c}`} x={10 + c * 5.2} y={7 + r * 5.2} width="4.6" height="4.6" fill={sequential(1 - Math.hypot(c - 3.5, r - 2.5) / 5)} />))}<circle className="lx-pulse" cx="30" cy="20" r="3" fill="none" stroke="#fff" strokeWidth="1.4" /></>;
      default: return <circle cx="30" cy="22" r="10" fill="none" stroke="#e879f9" />;
    }
  })();
  return <svg viewBox="0 0 60 45" width={size} height={Math.round(size * 0.75)} className="lx-icon" aria-hidden="true" focusable="false"><rect x="1" y="1" width="58" height="43" rx="6" fill="#0a0710" stroke="#3a2250" />{inner}</svg>;
}

/** Animated optical head: laser → beam splitter → scanning mirror → sphere, with the reflected light returning to the detector. */
export function HeadDiagram({ power, shutter, scanning, stalled, quality, progress }: { power: boolean; shutter: boolean; scanning: boolean; stalled: boolean; quality: number; progress: number }) {
  const on = power && shutter, q = clamp(quality / 100, 0, 1);
  return (
    <svg viewBox="0 0 520 300" className="lx-head" role="img" aria-label="Optical head: laser, beam splitter, scanning mirrors, sphere and detector">
      <defs>
        <radialGradient id="lxcu" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#ffe3c4" /><stop offset=".4" stopColor="#d9803f" /><stop offset="1" stopColor="#4a2410" /></radialGradient>
        <filter id="lxg"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect x="6" y="6" width="508" height="288" rx="14" fill="#08060e" stroke="#2a1b3d" />
      {/* controller rack */}
      <g transform="translate(18 30)"><rect width="86" height="64" rx="8" fill="#17102a" stroke={power ? '#e879f9' : '#3a2a52'} strokeWidth="2" /><text x="43" y="22" textAnchor="middle" fontSize="10" fontWeight="700" fill="#f5d0fe" fontFamily="ui-monospace,monospace">LASER</text><text x="43" y="36" textAnchor="middle" fontSize="8" fill="#a78bfa" fontFamily="ui-monospace,monospace">633 nm · Class 2</text><circle cx="14" cy="50" r="4" fill={power ? '#22c55e' : '#475569'} className={power ? 'lx-led' : ''} /><rect x="26" y="45" width="48" height="10" rx="3" fill="#0a0710" stroke="#3a2a52" /><rect x="27" y="46" width={on ? 46 : 0} height="8" rx="2" fill="#f43f5e" opacity=".8" /></g>
      <text x="28" y="116" fontSize="9" fill="#8b7aa8" fontFamily="ui-monospace,monospace">laser head</text>
      {/* beam path */}
      <path d="M104 62 H250" stroke={on ? '#ff4d63' : '#3a2a52'} strokeWidth={on ? 2.6 : 1.2} fill="none" className={on ? 'lx-beam' : ''} filter={on ? 'url(#lxg)' : undefined} />
      <rect x="250" y="48" width="28" height="28" rx="3" transform="rotate(45 264 62)" fill="#1a1230" stroke="#a78bfa" strokeWidth="1.6" />
      <text x="264" y="94" textAnchor="middle" fontSize="8.5" fill="#a78bfa" fontFamily="ui-monospace,monospace">beam splitter</text>
      <path d="M264 76 V132" stroke={on ? '#ff4d63' : '#3a2a52'} strokeWidth={on ? 2.6 : 1.2} fill="none" className={on ? 'lx-beam' : ''} filter={on ? 'url(#lxg)' : undefined} />
      {/* scanning mirrors */}
      <g transform="translate(264 140)"><g className={scanning && !stalled ? 'lx-mirror' : ''}><rect x="-20" y="-6" width="40" height="12" rx="3" fill="#1a1230" stroke="#e879f9" strokeWidth="1.6" /><rect x="-17" y="-3" width="34" height="3" fill="#f0abfc" opacity=".8" /></g></g>
      <text x="300" y="144" fontSize="8.5" fill="#e879f9" fontFamily="ui-monospace,monospace">X–Y scanning mirrors</text>
      {/* beam to sphere */}
      <g className={scanning && !stalled ? 'lx-sweep' : ''} style={{ transformOrigin: '264px 146px' }}><path d="M264 146 V214" stroke={on ? '#ff4d63' : '#3a2a52'} strokeWidth={on ? 2.6 : 1.2} fill="none" className={on ? 'lx-beam' : ''} filter={on ? 'url(#lxg)' : undefined} /></g>
      {/* sphere in chamber */}
      <rect x="196" y="206" width="136" height="76" rx="10" fill="#0a1018" stroke="#3b4d62" strokeWidth="2" />
      <text x="264" y="296" textAnchor="middle" fontSize="8.5" fill="#8b7aa8" fontFamily="ui-monospace,monospace" />
      <circle cx="264" cy="244" r="24" fill="url(#lxcu)" stroke="#fcd34d" />
      <ellipse cx="264" cy="244" rx="24" ry="8" fill="none" stroke="#fff" strokeOpacity=".3" />
      {on && <circle className="lx-spot" cx="264" cy="222" r="3.4" fill="#ff8a98" filter="url(#lxg)" />}
      {scanning && !stalled && Array.from({ length: 16 }).map((_, i) => <circle key={i} className="lx-dot" cx={246 + (i % 4) * 12} cy={230 + Math.floor(i / 4) * 8} r="1.6" fill="#f0abfc" style={{ animationDelay: `${i * 0.12}s` }} />)}
      {/* return path to detector */}
      <path d="M270 214 C 330 190, 330 120, 292 70" stroke={on ? '#fde68a' : '#3a2a52'} strokeWidth={on ? 1.8 : 1} fill="none" strokeDasharray="6 5" opacity={0.25 + 0.75 * q * (on ? 1 : 0)} className={on ? 'lx-retline' : ''} />
      <text x="338" y="168" fontSize="8.5" fill="#fde68a" fontFamily="ui-monospace,monospace">reflected light ({Math.round(quality)}%)</text>
      <g transform="translate(380 40)"><rect width="110" height="70" rx="8" fill="#101a2a" stroke="#38bdf8" strokeWidth="1.6" /><text x="55" y="16" textAnchor="middle" fontSize="9" fontWeight="700" fill="#bae6fd" fontFamily="ui-monospace,monospace">DETECTOR + DECODER</text>
        <path className={on ? 'lx-fringe' : ''} d="M8 44 q6 -20 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0" fill="none" stroke="#5fd4ff" strokeWidth="1.8" opacity={on ? 0.4 + 0.6 * q : 0.15} /><text x="55" y="64" textAnchor="middle" fontSize="8" fill="#7dd3fc" fontFamily="ui-monospace,monospace">Doppler fringes → velocity</text></g>
      <path d="M292 70 L380 70" stroke={on ? '#fde68a' : '#3a2a52'} strokeDasharray="4 4" fill="none" className={on ? 'lx-retline' : ''} />
      {scanning && <g transform="translate(380 130)"><rect width="110" height="12" rx="6" fill="#0a0710" stroke="#3a2a52" /><rect x="1" y="1" width={108 * progress} height="10" rx="5" fill={stalled ? '#fb923c' : '#e879f9'} className={stalled ? 'lx-stall' : ''} /><text x="55" y="26" textAnchor="middle" fontSize="9" fill={stalled ? '#fdba74' : '#f5d0fe'} fontFamily="ui-monospace,monospace">{stalled ? 'STALLED' : `scanning ${Math.round(progress * 100)}%`}</text></g>}
    </svg>
  );
}

/** Rotating, vibrating sphere coloured by surface velocity. Reveals row by row while a scan runs. */
export const SphereView = memo(function SphereView({ field, n, mode, revealed = 1, amp = 1, animate = true, size = 300, spin = true }: { field: number[]; n: number; mode: LdvMode; revealed?: number; amp?: number; animate?: boolean; size?: number; spin?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ field, n, revealed, amp, animate, spin });
  live.current = { field, n, revealed, amp, animate, spin };
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = size * dpr; cv.height = size * dpr;
    const g = cv.getContext('2d'); if (!g) return; g.scale(dpr, dpr);
    let raf = 0, visible = true; const t0 = performance.now();
    const io = new IntersectionObserver(es => { visible = es[0]?.isIntersecting ?? true; }); io.observe(cv);
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible || document.hidden) return;
      const { field: f, n: nn, revealed: rev, amp: a, animate: an, spin: sp } = live.current, t = (now - t0) / 1000;
      const phase = an ? t * 4.2 : Math.PI / 3, ry = sp && an ? t * 0.45 : 0.7, rx = 0.45, R = size * 0.34, cx = size / 2, cy = size / 2;
      g.clearRect(0, 0, size, size);
      const bg = g.createRadialGradient(cx, cy, 10, cx, cy, size * 0.5); bg.addColorStop(0, '#150d24'); bg.addColorStop(1, '#07040d'); g.fillStyle = bg; g.fillRect(0, 0, size, size);
      const cph = Math.cos(phase), cosY = Math.cos(ry), sinY = Math.sin(ry), cosX = Math.cos(rx), sinX = Math.sin(rx);
      const val = (r: number, q: number) => (f[clamp(r, 0, nn - 1) * nn + ((q + nn) % nn)] ?? 0);
      const vtx = (i: number, j: number) => { // average the four cells touching vertex (i,j)
        let s = 0, c = 0; for (const [dr, dq] of [[-1, -1], [-1, 0], [0, -1], [0, 0]]) { const r = i + dr, q = j + dq; if (r >= 0 && r < nn) { s += val(r, q); c++; } } return c ? s / c : 0;
      };
      const P = (i: number, j: number) => {
        const th = (i / nn) * Math.PI, ph = (j / nn) * Math.PI * 2 - Math.PI, rad = R * (1 + 0.17 * a * vtx(i, j) * cph);
        const x = rad * Math.sin(th) * Math.cos(ph), y = rad * Math.cos(th), z = rad * Math.sin(th) * Math.sin(ph);
        const x1 = x * cosY + z * sinY, z1 = -x * sinY + z * cosY, y2 = y * cosX - z1 * sinX, z2 = y * sinX + z1 * cosX;
        return [cx + x1, cy - y2, z2];
      };
      const cells: { d: number; pts: number[][]; col: string; row: number; q: number }[] = [];
      for (let r = 0; r < nn; r++) for (let q = 0; q < nn; q++) {
        const p = [P(r, q), P(r, q + 1), P(r + 1, q + 1), P(r + 1, q)], v = val(r, q) * cph, d = (p[0][2] + p[1][2] + p[2][2] + p[3][2]) / 4;
        cells.push({ d, pts: p, col: diverge(v * a), row: r, q });
      }
      cells.sort((x, y) => x.d - y.d);
      const rows = Math.max(0, Math.min(nn, Math.floor(rev * nn + 1e-6)));
      for (const c of cells) {
        const done = c.row < rows, edge = c.row === rows && rev < 1;
        g.beginPath(); g.moveTo(c.pts[0][0], c.pts[0][1]); for (let k = 1; k < 4; k++) g.lineTo(c.pts[k][0], c.pts[k][1]); g.closePath();
        const front = c.d > -R * 0.15, shade = 0.55 + 0.45 * clamp((c.d / R + 1) / 2, 0, 1);
        g.globalAlpha = front ? 1 : 0.3; g.fillStyle = done ? c.col : edge ? '#f0abfc' : '#1b1530'; g.fill();
        if (done && front) { g.globalAlpha = 1 - shade; g.fillStyle = '#000'; g.fill(); }
        g.globalAlpha = front ? 0.28 : 0.1; g.strokeStyle = '#0b0714'; g.lineWidth = nn > 16 ? 0.4 : 0.8; g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = '#9d8bb8'; g.font = '10px ui-monospace,monospace'; g.fillText(`${LDV_MODES[mode].label} · ${nn}×${nn} points`, 8, size - 8);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [size, mode]);
  return <canvas ref={ref} style={{ width: size, height: size, maxWidth: '100%' }} className="lx-sphere" role="img" aria-label={`Rotating 3D sphere coloured by surface velocity, mode ${LDV_MODES[mode].label}`} />;
});

/** Flat latitude/longitude map of the same data. */
export function HeatMap({ field, n, revealed = 1, scanRow }: { field: number[]; n: number; revealed?: number; scanRow?: number }) {
  const done = Math.floor(revealed * n + 1e-6), cell = 300 / n;
  return (
    <figure className="lx-fig">
      <svg viewBox="0 0 330 190" className="lx-heat" role="img" aria-label="Surface velocity map: north pole at the top, south pole at the bottom">
        <rect x="26" y="6" width="300" height="150" fill="#0a0710" stroke="#3a2250" />
        {field.map((v, i) => { const r = Math.floor(i / n), q = i % n; return <rect key={i} x={26 + q * cell} y={6 + r * (150 / n)} width={cell + 0.4} height={150 / n + 0.4} fill={r < done ? diverge(v) : '#14102a'} />; })}
        {scanRow !== undefined && revealed < 1 && <rect className="lx-scanrow" x="26" y={6 + Math.min(n - 1, done) * (150 / n)} width="300" height={150 / n} fill="none" stroke="#f0abfc" strokeWidth="1.6" />}
        <text x="22" y="14" textAnchor="end" fontSize="8" fill="#8b7aa8">N</text><text x="22" y="156" textAnchor="end" fontSize="8" fill="#8b7aa8">S</text>
        <text x="176" y="172" textAnchor="middle" fontSize="8.5" fill="#8b7aa8" fontFamily="ui-monospace,monospace">longitude −180° … +180°</text>
        <defs><linearGradient id="lxbar" x1="0" x2="1">{STOPS.map((c, i) => <stop key={c} offset={i / (STOPS.length - 1)} stopColor={c} />)}</linearGradient></defs>
        <rect x="116" y="177" width="120" height="6" fill="url(#lxbar)" /><text x="112" y="183" textAnchor="end" fontSize="7.5" fill="#8b7aa8">in</text><text x="240" y="183" fontSize="7.5" fill="#8b7aa8">out</text>
      </svg>
    </figure>
  );
}

/** Simple annotated line plot for point spectra, noise floors, location sweeps and ring-downs. */
export function SeriesPlot({ s, color = '#e879f9', progress = 1 }: { s: LdvSeries; color?: string; progress?: number }) {
  const W = 360, H = 170, L = 40, B = 24, T = 8, Rr = 8;
  const xs = s.x, n = Math.max(2, Math.floor(xs.length * progress));
  const lg = !!s.log, fx = (v: number) => (lg ? Math.log10(Math.max(v, 1e-9)) : v);
  const xmin = fx(xs[0]), xmax = fx(xs[xs.length - 1]);
  const ys = [...s.y, ...(s.extra || [])].map(v => (lg ? Math.log10(Math.max(v, 1e-6)) : v));
  const ymin = Math.min(...ys, lg ? -3 : Math.min(0, ...s.y)), ymax = Math.max(...ys) + (Math.max(...ys) - ymin) * 0.08 || 1;
  const X = (v: number) => L + ((fx(v) - xmin) / (xmax - xmin || 1)) * (W - L - Rr), Y = (v: number) => H - B - (((lg ? Math.log10(Math.max(v, 1e-6)) : v) - ymin) / (ymax - ymin || 1)) * (H - B - T);
  const line = (arr: number[]) => arr.slice(0, n).map((v, i) => `${X(xs[i]).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const tick = (a: number, b: number) => [0, 1, 2, 3, 4].map(i => a + ((b - a) * i) / 4);
  const xl = (v: number) => { const x = lg ? Math.pow(10, v) : v; return Math.abs(x) >= 1000 ? `${(x / 1000).toFixed(x >= 1e5 ? 0 : 1)}k` : Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(Math.abs(x) < 10 ? 1 : 0); };
  const yl = (v: number) => { const y = lg ? Math.pow(10, v) : v; return Math.abs(y) < 0.1 && y !== 0 ? y.toExponential(0) : Math.abs(y) >= 100 ? y.toFixed(0) : y.toFixed(Math.abs(y) < 10 ? 2 : 1); };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="lx-plot" role="img" aria-label={`${s.yLabel} against ${s.xLabel}`}>
      <rect x={L} y={T} width={W - L - Rr} height={H - B - T} fill="#07040d" stroke="#2a1b3d" />
      {tick(xmin, xmax).map((v, i) => <g key={`x${i}`}><line x1={L + (i / 4) * (W - L - Rr)} x2={L + (i / 4) * (W - L - Rr)} y1={T} y2={H - B} stroke="#1a1230" /><text x={L + (i / 4) * (W - L - Rr)} y={H - B + 11} textAnchor="middle" fontSize="8" fill="#8b7aa8" fontFamily="ui-monospace,monospace">{xl(v)}</text></g>)}
      {tick(ymin, ymax).map((v, i) => <g key={`y${i}`}><line x1={L} x2={W - Rr} y1={H - B - (i / 4) * (H - B - T)} y2={H - B - (i / 4) * (H - B - T)} stroke="#1a1230" /><text x={L - 4} y={H - B - (i / 4) * (H - B - T) + 3} textAnchor="end" fontSize="8" fill="#8b7aa8" fontFamily="ui-monospace,monospace">{yl(v)}</text></g>)}
      {s.marker !== undefined && s.marker >= xs[0] && s.marker <= xs[xs.length - 1] && <line x1={X(s.marker)} x2={X(s.marker)} y1={T} y2={H - B} stroke="#fbbf24" strokeDasharray="3 4" opacity=".8" />}
      {s.extra && <polyline points={line(s.extra)} fill="none" stroke="#fb923c" strokeWidth="1.5" strokeDasharray="4 3" />}
      <polyline points={line(s.y)} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {s.y.slice(0, n).map((v, i) => (xs.length <= 12 ? <circle key={i} cx={X(xs[i])} cy={Y(v)} r="3.2" fill={color} /> : null))}
      <text x={(L + W - Rr) / 2} y={H - 2} textAnchor="middle" fontSize="9" fill="#a99cc0">{s.xLabel}</text>
      <text transform={`translate(9 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" fontSize="9" fill="#a99cc0">{s.yLabel}</text>
      {s.extraLabel && <text x={W - Rr - 4} y={T + 11} textAnchor="end" fontSize="8.5" fill="#fb923c">- - {s.extraLabel}</text>}
    </svg>
  );
}

/** Return-strength map over beam angle (alignment scenario). */
export function AlignMap({ map }: { map: { size: number; values: number[]; best: [number, number]; current: [number, number] } }) {
  const { size, values } = map, c = 22, off = 12, half = (size - 1) / 2;
  return (
    <svg viewBox={`0 0 ${size * c + 40} ${size * c + 34}`} className="lx-align" role="img" aria-label="Optical return strength for each beam angle">
      {values.map((v, i) => <rect key={i} x={off + 18 + (i % size) * c} y={off + Math.floor(i / size) * c} width={c - 1} height={c - 1} fill={sequential(v / 100)}><title>{`${v.toFixed(0)}% return`}</title></rect>)}
      <circle cx={off + 18 + (map.best[0] + half) * c + c / 2} cy={off + (map.best[1] + half) * c + c / 2} r="8" fill="none" stroke="#34d399" strokeWidth="2.4" />
      <path d={`M${off + 18 + (map.current[0] + half) * c + c / 2 - 7} ${off + (map.current[1] + half) * c + c / 2} h14 M${off + 18 + (map.current[0] + half) * c + c / 2} ${off + (map.current[1] + half) * c + c / 2 - 7} v14`} stroke="#fff" strokeWidth="2" />
      <text x={off + 18} y={size * c + off + 14} fontSize="9" fill="#a99cc0" fontFamily="ui-monospace,monospace">beam X → · ring = best · cross = now</text>
    </svg>
  );
}

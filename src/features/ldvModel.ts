// Laser Doppler vibrometer (LDV) scan model. A scan is a timed job: the scanning mirrors steer one laser spot over a grid on
// the sphere, the decoder turns each spot's Doppler shift into a velocity, and the controller assembles the points into a result.
// The result depends on the live simulation (optical return, isolation, shielding, pressure, stage position, clock lock), so a
// scan taken under bad conditions looks bad. Pure functions only: the reducer/tick drive the job, the UI draws the results.

export type LdvScenarioId = 'modemap' | 'point' | 'noise' | 'locscan' | 'damping' | 'alignment';
export type LdvMode = '2,0' | '2,1' | '2,2' | '3,0' | '3,2';
export const LDV_GRIDS = [16, 64, 144, 256, 400, 900];
export const LDV_MODES: Record<LdvMode, { label: string; plain: string }> = {
  '2,0': { label: 'l=2, m=0', plain: 'Football mode: the poles squeeze in while the equator bulges out.' },
  '2,1': { label: 'l=2, m=1', plain: 'Tilted mode: one side rises as the opposite side falls.' },
  '2,2': { label: 'l=2, m=2', plain: 'Four-lobe mode: two opposite lobes out, two lobes in.' },
  '3,0': { label: 'l=3, m=0', plain: 'Three-band mode: north out, middle in, south out.' },
  '3,2': { label: 'l=3, m=2', plain: 'Twisted six-lobe mode, a higher harmonic.' },
};

export type LdvScenario = {
  id: LdvScenarioId; title: string; short: string; icon: string;
  goal: string; when: string; produces: string; needs: string[]; fixed?: number;
};
export const LDV_SCENARIOS: LdvScenario[] = [
  { id: 'modemap', title: 'Surface mode map', short: 'Mode map', icon: 'sphere', goal: 'Photograph how the whole sphere surface vibrates at its resonance, point by point.', when: 'After the VNA has found the resonance and you want to see which vibration pattern (mode) it is.', produces: 'A colour map plus a rotating 3D sphere showing where the surface moves in and out.', needs: ['Shutter open', 'Optical return above 20%', 'Stage still'] },
  { id: 'point', title: 'Single-point spectrum', short: 'Point spectrum', icon: 'spectrum', goal: 'Park the laser on one spot and read the vibration spectrum around the resonance.', when: 'To read the exact resonant frequency, its sharpness (Q) and the signal-to-noise ratio.', produces: 'A spectrum with a peak; the width of the peak gives the Q-factor.', needs: ['Shutter open', 'Optical return above 20%'], fixed: 120 },
  { id: 'noise', title: 'Noise-floor check', short: 'Noise floor', icon: 'noise', goal: 'Measure how much vibration the sphere shows when nothing is deliberately exciting it.', when: 'Before a long measurement, to prove that isolation, shielding and pumps are not spoiling the data.', produces: 'A noise spectrum that names the strongest disturbance (60 Hz hum, pump, floor sway).', needs: ['Shutter open'], fixed: 120 },
  { id: 'locscan', title: 'Location sweep', short: 'Location sweep', icon: 'location', goal: 'Measure the resonance at seven stage positions along X to see how location shifts it.', when: 'This is the experiment itself seen by laser: does position change the vibration?', produces: 'A plot of resonant-frequency shift against stage position with the return signal underneath.', needs: ['Shutter open', 'Optical return above 20%'], fixed: 140 },
  { id: 'damping', title: 'Ring-down (damping)', short: 'Ring-down', icon: 'decay', goal: 'Strike the sphere with a short drive pulse and watch how fast the vibration dies away.', when: 'To see the benefit of vacuum: gas around the sphere damps its motion.', produces: 'A decay curve, the decay time and Q, compared with the same sphere in air.', needs: ['Shutter open'], fixed: 100 },
  { id: 'alignment', title: 'Alignment & focus map', short: 'Alignment map', icon: 'align', goal: 'Map how strong the returned light is for each beam angle, so you can find the best alignment.', when: 'When the optical return is weak, or after the misalignment fault is injected.', produces: 'A heat-map of return strength with the best spot marked and an Auto-align button.', needs: ['Laser on'], fixed: 121 },
];
export const LDV_SCENARIO_BY_ID = Object.fromEntries(LDV_SCENARIOS.map(x => [x.id, x])) as Record<LdvScenarioId, LdvScenario>;

export type LdvSeries = { x: number[]; y: number[]; extra?: number[]; xLabel: string; yLabel: string; extraLabel?: string; marker?: number; log?: boolean };
export type LdvScanResult = {
  id: string; scenario: LdvScenarioId; title: string; iso: string; clock: string; operator: string; simTime: number;
  n: number; mode: LdvMode; f0: number; q: number; peakVel: number; noiseFloor: number; snr: number; returnPct: number;
  position: [number, number, number]; pressure: number; temperature: number; clockLocked: boolean; isolation: boolean; faraday: boolean;
  field?: number[];            // n*n displacement values, rows = latitude (north to south), -1..1
  series?: LdvSeries;
  map?: { size: number; values: number[]; best: [number, number]; current: [number, number] };
  summary: string[]; verdict: 'good' | 'fair' | 'poor'; verdictText: string;
};

const TAU = Math.PI * 2;
const hash = (n: number) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const gridSide = (grid: number) => clamp(Math.round(Math.sqrt(Math.max(4, grid))), 2, 30);
export const scanPointTotal = (scenario: LdvScenarioId, grid: number) => LDV_SCENARIO_BY_ID[scenario].fixed ?? gridSide(grid) ** 2;
/** Simulated seconds a scan takes at 1× speed (about 18 points per second, never under 3 s). */
export const scanSeconds = (scenario: LdvScenarioId, grid: number) => Math.max(3, scanPointTotal(scenario, grid) / 18);

/** Real spherical-harmonic-like shape, θ from the north pole (0) to the south pole (π), φ around the equator. Normalised to about ±1. */
export function sphereShape(mode: LdvMode, theta: number, phi: number): number {
  const c = Math.cos(theta), s = Math.sin(theta);
  switch (mode) {
    case '2,0': return (3 * c * c - 1) / 2 / 1.0;
    case '2,1': return 2 * s * c * Math.cos(phi) * 1.0;
    case '2,2': return s * s * Math.cos(2 * phi);
    case '3,0': return (5 * c * c * c - 3 * c) / 2;
    case '3,2': return s * s * c * Math.cos(2 * phi) * 2.2;
  }
}

export type ScanConditions = { returnPct: number; q: number; noise: number; peakVel: number; shake: number; emi: number; air: boolean; filterCuts: boolean };
export function conditions(s: any): ScanConditions {
  const c = s.chamber, l = s.ldv, f = s.failures || {};
  const returnPct = l.power && l.shutter ? clamp(l.opticalQuality ?? 100, 0, 100) : 0, rq = returnPct / 100;
  const shake = (!c.isolation ? 1 : 0.05), emi = (!c.faraday || f.emiSpike ? 1 : 0.05), air = c.pressure > 1;
  // Decoder settings matter: a wide velocity range is noisier for small signals, and a 100 kHz filter cuts off the ~230 kHz resonance.
  const rangeMm = parseFloat(String(l.range)) || 20, bw = ({ '100 kHz': 1e5, '1 MHz': 1e6, '10 MHz': 1e7 } as Record<string, number>)[String(l.filter)] ?? 1e7;
  const q = (air ? 1200 : 4500) * (0.7 + 0.3 * rq);
  const peakVel = 4.2 * Math.pow(rq, 1.2) * (air ? 0.35 : 1) * (s.clock?.locked ? 1 : 0.9) * (bw <= 1e5 ? 0.2 : 1);
  const noise = (0.05 + 0.6 * (1 - rq) + 0.18 * shake + 0.06 * emi + (f.stageBacklash ? 0.08 : 0)) * (0.6 + 0.4 * (rangeMm / 20)) * (bw <= 1e6 && bw > 1e5 ? 0.85 : 1);
  return { returnPct, q, noise, peakVel, shake, emi, air, filterCuts: bw <= 1e5 };
}

type Opts = { f0: number; grid: number; id: string; iso: string; clock: string; operator: string; freqAt?: (x: number, y: number, z: number) => number };

export function generateScan(s: any, scenario: LdvScenarioId, o: Opts): LdvScanResult {
  const c = s.chamber, l = s.ldv, st = s.stage, cd = conditions(s);
  const n = gridSide(o.grid), mode = (l.mode as LdvMode) in LDV_MODES ? (l.mode as LdvMode) : '2,0';
  const pos: [number, number, number] = [st.actualX ?? st.x, st.actualY ?? st.y, st.actualZ ?? st.z];
  const base: LdvScanResult = {
    id: o.id, scenario, title: LDV_SCENARIO_BY_ID[scenario].title, iso: o.iso, clock: o.clock, operator: o.operator, simTime: s.facility?.simulationTime || 0,
    n, mode, f0: o.f0, q: cd.q, peakVel: cd.peakVel, noiseFloor: cd.noise * 0.05, snr: 0, returnPct: cd.returnPct, position: pos,
    pressure: c.pressure, temperature: c.temperature, clockLocked: !!s.clock?.locked, isolation: !!c.isolation, faraday: !!c.faraday,
    summary: [], verdict: 'good', verdictText: '',
  };
  const rms = (v: number[]) => Math.sqrt(v.reduce((a, b) => a + b * b, 0) / Math.max(1, v.length));
  const seed = hash(Array.from(o.id).reduce((a, ch) => a + ch.charCodeAt(0), 0));
  const verdict = (snr: number): [LdvScanResult['verdict'], string] => snr >= 20 ? ['good', 'Clean result: the signal stands well above the noise.'] : snr >= 6 ? ['fair', 'Usable, but noisy. Improve the optical return or isolation and repeat.'] : ['poor', 'Signal is buried in noise. Do not trust these numbers; fix the conditions listed below and scan again.'];
  const why = (): string[] => {
    const out: string[] = [];
    if (cd.returnPct < 60) out.push(`Optical return is only ${cd.returnPct.toFixed(0)}% (re-align or refocus).`);
    if (cd.shake > 0.5) out.push('Vibration isolation is off.');
    if (cd.emi > 0.5) out.push('Shielding is off or an EMI source is active.');
    if (cd.air) out.push('The chamber is not under vacuum, so air damps the sphere.');
    if (cd.filterCuts) out.push('The 100 kHz decoder filter is cutting off the ~230 kHz resonance: choose 1 MHz or 10 MHz.');
    if (l.scanStalled) out.push('The scan stalled while conditions were bad.');
    return out;
  };

  if (scenario === 'modemap') {
    const field: number[] = new Array(n * n);
    for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) {
      const th = ((r + 0.5) / n) * Math.PI, ph = ((q + 0.5) / n) * TAU - Math.PI;
      field[r * n + q] = clamp(sphereShape(mode, th, ph) + (hash(r * 31 + q * 7 + seed * 1000) - 0.5) * 2 * Math.min(1.2, cd.noise * 0.55), -1.6, 1.6);
    }
    base.field = field;
    base.snr = (cd.peakVel / Math.max(1e-3, cd.noise * 0.2));
    const nodal = field.filter((v, i) => i % n && Math.sign(v) !== Math.sign(field[i - 1])).length;
    base.summary = [`${n * n} points on a ${n}×${n} grid, mode ${LDV_MODES[mode].label}.`, `Peak surface velocity ${cd.peakVel.toFixed(2)} mm/s, RMS pattern ${rms(field).toFixed(2)} (relative).`, `${nodal} sign changes across rows (nodal lines crossed).`, LDV_MODES[mode].plain];
  } else if (scenario === 'point') {
    const m = 120, span = 1200, fw = o.f0 / (2 * cd.q), x: number[] = [], y: number[] = [];
    for (let i = 0; i < m; i++) { const f = o.f0 - span / 2 + (i / (m - 1)) * span, d = (f - o.f0) / fw; x.push(f / 1000); y.push(cd.peakVel / (1 + d * d) + cd.noise * 0.08 * hash(i * 5.1 + seed * 777)); }
    base.series = { x, y, xLabel: 'Frequency (kHz)', yLabel: 'Velocity (mm/s)', marker: o.f0 / 1000 };
    base.snr = cd.peakVel / Math.max(1e-3, cd.noise * 0.04);
    base.summary = [`Resonance ${(o.f0 / 1000).toFixed(4)} kHz.`, `Linewidth ${(fw * 2).toFixed(1)} Hz, so Q ≈ ${cd.q.toFixed(0)}.`, `Peak velocity ${cd.peakVel.toFixed(2)} mm/s, SNR ${base.snr.toFixed(0)}:1.`];
  } else if (scenario === 'noise') {
    const m = 120, x: number[] = [], y: number[] = [], lines: [number, number, string][] = [[8, 0.6 * cd.shake, 'floor sway at 8 Hz'], [25, 0.5 * (c.roughingRpm || 0) / 100, 'roughing pump at 25 Hz'], [60, 0.9 * cd.emi, 'mains hum at 60 Hz'], [1200, 0.45 * (c.turboRpm || 0) / 100, 'turbo whine at 1.2 kHz']];
    for (let i = 0; i < m; i++) {
      const f = Math.pow(10, 0.7 + (i / (m - 1)) * 4.8); let v = 0.02 + cd.noise * 0.03 + 0.02 * hash(i * 3.3 + seed * 500) + 0.0005 * Math.pow(10, 3 / Math.max(1, Math.log10(f) + 0.2));
      for (const [lf, la] of lines) v += la * Math.exp(-Math.pow(Math.log10(f / lf) * 18, 2));
      x.push(f); y.push(v);
    }
    const top = lines.filter(q => q[1] > 0.12).sort((a, b) => b[1] - a[1]);
    base.noiseFloor = rms(y) / 8; base.snr = cd.peakVel / Math.max(1e-3, rms(y));
    base.series = { x, y, xLabel: 'Frequency (Hz)', yLabel: 'Noise (nm/√Hz)', log: true };
    base.summary = [`Broadband floor ${(0.02 + cd.noise * 0.03).toFixed(3)} nm/√Hz.`, top.length ? `Strongest disturbance: ${top[0][2]}.` : 'No single disturbance stands out: the room is quiet.', ...top.slice(1).map(q => `Also present: ${q[2]}.`)];
  } else if (scenario === 'locscan') {
    const xs = [-30, -20, -10, 0, 10, 20, 30], fa = o.freqAt || ((px: number) => o.f0 + (px - pos[0]) * 45.2);
    const ref = fa(0, pos[1], pos[2]), y = xs.map(px => fa(px, pos[1], pos[2]) - ref), extra = xs.map(px => clamp(100 - Math.abs(px) * 0.8 - Math.abs(pos[2]) * 0.6 - (cd.shake > 0.5 ? 18 : 0), 5, 99));
    base.series = { x: xs, y, extra, xLabel: 'Stage X (mm)', yLabel: 'Resonance shift (Hz)', extraLabel: 'Optical return (%)', marker: pos[0] };
    const slope = (y[6] - y[0]) / 60; base.snr = Math.abs(y[6] - y[0]) / Math.max(0.05, cd.noise * 2);
    base.summary = [`Slope along X ≈ ${slope.toFixed(1)} Hz per mm over ±30 mm.`, `Total spread ${Math.abs(y[6] - y[0]).toFixed(1)} Hz, against a measurement noise of about ${(cd.noise * 2).toFixed(2)} Hz.`, 'Simulated model data: it shows how the teaching model behaves, not a real-world result.'];
  } else if (scenario === 'damping') {
    const m = 100, tau = cd.q / (Math.PI * o.f0), tauAir = (1200 * (0.7 + 0.3 * cd.returnPct / 100)) / (Math.PI * o.f0), T = 4 * tau, x: number[] = [], y: number[] = [], extra: number[] = [];
    for (let i = 0; i < m; i++) { const t = (i / (m - 1)) * T; x.push(t * 1000); y.push(cd.peakVel * Math.exp(-t / tau) + cd.noise * 0.05 * hash(i * 9.1 + seed * 321)); extra.push(cd.peakVel * Math.exp(-t / tauAir)); }
    base.series = { x, y, extra, xLabel: 'Time after drive stops (ms)', yLabel: 'Velocity (mm/s)', extraLabel: 'Same sphere in air' };
    base.snr = cd.peakVel / Math.max(1e-3, cd.noise * 0.05);
    base.summary = [`Decay time ${(tau * 1000).toFixed(2)} ms, Q ≈ ${cd.q.toFixed(0)}.`, cd.air ? 'The chamber is at air pressure, so this IS the air curve.' : `In air the same ring-down would be about ${(cd.q / 1200).toFixed(1)}× shorter (${(tauAir * 1000).toFixed(2)} ms).`, 'A long ring-down means a sharp, easy-to-measure resonance.'];
  } else {
    const size = 11, vals: number[] = [], pen = (ax: number, ay: number) => clamp(100 - (cd.shake > 0.5 ? 18 : 0) - Math.min(75, (Math.abs(ax) + Math.abs(ay)) * 4 + Math.abs(l.focus || 0) * 3) - (s.failures?.ldvMisalign ? 65 : 0), 0, 100);
    for (let r = 0; r < size; r++) for (let q = 0; q < size; q++) vals.push(pen(q - 5, r - 5));
    base.map = { size, values: vals, best: [0, 0], current: [clamp(l.alignmentX || 0, -5, 5), clamp(l.alignmentY || 0, -5, 5)] };
    base.snr = cd.peakVel / Math.max(1e-3, cd.noise * 0.2);
    base.summary = [`Best return ${Math.max(...vals).toFixed(0)}% at the centre (0, 0) with focus 0.`, `Current beam: X ${(l.alignmentX || 0).toFixed(1)}, Y ${(l.alignmentY || 0).toFixed(1)}, focus ${(l.focus || 0).toFixed(1)} gives ${cd.returnPct.toFixed(0)}%.`, s.failures?.ldvMisalign ? 'The misalignment fault removes 65 points of return: clear it or press Auto-align.' : 'Press Auto-align to move the beam to the best spot.'];
  }
  const [v, text] = verdict(base.snr); base.verdict = v; base.verdictText = text;
  const w = why(); if (w.length && v !== 'good') base.summary.push(...w.map(x => `Why: ${x}`));
  return base;
}

/** Why a running scan cannot make progress right now (empty string when it can). */
export function stallReason(s: any): string {
  const l = s.ldv, c = s.chamber, st = s.stage;
  if (!s.facility?.power) return 'Facility power is off.';
  if (!l.power) return 'The LDV is switched off.';
  if (!l.shutter) return 'The laser shutter is closed.';
  if (c.doorOpen) return 'The chamber door is open (laser interlock).';
  if ((l.opticalQuality ?? 100) < 20) return 'The optical return is too weak (under 20%).';
  if (st?.moving) return 'The stage is moving, so the laser spot is not steady.';
  return '';
}

export const LDV_ABOUT = {
  what: 'A Laser Doppler Vibrometer measures how fast a surface is moving by bouncing a laser off it. When the surface moves toward or away from the beam, the returned light is shifted slightly in colour (the Doppler effect). The instrument turns that shift into a velocity, without touching the object.',
  howHere: 'Here the beam comes down through the top window of the chamber onto the copper-plated sphere. The scanning mirrors can steer the spot over the sphere so one laser can map the whole surface.',
  does: [
    'Measures surface velocity or displacement without any contact — nothing is attached to the sphere that could change its resonance.',
    'Maps the whole sphere in 3D: which parts move, in what pattern (the mode shape).',
    'Reads the vibration spectrum at a single point: resonant frequency, sharpness (Q), signal-to-noise.',
    'Measures the ring-down after excitation, which shows how much the surroundings damp the sphere (vacuum versus air).',
    'Checks the room: its noise floor reveals hum, pump and floor vibration.',
    'Follows the location effect: scans taken at different stage positions show whether the resonance moves.',
    'Helps you align the optics: the return-strength map finds the best beam position.',
  ],
  limits: [
    'It needs a clear line of sight through the top window and a reflective surface; a weak return (poor alignment) ruins the data.',
    'It only measures motion along the beam direction (here: mostly up and down).',
    'The laser is Class 2 (633 nm); the shutter must be open and the door closed.',
    'In this simulator every result is generated by a teaching model, so it shows how a real instrument behaves, not real measurements.',
  ],
  parts: ['Laser head', 'Scanning mirrors', 'Interferometer', 'Velocity decoder', 'Controller & software'],
};

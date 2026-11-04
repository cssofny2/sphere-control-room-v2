// Oscilloscope signal model. Every channel looks at one real signal inside the lab (RF monitor, LDV decoder output,
// the 10 MHz clock, a room probe, a table accelerometer, the stage servo). The waveform is computed from the live
// simulation state, so switching a pump, the Faraday cage, isolation, the laser or the clock visibly changes the screen.
// Pure functions only: the reducer's tick calls `acquireScope`, the UI calls `fft`, `measureTrace` and the scenarios.

export type ChannelId = 'ch1' | 'ch2' | 'ch3' | 'ch4';
export type ScopeSource = 'rf_monitor' | 'ldv_output' | 'clock_reference' | 'environmental_probe' | 'accelerometer' | 'stage_servo';
export type TriggerState = 'triggered' | 'auto' | 'armed' | 'stopped' | 'unstable';

export const CHANNELS: ChannelId[] = ['ch1', 'ch2', 'ch3', 'ch4'];
export const CH_COLOR: Record<ChannelId, string> = { ch1: '#ffe066', ch2: '#22d3ee', ch3: '#f472b6', ch4: '#4ade80' };
/** µs per division. 0.1 µs/div resolves the 10 MHz clock; 20 ms/div shows 60 Hz mains hum. */
export const SCOPE_TIMEBASES = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
export const SCOPE_VOLTS = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2];
export const SAMPLES = 1000;
export const DIVS_X = 10;
export const DIVS_Y = 8;

export const SCOPE_SOURCES: Record<ScopeSource, { label: string; where: string; desc: string; probe: string }> = {
  rf_monitor: { label: 'RF monitor', where: 'VNA → chamber feedthrough', probe: 'Directional-coupler tap on the RF line', desc: 'The RF test tone the analyzer is sending to the sphere. Use it to confirm the drive is present and at the frequency you expect.' },
  ldv_output: { label: 'LDV output', where: 'Vibrometer decoder', probe: 'BNC from the LDV decoder analog output', desc: 'The vibrometer’s velocity signal. It carries the sphere’s own vibration at its resonance, and gets noisy when the optical return is weak.' },
  clock_reference: { label: '10 MHz reference', where: 'Rubidium clock output', probe: 'Tee on the 10 MHz distribution cable', desc: 'The shared clock. A clean, steady 10 MHz square wave means every instrument agrees on time; a wobbling one means a bad lock.' },
  environmental_probe: { label: 'Room probe', where: 'Sensor beside the chamber', probe: 'Pickup antenna and pressure/temperature sensor line', desc: 'Picks up what the room is doing: 60 Hz mains hum when shielding is off, pump pulses and turbo whine, slow temperature ripple.' },
  accelerometer: { label: 'Table accelerometer', where: 'Optical table', probe: 'Piezo accelerometer on the table top', desc: 'Feels vibration of the table. Footsteps, pumps and the stage show up here, and vanish when the isolation platform is floating.' },
  stage_servo: { label: 'Stage servo drive', where: 'XYZ stage controller', probe: 'Monitor output of the stage amplifier', desc: 'The motor drive of the XYZ stage. It bursts when the stage moves and rings down when it settles.' },
};

export type ChannelCfg = { enabled: boolean; scale: number; offset: number; coupling: 'DC' | 'AC'; source: ScopeSource };
export type Measurement = { vpp: number; vmax: number; vmin: number; vrms: number; vmean: number; freq: number | null; period: number | null; dense: boolean };
export type ScopeAcq = {
  channelTraces: Record<ChannelId, number[]>;
  trace: { t: number; value: number }[];
  triggerState: TriggerState;
  measure: Record<ChannelId, Measurement | null>;
  acqCount: number;
  sampleRate: number;
  triggerFound: boolean;
};

const TAU = Math.PI * 2;
const hash = (n: number) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const clampN = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

type Src = { at: (t: number, i: number, acq: number) => number; amp: number; noise: number; freq: number | null; offset: number };

/** How noisy is the room right now? Shared by every source so the cause is the same everywhere. */
export function roomConditions(s: any) {
  const c = s.chamber, f = s.failures || {}, m = s.model || {};
  return {
    emi: ((!c.faraday && m.rfNoise !== false) || !!f.emiSpike) ? 1 : 0.05,
    emiSpike: !!f.emiSpike,
    shake: (!c.isolation && m.vibration !== false) ? 1 : 0.05,
    turbo: clampN((c.turboRpm || 0) / 100, 0, 1),
    rough: clampN((c.roughingRpm || 0) / 100, 0, 1),
    drift: Math.abs((c.temperature ?? 20) - (c.targetTemp ?? 20)),
    moving: !!s.stage?.moving, settling: !!s.stage?.settling, settleAge: s.stage?.settleTime || 0, speed: Math.abs(s.stage?.velocity || 0),
  };
}

function makeSource(s: any, source: ScopeSource, f0: number): Src {
  const r = roomConditions(s), power = !!s.facility?.power;
  const nz = (i: number, acq: number) => hash(i * 7.31 + acq * 1.713) - 0.5;
  switch (source) {
    case 'rf_monitor': {
      const on = power && s.vna?.power && s.vna?.rf, f = s.vna?.center || 230500;
      const dbm = s.vna?.sourcePowerDbm ?? -10, A = on ? clampN(0.5 * Math.pow(10, (dbm + 10) / 20), 0.02, 2) : 0;
      const noise = (power ? 0.006 : 0) + 0.05 * r.emi * (on ? 1 : 0.6);
      return { amp: A, noise, freq: on ? f : null, offset: 0,
        at: (t, i, acq) => A * Math.sin(TAU * f * t) * (1 + 0.04 * Math.sin(TAU * 1200 * t)) + noise * nz(i, acq) * 2 + 0.07 * r.emi * Math.sin(TAU * 60 * t) };
    }
    case 'ldv_output': {
      const on = power && s.ldv?.power && s.ldv?.shutter, q = on ? clampN((s.ldv?.opticalQuality ?? 100) / 100, 0, 1) : 0;
      const A = on ? 0.35 * q * (1 - 0.35 * r.shake) : 0, noise = (power ? 0.004 : 0) + (on ? 0.22 * (1 - q) + 0.05 * r.shake : 0);
      return { amp: A, noise, freq: on ? f0 : null, offset: 0,
        at: (t, i, acq) => {
          const speckle = q < 0.45 ? 0.45 + 0.55 * Math.abs(Math.sin(TAU * 2300 * t + acq)) : 1;
          return A * speckle * (Math.sin(TAU * f0 * t) + 0.12 * Math.sin(TAU * 2 * f0 * t + 1.1)) + noise * nz(i, acq) * 2;
        } };
    }
    case 'clock_reference': {
      const ck = s.clock || {}, on = power && ck.power, locked = on && ck.locked && !ck.cableFault && !(s.failures || {}).clockDrift;
      const A = !on ? 0 : ck.cableFault ? 0.18 : ck.locked ? 0.5 : 0.35, wander = !on ? 0 : locked ? 0.015 : 0.9;
      return { amp: A, noise: on ? (locked ? 0.004 : 0.04) : 0, freq: on ? 1e7 : null, offset: A,
        at: (t, i, acq) => A + A * Math.tanh(3 * Math.sin(TAU * 1e7 * t + wander * Math.sin(TAU * 1800 * t + acq * 0.37) + wander * 0.6 * nz(i, acq))) + (on ? 0.006 : 0) * nz(i, acq) };
    }
    case 'environmental_probe': {
      const hum = 0.32 * r.emi + (r.emiSpike ? 0.25 : 0), A = hum + 0.06 * r.turbo + 0.1 * r.rough + 0.08 * r.drift;
      return { amp: A, noise: 0.01 + 0.06 * r.emi, freq: r.emi > 0.5 ? 60 : r.rough > 0.1 ? 25 : r.turbo > 0.1 ? 1200 : null, offset: 0,
        at: (t, i, acq) => hum * (Math.sin(TAU * 60 * t) + 0.3 * Math.sin(TAU * 180 * t + 0.6)) + 0.06 * r.turbo * (Math.sin(TAU * 1200 * t) + 0.4 * Math.sin(TAU * 2400 * t))
          + 0.1 * r.rough * Math.pow(Math.abs(Math.sin(TAU * 12.5 * t)), 5) * 2 * (Math.sin(TAU * 25 * t) > 0 ? 1 : -1) + 0.08 * r.drift * Math.sin(TAU * 0.4 * t)
          + (0.012 + 0.07 * r.emi) * nz(i, acq) * 2 };
    }
    case 'accelerometer': {
      const sh = r.shake, A = 0.35 * sh + 0.06 * r.turbo + 0.08 * r.rough + (r.moving ? 0.3 : 0), foot = (t: number) => Math.pow(Math.max(0, Math.sin(TAU * 0.23 * t)), 8);
      return { amp: A, noise: 0.01 + 0.03 * sh, freq: sh > 0.5 ? 8 : r.rough > 0.1 ? 25 : r.turbo > 0.1 ? 1200 : null, offset: 0,
        at: (t, i, acq) => sh * (0.3 * Math.sin(TAU * 8 * t) + 0.18 * Math.sin(TAU * 31 * t + 0.7) + 0.12 * Math.sin(TAU * 47 * t)) + 0.5 * sh * foot(t) * Math.sin(TAU * 13 * t)
          + 0.06 * r.turbo * Math.sin(TAU * 1200 * t) + 0.08 * r.rough * Math.sin(TAU * 25 * t) + (r.moving ? 0.3 * Math.sin(TAU * 140 * t) * (0.6 + 0.4 * Math.sin(TAU * 9 * t)) : 0)
          + (r.settling ? 0.12 * Math.exp(-r.settleAge * 3) * Math.sin(TAU * 60 * t) : 0) + (0.01 + 0.03 * sh) * nz(i, acq) * 2 };
    }
    case 'stage_servo': {
      const mv = power ? clampN(r.speed / 14, 0, 1) : 0, A = r.moving ? 0.2 + 0.7 * mv : r.settling ? 0.12 : 0;
      return { amp: A, noise: power ? 0.006 : 0, freq: r.settling ? 220 : r.moving ? 3000 : null, offset: r.moving ? 0.4 * mv : 0,
        at: (t, i, acq) => (power ? 0.4 * mv + 0.3 * mv * Math.sin(TAU * 3000 * t) + 0.1 * mv * Math.sin(TAU * 410 * t + 0.3) : 0)
          + (r.settling ? 0.12 * Math.exp(-r.settleAge * 3) * Math.sin(TAU * 220 * t) : 0) + (power ? 0.006 : 0) * nz(i, acq) * 2 };
    }
  }
}

export function measureTrace(v: number[], dtSec: number, nominal: number | null, dense: boolean): Measurement | null {
  if (!v.length) return null;
  let mx = -Infinity, mn = Infinity, sum = 0;
  for (const x of v) { if (x > mx) mx = x; if (x < mn) mn = x; sum += x; }
  const mean = sum / v.length; let sq = 0; for (const x of v) sq += (x - mean) * (x - mean);
  let freq: number | null = null;
  if (dense) freq = nominal;
  else if (mx - mn > 1e-3) {
    const mid = (mx + mn) / 2, hyst = (mx - mn) * 0.08, ups: number[] = []; let armed = v[0] < mid - hyst;
    for (let i = 1; i < v.length; i++) {
      if (armed && v[i] >= mid + hyst) { const f = (mid - v[i - 1]) / ((v[i] - v[i - 1]) || 1); ups.push(i - 1 + clampN(f, 0, 1)); armed = false; }
      else if (v[i] < mid - hyst) armed = true;
    }
    if (ups.length >= 2) freq = (ups.length - 1) / ((ups[ups.length - 1] - ups[0]) * dtSec);
  }
  return { vpp: mx - mn, vmax: mx, vmin: mn, vrms: Math.sqrt(sq / v.length), vmean: mean, freq, period: freq ? 1 / freq : null, dense };
}

/** Radix-2 FFT of up to 1024 samples (Hann window). Returns single-sided magnitude in dB relative to 1 V. */
export function fft(samples: number[], sampleRate: number): { f: number[]; db: number[]; peakF: number; peakDb: number } {
  const n = 1024, re = new Array<number>(n).fill(0), im = new Array<number>(n).fill(0);
  let mean = 0; const len = Math.min(n, samples.length); for (let i = 0; i < len; i++) mean += samples[i]; mean /= Math.max(1, len);
  for (let i = 0; i < len; i++) re[i] = (samples[i] - mean) * (0.5 - 0.5 * Math.cos((TAU * i) / (len - 1 || 1)));
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let size = 2; size <= n; size <<= 1) {
    const ang = -TAU / size, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += size) { let cr = 1, ci = 0; for (let k = 0; k < size / 2; k++) { const a = i + k, b = a + size / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } }
  }
  const f: number[] = [], db: number[] = []; let peakF = 0, peakDb = -200;
  for (let k = 1; k < n / 2; k++) {
    const mag = (2 * Math.hypot(re[k], im[k])) / (len * 0.5), d = 20 * Math.log10(Math.max(mag, 1e-7));
    const fr = (k * sampleRate) / n; f.push(fr); db.push(d); if (d > peakDb) { peakDb = d; peakF = fr; }
  }
  return { f, db, peakF, peakDb };
}

const emptyTraces = (): Record<ChannelId, number[]> => ({ ch1: [], ch2: [], ch3: [], ch4: [] });
const emptyMeasure = (): Record<ChannelId, Measurement | null> => ({ ch1: null, ch2: null, ch3: null, ch4: null });
const triggerChannel = (src: string): ChannelId => String(src).toLowerCase() as ChannelId;

/**
 * Capture one screen. `absTime` is the simulation time in seconds, `f0` the sphere resonance in Hz.
 * With a trigger the waveform is drawn from the trigger crossing (steady picture); free-running it slides.
 */
export function acquireScope(s: any, absTime: number, f0: number, previous?: Partial<ScopeAcq>): ScopeAcq {
  const sc = s.scope, N = SAMPLES, T = DIVS_X * sc.timebase * 1e-6, dt = T / (N - 1), acq = (sc.acqCount || 0) + 1;
  const cfg = (sc.channels || {}) as Record<ChannelId, ChannelCfg>;
  const mode: 'auto' | 'normal' | 'single' = sc.holdMode || 'auto';
  const tid = triggerChannel(sc.triggerSource || 'CH1'), tcfg = cfg[tid];
  const hold = (state: TriggerState): ScopeAcq => ({
    channelTraces: (previous?.channelTraces as any) || emptyTraces(), trace: (previous?.trace as any) || [], triggerState: state,
    measure: (previous?.measure as any) || emptyMeasure(), acqCount: sc.acqCount || 0, sampleRate: (N - 1) / T, triggerFound: false,
  });
  // search buffer: 2 screens long so a crossing can be centred
  let start = Math.floor(N / 2), triggered = false, unstable = false, state: TriggerState = 'auto';
  const srcs: Partial<Record<ChannelId, Src>> = {};
  for (const id of CHANNELS) if (cfg[id]?.enabled || id === tid) srcs[id] = makeSource(s, cfg[id]?.source || 'rf_monitor', f0);
  if (tcfg && srcs[tid]) {
    const src = srcs[tid]!, lvl = sc.triggerLevel ?? 0, rising = (sc.triggerSlope || 'rising') === 'rising';
    const buf: number[] = new Array(2 * N); let mean = 0;
    for (let i = 0; i < 2 * N; i++) { buf[i] = src.at(absTime + i * dt, i, acq); mean += buf[i]; } mean /= 2 * N;
    const adj = tcfg.coupling === 'AC' ? mean : 0, L = lvl + adj;
    for (let i = Math.floor(N / 2) + 1; i < Math.floor(1.5 * N); i++) {
      if (rising ? (buf[i - 1] < L && buf[i] >= L) : (buf[i - 1] > L && buf[i] <= L)) { start = i - Math.floor(N / 2); triggered = true; break; }
    }
    const noiseDominated = src.amp < 2.5 * src.noise && Math.abs(lvl) < 3 * src.noise;
    unstable = triggered && noiseDominated;
    // a dense (aliased) signal cannot give a stable trigger on screen
    if (src.freq && src.freq * dt > 0.3) unstable = true;
  }
  if (!triggered && mode !== 'auto') return hold('armed');
  state = triggered ? (unstable ? 'unstable' : 'triggered') : 'auto';
  const channelTraces = emptyTraces(), measure = emptyMeasure();
  for (const id of CHANNELS) {
    const c = cfg[id], src = srcs[id]; if (!c?.enabled || !src) continue;
    const dense = !!(src.freq && src.freq * dt > 0.3);
    const out = new Array<number>(N); let mean = 0;
    for (let i = 0; i < N; i++) {
      const j = start + i;
      out[i] = dense ? src.offset + src.amp * (i % 2 ? 1 : -1) * (0.86 + 0.14 * hash(i * 3.7 + acq)) + src.noise * (hash(i + acq) - 0.5) : src.at(absTime + j * dt, j, acq);
      mean += out[i];
    }
    mean /= N; if (c.coupling === 'AC') for (let i = 0; i < N; i++) out[i] -= mean;
    channelTraces[id] = out; measure[id] = measureTrace(out, dt, src.freq, dense);
  }
  const first = CHANNELS.find(id => channelTraces[id].length) as ChannelId | undefined;
  const trace = Array.from({ length: 250 }, (_, i) => ({ t: i, value: first ? channelTraces[first][i * 4] : 0 }));
  return { channelTraces, trace, triggerState: state, measure, acqCount: acq, sampleRate: (N - 1) / T, triggerFound: triggered };
}

/** Pick sensible volts/div and timebase for what each channel currently shows (the AUTOSET button). */
export function autoset(s: any, f0: number): { timebase: number; channels: Record<ChannelId, Partial<ChannelCfg>>; triggerSource: string; triggerLevel: number } {
  const cfg = s.scope.channels as Record<ChannelId, ChannelCfg>, channels: Record<ChannelId, Partial<ChannelCfg>> = { ch1: {}, ch2: {}, ch3: {}, ch4: {} };
  let tb = s.scope.timebase, lead: ChannelId | null = null, best = 0;
  for (const id of CHANNELS) {
    const c = cfg[id]; if (!c?.enabled) continue;
    const src = makeSource(s, c.source, f0);
    const want = clampN(src.amp * 2 + src.noise, 0.005, 4) / (DIVS_Y * 0.7);
    channels[id].scale = SCOPE_VOLTS.find(v => v >= want) || 2; channels[id].offset = 0;
    if (src.freq && src.amp > best) { best = src.amp; lead = id; tb = SCOPE_TIMEBASES.find(t => (DIVS_X * t * 1e-6) * src.freq! >= 4) || tb; }
  }
  const lc = lead ? cfg[lead] : null, lsrc = lc ? makeSource(s, lc.source, f0) : null;
  return { timebase: tb, channels, triggerSource: lead ? lead.toUpperCase() : 'CH1', triggerLevel: lsrc && lc ? Math.round((lc.coupling === 'AC' ? 0 : lsrc.offset) * 1000) / 1000 : 0 };
}

/* ───────── Scenarios ───────── */
export type Prereq = { label: string; ok: (s: any) => boolean; fix?: { domain: string; patch: Record<string, any> } };
export type ScopeScenario = {
  id: string; title: string; icon: 'rf' | 'clock' | 'hum' | 'floor' | 'pump' | 'laser' | 'trigger' | 'stage';
  goal: string; why: string; steps: string[]; expect: string[]; tryThis: string;
  setup: Record<string, any>; channelSetup: Partial<Record<ChannelId, Partial<ChannelCfg>>>;
  prereq: Prereq[]; check: (s: any) => boolean; checkText: string;
};

const ch = (source: ScopeSource, scale: number, coupling: 'AC' | 'DC' = 'AC'): Partial<ChannelCfg> => ({ enabled: true, source, scale, coupling, offset: 0 });
const off = (): Partial<ChannelCfg> => ({ enabled: false });
const need = {
  power: { label: 'Main breaker closed', ok: (s: any) => !!s.facility.power },
  scope: { label: 'Oscilloscope powered on', ok: (s: any) => !!s.scope.power, fix: { domain: 'scope', patch: { power: true, running: true } } },
  rf: { label: 'VNA on with RF output', ok: (s: any) => !!(s.vna.power && s.vna.rf), fix: { domain: 'vna', patch: { power: true, rf: true } } },
  laser: { label: 'LDV on, shutter open', ok: (s: any) => !!(s.ldv.power && s.ldv.shutter), fix: { domain: 'ldv', patch: { power: true, shutter: true } } },
  clock: { label: 'Rubidium clock on', ok: (s: any) => !!s.clock.power, fix: { domain: 'clock', patch: { power: true } } },
  pumps: { label: 'Roughing pump running', ok: (s: any) => !!s.chamber.roughing, fix: { domain: 'chamber', patch: { vent: false, roughing: true } } },
};

export const SCOPE_SCENARIOS: ScopeScenario[] = [
  {
    id: 'rf-drive', title: 'Confirm the RF drive', icon: 'rf',
    goal: 'Check that the analyzer really is sending its test tone into the chamber, and at the right frequency.',
    why: 'If the VNA says RF is on but the line is silent (loose connector, wrong power), every S11 trace is meaningless. The scope is the quickest independent check.',
    steps: ['Press “Apply scope setup”.', 'Read the frequency in the Measurements table for CH1.', 'Change the VNA centre frequency on the VNA page and watch CH1 follow it.'],
    expect: ['A clean sine wave of about 230.5 kHz.', 'Frequency reading within a fraction of a percent of the VNA centre frequency.', 'Amplitude rises and falls with the VNA source power.'],
    tryThis: 'Switch the Faraday cage off: a 60 Hz ripple rides on the sine as radio noise leaks in.',
    setup: { timebase: 10, triggerSource: 'CH1', triggerLevel: 0, triggerSlope: 'rising', holdMode: 'auto', fftEnabled: false }, channelSetup: { ch1: ch('rf_monitor', 0.2), ch2: off(), ch3: off(), ch4: off() },
    prereq: [need.power, need.scope, need.rf], check: s => !!(s.vna.power && s.vna.rf && s.scope.channels.ch1.enabled && s.scope.channels.ch1.source === 'rf_monitor'), checkText: 'RF is on and CH1 is watching the RF monitor.',
  },
  {
    id: 'clock-check', title: 'Check the 10 MHz reference', icon: 'clock',
    goal: 'See whether the clock that every instrument shares is clean and locked.',
    why: 'A wobbling reference blurs every frequency reading by a few hertz — the same size as the effect the experiment hunts for.',
    steps: ['Power the clock if it is off.', 'Apply the scope setup (100 ns per division).', 'Watch the edges while the clock warms up, then after it reports LOCKED.'],
    expect: ['Locked: sharp square wave with crisp, steady edges.', 'Warming up: smaller, blurred edges that wander.', 'Cable fault or drift fault: low amplitude or a smeared trace.'],
    tryThis: 'Inject “Rubidium clock drift” in the Fault Injector and compare the edges.',
    setup: { timebase: 0.1, triggerSource: 'CH3', triggerLevel: 0.5, triggerSlope: 'rising', holdMode: 'auto', fftEnabled: false }, channelSetup: { ch1: off(), ch2: off(), ch3: ch('clock_reference', 0.2, 'DC'), ch4: off() },
    prereq: [need.power, need.scope, need.clock], check: s => !!(s.clock.power && s.clock.locked && s.scope.channels.ch3.enabled), checkText: 'Clock is locked and CH3 shows it.',
  },
  {
    id: 'emi-hunt', title: 'Hunt for 60 Hz interference', icon: 'hum',
    goal: 'Find out whether mains hum is getting into the experiment, and prove the Faraday cage stops it.',
    why: 'Electrical interference adds noise to the S11 trace and to the vibrometer. The cage is supposed to remove it; the room probe shows whether it does.',
    steps: ['Apply the setup (5 ms per division on the room probe).', 'Turn the Faraday cage OFF on the 3D Chamber page.', 'Come back and measure the frequency, then turn the cage back ON.'],
    expect: ['Cage on: a nearly flat noisy line.', 'Cage off: a big sine wave measuring about 60 Hz.', 'The FFT peak sits at 60 Hz with harmonics at 180 Hz.'],
    tryThis: 'Turn on FFT view: a tall spike at 60 Hz is the signature of mains pickup.',
    setup: { timebase: 5000, triggerSource: 'CH4', triggerLevel: 0, triggerSlope: 'rising', holdMode: 'auto', fftEnabled: false }, channelSetup: { ch1: off(), ch2: off(), ch3: off(), ch4: ch('environmental_probe', 0.1) },
    prereq: [need.power, need.scope], check: s => !s.chamber.faraday && s.scope.channels.ch4.enabled && s.scope.channels.ch4.source === 'environmental_probe', checkText: 'Cage is off and CH4 is on the room probe (hum visible).',
  },
  {
    id: 'floor', title: 'Is the table really floating?', icon: 'floor',
    goal: 'Use the table accelerometer to see floor vibration and check that the isolation platform removes it.',
    why: 'Footsteps and building vibration shake the sphere and appear as noise in the vibrometer. The isolation platform is the cure.',
    steps: ['Apply the setup (20 ms per division on the accelerometer).', 'Switch vibration isolation OFF on the chamber page.', 'Return and compare, then switch it back ON.'],
    expect: ['Isolation on: small hiss only.', 'Isolation off: slow 8 Hz sway with larger bursts every few seconds (footfalls).'],
    tryThis: 'Start the turbo pump with isolation on: a faint 1.2 kHz line appears in the FFT even though the table is floating.',
    setup: { timebase: 20000, triggerSource: 'CH4', triggerLevel: 0, triggerSlope: 'rising', holdMode: 'auto', fftEnabled: false }, channelSetup: { ch1: off(), ch2: off(), ch3: off(), ch4: ch('accelerometer', 0.2) },
    prereq: [need.power, need.scope], check: s => !s.chamber.isolation && s.scope.channels.ch4.source === 'accelerometer', checkText: 'Isolation is off and CH4 shows the accelerometer.',
  },
  {
    id: 'pump-signature', title: 'Read the pump signatures', icon: 'pump',
    goal: 'Recognise each pump by its vibration “fingerprint” and see how much it disturbs the experiment.',
    why: 'A running pump adds vibration that the vibrometer can pick up. Knowing the fingerprint helps decide when to pause pumping for a clean measurement.',
    steps: ['Start the roughing pump, then apply the setup.', 'Look at CH1 (accelerometer) at 5 ms/div for the 25 Hz pulses.', 'Start the turbo and use FFT to find the 1.2 kHz whine.'],
    expect: ['Roughing pump: regular pulses 25 times a second.', 'Turbo pump: a fast whine at 1.2 kHz, rising with rotor speed.'],
    tryThis: 'Stop the pumps and watch the lines disappear from the FFT.',
    setup: { timebase: 5000, triggerSource: 'CH1', triggerLevel: 0, triggerSlope: 'rising', holdMode: 'auto', fftEnabled: true }, channelSetup: { ch1: ch('accelerometer', 0.1), ch2: off(), ch3: off(), ch4: off() },
    prereq: [need.power, need.scope, need.pumps], check: s => !!(s.chamber.roughing && (s.chamber.roughingRpm || 0) > 20 && s.scope.channels.ch1.source === 'accelerometer'), checkText: 'The roughing pump is running and the accelerometer is on CH1.',
  },
  {
    id: 'ldv-chain', title: 'Check the vibrometer signal chain', icon: 'laser',
    goal: 'Confirm the vibrometer is producing a strong signal at the sphere’s resonance.',
    why: 'The LDV output is the raw measurement of sphere vibration. If it is weak or noisy, a 3D scan will be poor.',
    steps: ['Open the LDV shutter, then apply the setup.', 'Read CH2 frequency; it should match the sphere resonance.', 'Open the LDV page and spoil the alignment; watch the amplitude fall and the noise rise.'],
    expect: ['Good alignment: a strong ~230 kHz sine.', 'Poor alignment: smaller, hissy, with dropouts (laser speckle).', 'Moving the stage along X shifts the frequency slightly.'],
    tryThis: 'Compare CH1 (RF monitor) and CH2 (LDV): same frequency means the sphere is vibrating at the drive tone.',
    setup: { timebase: 10, triggerSource: 'CH2', triggerLevel: 0, triggerSlope: 'rising', holdMode: 'auto', fftEnabled: false }, channelSetup: { ch1: ch('rf_monitor', 0.2), ch2: ch('ldv_output', 0.1), ch3: off(), ch4: off() },
    prereq: [need.power, need.scope, need.rf, need.laser], check: s => !!(s.ldv.power && s.ldv.shutter && s.scope.channels.ch2.source === 'ldv_output' && s.scope.channels.ch2.enabled), checkText: 'The laser is on and CH2 shows the LDV output.',
  },
  {
    id: 'trigger', title: 'Trigger practice', icon: 'trigger',
    goal: 'Learn what the trigger does by breaking it on purpose and fixing it.',
    why: 'A scope only draws a steady picture when it knows where a wave “starts”. Understanding triggers prevents “my screen is frozen” confusion.',
    steps: ['Apply the setup (Normal mode, level 0.2 V on the RF monitor).', 'Raise the trigger level above the wave’s height. The screen freezes with “Armed”.', 'Lower the level or switch to Auto to recover.'],
    expect: ['Level inside the wave: stable picture, “Trig’d”.', 'Level above the wave in Normal mode: picture freezes, status Armed (the scope is Stuck, waiting).', 'Auto mode: picture keeps drawing but slides, status Auto.'],
    tryThis: 'Switch the slope to Falling: the picture shifts by half a cycle.',
    setup: { timebase: 10, triggerSource: 'CH1', triggerLevel: 0.2, triggerSlope: 'rising', holdMode: 'normal', fftEnabled: false }, channelSetup: { ch1: ch('rf_monitor', 0.2), ch2: off(), ch3: off(), ch4: off() },
    prereq: [need.power, need.scope, need.rf], check: s => s.scope.holdMode === 'normal' && s.scope.triggerSource === 'CH1' && s.scope.channels.ch1.source === 'rf_monitor', checkText: 'Normal trigger mode is set on the RF monitor.',
  },
  {
    id: 'stage-move', title: 'Catch a stage move', icon: 'stage',
    goal: 'Capture the stage motor burst with a single shot, then watch the stage ring down.',
    why: 'The stage must be fully settled before a measurement. The servo drive and accelerometer show exactly when motion starts and stops.',
    steps: ['Apply the setup (single shot, servo on CH1, accelerometer on CH2).', 'Press Run to arm, then move the stage on the 3D Chamber page.', 'The scope captures the burst and stops.'],
    expect: ['A burst of drive on CH1 while the stage moves.', 'A damped ring-down on CH2 afterwards.', 'The longer the ring-down, the longer you must wait before recording.'],
    tryThis: 'Inject “Stage backlash”: the ring-down never fully dies away.',
    setup: { timebase: 50000, triggerSource: 'CH1', triggerLevel: 0.15, triggerSlope: 'rising', holdMode: 'single', fftEnabled: false }, channelSetup: { ch1: ch('stage_servo', 0.5, 'DC'), ch2: ch('accelerometer', 0.2), ch3: off(), ch4: off() },
    prereq: [need.power, need.scope], check: s => s.scope.holdMode === 'single' && s.scope.channels.ch1.source === 'stage_servo', checkText: 'Single-shot is armed on the stage servo.',
  },
];

export const SCOPE_SCENARIO_BY_ID = Object.fromEntries(SCOPE_SCENARIOS.map(x => [x.id, x])) as Record<string, ScopeScenario>;

/** Build the PATCH that applies a scenario's setup to the scope. */
export function scenarioPatch(s: any, sc: ScopeScenario): Record<string, any> {
  const channels: Record<string, ChannelCfg> = {};
  for (const id of CHANNELS) channels[id] = { ...(s.scope.channels[id] as ChannelCfg), ...(sc.channelSetup[id] || {}) } as ChannelCfg;
  return { ...sc.setup, channels, scenario: sc.id, running: true, scale: channels.ch1.scale, cursorA: null, cursorB: null };
}

export const SCOPE_USES = [
  { title: 'Is the RF really there?', body: 'Watch the exact tone the analyzer sends to the sphere, independent of what the VNA display claims.' },
  { title: 'Is the clock clean?', body: 'The 10 MHz reference must be crisp and steady; the scope shows its edges directly.' },
  { title: 'Where is the noise coming from?', body: 'Mains hum, pumps, footsteps and the stage motor all have different fingerprints on the room probe and accelerometer.' },
  { title: 'Is the laser signal healthy?', body: 'The vibrometer output tells you how strong the sphere’s vibration is before any scan is attempted.' },
  { title: 'When has the stage settled?', body: 'Servo drive and accelerometer ring-down tell you how long to wait before recording.' },
];

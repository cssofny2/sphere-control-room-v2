// The teaching model of the S.P.H.E.R.E. resonator: where the resonance sits for a given lab state, and the
// noisy S11 trace a VNA would draw for it. Pure functions of state, so they can be tested, fitted and replayed
// without the UI. Simulator output is illustrative and is not experimental evidence.

export const BASE_FREQUENCY = 230500;
/** Teaching-model location sensitivity (Hz per mm). Shown to students only when the blind (hidden truth) mode is off. */
/** Teaching-model temperature sensitivity (Hz per °C above 20 °C). Used by the thermal lesson; not shown in blind mode. */
export const THERMAL_HZ_PER_C = 5;
export const LOCATION_HZ_PER_MM = { x: 45.2, y: -12.5, z: 80.1 } as const;

export interface ModelEffects {
  location?: boolean; temperature?: boolean; pressure?: boolean; clockDrift?: boolean;
  fixtureDrift?: boolean; rfNoise?: boolean;
}

/** The slice of simulator state the resonance model reads. The full app state satisfies this structurally. */
export interface ModelState {
  stage: { x: number; y: number; z: number; actualX?: number; actualY?: number; actualZ?: number };
  chamber: { temperature: number; pressure: number; faraday: boolean };
  model: ModelEffects;
  clock: { locked: boolean; cableFault?: boolean };
  failures: { clockDrift?: boolean; emiSpike?: boolean };
}

export interface SweepSettings {
  center?: number; span?: number; startFrequency: number; stopFrequency: number; points: number;
  sweepMode?: string; ifbw?: number; averagingEnabled?: boolean; averagingCount?: number;
  traceMath?: string; reference?: ReadonlyArray<{ s11: number }>;
}

export interface SweepState extends ModelState {
  vna: SweepSettings;
  facility: { seed: number; simulationTime: number };
}

/** One VNA trace point. `s11` is what the screen shows (after any trace math); `raw` is the measured value before it. */
export interface TracePoint { freq: number; s11: number; raw: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function noise(i: number, seed: number): number {
  const x = Math.sin((i + 1) * 12.9898 + seed * 0.12345) * 43758.5453;
  return x - Math.floor(x);
}

export function trueFrequency(state: ModelState): number {
  const { stage, chamber, model, clock, failures } = state;
  const loc = model.location ? (stage.actualX ?? stage.x) * LOCATION_HZ_PER_MM.x + (stage.actualY ?? stage.y) * LOCATION_HZ_PER_MM.y + (stage.actualZ ?? stage.z) * LOCATION_HZ_PER_MM.z : 0;
  const thermal = model.temperature ? (chamber.temperature - 20) * THERMAL_HZ_PER_C : 0;
  const air = model.pressure ? (chamber.pressure > 1 ? -250 : -Math.log10(Math.max(chamber.pressure, 1e-8)) * .3) : 0;
  const clockDrift = (model.clockDrift && (!clock.locked || clock.cableFault)) || failures.clockDrift ? 15.5 : 0;
  const fixture = model.fixtureDrift ? (stage.x * .2) + (stage.z * .25) : 0;
  return BASE_FREQUENCY + loc + thermal + air + clockDrift + fixture;
}

export function buildSweep(state: SweepState): TracePoint[] {
  const resonance = trueFrequency(state);
  const { vna, chamber, facility, failures, clock } = state;
  const q = chamber.pressure > 1 ? 1200 : 4500;
  const rfNoise = (state.model.rfNoise && !chamber.faraday) || failures.emiSpike ? 4.5 : .18;
  const clockNoise = clock.locked && !clock.cableFault && !failures.clockDrift ? .02 : 1.2;
  const n = Math.max(101, Math.min(1001, vna.points));

  let start = vna.startFrequency;
  let stop = vna.stopFrequency;
  if (vna.center && vna.span) {
    start = vna.center - vna.span / 2;
    stop = vna.center + vna.span / 2;
  }

  return Array.from({ length: n }, (_, i) => {
    let f = start + (i / (n - 1)) * (stop - start);
    if (vna.sweepMode === "log") {
      const logStart = Math.log10(Math.max(1000, start));
      const logStop = Math.log10(Math.max(2000, stop));
      f = Math.pow(10, logStart + (i / (n - 1)) * (logStop - logStart));
    }
    const normalized = 2 * (f - resonance) / (resonance / q);
    const dip = -28 / (1 + normalized * normalized);
    const averagingGain = vna.averagingEnabled ? Math.sqrt(Math.max(1, vna.averagingCount ?? 1)) : 1;
    const bandwidthGain = Math.sqrt(clamp((vna.ifbw || 100) / 100, 0.01, 10));
    const jitter = (noise(i + facility.simulationTime * 7, facility.seed) - .5) * (rfNoise + clockNoise) * bandwidthGain / averagingGain;
    const raw = -2 + dip + jitter;
    let s11Val = raw;

    if (vna.traceMath === "ref" && vna.reference && vna.reference.length === n) {
      s11Val = vna.reference[i].s11;
    } else if (vna.traceMath === "diff" && vna.reference && vna.reference.length === n) {
      s11Val = s11Val - vna.reference[i].s11;
    } else if (vna.traceMath === "ratio" && vna.reference && vna.reference.length === n) {
      s11Val = s11Val / (vna.reference[i].s11 || 1);
    }

    return { freq: f, s11: s11Val, raw };
  });
}

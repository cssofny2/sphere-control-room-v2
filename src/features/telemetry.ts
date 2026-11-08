// Telemetry for the live timeline: a bounded ring of one-per-simulated-second samples, event markers, downsampling for
// plotting and a CSV export. Pure functions plus one small ring class; nothing here touches the UI.

export interface Sample {
  /** Simulation time in seconds. */
  readonly t: number;
  readonly pressureTorr: number;
  readonly temperatureC: number;
  /** Fitted resonance of the live trace, or null when the VNA is off or the fit failed. */
  readonly f0Hz: number | null;
  readonly x: number; readonly y: number; readonly z: number;
  readonly turboPct: number;
}
export const RING_CAPACITY = 3600;
export const SAMPLE_INTERVAL_S = 1;

export class Ring {
  private buf: Sample[] = [];
  constructor(readonly capacity = RING_CAPACITY) {}
  get length() { return this.buf.length; }
  /** True when a sample at time `t` would be kept, so callers can skip the work of making one. */
  due(t: number): boolean { const last = this.buf[this.buf.length - 1]; return !last || t < last.t || t - last.t >= SAMPLE_INTERVAL_S; }
  /** Adds a sample if it is at least one interval after the last; a time that goes backwards (breaker reset) clears the ring. */
  push(s: Sample): boolean {
    const last = this.buf[this.buf.length - 1];
    if (last && s.t < last.t) this.buf = [];
    else if (last && s.t - last.t < SAMPLE_INTERVAL_S) return false;
    this.buf.push(s);
    if (this.buf.length > this.capacity) this.buf.splice(0, this.buf.length - this.capacity);
    return true;
  }
  toArray(): readonly Sample[] { return this.buf; }
  clear() { this.buf = []; }
}

/** The slice of simulator state a sample is read from. */
export interface SampleState {
  facility: { simulationTime: number };
  chamber: { pressure: number; temperature: number; turboRpm?: number };
  stage: { x: number; y: number; z: number; actualX?: number; actualY?: number; actualZ?: number };
}
export function sampleOf(s: SampleState, f0Hz: number | null): Sample {
  return {
    t: s.facility.simulationTime, pressureTorr: s.chamber.pressure, temperatureC: s.chamber.temperature, f0Hz,
    x: s.stage.actualX ?? s.stage.x, y: s.stage.actualY ?? s.stage.y, z: s.stage.actualZ ?? s.stage.z, turboPct: s.chamber.turboRpm ?? 0,
  };
}

/**
 * Reduces `points` to at most `max` for plotting. Each bucket keeps its first, lowest and highest value of `key`, so short
 * spikes (a pressure burst, a resonance jump) survive. The first and last points are always kept.
 */
export function downsample(points: readonly Sample[], max: number, key: (s: Sample) => number | null): Sample[] {
  if (points.length <= max || max < 4) return points.slice(0, Math.max(max, 0) || points.length);
  const per = Math.ceil(points.length / Math.floor((max - 2) / 3));
  const out: Sample[] = [points[0]];
  for (let i = 1; i < points.length - 1; i += per) {
    const b = points.slice(i, Math.min(i + per, points.length - 1));
    let lo = b[0], hi = b[0];
    for (const p of b) { const v = key(p); if (v === null) continue; const l = key(lo), h = key(hi); if (l === null || v < l) lo = p; if (h === null || v > h) hi = p; }
    const picked = [...new Set([b[0], lo, hi])].sort((a, c) => a.t - c.t);
    out.push(...picked);
  }
  out.push(points[points.length - 1]);
  return out;
}

export type MarkerKind = 'alarm' | 'action' | 'measurement';
export interface Marker { readonly t: number; readonly kind: MarkerKind; readonly label: string }
export interface MarkerEvent { readonly simulationTime?: number; readonly level?: string; readonly subsystem?: string; readonly text?: string }
export interface MarkerRecord { readonly id?: string; readonly resonance?: number; readonly contract?: { readonly simulationTime?: number } | null }

/** Alarms and warnings, operator and system actions, and recorded measurements, on the simulation clock, oldest first. */
export function markersFrom(events: readonly MarkerEvent[], records: readonly MarkerRecord[], from = -Infinity, to = Infinity): Marker[] {
  const out: Marker[] = [];
  for (const e of events) {
    if (typeof e.simulationTime !== 'number' || !Number.isFinite(e.simulationTime)) continue;
    if (e.subsystem === 'VNA' && /^Sweep (acquisition started|complete)/.test(e.text ?? '')) continue;
    out.push({ t: e.simulationTime, kind: e.level === 'warning' || e.level === 'critical' ? 'alarm' : 'action', label: `${e.subsystem ?? 'SYSTEM'}: ${e.text ?? ''}`.slice(0, 120) });
  }
  records.forEach((r, i) => {
    const t = r.contract?.simulationTime;
    if (typeof t === 'number' && Number.isFinite(t)) out.push({ t, kind: 'measurement', label: `Measurement ${typeof r.resonance === 'number' ? r.resonance.toFixed(2) + ' Hz' : `#${records.length - i}`}` });
  });
  return out.filter(m => m.t >= from && m.t <= to).sort((a, b) => a.t - b.t);
}

/** Nearest sample at or before time `t` (what the lab read at that moment), or null before the first sample. */
export function sampleAt(points: readonly Sample[], t: number): Sample | null {
  let lo = 0, hi = points.length - 1, best: Sample | null = null;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (points[mid].t <= t) { best = points[mid]; lo = mid + 1; } else hi = mid - 1; }
  return best;
}

const csvCell = (v: unknown) => { const t = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
export function telemetryCsv(points: readonly Sample[], markers: readonly Marker[] = []): string {
  const rows: unknown[][] = [['sim_time_s', 'pressure_torr', 'temperature_c', 'f0_hz', 'x_mm', 'y_mm', 'z_mm', 'turbo_pct', 'marker']];
  let mi = 0;
  for (const p of points) {
    const here: string[] = [];
    while (mi < markers.length && markers[mi].t <= p.t) { here.push(`${markers[mi].kind}: ${markers[mi].label}`); mi++; }
    rows.push([p.t, p.pressureTorr, p.temperatureC, p.f0Hz, p.x, p.y, p.z, p.turboPct, here.join(' | ')]);
  }
  return rows.map(r => r.map(csvCell).join(',')).join('\n');
}

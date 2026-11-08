// Display units. The simulator always works in Torr, °C and Hz; these helpers only change what is shown.
export type PressureUnit = 'Torr' | 'Pa' | 'mbar';
export type TempUnit = '°C' | 'K' | '°F';
export interface UnitPrefs { readonly pressure: PressureUnit; readonly temperature: TempUnit }
export const DEFAULT_UNITS: UnitPrefs = { pressure: 'Torr', temperature: '°C' };
export const PRESSURE_UNITS: readonly PressureUnit[] = ['Torr', 'Pa', 'mbar'];
export const TEMP_UNITS: readonly TempUnit[] = ['°C', 'K', '°F'];

const PA_PER_TORR = 101325 / 760;
export function fromTorr(torr: number, unit: PressureUnit): number { return unit === 'Pa' ? torr * PA_PER_TORR : unit === 'mbar' ? torr * PA_PER_TORR / 100 : torr; }
export function toTorr(v: number, unit: PressureUnit): number { return unit === 'Pa' ? v / PA_PER_TORR : unit === 'mbar' ? v * 100 / PA_PER_TORR : v; }
export function fromCelsius(c: number, unit: TempUnit): number { return unit === 'K' ? c + 273.15 : unit === '°F' ? c * 9 / 5 + 32 : c; }
export function toCelsius(v: number, unit: TempUnit): number { return unit === 'K' ? v - 273.15 : unit === '°F' ? (v - 32) * 5 / 9 : v; }

export const fmtPressure = (torr: number | null | undefined, unit: PressureUnit): string => (typeof torr === 'number' && Number.isFinite(torr) ? `${fromTorr(torr, unit).toExponential(2)} ${unit}` : '–');
export const fmtTemperature = (c: number | null | undefined, unit: TempUnit, digits = 2): string => (typeof c === 'number' && Number.isFinite(c) ? `${fromCelsius(c, unit).toFixed(digits)} ${unit}` : '–');

/** Accepts anything (stored JSON, a bad edit) and returns valid preferences. */
export function sanitizeUnits(raw: unknown): UnitPrefs {
  const o = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {};
  return { pressure: PRESSURE_UNITS.includes(o.pressure as PressureUnit) ? o.pressure as PressureUnit : DEFAULT_UNITS.pressure, temperature: TEMP_UNITS.includes(o.temperature as TempUnit) ? o.temperature as TempUnit : DEFAULT_UNITS.temperature };
}

const KEY = 'sphere-lab-units-v1';
let current: UnitPrefs = DEFAULT_UNITS, loaded = false;
const subs = new Set<() => void>();
function load() { if (loaded) return; loaded = true; try { current = sanitizeUnits(JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null')); } catch { current = DEFAULT_UNITS; } }
export function getUnits(): UnitPrefs { load(); return current; }
export function setUnits(patch: Partial<UnitPrefs>): void { load(); current = sanitizeUnits({ ...current, ...patch }); try { globalThis.localStorage?.setItem(KEY, JSON.stringify(current)); } catch { /* storage may be blocked */ } subs.forEach(f => f()); }
export function subscribeUnits(f: () => void): () => void { subs.add(f); return () => { subs.delete(f); }; }

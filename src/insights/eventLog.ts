// Filtering and CSV export for the operations journal.
export interface LogEvent { readonly time?: string; readonly simulationTime?: number; readonly subsystem?: string; readonly level?: string; readonly text?: string; readonly operator?: string; readonly iso?: string }
export interface LogFilter { readonly levels?: readonly string[]; readonly subsystem?: string; readonly query?: string; readonly fromSimS?: number; readonly toSimS?: number }

/** Events matching every part of the filter. Search is case-insensitive over subsystem, text and operator. */
export function filterEvents<T extends LogEvent>(events: readonly T[], f: LogFilter): T[] {
  const q = (f.query ?? '').trim().toLowerCase();
  return events.filter(e => {
    if (f.levels && f.levels.length && !f.levels.includes(e.level ?? 'info')) return false;
    if (f.subsystem && e.subsystem !== f.subsystem) return false;
    const t = e.simulationTime;
    if (f.fromSimS !== undefined && !(typeof t === 'number' && t >= f.fromSimS)) return false;
    if (f.toSimS !== undefined && !(typeof t === 'number' && t <= f.toSimS)) return false;
    if (q && !`${e.subsystem ?? ''} ${e.text ?? ''} ${e.operator ?? ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
export const subsystemsOf = (events: readonly LogEvent[]): string[] => [...new Set(events.map(e => e.subsystem).filter((s): s is string => !!s))].sort();
export function countByLevel(events: readonly LogEvent[]): Record<string, number> { const c: Record<string, number> = {}; for (const e of events) { const l = e.level ?? 'info'; c[l] = (c[l] ?? 0) + 1; } return c; }

// Cells starting with = + - @ are prefixed so a spreadsheet cannot read them as formulas.
const cell = (v: unknown) => { let t = v === null || v === undefined ? '' : String(v); if (/^[=+\-@\t\r]/.test(t) && !/^-?\d+(\.\d+)?$/.test(t)) t = `'${t}`; return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
export function eventsCsv(events: readonly LogEvent[]): string {
  return [['sim_time_s', 'time', 'iso_timestamp', 'level', 'subsystem', 'operator', 'message'], ...events.map(e => [e.simulationTime, e.time, e.iso, e.level, e.subsystem, e.operator, e.text])].map(r => r.map(cell).join(',')).join('\n');
}

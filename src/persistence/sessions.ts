// Pure helpers for saving a lab session and archiving runs. No storage or UI in here, so they are easy to test.

export const SESSION_VERSION = 1;
/** Soft cap on records kept in the ledger; the old hard cap was 200. */
export const MAX_RECORDS = 50_000;
export const MAX_NOTES = 300;
export const UNRECORDED = 'UNRECORDED';

export interface SavedRecord { id: string; runId: string; timestamp?: string; x: number; y: number; z: number; resonance: number; [k: string]: unknown }
export interface SessionSnapshot { version: typeof SESSION_VERSION; savedAt: string; records: SavedRecord[]; notebook: Array<Record<string, unknown>> }
export interface RunArchive { version: typeof SESSION_VERSION; runId: string; savedAt: string; records: SavedRecord[] }
export interface RunSummary { runId: string; count: number; first: string | null; last: string | null; savedAt: string }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function isSavedRecord(v: unknown): v is SavedRecord {
  return isObj(v) && typeof v.id === 'string' && typeof v.runId === 'string' && fin(v.x) && fin(v.y) && fin(v.z) && fin(v.resonance);
}

/** Records are kept newest first, like the ledger. Duplicates (same id) keep the incoming copy. */
export function mergeRecords(existing: readonly SavedRecord[], incoming: readonly SavedRecord[], max = MAX_RECORDS): SavedRecord[] {
  const byId = new Map<string, SavedRecord>();
  for (const r of existing) byId.set(r.id, r);
  for (const r of incoming) byId.set(r.id, r);
  return [...byId.values()].sort((a, b) => String(b.timestamp ?? '').localeCompare(String(a.timestamp ?? ''))).slice(0, max);
}

export function groupByRun(records: readonly SavedRecord[]): Map<string, SavedRecord[]> {
  const out = new Map<string, SavedRecord[]>();
  for (const r of records) { const g = out.get(r.runId); if (g) g.push(r); else out.set(r.runId, [r]); }
  return out;
}

export const archiveKey = (runId: string) => `run:${runId}`;

export function makeSnapshot(records: readonly SavedRecord[], notebook: ReadonlyArray<Record<string, unknown>>, now = new Date()): SessionSnapshot {
  return { version: SESSION_VERSION, savedAt: now.toISOString(), records: records.slice(0, MAX_RECORDS), notebook: notebook.slice(0, MAX_NOTES) };
}

/** Validates stored data; anything malformed or from an unknown version yields null rather than a crash. */
export function parseSnapshot(raw: unknown): SessionSnapshot | null {
  if (!isObj(raw) || raw.version !== SESSION_VERSION || typeof raw.savedAt !== 'string') return null;
  if (!Array.isArray(raw.records) || !Array.isArray(raw.notebook) || raw.records.length > MAX_RECORDS || raw.notebook.length > MAX_NOTES) return null;
  return { version: SESSION_VERSION, savedAt: raw.savedAt, records: raw.records.filter(isSavedRecord), notebook: raw.notebook.filter(isObj) };
}

export function parseArchive(raw: unknown): RunArchive | null {
  if (!isObj(raw) || raw.version !== SESSION_VERSION || typeof raw.runId !== 'string' || typeof raw.savedAt !== 'string' || !Array.isArray(raw.records)) return null;
  return { version: SESSION_VERSION, runId: raw.runId, savedAt: raw.savedAt, records: raw.records.filter(isSavedRecord) };
}

export function summarizeArchive(a: RunArchive): RunSummary {
  const times = a.records.map(r => r.timestamp).filter((t): t is string => typeof t === 'string').sort();
  return { runId: a.runId, count: a.records.length, first: times[0] ?? null, last: times[times.length - 1] ?? null, savedAt: a.savedAt };
}

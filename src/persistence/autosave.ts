import type { KV } from './store';
import { MAX_RECORDS, SESSION_VERSION, archiveKey, groupByRun, makeSnapshot, mergeRecords, parseArchive, type SavedRecord } from './sessions';

export interface AutosaveSource { records: SavedRecord[]; notebook: Array<Record<string, unknown>> }

/**
 * Debounced saver. Each flush writes the session snapshot and merges every run's records into the run library, which
 * only grows: clearing the ledger or cycling the breaker never deletes an archived run, only the user can.
 */
export function createAutosave(kv: KV, read: () => AutosaveSource, delayMs = 800) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const written = new Map<string, number>();
  let busy: Promise<void> = Promise.resolve();
  const run = async () => {
    const { records, notebook } = read();
    for (const [runId, group] of groupByRun(records)) {
      if (written.get(runId) === group.length) continue;
      const old = parseArchive(await kv.get(archiveKey(runId)));
      const merged = mergeRecords(old?.records ?? [], group, MAX_RECORDS);
      await kv.set(archiveKey(runId), { version: SESSION_VERSION, runId, savedAt: new Date().toISOString(), records: merged });
      written.set(runId, group.length);
    }
    await kv.set('session', makeSnapshot(records, notebook));
  };
  const flush = () => { if (timer) { clearTimeout(timer); timer = null; } busy = busy.then(run).catch(() => undefined); return busy; };
  return {
    schedule() { if (timer) clearTimeout(timer); timer = setTimeout(() => { timer = null; void flush(); }, delayMs); },
    flush,
    cancel() { if (timer) { clearTimeout(timer); timer = null; } },
  };
}

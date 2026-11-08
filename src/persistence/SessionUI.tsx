import { useEffect, useState } from 'react';
import { getKV, type KV } from './store';
import { archiveKey, parseArchive, parseSnapshot, summarizeArchive, UNRECORDED, type RunSummary, type SavedRecord, type SessionSnapshot } from './sessions';

type Dispatch = (a: { type: string; [k: string]: unknown }) => void;
const when = (iso: string | null) => { if (!iso) return '–'; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '–' : d.toLocaleString(); };
const short = (id: string) => (id === UNRECORDED ? 'Manual captures' : id.replace(/^run-/, '').slice(0, 8));

/** Offers to bring back the last saved session. Autosave is held back until the person answers. */
export function SessionRestore({ dispatch, onResolved }: { dispatch: Dispatch; onResolved: (kv: KV | null) => void }) {
  const [offer, setOffer] = useState<{ kv: KV; snap: SessionSnapshot } | null>(null);
  useEffect(() => {
    let live = true;
    getKV().then(async kv => {
      const snap = parseSnapshot(await kv.get('session'));
      if (!live) return;
      if (snap && (snap.records.length || snap.notebook.length)) setOffer({ kv, snap }); else onResolved(kv);
    }).catch(() => live && onResolved(null));
    return () => { live = false; };
  }, []);
  if (!offer) return null;
  const answer = (resume: boolean) => {
    if (resume) dispatch({ type: 'RESTORE_SESSION', records: offer.snap.records, notebook: offer.snap.notebook });
    onResolved(offer.kv); setOffer(null);
  };
  const { snap } = offer;
  return (
    <div role="alertdialog" aria-label="Resume saved session" className="mx-3 mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-sky-500/40 bg-sky-950/60 p-3 text-xs text-sky-100">
      <div className="flex-1 min-w-[220px]">
        <div className="font-bold">Resume your last session?</div>
        <div className="text-sky-200/80">Saved {when(snap.savedAt)} in this browser: {snap.records.length} measurements, {snap.notebook.length} notebook entries.</div>
      </div>
      <button onClick={() => answer(true)} className="rounded border border-sky-400 bg-sky-700 px-3 py-1.5 font-bold text-white hover:bg-sky-600">Resume</button>
      <button onClick={() => answer(false)} className="rounded border border-zinc-600 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800">Start fresh</button>
    </div>
  );
}

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Every run saved in this browser. Loading a run adds its records to the ledger. */
export function RunLibrary({ dispatch, refreshKey }: { dispatch: Dispatch; refreshKey: number }) {
  const [rows, setRows] = useState<RunSummary[] | null>(null);
  const [tick, setTick] = useState(0);
  const [kind, setKind] = useState('');
  useEffect(() => {
    let live = true;
    // Autosave writes about a second after a change, so look a little later.
    const wait = new Promise(r => setTimeout(r, tick === 0 ? 1300 : 0));
    wait.then(getKV).then(async kv => {
      const out: RunSummary[] = [];
      for (const k of await kv.keys('run:')) { const a = parseArchive(await kv.get(k)); if (a) out.push(summarizeArchive(a)); }
      out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      if (live) { setRows(out); setKind(kv.kind); }
    }).catch(() => live && setRows([]));
    return () => { live = false; };
  }, [refreshKey, tick]);
  const act = async (runId: string, what: 'load' | 'export' | 'delete') => {
    const kv = await getKV(), a = parseArchive(await kv.get(archiveKey(runId)));
    if (!a) return;
    if (what === 'load') dispatch({ type: 'RESTORE_SESSION', records: a.records as SavedRecord[], notebook: [] });
    else if (what === 'export') download(`${runId}.json`, a);
    else { await kv.del(archiveKey(runId)); setTick(t => t + 1); }
  };
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl">
      <div className="text-xs font-bold uppercase text-zinc-300 border-b border-zinc-800 pb-2 mb-1">Run library</div>
      <p className="mb-2 text-[11px] text-zinc-500">Runs are saved automatically in this browser{kind === 'memory' ? ' (storage is blocked here, so they last only until you close the page)' : ''}. They stay after you clear the ledger or switch the breaker off.</p>
      <div className="max-h-[220px] overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-zinc-950 text-[10px] uppercase tracking-wider text-zinc-500"><tr><th className="p-2">Run</th><th className="p-2">Records</th><th className="p-2">Last measurement</th><th className="p-2" /></tr></thead>
          <tbody>
            {rows?.length ? rows.map(r => (
              <tr key={r.runId} className="border-t border-zinc-900">
                <td className="p-2 font-mono text-sky-200" title={r.runId}>{short(r.runId)}</td>
                <td className="p-2 font-mono">{r.count}</td>
                <td className="p-2 text-zinc-400">{when(r.last)}</td>
                <td className="p-2 whitespace-nowrap text-right">
                  <button onClick={() => act(r.runId, 'load')} className="mr-1 rounded border border-zinc-600 px-2 py-0.5 hover:bg-zinc-800">Load</button>
                  <button onClick={() => act(r.runId, 'export')} className="mr-1 rounded border border-zinc-600 px-2 py-0.5 hover:bg-zinc-800">Export</button>
                  <button onClick={() => act(r.runId, 'delete')} aria-label={`Delete run ${short(r.runId)}`} className="rounded border border-rose-700 px-2 py-0.5 text-rose-200 hover:bg-rose-900">Delete</button>
                </td>
              </tr>
            )) : <tr><td colSpan={4} className="p-5 text-center text-zinc-500">{rows ? 'No saved runs yet. Measurements are saved as you take them.' : 'Loading…'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

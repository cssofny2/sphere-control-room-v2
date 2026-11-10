import { useRef, useState } from 'react';
import { autoMap, csvToRecords, MAX_BUNDLE_BYTES, MAX_CSV_BYTES, parseCsv, validateBundle, CSV_FIELDS, type BundleIssue, type BundleRecord, type CsvField } from '../domain/bundle';
import { replayAll, type ReplaySummary } from '../simulation/replay';

type Dispatch = (a: { type: string; [k: string]: unknown }) => void;
type Preview =
  | { kind: 'bundle'; name: string; records: BundleRecord[]; notebook: Array<Record<string, unknown>>; warnings: string[]; replay: ReplaySummary; created: string; version: string }
  | { kind: 'csv'; name: string; rows: string[][]; map: Partial<Record<CsvField, number>> }
  | { kind: 'error'; name: string; issues: BundleIssue[] };

/** Import button and preview dialog for .sphere.json bundles and CSV files. Nothing is added until the person confirms. */
export function BundleImport({ dispatch }: { dispatch: Dispatch }) {
  const input = useRef<HTMLInputElement>(null);
  const [p, setP] = useState<Preview | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const isCsv = /\.csv$/i.test(file.name);
    if (file.size > (isCsv ? MAX_CSV_BYTES : MAX_BUNDLE_BYTES)) { setP({ kind: 'error', name: file.name, issues: [{ path: '(file)', message: 'The file is too large.' }] }); return; }
    const text = await file.text();
    if (isCsv) { const rows = parseCsv(text); setP({ kind: 'csv', name: file.name, rows, map: autoMap(rows[0] ?? []) }); return; }
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { setP({ kind: 'error', name: file.name, issues: [{ path: '(file)', message: 'Not valid JSON.' }] }); return; }
    const res = await validateBundle(raw, file.size);
    if ('issues' in res) { setP({ kind: 'error', name: file.name, issues: [...res.issues] }); return; }
    const b = res.bundle;
    setP({ kind: 'bundle', name: file.name, records: [...b.records], notebook: [...b.notebook], warnings: [...res.warnings], replay: replayAll(b.records as never), created: b.createdAt, version: b.app.version });
  };
  const close = () => { setP(null); if (input.current) input.current.value = ''; };

  const csv = p?.kind === 'csv' ? csvToRecords(p.rows, p.map, `IMPORTED-${new Date().toISOString().slice(0, 16)}`, `import-${Date.now().toString(36)}`) : null;
  const confirm = () => {
    if (p?.kind === 'bundle') dispatch({ type: 'RESTORE_SESSION', records: p.records, notebook: p.notebook, origin: 'IMPORTED' });
    else if (csv) dispatch({ type: 'RESTORE_SESSION', records: csv.records, notebook: [], origin: 'IMPORTED' });
    close();
  };
  const count = p?.kind === 'bundle' ? p.records.length : csv?.records.length ?? 0;

  return (
    <>
      <input ref={input} type="file" accept=".json,.csv,application/json,text/csv" className="sr-only" aria-label="Choose a bundle or CSV file to import" onChange={e => void onFile(e.target.files?.[0])} />
      <button onClick={() => input.current?.click()} className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-700">Import…</button>
      {p && (
        <div role="dialog" aria-modal="true" aria-label="Import preview" className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" onKeyDown={e => e.key === 'Escape' && close()}>
          <div className="max-h-[85vh] w-full max-w-xl overflow-auto rounded-lg border border-zinc-700 bg-zinc-950 p-4 text-xs text-zinc-200 shadow-2xl">
            <div className="text-sm font-bold">Import {p.name}</div>
            {p.kind === 'error' && (<>
              <p className="mt-2 text-rose-300" role="alert">This file was not imported.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">{p.issues.slice(0, 12).map((i, k) => <li key={k}><span className="font-mono text-zinc-400">{i.path}</span> {i.message}</li>)}</ul>
            </>)}
            {p.kind === 'bundle' && (<>
              <p className="mt-2 text-emerald-300">Checksum verified. {p.records.length} measurements, {p.notebook.length} notebook entries. Exported {new Date(p.created).toLocaleString()} by app {p.version}.</p>
              {p.warnings.map((w, k) => <p key={k} className="mt-1 text-amber-300">{w}</p>)}
              <p className="mt-2">Re-check: <b>{p.replay.match}</b> reproduce from their saved settings, <b className={p.replay.differs ? 'text-amber-300' : ''}>{p.replay.differs}</b> differ, {p.replay.skipped} cannot be checked{p.replay.differs ? ` (largest difference ${p.replay.maxDeltaHz.toFixed(3)} Hz)` : ''}. This checks the recorded numbers; it is not a full replay of the run.</p>
            </>)}
            {p.kind === 'csv' && csv && (<>
              <p className="mt-2 text-zinc-400">Match each field to a column. x, y, z and resonance are required.</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {CSV_FIELDS.map(f => (
                  <label key={f} className="flex items-center justify-between gap-2">{f}
                    <select value={p.map[f] ?? ''} onChange={e => setP({ ...p, map: { ...p.map, [f]: e.target.value === '' ? undefined : Number(e.target.value) } })} className="w-40 rounded border border-zinc-700 bg-zinc-900 p-1">
                      <option value="">(none)</option>
                      {(p.rows[0] ?? []).map((h, i) => <option key={i} value={i}>{h || `column ${i + 1}`}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <p className="mt-2">{csv.records.length} of {Math.max(0, p.rows.length - 1)} rows are usable. Imported rows are marked as imported, with no capture settings.</p>
              {csv.issues.slice(0, 6).map((i, k) => <p key={k} className="text-amber-300"><span className="font-mono">{i.path}</span> {i.message}</p>)}
              {csv.records.slice(0, 3).map(r => <div key={r.id} className="font-mono text-zinc-400">{r.x}, {r.y}, {r.z} mm → {r.resonance} Hz</div>)}
            </>)}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={close} className="rounded border border-zinc-600 px-3 py-1.5 hover:bg-zinc-800">{p.kind === 'error' ? 'Close' : 'Cancel'}</button>
              {p.kind !== 'error' && <button onClick={confirm} disabled={!count} className="rounded border border-sky-400 bg-sky-700 px-3 py-1.5 font-bold text-white hover:bg-sky-600 disabled:opacity-40">Add {count} to the ledger</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

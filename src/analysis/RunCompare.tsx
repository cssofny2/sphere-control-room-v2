import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getKV } from '../persistence/store';
import { parseArchive, UNRECORDED } from '../persistence/sessions';
import { compareRuns, type CompareRecord } from './compare';

const COLORS = ['#5fd4ff', '#ffb347', '#e879f9', '#86efac'];
const MAX_RUNS = 4;
const short = (id: string) => (id === UNRECORDED ? 'Manual captures' : id.replace(/^run-/, '').slice(0, 8));

/** Compare saved runs (and the current ledger): overlay of resonance by position, per-position differences, conditions. */
export function RunCompare({ ledger, refreshKey }: { ledger: CompareRecord[]; refreshKey: number }) {
  const [saved, setSaved] = useState<Array<{ runId: string; records: CompareRecord[] }>>([]);
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    new Promise(r => setTimeout(r, 1400)).then(getKV).then(async kv => {
      const out: Array<{ runId: string; records: CompareRecord[] }> = [];
      for (const k of await kv.keys('run:')) { const a = parseArchive(await kv.get(k)); if (a) out.push({ runId: a.runId, records: a.records as CompareRecord[] }); }
      if (live) setSaved(out);
    }).catch(() => undefined);
    return () => { live = false; };
  }, [refreshKey]);

  // Saved runs plus any run only present in the ledger (not archived yet).
  const options = useMemo(() => {
    const m = new Map(saved.map(s => [s.runId, s.records]));
    const byRun = new Map<string, CompareRecord[]>();
    for (const r of ledger) { const id = String((r as { runId?: string }).runId ?? UNRECORDED); (byRun.get(id) ?? byRun.set(id, []).get(id)!).push(r); }
    byRun.forEach((v, id) => { if (!m.has(id) || (m.get(id)?.length ?? 0) < v.length) m.set(id, v); });
    return [...m].map(([runId, records]) => ({ runId, records }));
  }, [saved, ledger]);

  const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : p.length < MAX_RUNS ? [...p, id] : p));
  const runs = picked.map(id => options.find(o => o.runId === id)).filter((o): o is NonNullable<typeof o> => !!o).map(o => ({ label: short(o.runId), records: o.records }));
  const cmp = useMemo(() => compareRuns(runs), [picked, options]);

  const chart = cmp.rows.map(r => ({ pos: r[cmp.axis], ...Object.fromEntries(cmp.labels.map((l, i) => [l, r.cells[i]?.meanHz ?? null])) }));
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl">
      <div className="text-xs font-bold uppercase text-zinc-300 border-b border-zinc-800 pb-2 mb-2">Compare runs</div>
      {options.length < 2 ? <p className="text-[11px] text-zinc-500">Take measurements in at least two runs to compare them. The first run you pick is the baseline.</p> : (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Runs to compare (up to four; the first is the baseline)">
            {options.map(o => {
              const i = picked.indexOf(o.runId);
              return (
                <label key={o.runId} className={`flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-[11px] ${i >= 0 ? 'border-sky-400 bg-sky-950/50 text-sky-100' : 'border-zinc-700 text-zinc-300'}`}>
                  <input type="checkbox" checked={i >= 0} onChange={() => toggle(o.runId)} />
                  <span className="font-mono">{short(o.runId)}</span><span className="text-zinc-500">{o.records.length}</span>
                  {i >= 0 && <span className="font-bold" style={{ color: COLORS[i] }}>{i === 0 ? 'baseline' : `#${i + 1}`}</span>}
                </label>
              );
            })}
          </div>
          {runs.length >= 2 && (
            <div className="mt-3 space-y-3">
              <div className="h-[220px]" role="img" aria-label={`Resonance by ${cmp.axis} position for each selected run`}>
                <ResponsiveContainer>
                  <LineChart data={chart} margin={{ top: 8, right: 12, bottom: 16, left: 4 }}>
                    <CartesianGrid stroke="#142030" />
                    <XAxis type="number" dataKey="pos" domain={['dataMin', 'dataMax']} stroke="#6b7c90" fontSize={10} label={{ value: `${cmp.axis.toUpperCase()} (mm)`, position: 'insideBottom', offset: -8, fill: '#6b7c90', fontSize: 10 }} />
                    <YAxis domain={['auto', 'auto']} stroke="#6b7c90" fontSize={10} width={62} tickFormatter={v => Number(v).toFixed(1)} />
                    <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #24384c', fontSize: 11 }} formatter={(v: number) => `${Number(v).toFixed(3)} Hz`} labelFormatter={v => `${cmp.axis.toUpperCase()} ${v} mm`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {cmp.labels.map((l, i) => <Line key={l} dataKey={l} stroke={COLORS[i]} dot={{ r: 3 }} strokeWidth={1.6} connectNulls isAnimationActive={false} />)}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1 text-[11px] text-zinc-300">{cmp.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              {cmp.conditions.length > 0 && (
                <table className="w-full text-left text-[11px]">
                  <thead className="text-[10px] uppercase tracking-wider text-zinc-500"><tr><th className="p-1">Condition</th>{cmp.labels.map(l => <th key={l} className="p-1 font-mono">{l}</th>)}</tr></thead>
                  <tbody>{cmp.conditions.map(c => <tr key={c.name} className="border-t border-zinc-900"><td className="p-1 text-amber-300">{c.name}</td>{c.values.map((v, i) => <td key={i} className="p-1 font-mono">{v}</td>)}</tr>)}</tbody>
                </table>
              )}
              <div className="max-h-[260px] overflow-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-zinc-950 text-[10px] uppercase tracking-wider text-zinc-500">
                    <tr><th className="p-1">XYZ mm</th>{cmp.labels.map((l, i) => <th key={l} className="p-1 font-mono" style={{ color: COLORS[i] }}>{l} f₀ Hz</th>)}{cmp.labels.slice(1).map(l => <th key={'d' + l} className="p-1">Δ {l} (z)</th>)}</tr>
                  </thead>
                  <tbody>
                    {cmp.rows.map(r => (
                      <tr key={r.key} className="border-t border-zinc-900">
                        <td className="p-1 font-mono text-sky-200">{r.x.toFixed(1)}, {r.y.toFixed(1)}, {r.z.toFixed(1)}</td>
                        {r.cells.map((c, i) => <td key={i} className="p-1 font-mono">{c ? c.meanHz.toFixed(3) : '–'}</td>)}
                        {r.deltas.slice(1).map((d, i) => (
                          <td key={i} className={`p-1 font-mono ${d?.significant ? 'font-bold text-amber-300' : 'text-zinc-400'}`}>
                            {d ? `${d.deltaHz >= 0 ? '+' : ''}${d.deltaHz.toFixed(3)}${d.z !== null ? ` (${d.z.toFixed(1)})` : ''}${d.significant ? ' ▲' : ''}` : '–'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-zinc-500">z is the difference divided by the combined standard uncertainty of both means. ▲ marks |z| above 2. Uncertainty covers random noise only.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

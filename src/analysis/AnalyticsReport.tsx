import { useEffect, useMemo, useState } from 'react';
import { telemetrySnapshot } from '../features/Timeline';
import { getKV } from '../persistence/store';
import { parseArchive } from '../persistence/sessions';
import { makeAnalyticsReport, type AnalyticsRecord, type Dataset } from './analyticsReport';

export function AnalyticsReport({ records }: { records: (AnalyticsRecord & { runId?: string | null })[] }) {
  const [archives, setArchives] = useState<Dataset[]>([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [report, setReport] = useState('');
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const kv = await getKV();
        const result: Dataset[] = [];
        for (const key of await kv.keys('run:')) {
          const archive = parseArchive(await kv.get(key));
          if (archive) result.push({ id: archive.runId, records: archive.records });
        }
        if (active) { setArchives(result); setError(''); }
      } catch {
        if (active) setError('Saved runs could not be loaded. Current-session records remain available.');
      }
    })();
    return () => { active = false; };
  }, [records.length]);
  const datasets = useMemo(() => {
    const map = new Map(archives.map(a => [a.id, a]));
    const current = new Map<string, AnalyticsRecord[]>();
    for (const record of records) {
      const id = record.runId || 'Manual captures';
      const group = current.get(id) || [];
      group.push(record); current.set(id, group);
    }
    current.forEach((value, id) => {
      if (!map.has(id) || map.get(id)!.records.length < value.length) map.set(id, { id, records: value });
    });
    return [...map.values()];
  }, [archives, records]);
  return <section className="analytics-card" aria-label="Comparative analytics">
    <h2>Comparative analytics report</h2>
    <p>Choose saved or current runs. The first selected run is the comparison baseline. This local report uses descriptive rules, not an AI model.</p>
    {error && <p role="alert">{error}</p>}
    {!datasets.length && <p>No recorded runs are available yet.</p>}
    <div role="group" aria-label="Datasets to compare" className="analytics-choices">
      {datasets.map(d => <label key={d.id}><input type="checkbox" checked={selected.includes(d.id)} onChange={() => { setSelected(s => s.includes(d.id) ? s.filter(id => id !== d.id) : [...s, d.id]); setReport(''); }} /> {d.id} ({d.records.length})</label>)}
    </div>
    <button type="button" className="chrome-button" disabled={!selected.length} onClick={() => setReport(makeAnalyticsReport(selected.map(id => datasets.find(d => d.id === id)).filter((d): d is Dataset => !!d), telemetrySnapshot()))}>Generate report</button>
    {report && <pre className="analytics-report">{report}</pre>}
  </section>;
}

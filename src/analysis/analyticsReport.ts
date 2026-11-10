import type { Sample } from '../features/telemetry';

export interface AnalyticsRecord {
  resonance: number;
  excluded?: boolean;
  fit?: { ok: boolean } | null;
}
export interface Dataset {
  id: string;
  records: readonly AnalyticsRecord[];
}
export interface DatasetSummary {
  id: string;
  count: number;
  excluded: number;
  meanHz: number | null;
  rangeHz: number | null;
}

export function summarizeDataset(dataset: Dataset): DatasetSummary {
  const values = dataset.records.filter(r => !r.excluded && r.fit?.ok !== false && Number.isFinite(r.resonance)).map(r => r.resonance);
  return {
    id: dataset.id,
    count: values.length,
    excluded: dataset.records.length - values.length,
    meanHz: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
    rangeHz: values.length ? Math.max(...values) - Math.min(...values) : null,
  };
}

export function makeAnalyticsReport(datasets: readonly Dataset[], telemetry: readonly Sample[]): string {
  const summaries = datasets.map(summarizeDataset);
  const lines = [
    'S.P.H.E.R.E. educational analytics report',
    'Method: deterministic descriptive summaries; not an AI diagnosis or physical evidence.',
    `Selected datasets: ${summaries.length}.`,
  ];
  if (!summaries.length) lines.push('No datasets selected.');
  for (const s of summaries) {
    lines.push(`${s.id}: ${s.count} usable measurements; ${s.excluded} excluded or invalid. ${s.meanHz === null ? 'No usable resonance values.' : `Mean ${s.meanHz.toFixed(3)} Hz; range ${s.rangeHz!.toFixed(3)} Hz.`}`);
  }
  const base = summaries[0];
  if (base?.meanHz !== null && base?.meanHz !== undefined) {
    for (const s of summaries.slice(1)) {
      if (s.meanHz !== null) lines.push(`${s.id} versus ${base.id}: mean difference ${(s.meanHz - base.meanHz).toFixed(3)} Hz. This is descriptive, not a significance test.`);
    }
  }
  const temps = telemetry.map(s => s.temperatureC).filter(Number.isFinite);
  const freqs = telemetry.map(s => s.f0Hz).filter((v): v is number => v !== null && Number.isFinite(v));
  lines.push(`Current-session telemetry: ${telemetry.length} samples; ${freqs.length} fitted resonance readings.`);
  if (temps.length) lines.push(`Temperature range: ${Math.min(...temps).toFixed(3)}–${Math.max(...temps).toFixed(3)} °C.`);
  lines.push('Attention: check excluded records, data origin, instrument status and acquisition conditions before interpreting differences. Live telemetry is not attributed to the selected historical runs.');
  lines.push('No raw vibration waveform is available in this report; frequency values alone cannot recreate it.');
  return lines.join('\n');
}

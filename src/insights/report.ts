// A self-contained, printable lab report (one HTML file, no scripts, no external requests). Every value is escaped.
import type { BudgetRow } from './budget';
import type { ConformRow, Spec } from './conformance';
import type { RecordOutlier } from './outliers';

export interface ReportInput {
  readonly title: string; readonly generatedAt: string; readonly operator?: string; readonly runId?: string;
  readonly recordCount: number; readonly budget: readonly BudgetRow[]; readonly pooledSdHz: number | null;
  readonly outliers: readonly RecordOutlier[]; readonly spec?: Spec | null; readonly conformity?: readonly ConformRow[];
  readonly drift?: { verdict: string; slopeHzPerS: number | null } | null; readonly notes?: string;
}

export const escapeHtml = (v: unknown): string => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const num = (v: number | null | undefined, d = 3) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '–');

export function reportHtml(r: ReportInput): string {
  const rows = r.budget.map(b => `<tr><td>${escapeHtml(b.x)}, ${escapeHtml(b.y)}, ${escapeHtml(b.z)}</td><td>${b.n}</td><td>${num(b.meanHz)}</td><td>${num(b.repeatabilityHz)}</td><td>${num(b.fitHz)}</td><td>${num(b.standardHz)}</td><td>${b.k === null ? '–' : num(b.k, 2)}</td><td>${num(b.expandedHz)}</td><td>${escapeHtml(b.dominant)}</td></tr>`).join('');
  const out = r.outliers.length ? `<ul>${r.outliers.map(o => `<li>${escapeHtml(o.position)}: ${num(o.resonance)} Hz is ${num(o.score, 1)} robust deviations from the position median (${num(o.medianHz)} Hz).</li>`).join('')}</ul>` : '<p>No outliers flagged.</p>';
  const spec = r.spec && r.conformity ? `<h2>Conformity</h2><p>Target ${num(r.spec.targetHz)} Hz ± ${num(r.spec.toleranceHz)} Hz. Decision rule: pass only if the whole expanded interval is within the limits.</p><table><thead><tr><th>Position</th><th>Mean (Hz)</th><th>U (Hz)</th><th>Deviation (Hz)</th><th>Decision</th></tr></thead><tbody>${r.conformity.map(c => `<tr><td>${escapeHtml(c.key)}</td><td>${num(c.meanHz)}</td><td>${num(c.expandedHz)}</td><td>${num(c.deviationHz)}</td><td>${escapeHtml(c.decision)}</td></tr>`).join('')}</tbody></table>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(r.title)}</title><style>
body{font:14px/1.5 system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;color:#111}h1{font-size:1.5rem}h2{font-size:1.1rem;margin-top:1.6rem;border-bottom:1px solid #ccc}
table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #bbb;padding:3px 6px;text-align:right}th:first-child,td:first-child{text-align:left}.meta{color:#555}
@media print{body{margin:0}h2{break-after:avoid}tr{break-inside:avoid}}</style></head><body>
<h1>${escapeHtml(r.title)}</h1><p class="meta">Generated ${escapeHtml(r.generatedAt)}${r.operator ? ` by ${escapeHtml(r.operator)}` : ''}${r.runId ? ` · run ${escapeHtml(r.runId)}` : ''} · ${r.recordCount} record${r.recordCount === 1 ? '' : 's'} · simulated data</p>
<h2>Uncertainty budget</h2><p>Pooled repeatability: ${num(r.pooledSdHz)} Hz. Standard uncertainty is the larger of the repeatability and fit terms.</p>
<table><thead><tr><th>Position (mm)</th><th>n</th><th>Mean (Hz)</th><th>Repeatability (Hz)</th><th>Fit (Hz)</th><th>Standard (Hz)</th><th>k</th><th>Expanded U (Hz)</th><th>Dominant</th></tr></thead><tbody>${rows || '<tr><td colspan="9">No data</td></tr>'}</tbody></table>
<h2>Outlier screen</h2>${out}
${r.drift ? `<h2>Drift</h2><p>${escapeHtml(r.drift.verdict)}${r.drift.slopeHzPerS === null ? '' : ` (${num(r.drift.slopeHzPerS, 5)} Hz/s)`}</p>` : ''}${spec}
${r.notes ? `<h2>Notes</h2><p>${escapeHtml(r.notes).replace(/\n/g, '<br>')}</p>` : ''}</body></html>`;
}

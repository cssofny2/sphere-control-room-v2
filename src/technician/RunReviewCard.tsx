import { useMemo } from 'react';
import { reviewRun, type ReviewRecord, type Severity } from './reviewRun';

const STYLE: Record<Severity, { label: string; cls: string }> = {
  issue: { label: 'Problem', cls: 'border-rose-500/60 text-rose-200' },
  warn: { label: 'Check', cls: 'border-amber-500/60 text-amber-200' },
  info: { label: 'Note', cls: 'border-sky-500/50 text-sky-200' },
  good: { label: 'Good', cls: 'border-emerald-500/50 text-emerald-200' },
};

/** The same review Dr. Wire gives on the phone ("review my run"), shown as a list. Read-only. */
export function RunReviewCard({ records }: { records: ReviewRecord[] }) {
  const review = useMemo(() => reviewRun(records), [records]);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl">
      <div className="text-xs font-bold uppercase text-zinc-300 border-b border-zinc-800 pb-2 mb-2">Run review</div>
      <p className="mb-2 text-[11px] text-zinc-500">Computed from the recorded measurements. You can also phone Dr. Wire and say “review my run”.</p>
      <ul className="space-y-2">
        {review.findings.slice(0, 6).map(f => (
          <li key={f.id} className={`rounded border-l-4 bg-zinc-900/60 p-2 text-xs ${STYLE[f.severity].cls}`}>
            <div className="flex items-center gap-2"><span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-bold uppercase">{STYLE[f.severity].label}</span><span className="font-bold text-zinc-100">{f.title}</span></div>
            <p className="mt-1 text-zinc-300">{f.detail}</p>
            <p className="mt-1 text-zinc-400"><span className="font-bold">Next:</span> {f.action}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

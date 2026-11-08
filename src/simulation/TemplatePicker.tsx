import { memo } from 'react';
import { SCAN_TEMPLATES, type ScanTemplate } from './templates';

/** Starting points for common scans. Picking one fills the plan builder below; nothing runs until the plan is accepted. */
export const TemplatePicker = memo(function TemplatePicker({ disabled, onPick }: { disabled: boolean; onPick: (t: ScanTemplate) => void }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3" aria-label="Scan templates">
      <div className="mb-2 text-xs font-bold uppercase border-b border-zinc-800 pb-2">Scan templates</div>
      <ul className="space-y-2">
        {SCAN_TEMPLATES.map(t => (
          <li key={t.id} className="flex items-start justify-between gap-2 text-xs">
            <span><strong className="text-zinc-100">{t.title}</strong><span className="block text-zinc-400">{t.summary}</span></span>
            <button type="button" disabled={disabled} onClick={() => onPick(t)} aria-label={`Use template ${t.title}`} className="shrink-0 rounded border border-zinc-600 bg-zinc-800 px-2 py-1 font-semibold text-white hover:bg-zinc-700 disabled:opacity-50">Use</button>
          </li>
        ))}
      </ul>
      {disabled && <p className="mt-2 text-xs text-zinc-500">Templates can be used when no run is active.</p>}
    </div>
  );
});

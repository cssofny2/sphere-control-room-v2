import React, { useMemo } from 'react';
import type { Axis, AxisPlanDraft, RunContract } from './domain/run';
import { buildAxisPlan, DEFAULT_PLAN_LIMITS } from './simulation/plan';

interface Props {
  draft: AxisPlanDraft;
  active: boolean;
  contract: RunContract | null;
  onChange: (patch: Partial<AxisPlanDraft>) => void;
}

export default function PlanBuilder({ draft, active, contract, onChange }: Props) {
  const preview = useMemo(() => active && contract
    ? { ok: true as const, plan: contract.plan }
    : buildAxisPlan(draft),
  [active, contract?.plan, draft.axis, draft.start, draft.stop, draft.step, draft.repeats, draft.randomized, draft.seed, draft.anchor.x, draft.anchor.y, draft.anchor.z]);
  const issues = preview.ok === false ? preview.issues : [];
  const showDraftFields = !active || !contract || contract.plan.settings.kind === 'axis';
  const error = (field: string) => issues.filter(issue => issue.field === field).map(issue => issue.message).join(' ');
  const numberField = (field: 'start' | 'stop' | 'step' | 'repeats' | 'seed', label: string) => (
    <label className="block text-xs text-zinc-300" htmlFor={`scan-${field}`}>
      {label}
      <input id={`scan-${field}`} type="number" step={field === 'repeats' || field === 'seed' ? 1 : 'any'}
        aria-label={label}
        disabled={active} value={Number.isFinite(draft[field]) ? draft[field] : ''}
        aria-invalid={!!error(field)} aria-describedby={error(field) ? `scan-${field}-error` : undefined}
        onChange={e => onChange({ [field]: e.target.value.trim() === '' ? NaN : Number(e.target.value) })}
        className="mt-1 w-full rounded border border-zinc-700 bg-black p-1.5 font-mono text-sky-200 disabled:opacity-60" />
      {error(field) && <span id={`scan-${field}-error`} className="mt-1 block text-rose-300">{error(field)}</span>}
    </label>
  );
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-3" aria-label="Validated scan plan builder">
      <div className="text-xs font-bold uppercase border-b border-zinc-800 pb-2">Plan builder</div>
      {showDraftFields ? <>
      <label className="block text-xs text-zinc-300" htmlFor="scan-axis">Scan axis
        <select id="scan-axis" disabled={active} value={draft.axis} onChange={e => onChange({ axis: e.target.value as Axis })} className="mt-1 w-full rounded border border-zinc-700 bg-black p-1.5">
          <option value="x">X axis</option><option value="y">Y axis</option><option value="z">Z axis</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">{numberField('start', 'Start (mm)')}{numberField('stop', 'Stop (mm)')}</div>
      <div className="grid grid-cols-2 gap-3">{numberField('step', 'Step (mm)')}{numberField('repeats', 'Repeats per position')}</div>
      {numberField('seed', 'Plan and noise seed')}
      <label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" disabled={active} checked={draft.randomized} onChange={e => onChange({ randomized: e.target.checked })} /> Randomized order (seeded)</label>
      </> : <p className="text-xs text-zinc-300">An accepted {contract.plan.settings.kind === 'manual' ? 'manual recording' : '5×5 serpentine'} run owns the instruments. Draft axis settings can be edited after it stops.</p>}
      <div className="text-xs text-zinc-400">Travel ±{DEFAULT_PLAN_LIMITS.travelLimitMm} mm · Max {DEFAULT_PLAN_LIMITS.maxAcquisitions} planned acquisitions · 1–{DEFAULT_PLAN_LIMITS.maxRepeats} repeats</div>
      <div className="rounded border border-zinc-700 bg-zinc-900/60 p-3 text-xs" aria-live="polite" aria-label="Scan plan preview">
        {preview.ok === false ? (
          <div role="alert"><strong className="text-rose-300">Plan not valid</strong><ul className="mt-2 space-y-1 text-rose-200">{issues.map((issue, i) => <li key={`${issue.field}-${i}`}>{issue.field}: {issue.message}</li>)}</ul><p className="mt-2 text-zinc-400">No run or movement will start until these fields are corrected.</p></div>
        ) : (
          <>
            <strong className="text-emerald-200">{active ? 'Accepted run plan' : 'Draft plan valid'}</strong>
            <p className="mt-1" data-testid="plan-counts">{preview.plan.settings.kind === 'manual' ? 'Manual recording: acquisitions are not bound to an automated plan.' : `${preview.plan.orderedPoints.length} positions × ${preview.plan.settings.repeats} repeats = ${preview.plan.acquisitions.length} planned acquisitions`}</p>
            <p className="mt-1 text-zinc-400">Model {preview.plan.modelVersion} · Seed {preview.plan.settings.seed} · {preview.plan.dataOrigin}</p>
            <div className="mt-3 font-semibold">Ordered positions before randomization</div>
            <div className="mt-1 font-mono break-words" data-testid="ordered-points">{preview.plan.orderedPoints.slice(0, 12).map(p => `(${Number(p.x.toPrecision(8))}, ${Number(p.y.toPrecision(8))}, ${Number(p.z.toPrecision(8))})`).join(' → ')}{preview.plan.orderedPoints.length > 12 ? ' …' : ''} mm</div>
            <div className="mt-2 font-semibold">Execution order</div>
            <div className="mt-1 font-mono break-words" data-testid="execution-order">{preview.plan.executionPoints.slice(0, 12).map(p => `#${p.pointIndex + 1}`).join(' → ')}{preview.plan.executionPoints.length > 12 ? ' …' : ''}</div>
            {preview.plan.notes.map((note, i) => <p className="mt-2 text-amber-200" key={i}>{note}</p>)}
            {contract && <p className="mt-2 text-zinc-400">Last accepted run: <span className="break-all">{contract.id}</span><span className="block">Status: {contract.status}</span></p>}
          </>
        )}
      </div>
    </div>
  );
}

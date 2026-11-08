// Conformity to a specification with measurement uncertainty taken into account (the simple decision rule of
// ILAC-G8: a result passes only if the whole expanded interval is inside the limits, fails only if it is wholly outside).

export interface Spec { readonly targetHz: number; readonly toleranceHz: number }
export type Decision = 'pass' | 'fail' | 'indeterminate';
export interface ConformRow { readonly key: string; readonly meanHz: number; readonly expandedHz: number | null; readonly deviationHz: number; readonly decision: Decision }

export const validSpec = (s: Spec): boolean => Number.isFinite(s.targetHz) && s.targetHz > 0 && Number.isFinite(s.toleranceHz) && s.toleranceHz > 0;

export function decide(meanHz: number, expandedHz: number | null, spec: Spec): Decision {
  const dev = Math.abs(meanHz - spec.targetHz), u = expandedHz !== null && Number.isFinite(expandedHz) ? Math.max(0, expandedHz) : 0;
  if (dev + u <= spec.toleranceHz) return 'pass';
  if (dev - u > spec.toleranceHz) return 'fail';
  return 'indeterminate';
}

export function conformance(rows: ReadonlyArray<{ key: string; meanHz: number; expandedHz: number | null }>, spec: Spec): { rows: ConformRow[]; counts: Record<Decision, number> } {
  const out = rows.map(r => ({ key: r.key, meanHz: r.meanHz, expandedHz: r.expandedHz, deviationHz: r.meanHz - spec.targetHz, decision: decide(r.meanHz, r.expandedHz, spec) }));
  const counts: Record<Decision, number> = { pass: 0, fail: 0, indeterminate: 0 };
  for (const r of out) counts[r.decision]++;
  return { rows: out, counts };
}

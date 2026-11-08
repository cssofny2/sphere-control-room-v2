// Reviewed starting points for common scans. Applying one only fills the plan builder; the usual plan validation still runs.
export interface ScanTemplate {
  readonly id: string; readonly title: string; readonly summary: string;
  readonly settings: { readonly axis: 'x' | 'y' | 'z'; readonly start: number; readonly stop: number; readonly step: number; readonly repeats: number; readonly randomized: boolean };
}
export const SCAN_TEMPLATES: readonly ScanTemplate[] = [
  { id: 'quick-x', title: 'Quick X survey', summary: 'Five positions along X, one pass. A fast look at the field.', settings: { axis: 'x', start: -20, stop: 20, step: 10, repeats: 1, randomized: false } },
  { id: 'repeatability', title: 'Repeatability check', summary: 'Three positions, five repeats each, in random order, to measure the spread at a point.', settings: { axis: 'x', start: -10, stop: 10, step: 10, repeats: 5, randomized: true } },
  { id: 'fine-z', title: 'Fine Z profile', summary: 'Nine positions at 2.5 mm along Z, three repeats, for the height dependence.', settings: { axis: 'z', start: -10, stop: 10, step: 2.5, repeats: 3, randomized: false } },
  { id: 'drift-hunt', title: 'Drift hunt', summary: 'One position, ten repeats, in order: a slow trend in the repeats shows drift.', settings: { axis: 'x', start: 0, stop: 0, step: 1, repeats: 10, randomized: false } },
  { id: 'wide-y', title: 'Wide Y sweep, randomized', summary: 'Eight positions across Y, two repeats, random order to decouple position from drift.', settings: { axis: 'y', start: -35, stop: 35, step: 10, repeats: 2, randomized: true } },
];
export const templateById = (id: string): ScanTemplate | undefined => SCAN_TEMPLATES.find(t => t.id === id);

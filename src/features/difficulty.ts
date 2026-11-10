export const DIFFICULTIES = ['Beginner', 'Novice', 'Advanced', 'Expert', 'Full Simulation'] as const;
export type Difficulty = typeof DIFFICULTIES[number];

const pages: Record<Difficulty, readonly string[]> = {
  Beginner: ['dashboard', 'overview', 'copilot', 'learn', 'settings'],
  Novice: ['dashboard', 'overview', 'copilot', 'learn', 'settings', 'chamber', 'training', 'timeline', 'runs'],
  Advanced: ['dashboard', 'overview', 'copilot', 'learn', 'settings', 'chamber', 'training', 'timeline', 'runs', 'protocol', 'ldv', 'scope', 'clock', 'insights', 'notebook'],
  Expert: ['dashboard', 'overview', 'copilot', 'learn', 'settings', 'chamber', 'training', 'timeline', 'runs', 'protocol', 'ldv', 'scope', 'clock', 'insights', 'notebook', 'spatial', 'vna', 'challenges'],
  'Full Simulation': ['dashboard', 'overview', 'copilot', 'learn', 'settings', 'chamber', 'training', 'timeline', 'runs', 'protocol', 'ldv', 'scope', 'clock', 'insights', 'notebook', 'spatial', 'vna', 'challenges', 'faults'],
};

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (DIFFICULTIES as readonly string[]).includes(value);
}
export function availableAt(level: Difficulty, page: string): boolean {
  return pages[level].includes(page);
}
export const difficultyHelp: Record<Difficulty, string> = {
  Beginner: 'Start with the console, Copilot and learning paths. Instrument controls are hidden.',
  Novice: 'Add the enclosure, guided checklist, timeline and runs.',
  Advanced: 'Add the optical scanner, oscilloscope, reference clock, protocol and analysis.',
  Expert: 'Add the exploratory VNA, spatial analysis and challenges.',
  'Full Simulation': 'All simulator workspaces, including fault injection, are available.',
};

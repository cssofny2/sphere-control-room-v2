// Keyboard shortcuts: "?" lists them, and "g" followed by a letter goes to a page (like many web apps).

export const GOTO_KEYS: Readonly<Record<string, { page: string; label: string }>> = {
  o: { page: 'overview', label: 'Lab Overview' }, d: { page: 'dashboard', label: 'Operator Console' }, c: { page: 'chamber', label: '3D Chamber & Stage' },
  s: { page: 'spatial', label: 'Spatial Field Explorer' }, v: { page: 'vna', label: 'VNA Analysis' }, l: { page: 'ldv', label: 'LDV Scanner' },
  p: { page: 'scope', label: 'Oscilloscope' }, k: { page: 'clock', label: 'Frequency Reference' }, r: { page: 'runs', label: 'Experiment Runs' },
  n: { page: 'notebook', label: 'Lab Notebook' }, t: { page: 'timeline', label: 'Live Timeline' }, e: { page: 'learn', label: 'Learning Paths' },
};

export const OTHER_SHORTCUTS: ReadonlyArray<{ keys: string; does: string }> = [
  { keys: '?', does: 'Show this list' }, { keys: 'Ctrl/Cmd + K', does: 'Search commands' }, { keys: 'F', does: 'Focus the instrument (hide navigation and journal)' },
  { keys: 'Esc', does: 'Close a dialog, or leave focus mode' }, { keys: 'Tab / Shift + Tab', does: 'Move between controls; dialogs keep focus inside' },
];

export interface ChordState { readonly armedAt: number | null }
export const CHORD_WINDOW_MS = 1500;
export const INITIAL_CHORD: ChordState = { armedAt: null };

export type HotkeyResult = { state: ChordState; action: null | { type: 'help' } | { type: 'goto'; page: string } };

/** True for keys typed into a form control, which must never trigger shortcuts. */
export function isTypingTarget(el: { tagName?: string; isContentEditable?: boolean } | null | undefined): boolean {
  if (!el) return false;
  const t = (el.tagName ?? '').toUpperCase();
  return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || !!el.isContentEditable;
}

/** One step of the shortcut machine. Modified keys (Ctrl, Alt, Meta) are left to their own handlers. */
export function stepHotkey(state: ChordState, e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }, now: number): HotkeyResult {
  if (e.ctrlKey || e.metaKey || e.altKey) return { state: INITIAL_CHORD, action: null };
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (key === '?') return { state: INITIAL_CHORD, action: { type: 'help' } };
  const armed = state.armedAt !== null && now - state.armedAt <= CHORD_WINDOW_MS;
  if (armed) {
    const dest = GOTO_KEYS[key];
    return { state: INITIAL_CHORD, action: dest ? { type: 'goto', page: dest.page } : null };
  }
  if (key === 'g') return { state: { armedAt: now }, action: null };
  return { state: INITIAL_CHORD, action: null };
}

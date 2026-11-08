// Display and accessibility settings: contrast, text size, motion and a colour-vision-safe palette.
// They are applied as classes on the document root and remembered in this browser.
export interface DisplaySettings { readonly contrast: 'normal' | 'high'; readonly textSize: 100 | 115 | 130; readonly motion: 'system' | 'reduced'; readonly palette: 'default' | 'cvd' }
export const DEFAULT_DISPLAY: DisplaySettings = { contrast: 'normal', textSize: 100, motion: 'system', palette: 'default' };

export function sanitizeDisplay(raw: unknown): DisplaySettings {
  const o = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {};
  return {
    contrast: o.contrast === 'high' ? 'high' : 'normal',
    textSize: o.textSize === 115 || o.textSize === 130 ? o.textSize : 100,
    motion: o.motion === 'reduced' ? 'reduced' : 'system',
    palette: o.palette === 'cvd' ? 'cvd' : 'default',
  };
}
/** Class names for the settings; empty when everything is at its default. */
export function displayClasses(s: DisplaySettings): string[] {
  const c: string[] = [];
  if (s.contrast === 'high') c.push('disp-high-contrast');
  if (s.textSize !== 100) c.push(`disp-text-${s.textSize}`);
  if (s.motion === 'reduced') c.push('disp-reduce-motion');
  if (s.palette === 'cvd') c.push('disp-cvd');
  return c;
}
const ALL = ['disp-high-contrast', 'disp-text-115', 'disp-text-130', 'disp-reduce-motion', 'disp-cvd'];
export function applyDisplay(el: { classList: { remove(...c: string[]): void; add(...c: string[]): void } }, s: DisplaySettings): void {
  el.classList.remove(...ALL); const c = displayClasses(s); if (c.length) el.classList.add(...c);
}

const KEY = 'sphere-lab-display-v1';
let current: DisplaySettings = DEFAULT_DISPLAY, loaded = false;
const subs = new Set<() => void>();
function load() { if (loaded) return; loaded = true; try { current = sanitizeDisplay(JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null')); } catch { current = DEFAULT_DISPLAY; } }
export function getDisplay(): DisplaySettings { load(); return current; }
export function setDisplay(patch: Partial<DisplaySettings>): void {
  load(); current = sanitizeDisplay({ ...current, ...patch });
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(current)); } catch { /* storage may be blocked */ }
  if (typeof document !== 'undefined') applyDisplay(document.documentElement, current);
  subs.forEach(f => f());
}
export function subscribeDisplay(f: () => void): () => void { subs.add(f); return () => { subs.delete(f); }; }
/** Applies the remembered settings at start-up. */
export function installDisplaySettings(): void { if (typeof document !== 'undefined') applyDisplay(document.documentElement, getDisplay()); }

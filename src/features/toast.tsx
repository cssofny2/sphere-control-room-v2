import { useEffect, useState } from 'react';

// Small, non-blocking confirmations ("Link copied", "Run complete"). They are announced politely to screen readers and
// disappear on their own. Anything that needs a decision stays a dialog.

export type ToastKind = 'info' | 'success' | 'warn' | 'error';
export interface Toast { readonly id: number; readonly kind: ToastKind; readonly text: string }

export const MAX_TOASTS = 4;
export const TOAST_MS: Record<ToastKind, number> = { info: 3500, success: 3500, warn: 6000, error: 8000 };

let nextId = 1;
let items: readonly Toast[] = [];
const subs = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const emit = () => subs.forEach(f => f());

export function dismissToast(id: number) {
  const t = timers.get(id); if (t) { clearTimeout(t); timers.delete(id); }
  if (items.some(x => x.id === id)) { items = items.filter(x => x.id !== id); emit(); }
}

/** Shows a toast. The same text shown again while still visible is not stacked twice. Returns the toast id. */
export function toast(text: string, kind: ToastKind = 'info'): number {
  const clean = text.slice(0, 160);
  const dup = items.find(x => x.text === clean && x.kind === kind);
  if (dup) return dup.id;
  const t: Toast = { id: nextId++, kind, text: clean };
  items = [...items, t].slice(-MAX_TOASTS);
  items.forEach(x => { if (!timers.has(x.id)) timers.set(x.id, setTimeout(() => dismissToast(x.id), TOAST_MS[x.kind])); });
  emit();
  return t.id;
}
export const getToasts = (): readonly Toast[] => items;
export function resetToasts() { timers.forEach(clearTimeout); timers.clear(); items = []; emit(); }

const COLOR: Record<ToastKind, string> = { info: 'border-sky-500/60 text-sky-100', success: 'border-emerald-500/60 text-emerald-100', warn: 'border-amber-500/60 text-amber-100', error: 'border-rose-500/60 text-rose-100' };
const ICON: Record<ToastKind, string> = { info: 'ℹ', success: '✓', warn: '▲', error: '✕' };

export function ToastHost() {
  const [list, setList] = useState<readonly Toast[]>(getToasts());
  useEffect(() => { const f = () => setList(getToasts()); subs.add(f); f(); return () => { subs.delete(f); }; }, []);
  return (
    <div className="pointer-events-none fixed bottom-16 left-1/2 z-[90] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2" role="status" aria-live="polite" aria-atomic="false">
      {list.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-2 rounded-lg border bg-zinc-950/95 px-3 py-2 text-xs shadow-xl ${COLOR[t.kind]}`}>
          <span aria-hidden="true" className="font-bold">{ICON[t.kind]}</span>
          <span className="flex-1">{t.text}</span>
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss message" className="rounded px-1 text-zinc-400 hover:text-white">×</button>
        </div>
      ))}
    </div>
  );
}

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { exportSvgsAsPng } from './exportImage';
import { GOTO_KEYS, OTHER_SHORTCUTS } from './hotkeys';
import { sparkline } from './sparkline';
import { toast } from './toast';

/** A friendly "nothing here yet" panel that says what to do next. */
export function EmptyState({ title, children, icon = '◌' }: { title: string; children?: ReactNode; icon?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded border border-dashed border-zinc-700 bg-black/30 p-6 text-center" role="status">
      <div aria-hidden="true" className="text-2xl text-zinc-500">{icon}</div>
      <div className="text-sm font-bold text-zinc-200">{title}</div>
      {children && <div className="max-w-md text-xs text-zinc-400">{children}</div>}
    </div>
  );
}

/** "Save image": exports every chart SVG found inside `targetRef` as one PNG. */
export function SaveImageButton({ targetRef, title, selector = 'svg.recharts-surface, svg[data-exportable]' }: { targetRef: RefObject<HTMLElement | null>; title: string; selector?: string }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    const svgs = [...(targetRef.current?.querySelectorAll<SVGSVGElement>(selector) ?? [])].filter(s => s.getBoundingClientRect().width > 20);
    if (!svgs.length) { toast('There is no chart to save yet.', 'warn'); return; }
    setBusy(true);
    try { await exportSvgsAsPng(svgs, title); toast(`Saved “${title}” as an image.`, 'success'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not save the image.', 'error'); }
    finally { setBusy(false); }
  };
  return <button onClick={go} disabled={busy} title="Save this chart as a PNG image" className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-50">{busy ? 'Saving…' : 'Save image'}</button>;
}

/** Mini trend line (no axes): where a reading has been going. */
export function Sparkline({ values, log = false, color = '#7dd3fc', label, width = 120, height = 28 }: { values: ReadonlyArray<number | null>; log?: boolean; color?: string; label: string; width?: number; height?: number }) {
  const s = sparkline(values, width, height, log);
  if (!s.path) return <div className="h-7 text-[10px] text-zinc-500" aria-label={`${label}: not enough data yet`}>collecting…</div>;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} trend over the last minutes`} className="block overflow-visible">
      <path d={s.path} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      {s.last && <circle cx={s.last.x} cy={s.last.y} r="2.2" fill={color} />}
    </svg>
  );
}

/** The "?" shortcut list. Closes on Escape or the Close button (the shared dialog handler adds focus handling). */
export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('button')?.focus(); }, []);
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-lg border border-zinc-700 bg-zinc-950 p-4 text-xs text-zinc-200 shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="text-sm font-bold">Keyboard shortcuts</h2><button onClick={onClose} className="rounded border border-zinc-600 px-3 py-1.5 hover:bg-zinc-800">Close</button></div>
        <h3 className="mt-3 font-bold uppercase text-zinc-400">Go to a page: press <kbd className="rounded bg-zinc-800 px-1">g</kbd> then</h3>
        <ul className="mt-1 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">{Object.entries(GOTO_KEYS).map(([k, v]) => <li key={k} className="flex items-center gap-2"><kbd className="min-w-5 rounded bg-zinc-800 px-1.5 text-center font-mono">{k}</kbd><span>{v.label}</span></li>)}</ul>
        <h3 className="mt-3 font-bold uppercase text-zinc-400">Anywhere</h3>
        <ul className="mt-1 space-y-1">{OTHER_SHORTCUTS.map(s => <li key={s.keys} className="flex gap-2"><kbd className="rounded bg-zinc-800 px-1.5 font-mono">{s.keys}</kbd><span>{s.does}</span></li>)}</ul>
        <p className="mt-3 text-zinc-500">Shortcuts are ignored while you are typing in a field.</p>
      </div>
    </div>
  );
}

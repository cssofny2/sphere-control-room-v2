import React, { useSyncExternalStore } from 'react';
import { Clock3 } from 'lucide-react';

// One shared once-a-second ticker for every clock on screen, so ten clocks cost one timer.
let now = new Date();
let timer: ReturnType<typeof setInterval> | null = null;
const subs = new Set<() => void>();
const subscribe = (cb: () => void) => {
  subs.add(cb);
  if (!timer) timer = setInterval(() => { now = new Date(); subs.forEach(f => f()); }, 1000);
  return () => { subs.delete(cb); if (!subs.size && timer) { clearInterval(timer); timer = null; } };
};
const snapshot = () => now;
export const useWallClock = (): Date => useSyncExternalStore(subscribe, snapshot, snapshot);

export const formatLabDate = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
export const formatLabTime = (d: Date) => d.toLocaleTimeString(undefined, { hour12: false });
/** "2026-11-04 14:03:22" — the form used inside exported logs and instrument screens. */
export const formatStamp = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${formatLabTime(d)}`;

/**
 * Live date and time of the lab (the real clock of the computer running the simulator).
 * `chip`: compact, for headers. `block`: date over time. `screen`: one monospace line for instrument screens.
 */
export function LabClock({ variant = 'chip', sim, className = '' }: { variant?: 'chip' | 'block' | 'screen'; sim?: number; className?: string }) {
  const d = useWallClock();
  const iso = d.toISOString();
  if (variant === 'screen') return <time dateTime={iso} className={`lc-screen ${className}`}>{formatStamp(d)}</time>;
  if (variant === 'block') return (
    <time dateTime={iso} className={`lc-block ${className}`}><span className="lc-date">{formatLabDate(d)}</span><span className="lc-time">{formatLabTime(d)}</span>{sim !== undefined && <span className="lc-sim">sim t = {Math.floor(sim)} s</span>}</time>
  );
  return (
    <time dateTime={iso} className={`lc-chip ${className}`} title={`Lab clock — ${d.toString()}`}><Clock3 size={13} aria-hidden="true" /><span className="lc-date">{formatLabDate(d)}</span><strong className="lc-time">{formatLabTime(d)}</strong></time>
  );
}

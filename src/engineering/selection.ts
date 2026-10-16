// One shared "selected part" for the realistic lab and the engineering schematic.
// Clicking a part in either view selects it here; the other view reads it when it shows.
import { useSyncExternalStore } from 'react';
import { PART_BY_ID, partForLabPick } from './parts';

let current: string | null = null;
const subs = new Set<() => void>();
export const getSelected = () => current;
export function select(id: string | null) {
  if (id && !PART_BY_ID[id]) return;
  if (id === current) return;
  current = id; subs.forEach(f => f());
}
export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useSelected = () => useSyncExternalStore(subscribe, getSelected, getSelected);

// The 3D lab announces clicks as a window event; this keeps the store in step even when the schematic is not mounted.
let installed = false;
export function installLabSelectionSync() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('lab-part-click', (e: Event) => {
    const id = partForLabPick(String((e as CustomEvent).detail?.name ?? ''));
    if (id) select(id);
  });
}

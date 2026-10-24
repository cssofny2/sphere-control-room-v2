import { useSyncExternalStore } from 'react';
import { create } from 'zustand';

// The simulator's pure reducer stays the single source of transition logic (cross-subsystem rules such as
// "changing the VNA span invalidates calibration" live there). These three stores own disjoint slices of its
// state, so a component can subscribe to one field of one slice without re-rendering on unrelated changes.

export const INSTRUMENT_KEYS = ['vna', 'ldv', 'scope', 'spatialView', 'experiment'] as const;
export const ENVIRONMENT_KEYS = ['facility', 'clock', 'chamber', 'stage', 'failures', 'model', 'alarms', 'events'] as const;
// Any key the reducer adds that is not listed above is routed here too.
export const UI_KEYS = ['ui', 'notebook', 'faultDrill', 'badges', 'activeChallenge', 'challengePassed', 'peerReviewData'] as const;

type Slice = Record<string, any>;
type Action = { type: string; [k: string]: any };
type Reducer = (state: Slice, action: Action) => Slice;

export interface InstrumentStore extends Slice {
  vna: Slice; ldv: Slice; scope: Slice; spatialView: Slice; experiment: Slice;
  /** Sets the VNA centre frequency (Hz). Goes through the reducer so calibration is invalidated as before. */
  setVnaFrequency: (freq: number) => void;
  toggleOscilloscope: () => void;
}
export interface EnvironmentStore extends Slice {
  facility: Slice; clock: Slice; chamber: Slice; stage: Slice; failures: Slice; model: Slice; alarms: any[]; events: any[];
}
export interface UIStore extends Slice {
  ui: Slice;
  setUi: (patch: Slice) => void;
}

let reducerFn: Reducer | null = null;
let initial: Slice = {};

export const useInstrumentStore = create<InstrumentStore>()(() => ({
  setVnaFrequency: (freq) => dispatch({ type: 'PATCH', domain: 'vna', patch: { center: freq } }),
  toggleOscilloscope: () => dispatch({ type: 'PATCH', domain: 'scope', patch: { running: !useInstrumentStore.getState().scope.running } }),
} as InstrumentStore));
export const useEnvironmentStore = create<EnvironmentStore>()(() => ({} as EnvironmentStore));
export const useUIStore = create<UIStore>()(() => ({
  setUi: (patch) => dispatch({ type: 'SET_UI', patch }),
} as UIStore));

const isInstrument = new Set<string>(INSTRUMENT_KEYS);
const isEnvironment = new Set<string>(ENVIRONMENT_KEYS);

const plain = (s: Slice) => {
  const out: Slice = {};
  for (const k in s) if (typeof s[k] !== 'function') out[k] = s[k];
  return out;
};

let cache: Slice | null = null;
let cacheRefs: Slice[] = [];

/** Reducer-shaped snapshot of all three stores; referentially stable until a slice changes. */
export function getLabState(): Slice {
  const refs = [useInstrumentStore.getState(), useEnvironmentStore.getState(), useUIStore.getState()];
  if (cache && refs.every((r, i) => r === cacheRefs[i])) return cache;
  cacheRefs = refs;
  return (cache = { ...plain(refs[0]), ...plain(refs[1]), ...plain(refs[2]) });
}

function split(state: Slice) {
  const inst: Slice = {}, env: Slice = {}, ui: Slice = {};
  for (const k in state) {
    if (typeof state[k] === 'function') continue;
    (isInstrument.has(k) ? inst : isEnvironment.has(k) ? env : ui)[k] = state[k];
  }
  return { inst, env, ui };
}

/** Runs the reducer and writes only the top-level keys whose reference changed into their owning store. */
export function dispatch(action: Action) {
  if (!reducerFn) throw new Error('labStores: initLabStores() has not been called');
  const prev = getLabState();
  const next = reducerFn(prev, action);
  if (next === prev) return;
  const { inst, env, ui } = split(next);
  const changed = (slice: Slice) => {
    const out: Slice = {};
    for (const k in slice) if (slice[k] !== prev[k]) out[k] = slice[k];
    return Object.keys(out).length ? out : null;
  };
  const i = changed(inst), e = changed(env), u = changed(ui);
  if (i) useInstrumentStore.setState(i);
  if (e) useEnvironmentStore.setState(e);
  if (u) useUIStore.setState(u);
}

/** Registers the reducer and seeds the stores. Idempotent; call once at module load. */
export function initLabStores(reducer: Reducer, initialState: Slice) {
  reducerFn = reducer;
  initial = initialState;
  resetLabStores();
}

export function resetLabStores() {
  const { inst, env, ui } = split(initial);
  useInstrumentStore.setState(inst);
  useEnvironmentStore.setState(env);
  useUIStore.setState(ui);
}

const subscribeLab = (cb: () => void) => {
  const off = [useInstrumentStore.subscribe(cb), useEnvironmentStore.subscribe(cb), useUIStore.subscribe(cb)];
  return () => off.forEach(f => f());
};

/**
 * Selector over the combined simulator state, for derived values that need more than one slice
 * (e.g. instrument status). The selector must return a primitive or an existing sub-object, never a fresh one.
 */
export function useLab<T>(selector: (state: Slice) => T): T {
  return useSyncExternalStore(subscribeLab, () => selector(getLabState()));
}

// A tiny key-value store for saved sessions and the run library. IndexedDB when the browser allows it, memory otherwise
// (private windows, blocked storage), so callers never need to care.

export interface KV {
  readonly kind: 'indexeddb' | 'memory';
  get<T = unknown>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
}

export function memoryKV(): KV {
  const m = new Map<string, unknown>();
  return {
    kind: 'memory',
    async get<T>(k: string) { return m.has(k) ? structuredClone(m.get(k)) as T : undefined; },
    async set(k, v) { m.set(k, structuredClone(v)); },
    async del(k) { m.delete(k); },
    async keys(p = '') { return [...m.keys()].filter(k => k.startsWith(p)); },
  };
}

const req = <T>(r: IDBRequest<T>): Promise<T> => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export function indexedDbKV(factory: IDBFactory | undefined = typeof indexedDB !== 'undefined' ? indexedDB : undefined, name = 'sphere-lab'): Promise<KV> {
  return new Promise((resolve, reject) => {
    if (!factory) { reject(new Error('IndexedDB is unavailable')); return; }
    let open: IDBOpenDBRequest;
    try { open = factory.open(name, 1); } catch (e) { reject(e); return; }
    open.onupgradeneeded = () => { open.result.createObjectStore('kv'); };
    open.onerror = () => reject(open.error);
    open.onblocked = () => reject(new Error('IndexedDB is blocked'));
    open.onsuccess = () => {
      const db = open.result;
      const store = (mode: IDBTransactionMode) => db.transaction('kv', mode).objectStore('kv');
      resolve({
        kind: 'indexeddb',
        get: async <T>(k: string) => (await req(store('readonly').get(k))) as T | undefined,
        set: async (k, v) => { await req(store('readwrite').put(v, k)); },
        del: async k => { await req(store('readwrite').delete(k)); },
        keys: async (p = '') => (await req(store('readonly').getAllKeys())).map(String).filter(k => k.startsWith(p)),
      });
    };
  });
}

let shared: Promise<KV> | null = null;
/** The app-wide store: IndexedDB if it opens, else memory. */
export function getKV(): Promise<KV> {
  return shared ??= indexedDbKV().catch(() => memoryKV());
}

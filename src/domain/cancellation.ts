export interface DelayScheduler {
  schedule(callback: () => void, milliseconds: number): () => void;
}

const defaultScheduler: DelayScheduler = {
  schedule(callback, milliseconds) {
    const timer = globalThis.setTimeout(callback, milliseconds);
    return () => globalThis.clearTimeout(timer);
  },
};

export function cancellationError(): DOMException {
  return new DOMException('Run cancelled', 'AbortError');
}

export function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) throw cancellationError();
}

/** Wall-clock delay only. Inject a simulation-clock scheduler for run timing. */
export function abortableDelay(
  milliseconds: number,
  signal: AbortSignal,
  scheduler: DelayScheduler = defaultScheduler,
): Promise<void> {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    return Promise.reject(new RangeError('Delay must be finite and nonnegative.'));
  }
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(cancellationError()); return; }
    let settled = false;
    let cancelTimer: (() => void) | undefined;
    const cleanup = () => {
      signal.removeEventListener('abort', onAbort);
      cancelTimer?.();
    };
    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(cancellationError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      cancelTimer = scheduler.schedule(() => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      }, milliseconds);
      if (settled) cancelTimer();
      else if (signal.aborted) onAbort();
    } catch (error) {
      settled = true;
      cleanup();
      reject(error);
    }
  });
}

export interface RunLease {
  readonly runId: string;
  readonly signal: AbortSignal;
  assertCurrent(): void;
  release(): void;
}

/** Owns cancellation, not React state or instrument reset policy. */
export class RunOwner {
  private current: { runId: string; controller: AbortController } | null = null;

  get active(): boolean { return this.current !== null; }

  start(runId: string): RunLease {
    if (!runId.trim()) throw new TypeError('A nonempty run ID is required.');
    if (this.current) throw new Error('A run is already active.');
    const entry = { runId, controller: new AbortController() };
    this.current = entry;
    const release = () => {
      if (this.current === entry) this.current = null;
      entry.controller.abort();
    };
    return Object.freeze({
      runId, signal: entry.controller.signal, release,
      assertCurrent: () => {
        if (this.current !== entry) throw cancellationError();
        throwIfCancelled(entry.controller.signal);
      },
    });
  }

  cancel(): void {
    const entry = this.current;
    this.current = null;
    entry?.controller.abort();
  }
}

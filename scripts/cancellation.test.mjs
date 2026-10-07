import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

const { abortableDelay, RunOwner } = await loadTypeScript(
  new URL('../src/domain/cancellation.ts', import.meta.url),
);
const aborted = error => error?.name === 'AbortError';
function clock() {
  const jobs = new Set();
  return {
    schedule(callback) { jobs.add(callback); return () => jobs.delete(callback); },
    flush() { for (const callback of [...jobs]) callback(); },
    get pending() { return jobs.size; },
  };
}
function trackedController() {
  const controller = new AbortController();
  const signal = controller.signal;
  const listeners = new Set();
  const add = signal.addEventListener.bind(signal);
  const remove = signal.removeEventListener.bind(signal);
  signal.addEventListener = (type, listener, options) => {
    if (type === 'abort') listeners.add(listener);
    return add(type, listener, options);
  };
  signal.removeEventListener = (type, listener, options) => {
    if (type === 'abort') listeners.delete(listener);
    return remove(type, listener, options);
  };
  return { controller, signal, listeners };
}

{
  const c = trackedController(), scheduler = clock();
  const promise = abortableDelay(100, c.signal, scheduler);
  assert.equal(scheduler.pending, 1);
  scheduler.flush();
  await promise;
  assert.equal(scheduler.pending, 0);
  assert.equal(c.listeners.size, 0);
  c.controller.abort();
}
{
  const c = trackedController(), scheduler = clock();
  const promise = abortableDelay(100, c.signal, scheduler);
  const rejected = assert.rejects(promise, aborted);
  c.controller.abort();
  await rejected;
  scheduler.flush();
  assert.equal(scheduler.pending, 0);
  assert.equal(c.listeners.size, 0);
}
{
  const c = trackedController(), scheduler = clock();
  c.controller.abort();
  await assert.rejects(abortableDelay(100, c.signal, scheduler), aborted);
  assert.equal(scheduler.pending, 0);
  assert.equal(c.listeners.size, 0);
}
{
  const c = trackedController(), scheduler = clock();
  for (const duration of [-1, NaN, Infinity]) {
    await assert.rejects(abortableDelay(duration, c.signal, scheduler), RangeError);
  }
  assert.equal(scheduler.pending, 0);
  assert.equal(c.listeners.size, 0);
}
{
  const c = trackedController();
  await assert.rejects(abortableDelay(0, c.signal, {
    schedule() { throw new Error('Scheduler unavailable'); },
  }), /Scheduler unavailable/);
  assert.equal(c.listeners.size, 0);
  let cancelled = 0;
  await abortableDelay(0, c.signal, {
    schedule(callback) { callback(); return () => { cancelled++; }; },
  });
  assert.equal(cancelled, 1);
  assert.equal(c.listeners.size, 0);
}
{
  const owner = new RunOwner();
  assert.throws(() => owner.start(' '), TypeError);
  const first = owner.start('run-1');
  first.assertCurrent();
  assert.throws(() => owner.start('duplicate'), /already active/);
  owner.cancel();
  assert.equal(first.signal.aborted, true);
  assert.throws(() => first.assertCurrent(), aborted);
  const second = owner.start('run-2');
  first.release();
  assert.equal(owner.active, true);
  second.assertCurrent();
  second.release();
  assert.equal(second.signal.aborted, true);
  assert.equal(owner.active, false);
  assert.throws(() => second.assertCurrent(), aborted);
  owner.cancel();
}
console.log('PASS cancellation cleanup, timer ownership, invalid delays, scheduler failure, and stale-run guards');

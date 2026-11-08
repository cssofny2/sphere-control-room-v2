import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadTypeScript } from './load-typescript.mjs';

const store = await loadTypeScript(new URL('../src/persistence/store.ts', import.meta.url));
const sess = await loadTypeScript(new URL('../src/persistence/sessions.ts', import.meta.url));
const auto = await loadTypeScript(new URL('../src/persistence/autosave.ts', import.meta.url));

const rec = (id, runId, t, o = {}) => ({ id, runId, timestamp: `2026-11-08T00:00:${String(t).padStart(2, '0')}Z`, x: 0, y: 0, z: 0, resonance: 230500 + t, ...o });

// memory store: clones, lists by prefix, deletes
{
  const kv = store.memoryKV();
  const v = { a: [1, 2] };
  await kv.set('run:1', v); await kv.set('session', 1);
  v.a.push(3);
  assert.deepEqual((await kv.get('run:1')).a, [1, 2], 'stored values are copies');
  assert.deepEqual(await kv.keys('run:'), ['run:1']);
  await kv.del('run:1');
  assert.equal(await kv.get('run:1'), undefined);
  console.log('PASS memory store copies, lists by prefix and deletes');
}
// IndexedDB wrapper degrades to memory when unavailable
{
  await assert.rejects(store.indexedDbKV(undefined), /unavailable/);
  const kv = await store.indexedDbKV(undefined).catch(() => store.memoryKV());
  assert.equal(kv.kind, 'memory');
  console.log('PASS missing IndexedDB falls back to memory');
}
// merge / group / snapshot validation
{
  const a = [rec('a', 'r1', 1), rec('b', 'r1', 2)], b = [rec('b', 'r1', 2, { resonance: 1 }), rec('c', 'r2', 3)];
  const m = sess.mergeRecords(a, b);
  assert.deepEqual(m.map(r => r.id), ['c', 'b', 'a'], 'newest first, deduplicated by id');
  assert.equal(m.find(r => r.id === 'b').resonance, 1, 'incoming copy wins');
  assert.equal(sess.mergeRecords(a, b, 2).length, 2, 'cap is applied');
  assert.equal([...sess.groupByRun(m).keys()].length, 2);
  const snap = sess.makeSnapshot(m, [{ id: 'n1' }]);
  assert.deepEqual(sess.parseSnapshot(JSON.parse(JSON.stringify(snap))).records.length, 3);
  assert.equal(sess.parseSnapshot(null), null);
  assert.equal(sess.parseSnapshot({ ...snap, version: 99 }), null, 'unknown versions are ignored');
  assert.equal(sess.parseSnapshot({ ...snap, records: 'x' }), null);
  const dirty = sess.parseSnapshot({ ...snap, records: [rec('ok', 'r', 1), { id: 'bad', runId: 'r', x: NaN, y: 0, z: 0, resonance: 1 }, 7, null, { id: 5 }] });
  assert.equal(dirty.records.length, 1, 'malformed records are dropped, not fatal');
  assert.equal(sess.parseSnapshot({ ...snap, records: new Array(sess.MAX_RECORDS + 1).fill(rec('x', 'r', 1)) }), null, 'oversize data is refused');
  assert.ok(sess.MAX_RECORDS > 200);
  const sum = sess.summarizeArchive({ version: 1, runId: 'r1', savedAt: 's', records: a });
  assert.equal(sum.count, 2); assert.ok(sum.first < sum.last);
  console.log('PASS merge, grouping and snapshot validation (hostile input included)');
}
// autosave: archives only grow, session overwritten, unchanged runs not rewritten
{
  const kv = store.memoryKV();
  let state = { records: [rec('a', 'r1', 1), rec('b', 'r1', 2)], notebook: [{ id: 'n' }] };
  let sets = 0; const raw = kv.set; kv.set = async (k, v) => { sets++; return raw(k, v); };
  const saver = auto.createAutosave(kv, () => state, 5);
  await saver.flush();
  assert.equal((await kv.get('run:r1')).records.length, 2);
  assert.equal((await kv.get('session')).notebook.length, 1);
  const before = sets; await saver.flush();
  assert.equal(sets - before, 1, 'an unchanged run is not rewritten; only the session is');
  state = { records: [], notebook: [] };               // ledger cleared / breaker cycled
  await saver.flush();
  assert.equal((await kv.get('run:r1')).records.length, 2, 'clearing the ledger does not delete the archived run');
  assert.equal((await kv.get('session')).records.length, 0);
  state = { records: [rec('c', 'r1', 3)], notebook: [] };
  await saver.flush();
  assert.equal((await kv.get('run:r1')).records.length, 3, 'new records merge into the archive');
  saver.schedule(); await new Promise(r => setTimeout(r, 30));
  const failing = { ...kv, set: async () => { throw new Error('quota'); } };
  await auto.createAutosave(failing, () => state).flush();
  console.log('PASS autosave archives runs, survives clears, skips unchanged runs and swallows quota errors');
}
// wiring guards
{
  const app = fs.readFileSync(new URL('../src/MetrologyLabV3.tsx', import.meta.url), 'utf8');
  assert.ok(!/records:\s*\[record, \.\.\.state\.experiment\.records\]\.slice\(0, 200\)/.test(app), 'the 200-record cap is gone');
  assert.ok(/SessionRestore dispatch/.test(app) && /createAutosave\(/.test(app) && /RESTORE_SESSION/.test(app));
  console.log('PASS app is wired to restore, autosave and the run library');
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadTypeScript } from './load-typescript.mjs';

const L = await loadTypeScript(new URL('../src/curriculum/lessons.ts', import.meta.url));
const E = await loadTypeScript(new URL('../src/curriculum/engine.ts', import.meta.url));
const M = await loadTypeScript(new URL('../src/simulation/model.ts', import.meta.url));
const route = await loadTypeScript(new URL('../src/features/route.ts', import.meta.url));

/** A lab that has just been switched on and nothing else. */
const fresh = () => ({
  facility: { power: false }, clock: { locked: false },
  chamber: { pressure: 760, vent: true, faraday: false, isolation: false },
  vna: { power: false, rf: false, calibrated: false, averagingEnabled: false, averagingCount: 4, lastMetrics: null },
  failures: { clockDrift: false }, experiment: { randomized: false, records: [] },
});
let n = 0;
const rec = (o = {}) => ({ id: `r${++n}`, x: 0, y: 0, z: 0, resonance: 230500, temp: 20, uncertaintyHz: 0.03, fit: { ok: true }, ...o });
const ok = (state, answers = {}) => { const p = { ...E.EMPTY_PROGRESS, answers }; const lesson = id => L.LESSON_BY_ID[id]; return id => E.evaluate(lesson(id), state, p); };

// Hand-built solved lab states, one per lesson. Each must pass its lesson and the untouched lab must not.
const thermalRecs = [20, 23, 26].map(t => rec({ temp: t, resonance: 230500 + (t - 20) * M.THERMAL_HZ_PER_C + (t === 23 ? 0.1 : 0) }));
const locRecs = []; for (const [x, y, z] of [[-20, 0, 0], [20, 0, 0], [0, -20, 0], [0, 20, 0], [0, 0, -20], [0, 0, 20], [10, 10, 10], [-10, 5, -5]]) locRecs.push(rec({ x, y, z, resonance: 230500 + x * M.LOCATION_HZ_PER_MM.x + y * M.LOCATION_HZ_PER_MM.y + z * M.LOCATION_HZ_PER_MM.z }));
const repRecs = []; for (const x of [-10, 0, 10]) for (let k = 0; k < 3; k++) repRecs.push(rec({ x, pointId: `p${x}`, repeatIndex: k + 1, attemptIndex: 1, resonance: 230500 + x * 45 + (k - 1) * 0.04, uncertaintyHz: 0.03 }));
const solved = {
  'bring-up': [{ ...fresh(), facility: { power: true }, clock: { locked: true }, chamber: { pressure: 1e-4, vent: false, faraday: true, isolation: true }, vna: { ...fresh().vna, power: true, rf: true } }, {}],
  'first-sweep': [{ ...fresh(), vna: { ...fresh().vna, calibrated: true, lastMetrics: { fitOk: true, uncertaintyHz: 0.5 } } }, {}],
  'quiet-trace': [{ ...fresh(), chamber: { ...fresh().chamber, faraday: true, isolation: true }, vna: { ...fresh().vna, lastMetrics: { fitOk: true, uncertaintyHz: 0.04 } } }, {}],
  'clock-fault': [{ ...fresh(), clock: { locked: true }, failures: { clockDrift: false } }, {}, true],
  averaging: [{ ...fresh(), vna: { ...fresh().vna, averagingEnabled: true, averagingCount: 16, lastMetrics: { fitOk: true, uncertaintyHz: 0.01 } } }, {}],
  thermal: [{ ...fresh(), experiment: { records: thermalRecs } }, { thermal: 5.1 }],
  location: [{ ...fresh(), experiment: { records: locRecs } }, { location: 79 }],
  repeatability: [{ ...fresh(), experiment: { randomized: true, records: repRecs } }, {}],
};
{
  assert.equal(L.LESSONS.length, 8);
  assert.deepEqual(new Set(L.LESSONS.map(l => l.id)).size, 8, 'lesson ids are unique');
  for (const l of L.LESSONS) {
    assert.ok(l.objectives.length >= 2 && l.hints.length >= 2 && l.goal && [1, 2, 3].includes(l.level), l.id);
    assert.ok(new Set(l.objectives.map(o => o.id)).size === l.objectives.length, `${l.id}: objective ids are unique`);
    const [state, answers] = solved[l.id]; assert.ok(state, `a solved state exists for ${l.id}`);
    const [, , needsInjection] = solved[l.id];
    const good = needsInjection ? E.evaluate(l, state, E.applyEvaluation(E.EMPTY_PROGRESS, l, E.evaluate(l, { ...fresh(), failures: { clockDrift: true } }, E.EMPTY_PROGRESS))) : ok(state, answers)(l.id);
    assert.equal(good.complete, true, `${l.id} must be solvable (met ${good.met.join()})`);
    const idle = ok(fresh(), {})(l.id);
    assert.equal(idle.complete, false, `${l.id} must not pass on an untouched lab`);
  }
  // ordered lesson: clearing a fault that was never injected must not count
  {
    const l = L.LESSON_BY_ID['clock-fault'], e0 = ok({ ...fresh(), clock: { locked: true } })('clock-fault');
    assert.deepEqual(e0.met, [], 'nothing counts before the fault is injected');
    const injected = { ...fresh(), failures: { clockDrift: true } }; let p = E.applyEvaluation(E.EMPTY_PROGRESS, l, E.evaluate(l, injected, E.EMPTY_PROGRESS));
    assert.deepEqual(p.lessons['clock-fault'].done, ['inject']);
    const cleared = { ...fresh(), clock: { locked: true } }, ev = E.evaluate(l, cleared, p); assert.equal(ev.complete, true);
  }
  console.log('PASS all 8 lessons pass on a hand-built solution and fail on an untouched lab');
}
{
  // answers are graded against the student's own data and the model
  const t = (a) => ok({ ...fresh(), experiment: { records: thermalRecs } }, { thermal: a })('thermal');
  assert.equal(t(5.1).complete, true); assert.equal(t(7).complete, false, 'a wrong answer fails'); assert.equal(t(undefined).complete, false);
  const noData = ok({ ...fresh(), experiment: { records: thermalRecs.slice(0, 2) } }, { thermal: 5 })('thermal');
  assert.equal(noData.complete, false, 'two temperatures are not enough');
  const sameTemp = ok({ ...fresh(), experiment: { records: [rec(), rec(), rec()] } }, { thermal: 5 })('thermal');
  assert.equal(sameTemp.complete, false, 'no temperature spread means no coefficient');
  const lz = a => ok({ ...fresh(), experiment: { records: locRecs } }, { location: a })('location');
  assert.equal(lz(80.1).complete, true); assert.equal(lz(40).complete, false);
  const lineOnly = ok({ ...fresh(), experiment: { records: locRecs.filter(r => r.y === 0 && r.z === 0).concat(rec({ x: 5 })) } }, { location: 80 })('location');
  assert.equal(lineOnly.complete, false, 'moving along one axis does not map Z');
  const bad = ok({ ...fresh(), experiment: { records: thermalRecs.map(r => ({ ...r, fit: { ok: false } })) } }, { thermal: 5 })('thermal');
  assert.equal(bad.complete, false, 'failed fits do not count as data');
  console.log('PASS numeric answers are graded against the learner’s data and the model');
}
{
  const l = L.LESSON_BY_ID['bring-up'];
  let p = E.EMPTY_PROGRESS;
  const half = { ...fresh(), facility: { power: true } };
  let ev = E.evaluate(l, half, p); p = E.applyEvaluation(p, l, ev);
  assert.deepEqual(p.lessons['bring-up'].done, ['power']);
  ev = E.evaluate(l, fresh(), p);   // the learner switches the breaker off again
  assert.deepEqual(ev.met, ['power'], 'objectives stay met once earned');
  p = E.useHint(E.useHint(p, 'bring-up'), 'bring-up');
  assert.equal(p.lessons['bring-up'].hintsUsed, 2);
  const full = solved['bring-up'][0]; ev = E.evaluate(l, full, p);
  assert.equal(ev.complete, true);
  const done = E.applyEvaluation(p, l, ev, new Date('2026-11-08T12:00:00Z'));
  assert.equal(done.lessons['bring-up'].score, 80, 'two hints cost 20 points');
  assert.equal(done.lessons['bring-up'].completedAt, '2026-11-08T12:00:00.000Z');
  assert.equal(E.useHint(done, 'bring-up'), done, 'no hints after completion');
  assert.equal(E.applyEvaluation(done, l, E.evaluate(l, fresh(), done), new Date('2027-01-01')), done, 'a finished lesson is never re-scored');
  assert.equal(E.scoreFor(0), 100); assert.equal(E.scoreFor(9), 40, 'the score never drops below 40'); assert.equal(E.scoreFor(-3), 100);
  assert.deepEqual(E.resetLesson(done, 'bring-up').lessons, {});
  assert.equal(E.setAnswer(done, 'thermal', NaN), done); assert.equal(E.setAnswer(done, 'thermal', 4.5).answers.thermal, 4.5);
  console.log('PASS objectives are sticky, hints cost points, scores are final and floored');
}
{
  const crash = { id: 'x', level: 1, title: 'x', goal: 'x', hints: [], objectives: [{ id: 'a', text: 'a', check: () => { throw new Error('boom'); } }] };
  assert.equal(E.evaluate(crash, fresh(), E.EMPTY_PROGRESS).complete, false, 'a throwing check is treated as not met');
  assert.equal(E.evaluate(L.LESSON_BY_ID['bring-up'], {}, E.EMPTY_PROGRESS).complete, false, 'an empty state does not crash');
  console.log('PASS broken checks and empty states fail safe');
}
{
  const p = { ...E.EMPTY_PROGRESS, lessons: { 'bring-up': { done: ['power'], hintsUsed: 1, completedAt: '2026-11-08T00:00:00Z', score: 90 }, 'first-sweep': { done: [], hintsUsed: 0, completedAt: '2026-11-08T01:00:00Z', score: 100 } } };
  const s = E.summarize(p); assert.deepEqual(s, { completed: 2, total: 8, averageScore: 95 });
  const r = await E.buildReport(p, '  <b>Sam</b> Lee  ', new Date('2026-11-08T12:00:00Z'));
  assert.match(r.hash, /^[0-9a-f]{64}$/); assert.equal(await E.verifyReport(r), true);
  assert.equal(await E.verifyReport({ ...r, summary: { ...r.summary, averageScore: 100 } }), false, 'an edited report fails verification');
  assert.equal(await E.verifyReport({ ...r, learner: 'Someone else' }), false);
  const html = E.reportHtml({ ...r, learner: '<script>alert(1)</script>' });
  assert.ok(!html.includes('<script>alert'), 'names are escaped in the report page'); assert.ok(html.includes('&lt;script&gt;') && html.includes(r.hash));
  assert.equal((await E.buildReport(p, '', new Date())).learner, 'Unnamed learner');
  assert.equal((await E.buildReport(p, 'x'.repeat(500), new Date())).learner.length, 80);
  console.log('PASS the classroom report is hashed, tamper-evident and escapes every value');
}
{
  const hostile = { version: 1, lessons: { 'bring-up': { done: ['power', 7, null], hintsUsed: 9999, completedAt: 5, score: 1e9 }, evil: { done: [] }, __proto__: { x: 1 } }, answers: { thermal: 'x', location: 4, nope: 3 } };
  const p = E.parseProgress(JSON.parse(JSON.stringify(hostile)));
  assert.deepEqual(Object.keys(p.lessons), ['bring-up']); assert.deepEqual(p.lessons['bring-up'].done, ['power']);
  assert.equal(p.lessons['bring-up'].hintsUsed, 99); assert.equal(p.lessons['bring-up'].score, 100); assert.ok(!('completedAt' in p.lessons['bring-up']));
  assert.deepEqual(p.answers, { location: 4 });
  assert.equal(E.parseProgress(null), E.EMPTY_PROGRESS); assert.equal(E.parseProgress({ version: 2 }), E.EMPTY_PROGRESS); assert.equal(E.parseProgress('x'), E.EMPTY_PROGRESS);
  const mem = {}; const st = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  E.saveProgress({ ...E.EMPTY_PROGRESS, answers: { thermal: 5 } }, st); assert.equal(E.loadProgress(st).answers.thermal, 5);
  assert.equal(E.loadProgress({ getItem: () => { throw new Error('blocked'); } }), E.EMPTY_PROGRESS); E.saveProgress(E.EMPTY_PROGRESS, { setItem: () => { throw new Error('quota'); } });
  console.log('PASS stored progress is validated and blocked storage is tolerated');
}
{
  const app = fs.readFileSync(new URL('../src/MetrologyLabV3.tsx', import.meta.url), 'utf8');
  assert.ok(/"learn", "Learning Paths"/.test(app) && /<LearningPaths /.test(app));
  assert.equal(route.pageFromHash('#/learn'), 'learn');
  const sim = fs.readFileSync(new URL('../src/simulation/model.ts', import.meta.url), 'utf8');
  assert.ok(/THERMAL_HZ_PER_C/.test(sim) && !/\(chamber\.temperature - 20\) \* 5/.test(sim), 'the model and the lesson share one thermal constant');
  console.log('PASS Learning Paths is in the navigation, linkable and shares the model constants');
}

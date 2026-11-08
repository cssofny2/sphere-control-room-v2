import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadTypeScript } from './load-typescript.mjs';

const R = await loadTypeScript(new URL('../src/technician/reviewRun.ts', import.meta.url));
const I = await loadTypeScript(new URL('../src/technician/intents.ts', import.meta.url));

let id = 0;
const rec = (o = {}) => { id++; return { id: `r${id}`, runId: 'r', timestamp: `2026-11-08T00:${String(Math.floor(id / 60)).padStart(2, '0')}:${String(id % 60).padStart(2, '0')}Z`, x: 0, y: 0, z: 0, resonance: 230500, uncertaintyHz: 0.04, fit: { ok: true }, valid: true, temp: 22, pressure: 1e-4, clockLocked: true, faradayEnabled: true, isolationEnabled: true, vnaCalibrated: true, ...o }; };
const ids = r => r.findings.map(f => f.id);

{
  const e = R.reviewRun([]);
  assert.equal(e.count, 0); assert.deepEqual(ids(e), ['empty']);
  console.log('PASS an empty ledger is reported as such');
}
{
  const good = []; for (const x of [-20, 0, 20]) for (let k = 0; k < 3; k++) good.push(rec({ x, resonance: 230500 + x * 45 + (k - 1) * 0.02, pointId: `p${x}`, repeatIndex: k + 1, attemptIndex: 1 }));
  const r = R.reviewRun(good);
  assert.equal(r.count, 9); assert.equal(r.positions, 3);
  assert.ok(ids(r).includes('sound'), ids(r).join());
  assert.ok(!r.findings.some(f => f.severity === 'issue' || f.severity === 'warn'));
  assert.ok(ids(r).includes('field') && ids(r).includes('axes'), 'a line along X: slope known, Y and Z unknown');
  assert.ok(r.findings.find(f => f.id === 'field').detail.includes('X 45.0'));
  console.log('PASS a clean run is judged sound and the unmeasured axes are called out');
}
{
  const bad = [rec({ clockLocked: false }), rec({ clockLocked: false, faradayEnabled: false }), rec({ vnaCalibrated: false, isolationEnabled: false }), rec({ fit: { ok: false } }), rec({ temp: 22.5, pressure: 0.02 }), rec()];
  const r = R.reviewRun(bad);
  for (const k of ['clock', 'shield', 'isolation', 'cal', 'fit', 'temp', 'pressure']) assert.ok(ids(r).includes(k), `finds ${k}`);
  assert.equal(r.findings[0].severity, 'issue', 'problems sort first');
  assert.equal(r.findings.find(f => f.id === 'clock').severity, 'issue');
  assert.ok(r.findings.find(f => f.id === 'clock').detail.includes('2 of 6'));
  assert.ok(!ids(r).includes('sound'));
  console.log('PASS condition problems are found, counted and ranked');
}
{
  const noisy = [0, 1, 2, 3].map(k => rec({ resonance: 230500 + [0, 3, -2, 1][k], pointId: 'p', repeatIndex: k + 1, attemptIndex: 1 }));
  assert.ok(ids(R.reviewRun(noisy)).includes('scatter'), 'scatter far above the fit uncertainty is flagged');
  const drift = [0, 1, 2, 3, 4, 5].map(k => rec({ resonance: 230500 + k * 0.4 + (k % 2) * 0.01, pointId: 'q', repeatIndex: k + 1, attemptIndex: 1 }));
  const d = R.reviewRun(drift);
  assert.ok(ids(d).includes('drift'), 'a steady trend across repeats is called drift');
  const once = R.reviewRun([rec({ x: 5, pointId: 'a' }), rec({ x: -5, pointId: 'b' })]);
  assert.ok(ids(once).includes('repeats'));
  console.log('PASS scatter, drift and missing repeats are detected');
}
{
  const r = R.reviewRun([rec({ clockLocked: false }), rec()]);
  const said = R.spokenReview(r);
  assert.match(said, /I looked at 2 measurements across 1 position\./);
  assert.match(said, /Reference clock was not locked/);
  assert.match(said, /I would wait for the clock/);
  assert.ok(said.length < 600, 'short enough to say on the phone');
  assert.match(R.spokenReview(R.reviewRun([])), /nothing in the ledger/);
  assert.equal(R.spokenReview(R.reviewRun([rec()]), 'Sam').startsWith('Sam, '), true);
  console.log('PASS the spoken review is short, specific and says what to do');
}
{
  for (const t of ['review my run', 'Can you review my data?', 'how did my run go', "how's my data looking", 'are my measurements any good', 'critique the results', 'go over my experiment', 'how are my measurements']) assert.deepEqual(I.parseCommand(t), { type: 'review' }, t);
  for (const t of ['start the run', 'export my data', 'clear the measurements', 'review the procedure', 'what is a VNA', 'stop the experiment', 'turn on the vna']) assert.notDeepEqual(I.parseCommand(t), { type: 'review' }, t);
  console.log('PASS review requests are recognised and lab commands are not mistaken for them');
}
{
  const ctl = fs.readFileSync(new URL('../src/technician/callController.ts', import.meta.url), 'utf8');
  assert.ok(/intent\?\.type === 'review'/.test(ctl) && /spokenReview\(reviewRun\(/.test(ctl));
  assert.ok(!/review[^\n]*(dispatch|runner\.enqueue)/.test(ctl.slice(ctl.indexOf("type === 'review'"), ctl.indexOf("type === 'review'") + 300)), 'a review never starts a lab action');
  const app = fs.readFileSync(new URL('../src/MetrologyLabV3.tsx', import.meta.url), 'utf8');
  assert.ok(/<RunReviewCard/.test(app));
  console.log('PASS the phone and the Runs page both use the review, and it is read-only');
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadTypeScript } from './load-typescript.mjs';

const model = await loadTypeScript(new URL('../src/simulation/model.ts', import.meta.url));
const meas = await loadTypeScript(new URL('../src/simulation/measurement.ts', import.meta.url));
const stats = await loadTypeScript(new URL('../src/simulation/stats.ts', import.meta.url));

const base = () => ({
  stage: { x: 0, y: 0, z: 0 }, chamber: { temperature: 22, pressure: 1e-4, faraday: true },
  model: { location: true, temperature: true, pressure: true, clockDrift: true, fixtureDrift: true, rfNoise: true },
  clock: { locked: true, cableFault: false }, failures: {},
  vna: { center: 230500, span: 5000, startFrequency: 228000, stopFrequency: 233000, points: 401, ifbw: 100,
    averagingEnabled: false, averagingCount: 1, traceMath: 'none', reference: [] },
  facility: { seed: 7, simulationTime: 0 },
});
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };

/** Fits N seeded traces of one lab condition; returns the per-trace error against the model's true resonance. */
function campaign(mutate, N = 120) {
  const errors = [], sigmas = [], qs = [], failures = [];
  for (let k = 0; k < N; k++) {
    const s = base(); mutate(s); s.facility.simulationTime = k * 1.37;
    const m = meas.measureTrace(model.buildSweep(s), model.BASE_FREQUENCY);
    if (!m.fit.ok) { failures.push(m.fit.reason); continue; }
    errors.push(m.resonance - model.trueFrequency(s)); sigmas.push(m.uncertaintyHz); qs.push(m.q);
  }
  return { errors, sigmas, qs, failures };
}

// ── Recovery: f0 and Q come back from noisy traces, with no fixed placeholders ──────────────────
{
  const c = campaign(() => {});
  assert.equal(c.failures.length, 0, 'nominal traces must all fit');
  assert.ok(Math.abs(mean(c.errors)) < 0.05, `f0 must be unbiased (bias ${mean(c.errors)})`);
  assert.ok(Math.max(...c.errors.map(Math.abs)) < 0.25, 'no nominal fit may be off by more than 0.25 Hz');
  assert.ok(Math.abs(mean(c.qs) - 4500) < 45, `Q must recover the model's 4500 (got ${mean(c.qs)})`);
  console.log('PASS fit recovers f0 and Q from seeded noisy traces');
}
{
  const c = campaign(s => { s.chamber.pressure = 100; });
  assert.ok(Math.abs(mean(c.qs) - 1200) < 20, `Q in air must be about 1200 (got ${mean(c.qs)})`);
  console.log('PASS Q follows pressure');
}

// ── The reported uncertainty must match the real scatter, in good and bad conditions ─────────────
for (const [label, mutate] of [
  ['nominal', () => {}],
  ['no Faraday cage', s => { s.chamber.faraday = false; }],
  ['clock unlocked', s => { s.clock.locked = false; }],
  ['IFBW 1 kHz', s => { s.vna.ifbw = 1000; }],
]) {
  const c = campaign(mutate, 200);
  const ratio = sd(c.errors) / mean(c.sigmas);
  assert.ok(ratio > 0.75 && ratio < 1.3, `${label}: actual scatter / reported sigma = ${ratio.toFixed(2)}, expected about 1`);
}
console.log('PASS reported uncertainty matches actual scatter (nominal, EMI, unlocked clock, wide IFBW)');
{
  const nominal = mean(campaign(() => {}).sigmas), emi = mean(campaign(s => { s.chamber.faraday = false; }).sigmas);
  assert.ok(emi > 10 * nominal, 'interference must visibly raise the uncertainty');
  const one = mean(campaign(() => {}).sigmas);
  const avg = mean(campaign(s => { s.vna.averagingEnabled = true; s.vna.averagingCount = 16; }).sigmas);
  assert.ok(one / avg > 3 && one / avg < 5, `16x averaging must cut sigma about 4x (got ${(one / avg).toFixed(2)}x)`);
  const dense = mean(campaign(s => { s.vna.points = 1001; }).sigmas);
  assert.ok(dense < one, 'more points must lower sigma');
  console.log('PASS uncertainty responds to noise, averaging and point count');
}

// ── Honest failure instead of a made-up number ──────────────────────────────────────────────────
{
  const far = base(); far.vna.center = 240000;
  const m = meas.measureTrace(model.buildSweep(far), model.BASE_FREQUENCY);
  assert.equal(m.fit.ok, false);
  assert.equal(m.fit.reason, 'no_dip');
  assert.equal(m.q, 0, 'a failed fit must not invent a Q');
  assert.ok(m.uncertaintyHz > 1, 'a failed fit reports the coarse point spacing as its uncertainty, which fails the 1 Hz gate');
  const flat = Array.from({ length: 101 }, (_, i) => ({ freq: 1000 + i, s11: -2 }));
  assert.equal(meas.fitTrace(flat).fit.reason, 'no_dip');
  assert.equal(meas.fitTrace(flat.slice(0, 5)).fit.reason, 'too_few_points');
  const edge = base(); edge.vna.center = 230500 + 2800;
  assert.equal(meas.fitTrace(model.buildSweep(edge)).fit.ok, false, 'a resonance beyond the sweep edge must not produce a fit');
  const coarse = base(); coarse.vna.span = 100000; coarse.vna.points = 1001;
  assert.equal(meas.fitTrace(model.buildSweep(coarse)).fit.reason, 'under_resolved');
  const nan = model.buildSweep(base()); nan[10].s11 = NaN; nan[10].raw = NaN; nan[200].raw = Infinity;
  assert.equal(meas.fitTrace(nan).fit.ok, true, 'non-finite points are skipped, not fatal');
  console.log('PASS failures are explicit: no dip, too few points, edge, under-resolved');
}

// ── Trace math must not corrupt the fit ─────────────────────────────────────────────────────────
{
  const s = base(), ref = model.buildSweep(s);
  s.vna.traceMath = 'diff'; s.vna.reference = ref;
  const trace = model.buildSweep(s);
  const tf = meas.fitTrace(trace);
  assert.equal(tf.displayDiffers, true);
  assert.ok(tf.fit.ok && Math.abs(tf.fit.f0Hz - model.trueFrequency(s)) < 0.3, 'fit uses the measured trace, not the displayed difference');
  const plain = meas.fitTrace(model.buildSweep(base()));
  assert.equal(plain.displayDiffers, false);
  assert.equal(meas.fitTrace(trace), tf, 'one fit per trace array, shared by every view');
  assert.equal(tf.curve.length, trace.length);
  console.log('PASS trace math is ignored by the fit and the fit is cached per trace');
}

// ── Speed: fitting on the UI thread is cheap, so no worker is needed ────────────────────────────
{
  const trace = model.buildSweep({ ...base(), vna: { ...base().vna, points: 1001 } });
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) meas.fitLorentzianDip(trace.map(p => p.freq), trace.map(p => p.raw));
  const per = (performance.now() - t0) / 20;
  assert.ok(per < 25, `a 1001-point fit must take well under a frame (took ${per.toFixed(2)} ms)`);
  console.log(`PASS 1001-point fit takes ${per.toFixed(2)} ms`);
}

// ── Statistics ──────────────────────────────────────────────────────────────────────────────────
{
  assert.equal(stats.studentT95(1), 12.706);
  assert.equal(stats.studentT95(2), 4.303);
  assert.equal(stats.studentT95(30), 2.042);
  assert.equal(stats.studentT95(31), 1.96);
  assert.ok(Number.isNaN(stats.studentT95(0)));
  const w = stats.meanAndSd([230500.1, 230500.2, 230500.4, 230500.3]);
  assert.ok(Math.abs(w.mean - 230500.25) < 1e-9 && Math.abs(w.sd - 0.12909944487) < 1e-6, 'Welford must stay accurate at a 230 kHz offset');
  assert.equal(stats.meanAndSd([5]).sd, null);

  const rec = (resonance, o = {}) => ({ x: 0, y: 0, z: 0, pointId: 'p1', resonance, uncertaintyHz: 0.05, fit: { ok: true }, ...o });
  const three = stats.summarizePositions([rec(10), rec(12), rec(14)]);
  assert.equal(three.length, 1);
  const p = three[0];
  assert.equal(p.n, 3);
  assert.equal(p.meanHz, 12);
  assert.ok(Math.abs(p.sdHz - 2) < 1e-12);
  assert.ok(Math.abs(p.semHz - 2 / Math.sqrt(3)) < 1e-12);
  assert.ok(Math.abs(p.fitUHz - Math.sqrt(3 * 0.05 ** 2) / 3) < 1e-12);
  assert.equal(p.standardUncertaintyHz, p.semHz, 'scatter larger than the fit uncertainty governs');
  assert.equal(p.coverageFactor, 4.303);
  assert.ok(Math.abs(p.expandedUncertaintyHz - 4.303 * 2 / Math.sqrt(3)) < 1e-9);
  assert.equal(p.rangeHz, 4);

  const tight = stats.summarizePositions([rec(10), rec(10.001), rec(10.002)])[0];
  assert.equal(tight.standardUncertaintyHz, tight.fitUHz, 'the fit uncertainty governs when repeats agree more closely than it');
  assert.equal(tight.coverageFactor, 2);

  const single = stats.summarizePositions([rec(7, { uncertaintyHz: 0.04 })])[0];
  assert.equal(single.sdHz, null);
  assert.equal(single.semHz, null);
  assert.equal(single.standardUncertaintyHz, 0.04);
  assert.equal(single.expandedUncertaintyHz, 0.08);

  const mixed = stats.summarizePositions([rec(10), rec(99, { fit: { ok: false } }), rec(12, { excluded: true }), rec(11)]);
  assert.equal(mixed[0].n, 2, 'failed fits and excluded records stay out of the statistics');
  assert.equal(mixed[0].failed, 1);
  assert.equal(mixed[0].meanHz, 10.5);

  const retried = stats.summarizePositions([
    rec(10, { repeatIndex: 1, attemptIndex: 1 }), rec(10.4, { repeatIndex: 1, attemptIndex: 2 }), rec(10.1, { repeatIndex: 1, attemptIndex: 3 }),
    rec(10.2, { repeatIndex: 2, attemptIndex: 1 }),
  ])[0];
  assert.equal(retried.n, 2, 'rescans of one planned repeat are not independent repeats');
  assert.equal(retried.superseded, 2);
  assert.ok(Math.abs(retried.meanHz - 10.15) < 1e-12, 'the latest attempt of each repeat is the one kept');
  const handRepeats = stats.summarizePositions([
    { x: 1, y: 0, z: 0, resonance: 5, fit: { ok: true }, uncertaintyHz: 0.1, repeatIndex: 1, attemptIndex: 1 },
    { x: 1, y: 0, z: 0, resonance: 5.1, fit: { ok: true }, uncertaintyHz: 0.1, repeatIndex: 1, attemptIndex: 1 },
  ])[0];
  assert.equal(handRepeats.n, 2, 'hand-captured repeats (no planned point) are all kept');
  assert.equal(handRepeats.superseded, 0);

  const onlyFailed = stats.summarizePositions([rec(99, { fit: { ok: false } })])[0];
  assert.equal(onlyFailed.n, 0);
  assert.equal(onlyFailed.standardUncertaintyHz, null);

  const manual = stats.summarizePositions([
    { x: -0.04, y: 0, z: 0, resonance: 1, fit: { ok: true }, uncertaintyHz: 0.1 },
    { x: 0.03, y: -0.02, z: 0.01, resonance: 3, fit: { ok: true }, uncertaintyHz: 0.1 },
    { x: 10, y: 0, z: 0, resonance: 5, fit: { ok: true }, uncertaintyHz: 0.1 },
  ]);
  assert.equal(manual.length, 2, 'hand-captured points group by position to 0.1 mm, and -0.0 equals 0.0');
  assert.equal(manual[0].n, 2);
  assert.deepEqual(stats.summarizePositions([]), []);
  console.log('PASS per-position statistics match hand-computed values');
}

// ── No placeholders left in the record path ─────────────────────────────────────────────────────
{
  const app = fs.readFileSync(new URL('../src/MetrologyLabV3.tsx', import.meta.url), 'utf8');
  assert.ok(!/uncertaintyHz:\s*0\.25\b/.test(app), 'uncertainty must not be a constant');
  assert.ok(!/repeatSdHz\s*:/.test(app) && !/repeatMeanHz\s*:/.test(app), 'repeat statistics must not be constants');
  assert.ok(!/q:\s*state\.chamber\.pressure\s*>\s*1\s*\?\s*1200\s*:\s*4500/.test(app), 'Q must come from the fit');
  assert.ok(/measureTrace\(trace,/.test(app), 'records must be built from the fitted measurement');
  console.log('PASS record creation has no hard-coded uncertainty, repeat SD or Q');
}

import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

const ld = p => loadTypeScript(new URL(`../src/${p}`, import.meta.url));
const St = await ld('insights/stability.ts'), Out = await ld('insights/outliers.ts'), Bud = await ld('insights/budget.ts'), Con = await ld('insights/conformance.ts');
const Log = await ld('insights/eventLog.ts'), Rep = await ld('insights/report.ts'), U = await ld('features/units.ts'), D = await ld('features/displaySettings.ts');
const Tpl = await ld('simulation/templates.ts'), Plan = await ld('simulation/plan.ts');
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`);

// Allan deviation: constant -> 0; alternating +-1 -> 2 at m=1 (known value); needs 3+ samples; skips NaN
{ assert.deepEqual(St.overlappingAllan([1, 1, 1, 1, 1, 1], 1).map(p => p.adev), [0, 0]);
  const alt = St.overlappingAllan([1, -1, 1, -1, 1, -1, 1, -1], 2); near(alt[0].adev, Math.sqrt(2)); assert.equal(alt[0].tauS, 2); assert.equal(alt[1].tauS, 4);
  assert.deepEqual(St.overlappingAllan([1, 2], 1), []); assert.deepEqual(St.overlappingAllan([1, 2, 3], 0), []);
  assert.equal(St.overlappingAllan([1, NaN, 2, 3, NaN, 4], 1).length, 1, 'gaps shorten the series');
  console.log('PASS Allan deviation matches known values and rejects short or bad input'); }
// white noise falls with tau, a random walk rises
{ let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32 - 0.5;
  const white = Array.from({ length: 2048 }, rnd); assert.equal(St.noiseHint(St.overlappingAllan(white, 1)).kind, 'white');
  let a = 0; const walk = Array.from({ length: 2048 }, () => (a += rnd())); assert.equal(St.noiseHint(St.overlappingAllan(walk, 1)).kind, 'random-walk');
  assert.equal(St.noiseHint([]).kind, 'unclear'); console.log('PASS noise type is read from the slope'); }
// trend and drift verdict
{ const t = [0, 1, 2, 3, 4, 5, 6, 7], y = t.map(x => 100 + 2 * x);
  const tr = St.linearTrend(t, y); near(tr.slopePerS, 2); near(tr.intercept, 100); near(tr.r2, 1); assert.equal(St.driftVerdict(tr, 7, 1), 'drifting');
  const flat = St.linearTrend(t, [5, 5.1, 4.9, 5, 5.05, 4.95, 5, 5]); assert.equal(St.driftVerdict(flat, 7, 0.5), 'stable');
  assert.equal(St.linearTrend([1, 1, 1], [1, 2, 3]), null); assert.equal(St.driftVerdict(null, 5, 1), 'insufficient');
  assert.equal(St.driftVerdict({ ...tr, slopePerS: 0.001, slopeSe: 0.0001 }, 10, 1), 'stable', 'a clear but tiny slope is not drift');
  near(St.driftUncertainty(2, 10), 10 / Math.sqrt(3)); assert.equal(St.driftUncertainty(NaN, 10), 0); console.log('PASS trend, drift verdict and drift uncertainty'); }
// outliers
{ const r = Out.screenOutliers([10, 10.1, 9.9, 10.05, 9.95, 50]); assert.deepEqual(r.flags.map(f => f.index), [5]); assert.ok(r.flags[0].score > 3.5);
  assert.equal(Out.screenOutliers([1, 1, 1, 1, 9]).flags.length, 1, 'MAD of zero falls back to mean absolute deviation');
  assert.equal(Out.screenOutliers([1, 1, 1, 1]).flags.length, 0); assert.equal(Out.screenOutliers([1, 99]).flags.length, 0, 'needs three values');
  const recs = [10, 10.1, 9.9, 10.05, 99].map(f => ({ x: 0, y: 0, z: 0, resonance: f })).concat([{ x: 5, y: 0, z: 0, resonance: 1 }, { x: 5, y: 0, z: 0, resonance: 500 }]);
  const o = Out.screenRecords(recs); assert.deepEqual(o.map(x => x.recordIndex), [4], 'groups of fewer than three are not screened');
  assert.equal(Out.screenRecords(recs.map((r, i) => (i === 4 ? { ...r, excluded: true } : r))).length, 0); console.log('PASS robust outlier screen'); }
// budget
{ const recs = [{ x: 0, y: 0, z: 0, resonance: 100, uncertaintyHz: 0.1 }, { x: 0, y: 0, z: 0, resonance: 102, uncertaintyHz: 0.1 }, { x: 0, y: 0, z: 0, resonance: 101, uncertaintyHz: 0.1 }, { x: 10, y: 0, z: 0, resonance: 200, uncertaintyHz: 0.5 }];
  const b = Bud.runBudget(recs); assert.equal(b.rows.length, 2); near(b.pooledSdHz, 1); assert.equal(b.pooledDof, 2); assert.equal(b.rows[0].dominant, 'repeatability'); assert.equal(b.rows[1].dominant, 'fit');
  assert.equal(b.driftHz, 0); const bd = Bud.runBudget(recs, { slopeHzPerS: 0.1, durationS: 60 }); near(bd.driftHz, 3 / Math.sqrt(3)); assert.ok(bd.worstCombinedHz > b.worstCombinedHz);
  assert.equal(Bud.runBudget([]).worstCombinedHz, null); console.log('PASS uncertainty budget pools repeatability and adds the drift term'); }
// conformance
{ const spec = { targetHz: 1000, toleranceHz: 1 };
  assert.equal(Con.decide(1000.2, 0.3, spec), 'pass'); assert.equal(Con.decide(1000.8, 0.5, spec), 'indeterminate'); assert.equal(Con.decide(1003, 0.5, spec), 'fail'); assert.equal(Con.decide(999.2, null, spec), 'pass');
  assert.equal(Con.decide(1001, 0, spec), 'pass', 'exactly on the limit with no uncertainty passes');
  const c = Con.conformance([{ key: 'a', meanHz: 1000, expandedHz: 0.1 }, { key: 'b', meanHz: 1005, expandedHz: 0.1 }], spec); assert.deepEqual(c.counts, { pass: 1, fail: 1, indeterminate: 0 });
  assert.equal(Con.validSpec({ targetHz: 0, toleranceHz: 1 }), false); assert.equal(Con.validSpec(spec), true); console.log('PASS conformity uses the whole expanded interval'); }
// event log
{ const ev = [{ simulationTime: 1, subsystem: 'VNA', level: 'info', text: 'Sweep done' }, { simulationTime: 5, subsystem: 'CHAMBER', level: 'warning', text: 'Pressure high', operator: 'Ann' }, { simulationTime: 9, subsystem: 'VNA', level: 'critical', text: '=HYPERLINK("x")' }];
  assert.equal(Log.filterEvents(ev, { levels: ['warning', 'critical'] }).length, 2); assert.equal(Log.filterEvents(ev, { subsystem: 'VNA' }).length, 2); assert.equal(Log.filterEvents(ev, { query: 'ann' }).length, 1);
  assert.equal(Log.filterEvents(ev, { fromSimS: 2, toSimS: 6 }).length, 1); assert.equal(Log.filterEvents(ev, {}).length, 3); assert.deepEqual(Log.subsystemsOf(ev), ['CHAMBER', 'VNA']); assert.deepEqual(Log.countByLevel(ev), { info: 1, warning: 1, critical: 1 });
  const csv = Log.eventsCsv(ev); assert.ok(csv.includes("'=HYPERLINK"), 'formula cells are defused'); assert.equal(csv.split('\n').length, 4); console.log('PASS event log filters and exports safely'); }
// report
{ const html = Rep.reportHtml({ title: '<b>T</b>', generatedAt: 'now', operator: 'O"p', recordCount: 1, budget: [{ x: 0, y: 0, z: 0, n: 1, meanHz: 1, repeatabilityHz: null, fitHz: 0.1, standardHz: 0.1, expandedHz: 0.2, k: 2, dominant: 'fit', key: 'k', }], pooledSdHz: null, outliers: [{ recordIndex: 0, position: '<img src=x onerror=1>', resonance: 1, score: 9, medianHz: 1 }], spec: { targetHz: 1, toleranceHz: 1 }, conformity: [{ key: '<k>', meanHz: 1, expandedHz: 0.2, deviationHz: 0, decision: 'pass' }], drift: { verdict: 'stable', slopeHzPerS: 0.001 }, notes: 'a<script>' });
  assert.ok(!/<script|<img|<b>T/.test(html), 'nothing from the data is left unescaped'); assert.ok(html.includes('&lt;img') && html.startsWith('<!doctype html>')); assert.ok(Rep.reportHtml({ title: 't', generatedAt: 'n', recordCount: 0, budget: [], pooledSdHz: null, outliers: [] }).includes('No data')); console.log('PASS the report escapes every value and handles empty data'); }
// units
{ near(U.fromTorr(760, 'Pa'), 101325); near(U.fromTorr(760, 'mbar'), 1013.25); near(U.toTorr(U.fromTorr(1e-3, 'Pa'), 'Pa'), 1e-3); near(U.fromCelsius(25, 'K'), 298.15); near(U.fromCelsius(100, '°F'), 212); near(U.toCelsius(U.fromCelsius(22, '°F'), '°F'), 22);
  assert.equal(U.fmtPressure(NaN, 'Pa'), '–'); assert.equal(U.fmtTemperature(0, 'K'), '273.15 K');
  assert.deepEqual(U.sanitizeUnits({ pressure: 'psi', temperature: 'K' }), { pressure: 'Torr', temperature: 'K' }); assert.deepEqual(U.sanitizeUnits(null), U.DEFAULT_UNITS);
  U.setUnits({ pressure: 'Pa' }); assert.equal(U.getUnits().pressure, 'Pa'); U.setUnits({ pressure: 'bogus' }); assert.equal(U.getUnits().pressure, 'Torr', 'a bad value falls back instead of being stored'); console.log('PASS unit conversions round-trip and bad preferences fall back'); }
// display settings
{ assert.deepEqual(D.displayClasses(D.DEFAULT_DISPLAY), []); assert.deepEqual(D.displayClasses({ contrast: 'high', textSize: 130, motion: 'reduced', palette: 'cvd' }), ['disp-high-contrast', 'disp-text-130', 'disp-reduce-motion', 'disp-cvd']);
  assert.deepEqual(D.sanitizeDisplay({ textSize: 999, contrast: 'x' }), D.DEFAULT_DISPLAY);
  const set = new Set(['disp-text-115', 'other']); D.applyDisplay({ classList: { remove: (...c) => c.forEach(x => set.delete(x)), add: (...c) => c.forEach(x => set.add(x)) } }, { ...D.DEFAULT_DISPLAY, contrast: 'high' });
  assert.deepEqual([...set].sort(), ['disp-high-contrast', 'other'], 'old display classes are replaced and unrelated ones kept'); console.log('PASS display settings map to classes and sanitize'); }
// templates
{ assert.ok(Tpl.SCAN_TEMPLATES.length >= 5); assert.equal(new Set(Tpl.SCAN_TEMPLATES.map(t => t.id)).size, Tpl.SCAN_TEMPLATES.length);
  for (const t of Tpl.SCAN_TEMPLATES) { const r = Plan.buildAxisPlan({ ...t.settings, seed: 1, anchor: { x: 0, y: 0, z: 0 } }); assert.equal(r.ok, true, `${t.id}: ${JSON.stringify(r.issues)}`); }
  assert.equal(Tpl.templateById('quick-x').title, 'Quick X survey'); assert.equal(Tpl.templateById('nope'), undefined); console.log('PASS every scan template builds a valid plan'); }
// wiring: pages are routable, in the navigation and rendered; templates and units are used
{ const fs = await import('node:fs'); const Route = await ld('features/route.ts');
  assert.equal(Route.pageFromHash('#/insights'), 'insights'); assert.equal(Route.pageFromHash('#/settings'), 'settings');
  const app = fs.readFileSync(new URL('../src/MetrologyLabV3.tsx', import.meta.url), 'utf8');
  for (const needle of ['["insights", "Insights"', '["settings", "Display & Units"', 'active === "insights" && <Insights', 'active === "settings" && <SettingsPage', '<TemplatePicker', 'installDisplaySettings()']) assert.ok(app.includes(needle), needle);
  const tl = fs.readFileSync(new URL('../src/features/Timeline.tsx', import.meta.url), 'utf8'); assert.ok(tl.includes('useUnits()') && tl.includes('telemetrySnapshot'));
  assert.ok(app.includes('const fmtPressureShown') && app.includes('const fmtPressure = p =>') && app.includes('fmtTemp(state.chamber.temperature)') && app.includes('useUnits(); //'), 'header and status displays follow the chosen units');
  console.log('PASS the Insights and Display & Units pages, templates and units are wired into the app'); }

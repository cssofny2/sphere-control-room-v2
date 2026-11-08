import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadTypeScript } from './load-typescript.mjs';

const F = await loadTypeScript(new URL('../src/features/format.ts', import.meta.url));
const X = await loadTypeScript(new URL('../src/features/exportImage.ts', import.meta.url));
const S = await loadTypeScript(new URL('../src/features/sparkline.ts', import.meta.url));
const H = await loadTypeScript(new URL('../src/features/hotkeys.ts', import.meta.url));
const T = await loadTypeScript(new URL('../src/features/toast.tsx', import.meta.url));
const route = await loadTypeScript(new URL('../src/features/route.ts', import.meta.url));
const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

{
  assert.equal(F.groupDigits('230500.123'), '230 500.123'); assert.equal(F.groupDigits('1234'), '1234', 'four digits are left alone');
  assert.equal(F.groupDigits('-1234567.5'), '-1 234 567.5'); assert.equal(F.groupDigits('12345'), '12 345'); assert.equal(F.groupDigits('abc'), 'abc'); assert.equal(F.groupDigits('1.5e-6'), '1.5e-6');
  assert.equal(F.fmtNum(230500.1234, 2), '230 500.12'); assert.equal(F.fmtNum(NaN), '–'); assert.equal(F.fmtNum(undefined), '–'); assert.equal(F.fmtNum('5'), '–');
  assert.equal(F.fmtHz(230500), '230 500.000 Hz'); assert.equal(F.fmtHz(null), '–');
  assert.equal(F.fmtPlusMinus(0.04213), '± 0.042 Hz'); assert.equal(F.fmtPlusMinus(undefined), ''); assert.equal(F.fmtPlusMinus(Infinity), '');
  console.log('PASS numbers are digit-grouped with thin spaces, and bad values become a dash');
}
{
  assert.equal(X.safeFilename('S11 trace (VNA)'), 'sphere-s11-trace-vna.png'); assert.equal(X.safeFilename('   '), 'sphere-chart.png'); assert.equal(X.safeFilename('../../x'), 'sphere-x.png');
  assert.ok(X.safeFilename('a'.repeat(200)).length <= 'sphere-.png'.length + 60);
  const d = X.svgDocument([{ markup: '<svg viewBox="0 0 10 10" class="a"><circle r="1"/></svg>', width: 100, height: 50 }, { markup: '<svg><rect/></svg>', width: 60, height: 80 }], '#000', 10, 'A & B <t>');
  assert.equal(d.width, 100 + 60 + 10 + 24); assert.equal(d.height, 80 + 24 + 28);
  assert.ok(d.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"') && d.svg.includes('<circle r="1"/>') && d.svg.includes('<rect/>'));
  assert.equal((d.svg.match(/<svg\b/g) || []).length, 1, 'inner svg tags are unwrapped into groups');
  assert.ok(d.svg.includes('A &amp; B &lt;t&gt;') && !d.svg.includes('<t>'), 'the title is escaped');
  assert.ok(d.svg.includes('translate(12 40)') && d.svg.includes('translate(122 40)'), 'pieces sit side by side with the gap');
  console.log('PASS image export builds a standalone SVG document with escaped title and side-by-side charts');
}
{
  const s = S.sparkline([1, 2, 3, 2, 1], 100, 20);
  assert.equal(s.count, 5); assert.ok(s.path.startsWith('M2.0 18.0') && s.path.includes('L50.0 2.0'), s.path); assert.deepEqual([s.min, s.max], [1, 3]); assert.equal(s.last.x, 98);
  assert.ok(S.sparkline([5, 5, 5], 100, 20).path.includes('10.0'), 'a flat series is drawn in the middle');
  assert.equal(S.sparkline([1], 100, 20).path, ''); assert.equal(S.sparkline([], 100, 20).count, 0); assert.equal(S.sparkline([null, null], 100, 20).path, '');
  const gap = S.sparkline([1, 2, null, 3, 4], 100, 20); assert.equal((gap.path.match(/M/g) || []).length, 2, 'gaps lift the pen');
  const lg = S.sparkline([1e-6, 1e-3, 760], 100, 20, true); assert.ok(Math.abs(lg.min - 1e-6) < 1e-12 && Math.abs(lg.max - 760) < 1e-9); assert.equal(S.sparkline([0, -1, 5], 100, 20, true).count, 1, 'non-positive values are gaps on a log axis');
  assert.equal(S.thin([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4).length, 4); assert.equal(S.thin([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4).at(-1), 10); assert.equal(S.thin([1, 2], 10).length, 2);
  console.log('PASS sparklines map, gap, log-scale and thin correctly');
}
{
  const step = (st, key, t, extra = {}) => H.stepHotkey(st, { key, ...extra }, t);
  let r = step(H.INITIAL_CHORD, 'g', 1000); assert.equal(r.action, null); assert.equal(r.state.armedAt, 1000);
  r = step(r.state, 'v', 1500); assert.deepEqual(r.action, { type: 'goto', page: 'vna' }); assert.equal(r.state.armedAt, null);
  r = step(step(H.INITIAL_CHORD, 'g', 0).state, 'v', 2000); assert.equal(r.action, null, 'the chord expires');
  r = step(step(H.INITIAL_CHORD, 'g', 0).state, 'z', 100); assert.equal(r.action, null); assert.equal(r.state.armedAt, null, 'an unknown second key just cancels');
  assert.deepEqual(step(H.INITIAL_CHORD, '?', 0).action, { type: 'help' }); assert.deepEqual(step(H.INITIAL_CHORD, 'G', 0).state.armedAt, 0);
  assert.equal(step(H.INITIAL_CHORD, 'g', 0, { ctrlKey: true }).state.armedAt, null, 'Ctrl+G is not a shortcut'); assert.equal(step(H.INITIAL_CHORD, 'k', 0, { metaKey: true }).action, null);
  assert.equal(step(H.INITIAL_CHORD, 'v', 0).action, null, 'a bare letter does nothing');
  for (const [k, v] of Object.entries(H.GOTO_KEYS)) assert.ok(route.isPageId(v.page), `${k} goes to a real page`);
  assert.equal(new Set(Object.keys(H.GOTO_KEYS)).size, Object.keys(H.GOTO_KEYS).length);
  assert.equal(H.isTypingTarget({ tagName: 'INPUT' }), true); assert.equal(H.isTypingTarget({ tagName: 'select' }), true); assert.equal(H.isTypingTarget({ tagName: 'DIV', isContentEditable: true }), true); assert.equal(H.isTypingTarget({ tagName: 'DIV' }), false); assert.equal(H.isTypingTarget(null), false);
  console.log('PASS shortcut chords arm, expire, cancel and ignore modified keys and typing targets');
}
{
  T.resetToasts();
  const a = T.toast('Link copied', 'success'); assert.equal(T.toast('Link copied', 'success'), a, 'the same message is not stacked');
  for (let i = 0; i < 6; i++) T.toast('msg ' + i);
  assert.equal(T.getToasts().length, T.MAX_TOASTS, 'at most four are shown'); assert.equal(T.getToasts().at(-1).text, 'msg 5');
  const id = T.getToasts()[0].id; T.dismissToast(id); assert.ok(!T.getToasts().some(t => t.id === id));
  assert.equal(T.toast('x'.repeat(500)) > 0, true); assert.equal(T.getToasts().at(-1).text.length, 160);
  assert.ok(T.TOAST_MS.error > T.TOAST_MS.info, 'problems stay longer than confirmations');
  T.resetToasts(); assert.equal(T.getToasts().length, 0);
  console.log('PASS toasts de-duplicate, cap, dismiss and truncate');
}
{
  const app = read('../src/MetrologyLabV3.tsx'), css = read('../src/index.css');
  assert.ok(/<ToastHost \/>/.test(app) && /<ShortcutsDialog /.test(app) && /stepHotkey\(/.test(app), 'toasts and shortcuts are wired in');
  assert.ok(/SaveImageButton/.test(app) && /<Sparkline /.test(app) && /<EmptyState /.test(app) && /fmtNum\(/.test(app), 'image export, sparklines, empty states and number grouping are used');
  assert.ok(/density-compact/.test(app) && /\.density-compact /.test(css), 'compact density exists');
  assert.ok(/ReferenceArea/.test(app) && /FWHM/.test(app), 'the S11 plot shades the linewidth');
  assert.ok(/innerHeight < 720/.test(read('../src/features/LiveOperationWindow.tsx')), 'the live window starts collapsed on short screens');
  console.log('PASS the ten UI upgrades are wired into the app');
}

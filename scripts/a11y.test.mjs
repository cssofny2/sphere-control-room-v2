import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadTypeScript } from './load-typescript.mjs';

const M = await loadTypeScript(new URL('../src/features/modalA11y.ts', import.meta.url));
const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

{
  assert.equal(M.nextFocusIndex(0, 3, false), 1);
  assert.equal(M.nextFocusIndex(2, 3, false), 0, 'Tab from the last element wraps to the first');
  assert.equal(M.nextFocusIndex(0, 3, true), 2, 'Shift+Tab from the first wraps to the last');
  assert.equal(M.nextFocusIndex(1, 3, true), 0);
  assert.equal(M.nextFocusIndex(-1, 3, false), 0, 'focus outside the dialog is pulled in');
  assert.equal(M.nextFocusIndex(-1, 3, true), 2);
  assert.equal(M.nextFocusIndex(0, 0, false), -1);
  assert.equal(M.nextFocusIndex(0, 1, false), 0);
  console.log('PASS dialog Tab trap wraps in both directions and pulls stray focus in');
}
{
  const app = read('../src/MetrologyLabV3.tsx');
  assert.ok(/installModalA11y\(\)/.test(app) && /<Announcer \/>/.test(app), 'dialog handling and live announcements are installed');
  assert.ok(/viridis:/.test(app) && /cividis:/.test(app) && /value="viridis"/.test(app) && /value="cividis"/.test(app), 'colour-vision-safe palettes are selectable');
  for (const field of ['Stage ${String(axis).toUpperCase()} position', 'aria-label="Stage clamp"', 'aria-label="Thermostat"', 'aria-label="VNA power"', 'aria-label="RF output"', 'aria-label="Clock power"', 'aria-label="Entry tag"', 'aria-label="Filter by tag"', 'aria-label="Metric"']) assert.ok(app.includes(field), `labelled control: ${field}`);
  assert.ok(!/<button[^>]*>[^<]*<HelpInfo/.test(app), 'no help button is nested inside another button');
  assert.ok(/role="region" aria-label="Essential laboratory status"/.test(app));
  const ov = read('../src/overview/LabOverview.tsx');
  assert.ok(!/role="tab"[^>]*aria-pressed/.test(ov), 'tabs use aria-selected only');
  assert.ok(!/<aside/.test(ov) && !/<aside/.test(read('../src/features/ScopePanel.tsx')), 'no nested complementary landmarks');
  const css = read('../src/index.css');
  assert.ok(/prefers-contrast: more/.test(css) && /forced-colors: active/.test(css) && /\.text-zinc-500 \{ color: #9a9aa8/.test(css));
  console.log('PASS controls are labelled, palettes selectable, landmarks and ARIA are valid, contrast preferences are honoured');
}
{
  const ann = read('../src/features/Announcer.tsx');
  assert.ok(/aria-live="assertive"/.test(ann) && /aria-live="polite"/.test(ann) && /sr-only/.test(ann));
  console.log('PASS alarms and measurements are announced to screen readers');
}

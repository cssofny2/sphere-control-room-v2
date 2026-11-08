import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

{
  const app = read('../src/MetrologyLabV3.tsx');
  assert.ok(/Date\.now\(\) - \(state\.vna\.traceAt \|\| 0\) >= 200/.test(app), 'the live VNA trace is rebuilt about 5 times a second, not every 50 ms tick');
  assert.ok(!/filter: "url\(#glow-s11\)"/.test(app), 'the live trace has no SVG glow filter');
  assert.ok(!/animation:ledbreath/.test(app) && !/\.gas-p\{animation/.test(app), 'no always-on filter or decorative drift animations in the base styles');
  assert.ok(/useThrottled\(state, 250\)/.test(app) && /state=\{overviewState\}/.test(app), 'the animated overview gets a throttled snapshot');
  console.log('PASS live trace is throttled, the glow filter and decorative loops are gone, the overview is throttled');
}
{
  assert.ok(/export const Timeline = memo\(/.test(read('../src/features/Timeline.tsx')), 'the timeline does not re-render on every lab tick');
  assert.ok(/window\.setTimeout\(\(\) => \{ timer = null; bump/.test(read('../src/features/Timeline.tsx')), 'the timeline redraws at most once a second');
  assert.ok(/export const RunCompare = memo\(/.test(read('../src/analysis/RunCompare.tsx')));
  assert.ok(/export default memo\(LabOverview/.test(read('../src/overview/LabOverview.tsx')));
  console.log('PASS chart-heavy pages are memoized');
}
{
  const alerts = read('../src/features/alerts.css'), ov = read('../src/overview/overview.css');
  for (const [name, css] of [['alerts', alerts], ['overview', ov]]) {
    const bad = css.split('\n').filter(l => /animation:\s*(al-flash|al-shake|ov-glow|ov-errglow|ov-attn|ov-stuck)\b[^;]*infinite/.test(l));
    assert.deepEqual(bad, [], `${name}: attention glows and shakes must stop after a few cycles (box-shadow and filter animations repaint every frame)`);
  }
  assert.ok(!/animation:\s*ov-glow[^;]*infinite/.test(ov) && /st-active \.ov-card-body[^}]*animation: none/.test(ov), 'active cards no longer pulse a filter forever');
  console.log('PASS paint-expensive attention animations are finite');
}
{
  const css = read('../src/index.css');
  assert.ok(/\.workspace-instrument > \* \{ flex-shrink: 0; \}/.test(css), 'children of the scrolling page never shrink (the alert banner was squeezed to a 22 px sliver)');
  console.log('PASS page children keep their height instead of being squeezed');
}

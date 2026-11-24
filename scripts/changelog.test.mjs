import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadTypeScript } from './load-typescript.mjs';

const C = await loadTypeScript(new URL('../src/features/changelog.ts', import.meta.url));
const Route = await loadTypeScript(new URL('../src/features/route.ts', import.meta.url));
const Difficulty = await loadTypeScript(new URL('../src/features/difficulty.ts', import.meta.url));
const Hotkeys = await loadTypeScript(new URL('../src/features/hotkeys.ts', import.meta.url));
const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

// 1. Parser on synthetic markdown fixture
{
  const md = [
    '# Changelog',
    '',
    '## [2.2.0] - 2026-11-24',
    '- **2026-11-24** — Added `Version & Changes` page.',
    '- **2026-11-20** — Fixed **alert** banner sizing.',
    '',
    '## [2.1.0] - 2026-11-07',
    '### Added',
    '- Guided learning paths.',
    '### Fixed',
    '- Mobile overflow.',
    '',
    '## [1.0.0]',
    '- Initial release.',
  ].join('\r\n');

  const parsed = C.parseChangelog(md);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].version, '2.2.0');
  assert.equal(parsed[0].date, '2026-11-24');
  assert.equal(parsed[0].entries.length, 2);
  assert.equal(parsed[0].entries[0].date, '2026-11-24');
  assert.equal(parsed[0].entries[0].text, 'Added `Version & Changes` page.');
  assert.equal(parsed[0].entries[1].date, '2026-11-20');
  assert.equal(parsed[1].entries[0].category, 'Added');
  assert.equal(parsed[1].entries[0].date, '2026-11-07');
  assert.equal(parsed[1].entries[1].category, 'Fixed');
  assert.equal(parsed[2].date, null);
  assert.equal(C.countChanges(parsed), 5);

  const oldest = C.orderReleases(parsed, 'oldest');
  assert.deepEqual(oldest.map(r => r.version), ['1.0.0', '2.1.0', '2.2.0']);
  assert.deepEqual(oldest[2].entries.map(e => e.date), ['2026-11-20', '2026-11-24']);
  assert.equal(parsed[0].version, '2.2.0', 'orderReleases does not mutate input');

  const onlyLatest = C.filterReleases(parsed, { onlyVersion: '2.2.0' });
  assert.equal(onlyLatest.length, 1);
  const byQuery = C.filterReleases(parsed, { query: 'mobile' });
  assert.equal(byQuery.length, 1);
  assert.equal(byQuery[0].version, '2.1.0');
  assert.equal(byQuery[0].entries.length, 1);

  assert.equal(C.getLatestRelease(parsed, '2.2.0')?.version, '2.2.0');
  assert.equal(C.getLatestChanges(parsed, 1, '2.2.0').length, 1);
  console.log('PASS changelog parser, chronological ordering, and filtering work on fixtures');
}

// 2. Inline formatting tokenizer stays safe and handles bold/code
{
  const tokens = C.parseInlineFormatting('Added **LOC-1** via `vercel.json` with <script> literal.');
  assert.deepEqual(tokens, [
    { kind: 'text', value: 'Added ' },
    { kind: 'strong', value: 'LOC-1' },
    { kind: 'text', value: ' via ' },
    { kind: 'code', value: 'vercel.json' },
    { kind: 'text', value: ' with <script> literal.' },
  ]);
  console.log('PASS inline markdown tokenizer handles bold, code, and plain text safely');
}

// 3. Real CHANGELOG.md matches package.json version and is in chronological order
{
  const pkg = JSON.parse(read('../package.json'));
  const releases = C.parseChangelog(read('../CHANGELOG.md'));
  assert.ok(releases.length >= 10, `expected full release history, got ${releases.length}`);
  const current = C.getLatestRelease(releases, pkg.version);
  assert.ok(current, `CHANGELOG.md has a release for ${pkg.version}`);
  assert.equal(current.version, pkg.version);
  assert.ok(current.date && /^\d{4}-\d{2}-\d{2}$/.test(current.date), 'current release has an ISO date');
  assert.ok(current.entries.length >= 5, 'current release lists specific latest changes');

  // Within the current release, dated items must be non-increasing (newest first)
  const dates = current.entries.map(e => e.date).filter(Boolean);
  assert.equal(dates.length, current.entries.length, 'every entry in the current release is dated');
  for (let i = 1; i < dates.length; i++) {
    assert.ok(dates[i - 1] >= dates[i], `chronological order broken: ${dates[i - 1]} before ${dates[i]}`);
  }
  console.log(`PASS CHANGELOG.md v${pkg.version} has ${current.entries.length} chronologically ordered dated entries across ${releases.length} releases`);
}

// 4. Wiring across routes, difficulty tiers, hotkeys, Vercel redirects, header, and app
{
  assert.equal(Route.pageFromHash('#/changelog'), 'changelog');
  assert.equal(Route.hashForPage('changelog'), '#/changelog');
  for (const level of Difficulty.DIFFICULTIES) {
    assert.equal(Difficulty.availableAt(level, 'changelog'), true, `changelog available at ${level}`);
  }
  assert.equal(Hotkeys.GOTO_KEYS.u?.page, 'changelog');

  const vercel = JSON.parse(read('../vercel.json'));
  assert.ok(vercel.redirects.some(r => r.source.includes('changelog')), 'vercel.json redirects /changelog');

  const hdr = read('../src/WorkspaceHeader.tsx');
  assert.ok(hdr.includes("onNavigate('changelog')") && hdr.includes('data-app-version'), 'header version badge opens changelog');

  const app = read('../src/MetrologyLabV3.tsx');
  for (const needle of [
    '["changelog", "Version & Changes", History]',
    "lazy(() => import('./features/ChangelogPage')",
    'active === "changelog" && <Suspense',
    '<ChangelogPage />',
    '<LatestChangesCard onOpenChangelog=',
    'onClick={() => navigate("changelog")}',
  ]) {
    assert.ok(app.includes(needle), `MetrologyLabV3.tsx includes ${needle}`);
  }
  console.log('PASS Version & Changes section is wired across navigation, header, footer, dashboard, routes, hotkeys, and redirects');
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SITE, VERSION, fillHtml, sitemapXml, copyrightYears, buildDate, commitShort } from './seo-plugin.mjs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const pkg = JSON.parse(read('../package.json')), lock = JSON.parse(read('../package-lock.json'));
const raw = read('../index.html');

// version: one source of truth, semver, lockfile in step
assert.match(VERSION, /^\d+\.\d+\.\d+$/); assert.equal(VERSION, pkg.version); assert.equal(lock.version, pkg.version); assert.equal(lock.packages[''].version, pkg.version);
assert.ok(pkg.author.startsWith('Michael P. Goodman')); console.log(`PASS version ${VERSION} is semver and matches package.json and the lockfile`);
{ const log = read('../CHANGELOG.md'); assert.ok(log.includes(`## [${VERSION}]`), 'CHANGELOG has an entry for the current version'); console.log('PASS CHANGELOG has an entry for this version'); }

// identity
assert.equal(SITE.author, 'Michael P. Goodman'); assert.equal(SITE.owner, 'SPHERE Research, LLC'); assert.equal(SITE.url, 'https://lab.spheredesci.org/');
console.log('PASS author and copyright holder are as specified');

// years
assert.equal(copyrightYears(2026, new Date('2026-10-16T12:00:00Z')), '2026'); assert.equal(copyrightYears(2026, new Date('2028-01-02T00:00:00Z')), '2026-2028'); assert.equal(buildDate(new Date('2026-10-16T23:59:00Z')), '2026-10-16');
assert.equal(commitShort({ VERCEL_GIT_COMMIT_SHA: 'abcdef1234567' }), 'abcdef1'); assert.equal(commitShort({}), 'local'); console.log('PASS copyright year range, build date and commit helpers');

// html
const html = fillHtml(raw, new Date('2026-10-16T12:00:00Z'));
assert.ok(!/%[A-Z_]+%/.test(html), 'no unreplaced placeholders'); assert.ok(raw.includes('%APP_VERSION%'));
const title = /<title>([^<]+)<\/title>/.exec(html)[1]; assert.ok(title.length <= 60, `title ${title.length} chars`); assert.ok(/S\.P\.H\.E\.R\.E\./.test(title));
const meta = (attr, name) => new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`).exec(html)?.[1];
const desc = meta('name', 'description'); assert.ok(desc && desc.length >= 80 && desc.length <= 160, `description ${desc?.length} chars`);
assert.equal(meta('name', 'author'), 'Michael P. Goodman'); assert.match(meta('name', 'copyright'), /© 2026 SPHERE Research, LLC/);
assert.match(meta('name', 'robots'), /index, follow/); assert.ok(html.includes(`<link rel="canonical" href="${SITE.url}" />`));
for (const k of ['og:title', 'og:description', 'og:url', 'og:image', 'og:type', 'og:site_name']) assert.ok(meta('property', k), k);
for (const k of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) assert.ok(meta('name', k), k);
assert.equal(meta('property', 'og:image'), `${SITE.url}og-image.png`); assert.equal(meta('property', 'og:title'), title); assert.equal(meta('property', 'og:description'), desc);
assert.equal((html.match(/<h1>/g) || []).length, 1, 'exactly one h1'); assert.ok(html.includes('rel="icon"') && html.includes('apple-touch-icon'));
console.log('PASS title, description, canonical, robots, Open Graph, Twitter, icons and one h1');

// structured data
{
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]); const g = Object.fromEntries(ld['@graph'].map(n => [n['@type'], n]));
  const app = g.WebApplication; assert.equal(app.softwareVersion, VERSION); assert.equal(app.applicationCategory, 'EducationalApplication'); assert.equal(app.isAccessibleForFree, true); assert.equal(app.dateModified, '2026-10-16');
  assert.equal(g.Person.name, 'Michael P. Goodman'); assert.equal(g.Organization.name, 'SPHERE Research, LLC'); assert.equal(app.author['@id'], g.Person['@id']); assert.equal(app.copyrightHolder['@id'], g.Organization['@id']); assert.equal(app.copyrightYear, 2026);
  assert.equal(app.url, SITE.url); assert.ok(app.image.startsWith(SITE.url)); console.log('PASS JSON-LD parses and credits Michael P. Goodman and SPHERE Research, LLC with the right version');
}
// static copy has credit
assert.ok(/Designed and developed by Michael P\. Goodman/.test(html) && /SPHERE Research, LLC/.test(html) && html.includes(`v${VERSION}`)); console.log('PASS crawler-visible text carries the version, credit and copyright');

// robots + sitemap
{
  const robots = read('../public/robots.txt'); assert.match(robots, /User-agent: \*/); assert.match(robots, /Allow: \//); assert.ok(robots.includes(`Sitemap: ${SITE.url}sitemap.xml`)); assert.match(robots, /Disallow: \/api\//); assert.ok(!/Disallow: \/\s*$/m.test(robots));
  const sm = sitemapXml('2026-10-16'); assert.ok(sm.startsWith('<?xml')); assert.ok(sm.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')); assert.ok(sm.includes(`<loc>${SITE.url}</loc>`)); assert.match(sm, /<lastmod>\d{4}-\d\d-\d\d<\/lastmod>/);
  console.log('PASS robots.txt allows crawling and points at the sitemap; sitemap lists the canonical URL with a date');
}
// UI
{
  const hdr = read('../src/WorkspaceHeader.tsx'), app = read('../src/MetrologyLabV3.tsx'), info = read('../src/siteInfo.ts');
  assert.ok(hdr.includes('data-app-version') && hdr.includes('VERSION_LABEL')); assert.ok(hdr.indexOf('workspace-logo') < hdr.indexOf('data-app-version'), 'version sits right after the logo');
  assert.ok(app.includes('data-app-footer') && app.includes('COPYRIGHT_LINE') && app.includes('AUTHOR')); assert.ok(info.includes('©') && info.includes('All rights reserved'));
  console.log('PASS header shows the version beside the logo; footer shows copyright and author credit');
}

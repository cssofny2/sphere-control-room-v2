import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { loadTypeScript } from './load-typescript.mjs';

const R = await loadTypeScript(new URL('../src/features/route.ts', import.meta.url));
const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

// ── routes ──────────────────────────────────────────────────────────────────────────────────────
{
  assert.equal(R.pageFromHash('#/vna'), 'vna');
  assert.equal(R.pageFromHash('#runs'), 'runs');
  assert.equal(R.pageFromHash('#/runs/'), 'runs');
  for (const bad of ['', '#', '#/', '#/nope', '#/vna/../x', '#/VNA', '#/vna?x=1', '#/__proto__', '#/<script>']) assert.equal(R.pageFromHash(bad), null, bad);
  assert.equal(R.hashForPage('spatial'), '#/spatial');
  assert.equal(R.hashForPage('bogus'), '');
  for (const id of R.PAGE_IDS) assert.equal(R.pageFromHash(R.hashForPage(id)), id, 'every page round-trips');
  assert.equal(R.isEmbed('?embed=1'), true); assert.equal(R.isEmbed('?a=1&embed=true'), true);
  assert.equal(R.isEmbed('?embed=0'), false); assert.equal(R.isEmbed(''), false);
  assert.equal(R.shareUrl('vna', { origin: 'https://lab.spheredesci.org', pathname: '/' }), 'https://lab.spheredesci.org/#/vna');
  const app = read('../src/MetrologyLabV3.tsx');
  const pages = [...read('../src/MetrologyLabV3.tsx').matchAll(/\["(\w+)", "[^"]+", \w+\],?/g)].map(m => m[1]);
  for (const id of R.PAGE_IDS) assert.ok(pages.includes(id) || app.includes(`"${id}"`), `page ${id} exists in the app`);
  assert.ok(/pageFromHash\(window\.location\.hash\)/.test(app) && /copyPageLink/.test(app) && /isEmbed\(window\.location\.search\)/.test(app));
  console.log('PASS page links round-trip, unknown or hostile hashes are ignored, embed flag parsed');
}

// ── manifest, page and registration ─────────────────────────────────────────────────────────────
{
  const m = JSON.parse(read('../public/manifest.webmanifest'));
  for (const k of ['name', 'short_name', 'start_url', 'display', 'icons']) assert.ok(m[k], `manifest.${k}`);
  for (const icon of m.icons) assert.ok(fs.existsSync(new URL(`../public/${icon.src}`, import.meta.url)), `icon ${icon.src} exists`);
  assert.ok(/rel="manifest"/.test(read('../index.html')));
  const main = read('../src/main.tsx');
  assert.ok(/import\.meta\.env\.PROD/.test(main) && /serviceWorker\.register\('\.\/sw\.js'\)/.test(main), 'registered in production only');
  console.log('PASS manifest is valid, icons exist, page links it, worker registers in production only');
}

// ── service worker behaviour ────────────────────────────────────────────────────────────────────
{
  const listeners = {}, puts = [], deleted = [];
  const store = new Map();
  const sandbox = {
    self: { location: { origin: 'https://lab.spheredesci.org' }, addEventListener: (t, f) => { listeners[t] = f; }, skipWaiting: () => Promise.resolve(), clients: { claim: () => Promise.resolve() } },
    caches: {
      open: async () => ({ addAll: async () => {}, put: async (k, v) => { puts.push(typeof k === 'string' ? k : k.url); store.set(typeof k === 'string' ? k : k.url, v); } }),
      match: async k => store.get(typeof k === 'string' ? k : k.url),
      keys: async () => ['sphere-lab-v0', 'sphere-lab-v1', 'other-app'], delete: async k => { deleted.push(k); },
    },
    fetch: async () => ({ ok: true, clone() { return this; } }), Response: { error: () => 'ERR' }, URL, Promise,
  };
  vm.runInNewContext(read('../public/sw.js'), sandbox);
  const run = (url, o = {}) => { let handled = false; listeners.fetch({ request: { method: 'GET', mode: 'cors', url, ...o }, respondWith: () => { handled = true; } }); return handled; };
  assert.equal(run('https://lab.spheredesci.org/api/technician'), false, 'API calls are never intercepted');
  assert.equal(run('https://lab.spheredesci.org/api/tts'), false);
  assert.equal(run('https://evil.example/assets/x.js'), false, 'other origins are never intercepted');
  assert.equal(run('https://lab.spheredesci.org/assets/index-abc.js'), true, 'built assets are cached');
  assert.equal(run('https://lab.spheredesci.org/', { mode: 'navigate' }), true, 'page loads are handled network-first');
  assert.equal(run('https://lab.spheredesci.org/assets/x.js', { method: 'POST' }), false, 'only GET is handled');
  assert.equal(run('https://lab.spheredesci.org/some/data.json'), false, 'unknown files pass through');
  let waited; listeners.activate({ waitUntil: p => { waited = p; } }); await waited;
  assert.deepEqual(deleted, ['sphere-lab-v0'], 'old caches of this app are removed, other apps untouched');
  console.log('PASS service worker skips /api and other origins, caches assets, serves pages network-first');
}

// ── headers: embeddable only by the project site ────────────────────────────────────────────────
{
  const h = read('../public/_headers');
  assert.ok(/frame-ancestors 'self' https:\/\/spheredesci\.org https:\/\/www\.spheredesci\.org/.test(h));
  assert.ok(!/frame-ancestors 'none'/.test(h) && !/X-Frame-Options/i.test(h), 'old deny-all framing rules are gone');
  assert.ok(!/frame-ancestors[^\n]*\*/.test(h), 'no wildcard framing');
  assert.ok(/object-src 'none'/.test(h) && /nosniff/.test(h));
  assert.ok(/\/sw\.js\s+Cache-Control: no-cache/.test(h), 'the worker itself is never cached stale');
  console.log('PASS headers allow framing only by spheredesci.org and keep the other protections');
}

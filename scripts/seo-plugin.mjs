// Build-time site metadata: fills %PLACEHOLDERS% in index.html and writes sitemap.xml with today's date.
// Identity strings live in site.info.json so the page, the sitemap, the app header and the tests agree.
import { readFileSync } from 'node:fs';

export const SITE = JSON.parse(readFileSync(new URL('../site.info.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export const VERSION = pkg.version;

export const copyrightYears = (start = SITE.startYear, now = new Date()) => {
  const y = now.getUTCFullYear();
  return y > start ? `${start}-${y}` : String(start);
};
export const buildDate = (now = new Date()) => now.toISOString().slice(0, 10);
export const commitShort = (env = process.env) => (env.VERCEL_GIT_COMMIT_SHA || env.WORKERS_CI_COMMIT_SHA || env.CF_PAGES_COMMIT_SHA || env.GITHUB_SHA || '').slice(0, 7) || 'local';

export const sitemapXml = (lastmod = buildDate()) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE.url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

export const fillHtml = (html, now = new Date()) => html
  .replaceAll('%APP_VERSION%', VERSION)
  .replaceAll('%BUILD_DATE%', buildDate(now))
  .replaceAll('%COPYRIGHT_YEARS%', copyrightYears(SITE.startYear, now));

export function seoPlugin() {
  return {
    name: 'sphere-seo',
    transformIndexHtml: { order: 'pre', handler: (html) => fillHtml(html) },
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml() }); },
    configureServer(server) {
      server.middlewares.use('/sitemap.xml', (_req, res) => { res.setHeader('content-type', 'application/xml'); res.end(sitemapXml()); });
    },
  };
}

"""Version, credit and SEO checks in a real browser.

    npm run build && npx vite preview --host 127.0.0.1 --port 4173 &
    python3 tests/e2e/site.e2e.py [base_url]
"""
import json, re, sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173/'
VER = json.load(open('package.json'))['version']

def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (" " + str(extra) if extra and not cond else ""))
    if not cond: raise SystemExit(1)

with sync_playwright() as p:
    b = p.chromium.launch()
    for label, vp in [('desktop', (1280, 800)), ('phone', (390, 780))]:
        pg = b.new_page(viewport={'width': vp[0], 'height': vp[1]}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
        pg.goto(BASE, wait_until='networkidle'); pg.wait_for_timeout(500)
        v = pg.evaluate("(() => { const v = document.querySelector('[data-app-version]').getBoundingClientRect(), l = document.querySelector('.workspace-logo').getBoundingClientRect(); return { vx: v.x, vy: v.y, lx: l.x, ly: l.y, lr: l.right, vr: v.right, iw: innerWidth, text: document.querySelector('[data-app-version]').textContent }; })()")
        check(f"{label}: version label shows v{VER}", v['text'] == f'v{VER}', v)
        check(f"{label}: version sits in the top-left corner right beside the logo", v['vx'] >= v['lr'] - 1 and v['vx'] < 260 and v['vy'] < 60, v)
        check(f"{label}: version stays on screen", v['vr'] <= v['iw'])
        foot = pg.evaluate("document.querySelector('[data-app-footer]').textContent")
        check(f"{label}: footer has copyright and credit", 'SPHERE Research, LLC' in foot and 'Michael P. Goodman' in foot and re.search(r'© 20\d\d', foot) is not None and f'Version {VER}' in foot, foot)
        check(f"{label}: no horizontal scroll", pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
        pg.get_by_role("button", name="Focus").first.click() if label == 'desktop' else None
        pg.wait_for_timeout(300)
        check(f"{label}: version still visible after toggling focus mode", pg.evaluate("document.querySelector('[data-app-version]').getBoundingClientRect().height > 0"))
        check(f"{label}: no console errors", not errs, errs[:3])
        pg.close()
    pg = b.new_page(); pg.goto(BASE, wait_until='domcontentloaded')
    d = pg.evaluate("({ title: document.title, canon: document.querySelector('link[rel=canonical]').href, ld: JSON.parse(document.querySelector('script[type=\"application/ld+json\"]').textContent)['@graph'].find(n => n['@type'] === 'WebApplication').softwareVersion, og: document.querySelector('meta[property=\"og:image\"]').content })")
    check("built page title, canonical and structured-data version are right", d['title'].startswith('S.P.H.E.R.E.') and d['canon'] == 'https://lab.spheredesci.org/' and d['ld'] == VER, d)
    r = pg.request.get(BASE + 'sitemap.xml'); check("sitemap.xml is served as XML with the canonical URL", r.ok and '<loc>https://lab.spheredesci.org/</loc>' in r.text() and 'xml' in r.headers.get('content-type', ''), r.headers)
    r = pg.request.get(BASE + 'robots.txt'); check("robots.txt points at the sitemap", 'Sitemap: https://lab.spheredesci.org/sitemap.xml' in r.text())
    for f in ['og-image.png', 'favicon.svg', 'apple-touch-icon.png']:
        check(f"{f} is served", pg.request.get(BASE + f).ok)
    b.close()

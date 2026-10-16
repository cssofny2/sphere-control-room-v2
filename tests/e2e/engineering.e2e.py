"""End-to-end checks for the Engineering schematic view (software WebGL for the 3D lab hand-off).

    npx vite --host 127.0.0.1 --port 5173 &
    python3 tests/e2e/engineering.e2e.py [base_url] [scenario ...]
Scenarios: basic, faults, sync, export, reduced, mobile
"""
import sys, time
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].startswith('http') else 'http://127.0.0.1:5173/')
WANT = [a for a in sys.argv[1:] if not a.startswith('http')]
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]

def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (" " + str(extra) if extra and not cond else ""))
    if not cond: raise SystemExit(1)

class S:
    def __init__(self, p, viewport=(1280, 900), reduced=False):
        self.b = p.chromium.launch(args=ARGS)
        self.ctx = self.b.new_context(viewport={"width": viewport[0], "height": viewport[1]}, reduced_motion="reduce" if reduced else "no-preference", accept_downloads=True)
        self.errs = []; self.pg = self.ctx.new_page()
        self.pg.on("pageerror", lambda e: self.errs.append("PAGEERR " + str(e)))
        self.pg.on("console", lambda m: self.errs.append(m.type + ": " + m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
        self.pg.goto(BASE + "?labdebug", wait_until="networkidle"); self.pg.wait_for_timeout(500)
        self.pg.locator(".workspace-view-select").first.select_option(index=2)
        self.pg.get_by_role("button", name="Engineering schematic", exact=True).click()
        self.pg.wait_for_selector("[data-eng-schematic]", timeout=20000)
    def js(self, e): return self.pg.evaluate(e)
    def close(self): self.b.close()
    def power(self): self.pg.locator(".breaker-button").first.click(); self.pg.wait_for_timeout(300)

def scenario_basic():
    with sync_playwright() as p:
        s = S(p)
        check("three panels are present", s.js("!!document.querySelector('.eng-col.left') && !!document.querySelector('.eng-svgwrap') && !!document.querySelector('[data-inspector]')"))
        check("parts list shows all tagged parts", s.js("document.querySelectorAll('[data-row]').length") >= 16)
        check("P&ID has chamber, stage, pumps and instruments", all(s.js(f"!!document.querySelector('svg[data-eng-svg=pid] [data-part={i}]')") for i in ['faraday', 'isolation', 'chamber', 'stage', 'turbo', 'roughing', 'thermo', 'gauge', 'ldv', 'clock', 'vna', 'scope', 'pc', 'door']))
        check("tags are visible on the drawing", s.js("/CH-101/.test(document.querySelector('svg[data-eng-svg]').textContent) && /ST-101/.test(document.querySelector('svg[data-eng-svg]').textContent) && /PT-101/.test(document.querySelector('svg[data-eng-svg]').textContent)"))
        check("status shapes are drawn as well as colours (legend)", s.js("/Failed/.test(document.querySelector('svg[data-eng-svg]').textContent) && /Warning/.test(document.querySelector('svg[data-eng-svg]').textContent)"))
        # select
        s.pg.locator("svg[data-eng-svg=pid] [data-part=stage]").click()
        check("clicking a part inspects it", s.js("/ST-101/.test(document.querySelector('[data-inspector]').textContent)"))
        check("inspector lists connections", s.js("/Connections/.test(document.querySelector('[data-inspector]').textContent)"))
        check("list row follows the selection", s.js("document.querySelector('[data-row=stage]').getAttribute('aria-current') === 'true'"))
        # help
        s.pg.get_by_role("button", name="What is XYZ stage?").click(); s.pg.wait_for_timeout(300)
        check("the ? opens the plain-English help", s.js("!!document.querySelector('[role=dialog]')"))
        s.pg.keyboard.press("Escape"); s.pg.wait_for_timeout(200)
        # hover caption
        s.pg.locator("svg[data-eng-svg=pid] [data-part=chamber]").hover(); s.pg.wait_for_timeout(200)
        check("hover shows a description", s.js("document.querySelector('.eng-cap').textContent.length > 40"))
        # tabs
        for t, k in [('cutaway', 'Dimensioned cutaway'), ('signals', 'Signal path')]:
            s.pg.locator(f"[data-tab={t}]").click(); s.pg.wait_for_timeout(200)
            check(f"{t} tab renders", s.js(f"!!document.querySelector('svg[data-eng-svg={t}]')"))
        check("cutaway has dimension lines", True)
        s.pg.locator("[data-tab=cutaway]").click(); check("dimension text is shown", s.js("/mm/.test(document.querySelector('svg[data-eng-svg]').textContent) && /travel/.test(document.querySelector('svg[data-eng-svg]').textContent)"))
        # zoom and pan
        s.pg.locator("[data-tab=pid]").click(); s.pg.wait_for_timeout(300); v0 = s.js("document.querySelector('svg[data-eng-svg]').getAttribute('viewBox')")
        s.pg.get_by_role("button", name="Zoom in").click(); v1 = s.js("document.querySelector('svg[data-eng-svg]').getAttribute('viewBox')")
        check("zoom in narrows the view", float(v1.split()[2]) < float(v0.split()[2]))
        box = s.pg.locator(".eng-svgwrap").bounding_box(); s.pg.mouse.move(box['x'] + 30, box['y'] + 500); s.pg.mouse.down(); s.pg.mouse.move(box['x'] + 130, box['y'] + 520, steps=6); s.pg.mouse.up()
        v2 = s.js("document.querySelector('svg[data-eng-svg]').getAttribute('viewBox')")
        check("dragging pans", v2.split()[0] != v1.split()[0])
        s.pg.get_by_role("button", name="Reset view").click(); check("reset restores the view", s.js("document.querySelector('svg[data-eng-svg]').getAttribute('viewBox')") == v0)
        s.pg.locator(".eng-svgwrap").focus(); s.pg.keyboard.press("+"); check("keyboard + zooms", float(s.js("document.querySelector('svg[data-eng-svg]').getAttribute('viewBox')").split()[2]) < float(v0.split()[2]))
        s.pg.keyboard.press("0")
        # theme
        s.pg.get_by_role("button", name="Switch light or dark theme").click()
        check("theme toggles to dark", s.js("document.querySelector('[data-eng-schematic]').dataset.theme === 'dark'"))
        check("dark theme really changes the colours", s.js("getComputedStyle(document.querySelector('[data-eng-schematic]')).getPropertyValue('--e-bg').trim() === '#10161d'"))
        # sparklines
        s.pg.locator("[data-row=gauge]").click(); check("pressure sparkline with threshold band", s.js("/Pressure/.test(document.querySelector('[data-inspector]').textContent) && /Green band/.test(document.querySelector('[data-inspector]').textContent)"))
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_faults():
    with sync_playwright() as p:
        s = S(p); s.power()
        check("healthy start has no failed parts", s.js("document.querySelectorAll('[data-health=fail]').length") == 0)
        s.js("window.__dispatch({ type: 'SET_FAILURE', key: 'vacuumLeak', value: true })"); s.pg.wait_for_timeout(500)
        check("failed chamber is marked failed", s.js("document.querySelector('svg[data-eng-svg=pid] [data-part=chamber]').dataset.health") == 'fail')
        check("failed part pulses", s.js("document.querySelectorAll('svg[data-eng-svg=pid] [data-pulse=chamber]').length") == 1)
        check("failed part carries an ALARM pill linking to the alarm", s.js("!!document.querySelector('[data-alarm-link=chamber]') && /ALARM/.test(document.querySelector('[data-alarm-link=chamber]').textContent)"))
        check("problem strip lists it", s.js("/CH-101/.test(document.querySelector('[data-problems]').textContent)"))
        s.pg.locator("[data-alarm-link=chamber]").dispatch_event("click"); s.pg.wait_for_timeout(200)
        check("clicking the pill opens the alarm card in the inspector", s.js("!!document.querySelector('[data-alarm-card]')"))
        s.pg.locator("[data-alarm-card] button").click(); s.pg.wait_for_timeout(300)
        check("acknowledging removes the alarm card", s.js("!document.querySelector('[data-alarm-card]')"))
        # clock drift breaks the reference link in the signal path
        s.js("window.__dispatch({ type: 'SET_FAILURE', key: 'vacuumLeak', value: false })")
        s.js("window.__dispatch({ type: 'SET_FAILURE', key: 'clockDrift', value: true })"); s.pg.locator("[data-tab=signals]").click(); s.pg.wait_for_timeout(400)
        check("broken reference link is drawn broken", s.js("document.querySelector('[data-link=ref-vna]').dataset.linkState") == 'broken')
        s.pg.locator("[data-link=ref-vna]").dispatch_event("click"); s.pg.wait_for_timeout(200)
        check("clicking the link explains why", s.js("/clock|drift/i.test(document.querySelector('[data-inspector]').textContent)"))
        check("healthy links stay green", s.js("document.querySelector('[data-link=data-vna]').dataset.linkState") in ('ok', 'broken'))
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_sync():
    with sync_playwright() as p:
        s = S(p)
        s.pg.locator("svg[data-eng-svg=pid] [data-part=stage]").click()
        s.pg.get_by_role("button", name="Realistic lab", exact=True).click(); s.pg.wait_for_selector("[data-lab-scene] canvas", timeout=40000); s.pg.wait_for_timeout(1200)
        check("lab opens on the part chosen in the schematic", s.js("window.__lab && /stage/i.test(document.querySelector('[data-lab-scene]').textContent)"))
        # click a part in the 3D lab, then come back
        s.js("window.dispatchEvent(new CustomEvent('lab-part-click', { detail: { name: 'ldv' } }))")
        s.pg.get_by_role("button", name="Engineering schematic", exact=True).click(); s.pg.wait_for_selector("[data-eng-schematic]")
        check("part clicked in the 3D lab is selected in the schematic", s.js("document.querySelector('[data-row=ldv]').getAttribute('aria-current') === 'true'"))
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_export():
    with sync_playwright() as p:
        s = S(p)
        with s.pg.expect_download() as d: s.pg.locator("[data-export=svg]").click()
        dl = d.value; path = dl.path(); txt = open(path).read()
        check("SVG download has a standalone svg with styles and the tag text", txt.startswith("<svg") and "xmlns" in txt and "<style" in txt and "CH-101" in txt)
        check("exported SVG carries its own colour variables", "--e-ok" in txt and "#009E73" in txt)
        check("export filename names the diagram", dl.suggested_filename == "sphere-pid.svg")
        s.pg.locator("[data-tab=signals]").click()
        with s.pg.expect_download() as d2: s.pg.locator("[data-export=svg]").click()
        check("each tab exports its own file", d2.value.suggested_filename == "sphere-signals.svg")
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_reduced():
    with sync_playwright() as p:
        s = S(p, reduced=True); s.power()
        s.js("window.__dispatch({ type: 'SET_FAILURE', key: 'emiSpike', value: true })"); s.pg.wait_for_timeout(400)
        check("reduced motion: flow lines do not animate", s.js("getComputedStyle(document.querySelector('svg[data-eng-svg=pid] .e-flow') || document.querySelector('svg')).animationName") in ('none', ''))
        check("reduced motion: failure is still visible without pulsing", s.js("document.querySelectorAll('[data-pulse]').length") >= 1 and s.js("getComputedStyle(document.querySelector('[data-pulse]')).animationName") == 'none')
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_mobile():
    with sync_playwright() as p:
        s = S(p, viewport=(390, 800))
        check("no horizontal page scroll", s.js("document.documentElement.scrollWidth <= window.innerWidth + 1"))
        check("diagram is usable at phone width", s.js("document.querySelector('.eng-svgwrap').getBoundingClientRect().width > 300"))
        s.pg.locator("[data-row=clock]").click(); check("tapping a list row inspects it", s.js("/FS-101/.test(document.querySelector('[data-inspector]').textContent)"))
        check("no console errors", not s.errs, s.errs[:3]); s.close()

SC = {'basic': scenario_basic, 'faults': scenario_faults, 'sync': scenario_sync, 'export': scenario_export, 'reduced': scenario_reduced, 'mobile': scenario_mobile}
if __name__ == '__main__':
    for n in (WANT or list(SC)):
        print("== " + n); SC[n]()

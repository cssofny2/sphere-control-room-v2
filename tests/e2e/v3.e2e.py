"""End-to-end checks for Dr. Wire v3: name, uncertainty, voice shaping, wider search, screensaver, security cameras, coat logo.

    npx vite preview --port 4173 &          # after npm run build
    python3 tests/e2e/v3.e2e.py [base_url] [scenario ...]

Scenarios: name, search, voice, screensaver, cameras, look   (default: all)
/api/technician and /api/lookup answer 404 (static host); Wikipedia is mocked, so no network or API key is needed.
"""
import json, os, sys
_src = open(os.path.join(os.path.dirname(__file__), "technician.e2e.py")).read()
exec(_src[: _src.index("def scenario_call")])      # reuse INIT, Session, check, start_call, power_on

CORS = {"access-control-allow-origin": "*", "content-type": "application/json"}
def wiki(route, request):
    u = request.url
    if "list=search" in u: route.fulfill(status=200, headers=CORS, body=json.dumps({"query": {"search": [{"title": "Honey bee"}]}}))
    else: route.fulfill(status=200, headers=CORS, body=json.dumps({"title": "Honey bee", "extract": "Honey bees are eusocial flying insects. They build colonies. A third sentence.", "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Honey_bee"}}}))

def connect(s, text_only=True):
    s.pg.route("**/api/lookup", lambda r, q: r.fulfill(status=404, body="nf"))
    s.pg.route("**/api/technician", lambda r, q: r.fulfill(status=404, body="nf"))
    s.pg.route("**/api/email", lambda r, q: r.fulfill(status=404, body="nf"))
    s.pg.route("**/en.wikipedia.org/**", wiki)
    power_on(s); s.js("window.__lab.sci.timeScale = 6")
    start_call(s, mic=False)
    s.wait_for("document.querySelector('[data-call-bar]')?.dataset.callState === 'connected'", 120, "connected")

def ask(s, text):
    s.sc.locator("[data-call-input]").fill(text); s.sc.locator("[data-call-send]").click()

def last_wire(s): return s.js("(() => { const x = [...document.querySelectorAll('.ls-cap-wire')]; return x.length ? x[x.length - 1].textContent : ''; })()")

def scenario_name():
    with sync_playwright() as p:
        s = Session(p, mock=False); connect(s)
        s.wait_for("window.__spoken.length >= 2", 20, "greeting spoken")
        check("greeting asks who is calling", s.js("/Doctor Wire speaking/.test(window.__spoken.join(' ')) && /\\?/.test(window.__spoken.slice(0, 3).join(' '))"), s.js("window.__spoken.slice(0, 3)"))
        ask(s, "Hi, this is Maya"); s.wait_for("window.__spoken.some(t => /Maya/.test(t))", 20, "name used")
        check("he greets her by name", s.js("/Maya/.test(document.querySelector('[data-call-captions]').textContent)"))
        for q in ("how are you", "fine thanks", "what time is it", "thanks", "how are you"): ask(s, q); s.pg.wait_for_timeout(400)
        n = s.js("window.__spoken.filter(t => /Maya/.test(t)).length")
        check("he keeps using the name now and then (not every reply)", 2 <= n < s.js("window.__spoken.length"), n)
        ask(s, "what is my name"); s.wait_for("/Maya/.test(document.querySelector('.ls-cap-wire:last-of-type')?.textContent || '')", 20, "remembers")
        check("nothing about the name is written to browser storage", s.js("!JSON.stringify(Object.entries(localStorage)).includes('Maya')"))
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_search():
    with sync_playwright() as p:
        s = Session(p, mock=False); connect(s)
        ask(s, "tell me about the honey bee")
        s.wait_for("document.querySelector('[data-desk-screen]')?.textContent.includes('Encyclopedia')", 90, "result page")
        check("a question outside the lab is looked up (service down -> Wikipedia) and the result type is shown on screen", s.js("/Result type: Encyclopedia/.test(document.querySelector('[data-desk-screen]').textContent)"))
        s.wait_for("/colonies/.test(window.__spoken.join(' '))", 60, "spoken")
        check("he says the answer came from Wikipedia and reads two sentences", s.js("/Wikipedia article.*eusocial.*colonies/.test(window.__spoken.join(' '))") and not s.js("window.__spoken.some(t => /third sentence/.test(t))"))
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_voice():
    with sync_playwright() as p:
        s = Session(p, mock=False)
        s.pg.evaluate("""() => { window.__utt = []; const synth = window.speechSynthesis; const orig = synth.speak; synth.speak = u => { window.__utt.push({ t: u.text, r: u.rate, p: u.pitch }); window.__spoken.push(u.text); setTimeout(() => { try { u.onstart && u.onstart({}); u.onend && u.onend({}); } catch (e) {} }, 30); }; }""")
        connect(s)
        ask(s, "what is the VNA"); s.wait_for("window.__utt.some(u => /V N A/.test(u.t)) && window.__utt.some(u => /230.5 kilohertz/.test(u.t))", 30, "pronounced")
        check("abbreviations are spoken as letters (VNA -> V N A)", True)
        ask(s, "zorbulax quantum frobnicator"); s.pg.wait_for_timeout(2500)
        u = s.js("window.__utt")
        check("speech is cut into phrases with varied rate and pitch", len(u) > len(set(x["t"] for x in u[:1])) and len({x["r"] for x in u}) > 2 and len({x["p"] for x in u}) > 2, u[:6])
        check("every phrase stays in a natural range", all(0.8 <= x["r"] <= 1.2 and 0.8 <= x["p"] <= 1.2 for x in u))
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_look():
    with sync_playwright() as p:
        s = Session(p, mock=False, viewport=(1280, 800)); connect(s)
        names = s.js("(() => { const out = []; window.__lab.sci.root.traverse(o => { if (['logo-chest', 'logo-back', 'badge'].includes(o.name)) out.push([o.name, !!o.material.map, o.material.map && o.material.map.image && o.material.map.image.width]); }); return out; })()")
        check("the S.P.H.E.R.E. logo is on the coat (chest and back) with an ID badge, each with a texture", sorted(n[0] for n in names) == ["badge", "logo-back", "logo-chest"] and all(n[1] and n[2] >= 256 for n in names), names)
        check("he is a solid shaded figure, not a wireframe", s.js("(() => { let wire = 0, solid = 0; window.__lab.sci.root.traverse(o => { if (o.isMesh) { if (o.material.wireframe) wire++; else solid++; } }); return wire === 0 && solid > 60; })()"))
        check("his eyes blink without being stretched", s.js("(() => { let ok = true; window.__lab.sci.root.traverse(o => { if (o.type === 'Group' && o.children.length === 2 && o.children[0].geometry && o.children[0].geometry.type === 'SphereGeometry' && o.scale.y > 1.01) ok = false; }); return ok; })()"))
        s.close()

def scenario_screensaver():
    with sync_playwright() as p:
        s = Session(p, mock=False, viewport=(1280, 800)); s.pg.route("**/api/email", lambda r, q: r.fulfill(status=404, body="nf")); s.pg.route("**/api/lookup", lambda r, q: r.fulfill(status=404, body="nf")); s.pg.route("**/api/technician", lambda r, q: r.fulfill(status=404, body="nf"))
        power_on(s)
        check("the screensaver is off at first", s.js("window.__lab.lab.screensaver.active === false"))
        s.js("window.__lab.lab.screensaver.setAfter(0.5)"); s.wait_for("window.__lab.lab.screensaver.active === true", 20, "screensaver on")
        check("idle computer starts the screensaver", True)
        s.sc.locator("button.ls-btn", has_text="Screens").first.click(); s.pg.wait_for_timeout(1500)
        a = s.js("(() => { const c = document.querySelector('[data-lab-scene] canvas'); return c.toDataURL().length; })()")
        s.js("window.__lab.sys.desk.showPage({kind:'results',title:'x',site:'web search',lines:['hello']})"); s.pg.wait_for_timeout(600)
        check("using the computer wakes it", s.js("window.__lab.lab.screensaver.active === false"))
        s.js("window.__lab.sys.desk.reset()"); s.js("window.__lab.lab.screensaver.setAfter(0.5)"); s.wait_for("window.__lab.lab.screensaver.active === true", 20, "back to screensaver")
        check("it comes back after another idle spell", True)
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_cameras():
    with sync_playwright() as p:
        s = Session(p, mock=False, viewport=(1280, 800)); s.pg.route("**/api/email", lambda r, q: r.fulfill(status=404, body="nf"))
        n = s.js("(() => { let k = 0; window.__lab.lab.scene.traverse(o => { if (/^cctv-\\d$/.test(o.name)) k++; }); return k; })()")
        check("three security cameras are mounted in the room", n == 3, n)
        check("each has a fixed viewpoint", s.js("window.__lab.lab.cameras.length === 3"))
        pos0 = s.js("window.__lab.cam.position.toArray().map(v => +v.toFixed(2)).join()")
        for i in (1, 2, 3):
            s.sc.locator("button.ls-btn", has_text=f"Cam {i}").first.click(); s.pg.wait_for_timeout(500)
            check(f"Cam {i}: on-screen display with its name, a time stamp and REC", s.js(f"(() => {{ const o = document.querySelector('[data-cctv]'); return !!o && o.dataset.cctvView === '{i}' && /CAM {i}/.test(o.querySelector('[data-cctv-label]').textContent) && /\\d\\d\\/\\d\\d\\/\\d{{4}} \\d\\d:\\d\\d:\\d\\d/.test(o.querySelector('[data-cctv-time]').textContent) && /REC/.test(o.textContent); }})()"))
            check(f"Cam {i}: its own housing is hidden, the others are not", s.js(f"(() => {{ const v = {{}}; window.__lab.lab.scene.traverse(o => {{ if (/^cctv-\\d$/.test(o.name)) v[o.name] = o.visible; }}); return v['cctv-{i}'] === false && Object.entries(v).filter(([k]) => k !== 'cctv-{i}').every(([, x]) => x); }})()"))
            check(f"Cam {i}: orbit controls are locked (static view)", s.js("window.__lab.controls.enabled === false"))
            s.sc.locator(".ls-stage").screenshot(path=f"/tmp/cam{i}.png")
        s.sc.locator("button.ls-btn", has_text="All cams").first.click(); s.pg.wait_for_timeout(700)
        check("All cams tiles the three views plus an empty fourth slot", s.js("document.querySelectorAll('[data-cctv] .ls-cctv-cell').length === 4 && /NO SIGNAL/.test(document.querySelector('[data-cctv]').textContent)"))
        s.sc.locator("[data-cctv-exit]").click(); s.pg.wait_for_timeout(500)
        check("exit returns to the normal 3D view", s.js("!document.querySelector('[data-cctv]') && window.__lab.controls.enabled === true && window.__lab.cam.position.toArray().map(v => +v.toFixed(2)).join() === '" + pos0 + "'"))
        check("all housings are visible again", s.js("(() => { let all = true; window.__lab.lab.scene.traverse(o => { if (/^cctv-\\d$/.test(o.name) && !o.visible) all = false; }); return all; })()"))
        check("no console errors", not s.errs, s.errs[:3]); s.close()

ALL = {"name": scenario_name, "search": scenario_search, "voice": scenario_voice, "look": scenario_look, "screensaver": scenario_screensaver, "cameras": scenario_cameras}
for name in (WANT or ALL):
    print("== " + name); ALL[name]()

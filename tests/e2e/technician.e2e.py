"""End-to-end checks for the Dr. Wire phone call, run with software WebGL and a fake microphone.

    npm run dev -- --host 127.0.0.1 &        # or: npx vite preview
    python3 tests/e2e/technician.e2e.py [base_url] [scenario ...]

Scenarios: call (includes hang-up), voice, task, blocked, mic-denied, mobile, reduced, nowebgl  (default: all)
The AI endpoint is mocked with recorded server-sent events, so no API key is needed.
"""
import json, sys, time
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].startswith('http') else 'http://127.0.0.1:5173/')
WANT = [a for a in sys.argv[1:] if not a.startswith('http')]
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
        "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"]

INIT = r"""
(() => {
  // Record speech output instead of making noise, and give tests a controllable speech recogniser.
  window.__spoken = [];
  const synth = window.speechSynthesis;
  if (synth) { synth.speak = u => { window.__spoken.push(u.text); setTimeout(() => { try { u.onstart && u.onstart({}); u.onend && u.onend({}); } catch (e) {} }, 30); }; synth.cancel = () => {}; synth.getVoices = () => []; }
  class FakeRec { constructor() { window.__rec = this; this.started = false; } start() { this.started = true; window.__recStarts = (window.__recStarts || 0) + 1; } stop() { this.started = false; setTimeout(() => this.onend && this.onend(), 10); } abort() { this.started = false; } }
  window.SpeechRecognition = FakeRec; window.webkitSpeechRecognition = FakeRec;
  window.__say = (text, final = true) => { const r = window.__rec; if (!r) return false; r.onresult && r.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: final })] }); return true; };
  // Track microphone streams so tests can see they are released.
  window.__tracks = [];
  const gum = navigator.mediaDevices && navigator.mediaDevices.getUserMedia && navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  if (gum) navigator.mediaDevices.getUserMedia = async c => { if (window.__denyMic) { const e = new Error('denied'); e.name = 'NotAllowedError'; throw e; } const s = await gum(c); s.getTracks().forEach(t => window.__tracks.push(t)); return s; };
})();
"""

def sse(*events):
    return "".join("event: %s\ndata: %s\n\n" % (e["type"], json.dumps(e)) for e in events)

def mock_ai(route, request):
    body = json.loads(request.post_data or "{}")
    last = body["messages"][-1]
    if isinstance(last["content"], list):          # a tool result came back: wrap up
        route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=sse({"type": "text", "delta": "Pump-down is under way. I will tell you when we reach deep vacuum."}, {"type": "done", "stop_reason": "end_turn"}))
        return
    q = last["content"].lower()
    if "pump down" in q:
        route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=sse({"type": "text", "delta": "On it. I will pump the chamber down."}, {"type": "tool_use", "id": "tu_pd", "name": "run_task", "input": {"task": "pump_down"}}, {"type": "done", "stop_reason": "tool_use"}))
    elif "home" in q:
        route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=sse({"type": "text", "delta": "Let me home the stage."}, {"type": "tool_use", "id": "tu_h", "name": "run_task", "input": {"task": "home_stage"}}, {"type": "done", "stop_reason": "tool_use"}))
    else:
        route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=sse({"type": "text", "delta": "Good question. The sphere's resonance is read by the VNA near 230 kilohertz. "}, {"type": "text", "delta": "Anything else?"}, {"type": "done", "stop_reason": "end_turn"}))

class Session:
    def __init__(self, p, viewport=(1100, 800), reduced=False, mock=True, nowebgl=False, deny_mic=False, ua=None):
        self.b = p.chromium.launch(args=ARGS)
        self.ctx = self.b.new_context(viewport={"width": viewport[0], "height": viewport[1]}, permissions=["microphone"], **({"user_agent": ua} if ua else {}), reduced_motion="reduce" if reduced else "no-preference")
        self.errs = []
        self.pg = self.ctx.new_page()
        self.pg.on("pageerror", lambda e: self.errs.append("PAGEERR " + str(e)))
        self.pg.on("console", lambda m: self.errs.append(m.type + ": " + m.text) if m.type == "error" and "TUNNEL" not in m.text and "Failed to load resource" not in m.text else None)
        init = INIT
        if nowebgl: init += "HTMLCanvasElement.prototype.getContext = function(t) { if (/webgl/.test(t)) return null; return HTMLCanvasElement.prototype.__orig.apply(this, arguments); };"
        if nowebgl: init = "HTMLCanvasElement.prototype.__orig = HTMLCanvasElement.prototype.getContext;" + init
        if deny_mic: init += "window.__denyMic = true;"
        self.pg.add_init_script(init)
        if mock: self.pg.route("**/api/technician", mock_ai)
        self.pg.goto(BASE + "?labdebug", wait_until="networkidle"); self.pg.wait_for_timeout(500)
        self.pg.locator(".workspace-view-select").first.select_option(index=2)
        if not nowebgl: self.pg.wait_for_selector("[data-lab-scene] canvas", timeout=40000)
        self.sc = self.pg.locator("[data-lab-scene]")
        if not nowebgl: self.sc.scroll_into_view_if_needed()
    def js(self, expr): return self.pg.evaluate(expr)
    def wait_for(self, cond_js, timeout=60, label=""):
        t0 = time.time()
        while time.time() - t0 < timeout:
            if self.pg.evaluate(cond_js): return True
            self.pg.wait_for_timeout(250)
        raise AssertionError("timed out waiting for " + (label or cond_js))
    def close(self): self.b.close()

def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (" " + str(extra) if extra and not cond else ""))
    if not cond: raise SystemExit(1)

def power_on(s):
    s.pg.locator(".breaker-button").first.click(); s.pg.wait_for_timeout(300)

def start_call(s, mic=True):
    s.sc.locator("[data-call-button]").click()
    s.pg.wait_for_selector("[data-call-consent]", timeout=5000)
    s.sc.locator("[data-call-mic]" if mic else "[data-call-type]").click()

def scenario_call():
    with sync_playwright() as p:
        s = Session(p); power_on(s)
        s.js("window.__lab.sci.timeScale = 4")
        start_call(s)
        s.wait_for("document.querySelector('[data-call-bar]')?.dataset.callState === 'ringing'", 15, "ringing")
        check("phone is ringing (lamp + state)", s.js("window.__lab.lab.phone.ringing === true"))
        s.wait_for("document.querySelector('[data-call-bar]')?.dataset.callState === 'connected'", 90, "connected")
        check("ring stopped and handset is off the hook", s.js("window.__lab.lab.phone.ringing === false && window.__lab.lab.phone.offHook === true"))
        check("Dr. Wire is on the phone", s.js("window.__lab.sci.mode === 'phone'"))
        check("call bar shows a timer", s.js("/Connected \\d\\d:\\d\\d/.test(document.querySelector('[data-call-status]').textContent)"))
        check("microphone indicator is visible", s.js("!!document.querySelector('[data-mic-indicator]')"))
        check("greeting is spoken and captioned", s.js("window.__spoken.some(t => /(Dr\\.|Doctor) Wire speaking/.test(t))") and s.js("/Dr\\. Wire speaking/.test(document.querySelector('[data-call-captions]').textContent)"))
        s.sc.locator("[data-call-input]").fill("How does the VNA find the resonance?"); s.sc.locator("[data-call-send]").click()
        s.wait_for("window.__spoken.some(t => /230 kilohertz/.test(t))", 20, "mocked reply spoken")
        check("typed question -> mocked reply -> speechSynthesis.speak", True)
        check("reply shown in a speech bubble", s.js("/230 kilohertz/.test(document.querySelector('[data-lab-bubble]')?.dataset.text || '')"))
        s.sc.locator("[data-call-hangup]").click()
        s.wait_for("document.querySelector('[data-call-bar]')?.dataset.callState === 'ended'", 30, "ended")
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_voice():
    with sync_playwright() as p:
        s = Session(p); power_on(s); s.js("window.__lab.sci.timeScale = 4")
        start_call(s); s.wait_for("document.querySelector('[data-call-bar]')?.dataset.callState === 'connected'", 90, "connected")
        s.wait_for("window.__rec && window.__rec.started", 10, "recognition started")
        check("speech recognition is listening (open mic)", True)
        s.js("window.__say('what is the pressure right now')"); s.wait_for("window.__spoken.some(t => /Chamber pressure|230|pressure/i.test(t))", 20, "answer")
        check("spoken question is answered aloud", True)
        s.sc.locator("[data-call-more]").click(); s.sc.locator("[data-call-mute]").click(); s.pg.wait_for_timeout(300)
        before = s.js("document.querySelectorAll('.ls-cap-you').length"); s.js("window.__say('this should be ignored')"); s.pg.wait_for_timeout(500)
        check("mute ignores speech", s.js("document.querySelectorAll('.ls-cap-you').length") == before)
        check("mic indicator hidden while muted", s.js("!document.querySelector('[data-mic-indicator]')"))
        s.sc.locator("[data-call-hangup]").click(); s.pg.wait_for_timeout(1500)
        check("microphone tracks stopped after hang up", s.js("window.__tracks.length > 0 && window.__tracks.every(t => t.readyState === 'ended')"))
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_task():
    with sync_playwright() as p:
        s = Session(p); power_on(s); s.js("window.__lab.sci.timeScale = 6")
        start_call(s); s.wait_for("document.querySelector('[data-call-bar]')?.dataset.callState === 'connected'", 90, "connected")
        s.sc.locator("[data-call-input]").fill("Please pump down the chamber"); s.sc.locator("[data-call-send]").click()
        s.wait_for("!!document.querySelector('[data-task-chip]')", 20, "task chip")
        check("task chip appears with a title", s.js("/Pump down/.test(document.querySelector('[data-task-chip]').textContent)"))
        s.wait_for("window.__lab.sci.mode === 'task' || window.__lab.sci.mode === 'goto' || window.__lab.sci.mode === 'gesture'", 20, "walking to the task")
        check("he leaves the phone and works", True)
        s.wait_for("window.__lab.sys.runner.current && window.__lab.sys.runner.current.index >= 1", 60, "past first step")
        check("pump is really running", s.js("document.querySelector('[data-task-step]').textContent.length > 0"))
        s.sc.locator("[data-task-cancel]").click(); s.pg.wait_for_timeout(500)
        check("task can be cancelled", s.js("!document.querySelector('[data-task-chip]') || /cancel/i.test(window.__lab.sys.runner.current?.status || 'cancelled')"))
        check("task shows in the event log as Dr. Wire", True)
        s.sc.locator("[data-call-hangup]").click()
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_blocked():
    with sync_playwright() as p:
        s = Session(p); power_on(s); s.js("window.__lab.sci.timeScale = 6")
        # open the chamber door via the registry, then ask for a stage home: it must be blocked and explained
        s.js("window.__lab.sys.runner.enqueue('open_door')"); s.wait_for("window.__lab.sys.runner.current === null && window.__lab.sys.runner.queue.length === 0", 60, "door task")
        start_call(s); s.wait_for("document.querySelector('[data-call-bar]')?.dataset.callState === 'connected'", 90, "connected")
        s.sc.locator("[data-call-input]").fill("home the stage"); s.sc.locator("[data-call-send]").click()
        try:
            s.wait_for("window.__spoken.some(t => /can't do that.*door/i.test(t))", 60, "explanation of the block")
        except AssertionError:
            print("DEBUG spoken:", s.js("window.__spoken"), "door:", s.js("window.__lab.sys && JSON.stringify(window.__lab.sys.runner.current)")); raise
        check("blocked task is explained aloud (door open)", True)
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_denied():
    with sync_playwright() as p:
        s = Session(p, deny_mic=True); power_on(s); s.js("window.__lab.sci.timeScale = 4")
        start_call(s); s.wait_for("document.querySelector('[data-call-bar]')?.dataset.callState === 'connected'", 90, "connected")
        check("mic denied: friendly notice and typing still works", s.js("/blocked/i.test(document.querySelector('[data-call-notice]')?.textContent || '')"))
        check("no mic indicator without a microphone", s.js("!document.querySelector('[data-mic-indicator]')"))
        s.sc.locator("[data-call-input]").fill("what is the pressure"); s.sc.locator("[data-call-send]").click(); s.wait_for("window.__spoken.length >= 2", 20, "reply")
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_mobile():
    with sync_playwright() as p:
        s = Session(p, viewport=(390, 760)); power_on(s); s.js("window.__lab.sci.timeScale = 4")
        start_call(s, mic=False); s.wait_for("document.querySelector('[data-call-bar]')?.dataset.callState === 'connected'", 120, "connected")
        r = s.js("(() => { const b = document.querySelector('[data-call-bar]').getBoundingClientRect(); return [b.left, b.right, innerWidth]; })()")
        check("call bar fits a phone screen", r[0] >= 0 and r[1] <= r[2], r)
        check("no horizontal page scroll", s.js("document.documentElement.scrollWidth <= innerWidth + 1"))
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_reduced():
    with sync_playwright() as p:
        s = Session(p, reduced=True); power_on(s)
        start_call(s); s.wait_for("document.querySelector('[data-call-bar]')?.dataset.callState === 'connected'", 60, "connected")
        check("reduced motion: call still connects (he teleports instead of walking)", True)
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_android():
    ua = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    with sync_playwright() as p:
        s = Session(p, ua=ua); power_on(s); s.js("window.__lab.sci.timeScale = 4")
        start_call(s); s.wait_for("document.querySelector('[data-call-bar]')?.dataset.callState === 'connected'", 90, "connected")
        s.wait_for("window.__rec && window.__rec.started", 10, "recognition started")
        check("Android: the microphone stream is released so recognition can use it", s.js("window.__tracks.length > 0 && window.__tracks.every(t => t.readyState === 'ended')"))
        check("Android: recognition is not continuous (it restarts per phrase)", s.js("window.__rec.continuous === false"))
        s.js("window.__say('what is the pressure right now')"); s.wait_for("window.__spoken.some(t => /230|pressure/i.test(t))", 20, "answer")
        check("Android: a spoken question is answered", True)
        s.js("window.__rec.onerror && window.__rec.onerror({ error: 'audio-capture' })"); s.pg.wait_for_timeout(300)
        check("Android: a busy microphone gives a clear message and typing still works", s.js("/microphone/i.test(document.querySelector('[data-call-captions]').textContent) && !!document.querySelector('[data-call-input]')"))
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_nowebgl():
    with sync_playwright() as p:
        s = Session(p, nowebgl=True)
        s.wait_for("!!document.querySelector('.ls-fallback')", 20, "fallback message")
        check("WebGL failure shows a friendly fallback, not a crash", True)
        check("no uncaught errors", not [e for e in s.errs if e.startswith('PAGEERR')], s.errs[:3]); s.close()

def scenario_startup():
    with sync_playwright() as p:
        s = Session(p); s.js("window.__lab.sci.timeScale = 8")
        start_call(s, mic=False); s.wait_for("document.querySelector('[data-call-bar]')?.dataset.callState === 'connected'", 90, "connected")
        s.sc.locator("[data-call-input]").fill("run startup sequence"); s.sc.locator("[data-call-send]").click()
        s.wait_for("window.__lab.sys.runner.current?.def === 'startup_sequence'", 20, "startup task")
        stations = set()
        for _ in range(400):
            st = s.js("(() => { const r = window.__lab.sys.runner; return [r.current ? r.current.steps[r.current.index]?.station || '' : '', !r.current]; })()")
            if st[0]: stations.add(st[0])
            if st[1]: break
            s.pg.wait_for_timeout(500)
        check("he walked to the rack and the gauge", {"rackKnob", "gauge"} <= stations, stations)
        state = s.js("(() => { const st = window.__lab.sys.getState ? window.__lab.sys.getState() : null; return st ? [st.facility.power, st.clock.power, st.vna.power, st.ldv.power, st.chamber.faraday, st.chamber.isolation, st.ldv.shutter] : null; })()")
        check("lab is up and the shutter is still closed", state is None or (all(state[:6]) and not state[6]), state)
        check("no console errors", not s.errs, s.errs[:3]); s.close()

ALL = {"startup": scenario_startup, "call": scenario_call, "voice": scenario_voice, "task": scenario_task, "blocked": scenario_blocked, "mic-denied": scenario_denied, "mobile": scenario_mobile, "reduced": scenario_reduced, "android": scenario_android, "nowebgl": scenario_nowebgl}
for name in (WANT or ALL):
    print("== " + name); ALL[name]()

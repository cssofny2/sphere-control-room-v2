"""End-to-end checks for Dr. Wire's computer: dual screens, look-ups, lunch, parts and email.

    npx vite preview --port 4173 &          # after npm run build
    python3 tests/e2e/desk.e2e.py [base_url] [scenario ...]

Scenarios: lookup, lunch, part, mail, screens   (default: all)
/api/technician answers 404 (static host), so Dr. Wire uses his built-in brain. /api/lookup and /api/email are mocked.
"""
import json, os, sys
_src = open(os.path.join(os.path.dirname(__file__), "technician.e2e.py")).read()
exec(_src[: _src.index("def scenario_call")])      # reuse INIT, Session, check, start_call, power_on

def lookup_ok(route, request):
    route.fulfill(status=200, content_type="application/json", body=json.dumps({"answer": "Liquid nitrogen boils at minus 196 degrees Celsius. That is about 77 kelvin.", "sources": [{"title": "Nitrogen", "url": "https://example.org/n2", "domain": "example.org"}]}))

def mail_api(state):
    def h(route, request):
        a = json.loads(request.post_data or "{}").get("action")
        if a == "status": body = {"enabled": True, "canSend": True, "canDraft": False, "durable": True, "address": "drwire@example.org"}
        elif a == "poll":
            body = {"mail": [] if state["delivered"] else [{"id": "m1", "from": "michael@example.com", "subject": "Quick question", "text": "Hi Wire. How do I calibrate the VNA? Thanks, Michael", "receivedAt": 1}]}; state["delivered"] = True
        elif a == "send": state["sent"].append(json.loads(request.post_data)); body = {"ok": True}
        else: body = {"ok": True}
        route.fulfill(status=200, content_type="application/json", body=json.dumps(body))
    return h

def connect(s, mail=None):
    s.pg.route("**/api/lookup", lookup_ok)
    s.pg.route("**/api/email", mail or (lambda r, q: r.fulfill(status=404, body="not found")))
    s.pg.route("**/api/technician", lambda r, q: r.fulfill(status=404, body="not found"))
    power_on(s); s.js("window.__lab.sci.timeScale = 6"); s.js("window.__lab.sys.desk.constructor && 0")
    start_call(s, mic=False)
    s.wait_for("document.querySelector('[data-call-bar]')?.dataset.callState === 'connected'", 120, "connected")

def ask(s, text):
    s.sc.locator("[data-call-input]").fill(text); s.sc.locator("[data-call-send]").click()

def scenario_lookup():
    with sync_playwright() as p:
        s = Session(p, mock=False); connect(s)
        ask(s, "what time is it?"); s.wait_for("window.__spoken.some(t => /^It's \\d{1,2}:\\d\\d (AM|PM)\\.$/.test(t))", 20, "time")
        check("he tells the time", True)
        ask(s, "what time are you working until?"); s.wait_for("window.__spoken.some(t => /five PM|shift/i.test(t))", 20, "shift")
        check("he answers when his shift ends", True)
        ask(s, "what is the boiling point of liquid nitrogen exactly")
        s.wait_for("document.querySelector('[data-desk-screen]')?.dataset.screenKind === 'browser'", 60, "browser on his screen")
        check("the search appears on his workstation screen", True)
        s.wait_for("/liquid nitrogen/i.test(document.querySelector('[data-desk-screen]')?.textContent || '') && /Search box|Results/.test(document.querySelector('[data-desk-screen]').textContent)", 60, "query typed")
        s.wait_for("window.__spoken.some(t => /here's what I found.*196/.test(t))", 90, "answer read aloud")
        check("he reads the answer naturally and names the source", s.js("window.__spoken.some(t => /example dot org/.test(t))"))
        check("results with the source are on screen", s.js("/example\\.org/.test(document.querySelector('[data-desk-screen]').textContent)"))
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_lunch():
    with sync_playwright() as p:
        s = Session(p, mock=False); connect(s)
        ask(s, "do you want to grab something for lunch?"); s.wait_for("window.__spoken.some(t => /grab something for lunch|put in an order/.test(t))", 20, "he asks")
        ask(s, "yes"); s.wait_for("window.__spoken.some(t => /Where do you feel like/.test(t))", 20, "asks where")
        ask(s, "mcdonalds"); s.wait_for("!!document.querySelector('[data-desk-handoff]')", 90, "cart ready")
        check("cart is on screen with a DoorDash button", s.js("document.querySelector('[data-desk-handoff]').href.startsWith('https://www.doordash.com/')"))
        check("the link opens safely in a new tab", s.js("document.querySelector('[data-desk-handoff]').rel.includes('noopener') && document.querySelector('[data-desk-handoff]').target === '_blank'"))
        check("he says he cannot pay, and never claims it was ordered", s.js("window.__spoken.some(t => /can't use your card/.test(t))") and not s.js("window.__spoken.some(t => /\\b(I ordered|has been ordered|order placed)\\b/i.test(t))"))
        check("order list says nothing was bought", s.js("/Nothing is bought or paid/.test(document.querySelector('[data-desk-orders]').textContent)"))
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_part():
    with sync_playwright() as p:
        s = Session(p, mock=False); connect(s)
        s.js("window.__lab.sys.flows") ; ask(s, "please order a replacement o-ring for the door")
        s.wait_for("!!document.querySelector('[data-confirm]')", 90, "asks to submit")
        check("he asks before submitting the requisition", s.js("/PR-1001/.test(document.querySelector('[data-confirm]').textContent)"))
        s.sc.locator("[data-confirm-yes]").click()
        s.wait_for("document.querySelector('[data-order-status=\"requisition-submitted\"]')", 30, "submitted")
        s.sc.locator("[data-call-hangup]").click(); s.wait_for("document.querySelector('[data-call-bar]')?.dataset.callState === 'ended'", 30, "ended")
        s.wait_for("!!document.querySelector('[data-incoming-call]')", 60, "he calls back")
        check("Dr. Wire calls back and the phone rings", s.js("window.__lab.lab.phone.ringing === true"))
        s.sc.locator("[data-incoming-answer]").click(); s.wait_for("window.__spoken.some(t => /calling back about the part.*estimated arrival/.test(t))", 120, "call-back message")
        check("call-back states the requisition and arrival day", s.js("window.__spoken.some(t => /PR-1001/.test(t))"))
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_mail():
    state = {"delivered": False, "sent": []}
    with sync_playwright() as p:
        s = Session(p, mock=False); s.pg.route("**/api/lookup", lookup_ok); s.pg.route("**/api/technician", lambda r, q: r.fulfill(status=404, body="nf")); s.pg.route("**/api/email", mail_api(state))
        power_on(s); s.js("window.__lab.sci.timeScale = 6")
        s.js("window.__lab.sys.mail.start()")        # the page started its mailbox before the mock was installed: start it again
        s.wait_for("document.querySelector('[data-desk-screen]')?.dataset.screenKind === 'email'", 120, "reads the email on screen")
        check("new mail makes him go to the computer and read it on screen", s.js("/Quick question/.test(document.querySelector('[data-desk-screen]').textContent)"))
        s.wait_for("window.__lab.sys.desk.state.screen.mail && window.__lab.sys.desk.state.screen.mail.mode === 'sent'", 120, "reply sent")
        check("the reply was sent through the server to that message only", len(state["sent"]) == 1 and state["sent"][0]["id"] == "m1" and "calibrat" in state["sent"][0]["body"].lower(), state["sent"])
        check("no console errors", not s.errs, s.errs[:3]); s.close()

def scenario_screens():
    with sync_playwright() as p:
        s = Session(p, mock=False, viewport=(1280, 800)); s.pg.route("**/api/email", lambda r, q: r.fulfill(status=404, body="nf"))
        power_on(s)
        s.sc.get_by_role("button", name="Screens").click(); s.pg.wait_for_timeout(1800)
        s.js("window.__lab.sys.desk.showPage({kind:'results',title:'Results for “test”',site:'web search',lines:['Nitrogen — example.org','','Liquid nitrogen boils at minus 196 degrees Celsius.'],footer:'Sources: example.org'}, 'about:websearch')")
        s.pg.wait_for_timeout(900)
        os.makedirs("/tmp/shots", exist_ok=True); s.sc.screenshot(path="/tmp/shots/screens.png")
        s.sc.locator("[data-desk-panel] .ls-x").click(); s.pg.wait_for_timeout(300); s.sc.locator(".ls-stage").screenshot(path="/tmp/shots/screens-clear.png")
        check("screenshot taken of the dual screens", os.path.getsize("/tmp/shots/screens.png") > 20000)
        check("no console errors", not s.errs, s.errs[:3]); s.close()

ALL = {"lookup": scenario_lookup, "lunch": scenario_lunch, "part": scenario_part, "mail": scenario_mail, "screens": scenario_screens}
for name in (WANT or ALL):
    print("== " + name); ALL[name]()

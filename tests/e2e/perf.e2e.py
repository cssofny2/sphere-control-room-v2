"""Performance guards for the 3D lab, run with software WebGL.

    npx vite preview --host 127.0.0.1 --port 4173 &
    python3 tests/e2e/perf.e2e.py [base_url]

Checks that fusing static meshes (a) cuts the draw calls a lot and (b) changes nothing you can see, including the parts that move:
door, stage, laser, bench jitter, pump, phone. Each picture is rendered in the same JavaScript task with and without the merge (?nomerge)
and compared pixel by pixel.
"""
import sys, io, base64, json
from playwright.sync_api import sync_playwright
from PIL import Image
import numpy as np

BASE = (sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].startswith('http') else 'http://127.0.0.1:4173/')
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"]

def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + ((" " + str(extra)) if extra and not cond else ""))
    if not cond: raise SystemExit(1)

VIEWS = {'overview': ([3.6, 2.4, 4.6], [0, 1.0, 0]), 'chamber': ([1.2, 1.5, 2.2], [0, 1.1, 0]), 'stage': ([0.5, 1.5, 1.2], [0, 1.0, 0]), 'rack': ([-1.6, 1.4, 2.0], [-3.1, 1.2, -0.5]),
         'bench': ([1.4, 1.8, 1.4], [2.9, 1.1, -1.9]), 'phone': ([0.6, 1.6, 0.2], [1.3, 1.4, -2.5]), 'pumps': ([2.2, 1.0, 1.6], [0.4, 0.3, 0.1])}
RICH = {
  "chamber": {"pressure": 0.002, "temperature": 4, "targetTemp": 20, "vent": False, "doorOpen": True, "faraday": True, "isolation": False, "turboRpm": 60, "roughingRpm": 100, "roughing": True, "turbo": True},
  "stage": {"x": 6, "y": -9, "z": 4, "actualX": 6, "actualY": -9, "actualZ": 4, "moving": True, "settling": True, "settleTime": 0.2},
  "vna": {"power": True, "rf": True, "trace": [{"s11": -1}, {"s11": -9}, {"s11": -2}]}, "ldv": {"power": True, "shutter": True, "laserReturn": 0.8}, "clock": {"power": True, "locked": True, "warmup": 9},
  "scope": {"power": True, "running": True, "trace": [{"value": 1}, {"value": 2}]}, "facility": {"power": True}, "experiment": {"records": [], "scanActive": True, "scanProgress": 0.4},
  "alarms": [{"acknowledged": False, "severity": "critical"}],
}

def render(q):
    out = {}
    with sync_playwright() as p:
        b = p.chromium.launch(args=ARGS); pg = b.new_context(viewport={'width': 1100, 'height': 700}).new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(BASE + '?labdebug' + q, wait_until='networkidle'); pg.wait_for_timeout(500)
        pg.locator('.workspace-view-select').first.select_option(index=2)
        pg.wait_for_selector('[data-lab-scene] canvas', timeout=60000); pg.wait_for_timeout(2500)
        for name, (pos, tgt) in VIEWS.items():
            data = pg.evaluate("""([pos, tgt, rich]) => { const L = window.__lab; L.sci.root.visible = false; L.lab.setQuality('low'); L.lab.screensaver.wake();
              L.cam.position.set(...pos); L.cam.lookAt(...tgt); L.cam.updateMatrixWorld(true);
              for (let i = 0; i < 40; i++) L.lab.update(rich, 0.05, 20 + i * 0.05);
              L.lab.phone.setRinging(true); L.lab.update(rich, 0.05, 22.1);
              L.renderer.shadowMap.needsUpdate = true; L.renderer.render(L.lab.scene, L.cam);
              const calls = L.renderer.info.render.calls; return { url: L.renderer.domElement.toDataURL('image/png'), calls }; }""", [pos, tgt, RICH])
            out[name] = (Image.open(io.BytesIO(base64.b64decode(data['url'].split(',')[1]))).convert('RGB'), data['calls'])
        b.close()
    return out, errs

a, ea = render(''); c, ec = render('&nomerge')
check("no page errors in either mode", not ea and not ec, ea + ec)
ca = max(v[1] for v in a.values()); cc = max(v[1] for v in c.values())
check("merging cuts draw calls by at least 35%% (%d vs %d)" % (ca, cc), ca <= cc * 0.65, (ca, cc))
for k in VIEWS:
    A = np.asarray(a[k][0]).astype(int); C = np.asarray(c[k][0]).astype(int); d = np.abs(A - C).max(axis=2)
    frac = float((d > 24).mean())
    check("%s looks identical with and without the merge (%.4f%% of pixels differ)" % (k, frac * 100), frac < 0.0025, frac)   # sub-pixel float differences along thin cables are fine
print("perf e2e done")

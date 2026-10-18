import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import './labscene.css';
import { buildLab, type Lab } from './buildLab';
import { Scientist } from './Scientist';
import { Foley } from './foley';
import type { Quality } from './labUtil';
import { DEFAULT_SETTINGS, type Settings, type Technician } from '../technician/dialogue';
import { createTechnicianSystem, type TechnicianSystem } from '../technician/system';
import { CallBar, CallConsent, TaskChip } from '../technician/CallUI';
import { DeskPanel, IncomingCall } from '../technician/DeskPanel';
import type { Ctx } from '../technician/actions';
import { extractFactsPlus } from '../technician/facts';
import TechnicianPanel from '../technician/TechnicianPanel';
import { getSelected } from '../engineering/selection';
import { PART_BY_ID } from '../engineering/parts';
import type { Focus, Mood } from './scientistBrain';

type Say = { text: string; focus: Focus; mood: Mood; kind: string };

type Props = { stateRef: React.MutableRefObject<any>; reduced?: boolean; onHelp?: (key: string) => void; dispatch?: (action: any) => void; helpersRef?: React.MutableRefObject<Ctx['helpers'] | undefined> };
type CamPreset = { pos: [number, number, number]; target: [number, number, number] };
const PRESETS: Record<string, CamPreset> = {
  overview: { pos: [3.3, 3.1, 4.4], target: [-0.1, 0.95, -0.2] },
  chamber: { pos: [2.3, 1.9, 2.5], target: [0, 1.0, 0] },
  stage: { pos: [1.35, 1.75, 0.3], target: [0, 1.0, 0.05] },
  rack: { pos: [-1.0, 1.5, 2.6], target: [-3.0, 1.1, -0.4] },
  bench: { pos: [1.6, 1.7, 1.5], target: [2.8, 1.0, -1.8] },
  screens: { pos: [2.95, 1.45, -0.55], target: [2.95, 1.2, -2.05] },
  phone: { pos: [2.0, 1.6, -0.2], target: [1.3, 1.25, -2.4] },
};

const Btn = ({ on, f, children, label, title, call }: { on?: boolean; f: () => void; children: React.ReactNode; label?: string; title?: string; call?: boolean }) => <button type="button" className="ls-btn" aria-pressed={on === undefined ? undefined : on} aria-label={label} title={title} data-call-button={call ? '' : undefined} onClick={f}>{children}</button>;

function Typed({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => { setN(0); const id = window.setInterval(() => setN(v => { if (v >= text.length) { window.clearInterval(id); return v; } return v + 2; }), 28); return () => window.clearInterval(id); }, [text]);
  return <span>{text.slice(0, n)}</span>;
}

/** On-screen display for the security-camera views: name, live time stamp, REC light and an exit button. */
function CctvOverlay({ view, clock, labels, onExit }: { view: number | 'grid'; clock: string; labels: { id: number; label: string }[]; onExit: () => void }) {
  const cells = view === 'grid' ? [...labels.map(l => ({ label: l.label, off: false })), { label: 'CAM 4 · NOT INSTALLED', off: true }] : [{ label: labels[view - 1]?.label ?? `CAM ${view}`, off: false }];
  return (
    <div className={`ls-cctv${view === 'grid' ? ' is-grid' : ''}`} data-cctv data-cctv-view={String(view)} role="group" aria-label={view === 'grid' ? 'All security cameras' : `Security camera ${view}`}>
      {cells.map(c => (
        <div key={c.label} className={`ls-cctv-cell${c.off ? ' is-off' : ''}`}>
          <span className="ls-cctv-name" data-cctv-label>{c.label}</span>
          {c.off ? <span className="ls-cctv-nosig">NO SIGNAL</span> : <span className="ls-cctv-rec"><i aria-hidden="true" />REC</span>}
          {!c.off && <span className="ls-cctv-time" data-cctv-time>{clock}</span>}
        </div>
      ))}
      <button type="button" className="ls-btn ls-cctv-exit" data-cctv-exit onClick={onExit}>Exit cameras</button>
    </div>
  );
}

type QualitySel = 'auto' | 'high' | 'low';
const SETTINGS_KEY = 'sphere.technician.settings';
const CONSENT_KEY = 'sphere.technician.consent';
function loadSettings(): Settings {
  try { const j = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); if (j && typeof j === 'object') return { ...DEFAULT_SETTINGS, ...j, mode: ['coach', 'quiet', 'chatty'].includes(j.mode) ? j.mode : 'coach' }; } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}
const urlParam = (k: string) => { try { return new URLSearchParams(window.location.search).get(k); } catch { return null; } };

function LabScene3D({ stateRef, reduced = false, onHelp, dispatch, helpersRef }: Props) {
  const dispatchRef = useRef(dispatch); dispatchRef.current = dispatch;
  const helpersRefLocal = useRef<Ctx['helpers'] | undefined>(undefined); const helpers = helpersRef || helpersRefLocal;
  const wrap = useRef<HTMLDivElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const bubbleEl = useRef<HTMLDivElement>(null);
  const hoverEl = useRef<HTMLDivElement>(null);
  const reducedRef = useRef(reduced); reducedRef.current = reduced;
  const onHelpRef = useRef(onHelp); onHelpRef.current = onHelp;
  const api = useRef<{ lab?: Lab; cam?: THREE.PerspectiveCamera; controls?: OrbitControls; sci?: Scientist; go?: (k: string) => void; tech?: Technician; sys?: TechnicianSystem; say?: (r: Say) => void; foley?: Foley; snapshot?: () => void; setQ?: (q: QualitySel) => void; setCamView?: (v: number | 'grid' | null) => void }>({});
  const [failed, setFailed] = useState(false);
  const [cutaway, setCutaway] = useState(true);
  const [showSci, setShowSci] = useState(true);
  const [follow, setFollow] = useState(false);
  const [sound, setSound] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [qualitySel, setQualitySel] = useState<QualitySel>(() => { const f = urlParam('labq'); return f === 'high' || f === 'low' ? f : 'auto'; });
  const [effQuality, setEffQuality] = useState<Quality>('high');
  const [part, setPart] = useState<{ label: string; help: string } | null>(null);
  const [bubble, setBubble] = useState<(Say & { n: number }) | null>(null);
  const showSciRef = useRef(true); showSciRef.current = showSci;
  const followRef = useRef(false); followRef.current = follow;
  const qualitySelRef = useRef(qualitySel); qualitySelRef.current = qualitySel;
  const bubbleTimer = useRef(0);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const settingsRef = useRef(settings);
  const [, setLogN] = useState(0);
  const [sysReady, setSysReady] = useState<TechnicianSystem | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [camView, setCamView] = useState<number | 'grid' | null>(null);
  const [clockTxt, setClockTxt] = useState('');
  const counter = useRef(0);

  const speak = useCallback((r: Say) => {
    if (!showSciRef.current) return;
    const n = ++counter.current; setBubble({ ...r, n });
    window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubble(b => (b && b.n === n ? null : b)), Math.min(18000, 4200 + r.text.length * 55));
    api.current.sci?.say(r.focus, r.mood, r.text.length, performance.now());
  }, []);

  useEffect(() => {
    const host = canvasHost.current; if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { const hiDpiTouch = (window.devicePixelRatio || 1) >= 2 && !!window.matchMedia?.('(pointer: coarse)').matches; renderer = new THREE.WebGLRenderer({ antialias: !hiDpiTouch, powerPreference: 'high-performance' }); /* phones and tablets: no 4x MSAA on a dense screen, it costs a lot of fill for little gain */ } catch { setFailed(true); return; }
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;   // shadows are refreshed every few frames (see the loop), not every frame
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.82; renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement; canvas.setAttribute('role', 'img'); canvas.setAttribute('tabindex', '0');
    canvas.setAttribute('aria-label', '3D laboratory: thermal-vacuum chamber with XYZ stage and sphere, instrument rack, wall phone and Dr. Wire the lab technician, who wears the S.P.H.E.R.E. logo on his coat. Drag to orbit, scroll to zoom. Click a part to look at it.');
    host.appendChild(canvas);
    let lab: Lab;
    try { lab = buildLab(renderer); } catch (e) { console.error(e); setFailed(true); host.removeChild(canvas); renderer.dispose(); return; }
    const cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 60); cam.position.set(...PRESETS.overview.pos);
    const controls = new OrbitControls(cam, canvas); controls.target.set(...PRESETS.overview.target); controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minDistance = 0.6; controls.maxDistance = 9; controls.maxPolarAngle = Math.PI * 0.49; controls.update();
    // The three installed security cameras: fixed viewpoints (CAM 1 to 3), or all of them tiled. The orbit camera is left untouched underneath.
    const camsObj = lab.cameras.map(c => { const k = new THREE.PerspectiveCamera(c.fov, 16 / 9, 0.1, 60); k.position.set(...c.pos); k.lookAt(...c.target); return k; });
    let view: number | 'grid' | null = null; let activeCam: THREE.PerspectiveCamera = cam;
    const sci = new Scientist(); sci.reduced = reducedRef.current; lab.scene.add(sci.root); sci.setWorld(lab.anchors); sci.attachPhone(lab.phone);
    const foley = new Foley(); const fwd = new THREE.Vector3(); sci.onStep = () => foley.footstep(); sci.onEvent = n => { if (n === 'knob') { lab.turnKnob('vna', 0.5); foley.click(); } if (n === 'pickup') foley.latch(); if (n === 'hangup') foley.latch(); };
    const sys = createTechnicianSystem({
      stateRef, dispatch: a => dispatchRef.current?.(a), helpersRef: helpers, sci: sci as any, phone: lab.phone, foley, say: r => speak(r as any),
      settings: settingsRef.current, onUpdate: () => setLogN(Math.random()),
    });
    const tech = sys.tech;
    api.current = { lab, cam, controls, sci, tech, sys, foley };
    setSysReady(sys);
    lab.setDesk(sys.desk.state); const unDesk = sys.desk.subscribe(() => lab.setDesk(sys.desk.state));
    lab.setCutaway(true);
    if (urlParam('labdebug') !== null) (window as any).__lab = { lab, sci, cam, controls, tech, sys, foley, renderer };

    // ── quality, post-processing ──
    let shadowTick = 99, scaledDown = false, bubbleMeasure = 99, bubbleW = 0, bubbleH = 0, hostW = host.clientWidth || 640, hostH = host.clientHeight || 360;
    let eff: Quality = 'high'; let composer: EffectComposer | null = null; let renderPass: RenderPass | null = null; let frames = 0, ema = 0.016, lastRender = 0;
    const size = () => ({ w: host.clientWidth || 640, h: host.clientHeight || 360 });
    const ensureComposer = () => {
      if (composer) return composer; const { w, h } = size();
      try {
        composer = new EffectComposer(renderer); renderPass = new RenderPass(lab.scene, cam); composer.addPass(renderPass);
        composer.addPass(new OutputPass()); if ((window.devicePixelRatio || 1) < 1.5) composer.addPass(new SMAAPass()); composer.setSize(w, h);   // SMAA is redundant on high-DPI screens
      } catch (e) { console.warn('post-processing unavailable', e); composer = null; }
      return composer;
    };
    const applyQuality = (q: Quality) => {
      eff = q; lab.setQuality(q); sci.setLOD(q === 'high'); setEffQuality(q);
      renderer.setPixelRatio(q === 'high' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1);
      if (q === 'high') { ensureComposer(); const { w, h } = size(); composer?.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); composer?.setSize(w, h); }
      renderer.shadowMap.needsUpdate = true;
      resize();
    };
    const pickQuality = (sel: QualitySel): Quality => sel === 'high' ? 'high' : sel === 'low' ? 'low' : ((navigator.hardwareConcurrency || 4) <= 2 || window.matchMedia?.('(pointer: coarse)').matches ? 'low' : 'high');
    api.current.setQ = sel => { frames = 0; ema = 0.016; scaledDown = false; applyQuality(pickQuality(sel)); };

    let tween: { t: number; fp: THREE.Vector3; ft: THREE.Vector3; tp: THREE.Vector3; tt: THREE.Vector3 } | null = null;
    api.current.go = (k: string) => {
      const p = PRESETS[k]; if (!p) return; if (view !== null) api.current.setCamView?.(null); followRef.current && setFollow(false);
      const tp = new THREE.Vector3(...p.pos), tt = new THREE.Vector3(...p.target);
      if (reducedRef.current) { cam.position.copy(tp); controls.target.copy(tt); return; }
      tween = { t: 0, fp: cam.position.clone(), ft: controls.target.clone(), tp, tt };
    };
    api.current.setCamView = (v: number | 'grid' | null) => {
      view = v; activeCam = typeof v === 'number' ? camsObj[v - 1] || cam : cam; if (renderPass) renderPass.camera = activeCam;
      controls.enabled = v === null; lab.hideCameraHousing(typeof v === 'number' ? v : null); setCamView(v); resize();
    };
    const resize = () => { const { w, h } = size(); hostW = w; hostH = h; bubbleMeasure = 99; renderer.setSize(w, h, false); for (const k of [cam, ...camsObj]) { k.aspect = w / h; k.updateProjectionMatrix(); } composer?.setSize(w, h); };
    const ro = new ResizeObserver(resize); ro.observe(host); resize();
    applyQuality(pickQuality(qualitySelRef.current));
    { const sid = getSelected(); const pd = sid ? PART_BY_ID[sid] : null; if (pd) { api.current.go?.(pd.view); setPart({ label: pd.label, help: pd.help }); } } // coming from the schematic: look at the part chosen there

    // ── picking: hover labels + click to look at a part ──
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); const roots: THREE.Object3D[] = [];
    for (const p of lab.pickables) { roots.push(p.root); p.root.traverse(o => { (o as any).userData.pickName = p.name; }); }
    let hoverName: string | null = null, lastPick = 0, down: { x: number; y: number } | null = null;
    const pickAt = (clientX: number, clientY: number) => {
      if (view !== null) return null;
      const r = canvas.getBoundingClientRect(); ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
      const hits = ray.intersectObjects(roots, true); for (const h of hits) { if (!h.object.visible) continue; const n = (h.object as any).userData.pickName as string | undefined; if (n) return n; } return null;
    };
    const onMove = (e: PointerEvent) => {
      const now = performance.now(); const el = hoverEl.current; if (now - lastPick < 50) { if (el && hoverName) { const r = host.getBoundingClientRect(); el.style.transform = `translate(${e.clientX - r.left + 12}px, ${e.clientY - r.top + 14}px)`; } return; } lastPick = now;
      const n = pickAt(e.clientX, e.clientY); hoverName = n; canvas.style.cursor = n ? 'pointer' : '';
      if (el) { if (n) { const p = lab.pickables.find(q => q.name === n); const r = host.getBoundingClientRect(); el.textContent = ''; const b = document.createElement('span'); b.textContent = p?.label || n; const i = document.createElement('i'); i.textContent = '  click to look'; el.append(b, i); el.style.visibility = 'visible'; el.style.transform = `translate(${e.clientX - r.left + 12}px, ${e.clientY - r.top + 14}px)`; } else el.style.visibility = 'hidden'; }
    };
    const onLeave = () => { hoverName = null; if (hoverEl.current) hoverEl.current.style.visibility = 'hidden'; };
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; foley.unlock(); };
    const onUp = (e: PointerEvent) => {
      if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (moved > 5) return;
      const n = pickAt(e.clientX, e.clientY); if (!n) { setPart(null); return; }
      const p = lab.pickables.find(q => q.name === n); if (!p) return; api.current.go?.(p.view); setPart({ label: p.label, help: p.help }); window.dispatchEvent(new CustomEvent('lab-part-click', { detail: { name: n } }));
    };
    canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerleave', onLeave); canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp);

    // photo: render once and save a PNG of exactly what is on screen
    api.current.snapshot = () => {
      if (eff === 'high' && composer) composer.render(); else renderer.render(lab.scene, activeCam);
      canvas.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'sphere-lab.png'; a.click(); window.setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, 'image/png');
    };

    let raf = 0, last = performance.now(), visible = true, brainAcc = 0;
    const io = new IntersectionObserver(es => { visible = es[0]?.isIntersecting ?? true; }, { threshold: 0.01 }); io.observe(host);
    const v3 = new THREE.Vector3();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (document.hidden || !visible) return;
      const s = stateRef.current; const t = now / 1000;
      lab.update(s, dt, t);
      sci.reduced = reducedRef.current; sci.root.visible = showSciRef.current; sci.laserOn = !!(s.ldv?.power && s.ldv?.shutter); foley.muted = !soundRef.current; if (!foley.muted) { const sp = sci.root.position, dx = sp.x - cam.position.x, dz = sp.z - cam.position.z; foley.dist = Math.hypot(dx, sp.y - cam.position.y, dz); fwd.set(0, 0, -1).applyQuaternion(cam.quaternion); foley.pan = foley.dist > 0.01 ? Math.max(-1, Math.min(1, (dx * -fwd.z + dz * fwd.x) / Math.max(0.01, Math.hypot(dx, dz)) * 0.9)) : 0; foley.clockDist = Math.hypot(0.9 - cam.position.x, 2.5 - cam.position.y, -2.58 - cam.position.z); foley.setLab({ power: !!s.facility?.power, roughing: !!(s.chamber?.roughing && !s.chamber?.vent), turbo: !!(s.chamber?.turbo && !s.chamber?.vent), rack: !!s.facility?.power }); } if (showSciRef.current) sci.update(dt, cam.position);
      brainAcc += dt; if (brainAcc > 0.25) { brainAcc = 0; const r = tech.observe(extractFactsPlus(s), now); if (r) { sys.remark(r); setLogN(tech.log.length + Math.random()); } }
      sys.tick(t, dt);
      if (sys.call.state === 'connected' && sci.mode === 'task') lab.screensaver.wake();
      if (tween) { tween.t = Math.min(1, tween.t + dt / 0.9); const e = tween.t * tween.t * (3 - 2 * tween.t); cam.position.lerpVectors(tween.fp, tween.tp, e); controls.target.lerpVectors(tween.ft, tween.tt, e); if (tween.t >= 1) tween = null; }
      else if (followRef.current && showSciRef.current) { const h = sci.position; controls.target.lerp(v3.set(h.x, 1.1, h.z), Math.min(1, dt * 2)); }
      controls.update();
      // Auto quality: if the first seconds run slowly, drop the heavy effects for good.
      // The first seconds are the measurement: if frames take longer than ~26 ms (under 38 fps) the heavy effects go for good, and if even Low is slow the resolution drops a notch.
      if (qualitySelRef.current === 'auto') {
        frames++; ema += (dt - ema) * 0.08;
        if (eff === 'high' && frames > 90 && ema > 0.026) { frames = 0; ema = 0.016; applyQuality('low'); }
        else if (eff === 'low' && !scaledDown && frames > 120 && ema > 0.045) { scaledDown = true; renderer.setPixelRatio(0.75); resize(); }
      }
      if (eff === 'low' && now - lastRender < 30) return; lastRender = now;
      if (++shadowTick >= (eff === 'low' ? 3 : 2)) { shadowTick = 0; renderer.shadowMap.needsUpdate = true; }   // shadow map refreshed every 2nd (High) or 3rd (Low) frame
      if (view === 'grid') {
        const { w, h } = size(); const tw = Math.floor(w / 2), th = Math.floor(h / 2);
        renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h); renderer.setClearColor(0x04070b, 1); renderer.clear(); renderer.setScissorTest(true);
        camsObj.forEach((k, i) => { const x = (i % 2) * tw, y = h - (Math.floor(i / 2) + 1) * th; renderer.setViewport(x, y, tw, th); renderer.setScissor(x, y, tw, th); k.aspect = tw / th; k.updateProjectionMatrix(); lab.hideCameraHousing(i + 1); renderer.render(lab.scene, k); });
        renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h); lab.hideCameraHousing(null);
      } else if (eff === 'high' && composer) composer.render(); else renderer.render(lab.scene, activeCam);
      // keep the speech bubble above his head
      const el = bubbleEl.current;
      if (el) { const hw = sci.headWorld.project(activeCam); const w = hostW, h = hostH; const ok = hw.z < 1 && showSciRef.current; el.style.visibility = ok ? 'visible' : 'hidden'; if (++bubbleMeasure > 20 || !bubbleW) { bubbleMeasure = 0; bubbleW = el.offsetWidth; bubbleH = el.offsetHeight; } const bw = bubbleW, bh = bubbleH; /* sizes are cached: reading them every frame forces a layout pass */ const x = Math.min(w - bw / 2 - 8, Math.max(bw / 2 + 8, (hw.x * 0.5 + 0.5) * w)); const y = Math.max(bh + 12, (-hw.y * 0.5 + 0.5) * h - 10); el.style.transform = `translate(${x - bw / 2}px, ${y - bh - 10}px)`; }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); window.clearTimeout(bubbleTimer.current);
      canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp);
      unDesk(); sys.dispose(); controls.dispose(); sci.dispose(); foley.dispose(); lab.dispose(); composer?.dispose(); renderer.dispose(); renderer.forceContextLoss();
      if (canvas.parentNode === host) host.removeChild(canvas); api.current = {}; if ((window as any).__lab) delete (window as any).__lab;
    };
  }, [speak, stateRef]);
  useEffect(() => {
    if (camView === null) return; const tick = () => setClockTxt(new Date().toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(',', ''));
    tick(); const id = window.setInterval(tick, 1000); return () => window.clearInterval(id);
  }, [camView]);
  const soundRef = useRef(false); soundRef.current = sound;

  useEffect(() => { api.current.lab?.setCutaway(cutaway); }, [cutaway]);
  useEffect(() => { if (!showSci) setBubble(null); }, [showSci]);
  useEffect(() => { api.current.setQ?.(qualitySel); }, [qualitySel]);

  const talk = () => { const b = api.current.tech; if (!b) return; if (!showSci) setShowSci(true); speak(b.chat(extractFactsPlus(stateRef.current), performance.now())); setLogN(Math.random()); };
  const ask = (q: string) => { const b = api.current.tech; if (!b) return; if (!showSci) setShowSci(true); speak(b.ask(q, extractFactsPlus(stateRef.current), performance.now()).remark); setLogN(Math.random()); };
  const changeSettings = (p: Partial<Settings>) => { const next = { ...settingsRef.current, ...p }; settingsRef.current = next; setSettings(next); api.current.tech?.setSettings(next); try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* storage may be blocked */ } };
  const startCall = (mic: boolean) => { const sys = api.current.sys; if (!sys) return; setShowSci(true); setConsentOpen(false); try { localStorage.setItem(CONSENT_KEY, mic ? 'mic' : 'type'); } catch { /* storage may be blocked */ } void sys.call.start({ mic }); };
  const toggleCall = () => {
    const sys = api.current.sys; if (!sys) return; const st = sys.call.state;
    if (st === 'connecting' || st === 'ringing' || st === 'connected') { void sys.call.hangUp(); return; }
    if (st === 'ended') sys.call.reset();
    let pref: string | null = null; try { pref = localStorage.getItem(CONSENT_KEY); } catch { /* ignore */ }
    if (pref === 'mic' || pref === 'type') startCall(pref === 'mic'); else setConsentOpen(v => !v);
  };
  const toggleCallRef = useRef(toggleCall); toggleCallRef.current = toggleCall;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.altKey && e.code === 'KeyP' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); toggleCallRef.current(); } };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);
  const views = useMemo(() => [['overview', 'Overview'], ['chamber', 'Chamber'], ['stage', 'Stage close-up'], ['rack', 'Instrument rack'], ['bench', 'Workstation'], ['screens', 'Screens']], []);

  if (failed) return <div className="ls-root"><div className="ls-fallback">The realistic 3D lab needs WebGL, which isn't available in this browser. Use the Engineering model view instead.</div></div>;
  return (
    <div ref={wrap} className="ls-root" data-lab-scene data-quality={effQuality}>
      {!photo && (
        <div className="ls-bar" role="toolbar" aria-label="3D lab controls">
          <span className="ls-lbl">Camera</span>
          {views.map(([k, l]) => <Btn key={k} f={() => api.current.go?.(k)}>{l}</Btn>)}
          <span className="ls-lbl" title="The three security cameras installed in the lab">Security cameras</span>
          {[1, 2, 3].map(n => <Btn key={n} on={camView === n} f={() => api.current.setCamView?.(camView === n ? null : n)} label={`Look through security camera ${n}`}>{`Cam ${n}`}</Btn>)}
          <Btn on={camView === 'grid'} f={() => api.current.setCamView?.(camView === 'grid' ? null : 'grid')} label="All security cameras at once">All cams</Btn>
          <span className="ls-lbl">View</span>
          <Btn on={cutaway} f={() => setCutaway(v => !v)}>Cutaway</Btn>
          <Btn f={() => setPhoto(true)} label="Photo mode: hide the controls and save a picture">Photo mode</Btn>
          <label className="ls-lbl" htmlFor="ls-q">Quality</label>
          <select id="ls-q" className="ls-btn" value={qualitySel} onChange={e => setQualitySel(e.target.value as QualitySel)}><option value="auto">Auto</option><option value="high">High</option><option value="low">Low</option></select>
          <span className="ls-spacer" />
          <Btn on={sound} f={() => { api.current.foley?.unlock(); setSound(v => !v); }} label="Footstep and cloth sounds">Sound</Btn>
          <Btn on={showSci} f={() => setShowSci(v => !v)}>Dr. Wire</Btn>
          <Btn on={follow} f={() => { setShowSci(true); setFollow(v => !v); }}>Follow him</Btn>
          <Btn f={talk}>Talk to Dr. Wire</Btn>
          <Btn on={!!sysReady && sysReady.call.state !== 'idle'} f={toggleCall} title="Call Dr. Wire on the lab phone (Alt+P)" call>{sysReady && ['connecting', 'ringing', 'connected'].includes(sysReady.call.state) ? 'Hang up' : 'Call Dr. Wire'}</Btn>
        </div>
      )}
      <div className="ls-stage" ref={canvasHost} data-cctv-on={camView !== null ? '' : undefined}>
        <div ref={hoverEl} className="ls-hover" style={{ visibility: 'hidden' }} aria-hidden="true" />
        {bubble && showSci && (
          <div ref={bubbleEl} className={`ls-bubble${bubble.kind === 'alert' ? ' is-alert' : ''}${bubble.kind === 'joke' ? ' is-joke' : ''}`} data-lab-bubble data-kind={bubble.kind} data-text={bubble.text} style={{ visibility: 'hidden' }}>
            <b>Dr. Wire</b><Typed text={bubble.text} />
          </div>
        )}
        {camView !== null && <CctvOverlay view={camView} clock={clockTxt} labels={api.current.lab?.cameras ?? []} onExit={() => api.current.setCamView?.(null)} />}
        {!photo && consentOpen && <CallConsent onStart={startCall} onCancel={() => setConsentOpen(false)} />}
        {!photo && sysReady && <TaskChip sys={sysReady} />}
        {!photo && sysReady && <IncomingCall sys={sysReady} />}
        {!photo && camView === null && sysReady && <DeskPanel sys={sysReady} />}
        {!photo && sysReady && <CallBar sys={sysReady} />}
        {photo && <div className="ls-photo"><Btn f={() => api.current.snapshot?.()}>Save PNG</Btn><Btn f={() => setPhoto(false)}>Exit photo mode</Btn></div>}
        {!photo && part && (
          <div className="ls-info" role="status"><span>{part.label}</span>
            <button type="button" aria-label={`What is this? Help for ${part.label}`} onClick={() => onHelpRef.current?.(part.help)}>?</button>
            <button type="button" className="ls-x" aria-label="Close" onClick={() => setPart(null)}>×</button></div>
        )}
        {!photo && camView === null && <div className="ls-note">Stage motion is exaggerated ×3 so you can see it. Drag to orbit · scroll to zoom · click a part to look at it.</div>}
        {!photo && <div className="ls-quality">{effQuality === 'high' ? 'High quality' : 'Low quality'}{qualitySel === 'auto' ? ' (auto)' : ''}</div>}
      </div>
      {!photo && <TechnicianPanel settings={settings} onSettings={changeSettings} log={api.current.tech?.log ?? []} onAsk={ask} />}
      <div className="ls-sr" role="status" aria-live="polite">{bubble ? `Dr. Wire says: ${bubble.text}` : ''}</div>
    </div>
  );
}

// The scene reads live state through `stateRef`, so it never needs to re-render on simulation ticks.
export default React.memo(LabScene3D);

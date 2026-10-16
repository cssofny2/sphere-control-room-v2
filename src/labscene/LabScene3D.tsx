import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './labscene.css';
import { buildLab, type Lab } from './buildLab';
import { Scientist } from './Scientist';
import { createBrain, extractFacts, type Remark } from './scientistBrain';

type Props = { stateRef: React.MutableRefObject<any>; reduced?: boolean };
type CamPreset = { pos: [number, number, number]; target: [number, number, number] };
const PRESETS: Record<string, CamPreset> = {
  overview: { pos: [3.3, 3.1, 4.4], target: [-0.1, 0.95, -0.2] },
  chamber: { pos: [2.3, 1.9, 2.5], target: [0, 1.0, 0] },
  stage: { pos: [1.35, 1.75, 0.3], target: [0, 1.0, 0.05] },
  rack: { pos: [-1.0, 1.5, 2.6], target: [-3.0, 1.1, -0.4] },
  bench: { pos: [1.6, 1.7, 1.5], target: [2.8, 1.0, -1.8] },
};

const Btn = ({ on, f, children, label }: { on?: boolean; f: () => void; children: React.ReactNode; label?: string }) => <button type="button" className="ls-btn" aria-pressed={on === undefined ? undefined : on} aria-label={label} onClick={f}>{children}</button>;

function Typed({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => { setN(0); const id = window.setInterval(() => setN(v => { if (v >= text.length) { window.clearInterval(id); return v; } return v + 2; }), 28); return () => window.clearInterval(id); }, [text]);
  return <span>{text.slice(0, n)}</span>;
}

function LabScene3D({ stateRef, reduced = false }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const bubbleEl = useRef<HTMLDivElement>(null);
  const reducedRef = useRef(reduced); reducedRef.current = reduced;
  const api = useRef<{ lab?: Lab; cam?: THREE.PerspectiveCamera; controls?: OrbitControls; sci?: Scientist; go?: (k: string) => void; brain?: ReturnType<typeof createBrain>; say?: (r: Remark) => void }>({});
  const [failed, setFailed] = useState(false);
  const [cutaway, setCutaway] = useState(true);
  const [showSci, setShowSci] = useState(true);
  const [follow, setFollow] = useState(false);
  const [bubble, setBubble] = useState<(Remark & { n: number }) | null>(null);
  const showSciRef = useRef(true); showSciRef.current = showSci;
  const followRef = useRef(false); followRef.current = follow;
  const bubbleTimer = useRef(0);
  const counter = useRef(0);

  const speak = useCallback((r: Remark) => {
    if (!showSciRef.current) return;
    const n = ++counter.current; setBubble({ ...r, n });
    window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubble(b => (b && b.n === n ? null : b)), Math.min(11000, 4200 + r.text.length * 55));
    api.current.sci?.say(r.focus, r.mood, r.text.length, performance.now());
  }, []);

  useEffect(() => {
    const host = canvasHost.current; if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); } catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement; canvas.setAttribute('role', 'img'); canvas.setAttribute('tabindex', '0');
    canvas.setAttribute('aria-label', '3D laboratory: thermal-vacuum chamber with XYZ stage and sphere, instrument rack, and Dr. Wire the wireframe scientist. Drag to orbit, scroll to zoom.');
    host.appendChild(canvas);
    let lab: Lab;
    try { lab = buildLab(renderer); } catch (e) { console.error(e); setFailed(true); host.removeChild(canvas); renderer.dispose(); return; }
    const cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 60); cam.position.set(...PRESETS.overview.pos);
    const controls = new OrbitControls(cam, canvas); controls.target.set(...PRESETS.overview.target); controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minDistance = 0.6; controls.maxDistance = 9; controls.maxPolarAngle = Math.PI * 0.49; controls.update();
    const sci = new Scientist(); sci.reduced = reducedRef.current; lab.scene.add(sci.root); lab.scene.traverse(o => { if ((o as any).isMesh && o.parent === sci.root) o.castShadow = false; });
    const brain = createBrain();
    api.current = { lab, cam, controls, sci, brain };
    lab.setCutaway(true);

    let tween: { t: number; fp: THREE.Vector3; ft: THREE.Vector3; tp: THREE.Vector3; tt: THREE.Vector3 } | null = null;
    api.current.go = (k: string) => {
      const p = PRESETS[k]; if (!p) return; followRef.current && setFollow(false);
      const tp = new THREE.Vector3(...p.pos), tt = new THREE.Vector3(...p.target);
      if (reducedRef.current) { cam.position.copy(tp); controls.target.copy(tt); return; }
      tween = { t: 0, fp: cam.position.clone(), ft: controls.target.clone(), tp, tt };
    };

    const resize = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(host); resize();

    let raf = 0, last = performance.now(), visible = true, brainAcc = 0;
    const io = new IntersectionObserver(es => { visible = es[0]?.isIntersecting ?? true; }, { threshold: 0.01 }); io.observe(host);
    const v3 = new THREE.Vector3();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (document.hidden || !visible) return;
      const s = stateRef.current; const t = now / 1000;
      lab.update(s, dt, t);
      sci.reduced = reducedRef.current; sci.root.visible = showSciRef.current; if (showSciRef.current) sci.update(dt, cam.position);
      brainAcc += dt; if (brainAcc > 0.25) { brainAcc = 0; const r = brain.observe(extractFacts(s), now); if (r) speak(r); }
      if (tween) { tween.t = Math.min(1, tween.t + dt / 0.9); const e = tween.t * tween.t * (3 - 2 * tween.t); cam.position.lerpVectors(tween.fp, tween.tp, e); controls.target.lerpVectors(tween.ft, tween.tt, e); if (tween.t >= 1) tween = null; }
      else if (followRef.current && showSciRef.current) { const h = sci.position; controls.target.lerp(v3.set(h.x, 1.1, h.z), Math.min(1, dt * 2)); }
      controls.update();
      renderer.render(lab.scene, cam);
      // keep the speech bubble above his head
      const el = bubbleEl.current;
      if (el) { const hw = sci.headWorld.project(cam); const w = host.clientWidth, h = host.clientHeight; const ok = hw.z < 1 && showSciRef.current; el.style.visibility = ok ? 'visible' : 'hidden'; const bw = el.offsetWidth, bh = el.offsetHeight; const x = Math.min(w - bw / 2 - 8, Math.max(bw / 2 + 8, (hw.x * 0.5 + 0.5) * w)); const y = Math.max(bh + 12, (-hw.y * 0.5 + 0.5) * h - 10); el.style.transform = `translate(${x - bw / 2}px, ${y - bh - 10}px)`; }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); window.clearTimeout(bubbleTimer.current); controls.dispose(); sci.dispose(); lab.dispose(); renderer.dispose(); renderer.forceContextLoss();
      if (canvas.parentNode === host) host.removeChild(canvas); api.current = {};
    };
  }, [speak, stateRef]);

  useEffect(() => { api.current.lab?.setCutaway(cutaway); }, [cutaway]);
  useEffect(() => { if (!showSci) setBubble(null); }, [showSci]);

  const talk = () => { const b = api.current.brain; if (!b) return; if (!showSci) setShowSci(true); speak(b.chat(extractFacts(stateRef.current), performance.now())); };
  const views = useMemo(() => [['overview', 'Overview'], ['chamber', 'Chamber'], ['stage', 'Stage close-up'], ['rack', 'Instrument rack'], ['bench', 'Workstation']], []);

  if (failed) return <div className="ls-root"><div className="ls-fallback">The realistic 3D lab needs WebGL, which isn't available in this browser. Use the Engineering model view instead.</div></div>;
  return (
    <div ref={wrap} className="ls-root" data-lab-scene>
      <div className="ls-bar" role="toolbar" aria-label="3D lab controls">
        <span className="ls-lbl">Camera</span>
        {views.map(([k, l]) => <Btn key={k} f={() => api.current.go?.(k)}>{l}</Btn>)}
        <span className="ls-lbl">View</span>
        <Btn on={cutaway} f={() => setCutaway(v => !v)}>Cutaway</Btn>
        <span className="ls-spacer" />
        <Btn on={showSci} f={() => setShowSci(v => !v)}>Dr. Wire</Btn>
        <Btn on={follow} f={() => { setShowSci(true); setFollow(v => !v); }}>Follow him</Btn>
        <Btn f={talk}>Talk to Dr. Wire</Btn>
      </div>
      <div className="ls-stage" ref={canvasHost}>
        {bubble && showSci && (
          <div ref={bubbleEl} className={`ls-bubble${bubble.kind === 'alert' ? ' is-alert' : ''}${bubble.kind === 'joke' ? ' is-joke' : ''}`} data-lab-bubble data-kind={bubble.kind} data-text={bubble.text} style={{ visibility: 'hidden' }}>
            <b>Dr. Wire</b><Typed text={bubble.text} />
          </div>
        )}
        <div className="ls-note">Stage motion is exaggerated ×3 so you can see it. Drag to orbit · scroll to zoom.</div>
      </div>
      <div className="ls-sr" role="status" aria-live="polite">{bubble ? `Dr. Wire says: ${bubble.text}` : ''}</div>
    </div>
  );
}

// The scene reads live state through `stateRef`, so it never needs to re-render on simulation ticks.
export default React.memo(LabScene3D);

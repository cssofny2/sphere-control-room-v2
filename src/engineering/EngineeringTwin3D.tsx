import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { pointMarkers, type MarkerRecord } from '../features/pointMarkers';
import { findObstructions, geometryFor, PLATFORM_IDS, platformTargets, positionOf, type TwinPart } from './twinScene';

type Props = {
  parts: TwinPart[];
  records: MarkerRecord[];
  command: { cam?: string; mode?: string; n: number };
  dispatch: (action: { type: string; patch: { active: string } }) => void;
  onReset: () => void;
};
type SceneApi = {
  sync: (parts: TwinPart[], mode: string, hidden: Set<string>, solo: string | null, ghost: Set<string>, records: MarkerRecord[]) => void;
  camera: (name: string) => void;
  focusPlatform: () => void;
  focusPart: (part: TwinPart) => void;
  clearFocus: () => void;
};
type Entry = { part: TwinPart; mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>; signature: string; opacity: number };
const GROUPS: Record<string, string> = {
  table: 'Optical table', chamber: 'Thermal enclosure and A/B rail', sphere: 'Copper artifacts',
  ldv: 'LDV heads', rf: 'RF fixture', pumps: 'Legacy vacuum fixtures', rack: 'Instrument rack', probes: 'Environmental probes',
};
const EXPLODED: Record<string, number[]> = {
  table: [0, 0, -250], chamber: [0, 0, 350], sphere: [0, 0, 800], ldv: [0, 0, 900],
  rf: [450, 0, 550], pumps: [-500, 0, 0], rack: [600, 0, 0], probes: [0, 350, 500],
};
const PRESETS: Record<string, { position: number[]; target: number[] }> = {
  iso: { position: [4.1, 3.2, 4.8], target: [0.2, 1, 0] },
  front: { position: [0, 1.4, 6], target: [0, 1, 0] },
  top: { position: [0.01, 6, 0.1], target: [0, 0.9, 0] },
  interior: { position: [0.7, 1.25, 1], target: [0, 0.95, 0] },
  stage: { position: [0.65, 1.25, 0.8], target: [0, 0.8546, 0] },
  optical: { position: [1.2, 2.2, 1.2], target: [0, 1.3, 0] },
  rf: { position: [1.5, 1.5, 1.4], target: [0.25, 1.1, 0] },
  vacuum: { position: [-2, 1.6, 1.6], target: [-0.6, 0.9, 0] },
  rack: { position: [3.8, 1.8, 2], target: [1.8, 1, 0] },
};

function makeMaterial(part: TwinPart) {
  const copper = part.g === 'sphere' && part.k === 'sph';
  return new THREE.MeshStandardMaterial({
    color: copper ? '#c97859' : part.col,
    metalness: copper ? 0.95 : part.mt === 'rubber' ? 0 : 0.55,
    roughness: copper ? 0.22 : part.mt === 'rubber' ? 0.85 : 0.45,
    side: THREE.DoubleSide,
  });
}

export default function EngineeringTwin3D({ parts, records, command, dispatch, onReset }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<SceneApi | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState('lab');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [ghost, setGhost] = useState<Set<string>>(new Set());
  const [solo, setSolo] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const selectedPart = parts.find(p => p.id === selected);
  const groups = useMemo(() => Object.keys(GROUPS).filter(g => parts.some(p => p.g === g && p.wall !== 'cage')), [parts]);
  const markerCount = pointMarkers(records).length;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const win = host.ownerDocument.defaultView || window;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute('aria-label', 'Conceptual engineering model. Drag to orbit, scroll to zoom, use arrow keys to pan, and click a component to inspect it.');
    host.appendChild(canvas);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#edf3f7');
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8898a6, 2.1));
    const light = new THREE.DirectionalLight(0xffffff, 2.5);
    light.position.set(3, 6, 4);
    scene.add(light);
    const grid = new THREE.GridHelper(8, 32, 0x9caebd, 0xc3d0db);
    grid.position.y = -0.015;
    scene.add(grid);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 50);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.025;
    controls.maxDistance = 15;
    controls.listenToKeyEvents(canvas);
    const meshes = new Map<string, Entry>();
    const raycaster = new THREE.Raycaster();
    const platform = platformTargets();
    let focusedView = false;
    let down: { x: number; y: number } | null = null;
    const markerGeometry = new THREE.SphereGeometry(0.009, 10, 8);
    const goodMaterial = new THREE.MeshBasicMaterial({ color: '#059669' });
    const badMaterial = new THREE.MeshBasicMaterial({ color: '#d97706' });
    const good = new THREE.InstancedMesh(markerGeometry, goodMaterial, 200);
    const bad = new THREE.InstancedMesh(markerGeometry, badMaterial, 200);
    good.count = bad.count = 0;
    scene.add(good, bad);

    const applyFocus = () => {
      scene.updateMatrixWorld(true);
      const candidates = [...meshes.values()].filter(e => !PLATFORM_IDS.has(e.part.id)).map(e => e.mesh);
      const obstructions = focusedView ? findObstructions(camera.position, platform, candidates) : new Set<THREE.Mesh>();
      host.dataset.occluders = String(obstructions.size);
      host.dataset.platformFocus = String(focusedView);
      for (const entry of meshes.values()) {
        const opacity = obstructions.has(entry.mesh) ? Math.min(entry.opacity, 0.12) : entry.opacity;
        const material = entry.mesh.material;
        material.opacity = opacity;
        material.transparent = opacity < 1;
        material.depthWrite = opacity >= 1;
      }
    };
    const controlsChanged = () => { if (focusedView) applyFocus(); };
    controls.addEventListener('change', controlsChanged);
    const moveCamera = (name: string) => {
      const preset = PRESETS[name] || PRESETS.iso;
      camera.position.fromArray(preset.position);
      controls.target.fromArray(preset.target);
      controls.update();
    };
    const sync: SceneApi['sync'] = (next, viewMode, hide, only, ghosts, nextRecords) => {
      const liveIds = new Set<string>();
      for (const part of next) {
        if (part.wall === 'cage') continue;
        liveIds.add(part.id);
        const signature = JSON.stringify([part.k, part.s, part.r, part.len, part.ax]);
        let entry = meshes.get(part.id);
        if (!entry) {
          const mesh = new THREE.Mesh(geometryFor(part), makeMaterial(part));
          mesh.userData.partId = part.id;
          scene.add(mesh);
          entry = { part, mesh, signature, opacity: 1 };
          meshes.set(part.id, entry);
        } else if (entry.signature !== signature) {
          entry.mesh.geometry.dispose();
          entry.mesh.geometry = geometryFor(part);
          entry.signature = signature;
        }
        entry.part = part;
        const offset = viewMode === 'exploded' ? EXPLODED[part.g] || [0, 0, 0] : [0, 0, 0];
        entry.mesh.position.copy(positionOf(part.c.map((v, i) => v + offset[i])));
        entry.mesh.visible = !hide.has(part.g) && (!only || only === part.g);
        entry.mesh.material.color.set(part.g === 'sphere' && part.k === 'sph' ? '#c97859' : part.col);
        entry.mesh.material.wireframe = viewMode === 'blueprint';
        let opacity = part.a ?? (part.wall === 'ch' ? 0.2 : 1);
        if (viewMode === 'transparent' && (part.g === 'chamber' && !PLATFORM_IDS.has(part.id))) opacity = Math.min(opacity, 0.12);
        if (viewMode === 'chamber' && part.wall === 'ch') opacity = 0.08;
        if (ghosts.has(part.g)) opacity *= 0.25;
        if (viewMode === 'chain' && !['sphere', 'ldv', 'rf', 'rack'].includes(part.g) && !PLATFORM_IDS.has(part.id)) opacity *= 0.15;
        entry.opacity = opacity;
      }
      for (const [id, entry] of meshes) if (!liveIds.has(id)) {
        scene.remove(entry.mesh); entry.mesh.geometry.dispose(); entry.mesh.material.dispose(); meshes.delete(id);
      }
      good.count = bad.count = 0;
      const matrix = new THREE.Matrix4();
      for (const marker of pointMarkers(nextRecords)) {
        const mesh = marker.ok ? good : bad;
        matrix.makeTranslation(marker.x / 1000, (1100 + marker.z) / 1000, -marker.y / 1000);
        mesh.setMatrixAt(mesh.count++, matrix);
      }
      good.instanceMatrix.needsUpdate = bad.instanceMatrix.needsUpdate = true;
      good.computeBoundingSphere(); bad.computeBoundingSphere();
      applyFocus();
    };
    apiRef.current = {
      sync,
      camera: name => { focusedView = false; moveCamera(name); applyFocus(); },
      focusPlatform: () => { focusedView = true; moveCamera('stage'); applyFocus(); },
      clearFocus: () => { focusedView = false; applyFocus(); },
      focusPart: part => {
        focusedView = false;
        const target = positionOf(part.c);
        const size = part.s ? Math.max(...part.s) / 1000 : Math.max(part.len || 0, (part.r || 0) * 2) / 1000;
        controls.target.copy(target);
        camera.position.copy(target).add(new THREE.Vector3(1, 0.75, 1).normalize().multiplyScalar(Math.max(0.12, size * 2.5)));
        controls.update();
        applyFocus();
      },
    };
    moveCamera('iso');
    const downHandler = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY }; };
    const upHandler = (event: PointerEvent) => {
      if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) { down = null; return; }
      down = null;
      const box = canvas.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - box.left) / box.width * 2 - 1, -(event.clientY - box.top) / box.height * 2 + 1), camera);
      const hit = raycaster.intersectObjects([...meshes.values()].map(e => e.mesh).filter(mesh => mesh.visible && (!focusedView || mesh.material.opacity > 0.12)), false)[0];
      setSelected(hit ? String(hit.object.userData.partId) : null);
    };
    canvas.addEventListener('pointerdown', downHandler);
    canvas.addEventListener('pointerup', upHandler);
    const contextLost = (event: Event) => { event.preventDefault(); setFailed(true); };
    canvas.addEventListener('webglcontextlost', contextLost);
    const resize = () => {
      const width = host.clientWidth || 640, height = host.clientHeight || 360;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    let frame = 0;
    const render = () => {
      frame = win.requestAnimationFrame(render);
      if (host.ownerDocument.hidden) return;
      controls.update();
      renderer.render(scene, camera);
    };
    frame = win.requestAnimationFrame(render);
    return () => {
      win.cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', downHandler);
      canvas.removeEventListener('pointerup', upHandler);
      canvas.removeEventListener('webglcontextlost', contextLost);
      controls.removeEventListener('change', controlsChanged);
      controls.dispose();
      for (const entry of meshes.values()) { entry.mesh.geometry.dispose(); entry.mesh.material.dispose(); }
      markerGeometry.dispose(); goodMaterial.dispose(); badMaterial.dispose();
      grid.geometry.dispose();
      const gridMaterial = grid.material;
      (Array.isArray(gridMaterial) ? gridMaterial : [gridMaterial]).forEach(material => material.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      apiRef.current = null;
    };
  }, [failed]);

  useEffect(() => { apiRef.current?.sync(parts, mode, hidden, solo, ghost, records); }, [parts, mode, hidden, solo, ghost, records]);
  useEffect(() => {
    if (command.cam || command.mode) { setFocused(false); apiRef.current?.clearFocus(); }
    if (command.cam) apiRef.current?.camera(command.cam);
    if (command.mode) setMode(command.mode);
  }, [command.n]);
  const toggle = (setter: typeof setHidden, value: string) => setter(old => {
    const next = new Set(old); if (next.has(value)) next.delete(value); else next.add(value); return next;
  });
  const reset = () => {
    setMode('lab'); setHidden(new Set()); setGhost(new Set()); setSolo(null); setSelected(null); setFocused(false);
    apiRef.current?.camera('iso'); onReset();
  };
  const focus = () => {
    setMode('lab'); setHidden(new Set()); setGhost(new Set()); setSolo(null); setFocused(true); onReset();
    apiRef.current?.focusPlatform();
  };

  return <div className="space-y-2" aria-label="Engineering twin">
    <div className="flex flex-wrap gap-2">
      <button className="chrome-button" onClick={focus} aria-pressed={focused}>Focus A/B platform</button>
      <button className="chrome-button" onClick={reset}>Reset view</button>
    </div>
    {failed ? <div role="alert" className="rounded border border-amber-700 p-3 text-xs">WebGL is unavailable. Switch to the classic SVG model or the engineering schematic.</div> :
      <div ref={hostRef} className="engineering-twin-canvas" data-engineering-twin />}
    <p className="text-xs text-zinc-400">Conceptual geometry. A/B mounts are 0.400 m apart; copper artifacts are 9.2 mm in diameter. Drag to orbit; scroll to zoom. Platform focus makes objects intersecting sampled sightlines transparent.</p>
    <div className="grid gap-2 xl:grid-cols-2">
      <div className="rounded border border-zinc-700 p-2 text-xs">
        <strong>Assemblies</strong>
        {groups.map(group => <div key={group} className="flex flex-wrap items-center justify-between gap-1 border-t border-zinc-800 py-1">
          <span>{GROUPS[group]}</span><span className="flex gap-1">
            <button className="chrome-button" aria-pressed={hidden.has(group)} onClick={() => toggle(setHidden, group)}>Hide</button>
            <button className="chrome-button" aria-pressed={solo === group} onClick={() => { setSolo(s => s === group ? null : group); setHidden(h => { const n = new Set(h); n.delete(group); return n; }); }}>Isolate</button>
            <button className="chrome-button" aria-pressed={ghost.has(group)} onClick={() => toggle(setGhost, group)}>Ghost</button>
          </span>
        </div>)}
      </div>
      <div className="rounded border border-zinc-700 p-2 text-xs">
        <strong>Inspect</strong>
        {selectedPart ? <div className="space-y-1"><p>{selectedPart.label}</p><p>{selectedPart.s ? `${selectedPart.s.join(' × ')} mm` : selectedPart.k === 'sph' ? `Ø${(selectedPart.r || 0) * 2} mm` : `Ø${(selectedPart.r || 0) * 2} × ${selectedPart.len} mm`}</p>
          {selectedPart.note && <p>{selectedPart.note}</p>}
          <button className="chrome-button" onClick={() => { setFocused(false); apiRef.current?.focusPart(selectedPart); }}>Focus component</button>{' '}
          {selectedPart.inst && <button className="chrome-button" onClick={() => dispatch({ type: 'SET_UI', patch: { active: selectedPart.inst! } })}>Open instrument</button>}
        </div> : <p>Click a component to inspect it.</p>}
        <p className="mt-3">Legacy measurement markers: {markerCount} (green valid, amber suspect). Marker positions reflect the separate XYZ training data, not LOC-1 A/B measurements.</p>
      </div>
    </div>
  </div>;
}

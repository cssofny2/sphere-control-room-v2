import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { blobShadowTex, canvasTex, glowTex, type CanvasTex, type Quality } from './labUtil';

// Extra realism layered on top of the base lab: contact shadows, floor tape, wall panels, posters,
// a live wall clock, chamber hardware (gaskets, clamps, baffles, cabling, frost), gas-flow particles,
// stage rails and encoder strips, rack indicators, lab props, a wall phone and light fixtures.

export type DetailCtx = {
  scene: THREE.Scene; room: THREE.Group; bench: THREE.Group; ch: THREE.Group; rack: THREE.Group; stageRoot: THREE.Group; yCar: THREE.Group; xCar: THREE.Group;
  M: Record<string, THREE.Material>; track: <T extends { dispose: () => void }>(o: T) => T;
  add: (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x?: number, y?: number, z?: number, shadow?: boolean) => THREE.Mesh;
  box: (w: number, h: number, d: number) => THREE.BoxGeometry; cuttable: THREE.Material[];
  R: number; L: number; CH_Y: number; panels: { name: string; y: number; h: number }[];
  rfCurve: THREE.CatmullRomCurve3; fibreCurve: THREE.CatmullRomCurve3;
  parts: Record<string, THREE.Object3D>; wsG: THREE.Group;
};

export type PhoneRig = {
  anchor: THREE.Vector3; base: THREE.Group; handset: THREE.Group; ringing: boolean;
  setRinging: (on: boolean) => void; takeOff: (hand: THREE.Object3D) => void; hangUp: () => void; offHook: boolean;
};
export type Pickable = { name: string; label: string; help: string; root: THREE.Object3D; view: string };
export type Detail = {
  update: (s: any, dt: number, t: number) => void; setQuality: (q: Quality) => void; phone: PhoneRig; pickables: Pickable[];
  turnKnob: (panel: string, delta: number) => void; anchors: Record<string, THREE.Vector3>; dispose: () => void;
  /** Objects that move or toggle on their own. The static-geometry merge must leave these (and their children) alone. */
  dynamic: THREE.Object3D[];
};

let areaInit = false;

export function buildDetail(ctx: DetailCtx, knobs: { panel: string; mesh: THREE.Mesh }[]): Detail {
  const { scene, room, bench, ch, rack, stageRoot, yCar, xCar, M, track, add, box, R, L, CH_Y } = ctx;
  const texs: { dispose: () => void }[] = [];
  const keepTex = <T extends { dispose: () => void }>(t: T) => { texs.push(t); return t; };
  const basic = (o: THREE.MeshBasicMaterialParameters) => track(new THREE.MeshBasicMaterial(o));
  const std = (o: THREE.MeshStandardMaterialParameters) => track(new THREE.MeshStandardMaterial(o));
  const fx = new THREE.Group(); fx.name = 'fx'; scene.add(fx);        // effects that are dropped at Low quality
  const updaters: ((s: any, dt: number, t: number) => void)[] = [];
  const label = (text: string, w: number, h: number, bg = '#f4f6f8', fg = '#1f3a5f'): { mesh: THREE.Mesh; tex: CanvasTex } => {
    const px = 256, py = Math.max(24, Math.round(256 * h / w));
    const tex = canvasTex(px, py, (c, W, H) => { c.fillStyle = bg; c.fillRect(0, 0, W, H); c.fillStyle = fg; c.font = `700 ${Math.round(H * 0.58)}px system-ui,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, W / 2, H / 2 + 1); });
    keepTex(tex.tex);
    return { mesh: new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), basic({ map: tex.tex })), tex };
  };

  // ── contact shadows (soft decals) ──
  const blob = keepTex(blobShadowTex());
  const blobMat = basic({ map: blob, transparent: true, depthWrite: false, opacity: 0.9 });
  const decal = (x: number, z: number, w: number, d: number, o = 1) => { const m = new THREE.Mesh(track(new THREE.PlaneGeometry(w, d)), o === 1 ? blobMat : basic({ map: blob, transparent: true, depthWrite: false, opacity: o })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.004, z); m.renderOrder = 1; room.add(m); };
  decal(0, 0, 2.5, 2.2); decal(-3.15, -0.5, 1.5, 1.7); decal(1.05, 0.2, 0.95, 1.1); decal(2.9, -1.9, 2.7, 1.5); decal(2.9, -0.9, 0.75, 0.75); decal(-4.2, -1.9, 0.5, 0.5);
  decal(-3.7, -2.3, 0.7, 0.55); decal(3.5, 0.9, 1.0, 0.8);

  // ── floor safety tape around the chamber and the walkway ──
  const tapeMat = basic({ color: 0xffd400 }), tapeDark = basic({ color: 0x1a1a1a });
  const tape = (x: number, z: number, w: number, d: number, m = tapeMat) => { const p = new THREE.Mesh(track(new THREE.PlaneGeometry(w, d)), m); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.006, z); room.add(p); };
  const HX = 1.55, HZ = 1.45, TW = 0.05;
  tape(0, -HZ, HX * 2 + TW, TW); tape(0, HZ, HX * 2 + TW, TW); tape(-HX, 0, TW, HZ * 2); tape(HX, 0, TW, HZ * 2);
  for (let i = -HX; i < HX; i += 0.2) { tape(i + 0.1, HZ, 0.1, TW, tapeDark); tape(i + 0.1, -HZ, 0.1, TW, tapeDark); }
  tape(-3.1, 0.5, 0.04, 2.6, basic({ color: 0x2a6fdb })); // walkway guide beside the rack

  // ── wall panels, seams, posters, corkboard and a live clock ──
  const seamMat = basic({ color: 0xcfd6de });
  for (let x = -7.2; x <= 7.2; x += 1.2) { const m = new THREE.Mesh(track(new THREE.PlaneGeometry(0.012, 2.35)), seamMat); m.position.set(x, 2.45, -2.595); room.add(m); }
  for (let z = -5; z <= 5.4; z += 1.2) { const m = new THREE.Mesh(track(new THREE.PlaneGeometry(0.012, 2.35)), seamMat); m.rotation.y = Math.PI / 2; m.position.set(-4.395, 2.45, z + 0.5); room.add(m); }
  const poster = (x: number, y: number, w: number, h: number, draw: (c: CanvasRenderingContext2D, W: number, H: number) => void, parent: THREE.Object3D = room, z = -2.585, ry = 0) => {
    const t = canvasTex(Math.round(w * 400), Math.round(h * 400), draw); keepTex(t.tex);
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
    add(box(w + 0.03, h + 0.03, 0.012), M.white, g, 0, 0, -0.004, false);
    const m = new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), basic({ map: t.tex })); m.position.z = 0.004; g.add(m);
  };
  poster(-1.9, 2.15, 0.5, 0.7, (c, W, H) => { c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.fillStyle = '#d62d2d'; c.fillRect(0, 0, W, 60); c.fillStyle = '#fff'; c.font = '800 34px system-ui'; c.textAlign = 'center'; c.fillText('LASER SAFETY', W / 2, 42); c.fillStyle = '#111'; c.font = '600 22px system-ui'; c.textAlign = 'left'; ['Goggles on before shutter opens', 'Never look into the beam', 'Keep reflective items away', 'Shutter closed = safe to open door', 'Report any stray beam'].forEach((l, i) => c.fillText('• ' + l, 16, 110 + i * 44)); });
  poster(-1.3, 2.15, 0.5, 0.7, (c, W, H) => { c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.fillStyle = '#1f6feb'; c.fillRect(0, 0, W, 60); c.fillStyle = '#fff'; c.font = '800 30px system-ui'; c.textAlign = 'center'; c.fillText('STARTUP ORDER', W / 2, 42); c.fillStyle = '#1f3a5f'; c.textAlign = 'left'; c.font = '600 22px system-ui'; ['1 Main breaker', '2 Power instruments', '3 Rb clock lock', '4 Rough, then turbo', '5 Settle temperature', '6 Calibrate VNA', '7 Open shutter, scan'].forEach((l, i) => c.fillText(l, 18, 100 + i * 38)); });
  poster(1.9, 2.2, 0.72, 0.5, (c, W, H) => { c.fillStyle = '#f7fafc'; c.fillRect(0, 0, W, H); c.strokeStyle = '#1f6feb'; c.lineWidth = 3; c.beginPath(); c.arc(W * 0.28, H * 0.5, 62, 0, 7); c.stroke(); c.fillStyle = '#f2b134'; c.beginPath(); c.arc(W * 0.28, H * 0.5, 14, 0, 7); c.fill(); c.strokeStyle = '#51647a'; c.lineWidth = 2; c.beginPath(); c.moveTo(W * 0.28, 20); c.lineTo(W * 0.28, H * 0.5 - 14); c.stroke(); c.fillStyle = '#1f3a5f'; c.font = '700 24px system-ui'; c.fillText('S.P.H.E.R.E. housing', W * 0.5, H * 0.35); c.font = '500 20px system-ui'; c.fillStyle = '#51647a'; c.fillText('gold sphere on ceramic post', W * 0.5, H * 0.5); c.fillText('XYZ stage moves the sphere', W * 0.5, H * 0.62); c.fillText('LDV beam from above', W * 0.5, H * 0.74); });
  // cork board with notes on the left wall
  { const g = new THREE.Group(); g.position.set(-4.38, 1.65, 1.6); g.rotation.y = Math.PI / 2; room.add(g);
    add(box(1.1, 0.7, 0.025), std({ color: 0xc89a62, roughness: 0.95 }), g, 0, 0, 0, false);
    const cols = [0xfff176, 0xffab91, 0x80deea, 0xc5e1a5];
    for (let i = 0; i < 7; i++) add(box(0.14, 0.14, 0.004), basic({ color: cols[i % 4] }), g, -0.42 + (i % 4) * 0.28 + (i > 3 ? 0.12 : 0), i > 3 ? -0.15 : 0.14, 0.016, false).rotation.z = (i - 3) * 0.06; }
  // wall clock (shows the real time)
  const clk = new THREE.Group(); clk.position.set(0.9, 2.5, -2.58); room.add(clk);
  add(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 40), M.white, clk, 0, 0, 0, false).rotation.x = Math.PI / 2;
  add(new THREE.TorusGeometry(0.16, 0.012, 8, 40), M.dark, clk, 0, 0, 0.01, false);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; add(box(0.008, i % 3 ? 0.02 : 0.035, 0.004), M.dark, clk, Math.sin(a) * 0.13, Math.cos(a) * 0.13, 0.018, false).rotation.z = -a; }
  const mkHand = (len: number, w: number, color: THREE.Material) => { const piv = new THREE.Group(); piv.position.z = 0.02; clk.add(piv); const m = add(box(w, len, 0.004), color, piv, 0, len / 2 - 0.01, 0, false); void m; return piv; };
  const hHour = mkHand(0.08, 0.009, M.dark), hMin = mkHand(0.12, 0.006, M.dark), hSec = mkHand(0.13, 0.003, M.red);

  // ── chamber hardware ──
  const copper = M.copper, oring = M.rubber;
  const gasket = add(new THREE.TorusGeometry(R - 0.02, 0.01, 8, 72), copper, ch, 0, 0, L / 2 + 0.004, false); void gasket;
  add(new THREE.TorusGeometry(R - 0.07, 0.008, 8, 72), oring, ch, 0, 0, L / 2 + 0.004, false);
  const clamp = (x: number, y: number, z: number, text: string, rotZ = Math.PI / 2) => {
    const g = new THREE.Group(); g.position.set(x, y, z); ch.add(g);
    const body = add(new THREE.CylinderGeometry(0.056, 0.056, 0.03, 24), M.alu, g, 0, 0, 0); body.rotation.z = rotZ;
    const wing = add(box(0.03, 0.02, 0.05), M.alu, g, 0, 0.055, 0); void wing;
    const tag = label(text, 0.06, 0.02, '#e9eef3'); tag.mesh.position.set(0, 0.0, 0.058); g.add(tag.mesh); return g;
  };
  clamp(-R - 0.115, 0.02, 0.22, 'KF40'); clamp(-R - 0.115, 0.02, -0.2, 'KF40'); clamp(R + 0.125, 0.02, 0.12, 'KF50');
  { const g = new THREE.Group(); g.position.set(0, R + 0.17, 0); ch.add(g);
    const dm = new THREE.Object3D(); const bolts = new THREE.InstancedMesh(track(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 8)), M.dark, 12);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; dm.position.set(Math.cos(a) * 0.13, 0, Math.sin(a) * 0.13); dm.updateMatrix(); bolts.setMatrixAt(i, dm.matrix); } g.add(bolts);
    const tag = label('CF-6.0', 0.09, 0.025, '#e9eef3'); tag.mesh.rotation.x = -Math.PI / 2; tag.mesh.position.set(0, 0.012, 0.19); g.add(tag.mesh); }
  // weld seams along the shell
  for (const a of [0.7, 3.84]) { const seam = add(box(0.012, 0.012, L - 0.05), M.shell, ch, Math.cos(a) * (R + 0.003), Math.sin(a) * (R + 0.003), 0, false); seam.rotation.z = a - Math.PI / 2; }
  // interior: baffles, cable bundle, thermocouple leads
  const bafMat = M.liner;
  for (const z of [-0.5, -0.54]) { const rg = new THREE.Mesh(track(new THREE.RingGeometry(0.34, R - 0.02, 48, 1)), bafMat); rg.position.z = z; ch.add(rg); }
  const bundle = new THREE.CatmullRomCurve3([new THREE.Vector3(0.15, -0.38, -0.3), new THREE.Vector3(0.2, -0.45, -0.4), new THREE.Vector3(0.12, -0.3, -0.52), new THREE.Vector3(0.1, -0.05, -0.578)]);
  add(new THREE.TubeGeometry(bundle, 28, 0.012, 8, false), M.black, ch, 0, 0, 0, false);
  for (const [c0, off] of [[0xef4444, -0.012], [0xf59e0b, 0.012]] as [number, number][]) { const cur = new THREE.CatmullRomCurve3(bundle.getPoints(10).map(p => p.clone().add(new THREE.Vector3(off, 0.012, 0)))); add(new THREE.TubeGeometry(cur, 24, 0.003, 6, false), basic({ color: c0 }), ch, 0, 0, 0, false); }
  // frost (cold) / heat glow (hot) shell overlay
  const frostMat = track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); ctx.cuttable.push(frostMat);
  const frost = new THREE.Mesh(track(new THREE.CylinderGeometry(R + 0.012, R + 0.012, L - 0.02, 72, 1, true)), frostMat); frost.rotation.x = Math.PI / 2; ch.add(frost);
  // gas-flow particles during pumping
  const NP = 70, gasPos = new Float32Array(NP * 3), gasSeed = Array.from({ length: NP }, () => ({ u: Math.random(), sx: (Math.random() - 0.5) * 0.5, sy: (Math.random() - 0.3) * 0.5, sz: (Math.random() - 0.5) * 0.7, sp: 0.25 + Math.random() * 0.25 }));
  const gasGeo = track(new THREE.BufferGeometry()); gasGeo.setAttribute('position', new THREE.BufferAttribute(gasPos, 3));
  const gasMat = track(new THREE.PointsMaterial({ color: 0x5b7ea6, size: 0.02, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true, map: keepTex(glowTex()) }));
  fx.add(new THREE.Points(gasGeo, gasMat));
  const gasEnd = new THREE.Vector3(0, 0.62, -0.1);
  updaters.push((s, dt) => {
    const c = s.chamber, pumping = (c.roughing || c.turbo) && !c.vent; const dens = pumping ? Math.max(0, Math.min(1, (Math.log10(Math.max(c.pressure, 1e-6)) + 3) / 5.7)) : 0;
    gasMat.opacity = dens * 0.8; gasGeo.setDrawRange(0, Math.round(NP * dens));
    for (let i = 0; i < NP; i++) { const g = gasSeed[i]; g.u += dt * g.sp; if (g.u > 1) g.u -= 1; const k = g.u * g.u * (3 - 2 * g.u); const sx = g.sx * (1 - k), sy = CH_Y + g.sy * (1 - k) * 0.6, sz = g.sz * (1 - k);
      gasPos[i * 3] = sx + (gasEnd.x - sx) * k * 0 + gasEnd.x * k; gasPos[i * 3 + 1] = sy + (gasEnd.y - sy) * k; gasPos[i * 3 + 2] = sz + (gasEnd.z - sz) * k; }
    gasGeo.attributes.position.needsUpdate = true;
    const T = c.temperature ?? 22; const cold = Math.max(0, Math.min(0.55, (14 - T) / 14)), hot = Math.max(0, Math.min(0.18, (T - 35) / 80));
    frostMat.color.set(cold > 0 ? 0xf2f8ff : 0xff8a3d); frostMat.opacity = cold > 0 ? cold : hot;
  });

  // ── stage hardware: leadscrews, encoder strips, flexure ──
  const screwMat = std({ color: 0xb7bec6, metalness: 1, roughness: 0.25 });
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.78, 12), screwMat, stageRoot, 0, -0.438, 0, false).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.38, 12), screwMat, yCar, 0, -0.02, 0, false).rotation.z = Math.PI / 2;
  const enc = canvasTex(256, 16, (c, W, H) => { c.fillStyle = '#f2f4f6'; c.fillRect(0, 0, W, H); c.fillStyle = '#14181c'; for (let x = 0; x < W; x += 4) c.fillRect(x, 0, 2, H); }); keepTex(enc.tex); enc.tex.wrapS = THREE.RepeatWrapping; enc.tex.repeat.set(6, 1);
  const encMat = basic({ map: enc.tex });
  for (const x of [-0.22, 0.22]) { const m = new THREE.Mesh(track(new THREE.PlaneGeometry(0.78, 0.012)), encMat); m.rotation.set(-Math.PI / 2, 0, Math.PI / 2); m.position.set(x, -0.411, 0); stageRoot.add(m); }
  { const flex = add(new THREE.CylinderGeometry(0.052, 0.052, 0.008, 28), M.steel, xCar, 0, 0.103, 0, false); void flex; for (let k = 0; k < 3; k++) add(box(0.05, 0.01, 0.004), M.dark, xCar, Math.cos(k * 2.09) * 0.035, 0.105, Math.sin(k * 2.09) * 0.035, false).rotation.y = -k * 2.09; }

  // ── rack hardware: indicator rows, vents, labels, fan unit ──
  const rackLeds: { m: THREE.MeshBasicMaterial; panel: string; k: number }[] = [];
  const panelNames: Record<string, string> = { clock: 'SRS FS725', vna: 'KEYSIGHT E5080B', scope: 'TEK MSO5', ldv: 'POLYTEC PSV-500', daq: 'DAQ / TIMING' };
  for (const p of ctx.panels) {
    const lb = label(panelNames[p.name] || p.name, 0.16, 0.026); lb.mesh.position.set(-0.18, p.y - p.h / 2 + 0.018, 0.275); rack.add(lb.mesh);
    for (let k = 0; k < 4; k++) { const m = basic({ color: 0x334155 }); const l = new THREE.Mesh(track(new THREE.SphereGeometry(0.006, 8, 6)), m); l.position.set(0.1 + k * 0.032, p.y - p.h / 2 + 0.018, 0.275); rack.add(l); rackLeds.push({ m, panel: p.name, k }); }
    for (let k = 0; k < 6; k++) add(box(0.025, 0.004, 0.002), M.black, rack, 0.14 + k * 0.03 - 0.07, p.y + p.h / 2 - 0.01, 0.273, false);
  }
  const fanUnit = new THREE.Group(); fanUnit.position.set(0, 0.28, 0); rack.add(fanUnit);
  add(box(0.58, 0.28, 0.5), M.alu, fanUnit, 0, 0, 0); add(box(0.6, 0.27, 0.03), M.black, fanUnit, 0, 0, 0.255);
  add(new THREE.TorusGeometry(0.1, 0.008, 8, 32), M.dark, fanUnit, -0.1, 0, 0.275, false);
  const fanRot = new THREE.Group(); fanRot.position.set(-0.1, 0, 0.274); fanUnit.add(fanRot); for (let i = 0; i < 7; i++) { const b = add(box(0.085, 0.022, 0.003), M.dark, fanRot, 0, 0, 0, false); b.rotation.z = (i / 7) * Math.PI * 2; b.position.set(Math.cos((i / 7) * Math.PI * 2) * 0.045, Math.sin((i / 7) * Math.PI * 2) * 0.045, 0); }
  { const pl = label('PDU  FAN TRAY', 0.16, 0.026); pl.mesh.position.set(0.17, 0.1, 0.275); fanUnit.add(pl.mesh); for (let k = 0; k < 4; k++) add(box(0.025, 0.045, 0.012), M.dark, fanUnit, 0.07 + k * 0.045, -0.02, 0.276, false); }
  const pdu = new THREE.Group(); pdu.position.set(0, 0.1, 0); rack.add(pdu); add(box(0.58, 0.12, 0.5), M.alu, pdu, 0, 0, 0); add(box(0.6, 0.11, 0.03), M.black, pdu, 0, 0, 0.255);
  const breakerLed = basic({ color: 0x334155 }); { const l = new THREE.Mesh(track(new THREE.SphereGeometry(0.01, 10, 8)), breakerLed); l.position.set(-0.2, 0, 0.275); pdu.add(l); const pl = label('MAINS', 0.1, 0.026); pl.mesh.position.set(0.0, 0, 0.275); pdu.add(pl.mesh); }
  const knobTarget = new Map<THREE.Mesh, { cur: number; want: number; panel: string }>(); for (const k of knobs) knobTarget.set(k.mesh, { cur: 0, want: 0, panel: k.panel });
  const knobValue = (s: any, panel: string, i: number) => {
    const v = panel === 'clock' ? [s.clock?.warmup || 0, 0, 0] : panel === 'vna' ? [((s.vna?.center || 230000) % 5000) / 5000, (s.vna?.span || 5000) / 20000, (s.vna?.ifbw || 100) / 1000] : panel === 'scope' ? [(s.scope?.timebase || 10) / 100, (s.scope?.scale || 0.5), (s.scope?.triggerLevel || 0) + 0.5] : panel === 'ldv' ? [(s.ldv?.laserPower || 50) / 100, (s.ldv?.focus || 0) / 10 + 0.5, (s.ldv?.opticalReturn || 85) / 100] : [s.experiment?.scanProgress || 0, 0, 0];
    return (v[i] ?? 0) * Math.PI * 1.6 - 0.8;
  };
  const nudge: Record<string, number> = {};
  let rackT = 0, fanSpin = 0;
  updaters.push((s, dt, t) => {
    const power = !!s.facility?.power; fanSpin += power ? dt * 18 : 0; fanRot.rotation.z = fanSpin; breakerLed.color.set(power ? 0x22c55e : 0x7f1d1d);
    rackT += dt;
    for (const l of rackLeds) { const on = power && (l.panel === 'clock' ? s.clock?.power : l.panel === 'vna' ? s.vna?.power : l.panel === 'scope' ? s.scope?.power : l.panel === 'ldv' ? s.ldv?.power : true);
      const blinkOn = on && (l.k === 0 || Math.sin(t * (2 + l.k * 1.3) + l.k * 7 + l.panel.length) > (l.panel === 'daq' ? -0.2 : 0.2)); l.m.color.set(blinkOn ? (l.k === 3 ? 0xfbbf24 : 0x22c55e) : 0x334155); }
    let idx: Record<string, number> = {}; for (const [m, st] of knobTarget) { const i = (idx[st.panel] = (idx[st.panel] ?? -1) + 1); st.want = knobValue(s, st.panel, i) + (nudge[st.panel] || 0); st.cur += (st.want - st.cur) * Math.min(1, dt * 4); m.rotation.y = st.cur; }
  });

  // ── props ──
  { const cart = new THREE.Group(); cart.position.set(3.5, 0, 0.9); cart.rotation.y = -0.35; room.add(cart);
    for (const [x, z] of [[-0.33, -0.2], [0.33, -0.2], [-0.33, 0.2], [0.33, 0.2]]) { add(new THREE.CylinderGeometry(0.012, 0.012, 0.86, 8), M.steel, cart, x, 0.47, z); add(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12), M.rubber, cart, x, 0.035, z).rotation.z = Math.PI / 2; }
    for (const y of [0.2, 0.55, 0.9]) add(box(0.72, 0.025, 0.46), M.alu, cart, 0, y, 0);
    add(box(0.3, 0.14, 0.26), M.blue, cart, -0.15, 0.98, 0); add(box(0.22, 0.1, 0.2), M.white, cart, 0.18, 0.96, 0.02); add(box(0.2, 0.2, 0.18), M.dark, cart, -0.1, 0.66, 0); add(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 16), M.red, cart, 0.2, 0.64, 0.05); }
  { for (const [x, c0] of [[-3.58, 0x2f855a], [-3.82, 0x9aa5b1]] as [number, number][]) { const g = new THREE.Group(); g.position.set(x, 0, -2.3); room.add(g); const m = std({ color: c0, metalness: 0.5, roughness: 0.4 });
      add(new THREE.CylinderGeometry(0.105, 0.105, 1.2, 24), m, g, 0, 0.75, 0); add(new THREE.SphereGeometry(0.105, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m, g, 0, 1.35, 0); add(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 10), M.steel, g, 0, 1.47, 0); add(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), M.dark, g, 0, 1.5, 0); }
    add(box(0.5, 0.025, 0.012), M.steel, room, -3.7, 1.0, -2.45, false); }
  const wsG = ctx.wsG;
  { for (const [x, z] of [[0.72, 0.18], [0.9, 0.18]] as number[][]) { add(box(0.1, 0.012, 0.1), M.alu, wsG, x, 0.936, z); add(new THREE.CylinderGeometry(0.0127, 0.0127, 0.12, 12), M.steel, wsG, x, 1.0, z); add(box(0.03, 0.02, 0.03), M.dark, wsG, x, 1.07, z); }
    const gog = new THREE.Group(); gog.position.set(0.15, 0.95, 0.22); gog.rotation.y = 0.5; wsG.add(gog); for (const x of [-0.035, 0.035]) add(new THREE.TorusGeometry(0.03, 0.007, 8, 18), M.black, gog, x, 0.02, 0).rotation.x = Math.PI / 2; add(new THREE.TorusGeometry(0.075, 0.005, 6, 24, Math.PI), M.rubber, gog, 0, 0.02, 0).rotation.x = Math.PI / 2;
    const nb = canvasTex(128, 180, (c, W, H) => { c.fillStyle = '#1f3a5f'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.font = '700 18px system-ui'; c.textAlign = 'center'; c.fillText('LAB', W / 2, 70); c.fillText('NOTEBOOK', W / 2, 96); c.fillStyle = '#f2b134'; c.fillRect(20, 112, W - 40, 4); }); keepTex(nb.tex);
    const nbm = new THREE.Mesh(track(new THREE.PlaneGeometry(0.21, 0.3)), basic({ map: nb.tex })); nbm.rotation.x = -Math.PI / 2; nbm.position.set(-0.6, 0.936, 0.2); nbm.rotation.z = 0.2; wsG.add(nbm); add(box(0.21, 0.012, 0.3), M.white, wsG, -0.6, 0.93, 0.2).rotation.y = 0.2;
    const mug = new THREE.Group(); mug.position.set(0.78, 0.925, 0.28); wsG.add(mug); add(new THREE.CylinderGeometry(0.04, 0.036, 0.09, 20, 1, true), M.white, mug, 0, 0.045, 0); add(new THREE.CylinderGeometry(0.036, 0.036, 0.004, 20), M.white, mug, 0, 0.002, 0); add(new THREE.CircleGeometry(0.036, 20), basic({ color: 0x3b2314 }), mug, 0, 0.078, 0).rotation.x = -Math.PI / 2; add(new THREE.TorusGeometry(0.025, 0.006, 6, 12, Math.PI), M.white, mug, 0.045, 0.05, 0).rotation.z = -Math.PI / 2;
    const NS = 14, sp = new Float32Array(NS * 3), sGeo = track(new THREE.BufferGeometry()); sGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const sMat = track(new THREE.PointsMaterial({ color: 0xffffff, size: 0.03, transparent: true, opacity: 0.35, depthWrite: false, map: keepTex(glowTex()) })); const steam = new THREE.Points(sGeo, sMat); steam.position.copy(mug.position).add(new THREE.Vector3(0, 0.08, 0)); fx.add(steam); steam.userData.wsG = true;
    wsG.updateMatrixWorld(true); const wp = new THREE.Vector3(); mug.getWorldPosition(wp); steam.position.copy(wp).add(new THREE.Vector3(0, 0.09, 0));
    updaters.push((_s, _dt, t) => { for (let i = 0; i < NS; i++) { const u = ((t * 0.18 + i / NS) % 1); sp[i * 3] = Math.sin(t * 1.3 + i) * 0.012 * u; sp[i * 3 + 1] = u * 0.18; sp[i * 3 + 2] = Math.cos(t * 1.1 + i * 2) * 0.012 * u; } sGeo.attributes.position.needsUpdate = true; }); }
  // overhead cable tray + tagged cables
  { const tray = new THREE.Group(); tray.position.set(-1.85, 2.5, -0.5); room.add(tray); add(box(2.6, 0.02, 0.2), M.alu, tray, 0, 0, 0); add(box(2.6, 0.06, 0.012), M.alu, tray, 0, 0.03, 0.1); add(box(2.6, 0.06, 0.012), M.alu, tray, 0, 0.03, -0.1);
    for (const x of [-1.1, 0, 1.1]) add(new THREE.CylinderGeometry(0.004, 0.004, 1.2, 6), M.steel, tray, x, 0.6, 0, false); }
  const tags: { m: THREE.Mesh; base: number }[] = [];
  const tagAt = (curve: THREE.CatmullRomCurve3, u: number, text: string) => { const p = curve.getPoint(u); const lb = label(text, 0.05, 0.02, '#fff8c4', '#222'); lb.mesh.position.copy(p).add(new THREE.Vector3(0, -0.025, 0)); scene.add(lb.mesh); tags.push({ m: lb.mesh, base: u * 6 }); };
  tagAt(ctx.rfCurve, 0.25, 'RF-1'); tagAt(ctx.rfCurve, 0.55, 'RF-1'); tagAt(ctx.rfCurve, 0.85, 'RF-1'); tagAt(ctx.fibreCurve, 0.3, 'FO-2'); tagAt(ctx.fibreCurve, 0.65, 'FO-2');
  updaters.push((_s, _dt, t) => { for (const g of tags) { g.m.rotation.z = Math.sin(t * 1.4 + g.base) * 0.05; g.m.rotation.x = Math.sin(t * 1.1 + g.base * 2) * 0.03; } });

  // ── wall phone ──
  const phoneBase = new THREE.Group(); phoneBase.position.set(1.3, 1.3, -2.575); room.add(phoneBase);
  add(box(0.14, 0.34, 0.05), M.black, phoneBase, 0, 0, 0.0); add(box(0.1, 0.1, 0.01), M.dark, phoneBase, 0, -0.08, 0.03);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) add(box(0.022, 0.016, 0.008), M.white, phoneBase, -0.035 + c * 0.035, -0.045 - r * 0.026 - 0.0, 0.036 - 0.0, false);
  add(box(0.03, 0.05, 0.03), M.dark, phoneBase, -0.075, 0.1, 0.03); add(box(0.03, 0.05, 0.03), M.dark, phoneBase, 0.075, 0.1, 0.03);
  const ringLamp = new THREE.Mesh(track(new THREE.SphereGeometry(0.014, 12, 8)), basic({ color: 0x4b1d1d })); ringLamp.position.set(0, 0.145, 0.03); phoneBase.add(ringLamp);
  const ringLight = new THREE.PointLight(0xff3b3b, 0, 1.2, 2); ringLight.position.set(0, 0.145, 0.15); phoneBase.add(ringLight);
  const handset = new THREE.Group(); handset.name = 'handset'; add(box(0.05, 0.05, 0.22), M.black, handset, 0, 0, 0, false); add(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 14), M.black, handset, 0, 0.0, 0.1, false).rotation.z = Math.PI / 2; add(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 14), M.black, handset, 0, 0.0, -0.1, false).rotation.z = Math.PI / 2;
  const cradleRot = new THREE.Euler(Math.PI / 2, 0, 0); const cradlePos = new THREE.Vector3(0, 0.115, 0.07); handset.position.copy(cradlePos); handset.rotation.copy(cradleRot); phoneBase.add(handset);
  const cordPts = Array.from({ length: 14 }, () => new THREE.Vector3()); const cordGeo = track(new THREE.BufferGeometry().setFromPoints(cordPts)); const cord = new THREE.Line(cordGeo, track(new THREE.LineBasicMaterial({ color: 0x111111 }))); cord.visible = false; scene.add(cord);
  const phone: PhoneRig = {
    anchor: new THREE.Vector3(1.3, 0, -2.0), base: phoneBase, handset, ringing: false, offHook: false,
    setRinging(on) { phone.ringing = on; if (!on) { (ringLamp.material as THREE.MeshBasicMaterial).color.set(0x4b1d1d); ringLight.intensity = 0; phoneBase.rotation.z = 0; } },
    takeOff(hand) { phone.offHook = true; hand.add(handset); handset.position.set(0.0, -0.3, 0.05); handset.rotation.set(0.3, 0, 0); cord.visible = true; },
    hangUp() { phone.offHook = false; phoneBase.add(handset); handset.position.copy(cradlePos); handset.rotation.copy(cradleRot); cord.visible = false; },
  };
  const cordFrom = new THREE.Vector3(), cordTo = new THREE.Vector3(), cordMid = new THREE.Vector3();
  updaters.push((_s, _dt, t) => {
    if (phone.ringing) { const on = Math.sin(t * 14) > 0; (ringLamp.material as THREE.MeshBasicMaterial).color.set(on ? 0xff2a2a : 0x4b1d1d); ringLight.intensity = on ? 1.6 : 0; phoneBase.rotation.z = on ? 0.012 : -0.012; handset.position.y = cradlePos.y + (on ? 0.004 : 0); }
    if (phone.offHook) { phoneBase.getWorldPosition(cordFrom); cordFrom.y -= 0.08; handset.getWorldPosition(cordTo); cordMid.copy(cordFrom).lerp(cordTo, 0.5); cordMid.y -= 0.25; const cur = new THREE.QuadraticBezierCurve3(cordFrom, cordMid, cordTo); const pts = cur.getPoints(13); for (let i = 0; i < 14; i++) cordPts[i].copy(pts[i]); cordGeo.setFromPoints(cordPts); }
  });

  // ── ceiling light fixtures (soft area lights) ──
  if (!areaInit) { RectAreaLightUniformsLib.init(); areaInit = true; }
  const fixtures: THREE.Object3D[] = [];
  for (const z of [-1.1, 0.5, 2.0]) {
    const g = new THREE.Group(); g.position.set(0, 3.0, z); fx.add(g); fixtures.push(g);
    add(box(2.4, 0.05, 0.22), M.alu, g, 0, 0, 0, false); add(box(2.3, 0.01, 0.17), basic({ color: new THREE.Color(4, 4, 4) }), g, 0, -0.03, 0, false);
    for (const x of [-1.0, 1.0]) add(new THREE.CylinderGeometry(0.004, 0.004, 0.8, 6), M.steel, g, x, 0.42, 0, false);
    const al = new THREE.RectAreaLight(0xffffff, 2.2, 2.3, 0.17); al.position.set(0, -0.04, 0); al.rotation.x = -Math.PI / 2; g.add(al);
  }
  // dust motes drifting in the light
  const ND = 140, dp = new Float32Array(ND * 3), dv = Array.from({ length: ND }, () => ({ x: (Math.random() - 0.5) * 3.4, y: 0.5 + Math.random() * 2.2, z: (Math.random() - 0.5) * 3.4, p: Math.random() * 6 }));
  const dGeo = track(new THREE.BufferGeometry()); dGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dMat = track(new THREE.PointsMaterial({ color: 0xffffff, size: 0.014, transparent: true, opacity: 0.55, depthWrite: false, map: keepTex(glowTex()) })); fx.add(new THREE.Points(dGeo, dMat));
  updaters.push((s, dt, t) => { for (let i = 0; i < ND; i++) { const d = dv[i]; d.y += Math.sin(t * 0.3 + d.p) * 0.0006 + 0.0004; d.x += Math.sin(t * 0.21 + d.p * 2) * 0.0007; if (d.y > 2.8) d.y = 0.5; dp[i * 3] = d.x; dp[i * 3 + 1] = d.y; dp[i * 3 + 2] = d.z; } dGeo.attributes.position.needsUpdate = true; dMat.opacity = s.ldv?.shutter && s.ldv?.power ? 0.9 : 0.5; void dt; });

  // ── clock hands, picking, quality ──
  updaters.push(() => { const d = new Date(); const sec = d.getSeconds() + d.getMilliseconds() / 1000, min = d.getMinutes() + sec / 60, hr = (d.getHours() % 12) + min / 60; hSec.rotation.z = -sec / 60 * Math.PI * 2; hMin.rotation.z = -min / 60 * Math.PI * 2; hHour.rotation.z = -hr / 12 * Math.PI * 2; });
  const pickables: Pickable[] = [
    { name: 'chamber', label: 'Thermal-vacuum chamber', help: 'ov.chamber', root: ctx.parts.chamber, view: 'chamber' },
    { name: 'stage', label: 'XYZ stage and sphere', help: 'ov.stage', root: ctx.parts.stage, view: 'stage' },
    { name: 'ldv', label: 'Laser vibrometer (LDV)', help: 'ov.ldv', root: ctx.parts.ldv, view: 'chamber' },
    { name: 'pumps', label: 'Vacuum pumps', help: 'ov.pumps', root: ctx.parts.pumps, view: 'chamber' },
    { name: 'rack', label: 'Instrument rack', help: 'ov.equipment', root: rack, view: 'rack' },
    { name: 'workstation', label: 'Workstation', help: 'ov.workstation', root: wsG, view: 'bench' },
    { name: 'phone', label: 'Lab phone: call Dr. Wire', help: 'ov.overview', root: phoneBase, view: 'phone' },
    { name: 'clock', label: 'Wall clock (real time)', help: 'ov.sim_time', root: clk, view: 'overview' },
  ];
  const setQuality = (q: Quality) => { fx.visible = q === 'high'; };
  const turnKnob = (panel: string, delta: number) => { nudge[panel] = (nudge[panel] || 0) + delta; };
  const update = (s: any, dt: number, t: number) => { for (const u of updaters) u(s, dt, t); };
  const anchors = { phone: phone.anchor.clone().setY(1.3), clock: new THREE.Vector3(0.9, 2.5, -2.5) };
  const dispose = () => { texs.forEach(x => { try { x.dispose(); } catch { /* already gone */ } }); };
  const dynamic: THREE.Object3D[] = [fx, fanRot, hHour, hMin, hSec, handset, cord, ringLamp, ...tags.map(g => g.m)];
  return { update, setQuality, phone, pickables, turnKnob, anchors, dispose, dynamic };
}

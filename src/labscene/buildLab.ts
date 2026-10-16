import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// A bright, realistic-looking laboratory: stainless thermal-vacuum chamber with door and
// viewports, an XYZ stage and sphere inside, vacuum pumps, a laser vibrometer on a gantry, an
// instrument rack with live screens, a workstation bench and a whiteboard. Everything is driven
// by the same simulation state as the rest of the app (see `update`).

export const STAGE_SCALE = 0.003;       // metres of scene per mm of stage travel (35 mm -> 0.105 m, exaggerated)
const CH_Y = 1.1;                        // chamber axis height

type CanvasTex = { tex: THREE.CanvasTexture; redraw: (fn: (c: CanvasRenderingContext2D, w: number, h: number) => void) => void };
function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void): CanvasTex {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { tex, redraw: fn => { fn(ctx, w, h); tex.needsUpdate = true; } };
}

export type Lab = {
  scene: THREE.Scene;
  update: (state: any, dt: number, t: number) => void;
  setCutaway: (on: boolean) => void;
  dispose: () => void;
  spherePos: THREE.Vector3;
  anchors: Record<string, THREE.Vector3>;
};

export function buildLab(renderer: THREE.WebGLRenderer): Lab {
  const scene = new THREE.Scene();
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(o: T): T => { disposables.push(o); return o; };
  const bg = new THREE.Color('#eef2f6');
  scene.background = bg; scene.fog = new THREE.Fog(bg, 11, 24);

  // ── image-based light so metal has something to reflect ──
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex; scene.environmentIntensity = 0.75; disposables.push({ dispose: () => { envTex.dispose(); pmrem.dispose(); } });

  const hemi = new THREE.HemisphereLight(0xffffff, 0xcdd6e0, 0.9); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.3); key.position.set(3.5, 6, 4.5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -6; key.shadow.camera.right = 6; key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
  key.shadow.camera.near = 1; key.shadow.camera.far = 18; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdbe8ff, 0.7); fill.position.set(-5, 3, 2); scene.add(fill);
  const lamp = new THREE.PointLight(0xfff1dc, 2.2, 3.2, 2); lamp.position.set(0.05, CH_Y + 0.32, 0.1); scene.add(lamp);

  // ── materials ──
  const M = {
    steel: track(new THREE.MeshStandardMaterial({ color: 0xcfd4da, metalness: 1, roughness: 0.3 })),
    liner: track(new THREE.MeshStandardMaterial({ color: 0xe6ebf0, metalness: 1, roughness: 0.14, side: THREE.DoubleSide })),
    shell: track(new THREE.MeshStandardMaterial({ color: 0xc4cad1, metalness: 1, roughness: 0.34, side: THREE.DoubleSide })),
    alu: track(new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 0.9, roughness: 0.38 })),
    dark: track(new THREE.MeshStandardMaterial({ color: 0x22262b, metalness: 0.5, roughness: 0.5 })),
    black: track(new THREE.MeshStandardMaterial({ color: 0x111316, metalness: 0.2, roughness: 0.7 })),
    white: track(new THREE.MeshStandardMaterial({ color: 0xf3f5f7, metalness: 0.05, roughness: 0.5 })),
    paint: track(new THREE.MeshStandardMaterial({ color: 0xc9d0d8, metalness: 0.3, roughness: 0.55 })),
    blue: track(new THREE.MeshStandardMaterial({ color: 0x1f6feb, metalness: 0.3, roughness: 0.45 })),
    copper: track(new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 1, roughness: 0.3 })),
    gold: track(new THREE.MeshStandardMaterial({ color: 0xf2b134, metalness: 1, roughness: 0.16 })),
    ceramic: track(new THREE.MeshStandardMaterial({ color: 0xf5efe6, metalness: 0, roughness: 0.4 })),
    glass: track(new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.2, clearcoat: 1, depthWrite: false })),
    rubber: track(new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.9 })),
    red: track(new THREE.MeshStandardMaterial({ color: 0xd62d2d, metalness: 0.3, roughness: 0.4 })),
    wall: track(new THREE.MeshStandardMaterial({ color: 0xf7f9fb, roughness: 0.95 })),
    laminate: track(new THREE.MeshStandardMaterial({ color: 0xf1f3f5, roughness: 0.4 })),
  };
  // Parts of the shell that get cut away in cutaway mode.
  const cutPlanes = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.16), new THREE.Plane(new THREE.Vector3(0, -1, 0), CH_Y)];
  const cuttable = [M.shell, M.liner];
  const setCutaway = (on: boolean) => { for (const m of cuttable) { m.clippingPlanes = on ? cutPlanes : null; m.clipIntersection = true; m.needsUpdate = true; } };
  renderer.localClippingEnabled = true;

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0, shadow = true) => {
    const m = new THREE.Mesh(track(geo), mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

  // ── room ──
  const room = new THREE.Group(); scene.add(room);
  const floorTex = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#d9dfe6'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(${150 + Math.random() * 60},${160 + Math.random() * 50},${170 + Math.random() * 50},${Math.random() * 0.12})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    c.strokeStyle = '#c3cad2'; c.lineWidth = 3; c.strokeRect(0, 0, w, h);
  });
  floorTex.tex.wrapS = floorTex.tex.wrapT = THREE.RepeatWrapping; floorTex.tex.repeat.set(16, 12);
  const floorMat = track(new THREE.MeshStandardMaterial({ map: floorTex.tex, roughness: 0.32, metalness: 0.05 }));
  const floor = add(new THREE.PlaneGeometry(16, 12), floorMat, room, 0, 0, 0.5); floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
  const back = add(new THREE.PlaneGeometry(16, 3.6), M.wall, room, 0, 1.8, -2.6, false);
  const left = add(new THREE.PlaneGeometry(12, 3.6), M.wall, room, -4.4, 1.8, 0.5, false); left.rotation.y = Math.PI / 2;
  for (const w of [back, left]) w.receiveShadow = true;
  // wainscot + accent stripe + baseboard
  const stripeMat = track(new THREE.MeshStandardMaterial({ color: 0x2a6fdb, roughness: 0.6 })); const woodMat = track(new THREE.MeshStandardMaterial({ color: 0xdfe4ea, roughness: 0.7 }));
  add(box(16, 0.1, 0.03), stripeMat, room, 0, 1.25, -2.585, false); add(box(16, 1.2, 0.02), woodMat, room, 0, 0.6, -2.59, false); add(box(16, 0.1, 0.04), M.dark, room, 0, 0.05, -2.58, false);
  const sl = add(box(0.03, 0.1, 12), stripeMat, room, -4.385, 1.25, 0.5, false); void sl;
  const wl = add(box(0.02, 1.2, 12), woodMat, room, -4.39, 0.6, 0.5, false); void wl;
  // window (left wall) with bright daylight
  const winG = new THREE.Group(); winG.position.set(-4.38, 1.9, -0.7); winG.rotation.y = Math.PI / 2; room.add(winG);
  add(new THREE.PlaneGeometry(2.4, 1.3), track(new THREE.MeshBasicMaterial({ color: 0xdff1ff })), winG, 0, 0, 0.01, false);
  for (const [w, h, x, y] of [[2.5, 0.06, 0, 0.68], [2.5, 0.06, 0, -0.68], [0.06, 1.4, -1.22, 0], [0.06, 1.4, 1.22, 0], [0.04, 1.3, 0, 0], [2.4, 0.04, 0, 0]] as number[][]) add(box(w, h, 0.05), M.white, winG, x, y, 0.03, false);
  // whiteboard
  const wb = canvasTex(1024, 560, (c, w, h) => {
    c.fillStyle = '#fbfcfd'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1f3a5f'; c.font = '700 54px system-ui,sans-serif'; c.fillText('Project S.P.H.E.R.E.', 48, 92);
    c.font = '500 26px system-ui,sans-serif'; c.fillStyle = '#51647a'; c.fillText('Standardized Precision Housing for Experimental Resonance Evaluation', 48, 140);
    c.strokeStyle = '#1f6feb'; c.lineWidth = 4; c.beginPath(); c.arc(190, 330, 80, 0, 7); c.stroke(); c.beginPath(); c.ellipse(190, 330, 80, 24, 0, 0, 7); c.stroke();
    c.strokeStyle = '#d62d2d'; c.beginPath(); c.moveTo(190, 150); c.lineTo(190, 250); c.stroke(); c.fillStyle = '#d62d2d'; c.beginPath(); c.moveTo(190, 262); c.lineTo(176, 236); c.lineTo(204, 236); c.fill();
    c.fillStyle = '#1f3a5f'; c.font = '600 34px ui-monospace,monospace'; c.fillText('f0 = f(x, y, z)  ?', 360, 300); c.fillText('Δf ≈ location variable', 360, 360);
    c.font = '500 26px ui-monospace,monospace'; c.fillStyle = '#51647a'; c.fillText('1. lock clock   2. pump down   3. settle T', 360, 440); c.fillText('4. calibrate VNA   5. scan the stage', 360, 480);
  });
  add(box(2.2, 1.25, 0.04), M.alu, room, -0.2, 1.75, -2.57, false);
  add(new THREE.PlaneGeometry(2.1, 1.15), track(new THREE.MeshBasicMaterial({ map: wb.tex })), room, -0.2, 1.75, -2.545, false);
  // laser warning sign
  const sign = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#ffd400'; c.fillRect(0, 0, w, h); c.strokeStyle = '#111'; c.lineWidth = 10; c.strokeRect(8, 8, w - 16, h - 16); c.fillStyle = '#111'; c.beginPath(); c.moveTo(128, 40); c.lineTo(218, 190); c.lineTo(38, 190); c.closePath(); c.fill(); c.fillStyle = '#ffd400'; c.font = '900 90px system-ui'; c.textAlign = 'center'; c.fillText('!', 128, 172); c.fillStyle = '#111'; c.font = '800 34px system-ui'; c.fillText('LASER', 128, 232); });
  add(new THREE.PlaneGeometry(0.3, 0.3), track(new THREE.MeshBasicMaterial({ map: sign.tex })), room, 1.5, 1.75, -2.55, false);
  // fire extinguisher + shelves
  const ext = new THREE.Group(); ext.position.set(-4.2, 0, -1.9); room.add(ext);
  add(new THREE.CylinderGeometry(0.09, 0.09, 0.42, 24), M.red, ext, 0, 0.55, 0); add(new THREE.CylinderGeometry(0.03, 0.04, 0.1, 16), M.dark, ext, 0, 0.82, 0);
  for (const [i, y] of [1.9, 2.4].entries()) { add(box(2.0, 0.04, 0.35), M.alu, room, 2.9, y, -2.4, true); for (let k = 0; k < 4; k++) add(box(0.3 + (k % 2) * 0.1, 0.22 + ((k + i) % 3) * 0.04, 0.26), k % 2 ? M.white : M.blue, room, 2.2 + k * 0.45, y + 0.14, -2.4, true); }

  // ── chamber assembly (everything that sits on the isolated table) ──
  const bench = new THREE.Group(); scene.add(bench);
  const ch = new THREE.Group(); ch.position.y = CH_Y; bench.add(ch);
  const R = 0.55, L = 1.2;
  const shell = new THREE.Mesh(track(new THREE.CylinderGeometry(R, R, L, 72, 1, true)), M.shell); shell.rotation.x = Math.PI / 2; shell.castShadow = true; shell.receiveShadow = true; ch.add(shell);
  const liner = new THREE.Mesh(track(new THREE.CylinderGeometry(R - 0.018, R - 0.018, L - 0.01, 72, 1, true)), M.liner); liner.rotation.x = Math.PI / 2; ch.add(liner);
  const cap = new THREE.Mesh(track(new THREE.CircleGeometry(R - 0.018, 72)), M.liner); cap.position.z = -L / 2 + 0.01; cap.rotation.y = Math.PI; ch.add(cap);
  const capOut = new THREE.Mesh(track(new THREE.CircleGeometry(R, 72)), M.shell); capOut.position.z = -L / 2 - 0.001; capOut.rotation.y = Math.PI; ch.add(capOut);
  for (const z of [-0.55, -0.3, 0, 0.3, 0.55]) { const t = new THREE.Mesh(track(new THREE.TorusGeometry(R + 0.006, 0.014, 10, 72)), M.shell); t.position.z = z; t.castShadow = true; ch.add(t); }
  // front flange + bolt circle
  const fl = new THREE.Mesh(track(new THREE.CylinderGeometry(R + 0.07, R + 0.07, 0.07, 72)), M.steel); fl.rotation.x = Math.PI / 2; fl.position.z = L / 2 - 0.03; fl.castShadow = true; ch.add(fl);
  const boltGeo = track(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 8)); const bolts = new THREE.InstancedMesh(boltGeo, M.dark, 28); const dm = new THREE.Object3D();
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; dm.position.set(Math.cos(a) * (R + 0.04), Math.sin(a) * (R + 0.04), L / 2 + 0.02); dm.rotation.set(Math.PI / 2, 0, 0); dm.updateMatrix(); bolts.setMatrixAt(i, dm.matrix); }
  ch.add(bolts);
  // door on a left hinge
  const doorPivot = new THREE.Group(); doorPivot.position.set(-(R + 0.07), 0, L / 2 + 0.035); ch.add(doorPivot);
  const doorX = R + 0.07;
  const door = new THREE.Group(); door.position.x = doorX; doorPivot.add(door);
  const dBody = new THREE.Mesh(track(new THREE.CylinderGeometry(R + 0.07, R + 0.07, 0.07, 72)), M.steel); dBody.rotation.x = Math.PI / 2; dBody.castShadow = true; door.add(dBody);
  const dRing = new THREE.Mesh(track(new THREE.TorusGeometry(R - 0.1, 0.012, 10, 72)), M.dark); dRing.position.z = 0.036; door.add(dRing);
  const win = new THREE.Mesh(track(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 48)), M.glass); win.rotation.x = Math.PI / 2; win.position.z = 0.012; door.add(win);
  const bez = new THREE.Mesh(track(new THREE.TorusGeometry(0.255, 0.022, 14, 48)), M.steel); bez.position.z = 0.04; bez.castShadow = true; door.add(bez);
  add(box(0.05, 0.4, 0.06), M.dark, door, 0.45, 0, 0.07); add(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 20), M.dark, door, 0.45, 0, 0.05).rotation.x = Math.PI / 2;
  for (const y of [0.32, -0.32]) add(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 16), M.dark, doorPivot, 0, y, 0);
  add(new THREE.PlaneGeometry(0.34, 0.12), track(new THREE.MeshBasicMaterial({ map: canvasTex(256, 90, (c, w, h) => { c.fillStyle = '#e9eef3'; c.fillRect(0, 0, w, h); c.fillStyle = '#1f3a5f'; c.font = '800 34px system-ui'; c.fillText('S.P.H.E.R.E.', 14, 40); c.font = '600 20px system-ui'; c.fillStyle = '#51647a'; c.fillText('THERMAL-VAC CHAMBER', 14, 72); }).tex })), door, -0.3, -0.36, 0.039, false);
  // top port (LDV window) and side ports
  const topPort = add(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 40), M.shell, ch, 0, R + 0.06, 0); topPort.material = M.steel;
  add(new THREE.CylinderGeometry(0.15, 0.15, 0.035, 40), M.steel, ch, 0, R + 0.15, 0); add(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 40), M.glass, ch, 0, R + 0.152, 0, false);
  const kf = (x: number, z: number, long = 0.12) => { const g = new THREE.Group(); g.position.set(x, 0.02, z); ch.add(g); const p = add(new THREE.CylinderGeometry(0.04, 0.04, long, 24), M.steel, g, 0, 0, 0); p.rotation.z = Math.PI / 2; const c2 = add(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 24), M.alu, g, -long / 2 - 0.01, 0, 0); c2.rotation.z = Math.PI / 2; return g; };
  const leftPort1 = kf(-R - 0.05, 0.22); const leftPort2 = kf(-R - 0.05, -0.2); const rightPort = kf(R + 0.05, 0.12, 0.14); rightPort.scale.x = -1;
  // pressure gauge on the left rear port
  const gauge = new THREE.Group(); gauge.position.set(-R - 0.17, 0.04, -0.2); ch.add(gauge);
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 20), M.alu, gauge, 0.0, 0, 0).rotation.z = Math.PI / 2;
  add(box(0.09, 0.075, 0.16), M.black, gauge, -0.11, 0.0, 0);
  const lcd = canvasTex(256, 128, () => {}); const lcdMat = track(new THREE.MeshBasicMaterial({ map: lcd.tex })); const lcdMesh = new THREE.Mesh(track(new THREE.PlaneGeometry(0.14, 0.06)), lcdMat); lcdMesh.position.set(-0.11, 0.004, 0.081); gauge.add(lcdMesh);
  // RF feedthrough on right port (glows when RF is on)
  const rfMat = track(new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 1, roughness: 0.25, emissive: 0xe879f9, emissiveIntensity: 0 }));
  const rfConn = add(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 16), rfMat, ch, -R - 0.11, 0.02, 0.22); rfConn.rotation.z = Math.PI / 2;
  // Faraday mesh (faint copper grid box around the chamber; lights up when shielding is on)
  const farG = new THREE.Group(); bench.add(farG);
  const farMat = track(new THREE.LineBasicMaterial({ color: 0xc98a3a, transparent: true, opacity: 0.0 }));
  { const pts: number[] = []; const x0 = -0.82, x1 = 0.82, y0 = 0.5, y1 = 1.82, z0 = -0.82, z1 = 0.82, n = 7;
    for (let i = 0; i <= n; i++) { const u = i / n; const x = x0 + u * (x1 - x0), y = y0 + u * (y1 - y0), z = z0 + u * (z1 - z0);
      pts.push(x, y0, z0, x, y1, z0, x0, y, z0, x1, y, z0, x, y0, z1, x, y1, z1, x0, y, z1, x1, y, z1, x0, y0, z, x0, y1, z, x1, y0, z, x1, y1, z, x0, y0, z0, x0, y0, z1 * 0 + z0); }
    const g = track(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); farG.add(new THREE.LineSegments(g, farMat)); }

  // support frame, isolators and floor
  const frame = new THREE.Group(); bench.add(frame);
  for (const [x, z] of [[-0.5, -0.45], [0.5, -0.45], [-0.5, 0.45], [0.5, 0.45]]) { add(box(0.07, 0.5, 0.07), M.paint, frame, x, 0.3, z); add(new THREE.CylinderGeometry(0.07, 0.09, 0.07, 20), M.rubber, frame, x, 0.035, z); }
  add(box(1.2, 0.05, 1.0), M.paint, frame, 0, 0.57, 0); add(box(1.1, 0.04, 0.06), M.paint, frame, 0, 0.2, 0.45); add(box(1.1, 0.04, 0.06), M.paint, frame, 0, 0.2, -0.45);
  for (const sx of [-1, 1]) { const s = add(new THREE.CylinderGeometry(0.52, 0.52, 0.16, 48, 1, false, 0, Math.PI), M.paint, frame, 0, 0, 0, true); s.visible = false; s.position.x = sx * 0.3; }
  const isoLeds: THREE.Mesh[] = [];
  for (const [x, z] of [[-0.5, -0.45], [0.5, -0.45], [-0.5, 0.45], [0.5, 0.45]]) { const m = track(new THREE.MeshBasicMaterial({ color: 0x22c55e })); const l = new THREE.Mesh(track(new THREE.SphereGeometry(0.014, 12, 8)), m); l.position.set(x, 0.1, z + (z > 0 ? 0.045 : -0.045)); frame.add(l); isoLeds.push(l); }

  // ── stage + sphere (inside the chamber) ──
  const stageRoot = new THREE.Group(); stageRoot.position.y = CH_Y; bench.add(stageRoot);
  const holes = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#d9dee4'; c.fillRect(0, 0, w, h); c.fillStyle = '#5b6672'; for (let x = 8; x < w; x += 16) for (let y = 8; y < h; y += 16) { c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); } });
  holes.tex.wrapS = holes.tex.wrapT = THREE.RepeatWrapping; holes.tex.repeat.set(3, 3);
  const plate = add(box(0.72, 0.03, 0.86), track(new THREE.MeshStandardMaterial({ map: holes.tex, metalness: 0.8, roughness: 0.4 })), stageRoot, 0, -0.455, 0);
  for (const [x, z] of [[-0.3, -0.36], [0.3, -0.36], [-0.3, 0.36], [0.3, 0.36]]) add(new THREE.CylinderGeometry(0.025, 0.03, 0.06, 16), M.steel, stageRoot, x, -0.5, z);
  void plate;
  for (const x of [-0.17, 0.17]) add(box(0.03, 0.025, 0.8), M.dark, stageRoot, x, -0.425, 0);
  const yCar = new THREE.Group(); yCar.position.y = -0.4; stageRoot.add(yCar);
  add(box(0.44, 0.045, 0.3), M.alu, yCar, 0, 0, 0); add(box(0.1, 0.05, 0.1), M.blue, yCar, 0.17, 0.0, 0.17); add(box(0.04, 0.012, 0.22), M.dark, yCar, 0.22, 0.03, 0);
  const xCar = new THREE.Group(); xCar.position.y = 0.045; yCar.add(xCar);
  for (const z of [-0.09, 0.09]) add(box(0.4, 0.02, 0.025), M.dark, xCar, 0, -0.01, z);
  add(box(0.3, 0.04, 0.26), M.alu, xCar, 0, 0.02, 0);
  const jackBase = add(box(0.16, 0.06, 0.16), M.steel, xCar, 0, 0.07, 0); void jackBase;
  const column = add(new THREE.CylinderGeometry(0.032, 0.032, 1, 24), M.steel, xCar, 0, 0, 0);
  const bellows: THREE.Mesh[] = []; for (let i = 0; i < 6; i++) { const b = add(new THREE.TorusGeometry(0.036, 0.007, 8, 24), M.alu, xCar, 0, 0, 0); b.rotation.x = Math.PI / 2; bellows.push(b); }
  const post = add(new THREE.CylinderGeometry(0.009, 0.009, 0.07, 12), M.ceramic, xCar, 0, 0, 0);
  const sphere = add(new THREE.SphereGeometry(0.06, 64, 48), M.gold, scene, 0, CH_Y, 0);
  const sphereGlow = new THREE.Mesh(track(new THREE.SphereGeometry(0.075, 24, 16)), track(new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.0, depthWrite: false }))); scene.add(sphereGlow);
  const ghost = new THREE.Mesh(track(new THREE.SphereGeometry(0.06, 24, 16)), track(new THREE.MeshBasicMaterial({ color: 0x2563eb, wireframe: true, transparent: true, opacity: 0.0 }))); scene.add(ghost);
  const spherePos = new THREE.Vector3(0, CH_Y, 0);
  const heat = new THREE.PointLight(0x60a5fa, 0, 1.6, 2); heat.position.set(0, CH_Y - 0.2, 0.3); scene.add(heat);

  // ── LDV head on an overhead gantry ──
  const ldvG = new THREE.Group(); bench.add(ldvG);
  for (const x of [-0.75, 0.75]) add(box(0.06, 2.15, 0.06), M.alu, ldvG, x, 1.075, -0.25);
  add(box(1.62, 0.06, 0.06), M.alu, ldvG, 0, 2.18, -0.25); add(box(0.06, 0.06, 0.5), M.alu, ldvG, 0, 2.18, -0.02);
  add(box(0.24, 0.3, 0.22), M.white, ldvG, 0, 2.0, 0); add(box(0.245, 0.06, 0.225), M.blue, ldvG, 0, 2.08, 0);
  add(new THREE.CylinderGeometry(0.055, 0.07, 0.12, 28), M.dark, ldvG, 0, 1.79, 0); add(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 28), M.glass, ldvG, 0, 1.73, 0, false);
  add(new THREE.PlaneGeometry(0.2, 0.05), track(new THREE.MeshBasicMaterial({ map: canvasTex(200, 50, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#1f3a5f'; c.font = '800 30px system-ui'; c.fillText('PSV-500 LDV', 10, 36); }).tex })), ldvG, 0, 1.97, 0.116, false);
  const laserMat = track(new THREE.MeshBasicMaterial({ color: 0xff2a3d, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  const laserGlowMat = track(new THREE.MeshBasicMaterial({ color: 0xff5a6e, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  const laser = new THREE.Mesh(track(new THREE.CylinderGeometry(0.0035, 0.0035, 1, 8)), laserMat); const laserGlow = new THREE.Mesh(track(new THREE.CylinderGeometry(0.014, 0.014, 1, 12)), laserGlowMat);
  scene.add(laser, laserGlow);
  const dotMat = track(new THREE.MeshBasicMaterial({ color: 0xff4458 })); const dot = new THREE.Mesh(track(new THREE.SphereGeometry(0.011, 12, 8)), dotMat); scene.add(dot);

  // ── pumps (below / beside the chamber) ──
  const pumpG = new THREE.Group(); bench.add(pumpG);
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 24), M.steel, pumpG, 0, 0.5, -0.1);        // pipe from chamber bottom (hidden inside frame)
  add(box(0.18, 0.1, 0.1), M.blue, pumpG, 0, 0.4, -0.1);                                      // gate valve
  add(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 28), M.steel, pumpG, 0, 0.34, -0.1);
  add(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 28), M.alu, pumpG, 0, 0.2, -0.1);          // turbo body
  add(new THREE.CylinderGeometry(0.07, 0.085, 0.12, 28), M.dark, pumpG, 0, 0.06, -0.1);
  const turboFan = add(new THREE.CylinderGeometry(0.095, 0.095, 0.005, 24), track(new THREE.MeshStandardMaterial({ color: 0x9aa4ae, metalness: 1, roughness: 0.25 })), pumpG, 0, 0.312, -0.1, false);
  const fin = add(box(0.18, 0.004, 0.02), M.dark, pumpG, 0, 0.316, -0.1, false); fin.parent?.remove(fin); turboFan.add(fin); fin.position.set(0, 0.004, 0);
  const rough = new THREE.Group(); rough.position.set(1.05, 0, 0.2); bench.add(rough);
  add(box(0.34, 0.3, 0.5), track(new THREE.MeshStandardMaterial({ color: 0x4a6fa5, metalness: 0.4, roughness: 0.5 })), rough, 0, 0.2, 0); add(box(0.3, 0.06, 0.46), M.dark, rough, 0, 0.38, 0);
  for (let i = 0; i < 8; i++) add(box(0.36, 0.015, 0.4), M.alu, rough, 0, 0.1 + i * 0.03, 0.02);
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 20), M.dark, rough, 0.15, 0.44, 0.15);
  for (const x of [-0.14, 0.14]) for (const z of [-0.2, 0.2]) add(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 12), M.rubber, rough, x, 0.02, z);
  const hoseCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.1, 0.06, -0.1), new THREE.Vector3(0.45, 0.04, -0.12), new THREE.Vector3(0.8, 0.07, 0.0), new THREE.Vector3(1.04, 0.38, 0.2)]);
  add(new THREE.TubeGeometry(hoseCurve, 40, 0.03, 12, false), M.steel, pumpG, 0, 0, 0);
  for (let i = 0; i <= 28; i++) { const p = hoseCurve.getPoint(i / 28), tg = hoseCurve.getTangent(i / 28); const r = new THREE.Mesh(track(new THREE.TorusGeometry(0.031, 0.006, 6, 14)), M.alu); r.position.copy(p); r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg); r.castShadow = false; pumpG.add(r); }
  // venting valve + gas line
  const ventMat = track(new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.0 })); add(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 12), ventMat, ch, R * 0.0, -R - 0.05, 0.3);

  // ── instrument rack with live screens ──
  const rack = new THREE.Group(); rack.position.set(-3.15, 0, -0.5); rack.rotation.y = 0.5; scene.add(rack);
  add(box(0.64, 0.05, 0.84), M.paint, rack, 0, 0.025, 0); add(box(0.64, 0.05, 0.84), M.paint, rack, 0, 1.9, 0);
  for (const [x, z] of [[-0.3, -0.4], [0.3, -0.4], [-0.3, 0.4], [0.3, 0.4]]) add(box(0.04, 1.9, 0.04), M.paint, rack, x, 0.95, z);
  add(box(0.62, 1.88, 0.02), M.paint, rack, 0, 0.95, -0.41);
  for (const x of [-0.31, 0.31]) add(box(0.02, 1.88, 0.8), M.paint, rack, x, 0.95, 0);
  type Panel = { name: string; y: number; h: number; tex: CanvasTex; led: THREE.Mesh };
  const panels: Panel[] = [];
  const mkPanel = (name: string, y: number, h: number) => {
    add(box(0.58, h, 0.5), M.alu, rack, 0, y, 0.0); add(box(0.6, h - 0.01, 0.03), M.black, rack, 0, y, 0.255); 
    const tex = canvasTex(256, Math.round(256 * (0.34 / Math.max(0.06, h - 0.04))) > 180 ? 128 : 96, () => {});
    const scr = new THREE.Mesh(track(new THREE.PlaneGeometry(0.34, Math.min(h - 0.04, 0.16))), track(new THREE.MeshBasicMaterial({ map: tex.tex }))); scr.position.set(-0.07, y, 0.272); rack.add(scr);
    for (let k = 0; k < 3; k++) add(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 16), M.alu, rack, 0.13 + k * 0.05, y, 0.275).rotation.x = Math.PI / 2;
    const led = new THREE.Mesh(track(new THREE.SphereGeometry(0.008, 10, 8)), track(new THREE.MeshBasicMaterial({ color: 0x334155 }))); led.position.set(0.24, y + h / 2 - 0.03, 0.272); rack.add(led);
    panels.push({ name, y, h, tex, led });
  };
  mkPanel('clock', 1.74, 0.12); mkPanel('vna', 1.46, 0.3); mkPanel('scope', 1.1, 0.34); mkPanel('ldv', 0.76, 0.2); mkPanel('daq', 0.52, 0.16);
  // beacon tower on the rack
  const beacon = [0x22c55e, 0xf59e0b, 0xef4444].map((c, i) => { const m = track(new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.1, transparent: true, opacity: 0.9 })); add(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 20), m, rack, 0, 2.0 + i * 0.075, 0); return m; });
  add(new THREE.CylinderGeometry(0.05, 0.06, 0.03, 20), M.dark, rack, 0, 1.94, 0);
  // cables: RF coax rack -> chamber, fibre rack -> LDV head
  const rackToWorld = (v: THREE.Vector3) => rack.localToWorld(v.clone());
  rack.updateMatrixWorld(true);
  const rfPts = [rackToWorld(new THREE.Vector3(0.28, 1.46, 0.3)), new THREE.Vector3(-2.7, 1.25, 0.6), new THREE.Vector3(-1.7, 0.95, 0.75), new THREE.Vector3(-1.0, 1.0, 0.5), new THREE.Vector3(-0.66, 1.12, 0.22)];
  const rfCurve = new THREE.CatmullRomCurve3(rfPts); add(new THREE.TubeGeometry(rfCurve, 60, 0.009, 8, false), M.black, scene, 0, 0, 0);
  const fibreCurve = new THREE.CatmullRomCurve3([rackToWorld(new THREE.Vector3(0.1, 1.97, 0)), new THREE.Vector3(-2.6, 2.3, -0.6), new THREE.Vector3(-1.2, 2.35, -0.4), new THREE.Vector3(-0.2, 2.25, -0.1), new THREE.Vector3(0, 2.1, 0)]);
  add(new THREE.TubeGeometry(fibreCurve, 60, 0.005, 6, false), track(new THREE.MeshStandardMaterial({ color: 0xff9f1c, roughness: 0.5 })), scene, 0, 0, 0);
  const rfPulse = new THREE.Mesh(track(new THREE.SphereGeometry(0.02, 12, 8)), track(new THREE.MeshBasicMaterial({ color: 0xe879f9, transparent: true, opacity: 0 }))); scene.add(rfPulse);

  // ── workstation bench ──
  const wsG = new THREE.Group(); wsG.position.set(2.9, 0, -1.9); scene.add(wsG);
  add(box(2.0, 0.05, 0.8), M.laminate, wsG, 0, 0.9, 0); for (const x of [-0.95, 0.95]) for (const z of [-0.35, 0.35]) add(box(0.05, 0.88, 0.05), M.alu, wsG, x, 0.44, z);
  add(box(1.9, 0.04, 0.7), M.alu, wsG, 0, 0.3, 0);
  const monTex = canvasTex(512, 300, () => {});
  add(box(0.62, 0.38, 0.03), M.black, wsG, -0.2, 1.22, -0.12); add(box(0.04, 0.2, 0.04), M.dark, wsG, -0.2, 1.03, -0.14); add(box(0.24, 0.015, 0.16), M.dark, wsG, -0.2, 0.935, -0.12);
  add(new THREE.PlaneGeometry(0.58, 0.34), track(new THREE.MeshBasicMaterial({ map: monTex.tex })), wsG, -0.2, 1.22, -0.103, false);
  add(box(0.4, 0.015, 0.13), M.dark, wsG, -0.2, 0.93, 0.18); add(box(0.5, 0.35, 0.3), M.alu, wsG, 0.55, 1.1, -0.1);
  add(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 16), M.white, wsG, 0.5, 0.97, 0.25);
  const chair = new THREE.Group(); chair.position.set(2.9, 0, -0.9); scene.add(chair); add(box(0.45, 0.06, 0.45), M.dark, chair, 0, 0.5, 0); add(box(0.45, 0.45, 0.06), M.dark, chair, 0, 0.78, -0.2); add(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 12), M.alu, chair, 0, 0.25, 0); for (let i = 0; i < 5; i++) { const a = i * 1.2566; add(box(0.28, 0.025, 0.04), M.dark, chair, Math.cos(a) * 0.14, 0.03, Math.sin(a) * 0.14).rotation.y = -a; }

  // ── redraw helpers for live screens ──
  const mono = (c: CanvasRenderingContext2D, s: number) => { c.font = `700 ${s}px ui-monospace,Menlo,monospace`; };
  const drawScreen = (p: Panel, s: any) => {
    const on = p.name === 'clock' ? s.clock.power : p.name === 'vna' ? s.vna.power : p.name === 'scope' ? s.scope.power : p.name === 'ldv' ? s.ldv.power : s.facility.power;
    (p.led.material as THREE.MeshBasicMaterial).color.set(on && s.facility.power ? 0x22c55e : 0x334155);
    p.tex.redraw((c, w, h) => {
      c.fillStyle = on && s.facility.power ? '#06131f' : '#0a0d10'; c.fillRect(0, 0, w, h); if (!(on && s.facility.power)) return;
      c.fillStyle = '#7dd3fc'; mono(c, 15); const t = p.name === 'clock' ? 'SRS FS725 Rb' : p.name === 'vna' ? 'E5080B  S11 (dB)' : p.name === 'scope' ? 'SCOPE  CH1 CH2' : p.name === 'ldv' ? 'PSV-500 LDV' : 'DAQ'; c.fillText(t, 8, 18);
      if (p.name === 'clock') { c.fillStyle = s.clock.locked ? '#4ade80' : '#fbbf24'; mono(c, 22); c.fillText(s.clock.locked ? 'LOCKED 10 MHz' : `WARM ${Math.min(100, Math.round(s.clock.warmup / 15 * 100))}%`, 8, h - 10); }
      if (p.name === 'vna' || p.name === 'scope') {
        const tr = p.name === 'vna' ? (s.vna.trace || []).map((q: any) => q.s11) : (s.scope.trace || []).map((q: any) => q.value);
        c.strokeStyle = '#1e3a52'; c.lineWidth = 1; for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(0, (h * i) / 5); c.lineTo(w, (h * i) / 5); c.stroke(); }
        if (tr.length > 1) { const lo = Math.min(...tr), hi = Math.max(...tr), sp = hi - lo || 1; c.strokeStyle = p.name === 'vna' ? '#38bdf8' : '#facc15'; c.lineWidth = 2; c.beginPath(); tr.forEach((v: number, i: number) => { const x = (i / (tr.length - 1)) * w, y = h - 8 - ((v - lo) / sp) * (h - 34); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); }
        else { c.fillStyle = '#64748b'; mono(c, 14); c.fillText(p.name === 'vna' ? (s.vna.rf ? 'sweeping…' : 'RF OFF') : (s.scope.running ? 'running' : 'stopped'), 8, h / 2 + 6); }
      }
      if (p.name === 'ldv') { c.fillStyle = s.ldv.shutter ? '#4ade80' : '#94a3b8'; mono(c, 18); c.fillText(s.ldv.shutter ? `RETURN ${Math.round((s.ldv.laserReturn || 0) * 100)}%` : 'SHUTTER CLOSED', 8, h - 12); }
      if (p.name === 'daq') { c.fillStyle = '#e2e8f0'; mono(c, 16); c.fillText(`records ${(s.experiment.records || []).length}`, 8, h - 10); }
    });
  };
  const drawMonitor = (s: any) => monTex.redraw((c, w, h) => {
    c.fillStyle = '#f4f7fa'; c.fillRect(0, 0, w, h); c.fillStyle = '#1f6feb'; c.fillRect(0, 0, w, 38); c.fillStyle = '#fff'; c.font = '700 22px system-ui'; c.fillText('SPHERE Acquisition', 14, 26);
    const e = s.experiment; c.fillStyle = '#1f3a5f'; c.font = '600 22px system-ui'; c.fillText(e.scanActive ? 'Scan in progress' : (e.records || []).length ? 'Scan complete' : 'Idle', 14, 80);
    c.fillStyle = '#d6dde5'; c.fillRect(14, 96, w - 28, 18); c.fillStyle = '#22c55e'; c.fillRect(14, 96, (w - 28) * (e.scanProgress || 0), 18);
    c.fillStyle = '#51647a'; c.font = '500 20px ui-monospace,monospace'; c.fillText(`records: ${(e.records || []).length}`, 14, 150); c.fillText(`accepted ${e.acceptedPoints || 0}  suspect ${e.suspectPoints || 0}  failed ${e.failedPoints || 0}`, 14, 180);
    const pts = (e.records || []).slice(-40).map((r: any) => r.resonanceShift || 0); if (pts.length > 1) { const lo = Math.min(...pts), hi = Math.max(...pts), sp = hi - lo || 1; c.strokeStyle = '#1f6feb'; c.lineWidth = 2; c.beginPath(); pts.forEach((v: number, i: number) => { const x = 14 + (i / (pts.length - 1)) * (w - 28), y = 280 - ((v - lo) / sp) * 70; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); }
  });
  const drawGauge = (s: any) => lcd.redraw((c, w, h) => {
    c.fillStyle = '#071018'; c.fillRect(0, 0, w, h); c.fillStyle = '#7dd3fc'; c.font = '700 20px ui-monospace,monospace'; c.fillText('PIRANI/BA', 10, 26);
    c.fillStyle = '#e2f4ff'; c.font = '800 44px ui-monospace,monospace'; const p = s.chamber.pressure; c.fillText(p >= 10 ? p.toFixed(0) : p.toExponential(1), 10, 82); c.fillStyle = '#94a3b8'; c.font = '600 20px ui-monospace,monospace'; c.fillText('Torr', 10, 114);
  });

  // ── per-frame update ──
  let acc = 0;
  const target = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let doorAng = 0, jitter = 0;
  const update = (s: any, dt: number, t: number) => {
    const c = s.chamber, st = s.stage;
    const ax = st.actualX ?? st.x, ay = st.actualY ?? st.y, az = st.actualZ ?? st.z;
    // sphere + stage axes (X lateral, Y depth, Z vertical)
    yCar.position.z = ay * STAGE_SCALE; xCar.position.x = ax * STAGE_SCALE;
    spherePos.set(ax * STAGE_SCALE, CH_Y + az * STAGE_SCALE, ay * STAGE_SCALE); sphere.position.copy(spherePos); sphereGlow.position.copy(spherePos);
    const base = CH_Y - 0.4 + 0.045 + 0.1 + 0.03, topY = spherePos.y - 0.06 - 0.01, h = Math.max(0.05, topY - 0.07 - base);
    column.scale.y = h;
    column.position.y = (base - (CH_Y - 0.4 + 0.045)) + h / 2;
    bellows.forEach((b, i) => { b.position.y = (base - (CH_Y - 0.4 + 0.045)) + ((i + 0.5) / bellows.length) * h; });
    post.position.y = (topY - 0.035) - (CH_Y - 0.4 + 0.045);
    // commanded target marker
    const moving = st.moving || st.settling; (ghost.material as THREE.MeshBasicMaterial).opacity = moving ? 0.55 : 0; ghost.position.set(st.x * STAGE_SCALE, CH_Y + st.z * STAGE_SCALE, st.y * STAGE_SCALE);
    // door
    doorAng += ((c.doorOpen ? -1.95 : 0) - doorAng) * Math.min(1, dt * 3); doorPivot.rotation.y = doorAng;
    // temperature tint light
    const dT = c.temperature - c.targetTemp; heat.color.set(dT > 0 ? 0xff8a3d : 0x60a5fa); heat.intensity = Math.min(1.4, Math.abs(dT) * 0.5);
    (sphereGlow.material as THREE.MeshBasicMaterial).color.set(dT > 0 ? 0xff7a1a : 0x60a5fa); (sphereGlow.material as THREE.MeshBasicMaterial).opacity = Math.min(0.28, Math.abs(dT) * 0.05);
    // shielding + isolation
    farMat.opacity += ((c.faraday ? 0.13 : 0) - farMat.opacity) * Math.min(1, dt * 4);
    const isoOn = c.isolation; isoLeds.forEach(l => (l.material as THREE.MeshBasicMaterial).color.set(isoOn ? 0x22c55e : 0xef4444));
    jitter = isoOn ? jitter * 0.9 : Math.sin(t * 38) * 0.0016 + Math.sin(t * 17) * 0.001; bench.position.y = jitter; stageRoot.position.y = CH_Y; 
    // pumps
    const rpm = (c.turboRpm || 0) / 100; turboFan.rotation.y += rpm * dt * 40; rough.position.x = 1.05 + ((c.roughingRpm || 0) > 1 ? Math.sin(t * 60) * 0.0012 : 0);
    ventMat.emissiveIntensity = c.vent ? 1.2 : 0;
    // laser
    const on = s.ldv.power && s.ldv.shutter; laser.visible = laserGlow.visible = dot.visible = on;
    if (on) { const a = new THREE.Vector3(0, 1.725, 0), b = spherePos.clone(); b.y += 0.058 * 0.95; const d = b.clone().sub(a), len = d.length(); for (const m of [laser, laserGlow]) { m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(1, len, 1); m.quaternion.setFromUnitVectors(up, d.clone().normalize()); } laserGlowMat.opacity = 0.18 + Math.sin(t * 30) * 0.04; dot.position.copy(b); }
    // RF
    const rf = s.vna.power && s.vna.rf; rfMat.emissiveIntensity = rf ? 1.2 + Math.sin(t * 8) * 0.4 : 0;
    (rfPulse.material as THREE.MeshBasicMaterial).opacity = rf ? 0.9 : 0; if (rf) rfPulse.position.copy(rfCurve.getPoint((t * 0.5) % 1));
    // beacon + chamber lamp
    const crit = (s.alarms || []).some((a: any) => !a.acknowledged && a.severity === 'critical'), warn = (s.alarms || []).some((a: any) => !a.acknowledged);
    const lvl = !s.facility.power ? -1 : crit ? 2 : warn || c.doorOpen || !c.faraday || !c.isolation ? 1 : 0; const blink = lvl === 2 ? (Math.sin(t * 9) > 0 ? 1 : 0.15) : 1;
    beacon.forEach((m, i) => { m.emissiveIntensity = (lvl === i ? 1.6 * blink : 0.08); });
    lamp.intensity = c.doorOpen ? 3.2 : 2.2;
    // slow refresh of the canvases
    acc += dt; if (acc > 0.25) { acc = 0; panels.forEach(p => drawScreen(p, s)); drawMonitor(s); drawGauge(s); }
  };

  const anchors: Record<string, THREE.Vector3> = {
    chamber: new THREE.Vector3(0, CH_Y, 0.2), door: new THREE.Vector3(-0.3, CH_Y, 0.7), stage: spherePos, rack: new THREE.Vector3(-3.15, 1.2, -0.4), bench: new THREE.Vector3(2.7, 1.2, -1.9), board: new THREE.Vector3(-0.2, 1.7, -2.5),
  };
  setCutaway(true);
  update({
    chamber: { pressure: 760, temperature: 21, targetTemp: 20, vent: true, doorOpen: false, faraday: true, isolation: true, turboRpm: 0, roughingRpm: 0 }, stage: { x: 0, y: 0, z: 0 },
    vna: { power: false }, ldv: { power: false }, clock: { power: false }, scope: { power: false }, facility: { power: false }, experiment: {}, alarms: [],
  }, 0.016, 0);
  const dispose = () => { disposables.forEach(d => { try { d.dispose(); } catch { /* already disposed */ } }); for (const t2 of [floorTex.tex, wb.tex, sign.tex, lcd.tex, monTex.tex, holes.tex, ...panels.map(p => p.tex.tex)]) t2.dispose(); };
  void target; void sl; void wl; void back; void left; void bez; void win; void dRing; void dBody; void topPort; void leftPort1; void leftPort2; void rightPort; void capOut; void cap; void liner; void shell; void fl;
  return { scene, update, setCutaway, dispose, spherePos, anchors };
}

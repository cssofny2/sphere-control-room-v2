import * as THREE from 'three';
import { canvasTex, blobShadowTex } from './labUtil';

// Extra furniture and equipment that makes the room read as a working laboratory: a right-hand wall with a fume hood,
// a bench with a sink, an eyewash station and a storage cabinet, plus floor items (tool chest, bins, stools, a gas
// cylinder rack, a coat rack), overhead ductwork and wall fittings. Everything here is static, so the static-mesh merge
// fuses it. Glass is transparent and is left alone by the merge on purpose.

export type PropsCtx = {
  scene: THREE.Scene; room: THREE.Group; M: Record<string, THREE.Material>;
  track: <T extends { dispose: () => void }>(o: T) => T;
  add: (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x?: number, y?: number, z?: number, shadow?: boolean) => THREE.Mesh;
  box: (w: number, h: number, d: number) => THREE.BoxGeometry;
};

export function buildProps(ctx: PropsCtx): { dispose: () => void } {
  const { scene, room, M, track, add, box } = ctx;
  const texs: { dispose: () => void }[] = [];
  const std = (o: THREE.MeshStandardMaterialParameters) => track(new THREE.MeshStandardMaterial(o));
  const basic = (o: THREE.MeshBasicMaterialParameters) => track(new THREE.MeshBasicMaterial(o));
  const cyl = (rt: number, rb: number, h: number, seg = 20) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const sign = (text: string, w: number, h: number, bg: string, fg: string, parent: THREE.Object3D, x: number, y: number, z: number, ry = 0) => {
    const t = canvasTex(256, Math.max(32, Math.round(256 * h / w)), (c, W, H) => { c.fillStyle = bg; c.fillRect(0, 0, W, H); c.fillStyle = fg; c.font = `800 ${Math.round(H * 0.46)}px system-ui,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, W / 2, H / 2 + 1); }); texs.push(t.tex);
    const m = new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), basic({ map: t.tex })); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m;
  };
  const blob = blobShadowTex(); texs.push(blob);
  const blobMat = basic({ map: blob, transparent: true, depthWrite: false, opacity: 0.85 });
  const decal = (x: number, z: number, w: number, d: number) => { const m = new THREE.Mesh(track(new THREE.PlaneGeometry(w, d)), blobMat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.008, z); m.renderOrder = 1; room.add(m); };

  const cabinetPaint = std({ color: 0xdde3ea, metalness: 0.2, roughness: 0.45 });
  const benchTop = std({ color: 0x2c3138, roughness: 0.35, metalness: 0.1 });            // epoxy resin worktop
  const steel = M.steel as THREE.Material, alu = M.alu as THREE.Material, dark = M.dark as THREE.Material, glass = M.glass as THREE.Material;
  const yellow = std({ color: 0xf2c200, roughness: 0.5 }), green = std({ color: 0x2e9b5a, roughness: 0.5 }), redM = M.red as THREE.Material;
  const blueM = M.blue as THREE.Material, white = M.white as THREE.Material, rubber = M.rubber as THREE.Material;

  // ── right-hand wall ──
  const RX = 5.95;
  const wallMat = M.wall as THREE.Material;
  const right = add(new THREE.PlaneGeometry(12, 3.6), wallMat, room, RX, 1.8, 0.5, false); right.rotation.y = -Math.PI / 2;
  add(box(0.02, 1.2, 12), std({ color: 0xdfe4ea, roughness: 0.7 }), room, RX - 0.01, 0.6, 0.5, false);
  add(box(0.03, 0.1, 12), std({ color: 0x2a6fdb, roughness: 0.6 }), room, RX - 0.015, 1.25, 0.5, false);

  // fume hood with a sash window and a service fixture
  { const g = new THREE.Group(); g.position.set(RX - 0.45, 0, -0.6); g.rotation.y = -Math.PI / 2; room.add(g);
    add(box(1.5, 0.82, 0.8), cabinetPaint, g, 0, 0.41, 0); add(box(1.56, 0.05, 0.86), benchTop, g, 0, 0.845, 0);
    for (const x of [-0.37, 0.37]) { add(box(0.7, 0.7, 0.02), alu, g, x, 0.4, 0.41, false); add(box(0.04, 0.12, 0.03), steel, g, x + (x < 0 ? 0.28 : -0.28), 0.5, 0.43, false); }
    add(box(1.5, 1.45, 0.06), cabinetPaint, g, 0, 1.6, -0.37);                                 // back panel
    for (const x of [-0.73, 0.73]) add(box(0.06, 1.45, 0.78), cabinetPaint, g, x, 1.6, 0);      // sides
    add(box(1.56, 0.34, 0.86), cabinetPaint, g, 0, 2.5, 0);                                     // header
    add(box(1.3, 0.05, 0.05), alu, g, 0, 2.3, 0.4, false);
    add(box(1.3, 0.8, 0.012), glass, g, 0, 1.78, 0.38, false);                                  // raised sash
    add(box(1.34, 0.04, 0.05), alu, g, 0, 1.36, 0.4, false);
    add(cyl(0.012, 0.012, 0.3, 10), steel, g, -0.5, 1.15, -0.2).rotation.x = Math.PI / 2;        // gas cock
    add(cyl(0.02, 0.02, 0.07, 12), redM, g, -0.5, 1.15, -0.04).rotation.x = Math.PI / 2;
    add(cyl(0.2, 0.2, 0.5, 20), cabinetPaint, g, 0, 2.95, -0.1);                                 // exhaust duct up to the ceiling
    sign('FUME HOOD', 0.6, 0.12, '#1f3a5f', '#ffffff', g, 0, 2.5, 0.435);
    // glassware on the hood floor
    add(cyl(0.06, 0.06, 0.09, 16), white, g, 0.3, 0.91, 0.05); add(new THREE.SphereGeometry(0.07, 16, 12), glass, g, 0.12, 0.93, 0.05, false);
    add(cyl(0.035, 0.035, 0.2, 16), glass, g, -0.2, 0.97, 0.1, false); add(cyl(0.03, 0.03, 0.18, 16), M.blue as THREE.Material, g, -0.12, 0.96, 0.12, false);
    decal(RX - 0.5, -0.6, 1.2, 1.6); }

  // bench with a sink, gooseneck tap, paper towels and soap
  { const g = new THREE.Group(); g.position.set(RX - 0.4, 0, 1.55); g.rotation.y = -Math.PI / 2; room.add(g);
    add(box(1.8, 0.86, 0.7), cabinetPaint, g, 0, 0.43, 0); add(box(1.86, 0.04, 0.76), benchTop, g, 0, 0.88, 0);
    for (let i = 0; i < 3; i++) { add(box(0.54, 0.74, 0.01), alu, g, -0.58 + i * 0.58, 0.43, 0.355, false); add(box(0.1, 0.012, 0.012), dark, g, -0.58 + i * 0.58, 0.68, 0.365, false); }
    add(box(0.5, 0.012, 0.36), steel, g, 0.45, 0.906, -0.05, false); add(box(0.46, 0.05, 0.32), dark, g, 0.45, 0.89, -0.05, false);   // sink basin
    add(cyl(0.015, 0.015, 0.34, 10), steel, g, 0.45, 1.07, -0.28); const sp = add(new THREE.TorusGeometry(0.1, 0.014, 8, 16, Math.PI), steel, g, 0.45, 1.24, -0.2, false); sp.rotation.y = Math.PI / 2; sp.rotation.z = 0;
    add(cyl(0.025, 0.025, 0.1, 12), white, g, 0.12, 0.96, -0.2); add(cyl(0.012, 0.012, 0.04, 8), blueM, g, 0.12, 1.03, -0.2);
    add(box(0.26, 0.28, 0.12), white, g, -0.75, 1.5, -0.33); add(box(0.2, 0.03, 0.02), dark, g, -0.75, 1.38, -0.28);      // towel dispenser on the back wall
    add(box(1.7, 0.03, 0.2), alu, g, 0, 1.55, -0.35, false);                                                              // reagent shelf
    for (let i = 0; i < 6; i++) add(cyl(0.035, 0.035, 0.16, 14), i % 3 === 0 ? std({ color: 0x8a5a2b, roughness: 0.4 }) : i % 3 === 1 ? (glass) : white, g, -0.7 + i * 0.22, 1.64, -0.35, i % 3 !== 1);
    decal(RX - 0.45, 1.55, 0.9, 2.0); }

  // eyewash and drench shower
  { const g = new THREE.Group(); g.position.set(RX - 0.35, 0, 3.0); g.rotation.y = -Math.PI / 2; room.add(g);
    add(cyl(0.025, 0.025, 2.3, 12), green, g, 0, 1.15, -0.1); add(cyl(0.12, 0.12, 0.03, 20), green, g, 0, 2.28, -0.1); add(new THREE.TorusGeometry(0.14, 0.012, 8, 20), steel, g, 0, 2.2, -0.1).rotation.x = Math.PI / 2;
    add(cyl(0.12, 0.14, 0.06, 20), green, g, 0.0, 0.95, 0.0); add(cyl(0.1, 0.1, 0.02, 20), steel, g, 0, 0.99, 0.0); add(cyl(0.01, 0.01, 0.4, 8), steel, g, 0.0, 1.0, -0.05).rotation.z = 0;
    add(box(0.02, 0.02, 0.5), yellow, g, 0.1, 1.6, 0.15, false); add(new THREE.TorusGeometry(0.06, 0.012, 8, 14), yellow, g, 0.1, 1.6, 0.4, false);   // pull rod and triangle
    sign('EYEWASH', 0.4, 0.1, '#2e9b5a', '#ffffff', g, 0, 2.0, 0.0); decal(RX - 0.4, 3.0, 0.8, 0.8); }

  // tall storage cabinet with glass doors and bottles, on the back wall to the right
  { const g = new THREE.Group(); g.position.set(5.2, 0, -2.3); room.add(g);
    add(box(0.95, 2.0, 0.5), cabinetPaint, g, 0, 1.0, 0); add(box(0.9, 1.4, 0.012), glass, g, 0, 1.35, 0.26, false);
    for (const y of [0.6, 1.0, 1.4, 1.8]) add(box(0.86, 0.02, 0.44), alu, g, 0, y, 0, false);
    const cols = [0xc89a62, 0x2e9b5a, 0xdfe6ee, 0x1f6feb, 0xd62d2d, 0xf2c200];
    for (const y of [0.62, 1.02, 1.42]) for (let i = 0; i < 6; i++) { const c = cols[(i + Math.round(y * 5)) % cols.length]; add(cyl(0.04, 0.04, 0.2 + (i % 3) * 0.04, 12), std({ color: c, roughness: 0.4 }), g, -0.36 + i * 0.145, y + 0.11, 0.0, false); }
    add(box(0.9, 0.5, 0.012), alu, g, 0, 0.3, 0.26, false); add(box(0.12, 0.03, 0.02), dark, g, 0.3, 0.3, 0.275, false);
    sign('CHEMICAL STORAGE', 0.7, 0.1, '#d62d2d', '#ffffff', g, 0, 2.06, 0.26); decal(5.2, -2.1, 1.2, 0.8); }

  // ── floor items ──
  // rolling tool chest
  { const g = new THREE.Group(); g.position.set(-4.0, 0, 2.3); g.rotation.y = Math.PI / 2; room.add(g);
    add(box(0.7, 0.9, 0.45), redM, g, 0, 0.55, 0); add(box(0.74, 0.04, 0.49), steel, g, 0, 1.02, 0);
    for (let i = 0; i < 5; i++) { add(box(0.62, 0.003, 0.01), dark, g, 0, 0.24 + i * 0.16, 0.226, false); add(box(0.22, 0.02, 0.02), steel, g, 0, 0.3 + i * 0.16, 0.235, false); }
    for (const x of [-0.3, 0.3]) for (const z of [-0.18, 0.18]) add(cyl(0.05, 0.05, 0.04, 14), rubber, g, x, 0.07, z, false).rotation.z = Math.PI / 2;
    decal(-4.0, 2.3, 0.9, 0.7); }
  // waste and recycling bins
  for (const [x, z, c] of [[-4.1, 3.4, 0x2b6cb0], [-4.1, 3.9, 0x4a4f57], [-3.6, 3.7, 0xd69e2e]] as number[][]) { const m = std({ color: c, roughness: 0.6 }); add(cyl(0.2, 0.17, 0.55, 20), m, room, x, 0.28, z); add(cyl(0.21, 0.21, 0.03, 20), m, room, x, 0.57, z, false); add(box(0.12, 0.02, 0.05), dark, room, x, 0.6, z + 0.12, false); decal(x, z, 0.6, 0.6); }
  // stools
  for (const [x, z] of [[4.6, 0.8], [4.9, 2.1], [0.9, 1.9]] as number[][]) { add(cyl(0.19, 0.19, 0.06, 20), dark, room, x, 0.66, z); add(cyl(0.025, 0.025, 0.62, 10), steel, room, x, 0.33, z, false); add(cyl(0.2, 0.2, 0.025, 5), dark, room, x, 0.04, z, false); decal(x, z, 0.55, 0.55); }
  // gas cylinder rack by the right wall (three cylinders on a chain)
  { const g = new THREE.Group(); g.position.set(RX - 0.3, 0, 4.4); room.add(g);
    add(box(0.08, 1.5, 0.9), steel, g, 0.16, 0.75, 0, false); add(box(0.035, 0.035, 0.9), dark, g, 0.1, 1.2, 0, false);
    for (const [z, c] of [[-0.28, 0x2e9b5a], [0, 0xc9ced4], [0.28, 0x1f6feb]] as number[][]) { const cy = std({ color: c, metalness: 0.5, roughness: 0.4 }); add(cyl(0.11, 0.11, 1.35, 20), cy, g, -0.0, 0.7, z); add(new THREE.SphereGeometry(0.11, 16, 10), cy, g, 0, 1.38, z); add(cyl(0.025, 0.025, 0.1, 10), steel, g, 0, 1.5, z, false); add(cyl(0.04, 0.04, 0.03, 10), redM, g, 0, 1.57, z, false); }
    decal(RX - 0.35, 4.4, 0.9, 1.1); }
  // coat rack with a spare lab coat and goggles
  { const g = new THREE.Group(); g.position.set(-4.0, 0, 4.7); room.add(g);
    add(cyl(0.03, 0.03, 1.7, 10), dark, g, 0, 0.85, 0); add(cyl(0.2, 0.22, 0.04, 20), dark, g, 0, 0.02, 0, false);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; add(box(0.2, 0.02, 0.02), steel, g, Math.cos(a) * 0.1, 1.68, Math.sin(a) * 0.1, false).rotation.y = -a; }
    add(box(0.42, 0.9, 0.12), std({ color: 0xf3f5f7, roughness: 0.9 }), g, 0.22, 1.2, 0.0, false); add(box(0.14, 0.14, 0.08), std({ color: 0x2b2f36, roughness: 0.4 }), g, -0.18, 1.62, 0.0, false);
    decal(-4.0, 4.7, 0.6, 0.6); }
  // wet-floor sign and a rubber anti-fatigue mat in front of the workstation
  add(box(0.26, 0.4, 0.008), yellow, room, 1.5, 0.21, 2.3, false).rotation.x = -0.2; add(box(0.26, 0.4, 0.008), yellow, room, 1.5, 0.21, 2.42, false).rotation.x = 0.2;
  add(box(1.2, 0.015, 0.7), std({ color: 0x23262b, roughness: 0.95 }), room, 2.7, 0.01, -0.95, false);

  // ── overhead services ──
  add(cyl(0.18, 0.18, 12, 24), std({ color: 0xc9d0d8, metalness: 0.6, roughness: 0.45 }), room, 0.5, 3.45, -2.1, false).rotation.z = Math.PI / 2;
  add(box(12, 0.05, 0.3), std({ color: 0x9aa3ad, metalness: 0.7, roughness: 0.5 }), room, 0.5, 3.3, -1.5, false);                       // cable tray
  for (let x = -3.5; x <= 4.5; x += 1) add(box(0.02, 0.2, 0.3), steel, room, x, 3.4, -1.5, false);
  for (let x = -3; x <= 5; x += 2) add(box(0.05, 0.05, 0.6), dark, room, x, 3.52, -1.8, false);
  // sprinkler heads
  for (const [x, z] of [[-2, 0], [2, 1], [0, -1.8], [4, 0]] as number[][]) { add(cyl(0.012, 0.012, 0.12, 8), steel, room, x, 3.5, z, false); add(cyl(0.03, 0.03, 0.01, 12), redM, room, x, 3.43, z, false); }

  // ── wall fittings ──
  { const g = new THREE.Group(); g.position.set(5.0, 1.5, -2.58); room.add(g);
    add(box(0.36, 0.28, 0.07), white, g, 0, 0, 0, false); add(box(0.12, 0.04, 0.02), redM, g, 0, 0, 0.04, false); add(box(0.04, 0.12, 0.02), redM, g, 0, 0, 0.041, false); }   // first-aid kit
  sign('EXIT', 0.36, 0.16, '#1f9d55', '#ffffff', room, 3.9, 2.95, -2.575); sign('EXIT', 0.36, 0.16, '#1f9d55', '#ffffff', room, RX - 0.01, 2.95, 4.9, -Math.PI / 2);
  { const g = new THREE.Group(); g.position.set(RX - 0.03, 1.5, 0.4); g.rotation.y = -Math.PI / 2; room.add(g);     // fire alarm pull station and a wall-mounted extinguisher
    add(box(0.12, 0.16, 0.04), redM, g, 0, 0.2, 0, false); add(cyl(0.08, 0.08, 0.5, 16), redM, g, 0, -0.45, 0.07); add(cyl(0.025, 0.025, 0.08, 10), dark, g, 0, -0.15, 0.07, false);
    sign('PULL', 0.08, 0.03, '#ffffff', '#d62d2d', g, 0, 0.2, 0.025); }
  { const t = canvasTex(256, 360, (c, W, H) => { c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.fillStyle = '#f2c200'; c.fillRect(0, 0, W, 60); c.fillStyle = '#111'; c.font = '800 28px system-ui'; c.textAlign = 'center'; c.fillText('HAZARDS', W / 2, 42);
      c.textAlign = 'left'; c.fillStyle = '#1f3a5f'; c.font = '600 19px system-ui'; ['Cryogens: gloves', 'Vacuum: shield on', 'Laser: Class 3B', 'RF: no pacemakers', 'Door: seal check', 'Eyewash: right wall'].forEach((l, i) => c.fillText(l, 18, 100 + i * 36)); }); texs.push(t.tex);
    const g = new THREE.Group(); g.position.set(RX - 0.02, 2.05, 2.2); g.rotation.y = -Math.PI / 2; room.add(g); add(box(0.5, 0.7, 0.012), white, g, 0, 0, -0.004, false);
    const m = new THREE.Mesh(track(new THREE.PlaneGeometry(0.48, 0.68)), basic({ map: t.tex })); m.position.z = 0.004; g.add(m); }
  void scene;
  return { dispose: () => texs.forEach(t => t.dispose()) };
}

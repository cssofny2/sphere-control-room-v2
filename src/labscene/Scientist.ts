import * as THREE from 'three';
import type { Focus, Mood } from './scientistBrain';

// "Dr. Wire": a see-through wireframe lab technician who wanders the lab, looks at what he is
// talking about, gestures while he speaks, and fidgets when idle so he feels like a person.

const WAYPOINTS: Record<string, [number, number]> = {
  backCenter: [0.2, -1.75], backRight: [1.8, -1.6], bench: [2.7, -1.2], backLeft: [-1.6, -1.7], rack: [-2.35, 0.15],
  frontLeft: [-1.9, 1.7], door: [-0.55, 1.75], frontRight: [1.15, 1.7], right: [2.2, 0.3], stageSpot: [0.55, 1.8],
};
const EDGES: [string, string][] = [
  ['backCenter', 'backRight'], ['backCenter', 'backLeft'], ['backRight', 'bench'], ['backRight', 'right'], ['bench', 'right'], ['right', 'frontRight'], ['frontRight', 'stageSpot'],
  ['stageSpot', 'door'], ['door', 'frontLeft'], ['frontLeft', 'rack'], ['rack', 'backLeft'], ['frontRight', 'backRight'],
];
const FOCUS_SPOT: Record<Focus, string[]> = {
  chamber: ['stageSpot', 'frontRight', 'door'], stage: ['stageSpot', 'frontRight'], door: ['door', 'stageSpot'], rack: ['rack', 'frontLeft'], bench: ['bench', 'backRight'], none: [],
};
const LOOK_AT: Record<Focus, [number, number]> = { chamber: [0, 0.3], stage: [0, 0.3], door: [-0.2, 0.6], rack: [-3.15, -0.5], bench: [2.9, -1.9], none: [0, 0] };
const OBST = { x: 0, z: 0, r: 1.25 };

const segHitsObstacle = (a: [number, number], b: [number, number]) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((OBST.x - a[0]) * dx + (OBST.z - a[1]) * dz) / l2));
  return Math.hypot(a[0] + t * dx - OBST.x, a[1] + t * dz - OBST.z) < OBST.r;
};
const adj: Record<string, string[]> = {};
for (const [a, b] of EDGES) { (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); }
const nearestNode = (p: [number, number]) => Object.keys(WAYPOINTS).reduce((best, k) => (Math.hypot(WAYPOINTS[k][0] - p[0], WAYPOINTS[k][1] - p[1]) < Math.hypot(WAYPOINTS[best][0] - p[0], WAYPOINTS[best][1] - p[1]) ? k : best));
function route(from: string, to: string): string[] {
  const prev: Record<string, string | null> = { [from]: null }; const q = [from];
  while (q.length) { const n = q.shift() as string; if (n === to) break; for (const m of adj[n] || []) if (!(m in prev)) { prev[m] = n; q.push(m); } }
  if (!(to in prev)) return [to];
  const out: string[] = []; for (let n: string | null = to; n; n = prev[n]) out.unshift(n); return out.slice(1);
}

type Joint = THREE.Group;
export class Scientist {
  root = new THREE.Group();
  private body = new THREE.Group();
  private hips: Joint = new THREE.Group(); private torso: Joint = new THREE.Group(); private neck: Joint = new THREE.Group(); private head: Joint = new THREE.Group();
  private armL: Joint = new THREE.Group(); private armR: Joint = new THREE.Group(); private foreL: Joint = new THREE.Group(); private foreR: Joint = new THREE.Group();
  private legL: Joint = new THREE.Group(); private legR: Joint = new THREE.Group(); private shinL: Joint = new THREE.Group(); private shinR: Joint = new THREE.Group();
  private coat!: THREE.Mesh;
  private mats: THREE.Material[] = []; private geos: THREE.BufferGeometry[] = [];
  private node = 'backRight';
  private path: string[] = [];
  private target: [number, number] | null = null;
  private heading = Math.PI; private wantHeading = Math.PI;
  private phase = 0; private moveBlend = 0;
  private idleUntil = 2; private nextWander = 14; private lookYaw = 0; private lookTo = 0; private nextLook = 1.5;
  private gesture: { kind: 'point' | 'scratch' | 'write' | 'wave' | 'hip'; t: number; dur: number } | null = null; private nextGesture = 5;
  private talkUntil = 0; private faceFocus: Focus = 'none'; private mood: Mood = 'neutral';
  private worry = 0;
  private clock = 0;
  reduced = false;

  constructor() {
    const lineMat = (color: number, opacity = 1) => { const m = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: opacity < 1, opacity, depthWrite: false }); this.mats.push(m); return m; };
    const fillMat = (color: number, opacity: number) => { const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }); this.mats.push(m); return m; };
    const skin = lineMat(0x1d4ed8), coatM = lineMat(0x0ea5e9, 0.85), dark = lineMat(0x0f2a5c), accent = lineMat(0xf97316);
    const fill = fillMat(0x7dd3fc, 0.10), coatFill = fillMat(0xe0f2fe, 0.16);
    const g = <T extends THREE.BufferGeometry>(geo: T) => { this.geos.push(geo); return geo; };
    const part = (geo: THREE.BufferGeometry, wire: THREE.Material, fl: THREE.Material | null, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(g(geo), wire); m.position.set(x, y, z); parent.add(m);
      if (fl) { const f2 = new THREE.Mesh(geo, fl); f2.position.copy(m.position); parent.add(f2); }
      return m;
    };
    this.root.add(this.body); this.body.add(this.hips); this.hips.position.y = 0.93;
    // legs
    for (const [side, leg, shin] of [[-1, this.legL, this.shinL], [1, this.legR, this.shinR]] as [number, Joint, Joint][]) {
      leg.position.set(side * 0.09, -0.02, 0); this.hips.add(leg);
      part(new THREE.CapsuleGeometry(0.065, 0.32, 3, 8), dark, fill, leg, 0, -0.23, 0);
      shin.position.set(0, -0.46, 0); leg.add(shin);
      part(new THREE.CapsuleGeometry(0.05, 0.34, 3, 8), dark, fill, shin, 0, -0.22, 0);
      part(new THREE.BoxGeometry(0.07, 0.04, 0.16), accent, null, shin, 0, -0.44, 0.04);
    }
    // torso
    this.torso.position.y = 0.02; this.hips.add(this.torso);
    part(new THREE.CapsuleGeometry(0.15, 0.3, 3, 10), skin, fill, this.torso, 0, 0.27, 0);
    this.coat = part(new THREE.CylinderGeometry(0.2, 0.31, 0.88, 14, 4, true), coatM, coatFill, this.torso, 0, 0.02, 0);
    part(new THREE.BoxGeometry(0.1, 0.12, 0.02), accent, null, this.torso, -0.1, 0.36, 0.17);          // pocket / badge
    // neck + head
    this.neck.position.set(0, 0.6, 0); this.torso.add(this.neck);
    part(new THREE.CylinderGeometry(0.04, 0.045, 0.1, 8), skin, null, this.neck, 0, 0.04, 0);
    this.head.position.y = 0.14; this.neck.add(this.head);
    part(new THREE.IcosahedronGeometry(0.115, 1), skin, fill, this.head, 0, 0.1, 0);
    const hair = part(new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, 1.2), dark, null, this.head, 0, 0.115, -0.005); hair.rotation.x = -0.15;
    for (const x of [-0.05, 0.05]) { const t = new THREE.Mesh(g(new THREE.TorusGeometry(0.032, 0.005, 6, 16)), accent); t.position.set(x, 0.11, 0.108); this.head.add(t); }
    // arms
    for (const [side, arm, fore] of [[-1, this.armL, this.foreL], [1, this.armR, this.foreR]] as [number, Joint, Joint][]) {
      arm.position.set(side * 0.2, 0.5, 0); this.torso.add(arm);
      part(new THREE.CapsuleGeometry(0.045, 0.24, 3, 8), coatM, coatFill, arm, 0, -0.17, 0);
      fore.position.set(0, -0.34, 0); arm.add(fore);
      part(new THREE.CapsuleGeometry(0.038, 0.24, 3, 8), coatM, coatFill, fore, 0, -0.16, 0);
      part(new THREE.SphereGeometry(0.04, 8, 6), skin, null, fore, 0, -0.34, 0);
    }
    // clipboard in the left hand
    const clip = part(new THREE.BoxGeometry(0.2, 0.26, 0.015), accent, null, this.foreL, -0.04, -0.34, 0.09); clip.rotation.set(0.2, 0.3, 0);
    this.root.position.set(WAYPOINTS.backRight[0], 0, WAYPOINTS.backRight[1]);
    this.root.rotation.y = this.heading;
  }

  get headWorld() { return this.root.localToWorld(new THREE.Vector3(0, 1.98, 0)); }
  get position() { return this.root.position; }

  say(focus: Focus, mood: Mood, textLen: number, now: number) {
    this.mood = mood; this.faceFocus = focus; this.talkUntil = this.clock + Math.min(7, 1.6 + textLen * 0.035);
    this.idleUntil = Math.max(this.idleUntil, this.clock + 3);
    const spots = FOCUS_SPOT[focus];
    if (spots.length && !this.reduced) { const dest = spots[Math.floor(Math.random() * spots.length)]; this.goTo(dest); }
    if (!this.gesture && !this.reduced) this.gesture = { kind: focus === 'none' ? (mood === 'happy' ? 'wave' : 'hip') : 'point', t: 0, dur: 1.8 };
    void now;
  }

  private goTo(name: string) {
    const from = this.path.length || this.target ? this.node : nearestNode([this.root.position.x, this.root.position.z]);
    this.node = from; const p = route(from, name);
    this.path = p; this.target = null;
  }

  dispose() { this.geos.forEach(x => x.dispose()); this.mats.forEach(x => x.dispose()); }

  update(dt: number, cameraPos: THREE.Vector3) {
    this.clock += dt; const t = this.clock;
    const pos = this.root.position;
    // pick the next step of the route
    if (!this.target && this.path.length) { const n = this.path.shift() as string; this.node = n; this.target = WAYPOINTS[n]; }
    if (!this.target && !this.path.length && t > this.nextWander && t > this.talkUntil && !this.reduced) {
      const names = Object.keys(WAYPOINTS).filter(k => k !== this.node); this.goTo(names[Math.floor(Math.random() * names.length)]); this.nextWander = t + 10 + Math.random() * 14;
    }
    let walking = false;
    if (this.target && !this.reduced) {
      const dx = this.target[0] - pos.x, dz = this.target[1] - pos.z, d = Math.hypot(dx, dz);
      if (d < 0.08) { this.target = null; this.idleUntil = t + 1 + Math.random() * 3; }
      else {
        walking = true; const sp = Math.min(d / Math.max(dt, 1e-3), 0.8); let step = sp * dt, nx = pos.x + (dx / d) * step, nz = pos.z + (dz / d) * step;
        // never walk through the chamber assembly
        const od = Math.hypot(nx - OBST.x, nz - OBST.z); if (od < OBST.r - 0.05) { const k = (OBST.r - 0.05) / (od || 1); nx = OBST.x + (nx - OBST.x) * k; nz = OBST.z + (nz - OBST.z) * k; }
        pos.x = nx; pos.z = nz; this.wantHeading = Math.atan2(dx, dz); void step; void segHitsObstacle;
      }
    } else {
      // idle: face what he is talking about, else the camera, now and then glance around
      const talking = t < this.talkUntil;
      const f = LOOK_AT[this.faceFocus];
      if (talking && this.faceFocus !== 'none') this.wantHeading = Math.atan2(f[0] - pos.x, f[1] - pos.z);
      else if (talking) this.wantHeading = Math.atan2(cameraPos.x - pos.x, cameraPos.z - pos.z);
      else if (t > this.idleUntil && Math.random() < dt * 0.15) { this.wantHeading = this.heading + (Math.random() - 0.5) * 1.6; this.idleUntil = t + 3 + Math.random() * 4; }
    }
    // smooth turning
    let dh = this.wantHeading - this.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); this.heading += dh * Math.min(1, dt * 5); this.root.rotation.y = this.heading;
    this.moveBlend += ((walking ? 1 : 0) - this.moveBlend) * Math.min(1, dt * 6);
    if (walking) this.phase += dt * 6.2;
    const w = this.moveBlend, s = Math.sin(this.phase), c = Math.cos(this.phase);
    // gait
    this.legL.rotation.x = s * 0.6 * w; this.legR.rotation.x = -s * 0.6 * w;
    this.shinL.rotation.x = Math.max(0, -c) * 0.8 * w; this.shinR.rotation.x = Math.max(0, c) * 0.8 * w;
    this.hips.position.y = 0.93 + Math.abs(c) * 0.03 * w - 0.005 * Math.sin(t * 1.6);
    this.torso.rotation.y = s * 0.1 * w; this.torso.rotation.x = 0.05 * w + (this.mood === 'worried' ? 0.06 : 0) + Math.sin(t * 1.6) * 0.012;
    const talk = t < this.talkUntil ? 1 : 0;
    // arms: swing when walking, otherwise rest / hold the clipboard / gesture
    let aLx = -s * 0.5 * w + (1 - w) * (-0.45), aRx = s * 0.5 * w + (1 - w) * 0.02, fLx = -0.9 + 0.2 * w, fRx = -0.2 * (1 - w) - 0.2 * w, aRz = 0, aLz = 0.05;
    if (talk && !walking) { aRx = -0.5 + Math.sin(t * 3.1) * 0.25; fRx = -0.9 + Math.sin(t * 4.2) * 0.3; aRz = -0.2 + Math.sin(t * 2.3) * 0.12; }
    if (this.gesture) {
      this.gesture.t += dt; const u = this.gesture.t / this.gesture.dur, e = Math.sin(Math.min(1, u) * Math.PI);
      if (u >= 1) { this.gesture = null; this.nextGesture = t + 4 + Math.random() * 6; }
      else if (!walking) {
        if (this.gesture.kind === 'point') { aRx = -1.3 * e + aRx * (1 - e); fRx = -0.15 * e + fRx * (1 - e); aRz = -0.25 * e; }
        else if (this.gesture.kind === 'wave') { aRx = -2.6 * e + aRx * (1 - e); aRz = -0.3 * e; fRx = (-0.4 + Math.sin(t * 12) * 0.5) * e + fRx * (1 - e); }
        else if (this.gesture.kind === 'scratch') { aRx = -2.2 * e + aRx * (1 - e); fRx = (-1.8 + Math.sin(t * 14) * 0.15) * e + fRx * (1 - e); }
        else if (this.gesture.kind === 'write') { aRx = -0.9 * e + aRx * (1 - e); fRx = (-1.2 + Math.sin(t * 10) * 0.1) * e + fRx * (1 - e); }
        else { aRz = -0.5 * e; aRx = 0.1; fRx = -1.1 * e + fRx * (1 - e); }
      }
    } else if (!walking && !talk && t > this.nextGesture && !this.reduced) {
      const kinds = ['scratch', 'write', 'hip', 'point'] as const; this.gesture = { kind: kinds[Math.floor(Math.random() * kinds.length)], t: 0, dur: 2 + Math.random() * 1.5 }; this.nextGesture = t + 99;
    }
    if (this.reduced) { aLx = -0.45; aRx = 0.02; }
    this.armL.rotation.set(aLx, 0, aLz); this.armR.rotation.set(aRx, 0, aRz); this.foreL.rotation.x = fLx; this.foreR.rotation.x = fRx;
    // head: look at the camera when talking, wander otherwise, nod while speaking
    this.nextLook -= dt; if (this.nextLook < 0) { this.lookTo = (Math.random() - 0.5) * 1.1; this.nextLook = 1.5 + Math.random() * 3.5; }
    this.lookYaw += (this.lookTo - this.lookYaw) * Math.min(1, dt * 3);
    let yaw = this.lookYaw;
    if (talk) { const toCam = Math.atan2(cameraPos.x - pos.x, cameraPos.z - pos.z) - this.heading; yaw = Math.max(-1, Math.min(1, Math.atan2(Math.sin(toCam), Math.cos(toCam)))) * 0.6; }
    this.neck.rotation.y = yaw; this.head.rotation.x = (talk ? Math.sin(t * 5.5) * 0.06 : Math.sin(t * 0.8) * 0.02) + (this.mood === 'worried' ? 0.08 : 0);
    this.head.rotation.z = this.mood === 'worried' ? Math.sin(t * 1.2) * 0.05 : 0;
    this.worry = this.mood === 'worried' && talk ? 1 : 0;
    (this.coat.material as THREE.MeshBasicMaterial).color.set(this.worry ? 0xf59e0b : 0x0ea5e9);
    this.torso.scale.set(1, 1 + Math.sin(t * 1.9) * 0.006, 1);
  }
}

import * as THREE from 'three';
import type { Focus, Mood } from './scientistBrain';
import type { PhoneRig } from './labDetail';

// "Dr. Wire": a see-through wireframe lab technician with a skeleton (hips, spine, two-bone arms and
// legs solved with inverse kinematics), hands with fingers, a face that blinks and talks, a lab coat,
// goggles and a badge. He walks around the lab on a waypoint graph, sits at the workstation, uses real
// stations (gauge, notebook, rack knob, door seal, laser head, phone) and fidgets when idle.

const WAYPOINTS: Record<string, [number, number]> = {
  backCenter: [0.2, -1.75], backRight: [1.8, -1.6], bench: [2.7, -1.2], backLeft: [-1.6, -1.7], rack: [-2.35, 0.15],
  frontLeft: [-1.9, 1.7], door: [-0.55, 1.75], frontRight: [1.15, 1.7], right: [2.2, 0.3], stageSpot: [0.55, 1.8],
  leftSide: [-1.55, -0.3], benchLeft: [2.3, -1.25], chair: [2.9, -0.65], phone: [1.3, -2.05],
};
const EDGES: [string, string][] = [
  ['backCenter', 'backRight'], ['backCenter', 'backLeft'], ['backRight', 'bench'], ['backRight', 'right'], ['bench', 'right'], ['right', 'frontRight'], ['frontRight', 'stageSpot'],
  ['stageSpot', 'door'], ['door', 'frontLeft'], ['frontLeft', 'rack'], ['rack', 'backLeft'], ['frontRight', 'backRight'],
  ['leftSide', 'rack'], ['leftSide', 'backLeft'], ['leftSide', 'frontLeft'], ['benchLeft', 'bench'], ['benchLeft', 'backRight'], ['chair', 'bench'], ['chair', 'right'],
  ['phone', 'backCenter'], ['phone', 'backRight'],
];
const FOCUS_SPOT: Record<Focus, string[]> = {
  chamber: ['stageSpot', 'frontRight', 'door'], stage: ['stageSpot', 'frontRight'], door: ['door', 'stageSpot'], rack: ['rack', 'frontLeft'], bench: ['bench', 'backRight'], none: [],
};
const LOOK_AT: Record<Focus, [number, number]> = { chamber: [0, 0.3], stage: [0, 0.3], door: [-0.2, 0.6], rack: [-3.15, -0.5], bench: [2.9, -1.9], none: [0, 0] };
const OBST = { x: 0, z: 0, r: 1.25 };
const SIT_SPOT = { x: 2.9, z: -1.18, heading: Math.PI };

export type GestureKind = 'point' | 'scratch' | 'write' | 'wave' | 'hip' | 'watch' | 'sip' | 'cross' | 'type' | 'knob' | 'readGauge' | 'inspect' | 'pointUp' | 'stretch' | 'reachPhone' | 'nod';
export type StationName = 'gauge' | 'notebook' | 'rackKnob' | 'workstation' | 'doorSeal' | 'laser' | 'phone' | 'stage' | 'board';
export type SciMode = 'idle' | 'wander' | 'goto' | 'gesture' | 'phone' | 'task' | 'react';
const STATIONS: Record<StationName, { node: string; look: string; gesture: GestureKind; sit?: boolean }> = {
  gauge: { node: 'leftSide', look: 'gauge', gesture: 'readGauge' },
  notebook: { node: 'benchLeft', look: 'notebook', gesture: 'write' },
  rackKnob: { node: 'rack', look: 'rackKnob', gesture: 'knob' },
  workstation: { node: 'chair', look: 'monitor', gesture: 'type', sit: true },
  doorSeal: { node: 'door', look: 'doorEdge', gesture: 'inspect' },
  laser: { node: 'stageSpot', look: 'ldvHead', gesture: 'pointUp' },
  phone: { node: 'phone', look: 'phone', gesture: 'reachPhone' },
  stage: { node: 'stageSpot', look: 'stage', gesture: 'point' },
  board: { node: 'backCenter', look: 'board', gesture: 'point' },
};

const segHitsObstacle = (a: [number, number], b: [number, number]) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((OBST.x - a[0]) * dx + (OBST.z - a[1]) * dz) / l2));
  return Math.hypot(a[0] + t * dx - OBST.x, a[1] + t * dz - OBST.z) < OBST.r;
};
void segHitsObstacle;
const adj: Record<string, string[]> = {};
for (const [a, b] of EDGES) { (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); }
const nearestNode = (p: [number, number]) => Object.keys(WAYPOINTS).reduce((best, k) => (Math.hypot(WAYPOINTS[k][0] - p[0], WAYPOINTS[k][1] - p[1]) < Math.hypot(WAYPOINTS[best][0] - p[0], WAYPOINTS[best][1] - p[1]) ? k : best));
function route(from: string, to: string): string[] {
  const prev: Record<string, string | null> = { [from]: null }; const q = [from];
  while (q.length) { const n = q.shift() as string; if (n === to) break; for (const m of adj[n] || []) if (!(m in prev)) { prev[m] = n; q.push(m); } }
  if (!(to in prev)) return [to];
  const out: string[] = []; for (let n: string | null = to; n; n = prev[n]) out.unshift(n); return out.slice(1);
}

const DOWN = new THREE.Vector3(0, -1, 0);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (u: number) => { const c = clamp(u, 0, 1); return c * c * (3 - 2 * c); };

type Act = { start?: () => void; tick?: (dt: number) => void; done: () => boolean; end?: () => void; resolve: (ok: boolean) => void };
type Gesture = { kind: GestureKind; t: number; dur: number; target: THREE.Vector3 | null };
type Finger = { joints: THREE.Group[] };
type Hand = { root: THREE.Group; fingers: Finger[]; thumb: Finger; curl: number; wantCurl: number; indexOut: boolean };

export class Scientist {
  root = new THREE.Group();
  private body = new THREE.Group(); private hips = new THREE.Group(); private torso = new THREE.Group(); private neck = new THREE.Group(); private head = new THREE.Group(); private jaw = new THREE.Group();
  private armU: THREE.Group[] = [new THREE.Group(), new THREE.Group()]; private armL: THREE.Group[] = [new THREE.Group(), new THREE.Group()];
  private legU: THREE.Group[] = [new THREE.Group(), new THREE.Group()]; private legL: THREE.Group[] = [new THREE.Group(), new THREE.Group()]; private foot: THREE.Group[] = [new THREE.Group(), new THREE.Group()];
  private hands: Hand[] = [];
  private coat!: THREE.Mesh; private eyes: THREE.Mesh[] = []; private brows: THREE.Mesh[] = []; private mouth!: THREE.Mesh; private goggles = new THREE.Group(); private mug = new THREE.Mesh(); private clip = new THREE.Mesh();
  private detail = new THREE.Group();
  private mats: THREE.Material[] = []; private geos: THREE.BufferGeometry[] = [];
  private node = 'backRight'; private path: string[] = []; private target: [number, number] | null = null;
  private heading = Math.PI; private wantHeading = Math.PI; private phase = 0; private moveBlend = 0; private lastStepSign = 1;
  private idleUntil = 2; private nextWander = 14; private lookYaw = 0; private lookTo = 0; private nextLook = 1.5; private nextBlink = 2; private blink = 0;
  private gesture: Gesture | null = null; private nextGesture = 5; private talkUntil = 0; private faceFocus: Focus = 'none'; private mood: Mood = 'neutral';
  private clock = 0; private posture = 0; private postureWant = 0; private seated = false; private lean = 0;
  private armPos = [new THREE.Vector3(-0.17, 1.02, 0.22), new THREE.Vector3(0.25, 0.82, 0.05)];
  private queue: Act[] = []; private cur: Act | null = null;
  private lastPos = new THREE.Vector3(); private vel = new THREE.Vector3(); private coatSpring = new THREE.Vector2(); private stopLean = 0;
  private world: Record<string, THREE.Vector3> = {};
  private phoneRig: PhoneRig | null = null; private holdPhone = false; private phoneReach = 0; private taskLock = false; private lastSayAt = -99;
  mouthLevel = 0; speakingExternal = false; timeScale = 1;
  reduced = false; laserOn = false; wander = true;
  onStep: ((side: number) => void) | null = null;
  onEvent: ((name: string) => void) | null = null;

  constructor() {
    const lineMat = (color: number, opacity = 1) => { const m = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: opacity < 1, opacity, depthWrite: false }); this.mats.push(m); return m; };
    const fillMat = (color: number, opacity: number) => { const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }); this.mats.push(m); return m; };
    const skin = lineMat(0x1d4ed8), coatM = lineMat(0x0ea5e9, 0.85), dark = lineMat(0x0f2a5c), accent = lineMat(0xf97316), glove = lineMat(0x2563eb), glass = lineMat(0x0891b2);
    const fill = fillMat(0x7dd3fc, 0.1), coatFill = fillMat(0xe0f2fe, 0.16), gFill = fillMat(0x67e8f9, 0.25);
    const g = <T extends THREE.BufferGeometry>(geo: T) => { this.geos.push(geo); return geo; };
    const part = (geo: THREE.BufferGeometry, wire: THREE.Material, fl: THREE.Material | null, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(g(geo), wire); m.position.set(x, y, z); parent.add(m);
      if (fl) { const f2 = new THREE.Mesh(geo, fl); f2.position.copy(m.position); parent.add(f2); }
      return m;
    };
    this.root.add(this.body); this.body.add(this.hips); this.hips.position.y = 0.93;
    part(new THREE.BoxGeometry(0.3, 0.14, 0.2), dark, fill, this.hips, 0, 0, 0); // pelvis
    // legs: thigh, shin, shoe (two-bone IK, joints hang along -Y)
    for (const i of [0, 1]) {
      const side = i ? 1 : -1; const U = this.legU[i], Lw = this.legL[i], F = this.foot[i];
      U.position.set(side * 0.09, -0.02, 0); this.hips.add(U); part(new THREE.CapsuleGeometry(0.068, 0.3, 3, 8), dark, fill, U, 0, -0.215, 0);
      Lw.position.set(0, -0.43, 0); U.add(Lw); part(new THREE.CapsuleGeometry(0.05, 0.3, 3, 8), dark, fill, Lw, 0, -0.205, 0);
      F.position.set(0, -0.41, 0); Lw.add(F); part(new THREE.BoxGeometry(0.085, 0.06, 0.2), accent, fill, F, 0, -0.03, 0.045);
    }
    // torso (spine) + coat
    this.torso.position.y = 0.02; this.hips.add(this.torso);
    part(new THREE.CapsuleGeometry(0.15, 0.3, 3, 10), skin, fill, this.torso, 0, 0.27, 0);
    this.coat = part(new THREE.CylinderGeometry(0.2, 0.33, 0.9, 16, 4, true), coatM, coatFill, this.torso, 0, 0.0, 0);
    part(new THREE.BoxGeometry(0.34, 0.1, 0.2), coatM, null, this.torso, 0, 0.52, 0);  // shoulders
    // neck + head
    this.neck.position.set(0, 0.58, 0); this.torso.add(this.neck); part(new THREE.CylinderGeometry(0.04, 0.047, 0.1, 8), skin, null, this.neck, 0, 0.04, 0);
    this.head.position.y = 0.12; this.neck.add(this.head);
    part(new THREE.IcosahedronGeometry(0.115, 1), skin, fill, this.head, 0, 0.1, 0);
    const hair = part(new THREE.SphereGeometry(0.122, 12, 7, 0, Math.PI * 2, 0, 1.25), dark, null, this.head, 0, 0.115, -0.008); hair.rotation.x = -0.18;
    this.detail.name = 'detail'; this.torso.add(this.detail);
    // face (high detail group lives on the head)
    const face = new THREE.Group(); this.head.add(face);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(g(new THREE.SphereGeometry(0.014, 8, 6)), accent); eye.position.set(sx * 0.04, 0.112, 0.103); face.add(eye); this.eyes.push(eye);
      const brow = new THREE.Mesh(g(new THREE.BoxGeometry(0.052, 0.008, 0.01)), dark); brow.position.set(sx * 0.042, 0.142, 0.106); face.add(brow); this.brows.push(brow);
      part(new THREE.SphereGeometry(0.024, 6, 5), skin, null, face, sx * 0.116, 0.1, 0);              // ears
    }
    part(new THREE.ConeGeometry(0.016, 0.045, 5), skin, null, face, 0, 0.088, 0.122).rotation.x = Math.PI / 2;  // nose
    this.jaw.position.set(0, 0.045, 0.02); face.add(this.jaw); part(new THREE.BoxGeometry(0.09, 0.05, 0.09), skin, null, this.jaw, 0, -0.008, 0.045);
    this.mouth = new THREE.Mesh(g(new THREE.CircleGeometry(0.026, 10)), accent); this.mouth.position.set(0, 0.0, 0.092); this.jaw.add(this.mouth);
    // goggles (pushed up on the forehead until the laser is on)
    for (const sx of [-1, 1]) { const lens = part(new THREE.TorusGeometry(0.032, 0.006, 6, 14), glass, null, this.goggles, sx * 0.045, 0, 0.0); void lens; part(new THREE.CircleGeometry(0.03, 10), gFill, null, this.goggles, sx * 0.045, 0, 0.001); }
    const strap = part(new THREE.TorusGeometry(0.118, 0.004, 4, 24), glass, null, this.goggles, 0, 0, -0.105); strap.rotation.x = Math.PI / 2; strap.position.z = -0.105 + 0.105; strap.scale.set(1, 1, 1);
    this.goggles.position.set(0, 0.185, 0.105); this.goggles.rotation.x = -0.5; this.head.add(this.goggles);
    // coat details: collar, pockets, badge + lanyard, buttons
    for (const sx of [-1, 1]) { const col = part(new THREE.BoxGeometry(0.07, 0.07, 0.015), coatM, null, this.detail, sx * 0.05, 0.6, 0.12); col.rotation.set(0.25, 0, sx * -0.5); }
    for (const sx of [-1, 1]) part(new THREE.BoxGeometry(0.1, 0.09, 0.012), coatM, null, this.detail, sx * 0.13, 0.04, 0.185);
    part(new THREE.BoxGeometry(0.07, 0.09, 0.008), accent, null, this.detail, -0.1, 0.4, 0.172);
    for (const sx of [-1, 1]) { const l = part(new THREE.BoxGeometry(0.008, 0.24, 0.004), dark, null, this.detail, sx * 0.04, 0.5, 0.16); l.rotation.z = sx * 0.28; }
    for (let k = 0; k < 4; k++) part(new THREE.SphereGeometry(0.008, 5, 4), dark, null, this.detail, 0, 0.35 - k * 0.14, 0.19);
    // arms: two bones, cuffs rolled at the forearm, hands with fingers
    for (const i of [0, 1]) {
      const side = i ? 1 : -1; const U = this.armU[i], Lw = this.armL[i];
      U.position.set(side * 0.2, 0.5, 0); this.torso.add(U); part(new THREE.CapsuleGeometry(0.047, 0.2, 3, 8), coatM, coatFill, U, 0, -0.15, 0);
      Lw.position.set(0, -0.3, 0); U.add(Lw); part(new THREE.CapsuleGeometry(0.04, 0.17, 3, 8), skin, fill, Lw, 0, -0.135, 0);
      const cuff = part(new THREE.TorusGeometry(0.05, 0.01, 5, 12), coatM, null, Lw, 0, -0.03, 0); cuff.rotation.x = Math.PI / 2;   // rolled sleeve
      const hand = new THREE.Group(); hand.position.set(0, -0.27, 0); Lw.add(hand);
      part(new THREE.BoxGeometry(0.07, 0.085, 0.03), glove, fill, hand, 0, -0.045, 0);
      const fingers: Finger[] = [];
      for (let f = 0; f < 4; f++) {
        const f1 = new THREE.Group(); f1.position.set(-0.026 + f * 0.0175, -0.09, 0); hand.add(f1); part(new THREE.CapsuleGeometry(0.008, 0.02, 2, 4), glove, null, f1, 0, -0.016, 0);
        const f2 = new THREE.Group(); f2.position.set(0, -0.034, 0); f1.add(f2); part(new THREE.CapsuleGeometry(0.0075, 0.018, 2, 4), glove, null, f2, 0, -0.014, 0);
        fingers.push({ joints: [f1, f2] });
      }
      const t1 = new THREE.Group(); t1.position.set(side * -0.04, -0.045, 0.01); hand.add(t1); t1.rotation.z = side * 0.6; part(new THREE.CapsuleGeometry(0.009, 0.022, 2, 4), glove, null, t1, 0, -0.018, 0);
      const t2 = new THREE.Group(); t2.position.set(0, -0.04, 0); t1.add(t2); part(new THREE.CapsuleGeometry(0.008, 0.016, 2, 4), glove, null, t2, 0, -0.012, 0);
      this.hands.push({ root: hand, fingers, thumb: { joints: [t1, t2] }, curl: 0.3, wantCurl: 0.3, indexOut: false });
    }
    // clipboard in the left hand, coffee mug for the right
    this.clip = part(new THREE.BoxGeometry(0.2, 0.26, 0.015), accent, null, this.hands[0].root, 0.0, -0.14, 0.07); this.clip.rotation.set(0.15, 0.3, 0);
    this.mug = part(new THREE.CylinderGeometry(0.035, 0.032, 0.08, 10, 1, true), accent, null, this.hands[1].root, 0, -0.07, 0.04); this.mug.visible = false;
    this.root.position.set(WAYPOINTS.backRight[0], 0, WAYPOINTS.backRight[1]); this.root.rotation.y = this.heading; this.lastPos.copy(this.root.position);
    this.body.traverse(o => { (o as any).castShadow = false; });
  }

  // ───────────────────────── public API ─────────────────────────
  get headWorld() { return this.root.localToWorld(new THREE.Vector3(0, this.seated ? 1.62 : 1.98, 0)); }
  get position() { return this.root.position; }
  get mode(): SciMode {
    if (this.holdPhone) return 'phone'; if (this.taskLock) return 'task';
    if (this.cur) return this.target || this.path.length ? 'goto' : 'gesture';
    if (this.gesture) return 'gesture'; if (this.target || this.path.length) return 'wander'; if (this.clock - this.lastSayAt < 5) return 'react'; return 'idle';
  }
  get busy() { return !!this.cur || this.queue.length > 0 || this.holdPhone || this.taskLock; }
  get onPhone() { return this.holdPhone; }
  get nodeName() { return this.target || this.path.length ? this.node : nearestNode([this.root.position.x, this.root.position.z]); }
  isAt(node: string, tol = 0.25) { const w = WAYPOINTS[node]; return !!w && Math.hypot(w[0] - this.root.position.x, w[1] - this.root.position.z) < tol; }
  setWorld(w: Record<string, THREE.Vector3>) { this.world = w; }
  attachPhone(r: PhoneRig) { this.phoneRig = r; }
  setLOD(high: boolean) { this.detail.visible = high; this.hands.forEach(h => h.fingers.forEach(f => f.joints.forEach(j => { j.visible = high; }))); }
  setTaskLock(on: boolean) { this.taskLock = on; }

  say(focus: Focus, mood: Mood, textLen: number, now: number) {
    void now; this.mood = mood; this.faceFocus = focus; this.lastSayAt = this.clock; this.talkUntil = this.clock + Math.min(7, 1.6 + textLen * 0.035);
    this.idleUntil = Math.max(this.idleUntil, this.clock + 3);
    if (this.busy) return;
    const spots = FOCUS_SPOT[focus];
    if (spots.length && !this.reduced) { const dest = spots[Math.floor(Math.random() * spots.length)]; this.goTo(dest); }
    if (!this.gesture && !this.reduced) this.gesture = { kind: focus === 'none' ? (mood === 'happy' ? 'wave' : 'hip') : 'point', t: 0, dur: 1.8, target: null };
  }

  private enqueue(a: Omit<Act, 'resolve'>): Promise<boolean> { return new Promise<boolean>(res => { this.queue.push({ ...a, resolve: res }); }); }
  walkTo(node: string) { return this.enqueue({ start: () => { if (this.seated) this.leaveSeat(); this.goTo(node); }, done: () => !this.target && !this.path.length && !this.seatMoving() }); }
  doGesture(kind: GestureKind, dur = 2, targetName?: string) { return this.enqueue({ start: () => { const tv = targetName ? this.world[targetName] : null; this.gesture = { kind, t: 0, dur, target: tv ? tv.clone() : null }; }, done: () => this.gesture === null, end: () => { this.gesture = null; } }); }
  wait(sec: number) { let t = 0; return this.enqueue({ tick: dt => { t += dt; }, done: () => t >= sec }); }
  sitDown() { return this.enqueue({ start: () => { this.seated = true; this.postureWant = 1; }, done: () => this.posture > 0.97 || this.reduced }); }
  standUp() { return this.enqueue({ start: () => this.leaveSeat(), done: () => this.posture < 0.03 || this.reduced }); }
  /** Walk to a station, face what he is working on and perform its gesture. */
  async visit(name: StationName, dur = 2.4): Promise<boolean> {
    const st = STATIONS[name]; let ok = await this.walkTo(st.node); if (!ok) return false;
    if (st.sit) { ok = await this.sitDown(); if (!ok) return false; }
    this.lookName = st.look; ok = await this.doGesture(st.gesture, dur, st.look); if (name === 'rackKnob') this.onEvent?.('knob'); return ok;
  }
  private lookName = '';
  async pickUpPhone(): Promise<boolean> {
    const rig = this.phoneRig; if (!rig) return false;
    let ok = await this.walkTo('phone'); if (!ok) return false;
    this.lookName = 'phone'; ok = await this.doGesture('reachPhone', 1.2, 'phone'); if (!ok) return false;
    rig.takeOff(this.hands[1].root); rig.handset.position.set(0, -0.04, 0.0); rig.handset.rotation.set(Math.PI / 2, 0, 0);
    this.holdPhone = true; this.phoneReach = 0; this.onEvent?.('pickup'); await this.wait(0.7); return true;
  }
  async hangUpPhone(): Promise<boolean> {
    const rig = this.phoneRig; if (!rig || !this.holdPhone) return false;
    this.lookName = 'phone'; this.holdPhone = false; await this.doGesture('reachPhone', 1.0, 'phone'); rig.hangUp(); this.onEvent?.('hangup'); await this.wait(0.3); this.lookName = ''; return true;
  }
  cancelAll() {
    const all = [this.cur, ...this.queue].filter(Boolean) as Act[]; this.cur = null; this.queue = []; this.path = []; this.target = null; this.gesture = null;
    for (const a of all) { try { a.end?.(); } catch { /* ignore */ } a.resolve(false); }
    if (this.phoneRig && this.phoneRig.offHook && !this.holdPhone) this.phoneRig.hangUp();
  }
  /** Used by tests and the call logic: is the whole route finished? */
  get idleNow() { return !this.cur && !this.queue.length && !this.target && !this.path.length && !this.gesture; }

  // ───────────────────────── internals ─────────────────────────
  private seatMoving() { return this.seated ? this.posture < 0.97 : this.posture > 0.03; }
  private leaveSeat() { this.seated = false; this.postureWant = 0; }
  private goTo(name: string) {
    if (this.reduced) { const w = WAYPOINTS[name]; if (w) { this.root.position.set(w[0], 0, w[1]); this.node = name; this.target = null; this.path = []; } return; }
    const from = this.path.length || this.target ? this.node : nearestNode([this.root.position.x, this.root.position.z]);
    this.node = from; this.path = route(from, name); this.target = null;
    const wp = WAYPOINTS[name]; if (!this.path.length && wp && Math.hypot(wp[0] - this.root.position.x, wp[1] - this.root.position.z) > 0.15) this.path = [name];
  }
  dispose() { this.geos.forEach(x => x.dispose()); this.mats.forEach(x => x.dispose()); }

  private tq = new THREE.Quaternion(); private tv = new THREE.Vector3(); private tv2 = new THREE.Vector3(); private tv3 = new THREE.Vector3();
  /** Two-bone IK: place the end of the chain (upper+lower) at `target` (in the parent space of `upper`), elbow/knee bends toward `pole`. */
  private ik(upper: THREE.Group, lower: THREE.Group, lenU: number, lenL: number, target: THREE.Vector3, pole: THREE.Vector3) {
    const d = this.tv.copy(target).sub(upper.position); let dist = d.length(); const dir = d.normalize();
    dist = clamp(dist, Math.abs(lenU - lenL) + 0.02, lenU + lenL - 0.002);
    const a = Math.acos(clamp((lenU * lenU + dist * dist - lenL * lenL) / (2 * lenU * dist), -1, 1));
    const perp = this.tv2.copy(pole).addScaledVector(dir, -pole.dot(dir)); if (perp.lengthSq() < 1e-6) perp.set(0, 0, 1); perp.normalize();
    const eDir = this.tv3.copy(dir).multiplyScalar(Math.cos(a)).addScaledVector(perp, Math.sin(a)).normalize();
    upper.quaternion.setFromUnitVectors(DOWN, eDir);
    const lowerVec = new THREE.Vector3().copy(dir).multiplyScalar(dist).addScaledVector(eDir, -lenU).normalize().applyQuaternion(this.tq.copy(upper.quaternion).invert());
    lower.quaternion.setFromUnitVectors(DOWN, lowerVec);
  }
  private rootToTorso(v: THREE.Vector3, out: THREE.Vector3) { out.copy(v).sub(this.hips.position).sub(this.torso.position).applyQuaternion(this.tq.copy(this.torso.quaternion).invert()); return out; }
  private worldToRootLocal(w: THREE.Vector3) { return this.root.worldToLocal(w.clone()); }

  update(dt0: number, cameraPos: THREE.Vector3) {
    const dt = dt0 * this.timeScale;
    this.clock += dt; const t = this.clock; const pos = this.root.position;
    // ── actions queue ──
    if (!this.cur && this.queue.length) { this.cur = this.queue.shift() as Act; this.cur.start?.(); }
    if (this.cur) { this.cur.tick?.(dt); if (this.cur.done()) { const a = this.cur; this.cur = null; a.end?.(); a.resolve(true); } }
    const scripted = !!this.cur || this.holdPhone || this.taskLock;
    // ── routing ──
    if (!this.target && this.path.length) { const n = this.path.shift() as string; this.node = n; this.target = WAYPOINTS[n]; }
    if (!this.target && !this.path.length && !scripted && this.wander && t > this.nextWander && t > this.talkUntil && !this.reduced && !this.seated && !this.gesture) {
      const names = Object.keys(WAYPOINTS).filter(k => k !== this.node && k !== 'phone'); this.goTo(names[Math.floor(Math.random() * names.length)]); this.nextWander = t + 10 + Math.random() * 14;
    }
    let walking = false;
    if (this.target && !this.reduced) {
      const dx = this.target[0] - pos.x, dz = this.target[1] - pos.z, d = Math.hypot(dx, dz);
      if (d < 0.08) { this.target = null; this.idleUntil = t + 1 + Math.random() * 3; }
      else {
        walking = true; const sp = Math.min(d / Math.max(dt, 1e-3), 0.9); const step = sp * dt; let nx = pos.x + (dx / d) * step, nz = pos.z + (dz / d) * step;
        const od = Math.hypot(nx - OBST.x, nz - OBST.z); if (od < OBST.r - 0.05) { const k = (OBST.r - 0.05) / (od || 1); nx = OBST.x + (nx - OBST.x) * k; nz = OBST.z + (nz - OBST.z) * k; }
        pos.x = nx; pos.z = nz; this.wantHeading = Math.atan2(dx, dz);
      }
    } else if (this.target && this.reduced) { this.target = null; }
    // seat: glide to the chair when sitting, back to the waypoint when standing
    this.posture += (this.postureWant - this.posture) * Math.min(1, dt * 2.6); if (this.reduced) this.posture = this.postureWant;
    if (this.seated && !walking) { pos.x += (SIT_SPOT.x - pos.x) * Math.min(1, dt * 3); pos.z += (SIT_SPOT.z - pos.z) * Math.min(1, dt * 3); this.wantHeading = SIT_SPOT.heading; }
    // ── looking / facing ──
    const talking = t < this.talkUntil || this.speakingExternal;
    const lookW = this.lookName && this.world[this.lookName] ? this.world[this.lookName] : null;
    if (!walking) {
      const f = LOOK_AT[this.faceFocus];
      if (lookW && (this.cur || this.holdPhone || this.gesture)) this.wantHeading = Math.atan2(lookW.x - pos.x, lookW.z - pos.z) + (this.seated ? 0 : 0);
      else if (talking && this.faceFocus !== 'none') this.wantHeading = Math.atan2(f[0] - pos.x, f[1] - pos.z);
      else if (talking) this.wantHeading = Math.atan2(cameraPos.x - pos.x, cameraPos.z - pos.z);
      else if (!scripted && !this.seated && t > this.idleUntil && Math.random() < dt * 0.15) { this.wantHeading = this.heading + (Math.random() - 0.5) * 1.6; this.idleUntil = t + 3 + Math.random() * 4; }
    }
    if (this.seated && !walking) this.wantHeading = SIT_SPOT.heading;
    let dh = this.wantHeading - this.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); this.heading += dh * Math.min(1, dt * 5); this.root.rotation.y = this.heading;
    this.moveBlend += ((walking ? 1 : 0) - this.moveBlend) * Math.min(1, dt * 6);
    if (walking) this.phase += dt * 6.4;
    const w = this.moveBlend, s = Math.sin(this.phase), c = Math.cos(this.phase);
    if (walking) { const sg = s >= 0 ? 1 : -1; if (sg !== this.lastStepSign) { this.lastStepSign = sg; this.onStep?.(sg); } }
    // velocity (secondary motion)
    this.vel.copy(pos).sub(this.lastPos).divideScalar(Math.max(dt, 1e-3)); this.lastPos.copy(pos);
    const prevMove = this.moveBlend;
    this.stopLean += ((walking ? 0.0 : 0) - this.stopLean) * Math.min(1, dt * 5) + (prevMove > 0.5 && !walking ? 0.04 : 0);

    // ── body pose ──
    const sit = this.posture; const worried = this.mood === 'worried' && talking;
    const breathe = Math.sin(t * 1.9) * 0.006;
    this.hips.position.y = (0.93 - sit * 0.34) - Math.abs(c) * 0.03 * w * (1 - sit) + (Math.sin(t * 1.4) * 0.004);
    this.hips.rotation.y = s * 0.07 * w; this.hips.rotation.z = Math.sin(this.phase) * 0.03 * w + Math.sin(t * 0.5) * 0.01 * (1 - sit);
    this.torso.rotation.set(0.05 * w + (worried ? 0.1 : 0) + sit * 0.06 + this.stopLean + this.lean + Math.sin(t * 1.6) * 0.012, -s * 0.12 * w, -this.hips.rotation.z * 0.5);
    this.torso.scale.set(1, 1 + breathe, 1 + breathe);

    // ── legs (IK) ──
    this.root.updateMatrixWorld(true);
    for (const i of [0, 1]) {
      const side = i ? 1 : -1; const ph = this.phase + (i ? Math.PI : 0);
      const stride = Math.sin(ph) * 0.2 * w, lift = Math.max(0, Math.cos(ph)) * 0.09 * w;
      const standT = this.tv3.set(side * 0.095, 0.065 + lift, stride - 0.01 * (1 - w));
      const sitT = new THREE.Vector3(side * 0.11, 0.065, 0.36 + 0.02 * side);
      const tgt = new THREE.Vector3().lerpVectors(standT, sitT, sit); tgt.sub(this.hips.position); tgt.x += 0.0;
      this.ik(this.legU[i], this.legL[i], 0.43, 0.41, tgt, new THREE.Vector3(0, 0, 1));
      this.foot[i].quaternion.copy(this.legU[i].quaternion).multiply(this.legL[i].quaternion).invert().multiply(this.tq.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.max(0, Math.cos(ph)) * 0.35 * w));
    }

    // ── arms: decide where each hand wants to be (root space), then IK ──
    const talk = talking ? 1 : 0;
    const want = [new THREE.Vector3(-0.17, 1.03, 0.24), new THREE.Vector3(0.26, 0.84, 0.03)];
    const pole = [new THREE.Vector3(-0.6, -0.5, -0.6), new THREE.Vector3(0.6, -0.5, -0.6)];
    let curl = [0.55, 0.3], indexOut = [false, false]; this.mug.visible = false; this.clip.visible = true;
    if (this.seated) { want[0].set(-0.12, 0.8, 0.3); want[1].set(0.12, 0.8, 0.3); curl = [0.3, 0.3]; }
    if (walking) { want[0].z += -s * 0.16 * w; want[0].y += 0.0; want[1].z += s * 0.18 * w; want[1].x += 0.0; want[0].x = -0.2; want[1].x = 0.24; want[0].y = 0.9; want[1].y = 0.82 - Math.abs(s) * 0.02; curl = [0.5, 0.35]; }
    else if (talk && !this.holdPhone) { want[1].set(0.24 + Math.sin(t * 2.3) * 0.05, 1.1 + Math.sin(t * 3.1) * 0.06, 0.32 + Math.sin(t * 4.2) * 0.04); curl[1] = 0.25; indexOut[1] = Math.sin(t * 1.1) > 0.5; }
    if (this.gesture) {
      const g = this.gesture; g.t += dt; const u = g.t / g.dur; const e = smooth(Math.min(1, g.t / 0.45, (g.dur - g.t) / 0.45));
      if (u >= 1) { this.gesture = null; this.nextGesture = t + 4 + Math.random() * 6; if (this.lookName && !this.cur) this.lookName = ''; }
      else {
        const tgtLocal = g.target ? this.worldToRootLocal(g.target) : null; const mix = (a: THREE.Vector3, b: THREE.Vector3) => a.lerp(b, e);
        switch (g.kind) {
          case 'point': { const p = tgtLocal ? this.tv.copy(tgtLocal).normalize().multiplyScalar(0.55).add(new THREE.Vector3(0.1, 1.2, 0)) : new THREE.Vector3(0.22, 1.28, 0.5); mix(want[1], p); indexOut[1] = true; curl[1] = 0.8; break; }
          case 'pointUp': { const p = tgtLocal ? this.tv.copy(tgtLocal).sub(new THREE.Vector3(0, 1.45, 0)).normalize().multiplyScalar(0.58).add(new THREE.Vector3(0.12, 1.45, 0)) : new THREE.Vector3(0.2, 1.9, 0.3); mix(want[1], p); indexOut[1] = true; curl[1] = 0.8; this.lean = 0; break; }
          case 'scratch': mix(want[1], new THREE.Vector3(0.1, 1.64, 0.07 + Math.sin(t * 14) * 0.015)); curl[1] = 0.5; break;
          case 'wave': mix(want[1], new THREE.Vector3(0.3 + Math.sin(t * 11) * 0.07, 1.75, 0.15)); curl[1] = 0.05; break;
          case 'hip': mix(want[1], new THREE.Vector3(0.3, 0.98, -0.06)); curl[1] = 0.6; break;
          case 'watch': mix(want[0], new THREE.Vector3(-0.05, 1.24, 0.3)); this.clip.visible = false; curl[0] = 0.2; break;
          case 'sip': this.mug.visible = true; mix(want[1], new THREE.Vector3(0.03, 1.52, 0.2 + (Math.sin(t * 2) > 0.7 ? 0.0 : 0.03))); curl[1] = 0.75; break;
          case 'cross': mix(want[0], new THREE.Vector3(0.14, 1.12, 0.22)); mix(want[1], new THREE.Vector3(-0.14, 1.16, 0.24)); this.clip.visible = false; break;
          case 'stretch': mix(want[0], new THREE.Vector3(-0.2, 1.95, 0.05)); mix(want[1], new THREE.Vector3(0.2, 1.95, 0.05)); curl = [0.1, 0.1]; this.lean = -0.05 * e; break;
          case 'write': mix(want[0], new THREE.Vector3(-0.1, 1.13, 0.3)); mix(want[1], new THREE.Vector3(-0.04 + Math.sin(t * 9) * 0.015, 1.1 + Math.sin(t * 7) * 0.01, 0.32)); curl[1] = 0.85; break;
          case 'type': { const k2 = tgtLocal ? tgtLocal.clone() : new THREE.Vector3(0, 0.95, 0.46); mix(want[0], k2.clone().add(new THREE.Vector3(-0.1, 0.02, 0))); mix(want[1], k2.clone().add(new THREE.Vector3(0.1, 0.02, 0))); want[0].y += Math.sin(t * 17) * 0.006; want[1].y += Math.sin(t * 15) * 0.006; curl = [0.4, 0.4]; break; }
          case 'knob': { const p = tgtLocal || new THREE.Vector3(0.0, 1.2, 0.5); mix(want[1], p.clone()); curl[1] = 0.6; this.lean = 0.12 * e; break; }
          case 'readGauge': { const p = tgtLocal || new THREE.Vector3(0.0, 1.2, 0.5); mix(want[1], p.clone().multiplyScalar(0.85).add(new THREE.Vector3(0, 0.1, 0))); indexOut[1] = true; curl[1] = 0.8; this.lean = 0.16 * e; break; }
          case 'inspect': { const p = tgtLocal || new THREE.Vector3(0.0, 1.1, 0.5); mix(want[1], p.clone().add(new THREE.Vector3(0, Math.sin(t * 2.2) * 0.12, 0))); curl[1] = 0.2; this.lean = 0.1 * e; break; }
          case 'reachPhone': { const p = tgtLocal || new THREE.Vector3(0.3, 1.2, 0.6); mix(want[1], p.clone()); curl[1] = 0.6; this.lean = 0.08 * e; break; }
          case 'nod': break;
        }
      }
    } else { this.lean += (0 - this.lean) * Math.min(1, dt * 4);
      if (!walking && !scripted && !talk && t > this.nextGesture && !this.reduced && !this.seated) {
        const kinds: GestureKind[] = ['scratch', 'write', 'hip', 'watch', 'sip', 'cross', 'stretch', 'point']; this.gesture = { kind: kinds[Math.floor(Math.random() * kinds.length)], t: 0, dur: 2.2 + Math.random() * 1.8, target: null }; this.nextGesture = t + 99;
      } }
    if (this.holdPhone) { this.phoneReach += (1 - this.phoneReach) * Math.min(1, dt * 4); want[1].lerp(new THREE.Vector3(0.13, 1.56, 0.07), this.phoneReach); curl[1] = 0.7; }
    if (this.reduced && !scripted && !this.gesture) { want[0].set(-0.17, 1.03, 0.24); want[1].set(0.26, 0.84, 0.03); }
    this.root.updateMatrixWorld(true);
    for (const i of [0, 1]) {
      this.armPos[i].lerp(want[i], Math.min(1, dt * (this.gesture || this.holdPhone ? 9 : 7)));
      const tt = this.rootToTorso(this.armPos[i], new THREE.Vector3());
      this.ik(this.armU[i], this.armL[i], 0.3, 0.27, tt, pole[i]);
      const h = this.hands[i]; h.wantCurl = curl[i]; h.curl += (h.wantCurl - h.curl) * Math.min(1, dt * 10);
      h.fingers.forEach((f, k) => { const ext = k === 0 && indexOut[i] ? 0.1 : 1; const cv = h.curl * ext * 1.5 + Math.sin(t * 3 + k + i) * 0.03; f.joints[0].rotation.x = -cv * 0.8; f.joints[1].rotation.x = -cv * 0.9; });
      h.thumb.joints[0].rotation.x = -h.curl * 0.5; h.thumb.joints[1].rotation.x = -h.curl * 0.4;
    }
    // ── head, face ──
    this.nextLook -= dt; if (this.nextLook < 0) { this.lookTo = (Math.random() - 0.5) * 1.1; this.nextLook = 1.5 + Math.random() * 3.5; }
    this.lookYaw += (this.lookTo - this.lookYaw) * Math.min(1, dt * 3);
    let yaw = this.lookYaw, pitch = Math.sin(t * 0.8) * 0.02;
    if (talk || this.holdPhone) { const toCam = Math.atan2(cameraPos.x - pos.x, cameraPos.z - pos.z) - this.heading; yaw = clamp(Math.atan2(Math.sin(toCam), Math.cos(toCam)), -1, 1) * 0.6; pitch = Math.sin(t * 5.5) * 0.06; }
    if (lookW && (this.cur || this.gesture)) { const lw = this.root.worldToLocal(lookW.clone()); yaw = clamp(Math.atan2(lw.x, lw.z), -0.9, 0.9); pitch = clamp(-Math.atan2(lw.y - 1.6, Math.hypot(lw.x, lw.z)), -0.5, 0.5) * 0.8; }
    if (this.gesture?.kind === 'watch') pitch = 0.45; if (this.gesture?.kind === 'nod') pitch = Math.sin(t * 6) * 0.15;
    if (this.holdPhone) this.head.rotation.z = -0.12;
    this.neck.rotation.y += (yaw - this.neck.rotation.y) * Math.min(1, dt * 4);   // head lags behind the body
    this.head.rotation.x += ((pitch + (worried ? 0.08 : 0)) - this.head.rotation.x) * Math.min(1, dt * 6); if (!this.holdPhone) this.head.rotation.z = worried ? Math.sin(t * 1.2) * 0.05 : this.head.rotation.z * 0.9;
    // goggles: pulled over the eyes while the laser is on
    const gw = this.laserOn ? 1 : 0; this.goggles.position.y += ((0.115 + (1 - gw) * 0.07) - this.goggles.position.y) * Math.min(1, dt * 5); this.goggles.rotation.x += (((1 - gw) * -0.5) - this.goggles.rotation.x) * Math.min(1, dt * 5);
    // blink, brows, mouth
    this.nextBlink -= dt; if (this.nextBlink < 0) { this.blink = 0.14; this.nextBlink = 2 + Math.random() * 4; } this.blink = Math.max(0, this.blink - dt);
    for (const e of this.eyes) e.scale.y = this.blink > 0 ? 0.12 : 1;
    this.brows.forEach((b, k) => { const raise = worried ? 0.012 : talk ? Math.max(0, Math.sin(t * 4)) * 0.008 : 0; b.position.y += ((0.142 + raise) - b.position.y) * Math.min(1, dt * 8); b.rotation.z = (k ? -1 : 1) * (worried ? 0.25 : 0); });
    const mo = this.speakingExternal ? this.mouthLevel : talk ? (Math.abs(Math.sin(t * 9)) * 0.6 + Math.abs(Math.sin(t * 5.3)) * 0.3) : 0;
    this.jaw.rotation.x += (mo * 0.28 - this.jaw.rotation.x) * Math.min(1, dt * 18); this.mouth.scale.set(1 + mo * 0.1, 0.25 + mo * 1.1, 1);
    // coat sway: follows acceleration, plus a little breathing
    const ax = -this.vel.x * Math.sin(this.heading) * 0.05 - this.vel.z * Math.cos(this.heading) * 0.05;
    this.coatSpring.x += (ax - this.coatSpring.x) * Math.min(1, dt * 6); this.coat.rotation.x = this.coatSpring.x * 0.5 + Math.sin(t * 1.7) * 0.01; this.coat.rotation.z = Math.sin(this.phase * 0.5) * 0.04 * w;
    (this.coat.material as THREE.MeshBasicMaterial).color.set(worried ? 0xf59e0b : 0x0ea5e9);
    this.root.position.y = 0;
  }
}

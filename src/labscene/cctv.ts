import * as THREE from 'three';

// The three security cameras mounted in the lab. Each is a real object in the room (bracket, housing, lens, blinking red
// light) and also a fixed viewpoint: the "Cameras" buttons put the picture on screen exactly as that camera sees it.

export type LabCamera = { id: 1 | 2 | 3; label: string; where: string; pos: [number, number, number]; target: [number, number, number]; fov: number };
export const CAMERAS: LabCamera[] = [
  { id: 1, label: 'CAM 1 · LAB OVERVIEW', where: 'Front-left wall, high', pos: [-4.25, 3.15, 3.2], target: [1.0, 0.7, -0.6], fov: 62 },
  { id: 2, label: 'CAM 2 · WORKSTATION', where: 'Back wall, centre', pos: [-0.6, 3.15, -2.5], target: [3.2, 0.7, -1.2], fov: 64 },
  { id: 3, label: 'CAM 3 · CHAMBER & RACK', where: 'Back wall, right', pos: [4.8, 3.15, -2.5], target: [-1.6, 0.9, 0.5], fov: 62 },
];

export function buildCameraProps(scene: THREE.Scene) {
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const mat = <T extends THREE.Material>(m: T) => { mats.push(m); return m; }, geo = <T extends THREE.BufferGeometry>(g: T) => { geos.push(g); return g; };
  const body = mat(new THREE.MeshStandardMaterial({ color: 0xeef1f4, roughness: 0.45, metalness: 0.2 }));
  const dark = mat(new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.35, metalness: 0.5 }));
  const lens = mat(new THREE.MeshStandardMaterial({ color: 0x0a1020, roughness: 0.05, metalness: 0.9, emissive: 0x0b1d3a, emissiveIntensity: 0.6 }));
  const leds: THREE.MeshBasicMaterial[] = [];
  const groups = new Map<number, THREE.Group>();
  for (const cam of CAMERAS) {
    const g = new THREE.Group(); g.name = `cctv-${cam.id}`; g.position.set(...cam.pos);
    // The housing looks along the camera's view direction; the bracket reaches back to the wall.
    const look = new THREE.Vector3(...cam.target).sub(g.position);
    const wallDir = new THREE.Vector3(Math.abs(cam.pos[0] + 4.4) < 0.3 ? -1 : 0, 0, Math.abs(cam.pos[0] + 4.4) < 0.3 ? 0 : -1);
    const head = new THREE.Group(); head.add(new THREE.Mesh(geo(new THREE.BoxGeometry(0.11, 0.1, 0.3)), body));
    const shield = new THREE.Mesh(geo(new THREE.BoxGeometry(0.13, 0.012, 0.34)), body); shield.position.set(0, 0.058, 0.02); head.add(shield);
    const barrel = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.036, 0.04, 0.07, 18)), dark); barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.18; head.add(barrel);
    const glass = new THREE.Mesh(geo(new THREE.CircleGeometry(0.03, 18)), lens); glass.position.z = 0.216; head.add(glass);
    const led = mat(new THREE.MeshBasicMaterial({ color: 0xff2a2a })) as THREE.MeshBasicMaterial; leds.push(led);
    const dot = new THREE.Mesh(geo(new THREE.SphereGeometry(0.008, 8, 6)), led); dot.position.set(0.035, 0.03, 0.15); head.add(dot);
    head.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), look, new THREE.Vector3(0, 1, 0)));
    g.add(head);
    const arm = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 10)), dark);
    arm.position.copy(wallDir).multiplyScalar(0.15).add(new THREE.Vector3(0, 0.08, 0)); arm.rotation.set(wallDir.z ? Math.PI / 2 : 0, 0, wallDir.x ? Math.PI / 2 : 0); g.add(arm);
    const plate = new THREE.Mesh(geo(new THREE.BoxGeometry(wallDir.x ? 0.015 : 0.14, 0.14, wallDir.z ? 0.015 : 0.14)), dark); plate.position.copy(wallDir).multiplyScalar(0.3).add(new THREE.Vector3(0, 0.08, 0)); g.add(plate);
    g.traverse(o => { (o as THREE.Mesh).castShadow = false; });
    scene.add(g); groups.set(cam.id, g);
  }
  return {
    groups,
    /** Hides the housing of the camera we are looking through, so it is not in its own picture. */
    hideOnly(id: number | null) { groups.forEach((g, k) => { g.visible = k !== id; }); },
    tick(t: number) { leds.forEach((l, i) => { const on = Math.sin(t * 2.6 + i * 1.7) > -0.2; l.color.set(on ? 0xff2a2a : 0x4a0a0a); }); },
    dispose() { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); groups.forEach(g => scene.remove(g)); },
  };
}

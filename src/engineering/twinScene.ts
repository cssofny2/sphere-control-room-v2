import * as THREE from 'three';

export interface TwinPart {
  id: string;
  g: string;
  label: string;
  k: 'box' | 'cyl' | 'sph';
  c: number[];
  s?: number[];
  r?: number;
  len?: number;
  ax?: string;
  col: string;
  a?: number;
  wall?: string;
  mt?: string;
  inst?: string;
  note?: string;
  conceptual?: number;
}

/** Source coordinates are millimetres with Z up; Three.js uses metres with Y up. */
export function positionOf(v: readonly number[]): THREE.Vector3 {
  return new THREE.Vector3(v[0] / 1000, v[2] / 1000, -v[1] / 1000);
}

export function geometryFor(part: TwinPart): THREE.BufferGeometry {
  if (part.k === 'box') {
    const [x, y, z] = part.s!;
    return new THREE.BoxGeometry(x / 1000, z / 1000, y / 1000);
  }
  if (part.k === 'sph') return new THREE.SphereGeometry(part.r! / 1000, 24, 16);
  const geometry = new THREE.CylinderGeometry(part.r! / 1000, part.r! / 1000, part.len! / 1000, 32);
  if (part.ax === 'x') geometry.rotateZ(Math.PI / 2);
  if (part.ax === 'y') geometry.rotateX(Math.PI / 2);
  return geometry;
}

/** All meshes between the camera and any of the sampled platform positions. */
export function findObstructions(camera: THREE.Vector3, targets: readonly THREE.Vector3[], meshes: readonly THREE.Mesh[]): Set<THREE.Mesh> {
  const ray = new THREE.Raycaster();
  const hits = new Set<THREE.Mesh>();
  const direction = new THREE.Vector3();
  for (const target of targets) {
    direction.subVectors(target, camera);
    const distance = direction.length();
    if (distance < 1e-6) continue;
    ray.set(camera, direction.multiplyScalar(1 / distance));
    ray.near = 0.001;
    ray.far = Math.max(0, distance - 0.001);
    for (const hit of ray.intersectObjects(meshes.filter(mesh => mesh.visible), false)) hits.add(hit.object as THREE.Mesh);
  }
  return hits;
}

export const PLATFORM_IDS = new Set(['test', 'ref', 'spare', 'dummy', 'cupA', 'cupB', 'rail', 'nodeA', 'nodeB']);

export function platformTargets(): THREE.Vector3[] {
  const result: THREE.Vector3[] = [];
  for (let x = -220; x <= 220; x += 55) {
    for (const y of [-20, 0, 20]) result.push(positionOf([x, y, 854.6]));
  }
  return result;
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Draw-call reduction for the lab scene.
//
// The lab is hand-built from about 650 small meshes, so the GPU is asked for 800+ draw calls per frame (twice that
// when the shadow map is included). Most of those parts never move. This pass fuses every static, opaque mesh that
// shares a material (and shadow flags) into one mesh, which cuts the draw calls several times over with no visual change.
//
// Safety rules (each one keeps behaviour identical):
//  - Only plain, opaque, visible, single-material meshes are merged. Instanced meshes, points, lines, sprites and
//    transparent meshes (which need depth sorting) are left alone.
//  - A mesh is merged into the nearest ancestor that is a "region root": a picking root, an object that moves or toggles
//    (the `dynamic` set) or anything flagged userData.noMerge. Geometry is baked into that root's local space, so parts
//    keep following a moving parent, picking still resolves to the right part, and nothing is fused across two parts.
//  - Meshes that move on their own (the `dynamic` set, or userData.noMerge on the mesh or an ancestor) are never merged.
//  - Materials are shared by reference, so colour, emissive, opacity and clipping-plane changes still apply.

export type MergeStats = { before: number; after: number; groups: number };

const isCandidate = (o: THREE.Object3D): o is THREE.Mesh => {
  const m = o as THREE.Mesh;
  if (!m.isMesh || (o as any).isInstancedMesh || (o as any).isSkinnedMesh) return false;
  if (!m.visible || !m.geometry || Array.isArray(m.material)) return false;
  const mat = m.material as THREE.Material;
  if (mat.transparent || mat.opacity < 1 || (mat as any).wireframe) return false;
  if (m.userData?.noMerge || m.renderOrder !== 0) return false;
  const g = m.geometry; if (!g.getAttribute('position')) return false;
  return true;
};

/** Returns the geometry in the exact attribute layout the merger needs: position, normal, uv, indexed. */
function normalised(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const c = g.clone();
  for (const name of Object.keys(c.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') c.deleteAttribute(name);
  c.clearGroups();
  if (!c.getAttribute('normal')) c.computeVertexNormals();
  if (!c.getAttribute('uv')) c.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(c.getAttribute('position').count * 2), 2));
  if (!c.index) { const n = c.getAttribute('position').count; const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n); for (let i = 0; i < n; i++) idx[i] = i; c.setIndex(new THREE.BufferAttribute(idx, 1)); }
  return c;
}

export function mergeStaticMeshes(scene: THREE.Scene, opts: { regionRoots: Iterable<THREE.Object3D>; dynamic: Iterable<THREE.Object3D>; track: <T extends { dispose: () => void }>(o: T) => T }): MergeStats {
  const roots = new Set<THREE.Object3D>(opts.regionRoots); const dyn = new Set<THREE.Object3D>(opts.dynamic);
  scene.updateMatrixWorld(true);
  const isRoot = (o: THREE.Object3D) => roots.has(o) || dyn.has(o) || !!o.userData?.noMerge || !o.visible;
  // Group candidates by (region root, material, shadow flags)
  type Bucket = { root: THREE.Object3D; mat: THREE.Material; cast: boolean; recv: boolean; items: THREE.Mesh[] };
  const buckets = new Map<string, Bucket>(); const ids = new Map<object, number>(); const id = (o: object) => { let v = ids.get(o); if (v === undefined) { v = ids.size; ids.set(o, v); } return v; };
  let before = 0;
  scene.traverse(o => {
    if (!isCandidate(o) || dyn.has(o)) return; before++;
    let root: THREE.Object3D = scene; for (let p = o.parent; p; p = p.parent) { if (p === scene) break; if (isRoot(p)) { root = p; break; } }
    const key = `${id(root)}|${id(o.material as object)}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}`;
    let b = buckets.get(key); if (!b) { b = { root, mat: o.material as THREE.Material, cast: o.castShadow, recv: o.receiveShadow, items: [] }; buckets.set(key, b); }
    b.items.push(o);
  });
  let kept = 0, groups = 0;
  const rootInv = new THREE.Matrix4(), rel = new THREE.Matrix4();
  for (const b of buckets.values()) {
    if (b.items.length < 2) { kept += b.items.length; continue; }
    b.root.updateWorldMatrix(true, false); rootInv.copy(b.root.matrixWorld).invert();
    const parts: THREE.BufferGeometry[] = [];
    for (const m of b.items) {
      m.updateWorldMatrix(true, false); rel.multiplyMatrices(rootInv, m.matrixWorld);
      const g = normalised(m.geometry); g.applyMatrix4(rel);
      if (rel.determinant() < 0) { const ix = g.index!; for (let i = 0; i < ix.count; i += 3) { const a = ix.getX(i + 1), c = ix.getX(i + 2); ix.setX(i + 1, c); ix.setX(i + 2, a); } }
      parts.push(g);
    }
    const merged = mergeGeometries(parts, false); parts.forEach(p => p.dispose());
    if (!merged) { kept += b.items.length; continue; }
    merged.computeBoundingSphere(); merged.computeBoundingBox();
    const mesh = new THREE.Mesh(opts.track(merged), b.mat); mesh.castShadow = b.cast; mesh.receiveShadow = b.recv; mesh.name = 'merged'; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    b.root.add(mesh);
    for (const m of b.items) m.parent?.remove(m);
    groups++;
  }
  return { before, after: kept + groups, groups };
}

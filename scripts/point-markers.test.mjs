import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { loadTypeScript } from './load-typescript.mjs';

const M = await loadTypeScript(new URL('../src/features/pointMarkers.ts', import.meta.url));
const Twin = await loadTypeScript(new URL('../src/engineering/twinScene.ts', import.meta.url));
const rec = (i, o = {}) => ({ id: `r${i}`, x: i, y: -i, z: 2 * i, resonance: 230500 + i, valid: true, fit: { ok: true }, ...o });

{
  const a = Twin.positionOf([-200, 0, 854.6]), b = Twin.positionOf([200, 0, 854.6]);
  assert.ok(Math.abs(a.distanceTo(b) - 0.4) < 1e-12, 'A/B positions are exactly 0.4 m apart');
  const sphere = Twin.geometryFor({ id: 'test', g: 'sphere', label: 'T', k: 'sph', c: [-200, 0, 854.6], r: 4.6, col: '#c97859' });
  sphere.computeBoundingSphere();
  assert.ok(Math.abs(sphere.boundingSphere.radius - 0.0046) < 1e-7, 'artifact radius is 4.6 mm');
  sphere.dispose();
  assert.equal(Twin.platformTargets().length, 27);
  console.log('PASS engineering geometry preserves the A/B spacing and artifact scale');
}
{
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const geometry = new THREE.BoxGeometry(1, 1, 0.2);
  const wall = new THREE.Mesh(geometry, material);
  const second = new THREE.Mesh(geometry, material); second.position.z = 1;
  const behind = new THREE.Mesh(geometry, material); behind.position.z = -2;
  const offAxis = new THREE.Mesh(geometry, material); offAxis.position.x = 3;
  for (const mesh of [wall, second, behind, offAxis]) mesh.updateMatrixWorld();
  const targets = [new THREE.Vector3(0, 0, -1)];
  const hits = Twin.findObstructions(new THREE.Vector3(0, 0, 2), targets, [wall, second, behind, offAxis]);
  assert.ok(hits.has(wall) && hits.has(second), 'all intersecting layers are returned');
  assert.ok(!hits.has(behind) && !hits.has(offAxis), 'meshes behind or outside the sightline are not returned');
  wall.visible = false;
  assert.ok(!Twin.findObstructions(new THREE.Vector3(0, 0, 2), targets, [wall]).has(wall), 'hidden meshes are ignored');
  assert.equal(Twin.findObstructions(targets[0], targets, [second]).size, 0, 'zero-length sightlines are safe');
  geometry.dispose(); material.dispose();
  console.log('PASS platform sightlines identify only visible obstructions in front of the target');
}
{
  const m = M.pointMarkers([rec(1), rec(2, { valid: false }), rec(3, { fit: { ok: false } }), rec(4, { excluded: true }), rec(5, { x: NaN })]);
  assert.deepEqual(m.map(p => [p.id, p.ok]), [['r1', true], ['r2', false], ['r3', false]], 'good, suspect and failed-fit points are kept; excluded and unplaceable ones are not');
  assert.match(m[0].label, /1\.0, -1\.0, 2\.0 mm: 230501\.00 Hz \(valid\)/); assert.match(m[1].label, /suspect or failed/);
  assert.equal(M.pointMarkers([]).length, 0);
  const many = Array.from({ length: 500 }, (_, i) => rec(i));
  const capped = M.pointMarkers(many); assert.equal(capped.length, 200, 'at most 200 markers are drawn'); assert.equal(capped[0].id, 'r0', 'the newest records win');
  assert.equal(M.pointMarkers(many, 5).length, 5);
  assert.match(M.pointMarkers([rec(1, { resonance: NaN })])[0].label, /no resonance/);
  console.log('PASS markers keep good and suspect points, drop unusable ones, and are capped to the newest 200');
}
{
  assert.ok(M.markerRadius(100) === 6.5 && M.markerRadius(100000) === 2.5 && M.markerRadius(0) === 6.5, 'radius is clamped');
  assert.ok(M.markerRadius(500) > M.markerRadius(2500), 'zooming in makes markers larger');
  console.log('PASS marker size follows the camera distance within limits');
}
{
  const app = fs.readFileSync(new URL('../src/MetrologyLabV3.tsx', import.meta.url), 'utf8');
  assert.ok(/pointMarkers\(state\.experiment\?\.records/.test(app) && /markers3d\.length > 0/.test(app), 'the engineering model draws and labels the markers');
  console.log('PASS the engineering 3D model draws measured points and says what they are');
}
{
  const app = fs.readFileSync(new URL('../src/MetrologyLabV3.tsx', import.meta.url), 'utf8');
  assert.ok(/Number\.isFinite\(latestRecord\.depth\)/.test(app) && /Number\.isFinite\(latestRecord\.uncertaintyHz\)/.test(app), 'the dashboard tile tolerates records without a depth (CSV imports, older sessions)');
  assert.ok(/<PageBoundary pageKey=/.test(app) && /<\/PageBoundary>/.test(app), 'every page is wrapped in the error boundary');
  const b = fs.readFileSync(new URL('../src/features/PageBoundary.tsx', import.meta.url), 'utf8');
  assert.ok(/getDerivedStateFromError/.test(b) && /getDerivedStateFromProps/.test(b) && /role="alert"/.test(b), 'the boundary catches errors, resets on page change and is announced');
  const cf = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.ok(/"account_id": "f7c1221a54de84c98d6e75d59601ace8"/.test(cf) && /deploy:cloudflare/.test(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')));
  console.log('PASS a record without depth no longer blanks the app, pages are error-bounded, Cloudflare deploy is one command');
}

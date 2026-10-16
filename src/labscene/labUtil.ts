import * as THREE from 'three';

// Small drawing helpers shared by the lab scene modules.

export type CanvasTex = { tex: THREE.CanvasTexture; redraw: (fn: (c: CanvasRenderingContext2D, w: number, h: number) => void) => void };

export function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true): CanvasTex {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c); if (srgb) tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { tex, redraw: fn => { fn(ctx, w, h); tex.needsUpdate = true; } };
}

/** Soft round shadow used as a cheap "contact shadow" decal on the floor. */
export function blobShadowTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const grd = g.createRadialGradient(64, 64, 8, 64, 64, 62);
  grd.addColorStop(0, 'rgba(20,30,45,0.55)'); grd.addColorStop(0.55, 'rgba(20,30,45,0.22)'); grd.addColorStop(1, 'rgba(20,30,45,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** Grey roughness map with fine brushing, scratches and a few fingerprint smudges (metal looks used). */
export function roughnessMapTex(seed = 7): THREE.CanvasTexture {
  let s = seed; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) { const y = rnd() * 512, v = 110 + rnd() * 70; g.strokeStyle = `rgba(${v},${v},${v},0.25)`; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y); g.lineTo(512, y + (rnd() - 0.5) * 3); g.stroke(); }
  for (let i = 0; i < 60; i++) { const x = rnd() * 512, y = rnd() * 512, l = 20 + rnd() * 70, a = rnd() * Math.PI; g.strokeStyle = `rgba(235,235,235,${0.25 + rnd() * 0.35})`; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  for (let i = 0; i < 14; i++) { const x = rnd() * 512, y = rnd() * 512, r = 10 + rnd() * 18; const grd = g.createRadialGradient(x, y, 1, x, y, r); grd.addColorStop(0, 'rgba(235,235,235,0.35)'); grd.addColorStop(1, 'rgba(235,235,235,0)'); g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); t.anisotropy = 4; return t;
}

/** Soft additive glow sprite texture (laser dot halo, indicator bloom). */
export function glowTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export type Quality = 'high' | 'low';

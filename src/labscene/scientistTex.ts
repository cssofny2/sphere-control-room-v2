// Procedural surface detail for Dr. Wire: skin (pores, colour variation, flush on the cheeks), stubble on the jaw, hair strands,
// and woven-cloth bump maps for the lab coat and trousers. Drawn in code, so nothing is downloaded.
import * as THREE from 'three';

const make = (w: number, h: number, srgb: boolean, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number]) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); if (c) draw(c, w, h);
  const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]); return t;
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Skin colour map for the head sphere (front of the face is at u = 0.25). */
export function skinTexture(): THREE.CanvasTexture {
  return make(512, 256, true, (c, w, h) => {
    c.fillStyle = '#e0ab86'; c.fillRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,214,180,0.25)'); g.addColorStop(0.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,70,50,0.18)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (const sx of [-1, 1]) { const x = w * (0.25 + sx * 0.055), y = h * 0.6, r = c.createRadialGradient(x, y, 2, x, y, 34); r.addColorStop(0, 'rgba(226,120,110,0.36)'); r.addColorStop(1, 'rgba(226,120,110,0)'); c.fillStyle = r; c.fillRect(x - 40, y - 40, 80, 80); }
    const nx = w * 0.25, ny = h * 0.56, r2 = c.createRadialGradient(nx, ny, 1, nx, ny, 16); r2.addColorStop(0, 'rgba(214,120,100,0.3)'); r2.addColorStop(1, 'rgba(214,120,100,0)'); c.fillStyle = r2; c.fillRect(nx - 20, ny - 20, 40, 40);
    for (let i = 0; i < 5200; i++) { const a = Math.random() * 0.1; c.fillStyle = Math.random() < 0.6 ? `rgba(140,85,60,${a})` : `rgba(255,235,215,${a})`; c.fillRect(rnd(0, w), rnd(0, h), rnd(0.6, 1.6), rnd(0.6, 1.6)); }
  });
}
/** Jaw colour map: skin with a five o'clock shadow. */
export function jawTexture(): THREE.CanvasTexture {
  return make(256, 128, true, (c, w, h) => {
    c.fillStyle = '#dca580'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { const x = rnd(0, w), y = rnd(h * 0.35, h); c.fillStyle = `rgba(60,44,36,${rnd(0.02, 0.1)})`; c.fillRect(x, y, 0.9, rnd(1, 2.2)); }
    for (let i = 0; i < 1400; i++) { c.fillStyle = `rgba(150,90,64,${rnd(0.02, 0.08)})`; c.fillRect(rnd(0, w), rnd(0, h), 1.2, 1.2); }
  });
}
/** Dark brown hair with fine strands running along the sphere. */
export function hairTexture(): THREE.CanvasTexture {
  return make(256, 256, true, (c, w, h) => {
    c.fillStyle = '#3a2a20'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { const x = rnd(0, w), l = rnd(30, 120); c.strokeStyle = Math.random() < 0.5 ? `rgba(92,66,48,${rnd(0.15, 0.5)})` : `rgba(18,12,9,${rnd(0.2, 0.6)})`; c.lineWidth = rnd(0.6, 1.6); c.beginPath(); c.moveTo(x, rnd(0, h)); c.lineTo(x + rnd(-6, 6), rnd(0, h) + l * 0.2); c.stroke(); }
  });
}
/** Plain-weave bump for cotton and trousers. */
export function weaveBump(repeat: [number, number], folds = 0): THREE.CanvasTexture {
  return make(128, 128, false, (c, w, h) => {
    c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) { const a = ((x + y) / 4) % 2 ? 150 : 108; c.fillStyle = `rgb(${a},${a},${a})`; c.fillRect(x, y, 4, 4); }
    for (let i = 0; i < folds; i++) { const x = rnd(0, w); const g = c.createLinearGradient(x - 10, 0, x + 10, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.28)`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - 10, 0, 20, h); }
  }, repeat);
}

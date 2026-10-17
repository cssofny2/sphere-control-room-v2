// Canvas textures for the things printed on Dr. Wire: the S.P.H.E.R.E. logo patch (chest and back of the lab coat),
// his ID badge and the pocket outlines. Drawn in code so there is nothing to download and nothing to go missing.
// The mark follows the project's favicon: a dark rounded square with a light-blue sphere and an orbit ring.
import * as THREE from 'three';

const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const make = (w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'); if (c) draw(c, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
};

/** The logo mark alone, drawn in a square of side `s` whose top-left corner is (x, y). */
export function drawMark(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.save(); c.translate(x, y);
  c.fillStyle = '#06080d'; c.beginPath(); c.roundRect(0, 0, s, s, s * 0.22); c.fill();
  const g = c.createRadialGradient(s * 0.35, s * 0.3, 0, s * 0.35, s * 0.3, s * 0.75); g.addColorStop(0, '#e9fbff'); g.addColorStop(0.45, '#4cc3f0'); g.addColorStop(1, '#0a4a78');
  c.fillStyle = g; c.beginPath(); c.arc(s / 2, s / 2, s * 0.265, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(159,211,240,0.9)'; c.lineWidth = s * 0.034; c.beginPath(); c.ellipse(s / 2, s / 2, s * 0.42, s * 0.14, (-24 * Math.PI) / 180, 0, Math.PI * 2); c.stroke();
  c.restore();
}

/** Embroidered-looking patch: the mark with the project name and web address under it. Transparent around the artwork. */
export function logoPatchTexture(): THREE.CanvasTexture {
  return make(512, 400, (c, w) => {
    drawMark(c, (w - 230) / 2, 14, 230);
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.fillStyle = '#0b2a52'; c.font = `800 62px ${SANS}`; c.fillText('S.P.H.E.R.E.', w / 2, 320);
    c.fillStyle = '#1b5ca6'; c.font = `600 44px ${SANS}`; c.fillText('spheredesci.org', w / 2, 378);
  });
}

/** ID badge: white card, blue header, the mark, name and role. */
export function badgeTexture(): THREE.CanvasTexture {
  return make(256, 384, (c, w, h) => {
    c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(0, 0, w, h, 22); c.fill();
    c.fillStyle = '#1f6feb'; c.beginPath(); c.roundRect(0, 0, w, 84, [22, 22, 0, 0]); c.fill();
    c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.font = `800 34px ${SANS}`; c.fillText('S.P.H.E.R.E.', w / 2, 56);
    drawMark(c, (w - 100) / 2, 102, 100);
    c.fillStyle = '#10233b'; c.font = `800 42px ${SANS}`; c.fillText('DR. WIRE', w / 2, 262);
    c.fillStyle = '#475569'; c.font = `600 28px ${SANS}`; c.fillText('Lab Technician', w / 2, 304);
    c.fillStyle = '#1b5ca6'; c.font = `600 22px ${SANS}`; c.fillText('spheredesci.org', w / 2, 350);
  });
}

/** A soft outline for the patch pockets of the coat. */
export function pocketTexture(): THREE.CanvasTexture {
  return make(256, 224, (c, w, h) => {
    c.strokeStyle = 'rgba(120,130,145,0.75)'; c.lineWidth = 7; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(10, 10); c.lineTo(w - 10, 10); c.lineTo(w - 10, h - 40); c.quadraticCurveTo(w - 10, h - 10, w - 50, h - 10); c.lineTo(50, h - 10); c.quadraticCurveTo(10, h - 10, 10, h - 40); c.closePath(); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.moveTo(22, 34); c.lineTo(w - 22, 34); c.stroke();
  });
}

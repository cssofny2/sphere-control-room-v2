import type { DeskState } from '../technician/desk';

// Draws Dr. Wire's left monitor (browser, email or desktop) onto a 1024 x 600 canvas. Type is large on
// purpose: the screen is a few centimetres tall on the page, so it has to be readable at a glance.

const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function wrap(c: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (!para) { out.push(''); continue; }
    const lead = para.match(/^\s*/)![0].length; const words = para.trim().split(/\s+/); let line = ' '.repeat(Math.min(lead, 4));
    for (const w of words) { const test = line.trim() ? `${line} ${w}` : line + w; if (c.measureText(test).width > maxW && line.trim()) { out.push(line); line = w; } else line = test; }
    out.push(line);
  }
  return out;
}

export function drawDesk(c: CanvasRenderingContext2D, w: number, h: number, st: DeskState, blink: boolean, clockText: string) {
  const s = st.screen; c.textBaseline = 'alphabetic';
  if (s.kind === 'idle') {
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#0f2744'); g.addColorStop(1, '#1d4f7a'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff'; c.font = `700 120px ${SANS}`; c.textAlign = 'center'; c.fillText(clockText, w / 2, h / 2 + 20);
    c.font = `500 34px ${SANS}`; c.fillStyle = '#bcd7f0'; c.fillText('S.P.H.E.R.E. Metrology Lab', w / 2, h / 2 + 80); c.fillText('Workstation ready', w / 2, h / 2 + 124); c.textAlign = 'left';
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, h - 56, w, 56); c.fillStyle = '#fff'; c.font = `600 26px ${SANS}`; c.fillText('Dr. Wire', 20, h - 18);
    return;
  }
  c.fillStyle = '#e6ebf1'; c.fillRect(0, 0, w, h);
  if (s.kind === 'browser') {
    // window chrome
    c.fillStyle = '#cfd8e3'; c.fillRect(0, 0, w, 56); c.fillStyle = '#fff'; c.beginPath(); c.roundRect(14, 10, 250, 46, [10, 10, 0, 0]); c.fill();
    c.fillStyle = '#334155'; c.font = `600 22px ${SANS}`; c.fillText(s.page?.site || (s.url ? s.url.replace(/^https?:\/\//, '').split('/')[0] : 'New tab'), 30, 40);
    c.fillStyle = '#f8fafc'; c.fillRect(0, 56, w, 70);
    c.fillStyle = '#fff'; c.strokeStyle = s.field === 'address' ? '#2563eb' : '#cbd5e1'; c.lineWidth = s.field === 'address' ? 4 : 2; c.beginPath(); c.roundRect(20, 66, w - 40, 50, 25); c.fill(); c.stroke();
    c.fillStyle = '#0f172a'; c.font = `500 28px ${SANS}`;
    const addr = s.field === 'address' ? s.typing : s.url; c.fillText(addr || '', 46, 102);
    if (s.field === 'address' && blink) { const tw = c.measureText(s.typing).width; c.fillRect(46 + tw + 2, 74, 3, 34); }
    // body
    c.fillStyle = '#ffffff'; c.fillRect(0, 126, w, h - 126);
    if (s.loading) { c.fillStyle = '#2563eb'; c.fillRect(0, 126, w * 0.6, 5); c.fillStyle = '#64748b'; c.font = `500 32px ${SANS}`; c.fillText('Loading…', 40, 220); return; }
    if (s.field === 'search' || (s.page && s.page.kind === 'search')) {
      const typing = s.field === 'search' ? s.typing : '';
      c.fillStyle = '#f1f5f9'; c.strokeStyle = s.field === 'search' ? '#2563eb' : '#cbd5e1'; c.lineWidth = s.field === 'search' ? 4 : 2; c.beginPath(); c.roundRect(60, 230, w - 120, 70, 35); c.fill(); c.stroke();
      c.fillStyle = '#0f172a'; c.font = `500 32px ${SANS}`; c.fillText(typing || (s.page?.lines[0] ?? ''), 90, 276);
      if (s.field === 'search' && blink) { const tw = c.measureText(typing).width; c.fillRect(90 + tw + 2, 244, 3, 42); }
      if (s.page) { c.fillStyle = '#1e293b'; c.font = `700 44px ${SANS}`; c.textAlign = 'center'; c.fillText(s.page.title, w / 2, 190); c.textAlign = 'left'; }
      return;
    }
    if (s.page) {
      let y = 176; c.fillStyle = '#0f172a'; c.font = `700 46px ${SANS}`; for (const l of wrap(c, s.page.title, w - 80)) { c.fillText(l, 40, y); y += 54; }
      c.font = `500 36px ${SANS}`; c.fillStyle = '#1e293b';
      for (const raw of s.page.lines) { for (const l of wrap(c, raw, w - 80)) { if (y > h - 70) break; c.fillText(l, 40, y); y += 46; } }
      if (s.page.footer) { c.fillStyle = '#e2e8f0'; c.fillRect(0, h - 56, w, 56); c.fillStyle = '#475569'; c.font = `500 22px ${SANS}`; c.fillText(s.page.footer.slice(0, 90), 20, h - 20); }
    }
    return;
  }
  // email
  const m = s.mail;
  c.fillStyle = '#1f6feb'; c.fillRect(0, 0, w, 64); c.fillStyle = '#fff'; c.font = `700 30px ${SANS}`; c.fillText('Mail — drwire', 24, 43);
  c.font = `500 22px ${SANS}`; c.textAlign = 'right'; c.fillText(m.mode === 'compose' ? 'Writing reply…' : m.mode === 'sent' ? 'Reply sent ✓' : 'Reading', w - 24, 42); c.textAlign = 'left';
  c.fillStyle = '#ffffff'; c.fillRect(0, 64, w, h - 64);
  c.fillStyle = '#475569'; c.font = `500 24px ${SANS}`; c.fillText(`From: ${m.from}`.slice(0, 60), 30, 104); c.fillText(`Subject: ${m.subject}`.slice(0, 60), 30, 138);
  c.strokeStyle = '#e2e8f0'; c.lineWidth = 2; c.beginPath(); c.moveTo(30, 154); c.lineTo(w - 30, 154); c.stroke();
  c.fillStyle = '#0f172a'; c.font = `500 32px ${SANS}`; let y = 200;
  const bodyLines = wrap(c, m.body, w - 70).slice(0, m.mode === 'read' ? 9 : 3); for (const l of bodyLines) { c.fillText(l, 30, y); y += 42; }
  if (m.mode !== 'read') {
    const top = Math.max(y + 10, 300); c.fillStyle = '#f1f5f9'; c.fillRect(20, top, w - 40, h - top - 16); c.strokeStyle = m.mode === 'compose' ? '#2563eb' : '#94a3b8'; c.lineWidth = 3; c.strokeRect(20, top, w - 40, h - top - 16);
    c.fillStyle = '#0f172a'; c.font = `500 30px ${SANS}`; let ty = top + 40; const rl = wrap(c, m.reply + (m.mode === 'compose' && blink ? '▌' : ''), w - 90); const maxL = Math.floor((h - top - 40) / 37);
    for (const l of rl.slice(-maxL)) { c.fillText(l, 36, ty); ty += 37; }
  }
}

/**
 * Screensaver for the left monitor when nobody has used the computer for a while: a slowly turning copper-coloured
 * wireframe sphere drifts across a dark screen with a faint 230 kHz trace, like the real thing in the project.
 */
export function drawScreensaver(c: CanvasRenderingContext2D, w: number, h: number, t: number) {
  c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  c.fillStyle = '#02070d'; c.fillRect(0, 0, w, h);
  // stars (fixed positions, slow twinkle)
  for (let i = 0; i < 70; i++) { const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * w, y = (Math.sin(i * 78.233) * 24634.6345 % 1 + 1) % 1 * h; c.fillStyle = `rgba(190,215,255,${0.15 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.9 + i))})`; c.fillRect(x, y, 2, 2); }
  const R = 118, cx = w / 2 + Math.sin(t * 0.23) * w * 0.27, cy = h / 2 - 20 + Math.sin(t * 0.31 + 1) * h * 0.16, rot = t * 0.5, tilt = 0.42;
  const P = (lat: number, lon: number) => {
    const x = R * Math.cos(lat) * Math.cos(lon + rot), y = R * Math.sin(lat), z = R * Math.cos(lat) * Math.sin(lon + rot);
    return { x: cx + x, y: cy - (y * Math.cos(tilt) - z * Math.sin(tilt)), z: y * Math.sin(tilt) + z * Math.cos(tilt) };
  };
  const ring = (pt: (u: number) => { x: number; y: number; z: number }) => {
    let prev = pt(0);
    for (let k = 1; k <= 56; k++) { const p = pt(k / 56); const front = (p.z + prev.z) / 2 > 0; c.strokeStyle = front ? 'rgba(226,150,88,0.95)' : 'rgba(226,150,88,0.18)'; c.lineWidth = front ? 2.2 : 1; c.beginPath(); c.moveTo(prev.x, prev.y); c.lineTo(p.x, p.y); c.stroke(); prev = p; }
  };
  c.save(); c.shadowColor = 'rgba(226,150,88,0.7)'; c.shadowBlur = 12;
  for (let i = -2; i <= 2; i++) { const lat = i * 0.5; ring(u => P(lat, u * Math.PI * 2)); }
  for (let j = 0; j < 8; j++) { const lon = (j * Math.PI) / 8; ring(u => { const a = u * Math.PI * 2; return P(Math.asin(Math.sin(a)), Math.cos(a) >= 0 ? lon : lon + Math.PI); }); }
  c.restore();
  c.fillStyle = 'rgba(226,170,120,0.9)'; c.font = `700 26px ${SANS}`; c.textAlign = 'center'; c.fillText('S.P.H.E.R.E.', cx, Math.min(h - 100, cy + R + 44));
  c.font = `500 18px ${SANS}`; c.fillStyle = 'rgba(160,190,225,0.8)'; c.fillText('spheredesci.org', cx, Math.min(h - 76, cy + R + 68)); c.textAlign = 'left';
  // a faint resonance trace along the bottom
  c.strokeStyle = 'rgba(80,200,255,0.55)'; c.lineWidth = 2; c.beginPath();
  for (let x = 0; x <= w; x += 4) { const y = h - 34 + Math.sin(x * 0.07 + t * 5) * Math.sin(x * 0.009 + t * 0.8) * 16; if (x === 0) c.moveTo(x, y); else c.lineTo(x, y); }
  c.stroke();
}

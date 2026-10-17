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

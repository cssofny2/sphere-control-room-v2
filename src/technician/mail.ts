// Browser side of Dr. Wire's mailbox. Polls /api/email while the lab page is open, and only if the server
// says mail is configured. Never throws; every failure just means "no mail".
export type InMail = { id: string; from: string; subject: string; text: string; receivedAt: number };
export type MailStatus = { enabled: boolean; canSend: boolean; canDraft: boolean; durable: boolean; address: string | null };

export type MailClientOpts = {
  fetchImpl?: typeof fetch; endpoint?: string; intervalMs?: number; onMail: (m: InMail) => void;
  timers?: { setInterval: (f: () => void, ms: number) => any; clearInterval: (h: any) => void };
  visible?: () => boolean;
};

export function createMailClient(o: MailClientOpts) {
  const f = o.fetchImpl || fetch, url = o.endpoint || '/api/email', timers = o.timers || { setInterval: (fn, ms) => setInterval(fn, ms), clearInterval: h => clearInterval(h) };
  let status: MailStatus = { enabled: false, canSend: false, canDraft: false, durable: false, address: null };
  let timer: any = null, polling = false; const seen = new Set<string>(); const subs = new Set<() => void>();
  async function call(body: unknown): Promise<{ ok: boolean; status: number; data: any }> {
    try { const r = await f(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); let data: any = null; try { data = await r.json(); } catch { /* HTML from a static host */ } return { ok: r.ok, status: r.status, data }; }
    catch { return { ok: false, status: 0, data: null }; }
  }
  async function poll() {
    if (polling || !status.enabled || (o.visible && !o.visible())) return; polling = true;
    try { const r = await call({ action: 'poll' }); if (r.ok && Array.isArray(r.data?.mail)) for (const m of r.data.mail) if (m && typeof m.id === 'string' && !seen.has(m.id)) { seen.add(m.id); o.onMail({ id: m.id, from: String(m.from || ''), subject: String(m.subject || ''), text: String(m.text || ''), receivedAt: Number(m.receivedAt) || 0 }); } }
    finally { polling = false; }
  }
  return {
    get status() { return status; },
    subscribe(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; },
    async start() {
      const r = await call({ action: 'status' });
      if (r.ok && r.data && typeof r.data === 'object') status = { enabled: !!r.data.enabled, canSend: !!r.data.canSend, canDraft: !!r.data.canDraft, durable: !!r.data.durable, address: typeof r.data.address === 'string' ? r.data.address : null };
      subs.forEach(fn => fn());
      if (status.enabled && !timer) { timer = timers.setInterval(() => void poll(), o.intervalMs ?? 20000); void poll(); }
      return status;
    },
    poll,
    async ack(id: string) { await call({ action: 'ack', id }); },
    async draft(id: string, snapshot: unknown): Promise<string | null> { const r = await call({ action: 'draft', id, snapshot }); return r.ok && typeof r.data?.draft === 'string' ? r.data.draft : null; },
    async send(id: string, body: string): Promise<{ ok: true } | { ok: false; code: string }> { const r = await call({ action: 'send', id, body }); return r.ok ? { ok: true } : { ok: false, code: String(r.data?.error || 'send_failed') }; },
    stop() { if (timer) { timers.clearInterval(timer); timer = null; } },
  };
}
export type MailClient = ReturnType<typeof createMailClient>;

/** A reply written from his built-in notes, used when the AI service is not available. */
export function offlineReply(mail: InMail, answer: (q: string) => { text: string; known: boolean }): string {
  const qs = (mail.text.replace(/\s+/g, ' ').match(/[^.!?]*\?/g) || []).map(s => s.trim()).filter(s => s.length > 6).slice(0, 3);
  const lines: string[] = ['Hello,', '', 'Thanks for the email.'];
  let unknown = 0;
  for (const q of qs) { const a = answer(q); if (a.known) lines.push('', `On "${q}": ${a.text}`); else unknown++; }
  if (!qs.length) lines.push('', "I've read it and noted it in the lab log.");
  if (unknown) lines.push('', `I don't have a solid answer for ${unknown === 1 ? 'one of your questions' : 'some of your questions'} in my notes, so I'll look into ${unknown === 1 ? 'it' : 'them'} and get back to you.`);
  lines.push('', 'Dr. Wire');
  return lines.join('\n').slice(0, 1500);
}
export const senderName = (from: string) => { const local = from.split('@')[0] || from; return local.replace(/[._-]+/g, ' ').trim() || from; };

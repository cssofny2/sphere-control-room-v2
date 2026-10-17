// Dr. Wire's workstation screens. This is the single place that says what is on the two LCDs, what he is
// typing and what came up. The 3D scene draws it onto the monitor textures, the page mirrors it as text,
// and the flows (look something up, order lunch, answer email) drive it. No three.js or React in here.

export type PageKind = 'search' | 'results' | 'menu' | 'cart' | 'supplier' | 'requisition' | 'offline' | 'blank';
export type Page = { kind: PageKind; title: string; site: string; lines: string[]; footer?: string };
export type MailView = { mode: 'inbox' | 'read' | 'compose' | 'sent'; from: string; subject: string; body: string; reply: string };
export type Handoff = { label: string; url: string };
export type DeskScreen =
  | { kind: 'idle' }
  | { kind: 'browser'; url: string; typing: string; field: 'address' | 'search' | 'none'; page: Page | null; loading: boolean }
  | { kind: 'email'; mail: MailView; typing: string };
export type DeskState = { screen: DeskScreen; handoff: Handoff | null; keys: number; rev: number };

export type DeskDeps = {
  sleep: (ms: number) => Promise<void>;
  /** Called for every key he presses so the typing sound can play. */
  onKey?: (ch: string) => void;
  /** Characters per second while typing. */
  cps?: number;
};

/** Only these hosts may be linked from the desk. Everything else is shown as text and never opened. */
const LINK_OK = /^https:\/\/(www\.)?(doordash\.com|mcdonalds\.com|mcmaster\.com|digikey\.com|mouser\.com|thorlabs\.com)\//;

export function createDesk(deps: DeskDeps) {
  const cps = deps.cps ?? 14;
  let state: DeskState = { screen: { kind: 'idle' }, handoff: null, keys: 0, rev: 0 };
  const subs = new Set<() => void>();
  let epoch = 0;
  const set = (screen: DeskScreen, handoff: Handoff | null | undefined = undefined) => {
    state = { screen, handoff: handoff === undefined ? state.handoff : handoff, keys: state.keys, rev: state.rev + 1 };
    subs.forEach(f => f());
  };
  const bump = () => { state = { ...state, keys: state.keys + 1, rev: state.rev + 1 }; subs.forEach(f => f()); };
  const stale = (my: number) => my !== epoch;

  /** Types `text` one character at a time into the current field. Resolves false if the desk was reset meanwhile. */
  async function typeText(text: string, apply: (typed: string) => void): Promise<boolean> {
    const my = epoch; let typed = '';
    for (const ch of text) {
      if (stale(my)) return false;
      typed += ch; apply(typed); bump();
      if (ch !== ' ') deps.onKey?.(ch); else deps.onKey?.(' ');
      await deps.sleep(Math.round(1000 / cps * (ch === ' ' ? 1.4 : 1) * (0.7 + ((typed.length * 37) % 7) / 10)));
    }
    return !stale(my);
  }

  const browser = (patch: Partial<Extract<DeskScreen, { kind: 'browser' }>>) => {
    const cur = state.screen.kind === 'browser' ? state.screen : { kind: 'browser' as const, url: '', typing: '', field: 'none' as const, page: null, loading: false };
    set({ ...cur, ...patch });
  };

  return {
    get state() { return state; },
    subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
    /** Clears the screens and cancels any typing in progress. */
    reset() { epoch++; set({ kind: 'idle' }, null); },
    cancel() { epoch++; },
    get epoch() { return epoch; },

    /** Opens a browser window and types the address, then shows the page. */
    async openUrl(url: string, page: Page): Promise<boolean> {
      browser({ url: '', typing: '', field: 'address', page: null, loading: false });
      if (!(await typeText(url, t => browser({ typing: t, field: 'address' })))) return false;
      browser({ url, typing: '', field: 'none', page: null, loading: true });
      await deps.sleep(500);
      browser({ url, typing: '', field: 'none', page, loading: false });
      return true;
    },
    /** Types into the page's search box. */
    async search(query: string): Promise<boolean> {
      const s = state.screen; const url = s.kind === 'browser' ? s.url : '';
      browser({ field: 'search', typing: '' });
      if (!(await typeText(query, t => browser({ typing: t, field: 'search' })))) return false;
      await deps.sleep(250); browser({ typing: query, field: 'none', loading: true, url });
      return true;
    },
    showPage(page: Page, url?: string) { const s = state.screen; browser({ page, loading: false, field: 'none', typing: '', url: url ?? (s.kind === 'browser' ? s.url : '') }); },
    setLoading(on: boolean) { browser({ loading: on }); },

    // ——— email ———
    showMail(mail: MailView) { set({ kind: 'email', mail, typing: '' }); },
    async typeReply(text: string): Promise<boolean> {
      const s = state.screen; const base: MailView = s.kind === 'email' ? s.mail : { mode: 'compose', from: '', subject: '', body: '', reply: '' };
      set({ kind: 'email', mail: { ...base, mode: 'compose', reply: '' }, typing: '' });
      return typeText(text, t => { const cur = state.screen; const m: MailView = cur.kind === 'email' ? cur.mail : base; set({ kind: 'email', mail: { ...m, mode: 'compose', reply: t }, typing: t }); });
    },
    markSent() { const s = state.screen; if (s.kind === 'email') set({ kind: 'email', mail: { ...s.mail, mode: 'sent' }, typing: '' }); },

    // ——— links the operator can click (never opened automatically) ———
    setHandoff(h: Handoff | null) { if (h && !LINK_OK.test(h.url)) return false; set(state.screen, h); return true; },
    isLinkAllowed: (url: string) => LINK_OK.test(url),
  };
}
export type Desk = ReturnType<typeof createDesk>;

/** A plain-text description of what is on screen, for the page mirror and screen readers. */
export function describeScreen(s: DeskScreen): string[] {
  if (s.kind === 'idle') return ['Desktop. Nothing open.'];
  if (s.kind === 'email') {
    const m = s.mail; const out = [`Email — ${m.mode === 'compose' ? 'writing a reply' : m.mode === 'sent' ? 'reply sent' : m.mode === 'read' ? 'reading' : 'inbox'}`];
    if (m.from) out.push(`From: ${m.from}`); if (m.subject) out.push(`Subject: ${m.subject}`); if (m.body) out.push(m.body); if (m.mode === 'compose' || m.mode === 'sent') out.push(`Reply: ${m.reply}`);
    return out;
  }
  const out = [`Browser — ${s.url || '(new tab)'}${s.loading ? ' (loading…)' : ''}`];
  if (s.field === 'address') out.push(`Address bar: ${s.typing}`); if (s.field === 'search') out.push(`Search box: ${s.typing}`);
  if (s.page) { out.push(s.page.title); out.push(...s.page.lines); if (s.page.footer) out.push(s.page.footer); }
  return out;
}

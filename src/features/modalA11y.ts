// Keyboard and screen-reader behaviour shared by every pop-up dialog (calibration, confirmations, wizard, command palette,
// import preview, ...). The dialogs are plain full-screen overlays; this watches for them and gives each one a dialog role,
// moves focus into it, keeps Tab inside, closes it on Escape through its own Close/Cancel button, and returns focus on close.

/** Index to focus after Tab (or Shift+Tab) from `index` among `len` focusable elements; wraps around. */
export function nextFocusIndex(index: number, len: number, shift: boolean): number {
  if (len <= 0) return -1;
  if (shift) return index <= 0 ? len - 1 : index - 1;
  return index < 0 || index >= len - 1 ? 0 : index + 1;
}

const OVERLAY = 'div.fixed.inset-0';
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const CLOSE_TEXT = /^\s*(close|cancel|dismiss|done|not now|no thanks|start fresh|×|x)\s*$/i;

const visible = (el: HTMLElement) => !el.hidden && el.getClientRects().length > 0;
const focusables = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);

function closeButton(root: HTMLElement): HTMLElement | null {
  const buttons = [...root.querySelectorAll<HTMLElement>('button')];
  return buttons.find(b => /close/i.test(b.getAttribute('aria-label') || '')) ?? buttons.find(b => CLOSE_TEXT.test(b.textContent || '')) ?? null;
}

export function installModalA11y(doc: Document = document): () => void {
  const managed = new Map<HTMLElement, { opener: Element | null; onKey: (e: KeyboardEvent) => void }>();

  const adopt = (el: HTMLElement) => {
    if (managed.has(el)) return;
    const opener = doc.activeElement;
    if (!el.hasAttribute('role')) el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) {
      const heading = el.querySelector('h1,h2,h3,h4,[class*="font-bold"]')?.textContent?.trim();
      el.setAttribute('aria-label', heading ? heading.slice(0, 80) : 'Dialog');
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { const b = closeButton(el); if (b) { e.preventDefault(); e.stopPropagation(); b.click(); } return; }
      if (e.key !== 'Tab') return;
      const list = focusables(el);
      if (!list.length) { e.preventDefault(); return; }
      const at = list.indexOf(doc.activeElement as HTMLElement);
      const next = nextFocusIndex(at, list.length, e.shiftKey);
      if (at === -1 || (e.shiftKey && at === 0) || (!e.shiftKey && at === list.length - 1)) { e.preventDefault(); list[next].focus(); }
    };
    el.addEventListener('keydown', onKey);
    managed.set(el, { opener, onKey });
    if (!el.contains(doc.activeElement)) {
      const first = focusables(el).find(f => f.tagName === 'INPUT' || f.tagName === 'SELECT' || f.tagName === 'TEXTAREA') ?? focusables(el)[0];
      if (first) first.focus(); else { el.tabIndex = -1; el.focus(); }
    }
  };

  const sweep = () => {
    doc.querySelectorAll<HTMLElement>(OVERLAY).forEach(adopt);
    for (const [el, info] of managed) {
      if (el.isConnected) continue;
      el.removeEventListener('keydown', info.onKey);
      managed.delete(el);
      if (info.opener instanceof HTMLElement && info.opener.isConnected) info.opener.focus();
    }
  };

  const observer = new MutationObserver(sweep);
  observer.observe(doc.body, { childList: true, subtree: true });
  sweep();
  return () => { observer.disconnect(); managed.forEach((info, el) => el.removeEventListener('keydown', info.onKey)); managed.clear(); };
}

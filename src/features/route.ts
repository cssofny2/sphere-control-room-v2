// Deep links: each workspace page has a hash address (#/vna), and ?embed=1 asks for a compact view for iframes.

/** The page ids the app can show. Anything else in a link is ignored rather than trusted. */
export const PAGE_IDS = ['overview', 'dashboard', 'chamber', 'copilot', 'timeline', 'spatial', 'vna', 'ldv', 'scope', 'clock', 'runs', 'insights', 'notebook', 'training', 'challenges', 'faults', 'learn', 'settings'] as const;
export type PageId = typeof PAGE_IDS[number];

export const isPageId = (v: unknown): v is PageId => typeof v === 'string' && (PAGE_IDS as readonly string[]).includes(v);

/** `#/vna` or `#vna` gives "vna"; unknown or malformed hashes give null. */
export function pageFromHash(hash: string): PageId | null {
  const m = /^#\/?([a-z]+)\/?$/.exec(hash.trim());
  return m && isPageId(m[1]) ? m[1] : null;
}

export const hashForPage = (page: string): string => (isPageId(page) ? `#/${page}` : '');

export function isEmbed(search: string): boolean {
  const v = new URLSearchParams(search).get('embed');
  return v === '1' || v === 'true';
}

/** A link to a page of this app. The embed flag is dropped so shared links open the full lab. */
export function shareUrl(page: string, loc: { origin: string; pathname: string }): string {
  return `${loc.origin}${loc.pathname}${hashForPage(page)}`;
}

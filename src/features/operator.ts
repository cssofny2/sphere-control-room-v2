// Who is at the bench. The profile is typed by the person using the simulator, kept in this browser only,
// stamped on every journal entry / alarm / notebook note / export, and handed to Dr. Wire so he can greet them by name.

export type OperatorProfile = { name: string; nickname: string; initials: string };

export const EMPTY_OPERATOR: OperatorProfile = Object.freeze({ name: '', nickname: '', initials: '' });
export const OPERATOR_STORAGE_KEY = 'sphere.operator.profile';

const MAX = { name: 40, nickname: 20, initials: 4 } as const;
// Letters, digits, spaces and a few name punctuation marks; everything else (control characters, markup) is dropped.
const clean = (v: unknown, max: number) => String(v ?? '').replace(/[^\p{L}\p{N} .'’\-_]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max);

/** First letters of up to three words of the name (or the nickname when no name is given), upper-cased. */
export function deriveInitials(name: string, nickname = ''): string {
  const src = clean(name, MAX.name) || clean(nickname, MAX.nickname);
  const words = src.split(/[\s\-_.]+/).filter(Boolean);
  return words.slice(0, 3).map(w => Array.from(w)[0]).join('').toUpperCase().slice(0, MAX.initials);
}

export function sanitizeProfile(p: Partial<OperatorProfile> | null | undefined): OperatorProfile {
  const name = clean(p?.name, MAX.name), nickname = clean(p?.nickname, MAX.nickname);
  const typed = clean(p?.initials, MAX.initials).replace(/[ .'’\-_]/g, '').toUpperCase();
  return { name, nickname, initials: typed || deriveInitials(name, nickname) };
}

export const hasOperator = (p: Partial<OperatorProfile> | null | undefined) => !!(p && (p.name || p.nickname || p.initials));

/** Short tag written in front of log lines, e.g. "MG". */
export const operatorTag = (p: Partial<OperatorProfile> | null | undefined): string => (p ? (p.initials || deriveInitials(p.name || '', p.nickname || '') || p.nickname || p.name || '') : '');

/** What a person would call them out loud: nickname first, then the first word of the name. */
export const operatorCallName = (p: Partial<OperatorProfile> | null | undefined): string => (p ? (p.nickname || (p.name || '').split(' ')[0] || '') : '');

/** The longest friendly form, for headings and exports. */
export const operatorFullName = (p: Partial<OperatorProfile> | null | undefined): string => {
  if (!p) return '';
  if (p.name && p.nickname && p.nickname.toLowerCase() !== p.name.toLowerCase()) return `${p.name} ("${p.nickname}")`;
  return p.name || p.nickname || p.initials || '';
};

export function loadOperator(storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null): OperatorProfile {
  try { const raw = storage?.getItem(OPERATOR_STORAGE_KEY); return raw ? sanitizeProfile(JSON.parse(raw)) : { ...EMPTY_OPERATOR }; } catch { return { ...EMPTY_OPERATOR }; }
}

export function saveOperator(p: OperatorProfile, storage: Pick<Storage, 'setItem' | 'removeItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null) {
  try { if (hasOperator(p)) storage?.setItem(OPERATOR_STORAGE_KEY, JSON.stringify(sanitizeProfile(p))); else storage?.removeItem(OPERATOR_STORAGE_KEY); } catch { /* storage can be blocked; the profile then lasts for this page only */ }
}

/** One plain sentence for Dr. Wire's briefing; empty when nobody has introduced themselves. */
export function operatorBriefing(p: Partial<OperatorProfile> | null | undefined): string {
  if (!hasOperator(p)) return '';
  const bits = [p!.name && `name ${p!.name}`, p!.nickname && `goes by ${p!.nickname}`, p!.initials && `initials ${p!.initials}`].filter(Boolean);
  return `The person at the bench entered their profile: ${bits.join(', ')}. Log entries are stamped with ${operatorTag(p) || 'their name'}.`;
}

// Number formatting for readings: digit grouping so long frequencies can be read at a glance (230 500.123 Hz), with a
// non-breaking thin space so a number never wraps in the middle.

const THIN = ' ';

/** Groups the integer digits of a plain decimal string in threes. Numbers under 5 integer digits are left alone. */
export function groupDigits(text: string): string {
  const m = /^(-?)(\d+)(\.\d+)?$/.exec(text);
  if (!m || m[2].length < 5) return text;
  return `${m[1]}${m[2].replace(/\B(?=(\d{3})+(?!\d))/g, THIN)}${m[3] ?? ''}`;
}

/** Fixed decimals with digit grouping; a dash for anything that is not a finite number. */
export function fmtNum(v: unknown, decimals = 3): string {
  return typeof v === 'number' && Number.isFinite(v) ? groupDigits(v.toFixed(decimals)) : '–';
}

export const fmtHz = (v: unknown, decimals = 3): string => (typeof v === 'number' && Number.isFinite(v) ? `${fmtNum(v, decimals)} Hz` : '–');

/** "± 0.042 Hz" for an uncertainty, or an empty string when there is none. */
export const fmtPlusMinus = (v: unknown, decimals = 3): string => (typeof v === 'number' && Number.isFinite(v) ? `± ${v.toFixed(decimals)} Hz` : '');

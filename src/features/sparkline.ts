// A tiny trend line for the Operator Console tiles. Pure: numbers in, an SVG path out.

export interface Spark { readonly path: string; readonly min: number; readonly max: number; readonly last: { x: number; y: number } | null; readonly count: number }

/**
 * Maps `values` (null = gap) into a width x height box. A flat series is drawn in the middle. Non-finite values are
 * treated as gaps, and `log` plots log10 of positive values (pressure).
 */
export function sparkline(values: ReadonlyArray<number | null>, width: number, height: number, log = false, pad = 2): Spark {
  const v = values.map(x => (typeof x === 'number' && Number.isFinite(x) && (!log || x > 0) ? (log ? Math.log10(x) : x) : null));
  const finite = v.filter((x): x is number => x !== null);
  if (finite.length < 2) return { path: '', min: finite[0] ?? NaN, max: finite[0] ?? NaN, last: null, count: finite.length };
  const lo = Math.min(...finite), hi = Math.max(...finite), span = hi - lo;
  const n = v.length, step = n > 1 ? (width - 2 * pad) / (n - 1) : 0;
  let path = '', pen = false, last: { x: number; y: number } | null = null;
  v.forEach((x, i) => {
    if (x === null) { pen = false; return; }
    const px = pad + i * step, py = span < 1e-12 ? height / 2 : pad + (1 - (x - lo) / span) * (height - 2 * pad);
    path += `${pen ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`; pen = true; last = { x: px, y: py };
  });
  return { path, min: log ? 10 ** lo : lo, max: log ? 10 ** hi : hi, last, count: finite.length };
}

/** Evenly thins a long series to at most `max` points, always keeping the last. */
export function thin<T>(items: readonly T[], max: number): T[] {
  if (items.length <= max || max < 2) return items.slice(-Math.max(max, 0) || items.length);
  const out: T[] = [], step = (items.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(items[Math.round(i * step)]);
  return out;
}

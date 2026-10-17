// Request guards shared by the lookup and email endpoints: same-origin check, per-client rate limit and a
// daily spend counter. Limits live in memory, so they are best-effort per serverless instance.
export type Env = Record<string, string | undefined>;

export const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });

export function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  return fwd.split(',')[0].trim();
}

export function originAllowed(req: Request, env: Env): boolean {
  const origin = req.headers.get('origin'); if (!origin) return false;
  let host = ''; try { host = new URL(origin).host; } catch { return false; }
  const own = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  if (host === own) return true;
  const extra = (env.TECHNICIAN_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (extra.includes(origin)) return true;
  return env.VERCEL_ENV !== 'production' && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}

export function createLimiter() {
  const hits = new Map<string, number[]>();
  return (key: string, now: number, perMin: number): boolean => {
    const arr = (hits.get(key) || []).filter(t => now - t < 60000);
    if (arr.length >= perMin) { hits.set(key, arr); return true; }
    arr.push(now); hits.set(key, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < 60000)) hits.delete(k);
    return false;
  };
}

export function createSpend() {
  const s = { day: '', usd: 0 };
  return {
    over(now: number, cap: number) { const day = new Date(now).toISOString().slice(0, 10); if (s.day !== day) { s.day = day; s.usd = 0; } return s.usd >= cap; },
    add(usd: number) { s.usd += usd; },
  };
}

/** Constant-time string comparison for shared secrets. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0;
}

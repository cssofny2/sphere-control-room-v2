// Browser side of api/lookup.ts. Never throws: failures come back as { ok: false, code } so Dr. Wire can say so honestly.
export type Source = { title: string; url: string; domain: string };
export type LookupOutcome = { ok: true; answer: string; sources: Source[] } | { ok: false; code: 'not_deployed' | 'no_key' | 'rate_limited' | 'cap_reached' | 'no_answer' | 'offline' | 'error'; sources: Source[] };

export async function fetchLookup(query: string, o: { fetchImpl?: typeof fetch; endpoint?: string; signal?: AbortSignal } = {}): Promise<LookupOutcome> {
  const f = o.fetchImpl || fetch;
  let res: Response;
  try { res = await f(o.endpoint || '/api/lookup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }), signal: o.signal }); }
  catch { return { ok: false, code: 'offline', sources: [] }; }
  let body: any = null; try { body = await res.json(); } catch { /* not JSON: a static host answers with HTML */ }
  if (!res.ok || !body || typeof body !== 'object') {
    const code = res.status === 404 || res.status === 405 || !body ? 'not_deployed' : body?.error === 'no_key' ? 'no_key' : body?.error === 'rate_limited' ? 'rate_limited' : body?.error === 'cap_reached' ? 'cap_reached' : 'error';
    return { ok: false, code, sources: [] };
  }
  const sources: Source[] = Array.isArray(body.sources) ? body.sources.filter((s: any) => s && typeof s.url === 'string').slice(0, 4).map((s: any) => ({ title: String(s.title || s.domain || ''), url: String(s.url), domain: String(s.domain || '') })) : [];
  if (body.error || typeof body.answer !== 'string' || !body.answer.trim()) return { ok: false, code: 'no_answer', sources };
  return { ok: true, answer: body.answer.trim(), sources };
}

// Browser side of api/lookup.ts. Never throws: failures come back as { ok: false, code } so Dr. Wire can say so honestly.
// Order: the lab's search service (live web, or AI general knowledge if search is down), then Wikipedia straight from the
// browser (no key needed) so he can still answer most "what is / who was" questions when the service is not set up.
export type Source = { title: string; url: string; domain: string };
/** web = live search, encyclopedia = Wikipedia, ai = the AI's own general knowledge (not a fresh search). */
export type Via = 'web' | 'encyclopedia' | 'ai';
export type LookupFail = 'not_deployed' | 'no_key' | 'rate_limited' | 'cap_reached' | 'no_answer' | 'offline' | 'error';
export type LookupOutcome = { ok: true; answer: string; sources: Source[]; via: Via } | { ok: false; code: LookupFail; sources: Source[] };

const firstSentences = (t: string, n: number) => (t.replace(/\s+/g, ' ').replace(/\([^)]*\)/g, '').match(/[^.!?]+[.!?]+(\s|$)/g) || [t]).slice(0, n).join('').replace(/\s+/g, ' ').trim();
const topicOf = (q: string) => q.replace(/[?!.]+$/g, '').replace(/^\s*(?:(?:what|who|where|when)(?:'s| is| are| was| were)|tell me (?:about|something about)|explain|define|how (?:does|do|did)|why (?:is|are|does|do|did)|who (?:invented|discovered|wrote|founded))\s+(?:an?\s+|the\s+)?/i, '').trim().slice(0, 120);

/** Wikipedia summary for a question. Returns null when nothing relevant comes back. */
export async function fetchEncyclopedia(query: string, o: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {}): Promise<LookupOutcome | null> {
  const f = o.fetchImpl || fetch; const topic = topicOf(query); if (topic.length < 2) return null;
  try {
    const s = await f(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&srlimit=1&format=json&origin=*`, { signal: o.signal });
    if (!s.ok) return null; const sj: any = await s.json(); const title = sj?.query?.search?.[0]?.title; if (typeof title !== 'string') return null;
    const r = await f(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, { signal: o.signal });
    if (!r.ok) return null; const j: any = await r.json();
    const extract = typeof j?.extract === 'string' ? firstSentences(j.extract, 2) : ''; if (!extract) return null;
    const url = typeof j?.content_urls?.desktop?.page === 'string' && /^https:\/\/en\.wikipedia\.org\//.test(j.content_urls.desktop.page) ? j.content_urls.desktop.page : `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    return { ok: true, answer: extract, via: 'encyclopedia', sources: [{ title: String(j?.title || title).slice(0, 90), url, domain: 'en.wikipedia.org' }] };
  } catch { return null; }
}

export async function fetchLookup(query: string, o: { fetchImpl?: typeof fetch; endpoint?: string; signal?: AbortSignal; encyclopedia?: boolean } = {}): Promise<LookupOutcome> {
  const first = await fetchService(query, o);
  if (first.ok === true || o.encyclopedia === false) return first;
  if (first.code === 'offline') return first;
  return (await fetchEncyclopedia(query, o)) || first;
}

async function fetchService(query: string, o: { fetchImpl?: typeof fetch; endpoint?: string; signal?: AbortSignal }): Promise<LookupOutcome> {
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
  return { ok: true, answer: body.answer.trim(), sources, via: body.via === 'ai' ? 'ai' : 'web' };
}

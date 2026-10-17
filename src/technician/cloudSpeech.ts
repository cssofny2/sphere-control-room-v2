// Natural-voice layer for the phone call. It wraps any SpeechIO (the browser one): listening, cancelling and the voice
// picker pass straight through, and speaking goes to the /api/tts neural voice when the server has it switched on.
// If the service is off, busy, slow or offline, Dr. Wire quietly keeps talking with the browser voice, so a call never goes silent.
import { pronounce } from './speechShape';
import type { SpeechIO } from './speech';

export type CloudDeps = {
  fetchImpl?: typeof fetch;
  /** Creates the audio player. Replaced in tests. */
  makeAudio?: (url: string) => HTMLAudioElement;
  endpoint?: string;
  timeoutMs?: number;
};

/** Cuts text into spoken chunks: the first one short (so the voice starts quickly), the rest a sentence or two each. */
export function chunkForVoice(text: string, first = 110, rest = 230): string[] {
  const sentences = text.replace(/\s+/g, ' ').trim().match(/(?:[^.!?]|[.!?](?=\d)|\.(?=\d))+[.!?]*\s*/g) || [];
  const out: string[] = []; let cur = '';
  for (const raw of sentences) {
    const s = raw.trim(); if (!s) continue;
    const limit = out.length === 0 ? first : rest;
    if (cur && (cur + ' ' + s).length > limit) { out.push(cur); cur = s; } else cur = cur ? cur + ' ' + s : s;
    while (cur.length > 400) { const cut = cur.lastIndexOf(',', 300) > 80 ? cur.lastIndexOf(',', 300) + 1 : cur.lastIndexOf(' ', 300); out.push(cur.slice(0, cut).trim()); cur = cur.slice(cut).trim(); }
  }
  if (cur) out.push(cur);
  return out;
}

export type CloudSpeech = SpeechIO & { cloud: { available(): boolean; enabled(): boolean; setEnabled(on: boolean): void; ready(): Promise<boolean> } };

export function withCloudVoice(base: SpeechIO, deps: CloudDeps = {}): CloudSpeech {
  const f = () => deps.fetchImpl || fetch, endpoint = deps.endpoint || '/api/tts', timeoutMs = deps.timeoutMs ?? 9000;
  const lsKey = 'sphere.technician.studioVoice';
  let status: 'unknown' | 'on' | 'off' = 'unknown', user = true, probe: Promise<boolean> | null = null;
  try { user = window.localStorage?.getItem(lsKey) !== 'off'; } catch { /* storage may be blocked */ }
  const speakers = new Set<(s: boolean, p: number) => void>(); const emit = (s: boolean, p: number) => speakers.forEach(cb => { try { cb(s, p); } catch { /* ignore */ } });
  base.onSpeaking((s, p) => { if (!own) emit(s, p); });
  let own = false, token = 0, audio: HTMLAudioElement | null = null, pulse: ReturnType<typeof setInterval> | null = null, ctl: AbortController | null = null;
  const cache = new Map<string, string>();   // text -> blob url, so repeated lines play instantly
  let tail: Promise<void> = Promise.resolve();

  const ready = () => probe ||= (async () => {
    try {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 4000);
      const r = await f()(endpoint, { method: 'GET', signal: c.signal, headers: { accept: 'application/json' } }); clearTimeout(t);
      if (!r.ok || !/json/.test(r.headers.get('content-type') || '')) { status = 'off'; return false; }
      const j: any = await r.json(); status = j?.enabled === true ? 'on' : 'off';
    } catch { status = 'off'; }
    return status === 'on';
  })();
  void ready();

  const fetchClip = async (text: string, signal: AbortSignal): Promise<string | null> => {
    const hit = cache.get(text); if (hit) return hit;
    const t = setTimeout(() => ctl?.abort(), timeoutMs);
    try {
      const r = await f()(endpoint, { method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
      if (!r.ok || !/audio/.test(r.headers.get('content-type') || '')) { if (r.status !== 429) status = r.status >= 500 || r.status === 501 || r.status === 404 || r.status === 403 ? 'off' : status; return null; }
      const blob = await r.blob(); if (!blob.size) return null;
      const url = URL.createObjectURL(blob); cache.set(text, url);
      if (cache.size > 40) { const k = cache.keys().next().value as string; const u = cache.get(k); cache.delete(k); if (u) URL.revokeObjectURL(u); }
      return url;
    } catch { return null; } finally { clearTimeout(t); }
  };

  const stopAudio = () => { if (pulse) { clearInterval(pulse); pulse = null; } try { audio?.pause(); } catch { /* ignore */ } audio = null; };
  const play = (url: string, my: number) => new Promise<boolean>(resolve => {
    if (my !== token) { resolve(true); return; }
    const a = deps.makeAudio ? deps.makeAudio(url) : new Audio(url); audio = a;
    let done = false; const end = (ok: boolean) => { if (done) return; done = true; if (audio === a) stopAudio(); resolve(ok); };
    a.onended = () => end(true); a.onerror = () => end(false);
    a.onplaying = () => { if (!own) { own = true; emit(true, 0.6); } if (!pulse) pulse = setInterval(() => emit(true, 0.45 + Math.random() * 0.55), 90); };
    a.play().then(() => { /* playing */ }, () => end(false));   // blocked autoplay or decode problem: the caller falls back to the browser voice
  });

  const speakCloud = async (text: string): Promise<void> => {
    const my = token; const parts = chunkForVoice(pronounce(text)); if (!parts.length) return;
    ctl = new AbortController(); const signal = ctl.signal;
    let next: Promise<string | null> = fetchClip(parts[0], signal);
    for (let i = 0; i < parts.length; i++) {
      const url = await next; if (my !== token) return;
      if (i + 1 < parts.length) next = fetchClip(parts[i + 1], signal);   // fetch the next phrase while this one plays
      if (!url || !(await play(url, my))) { if (my !== token) return; const rest = parts.slice(i).join(' '); own = false; await base.speak(rest); return; }
    }
    if (my === token && own) { own = false; emit(false, 0); }
  };

  return {
    ...base,
    supported: base.supported,
    listen: () => base.listen(), stopListening: () => base.stopListening(), isListening: () => base.isListening(),
    onTranscript: cb => base.onTranscript(cb), onError: cb => base.onError(cb),
    onSpeaking(cb) { speakers.add(cb); return () => { speakers.delete(cb); }; },
    isSpeaking: () => own || base.isSpeaking(),
    voices: base.voices?.bind(base), setVoice: base.setVoice?.bind(base), currentVoice: base.currentVoice?.bind(base),
    speak(text: string) {
      const run = async () => {
        if (user && status === 'unknown') await ready();
        if (!user || status !== 'on') { await base.speak(text); return; }
        await speakCloud(text);
      };
      const p = tail.then(run, run); tail = p.catch(() => undefined); return p;
    },
    cancel() { token++; ctl?.abort(); stopAudio(); if (own) { own = false; emit(false, 0); } base.cancel(); },
    dispose() { token++; ctl?.abort(); stopAudio(); cache.forEach(u => URL.revokeObjectURL(u)); cache.clear(); base.dispose(); },
    cloud: {
      available: () => status === 'on', enabled: () => user && status === 'on',
      setEnabled(on: boolean) { user = on; try { if (on) window.localStorage?.removeItem(lsKey); else window.localStorage?.setItem(lsKey, 'off'); } catch { /* ignore */ } },
      ready,
    },
  };
}

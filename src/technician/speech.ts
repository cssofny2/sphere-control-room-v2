// Speech in and out for the phone call. The rest of the app only knows the SpeechIO interface, so a
// cloud speech provider can replace the browser one later without touching the call logic.

export interface SpeechIO {
  readonly supported: { listen: boolean; speak: boolean };
  /** Start listening (continuous). Safe to call twice. */
  listen(): void;
  stopListening(): void;
  isListening(): boolean;
  /** Registers a transcript callback. `final` is false for live partial text. Returns an unsubscribe function. */
  onTranscript(cb: (text: string, final: boolean) => void): () => void;
  /** Reports recognition problems, e.g. 'mic-denied' or 'no-speech-service'. */
  onError(cb: (code: string) => void): () => void;
  /** Speaks one chunk of text. Chunks queue. Resolves when finished or cancelled. */
  speak(text: string): Promise<void>;
  /** Stops speaking now and clears the queue. */
  cancel(): void;
  isSpeaking(): boolean;
  /** Called with true/false when speech starts and ends, and with word-boundary pulses for lip-sync. */
  onSpeaking(cb: (speaking: boolean, pulse: number) => void): () => void;
  dispose(): void;
}

type Provider = () => SpeechIO;
const providers: Record<string, Provider> = {};
export function registerSpeechProvider(name: string, p: Provider) { providers[name] = p; }
export function createSpeech(name = 'browser'): SpeechIO { return (providers[name] || providers.browser)(); }

const listeners = <T extends unknown[]>() => {
  const set = new Set<(...a: T) => void>();
  return { add(cb: (...a: T) => void) { set.add(cb); return () => { set.delete(cb); }; }, emit(...a: T) { set.forEach(cb => { try { cb(...a); } catch { /* listener errors never break speech */ } }); } };
};

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter(v => /^en[-_]/i.test(v.lang));
  const prefer = [/google us english/i, /daniel/i, /alex/i, /david/i, /microsoft (guy|mark|david)/i, /male/i];
  for (const re of prefer) { const v = en.find(x => re.test(x.name)); if (v) return v; }
  return en.find(v => /en[-_]US/i.test(v.lang)) || en[0] || null;
}

export function createBrowserSpeech(): SpeechIO {
  const w = window as any;
  const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
  const synth: SpeechSynthesis | undefined = w.speechSynthesis;
  const supported = { listen: !!Rec, speak: !!synth && typeof w.SpeechSynthesisUtterance === 'function' };
  const tr = listeners<[string, boolean]>(), er = listeners<[string]>(), sp = listeners<[boolean, number]>();
  let rec: any = null, wantListen = false, restarts = 0, lastStart = 0;
  let speaking = false, queued = 0, token = 0;
  const pending: (() => void)[] = [];

  const startRec = () => {
    if (!Rec || !wantListen) return;
    try {
      rec = new Rec(); rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US'; rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; const t = String(r[0]?.transcript || '').trim(); if (t) tr.emit(t, !!r.isFinal); }
      };
      rec.onerror = (e: any) => {
        const code = String(e?.error || 'error');
        if (code === 'no-speech' || code === 'aborted') return;
        if (code === 'not-allowed' || code === 'service-not-allowed') { wantListen = false; er.emit('mic-denied'); return; }
        if (code === 'network' || code === 'language-not-supported') { wantListen = false; er.emit('no-speech-service'); return; }
        er.emit(code);
      };
      rec.onend = () => {
        rec = null;
        if (!wantListen) return;
        // Recognition stops by itself after silence; restart, but not in a tight loop.
        const now = Date.now(); restarts = now - lastStart < 1500 ? restarts + 1 : 0; lastStart = now;
        if (restarts > 5) { wantListen = false; er.emit('no-speech-service'); return; }
        window.setTimeout(startRec, 250);
      };
      lastStart = Date.now(); rec.start();
    } catch { rec = null; }
  };

  const finish = () => { queued = Math.max(0, queued - 1); if (queued === 0 && speaking) { speaking = false; sp.emit(false, 0); } };

  return {
    supported,
    listen() { if (!Rec) { er.emit('no-speech-service'); return; } if (wantListen) return; wantListen = true; restarts = 0; startRec(); },
    stopListening() { wantListen = false; try { rec?.stop(); } catch { /* already stopped */ } },
    isListening() { return wantListen; },
    onTranscript: tr.add, onError: er.add, onSpeaking: sp.add,
    speak(text: string) {
      return new Promise<void>(resolve => {
        if (!synth || !supported.speak || !text.trim()) { resolve(); return; }
        const my = token; queued++;
        const u = new w.SpeechSynthesisUtterance(text);
        const v = pickVoice(synth.getVoices()); if (v) u.voice = v; u.rate = 1.03; u.pitch = 0.95; u.lang = v?.lang || 'en-US';
        u.onstart = () => { if (!speaking) { speaking = true; sp.emit(true, 0.6); } };
        u.onboundary = () => sp.emit(true, 0.5 + Math.random() * 0.5);
        const done = () => { if (my === token) finish(); const i = pending.indexOf(done); if (i >= 0) pending.splice(i, 1); resolve(); };
        u.onend = done; u.onerror = done; pending.push(done);
        try { synth.speak(u); } catch { done(); }
      });
    },
    cancel() { token++; try { synth?.cancel(); } catch { /* ignore */ } pending.splice(0).forEach(f => f()); queued = 0; if (speaking) { speaking = false; sp.emit(false, 0); } },
    isSpeaking() { return speaking; },
    dispose() { wantListen = false; try { rec?.abort?.(); } catch { /* ignore */ } try { synth?.cancel(); } catch { /* ignore */ } },
  };
}
registerSpeechProvider('browser', createBrowserSpeech);

/** Watches the microphone loudness (0..1) so the call can detect the operator talking over Dr. Wire (barge-in). */
export function createMicMonitor(stream: MediaStream) {
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  let ctx: AudioContext | null = null, analyser: AnalyserNode | null = null, buf: Uint8Array<ArrayBuffer> | null = null;
  try { ctx = new AC(); const src = ctx!.createMediaStreamSource(stream); analyser = ctx!.createAnalyser(); analyser.fftSize = 512; src.connect(analyser); buf = new Uint8Array(new ArrayBuffer(analyser.fftSize)); } catch { ctx = null; }
  return {
    available: !!ctx,
    level(): number { if (!analyser || !buf) return 0; analyser.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; s += x * x; } return Math.min(1, Math.sqrt(s / buf.length) * 3); },
    dispose() { try { void ctx?.close(); } catch { /* ignore */ } ctx = null; analyser = null; },
  };
}

/** Asks for the microphone. Must be called from a click so the browser shows its permission prompt. */
export async function requestMic(): Promise<{ ok: true; stream: MediaStream } | { ok: false; reason: 'denied' | 'unsupported' | 'error' }> {
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, reason: 'unsupported' };
  try { const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); return { ok: true, stream }; }
  catch (e) { const n = (e as DOMException)?.name; return { ok: false, reason: n === 'NotAllowedError' || n === 'SecurityError' ? 'denied' : n === 'NotFoundError' ? 'unsupported' : 'error' }; }
}

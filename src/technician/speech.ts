// Speech in and out for the phone call. The rest of the app only knows the SpeechIO interface, so a
// cloud speech provider can replace the browser one later without touching the call logic.

import { chooseVoice, shapeSpeech, voiceScore } from './speechShape';
import { withCloudVoice } from './cloudSpeech';

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
  /** English voices the browser offers, best first, and a way to choose one (null = automatic). Optional: not every provider has them. */
  voices?(): string[];
  setVoice?(name: string | null): void;
  currentVoice?(): string;
  /** Present when a neural "studio" voice can be used instead of the browser voice (needs the server-side key). */
  cloud?: { available(): boolean; enabled(): boolean; setEnabled(on: boolean): void; ready(): Promise<boolean> };
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

/** Android Chrome gives the microphone to one user at a time, so a held getUserMedia stream starves speech recognition. */
export const isAndroid = () => typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '');

export function createBrowserSpeech(): SpeechIO {
  const w = window as any;
  const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
  const synth: SpeechSynthesis | undefined = w.speechSynthesis;
  const supported = { listen: !!Rec, speak: !!synth && typeof w.SpeechSynthesisUtterance === 'function' };
  const tr = listeners<[string, boolean]>(), er = listeners<[string]>(), sp = listeners<[boolean, number]>();
  let rec: any = null, wantListen = false, restarts = 0, lastStart = 0;
  let speaking = false, queued = 0, token = 0;
  const pending: (() => void)[] = [];
  let tail: Promise<void> = Promise.resolve(); let chosen: string | null = null;
  try { chosen = window.localStorage?.getItem('sphere.technician.voice') || null; } catch { /* storage may be blocked */ }
  const listVoices = () => { try { return synth ? Array.from(synth.getVoices()) : []; } catch { return []; } };

  const startRec = () => {
    if (!Rec || !wantListen) return;
    try {
      rec = new Rec(); rec.continuous = !isAndroid();   // Android Chrome repeats text in continuous mode; it restarts after every phrase instead
      rec.interimResults = true; rec.lang = 'en-US'; rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; const t = String(r[0]?.transcript || '').trim(); if (t) { restarts = 0; tr.emit(t, !!r.isFinal); } }
      };
      rec.onerror = (e: any) => {
        const code = String(e?.error || 'error');
        if (code === 'no-speech' || code === 'aborted') return;
        if (code === 'not-allowed' || code === 'service-not-allowed') { wantListen = false; er.emit('mic-denied'); return; }
        if (code === 'audio-capture') { wantListen = false; er.emit('mic-busy'); return; }
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
      // Each call is cut into phrases with their own pace and pitch and a short pause between them. Calls queue in order.
      const run = () => new Promise<void>(resolve => {
        const segs = shapeSpeech(text);
        if (!synth || !supported.speak || !segs.length) { resolve(); return; }
        const my = token; queued++; let i = 0, gap: ReturnType<typeof setTimeout> | null = null, over = false;
        const done = () => { if (over) return; over = true; if (gap) clearTimeout(gap); if (my === token) finish(); const k = pending.indexOf(done); if (k >= 0) pending.splice(k, 1); resolve(); };
        pending.push(done);
        const next = () => {
          if (over) return; if (my !== token || i >= segs.length) { done(); return; }
          const seg = segs[i++]; const u = new w.SpeechSynthesisUtterance(seg.text);
          const v = chooseVoice(listVoices(), chosen); if (v) u.voice = v; u.rate = seg.rate; u.pitch = seg.pitch; u.lang = v?.lang || 'en-US';
          u.onstart = () => { if (!speaking) { speaking = true; sp.emit(true, 0.6); } };
          u.onboundary = () => sp.emit(true, 0.5 + Math.random() * 0.5);
          u.onend = () => { if (over) return; if (i >= segs.length || my !== token) done(); else gap = setTimeout(next, seg.pauseMs); };
          u.onerror = done;
          try { synth.speak(u); } catch { done(); }
        };
        next();
      });
      const p = tail.then(run, run); tail = p.catch(() => undefined); return p;
    },
    cancel() { token++; try { synth?.cancel(); } catch { /* ignore */ } pending.splice(0).forEach(f => f()); queued = 0; if (speaking) { speaking = false; sp.emit(false, 0); } },
    isSpeaking() { return speaking; },
    voices() { return listVoices().filter(v => /^en[-_]/i.test(v.lang)).sort((a, b) => voiceScore(b) - voiceScore(a)).map(v => v.name); },
    setVoice(name: string | null) { chosen = name; try { if (name) window.localStorage?.setItem('sphere.technician.voice', name); else window.localStorage?.removeItem('sphere.technician.voice'); } catch { /* ignore */ } },
    currentVoice() { return chooseVoice(listVoices(), chosen)?.name || ''; },
    dispose() { wantListen = false; try { rec?.abort?.(); } catch { /* ignore */ } try { synth?.cancel(); } catch { /* ignore */ } },
  };
}
registerSpeechProvider('browser', createBrowserSpeech);
/** Browser listening plus the neural voice when the server has it on; falls back to the browser voice by itself. */
registerSpeechProvider('studio', () => withCloudVoice(createBrowserSpeech()));

/** Watches the microphone loudness (0..1) so the call can detect the operator talking over Dr. Wire (barge-in). */
export function createMicMonitor(stream: MediaStream) {
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  let ctx: AudioContext | null = null, analyser: AnalyserNode | null = null, buf: Uint8Array<ArrayBuffer> | null = null;
  try { if (!stream.getAudioTracks().some(t => t.readyState === 'live')) throw new Error('no live audio'); ctx = new AC(); const src = ctx!.createMediaStreamSource(stream); analyser = ctx!.createAnalyser(); analyser.fftSize = 512; src.connect(analyser); buf = new Uint8Array(new ArrayBuffer(analyser.fftSize)); } catch { ctx = null; }
  return {
    available: !!ctx,
    level(): number { if (!analyser || !buf) return 0; analyser.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; s += x * x; } return Math.min(1, Math.sqrt(s / buf.length) * 3); },
    dispose() { try { void ctx?.close(); } catch { /* ignore */ } ctx = null; analyser = null; },
  };
}

/** Asks for the microphone. Must be called from a click so the browser shows its permission prompt. */
export async function requestMic(): Promise<{ ok: true; stream: MediaStream } | { ok: false; reason: 'denied' | 'unsupported' | 'error' }> {
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, reason: 'unsupported' };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    // On Android the permission is all we need from this stream. Holding it open would block speech recognition, so release it now (barge-in detection is off there).
    if (isAndroid()) stream.getTracks().forEach(t => t.stop());
    return { ok: true, stream };
  }
  catch (e) { const n = (e as DOMException)?.name; return { ok: false, reason: n === 'NotAllowedError' || n === 'SecurityError' ? 'denied' : n === 'NotFoundError' ? 'unsupported' : 'error' }; }
}

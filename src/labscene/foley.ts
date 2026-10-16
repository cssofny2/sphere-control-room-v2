// Tiny Web Audio sound kit: phone ring, footsteps, latch and click sounds. Nothing is loaded from
// disk and nothing plays until a user gesture has created the AudioContext.

export class Foley {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = true;            // footsteps and small sounds (the phone ring always plays during a call)
  private ringTimer = 0;
  private ringing = false;

  private ensure(): AudioContext | null {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {}); return this.ctx; }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return null;
    try { this.ctx = new AC(); this.master = this.ctx!.createGain(); this.master!.gain.value = 0.5; this.master!.connect(this.ctx!.destination); } catch { this.ctx = null; }
    return this.ctx;
  }
  unlock() { this.ensure(); }
  get context() { return this.ctx; }

  private noise(dur: number, f0: number, f1: number, gain: number) {
    const c = this.ensure(); if (!c || !this.master) return;
    const n = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf; const filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.setValueAtTime(f0, c.currentTime); filt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), c.currentTime + dur);
    const g = c.createGain(); g.gain.value = gain; src.connect(filt); filt.connect(g); g.connect(this.master); src.start();
  }
  footstep() { if (this.muted) return; this.noise(0.09, 900, 200, 0.18); }
  latch() { if (this.muted) return; this.noise(0.05, 3000, 800, 0.2); }
  click() { if (this.muted) return; this.noise(0.03, 4000, 1500, 0.12); }

  private tone(freqs: number[], start: number, dur: number, gain: number) {
    const c = this.ctx; if (!c || !this.master) return;
    const g = c.createGain(); g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(gain, start + 0.01); g.gain.setValueAtTime(gain, start + dur - 0.02); g.gain.linearRampToValueAtTime(0, start + dur); g.connect(this.master);
    for (const f of freqs) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(g); o.start(start); o.stop(start + dur + 0.02); }
  }
  /** Classic two-tone telephone ring: two short bursts, a pause, repeat. */
  startRing() {
    if (this.ringing) return; const c = this.ensure(); if (!c) return; this.ringing = true;
    const burst = () => { if (!this.ringing || !this.ctx) return; const t0 = this.ctx.currentTime + 0.02; this.tone([440, 480], t0, 0.4, 0.14); this.tone([440, 480], t0 + 0.6, 0.4, 0.14); this.ringTimer = window.setTimeout(burst, 2600); };
    burst();
  }
  stopRing() { this.ringing = false; window.clearTimeout(this.ringTimer); }
  /** Short up-down tone that marks pick-up and hang-up. */
  blip(up: boolean) { const c = this.ensure(); if (!c) return; const t = c.currentTime + 0.01; this.tone(up ? [660] : [440], t, 0.12, 0.1); this.tone(up ? [880] : [330], t + 0.14, 0.14, 0.1); }
  dispose() { this.stopRing(); try { void this.ctx?.close(); } catch { /* ignore */ } this.ctx = null; this.master = null; }
}

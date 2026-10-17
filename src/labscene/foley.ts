// Tiny Web Audio sound kit: phone ring, footsteps, latch and click sounds. Nothing is loaded from
// disk and nothing plays until a user gesture has created the AudioContext.

// Web Audio sound kit: phone ring, layered footsteps, an ambient room bed (HVAC, lights, rack fans, pumps, wall-clock tick),
// latch and click sounds. Everything is synthesized, nothing is loaded from disk, and nothing plays until a user gesture
// has created the AudioContext.
export type LabSound = { power: boolean; roughing: boolean; turbo: boolean; rack: boolean };

export class Foley {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;       // dry bus
  private wet: GainNode | null = null;          // send to the room reverb
  private _muted = true;
  private ringTimer = 0;
  private ringing = false;
  private white: AudioBuffer | null = null;
  private pink: AudioBuffer | null = null;
  private amb: { stop: () => void; set: (l: LabSound) => void } | null = null;
  private tickTimer = 0;
  private step = 0;
  private lab: LabSound = { power: false, roughing: false, turbo: false, rack: false };
  /** Where the listener (camera) is relative to Dr. Wire and the wall clock. Set every frame by the scene. */
  dist = 3; pan = 0; clockDist = 6;

  /** Footsteps and small sounds. Turning sound on also starts the room bed; the phone ring always plays during a call. */
  get muted() { return this._muted; }
  set muted(v: boolean) { if (v === this._muted) return; this._muted = v; this.sync(); }

  private ensure(): AudioContext | null {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {}); return this.ctx; }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return null;
    try {
      const c: AudioContext = new AC(); this.ctx = c;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(c.destination);
      this.master = c.createGain(); this.master.gain.value = 0.5; this.master.connect(comp);
      // Room reverb: a generated impulse response (hard floor and walls, about 0.9 s tail, darker as it decays).
      const rate = c.sampleRate, len = Math.floor(rate * 0.9), ir = c.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { const e = Math.pow(1 - i / len, 3.2); lp += (Math.random() * 2 - 1 - lp) * (0.9 - 0.7 * (i / len)); d[i] = lp * e * 1.6; } }
      const conv = c.createConvolver(); conv.buffer = ir; this.wet = c.createGain(); this.wet.gain.value = 0.35; this.wet.connect(conv); conv.connect(this.master);
      const n = rate * 2; this.white = c.createBuffer(1, n, rate); this.pink = c.createBuffer(1, n, rate);
      const w = this.white.getChannelData(0), pk = this.pink.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < n; i++) { const x = Math.random() * 2 - 1; w[i] = x; b0 = 0.99765 * b0 + x * 0.099046; b1 = 0.963 * b1 + x * 0.2965164; b2 = 0.57 * b2 + x * 1.0526913; pk[i] = (b0 + b1 + b2 + x * 0.1848) * 0.2; }
    } catch { this.ctx = null; }
    return this.ctx;
  }
  unlock() { if (this.ensure()) this.sync(); }
  get context() { return this.ctx; }

  /** Pushes the powered state of the lab into the ambient bed (cheap; ignores repeats). */
  setLab(l: LabSound) { const o = this.lab; if (o.power === l.power && o.roughing === l.roughing && o.turbo === l.turbo && o.rack === l.rack) return; this.lab = { ...l }; this.amb?.set(this.lab); }

  private sync() {
    const run = !this._muted && !!this.ctx && this.ctx.state !== 'closed';
    if (run && !this.amb) { this.startAmbient(); this.startTick(); }
    if (!run && this.amb) { this.amb.stop(); this.amb = null; window.clearTimeout(this.tickTimer); }
  }

  /** A looping noise source through a filter and a gain, returned with its handles. */
  private loop(buf: AudioBuffer, type: BiquadFilterType, freq: number, q: number, gain: number, dest: AudioNode) {
    const c = this.ctx as AudioContext; const src = c.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = Math.random();
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(dest); src.start(); return { src, f, g };
  }
  private startAmbient() {
    const c = this.ctx, m = this.master, white = this.white, pink = this.pink; if (!c || !m || !white || !pink) return;
    const bus = c.createGain(); bus.gain.value = 0; bus.connect(m); if (this.wet) { const send = c.createGain(); send.gain.value = 0.25; bus.connect(send); send.connect(this.wet); }
    bus.gain.setTargetAtTime(1, c.currentTime, 1.2);
    const nodes: (AudioScheduledSourceNode)[] = [];
    // HVAC: air movement through a duct, a slow swell, plus a low rumble.
    const air = this.loop(pink, 'lowpass', 420, 0.5, 0.05, bus); nodes.push(air.src);
    const hiss = this.loop(white, 'bandpass', 2600, 0.7, 0.006, bus); nodes.push(hiss.src);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 0.012; lfo.connect(lg); lg.connect(air.g.gain); lfo.start(); nodes.push(lfo);
    // Fluorescent ballast hum: mains harmonics, very quiet.
    const hum = c.createGain(); hum.gain.value = 0.0075; hum.connect(bus);
    for (const [f, a] of [[60, 1], [120, 0.7], [180, 0.35], [240, 0.2]] as const) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; const og = c.createGain(); og.gain.value = a; o.connect(og); og.connect(hum); o.start(); nodes.push(o); }
    // Rack and PSU fans: only when the facility is powered.
    const fan = this.loop(white, 'bandpass', 900, 1.4, 0, bus); nodes.push(fan.src);
    const fan2 = this.loop(pink, 'bandpass', 210, 2.2, 0, bus); nodes.push(fan2.src);
    // Roughing pump: a low chuffing rotor (square through a lowpass, amplitude pulsed) plus mechanical noise.
    const rough = c.createGain(); rough.gain.value = 0; rough.connect(bus);
    const ro = c.createOscillator(); ro.type = 'sawtooth'; ro.frequency.value = 48; const rf = c.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 240; const rp = c.createGain(); rp.gain.value = 0.6;
    const rl = c.createOscillator(); rl.frequency.value = 14; const rlg = c.createGain(); rlg.gain.value = 0.35; rl.connect(rlg); rlg.connect(rp.gain);
    ro.connect(rf); rf.connect(rp); rp.connect(rough); ro.start(); rl.start(); nodes.push(ro, rl);
    const rn = this.loop(pink, 'bandpass', 520, 0.9, 0.5, rough); nodes.push(rn.src);
    // Turbo pump: a rising whine that settles at full speed.
    const turbo = c.createGain(); turbo.gain.value = 0; turbo.connect(bus);
    const to = c.createOscillator(); to.type = 'sine'; to.frequency.value = 200; const to2 = c.createOscillator(); to2.type = 'triangle'; to2.frequency.value = 400; const tg2 = c.createGain(); tg2.gain.value = 0.3;
    to.connect(turbo); to2.connect(tg2); tg2.connect(turbo); to.start(); to2.start(); nodes.push(to, to2);
    const set = (l: LabSound) => {
      const t = c.currentTime;
      fan.g.gain.setTargetAtTime(l.power ? 0.012 : 0, t, 1.5); fan2.g.gain.setTargetAtTime(l.power ? 0.03 : 0, t, 1.5);
      rough.gain.setTargetAtTime(l.roughing ? 0.05 : 0, t, 0.8);
      turbo.gain.setTargetAtTime(l.turbo ? 0.011 : 0, t, 2.5); to.frequency.setTargetAtTime(l.turbo ? 1180 : 200, t, 4); to2.frequency.setTargetAtTime(l.turbo ? 2360 : 400, t, 4);
    };
    set(this.lab);
    this.amb = { set, stop: () => { const t = c.currentTime; bus.gain.cancelScheduledValues(t); bus.gain.setTargetAtTime(0, t, 0.25); window.setTimeout(() => { for (const n of nodes) { try { n.stop(); } catch { /* already stopped */ } } try { bus.disconnect(); } catch { /* ignore */ } }, 1200); } };
  }

  /** Wall-clock tick, once per second, quiet and fading with distance. */
  private startTick() {
    window.clearTimeout(this.tickTimer);
    const go = () => { if (this._muted || !this.ctx) return; this.tick(); this.tickTimer = window.setTimeout(go, 1000 - (Date.now() % 1000) + 2); };
    this.tickTimer = window.setTimeout(go, 1000 - (Date.now() % 1000));
  }
  private tick() {
    const c = this.ctx, m = this.master; if (!c || !m || c.state !== 'running') return; const near = 1 / (1 + this.clockDist * this.clockDist * 0.18); if (near < 0.04) return;
    this.hit(c.currentTime, 'bandpass', 3400 + Math.random() * 200, 3, 0.012, 0.9 * near * 0.9, 0);
    const o = c.createOscillator(); o.type = 'square'; o.frequency.value = 1500; const g = c.createGain(); const t = c.currentTime; g.gain.setValueAtTime(0.0035 * near, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.012); o.connect(g); g.connect(m); o.start(t); o.stop(t + 0.02);
  }

  /** One short filtered-noise hit through a panner. */
  private hit(t: number, type: BiquadFilterType, freq: number, q: number, dur: number, gain: number, pan: number, sweepTo?: number, wet = 0.3) {
    const c = this.ctx, m = this.master, buf = this.white; if (!c || !m || !buf) return;
    const src = c.createBufferSource(); src.buffer = buf; const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t + dur); f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out: AudioNode = g; src.connect(f); f.connect(g);
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
    out.connect(m); if (this.wet && wet > 0) { const w = c.createGain(); w.gain.value = wet; out.connect(w); w.connect(this.wet); }
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }
  private thud(t: number, f0: number, f1: number, dur: number, gain: number, pan: number) {
    const c = this.ctx, m = this.master; if (!c || !m) return; const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g);
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(m); if (this.wet) { const w = c.createGain(); w.gain.value = 0.2; p.connect(w); w.connect(this.wet); } } else g.connect(m);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /**
   * One footfall on a hard lab floor: a heel thud, a sharp contact click, a short scuff of the sole, and now and then a rubber squeak.
   * Feet alternate sides, every step is slightly different, and the level, brightness and stereo position follow the camera.
   */
  footstep() {
    if (this._muted) return; const c = this.ensure(); if (!c || !this.master || c.state !== 'running') return;
    const t = c.currentTime + 0.005, side = (this.step++ & 1) ? 1 : -1, v = 0.75 + Math.random() * 0.3, pitch = 0.88 + Math.random() * 0.26;
    const near = 1 / (1 + this.dist * this.dist * 0.07), dark = Math.min(1, Math.max(0.35, 1.2 - this.dist * 0.08));   // far away: quieter and duller
    const pan = this.pan * 0.8 + side * 0.06, lvl = v * near * 1.5;
    this.thud(t, 135 * pitch, 55, 0.11, 0.55 * lvl, pan);
    this.hit(t, 'bandpass', 1500 * pitch * dark, 0.9, 0.035, 0.34 * lvl, pan, 700, 0.35);
    this.hit(t + 0.045, 'bandpass', 4200 * pitch * dark, 0.6, 0.085, 0.07 * lvl, pan, 2000, 0.25);   // the sole scuffs forward
    if (Math.random() < 0.09) {   // the odd squeak of rubber on vinyl
      const o = c.createOscillator(); o.type = 'triangle'; const f0 = 1700 + Math.random() * 900; o.frequency.setValueAtTime(f0, t + 0.01); o.frequency.linearRampToValueAtTime(f0 * (1.1 + Math.random() * 0.2), t + 0.07);
      const g = c.createGain(); g.gain.setValueAtTime(0, t + 0.01); g.gain.linearRampToValueAtTime(0.02 * lvl, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); o.connect(g); g.connect(this.master); o.start(t + 0.01); o.stop(t + 0.1);
    }
  }
  /** Phone cradle and door-latch clunk. */
  latch() { if (this._muted) return; const c = this.ensure(); if (!c || c.state !== 'running') return; const t = c.currentTime + 0.005; this.thud(t, 220, 90, 0.07, 0.3, 0); this.hit(t, 'bandpass', 2600, 2, 0.03, 0.22, 0, 900, 0.4); this.hit(t + 0.05, 'bandpass', 1800, 2.5, 0.025, 0.14, 0, 800, 0.4); }
  /** Relay or switch click on the rack. */
  click() { if (this._muted) return; const c = this.ensure(); if (!c || c.state !== 'running') return; const t = c.currentTime + 0.005; this.hit(t, 'bandpass', 3800, 3, 0.018, 0.2, this.pan * 0.5, 1800, 0.25); this.hit(t + 0.03, 'bandpass', 2600, 3, 0.02, 0.12, this.pan * 0.5, 1400, 0.25); }

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
  /** One key press on a mechanical keyboard. Plays whenever the audio is unlocked (it only happens while he is working at the computer). */
  typeKey(ch: string) {
    const c = this.ensure(); if (!c || !this.master || c.state !== 'running') return;
    const t = c.currentTime, big = ch === ' ' || ch === '\n';
    const n = Math.floor(c.sampleRate * (big ? 0.05 : 0.028)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, big ? 2.2 : 3.2);
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = (big ? 900 : 2200) * (0.85 + Math.random() * 0.4); bp.Q.value = 1.1;
    const g = c.createGain(); g.gain.value = (big ? 0.55 : 0.4) * (0.75 + Math.random() * 0.4);
    src.connect(bp); bp.connect(g); g.connect(this.master); src.start(t);
  }
  /** New-mail alert: a bright three-note chime that is easy to notice. */
  mailAlert() {
    const c = this.ensure(); if (!c) return; const t = c.currentTime + 0.02;
    this.tone([988], t, 0.16, 0.16); this.tone([1319], t + 0.18, 0.16, 0.16); this.tone([1568, 784], t + 0.36, 0.34, 0.16);
  }
  /** Short up-down tone that marks pick-up and hang-up. */
  blip(up: boolean) { const c = this.ensure(); if (!c) return; const t = c.currentTime + 0.01; this.tone(up ? [660] : [440], t, 0.12, 0.1); this.tone(up ? [880] : [330], t + 0.14, 0.14, 0.1); }
  dispose() { this.stopRing(); this.amb?.stop(); this.amb = null; window.clearTimeout(this.tickTimer); try { void this.ctx?.close(); } catch { /* ignore */ } this.ctx = null; this.master = null; }
}

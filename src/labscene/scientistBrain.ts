// "Dr. Wire" — the lab's wireframe scientist. This file is the NPC's brain: it reads a small
// snapshot of the experiment, notices what changed, and decides what to say. It has no
// rendering code, so it can be unit-tested in Node.

export type Facts = {
  power: boolean;
  clockPower: boolean;
  clockLocked: boolean;
  clockFault: boolean;
  doorOpen: boolean;
  pressure: number;          // Torr
  vent: boolean;
  roughing: boolean;
  turbo: boolean;
  tempDiff: number;          // °C from setpoint
  faraday: boolean;
  isolation: boolean;
  vnaPower: boolean;
  rf: boolean;
  calibrated: boolean;
  ldvPower: boolean;
  shutter: boolean;
  stageMoving: boolean;
  stageSettling: boolean;
  homed: boolean;
  scanActive: boolean;
  scanProgress: number;      // 0..1
  records: number;
  accepted: number;
  suspect: number;
  failed: number;
  failures: { clockDrift: boolean; vacuumLeak: boolean; ldvMisalign: boolean; emiSpike: boolean; stageBacklash: boolean };
  alarms: { id: string | number; text: string; severity: string }[]; // open (unacknowledged) alarms only
};

export type Focus = 'chamber' | 'stage' | 'rack' | 'bench' | 'door' | 'none';
export type Mood = 'happy' | 'neutral' | 'worried';
export type Remark = { id: string; text: string; kind: 'status' | 'alert' | 'hint' | 'joke'; focus: Focus; mood: Mood };

// Pulls the few fields the scientist cares about out of the app's state object.
export function extractFacts(s: any): Facts {
  const c = s.chamber, st = s.stage, v = s.vna, l = s.ldv, e = s.experiment, f = s.failures || {};
  return {
    power: !!s.facility.power,
    clockPower: !!s.clock.power,
    clockLocked: !!s.clock.locked,
    clockFault: !!(s.clock.cableFault || f.clockDrift),
    doorOpen: !!c.doorOpen,
    pressure: c.pressure,
    vent: !!c.vent,
    roughing: !!c.roughing,
    turbo: !!c.turbo,
    tempDiff: c.temperature - c.targetTemp,
    faraday: !!c.faraday,
    isolation: !!c.isolation,
    vnaPower: !!v.power,
    rf: !!v.rf,
    calibrated: !!v.calibrated,
    ldvPower: !!l.power,
    shutter: !!l.shutter,
    stageMoving: !!st.moving,
    stageSettling: !!st.settling,
    homed: !!st.homed,
    scanActive: !!e.scanActive,
    scanProgress: e.scanProgress || 0,
    records: (e.records || []).length,
    accepted: e.acceptedPoints || 0,
    suspect: e.suspectPoints || 0,
    failed: e.failedPoints || 0,
    failures: { clockDrift: !!f.clockDrift, vacuumLeak: !!f.vacuumLeak, ldvMisalign: !!f.ldvMisalign, emiSpike: !!f.emiSpike, stageBacklash: !!f.stageBacklash },
    alarms: (s.alarms || []).filter((a: any) => !a.acknowledged).map((a: any) => ({ id: a.id, text: String(a.text || ''), severity: String(a.severity || 'warning') })),
  };
}

export const JOKES: string[] = [
  "Why did the physicist bring a ladder to the lab? To reach a higher energy level.",
  "I'd tell you a joke about sodium, but Na.",
  "Never trust atoms. They make up everything.",
  "Heisenberg gets pulled over. 'Do you know how fast you were going?' 'No, but I know exactly where I am.'",
  "Old metrologists never die. They just lose their standards.",
  "Why did the resonator get promoted? Excellent Q.",
  "A photon checks into a hotel. 'Any luggage?' 'Nope, I'm traveling light.'",
  "Entropy isn't what it used to be.",
  "I'm reading a book about anti-gravity. It's impossible to put down.",
  "There are 10 kinds of people: those who understand binary, and those who don't.",
  "Why do scientists measure three times? Once is a data point, twice is a coincidence.",
  "I wanted to tell a joke about vibration isolation, but it didn't shake me.",
  "Our atomic clock is accurate to a second in millions of years. I'm still late to everything.",
  "I only talk to myself because I need an expert opinion.",
  "What's a metrologist's favorite music? Anything with good measures.",
  "If it's green or wriggles, it's biology. If it stinks, it's chemistry. If it doesn't work, it's physics.",
  "Why was the S11 trace so humble? It kept a low profile, with just one deep dip.",
  "I'd make a UDP joke, but you might not get it.",
  "Vacuum chambers: the only place where 'nothing' is a premium feature.",
  "I told my sphere it was well rounded. It resonated with that.",
  "The laser and the sphere are getting along fine. They have great chemistry. Or physics. I forget.",
  "Schrödinger's cat walks into the lab. Maybe.",
  "I would tell you a joke about the speed of light, but you wouldn't get it until later.",
  "Wave function collapsed. Hi! You caught me observing.",
];

const pick = <T,>(rng: () => number, a: T[]): T => a[Math.floor(rng() * a.length) % a.length];
const fmtP = (p: number) => (p >= 10 ? `${p.toFixed(0)} Torr` : `${p.toExponential(0)} Torr`);

// What would a good operator do next? Used for friendly idle hints.
export function nextStep(f: Facts): { text: string; focus: Focus } {
  if (!f.power) return { text: "The lab is cold and dark. Flip the main breaker in the top right to get started.", focus: 'rack' };
  if (!f.clockPower) return { text: "Next up: power on the Rubidium clock so every instrument shares one time base.", focus: 'rack' };
  if (!f.clockLocked) return { text: "The clock is still warming up. Lock first, measure later.", focus: 'rack' };
  if (f.doorOpen) return { text: "The chamber door is open. Close it before pumping down.", focus: 'door' };
  if (f.pressure >= 1e-3) return { text: f.roughing || f.turbo ? `Pumping down… we're at ${fmtP(f.pressure)}. Target is below 1e-3 Torr.` : "Start the roughing pump, then the turbo once we're under 50 Torr.", focus: 'chamber' };
  if (!f.faraday || !f.isolation) return { text: "Shielding or vibration isolation is off. Switch them on before measuring.", focus: 'chamber' };
  if (Math.abs(f.tempDiff) >= 0.03) return { text: `Temperature is ${f.tempDiff.toFixed(2)} °C from setpoint. Patience, thermal mass is stubborn.`, focus: 'chamber' };
  if (!f.vnaPower || !f.rf) return { text: "Power up the VNA and enable RF output.", focus: 'rack' };
  if (!f.calibrated) return { text: "The VNA isn't calibrated yet. Garbage in, garbage out.", focus: 'rack' };
  if (!f.ldvPower || !f.shutter) return { text: "Turn on the vibrometer and open its shutter when everyone has eye protection.", focus: 'rack' };
  if (!f.homed) return { text: "Home the stage so we know where zero really is.", focus: 'stage' };
  if (f.records === 0) return { text: "Everything's green. Start a scan from Experiment Runs and let's get data.", focus: 'bench' };
  return { text: "Data is in the bank. Review the spatial map and check the quality gate.", focus: 'bench' };
}

type Cand = { key: string; priority: number; text: string; kind: Remark['kind']; focus: Focus; mood: Mood };

export function createBrain(opts: { rng?: () => number; minGapMs?: number; idleMinMs?: number; idleMaxMs?: number } = {}) {
  const rng = opts.rng || Math.random;
  const minGap = opts.minGapMs ?? 5000;
  const idleMin = opts.idleMinMs ?? 14000, idleMax = opts.idleMaxMs ?? 24000;
  let prev: Facts | null = null;
  let lastSpokeAt = -Infinity;
  let nextIdleAt = 0;
  let queue: (Cand & { at: number })[] = [];
  const seenAlarms = new Set<string | number>();
  let jokeBag: number[] = [];
  let lastJoke = -1;
  let lastKey = '';
  let lastText = '';
  let greeted = false;
  let milestones = new Set<string>();
  let n = 0;

  const nextJoke = () => {
    if (!jokeBag.length) jokeBag = JOKES.map((_, i) => i).filter(i => i !== lastJoke).sort(() => rng() - 0.5);
    const i = jokeBag.pop() as number; lastJoke = i; return JOKES[i];
  };

  const diff = (now: number, f: Facts): Cand[] => {
    const out: Cand[] = [];
    const add = (key: string, priority: number, variants: string[], focus: Focus = 'none', mood: Mood = 'neutral', kind: Remark['kind'] = 'status') =>
      out.push({ key, priority, text: pick(rng, variants), kind, focus, mood });
    const p = prev as Facts;
    // — alarms and injected faults come first —
    for (const a of f.alarms) {
      if (seenAlarms.has(a.id)) continue;
      seenAlarms.add(a.id);
      const t = a.text.length > 96 ? a.text.slice(0, 93) + '…' : a.text;
      add('alarm:' + a.id, a.severity === 'critical' ? 10 : 8, a.severity === 'critical' ? [`Uh-oh. ${t}`, `Alarm! ${t}`] : [`Heads up: ${t}`, `Hm, ${t}`], 'none', 'worried', 'alert');
    }
    const fl = f.failures, pf = p.failures;
    if (fl.vacuumLeak && !pf.vacuumLeak) add('f:leak', 10, ["I hear a hiss. We might have a vacuum leak!", "Pressure's creeping up. That smells like a leak."], 'chamber', 'worried', 'alert');
    if (fl.clockDrift && !pf.clockDrift) add('f:drift', 9, ["The clock is drifting. Every timestamp just got suspicious.", "Reference drift detected. Frequency numbers can't be trusted right now."], 'rack', 'worried', 'alert');
    if (fl.ldvMisalign && !pf.ldvMisalign) add('f:ldv', 9, ["The laser spot wandered off. Optical return is dropping.", "Vibrometer looks misaligned. Time to realign the beam."], 'chamber', 'worried', 'alert');
    if (fl.emiSpike && !pf.emiSpike) add('f:emi', 9, ["Big RF noise burst! Someone's microwave is not helping.", "EMI spike. The S11 trace is going to look like a seismograph."], 'rack', 'worried', 'alert');
    if (fl.stageBacklash && !pf.stageBacklash) add('f:back', 8, ["The stage has some backlash. Approach positions from one direction.", "Stage feels sloppy. Backlash will bias the position."], 'stage', 'worried', 'alert');
    // — facility and instruments —
    if (f.power && !p.power) add('power-on', 6, ["Main power is on. Hear that hum? That's science warming up.", "Lights on, racks alive. Let's do this."], 'rack', 'happy');
    if (!f.power && p.power) add('power-off', 6, ["Everything just went dark. Hope that was on purpose.", "Breaker's off. The whole lab is napping."], 'rack', 'worried');
    if (f.clockPower && !p.clockPower && f.power) add('clock-on', 4, ["Rubidium clock is warming up. Fifteen seconds of patience, please.", "Clock's on. Atoms need a moment to get organised."], 'rack');
    if (f.clockLocked && !p.clockLocked) add('clock-lock', 6, ["Clock locked at 10 MHz. Now everyone agrees what a second is.", "We have lock! Time itself is behaving."], 'rack', 'happy');
    if (!f.clockLocked && p.clockLocked && f.clockPower && f.power) add('clock-lost', 7, ["We lost the clock lock. Frequency results are on thin ice.", "Clock slipped into holdover. It remembers the time, but it's guessing."], 'rack', 'worried');
    if (f.vnaPower && !p.vnaPower) add('vna-on', 3, ["VNA is on. Let it warm up before trusting those dB.", "Network analyzer's awake. Give it a minute."], 'rack');
    if (f.rf && !p.rf) add('rf-on', 4, f.calibrated ? ["RF is live and the VNA is calibrated. Sweeps look good.", "Transmitting. Calibrated. Beautiful."] : ["RF is on, but the VNA isn't calibrated. Bold choice.", "Sweeping uncalibrated. I'll allow it in training mode."], 'rack', f.calibrated ? 'happy' : 'neutral');
    if (f.calibrated && !p.calibrated) add('cal', 5, ["Calibration done. Now the S11 numbers mean something.", "Calibrated. Systematic errors, you're on notice."], 'rack', 'happy');
    if (f.shutter && !p.shutter) add('shutter-open', 5, ["Laser shutter open. Eye protection, everyone!", "Laser is live. Please don't look into the beam. Seriously."], 'chamber');
    if (!f.shutter && p.shutter && f.ldvPower) add('shutter-closed', 3, ["Shutter closed. Laser is safely back in its box."], 'chamber');
    // — chamber —
    if (f.doorOpen && !p.doorOpen) add('door-open', 7, ["Door's open. Vacuum is on hold until it's closed.", "Door open! Physics won't pump through an open door."], 'door', 'worried');
    if (!f.doorOpen && p.doorOpen) add('door-closed', 4, ["Door sealed. Ready to pump.", "Door's closed. Seal looks good."], 'door', 'happy');
    if (f.roughing && !p.roughing) add('rough', 4, ["Roughing pump is running. I can hear the scroll whirring.", "Pumping down. First stop, 50 Torr."], 'chamber');
    if (f.turbo && !p.turbo) add('turbo', 5, ["Turbo is spinning up. Listen to that whine.", "Turbopump engaged. Now we're getting serious about vacuum."], 'chamber', 'happy');
    if (p.pressure >= 50 && f.pressure < 50 && f.roughing) add('p50', 4, ["Under 50 Torr. The turbo is cleared to start."], 'chamber');
    if (p.pressure >= 1e-3 && f.pressure < 1e-3) add('p-deep', 7, ["Deep vacuum reached! Fewer molecules than a space-station snack drawer.", "Below 1e-3 Torr. The chamber is nicely empty."], 'chamber', 'happy');
    if (f.vent && !p.vent) add('vent', 4, ["Venting the chamber. Gently now, no turbulence shock.", "Letting the air back in. Say hello, molecules."], 'chamber');
    if (!f.faraday && p.faraday) add('far-off', 6, ["Faraday cage is off. RF noise will walk right in.", "Shield is down. Expect fuzzy S11 traces."], 'chamber', 'worried');
    if (f.faraday && !p.faraday) add('far-on', 3, ["Shielding restored. Quiet again."], 'chamber', 'happy');
    if (!f.isolation && p.isolation) add('iso-off', 6, ["Vibration isolation is bypassed. Don't sneeze near the table.", "Isolation off. The floor will be coming through the LDV."], 'chamber', 'worried');
    if (f.isolation && !p.isolation) add('iso-on', 3, ["Isolation back on. The table is floating again."], 'chamber', 'happy');
    if (Math.abs(p.tempDiff) >= 0.03 && Math.abs(f.tempDiff) < 0.03 && f.power) add('temp-ok', 5, ["Temperature is within 0.03 °C. Thermally rock steady.", "Thermal drift settled. The sphere can finally relax."], 'chamber', 'happy');
    if (Math.abs(p.tempDiff) < 0.03 && Math.abs(f.tempDiff) >= 0.03 && f.power) add('temp-drift', 4, ["Temperature is drifting off the setpoint. Resonance will follow it."], 'chamber', 'worried');
    // — stage —
    if (f.stageMoving && !p.stageMoving) add('stage-move', 2, ["Stage on the move. Waiting for it to settle before we record.", "Moving the sphere. Slowly and politely."], 'stage');
    if ((p.stageMoving || p.stageSettling) && !f.stageMoving && !f.stageSettling) add('stage-still', 3, ["Stage settled. Ring-down is over. Good time to measure."], 'stage', 'happy');
    // — acquisition —
    if (f.scanActive && !p.scanActive) { milestones = new Set(); add('scan-start', 6, ["Scan started. Time for coffee? I'll watch the numbers.", "And we're measuring! Sphere, do your thing."], 'bench', 'happy'); }
    if (f.scanActive && f.scanProgress >= 0.5 && !milestones.has('half')) { milestones.add('half'); add('scan-half', 4, ["Halfway through the scan. Looking good so far."], 'bench'); }
    if (f.scanActive && f.scanProgress >= 0.9 && !milestones.has('nine')) { milestones.add('nine'); add('scan-90', 4, ["Almost there. Ninety percent done."], 'bench'); }
    if (!f.scanActive && p.scanActive) add('scan-done', 7, [`Scan complete: ${f.records} records. Let's check the quality gate.`, `All done. ${f.records} data points in the bank.`], 'bench', 'happy');
    if (f.failed > p.failed) add('q-fail', 6, ["A point just failed the quality gate. Adaptive rescan will try again."], 'bench', 'worried');
    else if (f.suspect > p.suspect) add('q-sus', 4, ["Suspect point flagged. Something wasn't quite stable."], 'bench');
    if (f.records > 0 && p.records === 0 && !f.scanActive) add('first-rec', 4, ["First record captured. We have data!"], 'bench', 'happy');
    return out;
  };

  const emit = (c: Cand, now: number): Remark => {
    lastSpokeAt = now; lastKey = c.key; lastText = c.text;
    nextIdleAt = now + idleMin + rng() * (idleMax - idleMin);
    return { id: `r${++n}`, text: c.text, kind: c.kind, focus: c.focus, mood: c.mood };
  };

  return {
    /** Feed the latest facts. Returns something to say now, or null. */
    observe(f: Facts, now: number): Remark | null {
      if (!prev) {
        prev = f; for (const a of f.alarms) seenAlarms.add(a.id);
        nextIdleAt = now + 2500;
        return null;
      }
      const found = diff(now, f);
      prev = f;
      for (const c of found) queue.push({ ...c, at: now });
      queue = queue.filter(q => now - q.at < 25000);
      if (queue.length) {
        queue.sort((a, b) => b.priority - a.priority || a.at - b.at);
        const top = queue[0];
        const gap = top.priority >= 9 ? 2000 : minGap;
        if (now - lastSpokeAt >= gap) { queue.shift(); return emit(top, now); }
        return null;
      }
      if (!greeted && now >= nextIdleAt - 1000) {
        greeted = true;
        const s = nextStep(f);
        return emit({ key: 'greet', priority: 3, text: `Hi, I'm Dr. Wire, your lab buddy. ${s.text}`, kind: 'hint', focus: s.focus, mood: 'happy' }, now);
      }
      if (greeted && now >= nextIdleAt && now - lastSpokeAt >= minGap) {
        if (f.scanActive) return emit({ key: 'scan-prog', priority: 1, text: `Scan at ${Math.round(f.scanProgress * 100)}%. So far, so resonant.`, kind: 'status', focus: 'bench', mood: 'neutral' }, now);
        if (f.alarms.length) return emit({ key: 'idle-alarm', priority: 1, text: `${f.alarms.length} open alarm${f.alarms.length > 1 ? 's' : ''}. Might be worth a look.`, kind: 'hint', focus: 'none', mood: 'worried' }, now);
        if (rng() < 0.4 && nextStep(f).text !== lastText) { const s = nextStep(f); return emit({ key: 'hint', priority: 1, text: s.text, kind: 'hint', focus: s.focus, mood: 'neutral' }, now); }
        return emit({ key: 'joke', priority: 1, text: nextJoke(), kind: 'joke', focus: 'none', mood: 'happy' }, now);
      }
      return null;
    },
    /** The user asked him to say something: a joke, or a hint if the lab needs attention. */
    chat(f: Facts, now: number): Remark {
      queue = [];
      const s = nextStep(f);
      const needsHelp = f.alarms.length > 0 || (!f.power);
      if (needsHelp && s.text !== lastText) return emit({ key: 'hint', priority: 1, text: f.alarms.length ? `${f.alarms.length} open alarm${f.alarms.length > 1 ? 's' : ''}. ${s.text}` : s.text, kind: 'hint', focus: s.focus, mood: f.alarms.length ? 'worried' : 'neutral' }, now);
      return emit({ key: 'joke', priority: 1, text: nextJoke(), kind: 'joke', focus: 'none', mood: 'happy' }, now);
    },
    get lastKey() { return lastKey; },
  };
}

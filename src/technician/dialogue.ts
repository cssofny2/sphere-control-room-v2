// Dr. Wire's dialogue engine. Pure TypeScript, no DOM, so it can be unit-tested in Node.
//
// It watches the experiment facts and decides what to say, in what order and how loudly:
//   - stage scripts that quote live values (pressure, temperature, progress...)
//   - fault and alarm scripts: headline, cause, effect, check, fix, plus "hold off measuring"
//   - early trend warnings (pressure creeping up, temperature walking off, optical quality sliding)
//   - escalation of alarms and faults that stay unresolved
//   - no jokes during safety events
//   - a findings summary after a scan, and short session memory
//   - Coach / Quiet / Chatty modes, verbosity and joke-frequency sliders
//   - a log where every line records WHY it was said ("Why did you say that?")
import { JOKES } from '../labscene/scientistBrain';
import type { Focus, Mood } from '../labscene/scientistBrain';
import { fmtPressure, readiness, type FactsPlus } from './facts';
import { liveAnswer, knowledgeAnswer } from './answer';
import { NEW_JOKES, type JokeTopic } from './jokes';

export type TechMode = 'coach' | 'quiet' | 'chatty';
export type Settings = { mode: TechMode; verbosity: number; jokeFreq: number };
export const DEFAULT_SETTINGS: Settings = { mode: 'coach', verbosity: 0.5, jokeFreq: 0.5 };

export type Category = 'stage' | 'alarm' | 'fault' | 'trend' | 'escalation' | 'finding' | 'hint' | 'joke' | 'answer' | 'greeting' | 'task';
export type TechRemark = {
  id: string; text: string; lines: string[]; category: Category; kind: 'status' | 'alert' | 'hint' | 'joke' | 'answer' | 'finding';
  focus: Focus; mood: Mood; safety: boolean; why: string; key: string; at: number;
};
export type LogEntry = { id: string; at: number; text: string; category: Category; why: string; key: string };

export type MemoryData = {
  alarmsSeen: number;
  faultsSeen: Record<string, number>;
  scansDone: number;
  lastScan: { records: number; accepted: number; suspect: number; failed: number } | null;
  hintCounts: Record<string, number>;
  topics: Record<string, number>;
  unanswered: string[];
  jokesTold: number;
  questions: number;
};
export const emptyMemory = (): MemoryData => ({ alarmsSeen: 0, faultsSeen: {}, scansDone: 0, lastScan: null, hintCounts: {}, topics: {}, unanswered: [], jokesTold: 0, questions: 0 });

type FaultKey = keyof FactsPlus['failures'];
type FaultScript = { name: string; headline: string; cause: string; effect: string; check: string; fix: string; hold: string; symptom: string; focus: Focus };
export const FAULT_SCRIPTS: Record<FaultKey, FaultScript> = {
  vacuumLeak: {
    name: 'vacuum leak', headline: 'I think we have a vacuum leak.',
    cause: 'Cause: gas is getting in through a seal, gasket or fitting.',
    effect: 'Effect: pressure keeps rising, the turbo cannot hold deep vacuum, and the pressure check will keep failing.',
    check: 'Check: watch the pressure rate on the Chamber panel and inspect the door seal.',
    fix: 'Fix: clear the leak fault, or in a real lab re-seat the gasket and leak-check, then pump down again.',
    hold: 'Hold off measuring until we are back under 1e-3 Torr.',
    symptom: 'Pressure is climbing when it should be falling. Something is letting gas in.', focus: 'chamber',
  },
  clockDrift: {
    name: 'clock drift', headline: 'The reference clock is drifting.',
    cause: 'Cause: the Rubidium reference has lost its steady 10 MHz, or the clock cable is faulty.',
    effect: 'Effect: the VNA peak wanders and every frequency value gets suspicious.',
    check: 'Check: the Frequency Reference panel and the clock-lock rule in validation.',
    fix: 'Fix: clear the drift, then wait for a green LOCKED indicator.',
    hold: 'Pause measurements until lock is confirmed.',
    symptom: 'The frequency reference looks unstable and the resonance peak is wandering.', focus: 'rack',
  },
  ldvMisalign: {
    name: 'LDV misalignment', headline: 'The laser spot has wandered off target.',
    cause: 'Cause: the vibrometer beam is no longer pointing at the sphere.',
    effect: 'Effect: optical return and signal quality fall, so scan data gets patchy.',
    check: 'Check: optical quality and laser return on the LDV panel.',
    fix: 'Fix: re-align the LDV X and Y, refocus, and confirm the quality recovers.',
    hold: 'Keep the shutter closed while anyone is working at the chamber, and hold off scanning.',
    symptom: 'The optical return is dropping. The beam may not be on the sphere any more.', focus: 'chamber',
  },
  emiSpike: {
    name: 'EMI spike', headline: 'There is a burst of RF noise.',
    cause: 'Cause: an active interference source nearby.',
    effect: 'Effect: the scope shows a strong tone and the VNA noise floor rises even with the cage on.',
    check: 'Check: the scope FFT for a mains-frequency line.',
    fix: 'Fix: shielding alone will not remove an active source. Clear the fault and confirm the Faraday cage is on.',
    hold: 'Do not trust S11 traces until the noise is gone.',
    symptom: 'The traces are suddenly noisy even though the shielding is on.', focus: 'rack',
  },
  stageBacklash: {
    name: 'stage backlash', headline: 'The stage has backlash.',
    cause: 'Cause: mechanical play in the leadscrew.',
    effect: 'Effect: the stage never fully settles and the position jitters by a few hundredths of a millimetre.',
    check: 'Check: compare commanded and actual position.',
    fix: 'Fix: approach each position from the same direction and wait for settle before recording. Clear the fault in the simulator.',
    hold: 'Do not record until it settles.',
    symptom: 'The stage will not settle and the position keeps jittering.', focus: 'stage',
  },
};

const FOCUS_BY_TOPIC: Record<JokeTopic, Focus> = { general: 'none', vacuum: 'chamber', clock: 'rack', laser: 'chamber', vna: 'rack', stage: 'stage', data: 'bench', thermal: 'chamber' };
const ALL_JOKES: { text: string; topic: JokeTopic }[] = [...JOKES.map(text => ({ text, topic: 'general' as JokeTopic })), ...NEW_JOKES];

type Cand = { key: string; priority: number; lines: string[]; category: Category; kind: TechRemark['kind']; focus: Focus; mood: Mood; safety: boolean; why: string; at: number; keepLast?: boolean };

export function createTechnician(opts: {
  rng?: () => number; settings?: Partial<Settings>; memory?: MemoryData;
  minGapMs?: number; idleMinMs?: number; idleMaxMs?: number; escalationMs?: [number, number, number]; trendEveryMs?: number;
} = {}) {
  const rng = opts.rng || Math.random;
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(opts.settings || {}) };
  const mem: MemoryData = opts.memory ? { ...emptyMemory(), ...opts.memory } : emptyMemory();
  const baseGap = opts.minGapMs ?? 5000;
  const idleMin = opts.idleMinMs ?? 14000, idleMax = opts.idleMaxMs ?? 24000;
  const esc = opts.escalationMs ?? [30000, 90000, 180000];
  const trendEvery = opts.trendEveryMs ?? 1000;

  let prev: FactsPlus | null = null;
  let lastSpokeAt = -Infinity, lastAlertAt = -Infinity, nextIdleAt = 0, lastText = '', n = 0, greeted = false;
  let queue: Cand[] = [];
  const log: LogEntry[] = [];
  const alarmSeen = new Map<string | number, { first: number; tier: number }>();
  const faultSeen = new Map<string, { first: number; tier: number }>();
  const trendFired = new Set<string>();
  let samples: { t: number; pressure: number; tempDiff: number; optical: number; failed: number }[] = [];
  let jokeBag: number[] = [], lastJoke = -1, lastTopic: JokeTopic = 'general';
  let scanMilestones = new Set<string>();
  let calWarned = false;
  let lastActiveTopic: JokeTopic = 'general';

  const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
  const pick = <T,>(a: T[]): T => a[Math.floor(rng() * a.length) % a.length];

  // ——— helpers ———
  /** Chooses how many lines to speak. Safety scripts always keep their last line (the fix). */
  const trim = (lines: string[], keepLast = false): string[] => {
    const v = clamp01(settings.verbosity);
    const count = v < 0.34 ? 1 : v < 0.67 ? Math.min(2, lines.length) : lines.length;
    const out = lines.slice(0, count);
    if (keepLast && !out.includes(lines[lines.length - 1])) out.push(lines[lines.length - 1]);
    return out;
  };
  const safetyActive = (f: FactsPlus): boolean =>
    f.openAlarmsCritical > 0 || f.failures.vacuumLeak || (f.shutter && f.doorOpen) ||
    f.alarms.some(a => /turbo pump protection|laser|eye/i.test(a.text));
  const jokesAllowed = (f: FactsPlus, now: number): boolean =>
    settings.mode !== 'quiet' && settings.jokeFreq > 0 && !safetyActive(f) && f.alarms.length === 0 &&
    !Object.values(f.failures).some(Boolean) && now - lastAlertAt > 30000 && !(f.failed > 0 && f.scanActive);

  const nextJoke = (prefer: JokeTopic) => {
    if (!jokeBag.length) jokeBag = ALL_JOKES.map((_, i) => i).filter(i => i !== lastJoke).sort(() => rng() - 0.5);
    let idx = jokeBag.findIndex(i => ALL_JOKES[i].topic === prefer);
    if (idx < 0 || rng() < 0.35) idx = jokeBag.length - 1;
    const i = jokeBag.splice(idx, 1)[0]; lastJoke = i; lastTopic = ALL_JOKES[i].topic; return ALL_JOKES[i];
  };

  const nextStep = (f: FactsPlus): { text: string; focus: Focus; key: string } => {
    const T = (key: string, text: string, focus: Focus) => ({ key, text, focus });
    if (!f.power) return T('s-power', 'The lab is cold and dark. Close the main breaker in the top right to start.', 'rack');
    if (!f.clockPower) return T('s-clock', 'Next: power on the Rubidium clock so every instrument shares one time base.', 'rack');
    if (!f.clockLocked) return T('s-lock', 'The clock is still warming up. Lock first, measure later.', 'rack');
    if (f.doorOpen) return T('s-door', 'The chamber door is open. Close it before pumping down.', 'door');
    if (f.pressure >= 1e-3) return T('s-pump', f.roughing || f.turbo ? `Pumping down. We are at ${fmtPressure(f.pressure)} and the target is below 1e-3 Torr.` : f.pressure < 50 ? 'Pressure is under 50 Torr. You can start the turbo now.' : 'Start the roughing pump, then the turbo once we are under 50 Torr.', 'chamber');
    if (!f.faraday || !f.isolation) return T('s-shield', `${!f.faraday ? 'The Faraday cage is off' : 'Vibration isolation is off'}. Switch it on before measuring.`, 'chamber');
    if (Math.abs(f.tempDiff) >= 0.03) return T('s-temp', `Temperature is ${f.tempDiff.toFixed(2)} °C from the setpoint. Thermal mass is stubborn, so be patient.`, 'chamber');
    if (!f.vnaPower || !f.rf) return T('s-vna', 'Power up the VNA and enable RF output.', 'rack');
    if (!f.calibrated) return T('s-cal', 'The VNA is not calibrated yet. Garbage in, garbage out.', 'rack');
    if (!f.ldvPower || !f.shutter) return T('s-ldv', 'Turn on the vibrometer and open the shutter once everyone has eye protection.', 'rack');
    if (!f.homed) return T('s-home', 'Home the stage so we know where zero really is.', 'stage');
    if (f.records === 0) return T('s-scan', 'Everything is green. Start a scan from Experiment Runs and let us get data.', 'bench');
    return T('s-review', 'Data is in. Review the spatial map and check the quality gate.', 'bench');
  };

  const addLog = (r: TechRemark) => { log.push({ id: r.id, at: r.at, text: r.text, category: r.category, why: r.why, key: r.key }); if (log.length > 200) log.shift(); };

  const emit = (c: Cand, now: number): TechRemark => {
    const lines = trim(c.lines, c.keepLast);
    const r: TechRemark = { id: `t${++n}`, text: lines.join(' '), lines, category: c.category, kind: c.kind, focus: c.focus, mood: c.mood, safety: c.safety, why: c.why, key: c.key, at: now };
    lastSpokeAt = now; lastText = r.text;
    if (c.kind === 'alert') lastAlertAt = now;
    const mult = settings.mode === 'chatty' ? 0.6 : 1;
    nextIdleAt = now + (idleMin + rng() * (idleMax - idleMin)) * mult / (0.35 + clamp01(settings.jokeFreq) * 1.3);
    addLog(r); return r;
  };

  // ——— event detection ———
  const diff = (now: number, f: FactsPlus): Cand[] => {
    const p = prev as FactsPlus; const out: Cand[] = [];
    const add = (key: string, priority: number, lines: string[], why: string, o: Partial<Cand> = {}) =>
      out.push({ key, priority, lines, category: 'stage', kind: 'status', focus: 'none', mood: 'neutral', safety: false, why, at: now, ...o });
    const chatty = settings.mode === 'chatty';
    const drill = f.blindDrill;

    // alarms
    for (const a of f.alarms) {
      if (alarmSeen.has(a.id)) continue;
      alarmSeen.set(a.id, { first: now, tier: 0 }); mem.alarmsSeen++;
      const crit = a.severity === 'critical';
      const t = a.text.length > 140 ? a.text.slice(0, 137) + '…' : a.text;
      const rule = alarmAdvice(a.text, f);
      add('alarm:' + a.id, crit ? 10 : 8, [crit ? `Alarm! ${t}` : `Heads up: ${t}`, ...(rule ? [rule] : [])], `A new ${a.severity} alarm appeared: "${a.text}".`, { category: 'alarm', kind: 'alert', mood: 'worried', safety: crit, keepLast: !!rule });
    }
    // injected faults
    for (const k of Object.keys(f.failures) as FaultKey[]) {
      if (f.failures[k] && !p.failures[k]) {
        faultSeen.set(k, { first: now, tier: 0 }); mem.faultsSeen[k] = (mem.faultsSeen[k] || 0) + 1;
        const s = FAULT_SCRIPTS[k];
        if (drill) add('fault:' + k, 9, [s.symptom, 'Something is off but I cannot name it from here. Check the validation rules and the traces, and tell me what you find.'], `A fault appeared while the blind drill is hidden, so I described the symptom only.`, { category: 'fault', kind: 'alert', focus: s.focus, mood: 'worried', safety: k === 'vacuumLeak', keepLast: true });
        else add('fault:' + k, k === 'vacuumLeak' ? 10 : 9, [s.headline, s.effect, s.cause, s.check, s.fix, s.hold], `The ${s.name} fault turned on (previously off).`, { category: 'fault', kind: 'alert', focus: s.focus, mood: 'worried', safety: k === 'vacuumLeak', keepLast: true });
      }
      if (!f.failures[k] && p.failures[k]) { faultSeen.delete(k); add('fault-clear:' + k, 6, [`${FAULT_SCRIPTS[k].name[0].toUpperCase() + FAULT_SCRIPTS[k].name.slice(1)} cleared.`, 'Re-check the validation rules before measuring again.'], `The ${FAULT_SCRIPTS[k].name} fault turned off.`, { mood: 'happy', category: 'fault' }); }
    }
    // facility and instruments
    if (f.power && !p.power) add('power-on', 6, ['Main power is on.', 'Racks are alive. Next up is the Rubidium clock.'], 'Facility power went from off to on.', { focus: 'rack', mood: 'happy' });
    if (!f.power && p.power) add('power-off', 7, ['The breaker is open and the whole lab went dark.', 'All instrument states reset; the notebook is kept.'], 'Facility power went from on to off.', { focus: 'rack', mood: 'worried' });
    if (f.clockPower && !p.clockPower && f.power) add('clock-on', 4, ['The Rubidium clock is warming up.', 'It needs about fifteen seconds before it locks.'], 'The clock was powered on.', { focus: 'rack' });
    if (f.clockLocked && !p.clockLocked) add('clock-lock', 6, ['Clock locked at 10 MHz.', 'Every instrument now agrees what a second is.'], 'The clock lock indicator turned on.', { focus: 'rack', mood: 'happy' });
    if (!f.clockLocked && p.clockLocked && f.clockPower && f.power && !f.failures.clockDrift) add('clock-lost', 8, ['We lost the clock lock.', 'It is in holdover, so frequency results are on thin ice.', 'Wait for the green LOCKED indicator before measuring.'], 'The clock lock indicator turned off while the clock still had power.', { focus: 'rack', mood: 'worried', kind: 'alert', category: 'alarm', keepLast: true });
    if (f.vnaPower && !p.vnaPower) add('vna-on', 3, ['VNA is on.', 'Give it a minute before trusting the dB values.'], 'The VNA was powered on.', { focus: 'rack' });
    if (f.rf && !p.rf) add('rf-on', 4, f.calibrated ? ['RF is on and the VNA is calibrated.', 'Sweeps will mean something.'] : ['RF is on but the VNA is not calibrated.', 'Fine for a look, not for data.'], 'RF output was enabled.', { focus: 'rack', mood: f.calibrated ? 'happy' : 'neutral' });
    if (f.calibrated && !p.calibrated) { calWarned = false; add('cal', 5, ['Calibration done.', 'It stays valid for one hour, or until you change the center or span.'], 'The VNA calibration flag turned on.', { focus: 'rack', mood: 'happy' }); }
    if (!f.calibrated && p.calibrated && f.vnaPower) add('cal-lost', 6, ['The VNA calibration was invalidated.', f.calAge >= 3599 ? 'It timed out after an hour.' : 'Changing the center or span does that.', 'Recalibrate before the next scan.'], 'The VNA calibration flag turned off.', { focus: 'rack', mood: 'worried', keepLast: true });
    if (f.shutter && !p.shutter) add('shutter-open', 7, ['Laser shutter is open.', 'Eye protection on, everyone. Never look into the beam.'], 'The LDV shutter opened (laser emitting).', { focus: 'chamber', safety: true, kind: 'alert', mood: 'neutral' });
    if (!f.shutter && p.shutter && f.ldvPower) add('shutter-closed', 3, ['Shutter closed. The laser is safely back in its box.'], 'The LDV shutter closed.', { focus: 'chamber' });
    if (f.shutter && f.doorOpen && !(p.shutter && p.doorOpen)) add('laser-door', 10, ['The laser is on and the chamber door is open.', 'Close the shutter first, then open the door.'], 'Laser shutter open at the same time as the chamber door.', { focus: 'door', safety: true, kind: 'alert', mood: 'worried', category: 'alarm', keepLast: true });
    // chamber
    if (f.doorOpen && !p.doorOpen) add('door-open', 7, ['Door is open.', f.roughing || f.turbo ? 'Pumping cannot hold with the door open.' : 'Vacuum is on hold until it is closed.'], 'The chamber door opened.', { focus: 'door', mood: 'worried' });
    if (!f.doorOpen && p.doorOpen) add('door-closed', 4, ['Door sealed and ready to pump.'], 'The chamber door closed.', { focus: 'door', mood: 'happy' });
    if (f.roughing && !p.roughing) add('rough', 4, [`Roughing pump is running at ${fmtPressure(f.pressure)}.`, 'First stop is 50 Torr, then the turbo can take over.'], 'The roughing pump was switched on.', { focus: 'chamber' });
    if (f.turbo && !p.turbo) add('turbo', 5, [`Turbo is spinning up at ${fmtPressure(f.pressure)}.`, 'It will take us below 1e-3 Torr.'], 'The turbo pump was switched on.', { focus: 'chamber', mood: 'happy' });
    if (p.pressure >= 50 && f.pressure < 50 && f.roughing) add('p50', 4, [`Under 50 Torr, now ${fmtPressure(f.pressure)}.`, 'The turbo is cleared to start.'], 'Pressure crossed below 50 Torr while the roughing pump ran.', { focus: 'chamber' });
    if (p.pressure >= 1e-3 && f.pressure < 1e-3) add('p-deep', 7, [`Deep vacuum reached at ${fmtPressure(f.pressure)}.`, 'The chamber is nicely empty, and the pressure check should now pass.'], 'Pressure crossed below 1e-3 Torr.', { focus: 'chamber', mood: 'happy' });
    if (f.vent && !p.vent) add('vent', 4, ['Venting the chamber.', 'The stage cannot move during a vent cycle.'], 'The vent valve opened.', { focus: 'chamber' });
    if (!f.faraday && p.faraday) add('far-off', 6, ['Faraday cage is off.', 'RF noise can walk right in, so expect fuzzy S11 traces.'], 'The Faraday cage turned off.', { focus: 'chamber', mood: 'worried', keepLast: true });
    if (f.faraday && !p.faraday) add('far-on', 3, ['Shielding restored.'], 'The Faraday cage turned on.', { focus: 'chamber', mood: 'happy' });
    if (!f.isolation && p.isolation) add('iso-off', 6, ['Vibration isolation is bypassed.', 'Floor motion will show up in the LDV signal.'], 'Vibration isolation turned off.', { focus: 'chamber', mood: 'worried', keepLast: true });
    if (f.isolation && !p.isolation) add('iso-on', 3, ['Isolation is back on.'], 'Vibration isolation turned on.', { focus: 'chamber', mood: 'happy' });
    if (Math.abs(p.tempDiff) >= 0.03 && Math.abs(f.tempDiff) < 0.03 && f.power) add('temp-ok', 5, [`Temperature is within 0.03 °C, at ${f.temperature.toFixed(2)} °C.`, 'Thermally steady.'], 'Temperature error dropped below 0.03 °C.', { focus: 'chamber', mood: 'happy' });
    if (Math.abs(p.tempDiff) < 0.03 && Math.abs(f.tempDiff) >= 0.03 && f.power) add('temp-drift', 5, [`Temperature is ${f.tempDiff.toFixed(2)} °C off the setpoint.`, 'The resonance will follow it.'], 'Temperature error rose above 0.03 °C.', { focus: 'chamber', mood: 'worried' });
    // stage
    if (f.stageMoving && !p.stageMoving) add('stage-move', chatty ? 3 : 2, [`Stage moving to X ${f.pos.x.toFixed(1)}, Y ${f.pos.y.toFixed(1)}, Z ${f.pos.z.toFixed(1)} mm.`, 'We wait for it to settle before recording.'], 'The stage started moving.', { focus: 'stage' });
    if ((p.stageMoving || p.stageSettling) && !f.stageMoving && !f.stageSettling) add('stage-still', 3, ['Stage settled. Good time to measure.'], 'The stage stopped moving and settling.', { focus: 'stage', mood: 'happy' });
    // acquisition
    if (f.scanActive && !p.scanActive) {
      scanMilestones = new Set();
      const rd = readiness(f); const bad = rd.rules.filter(x => !x.pass);
      add('scan-start', 6, bad.length ? ['Scan started.', `Careful: ${bad.map(b => b.label.toLowerCase()).join(', ')} ${bad.length > 1 ? 'are' : 'is'} not passing, so the data may be flagged.`] : ['Scan started with every check passing.', 'Sphere, do your thing.'], bad.length ? 'A scan started while validation checks were failing.' : 'A scan started.', { focus: 'bench', mood: bad.length ? 'worried' : 'happy', keepLast: true });
    }
    if (f.scanActive && f.scanProgress >= 0.5 && !scanMilestones.has('half')) { scanMilestones.add('half'); add('scan-half', 4, [`Halfway: ${f.records} records, ${f.accepted} accepted, ${f.suspect} suspect, ${f.failed} failed.`], 'Scan progress passed 50%.', { focus: 'bench' }); }
    if (f.scanActive && f.scanProgress >= 0.9 && !scanMilestones.has('nine')) { scanMilestones.add('nine'); add('scan-90', 4, ['Ninety percent done. Nearly there.'], 'Scan progress passed 90%.', { focus: 'bench' }); }
    if (!f.scanActive && p.scanActive) {
      const lines = findingsLines(f);
      mem.scansDone++; mem.lastScan = { records: f.records, accepted: f.accepted, suspect: f.suspect, failed: f.failed };
      add('scan-done', 8, lines, 'The scan finished, so I summarised the results.', { category: 'finding', kind: 'finding', focus: 'bench', mood: f.failed > f.accepted * 0.25 ? 'worried' : 'happy', keepLast: true });
    }
    if (f.failed > p.failed) add('q-fail', 6, [`A point failed the quality gate (${f.failed} failed so far).`, 'Adaptive rescan will retry it.'], 'The failed-point count went up.', { focus: 'bench', mood: 'worried' });
    else if (f.suspect > p.suspect && chatty) add('q-sus', 3, ['A suspect point was flagged. Something was not quite stable.'], 'The suspect-point count went up.', { focus: 'bench' });
    if (f.records > 0 && p.records === 0 && !f.scanActive) add('first-rec', 4, ['First record captured. We have data.'], 'Records went from none to some.', { focus: 'bench', mood: 'happy' });
    return out;
  };

  /** Plain-language advice for known alarm texts. */
  function alarmAdvice(text: string, f: FactsPlus): string | null {
    if (/turbo pump protection/i.test(text)) return 'Stop the turbo, run the roughing pump until pressure is under 50 Torr, then restart the turbo.';
    if (/stage (move|homing) rejected/i.test(text)) return 'Fix the blocker (power, door, clamp or vent cycle) and send the move again.';
    if (/calibration invalidated/i.test(text)) return 'Recalibrate the VNA before the next scan.';
    if (/shielding disabled/i.test(text)) return 'Switch the Faraday cage back on.';
    if (/isolation disabled/i.test(text)) return 'Switch vibration isolation back on.';
    if (/interlock/i.test(text)) return 'Check the door, clamp and vent state before trying again.';
    if (/scan plan rejected|run rejected/i.test(text)) return 'Fix the plan fields and try again.';
    if (/requires facility power/i.test(text)) return f.power ? 'Power on the VNA and enable RF.' : 'Close the main breaker first.';
    return null;
  }

  function findingsLines(f: FactsPlus): string[] {
    const total = f.accepted + f.suspect + f.failed || f.records;
    const rate = total ? f.accepted / total : 0;
    const out: string[] = [`Scan complete: ${f.records} records. ${f.accepted} accepted, ${f.suspect} suspect, ${f.failed} failed.`];
    const rd = readiness(f); const bad = rd.rules.filter(x => !x.pass);
    if (!total) out.push('There is nothing to judge yet.');
    else if (f.failed === 0 && f.suspect <= Math.max(1, total * 0.1)) out.push('That is a clean data set.');
    else if (rate >= 0.7) out.push(`Mostly good (${Math.round(rate * 100)}% accepted), but look at the flagged points before drawing conclusions.`);
    else out.push(`Only ${Math.round(rate * 100)}% accepted. I would not trust a trend from this yet.`);
    if (f.accepted > 0 && f.accepted < 5) out.push('Fewer than five accepted points is too little coverage to interpolate between them.');
    if (bad.length) out.push(`Note: ${bad.map(b => b.label.toLowerCase()).join(', ')} ${bad.length > 1 ? 'are' : 'is'} not passing now, so treat the data cautiously.`);
    if (mem.lastScan && mem.scansDone > 0 && total) {
      const pt = mem.lastScan.accepted + mem.lastScan.suspect + mem.lastScan.failed;
      if (pt) { const pr = mem.lastScan.accepted / pt; if (rate - pr > 0.1) out.push('That is better than the previous scan.'); else if (pr - rate > 0.1) out.push('That is worse than the previous scan. Something changed.'); }
    }
    out.push(f.failed > 0 ? 'Next: check which points failed, fix the cause, and rescan them.' : 'Next: open the Spatial Field Explorer and check the shift against position.');
    return out;
  }

  // ——— trends ———
  const trends = (now: number, f: FactsPlus): Cand[] => {
    const out: Cand[] = [];
    const last = samples[samples.length - 1];
    if (!last || now - last.t >= trendEvery) { samples.push({ t: now, pressure: f.pressure, tempDiff: Math.abs(f.tempDiff), optical: f.opticalQuality, failed: f.failed }); if (samples.length > 12) samples.shift(); }
    const add = (key: string, priority: number, lines: string[], why: string, focus: Focus) => { if (trendFired.has(key)) return; trendFired.add(key); out.push({ key, priority, lines, category: 'trend', kind: 'alert', focus, mood: 'worried', safety: false, why, at: now }); };
    const s = samples; const k = s.length;
    // pressure rising while pumping
    if (k >= 4 && (f.roughing || f.turbo) && !f.vent && !f.doorOpen && s[k - 1].pressure > s[k - 4].pressure * 1.15 && s[k - 1].pressure > s[k - 2].pressure) {
      add('trend:pressure', 8, [`Pressure is creeping up while we are pumping: ${fmtPressure(s[k - 4].pressure)} to ${fmtPressure(s[k - 1].pressure)}.`, 'That is how a leak starts. Check the door seal and the fittings.'], `Pressure rose by more than 15% across the last 3 samples with the pumps running.`, 'chamber');
    } else if (k >= 2 && s[k - 1].pressure < s[k - 2].pressure) trendFired.delete('trend:pressure');
    // temperature walking away
    if (k >= 5 && f.power) {
      const w = s.slice(k - 5); const rising = w.every((x, i) => i === 0 || x.tempDiff >= w[i - 1].tempDiff) && w[4].tempDiff - w[0].tempDiff > 0.01 && w[4].tempDiff > 0.015 && f.tempDiff !== 0;
      if (rising) add('trend:temp', 6, [`Temperature is drifting away from the setpoint: ${w[0].tempDiff.toFixed(3)} to ${w[4].tempDiff.toFixed(3)} °C.`, w[4].tempDiff < 0.03 ? 'Still inside the 0.03 °C limit, but heading out.' : 'It is past the 0.03 °C limit, so hold measurements.'], 'Temperature error increased on five samples in a row.', 'chamber');
      else if (w[4].tempDiff < 0.01) trendFired.delete('trend:temp');
    }
    // optical quality sliding
    if (k >= 4 && f.shutter && s[k - 4].optical - s[k - 1].optical >= 12 && !f.failures.ldvMisalign) add('trend:optical', 6, [`Optical quality is sliding: ${Math.round(s[k - 4].optical)} to ${Math.round(s[k - 1].optical)}.`, 'The beam may be drifting. Check the LDV alignment before it hurts the data.'], 'Optical quality dropped by 12 or more over three samples.', 'chamber');
    else if (f.opticalQuality > 90) trendFired.delete('trend:optical');
    // calibration expiring
    if (f.calibrated && f.calAge >= 3000 && f.calAge < 3600 && !calWarned) { calWarned = true; add('trend:cal', 5, [`VNA calibration expires in about ${Math.max(1, Math.round((3600 - f.calAge) / 60))} minutes.`, 'Recalibrate before a long scan.'], 'Calibration age passed 50 minutes.', 'rack'); }
    // failures stacking up
    if (f.scanActive && f.failed >= 2 && f.failed > (samples[0]?.failed ?? 0) + 1) add('trend:fails', 7, [`Failures are stacking up: ${f.failed} so far.`, 'Consider pausing the scan and checking the validation rules.'], 'Two or more points failed during this scan.', 'bench');
    if (!f.scanActive) trendFired.delete('trend:fails');
    return out;
  };

  // ——— escalation ———
  const escalate = (now: number, f: FactsPlus): Cand[] => {
    const out: Cand[] = [];
    const open = new Set(f.alarms.map(a => a.id));
    for (const id of [...alarmSeen.keys()]) if (!open.has(id)) alarmSeen.delete(id);
    const tiers = (key: string, name: string, seen: { first: number; tier: number }, text: string, hasFix: string) => {
      const age = now - seen.first; const t = age >= esc[2] ? 3 : age >= esc[1] ? 2 : age >= esc[0] ? 1 : 0;
      if (t > seen.tier) {
        seen.tier = t; const secs = Math.round(age / 1000);
        const lines = t === 1 ? [`Reminder: ${name} is still open after ${secs} seconds.`, hasFix]
          : t === 2 ? [`${name} has been open for ${secs} seconds and it is probably affecting your data.`, hasFix, 'Please deal with this before measuring.']
          : [`This is now blocking: ${name} has been open for ${secs} seconds.`, hasFix, 'I would stop measuring until it is resolved.'];
        out.push({ key: `esc:${key}:${t}`, priority: 8 + t, lines, category: 'escalation', kind: 'alert', focus: 'none', mood: 'worried', safety: t >= 2, why: `${name} stayed unresolved for ${secs} s, which crossed escalation level ${t} (${t === 1 ? 'reminder' : t === 2 ? 'warning' : 'blocking'}).`, at: now, keepLast: true });
      }
    };
    for (const a of f.alarms) { const seen = alarmSeen.get(a.id); if (seen) tiers(String(a.id), `"${a.text.length > 60 ? a.text.slice(0, 57) + '…' : a.text}"`, seen, a.text, alarmAdvice(a.text, f) || 'Acknowledge it once you understand it, or fix the cause.'); }
    for (const [k, seen] of faultSeen) { if (!f.failures[k as FaultKey]) { faultSeen.delete(k); continue; } const s = FAULT_SCRIPTS[k as FaultKey]; tiers('fault:' + k, f.blindDrill ? 'the hidden fault' : `the ${s.name}`, seen, s.name, f.blindDrill ? 'Look at the validation rules and traces for the symptom.' : s.fix); }
    return out;
  };

  // ——— public ———
  const minGapFor = (c: Cand) => (c.priority >= 9 ? 2000 : settings.mode === 'chatty' ? baseGap * 0.6 : baseGap);

  return {
    settings,
    setSettings(p: Partial<Settings>) { if (p.mode) settings.mode = p.mode; if (p.verbosity !== undefined) settings.verbosity = clamp01(p.verbosity); if (p.jokeFreq !== undefined) settings.jokeFreq = clamp01(p.jokeFreq); },
    memory: mem,
    get log() { return log; },
    explain(id: string): string | null { const e = log.find(l => l.id === id); return e ? e.why : null; },
    isSafetyEvent: safetyActive,

    /** Feed the latest facts. Returns something to say now, or null. */
    observe(f: FactsPlus, now: number): TechRemark | null {
      if (!prev) { prev = f; for (const a of f.alarms) alarmSeen.set(a.id, { first: now, tier: 0 }); for (const k of Object.keys(f.failures) as FaultKey[]) if (f.failures[k]) faultSeen.set(k, { first: now, tier: 0 }); nextIdleAt = now + 2500; return null; }
      const found = [...diff(now, f), ...trends(now, f), ...escalate(now, f)];
      prev = f;
      const quiet = settings.mode === 'quiet';
      for (const c of found) if (!quiet || c.priority >= 7 || c.safety) queue.push(c);
      queue = queue.filter(q => now - q.at < 25000);
      if (!queue.length && f.pressure >= 1e-3 && (f.roughing || f.turbo)) lastActiveTopic = 'vacuum';
      if (f.scanActive) lastActiveTopic = 'data'; else if (f.stageMoving) lastActiveTopic = 'stage';
      if (queue.length) {
        queue.sort((a, b) => b.priority - a.priority || a.at - b.at);
        const top = queue[0];
        if (now - lastSpokeAt >= minGapFor(top)) { queue.shift(); return emit(top, now); }
        return null;
      }
      if (quiet) return null;
      if (!greeted && now >= nextIdleAt - 1000) {
        greeted = true; const s = nextStep(f);
        return emit({ key: 'greet', priority: 3, lines: ["Hi, I'm Dr. Wire, your lab technician.", s.text], category: 'greeting', kind: 'hint', focus: s.focus, mood: 'happy', safety: false, why: 'First idle moment of the session, so I introduced myself and gave the next step.', at: now }, now);
      }
      if (greeted && now >= nextIdleAt && now - lastSpokeAt >= baseGap) {
        if (f.scanActive) return emit({ key: 'scan-prog', priority: 1, lines: [`Scan at ${Math.round(f.scanProgress * 100)}%: ${f.accepted} accepted, ${f.suspect} suspect, ${f.failed} failed.`], category: 'stage', kind: 'status', focus: 'bench', mood: 'neutral', safety: false, why: 'Idle update while a scan was running.', at: now }, now);
        if (f.alarms.length) return emit({ key: 'idle-alarm', priority: 1, lines: [`${f.alarms.length} open alarm${f.alarms.length > 1 ? 's' : ''}: ${f.alarms[0].text.slice(0, 90)}`], category: 'escalation', kind: 'hint', focus: 'none', mood: 'worried', safety: false, why: 'Idle reminder because alarms were still open.', at: now }, now);
        const s = nextStep(f);
        const hintOk = settings.mode !== 'quiet' && (mem.hintCounts[s.key] || 0) < 3 && s.text !== lastText;
        const wantHint = hintOk && rng() < (settings.mode === 'coach' ? 0.5 : 0.3);
        if (wantHint) { mem.hintCounts[s.key] = (mem.hintCounts[s.key] || 0) + 1; return emit({ key: 'hint:' + s.key, priority: 1, lines: [s.text], category: 'hint', kind: 'hint', focus: s.focus, mood: 'neutral', safety: false, why: `Idle coaching hint: the next unfinished step is "${s.key.replace('s-', '')}".`, at: now }, now); }
        if (jokesAllowed(f, now) && rng() < Math.min(1, clamp01(settings.jokeFreq) * 1.5)) {
          const j = nextJoke(lastActiveTopic); mem.jokesTold++;
          return emit({ key: 'joke', priority: 1, lines: [j.text], category: 'joke', kind: 'joke', focus: FOCUS_BY_TOPIC[j.topic], mood: 'happy', safety: false, why: `Idle joke (${j.topic}) because nothing needed attention and jokes are allowed.`, at: now }, now);
        }
        nextIdleAt = now + idleMin;
      }
      return null;
    },

    /** The user pressed "Talk": a hint if the lab needs attention, otherwise a joke (never during safety events). */
    chat(f: FactsPlus, now: number): TechRemark {
      queue = [];
      const s = nextStep(f);
      if (f.alarms.length || !f.power || safetyActive(f) || !jokesAllowed(f, now)) {
        const lines = f.alarms.length ? [`${f.alarms.length} open alarm${f.alarms.length > 1 ? 's' : ''}.`, s.text] : [s.text];
        return emit({ key: 'chat-hint', priority: 1, lines, category: 'hint', kind: 'hint', focus: s.focus, mood: f.alarms.length ? 'worried' : 'neutral', safety: false, why: 'You pressed Talk, and the lab needs attention, so I gave a hint instead of a joke.', at: now }, now);
      }
      const j = nextJoke(lastActiveTopic); mem.jokesTold++;
      return emit({ key: 'joke', priority: 1, lines: [j.text], category: 'joke', kind: 'joke', focus: FOCUS_BY_TOPIC[j.topic], mood: 'happy', safety: false, why: 'You pressed Talk and nothing needed attention, so I told a joke.', at: now }, now);
    },

    /** Answers a typed or spoken question from live state first, then the knowledge base. Says "I don't know" when unsure. */
    ask(question: string, f: FactsPlus, now: number): { remark: TechRemark; known: boolean; sources: string[] } {
      mem.questions++;
      const q = question.trim();
      let ans = /\b(next|what should i do|what now|what do i do)\b/i.test(q) ? { text: nextStep(f).text, known: true, sources: ['live-state'], topic: 'next' } as ReturnType<typeof knowledgeAnswer>
        : /\b(joke|funny|make me laugh)\b/i.test(q) ? (jokesAllowed(f, now) ? (() => { const j = nextJoke(lastActiveTopic); mem.jokesTold++; return { text: j.text, known: true, sources: ['jokes'], topic: 'joke' }; })() : { text: "Not right now. Something in the lab needs attention first.", known: true, sources: ['safety'], topic: 'joke' })
        : /\b(summary|summari[sz]e|what (have|did) we (done|do)|session)\b/i.test(q) ? { text: sessionSummary(f), known: true, sources: ['memory'], topic: 'session' }
        : (liveAnswer(q, f) || knowledgeAnswer(q, settings.verbosity));
      if (!ans.known) { if (!mem.unanswered.includes(q) && mem.unanswered.length < 50) mem.unanswered.push(q); }
      else if (ans.topic) {
        mem.topics[ans.topic] = (mem.topics[ans.topic] || 0) + 1;
        if (mem.topics[ans.topic] >= 3 && !['next', 'joke', 'session'].includes(ans.topic)) ans = { ...ans, text: ans.text + ' We have been over this topic a few times. Want me to walk you through it hands-on?' };
      }
      const r: TechRemark = { id: `t${++n}`, text: ans.text, lines: [ans.text], category: 'answer', kind: 'answer', focus: 'none', mood: ans.known ? 'neutral' : 'worried', safety: false, why: ans.known ? `You asked "${q}". I matched it to ${ans.sources.join(', ')}.` : `You asked "${q}" and I found nothing reliable in my notes, so I said I don't know instead of guessing.`, key: 'answer', at: now };
      lastSpokeAt = now; lastText = r.text; addLog(r);
      return { remark: r, known: ans.known, sources: ans.sources };
    },

    /** Records something Dr. Wire did on request (used by the task runner so the log shows it). */
    note(text: string, why: string, now: number, category: Category = 'task'): TechRemark {
      const r: TechRemark = { id: `t${++n}`, text, lines: [text], category, kind: 'status', focus: 'none', mood: 'neutral', safety: false, why, key: 'note', at: now };
      lastSpokeAt = now; addLog(r); return r;
    },

    findings(f: FactsPlus): string { return findingsLines(f).join(' '); },
    sessionSummary,
    reset() { prev = null; queue = []; alarmSeen.clear(); faultSeen.clear(); trendFired.clear(); samples = []; greeted = false; scanMilestones = new Set(); calWarned = false; },
  };

  function sessionSummary(f: FactsPlus): string {
    const parts: string[] = [];
    parts.push(`This session: ${mem.scansDone} scan${mem.scansDone === 1 ? '' : 's'} finished, ${mem.alarmsSeen} alarm${mem.alarmsSeen === 1 ? '' : 's'} seen`);
    const fk = Object.keys(mem.faultsSeen); if (fk.length) parts.push(`faults handled: ${fk.map(k => FAULT_SCRIPTS[k as FaultKey]?.name || k).join(', ')}`);
    if (mem.lastScan) parts.push(`last scan had ${mem.lastScan.accepted} accepted, ${mem.lastScan.suspect} suspect and ${mem.lastScan.failed} failed points`);
    parts.push(`right now: ${nextStep(f).text}`);
    return parts.join('; ') + '.';
  }
}

export type Technician = ReturnType<typeof createTechnician>;

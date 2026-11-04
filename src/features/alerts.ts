// One place that decides which of four alert words applies to each part of the simulator.
//   running   - the part is doing its job right now (a sweep, a pump-down, a scan, a warm-up)
//   stuck     - the part has started something that cannot move forward until something else is fixed
//   error     - a fault or a critical alarm: the part is broken or has tripped a protection
//   attention - the part works, but a person should look at it (warning, expired calibration, door open ...)
// Everything is derived from the simulation state, so the same word shows up in the sidebar, page headers,
// the lab map, the status strip and the live operation window.

export type AlertLevel = 'idle' | 'running' | 'stuck' | 'error' | 'attention';
export type AlertKey = 'facility' | 'clock' | 'vna' | 'scope' | 'ldv' | 'chamber' | 'pumps' | 'stage' | 'experiment' | 'spatial';
export type AlertInfo = { level: AlertLevel; label: string; detail: string; fix?: string; page?: string };

export const ALERT_ORDER: AlertLevel[] = ['error', 'stuck', 'attention', 'running', 'idle'];
export const ALERT_WORD: Record<AlertLevel, string> = { idle: 'Idle', running: 'Running', stuck: 'Stuck', error: 'Error', attention: 'Needs attention' };
export const ALERT_HEX: Record<AlertLevel, string> = { idle: '#64748b', running: '#34d399', stuck: '#fb923c', error: '#fb7185', attention: '#facc15' };
export const ALERT_RANK: Record<AlertLevel, number> = { error: 0, stuck: 1, attention: 2, running: 3, idle: 4 };

const ALARM_PATTERN: Record<AlertKey, RegExp> = {
  facility: /breaker|facility|power/i, clock: /clock|reference|rubidium/i, vna: /vna|rf |sweep|calibration/i, scope: /scope/i, ldv: /ldv|laser|shutter|optical/i,
  chamber: /chamber|door|vent|thermal|temperature|faraday|shield|isolation/i, pumps: /turbo|pump|vacuum|pressure/i, stage: /stage|clamp|homing/i,
  experiment: /scan|run |experiment|interlock/i, spatial: /record|quality|point/i,
};

const alarmsFor = (s: any, key: AlertKey) => (s.alarms || []).filter((a: any) => !a.acknowledged && ALARM_PATTERN[key].test(a.text || ''));
const mk = (level: AlertLevel, label: string, detail: string, fix?: string, page?: string): AlertInfo => ({ level, label, detail, fix, page });
const idle = (label: string, detail: string): AlertInfo => mk('idle', label, detail);
const fmtP = (p: number) => (p >= 10 ? `${p.toFixed(1)} Torr` : `${p.toExponential(1)} Torr`);

function deriveAlert(s: any, key: AlertKey): AlertInfo {
  const f = s.failures || {}, c = s.chamber, v = s.vna, l = s.ldv, sc = s.scope, ck = s.clock, st = s.stage, ex = s.experiment || {};
  const off = !s.facility?.power;
  const critical = alarmsFor(s, key).find((a: any) => a.severity === 'critical');
  const warning = alarmsFor(s, key).find((a: any) => a.severity !== 'critical');
  if (key === 'facility') {
    const anyCritical = (s.alarms || []).some((a: any) => !a.acknowledged && a.severity === 'critical');
    const anyOpen = (s.alarms || []).filter((a: any) => !a.acknowledged).length;
    if (off) return idle('Breaker open', 'The main breaker is open, so nothing in the lab has power.');
    if (anyCritical) return mk('error', 'Critical alarm', 'A critical alarm is open. Read the alarm list for which part tripped.', 'Open the alarms and acknowledge once fixed.', 'overview');
    if (anyOpen) return mk('attention', `${anyOpen} open alarm${anyOpen > 1 ? 's' : ''}`, 'Something needs a look. Open alarms are listed in the journal.', 'Open the alarm list.', 'overview');
    return idle('Online', 'Facility power is on and nothing is alarming.');
  }
  if (off) return idle('No power', 'Close the main breaker first.');
  if (critical && key !== 'spatial') return mk('error', 'Critical alarm', critical.text, 'Fix the cause, then acknowledge the alarm.');

  if (key === 'clock') {
    if (!ck.power) return idle('Off', 'The rubidium clock is switched off, so instruments run on their own internal timing.');
    if (ck.cableFault) return mk('error', 'Reference cable fault', 'The 10 MHz reference cable is faulty, so instruments cannot share one clock.', 'Clear the fault in the Fault Injector.', 'faults');
    if (f.clockDrift) return mk(ck.locked ? 'error' : 'stuck', ck.locked ? 'Clock drift fault' : 'Warm-up blocked', ck.locked ? 'The clock reports drift and every measurement is flagged invalid.' : 'The warm-up cannot finish while the drift fault is active.', 'Clear the drift fault.', 'faults');
    if (ck.holdover) return mk('attention', 'Holdover', 'The clock lost its reference and is coasting on its own oscillator.');
    if (!ck.locked) return mk('running', 'Warming up', `Warm-up ${Math.min(100, Math.round(((ck.warmup || 0) / 15) * 100))}% — lock is reached at 100%.`);
    return idle('Locked', 'The clock is locked and feeding a steady 10 MHz to the other instruments.');
  }
  if (key === 'pumps') {
    if (f.vacuumLeak && (c.roughing || c.turbo)) return mk('error', 'Vacuum leak', 'The pumps run but the pressure keeps climbing because of the leak.', 'Clear the leak fault.', 'faults');
    if (c.turbo && c.pressure > 50) return mk('error', 'Turbo protection trip', 'The turbo pump will not run above 50 Torr; rough the chamber down first.', 'Start the roughing pump and wait for pressure < 50 Torr.', 'chamber');
    if ((c.roughing || c.turbo) && c.doorOpen) return mk('stuck', 'Door open', 'The pumps cannot evacuate a chamber whose door is open.', 'Close the chamber door.', 'chamber');
    if ((c.roughing || c.turbo) && c.vent) return mk('stuck', 'Vent valve open', 'The pumps are fighting the vent valve; pressure cannot fall.', 'Close the vent valve.', 'chamber');
    if (c.turbo && (c.turboRpm || 0) < 90) return mk('running', 'Turbo spinning up', `Rotor at ${(c.turboRpm || 0).toFixed(0)}% of full speed.`);
    if (c.roughing || c.turbo) return mk('running', c.turbo ? 'Turbo pumping' : 'Roughing', `Pumping down. Pressure ${fmtP(c.pressure)}.`);
    if ((c.turboRpm || 0) > 2) return mk('running', 'Turbo spinning down', `Rotor coasting at ${(c.turboRpm || 0).toFixed(0)}%.`);
    return idle(c.pressure < 1e-3 ? 'High vacuum' : 'Pumps off', c.pressure < 1e-3 ? 'The chamber holds deep vacuum.' : 'The pumps are switched off.');
  }
  if (key === 'chamber') {
    if (f.vacuumLeak) return mk('error', 'Vacuum leak', 'Gas is leaking into the chamber, so deep vacuum is impossible.', 'Clear the leak fault.', 'faults');
    if (c.doorOpen) return mk('attention', 'Door open', 'The chamber door is open: pumping, stage moves and scans are blocked.', 'Close the door.', 'chamber');
    if (!c.faraday) return mk('attention', 'Shielding off', 'The Faraday cage is off, so radio noise can reach the measurement.', 'Switch the Faraday cage on.', 'chamber');
    if (!c.isolation) return mk('attention', 'Isolation off', 'The vibration isolation is bypassed, so floor vibration reaches the sample.', 'Switch isolation on.', 'chamber');
    const dT = c.temperature - c.targetTemp;
    if (c.vent) return mk('running', 'Venting', 'Gas is flowing back in toward atmospheric pressure.');
    if (Math.abs(dT) >= 0.03) return mk(c.thermostat ? 'running' : 'attention', c.thermostat ? 'Thermal settling' : 'Thermostat off', c.thermostat ? `${dT >= 0 ? '+' : ''}${dT.toFixed(2)} °C from setpoint; needs ±0.03 °C.` : 'The thermostat is off, so the temperature is drifting toward room temperature.', c.thermostat ? undefined : 'Switch the thermostat on.', 'chamber');
    if (warning) return mk('attention', 'Warning', warning.text);
    return idle(c.pressure < 1e-3 ? 'Stable' : 'Ready', c.pressure < 1e-3 ? 'Deep vacuum, shielding, isolation and temperature are all in range.' : 'The chamber is ready but not at deep vacuum yet.');
  }
  if (key === 'stage') {
    if (st.clampActive) return mk('attention', 'Clamp engaged', 'The mechanical clamp locks the stage, so move commands are refused.', 'Release the clamp.', 'chamber');
    if (f.stageBacklash && (st.moving || st.settling)) return mk('stuck', 'Cannot settle', 'Backlash keeps the stage jittering, so it never reaches “settled”.', 'Clear the backlash fault or wait longer before recording.', 'faults');
    if (c.doorOpen && (st.moving || st.settling)) return mk('stuck', 'Door open', 'Stage motion is blocked while the door is open.', 'Close the door.', 'chamber');
    if (st.moving) return mk('running', 'Moving', `Servo is driving to X ${st.x?.toFixed(1)}, Y ${st.y?.toFixed(1)}, Z ${st.z?.toFixed(1)} mm.`);
    if (st.settling) return mk('running', 'Settling', 'The stage reached position and is damping out its last vibration.');
    if (!st.homed) return mk('attention', 'Not homed', 'The stage has not been homed since the last move, so its zero may be off.', 'Home the stage.', 'chamber');
    return idle('Parked', 'The stage is homed and still.');
  }
  if (key === 'vna') {
    if (!v.power) return idle('Off', 'The network analyzer is switched off.');
    if (v.sweeping) return mk('running', 'Sweeping', 'A frequency sweep is being measured right now.');
    if (v.rf && !c.faraday) return mk('attention', 'Noisy: shield off', 'Without the Faraday cage the S11 trace picks up radio noise.', 'Switch the Faraday cage on.', 'chamber');
    if (v.rf && f.emiSpike) return mk('attention', 'EMI spike', 'An interference source is adding noise to the trace.', 'Clear the EMI fault.', 'faults');
    if (v.rf && !v.calibrated) return mk('attention', 'Not calibrated', 'The trace is uncalibrated; measurements are flagged as suspect.', 'Run the calibration.', 'vna');
    if (v.rf && (v.calibrationAgeSeconds || 0) > 3000) return mk('attention', 'Calibration expiring', 'The calibration is almost one hour old and will lapse soon.', 'Recalibrate soon.', 'vna');
    if (v.rf && v.continuous) return mk('running', 'Live trace', 'RF is on and the analyzer is continuously updating the S11 trace.');
    if (!v.rf) return mk('attention', 'RF off', 'The analyzer is on but is not transmitting, so there is nothing to measure.', 'Switch RF output on.', 'vna');
    return idle('Ready', 'The analyzer is armed and waiting for a sweep.');
  }
  if (key === 'ldv') {
    if (!l.power) return idle('Off', 'The laser vibrometer is switched off.');
    if (f.ldvMisalign) return mk('error', 'Misaligned', 'The optical head is misaligned: the return signal is weak and scans are patchy.', 'Clear the fault or re-align the beam.', 'ldv');
    if (l.scanActive && l.scanStalled) return mk('stuck', 'Scan stalled', l.scanStalledReason || 'The scan cannot continue until the laser return recovers.', 'Open the shutter or improve alignment.', 'ldv');
    if (l.scanActive) return mk('running', 'Scanning', `3D scan ${Math.round((l.scanProgress || 0) * 100)}% complete.`);
    if (l.shutter && (l.opticalQuality ?? 100) < 40) return mk('attention', 'Weak return', `Optical return is only ${Math.round(l.opticalQuality ?? 0)}%.`, 'Re-align or refocus the beam.', 'ldv');
    if (l.scanNew) return mk('attention', 'New scan result', 'A finished 3D scan is waiting for you in the Scan results panel.', 'Open the results.', 'ldv');
    if (l.shutter) return mk('running', 'Laser on', 'The shutter is open and the beam is measuring the sphere.');
    return mk('idle', 'Shutter closed', 'The head is powered but no laser is emitted.');
  }
  if (key === 'scope') {
    if (!sc.power) return idle('Off', 'The oscilloscope is switched off.');
    if (sc.booting) return mk('running', 'Starting up', 'Running its power-on self-test.');
    if (sc.running && sc.triggerState === 'armed') return mk('stuck', sc.holdMode === 'single' ? 'Single-shot armed' : 'Waiting for trigger', sc.holdMode === 'single' ? 'Waiting for the one event to capture. Nothing has crossed the trigger level yet.' : 'Nothing crosses the trigger level, so the screen is not refreshing.', 'Lower the trigger level or switch the sweep mode to Auto.', 'scope');
    if (sc.running && sc.triggerState === 'unstable') return mk('attention', 'Unstable trigger', 'Noise or a very fast signal is making the trigger jump around.', 'Slow the timebase, or check shielding and isolation.', 'scope');
    if (sc.running) return mk('running', 'Acquiring', 'Capturing and drawing live waveforms.');
    return mk('attention', 'Stopped', 'Acquisition is frozen. The screen shows an old capture.', 'Press Run.', 'scope');
  }
  if (key === 'experiment') {
    if (ex.scanActive && ex.scanStep === 'fault') return mk('error', 'Scan fault', ex.scanMessage || 'The automated scan hit a fault.', 'Check interlocks, then resume or abort.', 'runs');
    if (ex.scanActive && ex.scanPaused) return mk('stuck', 'Scan paused', ex.scanMessage || 'The scan is paused and will not continue by itself.', 'Resume or abort the scan.', 'runs');
    if (ex.scanActive) return mk('running', 'Scan running', `${ex.scanMessage || 'Working'} · ${Math.round((ex.scanProgress || 0) * 100)}%`);
    if (ex.active) return mk('running', 'Recording', `Run ${ex.id || ''} is recording measurements.`);
    if ((ex.failedPoints || 0) > 0) return mk('attention', 'Failed points', `${ex.failedPoints} point(s) failed the quality gate.`, 'Open Experiment Runs.', 'runs');
    return idle('Idle', 'No run is active.');
  }
  if (key === 'spatial') {
    const recs = ex.records || [];
    if (ex.active && recs.length) return mk('running', 'Collecting', `${recs.length} record(s) so far.`);
    if (recs.some((r: any) => r.valid === false)) return mk('attention', 'Suspect data', 'Some records were taken while a rule failed.', 'Open the quality inspector.', 'spatial');
    return idle(recs.length ? 'Data ready' : 'No data', recs.length ? `${recs.length} record(s) are plotted.` : 'Run a scan to see data.');
  }
  return idle('Idle', '');
}

export function getAlert(state: any, key: AlertKey): AlertInfo { return deriveAlert(state, key); }

export const ALERT_KEYS: AlertKey[] = ['facility', 'clock', 'vna', 'scope', 'ldv', 'chamber', 'pumps', 'stage', 'experiment', 'spatial'];
export const ALERT_NAME: Record<AlertKey, string> = { facility: 'Power', clock: 'Reference clock', vna: 'VNA', scope: 'Oscilloscope', ldv: 'Laser vibrometer', chamber: 'Chamber', pumps: 'Vacuum pumps', stage: 'XYZ stage', experiment: 'Experiment run', spatial: 'Data quality' };

export function getAllAlerts(state: any): Record<AlertKey, AlertInfo> {
  const out = {} as Record<AlertKey, AlertInfo>;
  for (const k of ALERT_KEYS) out[k] = deriveAlert(state, k);
  return out;
}

/** The most urgent alert among several parts (used for sidebar entries that cover more than one part). */
export function worstAlert(state: any, keys: AlertKey[]): AlertInfo & { key: AlertKey } {
  let best: (AlertInfo & { key: AlertKey }) | null = null;
  for (const k of keys) { const a = deriveAlert(state, k); if (!best || ALERT_RANK[a.level] < ALERT_RANK[best.level]) best = { ...a, key: k }; }
  return best!;
}

export function summarizeAlerts(state: any): { counts: Record<AlertLevel, number>; items: (AlertInfo & { key: AlertKey; name: string })[]; worst: AlertLevel } {
  const all = getAllAlerts(state);
  const counts: Record<AlertLevel, number> = { idle: 0, running: 0, stuck: 0, error: 0, attention: 0 };
  const items = ALERT_KEYS.filter(k => k !== 'facility' || all[k].level !== 'idle').map(k => ({ ...all[k], key: k, name: ALERT_NAME[k] }));
  for (const k of ALERT_KEYS) counts[all[k].level]++;
  const worst = ALERT_ORDER.find(l => counts[l] > 0) || 'idle';
  return { counts, items: items.sort((a, b) => ALERT_RANK[a.level] - ALERT_RANK[b.level]), worst };
}

/** Which alert parts each sidebar page represents. */
export const PAGE_ALERT_KEYS: Record<string, AlertKey[]> = {
  overview: ['facility'], dashboard: ['facility'], chamber: ['chamber', 'pumps', 'stage'], vna: ['vna'], ldv: ['ldv'], scope: ['scope'], clock: ['clock'], runs: ['experiment'], spatial: ['spatial'],
};

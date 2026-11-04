// Live operation feed. Every change to the simulator (a button, a slider, the command palette, Dr. Wire, an automatic
// milestone such as "clock locked") is compared with the previous state and turned into a plain-English entry:
// what happened, which equipment it touches, what it affects, and what to watch next. The Live Operation Window draws it.
import { operatorTag } from './operator';
import type { EquipId } from './equipment';

export type AnimKind = 'power' | 'clock' | 'rough' | 'turbo' | 'vent' | 'door' | 'thermal' | 'faraday' | 'isolation' | 'stage' | 'home' | 'clamp' | 'rf' | 'sweep' | 'calibrate' | 'laser' | 'ldvscan' | 'scope' | 'run' | 'record' | 'fault' | 'alarm' | 'speed' | 'info';
export type ActivityLevel = 'info' | 'warning' | 'critical';
export type Activity = {
  id: number; iso: string; clock: string; kind: 'command' | 'auto'; anim: AnimKind; equip: EquipId; level: ActivityLevel;
  title: string; what: string; effects: string[]; watch?: string; operator: string; key: string; count: number;
};
type Draft = Omit<Activity, 'id' | 'iso' | 'clock' | 'operator' | 'count'>;

const fmtP = (p: number) => (p >= 10 ? `${p.toFixed(1)} Torr` : `${p.toExponential(1)} Torr`);
const d = (kind: Draft['kind'], anim: AnimKind, equip: EquipId, title: string, what: string, effects: string[], watch?: string, level: ActivityLevel = 'info', key?: string): Draft => ({ kind, anim, equip, level, title, what, effects, watch, key: key || `${equip}:${anim}:${title}` });
const SHIFT = { x: 45.2, y: -12.5, z: 80.1 };

export function deriveActivities(p: any, n: any): Draft[] {
  const out: Draft[] = [];
  if (!p || !n) return out;
  const F = n.facility, c = n.chamber, pc = p.chamber, st = n.stage, ps = p.stage, v = n.vna, pv = p.vna, l = n.ldv, pl = p.ldv, sc = n.scope, psc = p.scope, ck = n.clock, pck = p.clock, ex = n.experiment, pex = p.experiment;
  const on = (b: boolean) => (b ? 'ON' : 'OFF');

  if (F.power !== p.facility.power) out.push(F.power
    ? d('command', 'power', 'breaker', 'Main breaker closed', 'You closed the main breaker. Facility AC power is now online.', ['The instrument rack, pumps and controllers now have power.', 'Every instrument is still switched off until you turn it on.'], 'Next: switch on the rubidium clock so it can warm up.')
    : d('command', 'power', 'breaker', 'Main breaker opened', 'You opened the main breaker. All AC power to the lab is cut.', ['Every instrument, pump and the stage lose power at once.', 'The session state resets (the notebook is kept).'], 'Close the breaker to start again.', 'warning'));
  if (F.power !== p.facility.power || !F.power) return out; // a breaker change is reported on its own; nothing else is compared across a reset
  if (F.mode !== p.facility.mode) out.push(d('command', 'info', 'breaker', `Mode: ${String(F.mode).toUpperCase()}`, `Operating mode changed to ${F.mode}.`, [F.mode === 'training' ? 'The startup wizard offers “Do this for me”.' : 'Training helpers are reduced.'], undefined, 'info', 'mode'));
  if (F.speed !== p.facility.speed) out.push(d('command', 'speed', 'breaker', `Simulation speed ${F.speed}×`, `Simulated time now runs ${F.speed} times faster than real time.`, ['Pumps, warm-up, thermal settling and stage motion all go faster.', 'Scans and sweeps finish sooner.'], undefined, 'info', 'speed'));

  // reference clock
  if (ck.power !== pck.power) out.push(ck.power
    ? d('command', 'clock', 'clock', 'Rubidium clock ON', 'You switched the rubidium clock on. It begins its warm-up.', ['The atomic reference needs about 15 simulated seconds to lock.', 'Until then every measurement is flagged invalid.'], 'Watch the Locked lamp.', 'info')
    : d('command', 'clock', 'clock', 'Rubidium clock OFF', 'You switched the clock off.', ['The VNA, scope and LDV fall back to their own internal timing.', 'Measurements will be flagged invalid.'], undefined, 'warning'));
  if (ck.locked && !pck.locked) out.push(d('auto', 'clock', 'clock', 'Clock locked to 10 MHz', 'The rubidium clock finished warming up and locked.', ['Now every instrument can share one 10 MHz reference.', 'The clock-drift term in the resonance drops to near zero.'], 'The “Rubidium reference locked” rule should now pass.', 'info'));
  if (!ck.locked && pck.locked && ck.power) out.push(d('auto', 'clock', 'clock', 'Clock lock lost', 'The clock is no longer locked.', ['Measurements taken now are flagged invalid.'], 'Check for a drift or cable fault.', 'critical'));

  // chamber / pumps
  // The vent valve is listed first so a combined 'close vent + start pump' change leaves the pump as the newest, most visible entry.
  if (c.vent !== pc.vent) out.push(c.vent
    ? d('command', 'vent', 'vent', 'Vent valve opened', 'You opened the vent valve. Gas flows back into the chamber.', ['Pressure climbs toward atmosphere (760 Torr).', 'Pumps are switched off automatically.', 'Resonance will drop and broaden as air returns.'], 'Wait until it reaches atmosphere before opening the door.', 'warning')
    : d('command', 'vent', 'vent', 'Vent valve closed', 'You closed the vent valve.', ['The chamber can be pumped down again.'], undefined, 'info'));
  if (c.roughing !== pc.roughing) out.push(c.roughing
    ? d('command', 'rough', 'rough', 'Roughing pump started', `You started the roughing pump. Pressure is ${fmtP(c.pressure)}.`, ['It removes most of the air; pressure falls toward about 50 Torr.', 'Pumps add a little vibration (visible on the scope).', 'The door must be closed and the vent valve shut.'], 'When pressure drops below 50 Torr, start the turbo pump.', 'info')
    : d('command', 'rough', 'rough', 'Roughing pump stopped', 'You stopped the roughing pump.', ['Without pumping, gas slowly creeps back in and pressure rises.'], undefined, 'info'));
  if (c.turbo !== pc.turbo) out.push(c.turbo
    ? d('command', 'turbo', 'turbo', 'Turbo pump started', c.pressure > 50 ? 'You asked for the turbo pump above 50 Torr; the protection interlock will refuse it.' : 'You started the turbomolecular pump.', ['The rotor spins up and pulls out the last gas molecules.', 'Pressure heads toward deep vacuum (below 0.001 Torr).', 'Less gas means less damping, so the resonance becomes sharper.'], 'Deep vacuum takes a little while; watch the pressure gauge.', c.pressure > 50 ? 'critical' : 'info')
    : d('command', 'turbo', 'turbo', 'Turbo pump stopped', 'You stopped the turbo pump. The rotor coasts down.', ['Vacuum quality will slowly degrade.'], undefined, 'info'));
  if (c.doorOpen !== pc.doorOpen) out.push(c.doorOpen
    ? d('command', 'door', 'door', 'Chamber door opened', 'You opened the chamber door.', ['Pumps and stage motion are blocked while the door is open.', 'Laser and scans are interlocked off.'], 'Close the door before pumping or moving the stage.', 'warning')
    : d('command', 'door', 'door', 'Chamber door closed', 'You closed the chamber door.', ['The chamber is sealed again; pumping and stage moves are allowed.'], undefined, 'info'));
  if (c.thermostat !== pc.thermostat) out.push(d('command', 'thermal', 'thermo', `Thermostat ${on(c.thermostat)}`, c.thermostat ? 'You switched the active thermostat on.' : 'You switched the thermostat off.', c.thermostat ? [`The heater/cooler drives the chamber toward ${c.targetTemp.toFixed(1)} °C.`, 'Temperature shifts the resonance by about 5 Hz per °C, so it must be steady.'] : ['The chamber temperature now drifts toward room temperature (22 °C).', 'Drift shifts the resonance and weakens your data.'], undefined, c.thermostat ? 'info' : 'warning'));
  if (c.targetTemp !== pc.targetTemp) out.push(d('command', 'thermal', 'thermo', `Setpoint ${c.targetTemp.toFixed(1)} °C`, `You changed the temperature setpoint to ${c.targetTemp.toFixed(1)} °C.`, ['The thermostat will now heat or cool to the new value.', `Expect the resonance to move by about ${((c.targetTemp - pc.targetTemp) * 5).toFixed(1)} Hz.`], 'Wait until the temperature is within ±0.03 °C.', 'info', 'setpoint'));
  if (c.faraday !== pc.faraday) out.push(c.faraday
    ? d('command', 'faraday', 'faraday', 'Faraday cage ON', 'You switched the Faraday cage on.', ['Outside radio noise is blocked from the chamber.', 'The S11 trace and scope hum should clear up.'], undefined, 'info')
    : d('command', 'faraday', 'faraday', 'Faraday cage OFF', 'You switched the Faraday cage off.', ['Radio noise can now reach the instruments.', 'Expect 60 Hz hum on the scope and a noisier S11 trace.', 'Measurement quality drops to INVALID.'], 'Switch it back on before measuring.', 'warning'));
  if (c.isolation !== pc.isolation) out.push(c.isolation
    ? d('command', 'isolation', 'isolation', 'Vibration isolation ON', 'You floated the isolation platform.', ['Floor vibration is no longer passed to the sphere.', 'LDV and scope noise drop.'], undefined, 'info')
    : d('command', 'isolation', 'isolation', 'Vibration isolation OFF', 'You bypassed the isolation platform.', ['Floor vibration now reaches the sphere and the optics.', 'The LDV signal and scope trace get noisier.'], 'Switch it back on before measuring.', 'warning'));

  // stage
  const moved = st.x !== ps.x || st.y !== ps.y || st.z !== ps.z;
  if (moved && (st.motionId || 0) !== (ps.motionId || 0)) {
    const dx = st.x - (ps.x ?? 0), dy = st.y - (ps.y ?? 0), dz = st.z - (ps.z ?? 0), shift = dx * SHIFT.x + dy * SHIFT.y + dz * SHIFT.z;
    const homing = st.x === 0 && st.y === 0 && st.z === 0 && ps.homed !== false && st.homed === false;
    out.push(d('command', homing ? 'home' : 'stage', 'stage', homing ? 'Stage homing' : `Stage → ${st.x.toFixed(1)}, ${st.y.toFixed(1)}, ${st.z.toFixed(1)} mm`, homing ? 'You sent the stage to its home position (0, 0, 0).' : `You commanded the XYZ stage to X ${st.x.toFixed(1)}, Y ${st.y.toFixed(1)}, Z ${st.z.toFixed(1)} mm.`, [`The sphere moves; the servo accelerates, then settles (about half a second of ringing).`, `The model shifts the resonance by about ${shift >= 0 ? '+' : ''}${shift.toFixed(1)} Hz for this move.`, 'The LDV return changes slightly with the new position.'], 'Wait for “settled” before recording a point.', 'info', 'stage-move'));
  }
  if (!st.moving && !st.settling && (ps.moving || ps.settling) && (st.motionId || 0) === (st.lastCompletedMotionId || 0)) out.push(d('auto', 'stage', 'stage', 'Stage settled', `The stage has stopped at X ${(st.actualX ?? st.x).toFixed(2)}, Y ${(st.actualY ?? st.y).toFixed(2)}, Z ${(st.actualZ ?? st.z).toFixed(2)} mm.`, ['The sphere is still; the “stage motion” rule passes.', 'It is now safe to record a measurement.'], undefined, 'info', 'stage-settled'));
  if (st.clampActive !== ps.clampActive) out.push(d('command', 'clamp', 'stage', `Stage clamp ${st.clampActive ? 'ENGAGED' : 'released'}`, st.clampActive ? 'You engaged the mechanical clamp.' : 'You released the mechanical clamp.', st.clampActive ? ['The stage is locked; move commands are refused.'] : ['The stage can move again.'], undefined, st.clampActive ? 'warning' : 'info'));

  // VNA
  if (v.power !== pv.power) out.push(d('command', 'rf', 'vna', `VNA ${on(v.power)}`, v.power ? 'You switched the network analyzer on.' : 'You switched the network analyzer off.', v.power ? ['It is ready, but transmits nothing until RF output is on.'] : ['No RF signal and no S11 trace.'], v.power ? 'Next: enable RF output and calibrate.' : undefined, 'info'));
  if (v.rf !== pv.rf) out.push(d('command', 'rf', 'rf', `RF output ${on(v.rf)}`, v.rf ? 'You switched the RF output on.' : 'You switched the RF output off.', v.rf ? ['A test signal now travels through the coupling fixture into the chamber.', 'The S11 trace begins to show the resonance dip.', 'The RF monitor on the scope shows a ~230 kHz tone.'] : ['The RF stops; the trace flattens.'], v.rf ? 'Calibrate the VNA for trustworthy data.' : undefined, 'info'));
  if (v.calibrated !== pv.calibrated) out.push(v.calibrated
    ? d('command', 'calibrate', 'vna', 'VNA calibrated', `Calibration finished (${v.calibrationType}).`, ['Cable and fixture errors are now removed from the trace.', 'The “VNA calibration” rule passes for the next hour.'], undefined, 'info')
    : d('auto', 'calibrate', 'vna', 'Calibration invalidated', 'The VNA calibration is no longer valid (span changed or it expired).', ['Measurements are flagged suspect until you recalibrate.'], 'Run the calibration again.', 'warning'));
  if (v.sweeping && !pv.sweeping) out.push(d('command', 'sweep', 'vna', 'Frequency sweep started', 'The VNA is sweeping across its frequency span.', ['It records how much RF the sphere reflects at each frequency.', 'The dip in the trace is the resonance.', 'If a run is recording, the result is saved as a record.'], undefined, 'info', 'sweep'));
  if (!v.sweeping && pv.sweeping) out.push(d('auto', 'sweep', 'vna', 'Sweep complete', 'The sweep finished and the resonance was fitted.', ['The fitted frequency, depth and Q are shown.', ex.active ? 'A record was added to the run.' : 'No run was active, so nothing was saved.'], undefined, 'info', 'sweep-done'));
  if (v.center !== pv.center || v.span !== pv.span || v.points !== pv.points || v.ifbw !== pv.ifbw || v.averagingEnabled !== pv.averagingEnabled || v.sourcePowerDbm !== pv.sourcePowerDbm)
    out.push(d('command', 'rf', 'vna', 'VNA settings changed', `Centre ${(v.center / 1000).toFixed(2)} kHz · span ${v.span} Hz · ${v.points} points · IF ${v.ifbw} Hz.`, ['A narrower span or lower IF bandwidth gives a sharper, quieter trace but a slower sweep.', 'Changing the span invalidates the calibration.'], undefined, 'info', 'vna-settings'));

  // LDV
  if (l.power !== pl.power) out.push(d('command', 'laser', 'ldv', `LDV ${on(l.power)}`, l.power ? 'You powered the laser vibrometer.' : 'You powered the vibrometer off.', l.power ? ['The head is ready; no laser is emitted until the shutter is opened.'] : ['The shutter closes and any scan is lost.'], l.power ? 'Open the shutter to start measuring.' : undefined, 'info'));
  if (l.shutter !== pl.shutter) out.push(l.shutter
    ? d('command', 'laser', 'ldv', 'Laser shutter OPEN', 'You opened the laser shutter. A Class 2 red beam now hits the sphere through the top window.', ['The vibrometer measures the sphere’s surface vibration.', 'The optical-return gauge shows how well the light comes back.', 'Door-open and scans are interlocked while the beam is on.'], 'Aim for an optical return above 60%.', 'info')
    : d('command', 'laser', 'ldv', 'Laser shutter CLOSED', 'You closed the laser shutter. The beam stops.', ['No vibration measurement is possible.', 'A running scan stalls until the shutter opens.'], undefined, 'info'));
  if (l.scanActive && !pl.scanActive) out.push(d('command', 'ldvscan', 'ldv', `3D scan started: ${l.scanTitle || 'LDV scan'}`, 'The scanning mirrors are steering the laser spot over the sphere.', ['Each grid point is measured in turn and added to the result.', 'The results appear in the Scan results panel as soon as the scan completes.'], 'Keep the stage still and the shutter open.', 'info', 'ldv-scan'));
  if (!l.scanActive && pl.scanActive && l.scanResult) out.push(d('auto', 'ldvscan', 'ldv', '3D scan complete', `${l.scanResult.title}: verdict ${String(l.scanResult.verdict).toUpperCase()}.`, ['The result is in the “Scan results” panel on the LDV page.', 'It was added to the scan history and can be exported or added to the notebook.'], 'Open the LDV page → Scan results.', l.scanResult.verdict === 'poor' ? 'warning' : 'info', 'ldv-scan-done'));
  if (l.scanActive && l.scanStalled && !pl.scanStalled) out.push(d('auto', 'alarm', 'ldv', 'LDV scan stalled', l.scanStalledReason || 'The scan cannot continue.', ['The scan keeps its progress and resumes automatically when the cause is fixed.'], 'Fix the cause shown, then the scan resumes.', 'warning', 'ldv-stall'));
  if (l.alignmentX !== pl.alignmentX || l.alignmentY !== pl.alignmentY || l.focus !== pl.focus) out.push(d('command', 'laser', 'ldv', 'Beam alignment changed', `Beam X ${(l.alignmentX || 0).toFixed(1)}, Y ${(l.alignmentY || 0).toFixed(1)}, focus ${(l.focus || 0).toFixed(1)}.`, ['Moving the beam off-centre or out of focus lowers the optical return.', 'A lower return makes every LDV result noisier.'], 'Use the alignment map to find the best spot.', 'info', 'ldv-align'));

  // scope
  if (sc.power !== psc.power) out.push(d('command', 'scope', 'scope', `Oscilloscope ${on(sc.power)}`, sc.power ? 'You switched the oscilloscope on. It runs a short self-test.' : 'You switched the oscilloscope off.', sc.power ? ['After the self-test the screen shows live waveforms.', 'Each channel can watch a different signal in the lab.'] : ['The display goes dark.'], sc.power ? 'Try a scenario on the Oscilloscope page.' : undefined, 'info'));
  if (sc.running !== psc.running && sc.power) out.push(d('command', 'scope', 'scope', sc.running ? 'Scope RUN' : 'Scope STOP', sc.running ? 'You set the scope to run.' : 'You stopped the scope. The screen freezes.', sc.running ? ['Waveforms update live.'] : ['The picture is frozen; use it to measure and place cursors.'], undefined, 'info'));
  if (sc.timebase !== psc.timebase || sc.triggerLevel !== psc.triggerLevel || sc.triggerSource !== psc.triggerSource || sc.holdMode !== psc.holdMode || sc.triggerSlope !== psc.triggerSlope)
    out.push(d('command', 'scope', 'scope', 'Scope time/trigger changed', `${sc.timebase} µs/div · trigger ${sc.triggerSource} ${sc.triggerSlope || 'rising'} at ${(sc.triggerLevel ?? 0).toFixed(2)} V · ${sc.holdMode || 'auto'}.`, ['The timebase sets how much time the screen covers.', 'The trigger decides where the wave starts so the picture is steady.'], undefined, 'info', 'scope-time'));
  if (sc.channels !== psc.channels && sc.power && JSON.stringify(sc.channels) !== JSON.stringify(psc.channels)) out.push(d('command', 'scope', 'scope', 'Scope channels changed', 'A channel was switched, re-sourced or rescaled.', ['Each channel watches one signal: RF monitor, LDV output, clock, room probe, accelerometer or stage servo.'], undefined, 'info', 'scope-ch'));
  if (sc.scenario !== psc.scenario && sc.scenario) out.push(d('command', 'scope', 'scope', 'Scope scenario applied', `Setup loaded: ${sc.scenario}.`, ['Timebase, trigger and channels were set for this exercise.'], 'Follow the steps on the scenario card.', 'info', 'scope-scn'));

  // experiment
  if (ex.active && !pex.active) out.push(d('command', 'run', 'daq', ex.scanActive ? 'Automated scan started' : 'Recording run started', ex.scanActive ? `The workstation will visit ${ex.scanPath.length} planned positions, one after another.` : `Run ${ex.id} is recording.`, ex.scanActive ? ['At each point: move → settle → sweep → quality check.', 'Poor points are re-measured automatically up to the retry limit.'] : ['Every sweep you take is saved with the conditions at that moment.'], undefined, 'info', 'run'));
  if (!ex.active && pex.active) out.push(d('command', 'run', 'daq', 'Run finished', `The run stopped with ${(ex.records || []).length} record(s).`, ['Records are available in Experiment Runs and the Spatial Field Explorer.'], 'Review quality, then export CSV/JSON.', 'info', 'run'));
  if (ex.scanPaused && !pex.scanPaused) out.push(d('auto', 'alarm', 'daq', 'Scan paused', ex.scanMessage || 'The scan is paused.', ['It will not continue until you resume or abort it.'], undefined, 'warning', 'scan-pause'));
  if ((ex.records || []).length > (pex.records || []).length) out.push(d('auto', 'record', 'daq', `Record #${(ex.records || []).length} saved`, 'A measurement was added to the run.', ['It carries the resonance, depth, Q and the conditions at that moment.', 'It appears in the Spatial Field Explorer.'], undefined, 'info', 'record'));

  // faults
  for (const k of Object.keys(n.failures || {})) if (n.failures[k] !== p.failures?.[k]) out.push(d('command', 'fault', 'breaker', `Fault ${n.failures[k] ? 'injected' : 'cleared'}: ${k}`, n.failures[k] ? `A simulated ${k} fault is now active.` : `The ${k} fault was cleared.`, n.failures[k] ? ['The physics model and alarms react to it.'] : ['Normal behaviour returns.'], undefined, n.failures[k] ? 'warning' : 'info', `fault-${k}`));

  // new alarms
  const known = n.alarms !== p.alarms ? new Set((p.alarms || []).map((a: any) => a.id)) : null;
  if (known) for (const a of (n.alarms || []).slice(0, 4)) if (!known.has(a.id)) out.push(d('auto', 'alarm', 'breaker', a.severity === 'critical' ? 'Critical alarm' : 'Alarm raised', a.text, ['Open alarms are listed in the journal and on the lab map.'], 'Fix the cause, then acknowledge.', a.severity === 'critical' ? 'critical' : 'warning', `alarm-${a.text}`));
  return out;
}

/* ───────── The bus: a small external store the window subscribes to ───────── */
let seq = 0;
let items: Activity[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());
export const subscribeActivity = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };
export const getActivities = () => items;
export const clearActivities = () => { items = []; emit(); };

/** Appends drafts. A draft with the same key as the newest entry (within 1.4 s) replaces it, so dragging a slider is one line, not fifty. */
export function pushActivities(drafts: Draft[], operator: string, nowMs = Date.now()) {
  if (!drafts.length) return;
  const iso = new Date(nowMs).toISOString(), clock = new Date(nowMs).toLocaleTimeString();
  let next = items;
  for (const dr of drafts) {
    const last = next[0];
    if (last && last.key === dr.key && nowMs - Date.parse(last.iso) < 1400) next = [{ ...last, ...dr, iso, clock, operator, count: last.count + 1 }, ...next.slice(1)];
    else next = [{ ...dr, id: ++seq, iso, clock, operator, count: 1 }, ...next].slice(0, 60);
  }
  items = next; emit();
}

/** Subscribes to the simulator and feeds the bus. `subscribe` must call back with (prev, next) states. */
export function installActivityTracker(subscribe: (cb: (prev: any, next: any) => void) => () => void): () => void {
  return subscribe((prev, next) => { try { const dr = deriveActivities(prev, next); if (dr.length) pushActivities(dr, operatorTag(next.operator)); } catch { /* the window must never break the simulator */ } });
}

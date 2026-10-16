// Plain-data description of the lab's parts for the engineering schematic: tags, health, live values,
// signal links and which fault or alarm belongs to which part. No React here, so it is unit-tested.
export type Health = 'ok' | 'warn' | 'fail' | 'off';
export type FaultKey = 'clockDrift' | 'ldvMisalign' | 'vacuumLeak' | 'emiSpike' | 'stageBacklash';
export type PartDef = {
  id: string; tag: string; label: string; group: 'vacuum' | 'thermal' | 'rf' | 'optical' | 'timing' | 'mech' | 'control' | 'safety';
  help: string;             // key into OVERVIEW_HELP
  labPick?: string;         // name of the matching pickable in the realistic 3D lab
  view: string;             // camera preset to fly to in the 3D lab
  faults: FaultKey[];       // injected faults that live in this part
  alarm?: RegExp;           // alarm texts that belong to this part
  health: (s: any) => { state: Health; why: string };
  values: (s: any) => { label: string; value: string }[];
};

export const fmtP = (p: number) => (p >= 100 ? `${p.toFixed(0)} Torr` : p >= 1 ? `${p.toFixed(1)} Torr` : `${p.toExponential(1)} Torr`);
const H = (state: Health, why: string) => ({ state, why });
const off = (s: any) => !s.facility.power;

export const PARTS: PartDef[] = [
  { id: 'chamber', tag: 'CH-101', label: 'Thermal-vacuum chamber', group: 'vacuum', help: 'ov.chamber', labPick: 'chamber', view: 'chamber', faults: ['vacuumLeak'], alarm: /vacuum|pressure|turbo pump protection/i,
    health: s => off(s) ? H('off', 'No facility power') : s.failures.vacuumLeak ? H('fail', 'Vacuum leak: pressure cannot fall') : s.chamber.doorOpen ? H('warn', 'Door is open') : s.chamber.pressure < 1e-3 ? H('ok', 'At deep vacuum') : s.chamber.roughing || s.chamber.turbo ? H('warn', 'Pumping down') : H('warn', 'Not under vacuum'),
    values: s => [{ label: 'Pressure', value: fmtP(s.chamber.pressure) }, { label: 'State', value: s.chamber.vent ? 'venting / vented' : s.chamber.turbo ? 'turbo running' : s.chamber.roughing ? 'roughing' : 'pumps off' }] },
  { id: 'door', tag: 'DR-101', label: 'Chamber door and seal', group: 'safety', help: 'ov.door', labPick: 'chamber', view: 'chamber', faults: [], alarm: /door/i,
    health: s => s.chamber.doorOpen ? H('warn', 'Open') : s.failures.vacuumLeak ? H('fail', 'Seal is leaking') : H('ok', 'Closed and sealed'),
    values: s => [{ label: 'Door', value: s.chamber.doorOpen ? 'open' : 'closed' }] },
  { id: 'roughing', tag: 'P-101', label: 'Roughing pump', group: 'vacuum', help: 'ov.roughing', labPick: 'pumps', view: 'chamber', faults: [],
    health: s => off(s) ? H('off', 'No facility power') : s.chamber.roughing ? H('ok', 'Running') : H('off', 'Stopped'),
    values: s => [{ label: 'Speed', value: `${Math.round(s.chamber.roughingRpm || 0)} %` }] },
  { id: 'turbo', tag: 'P-102', label: 'Turbomolecular pump', group: 'vacuum', help: 'ov.turbo', labPick: 'pumps', view: 'chamber', faults: [], alarm: /turbo/i,
    health: s => off(s) ? H('off', 'No facility power') : s.chamber.turbo && s.chamber.pressure > 50 ? H('fail', 'Running above 50 Torr') : s.chamber.turbo ? H('ok', 'Running') : H('off', 'Stopped'),
    values: s => [{ label: 'Rotor speed', value: `${Math.round(s.chamber.turboRpm || 0)} %` }] },
  { id: 'gauge', tag: 'PT-101', label: 'Pressure gauge', group: 'vacuum', help: 'ov.pressure', labPick: 'chamber', view: 'chamber', faults: [],
    health: s => off(s) ? H('off', 'No facility power') : H('ok', 'Reading'), values: s => [{ label: 'Reading', value: fmtP(s.chamber.pressure) }] },
  { id: 'thermo', tag: 'TT-101', label: 'Thermostat and temperature sensor', group: 'thermal', help: 'ov.temperature', labPick: 'chamber', view: 'chamber', faults: [],
    health: s => { if (off(s)) return H('off', 'No facility power'); const d = Math.abs(s.chamber.temperature - s.chamber.targetTemp); return d < 0.03 ? H('ok', 'Within 0.03 °C') : d < 0.1 ? H('warn', 'Settling') : H('warn', 'Far from setpoint'); },
    values: s => [{ label: 'Temperature', value: `${s.chamber.temperature.toFixed(3)} °C` }, { label: 'Setpoint', value: `${s.chamber.targetTemp.toFixed(2)} °C` }] },
  { id: 'faraday', tag: 'FC-101', label: 'Faraday cage', group: 'rf', help: 'ov.faraday', labPick: 'chamber', view: 'chamber', faults: ['emiSpike'], alarm: /shielding|EMI|RF/i,
    health: s => s.failures.emiSpike ? H('fail', 'Interference source is active') : s.chamber.faraday ? H('ok', 'Shielding on') : H('warn', 'Shielding off'), values: s => [{ label: 'Shield', value: s.chamber.faraday ? 'on' : 'off' }] },
  { id: 'isolation', tag: 'VI-101', label: 'Vibration isolation', group: 'mech', help: 'ov.isolation', labPick: 'chamber', view: 'chamber', faults: [], alarm: /isolation/i,
    health: s => s.chamber.isolation ? H('ok', 'Floating') : H('warn', 'Bypassed'), values: s => [{ label: 'Platform', value: s.chamber.isolation ? 'floating' : 'bypassed' }] },
  { id: 'stage', tag: 'ST-101', label: 'XYZ stage', group: 'mech', help: 'ov.stage', labPick: 'stage', view: 'stage', faults: ['stageBacklash'], alarm: /stage/i,
    health: s => off(s) ? H('off', 'No facility power') : s.failures.stageBacklash ? H('fail', 'Backlash: will not settle') : s.stage.clampActive ? H('warn', 'Clamp engaged') : s.stage.moving || s.stage.settling ? H('warn', s.stage.moving ? 'Moving' : 'Settling') : H('ok', 'Settled'),
    values: s => [{ label: 'Position', value: `${s.stage.x.toFixed(2)}, ${s.stage.y.toFixed(2)}, ${s.stage.z.toFixed(2)} mm` }, { label: 'Homed', value: s.stage.homed ? 'yes' : 'no' }] },
  { id: 'sphere', tag: 'SP-101', label: 'Test sphere', group: 'mech', help: 'ov.stage', labPick: 'stage', view: 'stage', faults: [],
    health: s => off(s) ? H('off', 'No facility power') : H('ok', 'Mounted on the stage'), values: s => [{ label: 'At', value: `X ${s.stage.x.toFixed(1)} Y ${s.stage.y.toFixed(1)} Z ${s.stage.z.toFixed(1)} mm` }] },
  { id: 'clock', tag: 'FS-101', label: 'Rubidium clock', group: 'timing', help: 'ov.clock', labPick: 'rack', view: 'rack', faults: ['clockDrift'], alarm: /clock|reference/i,
    health: s => off(s) || !s.clock.power ? H('off', 'Powered off') : s.failures.clockDrift || s.clock.cableFault ? H('fail', 'Drifting or cable fault') : s.clock.locked ? H('ok', 'Locked to 10 MHz') : H('warn', 'Warming up'),
    values: s => [{ label: 'Lock', value: s.clock.locked ? 'locked' : s.clock.power ? 'warming up' : 'off' }] },
  { id: 'vna', tag: 'VNA-101', label: 'Network analyzer', group: 'rf', help: 'ov.vna', labPick: 'rack', view: 'rack', faults: [], alarm: /VNA|calibration|sweep/i,
    health: s => off(s) || !s.vna.power ? H('off', 'Powered off') : s.failures.emiSpike ? H('fail', 'Noise floor raised by interference') : !s.vna.calibrated ? H('warn', 'Not calibrated') : H('ok', 'Calibrated'),
    values: s => [{ label: 'RF', value: s.vna.rf ? 'on' : 'off' }, { label: 'Calibration', value: s.vna.calibrated ? `${Math.round((s.vna.calibrationAgeSeconds || 0) / 60)} min old` : 'none' }] },
  { id: 'ldv', tag: 'LDV-101', label: 'Laser vibrometer', group: 'optical', help: 'ov.ldv', labPick: 'ldv', view: 'chamber', faults: ['ldvMisalign'], alarm: /LDV|laser|optical/i,
    health: s => off(s) || !s.ldv.power ? H('off', 'Powered off') : s.failures.ldvMisalign ? H('fail', 'Beam misaligned') : s.ldv.shutter ? H('warn', 'Laser emitting: eye protection') : H('ok', 'Shutter closed'),
    values: s => [{ label: 'Shutter', value: s.ldv.shutter ? 'open' : 'closed' }, { label: 'Optical quality', value: `${Math.round(s.ldv.opticalQuality ?? 100)}` }] },
  { id: 'scope', tag: 'SC-101', label: 'Oscilloscope', group: 'control', help: 'ov.scope', labPick: 'rack', view: 'rack', faults: [],
    health: s => off(s) || !s.scope.power ? H('off', 'Powered off') : H('ok', 'Running'), values: s => [{ label: 'Timebase', value: `${s.scope.timebase} µs/div` }] },
  { id: 'pc', tag: 'PC-101', label: 'Workstation', group: 'control', help: 'ov.workstation', labPick: 'workstation', view: 'bench', faults: [],
    health: s => off(s) ? H('off', 'No facility power') : s.experiment.scanActive ? H('ok', 'Running a scan') : H('ok', 'Ready'),
    values: s => [{ label: 'Scan', value: s.experiment.scanActive ? `${Math.round((s.experiment.scanProgress || 0) * 100)} %` : 'idle' }, { label: 'Records', value: String((s.experiment.records || []).length) }] },
  { id: 'breaker', tag: 'MB-101', label: 'Main breaker', group: 'safety', help: 'ov.breaker', labPick: 'rack', view: 'rack', faults: [],
    health: s => off(s) ? H('off', 'Open: no power') : H('ok', 'Closed'), values: s => [{ label: 'Breaker', value: s.facility.power ? 'closed' : 'open' }] },
];
export const PART_BY_ID: Record<string, PartDef> = Object.fromEntries(PARTS.map(p => [p.id, p]));
export const partForLabPick = (name: string): string | null => PARTS.find(p => p.labPick === name)?.id ?? null;

/** Which part owns an open alarm (by its text) or an injected fault. */
export function partsWithProblems(s: any): { partId: string; reason: string; alarmId?: string | number; kind: 'fault' | 'alarm' }[] {
  const out: { partId: string; reason: string; alarmId?: string | number; kind: 'fault' | 'alarm' }[] = [];
  const blind = !!(s.faultDrill?.hiddenKey && !s.faultDrill.revealed);
  for (const p of PARTS) {
    const h = p.health(s);
    if (h.state === 'fail' && !blind) out.push({ partId: p.id, reason: h.why, kind: 'fault' });
    const al = (s.alarms || []).find((a: any) => !a.acknowledged && p.alarm && p.alarm.test(String(a.text)));
    if (al) out.push({ partId: p.id, reason: String(al.text), alarmId: al.id, kind: 'alarm' });
  }
  return out;
}

export type LinkState = 'ok' | 'degraded' | 'broken';
export type SignalLink = { id: string; from: string; to: string; label: string; state: LinkState; reason: string };

/** The signal path between instruments, with the reason a link is broken or noisy. */
export function signalLinks(s: any): SignalLink[] {
  const clockOk = s.clock.power && s.clock.locked && !s.failures.clockDrift && !s.clock.cableFault;
  const clockWhy = !s.clock.power ? 'Clock is off' : s.failures.clockDrift || s.clock.cableFault ? 'Reference is drifting or the cable is faulty' : !s.clock.locked ? 'Clock has not locked yet' : '10 MHz reference is good';
  const ref = (to: string, name: string): SignalLink => ({ id: `ref-${to}`, from: 'clock', to, label: '10 MHz reference', state: clockOk ? 'ok' : 'broken', reason: clockWhy });
  const rfOn = s.vna.power && s.vna.rf;
  const noisy = !s.chamber.faraday || s.failures.emiSpike;
  const laserOn = s.ldv.power && s.ldv.shutter;
  const quality = s.ldv.opticalQuality ?? 100;
  const L: SignalLink[] = [
    ref('vna', 'VNA'), ref('ldv', 'LDV'), ref('scope', 'scope'),
    { id: 'rf-drive', from: 'vna', to: 'sphere', label: 'RF drive and S11 return', state: !rfOn ? 'broken' : noisy ? 'degraded' : 'ok', reason: !s.vna.power ? 'VNA is off' : !s.vna.rf ? 'RF output is off' : s.failures.emiSpike ? 'Interference is raising the noise floor' : !s.chamber.faraday ? 'Faraday cage is off: RF noise can enter' : 'RF path is clean' },
    { id: 'laser', from: 'ldv', to: 'sphere', label: 'Laser beam and return', state: !laserOn ? 'broken' : quality < 70 || s.failures.ldvMisalign ? 'degraded' : 'ok', reason: !s.ldv.power ? 'LDV is off' : !s.ldv.shutter ? 'Shutter is closed: no laser' : s.failures.ldvMisalign ? 'Beam is misaligned' : quality < 70 ? `Optical quality is low (${Math.round(quality)})` : 'Beam is on target' },
    { id: 'velocity', from: 'ldv', to: 'scope', label: 'Velocity output', state: s.ldv.power && s.scope.power ? (s.chamber.isolation ? 'ok' : 'degraded') : 'broken', reason: !s.ldv.power ? 'LDV is off' : !s.scope.power ? 'Scope is off' : !s.chamber.isolation ? 'Vibration isolation is off: floor motion in the signal' : 'Signal is clean' },
    { id: 'data-vna', from: 'vna', to: 'pc', label: 'Trace data', state: s.facility.power && s.vna.power ? 'ok' : 'broken', reason: s.vna.power ? 'Data is flowing' : 'VNA is off' },
    { id: 'data-ldv', from: 'ldv', to: 'pc', label: 'LDV data', state: s.facility.power && s.ldv.power ? 'ok' : 'broken', reason: s.ldv.power ? 'Data is flowing' : 'LDV is off' },
    { id: 'motion', from: 'pc', to: 'stage', label: 'Stage commands', state: !s.facility.power ? 'broken' : s.stage.clampActive || s.chamber.doorOpen ? 'degraded' : 'ok', reason: !s.facility.power ? 'No facility power' : s.stage.clampActive ? 'Clamp is engaged' : s.chamber.doorOpen ? 'Door is open: moves are interlocked' : 'Commands accepted' },
  ];
  return L;
}

/** Keeps a rolling history for the sparklines. */
export type Sample = { t: number; pressure: number; tempErr: number; optical: number };
export function pushSample(h: Sample[], s: any, t: number, max = 90): Sample[] {
  const next = h.length && t - h[h.length - 1].t < 1 ? h : [...h, { t, pressure: s.chamber.pressure, tempErr: Math.abs(s.chamber.temperature - s.chamber.targetTemp), optical: s.ldv.opticalQuality ?? 100 }];
  return next.length > max ? next.slice(next.length - max) : next;
}

// The single list of things that can be done in the lab. The command palette, Dr. Wire's task runner
// and the AI tool calls all go through this registry, so the same interlocks apply everywhere.
//
// Every action has: an id, a description, a JSON schema for its parameters, a risk level,
// preconditions that read the real state, a dispatch that goes through the app's reducer, and a
// `done` predicate that reads real state so callers can wait for the effect instead of guessing.

export type Risk = 'safe' | 'confirm' | 'destructive';
export type Station = 'gauge' | 'notebook' | 'rackKnob' | 'workstation' | 'doorSeal' | 'laser' | 'phone' | 'stage' | 'board';
export type Gesture = 'point' | 'readGauge' | 'write' | 'knob' | 'type' | 'inspect' | 'pointUp' | 'wave';

export type JsonSchema = {
  type: 'object';
  properties: Record<string, { type: 'number' | 'string' | 'boolean'; description: string; enum?: string[]; minimum?: number; maximum?: number }>;
  required?: string[];
  additionalProperties: false;
};

type State = any;
export type Ctx = {
  getState: () => State;
  dispatch: (action: any) => void;
  /** Optional helpers that only the React component can provide. */
  helpers?: { performSweep?: () => void; exportCsv?: () => void; exportJson?: () => void };
};
export type Check = { ok: true } | { ok: false; reason: string };

export type ActionDef = {
  id: string;
  label: string;
  category: 'Navigation' | 'Power' | 'Chamber' | 'Instruments' | 'Stage' | 'Experiment' | 'System' | 'Data' | 'Help';
  description: string;
  params: JsonSchema;
  risk: Risk | ((s: State, p: any) => Risk);
  /** Why this action cannot run right now, from real state. */
  check: (s: State, p: any) => Check;
  run: (c: Ctx, p: any) => void;
  /** True once the real state shows the effect. Used by waitFor and the task runner. */
  done: (s: State, p: any) => boolean;
  confirmText?: (s: State, p: any) => string;
  station?: Station;
  gesture?: Gesture;
  narrate?: (p: any) => string;
  timeoutMs?: number;
  palette?: boolean;
};

const none: JsonSchema = { type: 'object', properties: {}, additionalProperties: false };
const ok: Check = { ok: true };
const no = (reason: string): Check => ({ ok: false, reason });
const LIMIT_MM = 35;
const PAGES = ['dashboard', 'chamber', 'spatial', 'vna', 'ldv', 'scope', 'clock', 'runs', 'training', 'challenges'];
const PAGE_LABEL: Record<string, string> = { dashboard: 'Operator Console', chamber: '3D Chamber & Stage', spatial: 'Spatial Field Explorer', vna: 'VNA Analysis', ldv: 'LDV Scanner', scope: 'Oscilloscope', clock: 'Frequency Reference', runs: 'Experiment Runs', training: 'Training & Checklist', challenges: 'Challenge Mode' };
const powered = (s: State) => !!s.facility.power;
const needPower = (s: State): Check | null => (powered(s) ? null : no('The main breaker is open. Close it first.'));
const stageBlocked = (s: State): Check | null =>
  needPower(s) || (s.chamber.doorOpen ? no('The chamber door is open.') : s.stage.clampActive ? no('The stage clamp is engaged.') : s.chamber.vent ? no('The chamber is venting.') : null);
const stageIdle = (s: State) => !s.stage.moving && !s.stage.settling;
const patch = (domain: string, p: Record<string, unknown>) => ({ type: 'PATCH', domain, patch: p });
const num = (name: string, description: string, minimum: number, maximum: number) => ({ type: 'number' as const, description, minimum, maximum });
const onOff = (what: string) => ({ on: { type: 'boolean' as const, description: `true to turn ${what} on, false to turn it off` } });

export const ACTIONS: ActionDef[] = [
  ...PAGES.map((page): ActionDef => ({
    id: `go_${page}`, label: `Navigate: ${PAGE_LABEL[page]}`, category: 'Navigation', description: `Open the ${PAGE_LABEL[page]} page.`, params: none, risk: 'safe', palette: true,
    check: () => ok, run: c => c.dispatch({ type: 'SET_UI', patch: { active: page } }), done: s => s.ui.active === page, station: 'workstation', gesture: 'type', narrate: () => `Opening ${PAGE_LABEL[page]}.`,
  })),
  {
    id: 'power_on', label: 'Close the main breaker', category: 'Power', description: 'Close the main breaker to give the facility AC power.', params: none, risk: 'safe',
    check: s => (powered(s) ? no('Facility power is already on.') : ok), run: c => c.dispatch({ type: 'POWER', value: true }), done: s => powered(s),
    station: 'rackKnob', gesture: 'knob', narrate: () => 'Closing the main breaker.',
  },
  {
    id: 'power_off', label: 'Open the main breaker', category: 'Power', description: 'Open the main breaker. This cuts power and resets every instrument.', params: none, risk: 'destructive',
    check: s => (powered(s) ? ok : no('Facility power is already off.')), run: c => c.dispatch({ type: 'POWER', value: false }), done: s => !powered(s),
    confirmText: () => 'Opening the main breaker cuts AC power to all instruments and resets session state (the notebook is kept).',
    station: 'rackKnob', gesture: 'knob', narrate: () => 'Opening the main breaker.',
  },
  {
    id: 'clock_power', label: 'Power the Rubidium clock', category: 'Instruments', description: 'Turn the Rubidium clock on or off. After power on it warms up for about 15 seconds before it locks.',
    params: { type: 'object', properties: onOff('the clock'), required: ['on'], additionalProperties: false }, risk: 'safe',
    check: s => needPower(s) || ok, run: (c, p) => c.dispatch(patch('clock', { power: !!p.on })), done: (s, p) => !!s.clock.power === !!p.on,
    station: 'rackKnob', gesture: 'knob', narrate: p => (p.on ? 'Powering on the Rubidium clock.' : 'Powering off the clock.'),
  },
  {
    id: 'close_door', label: 'Close the chamber door', category: 'Chamber', description: 'Close and seal the chamber door.', params: none, risk: 'safe',
    check: s => (s.chamber.doorOpen ? ok : no('The door is already closed.')), run: c => c.dispatch(patch('chamber', { doorOpen: false })), done: s => !s.chamber.doorOpen,
    station: 'doorSeal', gesture: 'inspect', narrate: () => 'Closing the chamber door.',
  },
  {
    id: 'open_door', label: 'Open the chamber door', category: 'Chamber', description: 'Open the chamber door. The laser shutter must be closed. Opening under vacuum is a seal blowout risk.', params: none,
    risk: s => (s.chamber.pressure < 760 ? 'destructive' : 'safe'),
    check: s => (s.chamber.doorOpen ? no('The door is already open.') : s.ldv.shutter ? no('The laser shutter is open. Close it before opening the door.') : ok),
    run: c => c.dispatch(patch('chamber', { doorOpen: true })), done: s => !!s.chamber.doorOpen,
    confirmText: () => 'The chamber is not fully vented to 760 Torr. Opening the door under vacuum will cause a seal blowout.',
    station: 'doorSeal', gesture: 'inspect', narrate: () => 'Opening the chamber door.',
  },
  {
    id: 'start_roughing', label: 'Start Roughing Vacuum Pump', category: 'Chamber', description: 'Start the roughing pump to pump the chamber down toward 50 Torr.', params: none, risk: 'safe', palette: true,
    check: s => needPower(s) || (s.chamber.doorOpen ? no('The chamber door is open.') : s.chamber.roughing ? no('The roughing pump is already running.') : ok),
    run: c => c.dispatch(patch('chamber', { vent: false, roughing: true })), done: s => !!s.chamber.roughing && !s.chamber.vent,
    station: 'gauge', gesture: 'readGauge', narrate: () => 'Starting the roughing pump.',
  },
  {
    id: 'start_turbo', label: 'Start Turbomolecular Pump', category: 'Chamber', description: 'Start the turbo pump to reach deep vacuum. Needs pressure below 50 Torr.', params: none, risk: 'safe', palette: true,
    check: s => needPower(s) || (s.chamber.doorOpen ? no('The chamber door is open.') : s.chamber.pressure > 50 ? no('Pressure must be below 50 Torr before the turbo can start. Run the roughing pump first.') : s.chamber.turbo ? no('The turbo is already running.') : ok),
    run: c => c.dispatch(patch('chamber', { vent: false, roughing: true, turbo: true })), done: s => !!s.chamber.turbo,
    station: 'gauge', gesture: 'readGauge', narrate: () => 'Starting the turbo pump.',
  },
  {
    id: 'wait_pressure', label: 'Wait for pressure', category: 'Chamber', description: 'Wait until the chamber pressure is below a target (in Torr). Does not change anything.',
    params: { type: 'object', properties: { below_torr: num('below_torr', 'Target pressure in Torr', 1e-9, 760) }, required: ['below_torr'], additionalProperties: false }, risk: 'safe',
    check: (s, p) => (s.chamber.pressure < p.below_torr || s.chamber.roughing || s.chamber.turbo ? ok : no('No pump is running, so the pressure will not fall.')), run: () => {}, done: (s, p) => s.chamber.pressure < p.below_torr, timeoutMs: 600000,
    station: 'gauge', gesture: 'readGauge', narrate: p => `Watching the gauge until we are below ${p.below_torr} Torr.`,
  },
  {
    id: 'vent_chamber', label: 'Vent the chamber', category: 'Chamber', description: 'Stop the pumps and let air back in.', params: none,
    risk: s => (s.chamber.pressure < 1 ? 'destructive' : 'confirm'),
    check: s => (s.chamber.vent ? no('The chamber is already venting.') : ok), run: c => c.dispatch(patch('chamber', { vent: true, roughing: false, turbo: false })), done: s => !!s.chamber.vent,
    confirmText: s => (s.chamber.pressure < 1 ? 'The chamber is under deep vacuum. Venting now will cause a rapid gas rush and potential turbulence shock.' : 'Venting stops the pumps and loses the vacuum.'),
    station: 'gauge', gesture: 'readGauge', narrate: () => 'Venting the chamber.',
  },
  {
    id: 'set_faraday', label: 'Faraday cage', category: 'Chamber', description: 'Turn the Faraday cage shielding on or off.', params: { type: 'object', properties: onOff('the Faraday cage'), required: ['on'], additionalProperties: false },
    risk: (s, p) => (p?.on === false ? 'confirm' : 'safe'), check: () => ok, run: (c, p) => c.dispatch(patch('chamber', { faraday: !!p.on })), done: (s, p) => !!s.chamber.faraday === !!p.on,
    confirmText: () => 'Turning the Faraday cage off lets RF noise in and can corrupt VNA data.', station: 'rackKnob', gesture: 'knob', narrate: p => (p.on ? 'Switching the Faraday cage on.' : 'Switching the Faraday cage off.'),
  },
  {
    id: 'toggle_faraday', label: 'Toggle Faraday Cage Shielding', category: 'Chamber', description: 'Flip the Faraday cage.', params: none, risk: s => (s.chamber.faraday ? 'confirm' : 'safe'), palette: true,
    check: () => ok, run: c => c.dispatch(patch('chamber', { faraday: !c.getState().chamber.faraday })), done: () => true, confirmText: () => 'Turning the Faraday cage off lets RF noise in and can corrupt VNA data.',
  },
  {
    id: 'set_isolation', label: 'Vibration isolation', category: 'Chamber', description: 'Turn active vibration isolation on or off.', params: { type: 'object', properties: onOff('vibration isolation'), required: ['on'], additionalProperties: false },
    risk: (s, p) => (p?.on === false ? 'confirm' : 'safe'), check: () => ok, run: (c, p) => c.dispatch(patch('chamber', { isolation: !!p.on })), done: (s, p) => !!s.chamber.isolation === !!p.on,
    confirmText: () => 'Turning isolation off lets floor vibration into the LDV and scope signals.', station: 'rackKnob', gesture: 'knob', narrate: p => (p.on ? 'Switching vibration isolation on.' : 'Switching vibration isolation off.'),
  },
  {
    id: 'toggle_isolation', label: 'Toggle Active Vibration Isolation', category: 'Chamber', description: 'Flip vibration isolation.', params: none, risk: s => (s.chamber.isolation ? 'confirm' : 'safe'), palette: true,
    check: () => ok, run: c => c.dispatch(patch('chamber', { isolation: !c.getState().chamber.isolation })), done: () => true, confirmText: () => 'Turning isolation off lets floor vibration into the LDV and scope signals.',
  },
  {
    id: 'set_temperature', label: 'Set chamber temperature', category: 'Chamber', description: 'Set the thermostat setpoint in degrees Celsius.',
    params: { type: 'object', properties: { celsius: num('celsius', 'Setpoint in °C', 15, 30) }, required: ['celsius'], additionalProperties: false }, risk: 'safe',
    check: s => needPower(s) || ok, run: (c, p) => c.dispatch(patch('chamber', { targetTemp: p.celsius })), done: (s, p) => Math.abs(s.chamber.targetTemp - p.celsius) < 1e-6,
    station: 'rackKnob', gesture: 'knob', narrate: p => `Setting the thermostat to ${p.celsius} degrees.`,
  },
  {
    id: 'vna_power', label: 'VNA power and RF', category: 'Instruments', description: 'Turn the VNA and its RF output on or off together.', params: { type: 'object', properties: onOff('the VNA and RF output'), required: ['on'], additionalProperties: false }, risk: 'safe',
    check: s => needPower(s) || ok, run: (c, p) => c.dispatch(patch('vna', { power: !!p.on, rf: !!p.on })), done: (s, p) => !!s.vna.power === !!p.on && !!s.vna.rf === !!p.on,
    station: 'rackKnob', gesture: 'knob', narrate: p => (p.on ? 'Powering up the VNA and enabling RF.' : 'Powering down the VNA.'),
  },
  {
    id: 'calibrate_vna', label: 'Calibrate the VNA', category: 'Instruments', description: 'Run the SOLT 1-port calibration. Valid for one hour or until the center or span changes.', params: none, risk: 'safe',
    check: s => needPower(s) || (s.vna.power ? ok : no('The VNA is off. Power it up first.')), run: c => c.dispatch({ type: 'CALIBRATE_VNA', calType: 'SOLT 1-Port' }), done: s => !!s.vna.calibrated,
    station: 'rackKnob', gesture: 'knob', narrate: () => 'Calibrating the VNA.',
  },
  {
    id: 'capture_reference', label: 'Capture VNA Reference Trace', category: 'Instruments', description: 'Store the current VNA trace as the reference trace.', params: none, risk: 'safe', palette: true,
    check: () => ok, run: c => c.dispatch({ type: 'CAPTURE_REFERENCE' }), done: () => true,
  },
  {
    id: 'capture_sweep', label: 'Capture Single VNA Sweep', category: 'Instruments', description: 'Take one VNA sweep.', params: none, risk: 'safe', palette: true,
    check: s => (s.vna.power ? ok : no('VNA must be powered on')), run: c => c.helpers?.performSweep?.(), done: s => !s.vna.sweeping,
  },
  {
    id: 'open_calibration_wizard', label: 'Open VNA Calibration Wizard', category: 'Instruments', description: 'Open the calibration wizard dialog.', params: none, risk: 'safe', palette: true,
    check: () => ok, run: c => c.dispatch({ type: 'SET_UI', patch: { calModalOpen: true } }), done: s => !!s.ui.calModalOpen,
  },
  {
    id: 'ldv_power', label: 'LDV power', category: 'Instruments', description: 'Turn the laser vibrometer on or off. Turning it off also closes the shutter.', params: { type: 'object', properties: onOff('the vibrometer'), required: ['on'], additionalProperties: false }, risk: 'safe',
    check: s => needPower(s) || ok, run: (c, p) => c.dispatch(patch('ldv', p.on ? { power: true } : { power: false, shutter: false })), done: (s, p) => !!s.ldv.power === !!p.on,
    station: 'rackKnob', gesture: 'knob', narrate: p => (p.on ? 'Powering on the vibrometer.' : 'Powering off the vibrometer.'),
  },
  {
    id: 'laser_shutter', label: 'Laser shutter', category: 'Instruments', description: 'Open or close the LDV laser shutter. Opening emits the laser, so everyone needs eye protection and the chamber door must be closed.',
    params: { type: 'object', properties: onOff('the shutter open (laser emitting)'), required: ['on'], additionalProperties: false }, risk: (s, p) => (p?.on ? 'confirm' : 'safe'),
    check: (s, p) => (p.on ? (s.ldv.power ? (s.chamber.doorOpen ? no('The chamber door is open. Close it before opening the laser shutter.') : ok) : no('The vibrometer is off. Power it on first.')) : ok),
    run: (c, p) => c.dispatch(patch('ldv', { shutter: !!p.on })), done: (s, p) => !!s.ldv.shutter === !!p.on,
    confirmText: () => 'Opening the shutter turns the laser on. Everyone in the lab needs eye protection.', station: 'laser', gesture: 'pointUp', narrate: p => (p.on ? 'Opening the laser shutter. Goggles on.' : 'Closing the laser shutter.'),
  },
  {
    id: 'home_stage', label: 'Home XYZ Stage (0,0,0)', category: 'Stage', description: 'Send the XYZ stage to its home position.', params: none, risk: 'safe', palette: true,
    check: s => stageBlocked(s) || ok, run: c => c.dispatch({ type: 'HOME_STAGE' }), done: s => stageIdle(s) && !!s.stage.homed && Math.abs(s.stage.x) + Math.abs(s.stage.y) + Math.abs(s.stage.z) < 1e-6, timeoutMs: 60000,
    station: 'stage', gesture: 'point', narrate: () => 'Homing the stage.',
  },
  {
    id: 'move_stage', label: 'Move the stage', category: 'Stage', description: `Move the sphere to X, Y, Z in millimetres (limit plus or minus ${LIMIT_MM}).`,
    params: { type: 'object', properties: { x: num('x', 'X in mm', -LIMIT_MM, LIMIT_MM), y: num('y', 'Y in mm', -LIMIT_MM, LIMIT_MM), z: num('z', 'Z in mm', -LIMIT_MM, LIMIT_MM) }, required: ['x', 'y', 'z'], additionalProperties: false }, risk: 'safe',
    check: s => stageBlocked(s) || ok, run: (c, p) => c.dispatch({ type: 'MOVE_STAGE', position: { x: p.x, y: p.y, z: p.z } }),
    done: (s, p) => stageIdle(s) && Math.abs(s.stage.x - p.x) < 1e-6 && Math.abs(s.stage.y - p.y) < 1e-6 && Math.abs(s.stage.z - p.z) < 1e-6, timeoutMs: 60000,
    station: 'stage', gesture: 'point', narrate: p => `Moving the stage to X ${p.x}, Y ${p.y}, Z ${p.z}.`,
  },
  {
    id: 'start_scan', label: 'Start a scan', category: 'Experiment', description: 'Start an automated scan. "axis" scans along the plan axis, "grid" runs the serpentine grid.',
    params: { type: 'object', properties: { kind: { type: 'string', description: 'Scan type', enum: ['axis', 'grid'] } }, required: ['kind'], additionalProperties: false }, risk: 'safe',
    check: s => needPower(s) || (!s.vna.power || !s.vna.rf ? no('The VNA must be on with RF enabled.') : s.stage.clampActive ? no('The stage clamp is engaged.') : s.chamber.doorOpen ? no('The chamber door is open.') : s.chamber.vent ? no('The chamber is venting.') : s.experiment.active || s.experiment.scanActive ? no('A run already owns the instruments.') : ok),
    run: (c, p) => c.dispatch(p.kind === 'axis' ? { type: 'START_SCAN', kind: 'axis' } : { type: 'START_SCAN' }), done: s => !!s.experiment.scanActive, timeoutMs: 10000,
    station: 'workstation', gesture: 'type', narrate: () => 'Starting the scan from the workstation.',
  },
  {
    id: 'wait_scan', label: 'Wait for the scan', category: 'Experiment', description: 'Wait until the running scan has finished. Does not change anything.', params: none, risk: 'safe',
    check: s => (s.experiment.scanActive ? ok : no('No scan is running.')), run: () => {}, done: s => !s.experiment.scanActive, timeoutMs: 1800000,
    station: 'workstation', gesture: 'type', narrate: () => 'Watching the scan progress.',
  },
  {
    id: 'pause_scan', label: 'Pause the scan', category: 'Experiment', description: 'Pause the running scan.', params: none, risk: 'safe',
    check: s => (s.experiment.scanActive && !s.experiment.scanPaused ? ok : no('No running scan to pause.')), run: c => c.dispatch({ type: 'PAUSE_SCAN' }), done: s => !!s.experiment.scanPaused,
    station: 'workstation', gesture: 'type', narrate: () => 'Pausing the scan.',
  },
  {
    id: 'resume_scan', label: 'Resume the scan', category: 'Experiment', description: 'Resume a paused scan.', params: none, risk: 'safe',
    check: s => (s.experiment.scanActive && s.experiment.scanPaused ? ok : no('No paused scan to resume.')), run: c => c.dispatch({ type: 'RESUME_SCAN' }), done: s => !s.experiment.scanPaused,
    station: 'workstation', gesture: 'type', narrate: () => 'Resuming the scan.',
  },
  {
    id: 'abort_scan', label: 'Stop the scan', category: 'Experiment', description: 'Abort the running scan. Partial data stays but the run ends.', params: none, risk: 'destructive',
    check: s => (s.experiment.scanActive ? ok : no('No scan is running.')), run: c => c.dispatch({ type: 'ABORT_SCAN' }), done: s => !s.experiment.scanActive,
    confirmText: () => 'Stopping the scan ends the run. Points not yet measured will be missing.', station: 'workstation', gesture: 'type', narrate: () => 'Stopping the scan.',
  },
  {
    id: 'start_run', label: 'Start Standard Experiment Run', category: 'Experiment', description: 'Start the standard experiment run.', params: none, risk: 'safe', palette: true,
    check: () => ok, run: c => c.dispatch({ type: 'START_RUN' }), done: s => !!s.experiment.active,
  },
  {
    id: 'stop_run', label: 'Stop Active Experiment Run', category: 'Experiment', description: 'Stop the active experiment run.', params: none, risk: 'confirm', palette: true,
    check: s => (s.experiment.active ? ok : no('No run is active.')), run: c => c.dispatch({ type: 'STOP_RUN' }), done: s => !s.experiment.active, confirmText: () => 'Stopping the run ends the current data set.',
  },
  {
    id: 'ack_alarms', label: 'Acknowledge All Alarms', category: 'System', description: 'Acknowledge every open alarm (they stay in the history).', params: none, risk: 'safe', palette: true,
    check: s => (s.alarms.some((a: any) => !a.acknowledged) ? ok : no('There are no open alarms.')), run: c => c.getState().alarms.forEach((a: any) => { if (!a.acknowledged) c.dispatch({ type: 'ACK_ALARM', id: a.id }); }),
    done: s => !s.alarms.some((a: any) => !a.acknowledged), station: 'workstation', gesture: 'type', narrate: () => 'Acknowledging the alarms.',
  },
  {
    id: 'clear_faults', label: 'Clear all simulated faults', category: 'System', description: 'Clear every injected fault and any fault drill.', params: none, risk: 'confirm',
    check: s => (Object.values(s.failures).some(Boolean) ? ok : no('No faults are active.')), run: c => c.dispatch({ type: 'CLEAR_FAILURES' }), done: s => !Object.values(s.failures).some(Boolean),
    confirmText: () => 'This clears the simulated faults, including a hidden fault drill.', station: 'workstation', gesture: 'type', narrate: () => 'Clearing the faults.',
  },
  {
    id: 'start_fault_drill', label: 'Start a blind fault drill', category: 'System', description: 'Inject one hidden fault so the operator can practise diagnosing it.', params: none, risk: 'confirm',
    check: () => ok, run: c => c.dispatch({ type: 'START_FAULT_DRILL' }), done: s => !!s.faultDrill?.hiddenKey, confirmText: () => 'This injects a hidden fault into the simulated lab.', station: 'workstation', gesture: 'type', narrate: () => 'Starting the fault drill.',
  },
  {
    id: 'export_csv', label: 'Export Experiment Run CSV', category: 'Data', description: 'Download the experiment data as CSV.', params: none, risk: 'safe', palette: true,
    check: () => ok, run: c => c.helpers?.exportCsv?.(), done: () => true, station: 'workstation', gesture: 'type', narrate: () => 'Exporting the data as CSV.',
  },
  {
    id: 'export_json', label: 'Export Experiment Run JSON', category: 'Data', description: 'Download the experiment data as JSON.', params: none, risk: 'safe', palette: true,
    check: () => ok, run: c => c.helpers?.exportJson?.(), done: () => true, station: 'workstation', gesture: 'type', narrate: () => 'Exporting the data as JSON.',
  },
  ...(['wizardOpen:Open Startup Wizard', 'manualOpen:Open Procedure Manual', 'glossaryOpen:Open Glossary of Terms', 'videoModal:Open Video Tutorial Laptop'] as const).map((spec): ActionDef => {
    const [key, label] = spec.split(':');
    return { id: `open_${key.replace(/(Open|Modal)$/, '').toLowerCase()}`, label, category: 'Help', description: `${label}.`, params: none, risk: 'safe', palette: true, check: () => ok, run: c => c.dispatch({ type: 'SET_UI', patch: { [key]: true } }), done: s => !!s.ui[key] };
  }),
];

export const ACTION_BY_ID: Record<string, ActionDef> = Object.fromEntries(ACTIONS.map(a => [a.id, a]));
export const riskOf = (a: ActionDef, s: State, p: any): Risk => (typeof a.risk === 'function' ? a.risk(s, p) : a.risk);

/** Minimal JSON-schema check for our flat parameter objects. Returns an error message or null. */
export function validateParams(a: ActionDef, p: any): string | null {
  const params = p == null ? {} : p;
  if (typeof params !== 'object' || Array.isArray(params)) return 'Parameters must be an object.';
  const props = a.params.properties;
  for (const k of Object.keys(params)) if (!(k in props)) return `Unknown parameter "${k}".`;
  for (const k of a.params.required || []) if (!(k in params)) return `Missing parameter "${k}".`;
  for (const [k, spec] of Object.entries(props)) {
    if (!(k in params)) continue; const v = params[k];
    if (spec.type === 'number') { if (typeof v !== 'number' || !isFinite(v)) return `"${k}" must be a number.`; if (spec.minimum !== undefined && v < spec.minimum) return `"${k}" must be at least ${spec.minimum}.`; if (spec.maximum !== undefined && v > spec.maximum) return `"${k}" must be at most ${spec.maximum}.`; }
    else if (spec.type === 'boolean') { if (typeof v !== 'boolean') return `"${k}" must be true or false.`; }
    else if (spec.type === 'string') { if (typeof v !== 'string') return `"${k}" must be text.`; if (spec.enum && !spec.enum.includes(v)) return `"${k}" must be one of ${spec.enum.join(', ')}.`; }
  }
  return null;
}

export type Evaluation =
  | { ok: true; risk: Risk; needsConfirm: boolean; confirmText?: string }
  | { ok: false; reason: string; code: 'unknown' | 'invalid' | 'blocked' };

/** Decides whether an action may run right now, using the real state. Never changes anything. */
export function evaluate(s: State, id: string, p: any = {}): Evaluation {
  const a = ACTION_BY_ID[id]; if (!a) return { ok: false, code: 'unknown', reason: `There is no action called "${id}".` };
  const bad = validateParams(a, p); if (bad) return { ok: false, code: 'invalid', reason: bad };
  const c = a.check(s, p || {}); if (c.ok === false) return { ok: false, code: 'blocked', reason: c.reason };
  const risk = riskOf(a, s, p || {});
  return { ok: true, risk, needsConfirm: risk !== 'safe', confirmText: a.confirmText?.(s, p || {}) };
}

export type ExecResult =
  | { status: 'started'; risk: Risk }
  | { status: 'needs-confirmation'; risk: Risk; text: string }
  | { status: 'blocked' | 'invalid' | 'unknown'; reason: string };

/** Runs an action through the app's reducer. Risky actions return `needs-confirmation` unless `confirmed` is true. */
export function execute(c: Ctx, id: string, p: any = {}, opts: { confirmed?: boolean } = {}): ExecResult {
  const s = c.getState(); const e = evaluate(s, id, p);
  if (e.ok === false) return { status: e.code, reason: e.reason };
  if (e.needsConfirm && !opts.confirmed) return { status: 'needs-confirmation', risk: e.risk, text: e.confirmText || 'This action needs your confirmation.' };
  ACTION_BY_ID[id].run(c, p || {});
  return { status: 'started', risk: e.risk };
}

export function isDone(s: State, id: string, p: any = {}): boolean { const a = ACTION_BY_ID[id]; return !!a && a.done(s, p || {}); }

export type Clock = { now: () => number; sleep: (ms: number) => Promise<void> };
export const realClock: Clock = { now: () => Date.now(), sleep: ms => new Promise(r => setTimeout(r, ms)) };

/** Waits until real state shows the action's effect. Resolves 'done', 'timeout' or 'cancelled'. */
export async function waitFor(getState: () => State, id: string, p: any, o: { timeoutMs?: number; pollMs?: number; clock?: Clock; cancelled?: () => boolean } = {}): Promise<'done' | 'timeout' | 'cancelled'> {
  const a = ACTION_BY_ID[id]; const clock = o.clock || realClock; const limit = o.timeoutMs ?? a?.timeoutMs ?? 30000; const poll = o.pollMs ?? 250; const t0 = clock.now();
  for (;;) {
    if (o.cancelled?.()) return 'cancelled';
    if (isDone(getState(), id, p)) return 'done';
    if (clock.now() - t0 >= limit) return 'timeout';
    await clock.sleep(poll);
  }
}

/** Actions that are for the human UI only (dialogs, downloads, toggles) and are not offered as AI tools. */
const NOT_TOOLS = new Set(['toggle_faraday', 'toggle_isolation', 'capture_sweep', 'capture_reference', 'open_calibration_wizard', 'start_run', 'stop_run', 'export_csv', 'export_json']);

/** Tool definitions in the Anthropic tool-use format, generated from the registry. */
export function toolDefinitions() {
  return ACTIONS.filter(a => !NOT_TOOLS.has(a.id) && !a.id.startsWith('open_wizard') && !a.id.startsWith('open_manual') && !a.id.startsWith('open_glossary') && !a.id.startsWith('open_video'))
    .map(a => ({ name: a.id, description: `${a.description} Risk: ${typeof a.risk === 'function' ? 'depends on state, may need confirmation' : a.risk}.`, input_schema: a.params }));
}

/** Entries for the command palette: disabled with a reason when preconditions fail. */
export function paletteEntries(s: State) {
  return ACTIONS.filter(a => a.palette && !(a.params.required && a.params.required.length)).map(a => {
    const ev = evaluate(s, a.id, {});
    return { id: a.id, label: a.label, category: a.category, disabled: ev.ok === false, reason: ev.ok === false ? ev.reason : undefined };
  });
}

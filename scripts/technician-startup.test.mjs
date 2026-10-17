import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';
const T = await loadTypeScript(new URL('../src/technician/taskRunner.ts', import.meta.url));
const I = await loadTypeScript(new URL('../src/technician/intents.ts', import.meta.url));

// ── spoken or typed phrases map to the right task or registry action
const t = (s, id, params) => { const r = I.parseCommand(s, { stage: { x: 0, y: 0, z: 0 } }); assert.equal(r?.type, 'task', s); assert.equal(r.id, id, s); if (params) assert.deepEqual(r.params, params, s); };
t('run startup sequence', 'startup_sequence'); t('please start up the lab', 'startup_sequence'); t('bring everything online', 'startup_sequence'); t('turn everything on', 'startup_sequence');
t('run the shutdown sequence', 'shutdown_sequence'); t('power down the lab', 'shutdown_sequence');
t('turn on the vna', 'action', { action: 'vna_power', params: { on: true } }); t('turn off the vibrometer', 'action', { action: 'ldv_power', params: { on: false } });
t('close the laser shutter', 'action', { action: 'laser_shutter', params: { on: false } }); t('open the shutter', 'action', { action: 'laser_shutter', params: { on: true } });
t('start the turbo pump', 'action', { action: 'start_turbo', params: {} }); t('stop the turbo', 'action', { action: 'stop_turbo', params: {} });
t('close the main breaker', 'action', { action: 'power_on', params: {} }); t('power on the rubidium clock', 'action', { action: 'clock_power', params: { on: true } });
t('set the chamber temperature to 22', 'action', { action: 'set_temperature', params: { celsius: 22 } }); t('go to the vna page', 'action', { action: 'go_vna', params: {} });
t('turn off the faraday cage', 'action', { action: 'set_faraday', params: { on: false } }); t('vent the chamber', 'action', { action: 'vent_chamber', params: {} });
t('calibrate the vna', 'calibrate_vna'); t('open the chamber door', 'open_door');
assert.equal(I.parseCommand('what does the shutter do'), null); assert.equal(I.parseCommand('how do I start up the lab'), null);
console.log('PASS spoken commands map to tasks and registry actions');

// ── the startup sequence on a cold lab visits each device in order
const cold = () => ({ facility: { power: false }, clock: { power: false, locked: false, warmup: 0 },
  chamber: { pressure: 760, vent: true, roughing: false, turbo: false, doorOpen: true, faraday: false, isolation: false, targetTemp: 20 },
  stage: { x: 0, y: 0, z: 0, moving: false, settling: false, homed: true, clampActive: false }, vna: { power: false, rf: false, calibrated: false }, ldv: { power: false, shutter: false },
  experiment: {}, failures: {}, alarms: [], faultDrill: {}, ui: { active: 'dashboard' } });
let s = cold(), tm = 0; const order = [], visited = [], spoken = [];
const dispatch = a => { if (a.type === 'PATCH') { s = { ...s, [a.domain]: { ...s[a.domain], ...a.patch } }; order.push(`${a.domain}:${Object.keys(a.patch).join(',')}`); } else if (a.type === 'POWER') { s = { ...s, facility: { power: a.value } }; order.push('breaker'); } else if (a.type === 'CALIBRATE_VNA') { s = { ...s, vna: { ...s.vna, calibrated: true } }; order.push('calibrate'); } };
const clock = { now: () => tm, sleep: async ms => { tm += ms; const c = s.chamber, dt = ms / 1000;
  if (c.roughing && !c.vent && !c.doorOpen) s = { ...s, chamber: { ...c, pressure: Math.max(1e-6, c.turbo ? c.pressure * Math.exp(-dt * 1.2) : Math.max(40, c.pressure * Math.exp(-dt * 0.35))) } };
  if (s.clock.power) { const w = Math.min(15, s.clock.warmup + dt); s = { ...s, clock: { ...s.clock, warmup: w, locked: w >= 15 } }; } await Promise.resolve(); } };
const actor = { goTo: async st => { visited.push(st); await clock.sleep(400); return true; }, cancel() {}, lock() {}, say: x => spoken.push(x) };
const runner = T.createTaskRunner({ ctx: { getState: () => s, dispatch, helpers: {} }, actor, clock, confirm: async () => true, log: () => {} });
const r = runner.enqueue('startup_sequence'); assert.ok(r.ok);
for (let i = 0; i < 20000 && !['done', 'blocked', 'failed', 'cancelled'].includes(r.task.status); i++) await clock.sleep(250);
assert.equal(r.task.status, 'done', r.task.reason);
assert.ok(s.facility.power && s.clock.locked && s.vna.power && s.vna.rf && s.ldv.power && s.chamber.faraday && s.chamber.isolation && !s.chamber.doorOpen && s.chamber.roughing && s.chamber.turbo && s.vna.calibrated);
assert.equal(s.ldv.shutter, false, 'startup must never open the laser shutter');
assert.ok(order.indexOf('breaker') === 0 && order.indexOf('calibrate') === order.length - 1);
assert.ok(visited.includes('rackKnob') && visited.includes('gauge') && visited.includes('doorSeal'));
console.log('PASS startup sequence powers and calibrates every device in order and leaves the laser closed');

// ── an already-running lab says so instead of repeating work
const again = runner.enqueue('startup_sequence'); assert.equal(again.ok, false); assert.match(again.reason, /already/i);
console.log('PASS startup on a running lab is a no-op with an explanation');

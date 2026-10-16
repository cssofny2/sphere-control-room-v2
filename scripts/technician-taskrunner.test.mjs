import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

const T = await loadTypeScript(new URL('../src/technician/taskRunner.ts', import.meta.url));
const A = await loadTypeScript(new URL('../src/technician/actions.ts', import.meta.url));

const mkState = () => ({
  facility: { power: true }, clock: { power: true, locked: true },
  chamber: { pressure: 760, vent: true, roughing: false, turbo: false, doorOpen: false, faraday: true, isolation: true, targetTemp: 20, temperature: 20 },
  stage: { x: 0, y: 0, z: 0, moving: false, settling: false, homed: true, clampActive: false }, vna: { power: true, rf: true, calibrated: false, sweeping: false },
  ldv: { power: true, shutter: false }, experiment: { active: false, scanActive: false, scanPaused: false }, failures: {}, alarms: [], faultDrill: {}, ui: { active: 'dashboard' },
});

// A tiny stand-in for the reducer + physics, driven by the fake clock.
function lab() {
  let s = mkState(); const calls = [];
  const dispatch = a => {
    calls.push(a);
    if (a.type === 'PATCH') s = { ...s, [a.domain]: { ...s[a.domain], ...a.patch } };
    else if (a.type === 'POWER') s = { ...s, facility: { power: a.value } };
    else if (a.type === 'MOVE_STAGE') s = { ...s, stage: { ...s.stage, ...a.position, moving: true } };
    else if (a.type === 'HOME_STAGE') s = { ...s, stage: { ...s.stage, x: 0, y: 0, z: 0, homed: false, moving: true } };
    else if (a.type === 'CALIBRATE_VNA') s = { ...s, vna: { ...s.vna, calibrated: true } };
    else if (a.type === 'START_SCAN') s = { ...s, experiment: { ...s.experiment, scanActive: true, active: true } };
    else if (a.type === 'ABORT_SCAN') s = { ...s, experiment: { ...s.experiment, scanActive: false, active: false } };
    else if (a.type === 'PAUSE_SCAN') s = { ...s, experiment: { ...s.experiment, scanPaused: true } };
    else if (a.type === 'ACK_ALARM') s = { ...s, alarms: s.alarms.map(x => ({ ...x, acknowledged: true })) };
    else if (a.type === 'CLEAR_FAILURES') s = { ...s, failures: {} };
  };
  let t = 0;
  const clock = { now: () => t, sleep: async ms => { t += ms; step(ms); await Promise.resolve(); } };
  let stall = false; const step = ms => { if (stall) return; // physics: pumps lower the pressure, stage settles
    const c = s.chamber, dt = ms / 1000;
    if (c.roughing && !c.vent && !c.doorOpen) { let p = c.pressure; p = c.turbo ? p * Math.exp(-dt * 1.2) : Math.max(40, p * Math.exp(-dt * 0.35)); s = { ...s, chamber: { ...c, pressure: Math.max(p, 1e-6) } }; }
    if (s.stage.moving) s = { ...s, stage: { ...s.stage, moving: false, homed: true } };
  };
  return { get s() { return s; }, set s(v) { s = v; }, calls, clock, ctx: { getState: () => s, dispatch, helpers: {} }, get t() { return t; }, stall(v) { stall = v; } };
}
function setup(over = {}) {
  const L = lab(); const spoken = [], logged = [], visited = []; let locked = false;
  const actor = { goTo: async st => { visited.push(st); await L.clock.sleep(500); return true; }, cancel: () => { visited.push('CANCEL'); }, lock: on => { locked = on; }, say: x => spoken.push(x) };
  const asked = [];
  const runner = T.createTaskRunner({ ctx: L.ctx, actor, clock: L.clock, confirm: async (text, risk) => { asked.push({ text, risk }); return over.confirm ?? true; }, log: (t, why) => logged.push({ t, why }) });
  return { L, runner, spoken, logged, visited, asked, get locked() { return locked; } };
}
const settle = async (X, task, ms = 3600000) => X.runner.waitSettled(task, ms);
const waitDone = async (X, task) => { for (let i = 0; i < 4000 && !['done', 'blocked', 'failed', 'cancelled'].includes(task.status); i++) await X.L.clock.sleep(250); return task.status; };

// pump down: close door, roughing, wait 50, turbo, wait deep vacuum, walking to the gauge
{ const X = setup(); X.L.s = { ...X.L.s, chamber: { ...X.L.s.chamber, doorOpen: true } };
  const r = X.runner.enqueue('pump_down'); assert.ok(r.ok); const status = await waitDone(X, r.task);
  assert.equal(status, 'done', r.task.reason); assert.ok(X.L.s.chamber.pressure < 1e-3 && X.L.s.chamber.turbo && !X.L.s.chamber.doorOpen);
  assert.ok(X.visited.includes('gauge') && X.visited.includes('doorSeal')); assert.ok(X.logged.some(l => /roughing/i.test(l.t)));
  assert.equal(X.locked, false); console.log('PASS pump-down task closes the door, pumps, starts the turbo and waits for real pressure'); }

// a blocked step stops the task and is explained
{ const X = setup(); X.L.s = { ...X.L.s, stage: { ...X.L.s.stage, clampActive: true } };
  const r = X.runner.enqueue('home_stage'); assert.equal(await waitDone(X, r.task), 'blocked'); assert.match(r.task.reason, /clamp/i);
  assert.ok(X.spoken.some(t => /can't do that.*clamp/i.test(t))); assert.ok(X.logged.some(l => /interlock/.test(l.why))); console.log('PASS a blocked step stops the task and is explained'); }

// risky step asks for confirmation; no means it does not happen
{ const X = setup({ confirm: false }); X.L.s = { ...X.L.s, experiment: { active: true, scanActive: true, scanPaused: false } };
  const r = X.runner.enqueue('stop_scan'); assert.equal(await waitDone(X, r.task), 'cancelled'); assert.equal(X.asked.length, 1); assert.equal(X.asked[0].risk, 'destructive'); assert.equal(X.L.s.experiment.scanActive, true);
  const Y = setup({ confirm: true }); Y.L.s = { ...Y.L.s, experiment: { active: true, scanActive: true, scanPaused: false } }; const r2 = Y.runner.enqueue('stop_scan'); assert.equal(await waitDone(Y, r2.task), 'done'); assert.equal(Y.L.s.experiment.scanActive, false);
  console.log('PASS risky tasks wait for confirmation and respect a "no"'); }

// open door closes the laser shutter first, then asks if under vacuum
{ const X = setup(); X.L.s = { ...X.L.s, ldv: { power: true, shutter: true } };
  const r = X.runner.enqueue('open_door'); assert.equal(await waitDone(X, r.task), 'done'); assert.equal(X.L.s.ldv.shutter, false); assert.equal(X.L.s.chamber.doorOpen, true);
  const order = X.L.calls.map(c => c.patch && Object.keys(c.patch)[0]); assert.deepEqual(order.slice(0, 2), ['shutter', 'doorOpen']); console.log('PASS open-door closes the shutter before opening the door'); }

// queue runs tasks in order; cancel stops the current one and the next still runs
{ const X = setup(); X.L.s = { ...X.L.s, chamber: { ...X.L.s.chamber, vent: false } }; const a = X.runner.enqueue('move_stage', { x: 5, y: 0, z: 0 }), b = X.runner.enqueue('calibrate_vna'); assert.ok(a.ok && b.ok);
  assert.equal(await waitDone(X, a.task), 'done'); assert.equal(await waitDone(X, b.task), 'done'); assert.equal(X.L.s.stage.x, 5); assert.ok(X.L.s.vna.calibrated);
  const X2 = setup(); X2.L.s = { ...X2.L.s, chamber: { ...X2.L.s.chamber, vent: false, roughing: true, pressure: 700 } };
  const p = X2.runner.enqueue('pump_down'); const c = X2.runner.enqueue('calibrate_vna'); await X2.L.clock.sleep(1500); assert.equal(p.task.status, 'running');
  X2.runner.cancel(); assert.equal(p.task.status, 'cancelled'); assert.equal(await waitDone(X2, c.task), 'done'); console.log('PASS queue order, cancel current task, next task still runs'); }

// emergency stop: everything cancelled, laser shutter closed, scan paused
{ const X = setup(); X.L.s = { ...X.L.s, ldv: { power: true, shutter: true }, experiment: { active: true, scanActive: true, scanPaused: false }, chamber: { ...X.L.s.chamber, vent: false, roughing: true, pressure: 700 } };
  const p = X.runner.enqueue('pump_down'), q = X.runner.enqueue('home_stage'); await X.L.clock.sleep(800);
  X.runner.emergencyStop(); assert.equal(p.task.status, 'cancelled'); assert.equal(q.task.status, 'cancelled'); assert.equal(X.L.s.ldv.shutter, false); assert.equal(X.L.s.experiment.scanPaused, true);
  assert.equal(X.runner.queue.length, 0); assert.ok(X.visited.includes('CANCEL')); const after = X.runner.enqueue('calibrate_vna'); assert.equal(await waitDone(X, after.task), 'done'); console.log('PASS emergency stop halts all, makes the lab safe, and the runner works again after'); }

// timeouts are reported, not hidden; bad parameters are rejected
{ const X = setup(); X.L.stall(true); const r = X.runner.enqueue('pump_down'); assert.equal(await waitDone(X, r.task), 'failed'); assert.match(r.task.reason, /Timed out/); assert.ok(X.spoken.some(t => /taking too long/.test(t)));
  const bad = X.runner.enqueue('move_stage', { x: 1, y: 1 }); assert.equal(bad.ok, false); assert.match(bad.reason, /X, Y and Z/); console.log('PASS timeouts are reported and bad parameters are rejected'); }
{ const X = setup(); const t = X.runner.enqueue('nope'); assert.equal(t.ok, false); assert.match(t.reason, /don't know/); console.log('PASS unknown task is rejected'); }

// fix_alarm applies the known fix and acknowledges
{ const X = setup(); X.L.s = { ...X.L.s, chamber: { ...X.L.s.chamber, faraday: false }, alarms: [{ id: 1, text: 'RF shielding disabled: VNA data may be corrupted.', severity: 'warning', acknowledged: false }] };
  const r = X.runner.enqueue('fix_alarm'); assert.equal(await waitDone(X, r.task), 'done'); assert.equal(X.L.s.chamber.faraday, true); assert.ok(X.L.s.alarms.every(a => a.acknowledged)); assert.ok(X.spoken.some(t => /Faraday cage/.test(t))); console.log('PASS fix-alarm repairs shielding and acknowledges'); }

// tool list for the model
{ const tools = T.runnerTools(A.toolDefinitions()); assert.ok(tools.some(t => t.name === 'run_task') && tools.some(t => t.name === 'cancel_task')); const rt = tools.find(t => t.name === 'run_task'); assert.ok(rt.input_schema.properties.task.enum.includes('pump_down')); console.log(`PASS ${tools.length} tools offered to the model, including run_task`); }

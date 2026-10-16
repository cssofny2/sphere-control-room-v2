import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

const R = await loadTypeScript(new URL('../src/technician/actions.ts', import.meta.url));
const mkState = (o = {}) => structuredClone({
  facility: { power: true, simulationTime: 0 }, clock: { power: true, locked: true },
  chamber: { pressure: 760, temperature: 20, targetTemp: 20, vent: true, roughing: false, turbo: false, doorOpen: false, faraday: true, isolation: true },
  stage: { x: 0, y: 0, z: 0, moving: false, settling: false, homed: true, clampActive: false }, vna: { power: true, rf: true, calibrated: true, sweeping: false },
  ldv: { power: true, shutter: false }, experiment: { active: false, scanActive: false, scanPaused: false }, failures: {}, alarms: [], faultDrill: {}, ui: { active: 'dashboard' }, ...o,
});
const merge = (b, o) => { for (const k of Object.keys(o)) b[k] = typeof o[k] === 'object' && !Array.isArray(o[k]) ? { ...b[k], ...o[k] } : o[k]; return b; };
const S = o => merge(mkState(), o || {});
const run = (s, id, p, opts) => { const calls = []; const r = R.execute({ getState: () => s, dispatch: a => calls.push(a), helpers: {} }, id, p, opts); return { r, calls }; };

// registry shape
for (const a of R.ACTIONS) {
  assert.ok(a.id && a.label && a.description, a.id); assert.equal(a.params.type, 'object'); assert.equal(a.params.additionalProperties, false);
  assert.ok(['safe', 'confirm', 'destructive'].includes(typeof a.risk === 'function' ? a.risk(S(), {}) : a.risk), a.id);
  assert.equal(typeof a.check, 'function'); assert.equal(typeof a.done, 'function'); assert.equal(typeof a.run, 'function');
}
assert.equal(new Set(R.ACTIONS.map(a => a.id)).size, R.ACTIONS.length); console.log(`PASS registry has ${R.ACTIONS.length} unique, well-formed actions`);

// interlocks
{ let s = S({ chamber: { doorOpen: true } }); let { r, calls } = run(s, 'move_stage', { x: 1, y: 0, z: 0 }); assert.equal(r.status, 'blocked'); assert.match(r.reason, /door/i); assert.equal(calls.length, 0);
  s = S({ facility: { power: false } }); ({ r } = run(s, 'home_stage')); assert.equal(r.status, 'blocked'); assert.match(r.reason, /breaker/i);
  s = S({ stage: { clampActive: true } }); ({ r } = run(s, 'move_stage', { x: 1, y: 1, z: 1 })); assert.match(r.reason, /clamp/i);
  s = S(); ({ r } = run(s, 'move_stage', { x: 1, y: 1, z: 1 })); assert.match(r.reason, /venting/i, 'vent cycle blocks stage moves');
  console.log('PASS stage interlocks: door, power, clamp, vent'); }
{ let s = S({ chamber: { pressure: 300, vent: false, roughing: true } }); let { r, calls } = run(s, 'start_turbo'); assert.equal(r.status, 'blocked'); assert.match(r.reason, /50 Torr/); assert.equal(calls.length, 0);
  s = S({ chamber: { pressure: 20, vent: false, roughing: true } }); ({ r, calls } = run(s, 'start_turbo')); assert.equal(r.status, 'started'); assert.deepEqual(calls[0], { type: 'PATCH', domain: 'chamber', patch: { vent: false, roughing: true, turbo: true } });
  s = S({ chamber: { doorOpen: true } }); ({ r } = run(s, 'start_roughing')); assert.match(r.reason, /door/i);
  console.log('PASS turbo needs pressure below 50 Torr; pumps need a closed door'); }
{ let s = S({ ldv: { power: true, shutter: true } }); let { r } = run(s, 'open_door'); assert.equal(r.status, 'blocked'); assert.match(r.reason, /shutter/i);
  s = S({ chamber: { doorOpen: true } }); ({ r } = run(s, 'laser_shutter', { on: true })); assert.equal(r.status, 'blocked');
  s = S(); ({ r } = run(s, 'laser_shutter', { on: true })); assert.equal(r.status, 'needs-confirmation'); assert.match(r.text, /eye protection/i);
  console.log('PASS laser safety interlocks'); }
{ let s = S({ vna: { power: false, rf: false } }); let { r } = run(s, 'start_scan', { kind: 'grid' }); assert.equal(r.status, 'blocked'); assert.match(r.reason, /VNA/);
  s = S({ chamber: { vent: false }, experiment: { scanActive: true } }); ({ r } = run(s, 'start_scan', { kind: 'axis' })); assert.match(r.reason, /already owns/);
  s = S({ chamber: { vent: false } }); ({ r } = run(s, 'start_scan', { kind: 'axis' })); assert.equal(r.status, 'started');
  console.log('PASS scan preconditions'); }

// risk levels need confirmation, and run only when confirmed
{ const s = S({ chamber: { pressure: 1e-5, vent: false, turbo: true, roughing: true } });
  let { r, calls } = run(s, 'vent_chamber'); assert.equal(r.status, 'needs-confirmation'); assert.equal(r.risk, 'destructive'); assert.equal(calls.length, 0);
  ({ r, calls } = run(s, 'vent_chamber', {}, { confirmed: true })); assert.equal(r.status, 'started'); assert.equal(calls.length, 1);
  ({ r } = run(S(), 'power_off')); assert.equal(r.status, 'needs-confirmation'); assert.equal(r.risk, 'destructive');
  ({ r } = run(S({ experiment: { scanActive: true } }), 'abort_scan')); assert.equal(r.status, 'needs-confirmation');
  ({ r } = run(S({ chamber: { pressure: 100, vent: false } }), 'open_door')); assert.equal(r.status, 'needs-confirmation'); assert.match(r.text, /blowout/);
  ({ r } = run(S(), 'set_faraday', { on: false })); assert.equal(r.status, 'needs-confirmation'); ({ r } = run(S(), 'set_faraday', { on: true })); assert.equal(r.status, 'started');
  console.log('PASS risky actions need explicit confirmation'); }

// schema validation
{ const s = S(); for (const [id, p, re] of [['move_stage', { x: 99, y: 0, z: 0 }, /at most 35/], ['move_stage', { x: 1, y: 0 }, /Missing/], ['move_stage', { x: 'a', y: 0, z: 0 }, /number/], ['move_stage', { x: 1, y: 0, z: 0, w: 5 }, /Unknown/], ['start_scan', { kind: 'zig' }, /one of/], ['set_temperature', { celsius: 99 }, /at most/], ['nope', {}, /no action/]]) {
    const e = R.evaluate(s, id, p); assert.equal(e.ok, false, id); assert.match(e.reason, re, `${id}: ${e.reason}`); }
  console.log('PASS parameters are validated against the schema'); }

// done predicates read real state
{ const s = S({ stage: { x: 5, y: 0, z: 0, moving: true } }); assert.equal(R.isDone(s, 'move_stage', { x: 5, y: 0, z: 0 }), false); s.stage.moving = false; assert.equal(R.isDone(s, 'move_stage', { x: 5, y: 0, z: 0 }), true);
  assert.equal(R.isDone(S({ chamber: { pressure: 1e-4 } }), 'wait_pressure', { below_torr: 1e-3 }), true); assert.equal(R.isDone(S(), 'wait_pressure', { below_torr: 1e-3 }), false);
  console.log('PASS done predicates come from state'); }

// waitFor with a fake clock
{ let t = 0; const clock = { now: () => t, sleep: async ms => { t += ms; } }; const s = S({ chamber: { pressure: 100, roughing: true, vent: false } });
  const res = await R.waitFor(() => s, 'wait_pressure', { below_torr: 1e-3 }, { timeoutMs: 5000, pollMs: 500, clock }); assert.equal(res, 'timeout'); assert.ok(t >= 5000);
  let n = 0; const clock2 = { now: () => t, sleep: async ms => { t += ms; if (++n === 3) s.chamber.pressure = 1e-5; } }; assert.equal(await R.waitFor(() => s, 'wait_pressure', { below_torr: 1e-3 }, { timeoutMs: 60000, pollMs: 100, clock: clock2 }), 'done');
  assert.equal(await R.waitFor(() => s, 'wait_pressure', { below_torr: 1e-9 }, { clock, cancelled: () => true }), 'cancelled'); console.log('PASS waitFor: done, timeout and cancel with a fake clock'); }

// tool definitions and palette
{ const tools = R.toolDefinitions(); assert.ok(tools.length > 20); for (const t of tools) { assert.ok(/^[a-z_0-9]+$/.test(t.name) && t.description && t.input_schema.type === 'object', t.name); }
  assert.ok(tools.some(t => t.name === 'move_stage') && !tools.some(t => t.name === 'export_csv'));
  const pal = R.paletteEntries(S({ vna: { power: false } })); assert.ok(pal.find(e => e.id === 'capture_sweep').disabled); assert.ok(!pal.some(e => e.id === 'move_stage'));
  assert.ok(pal.find(e => e.id === 'start_turbo').disabled && /50 Torr/.test(pal.find(e => e.id === 'start_turbo').reason)); console.log(`PASS ${tools.length} AI tool definitions and palette entries come from the registry`); }

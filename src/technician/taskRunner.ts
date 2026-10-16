// Dr. Wire's task runner. A task is a list of steps. For each step he walks to a station, does a
// gesture, says what he is doing, runs a registry action (which enforces the interlocks), then waits
// until the real state shows the effect. Nothing here knows about three.js or React: the scientist,
// the clock and the confirmation prompt are all passed in, so the whole thing runs under test.
import { ACTION_BY_ID, evaluate, execute, riskOf, waitFor, type Clock, type Ctx, type Risk, type Station, realClock } from './actions';

export type Step = { label: string; narration?: string; action: string; params?: Record<string, unknown>; station?: Station; timeoutMs?: number };
export type TaskStatus = 'queued' | 'running' | 'awaiting-confirm' | 'done' | 'blocked' | 'failed' | 'cancelled';
export type Task = { id: number; def: string; title: string; params: Record<string, unknown>; steps: Step[]; index: number; status: TaskStatus; reason?: string };

export type Actor = {
  goTo(station: Station): Promise<boolean>;
  cancel(): void;
  lock(on: boolean): void;
  say(text: string): void;
};
export type RunnerDeps = {
  ctx: Ctx;
  actor: Actor;
  confirm: (text: string, risk: Risk, taskTitle: string) => Promise<boolean>;
  log: (text: string, why: string) => void;
  clock?: Clock;
  onChange?: (t: Task | null, queue: Task[]) => void;
};

type Params = Record<string, any>;
export type TaskDef = {
  id: string; title: string; description: string;
  build: (s: any, p: Params) => Step[] | { error: string };
};

const S = (label: string, action: string, params?: Params, o: Partial<Step> = {}): Step => ({ label, action, params, ...o });
const a = (id: string) => ACTION_BY_ID[id];
const step = (id: string, params?: Params, label?: string, narration?: string): Step => ({ label: label || a(id).label, action: id, params, station: a(id).station, narration: narration ?? a(id).narrate?.(params || {}) });

/** What fixes a given alarm. Returns steps, or an explanation when only the operator can fix it. */
function alarmFix(s: any): { steps: Step[]; explain: string } {
  const open = (s.alarms || []).filter((x: any) => !x.acknowledged); const al = open[0];
  if (!al) return { steps: [], explain: 'There are no open alarms.' };
  const t = String(al.text);
  const steps: Step[] = [];
  let explain = `The alarm says: ${t}`;
  if (/turbo pump protection/i.test(t)) { if (s.chamber.turbo) steps.push(step('stop_turbo')); explain += ' I will stop the turbo. Run the roughing pump until pressure is under 50 Torr before restarting it.'; }
  else if (/shielding disabled/i.test(t)) { if (!s.chamber.faraday) steps.push(step('set_faraday', { on: true })); explain += ' I am switching the Faraday cage back on.'; }
  else if (/isolation disabled/i.test(t)) { if (!s.chamber.isolation) steps.push(step('set_isolation', { on: true })); explain += ' I am switching vibration isolation back on.'; }
  else if (/calibration invalidated/i.test(t)) { if (s.vna.power) steps.push(step('calibrate_vna')); explain += ' I am recalibrating the VNA.'; }
  else if (/fault simulator/i.test(t)) { if (Object.values(s.failures).some(Boolean)) steps.push(step('clear_faults')); explain += ' It comes from the fault simulator, so clearing the fault is the fix.'; }
  else explain += ' That one needs a person to decide, so I will only acknowledge it once you have looked at it.';
  return { steps, explain };
}

export const TASKS: TaskDef[] = [
  { id: 'pump_down', title: 'Pump down to deep vacuum', description: 'Close the door, run the roughing pump to under 50 Torr, start the turbo and wait for pressure below 1e-3 Torr.',
    build: s => {
      const st: Step[] = [];
      if (!s.facility.power) st.push(step('power_on'));
      if (s.chamber.doorOpen) st.push(step('close_door'));
      if (!s.chamber.roughing || s.chamber.vent) st.push(step('start_roughing'));
      if (s.chamber.pressure >= 50) st.push({ ...step('wait_pressure', { below_torr: 50 }, 'Wait for 50 Torr', 'Roughing down to 50 Torr. I will watch the gauge.'), timeoutMs: 900000 });
      if (!s.chamber.turbo) st.push(step('start_turbo'));
      st.push({ ...step('wait_pressure', { below_torr: 1e-3 }, 'Wait for deep vacuum', 'Turbo is running. Waiting for deep vacuum, below 1e-3 Torr.'), timeoutMs: 900000 });
      return st;
    } },
  { id: 'calibrate_vna', title: 'Calibrate the VNA', description: 'Power the VNA and RF if needed, then run the calibration.',
    build: s => { const st: Step[] = []; if (!s.facility.power) st.push(step('power_on')); if (!s.vna.power || !s.vna.rf) st.push(step('vna_power', { on: true })); st.push(step('calibrate_vna')); return st; } },
  { id: 'home_stage', title: 'Home the stage', description: 'Send the XYZ stage to 0, 0, 0.', build: () => [step('home_stage')] },
  { id: 'move_stage', title: 'Move the stage', description: 'Move the sphere to the given X, Y, Z in millimetres.',
    build: (s, p) => (['x', 'y', 'z'].every(k => typeof p[k] === 'number') ? [step('move_stage', { x: p.x, y: p.y, z: p.z })] : { error: 'I need X, Y and Z in millimetres.' }) },
  { id: 'open_door', title: 'Open the chamber door', description: 'Close the laser shutter if needed, then open the door.',
    build: s => { const st: Step[] = []; if (s.ldv.shutter) st.push(step('laser_shutter', { on: false })); st.push(step('open_door')); return st; } },
  { id: 'close_door', title: 'Close the chamber door', description: 'Close the chamber door.', build: () => [step('close_door')] },
  { id: 'start_scan', title: 'Start a scan', description: 'Start an automated scan (kind: axis or grid).', build: (s, p) => [step('start_scan', { kind: p.kind === 'axis' ? 'axis' : 'grid' })] },
  { id: 'pause_scan', title: 'Pause the scan', description: 'Pause the running scan.', build: () => [step('pause_scan')] },
  { id: 'stop_scan', title: 'Stop the scan', description: 'Abort the running scan (needs confirmation).', build: () => [step('abort_scan')] },
  { id: 'ack_alarms', title: 'Acknowledge alarms', description: 'Acknowledge every open alarm.', build: () => [step('ack_alarms')] },
  { id: 'fault_drill', title: 'Run a fault drill', description: 'Start a blind fault drill (needs confirmation).', build: () => [step('start_fault_drill')] },
  { id: 'export_data', title: 'Export the data', description: 'Download the experiment data (format: csv or json).', build: (s, p) => [step(p.format === 'json' ? 'export_json' : 'export_csv')] },
  { id: 'explain_alarm', title: 'Look at the current alarm', description: 'Go to the workstation and explain the current alarm. Changes nothing.',
    build: s => { const f = alarmFix(s); return [{ label: 'Read the alarm', action: 'look', station: 'workstation', narration: f.explain }]; } },
  { id: 'fix_alarm', title: 'Fix the current alarm', description: 'Apply the known fix for the first open alarm, then acknowledge it.',
    build: s => {
      const f = alarmFix(s); if (!f.steps.length && !(s.alarms || []).some((x: any) => !x.acknowledged)) return { error: f.explain };
      const st: Step[] = [{ label: 'Read the alarm', action: 'look', station: 'workstation', narration: f.explain }, ...f.steps];
      if (f.steps.length) st.push(step('ack_alarms'));
      return st;
    } },
];
export const TASK_BY_ID: Record<string, TaskDef> = Object.fromEntries(TASKS.map(t => [t.id, t]));

/** Holds the yes/no question for a risky step so the call bar, the task chip and the operator's voice can all answer it. */
export function createConfirmBroker() {
  let pending: { text: string; risk: Risk; title: string; resolve: (yes: boolean) => void } | null = null;
  const subs = new Set<() => void>(); const emit = () => subs.forEach(f => f());
  return {
    get pending() { return pending ? { text: pending.text, risk: pending.risk, title: pending.title } : null; },
    ask(text: string, risk: Risk, title: string): Promise<boolean> {
      if (pending) pending.resolve(false);
      return new Promise<boolean>(resolve => { pending = { text, risk, title, resolve: yes => { pending = null; emit(); resolve(yes); } }; emit(); });
    },
    answer(yes: boolean) { pending?.resolve(yes); },
    subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
  };
}
export type ConfirmBroker = ReturnType<typeof createConfirmBroker>;

export function createTaskRunner(deps: RunnerDeps) {
  const clock = deps.clock || realClock;
  const queue: Task[] = [];
  let current: Task | null = null, running = false, epoch = 0, nextId = 1, loopId = 0;
  const notify = () => deps.onChange?.(current, queue.slice());
  const state = () => deps.ctx.getState();
  const say = (text: string, why: string) => { deps.actor.say(text); deps.log(text, why); };

  const finish = (t: Task, status: TaskStatus, reason?: string) => { t.status = status; t.reason = reason; notify(); };

  async function runTask(t: Task, my: number) {
    t.status = 'running'; notify(); deps.actor.lock(true);
    say(`Okay, ${t.title.charAt(0).toLowerCase() + t.title.slice(1)}.`, `You asked me to: ${t.title}.`);
    try {
      for (let i = 0; i < t.steps.length; i++) {
        if (my !== epoch) return;
        const st = t.steps[i]; t.index = i; notify();
        if (st.narration) say(st.narration, `Step ${i + 1} of ${t.steps.length} of "${t.title}": ${st.label}.`);
        if (st.station) { await deps.actor.goTo(st.station); if (my !== epoch) return; }
        const ev = evaluate(state(), st.action, st.params || {});
        if (ev.ok === false) { say(`I can't do that: ${ev.reason}`, `The "${st.label}" step was blocked by an interlock: ${ev.reason}`); finish(t, 'blocked', ev.reason); return; }
        if (ev.needsConfirm) {
          t.status = 'awaiting-confirm'; notify();
          const yes = await deps.confirm(ev.confirmText || `Do you want me to ${st.label.toLowerCase()}?`, ev.risk, t.title);
          if (my !== epoch) return;
          if (!yes) { say("Okay, I won't do that.", `You did not confirm "${st.label}".`); finish(t, 'cancelled', 'The operator did not confirm.'); return; }
          t.status = 'running'; notify();
        }
        const r = execute(deps.ctx, st.action, st.params || {}, { confirmed: true });
        if (r.status !== 'started') { const why = 'reason' in r ? r.reason : 'not started'; say(`I can't do that: ${why}`, `The "${st.label}" step failed to start: ${why}`); finish(t, 'blocked', why); return; }
        const w = await waitFor(state, st.action, st.params || {}, { timeoutMs: st.timeoutMs, clock, cancelled: () => my !== epoch });
        if (my !== epoch) return;
        if (w === 'timeout') { const why = `Timed out waiting for: ${st.label}.`; say(`That is taking too long. ${why}`, why); finish(t, 'failed', why); return; }
      }
      say(`${t.title}: done.`, `All ${t.steps.length} step${t.steps.length === 1 ? '' : 's'} finished and the lab state confirms it.`);
      finish(t, 'done');
    } finally { if (my === epoch) deps.actor.lock(false); }
  }

  async function loop() {
    if (running) return; running = true; const myLoop = ++loopId;
    try {
      while (queue.length) {
        const my = epoch; current = queue.shift() as Task; notify();
        await runTask(current, my);
        if (my !== epoch) break;
      }
    } finally { if (myLoop === loopId) { current = null; running = false; deps.actor.lock(false); notify(); } }
  }

  return {
    get current() { return current; }, get queue() { return queue; },
    enqueue(defId: string, params: Params = {}): { ok: true; task: Task } | { ok: false; reason: string } {
      const def = TASK_BY_ID[defId]; if (!def) return { ok: false, reason: `I don't know a task called "${defId}".` };
      const built = def.build(state(), params); if (!Array.isArray(built)) return { ok: false, reason: built.error };
      const task: Task = { id: nextId++, def: defId, title: def.title, params, steps: built, index: 0, status: 'queued' };
      queue.push(task); notify(); void loop(); return { ok: true, task };
    },
    /** Queue an ad-hoc task made of registry steps (used for single tool calls). */
    enqueueSteps(title: string, steps: Step[]): Task {
      const task: Task = { id: nextId++, def: 'adhoc', title, params: {}, steps, index: 0, status: 'queued' };
      queue.push(task); notify(); void loop(); return task;
    },
    /** Cancel one task (default: the current one) and everything queued behind it is kept. */
    cancel(id?: number) {
      if (id !== undefined && queue.some(t => t.id === id)) { const t = queue.find(x => x.id === id) as Task; queue.splice(queue.indexOf(t), 1); finish(t, 'cancelled', 'Cancelled by the operator.'); return true; }
      if (current && (id === undefined || id === current.id)) { const t = current; epoch++; deps.actor.cancel(); deps.actor.lock(false); finish(t, 'cancelled', 'Cancelled by the operator.'); running = false; current = null; void loop(); say('Okay, stopped.', 'You cancelled the task.'); return true; }
      return false;
    },
    /** Halts everything now and puts the lab in a safe state: laser shutter closed, any scan paused. */
    emergencyStop() {
      epoch++; const t = current; const q = queue.splice(0); current = null; running = false;
      deps.actor.cancel(); deps.actor.lock(false);
      if (t) finish(t, 'cancelled', 'Emergency stop.'); for (const x of q) finish(x, 'cancelled', 'Emergency stop.');
      const s = state();
      if (s.ldv?.shutter) execute(deps.ctx, 'laser_shutter', { on: false }, { confirmed: true });
      if (s.experiment?.scanActive && !s.experiment?.scanPaused) execute(deps.ctx, 'pause_scan', {}, { confirmed: true });
      say('Emergency stop. I have halted everything, closed the laser shutter and paused the scan.', 'You pressed Emergency stop.'); notify();
    },
    /** Resolves when the task finishes, needs a confirmation, or the time runs out. */
    async waitSettled(task: Task, maxMs: number): Promise<TaskStatus> {
      const t0 = clock.now();
      while (task.status === 'queued' || task.status === 'running') { if (clock.now() - t0 >= maxMs) return task.status; await clock.sleep(100); }
      return task.status;
    },
    riskOf,
  };
}
export type TaskRunner = ReturnType<typeof createTaskRunner>;

/** The tools offered to the language model: every registry action, plus run_task and cancel_task. */
export function runnerTools(base: { name: string; description: string; input_schema: unknown }[]) {
  return [
    ...base,
    { name: 'run_task', description: `Do a multi-step job the way a technician would: ${TASKS.map(t => `${t.id} (${t.description})`).join(' ')} Returns immediately; the job runs while you keep talking.`,
      input_schema: { type: 'object', properties: { task: { type: 'string', description: 'Task id', enum: TASKS.map(t => t.id) }, x: { type: 'number', description: 'X in mm (move_stage)', minimum: -35, maximum: 35 }, y: { type: 'number', description: 'Y in mm (move_stage)', minimum: -35, maximum: 35 }, z: { type: 'number', description: 'Z in mm (move_stage)', minimum: -35, maximum: 35 }, kind: { type: 'string', description: 'Scan type for start_scan', enum: ['axis', 'grid'] }, format: { type: 'string', description: 'Export format', enum: ['csv', 'json'] } }, required: ['task'], additionalProperties: false } },
    { name: 'cancel_task', description: 'Cancel the task Dr. Wire is doing right now.', input_schema: { type: 'object', properties: {}, additionalProperties: false } },
  ];
}

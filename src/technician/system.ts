// Wires the pieces together for the 3D lab: the technician brain, the task runner, the phone call and
// the scientist's body. Kept free of three.js and React so the dependencies are plain interfaces.
import { createTechnician, type Settings, type TechRemark } from './dialogue';
import { extractFactsPlus } from './facts';
import { createConfirmBroker, createTaskRunner, type Task } from './taskRunner';
import { createCallController, type Bubble } from './callController';
import { createMicMonitor, createSpeech, requestMic } from './speech';
import type { Ctx, Station } from './actions';

export type SciLike = {
  pickUpPhone(): Promise<boolean>; hangUpPhone(): Promise<boolean>; cancelAll(): void; visit(name: Station): Promise<boolean>;
  setTaskLock(on: boolean): void; readonly onPhone: boolean; mouthLevel: number; speakingExternal: boolean;
};
export type SystemOpts = {
  stateRef: { current: any };
  dispatch: (a: any) => void;
  helpersRef: { current: Ctx['helpers'] | undefined };
  sci: SciLike;
  phone: { setRinging(on: boolean): void };
  foley: { startRing(): void; stopRing(): void; blip(up: boolean): void; unlock(): void };
  say: (b: Bubble & { focus?: any }) => void;
  settings: Partial<Settings>;
  onUpdate: () => void;
  speech?: ReturnType<typeof createSpeech>;
  now?: () => number;
};

export function createTechnicianSystem(o: SystemOpts) {
  const now = o.now || (() => performance.now());
  const tech = createTechnician({ settings: o.settings });
  const broker = createConfirmBroker();
  const speech = o.speech || createSpeech('browser');
  const ctx: Ctx = { getState: () => o.stateRef.current, dispatch: o.dispatch, helpers: undefined };
  Object.defineProperty(ctx, 'helpers', { get: () => o.helpersRef.current });
  let speakingNow = false, pulse = 0, current: Task | null = null, queue: Task[] = [];

  const logEvent = (text: string) => o.dispatch({ type: 'EVENT', text: `Dr. Wire: ${text}`, level: 'info', subsystem: 'TECHNICIAN' });

  const runner = createTaskRunner({
    ctx,
    actor: {
      goTo: async station => { if (o.sci.onPhone) await o.sci.hangUpPhone(); return o.sci.visit(station); },
      cancel: () => o.sci.cancelAll(),
      lock: on => o.sci.setTaskLock(on),
      say: text => { call.narrate(text, 'status'); },
    },
    confirm: (text, risk, title) => broker.ask(text, risk, title),
    log: (text, why) => { tech.note(text, why, now()); logEvent(text); o.onUpdate(); },
    onChange: (c, q) => { current = c; queue = q; o.onUpdate(); },
  });

  const call = createCallController({
    getState: () => o.stateRef.current, facts: () => extractFactsPlus(o.stateRef.current), tech, speech, runner, broker,
    phone: {
      ring: on => { o.phone.setRinging(on); if (on) o.foley.startRing(); else o.foley.stopRing(); },
      answer: () => o.sci.pickUpPhone(),
      hangUp: async () => { await o.sci.hangUpPhone(); },
      abort: () => { o.sci.cancelAll(); o.phone.setRinging(false); o.foley.stopRing(); },
    },
    beep: up => o.foley.blip(up), say: o.say as any,
    requestMic: () => { o.foley.unlock(); return requestMic() as any; },
    monitor: stream => createMicMonitor(stream),
    mouth: (on, level) => { speakingNow = on; pulse = level; if (!on) { o.sci.speakingExternal = false; o.sci.mouthLevel = 0; } else o.sci.speakingExternal = true; },
    logEvent, now: () => Date.now(),
  });
  call.subscribe(o.onUpdate); broker.subscribe(() => {
    const p = broker.pending; o.onUpdate();
    if (p && call.state === 'connected') call.narrate(`${p.text} Do you want me to go ahead?`, 'alert');
  });

  return {
    tech, runner, broker, call, speech,
    get task() { return current; }, get queue() { return queue; },
    /** Called every frame so the mouth moves while he speaks. */
    tick(t: number, dt: number) { pulse = Math.max(0, pulse - dt * 2); if (speakingNow) o.sci.mouthLevel = 0.25 + 0.5 * Math.abs(Math.sin(t * 11)) * (0.6 + 0.4 * pulse); },
    /** Show a remark; while a call is up, alerts and findings are also spoken. */
    remark(r: TechRemark) {
      o.say({ text: r.text, focus: r.focus as any, mood: r.mood as any, kind: r.kind } as any);
      if (call.state === 'connected' && (r.kind === 'alert' || r.kind === 'finding') && !call.captions.slice(-2).some(c => c.text === r.text)) call.narrate(r.text, r.kind, false);
    },
    dispose() { call.dispose(); speech.dispose(); runner.emergencyStop(); },
  };
}
export type TechnicianSystem = ReturnType<typeof createTechnicianSystem>;

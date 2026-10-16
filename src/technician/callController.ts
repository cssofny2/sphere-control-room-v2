// The phone call with Dr. Wire: ring, walk to the phone, answer, then a spoken or typed conversation.
// This file has no React or three.js in it. Everything it touches (speech, microphone, the scientist,
// the AI endpoint) is passed in, so the whole call flow can be tested with fakes.
import type { Technician } from './dialogue';
import type { FactsPlus } from './facts';
import { buildSnapshot } from './snapshot';
import { createSentenceChunker, LLMUnavailable, streamTechnician, type Block, type Msg } from './llm';
import { parseCommand, isNo, isYes } from './intents';
import { ACTION_BY_ID } from './actions';
import type { ConfirmBroker, Step, TaskRunner } from './taskRunner';
import type { SpeechIO } from './speech';

export type CallState = 'idle' | 'connecting' | 'ringing' | 'connected' | 'ended';
export type Caption = { id: number; who: 'you' | 'wire' | 'system'; text: string; interim?: boolean };
export type MicState = 'ok' | 'denied' | 'unsupported' | 'off';
export type MicInput = 'open' | 'push';
export type Bubble = { text: string; focus: 'none'; mood: 'neutral' | 'worried'; kind: string };

export type CallDeps = {
  getState: () => any;
  facts: () => FactsPlus;
  tech: Technician;
  speech: SpeechIO;
  runner: TaskRunner;
  broker: ConfirmBroker;
  phone: { ring(on: boolean): void; answer(): Promise<boolean>; hangUp(): Promise<void>; abort(): void };
  beep: (up: boolean) => void;
  say: (b: Bubble) => void;
  requestMic: () => Promise<{ ok: true; stream: { getTracks(): { stop(): void }[] } } | { ok: false; reason: 'denied' | 'unsupported' | 'error' }>;
  monitor?: (stream: any) => { level(): number; dispose(): void; available: boolean } | null;
  stream?: typeof streamTechnician;
  now?: () => number;
  mouth?: (speaking: boolean, level: number) => void;
  logEvent?: (text: string) => void;
  toolWaitMs?: number;
  bargeLevel?: number;
};

const NOTICE: Record<string, string> = {
  not_deployed: 'The AI voice service is not set up on this site, so Dr. Wire is using his built-in answers.',
  rate_limited: 'The AI line is busy right now. Dr. Wire is using his built-in answers for the moment.',
  cap_reached: 'The AI service has reached its daily limit. Dr. Wire is using his built-in answers until tomorrow.',
  no_key: 'The AI voice service is not configured yet, so Dr. Wire is using his built-in answers.',
};

export function createCallController(deps: CallDeps) {
  const now = deps.now || (() => Date.now());
  const stream = deps.stream || streamTechnician;
  const toolWaitMs = deps.toolWaitMs ?? 12000;
  const bargeLevel = deps.bargeLevel ?? 0.2;
  const subs = new Set<() => void>();
  let state: CallState = 'idle', micState: MicState = 'off', micInput: MicInput = 'open';
  let muted = false, speakerOn = true, bargeIn = true, llmDown = false, textOnly = false;
  let notice = '', connectedAt = 0, endedAt = 0, capId = 0, interimId = 0;
  let captions: Caption[] = [];
  let history: Msg[] = [];
  let mic: { getTracks(): { stop(): void }[] } | null = null, monitor: ReturnType<NonNullable<CallDeps['monitor']>> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null, loud = 0;
  let abort: AbortController | null = null, speakChain: Promise<void> = Promise.resolve(), epoch = 0;
  let pttBuf = '', pttActive = false, resumeTimer: ReturnType<typeof setTimeout> | null = null;
  const unsub: (() => void)[] = [];
  let busyTurn = false; const turnQueue: string[] = [];

  const emit = () => subs.forEach(f => f());
  const cap = (who: Caption['who'], text: string, interim = false) => { const c = { id: ++capId, who, text, interim }; captions = [...captions.slice(-40), c]; emit(); return c; };
  const updateCap = (id: number, text: string, interim = false) => { captions = captions.map(c => (c.id === id ? { ...c, text, interim } : c)); emit(); };
  const setNotice = (n: string) => { if (n !== notice) { notice = n; emit(); } };

  // ——— speaking ———
  const speakChunk = (text: string) => {
    if (!speakerOn || !deps.speech.supported.speak) return;
    const my = epoch; speakChain = speakChain.then(() => (my === epoch ? deps.speech.speak(text) : undefined));
  };
  unsub.push(deps.speech.onSpeaking((on, level) => {
    deps.mouth?.(on, level);
    if (micInput === 'open' && micState === 'ok' && !muted && state === 'connected') {
      if (on) deps.speech.stopListening();
      else { if (resumeTimer) clearTimeout(resumeTimer); resumeTimer = setTimeout(() => { if (state === 'connected' && !muted && micInput === 'open' && !deps.speech.isSpeaking()) deps.speech.listen(); }, 350); }
    }
  }));
  unsub.push(deps.speech.onError(code => {
    if (code === 'mic-denied') { micState = 'denied'; textOnly = true; cap('system', 'The browser blocked speech recognition. You can type instead.'); }
    else if (code === 'no-speech-service') { micState = 'unsupported'; textOnly = true; cap('system', 'Speech recognition is not available in this browser. You can type instead.'); }
    emit();
  }));
  unsub.push(deps.speech.onTranscript((text, final) => {
    if (state !== 'connected' || muted) return;
    if (micInput === 'push') { if (final) { pttBuf = (pttBuf + ' ' + text).trim(); } return; }
    if (!final) { if (interimId) updateCap(interimId, text, true); else interimId = cap('you', text, true).id; return; }
    if (interimId) { captions = captions.filter(c => c.id !== interimId); interimId = 0; emit(); }
    void submit(text);
  }));

  // ——— turns ———
  const reply = (text: string, kind: Bubble['kind'] = 'answer', mood: Bubble['mood'] = 'neutral') => {
    cap('wire', text); deps.say({ text, focus: 'none', mood, kind }); speakChunk(text);
  };

  async function runTool(name: string, input: Record<string, unknown>): Promise<{ content: string; is_error?: boolean }> {
    const R = deps.runner;
    if (name === 'cancel_task') return { content: R.cancel() ? 'Cancelled the current task.' : 'There was no task running.' };
    if (name === 'run_task') {
      const { task, ...params } = input as { task?: string } & Record<string, unknown>;
      const r = R.enqueue(String(task || ''), params);
      return r.ok === true ? { content: `Accepted: ${r.task.title} (${r.task.steps.length} step${r.task.steps.length === 1 ? '' : 's'}). Dr. Wire is doing it now; it will finish while you keep talking.` } : { content: `Could not start: ${r.reason}`, is_error: true };
    }
    const def = ACTION_BY_ID[name];
    if (!def) return { content: `There is no tool called "${name}".`, is_error: true };
    const step: Step = { label: def.label, action: name, params: input, station: def.station, narration: def.narrate?.(input) };
    const task = R.enqueueSteps(def.label, [step]);
    const st = await R.waitSettled(task, toolWaitMs);
    if (st === 'done') return { content: `Done: ${def.label}.` };
    if (st === 'awaiting-confirm') return { content: `Not done yet. The operator has been asked to confirm: ${deps.broker.pending?.text || 'this action is risky'}. Ask them plainly and wait.` };
    if (st === 'blocked' || st === 'failed' || st === 'cancelled') return { content: `Not done (${st}): ${task.reason || 'no reason given'}`, is_error: true };
    return { content: `Started: ${def.label}. It is still in progress.` };
  }

  async function llmTurn(text: string): Promise<boolean> {
    const startLen = history.length; history.push({ role: 'user', content: text });
    abort = new AbortController(); const my = epoch;
    let toolCalls = 0; const cid = { id: 0 }; let spoken = '';
    for (let round = 0; round < 10; round++) {
      let buf = ''; const uses: { id: string; name: string; input: Record<string, unknown> }[] = [];
      const chunker = createSentenceChunker(s => { spoken += (spoken ? ' ' : '') + s; speakChunk(s); deps.say({ text: spoken, focus: 'none', mood: 'neutral', kind: 'answer' }); });
      try {
        await stream({ messages: history, snapshot: buildSnapshot(deps.facts(), { task: deps.runner.current?.title, pendingConfirm: deps.broker.pending?.text }), signal: abort.signal }, ev => {
          if (my !== epoch) return;
          if (ev.type === 'text') { buf += ev.delta; chunker.push(ev.delta); if (!cid.id) cid.id = cap('wire', buf).id; else updateCap(cid.id, spoken ? buf : buf); }
          else if (ev.type === 'tool_use') uses.push({ id: ev.id, name: ev.name, input: ev.input });
          else if (ev.type === 'error') throw new LLMUnavailable(ev.message, ev.code || 'error');
        });
      } catch (e) {
        history.length = startLen;
        if ((e as Error).name === 'AbortError') return true;
        if ((e as Error)?.name === 'LLMUnavailable') { const code = (e as LLMUnavailable).code; if (code === 'not_deployed' || code === 'no_key' || code === 'cap_reached') llmDown = true; setNotice(NOTICE[code] || 'The AI line dropped. Dr. Wire is using his built-in answers for this one.'); return false; }
        throw e;
      }
      if (my !== epoch) return true;
      chunker.flush();
      const content: Block[] = [...(buf.trim() ? [{ type: 'text' as const, text: buf.trim() }] : []), ...uses.map(u => ({ type: 'tool_use' as const, id: u.id, name: u.name, input: u.input }))];
      if (content.length) history.push({ role: 'assistant', content });
      if (!uses.length) break;
      const results: Block[] = [];
      for (const u of uses) {
        if (toolCalls >= 8) { results.push({ type: 'tool_result', tool_use_id: u.id, content: 'Tool limit reached: at most eight tool calls per reply.', is_error: true }); continue; }
        toolCalls++; const r = await runTool(u.name, u.input); results.push({ type: 'tool_result', tool_use_id: u.id, content: r.content, is_error: r.is_error });
      }
      history.push({ role: 'user', content: results });
      cid.id = 0;
    }
    if (history.length > 24) { let i = history.length - 20; while (i < history.length && !(history[i].role === 'user' && typeof history[i].content === 'string')) i++; history = history.slice(i); }
    return true;
  }

  function offlineTurn(text: string) {
    const intent = parseCommand(text, deps.getState());
    if (intent?.type === 'estop') { deps.runner.emergencyStop(); reply('Emergency stop. Everything is halted and the laser shutter is closed.', 'alert', 'worried'); return; }
    if (intent?.type === 'cancel') { reply(deps.runner.cancel() ? 'Okay, I stopped what I was doing.' : "I'm not doing anything right now."); return; }
    if (intent?.type === 'task') {
      const r = deps.runner.enqueue(intent.id, intent.params);
      reply(r.ok === true ? `Sure. ${r.task.title}. Watch me.` : `I can't do that: ${r.reason}`, 'answer', r.ok === true ? 'neutral' : 'worried'); return;
    }
    const a = deps.tech.ask(text, deps.facts(), now()); reply(a.remark.text, 'answer', a.known ? 'neutral' : 'worried');
  }

  async function handle(text: string) {
    // The operator answering a pending yes/no question.
    if (deps.broker.pending) {
      if (isYes(text)) { deps.broker.answer(true); reply('Okay, doing it.'); return; }
      if (isNo(text)) { deps.broker.answer(false); return; }
    }
    if (/\b(emergency stop|stop everything|e-?stop)\b/i.test(text)) { offlineTurn(text); return; }
    if (/\b(hang up|goodbye|bye|that's all|that is all)\b/i.test(text) && text.trim().split(/\s+/).length <= 4) { reply('Okay, talk soon.'); setTimeout(() => void hangUp(), 1800); return; }
    if (!llmDown) { const ok = await llmTurn(text); if (ok) return; }
    offlineTurn(text);
  }

  async function submit(raw: string) {
    const text = raw.trim().slice(0, 400); if (!text || state !== 'connected') return;
    if (deps.speech.isSpeaking()) { epoch++; deps.speech.cancel(); abort?.abort(); }
    cap('you', text);
    if (busyTurn) { turnQueue.push(text); return; }
    busyTurn = true;
    try { await handle(text); while (turnQueue.length) await handle(turnQueue.shift() as string); }
    catch { reply("Sorry, I lost my train of thought. Could you say that again?", 'answer', 'worried'); }
    finally { busyTurn = false; }
  }

  // ——— lifecycle ———
  function startPolling() {
    if (!monitor?.available) return;
    pollTimer = setInterval(() => {
      if (!bargeIn || !deps.speech.isSpeaking() || muted || state !== 'connected') { loud = 0; return; }
      loud = (monitor as NonNullable<typeof monitor>).level() > bargeLevel ? loud + 1 : 0;
      if (loud >= 3) { loud = 0; epoch++; deps.speech.cancel(); abort?.abort(); cap('system', 'You interrupted.'); if (micInput === 'open') deps.speech.listen(); }
    }, 100);
  }

  async function start(opts: { mic?: boolean } = {}) {
    if (state !== 'idle' && state !== 'ended') return;
    captions = []; history = []; capId = 0; interimId = 0; notice = ''; llmDown = false; textOnly = false; muted = false; epoch++; micState = 'off'; deps.tech.memory.questions += 0;
    state = 'connecting'; emit();
    const wantMic = opts.mic !== false;
    const m = wantMic ? await deps.requestMic() : ({ ok: false, reason: 'off' } as const);   // must run inside the click that started the call
    if (!wantMic) { micState = 'off'; textOnly = true; }
    else if (m.ok === true) { mic = m.stream; micState = deps.speech.supported.listen ? 'ok' : 'unsupported'; monitor = deps.monitor?.(m.stream) || null; if (micState === 'unsupported') { textOnly = true; setNotice('This browser cannot do speech recognition, so please type your questions. Dr. Wire can still speak.'); } }
    else if (m.ok === false) { micState = m.reason === 'denied' ? 'denied' : 'unsupported'; textOnly = true; setNotice(m.reason === 'denied' ? 'Microphone access was blocked. You can still type to Dr. Wire.' : 'No microphone was found. You can still type to Dr. Wire.'); }
    if (state !== 'connecting') return;
    state = 'ringing'; emit(); deps.phone.ring(true);
    deps.logEvent?.('Operator called Dr. Wire on the lab phone.');
    const answered = await deps.phone.answer();
    deps.phone.ring(false);
    if (!answered || (state as CallState) !== 'ringing') { if ((state as CallState) === 'ringing') { state = 'ended'; endedAt = now(); emit(); } return; }
    deps.beep(true); state = 'connected'; connectedAt = now(); emit();
    startPolling();
    const f = deps.facts(); const open = f.alarms.length;
    reply(`Lab, Dr. Wire speaking.${open ? ` I can see ${open} open alarm${open > 1 ? 's' : ''}.` : ''} What can I do for you?`, 'answer', open ? 'worried' : 'neutral');
    if (micState === 'ok' && micInput === 'open') deps.speech.listen();
  }

  async function hangUp() {
    if (state === 'idle' || state === 'ended') return;
    const was = state; epoch++; abort?.abort();
    deps.speech.cancel(); deps.speech.stopListening(); if (resumeTimer) clearTimeout(resumeTimer); if (pollTimer) clearInterval(pollTimer); pollTimer = null;
    mic?.getTracks().forEach(t => t.stop()); mic = null; monitor?.dispose(); monitor = null; deps.mouth?.(false, 0);
    deps.phone.ring(false);
    state = 'ended'; endedAt = now(); emit();
    if (was === 'connected') { deps.beep(false); await deps.phone.hangUp(); deps.logEvent?.(`Call with Dr. Wire ended after ${Math.round((endedAt - connectedAt) / 1000)} seconds.`); }
    else deps.phone.abort();
    state = 'ended'; emit();
  }

  return {
    get state() { return state; }, get captions() { return captions; }, get notice() { return notice; }, get micState() { return micState; },
    get muted() { return muted; }, get micInput() { return micInput; }, get speakerOn() { return speakerOn; }, get bargeIn() { return bargeIn; }, get textOnly() { return textOnly; },
    get llmDown() { return llmDown; }, get history() { return history; },
    elapsedSec() { return state === 'connected' ? Math.floor((now() - connectedAt) / 1000) : state === 'ended' && connectedAt ? Math.floor((endedAt - connectedAt) / 1000) : 0; },
    subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
    start, hangUp, submit,
    /** Clears an ended call so the bar can close. */
    reset() { if (state === 'ended') { state = 'idle'; captions = []; notice = ''; connectedAt = 0; emit(); } },
    /** Dr. Wire says something on his own initiative (task narration, alerts) while the call is up. */
    narrate(text: string, kind: Bubble['kind'] = 'status', bubble = true) { if (bubble) deps.say({ text, focus: 'none', mood: 'neutral', kind }); if (state === 'connected') { cap('wire', text); speakChunk(text); } },
    setMuted(m: boolean) { muted = m; if (m) deps.speech.stopListening(); else if (state === 'connected' && micState === 'ok' && micInput === 'open' && !deps.speech.isSpeaking()) deps.speech.listen(); emit(); },
    setMicInput(m: MicInput) { micInput = m; if (m === 'push') deps.speech.stopListening(); else if (state === 'connected' && micState === 'ok' && !muted) deps.speech.listen(); emit(); },
    setSpeaker(on: boolean) { speakerOn = on; if (!on) { epoch++; deps.speech.cancel(); } emit(); },
    setBargeIn(on: boolean) { bargeIn = on; emit(); },
    pttDown() { if (state !== 'connected' || micState !== 'ok' || muted) return; pttActive = true; pttBuf = ''; epoch++; deps.speech.cancel(); abort?.abort(); deps.speech.listen(); emit(); },
    async pttUp() { if (!pttActive) return; pttActive = false; deps.speech.stopListening(); await new Promise(r => setTimeout(r, 700)); const t = pttBuf; pttBuf = ''; emit(); if (t) await submit(t); },
    get pttActive() { return pttActive; },
    dispose() { void hangUp(); unsub.forEach(f => f()); subs.clear(); },
  };
}
export type CallController = ReturnType<typeof createCallController>;

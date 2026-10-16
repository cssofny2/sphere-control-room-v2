import { useEffect, useRef, useState } from 'react';
import type { TechnicianSystem } from './system';

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** Shown before the first call: what the microphone is used for. */
export function CallConsent({ onStart, onCancel }: { onStart: (mic: boolean) => void; onCancel: () => void }) {
  return (
    <div className="ls-consent" role="dialog" aria-modal="false" aria-label="Before you call Dr. Wire" data-call-consent>
      <b>Call Dr. Wire</b>
      <p>Dr. Wire will answer the lab phone. If you allow the microphone, it is on only while the call is open, and a red “Microphone on” light shows whenever it is listening. This app does not record or store audio, and the conversation text stays in your browser.</p>
      <p>Speech is turned into text by your browser’s own speech service (in Chrome and Edge that service is run by Google or Microsoft). Typing works too, and nothing about the lab leaves your browser except your questions and a short summary of the lab’s state sent to the AI service.</p>
      <div className="ls-consent-actions">
        <button type="button" className="ls-btn" data-call-mic onClick={() => onStart(true)}>Call with microphone</button>
        <button type="button" className="ls-btn" data-call-type onClick={() => onStart(false)}>Call, typing only</button>
        <button type="button" className="ls-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export function CallBar({ sys }: { sys: TechnicianSystem }) {
  const c = sys.call; const [text, setText] = useState(''); const [, tick] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const id = window.setInterval(() => tick(n => n + 1), 1000); return () => window.clearInterval(id); }, []);
  const caps = c.captions.slice(-6);
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [caps.length, caps[caps.length - 1]?.text]);
  if (c.state === 'idle') return null;
  const live = c.state === 'connected';
  const label = c.state === 'connecting' ? 'Connecting…' : c.state === 'ringing' ? 'Ringing… Dr. Wire is walking to the phone' : live ? `Connected ${mmss(c.elapsedSec())}` : `Call ended ${mmss(c.elapsedSec())}`;
  const micOn = live && c.micState === 'ok' && !c.muted;
  const pend = sys.broker.pending;
  return (
    <div className="ls-call" role="region" aria-label="Phone call with Dr. Wire" data-call-bar data-call-state={c.state}>
      <div className="ls-call-head">
        <span className="ls-call-status" data-call-status>{label}</span>
        {micOn && <span className="ls-mic-on" data-mic-indicator title="The microphone is listening"><i aria-hidden="true" /> Microphone on</span>}
        {live && c.micState !== 'ok' && <span className="ls-mic-off">Typing only</span>}
      </div>
      {c.notice && <div className="ls-call-notice" role="status" data-call-notice>{c.notice}</div>}
      <div className="ls-call-caps" ref={logRef} role="log" aria-live="polite" aria-label="Call captions" data-call-captions>
        {caps.map(x => <p key={x.id} className={`ls-cap ls-cap-${x.who}${x.interim ? ' is-interim' : ''}`}><b>{x.who === 'you' ? 'You' : x.who === 'wire' ? 'Dr. Wire' : 'Note'}</b> {x.text}</p>)}
      </div>
      {pend && (
        <div className="ls-confirm" role="alertdialog" aria-label="Confirm action" data-confirm>
          <span>{pend.text}</span>
          <button type="button" className="ls-btn" data-confirm-yes onClick={() => sys.broker.answer(true)}>Yes, do it</button>
          <button type="button" className="ls-btn" data-confirm-no onClick={() => sys.broker.answer(false)}>No</button>
        </div>
      )}
      {live && (
        <form className="ls-call-text" onSubmit={e => { e.preventDefault(); const t = text.trim(); if (t) { setText(''); void c.submit(t); } }}>
          <input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Type to Dr. Wire…" aria-label="Type a message to Dr. Wire" maxLength={400} data-call-input />
          <button type="submit" className="ls-btn" data-call-send>Send</button>
        </form>
      )}
      <div className="ls-call-actions">
        {live && c.micState === 'ok' && <button type="button" className={`ls-btn${c.muted ? ' is-on' : ''}`} aria-pressed={c.muted} data-call-mute onClick={() => c.setMuted(!c.muted)}>{c.muted ? 'Unmute' : 'Mute'}</button>}
        {live && c.micState === 'ok' && <button type="button" className={`ls-btn${c.micInput === 'push' ? ' is-on' : ''}`} aria-pressed={c.micInput === 'push'} data-call-mode onClick={() => c.setMicInput(c.micInput === 'push' ? 'open' : 'push')}>{c.micInput === 'push' ? 'Push-to-talk' : 'Open mic'}</button>}
        {live && c.micState === 'ok' && c.micInput === 'push' && <button type="button" className={`ls-btn${c.pttActive ? ' is-on' : ''}`} data-call-ptt onPointerDown={() => c.pttDown()} onPointerUp={() => void c.pttUp()} onPointerLeave={() => void c.pttUp()} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); c.pttDown(); } }} onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') void c.pttUp(); }}>Hold to talk</button>}
        {live && <button type="button" className={`ls-btn${c.speakerOn ? '' : ' is-on'}`} aria-pressed={!c.speakerOn} data-call-voice onClick={() => c.setSpeaker(!c.speakerOn)}>{c.speakerOn ? 'Voice on' : 'Voice off'}</button>}
        {live && c.micState === 'ok' && <label className="ls-check"><input type="checkbox" checked={c.bargeIn} onChange={e => c.setBargeIn(e.target.checked)} data-call-barge /> Let me interrupt</label>}
        <span className="ls-spacer" />
        <button type="button" className="ls-btn ls-hangup" data-call-hangup onClick={() => { if (c.state === 'ended') c.reset(); else void c.hangUp(); }}>{c.state === 'ended' ? 'Close' : 'Hang up'}</button>
      </div>
    </div>
  );
}

/** Small strip showing what Dr. Wire is doing, with Cancel and Emergency stop. */
export function TaskChip({ sys }: { sys: TechnicianSystem }) {
  const t = sys.task; const q = sys.queue; const pend = sys.broker.pending;
  if (!t && !q.length) return null;
  return (
    <div className="ls-task" role="status" data-task-chip data-task-status={t?.status}>
      <span className="ls-task-title">{t ? `Dr. Wire: ${t.title}` : 'Dr. Wire: waiting'}</span>
      {t && <span className="ls-task-step" data-task-step>{t.status === 'awaiting-confirm' ? 'waiting for your OK' : `step ${Math.min(t.index + 1, t.steps.length)} of ${t.steps.length}: ${t.steps[Math.min(t.index, t.steps.length - 1)]?.label ?? ''}`}</span>}
      {q.length > 0 && <span className="ls-task-q">+{q.length} queued</span>}
      {t && <progress max={t.steps.length} value={t.index + (t.status === 'done' ? 1 : 0)} aria-label="Task progress" />}
      {pend && sys.call.state !== 'connected' && (<>
        <button type="button" className="ls-btn" data-confirm-yes onClick={() => sys.broker.answer(true)}>Yes</button>
        <button type="button" className="ls-btn" data-confirm-no onClick={() => sys.broker.answer(false)}>No</button>
      </>)}
      <button type="button" className="ls-btn" data-task-cancel onClick={() => sys.runner.cancel()}>Cancel</button>
      <button type="button" className="ls-btn ls-estop" data-task-estop onClick={() => sys.runner.emergencyStop()}>Emergency stop</button>
    </div>
  );
}

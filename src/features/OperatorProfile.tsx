import React, { useEffect, useRef, useState } from 'react';
import { UserRound, X } from 'lucide-react';
import './features.css';
import { deriveInitials, hasOperator, operatorCallName, operatorFullName, operatorTag, sanitizeProfile, type OperatorProfile } from './operator';
import { LabClock } from './LabClock';

/** Header button: shows who is on duty (initials in a badge) or invites the visitor to introduce themselves. */
export function OperatorChip({ operator, onClick }: { operator: OperatorProfile; onClick: () => void }) {
  const set = hasOperator(operator);
  return (
    <button type="button" className={`chrome-button op-chip${set ? '' : ' is-unset'}`} onClick={onClick} aria-label={set ? `Operator on duty: ${operatorFullName(operator)}. Edit profile.` : 'Set the operator name for logs'} title={set ? `Operator on duty: ${operatorFullName(operator)} — click to edit` : 'Tell the lab who you are. Your initials are written into every log entry.'}>
      <span className="op-avatar" aria-hidden="true">{set ? operatorTag(operator).slice(0, 3) : <UserRound size={14} />}</span>
      <span className="chrome-action-label op-name">{set ? operatorCallName(operator) || operatorTag(operator) : 'Set operator'}</span>
    </button>
  );
}

/** The form itself: name, nickname, initials, a live preview of how logs will read, and what Dr. Wire will call you. */
export function OperatorForm({ operator, onSave, onClear, autoFocus = false, saveLabel = 'Save operator' }: { operator: OperatorProfile; onSave: (p: OperatorProfile) => void; onClear?: () => void; autoFocus?: boolean; saveLabel?: string }) {
  const [name, setName] = useState(operator.name), [nick, setNick] = useState(operator.nickname), [ini, setIni] = useState(operator.initials);
  const [touchedIni, setTouchedIni] = useState(!!operator.initials && operator.initials !== deriveInitials(operator.name, operator.nickname));
  const [saved, setSaved] = useState(false);
  useEffect(() => { setName(operator.name); setNick(operator.nickname); setIni(operator.initials); setTouchedIni(!!operator.initials && operator.initials !== deriveInitials(operator.name, operator.nickname)); }, [operator.name, operator.nickname, operator.initials]);
  const autoIni = deriveInitials(name, nick), shownIni = touchedIni ? ini : autoIni;
  const draft = sanitizeProfile({ name, nickname: nick, initials: shownIni });
  const tag = operatorTag(draft) || 'XX';
  const submit = (e: React.FormEvent) => { e.preventDefault(); onSave(draft); setSaved(true); window.setTimeout(() => setSaved(false), 2200); };
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) first.current?.focus(); }, [autoFocus]);
  return (
    <form className="op-form" onSubmit={submit} aria-label="Operator profile">
      <div className="op-grid">
        <label>Name<input ref={first} value={name} maxLength={40} autoComplete="name" placeholder="e.g. Michael Goodman" onChange={e => setName(e.target.value)} /></label>
        <label>Nickname <small>(what Dr. Wire calls you)</small><input value={nick} maxLength={20} autoComplete="nickname" placeholder="e.g. Mike" onChange={e => setNick(e.target.value)} /></label>
        <label>Initials <small>(stamped on logs)</small><input value={shownIni} maxLength={4} placeholder={autoIni || 'MG'} onChange={e => { setIni(e.target.value.toUpperCase()); setTouchedIni(true); }} /></label>
      </div>
      <div className="op-preview" aria-live="polite">
        <div><span>Log lines will read</span><code>[{tag}] <LabClock variant="screen" /> Stage command accepted: X 5.000, Y 0.000, Z 0.000 mm.</code></div>
        <div><span>Dr. Wire will say</span><code>“Hi {operatorCallName(draft) || 'there'}, the clock just locked.”</code></div>
      </div>
      <p className="op-note">Saved only in this browser. It is written into the journal, alarms, notebook and exports, and shared with Dr. Wire so he can address you. Nothing is sent anywhere else.</p>
      <div className="op-actions">
        <button type="submit" className="op-save" disabled={!hasOperator(draft)}>{saveLabel}</button>
        {onClear && hasOperator(operator) && <button type="button" className="op-clear" onClick={() => { onClear(); setName(''); setNick(''); setIni(''); setTouchedIni(false); }}>Clear</button>}
        {saved && <span className="op-saved" role="status">Saved. Logs now carry [{tag}].</span>}
      </div>
    </form>
  );
}

export function OperatorModal({ operator, onSave, onClear, onClose }: { operator: OperatorProfile; onSave: (p: OperatorProfile) => void; onClear: () => void; onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }; window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true); }, [onClose]);
  return (
    <div className="fm-back" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fm-dialog" role="dialog" aria-modal="true" aria-labelledby="op-title">
        <div className="fm-head"><h3 id="op-title"><UserRound size={16} /> Operator on duty</h3><button type="button" className="fm-x" aria-label="Close" onClick={onClose}><X size={18} /></button></div>
        <div className="fm-body">
          <p className="fm-lead">Tell the lab who is at the bench. Every log line, alarm, notebook note and export will carry your initials and the real date and time.</p>
          <OperatorForm operator={operator} onSave={p => { onSave(p); }} onClear={onClear} autoFocus />
        </div>
      </div>
    </div>
  );
}

/** Friendly card at the top of the Operator Console until a profile exists. */
export function OperatorWelcome({ operator, onSave }: { operator: OperatorProfile; onSave: (p: OperatorProfile) => void }) {
  const set = hasOperator(operator);
  if (set) return (
    <div className="op-card is-set"><span className="op-avatar is-big" aria-hidden="true">{operatorTag(operator).slice(0, 3)}</span>
      <div><div className="op-card-title">Operator on duty: {operatorFullName(operator)}</div><div className="op-card-sub">Logs are stamped <code>[{operatorTag(operator)}]</code> · Dr. Wire calls you {operatorCallName(operator) || operatorTag(operator)} · <LabClock variant="screen" /></div></div></div>
  );
  return (
    <div className="op-card"><div className="op-card-head"><span className="op-avatar is-big" aria-hidden="true"><UserRound size={20} /></span><div><div className="op-card-title">Who is at the bench?</div><div className="op-card-sub">Add your name, nickname or initials. They are written into the logs and Dr. Wire will greet you by name.</div></div></div>
      <OperatorForm operator={operator} onSave={onSave} saveLabel="Start my shift" /></div>
  );
}

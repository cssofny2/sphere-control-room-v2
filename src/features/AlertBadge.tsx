import React from 'react';
import './alerts.css';
import { ALERT_HEX, ALERT_WORD, getAlert, summarizeAlerts, worstAlert, type AlertInfo, type AlertKey, type AlertLevel } from './alerts';
import { useLab } from '../state/labStores';

const SEP = '␟';
const pack = (a: AlertInfo) => [a.level, a.label, a.detail, a.fix || '', a.page || ''].join(SEP);
const unpack = (t: string): AlertInfo => { const [level, label, detail, fix, page] = t.split(SEP); return { level: level as AlertLevel, label, detail, fix: fix || undefined, page: page || undefined }; };
/** Live alert for one part. The selector returns a string so the store only re-renders the caller when the alert actually changes. */
export function useAlert(key: AlertKey | AlertKey[]): AlertInfo & { key?: AlertKey } {
  const keys = Array.isArray(key) ? key : [key];
  const t = useLab(s => { if (keys.length === 1) return pack(getAlert(s, keys[0])) + SEP + keys[0]; const w = worstAlert(s, keys); return pack(w) + SEP + w.key; });
  const parts = t.split(SEP);
  return { ...unpack(parts.slice(0, 5).join(SEP)), key: parts[5] as AlertKey };
}
/** Page-top banner wired to the live state. */
export function PageAlert({ k, name, onGo }: { k: AlertKey | AlertKey[]; name: string; onGo?: (page: string) => void }) {
  const a = useAlert(k);
  return <AlertBanner info={a} name={name} onGo={onGo} />;
}

/** Small animated picture for each alert word. The shape differs as well as the colour, so it never relies on colour alone. */
export function AlertGlyph({ level, size = 16 }: { level: AlertLevel; size?: number }) {
  const c = ALERT_HEX[level];
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false } as const;
  if (level === 'running') return (
    <svg {...common} className="al-glyph al-g-running"><circle cx="12" cy="12" r="9" fill="none" stroke={c} strokeOpacity=".25" strokeWidth="3" /><path className="al-spin" d="M12 3a9 9 0 0 1 9 9" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" /><circle cx="12" cy="12" r="2.6" fill={c} className="al-beat" /></svg>
  );
  if (level === 'stuck') return (
    <svg {...common} className="al-glyph al-g-stuck"><g className="al-flip"><path d="M6 3h12v3.5L13.5 12l4.5 5.5V21H6v-3.5L10.5 12 6 6.5z" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" /><path d="M8.5 19h7l-3.5-4z" fill={c} /><circle className="al-sand" cx="12" cy="9" r="1.2" fill={c} /></g></svg>
  );
  if (level === 'error') return (
    <svg {...common} className="al-glyph al-g-error"><g className="al-shake"><path d="M12 2.5 22 20.5H2z" fill={c} fillOpacity=".18" stroke={c} strokeWidth="2" strokeLinejoin="round" /><path d="M12 9v5" stroke={c} strokeWidth="2.4" strokeLinecap="round" /><circle cx="12" cy="17" r="1.4" fill={c} /></g></svg>
  );
  if (level === 'attention') return (
    <svg {...common} className="al-glyph al-g-attention"><circle className="al-ring al-ring1" cx="12" cy="12" r="6" fill="none" stroke={c} strokeWidth="1.6" /><circle className="al-ring al-ring2" cx="12" cy="12" r="6" fill="none" stroke={c} strokeWidth="1.6" /><g className="al-bounce"><circle cx="12" cy="12" r="8.5" fill={c} fillOpacity=".18" stroke={c} strokeWidth="2" /><path d="M12 7.5v5.5" stroke={c} strokeWidth="2.4" strokeLinecap="round" /><circle cx="12" cy="16.5" r="1.3" fill={c} /></g></svg>
  );
  return <svg {...common} className="al-glyph"><circle cx="12" cy="12" r="3.2" fill={c} fillOpacity=".7" /></svg>;
}

/** Pill with the animated glyph and the alert word. Idle parts show a quiet dot and no word unless `showIdle`. */
export function AlertBadge({ info, compact = false, showIdle = false, name }: { info: AlertInfo; compact?: boolean; showIdle?: boolean; name?: string }) {
  if (info.level === 'idle' && !showIdle) return null;
  const word = ALERT_WORD[info.level];
  return (
    <span className={`al al-${info.level}${compact ? ' is-compact' : ''}`} role="status" aria-label={`${name ? name + ': ' : ''}${word}. ${info.label}. ${info.detail}`} title={`${word} — ${info.label}: ${info.detail}`}>
      <AlertGlyph level={info.level} size={compact ? 14 : 16} />
      {!compact && <span className="al-word">{word}</span>}
      {!compact && info.level !== 'idle' && <span className="al-label">{info.label}</span>}
    </span>
  );
}

/** Wide animated strip for the top of an instrument page: says what is wrong (or busy) and how to fix it. */
export function AlertBanner({ info, name, onGo }: { info: AlertInfo; name: string; onGo?: (page: string) => void }) {
  if (info.level === 'idle') return null;
  return (
    <div className={`al-banner al-b-${info.level}`} role="status" aria-live="polite" data-alert-level={info.level}>
      <span className="al-b-glyph"><AlertGlyph level={info.level} size={30} /></span>
      <div className="al-b-text">
        <div className="al-b-title"><b>{ALERT_WORD[info.level]}</b><span>{name} · {info.label}</span></div>
        <div className="al-b-detail">{info.detail}{info.fix ? <em> Fix: {info.fix}</em> : null}</div>
      </div>
      {info.page && onGo && <button type="button" className="al-b-go" onClick={() => onGo(info.page!)}>Take me there</button>}
      <span className="al-b-bar" aria-hidden="true" />
    </div>
  );
}

/** Row of live counters for the status strip: how many parts are erroring, stuck, need attention or are running. */
export function AlertStrip({ state, onOpen }: { state: any; onOpen: () => void }) {
  const { counts, items } = summarizeAlerts(state);
  const levels: AlertLevel[] = ['error', 'stuck', 'attention', 'running'];
  const total = levels.reduce((n, l) => n + counts[l], 0);
  const names = (l: AlertLevel) => items.filter(i => i.level === l).map(i => `${i.name}: ${i.label}`).join('; ');
  return (
    <button type="button" className="al-strip" onClick={onOpen} aria-label={total ? `Alerts: ${levels.filter(l => counts[l]).map(l => `${counts[l]} ${ALERT_WORD[l]}`).join(', ')}. Open the lab overview.` : 'No alerts. Open the lab overview.'} title={total ? levels.filter(l => counts[l]).map(l => `${ALERT_WORD[l]}: ${names(l)}`).join('\n') : 'Nothing running, stuck or in error'}>
      {total === 0 ? <span className="al-strip-none"><AlertGlyph level="idle" size={12} /> All quiet</span> : levels.filter(l => counts[l]).map(l => (
        <span key={l} className={`al-chip al-${l}`}><AlertGlyph level={l} size={13} /><b>{counts[l]}</b><span>{ALERT_WORD[l]}</span></span>
      ))}
    </button>
  );
}

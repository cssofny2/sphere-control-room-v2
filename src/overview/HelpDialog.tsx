import React, { useEffect, useRef } from 'react';
import { Info, X } from 'lucide-react';
import './overview.css';
import { getHelp, type ResolvedHelp } from './overviewHelp';

type Props = {
  entry: ResolvedHelp;
  onClose: () => void;
  onOpen: (key: string) => void;
};

// Plain-English help overlay used by every "?" in the app. Older glossary entries
// only have a title and description; overview entries can add why/tip/related/tech.
export default function HelpDialog({ entry, onClose, onOpen }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dlgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      previous?.focus?.();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !dlgRef.current) return;
    const items = Array.from(dlgRef.current.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled'));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="ov-dlg-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dlgRef} className="ov-dlg" role="dialog" aria-modal="true" aria-labelledby="ov-dlg-title" onKeyDown={onKeyDown}>
        <div className="ov-dlg-h">
          <span><Info size={15} aria-hidden="true" /> What does this mean?</span>
          <button ref={closeRef} type="button" className="ov-dlg-x" onClick={onClose} aria-label="Close help"><X size={16} aria-hidden="true" /></button>
        </div>
        <div className="ov-dlg-b">
          <h3 id="ov-dlg-title">{entry.title}</h3>
          <p>{entry.desc}</p>
          {entry.why && <div className="ov-note"><b>Why it matters</b><p>{entry.why}</p></div>}
          {entry.tip && <div className="ov-note is-tip"><b>Try it</b><p>{entry.tip}</p></div>}
          {entry.tech && <div className="ov-note is-tech"><b>Technical detail</b><p>{entry.tech}</p></div>}
          {entry.related && entry.related.length > 0 && (
            <div>
              <div className="ov-note" style={{ border: 0, background: 'none', padding: 0, marginBottom: 6 }}><b>Related</b></div>
              <div className="ov-related">
                {entry.related.map(k => <button key={k} type="button" onClick={() => onOpen(k)}>{getHelp(k).title}</button>)}
              </div>
            </div>
          )}
        </div>
        <div className="ov-dlg-f">
          <button type="button" className="ov-btn is-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}

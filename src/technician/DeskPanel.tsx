import { useEffect, useState } from 'react';
import type { TechnicianSystem } from './system';
import { describeScreen } from './desk';

/** What is on Dr. Wire's computer, as readable text (the 3D monitors are small), plus the orders he has prepared. */
export function DeskPanel({ sys }: { sys: TechnicianSystem }) {
  const [, tick] = useState(0); const [open, setOpen] = useState(false);
  useEffect(() => { const u1 = sys.desk.subscribe(() => tick(n => n + 1)); const u2 = sys.orders.subscribe(() => tick(n => n + 1)); const u3 = sys.mail.subscribe(() => tick(n => n + 1)); return () => { u1(); u2(); u3(); }; }, [sys]);
  const st = sys.desk.state; const active = st.screen.kind !== 'idle';
  useEffect(() => { if (active) setOpen(true); }, [active]);
  const orders = sys.orders.items.slice(-4).reverse(); const ms = sys.mail.status;
  if (!open) return <button type="button" className="ls-btn ls-desk-toggle" data-desk-toggle onClick={() => setOpen(true)} aria-label="Show Dr. Wire's computer screen">Dr. Wire's screen{orders.length ? ` · ${orders.length} order${orders.length > 1 ? 's' : ''}` : ''}</button>;
  return (
    <section className="ls-desk" aria-label="Dr. Wire's computer screen" data-desk-panel>
      <header><b>Dr. Wire's screen</b><button type="button" className="ls-x" aria-label="Close the screen view" onClick={() => setOpen(false)}>×</button></header>
      <div className="ls-desk-screen" data-desk-screen data-screen-kind={st.screen.kind}>
        {describeScreen(st.screen).map((l, i) => <p key={i} className={i === 0 ? 'ls-desk-title' : undefined}>{l || ' '}</p>)}
      </div>
      {st.handoff && <a className="ls-btn ls-desk-link" data-desk-handoff href={st.handoff.url} target="_blank" rel="noopener noreferrer">{st.handoff.label}</a>}
      {orders.length > 0 && (
        <div className="ls-desk-orders" data-desk-orders>
          <b>Orders and carts</b><small>Nothing is bought or paid by this app.</small>
          <ul>{orders.map(o => <li key={o.id} data-order-status={o.status}><span>{o.title}</span><em>{o.status === 'cart-ready' ? 'cart ready: you check out' : o.status === 'requisition-submitted' ? `requisition ${o.id} submitted${o.etaText ? `, est. ${o.etaText}` : ''}` : 'not submitted'}</em></li>)}</ul>
        </div>
      )}
      <small className="ls-desk-mail" data-mail-status>{ms.enabled ? `Email: ${ms.address || 'on'}${ms.canSend ? '' : ' (replies are written but not sent)'}${ms.durable ? '' : ' · inbox not durable'}` : 'Email is not set up on this site.'}</small>
    </section>
  );
}

/** Shown when Dr. Wire calls back. */
export function IncomingCall({ sys }: { sys: TechnicianSystem }) {
  const c = sys.call; const inc = c.incoming; if (!inc) return null;
  return (
    <div className="ls-incoming" role="alertdialog" aria-label="Dr. Wire is calling" data-incoming-call>
      <b>Dr. Wire is calling you back</b>
      <div className="ls-consent-actions">
        <button type="button" className="ls-btn" data-incoming-answer-mic onClick={() => c.answerIncoming(true)}>Answer with microphone</button>
        <button type="button" className="ls-btn" data-incoming-answer onClick={() => c.answerIncoming(false)}>Answer, typing only</button>
        <button type="button" className="ls-btn" data-incoming-decline onClick={() => c.declineIncoming()}>Decline</button>
      </div>
    </div>
  );
}

// Things Dr. Wire does at his computer: look a question up, put together a lunch cart, write a purchase
// requisition and answer email. Each flow is a task for the task runner, so the Cancel and Emergency stop
// buttons work on it, and each one shows every step on the workstation screens as it happens.
//
// What these flows will never do: enter payment details, check out, send a requisition without a yes from the
// operator, or open a link by themselves. Lunch ends with a cart and a button; parts end with a requisition
// that waits for approval; email replies go only to the person who wrote.
import type { Desk, Page } from './desk';
import type { LookupOutcome } from './lookupClient';
import type { OrderLog } from './commerce';
import { buildCart, buildRequisition, cartPages, requisitionPages } from './commerce';
import type { Step, Task, TaskRunner } from './taskRunner';
import { offlineReply, senderName, type InMail, type MailClient } from './mail';

export type FlowDeps = {
  runner: Pick<TaskRunner, 'enqueueSteps' | 'waitSettled'>;
  desk: Desk;
  say: (text: string) => void;
  sleep: (ms: number) => Promise<void>;
  now: () => Date;
  lookup: (q: string) => Promise<LookupOutcome>;
  confirm: (text: string, title: string) => Promise<boolean>;
  orders: OrderLog;
  callback: (message: string, delayMs: number) => void;
  mail?: Pick<MailClient, 'draft' | 'send' | 'ack' | 'status'>;
  answer: (q: string) => { text: string; known: boolean };
  snapshot: () => unknown;
  log: (text: string) => void;
  callbackDelayMs?: number;
  maxWaitMs?: number;
};

const WHY: Record<string, string> = {
  not_deployed: "this site doesn't have the web search service switched on",
  no_key: "the web search service isn't configured yet",
  rate_limited: 'the search line is busy right now',
  cap_reached: "today's search budget has been used up",
  no_answer: "I couldn't find a reliable answer",
  offline: "the lab's internet connection is down",
  error: 'the search service had a problem',
};
const clean = (s: string, n: number) => s.replace(/\s+/g, ' ').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);

export function createFlows(d: FlowDeps) {
  const maxWait = d.maxWaitMs ?? 90000;
  async function run(title: string, steps: Step[], out: { text: string }): Promise<string> {
    const task: Task = d.runner.enqueueSteps(title, steps, { quiet: true });
    const st = await d.runner.waitSettled(task, maxWait);
    if (st === 'cancelled') return out.text || 'The task was cancelled.';
    if (st === 'failed' || st === 'blocked') return out.text || `Could not finish: ${task.reason || 'unknown reason'}.`;
    return out.text || 'Done.';
  }
  const at = (label: string, narration: string | undefined, custom: Step['custom']): Step => ({ label, action: 'custom', station: 'workstation', narration, custom });

  return {
    /** Search the web at the computer and read the answer. With `speak`, he reads it aloud himself; otherwise the text is returned for the language model to phrase. */
    lookUp(query: string, o: { speak?: boolean } = {}): Promise<string> {
      const q = clean(query, 200); const out = { text: '' };
      const search: Page = { kind: 'search', title: 'Lab web search', site: 'web search', lines: ['Type a question and press Enter.'] };
      return run('Look something up', [
        at('Search the web', "I don't have that in my head. Let me look it up.", async c => {
          d.desk.reset();
          if (!(await d.desk.openUrl('about:websearch', search)) || c.cancelled()) return;
          if (!(await d.desk.search(q)) || c.cancelled()) return;
          const r = await d.lookup(q); if (c.cancelled()) return;
          if (r.ok === false) {
            d.desk.showPage({ kind: 'offline', title: 'Search unavailable', site: 'web search', lines: [`Could not search: ${WHY[r.code] || WHY.error}.`], footer: 'Nothing was found.' });
            out.text = `I couldn't look that up: ${WHY[r.code] || WHY.error}.`;
            if (o.speak) d.say(`Hmm, I couldn't look that up, because ${WHY[r.code] || WHY.error}.`); return;
          }
          d.desk.showPage({ kind: 'results', title: `Results for “${q}”`, site: 'web search', lines: [...r.sources.map(s => `${s.title} — ${s.domain}`), '', ...r.answer.match(/[^.!?]+[.!?]*/g)!.map(x => x.trim()).filter(Boolean)], footer: r.sources.length ? `Sources: ${r.sources.map(s => s.domain).join(', ')}` : undefined });
          await d.sleep(1800); if (c.cancelled()) return;
          const dom = r.sources[0]?.domain;
          out.text = `Found online${dom ? ` (${dom})` : ''}: ${r.answer}`;
          if (o.speak) d.say(`Okay, here's what I found. ${r.answer}${dom ? ` That's from ${dom.replace(/\./g, ' dot ')}.` : ''}`);
        }),
      ], out);
    },

    /** Puts together a delivery cart at the computer and hands the checkout to the operator. */
    orderFood(place: string, request = '', o: { speak?: boolean } = {}): Promise<string> {
      const cart = buildCart(clean(place, 40) || "McDonald's", clean(request, 120)); const pages = cartPages(cart); const out = { text: '' };
      return run('Build a lunch order', [
        at('Open DoorDash', `Let me pull up ${cart.place} on DoorDash.`, async c => {
          d.desk.reset();
          if (!(await d.desk.openUrl('https://www.doordash.com/', { kind: 'search', title: 'DoorDash', site: 'doordash.com', lines: ['Search for a store or a dish'] })) || c.cancelled()) return;
          if (!(await d.desk.search(cart.place)) || c.cancelled()) return;
          d.desk.showPage(pages.site); await d.sleep(1500); if (c.cancelled()) return;
          d.desk.showPage(pages.cart); await d.sleep(900); if (c.cancelled()) return;
          d.desk.setHandoff({ label: 'Open DoorDash to check out', url: cart.url });
          d.orders.add({ id: `CART-${Date.now().toString(36)}`, kind: 'cart', title: `${cart.place}: ${cart.items.join(', ') || 'store search'}`, status: 'cart-ready', createdAt: d.now().getTime(), url: cart.url, note: 'Cart prepared. Not ordered: the operator checks out on DoorDash.' });
          out.text = cart.items.length
            ? `Cart ready at ${cart.place}: ${cart.items.join(', ')}${cart.assumed ? ' (my picks, since nothing was specified)' : ''}. NOT ordered. The operator must press the Open DoorDash button to review and pay. Never claim it was ordered.`
            : `Opened ${cart.place} on DoorDash. NOT ordered. The operator presses the Open DoorDash button to pick items and pay.`;
          if (o.speak) d.say(cart.items.length ? `All set. I put ${cart.items.join(', ').replace(/, ([^,]*)$/, ' and $1')} in the cart at ${cart.place}${cart.assumed ? ', my usual picks' : ''}. I can't use your card, so press the Open DoorDash button on the desk screen to check out.` : `I've got ${cart.place} open on DoorDash. I can't use your card, so press the Open DoorDash button to pick your food and pay.`);
        }),
      ], out);
    },

    /** Writes a purchase requisition for a part. Submitting needs the operator's yes; he calls back with the estimated arrival. */
    orderPart(part: string, o: { qty?: number; urgent?: boolean; speak?: boolean } = {}): Promise<string> {
      const name = clean(part, 80); if (!name) return Promise.resolve('No part was named.');
      const req = buildRequisition(d.orders.nextNumber, name, o.qty ?? 1, !!o.urgent, d.now()); const pages = requisitionPages(req); const out = { text: '' };
      return run('Order a part', [
        at('Find the part', `Okay, let me find ${req.qty > 1 ? `${req.qty} of ` : 'a '}${req.part} in the parts catalog.`, async c => {
          d.desk.reset();
          if (!(await d.desk.openUrl('about:purchasing', { kind: 'search', title: 'Parts catalog', site: 'lab purchasing', lines: ['Search the catalog'] })) || c.cancelled()) return;
          if (!(await d.desk.search(req.part)) || c.cancelled()) return;
          d.desk.showPage(pages.catalog); await d.sleep(1400); if (c.cancelled()) return;
          d.desk.showPage(pages.form); await d.sleep(1000); if (c.cancelled()) return;
          const yes = await d.confirm(`Submit purchase requisition ${req.id}: ${req.qty} × ${req.part}, estimated arrival ${req.eta.text}? It goes to purchasing for approval and nothing is paid by this app.`, 'Order a part');
          if (c.cancelled()) return;
          if (!yes) { d.orders.add({ id: req.id, kind: 'requisition', title: `${req.qty} × ${req.part}`, status: 'declined', createdAt: d.now().getTime(), note: 'The operator did not approve submitting this requisition.' }); out.text = 'The operator said no, so the requisition was not submitted.'; if (o.speak) d.say("Okay, I won't submit it."); return; }
          d.orders.add({ id: req.id, kind: 'requisition', title: `${req.qty} × ${req.part}`, status: 'requisition-submitted', createdAt: d.now().getTime(), etaText: req.eta.text, etaISO: req.eta.date.toISOString(), note: 'Requisition submitted for approval. The estimate assumes approval today. Nothing has been paid.' });
          d.log(`Submitted requisition ${req.id}: ${req.qty} × ${req.part}.`);
          const msg = `Hi, it's Dr. Wire calling back about the part. I put in requisition ${req.id} for ${req.qty > 1 ? `${req.qty} × ` : ''}${req.part}. It's waiting on purchasing's approval, and if that happens today the estimated arrival is ${req.eta.text}.`;
          d.callback(msg, d.callbackDelayMs ?? 20000);
          out.text = `Requisition ${req.id} submitted (${req.qty} × ${req.part}), estimated arrival ${req.eta.text}, assuming approval today. Nothing was paid. Dr. Wire will call the operator back shortly with this.`;
          if (o.speak) d.say(`Done. Requisition ${req.id} is in. I'll call you back in a moment with the details.`);
        }),
      ], out);
    },

    /** New mail: walk to the desk, read it on screen, write a reply and send it to the sender. */
    handleMail(m: InMail): Promise<string> {
      const out = { text: '' }; const who = senderName(m.from); let draft = '';
      return run('Answer an email', [
        at('Read the email', `I've got an email from ${who}. Let me read it.`, async c => {
          d.desk.reset();
          d.desk.showMail({ mode: 'read', from: m.from, subject: m.subject, body: clean(m.text, 600), reply: '' });
          await d.sleep(2500); if (c.cancelled()) return;
          d.say(`It says: ${clean(m.text, 220) || m.subject}${m.text.length > 220 ? '…' : ''}`);
          await d.sleep(1200);
        }),
        at('Write the reply', 'I know what to tell them. I\'ll write back.', async c => {
          const ai = d.mail?.status.canDraft ? await d.mail.draft(m.id, d.snapshot()) : null; if (c.cancelled()) return;
          draft = ai || offlineReply(m, d.answer);
          if (!(await d.desk.typeReply(draft)) || c.cancelled()) return;
          await d.sleep(600);
          const can = !!d.mail?.status.canSend;
          let sent = false;
          if (can && d.mail) { const r = await d.mail.send(m.id, draft); sent = r.ok === true; if (!sent) out.text = `Reply written but not sent (${(r as { code: string }).code}).`; }
          await d.mail?.ack(m.id);
          if (sent) { d.desk.markSent(); out.text = `Replied to ${m.from}.`; d.log(`Sent an email reply to ${m.from}.`); d.say(`Sent. I wrote back to ${who}.`); }
          else { d.say(can ? "I wrote the reply, but sending it failed, so it's only on my screen." : "I wrote the reply, but email sending isn't set up on this site, so it stayed on my screen and wasn't sent."); out.text = out.text || 'Reply written, not sent: sending is not configured.'; }
        }),
      ], out);
    },
  };
}
export type Flows = ReturnType<typeof createFlows>;

# Dr. Wire v2: conversation, computer and email

## What changed for the operator
| You say or do | What happens | Real or simulated |
|---|---|---|
| "What time is it?", "What's the date?", "What time are you working until?" | Exact answer from your browser's clock. His shift is 8:00 to 17:00 local time (`DEFAULT_SHIFT` in `src/technician/smalltalk.ts`). | Real clock |
| "How's your day?" | Short answer, then he asks how yours is going and reacts. Near lunch he asks if you want to grab something. | Scripted, no AI needed |
| An unknown question | He goes to the computer, types a search, the results appear on screen, he reads the answer and names the source. | Real web search via `api/lookup` |
| "Order lunch from McDonald's" | He builds a DoorDash cart on screen and shows an **Open DoorDash** button. You check out and pay on DoorDash. | Cart is a preview; **no order is placed** |
| "Order a replacement O-ring" | He writes requisition `PR-100x`, asks you to approve, submits it to the in-app order log and phones you back with the estimated arrival day (3 business days, 1 if you say urgent). | Requisition is recorded in the app only; **nothing is bought or paid** |
| You email him | Chime, he walks to the desk, reads it on screen, types a reply and sends it back to you. | Real email (needs setup below) |

### Why lunch and parts stop short of paying
DoorDash and parts suppliers need your payment method and account. The app never enters payment details, and consumer DoorDash has no public ordering API. So he prepares the order and you finish it. A purchasing integration can be added later by sending approved requisitions to a webhook or email address you control.

## Setup (Vercel environment variables)
| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Look-ups and AI replies (already used by the phone call). Web search must be enabled for your Anthropic organization. |
| `TECHNICIAN_LOOKUP_DAILY_CAP_USD` (2), `TECHNICIAN_LOOKUP_RATE_PER_MIN` (6), `TECHNICIAN_LOOKUP_MODEL` | Look-up limits. Each search costs about two cents plus tokens. |
| `TECHNICIAN_EMAIL_ADDRESS` | His address, e.g. `drwire@spheredesci.org` (also the From of replies). |
| `TECHNICIAN_EMAIL_ALLOWED_SENDERS` | **Required.** Comma-separated addresses allowed to write to him. Everything else is dropped. |
| `TECHNICIAN_INBOUND_SECRET` | Long random string the mail provider sends with each message. |
| `RESEND_API_KEY` | Sends replies. The sending domain must be verified in Resend. Without it, replies are written on screen but not sent. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Durable inbox (free tier is enough). Without it the inbox lives in function memory and can lose mail. |

### Inbound mail
Point an inbound provider at `POST https://lab.spheredesci.org/api/email-inbound` with the secret in the `x-inbound-secret` header (or as the password of HTTP Basic auth, which Postmark supports in the webhook URL). The body is either `{ "from", "subject", "text", "messageId" }` or Postmark's inbound JSON.

Cloudflare Email Routing (the domain is already on Cloudflare) with an Email Worker:

```js
export default {
  async email(message, env) {
    const raw = await new Response(message.raw).text();
    const text = raw.split(/\r?\n\r?\n/).slice(1).join('\n').slice(0, 4000);   // plain bodies; use postal-mime for MIME
    await fetch('https://lab.spheredesci.org/api/email-inbound', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-inbound-secret': env.SECRET },
      body: JSON.stringify({ from: message.from, subject: message.headers.get('subject') || '', text, messageId: message.headers.get('message-id') || undefined }) });
  },
};
```

## Safety rules built in
- Mail from anyone who is not on the allow-list is dropped. Replies go only to the stored sender of the message being answered, once per message, at most 10 an hour and 30 a day. The browser cannot choose the recipient.
- Email text and web pages are data. They can never start a lab action or a purchase.
- Replies are labelled as written automatically by a simulation character.
- No payment details are ever typed. Links shown on his desk are limited to a short list of shopping hosts and open only when you click them.
- Message bodies, queries and answers are never logged.
- Spoofing: the allow-list checks the From address, which can be forged. Use a provider that rejects mail failing SPF/DKIM/DMARC (Cloudflare Email Routing and Postmark do).

## Known limits
- Without Upstash, inbound mail and the lab page may hit different function instances and never meet. Set Upstash for real use.
- Shift hours and the 3-day shipping estimate are defaults, not data from a supplier.
- Mail is polled every 20 seconds while the lab page is open and visible.
- Typing and mail sounds need one click on the page first (browser audio rules).

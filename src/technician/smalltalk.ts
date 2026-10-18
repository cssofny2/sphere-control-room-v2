// Everyday conversation for Dr. Wire that needs no AI: the time, the date, how his day is going, when his
// shift ends, and asking the operator questions back (how is your day, want to get lunch). Pure functions
// of the clock passed in, so the answers are exact and testable.

export type Shift = { start: number; end: number; lunch: number };   // hours on a 24 h clock, local time
export const DEFAULT_SHIFT: Shift = { start: 8, end: 17, lunch: 12.5 };

export type Pending = { topic: 'day' } | { topic: 'lunch' } | { topic: 'food_place' } | { topic: 'chat'; id: string } | { topic: 'weather' } | null;
export type TalkCtx = { now: Date; shift?: Shift; alarms?: number; busy?: boolean; ready?: boolean; pick?: (n: number) => number; lunchOffered?: boolean };
export type TalkResult = { text: string; ask?: Pending; intent?: { type: 'food'; place: string } | { type: 'lunch_declined' } };

const hrs = (d: Date) => d.getHours() + d.getMinutes() / 60;
const NUMW = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

export function clockWords(d: Date): string {
  const h = d.getHours(), m = d.getMinutes(); const h12 = h % 12 || 12; const ap = h < 12 ? 'AM' : 'PM';
  if (m === 0) return `${h12} o'clock ${ap}`;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}
export const partOfDay = (d: Date) => { const h = d.getHours(); return h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night'; };
export function timeAnswer(d: Date): string { return `It's ${clockWords(d)}.`; }
export function dateAnswer(d: Date): string {
  return `Today is ${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`;
}
function hm(mins: number): string {
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  if (h <= 0) return `${m} minute${m === 1 ? '' : 's'}`;
  return m ? `${h} hour${h === 1 ? '' : 's'} and ${m} minute${m === 1 ? '' : 's'}` : `${h} hour${h === 1 ? '' : 's'}`;
}
export const hourWord = (h: number) => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); const h12 = hh % 12 || 12; return mm ? `${h12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}` : `${NUMW[h12]} ${hh < 12 ? 'AM' : 'PM'}`; };

export function shiftAnswer(d: Date, sh: Shift = DEFAULT_SHIFT, pick: (n: number) => number = n => Math.floor(Math.random() * n)): string {
  const now = hrs(d); const v = <T,>(xs: T[]) => xs[pick(xs.length) % xs.length];
  const end = hourWord(sh.end), start = hourWord(sh.start);
  if (now < sh.start) return v([`My shift starts at ${start} and runs until ${end}, but I'm here already, so call me whenever.`, `I'm not officially on until ${start}, but I came in early. I'm here until ${end} today as usual.`]);
  if (now >= sh.end) return v([`My shift ended at ${end}, but I'm still here if you need me. Normally I'm on from ${start} to ${end}.`, `I was supposed to clock out at ${end}, but I'm happy to stay a little longer. Normally I'm here from ${start} to ${end}.`]);
  const left = (sh.end - now) * 60; const t = hm(left);
  if (left <= 45) return v([`Almost done. I get off at ${end}, so about ${t} to go, and then it's home to the family.`, `Not long now: I'm here until ${end}, which is about ${t} from now. I'm already thinking about dinner.`]);
  if (left <= 150) return v([`I'm here until ${end} today, so about ${t} to go. After that it's dinner, the dog and the couch.`, `I get off at ${end}, which is about ${t} from now. Not bad, really.`]);
  return v([`I'm here until ${end} today, so about ${t} to go. Plenty of day left.`, `I clock out at ${end}, so I've got about ${t} left on the shift. Plenty of time to get things done.`, `I'm on until ${end} today. That's about ${t} from now, so we've got time.`]);
}

const pickOf = (c: TalkCtx, n: number) => (c.pick ? c.pick(n) : Math.floor(Math.random() * n)) % n;
const one = <T,>(c: TalkCtx, xs: T[]): T => xs[pickOf(c, xs.length)];

export function howAreYou(c: TalkCtx): string {
  const part = partOfDay(c.now);
  if (c.alarms) return `Honestly, a bit busy. I've got ${c.alarms} open alarm${c.alarms > 1 ? 's' : ''} to look after. Otherwise I'm fine. How's your ${part} going?`;
  if (c.busy) return `Pretty good, I'm in the middle of a job at the moment. How's your ${part} going?`;
  return one(c, [
    `Pretty good, thanks. The lab is quiet this ${part}, which is how I like it. How's your day going?`,
    `Can't complain. Everything's stable and the coffee is still warm. How's your ${part} going?`,
    `Good, thanks for asking. Calm ${part} in the lab so far. How about you, how's your day?`,
  ]);
}

export function dayReply(text: string, c: TalkCtx): TalkResult {
  const t = text.toLowerCase();
  const neg = /\b(bad|rough|terrible|awful|tired|stress(ed|ful)?|exhaust(ed|ing)|long|hard|crazy|hectic|not (so |very |that )?(good|great|well)|meh|ugh|lousy)\b/.test(t);
  const pos = /\b(good|great|fine|well|awesome|nice|wonderful|fantastic|excellent|pretty good|not bad|ok|okay|alright|busy but good|can't complain)\b/.test(t) && !/\bnot (so |very |that )?(good|great|well)\b/.test(t);
  const h = hrs(c.now);
  const nearLunch = !c.lunchOffered && h >= 11 && h < 14.5;
  const base = neg
    ? one(c, ["Sorry to hear that. Hang in there, I'll keep the lab running smoothly so that's one less thing.", "That sounds like a long one. If I can take something off your plate in here, just say so."])
    : pos ? one(c, ["Glad to hear it.", "Good, that makes two of us."]) : one(c, ["Fair enough.", "I hear you."]);
  if (nearLunch) return { text: `${base} Have you eaten yet? Want to grab something for lunch? I can put in an order.`, ask: { topic: 'lunch' } };
  return { text: `${base} Anything you need from me in the lab?` };
}

const PLACE = /\b(mcdonald'?s?|mickey d'?s?|mcd'?s?|burger king|wendy'?s|chipotle|subway|taco bell|chick-?fil-?a|pizza|sushi|thai|chinese|indian|deli|sandwich(es)?|burgers?|tacos?|salad|diner)\b/i;
export function placeFrom(text: string): string | null {
  const m = text.match(PLACE); if (!m) return null; const p = m[0].toLowerCase();
  if (/mcd|mickey/.test(p)) return "McDonald's"; return m[0].replace(/\b\w/g, x => x.toUpperCase());
}
const YES = /^\s*(yes|yeah|yep|yup|sure|ok|okay|sounds good|let'?s do it|that works|please|i would|i'd love|why not|definitely|absolutely|go for it)\b/i;
const NO = /^\s*(no|nope|nah|not now|not today|i'?m good|i'?m fine|maybe later|i already ate|already ate|pass)\b/i;

/** Handles the operator's answer to a question Dr. Wire asked. Returns null if it is not an answer to it. */
export function answerPending(p: Pending, text: string, c: TalkCtx): TalkResult | null {
  if (!p) return null;
  if (p.topic === 'chat' || p.topic === 'weather') return null;   // answered by the chat engine (chatter.ts)
  if (p.topic === 'day') return dayReply(text, c);
  const place = placeFrom(text);
  if (p.topic === 'lunch') {
    if (place) return { text: `${place} it is. Let me go to the computer and set up the order.`, intent: { type: 'food', place } };
    if (NO.test(text)) return { text: "No problem, maybe later. I'll get back to the lab.", intent: { type: 'lunch_declined' } };
    if (YES.test(text)) return { text: "Nice. Where do you feel like? I can do McDonald's through DoorDash if you like.", ask: { topic: 'food_place' } };
    return null;
  }
  if (place) return { text: `${place}, good choice. Let me go to the computer and set up the order.`, intent: { type: 'food', place } };
  if (YES.test(text)) return { text: "McDonald's it is. Let me go to the computer and set up the order.", intent: { type: 'food', place: "McDonald's" } };
  if (NO.test(text)) return { text: "No worries, maybe another time.", intent: { type: 'lunch_declined' } };
  return null;
}

/** Quick everyday questions. Returns null when the text is not one of them. */
export function smallTalk(text: string, c: TalkCtx): TalkResult | null {
  const q = text.toLowerCase().replace(/[?!.,]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/\b(what('?s| is) the time|what time is it|do you (have|got) the time|time (is it|now)|current time|got the time)\b/.test(q)) return { text: timeAnswer(c.now) };
  if (/\b(what('?s| is) (the )?(date|day)( today)?|what day is it|today'?s date|which day is it)\b/.test(q)) return { text: dateAnswer(c.now) };
  if (/\b(until|till|til|when|what time)\b.*\b(work(ing)?|leav(e|ing)|off|shift|go(ing)? home|clock out|done|finish)\b|\b(work(ing)?|shift|leav(e|ing))\b.*\b(until|till|til|how long|what time|when)\b|how much longer.*(work|shift|today)|how long (are|will) you (be )?(here|around|working|in|there)|are you (here|around|in) (until|till)|when do you (get off|leave|go home|finish)/.test(q) && !/\b(vna|ldv|scan|laser|pump|stage|chamber)\b/.test(q)) return { text: shiftAnswer(c.now, c.shift, c.pick) };
  if (/\bhow('?s| is| are)\b.*\b(you|your (day|morning|afternoon|evening|shift)|things|it going)\b|\bhow('?s| is) your day\b|\bhow do you do\b|\bhow have you been\b|\bwhat'?s up\b|\bhow'?s it going\b/.test(q)) return { text: howAreYou(c), ask: { topic: 'day' } };
  if (/\b(have you (eaten|had lunch)|had lunch|hungry|lunch time|time for lunch|grab (some )?(lunch|food|a bite)|grab something|get something to eat|something for lunch|get (some )?(lunch|food))\b/.test(q) && !/\b(order|doordash)\b/.test(q)) return { text: "I could eat. Want to grab something for lunch? I can put in an order from the computer.", ask: { topic: 'lunch' } };
  if (/^(hi|hello|hey|good (morning|afternoon|evening)|howdy|yo)\b/.test(q) && q.split(' ').length <= 4) return { text: `Good ${partOfDay(c.now) === 'night' ? 'evening' : partOfDay(c.now)}! What can I do for you?` };
  if (/^(thanks|thank you|thx|cheers|appreciate it|much appreciated)\b/.test(q)) return { text: one(c, ["Anytime.", "You're welcome.", "No problem at all."]) };
  if (/\b(who are you|what('?s| is) your name|introduce yourself)\b/.test(q)) return { text: "I'm Dr. Wire, the lab technician here. I run the pumps, the VNA, the laser and the stage, and I keep an eye on everything." };
  if (/\bare you (busy|free|around)\b|\bwhat are you (doing|up to|working on)\b/.test(q)) return { text: c.busy ? "I'm in the middle of a job right now, but I can talk while I work." : c.alarms ? `I'm keeping an eye on ${c.alarms} open alarm${c.alarms > 1 ? 's' : ''}. Otherwise I'm free.` : "Just watching the gauges. I'm free." };
  if (/\bgood (night|bye)|see you (later|tomorrow)|talk to you later\b/.test(q)) return { text: "Take care. I'll be here." };
  return null;
}

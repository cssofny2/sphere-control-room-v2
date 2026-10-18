// Dr. Wire's everyday conversation engine. A table of topics (see chatBank*.ts) is matched against what the
// operator says; each topic has several differently worded answers, so he does not repeat himself, and many
// of them end by asking the operator something back, the way a person keeps a conversation going.
//
// Pure and deterministic given an injectable picker, so it is tested in Node. Nothing here is stored beyond
// the running call. Lab questions never reach this file: the guard below hands anything about the instruments
// to the knowledge base or the language model.
import type { Shift } from './smalltalk';

export type Cat = 'work' | 'pay' | 'about' | 'family' | 'likes' | 'hobby' | 'feel' | 'social' | 'meta' | 'lab' | 'you' | 'world';
export type ChatCtx = { now: Date; shift?: Shift; alarms?: number; busy?: boolean; name?: string | null; pick?: (n: number) => number };
type Variants = string[] | ((c: ChatCtx) => string[]);
export type Topic = {
  id: string; cat: Cat; q: RegExp;
  /** Example phrasings. They document the topic and are checked by the tests against the matcher. */
  ex: string[];
  a: Variants;
  /** Things he may ask back after answering. */
  back?: string[];
  /** The topic may mention instruments (otherwise the lab-word guard skips it). */
  labOk?: boolean;
  /** The reply is a short back-channel ("cool", "wow") and only matches a whole short utterance. */
  ack?: boolean;
  /** Hand the operator's next message to this follow-up (weather asks for a city). */
  follow?: 'city';
};
export type ChatResult = {
  id: string; cat: Cat; text: string;
  ask?: { topic: 'chat'; id: string } | { topic: 'weather' };
};

export const norm = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9$%+\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
const LAB = /\b(vna|ldv|vibrometer|laser|pump|roughing|turbo|stage|chamber|pressure|torr|scan|vacuum|rubidium|clock lock|shutter|alarm|fault|calibrat\w*|sphere|copper|resonan\w*|faraday|isolation|thermal|setpoint|sweep|s11|record|records|breaker|interlock|requisition)\b/;
/**
 * People say "I'm", "I am" and "im" interchangeably, and speech recognition returns any of them. Topic patterns are
 * written with `i.?m`, `what.?s`, `don.?t` and the like; this widens each to also accept the spelled-out form.
 */
export function spoken(re: RegExp): RegExp {
  // Each word is preceded in the pattern text by \b, ( | ^ or a space, and followed by a non-letter.
  const rep = (src: string, from: string, to: string) => src.replace(new RegExp('(\\\\b|[(|^ ])' + from + '(?![a-z])', 'g'), (_m, p) => p + to);
  let src = re.source;
  for (const [f, t] of [
    ['don\\.\\?t', 'do(?:n| no)t'], ['dont', 'do(?:n| no)t'], ['didn\\.\\?t', 'did(?:n| no)t'], ['didnt', 'did(?:n| no)t'], ['doesn\\.\\?t', 'does(?:n| no)t'], ['doesnt', 'does(?:n| no)t'],
    ['isn\\.\\?t', 'is(?:n| no)t'], ['haven\\.\\?t', 'have(?:n| no)t'], ['havent', 'have(?:n| no)t'],
    ['i\\.\\?m', 'i(?: a)?m'], ['i\\.\\?ve', 'i(?: ha)?ve'], ['you\\.\\?re', 'you(?: a)?re'], ['we\\.\\?re', 'we(?: a)?re'],
    ['(what|that|it|how|where|who|there|here|when)\\.\\?s', '$2'],
  ] as [string, string][]) {
    if (t === '$2') src = src.replace(new RegExp('(\\\\b|[(|^ ])(what|that|it|how|where|who|there|here|when)\\.\\?s(?![a-z])', 'g'), (_m, p, w) => `${p}${w}(?: i)?s`);
    else src = rep(src, f, t);
  }
  return new RegExp(src, re.flags);
}
const rnd = (n: number) => Math.floor(Math.random() * n);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const SAFE_LOWER = /^(the|it|its|that|not|pretty|mostly|about|around|just|usually|probably|definitely|yes|no|a|an|my|most|every|nothing|sometimes|honestly|always|never|mine|nope|sure|three|four|five|two|one|six|seven|eight|nine|ten|forty|thirty|twenty|fifteen|twelve|eleven)\b/i;
const OPENERS = ['Hm, ', 'Well, ', 'Oh, ', 'Honestly, ', 'Let me think. ', 'Good question. ', 'Ha. '] as const;
const REPEAT = ['Like I said, ', 'Same as before: ', 'Still the same answer, ', 'As I mentioned, '] as const;
/** After a friendly detour he steers gently back to the lab, as a colleague would. */
const BACK_TO_WORK = ['Anyway, anything you need in the lab?', 'Anyway, what can I do for you?', 'Okay, back to work. What do you need?', 'Alright, what should we tackle?', ''] as const;

const KEYWORD_REACT: [RegExp, string[]][] = [
  [/\b(dog|dogs|puppy|puppies|retriever|labrador|poodle|beagle|terrier|shepherd|husky|bulldog|collie)\b/, ['Dogs are the best part of coming home.', 'Ha, I\'m a dog person myself.']],
  [/\bcats?\b|\bkitten/, ['Cats are great company. Very independent.', 'A cat, nice. They always know when you\'re busy.']],
  [/\b(kids?|son|daughter|children|baby|grandkids?)\b/, ['Kids keep you busy, don\'t they? In a good way.', 'That\'s wonderful. They grow up fast.']],
  [/\b(wife|husband|partner|girlfriend|boyfriend|fianc\w+)\b/, ['That\'s great. It helps to have someone to come home to.', 'Nice. Say hi from me.']],
  [/\bpizza\b/, ['Pizza is never the wrong answer.', 'Now I\'m hungry.']],
  [/\bcoffee\b/, ['Coffee, a person of culture.', 'Nothing beats a good cup first thing.']],
  [/\b(bills|sabres|football|hockey|baseball|basketball|soccer|game)\b/, ['Sports, nice. It always makes for good conversation.', 'Ha, I can talk sports all afternoon.']],
  [/\b(music|song|band|guitar|piano|concert)\b/, ['Good taste. Music makes a long day shorter.', 'Nice. I like to have something playing while a scan runs.']],
  [/\b(fish|fishing|hiking|camping|kayak\w*|bik(e|ing)|running|gym|golf)\b/, ['That sounds like a good way to clear your head.', 'Nice, getting outside is underrated.']],
  [/\b(travel|trip|vacation|beach|flight|holiday)\b/, ['A trip sounds wonderful right about now.', 'Take it. Time off is good for the brain.']],
  [/\b(sleep|slept|nap|bed)\b/, ['Sleep fixes more problems than people admit.', 'Rest is not optional, even for a lab.']],
  [/\b(movie|film|show|series|netflix|book|reading|novel)\b/, ['Good one. I\'m always looking for something new.', 'Nice. I\'ll add that to my list.']],
  [/\b(cook\w*|dinner|bak\w*|grill\w*|recipe)\b/, ['Home cooking beats takeout nearly every time.', 'That sounds good. I\'m taking notes.']],
  [/\b(garden\w*|yard|lawn|plants?)\b/, ['Gardening is patient work. I respect that.', 'Nice. Something that grows is satisfying.']],
  [/\b(video ?games?|gaming|xbox|playstation|nintendo)\b/, ['Ha, nice. A little gaming never hurt anybody.', 'Good way to unwind.']],
  [/\b(work|job|office|boss|meeting)\b/, ['Work has a way of filling the day.', 'I hear you, work is work.']],
];

export class Chatter {
  private used = new Map<string, number>();
  private offset = new Map<string, number>();
  private turn = 0; private lastBack = -99; private lastId = ''; private lastTurnOf = new Map<string, number>();
  private topics: Topic[];
  constructor(topics: Topic[]) { this.topics = topics.map(t => ({ ...t, q: spoken(t.q) })); }

  reset() { this.used.clear(); this.offset.clear(); this.turn = 0; this.lastBack = -99; this.lastId = ''; this.lastTurnOf.clear(); }
  get size() { return this.topics.length; }

  /** The topic a sentence belongs to, without producing a reply (used by the tests and the documentation). */
  match(text: string): Topic | null {
    const q = norm(text); if (!q) return null;
    const words = q.split(' ').length;
    for (const t of this.topics) {
      if (t.ack ? words > 4 : words > 22) continue;
      if (!t.labOk && !t.ack && LAB.test(q)) continue;
      if (t.q.test(q)) return t;
    }
    return null;
  }

  reply(text: string, c: ChatCtx): ChatResult | null {
    const t = this.match(text); if (!t) return null;
    const pick = c.pick ?? rnd;
    this.turn++;
    const vs = typeof t.a === 'function' ? t.a(c) : t.a;
    const n = this.used.get(t.id) ?? 0;
    if (!this.offset.has(t.id)) this.offset.set(t.id, pick(vs.length));
    let line = vs[(this.offset.get(t.id)! + n) % vs.length];
    const recent = this.lastId === t.id || (this.turn - (this.lastTurnOf.get(t.id) ?? -99)) <= 4;
    if (n > 0 && recent && !t.ack) line = REPEAT[pick(REPEAT.length)] + (SAFE_LOWER.test(line) ? lowerFirst(line) : line);
    else if (!t.ack && ['likes', 'about', 'family', 'hobby', 'feel', 'work'].includes(t.cat) && pick(100) < 22 && SAFE_LOWER.test(line) && line.length > 30) { const o = OPENERS[pick(OPENERS.length)]; line = o + (o.endsWith(', ') ? lowerFirst(line) : line); }
    this.used.set(t.id, n + 1); this.lastId = t.id; this.lastTurnOf.set(t.id, this.turn);
    const out: ChatResult = { id: t.id, cat: t.cat, text: line };
    if (t.follow === 'city') { out.ask = { topic: 'weather' }; return out; }
    const quiet = c.busy || (c.alarms ?? 0) > 0;
    if (t.back?.length && !quiet && this.turn - this.lastBack >= 3 && pick(100) < 60) {
      const b = t.back[pick(t.back.length)];
      out.text = `${line} ${b}`; out.ask = { topic: 'chat', id: t.id }; this.lastBack = this.turn;
    }
    return out;
  }

  /** What he says to the operator's answer to a question he asked back. Null when it is really a new request. */
  follow(text: string, c: ChatCtx): string | null {
    const q = norm(text); if (!q) return null;
    if (/^(what|why|how|when|where|who|which|can|could|would|will|do|does|is|are|please|run|start|stop|open|close|move|order|turn|set|go|pump|calibrate|scan|vent|home|capture|export|look|search|hang|bye|goodbye)\b/.test(q) || LAB.test(q)) return null;
    const pick = c.pick ?? rnd; this.turn++;
    const words = q.split(' ').length;
    let reaction = '';
    for (const [re, rs] of KEYWORD_REACT) if (re.test(q)) { reaction = rs[pick(rs.length)]; break; }
    if (!reaction) {
      const neg = /\b(bad|rough|terrible|awful|tired|stress\w*|exhaust\w*|sick|sad|hard|not (so |very |that )?(good|great|well)|meh|ugh|lousy|worse|worried|anxious)\b/.test(q);
      const pos = /\b(good|great|fine|well|awesome|nice|wonderful|fantastic|excellent|love|loved|fun|happy|excited|amazing|cool|yes|yeah|yep|sure)\b/.test(q);
      const none = /^(no|nope|nah|nothing|not really|none|not much|nothing much|nothing special)\b/.test(q);
      reaction = neg ? pick(2) ? 'That sounds like a lot. I hope it eases up soon.' : 'Sorry to hear that. Hang in there.'
        : none ? pick(2) ? 'Fair enough, sometimes quiet is the best plan.' : 'That\'s okay. Not everything needs a story.'
        : pos ? (words > 6 ? pick(2) ? 'That sounds really good. I\'m glad you told me.' : 'Nice, that\'s something to look forward to.' : pick(2) ? 'Nice.' : 'Good to hear.')
        : (words > 8 ? pick(2) ? 'Interesting, thanks for sharing that.' : 'Huh, I like that.' : pick(2) ? 'Fair enough.' : 'I hear you.');
    }
    const tail = BACK_TO_WORK[pick(BACK_TO_WORK.length)];
    return tail ? `${reaction} ${tail}` : reaction;
  }
}

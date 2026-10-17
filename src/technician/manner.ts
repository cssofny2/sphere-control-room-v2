// How Dr. Wire sounds like a person: not knowing something, being unsure, taking a moment to think, and
// knowing the operator's first name. Pure functions with an injectable picker so tests are exact.
// Nothing here is stored beyond the running page: the name lives in memory for the call, never on disk.

export type Pick = (n: number) => number;
const rnd: Pick = n => Math.floor(Math.random() * n);
const choose = <T,>(xs: readonly T[], pick: Pick = rnd, avoid?: string): T => {
  if (xs.length > 1 && avoid !== undefined) { const ys = xs.filter(x => String(x) !== avoid); if (ys.length) return ys[pick(ys.length) % ys.length]; }
  return xs[pick(xs.length) % xs.length];
};

// ——— not knowing ———
/** He has nothing on the subject and will go and look (or admits he cannot). */
const DONT_KNOW = [
  "Hmm, I don't know that one off the top of my head.",
  "You've got me there. I don't know.",
  "Honestly, I don't know. That's outside what I've got in my notes.",
  "Good question. I don't have an answer for that one.",
  "I'm drawing a blank on that, I don't know.",
  "Ooh, I don't know that. I'd be guessing, and I'd rather not.",
  "That's not something I know, I'm afraid.",
  "I wish I could tell you, but I don't know.",
  "Hm. No idea, to be honest. I don't want to make something up.",
  "I don't know. That's not in anything I've read for this lab.",
] as const;
/** Said just before he turns to the computer. */
const LOOK_UP_LEADS = [
  "I don't have that in my head. Let me look it up.",
  "Let me check on the computer, one second.",
  "Hold on, I'll search for that.",
  "Not sure. Give me a moment and I'll find out.",
  "Good question. Let me see what the web says.",
  "I'd only be guessing. Let me go look.",
  "Hang on, let me pull that up.",
  "Hmm, let me dig that up for you.",
] as const;
/** He has something, but is not sure it is right. Said before the answer. */
const UNSURE = [
  "I'm not completely sure, but here's what my notes say.",
  "Don't hold me to this one, but this is what I have.",
  "I could be wrong here, but this is the closest thing I've got.",
  "This might not be exactly what you're after, but it's what I know.",
  "I'm only partly sure about this, so double-check it.",
  "Not certain, but I think this is the answer.",
] as const;
/** Follow-ups after "I don't know". Each is true: unanswered questions really are written down for the team. */
const FOLLOW = [
  "I've written it down as an open question for the team.",
  "I'll flag it for the team so it gets answered.",
  "If you tell me more about what you're after, I can try narrowing it down.",
  "It's in my open-questions list now.",
] as const;
/** Fallback endings when he could not look anything up. */
const COULD_NOT_LOOK = [
  "Sorry, I couldn't find that out just now.",
  "I tried, but I came up empty.",
  "No luck on that one, I'm afraid.",
  "I couldn't get a reliable answer, and I won't guess.",
] as const;
const CLARIFY = [
  "Sorry, I didn't quite catch that. Could you say it again?",
  "I missed that. One more time?",
  "Say that again for me? I didn't get it.",
  "Could you rephrase that? I'm not sure what you're asking.",
] as const;
const THINKING = ['Hmm.', 'Let me think.', 'Okay, so.', 'Well.', 'Right.', 'Let me see.'] as const;

export const dontKnow = (pick?: Pick, avoid?: string) => choose(DONT_KNOW, pick, avoid);
export const lookUpLead = (pick?: Pick, avoid?: string) => choose(LOOK_UP_LEADS, pick, avoid);
export const followUp = (pick?: Pick) => choose(FOLLOW, pick);
export const unsureLead = (pick?: Pick) => choose(UNSURE, pick);
export const couldNotLookUp = (pick?: Pick) => choose(COULD_NOT_LOOK, pick);
export const clarify = (pick?: Pick) => choose(CLARIFY, pick);
export const thinking = (pick?: Pick) => choose(THINKING, pick);
export const UNCERTAINTY_COUNTS = { dontKnow: DONT_KNOW.length, lookUpLead: LOOK_UP_LEADS.length, unsure: UNSURE.length } as const;
/** True when a line is him admitting he does not know (used by tests and the log). */
export const sounds_uncertain = (t: string) => /\b(don'?t know|don'?t have an answer|no idea|not sure|not certain|not something i know|wish i could tell|drawing a blank|can'?t tell|couldn'?t find|came up empty|no luck|won'?t guess|only be guessing|be guessing)\b/i.test(t);

// ——— names ———
const NOT_NAMES = new Set(('yes no yeah yep nope ok okay sure fine good great well bad busy tired here there hello hi hey thanks thank please sorry what who why how when where which you me i we it they he she him her this that something nothing anything everything nobody someone the a an and or but not the just really very pretty doing going back calling operator technician lab dr doctor sir madam maam ma am hungry ready done ahead later again today tonight morning afternoon evening lunch food order part status alarm alarms vna laser stage chamber door pump scan help test testing').split(' '));
const DECLINE = /\b(rather not|prefer not|none of your|not telling|no name|don'?t want to (say|tell|give)|skip (it|that)|anonymous|keep it to myself|not (going to|gonna) say|pass)\b/i;
const NAME_RE = /^[A-Za-z][A-Za-z'’.-]{1,23}$/;

export function cleanName(raw: string): string | null {
  const w = raw.replace(/[’]/g, "'").trim().replace(/[.,!?;:]+$/g, '');
  if (!NAME_RE.test(w) || NOT_NAMES.has(w.toLowerCase())) return null;
  return w.toLowerCase().replace(/(^|[-'])([a-z])/g, (_m, a, b) => a + b.toUpperCase());
}

export type NameResult = { kind: 'name'; name: string } | { kind: 'declined' } | { kind: 'none' };
/** Reads the operator's reply to "who am I speaking with?". Anything that is clearly a command or a question is "none". */
export function parseName(text: string): NameResult {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return { kind: 'none' };
  if (DECLINE.test(t)) return { kind: 'declined' };
  const m = t.match(/\b(?:my name(?:'s| is)|name(?:'s| is)|i am|i'm|im|this is|it's|it is|call me|you can call me|they call me|people call me)\s+(?:dr\.?\s+|doctor\s+|mr\.?\s+|mrs\.?\s+|ms\.?\s+|professor\s+|prof\.?\s+)?([A-Za-z][A-Za-z'’.-]{1,23})(?:\b|$)/i);
  if (m) { const n = cleanName(m[1]); if (n) return { kind: 'name', name: n }; return { kind: 'none' }; }
  const here = t.match(/^([A-Za-z][A-Za-z'’-]{1,23})\s+(?:here|speaking|calling)\b/i);
  if (here) { const n = cleanName(here[1]); if (n) return { kind: 'name', name: n }; }
  const words = t.replace(/[.,!?]/g, '').split(' ');
  if (words.length === 1) { const n = cleanName(words[0]); if (n) return { kind: 'name', name: n }; }
  if (words.length === 2 && /^(hi|hello|hey)$/i.test(words[0])) { const n = cleanName(words[1]); if (n) return { kind: 'name', name: n }; }
  if (words.length === 2 && /^[A-Z]/.test(words[0]) && /^[A-Z]/.test(words[1])) { const n = cleanName(words[0]); if (n && !NOT_NAMES.has(words[1].toLowerCase())) return { kind: 'name', name: n }; }   // "Sam Rivera": first name only
  return { kind: 'none' };
}

const ASK_NAME = [
  "Who am I speaking with?",
  "And who's this?",
  "Sorry, I didn't catch your name. Who am I talking to?",
  "Who do I have on the line?",
] as const;
const MEET = [
  (n: string) => `Nice to meet you, ${n}.`,
  (n: string) => `Good to talk to you, ${n}.`,
  (n: string) => `Hi ${n}, glad you called.`,
  (n: string) => `Great, ${n}. Welcome to the lab.`,
] as const;
const NO_NAME = ["No problem, we'll skip the names.", "That's fine. I won't ask again.", "Totally fine. Let's just get to it."] as const;
export const askName = (pick?: Pick) => choose(ASK_NAME, pick);
export const meet = (name: string, pick?: Pick) => choose(MEET, pick)(name);
export const noName = (pick?: Pick) => choose(NO_NAME, pick);

/**
 * Works the operator's name into a reply now and then, the way people do: at the end of the first sentence,
 * or as an opener. Never twice in one reply, never in a question, and only every few replies.
 */
export function withName(text: string, name: string | null, sinceUsed: number, pick?: Pick): { text: string; used: boolean } {
  if (!name || sinceUsed < 2 || !text.trim()) return { text, used: false };
  if (new RegExp(`\\b${name}\\b`, 'i').test(text)) return { text, used: true };
  const m = text.match(/^(.+?)([.!])(\s|$)/);
  if (!m || m[1].length < 3 || m[1].length > 90 || /[?]/.test(m[1])) return { text, used: false };
  if (/\d:\d\d|\d\.\d/.test(m[1])) return { text, used: false };
  if ((pick ?? rnd)(3) === 0) { const lower = /^(okay|sure|glad|good|nice|fair|take|anytime|pretty|honestly|hmm|well|right|great|no|yes|can't|sorry)\b/i.test(text); return { text: `${name}, ${lower ? text.charAt(0).toLowerCase() + text.slice(1) : text}`, used: true }; }
  return { text: `${m[1]}, ${name}${m[2]}${text.slice(m[0].length - m[3].length)}`.replace(/\s+$/, ''), used: true };
}

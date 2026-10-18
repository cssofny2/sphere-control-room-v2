// Turns scripted, report-style lines into the way a person would say them: contractions, labels such as
// "Cause:" and "Fix:" folded into sentences, and a spoken lead-in or closing question for explanations.
// Pure and idempotent, so it can be applied to anything he says without changing text that is already fluent.

type Pick = (n: number) => number;
const rnd: Pick = n => Math.floor(Math.random() * n);

const CONTRACT: [RegExp, string][] = [
  [/\bI am\b/g, "I'm"], [/\bI will\b/g, "I'll"], [/\bI have\b(?! to\b)/g, "I've"], [/\bI would\b/g, "I'd"],
  [/\b(You|you) are\b/g, "$1're"], [/\b(We|we) are\b/g, "$1're"], [/\b(They|they) are\b/g, "$1're"], [/\b(You|you) will\b/g, "$1'll"], [/\b(We|we) will\b/g, "$1'll"],
  [/\b(It|it) is\b/g, "$1's"], [/\b(That|that) is\b/g, "$1's"], [/\b(There|there) is\b(?! (a|an|1|one) (open )?alarm)/g, "$1's"], [/\b(What|what) is\b/g, "$1's"], [/\b(Here|here) is\b/g, "$1's"],
  [/\b(Do|do) not\b/g, "$1n't"], [/\b(Does|does) not\b/g, "$1n't"], [/\b(Did|did) not\b/g, "$1n't"], [/\b(Is|is) not\b/g, "$1n't"], [/\b(Are|are) not\b/g, "$1n't"], [/\b(Was|was) not\b/g, "$1n't"],
  [/\b(Have|have) not\b/g, "$1n't"], [/\b(Has|has) not\b/g, "$1n't"], [/\b(Could|could) not\b/g, "$1n't"], [/\b(Would|would) not\b/g, "$1n't"], [/\b(Should|should) not\b/g, "$1n't"],
[/\b(Can|can)not\b/g, "$1't"], [/\b(Can|can) not\b/g, "$1't"], [/\b(Will|will) not\b/g, "won't"],
];
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const SAFE_LEAD = /^(the|it|its|it's|that|that's|this|a|an|your|my|we|you|there|pressure|both|most|when|if|each|every|one|two|three|four|when|vacuum|in|on|at|copper|sound|laser)\b/i;
const OPEN = ['So, ', 'Basically, ', 'Well, ', 'Okay, so '] as const;
const CLOSE = ['Does that make sense?', 'Want me to go into more detail?', 'Ask me if you want more on that.', 'Let me know if you want me to walk you through it.'] as const;

export type FluentOpts = { kind?: 'plain' | 'explain'; pick?: Pick };

/** Folds "Cause: ..." style labels into spoken sentences. */
function unlabel(text: string): string {
  return text
    .replace(/\bCause: /g, "Here's what's going on: ")
    .replace(/\bEffect: /g, 'That means ')
    .replace(/\bCheck: (the|a|an|optical|your)\b/g, 'Take a look at $1')
    .replace(/\bCheck: /g, 'Next, ')
    .replace(/\bFix: /g, 'As for the fix, ')
    .replace(/\bRelated: ([^.]+)\./g, "It's also related to $1.");
}

export function fluent(text: string, o: FluentOpts = {}): string {
  if (!text) return text;
  let t = unlabel(text);
  // Do not touch numbers, units or quoted text: contractions only act on plain words.
  for (const [re, to] of CONTRACT) t = t.replace(re, to);
  t = t.replace(/\s{2,}/g, ' ').trim();
  if (o.kind === 'explain') {
    const pick = o.pick ?? rnd;
    const sentences = t.match(/[^.!?]+[.!?]+/g) ?? [t];
    if (sentences.length >= 2 && !/\?/.test(t) && !/^(so|basically|well|okay|hm|right|good question)\b/i.test(t)) {
      if (SAFE_LEAD.test(t) && pick(100) < 45) t = OPEN[pick(OPEN.length)] + lowerFirst(t);
      if (pick(100) < 25 && t.length < 360) t += ' ' + CLOSE[pick(CLOSE.length)];
    }
  }
  return t;
}

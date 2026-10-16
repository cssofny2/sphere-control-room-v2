// Offline question answering for Dr. Wire: live-state answers first, then knowledge-base retrieval.
// If nothing matches well he says he does not know instead of guessing.
import { KNOWLEDGE, type KBEntry } from './knowledge.generated';
import { fmtPressure, readiness, type FactsPlus } from './facts';

const STOP = new Set(('a an the is are was were be been am do does did how what why when where which who whom whose can could should would will shall may might must i you he she it we they me my your our their this that these those of in on at to for from with by about as into over under up down out off and or but not no yes please tell show explain give say need want know just really very also than then so if any some there here has have had get got make makes lab thing things stuff work works working use used using').split(' '));

export const tokens = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z0-9.\- ]+/g, ' ').split(/\s+/).map(w => w.replace(/^[.\-]+|[.\-]+$/g, '')).filter(w => w && !STOP.has(w)).map(stem);
function stem(w: string): string { return w.length > 4 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w; }

export type Hit = { entry: KBEntry; score: number };

export function search(question: string, kb: KBEntry[] = KNOWLEDGE, limit = 3): Hit[] {
  const q = question.toLowerCase(); const qt = tokens(question); if (!qt.length) return [];
  const hits: Hit[] = [];
  for (const e of kb) {
    let score = 0, strong = 0;
    const kwTokens = new Set(e.keywords.flatMap(k => tokens(k)));
    const titleTokens = new Set(tokens(e.title));
    const textTokens = tokens(e.text);
    for (const k of e.keywords) if (k.length > 2 && q.includes(k)) { score += 6; strong++; }
    for (const t of new Set(qt)) {
      if (kwTokens.has(t)) { score += 3; strong++; }
      if (titleTokens.has(t)) { score += 2; strong++; }
      const n = textTokens.filter(x => x === t).length; if (n) score += Math.min(2, n);
    }
    if (strong && score >= 5) hits.push({ entry: e, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

const firstSentences = (t: string, n: number) => (t.match(/[^.!?]+[.!?]+(\s|$)/g) || [t]).slice(0, n).join('').trim();

export type Answer = { text: string; known: boolean; sources: string[]; topic?: string };

/** Answers about the current state of the lab, e.g. "what's the pressure?". Returns null if the question isn't about live state. */
export function liveAnswer(question: string, f: FactsPlus): Answer | null {
  const q = question.toLowerCase(); const A = (text: string, topic: string): Answer => ({ text, known: true, sources: ['live-state'], topic });
  if (/\b(ready|good to go|can (i|we) (start|measure|scan|take data)|okay to (measure|scan))\b/.test(q)) {
    const r = readiness(f); const bad = r.rules.filter(x => !x.pass);
    return A(r.ready ? 'Everything on the validation checklist is passing, so yes, we are good to measure.' : `Not yet. ${bad.length} check${bad.length > 1 ? 's' : ''} failing: ${bad.map(b => `${b.label} (${b.detail})`).join('; ')}.`, 'readiness');
  }
  if (/\b(pressure|vacuum level|torr|how low)\b/.test(q) && !/\bwhy|what is (a|the) pressure\b/.test(q)) {
    const state = f.vent ? 'venting' : f.turbo ? 'turbo running' : f.roughing ? 'roughing pump running' : 'pumps off';
    return A(`Chamber pressure is ${fmtPressure(f.pressure)} (${state}). The target is below 1e-3 Torr${f.pressure < 1e-3 ? ', and we are there.' : '.'}`, 'vacuum');
  }
  if (/\b(temperature|how (hot|warm|cold)|thermal|setpoint)\b/.test(q) && /\b(is|are|now|current|what|how)\b/.test(q) && !/\bwhy\b/.test(q)) {
    return A(`The chamber is at ${f.temperature.toFixed(2)} °C against a ${f.setpoint.toFixed(2)} °C setpoint, ${Math.abs(f.tempDiff) < 0.03 ? 'inside' : 'outside'} the 0.03 °C limit (off by ${f.tempDiff.toFixed(3)} °C).`, 'thermal');
  }
  if (/\b(clock|rubidium|lock)\b/.test(q) && /\b(status|locked|is it|are we|now|current)\b/.test(q)) {
    return A(!f.clockPower ? 'The Rubidium clock is powered off.' : f.clockLocked ? 'The clock is locked to 10 MHz.' : 'The clock is on but not locked yet. It needs about 15 seconds of warm-up.', 'clock');
  }
  if (/\bstage\b/.test(q) && /\b(where|position|at|coordinates|now|current)\b/.test(q) && !/\bwhat is\b/.test(q)) {
    return A(`The stage is commanded to X ${f.pos.x.toFixed(2)}, Y ${f.pos.y.toFixed(2)}, Z ${f.pos.z.toFixed(2)} mm and is ${f.stageMoving ? 'moving' : f.stageSettling ? 'settling' : 'settled'}.`, 'stage');
  }
  if (/\b(scan|run|progress|how far|how long)\b/.test(q) && /\b(progress|how far|how long|status|done|finished|going)\b/.test(q)) {
    return A(f.scanActive ? `The scan is ${Math.round(f.scanProgress * 100)}% done with ${f.records} records so far: ${f.accepted} accepted, ${f.suspect} suspect, ${f.failed} failed.` : f.records ? `No scan is running. The last data set has ${f.records} records: ${f.accepted} accepted, ${f.suspect} suspect, ${f.failed} failed.` : 'No scan is running and there is no data yet.', 'scan');
  }
  if (/\b(alarm|alert|warning|problem|wrong|issue|broken|error)\b/.test(q) && /\b(any|what|is|are|there|current|open|something|happening)\b/.test(q)) {
    return A(f.alarms.length ? `There ${f.alarms.length === 1 ? 'is 1 open alarm' : `are ${f.alarms.length} open alarms`}: ${f.alarms.slice(0, 3).map(a => a.text).join(' | ')}` : 'No open alarms right now.', 'alarms');
  }
  if (/\b(laser|shutter|ldv)\b/.test(q) && /\b(on|open|status|is|quality|return)\b/.test(q) && !/\b(what is|how does|why)\b/.test(q)) {
    return A(!f.ldvPower ? 'The vibrometer is powered off.' : `The vibrometer is on, the shutter is ${f.shutter ? 'OPEN (laser emitting)' : 'closed'}, and optical quality is ${Math.round(f.opticalQuality)}.`, 'laser');
  }
  if (/\b(vna|analy[sz]er|calibrat)/.test(q) && /\b(status|calibrated|is it|are we|now|current|age|old)\b/.test(q) && !/\b(what is|how does|why)\b/.test(q)) {
    return A(!f.vnaPower ? 'The VNA is powered off.' : `The VNA is on, RF is ${f.rf ? 'on' : 'off'}, and it is ${f.calibrated ? `calibrated (${Math.round(f.calAge / 60)} min old)` : 'NOT calibrated'}.`, 'vna');
  }
  return null;
}

/** Looks up a general question in the knowledge base. */
export function knowledgeAnswer(question: string, verbosity = 0.5): Answer {
  const hits = search(question);
  if (!hits.length) return { text: "I don't know that one. It isn't something I have notes on for this project. I've written it down as an open question for the team.", known: false, sources: [] };
  const top = hits[0].entry; const n = verbosity < 0.34 ? 1 : verbosity < 0.67 ? 2 : 4;
  let text = firstSentences(top.text, n);
  const alt = hits[1] && hits[1].score >= hits[0].score * 0.7 ? hits[1].entry : null;
  if (alt && verbosity >= 0.34) text += ` Related: ${alt.title.toLowerCase()}.`;
  return { text, known: true, sources: [top.id, ...(alt ? [alt.id] : [])], topic: top.id.split('.')[0] };
}

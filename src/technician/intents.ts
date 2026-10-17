// Offline understanding of simple spoken or typed commands, used when the AI service is not available.
// The language model handles anything more complicated.
import { placeFrom } from './smalltalk';
export type Intent =
  | { type: 'task'; id: string; params: Record<string, unknown> }
  | { type: 'cancel' }
  | { type: 'estop' }
  | { type: 'lookup'; query: string }
  | { type: 'food'; place: string | null; request: string }
  | { type: 'part'; part: string; qty: number; urgent: boolean }
  | null;

const NUM = String.raw`(-?\d+(?:\.\d+)?)`;
const word = (s: string) => s.replace(/\bminus\b/g, '-').replace(/\bnegative\b/g, '-').replace(/-\s+(?=\d)/g, '-');

export function parseCommand(text: string, state?: any): Intent {
  const q = word(text.toLowerCase().replace(/[,;]/g, ' ').replace(/\s+/g, ' ').trim());
  if (/\b(emergency stop|e-?stop|stop everything|halt everything|abort everything)\b/.test(q)) return { type: 'estop' };
  if (/\b(cancel|stop|forget) (the |that |this |your )?(task|job|that|what you('| a)re doing)\b/.test(q)) return { type: 'cancel' };
  const T = (id: string, params: Record<string, unknown> = {}): Intent => ({ type: 'task', id, params });
  if (/\b(pump down|pump the chamber|evacuate|get (us |it )?(to|into) (a )?(deep |high )?vacuum|deep vacuum)\b/.test(q) && !/\b(what|why|how|is|explain)\b/.test(q)) return T('pump_down');
  if (/\bcalibrate\b.*\bvna\b|\bvna\b.*\bcalibrat/.test(q) && !/\b(what|why|how|explain)\b/.test(q)) return T('calibrate_vna');
  if (/\bhome\b.*\bstage\b|\bstage\b.*\bhome\b/.test(q) && !/\b(what|why|how|explain)\b/.test(q)) return T('home_stage');
  if (/\b(move|send|put|take)\b.*\b(stage|sphere)\b|\bstage\b.*\bto\b/.test(q)) {
    const cur = state?.stage || { x: 0, y: 0, z: 0 }; const v: Record<string, number> = { x: cur.x ?? 0, y: cur.y ?? 0, z: cur.z ?? 0 };
    let hit = false;
    for (const ax of ['x', 'y', 'z']) { const m = q.match(new RegExp(String.raw`\b${ax}\b\s*(?:to|=|at)?\s*${NUM}`)); if (m) { v[ax] = Number(m[1]); hit = true; } }
    if (!hit) { const m = q.match(new RegExp(String.raw`\bto\b\s*\(?${NUM}\s+${NUM}\s+${NUM}`)); if (m) { v.x = Number(m[1]); v.y = Number(m[2]); v.z = Number(m[3]); hit = true; } }
    if (hit) return T('move_stage', v);
  }
  if (/\bopen\b.*\bdoor\b/.test(q)) return T('open_door');
  if (/\bclose\b.*\bdoor\b|\bshut\b.*\bdoor\b/.test(q)) return T('close_door');
  if (/\b(pause)\b.*\bscan\b/.test(q)) return T('pause_scan');
  if (/\b(stop|abort|end)\b.*\bscan\b/.test(q)) return T('stop_scan');
  if (/\b(start|begin|run|launch)\b.*\bscan\b/.test(q)) return T('start_scan', { kind: /\baxis\b/.test(q) ? 'axis' : 'grid' });
  if (/\b(acknowledge|ack|clear|dismiss)\b.*\balarms?\b/.test(q)) return T('ack_alarms');
  if (/\b(fix|resolve|deal with|handle)\b.*\balarm\b/.test(q)) return T('fix_alarm');
  if (/\b(explain|look at|check|what('| i)?s)\b.*\balarm\b/.test(q) && /\b(explain|look at|check)\b/.test(q)) return T('explain_alarm');
  if (/\bfault drill\b/.test(q) && /\b(start|run|begin)\b/.test(q)) return T('fault_drill');
  if (/\bexport\b/.test(q)) return T('export_data', { format: /\bjson\b/.test(q) ? 'json' : 'csv' });
  const FOOD = /\b(food|lunch|dinner|breakfast|snack|doordash|door dash|mcdonald'?s?|burgers?|fries|big mac|nuggets|pizza|sandwich(es)?|tacos?|sushi|something to eat)\b/;
  if (/\b(order|get|grab|put in|place|build)\b/.test(q) && FOOD.test(q) && !/\b(what|why|how|explain)\b/.test(q)) return { type: 'food', place: placeFrom(text), request: text.slice(0, 120) };
  const lk = q.match(/\b(?:look up|lookup|google|search (?:the web |the internet |online )?(?:for|up)?|find out|look into|check online (?:for|about)?)\s+(.{3,160})$/);
  if (lk) return { type: 'lookup', query: lk[1].replace(/^(about|for|on)\s+/, '').trim() };
  const pt = q.match(/\b(?:order|buy|purchase|reorder|requisition)\s+(?:(\d+|an?|one|two|three|four|five|six|some|another|new)\s+)?(.{3,80}?)(?:\s+(?:for|from|on|at|asap|please|today|right away|now)\b.*)?$/);
  if (pt && !FOOD.test(q) && !/\b(operations?|magnitude|of)\b/.test(pt[2])) {
    const w: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, some: 1, another: 1, new: 1 };
    const qty = pt[1] ? (/^\d+$/.test(pt[1]) ? Number(pt[1]) : w[pt[1]] ?? 1) : 1;
    const part = pt[2].replace(/\b(please|asap)\b/g, '').replace(/\s+/g, ' ').trim();
    if (part.length >= 3) return { type: 'part', part, qty, urgent: /\b(asap|urgent|rush|overnight|expedite|right away|as soon as possible)\b/.test(q) };
  }
  return null;
}

export const isYes = (t: string) => /^\s*(yes|yeah|yep|yup|sure|ok|okay|go ahead|do it|confirm(ed)?|please do|affirmative|proceed)\b/i.test(t);
export const isNo = (t: string) => /^\s*(no|nope|nah|don'?t|do not|cancel|stop|negative|never mind|abort)\b/i.test(t);

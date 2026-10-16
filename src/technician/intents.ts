// Offline understanding of simple spoken or typed commands, used when the AI service is not available.
// The language model handles anything more complicated.
export type Intent =
  | { type: 'task'; id: string; params: Record<string, unknown> }
  | { type: 'cancel' }
  | { type: 'estop' }
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
  return null;
}

export const isYes = (t: string) => /^\s*(yes|yeah|yep|yup|sure|ok|okay|go ahead|do it|confirm(ed)?|please do|affirmative|proceed)\b/i.test(t);
export const isNo = (t: string) => /^\s*(no|nope|nah|don'?t|do not|cancel|stop|negative|never mind|abort)\b/i.test(t);

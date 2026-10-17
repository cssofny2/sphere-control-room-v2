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
  const ask = /\b(what|why|how|explain|is|are|does|do you know)\b/.test(q) && !/\b(please|can you|could you)\b/.test(q);
  const A = (action: string, params: Record<string, unknown> = {}): Intent => T('action', { action, params });
  const off = /\b(off|down|stop|disable|disengage|kill|shut ?(down|off)|power down|turn off|switch off)\b/.test(q) && !/\b(turn on|switch on|power on|power up|start up|enable)\b/.test(q);
  const on = !off;
  if (!ask && /\b(startup|start up|start-up|boot up|bring (the )?(lab|everything|system) (up|online)|power (up|on) (the )?(lab|everything|whole|all|facility|system)|get (the )?(lab|everything) (going|running|ready)|turn everything on|initiali[sz]e (the )?(lab|system))\b/.test(q) && !/\b(chamber|vna|laser|clock|pump)\b.*\b(startup|start up)\b/.test(q)) return T('startup_sequence');
  if (!ask && /\b(shut ?down|power down|turn everything off|shut everything|close up|wind down)\b/.test(q) && /\b(sequence|lab|everything|system|instruments|all|facility)\b/.test(q)) return T('shutdown_sequence');
  if (!ask) {
    if (/\b(main )?breaker\b/.test(q)) return A(off || /\b(open)\b/.test(q) && !/\bclose\b/.test(q) ? 'power_off' : 'power_on');
    if (/\b(rubidium|rb|atomic)?\s*clock\b|\brubidium\b/.test(q) && /\b(on|off|power|turn|switch|start|stop|enable|disable)\b/.test(q) && !/\b(wall|time|what)\b/.test(q)) return A('clock_power', { on });
    if (/\b(laser )?shutter\b/.test(q)) return A('laser_shutter', { on: /\b(open|on)\b/.test(q) && !/\bclose|shut\b/.test(q) });
    if (/\b(vibrometer|ldv)\b/.test(q) && /\b(on|off|power|turn|switch|start|stop)\b/.test(q)) return A('ldv_power', { on });
    if (/\bvna\b|\bnetwork analy[sz]er\b/.test(q) && /\b(on|off|power|turn|switch|rf)\b/.test(q) && !/\bcalibrat/.test(q)) return A('vna_power', { on });
    if (/\bturbo/.test(q)) return A(off ? 'stop_turbo' : 'start_turbo');
    if (/\b(roughing|rough|backing|scroll) ?(pump)?\b/.test(q) && /\b(start|on|run|turn|begin)\b/.test(q) && !off) return A('start_roughing');
    if (/\bvent\b/.test(q)) return A('vent_chamber');
    if (/\bfaraday|shield(ing)?\b/.test(q)) return A('set_faraday', { on });
    if (/\b(vibration|isolation)\b/.test(q)) return A('set_isolation', { on });
    const tp = q.match(new RegExp(String.raw`\b(?:temperature|thermostat|temp)\b.*?\bto\b\s*${NUM}`)) || q.match(new RegExp(String.raw`\bset\b.*?\b(?:chamber|thermostat)\b.*?${NUM}`)); if (tp) return A('set_temperature', { celsius: Number(tp[1]) });
    if (/\b(wait|watch)\b.*\b(lock|rubidium|clock)\b/.test(q)) return A('wait_clock_lock');
    if (/\b(wait|watch)\b.*\b(scan)\b/.test(q)) return A('wait_scan');
    if (/\b(resume|continue)\b.*\bscan\b/.test(q)) return A('resume_scan');
    if (/\b(capture|take|grab)\b.*\b(reference)\b/.test(q)) return A('capture_reference');
    if (/\b(capture|take|grab|run)\b.*\b(sweep|trace)\b/.test(q)) return A('capture_sweep');
    if (/\b(start|begin|run)\b.*\b(experiment|standard run|the run)\b/.test(q)) return A('start_run');
    if (/\b(stop|end)\b.*\b(experiment|the run)\b/.test(q)) return A('stop_run');
    if (/\b(clear|remove)\b.*\bfaults?\b/.test(q)) return A('clear_faults');
    const pg = q.match(/\b(?:go to|show|pull up|switch to|navigate to|bring up|open)\b.*?\b(dashboard|console|chamber|spatial|vna|ldv|scanner|scope|oscilloscope|clock|frequency|runs|training|challenges?)\b(?: page| screen| tab)/);
    if (pg) { const m: Record<string, string> = { dashboard: 'dashboard', console: 'dashboard', chamber: 'chamber', spatial: 'spatial', vna: 'vna', ldv: 'ldv', scanner: 'ldv', scope: 'scope', oscilloscope: 'scope', clock: 'clock', frequency: 'clock', runs: 'runs', training: 'training', challenge: 'challenges', challenges: 'challenges' }; return A(`go_${m[pg[1]]}`); }
  }
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

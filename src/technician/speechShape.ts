// Makes text sound spoken: pronounces lab abbreviations and numbers the way a person would, breaks the text into
// phrases with their own pace, pitch and pause, and ranks the voices a browser offers so the most natural male voice wins.
// Pure functions, so they are tested in Node. Browsers only give us rate, pitch and volume per utterance, so the
// realism comes from how the text is cut and timed, plus the choice of voice. A neural cloud voice would sound better still.

const SAY: [RegExp, string | ((...m: string[]) => string)][] = [
  [/https?:\/\/\S+/gi, ''],
  [/\bspheredesci\.org\b/gi, 'sphere D E sci dot org'],
  [/\bS\.P\.H\.E\.R\.E\.?/g, 'sphere'],
  [/\bDr\.\s?/g, 'Doctor '],
  [/\bPR-(\d{3,5})\b/g, (_m, n) => `P R ${n}`],
  [/\bSLDV\b/g, 'S L D V'], [/\bLDV\b/g, 'L D V'], [/\bVNA\b/g, 'V N A'], [/\bUHV\b/g, 'U H V'], [/\bRF\b/g, 'R F'], [/\bDC\b/g, 'D C'], [/\bAC\b/g, 'A C'],
  [/\bPDF\b/g, 'P D F'], [/\bCSV\b/g, 'C S V'], [/\bJSON\b/g, 'jason'], [/\bUSB\b/g, 'U S B'], [/\bAI\b/g, 'A I'], [/\bFAQ\b/g, 'fack'],
  [/\b(\d+(?:\.\d+)?)\s?e\s?([+-]?\d+)\b/gi, (_m, n, e) => `${n} times ten to the ${Number(e) < 0 ? 'minus ' : ''}${Math.abs(Number(e))}`],
  [/\b(\d+(?:\.\d+)?)\s?kHz\b/g, '$1 kilohertz'], [/\b(\d+(?:\.\d+)?)\s?MHz\b/g, '$1 megahertz'], [/\b(\d+(?:\.\d+)?)\s?GHz\b/g, '$1 gigahertz'], [/\b(\d+(?:\.\d+)?)\s?Hz\b/g, '$1 hertz'],
  [/\b(\d+(?:\.\d+)?)\s?dBm\b/g, '$1 D B M'], [/\b(\d+(?:\.\d+)?)\s?dB\b/g, '$1 decibels'],
  [/\b(\d+(?:\.\d+)?)\s?nm\b/g, '$1 nanometers'], [/\b(\d+(?:\.\d+)?)\s?(?:µm|μm|um)\b/g, '$1 micrometers'], [/\b(\d+(?:\.\d+)?)\s?mm\b/g, '$1 millimeters'],
  [/\b(\d+(?:\.\d+)?)\s?mTorr\b/g, '$1 millitorr'], [/\b(\d+(?:\.\d+)?)\s?mK\b/g, '$1 millikelvin'],
  [/(\d)\s?°\s?C\b/g, '$1 degrees Celsius'], [/(\d)\s?°\s?F\b/g, '$1 degrees Fahrenheit'], [/°/g, ' degrees'],
  [/(\d)\s?%/g, '$1 percent'], [/\s&\s/g, ' and '], [/\bw\/\s?/g, 'with '], [/\be\.g\.,?/gi, 'for example,'], [/\bi\.e\.,?/gi, 'that is,'], [/\bvs\.?\s/gi, 'versus '], [/~\s?(?=\d)/g, 'about '],
  [/\b(\d{1,2}(?::\d{2})?)\s?AM\b/g, '$1 A M'], [/\b(\d{1,2}(?::\d{2})?)\s?PM\b/g, '$1 P M'],
  [/[*_`#]+/g, ''], [/\(([^)]{0,60})\)/g, ', $1,'],
];
export function pronounce(text: string): string {
  let t = text;
  for (const [re, to] of SAY) t = t.replace(re, to as string);
  return t.replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/,\s*\./g, '.').replace(/\s{2,}/g, ' ').trim();
}

export type Segment = { text: string; rate: number; pitch: number; pauseMs: number };
const FILLER = /^(hm+|hmm+|ooh|oh|well|okay|ok|alright|right|so|um+|uh+|let me see|let me think|honestly|actually)\b[,.…]?\s+/i;
// A small deterministic hash so the same sentence is always spoken the same way (and tests are exact), while sentences differ from each other.
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const BASE_RATE = 1.0, BASE_PITCH = 0.94;

export function shapeSpeech(raw: string, o: { rate?: number; pitch?: number } = {}): Segment[] {
  const text = pronounce(raw); if (!text) return [];
  const rate0 = o.rate ?? BASE_RATE, pitch0 = o.pitch ?? BASE_PITCH;
  const sentences = (text.replace(/\n+/g, ' ¶ ').match(/[^.!?…¶]+(?:[.!?…]+|¶|$)/g) || [text]).map(s => s.trim()).filter(Boolean);
  const out: Segment[] = [];
  for (const sentence of sentences) {
    if (sentence === '¶') { if (out.length) out[out.length - 1].pauseMs = Math.max(out[out.length - 1].pauseMs, 450); continue; }
    const end = sentence.slice(-1);
    // Spoken openers ("Hmm," / "Well,") get their own slower beat, like someone thinking.
    const parts: string[] = []; let rest = sentence; const f = rest.match(FILLER);
    if (f && rest.length > f[0].length + 6) { parts.push(f[0].trim()); rest = rest.slice(f[0].length); }
    // Long sentences are cut at a comma or a joining word, nearest the middle, so he can breathe.
    for (let guard = 0; rest.length > 110 && guard < 4; guard++) {
      let best = -1, bd = Infinity;
      for (const m of rest.matchAll(/[,;:]\s|\s(?=(?:and|but|because|so|which|then)\s)/g)) { const at = (m.index ?? 0) + (/^[,;:]/.test(m[0]) ? 1 : 0); if (at < 25 || rest.length - at < 25) continue; const d = Math.abs(at - rest.length / 2); if (d < bd) { bd = d; best = at; } }
      if (best < 0) break;
      parts.push(rest.slice(0, best).trim()); rest = rest.slice(best).trim();
    }
    parts.push(rest);
    parts.forEach((p, i) => {
      if (!p) return; const last = i === parts.length - 1; const h = hash(p);
      let rate = rate0 * (0.97 + h * 0.08), pitch = pitch0 + (h - 0.5) * 0.06, pause = last ? 260 : 130;
      if (last && end === '?') { pitch += 0.09; pause = 320; }
      else if (last && end === '!') { rate *= 1.04; pitch += 0.05; pause = 280; }
      else if (last && /[…]|\.\.\./.test(end + p.slice(-3))) { rate *= 0.92; pause = 420; }
      if (!last && FILLER.test(p + ' x') && p.length < 14) { rate *= 0.86; pause = 240; pitch -= 0.03; }
      else if (p.length < 18) rate *= 0.96;
      out.push({ text: p, rate: Math.round(rate * 100) / 100, pitch: Math.round(Math.min(2, Math.max(0.1, pitch)) * 100) / 100, pauseMs: pause });
    });
  }
  if (out.length) out[out.length - 1].pauseMs = 0;
  return out;
}

// ——— voices ———
const FEMALE = /\b(samantha|zira|susan|hazel|karen|fiona|victoria|allison|ava|jenny|aria|emma|michelle|libby|sonia|moira|tessa|veena|kate|serena|nicky|amy|joanna|salli|kimberly|ivy|kendra|jessica|nora|catherine|female|woman|heera|natasha|clara|mia|olivia)\b/i;
const MALE = /\b(daniel|alex|david|mark|guy|andrew|christopher|eric|roger|brian|ryan|steffan|tom|aaron|fred|arthur|oliver|george|james|evan|nathan|gordon|lee|rishi|ravi|thomas|ethan|liam|davis|jason|tony|male|man)\b/i;
export type VoiceInfo = { name: string; lang: string; localService?: boolean; default?: boolean };
export function voiceScore(v: VoiceInfo): number {
  if (!/^en[-_]/i.test(v.lang)) return -1000;
  let s = 0; const n = v.name;
  if (/natural|neural/i.test(n)) s += 60;
  if (/premium|enhanced|siri/i.test(n)) s += 45;
  if (/online/i.test(n)) s += 10;
  if (MALE.test(n)) s += 40; if (FEMALE.test(n)) s -= 70;
  if (/x-(iol|iom|tpd)\b/i.test(n)) s += 15;
  if (/google/i.test(n) && /uk english male/i.test(n)) s += 20;
  if (/google us english/i.test(n)) s += 5;
  if (/en[-_]US/i.test(v.lang)) s += 12; else if (/en[-_](GB|AU|CA|IE)/i.test(v.lang)) s += 6;
  if (/compact|espeak|novelty|whisper|bad news|bells|boing|cellos|good news|jester|organ|trinoids|zarvox|albert|bubbles|deranged|hysterical|pipe organ/i.test(n)) s -= 600;
  return s;
}
/** Picks the voice by name if the operator chose one, otherwise the best-scoring English voice. */
export function chooseVoice<T extends VoiceInfo>(voices: T[], preferred?: string | null): T | null {
  if (preferred) { const p = voices.find(v => v.name === preferred); if (p) return p; }
  let best: T | null = null, bs = -Infinity;
  for (const v of voices) { const s = voiceScore(v); if (s > bs) { bs = s; best = v; } }
  return best && bs > -500 ? best : null;
}

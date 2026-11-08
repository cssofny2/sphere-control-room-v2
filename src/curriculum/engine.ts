// Progress tracking, scoring and the classroom report. Pure apart from the small storage helpers at the bottom.
import { canonicalJson, sha256Hex } from '../domain/bundle';
import { LESSONS, type Lesson, type LabLike } from './lessons';

export interface LessonProgress { done: string[]; hintsUsed: number; completedAt?: string; score?: number }
export interface Progress { version: 1; lessons: Record<string, LessonProgress>; answers: Record<string, number> }
export const EMPTY_PROGRESS: Progress = { version: 1, lessons: {}, answers: {} };

export const HINT_PENALTY = 10;
export const MIN_SCORE = 40;

/** Score for a finished lesson: 100, minus 10 per hint used, never below 40. */
export const scoreFor = (hintsUsed: number) => Math.max(MIN_SCORE, 100 - HINT_PENALTY * Math.max(0, Math.floor(hintsUsed)));

export interface Evaluation { readonly met: readonly string[]; readonly newlyMet: readonly string[]; readonly complete: boolean }

/** Which objectives are met now, adding to those already met (they stay met). */
export function evaluate(lesson: Lesson, state: LabLike, progress: Progress): Evaluation {
  const before = new Set(progress.lessons[lesson.id]?.done ?? []);
  const ctx = { state, answers: progress.answers };
  const newlyMet: string[] = [];
  for (const o of lesson.objectives) {
    if (before.has(o.id)) continue;
    if (lesson.ordered && lesson.objectives.some(p => p.id !== o.id && lesson.objectives.indexOf(p) < lesson.objectives.indexOf(o) && !before.has(p.id))) break;
    let ok = false;
    try { ok = !!o.check(ctx); } catch { ok = false; }
    if (ok) { before.add(o.id); newlyMet.push(o.id); }
  }
  return { met: lesson.objectives.filter(o => before.has(o.id)).map(o => o.id), newlyMet, complete: lesson.objectives.every(o => before.has(o.id)) };
}

/** Applies an evaluation to the progress, stamping completion and the score the first time a lesson is finished. */
export function applyEvaluation(progress: Progress, lesson: Lesson, ev: Evaluation, now = new Date()): Progress {
  if (!ev.newlyMet.length && !(ev.complete && !progress.lessons[lesson.id]?.completedAt)) return progress;
  const cur = progress.lessons[lesson.id] ?? { done: [], hintsUsed: 0 };
  const next: LessonProgress = { ...cur, done: [...ev.met] };
  if (ev.complete && !cur.completedAt) { next.completedAt = now.toISOString(); next.score = scoreFor(cur.hintsUsed); }
  return { ...progress, lessons: { ...progress.lessons, [lesson.id]: next } };
}

export function useHint(progress: Progress, lessonId: string): Progress {
  const cur = progress.lessons[lessonId] ?? { done: [], hintsUsed: 0 };
  if (cur.completedAt) return progress;
  return { ...progress, lessons: { ...progress.lessons, [lessonId]: { ...cur, hintsUsed: cur.hintsUsed + 1 } } };
}

export function setAnswer(progress: Progress, key: string, value: number): Progress {
  if (!Number.isFinite(value)) return progress;
  return { ...progress, answers: { ...progress.answers, [key]: value } };
}

export function resetLesson(progress: Progress, lessonId: string): Progress {
  const lessons = { ...progress.lessons }; delete lessons[lessonId];
  const answers = { ...progress.answers }; delete answers[lessonId];
  return { ...progress, lessons, answers };
}

export interface Summary { completed: number; total: number; averageScore: number | null }
export function summarize(progress: Progress): Summary {
  const scores = LESSONS.map(l => progress.lessons[l.id]?.score).filter((s): s is number => typeof s === 'number');
  return { completed: scores.length, total: LESSONS.length, averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null };
}

// ── classroom report ────────────────────────────────────────────────────────────────────────────
export interface ReportPayload {
  readonly format: 'sphere-lesson-report'; readonly version: 1; readonly learner: string; readonly issuedAt: string;
  readonly lessons: ReadonlyArray<{ readonly id: string; readonly title: string; readonly level: number; readonly completedAt: string | null; readonly score: number | null; readonly hintsUsed: number }>;
  readonly summary: Summary;
}
export interface Report extends ReportPayload { readonly hash: string }

export async function buildReport(progress: Progress, learner: string, now = new Date()): Promise<Report> {
  const payload: ReportPayload = {
    format: 'sphere-lesson-report', version: 1, learner: learner.trim().slice(0, 80) || 'Unnamed learner', issuedAt: now.toISOString(),
    lessons: LESSONS.map(l => { const p = progress.lessons[l.id]; return { id: l.id, title: l.title, level: l.level, completedAt: p?.completedAt ?? null, score: p?.score ?? null, hintsUsed: p?.hintsUsed ?? 0 }; }),
    summary: summarize(progress),
  };
  return { ...payload, hash: await sha256Hex(canonicalJson(payload)) };
}

/** Re-checks a report's hash; false if any field was changed after it was issued. */
export async function verifyReport(r: Report): Promise<boolean> {
  const { hash, ...payload } = r;
  return (await sha256Hex(canonicalJson(payload))) === hash;
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** A self-contained, printable page. Every inserted value is escaped. */
export function reportHtml(r: Report): string {
  const rows = r.lessons.map(l => `<tr><td>${esc(l.title)}</td><td>${l.level}</td><td>${l.completedAt ? esc(new Date(l.completedAt).toLocaleDateString()) : 'not completed'}</td><td>${l.score ?? '–'}</td><td>${l.hintsUsed}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Lesson report: ${esc(r.learner)}</title><style>body{font:14px system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#111}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:6px 8px;text-align:left}th{background:#eee}code{font-size:11px;word-break:break-all}</style></head><body><h1>S.P.H.E.R.E. Metrology Lab: lesson report</h1><p><b>${esc(r.learner)}</b><br>Issued ${esc(new Date(r.issuedAt).toLocaleString())}</p><p>${r.summary.completed} of ${r.summary.total} lessons completed${r.summary.averageScore === null ? '' : `, average score ${r.summary.averageScore}`}.</p><table><thead><tr><th>Lesson</th><th>Level</th><th>Completed</th><th>Score</th><th>Hints</th></tr></thead><tbody>${rows}</tbody></table><p>Simulated teaching lab; results show work done in the simulator, not experimental evidence.</p><p>Content hash (SHA-256): <code>${esc(r.hash)}</code></p></body></html>`;
}

// ── storage ─────────────────────────────────────────────────────────────────────────────────────
const KEY = 'sphere.curriculum.v1';
export function parseProgress(raw: unknown): Progress {
  if (typeof raw !== 'object' || raw === null || (raw as Progress).version !== 1) return EMPTY_PROGRESS;
  const p = raw as Progress, out: Progress = { version: 1, lessons: {}, answers: {} };
  const known = new Set(LESSONS.map(l => l.id));
  if (typeof p.lessons === 'object' && p.lessons) for (const [id, v] of Object.entries(p.lessons)) {
    if (!known.has(id) || typeof v !== 'object' || !v) continue;
    out.lessons[id] = { done: Array.isArray(v.done) ? v.done.filter((d): d is string => typeof d === 'string').slice(0, 20) : [], hintsUsed: Number.isFinite(v.hintsUsed) ? Math.max(0, Math.min(99, Math.floor(v.hintsUsed))) : 0,
      ...(typeof v.completedAt === 'string' ? { completedAt: v.completedAt } : {}), ...(typeof v.score === 'number' && Number.isFinite(v.score) ? { score: Math.max(0, Math.min(100, v.score)) } : {}) };
  }
  if (typeof p.answers === 'object' && p.answers) for (const [k, v] of Object.entries(p.answers)) if (typeof v === 'number' && Number.isFinite(v) && known.has(k)) out.answers[k] = v;
  return out;
}
export function loadProgress(storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null): Progress {
  try { const t = storage?.getItem(KEY); return t ? parseProgress(JSON.parse(t)) : EMPTY_PROGRESS; } catch { return EMPTY_PROGRESS; }
}
export function saveProgress(p: Progress, storage: Pick<Storage, 'setItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null): void {
  try { storage?.setItem(KEY, JSON.stringify(p)); } catch { /* storage may be blocked; progress then lasts until the page closes */ }
}

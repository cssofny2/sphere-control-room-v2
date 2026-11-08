import { useEffect, useMemo, useRef, useState } from 'react';
import { useLab } from '../state/labStores';
import { LESSONS, type Lesson } from './lessons';
import { applyEvaluation, buildReport, evaluate, loadProgress, reportHtml, resetLesson, saveProgress, scoreFor, setAnswer, summarize, useHint, type Progress } from './engine';

type Dispatch = (a: { type: string; [k: string]: unknown }) => void;
const LEVELS = { 1: 'Level 1: Getting started', 2: 'Level 2: Diagnosing and improving', 3: 'Level 3: Real measurements' } as const;

/** Guided lessons with live objective checks, hints that cost points, and a printable classroom report. */
export function LearningPaths({ dispatch, learnerName }: { dispatch: Dispatch; learnerName: string }) {
  const lab = useLab(s => s);
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [openId, setOpenId] = useState<string>(LESSONS[0].id);
  const [draft, setDraft] = useState('');
  const progressRef = useRef(progress); progressRef.current = progress;

  // Sticky objective tracking: every lab change re-checks the open lesson and every unfinished one.
  useEffect(() => {
    let p = progressRef.current, changed = false;
    for (const l of LESSONS) {
      if (p.lessons[l.id]?.completedAt) continue;
      const next = applyEvaluation(p, l, evaluate(l, lab as never, p));
      if (next !== p) { p = next; changed = true; }
    }
    if (changed) { setProgress(p); saveProgress(p); }
  }, [lab]);

  const lesson = LESSONS.find(l => l.id === openId) as Lesson;
  const lp = progress.lessons[lesson.id];
  const met = useMemo(() => new Set(lp?.done ?? []), [lp]);
  const sum = summarize(progress);
  const update = (p: Progress) => { setProgress(p); saveProgress(p); };

  const download = async () => {
    const html = reportHtml(await buildReport(progress, learnerName));
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'sphere-lesson-report.html'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Learning Paths</h1>
          <p className="mt-1 text-sm text-zinc-400">Eight guided lessons that check your work in the live lab. {sum.completed} of {sum.total} completed{sum.averageScore === null ? '' : `, average score ${sum.averageScore}`}. Progress is saved in this browser.</p>
        </div>
        <button onClick={download} disabled={!sum.completed} className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs font-semibold hover:bg-zinc-700 disabled:opacity-40">Download classroom report</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <nav aria-label="Lessons" className="space-y-3">
          {([1, 2, 3] as const).map(level => (
            <div key={level}>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{LEVELS[level]}</div>
              <ul className="space-y-1">
                {LESSONS.filter(l => l.level === level).map(l => {
                  const done = !!progress.lessons[l.id]?.completedAt;
                  return (
                    <li key={l.id}>
                      <button onClick={() => { setOpenId(l.id); setDraft(''); }} aria-current={l.id === openId ? 'true' : undefined} className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-xs ${l.id === openId ? 'border-sky-400 bg-sky-950/50 text-sky-100' : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900'}`}>
                        <span>{l.title}</span><span className={done ? 'font-bold text-emerald-300' : 'text-zinc-500'}>{done ? `✓ ${progress.lessons[l.id]?.score}` : `${(progress.lessons[l.id]?.done.length ?? 0)}/${l.objectives.length}`}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" aria-label={lesson.title}>
          <h2 className="text-lg font-bold">{lesson.title}</h2>
          <p className="mt-1 text-sm text-zinc-400">{lesson.goal}</p>
          {lp?.completedAt && <p className="mt-2 rounded border border-emerald-500/40 bg-emerald-950/30 p-2 text-xs text-emerald-200" role="status">Completed with a score of {lp.score}. {lp.hintsUsed ? `${lp.hintsUsed} hint${lp.hintsUsed === 1 ? '' : 's'} used.` : 'No hints used.'}</p>}

          <ul className="mt-3 space-y-1.5" aria-label="Objectives">
            {lesson.objectives.map(o => (
              <li key={o.id} className={`flex items-start gap-2 text-sm ${met.has(o.id) ? 'text-emerald-300' : 'text-zinc-300'}`}>
                <span aria-hidden="true" className="font-mono">{met.has(o.id) ? '✓' : '○'}</span>
                <span><span className="sr-only">{met.has(o.id) ? 'Done: ' : 'Not yet: '}</span>{o.text}</span>
              </li>
            ))}
          </ul>

          {lesson.question && (
            <form className="mt-3 flex flex-wrap items-end gap-2 text-xs" onSubmit={e => { e.preventDefault(); const v = Number(draft); if (draft.trim() !== '' && Number.isFinite(v)) update(setAnswer(progress, lesson.id, v)); }}>
              <label className="text-zinc-400">{lesson.question.label} ({lesson.question.unit})
                <input inputMode="decimal" value={draft} onChange={e => setDraft(e.target.value)} placeholder={progress.answers[lesson.id] !== undefined ? String(progress.answers[lesson.id]) : 'your value'} className="mt-1 block w-36 rounded border border-zinc-700 bg-black p-1.5 font-mono text-sky-200" />
              </label>
              <button type="submit" className="rounded border border-sky-500 bg-sky-800 px-3 py-1.5 font-bold text-white hover:bg-sky-700">Submit answer</button>
              {progress.answers[lesson.id] !== undefined && <span className="text-zinc-500">Submitted: {progress.answers[lesson.id]} {lesson.question.unit}</span>}
            </form>
          )}

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {lesson.setup && <button onClick={() => lesson.setup!.forEach(a => dispatch(a))} className="rounded border border-amber-500/60 px-3 py-1.5 text-amber-200 hover:bg-amber-950/40">Set up this lesson</button>}
            <button onClick={() => update(resetLesson(progress, lesson.id))} className="rounded border border-zinc-600 px-3 py-1.5 hover:bg-zinc-800">Restart lesson</button>
          </div>

          <div className="mt-4 border-t border-zinc-800 pt-3">
            <div className="flex items-center justify-between text-xs"><span className="font-bold uppercase text-zinc-300">Hints</span><span className="text-zinc-500">Each hint costs 10 points. Score now: {scoreFor(lp?.hintsUsed ?? 0)}</span></div>
            <ol className="mt-2 space-y-1 text-sm text-zinc-300">
              {lesson.hints.slice(0, lp?.hintsUsed ?? 0).map((h, i) => <li key={i} className="rounded bg-zinc-900 p-2">{i + 1}. {h}</li>)}
            </ol>
            {!lp?.completedAt && (lp?.hintsUsed ?? 0) < lesson.hints.length && <button onClick={() => update(useHint(progress, lesson.id))} className="mt-2 rounded border border-zinc-600 px-3 py-1.5 text-xs hover:bg-zinc-800">Show hint {(lp?.hintsUsed ?? 0) + 1} of {lesson.hints.length}</button>}
          </div>
        </section>
      </div>
    </div>
  );
}


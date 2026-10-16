import { useState } from 'react';
import type { LogEntry, Settings, TechMode } from './dialogue';

type Props = {
  settings: Settings;
  onSettings: (p: Partial<Settings>) => void;
  log: LogEntry[];
  onAsk: (q: string) => void;
};

const MODES: [TechMode, string, string][] = [
  ['coach', 'Coach', 'Explains steps and gives hints'],
  ['quiet', 'Quiet', 'Only speaks about alarms, safety and results'],
  ['chatty', 'Chatty', 'More commentary and more jokes'],
];
const fmt = (ms: number) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

export default function TechnicianPanel({ settings, onSettings, log, onAsk }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const shown = log.slice(-40).reverse();
  return (
    <details className="ls-tech" data-technician-panel>
      <summary>Dr. Wire: settings, ask a question, and what he said</summary>
      <div className="ls-tech-body">
        <fieldset className="ls-tech-modes"><legend>Mode</legend>
          {MODES.map(([m, label, hint]) => (
            <label key={m} title={hint}><input type="radio" name="tech-mode" checked={settings.mode === m} onChange={() => onSettings({ mode: m })} /> {label}</label>
          ))}
        </fieldset>
        <label className="ls-tech-slider">Detail
          <input type="range" min={0} max={1} step={0.05} value={settings.verbosity} aria-label="How much detail Dr. Wire gives" onChange={e => onSettings({ verbosity: Number(e.target.value) })} />
          <span>{settings.verbosity < 0.34 ? 'Short' : settings.verbosity < 0.67 ? 'Normal' : 'Full'}</span>
        </label>
        <label className="ls-tech-slider">Jokes
          <input type="range" min={0} max={1} step={0.05} value={settings.jokeFreq} aria-label="How often Dr. Wire tells jokes" onChange={e => onSettings({ jokeFreq: Number(e.target.value) })} />
          <span>{settings.jokeFreq === 0 ? 'None' : settings.jokeFreq < 0.4 ? 'Rare' : settings.jokeFreq < 0.75 ? 'Sometimes' : 'Often'}</span>
        </label>
        <form className="ls-tech-ask" onSubmit={e => { e.preventDefault(); const t = q.trim(); if (t) { onAsk(t); setQ(''); } }}>
          <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Ask Dr. Wire anything about the project…" aria-label="Ask Dr. Wire a question" maxLength={400} />
          <button type="submit" className="ls-btn">Ask</button>
        </form>
        <ol className="ls-tech-log" aria-label="What Dr. Wire said">
          {shown.length === 0 && <li className="ls-tech-empty">Nothing yet. He will comment as things happen in the lab.</li>}
          {shown.map(l => (
            <li key={l.id} data-cat={l.category}>
              <span className="ls-tech-time">{fmt(l.at)}</span> <span className="ls-tech-cat">{l.category}</span> {l.text}
              <button type="button" className="ls-tech-why" aria-expanded={open === l.id} onClick={() => setOpen(o => (o === l.id ? null : l.id))}>Why did you say that?</button>
              {open === l.id && <div className="ls-tech-reason" role="note">{l.why}</div>}
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

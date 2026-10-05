import React, { useEffect, useRef, useState } from 'react';
import { Menu, MoreHorizontal, Power, Search, Terminal, Maximize, Minimize2, Target } from 'lucide-react';

type Props = {
  state: any;
  navOptions: { id: string; label: string }[];
  focus: boolean;
  fullscreen: boolean;
  journalOpen: boolean;
  alarms: number;
  onNavigate: (id: string) => void;
  onNavigation: () => void;
  onJournal: () => void;
  onFocus: () => void;
  onFullscreen: () => void;
  onPower: () => void;
  onSearch: () => void;
  onTool: (tool: string) => void;
  onMode: (mode: string) => void;
  onSpeed: (speed: number) => void;
  detailsOpen: boolean;
  onDetails: () => void;
  settings: React.ReactNode;
};

export default function WorkspaceHeader(props: Props) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!toolsRef.current?.contains(e.target as Node)) setToolsOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setToolsOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  const tool = (name: string) => {
    setToolsOpen(false);
    props.onTool(name);
  };
  return (
    <header className="workspace-header">
      <div className="workspace-brand">
        <button type="button" className="chrome-button icon-button" aria-label="Toggle navigation" onClick={props.onNavigation} title="Navigation">
          <Menu size={17} />
        </button>
        <a className="workspace-logo" href="https://spheredesci.org/demo" target="_blank" rel="noreferrer" aria-label="S.P.H.E.R.E. project website">
          <Target size={21} /><span>S.P.H.E.R.E.<small>SIMULATOR</small></span>
        </a>
      </div>
      <select className="workspace-view-select" aria-label="Active workspace" value={props.state.ui.active} onChange={e => props.onNavigate(e.target.value)}>
        {props.navOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
      <div className="workspace-actions">
        <button className="chrome-button icon-button" aria-label="Search commands" title="Search commands (Ctrl/Cmd+K)" onClick={props.onSearch}><Search size={16} /></button>
        <button className={`chrome-button ${props.journalOpen ? 'is-active' : ''}`} aria-label={props.journalOpen ? 'Collapse operations journal' : 'Open operations journal'} aria-expanded={props.journalOpen} aria-controls="operations-journal" onClick={props.onJournal}>
          <Terminal size={16} /><span className="chrome-action-label">Journal</span><span className="chrome-count">{props.state.events.length}</span>
        </button>
        <button className={`chrome-button ${props.focus ? 'is-active' : ''}`} aria-label={props.focus ? 'Exit instrument focus' : 'Focus instrument'} aria-pressed={props.focus} title={props.focus ? 'Restore workspace (Escape)' : 'Focus instrument (F)'} onClick={props.onFocus}>
          {props.focus ? <Minimize2 size={16} /> : <Maximize size={16} />}<span className="chrome-action-label">{props.focus ? 'Exit focus' : 'Focus'}</span>
        </button>
        <button className="chrome-button icon-button" aria-label={props.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title="Browser fullscreen, with focus-mode fallback" onClick={props.onFullscreen}>
          {props.fullscreen ? <Minimize2 size={18} /> : <Maximize size={18} />}
        </button>
        <div className="workspace-tools" ref={toolsRef}>
          <button className="chrome-button icon-button" aria-label="Workspace tools" aria-expanded={toolsOpen} aria-controls="workspace-tools-panel" onClick={() => setToolsOpen(v => !v)}><MoreHorizontal size={20} /></button>
          {toolsOpen && (
            <div id="workspace-tools-panel" className="workspace-tools-panel">
              <strong>Workspace tools</strong>
              <button onClick={() => tool('wizard')}>Startup Wizard</button>
              <button onClick={() => tool('videos')}>Videos</button>
              <button onClick={() => tool('procedure')}>Procedure</button>
              <button onClick={() => tool('glossary')}>Glossary</button>
              <button aria-pressed={props.detailsOpen} onClick={props.onDetails}>{props.detailsOpen ? 'Hide detailed telemetry' : 'Show detailed telemetry'}</button>
              <label>Operating mode
                <select aria-label="Operating mode" value={props.state.facility.mode} onChange={e => props.onMode(e.target.value)}>
                  <option value="training">Training</option><option value="free">Free lab</option><option value="challenge">Challenge</option><option value="peer">Peer review</option>
                </select>
              </label>
              <label>Simulation speed
                <select aria-label="Simulation speed" value={props.state.facility.speed} onChange={e => props.onSpeed(Number(e.target.value))}>
                  <option value={1}>1× real time</option><option value={10}>10× accelerated</option><option value={60}>60× accelerated</option>
                </select>
              </label>
              {props.settings}
              <small>F: focus · Escape: restore · Ctrl/Cmd+K: search</small>
            </div>
          )}
        </div>
        <button className={`chrome-button breaker-button ${props.state.facility.power ? 'power-on' : 'power-off'}`} aria-label={`MAIN BREAKER ${props.state.facility.power ? 'ON' : 'OFF'}`} onClick={props.onPower}>
          <Power size={16} /><span>Power {props.state.facility.power ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </header>
  );
}

import React from 'react';
import { Camera, Eye } from 'lucide-react';
import './features.css';

export type ChamberViewId = 'engineering' | 'schematic' | 'lab';
export type CamPreset = { id: string; label: string; desc: string; eng?: string; lab?: boolean };
export type ViewMode = { id: string; label: string; desc: string; eng?: string; lab?: boolean; flat?: boolean };

/** One list of camera presets for both 3D views. `eng` is the key used by the engineering model, `lab` says the realistic lab has it too. */
export const CAM_PRESETS: CamPreset[] = [
  { id: 'overview', label: 'Whole lab', desc: 'a wide angle on the whole laboratory', eng: 'iso', lab: true },
  { id: 'front', label: 'Front', desc: 'straight on at the chamber door', eng: 'front', lab: true },
  { id: 'top', label: 'Top-down', desc: 'looking straight down from the ceiling', eng: 'top', lab: true },
  { id: 'inside', label: 'Inside chamber', desc: 'the camera sits inside the chamber and looks at the sphere', eng: 'interior', lab: true },
  { id: 'stage', label: 'A/B artifact rail', desc: 'a close-up of the fixed A/B kinematic mounts, 0.40 m apart', eng: 'stage', lab: true },
  { id: 'laser', label: 'Laser path', desc: 'follows the LDV beam from the head to the sphere', eng: 'optical', lab: true },
  { id: 'rf', label: 'RF path', desc: 'follows the RF cable from the rack to the chamber port', eng: 'rf', lab: true },
  { id: 'pumps', label: 'Vacuum & pumps', desc: 'the roughing and turbo pumps and their plumbing', eng: 'vacuum', lab: true },
  { id: 'rack', label: 'Instrument rack', desc: 'the clock, VNA, scope and LDV controllers', eng: 'rack', lab: true },
  { id: 'bench', label: 'Workstation', desc: 'Dr. Wire’s desk and the acquisition computer', lab: true },
];
export const VIEW_MODES: ViewMode[] = [
  { id: 'standard', label: 'Standard', desc: 'the normal look: solid walls', eng: 'lab', lab: true },
  { id: 'cutaway', label: 'Cutaway', desc: 'part of the wall is removed so you can see inside', eng: 'chamber', lab: true },
  { id: 'transparent', label: 'See-through', desc: 'the walls become glass', eng: 'transparent', lab: true },
  { id: 'blueprint', label: 'Blueprint', desc: 'a technical-drawing look', eng: 'lab', lab: true },
  { id: 'exploded', label: 'Exploded', desc: 'every assembly slides apart so you can see each one', eng: 'exploded' },
  { id: 'chain', label: 'Measurement chain', desc: 'fades everything except the parts that carry the measurement', eng: 'chain' },
];

const VIEW_NAME: Record<ChamberViewId, string> = { engineering: 'Engineering model', schematic: 'Engineering schematic', lab: 'Realistic lab' };

export function ChamberViewControls({ view, cam, mode, onCam, onMode, notice, HelpInfo }: { view: ChamberViewId; cam: string; mode: string; onCam: (p: CamPreset) => void; onMode: (m: ViewMode) => void; notice: string; HelpInfo?: any }) {
  const flat = view === 'schematic';
  const camOk = (p: CamPreset) => !flat && (view === 'lab' ? !!p.lab : !!p.eng);
  const modeOk = (m: ViewMode) => !flat && (view === 'lab' ? !!m.lab : true);
  return (
    <>
    <div className="cv-bar" role="region" aria-label="Camera preset and viewing mode" data-chamber-view-controls>
      <div className="cv-row" role="group" aria-label="Camera preset">
        <span className="cv-label"><Camera size={13} aria-hidden="true" /> Camera preset{HelpInfo ? <HelpInfo termKey="camera_preset" /> : null}</span>
        {CAM_PRESETS.map(p => <button key={p.id} type="button" className="cv-btn" aria-pressed={!flat && cam === p.id} disabled={!camOk(p)} title={camOk(p) ? `${p.label}: ${p.desc}` : flat ? 'The schematic is a flat drawing: it has no camera.' : `Not available in the ${VIEW_NAME[view]}.`} onClick={() => onCam(p)}>{p.label}</button>)}
      </div>
      <div className="cv-row" role="group" aria-label="Viewing mode">
        <span className="cv-label"><Eye size={13} aria-hidden="true" /> Viewing mode{HelpInfo ? <HelpInfo termKey="view_mode" /> : null}</span>
        {VIEW_MODES.map(m => <button key={m.id} type="button" className="cv-btn" aria-pressed={!flat && mode === m.id} disabled={!modeOk(m)} title={modeOk(m) ? `${m.label}: ${m.desc}` : flat ? 'The schematic is a flat drawing.' : `Only the Engineering model has “${m.label}”.`} onClick={() => onMode(m)}>{m.label}</button>)}
      </div>
      {notice && !flat && <div className="cv-confirm" role="status" aria-live="polite">✓ {notice}</div>}
    </div>
      {flat
        ? <p className="cv-help cv-help-below"><b>Camera preset</b> and <b>Viewing mode</b> change a 3D view, so they are switched off for the flat schematic. Pick <b>Engineering model</b> or <b>Realistic lab</b> to use them.</p>
        : <p className="cv-help cv-help-below"><b>Camera preset</b> jumps the 3D camera to a ready-made viewpoint, so you can watch a part while you operate it. <b>Viewing mode</b> changes how the chamber walls are drawn (solid, cutaway, see-through, blueprint). You can still drag to turn the view and scroll to zoom afterwards.</p>}
    </>
  );
}

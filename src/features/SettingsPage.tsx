import { memo } from 'react';
import { PRESSURE_UNITS, TEMP_UNITS, setUnits, type PressureUnit, type TempUnit } from './units';
import { setDisplay, type DisplaySettings } from './displaySettings';
import { useDisplay, useUnits } from './useUnits';

const Seg = <T extends string | number>({ label, value, options, onPick, fmt = String }: { label: string; value: T; options: readonly T[]; onPick: (v: T) => void; fmt?: (v: T) => string }) => (
  <fieldset className="rounded border border-zinc-800 bg-zinc-900/60 p-3">
    <legend className="px-1 text-xs font-bold uppercase text-zinc-300">{label}</legend>
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={String(o)} type="button" role="radio" aria-checked={o === value} onClick={() => onPick(o)}
          className={`rounded border px-3 py-1.5 text-xs font-semibold ${o === value ? 'border-sky-400 bg-sky-900 text-white' : 'border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'}`}>
          {o === value ? '✓ ' : ''}{fmt(o)}
        </button>
      ))}
    </div>
  </fieldset>
);

/** Display units and accessibility. Everything here is remembered in this browser only. */
export const SettingsPage = memo(function SettingsPage() {
  const units = useUnits(), d = useDisplay();
  const disp = <K extends keyof DisplaySettings>(k: K) => (v: DisplaySettings[K]) => setDisplay({ [k]: v } as Partial<DisplaySettings>);
  return (
    <div className="space-y-4 p-4" aria-label="Display and units settings">
      <div><h2 className="text-lg font-bold">Display &amp; units</h2><p className="text-xs text-zinc-400">Saved in this browser. Units change what is shown; the simulator, CSV exports and bundles keep Torr, °C and Hz.</p></div>
      <div className="grid gap-3 md:grid-cols-2">
        <Seg<PressureUnit> label="Pressure unit" value={units.pressure} options={PRESSURE_UNITS} onPick={v => setUnits({ pressure: v })} />
        <Seg<TempUnit> label="Temperature unit" value={units.temperature} options={TEMP_UNITS} onPick={v => setUnits({ temperature: v })} />
        <Seg<DisplaySettings['contrast']> label="Contrast" value={d.contrast} options={['normal', 'high']} onPick={disp('contrast')} fmt={v => (v === 'high' ? 'High contrast' : 'Normal')} />
        <Seg<DisplaySettings['textSize']> label="Text size" value={d.textSize} options={[100, 115, 130]} onPick={disp('textSize')} fmt={v => `${v}%`} />
        <Seg<DisplaySettings['motion']> label="Motion" value={d.motion} options={['system', 'reduced']} onPick={disp('motion')} fmt={v => (v === 'reduced' ? 'Reduce motion' : 'Follow system')} />
        <Seg<DisplaySettings['palette']> label="Colours" value={d.palette} options={['default', 'cvd']} onPick={disp('palette')} fmt={v => (v === 'cvd' ? 'Colour-vision safe' : 'Default')} />
      </div>
      <p className="text-xs text-zinc-500">Status is always also given in words, never by colour alone. Units apply to the Live Timeline and the Insights page.</p>
    </div>
  );
});

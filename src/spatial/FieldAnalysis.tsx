import { useMemo } from 'react';
import { LOCATION_HZ_PER_MM } from '../simulation/model';
import { coverage, fitField, suggestPoints, type FieldRecord } from './field';

type Dispatch = (a: { type: string; [k: string]: unknown }) => void;

/** Field model, real coverage and suggested next measurement points for the Spatial Field Explorer. */
export function FieldAnalysis({ records, blind, dispatch, canMove }: { records: FieldRecord[]; blind: boolean; dispatch: Dispatch; canMove: boolean }) {
  const fit = useMemo(() => fitField(records), [records]);
  const why = 'reason' in fit ? fit.reason : '';
  const cov = useMemo(() => coverage(records), [records]);
  const next = useMemo(() => suggestPoints(records, 5), [records]);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl space-y-3 text-xs">
      <div className="text-xs font-bold uppercase text-zinc-300 border-b border-zinc-800 pb-2">Field model and next points</div>
      <div className="flex justify-between text-zinc-400" title="Share of the ±35 mm stage cube within 10 mm of a measured point">
        <span>Coverage (within 10 mm):</span><span className="font-mono text-sky-300">{(cov * 100).toFixed(0)}%</span>
      </div>
      {fit.ok ? (
        <div>
          <div className="mb-1 text-zinc-400">Linear fit of resonance against position ({fit.n} points, R² {fit.r2.toFixed(4)}, residual {fit.rmsResidualHz.toFixed(3)} Hz):</div>
          <table className="w-full text-left"><tbody>
            {fit.coefficients.map(c => (
              <tr key={c.axis} className="border-t border-zinc-900">
                <td className="py-1 font-mono text-sky-200">{c.axis.toUpperCase()}</td>
                <td className="py-1 font-mono">{c.hzPerMm.toFixed(2)} ± {c.sigma.toFixed(2)} Hz/mm</td>
                <td className="py-1 text-right font-mono text-zinc-500">{blind ? 'truth hidden' : `model ${LOCATION_HZ_PER_MM[c.axis]}`}</td>
              </tr>
            ))}
          </tbody></table>
          {fit.unconstrained.length > 0 && <p className="mt-1 text-amber-300">Not measured along {fit.unconstrained.map(a => a.toUpperCase()).join(', ')} (less than 2 mm of spread), so those slopes are unknown.</p>}
          <p className="mt-1 text-[10px] text-zinc-500">± is one standard deviation from the scatter around the fit. Simulated data only.</p>
        </div>
      ) : <p className="text-zinc-500">{why}</p>}
      <div>
        <div className="mb-1 font-bold text-zinc-300">Suggested next points</div>
        {next.length ? (
          <ul className="space-y-1">
            {next.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded border border-zinc-800 px-2 py-1">
                <span><span className="font-mono text-sky-200">{p.x}, {p.y}, {p.z} mm</span><span className="block text-[10px] text-zinc-500">{p.reason}</span></span>
                <button disabled={!canMove} onClick={() => dispatch({ type: 'MOVE_STAGE', position: { x: p.x, y: p.y, z: p.z } })} className="rounded border border-zinc-600 px-2 py-0.5 hover:bg-zinc-800 disabled:opacity-40" title={canMove ? 'Command the stage to this position' : 'Power on the lab first'}>Go</button>
              </li>
            ))}
          </ul>
        ) : <p className="text-zinc-500">The stage is already well covered at this spacing.</p>}
      </div>
    </div>
  );
}

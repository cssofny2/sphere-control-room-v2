// Measurement points for the 3D digital twin: where the stage was when each record was taken, and whether it was good.
export interface MarkerRecord {
  readonly id: string; readonly x: number; readonly y: number; readonly z: number; readonly resonance: number;
  readonly valid?: boolean; readonly excluded?: boolean; readonly fit?: { readonly ok: boolean } | null;
}
export interface PointMarker { readonly id: string; readonly x: number; readonly y: number; readonly z: number; readonly ok: boolean; readonly label: string }
export const MAX_POINT_MARKERS = 200;

/** Newest-first records become at most `max` markers. Excluded records and records with unusable positions are left out. */
export function pointMarkers(records: readonly MarkerRecord[], max = MAX_POINT_MARKERS): PointMarker[] {
  const out: PointMarker[] = [];
  for (const r of records) {
    if (out.length >= max) break;
    if (r.excluded || ![r.x, r.y, r.z].every(Number.isFinite)) continue;
    const ok = r.valid !== false && r.fit?.ok !== false;
    out.push({ id: r.id, x: r.x, y: r.y, z: r.z, ok, label: `${r.x.toFixed(1)}, ${r.y.toFixed(1)}, ${r.z.toFixed(1)} mm: ${Number.isFinite(r.resonance) ? r.resonance.toFixed(2) + ' Hz' : 'no resonance'} (${ok ? 'valid' : 'suspect or failed'})` });
  }
  return out;
}

/** Marker radius in screen pixels for a camera `dist` from the scene: larger when zoomed in, never tiny or huge. */
export const markerRadius = (dist: number): number => Math.max(2.5, Math.min(6.5, 1700 / Math.max(1, dist)));

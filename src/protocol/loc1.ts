export const LOC1_SCHEMA_ID = 'SPHERE-LOC1-provisional';
export const LOC1_SCHEMA_VERSION = '0.1';

export const LOC1_FIELDS = [
  'record_id',
  'run_id',
  'monotonic_time_s',
  'utc_timestamp',
  'artifact_id',
  'artifact_role',
  'physical_position',
  'placement_sequence',
  'placement_iteration',
  'orientation_deg',
  'chamber_temperature_C',
  'temperature_gradient_K_per_m',
  'atmospheric_pressure_Pa',
  'time_since_placement_s',
  'reference_frequency_hz',
  'measured_frequency_hz',
  'baseline_ratio',
  'normalized_contrast_ppb',
  'standard_uncertainty_ppb',
  'clock_locked',
  'acquisition_status',
  'configuration_hash',
  'data_origin',
  'software_version',
  'notes',
] as const;

export type Loc1Field = typeof LOC1_FIELDS[number];
export type Loc1Record = Record<Loc1Field, string | number | boolean | null>;

const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** Project legacy simulator measurements without inventing LOC-1 physical measurements. */
export function toLoc1Record(record: Record<string, any>, index: number, configurationHash: string): Loc1Record {
  const contract = record.contract || {};
  const settings = contract.settings || {};
  const f0 = finite(record.resonance);
  const shift = finite(record.resonanceShift);
  const timestamp = typeof record.timestamp === 'string' && !Number.isNaN(Date.parse(record.timestamp))
    ? new Date(record.timestamp).toISOString()
    : null;
  const coordinates = [finite(record.x), finite(record.y), finite(record.z)];
  const xyzAvailable = coordinates.every(value => value !== null);
  return {
    record_id: typeof record.id === 'string' ? record.id : `record-${index + 1}`,
    run_id: typeof record.runId === 'string' ? record.runId : null,
    monotonic_time_s: finite(contract.simulationTime) ?? finite(record.simulationTime) ?? null,
    utc_timestamp: timestamp,
    artifact_id: null,
    artifact_role: null,
    physical_position: xyzAvailable ? 'LEGACY_XYZ_MM' : null,
    placement_sequence: finite(record.sequence),
    placement_iteration: finite(record.repeatIndex),
    orientation_deg: null,
    chamber_temperature_C: finite(record.temp),
    temperature_gradient_K_per_m: null,
    atmospheric_pressure_Pa: finite(record.pressure) === null ? null : Number((Number(record.pressure) * 133.322368).toFixed(6)),
    time_since_placement_s: null,
    reference_frequency_hz: null,
    measured_frequency_hz: f0,
    baseline_ratio: null,
    normalized_contrast_ppb: shift === null ? null : Number((shift / 230500 * 1e9).toFixed(6)),
    standard_uncertainty_ppb: finite(record.uncertaintyHz) === null ? null : Number((Number(record.uncertaintyHz) / 230500 * 1e9).toFixed(6)),
    clock_locked: typeof record.clockLocked === 'boolean' ? record.clockLocked : null,
    acquisition_status: record.valid === false || record.excluded ? 'INVALID' : 'SIMULATED',
    configuration_hash: configurationHash || null,
    data_origin: record.dataOrigin === 'imported' ? 'IMPORTED' : 'SYNTHETIC',
    software_version: typeof record.modelVersion === 'string' ? record.modelVersion : null,
    notes: typeof record.note === 'string' ? record.note : null,
  };
}

export function toLoc1Csv(rows: readonly Loc1Record[]): string {
  const quote = (value: string | number | boolean | null): string => {
    const text = value === null ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [LOC1_FIELDS.map(quote).join(','), ...rows.map(row => LOC1_FIELDS.map(field => quote(row[field])).join(','))].join('\n');
}

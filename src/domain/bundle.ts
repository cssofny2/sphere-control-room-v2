// Reproducibility bundle: one portable, versioned, checksummed file holding a session's measurements and notes, with the
// model and app versions needed to interpret (and re-check) them. Import validates everything before it touches the app.
import { MODEL_VERSION } from './run';
import { LOC1_FIELDS, LOC1_SCHEMA_ID, LOC1_SCHEMA_VERSION, toLoc1Record, type Loc1Record } from '../protocol/loc1';

export const BUNDLE_FORMAT = 'sphere-repro-bundle';
export const BUNDLE_SCHEMA_VERSION = 1 as const;
export const MAX_BUNDLE_BYTES = 25 * 1024 * 1024;
export const MAX_BUNDLE_RECORDS = 50_000;
export const MAX_BUNDLE_NOTES = 300;

export type BundleRecord = { id: string; runId: string; x: number; y: number; z: number; resonance: number; [k: string]: unknown };

export interface BundlePayload {
  readonly format: typeof BUNDLE_FORMAT;
  readonly schemaVersion: typeof BUNDLE_SCHEMA_VERSION;
  readonly modelVersion: string;
  readonly app: { readonly version: string; readonly commit: string };
  readonly createdAt: string;
  readonly dataOrigin: 'simulation';
  readonly citation: { readonly title: string; readonly author: string; readonly orcid: string; readonly url: string; readonly note: string };
  readonly runs: ReadonlyArray<{ readonly runId: string; readonly records: number }>;
  readonly records: readonly BundleRecord[];
  readonly loc1Schema?: { readonly id: string; readonly version: string; readonly fields: readonly string[] };
  readonly loc1Records?: readonly Loc1Record[];
  readonly notebook: ReadonlyArray<Record<string, unknown>>;
}
export interface Bundle extends BundlePayload { readonly checksum: { readonly algorithm: 'SHA-256'; readonly value: string } }

export interface BundleIssue { readonly path: string; readonly message: string }
export type BundleCheck =
  | { readonly ok: true; readonly bundle: Bundle; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly issues: readonly BundleIssue[] };

/** JSON with sorted keys, so the same data always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface BuildInput { records: readonly BundleRecord[]; notebook: ReadonlyArray<Record<string, unknown>>; appVersion: string; commit: string; now?: Date }

export async function buildBundle(input: BuildInput): Promise<Bundle> {
  const counts = new Map<string, number>();
  for (const r of input.records) counts.set(r.runId, (counts.get(r.runId) ?? 0) + 1);
  const configHashes = new Map<string, string>();
  const loc1Records = await Promise.all(input.records.map(async (record, index) => {
    const contract = isObj(record.contract) ? record.contract : {};
    const settings = isObj(contract.settings) ? contract.settings : {};
    const config = canonicalJson(settings);
    let hash = configHashes.get(config);
    if (!hash) { hash = await sha256Hex(config); configHashes.set(config, hash); }
    return toLoc1Record(record, index, hash);
  }));
  const payload: BundlePayload = {
    format: BUNDLE_FORMAT, schemaVersion: BUNDLE_SCHEMA_VERSION, modelVersion: MODEL_VERSION,
    app: { version: input.appVersion, commit: input.commit }, createdAt: (input.now ?? new Date()).toISOString(), dataOrigin: 'simulation',
    citation: { title: 'S.P.H.E.R.E. Metrology Lab', author: 'Michael P. Goodman', orcid: 'https://orcid.org/0009-0008-3796-5857', url: 'https://lab.spheredesci.org',
      note: 'Simulated teaching data. Not experimental evidence.' },
    runs: [...counts].map(([runId, records]) => ({ runId, records })),
    records: input.records,
    loc1Schema: { id: LOC1_SCHEMA_ID, version: LOC1_SCHEMA_VERSION, fields: LOC1_FIELDS },
    loc1Records,
    notebook: input.notebook,
  };
  return { ...payload, checksum: { algorithm: 'SHA-256', value: await sha256Hex(canonicalJson(payload)) } };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

/** Rejects prototype-pollution keys and absurd nesting anywhere in the parsed JSON. */
function scan(v: unknown, path: string, depth: number, issues: BundleIssue[]): void {
  if (issues.length > 20) return;
  if (depth > 12) { issues.push({ path, message: 'Nesting is too deep.' }); return; }
  if (Array.isArray(v)) { v.forEach((x, i) => { if (typeof x === 'object' && x !== null) scan(x, `${path}[${i}]`, depth + 1, issues); }); return; }
  if (isObj(v)) for (const k of Object.keys(v)) {
    if (FORBIDDEN.has(k)) { issues.push({ path: `${path}.${k}`, message: `Forbidden key "${k}".` }); continue; }
    if (typeof v[k] === 'object' && v[k] !== null) scan(v[k], `${path}.${k}`, depth + 1, issues);
  }
}

export async function validateBundle(raw: unknown, sizeBytes = 0): Promise<BundleCheck> {
  const issues: BundleIssue[] = [];
  if (sizeBytes > MAX_BUNDLE_BYTES) return { ok: false, issues: [{ path: '(file)', message: `File is larger than ${MAX_BUNDLE_BYTES / 1048576} MB.` }] };
  if (!isObj(raw)) return { ok: false, issues: [{ path: '(root)', message: 'Not a JSON object.' }] };
  scan(raw, '$', 0, issues);
  if (issues.length) return { ok: false, issues };
  if (raw.format !== BUNDLE_FORMAT) issues.push({ path: 'format', message: `Expected "${BUNDLE_FORMAT}".` });
  if (raw.schemaVersion !== BUNDLE_SCHEMA_VERSION) issues.push({ path: 'schemaVersion', message: `Unsupported schema version ${String(raw.schemaVersion)}; this app reads ${BUNDLE_SCHEMA_VERSION}.` });
  if (typeof raw.modelVersion !== 'string') issues.push({ path: 'modelVersion', message: 'Missing model version.' });
  if (!Array.isArray(raw.records)) issues.push({ path: 'records', message: 'records must be an array.' });
  else if (raw.records.length > MAX_BUNDLE_RECORDS) issues.push({ path: 'records', message: `At most ${MAX_BUNDLE_RECORDS} records.` });
  if (raw.loc1Schema !== undefined || raw.loc1Records !== undefined) {
    if (!isObj(raw.loc1Schema) || raw.loc1Schema.id !== LOC1_SCHEMA_ID || raw.loc1Schema.version !== LOC1_SCHEMA_VERSION ||
        !Array.isArray(raw.loc1Schema.fields) || canonicalJson(raw.loc1Schema.fields) !== canonicalJson(LOC1_FIELDS)) {
      issues.push({ path: 'loc1Schema', message: 'Unsupported or malformed provisional LOC-1 schema.' });
    }
    if (!Array.isArray(raw.loc1Records) || !Array.isArray(raw.records) || raw.loc1Records.length !== raw.records.length) {
      issues.push({ path: 'loc1Records', message: 'LOC-1 records must align one-to-one with the source record ledger.' });
    } else {
      raw.loc1Records.forEach((value, index) => {
        if (!isObj(value)) { issues.push({ path: `loc1Records[${index}]`, message: 'Not an object.' }); return; }
        const keys = Object.keys(value);
        if (keys.length !== LOC1_FIELDS.length || LOC1_FIELDS.some(field => !Object.prototype.hasOwnProperty.call(value, field))) {
          issues.push({ path: `loc1Records[${index}]`, message: 'Record must contain exactly the 25 declared schema fields.' });
        }
        for (const field of LOC1_FIELDS) {
          const entry = value[field];
          if (entry !== null && typeof entry !== 'string' && typeof entry !== 'number' && typeof entry !== 'boolean') {
            issues.push({ path: `loc1Records[${index}].${field}`, message: 'Must be a string, finite number, boolean, or null.' });
          }
          if (typeof entry === 'number' && !Number.isFinite(entry)) issues.push({ path: `loc1Records[${index}].${field}`, message: 'Must be finite.' });
        }
      });
    }
  }
  if (!Array.isArray(raw.notebook)) issues.push({ path: 'notebook', message: 'notebook must be an array.' });
  else if (raw.notebook.length > MAX_BUNDLE_NOTES) issues.push({ path: 'notebook', message: `At most ${MAX_BUNDLE_NOTES} notebook entries.` });
  if (!isObj(raw.checksum) || raw.checksum.algorithm !== 'SHA-256' || typeof raw.checksum.value !== 'string') issues.push({ path: 'checksum', message: 'Missing SHA-256 checksum.' });
  if (issues.length) return { ok: false, issues };

  const records = raw.records as unknown[];
  const seen = new Set<string>();
  records.forEach((r, i) => {
    if (issues.length > 20) return;
    if (!isObj(r)) { issues.push({ path: `records[${i}]`, message: 'Not an object.' }); return; }
    if (typeof r.id !== 'string' || !r.id) issues.push({ path: `records[${i}].id`, message: 'Missing id.' });
    else if (seen.has(r.id)) issues.push({ path: `records[${i}].id`, message: `Duplicate id ${r.id}.` });
    else seen.add(r.id);
    if (typeof r.runId !== 'string') issues.push({ path: `records[${i}].runId`, message: 'Missing runId.' });
    for (const k of ['x', 'y', 'z', 'resonance'] as const) if (!fin(r[k])) issues.push({ path: `records[${i}].${k}`, message: 'Must be a finite number.' });
    for (const k of ['x', 'y', 'z'] as const) if (fin(r[k]) && Math.abs(r[k] as number) > 35) issues.push({ path: `records[${i}].${k}`, message: 'Outside the ±35 mm stage travel.' });
    if (r.uncertaintyHz !== undefined && !(fin(r.uncertaintyHz) && r.uncertaintyHz >= 0)) issues.push({ path: `records[${i}].uncertaintyHz`, message: 'Must be a finite number ≥ 0.' });
  });
  (raw.notebook as unknown[]).forEach((n, i) => { if (!isObj(n)) issues.push({ path: `notebook[${i}]`, message: 'Not an object.' }); });
  if (issues.length) return { ok: false, issues };

  const { checksum, ...payload } = raw as Record<string, unknown> & { checksum: { value: string } };
  if (await sha256Hex(canonicalJson(payload)) !== checksum.value) return { ok: false, issues: [{ path: 'checksum', message: 'Checksum mismatch: the file was changed after export or is damaged.' }] };
  const warnings: string[] = [];
  if (raw.modelVersion !== MODEL_VERSION) warnings.push(`Made with model ${String(raw.modelVersion)}; this app runs ${MODEL_VERSION}. Values are kept as recorded and cannot be re-verified.`);
  if (raw.dataOrigin !== 'simulation') warnings.push('Data origin is not marked as simulation.');
  return { ok: true, bundle: raw as unknown as Bundle, warnings };
}

// ── CSV import ──────────────────────────────────────────────────────────────────────────────────
export const MAX_CSV_BYTES = 10 * 1024 * 1024;

/** RFC 4180 parser: quoted fields, doubled quotes, CRLF, embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); field = ''; if (row.some(f => f !== '')) rows.push(row); row = []; }
    else field += c;
  }
  row.push(field); if (row.some(f => f !== '')) rows.push(row);
  return rows;
}

export const CSV_FIELDS = ['x', 'y', 'z', 'resonance', 'timestamp', 'q', 'uncertaintyHz', 'runId'] as const;
export type CsvField = typeof CSV_FIELDS[number];
const ALIASES: Record<CsvField, RegExp> = {
  x: /^(x|x_?mm|x \(mm\))$/i, y: /^(y|y_?mm|y \(mm\))$/i, z: /^(z|z_?mm|z \(mm\))$/i,
  resonance: /^(resonance(_?hz)?|f0(_?hz)?|freq(uency)?(_?hz)?)$/i, timestamp: /^(time(stamp)?|date)$/i,
  q: /^(q|q_?factor)$/i, uncertaintyHz: /^(u(ncertainty)?(_?hz)?|sigma(_?hz)?)$/i, runId: /^(run_?id|run)$/i,
};
export function autoMap(headers: readonly string[]): Partial<Record<CsvField, number>> {
  const map: Partial<Record<CsvField, number>> = {};
  for (const f of CSV_FIELDS) { const i = headers.findIndex((h, j) => ALIASES[f].test(h.trim()) && !Object.values(map).includes(j)); if (i >= 0) map[f] = i; }
  return map;
}

export interface CsvResult { records: BundleRecord[]; issues: BundleIssue[]; missing: CsvField[] }
export function csvToRecords(rows: readonly string[][], map: Partial<Record<CsvField, number>>, runId: string, idPrefix = 'import'): CsvResult {
  const missing = (['x', 'y', 'z', 'resonance'] as const).filter(f => map[f] === undefined);
  if (missing.length) return { records: [], issues: [{ path: 'columns', message: `Could not find column(s): ${missing.join(', ')}.` }], missing };
  const records: BundleRecord[] = [], issues: BundleIssue[] = [];
  for (let i = 1; i < rows.length; i++) {
    if (records.length >= MAX_BUNDLE_RECORDS) { issues.push({ path: 'rows', message: `Stopped at ${MAX_BUNDLE_RECORDS} rows.` }); break; }
    const get = (f: CsvField) => (map[f] === undefined ? undefined : rows[i][map[f] as number]);
    const num = (f: CsvField) => { const t = get(f); return t === undefined || t.trim() === '' ? NaN : Number(t); };
    const x = num('x'), y = num('y'), z = num('z'), resonance = num('resonance');
    if (![x, y, z, resonance].every(Number.isFinite)) { if (issues.length < 20) issues.push({ path: `row ${i + 1}`, message: 'Skipped: x, y, z and resonance must be numbers.' }); continue; }
    if ([x, y, z].some(v => Math.abs(v) > 35)) { if (issues.length < 20) issues.push({ path: `row ${i + 1}`, message: 'Skipped: position outside ±35 mm.' }); continue; }
    const ts = get('timestamp'), t = ts ? new Date(ts) : null;
    const u = num('uncertaintyHz'), q = num('q');
    records.push({
      id: `${idPrefix}-${i}`, runId: (get('runId') || runId).trim() || runId, x, y, z, resonance, resonanceShift: resonance - 230500,
      timestamp: t && !Number.isNaN(t.getTime()) ? t.toISOString() : new Date(0).toISOString(),
      ...(Number.isFinite(q) ? { q } : {}), ...(Number.isFinite(u) && u >= 0 ? { uncertaintyHz: u } : {}),
      valid: true, dataOrigin: 'imported', note: 'Imported from CSV',
    });
  }
  return { records, issues, missing: [] };
}

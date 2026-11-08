// Guided lessons. Each lesson is data plus pure checks over the lab state, so every one can be tested without the UI.
// Objectives are sticky: once a student has met one it stays met, even if they change the lab afterwards (see engine.ts).
import { LOCATION_HZ_PER_MM, THERMAL_HZ_PER_C } from '../simulation/model';
import { summarizePositions } from '../simulation/stats';
import { fitField } from '../spatial/field';

/** The slice of simulator state the checks read. The full app state satisfies this structurally. */
export interface LabLike {
  facility?: { power?: boolean };
  clock?: { locked?: boolean };
  chamber?: { pressure?: number; vent?: boolean; faraday?: boolean; isolation?: boolean };
  vna?: { power?: boolean; rf?: boolean; calibrated?: boolean; averagingEnabled?: boolean; averagingCount?: number; lastMetrics?: { uncertaintyHz?: number; fitOk?: boolean } | null };
  failures?: Record<string, boolean>;
  experiment?: { randomized?: boolean; records?: ReadonlyArray<LessonRecord> };
}
export interface LessonRecord {
  x: number; y: number; z: number; resonance: number; temp?: number; pointId?: string | null; uncertaintyHz?: number;
  fit?: { ok: boolean } | null; excluded?: boolean; repeatIndex?: number; attemptIndex?: number;
}
export interface CheckContext { readonly state: LabLike; readonly answers: Readonly<Record<string, number>> }

export interface Objective { readonly id: string; readonly text: string; readonly weight?: number; readonly check: (c: CheckContext) => boolean }
export interface Lesson {
  readonly id: string;
  readonly level: 1 | 2 | 3;
  readonly title: string;
  readonly goal: string;
  readonly objectives: readonly Objective[];
  /** When true an objective only counts once every earlier one is met (for lessons about undoing something that must happen first). */
  readonly ordered?: boolean;
  /** Hints from gentle to explicit. Using them lowers the score. */
  readonly hints: readonly string[];
  /** Lab actions applied by "Set up this lesson" (e.g. injecting the fault to diagnose). */
  readonly setup?: ReadonlyArray<{ type: string; [k: string]: unknown }>;
  /** A number the student must work out and type in; graded against their own data and the model. */
  readonly question?: { readonly label: string; readonly unit: string };
}

const records = (s: LabLike) => (s.experiment?.records ?? []).filter(r => !r.excluded && r.fit?.ok !== false);

function slope(xs: number[], ys: number[]): number | null {
  const n = xs.length; if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0; xs.forEach((x, i) => { sxx += (x - mx) ** 2; sxy += (x - mx) * (ys[i] - my); });
  return sxx > 1e-9 ? sxy / sxx : null;
}
const spread = (v: number[]) => (v.length ? Math.max(...v) - Math.min(...v) : 0);

export const LESSONS: readonly Lesson[] = [
  {
    id: 'bring-up', level: 1, title: 'Bring the lab up', goal: 'Power the facility and get the instruments ready to measure.',
    objectives: [
      { id: 'power', text: 'Switch the main breaker on', check: ({ state }) => !!state.facility?.power },
      { id: 'clock', text: 'Wait for the Rubidium clock to lock', check: ({ state }) => !!state.clock?.locked },
      { id: 'vacuum', text: 'Pump the chamber below 1e-3 Torr', check: ({ state }) => !state.chamber?.vent && (state.chamber?.pressure ?? Infinity) < 1e-3 },
      { id: 'vna', text: 'Power the VNA and switch its RF output on', check: ({ state }) => !!state.vna?.power && !!state.vna?.rf },
    ],
    hints: ['The Startup Wizard under Workspace tools walks through the order.', 'The clock needs about 15 simulated seconds to lock; pumps take longer. Use 10× or 60× speed.', 'Start the roughing pump first; the turbo only starts below 50 Torr.'],
  },
  {
    id: 'first-sweep', level: 1, title: 'Calibrate and take a first sweep', goal: 'Calibrate the VNA and capture a trace with a fitted resonance.',
    objectives: [
      { id: 'cal', text: 'Calibrate the VNA', check: ({ state }) => !!state.vna?.calibrated },
      { id: 'sweep', text: 'Take a sweep that produces a successful resonance fit', check: ({ state }) => state.vna?.lastMetrics?.fitOk === true },
    ],
    hints: ['Open VNA Analysis and use the Calibrate Wizard.', 'The lab must be powered, the VNA on with RF output, before a sweep is accepted.'],
  },
  {
    id: 'quiet-trace', level: 1, title: 'Shield the measurement', goal: 'Remove outside noise and see the uncertainty fall.',
    objectives: [
      { id: 'cage', text: 'Switch the Faraday cage on', check: ({ state }) => !!state.chamber?.faraday },
      { id: 'iso', text: 'Float the vibration isolation platform', check: ({ state }) => !!state.chamber?.isolation },
      { id: 'quiet', text: 'Take a sweep whose resonance uncertainty is 0.1 Hz or better', check: ({ state }) => (state.vna?.lastMetrics?.uncertaintyHz ?? Infinity) <= 0.1 && state.vna?.lastMetrics?.fitOk === true },
    ],
    hints: ['Both switches are on the 3D Chamber page.', 'Noise shows up in the fit uncertainty on the VNA page after each sweep.'],
  },
  {
    id: 'clock-fault', level: 2, title: 'Diagnose a clock fault', goal: 'A reference fault has been injected. Find it, clear it and get the lock back.',
    setup: [{ type: 'SET_FAILURE', key: 'clockDrift', value: true }],
    ordered: true,
    objectives: [
      { id: 'inject', text: 'Press “Set up this lesson” to inject the fault and see the symptoms', check: ({ state }) => state.failures?.clockDrift === true },
      { id: 'clear', text: 'Clear the clock drift fault', check: ({ state }) => state.failures?.clockDrift === false },
      { id: 'lock', text: 'Have the clock locked again', check: ({ state }) => !!state.clock?.locked },
    ],
    hints: ['The alarm list and the Frequency Reference page show what is wrong.', 'The Fault Injector page can clear an injected fault.', 'After clearing, the clock may need to re-lock; give it simulated time.'],
  },
  {
    id: 'averaging', level: 2, title: 'Beat the noise with averaging', goal: 'Average many sweeps and watch the uncertainty shrink.',
    objectives: [
      { id: 'avg', text: 'Turn trace averaging on with a count of at least 16', check: ({ state }) => !!state.vna?.averagingEnabled && (state.vna?.averagingCount ?? 0) >= 16 },
      { id: 'tight', text: 'Take a sweep with resonance uncertainty of 0.02 Hz or better', check: ({ state }) => (state.vna?.lastMetrics?.uncertaintyHz ?? Infinity) <= 0.02 && state.vna?.lastMetrics?.fitOk === true },
    ],
    hints: ['Averaging is in the VNA stimulus controls.', 'Uncertainty falls roughly with the square root of the count; a narrower IFBW helps too.'],
  },
  {
    id: 'thermal', level: 2, title: 'Find the thermal coefficient', goal: 'Measure how the resonance moves with chamber temperature, and say how many Hz per °C.',
    question: { label: 'Resonance shift per °C', unit: 'Hz/°C' },
    objectives: [
      { id: 'temps', text: 'Record measurements at three temperatures at least 2 °C apart in total', check: ({ state }) => { const t = records(state).map(r => r.temp).filter((v): v is number => typeof v === 'number'); return t.length >= 3 && spread(t) >= 2; } },
      { id: 'answer', text: 'Enter a coefficient that matches your own data (within 0.5 Hz/°C) and the model (within 1)', check: ({ state, answers }) => {
        const rs = records(state).filter(r => typeof r.temp === 'number'); const s = slope(rs.map(r => r.temp as number), rs.map(r => r.resonance)); const a = answers.thermal;
        return s !== null && typeof a === 'number' && Math.abs(a - s) <= 0.5 && Math.abs(a - THERMAL_HZ_PER_C) <= 1; } },
    ],
    hints: ['Change the thermostat setpoint, wait for the temperature to settle, then record a measurement in a run.', 'Fit a straight line to resonance against temperature; the slope is the answer.', 'Keep position, pressure and the clock constant so only temperature changes.'],
  },
  {
    id: 'location', level: 3, title: 'Map the location sensitivity', goal: 'Move the sphere along each axis and find how strongly the resonance depends on Z.',
    question: { label: 'Z sensitivity', unit: 'Hz/mm' },
    objectives: [
      { id: 'span', text: 'Measure with at least 10 mm of spread along X, Y and Z', check: ({ state }) => { const r = records(state); return spread(r.map(p => p.x)) >= 10 && spread(r.map(p => p.y)) >= 10 && spread(r.map(p => p.z)) >= 10; } },
      { id: 'answer', text: 'Enter a Z sensitivity that matches your fit (within 2 Hz/mm) and the model (within 5)', check: ({ state, answers }) => {
        const f = fitField(records(state)); const a = answers.location; if (!f.ok || typeof a !== 'number') return false;
        const z = f.coefficients.find(c => c.axis === 'z'); return !!z && Math.abs(a - z.hzPerMm) <= Math.max(2, 2 * z.sigma) && Math.abs(a - LOCATION_HZ_PER_MM.z) <= 5; } },
    ],
    hints: ['Use the Spatial Field page: suggested next points include the corners.', 'Vary one axis at a time at first so the effects separate.', 'The field model on the Spatial Field page shows the fitted slope for each axis.'],
  },
  {
    id: 'repeatability', level: 3, title: 'Show your repeatability', goal: 'Run a randomized plan with repeats and show every position is known to better than 1 Hz.',
    objectives: [
      { id: 'random', text: 'Use a randomized plan order', check: ({ state }) => !!state.experiment?.randomized },
      { id: 'repeats', text: 'Measure at least 3 positions with at least 3 repeats each', check: ({ state }) => summarizePositions(records(state)).filter(s => s.n >= 3).length >= 3 },
      { id: 'tight', text: 'Have every such position known to within 1 Hz at 95 %', check: ({ state }) => { const s = summarizePositions(records(state)).filter(p => p.n >= 3); return s.length >= 3 && s.every(p => p.expandedUncertaintyHz !== null && p.expandedUncertaintyHz < 1); } },
    ],
    hints: ['Set repeats per position to 3 or more in the Plan Builder and tick randomized order.', 'Wait for the stage to settle and the temperature to hold so repeats agree.', 'The Repeatability table on Experiment Runs shows the 95 % figure.'],
  },
];

export const LESSON_BY_ID: Readonly<Record<string, Lesson>> = Object.fromEntries(LESSONS.map(l => [l.id, l]));

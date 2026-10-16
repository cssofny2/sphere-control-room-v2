// Everything Dr. Wire knows about the live experiment, read from the app's state object.
import { extractFacts, type Facts } from '../labscene/scientistBrain';

export type FactsPlus = Facts & {
  temperature: number;       // °C
  setpoint: number;          // °C
  opticalQuality: number;    // 0..100
  calAge: number;            // seconds since VNA calibration
  pos: { x: number; y: number; z: number };      // commanded stage position, mm
  positionError: number;     // mm
  clampActive: boolean;
  blindDrill: boolean;       // a hidden fault drill is running and has not been revealed
  simTime: number;           // simulated seconds
  scanKind: string;
  openAlarmsCritical: number;
};

export function extractFactsPlus(s: any): FactsPlus {
  const f = extractFacts(s);
  const c = s.chamber, st = s.stage, v = s.vna, l = s.ldv, d = s.faultDrill || {};
  return {
    ...f,
    temperature: c.temperature, setpoint: c.targetTemp,
    opticalQuality: l.opticalQuality ?? 100,
    calAge: v.calibrationAgeSeconds ?? 0,
    pos: { x: st.x ?? 0, y: st.y ?? 0, z: st.z ?? 0 },
    positionError: st.positionError ?? 0,
    clampActive: !!st.clampActive,
    blindDrill: !!(d.hiddenKey && !d.revealed),
    simTime: s.facility.simulationTime ?? 0,
    scanKind: s.experiment?.scanStep ?? 'idle',
    openAlarmsCritical: f.alarms.filter(a => a.severity === 'critical').length,
  };
}

export type Rule = { id: string; label: string; pass: boolean; detail: string };

/** Mirrors the app's measurement-validation rules (getMeasurementValidation) in plain terms. */
export function readiness(f: FactsPlus): { ready: boolean; rules: Rule[] } {
  const rules: Rule[] = [
    { id: 'clock', label: 'Rubidium clock locked', pass: f.clockLocked && !f.failures.clockDrift, detail: f.clockLocked ? 'locked' : 'not locked' },
    { id: 'vacuum', label: 'Pressure below 1e-3 Torr', pass: f.pressure < 1e-3 && !f.failures.vacuumLeak, detail: fmtPressure(f.pressure) },
    { id: 'thermal', label: 'Temperature within 0.03 °C of setpoint', pass: Math.abs(f.tempDiff) < 0.03, detail: `${f.tempDiff >= 0 ? '+' : ''}${f.tempDiff.toFixed(3)} °C` },
    { id: 'faraday', label: 'Faraday cage on', pass: f.faraday, detail: f.faraday ? 'on' : 'off' },
    { id: 'isolation', label: 'Vibration isolation on', pass: f.isolation, detail: f.isolation ? 'on' : 'off' },
    { id: 'stage', label: 'Stage settled, clamp released', pass: !f.stageMoving && !f.stageSettling && !f.clampActive && f.positionError < 0.075, detail: f.stageMoving ? 'moving' : f.stageSettling ? 'settling' : f.clampActive ? 'clamp engaged' : 'settled' },
    { id: 'vna', label: 'VNA calibrated (under 1 hour old)', pass: f.calibrated && f.calAge < 3600, detail: f.calibrated ? `${Math.round(f.calAge / 60)} min old` : 'not calibrated' },
  ];
  return { ready: rules.every(r => r.pass), rules };
}

export function fmtPressure(p: number): string {
  if (!isFinite(p)) return 'unknown';
  if (p >= 100) return `${p.toFixed(0)} Torr`;
  if (p >= 1) return `${p.toFixed(1)} Torr`;
  return `${p.toExponential(1).replace('e-', 'e-')} Torr`;
}

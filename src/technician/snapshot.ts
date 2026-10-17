// A small summary of the live lab that is sent to the language model with every turn.
import { readiness, fmtPressure, type FactsPlus } from './facts';

export type Snapshot = ReturnType<typeof buildSnapshot>;

export function buildSnapshot(f: FactsPlus, extra: { task?: string | null; pendingConfirm?: string | null; localTime?: string; shift?: string; operator?: string | null } = {}) {
  const rd = readiness(f);
  return {
    power: f.power,
    clock: !f.clockPower ? 'off' : f.clockLocked ? 'locked' : 'warming up',
    chamber: {
      pressure: fmtPressure(f.pressure), state: f.vent ? 'venting/vented' : f.turbo ? 'turbo running' : f.roughing ? 'roughing' : 'pumps off',
      door: f.doorOpen ? 'open' : 'closed', temperatureC: Number(f.temperature.toFixed(3)), setpointC: f.setpoint, faraday: f.faraday, isolation: f.isolation,
    },
    vna: { power: f.vnaPower, rf: f.rf, calibrated: f.calibrated, calibrationAgeMin: Math.round(f.calAge / 60) },
    ldv: { power: f.ldvPower, shutter: f.shutter ? 'open (laser emitting)' : 'closed', opticalQuality: Math.round(f.opticalQuality) },
    stage: { x: f.pos.x, y: f.pos.y, z: f.pos.z, state: f.stageMoving ? 'moving' : f.stageSettling ? 'settling' : 'settled', homed: f.homed, clamp: f.clampActive },
    scan: { active: f.scanActive, progressPct: Math.round(f.scanProgress * 100), records: f.records, accepted: f.accepted, suspect: f.suspect, failed: f.failed },
    openAlarms: f.alarms.slice(0, 5).map(a => `${a.severity}: ${a.text.slice(0, 120)}`),
    activeFaults: f.blindDrill ? 'hidden fault drill running (do not name the fault)' : Object.entries(f.failures).filter(([, v]) => v).map(([k]) => k),
    readyToMeasure: rd.ready, failingChecks: rd.rules.filter(r => !r.pass).map(r => `${r.label} (${r.detail})`),
    operatorName: extra.operator || null, localTime: extra.localTime || null, shift: extra.shift || null,
    currentTask: extra.task || null, waitingForConfirmation: extra.pendingConfirm || null,
  };
}

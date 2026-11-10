// "What is being used right now?" — one list of every piece of equipment with a plain sentence about what it is
// doing at this instant. The live operation window, the lab map and the 3D lab's "inside the chamber" view all read it,
// so the three always agree.
import { getAlert, type AlertLevel } from './alerts';

export type EquipId = 'breaker' | 'clock' | 'vna' | 'rf' | 'scope' | 'ldv' | 'rough' | 'turbo' | 'vent' | 'thermo' | 'faraday' | 'isolation' | 'stage' | 'door' | 'daq';
export type EquipGroup = 'power' | 'reference' | 'instrument' | 'vacuum' | 'environment' | 'motion' | 'data';
export type EquipUse = {
  id: EquipId; name: string; group: EquipGroup; page: string;
  /** Powered / switched on. */
  on: boolean;
  /** Doing real work at this instant (this is what gets highlighted). */
  active: boolean;
  level: AlertLevel;
  /** One plain sentence: what it is doing right now. */
  doing: string;
  /** Why the experiment needs it. */
  why: string;
};

export const EQUIP_COLOR: Record<EquipGroup, string> = { power: '#fbbf24', reference: '#22d3ee', instrument: '#5fd4ff', vacuum: '#94a3b8', environment: '#a78bfa', motion: '#c084fc', data: '#34d399' };
const fmtP = (p: number) => (p >= 10 ? `${p.toFixed(1)} Torr` : `${p.toExponential(1)} Torr`);

export function getEquipmentUse(s: any): EquipUse[] {
  const c = s.chamber, v = s.vna, l = s.ldv, sc = s.scope, ck = s.clock, ex = s.experiment || {}, f = s.facility;
  const dT = c.temperature - c.targetTemp;
  const clients = [v.power, sc.power, l.power].filter(Boolean).length;
  const chOn = Object.values(sc.channels || {}).filter((ch: any) => ch.enabled).length;
  const rows: Omit<EquipUse, 'level'>[] = [
    { id: 'breaker', name: 'Main breaker', group: 'power', page: 'dashboard', on: !!f.power, active: !!f.power, doing: f.power ? 'Supplying AC power to the rack, pumps and controllers.' : 'Open: nothing in the lab has power.', why: 'Everything else needs it.' },
    { id: 'clock', name: 'Rubidium clock', group: 'reference', page: 'clock', on: !!ck.power, active: !!ck.power && (ck.locked ? clients > 0 : true), doing: !ck.power ? 'Off.' : ck.locked ? `Locked. Feeding a steady 10 MHz to ${clients} instrument${clients === 1 ? '' : 's'}.` : `Warming up (${Math.min(100, Math.round(((ck.warmup || 0) / 15) * 100))}%).`, why: 'One shared clock keeps every instrument’s timing identical, so frequency readings can be trusted.' },
    { id: 'vna', name: 'Network analyzer (VNA)', group: 'instrument', page: 'vna', on: !!v.power, active: !!(v.power && v.rf && (v.sweeping || v.continuous)), doing: !v.power ? 'Off.' : v.sweeping ? 'Sweeping a frequency range and measuring how much RF the sphere reflects.' : v.rf ? 'Transmitting RF and tracking the resonance dip live.' : 'On, but RF output is off.', why: 'It finds the sphere’s resonant frequency — the number that may depend on location.' },
    { id: 'rf', name: 'RF coupling fixture', group: 'instrument', page: 'vna', on: !!(v.power && v.rf), active: !!(v.power && v.rf), doing: v.power && v.rf ? 'Carrying the RF test signal into the chamber and the reflection back out.' : 'Idle: no RF signal.', why: 'The only electrical path between the analyzer and the sphere.' },
    { id: 'scope', name: 'Oscilloscope', group: 'instrument', page: 'scope', on: !!sc.power, active: !!(sc.power && sc.running && !sc.booting), doing: !sc.power ? 'Off.' : sc.booting ? 'Running its power-on self-test.' : sc.running ? `Drawing ${chOn} live channel${chOn === 1 ? '' : 's'} (${sc.triggerState || 'running'}).` : 'Stopped: the screen is frozen.', why: 'Shows raw signals, so noise, hum and pump vibration can be spotted before they spoil a measurement.' },
    { id: 'ldv', name: 'Laser vibrometer (LDV)', group: 'instrument', page: 'ldv', on: !!l.power, active: !!(l.power && l.shutter), doing: !l.power ? 'Off.' : l.scanActive ? `Scanning the sphere surface (${Math.round((l.scanProgress || 0) * 100)}%).` : l.shutter ? `Laser on. Optical return ${Math.round(l.opticalQuality ?? 0)}%.` : 'On, shutter closed: no laser.', why: 'Measures how the sphere surface actually vibrates, without touching it.' },
    { id: 'rough', name: 'Roughing pump', group: 'vacuum', page: 'chamber', on: !!c.roughing, active: (c.roughingRpm || 0) > 1, doing: (c.roughingRpm || 0) > 1 ? `Removing most of the air (${(c.roughingRpm || 0).toFixed(0)}%). Pressure ${fmtP(c.pressure)}.` : c.roughing ? 'Starting.' : 'Off.', why: 'Takes the chamber from atmosphere down to about 50 Torr.' },
    { id: 'turbo', name: 'Turbo pump', group: 'vacuum', page: 'chamber', on: !!c.turbo, active: (c.turboRpm || 0) > 1, doing: (c.turboRpm || 0) > 1 ? `Spinning at ${(c.turboRpm || 0).toFixed(0)}% and pulling the last gas molecules out.` : c.turbo ? 'Waiting for pressure < 50 Torr.' : 'Off.', why: 'Reaches the deep vacuum (below 0.001 Torr) the measurement needs.' },
    { id: 'vent', name: 'Vent valve', group: 'vacuum', page: 'chamber', on: !!c.vent, active: !!c.vent, doing: c.vent ? 'Open: gas is flowing back into the chamber.' : 'Closed.', why: 'Lets you open the door safely by returning to atmosphere.' },
    { id: 'thermo', name: 'Thermostat', group: 'environment', page: 'chamber', on: !!c.thermostat, active: !!c.thermostat && Math.abs(dT) >= 0.03, doing: !c.thermostat ? 'Off: temperature drifts toward room temperature.' : Math.abs(dT) >= 0.03 ? `${dT > 0 ? 'Cooling' : 'Heating'} toward ${c.targetTemp.toFixed(1)} °C (${dT >= 0 ? '+' : ''}${dT.toFixed(2)} °C off).` : `Holding ${c.targetTemp.toFixed(1)} °C steady.`, why: 'Temperature shifts the resonance, so it must be steady.' },
    { id: 'faraday', name: 'Faraday cage', group: 'environment', page: 'chamber', on: !!c.faraday, active: !!c.faraday && !!f.power, doing: c.faraday ? 'Blocking outside radio noise from the measurement.' : 'Off: radio noise is reaching the instruments.', why: 'Keeps outside electrical noise out of the S11 trace.' },
    { id: 'isolation', name: 'Vibration isolation', group: 'environment', page: 'chamber', on: !!c.isolation, active: !!c.isolation && !!f.power, doing: c.isolation ? 'Floating the table so floor vibration cannot reach the sphere.' : 'Bypassed: floor vibration is reaching the sphere.', why: 'Keeps the laser and scope signals clean.' },
    { id: 'stage', name: 'Fixed A/B kinematic rail', group: 'motion', page: 'chamber', on: !!f.power, active: false, doing: 'Static positions A and B are modeled 0.400 m apart; legacy XYZ travel is not part of LOC-1.', why: 'The LOC-1 schematic compares fixed nodal positions A and B.' },
    { id: 'door', name: 'Chamber door', group: 'environment', page: 'chamber', on: !!c.doorOpen, active: !!c.doorOpen, doing: c.doorOpen ? 'Open: pumping, stage moves and scans are blocked.' : 'Closed and sealed.', why: 'Must be closed for vacuum and for any motion.' },
    { id: 'daq', name: 'Acquisition workstation', group: 'data', page: 'runs', on: !!f.power, active: !!(ex.active || ex.scanActive), doing: ex.scanActive ? `Running an automated scan (${Math.round((ex.scanProgress || 0) * 100)}%).` : ex.active ? `Recording run ${ex.id || ''}.` : `Idle. ${(ex.records || []).length} record(s) stored.`, why: 'Stores every measurement together with the conditions it was taken under.' },
  ];
  const level = (id: EquipId): AlertLevel => {
    switch (id) {
      case 'breaker': return getAlert(s, 'facility').level;
      case 'clock': return getAlert(s, 'clock').level;
      case 'vna': case 'rf': return getAlert(s, 'vna').level;
      case 'scope': return getAlert(s, 'scope').level;
      case 'ldv': return getAlert(s, 'ldv').level;
      case 'rough': case 'turbo': case 'vent': return getAlert(s, 'pumps').level;
      case 'stage': return getAlert(s, 'stage').level;
      case 'daq': return getAlert(s, 'experiment').level;
      default: return getAlert(s, 'chamber').level;
    }
  };
  return rows.map(r => ({ ...r, level: level(r.id) }));
}

/** The set of equipment currently doing work, used to light up 3D highlights. */
export const activeEquipment = (s: any): Set<EquipId> => new Set(getEquipmentUse(s).filter(e => e.active).map(e => e.id));

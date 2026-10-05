import React, { useState, useEffect, useReducer, useRef, useMemo, useCallback } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, ScatterChart, Scatter, ZAxis, ReferenceLine, ReferenceDot
} from 'recharts';
import { 
  Power, Settings, Activity, Thermometer, Wind, Target, Maximize, AlertCircle, 
  Play, Square, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, CheckCircle2,
  Zap, BookOpen, Book, HelpCircle, X, Info, ShieldCheck, Download, Archive, ListOrdered, Save, BrainCircuit, TimerReset,
  AlertTriangle, Radio, ScanLine, Waves, FlaskConical, Cpu, Award, CheckSquare, FileText,
  Sliders, Disc, Compass, Box, Orbit, Cuboid, Map, Video, PlaySquare, MonitorPlay, Tv, Wrench, Compass as CompassIcon,
  Search, Command, Filter, Terminal, Layers, FileSpreadsheet
} from 'lucide-react';

const BASE_FREQUENCY = 230500;
const AMBIENT_C = 22.0;
const LIMIT_MM = 35.0;
const WARMUP_SECONDS = 15;

const GLOSSARY = {
  sphere: { title: "S.P.H.E.R.E.", desc: "Standardized Precision Housing for Experimental Resonance Evaluation. A rigorously controlled environment designed to isolate variables affecting resonant measurements." },
  location_variable: { title: "Location Variable", desc: "The core hypothesis being tested: that a test object's specific spatial coordinates (X, Y, Z) within a defined environment systematically alters its measured physical properties, such as resonance." },
  vna: { title: "Keysight E5080B VNA", desc: "Vector Network Analyzer. An instrument used to measure network parameters. Here, it measures the S11 reflection coefficient to identify precise resonant frequencies via an RF coupling fixture." },
  s11: { title: "S11 (Reflection Coefficient)", desc: "Represents how much power is reflected from the antenna/probe. A sharp 'dip' indicates power is being absorbed and resonating within the test sphere." },
  span: { title: "Frequency Span", desc: "The width of the frequency range being swept by the VNA. A narrower span provides higher resolution around a specific resonance point." },
  ldv: { title: "Polytec PSV-500 LDV", desc: "3D Scanning Laser Doppler Vibrometer. Uses interferometry of a reflected laser beam to measure mechanical displacement (vibration) of the sphere surface at sub-picometer resolutions." },
  clock: { title: "SRS FS725 Rubidium Clock", desc: "A highly stable atomic frequency standard providing a precise 10 MHz reference signal to all instruments, ensuring internal clocks do not drift." },
  scope: { title: "Tektronix 5 Series MSO", desc: "Mixed Signal Oscilloscope. Used here to monitor raw time-domain waveforms, trigger signals, and characterize ambient environmental noise." },
  chamber: { title: "Thermal-Vacuum Chamber", desc: "A custom enclosure isolating the experiment from air mass loading, thermal fluctuations, and acoustic noise." },
  faraday_cage: { title: "Faraday Cage", desc: "A grounded metallic shield surrounding the experiment. It blocks external electromagnetic interference (EMI) and radio frequency (RF) noise." },
  vibration_platform: { title: "Active Vibration Isolation", desc: "Pneumatic or piezoelectric dampeners that decouple the optical table from floor vibrations (seismic, footsteps, HVAC)." },
  center_freq: { title: "Center Frequency", desc: "The median frequency of the VNA frequency sweep range. Set near 230.5 kHz for primary sphere resonance." },
  sweep_points: { title: "Sweep Points", desc: "The discrete frequency points measured across the VNA frequency span. Higher points increase resolution at the cost of sweep duration." },
  ifbw: { title: "Intermediate Frequency Bandwidth", desc: "Filter bandwidth of the VNA receiver. Narrower IFBW reduces noise floor but slows down sweep time." },
  averaging: { title: "VNA Trace Averaging", desc: "Averaging multiple sweeps together to cancel out random thermal and electrical noise." },
  shutter: { title: "Laser Shutter", desc: "Safety and operational mechanical shutter controlling laser beam emission from the LDV optical head." },
  velocity_range: { title: "Velocity Range", desc: "Decoder sensitivity setting of the LDV, scaling surface displacement velocity to analog voltage output." },
  timebase: { title: "Oscilloscope Timebase", desc: "Horizontal display scale of the oscilloscope in microseconds per division." },
  v_div: { title: "Vertical Scale (V/div)", desc: "Vertical voltage sensitivity scale per display grid division on the oscilloscope." },
  roughing_pump: { title: "Roughing Pump", desc: "Mechanical vacuum pump used to evacuate the chamber from atmospheric pressure down to rough vacuum (~50 Torr)." },
  turbo_pump: { title: "Turbomolecular Pump", desc: "High-speed rotor vacuum pump used to achieve deep high-vacuum (< 1e-3 Torr) by removing residual gas molecules." },
  thermostat: { title: "Active Thermostat", desc: "Peltier and resistive heater control loop maintaining precise thermal setpoints within the chamber." },
  spatial_field: { title: "Spatial Field Explorer", desc: "Volumetric visualization workspace mapping measured resonance shifts, uncertainty, and spatial coverage across X, Y, and Z coordinates." },
  interpolation: { title: "Spatial Interpolation", desc: "Mathematical estimation of values between discrete measurement points. Requires adequate coverage before being scientifically valid." },
  isosurface: { title: "Isosurface Rendering", desc: "3D contour surfaces connecting points of equal value, such as equal resonance frequency shift (\\Delta f)." },
  roi: { title: "Region of Interest (ROI)", desc: "Sub-volume selection tool used to calculate descriptive statistics and isolate specific coordinate bounds." },
  ai_copilot: { title: "AI Laboratory Copilot", desc: "Contextual assistant monitoring experiment health, suggesting next steps, and evaluating statistical significance." },
  fault_sim: { title: "Instrument Failure Simulator", desc: "Injects realistic equipment faults (clock drift, LDV misalignment, vacuum leaks) for troubleshooting training." }
};

const TUTORIAL_VIDEOS = [
  { id: "AQlMOrKsH54", title: "Vector Network Analyzer Principles & LCR Measurement", speaker: "The Signal Path", duration: "22:37", desc: "Detailed breakdown of S-parameters, reflection coefficients, and how high-precision analyzers characterize complex resonance." },
  { id: "Sb3q8f0NBZc", title: "Back to Basics: What is a VNA?", speaker: "w2aew", duration: "16:49", desc: "Introductory tutorial explaining forward and reflected power waves, calibration planes, and Smith charts." },
  { id: "yRxYIfZUxW8", title: "Basic Principles of Laser Doppler Vibrometry", speaker: "Polytec", duration: "1:22", desc: "Animated guide on how laser interferometry measures micro-vibrations and surface displacement velocity without physical contact." },
  { id: "XOv1howMYs8", title: "Precision Measurement: How to Use an Oscilloscope", speaker: "Rohde & Schwarz", duration: "0:12", desc: "Quick technical demonstration of time-domain signal triggering, vertical scaling, and noise artifact isolation." },
  { id: "9z12l35OC1Q", title: "Laser Vibration Measurements in Metrology", speaker: "Polytec", duration: "5:14", desc: "In-depth overview of why non-contact optical sensing is critical for isolating delicate modal analysis from mechanical damping." }
];

const CHALLENGES = [
  { id: "c1", title: "60 Hz EMI Diagnosis", desc: "A 60 Hz interference source has appeared on the oscilloscope. Diagnose and resolve it using environmental shielding controls.", check: s => !s.chamber.faraday === false },
  { id: "c2", title: "Resonant Peak Optimization", desc: "The resonant peak is currently broad (low Q-factor). Improve the Q-factor to >4000 by altering chamber vacuum conditions.", check: s => s.chamber.pressure < 1e-3 },
  { id: "c3", title: "Clock Lock Restoration", desc: "The system is running on internal reference. Power on the Rubidium Clock and wait for the system to achieve an external lock.", check: s => s.clock.locked },
  { id: "c4", title: "Blind Repeat Validation", desc: "Configure a scan plan with at least 5 points, randomized order, and enabled blind model ground truth.", check: s => s.experiment.randomized && s.model.hiddenTruth },
  { id: "c5", title: "Thermal Stability Check", desc: "Achieve millikelvin thermal stability where the temperature setpoint matches current chamber temperature within 0.03°C.", check: s => Math.abs(s.chamber.temperature - s.chamber.targetTemp) < 0.03 }
];

const PROCEDURE_STEPS = [
  { step: 1, title: "Initialize Facility Power", desc: "Turn on the 'MAIN BREAKER' in the top right corner. This provides AC power to instrument racks and environmental controls.", badge: "Vacuum Operator" },
  { step: 2, title: "Lock Master Clock", desc: "Open the 'SRS FS725 Rb Clock' panel. Turn the POWER on. Wait for the WARMUP sequence to complete and the LOCKED indicator to turn green.", badge: "Frequency Reference Specialist" },
  { step: 3, title: "Evacuate Chamber", desc: "Open the '3D Env Chamber' panel. Start the ROUGHING PUMP. Once pressure drops below 50 Torr, engage the TURBO PUMP to reach deep vacuum.", badge: "Vacuum Operator" },
  { step: 4, title: "Configure VNA", desc: "Open 'Keysight E5080B VNA'. Turn Power ON. Enable RF output. Trigger a continuous sweep to observe the baseline S11 resonance near 230.5 kHz.", badge: "VNA Calibration Tech" },
  { step: 5, title: "Engage LDV", desc: "Open 'Polytec PSV-500 LDV'. Click 'OPEN SHUTTER' to enable the laser. Observe structural displacement data alignment.", badge: "LDV Alignment Tech" },
  { step: 6, title: "Test Location Variable", desc: "Return to '3D Env Chamber'. Use the Precision XYZ Stage sliders to alter sphere coordinates. Observe how spatial shifts impact resonance.", badge: "Location Variable Investigator" }
];

const initialState = {
  facility: { power: false, speed: 1, simulationTime: 0, seededNoise: true, seed: 73421, mode: "training" },
  clock: { power: false, warmup: 0, locked: false, holdover: false, distributionAmplifier: true, cableFault: false, timeSinceLock: 0 },
  chamber: {
    targetTemp: 20.0, temperature: 22.0, pressure: 760, vent: true, roughing: false,
    turbo: false, thermostat: true, faraday: true, isolation: true, doorOpen: false
  },
  stage: { x: 0.0, y: 0.0, z: 0.0, homed: true, moving: false, clampActive: false },
  vna: {
    power: false, rf: false, continuous: true, sweepMode: "continuous", triggerMode: "internal",
    center: BASE_FREQUENCY, span: 5000, startFrequency: 228000, stopFrequency: 233000,
    points: 401, ifbw: 100, sourcePowerDbm: -10, averagingEnabled: false, averagingCount: 4, averageProgress: 0,
    calibrated: false, calibrationType: "none", calibrationTime: null, calibrationAgeSeconds: 0,
    trace: [], reference: [], markers: [], traceMath: "live", sweeping: false
  },
  ldv: { 
    power: false, shutter: false, range: "20 mm/s/V", filter: "10 MHz", grid: 64,
    laserPower: 50, focus: 0, alignmentX: 0, alignmentY: 0, opticalReturn: 85,
    signalQuality: "good", decoderLocked: true, measurementMode: "velocity",
    scanPattern: "grid", scanProgress: 0, scanActive: false, modeShapeData: []
  },
  scope: { 
    power: false, running: true, timebase: 10, scale: 0.5, 
    triggerMode: "edge", triggerSource: "CH1", triggerLevel: 0, acquisitionMode: "sample",
    channels: {
      ch1: { enabled: true, scale: 0.5, offset: 0, coupling: "DC", source: "rf_monitor" },
      ch2: { enabled: true, scale: 0.2, offset: 0, coupling: "AC", source: "ldv_output" },
      ch3: { enabled: false, scale: 1, offset: 0, coupling: "DC", source: "clock_reference" },
      ch4: { enabled: false, scale: 1, offset: 0, coupling: "DC", source: "environmental_probe" }
    },
    trace: [], fftEnabled: false, cursorA: null, cursorB: null
  },
  model: {
    location: true, temperature: true, pressure: true, rfNoise: true, vibration: true,
    clockDrift: true, fixtureDrift: false, hiddenTruth: false
  },
  spatialView: {
    metric: "frequencyShift", referenceMode: "center", rendering: "points",
    interpolation: "none", colorScale: "diverging", lockScale: false,
    activeSlice: { x: 0, y: 0, z: 0 }
  },
  failures: { clockDrift: false, ldvMisalign: false, vacuumLeak: false, emiSpike: false, stageBacklash: false },
  experiment: {
    id: null, active: false, axis: "x", start: -20, stop: 20,
    step: 5, repeats: 3, randomized: true, records: []
  },
  ui: { active: "dashboard", modal: null, alarmsOpen: false, helpModal: null, glossaryOpen: false, manualOpen: false, peerModal: false, videoModal: false, activeVideo: TUTORIAL_VIDEOS[0], confirmModal: null, validatorModalOpen: false, wizardOpen: false, cmdPaletteOpen: false, navCollapsed: false, calModalOpen: false },
  badges: [],
  activeChallenge: null,
  challengePassed: {},
  peerReviewData: { clockLocked: false, pressureStable: false, tempSettled: false, randomized: false, repeats: 3, dominantUncertainty: "Thermal Drift", residualPersists: false },
  events: [],
  alarms: []
};

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
const uid = () => `RUN-${Date.now().toString().slice(-6)}`;
const now = () => new Date().toLocaleTimeString();
const fmtPressure = p => p >= 10 ? `${p.toFixed(1)} Torr` : `${p.toExponential(1)} Torr`;

function addEvent(state, text, level = "info", subsystem = "SYSTEM", x = null, y = null, z = null, runId = null) {
  const ev = { 
    id: Math.random(), 
    time: now(), 
    simulationTime: Math.floor(state.facility.simulationTime),
    subsystem, 
    text, 
    level, 
    x, y, z, 
    runId: runId || state.experiment.id 
  };
  return { ...state, events: [ev, ...state.events].slice(0, 200) };
}

function addAlarm(state, text, severity = "warning") {
  if (state.alarms.some(a => a.text === text && !a.acknowledged)) return state;
  const alarm = { id: Math.random(), time: now(), text, severity, acknowledged: false };
  return { ...state, alarms: [alarm, ...state.alarms].slice(0, 60) };
}

function getMeasurementValidation(state) {
  const clockLocked = state.clock.locked && !state.failures.clockDrift;
  const pressurePass = state.chamber.pressure < 1e-3 && !state.failures.vacuumLeak;
  const tempDiff = Math.abs(state.chamber.temperature - state.chamber.targetTemp);
  const tempPass = tempDiff < 0.03;
  const faradayPass = state.chamber.faraday;
  const isolationPass = state.chamber.isolation;
  const stagePass = !state.stage.moving && !state.stage.clampActive;
  const vnaCalibPass = state.vna.calibrated && state.vna.calibrationAgeSeconds < 3600;

  const rules = [
    {
      rule: "Rubidium reference locked",
      status: clockLocked ? "Pass" : "Fail",
      details: clockLocked ? "External 10 MHz reference synchronized" : "Internal VNA reference is active"
    },
    {
      rule: "Pressure below threshold",
      status: pressurePass ? "Pass" : "Fail",
      details: `${fmtPressure(state.chamber.pressure)} (Target < 1e-3 Torr)`
    },
    {
      rule: "Thermal stability",
      status: tempPass ? "Pass" : tempDiff < 0.1 ? "Warning" : "Fail",
      details: tempPass ? "Setpoint drift < 0.03°C" : `Drift is ${(tempDiff * 5).toFixed(2)} °C/min`
    },
    {
      rule: "Faraday shielding",
      status: faradayPass ? "Pass" : "Fail",
      details: faradayPass ? "Cage is active and grounded" : "External EMI intrusion detected"
    },
    {
      rule: "Vibration isolation",
      status: isolationPass ? "Pass" : "Fail",
      details: isolationPass ? "Pneumatic dampeners floating" : "Isolation platform bypassed"
    },
    {
      rule: "Stage motion & clamp",
      status: stagePass ? "Pass" : "Fail",
      details: stagePass ? "Position settled and clamp released" : "Stage moving or mechanical clamp engaged"
    },
    {
      rule: "VNA calibration",
      status: vnaCalibPass ? "Pass" : "Warning",
      details: vnaCalibPass ? `Valid (${state.vna.calibrationType})` : "Uncalibrated or expired calibration state"
    }
  ];

  const hasFail = rules.some(r => r.status === "Fail");
  const hasWarn = rules.some(r => r.status === "Warning");
  const overall = hasFail ? "INVALID" : hasWarn ? "SUSPECT" : "VALID";

  return { overall, rules };
}

function reducer(state, action) {
  switch (action.type) {
    case "POWER": {
      if (!action.value) return addEvent({ ...initialState, facility: { ...initialState.facility, power: false } }, "MAIN BREAKER opened; all instrument states reset.", "warning", "SYSTEM");
      return addEvent({ ...state, facility: { ...state.facility, power: true } }, "MAIN BREAKER closed; facility AC online.", "info", "SYSTEM");
    }
    case "SET_MODE": {
      return addEvent({ ...state, facility: { ...state.facility, mode: action.mode } }, `Facility operating mode changed to: ${action.mode.toUpperCase()}`, "info", "SYSTEM");
    }
    case "PATCH": {
      const next = { ...state, [action.domain]: { ...state[action.domain], ...action.patch } };
      if (action.domain === "vna" && state.vna.calibrated) {
        if (action.patch.center !== undefined || action.patch.span !== undefined || action.patch.startFrequency !== undefined || action.patch.stopFrequency !== undefined) {
          next.vna.calibrated = false;
          addAlarm(next, "VNA calibration invalidated due to frequency span modification.", "warning");
        }
      }
      return next;
    }
    case "SET_UI": return { ...state, ui: { ...state.ui, ...action.patch } };
    case "EVENT": return addEvent(state, action.text, action.level, action.subsystem || "SYSTEM", action.x, action.y, action.z, action.runId);
    case "ALARM": return addAlarm(state, action.text, action.severity);
    case "ACK_ALARM": return { ...state, alarms: state.alarms.map(a => a.id === action.id ? { ...a, acknowledged: true } : a) };
    case "AWARD_BADGE": {
      if (state.badges.includes(action.badge)) return state;
      return addEvent({ ...state, badges: [...state.badges, action.badge] }, `Achievement Unlocked: Badge Awarded - "${action.badge}"!`, "info", "LEARN");
    }
    case "SUBMIT_PEER_REVIEW": {
      return addEvent({ ...state, ui: { ...state.ui, peerModal: false } }, `Peer review submitted successfully. Data validation verified against laboratory standards.`, "info", "RESEARCH");
    }
    case "MOVE_STAGE": {
      if (!state.facility.power || state.chamber.doorOpen) return addAlarm(state, "Stage move rejected: facility offline or chamber access door open.", "critical");
      if (state.stage.clampActive) return addAlarm(state, "Stage move rejected: mechanical clamp is active.", "critical");
      let pos = action.position;
      if (state.failures.stageBacklash) {
        Object.keys(pos).forEach(k => { pos[k] += (Math.random() - 0.5) * 0.4; });
      }
      const stage = { ...state.stage, ...pos, moving: false };
      return addEvent({ ...state, stage }, `Stage positioned at X ${stage.x.toFixed(3)}, Y ${stage.y.toFixed(3)}, Z ${stage.z.toFixed(3)} mm.`, "info", "CHAMBER", stage.x, stage.y, stage.z);
    }
    case "HOME_STAGE": {
      if (state.stage.clampActive) return addAlarm(state, "Stage homing rejected: mechanical clamp is active.", "critical");
      return addEvent({ ...state, stage: { ...state.stage, x: 0, y: 0, z: 0, homed: true } }, "XYZ stage homed at reference coordinate.", "info", "CHAMBER", 0, 0, 0);
    }
    case "CALIBRATE_VNA": {
      const vna = { 
        ...state.vna, 
        calibrated: true, 
        calibrationType: action.calType || "SOLT 1-Port", 
        calibrationTime: new Date().toLocaleTimeString(),
        calibrationAgeSeconds: 0 
      };
      return addEvent({ ...state, vna }, `VNA calibration completed (${vna.calibrationType}); state VALID.`, "info", "VNA");
    }
    case "CAPTURE_REFERENCE": return addEvent({ ...state, vna: { ...state.vna, reference: state.vna.trace } }, "Reference trace captured.", "info", "VNA");
    case "START_RUN": {
      const id = uid();
      return addEvent({ ...state, experiment: { ...state.experiment, active: true, id, records: [] } }, `Experiment ${id} started.`, "info", "RESEARCH", null, null, null, id);
    }
    case "STOP_RUN": {
      const nextState = addEvent({ ...state, experiment: { ...state.experiment, active: false } }, `Experiment run stopped.`, "warning", "RESEARCH");
      if (state.facility.mode === "peer") {
        return { ...nextState, ui: { ...nextState.ui, peerModal: true } };
      }
      return nextState;
    }
    case "RECORD": return { ...state, experiment: { ...state.experiment, records: [action.record, ...state.experiment.records].slice(0, 200) } };
    case "TICK": return tick(state, action.dt);
    default: return state;
  }
}

function noise(i, seed) {
  const x = Math.sin((i + 1) * 12.9898 + seed * 0.12345) * 43758.5453;
  return x - Math.floor(x);
}

function trueFrequency(state) {
  const { stage, chamber, model, clock, failures } = state;
  const loc = model.location ? stage.x * 45.2 + stage.y * -12.5 + stage.z * 80.1 : 0;
  const thermal = model.temperature ? (chamber.temperature - 20) * 5 : 0;
  const air = model.pressure ? (chamber.pressure > 1 ? -250 : -Math.log10(Math.max(chamber.pressure, 1e-8)) * .3) : 0;
  const clockDrift = (model.clockDrift && (!clock.locked || clock.cableFault)) || failures.clockDrift ? 15.5 : 0;
  const fixture = model.fixtureDrift ? (stage.x * .2) + (stage.z * .25) : 0;
  return BASE_FREQUENCY + loc + thermal + air + clockDrift + fixture;
}

function buildSweep(state) {
  const resonance = trueFrequency(state);
  const { vna, chamber, facility, failures, clock } = state;
  const q = chamber.pressure > 1 ? 1200 : 4500;
  const rfNoise = (state.model.rfNoise && !chamber.faraday) || failures.emiSpike ? 4.5 : .18;
  const clockNoise = clock.locked && !clock.cableFault && !failures.clockDrift ? .02 : 1.2;
  const n = Math.max(101, Math.min(1001, vna.points));
  
  let start = vna.startFrequency;
  let stop = vna.stopFrequency;
  if (vna.center && vna.span) {
    start = vna.center - vna.span / 2;
    stop = vna.center + vna.span / 2;
  }

  return Array.from({ length: n }, (_, i) => {
    let f = start + (i / (n - 1)) * (stop - start);
    if (vna.sweepMode === "log") {
      const logStart = Math.log10(Math.max(1000, start));
      const logStop = Math.log10(Math.max(2000, stop));
      f = Math.pow(10, logStart + (i / (n - 1)) * (logStop - logStart));
    }
    const normalized = 2 * (f - resonance) / (resonance / q);
    const dip = -28 / (1 + normalized * normalized);
    const jitter = (noise(i + facility.simulationTime * 7, facility.seed) - .5) * (rfNoise + clockNoise);
    let s11Val = -2 + dip + jitter;

    if (vna.traceMath === "ref" && vna.reference.length === n) {
      s11Val = vna.reference[i].s11;
    } else if (vna.traceMath === "diff" && vna.reference.length === n) {
      s11Val = s11Val - vna.reference[i].s11;
    } else if (vna.traceMath === "ratio" && vna.reference.length === n) {
      s11Val = s11Val / (vna.reference[i].s11 || 1);
    }

    return { freq: f, s11: s11Val, fit: -2 + dip };
  });
}

function buildScope(state) {
  return Array.from({ length: 250 }, (_, i) => {
    const t = i / 250;
    let v = (noise(i + state.facility.simulationTime, state.facility.seed) - .5) * .1;
    if (state.vna.rf) v += Math.sin(t * Math.PI * 20) * .55;
    if ((!state.chamber.faraday && state.model.rfNoise) || state.failures.emiSpike) v += Math.sin(t * Math.PI * 6) * .65 + (noise(i * 5, 99) - .5) * .4;
    if (!state.chamber.isolation && state.model.vibration) v += Math.sin(t * Math.PI * 1.3) * .4;
    if (state.chamber.turbo) v += Math.sin(t * Math.PI * 3.1) * .12;
    if (!state.clock.locked || state.clock.cableFault) v += (noise(i, 88) - .5) * 0.3;
    return { t: i, value: v };
  });
}

function tick(state, dt) {
  if (!state.facility.power) return state;
  const speed = state.facility.speed;
  const elapsed = state.facility.simulationTime + dt * speed;
  const chamber = { ...state.chamber };
  chamber.temperature += (chamber.thermostat ? chamber.targetTemp - chamber.temperature : AMBIENT_C - chamber.temperature) * (chamber.thermostat ? .10 : .035) * speed;
  if (state.failures.vacuumLeak) { chamber.pressure = 760; }
  else if (chamber.vent || chamber.doorOpen) { chamber.pressure = 760; chamber.turbo = false; chamber.roughing = false; }
  else if (chamber.turbo && chamber.pressure < 10) chamber.pressure = Math.max(1e-6, chamber.pressure * Math.pow(.72, speed));
  else if (chamber.roughing) chamber.pressure = Math.max(.01, chamber.pressure * Math.pow(.88, speed));
  else chamber.pressure = Math.min(760, chamber.pressure * Math.pow(1.02, speed));
  
  const clock = { ...state.clock };
  if (clock.power && !clock.locked && !state.failures.clockDrift) { 
    clock.warmup += dt * speed; 
    if (clock.warmup >= WARMUP_SECONDS) {
      clock.locked = true;
      clock.timeSinceLock = 0;
    }
  } else if (clock.locked) {
    clock.timeSinceLock += dt * speed;
  }
  
  const vna = { ...state.vna };
  if (vna.calibrated) {
    vna.calibrationAgeSeconds += dt * speed;
    if (vna.calibrationAgeSeconds > 3600) vna.calibrated = false;
  }

  if (vna.power && vna.rf && vna.continuous && vna.triggerMode === "internal") {
    vna.trace = buildSweep({ ...state, chamber, clock, vna, facility: { ...state.facility, simulationTime: elapsed } });
  }
  
  const scope = { ...state.scope };
  if (scope.power && scope.running) scope.trace = buildScope({ ...state, chamber, clock, vna, scope, facility: { ...state.facility, simulationTime: elapsed } });
  
  let next = { ...state, chamber, clock, vna, scope, facility: { ...state.facility, simulationTime: elapsed } };
  if (chamber.turbo && chamber.pressure > 50) next = addAlarm(next, "Turbo pump protection: chamber pressure too high.", "critical");
  if (!chamber.faraday) next = addAlarm(next, "RF shielding disabled: VNA data may be corrupted.");
  if (!chamber.isolation) next = addAlarm(next, "Vibration isolation disabled: LDV and scope noise elevated.");
  return next;
}

export default function MetrologyLab() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [journalFilter, setJournalFilter] = useState("all");
  const [journalSearch, setJournalSearch] = useState("");
  const timer = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        dispatch({ type: "SET_UI", patch: { cmdPaletteOpen: !state.ui.cmdPaletteOpen } });
        return;
      }
      if (['input', 'textarea', 'select'].includes(document.activeElement.tagName.toLowerCase())) return;

      if (e.key === ' ') {
        e.preventDefault();
        dispatch({ type: "POWER", value: !state.facility.power });
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (state.experiment.active) dispatch({ type: "STOP_RUN" });
        else dispatch({ type: "START_RUN" });
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (state.vna.power) performSweep();
      } else if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        dispatch({ type: "HOME_STAGE" });
      } else if (e.key.toLowerCase() === 'a') {
        e.preventDefault();
        dispatch({ type: "SET_UI", patch: { alarmsOpen: !state.ui.alarmsOpen } });
      } else if (e.key === '?') {
        e.preventDefault();
        dispatch({ type: "SET_UI", patch: { glossaryOpen: true } });
      } else if (e.key === 'Escape') {
        dispatch({ type: "SET_UI", patch: { modal: null, helpModal: null, glossaryOpen: false, manualOpen: false, peerModal: false, videoModal: false, confirmModal: null, validatorModalOpen: false, wizardOpen: false, cmdPaletteOpen: false, calModalOpen: false } });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.facility.power, state.experiment.active, state.vna.power, state.ui]);

  useEffect(() => { 
    timer.current = window.setInterval(() => dispatch({ type: "TICK", dt: 1 }), 1000); 
    return () => clearInterval(timer.current); 
  }, []);

  const f0 = useMemo(() => trueFrequency(state), [state]);
  const validationResult = useMemo(() => getMeasurementValidation(state), [state]);
  const valid = validationResult.overall === "VALID";
  const unresolved = state.alarms.filter(a => !a.acknowledged).length;
  const active = state.ui.active;
  const [fx, setFx] = useState({ reduced: typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches, hide: false });
  FX = fx;
  const set = (domain, patch) => dispatch({ type: "PATCH", domain, patch });

  const powerState = !state.facility.power ? "OFFLINE" : state.facility.speed > 50 ? "STARTING" : "ONLINE";
  const clockStatus = !state.clock.power ? "NO REF" : !state.clock.locked ? "WARMING" : state.clock.holdover ? "HOLDOVER" : "LOCKED";
  const tempStable = Math.abs(state.chamber.temperature - state.chamber.targetTemp) < 0.03;
  const recordQuality = !state.experiment.records.length ? "NO DATA" : validationResult.overall;
  const recordingState = state.experiment.active ? "RUNNING" : state.experiment.records.length > 0 ? "COMPLETE" : "IDLE";

  const HelpInfo = ({ termKey }) => (
    <span 
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); set("ui", { helpModal: GLOSSARY[termKey] || { title: termKey, desc: "Detailed metrology specification and operational documentation." } }); }} 
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          set("ui", { helpModal: GLOSSARY[termKey] || { title: termKey, desc: "Detailed metrology specification and operational documentation." } });
        }
      }}
      role="button"
      tabIndex={0}
      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/50 text-[9px] font-bold ml-1.5 cursor-help transition-all shadow-sm shrink-0"
      title="Click for definition"
    >
      ?
    </span>
  );

  const performSweep = () => {
    if (!state.vna.calibrated && state.facility.mode === "training") {
      dispatch({ type: "ALARM", text: "VNA sweep warning: running uncalibrated in training mode.", severity: "warning" });
    }
    if (!state.vna.power || !state.vna.rf) {
      dispatch({ type: "ALARM", text: "Sweep rejected: power the VNA and enable RF output.", severity: "warning" });
      return;
    }
    const trace = buildSweep(state);
    dispatch({ type: "PATCH", domain: "vna", patch: { trace, sweeping: false } });
    const min = trace.reduce((a, b) => a.s11 < b.s11 ? a : b);
    const isVal = validationResult.overall === "VALID";
    const record = { 
      id: Math.random(), 
      runId: state.experiment.id || "RUN-DEFAULT",
      sequence: state.experiment.records.length + 1,
      repeatIndex: 1,
      timestamp: new Date().toISOString(),
      x: state.stage.x, 
      y: state.stage.y, 
      z: state.stage.z, 
      resonance: min.freq, 
      resonanceShift: min.freq - BASE_FREQUENCY,
      depth: min.s11, 
      q: state.chamber.pressure > 1 ? 1200 : 4500, 
      uncertaintyHz: 0.25,
      repeatMeanHz: min.freq,
      repeatSdHz: 0.05,
      sampleCount: 1,
      valid: isVal, 
      temp: state.chamber.temperature, 
      pressure: state.chamber.pressure,
      clockLocked: state.clock.locked,
      vnaCalibrated: state.vna.calibrated,
      faradayEnabled: state.chamber.faraday,
      isolationEnabled: state.chamber.isolation,
      ldvSignal: 85,
      excluded: false,
      exclusionReason: null,
      note: ""
    };
    if (state.experiment.active) dispatch({ type: "RECORD", record });
    dispatch({ type: "EVENT", text: `Sweep captured: ${min.freq.toFixed(2)} Hz (${validationResult.overall}).`, level: isVal ? "info" : "warning", subsystem: "VNA", x: state.stage.x, y: state.stage.y, z: state.stage.z });
  };

  const exportCsv = () => {
    const rows = [
      ["run_id", "timestamp", "x_mm", "y_mm", "z_mm", "resonance_hz", "s11_db", "q", "valid", "temperature_c", "pressure_torr"], 
      ...state.experiment.records.map(r => [r.runId, r.timestamp, r.x, r.y, r.z, r.resonance, r.depth, r.q, r.valid, r.temp, r.pressure])
    ];
    const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${state.experiment.id || "sphere-run"}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${state.experiment.id || "sphere-session"}.json`; a.click(); URL.revokeObjectURL(a.href);
  };

  const exportJournalCsv = () => {
    const rows = [
      ["timestamp", "sim_time", "subsystem", "severity", "x", "y", "z", "run_id", "message"],
      ...state.events.map(e => [e.time, e.simulationTime, e.subsystem, e.level, e.x ?? "", e.y ?? "", e.z ?? "", e.runId ?? "", `"${e.text.replace(/"/g, '""')}"`])
    ];
    const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `sphere-journal-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const exportJournalJson = () => {
    const blob = new Blob([JSON.stringify(state.events, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `sphere-journal-${Date.now()}.json`; a.click(); URL.revokeObjectURL(a.href);
  };

  const navGroups = [
    {
      group: "Operations",
      items: [
        ["overview", "Lab Overview", Layers],
        ["dashboard", "Operator Console", Radio],
        ["chamber", "3D Chamber & Stage", Wind],
      ]
    },
    {
      group: "Instruments",
      items: [
        ["spatial", "Spatial Field Explorer", Box],
        ["vna", "VNA Analysis", Waves],
        ["ldv", "LDV Scanner", ScanLine],
        ["scope", "Oscilloscope", Activity],
        ["clock", "Frequency Reference", TimerReset],
      ]
    },
    {
      group: "Research",
      items: [
        ["runs", "Experiment Runs", FlaskConical],
      ]
    },
    {
      group: "Learning",
      items: [
        ["training", "Training & Checklist", CheckSquare],
        ["challenges", "Challenge Mode", Award],
      ]
    }
  ];

  const collapsed = state.ui.navCollapsed;

  return (
    <div className={`lab-root ${fx.reduced ? "fx-reduced" : ""} ${fx.hide ? "fx-hide" : ""} min-h-screen bg-[#06080d] font-sans text-zinc-100 selection:bg-sky-500/40 flex flex-col h-screen overflow-hidden`}>
      <FxSettings fx={fx} setFx={setFx} />
      <style>{TW_FALLBACK}</style>
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-[#090c13]/95 px-4 py-3 backdrop-blur shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded border border-sky-500/50 bg-sky-500/10"><Target className="h-5 w-5 text-sky-300" /></div>
            <div>
              <div className="text-sm font-black tracking-[.25em] text-sky-200 flex items-center">
                S.P.H.E.R.E. <HelpInfo termKey="sphere" />
              </div>
              <a href="https://spheredesci.org/demo" target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline">spheredesci.org/demo</a>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => set("ui", { cmdPaletteOpen: true })} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 flex items-center gap-1.5 font-mono">
              <Command size={13} /> Cmd+K <span className="text-[10px] text-zinc-500">Search</span>
            </button>
            <button onClick={() => set("ui", { wizardOpen: true })} className="rounded border border-emerald-600/50 bg-emerald-950/60 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900 flex items-center gap-1">
              <Wrench size={14} /> Startup Wizard
            </button>
            <select 
              value={state.facility.mode} 
              onChange={e => dispatch({ type: "SET_MODE", mode: e.target.value })}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-sky-300 font-semibold"
            >
              <option value="training">Training Mode</option>
              <option value="free">Free-Lab Mode</option>
              <option value="challenge">Challenge Mode</option>
              <option value="peer">Peer-Review Mode</option>
            </select>

            <button onClick={() => set("ui", { videoModal: true })} className="rounded border border-sky-600/50 bg-sky-950/60 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-900 flex items-center gap-1">
              <Video size={14} /> Videos
            </button>
            <button onClick={() => set("ui", { manualOpen: true })} className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 flex items-center gap-1">
              <BookOpen size={14} /> Procedure
            </button>
            <button onClick={() => set("ui", { glossaryOpen: true })} className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 flex items-center gap-1">
              <Book size={14} /> Glossary
            </button>
            <button 
              onClick={() => {
                if (state.facility.power) {
                  set("ui", { confirmModal: { title: "Open Main Breaker?", desc: "Opening the main breaker will cut AC power to all instruments and reset session state.", onConfirm: () => { dispatch({ type: "POWER", value: false }); set("ui", { confirmModal: null }); } } });
                } else {
                  dispatch({ type: "POWER", value: true });
                }
              }}
              className={`rounded border px-3 py-1.5 text-xs font-semibold flex items-center gap-1 ${state.facility.power ? "border-emerald-500 bg-emerald-700 text-white" : "border-rose-700 bg-rose-900 text-white"}`}
            >
              <Power size={14} /> MAIN BREAKER {state.facility.power ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-2.5 text-[10px] font-mono">
          <div className={`flex items-center gap-1.5 rounded px-2 py-1 border ${
            powerState === "ONLINE" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" :
            powerState === "STARTING" ? "border-sky-500/40 bg-sky-500/10 text-sky-300 animate-pulse" :
            "border-zinc-700 bg-zinc-900 text-zinc-400"
          }`}>
            {powerState === "ONLINE" && <CheckCircle2 size={12} className="text-emerald-400" />}
            {powerState === "STARTING" && <Activity size={12} className="text-sky-400 animate-spin" />}
            {powerState === "OFFLINE" && <div className="w-2.5 h-2.5 rounded-full border border-zinc-500" />}
            <span>PWR: <strong>{powerState}</strong></span>
          </div>

          <div className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300">
            <span>MODE: <strong>{state.facility.mode.toUpperCase()}</strong></span>
          </div>

          <div className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300">
            <span>SIM: <strong>{state.facility.speed}x</strong></span>
          </div>

          <div className={`flex items-center gap-1.5 rounded px-2 py-1 border ${
            clockStatus === "LOCKED" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" :
            clockStatus === "WARMING" ? "border-amber-500/40 bg-amber-500/10 text-amber-300 animate-pulse" :
            "border-zinc-700 bg-zinc-900 text-zinc-400"
          }`}>
            {clockStatus === "LOCKED" && <CheckCircle2 size={12} className="text-emerald-400" />}
            {clockStatus === "WARMING" && <AlertTriangle size={12} className="text-amber-400" />}
            {clockStatus === "NO REF" && <div className="w-2.5 h-2.5 rounded-full border border-zinc-500" />}
            <span>CLK: <strong>{clockStatus}</strong></span>
          </div>

          <div className={`flex items-center gap-1.5 rounded px-2 py-1 border ${
            state.chamber.pressure < 1e-3 ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 bg-zinc-900 text-zinc-300"
          }`}>
            <span>PRES: <strong>{fmtPressure(state.chamber.pressure)}</strong></span>
          </div>

          <div className={`flex items-center gap-1.5 rounded px-2 py-1 border ${
            tempStable ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300"
          }`}>
            {tempStable ? <CheckCircle2 size={12} className="text-emerald-400" /> : <AlertTriangle size={12} className="text-amber-400" />}
            <span>TEMP: <strong>{state.chamber.temperature.toFixed(2)}°C</strong></span>
          </div>

          <div className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sky-300">
            <span>RUN: <strong>{state.experiment.id || "NONE"}</strong></span>
          </div>

          <div 
            onClick={() => set("ui", { validatorModalOpen: true })}
            className={`flex items-center gap-1.5 rounded px-2 py-1 border cursor-pointer hover:bg-zinc-800 transition ${
              recordQuality === "VALID" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" :
              recordQuality === "SUSPECT" ? "border-amber-500/40 bg-amber-500/10 text-amber-300" :
              "border-zinc-700 bg-zinc-900 text-zinc-400"
            }`}
          >
            {recordQuality === "VALID" && <CheckCircle2 size={12} className="text-emerald-400" />}
            {recordQuality === "SUSPECT" && <AlertTriangle size={12} className="text-amber-400" />}
            <span>QUAL: <strong>{recordQuality} (Inspect)</strong></span>
          </div>

          <div className={`flex items-center gap-1 rounded px-2 py-1 border ${
            unresolved > 0 ? "border-rose-500/40 bg-rose-500/10 text-rose-300 animate-pulse" : "border-zinc-700 bg-zinc-900 text-zinc-400"
          }`}>
            <AlertTriangle size={12} className={unresolved > 0 ? "text-rose-400" : "text-zinc-500"} />
            <span>ALARMS: <strong>{unresolved}</strong></span>
          </div>

          <div className={`flex items-center gap-1 rounded px-2 py-1 border ${
            recordingState === "RUNNING" ? "border-sky-500/40 bg-sky-500/10 text-sky-300 animate-pulse" : "border-zinc-700 bg-zinc-900 text-zinc-400"
          }`}>
            <span>REC: <strong>{recordingState}</strong></span>
          </div>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[auto_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)_auto] md:overflow-hidden xl:grid-cols-[auto_minmax(0,1fr)_310px] xl:grid-rows-1">
        <aside className={`border-r border-zinc-800 bg-zinc-950/60 p-2.5 flex flex-col gap-3 transition-all duration-300 shrink-0 relative ${collapsed ? "w-16" : "w-60"}`}>
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            {!collapsed && <span className="text-[10px] font-bold uppercase tracking-[.2em] text-zinc-500">Lab Navigation</span>}
            <button 
              onClick={() => set("ui", { navCollapsed: !collapsed })} 
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition mx-auto"
              title={collapsed ? "Expand navigation" : "Collapse navigation"}
            >
              {collapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
            </button>
          </div>

          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            {navGroups.map((group, idx) => (
              <div key={idx} className="space-y-1">
                {!collapsed && <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 px-2">{group.group}</div>}
                {group.items.map(([id, label, Icon]) => {
                  const isAlarmPage = id === "dashboard" && unresolved > 0;
                  return (
                    <button 
                      key={id} 
                      onClick={() => set("ui", { active: id })} 
                      title={collapsed ? label : ""}
                      className={`flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs transition relative ${active === id ? "border border-sky-500/40 bg-sky-500/10 text-sky-200 font-bold" : "border border-transparent text-zinc-400 hover:bg-zinc-900"}`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{label}</span>}
                      {isAlarmPage && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {!collapsed && (
            <div className="mt-auto border-t border-zinc-800 pt-3">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-zinc-500">Simulation Speed</div>
              <select value={state.facility.speed} onChange={e => set("facility", { speed: Number(e.target.value) })} className="w-full rounded border border-zinc-700 bg-zinc-900 p-1.5 text-zinc-200 text-xs font-mono">
                <option value={1}>1x real-time</option>
                <option value={10}>10x accelerated</option>
                <option value={60}>60x accelerated</option>
              </select>
            </div>
          )}
        </aside>

        <section className="min-w-0 p-4 md:overflow-y-auto bg-zinc-950 flex flex-col">
          {active === "dashboard" && <Dashboard state={state} dispatch={dispatch} f0={f0} validationResult={validationResult} sweep={performSweep} HelpInfo={HelpInfo} />}
          {active === "overview" && <LabOverview state={state} dispatch={dispatch} />}
          {active === "chamber" && <Chamber state={state} dispatch={dispatch} HelpInfo={HelpInfo} />}
          {active === "spatial" && <SpatialField state={state} dispatch={dispatch} HelpInfo={HelpInfo} />}
          {active === "vna" && <Vna state={state} dispatch={dispatch} sweep={performSweep} f0={f0} HelpInfo={HelpInfo} />}
          {active === "ldv" && <Ldv state={state} dispatch={dispatch} HelpInfo={HelpInfo} />}
          {active === "scope" && <Scope state={state} dispatch={dispatch} HelpInfo={HelpInfo} />}
          {active === "clock" && <Clock state={state} dispatch={dispatch} HelpInfo={HelpInfo} />}
          {active === "runs" && <Runs state={state} dispatch={dispatch} exportCsv={exportCsv} exportJson={exportJson} sweep={performSweep} HelpInfo={HelpInfo} />}
          {active === "training" && <TrainingMode state={state} dispatch={dispatch} HelpInfo={HelpInfo} />}
          {active === "challenges" && <ChallengeMode state={state} dispatch={dispatch} HelpInfo={HelpInfo} />}
        </section>

        <aside className="flex flex-col overflow-hidden border-t border-zinc-800 bg-zinc-950/60 p-3 max-h-64 md:col-span-2 xl:col-span-1 xl:max-h-none xl:border-l xl:border-t-0">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-[.2em] text-zinc-500">Operations Journal</div>
            <div className="flex gap-1">
              <button onClick={exportJournalCsv} title="Export Journal CSV" className="rounded border border-zinc-700 bg-zinc-900 p-1 text-xs text-zinc-300 hover:bg-zinc-800"><Download size={12}/></button>
              <button onClick={() => set("ui", { alarmsOpen: !state.ui.alarmsOpen })} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-amber-400 flex items-center gap-1 font-mono">
                <AlertTriangle size={12} /> {unresolved}
              </button>
            </div>
          </div>
          {state.ui.alarmsOpen ? <AlarmList state={state} dispatch={dispatch} /> : <EventLog events={state.events} journalFilter={journalFilter} setJournalFilter={setJournalFilter} journalSearch={journalSearch} setJournalSearch={setJournalSearch} />}
        </aside>
      </main>

      {state.ui.cmdPaletteOpen && (
        <CommandPalette state={state} dispatch={dispatch} close={() => set("ui", { cmdPaletteOpen: false })} performSweep={performSweep} exportCsv={exportCsv} exportJson={exportJson} />
      )}

      {state.ui.wizardOpen && (
        <StartupWizard state={state} dispatch={dispatch} close={() => set("ui", { wizardOpen: false })} />
      )}

      {state.ui.calModalOpen && (
        <VnaCalibrationModal state={state} dispatch={dispatch} close={() => set("ui", { calModalOpen: false })} />
      )}

      {state.ui.validatorModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-mono text-xs">
            <div className="bg-zinc-800 p-4 border-b border-zinc-700 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2 text-sky-300 font-sans"><ShieldCheck size={18}/> Measurement Validation Inspector</h3>
              <button onClick={() => set("ui", { validatorModalOpen: false })} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex justify-between items-center bg-zinc-950 p-3 rounded border border-zinc-800 font-sans">
                <div>
                  <span className="text-zinc-400 text-xs block">Overall Quality Status:</span>
                  <strong className={`text-base ${validationResult.overall === "VALID" ? "text-emerald-400" : validationResult.overall === "SUSPECT" ? "text-amber-400" : "text-rose-400"}`}>
                    {validationResult.overall}
                  </strong>
                </div>
                <div className="text-right text-[11px] text-zinc-400">
                  Evaluated against S.P.H.E.R.E. standard metrology criteria
                </div>
              </div>

              <div className="border border-zinc-800 rounded overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-zinc-950 text-zinc-500 uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Validation Rule</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationResult.rules.map((r, i) => (
                      <tr key={i} className="border-t border-zinc-900">
                        <td className="p-3 text-zinc-200 font-bold">{r.rule}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            r.status === "Pass" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                            r.status === "Warning" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                            "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3 text-zinc-400">{r.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-zinc-950 p-3 border-t border-zinc-800 flex justify-end">
              <button onClick={() => set("ui", { validatorModalOpen: false })} className="px-4 py-1.5 bg-sky-600 text-white rounded text-xs font-bold font-sans">Close Inspector</button>
            </div>
          </div>
        </div>
      )}

      {state.ui.confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-amber-500/50 rounded-lg w-full max-w-md shadow-2xl overflow-hidden font-sans">
            <div className="bg-zinc-800 p-3 border-b border-zinc-700 flex justify-between items-center">
              <h3 className="font-bold text-amber-400 flex items-center gap-2"><AlertTriangle size={18}/> {state.ui.confirmModal.title}</h3>
              <button onClick={() => set("ui", { confirmModal: null })} className="text-gray-400 hover:text-white"><X size={18}/></button>
            </div>
            <div className="p-5 text-sm text-zinc-300 leading-relaxed">
              {state.ui.confirmModal.desc}
            </div>
            <div className="bg-zinc-950 p-3 flex justify-end gap-2">
              <button onClick={() => set("ui", { confirmModal: null })} className="px-4 py-1.5 bg-zinc-800 text-zinc-300 rounded text-xs font-bold">Cancel</button>
              <button onClick={state.ui.confirmModal.onConfirm} className="px-4 py-1.5 bg-amber-600 text-white rounded text-xs font-bold">Confirm Action</button>
            </div>
          </div>
        </div>
      )}

      {state.ui.glossaryOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="bg-zinc-800 p-4 border-b border-zinc-700 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2"><Book className="text-blue-400"/> S.P.H.E.R.E. Glossary of Terms</h3>
              <button onClick={() => set("ui", { glossaryOpen: false })} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {Object.values(GLOSSARY).map((item, i) => (
                <div key={i} className="bg-zinc-950 border border-zinc-800 p-3 rounded">
                  <h4 className="font-bold text-blue-400 mb-1">{item.title}</h4>
                  <p className="text-gray-300 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="bg-zinc-950 p-3 border-t border-zinc-800 flex justify-end">
              <button onClick={() => set("ui", { glossaryOpen: false })} className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-bold">Close</button>
            </div>
          </div>
        </div>
      )}

      {state.ui.manualOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="bg-zinc-800 p-4 border-b border-zinc-700 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2"><BookOpen className="text-blue-400"/> Procedure Manual</h3>
              <button onClick={() => set("ui", { manualOpen: false })} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {PROCEDURE_STEPS.map((step, i) => (
                <div key={i} className="flex gap-4 bg-zinc-950 border border-zinc-800 p-4 rounded items-start">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-blue-500 text-blue-400 flex items-center justify-center font-bold shrink-0">{step.step}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-bold text-gray-100">{step.title}</h4>
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">Badge: {step.badge}</span>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed mb-2">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-zinc-950 p-3 border-t border-zinc-800 flex justify-end">
              <button onClick={() => set("ui", { manualOpen: false })} className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-bold">Close</button>
            </div>
          </div>
        </div>
      )}

      {state.ui.videoModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border-2 border-zinc-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="bg-zinc-800 p-3 border-b border-zinc-700 flex justify-between items-center">
              <div className="flex items-center gap-2 text-zinc-300 font-bold text-sm">
                <Tv size={18} className="text-sky-400"/> S.P.H.E.R.E. Lab Media & Tutorial Laptop
              </div>
              <button onClick={() => set("ui", { videoModal: false })} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            
            <div className="grid md:grid-cols-[1fr_320px] flex-1 bg-black overflow-hidden">
              <div className="p-4 flex flex-col justify-center items-center bg-zinc-950 border-r border-zinc-800">
                <div className="w-full aspect-video bg-black rounded-lg border border-zinc-800 overflow-hidden relative shadow-inner">
                  {state.ui.activeVideo ? (
                    <iframe 
                      className="w-full h-full"
                      src={`https://www.youtube.com/embed/${state.ui.activeVideo.id}?autoplay=1`} 
                      title={state.ui.activeVideo.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">Select a video tutorial</div>
                  )}
                </div>
                <div className="w-full mt-3 text-left">
                  <h4 className="font-bold text-sky-300 text-sm">{state.ui.activeVideo?.title}</h4>
                  <p className="text-xs text-zinc-400 mt-1">{state.ui.activeVideo?.desc} <span className="text-zinc-500 font-mono">({state.ui.activeVideo?.speaker} • {state.ui.activeVideo?.duration})</span></p>
                </div>
              </div>

              <div className="p-3 bg-zinc-900 overflow-y-auto space-y-2 flex flex-col">
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Available Tutorials</div>
                {TUTORIAL_VIDEOS.map(v => (
                  <button 
                    key={v.id} 
                    onClick={() => set("ui", { activeVideo: v })}
                    className={`w-full text-left p-2.5 rounded border transition flex flex-col gap-1 ${state.ui.activeVideo?.id === v.id ? "bg-sky-500/20 border-sky-500/50 text-sky-200" : "bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800"}`}
                  >
                    <div className="text-xs font-bold line-clamp-1">{v.title}</div>
                    <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                      <span>{v.speaker}</span>
                      <span>{v.duration}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-zinc-950 p-3 border-t border-zinc-800 flex justify-end">
              <button onClick={() => set("ui", { videoModal: false })} className="px-4 py-1.5 bg-sky-600 text-white rounded text-xs font-bold">Close Laptop</button>
            </div>
          </div>
        </div>
      )}

      {state.ui.peerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-sky-500/50 rounded-lg w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="bg-zinc-800 p-4 border-b border-zinc-700 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2 text-sky-300"><FileText size={18}/> Peer-Review Mode Questionnaire</h3>
              <button onClick={() => set("ui", { peerModal: false })} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <p className="text-zinc-400">To complete this experimental run record, answer the following peer-review validation questions:</p>
              
              <label className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-800">
                <span>1. Was the rubidium clock locked during acquisition?</span>
                <input type="checkbox" checked={state.peerReviewData.clockLocked} onChange={e => set("peerReviewData", { clockLocked: e.target.checked })} />
              </label>

              <label className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-800">
                <span>2. Was chamber pressure stable and &lt; 1e-3 Torr?</span>
                <input type="checkbox" checked={state.peerReviewData.pressureStable} onChange={e => set("peerReviewData", { pressureStable: e.target.checked })} />
              </label>

              <label className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-800">
                <span>3. Was chamber temperature thermally settled?</span>
                <input type="checkbox" checked={state.peerReviewData.tempSettled} onChange={e => set("peerReviewData", { tempSettled: e.target.checked })} />
              </label>

              <label className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-800">
                <span>4. Were spatial coordinates randomized to prevent drift mimicry?</span>
                <input type="checkbox" checked={state.peerReviewData.randomized} onChange={e => set("peerReviewData", { randomized: e.target.checked })} />
              </label>

              <div className="p-2 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-400 block">5. What uncertainty dominates this measurement?</span>
                <select 
                  value={state.peerReviewData.dominantUncertainty} 
                  onChange={e => set("peerReviewData", { dominantUncertainty: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded p-1 text-zinc-200"
                >
                  <option>Thermal Drift</option>
                  <option>Air Mass Loading</option>
                  <option>Clock Frequency Jitter</option>
                  <option>Stage Positioning Error</option>
                  <option>Ambient RF Interference</option>
                </select>
              </div>

              <label className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-800">
                <span>6. Does the residual spatial signal persist after confounder correction?</span>
                <input type="checkbox" checked={state.peerReviewData.residualPersists} onChange={e => set("peerReviewData", { residualPersists: e.target.checked })} />
              </label>
            </div>
            <div className="bg-zinc-950 p-3 border-t border-zinc-800 flex justify-end gap-2">
              <button onClick={() => set("ui", { peerModal: false })} className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded text-xs font-bold">Cancel</button>
              <button onClick={() => dispatch({ type: "SUBMIT_PEER_REVIEW" })} className="px-4 py-1.5 bg-sky-600 text-white rounded text-xs font-bold">Submit Review</button>
            </div>
          </div>
        </div>
      )}

      {state.ui.helpModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-blue-500/50 rounded-lg w-full max-w-md shadow-2xl overflow-hidden font-sans">
            <div className="bg-zinc-800 p-3 border-b border-zinc-700 flex justify-between items-center">
              <h3 className="font-bold text-blue-400 flex items-center gap-2"><Info size={16}/> Definition</h3>
              <button onClick={() => set("ui", { helpModal: null })} className="text-gray-400 hover:text-white"><X size={18}/></button>
            </div>
            <div className="p-5">
              <h4 className="text-lg font-bold text-gray-100 mb-2">{state.ui.helpModal.title}</h4>
              <p className="text-gray-300 text-sm leading-relaxed">{state.ui.helpModal.desc}</p>
            </div>
            <div className="bg-zinc-950 p-3 flex justify-end">
              <button onClick={() => set("ui", { helpModal: null })} className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-bold">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VnaCalibrationModal({ state, dispatch, close }) {
  const [calType, setCalType] = useState("SOLT 1-Port");
  const [progress, setProgress] = useState(0);
  const [calibrating, setCalibrating] = useState(false);

  const startCal = () => {
    setCalibrating(true);
    let p = 0;
    const interval = setInterval(() => {
      p += 25;
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          dispatch({ type: "CALIBRATE_VNA", calType });
          setCalibrating(false);
          close();
        }, 400);
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-sky-500/50 rounded-xl w-full max-w-md shadow-2xl overflow-hidden font-sans flex flex-col">
        <div className="bg-zinc-800 p-4 border-b border-zinc-700 flex justify-between items-center">
          <h3 className="font-bold text-sky-300 flex items-center gap-2"><Sliders size={18}/> VNA Calibration Procedure</h3>
          <button onClick={close} className="text-gray-400 hover:text-white"><X size={20}/></button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-zinc-300">Select calibration standard plane and execute vector error correction.</p>
          
          <label className="block text-xs text-zinc-400">Calibration Standard Type
            <select 
              value={calType} 
              disabled={calibrating}
              onChange={e => setCalType(e.target.value)} 
              className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-zinc-200"
            >
              <option value="Response (Thru)">Response (Thru)</option>
              <option value="Open Standard">Open Standard</option>
              <option value="Short Standard">Short Standard</option>
              <option value="Load Standard (50Ω)">Load Standard (50Ω)</option>
              <option value="SOLT 1-Port (Open/Short/Load/Thru)">Full 1-Port SOLT Calibration</option>
              <option value="User Fixture Compensation">User-Defined Fixture Compensation</option>
            </select>
          </label>

          <div className="bg-zinc-950 p-3 rounded border border-zinc-800 text-[11px] font-mono space-y-1 text-zinc-400">
            <div>Current Freq Range: {(state.vna.center - state.vna.span/2).toFixed(0)} Hz — {(state.vna.center + state.vna.span/2).toFixed(0)} Hz</div>
            <div>Chamber Temp at Cal: {state.chamber.temperature.toFixed(2)} °C</div>
            <div>Pressure at Cal: {fmtPressure(state.chamber.pressure)}</div>
          </div>

          {calibrating && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono text-sky-300">
                <span>Executing {calType}...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-zinc-950 h-2 rounded overflow-hidden border border-zinc-800">
                <div className="bg-sky-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="bg-zinc-950 p-4 border-t border-zinc-800 flex justify-end gap-2">
          <button onClick={close} disabled={calibrating} className="px-4 py-1.5 bg-zinc-800 text-zinc-300 rounded text-xs font-bold">Cancel</button>
          <button onClick={startCal} disabled={calibrating} className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-bold">Start Calibration</button>
        </div>
      </div>
    </div>
  );
}

function CommandPalette({ state, dispatch, close, performSweep, exportCsv, exportJson }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const commands = [
    { label: "Navigate: Operator Console", action: () => dispatch({ type: "SET_UI", patch: { active: "dashboard" } }), category: "Navigation" },
    { label: "Navigate: 3D Chamber & Stage", action: () => dispatch({ type: "SET_UI", patch: { active: "chamber" } }), category: "Navigation" },
    { label: "Navigate: Spatial Field Explorer", action: () => dispatch({ type: "SET_UI", patch: { active: "spatial" } }), category: "Navigation" },
    { label: "Navigate: VNA Analysis", action: () => dispatch({ type: "SET_UI", patch: { active: "vna" } }), category: "Navigation" },
    { label: "Navigate: LDV Scanner", action: () => dispatch({ type: "SET_UI", patch: { active: "ldv" } }), category: "Navigation" },
    { label: "Navigate: Oscilloscope", action: () => dispatch({ type: "SET_UI", patch: { active: "scope" } }), category: "Navigation" },
    { label: "Navigate: Frequency Reference", action: () => dispatch({ type: "SET_UI", patch: { active: "clock" } }), category: "Navigation" },
    { label: "Navigate: Experiment Runs", action: () => dispatch({ type: "SET_UI", patch: { active: "runs" } }), category: "Navigation" },
    { label: "Navigate: Training & Checklist", action: () => dispatch({ type: "SET_UI", patch: { active: "training" } }), category: "Navigation" },
    { label: "Navigate: Challenge Mode", action: () => dispatch({ type: "SET_UI", patch: { active: "challenges" } }), category: "Navigation" },
    
    { label: "Start Standard Experiment Run", action: () => dispatch({ type: "START_RUN" }), category: "Experiment" },
    { label: "Stop Active Experiment Run", action: () => dispatch({ type: "STOP_RUN" }), category: "Experiment" },
    { label: "Capture Single VNA Sweep", action: performSweep, category: "Instruments", disabled: !state.vna.power, reason: "VNA must be powered on" },
    { label: "Capture VNA Reference Trace", action: () => dispatch({ type: "CAPTURE_REFERENCE" }), category: "Instruments" },
    { label: "Open VNA Calibration Wizard", action: () => dispatch({ type: "SET_UI", patch: { calModalOpen: true } }), category: "Instruments" },
    { label: "Home XYZ Stage (0,0,0)", action: () => dispatch({ type: "HOME_STAGE" }), category: "Hardware" },
    
    { label: "Start Roughing Vacuum Pump", action: () => dispatch({ type: "PATCH", domain: "chamber", patch: { vent: false, roughing: true } }), category: "Chamber" },
    { label: 
      state.chamber.pressure <= 50 ? "Start Turbomolecular Pump" : "Start Turbomolecular Pump — unavailable until pressure is below 50 Torr", 
      action: () => {
        if (state.chamber.pressure <= 50) dispatch({ type: "PATCH", domain: "chamber", patch: { vent: false, roughing: true, turbo: true } });
        else dispatch({ type: "ALARM", text: "Turbo interlock active: pressure must be below 50 Torr.", severity: "critical" });
      }, 
      category: "Chamber",
      disabled: state.chamber.pressure > 50,
      reason: "Pressure must be < 50 Torr"
    },
    { label: "Toggle Faraday Cage Shielding", action: () => dispatch({ type: "PATCH", domain: "chamber", patch: { faraday: !state.chamber.faraday } }), category: "Chamber" },
    { label: "Toggle Active Vibration Isolation", action: () => dispatch({ type: "PATCH", domain: "chamber", patch: { isolation: !state.chamber.isolation } }), category: "Chamber" },
    
    { label: "Open Startup Wizard", action: () => dispatch({ type: "SET_UI", patch: { wizardOpen: true } }), category: "Help" },
    { label: "Open Procedure Manual", action: () => dispatch({ type: "SET_UI", patch: { manualOpen: true } }), category: "Help" },
    { label: "Open Glossary of Terms", action: () => dispatch({ type: "SET_UI", patch: { glossaryOpen: true } }), category: "Help" },
    { label: "Open Video Tutorial Laptop", action: () => dispatch({ type: "SET_UI", patch: { videoModal: true } }), category: "Help" },
    
    { label: "Acknowledge All Alarms", action: () => state.alarms.forEach(a => dispatch({ type: "ACK_ALARM", id: a.id })), category: "System" },
    { label: "Export Experiment Run CSV", action: exportCsv, category: "Data" },
    { label: "Export Experiment Run JSON", action: exportJson, category: "Data" },
  ];

  const filtered = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center pt-20 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden font-sans flex flex-col">
        <div className="p-3 border-b border-zinc-800 flex items-center gap-2 bg-zinc-950">
          <Search size={16} className="text-zinc-400" />
          <input 
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command or search workspace (e.g., 'sweep', 'vacuum', 'vna')..." 
            className="w-full bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none font-mono"
          />
          <button onClick={close} className="text-zinc-500 hover:text-white px-2 py-1 text-xs">Esc</button>
        </div>

        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {filtered.length ? filtered.map((c, i) => (
            <button
              key={i}
              disabled={c.disabled}
              onClick={() => {
                if (!c.disabled) {
                  c.action();
                  close();
                }
              }}
              className={`w-full text-left px-3 py-2 rounded flex justify-between items-center text-xs transition ${c.disabled ? "opacity-40 cursor-not-allowed bg-zinc-950 text-zinc-500" : "hover:bg-sky-500/10 hover:text-sky-300 text-zinc-300"}`}
            >
              <span className="font-medium">{c.label}</span>
              <span className="text-[10px] font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-zinc-500">{c.category}</span>
            </button>
          )) : (
            <div className="p-8 text-center text-zinc-500 text-xs">No matching commands found.</div>
          )}
        </div>

        <div className="bg-zinc-950 p-2.5 border-t border-zinc-800 text-[10px] text-zinc-500 flex justify-between">
          <span>Use arrow keys / click to select</span>
          <span>S.P.H.E.R.E. Command Palette</span>
        </div>
      </div>
    </div>
  );
}

function StartupWizard({ state, dispatch, close }) {
  const [step, setStep] = useState(1);
  const isTraining = state.facility.mode === "training";

  const isStepDone = (s) => {
    switch(s) {
      case 1: return state.facility.power;
      case 2: return state.clock.locked;
      case 3: return !state.chamber.doorOpen && state.chamber.vent;
      case 4: return state.chamber.pressure < 50;
      case 5: return state.chamber.pressure < 1e-3;
      case 6: return Math.abs(state.chamber.temperature - state.chamber.targetTemp) < 0.1;
      case 7: return state.vna.power && state.vna.rf && state.vna.calibrated;
      case 8: return state.ldv.power && state.ldv.shutter;
      case 9: return state.stage.homed;
      default: return true;
    }
  };

  const autoFixStep = (s) => {
    switch(s) {
      case 1: dispatch({ type: "POWER", value: true }); break;
      case 2: dispatch({ type: "PATCH", domain: "clock", patch: { power: true, locked: true } }); break;
      case 3: dispatch({ type: "PATCH", domain: "chamber", patch: { doorOpen: false, vent: true } }); break;
      case 4: dispatch({ type: "PATCH", domain: "chamber", patch: { vent: false, roughing: true } }); break;
      case 5: dispatch({ type: "PATCH", domain: "chamber", patch: { vent: false, roughing: true, turbo: true, pressure: 1e-4 } }); break;
      case 6: dispatch({ type: "PATCH", domain: "chamber", patch: { thermostat: true, temperature: state.chamber.targetTemp } }); break;
      case 7: dispatch({ type: "PATCH", domain: "vna", patch: { power: true, rf: true } }); dispatch({ type: "CALIBRATE_VNA", calType: "SOLT 1-Port" }); break;
      case 8: dispatch({ type: "PATCH", domain: "ldv", patch: { power: true, shutter: true } }); break;
      case 9: dispatch({ type: "HOME_STAGE" }); break;
      default: break;
    }
  };

  const steps = [
    { num: 1, title: "Initialize Facility Power", desc: "Ensure main AC breaker is online to energize instrument racks." },
    { num: 2, title: "Lock Master Rubidium Clock", desc: "Turn on SRS FS725 clock and achieve external 10 MHz lock." },
    { num: 3, title: "Verify Chamber Seals", desc: "Confirm chamber access door is closed and sealed." },
    { num: 4, title: "Rough Evacuation", desc: "Engage roughing pump to reduce chamber pressure below 50 Torr." },
    { num: 5, title: "High-Vacuum Turbo Pump", desc: "Engage turbomolecular pump to reach deep vacuum (< 1e-3 Torr)." },
    { num: 6, title: "Thermal Stabilization", desc: "Allow active thermostat to settle temperature drift to < 0.03°C." },
    { num: 7, title: "Calibrate VNA & Enable RF", desc: "Power Keysight VNA, enable RF output, and execute calibration." },
    { num: 8, title: "Engage LDV System", desc: "Power Polytec vibrometer and open mechanical laser shutter." },
    { num: 9, title: "Home XYZ Stage", desc: "Home precision non-magnetic positioning stage to reference origin (0,0,0)." }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-emerald-500/50 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden font-sans flex flex-col">
        <div className="bg-zinc-800 p-4 border-b border-zinc-700 flex justify-between items-center">
          <h3 className="font-bold text-emerald-400 flex items-center gap-2"><Wrench size={18}/> Facility Bring-Up & Startup Wizard</h3>
          <button onClick={close} className="text-gray-400 hover:text-white"><X size={20}/></button>
        </div>

        <div className="p-6 space-y-5 flex-1 overflow-y-auto">
          <div className="flex justify-between text-xs text-zinc-400 font-mono">
            <span>Step {step} of {steps.length}</span>
            <span>Estimated time: {(steps.length - step + 1) * 2}s simulated</span>
          </div>

          <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${(step / steps.length) * 100}%` }} />
          </div>

          <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 space-y-2">
            <h4 className="font-bold text-base text-zinc-100 flex items-center gap-2">
              {steps[step - 1].title}
              {isStepDone(step) ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertTriangle size={16} className="text-amber-400" />}
            </h4>
            <p className="text-sm text-zinc-300 leading-relaxed">{steps[step - 1].desc}</p>
          </div>

          <div className="flex gap-2">
            {isTraining && (
              <button 
                onClick={() => autoFixStep(step)} 
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition"
              >
                Do this for me (Training Auto-Fix)
              </button>
            )}
            {!isTraining && (
              <button 
                onClick={() => setStep(s => Math.min(steps.length, s + 1))} 
                className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded text-xs transition"
              >
                Skip for Free-Lab
              </button>
            )}
          </div>
        </div>

        <div className="bg-zinc-950 p-4 border-t border-zinc-800 flex justify-between items-center">
          <button disabled={step === 1} onClick={() => setStep(s => Math.max(1, s - 1))} className="px-4 py-1.5 bg-zinc-800 disabled:opacity-40 text-zinc-300 rounded text-xs font-bold">Previous</button>
          <button onClick={() => step < steps.length ? setStep(s => s + 1) : close()} className="px-4 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold">
            {step === steps.length ? "Finish Wizard" : "Next Step"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TrainingMode({ state, dispatch, HelpInfo }) {
  const checkStep = (stepNum) => {
    switch(stepNum) {
      case 1: return state.facility.power;
      case 2: return state.clock.locked;
      case 3: return !state.chamber.vent && state.chamber.pressure < 1e-3;
      case 4: return state.vna.power && state.vna.rf;
      case 5: return state.ldv.power && state.ldv.shutter;
      case 6: return state.experiment.records.length > 0;
      default: return false;
    }
  };

  const handleBadgeAward = (badgeName, stepNum) => {
    if (checkStep(stepNum) && !state.badges.includes(badgeName)) {
      dispatch({ type: "AWARD_BADGE", badge: badgeName });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center">Training Mode & Interactive Checklist <HelpInfo termKey="location_variable" /></h1>
        <p className="mt-1 text-sm text-zinc-400">Follow the interactive checklist below. Complete each step to earn professional laboratory badges and master experimental metrology.</p>
      </div>

      <div className="grid gap-3">
        {PROCEDURE_STEPS.map((s) => {
          const completed = checkStep(s.step);
          const hasBadge = state.badges.includes(s.badge);
          return (
            <div key={s.step} className={`p-4 rounded-lg border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${completed ? "bg-emerald-950/20 border-emerald-500/40" : "bg-zinc-950 border-zinc-800"}`}>
              <div className="flex gap-3 items-start">
                <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${completed ? "bg-emerald-500/20 border-emerald-500 text-emerald-300" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>
                  {s.step}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
                    {s.title} {completed && <CheckCircle2 size={16} className="text-emerald-400"/>}
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1">{s.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <span className="text-[10px] bg-zinc-900 border border-zinc-700 text-zinc-300 px-2 py-1 rounded">Badge: {s.badge}</span>
                {completed && !hasBadge && (
                  <button onClick={() => handleBadgeAward(s.badge, s.step)} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition">
                    Claim Badge
                  </button>
                )}
                {hasBadge && (
                  <span className="px-3 py-1 bg-sky-500/20 border border-sky-500/40 text-sky-300 rounded text-xs font-bold flex items-center gap-1">
                    <Award size={12}/> Earned
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChallengeMode({ state, dispatch, HelpInfo }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center">Challenge Mode & Troubleshooting <HelpInfo termKey="fault_sim" /></h1>
        <p className="mt-1 text-sm text-zinc-400">Test your metrology expertise by diagnosing and fixing complex experimental anomalies.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {CHALLENGES.map((c) => {
          const passed = c.check(state);
          return (
            <div key={c.id} className={`p-4 rounded-lg border flex flex-col justify-between space-y-3 ${passed ? "bg-emerald-950/20 border-emerald-500/40" : "bg-zinc-950 border-zinc-800"}`}>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-sm text-zinc-100">{c.title}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${passed ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"}`}>
                    {passed ? "SOLVED" : "ACTIVE"}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{c.desc}</p>
              </div>
              <div className="flex justify-end">
                <span className={`text-xs font-semibold ${passed ? "text-emerald-400" : "text-zinc-500"}`}>
                  {passed ? "✓ Challenge verified successfully" : "Awaiting correct instrument state..."}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────── Shared graphics layer ───────────── */
const TW_FALLBACK = "\n.lab-root{font-family:\"Inter Tight\",\"Segoe UI\",system-ui,sans-serif;background:radial-gradient(1200px 600px at 70% -10%,rgba(56,189,248,.07),transparent 60%),radial-gradient(900px 500px at 0% 100%,rgba(245,158,11,.05),transparent 60%),linear-gradient(#070a10,#05070b)}\n.lab-root .font-mono,.lab-root code,.lab-root table{font-family:\"JetBrains Mono\",\"Cascadia Mono\",ui-monospace,monospace;font-variant-numeric:tabular-nums}\n.lab-root h1{font-weight:600;letter-spacing:-.01em;color:#e8f1fb}\n.lab-root header{background:linear-gradient(#0d121b,#080b11);box-shadow:0 1px 0 rgba(125,211,252,.18),0 8px 24px rgba(0,0,0,.5)}\n.lab-root aside{background:linear-gradient(180deg,#0b1018,#070a10)}\n.lab-root section{background:radial-gradient(circle at 1px 1px,rgba(148,163,184,.07) 1px,transparent 0) 0 0/22px 22px,#080b11}\n.lab-root .rounded-lg.bg-zinc-950{background:linear-gradient(160deg,#10161f,#0a0e15);border-color:#1e2a38;box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 10px 30px rgba(0,0,0,.45)}\n.lab-root .rounded-xl.border-4{position:relative;border-color:#3a4553;background:repeating-linear-gradient(90deg,rgba(255,255,255,.025) 0 1px,transparent 1px 3px),linear-gradient(180deg,#2b3440,#161c25 55%,#0e1218);box-shadow:inset 0 2px 0 rgba(255,255,255,.12),inset 0 -3px 8px rgba(0,0,0,.6),0 18px 40px rgba(0,0,0,.6)}\n.lab-root .rounded-xl.border-4::before{content:\"\";position:absolute;inset:5px;pointer-events:none;background:radial-gradient(circle at 6px 6px,#aab4c2 0 2px,#3b4552 3px,transparent 4px),radial-gradient(circle at calc(100% - 6px) 6px,#aab4c2 0 2px,#3b4552 3px,transparent 4px),radial-gradient(circle at 6px calc(100% - 6px),#aab4c2 0 2px,#3b4552 3px,transparent 4px),radial-gradient(circle at calc(100% - 6px) calc(100% - 6px),#aab4c2 0 2px,#3b4552 3px,transparent 4px)}\n.lab-root .border-2.border-zinc-600.bg-black{position:relative;overflow:hidden;border-color:#0c1118;border-radius:10px;background:radial-gradient(ellipse at center,#07131f,#020509 75%);box-shadow:inset 0 0 40px rgba(56,189,248,.12),inset 0 0 0 1px #223244,0 0 0 2px #05080c}\n.lab-root .border-2.border-zinc-600.bg-black::after{content:\"\";position:absolute;inset:0;pointer-events:none;z-index:5;background:repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0 1px,transparent 1px 3px),radial-gradient(ellipse at center,transparent 60%,rgba(0,0,0,.55)),linear-gradient(115deg,rgba(255,255,255,.05),transparent 30%)}\n.lab-root button{transition:background-color .15s,border-color .15s,transform .08s,box-shadow .15s}\n.lab-root button:not(:disabled):active{transform:translateY(1px)}\n.lab-root button:not(:disabled):hover{box-shadow:0 0 0 1px rgba(125,211,252,.25),0 4px 14px rgba(0,0,0,.4)}\n.lab-root button:disabled{filter:saturate(.4)}\n.lab-root :focus-visible{outline:2px solid #7dd3fc;outline-offset:2px}\n.lab-root input[type=range]{height:6px}\n.lab-root input[type=number],.lab-root select,.lab-root input:not([type]){background:linear-gradient(#05080d,#0a1018);border-color:#26364a}\n.lab-root .w-3.h-3.rounded-full{animation:ledbreath 2.4s ease-in-out infinite}\n.lab-root .overflow-y-auto{scrollbar-width:thin;scrollbar-color:#2b3a4d #080b11}\n.lab-root ::-webkit-scrollbar{width:8px;height:8px}.lab-root ::-webkit-scrollbar-thumb{background:#2b3a4d;border-radius:8px}.lab-root ::-webkit-scrollbar-track{background:#080b11}\n.lab-root .recharts-cartesian-axis-tick-value{font-family:ui-monospace,monospace}\n.gas-p{animation:gasdrift 6s ease-in-out infinite}\n@keyframes gasdrift{0%,100%{transform:translate(0,0)}50%{transform:translate(18px,-12px)}}\n@keyframes ledbreath{0%,100%{filter:brightness(.85)}50%{filter:brightness(1.35)}}\n@media (prefers-reduced-motion:reduce){.gas-p,.lab-root .w-3.h-3.rounded-full{animation:none}.lab-root *{transition:none!important}}\n" + ".bg-\\[\\#090c13\\]\\/95{background-color:rgba(9,12,19,.95)}.bg-\\[\\#06080d\\]{background-color:#06080d}.h-\\[180px\\]{height:180px}.h-\\[280px\\]{height:280px}.h-\\[300px\\]{height:300px}.h-\\[320px\\]{height:320px}.h-\\[380px\\]{height:380px}.max-h-\\[380px\\]{max-height:380px}.max-h-\\[460px\\]{max-height:460px}.max-h-\\[80vh\\]{max-height:80vh}.max-h-\\[85vh\\]{max-height:85vh}.max-h-\\[90vh\\]{max-height:90vh}.shadow-\\[0_0_10px_3px_rgba\\(52\\,211\\,153\\,\\.45\\)\\]{box-shadow:0 0 10px 3px rgba(52,211,153,.45)}.shadow-\\[0_0_8px_2px_rgba\\(16\\,185\\,129\\,0\\.7\\)\\]{box-shadow:0 0 8px 2px rgba(16,185,129,0.7)}.shadow-\\[0_0_8px_2px_rgba\\(217\\,70\\,239\\,0\\.7\\)\\]{box-shadow:0 0 8px 2px rgba(217,70,239,0.7)}.shadow-\\[0_0_8px_2px_rgba\\(245\\,158\\,11\\,0\\.7\\)\\]{box-shadow:0 0 8px 2px rgba(245,158,11,0.7)}.text-\\[10px\\]{font-size:10px}.text-\\[11px\\]{font-size:11px}.text-\\[9px\\]{font-size:9px}.tracking-\\[\\.25em\\]{letter-spacing:.25em}.tracking-\\[\\.2em\\]{letter-spacing:.2em}.tracking-\\[\\.4em\\]{letter-spacing:.4em}@media (min-width:768px){.md\\:grid-cols-\\[1fr_320px\\]{grid-template-columns:1fr 320px}.md\\:grid-cols-\\[auto_minmax\\(0\\,1fr\\)\\]{grid-template-columns:auto minmax(0,1fr)}.md\\:grid-rows-\\[minmax\\(0\\,1fr\\)_auto\\]{grid-template-rows:minmax(0,1fr) auto}}@media (min-width:1280px){.xl\\:grid-cols-\\[\\.85fr_1\\.5fr\\]{grid-template-columns:.85fr 1.5fr}.xl\\:grid-cols-\\[1\\.1fr_\\.9fr\\]{grid-template-columns:1.1fr .9fr}.xl\\:grid-cols-\\[1\\.35fr_\\.9fr\\]{grid-template-columns:1.35fr .9fr}.xl\\:grid-cols-\\[1\\.45fr_\\.8fr\\]{grid-template-columns:1.45fr .8fr}.xl\\:grid-cols-\\[1\\.55fr_\\.8fr\\]{grid-template-columns:1.55fr .8fr}.xl\\:grid-cols-\\[1\\.5fr_\\.8fr\\]{grid-template-columns:1.5fr .8fr}.xl\\:grid-cols-\\[1fr_320px\\]{grid-template-columns:1fr 320px}.xl\\:grid-cols-\\[auto_minmax\\(0\\,1fr\\)_310px\\]{grid-template-columns:auto minmax(0,1fr) 310px}}";

const SCREEN = { grid: "#142030", major: "#24384c", axis: "#6b7c90", s11: "#5fd4ff", fit: "#ffb347", scope: "#ffe066", ldv: "#e879f9" };

const ScreenTip = ({ active, payload, label, xFmt, yFmt }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: "rgba(6,10,16,.94)", border: "1px solid #2f4357", borderRadius: 6, padding: "6px 8px", fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#cfe3f5" }}>
      <div style={{ color: "#8fa5bb" }}>{xFmt ? xFmt(label) : label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color }}>{p.name || p.dataKey}: {yFmt ? yFmt(p.value) : Number(p.value).toFixed(2)}</div>
      ))}
    </div>
  );
};

function GlowDefs({ id, color }) {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute", pointerEvents: "none" }}>
      <defs>
        <filter id={`glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".5" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function S11Plot({ trace, compact, progress = null }) {
  const shown = progress == null ? trace : trace.slice(0, Math.max(2, Math.ceil(trace.length * progress)));
  const min = progress == null && trace.length ? trace.reduce((a, b) => (a.s11 < b.s11 ? a : b)) : null;
  const fs = compact ? 9 : 10;
  const axisLabel = (value, angle) => compact ? undefined : { value, angle, position: angle ? "insideLeft" : "insideBottom", offset: angle ? 4 : -8, fill: SCREEN.axis, fontSize: 10 };
  return (
    <>
    <GlowDefs id="s11" color={SCREEN.s11} />
    <ResponsiveContainer>
      <LineChart data={shown} margin={{ top: 8, right: compact ? 6 : 18, bottom: compact ? 0 : 16, left: compact ? -14 : 4 }}>
        <CartesianGrid stroke={SCREEN.grid} />
        <XAxis type="number" dataKey="freq" domain={[trace.length ? trace[0].freq : 0, trace.length ? trace[trace.length - 1].freq : 1]} tickCount={compact ? 4 : 7} tickFormatter={v => (v / 1000).toFixed(compact ? 1 : 2)} stroke={SCREEN.axis} fontSize={fs} tickLine={false} label={axisLabel("Frequency (kHz)", 0)} />
        <YAxis domain={[-35, 2]} ticks={[-35, -30, -25, -20, -15, -10, -5, 0]} stroke={SCREEN.axis} fontSize={fs} tickLine={false} width={compact ? 32 : 46} label={axisLabel("S11 (dB)", -90)} />
        <Tooltip content={<ScreenTip xFmt={v => `${Number(v).toFixed(2)} Hz`} yFmt={v => `${Number(v).toFixed(2)} dB`} />} />
        <ReferenceLine y={-10} stroke="#3d5a73" strokeDasharray="3 5" />
        {min && <ReferenceLine x={min.freq} stroke={SCREEN.fit} strokeOpacity={0.35} strokeDasharray="2 4" />}
        <Line name="S11" dataKey="s11" stroke={SCREEN.s11} dot={false} strokeWidth={compact ? 1.5 : 2} isAnimationActive={false} style={{ filter: "url(#glow-s11)" }} />
        {!compact && <Line name="Fit" dataKey="fit" stroke={SCREEN.fit} dot={false} strokeDasharray="5 4" strokeOpacity={0.7} strokeWidth={1.2} isAnimationActive={false} />}
        {min && <ReferenceDot x={min.freq} y={min.s11} r={4} fill={SCREEN.fit} stroke="#fff" strokeWidth={1} label={compact ? undefined : { value: `${min.freq.toFixed(1)} Hz · ${min.s11.toFixed(1)} dB`, position: "right", fill: "#ffd08a", fontSize: 10 }} />}
      </LineChart>
    </ResponsiveContainer>
    </>
  );
}

function ScopePlot({ trace, scale, timebase, compact }) {
  const xt = Array.from({ length: 11 }, (_, i) => i * 25);
  const yt = Array.from({ length: 9 }, (_, i) => -1.5 + i * 0.375);
  return (
    <div className="relative h-full w-full">
      <GlowDefs id="scope" color={SCREEN.scope} />
      <ResponsiveContainer>
        <LineChart data={trace} margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
          <CartesianGrid stroke={SCREEN.grid} />
          <XAxis type="number" dataKey="t" domain={[0, 250]} ticks={xt} tick={false} tickLine={false} axisLine={{ stroke: SCREEN.major }} />
          <YAxis domain={[-1.5, 1.5]} ticks={yt} tick={false} tickLine={false} axisLine={{ stroke: SCREEN.major }} width={4} />
          <ReferenceLine y={0} stroke={SCREEN.major} />
          <ReferenceLine x={125} stroke={SCREEN.major} />
          {!compact && <Tooltip content={<ScreenTip xFmt={v => `sample ${v}`} yFmt={v => `${Number(v).toFixed(3)} V`} />} />}
          <Line name="CH1" dataKey="value" stroke={SCREEN.scope} dot={false} strokeWidth={compact ? 1 : 1.5} isAnimationActive={false} style={{ filter: "url(#glow-scope)" }} />
        </LineChart>
      </ResponsiveContainer>
      {!compact && (
        <>
          <div className="pointer-events-none absolute bottom-2 left-3 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px]" style={{ color: SCREEN.scope }}>CH1 {scale ?? 0.5} V/div</div>
          <div className="pointer-events-none absolute bottom-2 right-3 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">{timebase ?? 1} µs/div</div>
        </>
      )}
    </div>
  );
}

function SpectrumPlot({ data }) {
  const peak = data.reduce((a, b) => (a.a > b.a ? a : b));
  return (
    <div className="h-[280px]">
      <GlowDefs id="ldv" color={SCREEN.ldv} />
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 18, bottom: 16, left: 4 }}>
          <CartesianGrid stroke={SCREEN.grid} />
          <XAxis type="number" dataKey="f" domain={["dataMin", "dataMax"]} tickFormatter={v => v.toFixed(1)} stroke={SCREEN.axis} fontSize={10} tickLine={false} label={{ value: "Frequency (kHz)", position: "insideBottom", offset: -8, fill: SCREEN.axis, fontSize: 10 }} />
          <YAxis domain={[-0.05, 1]} tickFormatter={v => v.toFixed(1)} stroke={SCREEN.axis} fontSize={10} tickLine={false} width={44} label={{ value: "Velocity (a.u.)", angle: -90, position: "insideLeft", offset: 4, fill: SCREEN.axis, fontSize: 10 }} />
          <Tooltip content={<ScreenTip xFmt={v => `${Number(v).toFixed(2)} kHz`} yFmt={v => `${Number(v).toFixed(3)} a.u.`} />} />
          <ReferenceLine x={peak.f} stroke={SCREEN.ldv} strokeOpacity={0.35} strokeDasharray="2 4" />
          <Area name="Displacement" dataKey="a" type="monotone" stroke={SCREEN.ldv} strokeWidth={2} fill="url(#fill-ldv)" isAnimationActive={false} style={{ filter: "url(#glow-ldv)" }} />
          <ReferenceDot x={peak.f} y={peak.a} r={4} fill="#fff" stroke={SCREEN.ldv} strokeWidth={2} label={{ value: `${peak.f.toFixed(2)} kHz`, position: "top", fill: "#f5d0fe", fontSize: 10 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChamberSVG({ state, mini, cv }) {
  const { stage, chamber, ldv, vna } = state;
  const px = 300 + stage.x * 4, py = 190 - stage.z * 3;
  const r = 24 + stage.y * 0.12;
  const haze = clamp(Math.log10(Math.max(chamber.pressure, 0.01)) / 2.88, 0, 1);
  const dT = chamber.temperature - 20;
  const tint = dT > 0 ? "255,120,40" : "60,140,255";
  const shield = chamber.faraday ? "#d99a2b" : "#e11d48";
  const laser = ldv.power && ldv.shutter;
  const rf = vna.power && vna.rf;
  const shell = !!(cv && cv.shell), cut = !!(cv && cv.cut), pumping = chamber.roughing || chamber.turbo;
  const drift = chamber.temperature - chamber.targetTemp;
  const mono = { fontFamily: "ui-monospace, monospace" };
  return (
    <div className={mini ? "h-full w-full overflow-hidden rounded border border-zinc-800 bg-black" : "h-[380px] w-full overflow-hidden rounded-lg border-2 border-zinc-700 bg-black"}>
      <svg viewBox="0 0 600 380" className="h-full w-full" role="img" aria-label="Thermal-vacuum chamber showing sphere position">
        <defs>
          <linearGradient id="ch-steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4b5563" /><stop offset=".5" stopColor="#1f2937" /><stop offset="1" stopColor="#374151" /></linearGradient>
          <radialGradient id="ch-sphere" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#fff3c4" /><stop offset=".35" stopColor="#f2b134" /><stop offset="1" stopColor="#5a2e07" /></radialGradient>
          <radialGradient id="ch-bg" cx=".5" cy=".5" r=".7"><stop offset="0" stopColor="#0f1b2b" /><stop offset="1" stopColor="#05080d" /></radialGradient>
          <linearGradient id="ch-glare" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity=".09" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient><pattern id="ch-mesh" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0H0V8" fill="none" stroke="#fbbf24" strokeWidth=".5" /></pattern><radialGradient id="ch-lamp" cx=".5" cy="0" r=".9"><stop offset="0" stopColor="#e0f2fe" stopOpacity=".22" /><stop offset="1" stopColor="#e0f2fe" stopOpacity="0" /></radialGradient><filter id="ch-blur"><feGaussianBlur stdDeviation="7" /></filter>
          <pattern id="ch-gas" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r="1" fill="#9fc4e8" /><circle cx="10" cy="11" r="1" fill="#9fc4e8" /></pattern>
          <clipPath id="ch-win"><rect x="60" y="50" width="480" height="280" rx="12" /></clipPath>
        </defs>
        <rect x="8" y="8" width="584" height="364" rx="22" fill="url(#ch-steel)" stroke="#6b7280" strokeWidth="3" />
        {!mini && Array.from({ length: 10 }).map((_, i) => (
          <g key={i}>
            <circle cx={40 + i * 57} cy="28" r="5" fill="#9ca3af" stroke="#374151" />
            <circle cx={40 + i * 57} cy="352" r="5" fill="#9ca3af" stroke="#374151" />
          </g>
        ))}
        <g clipPath="url(#ch-win)">
          <rect x="60" y="50" width="480" height="280" fill="url(#ch-bg)" />
          <rect x="60" y="50" width="480" height="280" fill="url(#ch-gas)" opacity={haze * 0.35} />
          <rect x="60" y="50" width="480" height="280" fill={`rgb(${tint})`} opacity={clamp(Math.abs(dT) / 8, 0, 0.22)} />
          {chamber.faraday && <rect className="ch-fx" x="60" y="50" width="480" height="280" fill="url(#ch-mesh)" opacity=".28" />}
          <rect className="ch-fx" x="60" y="50" width="480" height="280" fill="url(#ch-lamp)" />
          {pumping && <path className="flow-line" d={`M${px} ${py} C 220 ${py} 150 190 62 190`} stroke="#7dd3fc" strokeWidth="1.6" strokeDasharray="3 9" fill="none" opacity=".6" />}
          {[100, 180, 260, 340, 420, 500].map(x => <line key={x} x1={x} y1="50" x2={x} y2="330" stroke="#122033" />)}
          {[90, 140, 190, 240, 290].map(y => <line key={y} x1="60" y1={y} x2="540" y2={y} stroke="#122033" />)}
          <line x1="60" y1={py} x2="540" y2={py} stroke="#334155" strokeDasharray="4 5" />
          <line x1={px} y1="50" x2={px} y2="330" stroke="#334155" strokeDasharray="4 5" />
          {rf && <path d={`M540 190 L${px + r} ${py}`} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="6 4" fill="none" />}
          {Array.from({ length: 16 }).map((_, i) => (
            <circle key={`g${i}`} className="gas-p" cx={80 + ((i * 97) % 440)} cy={70 + ((i * 53) % 230)} r="1.6" fill="#9fc4e8" opacity={haze * 0.75} style={{ animationDelay: `${-i * 0.7}s`, animationDuration: `${5 + (i % 5)}s` }} />
          ))}
          <rect x="60" y="318" width="480" height="12" fill="#111827" />
          {Array.from({ length: 25 }).map((_, i) => <line key={`t${i}`} x1={60 + i * 20} y1="318" x2={60 + i * 20} y2={i % 5 === 0 ? 326 : 322} stroke="#475569" />)}
          <g style={{ transform: `translate(${px - 20}px, 0)`, transition: FX.reduced ? "none" : "transform .6s ease" }}><rect x="18" y="52" width="4" height="258" fill="#334155" /><rect y="310" width="40" height="14" rx="3" fill="#475569" stroke="#94a3b8" /></g>
          {laser && (
            <g>
              <line x1="300" y1="50" x2={px} y2={py - r} stroke="#ff3b5c" strokeWidth="6" opacity=".25" />
              <line x1="300" y1="50" x2={px} y2={py - r} stroke="#ff7a90" strokeWidth="1.4" />
            </g>
          )}
          <g style={{ transform: `translate(${px}px, ${py}px)`, transition: FX.reduced ? "none" : "transform .6s ease" }}>
            <ellipse rx={r + 4} ry={(r + 4) * 0.3} cy={r} fill="none" stroke="#94a3b8" strokeWidth="2" />
            <rect x="-2.5" y={r} width="5" height={Math.max(0, 330 - py - r)} fill="#475569" />
            <circle r={r + 12} fill="#f59e0b" opacity=".35" filter="url(#ch-blur)" />
            <circle r={r} fill="url(#ch-sphere)" stroke="#fcd34d" strokeWidth="1" />
            <ellipse rx={r} ry={r * 0.28} fill="none" stroke="#fff" strokeOpacity=".25" />
            <ellipse cx={-r * 0.3} cy={-r * 0.38} rx={r * 0.22} ry={r * 0.13} fill="#fff" opacity=".45" />
          </g>
        </g>
        <rect x="60" y="50" width="480" height="280" rx="12" fill="none" stroke={shield} strokeWidth="2.5" />
        <path d="M60 50 H300 L225 330 H60 Z" fill="url(#ch-glare)" pointerEvents="none" />
        {shell && <rect x="60" y="50" width={cut ? 240 : 480} height="280" rx="12" fill="#7dd3fc" opacity=".07" stroke="#7dd3fc" strokeOpacity=".35" />}
        <rect x="52" y="165" width="14" height="50" rx="3" fill="#475569" stroke="#94a3b8" />
        <rect x="534" y="165" width="14" height="50" rx="3" fill="#475569" stroke="#94a3b8" />
        <rect x="236" y="42" width="128" height="16" rx="5" fill="#0ea5e9" fillOpacity=".15" stroke="#38bdf8" strokeOpacity=".5" />
        {!mini && (
          <g style={mono} fontSize="10">
            <text x="300" y="54" textAnchor="middle" fill="#7dd3fc">QUARTZ VIEWPORT</text>
            <text x="72" y="158" fill="#94a3b8">VAC</text>
            <text x="508" y="158" fill="#94a3b8">RF</text>
            <text x="72" y="320" fill="#9fb3c8" fontSize="11">P {fmtPressure(chamber.pressure)}  ·  T {chamber.temperature.toFixed(2)} °C</text>
            <text x="72" y="304" fill={Math.abs(drift) < 0.03 ? "#86efac" : "#fdba74"} fontSize="11">{Math.abs(drift) < 0.03 ? "● stable" : drift > 0 ? "▲ +" + drift.toFixed(3) : "▼ " + drift.toFixed(3)} °C vs setpoint</text>
            <text x="528" y="320" textAnchor="end" fill="#9fb3c8" fontSize="11">X {stage.x.toFixed(1)}  Y {stage.y.toFixed(1)}  Z {stage.z.toFixed(1)} mm</text>
          </g>
        )}
        {chamber.doorOpen && (
          <g>
            <rect x="60" y="50" width="480" height="280" rx="12" fill="#e11d48" opacity=".18" />
            <text x="300" y="196" textAnchor="middle" fill="#fecdd3" fontSize="20" fontWeight="700" style={mono}>DOOR OPEN</text>
          </g>
        )}
      </svg>
    </div>
  );
}

const RAMPS = { diverging: ["#2563eb", "#93c5fd", "#e5e7eb", "#fca5a5", "#dc2626"], sequential: ["#5b21b6", "#22d3ee", "#fde047"] };
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function ramp(stops, t) {
  const n = stops.length - 1;
  const s = clamp(t, 0, 1) * n;
  const i = Math.min(n - 1, Math.floor(s));
  const f = s - i;
  const a = hexRgb(stops[i]), b = hexRgb(stops[i + 1]);
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",")})`;
}

function SpatialMaps({ records, view, state }) {
  const [o, setO] = useState({ order: true, planned: true, quality: true, labels: false, unc: true });
  const pl = state && state.experiment && (state.experiment.plan || state.experiment.planned || state.experiment.scanPlan);
  const planned = Array.isArray(pl) ? pl.filter(q => q && typeof q.x === "number") : [];
  const metric = view.metric;
  const stops = RAMPS[view.colorScale] || RAMPS.diverging;
  const get = r => (metric === "resonance" ? r.resonance : metric === "q" ? r.q : r.resonanceShift);
  const unit = metric === "q" ? "" : " Hz";
  const vals = records.map(get);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (view.colorScale === "diverging" && metric === "frequencyShift") { const m = Math.max(Math.abs(lo), Math.abs(hi)) || 1; lo = -m; hi = m; }
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const norm = v => (v - lo) / (hi - lo);
  const S = 180, O = 28;
  const sx = v => O + ((v + 35) / 70) * S;
  const sy = v => O + S - ((v + 35) / 70) * S;
  const panels = [{ t: "X–Z · front", a: "x", b: "z" }, { t: "X–Y · top", a: "x", b: "y" }, { t: "Y–Z · side", a: "y", b: "z" }];
  const interp = view.interpolation !== "none" && records.length >= 3;

  const cells = useMemo(() => {
    if (!interp) return {};
    const N = 18, out = {};
    panels.forEach(p => {
      const arr = [];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const ca = -35 + ((i + 0.5) / N) * 70, cb = -35 + ((j + 0.5) / N) * 70;
        let wsum = 0, vsum = 0;
        records.forEach(r => {
          const d2 = (r[p.a] - ca) ** 2 + (r[p.b] - cb) ** 2;
          const w = view.interpolation === "rbf" ? Math.exp(-d2 / (2 * 14 * 14)) : 1 / (d2 + 1e-3);
          wsum += w; vsum += w * get(r);
        });
        arr.push({ i, j, v: wsum > 1e-12 ? vsum / wsum : lo });
      }
      out[p.a + p.b] = arr;
    });
    return out;
  }, [records, view.interpolation, metric, interp]);

  if (!records.length) {
    return (
      <div className="flex h-[300px] w-full items-center justify-center rounded border border-zinc-800 bg-black/40 text-center text-xs text-zinc-500">
        <div><Box size={32} className="mx-auto mb-2 opacity-40" />No spatial measurements recorded yet. Run a scan plan or capture points in the VNA / Chamber views.</div>
      </div>
    );
  }

  return (
    <div className="w-full rounded border border-zinc-800 bg-black/40 p-3">
      <div className="mb-2 flex flex-wrap gap-3 text-[10px] text-zinc-300">{[["order", "Scan order"], ["planned", "Planned points"], ["quality", "Data quality"], ["labels", "Labels"], ["unc", "Uncertainty"]].map(([k, l]) => <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={o[k]} onChange={e => setO({ ...o, [k]: e.target.checked })} />{l}</label>)}</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {panels.map(p => (
          <svg key={p.t} viewBox="0 0 220 236" className="w-full" role="img" aria-label={`${p.t} projection`}>
            <rect x={O} y={O} width={S} height={S} fill="#070b12" stroke="#24384c" />
            {interp && (cells[p.a + p.b] || []).map(c => (
              <rect key={`${c.i}-${c.j}`} x={O + (c.i * S) / 18} y={O + S - ((c.j + 1) * S) / 18} width={S / 18 + 0.5} height={S / 18 + 0.5} fill={ramp(stops, norm(c.v))} opacity=".55" />
            ))}
            {[-35, -17.5, 0, 17.5, 35].map(t => (
              <g key={t}>
                <line x1={sx(t)} y1={O} x2={sx(t)} y2={O + S} stroke="#142030" />
                <line x1={O} y1={sy(t)} x2={O + S} y2={sy(t)} stroke="#142030" />
              </g>
            ))}
            <line x1={sx(0)} y1={O} x2={sx(0)} y2={O + S} stroke="#24384c" />
            <line x1={O} y1={sy(0)} x2={O + S} y2={sy(0)} stroke="#24384c" />
            <SpatialMarks p={p} records={records} stage={state.stage} planned={planned} o={o} sx={sx} sy={sy} colorOf={r => ramp(stops, norm(get(r)))} get={get} unit={unit} />
            <g fontSize="9" fill="#6b7c90" style={{ fontFamily: "ui-monospace, monospace" }}>
              <text x={O} y={O + S + 12}>-35</text>
              <text x={sx(0)} y={O + S + 12} textAnchor="middle">{p.a.toUpperCase()} (mm)</text>
              <text x={O + S} y={O + S + 12} textAnchor="end">35</text>
              <text x={O - 4} y={O + 8} textAnchor="end">35</text>
              <text x={O - 4} y={O + S} textAnchor="end">-35</text>
              <text x={O - 4} y={sy(0) + 3} textAnchor="end">{p.b.toUpperCase()}</text>
            </g>
            <text x={O} y="14" fontSize="10" fill="#cbd5e1">{p.t}</text>
          </svg>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 font-mono text-[10px] text-zinc-400">
        <span>{lo.toFixed(2)}{unit}</span>
        <div className="h-2.5 flex-1 rounded" style={{ background: `linear-gradient(90deg, ${stops.join(",")})` }} />
        <span>{hi.toFixed(2)}{unit}</span>
      </div>
      <div className="mt-1 text-[10px] text-zinc-500">
        Solid = valid · dashed amber ring = suspect · ✕ = invalid · square = planned · diamond = stage · yellow ring = next target · larger and brighter = nearer in depth.{view.interpolation !== "none" && records.length < 3 ? " Interpolation needs at least 3 points." : ""}
      </div>
    </div>
  );
}


/* ───────── Visual system: status conventions + reusable parts ───────── */
let FX = { reduced: false, hide: false };
const ST = { offline: ["Offline", "○", "#64748b"], powered: ["Powered", "◐", "#cbd5e1"], ready: ["Ready", "●", "#22d3ee"], acquiring: ["Acquiring", "▶", "#38bdf8"], warning: ["Warning", "▲", "#f59e0b"], critical: ["Fault", "■", "#ef4444"] };
function instStatus(s, k) {
  const f = s.failures || {};
  if (k === "clock") return !s.clock.power ? "offline" : (s.clock.cableFault || f.clockDrift) ? "critical" : s.clock.holdover ? "warning" : s.clock.locked ? "ready" : "powered";
  if (k === "vna") return !s.vna.power ? "offline" : (!s.chamber.faraday || f.emiSpike) ? "warning" : s.vna.rf && s.vna.continuous ? "acquiring" : s.vna.rf ? "ready" : "powered";
  if (k === "ldv") return !s.ldv.power ? "offline" : s.ldv.scanActive ? "acquiring" : s.ldv.shutter ? "ready" : "powered";
  if (k === "scope") return !s.scope.power ? "offline" : s.scope.running ? "acquiring" : "powered";
  if (k === "pumps") return !s.facility.power ? "offline" : s.chamber.turbo && s.chamber.pressure > 50 ? "critical" : s.chamber.turbo || s.chamber.roughing ? "acquiring" : "powered";
  return !s.facility.power ? "offline" : f.vacuumLeak ? "critical" : s.chamber.doorOpen || !s.chamber.isolation ? "warning" : s.chamber.pressure < 1e-3 ? "ready" : "powered";
}
function StatusLED({ status = "offline", label = true }) {
  const [t, g, c] = ST[status];
  return (
    <span role="status" className="inline-flex items-center gap-1 font-mono text-[10px]" style={{ color: c }}>
      <span aria-hidden="true" className={status === "critical" ? "lab-deco lab-alarm" : ""} style={{ textShadow: status === "offline" ? "none" : `0 0 6px ${c}` }}>{g}</span>
      {label && <span>{t}</span>}
    </span>
  );
}
function LabChassis({ status = "offline", className = "", children }) {
  return <div data-status={status} className={`relative rounded-xl border-4 border-zinc-700 p-4 ${className}`}>{children}</div>;
}
function InstrumentScreen({ children, className = "" }) {
  return <div className={`rounded border-2 border-zinc-600 bg-black p-3 ${className}`}>{children}</div>;
}
function RackScrew({ seed = 0 }) {
  return <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#2b3440" stroke="#8a97a8" /><line x1="3" y1="6" x2="9" y2="6" stroke="#cbd5e1" transform={`rotate(${(seed * 47) % 180} 6 6)`} /></svg>;
}
function RotaryKnob({ value, min, max, label, unit = "" }) {
  const a = -135 + ((value - min) / (max - min || 1)) * 270;
  return (
    <div className="inline-flex flex-col items-center" role="img" aria-label={`${label}: ${value}${unit}`}>
      <svg width="46" height="46" viewBox="0 0 46 46">
        <circle cx="23" cy="23" r="20" fill="#0e131b" stroke="#3a4553" strokeWidth="2" />
        <circle cx="23" cy="23" r="14" fill="url(#none)" stroke="#556070" style={{ fill: "#1a212b" }} />
        <line x1="23" y1="23" x2="23" y2="11" stroke="#7dd3fc" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${a} 23 23)`} style={{ transition: FX.reduced ? "none" : "transform .5s" }} />
      </svg>
      <span className="font-mono text-[9px] text-zinc-400">{label}</span>
    </div>
  );
}
function TelemetryReadout({ label, value, unit = "", sub, tone = "#7dd3fc" }) {
  return (
    <div className="rounded border border-zinc-800 bg-black/60 px-2 py-1 font-mono">
      <div className="text-[9px] text-zinc-500">{label}</div>
      <div className="text-sm font-bold" style={{ color: tone }}>{value}<span className="ml-1 text-[10px] text-zinc-400">{unit}</span></div>
      {sub && <div className="text-[9px] text-zinc-500">{sub}</div>}
    </div>
  );
}
function AnimatedScanCursor({ p }) {
  return <div aria-hidden="true" className="pointer-events-none absolute top-2 bottom-4 z-10" style={{ left: `calc(46px + (100% - 64px) * ${p})`, width: 2, background: "#22d3ee", boxShadow: "0 0 10px 2px rgba(34,211,238,.7)" }} />;
}
function SignalPath({ d, color, dash, active, label }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={active ? 2.5 : 1} strokeDasharray={dash} opacity={active ? 1 : 0.15} className={active ? "lab-deco sig-flow" : ""}><title>{label}{active ? " (active)" : " (idle)"}</title></path>;
}

function FxSettings({ fx, setFx }) {
  return (
    <div className="fixed bottom-2 left-2 z-40 flex gap-3 rounded border border-zinc-700 bg-black/80 px-2 py-1 text-[10px] text-zinc-300">
      <label className="flex items-center gap-1"><input type="checkbox" checked={fx.reduced} onChange={e => setFx({ ...fx, reduced: e.target.checked })} /> Reduce motion</label>
      <label className="flex items-center gap-1"><input type="checkbox" checked={fx.hide} onChange={e => setFx({ ...fx, hide: e.target.checked })} /> Hide decorative effects</label>
    </div>
  );
}

function ChamberView({ state, cv, setCv }) {
  const cams = { front: "none", iso: "perspective(900px) rotateX(16deg) rotateY(-18deg)", top: "perspective(900px) rotateX(38deg)" };
  const T = ({ k, children }) => <button aria-pressed={!!cv[k]} onClick={() => setCv({ ...cv, [k]: !cv[k] })} className={`rounded border px-2 py-1 text-[10px] ${cv[k] ? "border-sky-500 text-sky-200" : "border-zinc-700 text-zinc-400"}`}>{children}</button>;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <T k="shell">Transparent shell</T><T k="cut">Cutaway</T>
        {["front", "iso", "top"].map(c => <button key={c} aria-pressed={cv.cam === c} onClick={() => setCv({ ...cv, cam: c })} className={`rounded border px-2 py-1 text-[10px] ${cv.cam === c ? "border-sky-500 text-sky-200" : "border-zinc-700 text-zinc-400"}`}>{c === "iso" ? "Isometric" : c[0].toUpperCase() + c.slice(1)}</button>)}
        <StatusLED status={instStatus(state, "chamber")} />
      </div>
      <div style={{ transform: cams[cv.cam], transition: FX.reduced ? "none" : "transform .7s ease", transformOrigin: "center" }}><ChamberSVG state={state} cv={cv} /></div>
    </div>
  );
}

function SpatialMarks({ p, records, stage, planned, o, sx, sy, colorOf, get, unit }) {
  const dk = ["x", "y", "z"].find(k => k !== p.a && k !== p.b);
  const seq = [...records].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  const rest = planned.filter(q => !seq.some(r => Math.hypot(r.x - q.x, r.y - q.y, r.z - q.z) < 0.6));
  const pt = q => `${sx(q[p.a])},${sy(q[p.b])}`;
  const last = seq[seq.length - 1];
  const tgt = rest[0];
  return (
    <g>
      {o.order && seq.length > 1 && <polyline points={seq.map(pt).join(" ")} fill="none" stroke="#22d3ee" strokeWidth="1.5" opacity=".7" />}
      {o.order && rest.length > 0 && <polyline points={[...(last ? [last] : []), ...rest].map(pt).join(" ")} fill="none" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="4 4" opacity=".7" />}
      {o.planned && rest.map((q, i) => <rect key={`pl${i}`} x={sx(q[p.a]) - 3.5} y={sy(q[p.b]) - 3.5} width="7" height="7" fill="none" stroke="#94a3b8"><title>{`Planned ${q.x}, ${q.y}, ${q.z}`}</title></rect>)}
      {tgt && <circle cx={sx(tgt[p.a])} cy={sy(tgt[p.b])} r="9" fill="none" stroke="#facc15" strokeWidth="2" className="lab-deco sig-pulse"><title>Active target</title></circle>}
      {seq.map(r => {
        const d = (r[dk] + 35) / 70, k = 0.75 + d * 0.6, cx = sx(r[p.a]), cy = sy(r[p.b]);
        const bad = r.uncertaintyHz > 1 || r.clockLocked === false, sus = !r.valid && !bad;
        const c = colorOf(r);
        return (
          <g key={r.id} opacity={0.55 + d * 0.45}>
            <ellipse cx={cx + 2} cy={cy + 4 + (1 - d) * 5} rx={4 * k} ry={1.6 * k} fill="#000" opacity=".6" />
            {o.unc && <circle cx={cx} cy={cy} r={4 * k + Math.min(14, (r.uncertaintyHz || 0) * 8)} fill={c} opacity=".18" />}
            {bad ? <g stroke="#ef4444" strokeWidth="2"><line x1={cx - 4} y1={cy - 4} x2={cx + 4} y2={cy + 4} /><line x1={cx - 4} y1={cy + 4} x2={cx + 4} y2={cy - 4} /></g>
              : <circle cx={cx} cy={cy} r={4 * k} fill={c} stroke={o.quality && sus ? "#f59e0b" : "#0b1220"} strokeWidth={r.q > 3000 ? 2.5 : 1.2} strokeDasharray={o.quality && sus ? "2 2" : undefined} />}
            {o.labels && <text x={cx + 6} y={cy - 6} fontSize="8" fill="#cbd5e1">{o.order ? `#${r.sequence}` : get(r).toFixed(1)}</text>}
            <title>{`#${r.sequence} ${r.x.toFixed(1)}, ${r.y.toFixed(1)}, ${r.z.toFixed(1)} mm → ${get(r).toFixed(2)}${unit} · ${bad ? "invalid" : sus ? "suspect" : "valid"}`}</title>
          </g>
        );
      })}
      <g stroke="#a78bfa" strokeWidth="1.5" fill="none"><path d={`M${sx(stage[p.a])} ${sy(stage[p.b]) - 8} l7 8 l-7 8 l-7 -8 z`} /><title>Current stage position</title></g>
    </g>
  );
}

function LabOverview({ state, dispatch }) {
  const go = id => dispatch({ type: "SET_UI", patch: { active: id } });
  const al = state.alarms.filter(a => !a.acknowledged), src = {};
  al.forEach(a => [[/turbo|vacuum|pressure|door/i, "chamber"], [/RF|VNA|sweep/i, "vna"], [/vibration|scope/i, "scope"], [/clock/i, "clock"], [/laser|LDV/i, "ldv"]].forEach(([r, k]) => { if (r.test(a.text)) src[k] = a.severity; }));
  const N = [
    { k: "clock", l: "Rb Clock", pg: "clock", x: 60, y: 60, w: 120, h: 70 }, { k: "vna", l: "VNA", pg: "vna", x: 60, y: 200, w: 120, h: 70 },
    { k: "scope", l: "Oscilloscope", pg: "scope", x: 60, y: 330, w: 120, h: 70 }, { k: "chamber", l: "Thermal-Vac Chamber", pg: "chamber", x: 330, y: 190, w: 170, h: 100 },
    { k: "ldv", l: "LDV Head", pg: "ldv", x: 600, y: 70, w: 120, h: 70 }, { k: "pumps", l: "Pumps", pg: "chamber", x: 600, y: 300, w: 120, h: 70 }
  ];
  const on = { clock: state.clock.locked, rf: state.vna.power && state.vna.rf, laser: state.ldv.power && state.ldv.shutter, scope: state.scope.power && state.scope.running, ldv: state.ldv.power && (state.ldv.scanActive || state.ldv.shutter) };
  return (
    <div className="space-y-3">
      <div><h1 className="text-xl font-bold">Lab Overview</h1><p className="mt-1 text-sm text-zinc-400">Select any instrument to open its page. Signal paths appear only while that system is active.</p></div>
      <div className="grid gap-3 xl:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 xl:col-span-2">
          <svg viewBox="0 0 780 470" className="w-full" role="group" aria-label="Isometric laboratory layout">
            <defs><pattern id="ov-g" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#111b27" /></pattern></defs>
            <rect width="780" height="470" fill="url(#ov-g)" />
            <SignalPath d="M120 95 L120 235" color="#22d3ee" dash="6 4" active={on.clock && state.vna.power} label="Clock reference to VNA" />
            <SignalPath d="M120 95 L30 95 L30 365 L120 365" color="#22d3ee" dash="6 4" active={on.clock && state.scope.power} label="Clock reference to scope" />
            <SignalPath d="M120 95 L120 30 L660 30 L660 105" color="#22d3ee" dash="6 4" active={on.clock && state.ldv.power} label="Clock reference to LDV" />
            <SignalPath d="M120 235 L415 235" color="#e879f9" dash="2 5" active={on.rf} label="RF path" />
            <SignalPath d="M660 105 L415 105 L415 240" color="#facc15" active={on.laser} label="Laser path" />
            <SignalPath d="M120 365 L415 365 L415 240" color="#3b82f6" dash="8 3 2 3" active={on.scope} label="Scope data path" />
            <SignalPath d="M660 105 L750 105 L750 450 L120 450 L120 365" color="#3b82f6" dash="8 3 2 3" active={on.ldv} label="LDV data path" />
            {N.map(n => {
              const st = instStatus(state, n.k), [t, g, c] = ST[st], d = 14, a = src[n.k] || (n.k === "pumps" ? src.chamber : null);
              return (
                <g key={n.k} role="button" tabIndex={0} aria-label={`${n.l}: ${t}. Open page`} style={{ cursor: "pointer" }} onClick={() => go(n.pg)} onKeyDown={e => (e.key === "Enter" || e.key === " ") && go(n.pg)}>
                  {a && <rect x={n.x - 6} y={n.y - 16} width={n.w + d + 12} height={n.h + 22} fill="none" stroke={a === "critical" ? "#ef4444" : "#f59e0b"} strokeWidth="2" strokeDasharray="5 3" rx="4" />}
                  <path d={`M${n.x} ${n.y} L${n.x + d} ${n.y - d} L${n.x + n.w + d} ${n.y - d} L${n.x + n.w} ${n.y}Z`} fill="#243040" stroke={c} />
                  <path d={`M${n.x + n.w} ${n.y} L${n.x + n.w + d} ${n.y - d} L${n.x + n.w + d} ${n.y + n.h - d} L${n.x + n.w} ${n.y + n.h}Z`} fill="#121a24" stroke={c} />
                  <rect x={n.x} y={n.y} width={n.w} height={n.h} fill="#1a2330" stroke={c} strokeWidth={st === "offline" ? 1 : 2} opacity={st === "offline" ? 0.7 : 1} />
                  <text x={n.x + 8} y={n.y + 22} fontSize="12" fill="#e2e8f0" fontWeight="600">{n.l}</text>
                  <text x={n.x + 8} y={n.y + 42} fontSize="11" fill={c} fontFamily="monospace">{g} {t}</text>
                  {a && <text x={n.x + 8} y={n.y + 60} fontSize="10" fill="#fca5a5" fontFamily="monospace">{a === "critical" ? "■ ALARM" : "▲ WARNING"}</text>}
                </g>
              );
            })}
          </svg>
          <div className="flex flex-wrap gap-4 border-t border-zinc-800 px-2 pt-2 font-mono text-[10px] text-zinc-400">
            {[["Clock ref", "#22d3ee", "6 4"], ["RF", "#e879f9", "2 5"], ["Laser", "#facc15", ""], ["Data", "#3b82f6", "8 3 2 3"]].map(([n, c, d]) => <span key={n} className="flex items-center gap-1"><svg width="30" height="6"><line x1="0" y1="3" x2="30" y2="3" stroke={c} strokeWidth="2" strokeDasharray={d} /></svg>{n}</span>)}
          </div>
        </div>
        <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <TelemetryReadout label="Chamber pressure" value={fmtPressure(state.chamber.pressure)} />
          <TelemetryReadout label="Chamber temperature" value={state.chamber.temperature.toFixed(3)} unit="°C" tone="#fdba74" sub={`Setpoint ${state.chamber.targetTemp.toFixed(1)} °C`} />
          <TelemetryReadout label="Simulation time" value={state.facility.simulationTime.toFixed(0)} unit="s" />
          <div className="flex justify-around pt-1"><RotaryKnob value={state.chamber.targetTemp} min={10} max={35} label="Setpoint" unit=" °C" /><RotaryKnob value={Math.log10(Math.max(state.chamber.pressure, 1e-6))} min={-6} max={3} label="Vacuum" /></div>
          <div className="text-[11px] text-zinc-400">Open alarms: <span className="font-mono text-amber-300">{al.length}</span></div>
        </div>
      </div>
    </div>
  );
}


/* ───────── Phase 1: dependency-free 3D laboratory digital twin (software-projected SVG) ───────── */
const GRP = { outer: "Outer Faraday enclosure", inner: "Inner Faraday enclosure", table: "Optical table", chamber: "Thermal-vacuum chamber", sphere: "Test sphere", ldv: "LDV optical heads", rf: "RF coupling fixture", pumps: "Vacuum pumps", rack: "Instrument rack", probes: "Environmental probes", room: "Laboratory room (context)" };
const EXPL = { outer: [0, 0, 1100], inner: [0, 0, 550], table: [0, 0, -250], chamber: [0, 0, 350], sphere: [0, 0, 800], ldv: [0, 0, 900], rf: [450, 0, 550], pumps: [-500, 0, 0], rack: [600, 0, 0], probes: [0, 350, 500], room: [0, 0, 0] };
const CAM = { iso: { yaw: 0.6, pit: 0.5, dist: 6200, t: [200, 0, 1000] }, front: { yaw: 0, pit: 0.05, dist: 6500, t: [200, 0, 1000] }, top: { yaw: 0, pit: 1.5, dist: 6500, t: [200, 0, 1000] }, interior: { yaw: -0.5, pit: 0.35, dist: 1100, t: [0, 0, 1100] }, optical: { yaw: 1.57, pit: 0.05, dist: 1500, t: [0, 0, 1450] }, rf: { yaw: -1.0, pit: 0.3, dist: 1300, t: [200, 0, 1100] }, vacuum: { yaw: 0.7, pit: 0.3, dist: 1700, t: [-550, 0, 1000] }, rack: { yaw: 1.2, pit: 0.15, dist: 2600, t: [1800, 0, 1000] } };
const BOXF = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [0, 3, 7, 4], [1, 2, 6, 5]], SHADE = [0.5, 1, 0.8, 0.6, 0.7, 0.9];


/* ───────── Phase 2: materials, LOD, instrument screens ───────── */
const MT = { steel: { c: "#9aa6b2", sp: 0.55, sh: 22, tx: "brush" }, anod: { sp: 0.3, sh: 10 }, black: { c: "#14181f", sp: 0.18, sh: 8 }, copper: { c: "#c8743a", sp: 0.7, sh: 30 }, silica: { c: "#cfe9f7", sp: 0.9, sh: 40, gl: 1 }, glass: { c: "#9fd0e8", sp: 0.9, sh: 40, gl: 1 }, mesh: { sp: 0, sh: 1, tx: "mesh" }, rubber: { c: "#1d1f23", sp: 0.02, sh: 2 }, emit: { emit: 1 } };
const MATID = { outer: "mesh", inner: "mesh", top: "steel", shell: "steel", door: "steel", view: "silica", ftrf: "anod", ftse: "anod", m1: "steel", m2: "steel", rx: "anod", ry: "anod", car: "anod", pst: "anod", sph: "copper", ldvA: "anod", ldvB: "anod", fix: "anod", rough: "anod", turbo: "steel", rack: "black", uclk: "black", uvna: "black", uscp: "black", tprobe: "steel", pgauge: "steel", accel: "anod" };
const LV = [0.406, -0.609, 0.711];
const shadeHex = (h, f) => `rgb(${[1, 3, 5].map(i => { const v = parseInt(h.slice(i, i + 2), 16); return Math.round(Math.max(0, Math.min(255, f < 1 ? v * f : v + (255 - v) * (f - 1)))); }).join(",")})`;
const nrm = (a, b, c) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(n[0], n[1], n[2]) || 1; return [n[0] / l, n[1] / l, n[2] / l]; };
function SignFace({ text, sub, col, lit }) {
  const c = lit ? col : "#64748b";
  return <g><rect width="200" height="70" rx="5" fill={lit ? "#0a0d12" : "#080a0e"} stroke={c} strokeWidth="3" /><rect x="6" y="6" width="188" height="58" rx="3" fill="none" stroke={c} strokeOpacity=".4" strokeDasharray="6 4" /><text x="100" y="35" textAnchor="middle" fontSize="19" fontWeight="700" fill={c} fontFamily="sans-serif" style={lit && !FX.hide ? { filter: `drop-shadow(0 0 4px ${col})` } : undefined}>{text}</text><text x="100" y="54" textAnchor="middle" fontSize="11" fill={c} fontFamily="monospace">{sub}</text></g>;
}
function TwDefs() {
  return (
    <defs>
      <linearGradient id="tw-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#04070b" /><stop offset=".55" stopColor="#0c1624" /><stop offset="1" stopColor="#04070b" /></linearGradient>
      <radialGradient id="tw-floor" cx=".5" cy=".5" r=".7"><stop offset="0" stopColor="#1b2837" /><stop offset=".6" stopColor="#0f1722" /><stop offset="1" stopColor="#090d13" /></radialGradient>
      <linearGradient id="tw-wall" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#1a2532" /><stop offset="1" stopColor="#0a1018" /></linearGradient>
      <pattern id="tw-brush" width="4" height="2" patternUnits="userSpaceOnUse"><line x1="0" y1="1" x2="4" y2="1" stroke="#fff" strokeOpacity=".2" /></pattern>
      <pattern id="tw-mesh" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M6 0H0V6" fill="none" stroke="#fbbf24" strokeOpacity=".55" /></pattern>
      <radialGradient id="tw-cu" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#ffe3c4" /><stop offset=".4" stopColor="#d9803f" /><stop offset="1" stopColor="#4a2410" /></radialGradient>
    </defs>
  );
}
function twinExtra(st, g, sz) {
  const sc = k => ST[instStatus(st, k)][2], tn = k => ST[instStatus(st, k)][0], o = [];
  [["uldv", 850, "ldv", "LDV controller unit"], ["uenv", 600, "chamber", "Vacuum / thermal controller unit"]].forEach(([id, z, k, l]) => o.push({ id, g: "rack", label: l, k: "box", c: [1590, 0, z], s: [20, 560, 140], col: "#14181f", mt: "black", inst: k, note: tn(k) }));
  [["uclk", 1600, "clock"], ["uvna", 1350, "vna"], ["uscp", 1100, "scope"], ["uldv", 850, "ldv"], ["uenv", 600, "chamber"]].forEach(([id, z, k]) => o.push({ id: "led" + id, g: "rack", label: "Status LED: " + tn(k), k: "box", c: [1579, -245, z - 45], s: [4, 24, 10], col: sc(k), mt: "emit", note: tn(k) }));
  [[-800, -500], [800, -500], [-800, 500], [800, 500]].forEach(([x, y], i) => { o.push({ id: "pad" + i, g: "table", label: "Rubber isolation pad", k: "box", c: [x, y, 12], s: [110, 110, 24], col: "#1d1f23", mt: "rubber" }); o.push({ id: "pis" + i, g: "table", label: "Isolator piston (detail)", k: "cyl", ax: "z", c: [x, y, 700], r: 20, len: 100, col: "#cbd5e1", mt: "steel", hi: 1 }); });
  o.push({ id: "lensA", g: "ldv", label: "LDV objective lens (optical glass)", k: "cyl", ax: "z", c: [0, 0, 1550], r: 55, len: 30, col: "#9fd0e8", mt: "glass", a: 0.55 });
  o.push({ id: "lensB", g: "ldv", label: "LDV B objective lens", k: "cyl", ax: "z", c: [650, -650, 1410], r: 45, len: 20, col: "#9fd0e8", mt: "glass", a: 0.55, conceptual: 1 });
  o.push({ id: "cup", g: "sphere", label: "Sphere cradle (copper-plated)", k: "cyl", ax: "z", c: [g.x, g.y, sz - 28], r: 14, len: 8, col: "#c8743a", mt: "copper", tbl: 1 });
  o.push({ id: "vring", g: "chamber", sub: "Quartz viewport", label: "Viewport retaining ring (detail)", k: "cyl", ax: "z", c: [0, 0, 1414], r: 96, len: 8, col: "#9aa6b2", mt: "steel", hi: 1, tbl: 1 });
  o.push({ id: "tfl", g: "pumps", label: "Turbo flange (detail)", k: "cyl", ax: "x", c: [-300, 0, 1100], r: 92, len: 14, col: "#9aa6b2", mt: "steel", hi: 1, tbl: 1 });
  if (!st.chamber.doorOpen) o.push({ id: "hnd", g: "chamber", sub: "Door", label: "Door handle (detail)", k: "box", c: [150, -335, 1100], s: [16, 16, 140], col: "#cbd5e1", mt: "steel", hi: 1, tbl: 1 });
  const ch = st.chamber, cc = ch.faraday ? "#d99a2b" : "#ef4444", pump = ch.roughing || ch.turbo;
  const B = (id, g, label, c, sz2, col, mt, x = {}) => o.push({ id, g, label, k: "box", c, s: sz2, col, mt, ...x });
  const C = (id, g, label, c, ax, r, len, col, mt, x = {}) => o.push({ id, g, label, k: "cyl", ax, c, r, len, col, mt, ...x });
  // double Faraday cage: posts and door frames
  [[-1600, -1300], [1600, -1300], [-1600, 1300], [1600, 1300]].forEach(([x, y], i) => B("op" + i, "outer", "Outer cage post", [x, y, 1200], [50, 50, 2400], cc, "steel"));
  [[-1100, -850], [1100, -850], [-1100, 850], [1100, 850]].forEach(([x, y], i) => B("ip" + i, "inner", "Inner cage post", [x, y, 950], [40, 40, 1800], cc, "steel"));
  B("ofl", "outer", "Outer cage door frame", [-450, -1300, 1000], [40, 40, 2000], cc, "steel"); B("ofr", "outer", "Outer cage door frame", [450, -1300, 1000], [40, 40, 2000], cc, "steel"); B("oft", "outer", "Outer cage door frame", [0, -1300, 2020], [940, 40, 40], cc, "steel");
  B("ifl", "inner", "Inner cage door frame", [-400, -850, 900], [30, 30, 1700], cc, "steel"); B("ifr", "inner", "Inner cage door frame", [400, -850, 900], [30, 30, 1700], cc, "steel"); B("ift", "inner", "Inner cage door frame", [0, -850, 1750], [830, 30, 30], cc, "steel");
  // optical table skirt
  B("skirt", "table", "Optical table skirt", [0, 0, 735], [1760, 1160, 30], "#3b4654", "anod");
  // chamber hardware
  B("lid", "chamber", "Chamber lid plate", [0, 0, 1406], [620, 620, 12], "#9aa6b2", "steel", { tbl: 1 });
  C("fl1", "chamber", "RF port flange (detail)", [364, 0, 1100], "x", 45, 10, "#9aa6b2", "steel", { hi: 1, tbl: 1 });
  C("fl2", "chamber", "Sensor port flange (detail)", [364, -130, 1100], "x", 36, 10, "#9aa6b2", "steel", { hi: 1, tbl: 1 });
  C("hg1", "chamber", "Door hinge", [-300, -310, 1000], "z", 10, 120, "#cbd5e1", "steel", { hi: 1, tbl: 1 }); C("hg2", "chamber", "Door hinge", [-300, -310, 1200], "z", 10, 120, "#cbd5e1", "steel", { hi: 1, tbl: 1 });
  for (let i = 0; i < 8; i++) C("vb" + i, "chamber", "Viewport bolt (detail)", [Math.cos(i * 0.7854) * 106, Math.sin(i * 0.7854) * 106, 1420], "z", 6, 10, "#cbd5e1", "steel", { hi: 1, tbl: 1, sub: "Quartz viewport" });
  // stage details
  B("plate", "chamber", "Stage base plate", [0, 0, 858], [200, 200, 8], "#64748b", "anod", { sub: "Internal XYZ stage", tbl: 1 });
  B("brg1", "chamber", "Linear bearing block (detail)", [-70, 0, 880], [16, 30, 10], "#cbd5e1", "steel", { hi: 1, sub: "Internal XYZ stage", tbl: 1 }); B("brg2", "chamber", "Linear bearing block (detail)", [70, 0, 880], [16, 30, 10], "#cbd5e1", "steel", { hi: 1, sub: "Internal XYZ stage", tbl: 1 });
  // LDV mount and fibre
  C("arm", "ldv", "LDV ceiling mount arm (conceptual)", [0, 0, 2090], "z", 25, 500, "#9aa6b2", "steel");
  // pumps
  C("tfan", "pumps", "Turbo fan guard", [-475, 0, 1100], "x", 60, 12, "#334155", "anod", { tbl: 1 });
  C("rmot", "pumps", "Roughing pump motor", [-900, -440, 230], "y", 90, 80, pump ? "#38bdf8" : "#475569", "anod");
  C("rexh", "pumps", "Exhaust port (detail)", [-900, -250, 430], "z", 12, 60, "#cbd5e1", "steel", { hi: 1 });
  B("fvalve", "pumps", "Foreline valve", [-900, 0, 500], [90, 90, 90], "#9aa6b2", "steel");
  // rack rails and handles
  B("rl1", "rack", "Rack rail", [1578, -290, 900], [20, 15, 1800], "#14181f", "black"); B("rl2", "rack", "Rack rail", [1578, 290, 900], [20, 15, 1800], "#14181f", "black");
  [1600, 1350, 1100, 850, 600].forEach(z => [-230, 230].forEach(y => B(`hd${z}${y}`, "rack", "Rack handle (detail)", [1574, y, z], [8, 16, 50], "#cbd5e1", "steel", { hi: 1 })));
  // laboratory room context
  B("tray", "room", "Overhead cable tray (conceptual)", [300, 0, 2700], [4200, 300, 50], "#9aa6b2", "steel");
  B("riser", "room", "Cable riser to rack", [2000, 0, 2250], [60, 300, 900], "#9aa6b2", "steel");
  C("cond", "room", "Wall conduit", [0, 2350, 2500], "x", 25, 4400, "#9aa6b2", "steel");
  B("duct", "room", "Floor cable duct", [1500, 0, 15], [1400, 200, 30], "#475569", "anod");
  B("bench", "room", "Workbench (context)", [-2300, -1600, 450], [1400, 700, 900], "#334155", "black");
  B("cab", "room", "Storage cabinet (context)", [-2500, 1900, 900], [600, 500, 1800], "#475569", "anod");
  C("ext", "room", "Fire extinguisher", [2600, 2200, 300], "z", 80, 600, "#dc2626", "anod");
  return o;
}
function ScreenFace({ k, st }) {
  const W = 240, H = 55, on = { clk: st.clock.power, vna: st.vna.power, scp: st.scope.power, ldv: st.ldv.power, env: st.facility.power }[k];
  const T = (x, y, t, c = "#7dd3fc", z = 10) => <text x={x} y={y} fontSize={z} fill={c} fontFamily="monospace">{t}</text>;
  if (!on) return <g><rect width={W} height={H} fill="#05080c" />{T(8, 32, "○ OFFLINE", "#64748b", 12)}</g>;
  let body = null;
  if (k === "vna") { const tr = st.vna.trace, n = Math.max(1, Math.ceil(tr.length / 80)), a = tr.filter((_, i) => i % n === 0); body = <><polyline fill="none" stroke="#5fd4ff" strokeWidth="1.2" points={a.map((q, i) => `${(i / Math.max(1, a.length - 1)) * W},${H - ((q.s11 + 35) / 37) * H}`).join(" ")} />{T(4, 10, "S11 dB", "#5fd4ff", 8)}</>; }
  else if (k === "scp") { const a = st.scope.trace.filter((_, i) => i % 3 === 0); body = <><polyline fill="none" stroke="#ffe066" strokeWidth="1.2" points={a.map((q, i) => `${(i / Math.max(1, a.length - 1)) * W},${H / 2 - (q.value / 1.5) * (H / 2)}`).join(" ")} />{T(4, 10, "CH1", "#ffe066", 8)}</>; }
  else if (k === "clk") body = st.clock.cableFault ? T(8, 34, "■ FAULT", "#f87171", 14) : st.clock.locked ? T(8, 34, "● LOCKED 10 MHz", "#4ade80", 13) : T(8, 34, `◐ WARMUP ${Math.min(100, (st.clock.warmup / WARMUP_SECONDS) * 100).toFixed(0)}%`, "#fbbf24", 13);
  else if (k === "ldv") { const sg = st.ldv.shutter ? clamp(93 - Math.abs(st.stage.x) * 0.8 - Math.abs(st.stage.z) * 0.6 - (!st.chamber.isolation ? 18 : 0), 5, 99) : 0; body = <>{T(8, 14, `RETURN ${sg.toFixed(0)}%  ${st.ldv.shutter ? "SHUTTER OPEN" : "SHUTTER CLOSED"}`, "#e879f9", 9)}<rect x="8" y="26" width="224" height="12" fill="#1a1020" /><rect x="8" y="26" width={sg * 2.24} height="12" fill="#d946ef" /></>; }
  else body = <>{T(8, 22, `P ${fmtPressure(st.chamber.pressure)}`, "#7dd3fc", 13)}{T(8, 44, `T ${st.chamber.temperature.toFixed(2)} °C`, "#fdba74", 13)}</>;
  return <g><rect width={W} height={H} fill="#02060a" /><g opacity=".9">{body}</g><rect width={W} height={H} fill="none" stroke="#1e3a52" /></g>;
}

function twinParts(st) {
  const { stage: g, chamber: c } = st, L = LIMIT_MM, sz = 1100 + g.z, sc = k => ST[instStatus(st, k)][2];
  const open = c.doorOpen, pump = c.roughing || c.turbo, shield = c.faraday;
  const post = sz - 905 - 25;
  return [
    { id: "outer", g: "outer", label: "Outer Faraday enclosure", k: "box", c: [0, 0, 1200], s: [3200, 2600, 2400], col: shield ? "#f59e0b" : "#ef4444", wall: "cage", hole: shield ? -1 : 2, note: shield ? "Shielding ON (conceptual shell)." : "Shielding OFF: front panel shown open." },
    { id: "inner", g: "inner", label: "Inner Faraday enclosure", k: "box", c: [0, 0, 950], s: [2200, 1700, 1800], col: shield ? "#fbbf24" : "#ef4444", wall: "cage", hole: shield ? -1 : 2, note: "Nested shield (conceptual)." },
    { id: "top", g: "table", label: "Optical table top", k: "box", c: [0, 0, 775], s: [1800, 1200, 50], col: "#64748b", a: 0.95, tbl: 1 },
    ...[[-800, -500], [800, -500], [-800, 500], [800, 500]].map(([x, y], i) => ({ id: "leg" + i, g: "table", label: "Isolation leg " + (i + 1), k: "cyl", ax: "z", c: [x, y, 375], r: 35, len: 750, col: st.chamber.isolation ? "#14b8a6" : "#ef4444", note: st.chamber.isolation ? "Active isolation ON" : "Isolation OFF: table coupled to floor, jitter shown." })),
    { id: "shell", g: "chamber", sub: "Chamber body", label: "Chamber body", k: "box", c: [0, 0, 1100], s: [600, 600, 600], col: "#38bdf8", wall: "ch", tbl: 1, note: `P ${fmtPressure(c.pressure)}, T ${c.temperature.toFixed(2)} °C` },
    open ? { id: "door", g: "chamber", sub: "Door", label: "Chamber door (open)", k: "box", c: [-275, -530, 1100], s: [30, 440, 500], col: "#f87171", a: 0.6, tbl: 1 } : { id: "door", g: "chamber", sub: "Door", label: "Chamber door (closed)", k: "box", c: [0, -310, 1100], s: [440, 30, 500], col: "#94a3b8", a: 0.5, tbl: 1 },
    { id: "view", g: "chamber", sub: "Quartz viewport", label: "Quartz viewport", k: "cyl", ax: "z", c: [0, 0, 1405], r: 80, len: 20, col: "#bae6fd", a: 0.5, tbl: 1 },
    { id: "ftrf", g: "chamber", sub: "Feedthroughs", label: "RF feedthrough", k: "cyl", ax: "x", c: [330, 0, 1100], r: 25, len: 60, col: "#fbbf24", tbl: 1 },
    { id: "ftse", g: "chamber", sub: "Feedthroughs", label: "Sensor feedthrough", k: "cyl", ax: "x", c: [330, -130, 1100], r: 20, len: 60, col: "#a3e635", tbl: 1 },
    { id: "m1", g: "chamber", sub: "Vacuum manifold", label: "Vacuum manifold (horizontal)", k: "cyl", ax: "x", c: [-680, 0, 1100], r: 35, len: 440, col: pump ? "#7dd3fc" : "#64748b", tbl: 1, conceptual: 1 },
    { id: "m2", g: "chamber", sub: "Vacuum manifold", label: "Vacuum manifold (drop)", k: "cyl", ax: "z", c: [-900, 0, 650], r: 35, len: 900, col: pump ? "#7dd3fc" : "#64748b", conceptual: 1 },
    { id: "rx", g: "chamber", sub: "Internal XYZ stage", label: "Stage X rail", k: "box", c: [0, 0, 870], s: [160, 24, 16], col: "#94a3b8", tbl: 1 },
    { id: "ry", g: "chamber", sub: "Internal XYZ stage", label: "Stage Y rail", k: "box", c: [0, 0, 890], s: [24, 160, 16], col: "#94a3b8", tbl: 1 },
    { id: "car", g: "chamber", sub: "Internal XYZ stage", label: "Stage carriage", k: "box", c: [g.x, g.y, 905], s: [50, 50, 12], col: "#cbd5e1", tbl: 1, note: `X ${g.x.toFixed(1)} Y ${g.y.toFixed(1)} Z ${g.z.toFixed(1)} mm` },
    { id: "pst", g: "chamber", sub: "Internal XYZ stage", label: "Z post", k: "cyl", ax: "z", c: [g.x, g.y, 911 + post / 2], r: 4, len: post, col: "#cbd5e1", tbl: 1 },
    { id: "env", g: "chamber", sub: "Internal XYZ stage", label: `Travel envelope ±${L} mm`, k: "box", c: [0, 0, 1100], s: [2 * L, 2 * L, 2 * L], col: "#f59e0b", a: 0.12, tbl: 1 },
    { id: "sph", g: "sphere", label: "Test sphere (Ø50 mm, simplified)", k: "sph", c: [g.x, g.y, sz], r: 25, col: "#fbbf24", tbl: 1, note: "Position follows simulator stage state." },
    { id: "ldvA", g: "ldv", label: "LDV head A (top, conceptual)", k: "box", c: [0, 0, 1720], s: [220, 220, 320], col: "#a855f7", note: st.ldv.shutter ? "Shutter open" : "Shutter closed" },
    { id: "ldvB", g: "ldv", label: "LDV head B (secondary, not beam-routed)", k: "box", c: [650, -650, 1550], s: [180, 180, 260], col: "#7e22ce", conceptual: 1 },
    { id: "fix", g: "rf", label: "RF coupling fixture (conceptual)", k: "box", c: [70, 40, 1100], s: [40, 22, 22], col: "#e879f9", tbl: 1, conceptual: 1 },
    { id: "rough", g: "pumps", label: "Roughing pump", k: "box", c: [-900, -250, 200], s: [400, 300, 400], col: c.roughing ? "#38bdf8" : "#64748b", note: c.roughing ? "Running" : "Off" },
    { id: "turbo", g: "pumps", label: "Turbomolecular pump", k: "cyl", ax: "x", c: [-380, 0, 1100], r: 70, len: 160, col: c.turbo ? "#38bdf8" : "#64748b", tbl: 1, note: c.turbo ? "Running" : "Off" },
    { id: "rack", g: "rack", label: "Instrument rack frame", k: "box", c: [1900, 0, 900], s: [600, 800, 1800], col: "#475569", a: 0.3 },
    { id: "uclk", g: "rack", label: "Rb clock unit", k: "box", c: [1590, 0, 1600], s: [20, 560, 140], col: sc("clock"), note: ST[instStatus(st, "clock")][0], inst: "clock" },
    { id: "uvna", g: "rack", label: "VNA unit", k: "box", c: [1590, 0, 1350], s: [20, 560, 140], col: sc("vna"), note: ST[instStatus(st, "vna")][0], inst: "vna" },
    { id: "uscp", g: "rack", label: "Oscilloscope unit", k: "box", c: [1590, 0, 1100], s: [20, 560, 140], col: sc("scope"), note: ST[instStatus(st, "scope")][0], inst: "scope" },
    { id: "tprobe", g: "probes", label: "Temperature probe", k: "sph", c: [-220, 220, 1000], r: 10, col: "#fb923c", tbl: 1 },
    { id: "pgauge", g: "probes", label: "Pressure gauge", k: "cyl", ax: "y", c: [-500, 100, 1100], r: 25, len: 80, col: "#a3e635", tbl: 1 },
    { id: "accel", g: "probes", label: "Accelerometer", k: "box", c: [500, 300, 812], s: [40, 40, 24], col: "#f472b6", tbl: 1 },
    ...twinExtra(st, g, sz)
  ];
}

function DigitalTwin({ state, dispatch }) {
  const [cam, setCam] = useState(CAM.iso);
  const camRef = useRef(cam); camRef.current = cam;
  const raf = useRef(0), drag = useRef(null), svgRef = useRef(null);
  const [mode, setMode] = useState("lab");
  const [qual, setQual] = useState("bal");
  const [hid, setHid] = useState({}), [solo, setSolo] = useState(null), [ghost, setGhost] = useState({}), [sel, setSel] = useState(null), [tm, setTm] = useState(0);
  const { stage: g, chamber: c } = state;
  const parts = twinParts(state).map(p => ({ ...p, mt: p.mt || MATID[p.id] || (p.id.startsWith("leg") ? "anod" : null) }));
  const pump = c.roughing || c.turbo, still = FX.reduced || FX.hide;
  useEffect(() => { if (still || (!pump && c.isolation)) return; const i = setInterval(() => setTm(Date.now()), 80); return () => clearInterval(i); }, [still, pump, c.isolation]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const w = e => { e.preventDefault(); const q = camRef.current; setCam({ ...q, dist: Math.min(14000, Math.max(120, q.dist * Math.exp(e.deltaY * 0.001))) }); };
    el.addEventListener("wheel", w, { passive: false }); return () => el.removeEventListener("wheel", w);
  }, []);
  const goTo = n => {
    const c2 = n === "stage" ? { yaw: -0.5, pit: 0.4, dist: 260, t: [g.x, g.y, 1100 + g.z] } : CAM[n];
    cancelAnimationFrame(raf.current);
    if (FX.reduced) { setCam(c2); return; }
    const a = camRef.current, t0 = performance.now();
    const step = now => { const u = Math.min(1, (now - t0) / 650), e = u * u * (3 - 2 * u); setCam({ yaw: a.yaw + (c2.yaw - a.yaw) * e, pit: a.pit + (c2.pit - a.pit) * e, dist: a.dist + (c2.dist - a.dist) * e, t: a.t.map((v, i) => v + (c2.t[i] - v) * e) }); if (u < 1) raf.current = requestAnimationFrame(step); };
    raf.current = requestAnimationFrame(step);
  };
  const focus = p => { setSel(p.id); const d = p.s ? Math.max(...p.s) : (p.len || p.r * 2); cancelAnimationFrame(raf.current); setCam({ yaw: -0.5, pit: 0.3, dist: Math.max(400, d * 3.2), t: p.c }); };
  const setM = m => {
    setMode(m);
    if (m === "lab") goTo("iso"); else if (m === "chamber") goTo("interior");
    else if (m === "instrument") { const p = parts.find(q => q.id === sel) || parts.find(q => q.id === "uvna"); focus(p); }
    else if (m === "chain") goTo("iso");
  };
  const reset = () => { setMode("lab"); setHid({}); setSolo(null); setGhost({}); setSel(null); goTo("iso"); };
  const e = mode === "exploded" ? 1 : 0, jit = !c.isolation && !FX.reduced ? Math.sin(tm / 45) * 1.6 + Math.sin(tm / 17) * 0.8 : 0;
  const chain = new Set(["uclk", "uvna", "fix", "sph", "ldvA", "view", "ftrf"]);
  const { yaw, pit, dist, t } = cam;
  const Q = { perf: [700, 3500], bal: [1600, 7000], qual: [3200, 12000] }[qual];
  let tier = dist < Q[0] ? "high" : dist < Q[1] ? "normal" : "low";
  if (drag.current && drag.current.m > 4) tier = tier === "high" ? "normal" : "low";
  const TN = tier === "high" ? 20 : tier === "normal" ? 12 : 6;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit);
  const P = (x, y, z) => { x -= t[0]; y -= t[1]; z -= t[2]; const x1 = x * cy - y * sy, y1 = x * sy + y * cy, y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp, k = 700 / Math.max(60, dist + y2); return [400 + x1 * k, 240 - z2 * k, y2, k]; };
  const items = [];
  parts.forEach(p => {
    if (hid[p.g] || (solo && solo !== p.g)) return;
    if (p.hi && tier !== "high") return;
    { const q0 = P(...p.c), md = p.s ? Math.max(...p.s) : p.len ? Math.max(p.len, p.r * 2) : p.r * 2, rp = md * q0[3];
      if (q0[2] + dist < 50 || rp < 2.5 || q0[0] + rp < -50 || q0[0] - rp > 850 || q0[1] + rp < -50 || q0[1] - rp > 530) return; }
    const o = EXPL[p.g], off = [o[0] * e, o[1] * e, o[2] * e + (p.tbl ? jit : 0)], C = [p.c[0] + off[0], p.c[1] + off[1], p.c[2] + off[2]];
    let a = p.a == null ? 1 : p.a;
    if (p.wall === "cage") a = mode === "transparent" ? 0.03 : mode === "chamber" ? 0.015 : 0.07;
    if (p.wall === "ch") a = mode === "transparent" ? 0.07 : 0.2;
    if (ghost[p.g]) a *= 0.25;
    if (mode === "chain" && !chain.has(p.id)) a *= 0.15;
    const on = sel === p.id, st = { fill: p.col, a, stroke: on ? "#fff" : p.col, sw: on ? 2.5 : 0.8 };
    if (p.k === "sph") { const q = P(...C); items.push({ d: q[2], s: <circle key={p.id} cx={q[0]} cy={q[1]} r={Math.max(2, p.r * q[3])} fill={p.mt === "copper" ? "url(#tw-cu)" : p.col} fillOpacity={a} stroke={st.stroke} strokeWidth={st.sw} onClick={() => !(drag.current && drag.current.m > 4) && setSel(p.id)}><title>{p.label}</title></circle> }); return; }
    let V, F, sh;
    if (p.k === "box") { const [hx, hy, hz] = p.s.map(v => v / 2); V = [0, 1, 2, 3, 4, 5, 6, 7].map(i => [C[0] + (i % 4 === 1 || i % 4 === 2 ? hx : -hx), C[1] + (i % 4 >= 2 ? hy : -hy), C[2] + (i > 3 ? hz : -hz)]); F = BOXF; sh = SHADE; }
    else {
      const N = TN, h = p.len / 2, ring = [...Array(N)].map((_, i) => [Math.cos(i / N * 6.2832) * p.r, Math.sin(i / N * 6.2832) * p.r]);
      V = [...ring.map(([u, v]) => p.ax === "z" ? [C[0] + u, C[1] + v, C[2] - h] : p.ax === "x" ? [C[0] - h, C[1] + u, C[2] + v] : [C[0] + u, C[1] - h, C[2] + v]), ...ring.map(([u, v]) => p.ax === "z" ? [C[0] + u, C[1] + v, C[2] + h] : p.ax === "x" ? [C[0] + h, C[1] + u, C[2] + v] : [C[0] + u, C[1] + h, C[2] + v])];
      F = [[...Array(N).keys()], [...Array(N).keys()].map(i => i + N), ...[...Array(N)].map((_, i) => [i, (i + 1) % N, N + (i + 1) % N, N + i])]; sh = F.map((_, i) => i < 2 ? 1 : 0.55 + 0.45 * Math.abs(Math.sin(i / N * 6.2832)));
    }
    const pr = V.map(v => P(...v)), mat = MT[p.mt] || null, base = mat && mat.c ? mat.c : p.col, Vw = [-sy * cp, -cy * cp, sp], hv = [LV[0] + Vw[0], LV[1] + Vw[1], LV[2] + Vw[2]], hl = Math.hypot(hv[0], hv[1], hv[2]) || 1;
    F.forEach((f, i) => {
      if (p.hole === i) return;
      const pts = f.map(j => pr[j]), ps = pts.map(q => q[0].toFixed(1) + "," + q[1].toFixed(1)).join(" ");
      let fill = base, spec = 0;
      if (!(mat && mat.emit)) { const n = nrm(V[f[0]], V[f[1]], V[f[2]]); fill = shadeHex(base, 0.5 + 0.7 * Math.abs(n[0] * LV[0] + n[1] * LV[1] + n[2] * LV[2])); if (mat && mat.sp && tier === "high") spec = mat.sp * Math.pow(Math.abs((n[0] * hv[0] + n[1] * hv[1] + n[2] * hv[2]) / hl), mat.sh); }
      items.push({ d: pts.reduce((m, q) => m + q[2], 0) / pts.length, s: <g key={p.id + i}>
        <polygon points={ps} fill={fill} fillOpacity={Math.min(1, a) * (FX.hide ? 1 : 1 - 0.4 * Math.max(0, Math.min(1, pts[0][2] / (dist * 0.9 + 1500))))} stroke={mat && mat.gl ? "#e0f2fe" : st.stroke} strokeOpacity={Math.min(1, a + 0.35)} strokeWidth={st.sw} strokeDasharray={p.id === "env" ? "4 3" : undefined} onClick={() => !(drag.current && drag.current.m > 4) && setSel(p.id)}><title>{p.label}</title></polygon>
        {spec > 0.04 && <polygon points={ps} fill="#fff" fillOpacity={Math.min(0.55, spec * a)} pointerEvents="none" />}
        {tier === "high" && mat && mat.tx && <polygon points={ps} fill={mat.tx === "brush" ? "url(#tw-brush)" : "url(#tw-mesh)"} fillOpacity={mat.tx === "mesh" ? Math.min(1, a * 6) : a} pointerEvents="none" />}
      </g> });
    });
  });
  const vis = k => !hid[k] && (!solo || solo === k);
  const cab = (key, pts, w, col, grp, lab) => { if (!vis(grp)) return; const q = pts.map(v => P(...v)), pp = q.map(v => v[0].toFixed(1) + "," + v[1].toFixed(1)).join(" "), lw = Math.max(1.2, w * q[0][3]); items.push({ d: q.reduce((m, v) => m + v[2], 0) / q.length, s: <g key={key} fill="none" strokeLinejoin="round"><polyline points={pp} stroke="#0b0b0d" strokeWidth={lw + 1.5}><title>{lab}</title></polyline><polyline points={pp} stroke={col} strokeWidth={lw} />{tier !== "low" && <polyline points={pp} stroke="#0b0b0d" strokeWidth={lw} strokeDasharray="1.5 2.5" opacity=".55" />}</g> }); };
  if (vis("room")) {
    const RX = 2800, RY = 2400, RZ = 3000, Vt = [-sy * cp, -cy * cp, sp], kk = 700 / dist;
    const pp = a => a.map(v => { const q = P(...v); return q[0].toFixed(1) + "," + q[1].toFixed(1); }).join(" ");
    const lp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    let seams = "";
    if (tier !== "low") { for (let x = -RX + 600; x < RX; x += 600) seams += `M${pp([[x, -RY, 0]])}L${pp([[x, RY, 0]])}`; for (let y = -RY + 600; y < RY; y += 600) seams += `M${pp([[-RX, y, 0]])}L${pp([[RX, y, 0]])}`; }
    const tape = [[-1750, -1350, 0], [1750, -1350, 0], [1750, 1350, 0], [-1750, 1350, 0], [-1750, -1350, 0]];
    items.push({ d: 3e6, s: <g key="floor"><polygon points={pp([[-RX, -RY, 0], [RX, -RY, 0], [RX, RY, 0], [-RX, RY, 0]])} fill="url(#tw-floor)" stroke="#1e2a38" />{seams && <path d={seams} fill="none" stroke="#1d2938" strokeWidth=".8" />}<polyline points={pp(tape)} fill="none" stroke="#0a0a0a" strokeWidth={Math.max(2, 70 * kk)} /><polyline points={pp(tape)} fill="none" stroke="#facc15" strokeWidth={Math.max(1.5, 50 * kk)} strokeDasharray="12 10" /></g> });
    const W = [
      { k: "wx", n: [-1, 0, 0], q: [[RX, -RY, 0], [RX, RY, 0], [RX, RY, RZ], [RX, -RY, RZ]], m: Math.round(2 * RY / 1000) },
      { k: "wy", n: [0, -1, 0], q: [[-RX, RY, 0], [RX, RY, 0], [RX, RY, RZ], [-RX, RY, RZ]], m: Math.round(2 * RX / 1000) },
      { k: "wl", n: [1, 0, 0], q: [[-RX, -RY, 0], [-RX, RY, 0], [-RX, RY, RZ], [-RX, -RY, RZ]], m: Math.round(2 * RY / 1000) },
      { k: "wf", n: [0, 1, 0], q: [[-RX, -RY, 0], [RX, -RY, 0], [RX, -RY, RZ], [-RX, -RY, RZ]], m: Math.round(2 * RX / 1000) },
      { k: "ce", n: [0, 0, -1], q: [[-RX, -RY, RZ], [RX, -RY, RZ], [RX, RY, RZ], [-RX, RY, RZ]], m: 0 }
    ];
    const shown = {};
    W.forEach(w => {
      if (w.n[0] * Vt[0] + w.n[1] * Vt[1] + w.n[2] * Vt[2] < 0.15) return;
      shown[w.k] = 1; const [b0, b1, t1, t0] = w.q; let sm = "";
      if (tier !== "low") for (let i = 1; i < w.m; i++) sm += `M${pp([lp(b0, b1, i / w.m)])}L${pp([lp(t0, t1, i / w.m)])}`;
      items.push({ d: 2e6, s: <g key={w.k}><polygon points={pp(w.q)} fill={w.k === "ce" ? "#0b121b" : "url(#tw-wall)"} stroke="#1e2a38" />{sm && <path d={sm} fill="none" stroke="#17212d" strokeWidth=".8" />}{w.k !== "ce" && <polygon points={pp([b0, b1, [b1[0], b1[1], 130], [b0[0], b0[1], 130]])} fill="#06090e" />}</g> });
    });
    const sg = (key, text, sub, col, lit, pts) => { const p0 = P(...pts[0]), p1 = P(...pts[1]), p2 = P(...pts[2]); items.push({ d: 1.9e6, s: <g key={key} transform={`matrix(${(p1[0] - p0[0]) / 200} ${(p1[1] - p0[1]) / 200} ${(p2[0] - p0[0]) / 70} ${(p2[1] - p0[1]) / 70} ${p0[0]} ${p0[1]})`} style={{ pointerEvents: "none" }}><SignFace text={text} sub={sub} col={col} lit={lit} /></g> }); };
    const SW = 560, SH = 196, yb = RY - 1, xr = RX - 1;
    const back = (x, z) => [[x - SW / 2, yb, z + SH / 2], [x + SW / 2, yb, z + SH / 2], [x - SW / 2, yb, z - SH / 2]];
    const right = (y, z) => [[xr, y + SW / 2, z + SH / 2], [xr, y - SW / 2, z + SH / 2], [xr, y + SW / 2, z - SH / 2]];
    const ls = state.ldv.power && state.ldv.shutter, pm = state.chamber.roughing || state.chamber.turbo, rfo = state.vna.power && state.vna.rf;
    if (shown.wy) {
      sg("s1", ls ? "⚠ LASER ACTIVE" : "LASER OFF", ls ? "CLASS 3B · EYE HAZARD" : "shutter closed", "#facc15", ls, back(-700, 2000));
      sg("s2", pm ? "PUMPS RUNNING" : "PUMPS OFF", pm ? "vacuum in progress" : "chamber idle", "#38bdf8", pm, back(0, 2000));
      sg("s3", rfo ? "RF ACTIVE" : "RF OFF", rfo ? "keep shield closed" : "VNA output off", "#e879f9", rfo, back(700, 2000));
      sg("s4", state.chamber.faraday ? "SHIELD OK" : "SHIELD BREACH", state.chamber.faraday ? "Faraday enclosed" : "close enclosure", state.chamber.faraday ? "#4ade80" : "#ef4444", true, back(1400, 2000));
      sg("s5", "EXIT ➜", "emergency egress", "#4ade80", true, back(-1900, 2400));
    }
    if (shown.wx) {
      sg("s6", "E-STOP", "main breaker panel", "#ef4444", true, right(-300, 1500));
      sg("s7", state.chamber.doorOpen ? "DOOR OPEN" : "DOOR CLOSED", state.chamber.doorOpen ? "chamber unsealed" : "chamber sealed", "#f59e0b", state.chamber.doorOpen, right(700, 1500));
    }
  }
  cab("cabrf", [[1578, -200, 1350], [1450, -200, 1250], [1000, -100, 1100], [360, 0, 1100]], 8, "#cfd4da", "rf", "Braided RF coax (conceptual routing)");
  cab("cabrf2", [[300, 0, 1100], [70, 40, 1100]], 5, "#cfd4da", "rf", "Internal RF coax");
  cab("cabfb", [[110, 0, 1760], [600, 0, 1950], [1580, 0, 1700]], 3, "#fde047", "ldv", "LDV fibre-optic cable (conceptual)");
  cab("cabse", [[-220, 220, 1000], [0, 250, 950], [300, -130, 1100]], 4, "#f59e0b", "probes", "Sensor cable");
  if (tier !== "low" && vis("rack") && Math.sin(yaw) * cp > 0.05) [[1600, "clk"], [1350, "vna"], [1100, "scp"], [850, "ldv"], [600, "env"]].forEach(([zc, kk]) => {
    const p0 = P(1579, 240, zc + 55), p1 = P(1579, -240, zc + 55), p2 = P(1579, 240, zc - 55), W = 240, H = 55;
    items.push({ d: p0[2] - 1, s: <g key={"scr" + kk} transform={`matrix(${(p1[0] - p0[0]) / W} ${(p1[1] - p0[1]) / W} ${(p2[0] - p0[0]) / H} ${(p2[1] - p0[1]) / H} ${p0[0]} ${p0[1]})`} style={{ pointerEvents: "none" }}><ScreenFace k={kk} st={state} /></g> });
  });
  items.sort((a, b) => b.d - a.d);
  const line = (key, pts, col, w, dash, on, lab) => { if (!on) return null; const q = pts.map(v => P(...v)); return <polyline key={key} points={q.map(v => v[0].toFixed(1) + "," + v[1].toFixed(1)).join(" ")} fill="none" stroke={col} strokeWidth={w} strokeDasharray={dash} className={still ? "" : "sig-flow"} style={{ filter: `drop-shadow(0 0 3px ${col})` }}><title>{lab}</title></polyline>; };
  const sph = [g.x, g.y, 1100 + g.z];
  const vac = [[-300, 0, 1100], [-900, 0, 1100], [-900, 0, 250]];
  const along = (pts, u) => { const L = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1], q[2] - pts[i][2])), T = L.reduce((a, b) => a + b, 0); let d = u * T, i = 0; while (i < L.length - 1 && d > L[i]) { d -= L[i]; i++; } const f = d / L[i]; return pts[i].map((v, k) => v + (pts[i + 1][k] - v) * f); };
  const k0 = 700 / dist, nice = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find(v => v * k0 >= 90) || 5000, env = P(35, -35, 1100 + 35);
  const act = { clk: c && state.clock.locked, vna: state.vna.power, rf: state.vna.power && state.vna.rf, las: state.ldv.power && state.ldv.shutter, ldv: state.ldv.power };
  const sp0 = parts.find(q => q.id === sel);
  const key = e2 => { const q = camRef.current; if (e2.key === "ArrowLeft") setCam({ ...q, yaw: q.yaw - 0.1 }); else if (e2.key === "ArrowRight") setCam({ ...q, yaw: q.yaw + 0.1 }); else if (e2.key === "ArrowUp") setCam({ ...q, pit: Math.min(1.5, q.pit + 0.08) }); else if (e2.key === "ArrowDown") setCam({ ...q, pit: Math.max(-0.2, q.pit - 0.08) }); else if (e2.key === "+" || e2.key === "=") setCam({ ...q, dist: q.dist * 0.85 }); else if (e2.key === "-") setCam({ ...q, dist: q.dist / 0.85 }); else if (e2.key === "Escape") setSel(null); };
  const B = ({ on, f, children }) => <button aria-pressed={on} onClick={f} className={`rounded border px-2 py-1 text-[10px] ${on ? "border-sky-500 text-sky-200" : "border-zinc-700 text-zinc-300"}`}>{children}</button>;
  const rows = [["Door", c.doorOpen ? "▲ OPEN" : "● closed"], ["Stage mm", `${g.x.toFixed(1)}, ${g.y.toFixed(1)}, ${g.z.toFixed(1)} (±${LIMIT_MM})`], ["Faraday", c.faraday ? "● on" : "▲ OFF (panel open)"], ["Isolation", c.isolation ? "● active" : "▲ OFF (jitter)"], ["Roughing", c.roughing ? "▶ running" : "○ off"], ["Turbo", c.turbo ? "▶ running" : "○ off"], ["LDV shutter", state.ldv.shutter ? "▶ open (beam)" : "○ closed"], ["VNA RF", act.rf ? "▶ on" : "○ off"], ["Clock ref", state.clock.locked ? "● locked" : "○ unlocked"]];
  return (
    <div className="space-y-2">
      <div className="rounded border border-amber-700/60 bg-amber-950/30 px-2 py-1 text-[10px] text-amber-200">▲ Conceptual, simplified model. Dimensions are plausible approximations, not an exact replica of any instrument. Only the stage ±{LIMIT_MM} mm travel is taken from the simulator.</div>
      <div className="flex flex-wrap items-center gap-1">
        {[["lab", "Laboratory"], ["chamber", "Chamber"], ["instrument", "Instrument"], ["exploded", "Exploded"], ["transparent", "Transparent"], ["chain", "Measurement chain"]].map(([m, l]) => <B key={m} on={mode === m} f={() => setM(m)}>{l}</B>)}
        <button onClick={reset} className="rounded border border-zinc-600 px-2 py-1 text-[10px] text-zinc-200">Reset view</button>
        <label className="ml-2 flex items-center gap-1 text-[10px] text-zinc-400">Quality<select aria-label="Render quality" value={qual} onChange={e => setQual(e.target.value)} className="rounded border border-zinc-700 bg-black px-1 py-0.5 text-[10px]"><option value="perf">Performance</option><option value="bal">Balanced</option><option value="qual">Quality</option></select></label>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {[["iso", "Isometric"], ["front", "Front"], ["top", "Top"], ["interior", "Chamber interior"], ["optical", "Optical path"], ["rf", "RF path"], ["vacuum", "Vacuum path"], ["rack", "Instrument rack"], ["stage", "Stage position"]].map(([n, l]) => <button key={n} onClick={() => goTo(n)} className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300 hover:border-sky-500">{l}</button>)}
      </div>
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-zinc-800 bg-black">
          <svg ref={svgRef} viewBox="0 0 800 480" tabIndex={0} role="application" aria-label="3D laboratory digital twin. Drag to rotate, shift-drag to pan, wheel or plus and minus to zoom, arrow keys to orbit." onKeyDown={key} className="w-full cursor-grab touch-none select-none"
            onPointerDown={e => { drag.current = { x: e.clientX, y: e.clientY, m: 0 }; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={e => { const d = drag.current; if (!d || !e.buttons) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; d.m += Math.abs(dx) + Math.abs(dy); const q = camRef.current; if (e.shiftKey || e.buttons > 1) { const kk = q.dist / 700; setCam({ ...q, t: [q.t[0] - (dx * cy) * kk, q.t[1] + (dx * sy) * kk, q.t[2] + dy * kk] }); } else setCam({ ...q, yaw: q.yaw + dx * 0.008, pit: Math.max(-0.2, Math.min(1.5, q.pit + dy * 0.008)) }); }}
            onPointerUp={() => setTimeout(() => { drag.current = null; }, 0)} onContextMenu={e => e.preventDefault()}>
            <rect width="800" height="480" fill="url(#tw-bg)" /><TwDefs />
            
            {line("vac", vac, "#7dd3fc", 3, "2 8", pump, "Vacuum path")}
            {line("clk1", [[1580, 0, 1600], [1580, 0, 1350]], "#22d3ee", 2, "6 4", act.clk && act.vna, "Clock reference to VNA")}
            {line("clk2", [[1580, 0, 1600], [1580, 0, 1950], [110, 0, 1950], [110, 0, 1720]], "#22d3ee", 2, "6 4", act.clk && act.ldv, "Clock reference to LDV")}
            {line("rf", [[1580, 0, 1350], [1580, 0, 1100], [330, 0, 1100], [70, 40, 1100]], "#e879f9", 2.5, "2 5", act.rf, "RF path")}
            {items.map(i => i.s)}
            {line("las", [[0, 0, 1560], [0, 0, 1405], [g.x, g.y, 1100 + g.z + 25]], "#facc15", 2.2, "", act.las, "LDV laser path")}
            {pump && !still && [0, 1, 2, 3, 4, 5].map(i => { const q = P(...along(vac, ((tm / 2600) + i / 6) % 1)); return <circle key={"pp" + i} cx={q[0]} cy={q[1]} r="2.6" fill="#bae6fd" />; })}
            {mode === "exploded" && Object.keys(EXPL).filter(k => !hid[k]).map(k => { const a = P(0, 0, 1100), b = P(EXPL[k][0], EXPL[k][1], 1100 + EXPL[k][2]); return <line key={"x" + k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#64748b" strokeDasharray="3 4" opacity=".6" />; })}
            {dist < 3000 && <text x={env[0] + 8} y={env[1]} fontSize="10" fill="#fbbf24" fontFamily="monospace">±{LIMIT_MM} mm stage travel</text>}
            <g fontFamily="monospace" fontSize="10" fill="#cbd5e1"><line x1="20" y1="455" x2={20 + nice * k0} y2="455" stroke="#e2e8f0" strokeWidth="2" /><line x1="20" y1="450" x2="20" y2="460" stroke="#e2e8f0" /><line x1={20 + nice * k0} y1="450" x2={20 + nice * k0} y2="460" stroke="#e2e8f0" /><text x="20" y="444">{nice >= 1000 ? nice / 1000 + " m" : nice + " mm"} (scale at focus)</text><text x="780" y="470" textAnchor="end" fill="#64748b">view dist {(dist / 1000).toFixed(2)} m · LOD {tier} · {items.length} faces</text></g>
          </svg>
        </div>
        <div className="w-full space-y-2 text-[11px] lg:w-72">
          <div className="rounded border border-zinc-800 bg-zinc-950 p-2">
            <div className="mb-1 font-bold text-zinc-300">Assemblies</div>
            {Object.keys(GRP).map(k => (
              <div key={k} className="border-b border-zinc-900 py-1">
                <div className="flex items-center justify-between gap-1"><span className={hid[k] ? "text-zinc-600 line-through" : "text-zinc-200"}>{GRP[k]}</span>
                  <span className="flex gap-1"><B on={!!hid[k]} f={() => setHid({ ...hid, [k]: !hid[k] })}>Hide</B><B on={solo === k} f={() => setSolo(solo === k ? null : k)}>Isolate</B><B on={!!ghost[k]} f={() => setGhost({ ...ghost, [k]: !ghost[k] })}>Ghost</B></span></div>
                {k === "chamber" && <div className="mt-1 flex flex-wrap gap-1">{["Chamber body", "Door", "Quartz viewport", "Feedthroughs", "Vacuum manifold", "Internal XYZ stage"].map(n => { const p = parts.find(q => q.sub === n); return <button key={n} onClick={() => p && focus(p)} className="rounded bg-zinc-900 px-1.5 py-0.5 text-[9px] text-zinc-400 hover:text-sky-300">{n}</button>; })}</div>}
              </div>
            ))}
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-950 p-2">
            <div className="mb-1 font-bold text-zinc-300">Inspect</div>
            {sp0 ? <div className="space-y-0.5 font-mono text-zinc-300"><div className="text-sky-300">{sp0.label}</div><div>Group: {GRP[sp0.g]}</div><div>Size: {sp0.s ? sp0.s.join(" × ") + " mm" : sp0.k === "sph" ? "Ø" + sp0.r * 2 + " mm" : `Ø${sp0.r * 2} × ${sp0.len} mm`}</div>{sp0.note && <div>{sp0.note}</div>}{sp0.conceptual && <div className="text-amber-300">▲ conceptual / simplified</div>}<div className="flex gap-1 pt-1"><B f={() => focus(sp0)}>Focus camera</B>{sp0.inst && <button onClick={() => dispatch && dispatch({ type: "SET_UI", patch: { active: sp0.inst } })} className="rounded border border-zinc-600 px-2 py-1 text-[10px]">Open page</button>}</div></div> : <div className="text-zinc-500">Click any part to inspect it.</div>}
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-950 p-2 font-mono"><div className="mb-1 font-bold text-zinc-300">Live twin state</div>{rows.map(([a, b]) => <div key={a} className="flex justify-between"><span className="text-zinc-500">{a}</span><span className="text-zinc-200">{b}</span></div>)}</div>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ state, dispatch, f0, validationResult, sweep, HelpInfo }) {
  const set = (domain, patch) => dispatch({ type: "PATCH", domain, patch });
  const valid = validationResult.overall === "VALID";
  const records = state.experiment.records;
  const latestRecord = records[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center">Operator Dashboard <HelpInfo termKey="sphere" /></h1>
          <p className="mt-1 text-sm text-zinc-400">At-a-glance facility status, live resonance telemetry, and experiment quick actions.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => set("ui", { wizardOpen: true })} className="rounded border border-emerald-500 bg-emerald-950 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-900 flex items-center gap-1">
            <Wrench size={14} /> Startup Wizard
          </button>
          <button onClick={sweep} disabled={!state.vna.power} className="rounded border border-sky-500 bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-40 flex items-center gap-1">
            <Play size={14} /> Single Sweep
          </button>
          {state.experiment.active ? (
            <button onClick={() => dispatch({ type: "STOP_RUN" })} className="rounded border border-rose-700 bg-rose-900 px-3 py-2 text-xs font-semibold text-white flex items-center gap-1">
              <Square size={14} /> Stop Run
            </button>
          ) : (
            <button onClick={() => dispatch({ type: "START_RUN" })} className="rounded border border-emerald-700 bg-emerald-900 px-3 py-2 text-xs font-semibold text-white flex items-center gap-1">
              <FlaskConical size={14} /> Start Standard Run
            </button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-sky-500/40 bg-sky-950/20 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex gap-3 items-center">
          <div className="w-10 h-10 rounded-full bg-sky-500/20 border border-sky-500/50 flex items-center justify-center text-sky-300 shrink-0">
            <Info size={20} />
          </div>
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-sky-300">Next Recommended Action</h4>
            <p className="text-xs text-zinc-300 mt-0.5">
              {!state.facility.power ? "Turn on Main Breaker to energize facility power." :
               !state.clock.locked ? "Power on Rubidium Clock and wait for external lock." :
               state.chamber.pressure > 1 ? "Evacuate chamber using roughing and turbo pumps." :
               !state.vna.power ? "Power on Keysight VNA and enable RF output." :
               "Facility is fully nominal. Begin a spatial scan run."}
            </p>
          </div>
        </div>
        <button onClick={() => set("ui", { wizardOpen: true })} className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-bold shrink-0">
          Open Startup Wizard
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center">Current Resonance <HelpInfo termKey="center_freq" /></div>
          <div className="mt-2 text-lg font-bold text-sky-300">{latestRecord ? `${latestRecord.resonance.toFixed(2)} Hz` : `${f0.toFixed(2)} Hz`}</div>
          <div className="mt-1 text-[11px] text-zinc-500">S11 Min: {latestRecord ? `${latestRecord.depth.toFixed(2)} dB` : "-28.5 dB"}</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center">Measurement Quality <HelpInfo termKey="faraday_cage" /></div>
          <div className={`mt-2 text-lg font-bold ${valid ? "text-emerald-300" : "text-amber-300"}`}>{validationResult.overall}</div>
          <div className="mt-1 text-[11px] text-zinc-500">
            <button onClick={() => set("ui", { validatorModalOpen: true })} className="text-blue-400 hover:underline">Open Inspector →</button>
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center">Thermal Stability <HelpInfo termKey="thermostat" /></div>
          <div className="mt-2 text-lg font-bold text-orange-300">{state.chamber.temperature.toFixed(3)} °C</div>
          <div className="mt-1 text-[11px] text-zinc-500">Drift rate: 0.01 °C/min</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center">Stage Position <HelpInfo termKey="location_variable" /></div>
          <div className="mt-2 text-lg font-bold text-violet-300">X:{state.stage.x.toFixed(1)} Y:{state.stage.y.toFixed(1)} Z:{state.stage.z.toFixed(1)}</div>
          <div className="mt-1 text-[11px] text-zinc-500">Limits: ±35 mm</div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2 text-xs font-bold uppercase text-zinc-300">
            <span className="flex items-center"><Radio className="h-4 w-4 text-sky-400 mr-2" /> VNA S11 Preview</span>
            <button onClick={() => set("ui", { active: "vna" })} className="text-[10px] text-blue-400 hover:underline">Expand →</button>
          </div>
          <div className="h-[180px] flex-1"><S11Plot trace={state.vna.trace} compact /></div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2 text-xs font-bold uppercase text-zinc-300">
            <span className="flex items-center"><Activity className="h-4 w-4 text-amber-400 mr-2" /> Oscilloscope Preview</span>
            <button onClick={() => set("ui", { active: "scope" })} className="text-[10px] text-blue-400 hover:underline">Expand →</button>
          </div>
          <div className="h-[180px] flex-1 rounded bg-black"><ScopePlot trace={state.scope.trace} compact /></div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2 text-xs font-bold uppercase text-zinc-300">
            <span className="flex items-center"><Wind className="h-4 w-4 text-emerald-400 mr-2" /> Mini Chamber View</span>
            <button onClick={() => set("ui", { active: "chamber" })} className="text-[10px] text-blue-400 hover:underline">Expand →</button>
          </div>
          <div className="h-[180px] flex-1"><ChamberSVG state={state} mini /></div>
        </div>
      </div>
    </div>
  );
}

function Chamber({ state, dispatch, HelpInfo }) {
  const [cv, setCv] = useState({ shell: true, cut: false, cam: "front" });
  const set = (domain, patch) => dispatch({ type: "PATCH", domain, patch });
  
  const move = (axis, d) => {
    if (state.stage.clampActive) {
      dispatch({ type: "ALARM", text: "Stage move blocked: mechanical stage clamp is currently engaged.", severity: "critical" });
      return;
    }
    dispatch({ type: "MOVE_STAGE", position: { [axis]: clamp(state.stage[axis] + d, -LIMIT_MM, LIMIT_MM) } });
  };

  const handleTurboClick = () => {
    if (state.chamber.pressure > 50) {
      dispatch({ type: "ALARM", text: "Turbo activation rejected: chamber pressure exceeds 50 Torr safety interlock.", severity: "critical" });
      return;
    }
    set("chamber", { vent: false, roughing: true, turbo: true });
  };

  const handleVentClick = () => {
    if (state.chamber.pressure < 1) {
      set("ui", { 
        confirmModal: { 
          title: "Vent Chamber Under Deep Vacuum?", 
          desc: "The chamber is currently under deep vacuum (< 1 Torr). Venting now will cause rapid gas rush and potential turbulence shock.", 
          onConfirm: () => { set("chamber", { vent: true, roughing: false, turbo: false }); set("ui", { confirmModal: null }); } 
        } 
      });
    } else {
      set("chamber", { vent: true, roughing: false, turbo: false });
    }
  };

  const handleDoorClick = () => {
    if (state.chamber.pressure < 760 && !state.chamber.doorOpen) {
      set("ui", {
        confirmModal: {
          title: "Open Chamber Door Under Vacuum?",
          desc: "The chamber is not fully vented to atmospheric pressure (760 Torr). Opening the door will cause a vacuum seal blowout.",
          onConfirm: () => { set("chamber", { doorOpen: true }); set("ui", { confirmModal: null }); }
        }
      });
    } else {
      set("chamber", { doorOpen: !state.chamber.doorOpen });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center">Environmental Chamber & XYZ Stage <HelpInfo termKey="chamber" /></h1>
        <p className="mt-1 text-sm text-zinc-400">Interactive 3D Hardware Simulation with rendered stainless enclosure, optical window, vacuum fittings, and motorized stage.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_.9fr]">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl">
          <div className="text-xs font-bold uppercase text-zinc-300 border-b border-zinc-800 pb-2 mb-3 flex items-center justify-between">
            <span className="flex items-center">Thermal-Vacuum Chamber (Hardware View) <HelpInfo termKey="chamber" /></span>
            <span className="text-[10px] font-mono text-emerald-400">STATUS: SEALED & ISOLATED</span>
          </div>

          <DigitalTwin state={state} dispatch={dispatch} />

          <div className="mt-3 flex gap-2 items-center justify-between">
            <div className="flex gap-2">
              <button onClick={() => dispatch({ type: "HOME_STAGE" })} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800">Home Stage</button>
              <button onClick={() => dispatch({ type: "MOVE_STAGE", position: { x: 0, y: 0, z: 0 } })} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800">Park Reference</button>
              <button onClick={handleDoorClick} className={`rounded border px-3 py-1.5 text-xs ${state.chamber.doorOpen ? "border-rose-600 text-rose-300" : "border-zinc-700 bg-zinc-900 text-zinc-200"}`}>
                {state.chamber.doorOpen ? "Close Door" : "Open Door"}
              </button>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-zinc-300">
              <input type="checkbox" checked={state.stage.clampActive} onChange={e => set("stage", { clampActive: e.target.checked })} />
              <span>Mechanical Clamp</span>
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl space-y-3">
            <div className="text-xs font-bold uppercase text-zinc-300 border-b border-zinc-800 pb-2 flex items-center justify-between">
              <span>Precision XYZ Stage Controls</span> <HelpInfo termKey="location_variable" />
            </div>
            {["x", "y", "z"].map(axis => (
              <div key={axis} className="bg-zinc-900 p-2 rounded border border-zinc-800">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="uppercase text-zinc-400 font-bold">Axis {axis}</span>
                  <span className="font-mono text-sky-300">{state.stage[axis].toFixed(3)} mm</span>
                </div>
                <input type="range" min={-LIMIT_MM} max={LIMIT_MM} step="0.1" value={state.stage[axis]} disabled={!state.facility.power || state.chamber.doorOpen || state.stage.clampActive} onChange={e => move(axis, Number(e.target.value) - state.stage[axis])} className="w-full accent-sky-400" />
                <div className="flex gap-1 mt-1">
                  <button onClick={() => move(axis, -.5)} className="flex-1 bg-zinc-800 py-1 text-xs rounded border border-zinc-700 hover:bg-zinc-700">-0.5</button>
                  <button onClick={() => move(axis, .5)} className="flex-1 bg-zinc-800 py-1 text-xs rounded border border-zinc-700 hover:bg-zinc-700">+0.5</button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl space-y-3">
            <div className="text-xs font-bold uppercase text-zinc-300 border-b border-zinc-800 pb-2 flex items-center justify-between">
              <span>Thermal & Vacuum Instrumentation</span> <HelpInfo termKey="thermostat" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>Active Thermostat <HelpInfo termKey="thermostat" /></span>
              <input type="checkbox" checked={state.chamber.thermostat} onChange={v => set("chamber", { thermostat: v.target.checked })} />
            </div>
            <label className="block text-xs text-zinc-400">Target Setpoint (°C)
              <input type="number" step=".1" value={state.chamber.targetTemp} disabled={!state.chamber.thermostat} onChange={e => set("chamber", { targetTemp: Number(e.target.value) })} className="mt-1 w-full rounded border border-zinc-700 bg-black p-1.5 font-mono text-orange-200 text-xs" />
            </label>
            <div className="text-xs">Current Temp: <span className="font-mono text-orange-300">{state.chamber.temperature.toFixed(3)} °C</span></div>
            <div className="text-xs">Pressure: <span className="font-mono text-sky-300">{fmtPressure(state.chamber.pressure)}</span></div>
            <div className="grid grid-cols-3 gap-2 pt-2">
              <button onClick={handleVentClick} className="rounded border border-zinc-700 bg-zinc-900 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800">Vent</button>
              <button onClick={() => set("chamber", { vent: false, roughing: true })} disabled={state.chamber.vent} className="rounded border border-zinc-700 bg-zinc-900 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-40">Rough Pump <HelpInfo termKey="roughing_pump" /></button>
              <button onClick={handleTurboClick} disabled={state.chamber.pressure > 50} className="rounded border border-zinc-700 bg-zinc-900 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-40" title={state.chamber.pressure > 50 ? "Interlock active: pressure must be below 50 Torr" : ""}>Turbo Pump <HelpInfo termKey="turbo_pump" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpatialField({ state, dispatch, HelpInfo }) {
  const records = state.experiment.records;
  const setView = patch => dispatch({ type: "PATCH", domain: "spatial", patch });
  const view = state.spatialView;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center">Spatial Field Explorer <HelpInfo termKey="spatial_field" /></h1>
          <p className="mt-1 text-sm text-zinc-400">Volumetric field visualization mapping measured resonance shifts across X, Y, and Z coordinates.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Metric:</span>
          <select value={view.metric} onChange={e => setView({ metric: e.target.value })} className="bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-sky-300">
            <option value="frequencyShift">Resonance Shift (Δf)</option>
            <option value="resonance">Absolute Frequency (f₀)</option>
            <option value="q">Q Factor</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl flex flex-col">
          <div className="flex justify-between items-center text-xs font-bold uppercase text-zinc-300 border-b border-zinc-800 pb-2 mb-3">
            <span className="flex items-center"><Orbit className="h-4 w-4 text-sky-400 mr-2" /> Volumetric Point Cloud ({records.length} Points Recorded)</span>
            <span className="text-[10px] text-zinc-500 font-mono">X:[-35,35] Y:[-35,35] Z:[-35,35]</span>
          </div>

          <SpatialMaps records={records} view={view} state={state} />
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl space-y-3">
            <div className="text-xs font-bold uppercase text-zinc-300 border-b border-zinc-800 pb-2 flex items-center">
              <span>Interpolation & Layers</span> <HelpInfo termKey="interpolation" />
            </div>
            
            <label className="block text-xs text-zinc-400">Interpolation Mode <HelpInfo termKey="interpolation" />
              <select value={view.interpolation} onChange={e => setView({ interpolation: e.target.value })} className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-zinc-200">
                <option value="none">No Interpolation (Measured Only)</option>
                <option value="idw">Inverse Distance Weighting (IDW)</option>
                <option value="rbf">Radial Basis Function (RBF)</option>
              </select>
            </label>

            <label className="block text-xs text-zinc-400">Color Palette
              <select value={view.colorScale} onChange={e => setView({ colorScale: e.target.value })} className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-zinc-200">
                <option value="diverging">Diverging (Blue - Neutral - Red)</option>
                <option value="sequential">Sequential (Violet - Cyan - Yellow)</option>
              </select>
            </label>

            <div className="pt-2 border-t border-zinc-900 text-xs space-y-1">
              <div className="flex justify-between text-zinc-400"><span>Total Points:</span><span className="font-mono text-zinc-200">{records.length}</span></div>
              <div className="flex justify-between text-zinc-400"><span>Valid Points:</span><span className="font-mono text-emerald-400">{records.filter(r => r.valid).length}</span></div>
              <div className="flex justify-between text-zinc-400"><span>Coverage:</span><span className="font-mono text-sky-300">{Math.min(100, (records.length / 25) * 100).toFixed(0)}%</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Vna({ state, dispatch, sweep, f0, HelpInfo }) {
  const set = (domain, patch) => dispatch({ type: "PATCH", domain, patch });
  const trace = state.vna.trace;
  const min = trace.length ? trace.reduce((a,b)=>a.s11 < b.s11 ? a : b) : null;
  const [prog, setProg] = useState(null);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const startSweep = () => {
    sweep();
    if (!state.vna.power || !state.vna.rf || FX.reduced) return;
    const t0 = performance.now();
    const step = n => { const q = Math.min(1, (n - t0) / 1400); setProg(q >= 1 ? null : q); if (q < 1) raf.current = requestAnimationFrame(step); };
    raf.current = requestAnimationFrame(step);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center">Keysight E5080B VNA Hardware Front Panel <HelpInfo termKey="vna" /></h1>
          <p className="mt-1 text-sm text-zinc-400">Photorealistic vector network analyzer simulation featuring touchscreen display, softkeys, and physical port connectors.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={startSweep} disabled={!state.vna.power} className="rounded border border-sky-500 bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-40">Trigger Sweep</button>
          <button onClick={() => dispatch({ type: "CAPTURE_REFERENCE" })} disabled={!trace.length} className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-700">Capture Ref</button>
          <button onClick={() => set("ui", { calModalOpen: true })} disabled={!state.vna.power} className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-700">Calibrate Wizard</button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_.8fr]">
        <div data-status={instStatus(state, "vna")} className="rounded-xl border-4 border-zinc-700 bg-gradient-to-b from-zinc-800 to-zinc-950 p-4 shadow-2xl"><div className="absolute right-4 top-1 z-10 bg-black/70 px-1 rounded"><StatusLED status={instStatus(state, "vna")} /></div>
          <div className="flex justify-between items-center mb-3 border-b border-zinc-700 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_2px_rgba(16,185,129,0.7)]" />
              <span className="font-bold text-xs tracking-wider text-zinc-200 flex items-center">KEYSIGHT E5080B ENA VECTOR NETWORK ANALYZER <HelpInfo termKey="vna" /></span>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">9 kHz - 4.5 GHz</span>
          </div>

          <div className="rounded border-2 border-zinc-600 bg-black p-3 shadow-inner">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2 mb-2 text-xs font-bold uppercase text-zinc-300">
              <span className="flex items-center text-sky-400"><Radio className="h-4 w-4 mr-2" /> S11 Log Magnitude (CH1) <HelpInfo termKey="s11" /></span>
              <span className={`text-[10px] ${state.vna.calibrated ? "text-emerald-400" : "text-amber-400"}`}>{state.vna.calibrated ? `CAL VALID (${state.vna.calibrationType})` : "UNCAL"}</span>
            </div>
            <div className="relative h-[320px]"><S11Plot trace={trace} progress={prog} />{prog != null && <AnimatedScanCursor p={prog} />}{prog == null && min && <div className="absolute right-3 top-2 z-10"><TelemetryReadout label="Fit f₀" value={min.freq.toFixed(2)} unit="Hz" sub={`${min.s11.toFixed(1)} dB`} /></div>}</div>
          </div>

          <div className="mt-4 flex justify-between items-center pt-3 border-t border-zinc-700">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-zinc-800 border-2 border-zinc-500 shadow flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-black border border-zinc-400" />
                </div>
                <span className="text-[9px] text-zinc-400 mt-1 font-mono">PORT 1 (SRC)</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full bg-zinc-800 border-2 border-zinc-500 shadow flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-black border border-zinc-400" />
                </div>
                <span className="text-[9px] text-zinc-400 mt-1 font-mono">PORT 2 (RCV)</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => set("vna", { power: !state.vna.power })} className={`px-4 py-1.5 rounded text-xs font-bold border ${state.vna.power ? "bg-emerald-600 border-emerald-400 text-white" : "bg-zinc-800 border-zinc-600 text-zinc-400"}`}>
                Power {state.vna.power ? "ON" : "OFF"}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl space-y-2">
            <div className="text-xs font-bold uppercase text-zinc-300 border-b border-zinc-800 pb-2 mb-2 flex items-center justify-between">
              <span>VNA Stimulus & Sweep Controls</span> <HelpInfo termKey="span" />
            </div>
            <div className="flex items-center justify-between text-xs py-1"><span>VNA Power</span><input type="checkbox" checked={state.vna.power} disabled={!state.facility.power} onChange={v => set("vna", { power: v.target.checked, rf: v.target.checked ? state.vna.rf : false })} /></div>
            <div className="flex items-center justify-between text-xs py-1"><span>RF Output</span><input type="checkbox" checked={state.vna.rf} disabled={!state.vna.power} onChange={v => set("vna", { rf: v.target.checked })} /></div>
            
            <label className="block text-xs text-zinc-400">Sweep Mode
              <select value={state.vna.sweepMode} onChange={e => set("vna", { sweepMode: e.target.value })} className="mt-1 w-full rounded border border-zinc-700 bg-black p-1.5 text-xs text-zinc-200">
                <option value="continuous">Linear Frequency Sweep</option>
                <option value="log">Logarithmic Frequency Sweep</option>
              </select>
            </label>

            <label className="block text-xs text-zinc-400">Trigger Mode
              <select value={state.vna.triggerMode} onChange={e => set("vna", { triggerMode: e.target.value })} className="mt-1 w-full rounded border border-zinc-700 bg-black p-1.5 text-xs text-zinc-200">
                <option value="internal">Internal Trigger</option>
                <option value="external">External TTL Trigger</option>
                <option value="manual">Manual Trigger</option>
              </select>
            </label>

            <label className="block text-xs text-zinc-400">Trace Math
              <select value={state.vna.traceMath} onChange={e => set("vna", { traceMath: e.target.value })} className="mt-1 w-full rounded border border-zinc-700 bg-black p-1.5 text-xs text-zinc-200">
                <option value="live">Live Trace</option>
                <option value="ref">Reference Trace</option>
                <option value="diff">Live Minus Reference (Live - Ref)</option>
                <option value="ratio">Live / Reference Ratio</option>
              </select>
            </label>

            <label className="block text-xs text-zinc-400">Center Hz <HelpInfo termKey="center_freq" />
              <input type="number" value={state.vna.center} onChange={e => set("vna", { center: Number(e.target.value) })} className="mt-1 w-full rounded border border-zinc-700 bg-black p-1.5 font-mono text-sky-200 text-xs" />
            </label>
            <label className="block text-xs text-zinc-400">Span Hz <HelpInfo termKey="span" />
              <input type="number" value={state.vna.span} onChange={e => set("vna", { span: Number(e.target.value) })} className="mt-1 w-full rounded border border-zinc-700 bg-black p-1.5 font-mono text-sky-200 text-xs" />
            </label>
            <label className="block text-xs text-zinc-400">IFBW (Hz) <HelpInfo termKey="ifbw" />
              <input type="number" value={state.vna.ifbw} onChange={e => set("vna", { ifbw: Number(e.target.value) })} className="mt-1 w-full rounded border border-zinc-700 bg-black p-1.5 font-mono text-sky-200 text-xs" />
            </label>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl space-y-2">
            <div className="text-xs font-bold uppercase text-zinc-300 border-b border-zinc-800 pb-2 mb-2 flex items-center justify-between">
              <span>Lorentzian Fit Analysis</span> <HelpInfo termKey="vna" />
            </div>
            {min ? (
              <>
                <FitRow label="Fitted f₀" value={`${min.freq.toFixed(3)} Hz`} />
                <FitRow label="Minimum S11" value={`${min.s11.toFixed(2)} dB`} />
                <FitRow label="Q factor" value={(state.chamber.pressure > 1 ? 1200 : 4500).toLocaleString()} />
              </>
            ) : <p className="text-xs text-zinc-500">Enable the VNA and capture a trace.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function FitRow({ label, value }) {
  return (
    <div className="flex justify-between border-b border-zinc-900 py-2 text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono text-zinc-200">{value}</span>
    </div>
  );
}

function Ldv({ state, dispatch, HelpInfo }) {
  const set = (domain, patch) => dispatch({ type: "PATCH", domain, patch });
  const signal = clamp(93 - Math.abs(state.stage.x)*.8 - Math.abs(state.stage.z)*.6 - (!state.chamber.isolation ? 18 : 0), 5, 99);
  const data = Array.from({length:100},(_,i)=>({f:228+i*.05, a:Math.exp(-Math.pow((i-50)/10,2))*((signal/100)*.9)+Math.sin(i*.34)*.03}));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center">Polytec PSV-500-3D LDV Hardware Interface <HelpInfo termKey="ldv" /></h1>
        <p className="mt-1 text-sm text-zinc-400">Scanning laser Doppler vibrometer controller simulation with optical head diagnostics and full-field 3D mode mapping.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_.8fr]">
        <div data-status={instStatus(state, "ldv")} className="rounded-xl border-4 border-zinc-700 bg-gradient-to-b from-zinc-800 to-zinc-950 p-4 shadow-2xl"><div className="absolute right-4 top-1 z-10 bg-black/70 px-1 rounded"><StatusLED status={instStatus(state, "ldv")} /></div>
          <div className="flex justify-between items-center mb-3 border-b border-zinc-700 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-fuchsia-500 shadow-[0_0_8px_2px_rgba(217,70,239,0.7)]" />
              <span className="font-bold text-xs tracking-wider text-zinc-200 flex items-center">POLYTEC PSV-500-3D CONTROLLER & SOFTWARE SUITE <HelpInfo termKey="ldv" /></span>
            </div>
            <span className="text-[10px] font-mono text-fuchsia-400">LASER CLASS 2 · 633 nm</span>
          </div>

          <div className="rounded border-2 border-zinc-600 bg-black p-3 shadow-inner">
            <div className="text-xs font-bold uppercase text-zinc-300 border-b border-zinc-800 pb-2 mb-3 flex items-center">
              <ScanLine className="h-4 w-4 text-fuchsia-400 mr-2" /> 3D Displacement Spectrum · Z Axis
            </div>
            <SpectrumPlot data={data} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl space-y-3">
            <div className="text-xs font-bold uppercase text-zinc-300 border-b border-zinc-800 pb-2 flex items-center justify-between">
              <span>Laser Head & Shutter Controls</span> <HelpInfo termKey="shutter" />
            </div>
            <div className="flex items-center justify-between text-xs"><span>LDV Hardware</span><input type="checkbox" checked={state.ldv.power} disabled={!state.facility.power} onChange={v => set("ldv", { power: v.target.checked, shutter: v.target.checked ? state.ldv.shutter : false })} /></div>
            <div className="flex items-center justify-between text-xs"><span>Laser Shutter <HelpInfo termKey="shutter" /></span><input type="checkbox" checked={state.ldv.shutter} disabled={!state.ldv.power} onChange={v => set("ldv", { shutter: v.target.checked })} /></div>
            <div className="mt-2">
              <div className="mb-1 flex justify-between text-xs"><span className="text-zinc-400">Optical Return Signal</span><span className={signal>60?"text-emerald-400":"text-amber-400"}>{signal.toFixed(0)}%</span></div>
              <div className="h-2 overflow-hidden rounded bg-zinc-800"><div className={`h-full ${signal>60?"bg-emerald-500":"bg-amber-500"}`} style={{width:`${signal}%`}}/></div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl space-y-3">
            <div className="text-xs font-bold uppercase text-zinc-300 border-b border-zinc-800 pb-2 flex items-center justify-between">
              <span>Scan Configuration</span> <HelpInfo termKey="velocity_range" />
            </div>
            <label className="block text-xs text-zinc-400">Grid Points
              <input type="number" value={state.ldv.grid} onChange={e => set("ldv", { grid: Math.round(Number(e.target.value)) })} className="mt-1 w-full rounded border border-zinc-700 bg-black p-1.5 text-xs text-sky-200 font-mono" />
            </label>
            <label className="block text-xs text-zinc-400">Velocity Range <HelpInfo termKey="velocity_range" />
              <select value={state.ldv.range} onChange={e => set("ldv", { range: e.target.value })} className="mt-1 w-full rounded border border-zinc-700 bg-black p-1.5 text-xs">
                <option>10 mm/s/V</option><option>20 mm/s/V</option><option>100 mm/s/V</option>
              </select>
            </label>
            <button className="w-full rounded border border-zinc-700 bg-zinc-900 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 mt-2" disabled={!state.ldv.shutter}>Acquire 3D Scan</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Scope({ state, dispatch, HelpInfo }) {
  const set = (domain, patch) => dispatch({ type: "PATCH", domain, patch });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center">Tektronix 5 Series MSO Hardware Front Panel <HelpInfo termKey="scope" /></h1>
        <p className="mt-1 text-sm text-zinc-400">Mixed signal oscilloscope simulation featuring physical-grade screen graphics, channel inputs, and timebase knob controls.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_.8fr]">
        <div data-status={instStatus(state, "scope")} className="rounded-xl border-4 border-zinc-700 bg-gradient-to-b from-zinc-800 to-zinc-950 p-4 shadow-2xl"><div className="absolute right-4 top-1 z-10 bg-black/70 px-1 rounded"><StatusLED status={instStatus(state, "scope")} /></div>
          <div className="flex justify-between items-center mb-3 border-b border-zinc-700 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_2px_rgba(245,158,11,0.7)]" />
              <span className="font-bold text-xs tracking-wider text-zinc-200 flex items-center">TEKTRONIX 5 SERIES MSO MIXED SIGNAL OSCILLOSCOPE <HelpInfo termKey="scope" /></span>
            </div>
            <span className="text-[10px] font-mono text-amber-400">1 GHz · 12-BIT ADC</span>
          </div>

          <div className="rounded border-2 border-zinc-600 bg-black p-3 shadow-inner">
            <div className="text-xs font-bold uppercase text-zinc-300 border-b border-zinc-800 pb-2 mb-3">CH1 · Analog Acquisition (Time Domain)</div>
            <div className="h-[280px]"><ScopePlot trace={state.scope.trace} scale={state.scope.scale} timebase={state.scope.timebase} /></div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl space-y-3">
            <div className="text-xs font-bold uppercase text-zinc-300 border-b border-zinc-800 pb-2 flex items-center justify-between">
              <span>Oscilloscope Acquisition</span> <HelpInfo termKey="timebase" />
            </div>
            <div className="flex items-center justify-between text-xs"><span>Scope Power</span><input type="checkbox" checked={state.scope.power} disabled={!state.facility.power} onChange={v => set("scope", { power: v.target.checked })} /></div>
            <div className="flex items-center justify-between text-xs"><span>Run / Stop</span><input type="checkbox" checked={state.scope.running} disabled={!state.scope.power} onChange={v => set("scope", { running: v.target.checked })} /></div>
            <label className="block text-xs text-zinc-400">Timebase µs/div <HelpInfo termKey="timebase" />
              <input type="number" value={state.scope.timebase} onChange={e => set("scope", { timebase: Number(e.target.value) })} className="mt-1 w-full rounded border border-zinc-700 bg-black p-1.5 text-xs text-sky-200 font-mono" />
            </label>
            <label className="block text-xs text-zinc-400">CH1 V/div <HelpInfo termKey="v_div" />
              <input type="number" step="0.1" value={state.scope.scale} onChange={e => set("scope", { scale: Number(e.target.value) })} className="mt-1 w-full rounded border border-zinc-700 bg-black p-1.5 text-xs text-sky-200 font-mono" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function Clock({ state, dispatch, HelpInfo }) {
  const set = (domain, patch) => dispatch({ type: "PATCH", domain, patch });
  const pct = Math.min(100, state.clock.warmup / WARMUP_SECONDS * 100);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center">SRS FS725 Rubidium Frequency Standard <HelpInfo termKey="clock" /></h1>
        <p className="mt-1 text-sm text-zinc-400">Atomic clock half-rack chassis simulation featuring status LEDs, 10 MHz reference outputs, and warm-up lock sequence.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-xl border-4 border-zinc-700 bg-gradient-to-b from-zinc-800 to-zinc-950 p-6 shadow-2xl text-center space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-700 pb-2 mb-4">
            <span className="font-bold text-xs text-zinc-200 flex items-center">SRS FS725 RUBIDIUM FREQUENCY STANDARD <HelpInfo termKey="clock" /></span>
            <span className="text-[10px] font-mono text-emerald-400">10 MHz / 1 PPS OUTPUT</span>
          </div>
          <div className="rounded bg-black p-4 border border-zinc-700">
            <div className="text-[10px] tracking-[.4em] text-zinc-500">ATOMIC REFERENCE OUTPUT</div>
            <div className="font-mono text-3xl text-emerald-300 mt-1">10.000 000 000 MHz</div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <Lamp label="Power" on={state.clock.power}/>
            <Lamp label="Warmup" on={state.clock.power&&!state.clock.locked}/>
            <Lamp label="Locked" on={state.clock.locked}/>
          </div>
          <div className="pt-2">
            <div className="mb-1 flex justify-between text-xs"><span className="text-zinc-400">Warmup Progress</span><span className="font-mono text-sky-300">{pct.toFixed(0)}%</span></div>
            <div className="h-2 overflow-hidden rounded bg-zinc-800"><div className="h-full bg-sky-500" style={{width:`${pct}%`}}/></div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 shadow-2xl space-y-3">
          <div className="text-xs font-bold uppercase text-zinc-300 border-b border-zinc-800 pb-2 flex items-center justify-between">
            <span>Reference Distribution</span> <HelpInfo termKey="clock" />
          </div>
          <div className="flex items-center justify-between text-xs"><span>Clock Power</span><input type="checkbox" checked={state.clock.power} disabled={!state.facility.power} onChange={v => set("clock", { power: v.target.checked, warmup: v.target.checked ? state.clock.warmup : 0, locked: v.target.checked ? state.clock.locked : false })} /></div>
          <FitRow label="VNA 10 MHz" value={state.clock.locked ? "Locked" : "Internal"} />
          <FitRow label="LDV Sync" value={state.clock.locked ? "Locked" : "Internal"} />
        </div>
      </div>
    </div>
  );
}

function Lamp({ label, on }) {
  return (
    <div className="rounded border border-zinc-700 p-2 bg-zinc-900">
      <div className={`mx-auto h-3 w-3 rounded-full ${on ? "bg-emerald-400 shadow-[0_0_10px_3px_rgba(52,211,153,.45)]" : "bg-zinc-700"}`}/>
      <div className="mt-2 text-[10px] uppercase text-zinc-400">{label}</div>
    </div>
  );
}

function Runs({ state, dispatch, exportCsv, exportJson, sweep, HelpInfo }) {
  const set = (domain, patch) => dispatch({ type: "PATCH", domain, patch });
  const records = state.experiment.records;
  const mean = records.length ? records.reduce((n,r)=>n+r.resonance,0)/records.length : 0;
  const sd = records.length > 1 ? Math.sqrt(records.reduce((n,r)=>n+(r.resonance-mean)**2,0)/(records.length-1)) : 0;

  const launchPlan = () => {
    if (state.experiment.active) {
      dispatch({ type: "ALARM", text: "Scan plan start warning: a scan is already active.", severity: "warning" });
    }
    if(!state.experiment.active) dispatch({ type: "START_RUN" });
    const axis = state.experiment.axis;
    let pos = [];
    for(let v = state.experiment.start; v <= state.experiment.stop + .001; v += state.experiment.step) pos.push(v);
    if(state.experiment.randomized) pos.sort(() => Math.random() - .5);
    pos.forEach((v,i) => {
      setTimeout(() => {
        dispatch({ type: "MOVE_STAGE", position: { [axis]: v } });
        setTimeout(sweep, 150);
      }, i * 500);
    });
  };

  const handleClearRecords = () => {
    set("ui", {
      confirmModal: {
        title: "Clear All Experiment Records?",
        desc: "This will permanently delete all stored measurement points for the active session. Export data first if you wish to retain it.",
        onConfirm: () => {
          set("experiment", { records: [] });
          set("ui", { confirmModal: null });
          dispatch({ type: "EVENT", text: "Measurement ledger cleared by operator.", level: "warning", subsystem: "RESEARCH" });
        }
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center">Experiment Run Manager <HelpInfo termKey="location_variable" /></h1>
          <p className="mt-1 text-sm text-zinc-400">Traceable measurements, randomized scan plans, reference logic, data-quality labels, and local exports.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={launchPlan} className="rounded border border-emerald-600 bg-emerald-900 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 flex items-center gap-1"><Play size={14}/> Run Scan Plan</button>
          <button onClick={exportCsv} className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-700 flex items-center gap-1"><Download size={14}/> CSV</button>
          <button onClick={exportJson} className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-700 flex items-center gap-1"><Archive size={14}/> JSON</button>
          <button onClick={handleClearRecords} className="rounded border border-rose-600 bg-rose-900 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-800">Clear Data</button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[.85fr_1.5fr]">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl space-y-3">
          <div className="text-xs font-bold uppercase text-zinc-300 border-b border-zinc-800 pb-2 flex items-center justify-between">
            <span>Plan Builder</span> <HelpInfo termKey="location_variable" />
          </div>
          <label className="block text-xs text-zinc-400">Scan Axis
            <select value={state.experiment.axis} onChange={e => set("experiment", { axis: e.target.value })} className="mt-1 w-full rounded border border-zinc-700 bg-black p-1.5 text-xs">
              <option value="x">X Axis</option><option value="y">Y Axis</option><option value="z">Z Axis</option>
            </select>
          </label>
          <label className="block text-xs text-zinc-400">Start (mm)
            <input type="number" value={state.experiment.start} onChange={e => set("experiment", { start: Number(e.target.value) })} className="mt-1 w-full rounded border border-zinc-700 bg-black p-1.5 text-xs font-mono text-sky-200" />
          </label>
          <label className="block text-xs text-zinc-400">Stop (mm)
            <input type="number" value={state.experiment.stop} onChange={e => set("experiment", { stop: Number(e.target.value) })} className="mt-1 w-full rounded border border-zinc-700 bg-black p-1.5 text-xs font-mono text-sky-200" />
          </label>
          <label className="block text-xs text-zinc-400">Step (mm)
            <input type="number" value={state.experiment.step} onChange={e => set("experiment", { step: Math.max(.1, Number(e.target.value)) })} className="mt-1 w-full rounded border border-zinc-700 bg-black p-1.5 text-xs font-mono text-sky-200" />
          </label>
          <div className="flex items-center justify-between text-xs pt-2"><span>Randomized Plan</span><input type="checkbox" checked={state.experiment.randomized} onChange={v => set("experiment", { randomized: v.target.checked })} /></div>
          
          <div className="rounded border border-zinc-800 bg-zinc-900 p-3 text-xs mt-4">
            <div className="text-zinc-500">Run ID: <span className="font-mono text-sky-300">{state.experiment.id || "None"}</span></div>
            <div className="mt-2 text-zinc-500">Repeatability: <span className="font-mono text-zinc-200">{records.length > 1 ? `σ = ${sd.toFixed(3)} Hz` : "Awaiting repeats"}</span></div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl">
          <div className="text-xs font-bold uppercase text-zinc-300 border-b border-zinc-800 pb-2 mb-3">Measurement Ledger</div>
          <div className="max-h-[460px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-zinc-950 text-[10px] uppercase tracking-wider text-zinc-500">
                <tr><th className="p-2">Time</th><th className="p-2">XYZ mm</th><th className="p-2">f₀ Hz</th><th className="p-2">Q</th><th className="p-2">Quality</th></tr>
              </thead>
              <tbody>
                {records.length ? records.map(r => (
                  <tr key={r.id} className="border-t border-zinc-900 hover:bg-zinc-900/50">
                    <td className="p-2 font-mono text-zinc-400">{r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : "Now"}</td>
                    <td className="p-2 font-mono text-sky-200">{r.x.toFixed(1)}, {r.y.toFixed(1)}, {r.z.toFixed(1)}</td>
                    <td className="p-2 font-mono">{r.resonance.toFixed(3)}</td>
                    <td className="p-2">{r.q}</td>
                    <td className={`p-2 font-bold ${r.valid ? "text-emerald-400" : "text-amber-400"}`}>{r.valid ? "VALID" : "SUSPECT"}</td>
                  </tr>
                )) : <tr><td colSpan="5" className="p-8 text-center text-zinc-500">No recorded measurements. Start a run and trigger sweeps.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventLog({ events, journalFilter, setJournalFilter, journalSearch, setJournalSearch }) {
  const filtered = events.filter(e => {
    const matchSearch = e.text.toLowerCase().includes(journalSearch.toLowerCase()) || e.subsystem.toLowerCase().includes(journalSearch.toLowerCase());
    if (!matchSearch) return false;
    if (journalFilter === "all") return true;
    if (journalFilter === "operator" && e.subsystem === "SYSTEM") return true;
    if (journalFilter === "instrument" && ["VNA", "LDV", "SCOPE", "CLOCK"].includes(e.subsystem)) return true;
    if (journalFilter === "environmental" && e.subsystem === "CHAMBER") return true;
    if (journalFilter === "warning" && e.level === "warning") return true;
    if (journalFilter === "alarm" && e.level === "critical") return true;
    if (journalFilter === "scan" && e.subsystem === "RESEARCH") return true;
    return true;
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      <input 
        value={journalSearch} 
        onChange={e => setJournalSearch(e.target.value)} 
        placeholder="Search instrument journal…" 
        className="w-full rounded border border-zinc-700 bg-black p-2 text-xs text-zinc-200 placeholder:text-zinc-600 shrink-0 font-mono" 
      />

      <div className="flex flex-wrap gap-1 shrink-0">
        {[
          ["all", "All"],
          ["operator", "Operator"],
          ["instrument", "Instruments"],
          ["environmental", "Environment"],
          ["warning", "Warnings"],
          ["alarm", "Alarms"],
          ["scan", "Scans"]
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setJournalFilter(key)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${journalFilter === key ? "bg-sky-500 text-black font-bold" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto min-h-0 pr-1">
        {filtered.length ? filtered.map(e => (
          <div key={e.id} className="rounded border border-zinc-800 bg-zinc-900/50 p-2 text-xs space-y-1">
            <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500">
              <span className="text-sky-400 font-bold">{e.subsystem}</span>
              <span>{e.time} (Sim t={e.simulationTime}s)</span>
            </div>
            <div className={e.level === "warning" ? "text-amber-300" : e.level === "critical" ? "text-rose-400 font-bold" : "text-zinc-300"}>
              {e.text}
            </div>
            {e.runId && <div className="text-[9px] text-zinc-500 font-mono">Run: {e.runId}</div>}
          </div>
        )) : <div className="p-3 text-xs text-zinc-500">No journal entries match the filter.</div>}
      </div>
    </div>
  );
}

function AlarmList({ state, dispatch }) {
  return (
    <div className="flex-1 space-y-2 overflow-y-auto min-h-0 pr-1">
      {state.alarms.length ? state.alarms.map(a => (
        <div key={a.id} className={`rounded border p-2 text-xs ${a.severity === "critical" ? "border-rose-800 bg-rose-950/40" : "border-amber-800 bg-amber-950/30"}`}>
          <div className="flex justify-between">
            <span className="text-zinc-500">{a.time}</span>
            <span className={a.acknowledged ? "text-zinc-500" : "text-amber-300 font-bold"}>{a.acknowledged ? "ACK" : "OPEN"}</span>
          </div>
          <div className="mt-1 text-zinc-200">{a.text}</div>
          {!a.acknowledged && <button className="mt-2 rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-200 hover:bg-zinc-700 border border-zinc-600" onClick={() => dispatch({ type: "ACK_ALARM", id: a.id })}>Acknowledge</button>}
        </div>
      )) : <div className="p-3 text-xs text-emerald-400 font-bold">No alarms active.</div>}
    </div>
  );
}
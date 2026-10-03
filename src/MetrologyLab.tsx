import React, { useState, useEffect, useReducer, useRef, useMemo, useCallback } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, ScatterChart, Scatter, ZAxis
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
    manualMin: null, manualMax: null, symmetric: true, projection: "perspective",
    camera: { yaw: 35, pitch: 24, zoom: 1 }, activeSlice: { x: 0, y: 0, z: 0 },
    showValid: true, showSuspect: true, showExcluded: false, showCoverage: true,
    showUncertainty: false, showPlan: true, fieldMode: "raw", timelineIndex: 9999,
    roi: { enabled: false, xMin: -35, xMax: 35, yMin: -35, yMax: 35, zMin: -35, zMax: 35 },
    qualityPreset: "standard", selectedId: null, compareEnabled: false, compareMode: "sequence-halves"
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
    case "UPDATE_RECORD": return { ...state, experiment: { ...state.experiment, records: state.experiment.records.map(r => r.id === action.id ? { ...r, ...action.patch } : r) } };
    case "ADD_DEMO_SPATIAL_DATA": {
      const pts = [];
      let seq = state.experiment.records.length;
      for (let x = -20; x <= 20; x += 10) for (let y = -20; y <= 20; y += 10) for (let z = -20; z <= 20; z += 10) {
        const resonanceShift = x * 1.45 - y * .55 + z * 2.1 + Math.sin((x+y+z)/12) * 8;
        pts.push({ id: Math.random(), runId: state.experiment.id || "DEMO-SPATIAL", sequence: ++seq, repeatIndex: 1, timestamp: new Date().toISOString(), x, y, z, resonance: BASE_FREQUENCY + resonanceShift, resonanceShift, depth: -28 + Math.abs(x+y+z)/30, q: 4500-Math.abs(x)*8, uncertaintyHz: .2+Math.abs(x*y*z)/90000, repeatMeanHz: BASE_FREQUENCY+resonanceShift, repeatSdHz: .04+Math.abs(x+y)/1000, sampleCount: 3, valid: Math.abs(x)+Math.abs(y)+Math.abs(z) < 58, temp: 20+z/1000, pressure: 1e-5, clockLocked: true, vnaCalibrated: true, faradayEnabled: true, isolationEnabled: true, ldvSignal: 90-Math.abs(x)/4, excluded: false, exclusionReason: null, note: "" });
      }
      return addEvent({ ...state, experiment: { ...state.experiment, records: [...pts, ...state.experiment.records].slice(0, 400) } }, "Demonstration spatial dataset loaded.", "info", "RESEARCH");
    }
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
    <div className="min-h-screen bg-[#06080d] font-sans text-zinc-100 selection:bg-sky-500/40 flex flex-col h-screen overflow-hidden">
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

      <main className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[auto_minmax(0,1fr)_310px] overflow-hidden">
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
                      key={String(id)} 
                      onClick={() => set("ui", { active: String(id) })} 
                      title={collapsed ? String(label) : ""}
                      className={`flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs transition relative ${active === id ? "border border-sky-500/40 bg-sky-500/10 text-sky-200 font-bold" : "border border-transparent text-zinc-400 hover:bg-zinc-900"}`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{String(label)}</span>}
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

        <section className="min-w-0 p-4 overflow-y-auto bg-zinc-950 flex flex-col">
          {active === "dashboard" && <Dashboard state={state} dispatch={dispatch} f0={f0} validationResult={validationResult} sweep={performSweep} HelpInfo={HelpInfo} />}
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

        <aside className="border-l border-zinc-800 bg-zinc-950/60 p-3 flex flex-col overflow-hidden">
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
          <div className="h-[180px] flex-1">
            <ResponsiveContainer>
              <LineChart data={state.vna.trace}>
                <CartesianGrid stroke="#242832" strokeDasharray="2 4" />
                <XAxis dataKey="freq" tickFormatter={v => `${(v / 1000).toFixed(1)}k`} stroke="#737985" fontSize={9} />
                <YAxis dataKey="s11" domain={[-35, 2]} stroke="#737985" fontSize={9} />
                <Line dataKey="s11" stroke="#56c8ff" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2 text-xs font-bold uppercase text-zinc-300">
            <span className="flex items-center"><Activity className="h-4 w-4 text-amber-400 mr-2" /> Oscilloscope Preview</span>
            <button onClick={() => set("ui", { active: "scope" })} className="text-[10px] text-blue-400 hover:underline">Expand →</button>
          </div>
          <div className="h-[180px] flex-1">
            <ResponsiveContainer>
              <LineChart data={state.scope.trace}>
                <CartesianGrid stroke="#242832" strokeDasharray="2 4" />
                <XAxis dataKey="t" stroke="#737985" fontSize={9} />
                <YAxis domain={[-1.5, 1.5]} stroke="#737985" fontSize={9} />
                <Line dataKey="value" stroke="#f6d32d" dot={false} strokeWidth={1} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2 text-xs font-bold uppercase text-zinc-300">
            <span className="flex items-center"><Wind className="h-4 w-4 text-emerald-400 mr-2" /> Mini Chamber View</span>
            <button onClick={() => set("ui", { active: "chamber" })} className="text-[10px] text-blue-400 hover:underline">Expand →</button>
          </div>
          <div className="h-[180px] flex-1 bg-black rounded border border-zinc-800 relative flex items-center justify-center overflow-hidden">
            <div className="absolute inset-4 border border-zinc-700 rounded bg-zinc-900 flex items-center justify-center">
              <div 
                className="w-8 h-8 rounded-full bg-amber-500 shadow-md transition-all duration-300 flex items-center justify-center text-[10px] font-bold text-black"
                style={{ transform: `translate(${state.stage.x * 1.5}px, ${-state.stage.z * 1.5}px)` }}
              >
                SPH
              </div>
            </div>
            <div className="absolute bottom-2 left-2 text-[9px] font-mono text-zinc-400">
              P: {fmtPressure(state.chamber.pressure)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chamber({ state, dispatch, HelpInfo }) {
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

          <div className="relative h-[380px] overflow-hidden rounded-lg border-2 border-zinc-700 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black flex items-center justify-center shadow-inner">
            <div className="absolute inset-4 rounded-xl border-4 border-zinc-600 bg-gradient-to-r from-zinc-800 via-zinc-900 to-zinc-800 p-2 shadow-2xl flex flex-col justify-between">
              <div className="flex justify-between px-2">
                {Array.from({length: 8}).map((_, i) => <div key={i} className="w-2.5 h-2.5 rounded-full bg-zinc-400 border border-zinc-700 shadow-sm"/>)}
              </div>

              <div className={`relative flex-1 mx-6 my-2 rounded-lg border-2 ${state.chamber.faraday ? "border-amber-500/60 bg-[#080d16]" : "border-rose-600 bg-[#160808]"} overflow-hidden shadow-inner flex items-center justify-center transition-all duration-500`}>
                <div className="absolute top-2 w-36 h-8 rounded-b-lg border border-sky-400/40 bg-sky-500/10 backdrop-blur flex items-center justify-center">
                  <span className="text-[9px] font-mono text-sky-300 tracking-wider">QUARTZ VIEWPORT</span>
                </div>

                <div className="absolute bottom-6 w-3/4 h-6 rounded bg-zinc-800 border border-zinc-600 flex justify-around items-center px-4">
                  {Array.from({length: 6}).map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-600"/>)}
                </div>

                <div 
                  className="absolute transition-all duration-300 flex flex-col items-center"
                  style={{ transform: `translate(${state.stage.x * 3}px, ${-state.stage.z * 3}px)` }}
                >
                  <div className="w-1.5 h-12 bg-sky-200/40 border-x border-sky-300/60" />
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-200 via-amber-600 to-amber-950 border border-amber-300 shadow-[0_0_20px_6px_rgba(245,158,11,0.35)] flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-amber-100/40 blur-[1px]" />
                  </div>
                </div>

                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-12 bg-zinc-700 border-r border-zinc-500 rounded-r" title="Vacuum Line Port" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-12 bg-zinc-700 border-l border-zinc-500 rounded-l" title="RF Feedthrough Port" />

                <div className="absolute bottom-2 left-2 bg-black/80 border border-zinc-800 px-2 py-1 rounded text-[10px] font-mono text-zinc-300">
                  P: {fmtPressure(state.chamber.pressure)} | T: {state.chamber.temperature.toFixed(2)}°C
                </div>
              </div>

              <div className="flex justify-between px-2">
                {Array.from({length: 8}).map((_, i) => <div key={i} className="w-2.5 h-2.5 rounded-full bg-zinc-400 border border-zinc-700 shadow-sm"/>)}
              </div>
            </div>
          </div>

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

function spatialMetricValue(r, metric, reference, mode) {
  let v = metric === "resonance" ? r.resonance : metric === "q" ? r.q : metric === "depth" ? r.depth : metric === "uncertainty" ? (r.uncertaintyHz || 0) : metric === "temperature" ? r.temp : metric === "pressure" ? r.pressure : (r.resonance - reference);
  if (mode === "corrected" && ["frequencyShift","resonance"].includes(metric)) v -= ((r.temp || 20)-20)*5 + ((r.pressure || 0)>1 ? -250 : 0);
  if (mode === "residual" && ["frequencyShift","resonance"].includes(metric)) v -= (r.x*45.2+r.y*-12.5+r.z*80.1);
  return v;
}
function spatialColor(value, min, max, palette="diverging") {
  const t = clamp((value-min)/Math.max(1e-9,max-min),0,1);
  if (palette === "mono") { const q=Math.round(55+t*190); return `rgb(${q},${q},${q})`; }
  if (palette === "accessible") return t<.5 ? `rgb(${Math.round(40+t*180)},${Math.round(100+t*180)},${Math.round(210-t*70)})` : `rgb(${Math.round(90+(t-.5)*300)},${Math.round(230-(t-.5)*260)},${Math.round(130-(t-.5)*130)})`;
  if (palette === "sequential") return `hsl(${270-t*220} 78% ${45+t*12}%)`;
  if(t<.5){const u=t*2;return `rgb(${Math.round(37+u*191)},${Math.round(99+u*129)},${Math.round(235-u*7)})`;}
  const u=(t-.5)*2;return `rgb(${Math.round(228+u*11)},${Math.round(228-u*160)},${Math.round(228-u*160)})`;
}
function meanOf(a){return a.length?a.reduce((n,v)=>n+v,0)/a.length:0;}
function sdOf(a){if(a.length<2)return 0;const m=meanOf(a);return Math.sqrt(a.reduce((n,v)=>n+(v-m)**2,0)/(a.length-1));}
function idwAt(records, x,y,z, valueOf, power=2) {
  if(!records.length)return null; let num=0,den=0,nearest=Infinity;
  for(const r of records){const d=Math.hypot(r.x-x,r.y-y,r.z-z);nearest=Math.min(nearest,d);if(d<.001)return {value:valueOf(r),distance:0};const w=1/Math.pow(d,power);num+=w*valueOf(r);den+=w;}
  return {value:num/den,distance:nearest};
}
function downloadText(name,text,type="application/json"){const b=new Blob([text],{type});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;a.click();URL.revokeObjectURL(a.href);}
function SpatialField({ state, dispatch, HelpInfo }) {
  const allRecords = state.experiment.records;
  const view = state.spatialView;
  const setView = patch => dispatch({ type: "PATCH", domain: "spatialView", patch });
  const [playing,setPlaying]=useState(false); const [tab,setTab]=useState("display");
  const reference = useMemo(()=>{const valid=allRecords.filter(r=>r.valid&&!r.excluded);if(!valid.length)return BASE_FREQUENCY;if(view.referenceMode==="mean")return meanOf(valid.map(r=>r.resonance));const center=[...valid].sort((a,b)=>Math.hypot(a.x,a.y,a.z)-Math.hypot(b.x,b.y,b.z))[0];return center?.resonance||BASE_FREQUENCY;},[allRecords,view.referenceMode]);
  const roi=view.roi;
  const filtered=useMemo(()=>allRecords.filter(r=>(view.showExcluded||!r.excluded)&&(view.showValid||!r.valid)&&(view.showSuspect||r.valid)&&(!roi.enabled||(r.x>=roi.xMin&&r.x<=roi.xMax&&r.y>=roi.yMin&&r.y<=roi.yMax&&r.z>=roi.zMin&&r.z<=roi.zMax))).sort((a,b)=>a.sequence-b.sequence).slice(0,Math.min(allRecords.length,view.timelineIndex)),[allRecords,view.showExcluded,view.showValid,view.showSuspect,roi,view.timelineIndex]);
  const valueOf=useCallback(r=>spatialMetricValue(r,view.metric,reference,view.fieldMode),[view.metric,view.fieldMode,reference]);
  const values=filtered.map(valueOf).filter(Number.isFinite); let autoMin=Math.min(...values,0),autoMax=Math.max(...values,1); if(view.symmetric&&view.metric==="frequencyShift"){const m=Math.max(Math.abs(autoMin),Math.abs(autoMax));autoMin=-m;autoMax=m;} const colorMin=view.lockScale&&view.manualMin!=null?view.manualMin:autoMin; const colorMax=view.lockScale&&view.manualMax!=null?view.manualMax:autoMax;
  const selected=allRecords.find(r=>r.id===view.selectedId)||null;
  const unique=new Set(filtered.map(r=>`${r.x}|${r.y}|${r.z}`)).size; const validCount=filtered.filter(r=>r.valid).length;
  const coverage=Math.min(100,unique/125*100); const vals=filtered.map(valueOf); const roiStats={n:vals.length,mean:meanOf(vals),sd:sdOf(vals),min:vals.length?Math.min(...vals):0,max:vals.length?Math.max(...vals):0};
  const diagnostics=useMemo(()=>{if(filtered.length<4)return {mae:null,rmse:null,max:null};const errors=filtered.slice(0,80).map((r,i)=>{const rest=filtered.filter((_,j)=>j!==i);const est=idwAt(rest,r.x,r.y,r.z,valueOf);return est?Math.abs(est.value-valueOf(r)):0;});return {mae:meanOf(errors),rmse:Math.sqrt(meanOf(errors.map(e=>e*e))),max:Math.max(...errors)};},[filtered,valueOf]);
  useEffect(()=>{if(!playing)return;const t=setInterval(()=>setView({timelineIndex:view.timelineIndex>=allRecords.length?1:view.timelineIndex+1}),500);return()=>clearInterval(t);},[playing,view.timelineIndex,allRecords.length]);
  const project=(r)=>{const yaw=view.camera.yaw*Math.PI/180,pitch=view.camera.pitch*Math.PI/180;let x=r.x,y=r.y,z=r.z;const x1=x*Math.cos(yaw)-z*Math.sin(yaw),z1=x*Math.sin(yaw)+z*Math.cos(yaw);const y1=y*Math.cos(pitch)-z1*Math.sin(pitch);return {sx:300+x1*5*view.camera.zoom,sy:210-y1*5*view.camera.zoom,depth:z1};};
  const points=[...filtered].sort((a,b)=>project(a).depth-project(b).depth);
  const gridN=view.qualityPreset==="preview"?7:view.qualityPreset==="high"?15:11;
  const field=useMemo(()=>{if(view.interpolation==="none"||filtered.length<4)return[];const out=[];for(let ix=0;ix<gridN;ix++)for(let iy=0;iy<gridN;iy++)for(let iz=0;iz<gridN;iz++){const x=-30+60*ix/(gridN-1),y=-30+60*iy/(gridN-1),z=-30+60*iz/(gridN-1);const e=idwAt(filtered,x,y,z,valueOf,view.interpolation==="nearest"?12:2);if(e&&e.distance<28)out.push({x,y,z,value:e.value,distance:e.distance});}return out;},[filtered,valueOf,view.interpolation,gridN]);
  const recommendations=useMemo(()=>{const candidates=[];for(let x=-30;x<=30;x+=10)for(let y=-30;y<=30;y+=10)for(let z=-30;z<=30;z+=10){const near=filtered.length?Math.min(...filtered.map(r=>Math.hypot(r.x-x,r.y-y,r.z-z))):99;if(near>8)candidates.push({x,y,z,score:near,reason:near>20?"low local coverage":"field boundary verification"});}return candidates.sort((a,b)=>b.score-a.score).slice(0,5);},[filtered]);
  const metricLabel={frequencyShift:"Δf (Hz)",resonance:"f₀ (Hz)",q:"Q",depth:"S11 (dB)",uncertainty:"± Hz",temperature:"°C",pressure:"Torr"}[view.metric];
  const sliceData=(plane)=>{const axis=plane==="xy"?"z":plane==="xz"?"y":"x",at=view.activeSlice[axis];return filtered.filter(r=>Math.abs(r[axis]-at)<=5).map(r=>({a:plane[0]==="x"?r.x:r.y,b:plane[1]==="y"?r.y:r.z,v:valueOf(r),r}));};
  const exportView=()=>downloadText(`sphere-spatial-${state.experiment.id||"session"}.json`,JSON.stringify({runId:state.experiment.id,view,reference,stats:roiStats,diagnostics,records:filtered},null,2));
  const exportCsv=()=>downloadText(`sphere-spatial-${state.experiment.id||"session"}.csv`,["id,x_mm,y_mm,z_mm,value,metric,valid,excluded,uncertainty_hz",...filtered.map(r=>[r.id,r.x,r.y,r.z,valueOf(r),view.metric,r.valid,r.excluded,r.uncertaintyHz].join(","))].join("\n"),"text/csv");
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-bold flex items-center">Spatial Field Explorer <HelpInfo termKey="spatial_field" /></h1><p className="mt-1 text-sm text-zinc-400">Measured evidence, modeled field structure, uncertainty, coverage, and next-measurement planning.</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>dispatch({type:"ADD_DEMO_SPATIAL_DATA"})} className="rounded border border-violet-500/50 bg-violet-950 px-3 py-2 text-xs text-violet-200">Load Demo Volume</button><button onClick={exportCsv} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs"><Download size={13} className="inline mr-1"/>Data</button><button onClick={exportView} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs"><Save size={13} className="inline mr-1"/>View</button></div></div>
    <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-2">
      <select value={view.metric} onChange={e=>setView({metric:e.target.value})} className="bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-sky-300"><option value="frequencyShift">Resonance Shift Δf</option><option value="resonance">Absolute Frequency</option><option value="q">Q Factor</option><option value="depth">S11 Minimum</option><option value="uncertainty">Uncertainty</option><option value="temperature">Temperature</option><option value="pressure">Pressure</option></select>
      <div className="flex rounded border border-zinc-700 overflow-hidden">{[["points","Points"],["volume","Volume"],["isosurface","Isosurface"]].map(([k,l])=><button key={k} onClick={()=>setView({rendering:k})} className={`px-3 py-1.5 text-xs ${view.rendering===k?"bg-sky-600 text-white":"bg-zinc-900 text-zinc-400"}`}>{l}</button>)}</div>
      <div className="flex rounded border border-zinc-700 overflow-hidden">{[["raw","Raw"],["corrected","Corrected"],["residual","Residual"]].map(([k,l])=><button key={k} onClick={()=>setView({fieldMode:k})} className={`px-3 py-1.5 text-xs ${view.fieldMode===k?"bg-emerald-700 text-white":"bg-zinc-900 text-zinc-400"}`}>{l}</button>)}</div>
      <button onClick={()=>setView({compareEnabled:!view.compareEnabled})} className={`px-3 py-1.5 rounded border text-xs ${view.compareEnabled?"border-amber-400 bg-amber-950 text-amber-300":"border-zinc-700 bg-zinc-900 text-zinc-400"}`}>Compare</button>
      <span className="ml-auto rounded border border-zinc-700 bg-black px-2 py-1.5 text-[10px] font-mono text-zinc-300">{filtered.length} shown · {unique} unique · {coverage.toFixed(0)}% coverage</span>
    </div>
    {view.interpolation!=="none"&&<div className="rounded border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200"><AlertTriangle size={14} className="inline mr-2"/>Interpolated visualization. Values between recorded coordinates are model-estimated; faded regions have weaker measurement support.</div>}
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2 mb-2"><span className="text-xs font-bold uppercase text-zinc-300 flex items-center"><Orbit size={14} className="mr-2 text-sky-400"/>Interactive Spatial Volume</span><div className="flex gap-1">{[[35,24,"ISO"],[0,0,"X"],[90,0,"Z"],[0,90,"TOP"]].map(([yaw,pitch,l])=><button key={l} onClick={()=>setView({camera:{...view.camera,yaw,pitch}})} className="rounded bg-zinc-900 border border-zinc-700 px-2 py-1 text-[10px]">{l}</button>)}</div></div>
          <div className="relative h-[470px] overflow-hidden rounded border border-zinc-800 bg-[radial-gradient(circle_at_center,#101a28,#030507_70%)]">
            <svg viewBox="0 0 600 420" className="h-full w-full" onWheel={e=>{e.preventDefault();setView({camera:{...view.camera,zoom:clamp(view.camera.zoom+(e.deltaY<0?.1:-.1),.5,2)}})}}>
              <defs><filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
              <rect x="55" y="25" width="490" height="360" rx="8" fill="none" stroke="#334155" strokeDasharray="5 5"/>
              {[-30,-20,-10,0,10,20,30].map(v=><g key={v} opacity=".22"><line x1={300+v*5} y1="35" x2={300+v*5} y2="385" stroke="#38bdf8"/><line x1="65" y1={210-v*5} x2="535" y2={210-v*5} stroke="#38bdf8"/></g>)}
              <line x1="65" y1="210" x2="535" y2="210" stroke="#ef4444"/><line x1="300" y1="385" x2="300" y2="35" stroke="#22c55e"/><text x="540" y="205" fill="#ef4444" fontSize="11">X</text><text x="306" y="42" fill="#22c55e" fontSize="11">Y</text><text x="78" y="375" fill="#38bdf8" fontSize="11">Z</text>
              {(view.rendering!=="points"?field:[]).map((p,i)=>{const q=project(p);const c=spatialColor(p.value,colorMin,colorMax,view.colorScale);const opacity=clamp(1-p.distance/30,.06,.5);return <circle key={i} cx={q.sx} cy={q.sy} r={view.rendering==="isosurface"&&Math.abs(p.value-(colorMin+colorMax)/2)>(colorMax-colorMin)*.08?0:3.5} fill={c} opacity={opacity}/>})}
              {points.map(r=>{const p=project(r),c=spatialColor(valueOf(r),colorMin,colorMax,view.colorScale),sel=r.id===view.selectedId;return <g key={r.id} onClick={()=>setView({selectedId:r.id})} className="cursor-pointer"><circle cx={p.sx} cy={p.sy} r={sel?9:Math.max(4,7-(r.uncertaintyHz||0)*2)} fill={r.excluded?"none":c} stroke={r.excluded?"#71717a":r.valid?"#e4e4e7":"#f59e0b"} strokeWidth={sel?3:1.2} opacity={r.excluded?.35:.95} filter={sel?"url(#glow)":undefined}/>{view.showUncertainty&&<circle cx={p.sx} cy={p.sy} r={8+(r.uncertaintyHz||0)*8} fill="none" stroke={c} opacity=".3"/>}</g>})}
              <text x="75" y="50" fill="#94a3b8" fontSize="10">{view.projection.toUpperCase()} · yaw {view.camera.yaw}° · pitch {view.camera.pitch}° · zoom {view.camera.zoom.toFixed(1)}×</text>
            </svg>
            <div className="absolute bottom-3 left-3 right-3"><div className="h-2 rounded" style={{background:`linear-gradient(90deg,${spatialColor(colorMin,colorMin,colorMax,view.colorScale)},${spatialColor((colorMin+colorMax)/2,colorMin,colorMax,view.colorScale)},${spatialColor(colorMax,colorMin,colorMax,view.colorScale)})`}}/><div className="flex justify-between text-[10px] font-mono text-zinc-300"><span>{colorMin.toFixed(2)}</span><span>{metricLabel}</span><span>{colorMax.toFixed(2)}</span></div></div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs"><label>Yaw <input type="range" min="-180" max="180" value={view.camera.yaw} onChange={e=>setView({camera:{...view.camera,yaw:+e.target.value}})} className="w-full"/></label><label>Pitch <input type="range" min="-90" max="90" value={view.camera.pitch} onChange={e=>setView({camera:{...view.camera,pitch:+e.target.value}})} className="w-full"/></label><label>Zoom <input type="range" min=".5" max="2" step=".1" value={view.camera.zoom} onChange={e=>setView({camera:{...view.camera,zoom:+e.target.value}})} className="w-full"/></label></div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">{[["xy","z"],["xz","y"],["yz","x"]].map(([plane,axis])=><SlicePanel key={plane} plane={plane} axis={axis} data={sliceData(plane)} value={view.activeSlice[axis]} setValue={v=>setView({activeSlice:{...view.activeSlice,[axis]:v}})} min={colorMin} max={colorMax} palette={view.colorScale} select={id=>setView({selectedId:id})}/>)}</div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3"><div className="flex items-center gap-2"><button onClick={()=>setPlaying(!playing)} className="rounded bg-sky-700 px-3 py-1 text-xs">{playing?"Pause":"Play"}</button><input type="range" min="1" max={Math.max(1,allRecords.length)} value={Math.min(view.timelineIndex,Math.max(1,allRecords.length))} onChange={e=>setView({timelineIndex:+e.target.value})} className="flex-1"/><span className="text-xs font-mono text-zinc-400">{Math.min(view.timelineIndex,allRecords.length)}/{allRecords.length}</span></div><p className="mt-2 text-[10px] text-zinc-500">Replay measurement acquisition to identify scan-order and drift effects.</p></div>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-4 rounded border border-zinc-800 overflow-hidden">{["display","filters","analysis","plan"].map(t=><button key={t} onClick={()=>setTab(t)} className={`py-2 text-[10px] uppercase font-bold ${tab===t?"bg-sky-700":"bg-zinc-900 text-zinc-500"}`}>{t}</button>)}</div>
        {tab==="display"&&<div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-3 text-xs"><PanelTitle>Display & Model</PanelTitle><label>Reference<select value={view.referenceMode} onChange={e=>setView({referenceMode:e.target.value})} className="mt-1 w-full bg-black border border-zinc-700 rounded p-2"><option value="center">Center / nearest origin</option><option value="mean">Run mean</option><option value="base">Nominal base frequency</option></select></label><label>Interpolation<select value={view.interpolation} onChange={e=>setView({interpolation:e.target.value})} className="mt-1 w-full bg-black border border-zinc-700 rounded p-2"><option value="none">Measured only</option><option value="nearest">Nearest region</option><option value="idw">Inverse distance weighting</option></select></label><label>Palette<select value={view.colorScale} onChange={e=>setView({colorScale:e.target.value})} className="mt-1 w-full bg-black border border-zinc-700 rounded p-2"><option value="diverging">Diverging</option><option value="sequential">Sequential</option><option value="accessible">Color-vision safe</option><option value="mono">Monochrome</option></select></label><label>Quality preset<select value={view.qualityPreset} onChange={e=>setView({qualityPreset:e.target.value})} className="mt-1 w-full bg-black border border-zinc-700 rounded p-2"><option value="preview">Preview</option><option value="standard">Standard</option><option value="high">High</option></select></label>{[["showUncertainty","Uncertainty halos"],["showCoverage","Coverage layer"],["lockScale","Lock scale"],["symmetric","Symmetric zero scale"]].map(([k,l])=><label key={k} className="flex justify-between"><span>{l}</span><input type="checkbox" checked={view[k]} onChange={e=>setView({[k]:e.target.checked})}/></label>)}</div>}
        {tab==="filters"&&<div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-3 text-xs"><PanelTitle>Quality & ROI Filters</PanelTitle>{[["showValid","Show valid"],["showSuspect","Show suspect"],["showExcluded","Show excluded"],].map(([k,l])=><label key={k} className="flex justify-between"><span>{l}</span><input type="checkbox" checked={view[k]} onChange={e=>setView({[k]:e.target.checked})}/></label>)}<label className="flex justify-between border-t border-zinc-800 pt-2"><span>Enable ROI</span><input type="checkbox" checked={roi.enabled} onChange={e=>setView({roi:{...roi,enabled:e.target.checked}})}/></label>{["x","y","z"].map(a=><div key={a}><div className="uppercase text-zinc-500">{a} range (mm)</div><div className="grid grid-cols-2 gap-2"><input type="number" value={roi[a+"Min"]} onChange={e=>setView({roi:{...roi,[a+"Min"]:+e.target.value}})} className="bg-black border border-zinc-700 rounded p-1"/><input type="number" value={roi[a+"Max"]} onChange={e=>setView({roi:{...roi,[a+"Max"]:+e.target.value}})} className="bg-black border border-zinc-700 rounded p-1"/></div></div>)}</div>}
        {tab==="analysis"&&<div className="space-y-3"><div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs"><PanelTitle>ROI Statistics</PanelTitle><Stat label="Points" value={roiStats.n}/><Stat label="Mean" value={roiStats.mean.toFixed(3)}/><Stat label="Std dev" value={roiStats.sd.toFixed(3)}/><Stat label="Min / Max" value={`${roiStats.min.toFixed(2)} / ${roiStats.max.toFixed(2)}`}/></div><div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs"><PanelTitle>Interpolation Diagnostics</PanelTitle><Stat label="Unique coordinates" value={unique}/><Stat label="Median support" value={filtered.length?`${Math.min(35,35/Math.cbrt(filtered.length)).toFixed(1)} mm`:"—"}/><Stat label="LOO MAE" value={diagnostics.mae==null?"Need ≥4 points":diagnostics.mae.toFixed(3)}/><Stat label="LOO RMSE" value={diagnostics.rmse==null?"—":diagnostics.rmse.toFixed(3)}/><Stat label="Maximum error" value={diagnostics.max==null?"—":diagnostics.max.toFixed(3)}/></div>{view.compareEnabled&&<div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs"><PanelTitle>Comparison</PanelTitle><p className="text-zinc-400">The current dataset is split by acquisition sequence. Difference: {(meanOf(vals.slice(Math.floor(vals.length/2)))-meanOf(vals.slice(0,Math.floor(vals.length/2)))).toFixed(3)} {metricLabel}.</p></div>}</div>}
        {tab==="plan"&&<div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs space-y-2"><PanelTitle>Recommended Measurements</PanelTitle>{recommendations.map((r,i)=><div key={i} className="rounded border border-zinc-800 bg-zinc-900 p-2"><div className="font-mono text-sky-300">X {r.x} · Y {r.y} · Z {r.z}</div><div className="text-zinc-500">{r.reason}; nearest sample {r.score.toFixed(1)} mm</div><button onClick={()=>dispatch({type:"MOVE_STAGE",position:{x:r.x,y:r.y,z:r.z}})} className="mt-1 rounded bg-sky-800 px-2 py-1">Move stage</button></div>)}</div>}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs"><PanelTitle>Point Inspector</PanelTitle>{selected?<div className="space-y-1"><div className="font-mono text-sky-300">X {selected.x.toFixed(3)} · Y {selected.y.toFixed(3)} · Z {selected.z.toFixed(3)}</div><Stat label={metricLabel} value={valueOf(selected).toFixed(4)}/><Stat label="Resonance" value={`${selected.resonance.toFixed(3)} Hz`}/><Stat label="Uncertainty" value={`±${(selected.uncertaintyHz||0).toFixed(3)} Hz`}/><Stat label="Quality" value={selected.valid?"VALID":"SUSPECT"}/><textarea value={selected.note||""} onChange={e=>dispatch({type:"UPDATE_RECORD",id:selected.id,patch:{note:e.target.value}})} placeholder="Operator note" className="mt-2 w-full rounded border border-zinc-700 bg-black p-2"/><div className="flex gap-2 pt-1"><button onClick={()=>dispatch({type:"UPDATE_RECORD",id:selected.id,patch:{excluded:!selected.excluded,exclusionReason:!selected.excluded?"Operator exclusion":null}})} className="rounded border border-amber-600 px-2 py-1 text-amber-300">{selected.excluded?"Include":"Exclude"}</button><button onClick={()=>dispatch({type:"MOVE_STAGE",position:{x:selected.x,y:selected.y,z:selected.z}})} className="rounded bg-sky-800 px-2 py-1">Move stage</button></div></div>:<p className="text-zinc-500">Select a measured point in the volume or a slice.</p>}</div>
      </div>
    </div>
  </div>;
}
function PanelTitle({children}){return <div className="mb-2 border-b border-zinc-800 pb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{children}</div>}
function Stat({label,value}){return <div className="flex justify-between border-b border-zinc-900 py-1.5"><span className="text-zinc-500">{String(label)}</span><span className="font-mono text-zinc-200">{value}</span></div>}
function SlicePanel({plane,axis,data,value,setValue,min,max,palette,select}) {return <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2"><div className="flex justify-between text-[10px] font-bold uppercase text-zinc-400"><span>{plane.toUpperCase()} slice</span><span>{axis.toUpperCase()}={value} mm</span></div><svg viewBox="0 0 220 180" className="mt-2 h-40 w-full rounded bg-black/50"><rect x="20" y="10" width="180" height="150" fill="none" stroke="#334155"/>{data.map((p,i)=><circle key={i} onClick={()=>select(p.r.id)} cx={110+p.a*2.3} cy={85-p.b*2} r="5" fill={spatialColor(p.v,min,max,palette)} stroke={p.r.valid?"white":"#f59e0b"} className="cursor-pointer"/>)}<line x1="110" y1="10" x2="110" y2="160" stroke="#334155"/><line x1="20" y1="85" x2="200" y2="85" stroke="#334155"/></svg><input type="range" min="-35" max="35" step="5" value={value} onChange={e=>setValue(+e.target.value)} className="w-full"/><div className="text-center text-[9px] text-zinc-600">±5 mm slice thickness · {data.length} points</div></div>}

function Vna({ state, dispatch, sweep, f0, HelpInfo }) {
  const set = (domain, patch) => dispatch({ type: "PATCH", domain, patch });
  const trace = state.vna.trace;
  const min = trace.length ? trace.reduce((a,b)=>a.s11 < b.s11 ? a : b) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center">Keysight E5080B VNA Hardware Front Panel <HelpInfo termKey="vna" /></h1>
          <p className="mt-1 text-sm text-zinc-400">Photorealistic vector network analyzer simulation featuring touchscreen display, softkeys, and physical port connectors.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={sweep} disabled={!state.vna.power} className="rounded border border-sky-500 bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-40">Trigger Sweep</button>
          <button onClick={() => dispatch({ type: "CAPTURE_REFERENCE" })} disabled={!trace.length} className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-700">Capture Ref</button>
          <button onClick={() => set("ui", { calModalOpen: true })} disabled={!state.vna.power} className="rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-700">Calibrate Wizard</button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_.8fr]">
        <div className="rounded-xl border-4 border-zinc-700 bg-gradient-to-b from-zinc-800 to-zinc-950 p-4 shadow-2xl">
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
            <div className="h-[320px]">
              <ResponsiveContainer>
                <LineChart data={trace}>
                  <CartesianGrid stroke="#242832" strokeDasharray="2 4" />
                  <XAxis dataKey="freq" tickFormatter={v => `${(v/1000).toFixed(2)}k`} stroke="#737985" fontSize={10} />
                  <YAxis dataKey="s11" domain={[-35, 2]} stroke="#737985" fontSize={10} />
                  <Tooltip contentStyle={{background:"#111318",border:"1px solid #3f4654"}} labelFormatter={v=>`${Number(v).toFixed(3)} Hz`} />
                  <Line dataKey="s11" stroke="#50c6ff" dot={false} strokeWidth={2} />
                  <Line dataKey="fit" stroke="#f59e0b" dot={false} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>
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
      <span className="text-zinc-500">{String(label)}</span>
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
        <div className="rounded-xl border-4 border-zinc-700 bg-gradient-to-b from-zinc-800 to-zinc-950 p-4 shadow-2xl">
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
            <div className="h-[280px]">
              <ResponsiveContainer>
                <AreaChart data={data}>
                  <CartesianGrid stroke="#242832" strokeDasharray="2 4" />
                  <XAxis dataKey="f" tickFormatter={v=>`${v.toFixed(1)}k`} stroke="#737985" fontSize={10}/>
                  <YAxis stroke="#737985" fontSize={10}/>
                  <Tooltip contentStyle={{background:"#111318",border:"1px solid #3f4654"}}/>
                  <Area dataKey="a" stroke="#d946ef" fill="#d946ef" fillOpacity={.25}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
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
        <div className="rounded-xl border-4 border-zinc-700 bg-gradient-to-b from-zinc-800 to-zinc-950 p-4 shadow-2xl">
          <div className="flex justify-between items-center mb-3 border-b border-zinc-700 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_2px_rgba(245,158,11,0.7)]" />
              <span className="font-bold text-xs tracking-wider text-zinc-200 flex items-center">TEKTRONIX 5 SERIES MSO MIXED SIGNAL OSCILLOSCOPE <HelpInfo termKey="scope" /></span>
            </div>
            <span className="text-[10px] font-mono text-amber-400">1 GHz · 12-BIT ADC</span>
          </div>

          <div className="rounded border-2 border-zinc-600 bg-black p-3 shadow-inner">
            <div className="text-xs font-bold uppercase text-zinc-300 border-b border-zinc-800 pb-2 mb-3">CH1 · Analog Acquisition (Time Domain)</div>
            <div className="h-[280px]">
              <ResponsiveContainer>
                <LineChart data={state.scope.trace}>
                  <CartesianGrid stroke="#242832" strokeDasharray="2 4"/>
                  <XAxis dataKey="t" stroke="#737985" fontSize={10}/>
                  <YAxis domain={[-1.5,1.5]} stroke="#737985" fontSize={10}/>
                  <Tooltip contentStyle={{background:"#111318",border:"1px solid #3f4654"}}/>
                  <Line dataKey="value" stroke="#f6d32d" dot={false} strokeWidth={1.5}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
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
                )) : <tr><td colSpan={5} className="p-8 text-center text-zinc-500">No recorded measurements. Start a run and trigger sweeps.</td></tr>}
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
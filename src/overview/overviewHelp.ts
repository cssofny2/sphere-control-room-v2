// Plain-language help for every term, item and feature on the Lab Overview page.
// Keys are namespaced with "ov." so they never collide with the older GLOSSARY keys.
// `glossary` optionally points at a GLOSSARY entry whose technical text is shown
// under "Technical detail" in the help dialog.

export type HelpEntry = {
  title: string;
  desc: string; // plain-English explanation
  why?: string; // why it matters
  tip?: string; // something to try in the simulator
  related?: string[]; // other help keys
  glossary?: string; // key into the app's GLOSSARY
};

export type ResolvedHelp = HelpEntry & { key: string; tech?: string };

export const OVERVIEW_HELP: Record<string, HelpEntry> = {
  /* ───────── The page and its controls ───────── */
  "ov.overview": {
    title: "Living Lab Overview",
    desc: "A map of the whole simulated laboratory on one screen. Every box is a piece of equipment, every line is something travelling between them (a timing signal, a radio signal, laser light, data or air), and the colours show what each piece is doing right now.",
    why: "It is the quickest way to see what is ready, what is busy and what is broken before you start a measurement.",
    tip: "Click any box to inspect it. Use the checklist lower down to see what is still missing before you can take good data.",
    related: ["ov.equipment", "ov.state", "ov.readiness"],
  },
  "ov.equipment": {
    title: "Equipment",
    desc: "The instruments and machines in the lab: a clock, a network analyzer, an oscilloscope, a laser vibrometer, a vacuum chamber with a moving stage, pumps, a computer and the power and shielding around them.",
    why: "A good measurement needs all of them working together, so the overview shows them side by side.",
    related: ["ov.overview", "ov.state"],
  },
  "ov.state": {
    title: "State (operating state)",
    desc: "A one-word label for what a piece of equipment is doing right now, such as Offline, Ready, Active or Fault. Each state has its own colour and symbol so you can read the whole lab at a glance.",
    why: "Colour and symbol are used together so the page still makes sense if you cannot tell some colours apart.",
    related: ["ov.status_key", "ov.state_fault", "ov.state_active"],
  },
  "ov.signals": {
    title: "Signals",
    desc: "Information carried between instruments, for example a steady timing pulse from the clock or a radio-frequency test signal sent to the sample. They are drawn as coloured lines.",
    related: ["ov.route_clock", "ov.route_rf"],
  },
  "ov.vacuum_flow": {
    title: "Vacuum flow",
    desc: "Air being pulled out of the chamber by the pumps. A line is drawn from the chamber to the pumps while they are running.",
    why: "Taking the air out removes noise and temperature swings that would blur the measurement.",
    related: ["ov.route_vacuum", "ov.pumps"],
  },
  "ov.data_flow": {
    title: "Data",
    desc: "Measurement results travelling from the instruments to the computer that records them, and then on to the quality check.",
    related: ["ov.route_data", "ov.workstation"],
  },
  "ov.live_model": {
    title: "Live simulation model",
    desc: "A single running simulation that every page of the lab reads from. If you change something on the VNA page, this overview updates immediately, because they are looking at the same model.",
    why: "Nothing here is a real measurement. It is a safe practice version of the lab.",
  },
  "ov.view_modes": {
    title: "View mode",
    desc: "Choose how the lab map is drawn: flat like a diagram, tilted like a table seen from above at an angle, or Orbit, where you can drag to turn the map yourself.",
    why: "Tilted views make the depth of the boxes easier to see. Flat is easiest for reading small text.",
    related: ["ov.view_flat", "ov.view_tilt", "ov.view_orbit", "ov.reset_view"],
  },
  "ov.view_flat": {
    title: "Flat view",
    desc: "Draws the lab map straight on with no tilt, like a normal diagram.",
  },
  "ov.view_tilt": {
    title: "Tilted view",
    desc: "Leans the map back a little so the boxes look like solid blocks standing on a table.",
  },
  "ov.view_orbit": {
    title: "Orbit view",
    desc: "Lets you turn the map yourself. Click and drag on the map to swing it left, right, up or down.",
    tip: "Double-click the map, or press Reset view, to bring it back.",
    related: ["ov.reset_view"],
  },
  "ov.reset_view": {
    title: "Reset view",
    desc: "Puts the map back to the normal tilt and clears any filters or hidden lines you set.",
  },
  "ov.layers": {
    title: "Show or hide lines",
    desc: "Each kind of line on the map can be switched on or off. Hiding the ones you do not care about makes the picture simpler.",
    related: ["ov.route_clock", "ov.route_rf", "ov.route_laser", "ov.route_data", "ov.route_vacuum"],
  },
  "ov.problems_only": {
    title: "Problems only",
    desc: "Fades every box that is working normally so the ones with a warning or fault stand out.",
    why: "Handy when something looks wrong and you want to find it quickly.",
  },
  "ov.help_icons": {
    title: "Help icons",
    desc: "These small question marks. Turn them off if you know the lab well and want a cleaner screen; turn them back on at any time.",
  },
  "ov.help_index": {
    title: "Help index",
    desc: "A searchable list of every term explained on this page. Type a word, then click a result to read its explanation.",
  },
  "ov.map": {
    title: "Lab map",
    desc: "The main picture. Boxes are equipment, lines show what is flowing between them, and the small question marks explain each line and term.",
    tip: "Click a box to see its details on the right. Press the arrow on a box to open that instrument's own page.",
  },
  "ov.open_page": {
    title: "Open page",
    desc: "Goes to the full page for this piece of equipment, where you can change its settings.",
  },

  /* ───────── Summary tiles ───────── */
  "ov.kpi_readiness": {
    title: "Readiness",
    desc: "How many of the ten ready-to-measure checks are currently passing. When all ten pass, the lab is set up for a trustworthy measurement.",
    related: ["ov.readiness"],
  },
  "ov.kpi_online": {
    title: "Instruments powered",
    desc: "How many of the four main instruments (clock, VNA, oscilloscope and laser vibrometer) are switched on.",
    why: "An instrument that is off cannot take part in a measurement.",
  },
  "ov.kpi_alarms": {
    title: "Open alarms",
    desc: "Warnings and faults the lab has raised that nobody has acknowledged yet. Critical ones mean something is stopping the lab from working properly.",
    related: ["ov.alarms", "ov.severity", "ov.ack"],
  },
  "ov.kpi_clock": {
    title: "Reference clock",
    desc: "Whether the lab's master clock is ready. The clock needs a short warm-up and then locks onto a very steady beat that the other instruments follow.",
    related: ["ov.clock", "ov.lock", "ov.warmup"],
  },
  "ov.kpi_vacuum": {
    title: "Vacuum level",
    desc: "How much air is left in the chamber. Lower numbers mean emptier. The arrow shows if pressure is rising, falling or steady.",
    related: ["ov.pressure", "ov.torr"],
  },
  "ov.kpi_temp": {
    title: "Chamber temperature",
    desc: "The temperature inside the chamber, and how far it is from the target. A small difference means the chamber has settled.",
    related: ["ov.temperature", "ov.setpoint"],
  },
  "ov.kpi_stage": {
    title: "Stage position",
    desc: "Where the platform holding the sample is right now, given as three distances (X, Y, Z) from the centre.",
    related: ["ov.xyz", "ov.mm", "ov.stage"],
  },
  "ov.kpi_quality": {
    title: "Data quality",
    desc: "An overall verdict on the measurements you have recorded so far, based on the checks the lab runs on each point.",
    related: ["ov.quality", "ov.accepted", "ov.suspect", "ov.failed"],
  },
  "ov.kpi_sim": {
    title: "Simulation clock",
    desc: "How many simulated seconds have passed since the power was turned on, and how fast the simulation is running compared with real time.",
    related: ["ov.sim_time", "ov.sim_speed"],
  },

  /* ───────── Equipment ───────── */
  "ov.clock": {
    title: "10 MHz Reference clock",
    desc: "The lab's master clock. It produces one very steady beat, ten million times a second, and sends it to the other instruments so they all keep exactly the same time.",
    why: "If instruments disagree about time even slightly, the measured frequency drifts and the results cannot be trusted.",
    related: ["ov.lock", "ov.warmup", "ov.ref10"],
    glossary: "clock",
  },
  "ov.vna": {
    title: "E5080B VNA",
    desc: "A Vector Network Analyzer. It sends a gentle radio signal at the sample and measures how much comes back at each frequency. The sample absorbs the signal strongly at its resonance, which shows up as a dip in the plot.",
    why: "Finding the exact frequency of that dip is the main measurement of the whole experiment.",
    related: ["ov.rf", "ov.calibration", "ov.s11"],
    glossary: "vna",
  },
  "ov.scope": {
    title: "Oscilloscope",
    desc: "A screen that draws electrical signals as wiggly lines over time. In this lab it is used to watch raw signals and to check how noisy the surroundings are.",
    related: ["ov.running", "ov.timebase", "ov.channels"],
    glossary: "scope",
  },
  "ov.ldv": {
    title: "LDV Optical head",
    desc: "A Laser Doppler Vibrometer. It shines a laser at the sample and reads the tiny change in the reflected light to measure how much the surface is vibrating, without touching it.",
    why: "Touching the sample would change how it vibrates, so a beam of light is used instead.",
    related: ["ov.shutter", "ov.return_signal"],
    glossary: "ldv",
  },
  "ov.chamber": {
    title: "Thermal-Vac chamber",
    desc: "A sealed box that holds the sample. Air can be pumped out (vacuum) and the temperature can be held steady, so outside conditions do not disturb the measurement.",
    why: "Air and temperature changes shift the sample's resonance. Controlling them keeps the results clean.",
    related: ["ov.pressure", "ov.temperature", "ov.door"],
    glossary: "chamber",
  },
  "ov.stage": {
    title: "XYZ Stage and sample",
    desc: "A small motorised platform inside the chamber that carries the sample. It moves left-right (X), front-back (Y) and up-down (Z) in tiny, precise steps.",
    why: "The experiment asks whether the sample's position changes what you measure, so the stage has to move accurately.",
    related: ["ov.xyz", "ov.homed", "ov.settling"],
    glossary: "location_variable",
  },
  "ov.pumps": {
    title: "Vacuum pumps",
    desc: "Two pumps work in turn to remove air from the chamber. The roughing pump removes most of it, then the turbo pump takes over to get a much deeper vacuum.",
    related: ["ov.roughing", "ov.turbo", "ov.pump_phase"],
  },
  "ov.workstation": {
    title: "Acquisition workstation",
    desc: "The computer that runs scans, collects the instrument readings and stores every measurement as a record.",
    related: ["ov.run", "ov.records", "ov.scan_status"],
  },
  "ov.facility": {
    title: "Power and shielding",
    desc: "The lab's main power switch plus the protection wrapped around the experiment: a metal shield that blocks radio noise and a floating table that blocks floor vibration.",
    related: ["ov.breaker", "ov.faraday", "ov.isolation"],
  },
  "ov.quality": {
    title: "Data quality check",
    desc: "A set of automatic checks that look at each recorded point and label it Accepted, Suspect or Failed.",
    why: "It stops you from trusting a measurement that was taken while something in the lab was not right.",
    related: ["ov.accepted", "ov.suspect", "ov.failed"],
  },

  /* ───────── Words used inside the equipment boxes ───────── */
  "ov.lock": {
    title: "Lock",
    desc: "The clock is 'locked' when its beat has settled and is steady enough to trust. Until then the other instruments should not rely on it.",
    related: ["ov.warmup", "ov.holdover"],
  },
  "ov.warmup": {
    title: "Warm-up",
    desc: "The clock needs a short time after power-on to reach its working temperature. This is how far through that wait it is. In the simulator it takes about 15 simulated seconds.",
  },
  "ov.holdover": {
    title: "Holdover",
    desc: "A fallback mode: the clock has lost its outside guide and is keeping time on its own. It still works, but it may slowly drift.",
  },
  "ov.ref10": {
    title: "10 MHz reference",
    desc: "MHz means 'million beats per second'. So this is a steady beat of ten million per second that every instrument uses as its stopwatch.",
  },
  "ov.rf": {
    title: "RF output",
    desc: "RF stands for radio frequency. When this is ON, the VNA is sending its test signal toward the sample. When it is OFF, nothing is sent and no trace can be drawn.",
    tip: "Turn it on from the VNA page.",
    related: ["ov.s11"],
  },
  "ov.calibration": {
    title: "Calibration",
    desc: "A short routine that teaches the VNA to ignore the errors of its own cables and connectors. Without it, the readings include those errors.",
    why: "An uncalibrated VNA can give a believable-looking result that is slightly wrong.",
    tip: "Run it from the VNA page. It goes stale after about an hour.",
  },
  "ov.s11": {
    title: "S11 (reflection)",
    desc: "A measure of how much of the signal bounces back from the sample. A deep dip means the sample is soaking up the signal at that frequency, which is the sign of resonance.",
    glossary: "s11",
  },
  "ov.center_freq": {
    title: "Center frequency",
    desc: "The middle of the frequency range the VNA is scanning. 'kHz' means thousands of cycles per second. The resonance should sit near this value.",
    glossary: "center_freq",
  },
  "ov.running": {
    title: "Acquisition (run or stop)",
    desc: "RUN means the oscilloscope is continuously redrawing the signal. STOP freezes the picture so you can study it.",
  },
  "ov.timebase": {
    title: "Timebase",
    desc: "How much time each horizontal square on the oscilloscope screen stands for. 'µs/div' means millionths of a second per square.",
    glossary: "timebase",
  },
  "ov.channels": {
    title: "Channels",
    desc: "The oscilloscope can watch up to four signals at once. Each one is a channel. This shows how many are switched on.",
  },
  "ov.shutter": {
    title: "Shutter",
    desc: "A safety door in front of the laser. CLOSED means no light leaves the instrument. OPEN means the laser is shining at the sample.",
    why: "Keeping it closed when you are not measuring is safer and avoids needless heating.",
    glossary: "shutter",
  },
  "ov.return_signal": {
    title: "Return signal",
    desc: "How much of the laser light bounces back into the instrument. Strong return means a clear reading; weak return means the beam is poorly aimed or the setup is shaky.",
    tip: "Watch it drop if the stage moves far from centre or vibration isolation is turned off.",
  },
  "ov.optical_quality": {
    title: "Optical quality",
    desc: "A score for how good the laser measurement conditions are. Misalignment and vibration lower it.",
  },
  "ov.pressure": {
    title: "Pressure",
    desc: "How hard the air inside the chamber is pushing. Normal room air is about 760 Torr. A vacuum has far less. Numbers like 1.0e-3 mean 0.001.",
    related: ["ov.torr"],
  },
  "ov.torr": {
    title: "Torr",
    desc: "A unit for measuring air pressure. 760 Torr is the pressure of ordinary air at sea level. The smaller the number, the more air has been removed.",
  },
  "ov.temperature": {
    title: "Temperature",
    desc: "The current temperature inside the chamber in degrees Celsius. The brackets show how far it is above (+) or below (−) the target.",
    related: ["ov.setpoint"],
  },
  "ov.setpoint": {
    title: "Setpoint",
    desc: "The temperature you asked the chamber to hold. The heater and cooler keep nudging the chamber toward it.",
    glossary: "thermostat",
  },
  "ov.door": {
    title: "Chamber door",
    desc: "Whether the chamber door is open. It must be closed before the pumps can work, and opening it lets air back in.",
  },
  "ov.faraday": {
    title: "Shielding (Faraday cage)",
    desc: "A grounded metal shell around the experiment that blocks stray radio and electrical noise from outside. ON is normal; OFF lets noise in.",
    glossary: "faraday_cage",
  },
  "ov.isolation": {
    title: "Vibration isolation",
    desc: "Air-cushioned legs that stop floor vibrations (footsteps, passing trucks) from reaching the table the experiment sits on. ON is normal.",
    glossary: "vibration_platform",
  },
  "ov.xyz": {
    title: "XYZ position",
    desc: "Three numbers that say where the sample is: X is left-right, Y is front-back and Z is up-down. 0 / 0 / 0 is the centre.",
  },
  "ov.mm": {
    title: "mm (millimetres)",
    desc: "A thousandth of a metre. About the thickness of a credit card is one millimetre. The stage can travel up to 35 mm either way from the centre.",
  },
  "ov.homed": {
    title: "Homed",
    desc: "Homing sends the stage to its known starting position so the lab knows exactly where it is. A stage that is not homed may be somewhere unexpected.",
    tip: "Press Home on the stage controls, or use the quick action in the inspector.",
  },
  "ov.settling": {
    title: "Settling",
    desc: "After the stage moves it needs a moment for tiny wobbles to die away. Measuring before it has settled gives noisy data.",
  },
  "ov.roughing": {
    title: "Roughing pump",
    desc: "The first pump. It removes most of the air, taking the chamber from normal air down to a rough vacuum. The percentage is how fast it is spinning.",
    glossary: "roughing_pump",
  },
  "ov.turbo": {
    title: "Turbo pump",
    desc: "The second pump, a very fast spinning fan that flicks leftover air molecules out. It can only start once the roughing pump has done its job. The percentage is its spin speed.",
    glossary: "turbo_pump",
  },
  "ov.pump_phase": {
    title: "Pump phase",
    desc: "Which stage of pumping the system is in, for example 'vented' (open to air) or pumping down.",
  },
  "ov.run": {
    title: "Run",
    desc: "A run is one complete measurement session. IDLE means none is in progress. While one is active it shows the run's ID.",
  },
  "ov.records": {
    title: "Records",
    desc: "How many individual measurements have been saved so far. Each record holds a position, a frequency and quality notes.",
  },
  "ov.scan_status": {
    title: "Scan status",
    desc: "A short message from the automatic scan, such as Ready, Paused or the step it is on.",
  },
  "ov.scan_progress": {
    title: "Scan progress",
    desc: "How far through the automatic scan of positions the lab is.",
  },
  "ov.breaker": {
    title: "Main breaker",
    desc: "The big power switch for the whole lab. ON gives everything power. Turning it OFF resets all the equipment, like cutting the power in a real lab.",
    tip: "Use the Power button at the top right of the screen.",
  },
  "ov.sim_speed": {
    title: "Simulation speed",
    desc: "How fast simulated time runs compared with real time. 1× is real time; higher numbers make waiting steps, like warm-up and pump-down, go by faster.",
  },
  "ov.sim_time": {
    title: "Simulated seconds",
    desc: "The number of simulated seconds since the power was switched on. It stops counting when the power is off.",
  },
  "ov.accepted": {
    title: "Accepted points",
    desc: "Measurements that passed every quality check and are safe to use.",
  },
  "ov.suspect": {
    title: "Suspect points",
    desc: "Measurements that passed some checks but not all. They may be usable, but look at them carefully before trusting them.",
  },
  "ov.failed": {
    title: "Failed points",
    desc: "Measurements that broke an important rule (for example, the clock was not locked). Treat these as unusable and retake them.",
  },

  /* ───────── Status words ───────── */
  "ov.status_key": {
    title: "Status key",
    desc: "A reference list of every state a piece of equipment can show, with its symbol and colour.",
    related: ["ov.state"],
  },
  "ov.state_offline": { title: "Offline", desc: "Switched off or without power. Nothing is happening." },
  "ov.state_standby": { title: "Standby", desc: "Powered and waiting. It is not doing anything yet, but it is not broken." },
  "ov.state_ready": { title: "Ready", desc: "Powered up and set up correctly, ready for you to use." },
  "ov.state_active": { title: "Active", desc: "Working right now: for example sending a signal, pumping or taking a measurement." },
  "ov.state_valid": { title: "Stable / Valid", desc: "Working and meeting every requirement for a good measurement." },
  "ov.state_stable": { title: "Stable", desc: "Settled and steady. Nothing is drifting." },
  "ov.state_warning": {
    title: "Warning",
    desc: "Something is not ideal, such as a missing calibration or a door left open. It still runs, but results may suffer.",
    why: "Fix warnings before you record data you plan to trust.",
  },
  "ov.state_fault": {
    title: "Fault",
    desc: "Something is wrong enough to stop or ruin the measurement, such as a cable fault or a vacuum leak.",
    tip: "Click the box to read the related alarm, then open its page to fix it.",
  },
  "ov.state_booting": { title: "Booting", desc: "Starting up. Give it a moment before relying on it." },
  "ov.state_settling": { title: "Settling", desc: "Just moved or changed. Waiting for small wobbles to fade away." },
  "ov.state_maintenance": { title: "Maintenance", desc: "Needs attention before normal use, for example a stage that has not been homed yet." },
  "ov.state_selected": { title: "Selected", desc: "The box you clicked. Its details appear in the inspector." },

  /* ───────── Lines on the map ───────── */
  "ov.route_clock": {
    title: "Clock line (10 MHz)",
    desc: "The timing beat travelling from the reference clock to the VNA, oscilloscope and laser vibrometer. It lights up once the clock is locked and the receiving instrument is on.",
    related: ["ov.clock", "ov.lock"],
  },
  "ov.route_rf": {
    title: "RF line",
    desc: "The radio test signal going from the VNA into the chamber, and the reflected signal coming back. It lights up when the VNA is on and its RF output is ON.",
    related: ["ov.rf", "ov.vna"],
  },
  "ov.route_laser": {
    title: "Laser line",
    desc: "The laser beam going from the optical head to the sample. It lights up when the vibrometer is on and its shutter is open.",
    related: ["ov.shutter", "ov.ldv"],
  },
  "ov.route_laser_return": {
    title: "Laser return line",
    desc: "Light bouncing off the sample and back into the optical head. This returning light carries the vibration information.",
    related: ["ov.return_signal"],
  },
  "ov.route_data": {
    title: "Data line",
    desc: "Measurement results flowing to the workstation and on to the quality check. It lights up during a run or whenever a VNA trace exists.",
    related: ["ov.workstation", "ov.quality"],
  },
  "ov.route_vacuum": {
    title: "Vacuum line",
    desc: "Air being drawn out of the chamber into the pumps. It lights up while the roughing or turbo pump is running.",
    related: ["ov.pumps", "ov.pressure"],
  },
  "ov.route_fault": {
    title: "Fault line (red)",
    desc: "A line turns red when an alarm mentions that kind of connection, meaning something on it is broken, for example a cable fault on the clock line.",
    related: ["ov.state_fault"],
  },

  /* ───────── Inspector ───────── */
  "ov.inspector": {
    title: "Inspector",
    desc: "A detail panel for the box you clicked. It shows live readings, what it is connected to, alarms that mention it, and shortcuts.",
  },
  "ov.live_readings": {
    title: "Live readings",
    desc: "The current numbers from this piece of equipment. They update continuously while the simulation runs.",
  },
  "ov.connections": {
    title: "Connections",
    desc: "The lines that start or end at this equipment, and whether each one is currently carrying something.",
  },
  "ov.related_alarms": {
    title: "Related alarms",
    desc: "Open alarms whose message mentions this equipment.",
    related: ["ov.alarms"],
  },
  "ov.line_active": { title: "Active line", desc: "Something is flowing along this line right now." },
  "ov.line_idle": { title: "Idle line", desc: "The line is available but nothing is flowing yet." },
  "ov.home_stage": {
    title: "Home stage",
    desc: "Sends the stage back to its starting position (0, 0, 0) and re-learns where it is.",
    related: ["ov.homed"],
  },

  /* ───────── Checklist ───────── */
  "ov.readiness": {
    title: "Ready-to-measure checklist",
    desc: "Ten things that should all be true before a measurement can be trusted. A tick means it is OK; a circle means it still needs work. Each item has a button that takes you to the right page.",
    why: "Most bad measurements come from skipping one of these. The checklist is a quick pre-flight check.",
    related: ["ov.kpi_readiness"],
  },
  "ov.chk_breaker": { title: "Main power is on", desc: "The main breaker must be closed for anything to work.", related: ["ov.breaker"] },
  "ov.chk_clock": { title: "Reference clock is locked", desc: "Wait for the clock to finish warming up and lock so every instrument shares the same timing.", related: ["ov.lock"] },
  "ov.chk_shield": { title: "Shielding is on", desc: "The metal shield should be on so outside radio noise does not leak into the measurement.", related: ["ov.faraday"] },
  "ov.chk_isolation": { title: "Vibration isolation is on", desc: "The air-cushioned table legs should be on so floor shakes do not reach the sample.", related: ["ov.isolation"] },
  "ov.chk_door": { title: "Chamber door is closed", desc: "The door must be shut so the chamber can be pumped down and held at temperature.", related: ["ov.door"] },
  "ov.chk_vacuum": {
    title: "Deep vacuum reached",
    desc: "The pressure needs to fall below 0.001 Torr. Start the roughing pump, then the turbo pump, and wait.",
    related: ["ov.pressure", "ov.roughing", "ov.turbo"],
  },
  "ov.chk_temp": {
    title: "Temperature is steady",
    desc: "The chamber should be within 0.03 °C of its target so that temperature is not slowly shifting the result.",
    related: ["ov.temperature", "ov.setpoint"],
  },
  "ov.chk_vna": {
    title: "VNA is on, transmitting and calibrated",
    desc: "The VNA must be powered, have its RF output on, and have a fresh calibration so its numbers can be trusted.",
    related: ["ov.rf", "ov.calibration"],
  },
  "ov.chk_ldv": {
    title: "Laser vibrometer is on with shutter open",
    desc: "The laser head needs power and an open shutter to read the sample's vibration.",
    related: ["ov.shutter"],
  },
  "ov.chk_stage": {
    title: "Stage is homed and still",
    desc: "The stage should know its position (homed) and not be moving or wobbling.",
    related: ["ov.homed", "ov.settling"],
  },
  "ov.fix_it": { title: "Fix it", desc: "Jumps to the page where you can fix this item." },

  /* ───────── Alarms and events ───────── */
  "ov.alarms": {
    title: "Alarms",
    desc: "Messages the lab raises when something needs your attention. Each has a time, a severity and an Acknowledge button.",
    related: ["ov.severity", "ov.ack"],
  },
  "ov.severity": {
    title: "Severity",
    desc: "How serious an alarm is. 'Critical' means the lab cannot work properly. 'Warning' means something is off but the lab still runs.",
  },
  "ov.ack": {
    title: "Acknowledge",
    desc: "Tells the lab you have seen the alarm. It moves out of the open list but stays in the history. It does not fix the problem by itself.",
  },
  "ov.events": {
    title: "Recent events",
    desc: "A running diary of what has happened in the lab, newest first: switches flipped, pumps started, scans finished.",
    related: ["ov.level", "ov.subsystem"],
  },
  "ov.level": {
    title: "Event level",
    desc: "How important an event is. 'Info' is a normal happening, 'warning' needs a look, and 'error' or 'critical' means something went wrong.",
  },
  "ov.subsystem": {
    title: "Subsystem",
    desc: "The part of the lab an event came from, such as VNA, CHAMBER or SYSTEM.",
  },
  "ov.event_filter": {
    title: "Event filter",
    desc: "Choose which kinds of events to show: everything, or only warnings and problems.",
  },

  /* ───────── Table ───────── */
  "ov.table": {
    title: "Equipment at a glance",
    desc: "The same equipment as the map, as a simple list with each item's state and its main reading. Easier to scan on a small screen.",
  },
  "ov.sort": {
    title: "Sort",
    desc: "Changes the order of the list: by lab order, by state with problems first, or by name.",
  },
  "ov.main_reading": { title: "Main reading", desc: "The single most useful number or word for that piece of equipment." },
};

export const HELP_KEYS = Object.keys(OVERVIEW_HELP);

export function getHelp(key: string): HelpEntry {
  return (
    OVERVIEW_HELP[key] || {
      title: key,
      desc: "No explanation has been written for this item yet.",
    }
  );
}

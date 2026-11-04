## What is S.P.H.E.R.E.
Keywords: sphere, project, purpose, goal, hypothesis, location variable, what is this
S.P.H.E.R.E. stands for Standardized Precision Housing for Experimental Resonance Evaluation. It is a tightly controlled environment built to isolate the variables that affect resonant measurements. The simulated lab measures how a test sphere's resonance changes when its position (X, Y, Z) inside the chamber changes.

## The location-variable hypothesis
Keywords: location variable, hypothesis, position, resonance shift, coordinates, why move the stage
The core hypothesis is that a test object's spatial coordinates inside a defined environment systematically change its measured physical properties, such as resonant frequency. To test that, the stage moves the sphere to many known positions and the network analyzer records the resonance at each one. Temperature, pressure, RF noise, vibration and clock drift are controlled or modelled so that any remaining shift can be tied to position.

## What equipment is in the lab
Keywords: equipment, instruments, rack, what do we have, list, hardware
The lab has: a Rubidium atomic clock (SRS FS725) giving a 10 MHz reference; a Keysight E5080B vector network analyzer (VNA); a Polytec PSV-500 scanning laser Doppler vibrometer (LDV); a Tektronix 5 Series mixed-signal oscilloscope; a thermal-vacuum chamber with a Faraday cage and active vibration isolation; a precision XYZ stage inside the chamber; a roughing pump and a turbomolecular pump; an active thermostat; and the control computer (workstation) that runs scans.

## Main screens of the app
Keywords: screens, navigation, tabs, panels, where is, find, dashboard, overview
The app has a dashboard, a Lab Overview map with a 3D Chamber and Stage view and an Engineering model, instrument panels (clock, chamber, VNA, LDV, scope), Experiment Runs for scans, a Spatial Field Explorer for results, a validation checklist, a fault simulator, a notebook, an event log, a glossary and a manual. The command palette lists quick actions.

## Operating modes
Keywords: mode, training, facility mode, simulation speed
The facility has an operating mode (training by default) and a simulation speed multiplier. Seeded noise is on by default so repeats are reproducible.

## Operator profile and logs
Keywords: my name, operator, initials, nickname, who am I, logs, journal stamp
The operator can type a name, nickname and initials into the Operator on duty card (top of the Operator Console, or the person button in the header). Initials, the real date and the time are written into every journal entry, alarm, notebook note and export. The profile is stored only in this browser. Dr. Wire can greet the operator by nickname.

## Live operation window
Keywords: live operation, animation window, what did that do, explain action
An always-visible floating window animates every action as it happens (a switch, a pump, a stage move), highlights the equipment involved on a live lab diagram, and explains in plain English what it does and what to watch for next. It can be dragged and minimised.

## Alert words
Keywords: running, stuck, error, needs attention, alert, animated
Each part of the simulator shows one of four animated alert words. Running: it is working. Stuck: it started something that cannot continue until a blocker is fixed, for example pumping with the door open or a scope waiting for a trigger. Error: a fault or critical alarm. Needs attention: it works but should be checked, for example the Faraday cage is off or the VNA is not calibrated.

## LDV Scanner scenarios
Keywords: ldv, laser vibrometer, 3d scan, acquire, mode shape, scan results, noise floor, ring-down, alignment
The Acquire 3D Scan button steers the laser spot over the sphere and measures each point. Results appear in the Scan results panel on the LDV page with a rotating 3D sphere, surface map and numbers. Scenarios: surface mode map, single-point spectrum, noise-floor check, location sweep, ring-down (damping) and alignment map. Weak optical return, isolation off, air in the chamber or a 100 kHz decoder filter make the result poor.

## Oscilloscope scenarios
Keywords: oscilloscope, scope, trigger, fft, probe, hum, 60 hz, clock check
The scope has four channels, each wired to one real signal: RF monitor, LDV output, 10 MHz clock, room probe, table accelerometer or stage servo. It runs a self-test when powered on. Guided scenarios: confirm the RF drive, check the 10 MHz reference, hunt 60 Hz interference, check vibration isolation, read pump signatures, check the LDV chain, trigger practice and catching a stage move.

## 3D Chamber views
Keywords: camera preset, viewing mode, engineering model, realistic lab, inside chamber
The Engineering model is the default 3D view. The Realistic lab is a lifelike view for fun, driven by the same live data. Camera presets and viewing modes work in both and sit above the viewer. The Realistic lab has an Inside chamber view with glows and name tags on the equipment in use.


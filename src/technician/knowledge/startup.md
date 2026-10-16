## Normal start-up order
Keywords: startup, start up, procedure, order, steps, how do I begin, sequence, checklist
The standard order is: 1) close the MAIN BREAKER to power the facility; 2) power on the Rubidium clock and wait for lock; 3) close the door and evacuate the chamber (roughing pump to about 50 Torr, then the turbo pump to below 1e-3 Torr); 4) power on the VNA, enable RF, and calibrate it; 5) power on the LDV and open the shutter (with eye protection); 6) home the stage and test the location variable by moving it or running a scan.

## Facility power
Keywords: power, main breaker, breaker, facility, lights
The MAIN BREAKER is in the top right of the app. Closing it gives AC power to the racks and environmental controls. Opening it resets all instrument states (the notebook is kept). Nothing else works without it, and stage moves are rejected while the facility is off.

## Rubidium clock warm-up and lock
Keywords: clock, rubidium, warmup, lock, locked, 10 MHz, reference, holdover
After the clock is powered on it warms up for about 15 simulated seconds, then the LOCKED indicator turns green and it provides a 10 MHz reference to all instruments. If lock is lost the clock goes into holdover and frequency results are unreliable. Always lock the clock before measuring.

## Evacuating the chamber
Keywords: vacuum, pump, pumpdown, pump down, evacuate, roughing, turbo, pressure, torr
Close the door, then start the roughing pump. Pressure falls from 760 Torr toward about 50 Torr. Once it is below 50 Torr the turbo pump may be started; the turbo then takes the chamber below 1e-3 Torr, which is the deep-vacuum target for measurements. The turbo is protected: starting it above 50 Torr raises a critical turbo-protection alarm. A vent cycle lets air back in and must be finished before the stage can move.

## Deep vacuum target
Keywords: deep vacuum, 1e-3, threshold, high vacuum, pressure target
Measurements require pressure below 1e-3 Torr. A vacuum leak blocks pumpdown and keeps the validation check failing.

## Thermal stability
Keywords: temperature, thermal, setpoint, thermostat, stable, millikelvin, 0.03
The thermostat holds the chamber at a setpoint (20 degrees C by default). Measurements are valid when the temperature is within 0.03 degrees C of the setpoint. It starts near 22 degrees C so it needs time to settle after power-up. Thermal mass is slow, so patience is the fix.

## VNA set-up and calibration
Keywords: vna, calibrate, calibration, sweep, rf, s11, span, center, ifbw, points, averaging
Power on the VNA, enable RF output and run a sweep to see the S11 resonance near 230.5 kHz. Calibration (SOLT 1-port by default) makes the S11 numbers meaningful and is valid for 3600 seconds (one hour). Changing the center frequency or span invalidates calibration, and the app raises a warning. Defaults are 401 points, 100 Hz IFBW, -10 dBm source power, 5 kHz span.

## LDV and laser safety
Keywords: ldv, laser, vibrometer, shutter, safety, goggles, eye protection, optical quality, alignment
The Polytec LDV measures surface vibration without contact. Power it on, then open the shutter to emit the laser. Everyone near the beam must wear eye protection; the shutter should stay closed whenever people are working at the chamber. Optical quality drops if the beam is misaligned.

## The XYZ stage
Keywords: stage, move, home, xyz, position, limit, settle, clamp, backlash
The stage moves the sphere within plus or minus 35 mm on each axis. A move is rejected when the facility is off, the door is open, the clamp is active, or a vent cycle is running. After a move the stage must settle (ring-down) before a record is valid. Homing sends it to 0, 0, 0.

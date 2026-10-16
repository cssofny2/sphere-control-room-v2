## Fault simulator overview
Keywords: fault, failure, simulator, drill, inject, troubleshooting, diagnose
The fault simulator can inject five faults: clock drift, LDV misalignment, vacuum leak, EMI spike and stage backlash. A blind fault drill hides one random fault so the operator has to diagnose it from symptoms. Clearing all faults resets the drill.

## Fault: Rubidium clock drift
Keywords: clock drift, drift, unlocked, wander, reference, clockDrift
Cause: the reference is drifting or the clock cable is faulty. Effect: the clock reports unlocked, the VNA peak wanders and the clock-noise term rises, so frequency values cannot be trusted. Check: the Frequency Reference panel and the Rubidium reference rule in validation. Fix: clear the drift fault or restore the cable, then confirm the clock is locked before measuring. Pause measurements until lock is back.

## Fault: LDV misalignment
Keywords: ldv misalignment, misaligned, optical return, optical quality, signal quality, ldvMisalign
Cause: the laser spot has moved off the target. Effect: optical return and signal quality fall by about 65 points and scan data becomes patchy. Check: the optical quality and laser return on the LDV panel. Fix: re-align LDV X/Y, refocus, and verify that optical quality recovers. Keep the shutter closed while people are at the chamber.

## Fault: Vacuum leak
Keywords: vacuum leak, leak, hiss, pressure rising, cannot pump, vacuumLeak
Cause: a seal, gasket or fitting is letting gas in. Effect: pressure rises again after pumping, the turbo cannot hold deep vacuum, and the pressure validation rule fails. Check: the pressure rate on the Chamber panel and the door seal. Fix: clear the leak fault (in the real lab, re-seat the door gasket or tighten the clamps, then leak-check). Do not run the turbo against a rising pressure above 50 Torr.

## Fault: EMI spike
Keywords: emi, interference, 60 hz, noise burst, rf noise, emiSpike
Cause: an active electromagnetic source nearby. Effect: a strong interference tone appears on the scope and the VNA noise floor rises, even with the Faraday cage on. Check: the scope FFT for a 60 Hz style line. Fix: shielding alone will not remove an active source, so clear the fault. Make sure the Faraday cage is on as well.

## Fault: Stage backlash
Keywords: backlash, jitter, wobble, never settles, stage sloppy, stageBacklash
Cause: mechanical play in the leadscrew. Effect: the stage never fully settles, actual position jitters by about 0.018 mm, and LDV quality drops by about 10. Check: compare commanded and actual position. Fix: approach each position from the same direction and wait for settle before recording; clear the fault in the simulator.

## Alarm: turbo protection
Keywords: turbo protection, turbo alarm, pressure too high
Raised when the turbo is on while pressure is above 50 Torr. Stop the turbo, run the roughing pump until the pressure is below 50 Torr, then start the turbo again.

## Alarm: shielding or isolation off
Keywords: faraday off, shielding disabled, isolation disabled, noise elevated
If the Faraday cage is off, VNA data may be corrupted by RF. If isolation is off, LDV and scope noise rise. Switch them back on before measuring.

## Alarm: stage move rejected
Keywords: move rejected, homing rejected, interlock, blocked
A move or home is refused when the facility is off, the door is open, the clamp is active, or a vent cycle is running. Fix the blocking condition, then repeat the command.

## Alarm: calibration invalidated
Keywords: calibration invalidated, span modification, recalibrate
Changing the VNA center or span invalidates calibration. Recalibrate before the next scan.

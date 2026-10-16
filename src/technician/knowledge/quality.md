## Measurement validation rules
Keywords: validation, ready, readiness, rules, checklist, can I measure, quality gate, pass, fail
A measurement is only trustworthy when all of these pass: the Rubidium reference is locked; pressure is below 1e-3 Torr and there is no leak; temperature is within 0.03 degrees C of the setpoint (warning band up to 0.1); the Faraday cage is on; vibration isolation is on; the stage is settled with the clamp released and position error under 0.075; and the VNA is calibrated with calibration age under 3600 s.

## Scans and the quality gate
Keywords: scan, run, experiment, axis, plan, points, repeats, randomized, adaptive rescan, accepted, suspect, failed
A scan visits a list of stage positions (an axis scan or a point plan), waits for the stage to settle, records the VNA/LDV data, and passes each point through a quality gate that marks it accepted, suspect or failed. Failed points can be rescanned automatically (adaptive rescan, up to 2 times by default). A scan needs facility power, VNA power and RF output, and is blocked by a stage clamp, an open door or a vent cycle. Only one run can own the instruments at a time. Randomized order helps cancel drift.

## Reading the results
Keywords: results, findings, spatial field, heatmap, isosurface, interpolation, roi, delta f, significance, data
The Spatial Field Explorer maps frequency shift, uncertainty and coverage across X, Y and Z. Interpolation between points is only scientifically valid with adequate coverage. A Region of Interest (ROI) gives statistics for a sub-volume. Check that the accepted count is high and the failed count is low before trusting a trend.

## Exporting data
Keywords: export, csv, json, save data, download
Records can be exported as CSV or JSON from the command palette or the Experiment Runs area.

## Notebook and events
Keywords: notebook, log, events, notes, alarms, acknowledge
Every action is written to the event log. The notebook keeps tagged entries and survives a breaker reset. Alarms stay open until acknowledged.

## Challenges and badges
Keywords: challenges, badges, achievements, training, learn
There are five training challenges: 60 Hz EMI diagnosis, resonant peak optimization (improve Q above 4000 by lowering pressure), clock lock restoration, blind repeat validation (at least 5 points, randomized, hidden ground truth) and a thermal stability check. Completing steps awards badges.

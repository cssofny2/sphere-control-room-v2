# Hardware output API draft

This is a design proposal, not an implemented hardware driver or an authorization to energize equipment. The simulator currently has no validated actuator, output calibration, or replay path. Synthetic data is not a physical recording.

## Proposed local service

Only a separately installed, authenticated local service may own a device. Browser transport could use a secure WebSocket to that service; Web Serial is an alternative only after browser and device compatibility are established. Neither transport itself provides a safety interlock.

- `GET /v1/devices` returns device IDs, connection status, supported sample rates and calibrated output limits.
- `POST /v1/replays/validate` accepts an immutable recording ID, channel, calibration ID and proposed limits. It returns a dry-run plan, warnings and a content hash, never energizes hardware.
- `POST /v1/replays/arm` accepts the validated plan hash and a short-lived operator authorization. It is rejected unless all device-side interlocks are asserted.
- `POST /v1/replays/{id}/start` starts an armed, unexpired plan. `POST /v1/replays/{id}/stop` stops output; loss of communication must independently stop output at the device.
- `GET /v1/replays/{id}` reports state, actual output telemetry, interlock state, errors and audit events. Commands must be idempotent and reject stale session IDs.

## Required control logic before implementation

Verify recording origin, units, timing, monotonic sample timestamps, waveform integrity and SHA-256 digest. Frequency estimates or a VNA trace are not waveform samples and must never be treated as replayable recordings. Require calibrated conversion to device units, anti-aliasing and adequate DAC sample rate and analog bandwidth; a 230 kHz signal cannot be recreated using a 192 kS/s output. Establish independently reviewed limits for amplitude, slew, energy, duration, temperature and hardware-specific failure modes. Require explicit local operator confirmation, physical emergency stop, fail-safe interlocks, watchdog timeout, output ramping and independent output monitoring. Any missing capability, violated limit, device fault, disconnect or expired authorization prevents output or transitions to a safe stopped state. Log the plan, operator, device, calibration, interlocks and actual output without claiming that the commanded waveform was physically reproduced.

These endpoints must not be exposed publicly or implemented as an unauthenticated browser-to-device bridge. The safety envelope and verification procedure must be supplied by the equipment owner and reviewed for the specific transducer and installation.

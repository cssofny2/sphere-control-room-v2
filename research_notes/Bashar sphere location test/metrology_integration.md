# Bashar sphere location test: metrology and integration

## Status and source limitations

### Takeaway
This is an integration-readiness assessment and a **provisional research brief, not completed deep research**. The repository is inspectable; the external literature was not: web search returned a tool-registration error and NIST, general web fetch, curl and browser navigation all failed DNS resolution. Bibliographic leads below are therefore **not verified in this session**; do not treat them as checked citations, and verify them before publishing or implementing physics values.

### Cited findings
- The project calls the test a location-variable metrology simulator, and links a proposed [LOC-1 whitepaper](https://spheredesci.org/whitepaper/) that could not be retrieved here. [Repository README](../../README.md).
- The workspace itself says the proposed protocol and 25-field schema are provisional because SPHERE-WP-001 and the actual LOC-1 schema were not provided. The 9.2 mm, 0.4 m, artifact and atmospheric figures are simulation assumptions, not verified specifications or observations. [ProtocolWorkspace.tsx](../../src/protocol/ProtocolWorkspace.tsx).

### Inferences
- “Bashar sphere location test” is the user's label for a proposed experiment; the original description and its particular claims were not independently located. Do not equate its claims with a verified protocol or published result.

### Gaps
- Literature verification, material-property tables, exact mode roots, original project protocol, instrument-specific bandwidth specifications, and any prior independent observations remain open. No cited copper-specific numerical eigenfrequency estimate is defensible until those sources are accessible. No code was changed.

## Idealized elastic modes and translation

### Takeaway
For an ideal isolated homogeneous elastic sphere, modes depend on radius, density, elastic constants and mechanical boundary conditions; translating the entire body without changing those conditions does not change its eigenfrequencies. A copper sphere is not identified by a single “resonance,” and a simulated 230.5 kHz feature cannot be identified as a breathing mode without a calculation and a measured mode shape.

### Cited findings
- The legacy model specifies a *synthetic* 230,500 Hz baseline and a tunable linear position effect. It has no elastic-sphere eigenmode solver. [model.ts](../../src/simulation/model.ts).
- The workspace displays synthetic FEA/LDV-style heatmaps and labels 230.5 kHz a “breathing-mode candidate” while explicitly saying identification is unverified. These heatmaps are generated shapes, not finite-element or measured mode data. [ProtocolWorkspace.tsx](../../src/protocol/ProtocolWorkspace.tsx).

### Inferences
- The standard free, isotropic, linear-elastic sphere idealization has spheroidal modes (including radial breathing and nonradial modes), torsional modes, radial overtones and angular-order families. Rigid translation and rotation are zero-frequency rigid-body modes, not internal elastic resonances. Perfect spherical symmetry creates angular degeneracy; anisotropy, ellipticity and contacts can split and mix modes. Lead for verification: H. Lamb, “On the Vibrations of an Elastic Sphere,” *Proceedings of the London Mathematical Society*, s1-13 (1882), 189–212, [DOI 10.1112/plms/s1-13.1.189](https://doi.org/10.1112/plms/s1-13.1.189); link and details not checked.
- For radius `a = 4.6 mm` if 9.2 mm is the actual diameter, a solver should use longitudinal speed `cL = sqrt((λ+2μ)/ρ)` and transverse speed `cT = sqrt(μ/ρ)`, with `λ, μ` isotropic Lamé constants. A mode has `f = ξ cT/(2πa)` for a dimensionless root ξ dependent on mode and Poisson ratio; the breathing root is governed by longitudinal as well as shear speed. These are equations, not a measured frequency. **Do not substitute a wavelength-over-diameter estimate and call it a mode eigenfrequency.**
- A real copper sphere's alloy/purity, microstructure and single-crystal vs effective polycrystal elastic tensor, temperature, density, diameter/roundness, prestress and support need characterization. The project’s stated purity is illustrative, not a material certificate. Radius uncertainty alone gives `δf/f ≈ −δa/a` when all other parameters are fixed.
- Uniform gravitational acceleration produces no position-dependent intrinsic frequency in a freely falling ideal body; real static support loads, gravity gradients, altered orientation or strain can matter. Translating only the sphere relative to a fixed apparatus does **not** preserve the full boundary conditions, even when the lab appears homogeneous.

### Gaps
- Obtain primary Lamb-mode equations and independently checked roots, plus source-verified room-temperature copper density and elastic constants for an identified grade. Only then calculate a table of mode families and frequencies, uncertainty/sensitivity to dimensions and constants, and comparison to 230.5 kHz. No reliable source for a particular coefficient or frequency was available in this session.
- Lead for temperature-dependent copper properties: NIST Cryogenic Materials Database, [OFHC copper](https://trc.nist.gov/cryogenics/materials/OFHC%20Copper/OFHC_Copper_rev.htm); inspect the data, applicable temperature and provenance before using it. Thermal expansion alone does not determine frequency drift: stiffness and density also change.

## Confounds and order-of-magnitude interpretation

### Takeaway
An observed peak shift need not be an intrinsic location effect: changes in temperature, support, coupled fixture, field, alignment or selected mode can all alter the measured response. Quantify effects in an actual fixture rather than adopting the simulator's constants as material properties.

### Cited findings
- The teaching model uses +5 Hz/°C and position coefficients +45.2, −12.5 and +80.1 Hz/mm; the separate LOC-1 thermal illustration uses +23 Hz/K. These are inconsistent modeling assumptions, neither validated copper coefficients. [model.ts](../../src/simulation/model.ts); [ProtocolWorkspace.tsx](../../src/protocol/ProtocolWorkspace.tsx).
- The teaching model adds adjustable fixture, pressure, clock and RF effects and synthesizes a Lorentzian S11 dip. It encodes an assumed location effect instead of discovering one. [model.ts](../../src/simulation/model.ts).

### Inferences
- **Temperature:** record artifact and mount temperature at both positions, gradients, history and settling; determine signed mode-specific `df/dT` experimentally. Merely as arithmetic on the *illustrative* +23 Hz/K coefficient, 10 mK gives 0.23 Hz, about 998 ppb relative to 230.5 kHz. At +5 Hz/K it gives 0.05 Hz. Neither result predicts copper behavior. Thermal expansion changes geometry; temperature-dependent moduli, strain gradients and mount expansion also matter.
- **Supports and loads:** contact stiffness, force, location, friction, seating, coupling glue and mode nodes can shift/split and damp the coupled modes. “Nodal” placement is an unverified design goal, especially for split or changing modes. Repeat lifts/reseats, compare supports and loads, record contact geometry; a sham move separates handling from translation.
- **Orientation and residual stress:** texture, manufacturing defects, nonsphericity, load-induced anisotropy and residual stress may split modes. Rotate at fixed position and preserve/measure orientation during moves. Track individual modes and shapes rather than fitting whichever peak is strongest.
- **EM and environment:** copper’s conductivity allows inductive/eddy-current coupling; transducer loading, spatially varying fields, cable position and RF fixture resonances can change peaks. Air loading, local flow/pressure, vibration and laser heating/alignment may matter. Compare excitation strengths, fixture geometry and field controls; measure transfer functions and blank fixture/dummy responses. No universal shift magnitude is justified without geometry and calibration.
- **Clock and time:** a 1 ppb fractional clock error corresponds to 0.0002305 Hz at 230.5 kHz; a 5 ppb contrast corresponds to about 0.00115 Hz. Common-clock correlation may cancel or fail to cancel depending on the estimator and timing; “locked” alone is not a traceability or stability certificate. A 1 µm diameter change would change an ideal 9.2 mm sphere’s frequency by approximately 109 ppm, or 25 Hz at 230.5 kHz, holding all other properties fixed; this is a geometric sensitivity, not a prediction of sphere drift.

### Gaps
- Real support, orientation, temperature coefficients and EM-coupling scales require laboratory characterization or verified literature. Avoid suggesting that the arithmetic above is a measured error budget.

## Measurement design and uncertainty

### Takeaway
Treat LDV plus characterized excitation as a candidate mechanical channel, not an already validated method. A VNA may characterize an electrical fixture response but an S11 feature is not automatically an independently confirmed mechanical eigenfrequency.

### Cited findings
- The repository models an LDV, oscilloscope, VNA and clock, but the hardware-output API is a draft and explicitly states no validated actuator, output calibration or replay path exists. [ldvModel.ts](../../src/features/ldvModel.ts); [scopeModel.ts](../../src/features/scopeModel.ts); [hardware-output-api-draft.md](../../docs/hardware-output-api-draft.md).
- The workspace's 96 and 192 kS/s alias examples and 1 MS/s comparison concern a hypothetical 230.5 kHz signal. The separate teaching-model fit uncertainty is noise-only and excludes clock, calibration and position systematics. [ProtocolWorkspace.tsx](../../src/protocol/ProtocolWorkspace.tsx); [measurement.ts](../../src/simulation/measurement.ts).

### Inferences
- **Channel design:** use a calibrated LDV with optical head, decoder and analog/digital output bandwidth that all cover the full *verified* search band. Scan multiple accessible surface points and use amplitude/phase and spatial pattern to identify modes; measure optical return, signal-to-noise, stand-off, heating and alignment. Noncontact sensing does not remove mechanical support, air, optical or excitation effects.
- Pilot excitation choices include characterized piezo/acoustic excitation or EMAT with assessed electrical and magnetic coupling, heating and nonlinear loading. Do a drive-amplitude sweep and ring-down versus swept response comparison, verify linearity and account for air attenuation and transducer transfer functions. A VNA with a suitable fixture may be useful for exploratory S-parameter diagnostics; determine its frequency range, calibration plane and fixture/cable background. Demonstrate mode correspondence and independent uncertainties before treating it as corroboration.
- For direct real sampling of a 230.5 kHz sinusoid, `fs > 461 kS/s` is necessary, not sufficient; 96 and 192 kS/s give Nyquist frequencies of 48 and 96 kHz and aliases 38.5 and 38.5 kHz respectively. A 1 MS/s ADC gives Nyquist 500 kHz but needs sufficient analog bandwidth, appropriate analog anti-alias filtering, adequate dynamic range and clock performance. Validated bandpass undersampling or analog downconversion is a separate architecture with its own image/filter/clock requirements. For the 10 MHz clock input, a separate suitable bandwidth and sampling plan is required.
- Select scope/DAQ and LDV by actual specified analog bandwidth, sample rate at the used channel count, input range/noise, timing and interface; check manufacturer specifications and calibration certificates, not product names. Record raw sampled time series, acquisition timing, hardware/firmware, transducer settings and traceable calibration. Frequency-bin spacing `1/T` is not identical to frequency-estimation uncertainty; adequate record length and mode discrimination are required.
- **Design:** predefine test/reference artifacts, identifiers, two physically surveyed locations, mount geometry, transfer steps, orientation, settling criteria, excitation/readout settings and estimand. Use repeated randomized A/B blocks with independent placements, stationary reference and sham handling; include orientations, dummy/fixture-only controls and drift monitoring. Same-placement successive readings are technical replicates, not independent placements. Counterbalance order and time; keep location blinded to analysis when physically feasible. Distinguish positional contrast from device-to-device differences and paired from unpaired readings.
- Pre-register primary mode, contrast, uncertainty model, exclusions, number of independent placements and stopping rule, meaningful effect/equivalence bounds, multiplicity and power analysis using pilot repeatability and drift. Equivalence requires a prespecified margin and an appropriate confidence interval/test at the chosen alpha; “no significant difference” is not equivalence. Retain all raw and excluded records with reasons and versioned analysis. Secure independent custody of allocation; a public hash of a small possible sequence is brute-forceable without a secret salt or proper cryptographic commitment, and hashing alone proves neither time of commitment nor role separation.
- Build a GUM-style budget including Type A repeatability and Type B calibration/clock, temperature and gradients, position, fixture/load, fit/model-selection and other influences, with correlations. State standard vs expanded uncertainty and coverage assumptions. Check reference stability across relevant averaging times, transfer/fixture changes and clock-distribution lock loss; one 10 MHz lock indicator cannot establish all of this.

### Gaps
- Vendor specifications and ISO/IEC documents could not be retrieved. Lead: JCGM 100:2008, *Evaluation of measurement data — Guide to the expression of uncertainty in measurement*, [BIPM JCGM publications](https://www.bipm.org/en/committees/jc/jcgm/publications); NIST, *Guidelines for Evaluating and Expressing the Uncertainty of NIST Measurement Results*, Technical Note 1297, [NIST](https://www.nist.gov/pml/nist-technical-note-1297). Verify precise editions and access before citation in published educational material. No particular LDV, DAQ, EMAT, scope, VNA, reference clock or sampling setup is validated here.

## Repository integration readiness

### Takeaway
The current app is a mature *educational synthetic simulator* with a protocol shell and usable run/export infrastructure, not an experimental acquisition system or proof of a position-dependent effect. The conceptual 0.4 m rail and the active ±35 mm stage are separate models and are not an operational two-position physical experiment.

### Cited findings
- Entry point `src/main.tsx` loads `MetrologyLabV3.tsx`; `src/MetrologyLab.tsx` is retained legacy code, not the current entry. Hash routes include `#/protocol`, `#/chamber`, `#/vna`, `#/ldv`, `#/scope`, `#/clock`, `#/runs`, `#/timeline`, `#/spatial`, and `#/insights`. [README](../../README.md); [route.ts](../../src/features/route.ts); [MetrologyLabV3.tsx](../../src/MetrologyLabV3.tsx).
- `ProtocolWorkspace.tsx` offers overview/rail/artifacts, metrology, controls, mock custody and roadmap. Illustrative panels include first-order uncertainty, FEA/LDV heatmaps, TOST, aliasing, thermal coefficient, Allan plot and celestial placeholders. Checkboxes cannot establish actual controls. Its A/B order uses `sort(() => Math.random() - 0.5)` and browser-local hash with virtual reveal; it is not secure blinding, independent custody or a guaranteed unbiased randomization algorithm. [ProtocolWorkspace.tsx](../../src/protocol/ProtocolWorkspace.tsx).
- The 25-field `SPHERE-LOC1-provisional` v0.1 schema is produced by `toLoc1Record`: missing physical fields are null, legacy positions become `LEGACY_XYZ_MM`, pressure is converted from Torr, and normalized shift/uncertainty use a fixed 230,500 Hz denominator. Thus a normalized value is not a measured reference ratio or validated LOC-1 contrast. Imported CSV rows can be labeled imported; acquisition status and top-level bundle origin need careful interpretation. [loc1.ts](../../src/protocol/loc1.ts); [bundle.ts](../../src/domain/bundle.ts).
- The legacy stage model and bundle import validate coordinates within ±35 mm; the 0.4 m A/B rail is an exact schematic. `RunPlan` has typed IDs, acquisition attempts, copied settings, units, simulation provenance and seeded axis/serpentine/manual execution; this is not a physical A/B assignment and custody model. [README](../../README.md); [run.ts](../../src/domain/run.ts); [bundle.ts](../../src/domain/bundle.ts); [ProtocolWorkspace.tsx](../../src/protocol/ProtocolWorkspace.tsx).
- The VNA synthetic sweep is a generated dip, with fitted f0/Q and noise-only fit covariance, not an instrument transfer function; LDV scenarios and scope signals are also synthetic. LDV's seven-position scenario samples the teaching location model rather than independently measuring it. [model.ts](../../src/simulation/model.ts); [measurement.ts](../../src/simulation/measurement.ts); [ldvModel.ts](../../src/features/ldvModel.ts); [scopeModel.ts](../../src/features/scopeModel.ts).
- The engineering twin and schematic are conceptual, not dimensionally validated CAD or collision/safety analysis. The 1 Hz/3,600-s telemetry ring holds simulated environmental summaries and f0, not sampled vibration waveforms, and is memory-only. [README](../../README.md); [telemetry.ts](../../src/features/telemetry.ts).
- Reproducibility bundles use a SHA-256 checksum, have a synthetic-data notice and support import validation; CSV import accepts positional/frequency rows. Checksums establish content integrity relative to a supplied digest, not scientific provenance or independent custody. Session data is browser-local; comparison, spatial weighted fit and Insights are descriptive, not experimental significance tests. [bundle.ts](../../src/domain/bundle.ts); [README](../../README.md); [field.ts](../../src/spatial/field.ts); [analyticsReport.ts](../../src/analysis/analyticsReport.ts).

### Inferences
1. **Resolve specifications first:** retrieve the actual protocol, source claims, original assumptions and verified primary physics/material literature; agree which are project hypotheses and which are physical measurements. Version all sources and decide target mode/actual artifact geometry.
2. **Make model boundaries explicit:** preserve the legacy training model; offer a separate null model with position coefficient zero and opt-in hypothesis/confound models. Mark 230.5 kHz and the +5/+23 Hz/K numbers as independent, uncalibrated illustrations. Never use a generated slope to demonstrate a discovery. Replace or qualify the breathing label only after independent mode calculation and verification.
3. **Implement a validated elastic-mode teaching model only after sourcing:** parameterize radius, density, temperature-dependent elastic tensor and boundary assumptions; compute stable roots and mode families, show uncertainty and mode-shape limitations, distinguish ideal free sphere from mounted-system model. Include source/version provenance and numerical-validation fixtures against published benchmark roots.
4. **Separate A/B protocol from legacy XYZ:** represent physical positions, survey uncertainties, mount identity, artifact/role, orientation, placement IDs and repeats; do not silently map 0.4 m onto ±35 mm travel. Add sham/reference/rotation/dummy factors and seeded, balanced schedules; display pseudorandom educational generation separately from an independently controlled real-world blinding service.
5. **Replace placeholder metrology without overstating readiness:** explicit primary/reference estimands, temperature/gradient and support covariates, multimode/mode-matching behavior, raw time series and transfer-function metadata, fit validity, covariance-aware uncertainty and source-calibrated sampling diagnostics. Validate units, sample rate, analog bandwidth and anti-alias behavior. No single-bin alias demonstration proves a real acquisition chain.
6. **Version provenance and exports:** formalize provisional schema with units, null/unknown semantics, source-specific import contracts and migration, per-record origin, dataset-level mixed-origin handling, timestamps, calibration/clock metadata, raw-file and config hashes, placement and exclusions. Avoid a fixed 230.5 kHz normalizer unless explicitly a model convention; compute actual reference contrasts only when reference data exist. SHA-256 is integrity metadata, not trusted evidence or secure custody.
7. **Analysis and interface:** maintain a visible synthetic watermark in every panel/export and explain descriptive weighted fits; develop preregistered paired/block statistical analysis and equivalence testing separately from simple 95% interval graphics and the existing 3.3×SE heuristic. Add unit tests for null-position invariance, model parameters, mode labeling, provenance, aliases, randomized block balance, domain-specific travel and covariance; treat no simulator test as hardware validation.
8. **Physical integration is a separate gated program:** laboratory reviewed safety, traceability, calibrated devices and independently verified acquisition, reference, control and blinding procedures precede any real-data evidence claim. The drafted hardware API must not be interpreted as implemented.

### Gaps
- No live deployment inspection or physical measurement was possible; assessment is of the checked-out source, not a claim about the deployed site's exact revision. Numerical physics calculations and source-backed educational claims await successful literature retrieval.

## Short bibliography and proposed educational wording

### Takeaway
Use the following as **unverified source leads**, not as evidence already reviewed; the cited project files above are the sources actually inspected.

### Cited findings
- H. Lamb, “On the Vibrations of an Elastic Sphere,” *Proceedings of the London Mathematical Society*, s1-13 (1882), 189–212, [DOI](https://doi.org/10.1112/plms/s1-13.1.189) — proposed theoretical primary source; metadata and contents not verified in this session.
- NIST, [OFHC copper material data](https://trc.nist.gov/cryogenics/materials/OFHC%20Copper/OFHC_Copper_rev.htm) — proposed properties lead; not retrieved or checked for the desired temperature and constants.
- JCGM, [GUM publications](https://www.bipm.org/en/committees/jc/jcgm/publications), and NIST, [Technical Note 1297](https://www.nist.gov/pml/nist-technical-note-1297) — proposed uncertainty leads; not retrieved.
- The [project whitepaper](https://spheredesci.org/whitepaper/) is a project source, not independent confirmation, and was not retrieved.

### Inferences
- Draft educational wording **pending source verification**: “In an ideal uniform environment, translating a free elastic sphere does not by itself change its natural frequencies. Real measurements can change when temperature, support, orientation or instrument coupling changes. This display uses simulated values and does not establish a location effect.”
- “A 230.5 kHz marker is an illustrative teaching value. Identifying a mode requires a documented model, specimen properties and independently measured mode shape.”
- “An electrical reflection feature is not automatically the same as a mechanical resonance. Any claimed agreement between instruments requires a demonstrated coupling mechanism and an uncertainty budget.”

### Gaps
- Verify each link, document edition, page, root and physical constant, add original peer-reviewed support/contact and instrument-bandwidth sources, and compute copper-specific mode estimates before this brief can be called source-backed deep research.

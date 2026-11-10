# Official S.P.H.E.R.E. / LOC-1 protocol and the "Bashar sphere location test" (research as of 2026-11-10)

**Access note.** This sandbox could not resolve spheredesci.org, osf.io, or zenodo.org (DNS failure for curl and web_fetch). All primary content below was read from the project's *official public repository* `cssofny2/spheredesci.org` (source of the live site; branch `main`, last push 2026-11-04T19:32Z, HEAD `3a65125`) via the GitHub API. Repo-file URLs are `https://github.com/cssofny2/spheredesci.org/blob/main/<path>`. **The OSF preregistration (https://osf.io/5b6mj/overview) and the Zenodo record (https://doi.org/10.5281/zenodo.23583932) were NOT opened by me**; everything said about them is what the project's own pages claim. Their contents are unverified.

## 1. Hypothesis, operational definition of "location", and test/control design

### Takeaway
LOC-1 asks whether moving a controlled hollow copper sphere between two fixed positions (A/B, 0.40 m apart, one enclosure) produces a repeatable resonance-ratio difference versus a stationary reference sphere, beyond a preregistered threshold, surviving controls and replication. "Location" is operationalised only as the A-vs-B position label of the moved test sphere. The project says the *finalised* numbers live in the OSF registration, which I could not read.

### Cited Findings
- Central question (whitepaper v1.0): "Does moving a controlled copper sphere between specified positions produce a repeatable change in its selected resonance, relative to a stationary reference sphere, that exceeds a preregistered effect threshold and survives independent replication?" — [content/whitepaper.mdx §1.1](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper.mdx)
- Public plain-language version: "Does moving the same hollow copper sphere between two fixed positions produce a repeatable resonance difference that survives controls for temperature, mounting, timing, and other measured conditions?" Design: "a controlled, same-laboratory comparison of a test sphere at two fixed positions, with a reference artifact and environmental monitoring. The optical readout tracks mechanical resonance." — [protocol/index.html](https://github.com/cssofny2/spheredesci.org/blob/main/protocol/index.html) (live: https://spheredesci.org/protocol/)
- Hypotheses: H0 = after preregistered corrections the location-associated difference lies within predefined equivalence bounds; H1 = a difference exceeding the smallest effect of interest persists across randomized returns, survives controls, and is independently replicated; third outcome "inconclusive". — [whitepaper.mdx §1.3](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper.mdx)
- Measurand: ratio r(t)=f_T/f_R (selected test-sphere resonance over stationary-reference resonance). v1.0: Δ_ppb = 10^9 (r̄_A − r̄_B). v1.1 draft: Δ_ppb = 10^9 (μ_A − μ_B)/r_0, μ = adjusted mean ratios, r_0 a fixed qualification-derived baseline ratio; "does not assume identical artifact frequencies". — [whitepaper.mdx §2.1](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper.mdx); [content/whitepaper-v1.1-full.md §1.4](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper-v1.1-full.md)
- A/B layout: A/B separation 0.40 m centre-to-centre; stationary reference sphere at a third fixed position; same-enclosure two-position design. — [whitepaper.mdx §5.3](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper.mdx)
- Placements/schedule: at least 40 placements per position (80 principal), ten blocks of eight, randomized balanced A/B scheduling, default 30-minute settling (extendable), environmental logging ≥1 Hz. — [whitepaper.mdx §5.3](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper.mdx); same defaults "subject to qualification" in [v1.1 §2.9](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper-v1.1-full.md)
- Controls: sham moves, rotations, dummy-artifact tests, label checks, reference-only drift segments; ≥20 remove-and-replace trials before confirmation; deliberate temperature variation for thermal characterisation; shared reference clock; logs of temperature, humidity, pressure, magnetic field, vibration. — [whitepaper.mdx §5.1, §5.3](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper.mdx); [protocol/index.html](https://github.com/cssofny2/spheredesci.org/blob/main/protocol/index.html)
- Blinding: "an independent position keeper holds the placement key; the analyst receives coded data"; key released only after analysis frozen. Leak channels (file names, timestamps, guessable order) are discussed only "for discussion rather than as changes to the registered plan". — [protocol/index.html](https://github.com/cssofny2/spheredesci.org/blob/main/protocol/index.html); [content/research/blind-analysis-position-labels.mdx](https://github.com/cssofny2/spheredesci.org/blob/main/content/research/blind-analysis-position-labels.mdx) (2026-11-01, status: proposed); whitepaper §4.5.
- Excitation/readout (proposed; "provisional until written quotations and acceptance tests"): 3D scanning LDV (baseline Polytec PSV-500-3D-HV; alt. VibroScan QTec Xtra 3D), Keysight E5080B VNA (complex S11 fitting; secondary/diagnostic channel), SRS FS725 Rb reference, 4-ch oscilloscope (LeCroy WaveSurfer 4104HD), near-field probes; excitation via EMAT/electromagnetic actuator or air-coupled ultrasound (cannot work through vacuum). Vacuum pressure "a protocol parameter to be selected"; thermal target ±0.001 K proposed. — [whitepaper.mdx §2.2–2.6](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper.mdx)
- Artifact: thin-walled hollow copper sphere; four proposed (test, reference, spare, dummy), 99.999% Cu proposed; thin-shell estimate gives breathing mode ≈230 kHz at R≈4.6 mm (E=130 GPa, ρ=8960 kg/m³, ν=0.34); larger artifacts with higher-order modes allowed; final geometry/mode set by FEA and measurement. A "9.2 mm OD, 0.3 mm wall" baseline (≈228 kHz) appears in a proposal-stage note and a page labelled "provisional baseline". — [whitepaper.mdx §2.1](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper.mdx); [environment-replay note](https://github.com/cssofny2/spheredesci.org/blob/main/content/research/environment-replay-copper-sphere-relocation.mdx); [resources/hollow-copper-sphere](https://github.com/cssofny2/spheredesci.org/blob/main/resources/hollow-copper-sphere/index.html)
- Band criterion: ">230 kHz" is "an experimental selection criterion inherited from the hypothesis, not an independently demonstrated boundary". — [whitepaper.mdx §1.3](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper.mdx)
- Out of scope: teleportation, non-kinetic relocation, medical applications, consciousness interventions. — [v1.1 §1.1](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper-v1.1-full.md)
- Proposed (NOT registered) amendment of Oct 9, 2026: four-object synchronous acquisition (S1 stationary ref, S2 test sphere moved A/B, S3 second ref, S4 sham-move control), shared clock and hardware trigger; "The registered two-sphere design remains authoritative." — [protocol/synchronized-four-object-frequency-measurement](https://github.com/cssofny2/spheredesci.org/blob/main/protocol/synchronized-four-object-frequency-measurement/index.html)

### Inferences
- An A↔B exchange of two spheres is not described; the documented manipulation is moving one test sphere between A and B against a never-moved reference. "Randomized returns" and remove-and-replace are the closest analogues.
- The default counts are attributed to a "founding packet" (cited `[2]`/`[file:17]`) that I could not find publicly.

### Gaps
- Exact A/B coordinates, mount/fixture, orientation, drive level, mode/frequency, estimator settings, number of sham/dummy/rotation trials, replacement/missing-data rules: not in readable public text; the project says they are finalised in OSF (unread).
- Whether the final registration uses the whitepaper defaults is unverified.

## 2. Statistics, thresholds/SESOI, exclusions, stopping rules

### Takeaway
Readable documents give α=0.01 two-sided and ≥90% power as founding values, but SESOI, equivalence α and design effect are explicitly unfrozen/null; the project says they are finalised in OSF, which I could not read.

### Cited Findings
- Primary two-sided α=0.01; preregistered environmental/settling covariates; equivalence testing against ±SESOI; block structure and serial dependence modelled; independent replication before attributing any surviving signal. — [whitepaper.mdx §5.3](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper.mdx)
- SESOI "shall be frozen only after calibration demonstrates that the planned design can detect it with at least 90% power"; "The founding protocol does not provide a justified universal ppb detection claim." — [whitepaper.mdx §5.2](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper.mdx)
- v1.1 metadata template: `primary_alpha` 0.01, `position_separation_m` 0.40, but `equivalence_alpha`, `smallest_effect_of_interest_ppb`, `difference_test_design_effect_ppb` are `null`; "0.01 per one-sided test is a proposed option, not a finalized founding parameter". Mixed model sketch: location term + covariates + block random effect. — [v1.1 App. A.3, C](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper-v1.1-full.md)
- Outcome classes (v1.1 §1.5): Equivalent; Detectable difference; Candidate material signal; Supported effect beyond threshold; Inconclusive; Technically uninterpretable. Protocol page: a signal "would trigger investigation and replication, not a claim of new physics". — [v1.1](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper-v1.1-full.md); [protocol/index.html](https://github.com/cssofny2/spheredesci.org/blob/main/protocol/index.html)
- Exclusions (v1.1 C.5, categories only): incomplete records, interruption, invalid signal, failed settling, required-reference loss, configuration violation, unresolved mode identity, defined incidents; reasons preserved; no fabricated missing values. Stopping: "No outcome-based stopping without a preregistered sequential procedure"; minimum placement count "is not itself proof of power". — [v1.1 C.5–C.6](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper-v1.1-full.md)
- Protocol page claims OSF finalises "sampling plan, variable definitions, primary outcome, exclusions, covariates, uncertainty treatment, multiplicity rules, stopping criteria, and analysis specifications". — [protocol/index.html](https://github.com/cssofny2/spheredesci.org/blob/main/protocol/index.html)
- Results to be published within 60 days of unblinding regardless of outcome; raw data, logs, scripts, deviations released. — same page; whitepaper §4.5.
- Thermal sensitivity estimate ~1e-4 /K (~23 Hz/K, 0.023 Hz per mK at 230 kHz). — [whitepaper.mdx §2.6](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper.mdx)

### Gaps
- Numeric SESOI/δ (ppb), equivalence α, multiplicity rules, concrete stopping criteria: not in any readable public file.

## 3. Authoritative documents, versions, dates, URLs

### Takeaway
Public records: (a) OSF preregistration (claimed published 2026-10-23), (b) Zenodo-archived whitepaper (DOI 10.5281/zenodo.23583932), (c) site whitepaper v1.0 dated 2026-10-22, (d) a v1.1 "consolidated technical draft" in the repo. The label "SPHERE-WP-001" (and "v1.6/2.0") appears nowhere in the official site repo.

### Cited Findings
- Author/org: Michael P. Goodman (ORCID 0009-0008-3796-5857), SPHERE Research, LLC, Rochester NY. — [whitepaper/index.html JSON-LD](https://github.com/cssofny2/spheredesci.org/blob/main/whitepaper/index.html)
- Registered protocol page: "Protocol LOC-1 is registered and live… published on OSF… whitepaper archived on Zenodo… neither record reports experimental results"; dated October 23, 2026; OSF is "the source of truth", whitepaper "background and technical context". — [protocol/index.html](https://github.com/cssofny2/spheredesci.org/blob/main/protocol/index.html). Commit "Publish registered LOC-1 protocol (#55)" 2026-10-23T04:34Z — [history](https://github.com/cssofny2/spheredesci.org/commits/main/protocol/index.html)
- Site whitepaper page: Version 1.0 "Technical and governance draft", October 22, 2026, "a proposal document… reports no measurements"; JSON-LD datePublished 2026-10-22, identifier 10.5281/zenodo.23583932, cites OSF URL; offers a "Publication PDF". — [whitepaper/index.html](https://github.com/cssofny2/spheredesci.org/blob/main/whitepaper/index.html); [whitepaper.mdx](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper.mdx)
- Repo also holds "v1.1 — consolidated technical draft", dated October 10, 2026, "Not operationally adopted; independent review and unresolved-parameter closure required", sections 1–5 + Appendices A–H; contains unrendered `[file:NN]` citation tokens. — [whitepaper-v1.1-full.md](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper-v1.1-full.md)
- Research notes (all "proposal stage"; none amend the registration): four-object amendment (Oct 9), hollow copper sphere (Oct 16), temperature coefficient (Oct 31), blind analysis (Nov 1), environment replay (Nov 3). — [content/research/](https://github.com/cssofny2/spheredesci.org/tree/main/content/research)
- Lab simulator metadata (our repo): CITATION.cff v2.1.0 released 2026-11-07; Zenodo community `spheredesci`; site says "SPHEREVL is an educational simulation, not measurements or scientific validation." — local `CITATION.cff`, `.zenodo.json`; [protocol/index.html footer](https://github.com/cssofny2/spheredesci.org/blob/main/protocol/index.html)
- "SPHERE-WP-001": GitHub code search in `cssofny2/spheredesci.org` returned no hits; it occurs only in our lab repo's UI strings (`src/protocol/ProtocolWorkspace.tsx`, `src/MetrologyLabV3.tsx`), which say the document "was not provided in this repository".

### Inferences
- "SPHERE-WP-001 v1.6/2.0" cannot be tied to any public artifact; the nearest public versions are v1.0 (2026-10-22, Zenodo-linked) and the v1.1 draft (2026-10-10). Don't cite WP-001 IDs in lab.spheredesci.org without a user-supplied source.

### Gaps
- Zenodo record (title, version, upload date, PDF) and OSF registration (template, timestamp, frozen fields) not opened. Whether the Zenodo PDF is v1.0 or v1.1 is unknown.
- No separate "LOC-1 schema" document found. Nearest: whitepaper §3.4 export list (21 fields: experiment_id, run_id, artifact_id, coded_position, timestamp_utc, monotonic_time, instrument_id, calibration_id, acquisition_configuration_hash, frequency_hz, frequency_standard_uncertainty_hz, reference_frequency_hz, frequency_ratio, temperature_K, pressure_Pa, drive_amplitude, clock_lock_status, external_reference_status, quality_flags, raw_record_hash, analysis_version) and v1.1 App. A (`schema_version: "proposed-1.1"`). Our lab's provisional 25-field schema cannot be confirmed against these.

## 4. Relationship to Bashar, and evidence a test has been run

### Takeaway
The project itself says the hypothesis was "inspired by" Bashar material presented by Darryl Anka and is not evidence. No document I found reports any measurement; all say none collected.

### Cited Findings
- "The project's locational-variable hypothesis was inspired by the Bashar material presented by Darryl Anka. That source is not established physical evidence. The founding packet explicitly treats it as inspiration for a testable question and excludes claims of teleportation, medical benefit, or financial return." — [whitepaper.mdx §1.3](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper.mdx); v1.1 §1.7: "inspiration, not evidence" — [v1.1](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper-v1.1-full.md). Within the repo's content sources, these were the only Bashar mentions (a repo-wide check of other files was not done, only these two were located via the downloaded set).
- The phrase "Bashar sphere location test" is not used in any source I read; it is a user/shorthand label (inference).
- Status: Oct 2, 2026 founding packet = "pre-entity, pre-funding, and without collected experimental data" (documentary baseline, not independently verified). Footer: "Protocol LOC-1 registered and live. No measurement results reported." Whitepaper §5.5 still lists "Preregister LOC-1 before confirmatory acquisition" and independent replication as pre-deployment checks; milestones M0–M5 are proposals. — [whitepaper.mdx](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper.mdx); [protocol/index.html](https://github.com/cssofny2/spheredesci.org/blob/main/protocol/index.html)
- Simulator: reviewed files "do not establish an experimentally validated digital twin, operational live telemetry, or completed Spatial Field Explorer". — [whitepaper.mdx §3.1](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper.mdx)
- Environment-replay note: "No experiment described here has been run". — [note](https://github.com/cssofny2/spheredesci.org/blob/main/content/research/environment-replay-copper-sphere-relocation.mdx)

### Inferences
- For integration: label everything as registered-plan / proposal / synthetic; never present simulator output as an experimental result. Limit Bashar wording to "inspiration, not evidence".

### Gaps
- No independent verification that equipment exists, qualification occurred, or any data exist. Repo state checked only through 2026-11-04.

## 5. Conflicts and unresolved items (not reconciled)

### Takeaway
The project's own documents contain date/status/version inconsistencies; they should be surfaced, not resolved by guessing.

### Cited Findings
- Version/date inversion: v1.1 draft dated Oct 10 vs published v1.0 dated Oct 22; whitepaper.mdx front-matter shows `date: 2026-10-10`, `version: 1.0.0` then a second block with 2026-10-22, plus a stray "<!-- Paste Perplexity Output Here -->" comment. — [whitepaper.mdx](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper.mdx); [v1.1](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper-v1.1-full.md)
- "Registered/finalized" (site, Oct 23) vs whitepapers saying SESOI/stopping etc. are frozen after qualification and preregistration "before confirmatory acquisition", with adoption pending, while no hardware or data exist. Commit #78 (2026-11-04) changed site wording from "draft LOC-1 protocol" to "registered". — [commit 1adc546](https://github.com/cssofny2/spheredesci.org/commit/1adc546)
- Four-object amendment published Oct 9 (before the Oct 23 registration) yet described as an amendment proposal to the registered plan. — [four-object page](https://github.com/cssofny2/spheredesci.org/blob/main/protocol/synchronized-four-object-frequency-measurement/index.html)
- Budget: $969k–$1.73M detailed vs $880k–$1.85M summary (project acknowledges). — [whitepaper.mdx §2.7](https://github.com/cssofny2/spheredesci.org/blob/main/content/whitepaper.mdx)
- Sphere size: 4.6 mm radius estimate (≈9.2 mm OD, provisional) vs "larger artifacts… higher-order modes" and "final geometry by FEA".
- Vacuum vs atmospheric operation and excitation compatibility unresolved (whitepaper §5.5 item 4).
- Our earlier lab-repo use of "SPHERE-WP-001" and a 25-field schema is not traceable to public sources.

### Gaps
- Resolution needs a manual read of https://osf.io/5b6mj/overview and the Zenodo PDF (https://doi.org/10.5281/zenodo.23583932), or user-supplied documents, before integration.

## Source bibliography
1. Official site repo: https://github.com/cssofny2/spheredesci.org — primary (project-authored), HEAD `3a65125`, 2026-11-04.
2. Registered protocol page: https://spheredesci.org/protocol/ (protocol/index.html) — primary overview; self-reports as registered.
3. Whitepaper v1.0: https://spheredesci.org/whitepaper/ (content/whitepaper.mdx), 2026-10-22 — proposal document.
4. Whitepaper v1.1 draft: content/whitepaper-v1.1-full.md, 2026-10-10 — unadopted draft.
5. Four-object amendment: https://spheredesci.org/protocol/synchronized-four-object-frequency-measurement/ — proposal.
6. Research notes (blind analysis 2026-11-01; hollow copper sphere 2026-10-16; environment replay 2026-11-03) — explicitly proposed/educational.
7. OSF preregistration: https://osf.io/5b6mj/overview — claimed controlling source; **not accessed**.
8. Zenodo whitepaper: https://doi.org/10.5281/zenodo.23583932 — **not accessed**.
9. Lab simulator repo: https://github.com/cssofny2/sphere-control-room-v2 (CITATION.cff, .zenodo.json) — simulator metadata; not evidence.

Source quality: all content is self-published by the project's single named author/entity; no independent review, replication, or third-party verification found. JSON-LD, footers and SEO copy are not validation.

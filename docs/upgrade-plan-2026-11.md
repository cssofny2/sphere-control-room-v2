# Ten major upgrades, ranked by impact (Nov 2026)

Builds on `docs/roadmap-opportunities.md` (20 unprioritised candidates). Each item below cites what the code does today, so scope is grounded. Sizes: S ≈ 1–2 days, M ≈ 3–5, L ≈ 1–2 weeks. Ship one PR per item; every item adds its own `scripts/*.test.mjs` to the `npm test` chain.

## Ranking rationale

Impact = scientific credibility + what users lose today + reach (education, open science) + how many other items it unlocks.

| # | Upgrade | Size | Unlocks |
|---|---|---|---|
| 1 | Real measurement engine (Lorentzian fit, computed uncertainty, repeatability stats) | M | 4, 5, 6, 9 |
| 2 | Durable sessions and run library (IndexedDB autosave, no 200-record cap) | M | 4, 5, 10 |
| 3 | Guided curriculum with auto-graded scenarios and classroom report | L | — |
| 4 | Reproducibility bundles and validated import | M | 5 |
| 5 | Run comparison and overlay analysis | M | — |
| 6 | Adaptive sampling planner, field-model fit, 3D point annotations | L | — |
| 7 | Accessibility and mobile overhaul | M | — |
| 8 | Deep links, embed mode, offline PWA | S–M | — |
| 9 | Dr. Wire run-review coach | M | — |
| 10 | Live acquisition timeline and scrub-back | M | — |

**Build order (dependencies, not impact):** 1 → 2 → 4 → 5, then 3 and 6 in parallel, then 9, 10; 7 and 8 can interleave anywhere (8's deep links are cheap and useful early).

---

## 1. Real measurement engine — M — DONE (branch `feat/measurement-engine`)

> Delivered. Deviations from the plan below: no Web Worker, because a 1001-point fit takes 1–2 ms (measured in `scripts/measurement.test.mjs`); extra scope that fell out of the work: the S11 "Fit" overlay and dashboard tile no longer show model truth, and rescanned attempts are counted once in the statistics.

**Why.** Every record's `resonance` is `min.freq`, the lowest trace sample (`MetrologyLabV3.tsx:973`). `uncertaintyHz` is a constant 0.25, `repeatSdHz` a constant 0.05, `q` a constant 1200/4500 (`:977-981`). The README admits this. For a metrology product this is the largest credibility gap, and the quality gates (`evaluateScanRecord`, `:274`) and the uncertainty halos on the spatial map (`:2510`) all read those fake numbers.

**Scope.**
- `src/simulation/measurement.ts`: Levenberg–Marquardt fit of `s11 = a + d / (1 + ((f − f0)/γ)²)` (the simulator's own dip is exactly this form, so recovery is checkable), returning `f0`, `Q = f0/(2γ)`, depth, and `σ(f0)` from the covariance matrix. Graceful `fit: failed` result for no-dip or saturated traces.
- `src/simulation/stats.ts`: Welford accumulators per planned position → mean, SD, SEM, Type-A standard uncertainty, k=2 expanded uncertainty; repeat count from `repeatIndex`.
- `src/simulation/fit.worker.ts`: fit off the UI thread with progress and cancel (covers roadmap #20).
- Extract `trueFrequency`, `buildSweep`, `noise` from the 3.5k-line monolith into `src/simulation/model.ts`. `scripts/simulator-regression.mjs` currently AST-slices the monolith by function name; update its `names` set and imports.
- Replace record fields at `:973-981`; bump `MODEL_VERSION` to `sphere-teaching-model-v2` (fields are additive, so `RUN_SCHEMA_VERSION` stays 1).
- Runs page: replace the "all-record spread (not repeatability)" note with a per-position summary table; `evaluateScanRecord` thresholds use computed uncertainty.

**Tests.** `scripts/measurement.test.mjs`: recover a known f0 within tolerance on seeded noisy traces; σ shrinks ≈ 1/√N with averaging; Q ≈ 4500 / 1200 by pressure; failure path on flat trace; stats match a hand-computed fixture.

**Done when.** No hard-coded uncertainty, Q or repeat SD remains in record creation; README caveat removed.

## 2. Durable sessions and run library — M — DONE (branch `feat/durable-sessions`)

**Why.** Reloading loses everything (README: notes "survive breaker cycles but not a page reload"). The ledger is hard-capped at 200 (`:498`), events at 200 (`:209`), and the ledger table renders every row unvirtualized.

**Scope.**
- `src/persistence/store.ts`: small IndexedDB wrapper behind a storage interface (no new dependency); `try/catch` fallback to in-memory like the existing `localStorage` call sites.
- Autosave via `onLabTransition` (`src/state/labStores.ts`), debounced: runs, records, notebook, events. Operator profile stays in `localStorage`.
- "Resume session from <time>?" prompt on load; Run Library panel on Runs page (list, rename, delete, export).
- Raise the cap to a 50k soft limit; virtualize the ledger table.

**Tests.** Storage-interface tests with an in-memory implementation; a mounted jsdom test (pattern in `tests/mounted`) for save → remount → restore; quota-exceeded and blocked-storage paths.

## 3. Guided curriculum with auto-graded scenarios — L

**Why.** `CHALLENGES` (5 one-line checks, `:100`), `PROCEDURE_STEPS`, TrainingMode, FaultInjector and badges exist but are disconnected, have no objectives/hints/scoring, and nothing is reportable to a teacher.

**Scope.**
- `src/curriculum/lessons.ts` (data): id, level, objectives, staged hints, setup (dispatch sequence), pure `check(state, records)` predicates, score weights.
- `src/curriculum/LessonRunner.tsx`: side panel with progress, hints, reset-to-start; new "Learning Paths" page. Progress persisted via #2's store.
- Ten launch lessons, e.g. startup and vacuum; VNA calibration; thermal coefficient (hidden truth 5 Hz/°C); location sensitivity (hidden 45.2/−12.5/80.1 Hz/mm: student estimates from a 3-axis scan, graded within tolerance); clock-drift and EMI diagnosis; averaging vs repeatability (needs #1); ordered vs randomized plan drift.
- Classroom mode: printable completion report (name, score, lesson list, content hash). No server needed.

**Tests.** `scripts/curriculum.test.mjs`: every lesson has a scripted golden solution that passes headlessly through the reducer, and a no-op run that fails — guards against physics changes silently breaking lessons.

## 4. Reproducibility bundles and validated import — M — DONE (branch `feat/repro-bundles`, stacked on `feat/durable-sessions`)

**Why.** `exportJson` dumps the entire app `state` (UI flags, modals and all, `:1014`); `exportCsv` skips CSV escaping and drops quality, uncertainty and repeat columns (`:1005`) although `csvEscape` already exists (`:290`). Zenodo/ORCID metadata shows open science is a project goal.

**Scope.**
- `src/domain/bundle.ts`: versioned `*.sphere.json` — schema/model/app versions (`__COMMIT__` is already defined by Vite), run contract, plan, acquisitions, records with fits, notebook, settings, SHA-256 (WebCrypto), citation block from `CITATION.cff`.
- `validateBundle(unknown)` returning `{field, message}` issues in the style of `plan.ts`; import preview dialog (counts, version-mismatch warnings).
- "Verify" action: recompute each record's trace from recorded settings and position with the pure `buildSweep` and report deviations. (Full deterministic replay is explicitly not claimed; CR-101 doc says it is not delivered.)
- External CSV import with column-mapping preview (roadmap #6). Fix CSV export.

**Tests.** Round-trip equality; checksum tamper detection; hostile inputs (NaN, huge arrays, `__proto__` keys, oversize files); older-version bundle migration.

## 5. Run comparison and overlay — M — DONE (branch `feat/run-compare`)

**Scope.** `src/analysis/compare.ts` (pure) and a Compare tab on Runs. Pick 2–4 saved runs (#2). Overlay f0-vs-position lines with Recharts (already a dependency); match positions by rounded coordinates; per-position Δ table with Welch t-test using #1's σ; difference map by letting `SpatialMaps` take a second record set; conditions diff (temperature, pressure, clock lock, Faraday/isolation, model flags) with a rule-based "what changed" line (e.g. "+15 Hz offset ≈ ΔT 3 °C × 5 Hz/°C").
**Tests.** Pure-function fixtures for matching, deltas, t-test, conditions diff.

## 6. Adaptive sampling planner, field-model fit, 3D annotations — L — PARTLY DONE (branch `feat/spatial-planner`)

> Delivered: field fit, real coverage, maximin point suggestions with Go-to-stage. Not delivered: a multi-point `custom` plan kind for "Add to plan", and 3D point annotations.

**Why.** Spatial Field Explorer shows measured points and IDW/RBF only. "Coverage" is `records/25` (`:3149`), a placeholder. `plan.ts` rejects multi-point manual plans (`:151`), so suggested points need a new plan kind.

**Scope.**
- `src/spatial/planner.ts`: rank candidate grid points by predictive variance (leave-one-out error for IDW, or kriging variance), show ranked suggestions in the existing "planned points" overlay, "Add to plan" via a new `custom` plan kind in `plan.ts` and the domain contract.
- Linear field fit `f0 = c + a·x + b·y + c·z` by least squares with residuals, R² and coefficient σ; in teaching mode compare to the hidden truth. Real coverage metric replaces `/25`.
- 3D annotations (roadmap #4): recorded points colored by metric in the Engineering view first (`twinParts` SVG painter), Realistic lab later.
**Tests.** Planner picks the known gap on a synthetic layout; fit recovers the model's 45.2 / −12.5 / 80.1 Hz/mm; new plan kind validation negatives.

## 7. Accessibility and mobile overhaul — M — DONE (branch `feat/a11y-mobile`)

> The searchable keyboard parts list already existed in the engineering schematic. Axe checks were run by hand against the dev server (axe-core from a CDN), not added to CI; the CI test guards the code-level fixes. i18n scaffolding was not attempted.

**Why.** 65 aria/role attributes across 3.5k lines; only two color ramps (`RAMPS`, `:2287`); 3D parts are pointer-pick only; modals (`confirmModal`, VNA calibration, command palette) need audited focus handling.

**Scope.** Searchable keyboard parts list for the 3D views (roadmap #14, builds on `engineering/parts.ts` + `selection.ts`); colour-vision-safe ramps (viridis/cividis) and a `prefers-contrast` pass; `aria-live` region for alarms and run events; focus trap/return for all dialogs; 360 px layout pass with no horizontal scroll; automated axe checks added to the mounted jsdom suite. i18n scaffolding (en/es for chrome and glossary) as an optional stretch.
**Tests.** axe violations = 0 on each page; keyboard-only walkthrough script.

## 8. Deep links, embed mode, offline PWA — S–M — DONE (branch `feat/links-embed-pwa`)

> Not delivered: deep links to a specific run or lesson (lessons do not exist yet; runs live only in the local browser store). Header changes affect Cloudflare deploys only; vercel.json sends no framing headers.

**Why.** The only URL state is `?labdebug` / `?nomerge`; pages can't be linked. `public/_headers` sets `X-Frame-Options: DENY` and `frame-ancestors 'none'`, so the lab cannot be embedded in spheredesci.org/vl or the whitepaper.

**Scope.** Hash router synced with `navigate` (`#/vna`, `#/runs/<id>`, `#/lesson/<id>`); Share button; `?embed=1` hides header/journal; change `_headers` to `frame-ancestors https://spheredesci.org` (and the www host) while keeping DENY semantics for everyone else; web app manifest + service worker precache so the simulator works offline (Dr. Wire cloud features degrade as they already do); `seo-plugin.mjs` emits the manifest and `seo.test.mjs` asserts it.
**Tests.** Router round-trip; headers test; embed-mode render; SW precache list matches the build.

## 9. Dr. Wire run-review coach — M — DONE (branch `feat/run-review`)

> Deterministic review only; the optional AI paraphrase through server.ts was not added, because the computed review already reads naturally and adds no spend or injection surface.

**Why.** Dr. Wire is the project's most-invested feature but cannot reason about measurement results. With #1's numbers he can.

**Scope.** `src/technician/reviewRun.ts`: deterministic findings from run stats (coverage gaps, drift vs time, repeatability, environment mismatch, calibration state, reference usage, quality-gate failures), each with severity and a suggested next action. "Review my run" intent in `intents.ts`/`actions.ts`; spoken and shown on his desk screen. Optional LLM paraphrase through the existing `server.ts` path (same-origin check, rate limit, daily cap); the model only rephrases computed findings and cannot start lab actions (existing safety rule).
**Tests.** `scripts/technician-review.test.mjs` in the style of the other technician suites; offline path needs no API key.

## 10. Live acquisition timeline and scrub-back — M — DONE (branch `feat/timeline`)

> Not delivered: persisting the telemetry across reloads (it is memory-only) and PNG export.

**Scope.** 1 Hz telemetry ring buffer slice (pressure, temperature, f0, stage position, turbo RPM; ~1 h) persisted via #2; `src/features/Timeline.tsx` with synchronized Recharts panels and shared brush, markers for alarms, operator actions (events already carry time, subsystem, run id, xyz) and scan points; scrub freezes a read-only telemetry view (not full state replay); export PNG/CSV.
**Tests.** Ring-buffer bounds and downsampling; marker alignment fixtures.

---

## Cross-cutting rules for every PR

- Keep `npm test` and `npm run build` green; add the new test script to the `test` chain in `package.json`.
- Update `CHANGELOG.md` under Unreleased and the README sections that describe behavior you changed.
- Simulation output remains labelled illustrative; never imply experimental evidence.
- No new runtime dependency without a stated reason (IndexedDB wrapper and router are hand-rolled on purpose).

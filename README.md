# S.P.H.E.R.E. Metrology Lab

A Vite + React + TypeScript package for the S.P.H.E.R.E. location-variable metrology laboratory simulator and Spatial Field Explorer.

## Requirements

- Node.js 24.x (matching `.nvmrc`, `package.json`, and Vercel)
- npm

## Start the development app

```bash
npm ci
npm run dev
```

Open the local address printed by Vite, normally `http://localhost:5173`.

## Production build

```bash
npm run build
npm run preview
```

The compiled production files are written to `dist/`.

## Main files

- `src/MetrologyLabV3.tsx`: active v3 simulator, including Lab Overview and the interactive laboratory digital twin
- `src/MetrologyLab.tsx`: retained earlier simulator (not imported by the entry point)
- `src/main.tsx`: React entry point importing the v3 simulator
- `src/index.css`: Tailwind directives and global styles
- `vite.config.ts`: Vite configuration
- `tailwind.config.cjs`: Tailwind source scanning

## Spatial Field Explorer

Open **Spatial Field Explorer** from the simulator navigation to inspect simulated records collected during experiment runs.

## Vercel deployment

The repository's `vercel.json` selects Vite, installs the committed lockfile with `npm ci`, runs `npm run build` (including TypeScript checks), and serves `dist/`. Pull requests receive preview deployments; the `main` branch is the production source.

## v3 smoke checks

- Open the Operator Console and each navigation page, including Lab Overview.
- In 3D Chamber & Stage, exercise the digital twin's view modes, camera presets, render-quality selector, assembly visibility, and Reset view.
- Turn the main breaker on, move and home the XYZ stage, then turn the breaker off to confirm reset.
- Verify an empty Experiment Runs ledger renders without crashing.
- Check desktop and mobile layouts and confirm there are no uncaught browser errors.

## Updated simulator features

- **Living Lab Overview:** persistent telemetry and subsystem-state indicators.
- **Training & Checklist:** automated 5×5 serpentine scan with stage settling, quality gates, bounded adaptive retries, pause/resume/abort, and quality CSV/JSON exports.
- **AI Copilot:** a local, rule-based assistant, not a hosted AI model or an experimental significance test.
- **Fault Injector:** individual equipment faults plus blind troubleshooting drills.
- **Lab Notebook:** tagged notes with instrument snapshots and Markdown export. Notes survive breaker cycles but not a page reload.
- **Pump and stage simulation:** roughing/turbo lifecycle and commanded-versus-actual stage motion.

## Regression tests

```bash
npm test
```

The tests execute the simulator's actual helper functions using Vite's bundled parser. They cover high vacuum, stage settling, fault effects, adaptive retry limits, interlock resume/abort, notebook retention, and validation.

## Compact workspace

- The header and essential status strip remain visible while only the instrument workspace scrolls.
- The operations journal starts collapsed. Open it from the header; drag its left edge on laptops/desktops or its top edge on tablets to resize it. A focused resize handle supports arrow keys, Home/End, and double-click reset.
- Journal filters and dimensions survive collapse/expand and instrument focus mode within the current session.
- **Focus** hides navigation and the journal without resetting instruments. Press **F** to toggle focus or **Escape** to restore the workspace.
- **Fullscreen** uses the browser fullscreen API. If fullscreen is unavailable in an embedded preview, the app falls back to instrument focus.
- On tablets, navigation opens as a drawer rather than pushing the instrument below a fixed panel. The workspace picker also provides direct navigation.
- Startup Wizard, operating mode, simulation speed, reference material, detailed telemetry, and visual-effect settings are available in **Workspace tools**.

## CR-101: Validated plans and typed contracts

- `src/domain/run.ts` defines branded run/plan/point/event IDs, model/schema versions, units, the run contract, and copied capture settings.
- `src/domain/acquisition.ts` separates planned acquisition slots from actual capture attempts, including run/point links, repeat index, attempt index, simulation time, and actual coordinates.
- `src/simulation/plan.ts` validates before allocating point arrays. Defaults are ±35 mm travel, 1–100 repeats, and at most 1,000 planned acquisitions (including repeats but excluding adaptive retry attempts).
- Axis plans reject non-finite values, zero/negative steps, reversed ranges, invalid axes/seeds/repeats, and excessive counts. Non-divisible ranges omit the upper endpoint and show that policy in the preview.
- Fisher-Yates randomization uses the supplied seed. Ordered coordinates and execution order are shown separately; identities remain unique between runs.
- The Experiment Runs custom plan now hands its validated acquisitions to the existing scan sequencer instead of scheduling a nested timer queue. A 5×5 training scan retains its one-acquisition-per-position behavior.
- Accepted plans are locked while active. Duplicate starts, wrong-run records, and repeated capture IDs are rejected at the reducer boundary.
- JSON session exports include the run and acquisition contracts. The run's initial settings are copied separately from each acquisition's actual capture settings.
- A strict TypeScript build checks the domain modules and negative type fixtures without claiming that the whole legacy UI has been migrated to strict types.

CR-101 does not deliver the dedicated CR-102 runner, its complete cancellation/fresh-state audit, autosave, archival retention, validated import, computed uncertainty, per-position statistical summaries, or complete deterministic execution replay. The in-memory ledger still retains only 200 records; larger accepted plans show a warning. Existing fixed uncertainty/repeat-summary placeholders remain for subsequent interpretation/analysis tickets, and the all-record spread is not a repeatability estimate.

## Notes

- Simulator output is illustrative and is not experimental evidence.
- Data exports are generated locally in the browser.
- The tutorial-video panel requires internet access to load embedded videos.

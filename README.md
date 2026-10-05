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

## Notes

- Simulator output is illustrative and is not experimental evidence.
- Data exports are generated locally in the browser.
- The tutorial-video panel requires internet access to load embedded videos.

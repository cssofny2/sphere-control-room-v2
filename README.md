# S.P.H.E.R.E. Metrology Lab

A Vite + React + TypeScript package for the S.P.H.E.R.E. location-variable metrology laboratory simulator and Spatial Field Explorer.

## Requirements

- Node.js 20 or newer recommended
- npm

## Start the development app

```bash
npm install
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

- `src/MetrologyLab.tsx`: complete simulator
- `src/main.tsx`: React entry point
- `src/index.css`: Tailwind directives and global styles
- `vite.config.ts`: Vite configuration
- `tailwind.config.cjs`: Tailwind source scanning

## Spatial Field Explorer

Open **Spatial Field Explorer** from the simulator navigation. If no experimental measurements exist yet, use **Load Demo Volume** to populate a clearly labeled synthetic demonstration dataset.

## Notes

- Simulator output is illustrative and is not experimental evidence.
- Data exports are generated locally in the browser.
- The tutorial-video panel requires internet access to load embedded videos.

# Lab website improvement opportunities

These are candidate improvements for future planning, not committed scope.

## Features and simulation upgrades

1. **Experiment templates** — Start common calibration and validation workflows from reviewed, editable parameter sets.
2. **Run comparison** — Overlay multiple experiment runs and highlight changes in resonance, quality, and environmental conditions.
3. **Spatial sampling planner** — Recommend measurement locations that improve coverage or reduce uncertainty in the field map.
4. **3D measurement annotations** — Show recorded points, scan paths, and quality flags directly on the chamber scene.
5. **Reproducibility bundles** — Export run settings, model version, calibration context, and results as one portable archive.
6. **Data import with validation** — Bring in external measurements with schema checks and a clear mapping preview.
7. **Scenario library** — Offer guided fault-injection exercises with objectives, hints, and a resettable lab state.
8. **Saved experiment drafts** — Preserve in-progress setup locally and restore it after a reload.
9. **Live acquisition timeline** — Align instrument readings, operator actions, alarms, and scan progress on one timeline.
10. **Simulation assumptions panel** — Make model limits and simplifications discoverable alongside affected outputs.

## UI and workflow improvements

11. **First-visit lab tour** — Guide new users through the chamber, stage controls, instrument panels, and safe simulation boundaries.
12. **View presets** — Save and restore camera, visibility, and display settings for common inspection tasks.
13. **Synchronized view comparison** — Compare the realistic scene, engineering model, and schematic without losing the selected component.
14. **Keyboard-accessible 3D selection** — Provide a searchable parts list and focus-to-highlight behavior for users who cannot use pointer picking.
15. **Responsive instrument workspace** — Make key readings and controls practical on narrow screens without horizontal scrolling.
16. **Accessible visualization settings** — Add color-vision-safe palettes, stronger focus indicators, and explicit non-color status cues.
17. **Contextual explainers** — Link measurements and controls to concise definitions, assumptions, and relevant procedures.

## Performance and reliability

18. **Demand-driven 3D rendering** — Pause rendering when the scene is hidden or unchanged, and resume promptly on user interaction.
19. **Adaptive 3D detail** — Scale pixel ratio and model detail to device capability while preserving readable labels and controls.
20. **Worker-backed analysis** — Move expensive fitting and spatial-field calculations off the UI thread, with progress and cancellation.

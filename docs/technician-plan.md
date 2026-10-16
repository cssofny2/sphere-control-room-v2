# Dr. Wire: lab technician plan

Living plan for the voice-capable lab technician. Written during Phase 0 and updated as phases land.

## Repo facts this work relies on

- Vite 8, React 19, TypeScript, Tailwind v4. three.js is lazy-loaded (its own chunk). Vercel builds with `npm test && npm run build`; Cloudflare Workers also builds the static output.
- App state lives in one reducer in `src/MetrologyLabV3.tsx`. The 3D scene reads it through a stable `stateRef`, so the scene never re-renders on simulation ticks.
- Reducer actions that matter: `POWER`, `PATCH {domain, patch}`, `MOVE_STAGE`, `HOME_STAGE`, `CALIBRATE_VNA`, `START_SCAN`, `PAUSE_SCAN`, `RESUME_SCAN`, `ABORT_SCAN`, `ACK_ALARM`, `SET_FAILURE`, `CLEAR_FAILURES`, `START_FAULT_DRILL`, `NOTEBOOK_ADD`.
- Interlocks already enforced by the reducer: stage moves are rejected when the facility is off, the door is open, the clamp is active, or a vent cycle runs; scans need facility power, VNA power and RF, and are blocked by clamp, open door or vent; only one run may own the instruments.
- Simulation numbers: roughing pump to about 50 Torr, turbo below 1e-3 Torr; the turbo above 50 Torr raises a critical alarm; clock warm-up is 15 simulated seconds; temperature is valid within 0.03 °C; VNA calibration lasts 3600 s and is invalidated by center/span changes; stage limit is plus or minus 35 mm.

## Architecture

```
src/technician/
  facts.ts            live facts + readiness rules from app state
  dialogue.ts         event/fault/trend/escalation engine, modes, sliders, log with reasons
  jokes.ts            63 original jokes tagged by topic
  answer.ts           live-state answers + knowledge retrieval, says "I don't know"
  knowledge/*.md      hand-written knowledge (source of truth)
  knowledge.generated.ts   built from the .md files + GLOSSARY, PROCEDURE_STEPS, FAULT_CATALOG, OVERVIEW_HELP
  TechnicianPanel.tsx modes, sliders, ask box, log with "Why did you say that?"
```

```
src/technician/ (phases 4-6)
  actions.ts          one registry of lab actions: schema, risk, interlocks, "done" checks; palette + AI tools both use it
  taskRunner.ts       multi-step tasks: walk to station, narrate, check, confirm, run, wait; cancel + emergency stop
  callController.ts   phone call states, mic/typing consent, barge-in, sentence-chunked speech, AI tool loop (max 8)
  speech.ts, intents.ts, llm.ts, snapshot.ts, persona.ts, system.ts, CallUI.tsx
  server.ts           request handler (origin, size, rate and spend limits, caching); api/technician.ts is the thin Vercel wrapper
src/engineering/ (phase 7)
  parts.ts            tagged part registry, health, fault/alarm ownership, signal-path links (pure, unit-tested)
  selection.ts        one selected part shared with the realistic lab (window event 'lab-part-click')
  Schematic.tsx       lazy "Engineering schematic" view: parts list, P&ID / dimensioned cutaway / signal path, inspector
```

Schematic notes: statuses use shape plus colour (Okabe-Ito palette); flow lines are CSS dash animation and are switched off for reduced motion; the exported SVG embeds its own style and colour variables so it opens standalone; PDF export uses the browser print dialog. Only the stage travel (+/-35 mm) in the cutaway comes from the simulator; wall sizes are labelled conceptual.

`npm run build:knowledge` regenerates `knowledge.generated.ts`; `npm test` runs `build-knowledge.mjs --check` so a stale file fails the build.

## Behaviour rules

- Safety events (critical alarm, vacuum leak, laser with the door open, turbo protection) never get jokes, and jokes stay off for 30 s after any alert.
- Every spoken line is stored in the log with the reason it was said.
- Fault scripts follow headline, effect, cause, check, fix, hold. Low detail keeps the headline and the final instruction.
- During a blind fault drill he describes symptoms only and never names the hidden fault.
- Unresolved alarms and faults escalate at 30 s, 90 s and 180 s: reminder, warning, blocking.
- If a question is not in live state or the knowledge base, he says he does not know and records it in session memory.

## Open Questions (gaps in repo documentation)

1. The in-app validation rules are duplicated in `facts.ts` (`readiness`) because `getMeasurementValidation` is not exported from `MetrologyLabV3.tsx`. Exporting it would remove the duplicate.
2. `GLOSSARY`, `PROCEDURE_STEPS` and `FAULT_CATALOG` are un-exported constants; the knowledge generator reads them by parsing the source text. Moving them to a module would be cleaner.
3. No documentation says what real-lab remedies apply to a vacuum leak (the app only has a "clear the fault" button). The leak fix text includes generic real-lab advice that the lab owner should confirm.
4. The exact meaning of the quality-gate thresholds (accepted, suspect, failed) is not documented outside the code; Dr. Wire only reports the counts.
5. The physical sphere material, size, and the true resonance mode are not described anywhere in the repo, so Dr. Wire says he does not know.
6. Spoken-language and accent preferences, and whether a paid text-to-speech provider is wanted later, are undecided. The baseline uses the browser's free speech engine.

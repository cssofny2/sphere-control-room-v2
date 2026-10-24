# Changelog

Versions follow semantic versioning. The version lives in `package.json` and is shown in the top-left corner of the app next to the S.P.H.E.R.E. logo.

## [2.0.0] - 2026-10-24

### Changed
- The realistic 3D lab (Three.js) and its audio and technician-voice code now download only after the 2D operator dashboard has painted and the browser is idle, so the dashboard is no longer competing with the 3D assets for the initial load. A "Loading Lab Environment…" skeleton shows meanwhile.
- Academic release metadata (Zenodo and ORCID) is included in `package.json` and `CITATION.cff`.

## [1.7.0] - 2026-10-17

### Added
- Dr. Wire's everyday conversation is about ten times larger: 134 topics, nearly 400 differently worded answers and over 600 example questions, all answered offline and in character. They cover work and schedule (when he gets off, starts, takes lunch, weekends, on call, commute), pay (hourly rate, salary, raise, benefits, overtime), his life (age, home, family, pets, hobbies, favorites), how he feels, manners (compliments, thanks, apologies, rudeness), what you tell him about your own day (tired, hungry, stressed, birthday, good or bad news), short back-channel replies ("cool", "really?"), and everyday world questions. The full list is in `docs/dr-wire-conversation.md`.
- He keeps a conversation going: he sometimes asks something back ("What about you?"), reacts to your answer (dogs, kids, coffee, sports), and then steers gently back to the lab. He never asks back during alarms or while busy, rotates his wording, and acknowledges when you ask the same thing twice. Weather asks for your city and then looks it up.
- "When do you get off work" now has time-aware, natural answers (nearly done, plenty of day left, already ended).
- One consistent character (`personaBible.ts`) shared by the offline answers and the AI persona, so improvised answers cannot contradict the scripted ones. Asked sincerely whether he is a real person, he says he is a simulated technician.

### Changed
- Everything he says now passes through a fluency layer: contractions, "Cause / Effect / Check / Fix" labels turned into spoken sentences, and a lead-in or closing question on longer explanations.
- The AI persona prompt now asks for connected, flowing speech instead of lists of facts.

## [1.6.0] - 2026-10-17

### Fixed
- High quality is no longer washed out: the bloom pass that smeared every bright metal highlight into a white haze is removed, the exposure is lower, the chamber lamp and ceiling light panels are dimmer so the polished chamber liner no longer flares, and the walls and floor are a little darker so there is contrast to see.

### Added
- A right-hand wall and many more lab objects: fume hood with a sash and exhaust duct, a bench with a sink, tap, towel dispenser and reagent shelf, an eyewash and drench shower, a tall chemical storage cabinet, a rolling tool chest, waste and recycling bins, stools, a gas cylinder rack, a coat rack with a spare lab coat, a wet-floor sign, an anti-fatigue mat, overhead ductwork, a cable tray, sprinkler heads, exit signs, a first-aid kit, a fire alarm pull station, an extinguisher and a hazards poster. All of it is merged into the static scene, so the draw-call cost stays small.
- Dr. Wire looks more lifelike: skin with pores and colour variation, flushed cheeks and a five o'clock shadow, sheen on skin and hair, strand-textured hair with a fringe and fuller back, limbal rings and catchlights in the eyes, nostrils, shaped lips, fingernails, woven-cloth bump on the lab coat, shirt and trousers, shirt buttons and a belt buckle.

## [1.5.0] - 2026-10-17

### Added
- Ask Dr. Wire for any lab action on the phone, by voice or typing. "Run the startup sequence" sends him round the lab in poster order: main breaker, Rubidium clock, VNA, vibrometer, Faraday cage, vibration isolation, close the chamber door, roughing pump then turbo, wait for the clock lock, calibrate the VNA. It skips what is already done and never opens the laser shutter. "Run the shutdown sequence" closes the shutter, pauses a scan, stops the turbo and powers the instruments off. Single commands such as "turn on the VNA", "close the laser shutter", "start the turbo", "set the temperature to 22", "vent the chamber" or "go to the VNA page" work the same way, and every interlock and confirmation still applies. New registry action `wait_clock_lock`.
- Wall clock that shows Eastern time (America/New_York, EST or EDT as it applies) whatever the visitor's own time zone, and a wall calendar that shows the current Eastern date and redraws when the date changes.
- Realistic lab audio: layered footsteps (heel thud, contact click, sole scuff, occasional rubber squeak, alternating feet, per-step variation) with room reverb and stereo position and loudness that follow the camera; an ambient bed with HVAC, light hum, rack fans, a roughing pump and a turbo whine that follow the real instrument state; a quiet wall-clock tick; better latch and relay sounds.

### Changed
- The call panel is much smaller (about 264 px wide, 11 px text), translucent, shows the last three lines, and keeps the audio and microphone controls behind an Options button.
- The two computer monitors are larger again (0.96 m by 0.56 m, up from 0.74 m by 0.43 m).

## [1.4.0] - 2026-10-17

### Added
- Natural "studio" voice for Dr. Wire: a neural text-to-speech service (`/api/tts`, ElevenLabs or OpenAI) plays instead of the browser voice when a key is set on the server (`ELEVENLABS_API_KEY` or `OPENAI_API_KEY`). It is off until then. If the service is off, busy, slow or offline, Dr. Wire keeps talking with the browser voice, so a call never goes silent. The first phrase is kept short so the voice starts quickly, the next one is fetched while the current one plays, and repeated lines are cached in memory. A "Studio voice" switch appears in the call panel when it is available.
- The studio endpoint has the same guards as the other endpoints: same-origin only, a per-client rate limit, a daily spend cap (`TECHNICIAN_TTS_DAILY_CAP_USD`, default 2 USD), short bodies, and text and audio are never logged.
- Performance test (`tests/e2e/perf.e2e.py`) that checks the draw-call saving and that the merged scene looks identical, including the moving parts.

### Changed
- Much smoother 3D lab: the static parts of the room are fused into a few meshes per material (about 830 down to about 290 draw calls per frame, half the triangles), the shadow map refreshes every second or third frame instead of every frame, the bloom runs at half resolution, SMAA is skipped on high-DPI screens, and phones and tablets skip 4x MSAA. Quality drops sooner on a slow device (below about 38 frames a second) and, if it is still slow, the resolution steps down.
- The speech bubble no longer forces a page layout on every frame.

## [1.3.0] - 2026-10-17

### Added
- Dr. Wire asks who he is speaking with when he picks up the phone and uses the first name now and then (not in every sentence). The name is kept in memory for the page only, is never written to storage, and is sent to the AI service with your questions. He re-confirms it on the next call, and respects "I'd rather not say".
- Many different ways of not knowing: ten "I don't know" phrasings, eight "let me look it up" lead-ins, "I'm not sure, but..." hedges for weak matches, and the language model is told to vary its wording too. No phrase repeats twice in a row.
- Search almost any topic: Brave Search (if `BRAVE_SEARCH_API_KEY` is set) or Claude web search, then Claude's general knowledge when search is unavailable (clearly labelled "not a live search"), then Wikipedia straight from the browser when the service is not set up. The desk shows the result type and he says where the answer came from.
- A more natural voice: lab abbreviations and units are pronounced properly (V N A, kilohertz, 1e-3), speech is cut into phrases with their own pace, pitch and pauses (questions rise, "Hmm," is slower), the best male English voice the browser offers is chosen automatically, and a voice picker appears in the call bar.
- A realistic Dr. Wire: a solid, shaded figure with proportioned head, face, glasses, hair, a blue shirt, trousers, shoes and an open white lab coat. The S.P.H.E.R.E. logo is on the left chest and large on the back, with an ID badge and pocket outlines.
- Screensaver on his left monitor after 90 seconds of no use (a turning copper sphere and a 230 kHz trace). It wakes when he uses the computer.
- Three security cameras mounted in the lab (blinking red lights) and a Cameras control: Cam 1 (overview), Cam 2 (workstation), Cam 3 (chamber and rack) as fixed views with a time stamp and REC light, plus an All cams grid.

### Changed
- The greeting is "Lab, Dr. Wire speaking. Who am I speaking with?"; spoken text says "Doctor Wire".

## [1.2.1] - 2026-10-17

### Fixed
- Microphone on Android tablets: the call no longer holds the microphone stream open (it blocked speech recognition), recognition restarts per phrase instead of running continuously, and a busy microphone now gives a clear message with typing still available. Barge-in (talking over Dr. Wire) is off on Android.

## [1.2.0] - 2026-10-17

### Added
- Dr. Wire's workstation has two large LCD monitors (browser and email on the left, the SPHERE acquisition screen on the right), a "Screens" camera, and a text mirror of his screen beside the 3D view.
- Natural small talk with exact answers: the time, the date, when his shift ends, how his day is going. He asks questions back (how is your day, lunch?) and reacts to the answers.
- When he does not know something he goes to his computer, types the search with keyboard sounds, shows the results on screen and reads the answer, naming the source (needs `ANTHROPIC_API_KEY`; says so plainly when search is not available).
- Lunch: he builds a DoorDash cart (McDonald's or another place) and hands you a button to check out. The app never enters payment details.
- Parts: he writes a purchase requisition, asks you to approve it, submits it and calls back with the estimated arrival date. Nothing is paid by the app.
- Email: an address for his computer. Mail makes a chime, he walks to the desk, reads it on screen, writes a reply and sends it to the sender (needs inbound mail routing, a Resend key and an allow-list; see `docs/technician-v2.md`).
- Typing and new-mail sound effects.
- New endpoints `api/lookup`, `api/email`, `api/email-inbound`.

### Changed
- Offline question matching no longer treats a single shared word as an answer, so unrelated questions are looked up instead of answered wrongly.

## [1.1.0] - 2026-10-16

### Added
- Version number shown beside the logo at all times, with build date and commit in its tooltip.
- Credit to Michael P. Goodman as author and developer, and a copyright notice for SPHERE Research, LLC, in the app footer, page metadata and structured data.
- SEO: richer title and description, Open Graph and Twitter cards, JSON-LD (WebApplication, Organization, Person), favicon, social image, `robots.txt` and a `sitemap.xml` that is generated on every build.
- Call Dr. Wire: phone call to the lab technician with voice, typing fallback and AI answers (needs `ANTHROPIC_API_KEY`).
- Task runner, shared action registry with safety interlocks, and the Engineering schematic view (P&ID, dimensioned cutaway, signal path).

## [1.0.0]

- Initial public release of the S.P.H.E.R.E. Metrology Lab simulator.

# Changelog

Versions follow semantic versioning. The version lives in `package.json` and is shown in the top-left corner of the app next to the S.P.H.E.R.E. logo.

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

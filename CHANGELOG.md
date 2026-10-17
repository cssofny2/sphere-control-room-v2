# Changelog

Versions follow semantic versioning. The version lives in `package.json` and is shown in the top-left corner of the app next to the S.P.H.E.R.E. logo.

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

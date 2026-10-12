# Interface overhaul: initial audit and measurement plan

This is a source audit of the frozen v0.4 implementation, not a claim that a new browser inspection has already been completed. The baseline is `work/interface-baseline-04/Sacramentum`. Before/after browser captures and results will be recorded separately after actual observation.

## Concrete starting points

- The title template in `src/ui/campaign-views.js` provides a cinematic image, Play/Continue, and three repeated career blocks. It does not yet show an actual early gameplay example or concise controls, local-save, and download-dependent offline guidance. The large headline is evocative but less specific than the small recruit-to-Emperor subtitle.
- The new-game panel in `src/ui/panels.js` says “No downloads required.” That is inaccurate for a browser game which fetches code and artwork; “No installation required” is the appropriate distinction.
- The shared `dialog` in `index.html` is named “Game panel.” `app.js` writes a visible panel heading but does not link that heading as its accessible name. Native focus behavior is present, but restoration after the invoking control is replaced by a rerender needs actual keyboard verification.
- Phone navigation hides the wide Journal/Historical notes buttons and relies on the Pause panel for those destinations. Those functions exist; the issue is discoverability and navigation hierarchy, not missing pages. Credits and support should describe only implemented functionality rather than create empty destinations.
- Existing color/type tokens and 44-pixel base buttons are useful foundations. Subsequent title, mobile, tactical and landscape overrides have accumulated in `styles.css`, with separate cinematic treatments. The redesign should consolidate shared behavior while preserving the battlefield geometry and game rules.
- All game/UI/renderer modules are statically imported before the first `loadLocal()`/render path. This is a measurable startup question, not proof of an unacceptable delay. The actual landing-to-chapter journey must include required artwork and service-worker requests.
- The final v0.4 full gzip sum is 1,985,754 bytes, leaving 14,246 bytes under the existing 2,000,000-byte complete-package gate. The opening and chapter-I sums are 322,788 and 1,290,879 bytes. Added promotional media therefore requires reuse, compression, or an equivalent saving; this redesign does not authorize raising the cap.

## Cold-entry measurement

`tests/interface-server.mjs` is a development-only gzip/no-store static server with an in-memory request ledger. It serves a selected source or production directory without editing it. The helper records response-body bytes for game documents, scripts, styles, images and worker requests. It excludes its own harness/API requests and does not read or modify game saves. It is not included in `dist/`.

Start distinct fresh ports for comparable frozen/current production directories:

```sh
node tests/interface-server.mjs /absolute/path/to/frozen/dist 4195 baseline
node tests/interface-server.mjs /absolute/path/to/current/dist 4196 current
```

Open `/tests/interface-load.html`, choose the frame dimensions, then Start one observation. Use the **actual game controls** inside the frame: Play, Begin, an early choice, and Enter the field. Capture after the board's artwork has settled and the request ledger is quiet. Use a fresh unused port for each repeated cold trial; the harness refuses origins with existing databases, saves, workers or caches and never deletes them. A normal preview server does not implement the measurement endpoints.

The DOM report contains Navigation/Resource Timing, the server's actual gzip response-body sums, visible milestones, click-to-view intervals, total journey elapsed, image failures, and a narrow visible-DOM/geometry audit. Human reading/click delay remains in the total and is explicitly distinguished from application response intervals. Resource Timing alone can omit worker-initiated fetches, which is why server counts are included. Zero-transfer entries are retained as uncertain rather than presented as free downloads.

These are controlled local HTTP measurements, not production-CDN latency, physical-phone performance, GPU completion, or a full accessibility audit. Gzip body counts exclude HTTP/TLS headers. Browser Resource Timing transfer bytes are reported separately. A source-preview `sw.js` 404 is visible in the report; production comparisons should use built folders when evaluating offline startup.

## Component and navigation checks

Direct module tests should preserve legal commands, chapter locks, label/control relationships, escaped user content, truthful save/offline states and rendering purity. Browser checks must separately exercise actual focus return, keyboard navigation, link destinations, normal/enlarged text, reduced motion, and layouts at 360 × 640, landscape, and desktop widths. Any deliberately displayed platform-error or long-content stress state must be labelled a component fixture, not a reproduced storage failure or a complete user journey.

The UI redesign must leave core/data/storage rules and the existing regression gates intact. No production debug API, telemetry provider, account service, framework migration, or game-state injection is needed for this measurement plan.

## Implemented development checks

The focused run passes 22 tests: seven new interface contracts, five new optional-media lifecycle checks, four measurement/server checks, and six existing UI-event checks. They exercise actual imported presentation and media modules. Informational panels are rendered against a new recruit and validated, legally earned chapter-X/accession checkpoints, with serialized state checked before and after rendering. Contracts cover chapter locks, authored choice commands, labelled forms, explicit import/recovery confirmation, recovery revision attributes, saving-status precedence, escaped names, valid landing fragments and genuinely deferred optional images.

The media checks reproduce queued observer work after cancellation and stale limited-data opt-in handlers. The implementation now makes both inert after leaving the landing page. Normal intersection loading is idempotent; Save-Data, 2G and sub-1 Mbps connections require an individual image opt-in. These tests use controlled DOM/observer substitutes; they do not claim a physical network or browser lifecycle test.

`/tests/interface-lab.html` uses the same development server to render real components in a sized frame with the selected edition's actual stylesheets. Its default is a new recruit; later options deserialize existing checkpoints generated from a complete legal command replay. Menu, map, character, journal, obligations, settings, restore, help, history and confirmation components are available where that edition implements them. At 200% text, optional synthetic long-name and platform-notice cases expose wrapping and overflow. Those notices are labelled fixtures, not reproduced failures. Presentation buttons are inert, and the lab does not import the application router or access storage. It reports visible geometry and state purity; keyboard interaction and focus return must be checked in the actual game.

The component lab and cold-entry lab are separate observations. Opening the component lab can warm browser resources, so it must not precede a cold-entry trial on the same origin. Use a sufficiently wide outer browser window to fit the chosen iframe; the report includes its actual measured size rather than assuming the selected size fits.

Browser measurements and captures remain pending until the root agent records them. No physical-device, screen-reader, production-host, or latency result is inferred from these passing module tests.

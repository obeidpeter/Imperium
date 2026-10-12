# Graphics verification — v0.4

The graphics upgrade preserves the campaign rules and saves while replacing the field, chamber, character, and ceremonial presentation. Matching browser captures and timing reports are available in the [comparison gallery](../../graphics-review/index.html), a sibling companion deliverable in this workspace and in the separate graphics-review archive. It is not part of the production site or GitHub source tree. An actual [production gameplay screenshot](images/graphics-gameplay.png) is included in the source repository. The portable [browser evidence summary](evidence/graphics-browser.json) contains the derived measurements, source-report hashes, rules-file hashes, and the distinction between automated evidence and observed UI behavior.

This report describes the measured desktop Chromium session and the checks completed for this edition. It does not establish physical-phone performance, sustained frame rate, GPU memory use, total browser memory, or battery life. The current build revision and compressed package sizes belong to [graphics-package.json](evidence/graphics-package.json), which is updated after the final build rather than copied into this document.

## Initial audit and resulting presentation

| Observed starting limitation | What changed | Remaining boundary |
| --- | --- | --- |
| Small procedural figures offered limited identity and costume detail at the battlefield scale. | Painted unit atlases distinguish career stage, Roman/frontier forces, mounted troops, archers, civic speakers, and escorts; faction shapes and colors remain separate from costume. | Archetypes and faces are reused. Each archetype has four authored facings. |
| The board appeared as a compact tiled diagram with relatively shallow surrounding space. | An extended ground plane, regional palettes, painted scenery, raised terrain, contact shadows, and depth ordering connect the board to its setting. Occluders fade when covering the selected unit or target. | The camera and underlying 8 × 8 rule grid are fixed; this is Canvas 2D, not a navigable 3D environment. |
| Previous action feedback mainly used trails and badges; units did not expose rendered animation frames. | Detached visual timelines animate movement, facing, attack wind-up, impact, recovery, throws, brace, rally, formation, cavalry, speaking, and withdrawal. | The motion is made from procedural transforms, clipped gait segments, and gesture/effect overlays; it is not skeletal animation or a full sheet of hand-authored action frames. |
| Camp and promotion art had weaker separation between ordinary service, civic advancement, and accession. | Consistent career portraits, recurring cast expressions, revised settings, and different ceremonial compositions carry that progression. | Seven hero stages and eight scene paintings serve twelve chapters; each chapter does not have a unique face or environment painting. |
| Added artwork could increase decode retention and obscure whether later chapters were actually cached. | A bounded image cache, chapter-first loading, compressed-only next-chapter warming, explicit full-download control, and separate chapter/full offline messages make the cost and readiness visible. | Retention figures are estimates for this application's image references, not a total RAM cap. |

The [graphics architecture](graphics-architecture.md) records rendering, motion, quality settings, asset retention, and offline protocols. [Narrative and specialist art](graphics-narrative-art.md) records visual direction, source sheets, exact prompts, mechanical exports, and reuse. [The asset manifest](asset-manifest.json) supplies hashes and provenance. Full-resolution generation sheets are provided separately in [the art masters archive](../../Sacramentum-art-masters.zip), a sibling downloadable companion archive in this workspace; they are excluded from both the browser bundle and GitHub source tree. Screenshot and raw-report links below likewise refer to the sibling graphics-review deliverable.

## Matching static-render measurements

Both editions ran the same development harness in Chromium 154 on Windows, at a 1280 × 720 browser viewport, DPR 1, Balanced quality. The fixtures replayed **991 legal commands from New Game, seed 275**. No debug unlock or live save editing produced these comparison states.

Each edition measured 28 cases: twelve representative boards at 360 × 196 and 720 × 540 CSS pixels, plus camp, two promotions, and the ending. Every case used five warmup draws and 45 measured draws: **1,260 measured draws per edition**. All 28 state-purity checks passed in both runs. Artwork was warmed first. Narrative cases use the actual browser-width DOM view; the size field in those rows is the harness label, not a claim that the narrative page was constrained to a 720-pixel canvas.

CPU timing covers synchronous Canvas draw submission or narrative template generation plus DOM/layout. It excludes GPU completion and gameplay command execution. The following values are **ranges of the individual case statistics**, not percentiles pooled across all cases.

| Board size | Before: median range | After: median range | Before: p95 range | After: p95 range |
| --- | ---: | ---: | ---: | ---: |
| 360 × 196 | 1.8–2.7 ms | 0.9–1.7 ms | 2.8–3.8 ms | 1.4–3.1 ms |
| 720 × 540 | 1.9–2.7 ms | 1.0–1.6 ms | 2.5–4.1 ms | 1.3–2.4 ms |

The cached tactical renderer reduced submission cost in these warmed runs. The richer narrative views cost more to regenerate:

| Narrative case | Before median / p95 | After median / p95 |
| --- | ---: | ---: |
| Camp, chapter I | 6.5 / 8.6 ms | 7.5 / 9.0 ms |
| Promotion, chapter X | 2.5 / 3.2 ms | 5.5 / 9.4 ms |
| Promotion, chapter XI | 2.6 / 3.2 ms | 3.7 / 5.3 ms |
| Ending | 4.8 / 5.9 ms | 6.5 / 7.8 ms |

Browser RAF intervals were collected independently. Median intervals varied between approximately 8.3 and 16.7 ms across the runs; some cases had roughly 33.4 ms p95 intervals. Refresh cadence and scheduling therefore prevent treating these numbers as an FPS doubling or a guaranteed frame-rate improvement. Raw per-case data and outliers remain in [before](../../graphics-review/baseline-browser.json) and [after](../../graphics-review/after-browser.json).

## Actual unit-motion measurements

The motion harness calls the real `playEncounterMotion` player and records its renderer callbacks. Each case has one warmup and six measured repetitions of the same legally recorded command. The chapter I route uses **Strike**, not an invented Throw; chapter IX uses Throw and chapter XI uses Denounce. Inputs, including the complete scene state and transition pair, have identical SHA-256 hashes before and after every case.

| Legal transition | 360 × 196 CPU median / p95 | 720 × 540 CPU median / p95 |
| --- | ---: | ---: |
| Chapter I road — Strike | 1.0 / 1.4 ms | 1.3 / 1.8 ms |
| Chapter IX wing — Throw | 1.2 / 1.8 ms | 1.5 / 2.2 ms |
| Chapter XI adlection — Denounce | 1.4 / 2.1 ms | 1.5 / 2.7 ms |

The two sizes produced 608 and 605 measured rendered-frame submissions respectively. Independent RAF median intervals were about 16.7 ms in all six cases; their p95 intervals were 16.8–16.9 ms. Actual paint-callback cadence is reported separately. The desktop Throw case contained a **19.0 ms maximum submission**, despite its 2.2 ms p95; the table is not a worst-case guarantee.

The old overlay player exposes no rendered-unit-frame callbacks. Its [baseline motion report](../../graphics-review/motion-baseline.json) correctly marks all three cases **unsupported**, with null timing metrics. It is not recorded as zero-cost animation. See the complete [phone-sized](../../graphics-review/motion-phone.json) and [desktop-sized](../../graphics-review/motion-desktop.json) reports. Both were measured in the desktop browser; the former is not an Android or iPhone measurement.

## Retention, cancellation, and loading

The actual browser [asset-cache run](../../graphics-review/asset-cache.json) loaded all twelve chapter groups with **zero failed loads**, at most **two concurrent decodes**, and at most **24 retained entries**. The largest retained RGBA estimate was **25,085,952 bytes**, within the configured **25,165,824-byte / 24 MiB cap**. The run recorded 14 evictions by chapter XII. First-group loading took 160.4 ms in that session; later groups ranged from 0.4 to 36.4 ms. These timings are not a controlled cold-network benchmark.

The ground cache retained one surface. At DPR 1 its recorded backing estimates were 282,240 bytes for the phone-sized board and 1,555,200 bytes for the desktop-sized board. Old backing stores are released on replacement. These numbers exclude the visible canvas, DOM images, in-flight decodes, HTTP storage, and browser/GPU allocations.

Action motion is bounded to 1.1 seconds. The optional arrival beat ends within six seconds, at most 12 paints/second in Balanced or 20 in High. Performance and reduced-motion modes skip that beat. Cancellation tests cover hiding, scroll, resize, detachment, supersession, explicit cancellation, and stalled RAF. There is no permanent tactical idle loop. A review found that ambient overrides could revive withdrawn units in a resumed save; the renderer filter was corrected and regression tests verify that withdrawn units stay hidden while explicit retreat animation still works.

## Rules, saves, and automated verification

All **12 files covering core rules, campaign data, and storage** have the same SHA-256 hashes as the frozen 0.3 source. Their per-file digests and a fresh recheck are embedded in [graphics-browser.json](evidence/graphics-browser.json). Rendering, motion, and preview paths do not write campaign state or consume its RNG.

The release verification recorded **174 passing tests, zero failures, and zero skips**. Legal autoplay completed all twelve chapters, **25 encounters in 204 turns**, reaching Augustus from New Game. The asset and service-worker verification recorded **nine passing checks**. These exact commands, outcomes, and the current build budget evidence are in [graphics-package.json](evidence/graphics-package.json). Older evidence directories are historical records and may contain earlier campaign turn counts.

Scoped graphics tests include interpolated depth order, raised-terrain occlusion, legal weighted preview paths, four-facing atlas crops, stage/faction/role mappings, cache and pixel-ratio bounds, frozen inputs across twelve regions, collapsed canvas safety, active save compatibility, motion lifecycle, and quality downgrade rules. These checks establish specific behavior; they do not replace human playtesting or prove subjective visual quality.

## Observed production UI and offline behavior

The following observations were made through the rendered production UI, separate from the isolated graphics harness:

- A fresh campaign accepted the opening choice, a drill Move to 2D, and End Turn through visible controls.
- At 360 × 640, battle and Senate layouts had no horizontal page overflow. The in-game 200% text setting, reduced motion, Performance, and High controls were exercised. [Battle](../../graphics-review/phone-battle.png), [Senate](../../graphics-review/phone-senate.png), and [200% text](../../graphics-review/phone-200-percent.png) captures are retained.
- At 1280 × 720, ArrowRight on the actual board announced “Grid 5E Landholders delegate 2.” The page had no horizontal overflow. At 1600 × 900, the Senate's panel bounds remained within the viewport. [Desktop](../../graphics-review/desktop-senate.png) and [large desktop](../../graphics-review/large-desktop-senate.png) captures document those views.
- A chapter XI checkpoint earned through legal campaign play was imported through the actual validated Import UI. No live state injection was used to reach that board.
- Chapter I readiness appeared before an explicit request for the whole campaign. Pressing the full-download button showed progress, including 86%, followed by all-chapters-ready status.
- After the production server was stopped, reloading restored the cached title. Continue resumed the Senate with its artwork. Persuade succeeded offline and reported the target's stance changing from 4 to 6.
- The full-download and server-stop check was repeated on the final production build. After the server stopped, the cached title and Continue restored the Emperor finale completely offline. Create Your Reign Card opened the rendered card canvas and its Download Card and Share controls. No share was sent; downloading or sharing the card was not part of this check.
- At **390 × 844**, all four finale images loaded with nonzero natural widths. Page scroll width was 375 pixels against the 390-pixel viewport, with no horizontal overflow. The [phone finale capture](../../graphics-review/phone-finale.png) was visually inspected.
- At **640 × 360 landscape**, the repaired final production layout passed inspection: a 317 × 181 board and 275-pixel control panel appeared side by side. Confirm and End Turn were both 44 pixels high and inside the viewport, with their bottom edge at 296.5 pixels. Page scroll width was 625 pixels against a 640-pixel viewport. Persuade succeeded in this layout, changing stance from 4 to 6. At the game's 200% text setting, there was still no horizontal overflow; the select and Confirm controls grew to 56.8 and 93.2 pixels high and the page scrolled vertically. The [landscape capture](../../graphics-review/landscape-senate.png) records the repaired layout.

The server-stop check proves server-unavailable operation after caching in that browser session. It does not prove iOS installation behavior, durable storage retention, flight mode on a real device, or survival under OS eviction. The 200% check is the game's text setting, not independently verified browser zoom.

## Remaining limitations and delivery

The presentation is a fixed-camera 2D game with painted architecture, four facings, reused unit/civilian archetypes, and procedural motion. Individual faces do not uniquely identify every member of a cohort, and civilian group tokens do not render full crowds. Art emphasizes readable historical inspiration rather than exact archaeological reconstruction. At small board sizes, fine costume detail remains secondary to markers, labels, accessible HTML target lists, and previews.

No physical Android/iPhone session, Safari/VoiceOver audit, total-process RAM or GPU-memory measurement, thermal test, battery run, or sustained low-end-device benchmark was performed. Long-term storage eviction, accessibility with a real screen reader, and physical-device installation remain in the [playtest matrix](playtest-kit.md).

The source and static packages include the current graphics implementation; production excludes development harnesses and generated legal fixtures. The separate graphics-review package contains the local comparison gallery, screenshots, and raw reports. The masters archive preserves generation sources without making the browser download them. Package revision and budget claims must be read from the final [package evidence](evidence/graphics-package.json).

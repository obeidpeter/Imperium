# Graphics refinement verification — v0.6

Final package revision **9968c5977d0c**, recorded 2026-10-12. This release refines rendering and animation while preserving the deterministic campaign and save boundary. The frozen comparison is v0.5. Evidence types remain separate: exact legal-action replays, isolated sprite diagnostics, synchronous draw measurements, actual animation callbacks, and production smoke checks.

The [browser summary](evidence/graphics-refinement-browser.json) includes per-case results, capture hashes, raw-report hashes and limitations. The [regression record](evidence/graphics-refinement-regression.json) contains test, autoplay, package and protected-file evidence. Full raw reports and paired JPEG captures are in the separate graphics-refinement-review deliverable. The paired figures use the lab's capture mode to hide controls and report tables.

## What was observed

- Inspected actual 12-chapter browser gallery: regions retain distinct green frontier, marsh, eastern sand and Curia stone palettes; banks, verge details and exterior props add context without replacing tactical markers.
- Inspected 40-cell four-facing dark-ground sprite diagnostic at 46% pose phase: no obvious detached limbs or mesh gaps at the captured display scale. This is an enlarged isolated pose inspection, not legal gameplay evidence.
- Paired filmstrips cover legal move, strike, brace, throw and enemy hit. Throw release and trail distance were corrected after review; final captures use those corrections.
- Inspected 360x196 Senate board: side/selection markers remain visible, but the dense chamber and small figures still rely on the named unit/target controls for precise selection.
- Production phone capture retains battlefield,selected unit,objective and result control with normal vertical scrolling. A phone viewport in a desktop browser does not establish physical touch behavior.

The twelve-board gallery compares the same legally reached representative chapters. The five action pairs cover multi-tile movement, melee, brace, a javelin projectile and an enemy hit. Their fixtures come from replaying 991 legal commands from New Game, seed 275. Every selected command returned success; no victory or capability was assigned directly. Filmstrips show exact before/after states plus six samples at 0/20/40/60/80/100% of each edition's actual timeline duration. They do not establish real-time smoothness by themselves.

## Measured drawing cost

The captured environment reports Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36, viewport **1280 × 900**, DPR **1**, quality **balanced**. Both editions share fixture hashes and case/size keys. Artwork was warmed. The static series uses five warmups and 45 measured draws per case: 24 board/size combinations plus four narrative cases. CPU values below are milliseconds of synchronous drawing or DOM/layout work; they do not wait for GPU completion.

The static benchmark was captured before the final projectile and footfall timing fixes, which do not change the static draw path. Its original measurement timestamps are preserved.

| Group | Cases | Median of row medians: before / after | Per-row median range: before / after | Per-row p95 range: before / after |
| --- | ---: | ---: | --- | --- |
| All Canvas boards | 24 | 1.10 / 1.40 | 0.80–1.60 / 0.90–2.40 | 1.20–2.80 / 1.60–10.70 |
| Canvas 360 × 196 | 12 | 1.15 / 1.45 | 0.80–1.50 / 0.90–1.90 | 1.30–2.70 / 1.80–6.10 |
| Canvas 720 × 540 | 12 | 1.10 / 1.35 | 0.80–1.60 / 1.10–2.40 | 1.20–2.80 / 1.60–10.70 |
| Narrative template/DOM | 4 | 4.85 / 4.50 | 4.50–5.60 / 3.60–8.40 | 6.40–7.20 / 5.20–11.50 |

These aggregate values summarize row statistics; they are not a pooled-frame p95. Narrative work is reported separately and is not a battlefield metric. A lower or higher value in this single warmed desktop series is not a physical-phone FPS, battery or general speed claim.

## Actual animation callbacks

Eight legal transitions were measured at **720 × 540**: five early cases plus frontier-road, mounted-force and Senate cases. Each used one warmup and six real plays. Every case completed, supplied rendered frames, and retained identical input hashes. CPU submission, paint intervals, independent RAF intervals and cleanup cost remain distinct in the raw records. Hidden/interrupted/error trials are not counted as successful measurements.

| Case | CSS canvas | CPU median: before / after | CPU p95: before / after | Median change, ms |
| --- | --- | ---: | ---: | ---: |
| action-move | 720 × 540 | 1.50 / 1.70 | 2.30 / 2.70 | 0.20 |
| action-strike | 720 × 540 | 1.00 / 1.40 | 1.50 / 2.50 | 0.40 |
| action-brace | 720 × 540 | 0.90 / 1.10 | 1.30 / 2.60 | 0.20 |
| action-projectile | 720 × 540 | 1.00 / 1.10 | 1.90 / 2.20 | 0.10 |
| action-hit | 720 × 540 | 0.90 / 1.20 | 1.70 / 1.90 | 0.30 |
| board-ch1-road | 720 × 540 | 1.10 / 1.70 | 2.40 / 2.80 | 0.60 |
| board-ch9-wing | 720 × 540 | 1.30 / 1.30 | 3.00 / 2.00 | 0.00 |
| board-ch11-adlection | 720 × 540 | 1.50 / 1.90 | 2.30 / 3.40 | 0.40 |

The median of the eight per-case CPU medians is 1.05 ms before and 1.35 ms after. Per-case p95 ranges are 1.30–3.00 and 1.90–3.40 ms. These are submission costs, not GPU frame times. The current motion run used the final rendering code in this build.

## Rules, saves and package

The supplied final Node run reports **215/215 tests passed**, with no failed, skipped or cancelled tests. Legal autoplay completed **25 encounters in 204 turns**, all twelve chapters, ending as Augustus. This is an automated legal route, not a new full-campaign human playthrough. All **13 protected files** match the frozen baseline and the current source bytes: every core/data file plus storage and the session gate.

The supplied asset/offline check reports **9 checks passed**.

| Compressed package scope | Gzip bytes | Unchanged cap |
| --- | ---: | ---: |
| Initial title/shell | 318,580 | 2,000,000 |
| Initial plus Chapter I | 1,286,671 | 2,000,000 |
| Complete content | 1,991,422 | 2,000,000 |

These are sums of compressed files including the service worker, not an observed cold-network trace. Earlier interface loading evidence remains explicitly historical v0.5.

## Production smoke

Production revision: **9968c5977d0c**. Environment: {"browser":"Codex in-app browser / Chromium 154 on Windows","origin":"http://127.0.0.1:4323/","desktopViewport":"1280x900","phoneViewport":"360x740","physicalDevice":false}.

- **Fresh production New Game — pass:** Version 0.6.0 visible. Began recruit, chose Tell Varro the truth, entered training via real UI; no imported or edited state.
- **Four legal training actions — pass:** Moved from 1D to 2D, threw javelin, ended turn, struck training partner, ended turn, braced. Real UI reached 4/4 demonstrations and Objective Achieved on turn 3 with 20/22 health.
- **Quality and motion controls — pass:** Selected Performance and enabled reduced motion in Settings, closed panel, then reloaded and resumed. Settings retained both values. Switched to High and disabled reduced motion; static board remained readable.
- **Narrow production layout — pass:** At 360x740, body and document scroll widths both 360; battlefield CSS width 339.203125 and height 193.828125. Turn 3, 20/22 health and 4/4 objective retained in Performance and High captures.
- **Reload and resume — pass:** Reload opened returning-player landing page. Continue restored completed training encounter at turn 3, 20/22 health, 4/4 demonstrated actions and Record the result control.
- **Production console — pass:** No error-level entries returned by the browser console inspection after the above actions.
- **Existing preview upgraded — pass:** Existing 4193 tab was on the title screen with Play now. Revalidated worker, navigated away briefly for normal activation, returned to same origin, and observed Version 0.6.0. No saves were deleted or imported.

## Remaining limits

- Actual desktop Chromium browser measurements; canvas sizes do not establish physical-phone performance or touch behavior.
- Synchronous Canvas submission is separate from GPU completion. RAF and paint intervals are not a guaranteed FPS result.
- One captured benchmark series per edition, warmed artwork and fixed legal fixtures. No population estimate, battery, thermal, VRAM or production-network benchmark.
- Filmstrips are deterministic samples of the actual animation timeline, not recordings of real-time pacing or DOM overlay badge timing.
- Sprite contact sheets, if inspected, use deliberately isolated pose/facing overrides over legally sourced unit identities; they are not actual gameplay actions.
- Autoplay verifies one legal deterministic campaign route, not human playtime, enjoyment or every possible strategy.
- Static 28-case timing run preceded only the final projectile-release and footfall-timing corrections; the static draw path was unchanged by those corrections.
- Motion timings and captures are local desktop-browser observations; no GPU completion, physical iOS/Android, installed-PWA update, battery or human enjoyment claim.
- Animation deforms existing painted four-facing sprites procedurally. It is not newly authored bitmap animation or a 3D character model.

## Static per-case evidence

Canvas rows and narrative rows retain their original labels. Positive changes below mean greater synchronous CPU cost in this observation.

| Case | CSS size | CPU median: before / after | CPU p95: before / after | Median change, ms |
| --- | --- | ---: | ---: | ---: |
| board-ch1-road | 360 × 196 | 1.00 / 1.10 | 2.40 / 2.30 | 0.10 |
| board-ch1-road | 720 × 540 | 0.90 / 1.40 | 2.00 / 2.60 | 0.50 |
| board-ch2-marsh | 360 × 196 | 0.90 / 1.10 | 1.40 / 2.20 | 0.20 |
| board-ch2-marsh | 720 × 540 | 1.00 / 1.20 | 1.50 / 1.60 | 0.20 |
| board-ch3-station | 360 × 196 | 1.40 / 1.70 | 2.20 / 2.20 | 0.30 |
| board-ch3-station | 720 × 540 | 1.30 / 1.40 | 1.80 / 2.20 | 0.10 |
| board-ch4-gate | 360 × 196 | 1.40 / 1.50 | 1.70 / 2.20 | 0.10 |
| board-ch4-gate | 720 × 540 | 1.40 / 1.40 | 2.50 / 2.50 | 0.00 |
| board-ch5-mine | 360 × 196 | 1.30 / 1.70 | 2.70 / 3.60 | 0.40 |
| board-ch5-mine | 720 × 540 | 1.60 / 2.40 | 2.80 / 10.70 | 0.80 |
| board-ch6-wells | 360 × 196 | 1.20 / 1.70 | 2.20 / 4.70 | 0.50 |
| board-ch6-wells | 720 × 540 | 1.40 / 1.60 | 2.30 / 3.10 | 0.20 |
| board-ch7-legion | 360 × 196 | 1.50 / 1.80 | 2.50 / 6.10 | 0.30 |
| board-ch7-legion | 720 × 540 | 1.00 / 1.90 | 1.70 / 3.70 | 0.90 |
| board-ch8-ferry | 360 × 196 | 0.90 / 1.20 | 1.30 / 2.70 | 0.30 |
| board-ch8-ferry | 720 × 540 | 1.00 / 1.30 | 1.60 / 2.60 | 0.30 |
| board-ch9-wing | 360 × 196 | 1.00 / 1.90 | 1.40 / 3.80 | 0.90 |
| board-ch9-wing | 720 × 540 | 1.30 / 1.30 | 2.60 / 3.20 | 0.00 |
| board-ch10-road | 360 × 196 | 0.80 / 0.90 | 1.40 / 1.80 | 0.10 |
| board-ch10-road | 720 × 540 | 0.80 / 1.10 | 1.20 / 1.90 | 0.30 |
| board-ch11-adlection | 360 × 196 | 1.40 / 1.40 | 1.80 / 2.30 | 0.00 |
| board-ch11-adlection | 720 × 540 | 1.10 / 1.30 | 2.10 / 2.60 | 0.20 |
| board-ch12-confrontation | 360 × 196 | 1.10 / 1.10 | 1.60 / 1.90 | 0.00 |
| board-ch12-confrontation | 720 × 540 | 1.10 / 1.20 | 2.20 / 1.80 | 0.10 |
| camp-1 | 720 × 540 | 5.60 / 8.40 | 7.20 / 11.50 | 2.80 |
| promotion-10 | 720 × 540 | 5.00 / 5.10 | 6.90 / 6.70 | 0.10 |
| promotion-11 | 720 × 540 | 4.70 / 3.60 | 6.40 / 5.20 | -1.10 |
| ending | 720 × 540 | 4.50 / 3.90 | 6.40 / 5.30 | -0.60 |

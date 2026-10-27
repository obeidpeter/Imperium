# Player experience polish — 26 October 2026

This extends main `2ca39d6` across the existing twelve-chapter campaign. It uses local authored geometry, animation and audio, with no additional Tripo generation or spending. It does not add an account, telemetry or a network service.

## Access and learning

New Game offers an explicit Real-time with pause / Turn-based choice. A fresh choice recommends real-time; an existing stored preference is respected, and an old campaign is not silently converted. Controls exposes the mode to ordinary players. Camp repeats fewer headers above the world on narrow screens. Optional contextual exercises cover deployment, issuing squad orders, engineering and political commitments; only accepted public actions count, and completion is a local preference rather than campaign progress.

## Movement and composition

Shared character presentation adds full-body starts, stops, turns and recovery, planted contacts, an asymmetric wounded gait, distinct horse gait contacts and rider counter-motion. Scalp silhouettes and hairlines vary across the cast using the existing donor topology and shared shader. These are authored/procedural improvements, not motion capture or newly sculpted production character heads.

Conservative canopy bounds protect common camera approaches. Regional courts have distinct peripheral arrangements, continuous paving courses and foundations/threshold/runoff treatment. Existing legal map cells, service routes, generated asset counts and graphics ceilings remain authoritative. Foliage spray overlap is reduced rather than filled with more assets.

## Playable company situations

Chapter V asks the player to match a household’s stamp to a boat manifest. VIII asks them to identify a token’s owner from its personal mark. XI compares a rough witness statement with its staff copy, preserving the authored Lucan/Sabinus absence branch. Each situation has three reachable camp desks, evidence that can be reread, an explanatory wrong-answer path and a persistent completion. The existing company record starts the task in the world; Company stories supplies the same commands without walking. Completing a situation moves an existing camp worker and updates its delivery record. Existing allocation choices and later company reports still matter.

These tasks grant no duplicate money, training or relationship reward, change no companion fate, and never block departure. Started/evidence/completed flags use the existing save format. The camp refresh keeps the soldier’s position. A wrong answer sends no message and mutates neither state nor RNG.

## Audio

The mixer now reads visible live real-time health, nearby opponents, objective defence and deadlines rather than stale saved battle units. Concealed enemies and future waves do not influence it. A new original local percussion/resonance pulse follows live pressure and ducks beneath the existing narration. Its single buffer shares the existing 24 MiB recording PCM ceiling; it stops when pressure clears, music is muted, the page hides or the mixer is disposed. The independent environmental synthesis ceiling remains unchanged.

Accepted friendly formation orders use distinct short horn contours; receipt of a queued order and concealed enemy orders are silent. Signals have a cooldown and retain the existing 20-voice battle cap. Metal/wood resonances vary between contacts, and padded cloth impacts differ from exposed-body impacts. The four existing spoken recordings remain the voice content. This delivery does not claim new human acting or a replacement orchestral soundtrack.

## Verification

Focused source/unit checks cover all twelve shared presentation paths, mode migration, exercise completion, activity transactions/navigation/saves, live audio privacy, voice limits and cancellation. Production browser and Windows evidence is recorded separately below. Imported legal checkpoints are fixtures, not a continuous human campaign.

Final corrected candidate production revision: `7397edfed55e`. Local verification used Node `24.19.0`; the repository’s Node 20/22 GitHub jobs have not been run for these unpublished changes. The exact `npm run verify` steps were invoked directly because this bundled runtime has Node but no npm executable.

- **1,371/1,371 unit tests passed** after the final integration fixes. Every step of the full verification sequence also passed: the base, expanded, command and production legal-command campaigns, production build, bundled-asset audit, character asset audit, authored performance/production audits and handoff check.
- The three development character GLBs were regenerated from the final character sources. The strict handoff audit and ten relevant asset/handoff checks passed. These development files are excluded from the game download.
- The first unit pass identified outdated classic-mode/paving fixtures and insufficient spacing between new activity desks and solid scenery. The fixtures now express their intended mode/perimeter erosion, and desks were relocated. All original navigation clearance, non-overlap and resource ceilings remain enforced.
- **Final `7397edfed55e`: 11/11 production usability flows passed, with zero page/console errors or network failures**, in full Chromium `151.0.7922.34` with SwiftShader. Coverage includes ordinary-player onboarding, legacy-save control preservation, phone-width controls, navigation, help and save confirmation. These are browser/viewport tests, not physical-phone tests; no timeout or quality assertion was relaxed.
- The actual activity browser flow exposed a dialog-close race: a queued native close event from the previous dialog could clear a newly opened conversation and steal its focus. The handler now preserves the reopened dialog’s conversation, focus and pause context. A targeted regression delivers that delayed event explicitly, verifies that the next reply still commits through the public command, and checks that a legitimate close still works.
- Final audio integration corrected stale live-world input during restore: the render lifecycle now establishes the current world before sampling live pressure. Two regressions exercising the actual render block failed with the old ordering; **27 focused checks passed** after the fix.
- Final dialogue integration also guards reply continuation after an asynchronous save. An actual Web Lock delay reproduced the old failure, where a saved reply could replace or close a newer panel. The guard preserves the exact committed save and the newer panel/conversation and focus; an explicitly chosen March out still departs. **35 focused checks passed**, with before/after failure evidence retained.
- **Final `7397edfed55e`: 15/15 production immersive checks passed, with zero reported errors.** Chapter V and VIII activity flows passed at desktop size and at 390-pixel width with 200% text: evidence can be reread, incorrect answers are refused, completion survives reload, and the soldier’s position is preserved. These checks exercise visible interface controls and 2D layout/camera-control paths.
- **The final full-Chromium smoke passed all 20 scenarios, with zero page or console errors; all 20 real-time controls checks also passed.** The smoke includes real-time fields, camp, deployment, chambers, finale, settings and legacy chronicles.
- **The final twelve-chapter benchmark passed all 13 scenes and five check groups, with zero reported errors.** These captures restore legally earned checkpoints through the interface; they do not represent one continuous human playthrough.
- **The final stage benchmark passed four runs:** Chapter V’s mine and Chapter XII’s confrontation, each on Performance and Balanced. Existing draw-call, triangle and shader-program ceilings passed unchanged, with **zero programs compiled in the first frame or after the scene was shown** in every run. SwiftShader results establish browser correctness and resource bounds, not physical-device frame rates.

Earlier evidence is retained: a prior candidate had a one-off dynamic-module fetch failure after reload, followed by a clean unchanged-build desktop diagnostic and complete pass. Intermediate `9e5b219a19db` passed usability 11/11 and immersive 15/15 before the final integration fixes. Its superseded smoke run was deliberately stopped and is not recorded as a pass.

The full-verification receipt is `work/player-experience-polish/verify.json`. The completed six-stage final browser run is recorded under `work/player-experience-polish/production-7397edfed55e/`: `browser-checks.json`, `usability-report.json`, `immersive-report.json`, `realtime-controls-report.json`, `benchmark/report.json` and `stage-benchmark.json`, with their logs. The repository retains a [compact verification record](evidence/player-experience-polish.json), including the Windows measurements.

## Windows review

The final build was exercised in the Windows in-app browser on Intel Graphics through ANGLE/Direct3D11, with all automated test browsers stopped. The visible viewport was **810 × 704 CSS pixels**, with a **793.5 × 434.5** battle canvas. Chapter V used Balanced, Horizon, sculpted figures, normal motion and automatic resolution. These are panel-sized measurements, not a full-screen device guarantee.

Two non-overlapping rolling 240-frame windows during active combat averaged **59.52 and 60.01 FPS**, with a 16.8 ms 95th-percentile frame interval in both. Their recorded resolution scales were **0.90 and 0.70**. After Quick save → Load → resume, another 240-frame window averaged **56.71 FPS**, with a **33.2 ms** 95th-percentile interval and **0.65** resolution scale. Mean CPU draw submission was 9.86, 7.66 and 6.83 ms respectively; it excludes asynchronous GPU work and must not be reported as frame rate. GPU timer queries were available.

The visible flow confirmed the new mode choice, ordinary camp mode switching, target selection/attack, pause, and quick-save loading. The restored battle retained its displayed 0:56 clock and unit state. The preview was then returned to the legal Chapter V camp checkpoint on the separate local origin `http://127.0.0.1:54939/` for review. No personal campaign on another origin was replaced.

The live stage reported one first-frame shader program, and ANGLE emitted one shader warning about a gradient in a varying loop; no browser error was logged. These observations are retained, so the static-stage benchmark's clean warm-up must not be generalized to every live hardware path. Pane hide/show and switching to a second in-app tab both left `document.visibilityState` as `visible`; a genuine page-background lifecycle check remains **inconclusive**. Full DOM telemetry and console evidence are in `production-7397edfed55e/windows-report.json` under the work directory.

Local logs, reports and source screenshots are retained under `work/player-experience-polish/` alongside this repository workspace; automated UI receipts are also in `tests/visual-results/`. Source captures are labelled separately from the candidate production build.

First-time players and physical phones remain for the access the user plans to arrange. The [playtest kit](playtest-kit.md) now covers both control modes, the camp activities, later exercises, isolated hardware samples and subjective listening. No participant has been contacted and no physical-phone, human pacing or headphone listening result is inferred from automated tests.

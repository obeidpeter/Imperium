# Campaign presentation refinement — version 0.12

Production build **e737d39d2c3b**, version **0.12.0**, verified 12 October 2026. This report records the completed automated and desktop-browser checks; no physical-device or independent human-playtest result is claimed. The completed [version 0.11 report](campaign-3d-verification.md) remains unchanged and describes its own release.

## Presentation changes

Overview frames the playable ground and actual figures. Follow tests structural sightlines and chooses a clear close-up when available; it returns to Overview if no tested angle is clear. Unit badges and mission markers share a priority layout. Selected and inspected figures keep precedence, while low-priority labels may be hidden when no non-overlapping position remains. Names, health/Resolve, stance and legal actions still come from the campaign state and remain available through the normal controls.

Original procedural figures now have terrain-sampled foot and hoof placement, planted contact during movement, bounded pose transitions and equipment-aligned release/contact anchors. Mounted weapon aim adjusts toward its actual target. Distance-based detail retains silhouette, role identity and picking; static scenery batching retains authored surfaces, transparent sorting and moving cloth. Shadow updates and label measurements are cached, and repeated legal-target markers are instanced. These implementation changes alone do not demonstrate a speed improvement or polished player experience.

## Completed automated checks

- **360/360 tests passed**, zero failures, skips or cancellations, in **33,499.9881 ms**, after sequential legal fixture preparation. Added coverage includes priority label placement, real structural focus obstruction, projectile-tip alignment, figure contact/grounding, distance detail, surface batching and lifecycle/state purity.
- The legal New Game route completed **25 victories across 12 chapters in 213 turns**, ending at Augustus. The deterministic rules, encounter progression and saved-state model remain unchanged by this presentation work.
- **11/11 asset/offline checks passed**. The cold Chapter XI missing-module/retry case is a mock-worker protocol check; the separate production browser observation below completed the Senate encounter with the server stopped.
- Node's syntax check and a small VM diagnostic exercised the actual review harness's catalog, legal sample replay and label-box functions. It verified an actual Palmyrene cavalry End turn movement at trace 712, **7B → 5B**, exact source-checkpoint equality, trace/actor selection, visible-only boxes, unit/objective collision detection, bounds and settling. This is not real-browser evidence.

The final logs are in `work/campaign-3d-refinement-review/`: `pretest-final.txt`, `tests-final.txt`, `autoplay-final.json`, `build-final.json`, `assets-final.txt` and `harness-logic-result.json`. The earlier 356-test checkpoint predates the final focus/projectile fixes and is retained separately; it is not the release total.

## Production build

The builder inventory contains **136 files**, with **64 initial and 72 deferred**. Shared 3D dependencies remain outside the initial shell and are included in each chapter's cache group. The standalone study page/style remain separate. Individually gzipped estimates below include the generated worker; they are not a browser transfer trace.

| Group | Gzip estimate, bytes | Configured cap, bytes |
| --- | ---: | ---: |
| Initial shell | 360,553 | 2,000,000 |
| Shell plus Chapter I | 5,422,625 | 8,000,000 |
| Complete opt-in package | 6,575,015 | 24,000,000 |

## Review controls implemented

`tests/campaign-3d-browser.html` uses complete checkpoints and command sequences earned through the legal New Game trace. It never reads or writes normal campaign storage, edits ranks or fabricates encounter outcomes.

- **Inspect figure** lists actual visible figures, including opponents. Overview, Follow and zoom controls inspect their presentation without granting player command authority.
- **Action sample** and **Legal occurrence** select an exact recorded command by trace step. The inspected-figure filter restricts direct commands to that actor. For **End turn**, it requires that figure to move between the legally produced before/after states. Results identify actual moving actors and tile changes, rather than labelling every move in a cavalry encounter as mounted movement.
- **Inspect settled labels** waits for consecutive stable rendered frames, then records visible DOM boxes, overlaps and bounds relative to the canvas. Unit badges and objective markers are measured together. When the production layout exposes `data-layout`, only its visible labels are measured; intentionally occluded/offscreen labels are counted separately. Whole badge rectangles are measured, excluding positioned leader lines. The all-scene checks require settled, non-overlapping, in-bounds roots and a visible selected-hero badge, both in the initial overview and after canceled motion. A geometric pass is not a substitute for reading the scene.
- **Measure current camera** retains the current legal state, selected figure and camera. It records quality, yaw, pitch, distance, target, viewport, canvas size and the serialized state's hash. After warm-up it measures 120 actual rendered callbacks; CPU submission, rendered-stage intervals, browser RAF and per-frame draw calls/triangles remain separate. Workload includes mean and maximum, so cached-shadow frames cannot be mistaken for the cost of every frame.
- Stop, hidden-page interruption and stage errors prevent a run from being marked complete. Audio stays off. Camera changes and completed animation samples verify exact save equality.

## Repeatable comparison procedure

Generate fixtures with `node scripts/prepare-tests.mjs`, serve the project, then open the harness. For a static comparison, select the same encounter, quality, viewport/scene size and figure; choose **Render checkpoint**, then **Overview** (or the same Follow view) before measuring. Record camera fields and the checkpoint hash alongside the results. Changing the camera or measuring an already-played sample produces a different comparison condition.

For a mounted motion check, choose an actual cavalry/heavy figure, enable its filter, select an available **End turn** occurrence and play it. The sample is an autonomous turn from the legal replay, not an injected animation or a normal-interface chapter playthrough. Explicit player commands remain selectable by their actual actor. Inspect a close-up and overview separately.

Use the label report after the camera settles. Production layout statistics and actual DOM rectangles are complementary; a model-layout prediction alone does not prove that browser text fits. Record unavailable or unsettled measurements rather than silently treating them as passes.

## Completed browser harness checks

The desktop in-app browser, Chromium 154 on Windows, completed the strict sweep of **25/25 legally reached scenes and 468 assertions** at a 1280 × 720 viewport. Every initial overview and post-cancellation layout settled with visible unit/objective labels in bounds, no measured label overlaps and a visible selected-hero badge. Existing rule/model correspondence, hidden-unit, electorate, reduced-motion, save-equality and disposal checks also passed.

That sweep preceded the final focus-camera/projectile-only corrections; the overview layout was unchanged. After reloading the final module graph, the Senate scene passed another **63 assertions across three checks**: Balanced at a 1233 × 468 scene, Performance at 360 × 420, and High at 844 × 300. Each showed all **13 labels** without overlap or clipping. These are scene-container sizes inside the harness, not a claim of full-game mobile viewport or physical-phone testing.

The final refreshed harness also inspected actual Palmyrene cavalry (`enemy0`) from an unobstructed 10-metre Follow camera and completed its legal autonomous End turn sample, trace 712, from **7B to 5B**. Other units moved as dictated by the same turn. The command completed with motion enabled and exact committed-save equality; enemy inspection did not grant control. The final sample is in `final-targeted-browser.json`; the earlier `cavalry-legal-sample.json` predates the camera correction and is not the final follow evidence.

## Recorded current rendering cost

A Balanced Chapter IX overview sampled **120 actual rendered frames after 18 warm-up frames**, idle with no active action, at **1280 × 720 CSS viewport**, device ratio **2**, and a **1233 × 468 CSS canvas**. The report retains camera position and the complete starting save's hash. Rendering preserved that save.

| Measurement | p50 | p95 |
| --- | ---: | ---: |
| CPU rendering/submission | 6.3 ms | 8.1 ms |
| Interval between stage renders | 17.1 ms | 35.4 ms |
| Browser RAF interval | 16.7 ms | 16.8 ms |

Actual submitted draw calls varied **277 minimum / 327.79 mean / 542 maximum**; triangles varied **206,728 minimum / 230,806.7 mean / 332,356 maximum**. Shadow-cache updates make the last frame an incomplete description of workload, so the range and mean are retained.

These measurements describe this run. The earlier version 0.11 profile used a different camera, canvas and device ratio, so it is not a matched speed comparison. CPU submission is not GPU time, RAF is not the same as stage-render cadence, and these figures do not promise 60 fps or physical-phone performance.

## Normal-interface play and production offline behavior

The final production build at localhost port 4375 imported validated, legally earned checkpoints through **Restore a save code**, including its confirmation. Browser automation then used the normal named actor/action/target selectors, formation/order controls, authoritative preview, Confirm and End turn. It did not inject chapters or write hidden campaign state. This is three complete encounter UI routes from imported earned checkpoints, not a New Game-to-ending human playthrough.

| Encounter | Normal UI commands | Recorded result |
| --- | ---: | --- |
| Chapter XI — accounts | 47 | Won at turn 12, support 11/13 |
| Chapter II — marsh | 26 | Won at turn 9 |
| Chapter IX — cavalry wing | 30 | Won at turn 5; line/shield-wall formations and attack orders exercised |

All **103 commands** completed. `normal-ui.json` holds 102 step rows; its separately recorded initial Senate move from **2D to 4E** is the 103rd command. Every route exposed **Saved** in the interface. The Chapter IX result was additionally recorded through the normal result button; the UI confirmed that the result was saved and the next camp checkpoint was ready.

The complete Senate route ran with the serving process **stopped**, after the fresh origin directly restored Chapter XI and reported **Chapter XI available offline**. It needed no Chapter I walkthrough. Reload/Continue worked offline, and a further reload after victory retained **won, turn 12, support 11/13**. The server was then restarted for the two battles. This demonstrates the current production chapter cache, legal controls and saved result in this desktop browser on localhost. It does not test system-wide disconnection, storage eviction, an operating-system crash, a physical installed PWA or long-term offline retention.

## Full-game viewport and view-switch checks

The production cavalry encounter was checked at **360 × 800** with a **345 px document width**, and at **844 × 390** with a **829 px document width**: neither overflowed horizontally. At **2× game text** in the 360-pixel viewport, the document remained 345 pixels wide and the selected label remained visible. These are browser viewport/text observations, not a complete accessibility or physical touch test.

Switching **2D ↔ 3D** retained the won turn-5 encounter and **3/6 orders**. The normal text/motion preferences and desktop viewport were restored after checking. The final production console captured **no errors or warnings**. The preview was then reset through the validated Chapter IX save to turn 1; `cavalry-gameplay-final.png` is the actual final production capture.

A [compact evidence summary](../evidence/campaign-3d-refinement-verification.json) includes the verified counts, measured workload, normal-interface scope and SHA-256 references to raw review files. Large browser reports remain in `work/campaign-3d-refinement-review/`, outside the source repository.

## Remaining limits

The art remains stylized original procedural geometry and scripted poses, not scanned characters, captured movement or a photorealistic asset library. Independent human enjoyment, physical-device touch/installation, screen readers, audible mixing and long sessions require separate evidence. The geometric label checks do not prove editorial clarity or visual appeal. No 60 fps, quality-mode speed ranking or matched before/after improvement claim follows from this release's samples.

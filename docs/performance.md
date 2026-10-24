# 3D performance: smooth play (0.38 and 0.38.1) and the worlds and gameplay baseline

0.38 is the first release of the world-building plan. It makes battles open and play without freezes before richer worlds add to the load; 0.38.1 finishes most of what 0.38.0 left open. This page records what changed, how to measure it, what the software benchmark found, and what is still open. Nothing here was measured on a phone, a laptop GPU or any other physical device; the figures come from headless Chromium with software rendering (SwiftShader).

The [worlds and gameplay plan](worlds-and-gameplay-plan.md) starts from a fresh baseline in all twelve chapters, with the regional scenery of 0.40, and CI now holds each battle's counts below recorded ceilings ([the baseline](#the-worlds-and-gameplay-baseline), [its targets](#targets-of-the-worlds-and-gameplay-plan)).

## What 0.38.1 changed

### The build in short steps

- **The stage and its world** are built by generators that yield between their parts ([`build-steps.js`](../src/showcase/build-steps.js)). `BattleStage.create` runs them in slices of about a frame's work (8 ms) and gives the page a turn between slices; `new BattleStage()` still builds at once for the standalone study and the tests. The stepped environment is exactly the one built at once (a test compares every mesh in three chapters). A build that a newer battle or a release overtakes is discarded at its next pause, and a failure in a superseded build no longer tears down the newer battle's stage.
- **Geometry upload.** A mesh's buffers are made the first time it is drawn, so 0.38.0's first frame sent the whole battle's geometry to the GPU at once (about 1 s in software for Chapter XII). Preparation now draws the meshes a batch at a time ([`stage-preparation.js`](../src/showcase/stage-preparation.js) `uploadGeometry`), hidden ones too, through a material that places every vertex outside the view, with the view turned away and no shadow pass. Their vertex and index buffers are made in short tasks; each batch is sized from how fast the last one went.
- **The preloader** makes the procedural figure surfaces one kind per task, the painted material tiles one per task, and a skin tone's colour and roughness passes in separate tasks. The first figure starts a task of its own.

### Fewer shader programs

- **Shadow depth.** Three's shadow pass hands a caster's colour map to the shared depth material even where no alpha test cuts the caster's outline. The map changed nothing in the shadow, but each textured caster made another depth variant, and the warm-up compiles every variant for every draw order. The pass now takes a map only from alpha-tested casters (leaves, hair) ([`shadow-depth.js`](../src/showcase/shadow-depth.js)); Chapter XII's 15 depth variants became 9.
- **One standing finish.** Stone, wood, cloth and the other standing surfaces share one environment finish whose grain and roughness range are each material's uniforms ([`environment-surface-shaders.js`](../src/showcase/environment-surface-shaders.js)); water, ground, foliage and floor keep their own. Chapter XII's 8 such programs became 4.
- **One-pass overlays.** Three draws a two-sided transparent surface twice, back faces first, with a program for each. The target, selection, hover and goal rings, the markers and the trails are flat or additive, so they draw in one pass: fewer programs and 6 fewer draw calls in every battle.

### Lighter figures

A figure's parts are merged per joint and then into weighted surfaces. Merging copied every triangle's corners out separately, so a smooth part stored, uploaded and skinned each vertex about six times. The merged surfaces now keep each part's shared vertices and join their triangles in an index, in the same order ([`actor-skin.js`](../src/showcase/actor-skin.js) `bindActorSurfaces`, [`actors.js`](../src/showcase/actors.js)). Built with the previous code and the new, 27 figures (nine kinds at three qualities) draw the same triangles corner for corner from 38.6% of the data. Chapter XII's twelve figures hold 12.2 MB of geometry of their own instead of 30.0 MB and are built in 585 ms instead of 878 ms (software rendering); their followers share the indexed overview.

Sharing whole figures between units was considered first, but every one of Chapter XII's twelve figures differs (each bakes its identity, tints and kit into its surfaces), so it would have saved nothing.

### The page updates in place

Every render still produces the page's HTML, but [`page-update.js`](../src/ui/page-update.js) applies it to the live page and keeps each element that is still there. The board keeps its focus and listeners, so keys typed straight after an update reach it; the 3D view keeps its canvas without being re-attached; open panels stay open and typed text stays. Elements are matched by `data-key`, then `id`, then tag in order, and a command button is only reused for the same command, so a focused button never turns into another order. Attributes a script added (the board's binding, the stage's status) and elements a script placed (`data-live`: the 3D labels and the ceremony and story-scene canvases) are left alone. A new screen still starts afresh.

## What 0.38.0 changed

### A battle is prepared before it is shown

The "Preparing" veil stays until everything the battle will draw is ready, and the first frame has been drawn behind it ([`stage.js`](../src/showcase/stage.js) `prepare`).

- **Preloading.** The battle preloader ([`stage-preload.js`](../src/showcase/stage-preload.js)) fetches and decodes, before the stage is built:
  - every body, anatomy, complexion and hair the figures will wear, hidden reinforcements included;
  - the ground, stone, timber and foliage images;
  - the chapter's generated scenery.

  A slow download holds the battle back for 15 s at most; anything later still joins, readied first.
- **Figures** are built once, already wearing their bodies, a few per frame, and the veil counts them in.
- **Shader programs** are compiled and linked before the battle shows:
  - Where the browser compiles in parallel (`KHR_parallel_shader_compile`), the main thread never waits for the driver.
  - Elsewhere each program variant is compiled and first used in its own short task ([`scene-compositor.js`](../src/showcase/scene-compositor.js) `compile`). The first use of a program otherwise waits for every compile queued before it, so one bulk compile froze the page for seconds in its first frame.
  - Stand-ins for what appears only later are compiled with the rest: fieldworks, the beacon, tactical lines, fallen bodies.
- **Shadow-pass variants.** The shadow pass makes its own depth programs, which no compile reaches. One probe render per depth variant, with a single caster and the view turned away, makes each in its own short task. Three's shared depth material changes program only when a caster's instancing or skinning differs from the previous caster's, so which variants a frame needs depends on draw order. Each probe therefore asks for its caster's exact variant, which covers every order.
- **Textures** are uploaded in short tasks before the first frame.
- **Image decoding.**
  - Images embedded in models decode with `createImageBitmap` straight from the model's bytes ([`model-loader.js`](../src/showcase/model-loader.js)). This needs no request at all, which the page's security policy requires, and it decodes off the main thread.
  - The ground images are decoded once per session the same way ([`decoded-images.js`](../src/showcase/decoded-images.js)) and attached as the stage is built, so their materials never change program in play.
- **Generated scenery** is a set of session masters. Each stage places its own copies as it is built, and they compile with the rest.
- **The constant light count.** The brazier borrows the night torch's light instead of adding one, so lighting it does not recompile every lit program.
- **Fewer program variants.**
  - The camera cutaway is a uniform-driven branch of the normal programs.
  - The crowd's bone count is a uniform.
  - The figures' material finish is one program per surface kind.
  - Without the shader error check (`?debug=shaders` turns it back on), first use no longer waits on a link-status query.

### Cheaper frames

- Figures are frustum culled, in view and in the shadow camera, with bounds covering every pose.
- The canvas multisamples only on Performance. Balanced and High multisample once, in the compositor's target.
- While nothing moves, a 60 fps tier draws every other frame.
- The shadow map refreshes at a fixed interval per tier (Performance 250 ms, Balanced 125 ms, High 70 ms) except during motion, and half as often under strain (below).
- Hover picking tests only the figures whose upright capsule the pointer's ray passes near.
- Labels skip layout when the camera, the figures and the labels' text all hold still.
- The ink overlay uploads a hover sweep's newest painting at most every 50 ms.
- Off the road, the road surface no longer carries fully transparent triangles.

### Quality on each device

- **Phones** (a touch-first screen no wider than 820 CSS pixels on its short side) start on Performance until the player chooses. Save-Data and 2 GB of memory or less already did.
- **Strain.** A battle whose frames stay late with its resolution already at the adaptive floor refreshes shadows half as often. The next battle is built a tier lower, never this one in play, and only if the strain was measured at the current tier with adaptive resolution on. The game announces the change, and the player can choose another quality.
- **Slow rendering in play** (since the worlds and gameplay plan's first release). When most of the last 30 frames cost more than 22 ms, the quality steps down a tier at once, but only in place: the frame-rate target, resolution, shadow map and shadow refresh follow the new tier, while the scenery, sky, light, figures and post-processing keep the tier they were built at until the next encounter. Before, the step rebuilt the whole world in play, itself a long stall. After 300 frames in a row within 11 ms, and at least 600 since the last change, the quality steps back up a tier, never above the one the player chose; the game announces both. The tier in use is saved, so the next visit starts there, and the player's choice is saved apart from it (`qualityChoice` in [`settings.js`](../src/ui/settings.js)) and stays the ceiling. A choice in Settings, and the performance check, still rebuild the world at once.
- **Settings → Run performance check** ([`performance-check.js`](../src/ui/performance-check.js)) measures the player's own device in the current 3D battle. About a minute:
  - The check rebuilds the battle at each quality behind the veil, then turns the camera through the overview (5 s), follow (3 s) and horizon (3 s) views, with adaptive resolution off.
  - It shows each quality's build time, typical frame rate, slowest 5% of frames, GPU time (where the browser reports it) and longest freeze, and recommends the richest quality that kept its target. Performance targets 30 fps and Balanced and High 60 fps; the 95th-percentile frame interval may be at most 125% of the target interval, with no task blocking the page for more than 100 ms.
  - It saves the results as JSON: the measurements, the browser, the graphics chip and the screen size. Nothing is sent anywhere.
  - The board takes no commands while it runs (a band covers the page and keys are held back; Escape or Cancel stops it). The encounter, the rules and the random generator are never touched, and the player's own quality and resolution setting come back.

### Fixes found in the survey

- The offline shell now includes every module the page's entry imports before it runs, the board readout among them. The build computes this ([`module-closure.mjs`](../scripts/module-closure.mjs)), so a device that installed only the shell can start offline.
- No chapter downloads the pre-0.31 Roman unit atlas any more, which nothing draws (178 KB per chapter). The complete historical pack keeps it.
- The unused stand-alone palm-frond geometry is gone; the foliage factory draws date palms.
- The procedural surface tiles are generated once per session.

## Measuring

- **`npm run benchmark:stage`** ([`benchmark-stage.mjs`](../scripts/benchmark-stage.mjs)) mounts legal battles in headless Chromium with the game's own battle-stage controller. Each battle is reached from New Game through public commands, then started, and its turns are ended until the enemy strikes. The script:
  - records long tasks, the time until the battle is ready and drawn, shader programs, draw calls and triangles;
  - plays that exchange, then tours the follow, horizon and overview cameras.

  `--check` fails on a page error, a program compiled by the first frame (a variant the warm-up missed) or after the battle is shown (a stall in play), figures without their generated bodies (a Contest's senators have none yet), or more programs than `--max-programs` (60 by default since 0.38.1; it was 90). It also estimates the GPU memory of the scene's own textures and geometry, each counted once; render targets, shadow maps and the compositor's buffers are not included. `--ceilings scripts/stage-ceilings.json` fails a battle whose still-overview draw calls, triangles or programs rise above those recorded for it; `--write-ceilings` records a run's counts as the new ceilings (10% above its calls and triangles, two programs above its programs), and is meant to be run on purpose, in the commit that needs the room. CI runs it on the production build for the Chapter V mine and Chapter XII confrontation battles, against the ceilings, and uploads the report.
- **Software rendering measures main-thread work and counts, not a device's frame rate.** SwiftShader's frames take seconds, and its program links and first texture upload are far slower than a GPU's. Treat its times as relative, and its stalls and counts as real.
- **Settings → Run performance check** is the measurement on a real device.

## Results (software rendering)

### The worlds and gameplay baseline

The [baseline report](evidence/stage-benchmark-world-baseline.json) covers one battle in each chapter on Performance and Balanced, on the production build of the plan's first release, before any of its scenery changes. Its counts are the ceilings in [`stage-ceilings.json`](../scripts/stage-ceilings.json). "In play" is the longest task after the battle was shown; memory is the estimate of the scene's textures plus geometry, in MB.

| Battle | Quality | Ready (first frame), ms | Longest task while building, ms | Longest task in play, ms | Programs | Draw calls | Triangles | Textures + geometry, MB |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ch1-road | performance | 4,853 | 76 | 0 | 41 | 73 | 160,767 | 27.4 + 7.9 |
| ch1-road | balanced | 4,751 | 76 | 0 | 48 | 80 | 337,638 | 35.2 + 10.3 |
| ch2-marsh | performance | 5,197 | 106 | 0 | 43 | 85 | 176,873 | 25.4 + 9.7 |
| ch2-marsh | balanced | 4,840 | 93 | 0 | 51 | 82 | 292,297 | 35.2 + 12.8 |
| ch3-station | performance | 4,603 | 116 | 0 | 41 | 76 | 167,296 | 23.4 + 6.2 |
| ch3-station | balanced | 4,561 | 141 | 0 | 48 | 81 | 377,336 | 31.2 + 8.6 |
| ch4-gate | performance | 5,055 | 94 | 0 | 45 | 106 | 248,750 | 29.4 + 10.8 |
| ch4-gate | balanced | 5,210 | 95 | 83 | 51 | 106 | 494,312 | 38.2 + 13.9 |
| ch5-mine | performance | 5,537 | 110 | 0 | 46 | 127 | 235,498 | 29.6 + 13.4 |
| ch5-mine | balanced | 5,209 | 96 | 0 | 50 | 138 | 437,313 | 44.5 + 20.0 |
| ch6-wells | performance | 5,687 | 114 | 0 | 44 | 113 | 219,178 | 30.9 + 13.9 |
| ch6-wells | balanced | 4,874 | 102 | 0 | 50 | 112 | 340,503 | 43.7 + 17.9 |
| ch7-legion | performance | 5,691 | 105 | 0 | 46 | 126 | 312,072 | 32.1 + 14.3 |
| ch7-legion | balanced | 4,669 | 96 | 0 | 53 | 124 | 571,384 | 41.9 + 18.3 |
| ch8-ferry | performance | 5,803 | 108 | 0 | 48 | 124 | 348,192 | 32.2 + 15.1 |
| ch8-ferry | balanced | 5,955 | 91 | 0 | 56 | 125 | 604,485 | 42.0 + 19.3 |
| ch9-wing | performance | 5,324 | 78 | 0 | 46 | 133 | 276,544 | 32.8 + 15.2 |
| ch9-wing | balanced | 5,741 | 311 | 0 | 52 | 128 | 456,833 | 44.3 + 21.0 |
| ch10-road | performance | 5,665 | 121 | 0 | 47 | 129 | 301,032 | 29.4 + 12.9 |
| ch10-road | balanced | 5,225 | 81 | 0 | 54 | 129 | 536,916 | 38.2 + 16.9 |
| ch11-accounts | performance | 6,603 | 90 | 0 | 49 | 116 | 148,766 | 25.7 + 32.6 |
| ch11-accounts | balanced | 6,386 | 82 | 0 | 53 | 127 | 274,523 | 31.5 + 43.7 |
| ch12-confrontation | performance | 5,260 | 77 | 0 | 46 | 138 | 400,354 | 26.2 + 13.9 |
| ch12-confrontation | balanced | 5,234 | 75 | 0 | 53 | 135 | 785,732 | 35.0 + 18.4 |

- **No program was compiled by the first frame or after the battle was shown, in any of the 24 runs**, and every battle's figures wore their generated bodies; Chapter XI's scene is a Contest, whose senators are still code-built.
- **Counts repeat exactly.** Runs of the same build give the same programs, draw calls and triangles; that is what lets CI hold them.
- **Two outliers did not repeat.** The 311 ms task while building Chapter IX on Balanced and the 83 ms task in play in Chapter IV on Balanced came while the development container was also running other work, tests among it. Repeated alone, Chapter IX's longest task while building was 88 ms, and three runs of Chapter IV had none in play; the counts were identical.
- **Compared with 0.38.1** in the five battles it measured, with several releases between (the regional scenery replaced the generic buildings outside the board): programs are fewer, 41–46 on Performance and 48–53 on Balanced (46–52 and 49–56 then). Triangles are lower in all five on Performance and in Chapters I, V and VII on Balanced, and higher on Balanced in Chapter IX (+1%) and Chapter XII (+4%). Draw calls are lower except in Chapter V (+12 on Performance, +19 on Balanced) and in Chapter IX on Performance (+4).

### 0.38.1

The [0.38.1 report](evidence/stage-benchmark-v0381.json) was recorded with the same script on the same machine as [0.38.0's](evidence/stage-benchmark-v038.json), with the same columns as the table below.

| Battle | Quality | Ready (first frame), ms | Longest task while building, ms | Longest task in play, ms | Programs | Draw calls | Triangles |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ch1-road | performance | 3,832 → 3,725 | 558 → 67 | 0 → 0 | 58 → 46 | 103 → 97 | 205,974 → 205,507 |
| ch1-road | balanced | 4,514 → 3,971 | 719 → 63 | 0 → 0 | 61 → 49 | 102 → 96 | 392,451 → 391,984 |
| ch5-mine | performance | 4,600 → 4,540 | 725 → 66 | 0 → 0 | 63 → 51 | 121 → 115 | 249,934 → 249,451 |
| ch5-mine | balanced | 4,809 → 4,444 | 814 → 89 | 0 → 0 | 66 → 54 | 125 → 119 | 460,120 → 459,637 |
| ch7-legion | performance | 4,450 → 4,523 | 622 → 70 | 0 → 0 | 63 → 51 | 137 → 131 | 336,628 → 336,145 |
| ch7-legion | balanced | 4,923 → 3,562 | 667 → 59 | 0 → 0 | 66 → 54 | 137 → 131 | 576,873 → 576,390 |
| ch9-wing | performance | 5,505 → 5,037 | 679 → 68 | 0 → 0 | 63 → 52 | 135 → 129 | 286,251 → 285,768 |
| ch9-wing | balanced | 4,347 → 3,837 | 739 → 82 | 0 → 0 | 65 → 54 | 136 → 130 | 451,442 → 450,959 |
| ch12-confrontation | performance | 5,130 → 4,848 | 631 → 65 | 0 → 0 | 64 → 52 | 154 → 148 | 404,375 → 403,892 |
| ch12-confrontation | balanced | 5,684 → 4,074 | 962 → 67 | 0 → 0 | 68 → 56 | 154 → 148 | 757,082 → 756,599 |

None of 0.38.1's programs was compiled by the first frame or after the battle was shown. Draw calls fell by 6 in every battle and the triangles by about 480: the overlays that drew twice draw once. Ready times vary by a few hundred milliseconds from run to run in software (in a run of the same build shortly before, Chapter VII on Performance was ready in 4.1 s, not 4.5 s).

### 0.38.0

The two reports were recorded with the same script on the same machine: [0.37.0](evidence/stage-benchmark-v037.json) and [0.38.0](evidence/stage-benchmark-v038.json). "Ready" is the first frame of the battle: for 0.37.0, the first frame after construction; for 0.38.0, the frame behind the veil. "In play" covers the time after the battle is shown: assets arriving (settle), the legal exchange (combat) and the camera tour. Programs, draw calls and triangles are counted from the still overview.

| Battle | Quality | Ready (first frame), ms | Longest task while building, ms | Longest task in play, ms | Programs compiled in play | Programs | Draw calls | Triangles |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ch1-road | performance | 6,620 → 3,832 | 5,017 → 558 | 5,640 → 0 | 18 → 0 | 58 → 58 | 103 → 103 | 211,447 → 205,974 |
| ch1-road | balanced | 6,924 → 4,514 | 4,888 → 719 | 8,393 → 0 | 17 → 0 | 62 → 61 | 102 → 102 | 397,924 → 392,451 |
| ch5-mine | performance | 7,462 → 4,600 | 5,263 → 725 | 6,784 → 0 | 17 → 0 | 72 → 63 | 121 → 121 | 266,251 → 249,934 |
| ch5-mine | balanced | 8,393 → 4,809 | 5,740 → 814 | 7,727 → 0 | 19 → 0 | 76 → 66 | 125 → 125 | 476,437 → 460,120 |
| ch7-legion | performance | 8,397 → 4,450 | 6,132 → 622 | 6,233 → 0 | 18 → 0 | 86 → 63 | 137 → 137 | 337,740 → 336,628 |
| ch7-legion | balanced | 8,812 → 4,923 | 5,492 → 667 | 9,819 → 0 | 19 → 0 | 88 → 66 | 137 → 137 | 577,985 → 576,873 |
| ch9-wing | performance | 8,106 → 5,505 | 5,756 → 679 | 7,830 → 0 | 18 → 0 | 75 → 63 | 135 → 135 | 302,008 → 286,251 |
| ch9-wing | balanced | 8,829 → 4,347 | 5,460 → 739 | 10,269 → 0 | 18 → 0 | 76 → 65 | 136 → 136 | 467,199 → 451,442 |
| ch12-confrontation | performance | 8,604 → 5,130 | 6,175 → 631 | 8,533 → 0 | 15 → 0 | 79 → 64 | 154 → 154 | 419,038 → 404,375 |
| ch12-confrontation | balanced | 9,245 → 5,684 | 5,537 → 962 | 12,681 → 0 | 17 → 0 | 85 → 68 | 154 → 154 | 771,745 → 757,082 |

The browser reports long tasks of 50 ms or more, so 0 in the in-play column means none. "Programs" counts the still overview's programs; counting the ones 0.37.0 compiled later in play, each battle compiled 76–107 programs in 0.37.0 and 58–68 in 0.38.0, and none of 0.38.0's were compiled by the first frame. The browser did not offer parallel shader compiling, so these runs used the short-task path. The triangle counts fell by 0.2–6.1% because the road lost its transparent cells; draw calls did not change.

## Targets

| Target (plan) | Status after 0.38.1 |
| --- | --- |
| No freeze over 100 ms (phone) / 50 ms (laptop) in play | In the software benchmark, no task of 50 ms or more after the battle is shown, and nothing compiled in play, in all ten runs of 0.38.0 and of 0.38.1 (0.37.0: 15–19 programs compiled in play and tasks of 4.0–12.7 s). Real devices are unmeasured. |
| All shader programs compiled before the battle shows | Met in every scene: none in the first frame, none after it. |
| Battle ready in about 3 s (phone) / 2 s (laptop), with a progress veil | The veil shows progress. Software times are not device times; the performance check measures build time on a device. |
| The build in tasks under 200 ms | Met in software since 0.38.1: the longest task while building is 59–89 ms (0.38.0: 0.56–0.96 s; 0.37.0: 4.9–6.2 s). Phones will take longer per task; the slices are sized by time (8 ms), not by work, but single steps such as the first figure are not split further. |
| At most 45 shader programs | Not met: 46–56 (0.38.0: 58–68). What remains is mostly three's own variants of the current materials: shadow-depth variants by instancing, instance colour, skinning, side and alpha test (warmed for every draw order), the standing surfaces' variants by texture, instancing and side, and the figures' own finish. |
| Draw calls down at least 30% | Not met: down 4–6% in the still overview (6 per battle, from the one-pass overlays). Culling helps only views that leave figures off screen. |
| 30 fps on mid-range phones, 60 fps on integrated laptops | Unmeasured: this needs the performance check on real devices. |

## Targets of the worlds and gameplay plan

| Target | Phone (Performance) | Laptop, integrated graphics (Balanced) | Baseline (software rendering) |
| --- | --- | --- | --- |
| Triangles per frame | at most 400,000 | at most 1,000,000 | Performance 148,766–400,354: Chapter XII's confrontation is 354 over. Balanced 274,523–785,732. |
| Draw calls per frame | at most 150 | at most 250 | Performance 73–138, Balanced 80–138. |
| Shader programs per battle, none compiled after it shows | at most 50 | at most 50 | Performance 41–49; Balanced 48–56, above 50 in eight chapters. None compiled late. |
| GPU memory, textures and geometry | at most 300 MB | at most 600 MB | Estimated 29.6–58.3 MB on Performance and 39.8–75.2 MB on Balanced, without render targets. |
| Battle ready once downloaded | about 3 s | about 2 s | Software times (4.6–6.6 s) are not device times; the performance check measures devices. |
| Frame rate | steady 30 fps | steady 60 fps | Unmeasured: needs the performance check on real devices. |

## Still open after 0.38.1

- A quality change in Settings (and each step of the performance check) still rebuilds the world in one task; only a battle's first build is stepped. An automatic change in play no longer rebuilds anything.
- A worker pool for the pure geometry work. With the build in short steps it would mainly shorten the time behind the veil, not remove freezes.
- One renderer per session (the battle and ceremony controllers still create one per encounter). Disposing a stage frees its programs, so sharing a renderer would also mean keeping programs alive across stages. Browsers keep program caches of their own, so the gain needs measuring on devices before it is worth the change.
- Moving the river and banner motion into vertex shaders, a cached height grid for feet and contact shadows, and one skinned mesh and skeleton per figure.
- KTX2/meshopt compression and smaller downloads for 3D players (0.39).

## What the owner can do next

Run Settings → Run performance check in a 3D battle on a phone and on a laptop, save the results and send the files. The tiers are tuned from those.

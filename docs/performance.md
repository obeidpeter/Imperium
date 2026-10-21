# 3D performance: smooth play (0.38)

0.38 is the first release of the world-building plan. It makes battles open and play without freezes before richer worlds add to the load. This page records what changed, how to measure it, what the software benchmark found, and what is still open. Nothing here was measured on a phone, a laptop GPU or any other physical device; the figures come from headless Chromium with software rendering (SwiftShader).

## What changed

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

  `--check` fails on a page error, a program compiled by the first frame (a variant the warm-up missed) or after the battle is shown (a stall in play), figures without their generated bodies, or more programs than `--max-programs`. CI runs it on the production build for the Chapter V mine and Chapter XII confrontation battles and uploads the report.
- **Software rendering measures main-thread work and counts, not a device's frame rate.** SwiftShader's frames take seconds, and its program links and first texture upload are far slower than a GPU's. Treat its times as relative, and its stalls and counts as real.
- **Settings → Run performance check** is the measurement on a real device.

## Results (software rendering)

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

| Target (plan) | Status after 0.38 |
| --- | --- |
| No freeze over 100 ms (phone) / 50 ms (laptop) in play | In the software benchmark, no task of 50 ms or more after the battle is shown, and nothing compiled in play, in all ten runs (0.37.0: 15–19 programs compiled in play and tasks of 4.0–12.7 s). Real devices are unmeasured. |
| All shader programs compiled before the battle shows | Met in every scene: none in the first frame, none after it. |
| Battle ready in about 3 s (phone) / 2 s (laptop), with a progress veil | The veil shows progress. Software times are not device times; the performance check measures build time on a device. |
| The build in tasks under 200 ms | Not met; the longest build task was 0.56–0.96 s on this machine (0.37.0: 4.9–6.2 s), and phones will take longer. Three kinds of task are still longer than 200 ms. The stage's synchronous build (above all the environment) took 0.56–0.82 s. The first frame behind the veil, which uploads the battle's geometry (up to about 40 MB in Chapter XII, most of it the figures' own surfaces), took 0.05–0.96 s; it is slow in software and much shorter on a GPU, but unmeasured here. Before both, the preloader's procedural figure surfaces and skin tones took about 0.25–0.3 s each in a profile of one battle. |
| At most 45 shader programs | Not met: 58–68. The rest are inherent to the current materials: the shadow-pass variants (warmed for every draw order), overlays, and one environment finish per surface kind. |
| Draw calls down at least 30% | Not met: unchanged in the still overview (triangles 0.2–6.1% fewer). An earlier reading was taken while the camera eased home and was not comparable. Culling helps only views that leave figures off screen. |
| 30 fps on mid-range phones, 60 fps on integrated laptops | Unmeasured: this needs the performance check on real devices. |

## Not in 0.38

- Splitting the stage's synchronous build into short tasks, and a worker pool for the pure geometry work.
- One renderer per session (the battle and ceremony controllers still create one per encounter). Disposing a stage frees its programs, so sharing a renderer would also mean keeping programs alive across stages. Browsers keep program caches of their own, so the gain needs measuring on devices before it is worth the change.
- Moving the river and banner motion into vertex shaders, a cached height grid for feet and contact shadows, and one skinned mesh and skeleton per figure.
- Partial page updates in [`app.js`](../src/ui/app.js) instead of rebuilding the page on each update. The 3D stage is already kept across updates.
- KTX2/meshopt compression and smaller downloads for 3D players (0.39).

## What the owner can do next

Run Settings → Run performance check in a 3D battle on a phone and on a laptop, save the results and send the files. The tiers are tuned from those.

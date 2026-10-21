# Changelog

## Unreleased — 0.40 Phase 0: the real-time arena

The first phase of the conversion to real time with pause, following the real-time build brief (supplied separately, not stored here) and the [0.40 player guide](docs/player-guide-0.40.md). Results: [Phase 0 report](docs/realtime-phase-0-report.md). The campaign, its rules and saves are unchanged and still play on turns.

- **Survey:** every module mapped to keep, adapt, replace or delete after Gate 4, and the stack recorded exactly ([realtime-survey.md](docs/realtime-survey.md)).
- **Simulation core** ([`src/core/realtime/`](src/core/realtime)): a fixed 20 Hz tick, Commands queued for the next tick with the latest order per actor winning, named random streams split from the campaign's seeded generator, a 0.5 m walkability grid with A* and string pulling, the §3.5 blow (d40 roll, criticals, front-arc shields, absorb and resist, staggers), Strike, Brace and Throw pilum with pure forecasts and reason codes, simple enemy AI, a battle log, and an exact snapshot with a world hash. Every rule is data ([`realtime-rules.js`](src/data/realtime-rules.js)).
- **The arena** ([`showcase/arena.html`](showcase/arena.html)): click to move, walk and run, hold to steer, combat mode, auto-fight, Brace and Throw pilum; forecasts, the message line, cursor states, allegiance rings that show facing, and the battle log; pause, slow time and one round at a time; browser-safe keys bound by physical key, and the scene's browser defaults kept to itself.
- **The `controlsModel` flag**, its per-chapter fallback and a development menu ([`controls-model.js`](src/core/controls-model.js)).
- **Simulation timing** in Settings → Run performance check (report version 2) and the arena's own check.
- **Tests:** A1 (100 replays at 50/75/100% with random pauses), A2 (50 save/load continuations), A3, A4, combat statistics (C13, C17), movement (B6, B8–B10), the shield arc, staggers, abilities, browser-safe input and the Gate 0 auto-fight duels. The browser smoke test plays the arena on the production build.

## 0.38.1 — the rest of smooth play, and clean-ups

Most of what 0.38.0 left open, and a tidier codebase. The rules, the campaign and saves are unchanged. Details and measurements: [performance notes](docs/performance.md).

- **Built in short steps.** The 3D stage and its world are built in steps of about a frame's work behind the "Preparing" veil, so the page keeps answering while a battle is made ([`build-steps.js`](src/showcase/build-steps.js)).
  - The first frame no longer sends the battle's whole geometry to the GPU at once. Preparation draws the meshes a batch at a time through a material that puts every vertex outside the view, so their buffers are made in short tasks.
  - The preloader makes the procedural figure surfaces one kind per task, the painted material tiles one per task, and a skin tone's colour and roughness in separate tasks.
  - A build that a newer battle overtakes is discarded, and its failure no longer tears down the newer battle.
- **Fewer shader programs:** 58–68 per battle became 46–56.
  - The shadow pass takes a caster's colour map only where an alpha test cuts its outline ([`shadow-depth.js`](src/showcase/shadow-depth.js)). The map changed nothing in the shadow but made every textured caster another depth variant.
  - Stone, wood, cloth and the other standing surfaces share one environment finish whose grain and roughness are each material's uniforms.
  - Flat and additive overlays (rings, markers, trails) draw in one pass instead of back faces and front faces with a program each: 6 fewer draw calls per battle.
- **Lighter figures.** A figure's merged surfaces keep their shared vertices: the same triangles, corner for corner, from 38.6% of the data. Chapter XII's twelve figures hold 12.2 MB of geometry instead of 30.0 MB and are built a third faster.
- **The page updates in place** ([`page-update.js`](src/ui/page-update.js)). Each render still produces the page's HTML, but only what changed is applied:
  - the board keeps its focus and listeners, so keys typed straight after an update reach it;
  - the 3D view keeps its canvas, and open panels and typed text stay;
  - a focused command button is never reused for another order;
  - a new screen still starts afresh.
- **Clean-ups.**
  - Text files are stored with LF line endings (`.gitattributes`).
  - The verification reports of 0.2–0.34 moved to [docs/archive](docs/archive/README.md). The player guide says it describes 0.38.
  - 58 test assertions that matched source text are behavioural tests now. The logic they described lives in small modules (board input, board readout, settings), and a small DOM for Node runs the real app module.
  - The 923-line stage class is split into six modules by concern. The longest lines in the shell, the panels and the stage (up to 8,036 characters) are at most 178.
- **Character handoff.** The handoff GLBs are re-exported from the current figure code (21.8 MB instead of 29.1 MB). Their README says what they show: the code-built figure, which the game draws until a figure's generated body arrives or if it fails.
- **Downloads.** The first load grew by 6.5 KB to 501,565 bytes, Chapter I by 15 KB to 9,510,791 bytes, and the complete campaign is 17,952,336 bytes (the new modules, and the split and re-wrapped code).
- **Measured (software rendering, five battles, Performance and Balanced; [0.38.0](docs/evidence/stage-benchmark-v038.json), [0.38.1](docs/evidence/stage-benchmark-v0381.json)).**
  - The longest task while building fell from 0.56–0.96 s to 59–89 ms.
  - Battles were ready (drawn behind the veil) in 3.6–5.0 s instead of 3.8–5.7 s; software times are inflated and vary from run to run.
  - Programs fell from 58–68 to 46–56, none compiled by the first frame or in play, and draw calls by 6 in each battle. No task reached 50 ms after a battle was shown, as in 0.38.0.
- **Still open.**
  - At most 45 programs per battle: 46–56.
  - Draw calls down 30%: down 4–6%.
  - A quality change in Settings still rebuilds the world in one task.
  - One renderer per session and a worker pool.
  - No real device has run 0.38.0 or 0.38.1. **Next:** run Pause → Run performance check on a phone and a laptop and send the saved files.
- **Checks.**
  - New tests cover the page update rules and the board keeping its focus and bindings in the real app; the stepped environment being exactly the one built at once (three chapters); the geometry upload; a superseded build; the shared standing finish, the shadow pass's maps and the one-pass overlays; and the indexed figure surfaces.
  - `npm run smoke` checks that the board is the same, still-focused element after a keyboard walk and an undo.
  - `npm run benchmark:stage -- --check` now also fails on more than 60 programs (it was 90).

## 0.38.0 — smooth play

The first release of the world-building plan: battles open without long freezes and play without any, before richer worlds add to the load. Details, measurements and what is still open: [performance notes](docs/performance.md).

- **Prepared before shown.** Behind the "Preparing" veil, which now counts the figures in, a battle gets everything it will draw:
  - its figures, built once and already wearing their bodies;
  - its ground, stone, timber and foliage images, decoded once per session;
  - its generated scenery, as session masters;
  - every shader program, compiled and linked one variant per short task where the browser cannot compile in parallel, including the shadow pass's own depth variants (warmed for every draw order);
  - its textures, uploaded in short tasks.

  Nothing is compiled, rebuilt or decoded in play.
- **Off the main thread.** Images inside models decode with `createImageBitmap` from the model's own bytes, which the page's security policy allows ([`model-loader.js`](src/showcase/model-loader.js)); the ground images too ([`decoded-images.js`](src/showcase/decoded-images.js)).
- **Fewer program variants.** The camera cutaway, the crowds' bone count and the figures' material finish no longer multiply programs, and lighting a brazier no longer recompiles every lit program.
- **Cheaper frames.**
  - Figures are culled outside the view and the shadow camera.
  - Balanced and High multisample once.
  - A still 60 fps scene draws every other frame.
  - Shadows refresh on a fixed interval per tier.
  - Picking prefilters figures by their upright capsule.
  - Labels skip layout when nothing moved.
  - The ink overlay uploads at most every 50 ms.
  - The road has no fully transparent triangles.
- **Quality per device.**
  - Phones start on Performance.
  - A battle that stays slow at its lowest resolution refreshes shadows half as often, and the next battle is built a tier lower, never this one in play.
  - **Pause → Run performance check** rebuilds the current 3D battle at each quality, turns the camera through three views, shows each quality's frame rates and longest freeze, recommends one and saves the results as JSON. The board takes no commands while it runs, and nothing is sent anywhere ([`performance-check.js`](src/ui/performance-check.js)).
- **Fixes from the survey.**
  - The offline shell carries every module the page imports before it runs, the board readout included ([`module-closure.mjs`](scripts/module-closure.mjs)).
  - Chapters no longer download the pre-0.31 Roman atlas, which nothing draws (178 KB each).
  - The unused palm-frond geometry is gone.
  - Procedural surface tiles are generated once per session.
- **Downloads.** The first load grew by 12 KB to 495,064 bytes (the board readout and the performance check now load with the page). Chapter I fell by 159 KB to 9,495,867 bytes, and the complete campaign is 17,937,412 bytes.
- **Measured (software rendering, five battles, Performance and Balanced; [0.37.0](docs/evidence/stage-benchmark-v037.json), [0.38.0](docs/evidence/stage-benchmark-v038.json)).** The first frame comes 32–51% sooner (6.6–9.2 s became 3.8–5.7 s; software times are inflated). The longest task while building fell from 4.9–6.2 s to 0.56–0.96 s. After a battle is shown (assets arriving, a legal exchange, a camera tour), 0.37.0 compiled 15–19 shader programs and froze for 4.0–12.7 s; 0.38.0 compiles none and no task reaches 50 ms. Programs per battle fell from 76–107 to 58–68, triangles by 0.2–6.1%.
- **Not met.** Three targets from the plan:
  - The stage's synchronous build (above all the environment), the first frame's geometry upload and the preloader's procedural figure surfaces are still single tasks over 200 ms.
  - There are 58–68 shader programs per battle against a target of 45.
  - Draw calls in the overview are unchanged. An earlier reading suggested fewer, but it was taken while the camera eased home.

  One renderer per session, a worker pool and partial page updates are not in this release.
- **Checks.**
  - New tests cover:
    - the sliced compile units and texture collection;
    - session images and scenery masters, and decoding from model bytes with its image-element fallback;
    - the road trimming, the ink throttle and the pick prefilter;
    - the offline shell closure;
    - the performance check, the strain step-down and the phone default.
  - `npm run benchmark:stage -- --check` fails on any program compiled by the first frame or after a battle is shown. CI runs it on the production build for two battles and uploads the report.
  - `npm run smoke` now runs the performance check through the real interface.

  All checks ran with software rendering; no real device or GPU has run this release. **Next:** run Pause → Run performance check on a phone and a laptop and send the saved files.

## 0.37.0 — generated character bodies for every battle figure

- **Sixteen generated character bodies.** Every figure in the battles and both ceremonies now wears a detailed body generated with Tripo from a text prompt and bound in Blender to the game's own skeleton: Roman recruits, their trainer, legionaries, archers, a centurion and a commander; a civilian; and Gothic, Persian and Palmyrene infantry, archers and riders. Each was rigged by Tripo's auto-rig, posed into the game's bind pose with Tripo's weights, folded onto the game's 15 joints, fitted to its proportions and sole plane, welded at its texture seams, and given a near (11,131–11,611 triangles) and an overview level (about 2,500), with a 1,024 px WebP colour map and 512 px normal and roughness maps (418–558 KB each).
- **The game's own animation and kit.** Bodies take the place of the procedural clothes, armour, heads and limbs only. Every clip, gesture, contact and foot plant, the gripping hands, weapons, shields and their heraldry, bows, quivers, scabbards, standards, cloaks, crests and phalerae, and the horses stay the game's own. The protagonist wears a centurion's mail in Chapters IV–VI and a commander's cuirass from Chapter VII; at the accession his cloak takes the emperor's purple. Civic speakers and voters keep their togas, whose trims name their bloc.
- **Loading and fallback** ([`actor-bodies.js`](src/showcase/actor-bodies.js), [`actor-body-catalog.js`](src/ui/actor-body-catalog.js)): one shared master per body, skinned to each figure's own bones; a figure stays procedural until its body arrives, or if it fails. Formation followers march in the generated overview level and fallen bodies keep its colours.
- **Followers carry their leader's visible kit only.** An archer unit's followers no longer hold the sword their leader keeps hidden, nor an unthrown javelin or arrow.
- **Cheaper to draw.** In the Chapter V mine battle the renderer counted about 30% fewer triangles and 17–20% fewer draw calls than with the procedural figures (software rendering; not a frame-time measurement).
- **Downloads.** Each body joins only the chapters whose figures wear it. Chapter I's figures wear five, so its download limit rises from 8 MB to 10 MB (9,654,943 bytes used); the 2 MB first load is unchanged (483,045 bytes), and the complete campaign is 17,918,247 of 24,000,000 bytes.
- **Pipeline:** `npm run asset:tripo -- rig` rigs a generated character; `npm run asset:bind` binds it to the game's skeleton under Blender and quantizes it (`KHR_mesh_quantization`). Each task's own credit charge is recorded, and polling survives a gateway error. The batch cost 720 credits. Prompts, tasks, rigs, digests and licences are in [`art-source/models/requests/`](art-source/models/requests/), [`asset-manifest.json`](docs/asset-manifest.json) and [`art-generation.md`](docs/art-generation.md).
- **Checks.** New tests cover the catalog against the real campaign and ceremonies, each body's records, budget, joints and bind pose, mounting and kit, a strike's deformation, fallback and disposal, followers, fallen bodies and downloads. `npm run smoke` now also waits for the bodies in the production page. The character handoff test no longer depends on the handoff being current. All checks ran with software rendering; no real device or GPU has run this release.

## 0.36.0 — the first Tripo-generated scenery, in Chapter V

- **Five generated props in Chapter V.** Spoil baskets, mine timbers, a mudbrick stack, storage jars and a leather tent stand as a supply camp on open ground off the board's west and south sides, in both Chapter V encounters. They were generated with Tripo from text prompts on the owner's paid account and processed in Blender to 2,900–4,900 triangles, 512 px WebP textures and real-world heights (161–271 KB each). They load at Balanced and High quality only, and only Chapter V downloads them. The rules, the board and its units are unchanged. Presentation only: no rules state and no gameplay randomness.
- **Loader** ([`scenery-models.js`](src/showcase/scenery-models.js)):
  - stands each model on the lowest ground under it;
  - never takes a pick;
  - joins the camera cutaway, so in the horizon, follow and action views a model never hides the selected units;
  - frees all its resources on dispose;
  - leaves out a model that fails to load.

  It decodes embedded textures through image elements, so the page's Content Security Policy (no `blob:` fetches) stays as it is.
- **Placement.** A search of both encounters' built scenes chose ground that is clear of every structure and boulder, in frame and unobstructed for the overview camera, and never drawn over the board. The horizon camera mostly sees them hidden behind the arrival-side buildings.
- **Downloads.** Models in `assets/models/chapters/NN/` belong to that chapter's offline group alone, which `verify-assets` now checks. Chapter I's download is unchanged apart from the new loader's code.
- **Records.** Each model's prompt, Tripo task, model version, raw digest, processing settings and licence are in [`art-source/models/requests/`](art-source/models/requests/), [`asset-manifest.json`](docs/asset-manifest.json) and [`art-generation.md`](docs/art-generation.md).
- **Checks.** New tests cover each model's records, budget and download group, placement off the board from legal Chapter V starts, and the loader. `npm run smoke` now waits for all five models in the production page's 3D view, so a loader fault or a policy error fails it. All checks ran with software rendering; no real device or GPU has run this release.
- **Generated 3D asset pipeline (tooling):**
  - `npm run asset:tripo` creates and fetches Tripo tasks through the environment's network secret;
  - `npm run asset:process` makes a game-ready GLB under Blender;
  - `npm run asset:check` checks it against its budget and the game's loader;
  - `npm run asset:preview` renders a review sheet.

  See [the asset pipeline](docs/asset-pipeline.md).

## 0.35.1 — one battle per approach, a handoff that no longer blocks the tests, and smaller fixes

- **The character handoff no longer blocks `npm test`** ([`check-character-handoff.mjs`](scripts/check-character-handoff.mjs), [`character-handoff.test.mjs`](tests/character-handoff.test.mjs)):
  - The tests still check the committed GLBs as files (hashes, glTF structure, skins, maps and clips), but no longer require them to match the current character code. Before, any change to the character code failed the tests until 29 MB of models were re-exported with Sharp, which the project does not declare.
  - `npm run audit:handoff` reports a stale export; `npm run verify` prints the same notice without failing.
  - `npm run art:handoff` now writes into `art-source/characters/` from any working directory.
- **A field approach covers one field battle** ([`field-approaches.js`](src/core/field-approaches.js)): like the operational preparation, it returns to direct deployment after the encounter, so a costly approach is never charged again without being chosen. The camp table says so, and the [player guide](docs/PLAYING.md#the-command-campaign) now describes the four approaches.
- **Counter blow** ([`battle.js`](src/core/battle.js)): a mounted attacker withdrawn by a braced defender's counter blow now shakes companions within two tiles, as any other loss does. The forecast says when the counter blow would withdraw the attacker.
- **Presentation** (no rules or randomness involved):
  - Fallen figures and spent arrows on a repaired bridge rest on the deck, not on the river bed below it.
  - Changing the figure style keeps each figure until its replacement is ready, as a quality change already did.
  - On busy turns, footstep sounds are thinned evenly across all movers; before, the first movers kept them all and the last went silent.
  - The signal flag is two-sided without turning every bronze and accent piece on the field double-sided.
- **Tests and records:**
  - The approach buttons have Node tests and a browser smoke step: a restored Chapter V camp, the engineering approach chosen through the camp table, and the gate found open.
  - The handoff GLBs are recorded under `developmentAssets` in [`asset-manifest.json`](docs/asset-manifest.json) and in [`art-generation.md`](docs/art-generation.md).
  - The production recording script discloses its one setup command run in Node, and the approach tests label their supply fixtures.

## 0.35.0 — character production and field approaches

- Added tactics edition 35: from Chapter III, a field approach (direct, engineering, diversion or defensive advance) joins the operational preparation, with combined supply costs paid at departure, exact Retry and visible enemy responses. Existing command saves opt in at camp.
- Refined characters: skin pore and roughness response, cloth folds, formed helmets, padded necklines, a shield grip that turns with the board, recovery and recoil clips, and travel timing based on distance.
- Animation snapshots keep the complete encounter, so gates, bridges and veteran details no longer vanish after a command; a quality rebuild keeps each figure until its replacement is mounted.
- Added contextual close-view labels, regional horizon landmarks and a device and frame report.
- Added rigged GLB handoffs of three Chapter V figures in `art-source/` (excluded from the build) and four legal edition-35 campaigns to `npm run verify`.

## 0.34.0 — Chapter V benchmark and campaign-wide production pass

- Replaced the Chapter V generic siege entrance with fractured mudbrick walls, countermining works, rubble and supported repair equipment. Added twelve regional palettes and grounded architectural footings.
- Rebuilt interactive field objects with spoked carts, sacks, bound timber, hinged gate states, damaged/repaired bridges, standards and bowl braziers. Batched materials and quality-dependent detail keep their cost bounded.
- Unified bridge deck height across character feet, selection/picking, movement links, grid and ink overlays; redrape when the committed field state changes.
- Added continuous tunics, cast and career material identities, an original cloth/leather/metal atlas, restrained facial corrective morphs, eleven reproducible joint-animation clips, horse refinements and lighter overview geometry.
- Added edition-34 deployment preparations, side-level enemy doctrines, distinct chapter field opportunities, once-per-round frontal cavalry counterplay and issue-specific political evidence. Exact forecasts and camp opt-in preserve earlier campaigns.
- Added political case inspection before committing a speech, command records, camp practice access, compact battlefield framing, high-contrast settings, configurable touch holds and swappable shortcut bindings.
- Added chapter-specific audio direction and public-state tension mixing while retaining local recordings, mute/gesture behavior, hidden-tab suspension and bounded resources.
- Added character source compilation/auditing, legal campaign variants and a public-interface twelve-chapter browser benchmark. Manual art review, real-device measurements and human playtests remain separate qualification gates.

## 0.33.0 — hold a finger to see the route, and browser smoke tests on every pull request

- **Press and hold on touch screens** ([`touch-hold.js`](src/ui/touch-hold.js), [`app.js`](src/ui/app.js), [`stage.js`](src/showcase/stage.js)):
  - Touch has no hover, so on a phone the route could not be seen before committing to it. Holding a finger still on the board for about half a second now shows what a tap there would do, in 2D and 3D: the readout and, on open ground, the route.
  - Lifting the finger after a hold does nothing; a tap then walks as before.
  - Moving the finger cancels the hold; in 3D it orbits the camera as before.
  - The preview stays after the finger lifts.
  - A long press no longer cancels a pending order through the browser's context menu.
- **Browser smoke tests** ([`browser-smoke.mjs`](scripts/browser-smoke.mjs), `npm run smoke`): the production build is driven in headless Chromium through the real interface. The test fails on any page or console error. It covers:
  - New Game and the Chapter I drill in 2D: keyboard and pointer walks, Undo, Confirm moves, an opponent's preview and Help;
  - a keyboard walk in 3D;
  - a legal Chapter V expanded checkpoint restored through the Restore dialog, with field objects named in the cursor, readout, announcement and ground note;
  - touch at phone width: hold to preview in 2D and 3D, tap to walk.
- **CI**: the smoke test runs on every pull request, with Playwright 1.56.1 installed for that job only. It is not a project dependency, and the game still needs no install step.
- **Wording**: the in-game Help, the player guide and the drill lesson add holding a finger to pointing and the cursor as ways to see the route.
- **Checks**:
  - `npm run verify` passes on Node 20: 698 tests, the standard and four expanded legal-command campaigns to Augustus with unchanged turn counts, the build, the asset and offline checks, and the character audit. `npm test` also passes on Node 22.
  - The smoke test passed four times in a row locally on the production build, in headless Chromium with software rendering. That was after one fix to the test: it now waits for a re-rendered board to be live before clicking, as a player waits for it to be redrawn. A click within the single frame after a re-render is not handled, which only a script is fast enough to hit.
  - Touch was driven by Chrome's touch emulation, not a real phone. There were no real-device or screen-reader checks.

## 0.32.1 — field objects named on the board, a player guide to the expanded campaign, and continuous integration

- **Field objects named wherever a tile is described** ([`tactical-intel.js`](src/ui/tactical-intel.js), [`app.js`](src/ui/app.js), [`encounter-view.js`](src/ui/encounter-view.js)): the board readout, the arrow-key cursor's announcement, the announcement for a click that cannot walk, the named target list and the ground note in the command dock now name any field object on a tile and its state, for example "Side gate (closed)" or "Abandoned supply cart (available)". Previously a gate tile read "Open ground", and carts, signal stations, barricades and braziers were not mentioned. A closed gate's route summary now reads "No passage until opened". On high ground in the rain, the ground note says each step onto it costs one more movement.
- **Player guide** ([PLAYING.md](docs/PLAYING.md)): a new section on the expanded campaign covers field objects and how to use them, cohesion, suppression and weather, coordinated enemies and protected columns, policy debates, and how older chronicles opt in. The controls table lists the field-object and policy buttons.
- **Rules wording**: the expanded campaign rules said rain adds one movement "for climbing high ground". The rule, and the draft's own test, charges each step onto high ground, including from one high tile to the next, and the text now says so.
- **Continuous integration** ([`verify.yml`](.github/workflows/verify.yml)): `npm run verify` runs for every pull request and every push to main, on Node 20 (the oldest supported version) and Node 22.
- **In-game Help** ([`panels.js`](src/ui/panels.js)): **Controls & rules** still described the two-step move from before 0.31. It now covers walking: a first-turn step, the arrow-key and pointer lines, the U key and the Confirm moves setting. It also gains a short section on the expanded campaign.
- **Checks**:
  - `npm run verify` passes on Node 20: 692 tests, the standard and four expanded legal-command campaigns to Augustus with unchanged turn counts, the build, the asset and offline checks, and the character audit. `npm test` also passes on Node 22.
  - A scripted, software-rendered browser run restored a legal Chapter V expanded checkpoint. The cursor, the readout, the ground note and the Move target list all named the cart and the gate. The Help panel was checked at phone width.
  - Chapter I is 7,727,418 of its 8,000,000 bytes.
  - No real-device or screen-reader checks.

## 0.32.0 — interactive battlefields, enduring policies and character refinement

- New UI chronicles use expanded rules; existing games opt in at camp. Saves validate edition, feature state and policy records; previews remain pure and Retry restores the complete transaction.
- Gates, repairable bridges, dismantlable barricades, pitch fire/smoke, chapter landmarks and mutually exclusive cart/signal opportunities appear in both renderers. Selected chapters use 10 × 8 boards; the 2D fit reserves headroom and retains correct picking.
- Weather, cohesion and suppression modify exact attack previews. Visible enemies share tactical focus and roles; protected columns advance with their commander instead of outrunning the screen.
- Three policy motions offer original and amended terms, rival counterproposals, precise delegate forecasts, staged costs and permanent consequences shown in the camp ledger.
- Sculpted kit gains scabbards, straps, fittings, stitch and role details; High cloth gains sheen. A new Roman atlas supplies four painted directions per costume. Additional procedural poses cover block, assent, dissent and yielding.
- Weapon correction targets the committed recipient; shield anticipation and painted attack contact follow the impact clock. Frame reports separate CPU submission, display cadence and GPU observations; reflection refresh responds to measured cost.
- An asset audit distinguishes authored bitmap sequences from procedural responses and checks bundled model budgets. Verification and limitations are recorded in [release-validation-v031.md](docs/archive/release-validation-v031.md).
- **Merged after click to walk (0.31.0)**: the shared route in [`movement.js`](src/core/movement.js), which draws the walk preview and the walking animation in both views, now uses the rules' own field geometry. Routes go around a closed gate, each step onto high ground in the rain costs one more, and hovering a closed gate reads "Closed gate". Across all 25 encounters of a legal expanded campaign, every one of 3,241 legal moves walks a route that costs exactly what the rules charge. This work was prepared and validated as draft 0.31 and renumbered 0.32.0 when merged, so its records and images keep `v031` in their names; the integration checks are in [release-validation-v031.md](docs/archive/release-validation-v031.md#integration-into-0320).

## 0.31.0 — click to walk: one selection moves the unit, far ground walks as far as the turn allows, and the route shows before you commit

The rules are unchanged: a walk is the ordinary legal move command, checked, saved and taken back by Undo Move as before, with no new random-number use and no save format change. Checked with automated tests and scripted runs of the real interface in software rendering (2D and 3D, desktop and phone width); see [movement verification for 0.31](docs/archive/movement-verification-v031.md) for what was and was not checked.

- **Click to walk** ([`direct-controls.js`](src/ui/direct-controls.js), [`app.js`](src/ui/app.js)): with no other action chosen, selecting open ground walks the selected unit there at once, through `Game.act` like any other command. **Undo Move** (`U`) takes it back until the unit acts. Attacks, speeches, orders and every other command still preview first and need a second selection or Confirm.
- **Far ground**: selecting ground beyond this turn's reach walks as far toward it as the rules allow: to the reachable tile that leaves the shortest way on over the ground you can see (ties go to the straighter line, then the cheaper move, then by row and column). If no tile gets closer, nothing moves and the readout and announcement say why: impassable ground, no nearer ground this turn, no route, or movement already spent.
- **The route before you commit** ([`battle-art.js`](src/ui/battle-art.js), [`ink-overlay.js`](src/showcase/ink-overlay.js)): pointing at ground, or moving the board cursor onto it, draws the route: a solid line with footfalls to where the unit stops this turn, a faint dashed line for the rest of the way, and a faint wash over all the ground the unit can reach, in 2D and 3D. The board readout and the screen-reader announcement say the same in words ("Walk here · 1 movement", "Beyond reach · stops at 1B this turn").
- **One route everywhere** ([`movement.js`](src/core/movement.js)): a new read-only rules module gives the cheapest legal route (marsh by its cost, stopping beside enemy melee units as the rules stop it). It replaces the separate route reconstructions in the 2D preview path and the walking animation, so the drawn route, the 2D preview and the 2D and 3D walk trace the same tiles. `Game.moveRoute(state, unitId, point)` exposes the plan; it never changes state or the random-number generator.
- **Confirm moves** (new Pause setting, off by default): brings back preview-then-confirm for moves, now including far ground, where the preview is the tile the unit would stop on. The board hint and the board's accessible name follow the setting, and in-game text says "select" rather than "click" so it fits touch and keyboard play.
- **Fix**: on the 2D board a click could pick the tile next to the one the readout named when the pointer sat within a pixel of a tile edge, because clicks report whole pixels and pointer moves can be fractional. The 2D click now uses the pressed pointer's exact position.
- **Not done in this release**: walking on toward a remembered goal over several turns; real-device, real-mouse, Safari/Firefox and screen-reader checks; and human playtesting, including whether one-click moves lead to accidental walks.

## 0.30.0 — graphics refinement: Senate blocs beyond colour, a graded Performance tier with baked occlusion, living formations and battle remains, lit painted figures, weightier combat, weather on the light and story paintings in 2.5D

Presentation only: no rule, legal command, random-number use or save format changes. Checked with automated tests, software-rendered screenshots (some of injected, presentation-only scenarios, labelled as such) and one scripted run of the real interface; see [graphics verification for 0.30](docs/archive/graphics-verification-v030.md) for what was and was not checked.

- **Senate blocs beyond colour** ([`bloc-style.js`](src/ui/bloc-style.js)): the 2D board and the 3D chamber now share one palette. Landholders are wheat ochre instead of green, so every pair of delegate blocs stays apart under simulated protanopia, deuteranopia and tritanopia. The 3D stance marker leads with the bloc's letter (V, L, C, Ch), and toga trims differ in shape: a broad band (Veterans), a double band (Landholders), a band broken into three lengths (Civic) or a band with a gilt line (Chamber).
- **Performance quality keeps the chapter's look**: without the finishing pass, each chapter's grade (saturation, contrast, split tone) is applied in the tone-mapping step at no extra cost ([`scene-compositor.js`](src/showcase/scene-compositor.js)). Every scene also bakes, once, how much sky each patch of ground sees past its relief and standing scenery ([`environment-baked-occlusion.js`](src/showcase/environment-baked-occlusion.js)), so ground darkens beside walls, tents and rocks on every tier; the bake is lighter where the screen-space pass also runs. AgX and Neutral tone mapping were compared with ACES at High on four chapters: the chapter grades read flatter under AgX and darker and over-saturated under Neutral, so ACES stays.
- **Formations out of unison** ([`formation.js`](src/showcase/formation.js)): followers play the leader's own pose up to 0.36 s late, from four fixed delay banks, so a swing or a step ripples through the rank. Ranks thin when the blow lands, not when the order is given.
- **Battle remains** (new Pause setting, on by default; [`battle-remains.js`](src/showcase/battle-remains.js)): men who leave a formation and defeated units lie where they fell, horse and rider on their side. Spent arrows and javelins stand in the ground near their marks, and feet, hooves and clashes wear the ground. The field keeps the latest 6, 12 or 20 fallen (by quality tier) and 64 shafts; remains are never picked and stay until the encounter ends.
- **Painted (HD-2D) figures lit by the scene** ([`painted-actor.js`](src/showcase/painted-actor.js)): a bevel from the painting's own edges and brush values, wrap lighting, a self-lit share of the painting and one shadow sample just sunward of each figure. Gentle puppetry adds breath and sway at rest (held still with reduced motion), a lean into attacks and a squash when struck.
- **Weight in combat** ([`combat-effects.js`](src/showcase/combat-effects.js)): blade trails, whole-rank volleys from archers and javelin-men in formation, dust under running men and horses on dry ground, a 70 ms held beat when a blow lands (at most 220 ms per motion) and, with the action camera on, a small jolt of the view. None of it plays with reduced motion.
- **Weather on the light** ([`atmosphere.js`](src/showcase/atmosphere.js), [`water-reflection.js`](src/showcase/water-reflection.js)): faint cloud shadows drift over ground, scenery and figures alike on clear, misty and dusty days. At dawn, in mist and in the Senate's halls a few shafts of sunlight slant through the air, with motes turning in them on Balanced and High. On High, board rivers and marsh pools mirror the figures, standards and banks above them; the sky and open water keep their own reflection. Wet ground in the rain no longer shows white highlight discs.
- **Story paintings in 2.5D** ([`scene-parallax.js`](src/ui/scene-parallax.js)): the camp mural and the promotion scene, and the oath and accession paintings when 3D ceremonies are off, drift slowly with depth, near ground against far hills, with weather drawn between the depth planes: rain, rising embers, dust, mist, or motes in the Curia's light. Eight small depth maps (13,790 bytes in total) were estimated offline from the project's own paintings with the MIT-licensed MiDaS v2.1 small model; provenance is in [`art-generation.md`](docs/art-generation.md) and [`asset-manifest.json`](docs/asset-manifest.json). The still painting stays underneath and remains on Performance, with reduced motion, without WebGL and after any failure.
- **Fix**: Chapter IX's promotion painting (the province) is now in Chapter IX's offline group. The promotion view and the chapter group take it from one `promotionScene()` helper.
- **Not done in this release**: an authored, artist-made prop kit (it needs an artist; the code-built props remain), the WebGPU renderer (still deferred), and any measurement on real hardware. Frame time and the GPU cost of the new passes on phones, real-device, real-GPU, Safari/Firefox and screen-reader checks, and human playtesting of the 90–150 minute target are still to do.

## 0.29.0 — graphics overhaul: readable diorama terrain, painted (HD-2D) and ink-and-wash figures, formations, inked tactical ground, chapter colour script and signature moments

Presentation only: no rule, legal command, random-number use or save format changes except the bug fixes listed below. Everything was checked with automated tests and software-rendered screenshots; see [graphics verification for 0.29](docs/archive/graphics-verification-v029.md) for what was and was not checked.

- **Readable diorama terrain**: high ground is a 1.6 m flat-topped plateau ([`environment-layout.js`](src/showcase/environment-layout.js)) whose bank stays inside its own cell; adjoining high cells join, banks show earth and rock outcrops, and plateaus beside paving, roads or water are faced as squared-stone terraces. Rivers sit in a channel under one water surface with depth in its vertex alpha; fords are gravel bars with stepping stones; wall cells join into faced runs (stone, mudbrick or timber); paving is irregular flagstones; marshes carry reed beds; roads gain kerb stones ([`environment-campaign-terrain.js`](src/showcase/environment-campaign-terrain.js)). The ground grid is denser over the board without moving its 80 m edge, and static batching folds repeated parts into matching instance batches so every scene stays inside its draw-object budget.
- **Painted regional backdrop**: a code-painted panorama ([`environment-backdrop.js`](src/showcase/environment-backdrop.js)) with layered ranges and regional landmarks (temples and aqueducts, Palmyrene colonnades, Alpine snow, forest, farmland) stands beyond the modelled ridges. It adds no download.
- **Water**: rivers are a dielectric with a dim sun sheen, fine moving glitter and a capped reflected highlight; open water foams faintly, replacing the white blotches.
- **Figure styles** (Pause → 3D figure style): *Sculpted* (default), *Painted (HD-2D)*, which stands the 2D campaign's own painted unit art in the 3D scene as camera-facing cards with sun-facing silhouette shadows, pixel-accurate picking, the shared animation timeline and diagonal camera views ([`painted-actor.js`](src/showcase/painted-actor.js)), and *Ink and wash*, which adds near-side depth outlines and soft value banding. Painted figures add a depth-aware tilt-shift. Both finishes need Balanced or High quality.
- **Formations** ([`formation.js`](src/showcase/formation.js)): from Chapter IV every military unit except the commander shows its leader and followers in line, shield wall, wedge, archer screen, warband or three riders, and men leave from the rear and flanks as the unit loses strength. Sculpted formations are crowd-rendered from the leader's own skeleton (one draw per surface); painted formations are instanced cards. Followers are capped by quality (3, 5, 8) and are never pickable.
- **Clearer screen**: rank-and-file units show a role glyph and short strength bar; names stay for the commander, company veterans, speakers and other named people, the selection and the figure under the pointer. The chosen action's reach is painted on the ground as an ink wash with a brushed rim, and an inspected or hovered enemy shows its next-turn threat as red hatching ([`ink-overlay.js`](src/showcase/ink-overlay.js)). Text panels for screen readers are unchanged.
- **Senate blocs and stance**: toga trims now distinguish the real blocs (Veterans crimson, Landholders green, Civic blue, Chamber purple; previously only the legacy Army and People blocs were distinguished) and the stance marker carries the same colour. Idle delegates show stance in posture: assent leans in with an open hand, dissent folds its arms.
- **Colour script**: each chapter has its own grade and light balance from Danube dawns to the purple at the accession; scene fog now starts beyond the board; a camera-relative rim light separates figures from the ground.
- **Signature moments** (visual only; reduced motion respected): the finale stands before Aurelian's half-built walls (begun AD 271) with massed legions on both sides ([`environment-finale.js`](src/showcase/environment-finale.js)); after the rules decide a Senate vote, delegates walk to stand behind the champion of the side the rules counted them on (*discessio*), skippable with a click; a short **Action camera** (Pause setting, on by default) closes in on committed attacks; the oath and the accession are staged in 3D over their paintings ([`ceremony.js`](src/showcase/ceremony.js)), still keyed on the one shared `OATH` entry; and the Imperial Tabula is a painted map that inks the career route chapter by chapter ([`campaign-map.js`](src/ui/campaign-map.js)).
- **Rendering quality**: frame pacing on whole display refreshes (30/60 fps tiers instead of 45), CPU-timed adaptive resolution when the GPU timer is unavailable, 4× multisampling under the post-processing on Balanced and High, aerial haze beyond the board, shadow boxes fitted to the view, one hover raycast per frame, lost-context recovery, and fixes for leaked shadow maps, WebGL contexts, reinforcement beacons and fieldworks. The 2D ground no longer tiles in kaleidoscope mirror patterns.
- **Download budget**: the three music beds are re-encoded (2,226,834 → 1,188,004 bytes, provenance in [`asset-manifest.json`](docs/asset-manifest.json)) and the 3D view no longer decodes 2D-only world art; Chapter I is now about 7.24 MB compressed of its 8.00 MB budget. `scripts/visual-regression.mjs` adds per-machine screenshot baselines (development only; needs Playwright).
- **Bug fixes**: the Chapter XII route is chosen through a new validated `chooseRoute` rules command; an unreadable stored chronicle is set aside and offered for download instead of being overwritten; Undo Move also removes the ability credit the move added; exporting during an Archive replay exports the chronicle, and a sandbox code is refused as a chronicle; hiding a tab saves only unsaved changes, so other tabs no longer report a false conflict.
- **Correction**: fieldworks (*Munitiones*) unlock in Chapter III (Immunis) battles, as implemented and stated in game, not "Chapters IV+" as the 0.24.0 notes said.
- **Not done in this release**: the WebGPU renderer (deliberately deferred); commissioned 4K painted backdrops and an authored Blender/KTX2 Roman asset kit (code-built geometry and code-painted panoramas stand in); painted animation frames do not exist for every unit, so some painted figures use their static column; real-device, real-GPU, Safari/Firefox and screen-reader checks, and human playtesting of the 90–150 minute target.

## 0.28.0 — tactical Undo Move (Regressus), 3D/2D reinforcement arrival beacons (Exploratores), clickable chamber vote seats (Tabula Curiae) and Quartermaster solvency & succession forecast (Ratio Imperii)

- **Regressus (Tactical Undo Move)**: adds [`canUndoMove`](src/core/game.js) and [`undoMove`](src/core/game.js) across battles ([`battle.js`](src/core/battle.js)) and political Contests ([`contest.js`](src/core/contest.js)), recording `unit.moveOrigin` on move and clearing it once any attack, speech, order, fieldwork, precedent, agreement, or turn end is committed. Adds the `#undo-move` button (`data-cmd="undo-move"`) in [`encounter-view.js`](src/ui/encounter-view.js) and the `U` keyboard shortcut in [`app.js`](src/ui/app.js).
- **Exploratores (3D & 2D Reinforcement Arrival Beacons)**: adds [`reinforcementBeacons`](src/core/battle.js) to surface pending reinforcement waves (`turn > e.turn`) with open arrival coordinates, turn countdowns, and unit role summaries. Renders 3D warning rings and spires via `updateReinforcementBeacons` in [`stage.js`](src/showcase/stage.js), 2D warning diamonds and `T#` badges in [`battle-art.js`](src/ui/battle-art.js), and a `.reinforcement-schedule` readout in [`encounter-view.js`](src/ui/encounter-view.js).
- **Tabula Curiae (Interactive Chamber Vote Seats & Whip Links)**: upgrades voter chips (`.vote-seat`) and Whip Forecast badges (`.whip-link`) in [`coalitionPanel`](src/ui/tactical-intel.js) into interactive buttons (`data-cmd="inspect-delegate"`), focusing the clicked delegate on the 3D/2D chamber floor and opening their inspection dossier.
- **Ratio Imperii (Quartermaster Solvency & Finale Route Tracker)**: adds [`quartermasterForecast`](src/core/game.js), [`quartermasterPanel`](src/ui/campaign-views.js) (`#camp-quartermaster`), and `#quartermaster-forecast` in [`panels.js`](src/ui/panels.js) to audit Supplies against due and upcoming political agreements, warn of solvency shortfalls, and track Chapter VIII–XII meter requirements for all three Chapter XII succession routes.

## 0.27.0 — tactical formation counter-play (Cuneus & Testudo), live chamber whip forecast, 3D/2D morale spectacle, camp War Council, after-action chronicle and customizable Reign Cards

- **Cuneus & Testudo**: adds [`enemyFormationLinks`](src/core/battle.js) to render enemy cohesion tethers in 3D ([`stage-readout.js`](src/showcase/stage-readout.js)) and 2D ([`battle-art.js`](src/ui/battle-art.js)), and enriches [`combatBreakdown`](src/core/battle.js) and [`combatModifiers`](src/showcase/stage-readout.js) with explicit `formationBreak` / `formationBreakLabel` chips (`Wedge splits shield wall`, `Flank breaks shield line`).
- **Calculus Curiae**: adds [`coalitionWhipForecast`](src/core/contest.js) and updates [`coalitionPanel`](src/ui/tactical-intel.js) to highlight current supporters **At Risk** from rival speakers' next-turn lobby intentions (`.vote-seat.at-risk`) and list **1-speech flips** in reach.
- **Signa & Terror**: adds expanding golden shockwave rings (`radius: 2.6`) for `Rally` and `Inspire` in 3D ([`stage.js`](src/showcase/stage.js)) and 2D ([`battle-effects.js`](src/ui/battle-effects.js)), plus shaken (`<= 40`), broken (`<= 20`), and pledged-cohort base rings (`updateMoraleRings`, `baseMarker`).
- **Consilium Castrorum**: adds [`warCouncilAdvisories`](src/ui/campaign-upgrade-views.js) and [`warCouncilPanel`](src/ui/campaign-upgrade-views.js) in camp so present companions (`Varro`, `Lucan`/`Sabinus`, `Crispus`, `Aelia`, `Paullus`) provide character-voiced counsel on the chapter's decision and upcoming encounter.
- **Acta Diurna**: adds [`encounterDebrief`](src/ui/tactical-intel.js) to [`resultRecord`](src/ui/tactical-intel.js), surfacing Distinguished Service citations, key Turning Points from the encounter log, and concrete Defeat Diagnostics & retry guidance when an encounter is lost.
- **Monumentum Aeternum**: adds selectable Reign Card **Monument Themes** (`REIGN_CARD_THEMES`: *Imperial Purple*, *Senatorial Marble*, *Legionary Bronze*) and automatic **Service Laurels** (`reignLaurels`) in [`renderer.js`](src/ui/renderer.js) and [`panels.js`](src/ui/panels.js).

## 0.26.0 — player-control overhaul, unavailable-action diagnostics, formation roster preview and chamber/allocation clarity

- Adds [`actionCostLabel`](src/ui/direct-controls.js), [`explainActionTargetGap`](src/ui/direct-controls.js), [`explainUnavailableActions`](src/ui/direct-controls.js), and [`unusedTurnSummary`](src/ui/direct-controls.js) so every action button states its exact cost (`1 move`, `1 action`, `1 order`, `1 speech`, `1 javelin`, cooldown, promise limit), empty-target states explain why no target is in reach, `#command-named-controls` and `#command-coaching` (`What can I do?`) explain why unavailable capabilities cannot be used right now, and `#end-turn` summarizes any remaining moves, actions, speeches, or command orders.
- Adds [`formationRosterPreview`](src/ui/direct-controls.js) to `Formation` order previews in Chapters V+, explicitly naming up to 3 adjacent allies who will join (`Joining shield-wall (N/3): …`) and any nearby allies excluded (`already ordered this turn`, `more than 1 tile from anchor unit`, or `3-unit formation cap reached`).
- Clarifies political Contest rules in [`coalitionPanel`](src/ui/tactical-intel.js) and [`encounterView`](src/ui/encounter-view.js): defines **Resolve** (*"speaking stamina; 0 withdraws from speaking, vote remains"*), states that votes are counted at the deadline (`end of turn X`; an early majority does not end the debate), displays [`delegateAppealSummary`](src/ui/direct-controls.js) (`Strongest appeals: …`) for each delegate's interest and bloc, and adds `Inspect` (`data-cmd="inspect-delegate"`) buttons to the chamber delegate roster.
- Adds [`allocationDraftPreview`](src/ui/campaign-views.js) and four preset buttons (`Balanced 2·2·2`, `River focus 4·1·1`, `Farms focus 1·4·1`, `Town focus 1·1·4`) to Chapter X camp preparation, showing live `N / 6` validation and exact Supplies, Army/Public/Political meter, road morale, store integrity, and Landholder tribunal stance effects before dispatching.
- Updates keyboard arrow-key navigation on `#battle-board` to visibly update `#board-hover` alongside screen-reader announcements, and binds 3D camera shortcuts (`F`, `Home`, `+`, `-`, `H`) in campaign encounters. See [controls overhaul verification](docs/archive/controls-overhaul-verification.md).

## 0.25.0 — Lux Imperii HDR post-processing, dynamic 3D water, subsurface foliage, physical armor shaders, volumetric fire and 2D Tabula Picta

- **Lux Imperii**: upgrades the 3D post-processing shader in [`scene-compositor.js`](src/showcase/scene-compositor.js) with single-pass HDR specular bloom, Contrast-Adaptive Micro-Sharpening (CAS), depth-aware atmospheric aerial perspective, and a subtle warm Roman fresco edge vignette.
- **Flumen & Vadum**: adds custom animated GLSL vertex/fragment water shaders in [`environment-surface-shaders.js`](src/showcase/environment-surface-shaders.js) with dual-rippling normal waves, Fresnel sky reflection, shallow-ford shoreline foam, and concentric rain ripples.
- **Ventus & Marmor**: adds wind-swaying foliage vertex displacement with warm backlit subsurface scattering, wet micro-puddle specular ground reflections during rain/marsh scenes, and procedural Cipollino/Carrara veined marble with polished floor reflections in Senate and council chambers.
- **Lorica & Paludamentum**: enriches [`actor-surface.js`](src/showcase/actor-surface.js) with anisotropic brushed iron/bronze metallic sheen (`sheen`, `clearcoat`) on Roman armor and helmets, velvet-like rim sheen on tunics and imperial purple cloaks, and harmonic vertex wave flutter on cloth banners and vexilla.
- **Ignis & Ferrum**: adds 3D volumetric rising ember/flame plumes on braziers and torches, multi-segment projectile ribbon trails on javelins and arrows, and persistent ground scorch/scuff decals in [`stage-particles.js`](src/showcase/stage-particles.js).
- **Tabula Picta**: upgrades the 2D tactical canvas ([`renderer.js`](src/ui/renderer.js), [`battle-art.js`](src/ui/battle-art.js), [`world-art.js`](src/ui/world-art.js)) with isometric 2D fieldwork sprites (`stakes`, `rampart`, `brazier`), diagonal crimson hatching on inspected enemy threat envelopes, time-of-day color grading overlays, and 2D weather particles.

## 0.24.0 — legionary fieldworks (Munitiones), war-room mutators, 3D Aquila & Cornu brass, Oculus Tactica threat envelopes, Rostra interjections and Cursus Honorum monument

- Adds **Tactical Field Engineering (`Munitiones`)** in Chapters IV+ (`stakes`, `rampart`, `brazier`), allowing the commander's engineering detachment to erect one fortification per battle that modifies `combatBreakdown` (negating cavalry charges, adding +2 wall defence, or +1 ranged fire damage) and renders in 3D and 2D.
- Adds **Archive War-Room Mutators** (`difficulty`, `weather`, `timeOfDay`, and Chapter XII `route`) to sandbox Archive replays without altering the primary campaign save.
- Adds **3D Legionary Aquila & Signum standards** with golden eagles, phalerae medallions, and crimson vexillum cloth on commanders and formation leaders, paired with synthesized **Roman Cornu & Buccina brass horn cues** (`rally`, `formation`, `fieldwork`).
- Adds **Oculus Tactica** (`combatBreakdown` modifier chips and `threatEnvelope` reach/target readouts) in the command inspector and 3D stage.
- Adds **Named Senate Delegate Interjections** (`delegateCallout`) and a **3D Marble Rostra Speaker's Dais & Curia Bench Tiers** in political Contests, plus an interactive **Cursus Honorum Monument** (`cursusHonorum`) in the character dossier.

## 0.23.0 — Archive of the Reign sandbox, dynamic 3D weather & night-march torchlight, veteran commendation ranks, interactive Tabula and Senate precedent motions

- Adds **Archive of the Reign** (`archiveEncounters`, `createArchiveReplay`) in the Mission Journal and Accession Epilogue so any completed battle or political Contest can be replayed in an isolated sandbox session.
- Adds **Dynamic 3D Weather & Night-March Torchlight** (`weather`, `timeOfDay`, `buildWeatherParticleSpecs`, `pointLights`) across all 25 encounters (rain, mist, desert dust, siege embers, and flickering night-march/dusk torchlight).
- Adds **Veteran Commendation Ranks & Evocatus Mastery** (`veteranRank`: *Gregarius → Immunis → Principalis → Evocatus*), granting passive mastery bonuses at 2+ and 4+ commendations, 3D crest/torc insignia, and contextual companion callouts (`companionCallout`).
- Adds an **Interactive Imperial Command Tabula** (clickable SVG theatre nodes and expandable theatre dossiers in the Campaign Map) and a **Turn-Step Scrubber** (`#turn-scrubber`) for reviewing recent turn events on the board.
- Adds **Senate Career Precedent Motions** (`precedentOptions`, `invokePrecedent`) in Chapters VII–XII Contests, allowing players to invoke earned military, provincial, or fiscal milestones once per Contest.

## 0.22.0 — 3D ground paths, multi-unit forecasts, opponent intent arcs, custom Order destinations and Imperial epilogue record

- Adds 3D ground movement path polylines (`stagePreviewPath`), action-intent target ring color coding (`targetRingColor`), a directional facing chevron on `selectedRing`, and 3D formation cohesion links (`kind: 'cohesion'`) between adjacent friendly units sharing an active formation.
- Adds multi-unit 3D floating forecast badges (`previewBadges`) across all units affected by `Formation`, `Rally` (including defection morale thresholds), `Address`, and `Threaten` (including `-1 stance` bloc backlash).
- Projects a crimson 3D opponent intent arc (`kind: 'intent'`) from an inspected enemy soldier or rival speaker toward their authoritative `unit.intent` target or objective.
- Exposes engine-supported custom `Order` advance coordinates (`allyDestinations`, `#order-destination`) in `encounterView` so players can direct ordered allies onto specific flanking or high-ground tiles.
- Adds a `Speed 1×` / `Speed 2×` 3D playback toggle (`data-cmd="camera-speed"`) and click/`Space` fast-forward acceleration during active 3D animations.
- Updates the shareable Reign Card header in `drawReignCard` to `I M P E R I U M` and adds an **Imperial Archive · Service Summary & Company Roll** section to the Chapter XII accession epilogue.

## 0.21.0 — 3D pre-action forecast badges, specialist foley and camp progression clarity

- Adds floating 3D pre-action forecast badges (`previewBadge`) directly on the targeted unit's 3D world label during order previews across both the main campaign and standalone 3D showcase (`−4 HP · Flank`, `Ward −2 dmg`, `+20 morale · +1 HP`, `+3 stance (-1 → 2)`, `Support 3 → 5`, `-4 Resolve`, `Blunt speech`).
- Adds distinct synthesized foley plans (`guard`, `inspire`, `agreement`) to `battleSoundPlan` and `combatCues`, plus subtle 3D shimmer on active Protector `Guard` ward and `aim` arcs when reduced motion is off.
- Auto-opens `veteranAcademy` in camp when any veteran is eligible for permanent specialization (surfacing the ready count in the summary) and auto-opens the compact camp `relationshipLedger` when an open agreement is `dueNow`.
- Adds `order` and `conversation` motions and a `Head gaze` (`#gaze`) slider to the standalone character inspector (`tests/actor-model-browser.html`).

## 0.20.0 — expressive gaze, 3D tactical wards and Chapter I budget headroom

- Adds weighted eyebrow bones (`left-brow`, `right-brow`) and deterministic `actorExpression` posture across speech, rally, combat drive, bracing, and injury states, plus multi-syllable jaw articulation and bounded head gaze targeting (`gazeYaw`, `gazePitch`) toward inspected or addressed figures.
- Adds 3D on-stage Protector `Guard` ward tethers, Ranged `Volley` / javelin preview arcs, operation phase objective prefixes (`Phase 1` / `Phase 2`), and automatic overview camera re-centering when a multi-phase operation advances.
- Normalizes line endings in `dist/` and strips non-license JSDoc blocks from bundled `dist/vendor/three/` modules during build, reclaiming ~159 KB of Chapter I compressed budget headroom (`7.84 MB` / `8.00 MB`) across Windows and Linux while preserving all source files and provenance checks.

## 0.19.0 — more natural faces

- Fits almond eye openings to imported anatomy and clips irises without folded triangles. Upper eyelids blend between the moving lid and fixed head; eye corners remain anchored during blinks.
- Replaces raised eyebrow tubes with tapered hairs, preserves skin highlight contrast, and adds restrained mature cheek and facial-fold shaping.
- Feathers beard and scalp boundaries, adds fuller moustache coverage, and retains finer strands in the imported short-hair cutout.
- Adds seven regression checks and a closed-eyelid control to the development inspector. The full 569-test regression and 13 asset/worker checks pass; legal autoplay completes 25 encounters in 217 turns. See [final validation](docs/archive/release-validation-v019.md).

## 0.18.0 — fitted characters and wearable equipment

- Fits complexion textures to the original UVs of imported male and separate female anatomy. Shapes exposed neck rims to sit within collars and fits helmet openings around the imported head.
- Adds one locally bundled CC0 short-hair model and cutout texture for eligible male figures, with per-identity fitting and tint. Bound female hair remains original fitted geometry; the new asset is shared rather than a collection of individual haircuts.
- Gives cloth, leather, mail, scale and metal distinct normal and roughness response. Preserves the eyes' physical-material settings through batching so their highlights remain controlled.
- Replaces separate sleeve caps with a connected, weighted tunic or armor shell, including shaped folds and turned collar/cuff edges. Rebuilds hands with shaped palms, tapered fingers, opposing thumbs and subtle nails, and boots with fitted insteps, toe boxes, sewn panels and separate soles.
- Adds small overview hand/boot meshes that retain the same silhouette, weapon-grip space and foot-contact plane. Temporary geometry, shared textures and skeletons have explicit ownership and disposal; construction does not consume gameplay randomness.
- Leaves gameplay rules, campaign content, saves and committed action timing unchanged. The [v0.18 release record](docs/archive/release-validation-v018.md) records 562 full-regression tests, 78 final actor checks, 6 final surface checks, 25 browser scenes / 518 assertions, 63 targeted browser assertions and 13 asset checks. Production revision `a0dbf383f33b` passes the download budgets. A server-stopped Chapter VI reload and normal Continue action preserved the exact portable save code after the full offline download. Physical-device and independent human testing remain unperformed; geometry counts do not establish performance.

## Historical 0.17.0 — veteran paths, recurring negotiators and fitted anatomy

- New chronicles offer 22 authored operation alternatives across eleven encounters. Branches change objectives, routes or protected parties; a clean victory earns the stated resources and a one-use later-field benefit. Versioned progression preserves older chronicles and complete retry checkpoints.
- Veterans with two deployments can choose a permanent Protector, Formation leader or Ranged specialist path from Chapter III. Guard, Inspire and limited Volley actions carry explicit command, turn and attribute tradeoffs.
- Nine named representatives recur across six political Contests. Demands and counterproposals exchange immediate stance for a later supply payment; honored or broken agreements alter trust and later starting stance. Agreements stage until encounter commit and remain separate from existing Promise obligations.
- Adds an optional opening field guide based on legal commands and authoritative previews, with camp and chamber panels exposing training, branch rewards, negotiated terms and payment eligibility.
- Fits locally bundled MakeHuman CC0 male head, neck and exposed-arm anatomy to the existing skinned identity rig, with the original procedural fallback. Female figures, clothing, armor, hands, legs, equipment and horses remain original project models. Weapon-specific authored joint clips coordinate sword, spear, mounted, throw and reaction poses; no motion capture is introduced.
- Adds inhabited frontier/wetland/eastern settlements and civic architecture, plus private-material scenery cutaways for Follow, Horizon and action framing. Unit and objective labels avoid the selected body's projected rectangle. Authoritative terrain and movement remain unchanged.
- Defers the imported model with shared chapter 3D assets, compresses active terrain materials without repainting, and adds optional bounded drawing-buffer adaptation from asynchronous GPU elapsed queries. Interface text remains at normal resolution. Existing audio recordings are unchanged.
- The [v0.17 validation record](docs/archive/release-validation-v017.md) records 510 passing Node tests, 25 browser scenes / 518 assertions, 63 targeted assertions, 21 dedicated GPU checks, 13 asset/offline checks, 11 isolated browser progression checks, two legal 25-win routes and exact previous-version command/retry compatibility. Production revision `9faf31555b45` meets the declared download budgets. Normal progression controls and server-stopped Chapter I continuation preserved their stated transactions/save; physical-device and independent human testing remain unperformed.

## 0.16.0 — foliage, character form and depth lighting

- Replaces sparse leaf polygons with original alpha-tested foliage sprays, fuller branching trees, curved palms and blended soil verges. Structural camera obstacles remain solid while Follow can ignore leaf-card bounds.
- Rebuilds facial contours, connected shoulder/limb profiles and fitted armor; welds sculpted seam normals and opens helmet/coif guards around the face. Existing skeleton, equipment, foot contacts, legal positions and animation remain authoritative.
- Adds a bounded linear HDR color/depth target and fullscreen contact-shading/edge-smoothing pass for Balanced/High. Reduces broad fill lighting. Handles failed shader linking with a visible direct-render fallback, restores renderer state and releases target resources. Performance remains direct.
- Adds an original foliage atlas and a mechanically optimized character atlas with provenance. Retains the previous atlas in historical assets/full download but excludes it from active chapter downloads; the existing 2/8/24 MB compressed delivery gates remain unchanged.
- See [v0.16 validation](docs/archive/release-validation-v016.md) for automated, GPU, campaign browser, offline/save and measured desktop evidence. No gameplay core files change in this release.

## 0.14.1 — Imperium

- Renames the game and current project documentation to **Imperium**, with the repository at `obeidpeter/Imperium`.
- Preserves existing save identifiers and portable formats. Earlier verification records, exact artwork prompts and supplied source filenames retain their original names; the Roman military oath remains *sacramentum*.

## 0.14.0 — character and material quality

- Adds weighted skeletal surfaces across original character, clothing and horse joints, with bounded cloth deformation, deterministic seeking and preserved equipment/foot contacts. These are repository-authored procedural figures and poses, not imported character assets or motion capture.
- Matches walking and mounted strides to distance travelled, retimes a cloned 3D presentation sequence with 550–2,400 ms movement and a 1.65 action-time scale, and preserves release/contact/cue dependencies. Anticipation, recovery, directional shield blocks/reactions and surface-aware foot/hoof/wade sound improve action readability without changing the committed rules result.
- Prevents withdrawn figures or reused troop names from receiving another unit's animation, prefers the current living tile occupant for effects, and limits skinned picking to actually visible surfaces.
- Generates sky-aligned HDR reflection lighting locally once per scene or quality change. Pooled soft ground/sole contacts and deterministic pose-anchored impact particles complement existing directional shadows and action effects; no new texture download or external service is introduced.
- Refines shared scenery with smooth boulder normals, compound palms, tapered branches, low verge plants, fluted columns, jointed arches and material weathering. Balanced/High masonry gains beveled edges while Performance retains simpler blocks. Authoritative terrain, camera clearance and horizon/river joins remain the presentation boundaries.
- The [version 0.14 verification record](docs/archive/character-quality-verification.md) documents 401 passing tests, legal 25-encounter completion, eleven asset/offline protocol checks and 25 browser scenes / 518 assertions in two batches. Ordinary production play completed the drill and retained exact save equality through camera/view changes and reload. It records actual timing, the vendor precision warning and unperformed device, human and fresh browser-offline checks.

## 0.13.0 — sky and horizon

- Adds an original procedural sky and regional distant landscape around the existing playable terrain, with an explicit **Horizon / H** camera view in the campaign and standalone skirmish. **Overview / Home** restores tactical framing; startup retains Overview.
- Camera controls preserve the legal encounter, turn, commands and saved state. The 2D alternative remains available. This release adds no bitmap sky download, external art service or gameplay rule change.
- A dedicated browser-harness diagnostic records sky/landscape metadata, camera settings, skyward projection and exact save equality without changing the existing all-scene checks. The [version 0.13 verification record](docs/archive/sky-horizon-verification.md) distinguishes 375 passing tests, the earlier all-scene sweep, final targeted visual checks and normal-interface save equality. Narrow browser and landscape scene-container observations remain separate from physical-device claims.

## 0.12.0 — presentation refinement

- Overview framing uses the playable ground and actual figures. Follow chooses a clear view around structural scenery, while selected units and action recipients remain the focus. Label placement combines unit badges and objective markers, prioritizes selected/inspected figures and hides lower-priority badges when no clear space remains.
- Original procedural rigs add terrain-aware planted feet and horse hooves, bounded pose transitions, equipment-aligned projectile release and mounted weapon aim. Near/overview detail levels preserve role silhouettes and picking while reducing distant geometry. These remain scripted original models, not imported character assets or motion capture.
- Static scenery is batched without changing authored terrain, transparent surfaces or moving cloth. Cached shadow updates, label measurements and instanced target markers reduce repeated rendering work; actual measured costs belong in the verification record rather than a guaranteed speed claim.
- Extends the legal-checkpoint browser review harness with specific-figure inspection, camera overview/follow controls, exact action occurrences and autonomous-turn samples that actually move the inspected figure. Enemy inspection never grants control or modifies campaign saves.
- Records settled visible-label bounds/overlap, camera settings, actual draw workload and separate 120-frame CPU, stage-interval and RAF measurements. Comparisons require equivalent scenes/cameras and recorded conditions; no speed or device-quality claim follows from adding measurement tools.
- The [version 0.12 verification report](docs/archive/campaign-3d-refinement-verification.md) records 360 passing tests, the strict 25-scene browser sweep, three complete normal-interface encounter routes, a server-stopped Senate victory/reload and measured rendering costs with explicit limits. The version 0.11 report remains historical evidence.

## 0.11.0 — all-chapter 3D presentation

- Extends the shared scene to all nineteen battles and six political Contests, retaining the same campaign state, legal commands, saved encounters and optional 2D view. Chapter-specific scenery and original procedural military/civilian figures cover marshes, fortifications, eastern campaigns, crossings, the province and chambers.
- Political labels distinguish delegate stance/commitment from speaker Resolve. Compact labels reveal names on hover/selection, and withdrawn speakers retain their votes. Argument gestures, objectives, escort markers and role/faction changes follow the actual encounter state.
- Every chapter cache group includes shared renderer, material and Three.js dependencies, supporting a cold restored later chapter without visiting Chapter I. Shared URLs are reused; initial shell and standalone study page/style boundaries remain separate.
- A legal-command fixture generator covers every encounter start and its real action sequence. A development browser harness exposes explicit scene, action, lifecycle and timing checks. The [current verification record](docs/archive/campaign-3d-verification.md) reports only checks performed, with no inferred device/performance or human-playtest claim.

## 0.10.0 — Chapter I integrated 3D presentation

- Chapter I training and the frontier battle use the shared 3D scene within the normal campaign. Commands, saved progress, checkpoints and retries remain authoritative; view switching preserves the same encounter. Later chapters retain their 2D presentation, and unavailable WebGL falls back to the tactical view.
- Orbit, zoom, overview and follow-unit camera controls coexist with the campaign's keyboard tile cursor, named selectors, preview/confirm commands and optional grid. Quality and reduced-motion settings affect presentation only.
- Original procedural figures gain shaped anatomy/clothing, role-specific training and field equipment, material microtextures and articulated action poses. The training yard, terrain and frontier scenery remain locally constructed meshes and materials. No third-party character model, motion-capture clip or new bitmap artwork is introduced.
- Optional effects remain off by default. Local Web Audio synthesis adds event-timed footsteps, shield/weapon contact, throws, cloth and impacts with adjustable volume, bounded voices and hidden-page stopping. No external recording or audio dependency is used.
- Shared 3D modules, local Three.js and material textures now join Chapter I's offline group while remaining excluded from the initial shell. The standalone study page/style remain part of the explicit complete download. Verification and remaining browser/device work are recorded in [3D presentation verification](docs/archive/showcase-verification.md).

## 0.9.0 — optional 3D frontier study

- A separate playable frontier battle uses a WebGL scene, articulated three-dimensional soldiers, local surface textures, orbit/zoom camera controls and a compact command deck. Named selectors and previews retain the existing legal action flow.
- The title's **Enter the 3D frontier** link opens the study. It does not import or write the campaign save, grant progression or replace the twelve-chapter campaign. Restart repeats only this battle.
- Three.js 0.186.1 and its MIT license are bundled locally. The static build includes the study, vendor modules and textures while excluding them from the initial shell and chapter prefetches. Explicit complete offline download includes their dependencies.
- Known optional-page navigation now resolves its own document before falling back to the cached campaign shell. Quality/reduced-motion controls and camera focus/home buttons are available within the study. Release measurements and performed device/browser checks belong in the accompanying verification record.

## 0.8.0 — production presentation and direct command stage

- A larger battlefield/chamber stage and compact command strip expose the selected figure, legal actions, exact preview and turn status. Direct figure/ground selection previews an intention; a second activation or Confirm commits through the existing rules API. Keyboard and named selector paths remain available.
- Continuous ground materials, broad lighting, textured natural scenery, camp defenses and chamber floors replace the persistent checkerboard and flat environmental primitives. The Grid toggle and individual target/focus outlines preserve tactical clarity without changing legal terrain.
- Five local sheets add 156 generated animation frames. Verified costume/action/facing combinations use authored sequences; uncovered roles and directions retain the original facing art and procedural poses. Visible atmosphere is continuous at capped quality-dependent rates and disabled by Performance/reduced-motion settings.
- Early companion readiness and political target inspection reflect actual command availability. Tactical disclosures retain their open state across commands. Narrow and landscape layouts keep the order flow usable.
- The presentation budgets retain a 2 MB compressed initial cap and raise the limits to 8 MB for shell plus chapter I and 24 MB for the explicit full-campaign download. Decoded artwork retention is capped at 40 entries / 64 MiB estimated RGBA bytes; future-chapter warming does not decode additional images.
- The [production verification report](docs/archive/production-verification.md) records automated tests, legal campaign completion, actual browser flows, motion measurements, provenance and remaining device/human tests. These are 2D presentation improvements, not a complete animation library or full 3D engine.

## 0.7.0 — tactical and political overhaul

- Revised Standard combat uses role- and objective-aware planning, symmetric morale, engagement that stops movement on entering a visible melee threat, and a controlled Withdraw order. Formation cohesion, facing, ranged height and cavalry approaches affect exact damage previews.
- Political blocs have distinct argument preferences; nearby speakers improve Persuade. Public rival plans react to the visible position, and authoritative previews enumerate affected votes, Resolve and costs. Grain and office promises cost three supplies to honour; other promises cost two. Commitment resistance, deadline-only voting, the fixed electorate and two-recipient limit remain.
- Mission briefs, field intentions, coalition status and chapter responsibility guidance expose the existing campaign’s decisions. Outcome summaries identify withdrawals and new debts; optional sound effects have a volume control.
- Regional ground and chamber materials, natural scenery, formation/guard/morale markers and recipient-linked gestures improve visual distinction. Existing painted facings remain procedurally animated; presentation does not alter gameplay outcomes.
- Encounter rule markers preserve old active saves and their exact retries. Newly started battles and Contests adopt version-two rules; earned progression, authored choices, company recovery and the governor → senator → emperor sequence remain.
- Design audits and a twelve-chapter review document the changes. Automated, browser, physical-device and human-play evidence remain separate; release measurements belong in the final verification report.

## 0.6.0 — graphics refinement

- Procedural articulation moves the existing painted unit artwork through footfalls, melee attacks, throws, guards, hits, mounted actions and political gestures. Movement phase follows the visual route; keyposes include preparation, contact and recovery.
- Directional contact shadows, projectile arcs and differentiated shield/impact effects improve grounding and action feedback. Four authored facings remain; this is not a 3D character system or a new frame-by-frame bitmap animation library.
- Connected shorelines, road wear and material transitions follow authored terrain. Regional groundcover and exterior camp, crossing, provincial and chamber props add context without changing passability or obscuring legal target overlays.
- Ground detail is cached. Quality modes limit scenery and effects; presentation remains deterministic, cancellable and reduced-motion-aware.
- Development-only legal-action filmstrips, pose/facing diagnostics and comparable browser measurements extend graphics review. Their scope and limitations are recorded in the [graphics refinement verification report](docs/archive/graphics-refinement-verification.md).
- Gameplay, campaign content, earned progression and local save behavior are preserved. No runtime dependency or additional bitmap artwork was introduced for this refinement.

## 0.5.0 — historical website and interface release

- A cinematic title page with immediate Play/Continue actions, campaign/world sections, an early choice example and actual gameplay previews.
- Shared ivory, charcoal and Pompeian-red presentation across navigation, camp, campaign progression, character equipment, journal, obligations, settings, recovery and reference panels.
- Responsive tactical controls, touch-sized actions, readable dialog surfaces and keyboard focus management retain the existing gameplay and save commands.
- Development helpers record actual loading requests and interface milestones. The [interface verification report](docs/archive/interface-verification.md) and [design system](docs/interface-design-system.md) describe this historical release.

## 0.4.0 — historical graphics release

- Locally bundled directional unit and prop atlases, layered regional battlefields and political chambers, faction equipment and clearer depth ordering.
- Bounded action motion and scene atmosphere, presentation quality controls and reduced-motion handling.
- Chapter-specific portraits, recurring-cast expressions, staged campaign scenes and rank-specific ceremonies retain the complete campaign.
- Chapter-aware artwork loading, explicit full-campaign offline caching and documented asset provenance. The [graphics verification report](docs/archive/graphics-verification.md) records the checks and limits of this historical release.

## 0.3.0 — 2026-10-11

Gameplay, narrative, phone usability and save reliability improvements.

- Authored mission layouts and objectives, rescue/escort responsibilities, pressure waves and distinct finale confrontations replace repeated battlefield setups and arbitrary minimum turns.
- Correct facing/flanking and bounded formation effects. Delegate interests make political appeals situational; repeated military-record appeals to the same delegate are limited.
- State-aware arrival, choice, briefing and outcome scenes with saved reading position; the first oath follows training. Company service, commendations and bounded wound recovery persist; provincial decisions affect playable challenges.
- A compact phone board/action/target/confirmation loop, nearby vote totals, clearer target and mission markers, and skippable turn summaries with contextual optional sound.
- Three distinct recovery checkpoints, explicit preview/restore and tab takeover; IndexedDB compares and writes atomically even without Web Locks. Old suspended encounters retain their original rules and exact retry layout.
- Separate screen modules and directly imported controller tests. The current verification report distinguishes automated checks, browser checks, and physical-device/human tests still pending.

## 0.2.0 — 2026-10-11

Complete aesthetic upgrade of the existing campaign.

- Shared typography, materials, controls and responsive layouts throughout the title, camp, map, battles, political Contests, character, journal, ledger, settings, promotions and finale.
- Twenty-one original, locally bundled WebP illustrations: seven protagonist stages, seven character portraits, a title composition and six regional scenes. Asset provenance and generation instructions are documented.
- Clearer Canvas terrain, figures, faction markings and political chambers; bounded, reduced-motion-aware feedback that does not mutate game state.
- Deferred artwork caching, truthful offline progress, retry after interruption and revision-isolated service-worker updates. Both existing compressed size gates remain unchanged.
- Inline error feedback, predictable mobile control order, coalesced render bindings and protection against asynchronous reign-card races.
- Fifty tests pass; the legal route still completes twelve chapters and twenty-five encounters in 231 player turns. Core rules, campaign data and storage modules are byte-identical to 0.1.0. Detailed measurements and test limits appear in `docs/archive/aesthetic-verification.md`.

## 0.1.0 — 2026-10-11

Initial complete campaign implementation.

- Twelve chapters and twenty-five playable battle and Contest encounters, from recruit training to the imperial accession.
- Original Danube-to-Rome narrative, recurring cast, signalled character fates and replacement branches, consequential choices, historical source notes, and an epilogue that recalls the early campaign.
- Shared browser/Node tactical rules with legal actions and previews, autonomous allies, earned command capacity, formations, morale, and preparations.
- Grid-based political Contests with deadline voting, stance, Resolve, seven speech abilities, and recorded promises.
- Milestone-derived Senate and finale locks, provincial allocation and judgment, three campaign meters, a finale forecast, and playable confrontation routes with costly recovery backing.
- Code-drawn isometric mosaic battlefields, evolving portraits and insignia, fresco camp panels, responsive controls, keyboard targets, optional generated sound, and reduced-motion settings.
- Encounter snapshots, validated autosaves, mirrored browser storage, portable save codes, and an end-of-campaign reign card.
- Dependency-free native JavaScript modules, a static build and preview server, generated offline cache, web-app manifest and icons, and one configurable public site address.
- A Node rules test suite and legal-command campaign autoplay harness, kept separate from development-only scenario injection.

The target playtime and subjective quality require human playtesting. Live custom-domain publication, real iOS/Android installation, device share sheets, and long-term offline/save retention require owner-side deployment and physical-device checks. Verification results are reported separately from these implementation notes.

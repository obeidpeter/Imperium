# Real-time conversion survey (0.38.1 → 0.40)

This is the Phase 0 survey required by §2.1 of the real-time build brief. It maps every current module to one of four fates.

- **keep**: unchanged, or changed only by small additions.
- **adapt**: kept, with real-time inputs, units or presentation.
- **replace**: a new real-time module takes over its job. The old one still serves `controlsModel: 'turns'` until Gate 4.
- **delete-after-Gate-4**: used only by the turn-based path or old saves, and removed once Gate 4 passes.

Nothing is deleted before Gate 4: the 0.38 path stays playable behind the `controlsModel` flag (see [the flag](#the-controlsmodel-flag)).

The player-facing specification is [player-guide-0.40.md](player-guide-0.40.md), converted from `Imperium-Player-Guide-0.40.docx` with pandoc as the brief directs. Phase 0 work and results are in [realtime-phase-0-report.md](realtime-phase-0-report.md).

## The stack, exactly

| Concern | What the project uses |
| --- | --- |
| Language | Plain JavaScript ES modules (no TypeScript, no transpiler). Node.js ≥ 20 (CI: Node 20 and 22). |
| Framework | **None.** Views return HTML strings, which `src/ui/page-update.js` morphs into the live DOM in place. Event handlers are plain DOM listeners. |
| Renderer library | **Three.js 0.186.1**, vendored with its MIT licence in `vendor/three/` (with `GLTFLoader`), on WebGL 2. The 2D isometric view draws with **Canvas 2D** (`src/ui/renderer.js`, `src/ui/battle-art.js`). |
| State management | **None as a library.** The rules core in `src/core/` owns one plain, JSON-serialisable campaign state object, changed only through its command functions (`src/core/game.js`). UI state lives in module-level variables in `src/ui/app.js`. Saves go through `src/ui/storage.js` to `localStorage`. |
| Build tool | **A custom Node script, `scripts/build.mjs`, with no bundler.** It copies the static tree into `dist/`, normalises text, strips three.js doc comments, hashes every file, writes the offline service worker from `scripts/service-worker.template.js` and enforces the download budgets. |
| Test runner | **Node's built-in runner** (`node --test`, `node:test` and `node:assert/strict`): 124 files with 838 tests at 0.38.1. Browser checks use **Playwright** scripts (`npm run smoke`, `benchmark:stage`, `benchmark`), installed separately because Playwright is not a dependency. |
| Dependencies | None at runtime and none for development (`package.json` lists no dependencies). |
| Hosting | A static site with an offline service worker and a PWA manifest. There are no accounts, analytics or network services. |

The companion specification's TypeScript/Vite/Vitest stack remains an explicit deviation, as CLAUDE.md records. Nothing in this conversion changes it.

## New real-time modules (Phase 0)

| Module | Role |
| --- | --- |
| `src/core/controls-model.js` | `controlsModel: 'turns' \| 'realtime'` and the per-chapter `realtimeChapters` fallback. |
| `src/core/realtime/rng-streams.js` | Named per-system random streams split from the campaign's seeded generator (`shared.js` `rng`). |
| `src/core/realtime/clock.js` | The fixed 20 Hz driver: accumulator, game speed, slow time, pause, step. The real time between frames comes in as an argument; the module never reads the clock. |
| `src/core/realtime/simulation.js` | The world, command queue (latest per actor wins), the tick in the brief's system order, snapshot and world hash. |
| `src/core/realtime/navigation.js` | A 0.5 m walkability grid built from the encounter map, A* with an octile heuristic, string pulling, the route preview and separation. |
| `src/core/realtime/combat.js` | Derived values (§3.5), blow resolution and the forecast's numbers. |
| `src/core/realtime/abilities.js` | Pure `validate()` and `forecast()`, and the effects of Strike, Brace and Throw pilum. |
| `src/core/realtime/ai.js` | Phase 0 enemy AI (idle → engage, spreading round the target, skirmisher throws), run at 4 Hz staggered by actor. |
| `src/core/realtime/intents.js` | Pointer contexts → cursor states, message-line text and the Command a click would give. |
| `src/core/realtime/arena.js` | The Phase 0 arena (a Legionary against three raiders) on the frontier-road map. |
| `src/core/realtime/benchmark-worlds.js` | A 15-man skirmish and an 82-man crowd, stepped headless to time the tick for the performance checks. |
| `src/data/realtime-rules.js` | Every constant and table: tick and round, speeds, weapons, shields, armour, training paths, abilities, reason codes and AI. |
| `src/ui/action-map.js` | The §7 key map by `KeyboardEvent.code`, with forbidden keys and layout-aware labels. |
| `src/showcase/live-figures.js`, `src/showcase/realtime-input.js`, `src/showcase/arena.js`, `showcase/arena.html` | The real-time arena page. Figures are posed from the interpolated simulation, and pointer input follows the §2.7 browser rules. |
| `scripts/arena-benchmark.mjs` | `npm run benchmark:arena`: the arena's start-up, click-to-first-movement, whole fights and its own performance check in headless Chromium. |

## Rules core: `src/core/`

| Module | Today | Fate | Notes for the conversion |
| --- | --- | --- | --- |
| `battle.js` | Turn engine: battle setup from maps, actions and targets, preview and apply, damage and `combatBreakdown`, morale, cohesion and suppression, AI intents and doctrine use, end of turn and checks | **adapt** | Two parts go elsewhere. The setup (map to terrain, rosters, waves) and the 0.38 exchange, morale, cohesion and suppression formulas move to a shared pure module: the real-time squad port calls the per-turn exchange scaled to 1/10 every 20 ticks (§3.4). The turn loop stays behind `controlsModel: 'turns'`. Its turn-only exports (`previewBattle`, `applyBattle`, `endBattleTurn`, `planBattleUnit`, `battleActions`, `battleTargets`) are deleted after Gate 4. |
| `legacy-battle.js` | Frozen v1 battle rules for encounters suspended under old saves | **delete-after-Gate-4** | The 0.40 migration restarts any in-progress encounter from its checkpoint (§3.17), so no v1 encounter is ever resumed. |
| `contest.js` | Contest engine: stances, Resolve, blocs, interests, speeches, rivals' turn and votes | **keep** | It is the Contest rules core (§3.11). Each hour is one 0.38 turn. The Resolve, Denounce and Rebut additions arrive as a profile argument that is neutral by default, so the F30 port test replays 0.38 logs unchanged. |
| `legacy-contest.js` | Frozen v1 Contest rules | **delete-after-Gate-4** | Same reason as `legacy-battle.js`. |
| `movement.js` | Tile routes for click-to-walk (`movementRoute`, `planMove`) | **replace** | Replaced by `realtime/navigation.js` (0.5 m grid, A*, string pulling). |
| `shared.js` | `rng` (the seeded LCG), `clone`, `clamp`, `note`, tile helpers | **adapt** | `rng` stays the root generator. The real-time streams are split from its state (`rng-streams.js`), so a chronicle keeps one seed. The tile helpers (`reachable`, `stepToward`, `pathDistance`, `movementPinned`, `unitAt` and the tile `lineOfSight`) are deleted after Gate 4. |
| `field-geometry.js` | Field-object geometry on tiles | **adapt** | Field objects in metres: barricade 2 m, brazier 3 m, gate and bridge footprints on the 0.5 m grid. |
| `field-approaches.js` | Approaches (Engineering, Diversion, Defensive advance) | **adapt** | Turn counts become rounds. Engineering's opening is walk-only in rounds 1–2, and its +10 defence applies only to the ported squad formula (Phase 2). |
| `expanded-campaign.js` | Field objects, weather, coordinated assignments, policies | **adapt** | Field objects close at the end of round 7, and interactions take 3 s rings interrupted by hits. The brazier deals damage at each round end. Policies are unchanged. |
| `command-campaign.js` | Operational plans, doctrine planner, command capacity, cases | **adapt** | The doctrine planner runs at round boundaries. Command capacity becomes Command per round (§3.8). |
| `operations.js` | Escort and evacuation operations | **adapt** | Travel times measured in rounds. Map scale is chosen per encounter by travel time and recorded in `docs/realtime-encounters.md` (Phase 1–2). |
| `progression.js` | Progression state and validation | **keep** | |
| `progression-politics.js` | Negotiators, coalition, agreements | **keep** | |
| `progression-operations.js` | Operation choices and consequences | **keep** | These are camp-side. |
| `progression-veterans.js` | Veteran ranks, specialisations, guard | **adapt** | Specialist actions become the abilities `guard`, `inspire` and `volley` (§3.6). Ranks feed companion attribute gains as data. |
| `career.js` | Company roll, service record | **adapt** | Companions gain attributes per rank (data). The roll becomes the barracks in the walkable camp. |
| `campaign-options.js` | Difficulty, company plans, departures | **adapt** | Difficulty adds the real-time modifiers (§3.18): notice, reaction, default speed and Iron discipline. |
| `game.js` | Campaign command API: new game, decisions, oath, preparations, encounters, act and end turn, commit | **adapt** | The campaign API stays. Encounter play moves to the real-time command queue. `act`, `endTurn` and undo serve `'turns'` until Gate 4. |
| `debug.js` | Development chapter injection (excluded from builds) | **keep** | It backs the development menu's scenario jumps. |
| `controls-model.js` | (new) | **new** | See [the flag](#the-controlsmodel-flag). |

## Data: `src/data/`

| Module | Fate | Notes |
| --- | --- | --- |
| `campaign.js` | **keep** | Fiction, the shared oath entry, chapters and historical notes stay unchanged. |
| `story-stages.js` | **adapt** | Briefings mention turns. Each encounter gains a defeat page ("how history remembers the day"). |
| `encounters.js` | **adapt** | The maps stay the source of walkability. Each encounter gets a scale by travel time (§3.2), recorded in `docs/realtime-encounters.md`. |
| `battle-balance.js` | **adapt** | Its values port into the real-time rules data, and the squad exchange keeps them. |
| `battle-operations.js`, `progression-operations.js` | **keep** | Objectives stay. Deadlines convert turns to rounds when loaded: round N is turn N, with +3 rounds on Story. |
| `campaign-guidance.js` | **adapt** | The guidance text describes turn controls. |
| `command-campaign.js`, `contest-balance.js`, `expanded-campaign.js`, `negotiators.js` | **keep** | |
| `realtime-rules.js` | **new** | The rules are data (§2.5). |

## Saves and serialisation

| Module | Fate | Notes |
| --- | --- | --- |
| `src/ui/storage.js` | **adapt** | Adds autosave triggers (area entry, encounter start, result), the resume point (on pause and on hide; deleted on the first tick after resume), five named slots with thumbnails, the Iron discipline blocks and a version field in save codes. The real-time encounter snapshot is the simulation's JSON snapshot, and the Phase 0 world-hash tests prove it round-trips. |
| `src/ui/session-gate.js` | **keep** | "Continue in this tab" stays as it is. |
| `src/config.js` | **keep** | The legacy save key `sacramentum.campaign.v1` is kept for compatibility. |

## Input and accessibility layer

| Module | Fate | Notes |
| --- | --- | --- |
| `src/ui/control-preferences.js` | **replace** | Replaced by `src/ui/action-map.js`: the §7 defaults by `KeyboardEvent.code`, forbidden keys rejected, swap on conflict, Esc, Enter, Tab and the arrows fixed, and labels from `navigator.keyboard.getLayoutMap()` or learnt from `event.key`. |
| `src/ui/direct-controls.js` | **replace** | Turn-based click intents give way to the pointer contexts in `realtime/intents.js`. |
| `src/ui/board-input.js` | **replace** | The 2D board's turn selection gives way to the shared real-time pointer model. |
| `src/ui/board-readout.js` | **adapt** | The readouts and screen-reader announcements feed the message line and the target and stop announcements. |
| `src/ui/touch-hold.js` | **keep** | Long-press inspect with the 0.25–1.2 s delay. |
| `src/showcase/stage-input.js` | **adapt** | The real-time pointer mode (`src/showcase/realtime-input.js`) gives left, right and middle buttons, hold-to-move, wheel zoom and the §2.7 scene defaults. The board mode stays for `'turns'`. |
| `src/ui/field-guide.js` | **adapt** | The guided opening gains the pause and slow-time lessons (Phase 4). |
| Named selectors in `encounter-view.js` | **replace** | Replaced by the Command list (Phase 1 v1, full parity at Phase 4). |

## User interface: `src/ui/`

| Module | Fate | Notes |
| --- | --- | --- |
| `app.js` | **adapt** | Routes each encounter by the resolved controls model and hosts the real-time HUD. |
| `encounter-view.js` | **replace** | The turn HUD (select, preview, confirm, End turn) gives way to the real-time HUD: portraits, message line, battle clock, Command pips, ability bar and command card. |
| `panels.js` | **adapt** | The panels I, C, J, Q, L, M, R, A, O and ? |
| `campaign-views.js` | **replace** | Menu camps become walkable camps (Phase 1). This module serves `'turns'` until Gate 4. |
| `campaign-upgrade-views.js`, `command-edition-views.js`, `expanded-views.js`, `progression-views.js` | **adapt** | Deployment planning becomes the deployment phase, and the rest move into panels. |
| `tactical-intel.js` | **adapt** | The field intelligence panel stays, with times in rounds and distances in metres. |
| `settings.js` | **adapt** | The §4 defaults plus `controlsModel` and `realtimeChapters`. |
| `performance-check.js` | **adapt** | Simulation tick timing added (Phase 0). |
| `animation-timeline.js`, `motion.js`, `turn-replay.js` | **delete-after-Gate-4** | They are turn replays. Real-time presentation reads the simulation directly. |
| `renderer.js`, `battle-art.js` | **adapt** | The 2D view draws continuous positions from the same simulation (Phase 1 parity). |
| `battle-effects.js` | **adapt** | Cues come from simulation events instead of committed turns. |
| `battle-stage-controller.js` | **adapt** | Owns the simulation loop for real-time encounters, with the stage in live mode. |
| `ceremony-controller.js` | **keep** | |
| `graphics-quality.js`, `presentation-budget.js`, `render-controller.js`, `page-update.js`, `offline-updates.js`, `site-media.js`, `view-helpers.js` | **keep** | |
| `art.js`, `asset-loader.js`, `actor-body-catalog.js`, `world-assets.js`, `world-art.js`, `ground-materials.js`, `material-forms.js`, `terrain-detail.js`, `field-feature-art.js`, `scene-materials.js`, `scene-parallax.js`, `chapter-weather.js`, `campaign-map.js`, `roman-atlas.js`, `animation-catalog.js`, `sprite-frames.js`, `sprite-poses.js`, `unit-sprites.js`, `bloc-style.js` | **keep** | Art and assets, independent of time. |
| `audio.js`, `ambient.js`, `soundscape.js`, `soundscape-data.js` | **keep** | Sound stays optional and off by default. |
| CSS (`interface.css`, `styles.css`, `tactical.css`, `battle-3d.css`, `cinematic.css`, `command-edition.css`, `command-stage.css`, `campaign-upgrade.css`) | **adapt** | The new HUD. Phase 0's arena brings its own sheet (`src/showcase/arena.css`). |

## 3D renderer: `src/showcase/`

| Module | Fate | Notes |
| --- | --- | --- |
| `stage.js` | **adapt** | Live mode: each frame poses the figures from the interpolated simulation (`live-figures.js`). The turn path through `play()` and the timeline serves `'turns'` until Gate 4. |
| `stage-camera.js` | **adapt** | Follow camera at a pitch of about 50°, 45° yaw steps, overview **Z** and horizon **H**. |
| `stage-readout.js` | **adapt** | Forecast readouts from `abilities.forecast()`. |
| `stage-overlays.js`, `ink-overlay.js` | **adapt** | Route line, reach and area ink in metres, and threat hatching. |
| `combat-presentation.js`, `paired-contact.js`, `battle-sound.js` | **adapt** | Reactions, contacts and cues timed by the simulation's swing (contact at 50%). |
| `formation.js` | **adapt** | Squad members follow slot offsets per formation (Phase 2). |
| `main.js`, `session.js` (the standalone study) | **replace** | The real-time arena (`showcase/arena.html`, `arena.js`) replaces them. The 0.38 skirmish stays behind `'turns'` until Gate 4. |
| `stage-figures.js`, `stage-labels.js`, `stage-label-layout.js`, `contextual-labels.js`, `stage-preparation.js`, `stage-preload.js`, `stage-focus-camera.js`, `stage-particles.js`, `combat-effects.js`, `battle-remains.js`, `contact-shadows.js` | **keep** | |
| `actors.js`, `actor-*.js` (26 modules), `character-detail.js`, `painted-actor.js` | **keep** | Figures, rig, clips and materials. Real time drives the existing motions (idle, walk, run, attack, throw, brace, hit, fall). Layered kit (Phase 1) extends `actor-kit.js` and `actor-costume.js` (adapt then). |
| `environment*.js` (31 modules), `battlefield-features.js`, `scenery-models.js`, `model-loader.js`, `sky.js`, `atmosphere.js`, `scene-lighting.js`, `scene-compositor.js`, `water-reflection.js`, `shadow-depth.js`, `decoded-images.js`, `skin-response.js` | **keep** | The world is independent of time. |
| `frame-budget.js`, `frame-profile.js`, `device-report.js`, `build-steps.js`, `campaign-scene-profile.js`, `ceremony.js` | **keep** | |

## Offline and PWA

| Module | Fate | Notes |
| --- | --- | --- |
| `scripts/service-worker.template.js`, `scripts/module-closure.mjs` | **keep** | The arena page and its modules live under the study prefixes (`./showcase/`, `./src/showcase/`), so they download with the 3D study, not the 2 MB first load. The pure rules modules join the shell. |
| `src/ui/offline-updates.js`, `manifest.webmanifest`, `icons/` | **keep** | |

## Scripts

| Script | Fate | Notes |
| --- | --- | --- |
| `autoplay.mjs`, `command-autoplay.mjs`, `expanded-autoplay.mjs`, `production-autoplay.mjs`, `progression-autoplay.mjs` | **adapt** | The legal-command harnesses stay. Real-time bots issue Commands through the queue from New Game, and the turn harnesses remain until Gate 4. |
| `benchmark-stage.mjs`, `benchmark-campaign.mjs`, `browser-smoke.mjs`, `record-production.mjs`, `visual-regression.mjs` | **adapt** | Real-time flows: click-to-move, pause, step and the arena. |
| `build.mjs`, `verify-assets.mjs` | **adapt** | The arena page is added to the build (it already copies `showcase/`). |
| `campaign-3d-fixtures.mjs`, `graphics-fixtures.mjs` | **adapt** | Fixtures captured from simulation snapshots. |
| `combat-diagnostic.mjs` | **replace** | Real-time combat diagnostics from the simulation log. |
| `political-diagnostics.mjs`, `serve.mjs`, `prepare-tests.mjs`, `module-closure.mjs` | **keep** | |
| Character and asset scripts (`build-*-asset.mjs`, `build-character-*.mjs`, `character-glb.mjs`, `check-character-handoff.mjs`, `audit-character-*.mjs`, `fetch-*-source.mjs`, `optimize-*.py`, `export-*.py`, `scene-depth.py`, `scripts/assets/*`) | **keep** | Layered kit pieces (§3.13) go through the same pipeline. |

## Tests (`tests/`)

| Group | Fate | Files |
| --- | --- | --- |
| Rules and campaign | **keep** | `core`, `content`, `gates`, `career-story`, `campaign-options`, `progression`, `politics-overhaul`, `command-campaign`, `field-approaches`, `storage`, `session-gate`, `settings` and the `tests/compatibility` fixtures. These test campaign flow, Contests and saves, which the conversion keeps. |
| Turn-based combat and controls | **delete-after-Gate-4** | `combat-overhaul`, `tactical-depth`, `direct-controls`, `board-input`, `animation-timeline`, `renderer-motion`, `showcase-session`, `v026-controls-overhaul`, `v031-movement`, `v033-touch`, `v034-controls`. They test the turn path, which must keep passing until then. |
| UI contracts and versioned upgrades | **adapt** | `interface-contracts`, `ui-events`, `campaign-upgrade-ui`, `command-edition-ui`, `field-approach-ui`, `progression-views`, `progression-ledger-app`, `overhaul-integration`, `v023`–`v035` upgrades, `veteran-motion`, `battle-stage-controller`, `command-stage`, `stage-readout`, `combat-presentation`, `battle-effects`, `battle-sound`, `tactical-rendering`. Each is re-pointed at the real-time HUD as its screen is converted. |
| 3D, figures, environment, assets and offline | **keep** | Every `actor-*`, `environment-*`, `scene-*`, `shader-programs`, `figure-surfaces`, `stage-*` (except `stage-readout`), `showcase-*` (except `showcase-session`), `graphics-*`, `asset-*`, `audio-*`, `soundscape*`, `offline-*`, `frame-budget`, `smooth-play-v038`, `chapter-3d-assets`, `campaign-3d-fixtures`, `campaign-environment`, `production-world`, `newworlddetail`, `character-*`, `device-presentation`, `page-update`, `site-media`, `skin-response`, `sprite-poses`, `shield-grip`, `bridge-stage-v034`, `authored-animation`, `ambient`. |
| Real time (new) | **new** | `realtime-*.test.mjs`: the A1–A4 determinism and save/load hashes, combat statistics (C13, C17), movement (B6, B8, B9) and the arena auto-fight check. |

## The `controlsModel` flag

`src/core/controls-model.js` resolves which controls an encounter uses.

- `controlsModel: 'turns' | 'realtime'` is persisted in the settings and switched in the development menu. The menu appears in `npm run dev`, or with `?dev` in the address.
- `realtimeChapters: number[]` is the per-chapter fallback the kill criteria rely on.
- A chapter plays in real time only when the model is `'realtime'`, the chapter is listed and its real-time content exists (`REALTIME_READY_CHAPTERS`). Phase 0 has no real-time chapter yet, so the whole campaign still resolves to `'turns'`.
- The standalone skirmish already follows the flag: under `'realtime'`, "Try a standalone skirmish" opens the arena.

## Risks found while surveying

- **The 3D stage assumes tiles in its turn path** (`unitAt`, `play()`, `stageActorPose`). Live mode bypasses those paths and drives positions and poses directly. Fractional tile coordinates already work in `gridToWorld`.
- **Picking returns tiles.** Real time needs the ground point in metres, so the stage now also returns the continuous hit point.
- **Left-drag currently orbits the camera.** In real time a held left button moves the soldier, and the middle button or two fingers turn the view. The board mode keeps the old binding for `'turns'`.
- **The 0.38 maps are small** (8×8 to 12×10 tiles of 2.5 m). The travel-time scaling in §3.2 decides each encounter's metres. The Phase 0 arena keeps the frontier road's 20 × 20 m.

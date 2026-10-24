# Imperium: worlds, buildings and gameplay — the approved plan

The owner approved this plan in October 2026, after the regional worlds of [#26](https://github.com/obeidpeter/Imperium/pull/26) and the documentation follow-up of [#27](https://github.com/obeidpeter/Imperium/pull/27). It is kept here as written, with second-person wording turned to name the owner, so that later releases can follow it. Each release's changelog entry records what it actually delivered and measured; where the two differ, the changelog and the code are authoritative.

## Status

| # | Release | State |
| --- | --- | --- |
| 1 | Foundations | merged ([#28](https://github.com/obeidpeter/Imperium/pull/28)) |
| 2 | Ground, sky and light | in progress |
| 3 | Harder, less predictable battles | not started |
| 4 | Walls, gates, towers and bridges | not started |
| 5 | Nature, water, weather and fire | not started |
| 6 | Faces, cast, horses and crowds | not started |
| 7 | Sieges, cavalry and new missions | not started |
| 8 | Living camps | not started |
| 9 | Landmarks and the great set pieces | not started |
| 10 | Real time by default (Gate 4) | not started |

## Context

The last releases made the game smooth and gave it a production pipeline:
- **0.38:** smooth play.
- **Asset foundation:** KTX2/meshopt, a world catalog and CC0 intake.
- **0.37 and 0.40:** generated bodies for every figure, the soldier included.
- **PR #26:** regional Blender kits, 20 Tripo props and a walkable camp in every chapter.

A survey of main at `842084c` shows that most of the world and much of the play are still first-pass. The owner asked for a plan that improves every aspect, especially environments and buildings, and the gameplay.

### World (`src/showcase/`)
- **Ground:**
  - One noise-coloured plane. Its turf is a 128 px code texture repeating every 2 m (`environment-materials.js`).
  - The board's terrain cells don't drive it: sand and camp cells look like grass.
  - No photographic texture ships.
- **Sky and light:**
  - The sun is fixed at about 50° for dawn, day and dusk alike (`campaign-scene-profile.js`).
  - Clouds are unlit noise (`sky.js`).
  - One shadow map, no cascades and no baked sun shadows; plain distance fog.
- **Distance:** unlit boxes on a noise ring (`environment-horizon.js`) and a code-painted canvas (`environment-backdrop.js`).
- **Nature:**
  - Four code-built tree species with no detail levels; the same 10 oaks in every base scene.
  - Grass at fixed positions; rocks are noise spheres.
  - The distant Danube is moved on the CPU every frame.
  - Weather is 64 points at the world origin (`stage-particles.js`); fire is glowing spheres.
- **Buildings:**
  - Everything inside the board is code-built: walls about 1.3 m high, brick as tinted stone, and gates, bridges, barricades and braziers drawn by `environment-fieldwork.js`.
  - The new kits stand only around the board edge (`environment-regional-world.js`); their gate, bridge and wall pieces are never used on the board.
  - There is no structure registry.
  - The Curia, the finale's walls and its 208 motionless primitive soldiers, and both ceremonies (still the old stockade) are code-built.
- **Figures:**
  - Faces are baked and static, one per body, so the soldier and the named cast have no identity in 3D, and all camp staff wear one civilian body.
  - Horses are code-built and plain.
  - There are no Roman cavalry, toga or female generated bodies.
  - Unnamed units share one shield colour and motif per faction.
- **Quality:** a quality drop rebuilds the whole world mid-battle (`graphics-quality.js`). The last full benchmark predates PR #26: 46–56 shader programs and up to 270 draw calls and 1.34 M triangles.

### Gameplay (`src/core/realtime/`, `src/data/realtime-rules.js`)
- **Too easy:** a simple bot wins every Chapter IV–XII battle on all 20 seeds, on Story and Standard (`docs/evidence/realtime-gate4-sweep.json`), and wins the finale in 4–5 of 16 rounds. Veteran keeps Standard's deadlines and has never been tested.
- **Predictable:** squad battles draw no randomness (`squads.js`, `squad-ai.js`), so every seed plays the same.
- **Thin enemy AI:**
  - Raiders never break or flee, which contradicts the guide.
  - Enemy AI targets the nearest foe and has no techniques beyond throwing (`ai.js`; `ENEMY_AI` is still labelled "Phase 0").
  - Squad soldiers have no perception, so 13 of 19 battles can have no ambush and the Explorator path loses its point.
- **Repetitive battles:**
  - Every battle places the same opportunity pair, barricade and brazier (`src/core/expanded-campaign.js`).
  - Weather is fixed per chapter.
  - You command only infantry and archers.
  - 10 of 18 battles are escort or hold; fields are 45–102 m and last 4–8 rounds.
- **Thin camps after Chapter III:**
  - The camps of IV–XII share one template with generic staff (`src/data/camps.js`).
  - Errands, the trader and errand training points stop after Chapter III.
  - Five titles are never awarded (`src/data/soldier.js`).
  - The guide promises replies gated by attributes and decorations that the dialogue data never uses.
- **Not yet real time everywhere:**
  - Practice still uses the 0.38 board.
  - Real time is opt-in until Gate 4.
  - Nobody has played a Contest in the chamber.

## The owner's decisions

| Topic | Decision |
| --- | --- |
| Downloads | **24 MB per chapter** (with its 2D art) and **80 MB complete**. The first load stays at **2 MB**; Chapter I in 3D rises to **16 MB**. |
| Tripo | **Up to 2,500 credits** (wallet about 3,760). Buildings fitted to the board are made in Blender, at no cost. |
| Gameplay | All four: harder, less predictable battles; living camps in every chapter; new battle mechanics; real time as the default after the owner's Gate 4 play-through. |
| 2D view | Kept as a working fallback; its art is not redrawn. |
| Devices | Unchanged targets: steady 30 fps on mid-range 2021+ phones (Performance) and 60 fps on integrated-graphics laptops (Balanced); battles ready in about 3 s once downloaded; no freezes in play. |

## Rules that hold throughout

- **The rules core stays deterministic** (`src/core/`).
  - New gameplay draws randomness only from the simulation's named streams (`ai`, `combat`, `world`; `src/core/realtime/rng-streams.js`).
  - The world-hash replay tests A1–A4 keep passing.
  - Invalid commands and previews change nothing, the random generator included.
- **Presentation never changes state or uses gameplay randomness.** Scenery variety comes from a presentation-only seed derived from the encounter id.
- **The board stays readable:**
  - Overlays draw on top, and the see-through cutaway (**X**) keeps units visible.
  - No scenery suggests a passage, cover or height that the rules don't provide.
  - Where structures gain rules (release 4), the rules come first and the art follows them.
- **Every model keeps a code-built stand-in.** Performance quality and failed downloads use it.
- **Every asset is recorded:** `docs/asset-manifest.json` and `docs/art-generation.md` (Tripo prompts verbatim), and CC0 licences and digests (`scripts/assets/cc0.mjs`). Blender generator scripts are committed.
- **Saves:**
  - New saved fields get an edition flag with strict validators, as `src/core/command-campaign.js` does.
  - Older saves keep loading; an encounter whose snapshot format changed restarts from its checkpoint.
  - The frozen fixtures in `tests/compatibility/` are never regenerated.
- **Narrative invariants:**
  - Every new choice has a later visible consequence.
  - Absent cast members have absence branches.
  - Companions' fates come only from signalled decisions.
  - History stays fixed through 275, and the finale keeps its recovery floor.
- **The 0.38 turn path stays playable until release 10.** New gameplay is built for real time. The 2D view keeps working with every new rule, using its existing art and code-drawn shapes.
- **Every player-facing change updates the guide** (`docs/player-guide-0.40.md`), regenerates the in-game help (`npm run guide:help`) and adds to the changelog.
- **Release routine:**
  - Each release is verified, pushed to `claude/hopeful-faraday-x8zvuo` and opened as a pull request, then merged when CI is green, as with #25 and #27. Approving this plan approves that routine.
  - Reports keep software-rendered automated checks apart from the owner's real-device runs and play.

## Targets

| | Phone (Performance) | Laptop, integrated graphics (Balanced) |
| --- | --- | --- |
| Frame rate | steady 30 fps | steady 60 fps |
| Per frame | ≤ 400k triangles, ≤ 150 draw calls | ≤ 1M triangles, ≤ 250 draw calls |
| Shader programs per battle | ≤ 50 (46–56 today), none compiled after the battle shows | same |
| GPU memory (textures and geometry) | ≤ 300 MB | ≤ 600 MB |
| Battle ready, downloaded | ≤ 3 s, with the progress veil | ≤ 2 s |
| Downloads | first load ≤ 2 MB; Chapter I in 3D ≤ 16 MB; any chapter with its 2D art ≤ 24 MB; complete ≤ 80 MB | same |

## Roadmap

Ten releases, each shippable on its own. World and gameplay alternate where they share foundations.

| # | Release | What the player will see |
| --- | --- | --- |
| 1 | Foundations | New download limits, a fresh performance baseline with CI gates, quality changes without rebuilding the world mid-battle, world layouts as data, one-command tool setup. Little visible change. |
| 2 | Ground, sky and light | Photographic ground driven by the board's own cells (sand finally looks like sand), a sun that is low at dawn and dusk, sun-lit clouds, better shadows, Blender-rendered regional horizons |
| 3 | Harder, less predictable battles | Enemy plans that vary between plays, raiders who break and flee, ambushes on squads, smarter targeting, a real Veteran |
| 4 | Walls, gates, towers and bridges | The board's own structures built from Blender kits fitted to its cells, and rules that give them meaning: height, cover, gates, breaches |
| 5 | Nature, water, weather and fire | Regional tree species with detail levels, varied placement, dense grass and scrub, sculpted rocks, flowing rivers, rain and dust that surround the camera, real fire and smoke |
| 6 | Faces, cast, horses and crowds | Your soldier's own face at every rank; a recognisable named cast; senators in togas; camp staff who look their part; generated horses; animated massed legions; varied shields |
| 7 | Sieges, cavalry and new missions | Chapter V's siege works, Roman cavalry squads from Chapter VII, new mission types in place of repeated escort and hold |
| 8 | Living camps | A distinct camp layout for every chapter, the named cast in camp, errands, trainers and a trader in every chapter, the five missing titles, replies that depend on who your soldier is |
| 9 | Landmarks and the great set pieces | The landmarks of each region, the Curia in marble, the Aurelian Walls for the finale, both ceremonies staged in their real settings, life in towns and camps |
| 10 | Real time by default (Gate 4) | After the owner's play-through, real time becomes the default; Practice and the skirmish play in real time; version 0.40.0 is released |

### 1. Foundations
- **Download limits** (`src/ui/presentation-budget.js`, its tests and `docs/asset-pipeline.md`): 2 / 16 / 24 / 80 MB. Refresh the out-of-date budget table.
- **Fresh baseline and CI gates:**
  - Re-run `npm run benchmark:stage` across all twelve chapters on Performance and Balanced, now with PR #26's scenery.
  - Record draw calls, triangles, programs, GPU memory and long tasks in `docs/evidence/`.
  - CI fails when the deterministic counts (programs, draw calls, triangles per tier) rise above the recorded ceilings without the ceiling being raised on purpose.
- **No world rebuild in battle:**
  - `src/ui/graphics-quality.js` and `stage.js` `applyQuality` change resolution, shadow refresh and post-processing live.
  - Anything that needs a rebuild waits for the next encounter.
  - Live adaptation works in both directions, with hysteresis.
- **World layouts as data** (`src/ui/world-layouts.js`, next to `world-catalog.js`). The fixed placement lists in `environment-regional-world.js` and `environment-ch5-pilot.js` become per-region and per-encounter data with a presentation seed (`hash(encounter id)`). Later releases add landmarks, trees and life to that data instead of new engine branches.
- **One-command tools** (`scripts/assets/setup-tools.mjs` and docs): rebuild the Blender Python module, basisu and glTF-Transform in a fresh session. Today they live only in this session's scratch space.
- **CI time:** the usability job already takes 28 of its 45 minutes. Move the twelve-camp check into its own job.

### 2. Ground, sky and light
- **Ground material** (new `src/showcase/terrain-material.js`; changes to `environment.js` and `environment-materials.js`):
  - Splat-blended layers: grass, dry grass, dirt, mud, sand, gravel, rock and paving.
  - Weights come from the board's terrain cells (`camp`, `sand`, `stone`, `road`, `marsh`, `high`), slope, wetness and wear.
  - CC0 Poly Haven sets fetched with `npm run asset:cc0`, packed as KTX2 arrays per biome.
  - Macro variation breaks the 2 m repeat; slopes are triplanar. One shader program serves every chapter.
- **Sky and time of day** (`sky.js`, `scene-lighting.js`, `campaign-scene-profile.js`):
  - A real sun elevation for dawn (II, VIII), day and dusk (V, VI, XII), with long shadows.
  - Moon and stars for the night stratagem; clouds lit by the sun.
  - A per-chapter colour lookup table in the existing compositor (`scene-compositor.js`); height fog.
- **Shadows:**
  - Two cascades on Balanced and High.
  - Static sun shadows baked into the existing occlusion bake (`environment-baked-occlusion.js`) at load.
  - Generated models included in the baked shading and the cloud shadows; the live shadow map then covers figures only.
- **Horizon** (`environment-horizon.js`, `environment-backdrop.js`):
  - Blender-rendered panoramas per region (`scripts/assets/render-panorama.py`, about 0.4 MB each) replace the code-painted canvas.
  - The horizon ring gets distance levels and forest stand-ins.
- **Water:** the distant Danube moves in its shader instead of on the CPU every frame.

### 3. Harder, less predictable battles (`src/core/realtime/`, `src/data/realtime-rules.js`)
- **Varied enemy plans** (`squad-ai.js`):
  - At the start, and at round boundaries, the enemy draws its plan from the `ai` stream: flank side, reserve timing, focus target, feint or press. Same seed, same battle; different seed, different battle.
  - The combat formula is unchanged, so the 0.38 parity tests (`tests/realtime-squads.test.mjs`) keep checking it.
  - Tests that assumed identical outcomes across seeds are versioned on purpose.
- **Morale for raiders** (`ai.js`): war bands in Chapters I–III break when their leader falls or losses mount, then flee to the edge, as the guide already says.
- **Perception for squads** (`squads.js`): each squad gets a shared notice meter using the existing perception rules. Ambushes, Quiet feet, Ambush craft and the Explorator path then work in 13 more battles.
- **Smarter enemies:**
  - Enemies target by threat, not just nearness.
  - They protect archers, pull back broken men, focus on exposed squads and use their few techniques: brace, charge, volley.
  - `ENEMY_AI` is relabelled and grouped by faction.
- **Difficulty** (`src/core/campaign-options.js`, `realtime-rules.js`):
  - Veteran gets shorter deadlines, earlier and stronger waves and faster reactions.
  - Standard is retuned so the sweep bot still wins every battle, but with losses and narrower margins.
  - Sweeps on all three difficulties (20 seeds each) with a calibration report; Story stays easy.

### 4. Walls, gates, towers and bridges (world and rules together)
- **Board kit** (`scripts/assets/build-board-kit.py`, Blender):
  - Pieces fitted to the 2.5 m cell: curtain-wall runs, corners and ends in stone, brick, mudbrick and timber.
  - Towers; gatehouses open, closed and broken; timber and stone bridges damaged and repaired.
  - Palisades, ramparts with ditches, stairs and ramps, breach rubble.
  - Trim-sheet textures with normal maps, two levels of detail, about 1–1.5 MB per material family.
- **Structure registry** (`src/showcase/structure-registry.js`):
  - Maps each terrain cell and field-object state (`src/core/expanded-campaign.js`) to kit pieces, instanced per material.
  - `environment-fieldwork.js` remains the stand-in.
  - The unused regional pieces (`timber_gate`, `ditch_bridge`, `bridge_trestle`, `wall_bay`) join it.
- **Rules**, extending what exists: height (`COMBAT.heightStep`/`heightDefence` in `combat.js`), missile cover (`crossesCover`) and the field objects in `field-objects.js`:
  - Walls block movement and give cover against missiles from outside.
  - Towers and ramparts give height and a longer missile range.
  - Gates have states that open, close and break: a closed gate blocks, and a squad with engineers can break it over time.
  - Breaches turn wall cells into slow rubble.
  - Forecasts name each modifier ("From the tower", "Behind the wall").
  - Saved encounter state gets an edition flag for the new structure states. Encounter layouts (`src/data/encounters.js`) gain towers and gates where the history and the chapter call for them.
- **Readability:** the cutaway covers the new pieces; a test checks that no model stands on a walkable cell the rules leave open.

### 5. Nature, water, weather and fire
- **Trees** (`scripts/assets/build-trees.py`, Blender):
  - Species by region, each with three levels of detail, an impostor and wind:
    - Danube: oak, beech, willow, alder.
    - Dacia: spruce, fir.
    - Italy: cypress, umbrella pine, poplar, olive.
    - East: date palm, tamarisk.
  - Bark and leaf textures come from CC0 sources.
  - Placement uses the presentation seed outside walkable cells, replacing the same 10 oaks everywhere (`environment-foliage.js`, `environment.js`).
- **Ground cover:** instanced grass in chunks around the camera; flowers, reeds, scrub and crops. Density follows the quality tier.
- **Rocks:** 12 Tripo rocks, 4 per biome group, replace the noise spheres.
- **Water:** flowing Danube and Euphrates, fords and marsh with depth colour, foam and wet banks. High keeps the mirror (`water-reflection.js`).
- **Weather** (`stage-particles.js` rewritten):
  - Rain, embers and dust that follow the camera, on the GPU; mist banks; wet surfaces.
  - One wind field shared by grass, trees, banners and cloaks.
- **Fire and smoke:** flipbooks rendered in Blender for braziers, torches, campfires and burning siege works, replacing the glowing spheres. Torch models are code-built.
- **Sound:** regional ambience follows the new world (water, wind in trees, birds), synthesized in code as PR #26 does, or CC0 with licences recorded.

### 6. Faces, cast, horses and crowds
- **Your soldier's own face:**
  - Four rank bodies (recruit, legionary, officer, commander) generated from one face reference, so he looks the same throughout.
  - `actor-body-catalog.js` `actorBodyId` picks the hero's set.
- **Named cast:** Varro, Lucan, Sabinus, Felix, Aelia and Severianus each get a body with absence branches unchanged.
- **Senators and camp staff:**
  - Three senators in togas replace the procedural togas in the chamber.
  - A clerk and a capsarius in their own dress.
  - A Roman cavalry rider and a female civilian.
- **Faces that move:** the binder (`scripts/assets/bind-character.py`) adds blink and jaw shape keys to generated heads for conversations and speeches.
- **Horses:**
  - Three Tripo horses rigged as quadrupeds (25 credits each), with walk, trot, gallop and idle clips (10 each): Roman, northern and eastern armoured.
  - Clips are played at the simulation's speed with the rider seated on the saddle bone.
  - `actor-horse.js` remains the stand-in.
- **Crowds:**
  - The finale's 208 primitives become instanced generated overview bodies animated on the GPU from baked clips, with stand-ins for the far ranks (`environment-finale.js`).
  - Formation followers use the same path.
- **Shields:** per-unit shield designs from a pattern library: legion emblems, and enemy patterns per faction.

### 7. Sieges, cavalry and new missions
- **Chapter V siege** (the fictional fortress inspired by Dura-Europos, 256): the Persian ramp and mine as field objects with progress.
  - Your countermine, or a sortie to burn the works, against their advance.
  - Ladders and a ram as enemy siege works; breach rules from release 4.
- **Roman cavalry squads** (`src/data/realtime-squads.js`; cavalry rules already used by enemies):
  - From Chapter VII (Gallienus's cavalry at Milan) and in Chapter IX (Aurelian's horse at Immae).
  - Charge and the feigned retreat as squad orders.
- **New mission types** replace some of the 10 escort and hold battles, and keep each chapter's required capability:
  - a sortie (V);
  - a rearguard with fallback lines (VI);
  - a crossing under fire (VIII);
  - a feigned retreat and pursuit (IX);
  - a relief convoy with a route choice (X).
- **Varied field objects:** opportunity pairs and objects vary by mission instead of the same pair everywhere (`expanded-campaign.js`). Weather can vary by encounter within each chapter's season.
- **Checks:** autoplay bots and sweeps updated for the new missions; tests for siege progress, gates and cavalry orders.

### 8. Living camps
- **A camp of its own for each chapter:** the four layouts shared by eight chapters are replaced (`src/data/camps.js`, `camp-regions.js`), and reachability tests cover each.
- **The named cast in camp:**
  - Varro until his Chapter VI fate, and Lucan or Sabinus, Felix, Naso, Crispus and Brennus.
  - Severianus (the patron), Aelia (the settler), Paullus (the senator), Theon (the Rhetor) and Quintus (the signifer), each with absence branches.
- **Errands in Chapters IV–XII:**
  - Two or three per chapter: one general, plus one for each training path.
  - Rewards are training points within a raised, audited ceiling (`src/core/tp-audit.js`, `tests/tp-audit.test.mjs`).
  - The five titles never awarded become rewards for errands and deeds.
- **A trader in every chapter** with regional goods (`TRADER_STOCK`), and defeat pages for every encounter.
- **Replies that depend on who your soldier is:** dialogue gated by attributes, decorations, titles and meters, which the engine already supports (`src/core/dialogue.js`). Perception notices things. This fulfils what the guide promises.
- **Rules lifted and kept:**
  - This lifts PR #26's rule that camps add no task or reward (`camp-regions.js`), as the owner approved.
  - Camps stay peaceful, and every new choice has a later consequence.
- **Save compatibility:**
  - Saves get an edition flag for the new errands and titles.
  - A chronicle from 0.38 keeps its audited grant; errands in chapters it has already finished are not granted after the fact.

### 9. Landmarks and the great set pieces
- **Landmarks per region**, about 35 Tripo models placed by the layout data from release 1:
  - Danube: principia, granary, bathhouse, river boats.
  - Marsh: stilt huts.
  - Road station: stables, milestones.
  - Dura: temples, houses, the desert gate.
  - Edessa: caravan wells, a burnt farm.
  - Milan: villa rustica, Roman bridge.
  - Dacia: pontoon bridge, palisades.
  - Palmyra: colonnaded avenue, tetrapylon, tower tombs, temple court.
  - Dacia Aureliana: granary court, basilica.
  - Rome: temples, apartment blocks, umbrella pines.
  - Historical details are checked against `docs/historical-research.md` before modelling.
- **The Curia** (`environment-depth.js` audience hall) is rebuilt in Blender, in marble with benches and statue niches, for every Contest.
- **The finale** gets the Aurelian Walls and gate in Blender.
- **Ceremonies** (`ceremony.js`):
  - The oath is staged on the Danube base's parade ground with the recruits in tunics; the accession is staged in Rome.
  - Both get story beats instead of a slow orbit, using the regional kits rather than the old stockade.
- **Life:** about 15 Tripo props (market goods, wagons, laundry), cloth banners and awnings, roof smoke and birds.

### 10. Real time by default (Gate 4)
- **The owner's play-through** on Story and Standard with a checklist per chapter (camps, battles, Contests and the finale's routes). What it finds is fixed before the switch.
- **The switch:**
  - Real time becomes the default (`src/core/controls-model.js`), and Practice and the standalone skirmish play in real time (`src/ui/app.js` archive practice).
  - The 0.38 turns stay selectable in Settings for this release; whether to retire them afterwards is the owner's decision.
- **Release 0.40.0:** changelog, README and guide, with the owner's Performance-check files from a phone and a laptop recorded as device evidence.

## Credits and downloads

**Tripo, within 2,500 credits:**

| Use | Credits |
| --- | ---: |
| Release 6 figures: 4 soldier bodies, 6 cast, 3 senators, 2 staff, a cavalry rider, a civilian (45 each), 3 rigged horses with clips (about 85 each) | about 1,000 |
| Release 9 landmarks (about 35) and life props (about 15), 20 each | about 1,000 |
| Release 5 rocks (12) | 240 |
| Retries for poor or anachronistic results | 260 |

**Downloads after the plan** (estimated):
- A chapter in 3D grows by about 6–10 MB: ground set 1.5–2.5, panorama 0.4, trees about 1, rocks about 1, board kit about 1.2, landmarks and life about 1.7, figures and horses 1–2.
- That brings chapters to about 15–21 MB with their 2D art, within 24.
- Chapter I in 3D: about 14–15 MB of 16.
- Complete campaign: about 65–75 MB of 80; shared kits and textures are counted once.
- The first load stays under 2 MB.
- If a chapter nears its limit, textures go down a level or more is shared, before any limit is raised again.

## Verification, every release

- **Automated checks:**
  - `npm run verify`, `npm run smoke`, `smoke:polish`, `smoke:usability`, `smoke:ch5-pilot` and `smoke:world`; the stage benchmark against the CI ceilings; the twelve-chapter benchmark.
  - New tests per release:
    - layout data and catalog against every chapter's download;
    - no model on an open walkable cell;
    - cutaway coverage;
    - the presentation seed never touching state or gameplay randomness;
    - structure rules and states;
    - siege, cavalry and mission rules;
    - errand and title rewards against the audited ceiling;
    - save editions and old-save loading;
    - stand-ins when every download fails.
- **Gameplay releases:** sweeps on Story, Standard and Veteran (20 seeds each), legal autoplay from New Game, and the A1–A4 determinism tests.
- **Renders:** before-and-after renders from fixed cameras for every chapter touched, sent to the owner.
- **Reports** keep software-rendered checks apart from real devices. No device result is claimed without the owner's file.

## What the owner provides

1. **Real-device checks:** after releases 1, 2, 5 and 9, run Settings → Performance check on a phone and a laptop and send the exported files. The tiers are tuned from them.
2. **Gate 4 play-through:** after release 8, play on Story and Standard with the checklist from release 10.
3. **Content review:** optional, but useful. Read the new errands and cast lines in release 8 before they ship.
4. **Tripo:** keep the key available as a network secret in this environment, as before.

## Risks and fallbacks

- **A chapter outgrows 24 MB:** lower texture levels, share more between chapters, or move a landmark to its neighbouring chapter's set.
- **Phones miss the frame rate:** Performance keeps the code-built stand-ins and the lowest detail levels; the owner's device files decide the tier settings before more content lands.
- **Tripo results that are poor or out of period:** regenerate within the 260 kept back, or build the piece in Blender.
- **Balance:** sweeps on all three difficulties plus the owner's Gate 4 play-through; data-only tuning keeps rules changes small.
- **Saves:** edition flags, frozen fixtures and old-save tests in every release that adds saved state.
- **Tools lost with the session:** the setup script in release 1.
- **CI time:** the twelve-camp check moves to its own job; further browser checks get their own jobs instead of longer limits.

## Implementation notes from the design review (for later releases)

Code facts verified by the review, to use when each release starts:

- **Height and cover already exist; structures extend them.**
  - `blowSetup` in `combat.js`: +5 Defence at ≥1.5 m higher, +5 Attack downhill, −10 through cover or smoke.
  - `missileRange` in `abilities.js`: ×1.2 range downhill.
  - `squadModifiers` in `squads.js`: wall −2, high −1, ranged cover −1, height +1, `chargeReady`, braced counter.
  - `navigation.js` keeps one height per 0.5 m cell (`high` = 1.6 m), with no step limit; `wall` cells are solid.
- **Field objects already rewrite the map:** `openGate` and `repairBridge` call `setCells` and then `invalidateGrid`. Structure changes reuse this; add `patchGrid` for changed cells only, tested equal to a full rebuild.
- **The 0.38 encounter record cannot change shape.** `validateEncounter` allows only 8×8 or 10×8 and the old terrain list. Structures must therefore be a real-time layer:
  - applied in `createEncounterWorld`, `calibrate` and `createCampWorld`;
  - defined as data in `src/data/structures.js` (kinds) and `src/data/battle-structures.js` (per battle, on the 0.38 tile map).
  - A 0.38 wall tile is cover you stand on (−2); a rampart restores that meaning.
- **Saves and determinism:**
  - `restoreWorld` refuses any other `WORLD_VERSION`. A bump means a saved fight restarts from its checkpoint, as `restartInRealtime` does.
  - Operations v1/v2 are frozen contracts; new missions are an operation v3 (`src/data/realtime-operations.js`).
- **Training points:** `tpAuditChapter` already sums `ERRANDS` by chapter and path, so new errands flow into the ceiling and the 0.38 adoption grant. Chronicles adopted earlier need a one-time top-up recorded as `soldier.audit: 2`.
- **Crowds:** `createSkinnedCrowd` (`formation.js`) already instances overview bodies with pose history; use it for the finale.
- **Portraits:** eight named characters already have portraits in `assets/portraits/`, usable as image-to-3D references for heads.
- **Battle variety (release 3):**
  - `world` stream at creation: band and squad temperaments; field-object places from the top four `reserve` candidates; hidden-band spots, wave entries and weather within the chapter's set.
  - `ai` stream at decisions: `planDoctrine` among fix, flank left, flank right, pincer, feint, early or late reserve, each kept for at least two rounds; per-enemy target preferences.
  - `combat` stream: squad-exchange spread ×0.75/0.9/1/1.1/1.25, weighted 1:2:4:2:1 (mean 1); `squadModifiers` stays deterministic.
  - **Band morale:**
    - Start at 80; a member falls −48 ÷ size (−8 more from ambush); the leader falls −15; outnumbered 2:1 at a round's end −5; reinforcements +15; a round out of contact +10.
    - At ≤40 the band is shaken; at ≤20 it breaks and flees.
    - Fled men earn no kill training points and count as gone for objectives.
  - **Squad sight** (`squad-sight.js`): one notice meter per hostile at 4 Hz. An unnoticed first exchange counts as a whole hit, doubles the morale loss and ignores brace and shield wall; the player gets a `lie_in_wait` order.
  - `WORLD_VERSION` 3.
  - **Sweep targets:**
    - Story: every battle won on the first try.
    - Standard: ≥90% won on the first try, 100% within two tries.
    - Veteran: ≥70% won on the first try, 100% within three tries.
    - At least 3 different enemy plans per battle across seeds.
    - The finale lasts 8–12 of its 16 rounds.
    - Simulation tick p95 rises by at most 0.3 ms.
- **Structure rules (release 4):**
  - Heights: ramparts 3 m, towers 6 m, ladders 1.5 m (×0.3 speed), bridge decks 0.8 m.
  - A step over 1.7 m is impassable; melee needs a height difference of 1.7 m or less.
  - A battlement gives missile cover against attackers below, and a squad on it takes −2 (the 0.38 wall-tile parity case). A tower adds 15 m of sight and holds one squad.
  - A gate has 100 integrity: a ram does 8 per second, barring it adds 20, and at 0 it becomes a breach (×0.6 speed, no charge or cover).
  - Ladders are pushed off with 2 s of work. A squad on a bridge marches in column; demolition takes 6 s.
- **Missions (release 7):**
  - ch1-road: signal, then intercept.
  - ch2-rearguard: ambush in the reeds.
  - Chapter IV: gate and ladder defence.
  - Chapter V: sally against the mine.
  - ch6-eagle: pursuit by Persian horse.
  - ch7-legion: cavalry battle at Milan.
  - ch8-crossing: demolish the crossing.
  - ch9-wing: lure, after Immae.
  - ch9-city: storm the gate.
  - ch10-road: moving convoy.
  - Chapter XII: storm the walls.
  - Target: escort or hold is the main objective in at most 6 of 18 battles.
- **Shader programs:** 46–56 today. A model-material normaliser (one opaque and one cut-out program for all imported art) and a program-count test keep them within the budget.

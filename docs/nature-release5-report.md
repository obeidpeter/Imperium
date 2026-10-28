# Worlds and gameplay, release 5: nature and water, modelled

Release 5 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md) models the regions' nature on Balanced and High. Trees come from three kits built in Blender, one for each group of chapters that plants the same species, each tree with a near, a middle and a distant version. The field's stones are twelve rocks generated with Tripo, four for each region. Grass, flowers, scrub, reeds and grain grow thicker round the point the camera looks at, and mist lies over water at dawn, at night and in rain or mist. On every quality, Performance included, the water gains depth colour, foam at its edges and wet banks. Performance keeps the code-built trees, stones and grass, and the rules are unchanged. This report records what changed, how it was checked and what was not checked. The [changelog](../CHANGELOG.md) describes the changes for players, and the [art record](art-generation.md#regional-trees-and-rocks--28-october-2026) the models' sources, prompts and sizes.

How each kind of check was made:

- **Automated tests** (Node.js): `npm test`. New: `tree-kit` (where the kit's trees stand, their clearances, their levels and their shader program), `rock-kit` (the rocks' fit and levels, and the stone's program), `ground-cover` (where it grows, its materials, and how it follows the view) and `water-mist` (the mist banks and the distant river's foam); `terrain-splat` gains the wet banks, and `scenery-models` the kits in each chapter's working set. The determinism tests A1–A4 run as before.
- **Sweeps** (Node.js, headless, on the development container): the release 3 bot plays the campaign from New Game, every battle by legal Commands, on 20 campaign seeds on each difficulty, and on Standard twice on main and twice on this release. A bot is not a player (see [Limitations](#limitations)).
- **The real interface:** the production build in headless Chromium with software rendering (SwiftShader). A scratch probe restored 18 real-time battles from legal checkpoints through the Restore dialog, on main and on this release, and counted the shader programs each compiled over the three cameras. The stage benchmark measured the twelve chapters' turn-based stages on both qualities on this release, and the siege check (`npm run smoke:siege -- --fortified`) opened every fortified battle on Balanced. Before-and-after renders of six battles, from main and from this release with the same cameras, were sent to the owner, and made again after the trees were revised (see [Revised after the renders](#revised-after-the-renders)); the stage benchmark ran again on the revised trees. The scratch scripts are not committed. The twelve camps' check (`npm run smoke:world`), whose expectations now count each region's kits, and the other browser checks run in CI on the pull request; the camps' check was not run locally.
- **Not performed:** a person playing with the new scenery, and any check on a phone, a laptop or with a screen reader.

## What changed

| Change | Where it shows | Code and data | Randomness |
| --- | --- | --- | --- |
| Trees, modelled | Every tree the world plants on Balanced and High is drawn from its region's kit: oak, beech, willow, alder, pine and fir on the Danube and in the Balkans (Chapters I–IV, VIII, X); poplar, cypress, umbrella pine and olive in Italy (VII, XI, XII); date palm and tamarisk in the east (V, VI, IX). A tree shows its near version within 30 m of the camera, its middle version within 150 m and two crossed cards beyond. Each keeps its plan's height and turn, and its crown is drawn in where it would spread past the clearance its plan kept from the cameras and the board. | `tree-kit.js`, `tree-kit-components.js`, `environment-foliage.js`; `build-trees.py` | none |
| Stones, modelled | The field's stones are drawn from the region's four rocks, each the stone's seed's choice, turned by it and scaled to fit the footprint and height of the code-built stone it replaces. A rock cell holds a boulder and one smaller rock instead of four noise stones, and a plateau's rim every other stone, so a field's triangles stay close to main's. A rock shows its near version within 18 m of the camera. | `rock-kit.js`, `rock-kit-components.js`, `environment.js`, `environment-campaign-terrain.js`; `build-rock-kits.py` | none |
| Ground cover round the view | Grass tufts, flowers, low scrub, reeds by the water and rows of grain grow in 4 m patches within 26 m of the point the camera looks at (34 m on High), shrinking away over the last 6 m, and are laid again as the view moves, at most twelve patches a frame. On the board they keep to open ground (grass, high ground, hills, camp ground), short and sparse, so its cells read as before; reeds keep to the water's edge, and grain to the farmed land beyond the board in Chapters III, IV, VII and X–XII. None indoors or on Performance. | `ground-cover.js`, `environment.js` | none |
| Water | On every quality, a marsh shows its depth, its shallow rim muddy and its open pools dark, with scum gathering at its edge instead of the regular stripes it had; the distant river foams along its two banks instead; and the ground within a metre and a half of the board's water is wet. On Balanced and High, mist banks lie over the board's river, ford and marsh and over the distant river at dawn, at night and in rain or mist. High keeps the water's mirror. | `environment-surface-shaders.js`, `environment-materials.js`, `terrain-splat.js`, `water-mist.js`, `stage.js` | none |
| Downloads | Each chapter's pack holds its region's tree and rock kits, and the loading veil fetches them with the chapter's other scenery. | `world-catalog.js`, `scenery-models.js` | none |

None of this draws from a random stream or changes the encounter: every placement comes from the world's own plans and from position hashes, the same battle gives the same trees, rocks and plants, and the rules are untouched (tests A1–A4, and the sweeps below, which play exactly as on main).

## The models

The [art record](art-generation.md#regional-trees-and-rocks--28-october-2026) gives each kit's sources, triangles and sizes, and [the asset pipeline](asset-pipeline.md#trees-and-rocks--2026-10-28) how they are built, placed and loaded. In short:

- **Trees.** [`build-trees.py`](../scripts/assets/build-trees.py) builds three kits in Blender: six species for the Danube and the Balkans, four for Italy and two for the east. Each species is built near (944–4,352 triangles), middle (300–896) and as an impostor of two crossed cards (4), all in one 1,024-pixel atlas per kit. The bark is six CC0 Poly Haven sets; the leaf cards are composed by the script from the leaf and twig textures of six CC0 Poly Haven plant models (their colour and alpha maps only) and, for oak, willow and the date palm, the game's own foliage atlas. The impostors are rendered from the near trees in Cycles.
- **Rocks.** Twelve Tripo text-to-model rocks, four for each region (240 credits; the balance read 3,760 before and 3,520 after), processed to 2,000 triangles and 512-pixel textures (the sandstone kept 2,486 and the temperate outcrop 2,935), each with a far version of 194–678 triangles. The ledger is [`worlds-plan-credits.json`](../art-source/models/worlds-plan-credits.json); each rock's prompt, task and digests are in its request file.
- **Budgets.** Each runtime file passes `check-model` within 700,000 bytes, 20,000 triangles and 1,024-pixel textures: the tree kits are 594,256, 356,280 and 165,436 bytes, the rock kits 566,552, 528,780 and 505,740.
- **Fallback.** On Performance, when a kit has not arrived as the world is built, or when it fails, the code-built trees and stones stand in, and the two never mix in one world.

### Revised after the renders

The before-and-after renders, sent to the owner, showed three weaknesses beside main's code-built trees. All three were fixed before the pull request, and the six battles were rendered again:

- **Date palms.** Their crowns were sparse. Each frond is now folded into a V along its rachis, 34 to a crown (944 triangles near, up from 416). The game's palm cell draws its frond along the cell's diagonal, so the leaflets had filled only a third of each frond's card; the card now stretches the frond 1.8 times across to fill it.
- **Willows.** They were bare and coarse at close range. They now have thinner boughs and more, longer hanging cards, and the cards carry the game's own willow strands, as the code-built willow does, in place of a card composed from a CC0 shrub's leaves. Their twigs are no longer drawn as tubes, which showed as dark sticks above the crown, since the cards paint their own; a willow keeps its 2,056 triangles near.
- **Impostors.** From the overview and horizon cameras, the two crossed cards of the far version read as an X. The middle version now shows out to 150 m instead of 70 m. A field plants only a dozen or so trees, so the cost in triangles is small (see [the turn-based stages](#the-turn-based-stages)).

The other species were rebuilt unchanged.

### Against the plan

- **Leaf textures.** The plan named CC0 bark and leaf textures. The bark is CC0; no CC0 cut-out leaf set could be reached from the development container (its network policy refuses ambientCG's download hosts, and Poly Haven's leaf textures show leaves lying on the ground), so the leaf cards are composed from the leaf textures Poly Haven publishes with its CC0 plant models, and the oak, willow and date palm use the game's own generated foliage atlas.
- **Three levels.** The near and middle versions are modelled; the third level is the impostor, so there are three levels in all, as the plan asked, of which the farthest is two cards.
- **Rocks' far versions.** Decimation keeps the texture's seams, so a rock's far version keeps 194–678 triangles rather than a tenth of its near one. A rock cell therefore holds two kit rocks instead of four stones, and a plateau's rim half its stones, which keeps each turn-based field's triangles within 6.5% of main's (see [the turn-based stages](#the-turn-based-stages)).
- **Ground cover** grows round the point the camera looks at rather than across the whole field, and stays short and sparse on the board, which must stay readable.
- **Fords.** The board's river and its fords already showed their depth and foamed at their shores before this release, so the depth colour and edge foam are new on the marshes and the distant river.
- **Mist banks** are the weather's own soft particles, bounded to the water, not a volumetric fog.

## Downloads

Gzip sizes from the build report (the sum of each set's files, the service worker included; not a browser's network trace):

| Download | Limit | Main | This release |
| --- | ---: | ---: | ---: |
| First load | 2 MB | 0.88 MB | 0.88 MB |
| Chapter I in 3D | 16 MB | 10.11 MB | 11.16 MB |
| The largest chapter, with its 2D art | 24 MB | 15.09 MB (V) | 15.82 MB (VIII) |
| The complete campaign | 80 MB | 31.92 MB | 34.40 MB |

The six kits are 2.46 MB together. Each chapter's pack holds only its own region's two: 1.04 MB for the Danube and Balkan chapters (I–IV, VIII, X), 0.80 MB for the Italian (VII, XI, XII) and 0.62 MB for the eastern (V, VI, IX). With the release's code, those packs grow by 1.05, 0.82 and 0.63 MB in 3D. Chapter V in 3D is now 13.52 MB, the largest in 3D.

## Shader programs

Every new surface is drawn in a program the world already compiles. The kit trees are made as the leaf sprays are (`kitMaterial` in `environment-materials.js`: the same maps, flags and finish, with the kit's atlas), so they share their program and their wind; the kit rocks are made as the field's stone; the ground cover is drawn in the meadow's own grass, dry grass and spray materials; and each mist bank is a cloud of the weather's mist particles. The water's new depth colour and foam change existing programs, not their number.

### Real-time battles, Balanced

Programs after touring the follow, overview and horizon cameras, from a scratch probe that restores each battle from a legal checkpoint through the Restore dialog, on main and on this release in turn. The other columns are this release's world: the trees planted from the kit, the rocks placed from it, and the mist banks over its water in the battle's weather and hour.

| Battle | Programs, main → this release | Kit trees | Kit rocks | Mist banks |
| --- | ---: | ---: | ---: | ---: |
| I, the road | 38 → 38 | 6 | 208 | 1 |
| II, the marsh | 40 → 40 | 12 | 2 | 2 |
| II, the rearguard | 41 → 41 | 12 | 54 | 2 |
| III, the station | 36 → 36 | 9 | 200 | 0 |
| III, the rolls | 37 → 37 | 9 | 192 | 0 |
| IV, the gate | 43 → 43 | 7 | 0 | 1 |
| IV, the wall | 43 → 43 | 5 | 256 | 0 |
| V, the mine | 43 → 43 | 6 | 348 | 0 |
| V, the wall | 43 → 43 | 6 | 256 | 0 |
| VI, the wells | 43 → 43 | 6 | 216 | 0 |
| VI, the eagle | 41 → 41 | 6 | 168 | 0 |
| VII, the legion | 47 → 47 | 11 | 248 | 0 |
| VIII, the ferry | 46 → 46 | 11 | 272 | 2 |
| VIII, the crossing | 46 → 46 | 10 | 304 | 2 |
| IX, the wing | 49 → 49 | 8 | 324 | 0 |
| IX, the city | 49 → 49 | 8 | 236 | 0 |
| X, the road | 43 → 43 | 9 | 32 | 0 |
| XII, the confrontation | 50 → 50 | 9 | 156 | 0 |

Every battle compiles exactly the programs it did on main; the finale's 50 is still the limit itself. The probe ran before the trees were revised; the six battles rendered again after the revision compiled the same programs (Chapters II, IV, V, VII, VIII and XII: 40, 43, 43, 47, 46 and 50). The siege check (`npm run smoke:siege -- --fortified`, [report](evidence/siege-fortified-release5.json)) counts the same programs in the ten battles with authored structures, and finds the board kit drawn with the camera cutaway in each, as at release 4.

### The turn-based stages

The stage benchmark (`npm run benchmark:stage -- --dist --check --max-programs 50`), the still overview of each chapter's turn-based battle, on this release ([report](evidence/stage-benchmark-release5.json)). Main's counts are those recorded at release 4 (`scripts/stage-ceilings.json`): its one later change, the mudbrick re-bake, changed textures only, in a board kit that draws only in real time. On Performance every count (programs, draw calls, triangles) equals main's in all twelve stages. On Balanced:

| Battle | Programs | Draw calls | Triangles | Textures and geometry |
| --- | ---: | ---: | ---: | ---: |
| I, the road | 39 → 39 | 83 → 95 | 338,205 → 359,150 | 54.2 → 59.5 MB |
| II, the marsh | 42 → 42 | 88 → 100 | 344,253 → 342,713 | 61.8 → 67.0 MB |
| III, the station | 39 → 39 | 84 → 95 | 387,532 → 408,960 | 50.3 → 55.8 MB |
| IV, the gate | 44 → 44 | 115 → 126 | 515,967 → 530,748 | 64.3 → 69.9 MB |
| V, the mine | 44 → 44 | 150 → 158 | 460,445 → 467,760 | 82.7 → 88.1 MB |
| VI, the wells | 44 → 44 | 127 → 135 | 377,108 → 388,799 | 80.2 → 85.4 MB |
| VII, the legion | 43 → 43 | 135 → 144 | 583,405 → 621,104 | 73.1 → 78.6 MB |
| VIII, the ferry | 48 → 48 | 133 → 144 | 601,239 → 597,665 | 74.1 → 79.4 MB |
| IX, the wing | 43 → 43 | 137 → 145 | 474,032 → 485,957 | 80.3 → 85.7 MB |
| X, the road | 46 → 46 | 138 → 154 | 561,864 → 576,399 | 67.5 → 73.2 MB |
| XI, the accounts | 45 → 45 | 123 → 123 | 248,992 → 248,992 | 81.5 → 81.5 MB |
| XII, the confrontation | 46 → 46 | 144 → 154 | 772,721 → 805,715 | 66.1 → 71.7 MB |

No stage compiled a program in its first frame or after it was shown. The draw calls rise by 8 to 16 in every field: the ground cover draws one batch for each kind of plant in view, the tree and rock kits one for each species or rock and level in view, and a mist bank lies over water at dawn, at night and in mist or rain. The council chamber of Chapter XI has none of them. The kits' textures and geometry, with the ground cover's, add 5.2–5.7 MB to each field's estimated memory. Chapters I, II, III and X went above their recorded draw-call ceilings, so the Balanced ceilings were written again from this run, on purpose; the Performance ceilings stand. Chapters V and XII, the two that CI checks against the ceilings, were within them before they were written again.

## Calibration

The sweeps ([Story](evidence/realtime-release5-sweep-story.json), [Standard](evidence/realtime-release5-sweep-standard.json), [Veteran](evidence/realtime-release5-sweep-veteran.json)) play as at release 4. Each plays the seed's campaign from New Game in three passes: each chapter's first decision; the decisions that change a field the other way; and every finale route from the seed's Chapter XII camp. A lost battle is retried from its checkpoint by the legal Retry command, up to once on Story, twice on Standard and three times on Veteran.

### Against the plan's targets

Each target counts the 13 battles of pass 1 and the 5 finale routes of pass 3 on each of 20 seeds: 360 battles a level.

| Target | Story | Standard | Veteran |
| --- | --- | --- | --- |
| Won on the first try: Story every one, Standard ≥ 90%, Veteran ≥ 70% | 360 of 360 | 360 of 360 | 359 of 360 |
| Won within the tries allowed (one, two, three) | 360 of 360 | 360 of 360 | 360 of 360 |
| At least three enemy plans in each battle across the seeds | every battle | every battle | every battle |
| The finale's battle lasts 8–12 of its 16 rounds | 10 rounds | 8 rounds | 8 rounds |
| The simulation's tick rises by at most 0.3 ms at p95 | see [Tick time](#tick-time) | | |

Every battle and finale route on all three levels, retries included, played exactly as in [release 4's sweeps](fortifications-release4-report.md#calibration). Results, rounds, slack, losses, plans, hidden squads and ambushes were the same, and only the tick times differ. The battle-by-battle figures are therefore [release 4's](fortifications-release4-report.md#battle-by-battle). Veteran's one first-try loss is the same one: Chapter VI's wells on seed 15, where a protected column was lost in round 4 and the retry won.

### Compared with main

Main (`0469ec6`, with the mudbrick re-baked) and this release were swept on the same 20 seeds on Standard, with the same bot. The four runs went one after the other with nothing else running, main and this release twice each. Every battle and route played identically in all four. That is expected: no file under `src/core/` changed, and the scenery is presentation only.

### Tick time

The simulation's tick at p95, as the mean of the two runs on each side:

| Battle | Main | This release | Change |
| --- | ---: | ---: | ---: |
| IV, the gate | 0.70 ms | 0.76 ms | +0.07 |
| IV, the wall | 0.85 ms | 0.90 ms | +0.05 |
| V, the mine | 0.98 ms | 1.22 ms | +0.24 |
| V, the wall | 0.90 ms | 0.93 ms | +0.03 |
| VI, the wells | 1.02 ms | 1.04 ms | +0.02 |
| VI, the eagle | 0.93 ms | 1.01 ms | +0.08 |
| VII, the legion | 1.38 ms | 1.41 ms | +0.03 |
| VIII, the ferry | 1.48 ms | 1.44 ms | −0.03 |
| VIII, the crossing | 1.29 ms | 1.41 ms | +0.11 |
| IX, the wing | 1.15 ms | 1.15 ms | +0.00 |
| IX, the city | 1.33 ms | 1.37 ms | +0.04 |
| X, the road | 1.33 ms | 1.45 ms | +0.12 |
| XII, the confrontation | 1.75 ms | 1.81 ms | +0.06 |

The largest rise is at Chapter V's mine: 0.24 ms, seen in both pairs of runs and within the plan's 0.3 ms. The simulation runs the same code on both sides, so these differences come from run-to-run variation on the container.

The container was about twice as slow as at release 4. Each Standard sweep took 563–613 s, against 287–293 s then on the same seeds, so today's times compare only with each other. The sweep's own tick line compares each battle with the Gate 4 sweep, which was recorded on a faster container. It reports NOT MET on main's two runs (+0.62 and +0.80 ms) as on this release's two, and it is not the plan's measure.

The Story and Veteran sweeps ran together on the container's four cores. Their tick times are not comparable and are not counted here. None of these times is a phone's: the budget there is 4 ms at p95 on a 2022 phone, and no phone has been measured.

## Limitations

- **A late kit waits.** As with the board kit, the tree and rock kits are used only if they have arrived when the world is built. Two cases keep the code-built trees and stones until the world is next built, normally the next encounter:
  - a battle or camp whose download is slower than the loading veil's wait;
  - a battle or camp switched from Performance to Balanced in play.
- **The ground cover follows the view.** It grows round the point the camera looks at. From the overview and horizon cameras, the far fields show the meadow's own sparser grass, as before. The grain grows only beyond the board, so it shows only when the view is near the field's edge.
- **Software rendering.** Programs, draw calls and triangles are counts, which depend little on the device. The times in these checks are SwiftShader's and say nothing of a phone's or a laptop's frame rate. The plan's device targets have not been measured: 30 fps on mid-range phones on Performance, and 60 fps on integrated-graphics laptops on Balanced.
- **Blank frames in the renders.** Four of the scratch captures came out in the fog's colour, with only the labels and the board's outline drawn: Chapter XII's overview twice from this release, and Chapter XII's overview and Chapter VIII's horizon from main. The same views rendered normally on other passes, on main as on this release, and Chapter XII's overview did so once the capture waited twelve frames after the camera's change instead of three. This points to a moment just after the camera changes rather than to the scenery. The cause was not found, and it is not known whether a player could ever see such a frame.
- **A bot is not a player.** The sweeps check that the rules are untouched; they do not look at the scenery. How the new trees, rocks and cover read in play is for the plan's Gate 4 play-through.
- **Not checked:**
  - a person playing with the new scenery;
  - the kits on a phone, a laptop or with a screen reader;
  - the camps and battles on High beyond the automated tests.

# Worlds and gameplay, release 4: fortifications, modelled

Release 4 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md) models the real-time battles' structures and gives them rules of their own. Walls, towers, gates, breaches, bridges and ramparts are drawn from a board kit built in Blender, and stand where each battle's history puts them. Towers see and shoot farther, gates can be barred and battered down, ramparts stand behind ditches, bridges can be demolished, and forecasts name the structure that gives a modifier. The shader programs a battle compiles were cut to make room: every battle now keeps to the plan's 50 on Balanced. This report records what changed, how it was checked and what was not checked. The [changelog](../CHANGELOG.md) describes the changes for players, and the [player guide](player-guide-0.40.md) is the rules' reference.

How each kind of check was made:

- **Automated tests** (Node.js): `npm test`. New: `realtime-structures` (each new rule, on battles reached by legal commands), `board-kit` (where the pieces stand, the bake, the cutaway) and the world version test; the determinism tests A1–A4 run as before.
- **Sweeps** (Node.js, headless, on the development container): the release 3 bot plays the campaign from New Game, every battle by legal Commands, on 20 campaign seeds on each difficulty. A bot is not a player (see [Limitations](#limitations)).
- **The real interface:** the production build in headless Chromium with software rendering (SwiftShader). The siege check (`npm run smoke:siege`) now opens Palmyra's walls on Balanced as well; `npm run smoke:siege -- --fortified` opens every fortified battle on Balanced; the stage benchmark measures the twelve chapters' turn-based stages on both qualities. Before-and-after renders of six battles, from main and from this release with the same cameras, were sent to the owner; the scratch script that made them, restoring legal checkpoints through the Restore dialog, is not committed.
- **Not performed:** a person playing the new battles, and any check on a phone, a laptop or with a screen reader.

## What changed

| Change | Rules | Code and data | Randomness |
| --- | --- | --- | --- |
| Structures per battle | Each fortified battle has its towers, ramparts, ditches, weakened stretch and held gates where its history puts them: Chapter IV's ditched gateway with a tower each side of the gap; towers flanking the gap in Chapter V's fortress; Chapter VIII's bridgehead rampart; two towers, a weakened stretch and barred gates at Palmyra (Chapter IX) and Rome (Chapter XII). Fields whose history gives no tower have none: #32's fighting platform beside the wall nearest the soldier is no longer added. | `battle-structures.js`; `fortifications.js` (record version 2) | none |
| Towers | A wall end becomes a deck 3.2 m up, with its stair 1.6 m up on the holders' side. From the deck a man sees 15 m farther and his missiles reach three tenths farther (a fifth from other high ground). Its masonry stops missiles shot past it from below. | `fortifications.js`, `sight.js`, `ai.js`, `abilities.js`, `combat.js`; `STRUCTURES.tower` | none |
| Gates | A fortified gate has 100 integrity. Closing it bars it for the closer's side, at 120. A gate barred against you cannot be opened: each work action batters it for 15, or 30 with a friendly engineer detail within 8 m as the ram. At 0 it is a breach: rubble, slower ground, open to both armies. The enemy holds Palmyra's and Rome's gates barred. | `fortifications.js`, `field-objects.js`; `STRUCTURES.gate` | none |
| Ramparts and ditches | A rampart is a bank 1.2 m high with a breastwork on its face, behind a ditch 0.4 m deep that halves speed and breaks a charge; a road crosses on a causeway. A man on the rampart holds higher ground; missiles from beyond its face lose 10; a squad behind it takes 2 less in each exchange. | `fortifications.js`, `squads.js`, `combat.js`; `STRUCTURES.rampart`, `STRUCTURES.ditch`, `MOVEMENT.terrain.ditch` | none |
| Bridge demolition | Forced work (Shift) on a repaired bridge of a fortified field: two work actions, one with engineers near, each twice as long as ordinary work. The crossing becomes deep water. | `field-objects.js`, `fortifications.js`, `intents.js`, `actions.js` | none |
| Forecasts | Modifiers name their structure: From the tower, He holds the tower, Behind the tower, Behind the wall, He holds the rampart, Behind the rampart. | `combat.js`, `squads.js` | none |
| Rain on slopes | The real-time map now keeps the weather's slope cost, which it had dropped: in rain, climbing is slower in real time too, as the guide says. | `simulation.js` | none |
| Saves | Real-time fights record world version 5, and the fortification record is checked strictly when a save loads. A fight saved by an earlier version restarts from its checkpoint when the chronicle loads, as Retry checkpoint would. | `simulation.js`, `validate.js`, `fortifications.js` | none |

None of these rules draws from a random stream, and presentation draws nothing: the same seed gives the same battle, and a reloaded fight plays on exactly as before (tests A1–A4, `realtime-world-version`).

## The board kit

[`build-board-kit.py`](../scripts/assets/build-board-kit.py) builds three kits in Blender, stone, mudbrick and timber, each of the same fourteen pieces with a simpler far level for every one. The [art record](art-generation.md#fortification-board-kits--27-october-2026) gives their sizes, triangles and sources, and [the asset pipeline](asset-pipeline.md#the-board-kit--2026-10-27) how they are placed, drawn and loaded. In short:

- **Placement.** [`structure-registry.js`](../src/showcase/structure-registry.js) reads the stage's copy of the battle and places one piece on each structure cell. A test plays the campaign by legal commands to every fortified battle and checks that each wall cell has its curtain, each deck its tower and stair, and that no solid piece stands where the rules let a man walk. Another checks that a tower's top is the rules' deck height and a bridge is walked at its deck.
- **Drawing.** One instanced draw per piece and level: near within 36 m of the camera, far beyond. The camera cutaway covers every piece (tested in Node and checked in the browser), and the pieces' lasting parts shade the ground in the occlusion bake as the code-built curtains did: at the curtains' feet the ground's sky visibility is 0.52–0.53 with the kit and 0.57–0.60 with the code-built walls, the kit's crenellated tops standing taller.
- **Fallback.** On Performance, when the kit has not arrived as the world is built, or when it fails, the code-built works stand in, and the two never mix. Those code-built curtains now stand at full height (3.2 m, 2.5 m in timber): they had been drawn as low breastworks, because the environment's copy of the battle lacked the fortification record.
- **Downloads.** The three kits add 963,876 bytes, and each chapter's pack holds only its own kit (308–332 KB): Chapter IV the timber, V, VI and IX the mudbrick, VIII and XII the stone. Every pack stays within its limits (see [Downloads](#downloads)).

### Against the plan

- **Corners and ends.** The plan named curtain runs, corners and ends. One curtain block fills a whole cell and joins its neighbours on every side, so a single piece serves all three.
- **Palisades.** The timber family's curtain is its palisade; the rampart breastwork is a separate wattle piece.
- **Trim sheets.** Each material (masonry, timber, iron) has one tileable set of colour, roughness-metalness and normal maps, not a trim sheet shared across pieces.
- **Size.** About a third of a megabyte per family, well under the plan's estimate of 1–1.5 MB. ETC1S keeps the colour maps close to their source (43 dB) but the normal maps only at 25–27 dB, so their fine relief is blocky up close.
- **The regional kits' pieces** were not joined to the registry. Their gates, bridges and walls are sized for camp and skyline scenery, not the board's 2.5 m cells; the board kit has its own.

## Shader programs

three.js compiles one shader program for each combination of maps and flags a material needs, and a battle's programs are compiled before it is shown. On main every fortified real-time battle needed 52–63 programs on Balanced, and most turn-based stages more than 50. Materials now share programs wherever the look allows it:

- [`model-materials.js`](../src/showcase/model-materials.js) gives every opaque material of imported art (the kits, Chapter V's fortress, the regional kits, the Tripo props) the same maps and flags, with neutral 1×1 textures where a model has none and both sides drawn, its shadow still cast from the side it was.
- The environment's unfinished props (cloth, rope, ironwork, roof tiles) join that program; the fieldwork takes neutral maps to join the textured stone and timber; every instanced scenery batch and the kit's pieces carry an instance colour, white where none was given.
- A figure's opaque surfaces missing some of the four maps take neutral ones; the far figures' own copies are lit as the overview material is (a copy keeps its source's flags but not its shader hooks, so they had lost their cloud shadows); the fallen are drawn from both sides like the arrows among them; the flat foot markers carry normals their unlit material ignores; and a real-time field no longer warms up the turns' fieldwork, which only a turn command builds.

Neutral textures multiply a material's own values by one and a flat normal map keeps the vertex normal, so the look is unchanged by design, with two exceptions: an imported surface drawn from one side before can now be seen from behind where nothing hides its back, and the far figures now darken under passing cloud, as the near ones always did.

### Real-time battles, Balanced, with the board kit

Programs after touring the follow, overview and horizon cameras (`npm run smoke:siege -- --fortified`, [report](evidence/siege-fortified-release4.json)). Main's were counted by the before-and-after renders, which tour the same cameras in the same battles; on this release the two methods agree in all seven battles they share. The kit's pieces are counted as drawn after the tour: the kinds of piece, and their instances, one for each mesh of each placed piece.

| Battle | Kit | Programs, main → this release | Kinds of piece | Instances | Kit materials with the cutaway |
| --- | --- | ---: | ---: | ---: | ---: |
| IV, the gate | timber | 52 → 43 | 3 | 28 | 3 of 3 |
| IV, the wall | timber | 52 → 43 | 1 | 72 | 2 of 2 |
| V, the mine | mudbrick | 52 → 43 | 6 | 54 | 3 of 3 |
| V, the wall | mudbrick | 52 → 43 | 6 | 61 | 3 of 3 |
| VI, the wells | mudbrick | 53 → 43 | 1 | 10 | 1 of 1 |
| VIII, the ferry | stone | 57 → 46 | 4 | 9 | 3 of 3 |
| VIII, the crossing | stone | 57 → 46 | 5 | 23 | 3 of 3 |
| IX, the wing | mudbrick | 60 → 49 | 4 | 10 | 3 of 3 |
| IX, the city | mudbrick | 60 → 49 | 7 | 43 | 3 of 3 |
| XII, the confrontation | stone | 63 → 50 | 7 | 21 | 3 of 3 |

The finale's 50 is the limit itself: a later release that adds a program to it must first free one.

### The turn-based stages

The stage benchmark (`npm run benchmark:stage -- --dist --check --max-programs 50`), the still overview of each chapter's turn-based battle. "Before" was measured at the start of this release, with main's materials, on the same container ([report](evidence/stage-benchmark-release4.json)):

| Battle | Performance | Balanced |
| --- | ---: | ---: |
| I, the road | 42 → 36 | 49 → 39 |
| II, the marsh | 44 → 38 | 52 → 42 |
| III, the station | 42 → 36 | 49 → 39 |
| IV, the gate | 46 → 41 | 52 → 44 |
| V, the mine | 47 → 42 | 52 → 44 |
| VI, the wells | 46 → 40 | 53 → 44 |
| VII, the legion | 47 → 40 | 54 → 43 |
| VIII, the ferry | 49 → 43 | 57 → 48 |
| IX, the wing | 46 → 40 | 52 → 43 |
| X, the road | 48 → 42 | 55 → 46 |
| XI, the accounts | 50 → 43 | 54 → 45 |
| XII, the confrontation | 47 → 42 | 54 → 46 |

Draw calls and triangles are the same as before in all 24 runs, and no stage compiled a program in its first frame or after it was shown.

CI now fails the stage benchmark on more than 50 programs (`--max-programs 50`, Chapters V and XII) as well as on its recorded ceilings. Those were written again from this run on purpose (`--write-ceilings`): the program ceilings fall by 4 to 10, and the draw-call and triangle ceilings, last recorded on 24 October before the campaign world upgrade added scenery, are recorded anew. Chapters II and VI, which CI does not check, were already above them. The siege check fails if Palmyra's walls on Balanced need more than 50 programs, if the kit does not draw them, or if any kit piece misses the camera cutaway.

## Calibration

The sweeps ([Story](evidence/realtime-release4-sweep-story.json), [Standard](evidence/realtime-release4-sweep-standard.json), [Veteran](evidence/realtime-release4-sweep-veteran.json)) play each seed's campaign from New Game in release 3's three passes: each chapter's first decision; the decisions that change a field the other way; and every finale route from each seed's Chapter XII camp. A lost battle is retried from its checkpoint, by the legal Retry command, up to once on Story, twice on Standard and three times on Veteran.

### Against the plan's targets

Each target counts the 13 battles of pass 1 and the 5 finale routes of pass 3 on each of 20 seeds: 360 battles a level.

| Target | Story | Standard | Veteran |
| --- | --- | --- | --- |
| Won on the first try: Story every one, Standard ≥ 90%, Veteran ≥ 70% | 360 of 360 | 360 of 360 | 359 of 360 |
| Won within the tries allowed (one, two, three) | 360 of 360 | 360 of 360 | 360 of 360 |
| At least three enemy plans in each battle across the seeds | every battle | every battle | every battle |
| The finale's battle lasts 8–12 of its 16 rounds | 10 rounds | 8 rounds | 8 rounds |
| The simulation's tick rises by at most 0.3 ms at p95 | see [Tick time](#tick-time) | | |

Pass 2's 260 battles a level were all won on the first try. Veteran's one first-try loss is Chapter VI's wells on seed 15, a protected column lost in round 4 and won on the retry. The same seed lost the same battle the same way in the last recorded sweep of main ([release 3's re-check](evidence/realtime-release3-recheck-sweep-veteran.json)), so it predates this release.

### Battle by battle

Each cell gives Story · Standard · Veteran, on the first try of pass 1 (20 seeds); the columns are release 3's.

| Battle | Deadline | Rounds, median/most | Least slack | Loss, median | Plans | Hidden | Squad ambushes, theirs:ours |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IV, the gate | 19 · 16 · 14 | 5/6 · 7/8 · 7/8 | 13 · 8 · 6 | 49% · 76% · 82% | 5 | 0 · 9 · 16 | 0:39 · 0:0 · 0:0 |
| IV, the wall | 15 · 12 · 10 | 6/9 · 6/9 · 6/9 | 6 · 3 · 1 | 45% · 45% · 45% | 4 | 0 · 0 · 0 | 20:28 · 20:20 · 20:18 |
| V, the mine | 19 · 16 · 14 | 7/8 · 8/9 · 8/9 | 11 · 7 · 5 | 46% · 55% · 61% | 6 | 0 · 0 · 0 | 14:47 · 15:25 · 18:2 |
| V, the wall | 16 · 13 · 11 | 8/9 · 9/9 · 9/10 | 7 · 4 · 1 | 58% · 70% · 84% | 6 | 0 · 0 · 0 | 0:70 · 0:11 · 0:3 |
| VI, the wells | 23 · 20 · 18 | 7/8 · 7/8 · 7/8 | 15 · 12 · 10 | 56% · 58% · 58% | 4 | 0 · 11 · 19 | 15:22 · 23:9 · 39:6 |
| VI, the eagle | 17 · 14 · 12 | 4/6 · 4/6 · 4/6 | 11 · 8 · 6 | 38% · 40% · 37% | 3 | 0 · 0 · 0 | 23:42 · 23:15 · 26:7 |
| VII, the legion | 19 · 16 · 14 | 6/8 · 6/8 · 6/9 | 11 · 8 · 5 | 49% · 53% · 53% | 4 | 0 · 0 · 0 | 35:56 · 29:17 · 34:3 |
| VIII, the ferry | 25 · 22 · 20 | 5/6 · 5/7 · 5/6 | 19 · 15 · 14 | 32% · 39% · 40% | 4 | 0 · 7 · 12 | 0:60 · 1:13 · 0:1 |
| VIII, the crossing | 20 · 17 · 15 | 7/8 · 7/8 · 8/8 | 12 · 9 · 7 | 45% · 50% · 55% | 4 | 0 · 7 · 10 | 33:49 · 17:18 · 15:5 |
| IX, the wing | 18 · 15 · 13 | 5/7 · 5/7 · 5/7 | 11 · 8 · 6 | 42% · 55% · 58% | 4 | 0 · 0 · 0 | 35:74 · 49:18 · 53:4 |
| IX, the city | 20 · 17 · 15 | 5/7 · 6/7 · 6/7 | 13 · 10 · 8 | 30% · 38% · 38% | 5 | 0 · 0 · 0 | 16:38 · 14:5 · 13:0 |
| X, the road | 21 · 18 · 16 | 10/12 · 8/10 · 8/9 | 9 · 8 · 7 | 43% · 54% · 59% | 5 | 0 · 15 · 17 | 13:52 · 21:24 · 12:2 |
| XII, the confrontation | 19 · 16 · 14 | 10/10 · 8/8 · 8/8 | 9 · 8 · 6 | 11% · 13% · 19% | 4 | 0 · 0 · 0 | 116:204 · 120:125 · 135:77 |

The finale's routes: the battle and backer routes take 10 rounds on Story and 8 on Standard and Veteran on every seed; defection 2–4, settlement 4–5 and surrender 3–4.

### Compared with main

Main before this release (`0952480`, the fixes after the campaign world upgrade) and this release were swept on the same 20 seeds on Standard, with the same bot, one after the other with nothing else running, twice each. Every battle was won at the first try in all four sweeps.

| Battle | Rounds, median/most | Least slack | Loss, median | Tick p95, mean of two runs |
| --- | --- | --- | --- | --- |
| IV, the gate | 7/8 → 7/8 | 8 → 8 | 77% → 76% | 0.35 → 0.35 ms |
| IV, the wall | 6/9 → 6/9 | 3 → 3 | 45% → 45% | 0.43 → 0.44 ms |
| V, the mine | 7/9 → 8/9 | 7 → 7 | 52% → 55% | 0.54 → 0.48 ms |
| V, the wall | 9/10 → 9/9 | 3 → 4 | 73% → 70% | 0.42 → 0.45 ms |
| VI, the wells | 7/8 → 7/8 | 12 → 12 | 57% → 58% | 0.46 → 0.48 ms |
| VI, the eagle | 4/6 → 4/6 | 8 → 8 | 40% → 40% | 0.49 → 0.46 ms |
| VII, the legion | 6/8 → 6/8 | 8 → 8 | 51% → 53% | 0.70 → 0.69 ms |
| VIII, the ferry | 5/7 → 5/7 | 15 → 15 | 38% → 39% | 0.67 → 0.68 ms |
| VIII, the crossing | 8/9 → 7/8 | 8 → 9 | 48% → 50% | 0.60 → 0.65 ms |
| IX, the wing | 5/7 → 5/7 | 8 → 8 | 52% → 55% | 0.54 → 0.54 ms |
| IX, the city | 6/7 → 6/7 | 10 → 10 | 36% → 38% | 0.69 → 0.68 ms |
| X, the road | 8/10 → 8/10 | 8 → 8 | 53% → 54% | 0.66 → 0.66 ms |
| XII, the confrontation | 8/8 → 8/8 | 8 → 8 | 13% → 13% | 0.81 → 0.84 ms |

The margins barely moved: the bot plays the objectives and uses none of the new structures on purpose (see [Limitations](#limitations)). The largest change is at Chapter VIII's crossing, where the bridgehead rampart and ditch are new: a round shorter at most and a round more slack. Chapter IV's gate, with its towers and ditch, saw no squad ambush on Standard (main 1:8).

### Tick time

On the comparison above, the simulation's tick at p95 rose by 0.06 ms at most (Chapter VIII's crossing, 0.60 to 0.65 ms on the mean of two runs), within the plan's 0.3 ms, and by 0.03 ms in the largest fight, the finale. Each Standard sweep took 287–293 s, on main and with this release alike. The Story and Veteran sweeps ran together on the container's four cores, so their tick times are not comparable and are not counted here. None of these is a phone's measurement: the budget there is 4 ms at p95 on a 2022 phone, and no phone has been measured.

## Downloads

Gzip sizes from the build report (the sum of each set's files, the service worker included; not a browser's network trace):

| Download | Limit | Main | This release |
| --- | ---: | ---: | ---: |
| First load | 2 MB | 0.87 MB | 0.88 MB |
| Chapter I in 3D | 16 MB | 10.09 MB | 10.11 MB |
| The largest chapter (V, with its 2D art) | 24 MB | 14.92 MB | 15.11 MB |
| The complete campaign | 80 MB | 31.43 MB | 31.94 MB |

The chapters with fortified battles each grow by about 0.18 MB in 3D: Chapter IV to 11.19 MB, V to 12.90, VI to 12.20, VIII to 12.01, IX to 12.43 and XII to 10.98.

## Limitations

- **A bot is not a player.** The sweep bot never climbs a tower, bars or batters a gate, or demolishes a bridge: it plays the objectives, and its routes rarely need the new structures. The new rules are covered by their own tests on battles reached by legal commands; how they change a person's battles is for the plan's Gate 4 play-through.
- **The enemy does not use them either.** No enemy batters a gate, demolishes a bridge or climbs to a deck on purpose; enemy rams and ladders are release 7's.
- **A late kit waits.** The kit is used if it has arrived when the world is built. A battle whose download is slower than the loading veil's wait, or one switched from Performance to Balanced mid-battle, keeps the code-built works until the world is next built, normally the next battle.
- **Software rendering.** Program counts, draw calls, triangles and the cutaway's coverage are counts, which depend little on the device; the times in these checks are SwiftShader's and say nothing of a phone's or a laptop's frame rate.
- **Not checked:** a person playing the new battles; the kit on a phone, a laptop or with a screen reader; the battles in the 2D view beyond the automated smoke tests.

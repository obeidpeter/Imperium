# Worlds and gameplay, release 9: landmarks and set pieces

Release 9 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md) builds the great places of the story's last chapters and the middle distance of every chapter. The Senate's Contests of Chapters XI and XII take place in the Curia, built in Blender in marble. The finale is fought before Aurelian's walls, also built in Blender. The oath and the accession are filmed in story beats instead of a slow orbit. Birds, hearth smoke and banners in the wind bring life to the fields, and every chapter has three landmarks of its own on its horizon. The rules are unchanged. This report records what changed, how it was checked and what was not checked. The [changelog](../CHANGELOG.md) describes the changes for players.

The landmarks and the life props were generated with Tripo within the cap the owner approved, 1,150 credits, opened by a gate of five models: 1,060 credits for 46 models in the game and seven rejected attempts ([credit ledger](../art-source/models/worlds-plan-credits.json), [art record](art-generation.md)). The Colosseum keeps its code-built outline, and the fishing nets were not shipped (see [Limitations](#limitations)). Release 8's five figures still wait on the owner's approval of their credits.

How each kind of check was made:

- **Automated tests** (Node.js): `npm test`. New:
  - `curia-hall`: the Curia's pieces, budget, placement, cutaway and stand-ins, and its paving clear of the ground;
  - `aurelian-walls`: the walls' pieces, budget and layout, the merged draws, and the camera kept on the field's side of them;
  - `ceremony-beats`: the oath's and the accession's beats, their timing and holds;
  - `environment-life`: the birds, hearth smoke and banners, by quality, weather and time of day;
  - `horizon-landmarks`: every chapter's landmarks, their outlines' footprints, heights and faces, their bearings, the river's landmarks and the bridges' streams; the generated ones in the world catalog with exactly the chapters that name them; and a generated model in its slot: its height, centre, facing, its ground under its own extent, and its hazed material clones, disposed with the world while the cached model stays whole.

  `environment-horizon` now tells the landmarks from the city's roofline. `regional-world` and `regional-scenery-assets` check that each life prop downloads and stands in exactly its chapters, beyond the board, off the camps' service pads and never round a contest's board, and that it has no code-built stand-in; `world-catalog` that every model, the landmarks' folder included, is catalogued with its provenance; `scenery-models` that a Curia Contest preloads no landmarks and that every scene's working set fits the scenery cache's idle bound.
- **Sweeps** (Node.js, headless, on the development container): the release 3 bot plays the campaign from New Game, every battle by legal Commands, on 20 campaign seeds on each difficulty, beside sweeps of release 8's code made in turn with it. They check that the battles play exactly as on release 8 (see [Calibration](#calibration)). A bot is not a player.
- **The stage benchmark** (headless Chromium, software rendering): draw calls, triangles and shader programs against the recorded ceilings and the 50-program budget, beside release 8's code.
- **The real interface:** the production build in headless Chromium with software rendering (SwiftShader): the stage benchmark as CI runs it, and CI's browser checks on the pull request (see [The browser checks](#the-browser-checks)).
- **Scratch renders**, not committed: the Curia and the walls in Blender's Cycles renderer before shipping, and in the game:
  - the Contests and the finale from the benchmark's cameras;
  - each ceremony beat;
  - each chapter's three landmarks from the Horizon view turned toward each, as outlines on this release and release 8, then as generated models;
  - the life props of five chapters from behind the baggage line.
- **Not performed:** a person playing any of it, and any check on a phone, a laptop or with a screen reader.

## What changed

| Change | Where it shows | Code and data | Randomness |
| --- | --- | --- | --- |
| The Curia in marble | The Senate's Contests in Chapters XI and XII, on Balanced and High | `build-curia.py`, `kitlib.py`, `environment-curia.js`, `CURIA_LAYOUT` | none |
| Aurelian's walls and gate | Beyond the finale's east edge, on Balanced and High | `build-aurelian-walls.py`, `aurelian-walls.js`, `environment-finale.js` | none |
| Ceremonies in story beats | The oath (Chapter I) and the accession (Chapter XII) in 3D | `ceremony.js`, `stage.js`, `stage-input.js`, `stage-camera.js` | none |
| Life about the field | Outdoor scenes on Balanced and High | `environment-life.js`, `LIFE_LAYOUT` | the encounter's presentation seed |
| Each chapter's landmarks | The horizon of every outdoor scene: outlines on every tier | `horizon-landmarks.js`, `environment-horizon.js`, `LANDMARK_LAYOUT` | none |
| Generated landmarks | In place of 32 of the 33 outlines, on Balanced and High | `LANDMARK_CHAPTERS`, `environment-horizon.js` (`fitLandmark`, `landmarkHaze`), `assets/models/landmarks/` | none |
| Life about the camps and towns | Beyond the board in every chapter but V, outdoors, on Balanced and High | `LIFE_PROP_CHAPTERS`, `environment-regional-world.js`, `assets/models/world/life-*.glb` | none |
| A larger scenery cache | Between stages: 20 idle models, up from 12 | `SCENERY_IDLE_MASTERS` (`scenery-models.js`) | none |
| The camera stays out of the walls | The finale, wherever a low view is turned | `stage-camera.js` (`clearOfBoxes`), `stage.js` | none |

None of this changes a rule, a route, a pick or a result. The Curia and the walls stand where the code-built hall and curtain stood, take no picks and block no cell. Birds and smoke are drawn from the presentation seed (`presentationRandom`), never from the campaign's generator.

## Against the plan

| Plan item | As built | Tests |
| --- | --- | --- |
| About 35 Tripo landmarks across the regions, placed by the layout data, historical details checked first | 33 landmarks in 12 chapters' layouts, each with a code-built outline; 32 generated models stand in their places on Balanced and High. The Colosseum keeps its outline after three rejected attempts. The [historical note](historical-research.md) was written first. | `horizon-landmarks`, `environment-horizon` |
| The Curia rebuilt in Blender, in marble, for every Contest | For the Senate's Contests (XI and XII), as the credit plan proposed: Chapter VII's council, VIII's parley and X's tribunal keep their own settings | `curia-hall` |
| The Aurelian Walls and gate for the finale, in Blender | As planned | `aurelian-walls` |
| Ceremonies: story beats in place of a slow orbit | Five beats each for the oath and the accession | `ceremony-beats` |
| Life: about 15 Tripo props, cloth banners and awnings, roof smoke and birds | 14 life props set out beyond the board, banners, hearth smoke and birds. The fishing nets were not shipped. The awnings stay still (see [Limitations](#limitations)). | `environment-life`, `regional-world`, `regional-scenery-assets` |
| Release 8's five figures | Still waiting on the owner's approval of their credits | — |

## The landmarks

Each chapter's three landmarks, nearest first, with their outlines' heights and their distances from the board's centre. The slots are on the horizon's three bearings, farther out round a city (Chapters IX, XI and XII). Each outline's footprint is its whole extent, and its height is the one its generated model is scaled to.

| Chapter | Nearest | Middle | Farthest |
| --- | --- | --- | --- |
| I | The stone gate of Novae: 12.8 m, 115 m out | A stone signal tower: 10.3 m, 143 m out | A Thracian burial mound: 4.3 m, 171 m out |
| II | A reed hut on piles: 7.15 m, 115 m out | The piers of an old bridge, standing without its deck: 6.2 m, 145 m out, across the river | A harbour quay and its warehouse: 8.4 m, 171 m out, on the river bank |
| III | A road station: 8.3 m, 115 m out | A small temple: 13 m, 143 m out | A burned farmstead: 3.2 m, 171 m out |
| IV | A stone signal tower: 10.3 m, 115 m out | A Thracian burial mound: 4.3 m, 143 m out | A road station: 8.3 m, 171 m out |
| V | A citadel on the river cliff: 15.3 m, 115 m out | A ruined watchtower: 6.2 m, 143 m out | A tower tomb of the necropolis: 15.4 m, 171 m out |
| VI | A mudbrick caravan station: 8.3 m, 115 m out | A Syrian temple court: 11.6 m, 143 m out | Chamber tombs cut in the hillside: 10 m, 171 m out |
| VII | The bridge over the Adda: 6.5 m, 115 m out, over its own stream | The walls of Mediolanum: 10.8 m, 143 m out | A tall tomb beside the road: 15.4 m, 171 m out |
| VIII | The stone gate of a frontier fort: 12.8 m, 115 m out | River warehouses: 8.4 m, 143 m out, on the river bank | The ruined Dacian hill sanctuary: 3.2 m, 171 m out |
| IX | A tetrapylon with its colonnades: 10.2 m, 195 m out | A sanctuary in its walled court: 11.6 m, 223 m out | The city gate: 12.8 m, 251 m out |
| X | A villa: 6.4 m, 115 m out | The province’s basilica: 12.7 m, 143 m out | An aqueduct: 8.3 m, 171 m out |
| XI | The Colosseum: 23.5 m, 195 m out | The Pantheon: 19.5 m, 223 m out | The Arch of Septimius Severus: 19 m, 251 m out |
| XII | The Mausoleum of Hadrian: 24 m, 195 m out | Aurelian’s Temple of the Sun: 11.6 m, 223 m out | The Milvian Bridge: 6.5 m, 251 m out, over its own stream |

In scratch renders from the Horizon view, turned toward each landmark in turn, on Balanced with software rendering: first the outlines, on this release's code before the models and on release 8's, then the generated models (the sheets beside release 8's went to the owner):

- Every generated model loaded and stood in its slot in place of its outline.
- Most read as their kind at their distance in the haze: Novae's gate, the frontier fort's gate, the citadel and the walls of Mediolanum as fortifications; the signal tower and the tower tomb as towers; the hut on piles; the bridge piers across the river, the bridge over the Adda and the aqueduct by their arches; the small temple, the Pantheon and the Arch of Septimius Severus by their porches, dome and attic; the road station, the caravan station, the temple court, the villa and the basilica by their walls and roofs; the Mausoleum of Hadrian above the finale's trees. Release 8 showed a pale block or tower in their places.
- Low or pale ones fade or hide, as their outlines did: Chapter I's burial mound and Chapter VIII's warehouses and Dacian sanctuary behind a nearer crest, the burned farmstead and the quay as small shapes in the haze, the rock-cut tombs as a pale block in Chapter VI's dust, Chapter IX's city gate behind a regional wall, Chapter XII's Milvian Bridge behind its crest and the Temple of the Sun behind Aurelian's walls.
- Chapter XI's encounters are the Senate's Contests, inside the Curia, which preloads no landmarks, so its landmarks stand only round the camp in Rome. The fixture has no such camp, so they were rendered from Chapter X's road start state under Chapter XI's id: the generated Pantheon and Arch, and the Colosseum's outline, which reads at that distance as a plain grey drum.
- The first outlines of the old bridge's piers read as distant tower blocks. They were rebuilt lower and broader, pointed against the current, with their arches' springing and one surviving span, and stand across the river.

## Life about the camps and towns

Fourteen generated props are set out with the baggage beyond the board (`LIFE_PROP_CHAPTERS` in [`world-catalog.js`](../src/ui/world-catalog.js), placed by `regionalPropPlacements` in [`environment-regional-world.js`](../src/showcase/environment-regional-world.js)), after the chapter's regional props, in the same baggage line beyond the board:

| Chapter | Props |
| --- | --- |
| I | washing on a line, a woodpile, a grindstone, a bread oven |
| II | a woodpile, a haystack |
| III | washing on a line, wicker beehives, a bread oven, a handcart of stores |
| IV | a woodpile, a grindstone, a handcart of stores |
| V | none: its supply camp has its own generated props |
| VI | a caravan's saddles and baggage, a bread oven, a potter's wares |
| VII | racks of amphorae, wicker beehives, a covered carriage |
| VIII | washing on a line, a haystack, an ox cart, a loom |
| IX | a caravan's saddles and baggage, a bread oven, a market stall, a potter's wares |
| X | washing on a line, a haystack, an ox cart, a loom, a market stall |
| XI | racks of amphorae, a covered carriage, a market stall, a potter's wares |
| XII | racks of amphorae, a covered carriage, a market stall, a potter's wares |

- They stand outdoors only: none round a council's, a tribunal's or the Senate's board, and none on a camp's service pad, which the regional props' services keep.
- They draw only on Balanced and High. They have no code-built stand-in: on Performance, or without its model, a prop's place stays empty. A first build gave each a crate-and-cloth stand-in, as the regional props have, but that put two tests' code-built worlds over their budgets of draw objects (64 for Chapter IX's city, 60 for the foliage's settings), for a crate where a laundry line should be.
- Each scene's working set (its placed scenery, the world kits and its landmarks) now reaches 16 models, in Chapters VI and IX. The scenery cache kept 12 idle models between stages, which had held Chapter V's working set exactly; it now keeps 20 (`SCENERY_IDLE_MASTERS`), so a chapter's next stage finds all its models still loaded, and `scenery-models` holds every scene's working set within that.

## Measurements

The stage benchmark ([`benchmark-stage.mjs`](../scripts/benchmark-stage.mjs)) in headless Chromium with software rendering, on this release's tree after the generated models and on release 8's (`341bc5f`), one run at a time: draw calls, triangles and shader programs from the still overview camera, and the first frame. Software rendering inflates the times; the counts are real.

| Scene | Quality | Draw calls | Triangles | Programs | First frame |
| --- | --- | ---: | ---: | ---: | ---: |
| Chapter I, the road | Performance | 77 → 77 | 152,162 → 152,280 | 36 → 36 | 6.3 → 6.1 s |
| Chapter I, the road | Balanced | 95 → 97 | 358,957 → 364,607 | 39 → 40 | 6.6 → 6.5 s |
| Chapter V, the mine | Performance | 136 → 136 | 237,584 → 237,084 | 43 → 43 | 7.8 → 7.5 s |
| Chapter V, the mine | Balanced | 156 → 157 | 464,801 → 469,739 | 45 → 46 | 8.2 → 7.6 s |
| Chapter VIII, the ferry | Performance | 132 → 132 | 336,195 → 336,421 | 42 → 42 | 7.8 → 7.3 s |
| Chapter VIII, the ferry | Balanced | 144 → 143 | 598,605 → 598,335 | 47 → 47 | 8.4 → 7.7 s |
| Chapter XI, the accounts | Performance | 98 → 99 | 110,908 → 111,056 | 39 → 36 | 7.8 → 5.6 s |
| Chapter XI, the accounts | Balanced | 109 → 112 | 216,793 → 163,236 | 41 → 38 | 6.7 → 6.2 s |
| Chapter XII, the legitimacy | Performance | 97 → 96 | 110,812 → 110,696 | 38 → 36 | 6.8 → 6.0 s |
| Chapter XII, the legitimacy | Balanced | 107 → 109 | 214,329 → 155,509 | 40 → 38 | 7.1 → 6.5 s |
| Chapter XII, the confrontation | Performance | 146 → 144 | 367,573 → 363,605 | 41 → 41 | 7.7 → 7.9 s |
| Chapter XII, the confrontation | Balanced | 153 → 160 | 798,543 → 792,093 | 45 → 47 | 8.1 → 8.5 s |

- **Every count is within its recorded ceiling** (`scripts/stage-ceilings.json`), and no scene compiles more than 47 programs, within the plan's 50. Chapter V's mine at Balanced now meets its ceiling of 46 programs exactly, and Chapter XII's confrontation is one under its 48: a later release that adds a program to either must raise its ceiling on purpose.
- **CI's own command** (`--dist --scenes ch5-mine,ch12-confrontation --check --max-programs 50 --ceilings`) passes on the production build: no program compiles in the first frame or in play.
- **The generated landmarks and props share the imported art's opaque program.** The material normaliser (`model-materials.js`) gives a colour-only landmark its neutral normal and roughness-metalness maps, and a landmark's hazed clones change only its colours, so they keep that program.
- **The benchmark's overview camera looks down on the board**, so it sees little of the horizon or the baggage line: the landmarks and life props move its draw calls by a few at most. Chapter XII's confrontation gains seven at Balanced, with Aurelian's walls. The Contests in the Curia (XI's accounts, XII's legitimacy) draw a quarter fewer triangles at Balanced than the hall it replaces; on Performance they keep the code-built hall, which this release batches within its own groups so that the Curia can hide it whole.
- The first frames move by up to 2.2 seconds between the two trees, within the spread of software rendering's runs; none was measured on a phone or a laptop.

## The browser checks

All in headless Chromium with software rendering (SwiftShader):

- **The stage benchmark** on this release's tree and, as CI runs it, on the production build (see [Measurements](#measurements)).
- **Scratch renders**, through the stage controller mounted on the test fixture's encounter-start states (legal autoplay checkpoints), not the full app: every chapter's three landmarks from the Horizon view, on this release and release 8, and the life props of five chapters from behind the baggage line. A scratch script, not committed, took the shots; the sheets went to the owner.
- **In CI on the pull request:** `npm run verify` on Node 20 and 22, `npm run smoke` with the polish checks, the usability, Chapter V pilot, immersive and siege checks, the twelve-camp check, the twelve-chapter benchmark and the stage benchmark against its ceilings. All seven jobs passed on `ebf9821`, the last commit before this report. Of these, `npm test` and the stage benchmark were also run here.

## Calibration

The sweeps ([Story](evidence/realtime-release9-sweep-story.json), [Standard](evidence/realtime-release9-sweep-standard.json), [Veteran](evidence/realtime-release9-sweep-veteran.json)) play each seed's campaign from New Game in release 7's three passes:

- each chapter's first decision;
- the decisions that change a field the other way, with each battle's second operation chosen in camp (`--operations=other`);
- every finale route from each seed's Chapter XII camp.

A lost battle is retried from its checkpoint, by the legal Retry command, up to once on Story, twice on Standard and three times on Veteran. This release changes no rule, no rules data and no bot code, so its campaigns should play exactly as release 8's.

Release 8's code (`341bc5f`) was swept on the same seeds with the same bot, beside this release's `ebf9821`, one sweep at a time with nothing else running on the container:

- on Standard, this release and release 8 in turn, twice each;
- on Story, this release, then release 8;
- on Veteran, release 8, then this release.

The sweep loads none of this release's changes: its 85 modules are the rules, the data and the bot (`src/core`, `src/data` and five scripts), and not one of them differs from release 8's.

**Every result matched release 8's.** On each level every result of this release equals release 8's in every recorded field but the tick times: status, rounds, slack, losses, plans, weather, ambushes, hidden bands and incidents. That holds for 620 results on Story, 620 in each of the four Standard runs and 627 on Veteran.

### Against the plan's targets

Each target counts the 13 battles of pass 1 and the 5 finale routes of pass 3 on each of 20 seeds: 360 battles a level.

| Target | Story | Standard | Veteran |
| --- | --- | --- | --- |
| Won on the first try: Story every one, Standard ≥ 90%, Veteran ≥ 70% | 360 of 360 | 360 of 360 | 357 of 360 |
| Won within the tries allowed (one, two, three) | 360 of 360 | 360 of 360 | 360 of 360 |
| At least three enemy plans in each battle across the seeds | every battle | every battle | every battle |
| The finale's battle lasts 8–12 of its 16 rounds | 10 rounds | 8 rounds | 8 rounds (8–9 on the backer's route) |
| The simulation's tick rises by at most 0.3 ms at p95 | +0.04 ms at most (IV, the gate) | +0.05 ms at most (XII, the confrontation) | +0.04 ms at most (V, the wall) |

On Veteran the three first tries lost were the sortie's, on seeds 1, 11 and 18, each won at the second try. The same battle after the chapter's other decision (pass 2) lost four first tries (seeds 1, 6, 11 and 15), all won at the second. Both are exactly as in release 8: the defended line broke in each.

### Tick time

The plan's budget: no battle's tick at p95 may rise by more than 0.3 ms over the previous release, measured on the same seeds, one sweep at a time. Nothing in a battle changed, so the differences are the container's noise. Each cell gives release 8 → this release, in milliseconds. On Standard each is the mean of two runs a side; on Story and Veteran there is one run each.

| Battle | Story | Standard | Veteran |
| --- | --- | --- | --- |
| IV, the gate | 0.62 → 0.66 | 0.68 → 0.68 | 0.66 → 0.63 |
| IV, the wall | 0.59 → 0.59 | 0.60 → 0.59 | 0.63 → 0.59 |
| V, the mine | 0.68 → 0.70 | 0.58 → 0.58 | 0.62 → 0.56 |
| V, the wall | 0.77 → 0.79 | 0.71 → 0.74 | 0.70 → 0.74 |
| VI, the wells | 0.69 → 0.69 | 0.68 → 0.66 | 0.64 → 0.63 |
| VI, the eagle | 0.61 → 0.56 | 0.61 → 0.63 | 0.62 → 0.63 |
| VII, the legion | 0.92 → 0.90 | 0.88 → 0.85 | 0.86 → 0.89 |
| VIII, the ferry | 0.92 → 0.89 | 0.90 → 0.93 | 0.91 → 0.90 |
| VIII, the crossing | 0.79 → 0.79 | 0.78 → 0.78 | 0.77 → 0.78 |
| IX, the wing | 0.66 → 0.68 | 0.68 → 0.68 | 0.71 → 0.65 |
| IX, the city | 0.86 → 0.83 | 0.82 → 0.78 | 0.78 → 0.82 |
| X, the road | 0.92 → 0.85 | 0.79 → 0.83 | 0.80 → 0.82 |
| XII, the confrontation | 0.85 → 0.85 | 0.86 → 0.91 | 0.96 → 0.87 |

Each sweep also checks its ticks against the Gate 4 sweep, recorded on another day. All eight runs meet that check this time, where six of release 8's eight did not: the largest rise against it is Chapter IV's gate's in seven runs, +0.21 to +0.29 ms, and Chapter VI's wells' in release 8's Story run, +0.21 ms. As release 7's report found, runs on different days are not comparable on this container, so only the runs made in turn here are compared. None of these times is a phone's.

## Downloads

Gzip sizes from the build report (the sum of each set's files, the service worker included; not a browser's network trace), release 8's code (`341bc5f`, the plan's status commit on release 8's merge) built beside this release:

| Download | Limit | Release 8 | This release |
| --- | ---: | ---: | ---: |
| First load | 2 MB | 0.94 MB | 0.94 MB |
| Chapter I in 3D | 16 MB | 13.84 MB | 15.00 MB |
| The largest chapter, with its 2D art | 24 MB | 22.16 MB (VII) | 23.21 MB (VII) |
| The complete campaign | 80 MB | 43.02 MB | 51.60 MB |

The complete campaign grows by 8.58 MB:

- the 32 generated landmarks, 4.93 MB, of which each chapter's pack carries its own three (0.37–0.50 MB; Chapters I–IV share theirs);
- the 14 life props, 2.96 MB, two to five in each chapter's pack but V's (0.49–1.16 MB);
- the Curia (0.35 MB, in XI's and XII's packs) and Aurelian's walls (0.31 MB, in XII's).

Chapter I in 3D grows by 1.16 MB, its three landmarks and four life props, to 15.00 MB: within its 16 MB limit, with 1 MB to spare. Chapter VII with its 2D art, the largest pack, grows from 22.16 to 23.21 MB, within 24 MB. Every pack's figures by chapter, in 3D and with its 2D art:

| Chapter | Release 8, 3D | This release, 3D | Release 8, with 2D | This release, with 2D |
| --- | ---: | ---: | ---: | ---: |
| I | 13.84 | 15.00 | 17.69 | 18.85 |
| II | 14.96 | 15.95 | 17.72 | 18.71 |
| III | 16.45 | 17.71 | 19.20 | 20.47 |
| IV | 18.15 | 19.23 | 20.91 | 21.98 |
| V | 18.31 | 18.75 | 20.52 | 20.96 |
| VI | 17.61 | 18.70 | 19.99 | 21.08 |
| VII | 19.40 | 20.45 | 22.16 | 23.21 |
| VIII | 17.66 | 19.13 | 20.42 | 21.88 |
| IX | 17.83 | 19.10 | 20.04 | 21.31 |
| X | 17.18 | 18.82 | 19.94 | 21.58 |
| XI | 14.27 | 15.82 | 15.69 | 17.24 |
| XII | 17.60 | 19.59 | 20.35 | 22.33 |

## Limitations

- **The Colosseum keeps its outline.** Three Tripo attempts gave a fragment of its outer wall, the monument as it stands today, its outer ring fallen on one side, and a cutaway with its near half open: never the whole amphitheatre of 275. Its outline, four storeys of arcades round an oval, stands on every tier. A model built in Blender, as the Curia and the walls were, is the way to give it one.
- **The generated forms are Tripo's.** They follow the prompts in outline, not in every detail, as the [art record](art-generation.md) lists: the aqueduct has five arches where eight were asked, the old bridge's arches still stand between its piers, the caravan station's gate arch is slightly pointed, a later form. Several stand on a slab or a patch of paving of their own. Seventeen landmarks and four props were turned in processing, to show their fronts, or a bridge's or an aqueduct's length, where Tripo had set them on a side.
- **Fourteen life props, not fifteen.** The fishing nets were not shipped: the first attempt's open knotted net was 12,329 triangles after processing, the second hung like ragged cloth on its frame, as the laundry line already does. Chapter II has two props, the fewest.
- **Eight budgets were raised after processing**, each with a note in its request: the pile hut's to 200,000 bytes; five props' to 240,000 bytes; and the ox cart's and the hay rick's to 3,400 and 4,200 triangles (270,000 and 300,000 bytes), whose decimation stops short of 3,000 triangles whatever the target. The downloads stay within their limits (see [Downloads](#downloads)).
- **Life has no stand-in.** On Performance, or if a prop cannot be downloaded, its place is empty, where a regional prop keeps a code-built one.
- **Their haze is a judgement.** A generated landmark takes half the share of the haze the horizon's own distant colours take at its distance, so that it sits about as far off as the hills round it. It was set from the software renders, not checked on a screen.
- **Colour maps alone.** The landmarks drop their normal and roughness-metalness maps, which at 115 metres and more are below a pixel: if a camera ever came close to one, it would look flat.
- **33 landmarks, not 35.** The credit plan's list for Dacia included a town gate and baths that no chapter's three bearings have room for; they are not placed.
- **The five figures.** Severianus, Aelia, Paullus, Theon and Quintus are still drawn procedurally, as in release 8. Their credits (225, at most 315) wait on the owner's approval.
- **The awnings stay still.** The plan named cloth banners and awnings. The banners stir. The officers' awning is a piece of the regional kits, and the code-built canopies of the porches and workshops share one geometry. Moving them would mean giving each its own, as the banners now have, for little at the cameras' distances.
- **The landmarks' forms are the game's own.** Most are types, not particular buildings, and even the named ones (Novae's gate, the walls of Mediolanum, the bridges, Rome's monuments) are evocations at the scale of a horizon: the [historical note](historical-research.md) says which details rest on evidence. The Mausoleum of Hadrian's outline is lower than the monument, so as not to fill the sky.
- **Hidden at times.** A landmark stands on the horizon's own ground, so a nearer crest can hide a low one from the board, such as Chapter I's burial mound and Chapter XII's Milvian Bridge from their battles' cameras. In the finale, Aurelian's walls hide the landmarks to the east.
- **The streams under the bridges** of Chapters VII and XII are flat strips of water on the ground: their horizons have no river, and the horizon's ground is too coarse to carve a valley for one.
- **The camera and the walls.** Before the finale, a low view turned toward Aurelian's walls now comes in to their face; it used to pass into them, as it did into the code-built curtain before this release. It was checked in the test and in scratch renders from the Horizon view, not by a person dragging the view.
- **Software rendering only.** Every render and benchmark was made with SwiftShader in headless Chromium. Frame times, first-frame times and the look on a real screen (the marble's normal maps, the fog's depth, the birds' and smoke's motion) were not checked on a phone or a laptop.
- **Not checked:**
  - a person playing the Contests in the Curia, the finale before the walls, or the two ceremonies;
  - the release on a phone, a laptop or with a screen reader;
  - whether the ceremony beats' timing reads well in play.

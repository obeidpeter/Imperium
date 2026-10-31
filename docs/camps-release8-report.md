# Worlds and gameplay, release 8: living camps

Release 8 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md) makes each chapter's camp a place of its own. Chapters IV and VI–XII have their own layouts in place of the shared templates. The named cast stand in the camps where the story has them, each with an absence or replacement branch. Every chapter from IV offers two errands worth training points, and the five titles nobody could earn are errands' rewards. A trader sells the region's goods in every camp, and replies open by who the soldier is. Every encounter has a page of history for a defeat, shown on every result screen. The battles are unchanged. This report records what changed, how it was checked and what was not checked. The [changelog](../CHANGELOG.md) describes the changes for players.

How each kind of check was made:

- **Automated tests** (Node.js): `npm test`. New: `living-camps`:
  - each later camp's own map, places and pads;
  - the cast's presence with every absence or replacement branch;
  - a recovering companion at the valetudinarium;
  - all 18 errands walked through by legal replies and uses, each paying once;
  - the five titles and the audit;
  - replies that depend on the soldier, refused without any change;
  - the traders and defeat pages;
  - the defeat page on the board's and the chamber's results;
  - the camp's women drawn as women, in Syra's body or the procedural woman's figure, and no man in Syra's body.

  `chapter-3d-assets` and the build's asset check now expect the woman's figure in every chapter's pack. `world-hubs` walks to every person, object and place of all twelve camps on both sides of Chapter II's decision, and talks to every later camp's people and uses every object by legal Commands. `tp-audit` checks that the [audit](tp-audit.md), regenerated, matches the data.
- **Sweeps** (Node.js, headless, on the development container): the release 3 bot plays the campaign from New Game, every battle by legal Commands, on 20 campaign seeds on each difficulty, beside sweeps of main made in turn with it. They check that the battles play exactly as on main. A bot is not a player (see [Limitations](#limitations)).
- **The real interface:** the production build in headless Chromium with software rendering (SwiftShader). The twelve-camp check ran locally on four of the new camps (see [The browser checks](#the-browser-checks)); the other browser checks run in CI on the pull request.
- **Not performed:** a person walking the camps, doing the errands or reading the new conversations, and any check on a phone, a laptop or with a screen reader.

## What changed

| Change | Where it shows | Code and data | Randomness |
| --- | --- | --- | --- |
| A camp of its own | Chapters IV and VI–XII each have their own map, gate, courts, tent lines and water, and the seven places in their own arrangement. Each has its own errand objects. Chapter V's pilot courtyard keeps its layout. | `camps.js`, `camp-regions.js` (the scenery pads moved to fit) | none |
| The cast in camp | Varro, Crispus, Quintus, Brennus, Severianus, Aelia, Paullus and Theon stand where the story has them (below). Lucan or Sabinus, Naso and Felix stand with the company. | `camps.js`, `campaign.js` (`storyWhen`, shared with the scenes) | none |
| A wound shows in camp | A companion still recovering stands at the valetudinarium, not the barracks. His words say so, and the people list marks him "recovering". | `camps.js` (`campPersonSpot`), `camp-world.js`, `campaign-views.js`, `dialogue.js` (`recovering`, `fit`) | none |
| Errands | Two in each of Chapters IV–XII, each worth 2 training points, with conversations for every person and object | `living-camps.js`, `dialogue.js`, `items.js` (six errand things) | none |
| The five titles | Shield of the cohort, Pathfinder, Advocate of the ranks, River scout and Scribe of the council, each an errand's reward | `living-camps.js` | none |
| A trader in every camp | The region's goods, with an eye amulet (+1 Perception) among the charms | `camps.js` (`TRADER_STOCK`), `items.js` | none |
| Replies by who the soldier is | 28 replies across Chapters IV–XII that need an attribute, a decoration, a title, a training path or a meter; shown dimmed with what they need | `living-camps.js`, `dialogue.js` | none |
| Defeat pages | A page for each of the 25 encounters (6 before). Shown on the real-time, board and chamber results. | `living-camps.js`, `tactical-intel.js`, `realtime-view.js`, `encounter-view.js`, `chamber-view.js` | none |
| Named people without a body | Severianus, Aelia, Paullus, Theon and Quintus were drawn procedurally with their own faces, never in the civilian traveller's body, until their own bodies followed on 30 October ([below](#the-five-figures-30-october)) | `actor-body-catalog.js` | none |
| The camp's women | Syra wears her own body; Vibia, Dida, Caecilia and Licinia, with no body of their own, are drawn as the procedural woman, never in a man's body. The woman's figure is in every chapter's pack, not only from Chapter VIII. | `actor-kit.js`, `actor-identity.js`, `actor-body-catalog.js`, `art.js` | none |
| Varro's courses | Varro, who now stands in Chapter IV's camp, also teaches its courses there; from Chapter VI the training list names the veteran instructor, as before | `soldier-views.js` | none |

None of this changes a battle or a Contest. A person's place follows recorded decisions, the patron's standing, the encounter index and the company roll, and constructing a camp spends no gameplay randomness (`world-hubs`). An errand's reward is given once, when it is done, through the dialogue engine. The sweep bot does no errands and buys nothing, so its campaigns play as on main.

## Against the plan

| Plan item | As built | Tests |
| --- | --- | --- |
| A camp of its own for each chapter, with reachability tests | Chapters IV and VI–XII have their own maps; V keeps the pilot courtyard. Twelve different maps and twelve arrangements of the places. | `living-camps`, `world-hubs` |
| The named cast, each with an absence branch | All twelve the plan names (below) | `living-camps` |
| Errands, two or three each in IV–XII, training points within a raised, audited ceiling | Two each, 2 points each: the ceiling rises from 237 to 273 points on every training path ([audit](tp-audit.md)) | `living-camps`, `tp-audit` |
| The five titles never awarded become rewards | Each the reward of one errand | `living-camps` |
| The existing company stories and situations stay reward-free | Unchanged | `company-stories`, `world-hubs` |
| A trader in every chapter with regional goods | Seven new traders in V–XI, and Syra in IV and XII as in I–III | `living-camps` |
| Defeat pages for every encounter | 25 of 25 | `living-camps` |
| Replies that depend on who the soldier is | 2–6 a chapter, 28 in all | `living-camps` |
| The five figures moved here from release 6 | Generated on 30 October, after the owner approved their credits ([below](#the-five-figures-30-october)) | — |

## The camps

| Chapter | Camp | Gate | Its own things | Trader | Errands |
| --- | --- | --- | --- | --- | --- |
| IV | The frontier ford court | south, with a postern on the reeds | the gate's brace rack, the postern lookout | Syra the sutler | Braces for the gate (Quartermaster Aper); Rafts below the far bank (Brennus) |
| V | The Euphrates staging courtyard (the pilot's layout) | south | the water board | Barnaios the date-seller | A bowl of water on the paving (the engineer); A letter downriver (your companion) |
| VI | The eagle's retreat halt | west | tracks beside the refuge, the western road marker | Abgar the water-seller | Water to the west (Felix); Leather for the pole (the eagle-bearer) |
| VII | The council camp before Milan | east | the boot tally | Vibia the wine-seller | Boots for the march (Naso); The order of a speech (Theon) |
| VIII | The Danube ferry assembly | south, open to the river | a seed jar, the ferrymen's depth board, the sounding pole | Dida the honey-seller | Depth at the landing (Felix); The Ulpii's seed (Aelia) |
| IX | The surrender court on campaign | south | the requisition tally | Malku the incense-seller | The recall signal (your companion); The granaries' count (the city's envoy) |
| X | The governor's relief courtyard | south-west | the granary receipts, the seized warehouse tally | Caecilia the grain-seller | The diverted grain (the provincial clerk); A witness who will not speak (Theon) |
| XI | The service-record portico at Rome | south | the station report, the provincial accounts | Atticus the bookseller | The station report (Paullus); A question in writing (Crispus) |
| XII | The loyal standards court | south | the legions' standards | Syra the sutler | The seal at the standards (Quintus); Seed for next spring (Aelia) |

In Chapters IV and VI–XII the three scenery pads, where the regional props stand, moved where the new layouts leave room. In every camp each pad's cells are blocked, and each pad stands at least 3.2 m from every person, object and place (`world-hubs`).

## The cast in camp

| Person | Camps | Absence or replacement |
| --- | --- | --- |
| Varro | IV, V, VI | Gone from Chapter VI's camp once he is left to his orders; not in VII–XII |
| Lucan or Sabinus | IV–XII | Chapter II's decision: never both |
| Naso and Felix | IV, VI–X, XII | At the valetudinarium while recovering |
| Crispus | IV, VII, XI | In VII only until the council: he leaves for Rome |
| Brennus | IV | — |
| Quintus | IV, XII | — |
| Severianus | VI–XI; XII while he backs you | In XII his messenger stands there if the patron's standing is neutral, the treasury's envoy if it is hostile |
| Aelia Dacia | VIII, X, XII | — |
| Paullus | XI; XII before the legitimacy Contest | Gone from XII's camp after it |
| Theon | VII, X, XI | — |

Lucan, Sabinus, Naso and Felix also wait at the valetudinarium while recovering in every later camp but V, where the pilot's layout has no ward. Presence uses the same conditions as the chapter scenes (`storyWhen`), so a camp never shows a man the story has removed.

## Errands and training points

Each errand is offered by its person, accepted, done by a legal reply or the use of an object, and reported; the reward is given once, on the report, and saved with the soldier's errands. Some errands ask for the right answer, such as which track leads to water or how many rafts there are. A wrong answer costs nothing, and the errand can be tried again. Where one asks for persuasion there is always a way that needs nothing of the soldier.

The most training a campaign can give rises from 237 to 273 points on each of the three training paths, 4 a chapter from IV ([audit](tp-audit.md)). A chronicle begun before 0.40 that now chooses its soldier's training receives the audit's total for its completed chapters (`game.js`), and so the larger total.

## Calibration

The sweeps ([Story](evidence/realtime-release8-sweep-story.json), [Standard](evidence/realtime-release8-sweep-standard.json), [Veteran](evidence/realtime-release8-sweep-veteran.json)) play each seed's campaign from New Game in release 7's three passes:

- each chapter's first decision;
- the decisions that change a field the other way, with each battle's second operation chosen in camp (`--operations=other`);
- every finale route from each seed's Chapter XII camp.

A lost battle is retried from its checkpoint, by the legal Retry command, up to once on Story, twice on Standard and three times on Veteran. The bot does no errands and buys nothing, so this release's campaigns should play exactly as main's.

Main (`d8fb36e`) was swept on the same seeds with the same bot, beside this release's `672c6f3`, one sweep at a time with nothing else running on the container:

- on Standard, this release and main in turn, twice each;
- on Story, this release, then main;
- on Veteran, main, then this release.

The later commits change only how the figures are drawn, which packs carry the woman's figure, and documents. The sweep loads none of them: its 85 modules are the rules, the data and the bot.

**Every result matched main's.** On each level every result of this release equals main's in every recorded field but the tick times: status, rounds, slack, losses, plans, weather, ambushes, hidden bands and incidents. That holds for 620 results on Story, 620 in each of the four Standard runs and 627 on Veteran.

### Against the plan's targets

Each target counts the 13 battles of pass 1 and the 5 finale routes of pass 3 on each of 20 seeds: 360 battles a level.

| Target | Story | Standard | Veteran |
| --- | --- | --- | --- |
| Won on the first try: Story every one, Standard ≥ 90%, Veteran ≥ 70% | 360 of 360 | 360 of 360 | 357 of 360 |
| Won within the tries allowed (one, two, three) | 360 of 360 | 360 of 360 | 360 of 360 |
| At least three enemy plans in each battle across the seeds | every battle | every battle | every battle |
| The finale's battle lasts 8–12 of its 16 rounds | 10 rounds | 8 rounds | 8 rounds (8–9 on the backer's route) |
| The simulation's tick rises by at most 0.3 ms at p95 | +0.05 ms at most (V, the mine) | +0.04 ms at most (IV, the wall) | +0.06 ms at most (V, the mine) |

On Veteran the three first tries lost were the sortie's, on seeds 1, 11 and 18, each won at the second try. The same battle after the chapter's other decision (pass 2) lost four first tries (seeds 1, 6, 11 and 15), all won at the second. Both are exactly as on main and in release 7: the defended line broke in each.

### Tick time

The plan's budget: no battle's tick at p95 may rise by more than 0.3 ms over the previous release, measured on the same seeds, one sweep at a time. Nothing in a battle changed, so the differences are the container's noise. Each cell gives main → this release, in milliseconds. On Standard each is the mean of two runs a side; on Story and Veteran there is one run each.

| Battle | Story | Standard | Veteran |
| --- | --- | --- | --- |
| IV, the gate | 0.86 → 0.82 | 0.78 → 0.70 | 0.73 → 0.70 |
| IV, the wall | 0.71 → 0.64 | 0.62 → 0.65 | 0.65 → 0.59 |
| V, the mine | 0.75 → 0.81 | 0.69 → 0.73 | 0.64 → 0.70 |
| V, the wall | 0.93 → 0.86 | 0.79 → 0.76 | 0.77 → 0.78 |
| VI, the wells | 0.76 → 0.69 | 0.77 → 0.70 | 0.74 → 0.69 |
| VI, the eagle | 0.66 → 0.65 | 0.69 → 0.67 | 0.65 → 0.66 |
| VII, the legion | 1.02 → 0.99 | 1.00 → 0.93 | 0.95 → 0.99 |
| VIII, the ferry | 1.05 → 1.02 | 0.98 → 0.99 | 1.01 → 1.03 |
| VIII, the crossing | 0.97 → 0.87 | 0.92 → 0.88 | 0.93 → 0.88 |
| IX, the wing | 0.83 → 0.81 | 0.75 → 0.73 | 0.70 → 0.74 |
| IX, the city | 0.91 → 0.94 | 0.92 → 0.88 | 0.89 → 0.88 |
| X, the road | 1.00 → 1.00 | 0.93 → 0.90 | 0.89 → 0.90 |
| XII, the confrontation | 1.03 → 0.92 | 1.04 → 0.99 | 1.09 → 1.04 |

Each sweep also checks its ticks against the Gate 4 sweep, recorded on another day. Six of the eight runs exit with that check unmet, all four of main's among them: Chapter IV's gate rises by +0.25 to +0.44 ms against it. As release 7's report found, runs on different days are not comparable on this container, so only the runs made in turn here are compared. None of these times is a phone's.

## The browser checks

All in headless Chromium with software rendering (SwiftShader), on the production build:

- **Four of the new camps** (IV, VI, VII and IX), in a partial run of the twelve-camp check (`--chapters 4,6,7,9`), on a build made before the women's figures changed. Each camp was restored from a legally earned save through the Restore dialog. Every regional model loaded, all three cameras worked, and the previous chapter's scenery was released. A partial run is a diagnostic, not the check's acceptance, which CI runs on all twelve camps.
- **Before and after:** the overview and horizon cameras of the eight camps with new layouts (IV, VI–XII), on main's build and this release's, each restored from the same legally earned save through the Restore dialog on Balanced. A scratch script, not committed, took the shots; the sheets went to the owner.
- **In CI on the pull request:** `npm run smoke`, the polish, usability, Chapter V pilot, immersive, siege and twelve-camp checks, the twelve-chapter benchmark and the stage benchmark against its ceilings. They were not run locally on the final commit.

## Downloads

Gzip sizes from the build report (the sum of each set's files, the service worker included; not a browser's network trace), main (`d8fb36e`) built beside this release:

| Download | Limit | Main | This release |
| --- | ---: | ---: | ---: |
| First load | 2 MB | 0.90 MB | 0.94 MB |
| Chapter I in 3D | 16 MB | 13.61 MB | 13.84 MB |
| The largest chapter, with its 2D art | 24 MB | 21.30 MB (VII) | 22.16 MB (VII) |
| The complete campaign | 80 MB | 42.99 MB | 43.02 MB |

The release adds no art. Its camps, conversations, errands and pages are code and data: 32 kB on the first load and on the complete download. Two changes move the chapter packs:

- **The woman's figure** (her anatomy and complexion, 0.19 MB) is now in every chapter's pack, where Chapters I–VII had none.
- **The cast's bodies** go with the camps they now stand in. Chapter IV's pack carries Varro's, Brennus's, Crispus's and Syra's bodies (2.28 MB more in all), VII's and XI's Crispus's (0.63 MB each) and XII's Syra's (0.39 MB).

Chapter VII, the largest, grows from 21.30 to 22.16 MB, within its 24 MB limit.

## The five figures (30 October)

The owner approved the five figures' credits on 30 October ("Approve the five figures for release 8"): 45 each, 225 in all, and up to 90 for retries. Severianus, Aelia, Paullus, Theon and Quintus were generated from text prompts with Tripo, rigged by its biped rig and bound to the game's skeleton, each at its first attempt: 225 credits, the balance reading 1,705 before and 1,480 after ([ledger](../art-source/models/worlds-plan-credits.json)). Aelia and Quintus were made first, as a gate, and looked at in the game before the other three were generated. The [art record](art-generation.md#the-five-camp-figures--30-october-2026) has the prompts and what review found, and [the asset pipeline](asset-pipeline.md#the-five-camp-figures--2026-10-30) how they were made.

| Figure | Camps (offline packs) | Head | Maps | File |
| --- | --- | --- | --- | ---: |
| Signifer Quintus | I, IV, XII | his own, on the shared head | 512 / 256 | 397,788 bytes |
| Aelia Dacia | VIII, X, XII | her own generated head | 1,024 / 512 | 426,916 bytes |
| Marcus Aurelius Severianus | VI–XI (and XII, online) | his own, on the shared head | 512 / 256 | 391,728 bytes |
| Lucius Cassius Paullus | XI, XII | his own, on the shared head | 512 / 256 | 414,156 bytes |
| Theon of Nicomedia | VII, X, XI | his own, on the shared head | 512 / 256 | 394,856 bytes |

- **The four men** wear the shared head wrapped onto their own generated heads, as release 6's named men do, so they blink and speak with its expressions. Severianus, Paullus and Theon wear civilian dress and no neckcloth over the head's seam (`civilian` in `actor-body-catalog.js`); Quintus, a soldier, wears the neckcloth as the named soldiers do.
- **Aelia keeps her own generated head.** The shared head is a man's: wrapped onto hers, its longer chin sat under hers and took her neck's shadow, which read as a dark beard, and it brought a man's neck to the seam. With her own head, as the camp's other women have, she has her face, her hair and her earrings, but no blinks or expressions.
- **A level down.** At the release 6 cast's 1,024-pixel maps, Chapters VII and XII would have passed their 24 MB downloads (about 24.5 and 24.1 MB). The four men stand only in camps, so their body and head maps went down a level, as the plan provides before any limit is raised.
- **Chapters.** Each body is in the offline packs of the camps it stands in, which the exact-chapters test holds to the campaigns both ways through Chapter II's decision. Severianus also stands in Chapter XII's court when he backs the soldier, which neither campaign earns: XII's pack leaves him out (see below).
- **Corrections.** The asset manifest and the requests for Varro, Brennus, Crispus and Syra now list the camps they have stood in since this release, and the body tests' named legionary is the soldier himself, as every man the cast names now has a body of his own.

How they were checked:

- **Automated tests:** `actor-bodies` checks the chapters, each body's Tripo task, rig, licence, manifest entry and budget, its six maps (three for Aelia) and its bind pose; a new test checks the civilians' necks, Quintus's neckcloth and Aelia's own head. `living-camps` now expects Aelia in her own body, and no man in hers or Syra's.
- **Software rendering** (headless Chromium, SwiftShader): the game's own figures of the five, beside Lucan, in full and close views, on main's build and this one (a scratch script, not committed; the sheet went to the owner), and each man's face at both map levels.
- **The twelve-camp check** (`npm run smoke:world`, the production build) passed all 21 of its scenarios on a build made before the civilians' neckcloth change: every camp's models and three cameras, the services, the narrow layouts, Performance, the return across the regions, and a camp with every model download failing. On the final build, a partial run of Chapters VII and XI passed (a diagnostic, not the check's acceptance, which CI runs on all twelve).
- **Not performed:** a person looking at the figures in play, and any check on a phone or a laptop.

Downloads (gzip sum of each set's files, from the build report, main `d1ba4dd` built beside this change):

| Download | Limit | Main | With the five |
| --- | ---: | ---: | ---: |
| First load | 2 MB | 0.94 MB | 0.94 MB |
| Chapter I in 3D | 16 MB | 15.00 MB | 15.37 MB |
| Chapter VII, the largest, with its 2D art | 24 MB | 23.21 MB | 23.94 MB |
| Chapter XII with its 2D art | 24 MB | 22.33 MB | 23.49 MB |
| The complete campaign | 80 MB | 51.60 MB | 53.49 MB |

Limitations:

- **Follow-up, 31 October:** the [camp and character follow-up](camp-character-followup.md) supersedes the following original download, Severianus and Aelia limitations with bounded prop packing, the conditional XII offline body and own-face expressions. The original release measurements below remain historical evidence.
- **Chapter VII was 65 kB under its limit.** Anything more in VII had to be paid for first.
- **Offline, Severianus in XII.** He stands in Chapter XII's court only when he backs the soldier. XII's offline pack leaves his body out, so offline he keeps the procedural figure and his face there; online his body loads as anywhere else.
- **Aelia does not blink.** Her own head has no expressions, as Syra's has none.
- **The prompts' departures** kept: short sleeves on the three civilians, Severianus's purple at his edges rather than in narrow stripes, and Paullus's sandals (see the [art record](art-generation.md#the-five-camp-figures--30-october-2026)).
- **The figures are as tall as the men's skeleton,** Aelia's included, as every generated body is fitted to the game's one skeleton.

## Limitations

- **Real time only.** The conversations, errands and traders are in the walkable camp, its scene and its list path (People & conversations). The turn-based camp page lists no people, as in Chapters I–III before, so a turn-based campaign never meets them.
- **The five figures** followed on 30 October; their own limitations are [with them](#the-five-figures-30-october).
- **The words.** The conversations, errands and defeat pages are original prose for this project. Apart from fixed public history (Gallienus outside Milan, the withdrawal from Dacia, Aurelian's eastern victories), their episodes are invented. They have been checked by the automated tests, not read in play, and the plan's optional content review by the owner has not happened.
- **The women's figures.** Vibia, Dida, Caecilia and Licinia are drawn as the procedural woman, the figure Aelia already used, each with features of her own. They were looked at only in the scratch renders, under software rendering, at the cameras' distance.
- **The character handoff notice.** `npm run verify` now reports that the art-source handoff exports were made from an earlier character source. That source's digest covers every actor file under `src/showcase/`, and this release edits two of them for the women's figures. The three exported figures (Marcellus, Lucan and a Persian guard) are drawn exactly as before, so, as the [handoff's README](../art-source/characters/README.md) advises, they were not re-exported.
- **Not checked:**
  - a person walking the new camps, doing the errands or reading the conversations;
  - the camps on a phone, a laptop or with a screen reader;
  - whether the dimmed replies read clearly in play.

# Worlds and gameplay, release 11: chests, the armourer and the armoury

Release 11 is the first of the four releases the owner approved on 1 November 2026 (releases 11–14 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md)), which bring the genre's treasure chests, a blacksmith and its navigation to Imperium in Imperium's own Roman style. It puts containers to open in every camp and on most battlefields, an armourer in every camp, finer and named kit, and kit that counts in every battle: against squads, and against new champions who seek the soldier out. The enemies are retuned for a soldier who uses what he finds, the same on every level. This report records what changed, how it was checked and what was not checked. The [changelog](../CHANGELOG.md) describes the changes for players.

No credits were spent: the containers, the forge and the armourer's tools are built in code from the scenery's own pieces. The item pictures of release 13 will spend the first credits of the approved cap.

How each kind of check was made:

- **Automated tests** (Node.js): `npm test`. New:
  - `containers`: the data, keys and locks; opening once in camp; staging on the field; Practice; reload and Retry; refusals leaving the chronicle and its generator unchanged; hidden caches found by walking close or by Scout;
  - `champions`: kit against squads, a champion in each battle that has one, the same on every level, and every key to a locked field container carried on its field;
  - `kit-audit`: the audit's document is current and finds no problem;
  - `container-props`: every kind of container built closed, open, emptied and locked from the fieldwork kit's own materials, batched; the stage showing a hidden cache only once it is found; opening a camp chest changing the camp world but never its scenery; every camp's forge behind its armourer, clear of the camp's objects; and the 2D view drawing the forge and the containers in sight, a lock while locked, and never a hidden cache.

  `realtime-separation` adds the ranks' rule (below) to its reference sweep and to its generated crowds, and checks it on its own.
- **Sweeps** (Node.js, headless, on the development container): the bot plays the campaign from New Game, every battle by legal Commands, on 20 campaign seeds, as three reference players on each level they set targets for (see [Calibration](#calibration)). For the first time the sweeps include Chapters I–III. A bot is not a player.
- **The real interface:** the production build in headless Chromium with software rendering (SwiftShader): the browser checks and the stage benchmark (see [The browser checks](#the-browser-checks)).
- **Not performed:** a person playing any of it, and any check on a phone, a laptop or with a screen reader.

## What changed

| Change | Where it shows | Code and data | Randomness |
| --- | --- | --- | --- |
| Containers in every camp | Three or four a camp (37), opened once; 11 locked, 3 hidden | `data/containers.js`, `core/soldier.js` (`unlock`, `takeFrom`, `soldier.opened`), `camp-world.js` | none |
| Containers on the battlefields | One or two on 17 battles (19), staged with the spoils; 3 locked, 3 hidden | `data/containers.js`, `realtime/containers.js`, `campaign-encounter.js`, `game.js` (`openFieldContainer`, `takeFromContainer`) | none |
| The armourer | Bassus at the quartermaster's place in every camp, with 24 fine pieces over the campaign | `data/soldier.js` (`SMITH`), `data/camps.js`, `data/dialogue.js` (`hub:smith`) | none |
| Finer and named kit | 25 fine pieces, 6 named pieces, 14 keys: 108 items in all | `data/items.js`, `data/realtime-rules.js` | none |
| Kit against squads | A squad's blows on the soldier, less his armour's share (at most 65%) and his shield's half-share from the front | `squads.js` (`singleWard`), `data/realtime-squads.js` | none |
| Champions and officers | One single man seeking the soldier in each of 11 battles of Chapters IV–XII, with fine or named kit or a key | `data/champions.js`, `campaign-encounter.js`, `ai.js` | none |
| The ranks make way | A man in his formation's ranks steps aside for a friend walking through | `motion.js` (`separateBodies`) | none |
| Containers and the forge on the stage | The containers in sight in 3D and 2D, closed, open or emptied; the forge behind the armourer; his apron, hammer and tongs | `container-props.js`, `environment-smithy.js`, `live-figures.js`, `flat-stage.js`, `actors.js` | none |
| The kit audit | `docs/kit-audit.md`, checked by `npm test` | `core/kit-audit.js`, `scripts/kit-audit.mjs` | none |
| Reference players | The sweeps play a bare, an issued and an engaged soldier | `scripts/kit-policy.mjs`, `realtime-autoplay.mjs`, `realtime-sweep.mjs` (`--kit`, `--first`) | none |

Container contents are authored, the same on every level, and drawn from no random stream. A camp container records what was taken from it in the chronicle (`soldier.opened`, at most 300 entries, validated), so it opens once and a reload cannot repeat it. A battlefield container's items are staged like the spoils of the fallen: one commit, Retry restores the start, and Practice can look but not take. `WORLD_VERSION` is 7; a fight saved by an earlier version restarts from its checkpoint, except one already won but not yet recorded, which is kept.

## Against the plan

| Plan item | As built |
| --- | --- |
| About three containers a camp, one or two on most battlefields; keys or force; Scout reveals hidden caches from Chapter III | 37 in camps and 19 on 17 battlefields. Every lock has a key in the same camp or field (a container, an enemy or a champion carries it), and the force needs an attribute. Walking close finds a hidden cache in camp and on the field; Scout also reveals one on the field. |
| A smith in every camp, at the quartermaster's place, with an anvil and racks | As planned. He wears the camp staff's existing civilian body, with a code-built apron and his hammer and tongs at work. His forge stands behind him, away from the way the soldier comes. |
| About twice as many pieces | 25 fine and 6 named pieces, and 14 keys. |
| Armour and shield reduce squad blows, shown as a named modifier | The reduction applies. The character panel shows it as **Against squads** (see below); the battle forecast still shows only the soldier's own blows. |
| Champions in Chapters IV–XII, the same on every level | 11 champions. The Chapter V river gate has none: there one drew the squads off the wall they must hold. Chapter VI's starts with the pursuit, which hunts the column. |
| Retuned enemies, by tiers, archetypes and champions, the same on every level | Only the champions were tuned: the tiers and archetypes needed no change (see [Calibration](#calibration)). |
| `setKit` restricted | A campaign world refuses it. Only the standalone arena changes kit in the world. |
| The turn-based mode unchanged; a turn victory collects the field's containers | As planned: their items go to the camp's ground strip, keys excepted. |
| One texture level down in Chapters VII and XII | Not done. This release adds no download (the containers and the forge are code), so it is left to release 13, if the item pictures need the room. |
| Sweeps of three reference players on all three levels | Six sweeps: the players each level's targets name (below). Story's engaged player and Veteran's bare one were not swept. |

## The containers

Each camp has three or four containers, in its places: a spare-kit chest at the stores, the soldier's locker in the barracks, an old armoury chest, a strongbox, a coffer, a cache under the stones. Most battlefields have one or two: an officer's strongbox, a raider's cache, abandoned baggage, a ferryman's chest. Each says why the soldier may open it. In camp, a container opens from the panel it shows when the soldier walks to it. On the field, it opens with the weapon sheathed and the soldier beside it. After a victory, **Search the field** lists the containers left with something in them, with the fallen's spoils.

- **Locks.** A locked container opens with its key, which is found elsewhere in the same camp or field, or is forced by a soldier strong enough. On the field, forcing it takes five seconds and stops if he is struck. There is always a way that needs no attribute.
- **Hidden caches** show themselves to a soldier within 2.5 m, and half a metre more for every point of Perception above 10. On the field, Scout reveals them too. The stage draws a hidden cache only once it is found.
- **Named pieces** are found only in containers and on champions, never on the armourer's rack.

## The armourer and the kit

Bassus the armourer works beside the quartermaster in every camp. He sells finer weapons, armour, helmets and shields, a few more each chapter, and buys kit. The quartermaster keeps pay, issued kit and spoils; the traders keep goods and charms. A fine piece beats the standard piece of its kind on the shelves by then (the kit audit checks it). The [historical notes](historical-research.md) give the period evidence for the new pieces.

**Kit against squads.** When a squad's men strike the soldier, his armour turns a share of their blows: its mean resistance to cut, point and crush, at most 65%. A carried shield turns half its block more, from the front only. The recruit's issued kit turns 34% from the front and 27% from the flank. By Chapter VII the issued soldier's mail and scutum turn 58% and 51%, and the engaged soldier's finer kit 70% and 63%. The character panel's **Against squads** line shows his own shares.

## Champions

In 11 squad battles of Chapters IV–XII, one single man seeks the soldier out: a war band's chieftain or war leader, a Persian captain, a mercenary captain, an armoured Palmyrene officer, the claimant's guard captain. He knows where the soldier is, seen or not. He fights by the full blow rules, so the soldier's weapon, armour and shield count against him as they do in Chapters I–III. He carries fine or named kit, or a key, to take from him. He is the same on every level.

The kit audit's duels show what the kit is worth against him. In Chapter VII, for example, the issued soldier needs 13.9 s to fell the mercenary captain and would survive 96.6 s of his blows, face to face. The engaged soldier needs 5.9 s and would survive 149.1 s. A recruit who wears and trains nothing needs about 20 s and survives about 28 s. Beside his companions he still outlasts the captain, which the Story sweep of the bare player confirms.

## Calibration

The bot plays three reference soldiers, all by legal commands (`scripts/kit-policy.mjs`):
- **bare:** the calibration bot of earlier releases. It wears only the recruit's kit and spends nothing.
- **issued:** draws pay, wears the best of what he carries and spends half his training points.
- **engaged:** also opens every container he can, sells his spoils, buys the upgrades with the largest gain for their price from the armourer and the quartermaster, searches the won field and spends all his training points.

Each sweep covers 20 seeds in Chapters I–XII:
- **Pass 1:** each chapter's first decision.
- **Pass 2:** the decisions that change a field.
- **Pass 3:** every finale route.

Across the 24 counted battles (Chapter XII's confrontation counted once) and the five finale routes, that makes 480 battle-seeds per sweep. The results, against the [plan's targets](worlds-and-gameplay-plan.md):

| Level | Player | Won at the first try | Within 2 tries | Within 3 tries | Battles lost at the first try | Tick p95, worst battle |
| --- | --- | --- | --- | --- | --- | --- |
| Story | bare | 480/480 (100%) | 480 | 480 | — | 0.78 ms |
| Story | issued | 480/480 (100%) | 480 | 480 | — | 0.87 ms |
| Standard | issued | 480/480 (100%) | 480 | 480 | — | 0.83 ms |
| Standard | engaged | 480/480 (100%) | 480 | 480 | — | 0.79 ms |
| Veteran | issued | 473/480 (98.5%) | 480 | 480 | the marsh (II) 18/20, the river gate (V) 15/20 | 0.83 ms |
| Veteran | engaged | 479/480 (99.8%) | 480 | 480 | the river gate (V) 19/20 | 0.76 ms |

| Target | Result |
| --- | --- |
| Story: the issued soldier wins every battle at the first try; the bare one within two | Met: 480/480 at the first try, and the bare one too. |
| Standard: engaged ≥90% at the first try and all within 2; issued ≥80% and all within 3 | Met: 100% each. |
| Veteran: engaged ≥70% at the first try and all within 3 | Met: 99.8%. |
| Upgrades count: in Chapters I–III and against champions, engaged beats issued by ≥10 points of first-try wins on Veteran | **Not met.** Both win nearly everything: in I–III 100% against 98.0%, against champions 100% each. |
| Upgrades count, as the owner replaced it on 1 November: in Chapters I–III and the eleven champion battles, on Veteran engaged ends its wins with ≥3 points more health than issued and wins ≥0.3 rounds sooner; on Story, issued ends the champion battles with ≥10 points more health than bare | Met (`scripts/upgrades-check.mjs`): 4.0 points more health, 0.44 rounds sooner, and 17.2 points on Story. |
| At least 3 enemy plans in each squad battle across seeds | Met in five sweeps. In Story's bare sweep the ferry (VIII) saw two plans in pass 1, in 40 seeds as in 20 (below). |
| Tick p95 within 0.3 ms of the Gate 4 sweep | Met in all six (largest rise +0.14 ms, with three sweeps running at once). |

**Upgrades show in health and pace, not wins.** The bot that wins today's game on every level still wins it with any kit, so finer kit does not change whether the bot wins. It changes what a win costs. The soldier's health at the end of first-try wins:

| Level | Player | Chapters I–III: mean (lowest) | Champion battles: mean (lowest) | Squad battles IV–XII: mean (lowest) |
| --- | --- | --- | --- | --- |
| Story | bare | 92% (46%) | 77% (48%) | 81% (48%) |
| Story | issued | 94% (46%) | 93% (48%) | 94% (48%) |
| Standard | issued | 91% (31%) | 94% (64%) | 95% (64%) |
| Standard | engaged | 94% (50%) | 98% (83%) | 98% (83%) |
| Veteran | issued | 88% (12%) | 94% (67%) | 95% (67%) |
| Veteran | engaged | 93% (46%) | 98% (83%) | 98% (83%) |

The engaged soldier also wins Chapters I–III a quarter of a round sooner on Veteran (3.95 rounds against 4.22). For kit to decide wins on Veteran, Veteran's enemies would have to be harder than Story's, which the plan rules out. The owner sets the final feel at Gate 4.

**Fixed on the way.**
- **Chapter VI's champion** first stood beside the archers. There he drew the soldier and two squads away from the protected column: Story's issued player lost the wells on 3 of 17 seeds in round 3. He now starts with the pursuit that hunts the column (`beside: 'raider'`), and every seed wins.
- **The later champions** first killed a recruit who wears and trains nothing: Story's bare player lost Chapter VII's battle and the finale on several seeds. Five champions of Chapters VI–X are a little weaker now (the eagle's standard-breaker, the mercenary captain, the crossing's champion, the city's captain, the raiders' chief), and the claimant's guard captain in Chapter XII markedly so (`data/champions.js`). They still lose badly to an issued or engaged soldier.
- **The ranks make way.** In one Story sweep of Chapter VI's eagle, every enemy fell by round 7, but the soldier stood 10.07 m from the 10 m exit until the deadline passed. Three of his own squads stood in formation between him and the exit, and crowd separation pushed him back as fast as he walked. A man standing in his formation's ranks now steps aside the whole overlap for a friend walking through: the soldier, a companion or a protected column. Men who are fighting, and enemies, are jostled as before. The saved stalled world, resumed with the rule, finishes at once.

**The ferry's plans.** On Story, against a soldier who wears and trains nothing, the ferry's enemy narrowed to holding the front or turning the right flank in every first-decision run (pass 1). A second run over 40 seeds gave the same. Only the second pass's decisions brought the left flank (2 runs) and a feint (1 run). The enemy feints only when its own bands are worn down near its archers, which the unequipped soldier is slow to do. Every other player and level saw all four plans in pass 1.

## Re-checked after #82

On 7 November the six sweeps were run again on the game as it then stood, after the owner's #82 widened the ordinary formations. Line and wedge went from 1.1 to 1.25 m between men, column from 1.2 to 1.3 m and loose from 1.6 to 1.8 m; the shield wall stayed at 0.8 m. The settings were release 11's: 20 seeds a sweep, Chapters I–XII, each level's tries, one sweep at a time. The evidence is in `docs/evidence/realtime-release11-recheck-sweep-*.json`, and `npm test` checks its upgrades count as it checks release 11's. The table's "after #82" figures come from the same six sweeps run on #82 as merged (6ff2624), before the two fixes below. Those sweeps are not kept: run on that commit, the same commands reproduce them, tick times aside.

**What moved the numbers.** The code just before #82 replays release 11's sweeps exactly, battle by battle: one seed of each sweep was checked, and two of Veteran's engaged one. Every change below therefore comes from #82 and the two fixes it led to. Chapters I–III have no squads and play exactly as before.

**Chapter VI's eagle opened the same way every time (fixed).** At the battle's opening the pursuers plan from what they see. Before #82 they saw the company's archers, which makes a flank worth trying, and the battle opened on a flank in 16 of 20 seeds. The archers' squad stood just behind the corner of a rock, about 53 m from the pursuing archers. #82's wider ranks moved its centre 0.1 m, and the sight line clipped the rock. Every seed then opened on a frontal attack, and the battle saw one or two enemy plans in all six sweeps, against a target of three. In real time the company's rear pair now forms up 4 m further north, in sight with metres to spare (`REALTIME_STARTS` in `data/realtime-squads.js`; the 0.38 board is unchanged). A flank opens the battle again, and every sweep meets the target in every battle, the ferry's on Story bare included.

**Chapter IV's wall walk ran to its last round (retuned).** After #82, Veteran's narrowest first-try win with the engaged player came in the battle's tenth and last round. The column reached the far stair in round 7 and waited 6 m from the goal while the soldier went back to fight. The extraction needs both at the goal, and the battle was won only when the last enemy fell. In real time the battle now has two more rounds on every level (`REALTIME_EXTRA_ROUNDS` in `data/realtime-rules.js`): 12 on Veteran, 14 on Standard and 17 on Story. Nothing reads the clock before it runs out, so every battle won before plays exactly as before. The final sweeps match the sweeps run with the eagle fix alone in all of their nearly 5,000 battle records, except that the 240 wall walks each have two more rounds on the clock and two more to spare.

| Level | Player | Won at the first try | Smallest margin at the wall walk: release 11 → after #82 → now | Median squad losses at the wall walk: release 11 → now |
| --- | --- | --- | --- | --- |
| Story | bare | 480/480 → 480/480 | 6 → 5 → 7 rounds | 0.32 → 0.47 |
| Story | issued | 480/480 → 480/480 | 5 → 7 → 9 | 0.47 → 0.59 |
| Standard | issued | 480/480 → 480/480 | 3 → 4 → 6 | 0.52 → 0.59 |
| Standard | engaged | 480/480 → 480/480 | 4 → 2 → 4 | 0.54 → 0.54 |
| Veteran | issued | 473/480 → 474/480 | 0 → 2 → 4 | 0.49 → 0.59 |
| Veteran | engaged | 479/480 → 479/480 | 2 → 0 → 2 | 0.54 → 0.56 |

| Target | Release 11 | Re-check |
| --- | --- | --- |
| Each level's first-try and within-tries targets | Met in all six | Met in all six |
| At least 3 enemy plans in each squad battle across seeds | Met in five; the ferry saw two on Story bare | Met in all six, in every battle |
| The finale's battle lasts 8–12 of its 16 rounds | Met | Met: 8 on Standard and Veteran, 10 on Story |
| Upgrades count, Veteran: ≥3 points more health with the engaged player | 4.0 points (range 3.3 to 4.7) | 3.8 points (range 3.2 to 4.5) |
| Upgrades count, Veteran: ≥0.3 rounds sooner | 0.44 rounds (range 0.39 to 0.48) | 0.33 rounds (range 0.26 to 0.40) |
| Upgrades count, Story: ≥10 points more health against the champions | 17.2 points (range 16.1 to 18.6) | 17.3 points (range 16.0 to 18.6) |
| Tick p95 within 0.3 ms of the Gate 4 sweep | Met | Met, but measured on a different machine, so not comparable |

- **Veteran's "wins sooner" margin is thin now.** It is still met on average, but its 90% range over seeds (0.26 to 0.40 rounds) dips below the 0.3 target, so a different set of seeds could miss it.
- **Wins ending below half health,** reported without a pass mark: Story 10 → 2 (bare → issued; 18 → 3 in release 11), Standard 6 → 0 and Veteran 8 → 2 (issued → engaged), as in release 11.
- **The wall walk's squads lose a little more** with the lesser kits than in release 11. The medians in the table above overstate it; on 40 seeds the mean rose by 1.6 to 3.2 points of strength, within the battle's spread ([followed up on 8 November](#followed-up-on-8-november-three-shifts-on-more-seeds)). The two extra rounds do not change it.

### Followed up on 8 November: three shifts on more seeds

The owner asked for three shifts to be fixed: the wall walk's squad losses, Chapter IX's cavalry battle growing easier for the issued kit, and Veteran's thin "wins sooner" margin. Each was measured again on seeds the sweeps above never played:

- the six reference players on seeds 21–40, and some on seeds 41–60, as the sweep's first pass plays them (`node scripts/battle-seeds.mjs`);
- the two Veteran sweeps on 40 seeds instead of 20;
- the code just before #82 (edfe269) beside today's.

The result: one of the three shifts is real, and none of the data changes tried fixes it on every seed set. **The game is unchanged.**

- **The wall walk's losses: no real shift.**
  - Over 40 seeds, the lesser kits' squads lose 1.6 to 3.2 points more of their strength than before #82, and the engaged kit's the same as before (+0.1 to +0.2). Every 90% range includes no change.
  - The medians above moved further, 32% → 46% on Story bare, because each kit's losses fall in two clusters: seeds that lose about a third and seeds that lose about three fifths. A few seeds changing cluster move a median a long way and a mean only a little.
  - The engaged kit's later wins, 0.7 rounds on seeds 1–20, do not recur on seeds 21–40 (0.1 rounds sooner). Over 40 seeds they come 0.3 rounds later.
  - Moving the enemy guard squad 3 m back from the last approach looked right on seeds 1–20. On seeds 21–40 it made the battle easier than release 11: up to 5 points fewer losses and up to 0.45 rounds sooner. It was not kept.
- **Chapter IX's cavalry battle: real, and left as it is.**
  - Over 40 seeds, the issued kit ends the battle 2.9 (Story), 5.9 (Standard) and 4.6 (Veteran) points healthier than before #82, and wins 0.3 to 0.5 rounds sooner on Standard and Veteran. Every one of these ranges excludes no change. The engaged kit and the bare recruit are nearly unchanged.
  - All of the soldier's damage there comes from the champion, the Palmyrene armoured officer. #82's wider lines stand across his ride to the soldier, so he reaches him later: on seed 1, in round 2 instead of round 1. They also keep the soldier facing him. On seeds 21–40, 18% of his blows at the soldier came from the flank before #82, which passes the shield, and 7% after.
  - Tried on fresh seeds:
    - our second infantry squad starting 3 m north;
    - the champion starting 3 m north, 3 m south or 5 m south;
    - his combat 1 or 2 higher, with and without the south start;
    - his strength 20 instead of 15.
  - None brought the issued kit back without moving the other players by as much. The same change moved results in opposite directions on different seed sets: starting him 3 m south brought back most of the issued kit's pace on seeds 21–40, and slowed the engaged kit on seeds 1–20.
  - So the battle is a little easier for the issued kit because the wider ranks protect the soldier, as #82 meant them to. The [Gate 4 checklist](gate4-playthrough.md) asks the owner to judge it.
- **Veteran's "wins sooner" margin: about 0.32 rounds.**
  - On 40 seeds it is 0.32 rounds (range 0.28 to 0.37), and the health measure 4.1 points (3.6 to 4.6). The margin really is close to its 0.3 threshold: it is not an accident of 20 seeds.
  - Most of the drop from release 11's 0.44 comes from the two battles above.
  - The 40-seed sweeps meet every other Veteran target: at the first try, 98.5% of the issued kit's battles and 99.8% of the engaged kit's; all within three tries.
  - Keeping the threshold, lowering it, or retuning so the better kit wins sooner is the owner's decision.
- **Also found: the river gate on seed 57.** Past the sweeps' seeds, Veteran with the issued kit loses Chapter V's river gate on all four tries; the code before #82 wins it. The river gate was already Veteran's hardest battle for the issued kit: lost at the first try in 5 of 20 seeds in release 11, and in 11 of 40 now. The Gate 4 checklist already asks whether it is fair.

These checks are not kept as evidence files. They are reproduced, tick times aside, on 6c60348, or on edfe269 for before #82, by `node scripts/realtime-sweep.mjs --seeds=40 --difficulty=veteran --kit=issued` (and `--kit=engaged`) and by `scripts/battle-seeds.mjs`, which came with this follow-up: copy it into the older checkout to run it there.

## The browser checks

All in headless Chromium with software rendering (SwiftShader), on the production build:

- **The stage benchmark** (`--check`, as CI runs it) passed on Chapters V and XII. It used 43 and 46 shader programs in Chapter V at Performance and Balanced, and 41 and 47 in Chapter XII, with none compiled after the first frame. Draw calls and triangles stayed within the recorded ceilings. Chapter V's numbers are identical to main's: the benchmark's scenes are turn-based boards, which draw no containers.
- **Shader programs in a live camp.** A New Game was restored through the visible interface into Chapter I's camp in real time, at Balanced, and the WebGL programs linked were counted. Main links 46. The first build of this release linked 47: the containers' fieldwork materials have a program no camp otherwise draws. The containers now use the scenery's own palette (`environment.js` lends it), and the camp links 46 again. Its three containers cost three draw calls, one per material, and 2,220 triangles.
- **`smoke:ch5-pilot`** passed: Chapter V's courtyard and fortress from checkpoints earned by legal commands, every pilot scenery placement in Balanced 3D, the decision through export and restore, March out and an exact Retry.
- **`smoke`:** 16 of its 21 scenarios passed before the local run reached its 30-minute limit and was stopped. The 16 cover the camps' departures, real-time squads, the drill, Chapter V's field and approach, phone touch, the performance check, the arena, the 2D view, deployment and the chamber Contests. The five cut off are the hearing, the finale, settings and help, Practice and an old chronicle.
- **`smoke:world`** (all twelve camps) did not run locally.
- **CI's first run on the pull request** passed six of its seven jobs: `npm run verify` on Node 20 and 22, both benchmarks, the usability and navigation checks, and the twelve camps. In the browser smoke job, the order review passed and 20 of `smoke`'s 21 scenarios passed. The finale failed, so the polish and cavalry checks after it did not run.
- **The finale's failure was the check's.** It walked the soldier to the nearest enemy and swore the oath within 20 m of him. The nearest enemy is now the claimant's guard captain, this release's champion, who comes for the soldier. He belongs to no band, so the oath reached none: the nearest band stood 31 m away, beyond the 23 m reach. The check now walks to the nearest band's men, and passes locally; on failure it reports whom the oath was sworn beside. The rule is unchanged. The sweeps' bot has always walked to a band, and wins the oath route on every seed.
- **Then, locally:** `smoke:polish` passed its 20 checks, and `smoke:cavalry` its 4.

## Limitations

- **Bots, not players.** The sweeps measure a heuristic bot; the 90–150 minute target and the feel of the kit need the owner's play-through.
- **Kit decides health and pace more than wins.** The plan's first "upgrades count" target, on first-try wins, was not met (above). On 1 November the owner replaced it with a target on health and pace, which this release meets.
- **The forecast** of a squad's blows on the soldier is not shown in battle; the character panel shows the share his kit turns.
- **The armourer's apron** is drawn over the camp staff's generated civilian body. It may sit partly inside the body's clothes from some angles.
- **Not swept:** Story's engaged player and Veteran's bare one, and the older campaigns begun before release 7's missions.
- **An oath with no band in reach is not explained.** In the finale's oath route the guard captain now comes for the soldier. An oath sworn with only him near reaches no band. The usual Rally line appears, but nothing says the oath went unheard, as before for any oath out of reach; the progress line names the 23 m. At the owner's request, release 12 adds the message.

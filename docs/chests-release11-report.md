# Worlds and gameplay, release 11: chests, the armourer and the armoury

Release 11 is the first of the four releases the owner approved on 1 November 2026 (releases 11–14 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md)), which bring the genre's treasure chests, a blacksmith and its navigation to Imperium in Imperium's own Roman style. It puts containers to open in every camp and on most battlefields, an armourer in every camp, finer and named kit, and kit that counts in every battle: against squads, and against new champions who seek the soldier out. The enemies are retuned for a soldier who uses what he finds, the same on every level. This report records what changed, how it was checked and what was not checked. The [changelog](../CHANGELOG.md) describes the changes for players.

No credits were spent: the containers, the forge and the armourer's tools are built in code from the scenery's own pieces. The item pictures of release 13 will spend the first credits of the approved cap.

How each kind of check was made:

- **Automated tests** (Node.js): `npm test`. New:
  - `containers`: the data, keys and locks; opening once in camp; staging on the field; Practice; reload and Retry; refusals leaving the chronicle and its generator unchanged; hidden caches found by walking close or by Scout;
  - `champions`: kit against squads, a champion in each battle that has one, the same on every level, and every key to a locked field container carried on its field;
  - `kit-audit`: the audit's document is current and finds no problem;
  - `container-props`: every kind of container built closed, open, emptied and locked from the fieldwork kit's own materials, batched; the stage showing a hidden cache only once it is found; opening a camp chest changing the camp world but never its scenery; and every camp's forge behind its armourer, clear of the camp's objects.

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
- **The later champions** first killed a recruit who wears and trains nothing: Story's bare player lost Chapter VII's battle and the finale on several seeds. The champions of Chapters VI–XII are a little weaker now, and the claimant's guard captain markedly so (`data/champions.js`). They still lose badly to an issued or engaged soldier.
- **The ranks make way.** In one Story sweep of Chapter VI's eagle, every enemy fell by round 7, but the soldier stood 10.07 m from the 10 m exit until the deadline passed. Three of his own squads stood in formation between him and the exit, and crowd separation pushed him back as fast as he walked. A man standing in his formation's ranks now steps aside the whole overlap for a friend walking through: the soldier, a companion or a protected column. Men who are fighting, and enemies, are jostled as before. The saved stalled world, resumed with the rule, finishes at once.

**The ferry's plans.** On Story, against a soldier who wears and trains nothing, the ferry's enemy narrowed to holding the front or turning the right flank in every first-decision run (pass 1). A second run over 40 seeds gave the same. Only the second pass's decisions brought the left flank (2 runs) and a feint (1 run). The enemy feints only when its own bands are worn down near its archers, which the unequipped soldier is slow to do. Every other player and level saw all four plans in pass 1.

## The browser checks

To be completed with this release's runs.

## Limitations

- **Bots, not players.** The sweeps measure a heuristic bot; the 90–150 minute target and the feel of the kit need the owner's play-through.
- **Kit decides health and pace more than wins.** The plan's "upgrades count" target is not met (above).
- **The forecast** of a squad's blows on the soldier is not shown in battle; the character panel shows the share his kit turns.
- **The armourer's apron** is drawn over the camp staff's generated civilian body. It may sit partly inside the body's clothes from some angles.
- **Not swept:** Story's engaged player and Veteran's bare one, and the older campaigns begun before release 7's missions.

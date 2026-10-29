# Worlds and gameplay, release 7: missions and cavalry

Release 7 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md) turns six battles into missions of their own, gives the enemy siege works, and gives the horse two orders of its own. Campaigns begun before it keep the battles they started with; New Game plays the new ones, in real time and in turns. This report records what changed, how it was checked and what was not checked. The [changelog](../CHANGELOG.md) describes the changes for players.

How each kind of check was made:

- **Automated tests** (Node.js): `npm test`. New: `missions-release7` (the operation versions, both paths' rules, the horse's orders, the opportunity pairs, deployment and saves); in `realtime-movement`, a straight line that clips slower ground for a single sample is not clear; in `realtime-combat`, who breaks a man's calm (a visible enemy standing within 30 m, never an envoy, a hidden man or a man down); in `realtime-squad-sight`, a notice rate taken without cover has the same sign as the full rate. The full real-time campaign tests (Standard through Chapter XII, Story through XII, Veteran through VII on several seeds) now play the new missions, as New Game does.
- **Autoplays** (Node.js): `npm run verify` plays the command campaign's six routes as before (campaigns begun before the missions), and three more with the missions: the first camp choices, the alternates, and Veteran.
- **Sweeps** (Node.js, headless, on the development container): the release 3 bot plays the campaign from New Game, every battle by legal Commands, on 20 campaign seeds on each difficulty, beside sweeps of main made in turn with it. A bot is not a player (see [Limitations](#limitations)).
- **The real interface:** the production build in headless Chromium with software rendering (SwiftShader): close shots of the siege works and a shader-program probe of the six missions, run locally; the smoke checks and the benchmarks run in CI on the pull request (see [The browser checks](#the-browser-checks)).
- **Not performed:** a person playing the new missions, and any check on a phone, a laptop or with a screen reader.

## What changed

| Change | Rules | Code and data | Randomness |
| --- | --- | --- | --- |
| Six missions | Version 3 of the operations: the escalade (IV), the sortie (V), the rearguard with fallback lines (VI), the crossing under fire (VIII), the feigned retreat (IX) and the relief convoy by the road chosen in camp (X). Each phase is a mode both paths play (capture, hold, extract, clear). A campaign begun before keeps versions 1 and 2. | `data/mission-operations.js`, `operations.js`, `battle.js`, `progression*.js`, `game.js`, `campaign-options.js` | none |
| Siege works | Ladders stand against the wall with climbers at each head: a 4-Health unit in turns, and in real time a squad that holds the ladder's head as a guard holds his approach. The ram stands before the river gate and, in real time, batters the barred gate 30 a round (120 to a breach). While any work stands, the line loses the battle's pressure each round (turn) in both paths. Holding a work's ground with no enemy beside it destroys it, and a ladder is also thrown down once its climbers are beaten (destroyed, or broken in real time). | `field-missions.js`, `fortifications.js` (`breakGate`), `campaign-encounter.js`, `squad-ai.js`, `operations.js`, `battle.js` | none |
| The lure | The feint's phase ends when the named horse reaches the marker, or none of it is left (in real time, none unbroken). In real time the horse keeps its ground until drawn out by a feigned retreat, or until one of our squads comes within 12 m, and no longer than the end of round 3. | `field-missions.js`, `squad-ai.js`, `battle.js` | none |
| Convoys | Protected columns walk their road point by point, passing a point within a tile of them, around anyone in the way; they halt beside (turn-based) or within 8 m of (real time) an enemy, and never step beside one (turn-based). | `operations.js` (`convoyStep`), `field-missions.js` (`moveConvoy`) | none |
| Fallback lines | When a line is given up, squads ordered to hold or advance there fall back to the next on their own (real time). | `field-missions.js`, `mission.js` | none |
| The far bank's volleys | Over the crossing, at each round's end while the enemy's archers stand, one volley at the group of ours most exposed in the water or on the landing: 2 strength (a man) from the squad with the most men there, or else 2 Health from the man of ours there nearest the far bank (real time). | `field-missions.js`, `squads.js`, `damage.js` | none |
| The horse's orders | **Charge** (card 8): at the nearest enemy group in sight, wheeling away first when closer than the 20 m run-up. **Feigned retreat** (card 9): ride at the nearest enemy horse or raiders in sight until within 30 m, then away (to the marker in a lure, else 30 m); those in sight that come within 30 m of the flight give chase, and when it turns (there, or after two rounds) they lose 20 cohesion and it charges the nearest. Horse only; one Command each. | `realtime-squads.js`, `command.js`, `order-intents.js`, `squad-ai.js` | none |
| Opportunities | Each re-authored battle has its own pair, in place of its chapter's, with the effects the chapters already use. | `data/mission-operations.js`, `command-campaign.js` | none |
| Deployment | A crossing deploys on its own bank: two tiles in Chapter VIII, three on Chapter X's road (an operation's `deploy`). | `campaign-encounter.js` | none |
| The mission strip | Presentation only. Its headline and progress name each mission's task (the ladders or the ram still standing and the line, the horse to draw, the line to hold while the column withdraws, the convoy), and its advice says how each falls, when a convoy has halted for an enemy near it, and that the far bank's volleys strike the most exposed group. When the works break the line, the defeat says so. Chapter V's older siege ramp now offers "Disable the siege ramp" (it read "Disable siege works"), so it is not taken for the ram. | `realtime-hud.js`, `realtime-mission-readout.js`, `fortifications.js`, `realtime-lessons.js` | none |
| The simulation's cost | None: the world plays exactly as before. Each squad's pace is found once a tick instead of once for each of its men, and a formation's places once for each shape and size. A route search works out each cell's moves once per grid, a straight line's every eighth sample is tried first, and a region's nearest cell is found walking each ring's edge only. Whether a man is out of combat is asked only of the other side's men in sight and standing. A squad's sight finds each squad's men and centre once a look, and no longer traces the line for cover while its notice of a hostile is already full. Added after the sweeps found the escalade's and the sortie's ticks near or over the plan's budget (see [Tick time](#tick-time)). | `squads.js`, `navigation.js`, `damage.js`, `squad-sight.js`, `ai.js` | none |
| Saves | A campaign's missions version and each battle's are checked on load; real-time fights record world version 6, and a fight saved by an earlier version restarts from its checkpoint. | `campaign-options.js`, `operations.js`, `validate.js`, `simulation.js` | none |

None of these rules draws from a random stream, and the drawings draw nothing: the same seed gives the same battle, and a reloaded fight plays on exactly as before (`missions-release7`, tests A1–A4, `realtime-world-version`).

## Against the plan

| The plan | As built |
| --- | --- |
| A sortie (V), a rearguard with fallback lines (VI), a crossing under fire (VIII), a feigned retreat and pursuit (IX) and a relief convoy with a route choice (X), as operation data | All five, and a sixth: the escalade at Chapter IV's gate, which gives the plan's ladders a battle of their own. The data is version 3 of the operations (`data/mission-operations.js`), not new entries in `battle-operations.js`: versions 1 and 2 are save contracts, so a campaign begun before this release keeps the battles it started with. |
| Escort and hold, counting rescues and withdrawals, fall from 10 of 18 battles to at most 6 | 10 to 6 (below). |
| Cavalry orders: charge and the feigned retreat, as squad orders | Both, for our horse only, at one Command each: keys 8 and 9 of the command card and the squad's Command list. The feigned retreat may also be given toward the objective marker. |
| Enemy siege works: ladders and a ram, given their meaning by release 4's gate integrity and breach rules | The ram batters its gate with release 4's blow (30 a round against the barred gate's 120) until it is a breach; the ladders put climbers on the wall walk. While any work stands, the line pays the battle's pressure. |
| Opportunity pairs chosen by mission | Each of the six missions has its own pair; the other battles keep their chapter's. |
| The bot and sweeps updated, and tests for siege progress, gates and cavalry orders | The bot gives the feigned retreat when a phase asks for a lure; the sweep plays a campaign begun before the missions (`--missions=0`) and each battle's second operation (`--operations=other`). Tests: `missions-release7`. |

### Escort and hold

The battles whose first objective is to escort or rescue a column, to withdraw, or to hold one marker, of the 18 battles after Chapter I's training:

| Battle | Before | After |
| --- | --- | --- |
| II, the marsh | rescue | the same |
| II, the rearguard | hold | the same |
| III, the rolls | escort | the same |
| IV, the gate | hold | **the escalade** (capture the ladders' heads) |
| IV, the wall | escort | the same |
| V, the wall | hold | **the sortie** (capture the ram's ground) |
| VI, the wells | rescue, then withdraw | **the rearguard** |
| VI, the eagle | escort | the same |
| VIII, the ferry | open the approach, then escort the households across | the same |
| VIII, the crossing | hold | **the crossing under fire** (capture the far landing) |
| **Count** | **10** | **6** |

The rearguard is counted as the plan's new type, not as a hold: in the data its first two phases are holds, but of two lines in turn, the second behind the first, while the column walks west on its own. Counted as a hold it would make 7. The feigned retreat (IX) and the convoy (X) replace a field battle and a supply battle, which were not counted.

### Changed after the first sweeps

Playing the design with the bots changed it in six ways before this release's final sweeps; the [plan](worlds-and-gameplay-plan.md#7-missions-and-cavalry) records them too.

- **The armoured horse holds back during the feint.** Left to the enemy's ordinary plans, the horse charged the line at the marker in the first round, and the feint asked nothing. Now the horse a lure names keeps its ground until drawn out, or until one of our squads comes within 12 m; the phase also ends once none of it is left.
- **Climbers in both paths, and fewer of them.** With nothing at their heads, the ladders were thrown down on the first turn. A ladder now puts its first climbers on the wall walk in both paths: in turns a single man of 4 Health, in real time a band of 4 strength that holds the ladder's head. Beating them throws the ladder down. With 7 Health, and a ladder thrown down only by holding its head with no enemy there, the escalade cost the bot all its squads in 14 of 20 Standard runs in real time.
- **A crossing deploys on its own bank.** Chapter VIII's far landing and Chapter X's ford lay inside the usual four-tile deployment zone, and were taken in the first round.
- **Convoys remember their road.** The wagons walk point by point and pass a point within a tile of them, in both paths. Judged by their nearest point instead, they turned back at the ford.
- **The far bank's volley strikes one group.** Loosed at every squad of ours with a man in the water or on the landing, it cost the bot a median 77% of its squads' strength at Standard's crossing, against 50% before the missions.
- **The lured horse waits three rounds at most.** The first Story sweep lost one feigned retreat on its deadline (pass 2, seed 7): the enemy horse destroyed ours, then rode back to its place and waited for an opening for fifteen rounds, while nothing of ours went near it. Like a band lying in wait, the horse now keeps its ground no longer than the end of round 3, and the lure is also met once none of it is left unbroken. Replayed, the same seed draws the horse in round 5 and wins in round 7.

A review before the final sweeps also moved the turn-based works pressure after the turn's points are settled, as at a real-time round's end: a ladder whose climbers fell during the turn no longer costs the line that turn's pressure.

## Calibration

The sweeps ([Story](evidence/realtime-release7-sweep-story.json), [Standard](evidence/realtime-release7-sweep-standard.json), [Veteran](evidence/realtime-release7-sweep-veteran.json)) play each seed's campaign from New Game, with the missions, in release 3's three passes: each chapter's first decision; the decisions that change a field the other way, now with each battle's second operation chosen in camp (`--operations=other`), so that every operation is played in real time; and every finale route from each seed's Chapter XII camp. A lost battle is retried from its checkpoint, by the legal Retry command, up to once on Story, twice on Standard and three times on Veteran.

Main (`f44103d`) was swept on the same seeds with the same bot, beside this release's final commit (`d5b44a7`), one sweep at a time with nothing else running on the container: on Standard this release and main in turn, twice each; on Story this release, then main; on Veteran main, then this release. The earlier sweeps of this release, before the changes that made the simulation cheaper, gave the same results battle for battle (see [Tick time](#tick-time)).

### Against the plan's targets

Each target counts the 13 battles of pass 1 and the 5 finale routes of pass 3 on each of 20 seeds: 360 battles a level.

| Target | Story | Standard | Veteran |
| --- | --- | --- | --- |
| Won on the first try: Story every one, Standard ≥ 90%, Veteran ≥ 70% | 360 of 360 | 360 of 360 | 357 of 360 |
| Won within the tries allowed (one, two, three) | 360 of 360 | 360 of 360 | 360 of 360 |
| At least three enemy plans in each battle across the seeds | every battle | every battle | every battle |
| The finale's battle lasts 8–12 of its 16 rounds | 10 rounds | 8 rounds | 8 rounds (8–9 on the backer's route) |
| The simulation's tick rises by at most 0.3 ms at p95 | +0.02 ms at most (the sortie and the escalade) | no battle rises | no battle rises |

Pass 2 was won at the first try in every battle and on every seed on Story and Standard. On Veteran it was too, but for the sortie, which lost four of its 20 first tries and won all four at the second (below).

### The six missions on Standard

Each cell gives main → this release on the first try of pass 1; the tick is the mean of the two runs on each side. Every battle was won at the first try on every seed in all four sweeps, and the two runs on each side gave the same results.

| Battle | First try | Deadline | Rounds, median/most | Least slack | Loss, median | Plans | Tick p95 | Change |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **IV, the gate** (the escalade) | 20 → 20 | 16 → 16 | 7/8 → 6/8 | 8 → 8 | 76% → 73% | 5 → 4 | 0.71 → 0.70 ms | −0.02 |
| IV, the wall | 20 → 20 | 12 → 12 | 6/9 → 6/9 | 3 → 3 | 45% → 45% | 4 → 4 | 0.87 → 0.64 ms | −0.23 |
| V, the mine | 20 → 20 | 16 → 16 | 8/9 → 8/9 | 7 → 7 | 55% → 55% | 6 → 6 | 1.00 → 0.69 ms | −0.31 |
| **V, the wall** (the sortie) | 20 → 20 | 13 → 15 | 9/9 → 7/8 | 4 → 7 | 70% → 70% | 6 → 6 | 0.90 → 0.78 ms | −0.12 |
| **VI, the wells** (the rearguard) | 20 → 20 | 20 → 20 | 7/8 → 7/9 | 12 → 11 | 58% → 50% | 4 → 3 | 0.98 → 0.74 ms | −0.24 |
| VI, the eagle | 20 → 20 | 14 → 14 | 4/6 → 4/6 | 8 → 8 | 40% → 33% | 3 → 3 | 0.92 → 0.66 ms | −0.25 |
| VII, the legion | 20 → 20 | 16 → 16 | 6/8 → 6/8 | 8 → 8 | 53% → 53% | 4 → 4 | 1.36 → 0.94 ms | −0.42 |
| VIII, the ferry | 20 → 20 | 22 → 22 | 5/7 → 5/6 | 15 → 16 | 39% → 39% | 4 → 4 | 1.35 → 0.99 ms | −0.36 |
| **VIII, the crossing** (under fire) | 20 → 20 | 17 → 17 | 7/8 → 6/9 | 9 → 8 | 50% → 57% | 4 → 4 | 1.25 → 0.85 ms | −0.40 |
| **IX, the wing** (the feigned retreat) | 20 → 20 | 15 → 18 | 5/7 → 7/8 | 8 → 10 | 55% → 50% | 4 → 5 | 1.11 → 0.77 ms | −0.34 |
| IX, the city | 20 → 20 | 17 → 17 | 6/7 → 6/7 | 10 → 10 | 38% → 34% | 5 → 5 | 1.28 → 0.83 ms | −0.45 |
| **X, the road** (the relief convoy) | 20 → 20 | 18 → 18 | 8/10 → 9/10 | 8 → 8 | 54% → 45% | 5 → 5 | 1.29 → 0.91 ms | −0.39 |
| XII, the confrontation | 20 → 20 | 16 → 16 | 8/8 → 8/8 | 8 → 8 | 13% → 12% | 4 → 4 | 1.68 → 0.96 ms | −0.71 |

- **The missions are about as hard as the battles they replace,** by the bot's margins: no mission has less slack than the battle before it by more than a round, and their median losses moved between −9 and +7 points. The escalade and the sortie end a round or two sooner at the median; the feigned retreat takes two rounds more, as the horse first has to be drawn, and has three more rounds to do it.
- **The battles the missions do not change** play differently all the same, by a few points of loss, because the campaign that reaches them has fought the missions first: veterans recover differently and the company arrives in other shape.
- **Second operations** (pass 2): all 20 seeds won at the first try for each. The Chapter IV hold for the baggage train, after the escalade, is the costliest operation in the campaign: the bot lost a median 100% of its squads' strength, against 80% for the same operation on main on five of the same seeds, replayed from their camp checkpoints (93% on this release on those five). The rearguard's third line cost 30%, the supply ferry after the crossing 56% and the south road 57%.

### Story and Veteran

Each cell gives main → this release on the first try of pass 1, the tick from the one run on each side.

**Story.** Every battle and finale route of all three passes was won at the first try, on main and on this release, and the finale's battle lasted 10 rounds on every seed on both. The escalade costs more on Story than the hold it replaces, 67% of the squads' strength at the median against 49%, as its climbers are in reach from the first second, though it still ends with 13 rounds to spare at the least.

| Battle | First try | Deadline | Rounds, median/most | Least slack | Loss, median | Plans | Tick p95 | Change |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **IV, the gate** (the escalade) | 20 → 20 | 19 → 19 | 5/6 → 5/6 | 13 → 13 | 49% → 67% | 5 → 4 | 0.82 → 0.83 ms | +0.02 |
| IV, the wall | 20 → 20 | 15 → 15 | 6/9 → 6/9 | 6 → 6 | 45% → 45% | 4 → 4 | 0.94 → 0.71 ms | −0.23 |
| V, the mine | 20 → 20 | 19 → 19 | 7/8 → 7/8 | 11 → 11 | 46% → 46% | 6 → 6 | 1.12 → 0.87 ms | −0.26 |
| **V, the wall** (the sortie) | 20 → 20 | 16 → 18 | 8/9 → 6/6 | 7 → 12 | 58% → 44% | 6 → 6 | 0.89 → 0.91 ms | +0.02 |
| **VI, the wells** (the rearguard) | 20 → 20 | 23 → 23 | 7/8 → 7/9 | 15 → 14 | 56% → 44% | 3 → 3 | 0.97 → 0.83 ms | −0.14 |
| VI, the eagle | 20 → 20 | 17 → 17 | 4/6 → 4/6 | 11 → 11 | 39% → 30% | 4 → 3 | 0.93 → 0.69 ms | −0.25 |
| VII, the legion | 20 → 20 | 19 → 19 | 6/8 → 6/8 | 11 → 11 | 49% → 49% | 4 → 4 | 1.49 → 1.03 ms | −0.45 |
| VIII, the ferry | 20 → 20 | 25 → 25 | 5/6 → 5/6 | 19 → 19 | 32% → 31% | 4 → 4 | 1.42 → 1.18 ms | −0.24 |
| **VIII, the crossing** (under fire) | 20 → 20 | 20 → 20 | 7/8 → 6/7 | 12 → 13 | 45% → 44% | 3 → 3 | 1.38 → 1.02 ms | −0.35 |
| **IX, the wing** (the feigned retreat) | 20 → 20 | 18 → 21 | 5/7 → 7/9 | 11 → 12 | 42% → 39% | 4 → 5 | 1.15 → 0.83 ms | −0.32 |
| IX, the city | 20 → 20 | 20 → 20 | 5/7 → 5/7 | 13 → 13 | 30% → 30% | 4 → 4 | 1.38 → 1.03 ms | −0.34 |
| **X, the road** (the relief convoy) | 20 → 20 | 21 → 21 | 10/12 → 8/12 | 9 → 9 | 43% → 33% | 5 → 5 | 1.24 → 1.10 ms | −0.14 |
| XII, the confrontation | 20 → 20 | 19 → 19 | 10/10 → 10/10 | 9 → 9 | 11% → 12% | 5 → 5 | 1.71 → 1.06 ms | −0.66 |

**Veteran.** This release won 357 of the 360 battles at the first try, against main's 359, and all 360 within three tries. The three were the sortie's, on seeds 1, 11 and 18: each time the defended line broke in the eighth round, while the river gate was held after the ram had burnt, with 80–86% of the bot's squads' strength lost, and each was won at the second try. The same battle after the chapter's other decision (pass 2) lost four first tries in the same way (seeds 1, 6, 11 and 15), all won at the second. Main's one was at Chapter VI's wells (seed 15), the battle the rearguard replaces. The sortie is the hardest battle on Veteran, as the hold of the wall was before it: on main every seed won that hold at the first try, but with a round to spare at the least. The relief convoy is tighter on Veteran too: four rounds to spare at the least, against seven in the battle it replaces.

| Battle | First try | Deadline | Rounds, median/most | Least slack | Loss, median | Plans | Tick p95 | Change |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **IV, the gate** (the escalade) | 20 → 20 | 14 → 14 | 7/8 → 6/9 | 6 → 5 | 82% → 86% | 5 → 4 | 0.81 → 0.65 ms | −0.16 |
| IV, the wall | 20 → 20 | 10 → 10 | 6/9 → 6/9 | 1 → 1 | 45% → 45% | 4 → 4 | 0.98 → 0.60 ms | −0.38 |
| V, the mine | 20 → 20 | 14 → 14 | 8/9 → 8/9 | 5 → 5 | 61% → 61% | 6 → 6 | 1.21 → 0.70 ms | −0.51 |
| **V, the wall** (the sortie) | 20 → 17 | 11 → 13 | 9/10 → 7/8 | 1 → 5 | 84% → 81% | 5 → 6 | 0.99 → 0.74 ms | −0.25 |
| **VI, the wells** (the rearguard) | 19 → 20 | 18 → 18 | 7/8 → 7/7 | 10 → 11 | 59% → 55% | 5 → 3 | 1.13 → 0.72 ms | −0.41 |
| VI, the eagle | 20 → 20 | 12 → 12 | 4/6 → 4/5 | 6 → 7 | 37% → 28% | 3 → 3 | 1.03 → 0.63 ms | −0.41 |
| VII, the legion | 20 → 20 | 14 → 14 | 6/9 → 6/9 | 5 → 5 | 53% → 53% | 4 → 4 | 1.56 → 0.96 ms | −0.60 |
| VIII, the ferry | 20 → 20 | 20 → 20 | 5/6 → 5/6 | 14 → 14 | 40% → 40% | 4 → 4 | 1.72 → 0.92 ms | −0.80 |
| **VIII, the crossing** (under fire) | 20 → 20 | 15 → 15 | 8/8 → 7/9 | 7 → 6 | 55% → 65% | 3 → 4 | 1.43 → 0.81 ms | −0.62 |
| **IX, the wing** (the feigned retreat) | 20 → 20 | 13 → 16 | 5/7 → 7/8 | 6 → 8 | 58% → 50% | 5 → 5 | 1.30 → 0.73 ms | −0.57 |
| IX, the city | 20 → 20 | 15 → 15 | 6/7 → 6/7 | 8 → 8 | 38% → 34% | 4 → 5 | 1.57 → 0.83 ms | −0.75 |
| **X, the road** (the relief convoy) | 20 → 20 | 16 → 16 | 8/9 → 9/12 | 7 → 4 | 59% → 55% | 5 → 5 | 1.44 → 0.87 ms | −0.57 |
| XII, the confrontation | 20 → 20 | 14 → 14 | 8/8 → 8/9 | 6 → 5 | 19% → 16% | 4 → 4 | 1.87 → 1.00 ms | −0.88 |

### A campaign begun before the missions

The same 20 seeds on Standard, as campaigns begun before this release (`--missions=0`, versions 1 and 2 of the operations), played every battle, route and decision exactly as both of main's morning sweeps: all 620 results identical, rounds, losses, plans and incidents alike. That sweep ran on `2b4ef21`; the squad sight of `d5b44a7` changes no result (below). Its tick times are not compared, as it ran hours after main's runs (see [Tick time](#tick-time)).

### Tick time

The plan's budget: no battle's tick at p95 may rise by more than 0.3 ms over the previous release, measured on the same seeds, one sweep at a time.

| Level | How measured | Largest rise | The sortie | The escalade | The finale |
| --- | --- | --- | --- | --- | --- |
| Story | one run each side, this release first | +0.02 ms, the sortie and the escalade | +0.02 | +0.02 | −0.66 |
| Standard | the mean of two runs each side, in turn | none: every battle is faster | −0.12 | −0.02 | −0.71 |
| Veteran | one run each side, main first | none: every battle is faster | −0.25 | −0.16 | −0.88 |

Every battle the missions leave alone is faster than on main on every level, by 0.23–0.88 ms.

**How the budget was kept.** Three times the sweeps found a battle near or over it, and each time the cause was made cheaper without changing what happens:

- **The escalade.** The first Standard sweep found it at +0.30 ms against main, at the budget. Profiled on five seeds, nothing new was costly (the works and the beaten climbers took 7 ms in 4.4 s): the escalade fields two more bands, 50 men against 44, and its climbers are in reach from the first second, so the same fighting is packed into fewer rounds. But every walking man was asking for his squad's pace, which walks every member's derived values, once each tick. That pace is now found once a squad a tick, and each formation's places once for each shape and size.
- **The sortie on Story and Veteran.** Timed alone on five saved starts, the sortie rose by +0.43 ms on Story and +0.30 ms on Veteran, nearly all in its opening round. There the soldier and his companions are ordered at the ram from inside the walls, and each re-plans every half second a route out by the postern. On Veteran's five starts the opening round's route searches each expanded about 1,000 cells, against 570 on main, with 2.7 times as many searches, and their straight-line checks tested 248,000 points against 62,000. The search now works out each cell's moves once per grid, and a straight line tries its every eighth point first, since a wall across it is usually met there and one failing point fails the line. The check on whether a man is out of combat, which asked every man about every other each tick, now asks only the other side's men in sight and standing. On those starts, played three times each, the opening rounds took 2.7 s of computing in all, against 3.5 s before and 2.4 s on main.
- **The escalade, on a slower container.** Later in the day the container ran every sweep 10–20% slower than in the morning, main's included, and the escalade, which does more work in each of its sight ticks than the battle it replaces, rose by +0.31 ms in one pair of runs. Its slowest ticks were nearly all sight ticks, four a second, when every squad looks at every hostile squad and man and traces the line between them for cover. Each squad's men and centre are now found once a look instead of once a pair, and a squad whose notice of a hostile is already full no longer traces the line: a full meter stays full at any rate above zero, and cover only scales the rate by a positive factor. Timed battle by battle in one process on five of the escalade's starts, interleaved with main's battle at the gate, its tick at p95 fell from 0.76 to 0.68 ms, against 0.67 ms on main.

The world plays exactly as before. The world hashes through the saved escalades and sorties match those of the commit before; 24,000 routes and 96,000 straight lines on their fields agree with the old searches; and every sweep of this release on all three levels, 620 to 627 results each, matched the sweeps made before these changes result for result. Every squad battle gains from them, which is why the battles the missions leave alone are faster than on main.

The container's speed drifted through the day: main's own Standard sweep took 507–512 s in the morning and 577–603 s in the afternoon, and the same code's tick p95s came up to 0.3 ms apart in runs hours apart. So each comparison here is between runs made in turn within the same hour or so, and the earlier releases' sweeps, recorded on other days, are not compared: against them, main's own sweeps today report rises of up to 0.54 ms with identical code. None of these times is a phone's: the budget there is 4 ms at p95 on a 2022 phone, and no phone has been measured.

## Shader programs

The siege works are code-built pieces (the ram's shed on its wheels with the beam's head toward the gate, and each ladder), drawn with the field objects' own materials, and the missions add no other drawing. Programs after touring the follow, overview and horizon cameras on Balanced, from a scratch probe that restores each battle from a legal checkpoint through the Restore dialog, against release 6's probe of the same battles on main's code:

| Battle | Release 6 (main) | This release |
| --- | ---: | ---: |
| IV, the gate (the escalade) | 43 | 43 |
| V, the wall (the sortie) | 45 | 45 |
| VI, the wells (the rearguard) | 45 | 45 |
| VIII, the crossing (under fire) | 46 | 46 |
| IX, the wing (the feigned retreat) | 44 | 44 |
| X, the road (the relief convoy) | 43 | 43 |

The escalade and the sortie were probed on a build made earlier in this release, after its last change to what is drawn, and the other four on the final commit: since then only the mission strip's and the lessons' words have changed. Each mission compiled as many programs as the battle it replaces, the same in all three views, with no page errors; the most is still 46, in Chapter VIII's two battles. The stage benchmark in CI checks Chapter V's mine and Chapter XII's confrontation against their ceilings.

## The browser checks

All in headless Chromium with software rendering (SwiftShader), on the production build of the final commit unless noted:

- **The siege works up close.** A scratch script earned the escalade's and the sortie's starts by legal commands, restored them through the Restore dialog in real time and 3D on Balanced, and framed each work from the enemy's side and from ours. The two ladders lean against Chapter IV's palisade, their heads showing above it from the wall walk; the ram's shed stands on its ground before the river gate, its beam toward the gate. No page errors.
- **Shader programs** in the six missions (above).
- **In CI on the pull request:** `npm run smoke`, the polish, usability, Chapter V pilot (with the river gate), immersive, siege and twelve-camp checks, the twelve-chapter benchmark and the stage benchmark against its ceilings. They were not run locally on the final commit.

## Downloads

Gzip sizes from the build report (the sum of each set's files, the service worker included; not a browser's network trace), main (`f44103d`) built beside this release:

| Download | Limit | Main | This release |
| --- | ---: | ---: | ---: |
| First load | 2 MB | 0.88 MB | 0.90 MB |
| Chapter I in 3D | 16 MB | 13.59 MB | 13.61 MB |
| The largest chapter, with its 2D art | 24 MB | 21.28 MB (VII) | 21.30 MB (VII) |
| The complete campaign | 80 MB | 42.97 MB | 42.99 MB |

The release adds no art: its rules, missions, drawings and words are code and data, 19.2 kB on the first load and 19.8 kB on the complete download, and 0.02 MB to each chapter's pack.

## Limitations

- **A bot is not a player.** The sweeps show that each mission can be won by legal Commands within the targets, not that it reads clearly or plays well. The bot plays the objectives and gives the feigned retreat when a phase asks for a lure; it never charges by key, chooses a road for a reason, or uses a fallback line on purpose. The rebalance after the first sweep (climbers of 4, the beaten rule, a volley at one group) was tuned on the bot alone.
- **Real time's own rules.** In turns, the ram does not batter its gate, the far bank looses no volleys, the enemy's horse is not held back for the lure, and squads do not fall back to the next line on their own: those rules belong to real time, as the [data's header](../src/data/mission-operations.js) says. The turn-based missions use the modes both paths share, and their own climbers and convoys.
- **The drawings.** The ram, its shed and the ladders are code-built pieces, like release 4's stand-ins. The ram stands on its own ground a few metres short of the gate it batters, and its blows are not animated: the gate's integrity falls by the rule alone. They were looked at in close shots and the shader-program probe's frames, under software rendering, not by a person in play.
- **Two kinds of siege works in the sortie.** Chapter V's battles keep the countermine timbering and the Persian siege ramp of the world upgrade ([#32](https://github.com/obeidpeter/Imperium/pull/32)): two work actions each, and from round 4 the line loses 4 a round to each that still stands. The sortie adds this release's ram, burnt by holding its ground, which costs the line the mission's pressure every round. They are separate rules, named apart in the field panel and the log; the ramp's action, which read "Disable siege works", now reads "Disable the siege ramp", so it is not taken for the ram. Whether a player tells the three apart in play has not been seen.
- **History.** Chapter IX's feigned retreat follows Zosimus's account of Immae; the other five missions are invented episodes in the manner of the period's warfare ([historical notes](historical-research.md)).
- **Not checked:**
  - a person playing the new missions, in either mode;
  - the missions on a phone, a laptop or with a screen reader;
  - the horse's orders in the browser: no browser check gives them by key, button or touch (Node tests cover the card's keys, its buttons and the Command list).

# Worlds and gameplay, release 3: harder, less predictable battles

Release 3 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md) changes how the real-time battles play. The enemy now chooses plans. The raiders of Chapters I–III break and run, and squads see, can be ambushed and can lie in wait. Enemies pick their targets and use a few techniques. Each battle varies from the start, and Veteran is harder. This report records how the release was calibrated and checked, and what was not checked. The [changelog](../CHANGELOG.md) describes the changes for players, and the [player guide](player-guide-0.40.md) is the rules' reference.

How each kind of check was made:

- **Automated tests** (Node.js): `npm test`, with tests for each new rule and the determinism tests A1–A4.
- **Sweeps** (Node.js, headless, on the development container): a scripted bot plays the campaign from New Game, every battle by legal Commands, on 20 campaign seeds on each difficulty. A bot is not a player (see [Limitations](#limitations)).
- **The real interface:** the production build in headless Chromium with software rendering (`npm run smoke`).
- **Not performed:** a person playing the new battles, and any check on a phone or laptop.

## What changed

| Change | Rules | Code and data | Randomness |
| --- | --- | --- | --- |
| Enemy plans | Within its chapter's doctrine the enemy chooses a plan: hold you in front, turn your left or right, close on both flanks, feint, or commit its reserve early or hold it back (those two only at the start). A plan is kept for at least two rounds, and each faction favours its own. Each band also leans toward a target of its own, and the focus weighs a squad that stands alone or wavers. | `squad-ai.js` (`planDoctrine`, `enemyDecision`); `ENEMY_PLANS`, `ENEMY_FACTIONS` | `ai` stream: the plan at the start and at round boundaries once its hold has passed; each band's leaning once |
| The war band (Chapters I–III) | The raiders who fight alone are one band with one morale and a war leader. Losses, the leader's fall, ambushes and being outnumbered lower it; rest and reinforcements raise it. At 40 it wavers (−1 to its blows after Chapter I); at 20 it breaks and runs for its own edge. A man who escapes is gone for the objective but earns no training points. | `bands.js`; `BAND_MORALE` | none |
| Squad sight and ambushes (Chapter IV on) | Each squad keeps a notice meter on each hostile man and squad, by the single man's perception rules, four times a second. An exchange a squad never saw coming is an ambush: a whole exchange at once, twice the morale loss, and no help from brace or shield wall. The soldier's first blow on an unaware squad counts too. | `squad-sight.js`, `squads.js`, `combat.js`; `EXCHANGE.ambush`, `PERCEPTION.lying` | none |
| Lie in wait | A new order (card 7, one Command): the squad halts, keeps low, is half as easy to see, and falls on the first enemy squad within six metres. | `squad-ai.js` (`carryOut`, `followOrder`); `ORDERS.lie_in_wait` | none |
| Hidden raider bands (Chapter IV on) | On Standard (half the time) and Veteran (three times in four) a band of raiders may start lying in wait near its place, holding its javelins, unless the battle opens with a column to bring out. It falls on the first of ours to come near. Once one of ours nears the objective, or at the end of round 2, it rises and joins the plan. | `variety.js`, `squad-ai.js`; `HIDDEN_BANDS` | `world` stream, at the start |
| Targets and techniques | A raider strikes the most dangerous man near him. Persian, Palmyrene and the claimant's archers loose one aimed volley a round; Persian and Roman bands brace once they have held their ground; a wavering band pulls back behind a steady one; foot near their archers turn on the squad that presses them. | `ai.js` (`chooseTarget`), `squad-ai.js`, `squads.js`; `ENEMY_AI.threat`, `ENEMY_TECHNIQUES` | none |
| Each battle's variety | The weather is drawn from the chapter's season (Chapter II's marsh is always in fog). The four field objects, Chapter III's hidden man and each reinforcement's entry take one of the nearest open places to their own. Each enemy band (or Chapter I–III war band) gets a temperament: steady, bold or wary. | `variety.js`; `realtime-variety.js` | `world` stream, at the start |
| Exchange spread | Each squad exchange is the 0.38 exchange times 0.75, 0.9, 1, 1.1 or 1.25, weighted 1:2:4:2:1 (mean 1). The forecast still shows the 0.38 value. | `squads.js` (`exchangeSpread`); `EXCHANGE.spread` | `combat` stream, one draw an exchange |
| Veteran | Battle deadlines are two rounds shorter (never under four; the drill keeps its own). From Chapter IV, reinforcements arrive at full strength (ten men instead of seven), besides arriving a round earlier as before. No enemy is hardier or hits harder. | `campaign-encounter.js`; `REALTIME_DIFFICULTY` | none |
| The finale's reserve | In the battle and backer routes the claimant holds two cohorts back. They march on at the end of rounds 4 and 7 (two rounds later on Story), and the field is not won until they are beaten. | `campaign-encounter.js`; `FINALE_RESERVE` | none |
| Saves | Real-time fights record world version 3, and the new state is checked strictly when a save loads. A fight saved by an earlier version restarts from its checkpoint when the chronicle loads, as Retry checkpoint would. | `simulation.js`, `validate.js`, `game.js` | none |

Every new draw comes from the simulation's named random streams, which the world's snapshot carries. The same campaign seed therefore gives the same battle, a reloaded fight plays on exactly as before, and Retry checkpoint restores the same weather, field and enemy (tests: `realtime-variety`, `realtime-world-version`, A1–A4). Presentation draws nothing. The 0.38 combat formula is unchanged. Its parity test now checks that every exchange equals the 0.38 tenth times a factor of the spread, and that the factors average exactly 1.

## Results

The sweeps ([Story](evidence/realtime-release3-sweep-story.json), [Standard](evidence/realtime-release3-sweep-standard.json), [Veteran](evidence/realtime-release3-sweep-veteran.json)) play each seed's campaign from New Game three times:

- **Pass 1:** with each chapter's first decision; every battle of Chapters IV–XII on 20 seeds.
- **Pass 2:** with the decisions that change a field the other way (Varro left to his orders in Chapter VI, the soldiers first in Chapter VIII).
- **Pass 3:** every finale route from each seed's Chapter XII camp. A route the camp's meters do not open is entered with the meters the archive's practice gives it, and counted as injected (settlement and surrender, on every seed).

A lost battle is retried from its checkpoint, by the legal Retry command, up to once on Story, twice on Standard and three times on Veteran; the targets count only the tries each level allows. The battles of Chapters I–III are played on the way, as part of each campaign; a campaign stops if one is still lost after its retries, and none did.

### Against the plan's targets

Each target counts the 13 battles of pass 1 and the 5 finale routes of pass 3 on each of 20 seeds: 360 battles a level.

| Target | Story | Standard | Veteran |
| --- | --- | --- | --- |
| Won on the first try: Story every one, Standard ≥ 90%, Veteran ≥ 70% | 360 of 360 | 360 of 360 | 360 of 360 |
| Won within the tries allowed (one, two, three) | 360 of 360 | 360 of 360 | 360 of 360 |
| At least three enemy plans in each battle across the seeds | 5–6 in every battle | 5–6 in every battle | 5–6 in every battle |
| The finale's battle lasts 8–12 of its 16 rounds | 10 rounds | 8 rounds | 8 rounds |
| The simulation's tick rises by at most 0.3 ms at p95 | see [Tick time](#tick-time) | | |

Pass 2's 260 battles a level were also all won on the first try, so none of these battles lost a try on any level. Chapters I–III are [below](#chapters-iiii).

That the bot wins every battle on Veteran at the first try is within the plan's target (at least 70%). For this bot Veteran is harder in its margins, not its defeats: less slack and heavier losses (below). Chapter X's road was won on its deadline round once on Veteran, and Chapter IV's wall with one round to spare.

### Battle by battle

Each cell gives Story · Standard · Veteran, on the first try of pass 1 (20 seeds). *Least slack* is the fewest rounds left before the deadline when won; *loss* is the share of our squads' strength lost; *plans* is how many different enemy plans the 20 seeds saw on Standard; *hidden* is how many seeds began with a raider band lying in wait; *squad ambushes* counts exchanges in which a squad struck one that had not seen it, the enemy's first.

| Battle | Deadline | Rounds, median/most | Least slack | Loss, median | Plans | Hidden | Squad ambushes, theirs:ours |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IV, the gate | 19 · 16 · 14 | 6/7 · 7/8 · 7/9 | 12 · 8 · 5 | 47% · 72% · 78% | 6 | 0 · 9 · 16 | 0:17 · 0:0 · 0:0 |
| IV, the wall | 15 · 12 · 10 | 7/7 · 7/9 · 7/9 | 8 · 3 · 1 | 37% · 54% · 52% | 6 | 0 · 0 · 0 | 21:25 · 21:9 · 20:0 |
| V, the mine | 19 · 16 · 14 | 7/9 · 8/9 · 8/9 | 10 · 7 · 5 | 48% · 57% · 63% | 6 | 0 · 0 · 0 | 20:35 · 20:11 · 20:5 |
| V, the wall | 16 · 13 · 11 | 8/11 · 8/9 · 8/9 | 5 · 4 · 2 | 64% · 75% · 85% | 6 | 0 · 0 · 0 | 33:48 · 32:22 · 32:12 |
| VI, the wells | 23 · 20 · 18 | 8/9 · 8/9 · 8/9 | 14 · 11 · 9 | 49% · 56% · 58% | 5 | 0 · 11 · 18 | 33:29 · 35:4 · 37:0 |
| VI, the eagle | 17 · 14 · 12 | 5/6 · 5/6 · 5/6 | 11 · 8 · 6 | 45% · 39% · 37% | 5 | 0 · 0 · 0 | 42:37 · 37:26 · 36:10 |
| VII, the legion | 19 · 16 · 14 | 6/7 · 6/6 · 6/6 | 12 · 10 · 8 | 52% · 56% · 58% | 5 | 0 · 0 · 0 | 30:44 · 29:5 · 30:2 |
| VIII, the ferry | 25 · 22 · 20 | 5/6 · 5/7 · 5/6 | 19 · 15 · 14 | 38% · 38% · 38% | 5 | 0 · 7 · 12 | 4:22 · 2:7 · 3:4 |
| VIII, the crossing | 20 · 17 · 15 | 6/7 · 7/9 · 7/8 | 13 · 8 · 7 | 42% · 51% · 57% | 5 | 0 · 7 · 10 | 30:28 · 33:7 · 24:0 |
| IX, the wing | 18 · 15 · 13 | 6/7 · 5/8 · 6/8 | 11 · 7 · 5 | 44% · 52% · 52% | 5 | 0 · 0 · 0 | 24:54 · 20:6 · 18:0 |
| IX, the city | 20 · 17 · 15 | 6/7 · 6/7 · 6/7 | 13 · 10 · 8 | 29% · 35% · 35% | 5 | 0 · 0 · 0 | 22:48 · 14:12 · 15:3 |
| X, the road | 21 · 18 · 16 | 10/11 · 9/16 · 8/16 | 10 · 2 · 0 | 46% · 53% · 58% | 5 | 0 · 15 · 17 | 22:48 · 25:25 · 35:6 |
| XII, the confrontation | 19 · 16 · 14 | 10/10 · 8/8 · 8/8 | 9 · 8 · 6 | 12% · 13% · 17% | 5 | 0 · 0 · 0 | 151:199 · 140:130 · 151:69 |

- **Losses and slack follow the level** in every battle but two. Chapter VIII's ferry costs the same on each, and Chapter VI's eagle a little less on Veteran than on Story by the median; seed by seed, Veteran's loss there was lower on 11 of 20 seeds and higher on 9, within the battle's spread, while its slack still follows the level.
- **The finale's routes:** the battle and backer routes take 10 rounds on Story and 8 on Standard and Veteran on every seed; defection 2–4, settlement 4–5 and surrender 3–5.
- **Ambushes.** Our squads ambush the enemy far more often on Story, where the enemy's notice is slowest, and hardly ever on Veteran, where it is quickest. Most squad ambushes happen in battles with no hidden band: a band reaches another before it has been noticed.

### Chapters I–III

The sweeps play these chapters' six real-time battles (the drill included) on the way and do not tabulate them, so they were played again on the same 20 seeds, by the same bot and retries:

- **Story and Standard:** all 120 won at the first try.
- **Veteran:** 116 of 120 at the first try and all within two. Chapter II's marsh was lost once on seeds 1, 3 and 12 (a protected man lost), as it is on main with the same bot. Its rearguard was lost once on seed 4 (the soldier fell), which main wins at the first try.

### Compared with main

Main before this release (`5d0d451`, release 2) and this release were swept on the same five seeds on Standard, with the same bot and sweep scripts (this release's, so the bot fix of item 7 below applies to both), one after the other with nothing else running, twice each. Every battle was won at the first try in both.

| Battle | Rounds, median/most | Least slack | Loss, median | Tick p95, mean of two runs |
| --- | --- | --- | --- | --- |
| IV, the gate | 5/7 → 5/7 | 9 → 9 | 38% → 40% | 0.42 → 0.52 ms |
| IV, the wall | 7/8 → 7/9 | 4 → 3 | 65% → 51% | 0.41 → 0.52 ms |
| V, the mine | 8/8 → 8/9 | 8 → 7 | 46% → 60% | 0.47 → 0.53 ms |
| V, the wall | 8/8 → 8/9 | 5 → 4 | 71% → 77% | 0.47 → 0.59 ms |
| VI, the wells | 8/9 → 8/9 | 11 → 11 | 41% → 57% | 0.43 → 0.54 ms |
| VI, the eagle | 4/5 → 4/5 | 9 → 9 | 31% → 31% | 0.43 → 0.57 ms |
| VII, the legion | 5/6 → 6/6 | 10 → 10 | 53% → 53% | 0.88 → 0.99 ms |
| VIII, the ferry | 5/5 → 5/5 | 17 → 17 | 41% → 37% | 0.59 → 0.76 ms |
| VIII, the crossing | 7/8 → 7/7 | 9 → 10 | 48% → 54% | 0.55 → 0.66 ms |
| IX, the wing | 6/6 → 7/7 | 9 → 8 | 48% → 57% | 0.52 → 0.60 ms |
| IX, the city | 6/7 → 6/7 | 10 → 10 | 33% → 37% | 0.67 → 0.76 ms |
| X, the road | 7/9 → 10/10 | 9 → 8 | 55% → 53% | 0.77 → 0.74 ms |
| XII, the confrontation | 4/4 → 8/8 | 12 → 8 | 8% → 13% | 0.87 → 0.94 ms |

The finale's routes took 4–5 rounds on main and now take 8 (the battle and backer routes) or 3–4 (the standoffs). On these five seeds main showed no enemy plan at all; this release showed 4–6 different plans in every battle. Losses rose in eight battles of thirteen, by up to 16 points, stayed level in two and fell in three (Chapter IV's wall, Chapter VIII's ferry and Chapter X's road). The margins narrowed little on Standard, whose deadlines are unchanged; most of the narrowing is on Veteran (see [Battle by battle](#battle-by-battle)).

### Tick time

On the comparison above, the simulation's tick at p95 rose by 0.17 ms at most (Chapter VIII's ferry), within the plan's 0.3 ms, and by 0.07 ms in the largest fight, the finale (0.87 to 0.94 ms). The whole five-seed sweep took 56.5 s on main and 67.6 s with this release, about a fifth longer; part of that is the finale, which now runs twice as many rounds. The sweeps' own check against the Gate 4 evidence, which was measured in another session, gives at most +0.12 ms. The evidence files' tick times come from three sweeps running at once on the container's four cores. Their slowest single ticks, 9–41 ms, were not analysed here; earlier phases found such ticks at a fight's start or at collection pauses. None of these is a phone's measurement: the budget there is 4 ms at p95 on a 2022 phone, and no phone has been measured.

## What the sweeps found, and what changed

The sweeps were run after each step and again after each fix. In order:

1. **Chapter II's marsh in clear air.** With the weather drawn from the season, the marsh rescue was lost on some clear and rainy days: the raiders reached the wounded man first. Chapter II keeps its fog.
2. **Raiders went for the wounded of a column.** The new pull toward a badly wounded man drew raiders onto the protected men of an escort. It now applies to fighters only.
3. **The claimant's reserve entered behind a closed gate.** Its entry moved inside the field. The battle's variety now moves things only to tiles the soldier can reach from his start, a closed gate and a damaged bridge counted as shut.
4. **Veteran's finale ended in seven rounds.** Veteran brings reinforcements a round earlier, and that included the claimant's reserve. The reserve no longer comes earlier on any level (two rounds later on Story), so the battle lasts 8 rounds on Standard and Veteran and 10 on Story.
5. **The same battle, lost the same way.** Retry restores the identical battle, so a scripted bot that lost would lose again. On a retry the bot now plays more carefully, as a player who lost would: it binds wounds sooner, braces when two or more press it, keeps by the column or the held ground, and on a third try carries a wounded man off first.
6. **A hidden band gave itself away.** A band lying in wait threw javelins at passers-by and was then caught unaware itself. It now holds its missiles, and a band waiting in ambush is never ambushed.
7. **The bot's owed order never arrived.** The bot gave the chapter's owed Order again every half second, so each replaced the last before its delay had passed. In an evacuation, where it gives no other order, none arrived unless the soldier was carrying a man, and a careful retry of Chapter IV's evacuation on Veteran was lost on every try for want of an order. The bot now waits while an order is on its way. Only the bot changed.
8. **Hidden bands sat out the battle.** A hidden band that none of ours passed never fought. On Veteran, where three bands in four lie in wait, Chapter IV's gate was held against the rest in four rounds with about 6% losses on most seeds, fewer than on Story. A hidden band now rises once one of ours nears the objective, or at the end of round 2. On eight Veteran seeds, rising at the end of round 2 alone left the gate's median loss at 11%; rising also when ours near the objective took it to 80%. Rising at the end of round 1 did as much for the gate, but cost two first-try losses at the wall.
9. **Hidden bands left a column alone.** In Chapter VI's eagle the raiders' place is by the exit, so a hidden band waited there while the column marched, instead of hunting it as raiders do. The eagle got out with fewer losses on Veteran (median 29%) than on Story (45%). A longer reach for springing (12 or 15 m instead of 7.5) did not change that. Raiders no longer lie in wait in the two battles that open with a column to bring out (Chapter IV's wall and Chapter VI's eagle).

## Limitations

- **A bot is not a player.** The sweep bot gives only legal Commands and sees only what the rules show a player, not hidden men. But it decides by fixed rules twice a second, never pauses, and never misreads the field. A person may lose battles it wins, or win more cheaply. The plan's Gate 4 play-through on Story and Standard is the person's check.
- **Its retries are scripted.** On a retry the bot changes its play in one fixed way. A person changes it in their own. The sweeps' "within two" and "within three tries" figures therefore show that a battle can be won by a more careful approach, not how many tries a person will need.
- **The finale's battle always takes the same time.** The bot wins the battle and backer routes in exactly 8 rounds on Standard and Veteran, and 10 on Story, on every seed. Their length is set by the claimant's reserve: the battle ends once the last cohort, arriving at the end of round 7 (9 on Story), is beaten. The standoff routes (defection, settlement, surrender) still end in 2–5 rounds; the plan's 8–12 rounds is for the battle.
- **The charge is the existing one.** The plan names brace, charge and volley as the enemy's techniques. Enemy squads already charged with a run-up (`chargeReady`); this release adds the volley and the brace.
- **Times are this container's.** The tick times are Node.js on the development container, three sweeps at a time on its four cores for the evidence files and one at a time for the comparison with main. They are not a phone's, whose budget is 4 ms at p95.
- **Not checked:** a person playing the new battles; the morale rings, plan text and pauses on a phone, a laptop or with a screen reader; the battles in the 2D view beyond the automated smoke test.

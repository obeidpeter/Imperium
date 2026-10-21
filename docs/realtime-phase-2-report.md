# Real-time conversion: Phase 2 report

Phase 2 of the 0.40 conversion is built: squads, Command and the battles of Chapters IV–IX in real time. It **stops short of Gate 2**, whose main checks need people and a phone: Peter winning every Chapter IV–IX battle on Standard, a less experienced tester winning them on Story with auto-pause, and 30 fps on the phone with six squads and the party. None of those has been performed. The automated checks pass: the scripted bot's deadline sweep across 20 seeds a battle, and tests A1 and A2 in the largest battle. Both are below.

The playtests and phone checks of Gates 0 and 1 are still owed as well.

- **Specification:** [player-guide-0.40.md](player-guide-0.40.md) and the build brief (supplied separately, not stored here).
- **Previous phase:** [realtime-phase-1-report.md](realtime-phase-1-report.md).
- **Branch:** `claude/hopeful-faraday-x8zvuo`, as before. No pull request has been opened.

## How to play it

Real time is still opt-in, and the 0.38 turns stay the default until Gate 4.

1. Run `npm run dev` (or add `?dev` to a build's address) and open Settings → Development.
2. Set **Controls model** to *Real time*. Chapters I–IX are now converted:
   - Chapters I–III keep their walkable camps;
   - Chapters IV–IX start their battles from the 0.38 camp screen, and their Contests stay on turns until Phase 3.
3. From Chapter IV the soldier commands squads:
   - **Standards.** The squad bar's standards select squads: click, Shift+click, a tap, or Shift+1–6.
   - **Command card.** It replaces the ability bar (keys 1–6).
   - **Pointer orders.** The right button orders the selection: ground advances, an enemy band is attacked, and your own soldier means withdraw and brace.
   - **Order marker.** The arrow keys move it; Enter sends the order.
   - **Command.** The pips beside the clock show what is left this round.
   - **Standing orders.** Each squad's four standing orders are set in the company panel (**R**), in camp.
4. From Chapter VII a battle opens in **deployment**. Place the company in the marked zone, then press **Sound the advance** twice.
5. In battle:
   - **Threats.** Point at an enemy to see the ground he could strike within the round, hatched in red.
   - **Intentions.** Pause and hold **U** to see each visible enemy's intention as an arrow.
   - **Field intelligence.** **Q** shows it, with Allied plans & visible threats.

## Gate 2

| Check | Status | Evidence |
| --- | --- | --- |
| Peter wins every Chapter IV–IX battle on Standard | **Not performed** | The bot's sweep below is the automated proxy, not a person's play |
| A less experienced tester wins them on Story with auto-pause | **Not performed** | — |
| A scripted bot finds no impossible deadline across 20 seeds per battle | **Passes.** <ul><li>220 of 220 battles won (20 seeds for each of the 11 battles), the closest with 4 rounds to spare.</li><li>On 20 more campaigns with the other decisions of Chapters VI and VIII, all 209 battles reached were won.</li><li>Before it passed, the sweep found three real faults that made deadlines impossible or nearly so. All are fixed, each with a test.</li></ul> | [The deadline sweep](#the-deadline-sweep); `docs/evidence/realtime-gate2-sweep.json` |
| ≥ 30 fps on the phone with 6 squads plus the party, tick ≤ 4 ms at p95 | **Not measured: no phone here.** <ul><li>Node tick p95 in the IV–IX battles is 0.28–0.70 ms (median of the per-battle values over 20 seeds).</li><li>The heaviest battle measured alone: p95 0.83 ms and p99 1.6 ms.</li><li>The performance check now times a six-squad battle for the phone run.</li></ul> | [Measurements](#measurements) |
| Tests A1 and A2 in the largest battle | **Pass** (automated). Chapter VII's legion: 66 figures and 9 squads, from deployment to victory, with saves at three points mid-fight. | `tests/realtime-gate2.test.mjs` |
| K-budget | **For the owner to assess**; not tracked here | — |

## What was done

| Deliverable | Where |
| --- | --- |
| Squads and the combat port | `src/core/realtime/squads.js`. From Chapter IV each 0.38 military unit is a squad. <ul><li>Its strength is its Health; its men are ordinary actors that it drives.</li><li>The men keep their places in line, shield wall, wedge, loose order or a marching column.</li><li>Two squads in contact, or archers in range, exchange a tenth of a 0.38 turn's exchange once a second. The exchange uses the 0.38 formula with its modifiers in metres. A port test checks it against `combatBreakdown` in eleven situations.</li><li>A squad fights a single man (the soldier, a companion, a protected column) the same way, as one body.</li></ul> |
| Morale, cohesion and suppression | <ul><li>The 0.38 hit per man lost.</li><li>The thresholds: shaken at 40, broken at 20.</li><li>Recovery at the round's end when held still or supported; regrouping; withdrawal shock.</li></ul> |
| Orders and Command | `command.js`, `order-intents.js` and `squad-control.js`. <ul><li>The chapter's Command capacity, refilled each round.</li><li>One point an order; a formation one for up to three squads in a connected group within 15 m (the join rule).</li><li>The Authority order delay, none with Clear orders.</li><li>The command card, squad selection, the order marker and order lines, in 3D and 2D.</li></ul> |
| Squad standing orders | `squad-ai.js` and `squad-orders.js`. <ul><li>Four slots, with defaults from 0.38's allied intents.</li><li>The presets Line of battle, Reserve and Flank guard.</li><li>An editor in the company panel, kept in the chronicle.</li></ul> |
| Specialists, Rally and the Signifer | `specialists.js`. <ul><li>Guard, Inspire and Volley for one Command each; in standing orders they use only Command left at a round's end.</li><li>Rally (from Chapter VI) costs Stamina only.</li><li>The Signifer (from Chapter IV, through the character panel) teaches Steady voice (+5 m Rally) and Clear orders (no order delay).</li></ul> |
| Deployment | `deployment.js`. From Chapter VII: <ul><li>the clock stands still;</li><li>one thing is placed at a time in the zone the 0.38 Deploy allowed;</li><li>Sound the advance must be confirmed;</li><li>placing demonstrates Deploy.</li></ul> |
| Field objects | `field-objects.js`, in every battle after the drill: <ul><li>the side gate (a wall until opened; Shift+click breaks it);</li><li>the footbridge (a ford once repaired);</li><li>the barricade's timber cover;</li><li>the brazier's smoke and fire;</li><li>the two opportunities, one only, closing at the end of round 7, with their edition-34 effects.</li></ul> |
| Weather | <ul><li>Mist dulls perception.</li><li>Rain, mist and dust weaken missiles beyond 20 m, and the squad exchange's poor visibility.</li><li>Rain slows the high ground's edge to half speed, and a brazier burns one round instead of three.</li></ul> |
| Cavalry charges and the braced counter | A mounted squad's straight run-up on firm ground charges, unless the target is braced. A braced front that survives a frontal charge strikes back once a round. Chapter IX's stakes take the enemy's charge away. |
| Intelligence | `intel.js`: <ul><li>intention arrows on **U** while paused;</li><li>the red-hatched threat of a pointed or targeted enemy;</li><li>Allied plans & visible threats;</li><li>the field intelligence panel: the enemy's doctrine and focus, the approach, the opportunities and when they close, the field's objects.</li></ul> The After-Action Chronicle adds our squads, the enemy bands cut down and the opportunity taken. |
| Preparations and approaches | `campaign-encounter.js`: <ul><li>**Engineering.** Its +10 Defence applies to the company's squads' men in the ported squad formula, never to the soldier. Its walk-only opening applies to the soldier in rounds one and two.</li><li>**Diversion.** One band is drawn to the false approach until the end of round two.</li><li>**Defensive advance.** The company starts braced.</li><li>**Engineer train and command reserve.** The train holds the soldier to a walk all battle; the reserve costs him a pilum.</li><li>**Chapter VII.** Rest adds 4 Health; fortifying starts the soldier braced.</li><li>**Chapter IX.** The night march fights at night.</li></ul> |
| Auto-pause | Every event, each with its own setting: <ul><li>a new round;</li><li>the party seen, an enemy revealed or reinforcements arriving;</li><li>a party member badly hurt or down;</li><li>one of our squads breaking;</li><li>a new objective;</li><li>a refused order.</li></ul> |
| Encounters IV–IX migrated, with the calibration recorded | `REALTIME_READY_CHAPTERS` is now I–IX (`src/core/controls-model.js`). [realtime-encounters.md](realtime-encounters.md) is now generated from battles built as the campaign builds them: <ul><li>ten tiles wide in Chapters V, VIII, IX and XII;</li><li>with their operation phases;</li><li>a row for each decision that changes the field;</li><li>each battle's deadline.</li></ul> Every route walks within 5.6% of its 0.38 turns. |

## The deadline sweep

`scripts/realtime-sweep.mjs` (development only; `--write` saves the evidence).

**The bot** (`scripts/realtime-autoplay.mjs`) is a simple heuristic player. It acts only through legal commands, from New Game:

- The soldier fights, binds and carries the wounded, leads columns and keeps beside a threatened one.
- From Chapter IV it commands. It forms its leading squads in line (Chapter V on) and restores a shaken squad's morale. It sends a free squad at a band that closes, except in an evacuation, where the squads keep screening the column. It rallies (Chapter VI on) when squads near it waver.
- It makes the camp choices the 0.38 autoplay makes: Chapter VII's drill, VIII's safe passage and IX's flank march.
- Companions keep their standing orders.
- Contests are played on turns by the 0.38 autoplay.

**The sweep** plays the whole campaign in real time through Chapter IX on Standard:

- **Pass 1** uses each chapter's first decision. Seeds are added until every battle of IV–IX has been played on 20 of them; seed 19 stops in Chapter II (below), so 21 seeds were used.
- **Pass 2** takes the other decision where it changes a field: Varro left to his orders in Chapter VI, and the soldiers first in Chapter VIII. Its battles before Chapter VI repeat pass 1's.

| Battle | Won (pass 1) | Rounds: median / most | Deadline | Fewest rounds to spare | Other decision (pass 2) |
| --- | --- | --- | --- | --- | --- |
| `ch4-gate` | 20 of 20 | 5 / 8 | 16 | 8 | — (19 of 19) |
| `ch4-wall` | 20 of 20 | 7 / 8 | 12 | 4 | — (19 of 19) |
| `ch5-mine` | 20 of 20 | 8 / 8 | 16 | 8 | — (19 of 19) |
| `ch5-wall` | 20 of 20 | 9 / 9 | 13 | 4 | — (19 of 19) |
| `ch6-wells` | 20 of 20 | 8 / 9 | 20 (18 if Varro is left) | 11 | obey: 19 of 19, 13 to spare |
| `ch6-eagle` | 20 of 20 | 4 / 6 | 14 | 8 | obey: 19 of 19 |
| `ch7-legion` | 20 of 20 | 5 / 6 | 16 | 10 | 19 of 19 |
| `ch8-ferry` | 20 of 20 | 5 / 5 | 22 (19 with the soldiers first) | 17 | soldiers: 19 of 19, 13 to spare |
| `ch8-crossing` | 20 of 20 | 7 / 8 | 17 | 9 | soldiers: 19 of 19 |
| `ch9-wing` | 20 of 20 | 5 / 6 | 15 | 9 | 19 of 19 |
| `ch9-city` | 20 of 20 | 7 / 8 | 17 | 9 | 19 of 19 |

**No battle of Chapters IV–IX was lost** in either pass. The one loss in the sweep is in Phase 1's Chapter II marsh (seed 19). A raider reached the bound Lucan, who has 14 Health after binding, and killed him in two blows while the soldier and Naso were already striking that raider. Phase 1's report describes the same loss. It is a combat outcome, not a deadline.

### What the sweep found, and the fixes

The first sweeps lost battles that a player could have lost the same way. Each fault was traced to its cause and fixed in the rules, with a test that fails without the fix:

1. **Chapter VI, when Varro is saved: the deadline was impossible.** 0.38 shelters Varro on a lone "wall" tile, which in 0.38 is standable cover. Real time treats walls as solid, so he stood sealed inside a solid block that nobody could reach.
   - **Fix:** a lone wall now becomes a breastwork round its block, open at the rear. The men inside fight from behind it (`upsampleTerrain`).
   - Chapter VII's fortify preparation, also a lone wall, becomes the same redoubt.
2. **Deadlocks at a taken waypoint (Chapter VIII ferry).** The column's route ran through the spot where the squad guarding it stood. Body separation kept the column and the soldier from ever reaching that waypoint, so they waited for ever.
   - **Fix:** a walker within a body's width of a waypoint another body stands on goes on to the next one, if the way there is clear (`motion.js`).
3. **Squads stranded behind walls (Chapter IV wall).** Each man walked straight to his place in the formation and stopped at a wall, while his standard went round through the gap. The squads "guarding the column" stood 35–45 m from it.
   - **Fix:** a blocked man finds a route to his place, and a standard waits while most of its men are more than 12 m from their places (`squads.js`).
4. **Columns counted only the soldier and his companions as cover.** A column halts when an enemy is within 8 m and no friend within 4 m. The men of a squad screening the column now count as cover (the guide: escorting, the squads screen the column).
5. **The bot itself** had to learn to assist in Chapter VI's rescue phase, and to demonstrate each chapter's capability: Order, Formation, Rally, Deploy and the Stratagem. The last battle of a chapter cannot be won without them.
   - The field now says in words what is still to do, for example "The objective is held, but you must still give a squad an order."
   - A loss on the deadline says the same.

## Test results

| Group | Result | Kind |
| --- | --- | --- |
| Whole Node suite (`npm test`, inside `npm run verify` with the autoplays and the build) | 985 tests pass (937 at the end of Phase 1) | Automated |
| **A1, A2** in the largest battle | Chapter VII's legion (66 figures, 9 squads) from deployment to victory: <ul><li>the same camp and commands give the same world hash at the start and the end;</li><li>saved into the chronicle at ticks 143, 977 and 2311, reloaded and played on, it ends with the uninterrupted fight's hash.</li></ul> | Automated |
| Chapters I–IX from New Game | The bot wins every battle on the default seed. Each chapter's capability is recorded: Order (IV), Formation (V), Rally (VI), Deploy (VII) and the Stratagem (IX). | Automated |
| **E25–E27**, the squad port | <ul><li>Command capacity, refill, the delay, set-aside and refund.</li><li>The join rule.</li><li>Morale, cohesion and suppression.</li><li>Restore morale and the held brace.</li><li>The exchange against 0.38's `combatBreakdown`.</li><li>A squad against a single man.</li><li>Squad determinism and snapshots.</li></ul> | Automated |
| **41c, H39 with squads** | Selection, the right button's orders, the card, the marker, and the Command list's squad entries | Automated |
| Field objects, preparations, deployment, intelligence | <ul><li>Six tests for the field objects.</li><li>Six for preparations, approaches and rain.</li><li>Two for deployment, including a save.</li><li>Three for intelligence.</li></ul> All are on battles reached by the 0.38 command campaign's legal commands. | Automated |
| **A5** | Every auto-pause event, including an enemy revealed, reinforcements and one of our squads breaking | Automated |
| The sweep's faults | <ul><li>The breastwork; Varro reachable.</li><li>The taken waypoint.</li><li>Men routing round a wall.</li><li>A screened column walking on.</li><li>The capability wording.</li></ul> The movement tests are injected scenarios on small open fields; the rest use legal campaign battles. | Automated |
| Browser smoke test (production build, headless Chromium) | Two new scenarios: <ul><li>**Squads:** a restored Chapter V battle in real time: the squad bar, the Command pips, Shift+1 and 4 for a line, and Q's field intelligence.</li><li>**Deployment:** a restored Chapter VII battle opens with the clock stopped until Sound the advance is pressed twice.</li></ul> At the time of writing the first five of the ten scenarios had passed on this build and the real-time ones were still running; the result is recorded in the commit that follows. | Real interface, automated, software rendering |

## Measurements

None was taken on a real device.

| Measurement | Value | Where |
| --- | --- | --- |
| Simulation tick in the IV–IX battles, with the bot's commands (p95; median of the battle's 20 seeds) | <ul><li>ch4-gate 0.28 ms; ch4-wall 0.31; ch5-mine 0.41; ch5-wall 0.42;</li><li>ch6-wells 0.35; ch6-eagle 0.35; ch7-legion 0.70;</li><li>ch8-ferry 0.54; ch8-crossing 0.51; ch9-wing 0.43; ch9-city 0.62.</li></ul> | Node 22, this container, during the sweep |
| The heaviest battles measured alone (5 runs each; p50 / p95 / p99 / max) | <ul><li>Chapter VII's legion: 0.19 / 0.83 / 1.56 / 11.3 ms.</li><li>Chapter VIII's crossing: 0.15 / 0.69 / 1.56 / 25.9 ms.</li></ul> The maxima fall in a fight's first ticks (code warming up) or on collection pauses. | Node 22, this container |
| The performance check's battles (p95, three runs) | 15 men 0.07–0.11 ms; 82 men 0.25–0.44 ms; six squads with the party 0.67–0.85 ms | Node 22, this container |
| First download | 0.69 MB of the 2 MB budget | Build report (gzip sum) |
| Chapter I download group | 9.75 MB of the 10 MB budget (9.68 MB at the end of Phase 1) | Build report. 0.25 MB of headroom is left. |
| Phone frame rate with six squads | Not measured | — |

**Two speed-ups** came with the sweep:

- **The route finder** is about 2.7 times faster on a long route. Its heap's sifts no longer allocate, and its inner loop is tighter. It finds bit-identical routes: the calibration and every test are unchanged.
- **A squad chasing a target** re-aims the last leg of its route while it stays clear, instead of searching the whole route again.

Before them, the heaviest battle's p99 was 3.2 ms; after them it is 1.6 ms.

## Deviations

### From the guide (what the player sees)

1. **Chapters IV–IX have no walkable camps.** Their battles start from the 0.38 camp screen, and the Signifer is reached from the character panel (**C**). The guide's walkable camps exist for Chapters I–III only.
2. **Real time is opt-in** through the development settings until the later gates; Chapters X–XII stay on turns, and so do the Contests until Phase 3.
3. **A lone 0.38 wall** (Varro's shelter; the fortify preparation) is a breastwork open at the rear, not a solid block.
4. **Columns** keep walking while a man of a squad screening them stands within 4 m, as well as the soldier or a companion.

### From the brief (implementation)

1. **Branch:** as in Phases 0 and 1.
2. **The bot** plays Contests on turns (Phase 3 converts them). It demonstrates capabilities as a player would, through legal orders.
3. **The sweep's seeds** are campaign seeds from New Game. A battle's world draws its random streams from the campaign's generator, so the seed varies the battle's rolls and everything before it.
4. **Movement:**
   - A walker passes a waypoint another body stands on.
   - A squad's men route round obstacles to their places.
   - A standard waits for stragglers (more than half its men over 12 m from their places).
   These are additions the sweep showed were needed. The distances are in the rules.
5. **The performance check** times a six-squad battle (46 men in six squads, the soldier, two companions and nine raiders), as well as Phase 0's 15- and 82-man fights.

## Known issues

- **Every rendering result comes from software rendering in a container.** No real desktop or phone has played Chapters IV–IX.
- **Gates 0, 1 and 2 still owe their playtests and phone measurements.**
- **Seed 19's Chapter II marsh loss** is unchanged since Phase 1 (above).
- **The phone layout** of the field's top bar covers much of the scene once the squad bar, the Command pips and the mission header are all shown. The Phase 4 polish pass is to tidy it.
- **Single-tick maxima** of 10–70 ms appear in Node, at a fight's first ticks and on collection pauses. They are single frames, not sustained.
- **Chapter I's download group** is within 0.25 MB of its budget.

## Proposed next step

1. **Peter plays Chapters IV–IX in real time on Standard.** A less experienced player plays them on Story, with auto-pause. Please note:
   - any battle that felt unfair against its deadline;
   - squads that would not do what was asked;
   - anything the field did not explain.
2. **On the phone:**
   - Run `npm run build` and `HOST=0.0.0.0 npm run preview`.
   - Play Chapter VII's legion, the largest battle.
   - Use Settings → Run performance check → Save results. The check now times a six-squad battle against the 4 ms budget; the gate is 30 fps.
3. **Phase 3 proceeds meanwhile,** as the owner has asked: the walk-and-talk Curia and the Contests of Chapters VII, VIII, X and XI.

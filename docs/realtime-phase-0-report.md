# Real-time conversion: Phase 0 report

Phase 0 of the 0.40 conversion is built and **stops at Gate 0**. The brief puts Gate 0's most important check in Peter's hands: playing the arena for 15 minutes and judging whether the feel is worth continuing. Phase 1 does not start before that.

- **Specification:** [player-guide-0.40.md](player-guide-0.40.md), converted from `Imperium-Player-Guide-0.40.docx` with `pandoc … -t gfm`.
- **Survey:** [realtime-survey.md](realtime-survey.md).
- **Branch:** `claude/hopeful-faraday-x8zvuo` (see [deviation 1](#from-the-brief-implementation)).

## Gate 0

| Check | Status | Evidence |
| --- | --- | --- |
| Tests A1–A4 pass | **Passed** (automated) | `tests/realtime-determinism.test.mjs` (see below) |
| Auto-fight wins 10 of 10 fights without re-clicking | **Passed as a duel test; the arena fight is 99.1%.** Which reading the gate means is Peter's call (see below) | `tests/realtime-combat.test.mjs`; the arena benchmark |
| Desktop click-to-first-movement ≤ 100 ms | **Not measured on a desktop GPU.** By construction and in automation, the movement is drawn on the first frame after the click. | See [Click to first movement](#click-to-first-movement) |
| ≥ 45 fps on the reference phone with 15 actors | **Not measured: no phone here.** The arena's own performance check measures exactly this on the device. | Peter: Menu → Run performance check on the phone, then Save results |
| Peter plays the arena for 15 minutes and judges the feel worth continuing | **Waiting for Peter** | — |

### Auto-fight: what was measured

- **Duels (the test):** ten fights, each one click on one raider (axe, spear and skirmisher in turn), with the lock surviving staggers. **10 of 10 won without re-clicking.**
- **The arena** (a Legionary against all three at once), with one click per raider and no pila, no Brace and no stepping aside:
  - 991 of 1,000 seeds won, with 13.5 of 26 Health left on average after about 24 s of battle time. The test requires at least 97% of 200 seeds.
  - Opening with both pila first: 995 of 1,000.
  - Of the first ten seeds, the second is lost. The losses are runs of the axe man's criticals from the flank, not a stuck lock or a pathing failure; the traced logs show it.
  - In headless Chromium, three whole fights were played through the page's own command queue, one click per raider. All three were won: in 33.8 s of battle time with 9 Health left, 16.8 s with 10, and 22.6 s with 17.
- **The decision for Peter:** if "10 of 10 fights" means arena fights, the raiders can be tuned a little weaker in data (`ARENA` and `WEAPONS` in `src/data/realtime-rules.js`). I left the fight dangerous on purpose so its feel can be judged.

### Click to first movement

| Step | Time |
| --- | --- |
| Click | The press queues a Command at once. |
| The command's tick | The clock is *hurried*: the tick the command waits for runs on the next frame. The time is borrowed from the frames that follow, so the world's pace over any second is unchanged. A test checks that pace. |
| Drawn | The soldier's first movement is drawn on the first rendered frame after the click. |

- **Expected on a 60 Hz desktop:** between one and two frames, about 17–35 ms, plus the browser's input delay. This is an estimate, not a measurement.
- **Automated measurement (software rendering):**
  - The smoke test and benchmark record the movement 1 frame after the click (2 animation frames at Performance quality, which draws every other frame).
  - In milliseconds it ranged from 20 ms to 3.2 s (median 97 ms over five clicks), following SwiftShader's uneven frame times. That is not a desktop measurement.
- **On a real desktop:** the arena's Menu → Run performance check reports this visit's clicks ("Click to first movement").

## What was done

| Deliverable | Where |
| --- | --- |
| Survey: every module mapped to keep, adapt, replace or delete-after-Gate-4, with the stack recorded | [realtime-survey.md](realtime-survey.md) |
| `controlsModel` flag (`'turns'` or `'realtime'`), persisted, with the `realtimeChapters` fallback and a development menu | `src/core/controls-model.js`, Settings → Development (in `npm run dev`, or `?dev` in a build) |
| Simulation core | `src/core/realtime/` (rules as data in `src/data/realtime-rules.js`): <ul><li>a fixed 20 Hz tick;</li><li>Commands applied at tick boundaries, the latest order per actor winning;</li><li>named random streams split from the campaign's seeded generator;</li><li>pause, slow time, speed and step (`clock.js`);</li><li>runs headless in Node.</li></ul> |
| The arena | `showcase/arena.html` with `src/showcase/arena.js`, `live-figures.js`, `realtime-input.js` and `arena.css`: a Legionary against three raiders with simple AI, on the frontier road's own map and 3D world |
| Movement and fighting | <ul><li>Click to move: near clicks walk and far clicks run (over 8 m); hold to keep steering; **W** walks.</li><li>Combat mode on **Space**, and auto-fight on a click.</li><li>**Brace** (2) and **Throw pilum** (3).</li><li>Engaged soldiers walk.</li><li>Route line, destination and target rings.</li></ul> |
| Forecasts, message line, cursor states and battle log | <ul><li>Forecast: hit, shield block, landing chance, damage after armour, criticals and every modifier.</li><li>Cursors: walk, run, attack, blocked, ability valid and ability invalid.</li><li>Message line, plus a line for what just happened.</li><li>Battle log with battle time; selecting an entry looks at that place.</li></ul> |
| Determinism and save/load hash tests | `tests/realtime-determinism.test.mjs` |
| Simulation timing in the performance check | Settings → Run performance check (report version 2 adds `simulation`), and the arena's own Menu → Run performance check |
| Browser-safe input | <ul><li>`src/ui/action-map.js`: the §7 keys by `KeyboardEvent.code`; forbidden keys rejected; swap on conflict; labels from the layout map or learnt from presses; `?` for help on any layout.</li><li>`realtime-input.js`: context menu, wheel zoom, gestures and autoscroll suppressed on the scene only; CSS `touch-action: none` and its fellows; Ctrl+click as the right button on a Mac; no `dblclick` anywhere.</li></ul> |

### Also in the arena

- **On the figures:**
  - allegiance rings at every man's feet, full for friends and spiked for enemies, each with a chevron showing which way he faces;
  - a guard arc while bracing, and a star on your soldier;
  - floating numbers, sparks and missiles in flight;
  - close-ups on criticals, which never happen while paused, while you drag the view or with reduced motion.
- **While paused:** a faint line shows what your soldier will do on resume.
- **Pointing:** with an ability chosen, the right button's forecast follows the left button's.
- **Menu options:** Quick-cast, Pause each round, Pause when an enemy sees you, Draw to attack, Keep fighting, Hold to move, Swap mouse buttons, Sound effects, Reduced motion, game speed and graphics quality.
- **Touch:**
  - a tap acts and a still hold inspects;
  - a tapped ability is armed for the next tap, and tapping it again uses it on yourself;
  - **Force** arms one forced attack;
  - pinch zooms and two fingers twist the view.
- **Keyboard:**
  - arrows move, **T** / **Shift+T** choose targets, **Enter** attacks, the digits choose and use abilities;
  - **P**, **V**, **N** and **W**; **F**, **Z** and **H**; **,** / **.**; **+** / **−**; **G**;
  - the screen reader is told target forecasts, hits on you, falls, pauses and where you stopped.
- **Fight to fight:** the arena keeps no saves; each "Fight again" takes the next seed from the campaign's own generator (`?seed=` reproduces one).

## Test results

`npm run verify` passes.

| Group | Result |
| --- | --- |
| **A1:** same seed and command log, 100 replays at 50%, 75% and 100% speed, with random pauses, slow time and frame lengths | Identical world hash every time |
| **A2:** saving at 50 random ticks, loading and continuing at varied speeds | Identical hash. Snapshots keep the queue and every random stream. |
| **A3:** while paused | No tick runs. Commands queue with the latest order per actor winning (other command kinds keep their own place), and apply on the first tick after resume. |
| **A4:** N while paused | Exactly 200 ticks at every speed, slowed or not, then paused again. The browser smoke test checks the same in the page. |
| Mutation checks | <ul><li>`Math.random` in the combat roll fails A1 and A2.</li><li>Dropping latest-wins fails A3.</li><li>A snapshot without the queue fails the snapshot test.</li></ul> |
| **C13:** 10,000 rolls | 10% ± 1% criticals and 2.5% ± 0.5% automatic misses. Criticals ignore absorb and are doubled only for the controlled actor. |
| **C14** | A blow above a fifth of Health, or any stun, staggers and interrupts. A braced man is never staggered. |
| **C15** | The shield blocks only inside the front 120°, is halved by a stuck pilum, and gains 0.30 braced. Blows from behind gain +10 Attack. |
| **C17** | Forecast hit and landing chances match 10,000 rolls within ±1.5%, from the front, the flank and the rear. |
| **C12**, Keep fighting and the Gate 0 duels | Pass |
| **B6, B8, B9, B10**, separation, next-tick movement, cursor states, T cycling | Pass |
| **D19** (Brace, Throw pilum) | Costs are spent only on success: a pilum is spent at release, and an interrupted cast spends nothing. |
| **H41** (browser safety, the automatable part) | Pass |
| Invalid commands and forecasts | Change nothing, the random streams included |
| Whole suite | 884 Node tests (838 at 0.38.1), legal-command autoplays, the build, asset checks and audits |
| Browser smoke test (production build, headless Chromium) | Its new arena scenario passes: the development menu routes the skirmish to the arena, a click moves the soldier, pause stops the clock while Space queues, clicking a raider locks him, and N plays 200 ticks. No page or console errors. |

## Measurements

The **renderer** column says where each figure came from. None was taken on a real device.

| Measurement | Value | Renderer |
| --- | --- | --- |
| Simulation tick, 15 men fighting (p50 / p95) | 0.05 / 0.31 ms | Node 22, this container |
| Simulation tick, 82 men fighting (Phase 2's budget is about 70 figures plus 12) | 0.12 / 0.71 ms, max 1.9 ms | Node 22, this container |
| Simulation tick in the page, 15 / 82 men (p95) | 0.2 / 0.5 ms | Headless Chromium |
| Arena ready (built, programs compiled) | 4.0 s | SwiftShader, Performance, 1280×800 |
| 15 fighting men drawn | 11 frames in 12 s; median frame interval 217 ms (about 5 fps) | SwiftShader. Software rendering of this scene; meaningless for the phone gate. |
| Click to first movement | 1 frame after every click (5 of 5); 20 ms to 3.2 s, median 97 ms | SwiftShader |
| First download | 1.39 MB of the 2 MB budget | Build report |

The full record of the last benchmark run is [arena-phase0.json](evidence/arena-phase0.json) (`npm run benchmark:arena -- --dist --write`).

Profiling the tick found the navigation grid's key rebuilt on every lookup and each man's derived values recomputed several times per tick. Both are cached now, which halved the 82-man tick.

## Deviations

### From the guide (what the player sees)

1. **Not in Phase 0 by plan:**
   - the panels (**I**, **C**, **J**, **Q**, **L**, **M**, **R**, **A**, **O**), whose keys say they arrive in Phase 1;
   - quick save (**F2**) and saves, as the arena keeps none;
   - companions, squads, Command and the Command list;
   - the threat hatching and enemy intentions on **U**, ink for an ability's reach, and the key-remapping screen. The map behind it, `action-map.js`, can already remap.
2. **Auto-pause:** only *an enemy comes into view* (as "an enemy has seen you") and *pause each round* exist. The other three events arrive with their systems.
3. **The current ability** stands above the ability bar at the bottom right, not beside the portrait.
4. **Unbound keys:** **X** (see-through) is not bound, though the stage's automatic cutaway works in the follow view. **U** adds nothing yet, because names are always shown.
5. **G** shows the weapon's reach and the throwing range; there is no area ability yet.
6. **Fixed for now:** floating numbers cannot be turned off yet. The arena has no difficulty choice and plays Standard numbers.
7. **Reached from the title screen** through Settings → Development (controls model *Real time*), or directly at `showcase/arena.html`. With the flag on *Turns*, *Try a standalone skirmish* still opens the 0.38 skirmish, which must stay playable until Gate 4.

### From the brief (implementation)

1. **Branch.** The brief asks for `realtime-0.40`, but this session may push only to its designated branch: the push to `realtime-0.40` was refused, so the work is on `claude/hopeful-faraday-x8zvuo`, which fast-forwarded from main. No pull request has been opened.
2. **Reason codes added:** `NO_SHIELD`, `STAGGERED`, `NO_TARGET`, `TARGET_DOWN`, `NOT_HOSTILE`, `ACTOR_DOWN` and `BATTLE_OVER`, for cases the brief's list does not name.
3. **The hurried tick.** A command still applies at a tick boundary, as §3.1 requires; the page runs that boundary on the next frame and repays the time. Determinism is untouched, because commands carry the tick they apply at.
4. **Phase 0 enemy AI** (`ai.js`):
   - A 13 m notice radius and a band alarm, instead of §3.10's notice meters, which come in Phase 1.
   - Each raider approaches its own side of you: 0°, ±70° and ±140° from the line at engagement.
   - The skirmisher throws two javelins from 7–18 m before closing.
   - Raiders never flee, because group morale arrives in Phase 2.
   - Decisions run at 4 Hz, staggered by actor.
5. **Choices the brief leaves open, now data:**
   - Facing turns at 720°/s, and a swing starts only with the target within 60° of facing.
   - Reach is measured from centre to body (+0.35 m); a blow still lands within 0.5 m beyond reach at contact.
   - Missiles aim where the target will be when they arrive, strike anyone within 0.9 m of that point, and are judged from where they left the hand.
   - Health and Stamina regenerate in whole points.
6. **Tuning numbers** (§3.5: every constant is tunable). Damage ranges are not in the brief:
   - gladius pierce 4–8 and cut 1–3;
   - spear pierce 2–6;
   - axe cut 4–8 and crush 0–2;
   - spatha cut 3–7 and pierce 1–2;
   - pilum pierce 5–10, and javelin pierce 3–7;
   - armour as listed in `ITEMS`;
   - raiders at Combat 7–8.
   They were tuned so that one click per raider wins about 99% of arena fights with about half Health left.
7. **Arithmetic.** The rules use only arithmetic and square roots, which every engine rounds the same way: no `Math.hypot`, sine or cosine. The A1/A2 tests run in Node's V8; replay across browser engines is not tested.
8. **The world hash** is two FNV-1a lanes over the JSON snapshot (64 bits), not a cryptographic hash.
9. **Rounds.** The round boundary currently only marks the round (and *Pause each round*). Command refill, recovery and the other §3.1 system-8 effects arrive with their systems.
10. **Arena map size.** It is the frontier road's own 20 × 20 m. Scaling maps by travel time applies to the campaign's encounters (Phases 1–2, `docs/realtime-encounters.md`).
11. **Roving tabindex** is used on the ability bar only. The other HUD buttons are ordinary tab stops; Safari's Tab handling is Phase 4 polish.

## Known issues

- **Every rendering number above comes from software rendering in a container.** No browser on a real device, desktop or phone, has run the arena yet.
- **Figure kit is approximate until layered kit (Phase 1):**
  - the skirmisher fights with a spatha but his figure carries the raider's spear;
  - javelins fly as a smaller pilum;
  - the figure keeps its weapon in hand when sheathed; only the HUD's crossed swords show the state.
  Shields do match the rules: a man without one carries none.
- **A slain man slumps, then lies as battle remains.** There is no separate death animation.
- **Phones:** the HUD covers part of the scene at phone width. Touch has been exercised only by unit tests of the input layer, not on a device.
- **Tight spots:** raiders in a tight spot can shuffle as separation pushes them apart. RVO was not needed in testing.

## Proposed next step

1. **Peter plays the arena for 15 minutes:**
   - Run `npm run dev` and open `http://127.0.0.1:4173/showcase/arena.html`. On the title screen, Settings → Development → *Real time* makes *Try a standalone skirmish* open it.
   - Please judge the feel: walking and running speeds, swing timing, damage, how the raiders press you, Brace and the pilum, the camera, pause and the forecasts.
   - Menu → Run performance check on the desktop gives the click-to-movement time.
2. **The phone measurement:**
   - On the same trusted network, run `npm run build`, then `HOST=0.0.0.0 npm run preview` (in Windows PowerShell, `$env:HOST='0.0.0.0'; npm run preview`), which serves only the production build. Open the computer's address on port 4173, at `/showcase/arena.html`.
   - Then Menu → Run performance check → Save results. The check reports frames per second with 15 fighting men; the gate is 45.
3. **One tuning pass** (K0 allows one extra iteration of up to three days) on what the playtest finds. Then Phase 1, if Gate 0 passes.

# Real-time conversion: Phase 4 report

Phase 4 of the 0.40 conversion is built: the finale and Chapter X's road in real time, difficulty, every setting with key remapping, the in-game help generated from the guide, the 0.38 save migration, the features that must keep working, and a finishing pass over offline play, the phone layout and performance.

With this phase every chapter has its real-time form. The bot completes the whole campaign in real time, from New Game to the accession, on Story and on Standard.

**Gate 4 is not yet passed.** Its automated checks pass. Its other checks need people and devices that this container does not have:

- a person completing the campaign on Story and on Standard;
- the manual tests of §5 (keyboard-only play, a screen reader, colour, text size and reduced motion);
- the performance budgets measured on a phone and a desktop;
- the guide checked against the game by its owner.

Real time therefore stays opt-in behind the development setting, and the 0.38 turns stay the default and playable until Gate 4 passes.

- **Specification:** [player-guide-0.40.md](player-guide-0.40.md) and the build brief (supplied separately, not stored here).
- **Previous phase:** [realtime-phase-3-report.md](realtime-phase-3-report.md).
- **Branch:** `claude/hopeful-faraday-x8zvuo`, as before. No pull request has been opened.

## How to play it

1. Run `npm run dev` (or add `?dev` to a build's address) and open Settings → Development.
2. Set **Controls model** to *Real time*. Every chapter now plays in real time, its Contests in the chamber:
   - Taking a chapter out of the real-time chapters returns it to the 0.38 turns (the kill criteria's fallback).
   - The archive's practice replays keep the 0.38 board.
3. **Begin your story** now asks for the recruit's training and appearance, beside the difficulty and Iron discipline.
4. In Chapter XII's camp, choose the confrontation as before. Each route plays in real time:
   - **The backer** and **the battle**: defeat the rival armies.
   - **Defection**: Rally within three places (23 m) of a rival band to swear the oath; it costs that band 40 morale, and at 25 it pledges itself. Three pledges win.
   - **Settlement**: bring the Senate's envoy to the claimant under parley, stay within two places of him, and reassure the parley with a Rally; two rounds of the meeting win.
   - **Surrender**: secure both gate approaches, then bring your soldier to the claimant's standard.
5. **Menu → Controls & readability** remaps the keys and sets the pointer's habits. **Menu → Time and pace** sets the game speed and the auto-pause events. **?** opens the guide.

## Gate 4

| Check | Status | Evidence |
| --- | --- | --- |
| The full campaign completed from start to finish on Story and on Standard | **Automated: passes. By a person: not performed.** <ul><li>The bot plays the whole campaign from New Game to the accession on Standard and on Story, through legal commands only.</li><li>The sweeps play every battle of Chapters IV–XII on 20 seeds per difficulty, and every finale route from each seed's Chapter XII camp.</li></ul> A person's play-through on each difficulty is the next step. | `tests/realtime-gate2.test.mjs`, `tests/realtime-difficulty.test.mjs`; [sweep, Standard](evidence/realtime-gate4-sweep.json); [sweep, Story](evidence/realtime-gate4-sweep-story.json) |
| Every test in §5 passes | **The automated [A] tests pass. The manual [M] tests (29, 36, 37, 40 and 42) have not been performed.** | Test results below |
| The performance budgets are met | **Not measured on a phone or a desktop.** The simulation's tick on this container is far inside its budget (below). | Measurements below |
| No P0 or P1 bugs | **None known.** The issues found in this phase were fixed (below); the open ones are listed under Known issues. | — |
| The guide matches the game | **For its owner to confirm.** The deviations are listed below; the guide's text is unchanged. | Deviations below |

## What was done

| Area | What was built |
| --- | --- |
| The finale | <ul><li>Chapter XII's confrontation in real time, on every route ([`mission.js`](../src/core/realtime/mission.js)). The standoffs follow 0.38's rules: the oath, the pledges (joining a side of fewer than eight units, or leaving the field), the envoy under parley, the meeting's rounds and the claimant's standard.</li><li>The rival bands keep their 0.38 names (the Rival claimant, the civil-war cohorts), and the field announces the oath, the pledges and the meeting.</li><li>Chapter XII's Contest is walked in the chamber.</li></ul> |
| Chapter X's road | Both grain routes secured with the stores kept, in real time. Every chapter now has its real-time form. |
| Difficulty | <ul><li>The difficulty table holds in real time: Story's three extra rounds on battle deadlines, reinforcements two rounds later on Story and one earlier on Veteran, objective pressure 6/10/14, and notice and reaction by level. No level adds enemy health or damage, and Contest hours are the same on every level.</li><li>**Time and pace follow the difficulty:** Story starts at 75% speed and pauses when an enemy comes into view; Standard and Veteran start at 100% with every auto-pause off. The pace stays the player's once they change it.</li><li>Iron discipline, built in Phase 1, is unchanged.</li></ul> |
| Settings | <ul><li>**Keys:** every real-time action can be remapped in Menu → Controls & readability. The next key pressed becomes its key; a key already in use swaps the two commands; the browser's keys, Tab, Esc, Enter and the arrows are refused, and Esc cancels. **Restore default keys** puts them back. The field, its buttons, its hints and the guided opening use the player's keys at once.</li><li>**The pointer and readability:** draw to attack, keep fighting, quick-cast, hold to move, edge scrolling, swap mouse buttons, labels (while **U** is held, or always), objective markers and floating numbers.</li><li>**Time and pace:** game speed, the five auto-pause events, pause each round and pause in panels.</li><li>The Menu always pauses the world.</li></ul> |
| Controls & rules | The in-game help in real time is the player guide itself, chapter by chapter, generated from [player-guide-0.40.md](player-guide-0.40.md) by `npm run guide:help` ([`guide-help.mjs`](../scripts/guide-help.mjs)). Its key tables show the player's own keys. A test fails while the generated help and the guide differ. **?** opens it where the player is: a fight at Battles, a chamber at Political Contests, a camp at The campaign. |
| Migration from 0.38 | <ul><li>A chronicle saved before 0.40 loads exactly as saved.</li><li>In camp it is asked once for its soldier's training and appearance, the Legionary first. Choosing grants the training points the campaign could have given through its completed chapters ([`tp-audit.js`](../src/core/tp-audit.js)), once.</li><li>A battle in progress on the 0.38 board, in a chapter that now plays in real time, offers **Restart in real time**: the same battle from its checkpoint.</li></ul> |
| The features that must keep working | <ul><li>**The guided opening** now teaches the real-time drill step by step, with pause and slow time among its lessons, then the first patrol and the opening chamber hours.</li><li>**The practice post**, **the patron-funded Contest rerun**, **the reign card**, **Recover an earlier checkpoint** and **Continue in this tab** work as before.</li></ul> |
| Offline packs | Every module the page can load, on demand included, is in the first download or in every chapter's offline pack. The build now refuses to finish otherwise. The generated help is part of the first download, so it works offline. |
| The finishing pass | <ul><li>**A save can be up to 1 MB** (it was 256 KB). A real-time fight keeps its start and its resume point, and the finale's mid-fight save is about 330 KB.</li><li>**The live 3D scene marks the objective**, the positions to secure and the next wave, as the 2D view and the 0.38 board did.</li><li>**The chamber counts hours**, not turns, in its record, messages and result.</li><li>**On a phone** the guided opening sits under the top bar rather than over the controls, and the key list folds away.</li><li>**Sound the advance always asks to confirm.** Within five seconds of the page loading, one press used to start the battle; the smoke test found it.</li></ul> |

## Test results

| Group | Result | Kind |
| --- | --- | --- |
| Whole Node suite (`npm test`) | 1018 tests pass (998 at the end of Phase 3) | Automated |
| The finale | <ul><li>Chapter X's road won and recorded.</li><li>Every finale route played and recorded as 0.38 records it (settlement and surrender with their meters injected).</li><li>The oath: the lowest-morale band in reach loses 40 morale and, at 25, pledges itself, joining a side of fewer than eight units or leaving the field; the oath can be sworn once a round; three pledges win (placements and morale injected).</li><li>No one strikes the envoy; the meeting counts only with the envoy beside the claimant, the soldier near and the parley reassured (placements injected).</li><li>The surrender needs the soldier at the standard.</li><li>A1 and A2 in the defection standoff.</li></ul> | Automated; injected scenarios labelled |
| Difficulty | The table of §3.18 in real time, Contest hours on every level, and the pace defaults; the whole campaign on Story to the accession. | Automated |
| Settings and help | <ul><li>The key map keeps legal changes and falls back whole when damaged; remapping swaps and refuses the browser's and fixed keys (H41).</li><li>The menu lists every remappable action once.</li><li>The field's hints name the player's keys.</li><li>The generated help matches the guide, and its key tables follow the player's keys.</li></ul> | Automated |
| Migration (G35) | A 0.38 chronicle loads exactly as saved; choosing its soldier grants its chapters' training points once; a 0.38 battle restarts in real time from its checkpoint, and a refused restart changes nothing. | Automated |
| The guided opening | The drill's lessons in order, pause and slow time among them, in the player's keys; the first patrol's and the opening chamber hours'; reading a lesson changes nothing. | Automated |
| Browser smoke test (production build, headless Chromium) | Three new scenarios and two extended: <ul><li>**Chamber Contests** now includes Chapter XII's.</li><li>**Finale:** Chapter XII's defection route opens in real time from its camp, deploys and advances; a rival band hears the oath.</li><li>**Settings:** a Story chronicle starts at 75% with a pause on enemies in view; Pause is remapped to K in the Menu (Tab refused, Esc cancels), K pauses the camp and is named on its button and in the generated help; Restore default keys.</li><li>**Legacy chronicle:** a Chapter V camp without a soldier record asks once for its soldier and grants Chapters I–IV's training points; a turn-based battle restarts in real time.</li><li>**The drill** now follows the guided opening's first lessons.</li></ul> All 16 scenarios pass in one run, with no page or console errors (13 at the end of Phase 3). The harness now closes a failed scenario's pages before the next one starts. It also gives keys to the scene once a dialog has handed focus back, and presses the advance's confirmation within its five seconds: under load, both had timed out. | Real interface, automated, software rendering |

## Measurements

| Measurement | Value | Where |
| --- | --- | --- |
| The sweeps through Chapter XII (20 seeds each; Node, this container) | <ul><li>**Standard:** every battle of Chapters IV–XII won on 20 seeds; every finale route won on 19 (seed 19 stops in Chapter II, as in Phase 2).</li><li>**Story:** every battle and every route won on 20 seeds.</li><li>The finale is won in 4–5 of its 16 rounds by the bot; Chapter X's road in 8–12 of 18–21.</li></ul> | [Standard](evidence/realtime-gate4-sweep.json), [Story](evidence/realtime-gate4-sweep-story.json) |
| Simulation tick in the largest fight (the finale, 86 people; p95 / max) | 0.78 / 8.4 ms on Standard, 0.73 / 22.6 ms on Story; the budget is 4 ms at p95 on a 2022 phone. The maxima fall on collection pauses. | Node 22, this container (not a phone) |
| The arena (production build) | <ul><li>Ready in 4.0 s.</li><li>A click's movement drawn 1 frame after it (median of five; at most 2).</li><li>The simulation's tick: 0.3 ms at p95 with 15 people, 0.5 ms with 82.</li><li>Three whole fights won with one click per raider.</li></ul> Its frame rate (1 fps) is software rendering's, not a device's. | `npm run benchmark:arena -- --dist`, headless Chromium, software rendering |
| Save size | About 180 KB at the finale's start and 330 KB mid-fight; the limit is now 1 MB. | `tests/realtime-finale.test.mjs` |
| First download | 0.75 MB of the 2 MB budget (0.71 MB at the end of Phase 3); the generated help is 29 KB of it | Build report (gzip sum) |
| Chapter I download group | 9.82 MB of the 10 MB budget (9.78 MB at the end of Phase 3). 0.18 MB of headroom is left. | Build report |
| The complete campaign | 18.27 MB of the 24 MB budget | Build report |
| Phone and desktop frame rates | Not measured | — |

## Deviations

### From the guide (what the player sees)

1. **Contextual tactical advice** is the 0.38 board's. In real time the field intelligence (**Q**) and the guided opening serve instead.
2. **Edge scrolling** slides the 3D view; the 2D view shows the whole field.
3. **Labels always** keeps the names over everyone in crowded 3D scenes; the 2D view always names people.
4. **Controls & rules** shows the player's own keys in its key tables; elsewhere its text names the default keys, as the guide does.
5. **A chronicle from before 0.40** is asked for its soldier in camp. Until a choice is made, the rules read a Legionary with his chapter's kit; the camp card offers the choice again, and the training points are granted when it is made.
6. **A battle in progress from 0.38** is not restarted on its own: loading never changes a chronicle. Its board offers **Restart in real time**.
7. **The archive's practice replays** keep the 0.38 board, as Phase 3 noted.
8. **Time and pace** follow the difficulty until the player changes one of its settings; after that they are the player's on every difficulty.
9. **The guided opening's** lessons are the drill's (seven, pause and slow time among them), the first patrol's two and the opening chamber's two hours.

### From the brief (implementation)

1. **Branch:** as in Phases 0–3.
2. **A save can be up to 1 MB** instead of 256 KB, because a real-time fight keeps two worlds.
3. **The real-time default** has not been switched on and the turn code has not been deleted: both wait for Gate 4.
4. **The 0.38 Contest log** still says "turn"; the chamber shows it as "hour". The rules' own words are unchanged so that F30 can compare them with the frozen 0.38 routes.

## Known issues

- **Every rendering result comes from software rendering in a container.** No real desktop or phone has played Phase 4's chapters.
- **Gates 0–4 owe their playtests, phone measurements and manual accessibility checks.**
- **The Chapter I download group** is at 9.82 of its 10 MB budget.
- **Named saves of a real-time fight** are larger than 0.38's (up to about 330 KB each). Six slots and the chronicle's history fit a browser's local storage, but with less room to spare.
- **The finale may be easy in real time:** the bot wins every route in 4–5 of 16 rounds. Its balance needs a person's play.
- **The settlement and surrender routes** were only reached with their meters raised: the bot's campaign never opens them. A person's campaign that does would test them as played.
- **The chamber on a phone.** Phase 3 noted the header over the chamber's north edge. Checked again after this report (Chapter VII at 390 × 844, both views), the header leaves the tribunal in view, but the HUD below it (the speakers, the hour, the speech bar, Motion and List: 319 of the scene's 658 pixels) hides the floor's south half. The fix is to frame the floor between the header and the HUD. Moving the header out of the scene alone pushed the floor under the HUD and put the 3D labels out of place, so it was not kept.

## Proposed next step

1. **Peter plays the campaign in real time**, once on Standard and once on Story (a less experienced player for Story, as the brief asks). Please note:
   - any battle or route that felt too easy, too hard or unclear;
   - any setting, key or help page that did not do what it said.
2. **On the phone and a desktop:**
   - Run `npm run build` and `HOST=0.0.0.0 npm run preview`.
   - Run Menu → Run performance check in a large battle (Chapter VII or XII) and save the results file.
   - Play a few minutes with touch, and check that the guided opening, the settings and the help read well.
3. **The manual checks of §5:** keyboard-only play (Chapters I–II, the standing orders of III, the Formation of V, the deployment of VII, a Contest and a kit change); a screen reader (NVDA or VoiceOver); colour, 200% text and reduced motion.
4. **Then Gate 4:** with those passed, real time becomes the default, the guide's deviations are settled with Peter, and the turn code listed in the survey is removed.

## After the report

A review of the finished work found these; all but the last are fixed. Checked with `npm run verify` (1019 tests) and the full browser smoke test on the production build: automated, real interface, software rendering.

- **A pause could be undone by the Menu.** The Menu pauses the world while it is open, and its close event can come hundreds of milliseconds after it closes. A pause pressed in between was resumed when that event came. The player's pause, or a round played with **N**, now stands. The smoke test reproduces the case and failed on it before the fix.
- **Messages name the player's keys.** "Pause first (P)", "Choose a target first (T)", "Walking everywhere (W)", the chamber's **Y**, **[** / **]** and skip key, the defeat advice and the hover hint for drawing a weapon all named the default keys.
- **The settings follow the controls.** In real time the Menu uses the guide's names (**Close-ups**, **Touch hold delay**, the guided opening's hours) and keeps Confirm moves with the turn-based board's shortcuts. On the 0.38 board, Time and pace, objective markers and floating numbers are not shown, since only the real-time field reads them.
- **The browser smoke test prints each scenario's time.** Alone, the 16 scenarios take about 11 minutes, inside CI's 30-minute limit.
- **The chamber on a phone** was measured again, and is described under Known issues; it is not fixed.


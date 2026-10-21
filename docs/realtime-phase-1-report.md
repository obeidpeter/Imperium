# Real-time conversion: Phase 1 report

Phase 1 of the 0.40 conversion is built: the soldier, his party and Chapters I–III in real time, with walkable camps. It **stops short of Gate 1**, whose main checks need people and a phone: three playtesters completing Chapters I–III on Standard, the keyboard-only H36 run, and 30 fps on the phone in the heaviest Chapter III fight. None of those has been performed. The automated proxies for them are below.

Gate 0's playtest and phone checks were skipped by the owner's decision to continue; they are still owed.

- **Specification:** [player-guide-0.40.md](player-guide-0.40.md) and the build brief (supplied separately, not stored here).
- **Previous phase:** [realtime-phase-0-report.md](realtime-phase-0-report.md).
- **Branch:** `claude/hopeful-faraday-x8zvuo`, as in Phase 0. No pull request has been opened.

## How to play it

Real time is still opt-in, and the 0.38 turns stay the default until Gate 4.

1. Run `npm run dev` (or add `?dev` to a build's address) and open Settings → Development.
2. Set **Controls model** to *Real time*. Chapters I–III are the converted ones.
3. Start a new chronicle. The camp of Chapter I is now a place to walk through: talk to Varro on the drill field, decide at the commander's table, swear the oath at the standards and march out at the gate.

## Gate 1

| Check | Status | Evidence |
| --- | --- | --- |
| Three playtesters (Peter plus two) complete Chapters I–III on Standard | **Not performed** | Automated proxy: the legal-command autoplay below |
| Median "companion rescue" incidents (stuck, lost or suicidal) at most 1 per fight | **Automated proxy passes: median 0, maximum 1.** Not the playtest's count. | [Companions](#companions) |
| No softlocks | **None found by automation.** Every fight of 20 seeds ended in a result; none stalled. | [Autoplay](#autoplay-from-new-game) |
| Keyboard-only parts of H36 for Chapters I–III | **Not performed by a person.** Parts are exercised in the browser smoke test. | [Keyboard](#keyboard-touch-and-screen-reader) |
| At least 30 fps on the phone in the heaviest Chapter III fight | **Not measured: no phone here.** | Settings → Run performance check on the phone, in the fight |
| Budget for Phases 0–1 | **For the owner to assess**; not tracked here | — |

## What was done

| Deliverable | Where |
| --- | --- |
| Abilities: Strike, Brace, Throw pilum, Bind wounds, Carry, Scout and Shield bash | `src/core/realtime/abilities.js` and `actions.js`. Rules data: `src/data/realtime-rules.js`. <ul><li>Bind wounds spends its bandage on completion, and a landed blow stops it with the bandage kept.</li><li>Carry is sheathed and walking only.</li><li>Scout spends 20 Stamina and reveals hidden men nearby.</li><li>Shield bash needs its course and a shield, and spends its Stamina when delivered.</li><li>Your own side is never struck, forced or not.</li></ul> |
| Character panel, training paths, TP, and the Campidoctor, Capsarius and Explorator trainers | `src/core/soldier.js` and `src/data/soldier.js`; panels in `src/ui/soldier-views.js`. <ul><li>TP cost 4/5/6… on the base value.</li><li>Courses are taken once each.</li><li>The trainers: Varro on the drill field, Didius at the valetudinarium from Chapter II, and the explorator Brennus from Chapter III.</li></ul> |
| Decorations and titles | Earned by deeds and errands, and shown on the Decorations panel (**A**). Attribute bonuses apply. |
| Kit, pack, loot, the quartermaster and denarii | <ul><li>Layered places and per-type protection.</li><li>The 10 × 6 pack with Sort, swap-on-equip, the per-area ground strip, Take all and Give.</li><li>Loot from the fallen: staged in the fight, received only when the result is recorded.</li><li>The quartermaster, and the sutler's goods in the canabae.</li><li>Prices by Eloquence, and pay.</li></ul> |
| Up to 3 companions, standing orders, presets, the leash and control switching | `src/core/realtime/party.js`: <ul><li>four slots evaluated at 4 Hz, the first feasible one winning;</li><li>presets Shieldmate, Skirmisher, Orderly and Soldier, with a summary sentence;</li><li>the 25 m leash (40 m for an attack on an enemy near you);</li><li>portraits, **[** / **]** and **Home** switch control.</li></ul> Company panel (**R**) with a four-slot editor; the barracks roll chooses who marches. |
| Perception, notice meters and ambush | `src/core/realtime/ai.js`: <ul><li>notice meters by distance, gait, drawn weapons, darkness, mist, cover, cloaks and Fieldcraft;</li><li>the eye's states (idle, suspicious, alert);</li><li>the party spotting hidden men;</li><li>a blow on a man who has not noticed you lands as a critical (C16).</li></ul> |
| Walkable camps I–III, with dialogue, decisions, the War Council, errands and chronicle pages | <ul><li>Camps: `src/data/camps.js` and `src/core/realtime/camp-world.js`.</li><li>Conversations: data in `src/data/dialogue.js`, engine in `src/core/dialogue.js`.</li><li>The commander's table holds the chapter's decision and the War Council; the oath is sworn at the standards; the gate marches out under the 0.38 departure rules.</li><li>Eight errands, three of them a training path's own, each of those awarding a title.</li><li>A defeat page for each encounter, and chronicle pages (**L**).</li><li>**M** lists the camp's places and travels to those already walked to.</li></ul> |
| Saves | <ul><li>A resume point on pause or a hidden page, discarded when play resumes.</li><li>Quick save (**F2**) and five named saves, each with a picture of the moment (`src/ui/save-slots.js`).</li><li>Iron discipline, chosen at New Game.</li><li>Rules in `src/core/game.js`: `saveRealtime`, `clearResume`, `manualSaveProblem`, `codeState`.</li></ul> |
| Touch and keyboard paths, Command list v1, screen reader v1 | <ul><li>The Command list (`commandOptions` in `intents.js`) offers every scene action as a list, including while paused (H39).</li><li>The number keys and ability buttons follow one rule (`abilityKey`, D21).</li><li>Panel keys work in the field and in camp.</li><li>The announcer speaks targets, forecasts, hits on the party, falls, objectives and auto-pause reasons.</li></ul> |
| 2D view parity | `src/showcase/flat-stage.js`: <ul><li>the field and the camp drawn on a canvas in the 0.38 isometric projection;</li><li>the same picking, follow camera, zoom, overview, commands, lists and marks as the 3D stage.</li></ul> Used when the 2D view is chosen or WebGL is unavailable. |
| Chapter I–III encounters migrated and tuned | `src/core/realtime/campaign-encounter.js` and `mission.js`. Maps are scaled by travel time: every battle of Chapters I–XII walks within 5.3% of its 0.38 turns ([realtime-encounters.md](realtime-encounters.md)). Escorted columns halt and draw back when threatened and uncovered (`ESCORT_RULES`). |
| TP audit | [tp-audit.md](tp-audit.md), generated from the data by `node scripts/tp-audit.mjs` (`--check` in the tests): at most 61 TP by the end of Chapter III, and 237 by Chapter XII. |
| Auto-pause | One rule, `autoPauseReason` (`intents.js`), each case with its own setting: <ul><li>a new round;</li><li>the party being seen;</li><li>a party member falling below a quarter of his Health or going down;</li><li>a new objective;</li><li>a refused order.</li></ul> The field stops the clock on that tick and announces the reason. |

## Test results

| Group | Result | Kind |
| --- | --- | --- |
| Whole Node suite (`npm test`, inside `npm run verify` with the autoplays and the build) | 937 tests pass (884 at the end of Phase 0) | Automated |
| **A1, A2** in the campaign | The same hash for the same seed and commands, and after a save and load mid-fight, in Chapter I–III battles | Automated |
| **A5** | Every auto-pause event pauses with its option on and not with it off; nothing pauses in camp or for a practice partner; the simulation raises each event | Automated |
| **C16, C18** | An unnoticed attacker's blow is a critical. Forcing an attack on a neutral turns him hostile, writes the journal, and charges Public Confidence at the record. | Automated |
| **D19, D19b, D20, D21** | Every technique validates with its reason codes, spends only on success and respects recovery; the starting Stamina of every path affords Rally, Scout and Brace; Bind wounds' self and interrupt cases; the number-key rule | Automated |
| **E22–E24** | The leash and fall-through, the summary sentence of every preset, and control switching | Automated |
| **G33** | TP costs; no legal Chapter I–III run earns more than the audit; a fight's TP comes only with its record, once (not before it, nor again on a retry or a second record) | Automated |
| **G34** | Layering, swap-on-equip, Sort, the ground strip and Take all | Automated |
| **G35, 41b** | The resume point restores the fight exactly and is discarded on resume; quick and named saves restore exactly and refuse a damaged save; Iron discipline blocks manual saves in encounters, its save code carries only the checkpoint, and it can be lifted but not restored | Automated |
| **H39** | The Command list reaches every scene action, including while paused | Automated |
| Browser smoke test (production build, headless Chromium) | All eight scenarios pass (the three real-time ones again on the final build), including two new ones: <ul><li>**Campaign, 3D:** the walkable camp (a conversation, the table's decision by key, the gate), then the drill (click, pause, **F2** and a named save with their pictures, **T** and **Enter**, abilities by number), the After-Action Chronicle and the record.</li><li>**2D:** the same camp and drill drawn flat.</li></ul> No page or console errors. | Real interface, automated, software rendering |

## Autoplay from New Game

`scripts/realtime-autoplay.mjs` plays from New Game by legal commands only: the soldier fights with a simple heuristic and the companions keep their standing orders. Seeds 1–20, Standard, Chapters I–III:

- **19 of 20 seeds** win all six encounters. Before escorted columns learned to halt and fall back, 11 did; each other seed lost the marsh.
- **Seed 19** still loses the marsh: a raider reaches the bound survivor while the soldier fights two others. A player can intercept him, and the autoplay does not. It is a tuning note, not a softlock.
- **Median rounds:**

| Encounter | Median rounds |
| --- | --- |
| Drill | 1 |
| Frontier road | 6 |
| Marsh | 5 |
| Rearguard | 3 |
| Road station | 4 |
| Rolls | 3 |

### Companions

The incidents are counted by `companionWatch` in the autoplay, a proxy for the playtest's count:

- **stuck:** ordered to move but no nearer after ten seconds;
- **lost:** more than 40 m from the soldier for ten seconds;
- **suicidal:** down more than 25 m from the soldier.

Over 114 fights: **median 0, maximum 1** per fight. All three incidents are Felix being *lost* in the Chapter III rolls (seeds 6, 13 and 18). He finishes a fight with a man near the soldier's path while the autoplay's soldier runs on to the objective, then follows. A player who waits for his archer sees none of these.

## Measurements

None was taken on a real device.

| Measurement | Value | Where |
| --- | --- | --- |
| Simulation tick by encounter (p50 / p95 / max, default seed) | <ul><li>road 0.003 / 0.010 / 0.1 ms;</li><li>marsh 0.006 / 0.016 / 2.8 ms;</li><li>rearguard 0.004 / 0.007 / 0.1 ms;</li><li>station 0.005 / 0.51 / 5.4 ms;</li><li>rolls 0.009 / 0.043 / 7.0 ms.</li></ul> The maxima are path searches and collection pauses. | Node 22, this container |
| First download | 0.63 MB of the 2 MB budget | Build report (gzip sum) |
| Chapter I download group | 9.68 MB of the 10 MB budget | Build report. Little headroom is left for Phase 2. |
| Phone frame rate in Chapter III | Not measured | — |

## Deviations

### From the guide (what the player sees)

1. **One Saves panel.** Menu → **Saves** holds quick save, the five named saves and loading, instead of separate Menu → Quick save, Save and Load entries. **F2** quick-saves in the field and in camp.
2. **Real time is opt-in** through the development settings until the later gates; Chapters IV–XII stay on turns.
3. **The 2D view** draws code-drawn figures (allegiance rings, spiked for enemies; the fallen lie down and the carried ride beside their carrier), not the 0.38 painted figures.
4. **Not in Phase 1 by plan:**
   - squads, Command, orders, formations, specialists, deployment, weather and cavalry, and the intelligence on **U** (Phase 2);
   - the Curia (Phase 3);
   - the key-remapping screen and the 0.38 save migration with its TP grant (Phase 4).
5. **U** shows the full labels only; enemy intentions and threat hatching on **U** come with Phase 2.

### From the brief (implementation)

1. **Branch:** as in Phase 0.
2. **The leash** is measured from the soldier: beyond 25 m a companion comes back, unless an attack names an enemy within 40 m of the soldier. A companion fighting such a man may himself be a little over 40 m away (the incidents above).
3. **Escorted columns** (not in the brief) halt when an enemy is within 8 m and no friend within 4 m, and fall back toward the nearest friend. Both distances are data.
4. **The TP audit's commendations** are this build's: keeping one's feet 1, an ambush 1, and, with companions from Chapter III, bringing every one home 2. Kill TP: one per enemy struck down, at most ten an encounter.
5. **Save pictures** are 160 × 90 JPEGs stored with the slot. In 3D the stage draws one frame for the picture, even when paused under a panel.
6. **The resume point** sits beside the encounter-start checkpoint in the same chronicle (`encounter.realtime.resume`). A reload without it starts the encounter again, as Retry does.

## Known issues

- **Every rendering result comes from software rendering in a container.** No real desktop or phone has played the campaign's real-time chapters.
- **Gate 0 is still owed:** Peter's arena playtest and the phone measurement.
- **Seed 19's marsh loss and Felix's three *lost* incidents** are described above.
- **Chapter I's download group** is within 0.32 MB of its budget.
- **The heaviest fight's tick maxima** (5–7 ms) are single spikes. The 4 ms p95 budget is Phase 2's, with six squads; the p95 here is 0.5 ms or less.

## Proposed next step

1. **Peter plays Chapters I–III in real time** (as above), ideally with two more players. Please note:
   - any companion you had to rescue;
   - anything that stuck;
   - whether the camps, conversations and errands read well.
   A keyboard-only run of Chapters I–II and of Chapter III's standing-order setup covers H36's Phase 1 part.
2. **On the phone:**
   - Run `npm run build` and `HOST=0.0.0.0 npm run preview`.
   - Play the Chapter III road station.
   - Use Settings → Run performance check → Save results. The gate is 30 fps.
3. **Phase 2 proceeds meanwhile,** as the owner has asked: squads, morale, Command and the battles of Chapters IV–IX.

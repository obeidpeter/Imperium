# Real-time conversion: Phase 3 report

Phase 3 of the 0.40 conversion is built: the walk-and-talk Curia for the Contests of Chapters VII, VIII, X and XI. The 0.38 Contest engine stays the rules, and the chamber is how the page presents it.

Gate 3 asks for test F30 to pass and for every Contest to be played through in full. Both pass as automated checks:

- **F30** replays the frozen 0.14.1 and 0.16 routes, and generated 0.38 logs, through the chamber.
- **The browser smoke test** plays all five chamber Contests from legal camp saves to a won vote and **Record the result**. It drives the page's own command path; it is not a person's play.

No person has played a Contest in the chamber yet, and no phone has opened one. The playtests and phone checks of Gates 0, 1 and 2 are still owed as well.

- **Specification:** [player-guide-0.40.md](player-guide-0.40.md) and the build brief (supplied separately, not stored here).
- **Previous phase:** [realtime-phase-2-report.md](realtime-phase-2-report.md).
- **Branch:** `claude/hopeful-faraday-x8zvuo`, as before. No pull request has been opened.

## How to play it

Real time is still opt-in, and the 0.38 turns stay the default until Gate 4.

1. Run `npm run dev` (or add `?dev` to a build's address) and open Settings → Development.
2. Set **Controls model** to *Real time*. The Contests of Chapters VII, VIII, X and XI now open as chambers:
   - Chapter XII's legitimacy Contest stays on the 0.38 board until the finale (Phase 4).
   - Taking a chapter out of the real-time chapters keeps its Contests on the 0.38 board (kill criterion K3).
3. In the chamber:
   - **Hours.** Each hour, each of your speakers may walk inside the pale circles that show his reach and give one speech. The hour ends when every speaker still standing has spoken, or on **Yield** (**Y**). The rivals then take their hour, played out for 3–6 seconds; a click or **Space** skips it.
   - **Talking.** Click a member to talk to him where you stand. The conversation shows his bloc and stance, each speech with its forecast, and **Ask about his interests** (free). **Walk beside him** brings him into reach.
   - **Speeches.** Choose one on the bar (**1–7**) and right-click a member, a rival, your ally or (Address the Chamber) the floor. Pointing first shows the forecast over every head it would move.
   - **Speakers.** **[** and **]**, or the portraits, change the speaker you control.
   - **Reading the chamber.** The strip under the motion shows the vote, the committed, wavering and opposed members, the promises left and the Chamber Whip Forecast. Hold **U** to see where each rival means to walk next.
   - **Keys and lists.** **T** chooses the next member or rival, **Enter** talks to him and **E** to the nearest. **List** offers every speech, walk, conversation, motion and document as a list.
   - **Motion.** The **Motion** button holds the policy debate, the career precedents and the hearing's documents.
   - **Evidence.** The documents are also in the pack (**I**); Inspect is free. The presiding magistrate at the tribunal receives one: talk to him, or drag a document onto the tribunal.
   - **The vote.** At the deadline the members divide, walking behind the speaker whose side they took. The result offers **Record the result**, **Retry** and, once, a patron's backing.

## Gate 3

| Check | Status | Evidence |
| --- | --- | --- |
| Test F30 | **Passes.** <ul><li>The frozen 0.14.1 and 0.16 routes replay with every Contest command through the chamber. Over 200 Contest states are compared per route; every recorded state hash matches.</li><li>For each of the six Contests, at least five 0.38 logs replayed through the chamber give the same stances, Resolve and votes, hour by hour.</li><li>Eloquence, Authority, decorations and the Rhetor's courses never leave a speech worse than 0.38's.</li></ul> | `tests/curia.test.mjs` |
| Every Contest played through in full | **Passes (automated, in the page).** <ul><li>Each of the five chamber Contests is started from a legal camp save in the 2D page.</li><li>It is played to a won vote by replaying a winning 0.38 log through the Command list's own command path: walks, speeches and yields as a player gives them.</li><li>Its result is then recorded.</li><li>Chapter VII's council is also played in 3D by pointer and keys to the vote and the division.</li></ul> A person's play is the next step (below). | Browser smoke test: *chamber Contests*, *chamber* |
| A person plays the Contests in the chamber | **Not performed** | — |
| K-budget | **For the owner to assess**; not tracked here | — |

## What was done

| Deliverable | Where |
| --- | --- |
| The chamber's rules | `src/core/chamber.js`, over the 0.38 Contest engine. <ul><li>An hour is a 0.38 turn.</li><li>A walk is a 0.38 move from where the speaker began the hour, inside his reach; a second walk takes the first back, as Undo did.</li><li>A speech is a 0.38 command. The hour ends when every speaker standing has spoken, or on Yield.</li><li>Everything the page shows is read from these pure functions: conversations, forecasts, walk-beside places, the rivals' plans, the coalition, the speeches each chapter teaches, the targets in **T**'s order, the Command list's options, the hearing's documents and the motion.</li></ul> |
| The speaker profile | Stored on a Contest only when it is not neutral: <ul><li>Resolve +½ Eloquence and +¼ Authority above 10;</li><li>Practised delivery +5 Resolve;</li><li>Denounce and Rebut +⅒ Eloquence;</li><li>Invoke Record +1 with three decorations;</li><li>The long period brings Address back an hour sooner.</li></ul> Only the soldier has it; the allied speaker keeps 0.38's values. |
| The chamber world | `src/core/realtime/chamber-world.js`. The Contest's people on the stage's tiles, each carrying the Contest's bloc, stance and Resolve. It only walks people to the places the rules have put them, and walks the members behind their sides at the division. A hearing adds the presiding magistrate. |
| The chamber on the page | `src/showcase/chamber-control.js`, the real-time field's third kind. <ul><li>The reach.</li><li>Hover, click and right-click.</li><li>The conversation and the speech bar.</li><li>The rivals' hour (3–6 s, skippable) and the division.</li><li>The speakers' Resolve and the clepsydra (hours to the vote).</li><li>The coalition strip and its Whip Forecast.</li><li>**U**'s rival walks; **T**, **Enter**, **E**, the arrows and the Command list.</li><li>The Motion panel; the magistrate's tribunal and the documents' drag and drop.</li></ul> |
| The page | `src/ui/app.js`, `src/ui/chamber-view.js`, `src/ui/realtime-view.js`. <ul><li>Every walk, speech and yield is recorded through the page's save transaction.</li><li>The reference panels speak through the chamber, so their hour can end too: evidence, the policy debate, precedents and agreements.</li><li>The result offers Record, Retry and the patron's backing.</li><li>The help panel describes the chamber.</li></ul> |
| 3D and 2D | <ul><li>**3D:** figures wear the toga with their bloc's trim and lean in or fold their arms by stance. The labels lead with the bloc's letter. The speakers show Resolve, and a withdrawn speaker stands aside.</li><li>**2D:** the same chamber, with letters, stances, Resolve and the reach.</li></ul> |
| Policy debates | The Motion panel and the Command list: <ul><li>table one motion with the soldier's speech;</li><li>after the rivals' next hour, accept the amendment or defend the original, each a speech;</li><li>leaving it unanswered keeps the original.</li></ul> All by the 0.38 rules. |
| Evidence | The hearing's documents are the documented cases the soldier's earlier service, choices and witnesses have earned. <ul><li>They are in the pack (**I**).</li><li>Inspecting one shows every member's exact change, at no cost and whether or not the speech is spent.</li><li>The presiding magistrate presents one for the soldier's speech, once a hearing; so does dragging it onto the tribunal.</li></ul> |
| The Rhetor | Teaches from Chapter VII; the camp card names him. His courses are Practised delivery (+5 Resolve) and The long period (Address back an hour sooner). |

## Test results

| Group | Result | Kind |
| --- | --- | --- |
| Whole Node suite (`npm test`) | 998 tests pass (985 at the end of Phase 2) | Automated |
| **F30** | As in Gate 3 above | Automated |
| **F31** | <ul><li>A walk stays in reach, and a second walk takes the first back.</li><li>The hour ends when every standing speaker has spoken, or on yield; a withdrawn ally does not hold it open.</li><li>Persuade gains 1 with an ally within 4 m.</li><li>Address moves exactly the members within 6 m, and comes back after 3 hours.</li><li>A deadline tie rejects the motion (an injected even electorate, as in 0.38's own test).</li></ul> | Automated |
| **F32** | Inspecting a documented case is free and changes nothing. Presenting it spends the soldier's speech, once a hearing. | Automated |
| The chamber's lists and world | <ul><li>The bar, **T** and the Command list for each Contest; every option is a legal command.</li><li>The chamber world walks the rules' places, including the rivals' hour and the division, and a skip places everyone at once.</li><li>The controls model, with K3's per-chapter fallback.</li></ul> | Automated |
| Hearings, the motion and the Rhetor | <ul><li>Each Contest's documents carry each member's exact change. Presenting one changes the stances as it said, once a hearing.</li><li>The magistrate is no part of the Contest.</li><li>A motion is tabled, the rival's amendment arrives after the next hour, and it is answered: 8 supplies injected, as the command campaign's bot spends its own.</li><li>Practised delivery adds 5 Resolve in the next Contest.</li></ul> | Automated |
| Browser smoke test (production build, headless Chromium) | Three new scenarios: <ul><li>**Chamber:** Chapter VII's council in 3D by pointer and keys:<ul><li>a seat opens the conversation, and asking is free;</li><li>Walk beside him and Persuade move a member;</li><li>**Y** and **Space** play and skip the rivals' hour, and **U** names their next walks;</li><li>a click on a figure talks to him;</li><li>the vote ends in the division and its result.</li></ul></li><li>**Chamber Contests:** all five Contests played through in full and recorded, as in Gate 3.</li><li>**Chamber hearing:** Chapter X's tribunal in 2D:<ul><li>the Motion panel invokes a precedent;</li><li>the pack's documents show each member's change;</li><li>a document dragged onto the tribunal is presented.</li></ul></li></ul> All 13 scenarios pass, with no page or console errors (10 at the end of Phase 2). | Real interface, automated, software rendering |

## Measurements

| Measurement | Value | Where |
| --- | --- | --- |
| The Contests played through in the page | ch7-council 26 commands, won 9 of 13; ch8-parley 25, 10 of 13; ch10-tribunal 35, 10 of 13; ch11-accounts 28, 10 of 13; ch11-adlection 46, 11 of 13 | Browser smoke test |
| First download | 0.71 MB of the 2 MB budget (0.69 MB at the end of Phase 2) | Build report (gzip sum) |
| Chapter I download group | 9.78 MB of the 10 MB budget (9.75 MB at the end of Phase 2) | Build report. 0.22 MB of headroom is left. |
| Phone frame rate in a chamber | Not measured | — |

A chamber's world holds 13 or 14 people and nothing to fight, so its tick is a small fraction of the battles' (Phase 2 measured those).

## Deviations

### From the guide (what the player sees)

1. **Chapter XII's Contest** stays on the 0.38 board until the finale is converted in Phase 4.
2. **Distances.** The rules count the chamber's places 2 m apart, as the guide's metres do; the stage draws its places 2.5 m apart. The reach is drawn as a disc on each place the speaker may walk to, not as one circle. The rules measure reach along the floor, so a single circle would show places he cannot reach.
3. **Address the Chamber** shows its forecast over each member it moves rather than drawing a 6 m area, for the same reason.
4. **Interests asked about** are remembered for the session, not in the save; asking again is free.
5. **The presiding magistrate** stands at the tribunal in every hearing; every Contest of the command campaign is a hearing. Chambers without documented cases have no magistrate.
6. **A document can also be presented** from its Inspect dialog, the 0.38 panel's own button, besides the magistrate and the drag.
7. **The rivals' hour** plays after the rules have resolved it: their walks are the rules' moves and their replies are its captions.
8. **Pause** stops the chamber's walks and the rivals' hour. **Slow** and **Next round** are not shown in a chamber.
9. **The archive's practice replays** of Contests keep the 0.38 board with its mutators.

### From the brief (implementation)

1. **Branch:** as in Phases 0–2.
2. **The 0.38 log** still says "Turn" where the chamber says "hour" (for example "Turn 2. Vote in 7 turns."). F30 compares the rules' whole state, its log included, against the frozen 0.38 routes, so the rules' own words are unchanged.
3. **The full play-through** replays winning 0.38 logs through the page's command path (the Command list's), not a strategy of its own. The chamber's rules are the 0.38 engine's, so a 0.38 win is a chamber win; F30 checks that equivalence state by state.

## Known issues

- **Every rendering result comes from software rendering in a container.** No real desktop or phone has played a chamber.
- **Gates 0–3 still owe their playtests and phone measurements.**
- **The header over the scene** (the motion, the coalition strip and its forecast) covers the chamber's north edge, where the tribunal stands. The pointer passes through its text to the scene, and the 2D overview sits a little lower, but on a phone the header covers more. The Phase 4 polish pass is to tidy it.
- **U's message** of the rivals' plans can fill the message box for a moment.
- **The scripted Chapter VII council** in the smoke test only yields after its first speech, so it loses the vote; it checks the controls, not the play.

## Proposed next step

1. **Peter plays the Contests of Chapters VII, VIII, X and XI in the chamber.** Please note:
   - any speech whose forecast surprised you;
   - anywhere the reach, the conversation or the rivals' hour was unclear;
   - whether the hearing's documents and the magistrate read naturally.
2. **On the phone:**
   - Run `npm run build` and `HOST=0.0.0.0 npm run preview`.
   - Open a chamber; check that the header leaves the floor usable and that tapping, holding and the Yield button work.
3. **Phase 4 proceeds meanwhile,** as the owner has asked: the finale, difficulty with Iron discipline, settings with the key remapping, polish and offline packs, help generated from the guide, the 0.38 save migration, the must-keep features, and the performance pass.

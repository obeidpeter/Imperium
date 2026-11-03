# Worlds and gameplay, release 14: walking between areas

Release 14 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md) lets the soldier walk between areas. Its first part is leaving camp: every camp has a way out to its next encounter, which the soldier walks to and uses. Its [second part](#second-part-the-field-after-a-victory) is the field after a victory, searched on foot and left by the road, which records the result. This report records what changed, how it was checked and what was not checked. The [changelog](../CHANGELOG.md) describes the changes for players.

# First part: leaving camp on foot

How each kind of check was made:

- **Automated tests** (Node.js): `npm test`. New: `camp-exits`.
  - Every camp has one way out for each of its encounters, leading to that encounter and named for where it leads.
  - Each way out is on open ground, reachable from where the soldier starts, and at least 2.4 m from the camp's other objects. It is also 1.6 m from its people, 2.4 m from the soldier's starting place, and 3.2 m clear of the scenery pads' footprints.
  - The scenery draws each way out where the world has it.
  - It is used like any object, with its verb and destination in the hover line and **All actions**, and using it changes nothing in the chronicle.
  - There is none outside camp.
  - The departure rules stand behind it: a refused departure leaves the chronicle as it was.

  Changed: `chapter-v-courtyard` accepts the way out, which leads to the next encounter, not to a conversation.
- **The real interface:** the production build in headless Chromium with software rendering (SwiftShader). The checkpoints were earned by legal commands or made by New Game, and restored through the player's dialog.
  - The new browser check `campExitDeparture` sends the soldier to the way out with the world's own interact command, as **All actions** does. It checks the refusal and the departure, and reads the saved chronicle back from IndexedDB.
  - Screens of the way out were also captured in 3D in Chapter II's camp and Chapter V's courtyard, and in the 2D view.
- **Not performed:** a person playing it, and any check on a phone, a tablet, a laptop or with a screen reader.

## What changed

| Change | Where it shows | Code | State and randomness |
| --- | --- | --- | --- |
| A way out of every camp to its next encounter | The camp, 3D and 2D; **All actions** | `core/realtime/camp-world.js` (`campExitFor`), `data/camps.js` (`exits` for Chapters VI, VII, X and XII) | derived from the chronicle, never saved; the camp world is the page's |
| Leaving by it | Using it | `ui/app.js` (`leaveCamp`) | the same departure as the gate's March out (`Game.startEncounter`), refused without change |
| The sentry's refusal | The status line and the announcement | `ui/app.js` | nothing changes (tests and the browser check) |
| The card naming where you are going | Over the page while the next place is built | `ui/app.js` (`showAreaCard`), `ui/realtime.css` | presentation only |
| An object's own verb | The hover line and **All actions** | `core/realtime/intents.js` | none |
| The waymarker | 3D: regional camps and Chapter V's courtyard; 2D | `showcase/environment-waypost.js` (new), `environment-regional-world.js`, `environment-ch5-pilot.js`, `flat-stage.js` | presentation only; the scenery's own materials |
| A fight's result kept through a save | A battle ending while a save is written | `ui/app.js` (`recordFieldEnd`) | the same resolution, a moment later |

## Against the plan

| Plan item | As built |
| --- | --- |
| Leave on foot, the way out depending on what comes next: a battle, the road beyond the camp gate; Chapter I's drill, the drill post; a Contest, the principia or Curia door; Chapter V's sortie, the river gate | As planned. The drill post keeps its errand and Practice; the way out to the drill is **The drill yard** beside it. In Chapter VI the road out stands on the western road, where it leaves by the wall; in Chapter VII, on the road beside the gate, which stands at the map's edge. Chapter V's river gate is under the command shelter, toward the fortress's gate. |
| If something is still missing, nothing happens and the sentry says what | As planned: the departure check's words, as the gate sentry's line. |
| A short transition names the area you're entering | A card with the way and the encounter's title, over the page while the next place is built, for about two seconds. |
| Exits are objects in the camp and field worlds | In the camp world, derived from the chronicle and never saved, so `WORLD_VERSION` is unchanged. The field's way back to camp belongs to the second part. |
| Leaving camp: `Game.departureCheck`, then `startCampaignEncounter`, the same checkpoint as today | As planned. A save in progress asks the player to use the way out again in a moment. |
| 2D: the 2D view draws the exits | As planned: a signpost with its name. |
| Checks: exit refusals leave the state unchanged; `smoke:world` for every camp; the Gate 4 checklist gains a row | As planned (see below). The checklist has a row for leaving camp on foot. |

## Limitations

- **Software rendering only.** Every browser check ran in headless Chromium with SwiftShader.
- **Not performed:** a person playing it, and any check on a phone, a tablet, a laptop or with a screen reader.
- **The soldier starts with his back to the road out.** In most camps he begins at the gate facing into camp, so the road out is behind him and below the view at first. It shows on its own label when hovered, under **U**, and in **All actions**.
- **The 3D regional gateways stand on the camps' northern horizon,** while most camps' gates and roads out are to the south. This was true before; the waymarker shows where the way out actually is.
- **The result kept through a save** was checked by reading the code and by the existing browser checks; no check forces a battle to end during a save.

## The browser checks

All in headless Chromium with software rendering (SwiftShader), on the production build:

- **`npm run smoke`:** all 24 scenarios passed, with no page or console errors, in about 32 minutes. The new `campExitDeparture` took 168 seconds:
  - In a new chronicle's first camp, the way out is **The drill yard**. Using it brings the gate sentry's line naming the decision still to make, the page stays in camp, and the saved chronicle is unchanged.
  - In Chapter II's camp, **The road out** shows a card naming the way and **The broken causeway**, the field opens on that encounter, and the card goes. This was checked in 2D and 3D.
  - **Later, on main, CI failed it once** (after #53, on 2 November): the sentry's line did not come within the 60 seconds the check allowed.
    - Measured here, the walk is slow but sound. Software rendering slows a 3D camp's clock to a tenth of real time or so: the first camp's 17 m to the drill yard took 45 seconds (7 seconds of game time), and Chapter II's 7 m to the road out about 33 seconds. A slower runner goes over 60.
    - The check now gives each walk five minutes, as the walked field's check does, and a timeout says where the soldier stood, the clock and whether it was paused.
- **`npm run smoke:usability`:** all 13 flows passed at the phone and desktop widths, including the inventory by keyboard, mouse and touch.
- **`npm run smoke:world`:** all 21 checks passed:
  - each of the twelve camps' regional models and its three cameras;
  - the direct services and peaceful controls, and the narrow layouts;
  - scenery released between chapters and on Performance;
  - a camp that still works when every model download fails.
- **`npm run smoke:ch5-pilot -- --river-gate`:** all 9 checks passed, from checkpoints earned by legal commands. They include the courtyard's scenery, March out to the cracked tower with an exact Retry, and the departure for the red river gate.
- **`npm run verify`:** 1,587 tests passed, as did the autoplay harnesses, the production build and the asset checks.

The orders, polish, cavalry, errands, immersive and siege browser checks, the stage benchmark and the twelve-chapter benchmark were not run locally. CI runs them on the pull request.

# Second part: the field after a victory

After a won real-time battle the field stays open. The soldier searches the fallen and the found chests on foot, then leaves by the road to camp, which records the result.

How each kind of check was made:

- **Automated tests** (Node.js): `npm test`. New: `aftermath` and `aftermath-page`.
  - Only a won, unrecorded real-time battle has a field to walk, and building it changes nothing in the chronicle, its random generator included.
  - The living enemy have gone, the fallen keep what they carried, and the road stands at the soldier's start.
  - Nothing fights: drawing, abilities, the war cry and squad orders are refused, two hundred seconds pass with only the rounds, and nothing pauses.
  - The fight's works and the world's own takes are refused, and a cache never found stays hidden underfoot.
  - Searches go through the chronicle once, and the walking field follows them; a reload builds the same searched field.
  - A strongbox whose key left with a living enemy counts only for a soldier strong enough to force it. The weaker soldier is an injected change of the record's strength, labelled in the test.
  - The road records the result once; after a chapter's last battle it leads to the promotion.
  - On the page: the result's walk button and the strip, a locked chest's two ways in, the waypost among the containers in their materials, the victory's music and no fight lessons.
  - The won fields come from board fixtures restarted in real time and played to the end by the legal-command bot: Chapter I's road, III's station, VI's eagle and IX's city.
- **The real interface:** the production build in headless Chromium with software rendering (SwiftShader).
  - The new browser check `fieldAftermath` restores Chapter III's station, won from New Game by the legal-command bot (`realtime-autoplay.mjs`) and not yet recorded, through **Import save code**.
  - It walks the field, searches the archer and forces the strongbox through their windows, and takes the road twice. It reads the saved chronicle back from IndexedDB.
  - The soldier is sent to the fallen, the chest and the road with the world's own commands, as **All actions** does.
- **Not performed:** a person playing it, and any check on a phone, a tablet, a laptop or with a screen reader.

## What changed

| Change | Where it shows | Code | State and randomness |
| --- | --- | --- | --- |
| The walking field: peaceful, calm, the living enemy gone | After **Walk the field** | `core/realtime/aftermath.js` (new), `simulation.js` (`calm`), `abilities.js`, `intents.js`, `containers.js` | built from the chronicle's resolved fight each time, never saved; no randomness is drawn, and a refusal changes nothing |
| Searching through the chronicle | The inventory's window for a body or a chest | `ui/app.js` (`walkChange`, `takeLoot`, `takeFromField`), `ui/inventory-views.js` (a locked chest's window) | `Game.takeSpoils`, `openFieldContainer` and `takeFromContainer`, as from the result; `syncAftermath` copies them into the walking world |
| What is left | The road's first use | `aftermath.js` (`fieldUnsearched`), `ui/app.js` (`leaveField`) | read-only |
| The road to camp | At the soldier's start; 3D and 2D | `aftermath.js` (`aftermathExitFor`), `showcase/container-props.js` (waypost), `live-figures.js`, `flat-stage.js` (unchanged: it draws every way out) | taking it is `Game.commitEncounter`, whose duplicate check refuses a second record |
| The result's walk button and the strip | The result; above the walked field | `ui/realtime-view.js` (`aftermathStrip`), `ui/realtime.css` | presentation only |
| The victory's music; no fight lessons | While walking | `ui/soundscape-data.js`, `ui/realtime-lessons.js` | presentation only |
| Fix: the result's text in dark ink on its light panel | Every real-time battle's result | `ui/realtime.css` | presentation only |

## Against the plan

| Plan item | As built |
| --- | --- |
| After a victory the field stays open and peaceful | As planned, once **Walk the field** is chosen in the result. The result still comes first, with its record of the fight, and **Continue** records it without walking. |
| Search the fallen and the field's chests, then walk off by the road to camp; leaving records the result | As planned. Searching uses the inventory's windows, through the chronicle as the result's **Search the field** does. The road stands where the soldier entered the field. |
| You're told if a chest is left unsearched | The road's first use names the fallen and the chests still worth taking, up to four, and changes nothing; the next use leaves. A locked chest is named only while it can still be opened. |
| After a chapter's last encounter, the road leads to the promotion | As planned. Its hint says so. |
| A defeat keeps Retry. In Practice the road returns you to your chronicle | As planned: **The road back**. |
| A page-owned aftermath world built from the resolved field, like the camp world | As planned. `WORLD_VERSION` is unchanged: nothing about it is saved. |
| Its exit calls `Game.commitEncounter`, whose duplicate check makes a second trigger harmless; in Practice the exit goes to `exit-archive` | As planned. |
| 2D: the 2D view draws the exits | As planned: the 2D view draws the road as it draws a camp's way out. |
| Checks: tests for the aftermath world; a smoke run New Game → gate → field → win → search → walk off; the Gate 4 checklist gains rows | The browser check begins from a checkpoint the legal-command bot earned from New Game, restored through **Import save code**: a browser fight to a win would take minutes of software-rendered play. The gate and the field are the first part's browser check. The checklist has a row for the field after a victory. |

## Limitations

- **Software rendering only.** Every browser check ran in headless Chromium with SwiftShader.
- **Not performed:** a person playing it, and any check on a phone, a tablet, a laptop or with a screen reader.
- **The drill yard is not walked.** Chapter I's drill has nothing to search, so its result offers no walk.
- **The walking field is not saved.** A reload, or leaving the page, shows the result again; what was taken stays taken.
- **The road stands where the soldier entered the field,** usually at its edge, so it can be far away. It shows on its own label when hovered, under **U**, and in **All actions**.
- **Companions stand where the fight left them.** They follow the soldier only by their standing orders.

## The browser checks (second part)

In headless Chromium with software rendering (SwiftShader), on the production build:

- **The new `fieldAftermath`** passed in 540 seconds on the final build, run beside the unit tests, with no page or console errors.
  - **CI failed it twice, both times on the walked field standing still.** In the first run no camp card came within 120 seconds of the road's second use; in the second, three presses of P left the field paused.
  - **The cause was in the page.** A window closed while its take was still saving opened again once the save was done. That paused the field, and the window kept the keyboard, so P never reached the field. CI saves more slowly than this machine does, so only CI met it.
  - **Reproduced here** by slowing each save by 2.5 seconds. The strongbox's window, closed while **Take all** was saving, came back and the field stayed paused.
  - **Fixed:** after a save, the window shows what is left only if it is still the one open. With the same slowed save it stays closed and the field runs.
  - **The check now asserts** that a window closed during its save stays closed. It waits for the field again after each press of P, and a timeout names any open window.
  - **After the merge, CI failed it once more, a step earlier,** on the Gate 4 checklist's pull request. A click on **Walk the field** made as soon as the result showed, before the field's code had loaded, was turned away ("The field is still opening"), so the walk never began. Reproduced here by holding that code back for 3 seconds. Fixed: the click is kept, and the field starts as the walked field once its code has loaded.
  - Walks are slow under software rendering (the 20 m back from the strongbox took 83 seconds here), so each gets five minutes, and a timeout says where the soldier stood.
  - The won station's result offers **Walk the field** first.
  - Walked, the strip stands in for the result and the living raiders have gone. Drawing a weapon is refused in the field's own words.
  - The road, taken at once, names the fallen archer and the strongbox, and the saved chronicle stays as it was.
  - The archer's belongings are taken through his window and staged with the result in the saved chronicle.
  - The strongbox's key left with the living leader, so **Use the key** is disabled. **Force the lock** opens the box and **Take all** empties it.
  - The road, taken again, shows the camp's card. The saved chronicle records the station once, and the strongbox's sword is with the soldier.
- **`npm run verify`** on the final code: 1,604 tests passed, as did the autoplay harnesses, the production build, the asset manifest's digests and every download budget.
- **Screens** of the result and the walked field were captured in 3D at 1,280 and 390 pixels wide, and in 2D at 1,280. They showed two faults, fixed here:
  - the strip's **Continue →** broke within the word;
  - the result's text, since 23 October, was pale on its light panel.

  The first 3D screen of the walked field, taken with the clock paused straight after **Walk the field**, was black for 2.5 seconds. Taken again with the clock running, it was drawn within 3 seconds. Software rendering is slow, and no device was used to check this.
- **CI runs every browser check** on the pull request, `fieldAftermath` in the second smoke half.


## After Gate 4

Two of the owner-approved polish items after the play-through touch release 14's camps and fields.

### The way out is marked once the column can march

- **What you see:**
  - Once nothing keeps the column in camp, the way out is marked like a battle's objective: a ring at the waymarker and its name. Nothing keeps it there once the departure check the way out itself runs passes: the chapter's decision is made and every needed preparation is in hand.
  - The soldier often arrives with the way out behind him, out of sight. Its name then waits at the edge of the view, with an arrow showing the way it lies, in 3D and 2D.
  - A line says so when the way out becomes ready while the camp is open.
  - **Settings → Display → Objective markers** turns it off with the battle's markers.
- **How:**
  - `campWayOut` (`src/ui/camp-runtime.js`) decides from the departure check.
  - The field's runtime hands the way out to the stage's encounter (`stageEncounter`), where `missionReadouts` makes it a pinned objective.
  - `layoutStageLabels` keeps a pinned label at the nearest edge with the way it lies, instead of hiding it. The 2D view draws the same ring and edge label on its canvas.
- **Checks:**
  - `camp-way-out` (3 tests):
    - the mark comes exactly when the departure check passes, in every camp, and deciding it changes nothing;
    - it sits on the way out, by name;
    - a pinned label out of sight waits at the edge, pointing to it, while others still give up their place.
  - Of the 25 camp states, 16 are ready to march once their decision is made (its first option taken); the other nine still wait on a preparation: the oath, the legion's preparation, the crossing terms, a stratagem or the convoys.
  - Where the way out lies on arrival: in 14 of the 25 camp states the soldier starts with the road out 7.4 m behind him, as in Chapter II's camp, where the screens below show it at the lower-left edge of the view. In eight it is 10 to 38 m away, and in three within 3 m. This is the camps' geometry; only Chapter II's screens were taken.
  - Screens of Chapter II's camp (a legal-command checkpoint), taken again on the final build of this pull request, in 3D at 1,280 by 800 and 390 by 844 and in 2D at 1,280 by 800:
    - at 390 pixels wide, on arrival the name waits at the lower left with ↙, out of sight;
    - at 1,280 by 800 the road out is just in view at the lower left, its name over the ring. On the first build it was out of sight there too: the world has since grown 34.4 pixels taller, with the offline notice off its own line and the event line's room kept (both below);
    - nearer, it stands over the ring;
    - in 2D the ring is drawn at the waymarker.

### The 3D view no longer goes blank after a pause

- **Found while taking those screens:** a 3D camp went blank, with only its labels, after a walk and a pause. It happened on the build from main as well: in both runs, the first screen after the pause read 46 for brightness against 71.
- **The cause:** setting a canvas's size clears it until it is drawn again, and two things set the 3D view's size:
  - **The bar.** Pausing writes "Paused." on the bar's event line, which takes no room while it is empty. At 1,280 by 800 the bar grows while the line shows, so the world shrinks from 580.8 to 574.2 pixels tall, and grows back when the line clears: two resizes for each message. The stage's ResizeObserver makes them after the frame has been drawn, so the cleared canvas is what is shown next.
  - **The page.** The stage controller's `mount` runs on every update of the page, and it called the stage's `resize()`. That sets the size even when it is the same, and remakes the compositor's render targets.
  - Under software rendering a frame of this camp takes 2 to 3 seconds, so the view stayed blank that long. On a device it would be at most a frame, which no device has checked.
- **How it was found:** a first fix of the page's resizes alone left the blank in one of two runs. An instrumented run then logged every write to the canvas's size, every renderer resize, every attribute change on the canvas and its scene, every move of the canvas and every frame drawn after the pause. It showed the two resizes by the ResizeObserver, 2.2 and 4.9 seconds after P, and nothing else that could clear the view.
- **The fix:**
  - After a resize the stage draws the scene again at once, in the same task (`redraw()`), so a cleared canvas is never shown. It draws the scene as it stands, with no world step, motion or animation advanced. It does not draw a stage still being prepared, disposed or with its context lost.
  - The controller's `mount` calls the stage's new `fit()`, which resizes only when the canvas's size or pixel ratio changed. `resize()` itself still runs for its other callers: a quality or pixel-ratio change, construction, a restored context and the ResizeObserver.
- **Checks:**
  - Stage tests:
    - a resize draws right after the size is set, at the new shape, through the compositor when there is one, and not while the stage is being prepared, is disposed or has lost its context;
    - an unchanged canvas is neither resized nor drawn, five times running; a new height or pixel ratio is fitted.
  - A probe of Chapter II's camp in 3D (Performance, 1,280 by 800): the soldier walked part of the way out, then P pressed eight times, pause and resume, with a screen after each press, run on the build from main and then on the fixed build (before the event line kept its room, so the resizes still came):
    - from main, 7 of the 8 screens were blank, at 46 for brightness against 71;
    - fixed, none were: 70.7 to 70.9.
- **The bar's resizes themselves** are gone too: at the owner's request the event line now keeps its room (below).
- **The earlier note** about the walked field's first 3D screen (above) was most likely this.
- **Measured as well:** the walked field in Balanced, about 700,000 triangles, paints a frame every 2 to 5 seconds under software rendering, paused or running. That slowness is the renderer's, and the field keeps drawing while paused.

### The world keeps its size when a message comes or goes

At the owner's request, after reading the finding above.

- **Before:** the bar's event line, where "Paused.", a blow or a refusal is said, took no room while it was empty. Each message made the bar a line taller and the world that much shorter until it cleared, and a long message on a phone took two lines. In a fight the line fills and empties with nearly every blow.
- **Now:**
  - The line keeps one line of room, empty or not (`block-size: 1lh`), and says what it says on that line.
  - A message too long for it ends in an ellipsis. The whole of it stays in the line, which screen readers read, and in its tooltip.
- **Measured** in Chapter II's camp: the world's height with the line empty, with "Paused." and with a 74-character message, at six sizes, with **Compact interface** on and off.

  | Window | Compact interface on (the default) | Compact interface off |
  | --- | --- | --- |
  | 1,280 × 800, 1,280 × 720 and 1,440 × 900 | It shifted 6.6 px with every message. Now it is always 6.6 px shorter and never shifts. | It never shifted, and costs nothing: the bar was already taller than its lines. |
  | 580 × 800, 390 × 844 and 360 × 640 | It shifted 19.8 px, or 39.6 for a long message on a phone. Now it is always 19.8 px shorter and never shifts. | The same. |

- **A check:** `smoke:polish` pauses and reads the world's height while "Paused." shows, then again after the line has cleared, still paused. The two must be equal, the line's tooltip must be its message, and an empty line has none.

### The camp's offline and artwork notices sit on the strip

Also at the owner's request, after the measurements above found it.

- **Before:** "This chapter is ready offline", the download's progress and the artwork notice were bands under the camp's strip. The offline band came a few seconds after a camp opened, once the chapter's pack was cached, and stayed. It took 41 pixels from the world, once per chapter. (The battle and chamber pages have no such bands: these notices appear only in camp.)
- **Now:**
  - Both notices sit on the strip's one line, beside **Chronicle saved** (`worldCampBar`, `src/ui/campaign-views.js`), still as status messages. The page updates them there (`updateLoadingStatus`).
  - On a short line they give way first, ending in an ellipsis, with the whole of it in their tooltip.
- **Checks:**
  - `immersive-interface`, all twelve camps: both notices sit on the strip's line with their text as their tooltip; there is no band under the strip; with nothing to say they wait on the line, hidden.
  - `smoke:usability`, at the phone and desktop widths, an injected layout check: the two notices are hidden, then given their longest texts and shown. The world and the strip keep their heights, and the chronicle is unchanged.

## After Gate 4, second round

The owner asked for five more polish items after the first round, and main's CI after the first round's merge found a sixth fix: the chamber's held U, below. Each of the five was measured with the same probe on production builds of main and this branch: headless Chromium with software rendering, in 2D on Performance for speed. The bar and the page messages are the same in 3D; only the names are the 2D view's own.

### The game's own messages show on the full-screen pages

- **Before:**
  - A message from the page itself was put under the site header. Examples: the gate sentry's refusal at a camp's way out, "Saving… use the way out again in a moment", an errand that cannot be tracked, or what is still to search on a walked field.
  - The full-screen camp, field and chamber have had no site header since release 12. The note was made but never placed on the page, so with no window open only screen readers heard it.
- **Now:**
  - With a world open, the bar's event line says it (`toast`, `src/ui/app.js`), in the warning colour for a problem, for the 6.5 seconds the note used to stay. It is announced once, as before.
  - Where no world is open yet, the note floats over the page where the header was, so nothing under it moves.
- **Measured:** a new chronicle's first camp at 1,280 by 800, using the way out before the decision.
  - On main's build, the refusal was in no visible element, and the note was not in the document.
  - On this branch it shows on the bar's event line.
- **Checks:** `smoke`, `campExitDeparture`: at 1,280 wide the sentry's words show on the event line, whole, with no **More**.

### The 2D view's names no longer overlap

- **Before:** each name was drawn at a fixed offset over its figure or object, wherever the others fell. In Chapter II's camp on main's build, one pair of names in view overlapped at each size:
  - at 1,280 by 800, Aurelius Lucan's over Capsarius Didius's;
  - at 390 by 844, two chests' names: "The broken shields" and "The century's spare basket".
- **Now:** the 2D view gathers the names as it draws the scene and places them at the end with the 3D view's label layout: `src/showcase/flat-stage.js` now calls `layoutStageLabels`.
  - **Priority**, highest first:
    - the soldier you control, then his target;
    - a chosen squad, then his party or the speaker;
    - figures with a mark, then the way out, then other figures;
    - field objects, then other objects;
    - squads not chosen, last.
  - **Clearance:** names stay clear of one another and of the soldier you control, whose own name stands over him.
  - **Moved names:** a name keeps its first place, exactly where it was drawn before, unless that place is taken. A name moved from it keeps a faint line to it. When there is no room at all, the least important name gives way.
  - **Marks:** a lasting mark over a name keeps its room with the name, so no other name covers it. Examples: a camp figure's news, an enemy's notice, a squad's low morale. A passing number does not keep room, so names do not jump while blows land; it may cross a neighbour's name for the second it shows.
  - **The way out:** the camp's way out is one of these names. Pinned, it waits at the view's edge with its arrow while out of sight, as before.
- **Measured:** the probe recorded every text the 2D view drew in its last frame of Chapter II's camp.
  - Main's build drew 23 texts. 14 were in view at 1,280 wide and 15 at 390.
  - This branch draws 14 and 15, the same numbers, all in view, and none overlap. So in this camp no name in view had to give way.
- **Checks:**
  - A new unit test covers all twelve camps at 1,280 by 640 and 390 by 560:
    - no two names overlap, and all are inside the view;
    - the soldier is named, and no other name is over him;
    - the same frame places the same, and the world is unchanged;
    - a mark makes its name's place taller and is drawn inside it.
  - The unit test catches overlaps: with the layout's overlap check removed, it fails at Chapter I at 1,280 wide, on the practice post's name.
  - `container-props`: its stand-in canvas now measures text, as the suite's others do. Its view is a little larger than the camp, so names have room.
  - `smoke`, `campExitDeparture`: in Chapter II's 2D camp, at least five names are placed and none overlap.

### One wording for the offline notice

- **Before:**
  - The camp's strip and the site header said "This chapter is ready offline" or "All chapters available offline" when they were drawn.
  - The page's own update then replaced that with "✓ CHAPTER II AVAILABLE OFFLINE" or "✓ ALL CHAPTERS AVAILABLE OFFLINE". While a download was under way, the update showed only its progress.
  - On main's build, Chapter II's camp showed "✓ CHAPTER II AVAILABLE OFFLINE".
- **Now:**
  - One function writes the notice wherever it shows (`offlineNotice`, `src/ui/view-helpers.js`): "✓ This chapter is ready offline" or "✓ All chapters available offline", then any download under way.
  - On this branch the camp shows "✓ This chapter is ready offline" at both sizes.
- **Checks:** `immersive-interface`, all twelve camps.

### A message cut short can be read whole

- **Before:** since the first round, the event line keeps one line. A longer message ended in an ellipsis and was whole only in its tooltip, which touch screens do not show, and to screen readers.
- **Now:**
  - **More** appears at the line's end when its message is cut. More, or a tap on the line, opens the whole message over the world.
  - The message stays open until it is closed, with More again or a tap on it, or until another message comes. Once closed, it clears 1.5 seconds later at the earliest.
  - More says whether the message is open (`aria-expanded`), and keeps the focus.
- **Measured:** a new chronicle's first camp.
  - At 390 by 844 the sentry's refusal is cut and More shows. More opens the message whole, the message is still open after 4 seconds, and More closes it.
  - At 1,280 by 800 the refusal is whole on its line, with no More.
  - The world's height does not change.
- **Checks:** `smoke`, `campExitDeparture`: at 390 wide More appears and opens the whole of the sentry's words. It says it is expanded, and a second press closes it.

### Choosing a target by keyboard no longer shifts the world

- **Before:** **T** showed the target's summary, its cue and **Target details** as lines added to the bar. The world shrank while a target was chosen, and again when the details opened. Measured on main's build, on Chapter I's road:

  | Window | With a target | With the details open |
  | --- | --- | --- |
  | 580 × 700 | 66.4 px shorter | 129.7 px shorter |
  | 390 × 844 | 104.8 px shorter | 192.8 px shorter |
  | 1,280 × 800 | 68.0 px shorter | 131.4 px shorter |

- **Now:**
  - The target's summary takes the message line's place. The message line stays beneath it, invisible, so the row keeps its height.
  - Where the bar has room, the cue sits beside the summary, cut short with its whole text in its tooltip.
  - **Target details** at the end of the line opens the whole forecast over the world, led by the cue.
  - On a narrow bar (760 pixels or less):
    - the summary has the line to itself;
    - it takes up to two lines where the message line has two;
    - the cue is read in the details.
  - The text sizes match the message line's own at each width, so the row's height does not change.
- **Measured:** on this branch, at all three sizes, the world's height is the same before **T**, with a target and with the details open: 404.4, 507.3 and 576.6 px.
- **Checks:** `smoke:polish`, on the road at 580 wide: the world's height is the same before and after **T**.

### Holding U in the chamber keeps the rivals' plans

- **Found by main's CI after the first round's merge (#58):** browser smoke b failed in `chamberCouncil`, at "U names where each rival means to walk next". The check holds U and waits 10 seconds for the rivals' plans on the message line. It had passed on #58's own CI, and it passed locally.
- **The cause:**
  - Every update of the page syncs the open chamber, which resets the chamber's display.
  - Its next update then refreshed the readout of the pointer, or of the member chosen by keyboard, over the line U had just written.
  - A save finishing after the hour turns is such an update. On a slow runner it can land while U is held, so the plans were gone before the check read the line. A player holding U could lose them the same way.
- **The fix:** while U is held, those readouts leave the line alone (`src/showcase/chamber-control.js`).
  - If the hour turns during the hold, the line says the new hour's plans.
  - When U is let go, the line again says what the pointer or the chosen member shows.
- **Checks:**
  - A new unit test (`curia-readability`), an injected sequence: with the pointer over a member, U's plans survive a sync of the page and a refresh of the pointer's readout. Let go, the pointer's readout returns, and later updates refresh it.
  - On main's code the test fails at "a page update does not replace the plans while U is held"; on this branch it passes.
  - `chamberCouncil` passed locally on this branch, in 143 seconds. The race itself was not reproduced in the browser.

### The browser checks (second round)

Run locally, one at a time, on the production build of this branch, in headless Chromium with software rendering:

- `smoke`: `campExitDeparture` (152 seconds), `chamberCouncil` (143), `realtimeFlat`, `viewSwitch`, `chamberViewFallback`, `chamberContests` and `chamberHearing` passed, with no page or console errors.
- `smoke:polish`: all 22 checks passed, including the new one for keyboard targeting.
- `smoke:usability`: all 15 flows passed, at the phone and desktop widths.
- The rest of the browser checks ran only in CI.

### Not checked

- No device was used.
- Screen readers were not tested beyond the text of the announcement and of the line.

## After Gate 4, third round

The owner approved five more polish items. The first, bringing the README and the Gate 4 checklist up to date, the owner is doing. Main's CI after the second round failed `chamberCouncil` again, at the same step, which led to the first item below. Before-and-after probes ran on production builds of main and of this branch, in headless Chromium with software rendering, in 2D on Performance.

### The keys work wherever you click outside a control

- **Found while looking again at main's `chamberCouncil` failure.** The page's `main` has `tabindex="-1"`, so a click on any part of the page that is not a control puts the focus on `main`: the strip's text, the bar's text, a portrait. The field took its keys only from the world or from controls inside it (`fieldShortcutAllowed`, `src/ui/realtime-shortcuts.js`). From `main`, or from the body once a focused control was gone, every key went unheard.
- **Measured on main's build:** in Chapter II's camp, P paused with the world focused. After a click on the strip's text ("Chapter II · Miles · Next: …") the focus was on `main`, P did nothing, and holding U showed no labels.
- **Now:** a key pressed with the focus on the page around the world (its `main`, its body, anything that holds the world) is the world's, as from the world itself. Tab still moves the focus. Dialogs, text fields and the page's own panel keys keep theirs.
- **Measured on this branch:** after the same click, with the focus on `main`, P paused and holding U showed the labels.
- **The CI failure:** the step holds U and waits for the rivals' plans on the message line. Locally it passed every time: three instrumented runs and a run of smoke b's first five scenarios in CI's order. In those runs the focus never left the world, and the plans showed 1–2 ms after the key. Focus left on the page is one way the key could go unheard, and the only one found. The check now says what it saw if it fails again: the line, where the focus is, any open dialog, and whether U reached the field at all.
- **Checks:**
  - `realtime-playtest-controls`: from the page, P, U, the arrows, Space and Enter are the world's; Tab, an open dialog and a modifier are not.
  - `smoke`, `campExitDeparture`: after a click on the strip's text, which takes the focus from the world, P still pauses the camp and again resumes it.

### Esc closes what is open on the bar first

- **Before (main's build):** on Chapter I's road at 580 wide, with a target chosen by **T** and **Target details** open, Esc cleared the target and left the details open.
- **Now:** Esc closes a message opened whole with **More**, then **Target details**, before the chamber's conversation, a chosen speech or ability, the target, the list or the Menu.
- **Measured on this branch:** on the road, Esc closed the details and kept the target. In a new chronicle's first camp at 390 wide, Esc closed the sentry's words opened with More, set More back to not expanded, and left the Menu shut.
- **Checks:** `smoke:polish`: with Target details open, Esc closes them, keeps the target and leaves the Menu shut. A message opened with More holds only while it is open, so the camp's More check cannot reopen it reliably; the probe above covers More with Esc.

### U lets go when you switch away

- **Before (main's build):** U held, then the window losing the focus (an injected `blur` on the window, standing in for another window or tab): the labels stayed on, because U's release never reached the page.
- **Now:** the window losing the focus lets U go. Its labels, a battle's intentions and the chamber's plans go, as on U's release, and held arrows and the horizon glance stop as before.
- **Measured on this branch:** with the same injected blur, the labels went.

### "Chronicle restored" moves onto the bar

- **Before (main's build):** after a restore, "Chronicle restored. Chapter access was checked from earned milestones." floated over the open camp for up to 6.5 seconds, and it caught the clicks under it. The bar's event line was empty.
- **Now:** a message given while a full-screen page's world is still opening floats over the page as before. Once the world opens, it finishes its time on the bar's event line (`handOverNote`, `src/ui/app.js`). A floating message never catches a click.
- **Measured on this branch:** the camp opened with the message on the bar's event line, and nothing floating.

### The 2D view's passing numbers cross no name

- **Before:** a blow's number, "Blocked", "Miss" or a heal was drawn over its figure wherever the names fell. So was a mark over a figure with no name, such as an enemy's notice, and either could cover a neighbour's name.
- **Now:** they are placed with the names and after them, at the lowest priority. Each keeps its first place unless that place is taken, crosses no name and moves none. A lasting mark over a name still keeps its room in the name's place.
- **Checks:** `stage-label-layout`: with a number over every figure in Chapter II's camp, each is drawn clear of every name and every other number, and no name moves.

### The twelve camps' halves rebalanced

- **Before:** in the second round's CI, half b (Chapters VII–XII) took 27.5 minutes and half a (I–VII) 17. Half b's later camps are the slower, at about 2.6 minutes each against 1.6, and it also ran Chapter VIII's and Chapter XII's service and narrow-layout checks, about 4 minutes each.
- **Now:** half a is Chapters I–VIII and half b VIII–XII, with Chapter VIII in both. Chapter VIII's service and narrow-layout checks run once, in half a; Chapter XII's, Performance and the return stay in half b, and the failed downloads stay in half a with Chapter I. The estimate was about 24 and 22 minutes.
- **Measured:** half a took 35 minutes and half b 23.7 on this pull request's CI run, and 32.75 and 20 on main's run after the merge. The estimate was wrong, and the split went back (below).

### The browser checks (third round)

Run locally, one at a time, on the production build of this branch, in headless Chromium with software rendering:

- `smoke`: `campExitDeparture` (161 seconds), `chamberCouncil`, `realtimeFlat`, `viewSwitch`, `chamberViewFallback`, `chamberContests` and `settingsAndHelp` passed, with no page or console errors.
- `smoke:polish`: all 23 checks passed, including the new one for Esc and Target details.
- `smoke:usability`: all 15 flows passed, at the phone and desktop widths.
- The probes: before on main's build, after on this branch, as given above. The window blur is injected.
- The twelve camps' halves, and the rest of the browser checks, ran only in CI.
- Not checked: no device, and no screen reader.

## The twelve camps' split put back

The third round's split at Chapter VIII made the twelve camps' slower half slower, so the halves are split at Chapter VII again, as #57 first set them.

- **The measured times,** in minutes, for the camps' step of each half:

  | Run | Split at | Half a | Half b |
  | --- | --- | ---: | ---: |
  | #57's pull request | VII | 28 | 27 |
  | #59's pull request | VII | 17 | 27.5 |
  | Main after #59 | VII | 22 | 27.3 |
  | #60's pull request | VIII | 35 | 23.7 |
  | Main after #60 | VIII | 32.75 | 20 |

- **Why the split at VIII was slower:** the third round assumed half b's later camps were slower, from #59's run, in which half a's camps took about 1.6 minutes each and half b's about 2.6. In main's run after #60, the two halves' camps took about the same time each: 2.2 to 2.9 minutes in half a and 2.5 to 2.6 in half b. The difference had come from a fast runner for half a, not from the camps.
- **The steps in main's run after #60:**

  | Step | Minutes |
  | --- | ---: |
  | Earning the checkpoints and the first camp | 1.5 |
  | Each further camp | 2.2–2.9 |
  | Direct services and narrow layout: Chapter I | 3.2 |
  | Direct services and narrow layout: Chapter VIII | 4.1 |
  | Direct services and narrow layout: Chapter XII | 4.0 |
  | The return | 1.9–2.5 |
  | The failed downloads (half a) | 3.5 |
  | Performance (half b) | 1.2 |

  Moving Chapter VIII added a camp and its services, about 6.5 minutes, to half a.
- **Estimate for the split at VII:** from the same step times, about 26 and 27 minutes. Runners still vary from run to run: half a has taken 17 to 28 minutes with the same split. This pull request's CI run records the actual times.
- **Now:** half a is Chapters I–VII with Chapter I's services, the return and the failed downloads. Half b is VII–XII with VIII's and XII's services, Performance and the return to VII. The script names each half's service chapters (`HALVES` in `scripts/regional-world-smoke.mjs`), and every check runs as before.

## Main's CI after #61: the More check

- **The failure:** main's CI run after #61 failed browser smoke a at `campExitDeparture`. At 390 wide, the click on **More** for the gate sentry's words timed out: More was first "not stable", then "not visible". The split change in #61 did not touch this check.
- **Why:** the words, and More with them, stay 6.5 seconds. A pointer click first waits for More to keep still over two frames, and a 3D camp's frames are slow under software rendering. A probe on this machine throttled the CPU through the browser's DevTools protocol:
  - at 4×, the click landed 4.3 to 5.2 seconds after More showed;
  - at 6×, it missed the words in 2 of 3 runs, failing as in CI.
- **Now:**
  - The check focuses More in the frame it finds it showing and presses Enter, as from the keyboard.
  - If the words still go first, it uses the way out again, at most three times.
  - Opened, the words stay until closed, so a pointer click closes them, as before.
- **Measured with the same throttling:** More opened at the first try in 4 of 4 runs at 6× and 3 of 3 at 10×, and the pointer click closed it each time. Unthrottled, `campExitDeparture` passed in 145 seconds.
- **The game is unchanged:** More shows while the words do, 6.5 seconds for a page message.

## After Gate 4: a message cut short waits while you read it

The owner asked for this after the More check's failure above showed how short a message's time is.

- **Before (main's build):** a message on the bar's event line went after its time, even with the pointer resting on it or with **More** focused: 6.5 seconds for the game's own messages, 2.6 for the rest. A reader had that long to press **More**.
- **Now:** a message cut short stays while it is held:
  - a mouse or pen rests on its line or on **More** (`pointerenter` and `pointerleave`, not `:hover`, which on a phone stays set after a tap);
  - or **More** has the focus.
- **Let go:** it stays a moment more, 1.5 seconds, as after closing it whole. A finger's tap still opens it whole. A message that fits its line goes in its time, as before.
- **Measured** in the first camp at 390 wide, 3D on Performance, with the gate sentry's words:

  | Case | Main's build | This branch |
  | --- | --- | --- |
  | Pointer resting on the line | gone by 9 s | still there at 9 s; cleared 1.6 s after the pointer moved to the world |
  | **More** focused | gone by 9 s, and the focus with it | still there at 9 s; cleared 1.5 s after the world took the focus |
  | Not held | cleared 6.6 s after More showed | cleared 6.2 s after More showed |

- **Checks:** `smoke`, `campExitDeparture`. After **More** closes the words, each hold is left alone for 8 seconds, far past the 1.5 seconds the words would have without it:
  - **More** focused, with the pointer on the world;
  - the pointer on the line, with the world focused.

  Then the pointer moves away and the words go. On main's build the check fails at the first hold; on this branch it passes (150 seconds).
- **Not checked:** no device, touch screen or screen reader.


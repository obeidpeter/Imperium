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

- **The new `fieldAftermath`** passed in 311 seconds on the final build, with no page or console errors.
  - CI's first run of it failed at its last step: no camp card came within 120 seconds of the second use of the road.
  - Reproduced here, the step works but is slow. Under software rendering, the walk back from the strongbox (about 20 m, 8 seconds of game time) took 83 seconds before the result was recorded.
  - The check now waits for the world to run again after a window closes, and presses P only if it stays paused. Each walk gets five minutes, and a timeout says where the soldier stood.
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


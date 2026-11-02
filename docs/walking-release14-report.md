# Worlds and gameplay, release 14, first part: leaving camp on foot

Release 14 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md) lets the soldier walk between areas. This first part is leaving camp: every camp has a way out to its next encounter, which the soldier walks to and uses. The second part, the field after a victory (searched, then left by the road, which records the result), follows. This report records what changed, how it was checked and what was not checked. The [changelog](../CHANGELOG.md) describes the changes for players.

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

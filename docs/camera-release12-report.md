# Worlds and gameplay, release 12, second part: the fixed camera

Release 12 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md) makes the real-time world fill the window and gives it one fixed isometric camera. Its [first part](fullscreen-release12-report.md) changed the layout. This second part changes the camera: in real time it keeps the 2D view's bearing in every camp, battle and chamber, never turns, slides over the ground when dragged and springs back, glances at the horizon while **H** is held, and fades the walls between it and the soldier. This report records what changed, how it was checked and what was not checked. The [changelog](../CHANGELOG.md) describes the changes for players.

No credits were spent.

How each kind of check was made:

- **Automated tests** (Node.js): `npm test`. New or rewritten:
  - `fixed-camera` (new): the one bearing in both views; the overview, Follow and the performance check's tour keep it while the turns' board keeps its scenes' bearings; a drag moves the ground under the pointer with it, stays over the board and springs back; a log entry looks away the same way; the held glance turns toward the nearest landmark and gives the view back exactly; the 2D view slides, bounds and springs back alike; the keys, and a player's saved key for a removed turn key;
  - `stage-focus-camera`: real-time Follow keeps the bearing past a wall that the turns' Follow turns away from, measured from the actor's live position, in both views;
  - `realtime-ui`: the middle button and two fingers drag the view, and nothing turns it;
  - `immersive-interface`: no View choice in the strip of a camp, a battle or a chamber.
- **The real interface:** the production build in headless Chromium with software rendering (SwiftShader): the browser checks (see [The browser checks](#the-browser-checks)), and renders of the new camera in a camp, a battle, the council and the finale from checkpoints earned by legal commands, driven by the player's keys and mouse.
- **Not performed:** a person playing any of it, and any check on a phone, a laptop or with a screen reader. The two-finger drag was checked with synthetic pointer events in the unit tests only.

## What changed

| Change | Where it shows | Code | State and randomness |
| --- | --- | --- | --- |
| One bearing | Every real-time camp, battle and chamber, in 3D and 2D, and the arena | `camera-bearing.js` (new), `stage-camera.js` (`fixedCamera`), `flat-stage.js`, `realtime-field.js` (`followRealtimeCamera`, `attach`) | presentation only |
| No turning | Follow keeps the bearing; scenery between the camera and the soldier fades | `stage-camera.js` (`focusSelected`, `refreshFollowCamera`) | presentation only |
| Looking further | A middle-drag, two fingers, the scene's edge; a battle-log entry and the wayfinders | `stage-camera.js` (`pan`, `springBack`, `focusPoint`), `flat-stage.js`, `realtime-input.js`, `realtime-field.js` | presentation only; the soldier's orders are unchanged |
| Springing back | An order that takes the soldier somewhere, the arrows, a speaker's walk in a chamber, **F** | `realtime-field.js` (`issue`, `arrowMove`, `press`, `act`) | presentation only |
| The whole field | **Z**, the wheel, **+ / −**, a pinch | `stage-camera.js` (`home`, `zoom`) | presentation only |
| The held glance | **H** while held | `stage-camera.js` (`glance`, `glanceYaw`), `realtime-field.js` | presentation only |
| See-through | **X** | `stage.js` (the cutaway's radius and views), `realtime-field.js` | presentation only |
| Removed | The View choice; the **,** and **.** turn keys | `realtime-view.js`, `realtime.css`, `action-map.js` | a saved key for them is dropped on its own |
| The guide and the in-game help | "The 3D camera", the controls tables, the keyboard table | `docs/player-guide-0.40.md`, `src/data/guide-help.js` | none |

## Against the plan

| Plan item | As built |
| --- | --- |
| One fixed bearing shared with `flat-stage.js` | As planned, in a module without three.js (`camera-bearing.js`). The bearing is the 2D view's: from the south-east, so up on the screen is north-west on the map in both views and the arrow keys walk the same way in each. |
| "At the 2D view's angle" | The bearing, yes. The elevation is a true isometric view's, about 35°, not the 2D drawing's 30°. Renders at 30°, 35°, 43° and today's follow (50°) were compared in a camp, a battle and the council: at 30° a perspective camera looks a long way past the soldier and too little round him; 35° reads as isometric and keeps the ground round him. |
| Checked against the finale walls and the Chapter V fortress | From the south-east, Aurelian's walls (beyond the finale's east edge) and Chapter V's fortress (on its east edge) stand on the camera's side. The walls' clearance still brings the camera in to their face where its line would pass into them. The fortress, like other scenery, is cut away round the soldier. Both scenes were rendered from earned checkpoints: in follow, in the whole field, dragged, glancing and with see-through. |
| A zoom range up to the whole field | The range already reached it: from 5.5 metres out to at least 85, or the distance that fits every corner of the field. **Z** goes there at the fixed bearing and back. |
| The View select and rotation go; **F** recentres, **Z** shows the whole field, **H** is held; drag and edge pan; an **X** handler | As planned. The drag is the middle button's: the left button still moves and steers. On a touch screen it is two fingers, whose spread also zooms. **Edge scrolling** now works in the 2D view too. The view springs back when the soldier is ordered somewhere (to move, travel, attack, talk, loot or use something), when the arrows walk him, when a speaker walks a chamber's floor, or on **F**. The whole-field view stays where it was moved until **Z** or **F**: moving the soldier does not end it. |
| **H** held glances at the horizon | It turns toward the chapter's nearest landmark, as agreed with the owner, and gives the view back as it was. It ends when **H** is let go, the scene loses the keys, the page is hidden or a panel opens. The 2D view has no horizon and says so. |
| The follow camera cuts scenery away instead of turning | As planned. The cutaway already faded scenery between the camera and the soldier in the follow and horizon views; it now does so at the fixed bearing instead of the camera turning. **X** widens it 2.4 times and keeps it in the whole-field view. The Curia's walls still stand aside when the camera is beyond them. |
| The turn-based board keeps its camera | As planned: its overview, Follow, horizon and action camera are unchanged. |

Two things the plan did not name:

- **The arena** (the standalone real-time skirmish page) runs the same field, so it takes the same camera. Its own performance check still turns the view for twelve seconds while it measures.
- **A chamber's arrows** still step one place at a time on the floor's own grid, north up, as they did in the 2D view; north is now up and to the right on the screen. A step toward the screen's top would be diagonal and cost two of the three steps a speaker has in an hour.

## The camera in four places

Measured in the renders (Balanced, 1,280 × 720, the world paused):

| Place | Follow | The whole field | The held glance |
| --- | --- | --- | --- |
| Chapter V's camp | 16 m | 83 m | turned 74° from the play bearing |
| Chapter V's battle (the cracked tower) | 16 m | 158 m | turned 48° |
| Chapter VII's council | 19 m | 36 m | not rendered |
| Chapter XII's confrontation | 16 m | 130 m | turned 55° |

In each, the bearing stayed at 45° and the elevation at 35.3° through Follow, the whole field, a drag, see-through and back; a drag looked 8 to 11 metres away and **F** brought the view back.

## Limitations

- **Software rendering only.** Every browser check and render ran in headless Chromium with SwiftShader, where a frame of a Balanced scene can take seconds. A capture taken while a frame is still drawing can come out black; the checks wait for fresh frames before they capture. Nothing here measures a frame rate.
- **Not performed:** a person playing it, and any check on a phone, a laptop or with a screen reader. The two-finger drag was checked with synthetic pointer events, not on a touch screen.
- **The scenes' own bearings are gone in play.** Battles were staged to look along their approach toward their landmark, such as Chapter V's fortress. From the fixed bearing that landmark can stand behind the camera; the whole field and the held glance show it.
- **A lower camera.** At 35° the camera sees more of the walls round the soldier than the old follow view's 50°. The cutaway fades what hides him; **X** fades more.
- **The arena and the Performance check** turn the view only while they measure.
- **The turn-based board** keeps its cameras until the owner's Gate 4 decision.

## The browser checks

All in headless Chromium with software rendering (SwiftShader), on the production build:

- **`npm test`:** 1,571 tests, all passing; **`npm run autoplay`** and **`npm run build`** too.
- **`smoke:immersive`** (the layout check, in the 2D view): its 20 pages, three camps, a battle and a Contest at four sizes, with no View choice in any strip. On each, **Z** toggles the whole field and back from the view the page opens on, **F** follows, the scene keeps the keys and a paused fight's clock does not move; holding **H** says that the horizon is a 3D view. Its first run stopped on the Contest: a chamber opens on its whole floor, so its first **Z** goes to Follow; the check now starts from the view a page opens on.
- **`smoke:polish`** (2D): its 20 checks, among them the unobstructed layouts at 580 and 1,280 pixels wide with **H** held. Its first run waited for a horizon the 2D view does not have; it now hears the message instead.
- **`smoke:ch5-pilot -- --river-gate`:** its 9 checks in Balanced 3D; the courtyard's horizon is captured while **H** is held, and **Z** shows the whole field.
- **`smoke:siege`:** four battles in 3D (Chapter V's mine and wall, Chapter VIII's ferry in rain, Chapter IX's city on Balanced, its board kit at 47 shader programs): **Z** and **F** move the camera while the battle stays paused, then, with reduced motion, follow, the whole field and a held glance each frame the whole soldier.
- **`smoke:world`:** its 21 checks: in each of the twelve camps every regional model loads, and follow, a held glance and the whole field each settle and render; the services and narrow layouts of Chapters I, VIII and XII; scenery released on Performance and on the way back to Chapter I; and a camp that still works when every model download fails. In eleven of its twelve horizon captures a landmark stands near the middle of the view; in Chapter X's none stands out.
- **`smoke`:** all 22 scenarios, with no page or console errors: among them the arena (its overview, then a click on a raider), the Performance check's tour, phone touch, the 3D ↔ 2D switch, deployment, every Contest, the finale and Practice.
- **`smoke:usability`** (11 flows), **`smoke:cavalry`** (4), **`smoke:orders`** (4) and **`smoke:errands`** (2): all passed.

The last change, a chamber speaker's walk springing the view back, came after the layout, Chapter V, siege, twelve-camp and main smoke runs; the usability, cavalry, orders, errands and polish checks ran again after it. CI runs every check on the pull request's last commit.

Left to CI on the pull request: the 3D stage benchmark against its recorded ceilings (Chapters V and XII) and the twelve-chapter benchmark. Both draw the turn-based board, whose cameras this part does not change; no ceiling was raised.

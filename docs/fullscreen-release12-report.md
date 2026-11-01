# Worlds and gameplay, release 12, first part: the full-screen world

Release 12 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md) makes the real-time world fill the window and gives it one fixed isometric camera. It comes in two pull requests. This first one changes the layout: a strip on top, the world, and a bar along the bottom; what used to follow the world now opens over it; and the camp's services are used by walking to them. It also carries the owner's additions of 1 November: the 2D view switch, the oath's messages and the replacement "upgrades count" target. The camera follows in the second pull request. This report records what changed, how it was checked and what was not checked. The [changelog](../CHANGELOG.md) describes the changes for players.

No credits were spent.

How each kind of check was made:

- **Automated tests** (Node.js): `npm test`. New or rewritten:
  - `realtime-finale`: an oath sworn with no rival band within reach turns no band and says why, naming the nearest; the forecast before it agrees;
  - `field-experience`: the forecast's and the message's wording;
  - `realtime-settings`: a saved key map keeps every valid entry when another is unknown or invalid, and a player's key wins over a default;
  - `immersive-interface`: the camp's strip and its list under **Menu → Camp**;
  - `upgrades-check`: release 11's sweeps meet the replacement "upgrades count" target, and a sweep in which kit changed nothing fails it;
  - `showcase-stage`: each quality's pixel budget — a canvas within it keeps the quality's resolution, a larger one is held to its pixels — and a resize applies it. Two of this file's camera tests had failed after the budget, as their partial stage lacked a quality; they pass again.
- **The real interface:** the production build in headless Chromium with software rendering (SwiftShader): the browser checks (see [The browser checks](#the-browser-checks)).
- **Not performed:** a person playing any of it, and any check on a phone, a laptop or with a screen reader.

## What changed

| Change | Where it shows | Code | State and randomness |
| --- | --- | --- | --- |
| The world fills the window | A real-time camp, battle or Contest: the strip, the world, the bar; nothing on the page scrolls | `realtime.css` ("the full-screen world"), `app.js` (`fullWorld`, `data-world`) | presentation only |
| The bar | The portraits, the message line, the actions and nine panel buttons; on a phone one **Panels** button | `realtime-view.js` (`FIELD_PANELS`), `realtime-field.js` | presentation only |
| Overlays in the world | Help, tips and the log at the world's top-left; All actions and order review at its right edge; the result and the chamber's members in the middle | `realtime-view.js`, `chamber-view.js`, `realtime.css`, `app.js` (`togglePageOverlay`) | presentation only |
| Walking to places | The camp's list under **Menu → Camp**; talking from it takes the soldier there first | `campaign-views.js` (`worldCampBar`, `realtimeCamp`), `panels.js`, `app.js` | travel through the existing camp command |
| Pause rules | Conversations and the chronicle always pause | `app.js` (`showModal`) | none |
| Compact interface in real time | Off: a roomier strip and bar | `realtime.css` (`data-hud`) | none |
| Shift+M in the field | Opens the map | `app.js` (`openPanel`) | none |
| Custom keys | An unknown or invalid entry is dropped alone; a player's key wins over a default that shares it | `action-map.js` (`keymapFrom`) | none |
| A pixel budget | Each quality draws at most as many pixels as a 1,920 × 800 view at its own resolution | `stage.js` (`STAGE_QUALITY.pixels`), `flat-stage.js` | presentation only |
| The 2D view switch | Switching 3D ↔ 2D rebuilds the field around the same live world | `app.js` (`rebuildField`), `realtime-field.js` (`keepPaused`) | the world is kept, not copied |
| The oath's reach | Before: the Rally button's forecast; after: the unheard oath's message | `mission.js` (`oathHearing`, `oathForecast`), `simulation.js`, `field-experience.js` | a read-only forecast; no new randomness |
| The upgrades target | `scripts/upgrades-check.mjs` | `scripts/upgrades-check.mjs` | a fixed bootstrap generator |

## Against the plan

| Plan item | As built |
| --- | --- |
| The page becomes a grid: a strip on top, the world, a bar below it; nothing scrolls | As planned, for every real-time camp, battle and Contest: the page is locked to the window's height. The chronicle line (the chapter and the save status) stays above the strip. The bar sits below the world, so the strip and the bar never cover it. |
| The bar holds the portraits, the message line, the abilities and buttons for Kit, Character, Journal, Orders, Chronicle, Map, Company and Decorations | As planned, with **Help** as a ninth button. Each button shows its key, which follows a remapped key. |
| Every other screen opens over the world, in the one dialog | **Changed.** They open in place over the world instead (see [Overlays in place](#overlays-in-place)). The Menu, Settings, the panels and conversations stay in the dialog. |
| The Camp services list and the March out button leave the screen; the list stays under **Menu → Camp** and walks you there | The list and March out are under **Menu → Camp**, which takes the place of **How to play** in a camp's Menu. Talking to a person from the list takes the soldier to that person at once, as map travel does, then opens the conversation. The kit and company panels open directly, as before. |
| On a phone the panel buttons fold into one **Panels** button | As planned, when the field is narrower than 760 pixels. Its list opens over the world and closes with **Esc**. |
| Shift+M in the field; conversations and the chronicle always pause; **Compact interface** in real time | As planned. |
| `keymapFrom` drops unknown actions instead of discarding a player's keys | As planned, entry by entry: an unknown action, a reserved key or more than two keys drop only that entry. A key the player chose wins over a default that shares it; a default that loses its key shows **no key**. |
| The full-window canvas caps its pixel ratio, or scales adaptively, so Balanced keeps its frame rate; the Performance check is re-run | A pixel budget per quality (below). The Performance check ran in the browser smoke, in software rendering only; it says nothing about a device's frame rate. The owner's phone and laptop files after this release remain the test. |
| The turn-based board keeps its layout | As planned. |
| The camera | The second pull request. |

## Overlays in place

The plan put every other screen in the one dialog (`showModal`). They open in place over the world instead, drawn where the page already drew them:

- help, the learning tips and the battle log as small labels at the world's top-left corner, each opening as a panel there;
- **All actions**, order review and the chamber's conversation as panels at the world's right edge;
- a fight's result, and the chamber's members (its new **Members** button), over the middle of the world;
- the camp's list, from **Menu → Camp**, over the middle of the camp.

The player sees what the plan describes: the world behind, a screen over it, **Esc** to close it. Kept in place, these screens keep what they did before: the keyboard focus they give and return, the live updates of the log and the order review, and their pause rules (order review and All actions work while paused, and the log never pauses). Moving them into the dialog would have rebuilt each of these. The Menu, Settings, the panels (I C J Q L M R A) and conversations open in the dialog as before.

A new screen closes an open overlay: marching out, loading a chronicle and the vote's result each close the camp's list or the chamber's members.

## The pixel budget

The window-filling canvas is taller than the old one, so each quality now has a budget of pixels: as many as a 1,920 × 800 view at its own resolution.

| Quality | Resolution scale | Budget |
| --- | --- | --- |
| Performance | 1 | 1.54 megapixels |
| Balanced | 1.5 | 3.46 megapixels |
| High | 2 | 6.14 megapixels |

The canvas's resolution is the device's pixel ratio, capped by the quality's scale and by the budget for the canvas's size, then lowered further by the adaptive resolution when frames run slow. The budget matters only on screens with a high pixel ratio, where a large window would otherwise draw more than before. At 1,920 × 1,080 the battle's world is 1,920 × 849 pixels, against 1,920 × 668 on main. With a pixel ratio of 1.5 or more, Balanced would draw 3.67 megapixels there, against 2.89 on main; the budget holds it to 3.46. With a pixel ratio of 1 it changes nothing. The 2D view has its own limit of 4 megapixels.

## The world's share of the window

The layout check (`smoke:immersive`) restores checkpoints earned by legal commands through the visible save dialog and measures each page in headless Chromium, in the 2D view at Performance. The share is the world's height over the window's.

| Window | Camps (V, VIII, XII) | Battle (V) | Contest (VII) |
| --- | --- | --- | --- |
| 1,280 × 720 | 69–74% | 68% | 64% |
| 390 × 844 (phone) | 67% | 62% | 56% |
| 390 × 844 at 200% text | 53% | 55% | 35% |
| 360 × 640 (small phone) | 57% | 50% | 41% |

On main the page scrolled. Measured the same way on Chapter V's camp and battle and Chapter VII's Contest, its pages ran to 878–2,498 pixels in windows of 720–1,080, with the world at 62% of a desktop window's height and 54% of a phone's, and the bar or the camp's services below the window. Here nothing scrolls on any of the twenty pages, and the strip and the bar never cover the world. Before-and-after renders of these pages at 1,280 × 720 and on a 390-pixel phone were sent to the owner.

The first build of the layout gave the battle 59% and the chamber 51% at 1,280 × 720, and the chamber 28% on the small phone, where the strip's buttons also overlapped. The bands were then slimmed: the chronicle line keeps to one line; the mission strip keeps its objective, progress, opportunity and **Mission details** on one row where they fit; the chamber's count, projection, **Votes & delegates** and **Members** share one row (two on a phone); the bar is no taller than its people, with its actions on one row and shorter panel buttons for a mouse. With **Compact interface** on (the default), the bar's "Controlling" line and, on a phone, the clock's elapsed time give way; turned off, they return.

The check now holds the world to at least 60% of the height on a desktop, 50% on a 390-pixel phone, 38% on the small phone and 30% at 200% text: a little below the lowest measured, the Contest's, which has its vote row.

## What the checks found and what was fixed

The browser checks were rewritten for the new layout, and running them found these problems in it, each fixed before the pull request:

- **The camp list could scroll the page.** An older rule of the camp's sidebar (`align-self:start`) sized the list to its content (833 pixels at 1,280 × 720) instead of the world's area. Choosing an entry near its foot then scrolled the page's frame, lifting the strip out of the window. The list now fills the area it is given, and the frame clips its overflow, so neither a focus nor a scroll into view can move it.
- **Menu → Camp lost the keyboard.** The list took the focus, then the Menu's own closing gave it back to the world, so a keyboard player landed behind the list. The list now keeps it, and **Esc** returns it to the world.
- **Two focus races.** The Menu's close event arrives a little later than its closing (30–150 ms in the checks); its handler handed the focus to the world even when the player had already moved on. And after a page update the page gave focus back, a frame later, to the element that had it when the update was asked for, even if the player had moved it since. Both now leave alone focus the page or the player has already placed. The layout check found them on the View selector, at random between runs; three traced runs afterwards found no stray move.
- **Overlays covered the strip.** The result, the chamber's members and the camp list were placed a fixed distance from the top of the page and could cover the strip's **Pause** and **Menu**. They now open within the world's area, which the page measures as the window, the text size or the bar change it.
- **The world went blank behind a result.** An older rule shrank the scene to 15rem once a fight ended.
- **The members list could cover the vote's result.** It now closes when the vote is taken; a new screen also closes it, and the camp list.
- **A phone's hidden message lines showed.** A first version of the bar's two-line clamp overrode the lines' `hidden` attribute.
- **The chamber's strip overflowed at 360 pixels.** Its buttons overlapped there; **Members** moved to the chamber's own row.
- **Votes & delegates squeezed the chamber.** Opened, it grew in the page's flow and left the world 138 pixels on a 580-pixel window. It now drops down over the chamber, as **Mission details** does; a conversation opens above it, and it closes when the rivals' hour or the division begins, which it would otherwise cover.

## Benchmarks

Left to CI on the pull request: the 3D stage benchmark against its recorded ceilings (Chapters V and XII) and the twelve-chapter benchmark. This part changes no 3D scene. The stage benchmark draws its scenes in a page of its own, 1,280 × 720 at a pixel ratio of 1, where the pixel budget changes nothing; the twelve-chapter benchmark plays the campaign's pages, whose world is now larger. No ceiling was raised.

## Limitations

- **Software rendering only.** Every browser check ran in headless Chromium with SwiftShader. They prove the layout, the focus and the flows, not a frame rate. The owner's phone and laptop Performance-check files, taken after this release, remain the test of the larger canvas.
- **Not performed:** a person playing it, and any check on a phone, a laptop or with a screen reader.
- **Overlays in place, not in the dialog.** See [Overlays in place](#overlays-in-place).
- **The small phone's chamber** gives the world 41% of a 360 × 640 window, and 35% of a 390-pixel phone at 200% text, the tightest of the layouts measured: the chamber has its vote row, and the phone's bar its three rows.
- **Talking from the camp list moves the soldier at once**, as map travel does, rather than walking him there.
- **The camera is unchanged.** The View choice, the turning view and the Horizon view stay until the second pull request.
- **The turn-based board** keeps its layout until the owner's Gate 4 decision.

## The browser checks

All in headless Chromium with software rendering (SwiftShader), on the production build, after the fixes above:

- **`smoke:immersive`** (the layout check): 20 pages — three camps, a battle and a Contest at four sizes — with the shares above, nothing scrolling and nothing over the world; the camp list opening from **Menu → Camp** with the focus in it and closing with **Esc**; the cameras and the company stories.
- **`smoke:polish`:** its 20 checks, among them the unobstructed layouts at 580 and 1,280 pixels wide in Chapter V and the council, with the conversation open.
- **`smoke:usability`:** its 11 flows at a phone and a desktop size: the Menu and the five Settings categories with keyboard focus, 200% text and high contrast, help and its search, saves, and the field's compact bar, advanced actions, All actions, pause and resume.
- **`smoke:errands`**, **`smoke:orders`**, **`smoke:ch5-pilot -- --river-gate`** and **`smoke:cavalry`:** all passed (2, 4, 9 and 4 checks).
- **`smoke:world`:** its 21 checks: each of the twelve camps' regional models and its three cameras, the services and peaceful controls of Chapters I, VIII and XII and their narrow layouts, scenery released on Performance and on the way back to Chapter I, and a camp that still works when every model download fails. Its first run failed in Chapter I, on a timing in the check: the camp's "Weapons stay sheathed" refusal shows for 2.6 seconds, and one software-rendered frame of the camp's overview on the larger canvas outlasted it, so the check, which looked once a frame, missed it. The check now records each text the line shows. On a device a frame takes a few hundredths of a second.
- **`smoke`:** 21 of its 22 scenarios passed in one run, among them the camps' departure races, the drill, Chapter V's field and approach, phone touch, the Performance check, the arena, the 2D view, the new 3D ↔ 2D switch, deployment, every Contest, the hearing, the finale with the oath's forecast, settings and help, Practice and an old chronicle, with no page or console errors. The council failed: **Votes & delegates**, left open over the chamber, covered the rivals' band and its **Skip** button. It now closes when the rivals' hour or the division begins, and the council scenario and `smoke:polish` then passed again.

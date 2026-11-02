# Worlds and gameplay, release 13, first part: the inventory

Release 13 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md) gives Imperium an inventory in the manner of the classic isometric role-playing games, in its own Roman style. This first part is the screen itself: one full-screen inventory for the soldier's kit, and for what he finds and trades, with drag and drop, a keyboard route and a list mode for phones and large text. The second part, a picture of every piece rendered from generated models, follows once the owner has given a verdict on the pilot's eight pictures. This report records what changed, how it was checked and what was not checked. The [changelog](../CHANGELOG.md) describes the changes for players.

Credits: the pilot's eight models (160 credits, recorded in `art-source/models/item-pictures-credits.json`) were made before this part; this part spent none.

How each kind of check was made:

- **Automated tests** (Node.js): `npm test`. New:
  - `inventory-commands`: the kit commands that bring a piece into the pack (pick up, take off, buy, take from a chest) take an optional place in the pack; a chosen place must take the piece whole, and nothing falls back to another place; a badly named place is refused; a charm takes the charm place it names; a piece is worn straight from the ground; a worn piece is left straight on the ground, never one the soldier keeps. Every refusal leaves the chronicle and its random generator unchanged, and nothing changes in a fight.
  - `inventory-screen`: the screen shows every worn place, every pack piece in its shape and place, the ground and the sheet, in four camps, without changing the campaign; every kind of drop (within the pack, onto the soldier, onto a worn place, onto the ground, from a chest or a trader, onto a trader) is the right soldier command or a stated reason, and the command does what the drop showed; in a fight nothing is draggable and a drop is refused; the selection names only what is there; the cell under the pointer and the arrow keys' next piece.
  - The existing kit tests (`soldier-panels-ui`, `camp-soldier-usability`, `soldier-comparison`) pass unchanged against the new screen.
- **The real interface:** the production build in headless Chromium with software rendering (SwiftShader), from checkpoints earned by legal commands and restored through the player's dialog. `smoke:usability` now plays the inventory with the keyboard alone, with the mouse and on a 390-pixel touch screen, and reads each result back from the exported save (see [The browser checks](#the-browser-checks)). Screens were also captured at four sizes, and a battlefield cache was opened and taken from in Chapter II's rearguard; there the soldier was sent to the cache with the world's own interact command through the page's test hook, not by a click on the scene.
- **Not performed:** a person playing it, and any check on a phone, a tablet, a laptop or with a screen reader. Touch was checked in Chromium's touch emulation only; the long press that shows a piece's details was not exercised.

## What changed

| Change | Where it shows | Code | State and randomness |
| --- | --- | --- | --- |
| The full-screen inventory | **Kit** (I), and the armourer, the quartermaster, the sutler and a camp chest | `inventory-views.js` (new), `inventory.css` (new), `soldier-views.js` (`kitPanel`), `app.js` (`showSoldierPanel`) | presentation only |
| Drag and drop | The pack, the worn places, his figure, the ground, a trader, a chest, a fallen man, a field's cache | `inventory-input.js` (new), `inventory-views.js` (`dropCommand`), `app.js` | each drop is one soldier command, or one world take in a fight |
| The keyboard carry and the arrow keys | The pack | `inventory-input.js` | presentation only until Enter puts a piece down |
| Placing a piece where it is dropped | Pick up, take off, buy, take from a chest; a charm's place; wear from the ground; take off onto the ground | `core/soldier.js` | refusals change nothing (tests) |
| The fallen and a battlefield's caches | Searching in a fight | `app.js` (`showLoot`, `showFieldContainer`, `lootSide`) | the world's own `take` and `takeFrom`, as before |
| The list mode | Below 600 pixels, or at 200% text | `inventory.css` | presentation only |
| One 3D figure for the screen's life | The figure in the middle | `soldier-preview.js` (`setSoldier`), `app.js` | presentation only |
| A status line | Under the pack's heading, refusals in red | `app.js` (`toast`), `inventory-views.js` | presentation only |
| Removed | The old kit, trade and chest panels and the separate loot window | `soldier-views.js`, `app.js` | none |
| Browser checks | A dialog that never closes fails instead of waiting without a limit | `ui-smoke-navigation.mjs` (`closedBy`), five checks, `immersive-interface-smoke.mjs` | none |

## Against the plan

| Plan item | As built |
| --- | --- |
| Kit (I) opens a full-screen inventory: the soldier in the middle with his worn places around him, the pack as a real 10 × 6 grid, the ground strip below, the character sheet beside it, the hearing's documents in a Contest chapter | As planned. The fifteen worn places stand two to a row on each side of his figure, so a place's layers sit together (the arming cap beside the helmet, the tunic beside the padding, the armour beside the cloak). The selected piece shows in a strip under the figure and the pack, with what it would change beside it. |
| Drag a piece onto the soldier; the places it fits light up; pieces he can't use are dimmed, with what they need; right-click or long-press shows details and the comparison | As planned. Pieces he cannot use show what they need where their name would be. A drop that the rules would refuse is explained and sends nothing. Long press was built but checked only through emulated touch taps, not held. |
| The same screen for chests, the fallen and trade (Take all; Buy, Sell) | As planned, for camp chests, the three traders, a fallen man and a battlefield cache. Won fields keep release 11's **Search the field** list on the result page until release 14 makes the field walkable after a victory. Pay stays with the quartermaster. |
| `kitPanel` becomes the full-screen overlay; the existing preview is the paperdoll; `soldier.css` lays the pack out as a real grid | As planned, in a new `inventory-views.js` and `inventory.css`; `kitPanel` now returns the inventory. The figure is mounted once per screen and changes only when what he wears changes: before, every click rebuilt the dialog and remounted it. |
| Drag and drop maps onto `move`, `wear`, `takeOff`, `drop`, `pickUp` and `give` | Onto `move`, `wear`, `takeOff`, `drop`, `pickUp`, `buy`, `sell` and `takeFrom`. `give` stays a button: companions have no place on this screen to drop on. The commands gained an optional place in the pack, so a piece lands where it is dropped. |
| Keyboard: select, the arrows, Enter; `aria-live` announcements | As planned: the arrows move between the pack's pieces, **Move in pack** lifts one, the arrows move it with each place announced in the status line (a live region), Enter puts it down, Escape puts it back. |
| Below 600 px or at 200% text, a list mode with tabs | As planned: Worn, Pack, Ground, and the sheet or the other side. A drag never starts in it; a finger scrolls. |
| Item pictures: Tripo models rendered offline in Blender to one WebP atlas, used by `item-art.js`, today's drawn icons the fallback | Not in this part. The pilot's eight models and pictures (160 credits) wait for the owner's verdict on their style; `item-art.js` now draws a piece's own outline from its id as well as from the item, which a chest's list had drawn wrong. |
| Checks: `soldier-panels-ui`, keyboard-only and touch flows in `usability-smoke`, `asset:check`, the asset manifest, the presentation budget, downloads | The tests and flows as planned. `asset:check`, the manifest and the presentation budget belong to the pictures and follow with them. |

## Limitations

- **Software rendering only.** Every browser check ran in headless Chromium with SwiftShader. Nothing here measures a frame rate or how a drag feels.
- **Not performed:** a person playing it, and any check on a phone, a tablet, a laptop or with a screen reader. Touch was checked by Chromium's emulated taps; the long press was not exercised.
- **At 1,280 × 720 the screen scrolls a little**: about 120 pixels, to the selected piece's strip and the foot of the character sheet. At 1,920 × 1,080 nothing scrolls. A trader, a chest or a fallen man in a window narrower than 1,500 pixels puts the figure below the pack and the other side, to be scrolled to.
- **The pieces are still drawn outlines.** Until the pictures come, pieces of one kind look alike in the grid: a name shows on pieces two places wide, and every piece has its name on hover, in its details and to a screen reader.
- **Companions** take kit only by **Give** in a piece's details, not by dragging.
- **The turn-based mode** opens the same inventory from its camp; its battles' 0.38 rules still ignore kit, as before, until the owner's Gate 4 decision.

## The browser checks

All in headless Chromium with software rendering (SwiftShader), on the production build:

- **`npm run verify`:** 1,583 tests, every autoplay, the build and the asset and production audits passed.

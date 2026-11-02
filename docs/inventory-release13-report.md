# Worlds and gameplay, release 13: the inventory and its pictures

Release 13 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md) gives Imperium an inventory in the manner of the classic isometric role-playing games, in its own Roman style. This first part is the screen itself: one full-screen inventory for the soldier's kit, and for what he finds and trades, with drag and drop, a keyboard route and a list mode for phones and large text. The [second part](#second-part-the-item-pictures), below, gives every piece a picture rendered from generated models. This report records what changed, how it was checked and what was not checked. The [changelog](../CHANGELOG.md) describes the changes for players.

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
- **The screen scrolls in smaller windows.** Measured on opening Kit in Chapter V's camp: at 1,280 × 720 by 116 pixels, to the selected piece's strip and the foot of the character sheet; at 1,920 × 1,080 not at all; at 1,024 × 768, where the sheet stands below, by 618; on a 390-pixel phone, in the list mode, by 34. A trader, a chest or a fallen man in a window narrower than 1,500 pixels puts the figure below the pack and the other side, to be scrolled to.
- **The pieces are still drawn outlines.** Until the pictures come, pieces of one kind look alike in the grid: a name shows on pieces two places wide, and every piece has its name on hover, in its details and to a screen reader.
- **Companions** take kit only by **Give** in a piece's details, not by dragging.
- **The turn-based mode** opens the same inventory from its camp; its battles' 0.38 rules still ignore kit, as before, until the owner's Gate 4 decision.

## The browser checks

All in headless Chromium with software rendering (SwiftShader), on the production build:

- **`npm run verify`:** 1,583 tests, every autoplay, the build and the asset and production audits passed.
- **`smoke:usability`:** its 13 flows, two of them new. With the keyboard alone in Chapter V's camp, the arrows moved between the pack's pieces, Enter chose one, **Move in pack** carried it, Escape put it back with the inventory still open, and Enter put it down where it fitted; the save held it there. With the mouse, a piece dragged onto the soldier's figure was worn and saved, the same piece dragged out of its place lay in the cell it was dropped on, and a drop on the wrong place said why and left the save as it was. On a 390-pixel touch screen (emulated) the inventory opened from the bar's **Panels** in its list mode, and a piece tapped and worn was saved.
- **`smoke`:** all its scenarios, with no page or console errors: among them the chamber hearing, whose documents are read from the inventory, the arena, every Contest and the finale.
- **`smoke:polish`** (20 checks, among them the equipped soldier's figure, its turn and reset buttons and the battle's pause kept while Kit is open), **`smoke:immersive`** (20 pages), **`smoke:ch5-pilot -- --river-gate`** (9), **`smoke:world`** (21: every camp's models and cameras, and in Chapters I, VIII and XII the Kit and Company panels open over the world and leave the save unchanged), **`smoke:cavalry`** (4), **`smoke:orders`** (4) and **`smoke:errands`** (2): all passed.
- **Not run here:** `smoke:siege` and the two benchmarks, which draw the battles and the turn-based board that this part does not change; CI runs them on the pull request's last commit.

## Second part: the item pictures

The second part gives every piece a picture, rendered from a generated model; the [art record](art-generation.md#item-pictures--12-november-2026) has the models, the review and the credits, and [the asset pipeline](asset-pipeline.md#item-pictures--2026-11-02) how they are made.

How each kind of check was made:

- **Automated tests** (Node.js): `npm test`. New: `item-pictures`.
  - Every item has a rendered picture or keeps its drawn outline, never both.
  - Each picture lies inside the atlas at its planned shape, and none overlaps another.
  - The atlas is a WebP of its recorded size and dimensions, within the plan's 120 KB, and in every chapter's offline pack.
  - A pictured item shows its place in the atlas, a drawn one keeps its outline, and a fine piece names its finish.
  - Every picture's model was accepted at review and paid for from the pictures' credits, within the cap.
- **The real interface:** RESULTS
- **Not performed:** a person looking at them, and any check on a phone, a tablet or a laptop screen. The pictures were reviewed at their pack sizes in software-rendered screenshots only.

| Change | Where it shows | Code | State and randomness |
| --- | --- | --- | --- |
| A picture of every piece | The pack, the worn places, the ground, chests, the fallen and trade | `ui/item-art.js` (`itemPicture`), `data/item-pictures.js` (generated) | presentation only |
| A fine piece's finish | The same | `ui/inventory.css` | presentation only |
| The atlas in every chapter's pack | Offline play | `ui/art.js` (`chapterAssets`) | none |
| The pictures' tools | Contributors | `scripts/assets/item-atlas.mjs`, `build-item-atlas.py`, `render-item-pictures.py` (`--across`, `--drop-stand`) | none |

### Against the plan

| Plan item | As built |
| --- | --- |
| Every item has its own picture, rendered from a generated model in one consistent style | 35 pictures for 105 pieces: fine and named pieces share their kind's picture in their finish, and things of one sort share one (the keys, the jars, the sacks, the letters). Three quest objects keep their drawn outline. |
| Tripo models rendered offline in Blender to one WebP atlas (96 px cells, ≤120 KB) | One WebP of about 115 KB at 80 pixels a cell and quality 78. At 96 pixels the first 33 pictures already came to 124 KB at quality 72. |
| Today's drawn icons remain the fallback | For items with no picture. |
| The models themselves never ship | As planned: the raw models stay outside the repository, and only the atlas ships. |
| About 35 models, 700 credits, in a 1,000-credit cap with a 300 reserve | 39 models and 780 credits: four were rejected at review and made again, three of them from the reserve with the owner's approval. |

### Limitations

- **The gladius's guard is a slim bar** where a Roman one is a block; its blade, ribbed grip and round pommel are a gladius's.
- **The cloak shows its hood**, which a *sagum* did not have, and the brooch is a plain T-shaped pin.
- **One picture per kind.** Fine pieces differ from plain ones only by a tint, and the keys, jars, sacks and documents share a picture each.
- **No picture shows in 3D or on the figures,** whose kit stays code-built, as the plan intended.
- **Chapter XII's 2D download is near its limit.** With the atlas, which every chapter carries, it is 23,949,763 bytes of 24,000,000: about 50 KB to spare. Its 3D download has 2.8 MB, and Chapter VII's 2D download, the next closest, about 330 KB.

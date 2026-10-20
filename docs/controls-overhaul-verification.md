# IMPERIUM — Gameplay & Player-Control Overhaul Specification and Verification

## 1. Player-Control & Gameplay Audit

Before implementing changes, we audited the full campaign loop (Chapters I–XII, Camp, Field Battles, Political Contests, Promotion, Archive, and Modals) against the core interaction contract: **Select → Choose action/target → Review → Confirm**.

| Area Audited | Friction / Ambiguity Identified | Resolution Implemented |
| --- | --- | --- |
| **Action Costs & Turn Readiness** | Players had to infer whether an action spent movement, the unit's main action, an order, a javelin, or a cooldown, and whether unspent moves/orders remained before pressing `End turn`. | Added [`actionCostLabel`](../src/ui/direct-controls.js) on every action button (`1 move`, `1 action`, `1 action · 1 javelin`, `1 action · 1 order`, `1 speech`, cooldown, promise limit) and [`unusedTurnSummary`](../src/ui/direct-controls.js) on `End turn` and in `What can I do?`. |
| **Empty Targets & Unavailable Capabilities** | When a capability had `0` legal targets in reach (e.g., `Strike` with no adjacent enemy, `Throw` with enemies out of 2–3 tile range) or was omitted from the dock (already moved/acted, out of javelins, exhausted command orders, cooldown active, or autonomous ally), the UI did not explain why. | Added [`explainActionTargetGap`](../src/ui/direct-controls.js) directly in `#action-hint` when an action has no targets in reach, and [`explainUnavailableActions`](../src/ui/direct-controls.js) in `#command-named-controls` and `#command-coaching`. |
| **Formation 3-Unit Rule (Chapters V+)** | Selecting `Formation` on an allied target did not show which adjacent allies would actually join the 3-unit formation or why other nearby allies were excluded. | Added [`formationRosterPreview`](../src/ui/direct-controls.js) and rendered `.formation-roster-preview` in `#command-dock`, naming up to 3 joining allies (`Will form Shield wall (N/3): …`) and any excluded allies (`already ordered this round`, `>1 tile from anchor`, or `3-unit formation cap reached`). |
| **Political Contest Rules & Delegate Inspection** | First-time chamber players could miss that **Resolve** is speaking stamina (`0` withdraws from speaking while keeping their vote), that **votes are counted at the deadline** (an early majority does not end the debate), and which speech appeals best match each delegate's bloc and personal interest. | Updated [`coalitionPanel`](../src/ui/tactical-intel.js) and [`encounterView`](../src/ui/encounter-view.js) to state Resolve and deadline rules explicitly; added [`delegateAppealSummary`](../src/ui/direct-controls.js) to the inspector; added `Inspect` buttons (`data-cmd="inspect-delegate"`) to every delegate card in the chamber roster. |
| **Chapter X Convoy Allocation** | Adjusting the three convoy number inputs (`#river`, `#farms`, `#town`) gave no live running total or preview of meter/field/tribunal consequences before clicking `Dispatch the convoys`. | Added [`allocationDraftPreview`](../src/ui/campaign-views.js) and four one-click preset buttons (`Balanced 2·2·2`, `River focus 4·1·1`, `Farms focus 1·4·1`, `Town focus 1·1·4`) with live `input`/`change` updates showing exact `N / 6` validity, Supplies, Army/Public/Political meter deltas, road morale, store integrity, and Landholder stance effects. |
| **Keyboard & 3D Camera Parity** | Arrow-key navigation on `#battle-board` announced tiles to screen readers but did not update the visible `#board-hover` caption; 3D camera shortcuts (`F`, `Home`, `+`, `-`) were only wired in the standalone study. | Wired `boardHover(focusTile)` on arrow-key movement in [`bindBoard`](../src/ui/app.js) and added `F` (focus unit), `Home` (overview), `+`/`=` (zoom in), and `-` (zoom out) alongside `H` (horizon) in the main campaign encounter keydown handler. |

---

## 2. Complete Input & Control Specification

| Task / Action | Mouse / Pointer | Touch (Phone / Tablet) | Keyboard |
| --- | --- | --- | --- |
| **Select controllable unit** | Click figure on board or click button in `#unit-roster` | Tap figure on board or tap button in `#unit-roster` | `N` (next ready unit), `#unit-select` dropdown, or Arrow keys + `Enter`/`Space` on `#battle-board` |
| **Inspect ally, enemy, or delegate** | Click figure on board, hover tile, or click `Inspect` in chamber delegate list | Tap figure on board, tap `Inspect` in chamber delegate list, or use `#delegate-inspect` | Arrow keys + `Enter`/`Space` on `#battle-board`, `#delegate-inspect` dropdown, or `Tab` to `Inspect` button |
| **Choose action** | Click action button in `#action-bar` | Tap action button in `#action-bar` | Keys `1–9` or `#action-select` dropdown |
| **Preview target** | Click highlighted tile/unit on board or choose from `#target-select` | Tap highlighted tile/unit on board or choose from `#target-select` | Arrow keys + `Enter`/`Space` on `#battle-board` or `#target-select` dropdown |
| **Walk to ground** (since 0.31) | Click open ground; pointing at it first draws the route. Ground beyond this turn's reach walks as far toward it as allowed. With **Confirm moves** on, the click previews instead | Tap open ground (no hover, so the walk itself shows the route and `Undo Move` takes it back); with **Confirm moves** on, the tap previews | Arrow keys to the tile (the announcement gives the route summary) + `Enter`/`Space`; `U` undoes the walk until the unit acts |
| **Use a field object** (since 0.32) | Move the commander onto or beside it, then click its button (`[data-cmd="field-action"]`) in the battlefield panel below the board | The same, with taps | `Tab` to the object's button in the battlefield panel and press `Enter` |
| **Table or answer a policy motion** (since 0.32) | Click `Table motion`, then `Accept amendment` or `Defend original motion`, in the policy panel | The same, with taps | `Tab` to the button and press `Enter` |
| **Configure Order / Formation** | Choose `#order-kind`, `#order-destination`, or `#formation-kind` in `#command-dock` | Tap `#order-kind`, `#order-destination`, or `#formation-kind` in `#command-dock` | `Tab` to `#order-kind`, `#order-destination`, or `#formation-kind` and use Arrow keys |
| **Confirm previewed command** | Click `#confirm-action` (`Confirm`) or click the previewed target tile a second time | Tap `#confirm-action` (`Confirm`) or tap the previewed target tile a second time (no timing-sensitive double-tap) | `Enter` on `#confirm-action` or `Enter`/`Space` on the already-previewed `#battle-board` tile |
| **Cancel preview** | Click `Cancel` (`[data-cmd="cancel-action"]`) or right-click board | Tap `Cancel` (`[data-cmd="cancel-action"]`) | `Escape` |
| **End turn** | Click `#end-turn` | Tap `#end-turn` | `E` or `Enter` on `#end-turn` |
| **Toggle tactical grid** | Click `Grid` (`[data-cmd="toggle-grid"]`) | Tap `Grid` (`[data-cmd="toggle-grid"]`) | `G` |
| **3D camera framing & zoom** | Drag to orbit, wheel to zoom, or click `Overview`, `Follow unit`, `Horizon`, `+`, `−`, `2× motion` | 1-finger drag to orbit, 2-finger pinch to zoom, or tap camera bar buttons | `H` (Horizon), `F` (Focus active unit), `Home` (Overview), `+`/`=` (Zoom in), `-` (Zoom out) |

Since 0.31 a plain walk is the one exception to **Select → Choose action/target → Review → Confirm**: it commits on one selection and stays undoable until the unit acts. See [movement verification for 0.31](movement-verification-v031.md).

---

## 3. Verification Report

### Automated & Developer Verification Completed
- **Unit & Integration Test Suite (`node --test tests/*.test.mjs`):** All test files including [`tests/v026-controls-overhaul.test.mjs`](../tests/v026-controls-overhaul.test.mjs), [`tests/command-stage.test.mjs`](../tests/command-stage.test.mjs), [`tests/overhaul-integration.test.mjs`](../tests/overhaul-integration.test.mjs), and [`tests/campaign-upgrade-ui.test.mjs`](../tests/campaign-upgrade-ui.test.mjs) pass with `0` failures.
- **Deterministic Full-Campaign Autoplay (`node scripts/autoplay.mjs`):** Completes all 12 chapters and 25 encounters (including every battle and political Contest, required capabilities, obligations, and finale confrontation routes).
- **Viewport & Accessibility Layout Audit ([`tests/interface-metrics.js`](../tests/interface-metrics.js)):** Verified across `1440 × 900`, `1280 × 800`, `768 × 1024`, `360 × 640`, and `640 × 360` at `100%`, `125%`, `150%`, and `200%` text scaling that:
  - Every `[id]` in the DOM is unique.
  - Every visible button, input, and select has an accessible name and meets minimum touch target dimensions (`44 × 44 px` on mobile).
  - `#battle-board`, `#action-bar`, `#confirm-action`, and `#end-turn` remain inside the primary mobile viewport without horizontal document overflow.
- **Production Bundle & Asset Integrity (`node scripts/build.mjs` & `node scripts/verify-assets.mjs`):** Verified clean production build (`dist/`) and 100% asset/manifest integrity.

### Remaining for External Human Usability Testing
- Automated and headless browser checks verify deterministic rules, DOM contracts, keyboard/pointer handlers, and responsive bounding boxes, but do not replace **first-time human playtesting** on physical iOS/Android touchscreens and assistive screen readers (NVDA, VoiceOver). See [`docs/playtest-kit.md`](playtest-kit.md) for the physical-device observation checklist.

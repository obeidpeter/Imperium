# Release validation — Imperium 0.31.0

*Released as 0.32.0. This record was made for the draft, labelled 0.31.0, before it was merged with click to walk (0.31.0). Its results describe that draft. The checks after merging are under [Integration into 0.32.0](#integration-into-0320).*

Recorded 19 October 2026, based on main commit f1612a53775832a1ac9dfa3b67782c31a5a04616. Work lives on codex/imperium-v031. This record separates automated campaign play, focused injected scenarios and real browser controls.

## Automated results

- **674 tests passed, zero failures.** Tests cover existing campaign, storage and graphics behavior plus expanded rules, exact retries, pure forecasts, mutually exclusive objectives, weather, cover, fire, coordinated intentions, protected columns, policy branches, invalid saves, paired contact, frame profiling and wide-board picking. The final field-geometry presentation adjustment was followed by all 17 focused 0.31 tests, the build and offline checks.
- Baseline campaign: New Game to Augustus, 12 chapters, 25 encounters, 217 turns, public commands only.
- Expanded campaigns: all 25 encounters and 12 chapters, with exact retry verified before each encounter. Standard seed 275: 218 turns; alternate Standard route: 222; Story seed 137: 214; Veteran seed 831: 220. No wins, progression, health, positions or supplies were injected into these campaign runs.
- The autoplay strategy was refined to clear a contested early hold marker and take a legal finishing strike instead of repeatedly bracing. This changes the verification player, not the rules or victory conditions.
- Focused policy tests inject treasury and stance boundary conditions, then finish via legal commands. They cover all three motions under both sets of terms, capped stance reversals and exact reward commits. They are not six full human campaign playthroughs.
- Character audit: two existing GLBs under the declared model budgets; 768 directional/action responses (24 existing authored bitmap sequences, 744 procedural rig responses). No claim of 768 new hand-painted sequences.
- Production build revision **441ca51474bb**. Initial compressed shell: **455,286 / 2,000,000 bytes**; Chapter I: **7,721,968 / 8,000,000**; complete game: **11,200,021 / 24,000,000**. These are summed gzip sizes, not a measured browser transfer.
- Asset hashes/sizes and offline shell, cold chapter restore, missing-file retry and version isolation checks passed.

## Real-interface smoke test

In the Codex in-app browser on Windows, a fresh chronicle completed Move, Throw, Strike and Brace through normal controls, won the drill, committed the result and reloaded it. Legal autoplay checkpoints were then imported through the normal Validate and Restore dialogs, not by modifying browser state.

At Chapter V, the 10 × 8 field rendered with all six interactive objects. Sculpted, painted and 2D modes were inspected. Moving beside the cart and securing it spent the personal action, retained company orders, changed the cart to secured and closed the signal opportunity. A clipping issue found in the 2D view was corrected by reserving headroom and centring rectangular bounds; the live view was rechecked.

At Chapter X, the accounts audit displayed delegate changes and its staged supply cost. After a turn, the rival offered a counterproposal. Accepting the amendment displayed the revised terms and resolved status. Settings' frame-report button displayed measured values. No browser console errors were captured in these checks.

| Actual gameplay evidence | File |
| --- | --- |
| Sculpted officer and company | [Screenshot](../images/v031-sculpted.png) |
| New painted Roman officer | [Screenshot](../images/v031-painted.png) |
| Expanded 2D battlefield | [Screenshot](../images/v031-tactical.png) |
| Secured cart / forgone signal | [Screenshot](../images/v031-field-choice.png) |
| Accepted policy amendment | [Screenshot](../images/v031-policy.png) |

## Performance and limits

The stored Chapter X observation used **performance** quality: CPU submission p95 **11.1 ms**, display interval p95 **33.7 ms**, and 116 draw calls. A separate Chapter V observation showed reflection throttling at stride 2; automatic quality fallback also activated during this session. The live report exposes this cost rather than promising a fixed frame rate. CPU, GPU and display cadence are different measurements.

This was a short scripted browser check, not a controlled before/after performance benchmark, a full human campaign playthrough, or a physical phone/tablet/device matrix. High quality remains device-dependent. The 90–150 minute human-play target, browser accessibility audit and live-host deployment remain unverified. Source code and the static package require no runtime AI service or remote media CDN.

Reproduction: run node scripts/prepare-tests.mjs; node --test tests/*.test.mjs; node scripts/autoplay.mjs; node scripts/expanded-autoplay.mjs; node scripts/audit-character-assets.mjs; node scripts/build.mjs; node scripts/verify-assets.mjs. Expanded legal-route evidence is in [expanded-campaign-v031.json](../evidence/expanded-campaign-v031.json), the browser observation in [browser-v031.json](../evidence/browser-v031.json), and the concise result in [release-v031.json](../evidence/release-v031.json).

## Integration into 0.32.0

Recorded 20 October 2026. The draft's commit 0bf9d7f was merged onto main after click to walk (0.31.0) and renumbered 0.32.0.

- **Conflicts**: CHANGELOG, README, `panels.js`, `animation-timeline.js` and one test conflicted; both sides' content was kept. Click to walk had replaced the old animation route with the shared route in `src/core/movement.js`, which also draws the walk preview. The draft's two movement rules, closed gates and rain on high ground, now live there through the rules' own `fieldBlocked` and `fieldMoveCost`. The readout names a closed gate as "Closed gate".
- **`npm run verify` passed**:
  - 689 tests.
  - Standard campaign: New Game to Augustus, 25 encounters, 217 turns.
  - Expanded campaigns: Augustus in 218, 222, 214 and 220 turns, the same as recorded above.
  - The build, the asset and offline checks, and the character audit (768 responses: 24 authored, 744 procedural).
  - Budgets: first load 459,145 of 2,000,000 bytes, Chapter I 7,726,578 of 8,000,000, complete game 11,204,631 of 24,000,000.
- **New `tests/v032-integration.test.mjs`**:
  - It samples a legal expanded campaign (New Game, public commands only) at every encounter start and every expanded turn. That gives 3,241 legal moves across all 25 encounters, including 22 routes past a closed gate and 9 over high ground in the rain. Each route costs exactly what the rules charge and never crosses a closed gate.
  - The animation and the 2D line follow that same route in the rain.
  - A closed gate is not a destination until the legal field action opens it. This test places the commander beside the gate, an injected position like those in the focused tests above.
  - The same check against the route code from before this integration found 9 legal moves whose drawn route did not match the rules.
- **Real interface** (scripted headless Chromium, software rendering, 1280 × 900): a legal Chapter V expanded checkpoint (New Game, seed 275, public commands only) was restored through the game's own Restore dialog.
  - In 2D, the board cursor read "9D. Rock. Impassable ground", "9C. Open ground. Closed gate" and "10C. High ground. No route from here". The side corridor is sealed while the gate is closed and the bridge damaged.
  - Clicking the gate announced "Open ground. Closed gate."
  - Clicking far ground walked to 2C, and Undo returned the commander.
  - In 3D, the cursor and Enter walked toward far ground, with the route drawn beside the field's labels.
  - The Chapter I drill check from 0.31 was repeated on the merged code, now with the expanded games' 2D board layout, and gave the same results.
  - The only console error was the development server's 404 for the service-worker script.
- **Not repeated after merging**: the draft's own browser checks above (the Chapter V objectives and the Chapter X policy amendment), and walking through an opened gate in the browser (the unit test covers it). Real devices, Safari, Firefox, screen readers and human play remain unchecked.

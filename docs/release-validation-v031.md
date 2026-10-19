# Release validation — Imperium 0.31.0

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
| Sculpted officer and company | [Screenshot](images/v031-sculpted.png) |
| New painted Roman officer | [Screenshot](images/v031-painted.png) |
| Expanded 2D battlefield | [Screenshot](images/v031-tactical.png) |
| Secured cart / forgone signal | [Screenshot](images/v031-field-choice.png) |
| Accepted policy amendment | [Screenshot](images/v031-policy.png) |

## Performance and limits

The stored Chapter X observation used **performance** quality: CPU submission p95 **11.1 ms**, display interval p95 **33.7 ms**, and 116 draw calls. A separate Chapter V observation showed reflection throttling at stride 2; automatic quality fallback also activated during this session. The live report exposes this cost rather than promising a fixed frame rate. CPU, GPU and display cadence are different measurements.

This was a short scripted browser check, not a controlled before/after performance benchmark, a full human campaign playthrough, or a physical phone/tablet/device matrix. High quality remains device-dependent. The 90–150 minute human-play target, browser accessibility audit and live-host deployment remain unverified. Source code and the static package require no runtime AI service or remote media CDN.

Reproduction: run node scripts/prepare-tests.mjs; node --test tests/*.test.mjs; node scripts/autoplay.mjs; node scripts/expanded-autoplay.mjs; node scripts/audit-character-assets.mjs; node scripts/build.mjs; node scripts/verify-assets.mjs. Expanded legal-route evidence is in [expanded-campaign-v031.json](evidence/expanded-campaign-v031.json), the browser observation in [browser-v031.json](evidence/browser-v031.json), and the concise result in [release-v031.json](evidence/release-v031.json).

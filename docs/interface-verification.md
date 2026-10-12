# Interface verification — v0.5

The website and game interface redesign is implemented in the existing application. This report records verification on 12 October 2026 for final production revision **c246f03a6e79**. It separates actual browser interaction, automated regression checks, and isolated component previews.

The self-contained [browser evidence summary](evidence/interface-browser.json) includes final measurements, manual-check scope, all 11 component cases and SHA-256 hashes of the full raw reports. Those raw reports and screenshots remain in the separate review deliverable.

## Actual application checks

Manual checks used the Codex in-app Chromium browser on Windows, with the reported Chrome 154 user agent. Phone-sized layouts were desktop-browser viewports, not physical phones. The browser review covered a 360 × 640 opening, 640 × 360 tactical landscape, ordinary desktop, and a 1600-pixel desktop layout. Saved screenshot pixel dimensions can differ from the requested viewport because the browser surface and scrollbars occupy space.

| Area | Interaction and observed result |
| --- | --- |
| First visit | Play was visible within the first 640-pixel phone viewport at normal text size. Play → name form → Begin reached camp and Chapter I through the real controls. |
| Returning player | Continue was the dominant title action. Home → Continue preserved the unfinished encounter's turn and spent action. |
| Menu and dialogs | The menu exposed working destinations. On the final preview, Menu initially focused its heading; Escape closed it and returned focus to Menu. Escape also restored the Accessibility settings invoker after a rerender. At the Tab boundary, focus visited browser/body before returning to the dialog; perfect focus wrapping was not established. These were real application interactions, not lab controls. |
| Campaign | Current and locked chapters were visible with service requirements. The route-map disclosure opened. No chapter jump was introduced. |
| Settings | In-game 200% text and reduced motion were changed through Settings. The final phone settings dialog measured 313 pixels wide in the 360-pixel viewport; page content/scroll width both measured 345 pixels. Content reflowed with vertical scrolling. This is text enlargement, not a verified 200% browser-zoom result. |
| Save handling | An invalid code produced a truthful validation error. A legally earned v0.4 Chapter XI save was imported through validation and explicit confirmation. |
| Political play | In the Senate encounter, Persuade showed its preview and confirmation spent the speaker's action. The board and essential tactical controls were visible together at 640 × 360. |
| Records | Character and equipment, a journal with 22 completed encounters, and an obligations ledger with two open/two due obligations were inspected. These values belong to the imported checkpoint. |
| Website and reference | Below-the-fold gameplay/world imagery loaded. Credits, privacy and their cross-links were opened. Gameplay crops are captioned separately from illustrative art. |
| Waiting update | The final production preview on port 4193 displayed the downloaded-edition notice, instructing closure/reopening after saving. Closing/reopening the test tab on that origin removed the notice and displayed Play. No user save existed there, so this does not establish update migration of an active save or installed-PWA behavior. |

The final desktop landing was recaptured at 1280 × 720. The final preview's observed browser logs contained no errors or warnings; this is limited to that inspected session.

The separate `interface-review` gallery contains before/after landing, camp, campaign and returning-player captures, plus current settings, invalid-save, records, landscape and Contest captures. Screenshots establish only what they show; they do not prove every control or every campaign state was exercised.

## Regression and package checks

[The machine-readable regression record](evidence/interface-regression.json) reports **190/190 Node tests passed** at revision **a93ffede353d**, with none failed, skipped or cancelled. Afterward, one production CSS rule corrected the enlarged-text dialog's maximum width, and the development-only stress name was bounded to the existing 40-character limit. No production JavaScript, rules or storage changed. The full suite was not repeated for these changes; the final build and nine asset/offline checks were rerun. The legal deterministic New Game route completed all twelve chapters and all **25 encounters in 204 turns**, ending as Augustus. It is a rules regression route, not a human playtime or enjoyment measurement.

Nine asset/offline checks passed on final revision **c246f03a6e79**: manifest integrity, portrait/title and package budgets, initial/chapter caching, truthful partial readiness, version-scoped lookup, deferred-fetch failure, retry completion, server-unavailable cached navigation and activation cleanup. These are automated checks; they do not establish an installed-device update experience for this release.

Hashes of all **23 protected files** match frozen v0.4: core rules, authored data, storage and the listed graphics/rendering/motion/loading modules. New direct-module tests cover presentation purity, earned chapter locks, authored choice IDs, labelled forms, escaped names, explicit import/recovery confirmation, saving-status precedence, landing anchors, and optional-image cancellation/Save-Data policy.

The final production build is **c246f03a6e79**, version **0.5.0**. These figures sum gzip-compressed files, including the service worker; they are not browser transfer totals.

| Budget scope | Recorded gzip bytes | Existing limit |
| --- | ---: | ---: |
| Initial title/offline shell | 310,062 | 2,000,000 |
| Initial plus Chapter I content | 1,278,153 | 2,000,000 |
| Complete production content | 1,982,904 | 2,000,000 |

No cap was raised. Existing art was reused; two local gameplay crops add 9,830 raw bytes. Palette optimization of the three original app icons saves 22,711 raw bytes. No character, scene or tactical atlas was recompressed for this interface work. Details and provenance are in [interface-assets.md](interface-assets.md) and the integrated manifest.

## Observed cold-entry samples

The separate `interface-review/load-baseline.json` and `load-current.json` records come from fresh local origins on ports **4311** and **4314**. The current trace uses final revision **c246f03a6e79**. Both origins had no prior saves, databases, caches or service workers. The actual game ran inside a **360 × 640 frame**; its content width was 345 pixels with a scrollbar. The human operator used Play, Begin, a chapter decision and Enter. The development server recorded all game responses, including worker fetches, while excluding its own measurement files/endpoints. It used gzip and `no-store`, without network throttling.

| Observation | Frozen v0.4 | Current recorded sample |
| --- | ---: | ---: |
| Landing controls observed | 313.4 ms | 356.3 ms |
| Begin click → camp observed | 48.1 ms | 31.6 ms |
| Enter click → board observed | 63.9 ms | 59.8 ms |
| Enter click → quiet artwork-status endpoint | 620.9 ms | 638.1 ms |
| Entire observed journey, including human dwell | 17,146.6 ms | 9,905.2 ms |
| Actual gzip response-body bytes through capture | 1,783,550 | 1,780,316 |
| Game responses, including repeated requests | 99 | 103 |
| Failed requests | 0 | 0 |

This is **one unthrottled local sample per edition**. It supports no speed-improvement conclusion or production latency guarantee. Reading and clicking delay explain part of the total journey difference. Server totals include actual repeated/background responses and exclude HTTP/TLS overhead; they differ from unique-file build sums. Browser Resource Timing is retained separately because it may omit worker fetches and includes cache-served entries.

The artwork endpoint means the board existed and its progress region remained quiet for 500 ms. Neither sample observed that indicator in an active loading state, so this is not proof of a completed loading cycle, GPU work, or full offline readiness. Both final DOM reports found no horizontal overflow, duplicate IDs, unnamed visible controls, broken fragment links or sub-44-pixel controls in the captured tactical state; no image failures were reported. That narrow DOM check is not an accessibility certification.

## Component lab and remaining limits

`tests/interface-lab.html` renders the real presentation modules and styles using New Game or validated legally earned fixtures. It deliberately has **inert action buttons**, no application router and no storage operations. Optional long names and platform-error notices are synthetic layout fixtures. They must not be described as a reproduced storage failure or a successful application journey.

The saved `interface-review/lab-stress-phone-200.json` contains **11 actual browser-rendered component cases at 360 × 640 and 200% in-game text**: landing, camp, map, character, journal, ledger, settings, restore, takeover, storage-unavailable and ending. The base checkpoints were legally earned; the stress name was bounded to the application's 40-character limit and notices were synthetic. All 11 reports show content width and scroll width of 345 pixels, unchanged serialized campaign state after rendering, and no failed images, duplicate IDs or unnamed visible controls. Settings, storage-failure and ending screenshots accompany the data; a normal-text desktop ending was also inspected.

This is a layout/reflow result, not a blanket touch-target pass. Native checkbox inputs were reported below 44 pixels; they sit within larger associated labels, whose full hit areas were not measured by that report. Long 200% panels require vertical scrolling, and not every primary button appears in the initial viewport. The ending's existing cinematic composition remained present in the inspected lab view; this is not a new end-to-end accession playthrough.

Physical touch and devices, iOS/Android installed-app behavior, screen-reader operation and genuine 200% browser zoom remain unverified in this interface pass. The attempted browser zoom shortcut did not change the in-app browser viewport and is not counted as a pass. No formal contrast audit, exhaustive keyboard/action matrix, production-host test, slow-network/device benchmark, new full-campaign manual playthrough, or installed offline-update test is claimed. Prior release evidence remains separately scoped in its original reports.

The shared components and constraints are documented in [interface-design-system.md](interface-design-system.md). The measurement procedure and source audit are in [interface-audit.md](interface-audit.md).

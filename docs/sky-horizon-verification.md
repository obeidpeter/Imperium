# Sky and horizon — version 0.13

Production **757b8ea235d2**, version **0.13.0**, checked 12 October 2026. This record separates final automated checks from an earlier browser sweep and representative visual observations. The [portable evidence summary](evidence/sky-horizon-verification.json) includes hashes of local evidence files. The completed [version 0.12 record](campaign-3d-refinement-verification.md) remains historical evidence.

## Scope

An original procedural sky and regional distant landscape extend the shared 3D scene beyond the playable terrain. Campaign and standalone controls expose **Horizon / H**, with **Overview / Home** restoring tactical framing and **Follow unit** retaining close inspection. Startup remains Overview. Camera commands spend no turn; the named controls, 2D alternative and rules state remain authoritative. No additional raster artwork or external art service is used.

H ignores editable controls, open modals, modified/repeated keys and events already handled by the focused scene. Horizon also remains available after an encounter result.

## Final automated checks and build

- **375/375 Node tests passed**, zero failures, skips or cancellations, in **85,960.8624 ms**. This includes explicit Horizon/startup behavior, camera and rendering purity, controller disposal and existing gameplay/UI regression coverage.
- Legal-command autoplay from New Game completed **25 victories across 12 chapters in 213 turns**, ending at Augustus. This automated route is separate from the camera-focused browser observations below.
- **11/11 asset and offline-protocol checks passed**, including manifest integrity, declared budgets, chapter groups, cold later-chapter resource retry and version-scoped cache behavior. These are automated protocol checks, not a new real-browser offline trial.
- The production inventory contains **138 runtime files**, with **64 initial and 74 deferred**. Three-dimensional resources remain deferred from the initial shell and shared across chapter cache groups.

| Group | Gzip estimate, bytes | Declared cap, bytes |
| --- | ---: | ---: |
| Initial shell | 360,740 | 2,000,000 |
| Shell plus Chapter I | 5,430,250 | 8,000,000 |
| Complete opt-in package | 6,582,755 | 24,000,000 |

These are the builder's sum of individually compressed files, including the worker in each group; they are not an observed browser transfer or frame-rate measurement.

## Recorded browser checks

The desktop browser harness completed **25/25 legally reached scenes and 468 assertions**. It checked tactical Overview and post-cancellation label placement, rule/model correspondence, state equality, reduced motion and disposal. **That report preceded the final camera and water corrections.** It is not presented as a rerun of all 25 scenes against the final module graph.

The same report contains **five Horizon records**: Balanced Palmyra and wetland, two Performance/reduced-motion wetland records, and a High-quality Senate landscape view. All recorded exact save equality and a far plane of 800. The two reduced-motion records retain an identical cloud clock. The narrow **360 × 420** and landscape **844 × 300** dimensions are harness scene containers within a **1280 × 720** desktop browser viewport, not physical-phone or complete-app viewport tests.

After refreshing the final module graph, the wetland scene passed another **18 assertions** and was inspected in Horizon view. A Balanced station scene at a **360 px canvas width** showed clear sky and terrain without captured errors. `post-fix-browser.json` records these targeted checks and two unchanged-save Horizon samples. This final check did not repeat the entire 25-scene sweep.

The dedicated Horizon diagnostic records camera orientation, target, distance, scene dimensions, sky/landscape metadata and save equality. **Record sky / landscape** preserves the current camera for other yaw/settings samples. Its skyward projections test the camera frustum, not actual visible pixels or obstruction by scenery; screenshots were inspected separately.

Manual browser inspection covered the corrected wetland cloud streaks, Palmyrene roofline and Senate chamber. In the standalone skirmish, a reverse yaw of approximately **3.12 radians** retained visible sky; Home and H worked, and a legal Move from **1D to 2D** committed on turn 1. These are representative observations, not a new all-scene sweep or full campaign playthrough.

The production campaign on local port 4381 accepted a portable save exported through the normal UI from port 4375: Chapter IX, turn 1, with all six orders. Horizon, H, Overview, Follow and switching between 2D and 3D were exercised through the normal interface. The exported save-code string remained **exactly equal** before and after the camera/view controls. The source origin's original save was not overwritten.

At a **360 × 800** browser viewport, the document width was **345 px**, the Horizon button was present and there was no horizontal overflow. The restored desktop view was **1280 × 720**, with a **1265 px** document width. The final preview remained Chapter IX, turn 1, with six of six orders; the captured production console contained no errors or warnings. These observations are saved in `production-ui.json`; they do not establish physical-phone usability or performance.

## Evidence and limits

Local logs are `work/sky-horizon-final-tests.txt`, `work/sky-horizon-assets.txt` and `work/sky-horizon-autoplay.json`; the exact build inventory is `dist/build-report.json`. `work/sky-horizon-review/browser-scenes-and-horizons.json` contains the earlier browser sweep and five Horizon records, `post-fix-browser.json` contains the final targeted checks, and `production-ui.json` records the normal-interface observations. Related PNG captures remain local review material and are referenced by hash in the portable summary, without adding screenshot binaries to the repository.

The sky, terrain silhouettes and figures remain stylized procedural graphics. These checks establish neither guaranteed frame rate nor physical-device performance, accessibility conformance, or independent player enjoyment. This record makes no new offline-browser or full-campaign gameplay claim beyond the observations stated above.

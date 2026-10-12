# Sacramentum 0.9 — frontier 3D study verification

Production revision: `24aafef7f270`. Verified on 12 October 2026. The release adds a separate playable Chapter I field battle with real 3D geometry, articulated figures, lit materials, cast shadows and orbit/focus cameras. The twelve-chapter campaign retains its existing renderer and saved-game model. This is one battle, not a completed 3D campaign or a photorealistic asset pipeline.

## Automated verification

- Final suite: **289 tests passed**, zero failures, skipped tests or cancellations. Node's test runner completed in 22,644.4 ms after legal fixture preparation. The exact pretest/test Node commands were used because this shell did not expose npm.cmd.
- Campaign autoplay: **12 chapters, 25 encounter victories, 213 player turns**, ending at Augustus. The core rules and campaign data are unchanged by this release.
- **10 asset/offline checks passed**: exact manifest bytes/hashes, startup budgets, deferred study assets, first navigation to the study document, offline directory alias, version isolation, incomplete downloads, retries and activation behavior.
- New tests exercise articulated pose finiteness, grounded gait, actual bow equipment, geometry and disposal bounds, continuous turns, delayed withdrawal, raised-ground picking, finite environment geometry, valid color attributes, legal study initialization, full six-turn battle replay, and byte-for-byte state purity for rejected commands and previews.

Local logs are retained with the review package. Automated rules and geometry checks are evidence of correctness within their coverage; they are not measurements of player enjoyment or physical-device performance.

## Browser observations

Actual Codex in-app browser rendering on Windows was inspected using the local source preview and final static build. The final build rendered without captured console errors or warnings. The earlier obsolete Three shadow-map warning was corrected before the final build.

- Completed all 18 player commands/end-turn operations of the frontier battle through native named controls. The UI reported victory on turn 6 with the hero at 6/22 health; no direct state injection was used. This complete UI replay used reduced motion. Separate animated commands verified movement, brace, throwing, enemy/allied turn resolution and Escape-to-finish behavior.
- The final production view accepted a pointer pick on the visible 1E marker, displayed the legal Move preview, committed the command, and displayed the spent move at 1E. Camera orbit, focus, field reset and graphics selection were exercised through real controls.
- Restart returned to a fresh battle. Return to campaign displayed the normal title page and new study entry link. Browser Back reopened the study successfully. This browser returned a fresh intro; a persisted back/forward-cache hit was not observed. The controller has explicit disposal/restoration handling for that path.
- Phone-width layout at 360 × 800 and landscape layout at 844 × 390 had no horizontal page/control overflow. The final portrait field camera kept all four opening labels within the viewport. Phone-width commands, reduced motion and animation skipping were exercised. These are desktop browser viewport tests, not physical phone tests.
- Performance and High settings rendered; rebuilding optional scenery on quality changes preserves the battle state. Help shows actual draw/triangle/texture counts for the current view. Those counts are not a frame-rate benchmark.

Actual screenshots are supplied in the review archive, including the close character view and phone layout. They are browser captures, not generated concept images.

## Delivery boundaries

The final build contains **121 runtime files** before the generated worker/report. Individually gzipped estimates, including the worker where applicable:

| Download group | Bytes |
| --- | ---: |
| Initial campaign shell | 356,024 |
| Shell and Chapter I | 4,195,494 |
| Optional 3D files | 1,190,209 |
| Complete opt-in package | 6,530,323 |

The optional 3D files do not enter the initial campaign or chapter cache groups. Full offline download includes them. Offline routing/readiness was verified by the service-worker protocol harness; an actual server-disconnected 3D browser session was not run for this release. The locally bundled Three.js 0.186.1 modules retain their MIT notice. The material atlas master and exact generation prompt are retained outside source/runtime, in a separate art-master archive. Private reference Word documents are excluded.

Physical GPUs and phones, screen readers, sustained frame rates, long sessions and independent first-time playtests remain unverified. Characters use original procedural articulated rigs rather than a production motion-capture library. The art establishes a playable 3D direction; further bespoke modeling, animation and scene work would be needed to carry that direction through the entire campaign.

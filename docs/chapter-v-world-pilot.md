# Chapter V world-building pilot

Approved pilot scope: the Euphrates staging courtyard, **The cracked tower** and **The red river gate**. The owner approved this pilot and expansion on 23 October 2026. This document preserves the pilot's review evidence; the subsequent campaign-wide work is recorded in [Regional world-building](regional-world-building.md).

## Playable changes

- A 50 × 40 metre courtyard connects the command shelter, supply court, formation yard, aid shelter, company muster, evacuation shelter and field gate. People and essential services also remain available through the sidebar. Conversations are optional; chapter decisions, preparation and departure have direct actions.
- Courtyard residents are protected from offensive abilities and forced attacks. The three interior prop pockets have explicit blocked terrain; surrounding routes and interaction points stay accessible.
- Sixteen original Blender components form a coherent fortress frontage, breached wall, mine works, roof galleries, quay and river landing. They use original stone, plaster, timber and canvas surfaces. The playable battle footprints and combat rules stay unchanged.
- Broader courtyard flagstones and narrower joints reduce the distant grid pattern with fewer paving instances; the terrain and other chapters' paving are unchanged.
- Four new Tripo objects add a cistern, siege hoist, damaged masonry and household bundles. Existing Chapter V scenery is placed alongside the new kit. Models load on demand for this chapter; Performance mode and failed downloads have procedural fallbacks.
- Four service actors perform watch, work, carry and rest gestures. These are in-place ambient actions, not autonomous daily schedules; they pause near the player and respect reduced motion.
- Existing evacuation/countermine decisions and committed field outcomes produce visible supplies, household, water and engineering details. These are derived from campaign records, with no new rewards or save flags. Failed encounters and retries cannot manufacture completed outcomes.
- Shared scenery loading now uses active leases and a bounded idle cache. Disposed scenes release pending loads and GPU resources. Models cannot become accidental picking or navigation targets.

## Art source and credit accounting

| New Tripo asset | Credits | Runtime bytes | Triangles |
| --- | ---: | ---: | ---: |
| Cistern | 20 | 207,008 | 3,920 |
| Siege hoist | 20 | 240,768 | 4,900 |
| Damaged masonry | 20 | 227,144 | 3,430 |
| Household bundles | 20 | 355,564 | 7,840 |
| **Total Tripo spending** | **80** | **1,030,484** | **20,090** |

The approved cap was 400 credits; **320 remain unspent**. The API balance reconciled from 4,180 to 4,100, with no frozen credits. There were no failed or repeated generations and no paid rigging or retopology requests. The bundle geometry was refined locally in Blender without another generation.

The original sixteen-component fortress kit adds 1,602,352 runtime bytes and 34,108 triangles in its source model. Instances share loaded geometry and textures. The source is retained in `art-source/models/ch5-fortress-kit.blend`; its builder is `scripts/assets/build-ch5-fortress.py`. All five runtime models use mesh compression and mipmapped KTX2 textures. Source processing, compression reports, task IDs and actual charges are retained under `art-source/models/`; attribution and loading details are in `docs/asset-manifest.json`.

The fortress is fictional and inspired by the Euphrates frontier. This is an art direction and gameplay pilot, not an archaeological reconstruction of Dura-Europos.

The production build remains within the approved download limits. These are sums of gzip-compressed files, not a measured network transfer:

| Download group | Pilot build | Limit |
| --- | ---: | ---: |
| Initial load | 0.80 MB | 2 MB |
| Chapter I, larger view variant | 10.81 MB | 12 MB |
| Chapter V, 3D | 10.35 MB | 14 MB |
| Largest chapter/view group | 12.56 MB | 14 MB |
| Complete game | 21.40 MB | 50 MB |

## Review route

1. Open the supplied Chapter V review session in real-time mode. With the scene focused, press **Z** for Overview, **F** for Follow and **H** for Horizon. Walk between the shelters, then use Horizon to inspect the fortress and river landscape.
2. Open **People & conversations**, speak to the fortress engineer and choose **Review battle preparation**. Check that the destination opens and receives keyboard focus.
3. Make the chapter decision and inspect the household/supply change. The review package includes separately earned checkpoints for both choices; restore one through the normal Save & Load dialog to compare them.
4. March out to **The cracked tower**. Check route visibility, targeting, readable cover and camera clearance around the mine works. Use Retry to check that the encounter restarts normally.
5. Restore the supplied river-gate checkpoint to review **The red river gate** and the courtyard after the first encounter. These checkpoints were produced by legal commands from New Game, not edited progression data.
6. Compare Balanced and Performance in Settings, and try the keyboard/sidebar alternatives to walking. The preferred art direction, courtyard size and service density should be reviewed before adapting the kit to other chapters.

## Verification and limits

The Windows run passed 1,136 unit/regression tests and fifteen legal autoplay campaigns, each covering all twelve chapters and twenty-five encounters. Asset/offline checks, character asset audits and production-character checks also passed. Subsequent focused checks cover the final terrain, UI and control fixes; the last peaceful-command fix passed all 45 related camp, ability, combat, party and squad tests. Invalid forced targets are rejected before any state change, even when supplied with a defensive ability.

The final production build is **f75d660fe689**. Its nine usability flows and nine Chapter V pilot checks passed, including the engineer handoff, late-loading scene pause/focus, all five new model downloads, decisions, both battle departures, exact save/restore and deterministic retry. The twelve-chapter benchmark passed all five check groups, capturing thirteen scenes across all twelve chapters, including both Chapter V missions. These use legally earned checkpoints and normal UI controls, not injected browser campaign state.

The exact CI rendering-benchmark scope also passed: Chapter V's mine and Chapter XII's confrontation, each in Performance and Balanced. All four runs loaded the generated character bodies and compiled no shader programs on the first visible frame or during the recorded play/camera tour. These timings use SwiftShader and are not hardware frame-rate measurements. A separate live Windows review confirmed Balanced quality, all 38 courtyard scenery placements and the Intel GPU renderer, and left the courtyard open and paused for inspection.

The broader Chromium smoke verified all sixteen scenarios, and the real-time polish suite passed twenty checks on the preceding pilot build `bf6f3aaec99f`. The final targeted checks cover the later UI, paving and peaceful-command changes. Usability evidence on the final build combines the completed camp/phone flows in Chromium 149 with desktop flows in installed Chrome 155; the older headless runner stalled on desktop frame stability. All required usability captures were retained. Reports record the browser versions and run boundaries rather than implying a single uninterrupted run.

Browser reports and review captures are in the accompanying local review bundle. The production Chapter V acceptance command is `npm run smoke:ch5-pilot -- --river-gate`; it is also included after usability checks in GitHub CI. GitHub CI has not run for this unpushed pilot.

The review does not claim 60 FPS, physical-phone validation or a first-time-player usability result. The current Windows Intel browser's exploratory Balanced horizon captures during implementation were roughly 31–32 FPS for both the baseline and pilot, with adaptive resolution active; these were not an isolated hardware benchmark. Distant surface detail should still be judged in motion on the target device. This pilot also retains the game's existing character art, combat animations and service interaction model; it is not a new character-production pass.

The owner's approval opened the remaining eleven-chapter rollout with a separate 600-credit cap. The pilot's accounting above remains unchanged.

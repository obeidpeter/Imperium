# Version 0.14: character and material quality verification

Release verification is complete for production revision **`c1dfd852cc93`**. This record distinguishes automated rules/geometry checks, browser harness observations and the ordinary production-interface smoke check. Counts in earlier release reports are historical evidence, not a substitute for this release's checks.

## Implemented presentation

Character and horse surfaces now use actual Three.js `SkinnedMesh` geometry with normalized vertex weights and bones. Limb and garment transitions blend across joints; bounded cloth deformation is deterministic under explicit seek/reset and disabled by reduced motion. The existing procedural poses, equipment anchors, actor identities, legal commands and saved encounter state remain authoritative. These are original code-generated models, not imported sculpts, scanned people or motion-capture performances.

Locomotion phase now follows actual travelled distance, including mounted strides. The 3D presentation retimes a clone of the existing action timeline: movement lasts 550–2,400 ms according to distance, while action timing uses a 1.65 scale. Release, recipient movement, contact, reaction and sound cues retain their dependencies. Anticipation/contact/recovery phases and directional shield blocks or hit reactions make those phases distinct; optional synthesized footstep, hoof and wade sounds follow the traversed surface. This retiming does not change the campaign clock, legal command result, saved state or 2D timeline.

Timeline attribution now excludes already-withdrawn candidates when troop names are reused, and ambiguous names do not invent an acting figure. Tile-based effects prefer the current living occupant. Figure picking tests visible skinned surfaces rather than hidden detail meshes. These are presentation-correctness fixes alongside the visual changes.

The scene generates a small HDR radiance field from its sky palette and sun bearing. Its reflection prefilter is built once per scene or quality change, not every frame. Metal, cloth, wood and stone retain separate material response. A pooled contact mesh adds soft body and sole/hoof shadows that follow the visible ground, while deterministic particles use posed contact positions for short impact feedback. The contact surface sits above the shallow civic paving; lifted soles fade their detailed stamps.

Shared environment work adds tapered branches, compound palm leaves, low verge plants, smooth boulder normals, fluted columns and masonry arches with separate joints. Balanced and High add beveled masonry; Performance uses simpler blocks. Locally computed broad ground variation, damp bands, grain and surface roughness complement the existing material images. This does not add playable terrain, alter tile costs or change the authoritative picking surface. The separate visible-terrain camera clearance and horizon/river continuity remain in use.

There are **zero new downloadable texture files**. HDR data, particle masks and surface variation are generated locally from original code. Existing image and vendor provenance remains in [3D art provenance](../3d-art-provenance.md) and [license notices](../LICENSE-NOTICES.md).

## Performed automated checks

A focused environment run passed **29 tests** covering the new geometry/material work alongside all-chapter construction, static batching, focus-camera clearance and horizon/river seam regressions. Checks construct actual Three.js scene objects, verify finite geometry and normals, preserve legal standing centers, compare encounter input for mutation, and exercise resource disposal. The new tests inspect material-hook composition so foliage wind and ground uniforms survive the surface refinements.

These Node checks do not compile shaders on a GPU. The new character and lighting tests directly inspect weighted deformation, cloth reset behavior, material tint preservation, contact placement and finite sky-aligned radiance. The final integrated run passed **401 of 401 tests**, with zero failures, skips or cancellations; its recorded duration was 46,728.7241 ms. This is test-run duration, not a rendering benchmark.

The deterministic autoplay began at New Game, used legal gameplay API commands, and won all **25 encounters across twelve chapters in 213 turns**, ending at Augustus. This checks campaign progression and rules compatibility; it is not a human pacing or enjoyment test.

## Geometry measurements

The following matched environment-only counts were collected before and after the scenery changes with Balanced quality. Triangle totals include instances and exclude actors, shadow passes and effects. Mesh counts are scene objects, not a browser draw-call measurement.

| Scene | Meshes before → after | Submitted triangles before → after |
| --- | ---: | ---: |
| Chapter I road | 45 → 47 | 377,934 → 381,814 |
| Chapter II marsh | 31 → 31 | 226,502 → 223,846 |
| Chapter IX cavalry | 19 → 19 | 96,332 → 114,834 |
| Chapter XI adlection | 24 → 24 | 74,690 → 127,994 |

The Senate adds geometry for actual bevels, flutes and arch joints without increasing its environment mesh count. This is a quality/cost tradeoff, not a speed claim. Performance retains un-beveled masonry. The task-local raw measurements are `work/v014-environment-before.json` and `work/v014-environment-after.json`; these work paths are not dependencies of the game or source package.

## Production measurements

Production revision **`c1dfd852cc93`** contains 144 runtime files, split into 64 initial and 80 deferred files. The worker is included in the following byte measurements.

| Download group | Sum of gzip bytes | Gate |
| --- | ---: | ---: |
| Initial shell | 361,215 | 2,000,000 |
| Chapter I | 5,444,563 | 8,000,000 |
| Complete campaign | 6,597,068 | 24,000,000 |

The complete uncompressed runtime plus worker is 8,964,183 bytes. These are build measurements from separately gzipped files, not a browser network trace or ZIP size. All **11 asset/offline protocol checks** passed, including chapter dependency coverage, failed-fetch recovery, truthful partial/full status and worker lifecycle behavior. These automated checks are separate from an actual browser offline play session.

The [compact evidence record](../evidence/character-quality-verification.json) contains these measurements, geometry comparisons, browser results, production observations and SHA-256 hashes of the retained raw reports and screenshots.

## Actual browser verification

The legal-checkpoint harness verified **25 unique scenes and 518 assertions**, all passing, in the desktop Chromium 154 browser surface on Windows. The final record combines **two batches: thirteen scenes, then the remaining twelve**. It is not one uninterrupted sweep. Checks cover actual WebGL and weighted skinning, local reflection texture availability, visible figure positions, legal names/labels, view and overlay behavior, reduced-motion output, motion cancellation and exact campaign-state preservation. The harness uses legally reached checkpoints from New Game and does not read or write the user's campaign saves.

Throttled attempts failed initialization or label settling despite a reported visible document. On the final runtime, the first thirteen scenes passed before Chapter VII's legion scene exceeded the former 15-second settling timeout; its retained failure record reports fifteen rendered frames. The development harness now permits up to 240 actual frames within 90 seconds and records elapsed settling time. Runtime code and the production revision did not change. The remaining twelve scenes then passed. The combined evidence retains the failed attempt and both batch sources.

Three actual legal action samples completed: Chapter I Move and Strike in Follow view, and Chapter IX End Turn following the moving Palmyrene cavalry. Each retained exact committed save state. Their measured synchronous render CPU medians/p95 values were **9.3/24.0 ms**, **7.9/11.0 ms** and **11.3/12.6 ms**, respectively. These are individual desktop observations, not a baseline comparison or frame-rate guarantee; the Move sample reached a 63.2 ms maximum.

One warmed Chapter I Balanced overview sample recorded 120 rendered frames after eighteen warmup frames, at a 1,280 × 720 browser viewport, DPR 1 and a 1,233 × 468 canvas. Synchronous render CPU median/p95 was **5.7/7.7 ms**. Stage-frame intervals were **17.5/35.6 ms** and RAF intervals **16.7/16.8 ms**. Draw calls ranged from 83 to 141, with a mean of 94.6. These metrics describe different work and scheduling boundaries; they do not measure GPU time or imply steady 60 fps.

The Chapter XI Performance/reduced-motion Horizon check used a **360 × 420 canvas inside the desktop viewport**, not a physical phone. Eleven labels were visible, two lower-priority labels were intentionally suppressed, and the settled visible labels had no overlap or out-of-bounds rectangles. State was unchanged. Skyward projection probes were in the camera frustum; this is a geometric projection check, not proof that every ray is free of architecture.

The saved browser console record contains no errors and one Three.js shader-program precision warning from reflection prefiltering. The scene rendered with its local reflection texture; this report does not describe the console as warning-free.

## Ordinary production-interface check

On a fresh loopback production origin, the ordinary interface started a new campaign, chose to tell Varro the truth, and completed all four drill commands: Move, Throw, Strike and Brace. The drill was won on turn three. Recording the result, swearing the oath and entering the boundary road then worked through the normal campaign flow.

Follow and Horizon camera controls, switching 3D → 2D → 3D, and reloading followed by Continue preserved the **exact exported save code**. The restored boundary road remained on turn one with the hero at 1D, 22/22 health and both allowances ready. No campaign saves on other origins were used or changed.

At a **360 × 800 desktop browser viewport**, the full production UI had a 345 px body and scroll width, with a 345 × 384 canvas and no horizontal overflow. This is distinct from the smaller canvas-only harness case above. Three retained screenshots show the final frontier Follow view, the narrow production interface and Horizon. The production smoke's console record is empty; the separate harness precision warning remains disclosed above.

No new browser-offline session was performed in this pass. The eleven automated asset/offline checks passed, while previous browser-offline results remain historical evidence. Physical phones, independent human enjoyment/listening assessments and new screen-reader checks were not performed.

## Limits

Shader compilation, lighting appearance and animation readability need actual browser evidence; a Node scene-construction test cannot establish them. Synchronous CPU timing is not GPU time, an FPS guarantee or physical-phone evidence. Physical iOS/Android devices, independent human players and screen-reader use have not been verified for this pass. Procedural anatomy and scripted cloth/action motion remain stylized. Historical equipment and architecture are interpretations, not exact reconstructions of a particular person or site. The optional 2D view remains available, and no presentation improvement establishes the campaign's pacing or emotional effect without human playtesting.

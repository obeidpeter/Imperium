# Version 0.16 release validation

Version **0.16.0**, production revision **`e134886e141e`**. The full Node suite passed **473/473 tests**; the final rendering rerun passed **20/20**, and the asset/offline verifier passed **13/13**. Actual browser checks covered all **25 encounters with 518/518 assertions**, three additional targeted scenes with **63/63 assertions**, and **21/21 GPU compositor checks**. A legal New Game route completed all twelve chapters and 25 encounters in **217 turns**.

The [compact evidence record](presentation-verification-v016.json) contains aggregates, every checked encounter ID, measured results and SHA-256 hashes of the local reports. Raw evidence remains in the task's `work/v016` directory; it is not embedded in the source package. The report distinguishes automated rules tests, renderer checkpoints, ordinary interface use and physical-device testing.

## What changed

The shared procedural characters have revised proportions, face and clothing surfaces, and locally bundled material detail. Vegetation uses shaped branches and curved, alpha-tested leaf sprays; roads have connected surfaces and blended verges. [Texture provenance](presentation-assets-v016.md) documents the new foliage atlas and smaller export of the existing character-material atlas. These remain stylized project models and illustrations, not scans or motion-captured characters.

Balanced and High now render the visible scene into a linear HDR/depth target, then apply bounded screen-space contact shading, a small spatial edge filter and a restrained color adjustment. Tone mapping and display conversion happen once. Reduced ambient/environment/rim fill gives the directional light more separation. Shadows still use Three's supported **PCF** algorithm; this release does not introduce a new soft-shadow algorithm. Performance quality uses direct rendering, and a failed finishing shader retains a visible direct-render fallback.

The ten files under `src/core/` match the frozen v0.15 source byte-for-byte. This check establishes unchanged core rules; it is not a blanket hash claim about every presentation or data file.

## Automated and browser evidence

| Check | Recorded result | Scope |
| --- | --- | --- |
| Full Node suite | 473 passed; zero failed, skipped or cancelled | Complete regression suite before the final PCF constant-only correction. |
| Final rendering rerun | 20/20 passed | Compositor lifecycle, projection, limits, failure recovery and related presentation checks after that correction. |
| Asset/offline verification | 13/13 passed | Manifest integrity, declared budgets, provenance, current chapter asset selection and simulated worker/cache behavior. |
| Legal autoplay | Augustus; 12 chapters, 25 wins, 217 turns, two allied withdrawals | Seed 275; New Game and legal rules API commands. This is one repeated route for the graphics release. |
| Campaign browser sweep | 25/25 scenes; 518/518 assertions | Legal checkpoints from a 1,079-command trace; actual WebGL, weighted skinning, labels, authoritative anchors, retained canvas, state purity, cancellation and disposal. |
| Final targeted browser checks | 3/3 scenes; 63/63 assertions | High-quality cavalry, narrow Balanced Senate and Performance marsh; additional checks of existing campaign scenes. |
| GPU compositor harness | 21/21 assertions | Actual framebuffer output, transfer, contact shading, cleanup and deliberately broken-shader recovery. |

The broad scene sweep ran in Windows Chromium 154 at a **1280 × 720** browser viewport, DPR **2**, with a **1233 × 468 CSS-pixel canvas**, Balanced quality. It covers nineteen battles and six Contests across all chapters. Every scene recorded the compositor enabled. This is a checkpoint-based renderer sweep, not uninterrupted manual campaign play.

The final targeted run passed **20 assertions** for Chapter IX cavalry (`ch9-wing`) in High, **23** for Chapter XI Senate (`ch11-adlection`) in Balanced with a **360 × 420 canvas**, and **20** for Chapter II marsh (`ch2-marsh`) in Performance. It checks reduced-motion command output and exact committed saves as part of each scene test. The narrow canvas is inside the desktop browser, not a physical-phone test. High and Balanced recorded the compositor enabled; Performance recorded the direct path.

The dedicated GPU harness used a **720 × 400 drawing buffer**. Balanced and High showed nonblack, nonuniform output with no unexpected GL errors. Their neutral reference differed from direct rendering by at most **1/255 per channel**. Maximum measured contact darkening was **28** luminance levels in Balanced and approximately **34.21** in High. Target textures and fullscreen geometry returned to their initial counts after disposal.

An early black frame was caused by a custom `luminance` function colliding with Three's shader prefix. It was renamed. The GPU regression deliberately recreates that exact compile failure and confirms that the diagnostic is captured, the previous hook is restored, and a visible direct-render fallback remains. The one deliberately induced shader error is expected; it is not counted as a normal rendering success.

## Matched opening-road measurement

Both samples use the same saved state, selected hero, Follow camera, yaw, pitch, 7.5 m camera distance, viewport and Balanced quality. Each records 120 warmed idle frames after 18 warm-up frames; no action animation is running.

| Observation | v0.15 baseline | v0.16 candidate |
| --- | ---: | ---: |
| CPU update/render-submission median | 5.1 ms | 5.1 ms |
| CPU update/render-submission p95 | 6.6 ms | 6.8 ms |
| RAF interval p95 | 16.8 ms | 16.8 ms |
| Stage-render interval p95 | 35.0 ms | 35.3 ms |
| Mean draw calls, including shadow work | 114.2 | 116.0 |
| Mean submitted triangles | 463,822.4 | 434,690.7 |
| Resident renderer textures / geometries | 40 / 108 | 45 / 113 |

The candidate's finish used an **1849 × 702** target. Saved state remained unchanged in both samples. These are single desktop observations: they do not establish a speedup, GPU execution time, guaranteed FPS or phone performance. Full-scene sweep startup costs are not substituted for this warmed comparison.

## Ordinary production UI and offline use

On the local production origin, the existing disposable Story chronicle was at Chapter I road, turn 3, operation phase 2. Updating to this edition preserved the exported save exactly. Changing camera views, Balanced/High/Performance quality and reduced-motion settings also preserved it exactly.

After the server was stopped, the cached chapter reloaded successfully with the new foliage and compositor available; chapter readiness remained truthful, the compositor was enabled, and the save was still exact. A separate source-origin save was left untouched. This verifies local production caching and ordinary desktop controls, not a remote deployment or a full offline campaign playthrough.

## Download scope

| Resource group | Summed gzip bytes, including service worker | Gate |
| --- | ---: | ---: |
| Initial shell | 379,690 | 2,000,000 |
| Chapter I | 7,894,819 | 8,000,000 |
| Complete campaign | 10,776,706 | 24,000,000 |

The build has 178 runtime files: 71 initial and 107 deferred. Complete uncompressed size including the worker is **13,250,855 bytes**. Chapter I has **105,181 gzip bytes** of headroom. These are build sums, not browser network-transfer measurements. Superseded art remains preserved in the complete inventory while active chapter groups request the current atlas.

## Limits

Screen-space shading remains view dependent, and the small edge filter cannot eliminate every thin-leaf or spear shimmer. Coarse character silhouettes and procedural animation remain visible at close range. No photorealistic or new motion-capture claim is made.

At their caps, the added HDR color/depth attachments require approximately **48 MB** in Balanced or **96 MB** in High, before driver overhead and existing buffers. Desktop correctness checks do not establish physical-phone GPU, thermal, battery or memory behavior. No new human enjoyment, onboarding, pacing, full accessibility or mobile-device study was performed. The local release preview, `imperium-v016-preview.png`, and matched road/horizon captures are visual evidence, not substitutes for those studies.

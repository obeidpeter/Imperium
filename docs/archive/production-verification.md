# Production presentation verification — v0.8.0

This report separates implemented presentation, automated rules checks, observed desktop-browser use and tests still outstanding. The final measured build is **e3231c82e4db**. The actual production-cache browser check used the immediately preceding **a862c0ec36ab** build; the final refresh changes the two landing gameplay images and their intrinsic dimensions, with no service-worker or tactical-rule change. The source preview itself has no generated service worker.

## What changed

The active encounter is now a large command stage with a compact order strip. Selecting a figure or ground position suggests an available command; a second deliberate activation or Confirm commits the reviewed target through the authoritative game API. Direct figure picking supplements ground picking. Named unit/action/target controls and board keyboard movement remain available. Autonomous early companions are labelled accordingly; later orders expose their actual readiness. Mission, roster and log disclosures preserve their open state during commands.

Continuous ground materials, broad scene lighting, textured natural props, timber defenses, supplies and chamber floors replace the persistent checkerboard and many flat primitives. The optional Grid, hover/focus outlines, objectives and legal target overlays remain readable. Painted props do not introduce blockers. The small eastern foundation boxes identified during browser review were exterior decoration; they now use the existing rubble artwork at the same outside-board position.

Five local animation sheets contain **156 generated frames**. Only verified costume/action/facing combinations are enabled: recruit walking and selected strike/brace/recoil/throw directions, Roman and Gothic infantry walking/striking, and senatorial speech. Two recruit rear-strike rows remain unused because their camera direction drifted. Officers, cavalry, eastern troops and uncovered actions still use the original facing artwork and procedural articulation. This is a mixed 2D animation library, not a complete authored set for every unit. See [graphics architecture](../graphics-architecture.md), [world artwork](../production-world-art.md), [asset manifest](../asset-manifest.json) and [animation prompts](../graphics-prompts/animation-v08.json).

Visible command-stage atmosphere runs at capped 12/20 callbacks per second in Balanced/High; Performance and reduced motion disable it. Action animation takes priority. This is Canvas 2D presentation with deterministic fallbacks, not full 3D rendering.

## Automated checks and legal campaign

- The final recorded Node suite passes **275/275 tests**, with zero failures, cancellations or skips, in **28.95 seconds**. The earlier integrated checkpoint passed 267 tests; it is superseded by the completed final run.
- Legal autoplay from New Game, seed 275, reaches **Augustus after all twelve chapters and 25 encounters in 213 player turns**. It uses validated gameplay API commands, not debug promotion or edited saves. This verifies one automated route, not every decision combination or human difficulty.
- All **nine asset/offline protocol checks pass**: manifest integrity, package budgets and chapter coverage, initial shell-only caching, truthful chapter readiness, edition-scoped lookup, interrupted full-download failure, successful retry, cached navigation with the mocked server unavailable, and activation cleanup without forced `skipWaiting`.
- World, source-rectangle, pose, cache, state-purity, direct-control and readiness regressions are included. These check actual imported modules and submitted drawing/state behavior; they do not prove pixel quality or physical-device accessibility.

Logs retained with this task: `work/production-tests-final.txt`, `work/production-autoplay.txt`, `work/production-build.txt` and `work/production-asset-checks.txt`. Their measured outcomes are reproduced here so this document remains useful in the source package. Generated development fixtures remain excluded from source delivery; the included `pretest` preparation rebuilds them. No fresh v0.8 source-ZIP bootstrap run is claimed here.

The 275-test run preceded only the final mechanical landing-image refresh and intrinsic-size update. The production build and all nine asset/offline checks were rerun after that refresh and passed for **e3231c82e4db**.

## Actual browser observations

The observed surface was the Codex In-app Browser on Windows, reporting Chromium **154**. Responsive checks used **sized same-origin frames**; the attempted IAB viewport override did not change the actual viewport. These are desktop browser checks, not device emulation results; no physical touchscreen, phone or screen reader was used.

| Flow | Observed result |
| --- | --- |
| New Game and first training encounter | Naturally completed Move, Throw, Strike and Brace; reviewed and committed actions through the live UI. |
| Early allied readiness | A misleading readiness presentation was found and corrected; autonomous companions no longer present themselves as directly commandable. |
| Chapter IX | Imported an earned legal checkpoint, inspected the dense eastern battlefield and used the live encounter. The **640 × 360 same-origin frame** had no horizontal overflow and kept commands usable. |
| Chapter XI | Imported an earned legal checkpoint. Persuade preview and commitment agreed on delegate stance **+3 → +4** and consumed the speech action while leaving movement available. |
| Tactical disclosures | Open details remained open after command/rerender interactions. |
| Narrow portrait and enlarged text | In a **360 × 640 same-origin frame**, including the application's **200% text setting**, inspected commands remained usable without horizontal overflow. This is not a claim about every screen or genuine browser zoom. |
| Environment inspection | Opening, eastern and Senate scenes were inspected. Trees, stone, continuous materials and the larger command stage were visible. Remaining green-rise, timber and foundation primitives identified during review were replaced. |
| Explicit production download | On build **a862c0ec36ab**, Settings' Download all chapters progressed to “All twelve chapters are available offline.” This was a user-requested full download, not inferred from chapter prefetch. |
| Server-unavailable opening play | Stopped the owned production preview server, reloaded successfully through its service worker, then started New Game through the ordinary UI, chose Truth and entered training. ArrowRight/Enter previewed Move **1D → 2D**; a second Enter committed it. The UI showed **1/4 drill actions, Move spent, Action ready and Saved**, with artwork visible. |

The review folder retains `opening-wip.jpg`, `chapter9-full.jpg`, `chapter11-full.jpg`, `landscape-chapter9.jpg`, `phone-200-percent.jpg`, `phone-200-command.jpg`, `offline-ready.jpg` and `offline-command.jpg`. Some are intermediate diagnostic captures; they are not all screenshots of the final build and should not be presented as such. The final site previews use separate actual v0.8 board clips, mechanically downscaled to 640 × 427; see [interface asset provenance](../interface-assets.md).

## Motion evidence and measured cost

[Production motion evidence](../evidence/production-motion.json) records **eight completed cases**, each with one warmup and six repeated actual animation plays. Cases cover movement, strike, brace, projectile, recoil and legally reached chapter I, IX and XI board transitions. All eight retained identical input-state hashes before and after rendering.

The environment was a **1280 × 720 desktop viewport, device pixel ratio 2, Balanced quality and a 600 × 400 CSS-pixel canvas**, with warmed artwork. Balanced caps the actual drawing pixel ratio separately. Measurements use the actual `playEncounterMotion` callbacks; independent RAF intervals and synchronous Canvas submission are reported separately.

| Metric | Recorded result |
| --- | ---: |
| Range of per-case CPU medians | 0.9–2.1 ms |
| Median of the eight CPU medians | 1.7 ms |
| Range of per-case CPU p95 | 1.3–3.3 ms |
| Per-case independent RAF p95 | approximately 16.8 ms |
| Range of per-case paint-interval p95 | 16.9–20.1 ms |
| Input-state hashes unchanged | 8/8 |

This is a current-build measurement, not a matched before/after speed comparison. Canvas submission does not wait for GPU completion; RAF cadence is not guaranteed display FPS. The sample does not establish mobile performance, sustained thermals, battery life, or uninterrupted idle costs.

The end-of-run image cache reported **33 retained entries, 66,778,448 estimated RGBA bytes, two evictions and zero pending/active decodes**, within its **40-entry / 67,108,864-byte (64 MiB)** limits. This estimate excludes DOM images, in-flight allocations, Canvas backing stores and browser/GPU memory. It is not a total-process cap.

The six-sample walk and strike filmstrips use the real renderer and actual legal-action timeline: **480 ms** and **660 ms** respectively. Their JSON records unchanged input-state hashes. They demonstrate sampled poses, not real-time smoothness, sound alignment or completion of the entire campaign by a person.

## Build and asset budgets

Measured by summing individually gzipped production files, including the generated worker where stated. These are build-package figures, not ZIP sizes or an observed browser network trace.

| Package scope | Measured compressed bytes | Enforced limit |
| --- | ---: | ---: |
| Initial shell | 355,579 | 2,000,000 |
| Shell plus chapter I | 4,195,049 | 8,000,000 |
| Complete opt-in campaign | 5,339,669 | 24,000,000 |

The recorded production package has **5,805,606 raw bytes including its worker**. This release raises the chapter/full download limits to accommodate the new artwork; the initial shell remains well below its 2 MB gate. Chapter artwork loads as reached, while the full campaign requires the player's download request. Artwork contains no runtime external-image requests or paid generation dependency.

The manifest verifies **48 files**: 43 project AI-generated artwork files, two mechanical gameplay-preview crops, and three code-native installed-app icons. The three world sheets total 755,276 bytes; five animation sheets total 2,485,642 bytes. Original masters and exact prompts are preserved separately. Provenance is not a guarantee of exclusive copyright or legal clearance.

## Remaining verification and limits

- The production test proves full-download status plus a server-unavailable reload and opening command on the stated revision. It does not prove playing every chapter offline, OS-level network disablement, installed-PWA behavior or a v0.8 update from an older installed edition. The final landing-image refresh was verified by the build/protocol checks, not a second complete browser-cache run.
- Real iOS/Safari and Android/Chrome installation, OS memory pressure, storage eviction, physical touch, native share sheets, VoiceOver and other screen readers remain untested in this pass. Use the [playtest kit](../playtest-kit.md).
- The 200% check changes the game's text setting. Browser zoom, the entire action-by-device matrix and sustained mobile play were not exhaustively tested.
- Dense units can overlap. The roster and named target controls remain alternatives to figure picking. Decorative textures repeat, authored animation coverage is partial, and original procedural fallbacks remain visible in uncovered cases.
- The 90–150 minute pacing goal, historical immersion, enjoyment and recruit-to-emperor emotional payoff still require first-time human playtests. Autoplay turn counts and test passes cannot establish them.
- No deployment, live custom domain, publication, AAA-quality claim or full-3D claim is made by this verification report.

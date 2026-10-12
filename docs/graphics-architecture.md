# Graphics, loading, and offline architecture

The presentation uses local WebP atlases, Canvas 2D, and DOM/CSS narrative views. No GPU framework, external font, asset CDN, analytics, or runtime package was added. Rules and saved campaign state remain separate from rendering; visual paths, poses, particles, and lighting do not award or change game outcomes.

## Rendering and motion

`src/ui/renderer.js` retains the board geometry and hit testing. `battle-art.js` composes cached ground, depth-sorted scenery and units, contact shadows, readable side/selection markers, bars, and action effects. The terrain, target list, keyboard board controls, and legal actions remain driven by the encounter state. The v0.6 presentation pass reuses the existing compressed artwork; it adds procedural detail and motion rather than another bitmap library.

`unit-sprites.js` selects one of four painted facing cells using actual military faction, role, chapter, and escort identity. It does not mirror a facing, which would reverse weapon and shield hands. Missing art returns control to the existing Canvas figure fallback. The original sprite-height calculation and board-marker footprint remain in use.

`sprite-poses.js` samples explicit procedural keyposes for strike, throw, brace, recoil, speech, and their command/mounted variants. Each action has preparation, emphasis, and recovery and returns to rest. Walking and running alternate a lifted foot with a planted foot; a distance-based `stridePhase` supplied by the timeline synchronizes the cycle with the reconstructed visual path. Robed figures use a smaller gait and riders use a different weight shift. The motion is deliberately bounded because the source images are complete painted silhouettes, not separated skeletal parts.

Active articulation uses a continuous 30-vertex, 40-triangle texture mesh over the existing atlas cell. Shared vertices preserve a connected silhouette, and soft displacement limits prevent folding and excessive reach. The mesh moves the existing weapon, shield, and arm pixels together; it does not draw an extra arm or duplicate weapon over the original pose. Idle breathing, settled guards, and completed actions use a single image stamp. During a turn, the two original facing images may briefly blend. These are procedurally deformed static facings, not authored frame-by-frame sprite animation cycles.

`terrain-detail.js` derives shore and marsh edges, paved verges, road tracks, sparse grass/reeds/gravel, and chamber borders from the existing terrain. Detail is drawn in the cached ground pass and clipped to the board. `world-art.js` continues the authored edge material into the surrounding landscape and adds regional supplies, moorings, benches, tables, masonry, and vegetation outside playable cells. Its presentation hash is deterministic and does not consume gameplay randomness. Decorative features do not add obstacles or change passability, visibility, targeting, or scenario objectives. Performance mode omits the optional ground patches and extra set dressing.

`battle-effects.js` draws short projectile flights, weapon arcs, contact flashes, shield sparks, surface-aware movement trails, and quieter speech cues from the committed timeline. Projectile angle follows its visual flight tangent. Trails follow reconstructed path segments rather than a straight shortcut across blocked terrain. Effect counts are bounded by the existing quality budgets; Performance omits nonessential trails and weapon arcs. These cues illustrate recorded actions and changes rather than simulating another combat result.

`motion.js` and `animation-timeline.js` animate detached before/after encounter snapshots. The UI captures the submitted command before it clears selection. A rerender, modal, hidden document, resize, or another command cancels the active player and restores the final static board. Reduced motion disables the action animation.

`ambient.js` supplies one brief arrival beat after tactical art has loaded for a new board view: at most six seconds, 12 frames/second in Balanced or 20 in High. Performance mode and reduced motion skip it. It stops on scroll, resize, hiding, detachment, explicit cancellation, or its deadline, including a stalled animation-frame callback. There is no permanent tactical idle loop. Action animation takes priority. CSS scene animation pauses while the document is hidden.

## Graphics settings

`graphics-quality.js` exports `GRAPHICS_MODES`, `defaultGraphicsMode`, and `createGraphicsQuality`. Settings store the effective mode locally.

| Mode | Canvas pixel-ratio cap | Optional particle budget | Shadow layers | Atmosphere |
| --- | ---: | ---: | ---: | --- |
| Performance | 1 | 0 | 1 | off |
| Balanced | 1.5 | 6 | 2 | on |
| High | 2 | 12 | 3 | on |

The default is Balanced. Save-Data or a valid device-memory hint of 2 GB or less starts in Performance. These hints are conservative choices, not measurements of the device. An explicit saved/player choice takes precedence. The controller retains at most 30 draw-cost samples. When at least 18 of 30 active samples exceed 22 ms, it lowers one step and clears that sample window. Hidden, inactive, and invalid samples do not count. It never raises quality automatically; the player can select another mode. These are synchronous drawing costs, not a claim about frame rate or physical-device performance.

## Artwork API and bounded retention

`art.js` exports `loadArt`, `peekArt`, `artCacheStats`, `clearArtCache`, `chapterAssets`, and `prefetchChapter`, plus the existing portrait/scene helpers. `speakerPortrait(speaker, 'intense')` selects an expression variant without changing character identity.

`asset-loader.js` deduplicates pending loads and retains decoded images in an LRU cache capped at **24 entries and 24 MiB estimated RGBA bytes**, whichever limit is reached first. It decodes at most two images concurrently. Failed loads return `null`, use a 15-second retry delay, and can be explicitly retried. Decoding has a 15-second timeout. Oversized images can be returned to a caller but are not retained in this cache. Eviction drops this cache's reference; it does not invalidate an image already being drawn.

Those caps describe application-retained image references and width × height × 4 estimates. DOM image elements, in-flight decodes, Canvas backing stores, browser HTTP caches, and browser/GPU allocations are separate. This is not a total-process memory cap.

`chapterAssets(chapter)` lists scene/current and promotion portraits, ledger portraits, reachable expressions, the oath seal, and the chapter's tactical atlases. `prefetchChapter(chapter, {onProgress, retry, next, connection, shouldPrefetchNext})` decodes the current group. Its progress reports completed, total, failed, and percent. Optional next-chapter warming fetches compressed responses only, at most two at once, so it cannot fill the decoded-image cache with future artwork. It is disabled for Save-Data, 2G/slow-2G, or downlink below 1 Mbps, and stops queuing when the request is superseded or the caller says it is no longer relevant. Missing art leaves the readable tactical fallback in place; Settings offers an explicit current-chapter retry.

## Offline protocol and build gates

The service worker initially caches the application shell plus the title, recruit, and Varro images. The oath seal and later portraits are excluded from that opening set. The UI requests the current chapter on entry; it does not automatically request the complete campaign. Settings' **Download all twelve chapters** control explicitly requests the full download.

| Request to the active worker | Meaning |
| --- | --- |
| `{type: 'cache-chapter', chapter}` | Cache shell plus that chapter's declared assets. |
| `{type: 'offline-status', chapter}` | Report complete-campaign and current-chapter readiness. |
| `'cache-campaign'` | Download every declared production asset after the player's request. |

`chapter-offline` responses contain `{chapter, ready, completed, total, percent, revision}`. Full progress uses `offline-progress`; `offline-ready` is sent only when all production files are present. Errors identify the failed chapter or complete request and allow retry. The header distinguishes current-chapter readiness from all-chapter readiness. Optional prefetch completion alone is never treated as proof that a chapter is available offline.

Each build uses a content revision and an edition-scoped cache. Reads and readiness checks use that cache alone. Installation fetches with HTTP cache revalidation bypass (`cache: 'reload'`) so an old image at the same URL cannot satisfy the new edition. A waiting worker does not call `skipWaiting`; old tabs finish before activation and old-cache cleanup. Production navigation can restore the cached shell. A source preview does not include generated `sw.js` and therefore does not prove PWA behavior.

`scripts/build.mjs` produces the chapter groups and `dist/build-report.json`, fails on missing required artwork, and preserves the existing strict **2,000,000-byte compressed cap** for the opening install, shell plus chapter I, and complete campaign. Measurements sum individually gzipped production files, including the worker. They are package estimates, not browser transfer traces or ZIP sizes. The complete-package cap is not relaxed for this graphics work. `scripts/verify-assets.mjs` checks package limits, declared asset integrity, chapter coverage, and worker behavior.

## Verification scope

Direct module tests cover cache deduplication/concurrency/LRU bounds, failure and retry, compressed-only next-chapter prefetch, conservative quality defaults, bounded cost samples and downgrade behavior, worker chapter/full readiness, stale-edition exclusion, interrupted download recovery, animation cancellation, and UI settings. Pose tests cover recovery to rest, alternating foot contact, restrained robe/rider variants, finite optional inputs, non-inverted mesh triangles, bounded displacement, atlas identity, immutable inputs, and the single-stamp settled path. Terrain and effect tests check deterministic planning, bounds, path fidelity, geometry, and Canvas-state restoration. These are source/geometry checks, not evidence of pleasing movement or freedom from pixel-level seams.

`tests/asset-browser.html` exercises the actual local image library and reports retained-cache statistics. `tests/graphics-lab.html` and `tests/visual-benchmark.html` provide development-only browser inspection and measurement surfaces. `tests/graphics-sprites.html` isolates sampled motion across four facings for visual seam and pose review; these are labelled pose fixtures, not a claimed legal campaign run. The development surfaces are excluded from the production copy.

This architecture note makes no benchmark, battery-life, browser-process-memory, real-device, or frame-rate claim. Final release measurements and observed browser checks belong in the verification report. Real iOS/Android installation, VoiceOver, low-memory eviction, and sustained physical-device play require the explicit playtest matrix in `playtest-kit.md`.

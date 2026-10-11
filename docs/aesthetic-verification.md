# Aesthetic upgrade verification — 0.2.0

Verified on 11 October 2026. Production revision: `cbfacc6ec9a6`. This is a presentation upgrade of the existing game, not a replacement implementation.

## What changed

The complete interface now shares typography, spacing, materials, controls, focus states and a restrained Pompeian-red/ivory palette. Original generated illustrations provide seven protagonist stages, seven recurring/replacement character portraits, the title and six regional environments. Canvas battlefields retain the existing geometry but gain clearer figures, terrain, lighting, faction markers and political chamber scenery. The campaign gains a labelled schematic journey. Character, equipment, dialogue, journal, obligations, promotions, outcomes, settings and the finale use the same visual language.

Motion is a detached presentation layer for movement, impact, health/Resolve, morale, stance and allegiance. Effects last 230–360 ms, cannot intercept input, stop when hidden/scrolled/resized and are absent with reduced motion. Gameplay feedback remains in accessible text. Imperial purple is reserved for the earned accession composition. The same protagonist and oath/lead-seal motif connect the opening and ending.

No external art service is contacted at runtime. There are 21 optimized WebP assets, totalling 1,015,490 bytes. Asset provenance, dimensions, crop bounds, hashes, rights limitations and reproduction instructions are in `asset-manifest.json` and `art-generation.md`.

## Baseline observations and preservation

The frozen baseline was inspected before edits. Observed weaknesses included tiny battlefield figures, dense mosaic noise, repeated panel outlines, small labels, a tall phone Contest header, a text-only equipment view and floating notices that covered controls/prose. Invalid-import feedback appeared behind the open dialog. The stronger cinematic title and career portraits are artistic decisions in addition to those observed usability repairs.

SHA-256 comparison confirms all five `src/core/` files, `src/data/campaign.js` and `src/ui/storage.js` are byte-identical to the baseline. Story, balance, chapter sequence, Governor → Senator → Emperor progression, milestones, choice consequences, random state, save format and storage transactions were preserved. There were no implemented sponsor/supporter surfaces to remove or replace.

The repository's earlier deviations remain disclosed in `reference-requirements.md` and its original verification report: native JavaScript/custom build instead of the specified TypeScript/Vite/Vitest stack; the existing checksum implementation; save-code length above the old aspirational limit in a complete campaign; and unverified human pacing. This visual upgrade does not silently correct those systems or claim the original specification is fully satisfied.

## Automated verification

- `node --test tests/*.test.mjs`: **50 passed, 0 failed**. Includes the existing 43 rule/content/save tests plus seven renderer, motion and UI race tests.
- `node scripts/autoplay.mjs`: legal New Game route completed all **12 chapters / 25 encounters / 231 player turns**, matching the baseline outcome.
- Renderer tests cover state purity, grid picking at three sizes, maximum-length reign-card name/URL, detached motion snapshots, reduced motion, hidden-tab cancellation and non-intercepting effects.
- UI race tests execute the production functions: queued renders bind only the latest board once; delayed or replaced share cards cannot download a blank image or overwrite a newer card.
- `node scripts/verify-assets.mjs`: seven grouped checks passed for manifest/hash/budget integrity, initial-only install, revision-scoped caching, interrupted download, successful retry, cached navigation and activation without forced takeover.
- Syntax checks passed for the modified modules. Production startup produced no console errors or broken images.

## Real-interface checks

The opening chapter was played through its two encounters, oath and promotion using ordinary UI controls and the legal command trace. Defeat was produced by ending turns without satisfying training, then Retry restored the complete checkpoint. Later views were loaded through the real validated import flow from checkpoints earned by the unchanged legal-command campaign runner; they were not unlocked by editing live browser state.

Inspected title, camp/dialogue, geographical chapter map and sealed previews, early battle, Senate Contest, character/equipment, journal, empty and populated obligation ledgers, settings, promotion, victory, defeat, retry confirmation, Governor, Senator, accession, reign preview and invalid-import error. Selected/disabled controls and keyboard focus were exercised. An arrow press moved exactly one grid cell after the render-handler fix. The target selector and confirm path remain available alongside the board.

Viewport checks used nominal 1280×900, 390×844, 360×640 and 844×390 dimensions. The screenshot client area is smaller because of scrollbars/app chrome. At 360px the header fits one row at normal text size; on small screens the DOM and visible sequence agree: board → units → feedback → actions → End Turn → mission/log. No fixed notice covers the board. The game’s 200% text setting and reduced-motion checkbox were exercised. The page and dialogs stayed within the viewport; the unit selector retains its deliberate internal horizontal scrolling. Text contrast was calculated from actual token pairs, ranging from 4.68:1 to 13.96:1; see `visual-system.md`.

The in-app browser did not apply Ctrl-plus zoom, so **browser-level zoom is not verified**. The 200% in-game text test is not presented as browser zoom. No physical phone, screen-reader session, real device share sheet or installation durability test was performed.

## Download and runtime comparison

Both byte estimates below include the service worker and use the sum of individually gzip-compressed files. They are not observed network transfer totals.

| Measurement | Baseline 0.1.0 | Upgrade 0.2.0 |
| --- | ---: | ---: |
| Initial compressed package | 124,180 B | 484,507 B |
| Complete compressed campaign | 124,180 B | 1,158,810 B |
| Complete raw runtime files including worker | 280,334 B | 1,353,635 B |
| Deferred artwork files | 0 | 18 |
| Initial / full compressed cap | 2,000,000 B | 2,000,000 B, unchanged |

Opening assets install first; later portraits/scenes download after startup. The header reports partial progress and claims offline readiness only when all runtime files are cached. An interrupted download has a settings retry. Worker lookups use their own revision, and waiting updates activate after old tabs close.

The production build was opened under a hosting subdirectory and reached “All chapters available offline.” The local server was then stopped. Reload, the existing recruit save, validated import of the completed campaign, the imperial portrait and reign-card generation all worked from cache with no broken images. The Download button produced a valid 1080×1350 PNG (1,425,336 bytes). The automation download-event watcher timed out, but the downloaded file itself was found and verified. This proves server-unavailable behavior in this browser session, not long-term storage guarantees or real-device flight mode.

The same development benchmark ran against the frozen and upgraded renderers in the desktop in-app Chromium surface, DPR1. Each row uses five warmups and 60 measured draws. Full isolated campaign state was unchanged in all eight cases.

| Encounter / canvas | Baseline median / p95 | Upgrade median / p95 |
| --- | ---: | ---: |
| Training, 360×420 | 3.35 / 5.30 ms | 2.85 / 5.40 ms |
| Training, 720×540 | 6.20 / 7.10 ms | 2.70 / 4.50 ms |
| Senate, 360×420 | 3.40 / 4.40 ms | 2.90 / 4.90 ms |
| Senate, 720×540 | 6.45 / 8.50 ms | 2.85 / 4.10 ms |

These measure synchronous Canvas CPU submission, not GPU completion, FPS or input latency. Median costs improved in these samples; the two smaller-canvas p95 values were slightly higher. No claim of universal speed improvement or physical-phone performance is made. Reproduce with `node scripts/autoplay.mjs --fixtures`, then open `tests/visual-benchmark.html` on the source server. The benchmark and checkpoints are excluded from the production build.

## Review artifacts and remaining deployment steps

The companion `aesthetic-review` folder provides an offline HTML gallery, matched before/after screenshots, additional phone/text-size/career captures and the benchmark JSON. Images record representative scroll positions, not every branch. Loading and saving treatments were retained and restyled; their brief transient states do not have matched screenshots. Storage completion/error behavior is covered by the unchanged storage tests and visible invalid-import check.

The updated source and static packages are ready for the existing deployment workflow. Replit publication, canonical `SITE_URL`, custom-domain/DNS configuration, real-device testing and human pacing review remain the owner's deployment steps. The GitHub change is a draft PR; it is not merged or deployed by this verification.

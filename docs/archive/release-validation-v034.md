# Version 0.34 validation

Baseline: main `7523d63`, version 0.33.0. Work is isolated on `codex/imperium-benchmark-v034`. The benchmark begins with Chapter V's two field encounters and extends the production systems across all twelve chapters.

## Evidence boundaries

The deterministic core is independent of browser rendering and audio. Legal campaign runs begin at New Game and use public commands. Focused mechanical fixtures that directly change positions or supply levels are identified in their tests and are not completion evidence. Browser checkpoints come from legal campaigns and are restored with the ordinary save-code interface.

The browser benchmark uses Chromium with SwiftShader. Both Chapter V scenes use Balanced quality at 1280 × 900; the remaining chapter inventory uses Performance at 960 × 720, all at DPR 1, with Reduced motion enabled and Adaptive resolution disabled. The actual quality, canvas dimensions and renderer statistics are recorded per scene. Scene captures and UI operations establish functional behavior. They do not establish real-GPU frame rates, phone battery life, screen-reader usability or first-time-player enjoyment. No physical-device or human-playtest certification is claimed.

## Reproduce

```sh
npm run verify
npm run smoke
npm run benchmark
```

The smoke and benchmark tools need Playwright and Chromium installed separately; they are not runtime or package dependencies. `PLAYWRIGHT_MODULE` selects a separately installed module. `PLAYWRIGHT_EXECUTABLE_PATH` optionally selects an already installed test browser. CI uses its installed Playwright browser.

The character viewer is development-only: serve the repository, then open `tests/actor-model-browser.html`. It exposes twelve career looks and the named cast, neutral/field lighting, close/equipment/tactical framing, joint motion, overview geometry and resource measurements. It does not modify a campaign.

## Recorded checks

- The complete Windows/Node 24.19.0 suite passes **752/752 tests**, with no skipped or cancelled tests. The final run uses two test workers and includes the review regressions.
- Earlier standard and expanded legal campaigns still reach Augustus.
- The edition-34 runner covers all 25 encounters, all twelve chapters, all six political cases and exact retry at every encounter. Its variants cover Standard, Story, Veteran, alternate choices, depleted supplies and the second authored case at each hearing. Results are in `evidence/command-campaign-v034.json`.
- The character production audit constructs 54 imported actor cases, samples motion, validates geometry/ownership and checks reproducible animation export. Results are in `evidence/character-production-v034.json`.
- Asset integrity, chapter-specific offline dependencies, interrupted downloads and service-worker revision boundaries are checked by `scripts/verify-assets.mjs`.
- Integrated browser results are recorded in `evidence/benchmark-v034.json`; only a final `passed: true` is a passing benchmark.
- The final Chromium 149.0.7827.55 benchmark passes on build `c99d253ac52e`: **13/13 scenes across all twelve chapters**, both Chapter V Horizon views, exact political case preview/commit, 320px viewport at 200% text without horizontal overflow, remapped Undo with reload persistence, and practice export/exit/reload isolation. There are no page, console or runner errors. The four UI checks use 2D; the scene inventory uses 3D with imported actors.
- All thirteen scene captures were visually inspected. The busiest recorded scene is Chapter X at Performance quality: **295 draws and 733,350 triangles**. These counts include scene rendering and are not a frame-rate guarantee.

The corrected production build is revision `c99d253ac52e`, with 269 files. Its transfer figures are sums of gzip-compressed files including the service worker, rather than a browser network trace:

| Resource group | Measured bytes | Budget |
| --- | ---: | ---: |
| Initial shell | 478,244 | 2,000,000 |
| Shell and Chapter I | 7,981,005 | 8,000,000 |
| Complete game | 11,331,245 | 24,000,000 |

Chapter I has only 18,995 bytes of headroom. Additional shared assets must be offset by compression or chapter-specific loading rather than silently increasing this budget. The build excludes development viewers, tests, scripts, documentation and private source documents.

The full test suite, reproducible animation export, asset/offline checks and browser benchmark pass for that frozen build. GitHub separately records Node 20/22 verification, Chromium smoke and a fresh chapter benchmark in the pull request checks, retaining its browser evidence as an artifact. The review also fixed operational spending before supply-condition calculation, stale opening integrity/reinforcement labels, a fallback cavalry geometry overrun and Windows CRLF handling in the animation export checks.

## Remaining production qualification

The implemented character and environmental assets are reproducible code-authored models with the existing adapted CC0 anatomy and original surface artwork. This does not replace a specialist artist's full-body sculpt/retopology pass, hand-directed cinematic performance or motion capture. Those remain potential production investments rather than claims made by this release.

The world-class quality target still needs an agreed visual reference, independent art review, named desktop/phone/browser hardware tests, assistive-technology sessions and first-time player trials. Campaign pacing and enjoyment require observation of people playing; successful automated campaigns cannot establish them.

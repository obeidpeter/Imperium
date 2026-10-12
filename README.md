# SACRAMENTUM: From Recruit to Emperor

![The playable Senate with directional figures, layered architecture, and accessible action controls](docs/images/graphics-gameplay.png)

A free, browser-first tactical chronicle set in the Roman third-century crisis. Begin as a Danube recruit around AD 250, earn military commands, govern a province, enter the Senate, and contest the succession after Aurelian’s death. The campaign contains **12 chapters and 25 playable encounters**, including battles and political Contests.

The game combines original prose with locally bundled painted portraits, cinematic environments, four-direction unit sprites, and layered isometric battlefields. Movement, gestures and tactical effects animate the committed action while the rules remain turn-based. It requires no account, backend, runtime art service, paid assets, or runtime package dependencies. Core rules run in both a browser and Node.js.

## Version 0.4 — graphics release

This release adds faction-specific battlefield figures, a more dimensional battlefield and Senate chamber, visible character aging, recurring-cast expressions, and increasingly elaborate promotion scenes. Performance, Balanced and High quality modes change optional presentation; reduced motion and text scaling remain available. The twelve chapters, choices, rank gates, combat and political rules, and existing save format are preserved.

Read the [graphics art direction](docs/graphics-art-direction.md), [rendering and loading architecture](docs/graphics-architecture.md), and [narrative artwork and generation record](docs/graphics-narrative-art.md). The [asset manifest](docs/asset-manifest.json) records the bundled art and provenance. This section describes implemented changes; it makes no measured performance or physical-device claim.

## Play locally

Use Node.js 20 or later. Open a terminal in the `Sacramentum` project directory. There is no `npm install` step.

```sh
node scripts/serve.mjs
```

Open the address printed by the server, normally `http://127.0.0.1:4173`. Choose **Play · Begin your story** to start, or **Continue the chronicle** if a local save exists. The first chapter teaches the controls. [Playing instructions](docs/PLAYING.md) cover commands, voting, advancement, and saving.

Use the local server instead of opening `index.html` directly: native JavaScript modules require an HTTP origin. This source preview does not generate the production offline cache.

## Build and preview the production folder

```sh
node scripts/build.mjs
node scripts/serve.mjs dist
```

The equivalent commands are `npm run build` and `npm run preview`. The output is **`dist/`**, a plain static folder of HTML, CSS, JavaScript, manifest, icons, and a generated service worker. Build from the project root. The builder safely replaces the generated `dist` directory; source and local browser saves are separate from it.

The build writes `dist/build-report.json` with initial and full-campaign asset counts, byte totals, compressed estimates, and the configured address. It rejects either initial or complete gzip estimates above 2,000,000 bytes. Both figures include the worker. This is a build-budget check, not a measurement of a particular phone’s actual download.

## Replit static deployment

Build this source repository outside Replit’s agent. Import or upload the project and use a **Static** deployment with:

| Setting | Value |
| --- | --- |
| Build command | `node scripts/build.mjs` |
| Public directory | `dist` |
| Backend / server command | None |

The supplied `.replit` records these static deployment settings. The same `dist` folder can be served unchanged by another static host. The development server is only for local preview; do not deploy it as a backend.

Set the build environment variable **`SITE_URL`** to the game’s canonical HTTPS address, including any hosting subdirectory. The builder uses that single value for the production configuration, manifest identity and start address, and the share-card link. For example, in PowerShell:

```powershell
$env:SITE_URL = 'https://your-game-domain.example/'
node scripts/build.mjs
```

Replace the example with the domain you own. With `SITE_URL` unset, relative URLs follow the current static host for local previews. A real custom domain, its DNS, Replit publication, and testing that live address on real phones remain deployment steps for the owner. No production domain has been purchased or assumed by the source.

Keeping the same public origin when changing hosting preserves the browser address to which saves and installs belong. Changing the address does not automatically migrate browser storage; portable save codes provide a manual transfer route.

## Saving, offline play, and sharing

- Actions autosave through an IndexedDB transaction, with a localStorage mirror where available. Concurrent tabs use a checked sequence; a stale tab must explicitly load the latest chronicle to continue. If IndexedDB is unavailable, localStorage saving requires Web Locks. Unsafe writes fail closed while in-memory play and export remain available.
- **Pause → Recover an earlier checkpoint** previews and restores one of the last three distinct checkpoints or replaced chronicles. The displaced current save joins that recovery history.
- **Pause → Copy a save code** exports a checked portable save, including the active encounter checkpoint. Restore validates the code before asking to replace the current campaign.
- Retry restores the entire encounter-start snapshot, including the random seed and staged promises. Rewards are committed when the result is recorded, once per encounter.
- The first save requests persistent browser storage. A browser may decline that request, so keep a save code independently.
- The production service worker first caches the shell and opening artwork. Artwork loads as you reach each chapter; suitable connections may prefetch the next chapter. **This chapter is ready offline** covers the current chapter only. To keep the whole campaign, choose **Pause → Download all twelve chapters for offline play** and wait for **All chapters available offline**. Pause also provides a retry for missing chapter artwork. A new edition activates after old tabs close, preserving the current encounter. HTTPS or a local secure-context exception is required for browser service workers.
- On iPhone, Safari’s **Share → Add to Home Screen** provides the installation path. Real-device installation, long-term storage retention, and platform share menus require device testing.
- The ending can create a PNG reign card with the ruler’s name, broad choices, accession route, and configured game link. It omits character fates. Download and device sharing happen only on the player’s action.

## Project map

| Path | Responsibility |
| --- | --- |
| `src/core/game.js` | Campaign state, advancement, milestone locks, transactions, save validation, finale forecast |
| `src/core/battle.js` | Tactical rules, objectives, AI, command capacity, formations, confrontation routes |
| `src/core/contest.js` | Political grid rules, votes, Resolve, stance, cooldowns, promises, rival speakers |
| `src/core/shared.js` | Grid helpers, units, movement, deterministic random support |
| `src/core/debug.js` | Explicitly enabled development-only scenario injection; excluded from production builds |
| `src/data/campaign.js` | Twelve chapters, cast, decisions, dialogue, absence branches, oath, historical notes, epilogue |
| `src/ui/app.js` | Event routing and persistence; screen views are split into `campaign-views.js`, `encounter-view.js`, and `panels.js` |
| `src/ui/render-controller.js` / `turn-replay.js` | Tested render scheduling, asynchronous share preparation and cancellable turn summaries |
| `src/core/career.js` / `src/data/story-stages.js` | Persistent company service, recovery and state-aware story scenes |
| `src/data/encounters.js` | Authored battlefield layouts, objectives, pressure and route variants |
| `src/core/legacy-*.js` | Original suspended-encounter rules retained only for old saves and their exact retries |
| `src/ui/renderer.js` / `battle-art.js` | Canvas battlefield/chamber rendering, depth order, cached ground and path previews |
| `src/ui/unit-sprites.js` / `world-art.js` | Authored directional unit atlases, faction gear, scenery and environment props |
| `src/ui/animation-timeline.js` / `motion.js` / `ambient.js` | Bounded action choreography, visual feedback and scene atmosphere |
| `src/ui/graphics-quality.js` | Player-selectable presentation tiers and adaptation to measured rendering cost |
| `src/ui/art.js` / `asset-loader.js` | Portrait/environment selection, chapter asset groups, bounded image loading and cache |
| `src/ui/campaign-views.js` / `cinematic.css` | Readable story passages, character staging, promotions and accession |
| `assets/` | Local WebP portraits, scenes, unit and prop atlases; provenance in docs/asset-manifest.json |
| `src/ui/storage.js` | Browser save envelopes, mirrored storage, conflict handling, portable codes |
| `src/ui/audio.js` | Optional browser-generated sound effects |
| `src/ui/styles.css` | Responsive layout, focus states, palette, reduced-motion presentation |
| `src/config.js` | Source defaults; the builder supplies production `SITE_URL` and version configuration |
| `scripts/build.mjs` / `scripts/serve.mjs` | Dependency-free static builder and local preview server |
| `scripts/autoplay.mjs` | Full campaign runner using legal gameplay commands from New Game |
| `scripts/graphics-fixtures.mjs` / `tests/graphics-lab.html` | Legal campaign scenes and a development graphics review surface |
| `scripts/export-narrative-art.py` / `export-specialist-art.py` / `optimize-tactical.py` | Development-only cropping and compression of approved generated art |
| `tests/` | Rules, progression, save, branch, and scenario checks; generated legal-route checkpoints |

Read the [Contest rules sheet](docs/contest-rules.md), [historical research](docs/historical-research.md), [reference-document reconciliation](docs/reference-requirements.md), [privacy note](docs/privacy.md), and [licensing notices](docs/LICENSE-NOTICES.md). The optional in-game historical library links sources and discloses the alternate succession, composite career, reconstructed lead seal, original oath, fictional cast, and other adaptations.

## Verification commands

```sh
npm test
node scripts/autoplay.mjs
node scripts/build.mjs
node scripts/verify-assets.mjs
```

`npm run verify` runs the rule tests, autoplay, build and asset/offline checks. `node scripts/autoplay.mjs --fixtures` also regenerates the legal-route chapter checkpoints and trace used for browser checks. The full-route runner starts at New Game and uses the same legality-enforced commands as the browser; chapter injection belongs only to separately identified development scenarios.

The earlier 0.3 release changed gameplay, campaign scenes, the phone action loop and local save recovery. Its [campaign improvements](docs/campaign-improvements.md), [save recovery](docs/save-recovery.md), and [playability verification report](docs/playability-verification.md) remain useful historical evidence; they are not performance measurements of the new 0.4 renderer. The [aesthetic report](docs/aesthetic-verification.md) documents the earlier 0.2 release. The [physical-device and human playtest kit](docs/playtest-kit.md) remains available for further evaluation.

Commands and implemented checks are not proof of a particular result. See the accompanying verification report for checks actually run, browser sizes used, finale profiles, and slice-gate evidence. Autoplay does not establish enjoyable pacing, emotional impact, touch ergonomics on a physical device, or real-world offline durability.

## Scope and design choices

This implementation uses native JavaScript modules, Canvas, and a small custom static builder instead of the larger TypeScript/framework stack discussed in the Word reference documents. The pasted build brief governs this delivery. The smaller dependency-free stack keeps the rules directly executable under Node and ships every core asset with the static game. There is no backend, monetization, multiplayer service, or native Android/iOS shell in this version.

The whole campaign is present, including the two final milestone locks, three campaign meters, obligations, cast absence branches, four main confrontation forms plus costly backing, and the accession bookend. The historical career is a disclosed composite; battle units and chamber votes are gameplay abstractions.

The **90–150 minute** campaign length is a design target, not a validated completion-time claim. Human enjoyment and pacing tests, a complete physical-device touch pass, iOS/Android installation and offline checks, and the live custom-domain deployment remain work to validate. Consult the verification report for narrower automated and browser-interface evidence.

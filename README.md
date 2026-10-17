# IMPERIUM: From Recruit to Emperor

![Actual version 0.8 Chapter I battlefield rendered from a legally reached campaign state](docs/images/production-battle.jpg)

*Actual v0.8 browser-rendered Chapter I board, sampled during a legal Move transition. The capture shows the battlefield; the command controls sit outside this crop.*

A free, browser-first tactical chronicle set in the Roman third-century crisis. Begin as a Danube recruit around AD 250, earn military commands, govern a province, enter the Senate, and contest the succession after Aurelian’s death. The campaign contains **12 chapters and 25 playable encounters**, including battles and political Contests.

The game combines original prose and locally bundled painted artwork with three-dimensional battlefields and political chambers, plus an optional 2D tactical view. Movement, gestures and tactical effects animate committed actions while the rules remain turn-based. It requires no account, backend, runtime art service or paid assets. The 3D view uses locally bundled Three.js; campaign rules remain dependency-free and run in both a browser and Node.js.

## Version 0.14.1 — Imperium

The game is now **Imperium**, formerly Sacramentum. The source repository is [obeidpeter/Imperium](https://github.com/obeidpeter/Imperium). Existing saves and portable codes remain compatible. Historical verification records, original artwork prompts and source filenames retain their recorded names; *sacramentum* still means the Roman military oath where used in the story or historical notes.

## Version 0.14 — weighted figures and material detail

Original character meshes now use weighted skeletal deformation at clothing and limb joints, with bounded cloth motion and planted sole/hoof contacts. Locally generated reflection lighting helps metal, cloth and stone respond to the scene's sky and sun. Soft foot contacts and short pose-aligned impact effects connect figures to the ground and committed actions.

Walking and mounted strides follow distance travelled. The 3D action sequence gives movement, anticipation, contact and recovery more time while keeping footsteps, weapon release and impacts aligned. Shield blocks and reactions face their source; optional synthesized sound distinguishes hard-ground footsteps, hooves and wading. These changes preserve turn rules, committed results and reduced-motion behavior.

The environment adds smoother boulders, compound palm fronds, tapered tree branches, verge plants, fluted columns and jointed masonry arches. Broad ground variation and material weathering retain the existing continuous terrain, legal grid and distant landscape. Performance keeps simpler masonry; Balanced and High add beveled edges. These remain original procedural models and scripted performances, not imported character sculpts or motion capture. No new downloaded texture files are required.

The [version 0.14 verification record](docs/character-quality-verification.md) reports **401 passing tests**, legal completion of all **25 encounters**, and **25 browser scenes / 518 assertions** checked in two batches. Ordinary production play completed the drill and entered the road; camera/view changes and reload preserved the exact save code. A 360 px desktop viewport had no horizontal overflow. Measured desktop rendering costs and the shader precision warning are disclosed; physical phones, independent human playtests and a fresh browser-offline session were not tested. Previous-version results below remain historical evidence.

## Version 0.13 — sky and distant landscape

The 3D scene adds an original procedural sky and a regional landscape beyond the playable ground. Choose **Horizon** or press **H** to look toward them; **Overview** or **Home** returns to the tactical frame, and **Follow unit** remains available for inspection. The campaign and standalone skirmish expose the same explicit Horizon control. Camera changes spend no turn and leave the encounter state unchanged; the initial view remains the tactical overview.

The [sky and horizon verification record](docs/sky-horizon-verification.md) records **375 passing tests**, legal completion of all **25 encounters**, an earlier **25-scene / 468-assertion** browser sweep and targeted checks after the final camera/water corrections. Normal camera/view controls preserved the exact exported save code; a 360 px browser viewport retained Horizon without horizontal overflow. Harness portrait/landscape captures are identified separately from full-game viewport checks. No physical-device or frame-rate guarantee is claimed. The version 0.12 results below describe that prior release.

## Version 0.12 — clearer cameras, figures and labels

Overview frames the playable ground and actual figures; Follow chooses a clear angle around structural scenery. Unit badges and objective markers share collision-aware placement, giving selected figures priority. Original procedural rigs add planted feet and hooves, bounded transitions, equipment-aligned projectiles and mounted aiming. Distance detail, batched scenery and cached rendering work preserve the same legal encounter state and 2D alternative.

The [version 0.12 verification record](docs/campaign-3d-refinement-verification.md) reports **360 passing tests**, a **25-scene / 468-assertion browser sweep**, and **103 normal-interface commands** completing the marsh, cavalry and Senate encounters. The complete Senate route worked with the local server stopped and retained its victory after reload. Narrow/enlarged-text layouts, view switching and actual desktop rendering costs were checked separately. No physical-phone, independent human-playtest or guaranteed frame-rate claim is made. The completed version 0.11 evidence below is preserved as historical evidence.

## Version 0.11 — the campaign's battlefields and chambers in 3D

The shared 3D view now covers all twelve chapters: nineteen battles and six political Contests. Chapter II's marsh and causeway lead into ruined stations, fortified gates, eastern campaigns, river crossings, provincial administration and the Senate. Original procedural figures distinguish military roles, cavalry, civilian escorts and civic speakers. Existing rules, choices, milestones, previews, saves and retries remain authoritative. **Switch to 2D** offers the same encounter in the tactical view, which also serves as the WebGL fallback.

Chambers show delegate **stance**, bloc and commitment, while speakers show **Resolve**. Compact labels keep the thirteen-person room readable; selecting or hovering reveals names. A withdrawn speaker retains their vote. Political gestures follow the argument's recipients without presenting debate as weapon combat. Field objectives and extraction points follow the actual rule grid, including hidden enemies, reinforcements, escorts and finale routes.

The renderer and materials stay out of the initial shell. Every chapter's offline group contains its shared 3D dependencies, so a restored later-chapter save does not need to visit Chapter I first. Cached shared URLs are reused across chapters. The standalone skirmish page/style remain separate until visited or included in the explicit full download. Camera, keyboard, named controls, grid, quality, reduced motion and optional default-off sound remain available.

The [encounter inventory](docs/campaign-3d-encounters.md) records actual layouts, roles and branch requirements. The [current 3D verification record](docs/campaign-3d-verification.md) covers 339 passing tests, all 25 scenes checked in a real browser, normal-interface Chapter II victories, measured desktop rendering cost and a cold Chapter XI offline restore. Original procedural models are not scanned actors or motion capture; these checks do not establish physical-device performance or player enjoyment.

## Historical version 0.10 — Chapter I integration

Chapter I's training and frontier battle now open in a real 3D scene inside the normal campaign. Commands, previews, autosaves, retries and earned progress use the existing campaign state. **Switch to 2D** returns to the tactical view of the same encounter; Pause also saves this presentation preference. If WebGL initialization fails, the game returns to the 2D view. Chapters II–XII retain their existing 2D battles and political chambers.

Drag to orbit, scroll or use **+ / −** to zoom, and choose **Overview** or **Follow unit** to frame the action. The focused campaign board keeps arrow-key tile navigation and Enter to select or confirm; named action and target selectors remain available. **G / Grid** reveals tile boundaries. Actions still require a legal preview and confirmation, and camera movement never spends a turn.

Original procedural character rigs now include shaped anatomy and clothing, distinct practice and field equipment, and small generated fabric, leather, mail and shield-surface textures. Terrain, the training yard and frontier scenery are built from local mesh and material code. These are original procedural models and poses, not imported production character models or motion-capture performances. Performance/Balanced/High and reduced motion control presentation only.

**Generated sound effects** remain optional and off by default in Pause. With sound enabled, the 3D action timeline cues restrained footsteps, cloth, weapons, shields and impacts synthesized locally with Web Audio. Volume is adjustable; no recordings or audio service are used. Sound stops when the page is hidden, and every action remains understandable without it.

Three.js 0.186.1 and its MIT license are local files; no CDN or installation is required. The initial shell excludes the 3D modules and textures. Chapter I's offline download includes the shared renderer, materials and vendor files; the separate study page and its stylesheet join the explicit full download. See [3D presentation verification](docs/showcase-verification.md) for checks actually performed and pending browser/device work, and [art provenance](docs/3d-art-provenance.md) for how the models and materials were made.

## Version 0.9 — the separate frontier study remains available

Choose **Try a standalone skirmish** on the title screen, or open `showcase/index.html` through the local server. This is a single playable battle with three-dimensional terrain and articulated figures, an orbiting camera, a compact command deck and the campaign's legal select–preview–confirm rules. Its temporary battle remains separate from the twelve-chapter chronicle and does not read or write the campaign save.

Drag to orbit, scroll to zoom, or focus the canvas and use arrows and **+ / −**. **Focus soldier** and **Field view** restore useful viewpoints. Named action and target controls provide a keyboard alternative to picking in the scene. Performance/Balanced/High and reduced motion control presentation only. Restart repeats this study; Return to campaign opens the existing game.

The study requires WebGL 2 and shares the campaign's locally bundled renderer. Its own page and stylesheet are excluded from chapter downloads; the explicit full offline download includes them. See [3D study scope](docs/3d-study.md) and [license notices](docs/LICENSE-NOTICES.md). Device support, performance and accessibility claims require the separately recorded checks.

## Version 0.8 — battlefield presentation and direct controls

The encounter now occupies its own command stage, with a compact mission bar, company roster and action dock around the battlefield. Point at figures to select them, at reachable ground to preview movement, and at opponents to preview legal attacks. Activate the same target again or press Confirm to commit. Optional named selectors, full forecasts and rules remain available. Keys 1–9 select actions; N cycles ready units, E ends the turn, G toggles the grid, and Escape cancels.

New local ground materials and natural props support continuous terrain with a quiet default grid. Authored animation sheets add distinct movement, attack, defensive and speaking poses to covered figures; uncovered roles and facings retain the earlier directional artwork. Ambient motion runs only while the scene is visible and motion is enabled; Performance and reduced-motion settings disable it. Result labels remain readable through recovery instead of flashing past.

The [production direction](docs/production-direction.md) records scope and the revised asset budgets. This presentation release preserves the version 0.7 tactical and political rules, milestones and saved encounter compatibility. [Version 0.8 verification](docs/production-verification.md) records actual tests and visual inspection, including remaining limits.

## Version 0.7 — historical tactical and political overhaul

Battles now reward screening, facing, terrain and coordinated formations. Guards defend approaches, archers seek useful firing positions, raiders pressure objectives, and allies consider the mission. Hits affect morale on both sides; shaken troops lose effectiveness, broken troops regroup, and the new Withdraw order helps preserve a line. Damage previews explain the actual modifiers, while mission briefs and visible intentions help the player plan the next turn.

Political Contests now distinguish bloc preferences as well as personal interests. Nearby speakers strengthen Persuade, rivals publish their next planned intervention, and previews show exact stance changes, net votes and costs. Material promises carry a larger accession debt; the fixed electorate, deadline vote and two-promise limit remain. The campaign still advances through earned military command, governorship, Senate admission and the final confrontation.

Regional terrain and chamber materials, formation and morale markers, recipient-linked political gestures and directional recoil make these decisions more visible. Career guidance explains each chapter’s practical responsibility; optional effects now have a volume control. **Standard is the supported difficulty.** Presentation quality settings do not change rules or opponent strength.

Old active encounters and their retries retain their saved rules. New encounters use the revised rules, identified internally by `combatVersion: 2` or `politicsVersion: 2`; importing an older chronicle does not restart the campaign. Read the [overhaul plan](docs/overhaul-plan.md), [chapter review](docs/overhaul-chapter-review.md), [combat design](docs/overhaul-combat-design.md), [political design](docs/overhaul-politics-design.md), and [visual design](docs/overhaul-visual-design.md) for implemented changes and their limits. The [current overhaul verification report](docs/overhaul-verification.md) separates automated results, representative browser play, rendering costs and unresolved onboarding concerns. No independent human or physical-device playtest is claimed.

## Version 0.6 — historical graphics refinement

Painted units now articulate their existing artwork during walking, attacks, throws, bracing, hits, mounted actions and political speeches. Footfall phase follows movement along the visual route; actions have preparation, contact and recovery poses. Directional contact shadows, projectile arcs and distinct impact effects give the figures a clearer relationship to the ground and their targets. These remain procedural animations of four authored facings, rather than a 3D character system or newly painted animation frames.

Connected banks, road wear and material edges follow the actual terrain map. Sparse regional groundcover and exterior camp supplies, moorings, masonry, gardens and chamber seating add context without introducing playable obstacles. Cached ground and bounded detail levels retain the Performance, Balanced, High and reduced-motion controls. The campaign, tactical rules, earned progression and save behavior are unchanged.

Read the [graphics refinement verification report](docs/graphics-refinement-verification.md) for that release’s comparison, checks actually performed and remaining limits. It separates static rendering cost from animated rendering, legal action captures from isolated pose diagnostics, and browser observations from physical-device evidence. These measurements describe version 0.6.

## Version 0.5 — historical website and interface release

The interface release introduced an immediate Play or Continue action, a cinematic opening, and concise sections showing the career, world, an early decision, and actual gameplay captures. Its shared ivory, charcoal, and Pompeian-red interface remains throughout the mobile menu, camp, chapter progression, character equipment, journal, obligations, settings, recovery, and reference panels. Chapters remain earned; navigation does not reset the campaign or bypass an unfinished encounter.

Read the [interface design system](docs/interface-design-system.md), [initial interface audit](docs/interface-audit.md), [historical interface verification report](docs/interface-verification.md), and [0.5 automated regression evidence](docs/evidence/interface-regression.json). Those measurements describe the interface release, not version 0.7.

The underlying 0.4 artwork remains: faction-specific figures, layered battlefields and chambers, character aging, recurring-cast expressions, and rank-specific ceremonies. Text scaling also remains available. [Graphics art direction](docs/graphics-art-direction.md), [rendering architecture](docs/graphics-architecture.md), and [narrative artwork](docs/graphics-narrative-art.md) document that foundation. The [asset manifest](docs/asset-manifest.json) records locally bundled art and provenance.

## Play locally

Use Node.js 20 or later. Open a terminal in the project directory. There is no `npm install` step.

```sh
node scripts/serve.mjs
```

Open the address printed by the server, normally `http://127.0.0.1:4173`. Choose **Play now** to start, or **Continue your chronicle** if a local save exists. The first chapter teaches the controls. [Playing instructions](docs/PLAYING.md) cover commands, voting, advancement, and saving.

Use the local server instead of opening `index.html` directly: native JavaScript modules require an HTTP origin. This source preview does not generate the production offline cache.

## Build and preview the production folder

```sh
node scripts/build.mjs
node scripts/serve.mjs dist
```

The equivalent commands are `npm run build` and `npm run preview`. The output is **`dist/`**, a plain static folder of HTML, CSS, JavaScript, manifest, icons, and a generated service worker. Build from the project root. The builder safely replaces the generated `dist` directory; source and local browser saves are separate from it.

The build writes `dist/build-report.json` with startup, chapter I, and full-campaign asset counts, byte totals, compressed estimates, and the configured address. It rejects initial-shell estimates above 2,000,000 bytes, shell plus chapter I above 8,000,000, or the complete campaign above 24,000,000. All three include the worker. This is a build-budget check, not a measurement of a particular phone’s actual download.

## Replit static deployment

Build this source repository outside Replit’s agent. Import [obeidpeter/Imperium](https://github.com/obeidpeter/Imperium) or upload the project, name the Replit app **Imperium**, and use a **Static** deployment with:

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
- The production service worker first caches the shell and opening artwork. Every chapter requests its own artwork plus the shared 3D renderer and materials; shared cached files are reused. Suitable connections may prefetch the next chapter. **This chapter is ready offline** covers the current chapter only. To keep the whole campaign and standalone study, choose **Pause → Download all chapters for offline play** and wait for **All chapters available offline**. Pause also provides a retry for missing chapter resources. A new edition activates after old tabs close, preserving the current encounter. HTTPS or a local secure-context exception is required for browser service workers.
- On iPhone, Safari’s **Share → Add to Home Screen** provides the installation path. Real-device installation, long-term storage retention, and platform share menus require device testing.
- The ending can create a PNG reign card with the ruler’s name, broad choices, accession route, and configured game link. It omits character fates. Download and device sharing happen only on the player’s action.

## Project map

| Path | Responsibility |
| --- | --- |
| `src/core/game.js` | Campaign state, advancement, milestone locks, transactions, save validation, finale forecast |
| `src/core/battle.js` | Tactical rules, objectives, AI, command capacity, formations, confrontation routes |
| `src/core/contest.js` | Political grid rules, votes, Resolve, stance, cooldowns, promises, rival speakers |
| `src/data/battle-balance.js` / `contest-balance.js` | Standard combat tuning, formation effects, bloc affinities and rival priorities |
| `src/core/shared.js` | Grid helpers, units, movement, deterministic random support |
| `src/core/debug.js` | Explicitly enabled development-only scenario injection; excluded from production builds |
| `src/data/campaign.js` | Twelve chapters, cast, decisions, dialogue, absence branches, oath, historical notes, epilogue |
| `src/ui/app.js` | Event routing and persistence; screen views are split into `campaign-views.js`, `encounter-view.js`, and `panels.js` |
| `src/ui/render-controller.js` / `turn-replay.js` | Tested render scheduling, asynchronous share preparation and cancellable turn summaries |
| `src/core/career.js` / `src/data/story-stages.js` | Persistent company service, recovery and state-aware story scenes |
| `src/data/encounters.js` | Authored battlefield layouts, objectives, pressure and route variants |
| `src/data/campaign-guidance.js` / `src/ui/tactical-intel.js` | Chapter responsibilities, mission briefs, coalition status and visible field intentions |
| `src/core/legacy-*.js` | Original suspended-encounter rules retained only for old saves and their exact retries |
| `src/ui/renderer.js` / `battle-art.js` | Canvas battlefield/chamber rendering, depth order, contact shadows, cached ground and path previews |
| `src/ui/unit-sprites.js` / `sprite-poses.js` | Authored directional unit atlases, faction gear and procedural articulation of painted figures |
| `src/ui/world-art.js` / `terrain-detail.js` / `battle-effects.js` | Regional scenery, connected terrain detail, projectiles and tactical effects |
| `src/ui/animation-timeline.js` / `motion.js` / `ambient.js` | Bounded action choreography, visual feedback and scene atmosphere |
| `src/ui/graphics-quality.js` | Player-selectable presentation tiers and adaptation to measured rendering cost |
| `src/ui/art.js` / `asset-loader.js` | Portrait/environment selection, chapter asset groups, bounded image loading and cache |
| `src/ui/campaign-views.js` / `cinematic.css` | Readable story passages, character staging, promotions and accession |
| `assets/` | Local WebP portraits, scenes, unit and prop atlases; provenance in docs/asset-manifest.json |
| `src/ui/battle-stage-controller.js` / `battle-3d.css` | All-chapter battle/chamber 3D view, view switching and renderer lifecycle |
| `src/showcase/stage.js` / `actors.js` / `actor-pose.js` | Shared WebGL scene, original procedural figures and articulated action poses |
| `src/showcase/environment*.js` / `combat-presentation.js` / `battle-sound.js` | Procedural scenery/materials, visual event timing and optional synthesized combat sounds |
| `src/showcase/campaign-scene-profile.js` / `stage-readout.js` | Campaign scene identity, military/civic labels and mission markers |
| `showcase/` / `src/showcase/main.js` / `session.js` | Optional standalone frontier study and its isolated in-memory battle |
| `vendor/three/` | Locally bundled Three.js 0.186.1 modules and their unchanged MIT license |
| `src/ui/storage.js` | Browser save envelopes, mirrored storage, conflict handling, portable codes |
| `src/ui/audio.js` | Optional browser-generated sound effects |
| `src/ui/styles.css` / `interface.css` | Shared tokens, responsive website and panels, focus states, status treatments, and reduced-motion presentation |
| `src/ui/site-media.js` | Optional supporting website captures, loaded on request or suitable connections |
| `src/config.js` | Source defaults; the builder supplies production `SITE_URL` and version configuration |
| `scripts/build.mjs` / `scripts/serve.mjs` | Dependency-free static builder and local preview server |
| `scripts/autoplay.mjs` | Full campaign runner using legal gameplay commands from New Game |
| `scripts/political-diagnostics.mjs` | Explicitly injected political scenario comparisons using legal commands; separate from full-campaign evidence |
| `scripts/graphics-fixtures.mjs` / `tests/graphics-lab.html` | Legal campaign scenes and a development graphics review surface |
| `scripts/campaign-3d-fixtures.mjs` / `tests/campaign-3d-browser.*` | All 25 legally reached start checkpoints, command replays and explicit real-WebGL review harness |
| `tests/interface-server.mjs` / `tests/interface-load.html` | Development-only observation of actual entry requests and rendered UI milestones |
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

`npm test` automatically runs `scripts/prepare-tests.mjs` first. It sequentially generates the legal campaign checkpoints, graphics scenes, graphics action cases and all-chapter 3D review checkpoints, then starts the tests. Generated `tests/fixtures/` files are excluded from the source archive and repository; their generators and the fixed `tests/compatibility/` inputs are included. For a direct `node --test` invocation on a fresh source copy, run `node scripts/prepare-tests.mjs` first.

`npm run verify` runs that preparation and test sequence, autoplay, build and asset/offline checks. `node scripts/autoplay.mjs --fixtures` separately regenerates the legal-route chapter checkpoints and trace used for browser checks. The full-route runner starts at New Game and uses the same legality-enforced commands as the browser; chapter injection belongs only to separately identified development scenarios.

The earlier 0.3 release changed gameplay, campaign scenes, the phone action loop and local save recovery. Its [campaign improvements](docs/campaign-improvements.md), [save recovery](docs/save-recovery.md), and [playability verification report](docs/playability-verification.md) remain historical evidence. The [graphics report](docs/graphics-verification.md) documents 0.4; the [aesthetic report](docs/aesthetic-verification.md) documents 0.2. Those are not measurements of version 0.7. The [physical-device and human playtest kit](docs/playtest-kit.md) remains available for further evaluation.

Commands and implemented checks are not proof of a particular result. See the [current presentation refinement record](docs/campaign-3d-refinement-verification.md), the completed [version 0.11 campaign 3D verification](docs/campaign-3d-verification.md), and the [historical overhaul verification](docs/overhaul-verification.md) for their respective scopes. Autoplay does not establish enjoyable pacing, emotional impact, touch ergonomics on a physical device, or real-world offline durability.

## Scope and design choices

This implementation uses native JavaScript modules, Canvas/WebGL, and a small custom static builder instead of the larger TypeScript/framework stack discussed in the Word reference documents. The pasted build brief governs this delivery. The rules remain directly executable under Node; the campaign and standalone study use locally bundled Three.js, while the tactical alternative uses Canvas. Every runtime asset ships with the static game. There is no backend, monetization, multiplayer service, or native Android/iOS shell in this version.

The whole campaign is present, including the two final milestone locks, three campaign meters, obligations, cast absence branches, four main confrontation forms plus costly backing, and the accession bookend. The historical career is a disclosed composite; battle units and chamber votes are gameplay abstractions.

The **90–150 minute** campaign length is a design target, not a validated completion-time claim. Human enjoyment and pacing tests, a complete physical-device touch pass, iOS/Android installation and offline checks, and the live custom-domain deployment remain work to validate. Consult the verification report for narrower automated and browser-interface evidence.

# Changelog

## 0.13.0 — sky and horizon

- Adds an original procedural sky and regional distant landscape around the existing playable terrain, with an explicit **Horizon / H** camera view in the campaign and standalone skirmish. **Overview / Home** restores tactical framing; startup retains Overview.
- Camera controls preserve the legal encounter, turn, commands and saved state. The 2D alternative remains available. This release adds no bitmap sky download, external art service or gameplay rule change.
- A dedicated browser-harness diagnostic records sky/landscape metadata, camera settings, skyward projection and exact save equality without changing the existing all-scene checks. The [version 0.13 verification record](docs/sky-horizon-verification.md) distinguishes 375 passing tests, the earlier all-scene sweep, final targeted visual checks and normal-interface save equality. Narrow browser and landscape scene-container observations remain separate from physical-device claims.

## 0.12.0 — presentation refinement

- Overview framing uses the playable ground and actual figures. Follow chooses a clear view around structural scenery, while selected units and action recipients remain the focus. Label placement combines unit badges and objective markers, prioritizes selected/inspected figures and hides lower-priority badges when no clear space remains.
- Original procedural rigs add terrain-aware planted feet and horse hooves, bounded pose transitions, equipment-aligned projectile release and mounted weapon aim. Near/overview detail levels preserve role silhouettes and picking while reducing distant geometry. These remain scripted original models, not imported character assets or motion capture.
- Static scenery is batched without changing authored terrain, transparent surfaces or moving cloth. Cached shadow updates, label measurements and instanced target markers reduce repeated rendering work; actual measured costs belong in the verification record rather than a guaranteed speed claim.
- Extends the legal-checkpoint browser review harness with specific-figure inspection, camera overview/follow controls, exact action occurrences and autonomous-turn samples that actually move the inspected figure. Enemy inspection never grants control or modifies campaign saves.
- Records settled visible-label bounds/overlap, camera settings, actual draw workload and separate 120-frame CPU, stage-interval and RAF measurements. Comparisons require equivalent scenes/cameras and recorded conditions; no speed or device-quality claim follows from adding measurement tools.
- The [version 0.12 verification report](docs/campaign-3d-refinement-verification.md) records 360 passing tests, the strict 25-scene browser sweep, three complete normal-interface encounter routes, a server-stopped Senate victory/reload and measured rendering costs with explicit limits. The version 0.11 report remains historical evidence.

## 0.11.0 — all-chapter 3D presentation

- Extends the shared scene to all nineteen battles and six political Contests, retaining the same campaign state, legal commands, saved encounters and optional 2D view. Chapter-specific scenery and original procedural military/civilian figures cover marshes, fortifications, eastern campaigns, crossings, the province and chambers.
- Political labels distinguish delegate stance/commitment from speaker Resolve. Compact labels reveal names on hover/selection, and withdrawn speakers retain their votes. Argument gestures, objectives, escort markers and role/faction changes follow the actual encounter state.
- Every chapter cache group includes shared renderer, material and Three.js dependencies, supporting a cold restored later chapter without visiting Chapter I. Shared URLs are reused; initial shell and standalone study page/style boundaries remain separate.
- A legal-command fixture generator covers every encounter start and its real action sequence. A development browser harness exposes explicit scene, action, lifecycle and timing checks. The [current verification record](docs/campaign-3d-verification.md) reports only checks performed, with no inferred device/performance or human-playtest claim.

## 0.10.0 — Chapter I integrated 3D presentation

- Chapter I training and the frontier battle use the shared 3D scene within the normal campaign. Commands, saved progress, checkpoints and retries remain authoritative; view switching preserves the same encounter. Later chapters retain their 2D presentation, and unavailable WebGL falls back to the tactical view.
- Orbit, zoom, overview and follow-unit camera controls coexist with the campaign's keyboard tile cursor, named selectors, preview/confirm commands and optional grid. Quality and reduced-motion settings affect presentation only.
- Original procedural figures gain shaped anatomy/clothing, role-specific training and field equipment, material microtextures and articulated action poses. The training yard, terrain and frontier scenery remain locally constructed meshes and materials. No third-party character model, motion-capture clip or new bitmap artwork is introduced.
- Optional effects remain off by default. Local Web Audio synthesis adds event-timed footsteps, shield/weapon contact, throws, cloth and impacts with adjustable volume, bounded voices and hidden-page stopping. No external recording or audio dependency is used.
- Shared 3D modules, local Three.js and material textures now join Chapter I's offline group while remaining excluded from the initial shell. The standalone study page/style remain part of the explicit complete download. Verification and remaining browser/device work are recorded in [3D presentation verification](docs/showcase-verification.md).

## 0.9.0 — optional 3D frontier study

- A separate playable frontier battle uses a WebGL scene, articulated three-dimensional soldiers, local surface textures, orbit/zoom camera controls and a compact command deck. Named selectors and previews retain the existing legal action flow.
- The title's **Enter the 3D frontier** link opens the study. It does not import or write the campaign save, grant progression or replace the twelve-chapter campaign. Restart repeats only this battle.
- Three.js 0.186.1 and its MIT license are bundled locally. The static build includes the study, vendor modules and textures while excluding them from the initial shell and chapter prefetches. Explicit complete offline download includes their dependencies.
- Known optional-page navigation now resolves its own document before falling back to the cached campaign shell. Quality/reduced-motion controls and camera focus/home buttons are available within the study. Release measurements and performed device/browser checks belong in the accompanying verification record.

## 0.8.0 — production presentation and direct command stage

- A larger battlefield/chamber stage and compact command strip expose the selected figure, legal actions, exact preview and turn status. Direct figure/ground selection previews an intention; a second activation or Confirm commits through the existing rules API. Keyboard and named selector paths remain available.
- Continuous ground materials, broad lighting, textured natural scenery, camp defenses and chamber floors replace the persistent checkerboard and flat environmental primitives. The Grid toggle and individual target/focus outlines preserve tactical clarity without changing legal terrain.
- Five local sheets add 156 generated animation frames. Verified costume/action/facing combinations use authored sequences; uncovered roles and directions retain the original facing art and procedural poses. Visible atmosphere is continuous at capped quality-dependent rates and disabled by Performance/reduced-motion settings.
- Early companion readiness and political target inspection reflect actual command availability. Tactical disclosures retain their open state across commands. Narrow and landscape layouts keep the order flow usable.
- The presentation budgets retain a 2 MB compressed initial cap and raise the limits to 8 MB for shell plus chapter I and 24 MB for the explicit full-campaign download. Decoded artwork retention is capped at 40 entries / 64 MiB estimated RGBA bytes; future-chapter warming does not decode additional images.
- The [production verification report](docs/production-verification.md) records automated tests, legal campaign completion, actual browser flows, motion measurements, provenance and remaining device/human tests. These are 2D presentation improvements, not a complete animation library or full 3D engine.

## 0.7.0 — tactical and political overhaul

- Revised Standard combat uses role- and objective-aware planning, symmetric morale, engagement that stops movement on entering a visible melee threat, and a controlled Withdraw order. Formation cohesion, facing, ranged height and cavalry approaches affect exact damage previews.
- Political blocs have distinct argument preferences; nearby speakers improve Persuade. Public rival plans react to the visible position, and authoritative previews enumerate affected votes, Resolve and costs. Grain and office promises cost three supplies to honour; other promises cost two. Commitment resistance, deadline-only voting, the fixed electorate and two-recipient limit remain.
- Mission briefs, field intentions, coalition status and chapter responsibility guidance expose the existing campaign’s decisions. Outcome summaries identify withdrawals and new debts; optional sound effects have a volume control.
- Regional ground and chamber materials, natural scenery, formation/guard/morale markers and recipient-linked gestures improve visual distinction. Existing painted facings remain procedurally animated; presentation does not alter gameplay outcomes.
- Encounter rule markers preserve old active saves and their exact retries. Newly started battles and Contests adopt version-two rules; earned progression, authored choices, company recovery and the governor → senator → emperor sequence remain.
- Design audits and a twelve-chapter review document the changes. Automated, browser, physical-device and human-play evidence remain separate; release measurements belong in the final verification report.

## 0.6.0 — graphics refinement

- Procedural articulation moves the existing painted unit artwork through footfalls, melee attacks, throws, guards, hits, mounted actions and political gestures. Movement phase follows the visual route; keyposes include preparation, contact and recovery.
- Directional contact shadows, projectile arcs and differentiated shield/impact effects improve grounding and action feedback. Four authored facings remain; this is not a 3D character system or a new frame-by-frame bitmap animation library.
- Connected shorelines, road wear and material transitions follow authored terrain. Regional groundcover and exterior camp, crossing, provincial and chamber props add context without changing passability or obscuring legal target overlays.
- Ground detail is cached. Quality modes limit scenery and effects; presentation remains deterministic, cancellable and reduced-motion-aware.
- Development-only legal-action filmstrips, pose/facing diagnostics and comparable browser measurements extend graphics review. Their scope and limitations are recorded in the [graphics refinement verification report](docs/graphics-refinement-verification.md).
- Gameplay, campaign content, earned progression and local save behavior are preserved. No runtime dependency or additional bitmap artwork was introduced for this refinement.

## 0.5.0 — historical website and interface release

- A cinematic title page with immediate Play/Continue actions, campaign/world sections, an early choice example and actual gameplay previews.
- Shared ivory, charcoal and Pompeian-red presentation across navigation, camp, campaign progression, character equipment, journal, obligations, settings, recovery and reference panels.
- Responsive tactical controls, touch-sized actions, readable dialog surfaces and keyboard focus management retain the existing gameplay and save commands.
- Development helpers record actual loading requests and interface milestones. The [interface verification report](docs/interface-verification.md) and [design system](docs/interface-design-system.md) describe this historical release.

## 0.4.0 — historical graphics release

- Locally bundled directional unit and prop atlases, layered regional battlefields and political chambers, faction equipment and clearer depth ordering.
- Bounded action motion and scene atmosphere, presentation quality controls and reduced-motion handling.
- Chapter-specific portraits, recurring-cast expressions, staged campaign scenes and rank-specific ceremonies retain the complete campaign.
- Chapter-aware artwork loading, explicit full-campaign offline caching and documented asset provenance. The [graphics verification report](docs/graphics-verification.md) records the checks and limits of this historical release.

## 0.3.0 — 2026-10-11

Gameplay, narrative, phone usability and save reliability improvements.

- Authored mission layouts and objectives, rescue/escort responsibilities, pressure waves and distinct finale confrontations replace repeated battlefield setups and arbitrary minimum turns.
- Correct facing/flanking and bounded formation effects. Delegate interests make political appeals situational; repeated military-record appeals to the same delegate are limited.
- State-aware arrival, choice, briefing and outcome scenes with saved reading position; the first oath follows training. Company service, commendations and bounded wound recovery persist; provincial decisions affect playable challenges.
- A compact phone board/action/target/confirmation loop, nearby vote totals, clearer target and mission markers, and skippable turn summaries with contextual optional sound.
- Three distinct recovery checkpoints, explicit preview/restore and tab takeover; IndexedDB compares and writes atomically even without Web Locks. Old suspended encounters retain their original rules and exact retry layout.
- Separate screen modules and directly imported controller tests. The current verification report distinguishes automated checks, browser checks, and physical-device/human tests still pending.

## 0.2.0 — 2026-10-11

Complete aesthetic upgrade of the existing campaign.

- Shared typography, materials, controls and responsive layouts throughout the title, camp, map, battles, political Contests, character, journal, ledger, settings, promotions and finale.
- Twenty-one original, locally bundled WebP illustrations: seven protagonist stages, seven character portraits, a title composition and six regional scenes. Asset provenance and generation instructions are documented.
- Clearer Canvas terrain, figures, faction markings and political chambers; bounded, reduced-motion-aware feedback that does not mutate game state.
- Deferred artwork caching, truthful offline progress, retry after interruption and revision-isolated service-worker updates. Both existing compressed size gates remain unchanged.
- Inline error feedback, predictable mobile control order, coalesced render bindings and protection against asynchronous reign-card races.
- Fifty tests pass; the legal route still completes twelve chapters and twenty-five encounters in 231 player turns. Core rules, campaign data and storage modules are byte-identical to 0.1.0. Detailed measurements and test limits appear in `docs/aesthetic-verification.md`.

## 0.1.0 — 2026-10-11

Initial complete campaign implementation.

- Twelve chapters and twenty-five playable battle and Contest encounters, from recruit training to the imperial accession.
- Original Danube-to-Rome narrative, recurring cast, signalled character fates and replacement branches, consequential choices, historical source notes, and an epilogue that recalls the early campaign.
- Shared browser/Node tactical rules with legal actions and previews, autonomous allies, earned command capacity, formations, morale, and preparations.
- Grid-based political Contests with deadline voting, stance, Resolve, seven speech abilities, and recorded promises.
- Milestone-derived Senate and finale locks, provincial allocation and judgment, three campaign meters, a finale forecast, and playable confrontation routes with costly recovery backing.
- Code-drawn isometric mosaic battlefields, evolving portraits and insignia, fresco camp panels, responsive controls, keyboard targets, optional generated sound, and reduced-motion settings.
- Encounter snapshots, validated autosaves, mirrored browser storage, portable save codes, and an end-of-campaign reign card.
- Dependency-free native JavaScript modules, a static build and preview server, generated offline cache, web-app manifest and icons, and one configurable public site address.
- A Node rules test suite and legal-command campaign autoplay harness, kept separate from development-only scenario injection.

The target playtime and subjective quality require human playtesting. Live custom-domain publication, real iOS/Android installation, device share sheets, and long-term offline/save retention require owner-side deployment and physical-device checks. Verification results are reported separately from these implementation notes.

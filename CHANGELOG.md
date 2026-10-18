# Changelog

## 0.27.0 — tactical formation counter-play (Cuneus & Testudo), live chamber whip forecast, 3D/2D morale spectacle, camp War Council, after-action chronicle and customizable Reign Cards

- **Cuneus & Testudo**: adds [`enemyFormationLinks`](src/core/battle.js) to render enemy cohesion tethers in 3D ([`stage-readout.js`](src/showcase/stage-readout.js)) and 2D ([`battle-art.js`](src/ui/battle-art.js)), and enriches [`combatBreakdown`](src/core/battle.js) and [`combatModifiers`](src/showcase/stage-readout.js) with explicit `formationBreak` / `formationBreakLabel` chips (`Wedge splits shield wall`, `Flank breaks shield line`).
- **Calculus Curiae**: adds [`coalitionWhipForecast`](src/core/contest.js) and updates [`coalitionPanel`](src/ui/tactical-intel.js) to highlight current supporters **At Risk** from rival speakers' next-turn lobby intentions (`.vote-seat.at-risk`) and list **1-speech flips** in reach.
- **Signa & Terror**: adds expanding golden shockwave rings (`radius: 2.6`) for `Rally` and `Inspire` in 3D ([`stage.js`](src/showcase/stage.js)) and 2D ([`battle-effects.js`](src/ui/battle-effects.js)), plus shaken (`<= 40`), broken (`<= 20`), and pledged-cohort base rings (`updateMoraleRings`, `baseMarker`).
- **Consilium Castrorum**: adds [`warCouncilAdvisories`](src/ui/campaign-upgrade-views.js) and [`warCouncilPanel`](src/ui/campaign-upgrade-views.js) in camp so present companions (`Varro`, `Lucan`/`Sabinus`, `Crispus`, `Aelia`, `Paullus`) provide character-voiced counsel on the chapter's decision and upcoming encounter.
- **Acta Diurna**: adds [`encounterDebrief`](src/ui/tactical-intel.js) to [`resultRecord`](src/ui/tactical-intel.js), surfacing Distinguished Service citations, key Turning Points from the encounter log, and concrete Defeat Diagnostics & retry guidance when an encounter is lost.
- **Monumentum Aeternum**: adds selectable Reign Card **Monument Themes** (`REIGN_CARD_THEMES`: *Imperial Purple*, *Senatorial Marble*, *Legionary Bronze*) and automatic **Service Laurels** (`reignLaurels`) in [`renderer.js`](src/ui/renderer.js) and [`panels.js`](src/ui/panels.js).

## 0.26.0 — player-control overhaul, unavailable-action diagnostics, formation roster preview and chamber/allocation clarity

- Adds [`actionCostLabel`](src/ui/direct-controls.js), [`explainActionTargetGap`](src/ui/direct-controls.js), [`explainUnavailableActions`](src/ui/direct-controls.js), and [`unusedTurnSummary`](src/ui/direct-controls.js) so every action button states its exact cost (`1 move`, `1 action`, `1 order`, `1 speech`, `1 javelin`, cooldown, promise limit), empty-target states explain why no target is in reach, `#command-named-controls` and `#command-coaching` (`What can I do?`) explain why unavailable capabilities cannot be used right now, and `#end-turn` summarizes any remaining moves, actions, speeches, or command orders.
- Adds [`formationRosterPreview`](src/ui/direct-controls.js) to `Formation` order previews in Chapters V+, explicitly naming up to 3 adjacent allies who will join (`Joining shield-wall (N/3): …`) and any nearby allies excluded (`already ordered this turn`, `more than 1 tile from anchor unit`, or `3-unit formation cap reached`).
- Clarifies political Contest rules in [`coalitionPanel`](src/ui/tactical-intel.js) and [`encounterView`](src/ui/encounter-view.js): defines **Resolve** (*"speaking stamina; 0 withdraws from speaking, vote remains"*), states that votes are counted at the deadline (`end of turn X`; an early majority does not end the debate), displays [`delegateAppealSummary`](src/ui/direct-controls.js) (`Strongest appeals: …`) for each delegate's interest and bloc, and adds `Inspect` (`data-cmd="inspect-delegate"`) buttons to the chamber delegate roster.
- Adds [`allocationDraftPreview`](src/ui/campaign-views.js) and four preset buttons (`Balanced 2·2·2`, `River focus 4·1·1`, `Farms focus 1·4·1`, `Town focus 1·1·4`) to Chapter X camp preparation, showing live `N / 6` validation and exact Supplies, Army/Public/Political meter, road morale, store integrity, and Landholder tribunal stance effects before dispatching.
- Updates keyboard arrow-key navigation on `#battle-board` to visibly update `#board-hover` alongside screen-reader announcements, and binds 3D camera shortcuts (`F`, `Home`, `+`, `-`, `H`) in campaign encounters. See [controls overhaul verification](docs/controls-overhaul-verification.md).

## 0.25.0 — Lux Imperii HDR post-processing, dynamic 3D water, subsurface foliage, physical armor shaders, volumetric fire and 2D Tabula Picta

- **Lux Imperii**: upgrades the 3D post-processing shader in [`scene-compositor.js`](src/showcase/scene-compositor.js) with single-pass HDR specular bloom, Contrast-Adaptive Micro-Sharpening (CAS), depth-aware atmospheric aerial perspective, and a subtle warm Roman fresco edge vignette.
- **Flumen & Vadum**: adds custom animated GLSL vertex/fragment water shaders in [`environment-surface-shaders.js`](src/showcase/environment-surface-shaders.js) with dual-rippling normal waves, Fresnel sky reflection, shallow-ford shoreline foam, and concentric rain ripples.
- **Ventus & Marmor**: adds wind-swaying foliage vertex displacement with warm backlit subsurface scattering, wet micro-puddle specular ground reflections during rain/marsh scenes, and procedural Cipollino/Carrara veined marble with polished floor reflections in Senate and council chambers.
- **Lorica & Paludamentum**: enriches [`actor-surface.js`](src/showcase/actor-surface.js) with anisotropic brushed iron/bronze metallic sheen (`sheen`, `clearcoat`) on Roman armor and helmets, velvet-like rim sheen on tunics and imperial purple cloaks, and harmonic vertex wave flutter on cloth banners and vexilla.
- **Ignis & Ferrum**: adds 3D volumetric rising ember/flame plumes on braziers and torches, multi-segment projectile ribbon trails on javelins and arrows, and persistent ground scorch/scuff decals in [`stage-particles.js`](src/showcase/stage-particles.js).
- **Tabula Picta**: upgrades the 2D tactical canvas ([`renderer.js`](src/ui/renderer.js), [`battle-art.js`](src/ui/battle-art.js), [`world-art.js`](src/ui/world-art.js)) with isometric 2D fieldwork sprites (`stakes`, `rampart`, `brazier`), diagonal crimson hatching on inspected enemy threat envelopes, time-of-day color grading overlays, and 2D weather particles.

## 0.24.0 — legionary fieldworks (Munitiones), war-room mutators, 3D Aquila & Cornu brass, Oculus Tactica threat envelopes, Rostra interjections and Cursus Honorum monument

- Adds **Tactical Field Engineering (`Munitiones`)** in Chapters IV+ (`stakes`, `rampart`, `brazier`), allowing the commander's engineering detachment to erect one fortification per battle that modifies `combatBreakdown` (negating cavalry charges, adding +2 wall defence, or +1 ranged fire damage) and renders in 3D and 2D.
- Adds **Archive War-Room Mutators** (`difficulty`, `weather`, `timeOfDay`, and Chapter XII `route`) to sandbox Archive replays without altering the primary campaign save.
- Adds **3D Legionary Aquila & Signum standards** with golden eagles, phalerae medallions, and crimson vexillum cloth on commanders and formation leaders, paired with synthesized **Roman Cornu & Buccina brass horn cues** (`rally`, `formation`, `fieldwork`).
- Adds **Oculus Tactica** (`combatBreakdown` modifier chips and `threatEnvelope` reach/target readouts) in the command inspector and 3D stage.
- Adds **Named Senate Delegate Interjections** (`delegateCallout`) and a **3D Marble Rostra Speaker's Dais & Curia Bench Tiers** in political Contests, plus an interactive **Cursus Honorum Monument** (`cursusHonorum`) in the character dossier.

## 0.23.0 — Archive of the Reign sandbox, dynamic 3D weather & night-march torchlight, veteran commendation ranks, interactive Tabula and Senate precedent motions

- Adds **Archive of the Reign** (`archiveEncounters`, `createArchiveReplay`) in the Mission Journal and Accession Epilogue so any completed battle or political Contest can be replayed in an isolated sandbox session.
- Adds **Dynamic 3D Weather & Night-March Torchlight** (`weather`, `timeOfDay`, `buildWeatherParticleSpecs`, `pointLights`) across all 25 encounters (rain, mist, desert dust, siege embers, and flickering night-march/dusk torchlight).
- Adds **Veteran Commendation Ranks & Evocatus Mastery** (`veteranRank`: *Gregarius → Immunis → Principalis → Evocatus*), granting passive mastery bonuses at 2+ and 4+ commendations, 3D crest/torc insignia, and contextual companion callouts (`companionCallout`).
- Adds an **Interactive Imperial Command Tabula** (clickable SVG theatre nodes and expandable theatre dossiers in the Campaign Map) and a **Turn-Step Scrubber** (`#turn-scrubber`) for reviewing recent turn events on the board.
- Adds **Senate Career Precedent Motions** (`precedentOptions`, `invokePrecedent`) in Chapters VII–XII Contests, allowing players to invoke earned military, provincial, or fiscal milestones once per Contest.

## 0.22.0 — 3D ground paths, multi-unit forecasts, opponent intent arcs, custom Order destinations and Imperial epilogue record

- Adds 3D ground movement path polylines (`stagePreviewPath`), action-intent target ring color coding (`targetRingColor`), a directional facing chevron on `selectedRing`, and 3D formation cohesion links (`kind: 'cohesion'`) between adjacent friendly units sharing an active formation.
- Adds multi-unit 3D floating forecast badges (`previewBadges`) across all units affected by `Formation`, `Rally` (including defection morale thresholds), `Address`, and `Threaten` (including `-1 stance` bloc backlash).
- Projects a crimson 3D opponent intent arc (`kind: 'intent'`) from an inspected enemy soldier or rival speaker toward their authoritative `unit.intent` target or objective.
- Exposes engine-supported custom `Order` advance coordinates (`allyDestinations`, `#order-destination`) in `encounterView` so players can direct ordered allies onto specific flanking or high-ground tiles.
- Adds a `Speed 1×` / `Speed 2×` 3D playback toggle (`data-cmd="camera-speed"`) and click/`Space` fast-forward acceleration during active 3D animations.
- Updates the shareable Reign Card header in `drawReignCard` to `I M P E R I U M` and adds an **Imperial Archive · Service Summary & Company Roll** section to the Chapter XII accession epilogue.

## 0.21.0 — 3D pre-action forecast badges, specialist foley and camp progression clarity

- Adds floating 3D pre-action forecast badges (`previewBadge`) directly on the targeted unit's 3D world label during order previews across both the main campaign and standalone 3D showcase (`−4 HP · Flank`, `Ward −2 dmg`, `+20 morale · +1 HP`, `+3 stance (-1 → 2)`, `Support 3 → 5`, `-4 Resolve`, `Blunt speech`).
- Adds distinct synthesized foley plans (`guard`, `inspire`, `agreement`) to `battleSoundPlan` and `combatCues`, plus subtle 3D shimmer on active Protector `Guard` ward and `aim` arcs when reduced motion is off.
- Auto-opens `veteranAcademy` in camp when any veteran is eligible for permanent specialization (surfacing the ready count in the summary) and auto-opens the compact camp `relationshipLedger` when an open agreement is `dueNow`.
- Adds `order` and `conversation` motions and a `Head gaze` (`#gaze`) slider to the standalone character inspector (`tests/actor-model-browser.html`).

## 0.20.0 — expressive gaze, 3D tactical wards and Chapter I budget headroom

- Adds weighted eyebrow bones (`left-brow`, `right-brow`) and deterministic `actorExpression` posture across speech, rally, combat drive, bracing, and injury states, plus multi-syllable jaw articulation and bounded head gaze targeting (`gazeYaw`, `gazePitch`) toward inspected or addressed figures.
- Adds 3D on-stage Protector `Guard` ward tethers, Ranged `Volley` / javelin preview arcs, operation phase objective prefixes (`Phase 1` / `Phase 2`), and automatic overview camera re-centering when a multi-phase operation advances.
- Normalizes line endings in `dist/` and strips non-license JSDoc blocks from bundled `dist/vendor/three/` modules during build, reclaiming ~159 KB of Chapter I compressed budget headroom (`7.84 MB` / `8.00 MB`) across Windows and Linux while preserving all source files and provenance checks.

## 0.19.0 — more natural faces

- Fits almond eye openings to imported anatomy and clips irises without folded triangles. Upper eyelids blend between the moving lid and fixed head; eye corners remain anchored during blinks.
- Replaces raised eyebrow tubes with tapered hairs, preserves skin highlight contrast, and adds restrained mature cheek and facial-fold shaping.
- Feathers beard and scalp boundaries, adds fuller moustache coverage, and retains finer strands in the imported short-hair cutout.
- Adds seven regression checks and a closed-eyelid control to the development inspector. The full 569-test regression and 13 asset/worker checks pass; legal autoplay completes 25 encounters in 217 turns. See [final validation](docs/release-validation-v019.md).

## 0.18.0 — fitted characters and wearable equipment

- Fits complexion textures to the original UVs of imported male and separate female anatomy. Shapes exposed neck rims to sit within collars and fits helmet openings around the imported head.
- Adds one locally bundled CC0 short-hair model and cutout texture for eligible male figures, with per-identity fitting and tint. Bound female hair remains original fitted geometry; the new asset is shared rather than a collection of individual haircuts.
- Gives cloth, leather, mail, scale and metal distinct normal and roughness response. Preserves the eyes' physical-material settings through batching so their highlights remain controlled.
- Replaces separate sleeve caps with a connected, weighted tunic or armor shell, including shaped folds and turned collar/cuff edges. Rebuilds hands with shaped palms, tapered fingers, opposing thumbs and subtle nails, and boots with fitted insteps, toe boxes, sewn panels and separate soles.
- Adds small overview hand/boot meshes that retain the same silhouette, weapon-grip space and foot-contact plane. Temporary geometry, shared textures and skeletons have explicit ownership and disposal; construction does not consume gameplay randomness.
- Leaves gameplay rules, campaign content, saves and committed action timing unchanged. The [v0.18 release record](docs/release-validation-v018.md) records 562 full-regression tests, 78 final actor checks, 6 final surface checks, 25 browser scenes / 518 assertions, 63 targeted browser assertions and 13 asset checks. Production revision `a0dbf383f33b` passes the download budgets. A server-stopped Chapter VI reload and normal Continue action preserved the exact portable save code after the full offline download. Physical-device and independent human testing remain unperformed; geometry counts do not establish performance.

## Historical 0.17.0 — veteran paths, recurring negotiators and fitted anatomy

- New chronicles offer 22 authored operation alternatives across eleven encounters. Branches change objectives, routes or protected parties; a clean victory earns the stated resources and a one-use later-field benefit. Versioned progression preserves older chronicles and complete retry checkpoints.
- Veterans with two deployments can choose a permanent Protector, Formation leader or Ranged specialist path from Chapter III. Guard, Inspire and limited Volley actions carry explicit command, turn and attribute tradeoffs.
- Nine named representatives recur across six political Contests. Demands and counterproposals exchange immediate stance for a later supply payment; honored or broken agreements alter trust and later starting stance. Agreements stage until encounter commit and remain separate from existing Promise obligations.
- Adds an optional opening field guide based on legal commands and authoritative previews, with camp and chamber panels exposing training, branch rewards, negotiated terms and payment eligibility.
- Fits locally bundled MakeHuman CC0 male head, neck and exposed-arm anatomy to the existing skinned identity rig, with the original procedural fallback. Female figures, clothing, armor, hands, legs, equipment and horses remain original project models. Weapon-specific authored joint clips coordinate sword, spear, mounted, throw and reaction poses; no motion capture is introduced.
- Adds inhabited frontier/wetland/eastern settlements and civic architecture, plus private-material scenery cutaways for Follow, Horizon and action framing. Unit and objective labels avoid the selected body's projected rectangle. Authoritative terrain and movement remain unchanged.
- Defers the imported model with shared chapter 3D assets, compresses active terrain materials without repainting, and adds optional bounded drawing-buffer adaptation from asynchronous GPU elapsed queries. Interface text remains at normal resolution. Existing audio recordings are unchanged.
- The [v0.17 validation record](docs/release-validation-v017.md) records 510 passing Node tests, 25 browser scenes / 518 assertions, 63 targeted assertions, 21 dedicated GPU checks, 13 asset/offline checks, 11 isolated browser progression checks, two legal 25-win routes and exact previous-version command/retry compatibility. Production revision `9faf31555b45` meets the declared download budgets. Normal progression controls and server-stopped Chapter I continuation preserved their stated transactions/save; physical-device and independent human testing remain unperformed.

## 0.16.0 — foliage, character form and depth lighting

- Replaces sparse leaf polygons with original alpha-tested foliage sprays, fuller branching trees, curved palms and blended soil verges. Structural camera obstacles remain solid while Follow can ignore leaf-card bounds.
- Rebuilds facial contours, connected shoulder/limb profiles and fitted armor; welds sculpted seam normals and opens helmet/coif guards around the face. Existing skeleton, equipment, foot contacts, legal positions and animation remain authoritative.
- Adds a bounded linear HDR color/depth target and fullscreen contact-shading/edge-smoothing pass for Balanced/High. Reduces broad fill lighting. Handles failed shader linking with a visible direct-render fallback, restores renderer state and releases target resources. Performance remains direct.
- Adds an original foliage atlas and a mechanically optimized character atlas with provenance. Retains the previous atlas in historical assets/full download but excludes it from active chapter downloads; the existing 2/8/24 MB compressed delivery gates remain unchanged.
- See [v0.16 validation](docs/release-validation-v016.md) for automated, GPU, campaign browser, offline/save and measured desktop evidence. No gameplay core files change in this release.

## 0.14.1 — Imperium

- Renames the game and current project documentation to **Imperium**, with the repository at `obeidpeter/Imperium`.
- Preserves existing save identifiers and portable formats. Earlier verification records, exact artwork prompts and supplied source filenames retain their original names; the Roman military oath remains *sacramentum*.

## 0.14.0 — character and material quality

- Adds weighted skeletal surfaces across original character, clothing and horse joints, with bounded cloth deformation, deterministic seeking and preserved equipment/foot contacts. These are repository-authored procedural figures and poses, not imported character assets or motion capture.
- Matches walking and mounted strides to distance travelled, retimes a cloned 3D presentation sequence with 550–2,400 ms movement and a 1.65 action-time scale, and preserves release/contact/cue dependencies. Anticipation, recovery, directional shield blocks/reactions and surface-aware foot/hoof/wade sound improve action readability without changing the committed rules result.
- Prevents withdrawn figures or reused troop names from receiving another unit's animation, prefers the current living tile occupant for effects, and limits skinned picking to actually visible surfaces.
- Generates sky-aligned HDR reflection lighting locally once per scene or quality change. Pooled soft ground/sole contacts and deterministic pose-anchored impact particles complement existing directional shadows and action effects; no new texture download or external service is introduced.
- Refines shared scenery with smooth boulder normals, compound palms, tapered branches, low verge plants, fluted columns, jointed arches and material weathering. Balanced/High masonry gains beveled edges while Performance retains simpler blocks. Authoritative terrain, camera clearance and horizon/river joins remain the presentation boundaries.
- The [version 0.14 verification record](docs/character-quality-verification.md) documents 401 passing tests, legal 25-encounter completion, eleven asset/offline protocol checks and 25 browser scenes / 518 assertions in two batches. Ordinary production play completed the drill and retained exact save equality through camera/view changes and reload. It records actual timing, the vendor precision warning and unperformed device, human and fresh browser-offline checks.

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

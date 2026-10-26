# Campaign world upgrade

The owner requested implementation of all eleven recommendations on 26 October 2026. This work builds on `main` at `5462eba`; the earlier worlds-and-gameplay plan is context, and delivered code and verification remain authoritative.

## Delivery scope

- [x] World-first camp, battle and chamber interface, with contextual controls and accessible briefings.
- [x] Fortifications whose gate, breach, engineering and elevated positions agree with navigation and combat.
- [x] Persistent hero/cast identity on generated bodies and expressive performances.
- [x] Varied, weighty combat, wounded and morale performances; coordinated mounted presentation.
- [x] Regional foliage, moving water, camera-local weather, wind, fire and smoke.
- [x] Distinct mission problems and meaningful later army composition.
- [x] Enemy plans informed by observed battlefield conditions.
- [x] Operational consequences between encounters and explicitly signalled partial outcomes.
- [x] Later-chapter companion/camp stories with visible follow-through.
- [x] Political and finale consequences reflecting the player's career.
- [x] Richer contextual sound and distinct oath/accession presentation.

## Integration and qualification

Chapter V is the first integrated siege review. Shared systems then cover all twelve chapters, with authored regional and mission differences. The deterministic command boundary, exact retry, old chronicle compatibility, permanent-fate safeguards, historical setting and finale recovery floor remain requirements. New saved state is bounded and validated. Visual scenery must agree with collision and elevation; presentation does not consume simulation randomness.

Preserve the 2 MB first-load, 16 MB Chapter I 3D, 24 MB per chapter and 80 MB complete-download limits. Validate meaningful rule regressions and full legal campaign paths, production assets, Chromium smoke, usability, twelve-chapter and twelve-camp coverage, and stage budgets. Browser automation and local Windows observations do not qualify a physical phone or first-time-player experience. Those checks remain separately identified until actually performed.

No new Tripo purchase or credit allowance is inferred from repository prose. Existing generated assets, reproducible local art and available tools are the starting point.

## What changes in play

The camp, field and chamber give the world the main area of the screen. Briefings, career records and optional stories sit below it. Follow, overview and horizon views share one camera selector; the 2D option remains available. Required departure tasks stay visible, and optional company stories do not become new departure requirements.

Fortified fields use the same saved cells for walls, closed gates, rubble, navigation and sight. Troops reach fighting platforms by their stairs. Closing a gate clears old routes but retains the orders: soldiers wait and resume when a route opens. Occupied gateways cannot close. A breached wall remains an opening for either army. Chapter V adds a countermine and siege ramp whose pressure damages the defended line if left active. Two uninterrupted work actions secure each; a nearby engineer or earned engineering support reduces that to one. Disabling the ramp can delay the next reserve without ever bringing a late reserve forward.

The hero keeps the shipped generated recruit head across later uniforms and ranks. Named male faces receive distinct proportions and age, with actual facial morph targets rather than an additional painted face. Wounds, morale and combat contact affect the performance, and mounted units coordinate their riders with the horse gait. Finale crowds use a reproducible reduced mesh. Existing editable fallback character GLBs are re-exported from the new code.

Regional tree species and palettes, channel-aligned water highlights, local rain/dust/mist/embers, shared wind and a combined flame/smoke effect extend across the existing scenes. Environmental sound and material-sensitive weapon effects use the existing audio controls and bounded resources. The oath and accession retain distinct staging, cast and ceremonial treatment.

From Chapter IV, enemy squad plans weigh observed bracing, exposed flanks, isolated or weakened formations, archers and mission pressure. Hidden actors are not a source of tactical knowledge. Later armies gain engineer details or mounted support by replacing an existing allied formation, preserving its identity and strength. This changes the choices within existing authored missions; it does not add twelve new mission modes.

Clean reconnaissance, stores and reserve operations affect the next real-time field through a passage or revealed position, a repaired bridge or longer opportunity window, or stronger escorts and cohesion. Winning a siege with both works secured and the company intact earns engineering support for the next field. Reports distinguish unfinished work, missed opportunities and withdrawn formations. Losses do not grant this reward, and commit/retry cannot duplicate it.

Nine optional company stories across Chapters IV–XII have two previewed choices apiece, a later report and a career acknowledgement. They respect Lucan's and Varro's established fates. Political representatives respond to the appropriate committed service evidence. Two clean reconnaissance operations and two honoured military agreements can each prevent one rival reserve from reaching the final battle; the existing recovery floor remains intact.

## Chapter coverage

Shared camera, character, weather, sound and accessibility work applies throughout. Each chapter keeps its existing authored geography and missions.

| Chapter | Tactical emphasis and regional treatment | Added campaign content |
| --- | --- | --- |
| I | Road patrol and recruit watch; oak, beech and willow | Persistent recruit identity; distinct oath staging |
| II | Wounded escort through the causeway; willow/alder and local mist | Existing rescue consequences retained |
| III | Courier screen and archive recovery; woodland and pine | Existing courier pursuit and recovery objectives retained |
| IV | Gate and relief route; temperate fortifications | Engineer detail; *The second watch* |
| V | Siege sortie, countermine and ramp; palm/tamarisk and dust | Engineer detail; *Names in the shade*; engineering aftermath |
| VI | Eagle withdrawal and pursuit; dry retreat country | *What the baggage carries*; Varro-dependent recollection |
| VII | Refused wings and counterattack; Italian trees and command street | Mounted support; *A voice below the officers* |
| VIII | Civilian ferry and crossing; riverside willow/alder and rain | Engineer detail; *The ferry token* |
| IX | Mounted counterstroke and city approach; palms and eastern porticoes | Mounted support; *The surrendered workshop* |
| X | Grain route and exposed stores; pine/fir/beech | Engineer detail; *The measure of grain* |
| XI | Civic testimony in Rome; cypress, umbrella pine and olive | Service evidence; *The unpolished witness* |
| XII | Rival reserves and recognition; Roman command court | Mounted support; *A name beneath the titles*; career-sensitive reserves and accession |

## Compatibility and limits

- Real-time world version is now 4. Older active real-time battles restart from their saved departure checkpoint; earlier campaign progress remains. Existing turn-based compatibility fixtures still apply.
- New engineering and field-report records are bounded and validated. Simulation randomness is separate from presentation; saved continuations and exact retry remain deterministic.
- No new Tripo generation or paid asset purchase was used. Existing generated assets and reproducible local geometry supply this release.
- The horse remains an authored stylized model. Injury and morale change upper-body bearing over existing locomotion; they do not supply new limping clips. Generated heads retain their source short haircut, while complete hairstyle customization remains on the fallback figures. Facial motion is procedural, not recorded acting or phoneme animation. Finale crowd breathing is a shader effect. Wind/water effects are presentation cues, not a fluid simulation. These are substantial improvements within the browser game's current asset pipeline, not a claim of completed photorealistic production.
- Windows Chromium software rendering checks correctness, resources and regression ceilings. It does not establish hardware frame rates or replace physical-phone tests, subjective audio review, or first-time-player playtesting.

## Evidence

Local qualification is complete, with final production revision `70b2900b2b61`. Revision `e3be16669410` supplied the legal campaigns, initial browser, immersive-layout and Chapter V pilot checks. Revision `7cdb3f5a160e` corrected a collar intersection and combined siege guidance with the existing optional-objective readout; it supplied the complete Node suite, controls, usability and twelve-chapter checks. Revision `5767d11fb2b0` shares particle and formation materials while retaining their effects, textures, geometry and shadows; the full stage-resource and settled-camera siege suites pass on that revision. The final revision only lowers the positive transparency cutoff for mist and dust, restoring soft edges without changing shader source, program flags, geometry or gameplay. Its complete twelve-camp suite passes. These are explicitly combined results, not a claim that every suite ran on one hash. Earlier interrupted runs are diagnostics, not acceptance evidence.

| Check | Result |
| --- | --- |
| Complete Node test suite (`7cdb3f5a160e`) | 1,330 passed; zero failures, cancellations or skips |
| Final material and character regressions | 41 particle/graphics checks, 63 character/formation checks and the existing material-finish regression pass; includes soft weather falloff, shared shader source, independent uniforms, retained geometry/shadows and texture disposal |
| Legal campaign autoplay | 15 complete campaigns, 375 won encounters, all twelve chapters; all reached Augustus |
| Production approaches | Balanced, breach, diversion and advance; 25 exact retries each |
| Chromium browser smoke | All 20 scenarios pass: 19 in the full run, plus the six-hearing scenario after correcting its legal-command recording policy; exact votes and every voter stance remain asserted |
| Real-time controls and completion (`7cdb3f5a160e`) | 20 checks pass, including the corrected siege/optional-opportunity readout |
| Usability (`7cdb3f5a160e`) | All nine flows pass; normal run, diagnostics off, original 30-second action timeout |
| Immersive layouts and company stories | 15 cases pass at desktop, narrow viewport and 200% text |
| Chapter V courtyard/river-gate pilot | Nine checks pass, including peaceful inputs, decisions, departure and exact retry |
| Actual real-time 3D siege scenes (`5767d11fb2b0`) | Mine/dust, wall/clear and ferry/rain pass; all nine captures assert a settled camera, two fresh frames, visible controlled-actor head/feet and unchanged paused ticks; zero browser errors |
| Twelve-chapter visual benchmark (`7cdb3f5a160e`) | All twelve chapters pass across 13 scenes, plus five interface/save checks; settled/fresh camera frames, unchanged campaign states and zero browser/runner errors |
| Twelve regional camps (`70b2900b2b61`) | All 21 checks pass: twelve camps, 36 main camera views plus two return/fallback views, 18 screenshots and 16 residency records; every camera settled with at least two fresh frames; zero unexpected errors |
| Stage resource ceilings (`5767d11fb2b0`) | All five scenes at Performance and Balanced pass unchanged draw-call, triangle and shader-program ceilings; zero first-frame or in-play shader compilation, zero browser errors |
| Build, assets and offline behavior | Pass |
| Character assets, performance sources and production audit | Pass; editable fallback GLB handoffs match current source |

The final build's gzip budgets are 862,542 bytes for initial load, 10,069,480 bytes for Chapter I 3D and 31,412,695 bytes for the complete download. The existing ceilings are unchanged.

The resource check initially caught excess shader variants. Weather, fire/smoke, impact sparks and thrown dust now share a program with independent effect uniforms. Generated formation bodies and named heads also share a program using neutral body uniforms. Their geometry, texture inputs, shadows, individual effect behavior and disposal remain covered by regressions. The [final stage measurements](evidence/campaign-world-stage.json) span 76–150 draw calls, 153,807–794,369 triangles and 42–54 programs. Chapter V Balanced meets its 52-program ceiling; Chapter XII Performance draws 372,053 triangles. The failed earlier resource report is retained as diagnostic evidence, not counted as a pass.

Windows verification used Chromium/SwiftShader. The headless shell repeatedly stalled during a desktop reload while the Menu was visible and enabled. Both shell revisions 1228 and 1234 reproduced it; matching full Chromium 151.0.7922.34 passed the same native clicks and unchanged timeout, including a normal full usability run without diagnostic instrumentation. No gameplay workaround was introduced. These local results do not claim a GitHub CI run or physical-device performance.

The twelve-chapter benchmark defaults to Playwright's full Chromium channel in headless mode and records its selected backend. Explicit executable overrides remain supported. This follows repeated CI headless-shell screenshot timeouts on the ready Chapter V wall scene. It uses the same installed browser version, graphics quality, viewports, assertions and timeouts; Linux results still require the corresponding GitHub run rather than being inferred from Windows evidence.

Camera selection changes its label before the actual camera finishes moving. Screenshot harnesses now wait for real settled/fresh-frame evidence, and prior premature captures are not accepted. The campaign benchmark also records read-only inspection of the existing stage rather than altering the camera or game state for a screenshot.

CI includes the new immersive-interface and siege checks. Its usability job allows 45 minutes for the added suites; its twelve-camp job allows 75 minutes for settled camera captures, services, fallbacks and browser installation. Individual action timeouts and graphics/download ceilings are unchanged.

The regional inventory now enables the existing Reduce motion preference through visible Settings and records its application on the live stage. This static capture mode avoids spending dozens of slow software-rendered frames easing toward each camera composition. Camera selection, actual settlement, at least two fresh frames and the 120-second limits remain asserted. The siege suite first verifies normal-motion camera movement in each of its three fields: visible Overview and Follow selections produce advancing rendered frames and finite, changing camera positions while simulation ticks stay paused. It then enables Reduce motion through Settings for the nine static whole-body captures, preserving settlement, fresh-frame, head/feet projection and paused-tick assertions. The stage benchmark retains normal-motion action coverage. These harness adjustments follow CI Overview-camera readiness timeouts. The local evidence above predates these CI harness adjustments; GitHub run results are recorded with the pull request.

The [regional acceptance receipt](evidence/campaign-world-regional.json) records the final camp sweep. It took 51.49 minutes on this Windows software renderer. Performance quality released all generated scenery masters; returning to Chapter I restored its original three loaded entries and leases without accumulation. Nine deliberately failed HTTP 503 model responses still left a rendered, movable camp with working services. The corrected mist and all twelve horizon images were also visually inspected.

Local logs and archived reports are in the parent Codex workspace's `work/world-upgrade-verify/` directory, outside this repository. Screenshots and complete machine-readable browser reports are in `tests/visual-results/`. The repository evidence receipts preserve the resource and regional results without including temporary campaign saves. Physical-phone, first-time-player and subjective audio qualification remain the separately identified follow-up work.

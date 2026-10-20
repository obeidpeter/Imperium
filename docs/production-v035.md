# Version 0.35 — characters, contact and field approaches

This pass starts with Chapter V and uses the shared actor, animation and environment systems throughout the twelve-chapter campaign. It is a concrete production iteration, not a claim that the art has reached an independently assessed “world-class” standard.

## Characters and interchange

Marcellus, Lucan and the Persian infantry guard have editable, full-body GLB handoffs in `art-source/characters/`. Each includes skin joints, face morphs, embedded PNG material maps and four sampled animation clips. The local character workshop imports those files through the same vendored glTF loader. The exports are separate from the player's download; the runtime retains its shared code-authored rig, identity system and distance LODs.

The original complexion colour remains on its existing UV layout. Shared periodic pore normals and pigment-aware roughness add small-scale surface response; a bounded grazing fill softens skin in the existing lighting. These are authored approximations, not scanned skin or screen-space subsurface scattering. Fitted padded necklines, character-dependent cloth folds, formed helmet bowls and different iron finishes distinguish skin, fabric and equipment.

The retained head/arm anatomy is the existing MakeHuman CC0 source. This work does not claim a new specialist sculpt, motion capture or commissioned artwork. The GLB handoff makes that next art-production step practical without replacing the gameplay rules.

## Movement and combat

Travel duration follows route distance and accounts for the peak speed of the existing cubic ease. A long route no longer compresses into the same 2.4-second window as a short one. The existing 2× playback and skip controls remain available. Contact timestamps, dependency ordering, paired weapon/shield contact and authoritative tile positions remain intact.

Two additional authored joint clips add strike recovery and unguarded impact weight transfer. The performance source remains `scripts/character-sources/performance-v034.json`; its historical filename is retained, and the compiler checks its current content. Footfalls follow planted steps for longer paths. Impact, voice and command sounds take precedence over footfalls when the cue budget fills.

The shield hand now turns with the board and holds directly behind its boss. Previously the shield rotated independently through the fingers during guard poses. A geometric regression checks every grip vertex against the shield face across idle, walking, strike, guard and hit poses for infantry, guards and cavalry. The corrected alignment is included in the GLB exports.

## Deployment choices

New games explicitly enable tactics edition 35. Existing command-campaign saves can opt in at camp; active checkpoints and older editions retain their original rules.

From Chapter III, before a field encounter, a player can combine an operational preparation with one approach:

| Approach | Cost | Benefit | Tradeoff and enemy response |
| --- | ---: | --- | --- |
| Direct deployment | 0 | Existing deployment | Existing doctrine |
| Engineering | 2 supplies | Open gates, repair bridges, +10 defence | Commander march −1 in rounds 1–2; enemy archers prioritize the commander |
| Diversion | 1 supply | Pending reinforcements delayed two rounds | Company cohesion −8; one visible enemy investigates the false approach through round 2 |
| Defensive advance | 0 | Start braced, cohesion +12 | Commander march −1 in rounds 1–2; enemy cavalry and raiders attempt the flank |

Costs include the company package and operational preparation, are checked together before departure, and are paid after the complete camp checkpoint. Retry restores that checkpoint and reapplies costs exactly once. The free approach remains selectable when the others are unaffordable. Like the operational preparation, an approach covers one field encounter: since 0.35.1 the next camp starts from direct deployment, so a costly approach is never charged again without being chosen. Approaches do not replace political cases in the civic chapters, unlock chapters, or guarantee that one tactic wins every mission.

`node scripts/production-autoplay.mjs` runs four legal campaigns through all 25 encounters. It separately completes both Chapter V encounters with each alternative approach and continues each campaign through Chapter XII. This establishes repeatability and solvability of those routes, not human balance approval.

## Composition and diagnostics

Chapter-specific landmark groups occupy three bearings beyond the playable board: siege aqueducts, frontier towers, settlements, colonnades and temples. They share the distant geometry batch and stay within the existing 15,000-triangle horizon budget. The urban skyline remains distant and low.

Close camera views hide incidental labels while retaining the selection, pointer/focus target, current effects, votes and nearby enemies. Overview retains the full tactical readout. Named controls remain available below the battlefield.

The frame report identifies the WebGL backend when the browser permits it and explicitly distinguishes a software renderer or a masked identity. It reports real multi-second stalls instead of excluding them from cadence statistics. No hardware identifier or frame report is sent over the network.

## Acceptance and remaining external checks

The automated checks cover old-save compatibility, exact Retry, truthful combined costs, finite transforms, GLB round-trip animation, shader construction, resource ownership, geometry budgets and the full campaign. The Chromium smoke and twelve-chapter screenshot benchmark run against a production build. `scripts/record-production.mjs` additionally selects an approach through the real UI and records normal-motion Chapter V turns.

The user approved Windows testing now and will arrange phones and first-time players later. Software Chromium videos and viewport emulation must not be labelled physical-device performance. Desktop measurements should record the actual backend, resolution, quality, adaptive scale and frame intervals with competing test processes stopped.

The observed Windows backend is Intel graphics through ANGLE/D3D11. At a 1032 × 665 render resolution, a quiet Balanced horizon sample averaged 16.66 ms with a 16.9 ms p95. A subsequent normal-motion turn/settlement window averaged 29.58 ms, with a 50 ms p95 and a 383 ms stall. The quiet view reaches 60 fps; combat is not yet certified at a sustained 60 fps. The exact settings, sample sizes and limitations are in `docs/evidence/windows-v035.json`.

The Windows check also exposed an unsafe actor replacement during a live quality change. Replacement now constructs and mounts the candidate before retiring the visible figure. Failure-path tests retain the old actor, and the recording script exercises both Performance and Balanced rebuilds on an already-loaded battle.

Animation snapshots now retain the complete detached encounter, including field objects, operation state and veteran details. Previously the reduced motion-data subset replaced the scene's encounter during playback and could remove gates and bridges after a command. The regression test checks rebuilt field geometry and bridge support, and the browser recording checks field-object counts after every turn.

For the later device/player session:

1. On each physical phone, start a cold session; record model, browser, quality, loading time and thermal state. Play both Chapter V encounters for at least ten minutes, then repeat a civic chapter.
2. Record frame interval median/p95/worst, resolution scale, context loss, memory growth after repeated chapter changes and input response. Targets remain 60 fps on the selected desktop tier and 30 fps on the selected phone tier; a completed benchmark alone does not establish either.
3. Give first-time players the objective without coaching. Observe whether they understand movement versus action, forecast versus commitment, approach costs, enemy intent, retreat and Retry.
4. Compare all three siege approaches for completion time, losses, remaining supplies, unused commands and perceived fairness. Capture mistakes and confusion, not just wins.
5. Watch normal-speed recordings for floating feet, shield/weapon intersections, sliding, stiff stops, unreadable silhouettes, label obstruction and audio lag. File issues with the exact save code, command and camera.

## 0.35.1 follow-up

0.35.1 makes an approach cover one field encounter (the next camp starts from direct deployment), gives a rider withdrawn by the counter blow the usual withdrawal shock, and fixes four presentation details: remains on a repaired deck, the figure-style swap, footstep thinning and the signal flag's shared materials. `npm test` no longer requires the handoff GLBs to match the character code; `npm run audit:handoff` reports a stale export. See the [changelog](../CHANGELOG.md#0351--one-battle-per-approach-a-handoff-that-no-longer-blocks-the-tests-and-smaller-fixes).

Checked, and how:

- **Automated:** `npm run verify` passed on Linux with Node.js 22.22.0. It ran 777 Node tests, the legal-command autoplay, and the expanded, command and production campaigns; the four edition-35 campaigns each reach Augustus with 25 exact Retries. It also ran the production build, the asset and offline checks, the character audits and the handoff notice (current). Download sizes: shell 481,240 bytes, shell plus Chapter I 7,989,151 of 8,000,000 (10,849 left), complete campaign 11,339,391.
- **Real interface, scripted:** `npm run smoke` drove the production build in headless Chromium with software rendering (SwiftShader, Playwright 1.56.1). It covered the desktop drill, the expanded Chapter V field and touch at phone width, plus a new step: on a legally reached Chapter V camp restored through the Restore dialog, the engineering approach is chosen on the camp table, the field intelligence names it, and the side gate reads open. There were no page or console errors.
- **Injected or synthetic, and labelled in the tests:** the counter-blow test injects a one-hit-point mounted attacker and companion positions; the approach-reset test marks the battle won to test the commit; the remains test uses a stage without a renderer and fixed heights; the footstep and flag tests use a synthetic timeline and a directly built field kit.
- **Handoff tooling:** the exporter was run once from another directory, with Sharp 0.34.4 on Node.js 22, to confirm that it writes into `art-source/characters/`. The files it produced had the same sizes as the committed ones but different bytes, so they were not committed.

Not checked: real devices or GPUs, the visual result of the presentation fixes, the footstep sounds by ear, a Windows run of the new tests (their patterns accept CRLF line endings) and human playtesting. One legal probe chose the engineering approach at the Chapter V mine and left the wall on direct deployment; the autoplay then lost the wall at its deadline. The autoplay is not a strong player, so this is a prompt for the planned approach comparison, not a balance finding.

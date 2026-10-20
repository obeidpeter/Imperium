# Version 0.35 — characters, contact and field approaches

This pass starts with Chapter V and uses the shared actor, animation and environment systems throughout the twelve-chapter campaign. It is a concrete production iteration, not a claim that the art has reached an independently assessed “world-class” standard.

## Characters and interchange

Marcellus, Lucan and the Persian infantry guard have editable, full-body GLB handoffs in `art-source/characters/`. Each includes skin joints, face morphs, embedded PNG material maps and four sampled animation clips. The local character workshop imports those files through the same vendored glTF loader. The exports are separate from the player's download; the runtime retains its shared code-authored rig, identity system and distance LODs.

The original complexion colour remains on its existing UV layout. Shared periodic pore normals and pigment-aware roughness add small-scale surface response; a bounded grazing fill softens skin in the existing lighting. These are authored approximations, not scanned skin or screen-space subsurface scattering. Fitted padded necklines, character-dependent cloth folds, formed helmet bowls and different iron finishes distinguish skin, fabric and equipment.

The retained head/arm anatomy is the existing MakeHuman CC0 source. This work does not claim a new specialist sculpt, motion capture or commissioned artwork. The GLB handoff makes that next art-production step practical without replacing the gameplay rules.

## Movement and combat

Travel duration follows route distance and accounts for the peak speed of the existing cubic ease. A long route no longer compresses into the same 2.4-second window as a short one. The existing 2× playback and skip controls remain available. Contact timestamps, dependency ordering, paired weapon/shield contact and authoritative tile positions remain intact.

Two additional authored joint clips add strike recovery and unguarded impact weight transfer. The performance source remains `scripts/character-sources/performance-v034.json`; its historical filename is retained, and the compiler checks its current content. Footfalls follow planted steps for longer paths. Impact, voice and command sounds take precedence over footfalls when the cue budget fills.

## Deployment choices

New games explicitly enable tactics edition 35. Existing command-campaign saves can opt in at camp; active checkpoints and older editions retain their original rules.

From Chapter III, before a field encounter, a player can combine an operational preparation with one approach:

| Approach | Cost | Benefit | Tradeoff and enemy response |
| --- | ---: | --- | --- |
| Direct deployment | 0 | Existing deployment | Existing doctrine |
| Engineering | 2 supplies | Open gates, repair bridges, +10 defence | Commander march −1 in rounds 1–2; enemy archers prioritize the commander |
| Diversion | 1 supply | Pending reinforcements delayed two rounds | Company cohesion −8; one visible enemy investigates the false approach through round 2 |
| Defensive advance | 0 | Start braced, cohesion +12 | Commander march −1 in rounds 1–2; enemy cavalry and raiders attempt the flank |

Costs include the company package and operational preparation, are checked together before departure, and are paid after the complete camp checkpoint. Retry restores that checkpoint and reapplies costs exactly once. The free approach remains selectable when a previous selection becomes unaffordable. Approaches do not replace political cases in the civic chapters, unlock chapters, or guarantee that one tactic wins every mission.

`node scripts/production-autoplay.mjs` runs four legal campaigns through all 25 encounters. It separately completes both Chapter V encounters with each alternative approach and continues each campaign through Chapter XII. This establishes repeatability and solvability of those routes, not human balance approval.

## Composition and diagnostics

Chapter-specific landmark groups occupy three bearings beyond the playable board: siege aqueducts, frontier towers, settlements, colonnades and temples. They share the distant geometry batch and stay within the existing 15,000-triangle horizon budget. The urban skyline remains distant and low.

Close camera views hide incidental labels while retaining the selection, pointer/focus target, current effects, votes and nearby enemies. Overview retains the full tactical readout. Named controls remain available below the battlefield.

The frame report identifies the WebGL backend when the browser permits it and explicitly distinguishes a software renderer or a masked identity. It reports real multi-second stalls instead of excluding them from cadence statistics. No hardware identifier or frame report is sent over the network.

## Acceptance and remaining external checks

The automated checks cover old-save compatibility, exact Retry, truthful combined costs, finite transforms, GLB round-trip animation, shader construction, resource ownership, geometry budgets and the full campaign. The Chromium smoke and twelve-chapter screenshot benchmark run against a production build. `scripts/record-production.mjs` additionally selects an approach through the real UI and records normal-motion Chapter V turns.

The user approved Windows testing now and will arrange phones and first-time players later. Software Chromium videos and viewport emulation must not be labelled physical-device performance. Desktop measurements should record the actual backend, resolution, quality, adaptive scale and frame intervals with competing test processes stopped.

For the later device/player session:

1. On each physical phone, start a cold session; record model, browser, quality, loading time and thermal state. Play both Chapter V encounters for at least ten minutes, then repeat a civic chapter.
2. Record frame interval median/p95/worst, resolution scale, context loss, memory growth after repeated chapter changes and input response. Targets remain 60 fps on the selected desktop tier and 30 fps on the selected phone tier; a completed benchmark alone does not establish either.
3. Give first-time players the objective without coaching. Observe whether they understand movement versus action, forecast versus commitment, approach costs, enemy intent, retreat and Retry.
4. Compare all three siege approaches for completion time, losses, remaining supplies, unused commands and perceived fairness. Capture mistakes and confusion, not just wins.
5. Watch normal-speed recordings for floating feet, shield/weapon intersections, sliding, stiff stops, unreadable silhouettes, label obstruction and audio lag. File issues with the exact save code, command and camera.

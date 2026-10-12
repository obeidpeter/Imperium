# Overhaul visual design

This is the implementation direction for the graphics and gameplay overhaul after version 0.6. The reference source is frozen at `work/overhaul-baseline-06/Sacramentum`. It records source observations and the supplied baseline inspection, not a claim that the proposed work has already passed visual review.

## Observed weaknesses

- Painted figures have detailed equipment, but several neighbouring surfaces do not share that standard: rock props are geometric blocks, palms are flat triangles and cover is a small polygon cluster. Walls repeat unbroken box faces. The baseline Chapter 9 inspection also identified the stone and palm mismatch.
- Four broad ground palettes serve twelve chapters. All political encounters reuse the same pale stone and similar seating, diminishing the change from provincial authority to the Senate and imperial coalition.
- Unit markers show affiliation and facing, but every formation has the same underline. Morale and political commitment changes often use the same expanding ring as unrelated abilities. This wastes an opportunity to make the authoritative rules legible.
- The current mesh preserves four authored facings and equipment but damage recoil is not directed away from its source. Command and political effects do little to connect a speaker to the actual recipient.
- Ground is already cached and decorative scenery stays outside playable cells. These strengths should survive the overhaul. The existing complete download is 1,991,422 compressed bytes against a 2,000,000-byte gate, so substantial new bitmap libraries are unsuitable without separate savings.

## Implementation direction

1. **One lighting and material language.** Use warm upper-left light, cool recessed faces and grounded contact shadows. Replace block rocks and flat palms with irregular natural forms; give masonry staggered joints, exposed mortar and worn caps. Keep silhouettes, shadows and outlines subordinate to units and legal targets. Physical surfaces remain derived from actual terrain; no decorative in-board obstacles.
2. **Distinct career environments.** Give each chapter an authored palette and place name. Northern camp, disaster marsh, withdrawal, defensive frontier, eastern siege, river approach, command camp, Danube crossings, eastern column, provincial works, Senate and accession should differ in materials and composition. The political chambers should use increasingly formal stone and coloured inlay, not a universal beige room.
3. **Readable living units.** Retain original local atlases, four real facing crops and historically guided equipment. Use distinct grounded formation glyphs, a stable facing chevron, visible guard state and low-morale cues. Preserve veteran/commander and civilian/senatorial silhouettes. Avoid painting a second weapon or detached limb over the existing image.
4. **Actions with cause and recipient.** Make recoil follow the actual recorded source, replace generic political and command rings with quiet recipient-linked gestures, distinguish allegiance/commitment from damage, and retain bounded anticipation/impact/recovery. No invented attacks, damage, path shortcuts or new gameplay outcomes.

## Integration and constraints

`drawBattle` and the current animation frame API remain compatible. Additional version-2 unit information is optional; old campaign fixtures and imported saves must still render. The renderer reads committed state and cannot consume gameplay randomness or mutate state. Root owns panel explanations, audio, narrative and browser verification; rules agents own combat and political outcomes.

Performance/Balanced/High continue to share essential tactical information. Decoration is bounded, static terrain remains a single cached surface, animation ends promptly, and the existing reduced-motion cancellation path remains authoritative. No runtime dependency, 3D engine, external request, automatic full-campaign download or relaxed asset gate is planned.

## Review plan and honest limits

Use matching early military, eastern, provincial and Senate boards plus all twelve chapter captures. Inspect four facings, mounted and archer actions, wall occlusion, damaged/guarding units, political commitments, phone-sized controls and reduced motion. Run direct-module geometry, purity, atlas, timeline and cache tests, then compare actual browser draw cost and action traces through the existing review harness. Automated draw-call assertions cannot prove visual quality, physical-device performance or enjoyment. These remain separately reported browser and human observations.

## Implemented visual scope

The renderer now uses twelve region profiles, separate provincial/Senate/imperial chamber materials, irregular faceted stone, curved palms, capped and jointed masonry, layered cover and clearer ground contours. These are actual Canvas shapes and locally painted sprites; the board remains a readable tactical abstraction. No elevation rule or picking geometry changed.

Formation bases now differ for line, wedge and shield wall. A held brace has a guard arc and a restrained defensive lean; low morale has a shape-based warning at the existing rule thresholds. Political delegates show commitment steps, a double rim at absolute stance 3 or higher, and a seal only when their ID is in the encounter's real promise list. Exact figures and consequences remain in the interface.

Melee gestures transfer weight toward the recorded target; recoil moves away from the recorded source and settles at the exact authoritative position. Command gestures differ from ordinary speech. Political actions connect the speaker and actual recipient with a short ink stroke, while Resolve damage uses an interrupted-argument cue instead of a physical hit flash. Legacy snapshots remain supported; version-2 paths call the same pure engagement predicate as the rules. The motion snapshot retains the optional combat version and last movement distance.

The four authored facings and existing bitmap identities remain intact. These are still procedural motions of static artwork, not newly authored frame sequences, skeletal animation or 3D. Dead, unreferenced portrait/scene illustration exports were removed; live battle and reign-card fallback rendering remains.

### Verification at visual handoff

All **57 targeted tests passed**: 50 existing atlas, terrain, drawing, motion, cache and readability checks plus seven new direct-module tests in [overhaul-visual.test.mjs](../tests/overhaul-visual.test.mjs). They verify distinct profiles, formation/morale classes, engagement-respecting previews, bounded finite natural forms, source-directed recoil, nonviolent Resolve feedback, guard/command poses and snapshot compatibility. Tests keep the existing atlas crop/handedness, collision/picking geometry and deterministic-state protections. This count is the renderer handoff suite, not a claim about the later full release suite.

The root's matching Chapter 9 browser inspection reported clearer irregular stone, ground contours and colour separation. Final all-chapter, motion and performance evidence belongs in the release verification report; no frame-rate, mobile-device or enjoyment improvement is inferred from passing tests.

### Artwork compression during integration

The integration pass re-exported narrative scene masters at WebP quality 74 (previously 76), and the title at quality 78 (previously 80); portrait quality remains 74. Dimensions, composition and identity were retained. This is **lossy encoding optimization**, not lossless compression, new painting or a legal-rights guarantee. The frozen baseline retains the earlier files, and the asset manifest records current exports. The unchanged compressed first-load and full-campaign gates still apply to the final build.

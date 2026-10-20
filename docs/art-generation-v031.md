# Character artwork — 0.31

*Released in 0.32.0. This was prepared as draft 0.31 before click to walk (0.31.0) was merged, so the file names keep `v031`.*

Generated 19 October 2026 with the built-in OpenAI image-generation tool. The reference was the project's own `assets/tactical/units-roman.webp`. No third-party reference image was supplied. The final runtime image is `assets/tactical/units-roman-v031.webp`; its source/export hashes, dimensions and size are in `asset-manifest.json`.

The sheet depicts a recruit, mail-armoured legionary, veteran officer and senior commander, with four authored views per costume. This is a painted atlas used by the 2D renderer and painted 3D figures, not a new sculpted anatomical model. The existing sculpted figures receive code-authored equipment detail and High-quality cloth sheen separately.

## Exact generation prompt

Use case: historical-scene / identity-preserve. Asset type: production transparent character sprite atlas for Imperium, a grounded third-century Roman tactics game. Upgrade this exact 4-column by 4-row atlas to a premium finely painted realistic game-character sheet. Keep exactly sixteen separate full-body figures, precisely the same grid order, camera directions, body positions, sole anchors, generous transparent gutters and equipment handedness. Same four costumes by row: young unarmoured recruit, mail-armoured legionary, mature red-cloaked veteran officer, senior red-cloaked spear commander. Columns are the exact four existing quarter-view directions: front facing screen-right, front facing screen-left, back facing screen-right, back facing screen-left. Preserve every figure silhouette and fit within its original cell, shield always on anatomical left and weapon on anatomical right. Improve lifelike anatomy, eyes and facial individuality, believable ring-mail, layered linen, stitched leather harness, worn painted oval shields, restrained brass edges and natural cloak folds. Cohesive warm-neutral daylight, grounded historical materials, extremely clear and crisp at small game size. High resolution 1536x2048 or greater with exact 3:4 overall ratio. No text, labels, symbols outside shields, floor, background, cast shadow, glow, extra figures, touching cells, floating equipment or cropped weapons. The background must be genuinely transparent. This is actual runtime artwork, not a concept mockup.

First output: `exec-e0602a08-634c-49f9-aaac-9272fca592d8.png`. The tool returned 1086 × 1448 rather than the requested higher resolution. A second edit corrected spacing.

## Exact correction prompt

Production asset edit. Keep the exact sixteen richly detailed Roman characters, identities, clothing, equipment, directions and four by four grid of this image. Repair ONLY layout and transparency for a usable game atlas. Each of the 16 full figures must be 78 percent of its existing size, centered horizontally within its precise equal rectangular cell, with the soles at 92 percent of each cell height. Strict 4 columns by 4 rows, overall ratio 3:4. Leave a completely transparent gutter on all sides of every cell. Keep ALL sword and spear tips, shields, crests, feet and cloaks entirely inside that character's own cell with at least 10 pixels of transparent air. Remove every stray colored halo and fringe. Do not paint a floor or shadows, do not add text. Preserve the same detailed premium painted materials and faces. Keep real transparent alpha. No content may touch a cell boundary.

Final source: `exec-6774853d-6cf7-476a-ae62-fb7cda5e4900.png`, 1086 × 1448 RGBA. Mechanically encoded with Pillow as WebP, quality 88, method 6: **425,226 bytes**. No creative image alteration was performed outside image generation.

The generated rows are not perfectly equal. `src/ui/roman-atlas.js` records measured boundaries `[0,364,714,1052,1448]` and sole/head anchors, then normalizes drawing into a cached 768 × 1024 canvas. Four facings are selected without mirroring equipment hands. Existing authored animation sequences remain in use where available; uncovered actions use the procedural painted rig.

## Coverage and provenance

`node scripts/audit-character-assets.mjs` audits 768 atlas/costume/facing/action combinations. **24 use existing bitmap sequences and 744 use procedural rig responses**. Those counts are coverage checks, not 768 newly painted animation sequences. Block, assent, dissent and yielding responses were added to the rig.

The same audit checks the two existing bundled GLBs' file sizes, topology counts, normal attributes and skin presence. The MakeHuman CC0 sources and licenses remain as recorded in `3d-art-provenance.md`. The generation record describes provenance; it does not establish exclusive copyright or guarantee non-infringement.

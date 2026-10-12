# World environment production pass

This version replaces per-cell gradients and persistent cell outlines with continuous material coordinates. Meadow, dusty earth, limestone, water, marsh and paving share a locally generated material sheet. Adjacent cells of the same material sample the same world-aligned texture; mirrored repetition keeps matching edges together. Authored water, road, ford and blocked terrain still determine every material boundary. No scenery changes pathfinding, movement cost, elevation or the legal board geometry.

The field has one broad light field and a dark perimeter. Military ground continues beyond the legal cells. Political floors use one chamber-wide opus-sectile composition instead of a checkerboard. Natural rocks, palms, oaks, ruined masonry, timber defenses and camp supplies use painted silhouettes with real texture. They replace the earlier faceted code shapes where appropriate; the previous deterministic shapes remain available if artwork is unavailable. High ground is a curved slope with clipped regional material and a shaded front contour. Objective, selection and target overlays remain visible; the full cell lattice appears only with the Grid option. Hover and keyboard focus retain individual cell outlines.

## Local artwork and export

Generated with the built-in image-generation tool on 12 October 2026. No third-party reference art or paid external API was used. Prompts are preserved in [world-ground-v08.txt](graphics-prompts/world-ground-v08.txt), [world-props-v08.txt](graphics-prompts/world-props-v08.txt) and [world-camp-v08.txt](graphics-prompts/world-camp-v08.txt). This records provenance, not exclusive copyright ownership or legal clearance.

- Ground master: `exec-91e3c10a-38b6-4f9e-90a6-e0599e9f6832.png`, 1536 × 1024, RGB. SHA-256 `036d1cd4dda3e3bd91f59bd846133978bbd216a173ddac1bc433849bd422fc59`. Retained locally as `work/production-world-art/ground-original.png`.
- Prop master: `exec-a93074ff-9871-4068-8ce4-2398006c0968.png`, 1254 × 1254, RGBA. SHA-256 `669f05e1061834e31f147d6c77c42d53469cfa43dc4e8e775645475363c55f92`. Retained locally as `work/production-world-art/props-original.png`.
- Camp master: `exec-1b9de09d-7d47-40e2-b496-de53c327cc14.png`, 1536 × 1024, RGBA. SHA-256 `aafb60b644ac147104bc764c54cf243a2026bac8411526c7ba06b35fe04f18b1`. Retained locally as `work/production-world-art/camp-original.png`.
- `assets/world/ground-materials.webp`: 1152 × 768, six cells in three columns and two rows: meadow, dry earth, limestone, water, marsh, road. WebP quality 84, 317,696 bytes.
- `assets/world/natural-props.webp`: 1024 × 1024 RGBA, four 512 × 512 cells: rock, palm, oak, rampart. Content is fitted within 472 × 460 pixels, centered at a 480-pixel foot baseline. WebP quality 87, 348,570 bytes.
- `assets/world/camp-props.webp`: 1024 × 512 RGBA, two 512 × 512 cells: stockade and supplies. The two source halves are fitted within 472 × 460 pixels at the same 480-pixel foot baseline. WebP quality 87, 89,010 bytes.

The generated prop sheet did not respect equal cells. [export-world-art.py](../scripts/export-world-art.py) records reviewed source crop rectangles and normalizes placement without painting over the original artwork or replacing alpha with a color-key mask. It retains transparency. Bright edge colors in the tool preview were inspected numerically: the saturated red master pixels have alpha only 1–2 out of 255. An attempted AI edge-cleanup variant was not selected; the original generated master is the source of the shipped export. Composited edge quality still requires the actual browser review.

The three exports total 755,276 bytes and approximately 9.38 MiB of estimated RGBA decode storage. They load with tactical chapter artwork, not the initial landing page. This release raises the chapter/full limits to accommodate the new artwork: 2 MB initial, 8 MB including chapter I, and 24 MB for the complete opt-in package. The former full-campaign 2 MB cap is superseded; the initial gate remains unchanged.

## Integration and verification boundaries

`world-assets.js` exports the asset paths independently of the image loader. The existing loader owns decoded-image reuse and bounds. Ground caching includes the loaded world-image identity, so a board first drawn while images are loading is rebuilt once the textures arrive. Interaction-only Grid, hover, action ranges and focus do not invalidate that static surface.

Material drawing, prop selection, lighting and all fallbacks are deterministic presentation. They neither mutate an encounter nor consume gameplay randomness. The renderer still sorts raised terrain and units by legal ground depth, and fades an occluder over the selected figure. These painted props are static; this pass does not claim new 3D geometry, wind simulation, physical-phone performance or human playtesting. Actual browser screenshots and measurements belong in the production verification report.

Eight direct world tests check material boundaries, shared texture coordinates, atlas source bounds, camp/natural anchors, exterior foundation rubble, late-load cache invalidation, and unchanged picking/state. These passed together with 25 existing detail, motion and readability tests after the textured rise and camp assets were added. The flat foundation blocks seen in the eastern scene were decorative masonry outside the legal board; they now use the painted rubble cell and retain that position. These checks validate submitted drawing commands and state boundaries, not pixel quality or measured frame rate.

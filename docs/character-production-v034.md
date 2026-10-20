# Character production and performance — v0.34

This pass extends the existing production actor renderer across the twelve chapters. It retains the licensed MakeHuman head/neck/exposed-arm anatomy, the original articulated rig, legal action clocks, material ownership and grounded equipment/foot contacts. It is an original **code-authored geometry and joint-performance** upgrade. It does not introduce a full externally sculpted character pack, motion capture, facial capture, photogrammetry, or new painted animation frames.

## Visible changes

- Unarmoured recruits, frontier figures and civic characters now use a continuous sewn tunic from neckline through sleeves and waist to the lower hem. The actual indexed surface follows the existing fold and hem joints; the old separate upper/lower tunic surfaces are no longer stacked at the belt. Armour retains its separate protective shell and under-tunic. Build-dependent tailoring varies the silhouette without moving the rig's joint origins.
- Marcellus develops coordinated cloth, leather, shield and metal finishes through the campaign. Named companions retain individual clothing and shield paint; Lucan, Sabinus and Varro have distinct shield motifs. Civic bloc edging remains the separate gameplay-readability cue.
- The new local Roman surface atlas supplies linen, wool, leather and worn metal colour variation. The existing procedural normal and roughness maps remain responsible for lighting response. Wool has its own material field and cloak treatment. Neither generated illustration nor copied albedo is described as measured PBR scan data.
- Imported facial skin has three restrained GPU corrective morphs: jaw settling, focused brows and concern. They combine with the existing fitted eyelids, eyebrows and bounded gaze. They are not phoneme lip sync; they never deform body vertices.
- A relaxed eye opening covers a larger iris at rest, avoiding the previous fixed stare. Fitted eyelid closure still follows the actual aperture. Helmet cheekguards now have a narrow hinge, rounded jaw taper, thin bevelled edge and a dished face instead of flat slab sides.
- Horses have a tucked flank, clearer withers, tapered neck and continuous muzzle contour instead of the previous spherical nose cap, with finer mane and ear movement. The four hoof contacts, saddle, rider placement and period saddle horns remain authoritative; no stirrups were added.
- New authored performances cover start, stop, turn, guard, sword follow-through, distinct command/rally gestures, speech, listening, walking and running. Gait accents use traveled-distance phase; starts/stops read movement progress. Turn direction follows the caller's authoritative yaw. Transitions settle differently for a defensive reaction, an attack and a movement ending. The exact strike contact at `230/620` and thrown release at `310/620` are preserved.

## Reproducible production boundary

`scripts/character-sources/performance-v034.json` is the editable joint-performance source. It contains **11 clips and 62 keyframes**. Every channel is manually specified in metres/radians. The compiler rejects missing endpoints, discontinuous loop endpoints, invalid channels and excessive translations or angles:

```sh
node scripts/build-character-performance.mjs
node scripts/build-character-performance.mjs --check
```

The generated `src/showcase/actor-performance-data.js` contains the source hash. The runtime sampler uses bounded cubic interpolation so intermediate values cannot exceed their neighboring authored values. The new clips supplement the existing 0.17 clips. The existing painted-animation coverage remains separate: **zero new bitmap animation frames** are claimed here.

Geometry remains reproducible source code in the costume, anatomy, horse, face-corrective and overview modules. This is a practical procedural asset pipeline; there is no claim that an unprovided Blender source project or authored full-body GLB exists.

The new `assets/textures/roman-surfaces-v034.webp` is one shared 2×2 atlas: upper-left linen, upper-right wool, lower-left leather and lower-right worn metal. The decoder uses actual image dimensions, samples four 256px tiles once, and updates live shared albedo textures in place. The source image is released after decode; no per-actor copy is retained. Procedural materials remain if loading fails, and a late old-atlas completion cannot overwrite the new maps. The asset manifest and art-generation record carry the exact source/export provenance.

## Detail and resource budgets

Before overview surfaces are bound to their existing bones, deterministic vertex clustering reduces unnecessary near-view subdivisions while retaining averaged material colours. Hands, boots and soles keep their separately authored overview meshes, preserving thin grips and ground contacts. Near/far switching does not change weapon anchors or game state.

Run the production audit:

```sh
node scripts/audit-character-production.mjs --output docs/evidence/character-production-v034.json
```

It constructs the actual imported production actors for **27 specimens at two qualities, 54 cases**: the named cast and roles plus Marcellus in all twelve chapters. It samples six motions at four phases, checks finite transforms, input purity, and actual visible geometry/resource ceilings.

Recorded maxima for this pass:

| Metric | Maximum |
| --- | ---: |
| Near visible triangles | 62,352 |
| Overview visible triangles | 11,612 |
| Near visible mesh surfaces | 28 |
| Overview visible mesh surfaces | 9 |
| Retained geometry arrays, including hidden LODs and facial morphs | 12,034,568 bytes |

These are individual-actor Node measurements, **not frame rates, complete scene draw calls, GPU allocation measurements or physical-device guarantees**. Browser texture replacement and GPU buffers have additional costs. The [machine-readable evidence](evidence/character-production-v034.json) contains all specimens rather than reporting only the most favorable one.

## Inspection and regression evidence

The existing development-only [production character viewer](../tests/actor-model-browser.html) now offers all twelve hero appearances; neutral/chapter light; body, face, equipment and tactical-distance framing; explicit near/overview geometry; wireframe; and a bounded transition sequence. The sequence exercises idle, start, walk, stop, turn, guard, strike, block and order through the actual renderer. The report identifies the performance source hash, clip count, live asset readiness, resource counts and measurement scope.

The final full Node suite passed **752 tests**. Character regressions cover the reproducible compiler on LF and CRLF checkouts, connected hem topology and cloth weights, real geometry reduction, face-only morph deltas, exact expression reset, fitted iris/lid boundaries, formed cheekguards, all-chapter resource bounds, unchanged equipment contacts, atlas deduplication/failure/late completion and one-time disposal. The established **32,000-triangle fallback cap** remains enforced; the refreshed 54-case audit above measures the final imported meshes.

The final officer face and helmet were also inspected in the actual browser development viewer: the relaxed resting eyes and formed cheekguards are visible, with no console or model errors. [Neutral head-and-shoulders inspection](images/v034-officer-inspection.png) records this close view. This is a character-viewer inspection, not a battlefield frame-rate measurement.

The complete cast, animation readability, all-chapter battlefield integration, actual loading latency and physical-device performance still require their own evidence. The single close-view inspection and Node resource counts do not establish those results or a subjective “world-class” quality verdict.

# Character mesh and performance refinement — 2026-10-31

This pass modifies existing character geometry and skin weights in Blender 5.2.2 LTS. It uses the compressed assets at baseline commit `9b41441`, decoded locally; the original raw generation downloads were not present in this workspace. No Tripo calls, paid credits, new third-party assets, texture rebaking or texture-quality reductions were used. Original generation prompts, tasks and licensing records remain unchanged.

## Shipped coverage

- Marcellus's recruit-derived persistent head has conforming local near-face subdivision, bounded relief fairing and smoother normals. The recruit body and the legionary, officer and commander bodies receive anatomical shoulder-weight fairing, so the main soldier benefits throughout his career.
- Aelia retains her own female face and painted identity. Her near face receives the same local refinement, with her own landmarks; both body levels receive shoulder and central long-robe weight improvements. Her existing bounded jaw, brow and blink system is generated from the refined source geometry at runtime.
- Lucan, Varro, Sabinus, Naso, Felix, Brennus, Crispus, Quintus, Severianus, Paullus and Theon receive conservative fairing of their own wrapped faces and shoulder weights on both detail levels. Their face topology is unchanged. The robe-specific correction applies only to Aelia; no other generated garments are silently treated as her robe.
- The shared original animation source adds planted anticipation before the start step, heel-first braking and settling, staged shield absorption and a more explicit supported hit recovery. These performances apply through the shared sampler in all twelve chapters. The initial block apex, attack contact at `230/620`, projectile release at `310/620`, and authoritative simulation clocks are unchanged. Reduced motion omits the added shield recovery flourish.

The two refined near faces add **626 hero triangles and 631 Aelia triangles**, with 337 and 338 extra vertices respectively. Their totals remain below the original 12,000/12,500 near-body budgets. Overview triangle counts are unchanged. The sixteen files grow by **36,432 bytes combined**, with no additional draw calls, materials, texture samples or shader variants required by the asset edits. Chapter download ceilings are unchanged.

## What Blender changes and protects

[`refine-character.py`](../scripts/assets/refine-character.py) constructs the existing indexed surfaces and named vertex groups in Blender. It builds a neighbourhood across coincident UV-split positions without welding away their paint seams. Local midpoint edge splits also split the neighbouring triangle, preventing T junctions; original vertices retain their indices. New UV and colour samples use exact edge interpolation before the existing normalized-attribute quantization.

Facial relief changes only depth: the original painted X/Y feature positions remain exact. The near hero/Aelia change is bounded to 3 mm; other face/detail-level changes are bounded to 1.5 mm. Nose and lip anchors constrain the fairing, while cheek, brow and eye-rim samples permit smoother curvature. Skin-weight diffusion follows mesh adjacency around the shoulder. Aelia's central robe diffuses abrupt weight transitions and partially transfers lower-leg influence to the upper legs and hips, with restrained blending between the legs at the centre of the drape. This is skinning, not cloth simulation.

[`refine-character.mjs`](../scripts/assets/refine-character.mjs) verifies the source hash before importing Blender's results, checks conforming subdivision/winding, preserves every original UV sample, KTX2 image byte, material, skeleton, inverse bind matrix and scene transform, and reuses the existing quantization/meshopt encoder. The wrist/hand and sole geometry and weights are exact anchors. No runtime resource-ownership code changes are needed for these files; the existing shared masters, private expressions and disposal path remain in use.

Each asset has an original/refined hash, byte counts, protected-channel digests, counts of edited vertices and production-rig pose measurements in `art-source/models/reports/char-<id>-refinement.json`. The asset manifest links those reports and records the final exports.

## Measured and inspected evidence

[`measure-character-refinement.mjs`](../scripts/assets/measure-character-refinement.mjs) samples the actual production rig at fixed idle, speech, raised-arm, initial-block and both walk-half poses. Its distortion measure is the absolute logarithm of posed/rest edge length, excluding edges shorter than 2 mm. These are injected presentation specimens, not a campaign playthrough or proof of human-perceived quality. Every accepted body improves both its average shoulder strain and its average 95th-percentile shoulder strain over those six poses; mean improvements range from 1.7% to 11.2%. Aelia's robe improves by **12.7% in mean strain and 26.0% at the 95th percentile**. Individual extreme edges can still distort; averages are not a guarantee of collision-free clothing.

Weapon, shield, projectile-release and sole-anchor digests match exactly between each source and refined body over those poses plus the authoritative attack/release instants. Regression tests independently check the shipped textures, original UVs, identity plane, protected positions/weights, finite normalized skinning, topology growth and the representative pose measurements.

Fixed-camera Chromium captures on Windows compare baseline/refined assets side by side under identical lighting and poses: frontal and three-quarter hero/Aelia faces, raised-arm and block shoulders, both Aelia walk halves, Aelia blink/concern, and representative Lucan, Crispus and Severianus shots. The temporary diagnostic browser/server closed after capture and reported no page errors. The review files are under the local task's `work/character-art-refinement/`; they are presentation specimens, not device-performance or first-time-player evidence. Both the implementing agent and parent reviewer inspected the representative images. The denser Aelia face preserves her bounded blink and expression mapping.

## Remaining art limits

This is an incremental mesh, skinning and authored-motion improvement. The original low-resolution facial albedo contains triangular lighting patches and coarse painted eye anatomy, still visible in close-up even when the normal map is disabled in a diagnostic. Subdivision cannot invent missing photographic detail or replace that paint. The inherited civilian head/body neck join remains: the two generated surfaces use different painted neck textures, and the source wrap includes border fragments. A proposed contour/weight fit passed vertex-distance checks but exposed a visible opening at Severianus's right neck; it was rejected and removed. Painted-neck extensions also introduced stretched paint or donor-collar fragments and were rejected. The baseline neck assembly, source head cut and facial identity are retained. Removing that visual boundary fully needs a properly repainted common neck surface or a revised source wrap, not a claimed success from matching vertex distances alone.

The existing source hair and some garment silhouettes remain coarse. A future dedicated face/texture art pass would need intentional repainting or a newly authored high-resolution source, followed by another identity and expression review. These assets are not described as finished cinematic character art.

The close-up overview-LOD diagnostic also exposes an inherited distorted head texture on the wrapped male cast; it appears in both the preserved baseline and refined assets. The GLB explicitly assigns the same atlas/material to near and overview heads, so swapping a runtime material is not a verified remedy. Its overview UV/source-wrap mapping needs a separate corrective export. The overview was intentionally magnified for inspection; this is not a claim that the artifact fills the screen at normal tactical distance.

## Reproducing the local mesh pass

Use the existing asset-tool environment described in [asset-pipeline.md](asset-pipeline.md); no package installation is part of this pass. Keep a source copy so refinement never compounds accidentally, and set `ASSET_MODULES` to the existing glTF-Transform tool directory.

```text
node scripts/assets/refine-character.mjs export source.glb input.json cast-aelia
blender --background --factory-startup --python scripts/assets/refine-character.py -- input.json refined.json
node scripts/assets/refine-character.mjs import source.glb candidate.glb refined.json report.json
node scripts/assets/measure-character-refinement.mjs source.glb candidate.glb cast-aelia poses.json
```

Accept the candidate only after budget, deformation and visual review, then update the manifest export and totals. Animation changes belong in `scripts/character-sources/performance-v034.json`; regenerate their runtime data with `node scripts/build-character-performance.mjs`.

# Tactical art direction and source record

The tactical library uses original project illustrations generated with the built-in `image_gen` tool, normalized locally into transparent WebP atlases. The narrative library has its separate [generation record](graphics-narrative-art.md). Per-file source hashes, dimensions, crop coordinates, export settings and output hashes are in [asset-manifest.json](asset-manifest.json).

## Reusable direction

The following is reconstructed production direction, not a verbatim copy of a tool prompt: depict Roman and frontier figures around AD 250–275 as readable, full-body painted miniatures, consistent three-quarter overhead scale, warm light from upper left, restrained fresco pigment, ivory cloth, iron, weathered bronze, muted red and olive. Keep the ground transparent and every weapon, shield and foot inside its cell. Avoid letters, logos, watermarks, modern objects, fantasy plate, oversized crests and universal segmented armour. Four authored views should retain each figure's equipment and identity rather than mirroring the shield and sword hands.

Roman rows progress from an unarmoured recruit to a legionary, veteran centurion and commander. Frontier rows provide a warrior, eastern archer, armoured eastern cavalry and Roman cavalry. Civic rows provide speakers, a senator, an opposing speaker and civilians/voters. These are reusable visual roles, not portraits of named historical individuals. The specialist sheet adds further distinct roles and is documented in the narrative record. The prop sheet provides regional vegetation, camp, supplies, architecture and civic furnishings; the renderer places those independently from the rules grid.

Long-sleeved tunics, mail or scale, oval shields and the spatha guide the third-century military presentation. Civic cloth, broad stripes and purple convey status. The project does not claim that every soldier wore the same equipment, that rectangular shields disappeared, or that an imagined fort is an archaeological reconstruction. [Historical notes](historical-research.md) distinguish sources from visual adaptations. Unit gear and scenery are stylized for recognition at phone scale.

## Atlas coordinates and export

All final unit sheets are **768 × 1024**, four columns by four rows. Each cell is **192 × 256** pixels with a common foot anchor at local **y = 240**. Transparent bounds are centered horizontally. Columns map `east=0`, `south=1`, `north=2`, `west=3` through `FACING_COLUMN` in `unit-sprites.js`. These are game-coordinate directions viewed isometrically, not screen-edge labels. Four independent views are used; directional mirroring is avoided.

The Roman, frontier and civic originals were delivered at 1024 × 1536. Their row boundaries were inspected and recorded individually in `scripts/optimize-tactical.py`; the frontier mounted row has a small per-column top correction. The script crops each declared region, uses alpha greater than 12 to find its bounds, downsizes with Lanczos to at most 176 × 232, anchors its feet, and exports RGBA WebP at quality 76/method 6. It does not synthesize missing pixels or repaint equipment.

The environment original is 1536 × 1024. `scripts/optimize-scenery.py` records eight individually inspected crop rectangles and packs them into **768 × 512**, four columns by two rows, with the same 192 × 256 cells and y=240 anchor. Its maximum content size is 184 × 232, exported at quality 80/method 6. Original PNGs remain outside the production bundle in the local generated-images directory. Only optimized WebP files ship.

To reproduce the mechanical export, with Pillow available:

```sh
python scripts/optimize-tactical.py ORIGINAL_DIRECTORY assets/tactical
python scripts/optimize-scenery.py ORIGINAL_PROPS.png assets/tactical/environment-props.webp
```

The source hashes and actual per-cell crop/placement records in the manifest identify the reviewed originals. A new generation is not guaranteed to share those boundaries and must be inspected before applying the export scripts.

## Rendering and animation limits

Painted atlas figures sit above procedural terrain, contextual scenery, contact shadows and restrained atmosphere. Depth ordering follows the board's projected ground positions; labels, selection markers, legal targets and health/resolve remain readable. Terrain type and unit state come from the existing engine. Decoration cannot create a passage, obstacle or target.

The sheets contain four static facings per role, **not authored walk, attack, cavalry or speech frame sequences**. Runtime presentation interpolates position, crossfades turns, adds small weight shifts, clipped lower-body movement, limb/weapon accents and action effects. It is deliberately a limited procedural animation system, not skeletal rigging or a claim of fully animated character production. Action paths are presentation-only and never change authoritative game state. A bounded six-second arrival beat adds movement only briefly; reduced motion and Performance mode retain a static presentation. See [graphics architecture](graphics-architecture.md) for cache limits, quality settings and cancellation behavior.

## Provenance and terms qualification

Generation used the built-in tool and project-created references; no third-party photographs or commercial asset-pack images were supplied for these sheets. The manifest records that production history. It is not a declaration of exclusive copyright, noninfringement, a third-party sublicense, or legal clearance. Use of generated output remains subject to the applicable provider/account terms and any rights that may exist; this project does not give a blanket legal guarantee. Museum and historical links are research references, not licenses to redistribute those institutions' images. See [license notices](LICENSE-NOTICES.md).

# Artwork generation and export record

> Archived v0.2/v0.3 library record. The current v0.4 replacements, expression variants, accession scene and specialist atlas are documented in [graphics-narrative-art.md](graphics-narrative-art.md). The sizes and commands below describe the earlier assets.

Later texture records: [v0.15 character materials and audio](presentation-assets-v015.md), and [v0.16 foliage and optimized character materials](presentation-assets-v016.md). The v0.16 foliage prompt is explicitly recorded as a retained summary, not an exact quotation.

The authorised aesthetic update combines cinematic illustration, restored-fresco pigment and quiet procedural gameplay graphics. The former code-only restriction has been superseded by the new brief. These are original AI-generated game illustrations, not archaeological reconstructions or copied museum imagery.

## Library and continuity

The runtime library contains 21 local WebP images: seven protagonist career stages, seven other recurring characters, one title composition and six environment murals. Fourteen portraits total **327,692 bytes**, the title **296,498 bytes**, and six scenes **391,300 bytes**: **1,015,490 bytes of artwork**. Per-file provenance, original dimensions, crop coordinates, export settings, hashes and intended use are in [asset-manifest.json](asset-manifest.json).

The main portrait atlas was requested at 2048 × 1536 but the built-in tool delivered **1448 × 1086**, with **4 columns and 3 rows** of 362-pixel square cells. A one-pixel inset produced twelve **360 × 360** exports. The supplementary Paullus/Sabinus sheet delivered **1774 × 887**, two equal square cells; its crops were downscaled to 360 × 360. The title delivered and retains **1536 × 1024**. The scene sheet delivered **1536 × 1024**, **2 columns and 3 rows**; row-major crops export at **720 × 319 or 320**.

The same dark curls, olive complexion, brow, nose and lean jaw identify the hero. Stubble, beard, greying and clothing communicate progression; governor and senator use civilian drapery. The cheek wound in the centurion portrait is an earlier scar, represented less distinctly years later rather than a different identity. Purple and a laurel wreath occur only in the emperor portrait. Varro, Lucan, Crispus, Severianus, Aelia, Paullus and Sabinus have distinct faces and dress. The supplementary sheet used the main generated atlas as its style reference.

All atlas cells were visually reviewed; the optimized recruit and emperor exports were also inspected at their final size. No visible cell borders, labels, clipped heads or watermarks remain. The environment images are fictional compositions, with architecture and logistics simplified for a chapter mural. They do not claim to reproduce a named fortress or a precise view of ancient Rome.

## Shared reusable specification

Use painted historical-chronicle realism with subtle fresco pigment, expressive but restrained faces, warm directional light, olive and earth shadows, warm ivory, Pompeian red, weathered bronze and quiet plaster. Avoid excessive gold, glossy fantasy armour, giant crests, lorica segmentata as a universal uniform, modern objects, tiny baked-in writing and decorative noise behind interface text. Keep all labels in the DOM. Use richer purple only when earned.

The military clothing and shield direction follows the existing [historical notes](historical-research.md): mail or scale, long-sleeved tunics as the portrait default, oval painted shields as a visual convention, and the third-century spatha. Those notes explicitly retain rectangular-shield evidence and describe the pendant as a deliberate reconstruction. Civic garment folds, stripe widths, fasteners and ceremonial details are stylized for status readability, not claims of an exact reconstructed uniform.

## Local export

Generation used the **built-in image_gen tool**, not an API CLI or a paid subscription. No third-party art was supplied. The supplementary cast sheet referenced only the project's first generated atlas. No runtime request reaches a generation service.

Pillow is used only during development for the explicitly authorised crop, downscale and WebP optimisation. The original generated PNGs remain in the local working art directory and the tool's original output locations; they are not shipped in the browser bundle. The optimized copies live in `assets/`.

From the project root, with Python and Pillow available:

```sh
python scripts/optimize-assets.py portraits --input /path/cast-atlas-original.png
python scripts/optimize-assets.py portraits-extra --input /path/cast-extra-original.png
python scripts/optimize-assets.py title --input /path/frontier-oath-original.png
python scripts/optimize-assets.py scenes --input /path/scenes-atlas-original.png
npm run build
node scripts/verify-assets.mjs
```

The default WebP export uses quality **86**, method **6**, RGB and Lanczos downscaling. Portrait export never enlarges a source crop. These commands regenerate the intended project paths and manifest; an atlas must be visually checked for the declared grid before export. The script does not repair arbitrary grid layouts.

The manifest does not assert exclusive copyright or invent an ownership declaration. Historical-source links are references, not licenses to redistribute their photographs. No fonts or recorded audio are added by this pipeline.

## Loading and build checks

The service worker installs the application shell plus title, recruit and Varro art. Other portraits and scene murals are outside the install list. The application sends `cache-campaign` after its initial display/idle opportunity; the worker reports `offline-progress`, caches missing files, and emits `offline-ready` only when every versioned asset is present. A failed download remains partial and may be retried. Cache lookups use the active worker's own revision, so an older image cannot satisfy a newer build. Waiting updates do not call `skipWaiting`.

The build separately reports initial and complete raw/gzip file sums, including the generated worker in those two figures. Both retain the existing **2,000,000-byte compressed gate**. File sums are reproducible size estimates, not actual browser transfer or hardware-timing measurements. The original `bytes`/`gzipBytes` fields continue to count runtime files excluding the generated worker for comparison with the earlier build.

The asset verification command checks manifest byte counts and hashes, portrait/title budgets, deferred installation, truthful partial status, version-scoped lookup, failure without false readiness, retry to completion, cached navigation with an unavailable server, and update activation without forced takeover. These are Node mocks, separate from the browser and real-device checks in the overall verification report.

## Exact main portrait generation prompt

```text
Use case: historical-scene. Asset type: one coherent portrait atlas for the existing SACRAMENTUM Roman historical browser game. Create a high-quality 2048 by 1536 landscape image consisting of EXACTLY 12 individual chest-up bust portraits in a perfectly regular 4-column by 3-row grid of equal 512 by 512 square cells. No gaps, no text or labels, no decorative outer border: each portrait fills its own square cell against the same quiet muted olive-plaster background, with the head completely contained and ample breathing room. Each is a finely painted military chronicle portrait: expressive faces, cinematic realism interpreted through restored Roman fresco pigment, restrained brushwork and subtle plaster, never photorealistic glamour, cartoons or fantasy. All faces at the same scale, chest-up, upright, subtly three-quarter turn, looking toward viewer, warm directional light from upper left, unified Pompeian red, warm ivory, bronze, olive, charcoal and earth palette.

The seven consecutive first portraits are the SAME male protagonist aging naturally: olive complexion, dark short wavy hair, lean square jaw, broad cheekbones, distinct slightly broken bridge of nose, brown eyes, characteristic calm alert gaze. Preserve recognizable facial identity. Distinct clothing stages:
Row 1 column 1: protagonist recruit age 20, youthful clean-shaven, plain worn ivory long-sleeved tunic, small simple lead seal pendant, NO armour and NO crown.
Row 1 column 2: SAME protagonist miles age 25, short stubble, practical iron mail over long-sleeved tunic, worn muted red cloak shoulder, NO crown.
Row 1 column 3: SAME protagonist centurion age 30, slightly weathered, thin small healed cheek scar, mail, red cloak with simple bronze brooch, NO crown and NO giant helmet crest.
Row 1 column 4: SAME protagonist prefect age 36, mature short beard, recognizable broken nose, mail and slightly finer red command cloak, NO crown.
Row 2 column 1: SAME protagonist governor age 43, salt beginning at temples, short neat beard, dignified plain cream civilian draped garment with narrow wine-red stripe, no armour and NO crown.
Row 2 column 2: SAME protagonist senator age 45, the same face aged only two more years, formal warm ivory toga with broad dark red senatorial stripe, no armour and NO crown.
Row 2 column 3: SAME protagonist emperor age 45, the EXACT SAME age and face as the adjacent senator, deep restrained imperial purple draped mantle, small laurel wreath, no giant jewelled crown. The ONLY portrait with any laurel.
Row 2 column 4: mentor Varro age 55, clearly DIFFERENT man, stocky face and wide nose, thinning cropped grey hair, close grey beard, old weathered veteran in mail and faded red cloak, gentle stern expression, NO crown.
Row 3 column 1: comrade Lucan age 30, clearly DIFFERENT man, lighter warm complexion, curly brown hair, rounder open face, short beard, worn mail and muted ochre scarf, steadfast friendly expression, NO crown.
Row 3 column 2: rival Crispus age 35, clearly DIFFERENT man, pale olive complexion, narrow elegant face, straight aquiline nose, neat dark cropped hair, clean shaven, costly but restrained deep red cloak over mail, composed challenging expression, NO crown.
Row 3 column 3: patron Severianus age 55, clearly DIFFERENT man, fuller face, receding grey curls, clean-shaven, ivory civic drapery with muted bronze brooch, observant guarded expression, NO crown.
Row 3 column 4: provincial ally Aelia age 35, an adult Roman provincial woman with dark hair pinned simply back, strong attentive brown eyes, ivory stola and muted terracotta mantle, thoughtful confident expression, NO crown.

Historical constraints: Roman empire around AD 250–275, long-sleeved tunics with mail for soldiers, restrained bronze fasteners, civilian drapery. No lorica segmentata or fantasy armour, no medieval plate, no modern uniforms, no giant plumed helmets, no weapons across faces, no text, letters, numerals, writing, watermark, logo or panel labels. Seven protagonist stages must be visibly the same person. The five cast portraits must be clearly distinct people. Keep every head and shoulders safely inside its own identical square cell for precise automated cropping.
```

## Exact supplementary portrait generation prompt

```text
Use case: historical-scene. The attached twelve-portrait atlas is a STYLE REFERENCE, not an image to duplicate. Create a new matching two-person companion portrait sheet for SACRAMENTUM. EXACTLY TWO equal SQUARE cells in ONE ROW, overall landscape 2:1 aspect ratio, no margin or gap between the cells, no labels or writing. Match the reference's painted military chronicle realism, warm upper-left light, quiet olive plaster, pigment texture, chest-up scale, subtle three-quarter turn and unified Roman third-century material palette. Both heads must fit fully inside their own cells with safe space above hair.

LEFT CELL: fictional elder senator Lucius Cassius Paullus, Roman man around 70, clean-shaven, short white hair with receding temples, long narrow lined face and prominent cheekbones, intelligent reserved eyes, dignified solemn expression; warm ivory toga with a broad deep Pompeian red senatorial stripe, no armour, no laurel, no crown. His face must clearly differ from the broad, full-faced patron Severianus on the third row third column of reference.

RIGHT CELL: fictional replacement officer Sabinus, middle-aged Danube soldier around 40, broad sturdy face, dark tightly curly cropped hair, thick short curly beard, warm olive complexion, alert dependable expression; practical iron mail over a long-sleeved tunic, worn muted OLIVE GREEN cloak with simple bronze fastener, no laurel or crown. His face must differ from the protagonist, Lucan and Varro of the reference.

Roman empire AD 250–275, no lorica segmentata, no medieval plate or fantasy armour, no modern elements, no weapon across a face, no border, no text, no watermark. Keep both cells stylistically seamless with the reference atlas.
```

## Title and scene generation

The title and six-scene sheet use the same painted-chronicle palette and historical exclusions. Their original-source SHA-256 hashes and export bounds are recorded in the manifest. The following reusable instructions record the intended composition; generated pixels are not archaeological reconstructions.

**Title reproduction instructions.** Original historical scene, cinematic painted military chronicle with restrained restored-fresco grain, landscape 1536×1024. A young twenty-year-old recruit, short dark wavy hair, olive complexion, lean square jaw and uneven nose, in three-quarter back view in the right third. Worn ivory long-sleeved wool tunic, brown trousers, practical belt, muted russet cloak and large oval oxblood shield with restrained bronze details. Danube frontier around AD250: a timber gate and stone fort, marching column, river, misted hills and distant eagle standard at amber dusk. Leave generous quiet dark space on the left. Charcoal, forest olive, ivory, Pompeian red, weathered bronze and antique gold. No lettering, logo, UI, frame, fantasy or medieval armour, lorica segmentata, rectangular shields, laurel, crown or oversaturation.

**Environment sheet reproduction instructions.** Six independent landscape illustrations, exactly two columns and three rows, 1536×1024, no gutters, labels or frames. Row1: Danube legionary camp at dawn; misty marsh retreat with reeds and worn crossing stones. Row2: arid eastern frontier fort evoking the Euphrates region; a river crossing with timber pontoons and a distant garrison. Row3: a provincial centre with tribunal, grain stores and displaced families; Rome with colonnades and Aurelian-era walls at sunset. Match the title's cinematic painted-chronicle realism, upper-left directional light, restrained pigment grain, warm olive/ivory/red palette and consistent human scale. No hero close-ups, no fantasy, medieval or Renaissance elements, no modern landmarks, no actual text or UI. Keep lower areas quiet enough for a separately rendered caption. Export each cell independently; no runtime atlas slicing.

## Scene depth maps (v0.30)

The eight story paintings in `assets/scenes/` each have a greyscale depth map in `assets/scenes/depth/`, used only by the 2.5D drift and weather layers of `src/ui/scene-parallax.js`. Near is light and far is dark. The maps are never shown on their own and add no new imagery: each is a mechanical estimate from the project's own shipped painting.

They were made offline with `scripts/scene-depth.py` and the **MiDaS v2.1 small** model (`model-small.onnx` from https://github.com/isl-org/MiDaS/releases/tag/v2_1, SHA-256 `2d8c6cb8f415229daf1eb041024208e2608c9f98e17c81cc7c6ecb449c56fd58`). MiDaS is released under the MIT licence (Copyright (c) 2019 Intel ISL). The model is not bundled and nothing runs at play time; only the eight small output files ship.

Settings: the painting is resized bicubically to 256 × 256 and normalised with the ImageNet mean and standard deviation. The model's relative inverse depth is spread between its 2nd and 98th percentiles and eased by a gamma of 0.85. The result is resized bicubically to 384 pixels wide at the painting's own aspect, softened with a Gaussian blur of radius 1.2 so the drift never tears an edge, and saved as RGB WebP at quality 88, method 6. The eight files total 13,790 bytes. With onnxruntime 1.31.0 (CPU), NumPy 2.5.4 and Pillow 12.3.0 (libwebp 1.6.0) a second run reproduces them byte for byte:

```sh
python3 -I scripts/scene-depth.py --model /path/to/model-small.onnx [--pylib /path/to/site-packages]
```

Per-file source hashes, sizes and export checksums are in [asset-manifest.json](asset-manifest.json). A monocular estimate is approximate: depth is coarse (the model sees 256 × 256), thin objects such as spears and standards blur into their background, and the far sky is flattened. The renderer keeps the drift small for that reason.

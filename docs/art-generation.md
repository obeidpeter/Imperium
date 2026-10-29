# Artwork generation and export record

The current Roman figure replacement is documented in [the 0.31 character generation record](art-generation-v031.md), including both exact prompts, measured row normalization and the distinction between bitmap frames and procedural action coverage.

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

## Tripo-generated Chapter V scenery (v0.36)

Five decorative props for a supply camp beside the Chapter V battlefield were generated with Tripo's text-to-model API (model `v2.5-20250123`, default settings: textured PBR, 20 credits each) on 2026-10-20, from text prompts only: no reference image or third-party model. The owner's paid Tripo account gives the owner full rights to use, modify, distribute and commercially exploit them; Tripo holds a royalty-free, non-exclusive licence to display them as needed to provide its service.

Each raw download (about 17 MB, roughly 500,000 triangles, three 2048 px maps) was processed in Blender 5.2.2 by `scripts/assets/process-model.py`: welded, decimated by one ratio to the triangle budget, scaled to the stated height, stood at the origin, textures shrunk and exported as WebP in one GLB. The raw files stay outside the repository; their SHA-256 digests, the Tripo task ids and the parameters Tripo reported are in each request file in `art-source/models/requests/`, and the processing reports are in `art-source/models/reports/`.

| Model | Tripo task | Triangles (raw → shipped) | Textures | Height | Shipped bytes (WebP → compressed) |
| --- | --- | ---: | --- | ---: | ---: |
| `ch5-spoil-baskets` | `e4a3180a-7bb9-438f-a9c2-15c716734d0a` | 501,886 → 2,939 | 512 px, WebP 72 | 0.6 m | 188,228 → 213,856 |
| `ch5-gallery-timbers` | `ad77a449-ea69-4c32-9ba6-60c45bb6812b` | 490,456 → 4,899 | 512 px, WebP 80 | 2.0 m | 271,412 → 266,160 |
| `ch5-mudbrick-stack` | `48f5ed9c-ccc5-4f6e-8322-ecd58b10e161` | 501,040 → 2,937 | 512 px, WebP 80 | 0.8 m | 173,144 → 187,856 |
| `ch5-storage-jars` | `a95f1fff-ae87-4967-a352-a6c803227789` | 501,572 → 3,919 | 512 px, WebP 80 | 1.1 m | 161,296 → 181,820 |
| `ch5-leather-tent` | `efad6e3f-58d8-4752-a888-b23213a51cf3` | 501,250 → 4,898 | 512 px, WebP 80 | 1.8 m | 230,672 → 231,056 |

Review notes: the jars came as four rather than three, without the requested rope sling or sand; the mudbrick stack reads as orange fired brick rather than pale sun-dried mud.

On 2026-10-22 the asset foundation compressed all five in place with `scripts/assets/compress.mjs`: KTX2 textures (Basis Universal 1.16.4, ETC1S at quality 128, with mipmaps) and meshopt geometry, every triangle unchanged. The manifest keeps each WebP version's bytes and digest; the reports in `art-source/models/reports/*-compress.json` give each texture's measured error ([compression](asset-pipeline.md#compression)).

### Exact prompts


**ch5-spoil-baskets**

```text
A cluster of three woven palm-fibre baskets heaped with excavated pale earth and broken mudbrick, spoil carried out of a siege mine. Mid-3rd-century Roman Euphrates frontier fortress during a siege, c. AD 256. Realistic, weathered, practical, earthy colours; a single object on bare ground. No people, no animals, no text or inscriptions, no modern objects or materials, no fantasy elements.
```
**ch5-gallery-timbers**

```text
A timber shoring frame at the mouth of a mine gallery: two rough-hewn upright posts and a lintel of unpainted split poplar and palm wood, packed earth around their feet. Mid-3rd-century Roman Euphrates frontier fortress during a siege, c. AD 256. Realistic, weathered, practical, earthy colours; a single object on bare ground. No people, no animals, no text or inscriptions, no modern objects or materials, no fantasy elements.
```
**ch5-mudbrick-stack**

```text
A neat stack of about forty sun-dried mudbricks with straw temper on a low earthen base, a few broken bricks beside it. Mid-3rd-century Roman Euphrates frontier fortress during a siege, c. AD 256. Realistic, weathered, practical, earthy colours; a single object on bare ground. No people, no animals, no text or inscriptions, no modern objects or materials, no fantasy elements.
```
**ch5-storage-jars**

```text
Three large terracotta storage jars, two standing and one cracked and lying on its side, half-sunk in sand, rope slings around one. Mid-3rd-century Roman Euphrates frontier fortress during a siege, c. AD 256. Realistic, weathered, practical, earthy colours; a single object on bare ground. No people, no animals, no text or inscriptions, no modern objects or materials, no fantasy elements.
```
**ch5-leather-tent**

```text
A Roman army eight-man tent of stitched goatskin leather panels over a wooden ridge pole, with guy ropes and wooden pegs, patched and dusty. Mid-3rd-century Roman Euphrates frontier fortress during a siege, c. AD 256. Realistic, weathered, practical, earthy colours; a single object on bare ground. No people, no animals, no text or inscriptions, no modern objects or materials, no fantasy elements.
```

## Character handoff GLBs (v0.35, development only)

`art-source/characters/` holds full-body, rigged glTF 2.0 exports of three Chapter V figures (Marcellus, Lucan and a Persian guard) for art review and editing in a DCC. No image or model generation was used. `scripts/build-character-handoff.mjs` builds each figure with the game's own character code (original garments, equipment, material fields, pore map and authored clips over the retained MakeHuman CC0 head/arm anatomy and skin texture) and `scripts/character-glb.mjs` writes it: one self-contained GLB per figure, metres with +Y up and +Z forward, skin joints, face morph targets, embedded PNG maps and sampled idle, walk, attack and block clips. Rights and provenance are recorded under `developmentAssets` in [asset-manifest.json](asset-manifest.json); per-file sizes and SHA-256 digests are in `art-source/characters/manifest.json`, which each export rewrites.

Since 0.37 the battle figures wear generated character bodies over the same rig; these exports show the code-built figure without one, which the game draws until a body loads or if it fails.

The files are excluded from the website build and offline download. Re-export with `npm run art:handoff` (Sharp required, not a project dependency); `npm run audit:handoff` says when the character code has changed since the last export. An export is repeatable on one machine, but a different Node.js or Sharp version can produce different bytes.

## Scene depth maps (v0.30)

The eight story paintings in `assets/scenes/` each have a greyscale depth map in `assets/scenes/depth/`, used only by the 2.5D drift and weather layers of `src/ui/scene-parallax.js`. Near is light and far is dark. The maps are never shown on their own and add no new imagery: each is a mechanical estimate from the project's own shipped painting.

They were made offline with `scripts/scene-depth.py` and the **MiDaS v2.1 small** model (`model-small.onnx` from https://github.com/isl-org/MiDaS/releases/tag/v2_1, SHA-256 `2d8c6cb8f415229daf1eb041024208e2608c9f98e17c81cc7c6ecb449c56fd58`). MiDaS is released under the MIT licence (Copyright (c) 2019 Intel ISL). The model is not bundled and nothing runs at play time; only the eight small output files ship.

Settings: the painting is resized bicubically to 256 × 256 and normalised with the ImageNet mean and standard deviation. The model's relative inverse depth is spread between its 2nd and 98th percentiles and eased by a gamma of 0.85. The result is resized bicubically to 384 pixels wide at the painting's own aspect, softened with a Gaussian blur of radius 1.2 so the drift never tears an edge, and saved as RGB WebP at quality 88, method 6. The eight files total 13,790 bytes. With onnxruntime 1.31.0 (CPU), NumPy 2.5.4 and Pillow 12.3.0 (libwebp 1.6.0) a second run reproduces them byte for byte:

```sh
python3 -I scripts/scene-depth.py --model /path/to/model-small.onnx [--pylib /path/to/site-packages]
```

Per-file source hashes, sizes and export checksums are in [asset-manifest.json](asset-manifest.json). A monocular estimate is approximate: depth is coarse (the model sees 256 × 256), thin objects such as spears and standards blur into their background, and the far sky is flattened. The renderer keeps the drift small for that reason.

## Tripo-generated character bodies (v0.37)

Sixteen character bodies were generated with Tripo's text-to-model API (model `v3.0-20250812`, default settings: textured PBR, 20 credits each) on 2026-10-20, from text prompts only: no reference image or third-party model. Each was rigged by Tripo's biped auto-rig (25 credits each), so the batch cost 720 credits. The owner's paid Tripo account gives the owner full rights to use, modify, distribute and commercially exploit them; Tripo holds a royalty-free, non-exclusive licence to display them as needed to provide its service.

Each prompt asks for a T-pose for rigging and leaves out the shield, weapons, cloak, pack and quiver, which the game draws itself on the figure's joints. `scripts/assets/bind-character.py` (Blender 5.2.2) posed each rigged model into the game's bind pose with Tripo's own weights, welded the vertices the importer splits along texture seams (decimating them apart opened hairline cracks), decimated it to the near triangle budget, folded Tripo's 41 joints onto the game's 15, removed the open hands (the game's gripping hands take their place), gave everything below the ankle to the foot, fitted the body onto the game's joint positions with its soles on the game's sole plane, made a further-decimated overview level with the texture colours baked into it for the fallen bodies, shrank the colour map to 1,024 px and the normal and roughness/metal maps to 512 px, all WebP, and exported a skinned GLB; `scripts/assets/quantize-model.mjs` then quantized its vertex data. The raw and rigged downloads stay outside the repository; their SHA-256 digests, tasks and the parameters Tripo reported are in each request file in `art-source/models/requests/`, and the binding reports are in `art-source/models/reports/`.

| Body | Chapters | Tripo task | Rig task | Triangles (raw → near + overview) | Shipped bytes (WebP → compressed) |
| --- | --- | --- | --- | ---: | ---: |
| `roman-recruit` | I–XII | `9de4f190-0e52-4686-8687-0c669eef23c5` | `e413469b-5f43-46fc-b957-262296db9557` | 662,056 → 11,186 + 2,499 | 418,392 → 366,388 |
| `roman-trainer` | I | `753e26c5-63d2-4df0-ae10-28a450a55866` | `6366f165-e003-4beb-8a0b-fdb2e0168838` | 736,354 → 11,295 + 2,499 | 448,620 → 401,064 |
| `roman-legionary` | I, II, III, IV, V, VI, VII, VIII, IX, X, XII | `3d021c57-c89e-4575-bfce-ceae378320c9` | `dddddd8f-3829-49f7-9136-512b5c07cd8e` | 780,927 → 11,432 + 2,499 | 508,428 → 447,560 |
| `roman-archer` | III, IV, V, VI, VII, VIII, IX, X, XII | `9b6df0c7-2627-4789-b283-0e9a680b1b63` | `07a70b13-dae5-4b39-ac8e-4b69691e07c5` | 691,865 → 11,131 + 2,499 | 483,852 → 436,028 |
| `roman-officer` | IV, V, VI | `5434c6ae-dcdb-4d6b-9009-68a3c523558b` | `3e040ac6-b7d8-4f50-b28b-3912ee775723` | 765,498 → 11,393 + 2,499 | 537,496 → 471,316 |
| `roman-commander` | VII, VIII, IX, X, XI, XII | `b3680837-dcef-4bcd-a98d-c84df9414e34` | `34b645af-e32b-48d5-b3f6-fa5e355b4dde` | 751,743 → 11,298 + 2,499 | 546,208 → 482,700 |
| `gothic-warrior` | I, II, III, IV, VII, VIII, X | `d4e79b53-deea-4280-8e3f-52643d6b27e1` | `1039160f-c2d0-426e-af6d-5b48b27e1a03` | 698,122 → 11,441 + 2,499 | 432,708 → 368,820 |
| `gothic-archer` | I, II, III, IV, VII, VIII, X | `3b3595b2-ee0c-4699-9ce8-ae9533b85e98` | `77d1f7dd-001d-4219-9094-e89d57f05e5b` | 709,065 → 11,375 + 2,499 | 484,744 → 426,424 |
| `gothic-noble` | IV, VII | `ecb62c9b-603a-4f92-bc7c-b3c618424586` | `37c9c297-8092-4480-9315-fce8a08454c5` | 734,809 → 11,480 + 2,500 | 498,632 → 441,704 |
| `persian-infantry` | V, VI | `19e9cdd2-7155-4311-8b3e-e93ef0e417c3` | `05da8b9d-8b08-4289-9b77-a5241c8fb4aa` | 741,648 → 11,480 + 2,500 | 525,572 → 460,068 |
| `persian-archer` | V, VI | `0fe42e69-c07a-4806-81bf-77125cfb87d6` | `a358953c-e353-403f-a22a-11537496fd5d` | 828,362 → 11,465 + 2,500 | 512,640 → 446,880 |
| `persian-cavalry` | V, VI | `6ea64fb2-7dc9-43d1-a928-90280b523387` | `5a8b5e83-6733-4cd3-8db7-133b5851cd4b` | 764,965 → 11,515 + 2,500 | 549,960 → 479,072 |
| `palmyrene-infantry` | IX | `4e6ac7da-0733-4cef-94a7-a849d668c822` | `d6ec60f4-7c4f-4f7c-9e50-08e3a3521fc1` | 730,656 → 11,521 + 2,500 | 535,356 → 463,580 |
| `palmyrene-archer` | IX | `5e86017f-e99d-4922-a5ec-3c957af69fcb` | `45c7459a-7f4b-4c9e-9e8b-57a24763e8f4` | 768,660 → 11,410 + 2,499 | 472,440 → 417,196 |
| `palmyrene-cavalry` | IX | `b61ba77c-f98c-4b3a-b885-77178554817c` | `8dfd9a8a-1ee2-4994-8ec0-efe8dabaf72b` | 692,719 → 11,611 + 2,499 | 557,720 → 479,632 |
| `civilian-escort` | I, II, III, IV, VI, VIII | `7292c822-f168-4ce9-abd2-2e7ef4893100` | `c0277728-1689-4bd3-9d3d-3766ce704ffb` | 676,436 → 11,269 + 2,500 | 422,340 → 377,588 |

Review notes: the generator returned T-poses rather than the A-pose first asked for, and open hands; the officer wears segmented plate rather than the mail its prompt describes. The binding stretches some shins by up to 6.5 cm, where Tripo's ankle joint sits higher above the sole than the game's.

The asset foundation compressed all sixteen in place on 2026-10-22, as it did the props: KTX2 textures and meshopt geometry over the quantized vertices, every triangle unchanged, with the WebP versions' bytes and digests kept in the manifest ([compression](asset-pipeline.md#compression)).

### Exact prompts

**roman-recruit**

```text
Full-body young Roman army recruit in training in the mid-3rd century AD, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a plain undyed off-white long-sleeved wool tunic to the knee, belted with a simple leather belt, dark wool trousers and closed leather boots. Bare head with short dark curly hair, clean-shaven young face. Realistic proportions, historically accurate, worn and practical, earthy colours. No shield, no weapons, no cloak, no backpack, no quiver, no text or inscriptions, no modern objects, no fantasy elements.
```
**roman-trainer**

```text
Full-body grizzled Roman veteran drill instructor of the mid-3rd century AD, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a long-sleeved brown wool tunic to the knee, a studded military belt, dark wool trousers, closed leather boots and a leather neck scarf. Bare head with short cropped grey hair and a short grey beard, weathered older face. Realistic proportions, historically accurate, worn and practical, earthy colours. No shield, no weapons, no cloak, no backpack, no quiver, no text or inscriptions, no modern objects, no fantasy elements.
```
**roman-legionary**

```text
Full-body Roman legionary soldier of the mid-3rd century AD, standing in a neutral A-pose for rigging: arms straight and held about 40 degrees away from the body, legs straight and slightly apart, hands in loose fists, facing forward, symmetrical. He wears an iron mail shirt to mid-thigh over a long-sleeved red-brown wool tunic, a leather belt with bronze plates, dark wool trousers and closed leather boots, and an iron helmet with large cheek guards and a deep neck guard. Clean-shaven weathered face. Realistic proportions, historically accurate, worn and practical, earthy colours. No shield, no weapons, no cloak, no backpack, no text or inscriptions, no modern objects, no fantasy elements.
```
**roman-archer**

```text
Full-body Roman auxiliary archer of the mid-3rd century AD, recruited in the eastern provinces, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a short iron mail shirt over a long-sleeved olive-brown wool tunic, a leather belt, wool trousers and soft leather boots, a leather bracer on the left forearm, and a conical iron helmet with a short neck guard. Short dark beard. Realistic proportions, historically accurate, worn and practical, earthy colours. No shield, no weapons, no cloak, no backpack, no quiver, no text or inscriptions, no modern objects, no fantasy elements.
```
**roman-officer**

```text
Full-body Roman centurion of the mid-3rd century AD, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a fine iron mail shirt to mid-thigh with bronze edging and doubled shoulders over a long-sleeved off-white wool tunic, a broad bronze-plated military belt with a hanging apron of studded leather straps, dark wool trousers, closed leather boots and bronze greaves, and a polished iron helmet with brass fittings and large cheek guards, without a crest. Mature, clean-shaven, stern face. Realistic proportions, historically accurate, worn and practical, earthy colours. No shield, no weapons, no cloak, no backpack, no quiver, no text or inscriptions, no modern objects, no fantasy elements.
```
**roman-commander**

```text
Full-body Roman senior army commander of the 260s and 270s AD, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a bronze muscled cuirass with leather strap pteruges at the shoulders and hips over a long-sleeved white wool tunic, a red sash knotted around the waist, dark wool trousers, closed leather boots and bronze greaves, and a gilded iron helmet with cheek guards, without a crest. Mature face with a short dark beard. Realistic proportions, historically accurate, worn and practical, earthy colours. No shield, no weapons, no cloak, no backpack, no quiver, no text or inscriptions, no modern objects, no fantasy elements.
```
**gothic-warrior**

```text
Full-body Gothic warrior of the mid-3rd century AD, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a long-sleeved patterned wool tunic in muted brown and ochre to mid-thigh, a leather belt, loose wool trousers wrapped with leg bindings and leather shoes. Long fair-brown hair tied back and a full beard, no helmet, no armour. Realistic proportions, historically accurate, worn and practical, earthy colours. No shield, no weapons, no cloak, no backpack, no quiver, no text or inscriptions, no modern objects, no fantasy elements.
```
**gothic-archer**

```text
Full-body Gothic archer of the mid-3rd century AD, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a short undyed wool tunic under a sheepskin vest, a leather belt, wool trousers with leg wraps and leather shoes, and a fur cap. Braided hair and a beard, no armour. Realistic proportions, historically accurate, worn and practical, earthy colours. No shield, no weapons, no cloak, no backpack, no quiver, no text or inscriptions, no modern objects, no fantasy elements.
```
**gothic-noble**

```text
Full-body Gothic chieftain warrior of the mid-3rd century AD, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears an iron mail shirt over a red-brown patterned wool tunic, a broad belt with silver fittings, wool trousers with leg wraps and leather boots, and a simple iron segmented helmet. Long hair and a full beard. Realistic proportions, historically accurate, worn and practical, earthy colours. No shield, no weapons, no cloak, no backpack, no quiver, no text or inscriptions, no modern objects, no fantasy elements.
```
**persian-infantry**

```text
Full-body Sasanian Persian infantry spearman of the mid-3rd century AD, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a knee-length coat of iron scale armour over a long-sleeved deep red tunic with patterned trim, baggy trousers gathered at the ankle, soft leather boots, and a domed conical iron helmet with a mail aventail covering the neck. Full black beard. Realistic proportions, historically accurate, worn and practical, earthy colours. No shield, no weapons, no cloak, no backpack, no quiver, no text or inscriptions, no modern objects, no fantasy elements.
```
**persian-archer**

```text
Full-body Sasanian Persian archer of the mid-3rd century AD, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a long quilted kaftan in ochre and dark blue with patterned borders over a short mail shirt, a leather belt, baggy trousers, soft leather boots, and a rounded felt cap with ear flaps. Black beard. Realistic proportions, historically accurate, worn and practical, earthy colours. No shield, no weapons, no cloak, no backpack, no quiver, no text or inscriptions, no modern objects, no fantasy elements.
```
**persian-cavalry**

```text
Full-body Sasanian Persian heavy cavalryman of the mid-3rd century AD, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears armour of iron lamellae and mail, with mail sleeves covering the arms, scale skirts over the thighs, armoured boots, and a polished conical iron helmet with a mail aventail, face visible. Black beard. Realistic proportions, historically accurate, worn and practical, earthy colours. No shield, no weapons, no cloak, no backpack, no quiver, no text or inscriptions, no modern objects, no fantasy elements.
```
**palmyrene-infantry**

```text
Full-body Palmyrene soldier of the 270s AD, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a corselet of bronze scale armour over a long-sleeved patterned tunic in red and gold, baggy trousers, soft leather boots, and a conical bronze helmet. Short dark beard. Realistic proportions, historically accurate, worn and practical, earthy colours. No shield, no weapons, no cloak, no backpack, no quiver, no text or inscriptions, no modern objects, no fantasy elements.
```
**palmyrene-archer**

```text
Full-body Palmyrene archer of the 270s AD, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a richly embroidered long-sleeved tunic with a decorated hem and belt, baggy embroidered trousers, soft leather boots, and a cloth headband, no helmet. Short dark beard. Realistic proportions, historically accurate, worn and practical, earthy colours. No shield, no weapons, no cloak, no backpack, no quiver, no text or inscriptions, no modern objects, no fantasy elements.
```
**palmyrene-cavalry**

```text
Full-body Palmyrene heavy cavalryman of the 270s AD, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears full armour of bronze scales with mail sleeves and mail leggings, armoured boots, and a conical helmet with a mail aventail, face visible. Short dark beard. Realistic proportions, historically accurate, worn and practical, earthy colours. No shield, no weapons, no cloak, no backpack, no quiver, no text or inscriptions, no modern objects, no fantasy elements.
```
**civilian-escort**

```text
Full-body provincial Roman civilian traveller of the mid-3rd century AD, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a long-sleeved faded blue-grey wool tunic to the knee with a rope belt, wool leggings and worn leather shoes. Short brown hair and a short beard, tired face. Realistic proportions, historically accurate, worn and practical, earthy colours. No shield, no weapons, no cloak, no backpack, no quiver, no text or inscriptions, no modern objects, no fantasy elements.
```

## Chapter V world-building pilot · 23 October 2026

Four additional Tripo text-to-model generations used `v3.1-20260211`, standard geometry, textures and PBR. Each cost 20 credits: **80 credits total**, within the owner's 400-credit pilot cap. Complete prompts, request bodies, task IDs, raw hashes and actual charges are retained in:

- [Cistern request](../art-source/models/requests/ch5-cistern.json)
- [Siege hoist request](../art-source/models/requests/ch5-siege-hoist.json)
- [Damaged masonry request](../art-source/models/requests/ch5-damaged-masonry.json)
- [Household bundles request](../art-source/models/requests/ch5-household-bundles.json)

The generated objects were processed in Blender, reviewed on contact sheets, and exported with compressed geometry and mipmapped KTX2 PBR maps. The household bundle mesh was processed again locally at 7,840 triangles to retain its cloth and basket shapes; this incurred no further generation charge. They are environmental props, without paid rigs or character animation.

The sixteen-component fortress kit and its stone, plaster, timber and canvas surfaces are original procedural Blender work, built by [build-ch5-fortress.py](../scripts/assets/build-ch5-fortress.py), with the editable `.blend` retained under `art-source/models/`. The [pilot guide](chapter-v-world-pilot.md) records integration, review steps and limits. The [credit ledger](../art-source/models/ch5-pilot-credits.json) reconciles the balance from 4,180 to 4,100 and records the remaining 320-credit authorization as unspent. The owner subsequently approved the pilot and the regional extension below; its credit allowance is separate.

## Regional world-building extension · 23 October 2026

The owner approved up to **600 additional Tripo credits** after reviewing Chapter V. Seventeen successful text-to-model tasks used `v3.1-20260211`, standard geometry, textures and PBR, at 20 credits each: **340 consumed, 260 unused and zero reserved**. The [regional credit ledger](../art-source/models/regional-world-credits.json) reconciles each reported charge with the account balance falling from 4,100 to 3,760. Sixteen props were selected; the first rack was not selected because its full-face helmet did not fit the art direction. Its [original request](../art-source/models/requests/equipment-rack-initial.json) and task remain recorded alongside the selected replacement.

All prompts were original text requests with no supplied third-party model or image. Each linked request retains the exact prompt, submitted body, task ID, raw digest, reported charge and the owner's recorded licence terms. Blender processing set the prop heights and triangle budgets, reduced textures to 512 pixels, and exported static models; meshopt and mipmapped KTX2 compression produced the final files in `assets/models/world/`. No new character rig or animation was purchased. The sixteen runtime files total **4,294,648 bytes** before transport compression.

| Selected request | Chapters |
| --- | --- |
| [Legionary cookstation](../art-source/models/requests/legionary-cookstation.json) | I, III, VII |
| [Equipment rack](../art-source/models/requests/equipment-rack.json) | I, IV, VII |
| [Courier table](../art-source/models/requests/courier-table.json) | III, VII, XI |
| [Casualty litter](../art-source/models/requests/casualty-litter.json) | II, VI, VIII |
| [Broken baggage cart](../art-source/models/requests/broken-baggage-cart.json) | II, VI |
| [River ferry](../art-source/models/requests/river-ferry.json) | VIII |
| [Mooring ropes](../art-source/models/requests/mooring-ropes.json) | II, VIII |
| [Eagle rally stand](../art-source/models/requests/eagle-rally-stand.json) | VI, XII |
| [Caravan trough](../art-source/models/requests/caravan-trough.json) | IX |
| [Caravan baggage](../art-source/models/requests/caravan-baggage.json) | IX |
| [Signal brazier](../art-source/models/requests/signal-brazier.json) | IV, VI |
| [Command table](../art-source/models/requests/command-table.json) | VII, XII |
| [Grain bins](../art-source/models/requests/grain-bins.json) | X |
| [Relief cart](../art-source/models/requests/relief-cart.json) | X |
| [Archive cabinet](../art-source/models/requests/archive-cabinet.json) | XI |
| [Civic fountain](../art-source/models/requests/civic-fountain.json) | XI, XII |

The selected rack omits the rejected helmet and has two red oval shield fronts. Four cardinal views of the final compressed rack and archive cabinet confirmed their useful fronts face local +X; authored placement now turns those faces toward their service approach or the playable board. The cookstation's initially unsupported cauldron chain received an original local iron support frame through [refine-cookstation.py](../scripts/assets/refine-cookstation.py). The [refinement report](../art-source/models/reports/legionary-cookstation-refinement.json) records 84 added triangles, contact with the chain and grounded feet, with zero paid calls. Asset review statuses describe their specific inspection scope; they do not stand in for the final production playthrough.

### Original regional architecture

[build-regional-kits.py](../scripts/assets/build-regional-kits.py) authors five kits, each with twelve named components and at most four shared materials. Geometry and deterministic 512-pixel surface bakes are original local work, without external photographs. Editable `.blend` sources, processed GLBs, compression reports and the [complete component bounds](../art-source/models/processed/regional-kits.json) are retained. The sixty components total **34,592 triangles**; compressed runtime kits total **2,024,380 bytes**.

| Kit | Chapters | Triangles | Runtime bytes |
| --- | --- | ---: | ---: |
| Danube military | I, III, IV | 6,892 | 402,160 |
| River wetlands | II, VIII | 6,172 | 365,648 |
| Italian marching | VI, VII | 4,352 | 311,028 |
| Provincial civic | X | 7,648 | 439,964 |
| Roman monumental | IX, XI, XII | 9,528 | 505,580 |

Chapter IX combines the approved eastern fortress kit with selected Roman components. Other pilot props are reused only in chapter packs named by the [world catalog](../src/ui/world-catalog.js); Chapter V's approved composition is retained. The existing civilian body is reused for service roles across all twelve chapters rather than generating new people. These fictional settings and symbolic outcome details do not claim archaeological fidelity or add enterable buildings, naval play or new gameplay rewards.

Final build, browser and benchmark results remain pending in [regional-world-building.md](regional-world-building.md). File-size and triangle totals above are asset measurements, not frame-rate or real-device claims.

## Ground layers and regional skylines · 24 October 2026

Release 2 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md) adds two kinds of art, neither generated by a model service and neither costing Tripo credits.

- **The ground's eleven layers** are CC0 photographic texture sets from Poly Haven, fetched with `npm run asset:cc0`. Each record in `art-source/cc0/` keeps its source page, authors, licence URL and every file's SHA-256 digest, and the two shipped KTX2 arrays (`assets/textures/ground/`) list every layer's record in their manifest entries. CC0 needs no attribution; the authors are credited in the manifest all the same. The [ground section](asset-pipeline.md#the-ground) gives the sets and the processing.
- **Nine regional skylines** (`assets/textures/panoramas/`) are original procedural landscapes rendered in Blender 5.2.2 (Cycles, 64 samples) by [render-panorama.py](../scripts/assets/render-panorama.py): seeded noise terrain, rivers, forests, fields and landmarks built from boxes, roofs and drums. No external image, model or prompt was used. Each region's report in `art-source/panoramas/` keeps its seed, the region's data, the render settings and the render's SHA-256 digest; the renders themselves (8192 by 320 PNG) stay out of the repository and can be made again from the script. [build-panoramas.mjs](../scripts/assets/build-panoramas.mjs) checks each render against its report and encodes it (ETC1S, quality 255, with mipmaps): 217–364 KB a region, 2,856,500 bytes for all nine. The landscapes, cities and camps are evocations, not reconstructions: Rome, Palmyra, Milan and the Euphrates valley are drawn from simple shapes and claim no archaeological fidelity. The [horizon section](asset-pipeline.md#the-horizon) gives the regions and their chapters.

## Persistent identities and massed formations · 26 October 2026

No paid generation, new external model, recording or texture was used. `generated-identity.js` clips the existing generated recruit head at the neck while preserving its UVs, authored smooth normals and skin weights. That same textured head remains on the protagonist's recruit, infantry, officer, commander and civic costumes. Named male heads receive bounded jaw, cheek and nose adjustments, stubble and greying; four original small corrective morphs move the actual head vertices for jaw, focus, concern and blinking. These are authored approximate expressions, not facial capture or phoneme lip sync. Existing female anatomy remains unchanged. The source generated short haircut remains; full hairstyle and tunic customization are still limited to the procedural fallback.

`scripts/build-finale-crowd.mjs` mechanically reduces the already licensed `roman-legionary.glb` overview into 940-triangle front-rank and 136-triangle distant silhouettes, retaining the model's baked vertex colours. The generated 47,428-byte `src/showcase/finale-crowd-data.js` contains the source digest and is listed in the asset manifest. It loads with the deferred 3D renderer, adds no new textures, and is reproduced or checked with `node scripts/build-finale-crowd.mjs [--check]`. Performance uses only the distant silhouette; other tiers reserve the finer mesh for the first rank. A shared vertex shader adds small, staggered breathing/weight shifts while the soles remain stationary. This is not a new set of baked skeletal crowd clips.

The actual Chrome character viewer and Chapter XII renderer were inspected through `scripts/character-upgrade-review.mjs` and the existing stage benchmark. Images and JSON reports are under `tests/visual-results/character-upgrade/` (ignored review output). These show the generated heads, separate rank equipment, cavalry gait phases and injury/morale bearing. Automated resource counts and software-rendered images do not establish physical-device frame rate or a subjective production-quality verdict.

## Full-body motion and scalp silhouettes · 26 October 2026

The subsequent player-experience pass adds original manually specified sole-target channels to `scripts/character-sources/performance-v034.json`, compiled by `scripts/build-character-performance.mjs`. Start, stop, pivot, recoil and recovery now transfer weight through the pelvis and feet before the existing two-bone terrain solve. `actor-gait.js` samples the wounded right leg's shorter support and lower clearance and the sound leg's longer support directly from travelled distance. Its foot velocity during stance still cancels the authoritative root travel. Presentation state remembers plants across a stop and releases on a lift, teleport, explicit reset or excessive turn; it never changes a unit's health, speed, path or attack clock.

The same module authors four-beat horse walk, diagonal trot and asymmetric canter contacts. Live rigs blend gait changes over 0.24 seconds and coordinate the rider's pelvis, torso, thighs and knees with the sampled horse motion. This remains the existing stylized horse mesh with the four-horned saddle and no stirrups; no paid service, animation capture or new animal asset was used.

`generated-identity.js` now reshapes the existing donor scalp into cropped, curly, wavy, swept, receding, shaved and longer-nape silhouettes. Existing cast hair assignments select these bounded crown, side-volume and rear-volume fields; shared uniforms adjust the hairline, nape, ageing and stubble while retaining donor maps. These are geometry and material derivatives of the same generated head, not complete new hair-card grooms or independent head scans. The geometry count, UVs, skin weights, neck seam, texture count and shared shader-source count are preserved. The hero's selected silhouette persists across ranks, and the existing female bound groom is retained. Further sculpted heads and production grooms remain an art-production opportunity.

Focused automated evidence is in `tests/character-motion-polish.test.mjs`: asymmetric support durations and exact planted velocity, full-body transitions and mirrored pivots, unchanged contact clocks, plant continuity, horse contact patterns and rider channels, shared-program cast variants and live rigs across all twelve chapters. Existing generated-body, equipment-contact, neck, material ownership and character-budget regressions remain applicable. These checks do not establish motion-capture quality, physical-device frame rate or human playtest results.

## Fortification board kits · 27 October 2026

Release 4 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md). No paid generation, external model, photograph or prompt was used, and no Tripo credit was spent: the account balance read 3,760 before and after.

[build-board-kit.py](../scripts/assets/build-board-kit.py), run in Blender 5.2.2 LTS (the `bpy` module that `npm run asset:setup` installs), authors three kits, one per masonry family. Each has the same fourteen pieces, every one with a simpler far level: a curtain block, a tower and its stair, a gate frame, gate leaves closed, barred, battered and open, a panel for the rest of a shut gateway, breach rubble, a bridge deck, a damaged deck and the stumps of a demolished bridge, and a rampart breastwork. Every piece is built to the real-time board: a 2.5-metre cell, a 3.2-metre tower deck and its 1.6-metre stair, the curtains 3.2 metres high in stone and mudbrick and 2.5 metres in timber, with the piece's face toward local +x. The script also writes each piece's bounds to `src/showcase/board-kit-components.js`, which the tests read.

Three shared materials (masonry, timber, iron) carry deterministic procedural bakes made by the script from seeded noise: a base colour, a glTF roughness-metalness map and a tangent-space normal map, at 512 pixels (iron at 256). These are tileable sets per material, not true trim sheets. The editable `.blend` files, processed GLBs, their reports in `art-source/models/processed/` and the compression reports in `art-source/models/reports/` are retained. `npm run asset:compress` (meshopt geometry, ETC1S KTX2 textures with mipmaps) made the runtime files in `assets/models/scenery/`:

| Kit | Chapters | Triangles, near and far | Processed GLB | Runtime file |
| --- | --- | ---: | ---: | ---: |
| Stone | VIII, XII | 4,380 and 408 | 931,140 bytes | 322,900 bytes |
| Mudbrick | V, VI, IX | 4,512 and 408 | 853,184 bytes | 319,292 bytes |
| Timber | IV | 3,856 and 372 | 956,472 bytes | 308,544 bytes |

ETC1S keeps the colour maps close to their source (43 dB PSNR) but the normal maps only at 25–27 dB, so their fine relief is blocky at close range.

**Mudbrick re-baked · 28 October 2026.** The first mudbrick bake laid worn plaster over the bricks in large patches 16–40% brighter than them, which read as camouflage at close range. The re-bake keeps a few soft patches close to the bricks' own colour (about a tenth of the surface instead of four tenths) and darkens the joints a shade where no plaster covers them. Geometry, seeds and the other two kits are unchanged; the mudbrick's processed GLB went from 923,524 to 853,184 bytes and its runtime file from 332,432 to 319,292 (`--only mudbrick`, then `npm run asset:compress`). The kits draw only in real-time battles on Balanced and High; on Performance, or when a kit cannot be downloaded, the code-built works of the campaign world upgrade stand in. Where each piece stands, and the checks that keep it off walkable ground, are in the [release report](fortifications-release4-report.md).

## Regional trees and rocks · 28 October 2026

Release 5 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md). The [release report](nature-release5-report.md) has how they are drawn and what they cost.

### Trees

[build-trees.py](../scripts/assets/build-trees.py), run in Blender 5.2.2 LTS, authors three kits, one for each group of chapters that plants the same species (`world-weather.js`). Every species comes three times: near, with trunk, boughs and twigs as tapered tubes and its leaf cards; mid, with fewer boughs and fewer, larger cards; and an impostor of two crossed cards. Trees are built at a real height, then normalised to 0.5 units tall so the runtime scales each to its placement and the foliage wind bends it from its foot. Each kit has one material: a 1,024-pixel atlas of sixteen 256-pixel cells.

- **Bark** is a CC0 Poly Haven texture set, its colour darkened in its crevices by its own ambient occlusion (the ARM map's red channel) and averaged down to one cell: Bark Brown 01 and 02 (Rob Tuytel), Bark Willow (Dario Barresi, Dimitrios Savva), Chinese Cedar Bark and Palm Bark (Charlotte Baglioni), Pine Bark (Dimitrios Savva). The palm's bark is lifted by 1.4, as the photographed set reads black on a trunk. A trunk wraps its cell once round and repeats it along its length in whole segments.
- **Leaf cards** are composed in their cells by the script: painted twigs fanning from the card's foot, carrying sprites cut from CC0 plant textures that Poly Haven publishes with its models (only their named colour and alpha maps, never the models): the fir and pine twigs of Fir Tree 01 and Pine Tree 01 (Rob Tuytel, Rico Cilliers) for fir, pine and umbrella pine, and densely for cypress; the leaves of Island Tree 01 (Rob Tuytel, Rico Cilliers) for beech and poplar; the twigs of Tree Small 02 (Rico Cilliers) for alder; the narrow leaves of Shrub 02 (Rico Cilliers), greyed, for olive; the fronds of Jacaranda Tree (Rob Tuytel, Rico Cilliers), greyed, for tamarisk. Oak, willow and the date palm use the oak, willow and palm cells of the game's own generated foliage atlas (`foliage-v016`), as the code-built trees do: no CC0 source the build could reach offers lobed oak leaves, hanging willow strands or a palm frond. The palm's cell draws its frond along the diagonal, so the card stretches it 1.8 times across to fill the frond's width. The plan named ambientCG's leaf sets; its download host is not reachable from the build's network.
- **Revised after the renders.** Beside the code-built trees, the first kit's date palms were sparse and its willow bare and coarse at close range. Each palm frond is now folded into a V along its rachis, 34 to a crown, and its card stretched to the frond's full width, which its leaflets had filled only a third of. The willow has thinner boughs and more, longer hanging cards, which now carry the game's own willow strands in place of a card composed from Shrub 02; its twigs are no longer drawn as tubes, which showed as dark sticks above the crown, since the cards paint their own. The other species were rebuilt unchanged.
- **Impostors** are rendered from each near tree in Cycles (CPU, orthographic, flat white sky, specular off), halved with premultiplied alpha and lifted by 1.35 toward the near tree's brightness under the game's light.

`npm run asset:cc0 -- fetch polyhaven:<id> --maps …` fetched every source with its digests (`art-source/cc0/`); the raw files stay outside the repository. The editable `.blend` files, the processed GLBs and their reports (`art-source/models/processed/trees-*.json`) are retained. The script also writes each species' crown radius to `src/showcase/tree-kit-components.js`. The runtime files were made with `scripts/assets/quantize-model.mjs` (normals as bytes, texture coordinates as shorts), then `npm run asset:compress` (meshopt geometry, ETC1S KTX2 with mipmaps):

| Kit | Chapters | Species (triangles near, mid, far) | Processed GLB | Runtime file |
| --- | --- | --- | ---: | ---: |
| Temperate | I–IV, VIII, X | oak 1,840, 516, 4; beech 1,840, 516, 4; willow 2,056, 756, 4; alder 1,624, 588, 4; pine 1,984, 528, 4; fir 4,352, 896, 4 | 2,549,772 bytes | 594,256 bytes |
| Italy | VII, XI, XII | poplar 1,936, 804, 4; cypress 1,248, 640, 4; umbrella pine 2,000, 600, 4; olive 1,848, 612, 4 | 1,577,088 bytes | 356,280 bytes |
| Arid | V, VI, IX | date palm 944, 300, 4; tamarisk 2,064, 684, 4 | 845,392 bytes | 165,436 bytes |

In ETC1S the atlases keep 29.5 dB PSNR (temperate), 32.3 dB (Italy) and 35.1 dB (arid). No Tripo credit was spent on the trees.

### Rocks

Twelve rocks, four for each group of chapters, were generated with Tripo's text-to-model API (`v3.1-20260211`, textured PBR, standard geometry, 20 credits each) on 2026-10-28, from the text prompts below only: no reference image or third-party model. The balance read 3,760 credits before and 3,520 after: 240 spent, as the plan allowed. The plan's credit ledger, [`worlds-plan-credits.json`](../art-source/models/worlds-plan-credits.json), reconciles each task's reported credits with the balance. The owner's paid Tripo account gives the owner full rights to use, modify, distribute and commercially exploit them; Tripo holds a royalty-free, non-exclusive licence to display them as needed to provide its service.

Each raw download (about 46 MB, 1.43–1.50 million triangles) was processed by `scripts/assets/process-model.py` to its budget (2,000 triangles; the sandstone kept 2,486 and the temperate outcrop 2,935, as the decimation works by one ratio over all parts), with 512-pixel textures, scaled to the height in its request and stood on its base. [build-rock-kits.py](../scripts/assets/build-rock-kits.py) then assembles each group's four into one kit, each with a far level decimated toward a tenth of its triangles (it keeps the texture's seams, so the far levels have 194–678), and leaves out the roughness-metalness maps: the game draws a rock with one roughness, as its stone. Each was compared with its Tripo render before shipping: the basalt came out a pitted rusty brown rather than dark grey, and the temperate outcrop's layered shale reads close to a dry-stone wall.

| Kit | Rocks (Tripo task) | Heights | Processed GLB | Runtime file |
| --- | --- | --- | ---: | ---: |
| Temperate | boulder (`41c1b4df-4837-4d03-a91b-e9e9d9688496`), outcrop (`523a9ab4-f3b6-4607-ab7b-db2216307420`), river stones (`cac5c18a-fa00-4e80-806b-dd2510628056`), slab (`72744aaa-efa8-4945-9469-8c6e5f67429e`) | 1.2, 1.6, 0.55, 0.45 m | 729,820 bytes | 566,552 bytes |
| Italy | outcrop (`2a4a1db3-d732-4aab-a699-904c66f830bc`), slab (`e8a4adff-dec0-4e85-adea-fcd5b15048e8`), travertine (`e82508a9-dc9c-41df-90a7-d38fc588de4f`), tuff (`ea45fe20-a81a-49f1-9703-041c1727b920`) | 1.5, 0.4, 1.0, 1.1 m | 674,656 bytes | 528,780 bytes |
| Arid | basalt (`dad0d542-1d96-44b8-a292-048c81de014d`), outcrop (`5b4eab6d-3e0a-4a77-b8ee-e397c72b2b97`), sandstone (`fb1ba3b2-1f82-4e24-8dcb-f4a0bd321032`), slab (`80753f25-5510-4085-995b-37efd57bad68`) | 0.9, 1.4, 1.3, 0.4 m | 627,680 bytes | 505,740 bytes |

The raw files stay outside the repository; their digests, the task ids and the parameters Tripo reported are in each request file (`art-source/models/requests/rock-*.json`), and the processing reports in `art-source/models/reports/`.

#### Exact prompts

**rock-arid-basalt**

```text
A dark basalt boulder of the Syrian steppe with a glossy brown desert varnish, rough vesicular surface and rounded edges, pale dust in its pits. Realistic weathered PBR, a single isolated rock with real thickness and interesting geometry from every angle, its underside roughly flat so it sits on the ground. No ground plane, base slab or pedestal, no grass or plants growing on it, no people, animals, text, carvings, tools or modern objects.
```
**rock-arid-outcrop**

```text
A cracked outcrop of pale desert limestone above the Euphrates valley, blocky joints, sharp edges, sun-bleached cream and buff colours with darker weathered seams. Realistic weathered PBR, a single isolated rock with real thickness and interesting geometry from every angle, its underside roughly flat so it sits on the ground. No ground plane, base slab or pedestal, no grass or plants growing on it, no people, animals, text, carvings, tools or modern objects.
```
**rock-arid-sandstone**

```text
A wind-eroded ochre and rust sandstone boulder of the Syrian desert, smooth scooped hollows and fine horizontal bedding lines, sand-polished surfaces. Realistic weathered PBR, a single isolated rock with real thickness and interesting geometry from every angle, its underside roughly flat so it sits on the ground. No ground plane, base slab or pedestal, no grass or plants growing on it, no people, animals, text, carvings, tools or modern objects.
```
**rock-arid-slab**

```text
A flat layered sandstone slab of the desert, buff and red bands, its upper layer flaking away at the edges, wind-polished top. Realistic weathered PBR, a single isolated rock with real thickness and interesting geometry from every angle, its underside roughly flat so it sits on the ground. No ground plane, base slab or pedestal, no grass or plants growing on it, no people, animals, text, carvings, tools or modern objects.
```
**rock-italy-outcrop**

```text
A Mediterranean limestone outcrop, pale ivory stone with grey weathering, sharp karst ridges and small solution pits, a little dry orange lichen. Realistic weathered PBR, a single isolated rock with real thickness and interesting geometry from every angle, its underside roughly flat so it sits on the ground. No ground plane, base slab or pedestal, no grass or plants growing on it, no people, animals, text, carvings, tools or modern objects.
```
**rock-italy-slab**

```text
A flat pale limestone slab of the Italian countryside, lying almost level, cracked across its top, rounded worn edges and grey weathering stains. Realistic weathered PBR, a single isolated rock with real thickness and interesting geometry from every angle, its underside roughly flat so it sits on the ground. No ground plane, base slab or pedestal, no grass or plants growing on it, no people, animals, text, carvings, tools or modern objects.
```
**rock-italy-travertine**

```text
A pale cream travertine boulder from central Italy, its surface pitted and porous with small cavities and fine horizontal banding, warm grey weathering on the exposed side. Realistic weathered PBR, a single isolated rock with real thickness and interesting geometry from every angle, its underside roughly flat so it sits on the ground. No ground plane, base slab or pedestal, no grass or plants growing on it, no people, animals, text, carvings, tools or modern objects.
```
**rock-italy-tuff**

```text
A rounded block of dark grey and brown volcanic tuff from the Roman Campagna, soft porous stone with small embedded pumice fragments and gently eroded edges. Realistic weathered PBR, a single isolated rock with real thickness and interesting geometry from every angle, its underside roughly flat so it sits on the ground. No ground plane, base slab or pedestal, no grass or plants growing on it, no people, animals, text, carvings, tools or modern objects.
```
**rock-temperate-boulder**

```text
A large rounded granite boulder of the lower Danube hills, grey with darker speckles, worn smooth by weather, with soft patches of green moss and pale grey lichen on its upper face and a few frost cracks. Realistic weathered PBR, a single isolated rock with real thickness and interesting geometry from every angle, its underside roughly flat so it sits on the ground. No ground plane, base slab or pedestal, no grass or plants growing on it, no people, animals, text, carvings, tools or modern objects.
```
**rock-temperate-outcrop**

```text
A tilted outcrop of layered grey limestone breaking through the ground, stepped beds with sharp broken edges, frost-shattered corners, rain streaks and thin moss in the joints. Realistic weathered PBR, a single isolated rock with real thickness and interesting geometry from every angle, its underside roughly flat so it sits on the ground. No ground plane, base slab or pedestal, no grass or plants growing on it, no people, animals, text, carvings, tools or modern objects.
```
**rock-temperate-river-stones**

```text
A low cluster of three river-rounded grey and brown cobbles and boulders pressed together, smoothed by water, damp dark lower edges, faint green algae stains. Realistic weathered PBR, a single isolated rock with real thickness and interesting geometry from every angle, its underside roughly flat so it sits on the ground. No ground plane, base slab or pedestal, no grass or plants growing on it, no people, animals, text, carvings, tools or modern objects.
```
**rock-temperate-slab**

```text
A flat weathered slab of grey schist lying almost level, split into two thick plates along its bedding, chipped edges, lichen spots on top. Realistic weathered PBR, a single isolated rock with real thickness and interesting geometry from every angle, its underside roughly flat so it sits on the ground. No ground plane, base slab or pedestal, no grass or plants growing on it, no people, animals, text, carvings, tools or modern objects.
```

## The cast, the chamber and the horses · 28 October 2026

Release 6 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md). The [release report](cast-release6-report.md) has how they are drawn and what they cost, and [the asset pipeline](asset-pipeline.md#the-cast-the-chamber-and-the-horses--2026-10-28) how they are made.

Seventeen models were generated with Tripo's text-to-model API (`v3.1-20260211`, textured PBR, standard geometry, 20 credits each) on 2026-10-28, from the text prompts below only: no reference image or third-party model. The fourteen figures were rigged by Tripo's biped auto-rig (25 credits each); the three horses are meshes only, skinned in Blender to the game's own horse skeleton. Lucan took three attempts (see below). The balance read 3,520 credits before and 2,765 after: 755 spent of the 840 the owner approved, reconciled task by task in the plan's credit ledger, [`worlds-plan-credits.json`](../art-source/models/worlds-plan-credits.json). The owner's paid Tripo account gives the owner full rights to use, modify, distribute and commercially exploit them; Tripo holds a royalty-free, non-exclusive licence to display them as needed to provide its service.

The prompts follow [the historical notes](historical-research.md): soldiers in mail shirts or tunics with long sleeves, dark trousers and closed boots, with broad belts and ring buckles; no segmented plate for AD 250–275; senators in plain white togas, the game drawing each bloc's trim on top; and the eastern horse in the scale trapper found at Dura-Europos. Negative prompts (Tripo's `negative_prompt`) ruled out plate, segmented armour and fantasy details; Varro's and the Roman horse's requests have none.

| Model | Who | Chapters | Tripo task | Rig task | Triangles | Runtime file |
| --- | --- | --- | --- | --- | ---: | ---: |
| char-cast-lucan | Lucan, the protagonist's tent-mate | I–XII | `c42bdf1f-4341-4a24-91d7-124553a84da0` | `761da6b9-87d8-459e-90b8-125aaacd94d5` | 13,197 | 653,468 bytes |
| char-cast-varro | Varro, the drill instructor | I–III, V, VI | `3ff363f9-4600-405d-acb4-615ada7702e5` | `7f595fea-3dbd-4d58-9984-9ce852ba8b1a` | 15,232 | 655,692 bytes |
| char-cast-sabinus | Sabinus, who stands in Lucan's place | II–XII | `4e5eea65-2f80-4f9a-884f-8e5badb7dad8` | `3f05e132-4705-4b24-91ee-38b388dc7ca7` | 14,739 | 688,812 bytes |
| char-cast-naso | Naso, the file's shield-mate | II–X, XII | `9230d938-a07d-4689-875a-a1b79e5ed97d` | `9adf2885-3124-462c-b3c7-05ca5e56340a` | 15,363 | 693,068 bytes |
| char-cast-felix | Felix, archer and scout | III–X, XII | `c2d196f1-f898-4e79-867c-a7aa3f66b3c1` | `8623dfac-8622-4fbd-a6d1-34ee9bd966a2` | 14,054 | 673,688 bytes |
| char-cast-brennus | Brennus, the explorator | III | `14503529-6861-4472-9671-92c85359b75a` | `2a063a5f-6286-4225-b3a1-b8f4980f9043` | 15,125 | 659,252 bytes |
| char-cast-crispus | Crispus, the young tribune | III | `3628a5dc-9ef5-4773-a94d-9a76f513b7c0` | `c5fbdaaf-b98a-4aca-a693-db7954111b5e` | 15,006 | 662,200 bytes |
| char-senator-elder | a senator, about sixty-five | VII, VIII, X–XII | `d27a4bfb-309e-4f38-8a1d-c60f380215e5` | `17c4817a-a6ce-41c6-b0b8-3cd5a4927ab5` | 13,927 | 425,516 bytes |
| char-senator-bearded | a senator, about fifty | VII, VIII, X–XII | `139c681b-c38b-424f-bba1-bbb3403bc121` | `4d7e0050-ed61-40c3-8290-572a405b432c` | 14,046 | 409,524 bytes |
| char-senator-younger | a senator, about forty | VII, VIII, X–XII | `98b5e5d7-9598-44d1-b884-6f7bc49d6987` | `d3146006-8a1b-4bff-b763-e8b380ba5e1a` | 13,905 | 401,184 bytes |
| char-camp-clerk | the camp's clerks and quartermasters | I–XII | `055018e0-8912-4736-be7e-f74cc2938a1f` | `f2bbc6b7-ca6a-4319-a609-cd04c57b2192` | 13,674 | 395,512 bytes |
| char-camp-capsarius | Capsarius Didius and the orderlies | I–XII | `4ba61fec-b221-460e-93c0-4072c5490722` | `72b45b3e-b9df-45a9-949b-5305866deb5e` | 13,731 | 411,120 bytes |
| char-camp-sutler | Syra the sutler | I–III | `c9e83ec4-14ba-4112-a34c-64a443a5f59b` | `d6167b0f-9eff-40fd-8f7c-3e3822646a19` | 13,750 | 410,352 bytes |
| char-roman-cavalry | Roman cavalrymen | VII, IX, XII | `6f7475c7-3a1e-413c-b7e5-937f0a99dfae` | `d5dff328-7898-42ee-aa80-1cbf502a5a5a` | 13,824 | 417,964 bytes |
| horse-roman | Roman riders' horse, a bay | VII, IX, XII | `8bbffabb-f5c9-4e59-88f6-212acfebb1da` | — | 10,800 | 433,300 bytes |
| horse-northern | Gothic riders' horse, a dun | VII | `3175b256-3e46-4153-9293-07005c18e4d7` | — | 10,800 | 421,324 bytes |
| horse-eastern | Persian and Palmyrene heavy cavalry's horse, a grey in scale armour | V, VI, IX | `e082a6db-94f6-46a1-a3c0-6d73f031ad61` | — | 10,859 | 550,740 bytes |

Triangles count both levels of detail and, for the named men, both of their heads; the near bodies have 11,155–11,363 triangles, the near horses 8,929–9,000. Every runtime file is quantized and compressed (meshopt geometry, ETC1S KTX2 with mipmaps) and passes `check-model` within 900,000 bytes, its request's triangles and 1,024-pixel textures. The raw files stay outside the repository; their digests, the task ids and the parameters Tripo reported are in each request file (`art-source/models/requests/`), and the binding, head-wrap and compression reports in `art-source/models/reports/`, with each named man's face as the head wrap's finders saw it (`char-cast-<who>-faces/`).

### Reviewed before shipping

Each model was compared with its Tripo render and then, bound, with the game's own figure in software-rendered close-ups and full views (see the [release report](cast-release6-report.md)). What it showed, and what was kept:

- **Lucan's first two attempts** came back in segmented plate, the first with shoulder plates and a studded belt apron, the second a cuirass of iron hoops with laminated shoulder guards despite a prompt that ruled them out. Both were rejected (65 credits from the retry allowance); the second had been rigged, bound and wrapped for the spending gate before it was replaced. The third, with a negative prompt and the mail described as a chainmail shirt of small interlocking rings, wears mail over his red-brown tunic, as his portrait does.
- **The named men's faces** are their own generated heads' shape and paint on the shared head, which keeps the game's blinks and expressions; every one was checked to blink and to differ from the others. Inside the eyes they all keep the shared head's own paint, which its lids were made for. Each head was scaled to the shared head's eye spacing, by 0.88 (Sabinus and Felix) to 1.02 (Lucan and Crispus). Brennus's long hair needed a longer bake, his beard is trimmed to his jaw, and his light eyes under heavy brows were set from his report picture, as the finder read his brows as eyes.
- **Sleeves.** Crispus's and the clerk's tunics came out short-sleeved, though tunics of the 250s and 260s were long-sleeved; they were kept.
- **Senators** wear sandals and knee-length togas. In the third century a senator's toga reached his feet and he wore closed shoes (calcei); and the trims that name a bloc are the game's own convention, not a senator's marks of rank, which the prompts kept off the togas (no purple stripe).
- **Syra** wears a long dress and headscarf, and her own head, as do the staff and the senators: only the named men wear the shared head.
- **The eastern horse's** trapper of iron scales leaves a raised seat on its back, under the game's saddle, and its ground-length tail was cut at 0.55 m in binding: whole, it swept the ground and the legs as it swung. Sasanian reliefs show war horses' tails tied up short.
- **The northern horse** came out larger than the prompt's stocky breed: the binder scales every horse to the game's horse skeleton.

#### Exact prompts

**char-cast-lucan, attempt 1 (rejected)**

```text
Full-body young Roman legionary of the mid-3rd century AD, about twenty years old, standing in a neutral A-pose for rigging: arms straight and held about 40 degrees away from the body, legs straight and slightly apart, hands in loose fists, facing forward, symmetrical. He wears an iron mail shirt to mid-thigh over a long-sleeved red-brown wool tunic, a leather belt with bronze plates, dark wool trousers and closed leather boots. Bare head with thick wavy dark-brown hair, clean-shaven, a round, friendly open face with full cheeks, a wide mouth and a short straight nose, a light warm complexion. Realistic proportions, historically accurate, worn and practical, earthy colours. No helmet, no shield, no weapons, no cloak, no backpack, no text or inscriptions, no modern objects, no fantasy elements.
```

**char-cast-lucan, attempt 2 (rejected)**

```text
Full-body young Roman legionary of the mid-3rd century AD, about twenty years old, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a short-sleeved shirt of fine iron ring mail (lorica hamata) reaching mid-thigh over a long-sleeved red-brown wool tunic, a plain broad leather belt with a bronze ring buckle, dark wool trousers and closed leather boots. Bare head with thick wavy dark-brown hair, clean-shaven, a round, friendly open face with full cheeks, a wide mouth and a short straight nose, a light warm complexion. Realistic proportions, historically accurate, worn and practical, earthy colours. No plate armour, no segmented armour, no shoulder plates, no studded straps or apron, no helmet, no shield, no weapons, no cloak, no backpack, no text or inscriptions, no modern objects, no fantasy elements.
```

**char-cast-lucan** (third attempt, shipped)

```text
Full-body young late Roman soldier of the mid-3rd century AD, about twenty years old, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a loose chainmail shirt of small interlocking iron rings, short-sleeved and hanging to mid-thigh like a heavy knitted shirt, grey and slightly rusty, over a long-sleeved red-brown wool tunic; a plain broad leather belt with a bronze ring buckle, dark wool trousers and closed leather boots. Bare head with thick wavy dark-brown hair, clean-shaven, a round, friendly open face with full cheeks, a wide mouth and a short straight nose, a light warm complexion. Realistic proportions, historically accurate, worn and practical, earthy colours. No helmet, no shield, no weapons, no cloak, no backpack, no text or inscriptions, no modern objects, no fantasy elements.
```
Negative prompt:

```text
plate armour, lorica segmentata, segmented armour, breastplate, cuirass, muscle cuirass, shoulder plates, pauldrons, metal bands, studded straps, belt apron, helmet, shield, weapon, cloak, fantasy armour
```

**char-cast-varro**

```text
Full-body Roman army drill instructor of the mid-3rd century AD, a veteran about fifty years old, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a long-sleeved undyed brown wool tunic to the knee, a broad leather military belt with bronze plates, dark wool trousers and closed leather boots. Bare head with thinning close-cropped grey hair and a close grey beard, a stocky square face with a heavy jaw, a broad prominent nose, a heavy brow and a weathered, lined face. Realistic proportions, historically accurate, worn and practical, earthy colours. No helmet, no armour, no shield, no weapons, no staff, no cloak, no backpack, no text or inscriptions, no modern objects, no fantasy elements.
```

**char-cast-sabinus**

```text
Full-body late Roman soldier of the mid-3rd century AD, a sturdy broad-shouldered man about thirty years old, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a loose chainmail shirt of small interlocking iron rings, short-sleeved and hanging to mid-thigh like a heavy knitted shirt, grey and slightly rusty, over a long-sleeved dark olive-green wool tunic; a plain broad leather belt with a bronze ring buckle, dark wool trousers and closed leather boots. Bare head with dark, tightly curled cropped hair, a thick short curly black beard, a broad sturdy face with a strong jaw, a warm olive complexion and an alert, dependable expression. Realistic proportions, historically accurate, worn and practical, earthy colours. No helmet, no shield, no weapons, no cloak, no backpack, no text or inscriptions, no modern objects, no fantasy elements.
```
Negative prompt:

```text
plate armour, lorica segmentata, segmented armour, breastplate, cuirass, muscle cuirass, shoulder plates, pauldrons, metal bands, studded straps, belt apron, helmet, shield, weapon, cloak, fantasy armour
```

**char-cast-naso**

```text
Full-body late Roman legionary of the mid-3rd century AD, a strong man in his mid-thirties, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a loose chainmail shirt of small interlocking iron rings, short-sleeved and hanging to mid-thigh like a heavy knitted shirt, grey and slightly rusty, over a long-sleeved off-white wool tunic with narrow dark red bands at the cuffs; a plain broad leather belt with a bronze ring buckle, dark brown wool trousers and closed leather boots. Bare head with short dark hair receding at the temples, a short dark beard with a little grey, a long prominent hooked nose, heavy brows, a weathered olive complexion and a steady, dry expression. Realistic proportions, historically accurate, worn and practical, earthy colours. No helmet, no shield, no weapons, no cloak, no backpack, no text or inscriptions, no modern objects, no fantasy elements.
```
Negative prompt:

```text
plate armour, lorica segmentata, segmented armour, breastplate, cuirass, muscle cuirass, shoulder plates, pauldrons, metal bands, studded straps, belt apron, helmet, shield, weapon, cloak, fantasy armour
```

**char-cast-felix**

```text
Full-body young late Roman archer of the mid-3rd century AD, about twenty-three years old, lean and wiry, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a loose chainmail shirt of small interlocking iron rings, short-sleeved and hanging to the hips like a heavy knitted shirt, grey and slightly rusty, over a long-sleeved light ochre wool tunic to the knee; a leather bracer on the left forearm, a plain leather belt with a bronze ring buckle, close-fitting dark wool trousers and soft leather ankle boots. Bare head with wavy dark-brown hair, light stubble, a narrow lively face with high cheekbones and watchful eyes, a warm tanned complexion. Realistic proportions, historically accurate, worn and practical, earthy colours. No helmet, no shield, no bow, no quiver, no arrows, no weapons, no cloak, no backpack, no text or inscriptions, no modern objects, no fantasy elements.
```
Negative prompt:

```text
plate armour, lorica segmentata, segmented armour, breastplate, cuirass, muscle cuirass, shoulder plates, pauldrons, metal bands, studded straps, belt apron, helmet, shield, weapon, cloak, fantasy armour, bow, quiver
```

**char-cast-brennus**

```text
Full-body frontier scout serving the Roman army in the mid-3rd century AD, a big broad-shouldered man about thirty years old, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a long-sleeved dark green-brown wool tunic to the knee with a woven border at the hem, a broad leather belt with a bronze ring buckle, loose grey-brown wool trousers bound with leather straps below the knee, and soft leather shoes. Bare head with long reddish-brown hair tied back at the nape, a full thick beard, a broad face with a heavy jaw, a fair weathered complexion and a patient, watchful expression. Realistic proportions, historically accurate, worn and practical, earthy colours. No armour, no helmet, no shield, no weapons, no cloak, no hood, no fur, no backpack, no text or inscriptions, no modern objects, no fantasy elements.
```
Negative prompt:

```text
chainmail, plate armour, lorica segmentata, breastplate, cuirass, shoulder plates, pauldrons, fur, horned helmet, helmet, shield, weapon, cloak, hood, viking, fantasy armour
```

**char-cast-crispus**

```text
Full-body young Roman military tribune of the mid-3rd century AD, an aristocratic officer of about twenty-seven, slender, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears an expensive long-sleeved white wool tunic to the knee with narrow purple stripes from the shoulders and purple bands at the cuffs, a broad military belt with ornate bronze fittings and a ring buckle, close-fitting dark trousers and fine closed leather boots. Bare head with neat dark hair brushed forward, clean-shaven, a narrow elegant face with a straight aquiline nose, a pale olive complexion and a composed, challenging expression. Realistic proportions, historically accurate, refined but restrained, muted colours. No armour, no helmet, no shield, no weapons, no cloak, no sash, no jewellery, no text or inscriptions, no modern objects, no fantasy elements.
```
Negative prompt:

```text
chainmail, plate armour, lorica segmentata, segmented armour, breastplate, cuirass, muscle cuirass, shoulder plates, pauldrons, helmet, shield, weapon, cloak, toga, gold armour, fantasy armour
```

**char-senator-elder**

```text
Full-body Roman senator of the mid-3rd century AD, a thin elderly man about sixty-five, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a large plain white wool toga over the left shoulder and across the body, its folds gathered into a broad flat band running diagonally across the chest from the left shoulder to the right hip, over a long-sleeved white tunic that shows on both arms; reddish-brown closed shoes. Both arms free of the toga. Bare head with thin white hair receding high, clean-shaven, a long lined face with an aquiline nose and a dry, judging expression, a pale olive complexion. Realistic proportions, historically accurate, muted colours. No coloured stripes or borders, no armour, no weapons, no cloak, no laurel or crown, no jewellery, no text or inscriptions, no modern objects, no fantasy elements.
```
Negative prompt:

```text
purple stripe, coloured border, red stripe, armour, chainmail, helmet, weapon, cloak, cape, laurel, crown, gold, jewellery, modern suit, fantasy, cartoon
```

**char-senator-bearded**

```text
Full-body Roman senator of the mid-3rd century AD, a heavy-set man about fifty, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a large plain white wool toga over the left shoulder and across the body, its folds gathered into a broad flat band running diagonally across the chest from the left shoulder to the right hip, over a long-sleeved white tunic that shows on both arms; reddish-brown closed shoes. Both arms free of the toga. Bare head with short curly grey-brown hair and a short full grey beard, as many third-century senators wore, a broad round face with a heavy brow and a shrewd expression, a warm olive complexion. Realistic proportions, historically accurate, muted colours. No coloured stripes or borders, no armour, no weapons, no cloak, no laurel or crown, no jewellery, no text or inscriptions, no modern objects, no fantasy elements.
```
Negative prompt:

```text
purple stripe, coloured border, red stripe, armour, chainmail, helmet, weapon, cloak, cape, laurel, crown, gold, jewellery, modern suit, fantasy, cartoon
```

**char-senator-younger**

```text
Full-body Roman senator of the mid-3rd century AD, a fit man about forty, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a large plain white wool toga over the left shoulder and across the body, its folds gathered into a broad flat band running diagonally across the chest from the left shoulder to the right hip, over a long-sleeved white tunic that shows on both arms; reddish-brown closed shoes. Both arms free of the toga. Bare head with short dark hair brushed forward and a close-trimmed dark beard, a square face with a straight nose and an alert, ambitious expression, a light olive complexion. Realistic proportions, historically accurate, muted colours. No coloured stripes or borders, no armour, no weapons, no cloak, no laurel or crown, no jewellery, no text or inscriptions, no modern objects, no fantasy elements.
```
Negative prompt:

```text
purple stripe, coloured border, red stripe, armour, chainmail, helmet, weapon, cloak, cape, laurel, crown, gold, jewellery, modern suit, fantasy, cartoon
```

**char-camp-clerk**

```text
Full-body Roman army clerk of the mid-3rd century AD, a thin, stooped man about forty-five, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a long-sleeved off-white wool tunic to the knee with narrow dark blue bands at the cuffs, a plain leather belt with a bronze ring buckle and a small leather pouch, dark wool trousers and closed leather shoes. Bare head with short dark hair greying at the temples, clean-shaven, a narrow careful face with deep lines and tired, attentive eyes, an olive complexion. Realistic proportions, historically accurate, worn and practical, earthy colours. No armour, no helmet, no shield, no weapons, no cloak, no hat, no backpack, no tablets or scrolls, no text or inscriptions, no modern objects, no fantasy elements.
```
Negative prompt:

```text
chainmail, plate armour, lorica segmentata, breastplate, cuirass, helmet, shield, weapon, cloak, toga, hat, glasses, backpack, fantasy armour
```

**char-camp-capsarius**

```text
Full-body Roman army medical orderly (capsarius) of the mid-3rd century AD, a solid man about forty, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a long-sleeved undyed light brown wool tunic to the knee, a broad leather belt with a bronze ring buckle, a small cylindrical leather case for bandages on a strap at his left hip, dark wool trousers and closed leather boots. Bare head with short dark hair, a short dark beard, a calm practical face with kind eyes and a tanned complexion. Realistic proportions, historically accurate, worn and practical, earthy colours. No armour, no helmet, no shield, no weapons, no cloak, no blood, no backpack, no text or inscriptions, no modern objects, no fantasy elements.
```
Negative prompt:

```text
chainmail, plate armour, lorica segmentata, breastplate, cuirass, helmet, shield, weapon, cloak, toga, blood, apron, backpack, fantasy armour
```

**char-camp-sutler**

```text
Full-body provincial woman of the mid-3rd century AD, a trader from Syria who keeps a stall outside a Roman army camp on the Danube, about thirty-five, standing in a T-pose for rigging: her arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. She wears a long-sleeved ankle-length wool dress in faded madder red, belted at the waist with a woven girdle and a small leather purse, and closed leather shoes. Her dark hair is bound up under a simple undyed wool headscarf; a shrewd, good-humoured face with dark eyes and a weathered olive complexion. Realistic proportions, historically accurate, worn and practical, earthy colours. No armour, no helmet, no weapons, no cloak, no basket, no jewellery but small bronze earrings, no text or inscriptions, no modern objects, no fantasy elements.
```
Negative prompt:

```text
armour, chainmail, helmet, weapon, cloak, veil over the face, crown, jewellery, gold, low neckline, modern dress, fantasy, cartoon
```

**char-roman-cavalry**

```text
Full-body Roman cavalryman of the mid-3rd century AD, about thirty, standing in a T-pose for rigging: arms straight out to the sides, legs straight and slightly apart, facing forward, symmetrical. He wears a loose chainmail shirt of small interlocking iron rings, short-sleeved and hanging to mid-thigh like a heavy knitted shirt, over a long-sleeved red-brown wool tunic; a broad leather belt with a bronze ring buckle, close-fitting dark wool trousers and closed leather riding boots, and a plain iron cavalry helmet with a deep bowl, large cheek guards covering the ears and a short neck guard. A short dark beard and a weathered face. Realistic proportions, historically accurate, worn and practical, earthy colours. No crest, no plume, no face mask, no shield, no weapons, no cloak, no backpack, no text or inscriptions, no modern objects, no fantasy elements.
```
Negative prompt:

```text
plate armour, lorica segmentata, segmented armour, breastplate, cuirass, shoulder plates, pauldrons, crest, plume, face mask, shield, weapon, cloak, horse, fantasy armour
```

**horse-roman**

```text
A Roman cavalry horse of the mid-3rd century AD standing square for rigging: all four legs straight and vertical, evenly spaced, head raised and facing forward, tail hanging straight down, symmetrical. A sturdy, compact riding horse about 1.45 metres at the withers, bay coat with black mane, tail and lower legs, a plain leather bridle with a bronze-studded browband and the reins resting on the neck. Realistic proportions, anatomically accurate. No saddle, no saddle cloth, no rider, no armour, no harness beyond the bridle, no text or inscriptions, no modern objects, no fantasy elements.
```

**horse-northern**

```text
A Gothic warrior's horse of the mid-3rd century AD from the lands north of the Danube, standing square for rigging: all four legs straight and vertical, evenly spaced, head raised and facing forward, tail hanging straight down, symmetrical. A small, stocky, hardy northern horse about 1.35 metres at the withers, with a deep chest, short strong legs and a thick neck; dun coat with a dark dorsal stripe, a thick dark mane and tail and dark lower legs; a simple leather bridle without ornament, the reins resting on the neck. Realistic proportions, anatomically accurate. No saddle, no saddle cloth, no rider, no armour, no harness beyond the bridle, no text or inscriptions, no modern objects, no fantasy elements.
```
Negative prompt:

```text
saddle, saddle cloth, rider, person, armour, horse armour, horns, wings, extra legs, fantasy, cartoon
```

**horse-eastern**

```text
An armoured cavalry horse of the Sasanian Persian and Palmyrene heavy cavalry of the mid-3rd century AD, standing square for rigging: all four legs straight and vertical, evenly spaced, head raised and facing forward, tail hanging straight down, symmetrical. A tall, strong horse about 1.55 metres at the withers, grey coat with a dark mane and tail. It wears a close-fitting armour trapper of small overlapping iron scales sewn on leather, covering the neck, chest and body down to the belly, with an open space on the back where a saddle sits, like the scale horse armour found at Dura-Europos, and a plain leather bridle; the legs below the trapper are bare. Realistic proportions, anatomically accurate, worn and practical. No saddle, no saddle cloth, no rider, no face mask, no plumes, no spikes, no text or inscriptions, no modern objects, no fantasy elements.
```
Negative prompt:

```text
saddle, rider, person, plate armour, face mask, plumes, spikes, horns, wings, extra legs, armoured legs, fantasy, cartoon
```

## The Curia · 29 October 2026

Release 9 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md). No paid generation, external model, photograph or prompt was used, and no Tripo credit was spent.

[build-curia.py](../scripts/assets/build-curia.py), run in Blender 5.2.2 LTS (the `bpy` module that `npm run asset:setup` installs), authors the Senate house of Chapters XI and XII around the 8 × 8 chamber board. Its nine pieces are built in place in the hall's own frame, so each stands at the board's centre:

- the floor;
- the senators' steps on each side;
- the west, east and north walls;
- the entrance wall;
- the tribunal;
- the Victory with her altar and lampstands.

The design follows [the historical note on the Curia](historical-research.md):

- the hall of the 270s, as Domitian restored it;
- three wide, low steps carrying the senators' benches;
- the presiding magistrates at the far end;
- three windows over bronze doors;
- the Victory on her globe with a palm and a wreath, and her altar.

It is widened to hold the board: 28 by 31 metres inside instead of about 18 by 27. It keeps the real height of 21 metres. Its marbles, the patterns of its dado and floor, its niches and the windows of its far wall are the game's own. The script also writes each piece's bounds to `src/showcase/curia-kit-components.js`, which the tests and the placement read.

Five materials carry deterministic procedural bakes made by the script from seeded noise: a base colour, a glTF roughness-metalness map and a tangent-space normal map, at 512 pixels. They are white Luna marble, the dado's opus sectile (pavonazzetto and cipollino slabs framed in giallo antico, small porphyry roundels), the floor's opus sectile (porphyry and serpentine roundels, one square to a board tile), ashlar-ruled stucco and oiled bench wood. Gilded bronze, dark bronze and madder wool are plain material factors with no texture. The geometry is built with `bmesh`, one mesh per piece and material. On every run the triangles, positions and textures are the same, but the exported file is not byte-identical: the Victory's triangles can come out in a different order, and two of its normals can differ in the fifth decimal place.

The editable `.blend` file, the processed GLB and its report (`art-source/models/processed/roman-curia-kit.*`) and the compression report (`art-source/models/reports/roman-curia-kit-compress.json`) are retained. As for the tree kits, `quantize-model.mjs` stored the normals as signed bytes (the tiled texture coordinates stay floats), then `npm run asset:compress` (meshopt geometry, ETC1S KTX2 textures with mipmaps) made the runtime file:

| Kit | Chapters | Triangles | Processed GLB | Runtime file |
| --- | --- | ---: | ---: | ---: |
| `roman-curia-kit` | XI, XII | 18,760 | 2,145,904 bytes | 680,196 bytes |

Quantizing took the runtime file from 771,380 to 680,196 bytes; most of what remains is geometry, whose positions and texture coordinates the meshopt codec keeps as stored. ETC1S keeps the colour maps at 34.6–49.0 dB PSNR but the normal maps only at 23.5–30.3 dB, so the joints' fine relief is soft at close range.

### Reviewed before shipping

The hall was first reviewed in Blender's Cycles renderer from the game's overview, horizon and close cameras (not the game's own lighting). Three faults were fixed before any in-game render:

- **The first dado** repeated a strong yellow panel with a dark red roundel every 3.3 metres, which read as a row of playing cards. It now alternates veined pavonazzetto and cipollino slabs in thin giallo frames, with a small roundel on every second slab.
- **The Victory's first wings** were a zigzag surface that rendered as crumpled foil. They are now a smooth, cupped surface with separate tapered feathers along the trailing edge, longest at the tip. A girdle and the overfold of her peplos were added. Her rounded parts are smooth-shaded.
- **The stucco's ruled joints** were dark enough to read as brickwork. They are now light incisions.

The first in-game render (the stage benchmark, in software rendering) showed one more fault. The paving lay exactly on the level terrain, and the two flickered through each other around the board and before the door. The paving now stands 12 millimetres above the ground, and none lies under the board's own floor. The frame round the board reaches down to the ground, so the placed floor keeps its foot at 0.

The Curia draws only on Balanced and High. On Performance, or when it cannot be downloaded, the code-built audience hall and the chamber's colonnades stand in. In Chapters XI and XII those stand-ins are batched within their own groups so the Curia can hide them whole.

## Aurelian's walls · 29 October 2026

[build-aurelian-walls.py](../scripts/assets/build-aurelian-walls.py), run in Blender 5.2.2 LTS like the Curia's builder, authors Rome's new walls beyond the east edge of the finale's field (Chapter XII). Its six pieces each stand on the wall's centre line, with the outer face toward the field:

- a finished 4-metre stretch, with its wall walk, parapet and merlons;
- three stretches still building, at 2.8, 4.2 and 5.6 metres, each with its scaffold, ladder and a stack of new bricks;
- a square tower with its upper chamber;
- the double gateway between its two semicircular towers, 24.4 metres along the wall.

The design follows [the historical note on Aurelian's walls](historical-research.md): brick-faced concrete 3.5 metres thick, a wall walk 6.6 metres up, a square tower every thirty metres and two passages faced in travertine. At runtime the pieces follow the code-built curtain's own pattern of finished and rising stretches (`src/showcase/aurelian-walls.js`). A stretch whose scaffold would stand among the claimant's cohorts is finished instead. The script also writes each piece's bounds to `src/showcase/aurelian-walls-components.js`, which the placement and the tests read.

Four materials carry deterministic procedural bakes from seeded noise, at 512 pixels, as the Curia's do:

- the brick facing (*opus testaceum*): thin bricks in thick mortar, a bonding course of large tiles and an open putlog hole;
- the travertine ashlar of the gate, its faces streaked with pores;
- the concrete core (*opus caementicium*) of tufa and grey rubble, seen where a stretch is unfinished;
- the scaffold timber.

The towers' and the gate's dark interiors are a plain material with no texture. The geometry is built with `bmesh` through the builders shared with the Curia in `kitlib.py`. One of them now welds near-coincident points after cutting openings. An arch's springing used to meet its jamb within rounding, which left 52 zero-area triangles in the walls and made the compressor's geometry check fail. The Curia's triangles are unchanged by the weld: the same set, compared vertex by vertex.

| Kit | Chapters | Triangles | Processed GLB | Runtime file |
| --- | --- | ---: | ---: | ---: |
| `aurelian-walls-kit` | XII | 5,712 | 1,410,024 bytes | 428,656 bytes |

As for the Curia, `quantize-model.mjs` stored the normals as signed bytes, then `npm run asset:compress` made the runtime file. Quantizing took it from 454,496 to 428,656 bytes. ETC1S keeps the colour maps at 37.4–40.2 dB PSNR and the normal maps at 24.4–35.3 dB.

### Reviewed before shipping

The walls were reviewed in Blender's Cycles renderer, assembled along the finale's line from the gate outward (not the game's own lighting). These faults were fixed before any in-game render:

- **The gate's merlons** stood at the curtain's height on the taller gate. They now take the gate's own height.
- **The tower windows** sat off their curve, facing the wrong way. They are now dark arched panels tangent to the curve, just proud of it.
- **Two dark boxes** meant to shade the passages hung inside them like lintels. They were removed.
- **The brick** was too saturated and its putlog holes too large. The brick is toned down and the holes are smaller.
- **Zero-area triangles** at the arches' springings failed the compressor's geometry check. The weld above removes them.

The pieces are merged into one mesh for each of the kit's five materials, since the walls never change and are never picked. The finale therefore draws five walls meshes, not one for each piece and material. The walls draw only on Balanced and High. On Performance, or when the kit cannot be downloaded, the code-built curtain and the regional kit's gate arch stand in. When the walls draw, that arch steps aside for Aurelian's gate.

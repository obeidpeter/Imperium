# Narrative and specialist artwork — v0.4

This records the October 2026 graphics replacement. The earlier [art-generation record](art-generation.md) is retained as the provenance of the previous library, not as a description of current file sizes. All generation used the **built-in image_gen tool**. No API key, paid CLI, external image service at runtime, third-party photograph, or external font is required.

The new narrative library has **30 local WebP files, 875,586 bytes**: 22 portraits and seal images total **357,876 bytes**, and eight scenes total **517,710 bytes**. The additional specialist unit atlas is **202,694 bytes**. These are uncompressed file sums for this agent's assets, not the complete application size or a measured network transfer. The final build report is the authority for application budgets.

## Identity, progression and staging

Seven protagonist portraits preserve the same curly hair, olive skin, brows, nose and jaw while aging from recruit to emperor. The seven visual stages represent approximately ages 20, 25, 30, 36, 43, 45 and 46. These are representative career portraits reused across the twelve chapters, not twelve unique annual portraits. Governor and senator wear civic clothing; the full purple mantle and laurel appear only at accession. The recruit portrait and title scene deliberately omit the lead seal because it has not yet been earned.

Varro, Lucan, Crispus, Severianus, Aelia, Paullus and Sabinus each have neutral and intense expressions. The intense alternatives retain facial identity, costume and light while showing worry, fatigue, grief or resolve. Existing speaker/absence logic decides which character speaks; presentation selects the expression by character and chapter. It does not restore absent characters or change dialogue.

The seven previous scenes are replaced and an eighth accession scene is added. Camp and scene paintings include foreground objects, people, atmosphere and distant space. They are imagined chapter settings, not precise archaeological views or playable maps. The accession crowd intentionally has no identifiable supporting cast, since their fates vary.

Promotions progress from a modest field ceremony through legionary and civic command to the Senate and final imperial acclamation. Scene, portrait, original oath and recurring lead seal carry that progression. The chapter 12 threshold retains the senator portrait; the emperor appears after the existing Receive the oath command. All dialogue and controls remain accessible HTML. Reduced motion disables the added image arrival and scene scale animations. No campaign rule, rank gate, saved value, or story outcome is authored by these views.

## Sources and exact prompts

Only existing project-generated images were supplied as references. Existing reference images and generated sheets were inspected before use. Full generation prompts are saved as plain text:

| Sheet | Prompt | References supplied | Delivered image |
| --- | --- | --- | --- |
| Hero career and seal | [hero-career.txt](graphics-prompts/hero-career.txt) | Previous recruit, prefect and emperor portraits | 1774 × 887, 4 × 2 |
| Cast neutral | [cast-neutral.txt](graphics-prompts/cast-neutral.txt) | Contact sheet of the seven previous NPC portraits; new hero sheet | 1774 × 887, 4 × 2 |
| Cast intense | [cast-intense.txt](graphics-prompts/cast-intense.txt) | New neutral cast sheet; expression-only edit | 1774 × 887, 4 × 2 |
| Frontier scenes | [frontier-scenes.txt](graphics-prompts/frontier-scenes.txt) | Contact sheet of previous environments; new hero sheet | 1672 × 941, 2 × 2 |
| Civic scenes | [civic-scenes.txt](graphics-prompts/civic-scenes.txt) | Previous environment contact sheet; new hero and frontier sheets | 1672 × 941, 2 × 2 |
| Specialist units | [specialists.txt](graphics-prompts/specialists.txt) | New Roman and frontier tactical atlases | 1086 × 1448, 4 × 4 |
| Specialist weapon correction | [specialists-correction.txt](graphics-prompts/specialists-correction.txt) | Generated specialist sheet; correct bottom row column 2 from sword to spear | 1086 × 1448, 4 × 4 |

The built-in image tool saved original PNGs under its generated-images directory. Copies of the five narrative sheets and the corrected specialist sheet are retained in the workspace's `work/graphics-narrative/`. Large original sheets are not shipped in the browser bundle. Each final export's source hash, source dimensions, crop and output hash are recorded in [asset-manifest.json](asset-manifest.json).

The original generated filenames for this revision are:

- Hero: `exec-aac645c6-68bf-4eb2-87c1-e9ed51342b09.png`
- Neutral cast: `exec-fac00e72-2305-4743-a869-0148bb58b19d.png`
- Intense cast: `exec-2af80889-3dc2-444e-bcb6-76b1bff900e1.png`
- Frontier scenes: `exec-edc8b905-3200-49a5-990f-3f3b51ab45a5.png`
- Civic scenes: `exec-a16ae001-16dd-4fc4-bd2f-777cd23cef6d.png`
- Specialist first pass: `exec-4a250b9a-bd58-46ab-bfa3-b2adc86db4d7.png`
- Specialist corrected source: `exec-fa4d9585-bc55-4aae-bbb7-1f122a48efe8.png`

## Reproducible mechanical exports

Python with Pillow is a development-only dependency. It crops, downsamples and compresses already-approved generated art; it does not generate, paint, retouch or invent detail.

```sh
python scripts/export-narrative-art.py --source-dir /path/to/graphics-narrative
python scripts/export-specialist-art.py /path/to/graphics-narrative/specialists-corrected.png
```

Narrative exports inset each cell by two pixels. Hero portraits are 400 × 400 at WebP quality 74; NPC portraits are 336 × 336 at quality 74 neutral or 72 intense; the seal is 256 × 256 at quality 80. Scenes are 768 pixels wide at quality 76, except the 832-pixel title scene at quality 80. Aspect ratios follow their crops. Lanczos scaling and WebP method 6 are used, without enlarging narrative source crops. The exporter checks a 400 KB portrait allocation and 1.1 MB combined narrative allocation.

The specialist sheet retains generated transparency. Its measured alpha range is 0–255. Transparent source row boundaries are 0, 361, 714, 1078 and 1448. Each cropped figure is bounded by alpha greater than 12, fit inside 176 × 232 pixels, horizontally centered in a 192 × 256 cell, with feet at local y=240. The final atlas is 768 × 1024, WebP quality 80 and method 6. Its exporter checks a 230 KB allocation.

Specialist row order is **Gothic bow archer, Roman bow archer, Persian spear infantry, Palmyrene spear infantry**. The four columns face **east/lower-right front, south/lower-left front, north/upper-right rear, west/upper-left rear**. These are four authored direction images per archetype. Runtime gait and gesture transforms are procedural presentation, not fully authored walk or attack frame cycles.

## Review and limits

All generated sheets were visually reviewed. Final-size emperor, accession and specialist exports were also inspected. The Palmyrene south-facing weapon inconsistency was corrected through a targeted built-in image edit before normalization. The final specialist sheet has all sixteen complete figures and consistent spear equipment; bows and faction clothing remain readable.

The targeted UI/event and legal graphics-fixture suites passed **7/7** after this integration. Those checks cover state-preserving presentation and legal campaign rendering; they do not establish enjoyment, physical-device performance or archaeological accuracy. Broader browser, screenshot, size and performance evidence belongs in the overall graphics verification report.

The illustrations are AI-generated for this project. No exclusive copyright or third-party license ownership is asserted. Third-century clothing, mail, scale, oval shields and civic garments are informed by the existing [historical notes](historical-research.md), with deliberate readability conventions and the already-disclosed reconstructed identity seal. No claim of an exact historical uniform is made.

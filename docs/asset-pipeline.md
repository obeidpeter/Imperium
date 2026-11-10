# Generated 3D assets: Tripo, Blender and the browser game

The owner asked on 2026-10-20 to upgrade the browser game's 3D assets with models generated in Tripo and refined in Blender. This guide is the workflow, budgets and integration plan. Read it with [CLAUDE.md](../CLAUDE.md), the [asset manifest](asset-manifest.json) and the [art generation record](art-generation.md).

## Status

- **Tripo V3 migration, 2026-11-04:** the development client uses `https://openapi.tripo3d.ai/v3`, with explicit paid-task approval, preserved historical records and verified recovery. See [the migration and recovery guide](tripo-v3-migration.md) for exact endpoint/model changes and validation limits. The released game continues to use bundled assets, without calling Tripo.
- **Regional world-building, 2026-10-23:** the approved Chapter V pilot now extends to the other eleven chapters with five original Blender kits (60 components), sixteen selected Tripo props, context-specific reuse of pilot assets and preparation hubs throughout the campaign. The detailed rollout, spending reconciliation and pending final verification are in [regional-world-building.md](regional-world-building.md).
- **In the game since 0.37.0:** sixteen generated character bodies, one for each kind of figure the battles and ceremonies show: Roman recruits, trainer, legionaries, archers, a centurion and a commander, a civilian, and Gothic, Persian and Palmyrene infantry, archers and riders. They replace the procedural bodies on the game's own skeleton, clips and kit. See [Generated characters in the game](#generated-characters-in-the-game).
- **In the game since 0.36.0:** five Tripo props for Chapter V, a supply camp on open ground off the board's west and south sides. They load at Balanced and High quality, in Chapter V's download only. See [Generated scenery in the game](#generated-scenery-in-the-game).
- **Compressed since the asset foundation:** every body and prop ships with KTX2 textures and meshopt geometry ([Compression](#compression)).
- **Tooling:** the Tripo client (generation and rigging), the Blender processing and binding steps, the quantizer, the compressor (KTX2 textures and meshopt geometry), the model checker and the preview renderer (see [Checked so far](#checked-so-far) and [Compression](#compression)).
- **Requests and provenance:** [`art-source/models/requests/`](../art-source/models/requests/) holds each exact prompt, Tripo task, rig task, model version, licence and raw digests; [`art-source/models/reports/`](../art-source/models/reports/) holds the processing and binding reports.

## One-time setup

1. **Tripo access**, in the cloud environment's settings, by the owner:
   - Allow `openapi.tripo3d.ai` and the hosts serving the returned model links. Historical downloads used `tripo-data.rg1.data.tripo3d.com`. Model hosts receive no API authorization header.
   - Reuse the existing key through `TRIPO_API_KEY`. V3 uses the same Bearer key as V2; no rotation or new key is required for migration. For an environment-managed **network secret**, the owner must approve its scope for `openapi.tripo3d.ai`, header `Authorization`, prefix `Bearer`, and explicitly enable `TRIPO_PROXY_AUTH=1`. A secret restricted to the old host will not authenticate the new host. The client does not change secret settings or read a credential store itself.
   - Check access without generating anything: `npm run asset:tripo -- balance` reads `/v3/account/balance` and prints available and frozen credits. Missing authentication fails locally; HTTP 401 or code 1002 means the supplied key or proxy authentication was rejected. Keep existing Windows encrypted-key loaders; do not rerun key setup to perform an API check.
   - Never commit the key or paste it into a chat.
**In one command:** `npm run asset:setup` installs Blender's Python module, builds the Basis Universal encoder and installs the glTF-Transform modules and Playwright under `.tools/` (ignored by git). It writes `.tools/env.ps1` on Windows or `.tools/env.sh` on Unix to set `BLENDER_PYTHON`, `BASISU`, `ASSET_MODULES` and `PLAYWRIGHT_MODULE`. Load the generated script in the same terminal before running asset commands:

```powershell
# Windows PowerShell
. ./.tools/env.ps1
```

```sh
# Unix shell
. .tools/env.sh
```

`npm run asset:setup -- --check` installs nothing and reports which tools work; `--only bpy,basisu` limits it and `--dir` puts them elsewhere. Setup requires Node.js with npm, Python 3.13, CMake, a C++ compiler, `curl` and `tar`, and network access to PyPI, npm and crates.io. On Windows, Python may be available through `py -3.13`; install the Visual Studio C++ build tools for CMake's Visual Studio generator. The encoder is built in Release configuration. Its source comes from the crates.io package `basis-universal-sys` 0.3.1, which vendors Basis Universal 1.16.4. Existing separate Windows tool configuration can still be used; this command does not read or replace the Tripo key. Each step by hand:

2. **Blender**, either way:
   - Blender's Python module: `python3 -m venv /tmp/blender && /tmp/blender/bin/pip install bpy==5.2.2`, then `export BLENDER_PYTHON=/tmp/blender/bin/python`. The wheel must match the Python version (5.2.2 installs on Python 3.13); it takes about 1 GB.
   - The Blender 5.2 application: `export BLENDER=/path/to/blender`.
3. **Previews** need Playwright, as the smoke test does: `npm install --no-save --no-package-lock playwright@1.56.1`, or set `PLAYWRIGHT_MODULE`. Neither Blender nor Playwright is a project dependency.
4. **Compression** needs two things, neither a project dependency:
   - The Basis Universal encoder, built from [its source](https://github.com/BinomialLLC/basis_universal) (version 1.16.4 here; it needs `cmake` and a C++ compiler): `cmake -S basis_universal -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j`, then `export BASISU=/path/to/basisu` (or put `basisu` on `PATH`).
   - The glTF-Transform modules: `npm install --no-save --no-package-lock @gltf-transform/core@4.5.1 @gltf-transform/extensions@4.5.1 @gltf-transform/functions@4.5.1 meshoptimizer@1.3.0 sharp@0.35.5`, or set `ASSET_MODULES` to a folder whose `node_modules` holds them.

## Workflow for each asset

1. **Request.** `art-source/models/requests/<id>.json` holds the exact prompt, kept verbatim as CLAUDE.md requires, plus the chapters, the use and the budget. The owner approves the prompt.
2. **Generate.** Use Tripo's HTTP API (the network secret authenticates it): text-to-model, or image-to-model from a reference the project owns.
   - Save the result as `art-source/models/raw/<id>.glb`. Raw downloads are gitignored; the provenance and processed model are committed.
   - Record the task id, model version, date, raw SHA-256 and the licence of the owner's plan in the request file.
   - First use `npm run asset:tripo -- generate art-source/models/requests/<id>.json --dry-run` to review the exact V3 endpoint, pinned models and payload. After approval of this request and its cost, replace `--dry-run` with `--allow-paid`. Generation persists a submission record before the POST and the returned task ID before polling. Ambiguous submissions block a second POST. `resume` only finishes a recorded generation; `balance` only reads the balance. Historical prices are evidence, not current spending authorization.
   - For a character, preview `npm run asset:tripo -- rig art-source/models/requests/<id>.json --dry-run`, then use `--allow-paid` only after approval. The free rig check is recorded separately; a successful compatible check precedes the paid rig. `resume-rig` only recovers an existing rig. The default stays on the supported `v1.0-20240301` biped rig used by the Blender binder; newer skeletons need separate art validation. Ask for a T-pose or A-pose and leave out the shield, weapons, cloak and quiver: the game draws those itself.
   - An animal is bound without credits to the game's own horse skeleton (`scripts/assets/bind-horse.py`), as the horses are: Tripo's free rig check refused a quadruped rig for the calibration mule ([the calibration](graphics-calibration.md)). For a rig Tripo does accept, `retarget` adds one to five of its preset animations (`generator.retarget`, dry-run first), and `resume-retarget` only recovers an existing one.
3. **Process** a prop:
   ```sh
   npm run asset:process -- --input art-source/models/raw/<id>.glb \
     --output assets/models/chapters/<chapter>/<id>.glb --report art-source/models/reports/<id>.json \
     --triangles <budget> --texture <pixels> --height <metres>
   ```
   or **bind** a character (see [The binding script](#the-binding-script)):
   ```sh
   npm run asset:bind -- --input art-source/models/raw/char-<id>-rigged.glb \
     --output assets/models/characters/<id>.glb --report art-source/models/reports/char-<id>.json \
     --triangles 12000 --overview-triangles 2500 --texture 1024
   ```
4. **Compress:** `npm run asset:compress -- <model.glb> <model.glb> --report art-source/models/reports/<id>-compress.json`. Each texture becomes KTX2 and the geometry meshopt; the tool refuses to write a model whose triangles changed (see [Compression](#compression)).
5. **Check:** `npm run asset:check -- <model.glb> --bytes <n> --triangles <n> --texture <n> --min-height <m> --max-height <m>`. It exits non-zero when the model breaks a budget or needs a decoder the game does not ship (Draco).
6. **Preview:** `npm run asset:preview -- <model.glb> <sheet.png>`. Look at the sheet:
   - shape and colours;
   - scale against the 1.8 m figure;
   - floating or missing parts.

   Regenerate rather than ship a poor model. The preview loads the model as the game does, KTX2 and meshopt included.
7. **Record.** Add a runtime entry to the `assets` list in [`asset-manifest.json`](asset-manifest.json) and a note in [`art-generation.md`](art-generation.md). `scripts/verify-assets.mjs` checks the bytes and SHA-256 of every entry. The entry needs:
   - the source: generator, model version, task id, and the prompt file;
   - the processing and compression settings, from the reports;
   - the export: format, bytes, SHA-256 and triangles;
   - the licence under the owner's Tripo plan.
8. **Integrate.** Put a chapter-specific prop in `assets/models/chapters/<NN>/`, or a shared regional prop in `assets/models/world/`, add it to the [world catalog](../src/ui/world-catalog.js) with its kind and the chapters that show it, and add its placement through [`scenery-models.js`](../src/showcase/scenery-models.js). Regional placement plans live in [`environment-regional-world.js`](../src/showcase/environment-regional-world.js); architectural kits live in `assets/models/scenery/`. Choose visible ground clear of legal walking cells and other scenery, or a fully validated blocked service pocket (see [Generated scenery in the game](#generated-scenery-in-the-game)). Cover loaded geometry and fallback ownership in the scenery tests. Put a character body in `assets/models/characters/` and add the kits it fits and the chapters that show them to [`actor-body-catalog.js`](../src/ui/actor-body-catalog.js); [`actor-bodies.test.mjs`](../tests/actor-bodies.test.mjs) checks those chapters against the real campaign.

## The processing script

[`process-model.py`](../scripts/assets/process-model.py) runs under Blender. For a static prop it:

- drops cameras, lights and import helpers;
- bakes any rig at the file's default pose, so bone-carried parts stay in place, then removes the rig, morphs and clips;
- bakes every transform into the meshes and welds duplicate vertices;
- decimates every part by one ratio to meet the triangle budget;
- marks edges sharper than 35° as hard;
- scales to a height if one is given, and stands the model on its base at the origin;
- shrinks textures to the size limit;
- writes one GLB with WebP textures (`EXT_texture_webp`, read natively by the vendored three.js), plus a JSON report of inputs, digests, settings, counts, bounds and textures.

Two options are for models seen only from afar, such as the horizon's landmarks:

- `--colour-only` keeps each material's colour map alone. The normal map is unlinked, and the roughness-metalness map becomes its mean, a constant on the material (glTF keeps roughness in green and metalness in blue). Nodes left feeding nothing are removed, so their images are not exported. The report records the constants. At 115 metres and more the normal map's relief is smaller than a pixel.
- `--turn <degrees>` turns a static model about the vertical axis, counter-clockwise seen from above, before it is stood on its base. The game expects a model's front at +Z: a gate's passages, a temple's porch, a bridge's or an aqueduct's length across the view.

`--keep-skin` keeps a model's own rig, skin weights, morphs and clips and changes only scale and textures. The game's characters do not use it: they are bound to the game's own skeleton instead (next section).

Limitations:

- Materials stay as delivered; the script does no atlas baking. Generated props usually have one material.
- Decimation can thin very fine parts.
- In character mode the file's default pose becomes the bind pose, which can move a skinned part a few centimetres.
- The report counts triangles in Blender, before export. The glTF exporter can drop a few degenerate triangles, so the manifest records the shipped count from `asset:check`.

## The cast, the chamber and the horses · 2026-10-28

Release 6 gives the named men, the chamber's members, the camp's staff, Roman cavalrymen and the horses generated bodies (see [art-generation.md](art-generation.md#the-cast-the-chamber-and-the-horses--28-october-2026) and the [release report](cast-release6-report.md)). Every model is a Tripo text-to-model task. Raw files stay outside the repository. `GET /v3/tasks/<taskId>` provides a recoverable task's download link without generation charges; legacy-task availability must be checked rather than assumed. `tripo.mjs resume` and `resume-rig` restore raw files only when their bytes match the recorded digest, and leave completed historical request files unchanged. Unavailable tasks or changed bytes fail without regenerating or overwriting evidence.

- **Staff, riders and senators.** `npm run asset:bind -- --input art-source/models/raw/char-<id>-rigged.glb --output assets/models/characters/<id>.glb --report art-source/models/reports/char-<id>.json --triangles 12000 --overview-triangles 2500 --texture 1024 --detail-texture 512`, then `npm run asset:compress -- <file> <file> --report art-source/models/reports/char-<id>-compress.json` on that file in place. They keep their own generated heads. A senator adds `--bloc-band`: [`bind-character.py`](../scripts/assets/bind-character.py) lays a band of 7 × 17 points on the front of the toga, 14 cm wide, from the left shoulder by the neck (0.12, 1.38 m) to the right of the waist (−0.14, 1.00 m), where a 3rd-century toga's folded band runs; each point lies 5 mm outside the frontmost surface within 12 mm of it, so the band rides over the folds, and is skinned as the cloth under it. Its texture coordinates are its place in the grid. The report records how many points found no surface (none did).
- **The named men.** Each is bound twice from his rigged source with the settings above, once with 2,048-pixel colour and 1,024-pixel detail maps for his head's paint (the same geometry); [`wrap-cast-head.py`](../scripts/assets/wrap-cast-head.py) then wraps the shared head (the recruit's, bound the same way and unquantized) onto his: `"$BLENDER_PYTHON" scripts/assets/wrap-cast-head.py -- --body <bound.glb> --paint <paint.glb> --donor <recruit.glb> --output <cast.glb> --report art-source/models/reports/char-cast-<who>-wrap.json`. It scales and moves his head onto the shared head's eyes, fits his mouth to its lip line, carries the shared head's vertices onto his surface and bakes his colour, normals and roughness onto a fresh unwrap, keeping the shared head's own paint inside its eyes (`--eyes his` keeps his). It fails when any shown part of the head is left unpainted (`--max-unpainted`), with a picture of where. For a face its finders misread, `--his-eyes right-x,left-x,height` and `--his-mouth height` take landmarks reviewed on the report's pictures, and long hair takes a longer bake (`--bake-cage`, `--bake-reach`). The result is quantized (`node scripts/assets/quantize-model.mjs <cast.glb>`) and compressed as above. The bodies are named `body` and `body-overview`, the heads `cast-head` and `cast-head-overview`.
- **Horses.** `npm run asset:bind -- --horse --input art-source/models/raw/horse-<id>.glb --output assets/models/horses/horse-<id>.glb --report art-source/models/reports/horse-<id>.json`, then compressed as above. [`bind-horse.py`](../scripts/assets/bind-horse.py) fits the horse to the game's horse skeleton on its own legs' rest pose. Below the hocks and knees each leg takes all of its own piece of the mesh (the pieces into which the mesh falls below 0.6 m), so a hoof's toe cannot stay with the body; a tail that hangs free between the hocks, the piece at the middle of the rear from the highest height at which it stands apart, is all tail and is left out of the belly line, so the gaskins follow their legs. `--tail-above <metres>` cuts that piece at a height and closes the cut: the eastern horse's ground-length tail is cut at 0.55 m. Scratch probes that pose the skeleton (legs swung 35–40° and bent, the tail swung 25°) and list the faces that stretch found 75 faces stretched more than 20 cm on the eastern horse before the change and 4 after.
- **In the game.** [`actor-bodies.js`](../src/showcase/actor-bodies.js) reads a senator's band back into its grid (`blocTrimGeometry`), and [`actors.js`](../src/showcase/actors.js) cuts the bloc's trims from it with the same bands as the procedural toga's (`trimBands`, [`bloc-style.js`](../src/ui/bloc-style.js)): broad, double, broken into three lengths, gilt-lined or plain. They are skinned like the band and drawn at both levels of detail, the overview's lifted 12 mm clear of its coarser toga, merged into one mesh for each material, and replace the procedural toga, which a figure keeps until its body arrives. Every part of a body is drawn from its front, as the procedural figures are: the head wrap exports a named man's head two-sided, which drawn so would compile a figure program and a shadow program of its own. The horses keep both sides, as exported: the eastern horse's scale trapper has faces wound inward. [`horse-bodies.js`](../src/showcase/horse-bodies.js) skins a horse's coat to the rider's own horse bones and [`horse-frame.js`](../src/showcase/horse-frame.js) records its rest pose, from which the leg IK turns each leg. A camp's people carry their camp role in their kit (`staff`, [`actor-kit.js`](../src/showcase/actor-kit.js)), which chooses their body and spares them the traveller's bundle.
- **Downloads.** As before, each body and horse is in the offline group of each chapter whose figures wear or ride it, and the exact-chapters test plays both sides of Chapter II's decision, as Sabinus stands in Lucan's place when Lucan leaves.

## The binding script

[`bind-character.py`](../scripts/assets/bind-character.py) runs under Blender and turns a Tripo-rigged character into a body the game can wear. The game animates every figure with one compact skeleton (hips, torso, head; shoulder, elbow and hand on each arm; thigh, knee and ankle on each leg) whose bind pose stands straight with the arms hanging at the sides and every joint unrotated. The script:

- turns the figure to face +Z (glTF) with its left side on +X, and scales it so its hip joint stands at the game's hip height (0.91 m);
- poses Tripo's own rig into the game's bind pose (arms straight down, a little of the drop taken by the clavicles; legs straight; feet level), which deforms the mesh with Tripo's weights;
- welds the vertices the importer splits along texture seams (decimating them apart opened hairline cracks and white specks in close-ups), smooths the shading except across edges sharper than 60°, and decimates the posed mesh to the triangle budget;
- folds Tripo's 41 joints onto the game's 15 (spine, neck and clavicles into the torso, twist joints into their limb, toes into the ankle) and gives everything below the ankle joint to the foot, because auto-rigs often leave the heel on the shin;
- removes the generated hands: the game's own gripping hands, cut for the sword, shield and bow, sit on the hand joints;
- fits the body onto the game's joint positions: each joint's vertices follow a map that carries its segment onto the game's, limbs stretching along their length only, and the feet drop until the soles meet the game's sole plane, 7 cm below the ankles;
- copies a decimated overview level and bakes the texture's colours into it, for the views that draw without textures (fallen bodies);
- shrinks the colour map to `--texture` (1,024 px for the game's bodies) and the normal and roughness/metal maps to `--detail-texture` (512 px), and exports a GLB with WebP maps, skinned to the game's joint names in its bind pose, with a JSON report of inputs, digests, settings, the fit and counts.

[`bind-character.mjs`](../scripts/assets/bind-character.mjs) (`npm run asset:bind`) runs it and then [`quantize-model.mjs`](../scripts/assets/quantize-model.mjs), which stores normals as signed bytes, texture coordinates and colours as normalized integers and skin weights as bytes (`KHR_mesh_quantization`, read natively by the vendored three.js; positions stay floats so the skin's bind matrices are untouched). That cuts the sixteen bodies from 633,664–806,904 to 418,392–557,720 bytes.

Limitations:

- The fit moves the body onto the game's proportions: the game's arms are longer and its shoulders wider than most generated figures', and some shins stretch by a few centimetres.
- Base faces are part of the generated texture, with one face per body. The later named-character renderer adds bounded expression morphs to fitted heads. Aelia retains her own generated head and uses small expression offsets plus feathered eyelid closure sampled from her own skin/PBR maps; neutral geometry and rendering remain unchanged. These are procedural expressions, not facial capture, gaze tracking or phoneme lip sync. Other unmodified generated faces retain their baked expression.
- Colours are baked, so a body cannot take a figure's palette. Shields, cloaks and crests stay the game's own and keep their colours and heraldry.
- Weights come from Tripo's rig. Long robes deform with the legs, and an extreme pose can crease a shoulder.

## Compression

[`compress.mjs`](../scripts/assets/compress.mjs) prepares a processed or bound GLB for the game:

- **Textures** become KTX2 (`KHR_texture_basisu`): Basis Universal ETC1S at the encoder's default quality (128), with mipmaps. Colour maps are encoded as sRGB, normal maps with the encoder's normal-map settings, and metal/roughness maps as linear data. In the game each texture is transcoded to a format the GPU keeps compressed: ETC2 on most phones, BC7 or BC1 on most computers, about a quarter to an eighth of the memory of the decoded image. A 1,024 px colour map takes 0.7–1.4 MB of GPU memory instead of 5.6 MB, and needs no mipmaps made on upload.
- **Geometry** is reordered for the codec and packed with meshopt (`EXT_meshopt_compression`), with no filters and no new quantization, so every stored value is kept. The tool reads both models back and refuses to write unless every triangle, with all its attributes, is unchanged.
- **Report.** The input and output bytes (raw and gzip), the encoder version and settings, and each texture's use, size, original bytes, KTX2 bytes and the encoder's measured error (PSNR, in dB).

**Existing prop geometry.** [`repack-prop.mjs`](../scripts/assets/repack-prop.mjs) applies the character pipeline's bounded normal/UV quantization to an already-compressed static prop, without running the texture encoder again. With the existing `ASSET_MODULES` setup, run `node scripts/assets/repack-prop.mjs <original-compressed.glb> <runtime.glb> --report <geometry-pack.json>`. It refuses skins, animations and morph targets; verifies identical float positions and triangle winding, texture bytes, materials, texture sampling and node hierarchy; and checks every stored quantized attribute after meshopt decoding. Reports retain the original file digest, so the manifest's `geometryRepack` links to the earlier texture-compression provenance instead of replacing it.

On 2026-10-31 this recovered **492,655 gzip bytes** across Chapter VII's eleven unquantized props (three Italian landmarks, the Italian marching kit, four service props and three daily-life props). Every map and triangle remains present, with no texture resizing or mesh simplification. The precision tradeoff is bounded: worst normal-angle change **0.3746°**, worst UV change **0.000007630**, below 0.008 texel even on a 1,024-pixel map. Per-model checks are in `art-source/models/reports/*-geometry-pack.json`; [`prop-geometry-pack.test.mjs`](../tests/prop-geometry-pack.test.mjs) independently reloads the shipped meshes and verifies their original position triangles, texture hashes and savings.

ETC1S trades download size for memory: a KTX2 image is two to three times the size of the WebP it replaces, and it barely shrinks under gzip, while meshopt geometry is a little smaller than before. Data maps fare worst, since ETC1S suits colour better than independent channels.

**The shipped models.** On 2026-10-22 all sixteen bodies and the five Chapter V props were compressed in place, at the default settings, with a report each in [`art-source/models/reports/`](../art-source/models/reports/) (`*-compress.json`) and the previous bytes and digest in their manifest entries. Every triangle came through unchanged. The encoder measured colour maps at 34.8–39.8 dB, normal maps at 31.6–46.6 dB and metal/roughness maps at 26.7–44.5 dB against the WebP images they replace.

| Model | Bytes (before → after) | Gzip (before → after) | PSNR colour / normal / data (dB) |
| --- | ---: | ---: | --- |
| [`ch5-gallery-timbers`](../assets/models/chapters/05/ch5-gallery-timbers.glb) | 271,412 → 266,160 | 182,220 → 257,030 | 35.0 / 39.4 / 44.5 |
| [`ch5-leather-tent`](../assets/models/chapters/05/ch5-leather-tent.glb) | 230,672 → 231,056 | 171,434 → 223,877 | 35.0 / 42.1 / 37.6 |
| [`ch5-mudbrick-stack`](../assets/models/chapters/05/ch5-mudbrick-stack.glb) | 173,144 → 187,856 | 122,554 → 181,516 | 34.8 / 41.1 / 42.5 |
| [`ch5-spoil-baskets`](../assets/models/chapters/05/ch5-spoil-baskets.glb) | 188,228 → 213,856 | 126,816 → 207,198 | 35.5 / 38.9 / 42.8 |
| [`ch5-storage-jars`](../assets/models/chapters/05/ch5-storage-jars.glb) | 161,296 → 181,820 | 124,517 → 176,102 | 38.2 / 43.3 / 41.7 |
| [`civilian-escort`](../assets/models/characters/civilian-escort.glb) | 422,340 → 377,588 | 310,796 → 356,850 | 37.6 / 41.7 / 39.9 |
| [`gothic-archer`](../assets/models/characters/gothic-archer.glb) | 484,744 → 426,424 | 346,281 → 404,513 | 37.6 / 41.1 / 35.0 |
| [`gothic-noble`](../assets/models/characters/gothic-noble.glb) | 498,632 → 441,704 | 365,461 → 419,854 | 36.6 / 39.3 / 28.8 |
| [`gothic-warrior`](../assets/models/characters/gothic-warrior.glb) | 432,708 → 368,820 | 311,507 → 348,152 | 39.8 / 46.6 / 36.5 |
| [`palmyrene-archer`](../assets/models/characters/palmyrene-archer.glb) | 472,440 → 417,196 | 357,778 → 396,349 | 37.1 / 39.0 / 36.0 |
| [`palmyrene-cavalry`](../assets/models/characters/palmyrene-cavalry.glb) | 557,720 → 479,632 | 418,339 → 458,087 | 35.8 / 33.9 / 27.2 |
| [`palmyrene-infantry`](../assets/models/characters/palmyrene-infantry.glb) | 535,356 → 463,580 | 400,263 → 442,748 | 35.5 / 36.5 / 28.1 |
| [`persian-archer`](../assets/models/characters/persian-archer.glb) | 512,640 → 446,880 | 383,419 → 425,887 | 35.1 / 38.2 / 35.2 |
| [`persian-cavalry`](../assets/models/characters/persian-cavalry.glb) | 549,960 → 479,072 | 418,234 → 458,173 | 35.6 / 31.6 / 27.3 |
| [`persian-infantry`](../assets/models/characters/persian-infantry.glb) | 525,572 → 460,068 | 380,885 → 437,679 | 36.1 / 38.4 / 29.0 |
| [`roman-archer`](../assets/models/characters/roman-archer.glb) | 483,852 → 436,028 | 355,078 → 415,144 | 36.2 / 38.3 / 27.9 |
| [`roman-commander`](../assets/models/characters/roman-commander.glb) | 546,208 → 482,700 | 395,645 → 460,600 | 35.6 / 36.3 / 27.0 |
| [`roman-legionary`](../assets/models/characters/roman-legionary.glb) | 508,428 → 447,560 | 369,120 → 426,432 | 36.3 / 38.7 / 28.6 |
| [`roman-officer`](../assets/models/characters/roman-officer.glb) | 537,496 → 471,316 | 397,785 → 449,927 | 35.8 / 36.1 / 26.7 |
| [`roman-recruit`](../assets/models/characters/roman-recruit.glb) | 418,392 → 366,388 | 306,085 → 345,732 | 38.1 / 41.8 / 37.4 |
| [`roman-trainer`](../assets/models/characters/roman-trainer.glb) | 448,620 → 401,064 | 325,109 → 380,285 | 39.0 / 41.4 / 35.2 |
| All 21 | 8,959,860 → 8,046,768 | 6,569,326 → 7,672,135 | |

Each body's three maps (one 1,024 px, two 512 px) took about 8.4 MB of GPU memory decoded with mipmaps; transcoded they take about 2.1 MB as BC7 and 1.0 MB as ETC2 or BC1. A prop's three 512 px maps fall from about 4.2 MB to 0.5–1.0 MB. These are computed from the formats, not measured on a device.

Side-by-side renders of the recruit, the officer, the Palmyrene rider and the storage jars (software rendering with SwiftShader and a simple studio light, not the game's lighting) were reviewed before shipping: whole figures and props look the same; in close-ups of the face and torso the compressed colour maps are slightly softer and blockier around the eyes, and highlights on armour are a little less even. No phone or desktop GPU has been checked, and nobody has judged the figures in play.

**In the game.** [`model-loader.js`](../src/showcase/model-loader.js) gives three.js's `GLTFLoader` the meshopt decoder and the KTX2 loader, both vendored from Three.js 0.186.1 ([provenance](../vendor/three/addons/PROVENANCE.md)):

- `KTX2Loader` starts its transcoder worker from a `blob:` URL, which the page's policy refuses (`worker-src 'self'`). [`basis_worker.js`](../vendor/three/addons/libs/basis/basis_worker.js) is that same worker as a file on the page's own origin, generated by [`ktx2-worker.mjs`](../scripts/assets/ktx2-worker.mjs); a test fails while it differs from what the vendored loader would assemble.
- The page's Content Security Policy adds `'wasm-unsafe-eval'` to `script-src`, and nothing else: it lets the decoders compile WebAssembly, and still evaluates no other code. The arena page carries the same policy.
- The transcoder starts only for a model with KTX2 images, once per page, with at most two workers. The GPU's formats are read from a throwaway WebGL 2 context, as models load before a stage has a renderer; without one, or without a compressed format (S3TC counts only with its sRGB variant), the transcoder writes plain pixels, which every GPU takes.
- A model whose texture cannot be transcoded, or whose geometry cannot be decoded, fails to load as a whole, rather than drawing untextured; its figures and props keep their code-built fallback. A browser that refuses WebAssembly fails every compressed model that way.
- WebP models still load as before, so an uncompressed model works too.

The decoders and transcoder are in every chapter's offline group, about 0.31 MB compressed, as every chapter shows generated bodies. The transcoder's own script is left out: the worker holds it. The local server (`scripts/serve.mjs`) names `.glb`, `.ktx2` and `.wasm` files.

## CC0 textures

Photographic textures for the ground, rock, brick, plaster, wood and roof tiles come from [Poly Haven](https://polyhaven.com/license) and [ambientCG](https://docs.ambientcg.com/license/), whose assets are all CC0 1.0 (public domain dedication). [`cc0.mjs`](../scripts/assets/cc0.mjs) takes them in by id:

- `npm run asset:cc0 -- fetch polyhaven:<id> [--resolution 1k] [--format png] [--maps Diffuse,nor_gl,arm]` reads the asset from Poly Haven's API and downloads the chosen maps from `dl.polyhaven.org`, each checked against the MD5 digest Poly Haven publishes. The defaults suit three.js: colour, the OpenGL-convention normal map, and `arm` (occlusion, roughness and metalness in glTF's channel order).
- A Poly Haven **model** offers its own textures' maps by name (`twig_diff`, `leaves_alpha` and so on): `--maps` must then name them, and only those maps are taken, never the model's meshes. The record notes `"kind": "model textures"`. Release 5's leaf cards come from six such sets.
- `npm run asset:cc0 -- fetch ambientcg:<id> [--resolution 1K-PNG]` reads the asset from ambientCG's API, downloads its archive, checks its size against the one ambientCG lists and extracts the images.
- Either way the files go to `art-source/cc0/raw/<source>-<id>/` (not committed) and a record to `art-source/cc0/<source>-<id>.json`: the asset page, name, authors, licence and its page, retrieval time, the selection, and each file's URL, bytes and SHA-256 (with Poly Haven's MD5, or ambientCG's archive digest). A file that fails its check stops the intake before anything is written.
- `npm run asset:cc0 -- record <record.json> <shipped file> --id <id> --subject <text> --usage <text> --loading <text> --processing <text>` adds a file made from those downloads (a KTX2 texture encoded with `basisu`, for example) to the [asset manifest](asset-manifest.json), or replaces its entry: its source record and the digests of the files it came from, its processing, bytes and SHA-256, and the CC0 licence with its authors credited. It edits only that entry, the totals, the counts and the date, leaving the rest of the file as written.

Network access: `api.polyhaven.com` and `dl.polyhaven.org` for Poly Haven; `ambientcg.com` and the host its downloads redirect to, `acg-download.struffelproductions.com`, for ambientCG. Node's `fetch` ignores `HTTPS_PROXY`, so behind a proxy run it with `NODE_USE_ENV_PROXY=1` (Node 22.21 or later). On 2026-10-22 a Poly Haven texture set (`rocky_terrain_02`, three 1k maps) came through with every digest matching; ambientCG's API answered, but this environment's network policy refused its download host, so its download has been checked against fixtures only ([`cc0-intake.test.mjs`](../tests/cc0-intake.test.mjs)). The ground's layers below are the first CC0 files to ship. Poly Haven's thumbnail server (`cdn.polyhaven.com`) is also refused here; previews were made from each set's 1k colour map instead.

## The ground

Every 3D scene's ground (release 2 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md)) blends eleven photographed layers. Each is a Poly Haven set, taken in on 2026-10-24 with `npm run asset:cc0 -- fetch polyhaven:<id> --resolution 1k --format png --maps Diffuse,nor_gl,Displacement`, and repeats at its real size:

| Layer | Poly Haven set | Size of one tile |
| --- | --- | --- |
| grass | `forrest_ground_01` | 2 m |
| dry grass | `grass_path_2` | 1 m |
| soil | `brown_mud_dry` | 1.3 m |
| mud | `brown_mud_02` | 1.3 m |
| sand | `sand_01` | 1.5 m |
| gravel | `rocks_ground_01` | 2 m |
| rock | `rock_ground` | 1.5 m |
| paving (polygonal, a Roman road) | `grassy_cobblestone` | 2 m |
| slabs | `stone_floor` | 1.85 m |
| arid soil | `dry_ground_rocks` | 4 m |
| cracked earth | `mud_cracked_dry_03` | 1.5 m |

- **Build.** `node scripts/assets/build-ground-set.mjs [--record]` ([source](../scripts/assets/build-ground-set.mjs)) checks every source file against its record's SHA-256, resizes each layer to 512 px (Lanczos) and writes two KTX2 2D arrays with basisu (ETC1S, quality 128, mipmaps): the colour with the displacement map, stretched to the full range, in alpha, for height-blended joins (914 KB), and the OpenGL-convention normal, X in colour and Y in alpha (988 KB). With `--record` it writes both files' manifest entries, which list each layer's source, authors and file digests. It reports each layer's mean colour, which the code-built stand-in draws. At 1,024 px the arrays would take about 5.4 MB, and as UASTC about 7 MB.
- **Placement.** The layers are data in [`ground-layers.js`](../src/ui/ground-layers.js): each region's mixes for open turf, worn ground, roads, banks, wet ground, river beds, sand, rock, a wall's foot, camps, the joints of flagstones and floors, with tints for the season and a brightness for the scenes' light. [`terrain-splat.js`](../src/showcase/terrain-splat.js) turns the board's own cells into a weight map at two texels a metre over the whole ground: cell edges wander up to half a metre, roads come from the road's distance field and never climb a bank, steep relief shows bare soil and stone, and wear, the fort's yard, staged routes and the river's bank add worn and wet ground. It reads a snapshot of the encounter and uses no random generator.
- **Shading.** [`terrain-material.js`](../src/showcase/terrain-material.js) blends the layers by those weights and by their own heights, so pebbles stand out of sand rather than fading into it. Each layer also samples a turned, larger copy of itself, mixed in by a broad noise, so no tile repeats in view. Normals follow the layers on Balanced and High; Performance draws them flat, one program per quality. Beyond the weight map, on the outer ground and the horizon, the region's turf wears toward its worn ground with the ground's soil weight.
- **Download and fallback.** Every chapter's offline pack takes the set (1.9 MB, counted once in the complete campaign), and the battle's preloader loads it with the page's KTX2 transcoder before the scene is built. Until it arrives, or if it cannot, each layer is its flat mean colour, drawn by the same program, and the arrays replace it without a recompile.

## The horizon

Beyond the modelled ridges (550 m), each region's skyline is an original landscape rendered in Blender (release 2 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md)): nine panoramas, one per region, no external image or model.

| Region | Chapters | What it shows |
| --- | --- | --- |
| forest | I, IV, VIII | The Danube across the north, wooded hills, villages and a fort on the Roman bank, the Haemus far to the south |
| reeds | II | Flooded meadow, pools and reed beds, willows, low ridges under a grey morning |
| hills | III | Fields and vineyards over rolling hills, a road station, villas, a fort |
| mesa | V, VI | The Euphrates' valley with its palm groves to the east, buttes on the desert plateau, the Persian siege camp, at dusk |
| alps | VII | The Po plain's fields and poplar rows, Milan's walls, the Alps along the northern sky |
| palmyra | IX | The colonnade and the temple of Bel, the oasis, tower tombs in the western valley, bare ranges |
| farmland | X | Harvest fields south of the Danube, villages, a granary, the Haemus |
| rome | XI | Rome's roofs on every side, the Colosseum, the Palatine, the Capitol, the Pantheon, Aurelian's wall, the Alban and Sabine hills |
| campagna | XII | The Campagna at dusk: aqueducts, tombs and pines along the road, the city behind its wall, a rival camp |

- **Render.** `$BLENDER_PYTHON scripts/assets/render-panorama.py -- --repo . [--only forest,rome]` ([source](../scripts/assets/render-panorama.py)) builds each region from its data (`REGIONS`: relief near and far, mountain ranges in arcs, plains, rivers and pools, forests, fields and landmarks, the sun and the sky's light) and renders it in Cycles (CPU, 64 samples, no denoiser) as an equirectangular band from 4° below the horizon to 10.0625° above, 8192 by 320 pixels, seen from 12 m above the board's centre with the sky transparent. North is the image's centre; a bearing b (clockwise from north) is at u = 0.5 + b / 360. Every surface fades toward a neutral haze with distance (at most 80%, half of it by about 7 km). The battle camera faces north-north-east by default, so each region's chief sights stand between north and east. The PNG stays out of the repository; its report in `art-source/panoramas/<key>.json` keeps the seed, the settings, the region's data and the PNG's SHA-256.
- **Encode.** `node scripts/assets/build-panoramas.mjs [--only mesa] [--record]` ([source](../scripts/assets/build-panoramas.mjs)) checks each PNG against its report and the game's band, gives the clear sky and the strip below the nearest ground the colour of the skyline above or below them (so filtering never darkens a silhouette), folds the band into two rows of 4096 (south through west to north above north through east to south: no side exceeds 4096) and writes `assets/textures/panoramas/<key>-v1.ktx2` with basisu (ETC1S, quality 255, sRGB, mipmaps with clamped edges). `--record` writes each file's manifest entry.
- **In the game.** [`environment-panorama.js`](../src/showcase/environment-panorama.js) draws it on a cylinder 610 m out, where the code-painted backdrop stood, reading each pixel at the elevation it was rendered at. Its foot sinks into the scene's fog like the ridges in front of it; from a degree below its horizon to 1.5° above it rises to a lighter haze (more in dust, mist, rain and at night), so the far ranges stand over the mist. It takes the chapter's fog colour and a little of its sun, dimmer at dawn and dusk and dark at night. The ridges' relief settles from 120 m outward so the panorama, not a bowl of near ridges, makes the skyline. One program draws every region.
- **Download and fallback.** A panorama (217–364 KB; 2.86 MB for all nine) belongs to its chapters' offline packs only and is preloaded before a scene is built; the current region's and the previous one's stay loaded, and an older one is released. Until it arrives, if it cannot, and in council chambers, the code-painted backdrop stands in.

## Budgets

The download budgets are in [`presentation-budget.js`](../src/ui/presentation-budget.js):

| Budget | Limit (bytes) | Used at 0.35.1 | Used at 0.36.0 | Used at 0.37.0 | Used at 0.38.0 | Used with the asset foundation | Used with the soldier's bodies (unreleased) | Used with the regional worlds (unreleased) | Used with release 2: ground, sky and light (unreleased) | Used after #74, 4 November 2026 (unreleased) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| First load | 2,000,000 | 481,240 | 481,462 | 483,045 | 495,064 | 780,452 | 792,130 | 809,581 | 817,259 | 1,046,023 |
| Shell plus Chapter I (the 3D view since the asset foundation) | 18,000,000 (8,000,000 until 0.37.0, then 10,000,000, then 12,000,000 until the worlds and gameplay plan, then 16,000,000 until 4 November 2026) | 7,989,151 | 7,991,510 | 9,654,943 (345,057 left) | 9,495,867 (504,133 left) | 6,576,713 | 6,949,183 | 7,678,904 | 9,989,077 | 15,968,083 |
| Shell plus any one chapter, with its 2D art | 28,000,000 (14,000,000 until the worlds and gameplay plan, then 24,000,000 until #74, then 26,000,000 until 4 November 2026) | | | | | 10,490,504 (Chapter VIII, the largest) | 10,851,859 (Chapter VIII) | 12,589,026 (Chapter V) | 14,824,097 (Chapter V) | 25,384,504 (Chapter XII) |
| Complete campaign | 80,000,000 (24,000,000 until the asset foundation, then 50,000,000) | 11,339,391 | 12,069,291 | 17,918,247 | 17,937,412 | 19,896,578 | 19,912,153 | 26,600,463 | 31,332,292 | 54,954,837 |

The figures are gzip sizes from `dist/build-report.json`, not a browser network trace. `chapterDownloadGzipBytes` there gives each chapter's download on a device's first visit, for the 3D view and with the 2D art. Every file directly in `assets/models/` belongs to every chapter's offline group, Chapter I included. A world asset (a generated prop, a landmark, a kit piece, a texture set or a panorama) belongs to the offline groups of the chapters the [world catalog](../src/ui/world-catalog.js) names, never to all of them (`chapterOfflineAssets` in [`art.js`](../src/ui/art.js)); until the asset foundation, a model's folder `assets/models/chapters/<NN>/` decided it. In 0.36.0 the loader and its wiring added 2,359 bytes to Chapter I's download, and the models added nothing; Chapter V's own group is 6,437,618 bytes.

Release 2 of the plan adds the ground's layers (1.9 MB in every chapter) and one regional skyline per chapter (217–364 KB): Chapter I for the 3D view grows to 9,989,077 bytes, the largest chapter with its 2D art (Chapter V) to 14,824,097 and the complete campaign to 31,332,292.

The [worlds and gameplay plan](worlds-and-gameplay-plan.md) raises three limits: Chapter I for the 3D view to 16 MB, any one chapter with its 2D art to 24 MB, and the complete campaign to 80 MB. The extra room is for the regional ground textures, trees, rocks, board kit, landmarks and new figures to come. The 2 MB first load, the external requirement, is unchanged. Before that work, with the regional worlds of PR #26, Chapter V with its 2D art was the largest chapter at 12,589,026 bytes. Chapter I took 7,678,904 for the 3D view and the complete campaign 26,600,463.

On 4 November 2026 the owner raised two limits again: Chapter I for the 3D view from 16 MB to 18 MB, and any one chapter with its 2D art from 26 MB (#74 had raised it from 24 MB for the five restored faces) to 28 MB. #74's larger recruit and Aelia models had left Chapter I 32 KB of room. The 2 MB first load, the requirements' own limit, and the 80 MB complete campaign are unchanged, and the desktop app, which installs every chapter, is not limited by them.

The asset foundation takes the 2D view's art (unit atlases, action sheets, ground and prop atlases) out of the 3D download: the 2D view and painted figures add it when chosen. It raises the Chapter I limit to 12 MB and the complete campaign to 50 MB for the world models to come, and caps any one chapter's first download, with its 2D art, at 14 MB. The first load grew by about 285 KB between 0.38.0 and this work, more than half of it the real-time modules the shell imports. The 2 MB first load, the external requirement, is unchanged. Then the KTX2 and meshopt decoders (about 0.31 MB in every chapter) and the compressed models (about 1.1 MB more in all) brought Chapter I for the 3D view from 6.02 to 6.58 MB, and the largest chapter with its 2D art is now Chapter VIII.

When the soldier began to wear his generated body in real time and in the kit panel, the recruit's body (366,388 bytes) joined every chapter's group, the archer's Chapter III's, the commander's Chapter XI's and the civilian's Chapter I's. Against the main branch it was built on: Chapter I grew by 357,847 bytes, Chapter VIII with its 2D art by 346,732, and Chapters III and XI, with two bodies each, by 761,915 and 807,385. No file is new, so the complete campaign grew by 952 bytes, the code, and the first load by 625. The columns before this one were measured before the later landing-page and playtest changes.

In 0.38.0 the first load grew by 12,019 bytes: the shell now carries every module the page imports before it runs (the board readout among them) and the performance check. Chapter I shrank by 159,076 bytes because no chapter downloads the pre-0.31 Roman unit atlas any more.

0.37.0 raised the Chapter I limit from 8 MB to 10 MB. Chapter I's figures wear five generated bodies (recruit, trainer, legionary, Gothic warrior and Gothic archer), about 1.66 MB compressed, and the old limit had 8,490 bytes left. The 2 MB first load, the external requirement, is unchanged. A character body belongs to the offline groups of the chapters whose figures wear it, never to all of them.

Proposed limits per asset:

| Kind | Triangles | Texture edge | Bytes |
| --- | ---: | ---: | ---: |
| Small prop | 3,000 | 512 px | 250 KB (200 KB with WebP textures) |
| Large prop or tent | 5,000 | 512 px | 350 KB (300 KB with WebP textures) |
| Building or landmark | 15,000 | 1,024 px | 800 KB (600 KB with WebP textures) |

The limits are for the compressed model. The spoil baskets' own budget rose from 200,000 to 250,000 bytes when they were compressed (213,856 bytes), as their request records.

## Generated scenery in the game

- **Downloads.** A world asset belongs to the offline groups of the chapters the [world catalog](../src/ui/world-catalog.js) names (`chapterOfflineAssets` in [`art.js`](../src/ui/art.js)). Chapter V retains all nine pilot props and its fortress kit. The rollout reuses the tent, storage jars, household bundles, cistern, spoil baskets and brick stack in selected appropriate chapters, and the eastern fortress kit in Chapter IX. The gallery timbers, siege hoist and damaged masonry remain Chapter V only. Five new kits and sixteen new props are assigned to their actual regional scenes; the civilian service body now belongs to all twelve chapter packs. [`world-catalog.test.mjs`](../tests/world-catalog.test.mjs) checks provenance and download ownership; `scripts/verify-assets.mjs` checks each built chapter group holds exactly its own world files.
- **Loader.** [`scenery-models.js`](../src/showcase/scenery-models.js) holds board-relative placements in metres, valid for both tactical and expanded real-time maps. Its [`scenery-cache.js`](../src/showcase/scenery-cache.js) uses reference-counted master leases and a limit of **12 idle masters**. Active stages and the newest preload each hold leases; active resources are never evicted to meet the idle limit. Loading a new chapter sets its desired files, and old masters retire when their last active stage releases them. The preloader pins its files until the stage acquires its own leases or the next preload replaces it. The stage places clones sharing geometry, materials and textures synchronously, so they compile and upload behind the "Preparing" veil. A genuinely late model is prepared before joining the drawn scene.
  - It loads nothing at Performance quality.
  - It stands each model on the lowest ground sample under its footprint.
  - Models never take a pick or a click.
  - Models join the camera cutaway like the rest of the scenery: in horizon, follow and action views, obstructing surfaces open around the selected units. Ordinary overview keeps its full scenery; a running action animation enables the same cutaway. Follow separately checks structural geometry when selected, after two metres of movement, and when scenery finishes loading. Manual camera adjustment remains under player control until Follow is selected again.
  - Disposal releases stage leases. Shared geometry, materials, textures and decoded images are freed only after their last master owner releases them, including resources shared by hidden LOD levels. Closing an unfinished stage retires its pending loads immediately; an obsolete response is disposed on arrival without replacing a newer same-URL request. Geometry remains protected while an asynchronous shader preparation still uses it. A constructor failure also releases its scenery leases.
  - A failed or incomplete architectural kit retains its named procedural architecture; successful component clones hide only their corresponding fallback, restored when the stage's scenery is disposed. Regional props also retain their individual fallback, and interior service pockets retain their simplified service representation. Chapter V's exterior pilot accessories keep their original behavior and may be absent if their model fails. Performance quality uses the architectural and service fallbacks without downloading model files.
  - A quality change rebuilds the set on the new ground.
  - `stage.stats().sceneryResidency` reports cached entries, loaded/loading masters, leases and idle masters for transition checks. [`scenery-cache.test.mjs`](../tests/scenery-cache.test.mjs) covers bounded idle residency, shared ownership, cancellation and retries; scenery integration tests cover preloading, component fallbacks and preparation disposal.

  This is presentation only: no rules state and no gameplay randomness.
- **Content Security Policy.** The page allows `blob:` images but not `blob:` fetches. three.js's default `ImageBitmapLoader` fetches a GLB's embedded textures as `blob:` URLs, which the policy refuses. Since 0.38 [`model-loader.js`](../src/showcase/model-loader.js) decodes them with `createImageBitmap` straight from the GLB's own bytes: no request at all, and the browser decodes off the main thread, so uploading a texture is no longer also decoding it. An image that `createImageBitmap` refuses (or a browser without it) decodes through an image element as before. Since the asset foundation, KTX2 images are transcoded from the same bytes in a worker on the page's own origin, and the policy adds `'wasm-unsafe-eval'` for the decoders (see [Compression](#compression)).
- **Placement.** Battle props remain outside the complete playable rectangle and follow its real size, including expanded real-time maps. Fortress components use their full rotated footprint for clearance. In the compact Chapter V courtyard, the cistern, household bundles and storage jars occupy explicitly authored blocked service pockets near their relevant services. Their complete rotated geometry is uniformly fitted within the pocket with a 0.3 m border; the loader verifies every covered cell is a recorded rock blocker before accepting an interior placement. The same pocket has a procedural fallback on missing assets and Performance quality, so a visual load never changes collision or routes. Service and conversation access remains checked independently against the authoritative map.
- **Regional placement.** Each other hub has three 5 × 5 m blocked service pockets. A generated prop is centered 0.4 m to the right of the pocket center and fitted to a 3.6 × 4.4 m world-aligned area after rotation; a separate left strip holds committed-outcome motifs. Exterior props use nonoverlapping baggage positions beyond the map, while the Chapter VIII ferry sits on the scenic water outside it. Buildings use bounds exported from Blender, face existing approaches and retain their own fallback owners. The final rack and archive cabinet have inspected local +X fronts; placement turns them toward the board or their service approach. [`regional-world.test.mjs`](../tests/regional-world.test.mjs) protects footprint, purity and fallback rules; [`regional-scenery-assets.test.mjs`](../tests/regional-scenery-assets.test.mjs) checks the actual decoded shipped geometry across campaign maps and hubs.
- **Records.** Each model has a runtime entry in [`asset-manifest.json`](asset-manifest.json), with its prompt file, task, model version, raw digest, processing settings, bytes, SHA-256 and licence, plus a section in [`art-generation.md`](art-generation.md).
- **Art direction.** The tactical board, terrain and overlays remain code-drawn. The approved Chapter V pilot and regional expansion add original Blender architecture and selected generated props, with collision authored in the map and rendering kept separate from the rules. Distant architecture is scenery, and visible consequence motifs represent existing records without creating new tasks or rewards.

## Generated characters in the game

- **Which figures.** [`actor-body-catalog.js`](../src/ui/actor-body-catalog.js) maps a figure's kit (faction, role, armour; for the protagonist, a centurion's mail in Chapters IV–VI and a commander's cuirass from Chapter VII) to one of sixteen archetype bodies, and a camp's people by their camp role to the clerk's, the capsarius's or the sutler's. Every battle figure and both ceremonies' figures have one. A named man with a body of his own (`cast-*`) wears it, chosen by who he is, never by his kit; the chamber's members nobody names wear one of the three senators' togas, chosen by their identity, with their bloc's trims drawn on it (see [The cast, the chamber and the horses](#the-cast-the-chamber-and-the-horses--2026-10-28)). The protagonist and the named keep their procedural togas in the chamber; the painted figure style is unchanged.
- **A soldier in his own kit.** In the real-time camps and fields and in the kit panel, the protagonist and his company are drawn in the kit they wear, and each wears the body closest to it: the recruit's tunic until he wears armour, then the legionary's or, for the protagonist as an officer, the centurion's in Chapters IV–VI and the commander's from Chapter VII; a bowman of the company wears the archer's. An armoured body brings its own helmet and armour, whichever he wears. The body's own face, hair and tunic replace the procedural ones, so a player chooses only the cloak's colour; the recorded hair, beard and tunic show on the procedural figure where no body loads.
- **What changes.** A figure that wears a body loses its procedural clothes, armour, head, hair, face and limbs: every procedural surface on the body's own joints, and the helmet and the felt cap worn under it ([`actors.js`](../src/showcase/actors.js), `BODY_REPLACES` in [`actor-bodies.js`](../src/showcase/actor-bodies.js)). The recruit's body is bare-headed, so it keeps the figure's helmet or cap, moved and scaled from the procedural head to cover its head and hair (`headwear` in the catalog); a test checks that every head vertex above the rim, at both levels of detail, lies inside the fitted bowl. The rest stays the game's own and is drawn as before: the rig and every clip, gesture, contact and foot plant; the gripping hands; swords, spears, javelins, shields and their heraldry, bows, arrows, quivers, scabbards and standards; cloaks (purple for the emperor at the accession, since the body's tunic colour is baked) and crests and phalerae, the officer and veteran insignia; horses.
- **Loading.** [`actor-bodies.js`](../src/showcase/actor-bodies.js) loads one master per body, transcoding its KTX2 textures in a worker on the page's own origin within its Content Security Policy ([`model-loader.js`](../src/showcase/model-loader.js); see [Compression](#compression)), and skins it to each figure's own bones in the bind pose. Figures share the master's geometry and materials; each owns only its skinned meshes and skeleton, and disposal never frees the master. A figure starts procedural and switches when its body arrives; a body that fails to load leaves the procedural figure. The canvas reports how many figures wear one (`data-generated-bodies`).
- **Distance and crowds.** Each body has a near level (11,131–11,611 triangles) and an overview level (about 2,500), switched with the figure's other detail. Formation followers instance the overview with the leader's pose history, and fallen bodies bake its colours. The procedural figures measured up to 63,052 near and 11,673 overview triangles ([evidence](evidence/characters-v035.json)).
- **Downloads.** A body is in the offline group of each chapter whose figures wear it (`chapterOfflineAssets` in [`art.js`](../src/ui/art.js)); `scripts/verify-assets.mjs` and the tests check the groups against the catalog, and the catalog against the campaign: its turn-based encounters and ceremonies, its real-time camps and fields, and the kit panel, with what the soldier wears and in mail. The recruit's body is in every chapter's group, as the protagonist wears it whenever he is unarmoured.
- **Records.** Each body has a runtime entry in [`asset-manifest.json`](asset-manifest.json) with its prompt file, Tripo and rig tasks, raw and rigged digests, binding settings, bytes, SHA-256 and licence, and a row and prompt in [`art-generation.md`](art-generation.md).
- **Art direction.** The 3D figures now wear generated bodies over the code-built rig, kit and animation, at the owner's request in October 2026; the code-built figures remain the fallback. The tactical board, terrain, 2D units and overlays stay code-drawn.

## The first batch

These five decorative props for Chapter V (c. AD 256, the Euphrates fortress under siege) were generated on 2026-10-20 and stand outside the playable board:

| Request | In the camp | Budget |
| --- | --- | --- |
| [`ch5-spoil-baskets`](../art-source/models/requests/ch5-spoil-baskets.json) | Spoil baskets from the mine works | 3,000 triangles, 0.6 m |
| [`ch5-gallery-timbers`](../art-source/models/requests/ch5-gallery-timbers.json) | A spare countermine shoring frame | 5,000 triangles, 2.0 m |
| [`ch5-mudbrick-stack`](../art-source/models/requests/ch5-mudbrick-stack.json) | Mudbrick for wall repairs | 3,000 triangles, 0.8 m |
| [`ch5-storage-jars`](../art-source/models/requests/ch5-storage-jars.json) | Terracotta stores | 4,000 triangles, 1.1 m |
| [`ch5-leather-tent`](../art-source/models/requests/ch5-leather-tent.json) | An eight-man leather tent | 5,000 triangles, 1.8 m |

Each prompt adds the same exclusions: no people, animals, text, modern objects or fantasy elements. Each task cost 20 credits. Together the shipped files are 1,024,752 bytes, about 0.73 MB more in the complete campaign download, and they add nothing to Chapter I's download.

## Checked so far

- **Static prop.** With Blender 5.2.2 LTS (the `bpy` module on Python 3.13.16, CPU only), the script processed [`persian-guard-v035.glb`](../art-source/characters/persian-guard-v035.glb). The source is 10,983,392 bytes, with 57,976 triangles in 23 parts, 27 PNG maps, a rig, four clips and three morphs. With an 8,000-triangle, 512 px budget the output is:
  - 400,520 bytes and 7,829 triangles;
  - WebP textures of at most 512 px;
  - 1.925 m tall like the source, standing at the origin.

  The checker passes it, and its preview matches the source's preview.
- **Character mode.** The rig, four clips and three morphs survive, and the default pose matches the source. Across all four clips the animated bounds stay within 4.4 cm of the source's; one skinned part, the shield board, moves.
- **Faults the previews caught, now fixed:**
  - parts carried by bones collapsed to their bones' origins;
  - the importer's hidden bone-display sphere was joined into the model;
  - colours were lost where joined parts had differently named colour attributes.
- **Tripo, 2026-10-20.** Five text-to-model tasks (model `v2.5-20250123`, default settings) cost 20 credits each, 100 in all; 4,900 credits remained. Each raw model was about 17 MB, with about 500,000 triangles and three 2,048 px maps. Processing brought them to 2,937–4,899 triangles and 161,296–271,412 bytes each, and every preview sheet was reviewed before integration. Two differ from their prompts: there are four jars rather than three, without the rope sling or sand, and the mudbrick reads as orange fired brick rather than pale sun-dried mud.
- **Tests.** `npm test` covers:
  - the checker on models and images already in the repository ([`asset-pipeline.test.mjs`](../tests/asset-pipeline.test.mjs));
  - each shipped model's request, licence, manifest entry and budget, and its chapter's download group;
  - placement off the board in both Chapter V encounters, from starts reached legally from New Game;
  - grounding, no picks, the camera cutaway, nothing at Performance quality, release on dispose, and the Content Security Policy rule ([`scenery-models.test.mjs`](../tests/scenery-models.test.mjs)).

  Processing and previews are manual, because they need Blender and Playwright.
- **In the production page.** `npm run smoke` restores a legal Chapter V camp, starts the mine battle in the 3D view and waits for all five models to load; it fails on any page or console error. A control run without the image-element texture loader failed on the policy's `blob:` fetch errors, so the check catches that fault.
- **In the 3D stage (scripted views, not committed).** A probe page built the real stage for both Chapter V encounters at Balanced quality, from legal starts, and rendered overview, horizon and close views with and without the models.
  - The camp shows off the board's south-west in the overview, covers no tile or unit, and is mostly hidden in the horizon view.
  - Once the models load, the camera cutaway covers them: 34 → 39 meshes in the mine battle and 35 → 40 at the wall.
  - From a low view with the tent between the camera and the hero, the tent opens around the hero. With the environment-only cutaway it hid the hero and nearby units.
- **Character bodies, 2026-10-20 and 21.** Sixteen text-to-model tasks (model `v3.0-20250812`, 20 credits each) and sixteen biped rigs (25 credits each) cost 720 credits; 4,180 remained. Each raw model was 21.5–27.5 MB with 662,056–828,362 triangles, and each rigged one 28.3–36.1 MB. Every Tripo render was reviewed before binding. All sixteen bound to 418,392–557,720 bytes (7,935,108 in all), 11,131–11,611 near and 2,499–2,500 overview triangles, soles on the game's sole plane. Three faults led to binding all sixteen again: heels stretched below the sole on the Palmyrene infantry (now everything below the ankle goes to the foot); three 1,024 px maps per body, more texture memory than needed (the normal and roughness/metal maps are now 512 px); and hairline cracks and white specks along texture seams in the character viewer's close-ups (the seams are now welded before decimation).
- **Character tests.** [`actor-bodies.test.mjs`](../tests/actor-bodies.test.mjs) runs both campaigns from New Game and both ceremonies and checks each body's chapters; each body's request, rig, licence, manifest entry, budget, joints, unrotated bind pose and sole plane; that a figure loses its procedural surfaces and keeps its kit; that forearm vertices stay on the forearm through a strike; fallback, late arrival and disposal; followers, including that an archer's followers no longer carry the sword their leader keeps hidden; fallen bodies' colours; and each chapter's download group.
- **In the production page.** `npm run smoke` also waits for the generated bodies in the Chapter V battle; it fails on any page or console error.
- **In the 3D stage (scripted views, not committed).** Probe pages built the real stage from legal starts for the Chapter I road, Chapter II marsh, both Chapter V battles, the Chapter VII legion, the Chapter IX wing and the Chapter XII confrontation, at Balanced quality, plus both ceremonies through the development ceremony page and the development character viewer (idle, walk and the strike's contact frame). Every figure in those scenes wore its body, with no page or console errors. A gallery of all sixteen as game figures, with their kit, read clearly by faction and rank. On the built figure, the accession's palette turns the commander's cloak purple.
- **Cost.** In the Chapter V mine battle the renderer's own counters fell from 649,435 to 456,855 triangles and from 151 to 121 draw calls in the overview, and from 1,137,119 to 797,735 triangles and 204 to 170 calls with the camera 8 m from a figure. These are counts under software rendering, not frame times.
- **Seen but not changed.** The horses are still procedural and now look plain beside their riders. The finale's massed legions are still primitive figures. Shields keep one motif for unnamed figures. Faces are static.
- **Asset foundation, 2026-10-22.** Automated checks, software rendering only:
  - `npm run verify` passed (1,099 tests, the autoplay campaigns, the production build, the asset and offline checks and the character audits), `npm run smoke` passed every scenario with the compressed models, Chapter V's props and bodies in 3D among them, with no page or console errors, and `npm run smoke:polish` passed its 16 checks.
  - A compressed fixture loaded through the game's loader in the production page under its real policy, with no policy violations; a control run without `'wasm-unsafe-eval'` refused the decoder's WebAssembly, and the model failed whole, as designed.
  - Eight bodies took about 300 ms to load the first time on a page (the transcoder starting) and about 100 ms once it was running; the WebP versions took about 160 ms ([`model-loader.js`](../src/showcase/model-loader.js) path in Chromium, no long tasks either way).
  - `npm run benchmark:stage -- --dist --check` on the commit before the KTX2 work and after the compressed models ([before](evidence/stage-benchmark-asset-foundation-before.json), [after](evidence/stage-benchmark-asset-foundation.json)): the same shader programs, draw calls and triangles in all ten runs, no shader compiled in the first frame or in play, every figure in its generated body. Battles were ready 144 ms later on average (from 207 ms sooner to 601 ms later; the container's runs vary by a few hundred milliseconds), and the longest task rose from 95 to 109 ms at most. The first battle on a page pays the transcoder's start; in play the battle's assets load while its briefing is shown.
- **Limits of these checks.** They ran in a CPU-only cloud container with software rendering (SwiftShader). No real device or GPU was involved, frame time and memory were not measured, and nobody has yet judged in play how the camp or the new figures read.

## Chapter V world-building pilot · 2026-10-23

The [pilot review guide](chapter-v-world-pilot.md) records the new courtyard, sixteen-component Blender fortress kit, four additional Tripo objects, integration boundaries and review route. Four generations used **80 of the approved 400 credits**; the reconciled ledger is `art-source/models/ch5-pilot-credits.json`. The four objects and kit add 2,632,836 runtime bytes. Their generation requests, processed sources and compression reports are retained with the asset sources.

The production smoke check now derives the complete Chapter V placement count from the legal encounter instead of assuming the original five objects. `npm run smoke:ch5-pilot -- --river-gate` adds a normal-UI courtyard, preparation, save/restore and two-mission acceptance route; it is included in the usability CI job. See the pilot report for current Windows verification and remaining physical-device/playtester limits.

## Regional world-building rollout · 2026-10-23

The owner approved extension after reviewing the pilot. Five original kits add 60 components, 34,592 triangles and 2,024,380 runtime bytes. Sixteen selected props add 4,294,648 runtime bytes. The separate 600-credit authorization used 340 credits for 17 tasks, including one replacement rack; 260 credits remain unused. The credit ledger reconciles all task charges against the wallet change. The cookstation support repair was done locally in Blender without another paid task.

The [rollout guide](regional-world-building.md) describes regional composition, service pockets, symbolic decision details, spatial sound and the final verification placeholder. The final production and browser results belong there; earlier dated measurements in this document describe their original builds.

## The board kit · 2026-10-27

Release 4 models the real-time battles' own structures. [`build-board-kit.py`](../scripts/assets/build-board-kit.py) authors a stone, a mudbrick and a timber kit in Blender (see [art-generation.md](art-generation.md#fortification-board-kits--27-october-2026)); `npm run asset:compress` and `npm run asset:check` treat them like the other kits.

- **Placement.** [`structure-registry.js`](../src/showcase/structure-registry.js) reads the stage's copy of the battle (its 2.5 m map, fortification record and field objects) and returns one piece per structure cell: a curtain block on every wall cell, a tower and its stair at each fighting deck, a gate's frame and leaves by its state (open, closed, barred while held, battered at 60 integrity or less, rubble once breached), breach rubble, a level bridge deck from bank to bank, and a breastwork on each rampart cell. It is pure: nothing it returns changes the rules' map. [`board-kit.test.mjs`](../tests/board-kit.test.mjs) checks every fortified battle reached by legal commands: a piece on every structure cell, and solid pieces only where the rules let no one walk.
- **Drawing.** [`board-kit.js`](../src/showcase/board-kit.js) draws each mesh of each piece once for all its cells (an `InstancedMesh` per piece and level). Cells within 36 m of the camera show the near piece and the rest the far one, re-chosen when the camera has moved 3 m. The pieces take the camera cutaway and the scenery's light (cloud shadows and the scene's baked occlusion), and their lasting parts (curtains, towers, stairs, breastworks) are placed once more in a passing group for the ground's occlusion bake, so the ground at their feet is shaded as it was by the code-built curtains.
- **Loading.** A chapter's kit belongs to its world pack ([world catalog](../src/ui/world-catalog.js), `kind: 'kit'`) and to the battle's scenery working set, so the loading veil preloads it with the battle's other models. The stage uses it if it has arrived when the world is built; otherwise, on Performance, or if it fails, the code-built works stand in for that stage. The two never mix: a kit that arrives late is used the next time the world is built, normally the next battle.
- **Shared programs.** [`model-materials.js`](../src/showcase/model-materials.js) gives every opaque material of imported art (the kits, the regional kits, Chapter V's fortress, the Tripo props) one set of maps and flags: colour, normal and roughness-metalness maps, a neutral 1×1 texture where a model has none, both sides drawn with its shadow cast as before. So they compile one program instead of one per combination. The environment's unfinished props (cloth, rope, ironwork, roof tiles), the fieldwork, the figures' unmapped surfaces, the fallen figures and every instanced scenery batch were given the same neutral maps, sidedness or instance colour as their neighbours, with the same look. The [release report](fortifications-release4-report.md) gives the counts.

## Trees and rocks · 2026-10-28

Release 5 models the regions' trees and field stones (see [art-generation.md](art-generation.md#regional-trees-and-rocks--28-october-2026) and the [release report](nature-release5-report.md)).

- **Trees.** [`build-trees.py`](../scripts/assets/build-trees.py) (Blender, `"$BLENDER_PYTHON" scripts/assets/build-trees.py -- --repo . [--only <kit>]`) authors one kit for each group of chapters: every species near, mid and as an impostor, normalised to 0.5 units tall, in one 1,024-pixel atlas of CC0 bark, composed leaf cards and impostors. A full run also writes `src/showcase/tree-kit-components.js`. It is deterministic: an unchanged kit's processed GLB and report are rebuilt byte for byte (the `.blend` keeps Blender's own save metadata).
- **Rocks.** Each Tripo rock is processed alone (`npm run asset:process` to 2,000 triangles and 512-pixel textures), then [`build-rock-kits.py`](../scripts/assets/build-rock-kits.py) assembles each group's four with far levels decimated toward a tenth of their triangles, drops the roughness-metalness maps, and writes `src/showcase/rock-kit-components.js`.
- **Shipping.** `node scripts/assets/quantize-model.mjs <processed.glb> assets/models/scenery/<kit>.glb`, then `npm run asset:compress -- <file> <file> --report art-source/models/reports/<kit>-compress.json` on that file in place: quantizing first takes about a quarter off the geometry.
- **Drawing.** [`tree-kit.js`](../src/showcase/tree-kit.js) and [`rock-kit.js`](../src/showcase/rock-kit.js) draw one instanced mesh for each species or rock and level, re-levelled when the camera has moved 3 m (trees near within 30 m and mid within 150 m, rocks near within 18 m: a field holds hundreds of rocks, so a rock cell takes a kit boulder and one smaller rock where the code-built field had four stones, and the plateaus' rims every other stone). Their materials are made by the environment as its own leaf sprays and stone are (`kitMaterial` in [`environment-materials.js`](../src/showcase/environment-materials.js)), with the kit's maps, so they share those surfaces' shader programs and the trees their wind. Every tree stays inside the clearance its plan reserved, and every rock inside the footprint of the stone it replaces.
- **Loading.** Like the board kit, a region's tree and rock kits belong to its chapters' packs and to the scenery working set, and are used only when they have arrived as the world is built; on Performance, or if they fail, the code-built trees and stones stand in.

## The Curia · 2026-10-29

Release 9 models the Senate house of Chapters XI and XII (see [art-generation.md](art-generation.md#the-curia--29-october-2026) and the [historical note](historical-research.md)).

- **Building.** [`build-curia.py`](../scripts/assets/build-curia.py) (Blender, `"$BLENDER_PYTHON" scripts/assets/build-curia.py -- --repo .`, a few seconds) authors nine pieces in place around the 8 × 8 chamber board, builds them with `bmesh` (one mesh per piece and material) and writes `src/showcase/curia-kit-components.js` with each piece's bounds and the hall's own measures.
- **Shipping.** `node scripts/assets/quantize-model.mjs art-source/models/processed/roman-curia-kit.glb assets/models/scenery/roman-curia-kit.glb`, then `npm run asset:compress -- assets/models/scenery/roman-curia-kit.glb assets/models/scenery/roman-curia-kit.glb --report art-source/models/reports/roman-curia-kit-compress.json`.
- **Placement.** [`environment-curia.js`](../src/showcase/environment-curia.js) places every piece at the board's centre for the Contests of Chapters XI and XII on their own 8 × 8 board (`CURIA_LAYOUT` in [`world-layouts.js`](../src/ui/world-layouts.js)). An expanded board keeps the code-built hall. The chapter's props have their own places there: the clerks' tables beside the tribunal, the fountain and the army's eagle outside the doors.
- **Walls.** A wall stands down while the camera is beyond its inner face (the stage checks each frame), so no wall stands between the camera and the board. Walls cast no shadow, so none darkens the board. No piece takes picks or changes a route.
- **Stand-ins.** The code-built audience hall and the chamber's colonnades are batched within their own groups in these two chapters, so the loaded Curia can hide them whole; disposing the scenery brings them back. On Performance, or if the kit fails, they are the hall.

## Aurelian's walls · 2026-10-29

Release 9 models Rome's walls and gate before the finale's field (see [art-generation.md](art-generation.md#aurelians-walls--29-october-2026) and the [historical note](historical-research.md)).

- **Building.** [`build-aurelian-walls.py`](../scripts/assets/build-aurelian-walls.py) (Blender, `"$BLENDER_PYTHON" scripts/assets/build-aurelian-walls.py -- --repo .`) authors six pieces on the wall's centre line and writes `src/showcase/aurelian-walls-components.js` with each piece's bounds and the wall's measures. It shares its mesh builders, bakes and export with the Curia's in [`kitlib.py`](../scripts/assets/kitlib.py), whose openings weld near-coincident points so no zero-area triangle reaches the compressor.
- **Shipping.** `node scripts/assets/quantize-model.mjs art-source/models/processed/aurelian-walls-kit.glb assets/models/scenery/aurelian-walls-kit.glb`, then `npm run asset:compress -- assets/models/scenery/aurelian-walls-kit.glb assets/models/scenery/aurelian-walls-kit.glb --report art-source/models/reports/aurelian-walls-kit-compress.json`.
- **Placement.** [`aurelian-walls.js`](../src/showcase/aurelian-walls.js) lays the gate, then 4-metre stretches north and south of it, along the finale's curtain line (`finaleLayout` in [`environment-finale.js`](../src/showcase/environment-finale.js)). Each stretch takes the piece the code-built curtain would draw there: a tower, a finished stretch or one still rising. A rising stretch whose scaffold would stand among the cohorts drawn up before the wall is finished instead (each block's footprint is in the layout). Trees and ground cover keep off the pieces' ground on every tier (`finaleOccupied`), since the code-built curtain stands within the same footprint.
- **Drawing.** The environment merges every placement into one mesh per material after its own material hooks, so the walls take the kit's shared finish (cloud shadows and the scene's bake) and draw in five meshes. Disposing the world frees the merged copies and leaves the cached kit whole. No piece takes picks or changes a route.
- **Stand-ins.** The stage takes the kit only when it is already loaded (the loading veil preloads it on Balanced and High). Then the code-built curtain and its scaffolds are not built, and the regional kit's gate arch steps aside (`gate: true` in its layout entry, `withoutGate`). On Performance, or if the kit fails, the code-built curtain and the arch stand.
- **Camera.** Each frame the stage brings the camera in along its line to the target wherever its orbit would take it within 1.5 m of a piece's bounds (`clearOfBoxes` in [`stage-camera.js`](../src/showcase/stage-camera.js), over `finaleOccupied`), so a view turned toward the walls stays on the field's side of them. The bounds are the same for the kit and the code-built curtain.

## Landmarks · 2026-10-29

Release 9 gives every chapter three landmarks at the middle distance (see the [historical note](historical-research.md)): generated models on Balanced and High where they were made, and code-built outlines on Performance, for the Colosseum and wherever a model is missing.

- **Slots.** `LANDMARK_LAYOUT` in [`world-layouts.js`](../src/ui/world-layouts.js) names each chapter's three landmarks, nearest first. Each entry has a world catalog id (`landmark-<name>`), a description and a stand-in kind. `landmarkSlots` in [`environment-horizon.js`](../src/showcase/environment-horizon.js) sets them on the horizon's three bearings:
  - 115, 143 and 171 metres out;
  - 195, 223 and 251 metres round a city.
  - Where the horizon has its river, a bridge and its piers stand across it and a quay on its near bank, its front to the water, at the same distance on their own side of the board. A bridge with no river has a strip of stream beneath it.
  - The distant woods keep 34 metres clear of each slot.
  - In a city, no rooftop stands on a landmark's footprint.
  - Each slot has a facing (`yaw`): toward the board, or for a quay toward the water.
- **Stand-ins.** [`horizon-landmarks.js`](../src/showcase/horizon-landmarks.js) builds each kind as closed volumes in the horizon's distant vertex-colour batch. They add no draw call and no shader program.
  - Each builder works in a frame turned by quarter turns toward the board, so the horizon's boxes stay axis-aligned.
  - Each kind has a footprint, which is its outline's whole extent, and a height.
  - Each landmark's foundation record names it and counts the silhouette vertices it emitted (`distantFoundations`), so the horizon's tests can tell a landmark from the city's roofline.
  - [`horizon-landmarks.test.mjs`](../tests/horizon-landmarks.test.mjs) holds every outline to its footprint and height, and checks with rays from all round and from above that no part is turned inside out.
- **Generated models.** A landmark with a generated model has:
  - a world catalog entry under its slot's id (`LANDMARK_CHAPTERS` in [`world-catalog.js`](../src/ui/world-catalog.js)), with the chapters whose layout names it, which a test holds to the layout;
  - its file in `assets/models/landmarks/`, its request in `art-source/models/requests/` and its manifest record.
  - It is processed with `--colour-only` at 256 pixels, and with `--turn` where Tripo set its front elsewhere (a request's `processing`), then compressed. Its budget is about 36 bytes a triangle and 30 KB.
- **How it stands.** `landmarkModelUrls` adds it to the chapter's world kits, and the stage takes it only when it is already loaded, on Balanced and High. The horizon fits it before the city is drawn:
  - a clone of the cached model, turned to the slot's facing (its front is +Z), scaled to its kind's height and centred on the slot;
  - its own extent, which may outgrow its outline's, is kept clear of the city's rooftops, and it stands on the lowest ground under that extent;
  - its materials are clones that take the haze as an unlit share of their colour (`landmarkHaze`: half the share the horizon's distant colours take at that distance), keeping the cached model's program.
  - It casts no shadow and takes no pick. Disposing the world disposes the hazed clones and leaves the cached model whole.
  - On Performance, or if it fails to load, the outline stands.
- **Life props.** `LIFE_PROP_CHAPTERS` in [`world-catalog.js`](../src/ui/world-catalog.js) lists the generated life props (`life-<name>`) with the chapters that set each out; their files are in `assets/models/world/`. `regionalPropPlacements` in [`environment-regional-world.js`](../src/showcase/environment-regional-world.js) groups camp accessories beside the relevant service, checking full footprints and an open perimeter approach; fields retain the exterior baggage layout. They never occupy a camp's service pad or a contest's board (a council's, a tribunal's or the Senate's). Seen near, they keep all three maps at 512 pixels. They have no code-built stand-in: on Performance, or without its model, a prop's place stays empty.
- **Warm between stages.** A scene's working set (its placed scenery, the world kits and its landmarks) is at most 16 models since these were added. The scenery cache keeps 20 idle masters between stages (`SCENERY_IDLE_MASTERS` in [`scenery-models.js`](../src/showcase/scenery-models.js)), up from 12, so a chapter's next stage finds its models still loaded; a test holds every scene's working set within it.


## The five camp figures · 2026-10-30

Release 8 gives the living camps' named people who had no body of their own theirs: Severianus, Aelia, Paullus, Theon and Quintus (see [art-generation.md](art-generation.md#the-five-camp-figures--30-october-2026)). They are made as release 6's named men are, with two differences.

- **A level down.** The four men stand only in camps, and their chapters' downloads were near their limit, so each is bound with `--texture 512 --detail-texture 256` and his head wrapped with the same (`wrap-cast-head.py … --texture 512 --detail-texture 256`), its paint baked as before from the 2,048-pixel bind. A body comes to about 0.40 MB instead of about 0.66.
- **Aelia's own head.** The shared head is a man's, and wrapped onto a woman's it puts its longer chin under hers, painted with her neck's shadow, and a man's neck at the seam. She is bound as Syra is, with her own head and 1,024-pixel maps, and quantized and compressed without a wrap. The catalog marks her body `woman` and gives it no `headwear`; her figure wears it whole, without the shared head, its blinks and expressions or the neckcloth that covers the men's seam.
- **Chapters.** `CAST_CHAPTERS` lists the camps each stands in, which the exact-chapters test holds them to. Severianus also stands in Chapter XII's court when he backs the soldier (`patronSupport`), which neither of the test's campaigns earns: XII's offline pack leaves his body out, so offline he keeps the procedural figure there, and online it loads as anywhere else.

### Subsequent corrections and local refinement

The later camp/character follow-up includes Severianus in Chapter XII's offline pack and verifies the legally earned patron route. Aelia now has her own bounded expression/blink system. See [camp-character-followup.md](camp-character-followup.md) for those corrections to the original release description above.

The 31 October local Blender pass refines sixteen existing bodies, without replacing their compressed textures or raising their budgets. [character-art-refinement.md](character-art-refinement.md) records the exact coverage, source/processed hashes, protected contact and UV data, pose metrics, visual review and remaining source-paint limitations. [command-camp-refinement.md](command-camp-refinement.md) records the accompanying camp composition and interface changes.

## Item pictures · 2026-11-02

Release 13 gives every piece in the inventory a picture rendered from a generated model (see [art-generation.md](art-generation.md#item-pictures--12-november-2026)). The game shows the pictures from one WebP atlas; seven of the models also ship as the weapons and helmets figures wear ([below](#weapons-and-helmets-from-the-item-models--2026-11-08)).

1. **Generate** each model as any other (`npm run asset:tripo -- generate art-source/models/requests/item-<name>.json`). Its request's `provenance` names the program (`item-pictures`), the credit cap and the expected 20 credits. With `creditAccounting: "batch"` several can run at once, as each task reports its own charge.
2. **Review** it against its Tripo render. Record the verdict in the request's `status` (`accepted …` or `rejected …`, with the reason), and how to render it in its `picture`:
   - `view`: `upright` for a shirt, a helmet or a shield; `long` for a weapon; `flat` for a belt;
   - `turn` in degrees, to show its other side;
   - `cells`, its shape in the pack;
   - `across` (`x`, `y` or `z`), when a long thing's guard misleads the camera;
   - `dropStand` (`radius,top,floor` in the model's own units), when the model came on a display stand.
3. **List** it in `art-source/items/item-pictures.json`: the picture's request, its cells and the items it serves. Every item in `src/data/items.js` has one picture or is listed under `drawn`. A model rejected at review goes under `rejected` with the reason, its render in `art-source/items/rejected/`; until another is made, its items go under `drawn`.
4. **Render and pack:** `node scripts/assets/item-atlas.mjs --render <name>` renders that master from its raw model into `art-source/items/pictures/`; without names it renders them all. Without `--render`, it packs the masters:
   - it checks the list against the items first;
   - `build-item-atlas.py` scales each master to 80 pixels a cell, by area averaging in premultiplied alpha;
   - it packs them into `assets/items/item-atlas.webp` (quality 78) and writes `src/data/item-pictures.js`, where each item's picture lies.
5. **Record** the atlas's new bytes and digest in `docs/asset-manifest.json` and the batch in the ledger. `tests/item-pictures.test.mjs` checks:
   - that every item has a picture or is drawn, and that the places lie inside the atlas without overlapping;
   - that the atlas is the recorded size, within its 120 KB budget, and in every chapter's pack;
   - that each picture's model was accepted and paid for from the ledger.

`src/ui/item-art.js` draws a picture as two nested SVGs: the outer fits the item's place into any box without stretching (the pack's cells, the worn places, the details and the traders' goods), and the inner, the place's own size, clips the atlas to it, so a box of another shape never shows the neighbouring pictures. An item with no picture keeps its drawn silhouette.

## Weapons and helmets from the item models · 2026-11-08

Step 0 of the [graphics plan](graphics-tripo-plan.md) gives seven of the item pictures' models a place on the figures: a figure dressed in the inventory's spatha, gladius, knife or axe, galea, Niederbieber helmet or felt cap wears the item's own model in place of the code-built piece. These figures are the player's soldier, his companions, named veterans and his squads. The rank and file and the enemy keep the code-built pieces, and so does every figure on Performance. Spears, bows, slings, the conical and Gothic cap helmets and the shields stay code-built ([why](art-generation.md#weapons-and-helmets-from-the-item-models--8-november-2026)).

1. **Process** each from its item's raw download, under Blender:

   ```sh
   "$BLENDER_PYTHON" scripts/assets/process-kit.py --input art-source/models/raw/item-spatha.glb \
     --output assets/models/kit/kit-spatha.glb --report art-source/models/reports/kit-spatha.json \
     --kind sword --length 0.83 --triangles 1200 --overview-triangles 120
   ```

   [`process-kit.py`](../scripts/assets/process-kit.py) welds the importer's seam splits, then:
   - **a weapon** (`--kind sword` for a sword or a knife, `axe` for an axe): it lays the longest axis up, with the flat of the blade or the axe head across and the grip end down, found from the widths along its length (a sword's widest section is its guard, just above the grip; an axe's is its head, at the far end). It scales it to `--length` and puts the origin at the middle of the grip.
   - **a helmet** (`--kind helmet`): it cuts away any display stand (everything below the lowest section at least half as wide as the widest), turns it by `--turn` degrees so its face looks forward, scales it to `--height` and stands it on its foot.
   - **a standard** (`--kind standard`, release G2): laid out as a weapon, its ornament at the top, its pole set upright and its origin a tenth of the way up ([G2's pilot](#g2s-pilot-the-standards--2026-11-10)).
   - **both levels:** it reduces the near level to `--triangles` by a collapse, which can stop short where Tripo's surfaces cross; the report records where it stopped. It draws a copy together on the finest grid that fits `--overview-triangles` for the overview level, and bakes the colour map's colours into that level's vertices. It shrinks the maps (`--texture` colour, `--detail-texture` normal and metal-roughness) and exports one GLB with the meshes `near` and `overview`. The report records the digests, settings and the orientation found.

   The pieces shipped with lengths 0.83 m (spatha), 0.57 (gladius), 0.33 (knife, 1,000 triangles) and 0.74 (axe), and heights 0.3 m (helmets, `--turn 180` for the galea and `-90` for the Niederbieber, 2,400 triangles, a 512-pixel colour map) and 0.22 (cap, `--turn -90`, 3,200 triangles). The game rescales every piece to the code-built one, so these sizes set only the file's own scale.
2. **Compress** it in place: `npm run asset:compress -- assets/models/kit/kit-spatha.glb assets/models/kit/kit-spatha.glb --report art-source/models/reports/kit-spatha-compress.json`.
3. **Catalogue** it in [`src/showcase/actor-kit-catalog.js`](../src/showcase/actor-kit-catalog.js): its item model and kind, and the weapon or helmet of the items' visuals that wears it. Then record it in `docs/asset-manifest.json` (its source task and raw digest, the processing settings and the compression report) and run `node scripts/steam-ai-disclosure.mjs`.

**In the game.** [`actor-kit-models.js`](../src/showcase/actor-kit-models.js) loads each piece once a page, as an immutable master, and a figure wears copies that it owns and frees. `createActorRig` (`actors.js`) fits each piece to the code-built piece on its joint, then removes the code-built piece:
- a weapon is scaled as one so its tip meets the code-built tip, with its grip in the hand;
- a helmet is scaled on each axis to the code-built bowl and guards, which were fitted to every head;
- a crest or a contact point on the joint stays.

The near level is textured. The overview level, which the figure's overview and its followers draw, uses the baked colours. A piece that has not loaded yet leaves the code-built one, and the figure rebuilds once when it arrives; a piece that fails to load leaves the code-built one for good. The files are shared 3D files in every chapter's pack. `tests/actor-kit-models.test.mjs` checks:
- each file against its item's Tripo task, its report, its manifest entry and its budgets;
- the masters' layout;
- which figures wear what;
- the fit, the fallbacks and the late rebuild;
- that no figure frees a master.

## Release G1's pilot: a unit type's own body · 2026-11-08

Release G1 of the [graphics plan](graphics-tripo-plan.md#g1s-pilot-8-november) gives unit types that wore another unit's body one of their own. Its pilot made seven bodies and a horse, generated, rigged, bound and compressed as every body is ([the workflow](#workflow-for-each-asset), [the binding script](#the-binding-script)), at the shipped bodies' settings: `--triangles 12000 --overview-triangles 2500 --texture 1024 --detail-texture 512`, and for the horse `--horse --triangles 9000 --overview-triangles 1800`.

- **Which unit wears it.** [`actor-kit.js`](../src/showcase/actor-kit.js) adds presentation-only fields to a figure's kit, read from the unit as the rules made it:
  - `troop`: its own role (`infantry`, `guard`, `raider`, `archer`, `cavalry`, `champion` and so on), before the kit maps it to a drawing role;
  - `skirmisher`: a war band's skirmisher, by name;
  - `rival`: a Roman in the claimant's service, by side or name. A cohort that takes the oath is renamed by the rules and drawn as the soldier's own;
  - `champion`: a champion's id.

  A fit in [`actor-body-catalog.js`](../src/ui/actor-body-catalog.js) may name any of them, and a chapter. The type bodies come first in the catalog, since the first fit that matches is worn; every other figure keeps the body it wore.
- **Reinforcements.** A unit's variant can depend on its place in the battle: Chapter I's and II's skirmisher arrives with the reinforcement wave. The chapter test (`tests/actor-bodies.test.mjs`) therefore also looks at each battle's waves, single men and squads. It found Chapter VIII's Gothic cavalry wave wearing the noble's body and riding the northern horse without either in Chapter VIII's download.
- **A second attempt** keeps the first request beside it: `char-rival-legionary.json` is marked rejected, and the body ships from `char-rival-legionary-b.json`. The body's manifest entry names the request it came from (`source.prompt`), and the records test follows it.
- **A body bought for another purpose** ships from a request of its own that carries the original's task IDs and digests: `char-gothic-skirmisher.json` is the calibration's standard-tier skirmisher (`reusedFrom`), so its credits are not spent twice.
- **A failed download.** Twice in the pilot Tripo finished a task but its file did not download. `resume` (or `resume-rig`) fetched it again by the recorded task ID, with no new task and no new charge.
- **Seen in battle.** A body is reviewed where players meet it, as well as in the actor viewer.
  - A battle is reached from New Game by the real-time bot's legal commands and restored through the desktop build's Restore dialog at High.
  - It is captured twice: as built, and with the earlier body served under the new file's name.
  - At the battle camera a figure is about 70 to 100 pixels tall, so a type reads by its outline and main colours ([the art record](art-generation.md#in-battle)). A prompt names those first.
- **Credits** are recorded task by task in [`graphics-g1-credits.json`](../art-source/models/graphics-g1-credits.json), and `tests/graphics-g1.test.mjs` reconciles them with the requests, the manifest and the account's balance.

## The rest of release G1 · 2026-11-09

The rest of G1 ([the plan](graphics-tripo-plan.md#the-rest-of-g1-9-november)) made fifteen bodies and a horse as the pilot did, at the same settings. It added the following to how a body is chosen and made:

- **The war leader.** In Chapters I–III a band that fights alone has one leader: the rules name its hardiest man "<faction> war leader" ([`bands.js`](../src/core/realtime/bands.js)). The kit's `leader` field reads that name, and a champion is never one.
- **A champion the rules mount.** The Palmyrene armoured officer is `mounted` in the rules, but his role is a champion's, so he was drawn on foot. The stage now passes `mounted` to the figure ([`live-figures.js`](../src/showcase/live-figures.js)), and his kit seats him on his faction's horse.
- **The claimant's men.** The claimant himself (`Rival claimant`) is drawn as an officer. "The claimant's" reserve cohort and guard captain are his soldiers, in the rival bodies.
- **A fit may name a chapter, and a field that must be false.** Aurelian's Dalmatian horse is the Roman cavalry of Chapter XII only (`chapter: 12`). `rival: false` keeps any horsemen of the claimant off it.
- **Shield markings, at no credit cost.** The claimant's cohorts and archers carry his purple, with two designs of their own (`base` and the design in [`shield-patterns.js`](../src/showcase/shield-patterns.js)). The soldier's men keep their teal.
- **A smaller map for a tight download.** A body worn in Chapter I takes 512-pixel maps (`--texture 512 --detail-texture 256`), as the cast's did in release 8. The war leader's file is 282,216 bytes. A figure about 100 pixels tall at the battle camera cannot show a finer map.
- **A remade horse keeps its id and file name.**
  - The manifest entry names the remake's request (`horse-eastern-b.json`), and the horse tests follow `source.prompt`.
  - The first request stays, marked replaced.
- **Seen in battle,** as the pilot was. Each champion is captured at the moment he stands nearest the soldier ([the art record](art-generation.md#in-battle-1)).

## Release G3's tent lines · 2026-11-09

G3 starts with no new model: Chapter V's leather tent (0.36) pitched on the camps' tent lines ([the plan](graphics-tripo-plan.md#g3s-tent-lines-9-november)). Two things are new in how scenery is placed:

- **Many copies of one model.** A placement with `instances` ([`scenery-models.js`](../src/showcase/scenery-models.js)) draws every copy from one master, as one instanced mesh for each of its meshes, with white instance colours so they share the other instanced batches' programs. Each copy's footprint is centred on its spot and grounded on the lowest of its corners, as a placed model is, and the placement hides one code-built batch (`fallbackName`).
- **Pitches that block walking.** The tents stand on authored pitches of tent-line ground ([`camp-regions.js`](../src/data/camp-regions.js)), and the camp world lists their cells as the map's `blocked` tiles, solid for walking whatever their ground ([`navigation.js`](../src/core/realtime/navigation.js)). The scenery draws a tent only on a whole pitch of tent-line ground, so a stale pitch leaves its ground bare.

## Release G3's pilot: the timber camps' walls and the camps' furniture · 2026-11-09

Eight Tripo props ([the plan](graphics-tripo-plan.md#g3s-pilot-9-november), [the art record](art-generation.md#release-g3s-pilot-the-camps--9-november-2026)), processed and compressed like every prop. Three things are new in how they are placed and shipped:

- **Walls from the wall cells.** [`camp-walls.js`](../src/showcase/camp-walls.js) reads a timber camp's wall cells as straight runs, along x where a cell meets walls both ways, as the code-built breastwork's faces have it. Each run is filled with whole palisade sections near the model's own 7.3 m, each stretched to its share of the run: an instance may give a `length` along the model's own x in place of a uniform `scale` ([`scenery-models.js`](../src/showcase/scenery-models.js)). A tower stands on each corner cell and on each run's end cell that opens on a gateway. The cells were solid already; nothing here changes a cell or draws randomness.
- **A fallback that stands for its own pieces only.** The palisade hides the code-built breastwork's two batches (`fallbackNames`). A batch generated scenery may hide is marked `replaceable` ([`environment.js`](../src/showcase/environment.js)), and the static batching folds no other part of the scene into it ([`environment-batching.js`](../src/showcase/environment-batching.js)): at High a dozen other wooden pieces had joined the breastwork's posts, and hiding the batch would have hidden them too.
- **Web room by chapter.** A world catalog entry may name, after its chapters, the chapters whose web download carries it ([`world-catalog.js`](../src/ui/world-catalog.js)); the desktop build (`CONFIG.platform`) carries every chapter's. A chapter's web pack leaves the others out (`chapterOfflineAssets`), the scenery leaves out their placements there (`worldAssetShown`), and the web build drops any file no web chapter carries (`desktopOnlyWorldFiles`, [`build.mjs`](../scripts/build.mjs)). `verify-assets` checks each build's packs against its own target.

## The rest of release G3 · 2026-11-09

Eighteen Tripo props ([the plan](graphics-tripo-plan.md#the-rest-of-g3-9-november), [the art record](art-generation.md#release-g3-the-rest-of-the-camps--9-november-2026)), processed and compressed like the pilot's. What is new in how they are placed:

- **Walls of every style.** [`camp-walls.js`](../src/showcase/camp-walls.js) takes a camp's wall style from its scene, as the code-built walls do (`campWallStyle`: timber, stone or mudbrick), and fills each run with that style's wall: whole sections near the model's own length (the stone 5.35 m, the mudbrick 5.95 m), each stretched to its share of the run. The stone and mudbrick walls stand for the code-built parapet. Where a camp's wall model stands, the parapet's courses, coping and merlons go into a batch of their own (`CAMP_PARAPET_BATCHES`, [`environment-campaign-terrain.js`](../src/showcase/environment-campaign-terrain.js)), which the wall hides; the camp's terraces and kerbs stay in the masonry batch. Chapter XI's portico in Rome takes no camp wall; Chapter V's courtyard, with its own Blender kit, takes the mudbrick wall and towers through its own branch.
- **Gates over the gateways.** `campGateways` finds a gateway at either end of each run: a straight row of one to five open cells between the run's last cell and the next wall cell. A gate stands across each, centred, as wide as the gap but stretched by at most 1.35 times its own width (`campGateSpan`), so Chapters I–III's 12.5 m gateways take a 7.7 m timber gate with open ground either side. The gateway's cells stay open, and the gate has no stand-in.
- **Mixed tent lines.** Each pitch takes the tent its first cell picks by a hash (`tentVariantOf` in [`environment-regional-world.js`](../src/showcase/environment-regional-world.js), a quarter for each variant) where its chapter shows that tent, and the leather tent elsewhere. Each tent model has its own instanced placement and its own code-built batch (`tentFallbackName`), so a pitch shows its model or its code-built tent, never both or neither. A variant's catalog chapters are the ones whose pitches pick it, which a test checks against the hash.
- **Furniture beside its service.** `campServiceForProp` ([`camp-composition.js`](../src/showcase/camp-composition.js)) sends each new piece to the court of its service, or to the baggage line where that court is full: the praetorium, tribunal, altar, parley awning and striped pavilion to the principia; the hospital tent to the valetudinarium; the pilum rack and the archery butt to the drill ground; the oven and the reed-mat shade to the canabae.
- **Fronts toward the camp.** A court prop's front faces its local +z, toward the camp. `process-model.mjs --turn` turned the five whose fronts came out along x by 270° (the hospital tent, the striped pavilion, the pilum rack, the archery butt and the oven), and the two gates by 90°, so their spans run along x.
- **Kept warm.** A camp's working set of models now reaches 31, in Chapter IX's camp on the desktop, so the cache keeps 36 idle masters between stages (`SCENERY_IDLE_MASTERS`, [`scenery-models.js`](../src/showcase/scenery-models.js)), up from 20.
- **The first desktop-only files.** No web chapter carries the tribunal or the parley awning (Chapter IX's web room leaves them out, as they stand in its far rows beyond the camera's reach), so the web build leaves out their files, and `verify-assets` checks that they are neither built nor listed in any of its packs.

## Release G5's pilot: field objects and set pieces · 2026-11-09

Six Tripo props ([the plan](graphics-tripo-plan.md#g5s-pilot-9-november), [the art record](art-generation.md#release-g5s-pilot-battle-and-siege--9-november-2026)), processed and compressed like every prop. They take two paths into a battle:

- **Field objects drawn by models.** [`field-models.js`](../src/showcase/field-models.js) reads which model draws an object in its state from `FIELD_OBJECT_MODELS` ([`world-catalog.js`](../src/ui/world-catalog.js)): the supply cart (`stores`) in all four of its states, the barricade while it stands, the Persian ram while it stands. Each placement stands on its object's cell, turned by its model's `yaw` to the code-built piece's bearing; `copies` sets one model out more than once on a cell (the barricade's two panels side by side). The stage leases the battle's models from the scenery cache, as it does the board kit, and [`battlefield-features.js`](../src/showcase/battlefield-features.js) draws each copy as the scenery's placed models are, plain meshes over the cached model's geometry and materials, in place of the code-built piece. They take the scenery's shader programs: an instanced draw would have compiled the instanced variant of the generated art's program, which no battle's scenery uses, one program more in Chapter V's mine battle at Balanced for models that stand at most twice. The field's static batching leaves these meshes whole, as their geometry is the cache's. The code-built pieces stay for every other state, on Performance and while a model is not loaded. Presentation only: nothing here changes a cell, a rule or a route.
- **A load on its carrier.** A carrier names the loads it bears (`loads`), each `lift` above the carrier's ground at `x` and `z` in the carrier's own frame and turned with it: the supply cart's load stands on the cart's bed while the supplies are still to be recovered. A carrier stands only with the loads its state calls for, so if the load is missing (not downloaded, or no room on the web) the code-built cart, with its own sacks, stands instead of an empty model cart.
- **Set pieces beyond the board.** `battlePropPlacements` sets the carroballista and the onager (`BATTLE_PROP_MODELS`) a few metres beyond the board's west edge, behind the Roman line, where the fixed camera, looking north-west, sees them behind the army. Each takes the first spot along the edge whose footprint is clear of the roads that leave the board and of the scene's other scenery, a building by its component's footprint ([`scenery-models.js`](../src/showcase/scenery-models.js)). They are scenery placements, drawn with the rest of the scene's scenery, and like the camps' furniture they have no code-built stand-in.
- **Orientation from the model.** The processed models keep Tripo's axes, and the catalog's yaw turns each to its bearing: the cart's pole (along the model's −z) and the ram's iron head (at its +x) point west; the barricade's panels run east to west; the two engines face east, toward the enemy.

## The rest of G5, its first batch: more field objects, set pieces on two edges, the walked field's debris · 2026-11-09

Eighteen more Tripo props ([the plan](graphics-tripo-plan.md#the-rest-of-g5-the-first-batch-9-november), [the art record](art-generation.md#the-rest-of-g5-the-first-batch--9-november-2026)), processed and compressed like every prop. They extend the pilot's paths and add one:

- **More field objects.** The pitch brazier, unlit or burning, from Chapter III; the countermine and the Persian siege ramp, while they are worked, at Chapter V's city; and an eastern cart for the eastern battles (`EAST_CHAPTERS`: Chapters V, VI and IX), with the Roman cart in the others. Both carts bear the same load, each at its own bed. A burning brazier keeps the stage's flame and smoke, rising from `flame` metres above its ground in the top of its heap of pitch. Each model is turned to its code-built piece's bearing: the eastern cart's pole (at its +x) points west like the Roman cart's, and the ramp (rising toward its +z) rises east like the code-built ramp. The pilot's barricade now stands in every chapter from III: the eastern barricade was rejected twice and not made.
- **Set pieces on two edges, and beside another.** `battlePropPlacements` also sets pieces beyond the north edge (`edge: 'north'`), which the fixed camera sees behind both armies: the Gothic wagon laager in the battles against Gothic bands, and the Persian siege tower and screens at Chapter V's city. A piece may stand `beside` another the battle sets out, at an offset in that piece's own frame or that offset mirrored, clear of it and of the rest: the stone shot by the onager, the bolts by the carroballista. A ballista joins the sieges, and a Roman siege tower, a mantlet and fascines stand behind the line where the Romans attack a wall (Chapters IX and XII). A piece now tries 13 shares of its edge rather than 9: a fortified field's north edge is crowded with its walls, and Chapter V's wall battle found room for the Persian tower only past them.
- **Dry ground.** A set piece's room keeps out of the scene's water ([`environment-water.js`](../src/showcase/environment-water.js)). That covers the wetland's marsh sheet, which reaches 6 m past the board's marsh, river and ford water where the ground lies below it (with the channel where a river leaves the board), the distant river beyond the north edge, and Chapter V's Euphrates beyond the fortress. The sampler reads the same ground height and levels the environment draws with, and the marsh sheet's opacity is one shared function (`marshSheetAlpha`). The review in the game found Chapter II's open Gothic wagon standing in the marsh. Before the change, 5 of the 60 set pieces touched water: the open wagon at both of Chapter II's battles and Chapter VIII's two, and the covered wagon at Chapter II's rearguard. Now none does. The rearguard's north edge has dry room for one wagon, so the covered wagon is left out there.
- **The walked field's debris.** On the field after a win, the stage encounter carries where the beaten side's fallen lie (`aftermath.fallen`, [`live-figures.js`](../src/showcase/live-figures.js)). `aftermathDebrisPlacements` lays the chapter's gear (`AFTERMATH_DEBRIS_MODELS`: the Gothic bands', the eastern armies' or, in Chapter XII, the rival Romans') at up to six spots beside them: each 1.1 m off one of the fallen, at least 6 m from the others, on the board and clear of the field objects' cells. The first spot takes a fallen war banner. The fallen men's ids order the spots by a hash, so nothing is drawn from the game's random streams. The field's features draw them as plain meshes over the cached models, as they draw the field objects. On Performance, and where a chapter's web download has no room, the field stays as it was; where the web has room for the gear but not the banner (Chapter VI), the gear lies at every spot.
- **Downloads.** On the web a model rides only where its chapter's download has room (`G5_WEB_ROOM`). Chapters II, III and V take all of theirs, and VI the eastern cart, the brazier and the eastern debris. Chapters I, IV and VII–XII take none of the new ones, so the bolts, the Roman siege works and the Roman debris ship in the desktop app alone.
- **Budgets and the decimator.** [`process-model.py`](../scripts/assets/process-model.py) decimates every part by one ratio, so a model of many small separate parts stops collapsing near a floor. The fascines' loose sticks stop near 3,590 triangles whatever the target, and at that count their gabions crumple into lumps; the countermine's timbers broke into shards at 3,500. Both budgets were raised to keep their shapes (6,000 and 7,000 triangles). A flat model is scaled by its height like every prop, so each piece of debris had its height set at review from its raw proportions, to keep its spread under two metres.


## The last of G5: the signal posts and the river's boats · 2026-11-10

Four more Tripo props ([the plan](graphics-tripo-plan.md#the-last-of-g5-10-november), [the art record](art-generation.md#the-rest-of-g5-the-final-batch--10-november-2026)), processed and compressed like every prop:

- **The signal station.** It was the last field object every battle drew in code. Now it takes a model in each of its four states, as the supply cart does: the Roman post in the western battles and the eastern post in Chapters V, VI and IX (`EAST_CHAPTERS`). The objective's marker shows whether the station is available, secured, forgone or missed. The Roman post's banner hangs from a crossbar along the model's z, so its `yaw` turns the banner square to the camera, with the beacon stack in front of the mast. The eastern post's pole and pennant turn to the camera's side of the pillar. The code-built mast stays on Performance, after a failed download and in the web chapters with no room for the posts.
- **Boats on the distant river.** `battlePropPlacements` floats a piece with `edge: 'river'` on the distant river beyond the north edge, where the scene has one (`profile.distantWater`: the battles of Chapters I, II, IV, VIII and X, including the training ground).
  - **Where it floats.** It tries spots along the river from the piece's own share of the board's half-width, as the edges' pieces do, on the centre line and then 1.5 and 3 m to either side. It takes the first spot clear of the scene's other scenery whose footprint lies wholly where the distant river's own surface shows.
  - **The surface seen.** The water sampler also tells which surface shows at a point (`createWaterLevelSampler`), the highest where two meet. Where a river leaves the board (Chapters VIII and X), its water runs on at its own, higher level over the near half of the distant river. The review found the barge under it at Chapter VIII's ferry, its hull hidden and only its load above the water. The same sampler keeps the other set pieces dry.
  - **How deep.** The boat's lowest point is set `draft` metres below the river's surface through the placement's `groundY`, which the scenery loader honours as it does for Chapter VIII's ferry. The surface is `DISTANT_RIVER_LEVEL` ([`environment-water.js`](../src/showcase/environment-water.js)), the height [`environment.js`](../src/showcase/environment.js) draws the river at. The patrol boat floats 0.4 m deep, its oar blades at the waterline; the barge 0.25 m.
  - **Along the stream.** The patrol boat is long along its model's x, the barge along its z, so the barge turns a quarter turn to lie along the stream.

  Both boats float in all nine battles.
- **Downloads.** On the web the Roman post rides in Chapters II and III, the eastern post in V, and the boats in II. The other chapters' downloads have no room (`G5_WEB_ROOM`), so their web builds keep the code-built mast and leave the river empty. The desktop app carries all four.

## G4's pilot: animals beside the camps' furniture · 2026-11-10

Four Tripo animals and the calibration's pack mule ([the plan](graphics-tripo-plan.md#g4s-pilot-10-november), [the art record](art-generation.md#g4s-pilot-animals--10-november-2026)), processed and compressed like every prop, and the Roman horse's coat stood at the horse lines:

- **Static, beside a piece.** Tripo's rig check refused a four-legged rig for the calibration's mule, and nothing in the game yet walks an animal without a rider, so the pilot's animals stand still. Each stands with a piece of the camps' furniture or of life about them, the piece it belongs to (`CAMP_ANIMALS` in [`world-catalog.js`](../src/ui/world-catalog.js)):
  - three horses at the horse lines;
  - a pair of oxen by the ox cart, and a pair of mules by the covered carriage;
  - a camel by the camel gear, and a pack mule by the broken cart and the handcart;
  - a dog by the bread oven and the field oven.
- **Where they stand.** `regionalPropPlacements` ([`environment-regional-world.js`](../src/showcase/environment-regional-world.js)) places the piece as before, in its court beyond a camp's board or at its spot in the baggage line beyond a battle's southern edge. In the piece's own frame it then moves the piece aside by its `shift` and stands each animal at its spot, facing along the piece by its `yaw`.
  - **The far side.** With `across`, the animals stand on the piece's far side from the board, toward the camera, which looks from the south-east. Where the piece's own -z points toward the board, the layout is mirrored across its length.
  - **Inside the court.** Every animal stays inside its piece's court, or its line spot, clear of the piece and of the others. `tests/graphics-g4.test.mjs` checks this in every camp and every battle reached by legal commands, with each model's footprint as it loads.
  - **The court stays.** A piece moved aside for its animals keeps its court: the placement records the court's middle (`court.x`, `court.z`), and the camp's worn apron and ground go there as before (`createCampGroundSampler` in [`camp-composition.js`](../src/showcase/camp-composition.js)). Every other placement in every camp and battle is as it was.
  - **Only with its piece.** Each animal is a placement of its own that names its piece (`host`). Where the piece is left out, as Chapter XII's web build leaves out its horse lines, `sceneryPlacements` leaves the animals out too. Animals have no code-built stand-in: on Performance and after a failed download, the place stays empty.
- **The horse's coat stood as scenery.** A generated horse is skinned to the game's horse skeleton (`assets/models/horses/`). Chapters VII, IX and XII already download the Roman horse's coat for their cavalry, and the horse lines stand in those chapters.
  - **No new file.** The scenery loader stands any skinned model it loads as plain meshes in its rest pose (`standSkinnedModel` in [`scenery-models.js`](../src/showcase/scenery-models.js)), so the horse lines take that coat with no file of their own.
  - **Exact.** The skeleton loads in its bind pose, so the vertices need no change; a test finds the plain coat within a micrometre of the skinned one, posed by its skeleton.
  - **Lighter.** The far-off overview surface is left out, since scenery has no levels of detail, and the plain meshes share the scenery's shader programs (`model-materials.js`).
- **Facing.** The generated animals face their own +x once processed; the camel came facing +z and was processed with `--turn 90`. A horse's coat faces its +z and turns a quarter (`ANIMAL_COAT_TURN`).
- **Downloads.** On the web an animal rides only where its chapter's download has room (`G4_WEB_ROOM`):
  - the pack mule and the dog in Chapters II and III, and the mules in XI;
  - the horses wherever their horse lines stand, since their coat is already in the download;
  - every other animal ships in the desktop app alone, and its piece stands by itself on the web.

  The largest chapter download is still 27.96 of 28 MB, Chapter III's rises to 27.50, and the complete web game is 76.72 of 80 MB.
- **The idle cache.** Chapter IX's camp in the desktop app now keeps 34 models in its working set, under `SCENERY_IDLE_MASTERS` (36).

## The rest of G4: seven more animals · 2026-11-10

Seven more Tripo animals ([the plan](graphics-tripo-plan.md#the-rest-of-g4-seven-more-animals-10-november), [the art record](art-generation.md#the-rest-of-g4-seven-more-animals--10-november-2026)), processed, compressed and placed as the pilot's are:

- **More pieces with animals** (`CAMP_ANIMALS`):
  - sheep by the loom, goats by the woodpile and the market stall, and a donkey by the pottery stall;
  - a couched camel by the caravan's baggage, and the pilot's camel by its trough;
  - a courier's horse by the courier table, and the pilot's dog by the cooks' fire;
  - the dark ox in place of the second grey one by the ox cart.
- **Room in the court.** As the pilot's, each piece moves aside by its `shift` and keeps its court's middle (`court.x`, `court.z`). The hay rick and the supply stack, each about 4 m on a side, fill their 4.8 m courts, so they take no animals.
- **Not on a pad.** A piece on a service pad inside a camp has no animals (`withAnimals`). The caravan's trough and baggage and the cooks' fire stand on pads in their camps, so their animals stand only in the battles' baggage lines.
- **Chapters seen.** An animal downloads with its pieces' chapters (`ANIMAL_CHAPTERS`), and a piece may name fewer (`chapters` in `CAMP_ANIMALS`): Chapter XI's courier table stands on a pad and XI has no battle, so the courier table names III and VII. `tests/graphics-g4.test.mjs` finds every animal standing in some camp or battle of each chapter that downloads it.
- **Facing.** The grazing ewe and the courier's horse came facing +z and were processed with `--turn 90`, the couched camel with `--turn 85`, and the dark ox, which came standing askew, with `--turn -59`.
- **Downloads** (`G4_WEB_ROOM`): on the web the goats ride in Chapters II and XI, the donkey in XI, and the courier's horse in III. The sheep, the dark ox and the couched camel ship in the desktop app alone; the camel by the trough stands there alone too, and the dog by the cooks' fire on the web only in Chapter III. Chapter III's download rises to 27.72 of 28 MB and XI's to 21.12, the largest is still 27.96, and the complete web game is 77.39 of 80 MB.
- **The idle cache.** Chapter IX's camp in the desktop app now keeps 36 models in its working set, so `SCENERY_IDLE_MASTERS` rises from 36 to 40.

## The battles' animals: oxen by the Gothic wagons, mules by the engines · 2026-11-10

The pilot's oxen and mules beside four of the battles' set pieces, at no credit cost ([the plan](graphics-tripo-plan.md#the-battles-animals-10-november), [the art record](art-generation.md#the-battles-animals--10-november-2026)):

- **The pieces' formations** (`SET_PIECE_ANIMALS` in [`world-catalog.js`](../src/ui/world-catalog.js)). Each piece has its formations in order, each a pair of animals as `[model, x, z, yaw]` in the piece's own frame, as `CAMP_ANIMALS` gives them:
  - an unyoked pair of oxen, the grey and the dark, before each Gothic wagon's pole, which mirrored stands them behind the wagon, or else alongside it;
  - a pair of mules alongside the onager and the carroballista, on the side away from their stores, or else at the engine's end.
- **Where they stand** (`battlePropPlacements` in [`field-models.js`](../src/showcase/field-models.js)). Once every set piece has its spot, so no piece moves for them, a pair takes its piece's first formation, as given or mirrored across the piece's length, its breadth or both, where both animals stand:
  - off the board and on dry ground;
  - clear of the piece, of each other, of the scene's other scenery and set pieces, and of the roads, as the set pieces keep clear of them;
  - each by the room its spot keeps clear (`ANIMAL_FOOTPRINTS`, a little over what its model measures), turned with it.

  Each animal faces as its offset says, mirrored with its spot. Where no formation is clear, the piece stands alone: Chapter II's marsh leaves no dry room beside its wagons.
- **As scenery.** An animal is a placement of its own that names its piece (`host`), with no code-built stand-in, so it goes wherever its piece goes: where the piece is left out (on the web, or with no room), the animal is too, and on Performance and after a failed download the ground stays empty.
- **The same spots on the web.** The formations are chosen from every animal the piece has in the desktop app. The web then shows only those its chapter's download carries, so its animals stand where the desktop app stands them, never somewhere else. In Chapter III the grey ox stands alone by each wagon.
- **Chapters.** An animal downloads with its pieces' chapters, in the camps and beside the set pieces (`ANIMAL_CHAPTERS`): the oxen now in Chapters I–IV, VII, VIII and X, and the mules in IV, V and VII–XII. `tests/graphics-g4.test.mjs` checks every pair in every battle reached by legal commands, and finds every animal standing in each chapter that downloads it.
- **Downloads** (`G4_WEB_ROOM`): on the web both oxen ride in Chapter II, the grey ox in III and the mules in V. Chapter II's download rises to 27.17 of 28 MB, III's to 27.94 and V's to 27.57. The largest is still 27.96 and the complete web game is 77.80 of 80 MB. The engines of Chapters IX and X, and the wagons of the chapters whose web downloads leave them out, stand there without their animals.

## G6's pilot: a face from a portrait, and bodies of their own · 2026-11-10

Lucan's face from his campaign portrait, the elder senator remade, and bodies for Vibia and Bassus ([the plan](graphics-tripo-plan.md#g6s-pilot-10-november), [the art record](art-generation.md#g6s-pilot-faces-and-people--10-november-2026)):

- **The picture.** An `image_to_model` request names its picture by a web address Tripo fetches (`generator.input`). Lucan's portrait (`assets/portraits/lucan.webp`) was enlarged twice (Lanczos) to a 672-pixel PNG, committed in `art-source/models/inputs/`, and given to Tripo by its raw address at that commit, so the request records exactly the picture it used. Image-to-model at standard textures costs 30 credits.
- **The face** (`wrap-cast-head.py --face <bust.glb>`). The rest of the chain is a named man's as before: his body bound unquantized, then the wrap, quantizing, compression, the local refinement and the surface repair.
  - **Turned to the front.** The bust's head is its top 60% by height. A finder looks at the head from every turn within 40° of the way its shoulders face, 10° apart and then by single degrees. It keeps the view whose most forward point stands out from the face around it, as a nose does, with the face falling away evenly to either side and, at the last, most nearly mirror-symmetric. `--face-turn` takes a turn from review instead. Lucan's bust came 88° round.
  - **Scaled and levelled.** It is scaled from its skull's half-width, tried again at other scales while its eyes disagree, levelled by its eyes and scaled again so they stand as far apart as the shared head's.
  - **His face to the chin.** A bust's scarf or collar would paint the shared head's throat, so below 4.5 cm under the shared head's lip line the head takes its shape and paint from his own body (`FACE_CHIN`). A beard ends in a straight line there.
  - **His own eyes** (`--eyes his`): the shared head's eyes stared out of the portrait's face. Curly hair needed a longer bake (`--bake-cage 0.07 --bake-reach 0.16`), which left 0.002% of the head's map unpainted.
  - **The report** records the bust (its path and digest), the turn and how it was found, the scales, the tilt and the chin (`face`), with the faces as the finders saw them. The manifest records the face's request, task and picture under the body's `source.face`, and the Steam AI disclosure names it apart from the text-made models.
- **A body on the web in fewer chapters** (`web` in [`actor-body-catalog.js`](../src/ui/actor-body-catalog.js)). A body rides the web download of every one of its chapters unless it names fewer. On the web, `bodyShown` keeps a body off the figures of a chapter whose download does not carry it, so they wear what they wore before, and `chapterBodies` leaves it out of that chapter's pack. The web build leaves out a body that no chapter carries (`desktopOnlyBodyFiles`, `scripts/build.mjs`). The desktop app carries every body in all of its chapters.
  - **Bassus** (`camp-smith`) is chosen by his camp role in every camp, before the escorts' civilian body. His apron is his body's own, so the game no longer adds its code-built one to it (`actors.js`); his hammer and tongs at work stay. On the web he rides only in Chapter XI, and elsewhere there wears the escorts' body with the code-built apron.
  - **Vibia** (`camp-vibia`) is chosen by her role in Chapter VII's camp, with her own head, as Syra's body is. She ships in the desktop app alone; on the web she keeps the procedural woman's figure.
  - **The senator** ships under the first's name (`senator-elder`), bound with its bloc band as before.
- **Downloads.** Lucan's file grows by 40 kB in every chapter's download, less the senator's 10 kB where he stands, and Chapter XI's by Bassus's 0.4 MB. The largest chapter download is 27.99 of 28 MB, Chapter I's 3D download 17.93 of 18, and the complete web game 78.21 of 80 MB.

## The rest of G6, the first batch: faces from portraits beside the first, and bodies for the desktop app · 2026-11-10

The faces of Varro, Sabinus, Crispus and Paullus from their campaign portraits, the other two senators remade, and bodies for ten of the camps' people ([the plan](graphics-tripo-plan.md#the-rest-of-g6-the-first-batch-10-november), [the art record](art-generation.md#the-rest-of-g6-the-first-batch--10-november-2026)):

- **The faces** take Lucan's chain (`wrap-cast-head.py --face`, with `--eyes his` and the longer bake), with three changes to the wrap:
  - **`--face-nod`** turns a bust about the line through its ears after its turn, in degrees, positive lifting a face that looks down. The ears are taken 1.2 of the skull's half-widths below its crown (`FACE_EARS`, about 12 cm on a man's head). Paullus's bust is nodded 12°.
  - **`--max-mouth-fit`** is the largest change the wrap makes to the height between the eyes and the mouth, as a fraction, 0.2 as before unless named. Paullus's long face needed 0.25: it is fitted by 23%.
  - **The holes.** Texels the bake's rays do not reach are filled from their painted neighbours, spreading inward, rather than left black, within `--max-unpainted`. The report records how many (`fit.filled`): 131 of Crispus's, 882 of Paullus's.
  - The report records the nod (`face.nod`) and the limit (`settings.maxMouthFit`), and each refinement report its pose verification, as Lucan's does.
- **A face beside the first** (`cast-<who>-portrait` in [`actor-body-catalog.js`](../src/ui/actor-body-catalog.js)). A named man may have more than one body, in the catalog's order, and wears the first his platform carries in the chapter (`CAST_BODIES` gives each man's list). Each face from a portrait is a body of its own, his first body with the new face on the shared head, carried by the desktop app alone; his first body is carried by the web alone, so the web keeps the face it had. A body names the chapters each platform carries (`web` and `desktop`, all of its chapters unless named), and each build leaves out the files the other alone carries (`desktopOnlyBodyFiles` and `webOnlyBodyFiles`, `scripts/build.mjs`): the desktop build leaves out the four first bodies, 2.6 MB.
- **The camps' people** are chosen by their camp role, as Bassus is, each ahead of the shared body he or she wore before (the first body that fits is worn):
  - the gate sentry (`camp-sentry`), Quartermaster Aper (`camp-quartermaster`), the veteran instructor (`camp-instructor`, VI–XII) and the supply orderly (`camp-porter`, IV and VI–XII). The camps' other orderlies keep the orderlies' body. The clerks' body rides the desktop app from Chapter III, as in Chapters I and II only Aper wore it;
  - the traders Barnaios (V), Abgar (VI), Malku (IX) and Atticus (XI), and Caecilia and Licinia (X), with their own heads as the camp's other women have.
- **Downloads.** The web carries the senators' new togas and Atticus: the others ship in the desktop app alone, and on the web each figure wears what it wore before. The four staff bodies first rode the web in Chapter XI, which had room, but the complete web game then came to 80.26 MB, over its 80, so they ship in the desktop app alone, and the escorts' body is carried in Chapter XI on the web again. The bearded senator was bound again with 256-pixel detail maps (`--detail-texture 256`), from 442 to 405 kB, for Chapter XII's room. The largest chapter download is 27.98 of 28 MB, Chapter I's 3D download 17.93 of 18, and the complete web game 78.57 of 80 MB.

## G2's pilot: the standards · 2026-11-10

A century's signum and a legion's eagle on the backs of the figures that carry the code-built ones, and a vexillum over each block of the finale's massed armies ([the plan](graphics-tripo-plan.md#g2s-pilot-10-november), [the art record](art-generation.md#g2s-pilot-the-standards--10-november-2026)):

- **A standard on a figure** is kit, like the swords and helmets, and comes from the kit processor:

  ```sh
  "$BLENDER_PYTHON" scripts/assets/process-kit.py --input art-source/models/raw/g2-signum.glb \
    --output assets/models/kit/kit-signum.glb --report art-source/models/reports/kit-signum.json \
    --kind standard --length 2.3 --triangles 2400 --overview-triangles 300 --texture 512 --detail-texture 256
  ```

  - **`--kind standard`** lays a standard out as the figure carries it: its pole along +Y, its ornament or cloth (its widest part) at the top and across X, scaled to its height (`--length`), and its origin a tenth of the way up the pole, where the figure's standard joint carries the code-built pole (`STANDARD_GRIP`).
  - **The pole is set upright.** An ornament heavy on one side tips the model's longest axis off the pole, so the processor fits a line through the centres of the pole's bare lower slices (from a twentieth to two fifths of its height) and turns it vertical. The report records the lean taken out (`fit.poleLeanDegrees`): the eagle's was 3.9°, the signum's 0.4°.
  - **`--turn`** turns a standard about its pole, as a helmet, so its face looks along +Z. Both standards needed none.
- **On the figure** ([`actors.js`](../src/showcase/actors.js), [`actor-kit-catalog.js`](../src/showcase/actor-kit-catalog.js)): a figure whose kit has a standard (`kit.signum`) wears the model its kind names (`KIT_STANDARD_MODELS`) on the standard's joint, fitted as a weapon is, scaled as one so its top meets the code-built top, its grip on the joint. It sways with the joint. Signifer Quintus now carries a signum, as a camp's standard-bearer (`actor-kit.js`). Every figure on Performance, and every figure on the web, carries the code-built standard.
- **Kit by chapter and platform.** A piece of kit names its chapters and the web downloads that carry it (`chapters` and `web`, all of them unless named, as a body does), and `kitShown` decides whether a figure may wear it. The standards ride in the desktop app alone: the web build leaves them out (`desktopOnlyKitFiles`, `scripts/build.mjs`), and a chapter's download group carries a piece of kit only in its chapters (`chapterKitFiles`, `art.js`). `npm run verify`'s asset check holds both.
- **The finale's vexilla** are scenery: one instanced batch for each side, over each of its blocks, where the code-built vexillum stands (`finaleStandardSpot`, `environment-finale.js`; `finale-standards`, `scenery-models.js`). Where a side's model can stand (the desktop app, above Performance), its code-built vexilla are batches of their own, which the model hides once placed; elsewhere they join the scene's timber and shields, so the web's draw calls do not change.
- **A recoloured variant.** The claimant's vexillum is the commander's with its crimson cloth recoloured to his cohorts' blue-grey, by a new tool that works on a processed model's colour map, before compression:

  ```sh
  python3 -I scripts/assets/recolour-model.py --input assets/models/world/g2-vexillum.glb \
    --output assets/models/world/g2-vexillum-claimant.glb --report art-source/models/reports/g2-vexillum-claimant.json \
    --hue 0 --to '#4b5e7a'
  ```

  The pixels near `--hue` (within `--width` degrees, fading over `--soft` more) and saturated enough (`--min-saturation`) take `--to`'s hue, and their saturation and value are scaled so that the region's mean is `--to`, which keeps its folds and shading. Its geometry and other maps are unchanged. It needs Pillow and NumPy, not Blender. The report records the share of the map recoloured and the region's mean before and after (`#8c1812`, `#4b5e7a`).
- **Downloads.** All four files ship in the desktop app alone: the signum (171 kB), the eagle (160 kB) and the two vexilla (164 and 165 kB). The web downloads grow by 2 kB of code: the largest chapter download is 27.99 of 28 MB, Chapter I's 3D download 17.93 of 18, and the complete web game 78.57 of 80.

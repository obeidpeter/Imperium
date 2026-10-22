# Generated 3D assets: Tripo, Blender and the browser game

The owner asked on 2026-10-20 to upgrade the browser game's 3D assets with models generated in Tripo and refined in Blender. This guide is the workflow, budgets and integration plan. Read it with [CLAUDE.md](../CLAUDE.md), the [asset manifest](asset-manifest.json) and the [art generation record](art-generation.md).

## Status

- **In the game since 0.37.0:** sixteen generated character bodies, one for each kind of figure the battles and ceremonies show: Roman recruits, trainer, legionaries, archers, a centurion and a commander, a civilian, and Gothic, Persian and Palmyrene infantry, archers and riders. They replace the procedural bodies on the game's own skeleton, clips and kit. See [Generated characters in the game](#generated-characters-in-the-game).
- **In the game since 0.36.0:** five Tripo props for Chapter V, a supply camp on open ground off the board's west and south sides. They load at Balanced and High quality, in Chapter V's download only. See [Generated scenery in the game](#generated-scenery-in-the-game).
- **Compressed since the asset foundation:** every body and prop ships with KTX2 textures and meshopt geometry ([Compression](#compression)).
- **Tooling:** the Tripo client (generation and rigging), the Blender processing and binding steps, the quantizer, the compressor (KTX2 textures and meshopt geometry), the model checker and the preview renderer (see [Checked so far](#checked-so-far) and [Compression](#compression)).
- **Requests and provenance:** [`art-source/models/requests/`](../art-source/models/requests/) holds each exact prompt, Tripo task, rig task, model version, licence and raw digests; [`art-source/models/reports/`](../art-source/models/reports/) holds the processing and binding reports.

## One-time setup

1. **Tripo access**, in the cloud environment's settings, by the owner:
   - Allow `api.tripo3d.ai` under Network access → Allowed domains (done on 2026-10-20), and the host that serves finished models: the first task's links pointed to `tripo-data.rg1.data.tripo3d.com`, so allow that host or `*.data.tripo3d.com`.
   - Store the key as a **network secret**: Secret type **Bearer**, Allowed websites `api.tripo3d.ai`, header `Authorization` with prefix `Bearer`. The agent proxy adds the header to every request for that host, so the session never sees the key and the API client sends no key of its own. Only where network secrets are unavailable, use an environment variable `TRIPO_API_KEY` instead.
   - Check from a session without generating anything: `curl -sS https://api.tripo3d.ai/v2/openapi/user/balance` should answer `"code":0` with the balance. `"code":1002` ("Authentication failed") means the secret did not reach the request: the session predates the secret, or the value, host or prefix is wrong.
   - Never commit the key or paste it into a chat.
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
   - `npm run asset:tripo -- generate art-source/models/requests/<id>.json` creates the task, records its id at once (so an interrupted run resumes instead of paying again), polls it, downloads the model and records the parameters Tripo used, the credits the task reports and the raw digest. `resume` finishes a recorded task; `balance` reads the balance. A text-to-model task with default settings cost 20 credits on 2026-10-20.
   - For a character, `npm run asset:tripo -- rig art-source/models/requests/<id>.json` runs Tripo's free rig check and its biped auto-rig (25 credits), saves `art-source/models/raw/<id>-rigged.glb` and records the rig task. Ask for a T-pose or A-pose and leave out the shield, weapons, cloak and quiver: the game draws those itself.
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
8. **Integrate.** Put a prop in `assets/models/chapters/<NN>/`, add it to the [world catalog](../src/ui/world-catalog.js) with its kind and the chapters that show it, and add its placement to [`scenery-models.js`](../src/showcase/scenery-models.js). Choose ground the cameras see, off the board and clear of the scenery (see [Generated scenery in the game](#generated-scenery-in-the-game)), then add it to the tests in [`scenery-models.test.mjs`](../tests/scenery-models.test.mjs). Put a character body in `assets/models/characters/` and add the kits it fits and the chapters that show them to [`actor-body-catalog.js`](../src/ui/actor-body-catalog.js); [`actor-bodies.test.mjs`](../tests/actor-bodies.test.mjs) checks those chapters against the real campaign.

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

`--keep-skin` keeps a model's own rig, skin weights, morphs and clips and changes only scale and textures. The game's characters do not use it: they are bound to the game's own skeleton instead (next section).

Limitations:

- Materials stay as delivered; the script does no atlas baking. Generated props usually have one material.
- Decimation can thin very fine parts.
- In character mode the file's default pose becomes the bind pose, which can move a skinned part a few centimetres.
- The report counts triangles in Blender, before export. The glTF exporter can drop a few degenerate triangles, so the manifest records the shipped count from `asset:check`.

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
- Faces are part of the generated texture: no blinking, gaze or expression morphs, and one face per body.
- Colours are baked, so a body cannot take a figure's palette. Shields, cloaks and crests stay the game's own and keep their colours and heraldry.
- Weights come from Tripo's rig. Long robes deform with the legs, and an extreme pose can crease a shoulder.

## Compression

[`compress.mjs`](../scripts/assets/compress.mjs) prepares a processed or bound GLB for the game:

- **Textures** become KTX2 (`KHR_texture_basisu`): Basis Universal ETC1S at the encoder's default quality (128), with mipmaps. Colour maps are encoded as sRGB, normal maps with the encoder's normal-map settings, and metal/roughness maps as linear data. In the game each texture is transcoded to a format the GPU keeps compressed: ETC2 on most phones, BC7 or BC1 on most computers, about a quarter to an eighth of the memory of the decoded image. A 1,024 px colour map takes 0.7–1.4 MB of GPU memory instead of 5.6 MB, and needs no mipmaps made on upload.
- **Geometry** is reordered for the codec and packed with meshopt (`EXT_meshopt_compression`), with no filters and no new quantization, so every stored value is kept. The tool reads both models back and refuses to write unless every triangle, with all its attributes, is unchanged.
- **Report.** The input and output bytes (raw and gzip), the encoder version and settings, and each texture's use, size, original bytes, KTX2 bytes and the encoder's measured error (PSNR, in dB).

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

## Budgets

The download budgets are in [`presentation-budget.js`](../src/ui/presentation-budget.js):

| Budget | Limit (bytes) | Used at 0.35.1 | Used at 0.36.0 | Used at 0.37.0 | Used at 0.38.0 | Used with the asset foundation (unreleased) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| First load | 2,000,000 | 481,240 | 481,462 | 483,045 | 495,064 | 780,452 |
| Shell plus Chapter I (the 3D view since the asset foundation) | 12,000,000 (8,000,000 until 0.37.0, then 10,000,000) | 7,989,151 | 7,991,510 | 9,654,943 (345,057 left) | 9,495,867 (504,133 left) | 6,576,713 |
| Shell plus any one chapter, with its 2D art | 14,000,000 (new) | | | | | 10,490,504 (Chapter VIII, the largest) |
| Complete campaign | 50,000,000 (24,000,000 until the asset foundation) | 11,339,391 | 12,069,291 | 17,918,247 | 17,937,412 | 19,896,578 |

The figures are gzip sizes from `dist/build-report.json`, not a browser network trace. `chapterDownloadGzipBytes` there gives each chapter's download on a device's first visit, for the 3D view and with the 2D art. Every file directly in `assets/models/` belongs to every chapter's offline group, Chapter I included. A world asset (a generated prop, a landmark, a kit piece, a texture set or a panorama) belongs to the offline groups of the chapters the [world catalog](../src/ui/world-catalog.js) names, never to all of them (`chapterOfflineAssets` in [`art.js`](../src/ui/art.js)); until the asset foundation, a model's folder `assets/models/chapters/<NN>/` decided it. In 0.36.0 the loader and its wiring added 2,359 bytes to Chapter I's download, and the models added nothing; Chapter V's own group is 6,437,618 bytes.

The asset foundation takes the 2D view's art (unit atlases, action sheets, ground and prop atlases) out of the 3D download: the 2D view and painted figures add it when chosen. It raises the Chapter I limit to 12 MB and the complete campaign to 50 MB for the world models to come, and caps any one chapter's first download, with its 2D art, at 14 MB. The first load grew by about 285 KB between 0.38.0 and this work, more than half of it the real-time modules the shell imports. The 2 MB first load, the external requirement, is unchanged. Then the KTX2 and meshopt decoders (about 0.31 MB in every chapter) and the compressed models (about 1.1 MB more in all) brought Chapter I for the 3D view from 6.02 to 6.58 MB, and the largest chapter with its 2D art is now Chapter VIII.

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

- **Downloads.** A world asset belongs to the offline groups of the chapters the [world catalog](../src/ui/world-catalog.js) names (`chapterOfflineAssets` in [`art.js`](../src/ui/art.js)), so the five Chapter V props leave Chapter I's budget untouched. [`world-catalog.test.mjs`](../tests/world-catalog.test.mjs) checks that every model in `assets/models/chapters/` is catalogued with provenance and that every placed model downloads with the chapter where it stands; `scripts/verify-assets.mjs` checks each built chapter group holds exactly its own world files.
- **Loader.** [`scenery-models.js`](../src/showcase/scenery-models.js) holds the placements, in metres from the board centre. Since 0.38 each model is loaded once per session into a master that is never freed, as the character bodies are. The battle preloader loads a battle's masters before its stage is built; the stage places its own copies (sharing the master's geometry, materials and textures) as it builds the scene, so they compile and upload behind the "Preparing" veil. A master that is still loading joins when it arrives, compiled first.
  - It loads nothing at Performance quality.
  - It stands each model on the lowest ground sample under its footprint.
  - Models never take a pick or a click.
  - Models join the camera cutaway like the rest of the scenery: in the horizon, follow and action views, any part of a model between the camera and the selected units is cut away. As for all scenery, the overview has no cutaway, even when the player turns it low.
  - A stage never frees the session's masters; a loader given its own load function (the tests) owns and frees what it loaded, including a model that arrives after dispose.
  - A model that fails to load is simply absent.
  - A quality change rebuilds the set on the new ground.

  This is presentation only: no rules state and no gameplay randomness.
- **Content Security Policy.** The page allows `blob:` images but not `blob:` fetches. three.js's default `ImageBitmapLoader` fetches a GLB's embedded textures as `blob:` URLs, which the policy refuses. Since 0.38 [`model-loader.js`](../src/showcase/model-loader.js) decodes them with `createImageBitmap` straight from the GLB's own bytes: no request at all, and the browser decodes off the main thread, so uploading a texture is no longer also decoding it. An image that `createImageBitmap` refuses (or a browser without it) decodes through an image element as before. Since the asset foundation, KTX2 images are transcoded from the same bytes in a worker on the page's own origin, and the policy adds `'wasm-unsafe-eval'` for the decoders (see [Compression](#compression)).
- **Placement.** A search of the built scenes in both Chapter V encounters chose the ground. It reads every scene object's bounds and tests a grid of positions. A position qualifies when it is:
  - outside the board;
  - clear of every structure, wall and boulder;
  - in frame for the overview camera, unobstructed and never drawn over the board, so no unit is hidden.

  The horizon camera looks across from that same corner, and buildings near the arrival edge hide most of the props there.
- **Records.** Each model has a runtime entry in [`asset-manifest.json`](asset-manifest.json), with its prompt file, task, model version, raw digest, processing settings, bytes, SHA-256 and licence, plus a section in [`art-generation.md`](art-generation.md).
- **Art direction.** The tactical board, terrain and overlays stay code-drawn, as CLAUDE.md describes; the generated models decorate ground outside the board.

## Generated characters in the game

- **Which figures.** [`actor-body-catalog.js`](../src/ui/actor-body-catalog.js) maps a figure's kit (faction, role, armour; for the protagonist, a centurion's mail in Chapters IV–VI and a commander's cuirass from Chapter VII) to one of sixteen bodies. Every battle figure and both ceremonies' figures have one. Civic speakers and voters keep their procedural togas, whose trims name their bloc; the painted figure style is unchanged.
- **What changes.** A figure that wears a body loses its procedural clothes, armour, head, hair, face and limbs: every procedural surface on the body's own joints ([`actors.js`](../src/showcase/actors.js), `BODY_REPLACES` in [`actor-bodies.js`](../src/showcase/actor-bodies.js)). The rest stays the game's own and is drawn as before: the rig and every clip, gesture, contact and foot plant; the gripping hands; swords, spears, javelins, shields and their heraldry, bows, arrows, quivers, scabbards and standards; cloaks (purple for the emperor at the accession, since the body's tunic colour is baked) and crests and phalerae, the officer and veteran insignia; horses.
- **Loading.** [`actor-bodies.js`](../src/showcase/actor-bodies.js) loads one master per body, transcoding its KTX2 textures in a worker on the page's own origin within its Content Security Policy ([`model-loader.js`](../src/showcase/model-loader.js); see [Compression](#compression)), and skins it to each figure's own bones in the bind pose. Figures share the master's geometry and materials; each owns only its skinned meshes and skeleton, and disposal never frees the master. A figure starts procedural and switches when its body arrives; a body that fails to load leaves the procedural figure. The canvas reports how many figures wear one (`data-generated-bodies`).
- **Distance and crowds.** Each body has a near level (11,131–11,611 triangles) and an overview level (about 2,500), switched with the figure's other detail. Formation followers instance the overview with the leader's pose history, and fallen bodies bake its colours. The procedural figures measured up to 63,052 near and 11,673 overview triangles ([evidence](evidence/characters-v035.json)).
- **Downloads.** A body is in the offline group of each chapter whose figures wear it (`chapterOfflineAssets` in [`art.js`](../src/ui/art.js)); `scripts/verify-assets.mjs` and the tests check the groups against the catalog, and the catalog against the campaign.
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
- **Limits of these checks.** They ran in a CPU-only cloud container with software rendering (SwiftShader). No real device or GPU was involved, frame time and memory were not measured, and nobody has yet judged in play how the camp or the new figures read.

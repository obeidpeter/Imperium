# Generated 3D assets: Tripo, Blender and the browser game

The owner asked on 2026-10-20 to upgrade the browser game's 3D assets with models generated in Tripo and refined in Blender. This guide is the workflow, budgets and integration plan. Read it with [CLAUDE.md](../CLAUDE.md), the [asset manifest](asset-manifest.json) and the [art generation record](art-generation.md).

## Status

- **Regional world-building, 2026-10-23:** the approved Chapter V pilot now extends to the other eleven chapters with five original Blender kits (60 components), sixteen selected Tripo props, context-specific reuse of pilot assets and preparation hubs throughout the campaign. The detailed rollout, spending reconciliation and pending final verification are in [regional-world-building.md](regional-world-building.md).
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

| Budget | Limit (bytes) | Used at 0.35.1 | Used at 0.36.0 | Used at 0.37.0 | Used at 0.38.0 | Used with the asset foundation | Used with the soldier's bodies (unreleased) | Used with the regional worlds (unreleased) | Used with release 2: ground, sky and light (unreleased) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| First load | 2,000,000 | 481,240 | 481,462 | 483,045 | 495,064 | 780,452 | 792,130 | 809,581 | 817,259 |
| Shell plus Chapter I (the 3D view since the asset foundation) | 16,000,000 (8,000,000 until 0.37.0, then 10,000,000, then 12,000,000 until the worlds and gameplay plan) | 7,989,151 | 7,991,510 | 9,654,943 (345,057 left) | 9,495,867 (504,133 left) | 6,576,713 | 6,949,183 | 7,678,904 | 9,989,077 |
| Shell plus any one chapter, with its 2D art | 24,000,000 (14,000,000 until the worlds and gameplay plan) | | | | | 10,490,504 (Chapter VIII, the largest) | 10,851,859 (Chapter VIII) | 12,589,026 (Chapter V) | 14,824,097 (Chapter V) |
| Complete campaign | 80,000,000 (24,000,000 until the asset foundation, then 50,000,000) | 11,339,391 | 12,069,291 | 17,918,247 | 17,937,412 | 19,896,578 | 19,912,153 | 26,600,463 | 31,332,292 |

The figures are gzip sizes from `dist/build-report.json`, not a browser network trace. `chapterDownloadGzipBytes` there gives each chapter's download on a device's first visit, for the 3D view and with the 2D art. Every file directly in `assets/models/` belongs to every chapter's offline group, Chapter I included. A world asset (a generated prop, a landmark, a kit piece, a texture set or a panorama) belongs to the offline groups of the chapters the [world catalog](../src/ui/world-catalog.js) names, never to all of them (`chapterOfflineAssets` in [`art.js`](../src/ui/art.js)); until the asset foundation, a model's folder `assets/models/chapters/<NN>/` decided it. In 0.36.0 the loader and its wiring added 2,359 bytes to Chapter I's download, and the models added nothing; Chapter V's own group is 6,437,618 bytes.

Release 2 of the plan adds the ground's layers (1.9 MB in every chapter) and one regional skyline per chapter (217–364 KB): Chapter I for the 3D view grows to 9,989,077 bytes, the largest chapter with its 2D art (Chapter V) to 14,824,097 and the complete campaign to 31,332,292.

The [worlds and gameplay plan](worlds-and-gameplay-plan.md) raises three limits: Chapter I for the 3D view to 16 MB, any one chapter with its 2D art to 24 MB, and the complete campaign to 80 MB. The extra room is for the regional ground textures, trees, rocks, board kit, landmarks and new figures to come. The 2 MB first load, the external requirement, is unchanged. Before that work, with the regional worlds of PR #26, Chapter V with its 2D art was the largest chapter at 12,589,026 bytes. Chapter I took 7,678,904 for the 3D view and the complete campaign 26,600,463.

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

- **Which figures.** [`actor-body-catalog.js`](../src/ui/actor-body-catalog.js) maps a figure's kit (faction, role, armour; for the protagonist, a centurion's mail in Chapters IV–VI and a commander's cuirass from Chapter VII) to one of sixteen bodies. Every battle figure and both ceremonies' figures have one. Civic speakers and voters keep their procedural togas, whose trims name their bloc; the painted figure style is unchanged.
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


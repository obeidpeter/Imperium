# Generated 3D assets: Tripo, Blender and the browser game

The owner asked on 2026-10-20 to upgrade the browser game's 3D assets with models generated in Tripo and refined in Blender. This guide is the workflow, budgets and integration plan. Read it with [CLAUDE.md](../CLAUDE.md), the [asset manifest](asset-manifest.json) and the [art generation record](art-generation.md).

## Status

- **In the game since 0.36.0:** five Tripo props for Chapter V, a supply camp on open ground off the board's west and south sides. They load at Balanced and High quality, in Chapter V's download only. See [Generated scenery in the game](#generated-scenery-in-the-game).
- **Tooling:** the Tripo client, the Blender processing step, the model checker and the preview renderer (see [Checked so far](#checked-so-far)).
- **Requests and provenance:** [`art-source/models/requests/`](../art-source/models/requests/) holds each exact prompt, Tripo task, model version, licence and raw digest; [`art-source/models/reports/`](../art-source/models/reports/) holds the processing reports.

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

## Workflow for each asset

1. **Request.** `art-source/models/requests/<id>.json` holds the exact prompt, kept verbatim as CLAUDE.md requires, plus the chapters, the use and the budget. The owner approves the prompt.
2. **Generate.** Use Tripo's HTTP API (the network secret authenticates it): text-to-model, or image-to-model from a reference the project owns.
   - Save the result as `art-source/models/raw/<id>.glb`. Raw downloads are gitignored; the provenance and processed model are committed.
   - Record the task id, model version, date, raw SHA-256 and the licence of the owner's plan in the request file.
   - `npm run asset:tripo -- generate art-source/models/requests/<id>.json` creates the task, records its id at once (so an interrupted run resumes instead of paying again), polls it, downloads the model and records the parameters Tripo used, the credits spent and the raw digest. `resume` finishes a recorded task; `balance` reads the balance. A text-to-model task with default settings cost 20 credits on 2026-10-20.
3. **Process:**
   ```sh
   npm run asset:process -- --input art-source/models/raw/<id>.glb \
     --output assets/models/chapters/<chapter>/<id>.glb --report art-source/models/reports/<id>.json \
     --triangles <budget> --texture <pixels> --height <metres>
   ```
4. **Check:** `npm run asset:check -- <model.glb> --bytes <n> --triangles <n> --texture <n> --min-height <m> --max-height <m>`. It exits non-zero when the model breaks a budget or needs a decoder the game does not ship (Draco, meshopt, KTX2).
5. **Preview:** `npm run asset:preview -- <model.glb> <sheet.png>`. Look at the sheet:
   - shape and colours;
   - scale against the 1.8 m figure;
   - floating or missing parts.

   Regenerate rather than ship a poor model.
6. **Record.** Add a runtime entry to the `assets` list in [`asset-manifest.json`](asset-manifest.json) and a note in [`art-generation.md`](art-generation.md). `scripts/verify-assets.mjs` checks the bytes and SHA-256 of every entry. The entry needs:
   - the source: generator, model version, task id, and the prompt file;
   - the processing settings, from the report;
   - the export: format, bytes, SHA-256 and triangles;
   - the licence under the owner's Tripo plan.
7. **Integrate.** Put the processed file in `assets/models/chapters/<NN>/` and add its placement to [`scenery-models.js`](../src/showcase/scenery-models.js). Choose ground the cameras see, off the board and clear of the scenery (see [Generated scenery in the game](#generated-scenery-in-the-game)), then add it to the tests in [`scenery-models.test.mjs`](../tests/scenery-models.test.mjs).

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

`--keep-skin` is for characters. It keeps the rig, skin weights, morphs and clips and changes only scale and textures, so ask the generator for the triangle budget. Characters also need their own integration design, because the game's figures are built and animated in code.

Limitations:

- Materials stay as delivered; the script does no atlas baking. Generated props usually have one material.
- Decimation can thin very fine parts.
- In character mode the file's default pose becomes the bind pose, which can move a skinned part a few centimetres.
- The report counts triangles in Blender, before export. The glTF exporter can drop a few degenerate triangles, so the manifest records the shipped count from `asset:check`.

## Budgets

The download budgets are in [`presentation-budget.js`](../src/ui/presentation-budget.js):

| Budget | Limit (bytes) | Used at 0.35.1 | Used at 0.36.0 |
| --- | ---: | ---: | ---: |
| First load | 2,000,000 | 481,240 | 481,462 |
| Shell plus Chapter I | 8,000,000 | 7,989,151 (10,849 left) | 7,991,510 (8,490 left) |
| Complete campaign | 24,000,000 | 11,339,391 | 12,069,291 |

The figures are gzip sizes from `dist/build-report.json`, not a browser network trace. Every file directly in `assets/models/` belongs to every chapter's offline group, Chapter I included. Generated models therefore go in `assets/models/chapters/<NN>/`, which only chapter NN downloads (`chapterOfflineAssets` in [`art.js`](../src/ui/art.js), since 0.36.0). In 0.36.0 the loader and its wiring added 2,359 bytes to Chapter I's download, and the models added nothing; Chapter V's own group is 6,437,618 bytes.

Proposed limits per asset:

| Kind | Triangles | Texture edge | Bytes |
| --- | ---: | ---: | ---: |
| Small prop | 3,000 | 512 px | 200 KB |
| Large prop or tent | 5,000 | 512 px | 300 KB |
| Building or landmark | 15,000 | 1,024 px | 600 KB |

## Generated scenery in the game

- **Downloads.** Models in `assets/models/chapters/NN/` belong to chapter NN's offline group alone (`chapterOfflineAssets` in [`art.js`](../src/ui/art.js)), so Chapter I's budget is untouched. `scripts/verify-assets.mjs` checks that each such model is in exactly its own chapter's group.
- **Loader.** [`scenery-models.js`](../src/showcase/scenery-models.js) holds the placements, in metres from the board centre, and loads each model after the 3D stage builds its environment.
  - It loads nothing at Performance quality.
  - It stands each model on the lowest ground sample under its footprint.
  - Models never take a pick or a click.
  - Models join the camera cutaway like the rest of the scenery: in the horizon, follow and action views, any part of a model between the camera and the selected units is cut away. As for all scenery, the overview has no cutaway, even when the player turns it low.
  - It frees every geometry, material and texture on dispose, including a model that arrives after dispose.
  - A model that fails to load is simply absent.
  - A quality change rebuilds the set on the new ground.

  This is presentation only: no rules state and no gameplay randomness.
- **Content Security Policy.** The page allows `blob:` images but not `blob:` fetches. three.js's default `ImageBitmapLoader` fetches a GLB's embedded textures as `blob:` URLs, so the loader decodes them through image elements instead. The policy itself is unchanged.
- **Placement.** A search of the built scenes in both Chapter V encounters chose the ground. It reads every scene object's bounds and tests a grid of positions. A position qualifies when it is:
  - outside the board;
  - clear of every structure, wall and boulder;
  - in frame for the overview camera, unobstructed and never drawn over the board, so no unit is hidden.

  The horizon camera looks across from that same corner, and buildings near the arrival edge hide most of the props there.
- **Records.** Each model has a runtime entry in [`asset-manifest.json`](asset-manifest.json), with its prompt file, task, model version, raw digest, processing settings, bytes, SHA-256 and licence, plus a section in [`art-generation.md`](art-generation.md).
- **Art direction.** The tactical board, terrain, units and overlays stay code-drawn, as CLAUDE.md describes; the generated models decorate ground outside the board.

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
- **Limits of these checks.** They ran in a CPU-only cloud container with software rendering (SwiftShader). No real device or GPU was involved, frame time and memory were not measured, and nobody has yet judged in play how the camp reads.

# Generated 3D assets: Tripo, Blender and the browser game

The owner asked on 2026-10-20 to upgrade the browser game's 3D assets with models generated in Tripo and refined in Blender. This guide is the workflow, budgets and integration plan. Read it with [CLAUDE.md](../CLAUDE.md), the [asset manifest](asset-manifest.json) and the [art generation record](art-generation.md).

## Status

- **Done and checked:** the Blender processing step, the model checker and the preview renderer (see [Checked so far](#checked-so-far)).
- **Not done:** no Tripo model has been generated. The session that built these tools could not reach `api.tripo3d.ai` (network policy) and had no API key. No generated model is in the game, and the runtime does not load such models yet.
- **Proposed:** a first batch of five Chapter V scenery props in [`art-source/models/requests/`](../art-source/models/requests/), waiting for the owner's review.

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
7. **Integrate.** The first model also needs the work in the [Integration plan](#integration-plan).

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

## Budgets

The download budgets are in [`presentation-budget.js`](../src/ui/presentation-budget.js):

| Budget | Limit (bytes) | Used at 0.35.1 |
| --- | ---: | ---: |
| First load | 2,000,000 | 481,240 |
| Shell plus Chapter I | 8,000,000 | 7,989,151 (10,849 left) |
| Complete campaign | 24,000,000 | 11,339,391 |

Today every file in `assets/models/` belongs to every chapter's offline group (`chapterOfflineAssets` in [`art.js`](../src/ui/art.js)), Chapter I included. A generated model must therefore not go there until the grouping changes; use `assets/models/chapters/<n>/`.

Proposed limits per asset:

| Kind | Triangles | Texture edge | Bytes |
| --- | ---: | ---: | ---: |
| Small prop | 3,000 | 512 px | 200 KB |
| Large prop or tent | 5,000 | 512 px | 300 KB |
| Building or landmark | 15,000 | 1,024 px | 600 KB |

## Integration plan

These steps come with the first model, not before:

1. **Offline groups.** Leave `./assets/models/chapters/` out of the shared 3D set and add each chapter's folder to that chapter's group only. A test proves Chapter I's group is unchanged.
2. **Loader.** The 3D stage loads a chapter's models lazily, as [`actor-assets.js`](../src/showcase/actor-assets.js) does for anatomy. Each model is placed with the procedural scenery, which stays until the model is ready and remains if loading fails. This is presentation only: no rules state and no gameplay randomness.
3. **Placement.** Positions go in the chapter's scene data, outside the playable board.
4. **Tests.** Cover the offline groups, the build budgets (`npm run build` fails over budget) and the loader fallback, plus a smoke or benchmark capture of the chapter with its models.
5. **Art direction.** CLAUDE.md says tactical terrain, units and overlays are code-drawn. Update that line with the owner when generated models first ship.

## Proposed first batch

These are five decorative props for Chapter V (c. AD 256, the Euphrates fortress under siege), all placed outside the playable board:

| Request | Use | Budget |
| --- | --- | --- |
| [`ch5-spoil-baskets`](../art-source/models/requests/ch5-spoil-baskets.json) | Spoil baskets beside the mine works | 3,000 triangles, 0.6 m |
| [`ch5-gallery-timbers`](../art-source/models/requests/ch5-gallery-timbers.json) | Shoring frame at the countermine mouth | 5,000 triangles, 2.0 m |
| [`ch5-mudbrick-stack`](../art-source/models/requests/ch5-mudbrick-stack.json) | Mudbrick repair materials | 3,000 triangles, 0.8 m |
| [`ch5-storage-jars`](../art-source/models/requests/ch5-storage-jars.json) | Terracotta stores | 4,000 triangles, 1.1 m |
| [`ch5-leather-tent`](../art-source/models/requests/ch5-leather-tent.json) | An eight-man leather tent | 5,000 triangles, 1.8 m |

Each prompt adds the same exclusions: no people, animals, text, modern objects or fantasy elements. Together the batch adds at most about 1.25 MB to the complete campaign and nothing to Chapter I.

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
- **Tests.** `npm test` covers the checker on models and images already in the repository ([`asset-pipeline.test.mjs`](../tests/asset-pipeline.test.mjs)). Processing and previews are manual, because they need Blender and Playwright.
- **Limits of these checks.** They ran in a CPU-only cloud container with software rendering. No Tripo output, real device or GPU was involved.

# License and asset notices

Every file the game ships is listed in the [asset manifest](asset-manifest.json). Each entry records the file's source, processing, byte count, SHA-256 digest and use, and its licence where the source carries one. `node scripts/verify-assets.mjs` checks every count and digest. The [AI-content inventory](steam-ai-disclosure.md) is generated from the manifest, and a test keeps it in step: it counts the files of each kind. This page says where each kind comes from and under what terms.

The game generates nothing while it runs. It needs no image-generation service, no external image fetch and no media CDN. AI generation and a recorded prompt do not guarantee exclusive rights, copyright eligibility or non-infringement. No such legal guarantee is made here, and this page is not legal advice. The owner's [rights checklist for a commercial release](steam-release.md#rights-for-a-commercial-release) lists what remains to confirm.

## AI-generated images

The story paintings, the character portraits, their expression variants and the oath seal were generated for this project with OpenAI's built-in image-generation tool (`image_gen`, in the Codex app). So were the 2D figure, prop and action atlases, the 2D camp, ground and nature pictures, and some surface textures.
- Existing project-generated images were used as continuity references where recorded. No third-party image was supplied.
- Cropping, resizing, packing and compression produced the exports. The v0.16 character texture and the v0.17 earth, stone and timber maps are derivatives of earlier files, not separate generations.
- The generation records:
  - [narrative](graphics-narrative-art.md);
  - [version 0.8 world and animation](production-world-art.md);
  - [version 0.15 presentation assets](presentation-assets-v015.md);
  - [version 0.16 textures](presentation-assets-v016.md);
  - [version 0.18 character surfaces](character-surfaces-v018.md);
  - [the art record](art-generation.md), which also documents the superseded library.

On 4 November 2026, five character face textures inside generated models were restored with the same tool, from renders of the game's own models. They were then baked in Blender ([the art record](art-generation.md#character-face-restorations--4-november-2026)).

Eight greyscale depth maps of the story paintings were estimated offline with the MIT-licensed MiDaS v2.1 small model. The model is not bundled ([3D provenance](3d-art-provenance.md)).

## AI-generated 3D models

The following were generated with **Tripo**'s text-to-model service, from text prompts only, on the owner's paid account:
- most 3D figures and the horses;
- the camp and town props;
- the landmarks, the rocks and Chapter V's scenery;
- the finale's distant crowd;
- the models behind the inventory's item pictures, seven of which the figures also wear as their weapons and helmets;
- the standards the figures carry, and the finale's vexilla, one of them recoloured by the project's own script for the other side ([the art record](art-generation.md#g2s-pilot-the-standards--10-november-2026)).

Five faces were generated with Tripo's image-to-model service on the same account, from a picture rather than a prompt, each from its man's campaign portrait, the game's own art: Lucan's ([the art record](art-generation.md#g6s-pilot-faces-and-people--10-november-2026)), and Varro's, Sabinus's, Crispus's and Paullus's ([the art record](art-generation.md#the-rest-of-g6-the-first-batch--10-november-2026)).

The figures were rigged by Tripo's auto-rig. Each shipped file made from a Tripo model carries a licence line in the manifest, except the finale crowd's data, which is reduced from one of them. That line records Tripo's terms for paid users as the owner confirmed them on 20 October 2026:
- the owner may use, modify, distribute and commercially exploit the models;
- Tripo receives a royalty-free, non-exclusive licence to use and display them as needed to provide its service.

No copy of the terms, their version or the plan tier is kept here.

The project's Blender scripts fitted the models to the game's own skeleton and motions, reduced them and compressed them ([the asset pipeline](asset-pipeline.md)). The item models themselves are not shipped, only the pictures rendered from them.

## Made in Blender by the project

The project's own Blender scripts built these from no external images or models:
- the building, fortification and board kits, among them the Curia and the Aurelian Walls;
- the horizon panoramas.

The same scripts built the tree kits. Their bark and plant textures are CC0 sets from Poly Haven, and two of the kits use leaf cards cut from the generated foliage texture above.

Blender itself is a development tool and is not distributed. The builders, sources and compression reports are retained in the repository ([the asset pipeline](asset-pipeline.md)).

## CC0 sources

The male and female exposed anatomy, the short04 hair geometry, two diffuse skin textures and one alpha hair texture are adapted from **official MakeHuman CC0 sources**, separately from the project's AI artwork.
- The material and hair source files record a September 2020 CC0 release and credit Data Collection AB, Joel Palmius and Jonas Hauquier.
- These remain local:
  - the complete [CC0 notice](../vendor/makehuman/LICENSE.CC0.md);
  - the [male](../vendor/makehuman/source.json), [female](../vendor/makehuman/female-source.json) and [hair](../vendor/makehuman/hair-source.json) source records;
  - the [skin archive and member hashes](character-surfaces-v018.md).
- The geometry was fitted and packed for this rig. The textures were mechanically resized and compressed, keeping their source UV layout. In-memory tint normalization is documented.
- These are licensed third-party assets. They are not presented as original project sculpting, captured actor performances or exclusive intellectual property.

The ground textures and the tree kits' bark and plant textures come from **Poly Haven** sets, released under CC0 1.0 (a public domain dedication), which needs no attribution.
- Each shipped file made from them names its source pages and licence in the manifest.
- Each source set has a record in `art-source/cc0/` with its page, authors, licence page and the digest of every downloaded file ([CC0 textures](asset-pipeline.md#cc0-textures)).
- The intake also accepts ambientCG sets, but none ships.

## Audio

Fourteen original AI-generated MP3s are bundled locally, all made through the connected Runway tool without reference recordings:
- **Three music beds:** Google's Lyria 3 (`lyria-3-clip`).
- **Four environmental ambiences and three combat and footstep sounds:** Runway's sound-effects workflow.
- **Four fictional characters' voice lines:** ElevenLabs v3 (`eleven_v3`), with the provider's catalogue voices Elias, Kirk, Clint and Marlene. No real person's voice was requested or imitated.

The manifest and the [generation record](graphics-prompts/presentation-v015.json) keep the exact prompts, models, voices and task IDs. The music was later re-encoded smaller.

On the web the recordings are left out of the first download and come with the chapter downloads, or with the explicit complete download. The desktop app installs them all. No temporary signed media URL is shipped. The interface's short sound cues are synthesized by the game's code.

## Captures, icons and code-drawn content

The landing page's three gameplay images (`assets/site/`) are crops of actual captures of the game running in a browser. Only the HTML name labels were hidden; nothing was painted, generated or composited.

The three PNG app icons and the related `icon.svg` emblem are original procedural and vector drawings by the project, not AI-generated artwork. Palette optimization preserves the icon design. See [interface assets](interface-assets.md) for these six files and their processing.

The game's code draws the interface, maps, overlays and insignia as it runs. It also builds the procedural materials, and the code-built figures, horses and scenery that stand in when a model is missing ([3D provenance](3d-art-provenance.md)).

No font files are bundled. The device renders system fonts, and the project does not distribute those font files.

## Third-party code in the game

The campaign's 3D views and the optional standalone study bundle **Three.js 0.186.1**, copyright © 2010–2026 three.js authors, under the MIT License.
- The distributed modules are `vendor/three/three.module.js` and `vendor/three/three.core.js`. Their complete, unchanged copyright and permission notice is in [vendor/three/LICENSE](../vendor/three/LICENSE).
- They are local runtime dependencies, deferred from the campaign's initial shell, and no CDN is used. The [3D provenance record](3d-art-provenance.md) records their origin and hashes.
- Three.js's MIT license applies to that library, not automatically to this project's narrative, artwork or remaining source.

The game's model loader also bundles the decoders that Three.js 0.186.1 publishes with it. They are unchanged except for local `three` imports, and [vendor/three/addons/PROVENANCE.md](../vendor/three/addons/PROVENANCE.md) gives each file's published SHA-256.
- The KTX2 loader and its worker pool: MIT, three.js authors.
- The **Basis Universal** transcoder: copyright Binomial LLC, under the **Apache License 2.0** ([its licence](../vendor/three/addons/libs/basis/LICENSE)).
- The **meshoptimizer** decoder: copyright © 2016–2026 Arseny Kapoulkine, under the MIT License ([its licence](../vendor/three/addons/libs/LICENSE-meshoptimizer.txt)).
- Don McCurdy's **ktx-parse** ([its licence](../vendor/three/addons/libs/LICENSE-ktx-parse.txt)) and **zstddec** ([its licence](../vendor/three/addons/libs/LICENSE-zstddec.txt)): both MIT, the latter with the Zstandard decoder (BSD, Meta Platforms) compiled to WebAssembly.
- `basis_worker.js` beside the transcoder is generated from these files.

The in-game credits link each of these licences.

Development tools are not part of the game's build:
- the compression tools that make the project's KTX2 and meshopt models (Basis Universal's encoder, glTF-Transform, meshoptimizer's encoder and sharp);
- Blender and Playwright;
- the project's own asset scripts, its Tripo client among them.

The campaign rules remain dependency-free. The web game needs no package installation to serve or build, and Node.js and the user's browser are not part of its distribution.

## The desktop app

The desktop app for Steam ([docs/desktop.md](desktop.md)) adds:
- **Electron and Chromium.** Their licences are at the root of the packaged folder, in `LICENSE.electron.txt` and `LICENSES.chromium.html`, and the desktop credits point there.
- **steamworks.js 0.4.0**, under the MIT licence. The licence ships with it in `resources/app.asar.unpacked/node_modules/steamworks.js/`.
- **Valve's Steamworks API library**, brought by steamworks.js: `steam_api64.dll` on Windows, `libsteam_api.so` on Linux. Valve's Steamworks SDK terms cover shipping it with a game on Steam.

The Steam achievement icons in `desktop/steam/achievement-icons/` are for upload to Steamworks, not part of the game's build. They are cut from the game's own story paintings, item pictures, the emperor's portrait and the oath seal, apart from five insignia drawn in code ([the list](steam-achievements.md)).

The drafts of the Steam store's and library's images in `desktop/steam/store-art/` are not part of the game's build either ([the record](steam-store-art.md)).
- They are made from the oath painting and from renders of the game's own 3D view.
- Their lettering is set in **Cinzel** by Natanael Gama, copyright 2020 The Cinzel Project Authors, under the **SIL Open Font License 1.1**.
- The font file is kept with its licence and a source record in `art-source/fonts/cinzel/`, for the script that draws the images. The game does not ship it.

Steam's shortcut and app icons in `desktop/steam/icons/` are the game's own `icon.svg` emblem, drawn at Steam's sizes by the same script. They are not part of the game's build either.

The draft screenshots in `desktop/steam/screenshots/` are captures of the game itself, with the game's own art and interface. They are not part of the game's build either.

## The game's own source and text

The source and narrative were prepared for this Imperium build. They were written with AI coding assistants (OpenAI Codex and Anthropic's Claude) under the owner's direction and review. The project's history records this, and the owner confirmed it on 4 November 2026 ([the AI disclosure draft](steam-ai-disclosure.md#beyond-the-shipped-files)).

No source-code distribution licence or copyright-holder declaration has been chosen. Publishing or selling the game does not by itself grant a licence to redistribute its source. The repository owner should choose the appropriate licence before any public source release. This notice does not assert ownership or invent a licence grant.

Historical sources in [historical-research.md](historical-research.md) are linked research references. Their images, scans, articles and translations are not bundled assets. The game's oath is original writing inspired by the themes discussed in the notes, not a quotation presented as an attested third-century formula.

The three companion Word documents are the user's reference materials. They are not included in the playable distribution or copied into this source package.

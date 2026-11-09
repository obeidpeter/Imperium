# Steam’s AI-content disclosure: the draft

The draft answers to the AI section of Steam’s content survey ([the Steam plan](steam-plan.md), S4), for the owner to check and enter in Steamworks. Generated from [the asset manifest](asset-manifest.json) by `node scripts/steam-ai-disclosure.mjs`; do not edit it by hand. A test fails while it differs from the manifest, or while a shipped file’s source is not sorted here.

Steam’s own wording in Steamworks decides what is asked. This draft could not be checked against it: the session that wrote it could not reach Valve’s partner site. It rests on reports of the survey as Valve rewrote it in January 2026, which ask about AI-made content that players see or hear, in the game or on its store page, whether it was made before release or is generated while the game runs. This is not legal advice. The rights to the generated files are a separate question, in [the owner’s checklist](steam-release.md#rights-for-a-commercial-release).

## The answers

- **Made with AI before release (pre-generated): yes.** 254 of the 289 files the game ships were made with AI tools ([below](#what-it-rests-on-the-files-made-with-ai)), and so were its writing and code ([beyond the shipped files](#beyond-the-shipped-files)).
- **Generated while the game runs (live-generated): no.** The manifest’s runtime policy: “All shipped artwork, models, textures and audio are local files. No runtime AI generation, signed media URL or third-party media CDN is required. Procedural fallback materials and sound effects remain available.” The game connects to no AI service.

## The text for the store page

Steam shows it under “AI Generated Content Disclosure”. Edit it freely, but keep it true to the inventory below. The line on writing and code rests on the project’s history, not on the manifest; the owner confirmed it on 4 November 2026.

```text
This game was made with the help of generative AI tools. Everything described here was made before release: nothing is generated while you play, and the game connects to no AI service.

- Art: the story paintings, character portraits, 2D figures and some surface textures were generated with OpenAI’s image generation from original prompts written for this game, then cropped, packed and compressed for it. An AI depth-estimation model made depth maps of the paintings, which give them their slight movement.
- 3D models: the characters’ bodies and the horses, the camp and town props, the landmarks and rocks, and the models behind the inventory’s item pictures, which the figures also wear as their weapons and helmets, were generated with Tripo from original text prompts, then fitted to the game’s own skeleton and motions, reduced and compressed. Five character face textures were restored with OpenAI image generation from the game’s own model renders and baked in Blender.
- Music: the music tracks were generated with Google’s Lyria, through Runway.
- Sound: the ambience and the combat and footstep sounds were generated with Runway; the interface’s short cues are made by the game’s code.
- Voices: the voiced briefings are AI voices from ElevenLabs’ catalogue (through Runway), reading lines written for the game; no voice was cloned from a recording.
- Writing and code: the story, dialogue and in-game help, and the game’s code, were written with AI assistants (OpenAI Codex and Anthropic’s Claude) under the developer’s direction and review.

No third-party art, photographs or voice recordings were given to any generator. The building and fortification kits and the horizon panoramas were built in Blender by the game’s own scripts, the photographed ground textures and the skin textures come from CC0 libraries (Poly Haven and MakeHuman), and the interface is drawn by the game’s code: none of these was made with generative AI.
```

1,945 characters.

## What it rests on: the files made with AI

| What | Files | Made with | Then |
| --- | --- | --- | --- |
| Story paintings | 8 | OpenAI image generation (the built-in tool in the Codex app) | Cropped, resized and compressed by the project’s scripts |
| Portraits and the oath seal | 22 | OpenAI image generation (the built-in tool in the Codex app) | Cropped, resized and compressed |
| 2D figures and props | 6 | OpenAI image generation (the built-in tool in the Codex app) | Cut out, packed into atlases and compressed |
| 2D figures in action | 5 | OpenAI image generation (the built-in tool in the Codex app) | Cut out, packed into atlases and compressed |
| 2D camp, ground and nature pictures | 3 | OpenAI image generation (the built-in tool in the Codex app) | Cut out, packed and compressed |
| Surface textures | 10 | OpenAI image generation (the built-in tool in the Codex app) | Resized and compressed; some recompressed again |
| Characters’ bodies | 57 | Tripo text-to-model (v3.0, v3.1) and Tripo’s auto-rig; OpenAI image generation restored five face textures from the project’s own renders | Rigged by Tripo’s auto-rig, bound to the game’s own skeleton and motions, reduced and compressed |
| Horses | 4 | Tripo text-to-model (v3.1) | Bound to the game’s own horse rig and gaits, reduced and compressed |
| Landmarks | 32 | Tripo text-to-model (H3.1) | Processed in Blender by the project’s scripts, then compressed |
| Camp, town and battlefield props | 62 | Tripo text-to-model (H3.1) | Processed in Blender by the project’s scripts, then compressed |
| Chapter V scenery | 9 | Tripo text-to-model (H3.1, v2.5) | Processed in Blender by the project’s scripts, then compressed |
| Rock kits | 3 | Tripo text-to-model (H3.1) | Reduced in Blender and gathered into one kit for each region |
| Item pictures | 1 (from 35 models) | Tripo text-to-model (v3.1) | Each model rendered in Blender, then packed into one atlas |
| Weapons and helmets worn by the figures | 7 | Tripo text-to-model (H3.1) | Made from the item pictures' models: reduced and fitted in Blender by the project's scripts, then compressed |
| The finale’s distant crowd | 1 | Tripo text-to-model | Reduced by the project’s script from one generated figure |
| Tree kits | 2 | Blender, by the game’s own script, with CC0 bark and plant textures from Poly Haven | The oak and willow leaf cards use cells of a generated foliage texture (one of the surface textures above) |
| Music | 3 | Lyria 3 (`lyria-3-clip`), through Runway | Used as generated; re-encoded smaller |
| Ambience | 4 | Runway’s sound-effects workflow | Used as generated, without edits |
| Combat and footstep sounds | 3 | Runway’s sound-effects workflow | Used as generated, without edits |
| Voiced briefings | 4 | ElevenLabs v3 (`eleven_v3`), through Runway, with the provider’s voices Elias, Kirk, Clint and Marlene | Used as generated, without edits; the words are the game’s own lines |
| Depth maps of the story paintings | 8 | MiDaS v2.1 small (MIT), a depth-estimation model run offline | Estimated from the paintings, to move their layers |

The manifest records that no third-party image, model or recording was given to a generator. Some generations were shown the project’s own art: a supplementary cast sheet was shown its first generated atlas ([the art record](art-generation.md)), and each of the five face restorations was given a render of the game’s own model ([the art record](art-generation.md#character-face-restorations--4-november-2026)).

## Made without AI

| What | Files | Made with |
| --- | --- | --- |
| Building, fortification and board kits | 11 | Blender, by the game’s own scripts; no external images or models |
| Horizon panoramas | 9 | Blender, by the game’s own scripts; no external images or models |
| Tree kits | 1 | Blender, by the game’s own script, with CC0 bark and plant textures from Poly Haven |
| Body anatomy | 2 | MakeHuman (CC0), adapted by the project’s scripts |
| Skin textures | 2 | MakeHuman (CC0), adapted by the project’s scripts |
| Hair | 2 | MakeHuman (CC0), adapted by the project’s scripts |
| Ground textures | 2 | Poly Haven (CC0), resized and compressed |
| App icons | 3 | The game’s own code |
| Screenshots of the game, for the web page | 3 | Captures of the game running in a browser |

What the game draws in code as it runs is made without AI too: the interface, maps, overlays and insignia, and the interface’s sound cues. The 3D terrain and scenery, the 2D board and the code-built figures that stand in when a generated body is missing are drawn in code as well, but painted with textures and pictures from the two tables, generated and CC0 alike.

## Beyond the shipped files

- **Writing and code (confirmed by the owner on 4 November 2026).** The game’s code and text were written with AI assistants, as the project’s history records: commits by Claude Code and by OpenAI Codex, under the owner’s direction and review. Reports of the January 2026 survey leave tools that only make development faster out of the question. The story, dialogue and help are text the player reads, so the draft names them.
- **The Steam achievement icons** are cut from the same story paintings, item pictures, emperor’s portrait and oath seal, apart from five insignia drawn in code ([the list](steam-achievements.md)).
- **The store’s and the library’s images** ([the drafts](steam-store-art.md)): the header, small and main capsules, the page background and the library’s header are made from the oath painting, so they are AI-generated art too, and the art line covers them. The vertical capsule and the library’s capsule and hero are renders of the game’s own 3D view, and show its generated models as the game does. Steam’s two icons are the game’s emblem, drawn in code.
- **The draft screenshots and the draft trailer** ([the screenshots](steam-store-art.md#the-screenshots-drafts), [the trailer](steam-store-art.md#the-trailer-a-draft)) are captures of the game, and show its generated art, figures and item pictures as it plays. The trailer's music is the game's own battle track, so the music line covers it; it has no voice-over, and its end card is the library logo above.
- **3 development-only files** in `art-source/` are not shipped and are left out.

## Keeping it true

- After changing the manifest, run `node scripts/steam-ai-disclosure.mjs`. When the text for the store page changes, change it in Steamworks too.
- A file whose source fits none of the kinds in the script fails the test until it is sorted, so a new tool, or a generated file where there was none, never goes unlisted.

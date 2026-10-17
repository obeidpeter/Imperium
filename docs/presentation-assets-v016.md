# Version 0.16 texture provenance

This update adds an original generated foliage atlas and a smaller mechanical export of the existing character-material atlas. Earlier files and their manifest entries remain unchanged. The [asset manifest](asset-manifest.json) records the actual dimensions, byte counts and SHA-256 digests; the [v0.16 generation/export record](graphics-prompts/presentation-v016.json) distinguishes the retained prompt summary from exact original records.

## Foliage

OpenAI’s built-in image-generation tool produced the atlas from text without a reference image. The requested size was 2048 × 2048; the delivered PNG was **1254 × 1254 RGBA**, **3,212,647 bytes**, SHA-256 `aefee6e68f08ef659f6e27a8b2063936a3e84f306d3eea07a8610d415d30f54a`. Its original tool filename is `exec-8439d013-46a4-4bf3-ad78-5025e5ef1ebc.png`. The preserved master is `work/v016/foliage-master.png` in the local task workspace, outside the public source package.

The exact submitted prompt was not retained. The following is a **summary**, not a verbatim prompt: a square transparent four-quadrant atlas, with an oak twig spray of roughly 35–50 leaves at top left, drooping willow at top right, a date-palm frond at bottom left, and meadow/fern/grass foliage at bottom right. The requested treatment was realistic, neutral diffuse olive green, with no background, cast shadows or labels. The resulting foliage is an illustration used for environmental readability; it is not a botanical or archaeological reconstruction.

The runtime `assets/showcase/foliage-v016.webp` is **768 × 768 RGBA**, **348,748 bytes**, SHA-256 `5c1ccc1fd079a06f695d43e9930a8c199e0f3c95f605f717e41890df857e1dec`. Export used Pillow Lanczos resizing and WebP **quality 76, method 4, alpha quality 85**. Transparency is retained. Four 384-pixel cells supply the vegetation geometry. This was a mechanical resize/compression, with no creative repainting. Source and final export dimensions, modes and hashes were read locally; the final atlas was also visually inspected.

## Character material derivative

The original v0.15 generation and exact prompt remain in [the v0.15 record](graphics-prompts/presentation-v015.json). No new generation was used for `assets/showcase/character-materials-v016.webp`. Pillow decoded the existing `character-materials-v015.webp`, resized it with Lanczos and exported RGB WebP at **quality 90, method 6**.

The result is **512 × 512 RGB**, **109,312 bytes**, SHA-256 `747ccc2099675e49df5dc14988c5e9a75b01b0573672b4eb31ea2177fdfcc38f`. The input remains **1254 × 1254**, **438,826 bytes**, SHA-256 `8e8c326d36067f6b2a8e1713366376501b130c1b6a07af438711e009df7d8536`. Its quadrant order remains linen, leather, mail and skin. The four 256-pixel cells match the actor loader’s existing effective material resolution; lossy re-encoding is not a claim of pixel-identical colour. Runtime colour normalization and procedural bump/roughness fallbacks remain.

The current actor URL and chapter resource groups use the smaller derivative, reducing that chapter texture transfer by **329,514 raw bytes**. The previous file remains unchanged in source and the complete distribution/download, so this is not a reduction in the size of the complete archive. Both new textures are deferred from the initial shell. These loading statements describe the source configuration, not a newly measured network trace.

## Scope and rights

The shared character proportions, face topology, garment profiles and skinning are original project code. The new texture does not supply a scanned character, imported sculpt or captured animation. No extra recording, font, model library or runtime image-generation service is introduced by these two files. AI-generation records establish provenance rather than exclusive copyright, non-infringement or a license guarantee. See [license notices](LICENSE-NOTICES.md) for the existing project and Three.js boundaries.

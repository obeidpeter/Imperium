# Interface assets and optimization

The interface redesign reuses the existing frontier illustration and eastern scene. Their captions identify them as illustrative art. The two new images under `assets/site/` are **actual gameplay board captures**, mechanically cropped from already-captured browser evidence. They are not concept art or AI-generated mock-ups of the interface.

| Export | Source capture outside the runtime bundle | Crop rectangle, left/top/right/bottom | Output | Bytes |
| --- | --- | --- | --- | ---: |
| `assets/site/battle.webp` | `outputs/graphics-review/after-all12.png` | 0, 32, 600, 432 | 320 × 213 | 4,554 |
| `assets/site/contest.webp` | `outputs/graphics-review/desktop-senate.png` | 48, 276, 786, 766 | 320 × 212 | 5,276 |

The battle is Chapter I's boundary-road encounter, taken from the first panel of the browser-rendered graphics gallery. That gallery uses states reached by legal campaign commands. The Contest is the canvas portion of a real browser-interface screenshot. Neither crop includes the surrounding chapter heading, personal names, objectives, dialogue, action controls or later story outcome. Captions and alternative text state what is actually shown.

Both source images were inspected before cropping. The final exports were also inspected at their native dimensions. They total **9,830 bytes**, intended as small previews rather than full-screen screenshots or readable-control demonstrations. The displayed controls remain elsewhere in the real game. Images load lazily below the landing-page hero, with intrinsic dimensions reserved to reduce layout movement.

Pillow performs only crop, Lanczos downscale, and RGB WebP compression at **quality 40, method 6**. No source pixels are painted, removed selectively, relabeled, or generated. To reproduce, crop the listed rectangle, resize to the listed dimensions, and save with those settings. Wider or higher-quality alternatives were measured but exceeded the requested combined 10 KB allowance. Source and final SHA-256 hashes are in [asset-manifest.json](asset-manifest.json).

The capture PNG paths identify the separate review deliverable in this workspace; the PNGs are not shipped in the browser bundle. The underlying generated art retains the provenance and rights qualifications in [LICENSE-NOTICES.md](LICENSE-NOTICES.md); recording a screenshot does not create a new exclusive-rights guarantee.

## Installed-app icon optimization

The existing 180, 192 and 512-pixel PNG app icons are original code-native drawings of the project emblem, related to `icon.svg`. They are not AI-generated art. Their dimensions and design remain unchanged. The interface update converts their existing RGB pixels to a 256-colour palette with Pillow **MEDIANCUT**, **no dithering**, and PNG optimization.

This saves **22,711 raw file bytes** across the three icons. Independent RGB comparisons against `work/interface-baseline-04/Sacramentum/icons/` found a mean absolute channel error below **0.014 on the 0–255 scale** for each file, and a maximum difference of **11** in edge-antialiasing pixels. The 512-pixel before/after images were visually inspected with no apparent design change. Palette reduction is not byte-identical or mathematically lossless; it retains the intended appearance at these icon sizes.

The saving provides room for the interface markup and small gameplay previews within the existing package budget. No existing character portrait, scene, unit sheet or environment artwork was recompressed for this interface update. The production build report remains the authority for compressed package totals.

The [asset manifest](asset-manifest.json) now records **40 files**: 35 generated artwork files, two gameplay capture derivatives, and three code-native icons. Icon entries include the baseline PNG hash, related SVG path/hash, final hash, byte count and measured pixel differences. The SVG itself remains a separate source emblem and is not counted as one of these 40 raster files.

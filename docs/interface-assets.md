# Interface assets and optimization

The landing page reuses the frontier illustration and the eastern scene, whose captions identify illustrative art. Its three gameplay images under `assets/site/` are **actual captures of the game**, not concept art, generated interface mock-ups or composites.

| Export | Encounter and view | Capture | Crop | Output | Bytes |
| --- | --- | --- | --- | --- | ---: |
| `assets/site/battle-3d.webp` | Chapter V, the wall (`ch5-wall`); 3D, High quality, horizon camera two steps closer | 1600 × 630 | x 120–1380 | 1200 × 600 | 95,534 |
| `assets/site/senate-3d.webp` | Chapter XI, the Senate (`ch11-adlection`); 3D, High quality, default camera | 1600 × 630 | x 220–1340 | 960 × 540 | 66,866 |
| `assets/site/board-2d.webp` | Chapter IV, the gate (`ch4-gate`); 2D tactical view | 1600 × 550 | x 311–1289 | 960 × 540 | 94,954 |

Each capture is the battle stage of the production build (revision `31fcca249cbf`, commit `d42a09e`, version 0.38.1) in headless Chromium with SwiftShader software rendering, at a 1600 × 1000 viewport. Each encounter was reached from New Game by legal commands (`scripts/command-autoplay.mjs`) and restored at its start through the visible Restore dialog, as the twelve-chapter benchmark does, with reduced motion on and automatic resolution off. Only the HTML name labels (`.world-labels`) were hidden; the rendered scene is captured as drawn, objective markers included. Captions and alternative text identify gameplay and its chapter.

The images load below the landing hero through the lazy, connection-aware image policy, with intrinsic dimensions reserved to reduce layout movement. Together they are **257,354 bytes**, outside the first download. Pillow performs only RGB conversion, the crop, a Lanczos downscale and WebP compression at **quality 80, method 6**. No pixels are painted, removed, relabelled or generated. Source and final SHA-256 hashes, crop boxes and capture settings are in [asset-manifest.json](asset-manifest.json); the source PNGs are review evidence and are not shipped.

They replace the v0.8 previews `battle.webp` and `contest.webp`: 2D boards at 640 × 427 (99,700 bytes) that no longer showed the game's 3D battlefields and chambers. The README's `docs/images/production-battle.jpg` remains a copy of the v0.8 battle clip, outside the game bundle. The underlying generated art retains the provenance and rights qualifications in [LICENSE-NOTICES.md](LICENSE-NOTICES.md); recording a screenshot does not create a new exclusive-rights guarantee.

## Historical v0.5 installed-app icon optimization

The existing 180, 192 and 512-pixel PNG app icons are original code-native drawings of the project emblem, related to `icon.svg`. They are not AI-generated art. Their dimensions and design remain unchanged. The interface update converts their existing RGB pixels to a 256-colour palette with Pillow **MEDIANCUT**, **no dithering**, and PNG optimization.

This saves **22,711 raw file bytes** across the three icons. Independent RGB comparisons against `work/interface-baseline-04/Sacramentum/icons/` found a mean absolute channel error below **0.014 on the 0–255 scale** for each file, and a maximum difference of **11** in edge-antialiasing pixels. The 512-pixel before/after images were visually inspected with no apparent design change. Palette reduction is not byte-identical or mathematically lossless; it retains the intended appearance at these icon sizes.

That saving provided room for the v0.5 interface markup and its smaller gameplay previews. No character portrait, scene, unit sheet or environment artwork was recompressed during that historical interface update. The current production build report remains the authority for package totals.

The [asset manifest](asset-manifest.json) records every bundled asset (109 files today), including the three gameplay capture derivatives and the three code-native icons. Icon entries retain their v0.5 baseline PNG hash, related SVG path/hash, final hash, byte count and measured pixel differences. The SVG itself remains a separate source emblem and is not counted among those raster files.

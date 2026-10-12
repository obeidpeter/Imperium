# Interface assets and optimization

The interface reuses the frontier illustration and eastern scene, whose captions identify illustrative art. In **v0.8**, both images under `assets/site/` were refreshed from **actual v0.8 browser-rendered gameplay boards**. They are not concept art or generated interface mock-ups. The source JPEGs are exact browser screenshot clips, not edited or re-encoded source captures.

| Export | Source capture outside the runtime bundle | Input | Output | Bytes |
| --- | --- | --- | --- | ---: |
| `assets/site/battle.webp` | `work/production-review/site-battle-board.jpg` | 960 × 640 | 640 × 427 | 53,230 |
| `assets/site/contest.webp` | `work/production-review/site-contest-board.jpg` | 960 × 640 | 640 × 427 | 46,470 |

Both captures use a 1280 × 720 browser viewport and an exact board clip at x=160, y=0, width=960, height=640. The battle samples the real renderer's `action-move` timeline from legal trace step 12 in Chapter I. The Contest uses the earned `board-ch11-adlection` fixture. The included rules-state fixtures were reached by validated campaign commands. These captures show the actual Canvas board, not surrounding dialogue or command controls. Captions and alternative text identify gameplay.

Both source images were inspected before export. The refreshed exports total **99,700 bytes**, intended as illustrative gameplay previews rather than readable-control demonstrations. They load below the landing hero through the existing lazy/connection-aware image policy, with intrinsic dimensions reserved to reduce layout movement. The README's `docs/images/production-battle.jpg` is a byte-for-byte copy of the original battle clip and is excluded from the production game bundle.

Pillow performs only RGB conversion, Lanczos downscale and WebP compression at **quality 78, method 6**. The entire 960 × 640 source clip is retained before scaling. No source pixels are painted, selectively removed, relabelled or generated. To reproduce, resize each clip to 640 × 427 and save with those settings. Source and final SHA-256 hashes are in [asset-manifest.json](asset-manifest.json). This explicitly supersedes the v0.5 320-pixel, quality-40 previews and their combined 9,830-byte target; the v0.8 production build enforces the revised package budgets.

The capture JPEG paths identify the separate review evidence in this workspace; full screenshots are not shipped in the browser bundle. The underlying generated art retains the provenance and rights qualifications in [LICENSE-NOTICES.md](LICENSE-NOTICES.md); recording a screenshot does not create a new exclusive-rights guarantee.

## Historical v0.5 installed-app icon optimization

The existing 180, 192 and 512-pixel PNG app icons are original code-native drawings of the project emblem, related to `icon.svg`. They are not AI-generated art. Their dimensions and design remain unchanged. The interface update converts their existing RGB pixels to a 256-colour palette with Pillow **MEDIANCUT**, **no dithering**, and PNG optimization.

This saves **22,711 raw file bytes** across the three icons. Independent RGB comparisons against `work/interface-baseline-04/Sacramentum/icons/` found a mean absolute channel error below **0.014 on the 0–255 scale** for each file, and a maximum difference of **11** in edge-antialiasing pixels. The 512-pixel before/after images were visually inspected with no apparent design change. Palette reduction is not byte-identical or mathematically lossless; it retains the intended appearance at these icon sizes.

That saving provided room for the v0.5 interface markup and its smaller gameplay previews. No character portrait, scene, unit sheet or environment artwork was recompressed during that historical interface update. The current production build report remains the authority for package totals.

The current [asset manifest](asset-manifest.json) records **48 files**: 43 generated artwork files, two gameplay capture derivatives and three code-native icons. Icon entries retain their v0.5 baseline PNG hash, related SVG path/hash, final hash, byte count and measured pixel differences. The SVG itself remains a separate source emblem and is not counted among those raster files.

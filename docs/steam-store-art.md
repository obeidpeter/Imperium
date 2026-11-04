# The Steam store's and library's images: the drafts

These are the drafts of the images Steamworks asks for under **Store assets** and **Library assets** ([the Steam plan](steam-plan.md), S4). `node scripts/steam-store-art.mjs` makes them from the game's own art, with nothing generated, into `desktop/steam/store-art/`. They are for the owner to review before uploading. The screenshots and the trailer come after 0.40.0, once the game they show is final.

The sizes come from Valve's [graphical assets page](https://partner.steamgames.com/doc/store/assets), as quoted in search results, and from guides that agree with it. This session could not open Valve's partner site itself. **Check each size in Steamworks before uploading.** Developers report that Steamworks sorts an upload by its pixel size and refuses one that is off by a pixel.

## The images

| File in `desktop/steam/store-art/` | Steamworks slot | Size | Made from | Enlargement of the painting |
| --- | --- | --- | --- | --- |
| `header_capsule.jpg` | Store: header capsule | 920 × 430 | The oath painting, with the name | 1.11× |
| `small_capsule.jpg` | Store: small capsule | 462 × 174 | The oath painting, with the title alone | 0.56× (reduced) |
| `main_capsule.jpg` | Store: main capsule | 1232 × 706 | The oath painting, with the name | 1.51× |
| `vertical_capsule.jpg` | Store: vertical capsule | 748 × 896 | The recruit, from the oath painting, with the name | 1.92× |
| `page_background.jpg` | Store: page background | 1438 × 810 | The oath painting, darkened and softened | 1.73× |
| `library_capsule.jpg` | Library: capsule | 600 × 900 | The recruit, from the oath painting, with the name | 1.93× |
| `library_header.jpg` | Library: header | 920 × 430 | As the header capsule | 1.11× |
| `library_hero.jpg` | Library: hero | 3840 × 1240 | A render of the game's 3D view of the finale, before the Aurelian Walls, with no text | Rendered at its own size |
| `library_logo.png` | Library: logo | 1280 wide, on transparency | The name alone | Drawn at its own size |

The painting enlarges well up to about 1.5×. Above that, in the vertical capsule and the library capsule, it is softer but holds at the sizes Steam shows them. That judgement is the owner's; the [review sheet](#reviewing-them) shows all nine together.

## How they are made

- **The painting** is `assets/scenes/frontier-oath.webp` (832 × 467), the game's key art and the landing page's. It shows the recruit above the Danube camp at sunrise. It was generated with OpenAI's image generation for this project ([the art record](art-generation.md)). Its painted shadows stay as painted; only a dark gradient is laid over the part where the name goes, so it reads.
- **The name**, "IMPERIUM" over "From Recruit to Emperor", is set in **Cinzel**, a typeface of Roman capitals by Natanael Gama, under the SIL Open Font License 1.1. The font file is kept for the script only, with its licence and a source record, in `art-source/fonts/cinzel/`. The game does not ship it. Change the name in one place, `NAME` in the script, once the store name is decided ([the owner's checklist](steam-release.md)).
- **The emblem** between the two bronze rules is the star of the game's own `icon.svg`, drawn in code.
- **The library hero** is the game itself, not a painting:
  - **What is drawn:** the 3D stage of the finale (Chapter XII, the confrontation), drawn by the game's own renderer at High quality and at the full 3840 × 1240.
  - **Where it starts:** the encounter's legally reached start checkpoint, `ch12-confrontation` in `tests/fixtures/campaign-3d.json`. It comes from New Game by legal commands, the checkpoints the 3D review harness uses; nothing is posed or injected.
  - **The view:** the Horizon camera, drawn in to four fifths of its distance so that a near slab of stone drops out of the frame. The names over the figures are hidden. Rendering leaves the checkpoint unchanged, which the script checks.
  - **What it shows:** the Aurelian Walls and their gate, built in Blender by the project's own scripts; the armies in their generated bodies with the game's own kit; Rome on the hill behind.
  - **How it is rendered:** in headless Chromium's software WebGL, which takes several minutes. `node scripts/steam-store-art.mjs --hero` renders it again; without `--hero` the script keeps the hero it has.
- **The review sheet** is `tests/visual-results/steam-store-art/review-sheet.png`, not committed. It places the logo over the hero where Steam puts it by default, at the bottom left.

## Steam's rules to check in Steamworks

These are as reported; Steamworks' own pages decide.

- **Exact sizes,** as above. A test (`tests/steam-store.test.mjs`) fails while a file is missing or not at its size.
- **Capsules** carry the game's artwork and its name, and nothing else: no review quotes, awards, prices, discounts or "new".
- **The library hero** carries no text or logo. Steam places the library logo over it, and Steamworks sets where. The hero's lower left is kept quiet for it.
- **The library logo** is a PNG with transparency, 1280 pixels wide or 720 tall at most.
- **The page background** is optional, and Steam darkens it further.
- **Screenshots:** at least five, 1920 × 1080, captured from the game after 0.40.0.

## AI and rights

- **The AI disclosure.** The painted images are made from an AI-generated painting. The hero shows the game's AI-generated figures and horses with its own Blender-built walls and code-built kit. The store page's AI disclosure covers both, through its art and 3D-model lines ([the draft](steam-ai-disclosure.md)).
- **The rights** are those of the sources, recorded in the [licence notices](LICENSE-NOTICES.md). Cinzel's licence allows the lettering in these images.

## Still to do

- **The owner's review:** composition and name. The store name is still to decide.
- **Sizes and rules:** to check in Steamworks.
- **Screenshots and the trailer:** after 0.40.0 and the owner's Gate 4 sign-off.
- **Sharper portrait images, if wanted.** The vertical capsule and the library capsule could be rendered from the game like the hero, or drawn from new key art at a higher resolution, which would need a costed proposal first.

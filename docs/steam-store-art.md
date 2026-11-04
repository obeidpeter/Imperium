# The Steam store's and library's images: the drafts

These are the drafts of the images Steamworks asks for under **Store assets** and **Library assets**, and of the two icons it asks for under **Community and client icons** ([the Steam plan](steam-plan.md), S4). `node scripts/steam-store-art.mjs` makes them from the game's own art, with nothing generated, into `desktop/steam/store-art/` and `desktop/steam/icons/`. They are for the owner to review before uploading. The screenshots and the trailer come after 0.40.0, once the game they show is final.

The sizes come from Valve's [graphical assets page](https://partner.steamgames.com/doc/store/assets) and its [community and client icons page](https://partner.steamgames.com/doc/store/assets/community), as quoted in search results, and from guides that agree with them. This session could not open Valve's partner site itself. **Check each size in Steamworks before uploading.** Developers report that Steamworks sorts an upload by its pixel size and refuses one that is off by a pixel.

## The images

| File in `desktop/steam/store-art/` | Steamworks slot | Size | Made from | Enlargement of the painting |
| --- | --- | --- | --- | --- |
| `header_capsule.jpg` | Store: header capsule | 920 × 430 | The oath painting, with the name | 1.11× |
| `small_capsule.jpg` | Store: small capsule | 462 × 174 | The oath painting, with the title alone | 0.56× (reduced) |
| `main_capsule.jpg` | Store: main capsule | 1232 × 706 | The oath painting, with the name | 1.51× |
| `vertical_capsule.jpg` | Store: vertical capsule | 748 × 896 | A render of the game's finale, the formations before the walls, with the name | Rendered at its own size |
| `page_background.jpg` | Store: page background | 1438 × 810 | The oath painting, darkened and softened | 1.73× |
| `library_capsule.jpg` | Library: capsule | 600 × 900 | A render of the game's finale, the formations before the walls, with the name | Rendered at its own size |
| `library_header.jpg` | Library: header | 920 × 430 | As the header capsule | 1.11× |
| `library_hero.jpg` | Library: hero | 3840 × 1240 | A render of the game's 3D view of the finale, before the Aurelian Walls, with no text | Rendered at its own size |
| `library_logo.png` | Library: logo | 1280 wide, on transparency | The name alone | Drawn at its own size |

The painting enlarges well up to about 1.5×. Above that, in the page background, it softens, which suits a background that Steam darkens anyway. The two tall formats would have needed it nearly doubled, so they are rendered from the game instead, at the owner's request. The review sheet the script writes, `tests/visual-results/steam-store-art/review-sheet.png`, shows all nine together, with the two icons.

## The icons

| File in `desktop/steam/icons/` | Steamworks slot | Size | Made from |
| --- | --- | --- | --- |
| `shortcut_icon.png` | Shortcut icon | 256 × 256, on transparency | The game's emblem, `icon.svg`, with its rounded corners |
| `app_icon.jpg` | App icon | 184 × 184 | The same emblem, its corners filled with its own red, since a JPEG has no transparency |

- **The emblem** is the game's own icon: the star over the standard, drawn by the project in code, not AI-generated ([the licence notices](LICENSE-NOTICES.md)). Each icon draws it at its own size from the vector file.
- **The shortcut icon** is the one Steam puts on the player's desktop. By the same reports, Steam makes the Windows `.ico` from a PNG, and also accepts 512 × 512.
- **A Mac icon** (ICNS) is asked for only for macOS shortcuts. The game is Windows first, so there is none yet.

## How they are made

- **The painting** is `assets/scenes/frontier-oath.webp` (832 × 467), the game's key art and the landing page's. It shows the recruit above the Danube camp at sunrise. It was generated with OpenAI's image generation for this project ([the art record](art-generation.md)). Its painted shadows stay as painted; only a dark gradient is laid over the part where the name goes, so it reads.
- **The name**, "IMPERIUM" over "From Recruit to Emperor", is set in **Cinzel**, a typeface of Roman capitals by Natanael Gama, under the SIL Open Font License 1.1. The font file is kept for the script only, with its licence and a source record, in `art-source/fonts/cinzel/`. The game does not ship it. Change the name in one place, `NAME` in the script, once the store name is decided ([the owner's checklist](steam-release.md)).
- **The emblem** between the two bronze rules is the star of the game's own `icon.svg`, drawn in code.
- **The library hero, the vertical capsule and the library capsule** are the game itself, not a painting:
  - **What is drawn:** the 3D stage of the finale (Chapter XII, the confrontation), drawn by the game's own renderer at High quality, each image at its own full size. The stage is built once, then framed for each.
  - **Where it starts:** the encounter's legally reached start checkpoint, `ch12-confrontation` in `tests/fixtures/campaign-3d.json`. It comes from New Game by legal commands, the checkpoints the 3D review harness uses; nothing is posed or injected.
  - **The view:** the Horizon camera, drawn in to four fifths of its distance so that a near slab of stone drops out of the frame. For the two tall capsules, the camera's target moves 10 metres across the field. That centres the formations before the walls and towers, and keeps the slab out of the taller frame, which shows more of the near ground. The names over the figures are hidden. Rendering leaves the checkpoint unchanged, which the script checks.
  - **What it shows:** the Aurelian Walls and their gate, built in Blender by the project's own scripts; the armies in their generated bodies with the game's own kit; Rome on the hill behind.
  - **How they are rendered:** in headless Chromium's software WebGL, which takes several minutes.
    - `node scripts/steam-store-art.mjs --render` renders all three again; without `--render` the script keeps the renders it has.
    - The hero is its own final image.
    - The two capsules' renders are kept before their name is drawn, in `art-source/store-art/`, so the name can be drawn again without rendering.
- **The review sheet** is `tests/visual-results/steam-store-art/review-sheet.png`, not committed. It places the logo over the hero where Steam puts it by default, at the bottom left.

## The screenshots: drafts

Steam asks for at least five screenshots, at 1920 × 1080 by the same reports. These are taken from the game itself, with its interface as the player sees it. They show the game as it stands before 0.40.0, so take them again after the owner's Gate 4 sign-off, once what they show is final.

| File in `desktop/steam/screenshots/` | What it shows |
| --- | --- |
| `01-river-crossing.jpg` | Chapter VIII: the legion forcing the ford at the far bank, paused mid-fight |
| `02-finale.jpg` | Chapter XII: the road to the purple, before the Aurelian Walls and Rome, with the held H's glance at the horizon |
| `03-curia.jpg` | Chapter XI: the Senate's Contest as it opens, walked in the Curia |
| `04-cavalry.jpg` | Chapter IX: the turning cavalry, paused mid-fight |
| `05-camp.jpg` | Chapter V: the fortress camp before the red river gate, with the glance at its landmark |
| `06-kit.jpg` | The soldier's kit in Chapter X's camp: the inventory, with his gladius chosen |
| `07-promotion.jpg` | Chapter VI: the promotion to praefectus legionis, with the chapter's painting |

- **The moments** are reached from New Game by legal commands. `node scripts/steam-screenshots.mjs` plays the campaign with the real-time bot as the engaged reference player (seed 275, Standard), which takes about fifteen seconds:
  - a camp is kept as the chronicle stands there, and a promotion as the chapter's last encounter is recorded;
  - a Contest opens from its camp once the chapter's decision is taken, the one the bot takes;
  - a battle is kept mid-fight, as the game keeps one when play pauses: a resume point, at the second within the shot's window when the most of the soldier's side are fighting within 22 metres of him;
  - a battle's weather is drawn from the campaign's seed. Seed 275's finale is fought in mist, so the finale is taken from seed 276's campaign, whose day is clear. The script checks each battle's weather.
- **The shots** are taken in the desktop build (run `npm run build:desktop` first), in headless Chromium:
  - each save code is restored through the game's own Restore dialog;
  - the page has the player's own settings: real time, the 3D view at High quality, coaching off;
  - each shot is framed with the game's own controls: Pause, the − key's zoom, the held H's glance at the horizon, the bar's Kit button;
  - nothing is injected into the page, and no label is hidden.
- **Software rendering.** A frame takes several seconds in software WebGL, so after thirty frames the game steps its quality down on its own, as it would on a slow PC. On a page with a 3D world the script then chooses High in Settings, as a player would. The world stays built at High throughout, so nothing is rebuilt. The script checks that each shot was taken at High from start to finish, without page errors, and with the fight paused.
- **The record,** `docs/evidence/steam-screenshots.json`, names each shot's chapter, encounter and moment, the SHA-256 digest of its save, its camera and the build it was taken in.
- **The time:** a few minutes a shot. `--only 01-river-crossing,05-camp` takes some of them again.

## Steam's rules to check in Steamworks

These are as reported; Steamworks' own pages decide.

- **Exact sizes,** as above, the icons' and screenshots' included. A test (`tests/steam-store.test.mjs`) fails while a file is missing or not at its size.
- **Capsules** carry the game's artwork and its name, and nothing else: no review quotes, awards, prices, discounts or "new".
- **The library hero** carries no text or logo. Steam places the library logo over it, and Steamworks sets where. The hero's lower left is kept quiet for it.
- **The library logo** is a PNG with transparency, 1280 pixels wide or 720 tall at most.
- **The page background** is optional, and Steam darkens it further.
- **Screenshots:** at least five, 1920 × 1080, of the game itself: drafted above, to take again after 0.40.0.

## AI and rights

- **The AI disclosure.** The painted images are made from an AI-generated painting. The three renders show the game's AI-generated figures and horses with its own Blender-built walls and code-built kit. The screenshots show the game as it plays, with its generated paintings, portraits, figures and item pictures. The store page's AI disclosure covers all of them, through its art and 3D-model lines ([the draft](steam-ai-disclosure.md)). The icons are the project's own emblem, drawn in code.
- **The rights** are those of the sources, recorded in the [licence notices](LICENSE-NOTICES.md). Cinzel's licence allows the lettering in these images.

## Still to do

- **The owner's review:** composition and name. The store name is still to decide.
- **Sizes and rules:** to check in Steamworks.
- **The screenshots:** the owner's choice and order. Steam shows the first ones most. Take them again after 0.40.0 and the owner's Gate 4 sign-off.
- **The trailer:** after 0.40.0 and the Gate 4 sign-off.

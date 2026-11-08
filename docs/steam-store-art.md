# The Steam store's and library's images: the drafts

These are the drafts of the images Steamworks asks for under **Store assets** and **Library assets**, and of the two icons it asks for under **Community and client icons** ([the Steam plan](steam-plan.md), S4). `node scripts/steam-store-art.mjs` makes them from the game's own art, with nothing generated, into `desktop/steam/store-art/` and `desktop/steam/icons/`. They are for the owner to review before uploading. The screenshots and the trailer are drafts too, recorded from the game itself, to take again after 0.40.0, once the game they show is final.

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
- **The record,** `docs/evidence/steam-screenshots.json`, names each shot's chapter, encounter and moment, the SHA-256 digest of its save, its camera and the build it was taken in. Each JPEG also has its own `imageSha256` and `imageBytes`; the tests verify both against the file. Hashes added to earlier drafts identify their existing bytes and do not imply a new capture.
- **Interrupted captures:** every completed shot commits its image and evidence before starting the next. A journal retains the intended pair if a file replacement is interrupted. The next run completes it first, or `node scripts/steam-screenshots.mjs --recover` does that alone, without launching a browser. A hash mismatch stops recovery and retains the files for inspection. One process may capture at a time. After a hard crash, confirm that no capture process is running before removing only `docs/evidence/steam-screenshots.json.lock`, then run `--recover`; retain all pending image and journal files. Locks are never reclaimed automatically because competing recovery processes could otherwise remove each other's new lock. A failure making the contact sheet does not discard completed captures.
- **The time:** a few minutes a shot. `--only 01-river-crossing,05-camp` takes some of them again.

## The trailer: a draft

Steamworks' trailer page, as quoted in search results, asks for the highest resolution you have, up to 1920 × 1080, at 30 or 60 frames a second, with a high bit rate (5,000 kbps or more), in an .mov, .wmv or .mp4 file. This session could not open the page itself. **Check it in Steamworks before uploading.**

`desktop/steam/trailer/draft.mp4` is the draft: 34 seconds at 1920 × 1080 and 30 frames a second, H.264 video and AAC stereo sound in an MP4, at about 6,200 kbps (26 MB). It opens on a battle and closes on the game's library logo. Its sound is the game's own battle music, and it has no voice-over. Like the screenshots, it shows the game before 0.40.0: record it again after the owner's Gate 4 sign-off.

| Clip | Seconds | What it shows | The player's keys |
| --- | --- | --- | --- |
| `river-crossing` | 6 | Chapter VIII: the legion forcing the ford at the far bank, mid-fight | T and Enter before it starts (the nearest enemy); − three times at 2 seconds, so the view draws back over the ford |
| `camp` | 5 | Chapter V: the fortress camp before the red river gate | H held from 1.5 seconds: the view swings up to the fortress on the horizon |
| `promotion` | 4 | Chapter VI: the promotion to praefectus legionis, with its painting | none |
| `cavalry` | 6 | Chapter IX: the turning cavalry on the Euphrates, mid-fight | T and Enter before it starts; − three times at 2 seconds |
| `curia` | 5 | Chapter XI: the Senate's Contest as it opens, in the Curia | + twice at 1 second, so the view closes in on the members |
| `finale` | 7 | Chapter XII: the road to the purple, before the Aurelian Walls | T and Enter before it starts; H held from 3.5 seconds |
| end card | 4 | The library logo on black | |

- **The moments** are the screenshots' kind, reached from New Game by legal commands: the same campaigns (seed 275, and seed 276 for the clear finale), a battle kept mid-fight where the most of the soldier's side are fighting near him, a camp as the chronicle stands there, a Contest as it opens, a promotion as the chapter ends.
- **The recording.** `node scripts/steam-trailer.mjs` restores each save through the desktop build's Restore dialog in headless Chromium, with the player's settings for real time at High quality. P then pauses the world while the camera comes to rest on the soldier, the clip's first keys are given in that pause, as a player gives orders, and P resumes it; the clip plays on with the player's own keys, as listed above. Nothing is injected into the page, no label is hidden, and a request to anywhere but the local copy of the build fails the clip.
- **Time.** Software WebGL takes about five seconds to draw a frame at High quality, far too slow for a recording at the game's own pace. So the page keeps Playwright's clock: time flows as usual while the save loads, then stands still between frames and moves on by 1/30 s for each one. Each frame shows 1/30 s of play, drawn once, as a fast PC would draw it at 30 frames a second. The game's rules and commands are untouched; only the wait between frames changes.
- **High quality.** The game judges its quality by what its last 30 frames cost. Those it drew while the save loaded took seconds each, so before a clip starts the paused world draws 32 frames on the stopped clock, where a frame costs no time, and the slow frames drop out of the count. If the game stepped down meanwhile, the script chooses High in Settings, as a player would; the world stays built at High, so nothing is rebuilt. The script fails if any frame is drawn below High.
- **The cut.** ffmpeg (not a project dependency: `FFMPEG`, or ffmpeg on the path) joins the clips with half-second fades and fades the last into the end card. The battle music (`assets/audio/music-battle.mp3`) loops under the whole trailer, fades in and out, and is set to −16 LUFS in two passes with one gain throughout, so it is not compressed. The video is H.264 High, encoded in two passes at 6,000 kbps, a fifth above Steam's floor, so the draft is about 26 MB.
- **The record,** `docs/evidence/steam-trailer.json`, names each clip's chapter, encounter and moment, the SHA-256 digest of its save, the keys pressed, the ticks the world ran through and the build. It also gives the music's digest and loudness, the end card's, and the trailer's own `videoSha256` and `videoBytes`. The tests check the trailer's size, frame rate, codecs, length and bit rate against Steam's figures, and its digest against the record.
- **Interrupted captures** recover as the screenshots' do, with a lock and a journal of their own (`--recover`). Each clip is kept in `tests/visual-results/steam-trailer/` (not committed) with what it was recorded from. A later run records only the clips whose save, keys or build changed; `--only river-crossing,finale` records some again, and `--cut` cuts again from the kept clips.
- **The time:** about five seconds a frame on four cores, so about an hour and a half for the whole trailer (1 hour 34 minutes for this draft, on 8 November).

## Steam's rules to check in Steamworks

These are as reported; Steamworks' own pages decide.

- **Exact sizes,** as above, the icons' and screenshots' included. A test (`tests/steam-store.test.mjs`) fails while a file is missing or not at its size.
- **Capsules** carry the game's artwork and its name, and nothing else: no review quotes, awards, prices, discounts or "new".
- **The library hero** carries no text or logo. Steam places the library logo over it, and Steamworks sets where. The hero's lower left is kept quiet for it.
- **The library logo** is a PNG with transparency, 1280 pixels wide or 720 tall at most.
- **The page background** is optional, and Steam darkens it further.
- **Screenshots:** at least five, 1920 × 1080, of the game itself: drafted above, to take again after 0.40.0.
- **Trailers:** up to 1920 × 1080 at 30 or 60 frames a second, 5,000 kbps or more, in .mov, .wmv or .mp4: drafted above, to record again after 0.40.0.

## AI and rights

- **The AI disclosure.** The painted images are made from an AI-generated painting. The three renders show the game's AI-generated figures and horses with its own Blender-built walls and code-built kit. The screenshots show the game as it plays, with its generated paintings, portraits, figures and item pictures. The store page's AI disclosure covers all of them, through its art and 3D-model lines ([the draft](steam-ai-disclosure.md)). The icons are the project's own emblem, drawn in code.
- **The rights** are those of the sources, recorded in the [licence notices](LICENSE-NOTICES.md). Cinzel's licence allows the lettering in these images.

## Still to do

- **The owner's review:** composition and name. The store name is still to decide.
- **Sizes and rules:** to check in Steamworks.
- **The screenshots:** the owner's choice and order. Steam shows the first ones most. Take them again after 0.40.0 and the owner's Gate 4 sign-off.
- **The trailer:** the owner's review of its clips, their order and the end card. Record it again after 0.40.0 and the owner's Gate 4 sign-off.

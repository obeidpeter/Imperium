# Changelog

## Unreleased — 0.40: real time with pause, Phases 0–4

### The README brought up to date

The owner asked for it. The README no longer describes 0.40's game as turn-based, browser-first or made of original horses:

- **What the game is.** Battles and Contests play in real time with pause, or in turns. The planned release puts the full game on Steam as a Windows desktop app and Chapters I–III on the web as a free demo; neither is published yet.
- **What 0.40 adds since its five phases:**
  - the worlds and gameplay plan's camps, modelled worlds, generated cast and horses, missions and full-screen world;
  - the desktop app, the demo, the achievements, and the drafts of the store text and AI disclosure.
- **The 0.37 section** notes that the horses and the named cast have since gained generated bodies of their own. `docs/steam-release.md` no longer lists the README as out of date.
- **Building.** The download limits are today's 18 and 28 MB, with their history. The demo and desktop builds are described, and how to publish the demo on its own origin.
- **Saving.** The paths through **Menu → Settings → Saves & offline** replace the old Pause entries, and the desktop app's save file and its recovery are described.
- **Project map and checks.** The real-time core, the controls model, the achievements, the platform boundary, `desktop/` and the demo's file list are in the project map, and the demo and desktop browser checks are listed.

### Desktop saves: an accurate message, and the guide says what is recovered

- **An unchecked file is not "changed".** Sometimes the desktop app cannot read the save file when it starts and has no record of the file's last version. It still refuses to replace the file. It no longer says the file "changed outside the game", which nothing showed. It says the file could not be read when the game started, so it has not been checked against the player's progress or replaced (`src/ui/storage.js`). A test covers it.
- **The player guide and in-game help** say that progress which did not reach the file is written to it at the next launch, if the file has not changed meanwhile. A file changed outside the game, for example by Steam Cloud from another computer, is loaded. This computer's progress is then kept as a recovery record, under **Menu → Settings → Saves → Recover older progress**. While the file cannot be read, the game does not replace it.

### Follow-ups to #73 and #74

- **Higher download limits,** at the owner's request: #74's larger recruit and Aelia models had left Chapter I's first download 32 KB under its limit.

  | Limit | Was | Now | Used |
  | --- | --- | --- | --- |
  | Chapter I, 3D view | 16 MB | 18 MB | 15.97 MB |
  | Any one chapter, with its 2D art | 26 MB | 28 MB | 25.38 MB (Chapter XII) |

  The 2 MB first load (the requirements' own limit) and the 80 MB complete campaign are unchanged. The desktop app, which installs every chapter, is not subject to them. [The asset pipeline](docs/asset-pipeline.md) records the new limits and today's sizes.
- **A damaged chronicle at load** again says where its data is kept: "The unreadable data stays on this device; Settings can download it." #74's new load messages had dropped the sentence.
- **Steam's AI disclosure** counts the faces restored with OpenAI image generation from the asset manifest, instead of a number written into its script. It also says that each restoration was shown a render of the game's own model.
- **Records:**
  - the art record describes the face restorations ([docs/art-generation.md](docs/art-generation.md#character-face-restorations--4-november-2026));
  - the owner's rights table counts them with the illustrations;
  - CLAUDE.md gives Tripo's V3 authentication and paid-task guard, and the Linux desktop check's Openbox helper.

### Save recovery, camp entrances and character surfaces ([#74](https://github.com/obeidpeter/Imperium/pull/74), [the change notes](docs/save-camp-art-refinements.md))

The owner's pull request, merged on 4 November.

- **Desktop saves:**
  - Each local save records the file version it was based on. After a failed file write, a relaunch recovers the newer local progress over its unchanged file and writes it back.
  - A file changed outside the game is loaded, and the local copy is kept as a recovery record.
  - Only a missing file counts as absent. Any other read error stops file writes, without replacing the file, until it is readable and matches again.
  - Writes run one at a time and compare the file they expect before an atomic replace, keeping the previous copy. A corrupt file is preserved, and a valid previous copy can recover an empty profile.
  - Quit no longer reports success for a save held only in memory or in conflict.
- **Camps:** frontages, worn paths and the kept-clear approach follow each camp's real gate in all twelve chapters: Chapter VI's from the west, VII's from the east, the others' from the south. The low camp camera stays in front of moved walls. Rules, navigation and interactions are unchanged.
- **Characters:**
  - five faces are restored with OpenAI image generation from renders of their own models;
  - the eleven named men's distant heads are rebuilt from their detailed heads;
  - three civilians' neck gaps are closed with a skinned bridge.

  The thirteen models grow by 1.76 MB, and the per-chapter download ceiling rises from 24 MB to 26 MB. The largest chapter is about 25.4 MB.
- **Desktop checks:**
  - native F11 and Alt+Enter, with the fullscreen result awaited;
  - real disk faults, a relaunch and an external change on the packaged app;
  - Openbox under Xvfb on Linux, for minimize and restore (`scripts/desktop-smoke-linux.sh`).

### The Tripo pipeline on V3 ([#73](https://github.com/obeidpeter/Imperium/pull/73), [the migration guide](docs/tripo-v3-migration.md))

The owner's pull request, merged on 4 November. It changes development tooling only: the game and its shipped models are unchanged.

- `scripts/assets/tripo-client.mjs` uses Tripo's V3 API at `openapi.tripo3d.ai/v3`, since Tripo retired V2 on 1 November.
  - New requests are pinned to current models: geometry `v3.1-20260211`, textures `v3.0-20250812`, and the biped rig `v1.0-20240301` that the Blender binder expects.
  - Models Tripo is retiring are refused.
- **Spending:** a paid task needs `--allow-paid`, after a `--dry-run` that makes no request. Each submission is saved before it is sent, under a lock and with atomic writes, and creation is never retried automatically.
- **Recovery** (`resume`, `resume-rig`, `task` and the free `rig-check`) restores a raw file only when its hash matches the record. Completed records stay byte for byte as they were.
- **Authentication:** `TRIPO_API_KEY`, or an approved proxy secret on `openapi.tripo3d.ai` with `TRIPO_PROXY_AUTH=1`. A secret scoped to the old `api.tripo3d.ai` no longer authenticates.
- **Checked:**
  - 52 offline tests (`tests/tripo.test.mjs`);
  - a live, read-only check of the balance and two historical tasks, whose models matched their recorded hashes.

### The page no longer calls the game turn-based

- **The page's description** (`index.html`), which search results and shared links show, now reads "A Roman tactical chronicle in real time with pause", as 0.40 plays. The free demo's build still writes its own description.
- **Art & credits** opens with "deterministic tactical play in real time with pause or in turns", the two ways New Game offers.

### Steam, fourth package, first part: the store page's text and the AI disclosure, drafted ([the plan](docs/steam-plan.md))

Drafts for the owner to edit before entering them in Steamworks. The rest of S4 (store art, trailer, release) still waits for 0.40.0 and the owner's Gate 4 sign-off.

- **[The store page's text](docs/steam-store-text.md)**, drawn from the player guide:
  - the working title;
  - a short description of 269 characters (Steam's reported limit is 300);
  - *About This Game* in Steam's markup, with no links, since Steam has allowed none there since September 2024;
  - languages, genres and tags, Steam features and controls;
  - the Windows requirements, measured where they can be and marked for the owner's device check where they cannot;
  - what the game shows, for the content survey's other questions.

  A test checks the short description's length, the absence of links and every number in the text against the game's data.
- **[The AI disclosure](docs/steam-ai-disclosure.md)**, generated from the asset manifest by `node scripts/steam-ai-disclosure.mjs`:
  - the two answers: made with AI before release, yes; generated while the game runs, no;
  - the text for the store page, a sentence for each kind of AI-made content the game ships;
  - the inventory: 192 of the 227 shipped files made with AI tools, sorted by what they are, what made them and what was done after. That is 54 illustrations; 112 Tripo models, the item pictures rendered from 35 more and the finale's crowd reduced from one; two tree kits with generated leaf cards; 14 audio files; and 8 depth maps;
  - what was made without AI;
  - what lies beyond the shipped files: the writing and code (the owner to confirm), the achievement icons and the store art to come.

  A test fails while the draft differs from the manifest, and while a shipped file's source fits none of the script's kinds. A new tool, or a generated file where there was none, therefore never goes unlisted.
- **Not checked against Steam itself:** the session could not reach Valve's partner site, so Steam's limits and rules here come from reports (the September 2024 description rules, the January 2026 rewrite of the AI section). The drafts say so where they rely on them.
- **Docs:** the owner's checklist links both drafts, the plan's status and CLAUDE.md name them.

### Steam, third package, second part: the achievement icons ([the list](docs/steam-achievements.md))

- **The 35 achievement icons** are made from the game's own art, with nothing new generated: each in `desktop/steam/achievement-icons/` as a 64 × 64 JPEG with a greyed locked copy, ready to upload in Steamworks.
  - **Chapters:** each chapter's painting, with its numeral.
  - **Titles, the finale's routes, the torc and the spear of honour:** item pictures, with swords and spears set across the diagonal so they fill the square.
  - **The other five decorations:** insignia drawn in code (the civic, rampart and mural crowns, the armlets and the medals).
  - **The two finishes:** the emperor's portrait and the oath seal.
- `node scripts/steam-achievement-icons.mjs` remakes them in headless Chromium and writes a review sheet to `tests/visual-results/steam-icons/`. `--size=` makes another size if Steamworks asks for one.
- [docs/steam-achievements.md](docs/steam-achievements.md) now names each icon's source, and [the art record](docs/art-generation.md#steam-achievement-icons--3-november-2026) its provenance.
- A test checks that every achievement has both icons at 64 × 64, from files the game ships, and that no two icons share a picture.

### Steam, third package, first part: achievements and the Steam link ([plan](docs/steam-plan.md), [the list](docs/steam-achievements.md), [the app](docs/desktop.md#steam-s3))

The owner approved the achievements on 3 November: all 35, with English names, and the 24 tied to Chapters IV–XII hidden on Steam until earned. Steam itself switches on once there is an App ID; until then the app runs exactly as before.

- **The 35 achievements** are data (`src/data/achievements.js`):
  - the twelve chapters, named after their titles;
  - the seven decorations: Civic Crown, Armlets of Valour, Rampart Crown, Mural Crown, Torc of Valour, Medals of Service and Spear of Honour;
  - the nine errand titles;
  - the five routes through the final confrontation;
  - finishing on Veteran, and under Iron discipline.
- **Earned from the chronicle, never granted.** `earnedAchievements(state)` (`src/core/achievements.js`) reads them from what the rules already record and changes nothing. That is the completed chapters, the soldier's decorations and titles, the confrontation's winning route, and the accession with its difficulty (chosen at New Game) or Iron discipline (which can be turned off but not on again). A Practice replay earns none.
- **The desktop app reports them.** After each save, restore and load, the page sends what the chronicle has earned to the bridge, and Steam unlocks what it does not have yet. A chronicle brought from the browser or the demo therefore unlocks what it already earned.
- **The Steam link,** `desktop/steam.cjs`, uses steamworks.js 0.4.0 (MIT), the app's one runtime dependency.
  - It starts only with a Steam App ID (`"steamAppId"` in `desktop/package.json`, or `IMPERIUM_STEAM_APP_ID` for development) and a running Steam client. It then turns on the overlay.
  - Without them, the bridge's `steam.status()` says why, and nothing happens.
  - Each package is set to carry only its own platform's Steam library. Measured on Linux: 2.3 MB.
- **For the owner:**
  - [docs/steam-achievements.md](docs/steam-achievements.md) lists each achievement's API name, name, description and hidden flag to enter in Steamworks. `node scripts/steam-achievements.mjs` regenerates it, and a test fails while it differs from the list.
  - `desktop/steam/` holds SteamPipe templates for the first upload.
  - The checklist in [docs/steam-release.md](docs/steam-release.md) has the new steps.
- **The desktop credits** name steamworks.js and Valve's Steamworks API.

**Checked:**
- **Automated tests:** `npm test`, with `tests/achievements.test.mjs`. It covers:
  - the list against the game's chapters, decorations, titles and routes;
  - the owner's cut-off, checked against each item's chapter;
  - a finished campaign's twelve chapters and route, read without changing anything;
  - an injected record for the decorations, titles and finishes;
  - the sheet in step;
  - the report through a stand-in bridge;
  - Steam off without an App ID.
- **The desktop check:** on the packaged Linux app it now also finds Steam off and unlocking nothing.

**Not checked:**
- Steam itself: the overlay, unlocking and cloud saves need the App ID and the owner's Windows PC.
- The icons, which come next.

### Steam, second package: the free web demo ([plan](docs/steam-plan.md), [the owner's checklist](docs/steam-release.md))

The web version becomes a free demo of Chapters I–III that points to the full game on Steam. Publishing it stays the owner's decision: nothing about the full web build changes.

- **`npm run build:demo`** builds the demo into `dist-demo/`, beside the full game's `dist/`, which every check still reads.
  - It leaves out the 111 files only Chapters IV–XII use: models, landmarks, panoramas, later paintings and their sounds. That is 25.0 MB of the full game's 53.3 MB compressed, so the whole demo is 28.2 MB.
  - Its title, description and install name say it is the free demo.
  - `STORE_URL` gives it the full game's store page, once there is one.
- **The rules end the demo at Chapter III's promotion.** `advanceChapter` takes the build's last chapter and refuses to go past it, changing nothing. The limit belongs to the build, never the save, so a demo save is a full-game save.
- **End of the demo.** Chapter III's promotion names the appointment waiting in the full game, with **Keep a save code** and **Continue on Steam** (until the store page exists: "The full game is coming to Steam").
- **The demo never opens a later chronicle.**
  - A save code from past Chapter III is refused before it replaces anything.
  - A later chronicle already on the device stays as it is: the title says why and offers its save code.
- **What the demo's pages say.**
  - The title says "Free demo · Chapters I–III of XII", with the demo's six encounters, and so does the footer.
  - The offline notices download and count the demo's three chapters.
  - The next chapter's art is not warmed past Chapter III.
- **The desktop app** offers **Import a chronicle from the browser** on its first title page, and its restore panel explains how.
- **A fix in the rules:** Chapter XII's accession, refused when the Senate admission or the confrontation is missing, now refuses before granting anything. A valid save never reaches it.
- **For contributors:**
  - `npm run smoke:demo` checks the demo build through its interface: the title, a Chapter IV code refused, Chapter III's promotion as the End of the demo, and a kept code that the full game advances. No request may fail.
  - `runRealtimeCampaign` takes `lastChapter`, to play the demo from New Game.
  - CI runs the check after building the demo.

**Checked:**
- **Automated tests:** `npm test`, with `tests/demo-edition.test.mjs`.
- **Browser check:** `npm run smoke:demo` in headless Chromium, on the demo build.
- **Builds:** both the demo and the full game build. The full build's files and budgets are unchanged.

**Not checked:**
- **A device:** phone and desktop browsers on the demo.
- **The demo deployed:** that is the owner's step. It needs its own origin, because two builds on one origin share its saves and replace each other's offline caches.

### Steam, first package: the desktop app ([plan](docs/steam-plan.md), [the app](docs/desktop.md), [the owner's checklist](docs/steam-release.md))

The owner chose to sell Imperium on Steam, Windows first, and to keep a free web demo. This first package builds the desktop app; Steam itself (achievements, the overlay, cloud saves) comes once the App ID exists.

- **The desktop app.** `desktop/` is an Electron window around the same game, in a package of its own, so the web project still has no dependencies. It serves the game from its own files at `app://imperium`, one origin that must never change, since the saves belong to it.
  - **It starts full-screen.** F11, Alt+Enter or **Settings → Graphics → Window** switch it, and it remembers the window. Esc stays with the game.
  - **The chronicle is a file:** `%APPDATA%\Imperium\saves\campaign.json` on Windows, written atomically with the copy before it kept beside it. Steam Cloud will sync that file. Loading adopts the file when it differs from the app's own store, and keeps what it replaces as a recovery checkpoint.
  - **Menu → Quit to desktop**, and closing the window, save first. If the save fails, the player chooses between quitting anyway and playing on.
  - **One copy at a time**; no browser menus, reload or zoom keys; the faster graphics chip on laptops with two.
  - **No network.** Web links open in the system browser, and the game makes no request outside its origin.
- **`npm run build:desktop`** builds the game for it into `dist-desktop/` (63 MB): no service worker, offline packs or install manifest, and `platform: 'desktop'` in its configuration. `src/ui/platform.js` is the one place the game asks which it is. Without the app's bridge, a desktop build behaves as the web.
- **On the desktop, the page speaks of the installed game.** The title page, footer and privacy notes no longer offer free browser play. Settings has no offline section, and its saves page is called **Saves**. The reign card prints no site address.
- **The web game is unchanged**, except its credits. They now name every source the game ships (Tripo, MakeHuman, Poly Haven, Blender, the audio generators, Three.js and its decoders) and link the licences, and no longer say the figures and horses are original code-built meshes. The decoders' missing licence texts now ship with them: ktx-parse, zstddec, meshoptimizer and Basis Universal's attribution.
- **The player guide and the in-game help** have a section on the desktop app.
- **For contributors:**
  - `npm run smoke:desktop` drives the app through its interface with Playwright's Electron support: New Game to the first camp with the save written as a file, Quit after it, and a relaunch with only the file, which offers to continue the same chronicle.
  - CI's new `desktop` job packages the app on Linux and Windows and runs that check on the packaged app. Each push to main keeps the Windows app folder for a week, as `imperium-windows`. It is unsigned.

**Checked:**
- **Automated tests:** `npm test`, with new storage and platform tests.
- **The desktop check, in this session:** on Linux under a virtual display (xvfb), both on the repository's Electron and on the packaged app folder (341 MB, the game 63 MB of it). The Windows run is CI's.

**Not checked:** a real Windows PC, which waits for the owner's machine. Steam, the overlay and cloud saves come in the third package.

### The Windows playtest follow-up ([#65](https://github.com/obeidpeter/Imperium/pull/65), [notes](docs/windows-playtest-followup.md))

The owner's changes after the 3 November playtest in Chrome on Windows:

- **Battlefield messages have a rank.** Your own actions and refusals always show on the bar. Game news replaces what is there only if it ranks as high, or once its time is up: a casualty or a broken squad ranks above routine blows, and victory or defeat above everything. What is held back is kept under **Earlier** and in the battle log.
- **The battlefield notice floats over the world.** A lower-ranked notice never replaces a higher one, and its time stops while you are paused or reading it.
- **New campaign battles open paused**, so you can review the objective and give orders before **Resume**. Drills, rescues (which already did), extractions and deployments keep their own openings.
- **Camps name the next required step:** the commander's table, then the oath in Chapter I, then a missing preparation, then the way out. The strip, the **Objective** marker and the map (**M**) show it. The map numbers the places, each with **Walk there** (any time) and **Fast travel** (after a visit), and offers **Show me the way**.
- **Follow, Overview and Cutaway** are buttons over the world. Cutaway starts on and now also works in Overview, keeping your soldier, the figure you inspect and the objective in view clear of walls and roofs.
- **Softer ground.** Ground types blend at cell edges, and the aprons beyond the board fade into the ground. Field councils get furnishings, side galleries and worn stone floors.
- **The bar.**
  - Squad cards show strength and the current or queued order.
  - **All actions** lists the objective first and has a search box; in the Curia, talking comes first.
  - Council speeches say what they do to the count, and delegates read "Bloc · Supports / Undecided / Against".
  - Hold objectives count the seconds still needed, and the advice for retrying starts open.
  - A blow's wind-up reads in the whole figure.
- **The inventory's soldier no longer goes blank** on the first comparison. On wide screens the comparison sits beside the pack.
- **New Game folds its optional choices away.**
- **Performance.** Dynamic resolution steps back up once frames have room. The Settings performance check no longer changes the saved quality.
- **For contributors:** `npm run smoke:navigation`, run in CI's usability job, and new layout checks in `smoke:polish`.

After it, the owner chose two changes, and four small fixes followed:

- **Show me the way stops at the way out.** At the last step it walks your soldier to the way out and stops beside its post, and you use it when you are ready. Before, it marched straight into the next battle.
- **The camp's strip says which preparation is missing**, for example "Choose an operational stratagem before battle →", instead of "Review departure preparations →" with the reason only in its tooltip. It still opens the camp list.
- **Fix: a message on the bar is not listed again under Earlier** when news held back behind it came after it.
- **Accessibility:**
  - **All actions**' **Use** buttons are named "Use: …" with the action, so the word on them is in their name, for voice control.
  - The bar's guidance line no longer carries a label that a screen reader could read instead of its text.
- **For contributors:** `SMOKE_CPU_THROTTLE` now slows `smoke:navigation` too, and that check now walks to the way out and checks it is not used.

### Polish after Gate 4

- **The way out of camp is marked once you can march.** When nothing keeps you in camp (the chapter's decision made and every needed preparation in hand), its way out is marked like a battle's objective: a ring at the waymarker and its name. You often arrive with it behind you, out of sight; its name then waits at the edge of the view with an arrow pointing to it, in 3D and 2D. A line says so when it becomes ready while you are in camp. **Settings → Display → Objective markers** turns it off with the battle's markers.
- **Fix: the 3D view no longer goes blank for a moment after a pause.** Setting the 3D view's size clears it until the next frame is drawn, and it was being set in two cases: on every update of the page, even at the same size, and whenever the bar's event line came or went. Pausing writes "Paused." there, and at some widths the bar grows a line taller while it shows, so the world shrinks by a few pixels and grows back. The view now draws itself again at once whenever its size is set, and the page's updates set it only when its size or pixel ratio changed. Under software rendering the blank lasted seconds; on a device it would be at most a frame, though no device has been checked.
- **The world keeps its size when a message comes or goes.** At the owner's request after Gate 4, the bar's event line, where "Paused.", a blow or a refusal is said, keeps its one line of room while it has nothing to say. Before, each message made the bar a line taller and the world that much shorter until it cleared: 6.6 pixels at desktop sizes, 19.8 on a phone, and twice that for a long message on a phone. A message too long for the line now ends in an ellipsis; pointing at it shows the whole, and screen readers read it all. The cost is that one line: with **Compact interface** on, the world is 6.6 pixels shorter at desktop sizes and 19.8 at 580 pixels wide and on a phone. With it off, desktop sizes lose nothing, because the bar was already taller than its lines.
- **The camp's offline and artwork notices no longer push the world down.** At the owner's request, "This chapter is ready offline", the download's progress and the artwork notice sit on the camp's strip at the top, beside **Chronicle saved**, instead of a band under it. The band came a few seconds after a camp opened and took 41 pixels from the world. On a short line they give way first, ending in an ellipsis, with the whole of it in their tooltip; screen readers still hear them.
- **Fix: the game's own messages show on the full-screen pages.** A message from the page itself, such as the gate sentry's refusal at a camp's way out, "Saving… use the way out again in a moment", an errand that cannot be tracked or what is still on a walked field, was placed under the site header, which the full-screen camp, field and chamber no longer have. With no window open it was only read out to screen readers. It now shows on the bar's event line for as long as it used to stay, and floats over the page where no world is open yet.
- **The 2D view's names no longer overlap.** They are placed as the 3D view places its labels: by priority, clear of one another and of the soldier you control, a name moved from its place keeping a faint line to it, and the least important giving way when there is no room. A lasting mark over a name, such as a camp figure's news, keeps its room with it, so no other name covers it. The camp's way out joins them, waiting at the view's edge with its arrow while it is out of sight.
- **One wording for the offline notice:** "✓ This chapter is ready offline" or "✓ All chapters available offline", then any download under way, wherever it shows. It had switched between those words and "✓ CHAPTER II AVAILABLE OFFLINE" depending on what last updated it.
- **A message cut short can be read whole.** On the bar's event line a long message ends in an ellipsis; **More** at its end, or a tap on the line, opens the whole of it over the world, and it stays until you close it or another message comes.
- **Choosing a target by keyboard no longer shifts the world.** The target's line takes the message line's place in the bar, with its cue beside it where the bar has room, and **Target details** opens the whole forecast over the world, led by the cue, instead of adding lines to the bar. Before, those lines made the world 66 to 105 pixels shorter while a target was chosen, and 130 to 193 with the details open. On a narrow screen the summary has the line to itself and the cue is read in the details.
- **Fix: holding U in the chamber keeps the rivals' plans in view.** An update of the page, such as a save finishing, could replace them on the message line with what the pointer showed, while U was still held. They now stay until U is let go, and a new hour's plans replace them if the hour turns. Let go, the line says again what the pointer or the chosen member shows.
- **Fix: the keys work wherever you click outside a control.** A click on the strip's text or the bar's put the focus on the page around the world, and every key went unheard until the world was clicked again: **P** did not pause, **U** showed nothing and the arrows did not walk. From there the keys are now the world's, as from the world itself; **Tab** still moves the focus.
- **Esc closes what is open on the bar first:** a message opened whole with **More**, then **Target details**, before it clears the target or opens the Menu. Before, with the details open, it cleared the target and left them open.
- **U lets go when you switch away.** Switching to another window or tab while **U** was held left every label, a battle's intentions and the chamber's plans on screen until **U** was pressed again, because the key's release never reached the game.
- **"Chronicle restored" moves onto the bar.** A message given while a full-screen page's world is still opening, such as the one after a restore, floated over the camp for up to six seconds and caught the clicks under it. Once the world opens it now finishes its time on the bar's event line, and a floating message never catches a click.
- **The 2D view's passing numbers cross no name.** A blow's number, "Blocked", "Miss" or a heal is placed with the names, after them, so it never covers one and never moves one; so is a mark over a figure with no name, such as an enemy's notice.
- **A message cut short waits while you read it.** At the owner's request, a message on the bar's event line that ends in an ellipsis stays while the pointer rests on it or on **More**, or while **More** has the focus, instead of going after its few seconds (6.5 for the game's own messages, 2.6 for the rest). Once you let go it stays a moment more, 1.5 seconds, as after closing it whole. A finger's tap still opens it whole. A message that fits its line goes in its time as before.
- **Messages that went by can be read again.** The bar's event line keeps its last messages. Opened with **More**, or with a click or tap on the line once it is empty (**Enter** on it from the keyboard), it lists the last five under **Earlier**, newest first, a message said again straight after listed once with how many times. While it is open, a new message joins it at the top instead of closing it. **Paused** and **Resumed** are not kept, as the Pause button shows them.
- **A longer message stays longer.** A message's time on the bar grows with its length, about a second and 45 milliseconds a character: never less than its usual time (2.6 seconds, or 6.5 for the game's own) and at most 8 seconds. A 70-character message, about twelve words, now stays about 4 seconds instead of 2.6.
- **For contributors: the browser checks no longer race short messages.** `watchEventLine` (`scripts/ui-smoke-navigation.mjs`) records every text the bar's event line shows, so a check cannot miss a message that a slow frame outlasts. The checks that read a 2.6-second message now use it: Chapter V's courtyard refusal, the horizon message in `smoke:polish` and the layout check, the chamber's documented case, the cavalry check's feedback and the camp sentry's words; the twelve camps already recorded the line their own way. `smoke:polish`'s **Paused.** check records the line, its tooltip and the world's height as they change. `SMOKE_CPU_THROTTLE=4` runs any browser check with the page's CPU slowed fourfold through the DevTools protocol, about as slow as a busy CI runner. Run that way once, the checks found one more race: the field-after-a-victory check read the card naming the next area after it had gone, as the card shows for about two seconds whatever the page is doing. `watchAreaCards` now records each card's words as it is added, there and in the camp way-out check.
- **CI: the twelve camps' halves stay split at Chapter VII.** A split at Chapter VIII was tried, after one run in which half b took 27.5 minutes against half a's 17. It made half a the slow one, at 35 and 33 minutes in its two runs, against 27–28 at most for either half split at VII. The logs showed both halves' camps taking about the same time each, so the 17 minutes had come from a fast runner, and the split went back. Every check runs as before.

### Worlds and gameplay, release 14, second part: the field after a victory ([plan](docs/worlds-and-gameplay-plan.md), [report](docs/walking-release14-report.md#second-part-the-field-after-a-victory))

- **Walk the field.** After a won real-time battle the result offers **Walk the field** beside **Continue**, first while one of the fallen or a found chest still holds something. The field stays open and peaceful: the enemy still standing have gone, weapons stay sheathed, nothing fights and no clock runs against you. A strip above the field says what to do, with **Result** to see the result again and **Continue**.
- **Search where they fell.** Click one of the fallen or a chest to search it in the inventory, as in the fight. A chest still locked shows its two ways in: **Use the key** once you have taken its key here, or **Force the lock** if you are strong enough. A key that left with an enemy who lived opens nothing, and a cache nobody found in the fight stays hidden. What you take is kept with the result, as before.
- **The road to camp** stands where you entered the field, a waypost like the camps'. Taking it records the result, as **Continue** does. The first time, if anything worth taking is still on the field, it says what and nothing changes; take it again to leave anyway. After a chapter's last battle it leads on to the promotion. In Practice, **The road back** returns you to your chronicle. A defeat keeps **Retry**, and the drill yard has nothing to search, so the drill is recorded as before.
- **Only what you take is saved.** The walked field is built from the recorded fight each time. A reload shows the result, and **Walk the field** opens the field again with everything you took.
- **Smaller changes.** The walked field keeps the victory's music, even when your soldier is badly hurt, and the fight's lessons are over.
- **Fix: the battle result's text is readable.** Since 23 October a real-time battle's result had pale text on its light panel; it is now dark.
- **For contributors.** `core/realtime/aftermath.js` builds the walking world from the chronicle's resolved fight and copies the chronicle's searches back into it (`syncAftermath`); `fieldUnsearched` names what is left. The world is peaceful (refusals say **The fight is over: weapons stay sheathed…**) and calm: no enemy, squad, band, field-round or objective system runs, so it never ends. Its takes and locks are the chronicle's (`takeSpoils`, `openFieldContainer`, `takeFromContainer`); the world refuses its own, the fight's works and kit changes. New checks: `tests/aftermath.test.mjs`, `tests/aftermath-page.test.mjs` and the browser check `fieldAftermath`.

### Worlds and gameplay, release 13, second part: item pictures ([plan](docs/worlds-and-gameplay-plan.md), [report](docs/inventory-release13-report.md#second-part-the-item-pictures))

- **Every piece has a picture.** The inventory shows a picture of each piece, rendered from a generated model in one look: in the pack at its shape, in the worn places, on the ground, and in chests, the fallen's belongings and the traders' goods. There are 35 pictures for 105 pieces, as finer pieces of one kind share their kind's picture.
- **Fine pieces show their finish.** Tinned pieces are paler, gilded ones warmer and bright steel a little brighter.
- **Three quest objects keep their drawn outline:** the medicine box, the gate brace and the bronze bowl.
- **A small download.** The pictures are one image of about 115 KB, in every chapter's offline pack. Nothing new is drawn in 3D.
- **For contributors.** `node scripts/assets/item-atlas.mjs` checks every item against `art-source/items/item-pictures.json`, packs the rendered masters into `assets/items/item-atlas.webp`, writes `src/data/item-pictures.js` and records the atlas in the asset manifest; `--render` renders masters from their models first. Each model's render settings live in its request. `render-item-pictures.py` gains `--across` and `--drop-stand`. The 39 models used 780 of the pictures' 1,000 credits ([ledger](art-source/models/item-pictures-credits.json)).

### CI: the browser smoke test in two halves

- **The browser smoke test runs in two halves side by side.** Its job took about 33 minutes and the usability job 40 of its 45, so a pull request waited about 40 minutes for CI. `SMOKE_GROUP=a` or `b` runs one half: `scripts/browser-smoke.mjs` names group a, and group b is every other scenario, so a new scenario always runs in one of them. Group a also runs the paused-order checks, and group b the real-time and cavalry controls. Each half should take about 18 minutes.
- **The 3D siege and rain review has its own job,** so the usability job should take about 23 minutes of its 45. No check was removed or loosened.

### Worlds and gameplay, release 14, first part: leaving camp on foot ([plan](docs/worlds-and-gameplay-plan.md), [report](docs/walking-release14-report.md))

- **A way out of every camp.** Each camp now has a waymarker pointing where the next encounter lies: **The road out** beyond the gate to a battle, **The drill yard** for Chapter I's drill, **The river gate** for Chapter V's second battle, and **The principia door** to a Contest (**The Curia door** in Chapters XI and XII). Walk to it, click it, or choose it under **All actions** (*Take: The road out. On to the broken causeway.*).
- **The sentry says what is missing.** If something is still needed before you can leave (the chapter's decision, a preparation, an approach you cannot afford), the gate sentry says so and nothing changes. While a save is being written, the way out asks you to use it again in a moment.
- **A card names where you are going** while the next place is built. It takes no clicks or focus; with reduced motion it appears and goes without fading.
- **The other ways still work.** Talking to the gate or the sentry, and **March out** in **Menu → Camp**, leave the same way, through the same departure rules.
- **Drawn** in 3D as a post with a board pointing the way and a red pennant, from the scenery's own materials (no new shader program), and as a signpost in the 2D view.
- **Fix: a fight's result kept through a save.** A battle that ended while the page was writing a save was not recorded until the page was reloaded; it is now recorded as soon as that save is done.
- **For contributors.** `campExitFor` (`camp-world.js`) derives the way out from the chronicle; it is never saved, and a camp's `exits` data can place it. An object may name its own verb in the hover line and **All actions**. New checks: `tests/camp-exits.test.mjs` and the browser check `campExitDeparture`.

### Fix: a chamber whose 3D view fails

- **The conversation stays open.** When the 3D view fails in a chamber (its graphics context is lost), the page goes on in the 2D view as before, and the conversation you had open now stays open. **Escape** closes it, as it would have, instead of opening the Menu, where the chamber's keys do nothing. Found by a browser check in continuous integration; a new check (`chamberViewFallback`) loses the 3D context with a conversation open.

### Worlds and gameplay, release 13, first part: the inventory ([plan](docs/worlds-and-gameplay-plan.md), [report](docs/inventory-release13-report.md))

- **A full-screen inventory.** **Kit** (I) opens one screen over the world: your soldier in the middle with the fifteen places he wears kit beside him, two to a row so a place's layers sit together; your pack as the real 10 × 6 grid, each piece lying in its own shape; what you left here on the ground below it; and his character sheet beside them, with his attributes, training points, combat numbers and honours. In a Contest chapter the hearing's documents stand above the sheet.
- **Drag and drop.** Press a piece and move it to lift it. The worn places it fits light up and the others dim; the pack shows where it would lie, green, or red where it does not fit. Drop it on your soldier or on its place to wear it (a charm takes the charm place it is dropped on), within the pack to move it, out of a worn place into a chosen cell or onto the ground. A piece lands where its picture is. A drop that cannot be done says why, for example **The Galea is worn as a helmet**, and changes nothing. The right button, or a finger held still, shows a piece's details and what it would change.
- **By keyboard.** The arrow keys move between the pack's pieces; **Move in pack** lifts the chosen one, the arrows move it a place at a time with each place read out, **Enter** puts it down and **Escape** puts it back without closing the screen.
- **The same screen for chests, the fallen and trade.** The armourer, the quartermaster and the sutler show their goods and prices beside your pack: drag a piece into the pack to buy it there, or **Buy**; drag a piece of yours onto them, or **Sell**. A camp chest shows its lock or its contents, a fallen man or a battlefield cache what he or it still holds: drag a piece into the pack, **Take** it, or **Take all**. In a narrower window the pack and the other side stand together, with your soldier below.
- **On a phone, or at 200% text,** the inventory shows one section at a time behind tabs, as lists you scroll with a finger.
- **Smaller changes.** A piece he cannot use yet says what it needs where its name would be. The inventory's messages appear in a line under the pack's heading, refusals in red. Choosing a piece or changing kit no longer reloads the soldier's 3D figure; it only changes when what he wears does. A chest's pieces were all drawn with the same outline; each now has its kind's.
- **For contributors.** The kit commands that bring a piece into the pack (pick up, take off, buy, take from a chest) accept an optional place in the pack, a charm may name its place, a piece can be worn straight from the ground and a worn piece left straight on it; every refusal leaves the chronicle and its random generator unchanged. The browser checks no longer wait without a limit for a dialog to close: main's CI after #48 was stopped by one such wait.
- **Still to come in release 13:** a picture of every piece, rendered from generated models once the owner has approved the pilot's eight.

### Worlds and gameplay, release 12: the full-screen world and the camera ([plan](docs/worlds-and-gameplay-plan.md), reports on [the full-screen world](docs/fullscreen-release12-report.md) and [the camera](docs/camera-release12-report.md))

- **The world fills the window.** In real time the camp, the battlefield and the chamber fill the window, and nothing on the page scrolls. A strip along the top shows the objective, progress, the time, **Pause** and **Menu**. A bar along the bottom holds your portrait and your companions', the message line, the actions, and a button for each panel: **Kit** (I), **Character** (C), **Journal** (J), **Orders** (Q), **Chronicle** (L), **Map** (M), **Company** (R), **Decorations** (A) and **Help**. On a phone they fold into one **Panels** button. In a Contest, one row above the floor counts your support, projects the vote, and holds **Votes & delegates** and **Members**. At 1,280 × 720 the world takes about two-thirds of the window in a battle or a Contest, and three-quarters in camp. The turn-based board keeps its layout.
- **Everything else opens over the world.** Help, tips and the battle log open at the world's top-left corner; **All actions** and order review at its right edge; a fight's result in the middle, and the chamber's members from its new **Members** button. **Esc** closes them.
- **Walk to places.** In camp, the list of services and the March out bar leave the screen: walk to people and places to use them. The list stays under **Menu → Camp**, which takes the place of **How to play** in a camp's Menu (How to play moves under **More**). It opens with the keyboard in it, and **Esc** gives the world the keyboard back. Choosing a person in the list takes your soldier to them.
- **Fixes.** **Shift+M** opens the map in the field, as it did in camp. Conversations and the chronicle now always pause the world, as the Menu does. **Compact interface** now applies in real time: turned off, the strip and the bar are roomier, with larger buttons. A saved key for an action that no longer exists no longer throws away all your custom keys: only that one is dropped, and a key you chose wins over a default that shares it.
- **Frame rate.** The larger canvas draws no more pixels than a 1,920 × 800 view at each quality's own resolution: about 1.5 megapixels on Performance, 3.5 on Balanced and 6.1 on High.
- **Switching the view during a session.** Changing Settings → battle view from 3D to 2D in a real-time camp, field or chamber left the field blank, and switching back to 3D fell back to 2D. The field is now built again around the same world: your soldier, the fight and its clock stand where they were, and a pause you chose holds.
- **The oath's reach, before and after.** In the finale's defection route, the **Rally** button now says, before you swear, whether a rival band is in reach, or how far away the nearest one is; its tooltip names the band. An oath with no band within 23 m says so afterwards, and names the nearest band and how far away it is. The guide now explains the route.
- **One fixed camera.** In real time the camera follows your soldier from one angle, the 2D view's: from the south-east looking north-west, at a true isometric elevation (35°). Up on the screen is north-west on the map in both views, and the arrow keys walk that way. The camera never turns: where scenery stands between it and your soldier, it fades round him instead. The **View** choice and the **,** and **.** turn keys are gone, and a key you had given them is dropped on its own.
- **Look further, then spring back.** Drag with the middle mouse button, or with two fingers on a touch screen, to slide the view over the ground; with **Edge scrolling** on (now in 2D too), rest the pointer at the scene's edge. The view springs back when your soldier moves or you press **F**. A battle-log entry and the **Target** and **Objective** pointers look there the same way.
- **The whole field.** The wheel, **+ / −** or a pinch zoom from close by out to the whole field, and **Z** goes there and back, for squads, deployment and a chamber's floor.
- **Hold H** to glance at the horizon: the view lowers and turns toward the chapter's nearest landmark, and comes back as it was when you let go.
- **X** (3D) fades the walls, roofs and trees between the camera and your soldier in a wide circle round him, until you press it again.
- The turn-based board keeps its cameras.
- **For contributors: what better kit must change.** The owner adopted a new "upgrades count" target on 1 November, in place of one on first-try wins that both reference players saturate. In Chapters I–III and the eleven champion battles, on Veteran, the fully equipped player must end its wins with at least 3 points more health than the issued one and win at least 0.3 rounds sooner; on Story, the issued player must end the champion battles with at least 10 points more health than one who wears nothing. `node scripts/upgrades-check.mjs --label=<label>` checks a release's sweeps. Release 11's meet it: 4.0 points, 0.44 rounds and 17.2 points.

### Worlds and gameplay, release 11: chests, the armourer and the armoury ([plan](docs/worlds-and-gameplay-plan.md), [report](docs/chests-release11-report.md))

The first of four releases that bring treasure chests, a blacksmith and the navigation of the classic isometric role-playing games to Imperium, in its own Roman style.

- **Chests in every camp.** Three or four in each, 37 in all: a spare-kit chest at the stores, your own locker, an old armoury chest, a strongbox, a coffer, a cache under the stones. Each opens once, and what you take is yours. Some are locked: the key is in another container of the same camp, or a strong enough soldier forces the lock. A hidden cache shows itself when you walk close, from farther with more Perception.
- **Containers on the battlefields.** One or two on 17 battles: an officer's strongbox, a raider's cache, abandoned baggage, a ferryman's chest. Open one during the fight with your weapon sheathed, or after a victory from **Search the field**, beside the fallen's spoils. A lock answers to its key, which an enemy, a champion or another container on the field carries, or to five seconds of force. Scout reveals hidden caches. What you take is kept when you continue; **Retry** puts it back, and Practice can look but not take.
- **Bassus the armourer** works at his forge beside the quartermaster in every camp. He sells finer weapons, armour, helmets and shields, a few more each chapter, and buys kit. The quartermaster keeps pay, issued kit and spoils, and the traders their goods and charms.
- **Finer and named kit.** 25 fine pieces, among them a finer *spatha* and gladius, a ring-pommel sword, mail of finer rings, tinned scale, a Niederbieber helmet, an iron-rimmed scutum, a thick winter tunic and a hooded *birrus*. Six named pieces, each with a line of its history, are only found. The [historical notes](docs/historical-research.md) give the evidence for each type.
- **Kit counts against squads.** When a squad's men strike your soldier, his armour turns a share of their blows, and his shield more from the front. The character panel shows both shares under **Against squads**: the recruit's kit turns about a third, the army's mail and scutum about half, finer kit up to 70%.
- **Champions and officers.** In eleven squad battles of Chapters IV–XII, one man of the enemy seeks your soldier out, seen or not: a war band's chieftain, Persian captains, a mercenary captain, an armoured Palmyrene officer, the claimant's guard captain. He fights blow by blow, so your weapon, armour and shield count against him. He carries fine or named kit, or a key. He is the same on every level.
- **Your own ranks make way.** Squads standing in formation step aside for your soldier, his companions and a protected column, so your own men no longer pin you short of an exit.
- **On the stage.** Containers stand in camp and on the field, in 3D and 2D: closed, open with something left, or emptied, with a lock while locked. A hidden cache appears only once found, in both views, and opening a camp chest no longer rebuilds the camp's scenery. The armourer has his anvil, quench tub and weapon rack behind him, and a leather apron, hammer and tongs.
- **Balance.** The enemies are the same on every level. The bot played six reference players over 20 seeds of Chapters I–XII:
  - Story, a soldier who wears and trains nothing: every battle at the first try.
  - Story, issued kit: every battle at the first try.
  - Standard, issued and fully equipped: every battle at the first try.
  - Veteran, issued: 98.5% at the first try.
  - Veteran, fully equipped: 99.8% at the first try.

  Better kit shows in the health a victory costs and how quickly it comes, more than in whether the bot wins (see the report).
- **For contributors:** the kit audit (`node scripts/kit-audit.mjs`, `docs/kit-audit.md`) fixes the coin and kit each chapter can give, as the training-point audit fixes training. The sweep plays reference players (`--kit`) and Chapters I–III (`--first`). `WORLD_VERSION` is 7: a fight saved earlier restarts from its checkpoint, but one won and not yet recorded is kept.

### Camp, character and control follow-up — 31 October ([report](docs/camp-character-followup.md))

- Bridge demolition shows its two-stage progress and announces when the crossing becomes deep water again.
- Squad orders describe the full card, including cavalry's Charge and Feigned retreat. The visible keys and accessibility labels follow remapped shortcuts. Chromium now checks cavalry selection, default/remapped orders and invalid inputs.
- Eleven props recover Chapter VII download space through bounded normal/UV packing, preserving their textures, triangle positions, materials and placement. Existing download limits remain unchanged.
- Severianus's generated body is included in Chapter XII's offline download, with coverage for the legal patron-support route.
- Aelia gains restrained expressions on her own generated face, preserving her neutral appearance, hair and earrings.

### Worlds and gameplay, release 8: the five camp figures ([plan](docs/worlds-and-gameplay-plan.md), [report](docs/camps-release8-report.md#the-five-figures-30-october))

The last of release 8's living camps: the named people it brought into the camps now wear their own generated bodies and faces, as the rest of the cast has since release 6.

- **Severianus, Paullus and Theon** stand in their own dress: the patron in a rich tunic edged with purple, the senator in his toga, the rhetor in his tunic and dark mantle. Each has his own face on the shared head, so he blinks and speaks as the named soldiers do, and none of them wears the soldiers' neckcloth.
- **Signifer Quintus** wears his mail in the camps of Chapters I, IV and XII.
- **Aelia** keeps her own generated head, with her hair pinned back and her earrings, as Syra and the camp's other women do. She does not blink or change expression.
- **Downloads.** The four men's maps are a level below the earlier cast's, as they stand only in camps: Chapter VII, the largest download, grows from 23.21 to 23.94 MB, within its 24 MB limit.
- **Offline,** Severianus in Chapter XII's court keeps the procedural figure, as XII's pack leaves his body out; online he wears it there too.

### Worlds and gameplay, release 10: Gate 4 and 0.40.0 ([plan](docs/worlds-and-gameplay-plan.md), [play-through checklist](docs/gate4-playthrough.md))

The last of ten releases, in progress: Practice in real time, and the checklist for the owner's Gate 4 play-through. Real time becomes the default, and 0.40.0 is released, after that play-through.

- **Practice in real time.** **Practice your completed encounters** (in Camp services, or at the drill field's practice post) now plays as your campaign plays. When the campaign is in real time:
  - a battle opens on the live field, under the Archive's banner with its War-Room Mutators: the difficulty, the weather, the hour and, in Chapter XII, the approach;
  - a Contest from Chapter VII on is walked in the chamber, where only the difficulty changes;
  - its result offers **Practise again** and **Return to chronicle**, and records nothing: no training points, spoils, consequences or a patron's re-run.
  - On the turn-based board, practice is as before.
- **Practice is never saved.** Quick save (F2) and the Saves menu now refuse while you practise, on the board as in real time, where they used to write a copy of the practice that could not be loaded. The top bar reads **Not saved**, and Export still copies your chronicle.
- **The practice banner fits a phone:** on a narrow screen its mutators and **Return to chronicle** sit below its title.
- **The standalone skirmish** is already the real-time arena when the campaign plays in real time; it needed no change.

### Worlds and gameplay, release 9: landmarks and set pieces ([plan](docs/worlds-and-gameplay-plan.md), [report](docs/landmarks-release9-report.md))

The ninth of ten releases: the great buildings of the story, built in Blender, and each chapter's landmarks and camp life, generated with Tripo.

- **The Curia in marble.** The Senate's Contests of Chapters XI and XII take place in the Curia, the Senate house as Domitian restored it ([historical note](docs/historical-research.md)), built in Blender around the chamber floor:
  - the senators' benches on three wide, low steps along each side;
  - walls with a revetted dado of veined marbles, niches framed by columns, and arched windows with bronze grilles high in the end walls;
  - the bronze doors standing open;
  - the presiding magistrates' tribunal, with two curule chairs, at the board's north edge;
  - the gilded Victory on her globe above her altar, between two bronze lampstands.
  - A wall stands aside while the camera is beyond it, and no wall shades the floor.
  - The clerks' tables stand beside the tribunal; the fountain and, in Chapter XII, the army's eagle stand outside the doors.
  - On Performance, or if it cannot be downloaded, the code-built hall stands in its place.
  - Its 0.68 MB file (0.35 MB gzipped, as the build report counts downloads) is in the packs of Chapters XI and XII only.
- **Aurelian's walls before the finale.** Beyond the east edge of the last battle's field stand Rome's new walls, begun in 271 and still rising ([historical note](docs/historical-research.md)), built in Blender:
  - brick-faced stretches 3.5 metres thick, with a wall walk, parapet and merlons;
  - stretches still building, at three heights, behind scaffolds and ladders, with new bricks stacked at their foot;
  - a square tower about every thirty metres;
  - the double gateway faced in travertine between two semicircular brick towers, where the regional gate arch stood.
  - The walls take the code-built curtain's line and pattern, and keep clear of the claimant's cohorts drawn up before them.
  - On Performance, or if they cannot be downloaded, the code-built curtain stands in their place.
  - Their 0.43 MB file (0.31 MB gzipped) is in Chapter XII's pack only.
- **The oath and the accession in story beats.** The 3D ceremonies no longer circle slowly round their tableaux. The camera frames their moments in turn, holding each for five or six seconds before moving to the next ([`ceremony.js`](src/showcase/ceremony.js)):
  - at the oath on the Novae parade ground: the recruits drawn up, the view over their shoulders to Varro and the standard, Varro holding out the words, the recruits reciting, and your own soldier;
  - at the accession: the legions before the tribunal, the herald, the Senate's witness, the acclamation, and the new Augustus.
  - With reduced motion the camera keeps the first view. If you turn or zoom the view yourself, it stays where you put it.
- **Life about the field** ([`environment-life.js`](src/showcase/environment-life.js)), on Balanced and High:
  - birds wheel high beyond the board by day, though not in rain or dust storms;
  - smoke rises and drifts with the wind from the hearths of barracks, forges, field kitchens and the fish smokers' racks;
  - every banner's cloth stirs in the wind at its own pace, no longer only the fort's standard.
  - Birds and smoke share one mesh and one shader program, placed from the encounter's presentation seed and the layout data (`LIFE_LAYOUT`). None of it is on Performance, and reduced motion holds it still.
- **Each chapter's own landmarks on its horizon** ([`horizon-landmarks.js`](src/showcase/horizon-landmarks.js), [historical note](docs/historical-research.md)). Three landmarks stand at the middle distance of every chapter, in place of the watchtowers, temples and aqueducts that stood in every region before:
  - Chapters I–IV, on the Danube: the stone gate of Novae, a signal tower, a Thracian burial mound, a reed hut on piles, the piers of an old bridge without its deck, a harbour quay, a road station, a small temple and a burned farmstead;
  - Chapter V: a citadel on the river cliff, a ruined watchtower and a tower tomb of the necropolis;
  - Chapter VI: a mudbrick caravan station, a Syrian temple court and chamber tombs cut in the hillside;
  - Chapter VII: the bridge over the Adda, the walls of Mediolanum and a tall tomb beside the road;
  - Chapter VIII: a frontier fort's stone gate, river warehouses and a ruined Dacian sanctuary;
  - Chapter IX: a tetrapylon with its colonnades, a sanctuary in its walled court and the city gate;
  - Chapter X: a villa, the province's basilica and an aqueduct;
  - Chapter XI: the Colosseum, the Pantheon and the Arch of Septimius Severus;
  - Chapter XII: the Mausoleum of Hadrian, Aurelian's Temple of the Sun and the Milvian Bridge.
  - Where a horizon has its river (Chapters II and VIII), the old bridge's piers stand across it and the quays on its near bank, facing the water. The bridges over the Adda and the Tiber, whose horizons have no river, each have a stream beneath them.
  - They are drawn as code-built outlines in the horizon's distant batch, which the woods and the city's rooftops keep clear of.
  - On Balanced and High, 32 of the 33 are generated models (Tripo, processed in Blender), which stand in their outlines' places: scaled to the outline's height, turned to the board (or, for a quay, to the water), set on the lowest ground under their own extent, and taking a share of the haze at their distance as the hills round them do. Each is drawn from its colour map alone, as its relief would be smaller than a pixel there.
  - The Colosseum keeps its outline: Tripo made it only as a fragment of its outer wall, as today's ruin and as a cutaway, never whole as it stood in 275.
  - On Performance, or if a model cannot be downloaded, the outline stands. The models add 5.2 MB to the campaign (4.9 MB gzipped, as the build report counts downloads), 0.4–0.5 MB gzipped to each chapter's pack.
- **Life about the camps and towns.** On Balanced and High, 14 generated props are set out with the baggage beyond the board, two to five in each chapter but V, each where its region would have it: washing on a line, a woodpile, a grindstone, a bread oven, a handcart of stores, wicker beehives, a haystack, an ox cart, a warp-weighted loom, a caravan's saddles and baggage, racks of amphorae, a covered carriage, a market stall of fruit and bread, and a potter's red-slip wares ([historical note](docs/historical-research.md)).
  - They stand outdoors only, never round a council's board or in the Senate, and never on a camp's service pad.
  - On Performance, or if one cannot be downloaded, its place stays empty.
  - They add 3.1 MB to the campaign (3.0 MB gzipped), up to 1.2 MB gzipped to a chapter's pack.
- **The camera stays out of Aurelian's walls.** Before the finale, turning the Horizon view (or another low view) toward the walls used to take the camera into them, as it already did with the code-built curtain. Now it comes in to their face and looks out over the field.

### Worlds and gameplay, release 8: living camps ([plan](docs/worlds-and-gameplay-plan.md), [report](docs/camps-release8-report.md))

The eighth of ten releases: every chapter's camp is a place of its own, with the story's people in it, errands that pay in training, a trader, and replies that depend on who your soldier is. The battles are unchanged.

- **A camp of its own in every chapter.** Chapters IV–XII each have their own layout, with their own gate, courts, tent lines and water, and the seven places in their own arrangement. The fort above the Danube ford opens a postern on the reeds; the halt on the retreat west is a broken mudbrick enclosure entered from the western road; the camp before Milan opens east toward the city; the ferry assembly lies open to the river; the governor's courtyard has planted strips between its rooms; the house in Rome is built round a garden court.
- **The cast in camp.**
  - **Varro** teaches at the Danube fort and stands by the eagle until his fate is decided in Chapter VI.
  - **Crispus** writes the fort's report, leaves for Rome after the council at Milan and is waiting for you there.
  - **Quintus**, who held the standards at your oath, teaches at the fort and gathers the legions' standards in the last camp.
  - **Brennus** counts the raiders' rafts at the fort.
  - **Severianus** keeps his ledger from the retreat to the purple, though in the last camp only while he backs you: otherwise his messenger or the treasury's envoy stands there.
  - **Aelia Dacia** keeps her households' names at the ferry, in the province and before the final march.
  - **Paullus** reads your record in Rome and visits the last camp before the legitimacy Contest.
  - **Theon** teaches speaking before the council, the tribunal and the Senate.
  - Lucan or Sabinus, Naso and Felix stand with the company, and a man still recovering waits at the valetudinarium.
- **Errands with training points.** Chapters IV–XII have two errands each, worth 2 training points each:
  - Chapter IV: braces for the gate, and the raiders' rafts to count;
  - Chapter V: a bowl of water on the paving, and a letter downriver;
  - Chapter VI: water to the west, and leather for the eagle's pole;
  - Chapter VII: boots for the march, and the order of a speech;
  - Chapter VIII: the depth at the landing, and a seed jar;
  - Chapter IX: the wing's recall signal, and a city's granaries;
  - Chapter X: the diverted grain, and a frightened witness;
  - Chapter XI: your first report, and a question in writing;
  - Chapter XII: the seal at the standards, and seed for next spring.

  Some ask for the right answer; a wrong one costs nothing. The most training a campaign can give rises from 237 to 273 points ([audit](docs/tp-audit.md)), and a chronicle begun before 0.40 that now chooses its soldier's training receives the larger total for the chapters it has completed.
- **The five titles nobody could earn** are each an errand's reward: **Shield of the cohort** (+1 Constitution), **Pathfinder** (+1 Agility), **Advocate of the ranks** (+1 Eloquence), **River scout** (+1 Fieldcraft) and **Scribe of the council** (+1 Authority).
- **A trader in every chapter**, with the region's goods:
  - smoked fish on the Danube;
  - dates and leather in the East;
  - oil and fish sauce in Italy;
  - honey in Dacia;
  - incense, and an eye amulet against envy (+1 Perception), in Syria;
  - papyrus in Rome;
  - seed grain before the last march.

  Syra the sutler follows the legion to the Danube fort and to the end.
- **Replies that depend on who your soldier is.** Every camp from Chapter IV has replies that need an attribute, a decoration, a title, or the army's or the public's confidence. They are listed dimmed with what they need. Where an errand needs persuading, there is always another way.
- **A page of history for every defeat.** Every encounter now has one. A lost Contest and a battle lost on the turn-based board show it in their result too, as a lost real-time battle already did.
- **Named people without a generated body of their own** (Severianus, Aelia, Paullus, Theon and Quintus) are drawn with their own faces, never in a stranger's body.
- **The camp's women are drawn as women.** Syra wears her own body. The traders Vibia, Dida and Caecilia and Licinia the witness are drawn as the procedural woman, never in the civilian traveller's body. The woman's figure now comes with every chapter's download, not only from Chapter VIII, so Syra is drawn as a woman even when her body fails to load.

### Worlds and gameplay, release 7: missions and cavalry ([plan](docs/worlds-and-gameplay-plan.md), [report](docs/missions-release7-report.md))

The seventh of ten releases: six battles become missions of their own, the enemy brings siege works, and your horse has two orders of its own. Campaigns begun before this release keep the battles they started with; New Game plays the new ones, in real time and in turns.

- **Six new missions.** Chapter IV's gate is an **escalade**: throw down the Goths' two ladders, whose climbers hold the wall walk, then bring the rear files out. Chapter V's wall is a **sortie**: out by the postern to burn the Persians' ram as it batters the river gate, then back to hold the gate. Chapter VI's wells are a **rearguard** with fallback lines while the column walks west on its own. Chapter VIII's crossing is taken **under fire**, the far bank's archers striking the group of yours most exposed in the water or on the landing at each round's end, until the enemy's archers are beaten. Chapter IX's wing is a **feigned retreat**: the armoured horse keep their ground, for three rounds at most, until drawn onto the line at the marker. Chapter X's road is a **relief convoy** by the road chosen in camp, the grain wagons walking it on their own. Battles that open with an escort or a hold fall from ten of eighteen to six.
- **Siege works.** While a ladder or the ram stands, the defended line loses the battle's pressure at each round's end, and the ram batters the river gate 30 a round until it is a breach. Hold a work's ground with no enemy beside it to destroy it, or beat a ladder's climbers.
- **The horse's orders.** With a squad of horse selected, the command card's **8** gives **Charge** (at the nearest enemy group, wheeling away first for the run-up a charge needs) and **9** gives **Feigned retreat** (ride at the enemy's horse, then away as if routed; those who give chase are strung out when it turns, and it charges them). Both are in the Command list too.
- **Each mission's own opportunities**, in place of its chapter's: the sortie's postern and fire pots, the rearguard's water skins and cleared road, a footbridge upstream of the crossing, and more.
- **A crossing deploys on its own bank:** the first two tiles in Chapter VIII, three on Chapter X's road.
- **The mission strip names each mission's task:** the ladders or the ram still standing and what they cost the line, the horse to draw onto the marker, the line to hold while the column withdraws, and a convoy halted by an enemy near it. When the siege works break the line, the defeat says so. Chapter V's Persian siege ramp, worked as before, now offers **Disable the siege ramp**, so it is not taken for the ram.
- **A cheaper simulation.** Squads' movement and sight, route searches and the check on whether a man is out of combat take less computing. Every battle plays exactly as before.
- **Real-time fights saved before this release** restart from their checkpoint when the chronicle loads, as Retry would.

### Worlds and gameplay, release 6: the cast in person ([plan](docs/worlds-and-gameplay-plan.md), [report](docs/cast-release6-report.md))

The sixth of ten releases: the named men, the chamber's members, the camp's staff and the horses in generated bodies, each faction's own shields and a moving finale crowd. The rules are unchanged.

- **The named men in person.** Lucan, Varro, Sabinus, Naso, Felix, Brennus and Crispus each wear a generated body of their own and their own face, made from their own generated head, which keeps the game's blinks and expressions. They wear them wherever they appear in 3D: Lucan in every chapter, Varro until Chapter VI, Sabinus from Chapter II, Naso and Felix with the company, and Brennus and the tribune Crispus in Chapter III. Lucan, Sabinus, Naso and Felix wear mail over the long-sleeved tunics of the mid-third century, Varro an instructor's brown wool, Brennus a scout's wool, and Crispus a tribune's white tunic with purple bands. Aelia, Severianus, Paullus, Theon and Quintus keep their sculpted faces until release 8.
- **A name draws only its own person.** "Lucan's squad", "Felix's archers" and "Crispus's advocate" no longer wear Lucan's, Felix's or Crispus's face, and a named leader's followers no longer wear his. Varro no longer wears a sling and limps in every camp from Chapter I: only those the story wounds are drawn wounded.
- **The chamber's members** wear plain white togas, as three different senators. A member's bloc still shows twice, never by colour alone: by its trim, in its colour and shape, across his toga's folded band from the left shoulder, and by the letter on his stance marker. You and the named keep the drawn toga.
- **The camp's staff look their part:** the clerks and quartermasters, the capsarius and the orderlies, and Syra the sutler, now a woman. They no longer carry a traveller's bundle.
- **Horses.** Roman riders ride a bay, Gothic riders a dun, and the Persian and Palmyrene heavy cavalry a grey under a trapper of iron scales, its tail short. Roman cavalrymen wear a body of their own. A horse walks, trots, canters and now gallops as its speed over the ground calls for, its hooves planted as before. A horse whose model does not load keeps the drawn horse.
- **Shields by faction.** Each faction paints its shields from its own designs: Roman wreaths, rosettes, rings, rays and wings; Gothic boards in two colours, halved, quartered, banded or rimmed; Persian wicker under raw hide; Palmyrene rosettes and rings. A unit and its followers share one design.
- **The finale's massed legions move.** They stand watch, heads turning, and about one man in six now and then raises his spear to cheer.
- **Downloads.** The new bodies and horses add 8.6 MB to the complete download (43.0 MB) and 2.4–5.8 MB to each chapter's pack in 3D, which holds only the bodies and horses its own figures wear (Chapter I in 3D: 13.6 MB; the largest chapter, VII with its 2D art: 21.3 MB, within its 24).

### Worlds and gameplay, release 5: nature and water, modelled ([plan](docs/worlds-and-gameplay-plan.md), [report](docs/nature-release5-report.md))

The fifth of ten releases: the regions' trees, stones and ground cover on Balanced and High, and their water on every quality. Performance keeps the drawn trees, stones and grass, and the rules are unchanged.

- **Trees, modelled.** Every tree the world plants is a model from its region's kit, built in Blender: oak, beech, willow, alder, pine and fir on the Danube and in the Balkans; poplar, cypress, umbrella pine and olive in Italy; date palm and tamarisk in the east. Each has a near, a middle and a distant version, sways in the same wind as the grass, and keeps to the room its plan left clear of the cameras and the board. The bark is photographed (CC0, Poly Haven), and the leaves are cards composed from photographed CC0 plant textures, with the game's own oak, willow and palm foliage.
- **Stones, modelled.** The field's boulders, outcrops, slabs and river stones are twelve generated rocks, four for each region, each fitted to the ground the old drawn stone covered.
- **Ground cover round the view.** Grass grows thicker where you look, with flowers, low scrub, reeds by the water and, in the Danube provinces and Italy, rows of grain beyond the field. On the board it stays short and sparse, so its cells read as before.
- **Water.** Marshes show their depth, muddy at the rim and dark in the pools, with scum at the edge instead of stripes; the distant river foams along its banks; and the ground beside the board's water is wet. On Balanced and High, mist lies over water at dawn, at night and in rain or mist.
- **A failed download is not asked for again.** When a kit of trees, stones or fortifications cannot be downloaded, the camp or battle keeps its drawn ones without requesting the kit a second time or reporting an error.
- **Downloads.** The six kits add 2.46 MB to the complete download and 0.62–1.04 MB to each chapter's pack in 3D, which holds only its own region's (Chapter I in 3D: 11.16 MB; the largest chapter, VIII with its 2D art: 15.82 MB; the complete campaign: 34.40 MB).

### After release 4: the mudbrick re-baked

- **Mudbrick walls without the blotches.** The mudbrick kit of Chapters V, VI and IX no longer shows large pale patches of plaster that read as camouflage up close: a few soft patches remain, near the bricks' own colour, and the joints read a shade darker. The three chapters' packs are 13 KB smaller.

### Worlds and gameplay, release 4: fortifications, modelled ([plan](docs/worlds-and-gameplay-plan.md), [report](docs/fortifications-release4-report.md))

The fourth of ten releases: the real-time battles' structures, modelled, with rules of their own. The 0.38 turns are unchanged.

- **Fortifications, modelled.** On Balanced and High, the real-time battles' walls, towers and their stairs, gates (open, closed, barred and battered), breaches, bridges (repaired, damaged and demolished) and rampart breastworks are models from a new board kit, built in Blender in stone, mudbrick or timber to fit the board's 2.5-metre cells, with a simpler version for distant pieces. On Performance, or when the kit cannot be downloaded, the code-built works stand in. The code-built curtains, drawn as low breastworks before, also stand at full height: 3.2 metres, or 2.5 in timber.
- **Structures placed by each battle's history.** Chapter IV's gateway has a tower on each side of the gap and a ditch before its walls, which the road crosses on a causeway. Chapter V's fortress has towers flanking the gap in its wall, Chapter VIII's crossing a bridgehead rampart behind its ditch, and Palmyra and Rome two towers each, a weakened stretch of wall and gates the enemy holds barred. Fields whose history gives no tower have none: the fighting platform is no longer added beside every fortified wall.
- **Towers.** From the deck a man sees 15 metres farther, and his javelins and arrows reach three tenths farther (a fifth from other high ground). The tower's masonry stops missiles shot past it from below.
- **Gates.** Closing a fortified gate bars it for your side, at 120 integrity. A gate barred against you cannot be opened: each work action batters it for 15, or 30 with a friendly engineer detail within eight metres as the ram, and at 0 it becomes a breach, slower rubble open to both armies.
- **Ramparts and ditches.** A rampart is a 1.2-metre bank with a breastwork, behind a ditch that halves speed and breaks a charge. A man on it holds higher ground; missiles from beyond its face lose 10, and a squad behind it takes 2 less in each exchange.
- **Demolish a bridge.** **Shift**+click a repaired bridge on a fortified field: two work actions, one with engineers near you, each twice as long as ordinary work. The crossing becomes deep water for both armies.
- **Forecasts name the structure:** From the tower, He holds the tower, Behind the tower, Behind the wall, He holds the rampart, Behind the rampart.
- **Rain slows climbing in real time.** The guide's rule now applies there too: the real-time map had dropped the weather's slope cost.
- **Fewer shaders to prepare.** Generated models share one shader program, and code-built props, fieldwork, plain figure surfaces and the fallen share their neighbours', with the same look. On Balanced the fortified real-time battles need 9–13 fewer programs (the finale 50 instead of 63), and the turn-based stages 8–11 fewer. Distant figures now darken under passing cloud, as near ones always did.
- **Saves.** Real-time fights record world version 5. One saved by an earlier version restarts from its checkpoint when the chronicle loads, as Retry checkpoint would.
- **Downloads.** The three kits add 0.96 MB, and each chapter's pack holds only its own (about a third of a megabyte).

### Fixes after the campaign world upgrade

- **Earned siege support no longer adds defence.** Only the camp's Engineering approach gives your squads its 10 extra defence, at its usual cost. Support earned in the previous siege still lets each work action finish the job at once. Before, the two shared one flag, so the support also gave the defence for free.
- **Enemy plans vary again.** Strong evidence still decides the enemy's plan: a braced line, a wavering squad, a blocked or open flank. When its reasons are mild, it may also choose a plan within one point of the best, the best still the likelier, so the same field can open differently. Each plan still holds for at least two rounds.
- **Each battle's tactic is shown again.** Once the optional exercises are done or skipped, each later battle with a company opens with a short tactic tip until your first order, as before the player experience polish.
- **The guide** now says that enemy horse also move faster on firm ground.
- **Development:** the calibration bot plays each Contest the first way that wins. It reads the debate ahead on a copy of the chronicle, protecting its coalition first and then using the record policy. When neither wins, it accepts the patron-backed re-run the game offers after a lost Contest, at its usual cost. With the protection alone it lost Veteran's Chapter VII council on every seed. A test now plays two Veteran campaigns past that council. The bot only.

### Player experience polish ([#33](https://github.com/obeidpeter/Imperium/pull/33); [notes](docs/player-experience-polish.md))

- **Choose how to play.** New Game offers Real-time with pause or Turn-based. Real time is recommended when this device has no saved preference; a saved preference stays selected. In camp, Settings → Controls changes the mode for the next encounter. An encounter keeps its controls, and loading a chronicle never changes them.
- **Optional exercises** for deployment, squad orders, engineering and political commitments. They advance only on the real action and never require a debt. Their progress is a preference on this device, apart from the chronicle. Settings → Readability → Replay optional exercises restores them.
- **A quieter camp.** The next mission and any departure requirement appear once above the world, and narrow screens repeat fewer headers.
- **Three optional camp situations, in Chapters V, VIII and XI.** You find the evidence at marked desks and match it; a wrong answer explains itself and changes nothing. Finishing one changes the camp. They grant no reward, never block departure, and follow Lucan's and Sabinus's fates.
- **Character motion:**
  - full-body starts, stops and turns, with planted feet;
  - a wounded gait;
  - distinct horse gaits, with riders moving with the horse;
  - varied hairlines across the cast.
- **Scenery:** trees kept clear of the main camera views, a different arrangement around each regional camp, and paving and foundations that blend into the ground.
- **Sound:**
  - a percussion pulse that follows the live battle's pressure;
  - horn signals when your squads receive orders;
  - more varied impacts on metal, wood and cloth.
- **Fixes:**
  - a dialog's late close event could clear a conversation that had just opened;
  - a reply that finished saving late could replace a newer panel;
  - battle audio could follow a fight replaced by a restore.

### Campaign world upgrade

- Larger camp, battle and chamber views with shared camera controls and optional records below the world.
- Functional fortified gates, breach routes, accessible fighting towers and Chapter V countermining/sortie work. Structures share navigation, line-of-sight and rendered heights; work survives a save.
- A consistent generated hero head across ranks, distinct named faces, injured/morale performances, coordinated cavalry gait, economical generated finale crowds and personal oath/accession staging.
- Regional vegetation, camera-local rain/dust/mist/embers, shared wind, flowing water highlights, flame and smoke, and contextual environmental/weapon audio.
- Observed-condition enemy plans, mission-specific pressure, friendly engineer details and mounted cavalry in later chapters.
- Operations change later routes and logistics. Field reports distinguish intact engineering success, unfinished works and company withdrawals. Service evidence affects representatives; reconnaissance and honoured military agreements can prevent final reserves from arriving.
- Nine optional company stories across IV–XII, each with two previewed choices, a returning report and later acknowledgement.
- Real-time world version 4: older active real-time fights restart from their unchanged departure checkpoint when loaded. Earlier chronicles and turn-based compatibility fixtures remain supported.

See [delivery and verification](docs/campaign-world-upgrade.md) for scope, evidence and remaining physical-device qualification.

The conversion to real time with pause, following the real-time build brief (supplied separately, not stored here) and the [0.40 player guide](docs/player-guide-0.40.md). Real time is opt-in through the development settings until Gate 4; the 0.38 turns stay the default and play by their own rules, and every earlier save still loads exactly as saved. The original phase reports retain their validation limits; the later Windows assessment and improvements are recorded separately below. Physical phone and first-time player checks remain open.

### Worlds and gameplay, release 3: harder, less predictable battles ([plan](docs/worlds-and-gameplay-plan.md), [report](docs/realtime-release3-report.md))

Follow-up fixes:

- A war band that breaks from being outnumbered at a round's end no longer rallies from rest in that same round. Only arriving reinforcements can rally a broken band.
- The asset-tool setup supports native Windows Python environments and launchers, npm and the encoder's Release executable, and writes a PowerShell environment script. Unix setup keeps its shell environment script; paths are passed as literal arguments.
- The stage benchmark includes textures supplied through custom shader uniforms, including the ground's shared texture arrays and per-scene blend map, without counting shared resources twice. Earlier recorded memory figures omit those textures and are not comparable to the corrected totals; render targets, shadow maps and compositor buffers remain outside the estimate.

The third of ten releases: the real-time battles' enemies, variety and difficulty. The 0.38 turns are unchanged.

- **The enemy chooses a plan.** Within its chapter's doctrine, a battle's enemy draws its plan from the simulation's own random stream for its decisions: hold you in front, turn your left or your right, close on both flanks, feint to draw a squad out, or commit its reserve early or hold it back (those two only at the start). It keeps a plan for at least two rounds; the battle log names each change and the field intelligence panel shows it. Each faction favours its own: the Goths hold and feint, the Persians flank and feint, the Palmyrenes turn the flanks, and the claimant's men hold and use their reserves. Each band also leans toward its own target (the enemy's focus, the nearest of your men, your archers or your soldier), and the focus weighs a squad that stands alone or wavers.
- **Raiders break and run.** In Chapters I–III the raiders who fight alone are one war band with one morale, led by its war leader, the hardiest of them. Each man who falls costs it heart, more from ambush and more again for the leader; a round ended outnumbered two to one costs it too, while a round out of the fight and reinforcements restore some. A wavering band shows an amber ring at each man's feet and, after Chapter I, its blows take 1 less; a broken one shows the crimson ring and runs for its own edge of the field. A man who escapes is gone for the objective but earns no training points.
- **Squads see, and can be ambushed.** From Chapter IV every squad, yours and the enemy's, keeps a notice meter on each enemy man and squad, by the same perception rules as a single man. A squad that reaches another that has not seen it strikes a whole exchange at once, with twice the blow to morale, and brace and shield wall do not help. Your soldier's first blow on a man of a squad that has not noticed him is an ambush too, so Quiet feet, Ambush craft and the Explorator path count in every battle. A new order, **Lie in wait** (Command card 7, one point), keeps a squad low and half as easy to see until it falls on the first enemy squad within six metres. From Chapter IV, on Standard (half the time) and Veteran (three times in four), a band of raiders may lie in wait near its place, holding its javelins, unless the battle begins with a column to bring out; Scout or a squad that notices it reveals it, and it rises and joins the attack once one of yours nears the objective, or at the end of round 2. Auto-pause can stop when one of your squads is ambushed.
- **Smarter enemies.** A raider strikes the most dangerous man near him: one attacking him or his fellows, a badly wounded fighter, or one pressing his band's archer. Persian, Palmyrene and the claimant's archers loose one aimed volley a round; Persian and Roman bands brace once they have held their ground; a wavering band pulls back behind a steady one to recover; and foot near their archers turn on the squad that presses them.
- **No two battles alike.** When a battle begins, its weather is drawn from its chapter's season (the chapter's own most often; Chapter II's marsh is always in fog), the supply cart, signal station, barricade and brazier take one of the nearest open places to their usual ones, reinforcements come on at their tile or beside it, Chapter III's hidden man lies within two tiles of his, and each enemy band gets a temperament: steady, bold (more heart, slower to notice) or wary (less heart, quicker to notice). Squad exchanges vary by up to a quarter either way, averaging what the forecast says. Every draw comes from the simulation's named streams, so the same campaign seed gives the same battle and **Retry checkpoint** restores it exactly; presentation draws nothing.
- **A real Veteran, and a longer finale.** On Veteran, battle deadlines are two rounds shorter (never under four; the drill keeps its own) and, from Chapter IV, reinforcements arrive at full strength, besides arriving a round earlier as before. No enemy is hardier or hits harder. In the finale's battle (the backer and battle routes) the claimant holds two cohorts of his reserve back; they march on at the end of rounds 4 and 7, two rounds later on Story, and the field is not won until they are beaten.
- **Saves.** Real-time fights now record world version 3, and the new state is checked strictly when a save loads. A fight saved by an earlier version restarts from its checkpoint when the chronicle loads, as Retry checkpoint would; nothing earned before it is lost.
- **Calibrated by sweeps** ([report](docs/realtime-release3-report.md); evidence for [Story](docs/evidence/realtime-release3-sweep-story.json), [Standard](docs/evidence/realtime-release3-sweep-standard.json) and [Veteran](docs/evidence/realtime-release3-sweep-veteran.json)). A scripted bot played the campaign from New Game by legal commands on 20 seeds a level: every battle of Chapters IV–XII with either decision, and every finale route. It won all of them at the first try on every level, saw 5–6 different enemy plans in each battle, and, as the level rose, lost more of its squads and won with fewer rounds to spare (on Veteran, Chapter X's road once on its last round). The finale's battle now lasts 10 rounds on Story and 8 on Standard and Veteran, against 4–5 before. In Chapters I–III, Veteran needed a second try in 4 of 120 battles, all in Chapter II. On the same seeds as main, the simulation's tick rose by at most 0.17 ms at p95 (Node.js on the development container, not a phone). The sweeps found and fixed: Chapter II lost in clear air (it keeps its fog), raiders drawn to a column's wounded, the claimant's reserve entering behind a closed gate, Veteran's finale ending in seven rounds, hidden bands that sat out a battle or left a column alone, and a fault in the bot itself (an owed order given again before it could arrive). The bot plays a retried battle more carefully, as a player would; the plan's targets for Chapters IV–XII were met without a retry.
- **The guide and help** describe the plans, the war band, squad sight and ambushes, Lie in wait, temperaments, the varied fields and weather, Veteran's deadlines, the claimant's reserve and older saved fights.
- **CI's twelve-camp check gives each action 120 s**, as its screenshots already had. In software rendering a panel action in Chapter XII's camp takes 10–30 s on main and on this release alike, against the old 30 s limit.
- **Not yet checked:** a person playing the new battles, and any phone or laptop.

### Worlds and gameplay, release 2: ground, sky and light ([plan](docs/worlds-and-gameplay-plan.md))

The second of ten releases: every 3D scene's ground, light, shadows and horizon.

- **Ground that shows the board's own cells.** Eleven photographed CC0 layers from Poly Haven (grass, dry grass, soil, mud, sand, gravel, rock, paving, flagstones, arid soil and cracked earth) are blended by a weight map built from each cell, so sand looks like sand and a camp like trodden earth. Roads are gravel and soil on the frontier and paved in Italy and at Palmyra, steep banks show bare soil and stone, and wear and wet ground follow the river and the fort's yard. Where two layers meet, the higher surface shows, and no tile repeats in view. Each region has its own mix and tint: the Danube's meadows, the flooded marsh, Italy, the arid east and Palmyra. The set is 1.9 MB, shared by every chapter; until it loads, each layer is its plain mean colour ([the ground](docs/asset-pipeline.md#the-ground)).
- **Each chapter keeps its hour.** At dawn (Chapters II and VIII) and dusk (V, VI and XII) the sun stands low in the east or west, warmer and weaker, and shadows run long. Chapter II's grey dawn stands a little higher. The sky glows on the sun's side, its clouds are lit from the sun, and the night stratagem has stars and a moon. Low mist lies over the ground by the weather and the hour, none indoors.
- **Shadows across the whole field.** The scenery's shadows on the ground are now baked once per scene at the sun's angle, so they reach across the board at any zoom and the long dawn and dusk shadows reach their full length; near the camera the live shadow map still casts the figures and the scenery as before. At Performance, where trees cast no live shadow, they now shade the ground. The generated buildings and props now take the drifting cloud shadows too, and the soft contact shading where they stand on the board.
- **Each region's skyline.** Nine original landscapes, rendered in Blender, stand beyond the ridges: the Danube's woods (Chapters I, IV and VIII), the marshes after Abritus (II), the road station's hills (III), the Euphrates with its buttes and the Persian siege camp (V and VI), the Po plain under the Alps (VII), Palmyra and its oasis (IX), the harvest of Dacia Aureliana (X), Rome within its walls (XI) and the Campagna with its aqueducts (XII). Far ranges rise out of the haze, which thickens in dust, mist and rain and at night. The ridges around the board now settle lower toward the horizon so the skyline shows, and woods of low crowns cover them in the Danube, Balkan, marsh and Italian chapters. A chapter's pack carries only its own skyline, and only the current and the previous region's stay loaded; until it loads, and in council chambers, the code-painted backdrop stands in ([the horizon](docs/asset-pipeline.md#the-horizon)).
- **Cheaper distance.** The distant river's waves move in its shader instead of on the processor every frame, on every quality. The ground keeps its cost down: from about 60 m (fully by 110 m) each layer takes one sample and no fine relief; nearer, a layer samples both of its copies only where they blend, layers under 3% of the blend are skipped, only layers carrying a quarter of it add relief, and texture filtering takes four samples at grazing angles rather than eight.
- **Downloads** stay within their limits: 0.82 MB first load, 9.99 MB for Chapter I in 3D (was 7.68), 14.82 MB for the largest chapter with its 2D art, Chapter V (was 12.59), and 31.33 MB for the whole campaign (was 26.60) ([budgets](docs/asset-pipeline.md#budgets)).
- **Measured** in software rendering on the production build, the baseline's 24 runs again ([results](docs/performance.md#release-2-ground-sky-and-light), [evidence](docs/evidence/stage-benchmark-release2.json)): programs and draw calls the same or one fewer (the road's overlay is now part of the ground), triangles from 15,289 fewer to 8,410 more, Chapter XII on Performance now within the plan's 400,000 (385,065), and no shader compiled by the first frame or in play. The longest task while building, behind the veil, rose to 101–153 ms (74–141 before). Every count is below release 1's CI ceilings, which are unchanged. Nothing here was measured on a phone or laptop.
- **CI's software-rendered checks allow for the slower frames.** None of CI's browsers has a GPU, and there a frame over the photographed ground takes about twice as long as before. The twelve-camp and Chapter V checks now wait up to 120 s for a screenshot, as the campaign benchmark already did. The campaign benchmark allows 4 minutes a scene (8 for Chapter V), 120 s an action and 45 minutes in all. The twelve-camp and benchmark jobs may run 55 and 60 minutes. No check was removed or loosened beyond its time.
- **Deviations from the plan.** A colour lookup table for each chapter is deferred: each chapter keeps its existing colour grade. There is still one shadow cascade, with the baked shadows covering the field beyond it, and generated models are not yet part of the baked shadows; the live map keeps casting them near the camera on Balanced and High.

### Worlds and gameplay, release 1: foundations ([plan](docs/worlds-and-gameplay-plan.md))

The first of ten releases that rebuild the worlds, buildings and battles. Little changes on screen; this release prepares the limits, measurements and data the others need.

- **A quality change in play no longer rebuilds the battle.** After repeated slow rendering, the automatic step down lowers the frame rate, resolution and shadows at once and keeps the scenery, sky, light and figures as they are; they follow the new quality from the next encounter. Rebuilding them in play was itself a long stall. Choosing a quality in Settings, or running the Performance check, still rebuilds at once.
- **The quality comes back.** A step down used to stay, even after a reload, until the player chose again in Settings. Now, after 300 frames in a row within half the frame budget, and at least 600 frames since the last change, the quality steps back up one tier, never above the one chosen in Settings, and says so; one slow frame starts the run again. The settings keep the quality the player chose apart from the one in use, so a later visit starts at the lowered tier and can still return to the choice.
- **New download limits for the plan:** Chapter I in 3D 16 MB (was 12), any one chapter with its 2D art 24 MB (was 14) and the complete campaign 80 MB (was 50). The first load stays at 2 MB. The build still uses 0.81, 7.68, 12.59 (Chapter V) and 26.60 MB ([budgets](docs/asset-pipeline.md#budgets)).
- **A fresh 3D baseline in all twelve chapters**, with the regional scenery ([results](docs/performance.md#the-worlds-and-gameplay-baseline), [evidence](docs/evidence/stage-benchmark-world-baseline.json)). On Performance the battles draw 73–138 calls, 148,766–400,354 triangles and 41–49 shader programs; on Balanced 80–138 calls, 274,523–785,732 triangles and 48–56 programs. The benchmark now also estimates the scene's own texture and geometry memory: 30–58 MB on Performance and 40–75 MB on Balanced. No program was compiled in the first frame or in play, and every battle's figures wore their generated bodies. Against the plan's targets, Chapter XII's confrontation on Performance is 354 triangles over 400,000, and eight chapters on Balanced use more than 50 programs; later releases must bring both down. These are software-rendered counts and times from the development container, not device measurements.
- **CI holds the counts.** `scripts/stage-ceilings.json` records each scene's draw calls and triangles with 10% headroom and its shader programs plus two; CI's stage benchmark fails Chapters V and XII above them. A ceiling rises only on purpose, with `--write-ceilings` in the same commit as the change that needs it.
- **World layouts as data.** Where the regional kits and Chapter V's fortress stand around each board is now data ([`world-layouts.js`](src/ui/world-layouts.js)) instead of code in the two scenery modules; every placement is unchanged. A presentation-only seed from the encounter id, never the campaign's random generator, is ready for scenery that varies between encounters.
- **One command for the asset tools.** `npm run asset:setup` installs Blender's Python module, builds the Basis Universal encoder and installs the glTF-Transform modules and Playwright under `.tools/`, then writes `.tools/env.sh` with the variables the asset scripts read; `--check` only reports. Until now they lived in one development session's scratch space.
- **CI's twelve-camp check has its own job.** It took 13 of the usability job's 28 minutes; the usability job's limit returns to 30 minutes and the new job has 40.
- **Not yet checked:** the quality changes on a phone or laptop. The owner's Settings → Performance check files from a phone and a laptop will tune the tiers before the next releases add content.

### Camps in every chapter and regional worlds ([pilot](docs/chapter-v-world-pilot.md), [rollout](docs/regional-world-building.md))

- **A walkable camp in every chapter.** In real time only Chapters I–III had one; Chapters IV–XII used the menu camp. Chapter V now has a staging courtyard in a fictional Euphrates fortress inspired by Dura-Europos. Chapters IV and VI–XII share one compact court with a veteran instructor (Varro teaches in I–III and V), a duty clerk, a supply orderly, Capsarius Didius, Quartermaster Aper, Lucan or Sabinus as the Chapter II decision left them, a local steward (the petitions clerk from Chapter X) and a gate sentry. Each person opens a service that already existed or describes the place, and the decision, preparation, equipment, company and departure stay available beside the scene without walking.
- **Camps are peaceful.** In every camp, drawing a weapon, attacking, forcing an attack and the war cry are refused before any cost or random draw, so the state is unchanged; only Bind wounds and Carry work. A camp bystander can no longer be struck at a cost in Public Confidence. Each camp sets aside three blocked 5 × 5 m pockets for its props, and tests keep every conversation, service and the gate reachable.
- **Each camp says where you are and what you have done.** Every chapter has a purpose, a short description and its own place names ([`camp-regions.js`](src/data/camp-regions.js)). The local report (in Chapter V, the courtyard report) states the decision and the latest field opportunity or hearing won in the chapter, derived from the save each time and never stored. In 3D, small motifs show the same: paired or sealed tablets, tallies, water vessels, bundles, tools and, from Chapter VII, a letter from Varro or his vine stick. A failed encounter cannot show a completed outcome.
- **Regional worlds around the battles and camps.** Five original Blender kits (60 components, 34,592 triangles, 2.02 MB) join Chapter V's sixteen-piece fortress: Danube military (Chapters I, III and IV), river and wetlands (II, VIII), Italian marching camp (VI, VII), provincial civic (X) and Roman monumental (XI, XII); Chapter IX reuses the fortress with two colonnade bays. They stand outside the rules' board and replace the generic buildings in those chapters. Twenty Tripo props, four for Chapter V and sixteen regional, stand in the camps' pockets and beside the boards; they took 420 of the 1,000 credits approved, leaving a balance of 3,760. Every model keeps a code-built stand-in, which Performance quality uses instead. Willows and reeds, palms, cypresses and grain rows mark the regions.
- **Bounded scenery memory.** Models are shared through leases with an idle cache of at most twelve, so crossing every region does not accumulate them, and a closed scene releases its pending downloads.
- **Camera, horizon and sound.** Follow keeps scenery from hiding the soldier, checking again after two metres of movement or when models arrive, and leaves a view you turned or zoomed alone until you choose Follow again; a critical-hit close-up returns to it. Distant buildings stand on the rendered ground, and the outdoor fog, which the distant silhouettes now share, fades over about 380–780 m instead of 70–170 m, so the hills join the painted horizon. Footsteps follow the distance walked and the ground (paving, soil or water). Walking through a camp adds short synthesized river, wind, workshop or room sounds under Environmental ambience, quieter and muffled at the principia, the valetudinarium and in the chambers.
- **Camp choices wait for saves.** While a save or the camp's setup is pending, the camp's choices and departure are unavailable and marked busy for screen readers, while navigation stays usable. A reply at the gate that marches out waits for its save. Equipment, training and appearance changes refresh the soldier where he stands; unrelated changes, such as his purse, no longer reload the camp.
- **New checks.** CI's usability job adds Chapter V's acceptance (`npm run smoke:ch5-pilot -- --river-gate`, 9 checks) and all twelve camps (`npm run smoke:world`, 21 checks: services, the three cameras, narrow layouts, scenery released between chapters and on Performance, and a camp that works with every model download failing). Its time limit rose from 30 to 45 minutes; on the merge commit the job took 28 minutes, 13 of them for the twelve camps.
- **Downloads** stay within their limits: 0.81 MB first load, 7.68 MB for Chapter I in 3D, 12.59 MB for the largest chapter, Chapter V with its 2D art (limit 14 MB) and 26.60 MB for the whole campaign.
- **Not yet checked:** a phone, listening to the new sounds, and a first-time player. Besides software-rendered checks, one manual check of the Chapter VIII camp ran on a Windows laptop with Intel graphics; it recorded one shader compiled on the first frame, where the software stage benchmark records none, and a harmless Direct3D warning.
- **The guide, help and wording.** The player guide and the in-game Controls & rules describe the camps in every chapter: their peaceful rules, the local report, the services and trainers listed beside the scene, Follow's clearance, the new sounds, Performance's simpler scenery and the waits for saves. A training's own errand comes in Chapter II or III (the guide said II to IV). The refusal in camp reads "Weapons stay sheathed in camp." instead of naming a courtyard in every chapter, and the developer settings and the README no longer say that only Chapters I–III have walkable camps.

### Your soldier's generated body

- **Your soldier wears his generated body in real time and in his 3D previews.** Since 0.37 the bodies dressed the turn-based figures, but the real-time camps and fields and the previews (the kit panel, the camp's character card and the appearance screen) drew your soldier, and any companion not in a legionary's standard mail, in the procedural figure, as a baked body cannot show chosen hair, beard or tunic. Now a soldier in his own kit wears the body closest to it: the recruit's tunic until he puts on mail or scale, then the legionary's, an officer's from Chapter IV and the commander's from Chapter VII; a bowman of his company wears the archer's.
- **What he wears still shows.** His shield, weapons and cloak are drawn as worn, the cloak in the chosen colour. The recruit's body is bare-headed, so his own helmet or arming cap is moved and scaled to fit its head: the brow rim sits above the eyes and no hair shows through, from every side and through walking, running, striking and being hit (a test checks every head vertex above the rim). An armoured body, and the bowman's, brings its own helmet and armour, whichever he wears; the felt cap worn under a helmet is not drawn over it. The body has its own face, hair and tunic, so the appearance screen now offers only the cloak colour, and its preview shows him in a cloak of that colour. A chronicle keeps the hair, beard and tunic it recorded, which the procedural figure still wears if a body cannot load; a new one records cropped hair, no beard and an undyed tunic.
- **Downloads.** The recruit's body joins every chapter's offline pack, as he wears it whenever he is unarmoured; Chapter III's pack adds the archer's for Felix, Chapter XI's the commander's for the kit panel, and Chapter I's the civilian's for its camp. The tests now check the packs against the real-time camps and fields and the kit panel too. Chapter I takes 6.95 MB for the 3D view (0.36 MB more) and the largest chapter with its 2D art 10.85 MB; the complete campaign is unchanged ([budgets](docs/asset-pipeline.md#budgets)).

### Asset foundation

- **3D players download no 2D art.** A chapter's offline pack leaves out the 2D view's unit atlases, action sheets and ground and prop atlases. Chapter I falls from 9.86 to 6.02 MB for 3D players. The 2D view and painted figures add those files to the pack when chosen, and a 3D player's chapter is never reported offline-ready for the 2D view without them. Offline without them, the 2D board draws its own units and props, as it always could. Sculpted 3D figures no longer decode that art, even ahead of the next chapter. The offline worker reports progress only for files it actually fetches, so a mostly cached pack no longer sends hundreds of reports.
- **A world catalog** ([`world-catalog.js`](src/ui/world-catalog.js)) lists each generated prop, landmark, kit piece, texture set and panorama with the chapters that use it. A chapter's offline pack takes exactly its own world files, and the build checks every chapter's group against it; the five Chapter V props are its first entries.
- **The game reads KTX2 textures and meshopt geometry.** The model loader adds three.js's KTX2 loader, the Basis Universal transcoder and the meshopt decoder, vendored unchanged from Three.js 0.186.1. The transcoder runs in a worker file on the page's own origin, as the page refuses `blob:` workers, and the page's security policy adds only `'wasm-unsafe-eval'`, so the decoders can compile WebAssembly. Textures stay compressed on the GPU. A model that cannot be decoded fails whole and keeps its code-built fallback. The decoders add about 0.31 MB to each chapter's download. `npm run asset:compress` makes such models with Basis Universal's encoder and glTF-Transform (development tools, not dependencies) and refuses to write one whose triangles changed; the model checker and preview read them ([compression](docs/asset-pipeline.md#compression)).
- **Every generated body and prop is compressed.** The sixteen bodies and five Chapter V props ship with KTX2 textures and meshopt geometry, every triangle unchanged. Their textures take a quarter to an eighth of the GPU memory they did (a body's maps about 1–2 MB instead of 8.4 MB, computed from the formats) and need no mipmaps built on upload. In exchange the models grow from 6.57 to 7.67 MB in the compressed download, and in close-ups faces are slightly softer and armour highlights a little less even; whole figures look the same in software-rendered comparisons. In the software stage benchmark, battles on a fresh page are ready about 0.14 s later on average, as the transcoder starts, with the same shader programs, draw calls and triangles ([evidence](docs/evidence/stage-benchmark-asset-foundation.json)). No device has been checked. The spoil baskets' byte budget rose from 200 to 250 KB ([figures](docs/asset-pipeline.md#compression)).
- **A CC0 texture intake.** `npm run asset:cc0` fetches a texture set from Poly Haven or ambientCG by id, checks each file against the source's digest or size, and records its page, authors, CC0 licence and every file's SHA-256; a file made from it then joins the asset manifest with that provenance. A Poly Haven set came through live; ambientCG's download host is not reachable from the development container, so that path is tested with fixtures only ([CC0 textures](docs/asset-pipeline.md#cc0-textures)).
- **New download limits for the worlds to come:** Chapter I for the 3D view 12 MB (was 10 MB with the 2D art), any one chapter with its 2D art 14 MB (new), and the complete campaign 50 MB (was 24 MB). The 2 MB first load is unchanged. With the compressed models below, Chapter I takes 6.58 MB, the largest chapter with its 2D art (Chapter VIII) 10.49 MB and the complete campaign 19.90 MB ([budgets](docs/asset-pipeline.md#budgets)).

### The landing page

- **A returning player's chronicle.** The title screen shows the chronicle in progress: the soldier's portrait for his rank, his name, chapter, rank, place and year, and a mark for each of the twelve chapters, with **Continue your chronicle** first. A first visit sees the game at a glance instead: its chapters and encounters (counted from the campaign data), free to play and playable offline.
- **Actual gameplay, larger.** Three captures from the production build replace the v0.8 previews: Chapter V's wall in 3D, Chapter XI's Contest in the Curia and Chapter IV's board in the 2D view. Each was taken at a checkpoint reached by legal commands, with only the name labels hidden ([interface assets](docs/interface-assets.md)). They load as the reader reaches them, outside the first download, which grows by about 4 KB; the complete offline download grows by about 160 KB.
- **The route of the career.** The Imperial Tabula is drawn whole above the five stages of the career and every rank they hold. Its text alternative names each journey.
- **A clearer Tabula, in the Menu too.** Chapter VII has its own theatre in northern Italy; the map had put the army before Milan on the Danube. A journey back bows the other way from the way out, so the return from Abritus no longer hides under the way there. Abritus lies south of the Danube base and the province south-east of it, which clears the crowded Danube theatres. Every numeral stands clear of the routes, and names are haloed where a route or river passes.
- The guide's title screen uses the game's names (**Play now**, **Continue your chronicle**), and the steps to begin mention the readability settings and keyboard play.
- The twelve-chapter benchmark waits for a dialog's close event before sending keys; on a slow runner, keys could reach the Menu button the event focuses, and the remapped-key check timed out.

### In-game usability ([report](docs/usability-overhaul.md))

- Short, grouped menus with a consistent Menu return and Close action; equipment, training, company and honours share local navigation.
- Five settings categories, six initial readability preferences, optional advanced controls, and a searchable help overview before the full guide.
- Common combat actions first, remaining actions on demand with their keyboard shortcuts preserved; compact objectives and visible warnings, optional mission detail, tips and logs.
- Camp prioritizes departure and unmet requirements. Equipment, training, company orders and campaign records reveal supporting detail when requested.
- Loading or replacing a named save requires confirmation; cancelled changes preserve progress.
- Correct high-contrast colors on light and dark surfaces, reliable action-bar focus shortcuts, and clean dialog transitions after conversations or mission orders.
- The player guide, and the in-game help generated from it, name every setting as the game does, under its five categories.

### Windows playtest improvements ([report](docs/realtime-playtest-polish.md))

- Live keyboard target health, distance and current-ability forecasts; Pause works from the command list and HUD; retry clears the previous encounter's messages and input state.
- An unobstructed battlefield with a compact dock, separate mission/deadline/order strip, small pause indicator and conversations beside or below the scene.
- Rescue planning pause, action-matched guidance, endangered-ally alerts and specific failure explanations; contextual squad tactics teaching.
- Rotatable equipped-character previews, item comparisons and exact next-training-point effects; clearer lighting, combat timing cues, target markers, terrain continuity and horizon framing.
- Clearer political movement/speech restrictions, persistent vote projections, delegate medallions, bloc costumes and reactions. Lower High-quality shadow and occlusion costs.
- A dedicated Chromium playtest-regression runner is included in CI, alongside the existing full smoke test. See the report for completed checks and remaining device/player qualification.
- Gate 4's sweeps were run again after the crowd-separation change, which changes outcomes: every battle and finale route is still won on Standard and on Story. The simulation's tick costs more, about 2 ms at p95 in the finale on the development container against 4 ms budgeted for a phone; no phone has been measured ([Phase 4 report](docs/realtime-phase-4-report.md#after-the-report)).
- Crowd separation is about five times cheaper, with identical results. It works on typed copies of the bodies' centres: the same pairs, in the same order, with the same arithmetic. 405 replayed battles keep every position on every tick, and both sweeps keep every outcome. The finale's tick at p95 falls from about 2 ms to 1 ms on the development container, below its level before the four-pass separation.

### Phase 4: the finale and finishing work ([report](docs/realtime-phase-4-report.md))

- **Every chapter in real time.** Chapter X's road and Chapter XII's confrontation play in real time, and Chapter XII's Contest is walked in the chamber. The finale's routes follow 0.38's rules: the oath and the pledges, the envoy under parley and the meeting, and the claimant's standard ([`mission.js`](src/core/realtime/mission.js)).
- **Difficulty.** The difficulty table holds in real time. Time and pace follow it: Story starts at 75% and pauses when an enemy comes into view; Standard and Veteran start at full speed with no auto-pause, until the player changes them.
- **Settings.** Every real-time key can be remapped in Menu → Controls & readability, with the browser's keys refused and a used key swapped. The guide's pointer and readability settings and Time and pace are all in the Menu. In real time the Menu uses the guide's names (Close-ups, Touch hold delay) and keeps Confirm moves with the turn-based board's shortcuts; on the 0.38 board, the settings only real time reads are not shown.
- **Controls & rules from the guide.** The in-game help in real time is the player guide, generated by `npm run guide:help`; its key tables show the player's keys, and it works offline.
- **Migration from 0.38.** An old chronicle loads as saved, is asked once for its soldier's training and appearance, and is granted the training points of its completed chapters. A turn-based battle in progress can restart in real time from its checkpoint. New Game asks for the recruit's training and appearance.
- **The guided opening** teaches the real-time drill, pause and slow time included, the first patrol and the opening chamber hours.
- **The finishing pass.** Saves up to 1 MB; the objective marked in the live 3D scene; the chamber counting hours; the offline packs checked by the build; phone layout fixes; Sound the advance always asking to confirm (one press could start a battle within five seconds of the page loading); a pause chosen just as the Menu closes standing (the Menu's close event, which can come hundreds of milliseconds late, used to resume it); and the field's and the chamber's messages naming the player's keys.
- **Gate 4's automated checks pass:** the bot completes the whole campaign in real time on Standard and on Story, and the sweeps win every battle and route. A person's play-through, the manual accessibility tests and the device measurements are still owed.

### Phase 3: the walk-and-talk Curia ([report](docs/realtime-phase-3-report.md))

- **The chamber.** The Contests of Chapters VII, VIII, X and XI open as chambers over the 0.38 Contest rules ([`chamber.js`](src/core/chamber.js), [`chamber-control.js`](src/showcase/chamber-control.js)).
  - Each hour, each speaker walks inside his reach and gives one speech: from the conversation, the speech bar or a right-click, with its forecast shown first.
  - The hour ends when every standing speaker has spoken, or on Yield.
  - The rivals' hour plays out and can be skipped, and the vote ends in the division.
- **Reading the chamber.** The coalition strip with the Chamber Whip Forecast; **U** for the rivals' next walks; **T**, **Enter** and the Command list for every speech, walk and conversation.
- **The motion and the evidence.** The policy debate and career precedents in the Motion panel. A hearing's documents are in the pack, with a free Inspect; the presiding magistrate receives one, or it is dragged onto the tribunal.
- **The speaker profile.** Eloquence, Authority, decorations and the Rhetor's courses (from Chapter VII) add to the soldier's Resolve, Denounce, Rebut and Invoke Record, never below 0.38's values.
- **Gate 3's automated checks pass.** Test F30 replays the frozen 0.38 routes and generated logs through the chamber state by state. The browser smoke test plays all five chamber Contests through in full and records them.

### Phase 2: squads and Chapters IV–IX ([report](docs/realtime-phase-2-report.md))

- Squads with the 0.38 combat and morale port, Command, orders, formations and specialists.
- Deployment, field objects, weather, cavalry charges, intelligence and auto-pause.
- The battles of Chapters IV–IX in real time, with a 20-seed deadline sweep.

### Phase 1: the soldier and Chapters I–III ([report](docs/realtime-phase-1-report.md))

- The soldier's attributes, training points, trainers, decorations and layered kit, with loot and pay.
- Companions with standing orders, and control switching.
- Chapters I–III in real time with their walkable camps; the Command list, the screen reader's announcements, touch and keyboard paths, and the 2D view.

### Phase 0: the real-time arena ([report](docs/realtime-phase-0-report.md))

- **Survey:** every module mapped to keep, adapt, replace or delete after Gate 4, and the stack recorded exactly ([realtime-survey.md](docs/realtime-survey.md)).
- **Simulation core** ([`src/core/realtime/`](src/core/realtime)): a fixed 20 Hz tick, Commands queued for the next tick with the latest order per actor winning, named random streams split from the campaign's seeded generator, a 0.5 m walkability grid with A* and string pulling, the §3.5 blow (d40 roll, criticals, front-arc shields, absorb and resist, staggers), Strike, Brace and Throw pilum with pure forecasts and reason codes, simple enemy AI, a battle log, and an exact snapshot with a world hash. Every rule is data ([`realtime-rules.js`](src/data/realtime-rules.js)).
- **The arena** ([`showcase/arena.html`](showcase/arena.html)): click to move, walk and run, hold to steer, combat mode, auto-fight, Brace and Throw pilum; forecasts, the message line, cursor states, allegiance rings that show facing, and the battle log; pause, slow time and one round at a time; browser-safe keys bound by physical key, and the scene's browser defaults kept to itself.
- **The `controlsModel` flag**, its per-chapter fallback and a development menu ([`controls-model.js`](src/core/controls-model.js)).
- **Simulation timing** in Settings → Run performance check (report version 2) and the arena's own check.
- **Tests:** A1 (100 replays at 50/75/100% with random pauses), A2 (50 save/load continuations), A3, A4, combat statistics (C13, C17), movement (B6, B8–B10), the shield arc, staggers, abilities, browser-safe input and the Gate 0 auto-fight duels. The browser smoke test plays the arena on the production build.

## 0.38.1 — the rest of smooth play, and clean-ups

Most of what 0.38.0 left open, and a tidier codebase. The rules, the campaign and saves are unchanged. Details and measurements: [performance notes](docs/performance.md).

- **Built in short steps.** The 3D stage and its world are built in steps of about a frame's work behind the "Preparing" veil, so the page keeps answering while a battle is made ([`build-steps.js`](src/showcase/build-steps.js)).
  - The first frame no longer sends the battle's whole geometry to the GPU at once. Preparation draws the meshes a batch at a time through a material that puts every vertex outside the view, so their buffers are made in short tasks.
  - The preloader makes the procedural figure surfaces one kind per task, the painted material tiles one per task, and a skin tone's colour and roughness in separate tasks.
  - A build that a newer battle overtakes is discarded, and its failure no longer tears down the newer battle.
- **Fewer shader programs:** 58–68 per battle became 46–56.
  - The shadow pass takes a caster's colour map only where an alpha test cuts its outline ([`shadow-depth.js`](src/showcase/shadow-depth.js)). The map changed nothing in the shadow but made every textured caster another depth variant.
  - Stone, wood, cloth and the other standing surfaces share one environment finish whose grain and roughness are each material's uniforms.
  - Flat and additive overlays (rings, markers, trails) draw in one pass instead of back faces and front faces with a program each: 6 fewer draw calls per battle.
- **Lighter figures.** A figure's merged surfaces keep their shared vertices: the same triangles, corner for corner, from 38.6% of the data. Chapter XII's twelve figures hold 12.2 MB of geometry instead of 30.0 MB and are built a third faster.
- **The page updates in place** ([`page-update.js`](src/ui/page-update.js)). Each render still produces the page's HTML, but only what changed is applied:
  - the board keeps its focus and listeners, so keys typed straight after an update reach it;
  - the 3D view keeps its canvas, and open panels and typed text stay;
  - a focused command button is never reused for another order;
  - a new screen still starts afresh.
- **Clean-ups.**
  - Text files are stored with LF line endings (`.gitattributes`).
  - The verification reports of 0.2–0.34 moved to [docs/archive](docs/archive/README.md). The player guide says it describes 0.38.
  - 58 test assertions that matched source text are behavioural tests now. The logic they described lives in small modules (board input, board readout, settings), and a small DOM for Node runs the real app module.
  - The 923-line stage class is split into six modules by concern. The longest lines in the shell, the panels and the stage (up to 8,036 characters) are at most 178.
- **Character handoff.** The handoff GLBs are re-exported from the current figure code (21.8 MB instead of 29.1 MB). Their README says what they show: the code-built figure, which the game draws until a figure's generated body arrives or if it fails.
- **Downloads.** The first load grew by 6.5 KB to 501,565 bytes, Chapter I by 15 KB to 9,510,791 bytes, and the complete campaign is 17,952,336 bytes (the new modules, and the split and re-wrapped code).
- **Measured (software rendering, five battles, Performance and Balanced; [0.38.0](docs/evidence/stage-benchmark-v038.json), [0.38.1](docs/evidence/stage-benchmark-v0381.json)).**
  - The longest task while building fell from 0.56–0.96 s to 59–89 ms.
  - Battles were ready (drawn behind the veil) in 3.6–5.0 s instead of 3.8–5.7 s; software times are inflated and vary from run to run.
  - Programs fell from 58–68 to 46–56, none compiled by the first frame or in play, and draw calls by 6 in each battle. No task reached 50 ms after a battle was shown, as in 0.38.0.
- **Still open.**
  - At most 45 programs per battle: 46–56.
  - Draw calls down 30%: down 4–6%.
  - A quality change in Settings still rebuilds the world in one task.
  - One renderer per session and a worker pool.
  - No real device has run 0.38.0 or 0.38.1. **Next:** run Pause → Run performance check on a phone and a laptop and send the saved files.
- **Checks.**
  - New tests cover the page update rules and the board keeping its focus and bindings in the real app; the stepped environment being exactly the one built at once (three chapters); the geometry upload; a superseded build; the shared standing finish, the shadow pass's maps and the one-pass overlays; and the indexed figure surfaces.
  - `npm run smoke` checks that the board is the same, still-focused element after a keyboard walk and an undo.
  - `npm run benchmark:stage -- --check` now also fails on more than 60 programs (it was 90).

## 0.38.0 — smooth play

The first release of the world-building plan: battles open without long freezes and play without any, before richer worlds add to the load. Details, measurements and what is still open: [performance notes](docs/performance.md).

- **Prepared before shown.** Behind the "Preparing" veil, which now counts the figures in, a battle gets everything it will draw:
  - its figures, built once and already wearing their bodies;
  - its ground, stone, timber and foliage images, decoded once per session;
  - its generated scenery, as session masters;
  - every shader program, compiled and linked one variant per short task where the browser cannot compile in parallel, including the shadow pass's own depth variants (warmed for every draw order);
  - its textures, uploaded in short tasks.

  Nothing is compiled, rebuilt or decoded in play.
- **Off the main thread.** Images inside models decode with `createImageBitmap` from the model's own bytes, which the page's security policy allows ([`model-loader.js`](src/showcase/model-loader.js)); the ground images too ([`decoded-images.js`](src/showcase/decoded-images.js)).
- **Fewer program variants.** The camera cutaway, the crowds' bone count and the figures' material finish no longer multiply programs, and lighting a brazier no longer recompiles every lit program.
- **Cheaper frames.**
  - Figures are culled outside the view and the shadow camera.
  - Balanced and High multisample once.
  - A still 60 fps scene draws every other frame.
  - Shadows refresh on a fixed interval per tier.
  - Picking prefilters figures by their upright capsule.
  - Labels skip layout when nothing moved.
  - The ink overlay uploads at most every 50 ms.
  - The road has no fully transparent triangles.
- **Quality per device.**
  - Phones start on Performance.
  - A battle that stays slow at its lowest resolution refreshes shadows half as often, and the next battle is built a tier lower, never this one in play.
  - **Pause → Run performance check** rebuilds the current 3D battle at each quality, turns the camera through three views, shows each quality's frame rates and longest freeze, recommends one and saves the results as JSON. The board takes no commands while it runs, and nothing is sent anywhere ([`performance-check.js`](src/ui/performance-check.js)).
- **Fixes from the survey.**
  - The offline shell carries every module the page imports before it runs, the board readout included ([`module-closure.mjs`](scripts/module-closure.mjs)).
  - Chapters no longer download the pre-0.31 Roman atlas, which nothing draws (178 KB each).
  - The unused palm-frond geometry is gone.
  - Procedural surface tiles are generated once per session.
- **Downloads.** The first load grew by 12 KB to 495,064 bytes (the board readout and the performance check now load with the page). Chapter I fell by 159 KB to 9,495,867 bytes, and the complete campaign is 17,937,412 bytes.
- **Measured (software rendering, five battles, Performance and Balanced; [0.37.0](docs/evidence/stage-benchmark-v037.json), [0.38.0](docs/evidence/stage-benchmark-v038.json)).** The first frame comes 32–51% sooner (6.6–9.2 s became 3.8–5.7 s; software times are inflated). The longest task while building fell from 4.9–6.2 s to 0.56–0.96 s. After a battle is shown (assets arriving, a legal exchange, a camera tour), 0.37.0 compiled 15–19 shader programs and froze for 4.0–12.7 s; 0.38.0 compiles none and no task reaches 50 ms. Programs per battle fell from 76–107 to 58–68, triangles by 0.2–6.1%.
- **Not met.** Three targets from the plan:
  - The stage's synchronous build (above all the environment), the first frame's geometry upload and the preloader's procedural figure surfaces are still single tasks over 200 ms.
  - There are 58–68 shader programs per battle against a target of 45.
  - Draw calls in the overview are unchanged. An earlier reading suggested fewer, but it was taken while the camera eased home.

  One renderer per session, a worker pool and partial page updates are not in this release.
- **Checks.**
  - New tests cover:
    - the sliced compile units and texture collection;
    - session images and scenery masters, and decoding from model bytes with its image-element fallback;
    - the road trimming, the ink throttle and the pick prefilter;
    - the offline shell closure;
    - the performance check, the strain step-down and the phone default.
  - `npm run benchmark:stage -- --check` fails on any program compiled by the first frame or after a battle is shown. CI runs it on the production build for two battles and uploads the report.
  - `npm run smoke` now runs the performance check through the real interface.

  All checks ran with software rendering; no real device or GPU has run this release. **Next:** run Pause → Run performance check on a phone and a laptop and send the saved files.

## 0.37.0 — generated character bodies for every battle figure

- **Sixteen generated character bodies.** Every figure in the battles and both ceremonies now wears a detailed body generated with Tripo from a text prompt and bound in Blender to the game's own skeleton: Roman recruits, their trainer, legionaries, archers, a centurion and a commander; a civilian; and Gothic, Persian and Palmyrene infantry, archers and riders. Each was rigged by Tripo's auto-rig, posed into the game's bind pose with Tripo's weights, folded onto the game's 15 joints, fitted to its proportions and sole plane, welded at its texture seams, and given a near (11,131–11,611 triangles) and an overview level (about 2,500), with a 1,024 px WebP colour map and 512 px normal and roughness maps (418–558 KB each).
- **The game's own animation and kit.** Bodies take the place of the procedural clothes, armour, heads and limbs only. Every clip, gesture, contact and foot plant, the gripping hands, weapons, shields and their heraldry, bows, quivers, scabbards, standards, cloaks, crests and phalerae, and the horses stay the game's own. The protagonist wears a centurion's mail in Chapters IV–VI and a commander's cuirass from Chapter VII; at the accession his cloak takes the emperor's purple. Civic speakers and voters keep their togas, whose trims name their bloc.
- **Loading and fallback** ([`actor-bodies.js`](src/showcase/actor-bodies.js), [`actor-body-catalog.js`](src/ui/actor-body-catalog.js)): one shared master per body, skinned to each figure's own bones; a figure stays procedural until its body arrives, or if it fails. Formation followers march in the generated overview level and fallen bodies keep its colours.
- **Followers carry their leader's visible kit only.** An archer unit's followers no longer hold the sword their leader keeps hidden, nor an unthrown javelin or arrow.
- **Cheaper to draw.** In the Chapter V mine battle the renderer counted about 30% fewer triangles and 17–20% fewer draw calls than with the procedural figures (software rendering; not a frame-time measurement).
- **Downloads.** Each body joins only the chapters whose figures wear it. Chapter I's figures wear five, so its download limit rises from 8 MB to 10 MB (9,654,943 bytes used); the 2 MB first load is unchanged (483,045 bytes), and the complete campaign is 17,918,247 of 24,000,000 bytes.
- **Pipeline:** `npm run asset:tripo -- rig` rigs a generated character; `npm run asset:bind` binds it to the game's skeleton under Blender and quantizes it (`KHR_mesh_quantization`). Each task's own credit charge is recorded, and polling survives a gateway error. The batch cost 720 credits. Prompts, tasks, rigs, digests and licences are in [`art-source/models/requests/`](art-source/models/requests/), [`asset-manifest.json`](docs/asset-manifest.json) and [`art-generation.md`](docs/art-generation.md).
- **Checks.** New tests cover the catalog against the real campaign and ceremonies, each body's records, budget, joints and bind pose, mounting and kit, a strike's deformation, fallback and disposal, followers, fallen bodies and downloads. `npm run smoke` now also waits for the bodies in the production page. The character handoff test no longer depends on the handoff being current. All checks ran with software rendering; no real device or GPU has run this release.

## 0.36.0 — the first Tripo-generated scenery, in Chapter V

- **Five generated props in Chapter V.** Spoil baskets, mine timbers, a mudbrick stack, storage jars and a leather tent stand as a supply camp on open ground off the board's west and south sides, in both Chapter V encounters. They were generated with Tripo from text prompts on the owner's paid account and processed in Blender to 2,900–4,900 triangles, 512 px WebP textures and real-world heights (161–271 KB each). They load at Balanced and High quality only, and only Chapter V downloads them. The rules, the board and its units are unchanged. Presentation only: no rules state and no gameplay randomness.
- **Loader** ([`scenery-models.js`](src/showcase/scenery-models.js)):
  - stands each model on the lowest ground under it;
  - never takes a pick;
  - joins the camera cutaway, so in the horizon, follow and action views a model never hides the selected units;
  - frees all its resources on dispose;
  - leaves out a model that fails to load.

  It decodes embedded textures through image elements, so the page's Content Security Policy (no `blob:` fetches) stays as it is.
- **Placement.** A search of both encounters' built scenes chose ground that is clear of every structure and boulder, in frame and unobstructed for the overview camera, and never drawn over the board. The horizon camera mostly sees them hidden behind the arrival-side buildings.
- **Downloads.** Models in `assets/models/chapters/NN/` belong to that chapter's offline group alone, which `verify-assets` now checks. Chapter I's download is unchanged apart from the new loader's code.
- **Records.** Each model's prompt, Tripo task, model version, raw digest, processing settings and licence are in [`art-source/models/requests/`](art-source/models/requests/), [`asset-manifest.json`](docs/asset-manifest.json) and [`art-generation.md`](docs/art-generation.md).
- **Checks.** New tests cover each model's records, budget and download group, placement off the board from legal Chapter V starts, and the loader. `npm run smoke` now waits for all five models in the production page's 3D view, so a loader fault or a policy error fails it. All checks ran with software rendering; no real device or GPU has run this release.
- **Generated 3D asset pipeline (tooling):**
  - `npm run asset:tripo` creates and fetches Tripo tasks through the environment's network secret;
  - `npm run asset:process` makes a game-ready GLB under Blender;
  - `npm run asset:check` checks it against its budget and the game's loader;
  - `npm run asset:preview` renders a review sheet.

  See [the asset pipeline](docs/asset-pipeline.md).

## 0.35.1 — one battle per approach, a handoff that no longer blocks the tests, and smaller fixes

- **The character handoff no longer blocks `npm test`** ([`check-character-handoff.mjs`](scripts/check-character-handoff.mjs), [`character-handoff.test.mjs`](tests/character-handoff.test.mjs)):
  - The tests still check the committed GLBs as files (hashes, glTF structure, skins, maps and clips), but no longer require them to match the current character code. Before, any change to the character code failed the tests until 29 MB of models were re-exported with Sharp, which the project does not declare.
  - `npm run audit:handoff` reports a stale export; `npm run verify` prints the same notice without failing.
  - `npm run art:handoff` now writes into `art-source/characters/` from any working directory.
- **A field approach covers one field battle** ([`field-approaches.js`](src/core/field-approaches.js)): like the operational preparation, it returns to direct deployment after the encounter, so a costly approach is never charged again without being chosen. The camp table says so, and the [player guide](docs/PLAYING.md#the-command-campaign) now describes the four approaches.
- **Counter blow** ([`battle.js`](src/core/battle.js)): a mounted attacker withdrawn by a braced defender's counter blow now shakes companions within two tiles, as any other loss does. The forecast says when the counter blow would withdraw the attacker.
- **Presentation** (no rules or randomness involved):
  - Fallen figures and spent arrows on a repaired bridge rest on the deck, not on the river bed below it.
  - Changing the figure style keeps each figure until its replacement is ready, as a quality change already did.
  - On busy turns, footstep sounds are thinned evenly across all movers; before, the first movers kept them all and the last went silent.
  - The signal flag is two-sided without turning every bronze and accent piece on the field double-sided.
- **Tests and records:**
  - The approach buttons have Node tests and a browser smoke step: a restored Chapter V camp, the engineering approach chosen through the camp table, and the gate found open.
  - The handoff GLBs are recorded under `developmentAssets` in [`asset-manifest.json`](docs/asset-manifest.json) and in [`art-generation.md`](docs/art-generation.md).
  - The production recording script discloses its one setup command run in Node, and the approach tests label their supply fixtures.

## 0.35.0 — character production and field approaches

- Added tactics edition 35: from Chapter III, a field approach (direct, engineering, diversion or defensive advance) joins the operational preparation, with combined supply costs paid at departure, exact Retry and visible enemy responses. Existing command saves opt in at camp.
- Refined characters: skin pore and roughness response, cloth folds, formed helmets, padded necklines, a shield grip that turns with the board, recovery and recoil clips, and travel timing based on distance.
- Animation snapshots keep the complete encounter, so gates, bridges and veteran details no longer vanish after a command; a quality rebuild keeps each figure until its replacement is mounted.
- Added contextual close-view labels, regional horizon landmarks and a device and frame report.
- Added rigged GLB handoffs of three Chapter V figures in `art-source/` (excluded from the build) and four legal edition-35 campaigns to `npm run verify`.

## 0.34.0 — Chapter V benchmark and campaign-wide production pass

- Replaced the Chapter V generic siege entrance with fractured mudbrick walls, countermining works, rubble and supported repair equipment. Added twelve regional palettes and grounded architectural footings.
- Rebuilt interactive field objects with spoked carts, sacks, bound timber, hinged gate states, damaged/repaired bridges, standards and bowl braziers. Batched materials and quality-dependent detail keep their cost bounded.
- Unified bridge deck height across character feet, selection/picking, movement links, grid and ink overlays; redrape when the committed field state changes.
- Added continuous tunics, cast and career material identities, an original cloth/leather/metal atlas, restrained facial corrective morphs, eleven reproducible joint-animation clips, horse refinements and lighter overview geometry.
- Added edition-34 deployment preparations, side-level enemy doctrines, distinct chapter field opportunities, once-per-round frontal cavalry counterplay and issue-specific political evidence. Exact forecasts and camp opt-in preserve earlier campaigns.
- Added political case inspection before committing a speech, command records, camp practice access, compact battlefield framing, high-contrast settings, configurable touch holds and swappable shortcut bindings.
- Added chapter-specific audio direction and public-state tension mixing while retaining local recordings, mute/gesture behavior, hidden-tab suspension and bounded resources.
- Added character source compilation/auditing, legal campaign variants and a public-interface twelve-chapter browser benchmark. Manual art review, real-device measurements and human playtests remain separate qualification gates.

## 0.33.0 — hold a finger to see the route, and browser smoke tests on every pull request

- **Press and hold on touch screens** ([`touch-hold.js`](src/ui/touch-hold.js), [`app.js`](src/ui/app.js), [`stage.js`](src/showcase/stage.js)):
  - Touch has no hover, so on a phone the route could not be seen before committing to it. Holding a finger still on the board for about half a second now shows what a tap there would do, in 2D and 3D: the readout and, on open ground, the route.
  - Lifting the finger after a hold does nothing; a tap then walks as before.
  - Moving the finger cancels the hold; in 3D it orbits the camera as before.
  - The preview stays after the finger lifts.
  - A long press no longer cancels a pending order through the browser's context menu.
- **Browser smoke tests** ([`browser-smoke.mjs`](scripts/browser-smoke.mjs), `npm run smoke`): the production build is driven in headless Chromium through the real interface. The test fails on any page or console error. It covers:
  - New Game and the Chapter I drill in 2D: keyboard and pointer walks, Undo, Confirm moves, an opponent's preview and Help;
  - a keyboard walk in 3D;
  - a legal Chapter V expanded checkpoint restored through the Restore dialog, with field objects named in the cursor, readout, announcement and ground note;
  - touch at phone width: hold to preview in 2D and 3D, tap to walk.
- **CI**: the smoke test runs on every pull request, with Playwright 1.56.1 installed for that job only. It is not a project dependency, and the game still needs no install step.
- **Wording**: the in-game Help, the player guide and the drill lesson add holding a finger to pointing and the cursor as ways to see the route.
- **Checks**:
  - `npm run verify` passes on Node 20: 698 tests, the standard and four expanded legal-command campaigns to Augustus with unchanged turn counts, the build, the asset and offline checks, and the character audit. `npm test` also passes on Node 22.
  - The smoke test passed four times in a row locally on the production build, in headless Chromium with software rendering. That was after one fix to the test: it now waits for a re-rendered board to be live before clicking, as a player waits for it to be redrawn. A click within the single frame after a re-render is not handled, which only a script is fast enough to hit.
  - Touch was driven by Chrome's touch emulation, not a real phone. There were no real-device or screen-reader checks.

## 0.32.1 — field objects named on the board, a player guide to the expanded campaign, and continuous integration

- **Field objects named wherever a tile is described** ([`tactical-intel.js`](src/ui/tactical-intel.js), [`app.js`](src/ui/app.js), [`encounter-view.js`](src/ui/encounter-view.js)): the board readout, the arrow-key cursor's announcement, the announcement for a click that cannot walk, the named target list and the ground note in the command dock now name any field object on a tile and its state, for example "Side gate (closed)" or "Abandoned supply cart (available)". Previously a gate tile read "Open ground", and carts, signal stations, barricades and braziers were not mentioned. A closed gate's route summary now reads "No passage until opened". On high ground in the rain, the ground note says each step onto it costs one more movement.
- **Player guide** ([PLAYING.md](docs/PLAYING.md)): a new section on the expanded campaign covers field objects and how to use them, cohesion, suppression and weather, coordinated enemies and protected columns, policy debates, and how older chronicles opt in. The controls table lists the field-object and policy buttons.
- **Rules wording**: the expanded campaign rules said rain adds one movement "for climbing high ground". The rule, and the draft's own test, charges each step onto high ground, including from one high tile to the next, and the text now says so.
- **Continuous integration** ([`verify.yml`](.github/workflows/verify.yml)): `npm run verify` runs for every pull request and every push to main, on Node 20 (the oldest supported version) and Node 22.
- **In-game Help** ([`panels.js`](src/ui/panels.js)): **Controls & rules** still described the two-step move from before 0.31. It now covers walking: a first-turn step, the arrow-key and pointer lines, the U key and the Confirm moves setting. It also gains a short section on the expanded campaign.
- **Checks**:
  - `npm run verify` passes on Node 20: 692 tests, the standard and four expanded legal-command campaigns to Augustus with unchanged turn counts, the build, the asset and offline checks, and the character audit. `npm test` also passes on Node 22.
  - A scripted, software-rendered browser run restored a legal Chapter V expanded checkpoint. The cursor, the readout, the ground note and the Move target list all named the cart and the gate. The Help panel was checked at phone width.
  - Chapter I is 7,727,418 of its 8,000,000 bytes.
  - No real-device or screen-reader checks.

## 0.32.0 — interactive battlefields, enduring policies and character refinement

- New UI chronicles use expanded rules; existing games opt in at camp. Saves validate edition, feature state and policy records; previews remain pure and Retry restores the complete transaction.
- Gates, repairable bridges, dismantlable barricades, pitch fire/smoke, chapter landmarks and mutually exclusive cart/signal opportunities appear in both renderers. Selected chapters use 10 × 8 boards; the 2D fit reserves headroom and retains correct picking.
- Weather, cohesion and suppression modify exact attack previews. Visible enemies share tactical focus and roles; protected columns advance with their commander instead of outrunning the screen.
- Three policy motions offer original and amended terms, rival counterproposals, precise delegate forecasts, staged costs and permanent consequences shown in the camp ledger.
- Sculpted kit gains scabbards, straps, fittings, stitch and role details; High cloth gains sheen. A new Roman atlas supplies four painted directions per costume. Additional procedural poses cover block, assent, dissent and yielding.
- Weapon correction targets the committed recipient; shield anticipation and painted attack contact follow the impact clock. Frame reports separate CPU submission, display cadence and GPU observations; reflection refresh responds to measured cost.
- An asset audit distinguishes authored bitmap sequences from procedural responses and checks bundled model budgets. Verification and limitations are recorded in [release-validation-v031.md](docs/archive/release-validation-v031.md).
- **Merged after click to walk (0.31.0)**: the shared route in [`movement.js`](src/core/movement.js), which draws the walk preview and the walking animation in both views, now uses the rules' own field geometry. Routes go around a closed gate, each step onto high ground in the rain costs one more, and hovering a closed gate reads "Closed gate". Across all 25 encounters of a legal expanded campaign, every one of 3,241 legal moves walks a route that costs exactly what the rules charge. This work was prepared and validated as draft 0.31 and renumbered 0.32.0 when merged, so its records and images keep `v031` in their names; the integration checks are in [release-validation-v031.md](docs/archive/release-validation-v031.md#integration-into-0320).

## 0.31.0 — click to walk: one selection moves the unit, far ground walks as far as the turn allows, and the route shows before you commit

The rules are unchanged: a walk is the ordinary legal move command, checked, saved and taken back by Undo Move as before, with no new random-number use and no save format change. Checked with automated tests and scripted runs of the real interface in software rendering (2D and 3D, desktop and phone width); see [movement verification for 0.31](docs/archive/movement-verification-v031.md) for what was and was not checked.

- **Click to walk** ([`direct-controls.js`](src/ui/direct-controls.js), [`app.js`](src/ui/app.js)): with no other action chosen, selecting open ground walks the selected unit there at once, through `Game.act` like any other command. **Undo Move** (`U`) takes it back until the unit acts. Attacks, speeches, orders and every other command still preview first and need a second selection or Confirm.
- **Far ground**: selecting ground beyond this turn's reach walks as far toward it as the rules allow: to the reachable tile that leaves the shortest way on over the ground you can see (ties go to the straighter line, then the cheaper move, then by row and column). If no tile gets closer, nothing moves and the readout and announcement say why: impassable ground, no nearer ground this turn, no route, or movement already spent.
- **The route before you commit** ([`battle-art.js`](src/ui/battle-art.js), [`ink-overlay.js`](src/showcase/ink-overlay.js)): pointing at ground, or moving the board cursor onto it, draws the route: a solid line with footfalls to where the unit stops this turn, a faint dashed line for the rest of the way, and a faint wash over all the ground the unit can reach, in 2D and 3D. The board readout and the screen-reader announcement say the same in words ("Walk here · 1 movement", "Beyond reach · stops at 1B this turn").
- **One route everywhere** ([`movement.js`](src/core/movement.js)): a new read-only rules module gives the cheapest legal route (marsh by its cost, stopping beside enemy melee units as the rules stop it). It replaces the separate route reconstructions in the 2D preview path and the walking animation, so the drawn route, the 2D preview and the 2D and 3D walk trace the same tiles. `Game.moveRoute(state, unitId, point)` exposes the plan; it never changes state or the random-number generator.
- **Confirm moves** (new Pause setting, off by default): brings back preview-then-confirm for moves, now including far ground, where the preview is the tile the unit would stop on. The board hint and the board's accessible name follow the setting, and in-game text says "select" rather than "click" so it fits touch and keyboard play.
- **Fix**: on the 2D board a click could pick the tile next to the one the readout named when the pointer sat within a pixel of a tile edge, because clicks report whole pixels and pointer moves can be fractional. The 2D click now uses the pressed pointer's exact position.
- **Not done in this release**: walking on toward a remembered goal over several turns; real-device, real-mouse, Safari/Firefox and screen-reader checks; and human playtesting, including whether one-click moves lead to accidental walks.

## 0.30.0 — graphics refinement: Senate blocs beyond colour, a graded Performance tier with baked occlusion, living formations and battle remains, lit painted figures, weightier combat, weather on the light and story paintings in 2.5D

Presentation only: no rule, legal command, random-number use or save format changes. Checked with automated tests, software-rendered screenshots (some of injected, presentation-only scenarios, labelled as such) and one scripted run of the real interface; see [graphics verification for 0.30](docs/archive/graphics-verification-v030.md) for what was and was not checked.

- **Senate blocs beyond colour** ([`bloc-style.js`](src/ui/bloc-style.js)): the 2D board and the 3D chamber now share one palette. Landholders are wheat ochre instead of green, so every pair of delegate blocs stays apart under simulated protanopia, deuteranopia and tritanopia. The 3D stance marker leads with the bloc's letter (V, L, C, Ch), and toga trims differ in shape: a broad band (Veterans), a double band (Landholders), a band broken into three lengths (Civic) or a band with a gilt line (Chamber).
- **Performance quality keeps the chapter's look**: without the finishing pass, each chapter's grade (saturation, contrast, split tone) is applied in the tone-mapping step at no extra cost ([`scene-compositor.js`](src/showcase/scene-compositor.js)). Every scene also bakes, once, how much sky each patch of ground sees past its relief and standing scenery ([`environment-baked-occlusion.js`](src/showcase/environment-baked-occlusion.js)), so ground darkens beside walls, tents and rocks on every tier; the bake is lighter where the screen-space pass also runs. AgX and Neutral tone mapping were compared with ACES at High on four chapters: the chapter grades read flatter under AgX and darker and over-saturated under Neutral, so ACES stays.
- **Formations out of unison** ([`formation.js`](src/showcase/formation.js)): followers play the leader's own pose up to 0.36 s late, from four fixed delay banks, so a swing or a step ripples through the rank. Ranks thin when the blow lands, not when the order is given.
- **Battle remains** (new Pause setting, on by default; [`battle-remains.js`](src/showcase/battle-remains.js)): men who leave a formation and defeated units lie where they fell, horse and rider on their side. Spent arrows and javelins stand in the ground near their marks, and feet, hooves and clashes wear the ground. The field keeps the latest 6, 12 or 20 fallen (by quality tier) and 64 shafts; remains are never picked and stay until the encounter ends.
- **Painted (HD-2D) figures lit by the scene** ([`painted-actor.js`](src/showcase/painted-actor.js)): a bevel from the painting's own edges and brush values, wrap lighting, a self-lit share of the painting and one shadow sample just sunward of each figure. Gentle puppetry adds breath and sway at rest (held still with reduced motion), a lean into attacks and a squash when struck.
- **Weight in combat** ([`combat-effects.js`](src/showcase/combat-effects.js)): blade trails, whole-rank volleys from archers and javelin-men in formation, dust under running men and horses on dry ground, a 70 ms held beat when a blow lands (at most 220 ms per motion) and, with the action camera on, a small jolt of the view. None of it plays with reduced motion.
- **Weather on the light** ([`atmosphere.js`](src/showcase/atmosphere.js), [`water-reflection.js`](src/showcase/water-reflection.js)): faint cloud shadows drift over ground, scenery and figures alike on clear, misty and dusty days. At dawn, in mist and in the Senate's halls a few shafts of sunlight slant through the air, with motes turning in them on Balanced and High. On High, board rivers and marsh pools mirror the figures, standards and banks above them; the sky and open water keep their own reflection. Wet ground in the rain no longer shows white highlight discs.
- **Story paintings in 2.5D** ([`scene-parallax.js`](src/ui/scene-parallax.js)): the camp mural and the promotion scene, and the oath and accession paintings when 3D ceremonies are off, drift slowly with depth, near ground against far hills, with weather drawn between the depth planes: rain, rising embers, dust, mist, or motes in the Curia's light. Eight small depth maps (13,790 bytes in total) were estimated offline from the project's own paintings with the MIT-licensed MiDaS v2.1 small model; provenance is in [`art-generation.md`](docs/art-generation.md) and [`asset-manifest.json`](docs/asset-manifest.json). The still painting stays underneath and remains on Performance, with reduced motion, without WebGL and after any failure.
- **Fix**: Chapter IX's promotion painting (the province) is now in Chapter IX's offline group. The promotion view and the chapter group take it from one `promotionScene()` helper.
- **Not done in this release**: an authored, artist-made prop kit (it needs an artist; the code-built props remain), the WebGPU renderer (still deferred), and any measurement on real hardware. Frame time and the GPU cost of the new passes on phones, real-device, real-GPU, Safari/Firefox and screen-reader checks, and human playtesting of the 90–150 minute target are still to do.

## 0.29.0 — graphics overhaul: readable diorama terrain, painted (HD-2D) and ink-and-wash figures, formations, inked tactical ground, chapter colour script and signature moments

Presentation only: no rule, legal command, random-number use or save format changes except the bug fixes listed below. Everything was checked with automated tests and software-rendered screenshots; see [graphics verification for 0.29](docs/archive/graphics-verification-v029.md) for what was and was not checked.

- **Readable diorama terrain**: high ground is a 1.6 m flat-topped plateau ([`environment-layout.js`](src/showcase/environment-layout.js)) whose bank stays inside its own cell; adjoining high cells join, banks show earth and rock outcrops, and plateaus beside paving, roads or water are faced as squared-stone terraces. Rivers sit in a channel under one water surface with depth in its vertex alpha; fords are gravel bars with stepping stones; wall cells join into faced runs (stone, mudbrick or timber); paving is irregular flagstones; marshes carry reed beds; roads gain kerb stones ([`environment-campaign-terrain.js`](src/showcase/environment-campaign-terrain.js)). The ground grid is denser over the board without moving its 80 m edge, and static batching folds repeated parts into matching instance batches so every scene stays inside its draw-object budget.
- **Painted regional backdrop**: a code-painted panorama ([`environment-backdrop.js`](src/showcase/environment-backdrop.js)) with layered ranges and regional landmarks (temples and aqueducts, Palmyrene colonnades, Alpine snow, forest, farmland) stands beyond the modelled ridges. It adds no download.
- **Water**: rivers are a dielectric with a dim sun sheen, fine moving glitter and a capped reflected highlight; open water foams faintly, replacing the white blotches.
- **Figure styles** (Pause → 3D figure style): *Sculpted* (default), *Painted (HD-2D)*, which stands the 2D campaign's own painted unit art in the 3D scene as camera-facing cards with sun-facing silhouette shadows, pixel-accurate picking, the shared animation timeline and diagonal camera views ([`painted-actor.js`](src/showcase/painted-actor.js)), and *Ink and wash*, which adds near-side depth outlines and soft value banding. Painted figures add a depth-aware tilt-shift. Both finishes need Balanced or High quality.
- **Formations** ([`formation.js`](src/showcase/formation.js)): from Chapter IV every military unit except the commander shows its leader and followers in line, shield wall, wedge, archer screen, warband or three riders, and men leave from the rear and flanks as the unit loses strength. Sculpted formations are crowd-rendered from the leader's own skeleton (one draw per surface); painted formations are instanced cards. Followers are capped by quality (3, 5, 8) and are never pickable.
- **Clearer screen**: rank-and-file units show a role glyph and short strength bar; names stay for the commander, company veterans, speakers and other named people, the selection and the figure under the pointer. The chosen action's reach is painted on the ground as an ink wash with a brushed rim, and an inspected or hovered enemy shows its next-turn threat as red hatching ([`ink-overlay.js`](src/showcase/ink-overlay.js)). Text panels for screen readers are unchanged.
- **Senate blocs and stance**: toga trims now distinguish the real blocs (Veterans crimson, Landholders green, Civic blue, Chamber purple; previously only the legacy Army and People blocs were distinguished) and the stance marker carries the same colour. Idle delegates show stance in posture: assent leans in with an open hand, dissent folds its arms.
- **Colour script**: each chapter has its own grade and light balance from Danube dawns to the purple at the accession; scene fog now starts beyond the board; a camera-relative rim light separates figures from the ground.
- **Signature moments** (visual only; reduced motion respected): the finale stands before Aurelian's half-built walls (begun AD 271) with massed legions on both sides ([`environment-finale.js`](src/showcase/environment-finale.js)); after the rules decide a Senate vote, delegates walk to stand behind the champion of the side the rules counted them on (*discessio*), skippable with a click; a short **Action camera** (Pause setting, on by default) closes in on committed attacks; the oath and the accession are staged in 3D over their paintings ([`ceremony.js`](src/showcase/ceremony.js)), still keyed on the one shared `OATH` entry; and the Imperial Tabula is a painted map that inks the career route chapter by chapter ([`campaign-map.js`](src/ui/campaign-map.js)).
- **Rendering quality**: frame pacing on whole display refreshes (30/60 fps tiers instead of 45), CPU-timed adaptive resolution when the GPU timer is unavailable, 4× multisampling under the post-processing on Balanced and High, aerial haze beyond the board, shadow boxes fitted to the view, one hover raycast per frame, lost-context recovery, and fixes for leaked shadow maps, WebGL contexts, reinforcement beacons and fieldworks. The 2D ground no longer tiles in kaleidoscope mirror patterns.
- **Download budget**: the three music beds are re-encoded (2,226,834 → 1,188,004 bytes, provenance in [`asset-manifest.json`](docs/asset-manifest.json)) and the 3D view no longer decodes 2D-only world art; Chapter I is now about 7.24 MB compressed of its 8.00 MB budget. `scripts/visual-regression.mjs` adds per-machine screenshot baselines (development only; needs Playwright).
- **Bug fixes**: the Chapter XII route is chosen through a new validated `chooseRoute` rules command; an unreadable stored chronicle is set aside and offered for download instead of being overwritten; Undo Move also removes the ability credit the move added; exporting during an Archive replay exports the chronicle, and a sandbox code is refused as a chronicle; hiding a tab saves only unsaved changes, so other tabs no longer report a false conflict.
- **Correction**: fieldworks (*Munitiones*) unlock in Chapter III (Immunis) battles, as implemented and stated in game, not "Chapters IV+" as the 0.24.0 notes said.
- **Not done in this release**: the WebGPU renderer (deliberately deferred); commissioned 4K painted backdrops and an authored Blender/KTX2 Roman asset kit (code-built geometry and code-painted panoramas stand in); painted animation frames do not exist for every unit, so some painted figures use their static column; real-device, real-GPU, Safari/Firefox and screen-reader checks, and human playtesting of the 90–150 minute target.

## 0.28.0 — tactical Undo Move (Regressus), 3D/2D reinforcement arrival beacons (Exploratores), clickable chamber vote seats (Tabula Curiae) and Quartermaster solvency & succession forecast (Ratio Imperii)

- **Regressus (Tactical Undo Move)**: adds [`canUndoMove`](src/core/game.js) and [`undoMove`](src/core/game.js) across battles ([`battle.js`](src/core/battle.js)) and political Contests ([`contest.js`](src/core/contest.js)), recording `unit.moveOrigin` on move and clearing it once any attack, speech, order, fieldwork, precedent, agreement, or turn end is committed. Adds the `#undo-move` button (`data-cmd="undo-move"`) in [`encounter-view.js`](src/ui/encounter-view.js) and the `U` keyboard shortcut in [`app.js`](src/ui/app.js).
- **Exploratores (3D & 2D Reinforcement Arrival Beacons)**: adds [`reinforcementBeacons`](src/core/battle.js) to surface pending reinforcement waves (`turn > e.turn`) with open arrival coordinates, turn countdowns, and unit role summaries. Renders 3D warning rings and spires via `updateReinforcementBeacons` in [`stage.js`](src/showcase/stage.js), 2D warning diamonds and `T#` badges in [`battle-art.js`](src/ui/battle-art.js), and a `.reinforcement-schedule` readout in [`encounter-view.js`](src/ui/encounter-view.js).
- **Tabula Curiae (Interactive Chamber Vote Seats & Whip Links)**: upgrades voter chips (`.vote-seat`) and Whip Forecast badges (`.whip-link`) in [`coalitionPanel`](src/ui/tactical-intel.js) into interactive buttons (`data-cmd="inspect-delegate"`), focusing the clicked delegate on the 3D/2D chamber floor and opening their inspection dossier.
- **Ratio Imperii (Quartermaster Solvency & Finale Route Tracker)**: adds [`quartermasterForecast`](src/core/game.js), [`quartermasterPanel`](src/ui/campaign-views.js) (`#camp-quartermaster`), and `#quartermaster-forecast` in [`panels.js`](src/ui/panels.js) to audit Supplies against due and upcoming political agreements, warn of solvency shortfalls, and track Chapter VIII–XII meter requirements for all three Chapter XII succession routes.

## 0.27.0 — tactical formation counter-play (Cuneus & Testudo), live chamber whip forecast, 3D/2D morale spectacle, camp War Council, after-action chronicle and customizable Reign Cards

- **Cuneus & Testudo**: adds [`enemyFormationLinks`](src/core/battle.js) to render enemy cohesion tethers in 3D ([`stage-readout.js`](src/showcase/stage-readout.js)) and 2D ([`battle-art.js`](src/ui/battle-art.js)), and enriches [`combatBreakdown`](src/core/battle.js) and [`combatModifiers`](src/showcase/stage-readout.js) with explicit `formationBreak` / `formationBreakLabel` chips (`Wedge splits shield wall`, `Flank breaks shield line`).
- **Calculus Curiae**: adds [`coalitionWhipForecast`](src/core/contest.js) and updates [`coalitionPanel`](src/ui/tactical-intel.js) to highlight current supporters **At Risk** from rival speakers' next-turn lobby intentions (`.vote-seat.at-risk`) and list **1-speech flips** in reach.
- **Signa & Terror**: adds expanding golden shockwave rings (`radius: 2.6`) for `Rally` and `Inspire` in 3D ([`stage.js`](src/showcase/stage.js)) and 2D ([`battle-effects.js`](src/ui/battle-effects.js)), plus shaken (`<= 40`), broken (`<= 20`), and pledged-cohort base rings (`updateMoraleRings`, `baseMarker`).
- **Consilium Castrorum**: adds [`warCouncilAdvisories`](src/ui/campaign-upgrade-views.js) and [`warCouncilPanel`](src/ui/campaign-upgrade-views.js) in camp so present companions (`Varro`, `Lucan`/`Sabinus`, `Crispus`, `Aelia`, `Paullus`) provide character-voiced counsel on the chapter's decision and upcoming encounter.
- **Acta Diurna**: adds [`encounterDebrief`](src/ui/tactical-intel.js) to [`resultRecord`](src/ui/tactical-intel.js), surfacing Distinguished Service citations, key Turning Points from the encounter log, and concrete Defeat Diagnostics & retry guidance when an encounter is lost.
- **Monumentum Aeternum**: adds selectable Reign Card **Monument Themes** (`REIGN_CARD_THEMES`: *Imperial Purple*, *Senatorial Marble*, *Legionary Bronze*) and automatic **Service Laurels** (`reignLaurels`) in [`renderer.js`](src/ui/renderer.js) and [`panels.js`](src/ui/panels.js).

## 0.26.0 — player-control overhaul, unavailable-action diagnostics, formation roster preview and chamber/allocation clarity

- Adds [`actionCostLabel`](src/ui/direct-controls.js), [`explainActionTargetGap`](src/ui/direct-controls.js), [`explainUnavailableActions`](src/ui/direct-controls.js), and [`unusedTurnSummary`](src/ui/direct-controls.js) so every action button states its exact cost (`1 move`, `1 action`, `1 order`, `1 speech`, `1 javelin`, cooldown, promise limit), empty-target states explain why no target is in reach, `#command-named-controls` and `#command-coaching` (`What can I do?`) explain why unavailable capabilities cannot be used right now, and `#end-turn` summarizes any remaining moves, actions, speeches, or command orders.
- Adds [`formationRosterPreview`](src/ui/direct-controls.js) to `Formation` order previews in Chapters V+, explicitly naming up to 3 adjacent allies who will join (`Joining shield-wall (N/3): …`) and any nearby allies excluded (`already ordered this turn`, `more than 1 tile from anchor unit`, or `3-unit formation cap reached`).
- Clarifies political Contest rules in [`coalitionPanel`](src/ui/tactical-intel.js) and [`encounterView`](src/ui/encounter-view.js): defines **Resolve** (*"speaking stamina; 0 withdraws from speaking, vote remains"*), states that votes are counted at the deadline (`end of turn X`; an early majority does not end the debate), displays [`delegateAppealSummary`](src/ui/direct-controls.js) (`Strongest appeals: …`) for each delegate's interest and bloc, and adds `Inspect` (`data-cmd="inspect-delegate"`) buttons to the chamber delegate roster.
- Adds [`allocationDraftPreview`](src/ui/campaign-views.js) and four preset buttons (`Balanced 2·2·2`, `River focus 4·1·1`, `Farms focus 1·4·1`, `Town focus 1·1·4`) to Chapter X camp preparation, showing live `N / 6` validation and exact Supplies, Army/Public/Political meter, road morale, store integrity, and Landholder tribunal stance effects before dispatching.
- Updates keyboard arrow-key navigation on `#battle-board` to visibly update `#board-hover` alongside screen-reader announcements, and binds 3D camera shortcuts (`F`, `Home`, `+`, `-`, `H`) in campaign encounters. See [controls overhaul verification](docs/archive/controls-overhaul-verification.md).

## 0.25.0 — Lux Imperii HDR post-processing, dynamic 3D water, subsurface foliage, physical armor shaders, volumetric fire and 2D Tabula Picta

- **Lux Imperii**: upgrades the 3D post-processing shader in [`scene-compositor.js`](src/showcase/scene-compositor.js) with single-pass HDR specular bloom, Contrast-Adaptive Micro-Sharpening (CAS), depth-aware atmospheric aerial perspective, and a subtle warm Roman fresco edge vignette.
- **Flumen & Vadum**: adds custom animated GLSL vertex/fragment water shaders in [`environment-surface-shaders.js`](src/showcase/environment-surface-shaders.js) with dual-rippling normal waves, Fresnel sky reflection, shallow-ford shoreline foam, and concentric rain ripples.
- **Ventus & Marmor**: adds wind-swaying foliage vertex displacement with warm backlit subsurface scattering, wet micro-puddle specular ground reflections during rain/marsh scenes, and procedural Cipollino/Carrara veined marble with polished floor reflections in Senate and council chambers.
- **Lorica & Paludamentum**: enriches [`actor-surface.js`](src/showcase/actor-surface.js) with anisotropic brushed iron/bronze metallic sheen (`sheen`, `clearcoat`) on Roman armor and helmets, velvet-like rim sheen on tunics and imperial purple cloaks, and harmonic vertex wave flutter on cloth banners and vexilla.
- **Ignis & Ferrum**: adds 3D volumetric rising ember/flame plumes on braziers and torches, multi-segment projectile ribbon trails on javelins and arrows, and persistent ground scorch/scuff decals in [`stage-particles.js`](src/showcase/stage-particles.js).
- **Tabula Picta**: upgrades the 2D tactical canvas ([`renderer.js`](src/ui/renderer.js), [`battle-art.js`](src/ui/battle-art.js), [`world-art.js`](src/ui/world-art.js)) with isometric 2D fieldwork sprites (`stakes`, `rampart`, `brazier`), diagonal crimson hatching on inspected enemy threat envelopes, time-of-day color grading overlays, and 2D weather particles.

## 0.24.0 — legionary fieldworks (Munitiones), war-room mutators, 3D Aquila & Cornu brass, Oculus Tactica threat envelopes, Rostra interjections and Cursus Honorum monument

- Adds **Tactical Field Engineering (`Munitiones`)** in Chapters IV+ (`stakes`, `rampart`, `brazier`), allowing the commander's engineering detachment to erect one fortification per battle that modifies `combatBreakdown` (negating cavalry charges, adding +2 wall defence, or +1 ranged fire damage) and renders in 3D and 2D.
- Adds **Archive War-Room Mutators** (`difficulty`, `weather`, `timeOfDay`, and Chapter XII `route`) to sandbox Archive replays without altering the primary campaign save.
- Adds **3D Legionary Aquila & Signum standards** with golden eagles, phalerae medallions, and crimson vexillum cloth on commanders and formation leaders, paired with synthesized **Roman Cornu & Buccina brass horn cues** (`rally`, `formation`, `fieldwork`).
- Adds **Oculus Tactica** (`combatBreakdown` modifier chips and `threatEnvelope` reach/target readouts) in the command inspector and 3D stage.
- Adds **Named Senate Delegate Interjections** (`delegateCallout`) and a **3D Marble Rostra Speaker's Dais & Curia Bench Tiers** in political Contests, plus an interactive **Cursus Honorum Monument** (`cursusHonorum`) in the character dossier.

## 0.23.0 — Archive of the Reign sandbox, dynamic 3D weather & night-march torchlight, veteran commendation ranks, interactive Tabula and Senate precedent motions

- Adds **Archive of the Reign** (`archiveEncounters`, `createArchiveReplay`) in the Mission Journal and Accession Epilogue so any completed battle or political Contest can be replayed in an isolated sandbox session.
- Adds **Dynamic 3D Weather & Night-March Torchlight** (`weather`, `timeOfDay`, `buildWeatherParticleSpecs`, `pointLights`) across all 25 encounters (rain, mist, desert dust, siege embers, and flickering night-march/dusk torchlight).
- Adds **Veteran Commendation Ranks & Evocatus Mastery** (`veteranRank`: *Gregarius → Immunis → Principalis → Evocatus*), granting passive mastery bonuses at 2+ and 4+ commendations, 3D crest/torc insignia, and contextual companion callouts (`companionCallout`).
- Adds an **Interactive Imperial Command Tabula** (clickable SVG theatre nodes and expandable theatre dossiers in the Campaign Map) and a **Turn-Step Scrubber** (`#turn-scrubber`) for reviewing recent turn events on the board.
- Adds **Senate Career Precedent Motions** (`precedentOptions`, `invokePrecedent`) in Chapters VII–XII Contests, allowing players to invoke earned military, provincial, or fiscal milestones once per Contest.

## 0.22.0 — 3D ground paths, multi-unit forecasts, opponent intent arcs, custom Order destinations and Imperial epilogue record

- Adds 3D ground movement path polylines (`stagePreviewPath`), action-intent target ring color coding (`targetRingColor`), a directional facing chevron on `selectedRing`, and 3D formation cohesion links (`kind: 'cohesion'`) between adjacent friendly units sharing an active formation.
- Adds multi-unit 3D floating forecast badges (`previewBadges`) across all units affected by `Formation`, `Rally` (including defection morale thresholds), `Address`, and `Threaten` (including `-1 stance` bloc backlash).
- Projects a crimson 3D opponent intent arc (`kind: 'intent'`) from an inspected enemy soldier or rival speaker toward their authoritative `unit.intent` target or objective.
- Exposes engine-supported custom `Order` advance coordinates (`allyDestinations`, `#order-destination`) in `encounterView` so players can direct ordered allies onto specific flanking or high-ground tiles.
- Adds a `Speed 1×` / `Speed 2×` 3D playback toggle (`data-cmd="camera-speed"`) and click/`Space` fast-forward acceleration during active 3D animations.
- Updates the shareable Reign Card header in `drawReignCard` to `I M P E R I U M` and adds an **Imperial Archive · Service Summary & Company Roll** section to the Chapter XII accession epilogue.

## 0.21.0 — 3D pre-action forecast badges, specialist foley and camp progression clarity

- Adds floating 3D pre-action forecast badges (`previewBadge`) directly on the targeted unit's 3D world label during order previews across both the main campaign and standalone 3D showcase (`−4 HP · Flank`, `Ward −2 dmg`, `+20 morale · +1 HP`, `+3 stance (-1 → 2)`, `Support 3 → 5`, `-4 Resolve`, `Blunt speech`).
- Adds distinct synthesized foley plans (`guard`, `inspire`, `agreement`) to `battleSoundPlan` and `combatCues`, plus subtle 3D shimmer on active Protector `Guard` ward and `aim` arcs when reduced motion is off.
- Auto-opens `veteranAcademy` in camp when any veteran is eligible for permanent specialization (surfacing the ready count in the summary) and auto-opens the compact camp `relationshipLedger` when an open agreement is `dueNow`.
- Adds `order` and `conversation` motions and a `Head gaze` (`#gaze`) slider to the standalone character inspector (`tests/actor-model-browser.html`).

## 0.20.0 — expressive gaze, 3D tactical wards and Chapter I budget headroom

- Adds weighted eyebrow bones (`left-brow`, `right-brow`) and deterministic `actorExpression` posture across speech, rally, combat drive, bracing, and injury states, plus multi-syllable jaw articulation and bounded head gaze targeting (`gazeYaw`, `gazePitch`) toward inspected or addressed figures.
- Adds 3D on-stage Protector `Guard` ward tethers, Ranged `Volley` / javelin preview arcs, operation phase objective prefixes (`Phase 1` / `Phase 2`), and automatic overview camera re-centering when a multi-phase operation advances.
- Normalizes line endings in `dist/` and strips non-license JSDoc blocks from bundled `dist/vendor/three/` modules during build, reclaiming ~159 KB of Chapter I compressed budget headroom (`7.84 MB` / `8.00 MB`) across Windows and Linux while preserving all source files and provenance checks.

## 0.19.0 — more natural faces

- Fits almond eye openings to imported anatomy and clips irises without folded triangles. Upper eyelids blend between the moving lid and fixed head; eye corners remain anchored during blinks.
- Replaces raised eyebrow tubes with tapered hairs, preserves skin highlight contrast, and adds restrained mature cheek and facial-fold shaping.
- Feathers beard and scalp boundaries, adds fuller moustache coverage, and retains finer strands in the imported short-hair cutout.
- Adds seven regression checks and a closed-eyelid control to the development inspector. The full 569-test regression and 13 asset/worker checks pass; legal autoplay completes 25 encounters in 217 turns. See [final validation](docs/archive/release-validation-v019.md).

## 0.18.0 — fitted characters and wearable equipment

- Fits complexion textures to the original UVs of imported male and separate female anatomy. Shapes exposed neck rims to sit within collars and fits helmet openings around the imported head.
- Adds one locally bundled CC0 short-hair model and cutout texture for eligible male figures, with per-identity fitting and tint. Bound female hair remains original fitted geometry; the new asset is shared rather than a collection of individual haircuts.
- Gives cloth, leather, mail, scale and metal distinct normal and roughness response. Preserves the eyes' physical-material settings through batching so their highlights remain controlled.
- Replaces separate sleeve caps with a connected, weighted tunic or armor shell, including shaped folds and turned collar/cuff edges. Rebuilds hands with shaped palms, tapered fingers, opposing thumbs and subtle nails, and boots with fitted insteps, toe boxes, sewn panels and separate soles.
- Adds small overview hand/boot meshes that retain the same silhouette, weapon-grip space and foot-contact plane. Temporary geometry, shared textures and skeletons have explicit ownership and disposal; construction does not consume gameplay randomness.
- Leaves gameplay rules, campaign content, saves and committed action timing unchanged. The [v0.18 release record](docs/archive/release-validation-v018.md) records 562 full-regression tests, 78 final actor checks, 6 final surface checks, 25 browser scenes / 518 assertions, 63 targeted browser assertions and 13 asset checks. Production revision `a0dbf383f33b` passes the download budgets. A server-stopped Chapter VI reload and normal Continue action preserved the exact portable save code after the full offline download. Physical-device and independent human testing remain unperformed; geometry counts do not establish performance.

## Historical 0.17.0 — veteran paths, recurring negotiators and fitted anatomy

- New chronicles offer 22 authored operation alternatives across eleven encounters. Branches change objectives, routes or protected parties; a clean victory earns the stated resources and a one-use later-field benefit. Versioned progression preserves older chronicles and complete retry checkpoints.
- Veterans with two deployments can choose a permanent Protector, Formation leader or Ranged specialist path from Chapter III. Guard, Inspire and limited Volley actions carry explicit command, turn and attribute tradeoffs.
- Nine named representatives recur across six political Contests. Demands and counterproposals exchange immediate stance for a later supply payment; honored or broken agreements alter trust and later starting stance. Agreements stage until encounter commit and remain separate from existing Promise obligations.
- Adds an optional opening field guide based on legal commands and authoritative previews, with camp and chamber panels exposing training, branch rewards, negotiated terms and payment eligibility.
- Fits locally bundled MakeHuman CC0 male head, neck and exposed-arm anatomy to the existing skinned identity rig, with the original procedural fallback. Female figures, clothing, armor, hands, legs, equipment and horses remain original project models. Weapon-specific authored joint clips coordinate sword, spear, mounted, throw and reaction poses; no motion capture is introduced.
- Adds inhabited frontier/wetland/eastern settlements and civic architecture, plus private-material scenery cutaways for Follow, Horizon and action framing. Unit and objective labels avoid the selected body's projected rectangle. Authoritative terrain and movement remain unchanged.
- Defers the imported model with shared chapter 3D assets, compresses active terrain materials without repainting, and adds optional bounded drawing-buffer adaptation from asynchronous GPU elapsed queries. Interface text remains at normal resolution. Existing audio recordings are unchanged.
- The [v0.17 validation record](docs/archive/release-validation-v017.md) records 510 passing Node tests, 25 browser scenes / 518 assertions, 63 targeted assertions, 21 dedicated GPU checks, 13 asset/offline checks, 11 isolated browser progression checks, two legal 25-win routes and exact previous-version command/retry compatibility. Production revision `9faf31555b45` meets the declared download budgets. Normal progression controls and server-stopped Chapter I continuation preserved their stated transactions/save; physical-device and independent human testing remain unperformed.

## 0.16.0 — foliage, character form and depth lighting

- Replaces sparse leaf polygons with original alpha-tested foliage sprays, fuller branching trees, curved palms and blended soil verges. Structural camera obstacles remain solid while Follow can ignore leaf-card bounds.
- Rebuilds facial contours, connected shoulder/limb profiles and fitted armor; welds sculpted seam normals and opens helmet/coif guards around the face. Existing skeleton, equipment, foot contacts, legal positions and animation remain authoritative.
- Adds a bounded linear HDR color/depth target and fullscreen contact-shading/edge-smoothing pass for Balanced/High. Reduces broad fill lighting. Handles failed shader linking with a visible direct-render fallback, restores renderer state and releases target resources. Performance remains direct.
- Adds an original foliage atlas and a mechanically optimized character atlas with provenance. Retains the previous atlas in historical assets/full download but excludes it from active chapter downloads; the existing 2/8/24 MB compressed delivery gates remain unchanged.
- See [v0.16 validation](docs/archive/release-validation-v016.md) for automated, GPU, campaign browser, offline/save and measured desktop evidence. No gameplay core files change in this release.

## 0.14.1 — Imperium

- Renames the game and current project documentation to **Imperium**, with the repository at `obeidpeter/Imperium`.
- Preserves existing save identifiers and portable formats. Earlier verification records, exact artwork prompts and supplied source filenames retain their original names; the Roman military oath remains *sacramentum*.

## 0.14.0 — character and material quality

- Adds weighted skeletal surfaces across original character, clothing and horse joints, with bounded cloth deformation, deterministic seeking and preserved equipment/foot contacts. These are repository-authored procedural figures and poses, not imported character assets or motion capture.
- Matches walking and mounted strides to distance travelled, retimes a cloned 3D presentation sequence with 550–2,400 ms movement and a 1.65 action-time scale, and preserves release/contact/cue dependencies. Anticipation, recovery, directional shield blocks/reactions and surface-aware foot/hoof/wade sound improve action readability without changing the committed rules result.
- Prevents withdrawn figures or reused troop names from receiving another unit's animation, prefers the current living tile occupant for effects, and limits skinned picking to actually visible surfaces.
- Generates sky-aligned HDR reflection lighting locally once per scene or quality change. Pooled soft ground/sole contacts and deterministic pose-anchored impact particles complement existing directional shadows and action effects; no new texture download or external service is introduced.
- Refines shared scenery with smooth boulder normals, compound palms, tapered branches, low verge plants, fluted columns, jointed arches and material weathering. Balanced/High masonry gains beveled edges while Performance retains simpler blocks. Authoritative terrain, camera clearance and horizon/river joins remain the presentation boundaries.
- The [version 0.14 verification record](docs/archive/character-quality-verification.md) documents 401 passing tests, legal 25-encounter completion, eleven asset/offline protocol checks and 25 browser scenes / 518 assertions in two batches. Ordinary production play completed the drill and retained exact save equality through camera/view changes and reload. It records actual timing, the vendor precision warning and unperformed device, human and fresh browser-offline checks.

## 0.13.0 — sky and horizon

- Adds an original procedural sky and regional distant landscape around the existing playable terrain, with an explicit **Horizon / H** camera view in the campaign and standalone skirmish. **Overview / Home** restores tactical framing; startup retains Overview.
- Camera controls preserve the legal encounter, turn, commands and saved state. The 2D alternative remains available. This release adds no bitmap sky download, external art service or gameplay rule change.
- A dedicated browser-harness diagnostic records sky/landscape metadata, camera settings, skyward projection and exact save equality without changing the existing all-scene checks. The [version 0.13 verification record](docs/archive/sky-horizon-verification.md) distinguishes 375 passing tests, the earlier all-scene sweep, final targeted visual checks and normal-interface save equality. Narrow browser and landscape scene-container observations remain separate from physical-device claims.

## 0.12.0 — presentation refinement

- Overview framing uses the playable ground and actual figures. Follow chooses a clear view around structural scenery, while selected units and action recipients remain the focus. Label placement combines unit badges and objective markers, prioritizes selected/inspected figures and hides lower-priority badges when no clear space remains.
- Original procedural rigs add terrain-aware planted feet and horse hooves, bounded pose transitions, equipment-aligned projectile release and mounted weapon aim. Near/overview detail levels preserve role silhouettes and picking while reducing distant geometry. These remain scripted original models, not imported character assets or motion capture.
- Static scenery is batched without changing authored terrain, transparent surfaces or moving cloth. Cached shadow updates, label measurements and instanced target markers reduce repeated rendering work; actual measured costs belong in the verification record rather than a guaranteed speed claim.
- Extends the legal-checkpoint browser review harness with specific-figure inspection, camera overview/follow controls, exact action occurrences and autonomous-turn samples that actually move the inspected figure. Enemy inspection never grants control or modifies campaign saves.
- Records settled visible-label bounds/overlap, camera settings, actual draw workload and separate 120-frame CPU, stage-interval and RAF measurements. Comparisons require equivalent scenes/cameras and recorded conditions; no speed or device-quality claim follows from adding measurement tools.
- The [version 0.12 verification report](docs/archive/campaign-3d-refinement-verification.md) records 360 passing tests, the strict 25-scene browser sweep, three complete normal-interface encounter routes, a server-stopped Senate victory/reload and measured rendering costs with explicit limits. The version 0.11 report remains historical evidence.

## 0.11.0 — all-chapter 3D presentation

- Extends the shared scene to all nineteen battles and six political Contests, retaining the same campaign state, legal commands, saved encounters and optional 2D view. Chapter-specific scenery and original procedural military/civilian figures cover marshes, fortifications, eastern campaigns, crossings, the province and chambers.
- Political labels distinguish delegate stance/commitment from speaker Resolve. Compact labels reveal names on hover/selection, and withdrawn speakers retain their votes. Argument gestures, objectives, escort markers and role/faction changes follow the actual encounter state.
- Every chapter cache group includes shared renderer, material and Three.js dependencies, supporting a cold restored later chapter without visiting Chapter I. Shared URLs are reused; initial shell and standalone study page/style boundaries remain separate.
- A legal-command fixture generator covers every encounter start and its real action sequence. A development browser harness exposes explicit scene, action, lifecycle and timing checks. The [current verification record](docs/archive/campaign-3d-verification.md) reports only checks performed, with no inferred device/performance or human-playtest claim.

## 0.10.0 — Chapter I integrated 3D presentation

- Chapter I training and the frontier battle use the shared 3D scene within the normal campaign. Commands, saved progress, checkpoints and retries remain authoritative; view switching preserves the same encounter. Later chapters retain their 2D presentation, and unavailable WebGL falls back to the tactical view.
- Orbit, zoom, overview and follow-unit camera controls coexist with the campaign's keyboard tile cursor, named selectors, preview/confirm commands and optional grid. Quality and reduced-motion settings affect presentation only.
- Original procedural figures gain shaped anatomy/clothing, role-specific training and field equipment, material microtextures and articulated action poses. The training yard, terrain and frontier scenery remain locally constructed meshes and materials. No third-party character model, motion-capture clip or new bitmap artwork is introduced.
- Optional effects remain off by default. Local Web Audio synthesis adds event-timed footsteps, shield/weapon contact, throws, cloth and impacts with adjustable volume, bounded voices and hidden-page stopping. No external recording or audio dependency is used.
- Shared 3D modules, local Three.js and material textures now join Chapter I's offline group while remaining excluded from the initial shell. The standalone study page/style remain part of the explicit complete download. Verification and remaining browser/device work are recorded in [3D presentation verification](docs/archive/showcase-verification.md).

## 0.9.0 — optional 3D frontier study

- A separate playable frontier battle uses a WebGL scene, articulated three-dimensional soldiers, local surface textures, orbit/zoom camera controls and a compact command deck. Named selectors and previews retain the existing legal action flow.
- The title's **Enter the 3D frontier** link opens the study. It does not import or write the campaign save, grant progression or replace the twelve-chapter campaign. Restart repeats only this battle.
- Three.js 0.186.1 and its MIT license are bundled locally. The static build includes the study, vendor modules and textures while excluding them from the initial shell and chapter prefetches. Explicit complete offline download includes their dependencies.
- Known optional-page navigation now resolves its own document before falling back to the cached campaign shell. Quality/reduced-motion controls and camera focus/home buttons are available within the study. Release measurements and performed device/browser checks belong in the accompanying verification record.

## 0.8.0 — production presentation and direct command stage

- A larger battlefield/chamber stage and compact command strip expose the selected figure, legal actions, exact preview and turn status. Direct figure/ground selection previews an intention; a second activation or Confirm commits through the existing rules API. Keyboard and named selector paths remain available.
- Continuous ground materials, broad lighting, textured natural scenery, camp defenses and chamber floors replace the persistent checkerboard and flat environmental primitives. The Grid toggle and individual target/focus outlines preserve tactical clarity without changing legal terrain.
- Five local sheets add 156 generated animation frames. Verified costume/action/facing combinations use authored sequences; uncovered roles and directions retain the original facing art and procedural poses. Visible atmosphere is continuous at capped quality-dependent rates and disabled by Performance/reduced-motion settings.
- Early companion readiness and political target inspection reflect actual command availability. Tactical disclosures retain their open state across commands. Narrow and landscape layouts keep the order flow usable.
- The presentation budgets retain a 2 MB compressed initial cap and raise the limits to 8 MB for shell plus chapter I and 24 MB for the explicit full-campaign download. Decoded artwork retention is capped at 40 entries / 64 MiB estimated RGBA bytes; future-chapter warming does not decode additional images.
- The [production verification report](docs/archive/production-verification.md) records automated tests, legal campaign completion, actual browser flows, motion measurements, provenance and remaining device/human tests. These are 2D presentation improvements, not a complete animation library or full 3D engine.

## 0.7.0 — tactical and political overhaul

- Revised Standard combat uses role- and objective-aware planning, symmetric morale, engagement that stops movement on entering a visible melee threat, and a controlled Withdraw order. Formation cohesion, facing, ranged height and cavalry approaches affect exact damage previews.
- Political blocs have distinct argument preferences; nearby speakers improve Persuade. Public rival plans react to the visible position, and authoritative previews enumerate affected votes, Resolve and costs. Grain and office promises cost three supplies to honour; other promises cost two. Commitment resistance, deadline-only voting, the fixed electorate and two-recipient limit remain.
- Mission briefs, field intentions, coalition status and chapter responsibility guidance expose the existing campaign’s decisions. Outcome summaries identify withdrawals and new debts; optional sound effects have a volume control.
- Regional ground and chamber materials, natural scenery, formation/guard/morale markers and recipient-linked gestures improve visual distinction. Existing painted facings remain procedurally animated; presentation does not alter gameplay outcomes.
- Encounter rule markers preserve old active saves and their exact retries. Newly started battles and Contests adopt version-two rules; earned progression, authored choices, company recovery and the governor → senator → emperor sequence remain.
- Design audits and a twelve-chapter review document the changes. Automated, browser, physical-device and human-play evidence remain separate; release measurements belong in the final verification report.

## 0.6.0 — graphics refinement

- Procedural articulation moves the existing painted unit artwork through footfalls, melee attacks, throws, guards, hits, mounted actions and political gestures. Movement phase follows the visual route; keyposes include preparation, contact and recovery.
- Directional contact shadows, projectile arcs and differentiated shield/impact effects improve grounding and action feedback. Four authored facings remain; this is not a 3D character system or a new frame-by-frame bitmap animation library.
- Connected shorelines, road wear and material transitions follow authored terrain. Regional groundcover and exterior camp, crossing, provincial and chamber props add context without changing passability or obscuring legal target overlays.
- Ground detail is cached. Quality modes limit scenery and effects; presentation remains deterministic, cancellable and reduced-motion-aware.
- Development-only legal-action filmstrips, pose/facing diagnostics and comparable browser measurements extend graphics review. Their scope and limitations are recorded in the [graphics refinement verification report](docs/archive/graphics-refinement-verification.md).
- Gameplay, campaign content, earned progression and local save behavior are preserved. No runtime dependency or additional bitmap artwork was introduced for this refinement.

## 0.5.0 — historical website and interface release

- A cinematic title page with immediate Play/Continue actions, campaign/world sections, an early choice example and actual gameplay previews.
- Shared ivory, charcoal and Pompeian-red presentation across navigation, camp, campaign progression, character equipment, journal, obligations, settings, recovery and reference panels.
- Responsive tactical controls, touch-sized actions, readable dialog surfaces and keyboard focus management retain the existing gameplay and save commands.
- Development helpers record actual loading requests and interface milestones. The [interface verification report](docs/archive/interface-verification.md) and [design system](docs/interface-design-system.md) describe this historical release.

## 0.4.0 — historical graphics release

- Locally bundled directional unit and prop atlases, layered regional battlefields and political chambers, faction equipment and clearer depth ordering.
- Bounded action motion and scene atmosphere, presentation quality controls and reduced-motion handling.
- Chapter-specific portraits, recurring-cast expressions, staged campaign scenes and rank-specific ceremonies retain the complete campaign.
- Chapter-aware artwork loading, explicit full-campaign offline caching and documented asset provenance. The [graphics verification report](docs/archive/graphics-verification.md) records the checks and limits of this historical release.

## 0.3.0 — 2026-10-11

Gameplay, narrative, phone usability and save reliability improvements.

- Authored mission layouts and objectives, rescue/escort responsibilities, pressure waves and distinct finale confrontations replace repeated battlefield setups and arbitrary minimum turns.
- Correct facing/flanking and bounded formation effects. Delegate interests make political appeals situational; repeated military-record appeals to the same delegate are limited.
- State-aware arrival, choice, briefing and outcome scenes with saved reading position; the first oath follows training. Company service, commendations and bounded wound recovery persist; provincial decisions affect playable challenges.
- A compact phone board/action/target/confirmation loop, nearby vote totals, clearer target and mission markers, and skippable turn summaries with contextual optional sound.
- Three distinct recovery checkpoints, explicit preview/restore and tab takeover; IndexedDB compares and writes atomically even without Web Locks. Old suspended encounters retain their original rules and exact retry layout.
- Separate screen modules and directly imported controller tests. The current verification report distinguishes automated checks, browser checks, and physical-device/human tests still pending.

## 0.2.0 — 2026-10-11

Complete aesthetic upgrade of the existing campaign.

- Shared typography, materials, controls and responsive layouts throughout the title, camp, map, battles, political Contests, character, journal, ledger, settings, promotions and finale.
- Twenty-one original, locally bundled WebP illustrations: seven protagonist stages, seven character portraits, a title composition and six regional scenes. Asset provenance and generation instructions are documented.
- Clearer Canvas terrain, figures, faction markings and political chambers; bounded, reduced-motion-aware feedback that does not mutate game state.
- Deferred artwork caching, truthful offline progress, retry after interruption and revision-isolated service-worker updates. Both existing compressed size gates remain unchanged.
- Inline error feedback, predictable mobile control order, coalesced render bindings and protection against asynchronous reign-card races.
- Fifty tests pass; the legal route still completes twelve chapters and twenty-five encounters in 231 player turns. Core rules, campaign data and storage modules are byte-identical to 0.1.0. Detailed measurements and test limits appear in `docs/archive/aesthetic-verification.md`.

## 0.1.0 — 2026-10-11

Initial complete campaign implementation.

- Twelve chapters and twenty-five playable battle and Contest encounters, from recruit training to the imperial accession.
- Original Danube-to-Rome narrative, recurring cast, signalled character fates and replacement branches, consequential choices, historical source notes, and an epilogue that recalls the early campaign.
- Shared browser/Node tactical rules with legal actions and previews, autonomous allies, earned command capacity, formations, morale, and preparations.
- Grid-based political Contests with deadline voting, stance, Resolve, seven speech abilities, and recorded promises.
- Milestone-derived Senate and finale locks, provincial allocation and judgment, three campaign meters, a finale forecast, and playable confrontation routes with costly recovery backing.
- Code-drawn isometric mosaic battlefields, evolving portraits and insignia, fresco camp panels, responsive controls, keyboard targets, optional generated sound, and reduced-motion settings.
- Encounter snapshots, validated autosaves, mirrored browser storage, portable save codes, and an end-of-campaign reign card.
- Dependency-free native JavaScript modules, a static build and preview server, generated offline cache, web-app manifest and icons, and one configurable public site address.
- A Node rules test suite and legal-command campaign autoplay harness, kept separate from development-only scenario injection.

The target playtime and subjective quality require human playtesting. Live custom-domain publication, real iOS/Android installation, device share sheets, and long-term offline/save retention require owner-side deployment and physical-device checks. Verification results are reported separately from these implementation notes.

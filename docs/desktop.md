# The desktop app (Steam)

The desktop app is Imperium for Steam, Windows first ([the plan](steam-plan.md)). It is an Electron window around the same game the web site serves, built for it by `npm run build:desktop`. It lives in `desktop/`, a separate package, so the web project keeps no dependencies.

## Build, run and check

From the repository root:

```sh
npm run build:desktop          # the game for the app, into dist-desktop/
cd desktop && npm ci           # Electron and electron-builder, into desktop/node_modules/
npm start                      # (in desktop/) run the app on dist-desktop/
npm run package:win            # (in desktop/) the Windows app folder, desktop/out/win-unpacked/
npm run package:linux          # (in desktop/) the Linux one, desktop/out/linux-unpacked/
```

From the root, `npm run smoke:desktop` checks the app through its interface. `DESKTOP_APP=packaged npm run smoke:desktop` checks the packaged app instead. On Linux without a display, run it under `xvfb-run -a`.

CI's `desktop` job packages the app on Linux and Windows and runs that check on the packaged app. Each push to main keeps the Windows app folder as an artifact, `imperium-windows`, for a week. It is unsigned, so Windows may warn before opening it.

For development:
- `IMPERIUM_DEVTOOLS=1` lets F12 open the developer tools.
- `IMPERIUM_GAME_DIR` and `IMPERIUM_USER_DATA` point the app at another build and another data folder, as the check does.

## How it works

- **One origin, forever.** The app serves the game from its own files at `app://imperium`, a privileged scheme registered in `desktop/main.cjs`, so ES modules, workers, WebAssembly and the content security policy work as on the web. The page's saves (IndexedDB and localStorage) belong to that origin, so **it must never change**: a different origin would strand every save.
- **The bridge.** The page reaches the computer only through `window.imperiumDesktop` (`desktop/preload.cjs`). The preload is sandboxed with context isolation, and offers:
  - the save file;
  - Quit and the quit handshake;
  - the window's fullscreen.

  `src/ui/platform.js` is the game's side of it. The desktop build records `platform: 'desktop'`, and without the bridge a desktop build behaves as the web.
- **Saves.** Every save is written through to `saves/campaign.json` in the app's folder: `%APPDATA%\Imperium` on Windows, `~/.config/Imperium` on Linux.
  - The write is atomic, and the previous copy is kept as `campaign.prev.json`.
  - On the desktop the file is the chronicle. Loading adopts it when it differs from the app's own store, and keeps what it replaces as a recovery checkpoint (`src/ui/storage.js`).
  - A file that cannot be written is reported, while the store keeps the save.
  - An unreadable file is set aside for export, like any unreadable save.
  - A chronicle from the browser or the free demo comes by its save code: the first title page offers **Import a chronicle from the browser**.
- **Closing.** When the window closes, the app asks the page to save first and closes on its answer. If the save failed, the player chooses between quitting anyway and keeping playing. The Menu's **Quit to desktop** closes the same way.
- **The window.**
  - Fullscreen by default; F11 or Alt+Enter, or **Settings → Graphics → Window**, switch it. The app remembers the window's state.
  - Escape stays with the game.
  - There is no browser menu, so the browser's reload, zoom and developer keys do nothing.
  - A second launch brings the first window forward instead of opening another.
- **The graphics chip.** The app asks for the high-performance one on laptops that have two.
- **No network.** The game makes no requests of its own: the check fails on any request that leaves `app://imperium`.
  - Web links open in the system browser.
  - The game's own files, such as the credits' licences, open in a plain window without the bridge.
  - No service worker can register on the app's origin, and none is needed: every chapter is installed.
- **What the page says.** On the desktop:
  - the title page, footer and privacy notes speak of the installed game, not the free browser one;
  - Settings has no offline section;
  - the reign card prints no site address;
  - there is no share sheet, so the card is downloaded.

## Steam (S3)

- **Achievements.** The 35 achievements are data (`src/data/achievements.js`). [docs/steam-achievements.md](steam-achievements.md) lists them for entering in Steamworks, and `node scripts/steam-achievements.mjs` regenerates it.
  - `earnedAchievements(state)` (`src/core/achievements.js`) reads them from what the chronicle records. It changes nothing and never grants anything, and a Practice replay earns none.
  - The page reports them through the bridge after each save, restore and load (`reportAchievements`, `src/ui/platform.js`). Steam unlocks the ones it does not have yet, so a chronicle brought from the browser or the demo unlocks what it has already earned.
- **The Steam link,** `desktop/steam.cjs`, uses [steamworks.js](https://github.com/ceifa/steamworks.js) 0.4.0 (MIT). It runs only with a Steam App ID: `"steamAppId"` in `desktop/package.json` (null until the owner has one), or `IMPERIUM_STEAM_APP_ID` for development.
  - Without an App ID, or without the Steam client running, the app runs as before. The bridge's `steam.status()` says why Steam is off.
  - With one, the app starts the Steam API and turns on the overlay (Shift+Tab) before its window opens. steamworks.js's Electron helper sets Chromium's in-process GPU and repaints the window each frame so the overlay can draw. Check the frame rate with it on a real PC.
  - For a development run on Valve's test app, set `IMPERIUM_STEAM_APP_ID=480` with Steam running. The overlay can be tried there, but the game's achievements exist only in its own app.
- **Cloud saves.** Steam Auto-Cloud needs no game code. In Steamworks, sync the root `WinAppDataRoaming` (`%APPDATA%`), subdirectory `Imperium/saves`, pattern `campaign.json`. Only that file is the chronicle; `campaign.prev.json` stays local.
- **Upload.** SteamPipe's build scripts are in `desktop/steam/`.
  1. Put the App ID and the Windows depot's ID in `app_build.vdf` and `depot_build_windows.vdf`.
  2. Package the app (`npm run package:win` in `desktop/`).
  3. Upload with Valve's `steamcmd`: `steamcmd +login <account> +run_app_build <path to>/desktop/steam/app_build.vdf +quit`.
  4. Set the build live on a private beta branch in Steamworks first.

  The scripts follow SteamPipe's documented format. Check them against Steamworks' SteamPipe page, which this session could not reach.
- **Steam's own files.** steamworks.js brings Valve's Steamworks API library: `steam_api64.dll` on Windows, `libsteam_api.so` on Linux. The packaged app carries only its platform's copy, unpacked beside `app.asar`. Valve's Steamworks SDK terms cover shipping it with a game on Steam.

## Licences

- The packaged folder carries Electron's and Chromium's licences at its root: `LICENSE.electron.txt` and `LICENSES.chromium.html`. The desktop credits point there.
- The game's own third-party licences ship inside the game: Three.js, its decoders and the MakeHuman assets. The credits link them.
- steamworks.js's MIT licence ships with it in `resources/app.asar.unpacked/node_modules/steamworks.js/`.

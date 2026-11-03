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

## Steam (S3, once the App ID exists)

- **Cloud saves.** Steam Auto-Cloud needs no game code. In Steamworks, sync the root `WinAppDataRoaming` (`%APPDATA%`), subdirectory `Imperium/saves`, pattern `campaign.json`. Only that file is the chronicle; `campaign.prev.json` stays local.
- **Overlay and achievements.** These come with steamworks.js in the main process. The renderer will reach them only through the bridge.
- **Upload.** SteamPipe build scripts go in `desktop/steam/`. The upload content is the packaged `win-unpacked/` folder.

## Licences

- The packaged folder carries Electron's and Chromium's licences at its root: `LICENSE.electron.txt` and `LICENSES.chromium.html`. The desktop credits point there.
- The game's own third-party licences ship inside the game: Three.js, its decoders and the MakeHuman assets. The credits link them.

# Imperium on Steam, with a free web demo — the approved plan

The owner approved this plan on 3 November 2026, after [#65](https://github.com/obeidpeter/Imperium/pull/65) (the Windows playtest follow-up) and [#66](https://github.com/obeidpeter/Imperium/pull/66). It is kept here as approved, with second-person wording turned to name the owner, so the packages can follow it.

Each package's changelog entry records what it actually delivered and measured. Where it and the plan differ, the changelog and the code are authoritative.

## Status

| # | Package | State |
| --- | --- | --- |
| S1 | The desktop app | in progress |
| S2 | The web demo | planned |
| S3 | Steamworks | planned; needs the App ID |
| S4 | The store and the release | planned; after 0.40.0 and the owner's Gate 4 sign-off |

## Context

The owner wants to sell Imperium on Steam and keep the web version. The owner's answers:

| Topic | Decision |
| --- | --- |
| Web version | A **free demo** of the opening chapters (I–III), pointing to Steam. A demo save carries over by save code. |
| Platforms at launch | **Windows first.** Linux/Steam Deck and macOS can follow. |
| Timing | **Start now**, alongside Gate 4. |
| Steam features at launch | **Cloud saves, achievements and the Steam overlay.** |

**What the game already is:**
- A static web app with no runtime dependencies, Three.js bundled, and a content policy that loads only its own files.
- An install manifest, a service worker with offline packs, and saves in browser storage (`src/ui/storage.js`).
- 62 MB built, tested on every pull request in headless Chromium.

**The approach:**
- One codebase, three outputs:
  1. **the Steam build:** the full game in an Electron window, Windows first;
  2. **the public web demo:** Chapters I–III;
  3. **the full web build:** for development, tests and the owner's playtests.
- The game in `src/` stays one program. What differs lives at the platform boundary, chosen by the build: saves, the offline cache, the Menu's Quit, fullscreen, Steam, and the demo's end.
- Nothing about the web game changes until the owner chooses to publish the demo.

**Facts not checked from the planning session:** Valve's partner site (`partner.steamgames.com`) was blocked by its network settings. Valve's own page says:
- the fee is **$100 per game**;
- a public **Coming Soon page must stay up for at least two weeks**;
- the store page and build are **reviewed**.

Older reports add a **30-day wait between paying and releasing**, and that the fee is **recouped after $1,000** in sales. Both are to confirm in Steamworks. The same goes for Steam's current AI-disclosure wording.

## Work packages

### S1 — The desktop app (no Steam account needed)

**`desktop/`**, a separate package with its own `package.json`, so the web project stays dependency-free:
- Electron 45, electron-builder, and later steamworks.js 0.4 (MIT).
- `desktop/main.js`:
  - one window, fullscreen by default, remembering its size;
  - a privileged `app://` protocol serving the desktop build, so ES modules, workers, WASM decoders and the existing CSP work unchanged;
  - one instance only, no browser menus;
  - the high-performance graphics chip requested;
  - navigation and new windows blocked outside `app://`;
  - IPC handlers for saves, quit and fullscreen.
- `desktop/preload.cjs` (contextIsolation on, nodeIntegration off, sandboxed): a small `window.imperiumDesktop` bridge with `saves` (read, write, remove, list), `quit()`, `fullscreen()` and, later, `steam`.
- **Saves are JSON files** in the app's own folder (`%APPDATA%/Imperium/saves/` on Windows). Writes are atomic, with one backup; reads are loaded at start-up so `storage.js` stays synchronous.

**Build target.** `scripts/build.mjs --target desktop` writes `dist-desktop/`:
- no service worker, offline packs or install manifest;
- the platform is recorded in the build's configuration (`src/config.js`), not scattered through the game.

**Platform boundary.** A new `src/ui/platform.js` returns the web or desktop adapters:
- `src/ui/storage.js` and `src/ui/settings.js` take a storage backend: `localStorage` on the web, the bridge on the desktop. Envelopes, checksums, quarantine and history are unchanged.
- `src/ui/app.js` registers the service worker on the web only.
- On the desktop, the Menu gains **Quit to desktop** (after the save settles), and **Settings → Display** gains **Fullscreen / Window** (F11 and Alt+Enter too).
- Offline and install notices are hidden.

**Checks:**
- **CI `desktop` job** (ubuntu, `xvfb-run`): build, package for Linux, and run `npm run smoke:desktop`, a Playwright `_electron` script. The game passes New Game, reaches the camp, saves, quits and relaunches to **Continue**. It must make no network requests outside `app://` and register no service worker.
- **CI `desktop-windows` job:** packages the Windows app folder as an artifact, for the owner to try.

### S2 — The web demo (publishing it stays the owner's deployment decision)

- `scripts/build.mjs --edition demo|full`. The full edition stays the default, so tests and CI are unchanged.
- **The rules.** `advanceChapter(state,{lastChapter})` (`src/core/game.js`) refuses to go past the demo's last chapter and leaves the state unchanged. The limit belongs to the build, never the save, so a demo save is a valid full-game save.
- **The page:**
  - the Chapter III promotion becomes an **End of the demo** screen, with "Continue on Steam" (a link once the store page exists) and **Export a save code**;
  - the title page says it is a demo.
- **The download.** Models and textures for Chapters IV–XII are left out of the demo build, using the world catalog, so the download shrinks.
- **Limitation:** the rules and text for IV–XII stay in the code. This is a soft gate that a determined player could get past. A hard gate would split the chapter data and can come later if the owner wants it.
- **The desktop app** offers **Import a web chronicle** (paste a save code) on first launch.

### S3 — Steamworks (once the owner has the App ID; development can start on Valve's test app, 480)

- **steamworks.js**, in the main process only: init, `restartAppIfNecessary`, and the overlay through its Electron helper (Shift+Tab). The renderer reaches Steam only through the bridge.
- **Achievements:**
  - Earned achievements are worked out from the saved state by a pure function, `src/core/achievements.js`, with the list as data in `src/data/achievements.js`. It never grants anything: it only reads milestones the rules already record.
  - About 30 candidates, **sent to the owner for approval first**, as with the credit plans:
    - the twelve chapters;
    - the 7 decorations and 9 titles;
    - the finale's routes;
    - finishing on Veteran or under Iron discipline.
  - Their icons are rendered from existing art, with no credits.
  - The desktop app unlocks them after each save.
- **Cloud saves:** Steam Auto-Cloud on the saves folder. The owner enters the path and pattern given in `docs/desktop.md` in Steamworks, and no game code is needed.
- **Upload:** `desktop/steam/` holds SteamPipe build scripts (app and depot VDF). The owner runs the first upload to a private beta branch from the owner's PC. Steam Guard makes uploading from CI awkward, so that can come later.

### S4 — The store and the release (after 0.40.0 and the owner's Gate 4 sign-off)

- **Store art:** capsules, library images and screenshots at the sizes Steamworks lists, made from the existing illustrations and real 3D captures. If new art is needed, a costed proposal goes to the owner first.
- **A short trailer**, captured from the game.
- **Drafts for the owner to edit:** the store text from the guide, and the AI-content disclosure built from `docs/asset-manifest.json`.
- **Docs:**
  - `docs/steam-release.md`: the owner's checklist;
  - `docs/desktop.md`: build, test and upload;
  - CLAUDE.md: the desktop module boundary, new commands, and Steam kept out of the web build;
  - the changelog, the player guide and the in-game help (desktop saves, Quit, fullscreen, the demo).

Each package follows the usual routine: verify, a PR on `claude/hopeful-faraday-x8zvuo`, merge when green, confirm main's CI.

## The owner's steps (they can start now; Steam's waiting times run while the packages are built)

1. **Steamworks:** create the partner account (identity, tax, bank), pay the $100 app fee and get the App ID.
2. **The name.** Steam already lists *Imperivm RTC – HD Edition "Great Battles of Rome"*, and one listing shows a game titled "Imperium". A distinct store title, such as the manifest's **"Imperium: From Recruit to Emperor"**, and a trademark search are worth doing before the store page.
3. **Rights for a commercial release.** Check the commercial-use terms of:
   - **Tripo**, on the owner's plan, for the 3D models;
   - **the image tool** that made the illustrations ([the art record](art-generation.md): "the built-in image_gen tool");
   - **the generator** of the 14 audio files.

   The manifest says its provenance records "do not guarantee exclusive copyright, non-infringement or license ownership". Every source will be listed in `docs/steam-release.md`; this is not legal advice.
4. **Later:** the price, the release date, and the content survey.

**Costs:**
- **Steam:** $100.
- **No code-signing certificate needed:** Steam downloads don't trigger Windows' unknown-publisher warning. One would only reduce antivirus false alarms, and can be added later.
- **No Apple account,** while the build is Windows only.
- **No Tripo credits** planned.

## Risks

- **The overlay** needs Electron's GPU workarounds (steamworks.js's helper). It must be checked on the owner's Windows PC: it can't be checked in CI.
- **The demo is a soft gate** (see S2).
- **Steam rules** could not be read from the planning session; anything that differs in Steamworks takes precedence.
- **A third build to keep green.** CI covers it, but the Windows build itself is checked only on the owner's machine.
- **Steam Deck "Verified"** needs gamepad controls. They are not in this plan and can be a later release.

## Verification

- **`npm test`**, plus new tests for:
  - the storage backend (the same envelopes over both backends);
  - the demo limit (refused at the edge, state unchanged, a demo save valid in the full game);
  - achievements (pure, deterministic, never changing the state);
  - the platform adapters.
- **Every existing browser check**, unchanged on the full web build.
- **New checks:**
  - `smoke:desktop` (Electron under xvfb);
  - a demo-edition check: the end-of-demo screen, and the export of its save code.
- **On the owner's Windows PC** (a real device), through a Steam beta branch:
  - launch from Steam;
  - the overlay (Shift+Tab);
  - one achievement;
  - cloud saves across two PCs or a reinstall;
  - fullscreen, Quit, and the frame rate on Balanced.
- **Reports** keep automated checks, the desktop smoke, injected scenarios and the owner's device checks apart, and claim nothing unperformed.

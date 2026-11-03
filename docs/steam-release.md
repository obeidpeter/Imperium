# Releasing Imperium on Steam: the owner's checklist

The owner's own steps for the Steam release ([the plan](steam-plan.md)), next to the build work in [desktop.md](desktop.md). This is a working list, not legal advice. Steam's rules are to be read in Steamworks itself: the planning session could not reach Valve's partner site.

## Now (Steam's waiting times run while the app is built)

- [ ] **Steamworks partner account:** identity, tax and bank information.
- [ ] **The app fee** ($100 per game) and the **App ID**. Confirm in Steamworks:
  - whether the fee is recouped after $1,000 in sales;
  - whether there is a 30-day wait between paying and releasing.
- [ ] **The name.** Steam already lists *Imperivm RTC – HD Edition "Great Battles of Rome"* (a Roman strategy series), and one listing shows a game titled "Imperium". Choose the store title, for example the manifest's "Imperium: From Recruit to Emperor", and consider a trademark search.

## Rights for a commercial release

[The asset manifest](asset-manifest.json) records where every shipped file came from, but says itself that provenance "does not guarantee exclusive copyright, non-infringement or license ownership". A survey on 3 November 2026 found the following:

| Shipped | Made with | What the records say | To do |
| --- | --- | --- | --- |
| 112 3D models (most figures and horses, props, landmarks, rocks) and the item pictures, about 60% of the asset bytes | Tripo text-to-model and auto-rig, on the owner's paid account | A licence line in 113 manifest entries, based on the owner's statement of 2026-10-20 that paid users may exploit the models commercially. No terms text, version or plan tier is kept. The 12 rock request files have no licence field. | Save a copy of Tripo's terms for the plan used, and record the plan tier. |
| 54 illustrations (portraits, scenes, atlases) | OpenAI's built-in image tool, in the Codex app | No licence or commercial-use statement; 2 entries say provenance is no guarantee of copyright. | Check OpenAI's terms for the account used: output ownership and commercial use. |
| 14 audio files: music, ambience, foley, 4 voiced lines | Runway, with `lyria-3-clip` for music and `eleven_v3` with the provider voices Elias, Kirk, Clint and Marlene | "Provider terms… govern their respective scope." Nothing on commercial use. | Check Runway's, Lyria's and ElevenLabs' terms for the plan used, including the voices' commercial use. |
| Anatomy, hair and skin textures | MakeHuman CC0 | CC0 allows commercial use. | None. |
| Ground textures and three tree models | Poly Haven CC0, by the `asset:cc0` script | CC0, no attribution required. | None. |
| Board kits, buildings, panoramas | The project's own Blender scripts | The project's own. | None. |
| Three.js and its decoders | MIT and Apache 2.0 | The licence texts ship with the game, and the credits link them. | None. |
| Electron and Chromium (desktop only) | MIT and others | Their licences ship in the app folder. | None. |

- **Steam's content survey** asks about AI-generated content. These records are what the disclosure will draw on: AI-generated 3D models, illustrations, music, sound and voices, all made before release, with none generated during play. A draft of the disclosure text comes with S4.
- **The game's own code** has no licence chosen (`docs/LICENSE-NOTICES.md`). For a commercial release that is the owner's decision: by default all rights are reserved.
- **Out-of-date records** for the owner to review: `README.md` (the owner's) still says horses use original geometry, and `docs/LICENSE-NOTICES.md` and `docs/3d-art-provenance.md` predate the Tripo models. The in-game credits were corrected in S1.

## The free web demo (S2, built; publishing is yours)

- [ ] **Where it lives.** `npm run build:demo` writes `dist-demo/`, the site to publish (`SITE_URL` as for the full build). Give it **its own origin**, such as its own domain or subdomain:
  - two builds on one origin share its saves;
  - each one's service worker replaces the other's offline caches.
- [ ] **The store link.** Once the store page exists, rebuild with `STORE_URL=https://store.steampowered.com/app/<App ID>/...`, and the demo's last screen links to it. Until then it says the full game is coming to Steam.
- [ ] **The full web build** (`dist/`) stays for development and your playtests; nothing changes it.

## Steam features (S3, once you have the App ID)

- [ ] **The App ID in the app.** Set `"steamAppId"` in `desktop/package.json` to it (I can do this when you send it). Steam then runs inside the app.
- [ ] **The achievements.** Enter the 35 from [steam-achievements.md](steam-achievements.md) in Steamworks, each with its API name, name, description and the hidden flag. Their icons follow in S3.
- [ ] **Cloud saves.** Turn on Steam Auto-Cloud with the path in [desktop.md](desktop.md#steam-s3).
- [ ] **The first upload.**
  - Put the App ID and depot ID in `desktop/steam/`.
  - Upload with `steamcmd` to a private beta branch.
  - Set the launch option to `Imperium.exe`.
- [ ] **Steam's API library.** The app ships Valve's Steamworks API library (`steam_api64.dll`), as every Steamworks game does, under the Steamworks SDK terms that come with your partner account.

## Later (S4, after 0.40.0 and Gate 4)

- [ ] **The store page:**
  - the text, drafted from the guide;
  - capsule and library images, at the sizes Steamworks lists;
  - at least five screenshots;
  - a trailer.
- [ ] **The content survey,** including the AI disclosure.
- [ ] **The price and release date.**
- [ ] **A Coming Soon page,** public for at least two weeks before release.
- [ ] **Your device checks,** through a private Steam beta branch on your Windows PC:
  - launch from Steam;
  - the overlay (Shift+Tab);
  - an achievement;
  - cloud saves across two PCs or a reinstall;
  - fullscreen and Quit;
  - the frame rate on Balanced.

# Imperium contributor guide

The source project is a static, single-player browser game. Read [reference requirements](docs/reference-requirements.md), [historical notes](docs/historical-research.md), the Contest rules sheet and the verification summary before changing game behaviour.

The current product and repository name is **Imperium** (`obeidpeter/Imperium`). Keep original names in archived evidence, exact generation prompts and supplied source-file citations. Retain legacy save/storage identifiers for compatibility, and distinguish the Latin military oath *sacramentum* from the former product name.

## Commands

Use Node.js 20 or later. The campaign rules have no runtime dependencies. The campaign 3D views and standalone study bundle Three.js 0.186.1 and its MIT license in `vendor/three/`; no package-install step or CDN is required.

- `npm run dev` — serve the source locally.
- `npm test` — run the Node.js rule tests.
- `npm run autoplay` — run the legal-command campaign harness.
- `npm run build` — build the static site into `dist/`.
- `npm run preview` — serve `dist/` through a plain static server.
- `npm run verify` — run the tests, autoplay and production build.
- `npm run smoke` — drive the production build in headless Chromium (New Game, walking, Confirm moves, a restored expanded field, phone touch). Run `npm run build` first. It needs Playwright, which is not a project dependency: install it separately or set `PLAYWRIGHT_MODULE`. CI runs it on every pull request.

Check `package.json` for the authoritative current scripts. Build configuration, including the site address, belongs in the shared configuration/build boundary rather than hard-coded host URLs scattered through the game. Publishing, DNS and live-phone checks are the owner's next deployment steps.

## Module boundaries

- `src/core/` owns the deterministic rules, legal commands, seeded RNG, encounter transactions, campaign progress and derived access rules. It must not import browser UI, rendering, Canvas, audio, storage, network, timers, wall-clock time or `Math.random`.
- `src/data/` contains structured chapter, mission, decision, dialogue, historical and balance data. Prefer data additions over chapter-specific engine branches. The companion technical specification calls this boundary `src/content/`; this project currently names it `src/data/`.
- `src/ui/renderer.js` draws the world, units and portraits from state; it must not mutate campaign or encounter state.
- `src/ui/` and the browser shell expose accessible input, previews, screens and feedback. All gameplay mutations go through the rules command API.
- Browser-only storage, offline caching and sharing belong at the platform boundary, outside the rules core.
- `scripts/` contains build, local serving and automation tools. `tests/` verifies rules and recovery behaviour under Node.
- `docs/` records rules, provenance, verification and limitations. Private business source documents are not included in the distribution.

## Invariants and review

Invalid commands and previews must leave the entire state, including the random generator, unchanged. Never grant victory, promotions or milestones directly from an autoplay script or UI handler. Autoplay starts at New Game and uses legal commands; any injected scenario is labelled separately.

An encounter owns a complete start snapshot. Stage effects until final resolution, record a unique commit, and restore the start snapshot on retry. A reload cannot duplicate rewards, promotions or Obligations. Derive chapter access from completed milestones rather than a saved unlock flag. Preserve incompatible saves instead of silently deleting them.

Do not remove the finale's recovery floor or punish higher meters by taking away routes. A named companion's permanent fate must come from a clearly signalled decision or authored outcome, not uncontrolled allied AI.

Every recorded narrative choice needs a later visible consequence; every potentially absent cast member needs an absence or replacement branch. The oath must use one shared content entry at both ends of the campaign. Major public history remains fixed through Aurelian's death in 275; the succession then deliberately diverges.

The approved visual direction combines locally bundled original/AI-generated illustration with code-drawn tactical terrain, units and overlays. Record asset provenance, rights limitations and export settings in docs/asset-manifest.json and docs/art-generation.md. Do not add unlicensed third-party art, font or audio files. Keep the site static and free of accounts, payment, advertising or analytics integrations unless separately requested. Presentation must never mutate game state or consume gameplay randomness.

The companion technical document specifies strict TypeScript, Vite, Vitest and Playwright. The current JavaScript/custom-build stack is an explicit implementation deviation; its campaign WebGL views and standalone study use locally bundled Three.js. Do not describe the project as satisfying the specified stack requirement or claim unperformed browser/device, accessibility, timing or deployment checks.

For review reports, distinguish automated tests, real-interface play, injected scenario tests and real devices. Record meaningful limitations plainly. The 90–150 minute target needs human playtesting.

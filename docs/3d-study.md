# The frontier road — optional 3D battle

Version 0.9 adds one separate playable WebGL battle at `showcase/index.html`. The existing twelve-chapter campaign keeps its Canvas presentation, rules, progression and save handling. This is a focused graphics study, not a completed 3D conversion of the campaign.

## Play and return

Choose **Enter the 3D frontier** from the campaign title, then **Take command**. Select the recruit, choose an action and target, read the authoritative preview, and confirm. His companions act autonomously at the end of the turn. The study uses the real opening field encounter and its ordinary victory/loss conditions. It reaches that encounter by replaying legal opening commands in a separate in-memory game, rather than injecting a rank or battle outcome.

Drag to orbit, scroll to zoom, or focus the canvas and use arrows and **+ / −**. **F / Focus soldier** moves the camera toward the selected unit; **Home / Field view** restores the wide view. The named action and target selectors are an alternative to selecting terrain with a pointer. Graphics quality changes presentation only, and reduced motion skips action movement. Help and the battle record remain available below the commands.

The study does not load or write the campaign chronicle. Restart replaces its temporary in-memory battle. Reloading starts this study again; winning does not grant campaign progress. **Return to campaign** opens the normal game and its existing save.

## Static delivery and offline boundaries

Serve the project normally, or build it with `npm run build` and serve `dist/`. The static output includes `showcase/`, `src/showcase/`, `vendor/three/` and `assets/showcase/`. Three.js 0.186.1 is bundled under its MIT license, with the complete notice in `vendor/three/LICENSE`; there is no CDN or package-install step.

The campaign's initial service-worker cache and chapter downloads exclude the study-only page, renderer and textures. Visiting the study requests its dependencies. Campaign Settings' explicit **Download all chapters for offline play** includes the study as part of the complete package. A chapter-ready message alone does not establish study readiness. The build report records the separate `showcaseAssets` list and its compressed total; initial, chapter I and complete budget checks still apply.

Known page navigation loads the study's own document before the campaign-shell fallback, including the `/showcase/` directory form. No worker update is forced during an active encounter. Source preview alone does not provide a production service worker.

## Scope and limits

The study requires WebGL 2 for its scene. It renders geometric figures and environment meshes with articulated poses and local surface materials; it is not a set of photographed actors, a complete production animation library or a campaign-wide graphics replacement. Named commands remain available when scene initialization fails. Returning to the original campaign is always available.

Passing rule, module or offline-protocol checks does not establish visual quality, first-time player understanding, mobile frame rate, physical-device accessibility or long-term stability. Browser observations and measured performance must be recorded separately, with the tested hardware and revision. Artwork and vendor details are in [3D art provenance](3d-art-provenance.md) and [license notices](LICENSE-NOTICES.md).

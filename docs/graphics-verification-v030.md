# Graphics verification — 0.30.0

This records what was checked for the 0.30 graphics refinement and how. It does not claim frame rates, real-device behaviour, other browsers or human playtesting; those were not done.

## Automated checks

- `npm run verify` passed: 656 Node tests, the legal-command campaign autoplay (New Game to Augustus), the production build and the asset/offline checks.
- Chapter I is 7,278,693 bytes compressed of its 8,000,000-byte budget (0.29: 7,237,302); the first-load (443,161 of 2,000,000) and complete-campaign (10,756,746 of 24,000,000) budgets also pass.
- `tests/v030-upgrades.test.mjs` covers each new system. Among other things it checks:
  - every pair of delegate blocs stays apart under simulated protanopia, deuteranopia and tritanopia (Machado, Oliveira and Fernandes 2009), the 2D board and the 3D trims draw the same colours and letters, and trims differ in shape;
  - the grade written into tone mapping uses the finishing pass's terms and clamps and costs one direct render with no extra pass, and a partial grade update keeps the fields it does not name;
  - baked occlusion is deterministic, darkens beside standing scenery and is sampled by every environment surface on every tier;
  - followers read fixed, staggered pose banks and never all move in unison;
  - the fallen lie low, spent shafts stand clear of their mark, the caps hold and the setting hides them; ground marks follow the timeline's clock;
  - painted cards are lit and puppeted, and reduced motion holds the idle terms;
  - trails, volleys, dust, the held beat (bounded per motion) and the camera jolt (only with the action camera, never with reduced motion);
  - cloud strength by weather and setting, a deterministic field that drifts, and cloud shade on ground, scenery and figure surfaces;
  - sun-shaft counts by tier and placement, motes held under reduced motion, the mirror camera's reflected eye and oblique plane, what the mirror hides and restores, and the water shader reading the mirror by alpha;
  - story paintings: a depth map for each of the eight paintings with the painting's own shape, the chapter groups that carry them (Chapter IX's promotion painting included), weather by place and chapter, the `object-fit: cover` window, the CSS arrival curve, motion with no jump over two minutes sampled at 30 fps and within small bounds, and the controller: no canvas on Performance or with reduced motion, about 30 or 60 draws a second, the same canvas and clock across re-renders, pausing when hidden or scrolled away, and the still painting after a failed load, shader, lost context or missing WebGL, without touching `Math.random`.
- The eight depth maps regenerate byte for byte from `scripts/scene-depth.py` with the recorded model and tool versions. `scripts/verify-assets.mjs` checks their manifest sizes and hashes like every other asset.
- The atmosphere and story-painting commits were each also tested on their own tree (the v0.30 tests plus the related environment, asset and actor suites).
- Correction: the message of the commit that moved the grade into tone mapping says AgX and Neutral were compared with ACES. Only AgX had been compared (ACES and AgX at High in Chapters II, V, IX and XII); the chapter grades read flatter under AgX, so ACES stays.

## Real interface (scripted browser, software GPU)

A scripted headless Chromium session (SwiftShader) ran the actual app from the development server: New Game, then the Chapter I camp. The camp mural's canvas appeared (decorative, `aria-hidden`, no pointer events; the `<img>` with its text alternative stayed in place) and remained the same element across three story re-renders. Choosing Performance removed it and High restored it; turning on Reduced motion removed it and turning it off restored it. The first run of this check found that the Reduced motion switch left the canvas running; that was fixed before release (`mountPainting()` now runs on that switch and on quality changes). The only console error was the development server's missing `sw.js`, which exists only in the build. This was a scripted check, not a human playthrough, and software rendering says nothing about smoothness.

## Injected and synthetic scenarios

These are labelled because they are not ordinary play:

- The combat and remains screenshots replay hand-made before/after encounter states on the 3D harness's in-memory stage through its read-only `globalThis.__campaign3d` handle, slowed or frozen at timeline moments. The rules did not produce those exact states, and no save is read or written.
- Unit tests that thin a formation, lay out the fallen or hold a blow use synthetic stage inputs.
- `tests/scene-parallax-browser.html` shows any painting with any chapter's weather on a manual clock; it is development-only and outside the build.

## Software-rendered screenshots

Captured with headless Chromium using SwiftShader (software WebGL) from the development harnesses `tests/campaign-3d-browser.html` (legally reached checkpoints from `scripts/campaign-3d-fixtures.mjs`) and `tests/scene-parallax-browser.html`, except the palette figure, which is computed. They show composition and readability only; colours and anti-aliasing will differ on real GPUs.

![Bloc swatches under typical vision and three simulated dichromacies, 0.29 against 0.30](images/v030-bloc-palette.jpg)

*Delegate bloc colours under simulated colour-vision deficiency. In 0.29 the 3D Veterans and Landholders trims fell within ΔE 9 of each other under deuteranopia; in 0.30 the closest pair stays at ΔE 31 or more, and the letter and trim shape carry the bloc as well.*

![The Chapter XI chamber with stance markers showing V, L and C](images/v030-senate.jpg)

*Chapter XI chamber at High: each stance marker leads with its bloc's letter (V, L, C) before the stance.*

![Painted figures in 0.29 and 0.30](images/v030-painted-figures.jpg)

*Painted (HD-2D) figures, the same Chapter VIII view in 0.29 (the image from that release's record) and 0.30, now lit by the scene.*

![A blade trail and a whole-rank volley](images/v030-combat.jpg)

*Injected, presentation-only replays: a blade trail at the blow, and an archer rank loosing with its leader.*

![A story painting with its rain layer and depth map, and crops of rain, embers, dust and motes](images/v030-story-paintings.jpg)

*Story paintings, frames from the development harness on its manual clock: the Chapter II camp painting with its rain layer and depth map (inset), then rain behind the near reeds, embers over the burning fort, dust, and motes in the Curia's light.*

Other views were also inspected this way during development: tone mapping under ACES and AgX in Chapters II, V, IX and XII; baked occlusion in Chapters I, IV, IX and XI; formation and fallen layouts in Chapter VII; the Chapter VIII crossing and ferry; and all eight story paintings, each with the weather of a chapter that shows it.

## Not checked

- Real GPUs and devices (desktop, iOS, Android), Safari and Firefox, frame time, memory and battery. The new costs that most need real-hardware timing are the water mirror (a second scene render at half resolution on High), the story-painting canvas (a full-screen shader at up to twice the CSS resolution), cloud shade on every lit surface, the formation pose history and the one-off bakes (occlusion, fallen figures).
- Screen-reader and keyboard review of the new **Battle remains** setting.
- The 2.5D paintings in motion at real frame rates; they were inspected as single frames and through the scripted interface run above.
- The fallen, volleys and trails inside a full browser playthrough; they are covered by unit tests and injected harness scenarios only.
- Human playtesting of readability and of the 90–150 minute campaign target.

## Known limitations

- Not attempted: the authored, artist-made prop kit (it needs an artist) and the WebGPU renderer (still deferred). Code-built props remain.
- The water mirror runs only on High, with float colour targets and on the board's own water; distant water keeps its sky reflection. Sun shafts are lit geometry, not volumetric light, so they do not respond to occluders. Cloud shadows dim the direct light only and do not move the shadow map.
- The depth maps are monocular estimates at 256 × 256: thin objects such as spears and standards blur into their background and the sky is flat, so the drift is kept small. The weather layers are procedural, not painted.
- Fallen figures are baked from the overview figure, so close up they are simpler than the living.

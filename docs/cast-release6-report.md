# Worlds and gameplay, release 6: the cast in person

Release 6 of the [worlds and gameplay plan](worlds-and-gameplay-plan.md) gives the campaign's people generated bodies. Seven named men (Lucan, Varro, Sabinus, Naso, Felix, Brennus and Crispus) wear their own bodies and faces, which keep the game's blinks and expressions. The chamber's members wear the togas of three senators, each bloc's trim drawn on the toga's folded band. The camp's clerks, capsarius, orderlies and its sutler, Syra, look their part, and Roman cavalrymen have a body of their own. Roman, Gothic and eastern riders ride generated horses, which gallop at speed. Each faction paints its shields from its own designs, and the finale's massed legions move. The rules are unchanged. This report records what changed, how it was checked and what was not checked. The [changelog](../CHANGELOG.md) describes the changes for players, and the [art record](art-generation.md#the-cast-the-chamber-and-the-horses--28-october-2026) the models' sources, prompts and sizes.

How each kind of check was made:

- **Automated tests** (Node.js): `npm test`. New: `cast-identity` (a name draws only its own person; a wound only where the story gives it; the shared head blinks over its painted eyes), `shield-patterns` (each faction's designs, on the shield's face, with no new draw), `horse-bodies` (the code-built horse unchanged, the gaits by speed and the gallop's footfalls, each generated horse's records, rest pose, riders, followers, fallen horses and downloads). `actor-bodies` gains the named men's bodies and heads, the camp's staff, the senators and their trims, and plays both sides of Chapter II's decision in its exact-chapters test; `character-world-upgrade` and `v029-upgrades` the finale crowd's clips. The determinism tests A1–A4 run as before.
- **Sweeps** (Node.js, headless, on the development container): the release 3 bot plays the campaign from New Game, every battle by legal Commands, on 20 campaign seeds on each difficulty, and on Standard twice on main and twice on this release. A bot is not a player (see [Limitations](#limitations)).
- **The real interface:** the production build in headless Chromium with software rendering (SwiftShader). The stage benchmark measured the twelve chapters' turn-based stages on both qualities, on main and on this release. A scratch probe restored six real-time battles from legal checkpoints through the Restore dialog, on each side, and counted the shader programs each compiled over the three cameras. The before-and-after sheets of the named men, the camp's staff, the chamber's members and the horses, sent to the owner, were drawn by the game's own figure code in a scratch page under a simple studio light, not the game's. The scratch scripts are not committed. The other browser checks (`npm run smoke`, the polish, usability and Chapter V checks, and the twelve camps' check) run in CI on the pull request; they were not run locally.
- **Not performed:** a person playing with the new figures, and any check on a phone, a laptop or with a screen reader.

## What changed

| Change | Where it shows | Code and data | Randomness |
| --- | --- | --- | --- |
| The named men in person | Lucan in every chapter, Varro in I–III, V and VI, Sabinus in II–XII (when Lucan leaves in Chapter II), Naso in II–X and XII, Felix in III–X and XII, and Brennus and Crispus in III wear their own generated bodies, chosen by who they are and never by their kit, wherever they are drawn in 3D. Each wears the shared head wrapped onto his own generated head, so his face is his own and keeps the game's blinks, expressions and ageing. The game still draws his helmet or cap, shield, weapons and cloak. | `actor-body-catalog.js`, `actor-bodies.js`, `generated-identity.js`, `actors.js`; `wrap-cast-head.py`, `bake-maps.py` | none |
| A name draws only its own person | "Lucan's squad", "Felix's archers" and "Crispus's advocate" no longer wear Lucan's, Felix's or Crispus's face; Varro's sling and limp no longer follow him through every camp; a named leader's followers wear a plain head of their own | `actor-identity.js`, `actor-kit.js`, `formation.js`, `generated-identity.js` | none |
| Shields by faction | Each faction's shields from its own designs, a unit and its followers sharing one; Lucan, Sabinus and Varro keep their own | `shield-patterns.js`, `actors.js` | none: a unit's identity hash |
| The finale crowd | The massed legions stand watch, heads turning, and about one man in six now and then raises his spear to cheer; each man's spear stands on a joint of its own in his mesh | `environment-finale.js`, `finale-crowd-data.js`; `build-finale-crowd.mjs` | none: position hashes, as the sway's |
| The chamber's members | Every member nobody names wears one of three senators' togas, chosen by his identity; each bloc's trims, in its colour and shape, lie on the band fitted across the toga's folded band from the left shoulder, at both levels of detail. The protagonist and the named keep the procedural toga. | `actor-body-catalog.js`, `actor-bodies.js`, `actors.js`; `bind-character.py --bloc-band` | none |
| The camp's staff | Clerks and quartermasters, the capsarius and orderlies, and Syra the sutler wear their camp role's body, without a traveller's bundle | `actor-kit.js`, `actor-body-catalog.js`, `actors.js` | none |
| Horses | Roman riders (VII, IX, XII) ride a bay, Gothic riders (VII) a dun, the Persian and Palmyrene heavy cavalry (V, VI, IX) a grey under a trapper of iron scales; Roman cavalrymen wear their own body. A horse stands on its own legs' rest pose and walks, trots, canters or gallops by its speed; the code-built horse is its stand-in. | `horse-bodies.js`, `horse-frame.js`, `actor-horse.js`, `actor-gait.js`, `actor-pose.js`; `bind-horse.py` | none |
| Downloads | Each chapter's pack holds the bodies and horses its own figures wear and ride; the preloader fetches each battle's | `art.js`, `stage-preload.js` | none |

None of this draws from a random stream or changes an encounter: a body follows a figure's kit or identity, a shield design a unit's identity hash, the crowd's motion its positions, and the rules are untouched (no file under `src/core/` changed, tests A1–A4, and the sweeps below, which play exactly as on main).

## The models

The [art record](art-generation.md#the-cast-the-chamber-and-the-horses--28-october-2026) gives each model's prompt, task, sizes and review, and [the asset pipeline](asset-pipeline.md#the-cast-the-chamber-and-the-horses--2026-10-28) how they are made. In short:

- **Seventeen Tripo models** from text prompts only: seven named men, three senators, a clerk, a capsarius, Syra and a cavalryman (each rigged by Tripo's biped rig) and three horses (meshes only). The owner approved a cap of 840 credits; the release spent 755 (the balance read 3,520 before and 2,765 after). Lucan took three attempts: the first two came back in segmented plate, which the art direction rules out, and were rejected (65 credits from the 150 allowed for retries). The ledger is [`worlds-plan-credits.json`](../art-source/models/worlds-plan-credits.json).
- **The named men's faces.** [`wrap-cast-head.py`](../scripts/assets/wrap-cast-head.py) wraps the shared head (the recruit's, which carries the game's blinks and expressions) onto each man's own generated head and bakes his paint onto it. Every face was checked to blink and to differ from the others. They all keep the shared head's own paint inside the eyes, which its lids were made for.
- **The senators' bands.** [`bind-character.py --bloc-band`](../scripts/assets/bind-character.py) lays a band of 7 × 17 points on each toga, from the left shoulder by the neck to the right of the waist, 5 mm outside the frontmost surface and skinned as the cloth under it; every point found the toga. The game cuts each bloc's trims from it with the procedural toga's own bands (broad, double, broken, gilt-lined or plain), one mesh for each material at each level of detail.
- **The horses.** [`bind-horse.py`](../scripts/assets/bind-horse.py) now finds each leg, and a tail that hangs free between the hocks, by how the mesh is joined: below the hocks a leg takes all of its own piece, so a hoof's toe no longer stays with the body as the leg lifts, and the free tail is all tail. The eastern horse's ground-length tail is cut at 0.55 m. Under a test pose that swings and bends the legs and the tail, faces stretched more than 20 cm on the eastern horse fell from 75 to 4; close-up renders of its gaits show no shards.
- **Budgets.** Each body is 395,512–693,068 bytes and each horse 421,324–550,740, within the 900,000 of their requests, and every one passes `check-model` within its triangles and 1,024-pixel textures.
- **Fallback.** A figure keeps its procedural body, and a rider the code-built horse, until its model arrives, and if it fails.

### Revised after the renders

The before-and-after sheet of the chamber showed that the code-built togas on main were tinted whole in their bloc's colour, while the plain generated togas carry it only in their trims, which were then drawn at the near level only. The trims now show at the overview level too, lifted clear of its coarser toga, and are merged into one mesh for each material, so a member costs one or two draws rather than one for each band.

### Against the plan

- **The named cast.** The plan named Varro, Lucan, Sabinus, Felix, Aelia and Severianus first, and Naso, Brennus, Theon, Quintus and Paullus from the reserve. The owner approved seven: Varro, Lucan, Sabinus, Felix, Naso, Crispus and Brennus. Aelia, Severianus, Paullus, Theon and Quintus moved to release 8 and keep their sculpted faces until then.
- **Horses.** The plan priced three horses rigged by Tripo with walk, trot, gallop and idle clips, at about 85 credits each. The owner chose option A: meshes only (20 each), skinned in Blender to the game's own horse skeleton, so the game's own IK and gaits move them, with a new gallop.
- **The female civilian** is Syra the sutler, who trades in Chapters I–III.
- **Crowds.** The finale's crowd now plays the game's own clips, baked on its rig. The formations' followers already played their leader's pose history on the GPU; only their faces changed (a plain head of their own).
- **Senators** wear plain togas with the trims drawn by the game, as approved: no Tripo toga carries a bloc's colour.

## Downloads

Gzip sizes from the build report (the sum of each set's files, the service worker included; not a browser's network trace):

| Download | Limit | Main | This release |
| --- | ---: | ---: | ---: |
| First load | 2 MB | 0.88 MB | 0.88 MB |
| Chapter I in 3D | 16 MB | 11.16 MB | 13.59 MB |
| The largest chapter, with its 2D art | 24 MB | 15.82 MB (VIII) | 21.28 MB (VII) |
| The complete campaign | 80 MB | 34.40 MB | 42.97 MB |

The bodies and horses add 8.57 MB to the complete download. Each chapter's pack holds only the bodies and horses its own figures wear and ride, so its pack in 3D grows by 2.4–5.8 MB: least in Chapter I (2.4 MB) and Chapter XI (3.2 MB), most in Chapter VII (5.8 MB: Lucan, Sabinus, Naso and Felix, the staff, the cavalryman and the senators, and the Roman and northern horses). Chapter V in 3D, 13.52 MB on main, is now 18.06 MB; the largest in 3D is VII at 18.52 MB.

## Shader programs

Almost every new surface is drawn in a program the game already compiles. The named men's bodies, the senators', the staff's and the cavalryman's share the generated bodies' program, and the named men's heads the protagonist's head program. The shield designs are geometry in the shield's own material, and the finale crowd's clips replace its program with another. The counts change in four ways:

- **The named men's heads, before the fix.** This release's first stage benchmark found two programs more than main in every stage with a named man in it (Chapter I's road: 36 → 38 on Performance and 39 → 41 on Balanced, each at its ceiling). The head wrap exports a head two-sided, so each named man's head compiled a figure program and a shadow program of its own. Every generated body part is now drawn from its front, as the bodies already were, and a test checks that a named man's head compiles as the protagonist's. Every count below is after the fix.
- **The horses** are drawn from both sides as exported (see [Limitations](#limitations)). Wherever they are ridden they compile two programs: one for each rider's horse and one for a formation's followers. Their shadows use programs the scene already has.
- **The Roman riders' procedural figures are gone.** On main, Roman riders had no generated body. They were drawn as procedural figures, whose surface, anatomy, hair, beard and overview armour compiled five programs and two shadow programs. They now wear the cavalryman's body. The Gothic, Persian and Palmyrene riders wore generated bodies on main already.
- **Followers wear no one's face.** On main, a named man's followers in a turn-based formation wore his head in a program of their own. They now wear the donor's plain head, in the program the body followers already use.

### Real-time battles, Balanced

Programs after touring the follow, overview and horizon cameras, from the scratch probe that restores each battle from a legal checkpoint through the Restore dialog. This release was probed in all eighteen battles, and main in the six with horses or the finale crowd, in turn. Main's other counts are release 5's probe of the same code (`aeb5a10`), whose six battles probed again today compiled exactly the same programs. Each battle compiled the same programs in all three views.

| Battle | Programs, main → this release | Why |
| --- | ---: | --- |
| I, the road | 38 → 38 | |
| II, the marsh | 40 → 40 | |
| II, the rearguard | 41 → 41 | |
| III, the station | 36 → 36 | |
| III, the rolls | 37 → 37 | |
| IV, the gate | 43 → 43 | |
| IV, the wall | 43 → 43 | |
| V, the mine | 43 → 45 | the eastern horse |
| V, the wall | 43 → 45 | the eastern horse |
| VI, the wells | 43 → 45 | the eastern horse |
| VI, the eagle | 41 → 43 | the eastern horse |
| VII, the legion | 47 → 42 | the Roman riders' procedural figures (−7); the Roman and northern horses (+2) |
| VIII, the ferry | 46 → 46 | |
| VIII, the crossing | 46 → 46 | |
| IX, the wing | 49 → 44 | as in VII, with the Roman and eastern horses |
| IX, the city | 49 → 44 | as in VII |
| X, the road | 43 → 43 | |
| XII, the confrontation | 50 → 45 | as in VII; the crowd's program replaced by another |

The most is now 46, in Chapter VIII's two battles; the finale, at the plan's limit of 50 on main, is at 45.

### The turn-based stages

The stage benchmark (`npm run benchmark:stage -- --dist --check --max-programs 50 --ceilings scripts/stage-ceilings.json`), the still overview of each chapter's turn-based battle, on main and on this release after the fix, side by side ([report](evidence/stage-benchmark-release6.json)). The programs, Performance and Balanced; the draw calls, triangles and estimated textures and geometry, Balanced:

| Battle | Programs, Performance | Programs, Balanced | Draw calls | Triangles | Textures and geometry |
| --- | ---: | ---: | ---: | ---: | ---: |
| I, the road | 36 → 36 | 39 → 39 | 95 → 95 | 359,150 → 358,957 | 56.8 → 58.7 MB |
| II, the marsh | 38 → 38 | 42 → 42 | 100 → 100 | 343,553 → 343,717 | 63.9 → 70.6 MB |
| III, the station | 36 → 36 | 39 → 39 | 95 → 95 | 408,960 → 408,681 | 53.2 → 57.7 MB |
| IV, the gate | 41 → 40 | 44 → 43 | 126 → 126 | 530,748 → 529,940 | 66.7 → 75.2 MB |
| V, the mine | 42 → 43 | 44 → 45 | 158 → 156 | 468,420 → 464,801 | 84.1 → 95.9 MB |
| VI, the wells | 40 → 41 | 44 → 45 | 135 → 133 | 389,063 → 385,952 | 81.5 → 95.5 MB |
| VII, the legion | 40 → 41 | 43 → 44 | 144 → 142 | 621,104 → 618,627 | 74.9 → 86.6 MB |
| VIII, the ferry | 43 → 42 | 48 → 47 | 144 → 144 | 598,505 → 598,605 | 75.7 → 86.2 MB |
| IX, the wing | 40 → 41 | 43 → 44 | 145 → 141 | 487,409 → 481,663 | 81.8 → 93.2 MB |
| X, the road | 42 → 41 | 46 → 45 | 154 → 154 | 576,399 → 576,307 | 69.8 → 80.3 MB |
| XI, the accounts | 43 → 39 | 45 → 41 | 123 → 109 | 248,992 → 216,793 | 77.7 → 43.5 MB |
| XII, the confrontation | 42 → 41 | 46 → 45 | 153 → 153 | 806,311 → 798,543 | 68.4 → 80.8 MB |

<!--FILL: stage explanations-->

## Calibration

The sweeps ([Story](evidence/realtime-release6-sweep-story.json), [Standard](evidence/realtime-release6-sweep-standard.json), [Veteran](evidence/realtime-release6-sweep-veteran.json)) play as at release 5. Each plays the seed's campaign from New Game in three passes: each chapter's first decision; the decisions that change a field the other way; and every finale route from the seed's Chapter XII camp. A lost battle is retried from its checkpoint by the legal Retry command, up to once on Story, twice on Standard and three times on Veteran.

### Against the plan's targets

Each target counts the 13 battles of pass 1 and the 5 finale routes of pass 3 on each of 20 seeds: 360 battles a level.

| Target | Story | Standard | Veteran |
| --- | --- | --- | --- |
| Won on the first try: Story every one, Standard ≥ 90%, Veteran ≥ 70% | 360 of 360 | 360 of 360 | 359 of 360 |
| Won within the tries allowed (one, two, three) | 360 of 360 | 360 of 360 | 360 of 360 |
| At least three enemy plans in each battle across the seeds | every battle | every battle | every battle |
| The finale's battle lasts 8–12 of its 16 rounds | 10 rounds | 8 rounds | 8 rounds |
| The simulation's tick rises by at most 0.3 ms at p95 | see [Tick time](#tick-time) | | |

Every battle and finale route on all three levels, retries included, played exactly as in [release 5's sweeps](nature-release5-report.md#calibration). Results, rounds, slack, losses, plans, hidden squads and ambushes were the same, and only the tick times differ. Veteran's one first-try loss is the same one: Chapter VI's wells on seed 15, where a protected column was lost in round 4 and the retry won.

### Compared with main

Main (`aeb5a10`) and this release were swept on the same 20 seeds on Standard, with the same bot. The four runs went one after the other with nothing else running, main and this release twice each. Every battle and route played identically in all four. That is expected: no file under `src/core/` changed, and the figures are presentation only.

### Tick time

The simulation's tick at p95, as the mean of the two runs on each side:

| Battle | Main | This release | Change |
| --- | ---: | ---: | ---: |
| IV, the gate | 0.59 ms | 0.60 ms | +0.01 |
| IV, the wall | 0.80 ms | 0.76 ms | −0.04 |
| V, the mine | 0.91 ms | 0.86 ms | −0.05 |
| V, the wall | 0.80 ms | 0.76 ms | −0.05 |
| VI, the wells | 0.85 ms | 0.82 ms | −0.03 |
| VI, the eagle | 0.79 ms | 0.81 ms | +0.02 |
| VII, the legion | 1.19 ms | 1.17 ms | −0.02 |
| VIII, the ferry | 1.19 ms | 1.19 ms | −0.01 |
| VIII, the crossing | 1.13 ms | 1.10 ms | −0.02 |
| IX, the wing | 1.00 ms | 0.96 ms | −0.04 |
| IX, the city | 1.21 ms | 1.16 ms | −0.05 |
| X, the road | 1.19 ms | 1.19 ms | −0.00 |
| XII, the confrontation | 1.48 ms | 1.48 ms | −0.01 |

The largest rise is 0.02 ms, at Chapter VI's eagle, well within the plan's 0.3 ms. The simulation runs the same code on both sides, so these differences come from run-to-run variation on the container. Each Standard sweep took 503–516 s, against 563–613 s at release 5, so today's times compare only with each other.

The Story and Veteran sweeps ran together on the container's four cores, and their own tick lines compare each battle with the Gate 4 sweep, a Standard sweep recorded on a faster container. They report NOT MET (Story +0.49 ms at Chapter VIII's ferry, Veteran +0.43 ms at its crossing), so each run exited with a failure, but those times are not comparable and are not the plan's measure. None of these times is a phone's: the budget there is 4 ms at p95 on a 2022 phone, and no phone has been measured.

## Limitations

- **Faces.** Each named man's face is his generated head's shape and paint carried onto the shared head. They were compared with one another and with their Tripo renders, not with the campaign's portraits by a person; whether each reads as the man in his portrait is for the plan's Gate 4 play-through. Inside the eyes every named man keeps the shared head's own paint, so their eyes are alike.
- **The chamber from behind.** The trims lie on the front of the toga, along its folded band. On main the drawn toga was tinted whole in its bloc's colour, so it showed from any side; a member seen from behind now shows his bloc only by the letter on his stance marker. The protagonist and the named keep the drawn toga and its trims.
- **Dress the generated models got wrong.** As the [art record](art-generation.md#reviewed-before-shipping) notes, the senators wear sandals and togas to the knee, where a third-century senator's toga reached his feet and he wore closed shoes, and Crispus's and the clerk's tunics are short-sleeved; they were kept.
- **Horses.**
  - The horses are drawn from both sides, as exported: 7.5% of the eastern horse's overview surface (1% of its near surface) is wound against its own normals, most of it across the body where the scale trapper hangs, so drawn from one side it would show holes. A horse therefore compiles programs of its own in the battles where it is ridden (see [Shader programs](#shader-programs)).
  - Under the binder's test pose, 4 faces of the eastern horse still stretch by more than 20 cm. The close-ups of its gaits showed no shards, but not every pose of every battle was looked at.
  - The eastern horse's trapper leaves a raised seat under the game's saddle, and the northern horse is larger than the stocky breed its prompt asked for, as the binder scales every horse to the game's horse skeleton.
- **Downloads.** Chapter VII's pack with its 2D art, at 21.28 MB, is the nearest to its 24 MB limit. Release 8's five named cast and release 9's landmarks add to the chapters' packs; as the plan says, textures go down a level, or more is shared, before any limit is raised.
- **Software rendering.** Programs, draw calls and triangles are counts, which depend little on the device. The times in these checks are SwiftShader's and say nothing of a phone's or a laptop's frame rate. The plan's device targets have not been measured: 30 fps on mid-range phones on Performance, and 60 fps on integrated-graphics laptops on Balanced.
- **A bot is not a player.** The sweeps check that the rules are untouched; they do not look at the figures. How the new people and horses read in play is for the plan's Gate 4 play-through.
- **Not checked:**
  - a person playing with the new figures;
  - the figures on a phone, a laptop or with a screen reader;
  - the camps, chamber and battles on High beyond the automated tests.

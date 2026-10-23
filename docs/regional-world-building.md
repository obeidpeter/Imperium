# Regional world-building rollout

The owner approved the Chapter V pilot and expansion across the remaining eleven chapters on 23 October 2026, with a separate allowance of up to 600 additional Tripo credits. The pilot's unused allowance is not transferred to this rollout.

## Places and play

| Chapter | Regional setting | Working spaces and readable landmarks |
| --- | --- | --- |
| I — The Oath | Danube garrison | Tiled barracks, raised stores, drill yard, cook station and equipment maintenance |
| II — First Blood | Flooded withdrawal route | Reeds, raised shelters, duckboards, damaged baggage and casualty supplies |
| III — Under the Eagle | Frontier road station | Courier table, storehouse, well and quiet service courts |
| IV — Hold the Line | Fort above the ford | Timber gate, watch platform, signal beacon and preparation court |
| V — The Centurion | Euphrates fortress | Approved fortress, mine works, river gate and staging courtyard |
| VI — The Broken Standard | Exhausted retreat camp | Damaged baggage, windbreaks, medical supplies and the rally standard |
| VII — A Legion to Lead | Italian marching camp | Command pavilion, tent lines, courier station and baggage shelters |
| VIII — Beyond the Frontier | Evacuation waterfront | Mooring jetty, landing stairs, ferry, household bundles and riverbank shelters |
| IX — Rome's Sword | Eastern approaches | Reused fortress masonry, colonnades, caravan baggage and water trough |
| X — The Province | Agricultural and civic court | Raised granary, relief transport, market shelter, press and tribunal portico |
| XI — The Senate | Roman administrative quarter | Archive, colonnades, fountain, audience approach and service courtyards |
| XII — The Purple | Roman accession approaches | Checkpoint arch, apsidal hall, standards, command table and civic frontage |

Every chapter has a preparation hub. Walking and conversations are optional: the chapter decision, preparation, equipment, company and departure remain directly available. The hubs are peaceful, and invalid forced attacks are rejected before they mutate the simulation. Short local descriptions and existing campaign decisions establish purpose without adding a new currency, survival loop or fetch quest.

Equipment, training, adoption and appearance changes refresh the camp soldier while preserving the player's position. Unrelated purse changes, pack sorting and conversation flags do not reload the camp. Legacy chronicles can mount using the existing temporary soldier without changing the saved record or adopting training on the player's behalf.

Four cosmetic routines—watch, work, carry and rest—animate service actors in place. They pause near the player, respect reduced motion and do not move actors or add navigation obstacles. Existing decisions, administration and successful committed encounter records drive visible details and concise callbacks; failed encounters cannot create completed outcomes. Character absence and replacement follow existing campaign facts.

These consequences use small symbolic motifs: paired or sealed tablets, allocation tallies, water vessels, bundles, tools and a mentor's vine stick or letter. They do not recreate every object named in the story text. Selected orders and preparations are shown as intentions; completed field details require both a won history entry and its committed command record. A named route in the narrative does not open an extra playable path, and the distant buildings are scenery rather than enterable interiors.

The watercraft are scenery. The landing and ferry do not introduce a boarding or sailing mechanic. The settings remain fictional, historically informed composites rather than archaeological reconstructions.

## Art and runtime structure

Five new original Blender kits add sixty modular components to the approved sixteen-piece eastern fortress kit. The five kits contain **34,592 triangles and 2,024,380 runtime bytes** in total. Region-specific building forms share a limited palette of locally authored materials, with at most four materials per kit. Source `.blend` files, deterministic builders, component bounds, processing reports and runtime hashes are retained. Sixteen selected original-prompt Tripo props add **4,294,648 runtime bytes** and supply readable objects used across selected chapters; raw source downloads stay outside version control. These are uncompressed file-size sums, not browser transfer measurements.

Architecture respects the full rules-board rectangle, including expanded real-time maps. Interior props require complete, explicitly blocked service pockets. Each new hub has three 5 × 5 m pockets; generated objects fit the main area while committed-detail motifs occupy a separate strip. Model bounds, placement scale and ground pivots keep surrounding solids out of walkable cells. Loaded meshes cannot become accidental picking targets. Each regional replacement retains its procedural fallback until that particular model succeeds; Performance mode keeps simpler architectural and service representations without loading the detailed models. Chapter V keeps its approved layout and placement rules.

Building fronts face the existing approaches. The final equipment rack and archive cabinet were checked from four cardinal views: both useful fronts face local +X. Their authored rotation faces the board from exterior baggage rows, or the service approach inside a pocket. Other prop orientations remain individually authored. Distant river channels move beyond the full map boundary on expanded boards, preserving the authored ground height inside the playable rectangle.

Follow uses a separate structural clearance query, so scenery can stay excluded from movement picking while still protecting the camera view. It checks the current actor position, repeats after meaningful movement or model arrival, and yields to manual camera adjustments. Critical-hit close-ups temporarily suspend those checks and restore them afterward; manual camera choices cancel the close-up without restoring an obsolete distance. Distant landmarks are grounded against the rendered terrain triangles. Terrain, silhouettes and panorama share weather-dependent fog, keeping hills connected to the foreground rather than exposing detached background strips.

Regional assets belong only to the chapter packs that use them. Runtime GLBs use meshopt geometry compression and mipmapped KTX2 textures. Shared leases and bounded idle caching allow chapter changes without retaining the entire campaign's models. Existing download limits remain 2 MB initial, 12 MB Chapter I 3D, 14 MB per chapter and 50 MB complete.

## Sound

Real-time footsteps follow actual movement distance and terrain, distinguishing paving, soil and water. Quiet river, wind and workshop cues use original local synthesis and the existing ambience setting. Sheltered services soften the existing ambient mix. Pause, retry, hidden pages, mute and scene disposal prevent delayed cue bursts. This is restrained sound direction, not a physical acoustic simulation or newly recorded score. Visual landmarks and controls remain usable without sound.

## Spending and verification

The source of truth for approved, reserved and consumed credits is `art-source/models/regional-world-credits.json`. Each request retains its task ID and reported charge; resumed tasks reuse that ID. **17 tasks consumed 340 of the 600 approved credits; 260 remain unused and none are reserved.** The balance changed from 4,100 to 3,760. Sixteen final props were selected; the first equipment rack was rejected for its helmet silhouette and replaced once. The cookstation's support repair was local Blender work with no additional generation charge.

The final production build is `bec5ebc44939`: **435 files**, **807,033 initial gzip bytes** and **26,597,932 complete gzip bytes**. Build and asset/offline validation pass within the existing download limits. The final Windows Node 24.19.0 suite passes **1,185 tests**, with no failures, skips or cancellations.

Full twelve-hub Chromium acceptance ran on `0884476d18a4` and passed **21 checks**, with **18 reviewed captures**, **16 resource-residency snapshots** and no unexpected browser errors. Every chapter loaded its regional models, all three camera modes worked, and previous scenery retired. Direct services, panel Back, peaceful controls and 390 px layouts passed in Chapters I, VIII and XII. Performance mode released all detailed scenery; returning to Chapter I matched the original cache. Deliberately failing all nine requested model downloads still left a rendered procedural camp with movement and direct services. The final build retains that art and layout and adds the legacy-save, camp-soldier refresh and critical-hit camera fixes described above. Those fixes have focused regression coverage and are included in the final Node suite. The final Chromium legacy scenario also verifies immediate adopted-soldier refresh and unchanged camp position.

All six final browser groups pass on `bec5ebc44939`, using Chromium **155.0.8059.82** with software WebGL: the broad smoke test, **20 real-time polish checks**, **9 usability flows**, **9 Chapter V pilot checks**, the twelve-chapter benchmark (**13 scenes and 5 check groups**), and **4 stage benchmark runs** across Chapter V/XII and Performance/Balanced. The stage runs report zero first-frame or later gameplay shader compiles, with generated character bodies present. The broad smoke and chapter benchmark have no page or console errors. Fifteen legal-command campaign runs cover the base, expanded, command and production routes through all twelve chapters. Runtime character, production-character and asset/offline audits pass.

The final manual Windows spot-check used the in-app Chromium browser on Intel graphics, restoring a legally earned Chapter VIII save through the visible interface. All **14 scenery placements** and **9 generated character bodies** loaded in Balanced. Ground-click walking, Horizon/Follow/Overview, the supply orderly conversation, the quartermaster service, Back, Resume and Pause worked. The preview is left paused in Horizon. This is a camp spot-check, not another uninterrupted campaign playthrough. This Intel camp session reported **one first-frame program compile** and a nonfatal Direct3D gradient-in-loop shader warning, with no page error or observed rendering failure; the software stage measurements above do not establish identical driver behavior.

The optional character-art handoff audit still reports older offline source exports. Runtime character audits pass; re-export those handoff files before a future character-art handoff. This record describes local verification before publication; GitHub CI results belong to the subsequent pull request. No deployment was performed.

The compact verification record is [regional-world-rollout.json](evidence/regional-world-rollout.json). Full logs, captures, legally earned checkpoints and the manual Windows screenshot are retained locally in `work/regional-world-review`, outside the repository.

The Windows validation scope includes rules, exact retry/save behavior, all-hub route access, compressed asset integrity, offline groups, Chromium smoke and usability flows, all twelve chapter benchmarks and repeated scene-resource transitions. Browser phone-sized layouts are separate from physical-device testing. Phone hardware and first-time-player testing remain the owner's planned follow-up; this rollout does not certify a 60 FPS target or human usability outcome.

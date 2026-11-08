# A substantially better-looking game, from Tripo credits — the approved plan

The owner approved this plan on 8 November 2026, with the recommended answer to each of its four decisions. It spends at least 70% of the Tripo balance on the game's graphics.

Each release's changelog entry records what it actually delivered, spent and measured. Where it and the plan differ, the changelog, the credit ledgers and the code are authoritative.

## The budget

| | Credits |
| --- | --- |
| Balance on 8 November | 10,700 |
| 70% minimum | 7,490 |
| **This plan's cap** | **7,900 (73.8%)** |
| Kept back | about 2,800, for fixes after Gate 4 and the final store media |

- **Spent before this plan:** 4,300 credits.
- **What they bought:** 112 shipped models:
  - 17 soldier bodies, 12 cast members and 3 horses;
  - 70 props, landmarks and rocks;
  - 35 item models, shipped only as 2D pictures.
- **Measured unit costs:**
  - 20 credits per textured model and 25 per biped rig, over 170 generations and 36 rigs;
  - 8% of past attempts were rejected.
- **Unknown prices:** Tripo's prices for detailed textures, Ultra geometry and the clean-topology P-series are not yet known. Step 0 measures them, since every task reports the credits it consumed.
- **How the plan holds:** each release has a fixed credit cap, and its counts follow the measured prices.

## Status

| # | Release | Cap | State |
| --- | --- | --- | --- |
| 0 | Use what's paid for, then calibrate | 250 | in progress |
| G1 | Armies | 2,300 | after step 0 |
| G2 | Arms and standards | 700 | |
| G3 | Camps | 1,300 | |
| G4 | Animals | 600 | |
| G5 | Battle and siege | 900 | |
| G6 | Faces and people | 1,100 | |
| G7 | Backdrops | 750 | |
| | **Total** | **7,900** | |

## What the game shows today, and where it falls short

- **Factions look alike:**
  - each enemy faction has 3 bodies for its 5–7 unit types;
  - all 11 champions share their faction's bodies;
  - rival Romans wear the player's own soldiers' bodies.
- **Code-built kit:** weapons, shields, helmets and standards are code-built.
- **No animals** other than horses. Carts stand unharnessed.
- **Flat camps:** the camps are flat service courts with code-built tents.
- **Missing set pieces:** there is no artillery, and the council, parley and tribunal are code-built.
- **Faces** have low-resolution paint, and all the named men share one eye paint.
- **Landmarks** have 256 px colour maps only, so they look flat up close.

## Step 0: use what's paid for, then measure (cap 250 credits)

1. **3D weapons, shields and helmets, at no credit cost.** The 39 item models generated for the inventory become held and worn kit. Code-built kit stays the fallback.
2. **Landmarks re-textured, at no credit cost.** They go from 256 px colour-only maps to 512–1,024 px with surface maps, from the original downloads.
3. **Calibration.** About 10 test assets, each made at the cheap tier and the expensive tiers:
   - a soldier, a tent, a building and a shield;
   - a mule, rigged on four legs and walking;
   - a cast bust.

   Each is processed to the game's budgets and shown in the game, and the owner picks the tier for each category. The default is standard for troops and props, and detailed only where the camera comes close.

The original downloads (7.3 GB, not in git) exist only in the working container. So the two credit-free upgrades come first, and step 0 checks whether Tripo still serves them by task ID.

## The releases

Each release is its own PR. A pilot of about 15% goes to the owner before the rest is generated.

| | Release | What it adds | Count |
| --- | --- | --- | --- |
| G1 | Armies | 34 rigged bodies (below), plus 3 horses that fix the cataphract trapper and the oversized northern horse | 37 |
| G2 | Arms and standards | Helmets (ridge, spangenhelm, Persian, Palmyrene, centurion), faction shields, bows, lances and maces; standards (draco, vexillum, imperial portrait, Persian banner) | 30 |
| G3 | Camps | Tents (contubernium in three states, officers', praetorium, hospital, eastern pavilions); towers, gates, ovens, granaries and horse lines; racks, carts, barrels, amphorae and training posts; the council, parley, tribunal and ceremony sets | 54 |
| G4 | Animals | Mules, oxen, camels, dogs, goats and sheep, rigged on four legs and walking; carts harnessed | 10 |
| G5 | Battle and siege | Onager, ballista, scorpion and cart-mounted ballista; siege tower, ram shed, mantlets and the Gothic wagon laager; regional palisades and stakes; the code-built field objects; battlefield debris; river boats | 40 |
| G6 | Faces and people | 12 detailed cast busts, their faces baked onto the shared animated head; bodies for Vibia, Dida, Caecilia, Licinia and the smith; 3 civilians; correct full-length togas | 24 |
| G7 | Backdrops | Temple of Bel, tetrapylon, Euphrates bridge, Danube fort gate, roadside tombs, aqueduct, triumphal arch, Milvian bridge, villas and shrines | 20 |

G1's 34 bodies:

| Side | New bodies |
| --- | --- |
| Gothic | 8 |
| Persian | 5 |
| Palmyrene | 5 |
| Rival Romans | 4 |
| Roman specialists: Moorish and Dalmatian cavalry, a draco-bearer, a centurion | 4 |
| Unique champions | 8 |

Each cap includes about 10% for rejected attempts. Some things stay out of Tripo:
- the Colosseum, which failed three times there, gets a Blender build;
- terrain, trees and water stay with the existing code and Blender kits.

## Around every release, at no credit cost

- **Pipeline:**
  - a batch runner with a credit cap per batch, which stops on the first failure;
  - Blender processing into near and far detail levels, compression and budget checks.
- **Rendering:**
  - one draw call per repeated prop (instancing);
  - texture atlases per camp;
  - imported art keeps one shader program.
- **Placement and invariants:**
  - layouts come from data and use decorative cells only, so walkability and the rules never change;
  - presentation never consumes gameplay randomness;
  - every model keeps its code-built fallback.
- **Checks:**
  - tests that every unit type has a body and every camp its props;
  - draw-call and triangle ceilings raised only on purpose, with the reason recorded;
  - the browser checks.
- **Records:**
  - the asset manifest, the provenance notes and the credit ledgers for every task;
  - the Steam AI disclosure, regenerated.
- **Store media:** the screenshots and the trailer are taken again once the releases land.

## The owner's decisions (8 November)

1. **The budget:** 7,900 credits, keeping about 2,800.
2. **Downloads:** the full set ships in the desktop app, which has no download limit. The web builds take what fits their current limits:
   - Chapter I's 3D load stands at 16 of 18 MB;
   - the whole campaign stands at 55 of 80 MB.
3. **Timing:** step 0 starts now, in parallel with Gate 4. Nothing here changes the rules.
4. **Review:** each release's pilot goes to the owner before the rest is generated.

## Rules for the spend

- **Approvals:**
  - no task is created before its release is approved;
  - step 0's comparison comes before any bulk spend;
  - each pilot comes before the rest of its release.
- **Caps:** no cap is exceeded without asking.
- **Stop rule:** if more than 20% of a release's attempts are rejected, the release pauses and the owner is told.
- **Process:** every paid task runs `--dry-run` first, and recovery never creates a replacement ([the pipeline](asset-pipeline.md), [Tripo V3](tripo-v3-migration.md)).

## Risks

- **Higher-tier prices** are unknown until step 0. Counts may shrink; the caps don't move.
- **The original downloads** live only in the working container. If it is reclaimed, the free upgrades depend on Tripo still serving the outputs.
- **Rights:** Tripo's commercial terms for the owner's plan are on [the release checklist](steam-release.md). They should be confirmed before the bulk releases.
- **Style and history:**
  - generated models drift, and the togas and sleeves were wrong before;
  - prompts fix the 3rd-century kit, and every release is reviewed.
- **Performance evidence is thin:**
  - the only real device measured, an Intel integrated GPU, ran Balanced at about 33 ms a frame;
  - new scenery shows on Balanced and High;
  - Performance, the phone default, keeps loading bodies and horses only.
- **Scale:** about 225 models with their integration is a programme of several weeks. It runs alongside Gate 4 and does not change the road to 0.40.0 ([the Steam plan](steam-plan.md#the-road-to-0400-and-steam-revised-8-november-2026)).

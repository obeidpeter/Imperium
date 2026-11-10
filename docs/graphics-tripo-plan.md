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
- **Prices unknown at approval:** Tripo's prices for detailed textures, Ultra geometry and the clean-topology P-series were not yet known. Step 0 measured the first two (30 and 40 credits a model) and found P2's in Tripo's changelog (110 with standard textures): [the calibration](graphics-calibration.md).
- **How the plan holds:** each release has a fixed credit cap, and its counts follow the measured prices.

## Status

| # | Release | Cap | State |
| --- | --- | --- | --- |
| 0 | Use what's paid for, then calibrate | 250 | done: calibrated (190 credits, [results](graphics-calibration.md)), and the 3D kit made (seven weapons and helmets, no credits); the landmarks' re-texture skipped |
| G1 | Armies | 1,005 | done: the [pilot](#g1s-pilot-8-november) (310 credits) and [the rest](#the-rest-of-g1-9-november) (695): 22 bodies and 2 horses. Its other 1,295 credits went to G3 and G5 |
| G2 | Arms and standards | 700 | |
| G3 | Camps | 2,400 | done: [the tent lines](#g3s-tent-lines-9-november), with no credits, [the pilot](#g3s-pilot-9-november) (180 credits) and [the rest](#the-rest-of-g3-9-november) (380): 26 models. Its other 1,840 credits are [held for the releases after it](#what-g3-leaves) |
| G4 | Animals | 600 | |
| G5 | Battle and siege | 1,845 | done: [the pilot](#g5s-pilot-9-november) (140 credits), [the first batch](#the-rest-of-g5-the-first-batch-9-november) (440) and [the last](#the-last-of-g5-10-november) (80): 28 models. Its other 1,185 credits [join G3's held 1,840](#what-g5-leaves) for G4, G6 and G2 |
| G6 | Faces and people | 1,100 | |
| G7 | Backdrops | — | skipped by the owner; its 750 credits went to G3 and G5 |
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

   Done on 8 November with seven of them: the spatha, gladius, knife, axe, galea, Niederbieber helmet and felt cap, worn by figures dressed in those items (the player's soldier, his companions, named veterans and his squads). The crowds keep the code-built pieces, which read more clearly at the field's distance. The spangenhelm hides the face; spears, bows, slings and the shields, with their unit designs, stay code-built. The armour and clothes are the generated bodies' own. [The changelog](../CHANGELOG.md) has why.
2. **Landmarks re-textured, at no credit cost.** They go from 256 px colour-only maps to 512–1,024 px with surface maps, from the original downloads.

   Skipped by the owner on 8 November, as the calibration recommended: in the game's Horizon view the landmarks are a few pixels high, and the re-texture would add about 10 MB for nothing visible.
3. **Calibration.** About 10 test assets, each made at the cheap tier and the expensive tiers:
   - a soldier, a tent, a building and a shield;
   - a mule, rigged on four legs and walking;
   - a cast bust.

   Each is processed to the game's budgets and shown in the game, and the owner picks the tier for each category. The default is standard for troops and props, and detailed only where the camera comes close.

   The owner chose standard textures for every category on 8 November, with standard geometry.

   Done on 8 November for 190 credits: [the calibration](graphics-calibration.md) recommends standard textures throughout, animals bound to the game's own skeleton, and a face pilot that starts from a picture. In the game's Horizon view the landmarks are a few pixels high, so it recommends against item 2 and asks the owner to reconsider G7.

The original downloads (7.3 GB, not in git) exist only in the working container, so the two credit-free upgrades come first. Tripo still serves them by task ID: on 8 November a task from 2 November downloaded again, identical to its recorded SHA-256.

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
| G7 | Backdrops (skipped) | Temple of Bel, tetrapylon, Euphrates bridge, Danube fort gate, roadside tombs, aqueduct, triumphal arch, Milvian bridge, villas and shrines | — |

G1's 34 bodies:

| Side | New bodies |
| --- | --- |
| Gothic | 8 |
| Persian | 5 |
| Palmyrene | 5 |
| Rival Romans | 4 |
| Roman specialists: Moorish and Dalmatian cavalry, a draco-bearer, a centurion | 4 |
| Unique champions | 8 |

### G1's pilot (8 November)

Seven bodies and a horse, one for each of G1's categories, in the game for the owner's review:

![Each pilot body beside the body its type wore before, in the game's actor viewer at High](images/g1-pilot-bodies.jpg)

| Category | Body | Worn by | Chapters |
| --- | --- | --- | --- |
| Gothic | a young skirmisher, step 0's calibration body (no credits) | the skirmisher who marches on with the reinforcements | I, II |
| Gothic | a war-band spearman in a leather jerkin and segmented helmet | the war bands' infantry | II, IV, VII, VIII |
| Persian | a skirmisher in linen and a felt cap | the raiders | VI |
| Palmyrene | a spearman in a leather corselet over linen | the infantry | IX |
| Rival Romans | a legionary in mail over an off-white tunic | the claimant's civil-war cohorts | XII |
| Roman specialists | a Moorish horseman | the Roman cavalry of the Palmyrene war | IX |
| Champions | the war band's chieftain, with his torc | the gate battle's champion | IV |
| Horses | a chestnut cataphract's horse under bronze scales, flat along the back | the Palmyrene cataphracts | IX |

- **Credits:** 310: six rigged bodies (45 each), the horse (20), and one rejected generation redone (the first rival legionary came out in segmented plate). [The ledger](../art-source/models/graphics-g1-credits.json) has every task.
- **How a body is chosen:** by what the rules made the unit (its role, a skirmisher's or a claimant's name, a champion's id), in presentation only; a type's body is matched before its faction's.
- **Downloads:** Chapter I's download is now 17.2 of its 18 MB, so at most two more of Chapter I's bodies fit the web build at the bodies' 1,024-pixel maps. The rest can take the cast's 512-pixel maps, as release 8 did, or ship in the desktop app only, as decision 2 allows.
- **In battle:** the change is modest at the battle camera ([the art record](art-generation.md#in-battle) has the method).
  - A figure stands about 70 to 100 pixels tall in a 1,080-pixel frame, and its shield covers much of its body.
  - What reads is a figure's outline and its main colours: a helmet or a bare head, light cloth or dark armour, a horse's coat.
  - The clearest gain is Chapter XII, where the claimant's cohorts no longer look like the soldier's own men.
  - Close up, in the actor viewer, every body is plainly its own.

  ![Four battles before and after the pilot, crops at the game's own pixels in the desktop build at High](images/g1-pilot-battles.jpg)

**Proposed for the rest of G1, and approved by the owner on 9 November** ([what was made](#the-rest-of-g1-9-november)). G1 had 1,990 credits left.
- **Now, about 1,200 credits** (1,075 at the measured prices, and the plan's 10% for rejected attempts):
  - **a body for every unit type still without one (23):**
    - Gothic: the axe raider, the spearman, the band's war leader, the shield guard and the horseman;
    - Persian: the spearman and the guard;
    - rival Romans: the guardsman, the archer and the horseman;
    - Roman specialists: Dalmatian cavalry, a draco-bearer and a centurion;
    - the other ten champions. The mounted Palmyrene officer is drawn on foot today, and would ride.
  - **two horses:** the northern horse remade at its own smaller size, and a Persian horse in iron lamellae, apart from the Palmyrene bronze.
  - Each prompt gives its type a headgear and a main colour of its own, since those are what read in battle. Each body is seen at the battle camera before it ships.
- **Afterwards, about 500 credits:** a second body for the crowds seen most (10).
  - Each squad would wear one of its type's bodies by its identity, so neighbouring squads differ: the war bands, the raiders, the Persian and Palmyrene spearmen, the claimant's legionaries, and the soldier's own legionaries, archers and cavalry.
  - It is decided once the new type bodies have been seen in battle, because it is the part least likely to show there.
- **Chapter I's web download:** the bodies that do not fit take 512-pixel maps. A figure 100 pixels tall cannot show a finer one.
- **At no credit cost:** the claimant's cohorts could carry shield markings of their own. Their shields are still the soldier's men's.

### The rest of G1 (9 November)

The owner approved the pilot and the proposal above on 9 November. Fifteen bodies and a horse were made, reviewed and shipped:

| Category | Body | Worn by | Chapters |
| --- | --- | --- | --- |
| Gothic | a war leader, bare-headed in red, with a torc | the war leader of a band that fights alone | I–III |
| Gothic | a shield guard in a checked tunic and a segmented helmet | the shield guard (he wore the noble's body) | IV, VII |
| Persian | a spearman in a leather jerkin over saffron linen | the spearmen (they wore the guard's scale coat) | V |
| Rival Romans | an archer in off-white padding with the claimant's purple | the claimant's archers (they wore the soldier's archers' body) | XII |
| Roman specialists | a Dalmatian horseman in mail over dark green, with a red scarf | the soldier's cavalry in the finale | XII |
| Champions | a body each for the ten who had none | the wall's war leader (IV), the sapper captain (V), the captain of the pursuit and the standard-breaker (VI), the mercenary captain (VII), the crossing's champion (VIII), the armoured officer, who now rides, and the city's captain (IX), the raiders' chief (X) and the claimant's guard captain (XII) | IV–XII |
| Horses | a dark bay under iron lamellae, flat along the back | the Persian cavalry, in place of the first eastern horse | V, VI |

- **Credits:** 695 of the batch's 780-credit ceiling: fifteen rigged bodies at 45 and the horse at 20. No generation was rejected. [The ledger](../art-source/models/graphics-g1-credits.json) has every task.
- **Not made: 8 of the proposal's 23 types.** The game's own data showed:
  - four already wear a body of their own: the Gothic raider, the war bands' spearman (the pilot's), the Gothic horseman and the Persian guard;
  - four are not units in the game: a rival guardsman, a rival horseman, a draco-bearer and a centurion.
- **The northern horse** is not remade. The binder sets every horse's back to the game's one saddle height, so a smaller remake would come out the same size. A smaller northern horse needs runtime work, with its rider lowered, and no credits.
- **At no credit cost:** the claimant's cohorts and archers carry his purple on their shields, with designs of their own.
- **Downloads:** Chapter I's download is 17.5 of its 18 MB, with the war leader at 512-pixel maps. The largest chapter's (XII) is 27.5 of 28 MB, and the complete game 65.2 of 80 MB.
- **In battle** ([the art record](art-generation.md#in-battle-1)): whole squads in a colour of their own read best, the Persian spearmen's saffron and the claimant's archers' off-white, and so does the armoured officer, now mounted. A champion reads as the one figure in his own colour; the dark bodies (the shield guard, the sapper captain, the mercenary captain) barely differ from before. The claimant's purple shields read more than any body.

  ![G1's remaining bodies at the battle camera, crops at the game's own pixels in the desktop build at High](images/g1-rest-battles.jpg)

**Left of G1: 1,295 credits, moved on.** On 9 November the owner left the rest of the plan to my judgement ([decisions 8–11](#after-g1-9-november)):
- the second bodies for the crowds (about 500 credits) are not made. At the battle camera a figure reads by its outline and main colours, which its type's body already gives, and Chapter XII's download has 0.5 MB left;
- G1's remaining credits go to the camps (G3, 700) and to battle and siege (G5, 595), so the plan still spends at least 70% of the balance.

Each cap includes about 10% for rejected attempts. G3 and G5 have G7's credits too: each pilot proposes how many more of its own list they buy. Some things stay out of Tripo:
- the Colosseum, which failed three times there, gets a Blender build;
- terrain, trees and water stay with the existing code and Blender kits.

### G3's tent lines (9 November)

G3 starts with its credit-free layer: the camps' tent lines, open ground until now, are pitched with the leather tent generated for Chapter V's supply camp in 0.36. The pilot's tents then replace it on the same pitches.

- **The pitches** are data (`src/data/camp-regions.js`): two cells of tent-line ground a tent, in rows a street apart, each pair facing across its street, with an alley every four tents. A tent keeps 2 m from any spot a person, object, place or way out can take. That leaves 23 tents in Chapter I, 13 in II, 12 in III, and 1 to 6 in IV, VI–IX and XII, whose tent lines are small and crowded; 67 in all.
- **Walking:** a pitched tent is solid. The camp map's `blocked` tiles keep their ground's name, so the ground, the 2D view and the rules' terrain are unchanged, and every target stays reachable in every variant tried.
- **Drawing:** one instanced draw for each of the model's meshes carries every tent in a camp, which the plan asked of repeated props. A code-built tent stands on each pitch on Performance and until the model is ready.
- **Downloads:** the tent (231,056 bytes) joins the packs of the nine chapters with tent lines.
- **What the pilot needs from it:** the smaller camps (IV–IX, XII) fit only a few tents on their board, so their pilot tents also need ground beyond the walls, where the camp continues.

![Chapter I's and Chapter VII's camps before and after the tent lines, in the source tree at High: Chapter I's Overview camera, the soldier walked to a tent line by an ordinary move, and Chapter VII's wide view](images/g3-tent-lines.jpg)

### G3's pilot (9 November)

Eight camp models, about a seventh of G3's list, made and reviewed in the game before the rest of G3 (decision 9):

| Model | Where it stands | Chapters |
| --- | --- | --- |
| a timber palisade section | along every wall cell of the timber camps, stretched to fill each straight run | I, II, III, VII, VIII, X |
| a timber watchtower | on each corner of those walls, and at each end of a wall that opens on a gateway | I, II, III, VII, VIII, X |
| an officers' tent | beside the principia | I, III, IV, VI, VII, VIII, IX, XII |
| a struck tent, rolled with its poles | beside the quartermaster | II, VI, VIII |
| empty horse lines | beside the quartermaster | VII, IX, XII |
| a training post with a wicker shield | beside the drill ground | I, III, IV, VII |
| the quartermaster's stores under a hide | beside the quartermaster | I–IV, VI–X, XII |
| a raised timber granary | beside the quartermaster | IV, X |

- **Credits:** 180 of the pilot's 200-credit ceiling: eight generations at 20, and one rejected and redone (the first horse lines had toy-like horses in them). [The ledger](../art-source/models/graphics-g3-credits.json) has every task. G3 has 2,220 credits left.
- **The walls:** the palisade and towers stand on the wall cells, which were solid already, so the rules and every route are unchanged.
  - One instanced draw for each model carries a camp's 14 to 29 palisade sections and its 4 to 6 towers.
  - The palisade hides the code-built breastwork, which stays as its fallback on Performance and until the model is ready. No other part of the camp now joins the breastwork's batches, so hiding them hides nothing else.
  - The camps walled in stone or mudbrick keep their code-built walls.
- **The furniture** stands only in a camp, beyond the board: beside the service it belongs to where a court is free, otherwise in the baggage line. Like the props of camp life, it has no code-built stand-in.
- **Downloads:** decision 2 now applies chapter by chapter.
  - A model's catalog entry names the chapters whose web download has room for it; the desktop app carries every chapter's models.
  - Chapter I's web download takes the palisade alone (17.87 of its 18 MB), and Chapter XII's takes none (27.71 of 28 MB with the 2D view).
  - The web downloads of Chapters VII and VIII now stand within 0.16 MB of their 28 MB limit, so later models for them ship in the desktop app only.
- **The review,** in the desktop build at High, each camp restored from its earned checkpoint through the Restore dialog:
  - the timber camps now read as walled and towered camps from every camera, where the black breastwork read as a low fence;
  - the gate towers frame the road out where the soldier starts in Chapters I and VII, without hiding him;
  - the palisade's stakes and earth bank read at the Overview camera, and no section's stretch shows;
  - at the Overview camera, the officers' tent, the horse lines and the granary read beside the walls of Chapters IV and VII; the training post, the stores and Chapter VIII's struck tent are small there.

![Chapters I and VII before (the tent lines, on main) and with the pilot's models, in the desktop build at High](images/g3-pilot-camps.jpg)

### The rest of G3 (9 November)

Eighteen more camp models, made after the pilot's review in the game (decision 9), in the order the camera meets them:

| Model | Where it stands | Chapters |
| --- | --- | --- |
| a coursed limestone wall section | along every wall cell of the stone camps, stretched to fill each straight run | IV, IX, XII |
| a square limestone tower under a tiled roof | on each corner of those walls, and at each end of a wall that opens on a gateway | IV, IX, XII |
| a round-arched limestone gate with a walkway | over each gateway of those walls | IV, IX, XII |
| a plastered mudbrick wall section | along every wall cell of the mudbrick camps | V, VI |
| a squat mudbrick tower | on each corner of those walls, and either side of a gateway | V, VI |
| a timber gate of two posts under a lintel | over each gateway of the timber camps | I, II, III, VII, X |
| a goatskin tent with its door tied open | on the tent lines, mixed by cell with the leather tent | I, II, III, VII, VIII, IX |
| a goatskin tent patched in lighter and darker hide | on the tent lines, mixed by cell with the leather tent | I, II, III, IX, XII |
| a round commander's pavilion of red leather | beside the principia | II, VI, VII, IX |
| a hospital tent, one wall rolled up on two camp beds | beside the valetudinarium | II, III, VI, VIII, IX |
| a raised timber tribunal with a folding chair | beside the principia | I, IX, XII |
| a limestone camp altar | beside the principia | I, IV, XII |
| a linen awning over a table and two stools, for a parley | beside the principia | VIII, IX |
| a pavilion of striped linen in the eastern style | beside the principia | VI, IX |
| a reed-mat shade on poles over a carpeted floor | beside the canabae | VI, IX |
| a timber rack of pila with a red oval shield | beside the drill ground | II, III, VI, VIII, X, XII |
| a straw archery butt on a timber easel | beside the drill ground | III, VI, X, XII |
| a domed clay field oven on a dry-stone base | beside the canabae | II, IV, VIII, X |

- **Credits:** 380 of the rest's 400-credit ceiling: eighteen generations at 20, and one rejected and redone (the first pilum rack came out all grey iron, with leaf-bladed spears and no timber frame). The balance went from 9,325 to 8,945. [The ledger](../art-source/models/graphics-g3-credits.json) has every task. One generation in nineteen was rejected, under the 20% stop rule.
- **The walls:** the stone and mudbrick camps are walled like the timber ones, along the wall cells, which were solid already.
  - The wall model stands for the code-built parapet, which stays its fallback on Performance and until the model is ready. The parapet is now a batch of its own, so hiding it leaves the camps' terraces and kerbs.
  - Each gateway takes a gate, as wide as the gap but stretched by at most 1.35 times its width. Chapters I–III's 12.5 m gateways keep open ground either side of theirs.
  - Chapter XI, a portico in Rome, keeps its code-built walls. Chapter V's courtyard takes the mudbrick wall and towers too.
- **The tent lines** mix the two new tents with the leather tent by a hash of each pitch's first cell, a quarter of the pitches each. Each model hides only its own pitches' code-built tents. Chapters IV and VI pitch one tent each, which falls to the leather tent.
- **The furniture** stands beside its service where a court is free, otherwise in the baggage line, as the pilot's does.
- **Reviewed in the game,** two models were processed again at more triangles, as their parts had crumpled into facets at the Follow camera: the reed-mat shade (8,819 triangles) and the pilot's supply stack (5,389, the most Chapter VII's web room could take). [The art record](art-generation.md#release-g3-the-rest-of-the-camps--9-november-2026) has the review.
- **Downloads:** each model downloads with its chapters in the desktop app. On the web:
  - Chapters I, VII, VIII and XII take none of the rest's models, as decided after the pilot;
  - Chapter IX's share came to 2.45 MB against its 2.33 MB of room. It leaves out the two new tents, one pitch each, which stay leather on the web, and the tribunal and the parley awning, which stand in its far rows beyond the camera's reach (27.34 of 28 MB). No other web chapter carries those two, so the web build leaves out their files (0.35 MB);
  - every other chapter takes all its models: IV at 27.21 MB, VI at 26.71 and X at 27.40 of 28;
  - with the supply stack processed again, Chapter VII's download stands at 27.94 of 28 MB and VIII's at 27.92;
  - Chapter I's 3D download is unchanged at 17.87 of 18 MB, and the complete web game is 70.42 of 80 MB.

![Chapters IV, VI and IX before (main, after the pilot) and with the rest of G3, in the desktop build at High](images/g3-rest-camps.jpg)

#### What G3 leaves

G3 is done at 560 of its 2,400 credits. The rest bought what its list still lacked where the camera meets the camps; the carts, barrels and amphorae on the list already stood there, as camp life (release 9) and the quartermaster's stores. Its other 1,840 credits are held for the releases after it rather than moved now, since moving them would raise another release's cap:
- at standard prices, the lists of G5, G4, G6 and G2 come to about 3,000 credits, so the plan would end near 4,800 of its 7,900, below the owner's 70% floor (7,490);
- G5's pilot proposes how many more of battle and siege to buy, and where the rest of the 1,840 goes, before anything beyond a cap is spent.

### G5's pilot (9 November)

Six battle and siege models, about a seventh of G5's list, made and reviewed in the game before the rest of G5 (decision 9). Four draw field objects on their cells in place of the code-built pieces, which stay for every other state, on Performance and until a model is ready; two are set pieces beyond the board:

| Model | Where it stands | Chapters |
| --- | --- | --- |
| an abandoned two-wheeled supply cart | on the supply cart's cell, in all four of its states | every battle (I–X, XII) |
| the cart's load: sacks, amphorae and rope under a lashed sheet | on the cart's bed while the supplies are still to be recovered | every battle |
| a timber barricade of sharpened stakes, two panels side by side | on the barricade's cell while it stands | III–X, XII |
| a ram under a hide-roofed shed | on the ram's cell at Chapter V's river gate while it stands | V |
| a carroballista, a bolt-thrower with bronze-cased springs on a cart | beyond the west edge, behind the Roman line, facing the enemy | the field battles of VII–X |
| an onager, a one-armed stone-thrower | beyond the west edge, behind the Roman line, facing the enemy | the sieges of IV, V, IX and XII |

- **Credits:** 140 of the pilot's 160-credit ceiling: six generations at 20, and one rejected and redone (the first load came on a four-wheeled cart of its own). [The ledger](../art-source/models/graphics-g5-credits.json) has every task. The balance went from 8,945 to 8,805. One generation in seven was rejected, under the 20% stop rule. G5 has 1,705 credits left.
- **Field objects:** the rules keep each object's state, and the model shows it.
  - The cart stands in every state, its load only while the supplies are to be recovered. A cart never stands empty while they are: without its load the code-built cart, with its own sacks, stands instead.
  - Two barricade panels span the barricade's cell east to west, as the code-built barricade's two metres do. Dismantled, its code-built scattered timbers remain.
  - The ram's iron head points west at the gate. Burnt, its code-built charred timbers remain.
  - Each copy is drawn as the scenery's placed models are, with their shader programs: the barricade's two panels are two draws.
- **Set pieces:** each stands a few metres beyond the board's west edge, on the first spot clear of the roads that leave the board, the region's buildings and the scene's other scenery. The fixed camera looks north-west, so it sees them behind the army. Like the camps' furniture, they have no code-built stand-in.
- **Downloads:** each model downloads with its chapters in the desktop app. On the web:
  - Chapters I, VII and VIII take none (17.87 of 18 MB, 27.95 and 27.92 of 28);
  - IV takes the cart, its load and the barricade (27.91 of 28); IX the two engines (27.86); X the carroballista and the barricade (27.92); XII the barricade (27.95);
  - II, III, V and VI take all of theirs (V at 24.91, VI at 27.40);
  - the complete web game is 71.86 of 80 MB.
- **The review,** in the desktop build at High, each battle restored from a moment the real-time bot reached from New Game, before (G5's files refused) and after:
  - the cart and its load (Chapters III and VIII) read at once as an abandoned cart with its load still lashed on;
  - the barricade's two lattice panels (Chapter XII) stand where the code-built stakes stood. In the press of the fight they are half hidden, as the stakes are, and their thin beams are harder to pick out;
  - the ram (Chapter V) reads as a siege engine on its ground before the river gate, its iron head toward the gate. From the camera's height its hide roof shows only as dark, ragged pieces;
  - the onager (Chapters V and IX) reads at once behind the Roman line. The carroballista (Chapter VII) reads less well: at the edge of the view its thin frame and dark timber are hard to tell from the scrub.

![Field objects before (the code-built pieces) and with the pilot's models, in the desktop build at High](images/g5-pilot-battles.jpg)

![The set pieces behind the Roman line, before (none) and with the pilot's models](images/g5-pilot-set-pieces.jpg)

#### What G5's pilot proposes

The pilot shows the field objects and the set pieces read in battle, so the rest of G5 buys more of both, in two batches, each reviewed in the game before the next:
- **What the review teaches the next batch:** from the camera's height, solid shapes read at once (the cart, the onager, the ram's body), while thin frames and lattices (the carroballista, the barricade) are harder to pick out. So the next requests ask for solid timbers and bold silhouettes, and each model is checked at the field's distance before it is placed.
- **The rest of the list,** about 30 models, about 660 credits with a tenth for rejects:
  - the other field objects on their cells, each with its code-built fallback: the signal station, the pitch brazier (its flame stays the particle plume), the Gothic ladder, the countermine's timbering, the siege ramp, and the side gate and the footbridge outside the fortified fields (7);
  - beyond the west edge, a ballista on its stand and a scorpion (2); before the walls of the sieges, a siege tower and a row of mantlets (2);
  - beyond the north edge, which the camera sees behind both armies: the Gothic wagon laager in the Gothic battles (2), the Persian siege works in Chapter V (2), regional palisades (2), and at Chapter VIII's river a Danube patrol boat and a barge (2);
  - regional carts and barricades, so the eastern and Gothic battles differ from the Roman ones: an eastern cart, a Gothic ox wagon and an eastern barricade of wicker hurdles (3);
  - battlefield debris for the walked field after a win: scattered shields and broken spears, a fallen standard, spent bolts and a broken cart (4), and the stacks of shot and bolts beside the engines (2), an eastern signal station (1) and the fascines and gabions of a Roman siege (1).
- **Regional sets,** about 40 models and 900 credits, after the first batch's review: each region's battles take field objects and set pieces in their own style (the Danube, the East, Palmyra, Italy). G5 would then have spent about 1,700 of its 1,845.
- **Downloads:** most of these ship in the desktop app alone. After the pilot, Chapters I, IV, VII–X and XII have under 0.15 MB of web room left, and their web builds keep the code-built pieces. Raising the web's 28 MB chapter limit is the owner's call.

**The 1,840 credits held from G3.** At standard prices what is left of the lists of G5, G4, G6 and G2 comes to about 2,600 credits, so the plan would end near 4,500 of its 7,900, well below the owner's 70% floor (7,490). With G5 spending about 1,700, the floor needs the held credits too. I propose they go where the camera still meets the weakest work:
- **G6, faces and people, +900:** bodies of their own for the camps' people, who share a few bodies in every chapter;
- **G4, animals, +500:** mules and oxen harnessed to the carts, wagons and carroballista, which stand unhitched, and the camps' animals;
- **G2, arms and standards, +440:** each faction's shields and weapons as 3D kit, and each unit's standard.

The plan would then end near 7,700 of its 7,900 credits, 72% of the balance. Each of those releases' pilots proposes its counts, as G3's and G5's did, and nothing beyond G5's own cap is spent before the owner has seen this proposal.

### The rest of G5: the first batch (9 November)

Eighteen models, the first of the two batches the pilot proposed, asked for in solid timbers and bold silhouettes and checked at the field's distance before they were placed. They extend the pilot's field objects and set pieces, and add the walked field's debris:

| Model | Where it stands | Chapters |
| --- | --- | --- |
| a pitch brazier, an iron fire basket on three legs heaped with pitch | on the brazier's cell, unlit or burning; burning, the stage's flame and smoke rise from its heap | III–X, XII |
| the countermine, a square shaft in heavy timbers under a windlass | on its cell while it is worked | V |
| the Persian siege ramp of earth and rubble in a timber-and-reed revetment | on its cell while it is worked | V |
| an eastern supply cart, a pale bed with faded red boards | on the supply cart's cell in the eastern battles, in every state, with the pilot's load | V, VI, IX |
| a two-armed ballista | beyond the west edge, behind the Roman line | the sieges of IV, V, IX and XII |
| a stack of stone shot | beside the onager | the sieges of IV, V, IX and XII |
| a crate of bolts | beside the carroballista | the field battles of VII–X |
| a siege tower hung with hides, a broad wicker mantlet, and fascines with gabions | beyond the west edge, where the Romans attack a wall | IX, XII |
| the Goths' open and covered wagons | beyond the north edge, behind both armies | the battles against Gothic bands (I–IV, VII, VIII, X) |
| the Persian siege tower and reed-mat screens | beyond the north edge | V |
| the beaten side's gear (the Goths', the eastern armies' or the rival Romans') and a fallen war banner | on the walked field after a win, beside the beaten side's fallen | every battle |

- **Credits:** 440 of the batch's 440-credit ceiling: 22 generations at 20. [The ledger](../art-source/models/graphics-g5-credits.json) has every task. The balance went from 8,805 to 8,365. G5 has spent 580 of its 1,845 credits and has 1,265 left.
- **Rejected:** four generations of 22 (18%), under the 20% stop rule. The first ballista (a flat grey colour map and metal coil springs) and the first mantlets (three thin racks) were redone and ship. The eastern barricade was rejected twice (two hurdles standing apart, then a rack of hanging baskets) and not made a third time: the pilot's timber barricade now stands in every battle from Chapter III.
- **Field objects:** each model draws its object only in the states it is made for. A spent brazier, a disabled countermine or ramp, and every object on Performance keep their code-built pieces. The eastern cart carries the pilot's load on its own bed.
- **Set pieces on two edges:** beyond the west edge as in the pilot, and now beyond the north edge, which the fixed camera sees behind both armies. A piece may stand beside another, at an offset in that piece's frame: the shot by the onager, the bolts by the carroballista. A piece tries 13 shares of its edge rather than 9, since a fortified field's north edge is crowded with its walls.
- **The walked field's debris:** up to six spots, each 1.1 m off one of the beaten side's fallen, at least 6 m apart, on the board and clear of the field objects. The first takes the fallen banner. The fallen men's ids order the spots, so nothing is drawn from the game's random streams, and the chronicle is unchanged.
- **Budgets:** the countermine and the fascines were raised to 7,000 and 6,000 triangles to keep their timbers and gabions whole. The debris's heights were set from each model's proportions, since a flat model is scaled by its height.
- **Downloads:** each model downloads with its chapters in the desktop app. On the web:
  - Chapters II, III and V take all of theirs, and VI the eastern cart, the brazier and the eastern debris;
  - Chapters I, IV and VII–XII take none of the new ones, so the bolts, the Roman siege works and the Roman debris ship in the desktop app alone;
  - the largest chapter download is 27.96 of 28 MB, Chapter I's 3D download 17.88 of 18 MB, and the complete web game 75.04 of 80 MB.
- **The review,** in the desktop build at High, each battle restored from a moment the real-time bot reached from New Game, before (G5's files refused) and after:
  - the siege ramp and the countermine read at once, where the code-built pieces read as a bench and a table;
  - the engines' stores (the stone shot, the bolt crate) and the new ballista read at once behind the Roman line. The Roman siege tower is the batch's boldest piece, and the mantlet reads as a broad arched screen;
  - the Persian tower, open timber faced with reed mats, reads as the enemy's, lighter than the Roman one;
  - the brazier is as small as the code-built one at the field's distance, and the bolts in their crate are too small to pick out;
  - the eastern cart reads as a different cart from the Roman one, its pale bed and faded red boards under the pilot's load. Framed at the objective, the near half of either cart fades: the opening the game cuts toward an objective the camera frames reaches the objective's own piece. That is older than G5, and is now fixed at no credit cost: the opening ends 1.5 m short of the objective;
  - on the walked field the fallen banner reads at once, the brightest thing there. The beaten side's gear lies among the fallen, darker and smaller than the banner (the Goths') or pale against the dust (the eastern armies');
  - the review found the open Gothic wagon standing in Chapter II's marsh, whose water reaches 6 m past the board. Set pieces now keep to dry ground, out of the marsh, a river leaving the board, the distant river and Chapter V's Euphrates. Before the change 5 of the 60 set pieces touched water, and now none does; Chapter II's rearguard has dry room for one wagon.

![Field objects before (the code-built pieces) and with the batch's models, in the desktop build at High](images/g5-first-batch-battles.jpg)

![Set pieces behind the lines, before (none) and with the batch's models](images/g5-first-batch-set-pieces.jpg)

![The walked field after a win, before (the fallen alone) and with the beaten side's gear](images/g5-first-batch-walked-field.jpg)

#### What the first batch proposes

The batch bears out the pilot's lesson and adds three:
- **Bold pieces read; small ones do not.** From the camera's height the ramp, the countermine, the engines and the towers read at once, while a 1 m brazier and a crate of bolts read only as shapes. The next requests favour pieces a metre and a half or more on a side, and gather small stores into larger stacks.
- **What Tripo will not do:**
  - it gave spoked wheels each of the three times solid wheels were asked for, so the next requests stop asking, since spokes and planks look alike at the field's distance;
  - thin wicker failed three times (the first mantlets and both eastern barricades), so the next requests ask for solid timber, earth and hides.
- **Colours named, heights set:**
  - a request names each material's colour, since the first ballista came grey;
  - a flat model has its height set from its raw proportions;
  - a model of many small parts is given room above the decimator's floor.
- **Dry ground:** in the wet chapters there is little room past the north edge. Chapter II's rearguard holds one wagon.

**Done at no credit cost:** the opening the game cuts toward an objective the camera frames now ends 1.5 m short of the objective, so a cart standing at an objective stays whole.

**The last of G5,** within its 1,265 credits left, in two batches of about 26 models, each reviewed in the game before the next. That is about 1,150 credits with a tenth for rejects, and G5 would end near 1,730 of its 1,845:
- **The rest of the pilot's list,** about 12 models:
  - the field objects still code-built: the signal station (Roman and eastern), the Gothic ladder, the side gate and the footbridge;
  - a scorpion beside the ballista;
  - palisades for the Danube's and the East's fields;
  - a patrol boat and a barge on Chapter VIII's river. These stand on the water, so they need a placement of their own;
  - spent bolts and a broken cart for the walked field.
- **The regional sets,** about 40 models: each region's battles take field objects and set pieces in their own style: the Danube (I, IV, VIII), the marshes (II), the East (V, VI), Palmyra (IX) and Italy (VII, X, XII).
- **Downloads:** the web's chapter downloads are nearly full. Chapter II has 2.6 MB of room, III 1.2 MB and V 0.9 MB, and the other battles' chapters under 0.2 MB, so most of the last batches would ship in the desktop app alone. Raising the web's 28 MB chapter limit remains the owner's call.

### The last of G5 (10 November)

Four models, where the first batch proposed about fifty. Before they were asked for, a survey of what the battles still draw in code changed the proposal:
- **The regional sets** would have duplicated what is already there. Every battle's surroundings are its chapter's regional kit, the Blender buildings around the board, and Chapter V's are its pilot's.
- **The side gate and the footbridge** stand only in the fortified fields, where the board kit draws the gates, breaches and bridges.
- **The signal station** is the one field object every battle still draws in code.
- **Left out, after the first batch's lessons:**
  - the Gothic ladder, the scorpion and the spent bolts, which are thin or small and do not read at the field's distance;
  - the palisades, which would stand past the north edge, where the fortified fields have walls of their own and the wet chapters little dry room;
  - the broken cart, since the walked field already has the beaten side's gear and the fallen banner.

| Model | Where it stands | Chapters |
| --- | --- | --- |
| a Roman signal post: a mast on a fieldstone cairn, with its red banner, fire basket and beacon stack | on the signal station's cell, in every state | I–IV, VII, VIII, X, XII |
| an eastern signal post: a stone pillar with its fire basket, brushwood, ladder and pennant | the same, in the eastern battles | V, VI, IX |
| a Roman river patrol boat under oars and a square sail | afloat on the distant river beyond the north edge | the battles of I, II, IV, VIII and X |
| a Danube barge loaded with sacks, amphorae and a lashed leather sheet | the same, further along the river | the same |

- **Credits:** 80 of the batch's 100-credit ceiling: four generations at 20, none rejected. [The ledger](../art-source/models/graphics-g5-credits.json) has every task. The balance went from 8,365 to 8,285.
- **Field objects:** the signal station takes one model in all four of its states, as the cart does, and the objective's marker shows whether it was secured, forgone or missed. The code-built mast stays on Performance, after a failed download and where a web download has no room.
- **On the water:** the boats have a placement of their own. Each takes the first spot along the distant river whose footprint lies wholly where the river's own surface shows, sunk by its draft below the surface. Both float in all nine battles whose scenes have the river, including the training ground.
- **Budgets:** the patrol boat came with its mast raised and its square sail set, where a lowered mast was asked for. Like the barge's, its height was set from its raw proportions: 5.7 m to the masthead.
- **Downloads:** each model downloads with its chapters in the desktop app. On the web:
  - the Roman post rides in Chapters II and III, the eastern post in V, and the boats in II;
  - the other chapters keep the code-built mast and an empty river;
  - the largest chapter download is still 27.96 of 28 MB and Chapter I's 3D download 17.88 of 18 MB; the complete web game is 76.09 of 80 MB.
- **The review,** in the desktop build at High, each battle restored from a moment the real-time bot reached from New Game, before (G5's files refused) and after:
  - the signal posts read at once where the code-built mast, a thin pole on a pale block, was the smallest piece on its field: the Roman post's long red banner at Chapter I's road, the eastern post's pale pillar at Chapter VI's wells;
  - in Chapter II's marsh battle both boats float on the river behind the Gothic wagons' bank, the patrol boat's pale sail the brightest thing on the water;
  - at Chapter VIII's ferry the barge looked sunk, only its load above the water. The ferry's river leaves the board and runs on, at its own level 0.8 m higher, over the near half of the distant river, and the barge had taken a spot under it. The boats now keep to where the distant river's own surface shows, and lie further along the river in Chapter VIII's two battles and Chapter X's;
  - seen again after the fix, both boats at Chapter VIII's ferry float whole: the barge at the river's east end, and the patrol boat upstream of where the ferry's river comes in.

![The signal station before (the code-built mast) and with the batch's signal posts, in the desktop build at High](images/g5-final-batch-signals.jpg)

![The distant river before (empty) and with the batch's boats, and Chapter VIII's barge before and after the fix](images/g5-final-batch-boats.jpg)

#### G5 closes

G5 ends at 660 of its 1,845 credits with 28 models: six in the pilot, 18 in the first batch and four in the last. Of its 33 generations, five were rejected (15%), under the 20% stop rule. The battles' field objects take models in the states that read, and the code-built pieces stay for the rest: the Gothic ladder, each object's spent or broken state, and wherever a web download has no room. Behind the lines stand the engines, the siege works, the wagons and the boats, and the walked field has the beaten side's gear. Its lessons go to the releases after it:
- solid shapes read from the camera's height, while thin frames, lattices and small stores do not;
- Tripo gives spoked wheels whatever is asked, and thin wicker fails;
- name every material's colour, and set a flat model's height from its raw proportions;
- check a placement in the game, where water, walls and roads decide what fits.

#### What G5 leaves

G5's other 1,185 credits join the 1,840 held from G3: 3,025 for the three releases still to come, beyond their own caps of 2,400.
- **Where the plan stands:** it has spent 2,415 credits, and its 70% floor (7,490) needs 5,075 more. That is nearly all of what G4, G6 and G2 could spend: 5,425 with the held credits.
- **G5's pilot's proposal stands:** the held credits go where the camera still meets the weakest work.
- **G5's 1,185 follow it,** in the same proportions: G6 +580, G4 +320 and G2 +285. G6's cap with its held credits would be 2,580, G4's 1,420 and G2's 1,425.
- **Each release's pilot proposes its counts,** as G3's and G5's did.

The order stays: the animals (G4) next, then the faces and people (G6), then the arms and standards (G2). If all of it is spent, the plan ends near 7,840 of its 7,900 credits, 73.3% of the balance.

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
4. **Review:** each release's pilot goes to the owner before the rest is generated. From G3 on, decision 9 replaces this.

After the calibration (8 November):

5. **Tiers:** standard textures for every category, and standard geometry.
6. **Step 0c:** skipped; the shipped landmarks stay as they are.
7. **G7:** skipped. Its 750 credits went where the camera is: 400 to the camps (G3) and 350 to battle and siege (G5), so the plan keeps its 7,900-credit cap, 73.8% of the balance.

### After G1 (9 November)

8. **G1's rest:** approved after the pilot, and made ([the rest of G1](#the-rest-of-g1-9-november)).
9. **The rest of the plan** is left to my judgement, within each release's cap and the rules below. Each pilot is reviewed in the game before the rest of its release is generated, and its review images go with its PR, rather than to the owner first.
10. **Order:** the camps (G3), then battle and siege (G5), animals (G4), faces and people (G6), and arms and standards (G2), the standards first. The camps and the siege works are large enough to read at any distance; most of G2's kit is too small to read in battle, where step 0 found the crowds read better with the code-built pieces.
11. **G1's remaining 1,295 credits** go to G3 (700) and G5 (595); the second crowd bodies are not made. The plan keeps its 7,900-credit cap.

## Rules for the spend

- **Approvals:**
  - no task is created before its release is approved (decision 9 approves G2–G6 within their caps);
  - step 0's comparison comes before any bulk spend;
  - each pilot comes before the rest of its release.
- **Caps:** no cap is exceeded without asking.
- **Stop rule:** if more than 20% of a release's attempts are rejected, the release pauses and the owner is told.
- **Process:** every paid task runs `--dry-run` first, and recovery never creates a replacement ([the pipeline](asset-pipeline.md), [Tripo V3](tripo-v3-migration.md)).

## Risks

- **Prices:** step 0 measured them, and every category takes the standard tier: 20 credits a model and 25 a rig. The caps don't move.
- **The original downloads** live only in the working container. If it is reclaimed, the free upgrades depend on Tripo still serving the outputs. On 8 November it did: a task from 2 November downloaded again by its ID, identical to its recorded SHA-256.
- **Rights:** the owner's statement of 20 October covers commercial use of what a paid account generates. [The release checklist](steam-release.md) still asks for a saved copy of Tripo's terms and a record of the plan tier, before the bulk releases.
- **Style and history:**
  - generated models drift, and the togas and sleeves were wrong before;
  - prompts fix the 3rd-century kit, and every release is reviewed.
- **Performance evidence is thin:**
  - the only real device measured, an Intel integrated GPU, ran Balanced at about 33 ms a frame;
  - new scenery shows on Balanced and High;
  - Performance, the phone default, keeps loading bodies and horses only.
- **Scale:** about 230 models with their integration is a programme of several weeks. It runs alongside Gate 4 and does not change the road to 0.40.0 ([the Steam plan](steam-plan.md#the-road-to-0400-and-steam-revised-8-november-2026)).

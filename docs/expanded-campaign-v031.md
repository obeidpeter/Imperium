# Expanded campaign rules — 0.31

New games started through the interface enable edition 31. Existing chronicles retain their rules; **Enable expanded campaign** at a camp checkpoint opts into the new systems for subsequent encounters. A suspended encounter is never silently upgraded. Core `newGame()` callers remain legacy-compatible unless they request `featureEdition:31`.

## Battlefield choices

Every non-training battle offers two mutually exclusive opportunities: recover an abandoned cart for 2 supplies on victory, or raise the signal for 15 friendly cohesion immediately and 2 Army Loyalty on victory. The opportunity expires after turn 7, or one turn before a shorter mission's deadline. Neither replaces the main objective or grants a win. Interacting requires the commander within one Manhattan tile and spends their personal action. Company orders remain available.

Chapter III onward adds a timber barricade and pitch brazier. Intact barricades give adjacent defenders 1 protection. Dismantling removes it. Ignited pitch blocks sight through nearby smoke and deals 2 damage to **either side** within one tile at round end. It burns for three rounds, or one in rain; an adjacent commander can extinguish it.

Chapters V, VIII, IX and XII use selected 10 × 8 battlefields with a side corridor. A closed gate blocks movement and sight; opening it admits passage. Repairing the damaged bridge turns its tile into a passable ford. Units, forecasts, path finding, picking and both renderers share the expanded bounds. Distinct chapter themes place a landmark outside the tactical board.

## Cohesion, weather and opposition

Cohesion starts at 80. Melee hits remove 10; ranged hits remove 6 and add one suppression, capped at 3. Cohesion below 40 and suppression at least 2 each subtract 1 from attack. Brace restores 12 cohesion at round end; adjacent friendly support restores 6. Either reduces suppression by one. Rally restores 20 cohesion and clears suppression in addition to its previous effects. These attack penalties begin after Chapter I.

Rain adds one movement cost for climbing high ground. Rain, mist and dust reduce ranged damage beyond two tiles by 1. The exact attack preview lists each applicable modifier. The opening chapter retains normal visibility and attack rules.

Visible enemy units coordinate around a shared vulnerable friendly target. Archers suppress, flankers seek a side approach and the remaining troops fix the target. Their intentions are visible and recalculate as the field changes. No random draw or hidden information is used to assign roles. Enhanced protected columns choose progress toward the goal while staying within three tiles of the commander and out of adjacency to visible enemies; the commander still needs to screen the route.

## Policy debates

Each Contest permits one motion and a later reply to the rival's counterproposal, each costing one commander speech. Table the original, then accept amended terms or defend the original after the next reply. Leaving it unanswered retains the original. Delegate shifts are forecast; accepting an amendment reverses only the recorded motion's actual stance deltas before applying the revised terms.

| Motion | Original terms | Amended terms |
| --- | --- | --- |
| Public provisioning | 2 supplies; grain +2, office −1; future protected columns +3 health; Public +3 | 1 supply; grain +1, law +1; future columns +1 health; Public +1 |
| Veterans' service charter | 2 supplies; service +2, grain −1; future friendly starting cohesion +10; Army +3 | 1 supply; service +1, security +1; future starting cohesion +5; Army +1 |
| Provincial accounts audit | 1 supply; law +2, office −1; each later victorious battle +1 supply; Political +3 | No supply cost; law +1, office +1; Political +1; no later supply recovery |

Costs and permanent effects commit only after winning and recording the Contest. A motion can be enacted once per campaign. The camp ledger shows enacted terms and secured field opportunities. Preview commands are pure, invalid commands do nothing, and Retry restores the entire checkpoint including debate, objects, cohesion, supplies and RNG.

## Rendering and controls

Sculpted figures gain fitted scabbards, suspension straps, belt fittings, stitching and role details; the High tier adds cloth sheen. Painted Roman figures use the new four-direction atlas. Attacks use bounded arm correction toward the committed recipient, while shield reactions anticipate the recorded hit. Existing staggered formation pose banks are retained.

Settings → **Show current frame report** exposes bounded CPU submission, display interval and reflection submission windows. These are separate from GPU query measurements. Expensive reflection submission reduces reflection refresh frequency; existing adaptive resolution and quality fallback remain active. Changes affect presentation only. No physical-device frame-rate target is certified by these readings.

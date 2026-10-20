# Command campaign — edition 34

This rules edition builds on the existing twelve-chapter campaign, formations, operations, veteran specializations, field objects, policies and recurring delegates. It adds operational preparation, authored field opportunities, coordinated enemy doctrines, a counter to frontal mounted charges and evidence cases tied to the campaign record.

## Save boundary

The public constructor accepts `newGame(name, seed, {featureEdition:34, progression:true})`. Saved state retains `featureEdition:31` for its existing expanded-field contract and adds the independent `campaignEdition:34` contract. Existing chronicles retain their old rules until `enableCommandCampaign` is explicitly used in camp. Suspended encounters never acquire the new rules midway through play. An active edition-34 encounter and its complete camp checkpoint must agree on their edition.

Preparation costs are paid only at departure, after the full checkpoint and before the battlefield derives troop condition. Spending the final supplies on an operational plan causes the same exhaustion as spending them on a company package. Retry reconstructs the same deployment and treasury rather than charging again. Initial objective progress includes prepared integrity and delayed reinforcements. Opportunities, cases and witness records commit only with a won encounter; a duplicate commit is rejected. The active chronicle cannot be replaced by an Archive practice save. Opening practice resets an incompatible future operational preparation to the free balanced plan.

## Operational preparation

Planning opens before battles in Chapter III. The commander’s table shows the combined affordability of the operational choice and the existing company supply package.

| Plan | Cost | Benefit | Trade-off |
| --- | ---: | --- | --- |
| Keep the company together | 0 | Established deployment | No additional benefit |
| Reconnaissance detail | 1 | Reveal concealed enemies; delay currently announced reinforcements one round | Friendly formations start with 10 less cohesion |
| Engineer train | 2 | Open the side gate, repair the footbridge, add 15 defended integrity | Commander moves one fewer tile, minimum one, for the battle |
| Command reserve, from Chapter IV | 2 | One additional command per round, maximum eight; 10 friendly cohesion | Commander carries one fewer javelin |

The reserve does not increase any soldier’s action allowance. Engineering creates real alternative routes in the wide Chapter V, VIII, IX and XII fields. In a field without a side gate or damaged bridge, its integrity benefit still applies and the interface states all its terms.

## Field opportunities by chapter

The existing two mutually exclusive opportunities now have authored chapter purposes. They use the established supply/signaling scene markers, but the displayed labels, previews and rule effects change. They cost one commander action within one tile and retain the existing deadline. Neither awards victory.

| Chapter | First opportunity | Second opportunity |
| --- | --- | --- |
| I — The Oath | Recover the miller’s cart: 2 supplies on victory | Call the road watch: 15 cohesion now; 2 Army Loyalty on victory |
| II — First Blood | Casualty satchels: heal living friendly formations and columns by 3 | Safe causeway: increase safe column movement from 2 to 3 |
| III — Under the Eagle | Courier dispatches: reveal concealed troops and delay announced reinforcements | False beacon: visible enemy cohesion −15 |
| IV — Hold the Line | Gate bracing: restore 20 integrity toward 100, never reduce a stronger position | Assemble rear files: safe column movement 3 |
| V — The Centurion | Engineer plans: open side gate and repair footbridge | Water detail: extinguish pitch fires and heal living friends by 2 |
| VI — The Broken Standard | Surviving medics: heal living friends by 3 | Recovered standard: friendly cohesion +20 and morale +10 |
| VII — A Legion to Lead | Deployment orders: reveal concealed troops and delay reinforcements | Reserve officers: one additional command now and per round, maximum eight |
| VIII — Beyond the Frontier | Landing boats: open side gate and repair footbridge | River guides: safe column movement 3 |
| IX — Rome’s Sword | Staked approaches: deny the extra damage of enemy mounted charges | Harass squadrons: visible enemy cohesion −15 |
| X — The Province | Granary receipts: 2 supplies on victory and a provisioning record | Village watch: restore 20 integrity toward 100 |
| XI — The Senate | Political hearings use the evidence system below; there is no invented field battle | Political hearings use the evidence system below |
| XII — The Purple | Relief provisions: heal living friends by 3 | Common oath: friendly cohesion +20 and morale +10 |

“Safe column movement” still requires an escorted column near its commander and no adjacency to a visible enemy; guides never teleport civilians, ignore occupancy or move them out of protection. Healing cannot revive withdrawn troops.

## Enemy command and formation response

The public doctrine is recomputed after committed actions. It reads visible positions, living troops and the current objective, never hidden units, gameplay RNG or a mutable planning cache.

Pursuit and interdiction prioritize exposed protected columns. Pincer and countercharge units choose lateral approaches; archers suppress the chosen focus. Siege forces contest guarded objectives. Screen, siege and reserve doctrines can retain one infantry formation through round two, committing it sooner if a visible enemy closes adjacent. The opening drill and road preserve their introductory approaches. The final negotiated parley retains its authored defensive perimeter and protected envoy.

A surviving braced defender answers a frontal mounted melee charge with **1 counter-damage, once per round**. The attacker must have moved at least two tiles. A flank, ranged attack or lethal first blow avoids the response. The ordinary damage forecast exposes `counterDamage`, and the command preview names it before commitment. AI scores include the visible counter-damage and the risk of losing the attacker. This is a bounded response, not an unannounced attack triggered by moving through a tile.

## Evidence, witnesses and political coalitions

Each of the six hearings offers two issue-specific cases. A case requires an earlier service, rescue, recovered-record, provisioning or provincial-judgment record. It spends one commander speech and may be presented once per hearing.

The favored interest gains 2 stance and the opposing interest loses 1, with existing commitment resistance and stance caps. The preview lists every actual before/after value and the net change in delegate votes. The same forecast drives the mutation. A favorable immediate flip is not a guarantee that the rivals cannot reverse it before the deadline.

| Hearing | Cases |
| --- | --- |
| Legion council | Company service roll; surviving comrade’s testimony |
| Dacian parley | Protected households; recovered border records |
| Provincial tribunal | Recorded tenure judgment; grain-road receipts |
| Senate accounts hearing | Veteran testimony; public provincial accounts |
| Admission hearing | Earned office through service; provincial guarantee |
| Legitimacy hearing | Common oath; civilian protection record |

Lucan can testify after actual company service if the player saved him. Sabinus supplies the survivor’s account when Lucan was abandoned; the interface explicitly acknowledges Lucan’s absence. Tactical withdrawal never changes this authored fate. Witness availability and the chosen case are preserved in the committed command record.

## Verification and limits

`node scripts/command-autoplay.mjs --write` starts six independent chronicles at New Game and uses public legal commands throughout: Standard, alternate operations, alternative cases, Story, Veteran and a depleted-supply purchasing profile. Every route covers all 25 encounters and all twelve chapters, exercises a case in each hearing, reaches Augustus and verifies exact Retry before each encounter. The alternative-case route proves a winning continuation with the other case in all six hearings. Low supplies come from actual preparation, package and obligation spending; the runner never injects a treasury, appointment, victory or character position.

The Veteran verification policy analyzes two cooperating speeches and the rivals’ public replies on temporary copies. It then issues only the selected legal commands to the live campaign. This is test-policy reasoning, not a game rule or an AI advantage granted to the player.

`tests/command-campaign.test.mjs` separately labels its focused position, health, treasury and adverse-standing fixtures. It checks preview purity, affordability, preparation trade-offs, gates and bridges, mutually exclusive opportunities, doctrines, counter-damage, import validation, authored witness absence, isolated Archive practice and the zero-standing finale recovery floor. Edition-31 regression tests remain unchanged.

Two additional Chapter V continuations begin from checkpoints earned by the legal New Game route. With the free balanced preparation, the commander legally moves to recover the engineers’ plans in the mine encounter and organizes the water detail in the wall encounter, then wins and commits each main mission. These detours use no injected positions or supplies. They establish that the benchmark opportunities can be reached and used while still completing the battle; the six objective-first full-campaign routes do not themselves collect optional field opportunities.

`tests/command-edition-ui.test.mjs` uses legal campaign checkpoints to check the actual deployment, political-case, command-record and practice views. It compares rendered prices and disabled controls with core affordability, exact delegate values with committed outcomes, readable titles with authored encounters and practice choices with completed history. Rendering and inspection must leave the chronicle and its RNG unchanged.

The results are automated rule and legal-command evidence. They do not establish human enjoyment, the 90–150 minute pacing target, historical authenticity of every visual, accessibility on physical devices or sustained graphics performance. Those remain separate release gates.

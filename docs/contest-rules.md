# Contest and tactical rules — Standard political revision

The browser and Node harness use the same deterministic rules. The six 8 × 8 chambers have different seat layouts, issues and rival priorities. Each speaker gets one move of up to three orthogonal tiles and one speech per round. Occupied seats block movement. Nine delegates plus four speakers form a fixed electorate of thirteen: seven votes pass a motion. A withdrawn speaker keeps their vote. Votes are counted only at the displayed deadline; an early majority never ends a Contest, and a tie fails.

Stance ranges from −6 to +6. At +1 a delegate votes for the player. Values at least +3 or at most −3 are committed: a shift away from that commitment is halved, rounded up, minimum one. Player speakers vote for and rivals against. Army, Political Backing and Public Confidence set the starting stance of Veterans, Landholders and Civic blocs respectively, with starting meter support capped at +2. A delegate’s bloc and personal interest are separate: each bloc contains several interests. Resolve starts at 12 for the protagonist and 10 for other speakers; zero withdraws that speaker.

Every argument costs one speech. These are base stance gains before commitment resistance:

| Delegate interest | Persuade | Promise | Invoke Record | Address | Threaten |
| --- | ---: | ---: | ---: | ---: | ---: |
| Military service | 2 | 3 | 4 | 2 | 3 |
| Security | 2 | 4 | 3 | 2 | 4 |
| Law | 3 | 2 | 2 | 3 | 1 |
| Grain | 2 | 4 | 1 | 1 | 3 |
| Office | 1 | 4 | 1 | 1 | 4 |

Bloc preferences add to these personal interests: Veterans gain +1 from Record and Threaten; Landholders gain +1 from Promise; Civic delegates gain +1 from Persuade and Address, and −1 from Threaten. Threaten always has at least one point of strength. A living allied speaker within two tiles adds +1 Persuade, so speaking together improves local lobbying while spreading out covers more seats.

Persuade reaches adjacent delegates. Promise and Threaten reach two tiles. Invoke Record reaches three tiles and can be used only once per recipient per Contest; a company with at least twelve total commendations earns one additional Record point with service-minded delegates. Address affects every delegate within three tiles and becomes available again three turns after use. The authoritative preview lists every affected member’s resulting stance, commitment resistance and stance caps, net supporting votes, Resolve changes and costs. The same forecast drives the action.

Promise is limited to two recipients per Contest, once each. It stages an accession obligation: a paid civic office for an office-minded delegate, a funded legal guarantee for a law-minded delegate, or two grain convoys otherwise. Grain- and office-minded promises cost three supplies to honour; other promises cost two. Breaking any promise costs eight Public Confidence and four Political Backing. An honoured debt exceeding available supplies costs one Public Confidence per missing supply. These costs and the Chapter 12 due date appear before confirmation. Brokers also put extra pressure on promised supporters. Threaten costs three Public Confidence, shifts other members of that bloc down one stance, and reduces future threats against that bloc by one point (minimum one).

Denounce inflicts four Resolve damage on a rival within three tiles. Rebut restores four Resolve to a friendly speaker within three tiles, or reduces a rival’s next speech to one point of stance or Resolve loss. Persuade unlocks in Chapter 7; Promise/Threaten in 8; Address/Rebut in 10; Record/Denounce in 11. Chapter-required abilities must be demonstrated before an encounter can qualify the player for promotion.

| Encounter | Issue | Rival style | Deadline |
| --- | --- | --- | ---: |
| ch7-council | Legion deployment | Lobby | 8 |
| ch8-parley | Safe passage and grain toll | Broker | 10 |
| ch10-tribunal | Tenure and displaced households | Lobby | 12 |
| ch11-accounts | Audit of military service | Prosecutor | 12 |
| ch11-adlection | Office and constitutional precedent | Prosecutor | 14 |
| ch12-legitimacy | Imperial recognition | Broker | 14 |

Rivals evaluate reachable speaking positions and visible opportunities each turn. Lobbyists value flipping supporting votes; prosecutors place more weight on vulnerable speakers and withdrawal; brokers give promised supporters extra priority. They move up to three tiles before speaking: Resolve attacks reach three tiles, lobbying one tile. A normal attack costs three Resolve and lobbying costs two stance; a broker lobbying a promised recipient applies three stance. Rebut limits either to one, before commitment resistance. Rival plans are computed sequentially, so the second rival sees the first rival’s planned result. The displayed next reply names its destination, target and resulting value. It is exact if the position remains unchanged; a player action can change that plan. Plans use public state and consume no random numbers.

Chapter 10 administration affects actual play. Each river allocation above one adds five starting allied morale in the grain-road battle. Each farm allocation above one adds five store integrity. At least three town allotments add one Landholder stance in the tribunal; shared tenure adds one Civic stance, while settler title adds one Veteran stance and subtracts one Landholder stance.

A failed Contest can be retried from its complete start snapshot or restarted with patron backing: three Landholders start at +3, two supplies are spent immediately, and a five-supply obligation grants the syndicate a claim on two harvests. This restarts a playable vote and grants no milestone. Stance, Resolve, positions, promises, cooldowns and RNG are transactional; victory commits once.

## Tactical changes

Nineteen authored battlefield layouts use rivers and fords, rock, marsh, roads, high ground and walls. Rivers and rocks block travel; intermediate walls and rocks block ranged attacks. Movement and attacks update facing. In combat version 2, entering a tile beside a visible hostile melee unit ends movement; a unit may still leave its engaged starting tile. This lets soldiers screen a commander or column without adding reaction attacks. Archers seek ranged positions and high ground, cavalry seek exposed flanks, guards defend anchors, and raiders value convoy or objective pressure. Plans consider visible threats, protection, friendly support and legal paths; their intent text can change after a player action. The opening road uses direct enemy approaches and a companion who stays near the recruit. Authored reinforcement waves announce their arrival turn and tile.

Victory follows the objective, with no arbitrary eight-turn waiting floor. Training ends after four required actions. Recovery requires Scout and reaching the chest. Extraction requires every protected column and the commander at the exit. Capture requires friendly presence and no adjacent enemy at each marked position. Hold accumulates only turns with friendly presence and no adjacent enemy. Supply missions protect stores while securing two routes. In version 2, unopposed enemy occupation reduces defended integrity by ten once per round; a friendly screen prevents that automatic damage, while contested ground still blocks hold progress. Deadlines apply.

Shield wall braces for two protection and reduces marching to one tile; an adjacent living shield-wall member adds one frontal protection. Line crosses marsh at normal cost, reduces morale loss by five and screens ranged damage by one when an adjacent line member supports it. Wedge adds one melee damage on firm ground and one incoming damage; its attack bonus does not apply in marsh, fords, walls or broken ground. Player formations expire at the next player turn; enemy defensive positions persist until their own turn. Each participant still gets only one movement and action. Withdrawal spends an ordinary command to fall back and brace without attacking.

Walls reduce damage by two; high ground reduces incoming damage by one and adds one to outgoing ranged damage against lower ground. Cover reduces ranged damage by one. A mounted unit that moved at least two tiles gains one melee damage on clear terrain against an unbraced target. Hits cost eight morale plus four on an exposed flank, reduced by line discipline and veteran resistance; a nearby friendly withdrawal costs six. At morale twenty-five or lower, damage falls by one; at fifteen or lower autonomous units regroup under shields and recover fifteen morale. A Rally order restores twenty morale; Hero Rally restores twenty-five morale and two health nearby. The exact damage breakdown appears in previews. Named veterans retain their bounded health/recovery benefits.

Chapter 2 Carry requires reaching and assisting wounded Lucan before escorting him; Leave starts a retreating survivor already escorted but requires two controlled extraction turns. Lucan is not duplicated as a healthy ally. Chapter 6 Save sends the commander to Varro’s isolated guard, while Obey starts the eagle on the shorter route. Chapter 8 Families creates two civilian columns; Soldiers screens one compact column with stronger troops.

All finales retain commander survival and a sixteen-turn deadline. Battle and indebted backing require defeating the field force. Defection requires three pledged cohorts: Rally within three tiles reduces a rival’s morale by forty; at twenty-five or less the cohort changes allegiance, subject to the eight-friendly-unit cap. Defeating the remaining opposition also resolves that route. Settlement requires escorting the envoy to 7D, keeping the hero within two tiles, using Rally and sustaining the meeting for two turns. Surrender requires securing 5B and 5G, then bringing the commander to the claimant’s standard at 7D.

The version 2 settlement infantry guard the meeting perimeter instead of launching a general pursuit. The envoy remains protected by the existing parley rule. This retains a distinct negotiation problem at low Army support; it does not remove the escort, proximity, Rally or meeting requirements.

## Evidence and compatibility

New battles use `combatVersion: 2`; an authored v0.6 battle without that field retains its prior formulas, AI and next-turn behavior. Retry preserves version 1 through its encounter options and complete start snapshot. `tests/combat-overhaul.test.mjs` checks exact continuation/retry against the frozen legal v0.6 marsh fixture, plus planner purity, engagement, roles, terrain, morale, formations and command economy. [Combat design and deviations](overhaul-combat-design.md) and [seeded combat evidence](evidence/overhaul-combat.json) document the change; the diagnostics are not a human enjoyment measurement.

`tests/tactical-depth.test.mjs` checks distinct valid deployments, facing/flanking, formation effects and expiry, morale recovery, rivers/LOS, objective-driven completion, rescue branches, company bounds, mixed interests, Record’s recipient limit, preview purity and bounded turn events. The gate fixtures report identical-seed greedy and tactical policies and two political approaches; they are automated tuning evidence, not human engagement research. The full route harness starts at New Game and emits only validated legal commands, with an independently replayed trace and exactly-once commits.

Saves suspended under the original pre-authored rules continue with frozen `legacy-battle.js` or `legacy-contest.js`, including private original shared helpers. Their original layout, objective duration and argument values remain intact on resume and Retry. Authored v0.6 chambers without `politicsVersion` retain their earlier six-point grain/office Promise, two-supply cost and turn-scheduled rival behaviour. New chambers use `politicsVersion: 2`; the old marker follows only its encounter checkpoint. Compatibility tests compare frozen serialized encounters, exact next-turn responses and complete Retry starts.

`tests/politics-overhaul.test.mjs` verifies bloc and positioning differences, forecast/application equality, Promise staging and limits, legal sequential rival plans, strategic priorities, withdrawal/deadline invariants and both political approaches in all six chambers at moderate and zero support. `scripts/political-diagnostics.mjs` reports identical declared starts under both old and revised rules. These are explicitly injected scenario comparisons using legal commands; they do not measure human enjoyment or prove full-campaign pacing.

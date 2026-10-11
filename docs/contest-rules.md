# Contest and tactical rules — authored encounter revision

The browser and Node harness use the same deterministic rules. The six 8 × 8 chambers have different seat layouts, issues and rival priorities. Each speaker gets one move of up to three orthogonal tiles and one speech per round. Occupied seats block movement. Nine delegates plus four speakers form a fixed electorate of thirteen: seven votes pass a motion. A withdrawn speaker keeps their vote. Votes are counted only at the displayed deadline; an early majority never ends a Contest, and a tie fails.

Stance ranges from −6 to +6. At +1 a delegate votes for the player. Values at least +3 or at most −3 are committed: a shift away from that commitment is halved, rounded up, minimum one. Player speakers vote for and rivals against. Army, Political Backing and Public Confidence set the starting stance of Veterans, Landholders and Civic blocs respectively, with starting meter support capped at +2. A delegate’s bloc and personal interest are separate: each bloc contains several interests. Resolve starts at 12 for the protagonist and 10 for other speakers; zero withdraws that speaker.

Every argument costs one speech. These are base stance gains before commitment resistance:

| Delegate interest | Persuade | Promise | Invoke Record | Address | Threaten |
| --- | ---: | ---: | ---: | ---: | ---: |
| Military service | 2 | 3 | 4 | 2 | 3 |
| Security | 2 | 4 | 3 | 2 | 4 |
| Law | 3 | 2 | 2 | 3 | 1 |
| Grain | 2 | 6 | 1 | 1 | 3 |
| Office | 1 | 6 | 1 | 1 | 4 |

Persuade reaches adjacent delegates. Promise and Threaten reach two tiles. Invoke Record reaches three tiles and can be used only once per recipient per Contest; a company with at least twelve total commendations earns one additional Record point with service-minded delegates. Address affects every delegate within three tiles and becomes available again three turns after use. Its gain is calculated separately for each interest. Previews show actual resulting stances or affected interests, including commitment resistance.

Promise is limited to two recipients per Contest, once each. It stages an accession obligation: a paid civic office for an office-minded delegate, a funded legal guarantee for a law-minded delegate, or two grain convoys otherwise. Honouring costs two supplies; breaking costs eight Public Confidence and four Political Backing. An honoured debt exceeding available supplies costs one Public Confidence per missing supply. Threaten costs three Public Confidence, shifts other members of that bloc down one stance, and reduces future threats against that bloc by one point (minimum one).

Denounce inflicts four Resolve damage on a rival within three tiles. Rebut restores four Resolve to a friendly speaker within three tiles, or reduces a rival’s next speech to one point of stance or Resolve loss. Persuade unlocks in Chapter 7; Promise/Threaten in 8; Address/Rebut in 10; Record/Denounce in 11. Chapter-required abilities must be demonstrated before an encounter can qualify the player for promotion.

| Encounter | Issue | Rival style | Deadline |
| --- | --- | --- | ---: |
| ch7-council | Legion deployment | Lobby | 8 |
| ch8-parley | Safe passage and grain toll | Broker | 10 |
| ch10-tribunal | Tenure and displaced households | Lobby | 12 |
| ch11-accounts | Audit of military service | Prosecutor | 12 |
| ch11-adlection | Office and constitutional precedent | Prosecutor | 14 |
| ch12-legitimacy | Imperial recognition | Broker | 14 |

Lobby rivals attack nearby speakers every third turn; prosecutors and brokers do so on even turns. On other turns, rivals seek wavering votes. Brokers first challenge promised supporters. Rivals move into range before speaking: attacks reach three tiles, lobbying one tile. A normal attack costs three Resolve and lobbying costs two stance. The displayed intent and end-turn event list identify the actor and result.

Chapter 10 administration affects actual play. Each river allocation above one adds five starting allied morale in the grain-road battle. Each farm allocation above one adds five store integrity. At least three town allotments add one Landholder stance in the tribunal; shared tenure adds one Civic stance, while settler title adds one Veteran stance and subtracts one Landholder stance.

A failed Contest can be retried from its complete start snapshot or restarted with patron backing: three Landholders start at +3, two supplies are spent immediately, and a five-supply obligation grants the syndicate a claim on two harvests. This restarts a playable vote and grants no milestone. Stance, Resolve, positions, promises, cooldowns and RNG are transactional; victory commits once.

## Tactical changes

Nineteen authored battlefield layouts use rivers and fords, rock, marsh, roads, high ground and walls. Rivers and rocks block travel; intermediate walls and rocks block ranged attacks. Movement and attacks update facing, so flanking is based on the current orientation. Archers seek open ranged lines and retreat from adjacent enemies, cavalry seek exposed flanks, guards hold approaches, and raiders prioritize evacuation columns. Authored reinforcement waves announce their arrival turn and tile.

Victory follows the objective, with no arbitrary eight-turn waiting floor. Training ends after four required actions. Recovery requires Scout and reaching the chest. Extraction requires every protected column and the commander at the exit. Capture requires friendly presence and no adjacent enemy at each marked position. Hold accumulates only turns with friendly presence and no adjacent enemy. Supply missions protect stores while securing two routes. Deadlines still apply; enemy occupation damages defended stores or lines.

Shield wall grants two protection and reduces marching to one tile. Line crosses marsh at normal cost and reduces morale loss by five. Wedge increases both outgoing and incoming damage by one. All formations expire together at the next player turn; each unit still gets only one movement and action. A Rally order restores twenty morale even when morale is broken. Hero Rally restores twenty-five morale and two health nearby. Named veterans receive at most +1 maximum health at three commendations and +1 morale resistance at six; recovery reduces starting health by at most two and never removes the veteran.

Chapter 2 Carry requires reaching and assisting wounded Lucan before escorting him; Leave starts a retreating survivor already escorted but requires two controlled extraction turns. Lucan is not duplicated as a healthy ally. Chapter 6 Save sends the commander to Varro’s isolated guard, while Obey starts the eagle on the shorter route. Chapter 8 Families creates two civilian columns; Soldiers screens one compact column with stronger troops.

All finales retain commander survival and a sixteen-turn deadline. Battle and indebted backing require defeating the field force. Defection requires three pledged cohorts: Rally within three tiles reduces a rival’s morale by forty; at twenty-five or less the cohort changes allegiance, subject to the eight-friendly-unit cap. Defeating the remaining opposition also resolves that route. Settlement requires escorting the envoy to 7D, keeping the hero within two tiles, using Rally and sustaining the meeting for two turns. Surrender requires securing 5B and 5G, then bringing the commander to the claimant’s standard at 7D.

## Evidence and compatibility

`tests/tactical-depth.test.mjs` checks distinct valid deployments, facing/flanking, formation effects and expiry, morale recovery, rivers/LOS, objective-driven completion, rescue branches, company bounds, mixed interests, Record’s recipient limit, preview purity and bounded turn events. The gate fixtures report identical-seed greedy and tactical policies and two political approaches; they are automated tuning evidence, not human engagement research. The full route harness starts at New Game and emits only validated legal commands, with an independently replayed trace and exactly-once commits.

Saves suspended under the original rules continue with frozen `legacy-battle.js` or `legacy-contest.js`, including private original shared helpers. Their original layout, objective duration and argument values remain intact on resume and Retry. The legacy marker follows that encounter’s checkpoint only. Subsequent newly started encounters use the authored rules above. Compatibility tests compare real pre-upgrade serialized encounters and exact old turn responses.

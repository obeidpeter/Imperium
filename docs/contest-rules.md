# Contest rules and tuning — v1

Written before implementation; deadlines updated after the complete campaign pass. All numbers below are shared by the browser and Node rules. A Contest uses an 8 × 8 chamber. Speakers have one move (up to 3 orthogonal tiles) and one speech per player-side turn. Occupied seats block movement. Members belong to Veterans, Landholders and Civic blocs. Nine member votes plus each speaker's own vote form the electorate. A withdrawn speaker retains their vote: the denominator never shrinks. A player wins only at the displayed deadline: 8 turns for the council, 10 for the crossing parley, 12 for the tribunal and Senate accounts, 14 for Senate admission and imperial legitimacy. A tie rejects the motion. All speakers can move and act independently in Contests.

Member stance ranges from −6 to +6: ≤−3 committed opposition, −2…+2 wavering, ≥+3 committed support. Crossing away from either commitment halves the adverse shift, rounded up, minimum one. Player speakers' votes are always for, rivals' always against. Members vote for at +1 or above. Initial support depends directly on campaign meters; earlier obligation settlements affect it indirectly through those meters. Resolve starts at 12 for the protagonist, 10 for allies and 10 for rivals. At zero a speaker withdraws and cannot move or speak.

Abilities consume the speaker's speech. Persuade: adjacent member, +2 stance. Address the Chamber: self-centred Manhattan radius 3, +3 stance to all members; usable every third turn (two intervening turns). Invoke Record: member within 3 tiles, +2 plus one per three completed military chapters (maximum +5). Promise: member within 2 tiles, +5 stance, records a specific grant of two provincial grain convoys to that bloc, callable at accession; honour costs 2 supplies, breaking costs 8 Public Confidence and 4 Political Backing. An honoured debt with insufficient supplies costs one Public Confidence per unpaid supply. Each recipient accepts one Promise, maximum two per encounter. Threaten: member within 2 tiles, +4 stance, −3 Public Confidence; other members of that bloc lose 1 stance and harden against further threats (−1 effectiveness). Denounce: rival speaker within 3, 4 Resolve damage. Rebut: allied speaker within 3 restores 4 Resolve, or rival within 3 has their next speech reduced to 1 point of stance or Resolve loss (normally 2 or 3). Persuade unlocks in Chapter 7; Promise/Threaten in 8; Address/Rebut in 10; Record/Denounce in 11.

On even turns, rivals attack a nearby player speaker if one is reachable under their targeting rule (−3 Resolve); otherwise they lobby a member (−2 stance). They move into range and declare intent. All effects are deterministic under the encounter's saved seed. Previews list effects and costs. Stance changes, Resolve, movements, cooldowns, promises and RNG are staged inside a complete encounter transaction. Victory commit applies them once. Retry restores the exact start snapshot. A failed Contest may be retried with a patron's bloc (three Landholders start at +3 stance), costing 2 supplies immediately and a five-supply obligation for the syndicate's claim on two harvests; this restarts a playable vote and never grants a milestone.

The authored encounter deadlines below are audited against the campaign data:

| Encounter ID | Deadline turn |
| --- | --- |
| ch7-council | 8 |
| ch8-parley | 10 |
| ch10-tribunal | 12 |
| ch11-accounts | 12 |
| ch11-adlection | 14 |
| ch12-legitimacy | 14 |

Two supported approaches are coalition work (move, Persuade, Promise and Rebut) and public record (Address, Invoke Record and Denounce). Tests exercise actual commands to the deadline. First-slice gates additionally compare objective-aware greedy and tactical battle policies on identical seeds, report losses and turns, and check formations cannot give overlapping extra movement or speech.

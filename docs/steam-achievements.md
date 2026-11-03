# Steam achievements

The 35 achievements the owner approved on 3 November 2026, to enter in Steamworks under the app's achievements (the Steam plan, S3). 24 are hidden until earned: those tied to Chapters IV–XII, the chapters the free demo does not show. Generated from `src/data/achievements.js` by `node scripts/steam-achievements.mjs`; do not edit it by hand.

For each one, enter in Steamworks:
- its **API name** exactly as below, which the game unlocks;
- its display **name** and **description**;
- **Hidden** where it says yes;
- an icon and its locked version, in the sizes Steamworks asks for.

The game unlocks an achievement from what the chronicle records (`src/core/achievements.js`): never by itself, and never from a Practice replay. The desktop app reports them after each save and when a chronicle loads, so a chronicle brought from the browser or the demo unlocks what it has already earned.

## Chapters

| API name | Name | Description | Hidden | Earned by |
| --- | --- | --- | --- | --- |
| `ACH_CHAPTER_01` | The Oath | Complete Chapter I. | no | Chapter 1 completed |
| `ACH_CHAPTER_02` | First Blood | Complete Chapter II. | no | Chapter 2 completed |
| `ACH_CHAPTER_03` | Under the Eagle | Complete Chapter III. | no | Chapter 3 completed |
| `ACH_CHAPTER_04` | Hold the Line | Complete Chapter IV. | yes | Chapter 4 completed |
| `ACH_CHAPTER_05` | The Centurion | Complete Chapter V. | yes | Chapter 5 completed |
| `ACH_CHAPTER_06` | The Broken Standard | Complete Chapter VI. | yes | Chapter 6 completed |
| `ACH_CHAPTER_07` | A Legion to Lead | Complete Chapter VII. | yes | Chapter 7 completed |
| `ACH_CHAPTER_08` | Beyond the Frontier | Complete Chapter VIII. | yes | Chapter 8 completed |
| `ACH_CHAPTER_09` | Rome’s Sword | Complete Chapter IX. | yes | Chapter 9 completed |
| `ACH_CHAPTER_10` | The Province | Complete Chapter X. | yes | Chapter 10 completed |
| `ACH_CHAPTER_11` | The Senate | Complete Chapter XI. | yes | Chapter 11 completed |
| `ACH_CHAPTER_12` | The Purple | Complete Chapter XII and take the purple. | yes | Chapter 12 completed |

## Decorations

| API name | Name | Description | Hidden | Earned by |
| --- | --- | --- | --- | --- |
| `ACH_DECORATION_CORONA_CIVICA` | Civic Crown | Earn the civic crown in Chapter II, for saving a citizen’s life. | no | the `corona_civica` decoration |
| `ACH_DECORATION_ARMILLAE` | Armlets of Valour | Earn the armlets in Chapter III, for valour in a skirmish. | no | the `armillae` decoration |
| `ACH_DECORATION_CORONA_VALLARIS` | Rampart Crown | Earn the rampart crown, for being first over an enemy rampart. | yes | the `corona_vallaris` decoration |
| `ACH_DECORATION_CORONA_MURALIS` | Mural Crown | Earn the mural crown, for being first over a wall. | yes | the `corona_muralis` decoration |
| `ACH_DECORATION_TORQUES` | Torc of Valour | Earn the torc, for valour in the line. | yes | the `torques` decoration |
| `ACH_DECORATION_PHALERAE` | Medals of Service | Earn the medals, for distinguished service in a campaign. | yes | the `phalerae` decoration |
| `ACH_DECORATION_HASTA_PURA` | Spear of Honour | Earn the spear of honour, for distinguished command. | yes | the `hasta_pura` decoration |

## Errand titles

| API name | Name | Description | Hidden | Earned by |
| --- | --- | --- | --- | --- |
| `ACH_TITLE_DRILL_FIRST` | First at the post | Be first at the practice post for Varro in Chapter I. | no | the `drill_first` title |
| `ACH_TITLE_HAMMER_OF_LINE` | Hammer of the line | Carry the split shields to the quartermaster in Chapter II. | no | the `hammer_of_line` title |
| `ACH_TITLE_TRAIL_READER` | Reader of trails | Read the ground at the drill field’s edge for Brennus in Chapter III. | no | the `trail_reader` title |
| `ACH_TITLE_CLERK_OF_ROLLS` | Keeper of the rolls | Help Tertius copy the muster roll in Chapter III. | no | the `clerk_of_rolls` title |
| `ACH_TITLE_SHIELD_OF_COHORT` | Shield of the cohort | Carry the spare brace to the rack inside the gate. | yes | the `shield_of_cohort` title |
| `ACH_TITLE_PATHFINDER` | Pathfinder | Read the road marker and the tracks, and find the way to water. | yes | the `pathfinder` title |
| `ACH_TITLE_ADVOCATE_OF_RANKS` | Advocate of the ranks | Read the boot tally and put the men’s case to Aper. | yes | the `advocate_of_ranks` title |
| `ACH_TITLE_RIVER_SCOUT` | River scout | Sound the landing and find where the carts can cross. | yes | the `river_scout` title |
| `ACH_TITLE_SCRIBE_OF_COUNCIL` | Scribe of the council | Bring Paullus a fair copy of your first report. | yes | the `scribe_of_council` title |

## The finale’s routes

| API name | Name | Description | Hidden | Earned by |
| --- | --- | --- | --- | --- |
| `ACH_ROUTE_BACKER` | Costly Backing | Win the final confrontation with the costly backer’s relief force. | yes | the final confrontation won by the `backer` route |
| `ACH_ROUTE_BATTLE` | Victory in the Field | Win the final confrontation on the field, with no new debt. | yes | the final confrontation won by the `battle` route |
| `ACH_ROUTE_DEFECTION` | The Legions’ Choice | Win the final confrontation by winning over the rival legions. | yes | the final confrontation won by the `defection` route |
| `ACH_ROUTE_SETTLEMENT` | A Negotiated Peace | End the final confrontation with the Senate’s settlement. | yes | the final confrontation won by the `settlement` route |
| `ACH_ROUTE_SURRENDER` | The Gates Open | Receive the rival’s surrender in the final confrontation. | yes | the final confrontation won by the `surrender` route |

## Finishing the campaign

| API name | Name | Description | Hidden | Earned by |
| --- | --- | --- | --- | --- |
| `ACH_FINISH_VETERAN` | Veteran of the Purple | Finish the campaign on Veteran. | no | the accession, on Veteran |
| `ACH_FINISH_IRON` | Iron Discipline | Finish the campaign under Iron discipline, never turned off. | no | the accession, with Iron discipline on |

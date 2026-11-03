# Steam achievements

The 35 achievements the owner approved on 3 November 2026, to enter in Steamworks under the app's achievements (the Steam plan, S3). 24 are hidden until earned: those tied to Chapters IV–XII, the chapters the free demo does not show. Generated from `src/data/achievements.js` by `node scripts/steam-achievements.mjs`; do not edit it by hand.

For each one, enter in Steamworks:
- its **API name** exactly as below, which the game unlocks;
- its display **name** and **description**;
- **Hidden** where it says yes;
- its icon and locked icon: `desktop/steam/achievement-icons/<API name>.jpg` and `<API name>_locked.jpg`, 64 × 64 JPEG.

The icons are made from the game's own art, with nothing new generated: each chapter's painting, the item pictures, the emperor's portrait, the oath seal, and insignia drawn in code where the game has no picture of a decoration. The locked copy is the same icon, greyed. `node scripts/steam-achievement-icons.mjs` remakes them, with a review sheet in `tests/visual-results/steam-icons/`; `--size=` makes another size if Steamworks asks for one.

The game unlocks an achievement from what the chronicle records (`src/core/achievements.js`): never by itself, and never from a Practice replay. The desktop app reports them after each save and when a chronicle loads, so a chronicle brought from the browser or the demo unlocks what it has already earned.

## Chapters

| API name | Name | Description | Hidden | Earned by | Icon |
| --- | --- | --- | --- | --- | --- |
| `ACH_CHAPTER_01` | The Oath | Complete Chapter I. | no | Chapter 1 completed | frontier-oath painting, I |
| `ACH_CHAPTER_02` | First Blood | Complete Chapter II. | no | Chapter 2 completed | marsh painting, II |
| `ACH_CHAPTER_03` | Under the Eagle | Complete Chapter III. | no | Chapter 3 completed | danube painting, III |
| `ACH_CHAPTER_04` | Hold the Line | Complete Chapter IV. | yes | Chapter 4 completed | danube painting, IV |
| `ACH_CHAPTER_05` | The Centurion | Complete Chapter V. | yes | Chapter 5 completed | eastern-fort painting, V |
| `ACH_CHAPTER_06` | The Broken Standard | Complete Chapter VI. | yes | Chapter 6 completed | eastern-fort painting, VI |
| `ACH_CHAPTER_07` | A Legion to Lead | Complete Chapter VII. | yes | Chapter 7 completed | danube painting, VII |
| `ACH_CHAPTER_08` | Beyond the Frontier | Complete Chapter VIII. | yes | Chapter 8 completed | river-crossing painting, VIII |
| `ACH_CHAPTER_09` | Rome’s Sword | Complete Chapter IX. | yes | Chapter 9 completed | eastern-fort painting, IX |
| `ACH_CHAPTER_10` | The Province | Complete Chapter X. | yes | Chapter 10 completed | province painting, X |
| `ACH_CHAPTER_11` | The Senate | Complete Chapter XI. | yes | Chapter 11 completed | rome painting, XI |
| `ACH_CHAPTER_12` | The Purple | Complete Chapter XII and take the purple. | yes | Chapter 12 completed | accession painting, XII |

## Decorations

| API name | Name | Description | Hidden | Earned by | Icon |
| --- | --- | --- | --- | --- | --- |
| `ACH_DECORATION_CORONA_CIVICA` | Civic Crown | Earn the civic crown in Chapter II, for saving a citizen’s life. | no | the `corona_civica` decoration | drawn oak wreath |
| `ACH_DECORATION_ARMILLAE` | Armlets of Valour | Earn the armlets in Chapter III, for valour in a skirmish. | no | the `armillae` decoration | drawn armlets |
| `ACH_DECORATION_CORONA_VALLARIS` | Rampart Crown | Earn the rampart crown, for being first over an enemy rampart. | yes | the `corona_vallaris` decoration | drawn palisade crown |
| `ACH_DECORATION_CORONA_MURALIS` | Mural Crown | Earn the mural crown, for being first over a wall. | yes | the `corona_muralis` decoration | drawn walled crown |
| `ACH_DECORATION_TORQUES` | Torc of Valour | Earn the torc, for valour in the line. | yes | the `torques` decoration | `gothic_torc` picture |
| `ACH_DECORATION_PHALERAE` | Medals of Service | Earn the medals, for distinguished service in a campaign. | yes | the `phalerae` decoration | drawn medals |
| `ACH_DECORATION_HASTA_PURA` | Spear of Honour | Earn the spear of honour, for distinguished command. | yes | the `hasta_pura` decoration | `hasta` picture |

## Errand titles

| API name | Name | Description | Hidden | Earned by | Icon |
| --- | --- | --- | --- | --- | --- |
| `ACH_TITLE_DRILL_FIRST` | First at the post | Be first at the practice post for Varro in Chapter I. | no | the `drill_first` title | `gladius` picture |
| `ACH_TITLE_HAMMER_OF_LINE` | Hammer of the line | Carry the split shields to the quartermaster in Chapter II. | no | the `hammer_of_line` title | `parma` picture |
| `ACH_TITLE_TRAIL_READER` | Reader of trails | Read the ground at the drill field’s edge for Brennus in Chapter III. | no | the `trail_reader` title | `quiver` picture |
| `ACH_TITLE_CLERK_OF_ROLLS` | Keeper of the rolls | Help Tertius copy the muster roll in Chapter III. | no | the `clerk_of_rolls` title | `signaculum` picture |
| `ACH_TITLE_SHIELD_OF_COHORT` | Shield of the cohort | Carry the spare brace to the rack inside the gate. | yes | the `shield_of_cohort` title | `scutum` picture |
| `ACH_TITLE_PATHFINDER` | Pathfinder | Read the road marker and the tracks, and find the way to water. | yes | the `pathfinder` title | `sagum` picture |
| `ACH_TITLE_ADVOCATE_OF_RANKS` | Advocate of the ranks | Read the boot tally and put the men’s case to Aper. | yes | the `advocate_of_ranks` title | `caligae` picture |
| `ACH_TITLE_RIVER_SCOUT` | River scout | Sound the landing and find where the carts can cross. | yes | the `river_scout` title | `olive_oil` picture |
| `ACH_TITLE_SCRIBE_OF_COUNCIL` | Scribe of the council | Bring Paullus a fair copy of your first report. | yes | the `scribe_of_council` title | `report_copy` picture |

## The finale’s routes

| API name | Name | Description | Hidden | Earned by | Icon |
| --- | --- | --- | --- | --- | --- |
| `ACH_ROUTE_BACKER` | Costly Backing | Win the final confrontation with the costly backer’s relief force. | yes | the final confrontation won by the `backer` route | `coin_purse` picture |
| `ACH_ROUTE_BATTLE` | Victory in the Field | Win the final confrontation on the field, with no new debt. | yes | the final confrontation won by the `battle` route | `spatha` picture |
| `ACH_ROUTE_DEFECTION` | The Legions’ Choice | Win the final confrontation by winning over the rival legions. | yes | the final confrontation won by the `defection` route | `galea` picture |
| `ACH_ROUTE_SETTLEMENT` | A Negotiated Peace | End the final confrontation with the Senate’s settlement. | yes | the final confrontation won by the `settlement` route | `silver_brooch` picture |
| `ACH_ROUTE_SURRENDER` | The Gates Open | Receive the rival’s surrender in the final confrontation. | yes | the final confrontation won by the `surrender` route | `key_c1` picture |

## Finishing the campaign

| API name | Name | Description | Hidden | Earned by | Icon |
| --- | --- | --- | --- | --- | --- |
| `ACH_FINISH_VETERAN` | Veteran of the Purple | Finish the campaign on Veteran. | no | the accession, on Veteran | emperor’s portrait |
| `ACH_FINISH_IRON` | Iron Discipline | Finish the campaign under Iron discipline, never turned off. | no | the accession, with Iron discipline on | oath seal |

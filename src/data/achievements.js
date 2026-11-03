// Steam achievements (the Steam plan, docs/steam-plan.md, S3). The owner approved the list on 3 November 2026: 35, with
// English names, and the 24 tied to Chapters IV–XII (the chapters the free demo does not show) hidden on Steam until
// earned. Each is earned from what a chronicle already records (core/achievements.js): none is ever granted by itself.
// `id` is the Steamworks API name; docs/steam-achievements.md lists them for entering in Steamworks
// (node scripts/steam-achievements.mjs).
const freeze=Object.freeze;
const ROMAN=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
const CHAPTER_NAMES=['The Oath','First Blood','Under the Eagle','Hold the Line','The Centurion','The Broken Standard','A Legion to Lead',
  'Beyond the Frontier','Rome’s Sword','The Province','The Senate','The Purple'];

const chapters=CHAPTER_NAMES.map((name,i)=>({id:`ACH_CHAPTER_${String(i+1).padStart(2,'0')}`,group:'chapter',name,
  description:i===11?'Complete Chapter XII and take the purple.':`Complete Chapter ${ROMAN[i]}.`,hidden:i+1>=4,earned:{chapter:i+1}}));

const decorations=[
  ['corona_civica','Civic Crown','Earn the civic crown in Chapter II, for saving a citizen’s life.',false],
  ['armillae','Armlets of Valour','Earn the armlets in Chapter III, for valour in a skirmish.',false],
  ['corona_vallaris','Rampart Crown','Earn the rampart crown, for being first over an enemy rampart.',true],
  ['corona_muralis','Mural Crown','Earn the mural crown, for being first over a wall.',true],
  ['torques','Torc of Valour','Earn the torc, for valour in the line.',true],
  ['phalerae','Medals of Service','Earn the medals, for distinguished service in a campaign.',true],
  ['hasta_pura','Spear of Honour','Earn the spear of honour, for distinguished command.',true],
].map(([decoration,name,description,hidden])=>({id:`ACH_DECORATION_${decoration.toUpperCase()}`,group:'decoration',name,description,hidden,earned:{decoration}}));

const titles=[
  ['drill_first','First at the post','Be first at the practice post for Varro in Chapter I.',false],
  ['hammer_of_line','Hammer of the line','Carry the split shields to the quartermaster in Chapter II.',false],
  ['trail_reader','Reader of trails','Read the ground at the drill field’s edge for Brennus in Chapter III.',false],
  ['clerk_of_rolls','Keeper of the rolls','Help Tertius copy the muster roll in Chapter III.',false],
  ['shield_of_cohort','Shield of the cohort','Carry the spare brace to the rack inside the gate.',true],
  ['pathfinder','Pathfinder','Read the road marker and the tracks, and find the way to water.',true],
  ['advocate_of_ranks','Advocate of the ranks','Read the boot tally and put the men’s case to Aper.',true],
  ['river_scout','River scout','Sound the landing and find where the carts can cross.',true],
  ['scribe_of_council','Scribe of the council','Bring Paullus a fair copy of your first report.',true],
].map(([title,name,description,hidden])=>({id:`ACH_TITLE_${title.toUpperCase()}`,group:'title',name,description,hidden,earned:{title}}));

const routes=[
  ['backer','Costly Backing','Win the final confrontation with the costly backer’s relief force.'],
  ['battle','Victory in the Field','Win the final confrontation on the field, with no new debt.'],
  ['defection','The Legions’ Choice','Win the final confrontation by winning over the rival legions.'],
  ['settlement','A Negotiated Peace','End the final confrontation with the Senate’s settlement.'],
  ['surrender','The Gates Open','Receive the rival’s surrender in the final confrontation.'],
].map(([route,name,description])=>({id:`ACH_ROUTE_${route.toUpperCase()}`,group:'route',name,description,hidden:true,earned:{route}}));

const finishes=[
  {id:'ACH_FINISH_VETERAN',group:'finish',name:'Veteran of the Purple',description:'Finish the campaign on Veteran.',hidden:false,earned:{finish:'veteran'}},
  {id:'ACH_FINISH_IRON',group:'finish',name:'Iron Discipline',description:'Finish the campaign under Iron discipline, never turned off.',hidden:false,earned:{finish:'iron'}},
];

export const ACHIEVEMENTS=freeze([...chapters,...decorations,...titles,...routes,...finishes].map(a=>freeze({...a,earned:freeze(a.earned)})));

// Release 7's missions (worlds and gameplay plan): version 3 of the operations, played by
// campaigns begun from release 7 (state.missionsVersion 1). Like versions 1 and 2, an
// immutable save contract: a later revision needs a version of its own. Battles it does not
// re-author keep their version 1 phases and version 2 branches.
//
// Every phase uses a mode both paths play (capture, hold, extract, clear); the new keys add
// real time's own rules, and the turn-based path reads them only where it says so:
// - works: the enemy's siege works on the phase's capture points, each destroyed when its
//   point is secured. A ladder stands against the wall at `at` and has put its first climbers
//   on the wall walk at its point (both paths); beating them throws it down too. A ram stands
//   on its point and batters the gate at `gate` (real time). While any stands, the defended
//   line loses the battle's pressure each round (both paths).
// - lure: the phase's objective is the named enemy horse at the marker, drawn there by a
//   feigned flight (both paths), not our men; it is also done once none of that horse is left.
// - convoy: protected columns walk the route on their own, through each point in turn
//   (both paths), halting when threatened (real time).
// - lines: a fallback line; our squads holding the objective follow it back.
// - fire: the far bank's archers loose a volley each round at our men in the water or at
//   the landing, while the enemy's archers stand (real time).
// An operation's `deploy` is the tiles of the real-time deployment zone (Chapter VII on) when
// it is not the usual four: a crossing deploys on its own bank, short of the river.
import {BATTLE_OPERATIONS} from './battle-operations.js';
import {PROGRESSION_OPERATIONS} from './progression-operations.js';

const route=(id,label,description,last,reward,benefit,phases=null)=>({id,label,description,last,reward,benefit,...(phases?{phases}:{})});

// The relief convoy's two roads (Chapter X): opened at their ford and their east end, then
// walked by the grain wagons to the stores at 3D.
const convoyPhases=(road,ford,east,start)=>[
  {id:'route',label:`Open the ${road} road`,objective:`Clear the ${road} road at its ford (${ford.name}) and its east end (${east.name}) before the grain wagons set out.`,
    mode:'capture',goal:[2,3],points:[ford.at,east.at]},
  {id:'convoy',label:'Bring the convoy in',objective:`The grain wagons follow the ${road} road to the stores at 3D on their own. Keep the road open ahead of them; the commander meets them at the stores.`,
    mode:'extract',goal:[2,3],escort:{id:'convoy',name:'Grain wagons',at:start,hp:24},convoy:{route:[east.at,ford.at,[2,3]]},wave:{delay:1,x:7,y:4,role:'raider'}}];
const NORTH=convoyPhases('north',{name:'4B',at:[3,1]},{name:'6B',at:[5,1]},[7,1]);
const SOUTH=convoyPhases('south',{name:'4G',at:[3,6]},{name:'6G',at:[5,6]},[7,6]);

export const MISSION_OPERATIONS={
  ...BATTLE_OPERATIONS,
  // Chapter IV, the escalade: the Goths raise ladders against the curtain either side of the
  // barred gate; then the rear files come out as before.
  'ch4-gate':{extraTurns:3,phases:[
    {id:'ladders',label:'Throw down the ladders',objective:'The Goths raise ladders against the wall at 4B and 4F. Beat the climbers on the wall walk beside each, at 3B and 3F, or hold it with no enemy at its head, to throw the ladder down.',
      mode:'capture',goal:[2,3],points:[[2,1],[2,5]],works:[{id:'ladder-north',kind:'ladder',at:[3,1],name:'North ladder',climber:'Gothic climber'},
        {id:'ladder-south',kind:'ladder',at:[3,5],name:'South ladder',climber:'Gothic climber'}]},
    BATTLE_OPERATIONS['ch4-gate'].phases[1]]},
  // Chapter V, the sortie: out by the postern to burn the ram at the river gate, then back in.
  'ch5-wall':{extraTurns:2,phases:[
    {id:'sortie',label:'Burn the ram',objective:'The Persians’ ram batters the river gate at 5E. Go out by the postern at 5D and hold the ram’s ground at 6E, with no enemy beside it, to burn it.',
      mode:'capture',goal:[5,4],points:[[5,4]],works:[{id:'ram',kind:'ram',at:[5,4],gate:[4,4],name:'Persian ram',gateName:'River gate'}]},
    {id:'gate',label:'Hold the river gate',objective:'Back behind the wall: hold the gate at 4E for two rounds, or clear the enemy and reach it, while the last boats leave.',
      mode:'hold',goal:[3,4],hold:2}]},
  // Chapter VI, the rearguard: two lines held in turn while the column goes west, then out.
  'ch6-wells':{extraTurns:3,phases:[
    {id:'first-line',label:'Hold the first line',objective:'Stand across the road at 5E for a round beside the stranded party, assisting anyone who cannot walk, while the column starts west. Rally the line if it wavers.',
      mode:'hold',goal:[4,4],hold:1,rescue:true,lines:true,convoy:{route:[[3,3],[1,3],[0,3]]}},
    {id:'second-line',label:'Fall back to the second line',objective:'Fall back to the junction at 3D and hold it for a round while the column clears the road behind you.',
      mode:'hold',goal:[2,3],hold:1,lines:true,convoy:{route:[[1,3],[0,3]]}},
    {id:'withdraw',label:'Follow the column out',objective:'Bring the column and the commander to the western route at 1D.',mode:'extract',goal:[0,3],convoy:{route:[[0,3]]}}]},
  // Chapter VIII, the crossing under fire: the ford's far landing taken under the volleys,
  // held, and the last ferry party brought in as before.
  'ch8-crossing':{extraTurns:5,deploy:2,phases:[
    {id:'ford',label:'Force the ford',objective:'Cross at the ford under the archers’ volleys and take the far landing at 4D. Keep moving in the water.',
      mode:'capture',goal:[3,3],points:[[3,3]],fire:true},
    {id:'landing',label:'Hold the landing',objective:'Hold the bridgehead at 5E for a round, or clear the enemy and reach it, so the last ferry party can land.',mode:'hold',goal:[4,4],hold:1,fire:true},
    BATTLE_OPERATIONS['ch8-crossing'].phases[1]]},
  // Chapter IX, the feigned retreat: the armoured horse drawn after a feigned flight onto the
  // line at 2D, then turned on and broken.
  'ch9-wing':{extraTurns:3,phases:[
    {id:'feint',label:'Draw the armoured horse',objective:'Feign flight before the armoured horse and draw it onto the line waiting at 2D: the phase ends when its riders reach the marker, or when none is left in the saddle.',
      mode:'capture',goal:[1,3],points:[[1,3]],lure:'cavalry'},
    {id:'pursuit',label:'Turn and break them',objective:'Turn on the strung-out riders and defeat the field force.',mode:'clear',goal:[6,4]}]},
  // Chapter X, the relief convoy: the north road unless camp chose the south (MISSION_BRANCHES).
  'ch10-road':{extraTurns:4,deploy:3,phases:NORTH}
};

// The camp's operation choices for version 3: version 2's, except where the mission changed.
// A choice replaces the operation's last phase (`last`) or all of them (`phases`).
export const MISSION_BRANCHES={
  ...PROGRESSION_OPERATIONS,
  'ch4-gate':[
    route('evacuate','Evacuate the rear files','Throw down the ladders, then extract the garrison; rested veterans strengthen the next battle.',null,{public:2},'reserve'),
    route('hold','Hold for the baggage train','After the ladders, keep the gate approach for three rounds instead of ordering the rear files out. Recover supplies at greater exposure.',
      PROGRESSION_OPERATIONS['ch4-gate'][1].last,{supplies:3},'stores')],
  'ch6-wells':[
    route('west','Withdraw by the western route','Hold two lines in turn, then follow the column out to the western route. Preserve a rested reserve.',null,{public:2},'reserve'),
    route('third-line','Stand a third line','After the second line, hold the shrine at 2D for two more rounds while the column gets clear. The scouts’ reports come out with it.',
      {id:'third-line',label:'Stand the third line',objective:'Hold the shrine at 2D for two rounds, or clear the enemy and reach it, while the column gets clear.',mode:'hold',goal:[1,3],hold:2,lines:true,convoy:{route:[[0,3]]}},
      {political:2},'intelligence')],
  'ch8-crossing':[
    route('last-ferry','Guard the last ferry','Force the ford, hold the landing, then bring the last households across under raider pressure.',null,{public:2},'reserve'),
    route('stores','Guard the supply ferry','Force the ford and hold the landing, then escort the supply party from the southern landing under the same announced raid.',
      PROGRESSION_OPERATIONS['ch8-crossing'][1].last,{supplies:3},'stores')],
  'ch10-road':[
    route('north','The north road','The convoy takes the shorter north road, under the hill the raiders’ archers watch. The granary’s gratitude follows.',null,{public:2},'stores',NORTH),
    route('south','The south road','The convoy takes the longer south road, away from the archers. The army credits the care, and the route’s scouts report what they saw.',null,{army:2},'intelligence',SOUTH)]
};

// Each re-authored battle's own pair of field opportunities, in place of its chapter's (the stores
// opportunity first, then the signal's), using the effects the chapters' pairs already have.
const opportunity=(label,effect,description)=>({label,effect,description});
export const MISSION_OPPORTUNITIES={
  'ch4-gate':[opportunity('Prop the wall walk with timbers','integrity','Restore 20 defended integrity, up to 100.'),
    opportunity('Sound the alarm along the wall','standard','Restore 20 cohesion and 10 morale to every living friendly formation.')],
  'ch5-wall':[opportunity('Hold the postern open','engineering','Open the side gate and repair the footbridge: two more ways out to the ram and back.'),
    opportunity('Fill the fire pots','disrupt','Reduce every visible enemy’s cohesion by 15.')],
  'ch6-wells':[opportunity('Fill the water skins','water','Extinguish every burning pitch brazier and restore two health to living friendly formations and protected columns.'),
    opportunity('Clear the column’s road','escort','Protected columns move up to three tiles per round.')],
  'ch8-crossing':[opportunity('Repair the footbridge upstream','engineering','Open the side gate and repair the footbridge: a second crossing, out of the ford.'),
    opportunity('Recover the casualty satchels','medicine','Restore three health to every living friendly formation and protected column.')],
  'ch9-wing':[opportunity('Stake the line at the marker','anti-charge','Enemy mounted charges lose their extra damage for the rest of the encounter.'),
    opportunity('Bring up the remounts','command','Gain one command now and one per later round, up to eight.')],
  'ch10-road':[opportunity('Grease the wagon axles','escort','Protected columns move up to three tiles per round.'),
    opportunity('Secure the granary receipts','stores','Recover two supplies on victory; the receipts become evidence of accountable provisioning.')]
};

/** A version 3 operation: its phases, with the camp's choice applied when there is one. */
export function missionOperationDefinition(id,choice=null){
  const base=MISSION_OPERATIONS[id];if(!base)return null;if(choice===null)return base;
  const branch=MISSION_BRANCHES[id]?.find(x=>x.id===choice);if(!branch)return null;
  if(branch.phases)return {...base,branch,phases:branch.phases};
  return {...base,extraTurns:base.extraTurns+(branch.last?3:0),branch,phases:base.phases.map((p,i)=>i===base.phases.length-1&&branch.last?branch.last:p)};
}

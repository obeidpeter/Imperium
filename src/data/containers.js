// Chests and other containers (release 11, docs/worlds-and-gameplay-plan.md):
// authored contents, the same on every level and drawn from no random stream.
// Each camp has three or four; most battlefields one or two. A container opens
// once: in camp what is taken is recorded in the chronicle (soldier.opened); on
// a battlefield it is staged like the spoils of the fallen, so Retry restores
// it and a reload can't duplicate it. A lock opens with its key, found
// elsewhere in the same camp or field, or is forced by a strong enough soldier:
// there is always a way that needs no attribute. A hidden container shows
// itself to a soldier who comes close enough (Perception widens the distance)
// and, on a battlefield, to Scout.

const freeze=value=>Object.freeze(value);

// What each kind is called, and how long opening it takes in the field.
export const CONTAINER_KINDS=freeze({
  chest:freeze({name:'Chest',work_s:1}),strongbox:freeze({name:'Strongbox',work_s:1.5}),locker:freeze({name:'Locker',work_s:.8}),
  basket:freeze({name:'Basket',work_s:.6}),crate:freeze({name:'Crate',work_s:1}),sack:freeze({name:'Sack',work_s:.6}),
  satchel:freeze({name:'Satchel',work_s:.5}),trunk:freeze({name:'Trunk',work_s:1}),coffer:freeze({name:'Coffer',work_s:1}),
  cache:freeze({name:'Cache',work_s:1.2}),baggage:freeze({name:'Baggage',work_s:1})});
// Forcing a lock takes this long in the field, and stops if the soldier is struck.
export const FORCE_WORK_S=5;
// A hidden container shows itself within this many metres, plus one for every
// two points of Perception above 10.
export const HIDDEN_NOTICE_M=2.5;

const box=(id,data)=>freeze({id,hidden:false,lock:null,...data,contents:freeze([...data.contents]),
  ...(data.lock?{lock:freeze({...data.lock,...(data.lock.force?{force:freeze({...data.lock.force})}:{})})}:{})});

// Camp containers, by chapter: `place` and `at` as for a camp's objects (a
// place and an offset in metres). The text says why the soldier may open it.
export const CAMP_CONTAINERS=freeze({
  1:freeze([
    box('c1-spare-kit',{kind:'chest',name:'Aper’s spare kit chest',place:'quartermaster',at:[2,-0.8],contents:['sagum','calcei','key_c1'],
      text:'Aper’s chalk on the lid: “Recruits. Take what fits; it is yours by issue. The old armoury key is in here somewhere.”'}),
    box('c1-locker',{kind:'locker',name:'Your locker',place:'barracks',at:[-2,0.8],contents:['coin_purse','wine_skin'],
      text:'Your own locker, with your name scratched on the lid and a recruit’s bounty inside.'}),
    box('c1-armoury',{kind:'chest',name:'The old armoury chest',place:'drill',at:[-2,-0.8],contents:['gladius','amulet_mars'],
      lock:{key:'key_c1',force:{str:13}},text:'Varro has told the recruits to clear it out before the new issue arrives.'})]),
  2:freeze([
    box('c2-wagon',{kind:'chest',name:'A broken wagon’s chest',place:'quartermaster',at:[2,-0.8],contents:['parma','coin_purse','key_c2'],
      text:'The wagon lost a wheel on the causeway. The orderly says whatever is left belongs to whoever carries it.'}),
    box('c2-basket',{kind:'basket',name:'The century’s spare basket',place:'barracks',at:[0,-2.2],contents:['bracae_thick','wine_skin'],
      text:'Spare clothing for the march, free to any man of the century.'}),
    box('c2-salvage',{kind:'strongbox',name:'A strongbox from the river',place:'canabae',at:[2.8,1.1],contents:['silver_brooch','phylactery','coin_purse'],
      lock:{key:'key_c2',force:{str:13}},text:'Pulled from the river by the ferrymen; nobody has claimed it.'})]),
  3:freeze([
    box('c3-lockers',{kind:'locker',name:'Lockers from the station',place:'barracks',at:[-2,0.8],contents:['hasta','key_c3'],
      text:'The station’s garrison is gone. Crispus has released their lockers to the recovery party.'}),
    box('c3-satchel',{kind:'satchel',name:'A courier’s satchel',place:'principia',at:[2,0.8],contents:['wax_tablet','coin_purse'],
      text:'Its courier was buried at the station. The clerk has copied his last message; the rest is the finder’s.'}),
    box('c3-iron-chest',{kind:'chest',name:'The station’s iron chest',place:'quartermaster',at:[2,-0.8],contents:['galea_tinned'],
      lock:{key:'key_c3',force:{str:14}},text:'The station’s spare kit, locked when the garrison left.'}),
    box('c3-milestone',{kind:'cache',name:'A cache under the milestone',place:'canabae',at:[2.8,1.1],contents:['ring_belt','coin_purse'],hidden:true,
      text:'Someone hid this beneath the milestone and never came back for it.'})]),
  4:freeze([
    box('c4-armoury',{kind:'crate',name:'The fort’s spare armoury',place:'quartermaster',at:[1.6,-1.6],contents:['ocreae','coin_purse'],
      text:'Surplus from the fort’s armoury, released to men who will hold the line.'}),
    box('c4-lost',{kind:'chest',name:'The lost-property chest',place:'barracks',at:[0,-2.2],contents:['eye_amulet','key_c4'],
      text:'Odds and ends nobody has claimed since the last muster.'}),
    box('c4-tower',{kind:'chest',name:'A chest in the gate tower',place:'principia',at:[2,0.8],contents:['manica_scale'],
      lock:{key:'key_c4',force:{str:14}},text:'The watch keeps its spare arm guards here.'})]),
  5:freeze([
    box('c5-engineers',{kind:'crate',name:'The engineers’ spare crate',place:'quartermaster',at:[3.4,0],contents:['subarmalis_thick','key_c5'],
      text:'The fortress engineer has opened the spare crate to anyone going near the works.'}),
    box('c5-cistern',{kind:'cache',name:'A cache behind the cistern',place:'canabae',at:[0.8,-2],contents:['persian_dagger','coin_purse'],hidden:true,
      text:'Wrapped in oiled cloth: someone expected to come back.'}),
    box('c5-strongbox',{kind:'strongbox',name:'The garrison’s strongbox',place:'principia',at:[2.2,0],contents:['niederbieber'],
      lock:{key:'key_c5',force:{str:14}},text:'Held for the garrison’s best men. The commander has named you one of them.'})]),
  6:freeze([
    box('c6-baggage',{kind:'baggage',name:'Abandoned baggage',place:'quartermaster',at:[-2.2,0],contents:['linen_tunic','dates','key_c6'],
      text:'Left by the column when the mules gave out.'}),
    box('c6-medical',{kind:'chest',name:'A medical chest',place:'valetudinarium',at:[-2,0.8],contents:['medicine_box','phylactery'],
      text:'The orderly has more than he can carry and less than he needs; he gives you the spare.'}),
    box('c6-trunk',{kind:'trunk',name:'An officer’s travelling trunk',place:'principia',at:[2,0.8],contents:['ring_sword','coin_purse'],
      lock:{key:'key_c6',force:{str:14}},text:'Its owner fell at the wells. His friends would rather it went to a soldier than to the river.'})]),
  7:freeze([
    box('c7-stores',{kind:'crate',name:'Surplus stores',place:'quartermaster',at:[-2,-0.8],contents:['dart_belt','olive_oil','key_c7'],
      text:'The legion has drawn more than it can march with.'}),
    box('c7-trunk',{kind:'trunk',name:'A tribune’s spare trunk',place:'barracks',at:[0,-2.2],contents:['tunic_clavi'],
      text:'A tribune’s gift to the officer who will speak at his council.'}),
    box('c7-courier',{kind:'strongbox',name:'The courier’s strongbox',place:'principia',at:[2,0.8],contents:['coin_purse','coin_purse','silver_brooch'],
      lock:{key:'key_c7',force:{str:15}},text:'Taken from the usurper’s courier. Its letters went to the council; its coin goes to the men.'})]),
  8:freeze([
    box('c8-ferry',{kind:'chest',name:'The ferrymen’s chest',place:'quartermaster',at:[-1,-2.4],contents:['smoked_fish','key_c8'],
      text:'The ferrymen keep their spare keys and their supper here.'}),
    box('c8-crate',{kind:'crate',name:'An unclaimed trader’s crate',place:'canabae',at:[-2,0.8],contents:['honey_jar','coin_purse'],
      text:'The trader says it was paid for and never fetched. Take it before the boats do.'}),
    box('c8-boatshed',{kind:'chest',name:'The boat-shed chest',place:'drill',at:[-2,-0.8],contents:['hasta_fine'],
      lock:{key:'key_c8',force:{str:15}},text:'Where the river patrol keeps its good spears.'})]),
  9:freeze([
    box('c9-arms',{kind:'crate',name:'Surrendered arms',place:'quartermaster',at:[-2,-0.8],contents:['cavalry_oval','lancea'],
      text:'Laid down by the surrendered garrison and counted by the clerks. The legate lets his officers choose first.'}),
    box('c9-baggage',{kind:'baggage',name:'A Palmyrene officer’s baggage',place:'principia',at:[2.2,0],contents:['incense','eye_amulet','key_c9'],
      text:'Surrendered with the rest. Its owner asked only for his letters back.'}),
    box('c9-coffer',{kind:'coffer',name:'A gilded coffer',place:'barracks',at:[0,-2.2],contents:['coin_purse','coin_purse','persian_dagger'],
      lock:{key:'key_c9',force:{str:15}},text:'The army’s share of the surrender, set aside for its officers.'})]),
  10:freeze([
    box('c10-granary',{kind:'chest',name:'The granary chest',place:'quartermaster',at:[-2.2,0],contents:['olive_oil','coin_purse','key_c10'],
      text:'The granary’s chest of small things, and the steward’s keys.'}),
    box('c10-armour',{kind:'chest',name:'The governor’s armour chest',place:'principia',at:[-0.8,-2],contents:['ocreae_fine'],
      lock:{key:'key_c10',force:{str:15}},text:'Armour the governor keeps for his escort, now yours to command.'}),
    box('c10-smuggler',{kind:'cache',name:'A smuggler’s cache',place:'canabae',at:[0,-2.2],contents:['garum','silver_brooch','coin_purse'],hidden:true,
      text:'Hidden under a loose paving stone. The smugglers will not be back for it.'})]),
  11:freeze([
    box('c11-bequest',{kind:'chest',name:'A veteran’s bequest',place:'barracks',at:[0,-2.2],contents:['amulet_mars','coin_purse','key_c11'],
      text:'An old soldier left it to the first officer of his legion to stand for the Senate.'}),
    box('c11-armoury',{kind:'crate',name:'An armourer’s remnants',place:'quartermaster',at:[1.6,-1.6],contents:['scutum_light'],
      text:'Bassus bought a dead armourer’s stock; this crate he says is yours.'}),
    box('c11-archive',{kind:'coffer',name:'A sealed archive box',place:'principia',at:[-2,0.8],contents:['papyrus_roll','coin_purse','coin_purse'],
      lock:{key:'key_c11',force:{str:15}},text:'The veteran’s papers and savings, sealed for his heir. He named none but you.'})]),
  12:freeze([
    box('c12-standards',{kind:'chest',name:'The standards’ chest',place:'principia',at:[2,0.8],contents:['coin_purse','coin_purse'],
      text:'The legions’ gift to the man they follow.'}),
    box('c12-armoury',{kind:'crate',name:'The loyalists’ armoury',place:'quartermaster',at:[-2,0.8],contents:['hamata_fine'],
      text:'The best mail the loyal legions could find, for the man who leads them.'}),
    box('c12-ranks',{kind:'basket',name:'A gift from the ranks',place:'barracks',at:[0,-2.2],contents:['birrus','honey_jar'],
      text:'Wrapped in a cloak and left without a name.'})])});

// Battlefield containers, by encounter. `anchor` places each one on the
// field: near the enemy's start ('enemy'), behind the soldier's own ('own'),
// near the objective ('objective') or out on a flank ('flank'); `along` and
// `aside` are fractions of the way from the soldier's start towards the
// anchor and across that line.
export const FIELD_CONTAINERS=freeze({
  'ch1-road':freeze([box('road-sack',{kind:'sack',name:'A raider’s sack',anchor:'enemy',contents:['coin_purse','wine_skin'],
    text:'Plunder from the farms along the road.'})]),
  'ch2-marsh':freeze([box('marsh-satchel',{kind:'satchel',name:'A drowned courier’s satchel',anchor:'objective',contents:['phylactery','coin_purse'],hidden:true,
    text:'Half sunk in the reeds.'})]),
  'ch2-rearguard':freeze([box('rearguard-baggage',{kind:'baggage',name:'Abandoned baggage',anchor:'own',contents:['lancea','bracae_thick'],
    text:'Dropped by the column ahead when the raiders came.'})]),
  'ch3-station':freeze([
    box('station-strongbox',{kind:'strongbox',name:'The station strongbox',anchor:'objective',contents:['gladius_fine','coin_purse'],
      lock:{key:'key_f3',force:{str:14}},text:'The station’s own strongbox. The raiders’ leader carries its key.'}),
    box('station-cache',{kind:'cache',name:'The raiders’ cache',anchor:'enemy',contents:['silver_brooch','coin_purse'],hidden:true,
      text:'Buried under the woodpile.'})]),
  'ch3-rolls':freeze([box('rolls-cart',{kind:'chest',name:'A broken cart’s chest',anchor:'flank',contents:['subarmalis_thick'],
    text:'The cart went into the ditch; its chest did not.'})]),
  'ch4-gate':freeze([box('gate-plunder',{kind:'sack',name:'The raiders’ plunder',anchor:'enemy',contents:['gothic_torc','coin_purse'],
    text:'What the war band took on the way to the gate.'})]),
  'ch4-wall':freeze([box('wall-strongbox',{kind:'strongbox',name:'An officer’s strongbox',anchor:'objective',contents:['hamata_bronze'],
    lock:{key:'key_f4',force:{str:15}},text:'Its seal is a centurion’s. The war band’s chieftain carries the key.'})]),
  'ch5-mine':freeze([box('mine-crate',{kind:'crate',name:'The sappers’ crate',anchor:'own',contents:['eye_amulet','coin_purse'],
    text:'Left behind by the sappers when the tunnel fell in.'})]),
  'ch5-wall':freeze([
    box('wall-baggage',{kind:'baggage',name:'A Persian noble’s baggage',anchor:'enemy',contents:['sword_sasanian'],
      text:'Dropped in the rout from the ram.'}),
    box('wall-supplies',{kind:'crate',name:'A supply crate',anchor:'own',contents:['dates','medicine_box'],
      text:'The garrison’s spare stores.'})]),
  'ch6-wells':freeze([box('wells-stores',{kind:'baggage',name:'Abandoned stores',anchor:'own',contents:['birrus','coin_purse'],
    text:'The column left what it could not carry.'})]),
  'ch6-eagle':freeze([box('eagle-plunder',{kind:'sack',name:'The raiders’ plunder',anchor:'enemy',contents:['scutum_victory'],
    text:'Stripped from a fallen standard-bearer.'})]),
  'ch7-legion':freeze([box('legion-baggage',{kind:'trunk',name:'The usurper’s officers’ baggage',anchor:'enemy',contents:['spatha_aquileia','coin_purse'],
    text:'Abandoned when the usurper’s line broke.'})]),
  'ch8-ferry':freeze([box('ferry-chest',{kind:'chest',name:'A ferryman’s chest',anchor:'flank',contents:['calcei_nailed','honey_jar'],
    text:'The ferryman would rather a soldier had it than the war band.'})]),
  'ch8-crossing':freeze([box('crossing-cache',{kind:'cache',name:'A cache in the reeds',anchor:'flank',contents:['niederbieber_engraved'],hidden:true,
    text:'Wrapped in oiled leather and sunk in the shallows.'})]),
  'ch9-wing':freeze([box('wing-baggage',{kind:'baggage',name:'Palmyrene baggage',anchor:'enemy',contents:['lamellar_eastern','incense'],
    text:'Left behind when the armoured horse turned.'})]),
  'ch9-city':freeze([box('city-strongbox',{kind:'strongbox',name:'A merchant’s strongbox',anchor:'objective',contents:['squamata_tinned','coin_purse'],
    lock:{key:'key_f9',force:{str:15}},text:'The defending captain took the key when he seized it.'})]),
  'ch10-road':freeze([box('road-wagon',{kind:'chest',name:'A raided wagon’s chest',anchor:'flank',contents:['olive_oil','coin_purse'],
    text:'The raiders had no time to open it.'})])});

export const containersInCamp=chapter=>CAMP_CONTAINERS[chapter]??[];
export const containersInField=encounterId=>FIELD_CONTAINERS[encounterId]??[];
const ALL=new Map([...Object.values(CAMP_CONTAINERS).flat().map(c=>[c.id,c]),...Object.values(FIELD_CONTAINERS).flat().map(c=>[c.id,c])]);
export const containerById=id=>ALL.get(id)??null;
// The camp chapter a camp container stands in.
export const containerChapter=id=>{for(const [chapter,list]of Object.entries(CAMP_CONTAINERS))if(list.some(c=>c.id===id))return Number(chapter);return null;};

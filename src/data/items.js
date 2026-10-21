// Kit as data (build brief §3.13, guide "Kit"). Every piece names its place
// on the soldier (slot and layer), its protection per damage type as a flat
// absorb and a share resisted, its Restriction, what it requires, its value in
// denarii and its shape in the 10 × 6 pack. A weapon, shield or belt names
// the rules entry it brings (realtime-rules.js). Values and requirements are
// game balance, not prices recorded for the period.

const p=(absorb,resist)=>Object.freeze({absorb,resist});
const freeze=value=>Object.freeze(value);
function item(id,data){
  const {protection={},shape=[1,1],requires={},visuals={},...rest}=data;
  return freeze({id,layer:0,restriction:0,value:0,kind:'kit',...rest,
    protection:freeze(Object.fromEntries(Object.entries(protection).map(([t,[a,r]])=>[t,p(a,r)]))),
    shape:freeze({w:shape[0],h:shape[1]}),requires:freeze({...requires}),visuals:freeze({...visuals})});
}

// Places on the paperdoll. Body is worn in four layers, head and legs in two;
// a soldier has two charm places.
export const SLOTS=freeze({
  head:freeze({name:'Head',layers:freeze(['Arming cap','Helmet'])}),
  body:freeze({name:'Body',layers:freeze(['Tunic','Padding','Armour','Cloak'])}),
  arms:freeze({name:'Arms',layers:freeze(['Arm guard'])}),
  legs:freeze({name:'Legs',layers:freeze(['Trousers','Greaves'])}),
  feet:freeze({name:'Feet',layers:freeze(['Boots'])}),
  belt:freeze({name:'Belt',layers:freeze(['Belt'])}),
  weapon:freeze({name:'Weapon',layers:freeze(['Weapon'])}),
  shield:freeze({name:'Shield',layers:freeze(['Shield'])}),
  charm:freeze({name:'Charms',layers:freeze(['Charm','Charm'])})});
// Every worn place as "slot:layer", in paperdoll order.
export const WORN_PLACES=freeze(Object.entries(SLOTS).flatMap(([slot,s])=>s.layers.map((_,layer)=>`${slot}:${layer}`)));
export const PACK=freeze({cols:10,rows:6});

export const ITEMS=freeze(Object.fromEntries([
  // Body, layer by layer.
  item('tunic',{name:'Wool tunic',slot:'body',layer:0,protection:{cut:[0,.05],pierce:[0,.05],crush:[0,.05]},value:4,shape:[2,2],
    description:'The long-sleeved wool tunic every soldier wears.',visuals:{tunic:true}}),
  item('linen_tunic',{name:'Linen tunic',slot:'body',layer:0,protection:{cut:[0,.03],pierce:[0,.03]},value:6,shape:[2,2],
    description:'Cooler than wool in the eastern heat.',visuals:{tunic:true}}),
  item('subarmalis',{name:'Subarmalis',slot:'body',layer:1,restriction:2,protection:{cut:[1,.1],pierce:[1,.1],crush:[2,.2],stun:[1,.1]},value:12,
    shape:[2,2],description:'A padded jacket worn under armour; it softens crushing blows.',visuals:{padding:true}}),
  item('jerkin',{name:'Leather jerkin',slot:'body',layer:1,restriction:3,protection:{cut:[1,.15],pierce:[1,.1],crush:[1,.1]},value:9,shape:[2,2],
    description:'Hardened leather over the tunic.',visuals:{padding:true}}),
  item('hamata',{name:'Lorica hamata',slot:'body',layer:2,restriction:8,requires:{str:12},protection:{cut:[3,.3],pierce:[1,.2],crush:[1,.1]},value:60,
    shape:[2,3],description:'Mail: it turns cuts well and points less well.',visuals:{armour:'mail'}}),
  item('squamata',{name:'Lorica squamata',slot:'body',layer:2,restriction:10,requires:{str:13},protection:{cut:[3,.25],pierce:[2,.25],crush:[1,.1]},
    value:75,shape:[2,3],description:'Scale armour: heavier than mail and better against points.',visuals:{armour:'scale'}}),
  item('scale_eastern',{name:'Persian scale coat',slot:'body',layer:2,restriction:11,requires:{str:13},protection:{cut:[3,.25],pierce:[2,.2],crush:[1,.1]},
    value:55,shape:[2,3],description:'Taken from the eastern field: long scales on a heavy backing.',visuals:{armour:'scale'}}),
  item('sagum',{name:'Sagum',slot:'body',layer:3,restriction:1,protection:{cut:[0,.05],crush:[0,.05]},value:8,shape:[2,2],
    description:'The soldier’s heavy cloak, pinned at the shoulder. Dark wool hides you at night.',visuals:{cloak:'sagum'},dark:true}),
  item('paenula',{name:'Paenula',slot:'body',layer:3,restriction:1,protection:{cut:[0,.05],crush:[0,.05]},value:9,shape:[2,2],
    description:'A hooded travelling cloak against rain and cold.',visuals:{cloak:'paenula'}}),
  // Head.
  item('arming_cap',{name:'Arming cap',slot:'head',layer:0,protection:{crush:[1,.05],stun:[1,.1]},value:3,shape:[1,1],
    description:'Felt worn under the helmet; it takes the sting from a blow.',visuals:{cap:true}}),
  item('galea',{name:'Galea',slot:'head',layer:1,restriction:2,protection:{cut:[1,.1],pierce:[1,.1],crush:[1,.1],stun:[2,.2]},value:25,shape:[2,2],
    description:'The legion’s iron helmet with cheek guards.',visuals:{helmet:'ridge'}}),
  item('galea_crest',{name:'Crested galea',slot:'head',layer:1,restriction:2,protection:{cut:[1,.12],pierce:[1,.12],crush:[1,.1],stun:[2,.2]},value:45,
    shape:[2,2],requires:{chapter:4},description:'A helmet fit for a centurion’s rank, with a transverse crest.',visuals:{helmet:'ridge',crest:true}}),
  item('conical_helmet',{name:'Conical helmet',slot:'head',layer:1,restriction:2,protection:{cut:[1,.1],pierce:[1,.1],crush:[1,.08],stun:[1,.15]},
    value:18,shape:[2,2],description:'A spangenhelm taken from the field.',visuals:{helmet:'conical'}}),
  item('segmented_helmet',{name:'Gothic cap helmet',slot:'head',layer:1,restriction:1,protection:{cut:[1,.08],crush:[1,.05],stun:[1,.1]},value:10,
    shape:[2,2],description:'Iron bands over leather.',visuals:{helmet:'segmented'}}),
  // Arms, legs and feet.
  item('manica',{name:'Manica',slot:'arms',restriction:2,protection:{cut:[2,.15],pierce:[1,.1]},value:22,shape:[1,2],
    description:'An articulated guard for the sword arm.',visuals:{manica:true}}),
  item('bracae',{name:'Bracae',slot:'legs',layer:0,protection:{cut:[0,.03]},value:4,shape:[2,1],description:'Woollen trousers for the northern frontier.',
    visuals:{trousers:true}}),
  item('ocreae',{name:'Ocreae',slot:'legs',layer:1,restriction:2,protection:{cut:[1,.1],crush:[1,.1]},value:20,shape:[2,1],
    description:'Bronze greaves, an officer’s pride.',visuals:{greaves:true}}),
  item('caligae',{name:'Caligae',slot:'feet',value:6,shape:[2,1],description:'Hobnailed military boots.',visuals:{boots:true}}),
  item('calcei',{name:'Closed boots',slot:'feet',protection:{crush:[0,.03]},value:9,shape:[2,1],description:'Laced boots that keep out mud and cold.',
    visuals:{boots:true}}),
  // Belt: the military belt carries the throwing weapons.
  item('cingulum',{name:'Cingulum',slot:'belt',belt:freeze({pilum:2}),value:10,shape:[2,1],
    description:'The military belt. It carries two pila.',visuals:{belt:true}}),
  item('dart_belt',{name:'Belt with plumbatae',slot:'belt',belt:freeze({dart:5}),value:24,shape:[2,1],requires:{chapter:5},
    description:'A belt carrying five lead-weighted darts.',visuals:{belt:true}}),
  item('quiver',{name:'Quiver',slot:'belt',belt:freeze({arrow:16}),value:8,shape:[1,2],requires:{agi:13},
    description:'Sixteen arrows for a bow.',visuals:{quiver:true}}),
  // Weapons.
  item('spatha',{name:'Spatha',slot:'weapon',restriction:1,weapon:'spatha',value:15,shape:[1,3],
    description:'The long sword that most of the army carries by now.',visuals:{weapon:'spatha'}}),
  item('gladius',{name:'Gladius',slot:'weapon',restriction:1,weapon:'gladius',value:18,shape:[1,3],
    description:'The short sword: quick, and deadly with the point.',visuals:{weapon:'gladius'}}),
  item('spear',{name:'Spear',slot:'weapon',restriction:2,weapon:'spear',value:6,shape:[1,4],description:'Long reach, slower blows.',
    visuals:{weapon:'spear'}}),
  item('hasta',{name:'Hasta',slot:'weapon',restriction:2,weapon:'spear',value:12,shape:[1,4],description:'The legion’s thrusting spear.',
    visuals:{weapon:'spear'}}),
  item('axe',{name:'Axe',slot:'weapon',restriction:2,weapon:'axe',value:7,shape:[1,3],requires:{str:12},description:'Heavy, slow and brutal.',
    visuals:{weapon:'axe'}}),
  item('bow',{name:'Composite bow',slot:'weapon',restriction:1,weapon:'bow',value:30,shape:[1,4],requires:{agi:13},
    description:'Needs a quiver of arrows on the belt.',visuals:{weapon:'bow'}}),
  item('sling',{name:'Sling',slot:'weapon',weapon:'sling',value:3,shape:[1,1],requires:{agi:12},description:'Lead bullets at a distance.',
    visuals:{weapon:'sling'}}),
  item('knife',{name:'Knife',slot:'weapon',weapon:'knife',value:2,shape:[1,1],description:'A camp knife; better than bare hands.',
    visuals:{weapon:'knife'}}),
  // Shields.
  item('scutum',{name:'Scutum',slot:'shield',restriction:6,shield:'scutum',value:20,shape:[2,4],
    description:'The legion’s large oval shield, painted with its blazon.',visuals:{shield:'oval'}}),
  item('training_shield',{name:'Oval training shield',slot:'shield',restriction:7,shield:'parma',value:6,shape:[2,4],
    description:'Wicker and leather, heavier than the real thing by design.',visuals:{shield:'oval'}}),
  item('parma',{name:'Parma',slot:'shield',restriction:3,shield:'parma',value:12,shape:[2,2],description:'A small round shield for skirmishers.',
    visuals:{shield:'round'}}),
  item('round_shield',{name:'Round shield',slot:'shield',restriction:3,shield:'round',value:8,shape:[3,3],description:'Planks and a central boss.',
    visuals:{shield:'round'}}),
  // Charms: small, stated benefits.
  item('amulet_mars',{name:'Amulet of Mars',slot:'charm',value:15,shape:[1,1],bonus:freeze({combat:1}),kind:'charm',
    description:'A bronze Mars on a cord. +1 Combat.'}),
  item('phylactery',{name:'Phylactery',slot:'charm',value:12,shape:[1,1],bonus:freeze({con:1}),kind:'charm',
    description:'A rolled lamella with a protective prayer. +1 Constitution.'}),
  item('patron_letter',{name:'Letter of recommendation',slot:'charm',value:0,shape:[1,1],bonus:freeze({auth:1}),kind:'charm',
    description:'Your patron’s seal opens doors. +1 Authority.'}),
  item('signaculum',{name:'Lead identity seal',slot:'charm',value:0,shape:[1,1],bonus:freeze({}),kind:'charm',keep:true,
    description:'The signaculum you received with the oath.'}),
  // Trophies and goods: sold to the quartermaster or traders.
  item('gothic_torc',{name:'Gothic torc',slot:null,value:30,shape:[1,1],kind:'trophy',description:'Twisted silver from a raider’s neck.'}),
  item('silver_brooch',{name:'Silver brooch',slot:null,value:18,shape:[1,1],kind:'trophy',description:'A fibula worth more than its weight.'}),
  item('coin_purse',{name:'Coin purse',slot:null,value:12,shape:[1,1],kind:'trophy',description:'Mixed coin from many mints.'}),
  item('persian_dagger',{name:'Persian dagger',slot:null,value:22,shape:[1,2],kind:'trophy',description:'Gilded hilt, eastern work.'}),
  item('wax_tablet',{name:'Wax tablet',slot:null,value:1,shape:[1,1],kind:'goods',description:'Notes in a clerk’s hand.'}),
  item('wine_skin',{name:'Wine skin',slot:null,value:3,shape:[1,2],kind:'goods',description:'Sour posca for the march.'}),
  item('medicine_box',{name:'Medicine box',slot:null,value:16,shape:[2,1],kind:'goods',description:'Linen, salves and a probe.'}),
  item('legion_records',{name:'Legion records',slot:null,value:0,shape:[2,2],kind:'quest',keep:true,description:'The cohort’s rolls, saved from the station.'}),
  item('lost_javelin',{name:'Marked javelin',slot:null,value:0,shape:[1,3],kind:'quest',keep:true,description:'A training javelin with Lucan’s mark.'})
].map(i=>[i.id,i])));

// The kit a soldier of each kind wears into his first fight.
export const STARTING_KIT=freeze({
  recruit:freeze({worn:freeze({'body:0':'tunic','body:1':'subarmalis','head:1':'galea','legs:0':'bracae','feet:0':'caligae','belt:0':'cingulum','weapon:0':'spatha',
    'shield:0':'training_shield'}),
    pack:freeze(['wine_skin']),denarii:20}),
  legionary:freeze({worn:freeze({'body:0':'tunic','body:1':'subarmalis','body:2':'hamata','head:1':'galea','legs:0':'bracae','feet:0':'caligae',
    'belt:0':'cingulum','weapon:0':'spatha','shield:0':'scutum'})})});

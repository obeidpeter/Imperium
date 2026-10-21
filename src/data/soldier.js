// The soldier's growth as data (build brief §3.5 "Training points", §3.12;
// guide "Your soldier"): training-point costs and sources, trainers and their
// courses, decorations, titles, the company's ranks, pay and appearance.
// Every benefit is a small stated modifier that the rules read from here.

const freeze=value=>Object.freeze(value);

// Raising an attribute by one costs 4 TP below 20, then 5 from 20, 6 from 30,
// and so on, computed on the base value (before decorations and courses).
export const TP=freeze({below20:4,from20:5,step:10,
  // One TP for each enemy the hero or a companion strikes down, at most ten an encounter.
  perKill:1,killCap:10,
  // One TP per capability demonstrated; one to three per commendation.
  perCapability:1,commendation:freeze({min:1,max:3}),
  // Objective TP for winning each encounter (data per encounter; default 2).
  objective:freeze({'ch1-training':2,'ch1-road':3,'ch2-marsh':3,'ch2-rearguard':3,'ch3-station':3,'ch3-rolls':3,'ch4-gate':3,'ch4-wall':3,
    'ch5-mine':3,'ch5-wall':3,'ch6-wells':3,'ch6-eagle':3,'ch7-legion':4,'ch8-ferry':3,'ch8-crossing':3,'ch9-wing':4,'ch9-city':4,'ch10-road':4,
    'ch12-confrontation':4,'ch7-council':3,'ch8-parley':3,'ch10-tribunal':3,'ch11-accounts':3,'ch11-adlection':3,'ch12-legitimacy':3})});

// Trainers and where they stand. A course is taken once.
export const TRAINERS=freeze({
  campidoctor:freeze({id:'campidoctor',name:'Campidoctor Varro',title:'Campidoctor (drill instructor)',place:'drill',chapter:1}),
  capsarius:freeze({id:'capsarius',name:'Capsarius Didius',title:'Capsarius (orderly)',place:'valetudinarium',chapter:2}),
  explorator:freeze({id:'explorator',name:'Explorator Brennus',title:'Explorator (scout)',place:'drill',chapter:3}),
  signifer:freeze({id:'signifer',name:'Signifer Quintus',title:'Signifer (standard-bearer)',place:'principia',chapter:4}),
  rhetor:freeze({id:'rhetor',name:'Rhetor Theon',title:'Rhetor',place:'canabae',chapter:7})});

// Courses: lasting improvements of the kind no attribute gives. `effect`
// names what the rules read; `ability` unlocks a technique.
export const COURSES=freeze({
  shield_bash:freeze({id:'shield_bash',name:'Shield bash',trainer:'campidoctor',tp:4,denarii:0,ability:'shield_bash',
    summary:'A stunning blow with the shield boss that staggers the target.'}),
  long_march:freeze({id:'long_march',name:'Long march',trainer:'campidoctor',tp:5,denarii:10,effect:freeze({restriction:-5}),
    summary:'5 less Restriction.'}),
  work_at_post:freeze({id:'work_at_post',name:'Work at the post',trainer:'campidoctor',tp:6,denarii:0,effect:freeze({attack:2}),
    summary:'2 more Attack.'}),
  field_dressing:freeze({id:'field_dressing',name:'Field dressing',trainer:'capsarius',tp:3,denarii:10,effect:freeze({bindWounds:1/3}),
    summary:'Bind wounds restores a third of Health instead of a quarter.'}),
  hardening:freeze({id:'hardening',name:'Hardening',trainer:'capsarius',tp:6,denarii:0,effect:freeze({health:.1}),summary:'A tenth more Health.'}),
  quiet_feet:freeze({id:'quiet_feet',name:'Quiet feet',trainer:'explorator',tp:4,denarii:0,effect:freeze({quietFeet:true}),
    summary:'Walking on firm ground makes almost no sound.'}),
  ambush_craft:freeze({id:'ambush_craft',name:'Ambush craft',trainer:'explorator',tp:6,denarii:15,effect:freeze({ambush:1.5}),
    summary:'Ambush blows do half as much again.'}),
  steady_voice:freeze({id:'steady_voice',name:'Steady voice',trainer:'signifer',tp:4,denarii:0,effect:freeze({rallyRadius:5}),
    summary:'Rally reaches 5 metres farther.'}),
  clear_orders:freeze({id:'clear_orders',name:'Clear orders',trainer:'signifer',tp:7,denarii:20,effect:freeze({orderDelay:0}),
    summary:'Squads start your orders at once.'}),
  practised_delivery:freeze({id:'practised_delivery',name:'Practised delivery',trainer:'rhetor',tp:5,denarii:40,effect:freeze({resolve:5}),
    summary:'5 more Resolve in Contests.'}),
  long_period:freeze({id:'long_period',name:'The long period',trainer:'rhetor',tp:8,denarii:60,effect:freeze({addressRecovery:2}),
    summary:'Address the Chamber recovers an hour sooner.'})});

// Decorations (dona militaria): stat modifiers that always count.
export const DECORATIONS=freeze({
  corona_civica:freeze({id:'corona_civica',name:'Corona civica',latin:'corona civica',bonus:freeze({elo:2}),
    reason:'For saving a citizen’s life.',summary:'+2 Eloquence.'}),
  corona_muralis:freeze({id:'corona_muralis',name:'Corona muralis',latin:'corona muralis',bonus:freeze({combat:2}),
    reason:'For being first over a wall.',summary:'+2 Combat.'}),
  corona_vallaris:freeze({id:'corona_vallaris',name:'Corona vallaris',latin:'corona vallaris',bonus:freeze({con:1,combat:1}),
    reason:'For being first over an enemy rampart.',summary:'+1 Constitution, +1 Combat.'}),
  torques:freeze({id:'torques',name:'Torques',latin:'torques',bonus:freeze({auth:1}),reason:'For valour in the line.',summary:'+1 Authority.'}),
  armillae:freeze({id:'armillae',name:'Armillae',latin:'armillae',bonus:freeze({agi:1}),reason:'For valour in a skirmish.',summary:'+1 Agility.'}),
  phalerae:freeze({id:'phalerae',name:'Phalerae',latin:'phalerae',bonus:freeze({per:1,auth:1}),reason:'For distinguished service in a campaign.',
    summary:'+1 Perception, +1 Authority.'}),
  hasta_pura:freeze({id:'hasta_pura',name:'Hasta pura',latin:'hasta pura',bonus:freeze({auth:1,elo:1}),reason:'For distinguished command.',
    summary:'+1 Authority, +1 Eloquence.'})});

// Decorations follow clearly marked deeds in the campaign record: an encounter
// won (optionally after a decision) or a run of safe returns.
export const DECORATION_AWARDS=freeze([
  freeze({decoration:'corona_civica',encounter:'ch2-marsh',decision:freeze(['ch2','carry'])}),
  freeze({decoration:'armillae',encounter:'ch3-rolls'}),
  freeze({decoration:'corona_vallaris',encounter:'ch4-gate'}),
  freeze({decoration:'corona_muralis',encounter:'ch5-wall'}),
  freeze({decoration:'torques',encounter:'ch6-eagle'}),
  freeze({decoration:'phalerae',encounter:'ch8-crossing'}),
  freeze({decoration:'hasta_pura',encounter:'ch9-city'})]);

// Titles follow rank and earlier choices; some open conversation replies.
export const TITLES=freeze({
  drill_first:freeze({id:'drill_first',name:'First at the post',bonus:freeze({combat:1}),summary:'+1 Combat. Awarded by the Campidoctor’s errand.'}),
  trail_reader:freeze({id:'trail_reader',name:'Reader of trails',bonus:freeze({field:1,per:1}),summary:'+1 Fieldcraft, +1 Perception.'}),
  clerk_of_rolls:freeze({id:'clerk_of_rolls',name:'Keeper of the rolls',bonus:freeze({elo:1,auth:1}),summary:'+1 Eloquence, +1 Authority.'}),
  shield_of_cohort:freeze({id:'shield_of_cohort',name:'Shield of the cohort',bonus:freeze({con:1}),summary:'+1 Constitution.'}),
  river_scout:freeze({id:'river_scout',name:'River scout',bonus:freeze({field:1}),summary:'+1 Fieldcraft.'}),
  advocate_of_ranks:freeze({id:'advocate_of_ranks',name:'Advocate of the ranks',bonus:freeze({elo:1}),summary:'+1 Eloquence.'}),
  hammer_of_line:freeze({id:'hammer_of_line',name:'Hammer of the line',bonus:freeze({str:1}),summary:'+1 Strength.'}),
  pathfinder:freeze({id:'pathfinder',name:'Pathfinder',bonus:freeze({agi:1}),summary:'+1 Agility.'}),
  scribe_of_council:freeze({id:'scribe_of_council',name:'Scribe of the council',bonus:freeze({auth:1}),summary:'+1 Authority.'})});

// The company's ranks by commendations, each with stated attribute gains.
export const COMPANION_RANKS=freeze([
  freeze({id:'miles',name:'Miles gregarius',commendations:0,bonus:freeze({})}),
  freeze({id:'immunis',name:'Immunis',commendations:1,bonus:freeze({combat:1,con:1})}),
  freeze({id:'optio',name:'Optio cohortis',commendations:3,bonus:freeze({combat:2,con:1,auth:1})}),
  freeze({id:'evocatus',name:'Evocatus Augusti',commendations:6,bonus:freeze({combat:3,con:2,auth:1,agi:1})})]);

// Each veteran of the company roll: his starting attributes and kit.
export const COMPANIONS=freeze({
  lucan:freeze({id:'lucan',name:'Aurelius Lucan',path:'legionary',attributes:freeze({per:9}),preset:'shieldmate',
    worn:freeze({'body:0':'tunic','body:1':'subarmalis','body:2':'hamata','head:1':'galea','legs:0':'bracae','feet:0':'caligae','belt:0':'cingulum',
      'weapon:0':'spatha','shield:0':'scutum'})}),
  sabinus:freeze({id:'sabinus',name:'Sabinus',path:'legionary',attributes:freeze({con:15}),preset:'shieldmate',
    worn:freeze({'body:0':'tunic','body:1':'subarmalis','body:2':'hamata','head:1':'galea','legs:0':'bracae','feet:0':'caligae','belt:0':'cingulum',
      'weapon:0':'spatha','shield:0':'scutum'})}),
  naso:freeze({id:'naso',name:'Aulus Naso',path:'legionary',attributes:freeze({str:16}),preset:'shieldmate',
    worn:freeze({'body:0':'tunic','body:1':'subarmalis','body:2':'squamata','head:1':'galea','legs:0':'bracae','feet:0':'caligae','belt:0':'cingulum',
      'weapon:0':'spatha','shield:0':'scutum'})}),
  felix:freeze({id:'felix',name:'Marcus Felix',path:'explorator',attributes:freeze({per:13,agi:16}),preset:'skirmisher',
    worn:freeze({'body:0':'tunic','body:1':'jerkin','head:0':'arming_cap','legs:0':'bracae','feet:0':'caligae','belt:0':'quiver','weapon:0':'bow'})}),
  firmus:freeze({id:'firmus',name:'Titus Firmus',path:'legionary',attributes:freeze({con:15}),preset:'orderly',
    worn:freeze({'body:0':'tunic','body:1':'subarmalis','body:2':'hamata','head:1':'galea','legs:0':'bracae','feet:0':'caligae','belt:0':'cingulum',
      'weapon:0':'spatha','shield:0':'scutum'})}),
  rufus:freeze({id:'rufus',name:'Gnaeus Rufus',path:'legionary',attributes:freeze({auth:12}),preset:'shieldmate',
    worn:freeze({'body:0':'tunic','body:1':'subarmalis','body:2':'hamata','head:1':'galea','legs:0':'bracae','feet:0':'caligae','belt:0':'cingulum',
      'weapon:0':'hasta','shield:0':'scutum'})})});

// Pay in denarii, collected from the quartermaster once a chapter, and the
// donatives that follow some victories.
export const PAY=freeze({1:20,2:30,3:35,4:45,5:55,6:60,7:80,8:90,9:100,10:120,11:140,12:160});
export const DONATIVES=freeze({'ch2-rearguard':10,'ch4-wall':20,'ch6-eagle':30,'ch9-city':60});
// Kit issued with each promotion (the 0.38 rewards, now real pieces).
export const PROMOTION_ISSUE=freeze({1:freeze(['hamata','scutum']),3:freeze(['manica']),4:freeze(['galea_crest','ocreae']),
  6:freeze(['calcei']),9:freeze(['squamata'])});

// What the quartermaster has on his shelves, from each chapter on (the
// canabae's traders add their own goods). Prices follow priceOf.
export const QUARTERMASTER=freeze([
  freeze({chapter:1,items:freeze(['tunic','linen_tunic','subarmalis','arming_cap','bracae','caligae','sagum','knife','spatha','training_shield','wine_skin'])}),
  freeze({chapter:2,items:freeze(['paenula','parma','spear','medicine_box','phylactery'])}),
  freeze({chapter:3,items:freeze(['jerkin','sling','quiver','bow','hasta','amulet_mars'])}),
  freeze({chapter:4,items:freeze(['manica','ocreae','galea','scutum','calcei','gladius'])}),
  freeze({chapter:5,items:freeze(['hamata','dart_belt','conical_helmet','round_shield','scale_eastern'])}),
  freeze({chapter:7,items:freeze(['squamata','segmented_helmet'])})]);
export const quartermasterStock=chapter=>QUARTERMASTER.filter(q=>q.chapter<=chapter).flatMap(q=>q.items);

// Recruit appearance choices.
export const APPEARANCE=freeze({
  hair:freeze(['Cropped','Curled','Shaved','Long']),beard:freeze(['Clean-shaven','Short beard','Full beard']),
  tunic:freeze(['Undyed','Madder red','Woad blue','Ochre']),cloak:freeze(['Brown','Dark grey','Red','Green'])});
export const PATHS=freeze(['legionary','explorator','librarius']);

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Game from '../src/core/game.js';
import {CAMPS,TRADER_STOCK,campPersonPresent,campPersonSpot} from '../src/data/camps.js';
import {CAMP_SCENERY_PADS} from '../src/data/camp-regions.js';
import {CHAPTERS,OATH} from '../src/data/campaign.js';
import {DIALOGUE,ERRANDS,DEFEAT_PAGES} from '../src/data/dialogue.js';
import {LIVING_ERRANDS} from '../src/data/living-camps.js';
import {ITEMS} from '../src/data/items.js';
import {TITLES} from '../src/data/soldier.js';
import {tpAuditChapter,tpAuditTotal} from '../src/core/tp-audit.js';
import {defeatPage} from '../src/ui/tactical-intel.js';
import {chamberResult} from '../src/ui/chamber-view.js';

// The living camps (worlds and gameplay plan, release 8), from the legally earned
// camp saves the graphics fixtures keep for every chapter. A branch the save did not
// take (another decision, a later encounter, the patron's standing, a wound) is set on
// a copy and named as such in the test.
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
const stateFor=(chapter,more={})=>{
  const state=Game.deserialize(JSON.stringify(fixtures.scenes.find(s=>s.id===`camp-${chapter}`).state));
  Object.assign(state.decisions,more.decisions??{});if(more.encounterIndex!==undefined)state.encounterIndex=more.encounterIndex;
  // The other side of Chapter II's decision, as Game.choose leaves it: Sabinus on the roll in Lucan's place.
  if(more.decisions?.ch2==='leave'){
    state.company=state.company.map(v=>v.id==='lucan'?{id:'sabinus',name:'Sabinus',service:0,commendations:0,recovery:0}:v);
    if(state.companyOrders)state.companyOrders.priority=state.companyOrders.priority.map(id=>id==='lucan'?'sabinus':id);
    if(state.progressionVersion===1)delete state.progression.specializations.lucan;
  }
  if(more.patron!==undefined)state.relationships.patron=more.patron;
  for(const id of more.recovering??[])state.company.find(v=>v.id===id).recovery=1;
  return state;
};
const present=(state,id)=>CAMPS[state.chapter].people.some(p=>p.id===id&&campPersonPresent(state,p));
// Walk a conversation by its replies' words: each pattern picks a reply of the node the last one led to.
function talk(state,treeId,...patterns){
  let nodeId=null,last=null;
  for(const pattern of patterns){
    const view=Game.campConversation(state,treeId,nodeId);assert.ok(view,`${treeId}/${nodeId??'start'} is open`);
    const option=view.options.find(o=>pattern.test(o.text));assert.ok(option,`${treeId}/${view.nodeId}: a reply matching ${pattern} (${view.options.map(o=>o.text).join(' | ')})`);
    last=Game.campReply(state,{treeId,nodeId:view.nodeId,index:option.index});assert.ok(last.ok,`${treeId}: ${option.text} → ${last.message}`);
    nodeId=last.next;
  }
  return last;
}
const errandDone=(state,id)=>assert.equal(state.soldier.errands[id],'done',`${id} done`);

test('every later camp has a court of its own: its map, its places and its pads, none shared with another chapter',()=>{
  const maps=Object.values(CAMPS).map(c=>c.terrain.map(r=>r.join(',')).join(';'));
  assert.equal(new Set(maps).size,12,'twelve different maps');
  assert.equal(new Set(Object.values(CAMPS).map(c=>JSON.stringify(c.places))).size,12,'twelve different arrangements of the seven places');
  assert.equal(new Set(Object.values(CAMP_SCENERY_PADS).map(p=>JSON.stringify(p.map(x=>x.cells)))).size,Object.keys(CAMP_SCENERY_PADS).length);
  for(let chapter=4;chapter<=12;chapter++){
    const camp=CAMPS[chapter];assert.equal(camp.id,`ch${chapter}-camp`);
    // Each later camp has its own objects beyond the shared services: an errand's things to read or use.
    assert.ok(camp.objects.some(o=>!['table','post','local-report','gate','company-record'].includes(o.id)&&!o.id.startsWith('company-activity')),`chapter ${chapter} has its own objects`);
  }
});

test('the named cast stand in camp where the story puts them, with every absence or replacement branch',()=>{
  // Varro, through the order that fixes his fate in Chapter VI (the save has not yet chosen it).
  assert.ok(present(stateFor(4),'varro'),'Varro teaches at the Danube fort');
  assert.ok(present(stateFor(6),'varro'));assert.ok(present(stateFor(6,{decisions:{ch6:'save'}}),'varro'));
  assert.ok(!present(stateFor(6,{decisions:{ch6:'obey'}}),'varro'),'after the rear-guard order his place is empty');
  for(let chapter=7;chapter<=12;chapter++)assert.ok(!CAMPS[chapter].people.some(p=>p.id==='varro'),'later camps keep his letter or his vine stick instead');
  // Lucan or Sabinus, never both.
  for(let chapter=4;chapter<=12;chapter++)for(const choice of ['carry','leave']){
    const state=stateFor(chapter,{decisions:{ch2:choice}});
    assert.equal(present(state,'lucan'),choice==='carry');assert.equal(present(state,'sabinus'),choice==='leave');
  }
  // Crispus leaves for Rome after the council; Paullus visits only before the legitimacy Contest.
  assert.ok(present(stateFor(7),'crispus'));assert.ok(!present(stateFor(7,{encounterIndex:1}),'crispus'));
  assert.ok(present(stateFor(12),'paullus'));assert.ok(!present(stateFor(12,{encounterIndex:1}),'paullus'));
  // Severianus in the last camp only while he backs you; otherwise the scene's own replacements.
  for(const [patron,who]of [[15,'severianus'],[5,'messenger'],[-5,'treasury-envoy']]){
    const state=stateFor(12,{patron});
    assert.deepEqual(['severianus','messenger','treasury-envoy'].filter(id=>present(state,id)),[who],`patron ${patron}`);
  }
  // The cast the plan names appear in their chapters' camps.
  const cast={4:['varro','crispus','quintus','brennus','naso','felix'],6:['varro','severianus','naso','felix'],7:['severianus','crispus','theon','naso','felix'],
    8:['severianus','aelia','naso','felix'],9:['severianus','naso','felix'],10:['severianus','aelia','theon','naso','felix'],11:['severianus','paullus','crispus','theon'],
    12:['aelia','quintus','paullus','naso','felix']};
  for(const [chapter,ids]of Object.entries(cast))for(const id of ids)assert.ok(CAMPS[chapter].people.some(p=>p.id===id),`${id} in chapter ${chapter}`);
});

test('a companion still recovering waits at the valetudinarium, can be walked to, and says so',()=>{
  for(const chapter of [4,6,7,8,9,10,12]){
    const fit=stateFor(chapter,{decisions:{ch2:'carry'}}),hurt=stateFor(chapter,{decisions:{ch2:'carry'},recovering:['naso']});
    for(const v of fit.company)v.recovery=0;
    const person=CAMPS[chapter].people.find(p=>p.id==='naso');
    assert.equal(campPersonSpot(fit,person).place,'barracks');assert.equal(campPersonSpot(hurt,person).place,'valetudinarium');
    const before=JSON.stringify(hurt),world=Game.createCampWorld(hurt),naso=world.actors.find(a=>a.id==='naso'),ward=world.places.valetudinarium;
    assert.ok(Math.hypot(naso.x-ward.x,naso.z-ward.z)<4.5,`chapter ${chapter}: Naso stands at the valetudinarium`);
    assert.match(Game.campConversation(hurt,`ch${chapter}:naso`).text,/Didius|surgeons|aid/,'his words follow his wound');
    assert.equal(JSON.stringify(hurt),before,'where a man stands is a view, never a saved change');
  }
});

test('every errand of Chapters IV–XII can be done with legal replies and uses, once, for two training points and its title',()=>{
  const run=(chapter,id,steps,more)=>{
    const state=stateFor(chapter,more),tp=state.soldier.tp,titles=state.soldier.titles.length,errand=ERRANDS[id];
    steps(state);errandDone(state,id);
    assert.equal(state.soldier.tp,tp+errand.reward.tp,`${id} gives its training points`);
    assert.equal(state.soldier.titles.length,titles+(errand.reward.title?1:0));
    if(errand.reward.title)assert.ok(state.soldier.titles.includes(errand.reward.title),`${id} awards ${errand.reward.title}`);
    assert.ok(state.soldier.rewarded.errands.includes(id));
    assert.ok(!state.soldier.pack.some(e=>ITEMS[e.id].kind==='quest'&&!['legion_records','lost_javelin'].includes(e.id)),`${id} takes back what it gave`);
    const saved=Game.serialize(state);assert.equal(Game.serialize(Game.deserialize(saved)),saved,'a reload keeps it, once');
    return state;
  };
  run(4,'gate_braces',s=>{talk(s,'ch4:quartermaster',/work while the porters/,/I will carry it/);assert.ok(s.soldier.pack.some(e=>e.id==='gate_brace'));
    talk(s,'ch4:brace-rack',/Set the brace/);talk(s,'ch4:quartermaster',/brace is in the rack/);});
  run(4,'ford_count',s=>{talk(s,'ch4:brennus',/count them for you/,/^I will\.$/);talk(s,'ch4:lookout',/Count the rafts/);
    talk(s,'ch4:brennus',/I counted/,/Four large/);assert.equal(s.soldier.errands.ford_count,'accepted','a wrong count changes nothing');
    talk(s,'ch4:brennus',/I counted/,/Six: four large and two small/);});
  run(5,'listening_bowl',s=>{talk(s,'ch5:engineer',/where the miners are/,/fetch a bowl/);talk(s,'ch5:water',/needs a bronze bowl/);talk(s,'ch5:engineer',/steward’s bowl/);});
  for(const choice of ['carry','leave'])run(5,'letter_home',s=>{const who=choice==='carry'?'ch5:lucan':'ch5:sabinus';
    talk(s,who,/need anything/,/take it/);talk(s,'ch5:evacuation',/letter for the boats/);talk(s,who,/on the boats/);},{decisions:{ch2:choice}});
  run(6,'western_wells',s=>{talk(s,'ch6:felix',/read the tracks/,/^I will\.$/);talk(s,'ch6:marker',/Read the marker/);talk(s,'ch6:caravan',/Read the tracks/);
    talk(s,'ch6:felix',/I have read/,/right-hand track/);assert.equal(s.soldier.errands.western_wells,'accepted');talk(s,'ch6:felix',/I have read/,/left-hand track/);});
  run(6,'eagle_cords',s=>{talk(s,'ch6:aquilifer',/find you leather/,/bring it/);
    assert.ok(Game.soldierCommand(s,{kind:'buy',itemId:'leather_thongs',from:'trader'}).ok,'the water-seller sells leather');talk(s,'ch6:aquilifer',/Here is the leather/);});
  run(7,'boot_sizes',s=>{talk(s,'ch7:naso',/take it up with Aper/,/^I will\.$/);talk(s,'ch7:boot-tally',/Read the tally/);talk(s,'ch7:quartermaster',/one last/,/Exchange the large/);});
  run(7,'theon_order',s=>{talk(s,'ch7:theon',/speak before the officers/,/think it over/);talk(s,'ch7:theon',/order of a speech/,/^Prove it/);
    assert.equal(s.soldier.errands.theon_order,'accepted');talk(s,'ch7:theon',/order of a speech/,/^Win them over/);});
  run(8,'ford_soundings',s=>{talk(s,'ch8:felix',/sound the landing/,/^I will\.$/);talk(s,'ch8:sounding-pole',/Sound the landing/);talk(s,'ch8:depth-marks',/Read the board/);
    talk(s,'ch8:felix',/I have sounded/,/Along the near bank/);});
  run(8,'seed_jar',s=>{talk(s,'ch8:aelia',/households need/,/find it/);talk(s,'ch8:seed-jar',/Take the jar/);talk(s,'ch8:aelia',/Ulpii’s jar/);});
  for(const choice of ['carry','leave'])run(9,'recall_signal',s=>{const who=choice==='carry'?'ch9:lucan':'ch9:sabinus';
    talk(s,who,/agree the recall/,/^I will\.$/);talk(s,'ch9:cornicen',/Agree the wing/,/Three short calls/);
    talk(s,who,/recall signal is agreed/,/One long call/);assert.equal(s.soldier.errands.recall_signal,'accepted','the wrong call is refused');
    talk(s,who,/recall signal is agreed/,/Three short calls/);},{decisions:{ch2:choice}});
  run(9,'market_keys',s=>{talk(s,'ch9:envoy',/council need/,/find out/);talk(s,'ch9:requisition-tally',/Read the tally/);talk(s,'ch9:envoy',/read the requisition/,/Eleven inside/);});
  run(10,'granary_receipts',s=>{talk(s,'ch10:provincial-clerk',/went missing/,/read them/);talk(s,'ch10:granary-receipts',/Read the receipts/);
    talk(s,'ch10:warehouse-tally',/Read the warehouse/);talk(s,'ch10:provincial-clerk',/I have read/,/Eighty/);});
  run(10,'frightened_witness',s=>{talk(s,'ch10:theon',/witness I should hear/,/talk to her/);talk(s,'ch10:aelia',/vouch for me/);
    talk(s,'ch10:witness',/Aelia Dacia will stand/);talk(s,'ch10:theon',/Licinia will speak/);});
  run(11,'station_report',s=>{talk(s,'ch11:paullus',/committee want/,/copy it/);talk(s,'ch11:station-report',/fair copy/);talk(s,'ch11:paullus',/fair copy of the station/);});
  run(11,'province_accounts',s=>{talk(s,'ch11:crispus',/answer in writing/,/have them/);talk(s,'ch11:province-accounts',/Take a copy/);talk(s,'ch11:crispus',/provincial accounts/);});
  run(12,'seal_shown',s=>{talk(s,'ch12:quintus',/need of me/,/^I will\.$/);talk(s,'ch12:standards',/Hold up the lead seal/);
    const r=talk(s,'ch12:quintus',/seal is shown/);assert.ok(Game.campConversation(s,'ch12:quintus',r.next).text.includes(OATH),'Quintus speaks the one shared oath');});
  run(12,'spring_seed',s=>{talk(s,'ch12:aelia',/households need/,/bring it/);
    assert.ok(Game.soldierCommand(s,{kind:'buy',itemId:'seed_grain',from:'trader'}).ok,'Syra sells seed grain');talk(s,'ch12:aelia',/seed grain from the sutler/);});
  // Every errand of these chapters was walked above; none can be finished twice.
  assert.deepEqual(Object.keys(LIVING_ERRANDS).sort(),['boot_sizes','eagle_cords','ford_count','ford_soundings','frightened_witness','gate_braces','granary_receipts','letter_home','listening_bowl',
    'market_keys','province_accounts','recall_signal','seal_shown','seed_jar','spring_seed','station_report','theon_order','western_wells']);
});

test('the five titles no deed awarded are now each the reward of one errand, and the audit counts the new training points',()=>{
  const awarded=Object.values(ERRANDS).map(e=>e.reward.title).filter(Boolean);
  assert.deepEqual([...new Set(awarded)].sort(),Object.keys(TITLES).sort(),'every title is earned somewhere');
  for(const id of ['shield_of_cohort','river_scout','advocate_of_ranks','pathfinder','scribe_of_council'])assert.equal(awarded.filter(t=>t===id).length,1,id);
  for(let chapter=4;chapter<=12;chapter++){
    const ids=Object.values(LIVING_ERRANDS).filter(e=>e.chapter===chapter);assert.equal(ids.length,2,`two errands in chapter ${chapter}`);
    for(const path of ['legionary','explorator','librarius'])assert.equal(tpAuditChapter(chapter,path).errands,4);
  }
  for(const path of ['legionary','explorator','librarius'])assert.equal(tpAuditTotal(12,path),273);
});

test('a reply that depends on who the soldier is shows what it needs, and refuses without changing anything',()=>{
  const soldierKeys=['attribute','decoration','title','meter','path'];
  for(let chapter=4;chapter<=12;chapter++){
    const trees=[...new Set(CAMPS[chapter].people.map(p=>p.talk).concat(CAMPS[chapter].objects.map(o=>o.talk)))].filter(id=>DIALOGUE[id]);
    const gated=trees.flatMap(id=>Object.values(DIALOGUE[id].nodes).flatMap(n=>n.options)).filter(o=>soldierKeys.some(k=>o.conditions[k]!==undefined));
    assert.ok(gated.length>=2,`chapter ${chapter} has replies that depend on the soldier`);
  }
  // Chapter X's witness: the save's Eloquence is short of 14, but its corona civica opens another way.
  const state=stateFor(10),before=Game.serialize(state);talk(state,'ch10:theon',/witness I should hear/,/talk to her/);
  const view=Game.campConversation(state,'ch10:witness'),eloquent=view.options.find(o=>/quiet as well as the loud/.test(o.text)),crown=view.options.find(o=>/out of the marsh/.test(o.text));
  assert.deepEqual(eloquent.needs,['Eloquence 14']);assert.deepEqual(crown.needs,[]);
  const accepted=Game.serialize(state),refused=Game.campReply(state,{treeId:'ch10:witness',nodeId:view.nodeId,index:eloquent.index});
  assert.equal(refused.ok,false);assert.match(refused.message,/Needs Eloquence 14/);assert.equal(Game.serialize(state),accepted,'a refused reply changes nothing');
  assert.notEqual(accepted,before);
  // Chapter XII: Aper releases the seed only on a senator's Authority of 15.
  const xii=stateFor(12);talk(xii,'ch12:aelia',/households need/,/bring it/);
  assert.deepEqual(Game.campConversation(xii,'ch12:quartermaster').options.find(o=>/spare seed/.test(o.text)).needs,['Authority 15']);
});

test('every camp has a trader with the region’s goods, and every encounter a page of history for a defeat',()=>{
  for(let chapter=1;chapter<=12;chapter++){
    const trader=CAMPS[chapter].people.find(p=>p.id==='trader');assert.ok(trader,`a trader in chapter ${chapter}`);
    const view=Game.campConversation(stateFor(Math.max(4,chapter)),trader.talk);assert.ok(view||chapter<4);
    assert.ok(Object.values(DIALOGUE[trader.talk].nodes).some(n=>n.options.some(o=>o.effects.open==='trader')),`${trader.talk} opens the trade panel`);
    assert.ok(TRADER_STOCK[chapter]?.length>=3,`chapter ${chapter} stock`);for(const id of TRADER_STOCK[chapter])assert.ok(ITEMS[id],id);
  }
  for(const chapter of CHAPTERS)for(const e of chapter.encounters)assert.ok(DEFEAT_PAGES[e.id]?.length>80,`${e.id} has its page`);
});

test('a lost encounter’s result shows its page of history, in the field and in the chamber alike',()=>{
  for(const chapter of CHAPTERS)for(const e of chapter.encounters)assert.ok(defeatPage({id:e.id}).includes('Historical context'),e.id);
  // Chapter VII's council, started legally from its camp; the lost vote is set on the copy.
  const state=stateFor(7);assert.ok(Game.choose(state,'refuse').ok);assert.ok(Game.startEncounter(state,{}).ok);assert.equal(state.encounter.kind,'contest');
  state.encounter.status='lost';const html=chamberResult(state);
  assert.ok(html.includes('Historical context')&&html.includes('another man’s plan'),'the chamber result keeps the council’s page');
  state.encounter.status='won';assert.ok(!chamberResult(state).includes('Historical context'),'a won vote has no defeat page');
});

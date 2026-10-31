import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Game from '../src/core/game.js';
import {queueCommand,step} from '../src/core/realtime/simulation.js';
import {ERRANDS} from '../src/data/dialogue.js';
import {ERRAND_STEPS} from '../src/data/errand-guidance.js';
import {campStoryFlag} from '../src/data/camp-stories.js';
import {errandGuidance,errandGuidanceList,errandDestinationAction,createErrandTracker} from '../src/ui/errand-guidance.js';
import {missionOrdersPanel,trackedErrandPanel} from '../src/ui/soldier-views.js';

const fixtures=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
// Labelled branch scenarios on copies of legally earned camp fixtures. These
// cover uncommon states; the dialogue journey below uses only public replies.
function scenario(id,more={}){
  const chapter=ERRANDS[id].chapter,state=Game.deserialize(JSON.stringify(fixtures.scenes.find(s=>s.id===`camp-${chapter}`).state));
  state.encounterIndex=0;state.soldier.errands={[id]:'accepted'};state.soldier.flags={};state.soldier.pack=[];state.soldier.ground={};
  state.soldier.decorations=[];state.soldier.titles=[];state.soldier.worn={};state.soldier.base.elo=8;state.soldier.base.auth=8;
  state.decisions.ch2='carry';state.oath=true;
  Object.assign(state.soldier.flags,Object.fromEntries((more.flags??[]).map(f=>[f,true])));
  if(more.item)state.soldier.pack.push({id:more.item,uid:'fixture-item',x:0,y:0});
  if(more.ground)state.soldier.ground[`camp:${chapter}`]=[{id:more.ground,uid:'fixture-ground'}];
  return state;
}
const checks={
  drill_first:[[{},{tree:'ch1:post'}],[{flags:['post_struck']},{tree:'ch1:varro'}]],
  names_roll:[[{},{tree:'ch2:capsarius'}],[{flags:['names_list']},{tree:'ch2:sabinus'}]],
  medicine:[[{},{tree:'ch2:trader'}],[{item:'medicine_box'},{tree:'ch2:capsarius'}]],
  shields:[[{},{tree:'ch2:shields'}],[{flags:['shields_delivered']},{tree:'ch2:naso'}]],
  letter:[[{},{tree:'ch3:trader'}],[{item:'wax_tablet'},{tree:'ch3:clerk'}]],
  well:[[{},{tree:'ch3:well'}],[{flags:['well_seen']},{tree:'ch3:capsarius'}]],
  tracks:[[{},{tree:'ch3:tracks'}],[{flags:['tracks_read']},{tree:'ch3:brennus'}]],
  second_copy:[[{},{tree:'ch3:clerk'}]],
  gate_braces:[[{item:'gate_brace'},{tree:'ch4:brace-rack'}],[{flags:['brace_racked']},{tree:'ch4:quartermaster'}],[{},{panel:'kit'}]],
  ford_count:[[{},{tree:'ch4:lookout'}],[{flags:['rafts_counted']},{tree:'ch4:brennus'}]],
  listening_bowl:[[{},{tree:'ch5:water'}],[{item:'bronze_bowl'},{tree:'ch5:engineer'}],[{flags:['bronze_bowl_lent']},{panel:'kit'}]],
  letter_home:[[{item:'company_letter'},{tree:'ch5:evacuation'}],[{flags:['company_letter_sent']},{tree:'ch5:lucan'}],[{},{panel:'kit'}]],
  western_wells:[[{},{tree:'ch6:marker'}],[{flags:['western_marker_read']},{tree:'ch6:caravan'}],[{flags:['western_marker_read','refuge_tracks_read']},{tree:'ch6:felix'}]],
  eagle_cords:[[{},{tree:'ch6:trader'}],[{item:'leather_thongs'},{tree:'ch6:aquilifer'}]],
  boot_sizes:[[{},{tree:'ch7:boot-tally'}],[{flags:['boot_tally_read']},{tree:'ch7:quartermaster'}]],
  theon_order:[[{},{tree:'ch7:theon'}]],
  ford_soundings:[[{},{tree:'ch8:sounding-pole'}],[{flags:['landing_sounded']},{tree:'ch8:depth-marks'}],[{flags:['landing_sounded','depth_board_read']},{tree:'ch8:felix'}]],
  seed_jar:[[{},{tree:'ch8:seed-jar'}],[{item:'seed_jar',flags:['seed_jar_taken']},{tree:'ch8:aelia'}],[{flags:['seed_jar_taken']},{panel:'kit'}]],
  recall_signal:[[{},{tree:'ch9:cornicen'}],...['recall_three','recall_long','recall_rising'].map(flag=>[{flags:[flag]},{tree:'ch9:lucan'}])],
  market_keys:[[{},{tree:'ch9:requisition-tally'}],[{flags:['granaries_counted']},{tree:'ch9:envoy'}]],
  granary_receipts:[[{},{tree:'ch10:granary-receipts'}],[{flags:['receipts_read']},{tree:'ch10:warehouse-tally'}],[{flags:['receipts_read','warehouse_read']},{tree:'ch10:provincial-clerk'}]],
  frightened_witness:[[{},{tree:'ch10:aelia'}],[{flags:['aelia_vouched']},{tree:'ch10:witness'}],[{flags:['witness_persuaded']},{tree:'ch10:theon'}]],
  station_report:[[{},{tree:'ch11:station-report'}],[{item:'report_copy'},{tree:'ch11:paullus'}],[{flags:['station_report_copied']},{panel:'kit'}]],
  province_accounts:[[{},{tree:'ch11:province-accounts'}],[{item:'accounts_copy'},{tree:'ch11:crispus'}],[{flags:['province_accounts_taken']},{panel:'kit'}]],
  seal_shown:[[{},{tree:'ch12:standards'}],[{flags:['seal_held_up']},{tree:'ch12:quintus'}]],
  spring_seed:[[{},{tree:'ch12:trader'}],[{item:'seed_grain'},{tree:'ch12:aelia'}],[{flags:['seed_released']},{tree:'ch12:aelia'}]]
};

test('every authored ordinary errand has current-state guidance with real destinations in all twelve chapters',()=>{
  const ordinary=Object.keys(ERRANDS).filter(id=>!id.startsWith('company-story:')).sort();
  assert.equal(ordinary.length,26);assert.deepEqual(Object.keys(ERRAND_STEPS).sort(),ordinary);assert.deepEqual(Object.keys(checks).sort(),ordinary);
  for(const [id,cases]of Object.entries(checks))for(const [more,expected]of cases){
    const state=scenario(id,more),before=JSON.stringify(state),guide=errandGuidance(state,id);
    for(const [key,value]of Object.entries(expected))assert.equal(guide.destination?.[key],value,`${id} ${JSON.stringify(more)}: ${guide.text}`);
    assert.equal(guide.trackable,true);assert.ok(guide.text.length<125,`${id}: concise next step`);
    assert.equal(JSON.stringify(state),before,'reading guidance preserves the entire campaign and RNG');
    if(guide.destination.tree)assert.ok(Game.campConversation(state,guide.destination.tree),`${id} opens a real existing tree`);
  }
});

test('each guided dialogue destination can advance its errand through actual legal replies or the offered shop',()=>{
  // Search a small, bounded dialogue tree with public commands, rather than
  // assuming that a valid tree ID contains the reply the guidance promises.
  // Each case is still an explicitly constructed branch scenario.
  for(const [id,cases]of Object.entries(checks))for(const [more,expected]of cases){
    if(!expected.tree)continue;
    const initial=scenario(id,more),original=errandGuidance(initial,id).text,queue=[{state:initial,node:null,depth:0}],seen=new Set();let advanced=false;
    while(queue.length&&!advanced){
      const {state,node,depth}=queue.shift(),key=JSON.stringify([state.soldier,node]);if(seen.has(key)||depth>5)continue;seen.add(key);
      const view=Game.campConversation(state,expected.tree,node);if(!view)continue;
      for(const option of view.options.filter(o=>!o.needs.length)){
        const trial=structuredClone(state),outcome=Game.campReply(trial,{treeId:expected.tree,nodeId:view.nodeId,index:option.index});if(!outcome.ok)continue;
        if(outcome.open==='trader'){
          const item=ERRAND_STEPS[id].find(s=>s.when.item)?.when.item;
          if(item){trial.soldier.denarii=100;assert.ok(Game.soldierCommand(trial,{kind:'buy',itemId:item,from:'trader'}).ok,`${id}: its named seller stocks the item`);}
        }
        const next=errandGuidance(trial,id);if(next.status==='done'||next.text!==original){advanced=true;break;}
        if(outcome.next)queue.push({state:trial,node:outcome.next,depth:depth+1});
      }
    }
    assert.ok(advanced,`${id} ${JSON.stringify(more)}: ${expected.tree} must permit the promised next step`);
  }
});

test('items left on this camp’s ground point to Equipment rather than another purchase or a spent pickup',()=>{
  for(const [id,item,flag]of [['medicine','medicine_box'],['letter','wax_tablet'],['gate_braces','gate_brace'],['listening_bowl','bronze_bowl','bronze_bowl_lent'],
    ['letter_home','company_letter'],['eagle_cords','leather_thongs'],['seed_jar','seed_jar','seed_jar_taken'],['station_report','report_copy','station_report_copied'],
    ['province_accounts','accounts_copy','province_accounts_taken'],['spring_seed','seed_grain']]){
    const state=scenario(id,{ground:item,flags:flag?[flag]:[]}),guide=errandGuidance(state,id);
    assert.equal(guide.destination?.panel,'kit',id);assert.match(guide.text,/Collect .*camp ground/);
    assert.deepEqual(errandDestinationAction(state,id),{panel:'kit'});
    state.soldier.ground['camp:1']=state.soldier.ground[`camp:${state.chapter}`];if(state.chapter!==1)delete state.soldier.ground[`camp:${state.chapter}`];
    assert.doesNotMatch(errandGuidance(state,id).text,/Collect .*camp ground/,`${id} never promises an item from another camp`);
  }
});

test('guidance uses effective attributes, decorations, the oath and the actual present companion',()=>{
  const witness=scenario('frightened_witness');witness.soldier.base.elo=14;assert.equal(errandGuidance(witness,'frightened_witness').destination.tree,'ch10:witness');
  witness.soldier.base.elo=8;witness.soldier.decorations.push('corona_civica');assert.equal(errandGuidance(witness,'frightened_witness').destination.tree,'ch10:witness');
  const spring=scenario('spring_seed');spring.soldier.base.auth=15;assert.equal(errandGuidance(spring,'spring_seed').destination.tree,'ch12:quartermaster');
  const seal=scenario('seal_shown');seal.oath=false;assert.equal(errandGuidance(seal,'seal_shown').destination,null);assert.equal(errandGuidance(seal,'seal_shown').trackable,false);
  for(const [id,flag]of [['letter_home','company_letter_sent'],['recall_signal','recall_three']]){
    const state=scenario(id,{flags:[flag]});assert.match(errandGuidance(state,id).text,/Lucan/);
    state.decisions.ch2='leave';const guide=errandGuidance(state,id);assert.match(guide.text,/Sabinus/);assert.equal(guide.destination.id,'sabinus');
    state.company.push({id:'sabinus',recovery:1});if(state.chapter===9)assert.equal(errandGuidance(state,id).destination.place,'valetudinarium');
    delete state.decisions.ch2;assert.equal(errandGuidance(state,id).destination,null);assert.equal(errandGuidance(state,id).trackable,false);
  }
});

test('all nine company stories distinguish pending replies, available reports and filed reports',()=>{
  for(let chapter=4;chapter<=12;chapter++){
    const id=`company-story:${chapter}`,state=scenario(id);assert.equal(errandGuidance(state,id).trackable,false,'no invented choice');
    state.soldier.flags[campStoryFlag(chapter)]=true;
    assert.equal(errandGuidance(state,id).status,'waiting');assert.equal(errandGuidance(state,id).destination,null);
    assert.equal(errandDestinationAction(state,id),null);
    state.encounterIndex=1;assert.equal(errandGuidance(state,id).destination.kind,'record');assert.deepEqual(errandDestinationAction(state,id),{tree:id});
    if(chapter<12){state.chapter++;state.encounterIndex=0;assert.equal(errandGuidance(state,id).status,'active','earlier company reports remain available');}
    state.soldier.errands[id]='done';assert.equal(errandGuidance(state,id).trackable,false);assert.equal(errandDestinationAction(state,id),null);
  }
});

test('unknown, legacy, completed, past and future errands never acquire a live destination',()=>{
  const state=scenario('seed_jar');assert.equal(errandGuidance(state,'unknown'),null);assert.equal(errandGuidance(state,'well'),null);
  state.soldier.errands.seed_jar='done';assert.equal(errandGuidance(state,'seed_jar').status,'done');assert.equal(errandDestinationAction(state,'seed_jar'),null);
  state.soldier.errands.seed_jar='accepted';state.chapter=9;assert.equal(errandGuidance(state,'seed_jar').status,'past');assert.equal(errandDestinationAction(state,'seed_jar'),null);
  state.chapter=7;assert.equal(errandGuidance(state,'seed_jar').status,'unavailable');assert.equal(errandDestinationAction(state,'seed_jar'),null);
  delete state.soldier;const before=JSON.stringify(state);assert.deepEqual(errandGuidanceList(state),[]);assert.equal(errandDestinationAction(state,'seed_jar'),null);assert.equal(JSON.stringify(state),before);
});

test('one optional tracked preference survives reload and steps but clears on completion, absence or another chapter/campaign',()=>{
  let saved=null;const options={load:()=>structuredClone(saved),save:value=>{saved=structuredClone(value);}},tracker=createErrandTracker(options),state=scenario('seed_jar');
  const before=JSON.stringify(state);assert.equal(tracker.read(state),null);assert.ok(tracker.select(state,'seed_jar'));assert.equal(JSON.stringify(state),before,'selection is not a campaign flag');
  state.soldier.pack.push({id:'seed_jar'});assert.match(tracker.read(state).text,/Return to Aelia/);
  assert.equal(createErrandTracker(options).read(state).id,'seed_jar','local preference survives reload');
  state.soldier.errands.ford_soundings='accepted';assert.ok(tracker.select(state,'ford_soundings'));assert.equal(tracker.read(state).id,'ford_soundings','exactly one selected');
  state.phase='encounter';assert.equal(tracker.read(state).id,'ford_soundings','hidden during the encounter, retained for return');assert.equal(tracker.select(state,'seed_jar'),false);
  state.phase='camp';state.soldier.errands.ford_soundings='done';assert.equal(tracker.read(state),null);assert.equal(saved,null);
  for(const change of [s=>s.chapter++,s=>s.seed++,s=>s.name+=' another',s=>s.phase='promotion']){
    const s=scenario('seed_jar');tracker.select(s,'seed_jar');change(s);assert.equal(tracker.read(s),null);assert.equal(saved,null);
  }
  const companion=scenario('letter_home',{flags:['company_letter_sent']});tracker.select(companion,'letter_home');delete companion.decisions.ch2;assert.equal(tracker.read(companion),null);
  const replay=scenario('seed_jar');replay.archiveReplay={};assert.equal(tracker.select(replay,'seed_jar'),false);assert.equal(errandDestinationAction(replay,'seed_jar'),null);
  assert.doesNotThrow(()=>createErrandTracker({load:()=>{throw Error('storage denied');},save:()=>{throw Error('quota');}}).select(scenario('seed_jar'),'seed_jar'));
  assert.equal(createErrandTracker({load:()=>({id:'unknown'})}).read(state),null);
});

function talk(state,treeId,...patterns){
  let nodeId=null;
  for(const pattern of patterns){const view=Game.campConversation(state,treeId,nodeId),option=view.options.find(o=>pattern.test(o.text));
    assert.ok(option,`${treeId}: ${pattern}`);const outcome=Game.campReply(state,{treeId,nodeId:view.nodeId,index:option.index});assert.ok(outcome.ok,outcome.message);nodeId=outcome.next;}
}
test('legal seed-jar replies change the next step immediately, preserve the preference through save/reload and clear on completion',()=>{
  const state=Game.deserialize(JSON.stringify(fixtures.scenes.find(s=>s.id==='camp-8').state));
  talk(state,'ch8:aelia',/households need/,/find it/);const tracker=createErrandTracker();assert.ok(tracker.select(state,'seed_jar'));
  assert.equal(tracker.read(state).destination.tree,'ch8:seed-jar');
  talk(state,'ch8:seed-jar',/Take the jar/);assert.match(tracker.read(state).text,/Return to Aelia/);
  const loaded=Game.deserialize(Game.serialize(state));assert.match(tracker.read(loaded).text,/Return to Aelia/);
  const before=loaded.soldier.tp;talk(loaded,'ch8:aelia',/Ulpii’s jar/);assert.equal(tracker.read(loaded),null);assert.equal(loaded.soldier.tp,before+ERRANDS.seed_jar.reward.tp);
  assert.equal(errandDestinationAction(loaded,'seed_jar'),null);assert.doesNotMatch(missionOrdersPanel(loaded),/data-errand="seed_jar"/);
});

test('destination action walks through existing Talk/Interact commands without changing campaign or teleporting',()=>{
  for(const [id,more]of [['drill_first',{}],['seed_jar',{item:'seed_jar'}]]){
    const state=scenario(id,more),world=Game.createCampWorld(state),beforeState=JSON.stringify(state),beforeWorld=JSON.stringify(world),hero=world.actors.find(a=>a.id===world.heroId),start={x:hero.x,z:hero.z};
    const action=errandDestinationAction(state,id,world);assert.ok(['talk','interact'].includes(action.command.kind));assert.equal(JSON.stringify(state),beforeState);assert.equal(JSON.stringify(world),beforeWorld);
    assert.ok(queueCommand(world,action.command).ok);assert.deepEqual({x:hero.x,z:hero.z},start,'queueing does not move the soldier');
    let opened=false,maxStep=0;
    for(let i=0;i<2000&&!opened;i++){const x=hero.x,z=hero.z;step(world);maxStep=Math.max(maxStep,Math.hypot(hero.x-x,hero.z-z));opened=world.events.some(e=>e.kind==='talk'||e.kind==='used-object');}
    assert.ok(opened,'the existing movement reaches and opens the destination');assert.ok(maxStep<1,'ordinary walking, never camp travel');assert.equal(JSON.stringify(state),beforeState);
    world.chapter=12;assert.equal(errandDestinationAction(state,id,world),null,'stale world rejected');
  }
  const state=scenario('seed_jar',{item:'seed_jar'}),world=Game.createCampWorld(state);world.actors.find(a=>a.id==='aelia').alive=false;assert.equal(errandDestinationAction(state,'seed_jar',world),null);
  state.phase='encounter';assert.equal(errandDestinationAction(state,'seed_jar'),null);
});

test('Mission orders shows concise next actions and one optional tracker; past errands stay collapsed',()=>{
  const state=scenario('seed_jar',{item:'seed_jar'});state.soldier.errands.well='accepted';
  const html=missionOrdersPanel(state,{trackedErrand:'seed_jar'});assert.match(html,/Return to Aelia/);assert.match(html,/data-cmd="untrack-errand"/);
  assert.match(html,/Earlier unfinished errands/);assert.match(html,/<details[^>]*>[^]*Left in Chapter 3/);assert.doesNotMatch(html,/id="past-errands"[^>]*open/);
  assert.equal(trackedErrandPanel(null),'');assert.match(trackedErrandPanel(errandGuidance(state,'seed_jar')),/data-cmd="errand-destination"/);
  state.phase='encounter';assert.doesNotMatch(missionOrdersPanel(state),/data-cmd="(?:track-errand|untrack-errand|errand-destination)"/);
});

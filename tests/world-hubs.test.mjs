import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Game from '../src/core/game.js';
import {CAMPS,CAMP_PLACES,campPersonPresent} from '../src/data/camps.js';
import {CAMP_CONTEXT} from '../src/data/camp-regions.js';
import {CHAPTERS} from '../src/data/campaign.js';
import {queueCommand,routePreview,step} from '../src/core/realtime/simulation.js';
import {navGrid,walkable} from '../src/core/realtime/navigation.js';
import {ABILITIES} from '../src/data/realtime-rules.js';
import {abilityKey,commandOptions,pointerIntent} from '../src/core/realtime/intents.js';
import {campActivityFor,sampleCampActivity} from '../src/showcase/camp-activity.js';

// Legally earned chapter starts from the existing campaign harness, with
// explicitly injected choice/record variants for layout and presentation.
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
const stateFor=(chapter,comrade='carry',mentor='save')=>{
  const state=Game.deserialize(JSON.stringify(fixtures.scenes.find(s=>s.id===`camp-${chapter}`).state));
  state.decisions.ch2=comrade;state.decisions.ch6=mentor;return state;
};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

test('all twelve hubs have distinct regional purpose, a report, and seven reachable service places',()=>{
  assert.deepEqual(Object.keys(CAMPS).map(Number),Array.from({length:12},(_,i)=>i+1));
  assert.equal(new Set(Object.values(CAMPS).map(c=>c.title)).size,12);
  for(let chapter=1;chapter<=12;chapter++)for(const companion of ['carry','leave']){
    const state=stateFor(chapter,companion),before=JSON.stringify(state),world=Game.createCampWorld(state),camp=CAMPS[chapter];
    assert.equal(world.peaceful,true);assert.equal(world.map.id,`ch${chapter}-camp`);
    assert.deepEqual(Object.keys(world.places),CAMP_PLACES);
    assert.ok(camp.purpose);assert.ok(Game.campConversation(state,camp.reportTree));
    for(const target of [...world.actors.filter(a=>a.id!=='hero'),...world.objects,...Object.values(world.places).map(p=>({...p,z:p.z+2}))]){
      const route=routePreview(world,'hero',target),end=route.points.at(-1);
      assert.ok(end&&distance(end,target)<=1.8,`chapter ${chapter}/${companion}: ${target.id??target.name} reachable`);
    }
    if(chapter>=3){
      assert.equal(world.actors.some(a=>a.id==='lucan'),companion==='carry');
      assert.equal(world.actors.some(a=>a.id==='sabinus'),companion==='leave');
    }
    assert.equal(JSON.stringify(state),before,'constructing the world does not save visits or spend gameplay randomness');
  }
});

test('all regional solid props have blocked footprints and leave conversations and travel arrivals clear',()=>{
  for(let chapter=1;chapter<=12;chapter++){
    const world=Game.createCampWorld(stateFor(chapter)),grid=navGrid(world.map),pads=world.campPresentation.sceneryPads;
    assert.equal(pads.length,3,`chapter ${chapter}`);
    const points=[...world.actors,...world.objects,...Object.values(world.places),...(chapter===5?[]:Object.values(world.places).map(p=>({...p,z:p.z+2})))];
    for(const pad of pads){
      assert.equal(pad.width,5);assert.equal(pad.depth,5);assert.equal(pad.cells.length,4);
      for(const {x,y}of pad.cells)assert.equal(walkable(grid,(x+.5)*2.5,(y+.5)*2.5),false);
      const cx=pad.x+world.map.width*1.25,cz=pad.z+world.map.height*1.25;
      for(const p of points)assert.ok(Math.hypot(Math.max(0,Math.abs(p.x-cx)-2.5),Math.max(0,Math.abs(p.z-cz)-2.5))>=3.2,
        `chapter ${chapter}: ${pad.id} clears ${p.id??p.name}`);
    }
  }
});

test('a legal walking tour can talk to every later-hub service and use its report without advancing the story',()=>{
  for(const chapter of [4,6,7,8,9,10,11,12]){
    const state=stateFor(chapter),before=JSON.stringify(state),world=Game.createCampWorld(state);
    const targets=[...world.actors.filter(a=>a.id!=='hero').map(a=>({id:a.id,kind:'talk',payload:{targetId:a.id},event:'talk',field:'targetId'})),
      ...world.objects.map(o=>({id:o.id,kind:'interact',payload:{objectId:o.id},event:'used-object',field:'objectId'}))];
    for(const target of targets){
      assert.ok(queueCommand(world,{actorId:'hero',kind:target.kind,payload:target.payload}).ok);
      let reached=false;
      for(let i=0;i<1200&&!reached;i++){step(world);reached=world.events.some(e=>e.kind===target.event&&e[target.field]===target.id);}
      assert.ok(reached,`chapter ${chapter}: walked to ${target.id}`);
    }
    assert.equal(world.status,'active');assert.ok(world.actors.every(a=>a.side!=='enemy'));
    assert.equal(JSON.stringify(state),before,'walking and conversation requests never grant advancement or rewards');
  }
});

test('all hub offensive inputs are refused with the entire simulation and campaign unchanged',()=>{
  for(let chapter=1;chapter<=12;chapter++){
    const state=stateFor(chapter),world=Game.createCampWorld(state),target=world.actors.find(a=>a.id!=='hero'),before=JSON.stringify(world),campaign=Game.serialize(state);
    const commands=[{kind:'attack',payload:{targetId:target.id,forced:true}},{kind:'setDrawn',payload:{drawn:true}},{kind:'warCry'},{kind:'order',payload:{}}];
    for(const ability of Object.values(ABILITIES).filter(a=>!a.enemyOnly)){
      commands.push({kind:'ability',payload:{abilityId:ability.id,targetId:target.id,forced:true}});
      if(!['bind_wounds','carry'].includes(ability.id))commands.push({kind:'ability',payload:{abilityId:ability.id}});
      if(ability.groundTarget&&ability.target==='enemy')commands.push({kind:'ability',payload:{abilityId:ability.id,x:target.x,z:target.z}});
    }
    for(const command of commands){
      assert.equal(queueCommand(world,{actorId:'hero',...command}).reason,'PEACEFUL_CAMP');
      assert.equal(JSON.stringify(world),before,'ticks, queue, resources, allegiance and RNG remain unchanged');
    }
    assert.equal(Game.serialize(state),campaign);
    const options=commandOptions(world);
    assert.ok(options.some(o=>o.command?.kind==='talk'));
    assert.ok(!options.some(o=>/Force an attack|Draw weapons|war cry|Brace|Scout|Rally|Guard|Inspire/.test(o.label)),'combat controls do not clutter a safe hub');
    for(const id of ['brace','scout','rally','inspire']){
      assert.equal(abilityKey(world,{abilityId:id}).command,null);
      assert.equal(pointerIntent(world,{button:'right',abilityId:id}).reason,'PEACEFUL_CAMP');
    }
    assert.equal(JSON.stringify(world),before,'command and pointer previews are also pure');
  }
});

test('regional choices and routines are pure views of existing decisions, with absent companions replaced',()=>{
  for(const chapter of CHAPTERS.filter(c=>c.id!==5))for(const option of chapter.decision.options){
    const state=stateFor(chapter.id);state.decisions[chapter.decision.id]=option.id;
    const before=JSON.stringify(state),presentation=Game.campPresentationFor(state),world=Game.createCampWorld(state);
    assert.equal(presentation.decision,option.id);
    assert.equal(presentation.decisionDetails[0].state,CAMP_CONTEXT[chapter.id].choices[option.id].state);
    assert.equal(presentation.outcomeDetails.length,0);
    // From Chapter IV the supply orderly and the trader both carry; Chapters I–III have only Syra.
    assert.deepEqual(presentation.ambient.map(a=>a.routine).sort(),chapter.id<=3?['carry','rest','watch','work']:['carry','carry','rest','watch','work']);
    for(const record of presentation.ambient){
      const actor=world.actors.find(a=>a.id===record.id);assert.ok(actor);
      assert.equal(campActivityFor(world,actor.id),record.routine);
      assert.deepEqual(sampleCampActivity(world,actor,{time:0,reducedMotion:true}),sampleCampActivity(world,actor,{time:999,reducedMotion:true}));
    }
    assert.equal(JSON.stringify(state),before,'injected branch sampling cannot alter the campaign');
  }
  for(const chapter of [7,8,9,10,11,12])for(const mentor of ['save','obey']){
    const p=Game.campPresentationFor(stateFor(chapter,'leave',mentor));
    assert.equal(p.decisionDetails.find(d=>d.id==='mentor-memory').state,mentor==='save'?'mentor-letter':'vine-stick');
    assert.equal(CAMPS[chapter].people.filter(p=>p.id==='lucan'&&campPersonPresent(stateFor(chapter,'leave',mentor),p)).length,0);
  }
});

test('regional outcomes require a successful matching commit, never a selected plan, failure, or another chapter',()=>{
  for(const chapter of CHAPTERS.filter(c=>c.id!==5)){
    const state=stateFor(chapter.id),encounter=chapter.encounters[0];
    state.commandCampaign??={records:[]};state.commandCampaign.plan='engineers';
    state.commandCampaign.records=[{id:encounter.id,chapter:chapter.id,opportunity:'stores'}];
    assert.equal(Game.campPresentationFor(state).committedRecords.length,0);
    state.history=[{id:encounter.id,kind:encounter.kind,result:'lost'}];
    assert.equal(Game.campPresentationFor(state).outcomeDetails.length,0);
    state.history[0].result='won';
    const before=JSON.stringify(state),p=Game.campPresentationFor(state);
    assert.equal(p.committedRecords.length,1);assert.equal(p.outcomeDetails.length,1);
    assert.equal(JSON.stringify(state),before);
    state.commandCampaign.records[0].id=chapter.id===1?'ch2-marsh':'ch1-road';
    assert.equal(Game.campPresentationFor(state).committedRecords.length,0);
    assert.equal(Game.campPresentationFor(state).outcomeDetails.length,0);
  }
});

test('every legally earned camp save round-trips exactly after world and report inspection',()=>{
  for(let chapter=1;chapter<=12;chapter++){
    const state=Game.deserialize(JSON.stringify(fixtures.scenes.find(s=>s.id===`camp-${chapter}`).state));
    const before=Game.serialize(state);
    Game.createCampWorld(state);Game.campPresentationFor(state);Game.campConversation(state,CAMPS[chapter].reportTree);
    assert.equal(Game.serialize(state),before);
    assert.equal(Game.serialize(Game.deserialize(before)),before,'no migration or saved presentation fields are needed');
  }
});

test('relief, judgment, preparation and negotiation details follow existing commands without inventing completion',()=>{
  const s=stateFor(10);s.decisions.ch10='shared';
  assert.ok(Game.allocate(s,{river:2,farms:3,town:1}).ok);assert.ok(Game.judge(s,'shared').ok);
  const before=Game.serialize(s),p=Game.campPresentationFor(s);
  assert.equal(p.decisionDetails.filter(d=>d.id.startsWith('relief:')).reduce((n,d)=>n+d.count,0),6);
  assert.equal(p.decisionDetails.find(d=>d.id==='land-judgment').state,'shared');
  assert.match(p.summary,/judgment is entered/);assert.equal(p.outcomeDetails.length,0);
  assert.equal(Game.serialize(s),before);
  for(const [chapter,key,value]of [[7,'preparation','fortify'],[8,'negotiation','safe-passage'],[9,'stratagem','flank']]){
    const state=stateFor(chapter);state[key]=value;assert.ok(Game.campPresentationFor(state).decisionDetails.some(d=>d.state===value));
  }
});

test('optional regional reports and service conversations preserve the exact chronicle and grant nothing',()=>{
  for(let chapter=1;chapter<=12;chapter++)if(chapter!==5){
    const state=stateFor(chapter),before=Game.serialize(state);
    for(const treeId of ['hub:report','hub:local','hub:clerk','hub:quartermaster','hub:instructor','hub:capsarius','hub:porter']){
      const view=Game.campConversation(state,treeId);assert.ok(view.text.length<650,'optional context stays short');
      for(const option of view.options){
        assert.equal(option.preview.length,0,'no new paid errands or rewards');
        assert.ok(Game.campReply(state,{treeId,nodeId:view.nodeId,index:option.index}).ok);
        assert.equal(Game.serialize(state),before,`${chapter}/${treeId}: reading or opening services changes no campaign field`);
      }
    }
  }
});

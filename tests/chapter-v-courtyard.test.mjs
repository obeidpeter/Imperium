import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Game from '../src/core/game.js';
import {CAMPS,CAMP_PLACES,campPlaceName} from '../src/data/camps.js';
import {routePreview,queueCommand,step,worldHash} from '../src/core/realtime/simulation.js';
import {createCampaignViews} from '../src/ui/campaign-views.js';
import {Document} from './mini-dom.mjs';
import {campActivityFor,sampleCampActivity} from '../src/showcase/camp-activity.js';
import {actorPose} from '../src/showcase/actor-pose.js';
import {navGrid,walkable} from '../src/core/realtime/navigation.js';
import {ABILITIES} from '../src/data/realtime-rules.js';

// The campaign checkpoints were captured by the existing legal-command harness.
// Decision/record variants below are explicitly scenario fixtures, not evidence
// of a campaign completed by a player.
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
function checkpoint(index=0){
  const source=index?fixtures.scenes.find(s=>s.id==='board-ch5-wall').state.snapshot:fixtures.scenes.find(s=>s.id==='camp-5').state;
  const state=Game.deserialize(JSON.stringify(source));
  Game.enableCommandCampaign(state);Game.enableFieldApproaches(state);return state;
}
const docFor=html=>{const doc=new Document();doc.body.innerHTML=html;return doc;};

test('Chapter V remains available in the full rollout, and every courtyard person and object is reachable before both encounters',()=>{
  assert.deepEqual(Object.keys(CAMPS),Array.from({length:12},(_,i)=>String(i+1)));
  for(const index of [0,1])for(const companion of ['carry','leave']){
    const state=checkpoint(index);state.decisions.ch2=companion;
    const before=JSON.stringify(state),world=Game.createCampWorld(state);
    assert.equal(world.campId,'ch5-camp');assert.equal(world.map.width,20);assert.equal(world.map.height,16);
    assert.deepEqual(Object.keys(world.places),CAMP_PLACES);
    assert.ok(world.actors.some(a=>a.id===(companion==='carry'?'lucan':'sabinus')));
    assert.ok(!world.actors.some(a=>a.id===(companion==='carry'?'sabinus':'lucan')));
    for(const target of [...world.actors.filter(a=>a.id!=='hero'),...world.objects]){
      const route=routePreview(world,'hero',target),end=route.points.at(-1);
      assert.ok(end&&Math.hypot(end.x-target.x,end.z-target.z)<=1.8,`${index}: ${target.id} can be approached`);
      assert.ok(Game.campConversation(state,target.talk?.tree??target.talk),`${target.id} has a conversation`);
    }
    for(const place of CAMP_PLACES){assert.equal(world.places[place].name,campPlaceName(5,place));}
    for(const marker of world.campPresentation.interactions){
      const target=world.objects.find(o=>o.id===marker.id);assert.ok(target);
      assert.equal(marker.x,target.x-25);assert.equal(marker.z,target.z-20);
    }
    for(let tick=0;tick<600;tick++)step(world);
    assert.equal(world.status,'active');assert.ok(world.actors.every(a=>a.side!=='enemy'));
    assert.equal(JSON.stringify(state),before,'walking and ambient presentation cannot alter the campaign');
  }
});

test('walking to the engineer opens his conversation and leaving it grants nothing',()=>{
  const state=checkpoint(),before=Game.serialize(state),world=Game.createCampWorld(state);
  assert.ok(queueCommand(world,{actorId:'hero',kind:'talk',payload:{targetId:'engineer'}}).ok);
  let talked=false;
  for(let tick=0;tick<1200&&!talked;tick++){step(world);talked=world.events.some(e=>e.kind==='talk'&&e.targetId==='engineer');}
  assert.ok(talked);
  const view=Game.campConversation(state,'ch5:engineer'),leave=view.options.find(o=>o.text==='Farewell.');
  assert.ok(Game.campReply(state,{treeId:view.treeId,nodeId:view.nodeId,index:leave.index}).ok);
  assert.equal(Game.serialize(state),before);
  const training=view.options.find(o=>/preparation/.test(o.text));
  assert.equal(Game.campReply(state,{treeId:view.treeId,nodeId:view.nodeId,index:training.index}).open,'preparation');
  assert.equal(Game.serialize(state),before,'the preparation link does not choose or pay for a plan');
});

test('a legal walking tour can use every courtyard person and essential object before either encounter',()=>{
  for(const index of [0,1])for(const companion of ['carry','leave']){
    const state=checkpoint(index);state.decisions.ch2=companion;
    const before=JSON.stringify(state),world=Game.createCampWorld(state);
    const targets=[...world.actors.filter(a=>a.id!=='hero').map(a=>({id:a.id,kind:'talk',payload:{targetId:a.id},event:'talk',field:'targetId'})),
      ...world.objects.map(o=>({id:o.id,kind:'interact',payload:{objectId:o.id},event:'used-object',field:'objectId'}))];
    for(const target of targets){
      assert.ok(queueCommand(world,{actorId:'hero',kind:target.kind,payload:target.payload}).ok);
      let reached=false;
      for(let tick=0;tick<1200&&!reached;tick++){
        step(world);reached=world.events.some(e=>e.kind===target.event&&e[target.field]===target.id);
      }
      assert.ok(reached,`${index}/${companion}: ${target.id} can actually be used after walking around the service pads`);
    }
    assert.equal(JSON.stringify(state),before,'a tour cannot choose a decision or grant progress by itself');
  }
});

test('the courtyard refuses forced attacks and offensive abilities without spending anything or blocking services',()=>{
  for(const index of [0,1]){
    const state=checkpoint(index),world=Game.createCampWorld(state),campaignBefore=Game.serialize(state),before=JSON.stringify(world);
    assert.equal(world.peaceful,true);
    assert.equal(world.actors.find(a=>a.id==='hero').drawn,false);
    const refused=command=>{
      const result=queueCommand(world,{actorId:'hero',...command});
      assert.equal(result.ok,false);assert.equal(result.reason,'PEACEFUL_CAMP');assert.match(result.message,/Weapons stay sheathed/);
      assert.equal(JSON.stringify(world),before,'a refusal preserves RNG, ticks, queue, health, ammunition and all resources');
    };
    for(const target of world.actors.filter(a=>a.id!=='hero')){
      refused({kind:'attack',payload:{targetId:target.id,forced:true}});
      for(const ability of Object.values(ABILITIES).filter(a=>a.target==='enemy'&&!a.enemyOnly)){
        refused({kind:'ability',payload:{abilityId:ability.id,targetId:target.id,forced:true}});
        if(ability.groundTarget)refused({kind:'ability',payload:{abilityId:ability.id,x:target.x,z:target.z}});
      }
      // A self/ally ability can otherwise pass its own validation and reach
      // the command dispatcher's forced neutral-target provocation. Refuse
      // the payload itself before the queue, stamina or allegiance changes.
      for(const ability of Object.values(ABILITIES).filter(a=>a.target!=='enemy'&&!a.enemyOnly))
        refused({kind:'ability',payload:{abilityId:ability.id,targetId:target.id,forced:true}});
    }
    refused({kind:'setDrawn',payload:{drawn:true}});
    assert.equal(Game.serialize(state),campaignBefore);
    for(const command of [
      {kind:'move',payload:{x:world.places.principia.x,z:world.places.principia.z}},
      {kind:'talk',payload:{targetId:'engineer'}},
      {kind:'interact',payload:{objectId:'table'}},
      {kind:'setDrawn',payload:{drawn:false}}
    ])assert.ok(queueCommand(world,{actorId:'hero',...command}).ok,`${command.kind} remains available`);
  }
  // The approved rollout makes all hubs peaceful. Field encounters retain
  // their existing neutral-target and combat rules.
  const early=Game.createCampWorld(Game.newGame('T',275,{featureEdition:35,progression:true}));
  assert.equal(early.peaceful,true);
  assert.equal(queueCommand(early,{actorId:'hero',kind:'attack',payload:{targetId:'varro',forced:true}}).reason,'PEACEFUL_CAMP');
  const state=checkpoint();assert.ok(Game.choose(state,'civilians').ok);assert.ok(Game.startEncounter(state,{controls:'realtime'}).ok);
  assert.equal(Game.realtimeWorld(state).peaceful,undefined);
});

test('three authored service pads block movement without obstructing people, objects or service travel',()=>{
  const world=Game.createCampWorld(checkpoint()),grid=navGrid(world.map),pads=world.campPresentation.sceneryPads;
  assert.equal(pads.length,3);
  for(const pad of pads){
    assert.equal(pad.width,5);assert.equal(pad.depth,5);
    for(const cell of pad.cells){
      assert.equal(world.map.terrain[cell.y][cell.x],'rock');
      assert.equal(walkable(grid,(cell.x+.5)*2.5,(cell.y+.5)*2.5),false);
    }
    const cx=pad.x+25,cz=pad.z+20;
    for(const p of [...world.actors.filter(a=>a.id!=='hero'),...world.objects,...Object.values(world.places)]){
      const dx=Math.max(0,Math.abs(p.x-cx)-pad.width/2),dz=Math.max(0,Math.abs(p.z-cz)-pad.depth/2);
      assert.ok(Math.hypot(dx,dz)>=3.2,`${pad.id} leaves an interaction clearance for ${p.id??p.name}`);
    }
  }
  for(const [id,p]of Object.entries(world.places)){
    const route=routePreview(world,'hero',{x:p.x,z:p.z+2}),end=route.points.at(-1);
    assert.ok(end&&Math.hypot(end.x-p.x,end.z-p.z-2)<1.8,`${id}: travel arrival remains clear`);
  }
});

test('courtyard decisions use the existing rules and the gate starts the right encounter with exact Retry',()=>{
  for(const index of [0,1]){
    const state=checkpoint(index);
    if(!state.decisions.ch5){
      assert.ok(Game.campConversation(state,'gate').options[0].needs.length);
      const direct=structuredClone(state),table=Game.campConversation(state,'table'),choice=table.options.find(o=>o.decision==='civilians');
      assert.ok(Game.campReply(state,{treeId:'table',index:choice.index}).ok);assert.ok(Game.choose(direct,'civilians').ok);
      assert.equal(Game.serialize(state),Game.serialize(direct));
    }
    const gate=Game.campConversation(state,'gate');assert.equal(gate.options[0].needs.length,0);
    assert.match(gate.options[0].text,index?/red river gate/:/cracked tower/);
    assert.equal(Game.campReply(state,{treeId:'gate',index:0}).open,'march');
    assert.ok(Game.startEncounter(state,{controls:'realtime'}).ok);
    assert.equal(state.encounter.id,index?'ch5-wall':'ch5-mine');
    const start=Game.serialize(state),world=Game.realtimeWorld(state),hash=worldHash(world);
    for(let tick=0;tick<20;tick++)step(world);
    assert.ok(Game.saveRealtime(state,world).ok);assert.ok(Game.retry(state).ok);
    assert.equal(worldHash(Game.realtimeWorld(state)),hash);assert.equal(Game.serialize(state),start);
  }
});

test('courtyard consequences describe only recorded decisions and committed field opportunities',()=>{
  const state=checkpoint(),before=Game.serialize(state);
  assert.equal(Game.campPresentationFor(state).civilianOutcome,'waiting');
  assert.equal(Game.serialize(state),before);
  for(const choice of ['civilians','countermine']){
    const variant=structuredClone(state);assert.ok(Game.choose(variant,choice).ok);
    const p=Game.campPresentationFor(variant);
    assert.equal(p.civilianOutcome,choice==='civilians'?'departing':'delayed');
    assert.equal(p.stores,choice==='civilians'?'transport':'secured');
    assert.deepEqual(p.ambient.map(a=>a.routine).sort(),['carry','rest','watch','work']);
    assert.equal(p.waterDetail,false);assert.equal(p.engineeringRecovered,false);
    variant.commandCampaign.plan='engineers';assert.equal(Game.campPresentationFor(variant).engineeringRecovered,false,'a chosen preparation is not a recovered field opportunity');
    variant.commandCampaign.records.push({id:'ch5-mine',opportunity:'signal'});
    assert.equal(Game.campPresentationFor(variant).waterDetail,false,'an uncommitted record is ignored');
    variant.history.push({id:'ch5-mine',kind:'battle',result:'won'});
    assert.equal(Game.campPresentationFor(variant).waterDetail,true);
    assert.match(Game.campConversation(variant,'ch5:report').text,/records the water detail/);
    variant.commandCampaign.records[0].opportunity='stores';
    assert.equal(Game.campPresentationFor(variant).engineeringRecovered,true);assert.equal(Game.campPresentationFor(variant).waterDetail,false);
    assert.match(Game.campConversation(variant,'ch5:report').text,/recovered engineers/);
  }
  delete state.commandCampaign;delete state.decisions.ch5;
  assert.doesNotThrow(()=>Game.createCampWorld(state),'legacy saves need no new presentation fields');
});

test('Chapter V keeps decisions, preparation, equipment, company and departure available through the list path',()=>{
  for(const index of [0,1])for(const companion of ['carry','leave']){
    const state=checkpoint(index);state.decisions.ch2=companion;
    const before=JSON.stringify(state),views=createCampaignViews(()=>({state,screen:'game',settings:{}})),doc=docFor(views.realtimeCamp());
    for(const selector of ['[data-cmd="start"]','[data-cmd="conversation"][data-id="table"]','[data-cmd="soldier-panel"][data-id="kit"]','[data-cmd="soldier-panel"][data-id="company"]']){
      const control=doc.querySelector(selector);assert.ok(control,selector);
      for(let p=control.parentElement;p;p=p.parentElement)assert.ok(p.localName!=='details'||p.open,`${selector} remains directly accessible`);
    }
    assert.ok(doc.getElementById('camp-preparation'));assert.ok(doc.querySelector('[data-cmd="operational-plan"]'));
    assert.ok(doc.querySelector(`[data-cmd="conversation"][data-id="ch5:${companion==='carry'?'lucan':'sabinus'}"]`));
    assert.equal(doc.querySelector(`[data-cmd="conversation"][data-id="ch5:${companion==='carry'?'sabinus':'lucan'}"]`),null);
    assert.match(doc.getElementById('camp-places').textContent,/Command shelter/);
    assert.equal(JSON.stringify(state),before);
  }
});

test('ambient service routines are bounded, pause beside the player and never move rules actors',()=>{
  const state=checkpoint(),world=Game.createCampWorld(state),hero=world.actors.find(a=>a.id==='hero');
  // Move only the labelled test fixture hero away from the four services.
  hero.x=4;hero.z=4;const before=JSON.stringify(world),poses=[];
  for(const record of world.campPresentation.ambient){
    const actor=world.actors.find(a=>a.id===record.id);assert.ok(actor,'every routine reuses an existing service actor');
    assert.equal(record.x,actor.x-world.map.width*2.5/2);assert.equal(record.z,actor.z-world.map.height*2.5/2);
    assert.equal(campActivityFor(world,actor.id),record.routine);
    for(const time of [0,.5,2,10,30]){
      const sample=sampleCampActivity(world,actor,{time});assert.equal(sample.motion,`camp-${record.routine}`);
      const pose=actorPose({...sample,time});poses.push(JSON.stringify(pose));
      assert.equal(pose.yaw,0);assert.ok(Math.abs(pose.hipX)<.03&&Math.abs(pose.hipZ)<.03,'no root migration');
      assert.ok(pose.feet.every(f=>Math.abs(f.z)<=.05&&f.y===.07),'the interaction anchor and feet stay planted');
    }
    assert.deepEqual(sampleCampActivity(world,actor,{time:0,reducedMotion:true}),sampleCampActivity(world,actor,{time:999,reducedMotion:true}));
    assert.equal(sampleCampActivity(world,{...actor,moving:true}),null);
  }
  assert.ok(new Set(poses).size>4,'routines have different authored poses');
  assert.equal(JSON.stringify(world),before,'sampling never changes clocks, RNG, navigation or campaign state');
  const worker=world.actors.find(a=>a.id==='quartermaster');hero.x=worker.x;hero.z=worker.z+2;
  assert.equal(sampleCampActivity(world,worker),null,'the worker attends the approaching player');
  assert.equal(campActivityFor({...world,kind:'battle'},worker.id),null,'service routines never animate a battle actor');
});

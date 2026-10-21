import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {commandProblem,queueCommand,restoreWorld,snapshotWorld,step,worldHash} from '../src/core/realtime/simulation.js';
import {findRoute,navGrid} from '../src/core/realtime/navigation.js';
import {pointerIntent} from '../src/core/realtime/intents.js';
import {smokeBetween} from '../src/core/realtime/sight.js';
import {squadModifiers} from '../src/core/realtime/squads.js';
import {TIME} from '../src/data/realtime-rules.js';
import {applyRealtimeOutcome} from '../src/core/realtime/campaign-encounter.js';
import {exchangeWound} from '../src/core/realtime/damage.js';

// Field objects in real time (guide "Field objects"; build brief §3.10): the
// 0.38 gate, footbridge, barricade, brazier and the two opportunities, each
// used by working beside it while a ring fills, on battles reached legally.

const R=TIME.roundTicks;
// A battle's camp checkpoint from the 0.38 command campaign (edition 35), started in real time on a copy.
const camps=new Map();
function battle(id){
  if(!camps.has(id)){
    const stop=new Error('reached');
    try{runCommandCampaign({featureEdition:35,onCheckpoint(s){const data=G.getChapter(s).encounters[s.encounterIndex];
      if(data?.id===id&&!camps.has(id)){camps.set(id,G.serialize(s));throw stop;}}});}catch(error){if(error!==stop)throw error;}
  }
  const state=G.deserialize(camps.get(id));assert.equal(G.startEncounter(state,{controls:'realtime'}).ok,true);return {state,world:G.realtimeWorld(state)};
}
const object=(w,id)=>w.objects.find(o=>o.id===id);
// The soldier works at an object: walk there and finish (no enemy near enough to interrupt in these tests).
function work(w,id,{limit=1200}={}){
  const hero=w.actors.find(a=>a.id==='hero'),o=object(w,id);
  for(const a of w.actors)if(a.side==='enemy')a.hidden=true;// keep this a test of the object, not of the fight
  hero.x=o.x-1.5;hero.z=o.z;hero.px=hero.x;hero.pz=hero.z;
  assert.equal(queueCommand(w,{actorId:'hero',kind:'interact',payload:{objectId:id}}).ok,true);
  for(let i=0;i<limit&&!w.events.some(e=>e.kind==='used-object'&&e.objectId===id);i++)step(w);
}

test('a battle offers two opportunities and only one: securing one forgoes the other, and both close at the end of round 7',()=>{
  const {state,world}=battle('ch3-station');
  assert.deepEqual(world.objects.filter(o=>o.field).map(o=>`${o.kind}:${o.state}`),['stores:available','signal:available','barricade:intact','brazier:unlit']);
  assert.equal(world.field.deadline,7);assert.equal(world.field.opportunities.stores.effect,'intelligence','Chapter III’s own version');
  const intent=pointerIntent(world,{pick:{objectId:'signal'},button:'left'});assert.equal(intent.cursor,'use');assert.match(intent.message,/^Secure objective: Light the false beacon\. Reduce every visible enemy’s cohesion by 15\./);
  work(world,'signal');
  assert.equal(object(world,'signal').state,'secured');assert.equal(object(world,'stores').state,'forgone');assert.equal(world.field.choice,'signal');
  assert.equal(commandProblem(world,{actorId:'hero',kind:'interact',payload:{objectId:'stores'}}),'ALREADY_DONE');
  // Written back for 0.38's own record (commitExpanded) and still a valid chronicle.
  applyRealtimeOutcome(state,world);const e=state.encounter;
  assert.equal(e.field.choice,'signal');assert.equal(e.field.outcome,'secured');assert.equal(e.commandCampaign.opportunity,'signal');
  assert.deepEqual(e.field.objects.filter(o=>['stores','signal'].includes(o.kind)).map(o=>o.state),['forgone','secured']);
  assert.doesNotThrow(()=>G.deserialize(G.serialize(state)));
  // A second battle: nobody takes either, and they close at the end of round 7.
  const {world:w2}=battle('ch3-station');for(const a of w2.actors)if(a.side==='enemy')a.hidden=true;
  while(w2.tick<R*7-1)step(w2);assert.equal(w2.field.outcome,'pending','still open in round 7');
  step(w2);assert.equal(w2.field.outcome,'missed');assert.deepEqual(w2.objects.filter(o=>['stores','signal'].includes(o.kind)).map(o=>o.state),['missed','missed']);
  assert.equal(pointerIntent(w2,{pick:{objectId:'stores'},button:'left'}).cursor,'blocked');
});

test('a lit brazier blocks sight with its smoke and burns both sides within 3 m at each round’s end, for three rounds; a blow stops the work',()=>{
  const {world}=battle('ch3-station'),fire=object(world,'brazier');
  work(world,'brazier');assert.equal(fire.state,'burning');assert.equal(fire.rounds,world.weather==='rain'?1:3);
  assert.equal(smokeBetween(world,{x:fire.x-10,z:fire.z},{x:fire.x+10,z:fire.z}),true);assert.equal(smokeBetween(world,{x:fire.x-10,z:fire.z+5},{x:fire.x+10,z:fire.z+5}),false);
  const hero=world.actors.find(a=>a.id==='hero');hero.x=fire.x+1;hero.z=fire.z;hero.px=hero.x;hero.pz=hero.z;const before=hero.hp;
  const end=(Math.floor(world.tick/R)+1)*R;while(world.tick<end)step(world);
  assert.equal(hero.hp,before-2,'2 from the fire at the round’s end');assert.ok(world.log.some(l=>/burnt by the pitch fire: 2/.test(l.text)));
  while(fire.state==='burning'&&world.tick<end+R*4)step(world);assert.equal(fire.state,'spent');
  // A blow stops the work: the barricade is not dismantled while he is struck.
  const {world:w}=battle('ch3-station'),bar=object(w,'barricade'),h=w.actors.find(a=>a.id==='hero');
  h.x=bar.x-1.5;h.z=bar.z;h.px=h.x;h.pz=h.z;queueCommand(w,{actorId:'hero',kind:'interact',payload:{objectId:'barricade'}});
  for(let i=0;i<10&&h.action?.kind!=='work';i++)step(w);assert.equal(h.action?.kind,'work');
  exchangeWound(w,w.actors.find(a=>a.side==='enemy'),h,1);assert.equal(h.action,null,'the blow stops the work');
  for(let i=0;i<R/2;i++)step(w);assert.equal(bar.state,'intact','nothing was dismantled');
});

test('the barricade shields defenders within 2 m until dismantled, in the squad exchange as in single blows',()=>{
  const {world}=battle('ch5-mine'),bar=object(world,'barricade');
  const ours=world.squads.find(q=>q.side!=='enemy'),theirs=world.squads.find(q=>q.side==='enemy');
  for(const id of ours.members){const m=world.actors.find(a=>a.id===id);m.x=bar.x+.5;m.z=bar.z;}ours.x=bar.x+.5;ours.z=bar.z;
  assert.ok(squadModifiers(world,theirs,ours).modifiers.some(m=>m.label==='Timber cover'));
  work(world,'barricade');assert.equal(bar.state,'dismantled');assert.ok(!squadModifiers(world,theirs,ours).modifiers.some(m=>m.label==='Timber cover'));
});

test('on a wide map the shut side gate is a wall until opened, and the footbridge’s crossing becomes a ford when repaired; it all survives a save',()=>{
  const {state,world}=battle('ch8-ferry'),gate=object(world,'gate'),bridge=object(world,'bridge');
  assert.equal(gate.state,'closed');assert.equal(bridge.state,'damaged');
  const across=(o)=>findRoute(navGrid(world.map),{x:o.x-6,z:o.z},{x:o.x+6,z:o.z});
  assert.equal(across(gate).reasonCode,'PATH_BLOCKED','no way through the shut gate');assert.equal(across(bridge).reasonCode,'PATH_BLOCKED','nor across the broken bridge');
  work(world,'gate');assert.equal(gate.state,'open');assert.equal(across(gate).reasonCode,undefined,'the side route is open');
  const mid=snapshotWorld(world),hash=worldHash(world);assert.equal(worldHash(restoreWorld(mid)),hash,'a save keeps the opened gate');
  work(world,'bridge');assert.equal(bridge.state,'repaired');assert.equal(across(bridge).reasonCode,undefined,'the ford carries the crossing');
  for(const [x,y]of bridge.cells)assert.equal(world.map.terrain[y][x],'ford');
  applyRealtimeOutcome(state,world);const e=state.encounter;
  assert.deepEqual(e.field.objects.filter(o=>['gate','bridge'].includes(o.kind)).map(o=>o.state),['open','repaired']);
  assert.equal(e.terrain[bridge.tile.y][bridge.tile.x],'ford','0.38 records the ford');assert.doesNotThrow(()=>G.deserialize(G.serialize(state)));
});

test('an opportunity that pays on victory is staged once, however often the outcome is written',()=>{
  const {state,world}=battle('ch8-ferry');world.field.opportunities.stores.effect='stores';
  const before=state.encounter.staged.supplies??0;
  work(world,'stores');applyRealtimeOutcome(state,world);const once=state.encounter.staged.supplies??0;applyRealtimeOutcome(state,world);
  assert.equal(once,before+2,'two supplies on victory');assert.equal(state.encounter.staged.supplies??0,once,'not twice');
});

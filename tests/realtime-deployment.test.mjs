import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {queueCommand,step,worldHash} from '../src/core/realtime/simulation.js';
import {deploy,deploying,soundTheAdvance} from '../src/core/realtime/deployment.js';
import {membersOf} from '../src/core/realtime/squads.js';
import {selectSquads} from '../src/core/realtime/order-intents.js';

// Deployment (guide "Deployment"): from Chapter VII a battle opens with the
// clock stopped; the company is placed one thing at a time in the zone, and
// Sound the advance starts the battle. Camps reached by legal commands.

const camps=new Map();
function battle(id){
  if(!camps.has(id)){
    const stop=new Error('reached');
    try{runCommandCampaign({featureEdition:35,onCheckpoint(s){if(G.getChapter(s).encounters[s.encounterIndex]?.id===id&&!camps.has(id)){camps.set(id,G.serialize(s));throw stop;}}});}
    catch(error){if(error!==stop)throw error;}
  }
  const state=G.deserialize(camps.get(id));assert.equal(G.startEncounter(state,{controls:'realtime'}).ok,true);return {state,world:G.realtimeWorld(state)};
}

test('a Chapter VII battle opens in deployment: the clock stands still, no order is given, and placing is checked against the zone',()=>{
  const {world:w}=battle('ch7-legion'),zone=w.deployment.zone;
  assert.equal(deploying(w),true);assert.ok(zone.x1>0&&zone.x1<w.map.width*2.5,'the zone is the field’s western part');
  step(w);step(w);assert.equal(w.tick,0,'nothing moves until the advance');
  const ours=w.squads.find(q=>q.side!=='enemy'),before=worldHash(w),command=w.command.left;
  assert.equal(queueCommand(w,{actorId:'hero',kind:'order',payload:{squads:[ours.id],order:{kind:'hold'}}}).reason,'DEPLOYING');
  assert.equal(deploy(w,{id:ours.id,x:zone.x1+10,z:(zone.z0+zone.z1)/2}).reason,'NOT_IN_DEPLOYMENT_ZONE');
  assert.equal(deploy(w,{id:w.squads.find(q=>q.side==='enemy').id,x:zone.x1/2,z:(zone.z0+zone.z1)/2}).reason,'NO_TARGET','the enemy is not ours to place');
  assert.equal(worldHash(w),before,'refusals change nothing');
  // A squad: its front where chosen, its men in formation around it.
  const spot={x:Math.floor(zone.x1/2)+.25,z:Math.floor((zone.z0+zone.z1)/2)+.25};
  assert.equal(deploy(w,{id:ours.id,...spot}).ok,true);
  assert.ok(Math.abs(ours.x-spot.x)<1e-9&&Math.abs(ours.z-spot.z)<1e-9);
  for(const m of membersOf(w,ours))assert.ok(Math.hypot(m.x-spot.x,m.z-spot.z)<6,'his men stand around the standard');
  const hero=w.actors.find(a=>a.id==='hero');assert.equal(deploy(w,{id:'hero',x:spot.x-4,z:spot.z+3}).ok,true);assert.ok(Math.abs(hero.x-(spot.x-4))<1);
  assert.ok(w.used.includes('deploy'),'Deploy is demonstrated');assert.equal(w.command.left,command,'no Command spent');
  // In deployment one thing is chosen at a time.
  assert.deepEqual(selectSquads(w,[ours.id],{squadId:w.squads.filter(q=>q.side!=='enemy')[1].id,shift:true},{deployment:true}),[w.squads.filter(q=>q.side!=='enemy')[1].id]);
  // Sound the advance: the battle begins, and placing is over.
  assert.equal(soundTheAdvance(w).ok,true);step(w);assert.equal(w.tick,1);assert.equal(deploy(w,{id:'hero',...spot}).reason,'NOT_DEPLOYING');
  assert.equal(queueCommand(w,{actorId:'hero',kind:'order',payload:{squads:[ours.id],order:{kind:'hold'}}}).ok,true);
});

test('a deployment survives a save, and battles before Chapter VII start at once',()=>{
  const {state,world}=battle('ch7-legion');const zone=world.deployment.zone,ours=world.squads.find(q=>q.side!=='enemy');
  assert.equal(deploy(world,{id:ours.id,x:zone.x1/2,z:(zone.z0+zone.z1)/2}).ok,true);
  assert.equal(G.saveRealtime(state,world).ok,true);const again=G.realtimeWorld(G.deserialize(G.serialize(state)));
  assert.equal(worldHash(again),worldHash(world));assert.equal(deploying(again),true);
  const {world:early}=battle('ch6-eagle');assert.equal(early.deployment,undefined);step(early);assert.equal(early.tick,1);
});

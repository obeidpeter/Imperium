import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {commandDecision,heroDecision,playRealtime} from '../scripts/realtime-autoplay.mjs';
import {queueCommand,step,worldHash} from '../src/core/realtime/simulation.js';
import {actorById,hostile} from '../src/core/realtime/abilities.js';
import {objectiveMet} from '../src/core/realtime/mission.js';
import {squadCentre} from '../src/core/realtime/squads.js';
import {deploy,deploying,soundTheAdvance} from '../src/core/realtime/deployment.js';
import {ABILITIES,TIME} from '../src/data/realtime-rules.js';
import {RALLY} from '../src/data/realtime-squads.js';

// Phase 4 (build brief): Chapter X's road and the finale's confrontation in real
// time. Each is reached from New Game by the 0.38 command campaign's legal
// commands and played by the heuristic bot through legal Commands. The finale's
// standoffs follow 0.38's configureFinale (mission.js). Where a test places a
// person or lowers a band's morale to reach a rule quickly, it says so: those
// are injected scenarios, not play.

const R=TIME.roundTicks,camps=new Map();
function camp(id){
  if(!camps.has(id)){
    const stop=new Error('reached');
    try{runCommandCampaign({featureEdition:35,onCheckpoint(s){if(G.getChapter(s).encounters[s.encounterIndex]?.id===id&&!camps.has(id)){camps.set(id,G.serialize(s));throw stop;}}});}
    catch(error){if(error!==stop)throw error;}
  }
  return G.deserialize(camps.get(id));
}
// The meters each standoff route needs (game.js finaleForecast). A route this chronicle has not opened is opened by raising them: injected.
const ROUTE_METERS={defection:{army:55},settlement:{political:50},surrender:{public:60,political:40}};
function finale(route){
  const state=camp('ch12-confrontation'),open=G.finaleForecast(state).routes.some(r=>r.id===route);
  if(!open)for(const [k,v]of Object.entries(ROUTE_METERS[route]??{}))state.meters[k]=Math.max(state.meters[k],v);
  assert.equal(G.chooseRoute(state,route).ok,true,route);assert.equal(G.startEncounter(state,{controls:'realtime'}).ok,true,route);assert.equal(G.isRealtime(state),true);
  return {state,open};
}
// As playRealtime opens a battle from Chapter VII: the soldier deployed where he stands, the advance sounded.
function advance(world){if(deploying(world)){const hero=world.actors.find(a=>a.id===world.heroId);deploy(world,{id:hero.id,x:hero.x,z:hero.z});soundTheAdvance(world);}return world;}
const place=(actor,p)=>Object.assign(actor,{x:p.x,z:p.z,px:p.x,pz:p.z,path:[],goal:null,order:null});
const rally=world=>queueCommand(world,{actorId:world.heroId,kind:'ability',payload:{abilityId:'rally'}});
function until(world,done,limit=400){const seen=[];for(let i=0;i<limit&&!done(world,seen);i++)seen.push(...step(world));return seen;}

test('Chapter X’s road plays in real time: both grain routes secured with the stores intact, and recorded',()=>{
  const state=camp('ch10-road');assert.equal(G.startEncounter(state,{controls:'realtime'}).ok,true);
  const world=G.realtimeWorld(state);assert.equal(world.mission.mode,'supply');assert.equal(world.mission.points.length,2);
  const r=playRealtime(state);assert.equal(r.status,'won',r.reason??'');
  assert.ok(r.world.mission.points.every(p=>p.secured),'both routes secured');assert.ok(r.world.mission.defence>0,'stores intact');
  assert.equal(state.encounter.status,'won');assert.equal(G.commitEncounter(state).ok,true);
});

test('every finale route plays in real time and is recorded as 0.38 records it',()=>{
  const played=[];
  for(const route of ['backer','battle','defection','settlement','surrender']){
    const {state,open}=finale(route),world=G.realtimeWorld(state);
    assert.equal(world.mission.mode,{backer:'clear',battle:'clear'}[route]??route,route);
    // The rival bands keep their 0.38 names.
    assert.deepEqual(world.squads.filter(q=>q.side==='enemy').map(q=>q.name),state.encounter.units.filter(u=>u.side==='enemy').map(u=>u.name),route);
    const struck=[],r=playRealtime(state,{onTick:w=>{for(const e of w.events)if(['hit','block','miss'].includes(e.kind))struck.push(e.defenderId);}});
    assert.equal(r.status,'won',`${route}: ${r.reason??''}`);const e=state.encounter,m=r.world.mission;
    if(route==='defection'){
      assert.equal(e.defections,m.defections);assert.ok(m.defections>=Math.min(3,m.rivals)||!r.world.actors.some(a=>a.side==='enemy'&&a.alive));
      assert.ok(e.units.filter(u=>u.defected).every(u=>u.hp===0&&m.departed.includes(u.id)),'a band that left the field is gone, not fallen');
    }
    if(route==='settlement'){
      assert.equal(e.mission.envoyProgress,2);assert.equal(struck.filter(id=>id==='envoy').length,0,'no one strikes the envoy');
      assert.ok(actorById(r.world,'envoy').alive);
    }
    if(route==='surrender'){assert.ok(m.points.every(p=>p.secured));assert.ok(Math.hypot(actorById(r.world,'hero').x-m.goal.x,actorById(r.world,'hero').z-m.goal.z)<=m.radius);}
    assert.equal(G.commitEncounter(state).ok,true,route);played.push(`${route}${open?'':' (meters injected)'}`);
  }
  assert.equal(played.length,5);
});

test('the oath (defection; placements and morale injected): a Rally within three tiles costs the lowest-morale band in reach 40 morale, and at 25 it pledges itself',()=>{
  const {state}=finale('defection'),world=advance(G.realtimeWorld(state)),m=world.mission,hero=actorById(world,world.heroId);
  const [, target,...others]=world.squads.filter(q=>q.side==='enemy');target.morale=60;for(const q of others)q.morale=70;
  const c=squadCentre(world,target);place(hero,{x:c.x-4,z:c.z});
  assert.equal(rally(world).ok,true);const seen=until(world,(w,s)=>s.some(e=>e.kind==='pledge'),40);
  const heard=seen.find(e=>e.kind==='oath-heard');assert.equal(heard?.squadId,target.id,'the lowest-morale band in reach hears it');assert.equal(heard.morale,20);
  // The soldier and his seven squads are eight units: the band leaves the field, as 0.38's does.
  const pledged=seen.find(e=>e.kind==='pledge');assert.equal(pledged.joined,false);assert.equal(m.defections,1);
  assert.ok(!world.squads.includes(target)&&target.members.every(id=>!actorById(world,id)),'gone from the field');assert.deepEqual(m.departed,[target.unitId]);
  // The oath is sworn once a round, not after Rally's usual recovery.
  assert.equal(hero.cooldowns.rally-heard.tick,RALLY.oathRecovery_s*TIME.ticksPerSecond);assert.ok(RALLY.oathRecovery_s<ABILITIES.rally.recovery_s);
  assert.equal(objectiveMet(world),false,'one pledge of three');m.defections=3;assert.equal(objectiveMet(world),true,'three pledges win');
});

test('a pledged band joins a side of fewer than eight units (one squad struck off, injected), and is no longer anyone’s enemy',()=>{
  const {state}=finale('defection'),world=advance(G.realtimeWorld(state)),hero=actorById(world,world.heroId);
  world.squads.find(q=>q.side==='ally').strength=0;
  const target=world.squads.find(q=>q.side==='enemy');target.morale=50;for(const q of world.squads.filter(q=>q.side==='enemy'&&q!==target))q.morale=90;
  const c=squadCentre(world,target);place(hero,{x:c.x-4,z:c.z});
  assert.equal(rally(world).ok,true);const seen=until(world,(w,s)=>s.some(e=>e.kind==='pledge'),40);
  assert.equal(seen.find(e=>e.kind==='pledge')?.joined,true);
  assert.equal(target.side,'ally');assert.equal(target.name,'Pledged cohort');assert.equal(target.morale,65);
  for(const id of target.members){const a=actorById(world,id);if(a)assert.equal(hostile(a,hero),false,id);}
  // The rules write the 0.38 record: the pledged band is the soldier's.
  for(let i=0;i<200&&world.status==='active';i++){if(world.tick%10===0){commandDecision(world);heroDecision(world);}step(world);}
  assert.equal(G.saveRealtime(state,world).ok,true,'the fight with a pledged band is a valid save');
});

test('the settlement (placements injected): no one strikes the envoy, and a round counts only with the envoy beside the claimant, the soldier near and the parley reassured',()=>{
  const {state}=finale('settlement'),world=advance(G.realtimeWorld(state)),m=world.mission,hero=actorById(world,world.heroId),envoy=actorById(world,'envoy');
  assert.equal(envoy.parley,true);
  for(const a of world.actors.filter(a=>a.side==='enemy')){assert.equal(hostile(a,envoy),false);assert.equal(hostile(envoy,a),false);assert.equal(hostile(a,hero),true);}
  const start={x:hero.x,z:hero.z},envoyStart={x:envoy.x,z:envoy.z};
  const atTheMeeting=()=>{place(envoy,m.goal);place(hero,{x:m.goal.x-m.radius*1.5,z:m.goal.z});};
  const roundEnd=()=>{until(world,w=>(w.tick+1)%R===0,R);atTheMeeting();step(world);place(hero,start);place(envoy,envoyStart);};
  roundEnd();assert.equal(m.meeting,0,'no Rally yet: the parley is not reassured');
  assert.equal(rally(world).ok,true);until(world,w=>w.used.includes('rally'),40);
  until(world,w=>(w.tick+1)%R===0,R);place(envoy,m.goal);place(hero,{x:m.goal.x+m.radius*3,z:m.goal.z});step(world);
  assert.equal(m.meeting,0,'the soldier more than two tiles away');place(hero,start);place(envoy,envoyStart);
  roundEnd();assert.equal(m.meeting,1);roundEnd();assert.equal(m.meeting,2);assert.equal(world.status,'won','two rounds of the meeting win');
});

test('the surrender: both gate approaches secured is not enough until the soldier stands at the claimant’s standard (placement injected)',()=>{
  const {state}=finale('surrender'),world=advance(G.realtimeWorld(state)),m=world.mission,hero=actorById(world,world.heroId);
  for(const p of m.points)p.secured=true;assert.equal(objectiveMet(world),false);
  place(hero,m.goal);assert.equal(objectiveMet(world),true);
});

test('A1 and A2 in the defection standoff: the same camp and commands give the same world, and a mid-fight save plays on to the same end',()=>{
  const end=worldHash(playRealtime(finale('defection').state).world);
  assert.equal(worldHash(playRealtime(finale('defection').state).world),end,'identical fights');
  for(const cut of [311,1207]){
    const {state}=finale('defection'),w=advance(G.realtimeWorld(state));
    for(let i=0;i<cut&&w.status==='active';i++){if(w.tick%10===0){commandDecision(w);heroDecision(w);}step(w);}
    assert.ok(G.saveRealtime(state,w).ok);const text=G.serialize(state);assert.ok(text.length<G.SAVE_LIMIT/2,`${text.length} characters`);const reloaded=G.deserialize(text);
    assert.equal(worldHash(G.realtimeWorld(reloaded)),worldHash(w),`the save at tick ${cut} is the world`);
    assert.equal(worldHash(playRealtime(reloaded).world),end,`saved at tick ${cut}`);
  }
});

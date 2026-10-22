import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {runRealtimeCampaign,playRealtime,heroDecision} from '../scripts/realtime-autoplay.mjs';
import {calibrate,upsampleTerrain,layoutFor,createEncounterWorld} from '../src/core/realtime/campaign-encounter.js';
import {step,worldHash,queueCommand} from '../src/core/realtime/simulation.js';
import {actorById} from '../src/core/realtime/abilities.js';
import {createBattle} from '../src/core/battle.js';
import {CHAPTERS} from '../src/data/campaign.js';

const READY=[1,2,3];
// A chronicle at the start of a given encounter, reached by legal commands from New Game.
function reach(id,{seed=275}={}){
  let found=null;
  const state=G.newGame('Aurelius Marcellus',seed,{featureEdition:35,progression:true});
  for(let guard=0;guard<80&&!found;guard++){
    const chapter=G.getChapter(state),data=chapter.encounters[state.encounterIndex];
    if(state.phase==='camp'){
      if(!state.decisions[chapter.decision.id])G.choose(state,chapter.decision.options[0].id);
      if(state.chapter===1&&state.encounterIndex>0&&!state.oath)G.swearOath(state);
      assert.ok(G.startEncounter(state,{controls:'realtime'}).ok);if(data.id===id)found=state;
    }else if(state.phase==='encounter'){assert.equal(playRealtime(state).status,'won');assert.ok(G.commitEncounter(state).ok);}
    else assert.ok(G.advanceChapter(state).ok);
  }
  return found;
}

test('Chapters I–III play in real time from New Game by legal commands: every battle won, recorded once, rewards granted',()=>{
  const seen=[];
  const {state,encounters}=runRealtimeCampaign({throughChapter:3,ready:READY,onEncounter:s=>{assert.doesNotThrow(()=>G.serialize(s));seen.push(s.encounter.id);}});
  assert.deepEqual(encounters.map(e=>e.id),['ch1-training','ch1-road','ch2-marsh','ch2-rearguard','ch3-station','ch3-rolls']);
  assert.ok(encounters.every(e=>e.status==='won'));assert.equal(state.chapter,4);assert.deepEqual(state.completed,[1,2,3]);
  assert.ok(state.soldier.tp>=20,`${state.soldier.tp} TP earned`);assert.ok(state.soldier.rewarded.encounters.length===6);
  assert.ok(state.chapterCapabilities[2].includes('assist'),'Chapter II demonstrated Assist (Bind wounds or Carry)');
  assert.ok(state.chapterCapabilities[3].includes('scout'),'Chapter III demonstrated Scout');
  assert.deepEqual(state.soldier.decorations,['corona_civica','armillae'],'the marsh rescue and the records earned their decorations');
  assert.doesNotThrow(()=>G.serialize(state));
});

test('A1 in the campaign: the same chronicle and commands give the same world, and a retry restores the start exactly',()=>{
  const a=reach('ch1-road'),b=reach('ch1-road');
  assert.equal(worldHash(G.realtimeWorld(a)),worldHash(G.realtimeWorld(b)),'identical starts');
  const ra=playRealtime(a),rb=playRealtime(b);assert.equal(worldHash(ra.world),worldHash(rb.world),'identical fights');
  const fresh=reach('ch1-road'),start=worldHash(G.realtimeWorld(fresh));
  const w=G.realtimeWorld(fresh);for(let i=0;i<300;i++){heroDecision(w);step(w);}assert.ok(G.saveRealtime(fresh,w).ok);
  assert.notEqual(worldHash(G.realtimeWorld(fresh)),start);
  assert.ok(G.retry(fresh).ok);assert.equal(worldHash(G.realtimeWorld(fresh)),start,'Retry checkpoint restores the encounter exactly as it began');
});

test('A2 in the campaign: a fight saved into the chronicle, reloaded from its save and continued, ends exactly as the uninterrupted one',()=>{
  const straight=reach('ch2-marsh'),saved=reach('ch2-marsh');
  const end=playRealtime(straight).world;
  for(const cut of [137,611]){
    const s=JSON.parse(G.serialize(saved)),state=G.deserialize(JSON.stringify(s));
    const w=G.realtimeWorld(state);for(let i=0;i<cut;i++){if(w.tick%10===0)heroDecision(w);step(w);}
    assert.ok(G.saveRealtime(state,w).ok);const reloaded=G.deserialize(G.serialize(state));
    const result=playRealtime(reloaded,{});assert.equal(worldHash(result.world),worldHash(end),`saved at tick ${cut}`);
  }
});

test('the wounded man of the marsh waits until his wounds are bound or he is carried; Bind wounds needs a bandage and is spent only when done',()=>{
  const s=reach('ch2-marsh'),w=G.realtimeWorld(s),lucan=w.actors.find(a=>a.escort?.wounded);
  assert.ok(lucan,'the wounded survivor is in the field');assert.equal(lucan.escort.escorted,false);
  for(let i=0;i<200;i++)step(w);assert.ok(Math.abs(lucan.x-lucan.px)<1e-9,'he cannot walk yet');
  const hero=actorById(w,'hero'),bandages=hero.bandages;
  assert.ok(queueCommand(w,{actorId:'hero',kind:'ability',payload:{abilityId:'bind_wounds',targetId:lucan.id}}).ok);
  let healed=false;for(let i=0;i<1200&&!healed;i++){step(w);healed=w.events.some(e=>e.kind==='heal');}
  assert.ok(healed,'the soldier walked to him and bound his wounds');assert.equal(hero.bandages,bandages-1);assert.equal(lucan.escort.escorted,true);
  assert.ok(w.used.includes('assist'));
});

test('a hidden enemy stays out of sight until scouted or spotted, and Scout reveals everything within 30 m',()=>{
  const s=reach('ch3-station'),w=G.realtimeWorld(s),hidden=w.actors.find(a=>a.hidden);
  assert.ok(hidden,'the station hides an enemy');const hero=actorById(w,'hero');
  assert.equal(queueCommand(w,{actorId:'hero',kind:'attack',payload:{targetId:hidden.id}}).reason,'NO_TARGET','unseen, he cannot be targeted');
  hero.x=hidden.x-20;hero.z=hidden.z;hero.px=hero.x;hero.pz=hero.z;
  assert.ok(queueCommand(w,{actorId:'hero',kind:'ability',payload:{abilityId:'scout'}}).ok);step(w);step(w);
  assert.equal(hidden.hidden,false);assert.ok(w.log.some(l=>/revealed by scouting/.test(l.text)));assert.equal(hero.stamina,hero.maxStamina-20);
});

test('§3.2 travel time: every battle of Chapters I–X keeps its defining route within ±10% of its 0.38 turns',()=>{
  for(const ch of CHAPTERS.slice(0,10))for(const [index,data]of ch.encounters.entries()){
    if(data.kind!=='battle'||data.type==='training')continue;
    const s=G.newGame('T',275,{featureEdition:35,progression:true});s.chapter=ch.id;s.encounterIndex=index;
    const c=calibrate(createBattle(s,data,{}));assert.ok(Math.abs(c.error)<=.1,`${data.id}: ${(c.error*100).toFixed(1)}%`);
  }
});

test('maps upsample to 2.5 m tiles: roads, walls and rivers stay lines; fords keep the crossing; areas fill',()=>{
  const coarse=[['grass','road','grass'],['wall','ford','river'],['grass','road','rock']];
  const fine=upsampleTerrain(coarse,layoutFor(3,3,3),'grass');assert.equal(fine.width,9);assert.equal(fine.height,9);
  assert.deepEqual(fine.terrain.map(r=>r.join(' ')).slice(0,3),['grass grass grass grass road grass grass grass grass','grass grass grass grass road grass grass grass grass',
    'grass grass grass grass road grass grass grass grass']);
  assert.equal(fine.terrain[7][7],'rock');assert.equal(fine.terrain[4][4],'ford');assert.equal(fine.terrain[4][7],'river');
  const uneven=layoutFor(8,8,3.375);assert.equal(uneven.kx.reduce((a,b)=>a+b,0),27);assert.ok(uneven.kx.every(n=>n===3||n===4));
});

test('a tampered real-time world is refused when a chronicle loads; turn commands do not reach a real-time encounter',()=>{
  const s=reach('ch1-road');const save=JSON.parse(G.serialize(s));
  save.encounter.realtime.world.actors[0].hp=999;assert.throws(()=>G.deserialize(JSON.stringify(save)),/real-time actor/);
  const again=JSON.parse(G.serialize(s));again.encounter.realtime.world.map.terrain[0][0]='lava';assert.throws(()=>G.deserialize(JSON.stringify(again)),/real-time map/);
  assert.equal(G.endTurn(s).ok,false);assert.deepEqual(G.getActions(s,'hero'),[]);
  const w=G.realtimeWorld(s);w.encounterId='ch2-marsh';assert.equal(G.saveRealtime(s,w).ok,false);
});

test('a lost fight resolves as lost, leaves no reward and retries from the checkpoint',()=>{
  const s=reach('ch1-road'),w=G.realtimeWorld(s),hero=actorById(w,'hero');
  hero.hp=1;for(const e of w.actors.filter(a=>a.side==='enemy')){e.ai.state='engage';e.ai.notice.hero=100;}
  for(let i=0;i<4000&&w.status==='active';i++)step(w);assert.equal(w.status,'lost');
  const tp=s.soldier.tp;assert.ok(G.resolveRealtime(s,w).ok);assert.equal(s.encounter.status,'lost');assert.equal(G.commitEncounter(s).ok,false);
  assert.equal(s.soldier.tp,tp);assert.ok(G.retry(s).ok);assert.equal(s.encounter.status,'active');assert.equal(G.realtimeWorld(s).status,'active');
});

test('the real-time world of each Chapter I–III battle holds its 0.38 people: the soldier, the drill partner, Lucan, the columns and the enemy',()=>{
  const s=reach('ch1-training'),w=G.realtimeWorld(s);
  assert.ok(w.actors.some(a=>a.practice));assert.equal(w.practice,true);assert.equal(actorById(w,'hero').name,'Aurelius Marcellus');
  const road=reach('ch1-road'),r=G.realtimeWorld(road);assert.ok(r.actors.some(a=>a.id==='lucan'&&a.side==='ally'),'Lucan fights beside the recruit');
  assert.ok(r.actors.filter(a=>a.side==='enemy').length>=2);assert.ok(r.mission.waves.length>=1);
  const station=reach('ch3-station'),st=G.realtimeWorld(station);assert.equal(st.party.length,3,'three companions march from Chapter III');
  assert.ok(st.objects.some(o=>o.kind==='chest'));
});

test('loot: a fallen enemy is searched with the weapon sheathed; what is taken is staged with the fight and reaches the pack only when recorded',()=>{
  const s=reach('ch1-road'),w=G.realtimeWorld(s),hero=actorById(w,'hero');
  // Fight with the harness until a man who carried something falls (legal commands only).
  let body=null;for(let i=0;i<4000&&!body&&w.status==='active';i++){if(w.tick%10===0)heroDecision(w);step(w);body=w.actors.find(a=>a.side==='enemy'&&!a.alive&&a.loot?.length);}
  assert.ok(body,'someone fell with loot');assert.equal(w.status,'active');
  // Injected copy for the range rule: the same world with the soldier ten metres off.
  const far=JSON.parse(JSON.stringify(w)),farHero=actorById(far,'hero');farHero.x=body.x+10;farHero.z=body.z;farHero.px=farHero.x;farHero.pz=farHero.z;
  assert.equal(queueCommand(far,{actorId:'hero',kind:'take',payload:{targetId:body.id,items:[body.loot[0]]}}).reason,'OUT_OF_RANGE','only from beside the body');
  assert.equal(queueCommand(w,{actorId:'hero',kind:'take',payload:{targetId:body.id,items:['galea_crest']}}).reason,'NO_TARGET','only what he carried');
  if(hero.drawn){assert.equal(queueCommand(w,{actorId:'hero',kind:'loot',payload:{targetId:body.id}}).reason,'NEEDS_SHEATHED');queueCommand(w,{actorId:'hero',kind:'setDrawn',payload:{drawn:false}});step(w);}
  assert.ok(queueCommand(w,{actorId:'hero',kind:'loot',payload:{targetId:body.id}}).ok);
  let arrived=false;for(let i=0;i<600&&!arrived;i++){step(w);arrived=w.events.some(e=>e.kind==='loot');}
  assert.ok(arrived,'the soldier walked to the body and the loot window opens');
  const items=[...body.loot];assert.ok(queueCommand(w,{actorId:'hero',kind:'take',payload:{targetId:body.id,items}}).ok);step(w);
  assert.deepEqual(w.spoils.map(x=>x.itemId),items);assert.equal(body.loot.length,0);assert.ok(w.log.some(l=>/ takes /.test(l.text)));
  // Staged with the fight: saved into the chronicle, not yet in the pack.
  const packBefore=s.soldier.pack.length;assert.ok(G.saveRealtime(s,w).ok);assert.equal(s.soldier.pack.length,packBefore);
  assert.doesNotThrow(()=>G.deserialize(G.serialize(s)));
  // A retry forgets them.
  const retried=G.deserialize(G.serialize(s));assert.ok(G.retry(retried).ok);assert.equal(G.realtimeWorld(retried).spoils.length,0);
});

test('after a won fight the fallen can be searched from the result; the spoils are granted once, at the commit',()=>{
  const s=reach('ch1-road'),result=playRealtime(s);assert.equal(result.status,'won');
  const world=s.encounter.realtime.world,body=world.actors.find(a=>a.side==='enemy'&&!a.alive&&a.loot?.length);assert.ok(body,'a fallen enemy carried something');
  const before=JSON.stringify(s);
  assert.equal(G.takeSpoils(s,{bodyId:body.id,items:['galea_crest']}).ok,false);assert.equal(JSON.stringify(s),before,'an illegal take changes nothing');
  assert.equal(G.takeSpoils(s,{bodyId:'hero',items:['tunic']}).ok,false);
  const items=[...body.loot];assert.ok(G.takeSpoils(s,{bodyId:body.id,items}).ok);assert.deepEqual(s.encounter.staged.spoils.slice(-items.length),items);
  assert.equal(G.takeSpoils(s,{bodyId:body.id,items}).ok,false,'nothing left on him');
  const tampered=JSON.parse(G.serialize(s));tampered.encounter.staged.spoils.push('no_such_item');assert.throws(()=>G.deserialize(JSON.stringify(tampered)),/staged rewards/);
  const count=id=>[...s.soldier.pack,...Object.values(s.soldier.ground).flat()].filter(e=>e.id===id).length,had=items.map(count);
  assert.ok(G.commitEncounter(s).ok);items.forEach((id,i)=>assert.ok(count(id)>had[i],`${id} reached the pack or the camp ground`));
  assert.equal(G.commitEncounter(s).ok,false,'recorded once');
});

test('C18: Shift+click on a neutral makes him hostile at once; the journal records it and Public Confidence pays only when the result is recorded',()=>{
  // The Chapter III records' column is neutral, and three companions march with the soldier.
  const s=reach('ch3-rolls'),w=G.realtimeWorld(s),neutral=w.actors.find(a=>a.side==='neutral'&&a.alive);
  assert.ok(neutral,'a neutral column is on the field');
  assert.equal(queueCommand(w,{actorId:'hero',kind:'attack',payload:{targetId:neutral.id}}).reason,'NOT_HOSTILE','an unforced click never attacks him');
  const friend=w.actors.find(a=>a.side==='ally'||w.party.includes(a.id));
  if(friend)assert.equal(queueCommand(w,{actorId:'hero',kind:'attack',payload:{targetId:friend.id,forced:true}}).reason,'FRIENDLY','your own side is never struck');
  assert.ok(queueCommand(w,{actorId:'hero',kind:'attack',payload:{targetId:neutral.id,forced:true}}).ok);step(w);
  assert.equal(neutral.side,'enemy','he turns hostile');assert.equal(w.provoked.length,1);assert.ok(w.log.some(l=>/who was no enemy/.test(l.text)));
  // Staged with the outcome, applied at commit.
  const publicBefore=s.meters.public;w.status='won';G.resolveRealtime(s,w);
  assert.equal(s.meters.public,publicBefore,'nothing changes before the commit');assert.ok(s.encounter.staged.meters.public<0);
  assert.ok(s.encounter.staged.journal[0].includes(neutral.name));
});

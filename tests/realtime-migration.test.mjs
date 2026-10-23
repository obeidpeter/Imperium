import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {tpAuditTotal} from '../src/core/tp-audit.js';
import {worldHash} from '../src/core/realtime/simulation.js';

// Migration from 0.38 (build brief §3.17, test G35): a chronicle begun before 0.40
// loads exactly as saved; choosing its soldier's training grants the training
// points the campaign could have given through its completed chapters; and a
// battle in progress on the 0.38 board restarts from its checkpoint in real time.

const camps=new Map();
function camp(id){
  if(!camps.has(id)){
    const stop=new Error('reached');
    try{runCommandCampaign({featureEdition:35,onCheckpoint(s){if(G.getChapter(s).encounters[s.encounterIndex]?.id===id&&!camps.has(id)){camps.set(id,G.serialize(s));throw stop;}}});}
    catch(error){if(error!==stop)throw error;}
  }
  return G.deserialize(camps.get(id));
}
// The same camp as a chronicle from before 0.40 saved it: no soldier record.
function legacy(id){const s=JSON.parse(camps.get(id)??G.serialize(camp(id)));delete s.soldier;return JSON.stringify(s);}

test('a legacy camp can mount before adoption without adding a soldier or granting a course',()=>{
  const text=legacy('ch5-mine'),state=G.deserialize(text),world=G.createCampWorld(state);
  assert.equal(world.kind,'camp');assert.equal(world.chapter,5);
  const hero=world.actors.find(actor=>actor.id==='hero');
  assert.equal(hero.role,'soldier');
  assert.ok(hero.abilities.includes('strike'),'ordinary chapter abilities remain usable');
  assert.ok(!hero.abilities.includes('shield_bash'),'an unchosen soldier has not taken a course');
  assert.equal(state.soldier,undefined,'mounting must not adopt a soldier for the player');
  assert.equal(G.serialize(state),text,'reading the camp preserves the exact legacy save');
  assert.equal(worldHash(G.createCampWorld(state)),worldHash(world),'the read-only fallback is deterministic');
});

test('a 0.38 chronicle loads exactly as saved, and choosing its soldier grants the training points of its completed chapters, once',()=>{
  const text=legacy('ch5-mine'),state=G.deserialize(text);
  assert.equal(G.serialize(state),text,'loading changes nothing');assert.equal(state.soldier,undefined);
  const done=Math.max(...state.completed);assert.equal(done,4);
  const r=G.soldierCommand(state,{kind:'adopt',path:'explorator'});assert.equal(r.ok,true,r.message);
  assert.equal(state.soldier.path,'explorator');assert.equal(state.soldier.tp,tpAuditTotal(4,'explorator'));assert.equal(state.soldier.tpEarned,state.soldier.tp);
  assert.ok(state.soldier.tp>0);assert.match(r.message,new RegExp(`${state.soldier.tp} training points`));
  const before=G.serialize(state);assert.equal(G.soldierCommand(state,{kind:'adopt',path:'legionary'}).ok,false);assert.equal(G.serialize(state),before,'the choice is made once');
  // A chronicle that already has its soldier gains nothing by asking again.
  const current=camp('ch5-mine'),tp=current.soldier.tp;assert.equal(G.soldierCommand(current,{kind:'adopt',path:'legionary'}).ok,false);assert.equal(current.soldier.tp,tp);
});

test('a battle in progress on the 0.38 board restarts from its checkpoint in real time; refused, the state is unchanged',()=>{
  const state=camp('ch5-mine');assert.equal(G.startEncounter(state,{}).ok,true);assert.equal(G.isRealtime(state),false,'begun on the 0.38 board');
  assert.ok(G.getActions(state,'hero').length,'its turn-based actions are offered');
  const fresh=camp('ch5-mine');assert.equal(G.startEncounter(fresh,{controls:'realtime'}).ok,true);
  const r=G.restartInRealtime(state);assert.equal(r.ok,true,r.message);assert.equal(G.isRealtime(state),true);
  assert.equal(worldHash(G.realtimeWorld(state)),worldHash(G.realtimeWorld(fresh)),'the same real-time start as a battle begun in real time');
  for(const refuse of [camp('ch5-mine'),state]){const before=G.serialize(refuse);assert.equal(G.restartInRealtime(refuse).ok,false);assert.equal(G.serialize(refuse),before);}
  const contest=camp('ch7-council');assert.equal(G.startEncounter(contest,{}).ok,true);const before=G.serialize(contest);
  assert.equal(G.restartInRealtime(contest).ok,false,'a Contest is walked in the chamber as it stands');assert.equal(G.serialize(contest),before);
});

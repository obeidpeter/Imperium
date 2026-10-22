import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {queueCommand,routePreview,step} from '../src/core/realtime/simulation.js';
import {applyRealtimeOutcome} from '../src/core/realtime/campaign-encounter.js';
import {blowSetup} from '../src/core/realtime/combat.js';
import {navGrid} from '../src/core/realtime/navigation.js';
import {planDoctrine} from '../src/core/realtime/squad-ai.js';
import {TIME} from '../src/data/realtime-rules.js';

// The camp's preparations in real time (build brief §3.10; guide "Preparing for
// battle"): the field approaches, the operational plans and Chapter VII's
// preparations, rain on the slopes, and the chapter capabilities that orders
// demonstrate, on camps reached by the 0.38 command campaign's legal commands.

const R=TIME.roundTicks,camps=new Map();
function camp(id){
  if(!camps.has(id)){
    const stop=new Error('reached');
    try{runCommandCampaign({featureEdition:35,onCheckpoint(s){if(G.getChapter(s).encounters[s.encounterIndex]?.id===id&&!camps.has(id)){camps.set(id,G.serialize(s));throw stop;}}});}
    catch(error){if(error!==stop)throw error;}
  }
  return G.deserialize(camps.get(id));
}
function start(state){assert.equal(G.startEncounter(state,{controls:'realtime'}).ok,true);return G.realtimeWorld(state);}
const far=(w,h)=>({x:Math.min(w.map.width*2.5-3,h.x+20),z:h.z});

test('Engineering: the works give the company’s squads’ men 10 Defence (never the soldier), he walks in rounds one and two, and the enemy archers go for him',()=>{
  const state=camp('ch5-mine');assert.equal(G.chooseOperationalPlan(state,'balanced').ok,true);assert.equal(G.chooseFieldApproach(state,'breach').ok,true);const w=start(state);
  assert.equal(w.approach,'breach');assert.equal(w.engineering,true);assert.equal(w.walkUntil,2*R);
  const hero=w.actors.find(a=>a.id==='hero'),route=routePreview(w,'hero',far(w,hero));
  assert.equal(route.gait,'walk');assert.equal(route.reasonCode,'MARCH_PENALTY');
  const enemy=w.actors.find(a=>a.side==='enemy'),man=w.actors.find(a=>a.squadId&&a.side!=='enemy');
  assert.ok(blowSetup(w,enemy,man).mods.some(m=>m.label==='Engineers’ works'));assert.ok(!blowSetup(w,enemy,hero).mods.some(m=>m.label==='Engineers’ works'));
  planDoctrine(w);for(const q of w.squads.filter(q=>q.side==='enemy'&&q.role==='archer'))assert.equal(w.doctrine.roles[q.id],'Suppress engineers');
  while(w.tick<2*R)step(w);assert.equal(routePreview(w,'hero',far(w,hero)).gait,'run','from round three he runs again');
});

test('a diversion draws one enemy band to the false approach until the end of round two; a defensive advance braces the company and turns the horse on the soldier',()=>{
  const state=camp('ch5-mine');assert.equal(G.chooseOperationalPlan(state,'balanced').ok,true);assert.equal(G.chooseFieldApproach(state,'diversion').ok,true);const w=start(state);
  planDoctrine(w);assert.equal(Object.values(w.doctrine.roles).filter(r=>r==='Investigate diversion').length,1);assert.equal(w.walkUntil,undefined,'a diversion costs no march');
  const s2=camp('ch5-mine');assert.equal(G.chooseOperationalPlan(s2,'balanced').ok,true);assert.equal(G.chooseFieldApproach(s2,'advance').ok,true);const w2=start(s2);
  assert.ok(w2.squads.filter(q=>q.side!=='enemy').every(q=>q.braced),'the company starts braced');assert.equal(w2.walkUntil,2*R);
  planDoctrine(w2);for(const q of w2.squads.filter(q=>q.side==='enemy'&&['cavalry','heavy','raider'].includes(q.role)))assert.equal(w2.doctrine.roles[q.id],'Turn the shield flank');
});

test('the engineer train keeps the soldier at a walk all battle; the command reserve costs him a pilum',()=>{
  const state=camp('ch5-mine'),w=start(state);
  // The command campaign brings the engineer train to Chapter V.
  assert.equal(state.encounter.commandCampaign.plan,'engineers');assert.ok(w.walkUntil>1e6);
  const pila=plan=>{const s=camp('ch5-mine');assert.equal(G.chooseOperationalPlan(s,plan).ok,true);return start(s).actors.find(a=>a.id==='hero').ammo.pilum;};
  assert.equal(pila('reserve'),pila('balanced')-1);
});

test('orders demonstrate Order and Formation, and the chapter records them when the fight is written back',()=>{
  const state=camp('ch5-mine');const w=start(state),ours=w.squads.filter(q=>q.side!=='enemy').map(q=>q.id);
  assert.equal(queueCommand(w,{actorId:'hero',kind:'order',payload:{squads:[ours[0]],order:{kind:'hold'}}}).ok,true);
  for(let i=0;i<40;i++)step(w);assert.ok(w.used.includes('order'));assert.ok(!w.used.includes('formation'));
  assert.equal(queueCommand(w,{actorId:'hero',kind:'order',payload:{squads:[ours[0]],order:{kind:'line'}}}).ok,true);
  for(let i=0;i<40;i++)step(w);assert.ok(w.used.includes('formation'));
  applyRealtimeOutcome(state,w);assert.ok(state.chapterCapabilities[5].includes('formation'));assert.ok(state.encounter.usedAbilities.includes('order'));
});

test('rain makes the slopes slower: the high ground’s edge is crossed at half speed',()=>{
  const terrain=Array.from({length:6},(_,r)=>Array.from({length:6},(_,c)=>c>=3?'high':'grass'));
  const dry=navGrid({id:'slope',width:6,height:6,terrain}),wet=navGrid({id:'slope',width:6,height:6,terrain,rain:true});
  const at=(g,x,z)=>g.speed[Math.floor(z/g.cell)*g.cols+Math.floor(x/g.cell)];
  assert.equal(at(dry,7.8,5),1);assert.equal(at(wet,7.8,5),at(dry,7.8,5)*.5,'the edge, in rain');assert.equal(at(wet,12,5),at(dry,12,5),'the top is not slowed');
});

test('Chapter VII’s rest adds 4 Health and fortifying starts the soldier braced; Chapter IX’s night march fights in the dark',()=>{
  const health=preparation=>{const s=camp('ch7-legion');assert.equal(G.startEncounter(s,{controls:'realtime',preparation}).ok,true);return G.realtimeWorld(s).actors.find(a=>a.id==='hero');};
  const rested=health('rest'),drilled=health('drill');assert.equal(rested.maxHp,drilled.maxHp+4);assert.equal(rested.hp,rested.maxHp);
  assert.equal(health('fortify').braceUntil,R,'braced through the first round');
  const s9=camp('ch9-wing');assert.equal(G.startEncounter(s9,{controls:'realtime',stratagem:'night'}).ok,true);assert.equal(G.realtimeWorld(s9).timeOfDay,'night');
});

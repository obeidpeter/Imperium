import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {step,worldHash} from '../src/core/realtime/simulation.js';
import {alliedPlans,fieldIntelligence,intentions,threatArea} from '../src/core/realtime/intel.js';
import {planDoctrine} from '../src/core/realtime/squad-ai.js';
import {squadCentre} from '../src/core/realtime/squads.js';
import {EXCHANGE} from '../src/data/realtime-squads.js';
import {TIME} from '../src/data/realtime-rules.js';

// What the soldier knows of the field (guide "Knowing the enemy", "Reading the
// battlefield"): the field intelligence panel, Allied plans & visible threats,
// the intention arrows on U and the red-hatched threat, on a battle reached by
// the 0.38 command campaign's legal commands. All of it reads the world only.

let saved=null;
function battle(){
  if(!saved){const stop=new Error('reached');
    try{runCommandCampaign({featureEdition:35,onCheckpoint(s){if(G.getChapter(s).encounters[s.encounterIndex]?.id==='ch5-mine'){saved=G.serialize(s);throw stop;}}});}
    catch(error){if(error!==stop)throw error;}}
  const state=G.deserialize(saved);assert.equal(G.chooseOperationalPlan(state,'balanced').ok,true);assert.equal(G.chooseFieldApproach(state,'breach').ok,true);
  assert.equal(G.startEncounter(state,{controls:'realtime'}).ok,true);return G.realtimeWorld(state);
}

test('the field intelligence names the enemy’s doctrine and focus, the approach, the opportunities and when they close, and the field’s objects',()=>{
  const w=battle();planDoctrine(w);const before=worldHash(w),intel=fieldIntelligence(w);
  assert.equal(intel.doctrine.label,'Counterattack at the mine');assert.ok(intel.doctrine.focus,'a focus is named');
  assert.equal(intel.approach.label,'Engineering approach');assert.equal(intel.closes,7);
  assert.deepEqual(intel.opportunities.map(o=>o.state),['available','available']);assert.match(intel.opportunities[0].description,/side gate/i);
  assert.ok(intel.objects.some(o=>o.name==='Side gate'&&o.state==='open'),'the engineers opened it');
  assert.equal(worldHash(w),before,'reading the field changes nothing');
});

test('Allied plans & visible threats say each squad’s and companion’s plan and each enemy in sight, nearest first; the arrows go where they say',()=>{
  const w=battle();for(let i=0;i<TIME.roundTicks+5;i++)step(w);const plans=alliedPlans(w);
  assert.ok(plans.ours.length>=w.squads.filter(q=>q.side!=='enemy').length);assert.ok(plans.ours.every(o=>o.name&&o.plan));
  assert.ok(plans.threats.length>0);for(let i=1;i<plans.threats.length;i++)assert.ok(plans.threats[i-1].distance<=plans.threats[i].distance,'nearest first');
  assert.ok(plans.threats.some(t=>t.role),'the doctrine’s role for each band');
  const arrows=intentions(w);assert.ok(arrows.length>0);
  for(const a of arrows){assert.ok(Number.isFinite(a.from.x)&&Number.isFinite(a.to.x));assert.ok(w.squads.some(q=>q.id===a.id)||w.actors.some(x=>x.id===a.id));}
  assert.ok(!arrows.some(a=>w.squads.find(q=>q.id===a.id)?.side!=='enemy'&&w.squads.some(q=>q.id===a.id)),'only the enemy’s');
});

test('the threat is as far as the band can go in a round and its reach beyond (its bows’ range for archers)',()=>{
  const w=battle(),band=w.squads.find(q=>q.side==='enemy'&&q.role!=='archer'),bows=w.squads.find(q=>q.side==='enemy'&&q.role==='archer');
  const area=threatArea(w,band.id),c=squadCentre(w,band);assert.ok(Math.abs(area.x-c.x)<1e-9&&Math.abs(area.z-c.z)<1e-9);
  assert.ok(area.radius>EXCHANGE.contact&&area.radius<EXCHANGE.contact+60);
  if(bows)assert.ok(threatArea(w,bows.id).radius>=EXCHANGE.missileRange.archer,'archers reach with their bows');
  assert.equal(threatArea(w,band.members[0])?.squadId,band.id,'a man of a band shows his band’s threat');
  assert.equal(threatArea(w,'hero'),null,'not a friend’s');
});

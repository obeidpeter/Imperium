import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {commandAssignment} from '../src/core/command-campaign.js';
const camps=new Map();let run;
function camp(id='ch5-wall'){
  run??=runCommandCampaign({onCheckpoint:s=>camps.set(G.getChapter(s).encounters[s.encounterIndex].id,structuredClone(s))});
  const s=structuredClone(camps.get(id));assert.ok(s);
  assert.ok(G.enableFieldApproaches(s).ok);assert.ok(G.chooseOperationalPlan(s,'balanced').ok);return s;
}
test('New campaigns opt in explicitly and older checkpoints retain their rules',()=>{
  const old=G.newGame('Old',275,{featureEdition:34}),modern=G.newGame('New',275,{featureEdition:35});
  assert.equal(old.tacticsEdition,undefined);assert.equal(modern.tacticsEdition,35);assert.equal(modern.campaignEdition,34);
  G.deserialize(G.serialize(old));G.deserialize(G.serialize(modern));
  G.choose(old,'report');G.startEncounter(old);const before=G.serialize(old);assert.equal(G.enableFieldApproaches(old).ok,false);assert.equal(G.serialize(old),before);
});
test('Approaches pay combined costs once, reject an unaffordable departure, and Retry is exact',()=>{
  const s=camp();s.supplies=4;assert.ok(G.prepareCompany(s,'rearm').ok);assert.ok(G.chooseFieldApproach(s,'breach').ok);
  assert.equal(G.chooseOperationalPlan(s,'engineers').ok,false);
  s.supplies=3;const rejected=G.serialize(s);assert.equal(G.startEncounter(s).ok,false);assert.equal(G.serialize(s),rejected);
  s.supplies=4;assert.ok(G.startEncounter(s).ok);assert.equal(s.supplies,0);const start=G.serialize(s);
  G.deserialize(start);assert.ok(G.endTurn(s).ok);assert.ok(G.retry(s).ok);assert.equal(G.serialize(s),start);
});
test('Three Chapter V approaches produce different geometry, company condition and public enemy orders',()=>{
  const states={};
  for(const id of ['balanced','breach','diversion','advance']){
    const s=camp();s.supplies=20;assert.ok(G.chooseFieldApproach(s,id).ok);assert.ok(G.startEncounter(s).ok);G.deserialize(G.serialize(s));states[id]=s;
  }
  const base=states.balanced.encounter,breach=states.breach.encounter,diversion=states.diversion.encounter,advance=states.advance.encounter;
  assert.equal(breach.defence,base.defence+10);
  assert.equal(breach.units.find(u=>u.id==='hero').move,Math.max(1,base.units.find(u=>u.id==='hero').move-1));
  for(const o of breach.field.objects.filter(o=>o.kind==='gate'))assert.equal(o.state,'open');
  assert.ok(advance.units.filter(u=>u.side==='ally'||u.side==='player').every(u=>u.braced));
  assert.ok(diversion.units.some(u=>commandAssignment(diversion,u)?.role==='Investigate diversion'));
  const before=G.serialize(states.diversion);for(const u of diversion.units)commandAssignment(diversion,u);assert.equal(G.serialize(states.diversion),before);
  diversion.turn=3;assert.ok(diversion.units.every(u=>commandAssignment(diversion,u)?.role!=='Investigate diversion'));
});
test('Malformed or mismatched approach checkpoints cannot be restored',()=>{
  const s=camp();assert.ok(G.startEncounter(s).ok);
  for(const mutate of [s=>s.tacticsEdition=99,s=>s.fieldApproach='free-victory',s=>s.snapshot.fieldApproach='diversion',s=>delete s.encounter.tacticsEdition]){
    const copy=structuredClone(s);mutate(copy);assert.throws(()=>G.deserialize(JSON.stringify(copy)));
  }
});

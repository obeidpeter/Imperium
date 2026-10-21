import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {heroDecision} from '../scripts/realtime-autoplay.mjs';
import {step,worldHash} from '../src/core/realtime/simulation.js';
import {SLOT_IDS,listSlots,writeSlot,readSlot,clearSlots} from '../src/ui/save-slots.js';

function atRoad(options={}){
  const s=G.newGame('Aurelius Marcellus',275,{featureEdition:35,progression:true,...options});
  G.choose(s,G.getChapter(s).decision.options[0].id);assert.ok(G.startEncounter(s,{controls:'realtime'}).ok);
  // Win the drill with the harness, record it, swear the oath, march to the road.
  const w=G.realtimeWorld(s);for(let i=0;i<6000&&w.status==='active';i++){if(w.tick%10===0)heroDecision(w);step(w);}
  assert.ok(G.resolveRealtime(s,w).ok);assert.ok(G.commitEncounter(s).ok);assert.ok(G.swearOath(s).ok);assert.ok(G.startEncounter(s,{controls:'realtime'}).ok);
  return s;
}
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};

test('41b: the resume point is kept on a pause, restores the fight exactly, and is discarded on resume: a reload then starts from the checkpoint',()=>{
  const s=atRoad(),start=worldHash(G.realtimeWorld(s)),w=G.realtimeWorld(s);
  for(let i=0;i<300;i++){if(w.tick%10===0)heroDecision(w);step(w);}
  assert.ok(G.saveRealtime(s,w).ok,'a pause keeps the resume point');
  const reloaded=G.deserialize(G.serialize(s));assert.equal(worldHash(G.realtimeWorld(reloaded)),worldHash(w),'Continue restores the moment exactly');
  assert.ok(G.clearResume(reloaded).ok,'play resumed');assert.equal(G.clearResume(reloaded).ok,false,'once');
  assert.equal(worldHash(G.realtimeWorld(G.deserialize(G.serialize(reloaded)))),start,'without the resume point, the encounter begins again');
  const tampered=JSON.parse(G.serialize(s));tampered.encounter.realtime.resume.encounterId='ch2-marsh';assert.throws(()=>G.deserialize(JSON.stringify(tampered)),/resume/);
});

test('G35: Iron discipline blocks manual saves inside encounters, its save code carries only the checkpoint, and it can be lifted but not restored',()=>{
  const iron=atRoad({ironDiscipline:true}),plain=atRoad();
  assert.match(G.manualSaveProblem(iron),/Iron discipline/);assert.equal(G.manualSaveProblem(plain),null);
  const code=G.codeState(iron);assert.equal(code.phase,'camp');assert.equal(code.encounter,null);assert.equal(code.snapshot,null);
  assert.doesNotThrow(()=>G.deserialize(G.serialize(code)),'the checkpoint is a valid chronicle');
  assert.equal(G.codeState(plain),plain,'without Iron discipline the code carries the fight');
  assert.ok(G.endIronDiscipline(iron).ok);assert.equal(G.manualSaveProblem(iron),null);assert.equal(G.endIronDiscipline(iron).ok,false,'one way only');
  const bad=JSON.parse(G.serialize(plain));bad.ironDiscipline=false;assert.throws(()=>G.deserialize(JSON.stringify(bad)),/iron discipline/);
});

test('G35: quick save and five named saves keep complete chronicles, refuse a damaged one, and a new chronicle clears them',()=>{
  const storage=memory(),s=atRoad();
  assert.deepEqual(listSlots(storage).map(x=>x.empty),SLOT_IDS.map(()=>true));
  writeSlot('quick',s,{name:'Quick save',summary:'Chapter I'},storage);writeSlot('3',s,{name:'Before the road',summary:'Chapter I · Fire'},storage);
  const list=listSlots(storage);assert.equal(list.find(x=>x.id==='3').name,'Before the road');assert.ok(list.find(x=>x.id==='1').empty);
  assert.equal(G.serialize(readSlot('3',storage)),G.serialize(s),'loading restores the slot exactly');
  const raw=JSON.parse(storage.getItem('imperium.slots'));raw['3'].payload=raw['3'].payload.replace('Aurelius','Tampered');storage.setItem('imperium.slots',JSON.stringify(raw));
  assert.throws(()=>readSlot('3',storage),/damaged/);assert.throws(()=>readSlot('2',storage),/empty/);
  clearSlots(storage);assert.ok(listSlots(storage).every(x=>x.empty));
});

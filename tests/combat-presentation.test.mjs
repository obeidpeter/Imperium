import test from 'node:test';
import assert from 'node:assert/strict';
import {meleeOffset,combatCues} from '../src/showcase/combat-presentation.js';
import {buildEncounterTimeline,sampleEncounterTimeline} from '../src/ui/animation-timeline.js';
import {createShowcaseSession} from '../src/showcase/session.js';
import * as Game from '../src/core/game.js';
import {playEncounter} from '../scripts/autoplay.mjs';

const freeze=v=>{if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}return v;};
const clone=v=>structuredClone(v);

test('Melee contact approaches its actual target, stays bounded and recovers exactly to the tile centre',()=>{
  for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1]]){
    const unit=freeze({id:'hero',x:2,y:3}),track=freeze({tracks:[{unitId:'hero',pose:'attack',target:{x:2+dx,y:3+dy}}]}),before=JSON.stringify(track),make=p=>({pose:'attack',x:2,y:3,progress:p});
    for(const p of [0,1]){const offset=meleeOffset(unit,make(p),track);assert.equal(Math.hypot(offset.x,offset.z),0);}
    const contact=meleeOffset(unit,make(230/620),track);assert.ok(Math.hypot(contact.x,contact.z)<=.85000001);assert.ok(contact.x*dx+contact.z*dy>.5);assert.equal(JSON.stringify(track),before);
    for(let i=0;i<=20;i++){const offset=meleeOffset(unit,make(i/20),track);assert.ok(Number.isFinite(offset.x)&&Number.isFinite(offset.z));assert.ok(Math.hypot(offset.x,offset.z)<=Math.hypot(contact.x,contact.z)+1e-8);}
  }
});

test('Walking, throwing, absent targets and distant targets cannot invent melee travel',()=>{
  const unit={id:'hero'},timeline={tracks:[{unitId:'hero',pose:'attack',target:{x:5,y:5}}]};
  for(const override of [null,{pose:'idle',x:0,y:0,progress:.5},{pose:'throw',x:0,y:0,progress:.5},{pose:'walk',x:0,y:0,progress:.5},{pose:'attack',x:0,y:0,progress:.5}])assert.deepEqual(meleeOffset(unit,override,timeline),{x:0,z:0});
  assert.deepEqual(meleeOffset(unit,{pose:'attack',x:0,y:0,progress:.5},{tracks:[]}),{x:0,z:0});
  assert.deepEqual(meleeOffset(unit,{pose:'attack',x:5,y:5,progress:.5},timeline),{x:0,z:0});
});

test('Sound cues use committed timeline timestamps, stable ordering and bounded step/event counts without mutation',()=>{
  const timeline=freeze({tracks:[{start:100,duration:800,path:Array.from({length:20},(_,x)=>({x,y:0}))},{start:10,duration:400,pose:'brace'}],effects:[{type:'impact',start:610},{type:'projectile',projectile:'arrow',start:250},{type:'slash',start:460},{type:'shield',start:600},{type:'projectile',projectile:'javelin',start:310},{type:'dust',start:100}]});
  const before=JSON.stringify(timeline),cues=combatCues(timeline);assert.equal(JSON.stringify(timeline),before);assert.equal(cues.filter(c=>c.kind==='footstep').length,64);assert.ok(cues.every((c,i)=>i===0||c.time>=cues[i-1].time));
  for(const [kind,time]of [['cloth',130],['bow',250],['javelin',310],['swing',460],['block',600],['impact',610]])assert.ok(cues.some(c=>c.kind===kind&&c.time===time));
  const capped=combatCues({tracks:[],effects:Array.from({length:120},(_,i)=>({type:'impact',start:119-i}))});assert.equal(capped.length,100);assert.equal(capped[0].time,0);assert.equal(capped.at(-1).time,99);assert.deepEqual(combatCues({tracks:[],effects:[]}),[]);
});

test('Real legal battle transitions produce presentation cues and contact offsets without changing either snapshot',()=>{
  const run=createShowcaseSession(),trace=[];playEncounter(run,{style:'tactical',trace});const state=createShowcaseSession();let moves=0,melee=0,projectiles=0;
  for(const step of trace){
    const before=clone(state.encounter);const result=step.kind==='act'?Game.act(state,step.payload):Game.endTurn(state);assert.equal(result.ok,true);const after=clone(state.encounter);freeze(before);freeze(after);const encoded=JSON.stringify({before,after}),timeline=freeze(buildEncounterTimeline(before,after,{command:step.kind==='act'?step.payload:{action:'endTurn'}})),timelineBefore=JSON.stringify(timeline),cues=combatCues(timeline);
    for(const cue of cues){assert.ok(Number.isFinite(cue.time));assert.ok(cue.time>=0&&cue.time<=timeline.duration);assert.ok(cue.intensity>=0&&cue.intensity<=1);}
    moves+=cues.filter(c=>c.kind==='footstep').length;projectiles+=cues.filter(c=>['javelin','bow'].includes(c.kind)).length;
    for(const track of timeline.tracks.filter(t=>['attack','cavalry-attack'].includes(t.pose)&&t.target)){
      const sample=sampleEncounterTimeline(timeline,track.start+230),override=sample.unitOverrides[track.unitId],unit=after.units.find(u=>u.id===track.unitId);if(override?.pose!==track.pose)continue;const offset=meleeOffset(unit,override,timeline);assert.ok(Number.isFinite(offset.x)&&Number.isFinite(offset.z));assert.ok(Math.hypot(offset.x,offset.z)<=.85000001);melee++;
    }
    assert.equal(JSON.stringify(timeline),timelineBefore);assert.equal(JSON.stringify({before,after}),encoded);
  }
  assert.equal(state.encounter.status,'won');assert.ok(moves>0&&melee>0&&projectiles>0,'The legal replay exercises movement, contact and projectiles');
});

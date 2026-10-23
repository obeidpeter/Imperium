import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,queueCommand,snapshotWorld,restoreWorld,worldHash} from '../src/core/realtime/simulation.js';
import {abilityKey} from '../src/core/realtime/intents.js';
import {ARENA,FIELD_ORDER} from '../src/data/realtime-rules.js';
import {missionAbilities,missionAbilityHint,fieldNotice,enemyCue,victoryReason} from '../src/ui/field-experience.js';
import {abilityGroups} from '../src/ui/realtime-hud.js';
import {attributeImprovement,attributeMilestone} from '../src/ui/soldier-comparison.js';
import {soldierPreviewUnit} from '../src/showcase/soldier-preview.js';
import {createSoldier,attributeCost} from '../src/core/soldier.js';
import * as Game from '../src/core/game.js';

const battle=()=>createWorld({map:{width:30,height:20,terrain:Array.from({length:20},()=>Array(30).fill('grass'))},seed:275,actors:[
  {id:'hero',name:'Recruit',side:'player',role:'soldier',path:'legionary',kit:ARENA.hero.kit,abilities:['strike','brace','throw_pilum','scout'],ammo:{pilum:2},at:[12,20],face:[1,0]},
  {id:'bow',name:'Archer',side:'enemy',role:'archer',kit:['tunic','bow'],ammo:{arrow:20},at:[16,20],face:[-1,0],alert:true,aware:['hero']}
]});

test('self actions execute once, targeted actions select then execute, without spending state until queued',()=>{
  const w=battle(),before=worldHash(w);
  const brace=abilityKey(w,{abilityId:'brace'});assert.equal(brace.command?.payload.abilityId,'brace');
  const selected=abilityKey(w,{abilityId:'throw_pilum',keyTarget:'bow'});assert.equal(selected.command,null);
  const execute=abilityKey(w,{abilityId:'throw_pilum',current:selected.current,keyTarget:'bow'});
  assert.equal(execute.command?.payload.targetId,'bow');assert.equal(worldHash(w),before);
  assert.equal(queueCommand(w,brace.command).ok,true);step(w);assert.ok(w.used.includes('brace'));
});

test('every mission keeps essential abilities visible without dropping or renumbering other abilities',()=>{
  for(const mode of ['training','clear','capture','hold','recover','extract','supply','defection','settlement','surrender']){
    const w={mission:{mode,required:mode==='training'?['strike','brace','throw_pilum']:[]}},ids=[...FIELD_ORDER];
    const groups=abilityGroups(ids,missionAbilities(w));
    assert.deepEqual(new Set([...groups.primary,...groups.more]),new Set(ids));
    for(const id of missionAbilities(w).filter(id=>ids.includes(id)))assert.ok(groups.primary.includes(id),`${mode}: ${id}`);
    assert.deepEqual(groups.primary,ids.filter(id=>groups.primary.includes(id)));
  }
  assert.match(missionAbilityHint({mission:{mode:'defection',radius:7.5}},'rally'),/22.5 m.*morale/);
});

test('critical field notices and target counters are factual, stable and read-only',()=>{
  const w=battle(),target=w.actors[1],before=worldHash(w);
  assert.match(enemyCue(w,target),/cover/);assert.equal(enemyCue(w,{...target,hidden:true}),'');
  assert.match(fieldNotice(w,{kind:'field',what:'opportunity',label:'Engineers’ plans'}).body,/Engineers’ plans/);
  assert.match(fieldNotice(w,{kind:'pledge',name:'Fourth cohort',joined:false}).body,/leaves the field/);
  assert.match(victoryReason({mission:{mode:'defection',defections:1,rivals:4}}),/remaining opposition/);
  assert.equal(worldHash(w),before);
});

test('archer retreats are bounded, create a shooting window and replay exactly after a save',()=>{
  const w=battle(),events=[];for(let i=0;i<50;i++){step(w);events.push(...w.events);}
  const retreats=events.filter(e=>e.kind==='intent'&&e.what==='disengage');assert.ok(retreats.length<=1);
  assert.ok(w.actors[1].ai.nextRetreatAt>0,'The nearby archer actually disengaged');
  assert.equal(w.actors[1].action?.kind,'shot','The archer plants its feet and shoots after disengaging');
  const saved=restoreWorld(snapshotWorld(w));for(let i=0;i<90;i++)step(w);for(let i=0;i<90;i++)step(saved);
  assert.equal(worldHash(saved),worldHash(w));
});

test('training milestones show the first actual change and cumulative TP price',()=>{
  const s=Game.newGame('Recruit',275,{featureEdition:35,progression:true});s.soldier=createSoldier();
  const before=Game.serialize(s);
  for(const key of ['str','con','agi','per','elo','auth','combat']){
    const milestone=attributeMilestone(s,key);assert.ok(milestone,key);
    assert.equal(milestone.cost,Array.from({length:milestone.steps},(_,i)=>attributeCost(s.soldier.base[key]+i)).reduce((a,b)=>a+b,0));
    for(let n=1;n<milestone.steps;n++)assert.equal(attributeImprovement({...s,soldier:{...s.soldier,base:{...s.soldier.base,[key]:s.soldier.base[key]+n-1}}},key).length,0);
  }
  assert.equal(Game.serialize(s),before);
});

test('recruit preview reveals appearance without removing equipment from the save',()=>{
  const soldier=createSoldier({appearance:{hair:3,beard:2}}),before=JSON.stringify(soldier);
  const wearing=soldierPreviewUnit(soldier),uncovered=soldierPreviewUnit(soldier,{uncovered:true});
  assert.deepEqual(wearing.appearance,uncovered.appearance);assert.ok(wearing.equipment.length>uncovered.equipment.length);
  assert.equal(JSON.stringify(soldier),before);
});

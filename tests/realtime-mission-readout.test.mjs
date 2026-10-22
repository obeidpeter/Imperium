import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {CHAPTERS} from '../src/data/campaign.js';
import {TIME} from '../src/data/realtime-rules.js';
import {createBattle} from '../src/core/battle.js';
import {initializeExpanded} from '../src/core/expanded-campaign.js';
import {createEncounterWorld} from '../src/core/realtime/campaign-encounter.js';
import {missionReadout,missionDefeatCause,missionDefeatHelp,realtimeMissionText} from '../src/ui/realtime-mission-readout.js';
import {keymapFrom} from '../src/ui/action-map.js';

// Explicit scenario fixtures for read-only presentation. They grant no results
// and are separate from the legal-command campaign regression run.
function field(chapter=2,index=0){
  const state=G.newGame('Marcellus',275,{featureEdition:35,progression:true});
  state.chapter=chapter;state.encounterIndex=index;state.decisions.ch2='carry';
  state.encounter=createBattle(state,CHAPTERS[chapter-1].encounters[index],{});
  initializeExpanded(state);
  return createEncounterWorld(state);
}
const patient=w=>w.actors.find(a=>w.mission.escorts.includes(a.id));
const hero=w=>w.actors.find(a=>a.id===w.heroId);
const hideEnemies=w=>w.actors.filter(a=>a.side==='enemy').forEach(a=>{a.hidden=true;});

test('rescue readout follows wound treatment, escort and commander arrival without changing the world',()=>{
  const w=field(),p=patient(w),h=hero(w),before=JSON.stringify(w);
  assert.match(missionReadout(w).next,new RegExp(`Reach ${p.name}`));
  assert.match(missionReadout(w).next,/Bind wounds.*Carry/);
  assert.equal(JSON.stringify(w),before);
  h.action={kind:'work',what:'bind_wounds',targetId:p.id,end:w.tick+60};
  assert.match(missionReadout(w).next,/3s.*interrupts/);
  h.action=null;p.escort.escorted=true;p.escort.wounded=false;
  assert.match(missionReadout(w).next,/Escort .*protector within 4 m/);
  p.x=w.mission.goal.x;p.z=w.mission.goal.z;
  assert.match(missionReadout(w).next,/Bring your soldier inside/);
  p.carriedBy=h.id;assert.match(missionReadout(w).next,/only walk and cannot block/);
});

test('protected ally warning follows visible threats, with a stable announcement key across health updates',()=>{
  const w=field(),p=patient(w);hideEnemies(w);
  assert.equal(missionReadout(w).warningKey,'','does not expose a hidden raider');
  const enemy=w.actors.find(a=>a.side==='enemy');enemy.hidden=false;enemy.order={kind:'attack',targetId:p.id};
  const map=keymapFrom({pause:['KeyK','Pause']}),initial=missionReadout(w,{keymap:map});
  assert.match(initial.warning,/Pause \(K\)/);assert.match(initial.warning,/critically hurt/);
  p.hp--;assert.equal(missionReadout(w).warningKey,initial.warningKey,'a new health value is not a new announcement');
  assert.notEqual(missionReadout(w).warning,initial.warning);
  p.hp=p.maxHp;assert.notEqual(missionReadout(w).warningKey,initial.warningKey,'severity change is announced');
  enemy.hidden=true;p.lastHitTick=w.tick;assert.match(missionReadout(w).warning,/in danger/,'recent injury still warns without exposing the hidden attacker');
  w.tick+=TIME.ticksPerSecond*4;assert.equal(missionReadout(w).warningKey,'','warning clears after threat and recent hit disappear');
});

test('rescue loss explains the protected casualty before incidental flank hits or unused pila',()=>{
  const w=field(),p=patient(w),h=hero(w),enemy=w.actors.find(a=>a.side==='enemy');
  p.alive=false;p.killedBy=enemy.id;w.status='lost';w.mission.reason='A protected column was lost.';
  w.log.push({text:'Marcellus is struck from the flank.'});h.ammo.pilum=2;
  assert.match(missionDefeatCause(w),new RegExp(p.name));
  assert.match(missionDefeatCause(w),/remaining Health cannot replace/);
  assert.match(missionDefeatHelp(w),/Bind wounds.*3s.*interrupted/);
  assert.match(missionDefeatHelp(w),/every survivor and your soldier/);
  assert.match(missionDefeatHelp(w),/No permanent companion fate/);
  assert.doesNotMatch(missionDefeatHelp(w),/pila were never|Flank or rear blows/);
  h.alive=false;h.killedBy=enemy.id;assert.match(missionDefeatCause(w),/^You fell to/,'hero death keeps actual rule priority');
});

test('alternating threatened survivors does not repeat an alert of the same severity',()=>{
  const w=field(),p=patient(w);hideEnemies(w);p.hp=p.maxHp;
  const other={...p,id:'second-survivor',name:'Second survivor',x:p.x+100,z:p.z,lastHitTick:-1};w.actors.push(other);w.mission.escorts.push(other.id);
  const enemy=w.actors.find(a=>a.side==='enemy');enemy.hidden=false;enemy.order={kind:'attack',targetId:p.id};enemy.x=0;enemy.z=0;
  const first=missionReadout(w);enemy.order.targetId=other.id;const second=missionReadout(w);
  assert.equal(first.warningKey,second.warningKey);assert.notEqual(first.warning,second.warning);
  p.hp=1;enemy.order.targetId=p.id;assert.equal(missionReadout(w).warningKey,'protected-critical','new critical severity still announces');
});

test('optional work countdown includes the closing boundary and never substitutes for the main objective',()=>{
  const w=field();assert.equal(w.field.outcome,'pending');
  w.tick=w.field.deadline*TIME.roundTicks-1;
  assert.match(missionReadout(w).opportunity,/0:01 left.*3s/);
  w.tick++;assert.match(missionReadout(w).opportunity,/closed; the main objective remains/);
  w.field.choice='stores';assert.match(missionReadout(w).opportunity,/secured/);
});

test('optional deadline gets one event key before it closes, while protected-ally danger takes precedence',()=>{
  const w=field();hideEnemies(w);w.tick=w.field.deadline*TIME.roundTicks-TIME.ticksPerSecond*10;
  const first=missionReadout(w);assert.equal(first.warningKey,'opportunity-deadline');
  w.tick+=TIME.ticksPerSecond;assert.equal(missionReadout(w).warningKey,first.warningKey);
  const enemy=w.actors.find(a=>a.side==='enemy');enemy.hidden=false;enemy.order={kind:'attack',targetId:patient(w).id};
  assert.match(missionReadout(w).warningKey,/^protected-/);
});

test('orders distinguish queued commands, delivery time and a recorded order',()=>{
  const w=field(5),s=w.squads.find(s=>s.side!=='enemy');
  w.queue.push({kind:'order',payload:{squads:[s.id],order:{kind:'line'}}});
  assert.match(missionReadout(w).orderStatus,/Line queued for the next simulation step/);
  w.queue=[];s.pending={order:{kind:'advance'},at:w.tick+20};
  assert.match(missionReadout(w).orderStatus,/Advance on its way \(1s\)/);
  s.pending=null;w.log.push({kind:'order',text:'First century: hold the line.'});
  assert.equal(missionReadout(w).orderStatus,'Last order: First century: hold the line.');
});

test('deadline diagnosis distinguishes missing demonstrated capability from evacuation or control',()=>{
  const w=field();w.tick=w.mission.deadline*TIME.roundTicks;
  w.mission.required=['assist'];w.used=[];assert.match(missionDefeatCause(w),/deadline passed before you could/);
  w.used.push(...w.mission.required);assert.match(missionDefeatCause(w),/every survivor and your soldier/);
  w.mission.mode='capture';assert.match(missionDefeatCause(w),/every required position/);
  w.mission.mode='hold';assert.match(missionDefeatCause(w),/held long enough/);
  w.mission.defence=0;assert.match(missionDefeatCause(w),/Enemy occupation/);
});

test('old operation copy is translated without changing its saved objective or required capability',()=>{
  const w=field(),copy='Use Assist on the casualty. Assist anyone stranded within four tiles by turn 7.';w.mission.required=['assist'];
  const rendered=realtimeMissionText(copy,w);
  assert.match(rendered,/Use Bind wounds or Carry on the casualty/);
  assert.doesNotMatch(rendered,/Assist|four tiles|turn /);
  assert.match(rendered,/by round 7/);assert.ok(w.mission.required.includes('assist'));
  assert.match(realtimeMissionText('Bring the party within two tiles of 3D.',w),new RegExp(`within ${Math.round(w.mission.radius*2)} m of the marked ground`));
});

test('all authored real-time battle chapters expose a pure actionable readout',()=>{
  const chapters=new Set();
  for(const ch of CHAPTERS)for(const [index,data]of ch.encounters.entries()){
    if(data.kind!=='battle')continue;
    const w=field(ch.id,index),before=JSON.stringify(w),r=missionReadout(w,{objective:data.objective});
    chapters.add(ch.id);assert.ok(r.objective,`${data.id}: objective`);assert.ok(r.next,`${data.id}: next action`);
    assert.ok(r.progress,`${data.id}: progress`);assert.ok(r.tactic,`${data.id}: combination guidance`);
    assert.equal(JSON.stringify(w),before,`${data.id}: readout is pure`);
  }
  assert.equal(chapters.size,11,'Chapter XI consists of political Contests');
});

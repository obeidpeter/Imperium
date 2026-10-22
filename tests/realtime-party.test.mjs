import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,queueCommand,step} from '../src/core/realtime/simulation.js';
import {standingPlan,summarizeOrders,slotProblem} from '../src/core/realtime/party.js';
import {STANDING,ARENA} from '../src/data/realtime-rules.js';

// Open ground, 100 m by 50 m: room for the leash.
const map={id:'open',width:40,height:20,terrain:Array.from({length:20},()=>Array(40).fill('grass'))};
const legionary={side:'player',role:'soldier',path:'legionary',kit:ARENA.hero.kit,ammo:{pilum:2}};
const companion=(id,over={})=>({id,name:id[0].toUpperCase()+id.slice(1),side:'player',role:'companion',path:'legionary',kit:ARENA.hero.kit,ammo:{pilum:2},
  downs:true,bandages:2,abilities:['strike','brace','throw_pilum','bind_wounds'],...over});
const raider=(id,at,over={})=>({id,name:`Raider ${id}`,side:'enemy',role:'raider',attributes:{str:13,agi:12,con:10,combat:8},kit:['tunic','jerkin','axe'],
  alert:true,aware:['hero','c1'],at,face:[-1,0],...over});
function party({c1=[14,25],slots=STANDING.presets.shieldmate,enemies=[],seed=7}={}){
  return createWorld({map,seed,party:['c1'],actors:[{...legionary,id:'hero',name:'Hero',at:[10,25],face:[1,0],standingPreset:'soldier'},
    {...companion('c1'),at:c1,face:[1,0],standing:slots},...enemies]});
}
const by=(w,id)=>w.actors.find(a=>a.id===id);

test('E22: beyond the 25 m leash a companion comes back, unless an attack names an enemy within 40 m of the soldier',()=>{
  const far=party({c1:[40,25]});
  assert.equal(standingPlan(far,by(far,'c1')).kind,'move','no enemy: he walks back toward the soldier');
  // An enemy striking at the soldier, 35 m from him: the explicit attack reaches past the leash.
  const near=party({c1:[40,25],enemies:[raider('r1',[45,25])]});by(near,'r1').lock='hero';by(near,'r1').order={kind:'attack',targetId:'hero'};
  const plan=standingPlan(near,by(near,'c1'));assert.equal(plan.kind,'attack');assert.equal(plan.targetId,'r1');
  // 45 m from the soldier: beyond even the long leash.
  const beyond=party({c1:[40,25],enemies:[raider('r1',[55,25])]});by(beyond,'r1').lock='hero';by(beyond,'r1').order={kind:'attack',targetId:'hero'};
  assert.notEqual(standingPlan(beyond,by(beyond,'c1')).kind,'attack');
});

test('E22: the first feasible slot wins and an infeasible one falls through, in order',()=>{
  const slots=[['attack','hero_target'],['bind_wounds','hero'],['follow_close','hero'],['attack','nearest_enemy_to_hero']];
  const w=party({slots,enemies:[raider('r1',[30,25])]});const c1=by(w,'c1');
  // No target of the soldier's, nobody hurt: following comes before the free attack.
  let plan=standingPlan(w,c1);assert.equal(plan.slot,2);
  // The soldier attacks: the first slot now has its target.
  by(w,'hero').lock='r1';plan=standingPlan(w,c1);assert.equal(plan.slot,0);assert.equal(plan.targetId,'r1');
});

test('E22: Bind wounds only below half Health, Withdraw only below a third of his own',()=>{
  const orderly=party({slots:STANDING.presets.orderly}),hero=by(orderly,'hero'),c1=by(orderly,'c1');
  hero.hp=Math.ceil(hero.maxHp*.6);assert.notEqual(standingPlan(orderly,c1).abilityId,'bind_wounds','60%: no binding');
  hero.hp=Math.floor(hero.maxHp*.4);const plan=standingPlan(orderly,c1);assert.equal(plan.abilityId,'bind_wounds');assert.equal(plan.targetId,'hero');
  const w=party({c1:[20,25],slots:[['withdraw','hero'],['follow_far','hero']]}),m=by(w,'c1');
  m.hp=Math.ceil(m.maxHp*.5);assert.equal(standingPlan(w,m).slot,1,'half Health: no withdrawal');
  m.hp=Math.floor(m.maxHp*.3);const back=standingPlan(w,m);assert.equal(back.slot,0);assert.equal(back.kind,'move');
});

test('E23: the summary sentence matches the slots of every preset, and a slot that does not fit is refused',()=>{
  const expected={
    shieldmate:'Guard you against whoever attacks him; otherwise attack whoever attacks you; otherwise strike your target; otherwise follow close.',
    skirmisher:'Throw a pilum at the enemy nearest you; otherwise attack the weakest enemy; otherwise follow at a distance; otherwise withdraw to you when badly hurt.',
    orderly:'Bind the wounds of any companion below half Health; otherwise bind your wounds below half Health; otherwise follow close; otherwise attack whoever attacks you.',
    soldier:'Attack whoever attacks you; otherwise strike your target; otherwise stay hidden and never strike first; otherwise withdraw to you when badly hurt.'};
  for(const [id,slots]of Object.entries(STANDING.presets)){
    assert.equal(summarizeOrders(slots,{hero:'you'}),expected[id],id);
    for(const slot of slots)assert.equal(slotProblem(slot),null,`${id}: ${slot}`);
  }
  assert.equal(summarizeOrders([]),'No orders: he stands where he is.');
  assert.ok(slotProblem(['attack','hero']));assert.ok(slotProblem(['bind_wounds','weakest_enemy']));assert.ok(slotProblem(['follow_close','weakest_enemy']));
});

test('E24: taking control of a companion leaves the soldier on his own standing orders, and Home gives him back',()=>{
  const w=party({c1:[12,25],enemies:[raider('r1',[11.5,26.2])]});const hero=by(w,'hero'),c1=by(w,'c1'),r1=by(w,'r1');
  r1.lock='hero';r1.order={kind:'attack',targetId:'hero'};r1.ai.state='engage';r1.ai.focus='hero';
  assert.ok(queueCommand(w,{actorId:'c1',kind:'control'}).ok);step(w);assert.equal(w.controlled,'c1');
  assert.equal(queueCommand(w,{actorId:'c1',kind:'control'}).reason,'ALREADY_CONTROLLED');
  // The soldier, left to his orders, turns on the man attacking him.
  let fought=false;for(let i=0;i<40&&!fought;i++){step(w);fought=hero.lock==='r1'||hero.order?.targetId==='r1';}
  assert.ok(fought,'he fights back on his own');
  // The companion is the player's now: he does only what he is told.
  assert.ok(queueCommand(w,{actorId:'c1',kind:'move',payload:{x:20,z:25}}).ok);step(w);assert.equal(c1.order?.kind,'move');
  assert.ok(queueCommand(w,{actorId:'hero',kind:'control'}).ok);step(w);assert.equal(w.controlled,'hero');
  // Home again, the companion's own orders take over at his next decision.
  assert.equal(c1.order?.kind==='move'&&c1.goal&&Math.abs(c1.goal.x-20)<1,false,'the order he was given by hand is set aside');
  let resumed=false;for(let i=0;i<20&&!resumed;i++){step(w);resumed=c1.standingSlot>=0;}
  assert.ok(resumed,'his standing orders choose what he does again');
});

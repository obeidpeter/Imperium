import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,queueCommand,step} from '../src/core/realtime/simulation.js';
import {autoPauseReason} from '../src/core/realtime/intents.js';
import {ARENA,REASONS} from '../src/data/realtime-rules.js';

// A5 (build brief §6): every auto-pause event pauses the world when its option
// is on, never when it is off, and says why. The field (realtime-field.js)
// stops the clock on the tick that raised the reason and announces it last.

const map={id:'open',width:40,height:20,terrain:Array.from({length:20},()=>Array(40).fill('grass'))};
const hero={id:'hero',name:'Hero',side:'player',role:'soldier',path:'legionary',kit:ARENA.hero.kit,ammo:{pilum:2},bandages:1,
  abilities:['strike','brace','throw_pilum','bind_wounds','carry'],at:[10,25],face:[1,0]};
const friend={id:'f',name:'Felix',side:'player',role:'companion',path:'legionary',kit:ARENA.hero.kit,downs:true,at:[11.5,25],face:[1,0]};
const raider=(id,at,over={})=>({id,name:`Raider ${id}`,side:'enemy',role:'raider',attributes:{str:13,agi:12,con:10,combat:8},kit:['tunic','jerkin','axe'],
  at,face:[-1,0],...over});
const world=(actors=[hero,friend,raider('r',[30,25])])=>createWorld({map,seed:5,party:['f'],actors});
const ALL_ON={roundPause:true,pauseSighted:true,pauseHurt:true,pauseObjective:true,pauseOrder:true,pauseSquad:true};
const ALL_OFF={roundPause:false,pauseSighted:false,pauseHurt:false,pauseObjective:false,pauseOrder:false,pauseSquad:false};

test('A5: each auto-pause event gives its reason when its option is on, and nothing when it is off',()=>{
  const w=world(),h=w.actors.find(a=>a.id==='hero'),f=w.actors.find(a=>a.id==='f');
  // A hit that takes the controlled man below a quarter of his health; one that leaves him above it does not pause.
  h.hp=Math.floor(h.maxHp*.2);const hurt={kind:'hit',attackerId:'r',defenderId:'hero',damage:Math.ceil(h.maxHp*.1)};
  const graze={kind:'hit',attackerId:'r',defenderId:'hero',damage:1};
  const cases=[
    [{kind:'round',round:3},'roundPause','Round 3 begins.'],
    [{kind:'notice',actorId:'r',targetId:'hero'},'pauseSighted','Raider r has seen you.'],
    [{kind:'notice',actorId:'r',targetId:'f'},'pauseSighted','Raider r has seen Felix.'],
    [hurt,'pauseHurt','You are badly hurt.'],
    [{kind:'down',attackerId:'r',defenderId:'f'},'pauseHurt','Felix is down.'],
    [{kind:'phase',index:1,label:'Hold the ford'},'pauseObjective','New objective: Hold the ford.'],
    [{kind:'rejected',actorId:'hero',reason:'NO_BANDAGES'},'pauseOrder',`Hero: ${REASONS.NO_BANDAGES}`],
    // An enemy comes into view from hiding, or with the reinforcements.
    [{kind:'revealed',actorId:'r'},'pauseSighted','Raider r is revealed.'],
    [{kind:'reinforcements'},'pauseSighted','Enemy reinforcements arrive.']];
  for(const [e,option,reason]of cases){
    assert.equal(autoPauseReason(w,e,ALL_ON),reason,`${e.kind} pauses with ${option}`);
    assert.equal(autoPauseReason(w,e,{...ALL_ON,[option]:false}),null,`${e.kind} does not pause without ${option}`);
    assert.equal(autoPauseReason(w,e,ALL_OFF),null);
  }
  assert.equal(autoPauseReason(w,graze,ALL_ON),null,'a graze above a quarter does not pause');
  h.hp=Math.floor(h.maxHp*.5);assert.equal(autoPauseReason(w,hurt,ALL_ON),null,'still above a quarter');
  // The companion's own fall below a quarter names him.
  f.hp=Math.floor(f.maxHp*.2);
  assert.equal(autoPauseReason(w,{kind:'hit',attackerId:'r',defenderId:'f',damage:Math.ceil(f.maxHp*.1)},ALL_ON),'Felix is badly hurt.');
  // Enemies' troubles and their refusals never pause.
  assert.equal(autoPauseReason(w,{kind:'down',attackerId:'hero',defenderId:'r'},ALL_ON),null);
  assert.equal(autoPauseReason(w,{kind:'rejected',actorId:'r',reason:'NO_TARGET'},ALL_ON),null);
  assert.equal(autoPauseReason(w,{kind:'notice',actorId:'hero',targetId:'r'},ALL_ON),null,'only being seen pauses, not seeing');
});

test('A5: one of our squads breaking pauses the world; an enemy band breaking does not',()=>{
  const w=world();w.squads=[{id:'ours',name:'First squad',side:'ally',members:[]},{id:'theirs',name:'Gothic warriors',side:'enemy',members:[]}];
  assert.equal(autoPauseReason(w,{kind:'squad-broken',squadId:'ours'},ALL_ON),'First squad breaks.');
  assert.equal(autoPauseReason(w,{kind:'squad-broken',squadId:'ours'},{...ALL_ON,pauseSquad:false}),null);
  assert.equal(autoPauseReason(w,{kind:'squad-broken',squadId:'theirs'},ALL_ON),null);
});

test('A5: practice partners and camps never pause the world',()=>{
  const w=world([hero,friend,raider('p',[12,25],{practice:true})]);
  assert.equal(autoPauseReason(w,{kind:'notice',actorId:'p',targetId:'hero'},ALL_ON),null);
  const camp=createWorld({map,seed:5,actors:[hero],kind:'camp',mission:null});
  for(const e of [{kind:'round',round:2},{kind:'notice',actorId:'x',targetId:'hero'},{kind:'rejected',actorId:'hero',reason:'NO_TARGET'}])
    assert.equal(autoPauseReason(camp,e,ALL_ON),null,`${e.kind} in camp`);
});

test('A5: the simulation raises the events that pause — a sighting, a refusal and a round',()=>{
  const w=world([hero,friend,raider('r',[16,25])]),seen=[];
  for(let i=0;i<400&&!seen.some(e=>e.kind==='notice');i++){step(w);seen.push(...w.events.filter(e=>autoPauseReason(w,e,ALL_ON)));}
  const sighting=seen.find(e=>e.kind==='notice');assert.ok(sighting,'the raider sees the party');
  assert.match(autoPauseReason(w,sighting,ALL_ON),/^Raider r has seen (you|Felix)\.$/);
  // A refused order: valid when given, the last bandage gone by the tick it is read.
  const r=world(),rh=r.actors.find(a=>a.id==='hero');r.actors.find(a=>a.id==='f').hp=1;
  assert.ok(queueCommand(r,{actorId:'hero',kind:'ability',payload:{abilityId:'bind_wounds',targetId:'f'}}).ok);rh.bandages=0;
  let refusal=null;for(let i=0;i<40&&!refusal;i++){step(r);refusal=r.events.find(e=>e.kind==='rejected');}
  assert.ok(refusal,'the order is refused');assert.equal(autoPauseReason(r,refusal,{...ALL_OFF,pauseOrder:true}),`Hero: ${REASONS[refusal.reason]}`);
  // A round boundary every 6 s.
  const t=world();let round=null;for(let i=0;i<200&&!round;i++){step(t);round=t.events.find(e=>e.kind==='round');}
  assert.equal(autoPauseReason(t,round,{...ALL_OFF,roundPause:true}),`Round ${round.round} begins.`);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,queueCommand,step} from '../src/core/realtime/simulation.js';
import {validate} from '../src/core/realtime/abilities.js';
import {abilityKey} from '../src/core/realtime/intents.js';
import {ABILITIES,ARENA} from '../src/data/realtime-rules.js';

const map={id:'open',width:40,height:20,terrain:Array.from({length:20},()=>Array(40).fill('grass'))};
const ALL=['strike','brace','throw_pilum','bind_wounds','carry','scout','shield_bash','throw_dart'];
const soldier=(over={})=>({id:'hero',name:'Hero',side:'player',role:'soldier',path:'legionary',kit:[...ARENA.hero.kit,'dart_belt'].filter((k,i,a)=>a.indexOf(k)===i),
  ammo:{pilum:2,dart:3},bandages:2,abilities:ALL,at:[10,25],face:[1,0],...over});
const raider=(id,at,over={})=>({id,name:`Raider ${id}`,side:'enemy',role:'raider',attributes:{str:13,agi:12,con:10,combat:8},kit:['tunic','jerkin','axe'],
  alert:true,aware:['hero'],at,face:[-1,0],...over});
const friend=(id,at,over={})=>({id,name:`Friend ${id}`,side:'player',role:'companion',path:'legionary',kit:ARENA.hero.kit,downs:true,at,face:[1,0],...over});
const world=(actors,{party=[],seed=11}={})=>createWorld({map,seed,party,actors});
const by=(w,id)=>w.actors.find(a=>a.id===id);
const run=(w,n,until=()=>false)=>{for(let i=0;i<n&&!until();i++)step(w);return until();};

test('D19: Bind wounds — wounded friends only, a bandage, spent on completion; Carry — sheathed, a fallen friend, walking only',()=>{
  const w=world([soldier(),friend('f',[11.2,25]),raider('r',[30,25])],{party:['f']}),hero=by(w,'hero'),f=by(w,'f');
  assert.equal(validate(w,'hero','bind_wounds',{actorId:'f'}),'NOT_WOUNDED');
  assert.equal(validate(w,'hero','bind_wounds',{actorId:'r'}),'NOT_FRIENDLY');
  f.hp=Math.floor(f.maxHp/2);hero.bandages=0;assert.equal(validate(w,'hero','bind_wounds',{actorId:'f'}),'NO_BANDAGES');hero.bandages=2;
  assert.ok(queueCommand(w,{actorId:'hero',kind:'ability',payload:{abilityId:'bind_wounds',targetId:'f'}}).ok);step(w);step(w);
  assert.equal(hero.action?.kind,'work');assert.equal(hero.bandages,2,'nothing spent while he works');
  assert.ok(run(w,80,()=>w.events.some(e=>e.kind==='heal')));assert.equal(hero.bandages,1,'one bandage, on completion');
  assert.equal(f.hp,Math.floor(f.maxHp/2)+Math.floor(f.maxHp/4));
  // Carry: only a fallen friend, only sheathed.
  assert.equal(validate(w,'hero','carry',{actorId:'f'}),'NOT_FALLEN');f.down=true;f.hp=0;
  hero.drawn=true;assert.equal(validate(w,'hero','carry',{actorId:'f'}),'NEEDS_SHEATHED');hero.drawn=false;
  assert.equal(validate(w,'hero','carry',{actorId:'r'}),'NO_TARGET');
  assert.ok(queueCommand(w,{actorId:'hero',kind:'ability',payload:{abilityId:'carry',targetId:'f'}}).ok);
  assert.ok(run(w,60,()=>hero.carrying==='f'));assert.equal(f.carriedBy,'hero');
  assert.equal(queueCommand(w,{actorId:'hero',kind:'attack',payload:{targetId:'r'}}).reason,'CARRYING','no fighting while he carries');
  queueCommand(w,{actorId:'hero',kind:'move',payload:{x:40,z:25}});step(w);step(w);assert.equal(hero.gait,'walk','walking only');
  assert.ok(queueCommand(w,{actorId:'hero',kind:'ability',payload:{abilityId:'carry'}}).ok);step(w);assert.equal(hero.carrying??null,null,'set down');
});

test('D19: Scout spends 20 Stamina and then recovers for 30 s; Shield bash needs the course, a shield and 10 Stamina, spent only when delivered',()=>{
  const w=world([soldier(),raider('r',[11.1,25],{alert:true})]),hero=by(w,'hero');
  hero.stamina=19;assert.equal(validate(w,'hero','scout',{}),'NOT_ENOUGH_STAMINA');hero.stamina=hero.maxStamina;
  assert.ok(queueCommand(w,{actorId:'hero',kind:'ability',payload:{abilityId:'scout'}}).ok);step(w);step(w);
  assert.equal(hero.stamina,hero.maxStamina-20);assert.equal(validate(w,'hero','scout',{}),'RECOVERING');
  run(w,30*20,()=>!validate(w,'hero','scout',{}));assert.ok(w.tick>=30*20,'recovered after 30 seconds');
  // Shield bash.
  const unlearnt=world([soldier({abilities:ALL.filter(a=>a!=='shield_bash')}),raider('r',[11.1,25])]);
  assert.equal(validate(unlearnt,'hero','shield_bash',{actorId:'r'}),'NOT_LEARNT');
  const noShield=world([soldier({kit:ARENA.hero.kit.filter(k=>k!=='scutum')}),raider('r',[11.1,25])]);
  assert.equal(validate(noShield,'hero','shield_bash',{actorId:'r'}),'NO_SHIELD');
  const b=world([soldier(),raider('r',[11.1,25])]),h=by(b,'hero');h.stamina=9;assert.equal(validate(b,'hero','shield_bash',{actorId:'r'}),'NOT_ENOUGH_STAMINA');
  h.stamina=30;assert.ok(queueCommand(b,{actorId:'hero',kind:'ability',payload:{abilityId:'shield_bash',targetId:'r'}}).ok);
  assert.ok(run(b,10,()=>h.action?.kind==='bash'));assert.equal(h.stamina>=29,true,'nothing spent before the blow');
  // The tick it is delivered, ten Stamina go at once.
  let drop=0;for(let i=0;i<40&&!drop;i++){const before=h.stamina,contact=h.action?.contact===b.tick;step(b);if(contact)drop=before-h.stamina;}
  assert.ok(drop>=9.5&&drop<=10,`10 Stamina when delivered (${drop})`);run(b,40,()=>!h.action);
  assert.equal(validate(b,'hero','shield_bash',{actorId:'r'}),by(b,'r').alive?'RECOVERING':'TARGET_DOWN');
});

test('D19: missiles need ammunition and range — 25 m for the pilum, 35 m for the plumbata',()=>{
  const w=world([soldier({ammo:{pilum:0,dart:0}}),raider('r',[30,25])]);
  assert.equal(validate(w,'hero','throw_pilum',{actorId:'r'}),'NO_AMMO');assert.equal(validate(w,'hero','throw_dart',{actorId:'r'}),'NO_AMMO');
  const far=world([soldier(),raider('r',[46,25])]);
  assert.equal(validate(far,'hero','throw_pilum',{actorId:'r'}),'OUT_OF_RANGE','36 m');assert.equal(validate(far,'hero','throw_dart',{actorId:'r'}),'OUT_OF_RANGE');
  const mid=world([soldier(),raider('r',[40,25])]);
  assert.equal(validate(mid,'hero','throw_pilum',{actorId:'r'}),'OUT_OF_RANGE','30 m is past the pilum');assert.equal(validate(mid,'hero','throw_dart',{actorId:'r'}),null);
});

test('D20: Bind wounds with no target heals the soldier himself, and a hit stops it without spending the bandage',()=>{
  const w=world([soldier(),raider('r',[30,25])]),hero=by(w,'hero');hero.hp=10;
  assert.ok(queueCommand(w,{actorId:'hero',kind:'ability',payload:{abilityId:'bind_wounds'}}).ok);
  assert.ok(run(w,90,()=>w.events.some(e=>e.kind==='heal')));assert.equal(hero.hp,10+Math.floor(hero.maxHp/4));assert.equal(hero.bandages,1);
  // Now with a raider at his side, swinging: on every seed where a blow lands during the work, the work stops and the bandage is kept.
  let stops=0;
  for(let seed=1;seed<=40;seed++){
    const v=world([soldier(),raider('r',[11.1,25],{aware:['hero']})],{seed}),h=by(v,'hero'),r=by(v,'r');h.hp=20;
    r.ai.state='engage';r.ai.focus='hero';r.lock='hero';r.order={kind:'attack',targetId:'hero'};
    assert.ok(queueCommand(v,{actorId:'hero',kind:'ability',payload:{abilityId:'bind_wounds'}}).ok);
    let hitDuringWork=false,healed=false;
    for(let i=0;i<120&&!healed&&!hitDuringWork;i++){const working=h.action?.kind==='work';step(v);
      healed=v.events.some(e=>e.kind==='heal');hitDuringWork=working&&v.events.some(e=>e.kind==='hit'&&e.defenderId==='hero');}
    if(hitDuringWork){stops++;assert.equal(h.action?.kind==='work',false,`seed ${seed}: the work stopped`);assert.equal(h.bandages,2,`seed ${seed}: the bandage is kept`);}
  }
  assert.ok(stops>=3,`blows landed during the work on ${stops} seeds`);
});

test('D21: a number pressed twice uses the ability on the chosen target, or on yourself without one; quick-cast uses it at the pointer',()=>{
  const w=world([soldier(),raider('r',[20,25])]),hero=by(w,'hero');hero.hp=12;
  let r=abilityKey(w,{abilityId:'throw_pilum',current:'strike'});assert.equal(r.current,'throw_pilum');assert.equal(r.command,null,'the first press chooses');
  r=abilityKey(w,{abilityId:'throw_pilum',current:'throw_pilum',keyTarget:'r'});assert.deepEqual(r.command,{actorId:'hero',kind:'ability',payload:{abilityId:'throw_pilum',targetId:'r'}});
  r=abilityKey(w,{abilityId:'throw_pilum',current:'throw_pilum'});assert.equal(r.command,null);assert.ok(r.warning,'a throw needs a target');
  r=abilityKey(w,{abilityId:'bind_wounds',current:'bind_wounds'});assert.deepEqual(r.command,{actorId:'hero',kind:'ability',payload:{abilityId:'bind_wounds'}},'on yourself');
  r=abilityKey(w,{abilityId:'brace',current:'brace',keyTarget:'r'});assert.deepEqual(r.command?.payload,{abilityId:'brace'},'a self ability ignores the target');
  r=abilityKey(w,{abilityId:'strike',current:'strike',keyTarget:'r'});assert.equal(r.command.kind,'attack');
  // Quick-cast: one press, at whoever is under the pointer.
  r=abilityKey(w,{abilityId:'throw_pilum',current:'strike',pointer:{actorId:'r'},quickCast:true});assert.equal(r.command.payload.targetId,'r');assert.equal(r.current,'throw_pilum');
  // The command each gives is legal: it queues.
  assert.ok(queueCommand(w,abilityKey(w,{abilityId:'bind_wounds',current:'bind_wounds'}).command).ok);
});

test('C16: a blow on a man who has not noticed the attacker always lands, as a critical — an ambush',()=>{
  for(let seed=1;seed<=25;seed++){
    const w=world([soldier({at:[10,25]}),raider('r',[11.2,25],{alert:false,aware:[],face:[1,0]})],{seed}),hero=by(w,'hero');
    hero.drawn=true;assert.ok(queueCommand(w,{actorId:'hero',kind:'attack',payload:{targetId:'r'}}).ok);
    let blow=null;for(let i=0;i<60&&!blow;i++){step(w);blow=w.events.find(e=>e.attackerId==='hero'&&['hit','miss','block'].includes(e.kind));}
    assert.equal(blow?.kind,'hit',`seed ${seed}: the first blow lands`);assert.ok(blow.critical&&blow.ambush,`seed ${seed}: a critical from ambush`);
  }
});

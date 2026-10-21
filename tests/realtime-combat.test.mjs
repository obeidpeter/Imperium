import test from 'node:test';
import assert from 'node:assert/strict';
import {createShowcaseSession} from '../src/showcase/session.js';
import {createArenaWorld} from '../src/core/realtime/arena.js';
import {createWorld,queueCommand,step,worldHash} from '../src/core/realtime/simulation.js';
import {blowForecast,blowSetup,derivedValues,hitRolls,rollBlow,startingAttributes} from '../src/core/realtime/combat.js';
import {forecast,validate} from '../src/core/realtime/abilities.js';
import {nextRandom,randomInt,splitStreams} from '../src/core/realtime/rng-streams.js';
import {ARENA,COMBAT,TRAINING_PATHS} from '../src/data/realtime-rules.js';

const map=createShowcaseSession().encounter;
const legionary={id:'hero',name:'Hero',side:'player',role:'soldier',path:'legionary',kit:ARENA.hero.kit,ammo:{pilum:2}};
// The raider has seen the hero: these are fights between men aware of each other (no ambush).
const raider=(over={})=>({id:'r',name:'Raider',side:'enemy',role:'raider',attributes:{str:13,agi:12,con:10,combat:8},kit:['tunic','jerkin','axe'],
  alert:true,aware:['hero'],...over});
// Two men on open ground, facing each other unless told otherwise.
function duel({a=legionary,b=raider(),aAt=[6,16],bAt=[7.5,16],aFace=[1,0],bFace=[-1,0],seed=99}={}){
  return createWorld({map,seed,actors:[{...a,at:aAt,face:aFace},{...b,at:bAt,face:bFace}]});
}
const by=(w,id)=>w.actors.find(a=>a.id===id);

test('derived values follow §3.5 with every division floored',()=>{
  const a=startingAttributes({path:'legionary'});
  assert.deepEqual(a,{str:15,agi:12,con:13,per:7,elo:7,auth:7,combat:15,field:5});
  for(const [path,{mods}]of Object.entries(TRAINING_PATHS)){
    const s=startingAttributes({path});for(const [k,v]of Object.entries(mods))assert.equal(s[k],(k==='combat'||k==='field'?5:10)+v,path+k);
  }
  const w=duel(),hero=by(w,'hero'),d=derivedValues(hero);
  assert.equal(d.restriction,19);assert.equal(d.health,26);assert.equal(d.stamina,36);
  assert.equal(d.attack,3+6+15-1);assert.equal(d.defence,10+6+15-1);assert.equal(d.missile,d.attack+6+3-1);
  assert.equal(d.swingTicks,22);assert.equal(d.recoveryTicks,Math.round((.6-27/100+19/100)*20));
  assert.ok(Math.abs(d.run-4*(1-19/200))<1e-9);
  assert.equal(hero.hp,26);assert.equal(hero.stamina,36);
});

test('C13: over 10,000 rolls, criticals are 10% ± 1% and automatic misses 2.5% ± 0.5%',()=>{
  const streams=splitStreams(12345);let crit=0,miss=0;const N=10000;
  for(let i=0;i<N;i++){const r=randomInt(streams,'combat',0,COMBAT.roll-1);if(r>=COMBAT.critical)crit++;if(r===0)miss++;}
  assert.ok(Math.abs(crit/N-.1)<=.01,`critical ${crit/N}`);assert.ok(Math.abs(miss/N-.025)<=.005,`miss ${miss/N}`);
  // And through the real blow roll: a defence no normal roll can pass leaves only criticals.
  const w=duel(),setup={...blowSetup(w,by(w,'hero'),by(w,'r')),attack:-100,block:0};let hits=0;
  for(let i=0;i<N;i++)if(rollBlow(w,setup).hit)hits++;
  assert.ok(Math.abs(hits/N-.1)<=.01,`only criticals hit: ${hits/N}`);
});

test('criticals ignore armour absorb, and are doubled only for the actor the player controls',()=>{
  const w=duel({b:raider({kit:['tunic','jerkin','axe']})}),hero=by(w,'hero'),r=by(w,'r');
  const mine=blowForecast(blowSetup(w,hero,r)),theirs=blowForecast(blowSetup(w,r,hero));
  // The controlled actor's critical: raw × (1 − resist), doubled.
  const p=blowSetup(w,hero,r).protection,mult=1+(15-10)/25,raw=t=>[...{pierce:[4,8],cut:[1,3]}[t]];
  const crit=end=>Math.floor(raw('pierce')[end]*mult*(1-p.pierce.resist)+raw('cut')[end]*mult*(1-p.cut.resist)+1e-9)*2;
  assert.deepEqual(mine.criticalDamage,{min:crit(0),max:crit(1)});
  const part=(type,end)=>Math.max(0,raw(type)[end]*mult-p[type].absorb)*(1-p[type].resist);
  const normal=end=>Math.max(1,Math.floor(part('pierce',end)+part('cut',end)+1e-9));
  assert.deepEqual(mine.damage,{min:normal(0),max:normal(1)});
  assert.ok(mine.criticalDamage.min>mine.damage.min);
  // The raider's critical is not doubled (he is not the controlled actor).
  const rp=blowSetup(w,r,hero).protection,rm=1+(13-10)/25;
  assert.equal(theirs.criticalDamage.max,Math.max(1,Math.floor(8*rm*(1-rp.cut.resist)+2*rm*(1-rp.crush.resist)+1e-9)));
  w.controlled='r';assert.equal(blowForecast(blowSetup(w,r,hero)).criticalDamage.max,theirs.criticalDamage.max*2,'doubled once he is controlled');
});

test('C17: the forecast hit chance matches 10,000 rolls within ±1.5%',()=>{
  for(const [aAt,bAt,bFace]of [[[6,16],[7.5,16],[-1,0]],[[6,16],[7.5,16],[1,0]],[[6,16],[6,17.5],[0,-1]]]){
    const w=duel({aAt,bAt,bFace,b:raider({kit:['tunic','jerkin','round_shield','spear']})}),setup=blowSetup(w,by(w,'hero'),by(w,'r')),f=blowForecast(setup);
    let hit=0,landed=0;const N=10000;
    for(let i=0;i<N;i++){const r=rollBlow(w,setup);if(r.hit)hit++;if(r.hit&&!r.blocked)landed++;}
    assert.ok(Math.abs(hit/N-f.hit)<=.015,`hit ${hit/N} vs ${f.hit}`);assert.ok(Math.abs(landed/N-f.land)<=.015,`land ${landed/N} vs ${f.land}`);
  }
  assert.equal(hitRolls(23,27),35-4+4-0,'rolls 5..35 and the four criticals');
});

test('C15: the shield blocks only inside the front 120°, gains 0.30 braced and is halved by a stuck pilum',()=>{
  const mk=bFace=>duel({b:raider({kit:['tunic','jerkin','round_shield','spear']}),bFace});
  const front=mk([-1,0]),side=mk([0,1]),behind=mk([1,0]);
  assert.equal(blowSetup(front,by(front,'hero'),by(front,'r')).block,.2);
  assert.equal(blowSetup(side,by(side,'hero'),by(side,'r')).block,0,'a flank blow cannot be blocked');
  const rear=blowSetup(behind,by(behind,'hero'),by(behind,'r'));assert.equal(rear.block,0);assert.equal(rear.arc,'rear');
  assert.equal(rear.attack,blowSetup(front,by(front,'hero'),by(front,'r')).attack+COMBAT.rearAttack,'+10 Attack from behind');
  const r=by(front,'r');r.braceUntil=front.tick+100;assert.equal(blowSetup(front,by(front,'hero'),r).block,.5);
  r.shieldStuck=true;assert.equal(blowSetup(front,by(front,'hero'),r).block,.25);
  r.braceUntil=0;assert.equal(blowSetup(front,by(front,'hero'),r).block,.1);
  // Braced: −1 to the total of every blow taken.
  const w=duel(),hero=by(w,'hero');const plain=blowForecast(blowSetup(w,by(w,'r'),hero));hero.braceUntil=w.tick+100;
  const guarded=blowForecast(blowSetup(w,by(w,'r'),hero));assert.equal(guarded.block,.6);
  assert.equal(guarded.criticalDamage.max,Math.max(1,plain.criticalDamage.max-1));
});

test('C14: a blow above maxHealth/5 or any stun staggers and interrupts; a braced man is never staggered',()=>{
  const w=duel(),r=by(w,'r'),setup={...blowSetup(w,by(w,'hero'),r),attack:100,block:0};
  let staggered=0,heavy=0;
  for(let i=0;i<500;i++){
    const roll=rollBlow(w,setup);
    if(roll.damage>r.maxHp/5){heavy++;assert.equal(roll.stagger,true);}else if(roll.hit)assert.equal(roll.stagger,false);
    if(roll.stagger)staggered++;
  }
  assert.ok(heavy>0&&staggered===heavy);
  const stunned=rollBlow(w,{...setup,profile:{stun:[3,3]}});assert.ok(stunned.stun>0);assert.equal(stunned.stagger,true);
  assert.equal(rollBlow(w,{...setup,profile:{stun:[3,3]},noStagger:true}).stagger,false);
  // In the world: a staggering blow cancels the victim's swing and holds him still.
  const world=duel({aAt:[6,16],bAt:[7.4,16]});queueCommand(world,{actorId:'hero',kind:'attack',payload:{targetId:'r'}});
  let seen=null;for(let i=0;i<600&&!seen;i++){step(world);seen=world.events.find(e=>e.kind==='stagger'&&e.defenderId==='r');}
  assert.ok(seen,'a stagger happened');const victim=by(world,'r');
  assert.equal(victim.action,null);assert.ok(victim.staggerUntil>world.tick-1);
  const at={x:victim.x,z:victim.z};while(world.tick<victim.staggerUntil-1){step(world);if(!victim.alive)break;assert.equal(victim.action,null);}
  if(victim.alive)assert.ok(Math.hypot(victim.x-at.x,victim.z-at.z)<.5,'a staggered man does not walk');
});

test('C12: one click auto-fights until the target falls; the lock survives staggers; afterwards he stands ready unless Keep fighting',()=>{
  const world=duel();
  assert.ok(queueCommand(world,{actorId:'hero',kind:'attack',payload:{targetId:'r'}}).ok);
  let staggers=0;while(world.status==='active'&&world.tick<20*120){
    step(world);if(world.events.some(e=>e.kind==='stagger'))staggers++;
    if(by(world,'r').alive)assert.equal(by(world,'hero').lock,'r','the lock holds');
  }
  assert.equal(world.status,'won');assert.ok(staggers>0,'staggers did not break the lock');
  const hero=by(world,'hero');assert.equal(hero.lock,null);assert.equal(hero.order,null,'stands ready');assert.equal(hero.drawn,true,'drawn by the attack');
  // Keep fighting: after the kill he takes on whoever attacks him; without it he stands ready.
  for(const keepFighting of [true,false]){
    const two=createWorld({map,seed:5,options:{keepFighting},actors:[{...legionary,at:[6,16],face:[1,0]},{...raider(),id:'r1',at:[7.5,16],face:[-1,0]},
      {...raider(),id:'r2',at:[6,17.6],face:[0,-1]}]});
    queueCommand(two,{actorId:'hero',kind:'attack',payload:{targetId:'r1'}});
    while(two.status==='active'&&by(two,'r1').alive&&two.tick<20*90)step(two);
    for(let i=0;i<3;i++)step(two);
    assert.ok(by(two,'hero').alive&&by(two,'r2').alive,'the second raider is still fighting');
    assert.equal(by(two,'hero').lock,keepFighting?'r2':null,`Keep fighting ${keepFighting}`);
  }
});

test('Gate 0: auto-fight wins 10 of 10 duels without re-clicking',()=>{
  const kinds=ARENA.enemies;let wins=0;
  for(let fight=0;fight<10;fight++){
    const spec=kinds[fight%kinds.length],world=createWorld({map,seed:1000+fight,
      actors:[{...legionary,at:[3,16],face:[1,0]},{...spec,side:'enemy',at:[12,16],face:[-1,0]}]});
    let clicks=0;queueCommand(world,{actorId:'hero',kind:'attack',payload:{targetId:spec.id}});clicks++;
    while(world.status==='active'&&world.tick<20*120)step(world);
    if(world.status==='won'&&clicks===1)wins++;
  }
  assert.equal(wins,10);
});

test('the arena: one click per raider (no pila, no brace) wins at least 97% of 200 fights',()=>{
  let wins=0;
  for(let seed=1;seed<=200;seed++){
    const world=createArenaWorld(map,{seed:seed*2654435761>>>0});
    while(world.status==='active'&&world.tick<20*240){
      const hero=by(world,'hero'),enemies=world.actors.filter(a=>a.side==='enemy'&&a.alive);
      if(!hero.lock&&enemies.length){const t=[...enemies].sort((a,b)=>Math.hypot(a.x-hero.x,a.z-hero.z)-Math.hypot(b.x-hero.x,b.z-hero.z))[0];
        queueCommand(world,{actorId:'hero',kind:'attack',payload:{targetId:t.id}});}
      step(world);
    }
    if(world.status==='won')wins++;
  }
  assert.ok(wins>=194,`${wins} of 200`);
});

test('D19: Brace and Throw pilum validate with reason codes and spend only on success',()=>{
  const w=duel({bAt:[16,16]}),hero=by(w,'hero');
  assert.equal(validate(w,'hero','brace',{}),null);hero.stamina=14;assert.equal(validate(w,'hero','brace',{}),'NOT_ENOUGH_STAMINA');
  hero.stamina=36;const noShield=duel({a:{...legionary,kit:legionary.kit.filter(k=>k!=='scutum')}});assert.equal(validate(noShield,'hero','brace',{}),'NO_SHIELD');
  assert.equal(queueCommand(w,{actorId:'hero',kind:'ability',payload:{abilityId:'brace'}}).ok,true);step(w);
  assert.equal(hero.stamina,36-15+0,'15 Stamina spent');assert.ok(hero.braceUntil>w.tick);
  // A move ends the brace at once.
  queueCommand(w,{actorId:'hero',kind:'move',payload:{x:4,z:16}});step(w);assert.ok(hero.braceUntil<=w.tick);
  // Out of range, not hostile, no ammunition.
  assert.equal(validate(duel({aAt:[1.2,1.2],bAt:[19,19]}),'hero','throw_pilum',{actorId:'r'}),'OUT_OF_RANGE','25.2 m is beyond 25');
  assert.equal(validate(duel({aAt:[1.2,1.2],bAt:[18.5,18.5]}),'hero','throw_pilum',{actorId:'r'}),null,'24.5 m is within it');
  assert.equal(validate(w,'hero','throw_pilum',{actorId:'hero'}),'FRIENDLY','never at your own side');
  const before=hero.ammo.pilum;assert.ok(queueCommand(w,{actorId:'hero',kind:'ability',payload:{abilityId:'throw_pilum',targetId:'r'}}).ok);
  // Interrupted before release: nothing spent.
  step(w);step(w);assert.equal(hero.action?.kind,'throw');queueCommand(w,{actorId:'hero',kind:'move',payload:{x:3,z:15}});step(w);
  assert.equal(hero.ammo.pilum,before,'an interrupted cast spends no pilum');
  queueCommand(w,{actorId:'hero',kind:'ability',payload:{abilityId:'throw_pilum',targetId:'r'}});
  let thrown=false;for(let i=0;i<40&&!thrown;i++){step(w);thrown=w.events.some(e=>e.kind==='throw');}
  assert.ok(thrown);assert.equal(hero.ammo.pilum,before-1,'spent at release');
  hero.ammo.pilum=0;assert.equal(validate(w,'hero','throw_pilum',{actorId:'r'}),'NO_AMMO');
  assert.equal(forecast(w,'hero','throw_pilum',{actorId:'r'}).reason,'NO_AMMO');
});

test('a blocked pilum sticks in the shield and halves its block for the rest of the fight',()=>{
  let stuck=null;
  for(let seed=1;seed<300&&!stuck;seed++){
    const w=duel({seed,bAt:[14,16],b:raider({kit:['tunic','jerkin','round_shield','spear']})});
    queueCommand(w,{actorId:'hero',kind:'ability',payload:{abilityId:'throw_pilum',targetId:'r'}});
    for(let i=0;i<80;i++){step(w);if(w.events.some(e=>e.kind==='stuck')){stuck=w;break;}}
  }
  assert.ok(stuck,'some throw was blocked');const r=by(stuck,'r');assert.equal(r.shieldStuck,true);
  assert.equal(blowSetup(stuck,by(stuck,'hero'),r).block,.1);
});

test('named random streams are independent: an extra AI draw never shifts a combat roll',()=>{
  const a=splitStreams(42),b=splitStreams(42);
  for(let i=0;i<50;i++)nextRandom(b,'ai');
  for(let i=0;i<100;i++)assert.equal(randomInt(a,'combat',0,39),randomInt(b,'combat',0,39));
  assert.notEqual(splitStreams(42).combat,splitStreams(42).ai);assert.notEqual(splitStreams(42).combat,splitStreams(43).combat);
});

test('a forecast never changes the world',()=>{
  const w=createArenaWorld(map,{seed:7}),hash=worldHash(w);
  for(const e of w.actors.filter(a=>a.side==='enemy'))for(const ability of ['strike','throw_pilum'])forecast(w,'hero',ability,{actorId:e.id});
  forecast(w,'hero','brace',{});assert.equal(worldHash(w),hash);
});

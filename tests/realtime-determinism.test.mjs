import test from 'node:test';
import assert from 'node:assert/strict';
import {createShowcaseSession} from '../src/showcase/session.js';
import {createArenaWorld} from '../src/core/realtime/arena.js';
import {queueCommand,restoreWorld,snapshotWorld,step,worldHash} from '../src/core/realtime/simulation.js';
import {advanceClock,createClock,hurryClock,setPaused,setSlow,setSpeed,stepRound} from '../src/core/realtime/clock.js';
import {TIME} from '../src/data/realtime-rules.js';

// Brief §5 A1–A4: time and determinism. The arena is the Phase 0 world; its
// map comes from the campaign's own frontier-road encounter.
const map=createShowcaseSession().encounter,SEED=0x5eed1234,TICKS=900;
// A test-local generator for frame times and pauses (never Math.random).
function testRandom(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1103515245)+12345)>>>0;return s/4294967296;};}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

// A scripted player: pila first, then auto-fight, a brace when hurt, and a
// step aside now and then. It issues commands only through the queue.
function player(world){
  const hero=world.actors.find(a=>a.id==='hero'),enemies=world.actors.filter(a=>a.side==='enemy'&&a.alive);
  if(!hero.alive||!enemies.length||world.status!=='active')return null;
  const nearest=[...enemies].sort((a,b)=>dist(a,hero)-dist(b,hero))[0];
  if(world.tick%97===13&&hero.stamina>=15&&hero.hp<hero.maxHp*.7)return {actorId:'hero',kind:'ability',payload:{abilityId:'brace'}};
  if(world.tick%151===40)return {actorId:'hero',kind:'move',payload:{x:hero.x-1.5,z:hero.z+.8}};
  if(hero.ammo.pilum>0&&dist(nearest,hero)>6&&!hero.action&&hero.order?.kind!=='ability')
    return {actorId:'hero',kind:'ability',payload:{abilityId:'throw_pilum',targetId:nearest.id}};
  if(!hero.lock&&hero.order?.kind!=='ability')return {actorId:'hero',kind:'attack',payload:{targetId:nearest.id}};
  return null;
}
// The reference run: the command log (as queued, with its tick) and the final hash.
function reference(){
  const world=createArenaWorld(map,{seed:SEED}),log=[];
  queueCommand(world,{actorId:'hero',kind:'setDrawn',payload:{drawn:true}});log.push({tick:0,actorId:'hero',kind:'setDrawn',payload:{drawn:true}});
  while(world.tick<TICKS){
    const command=player(world);if(command&&queueCommand(world,command).ok)log.push({tick:world.tick,...command});step(world);
  }
  return {log,hash:worldHash(world),world};
}
const REF=reference();
// Replay a log through the fixed-step clock with arbitrary frames, speeds and pauses.
function replay(log,{speed=1,seed=1,pauses=true,until=TICKS,world=createArenaWorld(map,{seed:SEED})}={}){
  const clock=createClock({speed}),rand=testRandom(seed);let next=log.findIndex(c=>c.tick>=world.tick);if(next<0)next=log.length;
  while(world.tick<until){
    if(pauses&&rand()<.08)setPaused(clock,!clock.paused);
    if(pauses&&rand()<.03)setSlow(clock,!clock.slow);
    if(clock.paused&&rand()<.25)setPaused(clock,false);
    const ticks=advanceClock(clock,4+rand()*60);
    for(let i=0;i<ticks&&world.tick<until;i++){
      while(next<log.length&&log[next].tick===world.tick){const {tick,...command}=log[next++];assert.ok(queueCommand(world,command).ok);}
      step(world);
    }
  }
  return world;
}

test('A1: the same seed and command log give the same world hash at any speed, with pauses and slow time (100 runs)',()=>{
  assert.ok(REF.log.length>=6,'the scripted player gave orders');
  assert.ok(REF.world.log.some(l=>/hits/.test(l.text)),'blows were struck');
  for(let run=0;run<100;run++){
    const speed=TIME.speeds[run%3],world=replay(REF.log,{speed,seed:run+1});
    assert.equal(worldHash(world),REF.hash,`run ${run} at ${speed*100}%`);
  }
});

test('A2: saving at any tick, loading and continuing gives the uninterrupted hash (50 runs)',()=>{
  const rand=testRandom(77);
  for(let run=0;run<50;run++){
    const at=Math.floor(rand()*TICKS),first=replay(REF.log,{seed:run+500,until:at,pauses:false});
    const saved=snapshotWorld(first),loaded=restoreWorld(saved);
    assert.equal(worldHash(loaded),worldHash(first),'the snapshot restores exactly');
    const done=replay(REF.log,{seed:run+900,world:loaded,speed:TIME.speeds[run%3]});
    assert.equal(worldHash(done),REF.hash,`saved at tick ${at}`);
  }
});

test('A2: a snapshot keeps queued commands and every random stream',()=>{
  const world=createArenaWorld(map,{seed:SEED});
  for(let i=0;i<30;i++)step(world);
  assert.ok(queueCommand(world,{actorId:'hero',kind:'move',payload:{x:6,z:12}}).ok);
  const copy=restoreWorld(snapshotWorld(world));
  assert.deepEqual(copy.queue,world.queue);assert.deepEqual(copy.rng,world.rng);
  for(let i=0;i<200;i++){step(world);step(copy);}
  assert.equal(worldHash(copy),worldHash(world));
});

test('A3: while paused no ticks run, commands queue with the latest per actor winning, and apply on the first tick after resume',()=>{
  const world=createArenaWorld(map,{seed:SEED}),clock=createClock();
  for(let i=0;i<5;i++)step(world);
  setPaused(clock,true);const before=world.tick;
  for(let frame=0;frame<120;frame++)assert.equal(advanceClock(clock,16.7),0,'no tick while paused');
  assert.equal(world.tick,before);
  assert.ok(queueCommand(world,{actorId:'hero',kind:'move',payload:{x:5,z:5}}).ok);
  assert.ok(queueCommand(world,{actorId:'hero',kind:'move',payload:{x:4,z:14}}).ok);
  assert.ok(queueCommand(world,{actorId:'hero',kind:'attack',payload:{targetId:'raider-axe'}}).ok);
  assert.ok(queueCommand(world,{actorId:'hero',kind:'setWalk',payload:{walk:true}}).ok);
  assert.deepEqual(world.queue.map(c=>c.kind),['attack','setWalk'],'only the latest order stays queued; other kinds keep their own place');
  setPaused(clock,false);const ticks=advanceClock(clock,16.7);assert.ok(ticks>=1,'the first frame after resume runs a tick');
  step(world);
  const hero=world.actors.find(a=>a.id==='hero');
  assert.equal(hero.order.kind,'attack');assert.equal(hero.lock,'raider-axe');assert.equal(hero.walkMode,true);assert.equal(world.queue.length,0);
});

test('A4: N while paused plays exactly one round (200 ticks), then the world is paused again',()=>{
  for(const speed of TIME.speeds)for(const slow of [false,true]){
    const clock=createClock({speed,paused:true});setSlow(clock,slow);
    assert.equal(stepRound(clock),true);let total=0;
    for(let frame=0;frame<4000&&clock.stepTicks>0;frame++)total+=advanceClock(clock,16.7+frame%7);
    assert.equal(total,TIME.roundTicks,`${speed} ${slow}`);assert.equal(clock.paused,true);
    for(let frame=0;frame<30;frame++)assert.equal(advanceClock(clock,50),0);
  }
  const running=createClock();assert.equal(stepRound(running),false,'step only while paused');
});

test('game speed and slow time change only the ticks per real second',()=>{
  const ticksIn=(speed,slow)=>{const c=createClock({speed});setSlow(c,slow);let n=0;for(let i=0;i<600;i++)n+=advanceClock(c,1000/60);return n;};
  assert.equal(ticksIn(1,false),200);assert.equal(ticksIn(.75,false),150);assert.equal(ticksIn(.5,false),100);assert.equal(ticksIn(1,true),100);
  const c=createClock();setSpeed(c,3);assert.equal(c.speed,1,'only the listed speeds');
  assert.equal(advanceClock(createClock(),60000),TIME.maxFrameMs/TIME.tickMs,'a long frame runs at most maxFrameMs');
});

test('invalid commands change nothing, the random streams included',()=>{
  const world=createArenaWorld(map,{seed:SEED}),hash=worldHash(world);
  for(const command of [{actorId:'raider-axe',kind:'move',payload:{x:1,z:1}},{actorId:'hero',kind:'attack',payload:{targetId:'nobody'}},
    {actorId:'hero',kind:'ability',payload:{abilityId:'throw_pilum',targetId:'hero'}},{actorId:'hero',kind:'ability',payload:{abilityId:'throw_javelin',targetId:'raider-axe'}},
    {actorId:'hero',kind:'move',payload:{x:NaN,z:1}},{actorId:'hero',kind:'fly',payload:{}}]){
    const r=queueCommand(world,command);assert.equal(r.ok,false,JSON.stringify(command));assert.ok(r.reason);
  }
  assert.equal(worldHash(world),hash);
});

test('a command hurries its tick to the next frame without changing the pace over time',()=>{
  const c=createClock();assert.equal(advanceClock(c,10),0);assert.equal(hurryClock(c),true);assert.equal(advanceClock(c,1),1,'the next frame runs the tick');
  assert.equal(hurryClock(c),false,'one tick at most is owed');
  const steady=createClock(),hurried=createClock();let a=0,b=0;
  for(let frame=0;frame<6000;frame++){a+=advanceClock(steady,1000/60);if(frame%7===0)hurryClock(hurried);b+=advanceClock(hurried,1000/60);}
  assert.ok(Math.abs(a-b)<=1,`${a} ticks steady, ${b} hurried`);assert.equal(a,2000);
  const paused=createClock({paused:true});assert.equal(hurryClock(paused),false,'a paused world is never hurried');
});

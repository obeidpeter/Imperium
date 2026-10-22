import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,queueCommand,restoreWorld,snapshotWorld,step,worldHash} from '../src/core/realtime/simulation.js';
import {moveActors} from '../src/core/realtime/motion.js';
import {navGrid,walkable} from '../src/core/realtime/navigation.js';

const map={id:'separation-fixture',width:8,height:8,terrain:Array.from({length:8},()=>Array(8).fill('grass'))};
const actor=(id,x,z)=>({id,name:id,side:'player',role:'soldier',path:'legionary',kit:['tunic','gladius'],at:[x,z],face:[1,0]});
const world=actors=>createWorld({map,seed:37,kind:'camp',actors,party:actors.map(a=>a.id).filter(id=>id!=='hero')});
const minimum=w=>Math.min(...w.actors.flatMap((a,i)=>w.actors.slice(i+1).map(b=>Math.hypot(a.x-b.x,a.z-b.z))));

test('crowded formation crossings relax within one tick without changing combat or random state',()=>{
  // Collision fixture, not an earned campaign checkpoint.
  const w=world([actor('hero',6,6),actor('one',6.35,6),actor('two',6,6.35),actor('three',6.35,6.35)]);
  const before=w.actors.map(a=>({hp:a.hp,sta:a.stamina,ready:a.readyAt})),rng=JSON.stringify(w.rng);
  moveActors(w);
  assert.ok(minimum(w)>.68,`centres remain ${minimum(w)} m apart`);
  assert.deepEqual(w.actors.map(a=>({hp:a.hp,sta:a.stamina,ready:a.readyAt})),before);
  assert.equal(JSON.stringify(w.rng),rng);
});

test('a free body takes the blocked share at both map edges and solid walls',()=>{
  for(const wall of [false,true]){
    const w=world([actor('hero',wall?5.55:.35,6),actor('one',wall?5.65:.45,6)]);
    if(wall)for(const row of w.map.terrain){row[0]='rock';row[1]='rock';}
    const fixed=w.actors[0].x;
    moveActors(w);
    assert.ok(minimum(w)>=.7-1e-8,`wall=${wall}: ${minimum(w)} m apart`);
    assert.equal(w.actors[0].x,fixed,'the blocked body does not enter the wall or leave the map');
    assert.ok(w.actors.every(a=>walkable(navGrid(w.map),a.x,a.z)));
  }
});

test('crowd separation ignores fallen and carried bodies',()=>{
  const w=world([actor('hero',6,6),actor('fallen',6,6),actor('carried',6,6)]);
  w.actors[1].down=true;w.actors[2].carriedBy='hero';
  moveActors(w);assert.equal(w.actors[0].x,6);assert.equal(w.actors[0].z,6);
});

test('a carried survivor follows the final bearer position after crowd correction',()=>{
  const w=world([actor('hero',.45,6),actor('blocker',.35,6),actor('survivor',.45,6)]);
  const [bearer,,carried]=w.actors;bearer.carrying=carried.id;carried.carriedBy=bearer.id;
  moveActors(w);assert.ok(bearer.x>.45);
  assert.equal(carried.x,bearer.x-bearer.fx*.3);assert.equal(carried.z,bearer.z-bearer.fz*.3);
  assert.equal(carried.fx,bearer.fx);assert.equal(carried.fz,bearer.fz);
});

test('dense movement replays identically and resumes exactly after a crowded mid-move save',()=>{
  const start=world(Array.from({length:12},(_,i)=>actor(i?'friend'+i:'hero',5+(i%4)*.55,5+Math.floor(i/4)*.55)));
  const play=(w,from,to)=>{for(let tick=from;tick<to;tick++){
    if(tick===0||tick===30)for(const a of w.actors)assert.ok(queueCommand(w,{actorId:a.id,kind:'move',payload:{x:tick?5:8,z:tick?5:8}}).ok);
    step(w);
  }return w;};
  const uninterrupted=play(restoreWorld(snapshotWorld(start)),0,80);
  const repeated=play(restoreWorld(snapshotWorld(start)),0,80);
  const partial=play(restoreWorld(snapshotWorld(start)),0,20),saved=snapshotWorld(partial),resumed=restoreWorld(saved);
  assert.equal(worldHash(partial),worldHash(resumed));
  play(resumed,20,80);
  assert.equal(worldHash(repeated),worldHash(uninterrupted));
  assert.equal(worldHash(resumed),worldHash(uninterrupted));
  assert.ok(resumed.actors.every(a=>walkable(navGrid(resumed.map),a.x,a.z)));
});

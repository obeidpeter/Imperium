import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceStageActor} from '../src/showcase/actor-replacement.js';
test('A failed quality rebuild retains the old figure and disposes an incomplete replacement',()=>{
  const old={group:{},dispose(){throw Error('Old figure must survive');}},actors=new Map([['hero',old]]),scene={add(){},remove(){throw Error('Old figure must stay mounted');}};
  assert.throws(()=>replaceStageActor({actors,id:'hero',scene,create:()=>{throw Error('Build failed');},prepare(){}}),/Build failed/);assert.equal(actors.get('hero'),old);
  let disposed=0;assert.throws(()=>replaceStageActor({actors,id:'hero',scene,create:()=>({group:{},dispose(){disposed++;}}),prepare(){throw Error('Formation failed');}}),/Formation failed/);
  assert.equal(disposed,1);assert.equal(actors.get('hero'),old);
});
test('Successful replacement mounts and publishes the new figure before retiring the old one',()=>{
  const events=[],old={group:{id:'old'},dispose(){assert.equal(actors.get('hero'),candidate);events.push('dispose old');}},candidate={group:{id:'new'},dispose(){throw Error('New actor survives');}},actors=new Map([['hero',old]]);
  const scene={add(g){assert.equal(g,candidate.group);assert.equal(actors.get('hero'),old);events.push('mount');},remove(g){assert.equal(g,old.group);events.push('remove old');}};
  assert.equal(replaceStageActor({actors,id:'hero',scene,create:()=>candidate,prepare(){events.push('prepare');}}),candidate);
  assert.deepEqual(events,['prepare','mount','remove old','dispose old']);
});

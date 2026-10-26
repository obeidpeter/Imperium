import test from 'node:test';
import assert from 'node:assert/strict';
import {actorPose,ACTOR_TIMING,horsePose} from '../src/showcase/actor-pose.js';
import {createMassedSoldierGeometry,crowdBreathing} from '../src/showcase/environment-finale.js';
import {ceremonyScene} from '../src/showcase/ceremony.js';
import {getSceneProfile} from '../src/showcase/campaign-scene-profile.js';

test('performance variants preserve exact action endpoints and authoritative contacts',()=>{
  for(const motion of ['attack','strike','throw'])for(const phase of [0,motion==='throw'?ACTOR_TIMING.release:ACTOR_TIMING.contact,1]){
    const original=actorPose({motion,phase,variant:1});for(const variant of [0,2,91])assert.deepEqual(actorPose({motion,phase,variant}),original);
  }
  assert.notDeepEqual(actorPose({motion:'attack',phase:.22,variant:0}),actorPose({motion:'attack',phase:.22,variant:2}));
});
test('injury and morale change bearing without slipping feet or changing combat reach',()=>{
  for(const motion of ['idle','walk','run','retreat']){
    const input={motion,phase:.24,locomotionDistance:.5},steady=actorPose(input),hurt=actorPose({...input,health:.2,morale:.2});
    assert.notEqual(hurt.bodyX,steady.bodyX);assert.deepEqual(hurt.feet,steady.feet);assert.equal(hurt.yaw,steady.yaw);
  }
  for(const motion of ['attack','throw','block'])assert.deepEqual(actorPose({motion,phase:.37,health:.2,morale:.1}),actorPose({motion,phase:.37}));
});
test('horse fast gait is asymmetric while keeping all four hoof targets and rider attachment',()=>{
  const p=horsePose({motion:'run',locomotionDistance:.44});assert.notEqual(p.feet[0].z-.54,p.feet[1].z-.54);assert.equal(p.riderBob,p.bodyY-1.04);
  assert.ok(p.feet.every(f=>f.y>=.075));assert.ok(p.legs.every(l=>Object.values(l).every(Number.isFinite)));
});
test('finale crowd uses generated legionary silhouettes with a bounded Performance tier and planted soles',()=>{
  const near=createMassedSoldierGeometry(),far=createMassedSoldierGeometry({detail:'distant'});
  assert.ok(near.index.count/3<=1000);assert.ok(far.index.count/3<=150);assert.ok(far.attributes.color.count>0);
  assert.equal(near.userData.crowdSource.path,'assets/models/characters/roman-legionary.glb');
  for(const time of [0,.3,4,70])assert.deepEqual(crowdBreathing(time,2,.5),{x:0,z:0,y:0});
  assert.notDeepEqual(crowdBreathing(1,0,1.5),crowdBreathing(1,3,1.5));near.dispose();far.dispose();
});
test('oath and accession have separate parade and Roman court settings with preserved personal appearance',()=>{
  const appearance={hair:1,beard:2,tunic:2,cloak:3},before=JSON.stringify(appearance),oath=ceremonyScene('oath',{appearance}),accession=ceremonyScene('accession',{appearance});
  assert.equal(oath.encounter.ceremony,'oath');assert.equal(accession.encounter.ceremony,'accession');assert.equal(getSceneProfile(accession.encounter,{chapter:12}).architecture,'imperial-court');
  assert.equal(getSceneProfile(accession.encounter,{chapter:12}).civic,false);assert.equal(getSceneProfile(oath.encounter,{chapter:1}).architecture,'fort');
  assert.deepEqual(accession.encounter.units.find(u=>u.id==='hero').appearance,appearance);assert.equal(JSON.stringify(appearance),before);
});

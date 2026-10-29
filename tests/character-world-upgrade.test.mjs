import test from 'node:test';
import assert from 'node:assert/strict';
import {actorPose,ACTOR_TIMING,horsePose} from '../src/showcase/actor-pose.js';
import {createMassedSoldierGeometry,crowdClip,crowdFrame,crowdJointTransform} from '../src/showcase/environment-finale.js';
import {FINALE_CROWD_CLIPS} from '../src/showcase/finale-crowd-data.js';
import {ceremonyScene} from '../src/showcase/ceremony.js';
import {getSceneProfile} from '../src/showcase/campaign-scene-profile.js';

test('performance variants preserve exact action endpoints and authoritative contacts',()=>{
  for(const motion of ['attack','strike','throw'])for(const phase of [0,motion==='throw'?ACTOR_TIMING.release:ACTOR_TIMING.contact,1]){
    const original=actorPose({motion,phase,variant:1});for(const variant of [0,2,91])assert.deepEqual(actorPose({motion,phase,variant}),original);
  }
  assert.notDeepEqual(actorPose({motion:'attack',phase:.22,variant:0}),actorPose({motion:'attack',phase:.22,variant:2}));
});
test('injury changes gait support while morale preserves feet and combat reach is unchanged',()=>{
  for(const motion of ['idle','walk','run','retreat']){
    const input={motion,phase:.24,locomotionDistance:.5},steady=actorPose(input),hurt=actorPose({...input,health:.2,morale:.2});
    assert.notEqual(hurt.bodyX,steady.bodyX);if(motion==='idle')assert.deepEqual(hurt.feet,steady.feet);else assert.notDeepEqual(hurt.feet,steady.feet);assert.equal(hurt.yaw,steady.yaw);
    assert.deepEqual(actorPose({...input,morale:.2}).feet,steady.feet);
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
  for(const g of [near,far]){const w=g.attributes.crowdWeight,j=g.attributes.crowdJoint;assert.equal(w.count,g.attributes.position.count);
    for(let i=0;i<w.count;i++){assert.ok(Math.abs(w.getX(i)+w.getY(i)-1)<1e-3,'Weights sum to one');assert.ok(j.getX(i)>=0&&j.getX(i)<FINALE_CROWD_CLIPS.joints&&j.getY(i)>=0&&j.getY(i)<FINALE_CROWD_CLIPS.joints);}}
  near.dispose();far.dispose();
});
test('finale crowd moves in the game\'s own baked clips: soles planted, heads turning, now and then a raised spear',()=>{
  const rotate=([x,y,z,w],[vx,vy,vz])=>{const tx=2*(y*vz-z*vy),ty=2*(z*vx-x*vz),tz=2*(x*vy-y*vx);return [vx+w*tx+(y*tz-z*ty),vy+w*ty+(z*tx-x*tz),vz+w*tz+(x*ty-y*tx)];};
  const apply=(clip,frame,joint,p)=>{const {quaternion,translation}=crowdJointTransform(clip,frame,joint),r=rotate(quaternion,p);return r.map((v,i)=>v+translation[i]);};
  const joint=name=>FINALE_CROWD_CLIPS.jointNames.indexOf(name),ANKLE=joint('right-ankle'),HEAD=joint('head'),HAND=joint('right-hand'),SPEAR=joint('spear');
  const heel=[-.104,.03,-.04],nose=[0,1.62,.09],grip=FINALE_CROWD_CLIPS.grip,butt=[grip[0],.04,grip[2]];
  let turn=0,lift=0;const planted=apply('stand',0,ANKLE,heel);assert.ok(planted[1]>-.03&&planted[1]<.08,'the heel stands on the ground');
  for(let f=0;f<24;f++){
    for(const clip of ['stand','cheer']){const p=apply(clip,f,ANKLE,heel);assert.ok(Math.hypot(p[0]-planted[0],p[1]-planted[1],p[2]-planted[2])<.002,`${clip} ${f}: the sole stays planted`);
      // The spear never tilts, and its shaft runs through the hand's grip.
      const {quaternion}=crowdJointTransform(clip,f,SPEAR),hand=apply(clip,f,HAND,grip),foot=apply(clip,f,SPEAR,butt);assert.deepEqual(quaternion,[0,0,0,1],`${clip} ${f}: the spear stands upright`);
      assert.ok(Math.hypot(hand[0]-foot[0],hand[2]-foot[2])<.005&&hand[1]>foot[1],`${clip} ${f}: the hand holds the shaft`);
      if(clip==='stand')assert.ok(Math.abs(foot[1]-butt[1])<.01,`stand ${f}: the spear's butt stays on the ground`);else lift=Math.max(lift,foot[1]-butt[1]);}
    turn=Math.max(turn,Math.abs(apply('stand',f,HEAD,nose)[0]-nose[0]));
  }
  assert.ok(turn>.01,`the head turns (${turn.toFixed(3)} m)`);assert.ok(lift>.6,`the cheer raises the spear (${lift.toFixed(2)} m)`);
  const places=Array.from({length:600},(_,i)=>crowdClip(i*.92,(i%7)*1.05)),cheer=places.filter(p=>p.clip==='cheer').length/places.length;
  assert.ok(cheer>.1&&cheer<.25,`about one in six cheers (${cheer.toFixed(2)})`);
  assert.deepEqual(crowdFrame(3.3,4,5),crowdFrame(3.3,4,5),'deterministic');assert.notDeepEqual(crowdFrame(3.3,4,5),crowdFrame(3.3,9,5),'each man at his own moment');
  for(const t of [0,1.7,4.79,700]){const f=crowdFrame(t,2,3);assert.ok(f.from>=0&&f.from<24&&f.to===(f.from+1)%24&&f.blend>=0&&f.blend<1);}
});
test('oath and accession have separate parade and Roman court settings with preserved personal appearance',()=>{
  const appearance={hair:1,beard:2,tunic:2,cloak:3},before=JSON.stringify(appearance),oath=ceremonyScene('oath',{appearance}),accession=ceremonyScene('accession',{appearance});
  assert.equal(oath.encounter.ceremony,'oath');assert.equal(accession.encounter.ceremony,'accession');assert.equal(getSceneProfile(accession.encounter,{chapter:12}).architecture,'imperial-court');
  assert.equal(getSceneProfile(accession.encounter,{chapter:12}).civic,false);assert.equal(getSceneProfile(oath.encounter,{chapter:1}).architecture,'fort');
  assert.deepEqual(accession.encounter.units.find(u=>u.id==='hero').appearance,appearance);assert.equal(JSON.stringify(appearance),before);
});

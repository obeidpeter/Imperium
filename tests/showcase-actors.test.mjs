import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {actorPose,createActor} from '../src/showcase/actors.js';

const motions=['idle','walk','run','retreat','attack','throw','brace','hit','rally','withdrawn'];
test('3D action poses are finite, deterministic and reset without retaining a previous animation',()=>{
  for(const motion of motions)for(const phase of [0,.15,.3,.5,.7,1]){
    const input={motion,phase,time:3.4,direction:1.2,health:.8};
    assert.deepEqual(actorPose(input),actorPose(input));
    const numbers=value=>typeof value==='number'?[value]:value&&typeof value==='object'?Object.values(value).flatMap(numbers):[];
    assert.ok(numbers(actorPose(input)).every(Number.isFinite),`${motion}/${phase}`);
  }
  assert.ok(Number.isFinite(actorPose({phase:NaN,time:Infinity,direction:NaN}).yaw));
  assert.notDeepEqual(actorPose({motion:'attack',phase:.2}),actorPose({motion:'attack',phase:.48}));
  assert.ok(actorPose({motion:'attack',phase:1}).rightArm.every((n,i)=>n===actorPose().rightArm[i]));
});

test('Foot IK reaches its sole targets and stance gait counters exactly .72m world travel per cycle',()=>{
  for(const motion of ['idle','walk','run','brace','attack','hit'])for(const phase of [0,.1,.25,.45,.65,.85,1]){
    const p=actorPose({motion,phase});
    for(let i=0;i<2;i++){
      const leg=p.legs[i],y=p.hipY-.43*Math.cos(leg.thigh)-.43*Math.cos(leg.thigh+leg.knee),z=p.hipZ-.43*Math.sin(leg.thigh)-.43*Math.sin(leg.thigh+leg.knee);
      assert.ok(Math.abs(y-p.feet[i].y)<1e-6,`${motion}/${phase} ankle height`);
      assert.ok(Math.abs(z-p.feet[i].z)<1e-6,`${motion}/${phase} ankle travel`);
    }
  }
  const a=actorPose({motion:'walk',phase:.1}),b=actorPose({motion:'walk',phase:.5});
  assert.ok(Math.abs((.5-.1)*.72+b.feet[0].z-a.feet[0].z)<1e-9);
  assert.equal(a.feet[0].y,.07);assert.equal(b.feet[0].y,.07);
});

test('Every unit is an articulated mesh rig with bounded draw calls, correct role equipment and no game mutation',()=>{
  for(const unit of [{id:'hero',side:'player'},{id:'ally0',side:'ally'},{id:'enemy0',side:'enemy'},{id:'bow',side:'enemy',role:'archer'}]){
    Object.freeze(unit);const a=createActor(unit),names=[],meshes=[];a.group.traverse(o=>{names.push(o.name);if(o.isMesh)meshes.push(o);assert.ok(!o.isSprite);});
    assert.ok(meshes.length<=50,`${unit.id} rigid detail batches: ${meshes.length}`);
    assert.ok(names.includes('head')&&names.includes('left-thigh')&&names.includes('right-shoulder'));
    assert.equal(names.includes('bow'),unit.role==='archer');assert.equal(names.includes('oval-shield'),unit.role!=='archer');
    for(const mesh of meshes)assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));
    a.group.position.set(4,2,-3);
    for(const motion of motions){a.update({motion,phase:.45,time:1,direction:.8,health:1,selected:true});assert.deepEqual(a.group.position.toArray(),[4,2,-3]);a.group.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));}
    a.update({motion:'idle',direction:0});const bound=new T.Box3().setFromObject(a.group);assert.ok(bound.min.y>=1.99,'Feet and equipment stay above the caller ground.');
    a.dispose();a.dispose();
  }
});

test('Bowman draw and release move real string/arrow meshes; disposal releases each live resource once',()=>{
  const a=createActor({id:'bow',side:'enemy',role:'archer'}),arrow=a.group.getObjectByName('nocked-arrow'),bow=a.group.getObjectByName('bow');
  const line=bow.children.find(o=>o.isLine);a.update({motion:'throw',phase:.3});const draw=line.geometry.attributes.position.getZ(1);assert.ok(draw<-.2);assert.equal(arrow.visible,true);
  a.update({motion:'throw',phase:.7});assert.ok(line.geometry.attributes.position.getZ(1)>draw);assert.equal(arrow.visible,false);
  const resources=new Set();a.group.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});let disposed=0;for(const r of resources)r.addEventListener('dispose',()=>disposed++);
  a.dispose();assert.equal(disposed,resources.size);a.dispose();assert.equal(disposed,resources.size);
});

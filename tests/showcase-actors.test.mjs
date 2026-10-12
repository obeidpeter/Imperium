import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {actorPose,createActor} from '../src/showcase/actors.js';
import * as Game from '../src/core/game.js';

const visibleBounds=group=>{const box=new T.Box3();group.updateMatrixWorld(true);group.traverseVisible(o=>{if(o.isMesh){o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});return box;};

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
    Object.freeze(unit);const a=createActor(unit),names=[],meshes=[];a.group.traverse(o=>{names.push(o.name);assert.ok(!o.isSprite);if(o.isMesh)assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));});a.group.traverseVisible(o=>{if(o.isMesh)meshes.push(o);});
    assert.ok(meshes.length<=50,`${unit.id} rigid detail batches: ${meshes.length}`);
    assert.ok(names.includes('head')&&names.includes('left-thigh')&&names.includes('right-shoulder'));
    assert.equal(names.includes('bow'),unit.role==='archer');assert.equal(names.includes('oval-shield'),unit.role!=='archer');
    for(const mesh of meshes)assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));
    a.group.position.set(4,2,-3);
    for(const motion of motions){a.update({motion,phase:.45,time:1,direction:.8,health:1,selected:true});assert.deepEqual(a.group.position.toArray(),[4,2,-3]);a.group.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));}
    a.update({motion:'idle',direction:0});const bound=visibleBounds(a.group);assert.ok(bound.min.y>=1.99,'Visible feet and equipment stay above the caller ground; stowed equipment is intentionally excluded.');
    a.dispose();a.dispose();
  }
});

test('Legal drill partner has Roman training equipment and adult visible anatomy',()=>{
  const s=Game.newGame();assert.ok(Game.choose(s,'report').ok);assert.ok(Game.startEncounter(s).ok);
  const trainer=s.encounter.units.find(u=>u.role==='trainer'),before=Game.serialize(s);assert.ok(trainer);
  const a=createActor(trainer);assert.equal(a.group.userData.actor.role,'trainer');
  assert.ok(a.group.getObjectByName('practice-sword'));assert.equal(a.group.getObjectByName('spear'),undefined);
  const b=visibleBounds(a.group),size=b.getSize(new T.Vector3());assert.ok(size.y>1.72&&size.y<1.90);
  const left=a.group.getObjectByName('left-shoulder'),right=a.group.getObjectByName('right-shoulder');assert.ok(left.position.x-right.position.x>=.47);
  assert.ok(size.x<1,'The human and worn shield do not have oversized toy proportions.');
  assert.equal(Game.serialize(s),before);a.dispose();
});

test('Native cloth, leather and mail surfaces are deterministic, bounded, mapped and released',()=>{
  const a=createActor({id:'ally0',side:'ally'}),b=createActor({id:'ally0',side:'ally'}),surfaces=actor=>{const m=new Map();actor.group.traverse(o=>{if(o.material?.name)m.set(o.material.name,o.material);});return m;};
  const first=surfaces(a),second=surfaces(b),textures=new Set();
  for(const name of ['woven tunic','worked leather','painted wooden shield','interlinked mail']){
    const material=first.get(name);assert.ok(material?.map&&material.bumpMap&&material.roughnessMap,name);
    for(const key of ['map','bumpMap','roughnessMap']){
      const t=material[key],data=t.image;assert.equal(data.width,96);assert.equal(data.height,96);assert.equal(data.data.length,96*96*4);
      assert.deepEqual(data.data,second.get(name)[key].image.data);assert.equal(t,second.get(name)[key],'Immutable tiles are shared between actors.');assert.ok(new Set(data.data).size>8,'Surface is substantive rather than a flat texture.');textures.add(t);
    }
  }
  let disposed=0;for(const t of textures)t.addEventListener('dispose',()=>disposed++);a.dispose();assert.equal(disposed,0,'Another live actor still owns the shared surface.');b.dispose();assert.equal(disposed,textures.size);b.dispose();assert.equal(disposed,textures.size);
});

test('Attack, hit and rally recover to exact guard; shield impacts are smaller and movement has bounded local root travel',()=>{
  const near=(a,b)=>{if(typeof a==='number')assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);else if(a&&typeof a==='object')for(const key of Object.keys(a))near(a[key],b[key]);else assert.equal(a,b);};
  for(const motion of ['attack','throw','hit','rally']){near(actorPose({motion,phase:0}),actorPose());near(actorPose({motion,phase:1}),actorPose());}
  near(actorPose({motion:'brace',phase:0}),actorPose());near(actorPose({motion:'brace',phase:1}),actorPose({braced:true}));
  near(actorPose({motion:'hit',phase:1,braced:true}),actorPose({braced:true}));
  const block=actorPose({motion:'hit',phase:.25,braced:true}),guard=actorPose({braced:true}),bare=actorPose({motion:'hit',phase:.25});
  assert.ok(Math.abs(block.bodyX-guard.bodyX)<Math.abs(bare.bodyX));assert.ok(block.shieldTilt>guard.shieldTilt);
  for(let i=0;i<=100;i++){const pose=actorPose({motion:'attack',phase:i/100});assert.ok(Math.abs(pose.hipZ)<=.2);}
  near(actorPose({motion:'walk',phase:.39,locomotionWeight:0}),actorPose());
});

test('Throw uses a real javelin until release and restores the sword afterward',()=>{
  const a=createActor({id:'hero',side:'player'}),sword=a.group.getObjectByName('sword'),javelin=a.group.getObjectByName('held-javelin');
  assert.equal(javelin.visible,false);a.update({motion:'throw',phase:.35});assert.equal(javelin.visible,true);assert.equal(sword.visible,false);
  a.update({motion:'throw',phase:.5});assert.equal(javelin.visible,false);assert.equal(sword.visible,false);
  a.update({motion:'idle'});assert.equal(sword.visible,true);assert.equal(javelin.visible,false);a.dispose();
});

test('Bowman draw and release move real string/arrow meshes; disposal releases each live resource once',()=>{
  const a=createActor({id:'bow',side:'enemy',role:'archer'}),arrow=a.group.getObjectByName('nocked-arrow'),bow=a.group.getObjectByName('bow');
  const line=bow.children.find(o=>o.isLine);a.update({motion:'throw',phase:.3});const draw=line.geometry.attributes.position.getZ(1);assert.ok(draw<-.2);assert.equal(arrow.visible,true);
  a.update({motion:'throw',phase:.7});assert.ok(line.geometry.attributes.position.getZ(1)>draw);assert.equal(arrow.visible,false);
  const resources=new Set();a.group.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});let disposed=0;for(const r of resources)r.addEventListener('dispose',()=>disposed++);
  a.dispose();assert.equal(disposed,resources.size);a.dispose();assert.equal(disposed,resources.size);
});

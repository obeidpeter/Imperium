import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {createActor} from '../src/showcase/actors.js';
import {actorPose,horsePose,groundHumanPose,groundHorsePose,createFootPlanting} from '../src/showcase/actor-pose.js';

const measure=actor=>{let draws=0,triangles=0;const bounds=new T.Box3();actor.group.updateMatrixWorld(true);actor.group.traverseVisible(o=>{if(o.isMesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});return {draws,triangles,bounds};};
const point=o=>o.getWorldPosition(new T.Vector3());

test('Overview detail cuts real visible draws/triangles and keeps roles, silhouettes and ray picking',()=>{
  const roles=[{id:'hero',side:'player',role:'soldier'},{id:'officer',side:'player',role:'commander',name:'Rival claimant'},{id:'horse',side:'enemy',role:'cavalry',name:'Persian cavalry'},{id:'voter',side:'neutral',role:'voter'},{id:'bow',side:'enemy',role:'archer'}];
  for(const unit of roles){
    const a=createActor(Object.freeze(unit),{chapter:2}),identity={...a.group.userData.actor};a.update({detailDistance:8});const close=measure(a);a.update({detailDistance:24});const far=measure(a);
    assert.equal(a.group.userData.actor.detail,'overview');assert.ok(far.draws<=close.draws*.78,`${unit.role}: draws ${close.draws} -> ${far.draws}`);assert.ok(far.triangles<close.triangles*.92,`${unit.role}: triangles ${close.triangles} -> ${far.triangles}`);
    assert.ok(close.bounds.getSize(new T.Vector3()).distanceTo(far.bounds.getSize(new T.Vector3()))<.055,'Overview preserves role silhouette.');
    const eye=new T.Vector3(0,unit.role==='cavalry'?1.5:1.1,5),ray=new T.Raycaster(eye,new T.Vector3(0,0,-1)),hits=ray.intersectObject(a.group,true).filter(h=>{for(let p=h.object;p;p=p.parent)if(!p.visible)return false;return true;});assert.ok(hits.length,'Visible overview bodies are actual pickable geometry.');
    const resources=new Set();a.group.traverse(o=>{if(o.geometry)resources.add(o.geometry);});a.update({detailDistance:16});assert.equal(a.group.userData.actor.detail,'overview');a.update({detailDistance:13});assert.equal(a.group.userData.actor.detail,'near');a.update({detailDistance:17});assert.equal(a.group.userData.actor.detail,'near');a.update({detailDistance:24,active:true});assert.equal(a.group.userData.actor.detail,'near');
    a.group.traverse(o=>{if(o.geometry)assert.ok(resources.has(o.geometry),'LOD never rebuilds a rig per frame.');});assert.equal(a.group.userData.actor.role,identity.role);assert.equal(a.group.userData.actor.faction,identity.faction);assert.deepEqual(measure(a),close);a.dispose();
  }
});

test('Terrain IK places human ankles on independently sampled ground, with finite pitch and no root mutation',()=>{
  const ground=(x,z)=>.11*x+.16*z,a=createActor({id:'hero',side:'player'},{chapter:2}),position=new T.Vector3(3,ground(3,2),2);a.group.position.copy(position);
  for(const direction of [0,.4,Math.PI/2,Math.PI]){
    a.update({motion:'idle',direction,groundHeight:ground,resetPose:true});
    for(const name of ['right-thigh','left-thigh']){const ankle=a.group.getObjectByName(name).getObjectByName('ankle'),v=point(ankle);assert.ok(Math.abs(v.y-.07*a.group.scale.y-ground(v.x,v.z))<1e-6,'Ankle clearance matches the sloped ground.');assert.ok(ankle.quaternion.toArray().every(Number.isFinite));}
    assert.deepEqual(a.group.position,position);
  }
  a.update({groundHeight:()=>NaN,direction:Infinity});a.group.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));a.dispose();
});

test('Civic soles stay on the floor through breathing, transition reset and both detail levels',()=>{
  const a=createActor({id:'hero',side:'player',role:'speaker'},{chapter:11});a.group.position.set(2,.018,3);
  for(let frame=0;frame<40;frame++){
    a.update({motion:'idle',time:frame*.11,dt:.11,groundHeight:()=>.018,detailDistance:frame<20?8:30,resetPose:frame===0||frame===20});
    for(const name of ['right-thigh','left-thigh']){const ankle=a.group.getObjectByName(name).getObjectByName('ankle'),box=new T.Box3();ankle.traverseVisible(o=>{if(o.isMesh){o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});assert.ok(Math.abs(box.min.y-.018)<1e-6,'Visible boot sole has no floating gap above the rendered floor.');}
  }
  a.dispose();
});

test('World-space planted feet retain contact across root travel, mild turns and varying root elevation',()=>{
  const ground=(x,z)=>.08*z+.025*x,contacts=createFootPlanting();let first;
  for(let i=0;i<14;i++){
    const phase=.12+i*.025,yaw=i*.004,position={x:0,z:phase*.72,y:ground(0,phase*.72)},pose=actorPose({motion:'walk',phase}),samples=contacts.sample({pose,position,direction:yaw,motion:'walk',phase,groundHeight:ground});
    const foot=samples[0],world={x:Math.cos(yaw)*foot.x+Math.sin(yaw)*foot.z,z:position.z-Math.sin(yaw)*foot.x+Math.cos(yaw)*foot.z};
    if(!first)first=world;assert.ok(Math.hypot(world.x-first.x,world.z-first.z)<1e-9,'Stance foot stays in place instead of sliding with a turn.');assert.ok(Math.abs(foot.height+position.y-ground(world.x,world.z))<1e-9);
  }
  contacts.reset();const pose=actorPose(),position={x:10,y:ground(10,5),z:5},samples=contacts.sample({pose,position,motion:'idle',groundHeight:ground});assert.ok(Math.abs(samples[0].z-pose.feet[0].z)<1e-9,'Reset cannot drag a foot from an old position.');
});

test('All four horse hoof joints meet sloping ground while rider stays seated and quality/LOD do not move feet',()=>{
  const a=createActor({id:'horse',role:'cavalry',name:'Palmyrene cavalry',side:'enemy'},{chapter:9}),ground=(x,z)=>.10*z-.08*x;a.group.position.set(2,ground(2,3),3);
  const feet=()=>['fore-left-leg','fore-right-leg','hind-left-leg','hind-right-leg'].map(n=>point(a.group.getObjectByName(n).getObjectByName('horse-fetlock')));
  a.update({motion:'idle',direction:.6,groundHeight:ground,detailDistance:7,resetPose:true});const near=feet();
  for(const v of near)assert.ok(Math.abs(v.y-.075*a.group.scale.y-ground(v.x,v.z))<1e-6,'Individual hoof elevation follows terrain.');
  a.update({motion:'idle',direction:.6,groundHeight:ground,detailDistance:30});const far=feet();near.forEach((p,i)=>assert.ok(p.distanceTo(far[i])<1e-8));const seated=point(a.group.getObjectByName('hips')).y-point(a.group.getObjectByName('horse-body')).y;assert.ok(seated>.50&&seated<.60,'Rider pelvis retains its saddle offset while the horse fits the slope.');a.dispose();
});

test('Terrain constraints and authored phase endpoints remain finite under bounded steps and malformed samples',()=>{
  for(const motion of ['idle','walk','attack','hit','brace'])for(const phase of [0,.2,.37,.5,.8,1]){
    const human=groundHumanPose(actorPose({motion,phase}),[{height:.2,pitch:.14,bank:-.08},{height:-.14,pitch:.14,bank:-.08}]);const horse=groundHorsePose(horsePose({motion,phase}),Array.from({length:4},(_,i)=>({height:i%2?.18:-.12,pitch:.08})));
    for(const p of [human,horse]){const numbers=v=>typeof v==='number'?[v]:v&&typeof v==='object'?Object.values(v).flatMap(numbers):[];assert.ok(numbers(p).every(Number.isFinite));}
  }
});

test('Interrupted poses blend briefly and resetPose gives an exact seek without leaving stale stance',()=>{
  const a=createActor({id:'hero',side:'player'}),arm=a.group.getObjectByName('right-shoulder');a.update({motion:'attack',phase:.34,resetPose:true});const attack=arm.rotation.x;a.update({motion:'idle',dt:.016});const first=arm.rotation.x;
  assert.ok(Math.abs(first-attack)<Math.abs(-.1-attack)*.15,'Interrupted arm does not snap to guard.');for(let i=0;i<10;i++)a.update({motion:'idle',dt:.016});assert.ok(Math.abs(arm.rotation.x+.1)<1e-8);
  a.update({motion:'attack',phase:.34});a.update({motion:'idle',dt:.016,resetPose:true});assert.ok(Math.abs(arm.rotation.x+.1)<1e-8,'Explicit final-state seek bypasses blending.');a.dispose();
});

test('Release and contact anchors use actual held equipment geometry, independent of detail level',()=>{
  for(const unit of [{id:'hero',side:'player'},{id:'bow',side:'enemy',role:'archer'}]){const a=createActor(unit);a.group.position.set(4,.2,-3);a.update({motion:'throw',phase:.5,direction:.65,detailDistance:7});const near=a.getReleasePoint(new T.Vector3());assert.ok(near.toArray().every(Number.isFinite));assert.ok(near.distanceTo(a.group.position)<2.9&&near.y>a.group.position.y+.8,'Actual raised arm plus held javelin/arrow remains within anatomical equipment reach.');a.update({motion:'throw',phase:.5,direction:.65,detailDistance:30});assert.ok(near.distanceTo(a.getReleasePoint(new T.Vector3()))<1e-8);if(unit.id==='hero'){assert.ok(a.contacts.weapon&&a.contacts.shield);assert.ok(point(a.contacts.weapon).toArray().every(Number.isFinite));}a.dispose();}
});

test('Authored melee contact reaches a torso-height line without enlarging limbs or changing phase timing',()=>{
  const a=createActor({id:'hero',side:'player'}),before=point(a.contacts.weapon);a.update({motion:'attack',phase:230/620});const tip=point(a.contacts.weapon);assert.ok(tip.y>1.15&&tip.y<1.45,'Spatha tip reaches torso/shield height at the shared contact phase.');assert.ok(tip.z>1.15&&tip.z<1.4,'Reach comes from the articulated arm plus existing sword.');assert.ok(Math.abs(tip.x)<.15,'Contact stays close to the forward target line.');assert.notDeepEqual(tip,before);a.update({motion:'attack',phase:1});assert.ok(point(a.contacts.weapon).distanceTo(before)<1e-8);a.dispose();
});

test('Mounted melee aims toward a foot opponent with bounded shoulder rotation and exact recovery',()=>{
  const a=createActor({id:'horse',role:'cavalry',name:'Persian cavalry',side:'enemy'},{chapter:6}),arm=a.group.getObjectByName('right-shoulder'),phase=230/620;
  a.update({motion:'attack',phase});const original=point(a.contacts.weapon),angle=arm.rotation.x;
  a.update({motion:'attack',phase,aimHeight:1.2});const aimed=point(a.contacts.weapon);assert.ok(Math.abs(aimed.y-1.2)<Math.abs(original.y-1.2)*.35,'The real spear moves toward the target body height.');assert.ok(Math.abs(arm.rotation.x-angle)<=.55+1e-8);assert.ok(aimed.z>1.4,'Aimed spear remains forward of the rider.');
  a.update({motion:'attack',phase,aimHeight:-100});assert.ok(Math.abs(arm.rotation.x-angle)<=.55+1e-8,'Out-of-range target cannot produce an extreme joint angle.');
  a.update({motion:'attack',phase:1,aimHeight:1.2});const recovery=point(a.contacts.weapon);a.update({motion:'idle'});assert.ok(point(a.contacts.weapon).distanceTo(recovery)<1e-8);a.dispose();
});

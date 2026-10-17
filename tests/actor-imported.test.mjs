import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {createActorAssetLibrary} from '../src/showcase/actor-assets.js';
import {createActor} from '../src/showcase/actors.js';
import {actorIdentity} from '../src/showcase/actor-identity.js';
import {actorPose,ACTOR_TIMING} from '../src/showcase/actor-pose.js';
const bytes=await fs.readFile(new URL('../assets/models/roman-human-v017.glb',import.meta.url));
const parse=()=>new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const library=createActorAssetLibrary(parse);await library.warm();
const visibleStats=group=>{let draws=0,triangles=0;group.traverseVisible(o=>{if(o.isMesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});return {draws,triangles};};

test('The bundled imported asset parses as genuine indexed weighted glTF with authored anatomy and pinned CC0 provenance',async()=>{
  const gltf=await parse(),skin=gltf.scene.getObjectByName('imported-human-anatomy'),g=skin.geometry;
  assert.ok(skin.isSkinnedMesh);assert.equal(skin.skeleton.bones.length,6);assert.equal(g.index.count/3,9904);assert.equal(g.attributes.position.count,5255);
  for(let i=0;i<g.attributes.position.count;i++){const w=g.attributes.skinWeight;assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-6);assert.ok(Number.isFinite(g.attributes.position.getY(i)));}
  const source=JSON.parse(await fs.readFile(new URL('../vendor/makehuman/source.json',import.meta.url),'utf8'));
  assert.equal(source.license,'CC0-1.0');assert.match(source.commit,/^[a-f0-9]{40}$/);assert.equal(source.files.length,3);
  assert.match(await fs.readFile(new URL('../vendor/makehuman/LICENSE.CC0.md',import.meta.url),'utf8'),/CC0/);
});

test('Imported weighted heads and exposed arms deform with actual joints while foot/equipment anchors stay finite and gameplay stays unchanged',()=>{
  for(const unit of [{id:'hero',side:'player'},{id:'ally0',side:'ally',role:'soldier'},{id:'enemy0',side:'enemy',faction:'Persian',role:'cavalry'},{id:'speaker',side:'player',role:'speaker'}]){
    const before=JSON.stringify(unit),a=createActor(unit,{assetLibrary:library,chapter:unit.role==='cavalry'?5:1});assert.equal(a.group.userData.actor.imported,true);
    const imported=a.group.getObjectByName('imported-anatomy');assert.ok(imported?.isSkinnedMesh);const point=new T.Vector3(),rest=[];
    a.update({motion:'idle',resetPose:true});for(let i=0;i<imported.geometry.attributes.position.count;i+=61){point.fromBufferAttribute(imported.geometry.attributes.position,i);imported.applyBoneTransform(i,point);rest.push(point.clone());}
    a.update({motion:'attack',phase:ACTOR_TIMING.contact,direction:1.2,aimHeight:1.2,resetPose:true});let changedArms=0,armSamples=0,j=0;
    for(let i=0;i<imported.geometry.attributes.position.count;i+=61){point.fromBufferAttribute(imported.geometry.attributes.position,i);imported.applyBoneTransform(i,point);assert.ok(point.toArray().every(Number.isFinite));assert.ok(point.length()<4);const moved=point.distanceTo(rest[j++])>.015;if(imported.geometry.attributes.skinIndex.getX(i)>=2){armSamples++;if(moved)changedArms++;}}
    assert.ok(armSamples>8&&changedArms/armSamples>.6,`${unit.id}: most sampled arm vertices follow the actual speaking or combat gesture.`);
    for(const motion of ['walk','brace','block','throw','hit','yield']){a.update({motion,phase:.35,time:1,direction:-.7,groundHeight:()=>.1,resetPose:true});for(const foot of a.contacts.feet)assert.ok(foot.getWorldPosition(point).toArray().every(Number.isFinite));assert.ok(a.getReleasePoint(point).toArray().every(Number.isFinite));}
    assert.equal(JSON.stringify(unit),before);a.dispose();
  }
});

test('Imported surfaces retain role equipment and lower real overview geometry; disposing one actor leaves another master-derived actor intact',()=>{
  const a=createActor({id:'hero',side:'player'},{assetLibrary:library}),b=createActor({id:'enemy',side:'enemy',role:'archer'},{assetLibrary:library});
  a.update({detailDistance:8});const near=visibleStats(a.group);a.update({detailDistance:40});const far=visibleStats(a.group);assert.ok(far.draws<near.draws);assert.ok(far.triangles<near.triangles*.8);assert.ok(a.group.getObjectByName('sword'));assert.ok(b.group.getObjectByName('bow'));
  const before=Array.from(b.group.getObjectByName('imported-anatomy').geometry.attributes.position.array);a.dispose();a.dispose();b.update({motion:'throw',phase:.49});assert.deepEqual(Array.from(b.group.getObjectByName('imported-anatomy').geometry.attributes.position.array),before);b.dispose();
});

test('Late asset success preserves group placement and contacts; a disposed pending actor cannot resurrect or leak a replacement',async()=>{
  let finish;const delayed=createActorAssetLibrary(()=>new Promise(resolve=>{finish=resolve;})),scene=new T.Group();
  const a=createActor({id:'hero',side:'player'},{assetLibrary:delayed}),dead=createActor({id:'dead',side:'enemy'},{assetLibrary:delayed}),stable=a.group,contacts=a.contacts;scene.add(a.group,dead.group);a.group.position.set(4,.3,-2);a.update({motion:'brace',phase:1,direction:.8});dead.dispose();finish(await parse());
  assert.equal(await a.ready,true);assert.equal(await dead.ready,false);assert.equal(a.group,stable);assert.equal(a.contacts,contacts);assert.deepEqual(a.group.position.toArray(),[4,.3,-2]);assert.equal(scene.children.length,1);assert.equal(a.group.userData.actor.imported,true);assert.ok(a.contacts.weapon.parent);a.dispose();assert.equal(scene.children.length,0);
  const failed=createActorAssetLibrary(async()=>{throw Error('offline asset unavailable');}),fallback=createActor({id:'hero'},{assetLibrary:failed});assert.equal(await fallback.ready,false);fallback.update({motion:'attack',phase:.4});assert.equal(fallback.group.userData.actor.imported,false);assert.ok(failed.status().error.includes('offline'));fallback.dispose();
});

test('The imported face fits real sockets, identity changes remain local, and immutable master geometry is reusable',()=>{
  const one=library.anatomy(actorIdentity({id:'hero'})),two=library.anatomy(actorIdentity({name:'Varro'})),again=library.anatomy(actorIdentity({id:'hero'}));
  assert.deepEqual(one.geometry.attributes.position.array,again.geometry.attributes.position.array);assert.notDeepEqual(one.geometry.attributes.position.array,two.geometry.attributes.position.array);
  assert.ok(one.facePoint(0,.06)[2]>one.facePoint(.05,.06)[2]+.02,'Authored nose projects in front of the cheeks.');
  assert.ok(one.facePoint(.036,.096)[2]<one.facePoint(.036,.11)[2]-.02,'The authored eye opening requires a fitted eyeball, not a surface disc.');
  for(const model of [one,two,again]){const normal=model.geometry.attributes.normal;assert.ok(normal.array instanceof Float32Array);for(let i=0;i<normal.count;i++)assert.ok(Math.abs(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))-1)<1e-5,`Facial normal ${i} cannot quantize to a black zero vector.`);}
  for(const model of [one,two,again])for(const key of ['geometry','hair','beard'])model[key]?.dispose();
});

test('Spear thrust, sword cut and mounted cut have distinct readable preparations and exact recovery at the same legal impact clock',()=>{
  const sword=actorPose({motion:'attack',phase:.25}),spear=actorPose({motion:'attack',phase:.25,weapon:'spear'}),mounted=actorPose({motion:'attack',phase:.25,mounted:true});
  assert.ok(sword.rightArm[0]<spear.rightArm[0]-.8);assert.ok(mounted.rightArm[2]>sword.rightArm[2]);
  for(const args of [{weapon:'spear'},{weapon:'sword'},{mounted:true}]){const contact=actorPose({motion:'attack',phase:ACTOR_TIMING.contact,...args});assert.ok(contact.rightElbow>-.15);assert.deepEqual(actorPose({motion:'attack',phase:1,...args}).rightArm,actorPose().rightArm);assert.deepEqual(actorPose({motion:'attack',phase:.3,time:2,reducedMotion:true,...args}),actorPose({motion:'attack',phase:.3,time:999,reducedMotion:true,...args}));}
});

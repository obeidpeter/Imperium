import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {actorIdentity} from '../src/showcase/actor-identity.js';
import {actorKit,createActor} from '../src/showcase/actors.js';
import {createHeadGeometry,headPoint} from '../src/showcase/actor-head.js';
import {ACTOR_CLIPS,sampleActorClip} from '../src/showcase/actor-clips.js';
import {actorPose,horsePose,ACTOR_TIMING} from '../src/showcase/actor-pose.js';
import {actorAtlasRects,normalizeActorAlbedo} from '../src/showcase/actor-materials.js';

test('Protagonist ages recognizably and named/faction identities survive side changes',()=>{
  const hero={id:'hero',name:'A custom name',side:'player'},young=actorIdentity(hero,actorKit(hero,{chapter:1})),old=actorIdentity(hero,actorKit(hero,{chapter:12}));
  assert.equal(young.age,20);assert.equal(old.age,46);assert.equal(old.key,young.key);
  for(const feature of ['jaw','cheek','nose','eyes','mouth'])assert.equal(old[feature],young[feature]);
  assert.ok(old.grey>young.grey&&old.beard>young.beard&&old.scar);
  const identities=['Lucan','Varro','Crispus','Aelia','Sabinus'].map(name=>actorIdentity({name},actorKit({name,side:'ally'},{chapter:7})));
  assert.equal(new Set(identities.map(x=>[x.jaw,x.nose,x.cheek].join())).size,5);
  const unit={id:'enemy0',name:'Persian cavalry',side:'enemy',role:'cavalry'};
  assert.deepEqual(actorIdentity(unit,actorKit(unit,{chapter:9})),actorIdentity({...unit,side:'ally'},actorKit({...unit,side:'ally'},{chapter:9})));
});

test('Continuous facial topology has shaped bridge/cheeks, distinct identities and finite lower-detail normals',()=>{
  const ids=['Lucan','Varro','Aelia'].map(name=>actorIdentity({name},actorKit({name,side:'ally'})));
  const geometries=ids.map(id=>createHeadGeometry(id));
  assert.notDeepEqual(geometries[0].attributes.position.array,geometries[1].attributes.position.array);
  assert.notDeepEqual(geometries[0].attributes.position.array,geometries[2].attributes.position.array);
  for(const [i,g]of geometries.entries()){
    const low=createHeadGeometry(ids[i],{detail:false});
    assert.ok(low.attributes.position.count<g.attributes.position.count*.6);
    for(const geometry of [g,low])for(const key of ['position','normal','color','uv'])assert.ok([...geometry.attributes[key].array].every(Number.isFinite));
    assert.ok(headPoint(0,.034,ids[i])[2]>headPoint(.55,.034,ids[i])[2]+.02,'Nose projection belongs to the same face surface.');
    g.computeBoundingBox();low.computeBoundingBox();assert.ok(g.boundingBox.getSize(new T.Vector3()).distanceTo(low.boundingBox.getSize(new T.Vector3()))<.015);
    low.dispose();g.dispose();
  }
});

test('Authored clips preserve exact action clocks and recover, with different conversation and speech intent',()=>{
  assert.ok(ACTOR_CLIPS.attack.some(f=>f.t===ACTOR_TIMING.contact));assert.ok(ACTOR_CLIPS.throw.some(f=>f.t===ACTOR_TIMING.release));
  for(const clip of ['idle','walk','attack','throw','speech','conversation','brace','hurt','block','horseIdle','horseStrike']){
    assert.ok(Object.isFrozen(ACTOR_CLIPS[clip]));
    for(let i=0;i<=100;i++){const p=sampleActorClip(clip,i/100);assert.ok(Object.values(p).every(Number.isFinite));assert.deepEqual(p,sampleActorClip(clip,i/100));}
  }
  for(const clip of ['attack','throw','speech','conversation','horseStrike'])assert.ok(Object.values(sampleActorClip(clip,1)).every(n=>Math.abs(n)<1e-12));
  assert.ok(Math.abs(sampleActorClip('speech',.32).rightArmX)>Math.abs(sampleActorClip('conversation',.32).rightArmX));
  assert.ok(sampleActorClip('attack',.25).hipZ<0&&sampleActorClip('attack',ACTOR_TIMING.contact).hipZ>0);
  assert.deepEqual(actorPose({time:20,reducedMotion:true}),actorPose({time:0,reducedMotion:true}));
  assert.deepEqual(horsePose({time:20,reducedMotion:true}),horsePose({time:0,reducedMotion:true}));
});

test('Live rig facial/ear motion seeks deterministically and reduced motion freezes its secondary channels',()=>{
  const actor=createActor({id:'hero',side:'player'},{chapter:12}),lid=actor.group.getObjectByName('right-eyelid');
  const signature=()=>[lid.position.y,lid.scale.y,actor.group.getObjectByName('facial-jaw').rotation.x];
  actor.update({time:4.57,motion:'speak',phase:.32,resetPose:true});const first=signature();actor.update({time:1,motion:'hit',phase:.4});actor.update({time:4.57,motion:'speak',phase:.32,resetPose:true});assert.deepEqual(signature(),first);
  actor.update({time:4.57,reducedMotion:true});const still=signature();actor.update({time:10,reducedMotion:true});assert.deepEqual(signature(),still);actor.dispose();
  const mounted=createActor({id:'enemy0',name:'Persian cavalry',side:'enemy',role:'cavalry'},{chapter:9}),ear=mounted.group.getObjectByName('horse-left-ear');
  mounted.update({time:1});const angle=ear.rotation.x;mounted.update({time:3});assert.notEqual(ear.rotation.x,angle);mounted.update({time:9,reducedMotion:true});assert.equal(ear.rotation.x,0);mounted.dispose();
});

test('Atlas quadrants use actual decoded dimensions and normalized albedo retains wear without double tint',()=>{
  assert.deepEqual(actorAtlasRects(1254,1254),{cloth:[0,0,627,627],leather:[627,0,627,627],mail:[0,627,627,627],skin:[627,627,627,627]});
  assert.throws(()=>actorAtlasRects(0,1254),RangeError);
  const pixels=Uint8ClampedArray.from([40,20,10,255,80,40,20,255]),saved=Array.from(pixels),skin=normalizeActorAlbedo(pixels,'skin'),leather=normalizeActorAlbedo(pixels,'leather');
  assert.deepEqual(Array.from(pixels),saved);assert.equal(skin[0],skin[1]);assert.equal(skin[1],skin[2]);assert.ok(skin[0]<skin[4]);assert.ok(leather[4]-leather[0]>skin[4]-skin[0]);
});

test('Browser atlas loading upgrades shared live maps, survives early disposal and releases textures once',async()=>{
  const previousImage=globalThis.Image,previousDocument=globalThis.document,images=[],crops=[];
  globalThis.Image=class{constructor(){this.naturalWidth=this.naturalHeight=1254;images.push(this);}set src(value){this.url=value;}};
  const context={clearRect(){},drawImage(image,...rect){crops.push(rect);},getImageData(){return {data:new Uint8ClampedArray(256*256*4).fill(180)};}};
  globalThis.document={createElement:()=>({getContext:()=>context})};
  try{
    const m=await import('../src/showcase/actor-materials.js?isolated-browser-test');
    const skin=m.acquireActorSurface('skin'),map=skin.map,bump=skin.bumpMap;const leather=m.acquireActorSurface('leather');m.releaseActorSurface('leather');
    let releases=0;for(const t of [map,bump,skin.roughnessMap])t.addEventListener('dispose',()=>releases++);
    const promise=m.warmActorMaterials();assert.equal(images.length,1);images[0].onload();assert.equal(await promise,true);
    assert.equal(m.actorMaterialStatus(),'painted');assert.equal(skin.map,map);assert.equal(skin.bumpMap,bump);assert.equal(map.image.width,256);assert.equal(bump.image.width,96);assert.equal(crops.length,4);
    assert.deepEqual(crops[3].slice(0,4),[627,627,627,627]);
    assert.equal(m.acquireActorSurface('skin'),skin);m.releaseActorSurface('skin');assert.equal(releases,0);m.releaseActorSurface('skin');assert.equal(releases,3);m.releaseActorSurface('skin');assert.equal(releases,3);
    assert.ok(leather.map.image.width===96,'A disposed owner is not revived by the decode completion.');
  }finally{if(previousImage===undefined)delete globalThis.Image;else globalThis.Image=previousImage;if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});

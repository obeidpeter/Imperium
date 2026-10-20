import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {createActorAssetLibrary,ACTOR_MODEL_URL} from '../src/showcase/actor-assets.js';
import {createActor} from '../src/showcase/actors.js';
import {actorIdentity} from '../src/showcase/actor-identity.js';
import {actorKit} from '../src/showcase/actor-kit.js';
import {actorWardrobe} from '../src/showcase/actor-wardrobe.js';
import {costumeGeometry} from '../src/showcase/actor-costume.js';
import {PERFORMANCE_CLIPS,samplePerformance,performanceTransition} from '../src/showcase/actor-performance.js';
import {compileCharacterPerformance,characterPerformanceMatches} from '../scripts/build-character-performance.mjs';
import {simplifyActorOverview} from '../src/showcase/actor-overview.js';
import {cheekGuardGeometry} from '../src/showcase/actor-helmet.js';
import {actorResources,characterReviewStep,ACTOR_CASES} from './actor-model-cases.js';

test('Formed cheek guards taper toward the jaw, have a curved face and finite thin-sheet normals',()=>{
  const g=cheekGuardGeometry(),p=g.attributes.position,n=g.attributes.normal;
  g.computeBoundingBox();const size=g.boundingBox.getSize(new T.Vector3());
  assert.ok(size.y>.1&&size.y<.12);assert.ok(size.x>.04&&size.x<.06);assert.ok(size.z<.02);
  const widthAt=(low,high)=>{const x=[];for(let i=0;i<p.count;i++)if(p.getY(i)>=low&&p.getY(i)<=high)x.push(p.getX(i));return Math.max(...x)-Math.min(...x);};
  assert.ok(widthAt(-.057,-.039)<widthAt(-.01,.02),'The lower jaw end is visibly narrower than the cheek.');
  assert.ok(Array.from(p.array).every(Number.isFinite)&&Array.from(n.array).every(Number.isFinite));
  assert.ok(p.count/3<700,'Formed guards stay inside a small near-detail triangle budget.');g.dispose();
});

test('Authored performance source exports exactly and rejects discontinuities or unbounded channels',async()=>{
  const source=JSON.parse(await readFile(new URL('../scripts/character-sources/performance-v034.json',import.meta.url),'utf8'));
  assert.ok(characterPerformanceMatches(source,await readFile(new URL('../src/showcase/actor-performance-data.js',import.meta.url),'utf8')));
  const bad=structuredClone(source);bad.clips.walk.frames[1][1].hipY=1;assert.throws(()=>compileCharacterPerformance(bad),/Unbounded/);
  const loop=structuredClone(source);loop.clips.walk.frames.at(-1)[1]={};assert.throws(()=>compileCharacterPerformance(loop),/endpoints/);
  for(const [name,clip]of Object.entries(PERFORMANCE_CLIPS)){
    assert.ok(Object.isFrozen(clip));
    for(let i=0;i<=100;i++){const p=samplePerformance(name,i/100);assert.ok(Object.values(p).every(Number.isFinite));assert.deepEqual(p,samplePerformance(name,i/100));}
    assert.deepEqual(samplePerformance(name,0),samplePerformance(name,1));
  }
  assert.ok(Object.values(samplePerformance('strike',230/620)).every(n=>n===0),'The additional performance does not move the legal contact pose.');
  assert.ok(performanceTransition('walk','idle')>performanceTransition('idle','block'));
});

test('Performance export checks accept LF and Windows CRLF checkouts while rejecting changed source or output',async()=>{
  const json=await readFile(new URL('../scripts/character-sources/performance-v034.json',import.meta.url),'utf8');
  const lf=json.replaceAll('\r\n','\n'),source=JSON.parse(lf),windowsSource=JSON.parse(lf.replaceAll('\n','\r\n'));
  const exported=compileCharacterPerformance(source);
  assert.equal(compileCharacterPerformance(windowsSource),exported,'The source digest depends on parsed content, not checkout line endings');
  for(const text of [exported,exported.replaceAll('\n','\r\n')]){
    assert.ok(characterPerformanceMatches(source,text));assert.ok(characterPerformanceMatches(windowsSource,text));
    assert.equal(characterPerformanceMatches(source,text.replace('PERFORMANCE_CLIPS','STALE_CLIPS')),false);
    assert.equal(characterPerformanceMatches({...source,method:source.method+' changed'},text),false);
  }
});

test('Full tunic is one connected hem-to-sleeve surface with real lower cloth bindings',()=>{
  for(const hem of [-.28,-.48,-.68])for(const detail of ['near','overview']){
    const g=costumeGeometry({hem,detail}),p=g.attributes.position,index=g.index.array,edges=new Map(),neighbors=new Map();
    for(let i=0;i<index.length;i+=3)for(let k=0;k<3;k++){
      const a=index[i+k],b=index[i+(k+1)%3],key=[a,b].sort((x,y)=>x-y).join(':');edges.set(key,(edges.get(key)||0)+1);
      if(!neighbors.has(a))neighbors.set(a,[]);neighbors.get(a).push(b);
      if(!neighbors.has(b))neighbors.set(b,[]);neighbors.get(b).push(a);
    }
    const visited=new Set(),queue=[0];while(queue.length){const i=queue.pop();if(visited.has(i))continue;visited.add(i);queue.push(...neighbors.get(i));}
    assert.equal(visited.size,p.count,'Sleeves, waist and lower hem share one indexed component.');
    assert.ok([...edges.values()].every(n=>n<=2));assert.ok(g.boundingBox.min.y<hem+.01);assert.ok(g.userData.fullLength);
    assert.ok(g.attributes.skinIndex.array.includes(4)&&g.attributes.skinIndex.array.includes(5),'Existing cloth fold and hem bones drive the sewn garment.');
    for(let i=0;i<p.count;i++){assert.ok([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite));const w=g.attributes.skinWeight;assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-6);}
    assert.ok(index.length/3<4200);g.dispose();
  }
});

test('Overview clustering reduces real geometry without mutating source buffers or losing the bounded silhouette',()=>{
  const source=new T.SphereGeometry(.25,40,24),before=Array.from(source.attributes.position.array),g=simplifyActorOverview(source,{cell:.022});
  assert.ok(g.index.count<source.index.count*.85);assert.deepEqual(Array.from(source.attributes.position.array),before);
  const size=g.boundingBox.getSize(new T.Vector3());assert.ok(size.toArray().every(n=>n>.47&&n<.51));
  assert.ok(g.attributes.position.array.every(Number.isFinite));assert.ok(g.attributes.normal.array.every(Number.isFinite));g.dispose();source.dispose();
});

test('Imported face correctives move facial skin, preserve body vertices, reset exactly and dispose once',async()=>{
  const bytes=await readFile(new URL('../'+ACTOR_MODEL_URL,import.meta.url)),library=createActorAssetLibrary(()=>new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''));
  const actor=createActor({id:'hero',side:'player'},{chapter:5,assetLibrary:library});await actor.ready;
  const skin=actor.group.getObjectByName('imported-anatomy');assert.equal(skin.geometry.morphAttributes.position.length,3);
  const p=skin.geometry.attributes.position,ids=skin.geometry.attributes.skinIndex;
  for(let i=0;i<p.count;i++)if(ids.getX(i)!==1)for(const target of skin.geometry.morphAttributes.position)assert.deepEqual([target.getX(i),target.getY(i),target.getZ(i)],[0,0,0]);
  actor.update({motion:'speak',phase:.4,time:1,resetPose:true});assert.ok(skin.morphTargetInfluences[0]>0);
  const before=[...skin.morphTargetInfluences];actor.update({motion:'hit',phase:.4});actor.update({motion:'speak',phase:.4,time:1,resetPose:true});assert.deepEqual(skin.morphTargetInfluences,before);
  actor.update({motion:'idle',time:0,resetPose:true,reducedMotion:true});assert.deepEqual(skin.morphTargetInfluences,[0,0,0]);
  let disposed=0;skin.geometry.addEventListener('dispose',()=>disposed++);actor.dispose();actor.dispose();assert.equal(disposed,1);
});

test('All twelve hero looks and named wardrobes preserve identity and practical near/overview budgets',()=>{
  const cases=ACTOR_CASES.filter(item=>item.id.startsWith('hero-ch'));
  assert.equal(cases.length,12);
  for(const item of cases){
    const a=createActor(item.unit,{...item.options,quality:'performance'});a.update({detailDistance:2});const near=actorResources(a.group);
    const before=a.contacts.weapon?.getWorldPosition(new T.Vector3());a.update({detailDistance:40});const far=actorResources(a.group);
    assert.ok(far.visibleTriangles<near.visibleTriangles*.8);assert.ok(near.visibleTriangles<65_000&&far.visibleTriangles<20_000);
    if(before)assert.ok(before.distanceTo(a.contacts.weapon.getWorldPosition(new T.Vector3()))<1e-9);a.dispose();
  }
  const palettes=[];
  for(const name of ['Varro','Lucan','Sabinus','Crispus','Aelia']){
    const u={name,id:name,side:'enemy',role:'infantry'},kit=actorKit(u,{chapter:5}),id=actorIdentity(u,kit),style=actorWardrobe(id,kit);
    palettes.push(style.palette.cloth);const ally={...u,side:'ally'};assert.deepEqual(style,actorWardrobe(actorIdentity(ally,actorKit(ally,{chapter:5})),actorKit(ally,{chapter:5})));
  }
  assert.ok(new Set(palettes).size>=4);
  const phases=Array.from({length:200},(_,i)=>characterReviewStep(i/20));assert.ok(phases.every(p=>p.phase>=0&&p.phase<1));assert.ok(phases.some(p=>p.motion==='turn')&&phases.some(p=>p.motion==='stop'));
});

test('Premium material atlas updates shared maps once, preserves fallback and cannot be overwritten by late older art',async()=>{
  const previousImage=globalThis.Image,previousDocument=globalThis.document,images=[],crops=[];
  globalThis.Image=class{constructor(){this.naturalWidth=1024;this.naturalHeight=1024;images.push(this);}set src(value){this.url=value;}};
  globalThis.document={createElement(){return {getContext(){return {clearRect(){},drawImage(_,...rect){crops.push(rect);},getImageData(){return {data:new Uint8ClampedArray(256*256*4).fill(180)};}};}};}};
  try{
    const m=await import('../src/showcase/actor-materials.js?premium-v034-test'),one=m.acquireActorSurface('cloth'),two=m.acquireActorSurface('cloth'),map=one.map;
    const premium=m.warmPremiumActorMaterials();assert.equal(images.length,2);images[1].onload();assert.equal(await premium,true);
    assert.equal(one,two);assert.equal(one.map,map);assert.equal(map.userData.source,'roman-surfaces-v034');assert.equal(crops.length,4);
    images[0].onload();await m.warmActorMaterials();assert.equal(map.userData.source,'roman-surfaces-v034');
    let disposed=0;map.addEventListener('dispose',()=>disposed++);m.releaseActorSurface('cloth');assert.equal(disposed,0);m.releaseActorSurface('cloth');assert.equal(disposed,1);
    const failed=await import('../src/showcase/actor-materials.js?premium-failure-v034-test'),fallback=failed.acquireActorSurface('cloth'),data=fallback.map.image.data;
    const pending=failed.warmPremiumActorMaterials();images.at(-1).onerror();assert.equal(await pending,false);assert.equal(fallback.map.image.data,data);failed.releaseActorSurface('cloth');
  }finally{if(previousImage===undefined)delete globalThis.Image;else globalThis.Image=previousImage;if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {createActor} from '../src/showcase/actors.js';
import {actorKit} from '../src/showcase/actor-kit.js';
import {createActorAssetCatalog,ACTOR_MODEL_URL,FEMALE_ACTOR_MODEL_URL} from '../src/showcase/actor-assets.js';
import {ACTOR_CASES,ACTOR_MOTIONS,actorCase,actorResources,sampleSummary} from './actor-model-cases.js';

test('Inspection presets exercise distinct production roles and all named faces without editable shared inputs',()=>{
  assert.equal(new Set(ACTOR_CASES.map(item=>item.id)).size,ACTOR_CASES.length);
  for(const id of ['recruit','veteran','officer','cavalry','goth','persian','senator','aelia','varro','lucan','crispus','severianus','paullus','sabinus'])assert.equal(actorCase(id).id,id);
  const kit=id=>{const item=actorCase(id);return actorKit(item.unit,item.options);};
  assert.equal(kit('recruit').recruit,true);assert.equal(kit('veteran').armored,true);assert.equal(kit('officer').officer,true);assert.equal(kit('cavalry').mounted,true);assert.equal(kit('goth').faction,'Gothic');assert.equal(kit('persian').faction,'Persian');assert.equal(kit('senator').civic,true);assert.equal(kit('aelia').civic,true);
  for(const item of ACTOR_CASES){assert.ok(Object.isFrozen(item.unit));assert.ok(Object.isFrozen(item.options));assert.ok(item.options.chapter>=1&&item.options.chapter<=12);}
  assert.equal(actorCase('invalid'),ACTOR_CASES[0]);
});

test('Every inspection specimen uses the production imported/fallback actor safely through all offered poses and releases owned meshes',async()=>{
  const load=url=>async()=>{const bytes=await readFile(new URL('../'+url,import.meta.url));return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');};
  const library=createActorAssetCatalog({maleLoad:load(ACTOR_MODEL_URL),femaleLoad:load(FEMALE_ACTOR_MODEL_URL)});assert.equal(await library.warm(),true);
  for(const item of ACTOR_CASES){
    const before=JSON.stringify(item),scene=new T.Scene(),actor=createActor(item.unit,{...item.options,assetLibrary:library,quality:'balanced'});await actor.ready;scene.add(actor.group);actor.group.position.set(3,.2,-2);
    const owned=new Set();actor.group.traverse(object=>{if(object.geometry){owned.add(object.geometry);for(const value of object.geometry.attributes.position.array)assert.ok(Number.isFinite(value),`${item.id}: finite positions`);}for(const material of Array.isArray(object.material)?object.material:[object.material])if(material)owned.add(material);});
    const counts=new Map();for(const resource of owned)resource.addEventListener('dispose',()=>counts.set(resource,(counts.get(resource)||0)+1));
    for(const motion of ACTOR_MOTIONS)for(const phase of [0,.37,.7,1]){
      actor.update({motion,phase,time:phase*1.8,direction:.7,resetPose:true,groundHeight:()=>.2});assert.deepEqual(actor.group.position.toArray(),[3,.2,-2]);
      actor.group.traverse(object=>assert.ok(object.matrixWorld.elements.every(Number.isFinite),`${item.id}/${motion}/${phase}: finite transforms`));
    }
    const resources=actorResources(actor.group);assert.ok(resources.skinnedMeshes>0);assert.ok(resources.geometryArrayBytes>0);assert.ok(resources.estimatedTextureBytes>0);assert.ok(resources.visibleTriangles>0);assert.ok(resources.visibleMeshes<=resources.meshes);
    assert.equal(JSON.stringify(item),before,'Diagnostic animation must not alter preset/game-shaped inputs');actor.dispose();actor.dispose();assert.equal(scene.children.length,0);for(const resource of owned)assert.equal(counts.get(resource),1,'Every referenced owned geometry/material must dispose exactly once');
  }
});

test('Resource diagnostics distinguish hidden geometry and deduplicate shared GPU inputs',()=>{
  const group=new T.Group(),geometry=new T.PlaneGeometry(1,1),texture=new T.DataTexture(new Uint8Array(16),2,2),material=new T.MeshStandardMaterial({map:texture}),one=new T.Mesh(geometry,material),two=new T.Mesh(geometry,material);two.visible=false;group.add(one,two);
  const stats=actorResources(group);assert.equal(stats.meshes,2);assert.equal(stats.visibleMeshes,1);assert.equal(stats.visibleTriangles,2);assert.equal(stats.geometries,1);assert.equal(stats.materials,1);assert.equal(stats.textures,1);assert.equal(stats.estimatedTextureBytes,16);assert.equal(stats.geometryArrayBytes,[geometry.index,...Object.values(geometry.attributes)].reduce((n,a)=>n+a.array.byteLength,0));
  geometry.dispose();material.dispose();texture.dispose();
});

test('Timing summaries remain bounded, ignore invalid samples and report empty measurements honestly',()=>{
  assert.deepEqual(sampleSummary([]),{count:0,median:null,p95:null,max:null});
  const data=Array.from({length:200},(_,i)=>i+1),before=[...data];assert.deepEqual(sampleSummary([...data,NaN,Infinity]),{count:120,median:140,p95:194,max:200});assert.deepEqual(data,before);
});

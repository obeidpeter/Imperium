import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {createActorAssetLibrary} from '../src/showcase/actor-assets.js';
import {createActorComplexionLibrary} from '../src/showcase/actor-complexion.js';
import {createActor} from '../src/showcase/actors.js';

const bytes=await readFile(new URL('../assets/models/roman-human-v017.glb',import.meta.url));
const parse=()=>new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const pixels=()=>({width:2,height:1,data:new Uint8Array([234,188,157,255,167,98,96,255])});
function trackedComplexion(load){
  const library=createActorComplexionLibrary(load),maps=new Map();
  return {library,maps,api:{...library,acquire(identity){const surface=library.acquire(identity);if(!maps.has(surface.map)){maps.set(surface.map,0);surface.map.addEventListener('dispose',()=>maps.set(surface.map,maps.get(surface.map)+1));}return surface;}}};
}

test('Disposing a pending fallback immediately releases its complexion lease; late anatomy and pixels cannot resurrect it',async()=>{
  const model=deferred(),image=deferred(),assetLibrary=createActorAssetLibrary(()=>model.promise),complexion=trackedComplexion(()=>image.promise);
  const actor=createActor({id:'hero'},{assetLibrary,complexionLibrary:complexion.api});
  assert.equal(actor.group.userData.actor.imported,false);assert.equal(complexion.library.status().refs,1);const map=[...complexion.maps.keys()][0];
  actor.dispose();actor.dispose();assert.equal(complexion.library.status().refs,0);assert.equal(complexion.maps.get(map),1);
  model.resolve(await parse());image.resolve(pixels());assert.equal(await actor.ready,false);assert.equal(complexion.library.status().ready,false);assert.equal(complexion.maps.get(map),1);assert.equal(map.image.width,1);
});

test('Successful late anatomy transfers exactly one complexion owner to the real imported material',async()=>{
  const model=deferred(),image=deferred(),assetLibrary=createActorAssetLibrary(()=>model.promise),complexion=trackedComplexion(()=>image.promise),actor=createActor({id:'hero'},{assetLibrary,complexionLibrary:complexion.api});
  const originalMap=[...complexion.maps.keys()][0];image.resolve(pixels());model.resolve(await parse());assert.equal(await actor.ready,true);
  assert.equal(complexion.library.status().refs,1);assert.equal(actor.group.getObjectByName('imported-anatomy').material.map,originalMap);assert.equal(originalMap.image.width,2);assert.equal(complexion.maps.get(originalMap),0);
  actor.dispose();actor.dispose();assert.equal(complexion.maps.get(originalMap),1);assert.equal(complexion.library.status().refs,0);
});

test('Abandoning one actor cannot release the pending or live complexion owned by another',async()=>{
  const model=deferred(),image=deferred(),assetLibrary=createActorAssetLibrary(()=>model.promise),complexion=trackedComplexion(()=>image.promise),options={assetLibrary,complexionLibrary:complexion.api};
  const abandoned=createActor({id:'hero'},options),living=createActor({id:'ally',name:'Varro'},options),map=[...complexion.maps.keys()][0];
  assert.equal(complexion.library.status().refs,2);abandoned.dispose();assert.equal(complexion.library.status().refs,1);assert.equal(complexion.maps.get(map),0);
  model.resolve(await parse());image.resolve(pixels());assert.deepEqual(await Promise.all([abandoned.ready,living.ready]),[false,true]);assert.equal(complexion.library.status().refs,1);assert.equal(complexion.maps.get(map),0);
  living.update({motion:'rally',phase:.3});assert.equal(living.group.getObjectByName('imported-anatomy').material.map,map);living.dispose();assert.equal(complexion.maps.get(map),1);
});

test('A failed anatomy request releases warm-only textures and a failed complexion retries after the last actual rig releases',async()=>{
  const failure=createActorAssetLibrary(async()=>{throw Error('Anatomy offline');}),orphan=trackedComplexion(async()=>pixels()),fallback=createActor({id:'hero'},{assetLibrary:failure,complexionLibrary:orphan.api});
  assert.equal(await fallback.ready,false);assert.equal(orphan.library.status().refs,0);assert.equal(orphan.library.status().ready,false);assert.deepEqual([...orphan.maps.values()],[1]);fallback.dispose();assert.deepEqual([...orphan.maps.values()],[1]);
  const assetLibrary=createActorAssetLibrary(parse);await assetLibrary.warm();let attempts=0;
  const complexion=trackedComplexion(async()=>{if(++attempts===1)throw Error('Complexion offline');return pixels();}),options={assetLibrary,complexionLibrary:complexion.api};
  const first=createActor({id:'hero'},options);assert.equal(await first.ready,true);assert.equal(complexion.library.status().refs,1);assert.match(complexion.library.status().error,/offline/);assert.equal(attempts,1);
  first.dispose();assert.equal(complexion.library.status().error,null);const second=createActor({id:'hero'},options);assert.equal(await second.ready,true);assert.equal(attempts,2);assert.equal(complexion.library.status().ready,true);assert.equal(complexion.library.status().refs,1);second.dispose();assert.deepEqual([...complexion.maps.values()],[1,1]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {ACTOR_COMPLEXION_ASSETS,normalizeActorComplexion,createActorComplexionLibrary} from '../src/showcase/actor-complexion.js';

const sample=()=>({width:2,height:1,data:new Uint8Array([234,188,157,255,167,98,96,255])});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('Complexion neutralization keeps UV pixel order and facial contrast without baking a second skin tint',()=>{
  const pixels=sample().data,before=pixels.slice(),result=normalizeActorComplexion(pixels);
  assert.deepEqual(pixels,before);assert.notEqual(result,pixels);
  assert.ok(result.slice(0,3).every(n=>n>=227&&n<=229),'Neutral skin leaves highlight headroom for actor tint.');
  assert.ok(result[4]>result[5]&&result[4]>result[6],'The lip remains relatively red.');
  assert.ok(result[4]<result[0]-40,'Dark facial detail is not flattened.');
  assert.equal(result[3],255);assert.equal(result[7],255);
  const female=normalizeActorComplexion(new Uint8Array([217,179,151,255]),'female');assert.ok(female.slice(0,3).every(n=>n>=227&&n<=229));
  const highlights=normalizeActorComplexion(new Uint8Array([245,198,166,255,250,204,172,255]));assert.ok(highlights[4]>highlights[0]&&highlights[4]<255,'Nearby highlights retain distinct values instead of clipping flat white.');
  assert.throws(()=>normalizeActorComplexion(new Uint8Array(3)),RangeError);
});
test('Shared material upgrades in place, matches retained OBJ UV coordinates and never requests the other complexion',async()=>{
  const request=deferred(),calls=[],library=createActorComplexionLibrary((url,kind)=>{calls.push({url,kind});return request.promise;});
  const a=library.acquire('male'),b=library.acquire({female:false}),map=a.map;
  assert.equal(a,b);assert.deepEqual(map.repeat.toArray(),[1,1]);assert.equal(map.flipY,true,'The GLB converter retains the OBJ V axis; the diffuse image must flip.');assert.equal(map.wrapS,T.ClampToEdgeWrapping);assert.equal(map.wrapT,T.ClampToEdgeWrapping);assert.equal(map.colorSpace,T.SRGBColorSpace);
  assert.equal(a.normalMap,null);assert.equal(a.bumpMap,null);assert.equal(a.roughnessMap,null);assert.equal(a.metalness,0);
  const loading=library.warm('male');await Promise.resolve();assert.equal(calls.length,1);assert.equal(calls[0].kind,'male');assert.ok(calls[0].url.endsWith(ACTOR_COMPLEXION_ASSETS.male));
  assert.equal(library.status('female').pending,false);request.resolve(sample());assert.equal(await loading,true);
  assert.equal(a.map,map);assert.equal(b.map.image.width,2);assert.deepEqual(map.image.data,normalizeActorComplexion(sample().data));
  let disposed=0;map.addEventListener('dispose',()=>disposed++);library.release('male');assert.equal(disposed,0);library.release({female:false});assert.equal(disposed,1);library.release('male');assert.equal(disposed,1);
  assert.equal(library.status('male').refs,0);assert.equal(library.status('male').ready,false);library.dispose();assert.equal(disposed,1);
});
test('Late decode cannot resurrect a released map; a new live owner can share the pending request',async()=>{
  const pending=deferred();let calls=0;const library=createActorComplexionLibrary(()=>{calls++;return pending.promise;});
  const old=library.acquire('female');library.release('female');const current=library.acquire('female'),promise=library.warm('female');
  assert.notEqual(old.map,current.map);pending.resolve(sample());assert.equal(await promise,true);assert.equal(calls,1);
  assert.equal(old.map.image.width,1);assert.equal(current.map.image.width,2);library.release('female');
  const orphan=deferred(),abandoned=createActorComplexionLibrary(()=>orphan.promise),map=abandoned.acquire().map,load=abandoned.warm();abandoned.release();orphan.resolve(sample());assert.equal(await load,false);assert.equal(map.image.width,1);assert.equal(abandoned.status().ready,false);
});
test('Failed or malformed decode leaves a usable fallback and retries only after the ownership cycle ends',async()=>{
  let calls=0;const library=createActorComplexionLibrary(async()=>{calls++;throw Error('local image missing');});
  const fallback=library.acquire();assert.equal(await library.warm(),false);
  for(let i=0;i<20;i++)assert.equal(await library.warm(),false);
  assert.equal(calls,1);assert.equal(fallback.map.image.width,1);assert.match(library.status().error,/missing/);
  library.release();library.acquire();await library.warm();assert.equal(calls,2);library.dispose();
  const malformed=createActorComplexionLibrary(async()=>({width:8192,height:8192,data:new Uint8Array(4)}));malformed.acquire();assert.equal(await malformed.warm(),false);assert.match(malformed.status().error,/Invalid/);malformed.dispose();
});
test('Preloading is bounded to two kinds and disposal during decoding has no late GPU upload',async()=>{
  const pending=deferred(),library=createActorComplexionLibrary(()=>pending.promise),map=library.acquire().map,load=library.warm();let disposed=0;map.addEventListener('dispose',()=>disposed++);
  library.dispose();library.dispose();pending.resolve(sample());assert.equal(await load,false);assert.equal(disposed,1);assert.equal(map.image.width,1);assert.throws(()=>library.acquire(),/disposed/);assert.equal(await library.warm(),false);
  const ready=createActorComplexionLibrary(async()=>sample());assert.equal(await ready.warm('female'),true);assert.equal(ready.status('female').refs,0);const warmed=ready.acquire('female');assert.equal(warmed.map.image.width,2);ready.release('female');assert.equal(ready.status('female').ready,false);
});
test('Importing and constructing in Node requires no browser, network, timer or canvas',async()=>{
  assert.equal(typeof document,'undefined');assert.equal(typeof Image,'undefined');const library=createActorComplexionLibrary(),surface=library.acquire();assert.equal(await library.warm(),false);assert.equal(library.status().error,null);assert.equal(surface.map.image.width,1);library.release();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {parseActorHair,normalizeActorHair,createActorHairLibrary} from '../src/showcase/actor-hair-asset.js';
const binary=await readFile(new URL('../assets/models/short-hair-v018.bin',import.meta.url));
const image=()=>({width:256,height:256,data:new Uint8Array(256*256*4).map((_,i)=>i%4===3?128:34)});
const deferred=()=>{let resolve;const promise=new Promise(a=>resolve=a);return {promise,resolve};};
test('Shipped hair parses into a bounded anatomical scalp with complete UVs, unit normals and in-range triangles',()=>{
  const a=parseActorHair(binary);assert.equal(a.position.length/3,991);assert.equal(a.index.length/3,1050);
  for(let i=0;i<a.position.length;i+=3){assert.ok(Math.abs(a.position[i])<.13);assert.ok(a.position[i+1]>1.44&&a.position[i+1]<1.75);assert.ok(Math.abs(a.position[i+2])<.15);assert.ok(Math.abs(Math.hypot(...a.normal.slice(i,i+3))-1)<1e-6);}
  assert.ok(a.uv.every(v=>v>=0&&v<=1));assert.ok(a.index.every(v=>v<991));assert.deepEqual(a,parseActorHair(binary));
  assert.throws(()=>parseActorHair(binary.subarray(0,binary.length-1)),/layout/);
  for(const mutate of [b=>b.writeUInt32LE(1000000,4),b=>b.writeFloatLE(NaN,12),b=>b.writeUInt16LE(9999,b.length-2),b=>b.writeUInt32LE(1,36)]){const bad=Buffer.from(binary);mutate(bad);assert.throws(()=>parseActorHair(bad),/Invalid hair/);}
});
test('Lazy master waits for the matching alpha image; actor clones preserve head weights and cannot alter another actor',async()=>{
  const texture=deferred();let modelCalls=0,imageCalls=0;const library=createActorHairLibrary({loadBinary:async()=>{modelCalls++;return binary;},loadTexture:()=>{imageCalls++;return texture.promise;}});
  assert.equal(library.geometry(),null);const a=library.warm(),b=library.warm();assert.equal(a,b);await Promise.resolve();assert.equal(library.geometry(),null);texture.resolve(image());assert.equal(await a,true);assert.equal(modelCalls,1);assert.equal(imageCalls,1);
  const first=library.geometry({key:'hero',cheek:1}),second=library.geometry({key:'lucan',cheek:1.12});assert.notEqual(first,second);assert.equal(first.userData.importedHair,true);
  assert.equal(library.geometry({female:true}),null);assert.equal(library.geometry({hair:'long'}),null);assert.equal(library.geometry({hair:'bound'}),null);
  const firstX=first.attributes.position.getX(0);second.attributes.position.setX(0,999);assert.equal(first.attributes.position.getX(0),firstX);assert.equal(library.geometry({cheek:1}).attributes.position.getX(0),firstX);
  for(let i=0;i<first.attributes.position.count;i++){assert.equal(first.attributes.skinIndex.getX(i),1);assert.equal(first.attributes.skinWeight.getX(i),1);assert.equal(first.attributes.skinWeight.getY(i),0);}
  const bones=Array.from({length:6},()=>new T.Bone()),mesh=new T.SkinnedMesh(first,new T.MeshStandardMaterial());mesh.bind(new T.Skeleton(bones));const input=new T.Vector3().fromBufferAttribute(first.attributes.position,0),moved=input.clone();bones[1].position.x=.05;bones[1].updateMatrixWorld(true);mesh.applyBoneTransform(0,moved);assert.ok(Math.abs(moved.x-input.x-.05)<1e-6);assert.equal(moved.y,input.y);mesh.skeleton.dispose();mesh.material.dispose();first.dispose();second.dispose();library.dispose();
});
test('Hair alpha survives neutralization, uses cutout depth, and shared GPU resources release exactly once',async()=>{
  const pixels=new Uint8Array([10,20,30,0,30,35,40,96,40,40,40,255]),before=pixels.slice(),after=normalizeActorHair(pixels);assert.deepEqual(pixels,before);assert.deepEqual([after[3],after[7],after[11]],[0,96,255]);assert.ok(after[4]>pixels[4]*4);
  const library=createActorHairLibrary({loadBinary:async()=>binary,loadTexture:async()=>image()});await library.warm();const a=library.acquire(),b=library.acquire();assert.equal(a.map,b.map);assert.equal(a.transparent,false);assert.equal(a.alphaTest,.28);assert.equal(a.side,T.DoubleSide);assert.equal(a.map.flipY,true);assert.equal(a.map.image.width,256);assert.equal(a.map.colorSpace,T.SRGBColorSpace);assert.equal(a.normalMap,null);
  let disposals=0;a.map.addEventListener('dispose',()=>disposals++);library.release();assert.equal(disposals,0);library.release();assert.equal(disposals,1);library.release();assert.equal(disposals,1);const next=library.acquire();assert.notEqual(next.map,a.map);assert.equal(next.map.image.width,256);library.release();library.dispose();
});
test('Failed or late asset loads never expose partial geometry or revive disposed maps',async()=>{
  let tries=0;const failed=createActorHairLibrary({loadBinary:()=>{tries++;throw Error('missing');},loadTexture:async()=>image()});for(let i=0;i<8;i++)assert.equal(await failed.warm(),false);assert.equal(tries,1);assert.equal(failed.geometry(),null);assert.match(failed.status().error,/missing/);failed.dispose();
  const pending=deferred(),library=createActorHairLibrary({loadBinary:()=>pending.promise,loadTexture:async()=>image()}),surface=library.acquire(),loading=library.warm();let disposed=0;surface.map.addEventListener('dispose',()=>disposed++);library.release();pending.resolve(binary);assert.equal(await loading,true);assert.equal(disposed,1);assert.equal(surface.map.image.width,1,'Released texture does not receive the late upload.');library.dispose();assert.equal(library.geometry(),null);
  const final=deferred(),closed=createActorHairLibrary({loadBinary:()=>final.promise,loadTexture:async()=>image()}),p=closed.warm();closed.dispose();final.resolve(binary);assert.equal(await p,false);assert.equal(closed.geometry(),null);
});
test('Default Node import and construction do not fetch or require image decoding',async()=>{const library=createActorHairLibrary();assert.equal(await library.warm(),false);assert.equal(library.status().error,null);assert.equal(library.geometry(),null);library.dispose();});


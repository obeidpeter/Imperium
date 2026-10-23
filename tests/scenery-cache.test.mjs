import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {createSceneryModelCache} from '../src/showcase/scenery-cache.js';

function trackedModel({geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial(),lod=false}={}){
  const root=new T.Group(),freed={geometry:0,material:0,texture:0};
  geometry.addEventListener('dispose',()=>freed.geometry++);material.addEventListener('dispose',()=>freed.material++);
  material.map??=new T.Texture();material.map.addEventListener('dispose',()=>freed.texture++);
  if(lod){const levels=new T.LOD();levels.addLevel(new T.Mesh(geometry,material),0);levels.addLevel(new T.Mesh(geometry,material),30);root.add(levels);}
  else root.add(new T.Mesh(geometry,material));
  return {root,freed,geometry,material};
}
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

test('active and preload leases survive LRU pressure; unleased masters stay bounded',async()=>{
  const models=new Map(),cache=createSceneryModelCache({maxIdle:2,load:async url=>{const m=trackedModel();models.set(url,m);return m.root;}});
  const stage=cache.acquire('stage'),preload=cache.acquire('next');await Promise.all([stage.ready,preload.ready]);
  for(let i=0;i<12;i++)await cache.warm('idle-'+i);
  assert.equal(cache.stats().idle,2);assert.equal(cache.stats().entries,4);
  assert.equal(stage.scene,models.get('stage').root);assert.equal(preload.scene,models.get('next').root);
  assert.equal(models.get('idle-0').freed.geometry,1);assert.equal(models.get('stage').freed.geometry,0);
  const next=cache.acquire('next');preload.release();cache.setWorkingSet(['next']);
  assert.equal(cache.stats().entries,2,'previous active stage and next stage remain');
  stage.release();assert.equal(models.get('stage').freed.geometry,1,'leaving the chapter releases its masters');
  next.release();cache.clear();assert.equal(cache.stats().entries,0);
});

test('a cancelled pending response is disposed and cannot replace a newer same-URL request',async()=>{
  const first=deferred(),old=trackedModel(),fresh=trackedModel();let count=0;
  const cache=createSceneryModelCache({load:()=>++count===1?first.promise:Promise.resolve(fresh.root)});
  const abandoned=cache.acquire('prop');await Promise.resolve();abandoned.release();
  const next=cache.acquire('prop');await next.ready;first.resolve(old.root);assert.equal(await abandoned.ready,null);
  assert.equal(old.freed.geometry,1);assert.equal(cache.master('prop'),fresh.root);assert.equal(fresh.freed.geometry,0);
  next.release();cache.clear();assert.equal(fresh.freed.geometry,1);
});

test('shared geometry, materials, images and hidden LOD levels live until their last owner releases',async()=>{
  const image={closed:0,close(){this.closed++;}},texture=new T.Texture(image),material=new T.MeshStandardMaterial({map:texture}),geometry=new T.BoxGeometry();
  const a=trackedModel({geometry,material,lod:true}),b=new T.Group();b.add(new T.Mesh(geometry,material));
  const cache=createSceneryModelCache({load:async url=>url==='a'?a.root:b}),one=cache.acquire('a'),two=cache.acquire('b');
  await Promise.all([one.ready,two.ready]);cache.clear();one.release();one.release();
  assert.deepEqual(a.freed,{geometry:0,material:0,texture:0});assert.equal(image.closed,0);
  two.release();assert.deepEqual(a.freed,{geometry:1,material:1,texture:1});assert.equal(image.closed,1);
  cache.clear();assert.equal(image.closed,1,'all shared resources release exactly once');
});

test('failed loads are retryable without erasing a newer request or leaking a lease',async()=>{
  const failed=deferred(),model=trackedModel();let calls=0;
  const cache=createSceneryModelCache({load:()=>++calls===1?failed.promise:Promise.resolve(model.root)});
  const old=cache.acquire('prop');await Promise.resolve();old.release();
  const current=cache.acquire('prop');await current.ready;failed.reject(Error('offline'));
  await assert.rejects(old.ready,/offline/);assert.equal(cache.master('prop'),model.root);
  current.release();cache.clear();assert.equal(cache.stats().entries,0);assert.equal(model.freed.geometry,1);
});

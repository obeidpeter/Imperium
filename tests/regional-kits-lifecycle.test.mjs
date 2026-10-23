import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {createSceneryModels,sceneryPlacements} from '../src/showcase/scenery-models.js';
import {createSceneryModelCache} from '../src/showcase/scenery-cache.js';

const camp=chapter=>({id:`ch${chapter}-camp`,width:20,height:16});
function fallbackScene(placements){
  const scene=new T.Scene();
  for(const p of placements)if(p.fallbackName){const group=new T.Group();group.name=p.fallbackName;scene.add(group);}
  return scene;
}
function trackedSource(url,placements){
  const root=new T.Group(),geometry=new T.BoxGeometry(1,1,1),material=new T.MeshStandardMaterial(),texture=new T.Texture();
  material.map=texture;
  const disposed={geometry:0,material:0,texture:0};
  for(const [name,resource]of Object.entries({geometry,material,texture}))resource.addEventListener('dispose',()=>disposed[name]++);
  for(const name of new Set(placements.filter(p=>p.url===url&&p.component).map(p=>p.component))){const part=new T.Mesh(geometry,material);part.name=name;root.add(part);}
  if(!root.children.length)root.add(new T.Mesh(geometry,material));
  return {root,disposed};
}

test('unavailable packs retain every regional fallback without stranded cache entries',async()=>{
  for(const chapter of [1,2,7,9,10,12]){
    const e=camp(chapter),placements=sceneryPlacements(e,{chapter}),scene=fallbackScene(placements);
    const cache=createSceneryModelCache({load:async()=>{throw Error('Simulated unavailable pack');}});
    const models=createSceneryModels(scene,e,{chapter,cache});
    assert.deepEqual(await models.ready,[],`Chapter ${chapter} does not pretend to load missing models`);
    assert.equal(models.group.children.length,0);
    for(const p of placements)if(p.fallbackName)assert.equal(scene.getObjectByName(p.fallbackName).visible,true,p.fallbackName);
    models.dispose();assert.deepEqual(cache.stats(),{entries:0,loaded:0,loading:0,leases:0,idle:0});
  }
});

test('leaving a loading northern region for Rome retires stale responses and preserves the current stage',async()=>{
  const oldCamp=camp(1),nextCamp=camp(12),oldPlacements=sceneryPlacements(oldCamp,{chapter:1}),nextPlacements=sceneryPlacements(nextCamp,{chapter:12});
  const all=[...oldPlacements,...nextPlacements],oldUrls=new Set(oldPlacements.map(p=>p.url)),deferred=new Map(),fresh=new Map(),retired=[];
  const cache=createSceneryModelCache({load:url=>{
    if(oldUrls.has(url)&&!deferred.has(url))return new Promise(resolve=>deferred.set(url,resolve));
    const source=trackedSource(url,all);fresh.set(url,source);return Promise.resolve(source.root);
  }});
  const oldScene=fallbackScene(oldPlacements),old=createSceneryModels(oldScene,oldCamp,{chapter:1,cache});
  await Promise.resolve();await Promise.resolve();assert.equal(deferred.size,oldUrls.size);
  old.dispose();assert.equal(cache.stats().entries,0,'Abandoned downloads hold no residency');
  const nextScene=fallbackScene(nextPlacements),next=createSceneryModels(nextScene,nextCamp,{chapter:12,cache});
  assert.equal((await next.ready).length,nextPlacements.length);
  for(const [url,resolve]of deferred){const source=trackedSource(url,all);retired.push(source);resolve(source.root);}
  assert.deepEqual(await old.ready,[],'Obsolete responses never attach to the new region');
  for(const source of retired)assert.deepEqual(source.disposed,{geometry:1,material:1,texture:1});
  for(const source of fresh.values())assert.deepEqual(source.disposed,{geometry:0,material:0,texture:0},'The current stage still owns its resources');
  assert.equal(next.group.children.length,nextPlacements.length);
  for(const p of nextPlacements)if(p.fallbackName)assert.equal(nextScene.getObjectByName(p.fallbackName).visible,false);
  next.dispose();cache.clear();
  for(const source of fresh.values())assert.deepEqual(source.disposed,{geometry:1,material:1,texture:1});
  for(const p of nextPlacements)if(p.fallbackName)assert.equal(nextScene.getObjectByName(p.fallbackName).visible,true);
  assert.equal(cache.stats().entries,0);
});

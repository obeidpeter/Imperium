import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/three/addons/libs/meshopt_decoder.module.js';
import * as G from '../src/core/game.js';
import {clone} from '../src/core/shared.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {chapterOfflineAssets} from '../src/ui/art.js';
import {SCENERY_MODELS,sceneryModelUrl,sceneryPlacements,createSceneryModels,warmSceneryModel,sceneryMaster,preloadSceneryModels,sceneryResidency,sceneryWorkingSet} from '../src/showcase/scenery-models.js';
import {inspectModel,budgetProblems} from '../scripts/assets/check-model.mjs';
import {createSceneryOcclusion} from '../src/showcase/environment-occlusion.js';
import {createModelLoader} from '../src/showcase/model-loader.js';
import {useNodeWorkers} from './node-workers.mjs';
import {createSceneryModelCache} from '../src/showcase/scenery-cache.js';
import {WORLD_CATALOG,worldModelUrl} from '../src/ui/world-catalog.js';

const root=new URL('../',import.meta.url),file=path=>readFile(new URL(path,root));
const manifest=JSON.parse(await file('docs/asset-manifest.json'));
const generated=Object.entries(SCENERY_MODELS).flatMap(([chapter,set])=>set.models.map(m=>({chapter:Number(chapter),...m,path:sceneryModelUrl(m.id)})));
// Chapter V starts reached from New Game through public commands.
let starts=null,campStarts=null;
function chapterFiveStarts(){
  if(starts)return starts;starts=[];campStarts=[];const camps=new Map();
  runCommandCampaign({onCheckpoint:s=>camps.set(G.getChapter(s).encounters[s.encounterIndex].id,clone(s))});
  for(const id of ['ch5-mine','ch5-wall']){const s=clone(camps.get(id));campStarts.push(clone(s));assert.ok(G.startEncounter(s).ok);starts.push(s.encounter);}
  return starts;
}
// Node has no image decoder: geometry loads in full with placeholder textures.
async function loadFile(url){
  const bytes=await file(url),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}

test('generated scenery downloads only with its explicitly authored chapter packs', () => {
  const files=['./assets/models/roman-human-v017.glb',...generated.map(m=>'./'+m.path)];
  for(let chapter=1;chapter<=12;chapter++){
    const group=chapterOfflineAssets(chapter,files);
    for(const m of generated)assert.equal(group.includes('./'+m.path),WORLD_CATALOG[m.id].chapters.includes(chapter),`${m.id} in chapter ${chapter}`);
    assert.ok(group.includes('./assets/models/roman-human-v017.glb'),'Shared anatomy stays in every chapter');
  }
});

test('every generated model has its request, licence, manifest entry and budget', async () => {
  assert.equal(generated.length,9);
  for(const m of generated){
    const request=JSON.parse(await file(`art-source/models/requests/${m.id}.json`)),entry=manifest.assets.find(a=>a.path===m.path);
    assert.ok(request.provenance.taskId&&request.provenance.rawSha256,`${m.id} records its Tripo task`);
    assert.match(request.provenance.licence,/rights to use, modify, distribute and commercially exploit/);
    assert.ok(entry,`${m.id} has provenance in the asset manifest`);assert.equal(entry.source.taskId,request.provenance.taskId);
    const info=await inspectModel(await file(m.path)),b=request.budget;
    assert.deepEqual(budgetProblems(info,{bytes:b.bytes,triangles:b.triangles,texture:b.texture,minHeight:b.minHeight,maxHeight:b.maxHeight}),[],m.id);
    assert.equal(info.bytes,entry.export.bytes);assert.equal(info.triangles,entry.export.triangles,`${m.id} records the shipped triangle count`);
    assert.equal(info.base,0,'Each model stands on its base at the origin');
    assert.deepEqual([...info.extensionsRequired].sort(),['EXT_meshopt_compression','KHR_texture_basisu'],`${m.id} ships compressed`);
  }
});

test('Chapter V props stay outside tactical, real-time and camp boards', () => {
  for(const e of [...chapterFiveStarts(),{id:'ch5-mine',width:24,height:24},{id:'ch5-wall',width:24,height:24},{id:'ch5-camp',width:20,height:16}]){
    const placed=sceneryPlacements(e,{chapter:5}),hx=e.width*1.25,hz=e.height*1.25;
    const props=placed.filter(p=>!p.component);assert.equal(props.length,9,e.id);
    for(const p of placed)assert.ok(Math.abs(p.x)>hx+1.5||Math.abs(p.z)>hz+1.5,`${e.id}: ${p.id} at ${p.x.toFixed(1)}, ${p.z.toFixed(1)} is off the ${hx*2} × ${hz*2} m board`);
    assert.deepEqual(sceneryPlacements(e,{chapter:5}),placed,'Placement is fixed data, not randomness');
    assert.deepEqual(sceneryPlacements(e,{chapter:4}),[]);assert.deepEqual(sceneryPlacements({...e,id:'ch5-elsewhere'},{chapter:5}),[]);
    for(const [i,a] of props.entries())for(const b of props.slice(i+1))assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=2.4,`${a.id} and ${b.id} keep their footprints apart`);
  }
});

test('household scenery follows only the confirmed camp outcome without touching the encounter',()=>{
  const e={id:'ch5-camp',width:30,height:24,campPresentation:{civilianOutcome:'waiting'}},before=structuredClone(e);
  const waiting=sceneryPlacements(e,{chapter:5});assert.deepEqual(e,before);
  const departing=sceneryPlacements({...e,campPresentation:{civilianOutcome:'departing'}},{chapter:5});
  const bundles=list=>list.find(p=>p.id==='ch5-household-bundles');
  assert.notDeepEqual(bundles(waiting),bundles(departing));
  assert.deepEqual(bundles(waiting),bundles(sceneryPlacements({...e,campPresentation:{civilianOutcome:'delayed'}},{chapter:5})));
  assert.ok(sceneryPlacements({id:'ch1-camp',width:30,height:24},{chapter:1}).length>0,'the approved rollout now supplies Chapter I too');
});

test('interior props require a fully blocked authored pocket and fit inside it after rotation',async()=>{
  const terrain=Array.from({length:16},()=>Array(20).fill('sand')),
    cells=[{x:14,y:4},{x:15,y:4},{x:14,y:5},{x:15,y:5}];for(const c of cells)terrain[c.y][c.x]='rock';
  const pad={id:'ch5-cistern',kind:'cistern',x:12.5,z:-7.5,width:5,depth:5,cells};
  const e={id:'ch5-camp',width:20,height:16,terrain,campPresentation:{sceneryPads:[pad]}};
  const p=sceneryPlacements(e,{chapter:5}).find(p=>p.id===pad.id);assert.ok(p.pad);assert.deepEqual([p.x,p.z],[pad.x,pad.z]);
  const invalid=structuredClone(e);invalid.terrain[4][15]='sand';assert.equal(sceneryPlacements(invalid,{chapter:5}).find(p=>p.id===pad.id).pad,undefined,'an incomplete blocker cannot carry a solid prop');
  const scene=new T.Scene(),fallback=new T.Group();fallback.name=p.fallbackName;scene.add(fallback);
  const source=new T.Group(),geometry=new T.BoxGeometry(9,3,12),material=new T.MeshStandardMaterial();
  const mesh=new T.Mesh(geometry,material);mesh.position.set(2,1.5,-1);source.add(mesh);
  const models=createSceneryModels(scene,e,{chapter:5,load:async()=>source});await models.ready;
  const actual=models.group.getObjectByName(p.id),box=new T.Box3().setFromObject(actual,true),centre=box.getCenter(new T.Vector3());
  assert.ok(Math.abs(centre.x-pad.x)<1e-7&&Math.abs(centre.z-pad.z)<1e-7,'off-centre geometry is aligned to its authored footprint');
  assert.ok(box.min.x>=pad.x-pad.width/2+.29&&box.max.x<=pad.x+pad.width/2-.29&&box.min.z>=pad.z-pad.depth/2+.29&&box.max.z<=pad.z+pad.depth/2-.29);
  assert.equal(fallback.visible,false);models.dispose();assert.equal(fallback.visible,true);
});

test('the actual courtyard maps place all three service props on their collision pockets',()=>{
  chapterFiveStarts();
  for(const state of campStarts){
    const world=G.createCampWorld(state),e={...world.map,campPresentation:world.campPresentation};
    const placements=sceneryPlacements(e,{chapter:5}),pads=placements.filter(p=>p.pad);
    assert.deepEqual(pads.map(p=>p.id).sort(),['ch5-cistern','ch5-household-bundles','ch5-storage-jars']);
    for(const p of pads){const pad=world.campPresentation.sceneryPads.find(pad=>pad.id===p.id);assert.deepEqual([p.x,p.z],[pad.x,pad.z]);assert.ok(p.fallbackName);}
  }
});

test('shipped prop and kit footprints never overlap playable ground outside their authored courtyard pockets',async()=>{
  chapterFiveStarts();const world=G.createCampWorld(campStarts[0]);
  const scenes=[...starts,{id:'ch5-mine',width:24,height:24},{id:'ch5-wall',width:24,height:24},{...world.map,campPresentation:world.campPresentation}];
  const cache=createSceneryModelCache({load:loadFile});
  for(const e of scenes){
    const models=createSceneryModels(new T.Scene(),e,{chapter:5,cache}),hx=e.width*1.25,hz=e.height*1.25;
    assert.equal((await models.ready).length,models.placements.length,e.id+' loads every intended instance');
    for(const p of models.placements){
      const model=models.group.getObjectByName(p.key??p.id),box=new T.Box3().setFromObject(model,true);
      if(p.pad){const pad=e.campPresentation.sceneryPads.find(pad=>pad.id===p.id);assert.ok(box.min.x>=pad.x-pad.width/2+.29&&box.max.x<=pad.x+pad.width/2-.29&&box.min.z>=pad.z-pad.depth/2+.29&&box.max.z<=pad.z+pad.depth/2-.29,p.id+' fits its blocked pocket');}
      else assert.ok(box.max.x < -hx || box.min.x > hx || box.max.z < -hz || box.min.z > hz,`${e.id}: ${p.key??p.id} actual geometry clears the playable rectangle`);
    }
    models.dispose();
  }
  cache.clear();assert.equal(cache.stats().entries,0);
});

test('the loader grounds each model on its lowest sample, never takes picks, skips Performance quality and releases everything', async () => {
  const [e]=chapterFiveStarts(),slope=(x,z)=>.05*x+.02*z;
  // The real processed files, loaded from disk.
  let scene=new T.Scene(),models=createSceneryModels(scene,e,{chapter:5,heightAt:slope,load:loadFile});
  assert.deepEqual([...(await models.ready)].sort(),models.placements.map(m=>m.key??m.id).sort());
  for(const model of models.group.children){
    const box=new T.Box3().setFromObject(model,true),corners=[[box.min.x,box.min.z],[box.max.x,box.max.z],[box.min.x,box.max.z],[box.max.x,box.min.z]];
    const placement=models.placements.find(p=>(p.key??p.id)===model.name),expected=Number.isFinite(placement.groundY)?placement.groundY:Math.min(slope(model.position.x,model.position.z),...corners.map(([x,z])=>slope(x,z)));
    assert.ok(Math.abs(box.min.y-expected)<1e-6,`${model.name} stands on its authored waterfront plane or lowest sampled ground`);
    model.traverse(o=>{if(o.isMesh){assert.equal(o.raycast(),undefined);assert.ok(o.castShadow);}});
  }
  let disposed=0;models.group.traverse(o=>{if(o.isMesh){o.geometry.addEventListener('dispose',()=>disposed++);}});
  models.dispose();models.dispose();assert.ok(disposed>=5);assert.equal(scene.children.length,0);
  assert.equal(createSceneryModels(new T.Scene(),e,{chapter:5,quality:'performance',load:loadFile}).placements.length,0);
  // A model that fails to load is absent; one that arrives after disposal is released, not added.
  scene=new T.Scene();let finish;const late=new Promise(done=>{finish=done;});
  models=createSceneryModels(scene,e,{chapter:5,load:url=>url.includes('jars')?Promise.reject(new Error('offline')):url.includes('tent')?late:loadFile(url)});
  setTimeout(()=>{models.dispose();finish(new T.Group());},0);
  const ids=await models.ready;assert.ok(!ids.includes('ch5-storage-jars'));assert.equal(scene.children.length,0);
});

test('the camera cutaway covers the generated models like the rest of the scenery', async () => {
  const [e]=chapterFiveStarts(),environment=new T.Group(),wall=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());environment.add(wall);
  const occlusion=createSceneryOcclusion(environment),prepared=[];
  // Each model is readied (cutaway, shaders) before it joins the drawn scene.
  const models=createSceneryModels(new T.Scene(),e,{chapter:5,load:loadFile,prepare:async model=>{assert.equal(model.parent,null,'prepared before it is drawn');prepared.push(model.name);occlusion.add(model);}});await models.ready;
  const meshes=[];models.group.traverse(o=>{if(o.isMesh)meshes.push(o);});
  assert.equal(prepared.length,models.placements.length);assert.equal(occlusion.stats().meshes,meshes.length+1);
  assert.ok(meshes.every(m=>[m.material].flat().every(material=>material.userData.sceneryCutaway)),'Every opaque model mesh takes the cutaway shader');
  occlusion.dispose();models.dispose();wall.geometry.dispose();wall.material.dispose();
});

test('preloaded scenery is synchronous, shared across stages, and evicted after leaving its chapter', async () => {
  const [e]=chapterFiveStarts(),placements=sceneryPlacements(e,{chapter:5});
  assert.deepEqual(sceneryWorkingSet(e,{chapter:5}).sort(),[...new Set([...placements.map(p=>p.url),...['trees-arid','rocks-arid'].map(worldModelUrl)])].sort(),
    'the placed scenery and the region\'s tree and rock kits');
  assert.deepEqual(sceneryWorkingSet(e,{chapter:5,quality:'performance'}),[]);
  assert.deepEqual(await preloadSceneryModels(e,{chapter:5,quality:'performance'}),[],'Performance quality loads no scenery');
  assert.ok((await preloadSceneryModels(e,{chapter:5,load:loadFile})).every(Boolean));
  const masters=placements.map(p=>sceneryMaster(p.url));
  assert.ok(placements.every((p,i)=>sceneryMaster(p.url)===masters[i]));
  const meshes=root=>{const list=[];root.traverse(o=>{if(o.isMesh)list.push(o);});return list;};
  const models=createSceneryModels(new T.Scene(),e,{chapter:5,heightAt:()=>0});
  assert.equal(models.group.children.length,placements.length,'every model stands as the stage is built');
  assert.deepEqual([...(await models.ready)].sort(),placements.map(p=>p.key??p.id).sort());
  for(const [i,p]of placements.entries()){
    const copy=models.group.children.find(m=>m.name===(p.key??p.id)),own=meshes(copy),master=meshes(p.component?masters[i].getObjectByName(p.component):masters[i]);
    assert.equal(own.length,master.length);assert.ok(own.every((m,k)=>m.geometry===master[k].geometry&&m.material===master[k].material),'copies share geometry and materials');
    assert.ok(own.every(m=>m.raycast()===undefined&&m.castShadow),'copies never take picks');assert.notEqual(copy,masters[i]);
  }
  let freed=0;for(const master of masters)for(const m of meshes(master))m.geometry.addEventListener('dispose',()=>freed++);
  models.dispose();assert.equal(freed,0,'the current chapter retains its bounded warm masters');
  const next=createSceneryModels(new T.Scene(),e,{chapter:5});assert.equal(next.group.children.length,placements.length,'the next stage reuses them');await next.ready;
  await preloadSceneryModels({id:'ch6-eagle'},{chapter:6});assert.equal(freed,0,'an active stage owns its geometry even when the next chapter preloads');
  // Chapter VI plants Chapter V's region's trees and stones: its preload keeps those two kits.
  next.dispose();assert.ok(freed>0,'closing the old stage frees its no-longer-needed resources');assert.equal(sceneryResidency().entries,2);
  await preloadSceneryModels({id:'ch7-council'},{chapter:7,quality:'performance'});assert.equal(sceneryResidency().entries,0);
});

test('component instances replace only their matching fallback after successful preparation',async()=>{
  const e={id:'ch5-camp',width:30,height:24},placements=sceneryPlacements(e,{chapter:5}),kit=placements.filter(p=>p.component);
  const scene=new T.Scene(),source=new T.Group(),material=new T.MeshStandardMaterial(),geometry=new T.BoxGeometry(1,2,1);
  for(const component of new Set(kit.map(p=>p.component))){const part=new T.Group();part.name=component;part.add(new T.Mesh(geometry,material));source.add(part);}
  // Omit one node to model an incomplete or older cached kit. Its fallback stays.
  const missing=kit[0].component;source.remove(source.getObjectByName(missing));
  for(const p of kit){const fallback=new T.Group();fallback.name=p.fallbackName;scene.add(fallback);}
  const prepared=[];
  const models=createSceneryModels(scene,e,{chapter:5,load:async url=>url.includes('fortress-kit')?source:new T.Group(),prepare:async model=>{assert.equal(model.parent,null);prepared.push(model.name);}});
  await models.ready;
  for(const p of kit){assert.equal(scene.getObjectByName(p.fallbackName).visible,p.component===missing);const instance=models.group.getObjectByName(p.key);if(p.component!==missing){assert.ok(instance);assert.equal(instance.children.length,1,'only the named component is cloned');}}
  models.dispose();assert.ok(kit.every(p=>scene.getObjectByName(p.fallbackName).visible),'disposal restores the procedural scene');
  assert.ok(prepared.length>9);
});

test('a preload stays pinned under unrelated warm-up pressure and needs no late preparation at stage creation',async()=>{
  const e={id:'ch5-camp',width:20,height:16},placements=sceneryPlacements(e,{chapter:5});
  const load=async url=>{
    const root=new T.Group(),geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial();
    if(url.includes('fortress-kit'))for(const component of new Set(placements.filter(p=>p.component).map(p=>p.component))){const part=new T.Mesh(geometry,material);part.name=component;root.add(part);}
    else root.add(new T.Mesh(geometry,material));
    return root;
  };
  await preloadSceneryModels(e,{chapter:5,load});
  for(let i=0;i<20;i++)await warmSceneryModel(`test-pressure-${i}`,load);
  assert.equal(sceneryResidency().idle,12,'idle pressure is bounded while the ten pilot assets remain pinned');
  let prepared=0;const models=createSceneryModels(new T.Scene(),e,{chapter:5,prepare:async()=>{prepared++;}});
  assert.equal(models.group.children.length,placements.length,'all preloaded instances exist immediately behind the veil');
  assert.equal((await models.ready).length,placements.length);assert.equal(prepared,0,'the stage can compile everything together before its first frame');
  assert.equal(sceneryResidency().entries,12,'unrelated warm-up models are evicted when the stage claims its working set (the ten pilot assets and the region\'s tree and rock kits)');
  await preloadSceneryModels({id:'ch7-council'},{chapter:7,quality:'performance'});models.dispose();assert.equal(sceneryResidency().entries,0);
});

test('cancelled preparation retains geometry until compilation settles, but cancels unowned loads immediately',async()=>{
  const e={id:'ch5-camp',width:30,height:24},scene=new T.Scene(),geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial();
  const source=new T.Group();source.add(new T.Mesh(geometry,material));let freed=0,finish,compiling=false;
  geometry.addEventListener('dispose',()=>freed++);const compile=new Promise(resolve=>{finish=resolve;});
  const cache=createSceneryModelCache({maxIdle:0,load:async()=>source});
  const models=createSceneryModels(scene,e,{chapter:5,cache,prepare:async()=>{compiling=true;await compile;}});
  for(let turn=0;turn<10&&!compiling;turn++)await Promise.resolve();assert.ok(compiling);
  models.dispose();assert.equal(scene.children.length,0);assert.equal(freed,0,'GPU preparation still owns the geometry');
  finish();await models.ready;assert.equal(freed,1,'shared resources released exactly once after the last preparation');assert.equal(cache.stats().entries,0);
  const pendingCache=createSceneryModelCache({load:()=>new Promise(()=>{})}),abandoned=createSceneryModels(new T.Scene(),e,{chapter:5,cache:pendingCache});
  assert.equal(pendingCache.stats().loading,10);abandoned.dispose();assert.equal(pendingCache.stats().entries,0,'unresponsive requests cannot hold chapter residency');
});

test('failed late preparation keeps the procedural architecture visible',async()=>{
  const e={id:'ch5-camp',width:30,height:24},scene=new T.Scene(),source=new T.Group(),placements=sceneryPlacements(e,{chapter:5});
  const geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial();
  for(const p of placements.filter(p=>p.component)){
    const fallback=new T.Group();fallback.name=p.fallbackName;scene.add(fallback);
    if(!source.getObjectByName(p.component)){const part=new T.Mesh(geometry,material);part.name=p.component;source.add(part);}
  }
  const models=createSceneryModels(scene,e,{chapter:5,load:async()=>source,prepare:async()=>{throw Error('GPU unavailable');}});
  assert.deepEqual(await models.ready,[]);assert.equal(models.group.children.length,0);
  for(const p of placements.filter(p=>p.component))assert.ok(scene.getObjectByName(p.fallbackName).visible);
  models.dispose();
});

test('embedded textures load under the page Content Security Policy', async t => {
  // The policy allows blob: images, but not the blob: fetches and blob: workers three's ImageBitmapLoader and KTX2Loader would use.
  const page=await readFile(new URL('index.html',root),'utf8');
  const policy=Object.fromEntries(/http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(page)[1].split(';').map(d=>d.trim().split(/\s+/)).map(([name,...values])=>[name,values]));
  assert.deepEqual(policy['img-src'],["'self'",'data:','blob:']);assert.deepEqual(policy['connect-src'],["'self'"]);assert.deepEqual(policy['worker-src'],["'self'"]);
  // So the default loaders of generated scenery and bodies request each model and, once, the KTX2 transcoder,
  // and transcode the textures from the model's own bytes in the page's own worker.
  const node=useNodeWorkers(),decoded=[],saved=globalThis.createImageBitmap;
  globalThis.createImageBitmap=async blob=>{decoded.push(blob.type);return {width:4,height:4,close(){}};};
  t.after(()=>{node.restore();if(saved===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=saved;});
  const prop=new URL(generated[0].path,root).href,scene=await warmSceneryModel(prop),textures=new Set();
  scene.traverse(o=>{for(const value of Object.values(o.material??{}))if(value?.isTexture)textures.add(value);});
  assert.ok(textures.size>0&&[...textures].every(texture=>texture.isCompressedTexture&&texture.userData.decodedOffThread),'every texture was transcoded from the model\'s bytes');
  const {createActorBodyLibrary}=await import('../src/showcase/actor-bodies.js');
  assert.equal(await createActorBodyLibrary().warm('roman-recruit'),true);
  const local=url=>url.slice(root.href.length);
  assert.deepEqual(node.requests.map(local),[generated[0].path,'vendor/three/addons/libs/basis/basis_transcoder.wasm','assets/models/characters/roman-recruit.glb']);
  assert.deepEqual([...new Set(node.workers.map(local))],['vendor/three/addons/libs/basis/basis_worker.js']);assert.ok(node.workers.length<=2,'at most two transcoder workers');
  assert.deepEqual(decoded,[],'no image is decoded on the page');
});

test('embedded images decode from the model bytes, off the main thread, and fall back to image elements', async () => {
  // A WebP model (tests/models/webp-quad.glb): the shipped models are KTX2 since the asset foundation.
  const bytes=await file('tests/models/webp-quad.glb'),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  const fetchBefore=globalThis.fetch,fetched=[];globalThis.fetch=async url=>{fetched.push(String(url));throw Error('no fetch');};
  try{
    // createImageBitmap receives the GLB's own image bytes, never a URL.
    const decoded=[],decode=async(blob,options)=>{assert.ok(blob instanceof Blob);assert.ok(blob.size>0);decoded.push({type:blob.type,options});return {width:4,height:4,close(){}};};
    const scene=(await createModelLoader({decode}).parseAsync(buffer.slice(0),'')).scene,maps=[];
    scene.traverse(o=>{if(o.isMesh)for(const m of [o.material].flat())if(m.map)maps.push(m.map);});
    assert.ok(decoded.length>0&&maps.length>0,'the model has embedded images');
    assert.ok(maps.every(t=>t.userData.decodedOffThread&&t.image.width===4&&t.flipY===false),'glTF textures keep their orientation');
    assert.ok(decoded.every(d=>/^image\//.test(d.type)&&d.options.premultiplyAlpha==='none'&&d.options.colorSpaceConversion==='none'));
    // A refused decode falls back to the image-element path for that image.
    // (Browsers define self, which three's image-element path reads.)
    const prior=T.TextureLoader.prototype.load,elements=[],hadSelf='self' in globalThis;globalThis.self??=globalThis;
    T.TextureLoader.prototype.load=function(url,ready){elements.push(url);const t=new T.Texture();queueMicrotask(()=>ready(t));return t;};
    try{
      const fallback=(await createModelLoader({decode:async()=>{throw Error('unsupported image');}}).parseAsync(buffer.slice(0),'')).scene;
      let mapped=0;fallback.traverse(o=>{if(o.isMesh&&[o.material].flat().some(m=>m.map))mapped++;});
      assert.ok(elements.length>0&&mapped>0,'image elements decode what createImageBitmap refused');
    }finally{T.TextureLoader.prototype.load=prior;if(!hadSelf)delete globalThis.self;}
    assert.deepEqual(fetched,[],'nothing is fetched');
  }finally{globalThis.fetch=fetchBefore;}
});

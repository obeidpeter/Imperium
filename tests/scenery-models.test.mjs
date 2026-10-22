import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import * as G from '../src/core/game.js';
import {clone} from '../src/core/shared.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {chapterOfflineAssets} from '../src/ui/art.js';
import {SCENERY_MODELS,sceneryModelUrl,sceneryPlacements,createSceneryModels,warmSceneryModel,sceneryMaster,preloadSceneryModels} from '../src/showcase/scenery-models.js';
import {inspectModel,budgetProblems} from '../scripts/assets/check-model.mjs';
import {createSceneryOcclusion} from '../src/showcase/environment-occlusion.js';
import {createModelLoader} from '../src/showcase/model-loader.js';

const root=new URL('../',import.meta.url),file=path=>readFile(new URL(path,root));
const manifest=JSON.parse(await file('docs/asset-manifest.json'));
const generated=Object.entries(SCENERY_MODELS).flatMap(([chapter,set])=>set.models.map(m=>({chapter:Number(chapter),...m,path:sceneryModelUrl(m.id)})));
// Chapter V starts reached from New Game through public commands.
let starts=null;
function chapterFiveStarts(){
  if(starts)return starts;starts=[];const camps=new Map();
  runCommandCampaign({onCheckpoint:s=>camps.set(G.getChapter(s).encounters[s.encounterIndex].id,clone(s))});
  for(const id of ['ch5-mine','ch5-wall']){const s=clone(camps.get(id));assert.ok(G.startEncounter(s).ok);starts.push(s.encounter);}
  return starts;
}
// Node has no image decoder: geometry loads in full with placeholder textures.
async function loadFile(url){
  const bytes=await file(url),loader=new GLTFLoader();
  loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}

test('generated scenery downloads with its own chapter only, so Chapter I is unchanged', () => {
  const files=['./assets/models/roman-human-v017.glb',...generated.map(m=>'./'+m.path)];
  for(let chapter=1;chapter<=12;chapter++){
    const group=chapterOfflineAssets(chapter,files);
    for(const m of generated)assert.equal(group.includes('./'+m.path),m.chapter===chapter,`${m.id} in chapter ${chapter}`);
    assert.ok(group.includes('./assets/models/roman-human-v017.glb'),'Shared anatomy stays in every chapter');
  }
});

test('every generated model has its request, licence, manifest entry and budget', async () => {
  assert.equal(generated.length,5);
  for(const m of generated){
    const request=JSON.parse(await file(`art-source/models/requests/${m.id}.json`)),entry=manifest.assets.find(a=>a.path===m.path);
    assert.ok(request.provenance.taskId&&request.provenance.rawSha256,`${m.id} records its Tripo task`);
    assert.match(request.provenance.licence,/full rights to use, modify, distribute and commercially exploit/);
    assert.ok(entry,`${m.id} has provenance in the asset manifest`);assert.equal(entry.source.taskId,request.provenance.taskId);
    const info=await inspectModel(await file(m.path)),b=request.budget;
    assert.deepEqual(budgetProblems(info,{bytes:b.bytes,triangles:b.triangles,texture:b.texture,minHeight:b.minHeight,maxHeight:b.maxHeight}),[],m.id);
    assert.equal(info.bytes,entry.export.bytes);assert.equal(info.triangles,entry.export.triangles,`${m.id} records the shipped triangle count`);
    assert.equal(info.base,0,'Each model stands on its base at the origin');
  }
});

test('both Chapter V encounters place every model outside the playable board', () => {
  for(const e of chapterFiveStarts()){
    const placed=sceneryPlacements(e,{chapter:5}),hx=e.width*1.25,hz=e.height*1.25;
    assert.equal(placed.length,5,e.id);
    for(const p of placed)assert.ok(Math.abs(p.x)>hx+1.5||Math.abs(p.z)>hz+1.5,`${e.id}: ${p.id} at ${p.x.toFixed(1)}, ${p.z.toFixed(1)} is off the ${hx*2} × ${hz*2} m board`);
    assert.deepEqual(sceneryPlacements(e,{chapter:5}),placed,'Placement is fixed data, not randomness');
    assert.deepEqual(sceneryPlacements(e,{chapter:4}),[]);assert.deepEqual(sceneryPlacements({...e,id:'ch5-elsewhere'},{chapter:5}),[]);
    for(const [i,a] of placed.entries())for(const b of placed.slice(i+1))assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=2.4,`${a.id} and ${b.id} keep their footprints apart`);
  }
});

test('the loader grounds each model on its lowest sample, never takes picks, skips Performance quality and releases everything', async () => {
  const [e]=chapterFiveStarts(),slope=(x,z)=>.05*x+.02*z;
  // The real processed files, loaded from disk.
  let scene=new T.Scene(),models=createSceneryModels(scene,e,{chapter:5,heightAt:slope,load:loadFile});
  assert.deepEqual([...(await models.ready)].sort(),generated.map(m=>m.id).sort());
  for(const model of models.group.children){
    const box=new T.Box3().setFromObject(model,true),corners=[[box.min.x,box.min.z],[box.max.x,box.max.z],[box.min.x,box.max.z],[box.max.x,box.min.z]];
    assert.ok(Math.abs(model.position.y-Math.min(slope(model.position.x,model.position.z),...corners.map(([x,z])=>slope(x,z))))<1e-9);
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
  assert.equal(prepared.length,5);assert.equal(occlusion.stats().meshes,meshes.length+1);
  assert.ok(meshes.every(m=>[m.material].flat().every(material=>material.userData.sceneryCutaway)),'Every opaque model mesh takes the cutaway shader');
  occlusion.dispose();models.dispose();wall.geometry.dispose();wall.material.dispose();
});

test('preloaded scenery stands as a stage is built, sharing session masters that no stage frees', async () => {
  const [e]=chapterFiveStarts(),placements=sceneryPlacements(e,{chapter:5});
  assert.deepEqual(await preloadSceneryModels(e,{chapter:5,quality:'performance'}),[],'Performance quality loads no scenery');
  const masters=await Promise.all(placements.map(p=>warmSceneryModel(p.url,loadFile)));
  assert.ok(placements.every((p,i)=>sceneryMaster(p.url)===masters[i]));
  const meshes=root=>{const list=[];root.traverse(o=>{if(o.isMesh)list.push(o);});return list;};
  const models=createSceneryModels(new T.Scene(),e,{chapter:5,heightAt:()=>0});
  assert.equal(models.group.children.length,placements.length,'every model stands as the stage is built');
  assert.deepEqual([...(await models.ready)].sort(),placements.map(p=>p.id).sort());
  for(const [i,p]of placements.entries()){
    const copy=models.group.children.find(m=>m.name===p.id),own=meshes(copy),master=meshes(masters[i]);
    assert.equal(own.length,master.length);assert.ok(own.every((m,k)=>m.geometry===master[k].geometry&&m.material===master[k].material),'copies share geometry and materials');
    assert.ok(own.every(m=>m.raycast()===undefined&&m.castShadow),'copies never take picks');assert.notEqual(copy,masters[i]);
  }
  let freed=0;for(const master of masters)for(const m of meshes(master))m.geometry.addEventListener('dispose',()=>freed++);
  models.dispose();assert.equal(freed,0,'a stage never frees the session masters');
  const next=createSceneryModels(new T.Scene(),e,{chapter:5});assert.equal(next.group.children.length,placements.length,'the next stage reuses them');next.dispose();
});

test('embedded textures load under the page Content Security Policy', async t => {
  // The policy allows blob: images but not blob: fetches, which three's ImageBitmapLoader would make.
  const page=await readFile(new URL('index.html',root),'utf8');
  const policy=Object.fromEntries(/http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(page)[1].split(';').map(d=>d.trim().split(/\s+/)).map(([name,...values])=>[name,values]));
  assert.deepEqual(policy['img-src'],["'self'",'data:','blob:']);assert.deepEqual(policy['connect-src'],["'self'"]);
  // So the default loaders of generated scenery and bodies request only the model itself, and decode its images from its own bytes.
  const requests=[],decoded=[],saved={fetch:globalThis.fetch,createImageBitmap:globalThis.createImageBitmap,ProgressEvent:globalThis.ProgressEvent};
  globalThis.ProgressEvent??=class extends Event{constructor(type,init={}){super(type);Object.assign(this,init);}}; // Node has none; three reports download progress with it.
  globalThis.fetch=async input=>{const url=String(input?.url??input);requests.push(url);if(!url.startsWith('file:'))throw new TypeError(`connect-src refuses ${url}`);return new Response(await readFile(new URL(url)));};
  globalThis.createImageBitmap=async(blob,options)=>{decoded.push({type:blob.type,options});return {width:4,height:4,close(){}};};
  t.after(()=>Object.assign(globalThis,saved));
  const prop=new URL(generated[0].path,root).href,scene=await warmSceneryModel(prop),textures=new Set();
  scene.traverse(o=>{for(const value of Object.values(o.material??{}))if(value?.isTexture)textures.add(value);});
  assert.deepEqual(requests,[prop]);assert.ok(textures.size>0&&[...textures].every(texture=>texture.userData.decodedOffThread),'every texture came from the model\'s bytes');
  const {createActorBodyLibrary}=await import('../src/showcase/actor-bodies.js'),{BITMAP_OPTIONS}=await import('../src/showcase/model-loader.js');
  assert.equal(await createActorBodyLibrary().warm('roman-recruit'),true);
  assert.equal(requests.length,2);assert.match(requests[1],/^file:.*\/assets\/models\/characters\/roman-recruit\.glb$/);
  assert.ok(decoded.length>=textures.size&&decoded.every(d=>/^image\//.test(d.type)&&d.options===BITMAP_OPTIONS),'decoded with createImageBitmap, as stored');
});

test('embedded images decode from the model bytes, off the main thread, and fall back to image elements', async () => {
  const bytes=await file(sceneryModelUrl('ch5-storage-jars')),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
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

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import * as G from '../src/core/game.js';
import {clone} from '../src/core/shared.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {chapterOfflineAssets} from '../src/ui/art.js';
import {SCENERY_MODELS,sceneryModelUrl,sceneryPlacements,createSceneryModels} from '../src/showcase/scenery-models.js';
import {inspectModel,budgetProblems} from '../scripts/assets/check-model.mjs';
import {createSceneryOcclusion} from '../src/showcase/environment-occlusion.js';

const root=new URL('../',import.meta.url),file=path=>readFile(new URL(path,root));
const manifest=JSON.parse(await file('docs/asset-manifest.json'));
const generated=Object.entries(SCENERY_MODELS).flatMap(([chapter,set])=>set.models.map(m=>({chapter:Number(chapter),...m,path:sceneryModelUrl(chapter,m.id)})));
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

test('embedded textures load under the page Content Security Policy', async () => {
  // The policy allows blob: images but not blob: fetches (ImageBitmapLoader fetches).
  const page=await readFile(new URL('index.html',root),'utf8'),source=await readFile(new URL('src/showcase/scenery-models.js',root),'utf8');
  assert.match(page,/img-src 'self' data: blob:;[^"]*connect-src 'self';/);
  assert.match(source,/loader\.register\(parser=>\{parser\.textureLoader=new T\.TextureLoader\(parser\.options\.manager\);/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/three/addons/libs/meshopt_decoder.module.js';
import * as G from '../src/core/game.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {inspectModel,budgetProblems} from '../scripts/assets/check-model.mjs';
import {stageEncounter} from '../src/showcase/live-figures.js';
import {gridToWorld,roadSegments,createGroundHeight} from '../src/showcase/environment-layout.js';
import {createRoadSurfaceSampler} from '../src/showcase/environment-road-surface.js';
import {regionalPlacementBounds} from '../src/showcase/environment-regional-world.js';
import {fieldModelUrls,fieldObjectModel,fieldModelPlacements,createFieldModelPieces,battlePropPlacements} from '../src/showcase/field-models.js';
import {createBattlefieldFeatures} from '../src/showcase/battlefield-features.js';
import {sceneryPlacements,createSceneryModels,SCENERY_IDLE_MASTERS} from '../src/showcase/scenery-models.js';
import {createSceneryModelCache} from '../src/showcase/scenery-cache.js';
import {FIELD_OBJECT_MODELS,BATTLE_PROP_MODELS,WORLD_CATALOG,chapterWorldFiles,desktopOnlyWorldFiles,worldAssetShown,worldModelUrl} from '../src/ui/world-catalog.js';

// Release G5 of the graphics plan (docs/graphics-tripo-plan.md): battle and siege. Its pilot's six models: the
// battles' supply cart and its load, the timber barricade and Chapter V's Persian ram, drawn on their field objects'
// cells in place of the code-built pieces, and two set pieces beyond the board's west edge, a carroballista in the
// field battles and an onager in the sieges. Presentation only: these tests prove where models stand, from battles
// reached by legal commands, not anything a player does.
const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const PILOT=['g5-cart','g5-cart-load','g5-barricade','g5-ram','g5-carroballista','g5-onager'];
const saves=new Map();let campaign;
function battles(){
  campaign??=runCommandCampaign({featureEdition:35,onCheckpoint:s=>{const e=G.getChapter(s).encounters[s.encounterIndex];if(!saves.has(e.id))saves.set(e.id,G.serialize(s));}});
  const out=[];
  for(const [id,save]of saves){
    const s=G.deserialize(save);if(!G.startEncounter(s,{controls:'realtime'}).ok)continue;
    const world=G.realtimeWorld(s);if(!world||s.encounter.kind!=='battle')continue;
    out.push({id,chapter:world.chapter,e:stageEncounter(s.encounter,world)});
  }
  return out;
}
// Node has no image decoder: geometry loads in full with placeholder textures.
async function loadFile(url){
  const bytes=await readFile(new URL(url,root)),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}
const models=async ids=>new Map(await Promise.all(ids.map(async id=>[id,await loadFile(worldModelUrl(id))])));

test('release G5 spends within its authorisation and each batch\'s ceiling, and the balance moved by what the ledger records', async () => {
  const ledger=await read('art-source/models/graphics-g5-credits.json'),tasks=ledger.batches.flatMap(b=>b.tasks);
  const spent=tasks.reduce((sum,t)=>sum+t.accountedCredits,0);
  assert.equal(ledger.spentCredits,spent);assert.ok(spent<=ledger.authorization.credits,'Within the authorised credits');
  assert.equal(ledger.authorization.credits,1845);assert.equal(ledger.remainingAuthorization,ledger.authorization.credits-spent);
  for(const batch of ledger.batches){
    const own=batch.tasks.reduce((sum,t)=>sum+t.accountedCredits,0);assert.equal(batch.spentCredits,own,batch.batch);
    assert.ok(own<=batch.ceilingCredits,`${batch.batch} stays within its ceiling`);
    assert.equal(batch.balance.before-batch.balance.after,own,`${batch.batch}: the account moved by what was recorded`);
    for(const t of batch.tasks){
      assert.equal(t.status,'success',`${t.id} ${t.operation}`);assert.equal(t.accountedCredits,t.creditsReported,`${t.id}: as Tripo reported`);
      assert.equal(t.accountedCredits,t.expectedCredits,`${t.id}: at the measured price`);
      const request=await read(`art-source/models/requests/${t.id}.json`);assert.equal(request.provenance.taskId,t.taskId,`${t.id}: its request records the task`);
    }
  }
  // At most 20% of the release's generations rejected, or the release pauses (the plan's stop rule).
  const generations=tasks.filter(t=>t.operation==='text_to_model');
  assert.ok(generations.filter(t=>t.rejectedAtReview).length<=generations.length*.2,'Rejections within the stop rule');
});

test('every model G5 ships has its task in the ledger, its manifest entry and its budget, and the rejected attempt ships nowhere', async () => {
  const ledger=await read('art-source/models/graphics-g5-credits.json'),manifest=await read('docs/asset-manifest.json'),tasks=ledger.batches.flatMap(b=>b.tasks);
  const shipped=manifest.assets.filter(a=>a.source?.program==='graphics-g5');
  assert.deepEqual(shipped.map(a=>a.id).sort(),[...PILOT].sort());
  for(const entry of shipped){
    assert.equal(entry.path,worldModelUrl(entry.id),`${entry.id} is the file the catalog loads`);
    const request=await read(entry.source.prompt),p=request.provenance;
    assert.equal(tasks.find(t=>t.id===request.id&&t.operation==='text_to_model')?.taskId,p.taskId,`${entry.id}: its generation is in the ledger`);
    assert.equal(entry.source.taskId,p.taskId);assert.equal(entry.source.credits,20);
    assert.match(request.status,/^G5 pilot: processed, compressed and reviewed/,`${entry.id} is reviewed`);
    const info=await inspectModel(await readFile(new URL(entry.path,root))),b=request.budget;
    assert.deepEqual(budgetProblems(info,{bytes:b.bytes,triangles:b.triangles,texture:b.texture,minHeight:b.minHeight,maxHeight:b.maxHeight}),[],entry.id);
    assert.equal(info.bytes,entry.export.bytes);assert.equal(info.triangles,entry.export.triangles,`${entry.id} records the shipped triangle count`);
    assert.equal(info.base,0,'Each model stands on its base at the origin');
    assert.deepEqual([...info.extensionsRequired].sort(),['EXT_meshopt_compression','KHR_texture_basisu'],`${entry.id} ships compressed`);
  }
  for(const t of tasks.filter(t=>t.rejectedAtReview)){
    assert.ok(!shipped.some(e=>e.source.taskId===t.taskId),`${t.id} is not shipped`);
    assert.match((await read(`art-source/models/requests/${t.id}.json`)).status,/^G5 pilot: rejected/);
  }
});

test('each battle\'s supply cart, barricade and ram take their models in the states those draw; every other state and kind keeps its code-built piece', () => {
  const kinds=new Set();
  for(const {id,chapter,e}of battles()){
    // The training ground has no field objects, and no model.
    if(!e.field){assert.equal(e.type,'training',id);assert.deepEqual(fieldModelPlacements(e,{chapter,desktop:true}),[]);continue;}
    const before=JSON.stringify(e);
    for(const o of e.field.objects){
      kinds.add(o.kind);
      for(const state of ['available','secured','forgone','missed','intact','dismantled','active','burnt','unlit','burning','spent','open','closed']){
        const model=fieldObjectModel({...o,state},{chapter,desktop:true});
        const expected=o.gatePanel?null:o.kind==='stores'&&['available','secured','forgone','missed'].includes(state)&&chapter!==11?'g5-cart'
          :o.kind==='barricade'&&state==='intact'&&chapter>=3?'g5-barricade':o.kind==='ram'&&state==='active'&&chapter===5?'g5-ram':null;
        assert.equal(model,expected,`${id}: ${o.kind} ${state}${o.gatePanel?' (a gate\'s panel)':''}`);
      }
    }
    // Each modelled object stands on its cell: the cart and the ram at its centre, the barricade's two panels either
    // side of it east and west, and the load on the cart while the supplies are still to be recovered.
    const placements=fieldModelPlacements(e,{chapter,desktop:true});
    for(const o of e.field.objects){
      const mine=placements.filter(p=>p.object===o.id),model=fieldObjectModel(o,{chapter,desktop:true}),c=gridToWorld(o,e,2.5);
      if(!model){assert.equal(mine.length,0,`${id}: ${o.kind} keeps its code-built piece`);continue;}
      const carriers=mine.filter(p=>!p.on),loads=mine.filter(p=>p.on);
      assert.ok(carriers.every(p=>p.model===model));
      if(model==='g5-barricade'){
        assert.equal(carriers.length,2);assert.deepEqual(carriers.map(p=>Math.sign(p.x-c.x)).sort(),[-1,1],'one panel either side, east and west');
        assert.ok(carriers.every(p=>Math.abs(Math.abs(p.x-c.x)-.56)<1e-9&&Math.abs(p.z-c.z)<1e-9));
      }else{assert.equal(carriers.length,1);assert.ok(Math.abs(carriers[0].x-c.x)<1e-9&&Math.abs(carriers[0].z-c.z)<1e-9,`${id}: ${model} on its cell`);}
      assert.deepEqual(loads.map(p=>p.model),o.kind==='stores'&&o.state==='available'?['g5-cart-load']:[],`${id}: the load while the supplies are to be recovered`);
      for(const p of loads){assert.equal(p.on,'g5-cart');assert.ok(Math.hypot(p.x-c.x,p.z-c.z)<.5,'on the cart\'s bed');}
    }
    assert.equal(JSON.stringify(e),before,'presentation reads the encounter and changes nothing');
  }
  assert.ok(['stores','signal','barricade','brazier'].every(k=>kinds.has(k)),'the battles hold the kinds this test speaks for');
});

test('a cart stands only with its load while the supplies are to be recovered, so without the load the code-built cart stands', () => {
  const {e,chapter}=battles().find(b=>b.id==='ch3-station'),stores=e.field.objects.find(o=>o.kind==='stores');
  assert.equal(stores.state,'available');
  const without=fieldModelPlacements(e,{chapter,desktop:true,available:new Set(['g5-cart','g5-barricade'])});
  assert.ok(!without.some(p=>p.object===stores.id),'no cart without its load');
  assert.ok(without.some(p=>p.model==='g5-barricade'),'the barricade stands regardless');
  const secured={...e,field:{...e.field,objects:e.field.objects.map(o=>o===stores?{...o,state:'secured'}:o)}};
  assert.deepEqual(fieldModelPlacements(secured,{chapter,desktop:true,available:new Set(['g5-cart'])}).filter(p=>p.object===stores.id).map(p=>p.model),['g5-cart'],
    'secured, the cart stands empty');
  // On the web, Chapters I, VII and VIII take neither: their carts stay code-built.
  for(const chapter of [1,7,8])assert.equal(fieldObjectModel({kind:'stores',state:'available'},{chapter,desktop:false}),null,`Chapter ${chapter}'s web cart`);
});

test('the models stand in their cells, grounded, as plain meshes over the cached models (the scenery\'s shader programs), and leave the code-built pieces to every other object', async () => {
  const {e,chapter}=battles().find(b=>b.id==='ch5-wall'),masters=await models(['g5-cart','g5-cart-load','g5-barricade','g5-ram']);
  // Chapter V's sortie brings the ram; set it on the field as its phase does.
  const ram=e.field.objects.find(o=>o.kind==='ram')??{id:'ram-test',kind:'ram',state:'active',x:5,y:4};
  const field={...e,field:{...e.field,objects:[...e.field.objects.filter(o=>o.kind!=='ram'),{...ram,state:'active'}]}};
  const slope=(x,z)=>.03*x-.02*z,scene=new T.Scene();
  const features=createBattlefieldFeatures(scene,{heightAt:slope,fieldModels:masters});features.sync(field);
  const records=features.group.userData.fieldObjects,byKind=k=>records.find(r=>r.kind===k);
  for(const k of ['stores','barricade','ram'])assert.ok(byKind(k)?.model,`${k} is drawn by its model`);
  assert.ok(!byKind('signal')?.model&&!byKind('brazier')?.model,'the signal and the brazier stay code-built');
  for(const k of ['stores','barricade','ram'])assert.ok(!features.group.getObjectByName(`${k} · ${field.field.objects.find(o=>o.kind===k).state}`),`no code-built ${k}`);
  assert.ok(features.group.getObjectByName(`signal · ${field.field.objects.find(o=>o.kind==='signal').state}`),'the code-built signal station');
  const meshes=[];features.group.traverse(o=>{if(o.isMesh&&/^field model /.test(o.name))meshes.push(o);});
  // Plain meshes over the cached models' own geometry and materials: an instanced draw would compile the instanced
  // variant of the generated art's program, which no battle's scenery uses; the field's batching leaves them whole.
  const owned=new Set(),disposed=[];for(const master of masters.values())master.traverse(o=>{if(!o.isMesh)return;for(const r of [o.geometry,o.material]){owned.add(r);r.addEventListener('dispose',()=>disposed.push(r));}});
  assert.ok(meshes.length>=5);for(const m of meshes){assert.ok(!m.isInstancedMesh,`${m.name} is not instanced`);assert.ok(owned.has(m.geometry)&&owned.has(m.material),`${m.name} draws the cached model`);assert.ok(m.castShadow&&m.receiveShadow);}
  assert.equal(meshes.filter(m=>/g5-barricade/.test(m.name)).length,2,'two barricade panels');
  // Each stands within reach of its cell and on the ground: the cart and the barricade inside it, the ram's three
  // metres a little over its ends.
  for(const k of ['stores','barricade','ram']){
    const r=byKind(k),o=field.field.objects.find(o=>o.kind===k),c=gridToWorld(o,field,2.5),[minX,minY,minZ]=r.min,[maxX,maxY,maxZ]=r.max;
    const reach=k==='ram'?1.7:1.3;
    assert.ok(minX>c.x-reach&&maxX<c.x+reach&&minZ>c.z-1.3&&maxZ<c.z+1.3,`${k} within its cell (${(maxX-minX).toFixed(2)} by ${(maxZ-minZ).toFixed(2)} m)`);
    const lowest=Math.min(...[[minX,minZ],[minX,maxZ],[maxX,minZ],[maxX,maxZ]].map(([x,z])=>slope(x,z)));
    assert.ok(minY<=lowest+.05&&minY>=lowest-.6,`${k} grounded`);
    if(k==='barricade')assert.ok(maxX-minX>2.1&&maxZ-minZ<1.2,'the barricade spans its cell east to west');
  }
  assert.deepEqual(features.stats().fieldModels,{models:4,instances:5,drawn:meshes.length});
  features.dispose();
  assert.deepEqual(disposed,[],'the cache keeps its geometry and materials');
  // Without the models the code-built pieces stand, as on Performance.
  const plain=createBattlefieldFeatures(new T.Scene(),{heightAt:slope});plain.sync(field);
  assert.ok(plain.group.userData.fieldObjects.every(r=>!r.model));assert.ok(plain.group.getObjectByName(`stores · ${field.field.objects.find(o=>o.kind==='stores').state}`));
  plain.dispose();
});

test('the set pieces stand beyond the west edge in their own battles, clear of the roads that leave the board and of the scene\'s other scenery', async () => {
  const seen=new Map();
  for(const {id,chapter,e}of battles()){
    const all=sceneryPlacements(e,{chapter,desktop:true}),props=all.filter(p=>BATTLE_PROP_MODELS[p.id]),others=all.filter(p=>!BATTLE_PROP_MODELS[p.id]);
    const expected=Object.entries(BATTLE_PROP_MODELS).filter(([,m])=>m.encounters.includes(id)).map(([prop])=>prop);
    assert.deepEqual(props.map(p=>p.id),expected,`${id}'s set pieces`);
    const hx=e.width*1.25,hz=e.height*1.25,road=createRoadSurfaceSampler(roadSegments(e,2.5),2.5).distance;
    for(const p of props){
      seen.set(p.id,[...(seen.get(p.id)??[]),id]);
      const m=BATTLE_PROP_MODELS[p.id],w=m.fit.width/2,d=m.fit.depth/2;
      assert.ok(p.x+w< -hx&&p.x> -hx-9,`${id}: ${p.id} a few metres beyond the west edge`);assert.ok(Math.abs(p.z)+d<hz,`${id}: ${p.id} alongside the board`);
      assert.equal(p.yaw,Math.PI,'facing east');assert.deepEqual(p.fitWithin,m.fit);assert.ok(!p.fallbackName,'no code-built stand-in');
      for(const [x,z]of [[p.x,p.z],[p.x-w,p.z-d],[p.x-w,p.z+d],[p.x+w,p.z-d],[p.x+w,p.z+d]])assert.ok(road(x,z)>=2.4,`${id}: ${p.id} clear of the road`);
      for(const o of others){
        const b=o.component?regionalPlacementBounds(o):{minX:o.x-2.2,maxX:o.x+2.2,minZ:o.z-2.2,maxZ:o.z+2.2};
        assert.ok(p.x+w<=b.minX||p.x-w>=b.maxX||p.z+d<=b.minZ||p.z-d>=b.maxZ,`${id}: ${p.id} clear of ${o.id}`);
      }
    }
    assert.deepEqual(sceneryPlacements(e,{chapter,desktop:true}),all,'presentation is data, not randomness');
    // Neither stands in a camp or a contest, nor in the training ground.
    for(const kind of ['camp','contest'])assert.deepEqual(battlePropPlacements({...e,kind}),[],`no set piece in a ${kind}`);
  }
  for(const [id,m]of Object.entries(BATTLE_PROP_MODELS))assert.deepEqual(seen.get(id),m.encounters,`${id} in each of its battles`);
  // Drawn as scenery, on the ground, and never on Performance.
  const {e,chapter}=battles().find(b=>b.id==='ch9-city'),url=worldModelUrl('g5-onager'),slope=(x,z)=>.03*x-.02*z;
  const cache=createSceneryModelCache({load:u=>u===url?loadFile(u):Promise.resolve(new T.Group())});
  const scenery=createSceneryModels(new T.Scene(),e,{chapter,heightAt:slope,cache,desktop:true});await scenery.ready;
  const onager=scenery.group.getObjectByName('g5-onager');assert.ok(onager,'the onager is placed');
  const box=new T.Box3().setFromObject(onager),lowest=Math.min(...[[box.min.x,box.min.z],[box.min.x,box.max.z],[box.max.x,box.min.z],[box.max.x,box.max.z]].map(([x,z])=>slope(x,z)));
  assert.ok(box.min.y<=lowest+.05&&box.min.y>=lowest-.8,'grounded');
  scenery.dispose();cache.clear();
  assert.deepEqual(createSceneryModels(new T.Scene(),e,{chapter,quality:'performance',cache:createSceneryModelCache({load:async()=>new T.Group()})}).placements,[]);
});

test('the web carries a G5 model only where its chapter\'s download has room; the desktop app carries them all, a cart always with its load', () => {
  const ROOM={1:[],4:['g5-cart','g5-cart-load','g5-barricade'],7:[],8:[],9:['g5-carroballista','g5-onager'],10:['g5-carroballista','g5-barricade'],12:['g5-barricade']};
  const CHAPTERS={'g5-cart':[1,2,3,4,5,6,7,8,9,10,12],'g5-cart-load':[1,2,3,4,5,6,7,8,9,10,12],'g5-barricade':[3,4,5,6,7,8,9,10,12],'g5-ram':[5],
    'g5-carroballista':[7,8,9,10],'g5-onager':[4,5,9,12]};
  for(const id of PILOT){
    const entry=WORLD_CATALOG[id];assert.deepEqual(entry.files,[`assets/models/world/${id}.glb`]);assert.deepEqual(entry.chapters,CHAPTERS[id],`${id}'s chapters`);
    assert.deepEqual(entry.web,entry.chapters.filter(c=>!ROOM[c]||ROOM[c].includes(id)),`${id}'s web chapters`);
    for(let chapter=1;chapter<=12;chapter++){
      assert.equal(chapterWorldFiles(chapter,{desktop:true}).includes(entry.files[0]),entry.chapters.includes(chapter),`${id} in Chapter ${chapter}'s desktop pack`);
      assert.equal(chapterWorldFiles(chapter,{desktop:false}).includes(entry.files[0]),entry.web.includes(chapter),`${id} in Chapter ${chapter}'s web pack`);
      assert.equal(worldAssetShown(id,chapter,{desktop:true}),true);
    }
  }
  assert.deepEqual(WORLD_CATALOG['g5-cart'].web,WORLD_CATALOG['g5-cart-load'].web,'a cart and its load go together');
  assert.ok(!desktopOnlyWorldFiles().some(f=>/\/g5-/.test(f)),'every G5 model rides some web chapter');
  // The field objects' models follow their kinds' chapters, and a scene keeps every model it draws warm.
  assert.deepEqual(Object.keys(FIELD_OBJECT_MODELS).sort(),['g5-barricade','g5-cart','g5-cart-load','g5-ram']);
  for(const {id,chapter,e}of battles()){
    const urls=fieldModelUrls(e,{chapter,desktop:true}).map(([,u])=>u),scenery=new Set(sceneryPlacements(e,{chapter,desktop:true}).map(p=>p.url));
    assert.deepEqual(urls,Object.keys(FIELD_OBJECT_MODELS).filter(m=>FIELD_OBJECT_MODELS[m].chapters.includes(chapter)&&e.type!=='training').map(worldModelUrl),`${id}'s field models`);
    // The board kit, the tree and rock kits, the walls and the landmarks come to at most five more.
    assert.ok(scenery.size+urls.length+5<=SCENERY_IDLE_MASTERS,`${id}: ${scenery.size+urls.length} models and the kits`);
  }
});

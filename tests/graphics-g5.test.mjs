import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/three/addons/libs/meshopt_decoder.module.js';
import * as G from '../src/core/game.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';
import {playRealtime} from '../scripts/realtime-autoplay.mjs';
import {inspectModel,budgetProblems} from '../scripts/assets/check-model.mjs';
import {stageEncounter} from '../src/showcase/live-figures.js';
import {gridToWorld,roadSegments,distantRiverCentre,RIVER_WATER_LEVEL} from '../src/showcase/environment-layout.js';
import {createWaterSampler,createWaterLevelSampler,DISTANT_RIVER_LEVEL} from '../src/showcase/environment-water.js';
import {createRoadSurfaceSampler} from '../src/showcase/environment-road-surface.js';
import {regionalPlacementBounds} from '../src/showcase/environment-regional-world.js';
import {fieldModelUrls,fieldObjectModel,fieldModelPlacements,createFieldModelPieces,battlePropPlacements,aftermathDebrisPlacements} from '../src/showcase/field-models.js';
import {createBattlefieldFeatures} from '../src/showcase/battlefield-features.js';
import {sceneryPlacements,createSceneryModels,SCENERY_IDLE_MASTERS} from '../src/showcase/scenery-models.js';
import {createSceneryModelCache} from '../src/showcase/scenery-cache.js';
import {FIELD_OBJECT_MODELS,BATTLE_PROP_MODELS,AFTERMATH_DEBRIS_MODELS,WORLD_CATALOG,chapterWorldFiles,desktopOnlyWorldFiles,worldAssetShown,worldModelUrl} from '../src/ui/world-catalog.js';

// Release G5 of the graphics plan (docs/graphics-tripo-plan.md): battle and siege. The field objects drawn from
// generated models on their cells in place of the code-built pieces (the supply cart and its load, Roman and eastern;
// the timber barricade; the pitch brazier; Chapter V's Persian ram, siege ramp and countermine), the set
// pieces beyond the board (siege engines and their ammunition behind the Roman line, Roman siege works where the Romans
// attack a wall, a Gothic wagon laager and Persian siege works beyond the north edge, a patrol boat and a barge on the
// distant river beyond it), and on the walked field after a win, the beaten side's gear beside its fallen. Presentation only: these tests prove where models stand, from battles
// reached by legal commands, not anything a player does.
const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const PILOT=['g5-cart','g5-cart-load','g5-barricade','g5-ram','g5-carroballista','g5-onager'];
const FIRST=['g5-brazier','g5-countermine','g5-siege-ramp','g5-cart-east','g5-ballista','g5-shot-stack','g5-bolt-crate',
  'g5-siege-tower','g5-mantlets','g5-fascines','g5-wagon-gothic','g5-wagon-gothic-covered','g5-persian-tower','g5-persian-screens',
  'g5-debris-gothic','g5-debris-east','g5-debris-roman','g5-debris-standard'];
const FINAL=['g5-signal','g5-signal-east','g5-lusoria','g5-river-barge'];
const SHIPPED=[...PILOT,...FIRST,...FINAL];
const EAST=[5,6,9],CART_STATES=['available','secured','forgone','missed'];
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
// The model each kind takes in each state: the eastern battles (Chapters V, VI and IX) their own cart.
function expectedModel(o,state,chapter){
  if(o.gatePanel)return null;
  const east=EAST.includes(chapter);
  if(o.kind==='stores'&&CART_STATES.includes(state))return east?'g5-cart-east':'g5-cart';
  if(o.kind==='signal'&&CART_STATES.includes(state))return east?'g5-signal-east':'g5-signal';
  if(o.kind==='barricade'&&state==='intact'&&chapter>=3)return 'g5-barricade';
  if(o.kind==='brazier'&&['unlit','burning'].includes(state)&&chapter>=3)return 'g5-brazier';
  if(chapter!==5||state!=='active')return null;
  return {ram:'g5-ram',countermine:'g5-countermine','siege-engine':'g5-siege-ramp'}[o.kind]??null;
}

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

test('every model G5 ships has its task in the ledger, its manifest entry and its budget, and no rejected attempt ships', async () => {
  const ledger=await read('art-source/models/graphics-g5-credits.json'),manifest=await read('docs/asset-manifest.json'),tasks=ledger.batches.flatMap(b=>b.tasks);
  const shipped=manifest.assets.filter(a=>a.source?.program==='graphics-g5');
  assert.deepEqual(shipped.map(a=>a.id).sort(),[...SHIPPED].sort());
  for(const entry of shipped){
    assert.equal(entry.path,worldModelUrl(entry.id),`${entry.id} is the file the catalog loads`);
    const request=await read(entry.source.prompt),p=request.provenance;
    assert.equal(tasks.find(t=>t.id===request.id&&t.operation==='text_to_model')?.taskId,p.taskId,`${entry.id}: its generation is in the ledger`);
    assert.equal(entry.source.taskId,p.taskId);assert.equal(entry.source.credits,20);
    assert.match(request.status,/^G5 (pilot|first batch|final batch): processed, compressed and reviewed/,`${entry.id} is reviewed`);
    const info=await inspectModel(await readFile(new URL(entry.path,root))),b=request.budget;
    assert.deepEqual(budgetProblems(info,{bytes:b.bytes,triangles:b.triangles,texture:b.texture,minHeight:b.minHeight,maxHeight:b.maxHeight}),[],entry.id);
    assert.equal(info.bytes,entry.export.bytes);assert.equal(info.triangles,entry.export.triangles,`${entry.id} records the shipped triangle count`);
    assert.equal(info.base,0,'Each model stands on its base at the origin');
    assert.deepEqual([...info.extensionsRequired].sort(),['EXT_meshopt_compression','KHR_texture_basisu'],`${entry.id} ships compressed`);
  }
  for(const t of tasks.filter(t=>t.rejectedAtReview)){
    assert.ok(!shipped.some(e=>e.source.taskId===t.taskId),`${t.id} is not shipped`);
    assert.match((await read(`art-source/models/requests/${t.id}.json`)).status,/^G5 (pilot|first batch|final batch): rejected/);
  }
});

test('each battle\'s field objects take their models in the states those draw, the eastern battles their own; every other state and kind keeps its code-built piece', () => {
  const kinds=new Set();
  for(const {id,chapter,e}of battles()){
    // The training ground has no field objects, and no model.
    if(!e.field){assert.equal(e.type,'training',id);assert.deepEqual(fieldModelPlacements(e,{chapter,desktop:true}),[]);continue;}
    const before=JSON.stringify(e);
    for(const o of e.field.objects){
      kinds.add(o.kind);
      for(const state of [...CART_STATES,'intact','dismantled','active','disabled','burnt','unlit','burning','spent','open','closed']){
        assert.equal(fieldObjectModel({...o,state},{chapter,desktop:true}),expectedModel(o,state,chapter),`${id}: ${o.kind} ${state}${o.gatePanel?' (a gate\'s panel)':''}`);
      }
    }
    // Each modelled object stands on its cell: the Roman barricade's two panels either side of it east and west, every
    // other model at its centre, and the load on its cart's bed while the supplies are still to be recovered.
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
      for(const p of loads){assert.equal(p.on,model);assert.ok(Math.hypot(p.x-c.x,p.z-c.z)<.8,'on the cart\'s bed');assert.ok(p.lift>.5&&p.lift<.8);}
    }
    assert.equal(JSON.stringify(e),before,'presentation reads the encounter and changes nothing');
  }
  assert.ok(['stores','signal','barricade','brazier','countermine','siege-engine'].every(k=>kinds.has(k)),'the battles hold the kinds this test speaks for');
});

test('a cart stands only with its load while the supplies are to be recovered, so without the load the code-built cart stands', () => {
  for(const [battle,cart,barricade]of [['ch3-station','g5-cart','g5-barricade'],['ch6-eagle','g5-cart-east','g5-barricade']]){
    const {e,chapter}=battles().find(b=>b.id===battle),stores=e.field.objects.find(o=>o.kind==='stores');
    assert.equal(stores.state,'available');
    const without=fieldModelPlacements(e,{chapter,desktop:true,available:new Set([cart,barricade])});
    assert.ok(!without.some(p=>p.object===stores.id),`${battle}: no cart without its load`);
    if(e.field.objects.some(o=>o.kind==='barricade'))assert.ok(without.some(p=>p.model===barricade),'the barricade stands regardless');
    const secured={...e,field:{...e.field,objects:e.field.objects.map(o=>o===stores?{...o,state:'secured'}:o)}};
    assert.deepEqual(fieldModelPlacements(secured,{chapter,desktop:true,available:new Set([cart])}).filter(p=>p.object===stores.id).map(p=>p.model),[cart],
      'secured, the cart stands empty');
  }
  // On the web, Chapters I, VII and VIII take neither: their carts stay code-built.
  for(const chapter of [1,7,8])assert.equal(fieldObjectModel({kind:'stores',state:'available'},{chapter,desktop:false}),null,`Chapter ${chapter}'s web cart`);
});

// Every modelled field object of a battle drawn by its model as plain meshes over the cached model, grounded on a
// slope and within reach of its cell; the code-built pieces stand for the rest.
async function drawField(field,ids){
  const masters=await models(ids),slope=(x,z)=>.03*x-.02*z;
  const features=createBattlefieldFeatures(new T.Scene(),{heightAt:slope,fieldModels:masters});features.sync(field);
  const records=features.group.userData.fieldObjects,meshes=[];
  features.group.traverse(o=>{if(o.isMesh&&/^field model /.test(o.name))meshes.push(o);});
  const owned=new Set(),disposed=[];for(const master of masters.values())master.traverse(o=>{if(!o.isMesh)return;for(const r of [o.geometry,o.material]){owned.add(r);r.addEventListener('dispose',()=>disposed.push(r));}});
  // Plain meshes over the cached models' own geometry and materials: an instanced draw would compile the instanced
  // variant of the generated art's program, which no battle's scenery uses; the field's batching leaves them whole.
  for(const m of meshes){assert.ok(!m.isInstancedMesh,`${m.name} is not instanced`);assert.ok(owned.has(m.geometry)&&owned.has(m.material),`${m.name} draws the cached model`);assert.ok(m.castShadow&&m.receiveShadow);}
  for(const o of field.field.objects){
    const r=records.find(x=>x.id===o.id);if(!fieldObjectModel(o,{chapter:Number(/^ch(\d+)/.exec(field.id)[1]),desktop:true})){assert.ok(!r?.model,`${o.kind} stays code-built`);continue;}
    assert.ok(r?.model,`${o.kind} is drawn by its model`);assert.ok(!features.group.getObjectByName(`${o.kind} · ${o.state}`),`no code-built ${o.kind}`);
    const c=gridToWorld(o,field,2.5),[minX,minY,minZ]=r.min,[maxX,maxY,maxZ]=r.max,reach=o.kind==='ram'||o.kind==='stores'?1.75:1.3;
    assert.ok(minX>c.x-reach&&maxX<c.x+reach&&minZ>c.z-1.3&&maxZ<c.z+1.3,`${o.kind} within reach of its cell (${(maxX-minX).toFixed(2)} by ${(maxZ-minZ).toFixed(2)} m)`);
    const lowest=Math.min(...[[minX,minZ],[minX,maxZ],[maxX,minZ],[maxX,maxZ]].map(([x,z])=>slope(x,z)));
    assert.ok(minY<=lowest+.05&&minY>=lowest-.6,`${o.kind} grounded`);
  }
  return {features,records,meshes,disposed,slope};
}

test('the models stand in their cells, grounded, as plain meshes over the cached models (the scenery\'s shader programs), and leave the code-built pieces to every other object', async () => {
  const byId=Object.fromEntries(battles().map(b=>[b.id,b]));
  // A Roman field: the cart and its load, the barricade's two panels, the pitch brazier and the signal post (Chapter
  // III's station, whose web download carries them all).
  {
    const {e}=byId['ch3-station'],{features,records,meshes,disposed}=await drawField(e,['g5-cart','g5-cart-load','g5-barricade','g5-brazier','g5-signal']);
    assert.equal(meshes.filter(m=>/g5-barricade/.test(m.name)).length,2,'two barricade panels');
    const b=records.find(r=>r.kind==='barricade');assert.ok(b.max[0]-b.min[0]>2.1&&b.max[2]-b.min[2]<1.2,'the barricade spans its cell east to west');
    assert.ok(records.find(r=>r.kind==='signal')?.model,'the signal station is the Roman signal post');
    features.dispose();assert.deepEqual(disposed,[],'the cache keeps its geometry and materials');
  }
  // Chapter V's city: the eastern cart, the barricade, the brazier, the countermine and the Persian siege ramp, and the
  // ram its sortie brings (set on the field as its phase does).
  {
    const {e}=byId['ch5-wall'],ram=e.field.objects.find(o=>o.kind==='ram')??{id:'ram-test',kind:'ram',state:'active',x:5,y:4};
    const field={...e,field:{...e.field,objects:[...e.field.objects.filter(o=>o.kind!=='ram'),{...ram,state:'active'}]}};
    const ids=['g5-cart-east','g5-cart-load','g5-barricade','g5-brazier','g5-ram','g5-countermine','g5-siege-ramp','g5-signal-east'];
    const {features,meshes,disposed}=await drawField(field,ids);
    assert.deepEqual(features.stats().fieldModels,{models:ids.length,instances:ids.length+1,drawn:meshes.length},'one instance each, the barricade two');
    features.dispose();assert.deepEqual(disposed,[],'the cache keeps its geometry and materials');
    // Without the models the code-built pieces stand, as on Performance.
    const plain=createBattlefieldFeatures(new T.Scene(),{heightAt:()=>0});plain.sync(field);
    assert.ok(plain.group.userData.fieldObjects.every(r=>!r.model));assert.ok(plain.group.getObjectByName(`stores · ${field.field.objects.find(o=>o.kind==='stores').state}`));
    plain.dispose();
  }
});

test('a burning brazier drawn by its model keeps the stage\'s flame, on its heap of pitch', async () => {
  const {e}=battles().find(b=>b.id==='ch3-station'),brazier=e.field.objects.find(o=>o.kind==='brazier');
  const field={...e,field:{...e.field,objects:e.field.objects.map(o=>o===brazier?{...o,state:'burning'}:o)}};
  const masters=await models(['g5-brazier']),features=createBattlefieldFeatures(new T.Scene(),{heightAt:()=>0,fieldModels:masters});features.sync(field);
  const record=features.group.userData.fieldObjects.find(r=>r.id===brazier.id),plumes=[];
  features.group.traverse(o=>{if(o.name==='pitch flame and rising smoke')plumes.push(o);});
  assert.ok(record.model);assert.equal(plumes.length,1,'one flame');
  const [p]=plumes;assert.ok(Math.abs(p.position.y-(record.min[1]+FIELD_OBJECT_MODELS['g5-brazier'].flame))<1e-6,'at the model\'s flame height');
  assert.ok(p.position.y<record.max[1]&&p.position.y>record.max[1]-.3,'in the heap\'s top');
  assert.ok(p.position.x>record.min[0]&&p.position.x<record.max[0]&&p.position.z>record.min[2]&&p.position.z<record.max[2],'over the basket');
  features.dispose();
  // Unlit, the model stands with no flame.
  const cold=createBattlefieldFeatures(new T.Scene(),{heightAt:()=>0,fieldModels:masters});cold.sync(e);
  let flames=0;cold.group.traverse(o=>{if(o.name==='pitch flame and rising smoke')flames++;});assert.equal(flames,0);cold.dispose();
});

// Chapter II's rearguard: past the north edge the marsh's water and the distant river leave dry room for one wagon.
const NO_DRY_ROOM={'ch2-rearguard':['g5-wagon-gothic-covered']};
test('the set pieces stand beyond the board in their own battles, on dry ground or afloat on the distant river, clear of the roads that leave it, of the scene\'s other scenery and of each other', async () => {
  const seen=new Map();
  for(const {id,chapter,e}of battles()){
    // The animals beside a set piece stand with it, and are G4's to check (tests/graphics-g4.test.mjs).
    // A model placed many times over (the finale's vexilla, G2) stands at each of its instances.
    const all=sceneryPlacements(e,{chapter,desktop:true}),props=all.filter(p=>BATTLE_PROP_MODELS[p.id]),others=all.filter(p=>!BATTLE_PROP_MODELS[p.id]&&!BATTLE_PROP_MODELS[p.host])
      .flatMap(p=>p.instances?p.instances.map(({x,z})=>({id:p.id,x,z})):[p]);
    const expected=Object.entries(BATTLE_PROP_MODELS).filter(([prop,m])=>m.encounters.includes(id)&&!NO_DRY_ROOM[id]?.includes(prop)).map(([prop])=>prop);
    assert.deepEqual(props.map(p=>p.id),expected,`${id}'s set pieces`);
    const water=createWaterSampler(e,{chapter}),level=createWaterLevelSampler(e,{chapter});
    const hx=e.width*1.25,hz=e.height*1.25,road=createRoadSurfaceSampler(roadSegments(e,2.5),2.5).distance;
    const boxes=props.map(p=>{const m=BATTLE_PROP_MODELS[p.id];return {id:p.id,minX:p.x-m.fit.width/2,maxX:p.x+m.fit.width/2,minZ:p.z-m.fit.depth/2,maxZ:p.z+m.fit.depth/2};});
    for(const p of props){
      seen.set(p.id,[...(seen.get(p.id)??[]),id]);
      const m=BATTLE_PROP_MODELS[p.id],w=m.fit.width/2,d=m.fit.depth/2;
      if(m.beside){
        // Beside its engine, at its offset in the engine's frame or that offset mirrored.
        const host=props.find(q=>q.id===m.beside.model);assert.ok(host,`${id}: ${p.id} stands only by its engine`);
        assert.ok(Math.abs(Math.hypot(p.x-host.x,p.z-host.z)-Math.hypot(m.beside.x,m.beside.z))<1e-6,`${id}: ${p.id} beside ${m.beside.model}`);
        assert.equal(p.yaw,m.yaw??host.yaw);
      }else if(m.edge==='river'){
        // Afloat on the distant river beyond the north edge, along the board, sunk by its draft below the surface, and
        // wholly where that surface shows: not under a river that leaves the board and runs on over it, higher.
        const river=distantRiverCentre(e);
        assert.ok(p.z+d< -hz&&Math.abs(p.z-river)+d<=8,`${id}: ${p.id} on the distant river`);assert.ok(Math.abs(p.x)<=hx*.9+1e-9,`${id}: ${p.id} along the board`);
        assert.equal(p.groundY,DISTANT_RIVER_LEVEL-m.draft);assert.ok(m.draft>0&&m.draft<1,`${p.id} floats`);assert.equal(p.yaw,m.yaw);
        for(let i=0;i<=8;i++)for(let j=0;j<=8;j++)assert.equal(level(p.x-w+i*w/4,p.z-d+j*d/4),DISTANT_RIVER_LEVEL,`${id}: ${p.id} on the distant river's own surface`);
      }else if(m.edge==='north'){
        assert.ok(p.z+d< -hz&&p.z> -hz-9,`${id}: ${p.id} a few metres beyond the north edge`);assert.ok(Math.abs(p.x)+w<hx,`${id}: ${p.id} along the board`);
        assert.equal(p.yaw,m.yaw);
      }else{
        assert.ok(p.x+w< -hx&&p.x> -hx-9,`${id}: ${p.id} a few metres beyond the west edge`);assert.ok(Math.abs(p.z)+d<hz,`${id}: ${p.id} alongside the board`);
        assert.equal(p.yaw,m.yaw);
      }
      assert.deepEqual(p.fitWithin,m.fit);assert.ok(!p.fallbackName,'no code-built stand-in');
      for(const [x,z]of [[p.x,p.z],[p.x-w,p.z-d],[p.x-w,p.z+d],[p.x+w,p.z-d],[p.x+w,p.z+d]])assert.ok(road(x,z)>=2.4,`${id}: ${p.id} clear of the road`);
      for(let i=0;i<=4;i++)for(let j=0;j<=4;j++){
        const wet=water(p.x-w+i*w/2,p.z-d+j*d/2);assert.equal(wet,m.edge==='river',`${id}: ${p.id} ${m.edge==='river'?'wholly on the water':'on dry ground'}`);
      }
      for(const o of others){
        const b=o.component?regionalPlacementBounds(o):{minX:o.x-2.2,maxX:o.x+2.2,minZ:o.z-2.2,maxZ:o.z+2.2};
        assert.ok(p.x+w<=b.minX||p.x-w>=b.maxX||p.z+d<=b.minZ||p.z-d>=b.maxZ,`${id}: ${p.id} clear of ${o.id}`);
      }
    }
    for(const a of boxes)for(const b of boxes)if(a!==b)assert.ok(a.maxX<=b.minX||a.minX>=b.maxX||a.maxZ<=b.minZ||a.minZ>=b.maxZ,`${id}: ${a.id} clear of ${b.id}`);
    assert.deepEqual(sceneryPlacements(e,{chapter,desktop:true}),all,'presentation is data, not randomness');
    // None stands in a camp or a contest; the training ground has only the boats on its river.
    for(const kind of ['camp','contest'])assert.deepEqual(battlePropPlacements({...e,kind}),[],`no set piece in a ${kind}`);
    if(e.type==='training')assert.ok(props.every(p=>BATTLE_PROP_MODELS[p.id].edge==='river'),'the drill has no engines or wagons');
  }
  for(const [id,m]of Object.entries(BATTLE_PROP_MODELS))assert.deepEqual(seen.get(id),m.encounters.filter(b=>!NO_DRY_ROOM[b]?.includes(id)),`${id} in each of its battles`);
  // The water is the scene's own: the marsh reaches past the board's marsh, the distant river lies beyond the north
  // edge, Chapter V's Euphrates beyond the fortress, and the west of a dry field is dry.
  const at=id=>battles().find(b=>b.id===id),wet=(b,x,z)=>createWaterSampler(b.e,{chapter:b.chapter})(x,z);
  const marsh=at('ch2-rearguard'),mine=at('ch5-mine'),city=at('ch9-city');
  assert.ok(wet(marsh,0,-marsh.e.height*1.25-1),'the marsh\'s water just past the north edge');
  assert.ok(wet(marsh,0,distantRiverCentre(marsh.e)),'the distant river');
  // Where a river leaves the board it runs on, at its own level, over the near half of the distant river: the surface
  // seen there is the higher one.
  {
    const ferry=at('ch8-ferry'),level=createWaterLevelSampler(ferry.e,{chapter:ferry.chapter}),river=distantRiverCentre(ferry.e);
    const xs=[...new Set(Array.from({length:ferry.e.width},(_,x)=>x).filter(x=>level(gridToWorld({x,y:0},ferry.e,2.5).x,river+2)===RIVER_WATER_LEVEL))];
    assert.ok(xs.length>0,'Chapter VIII\'s river runs on over the distant river');
    for(const x of xs)assert.equal(level(gridToWorld({x,y:0},ferry.e,2.5).x,river-2),DISTANT_RIVER_LEVEL,'and the distant river\'s far half shows its own surface');
  }
  assert.ok(wet(mine,0,-mine.e.height*1.25-16),'Chapter V\'s Euphrates');
  assert.ok(!wet(city,-city.e.width*1.25-6,0),'the dry ground west of Palmyra\'s field');
  // Drawn as scenery, on the ground, within their room, and never on Performance.
  const {e,chapter}=battles().find(b=>b.id==='ch9-city'),slope=(x,z)=>.03*x-.02*z;
  const urls=new Set(['g5-onager','g5-siege-tower','g5-mantlets'].map(worldModelUrl));
  const cache=createSceneryModelCache({load:u=>urls.has(u)?loadFile(u):Promise.resolve(new T.Group())});
  const scenery=createSceneryModels(new T.Scene(),e,{chapter,heightAt:slope,cache,desktop:true});await scenery.ready;
  for(const id of ['g5-onager','g5-siege-tower','g5-mantlets']){
    const model=scenery.group.getObjectByName(id);assert.ok(model,`${id} is placed`);
    const box=new T.Box3().setFromObject(model),lowest=Math.min(...[[box.min.x,box.min.z],[box.min.x,box.max.z],[box.max.x,box.min.z],[box.max.x,box.max.z]].map(([x,z])=>slope(x,z)));
    assert.ok(box.min.y<=lowest+.05&&box.min.y>=lowest-.8,`${id} grounded`);
    const fit=BATTLE_PROP_MODELS[id].fit;assert.ok(box.max.x-box.min.x<=fit.width+1e-6&&box.max.z-box.min.z<=fit.depth+1e-6,`${id} within its room`);
  }
  scenery.dispose();cache.clear();
  assert.deepEqual(createSceneryModels(new T.Scene(),e,{chapter,quality:'performance',cache:createSceneryModelCache({load:async()=>new T.Group()})}).placements,[]);
  // The boats float at their draft below the river's surface, whatever the ground beneath, within their room.
  {
    const {e,chapter}=at('ch2-marsh'),boats=['g5-lusoria','g5-river-barge'],urls=new Set(boats.map(worldModelUrl));
    const cache=createSceneryModelCache({load:u=>urls.has(u)?loadFile(u):Promise.resolve(new T.Group())});
    const scenery=createSceneryModels(new T.Scene(),e,{chapter,heightAt:slope,cache,desktop:true});await scenery.ready;
    for(const id of boats){
      const model=scenery.group.getObjectByName(id);assert.ok(model,`${id} is placed`);
      const box=new T.Box3().setFromObject(model),m=BATTLE_PROP_MODELS[id];
      assert.ok(Math.abs(box.min.y-(DISTANT_RIVER_LEVEL-m.draft))<1e-6,`${id} floats ${m.draft} m deep`);
      assert.ok(box.max.x-box.min.x<=m.fit.width+1e-6&&box.max.z-box.min.z<=m.fit.depth+1e-6,`${id} within its room`);
      assert.ok(box.max.x-box.min.x>box.max.z-box.min.z,`${id} lies along the stream`);
    }
    scenery.dispose();cache.clear();
  }
});

test('on the walked field after a win the beaten side\'s gear lies beside its fallen, the first spot the war banner, and nothing before the win', async () => {
  // Each battle as the campaign reaches it by legal commands, played in real time to a win by the legal-command bot.
  battles();
  const begun=id=>{const s=G.deserialize(saves.get(id));assert.ok(G.startEncounter(s,{controls:'realtime'}).ok,id);return s;};
  const won=id=>{const s=begun(id);assert.equal(playRealtime(s).status,'won',`${id} is won`);return s;};
  for(const [battle,gear]of [['ch4-gate','g5-debris-gothic'],['ch6-eagle','g5-debris-east']]){
    const s=won(battle),before=G.serialize(s),world=G.createAftermathWorld(s),chapter=world.chapter,e=stageEncounter(s.encounter,world);
    const fallen=world.actors.filter(a=>a.side==='enemy'&&!a.alive);assert.ok(fallen.length>=3,`${battle}: the fallen lie on the field`);
    assert.deepEqual(e.aftermath.fallen.map(f=>f.id),fallen.map(a=>a.id),'the stage knows where each of the fallen lies');
    const spots=aftermathDebrisPlacements(e,{chapter,desktop:true}),hx=e.width*1.25,hz=e.height*1.25;
    assert.ok(spots.length>=2&&spots.length<=6,`${battle}: ${spots.length} spots`);
    assert.equal(spots[0].model,'g5-debris-standard','the first spot is the fallen war banner');
    assert.ok(spots.slice(1).every(p=>p.model===gear),`${battle}: the rest are ${gear}`);
    for(const p of spots){
      assert.ok(fallen.some(a=>Math.hypot(a.x-hx-p.x,a.z-hz-p.z)<1.2),`${battle}: ${p.object} beside one of the fallen`);
      assert.ok(Math.abs(p.x)<hx-1.5&&Math.abs(p.z)<hz-1.5,'on the board');
      for(const o of e.field.objects.filter(o=>Number.isInteger(o.x)&&Number.isInteger(o.y))){const c=gridToWorld(o,e,2.5);assert.ok(Math.hypot(c.x-p.x,c.z-p.z)>=2.2,`clear of ${o.id}`);}
      for(const q of spots)if(q!==p)assert.ok(Math.hypot(q.x-p.x,q.z-p.z)>=6,'spread over the field');
    }
    assert.deepEqual(aftermathDebrisPlacements(e,{chapter,desktop:true}),spots,'the same spots every time, drawn from no randomness');
    assert.equal(G.serialize(s),before,'the chronicle is unchanged');
    // Drawn by the field's features beside the field objects, as plain meshes over the cached models, where the web's
    // download carries them (the features run here as on the web): Chapter VI's carries the eastern gear but not the
    // banner, so its gear lies at every spot; Chapter IV's carries neither, and its field stays as it was.
    const web=aftermathDebrisPlacements(e,{chapter,desktop:false});
    assert.deepEqual(web.map(p=>[p.x,p.z]),chapter===6?spots.map(p=>[p.x,p.z]):[],`${battle}: the web's spots`);assert.ok(web.every(p=>p.model===gear));
    const masters=await models(['g5-debris-standard',gear]),features=createBattlefieldFeatures(new T.Scene(),{heightAt:()=>0,fieldModels:masters});features.sync(e);
    const pieces=new Set();features.group.traverse(o=>{if(o.isMesh&&/^field model g5-debris/.test(o.name))pieces.add(o.position.x.toFixed(2)+','+o.position.z.toFixed(2));});
    assert.equal(pieces.size>0,web.length>0,`${battle}: the gear is drawn where the download carries it`);
    features.dispose();
    // Before the win no gear lies anywhere: the fight's own stage carries no aftermath.
    const live=begun(battle),fighting=stageEncounter(live.encounter,G.realtimeWorld(live));assert.equal(fighting.aftermath,undefined);
    assert.deepEqual(aftermathDebrisPlacements(fighting,{chapter,desktop:true}),[]);
  }
  // The debris follows the chapter's enemy: Goths in the north, the eastern armies in the east, rival Romans at the last.
  assert.deepEqual(Object.fromEntries(Object.entries(AFTERMATH_DEBRIS_MODELS).map(([id,m])=>[id,m.chapters])),
    {'g5-debris-gothic':[1,2,3,4,7,8,10],'g5-debris-east':[5,6,9],'g5-debris-roman':[12],'g5-debris-standard':[1,2,3,4,5,6,7,8,9,10,12]});
});

test('the web carries a G5 model only where its chapter\'s download has room; the desktop app carries them all, a cart always with its load', () => {
  const ROOM={1:[],4:['g5-cart','g5-cart-load','g5-barricade'],6:['g5-cart-east','g5-cart-load','g5-barricade','g5-brazier','g5-debris-east'],
    7:[],8:[],9:['g5-carroballista','g5-onager'],10:['g5-carroballista','g5-barricade'],12:['g5-barricade']};
  const BATTLES=[1,2,3,4,5,6,7,8,9,10,12],WEST=[1,2,3,4,7,8,10,12],LATE=[3,4,5,6,7,8,9,10,12];
  const CHAPTERS={'g5-cart':WEST,'g5-cart-load':BATTLES,'g5-cart-east':EAST,'g5-barricade':LATE,'g5-brazier':LATE,
    'g5-ram':[5],'g5-countermine':[5],'g5-siege-ramp':[5],'g5-carroballista':[7,8,9,10],'g5-onager':[4,5,9,12],'g5-ballista':[4,5,9,12],
    'g5-shot-stack':[4,5,9,12],'g5-bolt-crate':[7,8,9,10],'g5-siege-tower':[9,12],'g5-mantlets':[9,12],'g5-fascines':[9,12],
    'g5-wagon-gothic':[1,2,3,4,7,8,10],'g5-wagon-gothic-covered':[1,2,3,4,7,8,10],'g5-persian-tower':[5],'g5-persian-screens':[5],
    'g5-debris-gothic':[1,2,3,4,7,8,10],'g5-debris-east':EAST,'g5-debris-roman':[12],'g5-debris-standard':BATTLES,
    'g5-signal':WEST,'g5-signal-east':EAST,'g5-lusoria':[1,2,4,8,10],'g5-river-barge':[1,2,4,8,10]};
  for(const id of SHIPPED){
    const entry=WORLD_CATALOG[id];assert.deepEqual(entry.files,[`assets/models/world/${id}.glb`]);assert.deepEqual(entry.chapters,CHAPTERS[id],`${id}'s chapters`);
    assert.deepEqual(entry.web,entry.chapters.filter(c=>!ROOM[c]||ROOM[c].includes(id)),`${id}'s web chapters`);
    for(let chapter=1;chapter<=12;chapter++){
      assert.equal(chapterWorldFiles(chapter,{desktop:true}).includes(entry.files[0]),entry.chapters.includes(chapter),`${id} in Chapter ${chapter}'s desktop pack`);
      assert.equal(chapterWorldFiles(chapter,{desktop:false}).includes(entry.files[0]),entry.web.includes(chapter),`${id} in Chapter ${chapter}'s web pack`);
      assert.equal(worldAssetShown(id,chapter,{desktop:true}),true);
    }
  }
  // A cart and its load go together: wherever the web shows a cart, it carries the load.
  for(const cart of ['g5-cart','g5-cart-east'])assert.ok(WORLD_CATALOG[cart].web.every(c=>WORLD_CATALOG['g5-cart-load'].web.includes(c)),`${cart}'s load`);
  // Only the desktop app carries the models of chapters whose web downloads are full: the bolts beside the
  // carroballista (VII–X), the Roman siege works (IX and XII) and the Roman debris (XII).
  assert.deepEqual(desktopOnlyWorldFiles().filter(f=>/\/g5-/.test(f)).sort(),
    ['g5-bolt-crate','g5-debris-roman','g5-fascines','g5-mantlets','g5-siege-tower'].map(id=>`assets/models/world/${id}.glb`));
  // The field objects' models follow their kinds' chapters, and a scene keeps every model it draws warm.
  assert.deepEqual(Object.keys(FIELD_OBJECT_MODELS).sort(),['g5-barricade','g5-brazier','g5-cart','g5-cart-east','g5-cart-load','g5-countermine','g5-ram','g5-siege-ramp','g5-signal','g5-signal-east']);
  for(const {id,chapter,e}of battles()){
    const urls=fieldModelUrls(e,{chapter,desktop:true}).map(([,u])=>u),scenery=new Set(sceneryPlacements(e,{chapter,desktop:true}).map(p=>p.url));
    const catalogued=[...Object.entries(FIELD_OBJECT_MODELS),...Object.entries(AFTERMATH_DEBRIS_MODELS)];
    assert.deepEqual(urls,e.type==='training'?[]:catalogued.filter(([,m])=>m.chapters.includes(chapter)).map(([m])=>worldModelUrl(m)),`${id}'s field models`);
    // The board kit, the tree and rock kits, the walls and the landmarks come to at most five more.
    assert.ok(scenery.size+urls.length+5<=SCENERY_IDLE_MASTERS,`${id}: ${scenery.size+urls.length} models and the kits`);
  }
});

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
import {regionalPropPlacements} from '../src/showcase/environment-regional-world.js';
import {sceneryPlacements,createSceneryModels,standSkinnedModel,SCENERY_IDLE_MASTERS} from '../src/showcase/scenery-models.js';
import {createSceneryModelCache} from '../src/showcase/scenery-cache.js';
import {HORSE_BODIES,horseBodyUrl} from '../src/ui/actor-body-catalog.js';
import {CAMP_ANIMALS,ANIMAL_CHAPTERS,ANIMAL_COATS,ANIMAL_COAT_TURN,CAMP_PROP_CHAPTERS,LIFE_PROP_CHAPTERS,REGIONAL_PROP_CHAPTERS,WORLD_CATALOG,
  animalModelUrl,chapterWorldFiles,desktopOnlyWorldFiles,worldModelUrl} from '../src/ui/world-catalog.js';

// Release G4 of the graphics plan (docs/graphics-tripo-plan.md): animals. They stand in the camps' courts beyond the board
// and in the battles' baggage line, each beside the piece of furniture or life it belongs to: the Roman horse's coat, baked
// standing, at the horse lines; generated oxen by the ox cart, mules by the covered carriage, camels by the camel gear and
// the caravan's trough and baggage, a dog by the ovens and the cooks' fire, sheep by the loom, goats by the woodpile and
// the market stall, a pack donkey by the pottery stall and a courier's horse by the courier table; and the calibration's
// pack mule by the broken cart and the handcart. Presentation only: these tests prove where they stand, in camps and
// battles reached by legal commands, not anything a player does.
const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const fixtures=await read('tests/fixtures/graphics-scenes.json');
// The animals paid for in each batch, and those G4 ships: the courier's horse ships from its second attempt.
const PAID={pilot:['g4-ox','g4-mule','g4-camel','g4-dog'],rest:['g4-sheep','g4-sheep-grazing','g4-goat','g4-donkey','g4-ox-dark','g4-camel-couched','g4-courier-horse','g4-courier-horse-b']};
const SHIPPED=[...PAID.pilot,...PAID.rest.filter(id=>!id.endsWith('-b')),'g4-pack-mule'];
const hostChapters=id=>CAMP_PROP_CHAPTERS[id]??LIFE_PROP_CHAPTERS[id]??REGIONAL_PROP_CHAPTERS[id];
const campOf=chapter=>{const world=G.createCampWorld(G.deserialize(JSON.stringify(fixtures.scenes.find(s=>s.id===`camp-${chapter}`).state)));
  return {...world.map,id:world.map.id,campPresentation:world.campPresentation};};
const CAMPS=[1,2,3,4,6,7,8,9,10,11,12].map(chapter=>({id:`ch${chapter}-camp`,chapter,e:campOf(chapter)}));
let battleScenes;
// The battles, reached by legal commands as the G5 tests reach them.
function battles(){
  if(battleScenes)return battleScenes;
  const saves=new Map();
  runCommandCampaign({featureEdition:35,onCheckpoint:s=>{const e=G.getChapter(s).encounters[s.encounterIndex];if(!saves.has(e.id))saves.set(e.id,G.serialize(s));}});
  battleScenes=[];
  for(const [id,save]of saves){
    const s=G.deserialize(save);if(!G.startEncounter(s,{controls:'realtime'}).ok)continue;
    const world=G.realtimeWorld(s);if(!world||s.encounter.kind!=='battle')continue;
    battleScenes.push({id,chapter:world.chapter,e:stageEncounter(s.encounter,world)});
  }
  return battleScenes;
}
// Node has no image decoder: geometry loads in full with placeholder textures.
async function loadFile(url){
  const bytes=await readFile(new URL(url,root)),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}
// A model's footprint in its own frame (x and z extents about its middle), standing as the scenery stands it.
const footprints=new Map();
async function footprint(id){
  if(!footprints.has(id)){
    const scene=standSkinnedModel(await loadFile(ANIMAL_COATS[id]?horseBodyUrl(id):worldModelUrl(id))),box=new T.Box3().setFromObject(scene,true);
    footprints.set(id,[box.max.x-box.min.x,box.max.z-box.min.z,box.max.y-box.min.y]);
  }
  return footprints.get(id);
}
// The corners of a footprint [width, depth] about (x, z), turned by yaw as three.js turns a model about its height.
const corners=(x,z,[w,d],yaw)=>{const c=Math.cos(yaw),s=Math.sin(yaw);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>{const lx=u*w/2,lz=v*d/2;return [x+lx*c+lz*s,z-lx*s+lz*c];});};
// Two convex quadrilaterals overlap unless an edge of one separates them.
function overlaps(a,b){
  for(const poly of [a,b])for(let i=0;i<4;i++){
    const [x1,z1]=poly[i],[x2,z2]=poly[(i+1)%4],nx=z2-z1,nz=x1-x2,pa=a.map(([x,z])=>x*nx+z*nz),pb=b.map(([x,z])=>x*nx+z*nz);
    if(Math.max(...pa)<=Math.min(...pb)+1e-6||Math.max(...pb)<=Math.min(...pa)+1e-6)return false;
  }
  return true;
}

test('release G4 spends within its authorisation and each batch\'s ceiling, and the balance moved by what the ledger records', async () => {
  const ledger=await read('art-source/models/graphics-g4-credits.json'),tasks=ledger.batches.flatMap(b=>b.tasks);
  const spent=tasks.reduce((sum,t)=>sum+t.accountedCredits,0);
  assert.equal(ledger.authorization.credits,600);assert.equal(ledger.spentCredits,spent);assert.equal(ledger.remainingAuthorization,600-spent);
  for(const batch of ledger.batches){
    const own=batch.tasks.reduce((sum,t)=>sum+t.accountedCredits,0);assert.equal(batch.spentCredits,own,batch.batch);
    assert.ok(own<=batch.ceilingCredits,`${batch.batch} stays within its ceiling`);
    assert.equal(batch.balance.before-batch.balance.after,own,`${batch.batch}: the account moved by what was recorded`);
    for(const t of batch.tasks){
      assert.equal(t.status,'success');assert.equal(t.accountedCredits,t.creditsReported);assert.equal(t.accountedCredits,t.expectedCredits);
      assert.equal((await read(`art-source/models/requests/${t.id}.json`)).provenance.taskId,t.taskId,`${t.id}: its request records the task`);
    }
  }
  for(const batch of ledger.batches)assert.deepEqual(batch.tasks.map(t=>t.id).sort(),[...PAID[batch.batch]].sort(),`${batch.batch}: its paid tasks; the pack mule was the calibration's`);
  const generations=tasks.filter(t=>t.operation==='text_to_model');
  assert.ok(generations.filter(t=>t.rejectedAtReview).length<=generations.length*.2,'Rejections within the stop rule');
});

test('every animal G4 ships has its task, its manifest entry and its budget, and the pack mule is the calibration\'s own download', async () => {
  const manifest=await read('docs/asset-manifest.json'),ledger=await read('art-source/models/graphics-g4-credits.json'),tasks=ledger.batches.flatMap(b=>b.tasks);
  const shipped=manifest.assets.filter(a=>a.source?.program==='graphics-g4');
  assert.deepEqual(shipped.map(a=>a.id).sort(),[...SHIPPED].sort());
  for(const entry of shipped){
    assert.equal(entry.path,worldModelUrl(entry.id),`${entry.id} is the file the catalog loads`);
    const request=await read(entry.source.prompt),p=request.provenance;
    assert.equal(entry.source.taskId,p.taskId);assert.equal(entry.source.rawSha256,p.rawSha256);
    if(entry.id==='g4-pack-mule'){
      // Shipped from its own request with the calibration's task and digest, so its credits are not spent twice.
      const calibration=await read('art-source/models/requests/cal-mule.json');
      assert.equal(p.reusedFrom,'cal-mule');assert.equal(p.taskId,calibration.provenance.taskId);assert.equal(p.rawSha256,calibration.provenance.rawSha256);
      assert.equal(entry.source.credits,0);assert.ok(!tasks.some(t=>t.id===entry.id));
    }else{
      // A second attempt ships under the first's name: its own task, never the rejected one.
      const task=tasks.find(t=>t.taskId===p.taskId);
      assert.ok(task&&!task.rejectedAtReview&&(task.id===entry.id||task.id===`${entry.id}-b`),`${entry.id}: its generation is in the ledger`);assert.equal(entry.source.credits,20);
    }
    assert.match(request.status,/^G4 (pilot|rest): processed, compressed and reviewed/,`${entry.id} is reviewed`);
    const info=await inspectModel(await readFile(new URL(entry.path,root))),b=request.budget;
    assert.deepEqual(budgetProblems(info,{bytes:b.bytes,triangles:b.triangles,texture:b.texture,minHeight:b.minHeight,maxHeight:b.maxHeight}),[],entry.id);
    assert.equal(info.bytes,entry.export.bytes);
  }
});

test('each animal is in the chapters of the pieces it stands with, the web carries those it has room for, and a horse is its chapters\' cavalry coat', () => {
  const models=new Set(Object.values(CAMP_ANIMALS).flatMap(h=>h.animals.map(([model])=>model)));
  assert.deepEqual([...models].filter(m=>!ANIMAL_COATS[m]).sort(),[...SHIPPED].sort());
  for(const model of SHIPPED){
    const hosts=Object.entries(CAMP_ANIMALS).filter(([,h])=>h.animals.some(([m])=>m===model)).map(([host])=>host);
    assert.deepEqual(WORLD_CATALOG[model].chapters,[...new Set(hosts.flatMap(host=>CAMP_ANIMALS[host].chapters??hostChapters(host)))].sort((a,b)=>a-b),
      `${model} stands where its pieces stand`);
    assert.deepEqual(ANIMAL_CHAPTERS[model],WORLD_CATALOG[model].chapters);
  }
  // A piece that names its animals' chapters names some of its own: Chapter XI's courier table stands on a service pad.
  for(const [host,h]of Object.entries(CAMP_ANIMALS))if(h.chapters)assert.ok(h.chapters.every(c=>hostChapters(host).includes(c)),host);
  assert.deepEqual(CAMP_ANIMALS['courier-table'].chapters,[3,7]);
  // On the web, Chapter II carries its pack mule, dog and goats, III its pack mule, dog and courier's horse, and XI its
  // mules, goats and donkey; every other web chapter leaves its animals out, and the desktop app has them all.
  const web=Object.fromEntries(SHIPPED.map(model=>[model,WORLD_CATALOG[model].web]));
  assert.deepEqual(web,{'g4-ox':[],'g4-mule':[11],'g4-camel':[],'g4-dog':[2,3],'g4-pack-mule':[2,3],'g4-sheep':[],'g4-sheep-grazing':[],'g4-goat':[2,11],
    'g4-donkey':[11],'g4-ox-dark':[],'g4-camel-couched':[],'g4-courier-horse':[3]});
  for(const model of SHIPPED)for(const chapter of WORLD_CATALOG[model].chapters){
    assert.equal(chapterWorldFiles(chapter,{desktop:true}).includes(worldModelUrl(model)),true);
    assert.equal(chapterWorldFiles(chapter,{desktop:false}).includes(worldModelUrl(model)),web[model].includes(chapter));
  }
  assert.deepEqual(desktopOnlyWorldFiles().filter(f=>/\/g4-/.test(f)).sort(),['g4-camel','g4-ox','g4-sheep','g4-sheep-grazing','g4-ox-dark','g4-camel-couched'].map(worldModelUrl).sort());
  // The horse lines' horses are the coat those chapters' cavalry already download: no file of their own.
  assert.deepEqual(Object.keys(ANIMAL_COATS),['horse-roman']);
  for(const chapter of CAMP_PROP_CHAPTERS['g3-horse-lines'])assert.ok(HORSE_BODIES['horse-roman'].chapters.includes(chapter),`Chapter ${chapter} downloads the Roman horse`);
  assert.equal(animalModelUrl('horse-roman',7),horseBodyUrl('horse-roman'));assert.equal(animalModelUrl('horse-roman',8),null);
  assert.equal(animalModelUrl('g4-ox',8),worldModelUrl('g4-ox'));assert.equal(animalModelUrl('g4-ox',7),null);
});

test('in every camp and battle, each animal stands with its piece, within the piece\'s court or line spot, clear of it and of the others, on its far side from the board, and in every chapter that downloads it', async () => {
  let checked=0;const shown={};
  for(const {id,chapter,e}of [...CAMPS,...battles()]){
    const before=JSON.stringify(e),placements=regionalPropPlacements(e,{chapter}),hx=e.width*1.25,hz=e.height*1.25;
    const out=(x,z)=>Math.max(Math.abs(x)-hx,Math.abs(z)-hz);
    for(const host of placements.filter(p=>CAMP_ANIMALS[p.id]&&!p.pad)){
      const herd=CAMP_ANIMALS[host.id],animals=placements.filter(p=>p.host===host.id),yaw=host.yaw??0,c=Math.cos(yaw),s=Math.sin(yaw);
      assert.equal(animals.length,herd.animals.filter(([model])=>animalModelUrl(model,chapter)).length,`${id}/${host.id}: its animals stand with it`);
      if(!animals.length)continue;
      // Back from the piece's place to the middle of its court or line spot, on whichever side its animals took.
      const [sx,sz]=herd.shift,sides=[1,-1].filter(side=>{
        const cx=host.x-(sx*c+sz*side*s),cz=host.z-(-sx*s+sz*side*c);
        return side===(herd.across&&out(cx+s,cz+c)>out(cx-s,cz-c)?-1:1);
      });
      assert.equal(sides.length,1,`${id}/${host.id}: one side`);
      const side=sides[0],cx=host.x-(sx*c+sz*side*s),cz=host.z-(-sx*s+sz*side*c),half=host.court?2.4:2.35;
      // A camp's court keeps its own middle, which the piece moved aside from (camp-composition.js wears the ground there).
      if(host.court)assert.ok(Math.abs(cx-host.court.x)<1e-9&&Math.abs(cz-host.court.z)<1e-9,`${id}/${host.id}: its court keeps its middle`);
      const [hw,hd]=await footprint(host.id),hostQuad=corners(host.x,host.z,[hw,hd],yaw);
      assert.ok(hostQuad.every(([x,z])=>Math.abs(x-cx)<=half&&Math.abs(z-cz)<=half),`${id}/${host.id} stays within its own court`);
      const quads=[];
      for(const a of animals){
        const [w,d]=await footprint(a.id);quads.push(corners(a.x,a.z,[w,d],a.yaw));(shown[a.id]??=new Set()).add(chapter);
        assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.z)&&a.url===animalModelUrl(a.id,chapter),`${id}/${a.key}`);
        // A generated animal faces its +x and a coat its +z, turned from the piece's x by its own yaw, mirrored with its spot.
        const turn=herd.animals[Number(a.key.split(':').at(-1))][3],facing=a.yaw-(ANIMAL_COATS[a.id]?ANIMAL_COAT_TURN:0)-yaw;
        assert.ok(Math.abs(Math.sin((facing-side*turn)/2))<1e-9,`${id}/${a.key} faces as its piece's frame says`);
        if(herd.across)assert.ok(out(a.x,a.z)>out(cx,cz),`${id}/${a.key} stands on the piece's far side from the board`);
      }
      quads.forEach((q,i)=>{
        assert.ok(q.every(([x,z])=>Math.abs(x-cx)<=half+1e-9&&Math.abs(z-cz)<=half+1e-9),`${id}/${animals[i].key} stays within the court`);
        assert.ok(!overlaps(q,hostQuad),`${id}/${animals[i].key} stands clear of its piece`);
        quads.forEach((r,j)=>{if(j>i)assert.ok(!overlaps(q,r),`${id}: ${animals[i].key} and ${animals[j].key} stand apart`);});
        checked++;
      });
    }
    assert.equal(JSON.stringify(e),before,`${id}: placement reads the scene and changes nothing`);
  }
  assert.ok(checked>=60,`${checked} animals checked`);
  // No chapter downloads an animal that none of its camps or battles stands: a piece on a service pad has none.
  for(const model of SHIPPED)assert.deepEqual([...shown[model]??[]].sort((a,b)=>a-b),WORLD_CATALOG[model].chapters,`${model} stands in every chapter that downloads it`);
});

test('an animal shows only with its piece and only where its download carries it, and a camp\'s models still fit the idle cache', () => {
  for(const {id,chapter,e}of CAMPS)for(const desktop of [false,true]){
    const placed=sceneryPlacements(e,{chapter,desktop}),ids=new Set(placed.map(p=>p.id));
    for(const a of placed.filter(p=>p.host)){
      assert.ok(ids.has(a.host),`${id}: ${a.key} stands only with its piece`);
      if(!ANIMAL_COATS[a.id])assert.ok(desktop||WORLD_CATALOG[a.id].web.includes(chapter),`${id}: ${a.key} is in the web download`);
    }
    // The working set: the placed models and at most five kits and landmarks (scenery-models.js).
    const urls=new Set(placed.map(p=>p.url));assert.ok(urls.size+5<=SCENERY_IDLE_MASTERS,`${id}: ${urls.size} models and the kits`);
  }
  // On the web, Chapter XII's camp leaves out its horse lines, so its horses go too; the desktop app stands both.
  const xii=CAMPS.find(c=>c.chapter===12).e;
  assert.ok(!sceneryPlacements(xii,{chapter:12,desktop:false}).some(p=>p.id==='g3-horse-lines'||p.id==='horse-roman'));
  assert.equal(sceneryPlacements(xii,{chapter:12,desktop:true}).filter(p=>p.id==='horse-roman').length,3);
  // Chapter VII's web download carries its horse lines and the coat: three horses stand there on the web too.
  assert.equal(sceneryPlacements(CAMPS.find(c=>c.chapter===7).e,{chapter:7,desktop:false}).filter(p=>p.id==='horse-roman').length,3);
});

test('the horse\'s coat stands baked in its rest pose: plain meshes exactly where its skeleton puts the skin, without its far-off surface', async () => {
  const skinned=await loadFile(horseBodyUrl('horse-roman'));skinned.updateMatrixWorld(true);
  let coat;skinned.traverse(o=>{if(o.isSkinnedMesh&&!/overview$/.test(o.name))coat=o;});coat.skeleton.update();
  const p=coat.geometry.attributes.position,v=new T.Vector3(),posed=[];
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);coat.applyBoneTransform(i,v);posed.push(v.applyMatrix4(coat.matrixWorld).clone());}
  const standing=standSkinnedModel(await loadFile(horseBodyUrl('horse-roman')));standing.updateMatrixWorld(true);
  const meshes=[];standing.traverse(o=>{if(o.isMesh)meshes.push(o);});
  assert.deepEqual(meshes.map(m=>[m.name,!!m.isSkinnedMesh]),[['horse-coat',false]]);
  const q=meshes[0].geometry.attributes.position;let worst=0;
  for(let i=0;i<q.count;i++){v.fromBufferAttribute(q,i).applyMatrix4(meshes[0].matrixWorld);worst=Math.max(worst,v.distanceTo(posed[i]));}
  assert.ok(worst<1e-6,`the plain coat lies ${worst} m from the skinned one`);
  assert.ok(meshes[0].material.isMeshStandardMaterial&&meshes[0].material.map,'the coat keeps its textured material');
  assert.ok(!meshes[0].geometry.attributes.skinIndex&&!meshes[0].geometry.attributes.skinWeight,'no skin attributes left');
  // A second pass changes nothing, and a model with no skin comes back as it was.
  const count=standing.children.length;standSkinnedModel(standing);assert.equal(standing.children.length,count);
  const plain=new T.Group();plain.add(new T.Mesh(new T.BoxGeometry()));assert.equal(standSkinnedModel(plain),plain);assert.equal(plain.children.length,1);
});

test('the camps place their animals as plain meshes that take no picks, and Performance places none', async () => {
  const cache=createSceneryModelCache({load:loadFile});
  for(const chapter of [7,8,9]){
    const {e}=CAMPS.find(c=>c.chapter===chapter),scene=new T.Scene(),models=createSceneryModels(scene,e,{chapter,cache,desktop:true});
    const ids=await models.ready;assert.equal(ids.length,models.placements.length);
    const animals=models.placements.filter(p=>p.host);assert.ok(animals.length>=3,`Chapter ${chapter} has its animals`);
    for(const a of animals){
      const model=models.group.getObjectByName(a.key);assert.ok(model,a.key);
      model.traverse(o=>{if(o.isMesh){assert.ok(!o.isSkinnedMesh,`${a.key} is a plain mesh`);assert.equal(o.raycast(),undefined);}});
      const box=new T.Box3().setFromObject(model,true),hx=e.width*1.25,hz=e.height*1.25;
      assert.ok(box.max.x< -hx||box.min.x>hx||box.max.z< -hz||box.min.z>hz,`${a.key} stands off the board`);
    }
    models.dispose();
    const none=createSceneryModels(new T.Scene(),e,{chapter,quality:'performance',load:async()=>{throw new Error('must not download');}});
    assert.deepEqual(await none.ready,[]);none.dispose();
  }
  cache.clear();
});

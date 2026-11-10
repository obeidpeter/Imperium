import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/three/addons/libs/meshopt_decoder.module.js';
import {inspectModel} from '../scripts/assets/check-model.mjs';
import {KIT_MODELS,KIT_STANDARD_MODELS,kitModelUrl} from '../src/showcase/actor-kit-catalog.js';
import {FINALE_STANDARD_MODELS,WORLD_CATALOG,chapterWorldFiles,desktopOnlyWorldFiles,worldModelUrl} from '../src/ui/world-catalog.js';
import {createEnvironment} from '../src/showcase/environment.js';
import {finaleLayout,finaleStandardSpot,finaleVexillumBatches} from '../src/showcase/environment-finale.js';
import {sceneryPlacements,createSceneryModels} from '../src/showcase/scenery-models.js';
import {createSceneryModelCache} from '../src/showcase/scenery-cache.js';

// Release G2 of the graphics plan (docs/graphics-tripo-plan.md): arms and standards. Its pilot made the standards: a
// century's signum and a legion's eagle carried on the back of the figures that carry the code-built ones (tested with
// the kit, tests/actor-kit-models.test.mjs), and a vexillum over each block of the finale's massed armies, the
// claimant's recoloured to his cohorts' blue-grey. Presentation only.
const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const fixture=await read('tests/fixtures/campaign-3d.json'),finale=fixture.scenes.find(s=>s.id==='ch12-confrontation');

test('release G2 spends within its authorisation and its pilot\'s ceiling, and the balance moved by what the ledger records', async () => {
  const ledger=await read('art-source/models/graphics-g2-credits.json'),tasks=ledger.batches.flatMap(b=>b.tasks);
  const spent=tasks.reduce((sum,t)=>sum+t.accountedCredits,0);
  assert.equal(ledger.spentCredits,spent);assert.ok(spent<=ledger.authorization.credits,'Within the authorised credits');
  assert.equal(ledger.remainingAuthorization,ledger.authorization.credits-spent);
  for(const batch of ledger.batches){
    const own=batch.tasks.reduce((sum,t)=>sum+t.accountedCredits,0);assert.equal(batch.spentCredits,own,batch.batch);
    if(batch.ceilingCredits)assert.ok(own<=batch.ceilingCredits,`${batch.batch} stays within its ceiling`);
    assert.equal(batch.balance.before-batch.balance.after,own,`${batch.batch}: the account moved by what was recorded`);
    assert.deepEqual(batch.tasks.map(t=>t.id),batch.items,`${batch.batch}: every item generated once`);
    for(const t of batch.tasks){
      assert.equal(t.status,'success',`${t.id} ${t.operation}`);assert.equal(t.accountedCredits,t.creditsReported,`${t.id}: as Tripo reported`);
      assert.equal(t.accountedCredits,t.expectedCredits,`${t.id}: at the measured price`);assert.equal(t.accountedCredits,ledger.pricing.textWithStandardTextures);
      const request=await read(`art-source/models/requests/${t.id}.json`);assert.equal(request.provenance.taskId,t.taskId,`${t.id}: the request's own task`);
    }
    if(batch.rejected)assert.deepEqual(batch.rejected.items,batch.tasks.filter(t=>t.rejectedAtReview).map(t=>t.id));
  }
  // The plan's stop rule: once more than 20% of a release's generations are rejected, it pauses and the owner is told.
  const rejected=tasks.filter(t=>t.rejectedAtReview).length;
  if(rejected>tasks.length*.2){
    assert.ok(ledger.paused?.since&&ledger.paused.until,'G2 records its pause and what ends it');
    assert.equal(ledger.paused.after,ledger.batches.at(-1).batch,'No batch is generated after the pause');
  }
});

test('every G2 model ships from an accepted generation in the ledger, and a rejected one is never processed or shipped', async () => {
  const ledger=await read('art-source/models/graphics-g2-credits.json'),manifest=await read('docs/asset-manifest.json'),tasks=ledger.batches.flatMap(b=>b.tasks);
  const shipped=manifest.assets.filter(a=>a.source?.program==='graphics-g2');
  assert.deepEqual(shipped.map(a=>a.path).sort(),[...Object.values(KIT_STANDARD_MODELS).map(kitModelUrl),...Object.values(FINALE_STANDARD_MODELS).map(worldModelUrl)].sort());
  for(const entry of shipped){
    const request=await read(entry.source.prompt),bytes=await readFile(new URL(entry.path,root));
    assert.equal(tasks.find(t=>t.id===request.id)?.taskId,entry.source.taskId,`${entry.id}: its generation is in the ledger`);
    assert.ok(!tasks.find(t=>t.id===request.id).rejectedAtReview,`${entry.id} comes from an accepted generation`);
    assert.equal(entry.source.rawSha256,request.provenance.rawSha256);assert.match(entry.license,/full rights to use, modify, distribute and commercially exploit/);
    assert.equal(entry.export.bytes,bytes.length);assert.equal(entry.export.sha256,createHash('sha256').update(bytes).digest('hex'));
    // A derived model (the claimant's vexillum) costs nothing of its own: its generation's credits are the original's.
    assert.equal(entry.source.credits,entry.source.derivedFrom?0:tasks.filter(t=>t.id===request.id).reduce((sum,t)=>sum+t.accountedCredits,0),`${entry.id}: its credits`);
    const info=await inspectModel(bytes);
    assert.deepEqual([...info.extensionsRequired].sort().filter(e=>e!=='KHR_mesh_quantization'),['EXT_meshopt_compression','KHR_texture_basisu'],entry.id);
    assert.ok(info.textures.every(t=>t.mimeType==='image/ktx2')&&entry.export.bytes<=request.budget.bytes,`${entry.id} compressed and within its bytes`);
  }
  for(const t of tasks.filter(t=>t.rejectedAtReview)){
    const request=await read(`art-source/models/requests/${t.id}.json`);
    assert.match(request.status,/rejected at review/);assert.ok(!manifest.assets.some(a=>a.source?.taskId===t.taskId),`${t.id} is not shipped`);
    for(const id of Object.keys(KIT_MODELS))assert.notEqual(KIT_MODELS[id].source,t.id,`${t.id} is no kit's source`);
  }
});

test('the claimant\'s vexillum is the commander\'s with its cloth recoloured, and nothing else changed', async () => {
  const commander=await read('art-source/models/reports/g2-vexillum.json'),recolour=await read('art-source/models/reports/g2-vexillum-claimant.json');
  assert.equal(recolour.tool,'scripts/assets/recolour-model.py');
  assert.equal(recolour.input.sha256,commander.output.sha256,'Made from the processed vexillum before its compression');
  assert.equal(recolour.settings.to,'#4b5e7a','The claimant\'s shield colour (environment-finale.js)');
  const [map]=recolour.maps;assert.equal(map.regionMeanAfter,recolour.settings.to);assert.ok(map.regionShare>.5,'The cloth is most of the map');
  const manifest=await read('docs/asset-manifest.json'),entry=id=>manifest.assets.find(a=>a.id===id);
  assert.equal(entry('g2-vexillum-claimant').source.derivedFrom,'g2-vexillum');assert.equal(entry('g2-vexillum-claimant').source.taskId,entry('g2-vexillum').source.taskId);
  // The same geometry: only the colour map differs.
  const parse=async id=>{const bytes=await readFile(new URL(worldModelUrl(id),root)),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
    return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;};
  const geometry=scene=>{const out=[];scene.traverse(o=>{if(o.isMesh)out.push(Array.from(o.geometry.attributes.position.array).join());});return out;};
  assert.deepEqual(geometry(await parse('g2-vexillum-claimant')),geometry(await parse('g2-vexillum')));
});

test('the finale\'s vexilla: in the desktop app each side\'s model stands at its blocks\' vexillum spots and hides their code-built ones; the web and Performance keep the code-built', async () => {
  const e=finale.state.encounter,spots=finaleLayout(e).blocks.map(finaleStandardSpot);
  // In the catalog: Chapter XII's, in the desktop app alone.
  for(const id of Object.values(FINALE_STANDARD_MODELS)){
    assert.deepEqual([...WORLD_CATALOG[id].chapters],[12]);assert.deepEqual([...WORLD_CATALOG[id].web],[]);
    assert.ok(chapterWorldFiles(12,{desktop:true}).includes(worldModelUrl(id))&&!chapterWorldFiles(12,{desktop:false}).includes(worldModelUrl(id)));
    assert.ok(desktopOnlyWorldFiles().includes(worldModelUrl(id)),`${id} is left out of the web build`);
  }
  const placed=sceneryPlacements(e,{chapter:12,desktop:true}).filter(p=>Object.values(FINALE_STANDARD_MODELS).includes(p.id));
  assert.deepEqual(placed.map(p=>p.id),Object.values(FINALE_STANDARD_MODELS));
  for(const [side,id]of Object.entries(FINALE_STANDARD_MODELS)){
    const p=placed.find(p=>p.id===id);
    assert.deepEqual(p.instances,spots.filter(s=>s.side===side).map(({x,z,yaw})=>({x,z,yaw})),`${side}: one over each of its blocks`);
    assert.deepEqual(p.fallbackNames,[...finaleVexillumBatches(side)]);
  }
  assert.deepEqual(sceneryPlacements(e,{chapter:12,desktop:false}).filter(p=>Object.values(FINALE_STANDARD_MODELS).includes(p.id)),[],'Not on the web');
  // The code-built vexilla: each side's own batches where its model can stand, the scene's timber and shields elsewhere.
  const batches=(quality,desktop)=>{const world=createEnvironment(new T.Scene(),e,{chapter:12,quality,loadTextures:false,desktop}),found={};
    world.group.traverse(o=>{if(o.isInstancedMesh)found[o.name]=o.count;});world.dispose();return found;};
  const web=batches('balanced',false),desktop=batches('balanced',true),performance=batches('performance',true);
  for(const side of ['commander','claimant']){
    const count=spots.filter(s=>s.side===side).length;
    for(const name of finaleVexillumBatches(side)){assert.equal(desktop[name],count,`${name} in the desktop app`);assert.equal(web[name],undefined);assert.equal(performance[name],undefined);}
  }
  assert.equal(web['finale timber']-desktop['finale timber'],spots.length,'On the web the poles stand with the timber');
  assert.equal(web['massed legion shields']-desktop['massed legion shields'],spots.length,'and the cloths with the shields');
  // Placed, each model hides its side's code-built vexilla and stands on the ground at their spots.
  const scene=new T.Scene(),world=createEnvironment(scene,e,{chapter:12,quality:'balanced',loadTextures:false,desktop:true});
  const load=async url=>{const id=Object.values(FINALE_STANDARD_MODELS).find(id=>worldModelUrl(id)===url);if(!id)return new T.Group();
    const bytes=await readFile(new URL(url,root)),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
    return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;};
  const slope=(x,z)=>.02*x-.01*z,cache=createSceneryModelCache({load}),scenery=createSceneryModels(scene,e,{chapter:12,heightAt:slope,cache,desktop:true});await scenery.ready;
  for(const [side,id]of Object.entries(FINALE_STANDARD_MODELS)){
    for(const name of finaleVexillumBatches(side))assert.equal(scene.getObjectByName(name).visible,false,`${name} hidden`);
    const group=scenery.group.getObjectByName(`finale-standards:${side}`),[mesh]=group.children,m=new T.Matrix4(),at=new T.Vector3();
    assert.equal(mesh.count,spots.filter(s=>s.side===side).length);
    spots.filter(s=>s.side===side).forEach((spot,i)=>{mesh.getMatrixAt(i,m);at.setFromMatrixPosition(m);assert.ok(Math.hypot(at.x-spot.x,at.z-spot.z)<.4,`${id} ${i} at its block`);});
  }
  scenery.dispose();for(const side of ['commander','claimant'])for(const name of finaleVexillumBatches(side))assert.equal(scene.getObjectByName(name).visible,true,`${name} back when the models go`);
  world.dispose();cache.clear();
});

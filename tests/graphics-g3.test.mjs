import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/three/addons/libs/meshopt_decoder.module.js';
import * as Game from '../src/core/game.js';
import {inspectModel,budgetProblems} from '../scripts/assets/check-model.mjs';
import {terrainAt,gridToWorld} from '../src/showcase/environment-layout.js';
import {campWallRuns,campPalisadeSections,campTowerSpots,timberCamp,PALISADE_SECTION_LENGTH,BREASTWORK_BATCHES} from '../src/showcase/camp-walls.js';
import {createSceneryModels,sceneryPlacements,CAMP_PALISADE,CAMP_TOWER} from '../src/showcase/scenery-models.js';
import {createSceneryModelCache} from '../src/showcase/scenery-cache.js';
import {createEnvironment} from '../src/showcase/environment.js';
import {regionalServicePads} from '../src/showcase/environment-regional-world.js';
import {CAMP_PROP_CHAPTERS,CAMP_WALL_CHAPTERS,WORLD_CATALOG,chapterWorldFiles,desktopOnlyWorldFiles,worldAssetShown,worldModelUrl} from '../src/ui/world-catalog.js';

// Release G3 of the graphics plan (docs/graphics-tripo-plan.md): the camps. Its pilot's eight models:
// the timber camps' palisade and towers on their walls, and six pieces of furniture in the camps' courts.
const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const fixtures=await read('tests/fixtures/graphics-scenes.json');
const campOf=chapter=>{const world=Game.createCampWorld(Game.deserialize(JSON.stringify(fixtures.scenes.find(s=>s.id===`camp-${chapter}`).state)));return {...world.map,id:world.map.id,campPresentation:world.campPresentation};};
const PILOT=[CAMP_PALISADE,CAMP_TOWER,...Object.keys(CAMP_PROP_CHAPTERS)];

test('release G3 spends within its authorisation and its pilot\'s ceiling, and the balance moved by what the ledger records', async () => {
  const ledger=await read('art-source/models/graphics-g3-credits.json'),tasks=ledger.batches.flatMap(b=>b.tasks);
  const spent=tasks.reduce((sum,t)=>sum+t.accountedCredits,0);
  assert.equal(ledger.spentCredits,spent);assert.ok(spent<=ledger.authorization.credits,'Within the authorised credits');
  assert.equal(ledger.authorization.credits,2400);assert.equal(ledger.remainingAuthorization,ledger.authorization.credits-spent);
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

test('every model G3 ships has its task in the ledger, its manifest entry and its budget, and the rejected attempt ships nowhere', async () => {
  const ledger=await read('art-source/models/graphics-g3-credits.json'),manifest=await read('docs/asset-manifest.json'),tasks=ledger.batches.flatMap(b=>b.tasks);
  const shipped=manifest.assets.filter(a=>a.source?.program==='graphics-g3');
  assert.deepEqual(shipped.map(a=>a.id).sort(),[...PILOT].sort());
  for(const entry of shipped){
    assert.equal(entry.path,worldModelUrl(entry.id),`${entry.id} is the file the catalog loads`);
    const request=await read(entry.source.prompt),p=request.provenance;
    assert.equal(tasks.find(t=>t.id===request.id&&t.operation==='text_to_model')?.taskId,p.taskId,`${entry.id}: its generation is in the ledger`);
    assert.equal(entry.source.taskId,p.taskId);assert.equal(entry.source.credits,20);
    assert.match(request.status,/^G3 pilot: processed, compressed and reviewed/,`${entry.id} is reviewed`);
    const info=await inspectModel(await readFile(new URL(entry.path,root))),b=request.budget;
    assert.deepEqual(budgetProblems(info,{bytes:b.bytes,triangles:b.triangles,texture:b.texture,minHeight:b.minHeight,maxHeight:b.maxHeight}),[],entry.id);
    assert.equal(info.bytes,entry.export.bytes);assert.equal(info.triangles,entry.export.triangles,`${entry.id} records the shipped triangle count`);
    assert.equal(info.base,0,'Each model stands on its base at the origin');
    assert.deepEqual([...info.extensionsRequired].sort(),['EXT_meshopt_compression','KHR_texture_basisu'],`${entry.id} ships compressed`);
  }
  for(const t of tasks.filter(t=>t.rejectedAtReview)){
    assert.ok(!shipped.some(e=>e.source.taskId===t.taskId),`${t.id} is not shipped`);
    assert.match((await read(`art-source/models/requests/${t.id}.json`)).status,/^G3 pilot: rejected/);
  }
});

test('the timber camps\' palisade covers every wall cell along straight runs, and towers stand on the corners and at the gateways', () => {
  const towersBy={1:6,2:6,3:6,7:6,8:4,10:5};
  for(let chapter=1;chapter<=12;chapter++){
    if(chapter===5||chapter===11)continue;
    const e=campOf(chapter),timber=Object.hasOwn(towersBy,chapter),hx=e.width*1.25,hz=e.height*1.25,before=JSON.stringify(e);
    assert.equal(timberCamp(e),timber,`Chapter ${chapter}'s camp walls`);
    assert.equal(timber,CAMP_WALL_CHAPTERS[CAMP_PALISADE].includes(chapter));
    const runs=campWallRuns(e),sections=campPalisadeSections(e),towers=campTowerSpots(e);
    if(!timber){assert.deepEqual([runs,sections,towers],[[],[],[]]);continue;}
    // Every wall cell in exactly one run, and each run's sections fill it from end to end.
    const walls=[];for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++)if(terrainAt(e,x,y)==='wall')walls.push(`${x},${y}`);
    assert.deepEqual(runs.flatMap(r=>r.cells.map(c=>`${c.x},${c.y}`)).sort(),walls.sort(),`Chapter ${chapter}: each wall cell in one run`);
    for(const w of walls){
      const [x,y]=w.split(',').map(Number),c=gridToWorld({x,y},e);
      assert.ok(sections.some(s=>s.yaw%Math.PI===0?Math.abs(s.z-c.z)<1e-9&&Math.abs(s.x-c.x)<=s.length/2+1e-9:Math.abs(s.x-c.x)<1e-9&&Math.abs(s.z-c.z)<=s.length/2+1e-9),`Chapter ${chapter}: the palisade stands on wall cell ${w}`);
    }
    for(const s of sections){
      assert.ok(s.length/PALISADE_SECTION_LENGTH>=.75&&s.length/PALISADE_SECTION_LENGTH<=1.25,`Chapter ${chapter}: a section stretched ${(s.length/PALISADE_SECTION_LENGTH).toFixed(2)}`);
      assert.ok(Math.abs(s.x)<=hx&&Math.abs(s.z)<=hz,'on the board, where its wall is');
    }
    // A tower stands on a wall cell: at every corner, and at the end of a run that opens on a gateway.
    assert.equal(towers.length,towersBy[chapter],`Chapter ${chapter}'s towers`);
    for(const t of towers)assert.equal(terrainAt(e,t.cell.x,t.cell.y),'wall');
    const wall=(x,y)=>x>=0&&y>=0&&x<e.width&&y<e.height&&terrainAt(e,x,y)==='wall';
    for(const w of walls){const [x,y]=w.split(',').map(Number);if((wall(x-1,y)||wall(x+1,y))&&(wall(x,y-1)||wall(x,y+1)))assert.ok(towers.some(t=>t.cell.x===x&&t.cell.y===y),`Chapter ${chapter}: a tower on corner ${w}`);}
    assert.deepEqual(campPalisadeSections(e),sections,'presentation is data, not randomness');assert.equal(JSON.stringify(e),before);
  }
  assert.deepEqual(campWallRuns({...campOf(1),id:'ch1-road'}),[],'only a camp');
});

test('the camps\' furniture stands only in a camp, beyond the board and off the service pads, one of each', () => {
  for(let chapter=1;chapter<=12;chapter++){
    if(chapter===5||chapter===11)continue;
    const e=campOf(chapter),placed=sceneryPlacements(e,{chapter,desktop:true}),hx=e.width*1.25,hz=e.height*1.25,pads=regionalServicePads(e);
    for(const [id,chapters]of Object.entries(CAMP_PROP_CHAPTERS)){
      const mine=placed.filter(p=>p.id===id);assert.equal(mine.length,chapters.includes(chapter)?1:0,`${id} in Chapter ${chapter}`);
      for(const p of mine){
        assert.ok(!p.pad&&!p.fallbackName,`${id}: in a court, with no code-built stand-in`);
        // Beside its service where a court is free; otherwise in the baggage line, still beyond the board.
        assert.ok(Math.abs(p.x)>hx+1.5||Math.abs(p.z)>hz+1.5,`${id} stands beyond the board`);
        assert.ok(!pads.some(pad=>Math.abs(pad.x-p.x)<pad.width/2&&Math.abs(pad.z-p.z)<pad.depth/2),`${id} off the pads`);
      }
    }
    for(const kind of [['council','contest'],['road','field']]){
      const field={...e,id:`ch${chapter}-${kind[0]}`,kind:kind[1]};
      assert.equal(sceneryPlacements(field,{chapter,desktop:true}).filter(p=>CAMP_PROP_CHAPTERS[p.id]||CAMP_WALL_CHAPTERS[p.id]).length,0,`no camp furniture or walls in ${field.id}`);
    }
  }
});

test('the web carries a G3 model only where its chapter\'s download has room; the desktop app carries them all', () => {
  for(const id of PILOT){
    const entry=WORLD_CATALOG[id];assert.deepEqual(entry.files,[`assets/models/world/${id}.glb`]);
    assert.deepEqual(entry.web,entry.chapters.filter(c=>c!==12&&(c!==1||id===CAMP_PALISADE)),`${id}: Chapter I takes the palisade alone, XII none`);
    for(let chapter=1;chapter<=12;chapter++){
      assert.equal(chapterWorldFiles(chapter,{desktop:true}).includes(entry.files[0]),entry.chapters.includes(chapter),`${id} in Chapter ${chapter}'s desktop pack`);
      assert.equal(chapterWorldFiles(chapter,{desktop:false}).includes(entry.files[0]),entry.web.includes(chapter),`${id} in Chapter ${chapter}'s web pack`);
      assert.equal(worldAssetShown(id,chapter,{desktop:false}),!entry.chapters.includes(chapter)||entry.web.includes(chapter));
      assert.equal(worldAssetShown(id,chapter,{desktop:true}),true);
    }
  }
  assert.deepEqual(desktopOnlyWorldFiles(),[],'every G3 model is in some web chapter, so the web build keeps them all');
  // On the web Chapter I's camp shows the palisade and keeps the rest as before; the desktop app shows all five.
  const e=campOf(1),web=sceneryPlacements(e,{chapter:1,desktop:false}).map(p=>p.id),desk=sceneryPlacements(e,{chapter:1,desktop:true}).map(p=>p.id);
  assert.deepEqual(PILOT.filter(id=>web.includes(id)),[CAMP_PALISADE]);
  assert.deepEqual(PILOT.filter(id=>desk.includes(id)).sort(),[CAMP_PALISADE,CAMP_TOWER,'g3-officers-tent','g3-training-post','g3-supply-stack'].sort());
});

// Node has no image decoder: geometry loads in full with placeholder textures.
async function loadFile(url){
  const bytes=await readFile(new URL(url,root)),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}

test('the palisade is drawn in one instanced draw a mesh, each section stretched to its share and grounded, and hides the breastwork alone', async () => {
  const e=campOf(7),chapter=7,scene=new T.Scene();
  const env=createEnvironment(scene,e,{chapter,quality:'high',loadTextures:false});
  const breastwork=BREASTWORK_BATCHES.map(name=>env.group.getObjectByName(name));
  // The breastwork batches hold their own pieces only: six posts and three planks for every wall cell.
  const cells=campWallRuns(e).reduce((n,r)=>n+r.cells.length,0);
  assert.deepEqual(breastwork.map(b=>b?.count),[cells*6,cells*3]);
  const slope=(x,z)=>.03*x-.02*z,cache=createSceneryModelCache({load:url=>[worldModelUrl(CAMP_PALISADE),worldModelUrl(CAMP_TOWER)].includes(url)?loadFile(url):Promise.resolve(new T.Group())});
  const models=createSceneryModels(scene,e,{chapter,heightAt:slope,cache});await models.ready;
  const sections=campPalisadeSections(e),palisade=models.group.getObjectByName('camp-palisade'),towers=models.group.getObjectByName('camp-towers');
  assert.ok(palisade&&towers);
  for(const b of [...palisade.children,...towers.children]){assert.ok(b.isInstancedMesh);assert.ok(b.instanceColor?.array.every(v=>v===1),'white instance colours');}
  assert.equal(palisade.children[0].count,sections.length);assert.equal(towers.children[0].count,campTowerSpots(e).length);
  assert.ok(breastwork.every(b=>b.visible===false),'the palisade hides the code-built breastwork');
  // Each section spans its share of the run along its wall, centred on it and standing on its lowest corner.
  const [batch]=palisade.children,matrix=new T.Matrix4(),box=new T.Box3(),full=new T.Box3();batch.geometry.computeBoundingBox();
  for(const b of palisade.children){b.geometry.computeBoundingBox();}
  for(const [i,s]of sections.entries()){
    full.makeEmpty();for(const b of palisade.children){b.getMatrixAt(i,matrix);box.copy(b.geometry.boundingBox).applyMatrix4(matrix);full.union(box);}
    const size=full.getSize(new T.Vector3()),centre=full.getCenter(new T.Vector3()),along=s.yaw%Math.PI===0?size.x:size.z;
    assert.ok(Math.abs(along-s.length)<.05,`section ${i}: ${along.toFixed(2)} m along a share of ${s.length.toFixed(2)} m`);
    assert.ok(Math.abs(centre.x-s.x)<.06&&Math.abs(centre.z-s.z)<.06,`section ${i} centred on its wall`);
    const lowest=Math.min(...[[full.min.x,full.min.z],[full.min.x,full.max.z],[full.max.x,full.min.z],[full.max.x,full.max.z]].map(([x,z])=>slope(x,z)));
    assert.ok(full.min.y<=lowest+.05&&full.min.y>=lowest-.6,`section ${i} grounded`);
  }
  models.dispose();assert.ok(breastwork.every(b=>b.visible===true),'the breastwork returns with the palisade gone');
  // Performance draws the code-built breastwork only.
  assert.deepEqual(createSceneryModels(new T.Scene(),e,{chapter,quality:'performance',cache:createSceneryModelCache({load:async()=>new T.Group()})}).placements,[]);
  env.dispose();cache.clear();
});

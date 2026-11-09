import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/three/addons/libs/meshopt_decoder.module.js';
import * as Game from '../src/core/game.js';
import {inspectModel,budgetProblems} from '../scripts/assets/check-model.mjs';
import {terrainAt,gridToWorld} from '../src/showcase/environment-layout.js';
import {campWallRuns,campWallSections,campPalisadeSections,campTowerSpots,campGateways,campGateSpan,campWallStyle,timberCamp,PALISADE_SECTION_LENGTH,WALL_SECTION_LENGTH,GATE_WIDTH,GATE_MAX_STRETCH,BREASTWORK_BATCHES,CAMP_PARAPET_BATCHES} from '../src/showcase/camp-walls.js';
import {createSceneryModels,sceneryPlacements,CAMP_PALISADE,CAMP_TOWER} from '../src/showcase/scenery-models.js';
import {createSceneryModelCache} from '../src/showcase/scenery-cache.js';
import {createEnvironment} from '../src/showcase/environment.js';
import {regionalServicePads,regionalTentPitches,tentVariantOf,TENT_MODEL,TENT_VARIANTS,tentFallbackName} from '../src/showcase/environment-regional-world.js';
import {CAMP_PROP_CHAPTERS,CAMP_WALL_CHAPTERS,CAMP_WALL_MODELS,TENT_LINE_CHAPTERS,TENT_VARIANT_CHAPTERS,WORLD_CATALOG,chapterWorldFiles,desktopOnlyWorldFiles,worldAssetShown,worldModelUrl} from '../src/ui/world-catalog.js';

// Release G3 of the graphics plan (docs/graphics-tripo-plan.md): the camps. Its pilot's eight models (the timber
// camps' palisade and towers, and six pieces of furniture in the camps' courts) and the rest's eighteen (the stone
// and mudbrick camps' walls and towers, a gate in timber and one in stone, two more tents for the tent lines, and
// ten more pieces of furniture).
const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const fixtures=await read('tests/fixtures/graphics-scenes.json');
const campOf=chapter=>{const world=Game.createCampWorld(Game.deserialize(JSON.stringify(fixtures.scenes.find(s=>s.id===`camp-${chapter}`).state)));return {...world.map,id:world.map.id,campPresentation:world.campPresentation};};
const PILOT=[CAMP_PALISADE,CAMP_TOWER,'g3-officers-tent','g3-tent-struck','g3-horse-lines','g3-training-post','g3-supply-stack','g3-granary'];
const REST=['g3-wall-stone','g3-tower-stone','g3-wall-mudbrick','g3-tower-mudbrick','g3-tent-open','g3-tent-patched','g3-gate-timber','g3-gate-stone',
  'g3-praetorium','g3-hospital-tent','g3-tribunal','g3-altar','g3-parley-awning','g3-pavilion-east','g3-pavilion-shade','g3-pilum-rack','g3-archery-butt','g3-field-oven'];
const G3=[...PILOT,...REST];

test('release G3 spends within its authorisation and each batch\'s ceiling, and the balance moved by what the ledger records', async () => {
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
  assert.deepEqual(shipped.map(a=>a.id).sort(),[...G3].sort());
  for(const entry of shipped){
    assert.equal(entry.path,worldModelUrl(entry.id),`${entry.id} is the file the catalog loads`);
    const request=await read(entry.source.prompt),p=request.provenance;
    assert.equal(tasks.find(t=>t.id===request.id&&t.operation==='text_to_model')?.taskId,p.taskId,`${entry.id}: its generation is in the ledger`);
    assert.equal(entry.source.taskId,p.taskId);assert.equal(entry.source.credits,20);
    assert.match(request.status,/^G3 (pilot|rest): processed, compressed and reviewed/,`${entry.id} is reviewed`);
    const info=await inspectModel(await readFile(new URL(entry.path,root))),b=request.budget;
    assert.deepEqual(budgetProblems(info,{bytes:b.bytes,triangles:b.triangles,texture:b.texture,minHeight:b.minHeight,maxHeight:b.maxHeight}),[],entry.id);
    assert.equal(info.bytes,entry.export.bytes);assert.equal(info.triangles,entry.export.triangles,`${entry.id} records the shipped triangle count`);
    assert.equal(info.base,0,'Each model stands on its base at the origin');
    assert.deepEqual([...info.extensionsRequired].sort(),['EXT_meshopt_compression','KHR_texture_basisu'],`${entry.id} ships compressed`);
  }
  for(const t of tasks.filter(t=>t.rejectedAtReview)){
    assert.ok(!shipped.some(e=>e.source.taskId===t.taskId),`${t.id} is not shipped`);
    assert.match((await read(`art-source/models/requests/${t.id}.json`)).status,/^G3 (pilot|rest): rejected/);
  }
});

test('every camp\'s wall covers its wall cells along straight runs, with towers on the corners and at the gateways and gates over them', () => {
  const styles={1:'timber',2:'timber',3:'timber',4:'stone',5:'mudbrick',6:'mudbrick',7:'timber',8:'timber',9:'stone',10:'timber',11:'stone',12:'stone'};
  const towersBy={1:6,2:6,3:6,4:7,5:5,6:10,7:6,8:4,9:6,10:5,11:6,12:6},gatesBy={1:1,2:1,3:1,4:2,5:0,6:3,7:1,8:0,9:1,10:1,11:1,12:1};
  for(let chapter=1;chapter<=12;chapter++){
    const e=campOf(chapter),style=campWallStyle(e),hx=e.width*1.25,hz=e.height*1.25,before=JSON.stringify(e);
    assert.equal(style,styles[chapter],`Chapter ${chapter}'s camp walls`);assert.equal(timberCamp(e),style==='timber');
    const runs=campWallRuns(e),sections=campWallSections(e),towers=campTowerSpots(e),gates=campGateways(e),length=WALL_SECTION_LENGTH[style];
    // Every wall cell in exactly one run, and each run's sections fill it from end to end.
    const walls=[];for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++)if(terrainAt(e,x,y)==='wall')walls.push(`${x},${y}`);
    assert.deepEqual(runs.flatMap(r=>r.cells.map(c=>`${c.x},${c.y}`)).sort(),walls.sort(),`Chapter ${chapter}: each wall cell in one run`);
    for(const w of walls){
      const [x,y]=w.split(',').map(Number),c=gridToWorld({x,y},e);
      assert.ok(sections.some(s=>s.yaw%Math.PI===0?Math.abs(s.z-c.z)<1e-9&&Math.abs(s.x-c.x)<=s.length/2+1e-9:Math.abs(s.x-c.x)<1e-9&&Math.abs(s.z-c.z)<=s.length/2+1e-9),`Chapter ${chapter}: the wall stands on wall cell ${w}`);
    }
    for(const s of sections){
      assert.ok(s.length/length>=.75&&s.length/length<=1.25,`Chapter ${chapter}: a section stretched ${(s.length/length).toFixed(2)}`);
      assert.ok(Math.abs(s.x)<=hx&&Math.abs(s.z)<=hz,'on the board, where its wall is');
    }
    if(style==='timber')assert.deepEqual(campPalisadeSections(e),sections);else assert.deepEqual(campPalisadeSections(e),[]);
    // A tower stands on a wall cell: at every corner, and at the end of a run that opens on a gateway.
    assert.equal(towers.length,towersBy[chapter],`Chapter ${chapter}'s towers`);
    for(const t of towers)assert.equal(terrainAt(e,t.cell.x,t.cell.y),'wall');
    const wall=(x,y)=>x>=0&&y>=0&&x<e.width&&y<e.height&&terrainAt(e,x,y)==='wall';
    for(const w of walls){const [x,y]=w.split(',').map(Number);if((wall(x-1,y)||wall(x+1,y))&&(wall(x,y-1)||wall(x,y+1)))assert.ok(towers.some(t=>t.cell.x===x&&t.cell.y===y),`Chapter ${chapter}: a tower on corner ${w}`);}
    // A gate spans a gateway: a straight row of open cells between two wall cells, which stay open for the rules.
    assert.equal(gates.length,gatesBy[chapter],`Chapter ${chapter}'s gateways`);
    for(const g of gates){
      assert.ok(g.cells.length>=1&&g.cells.length<=5);assert.equal(g.length,g.cells.length*2.5);
      for(const c of g.cells)assert.notEqual(terrainAt(e,c.x,c.y),'wall',`Chapter ${chapter}: a gateway cell stays open`);
      const xs=new Set(g.cells.map(c=>c.x)),ys=new Set(g.cells.map(c=>c.y));assert.ok(xs.size===1||ys.size===1,'in a straight row');
      const [a,b]=[g.cells[0],g.cells.at(-1)],dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y),across=g.cells.length===1?(wall(a.x-1,a.y)&&wall(a.x+1,a.y)?[1,0]:[0,1]):[dx,dy];
      assert.ok(wall(a.x-across[0],a.y-across[1])&&wall(b.x+across[0],b.y+across[1]),`Chapter ${chapter}: a wall either side of the gateway`);
      // A gate spans its gateway, stretched by at most GATE_MAX_STRETCH; a wider one keeps open ground either side.
      const span=campGateSpan(style,g);assert.ok(span<=g.length);
      if(GATE_WIDTH[style])assert.ok(span/GATE_WIDTH[style]>=.75&&span/GATE_WIDTH[style]<=GATE_MAX_STRETCH+1e-9,`Chapter ${chapter}: a gate stretched ${(span/GATE_WIDTH[style]).toFixed(2)}`);
    }
    // The camp's wall, towers and gate stand only where the catalog names their chapter.
    const placed=new Set(sceneryPlacements(e,{chapter,desktop:true}).map(p=>p.id)),set=CAMP_WALL_MODELS[style];
    for(const id of Object.values(set))assert.equal(placed.has(id),CAMP_WALL_CHAPTERS[id].includes(chapter),`${id} in Chapter ${chapter}`);
    assert.deepEqual([campWallSections(e),campGateways(e)],[sections,gates],'presentation is data, not randomness');assert.equal(JSON.stringify(e),before);
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
  // Chapter I takes the palisade alone, VII and VIII the pilot's models, IX all but the two tent variants, XII none.
  const room=(id,c)=>c!==12&&(c!==1||id===CAMP_PALISADE)&&(![7,8].includes(c)||PILOT.includes(id))&&(c!==9||!TENT_VARIANTS.includes(id));
  for(const id of G3){
    const entry=WORLD_CATALOG[id];assert.deepEqual(entry.files,[`assets/models/world/${id}.glb`]);
    assert.deepEqual(entry.web,entry.chapters.filter(c=>room(id,c)),`${id}'s web chapters`);
    for(let chapter=1;chapter<=12;chapter++){
      assert.equal(chapterWorldFiles(chapter,{desktop:true}).includes(entry.files[0]),entry.chapters.includes(chapter),`${id} in Chapter ${chapter}'s desktop pack`);
      assert.equal(chapterWorldFiles(chapter,{desktop:false}).includes(entry.files[0]),entry.web.includes(chapter),`${id} in Chapter ${chapter}'s web pack`);
      assert.equal(worldAssetShown(id,chapter,{desktop:false}),!entry.chapters.includes(chapter)||entry.web.includes(chapter));
      assert.equal(worldAssetShown(id,chapter,{desktop:true}),true);
    }
  }
  assert.deepEqual(desktopOnlyWorldFiles(),[],'every G3 model is in some web chapter, so the web build keeps them all');
  // On the web Chapter I's camp shows the palisade and keeps the rest as before; the desktop app shows all ten.
  const e=campOf(1),web=sceneryPlacements(e,{chapter:1,desktop:false}).map(p=>p.id),desk=sceneryPlacements(e,{chapter:1,desktop:true}).map(p=>p.id);
  assert.deepEqual(G3.filter(id=>web.includes(id)),[CAMP_PALISADE]);
  assert.deepEqual(G3.filter(id=>desk.includes(id)).sort(),[CAMP_PALISADE,CAMP_TOWER,'g3-officers-tent','g3-training-post','g3-supply-stack',
    'g3-gate-timber','g3-tent-open','g3-tent-patched','g3-tribunal','g3-altar'].sort());
  // Chapter IX's web camp has its stone wall, towers and gate and its furniture; its six tents are leather there.
  const ix=campOf(9),ixWeb=sceneryPlacements(ix,{chapter:9,desktop:false}).map(p=>p.id);
  assert.deepEqual(G3.filter(id=>ixWeb.includes(id)).sort(),WORLD_CATALOG_G3_IX.sort());
  assert.ok(regionalTentPitches(ix,2.5,{desktop:false}).every(p=>p.model===TENT_MODEL));
});
const WORLD_CATALOG_G3_IX=['g3-officers-tent','g3-horse-lines','g3-supply-stack','g3-wall-stone','g3-tower-stone','g3-gate-stone','g3-praetorium',
  'g3-hospital-tent','g3-tribunal','g3-parley-awning','g3-pavilion-east','g3-pavilion-shade'];

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

test('a stone camp\'s wall, towers and gates are drawn instanced, and the wall hides the code-built parapet alone', async () => {
  const e=campOf(9),chapter=9,scene=new T.Scene();
  const env=createEnvironment(scene,e,{chapter,quality:'high',loadTextures:false});
  const parapet=env.group.getObjectByName(CAMP_PARAPET_BATCHES.stone),masonry=env.group.getObjectByName('squared stone masonry');
  // The parapet's batch holds the wall cells' own blocks only: three courses, a coping and the merlons of each.
  const cells=campWallRuns(e).reduce((n,r)=>n+r.cells.length,0);
  assert.equal(parapet?.count,cells*19);assert.ok(parapet.userData.replaceable);assert.ok(masonry&&!masonry.userData.replaceable);
  const set=CAMP_WALL_MODELS.stone,urls=Object.values(set).map(worldModelUrl);
  const slope=(x,z)=>.03*x-.02*z,cache=createSceneryModelCache({load:url=>urls.includes(url)?loadFile(url):Promise.resolve(new T.Group())});
  const models=createSceneryModels(scene,e,{chapter,heightAt:slope,cache});await models.ready;
  const wall=models.group.getObjectByName('camp-wall'),towers=models.group.getObjectByName('camp-towers'),gates=models.group.getObjectByName('camp-gates');
  assert.ok(wall&&towers&&gates);
  for(const b of [...wall.children,...towers.children,...gates.children]){assert.ok(b.isInstancedMesh);assert.ok(b.instanceColor?.array.every(v=>v===1),'white instance colours');}
  assert.deepEqual([wall.children[0].count,towers.children[0].count,gates.children[0].count],[campWallSections(e).length,campTowerSpots(e).length,campGateways(e).length]);
  assert.equal(parapet.visible,false,'the wall hides the code-built parapet');assert.equal(masonry.visible,true,'and leaves the terraces and kerbs');
  // A gate spans its gateway, centred over it.
  const matrix=new T.Matrix4(),box=new T.Box3(),full=new T.Box3();for(const b of gates.children)b.geometry.computeBoundingBox();
  for(const [i,g]of campGateways(e).entries()){
    full.makeEmpty();for(const b of gates.children){b.getMatrixAt(i,matrix);box.copy(b.geometry.boundingBox).applyMatrix4(matrix);full.union(box);}
    const size=full.getSize(new T.Vector3()),centre=full.getCenter(new T.Vector3()),along=g.yaw%Math.PI===0?size.x:size.z;
    assert.ok(Math.abs(along-campGateSpan('stone',g))<.05,`gate ${i}: ${along.toFixed(2)} m across a ${g.length} m gateway`);
    assert.ok(Math.abs(centre.x-g.x)<.06&&Math.abs(centre.z-g.z)<.06,`gate ${i} centred on its gateway`);
  }
  models.dispose();assert.equal(parapet.visible,true,'the parapet returns with the wall gone');
  env.dispose();cache.clear();
});

test('the tent lines mix the leather tent with the open and the patched tents by cell, each model over its own code-built tents', async () => {
  // Chapter I's web download has no room for the variants: there its pitches all take the leather tent.
  assert.ok(regionalTentPitches(campOf(1),2.5,{desktop:false}).every(p=>p.model===TENT_MODEL));
  const desk=regionalTentPitches(campOf(1),2.5,{desktop:true});
  for(const model of [TENT_MODEL,...TENT_VARIANTS])assert.ok(desk.some(p=>p.model===model),`Chapter I's desktop tent lines pitch ${model}`);
  assert.deepEqual(regionalTentPitches(campOf(1),2.5,{desktop:true}),desk,'presentation is data, not randomness');
  // A variant downloads with the chapters whose pitches pick it (a camp of one or two tents may pick neither),
  // and on the desktop every pitch takes the tent it picks.
  const picks=Object.fromEntries(TENT_LINE_CHAPTERS.map(c=>[c,regionalTentPitches(campOf(c),2.5,{desktop:true})]));
  for(const id of TENT_VARIANTS)assert.deepEqual(TENT_VARIANT_CHAPTERS[id],TENT_LINE_CHAPTERS.filter(c=>picks[c].some(p=>tentVariantOf(p)===id)),`${id}: the chapters whose tent lines pick it`);
  for(const [c,pitches]of Object.entries(picks))assert.ok(pitches.every(p=>p.model===(tentVariantOf(p)??TENT_MODEL)),`Chapter ${c}'s desktop tents`);
  assert.deepEqual(TENT_LINE_CHAPTERS.filter(c=>picks[c].some(p=>tentVariantOf(p))),[1,2,3,7,8,9,12],'Chapters IV and VI pitch the leather tent alone');
  const e=campOf(2),chapter=2,scene=new T.Scene(),pitches=regionalTentPitches(e);
  assert.deepEqual(new Set(pitches.map(p=>p.model)),new Set([TENT_MODEL,...TENT_VARIANTS]),'all three tents on Chapter II\'s web tent lines');
  const env=createEnvironment(scene,e,{chapter,quality:'high',loadTextures:false});
  const batches=Object.fromEntries([TENT_MODEL,...TENT_VARIANTS].map(m=>[m,env.group.getObjectByName(tentFallbackName(m))]));
  for(const [m,b]of Object.entries(batches)){assert.equal(b?.count,pitches.filter(p=>p.model===m).length,`${m}'s code-built tents`);assert.ok(b.userData.replaceable);}
  // With only the open tent's model ready, its pitches show the model and the others keep their code-built tents.
  const url=worldModelUrl('g3-tent-open'),cache=createSceneryModelCache({load:u=>u===url?loadFile(u):new Promise(()=>{})});
  const models=createSceneryModels(scene,e,{chapter,cache});await new Promise(r=>setTimeout(r,50));
  const open=models.group.getObjectByName('tent-lines:g3-tent-open');assert.ok(open);assert.equal(open.children[0].count,pitches.filter(p=>p.model==='g3-tent-open').length);
  assert.deepEqual(Object.fromEntries(Object.entries(batches).map(([m,b])=>[m,b.visible])),{[TENT_MODEL]:true,'g3-tent-open':false,'g3-tent-patched':true});
  models.dispose();assert.ok(Object.values(batches).every(b=>b.visible));
  env.dispose();cache.clear();
});

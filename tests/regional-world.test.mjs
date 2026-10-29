import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import * as G from '../src/core/game.js';
import {REGIONAL_WORLD_KITS,getRegionalKitPlacements,regionalPlacementBounds,regionalServicePads,regionalPropPlacements,REGIONAL_PROP_CHAPTERS} from '../src/showcase/environment-regional-world.js';
import {createGroundHeight,distantRiverCentre} from '../src/showcase/environment-layout.js';
import {createEnvironment} from '../src/showcase/environment.js';
import {getSceneProfile} from '../src/showcase/campaign-scene-profile.js';
import {createSceneryModels,sceneryPlacements} from '../src/showcase/scenery-models.js';
import {LIFE_PROP_CHAPTERS,WORLD_CATALOG,chapterWorldFiles} from '../src/ui/world-catalog.js';
const fixture=JSON.parse(await readFile(new URL('./fixtures/campaign-3d.json',import.meta.url),'utf8'));
const graphics=JSON.parse(await readFile(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
const field=(id,width=8,height=8,kind='battle')=>({id,width,height,kind,terrain:Array.from({length:height},()=>Array(width).fill('sand')),units:[]});
const clear=(b,hx,hz)=>b.maxX < -hx||b.minX > hx||b.maxZ < -hz||b.minZ > hz;

test('Every remaining chapter has a distinct composition on turn, expanded real-time and courtyard boards',()=>{
  const fingerprints=new Set(),kits=new Set();
  for(let chapter=1;chapter<=12;chapter++){
    if(chapter===5)continue;
    for(const [width,height]of [[8,8],[24,24],[20,16],[30,24]]){
      const e=field(`ch${chapter}-camp`,width,height),before=JSON.stringify(e),placements=getRegionalKitPlacements(e);
      assert.ok(placements.length>=8&&placements.length<=14);assert.equal(new Set(placements.map(p=>p.key)).size,placements.length);
      assert.ok(Math.cos(placements[0].yaw)>.99,'north-front doors and work faces open toward the courtyard, not away from it');
      assert.deepEqual(getRegionalKitPlacements(e),placements);
      for(const p of placements){const bounds=regionalPlacementBounds(p);assert.ok(clear(bounds,width*1.25+.5,height*1.25+.5),`${e.id} ${p.component} complete footprint`);kits.add(p.id);}
      for(let i=0;i<placements.length;i++)for(let j=i+1;j<placements.length;j++){
        const a=regionalPlacementBounds(placements[i]),b=regionalPlacementBounds(placements[j]);
        assert.ok(a.maxX<=b.minX||a.minX>=b.maxX||a.maxZ<=b.minZ||a.minZ>=b.maxZ,`${e.id} ${placements[i].component}/${placements[j].component} do not overlap`);
      }
      if(width===8)fingerprints.add(placements.map(p=>`${p.id}:${p.component}:${p.yaw}`).join('|'));
      assert.equal(JSON.stringify(e),before);
    }
  }
  assert.equal(fingerprints.size,11);assert.equal(kits.size,6);
  for(const s of fixture.scenes.filter(s=>s.chapter!==5))for(const width of [8,24]){
    const e={...s.state.encounter,width,height:width},placements=getRegionalKitPlacements(e);for(const p of placements)assert.ok(clear(regionalPlacementBounds(p),width*1.25,width*1.25),`${e.id}/${p.component}`);
    for(let i=0;i<placements.length;i++)for(let j=i+1;j<placements.length;j++){
      const a=regionalPlacementBounds(placements[i]),b=regionalPlacementBounds(placements[j]);
      assert.ok(a.maxX<=b.minX||a.minX>=b.maxX||a.maxZ<=b.minZ||a.minZ>=b.maxZ,`${e.id} gate and civic components remain separated`);
    }
  }
  assert.deepEqual(getRegionalKitPlacements(field('ch5-mine')),[],'approved pilot retains its own unchanged composition');
  assert.deepEqual(getRegionalKitPlacements(field('ch1-road'),{chapter:7}),[],'mismatched chapter cannot load another region');
});

test('Offline packs contain each regional asset only where the renderer can use it',()=>{
  for(let chapter=1;chapter<=12;chapter++){
    const e=field(`ch${chapter}-camp`,20,16),files=chapterWorldFiles(chapter);
    for(const placement of sceneryPlacements(e,{chapter}))assert.ok(files.includes(WORLD_CATALOG[placement.id].files[0]),`${chapter}:${placement.id}`);
  }
  for(const [id,chapters]of Object.entries(REGIONAL_PROP_CHAPTERS))for(let chapter=1;chapter<=12;chapter++)assert.equal(chapterWorldFiles(chapter).includes(`assets/models/world/${id}.glb`),chapters.includes(chapter));
  assert.equal(Object.keys(REGIONAL_PROP_CHAPTERS).length,16);
  for(const [id,chapters]of Object.entries(LIFE_PROP_CHAPTERS))for(let chapter=1;chapter<=12;chapter++){
    assert.equal(chapterWorldFiles(chapter).includes(`assets/models/world/${id}.glb`),chapters.includes(chapter),`${id} in Chapter ${chapter}`);
    assert.equal(sceneryPlacements(field(`ch${chapter}-camp`,20,16),{chapter}).filter(p=>p.id===id).length,chapters.includes(chapter)?1:0,`${id} set out in Chapter ${chapter}`);
    assert.equal(sceneryPlacements(field(`ch${chapter}-council`,20,16,'contest'),{chapter}).filter(p=>p.id===id).length,0,`${id} stays outdoors in Chapter ${chapter}`);
  }
  // Life has no code-built stand-in: without its model, on Performance, the place stays empty.
  for(let chapter=1;chapter<=12;chapter++){
    const e=field(`ch${chapter}-camp`,20,16),life=regionalPropPlacements(e,{chapter}).filter(p=>LIFE_PROP_CHAPTERS[p.id]);
    for(const p of life)assert.equal(p.fallbackName,undefined,`${p.id} draws nothing in its place without its model`);
    const world=createEnvironment(new T.Scene(),e,{chapter,quality:'performance',loadTextures:false});
    for(const p of life)assert.equal(world.group.getObjectByName(`regional-prop:${p.id}`),undefined,`${p.id} has no stand-in in Chapter ${chapter}`);
    world.dispose();
  }
});

test('Scenic rivers move outside expanded maps without changing any authored walking height',()=>{
  for(const chapter of [1,2,4,8,10])for(const size of [[8,8],[24,24],[30,24]]){
    const e=field(`ch${chapter}-camp`,...size),profile=getSceneProfile(e),wet=createGroundHeight(e,2.5,{profile}),dry=createGroundHeight(e,2.5,{profile:{...profile,distantWater:false}}),hx=e.width*1.25,hz=e.height*1.25;
    for(let x=-hx;x<=hx;x+=1.1)for(let z=-hz;z<=hz;z+=1.1)assert.equal(wet(x,z),dry(x,z),`${chapter} scenic channel stays beyond ${size}`);
    assert.ok(distantRiverCentre(e)+8 < -hz,'complete sixteen-metre river strip clears map');
    assert.ok(wet(0,distantRiverCentre(e))<dry(0,distantRiverCentre(e))-2.6);
  }
  assert.equal(distantRiverCentre(field('ch1-road')),-29,'original small-board horizon remains aligned');
});

test('All eleven new hub prop pockets validate every blocked cell and every fitted placement',()=>{
  for(let chapter=1;chapter<=12;chapter++){
    if(chapter===5)continue;
    const checkpoint=graphics.scenes.find(s=>s.id===`camp-${chapter}`);assert.ok(checkpoint);
    const world=G.createCampWorld(G.deserialize(JSON.stringify(checkpoint.state))),e={...world.map,campPresentation:world.campPresentation},before=JSON.stringify(e),pads=regionalServicePads(e);
    assert.equal(pads.length,3,`Chapter ${chapter} has supply, water and local pockets`);
    for(const p of regionalPropPlacements(e)){if(p.pad){const pad=pads.find(pad=>pad.id===p.padId);assert.ok(pad);assert.equal(p.x,pad.x+.4);assert.equal(p.fitWithin.width,pad.width-1.4);assert.ok(p.x-p.fitWithin.width/2>pad.x-1.575,'model leaves the committed-detail strip clear');assert.ok(p.fallbackName.includes(`:${chapter}:`));}else assert.ok(Math.abs(p.x)>e.width*1.25+2.2||Math.abs(p.z)>e.height*1.25+2.2);}
    for(const pad of pads){const invalid=structuredClone(e),cell=pad.cells[0];invalid.terrain[cell.y][cell.x]='road';assert.ok(!regionalServicePads(invalid).some(p=>p.id===pad.id),'one walkable cell rejects entire pocket');}
    assert.equal(JSON.stringify(e),before);
  }
});

test('The inspected +X shield and archive fronts face their service approach or the board from exterior baggage rows',()=>{
  for(const chapter of [1,4,7,11]){
    const checkpoint=graphics.scenes.find(s=>s.id===`camp-${chapter}`),camp=G.createCampWorld(G.deserialize(JSON.stringify(checkpoint.state))),e={...camp.map,campPresentation:camp.campPresentation};
    const before=JSON.stringify(e),placements=regionalPropPlacements(e),sensitive=placements.filter(p=>['equipment-rack','archive-cabinet'].includes(p.id));assert.equal(sensitive.length,1);
    for(const p of sensitive){
      const target=p.pad?e.campPresentation.places.find(place=>place.id===(p.id==='equipment-rack'?'quartermaster':'principia')):{x:p.x,z:0};
      const direction=new T.Vector3(target.x-p.x,0,target.z-p.z).normalize(),front=new T.Vector3(1,0,0).applyAxisAngle(new T.Vector3(0,1,0),p.yaw);
      assert.ok(front.dot(direction)>.999999,`${chapter}:${p.id} useful front faces approach`);
      assert.ok(p.pad||Math.abs(p.yaw-Math.PI/2)<1e-10,'outside row faces north toward the board');
    }
    assert.deepEqual(regionalPropPlacements(e),placements);assert.equal(JSON.stringify(e),before);
  }
});

test('Failed and partial model downloads keep only the matching fallback owner visible and disposal restores it',async()=>{
  const e=field('ch3-station'),world=createEnvironment(new T.Scene(),e,{quality:'performance',loadTextures:false}),scene=new T.Scene();scene.add(world.group);
  const placements=sceneryPlacements(e,{chapter:3}),chosen=placements.find(p=>p.component),source=new T.Group(),part=new T.Group();part.name=chosen.component;
  const geometry=new T.BoxGeometry(1,1,1),material=new T.MeshStandardMaterial(),mesh=new T.Mesh(geometry,material);mesh.position.y=.5;part.add(mesh);source.add(part);
  const model=createSceneryModels(scene,e,{chapter:3,load:async url=>url.endsWith(`${chosen.id}.glb`)?source:Promise.reject(new Error('offline'))});
  await model.ready;
  assert.equal(world.group.getObjectByName(chosen.fallbackName).visible,false,'the loaded component hides its own fallback');
  for(const p of placements.filter(p=>p.component!==chosen.component)){
    // Life alone has no stand-in to keep (its own test above).
    if(!p.fallbackName){assert.ok(LIFE_PROP_CHAPTERS[p.id],`${p.id} has a fallback`);continue;}
    assert.equal(world.group.getObjectByName(p.fallbackName)?.visible,true,p.fallbackName+' missing download keeps fallback');
  }
  model.dispose();assert.equal(world.group.getObjectByName(chosen.fallbackName).visible,true);world.dispose();
});

test('Region rendering is bounded, pure and releases every resource across eleven courtyard sizes',()=>{
  for(let chapter=1;chapter<=12;chapter++){
    if(chapter===5)continue;
    const checkpoint=graphics.scenes.find(s=>s.id===`camp-${chapter}`),camp=G.createCampWorld(G.deserialize(JSON.stringify(checkpoint.state))),e={...camp.map,campPresentation:camp.campPresentation};
    const before=JSON.stringify(e),scene=new T.Scene(),world=createEnvironment(scene,e,{chapter,quality:'performance',loadTextures:false});
    assert.equal(world.group.userData.regionalWorld.kit,REGIONAL_WORLD_KITS[chapter]);assert.ok(world.group.userData.regionalWorld.services.pads.length===3);
    assert.ok(world.stats().meshes<=85,`${chapter}: courtyard components plus three independent service pockets`);
    const geometry=new Set();world.group.traverse(o=>{if(o.isMesh)geometry.add(o.geometry);});let disposed=0;for(const g of geometry)g.addEventListener('dispose',()=>disposed++);
    world.update(1);world.update(90);assert.equal(JSON.stringify(e),before);world.dispose();world.dispose();assert.equal(disposed,geometry.size);assert.equal(scene.children.length,0);
  }
});

test('Decision and won-outcome details share bounded batches without hiding one another or intruding into the model footprints',()=>{
  const checkpoint=graphics.scenes.find(s=>s.id==='camp-10'),camp=G.createCampWorld(G.deserialize(JSON.stringify(checkpoint.state)));
  // Synthetic presentation-only case deliberately combines several recorded
  // details, including distinct allocations of the same kind. No campaign
  // decision or victory is fabricated in a playable save.
  const e={...camp.map,campPresentation:{...camp.campPresentation,
    decisionDetails:[{id:'choice',kind:'justice',state:'shared-tenure'},{id:'mentor',kind:'ceremony',state:'vine-stick'},...['farm','town','army'].map((id,i)=>({id,kind:'stores',state:`${id}:${i*2}`,count:i*2}))],
    outcomeDetails:[{id:'hearing',kind:'justice',state:'hearing-recorded'},{id:'field',kind:'engineering',state:'gate-bracing'}]}};
  const before=JSON.stringify(e),world=createEnvironment(new T.Scene(),e,{quality:'balanced',chapter:10,loadTextures:false}),details=world.group.userData.regionalWorld.services.outcomes;
  assert.deepEqual(details.map(d=>d.id).sort(),['choice','mentor','farm','town','army','hearing','field'].sort(),'same-kind decisions and won outcomes remain individually visible');
  const group=world.group.getObjectByName('regional committed service details'),pads=regionalServicePads(e);group.updateWorldMatrix(true,true);let meshes=0;
  group.traverse(o=>{if(!o.isMesh)return;meshes++;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){
    const v=new T.Vector3(a.getX(i),a.getY(i),a.getZ(i)).applyMatrix4(o.matrixWorld);
    assert.ok(pads.some(p=>v.x>=p.x-2.13&&v.x<=p.x-1.57&&v.z>=p.z-2.21&&v.z<=p.z+2.21),'every outcome vertex occupies only a reserved left strip');
  }});
  assert.ok(meshes<=6,'the full set uses shared material batches, not draws per outcome');
  assert.equal(JSON.stringify(e),before);world.dispose();
});

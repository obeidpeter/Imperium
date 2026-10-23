import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/three/addons/libs/meshopt_decoder.module.js';
import {CH5_KIT_COMPONENTS,getChapterFiveKitPlacements,chapterFivePlacementBounds,chapterFivePilotHeight,chapterFiveServicePads,addChapterFivePilot} from '../src/showcase/environment-ch5-pilot.js';
import {createEnvironment} from '../src/showcase/environment.js';
import {createGroundHeight} from '../src/showcase/environment-layout.js';
import {getSceneProfile} from '../src/showcase/campaign-scene-profile.js';
import {createPropFactory} from '../src/showcase/environment-props.js';
import {createEnvironmentMaterials} from '../src/showcase/environment-materials.js';
import {addCampaignTerrain} from '../src/showcase/environment-campaign-terrain.js';
import * as G from '../src/core/game.js';

const field=(id,width=8,height=8)=>({id,width,height,terrain:Array.from({length:height},()=>Array(width).fill('sand')),units:[]});
const fields=[field('ch5-mine'),field('ch5-wall'),field('ch5-mine',24,24),field('ch5-wall',24,24),field('ch5-camp',20,16)];

test('Pilot paving reduces distant joint density without extra draw batches or overlapping slabs',()=>{
  const geometries=new Set(),library=createEnvironmentMaterials({loadTextures:false}),p=createPropFactory(library.materials,geometries),samples=new Map();
  for(const id of ['unmapped-field','ch4-gate','ch5-fieldwork','ch5-mine','ch5-wall','ch5-camp','ch10-camp']){
    const e=field(id,4,4);e.terrain=e.terrain.map(row=>row.map(()=>'stone'));const before=JSON.stringify(e),slabs=[];
    addCampaignTerrain({root:new T.Group(),e,p,m:library.materials,profile:getSceneProfile(e),height:()=>0,tileSize:2.5,instance:(key,geometry,material,position,scale,rotation)=>{if(key==='authored flagstones')slabs.push({key,geometry,material,position,scale,rotation});}});
    samples.set(id,slabs);assert.equal(JSON.stringify(e),before);
    assert.ok(slabs.every(s=>s.geometry===p.box&&s.material===library.materials.marble),'existing single instance batch is reused');
  }
  const old=samples.get('unmapped-field');assert.deepEqual(samples.get('ch5-fieldwork'),old,'other Chapter V scenery retains existing paving');
  for(const id of ['ch4-gate','ch5-mine','ch5-wall','ch5-camp','ch10-camp']){
    const slabs=samples.get(id);assert.ok(slabs.length<old.length*.75,'pilot reduces geometry instead of adding a distance draw');
    for(const slab of slabs)assert.ok(Math.abs(slab.rotation[1])<=.006&&Math.abs(slab.scale[2]-(2.5/3-.025))<1e-9);
    for(let i=0;i<slabs.length;i++)for(let j=i+1;j<slabs.length;j++){
      const a=slabs[i],b=slabs[j],radius=s=>{const c=Math.abs(Math.cos(s.rotation[1])),q=Math.abs(Math.sin(s.rotation[1]));return [(s.scale[0]*c+s.scale[2]*q)/2,(s.scale[0]*q+s.scale[2]*c)/2];},ra=radius(a),rb=radius(b);
      assert.ok(Math.abs(a.position[0]-b.position[0])>=ra[0]+rb[0]||Math.abs(a.position[2]-b.position[2])>=ra[1]+rb[1],'reduced grout and yaw leave every slab separated');
    }
  }
  for(const g of geometries)g.dispose();library.dispose();
});

test('Chapter V modular placements leave every point of all five supported board sizes clear',()=>{
  const used=new Set();
  for(const e of fields){
    const before=JSON.stringify(e),placements=getChapterFiveKitPlacements(e);
    assert.ok(placements.length>=20&&placements.length<=36);
    assert.deepEqual(getChapterFiveKitPlacements(e),placements);
    for(const p of placements){
      const b=chapterFivePlacementBounds(p),hx=e.width*1.25,hz=e.height*1.25;used.add(p.component);
      assert.ok(b.maxX < -hx-.5 || b.minX > hx+.5 || b.maxZ < -hz-.5 || b.minZ > hz+.5,`${e.id}: ${p.component} complete footprint clears navigation`);
      assert.ok(p.fallbackName&&p.key&&p.scale.every(Number.isFinite));
    }
    assert.equal(new Set(placements.map(p=>p.key)).size,placements.length);
    assert.equal(JSON.stringify(e),before);
  }
  assert.equal(Object.keys(CH5_KIT_COMPONENTS).length,16);
  assert.equal(used.size,16,'every authored component is used in the playable pilot');
  assert.deepEqual(getChapterFiveKitPlacements(field('ch4-gate')),[]);
  assert.deepEqual(getChapterFiveKitPlacements(field('ch5-mine'),{chapter:4}),[]);
});

test('The river has a real bed beyond the board while legal terrain remains exactly unchanged',()=>{
  for(const e of fields){
    const base=createGroundHeight(e,2.5,{profile:getSceneProfile(e)}),height=chapterFivePilotHeight(base,e),hx=e.width*1.25,hz=e.height*1.25;
    for(let x=-hx;x<=hx;x+=.8)for(let z=-hz;z<=hz;z+=.8)assert.equal(height(x,z),base(x,z));
    assert.ok(height(0,-hz-19)<-2.2,'channel below the -1.2m waterline');
    assert.equal(height(0,-hz-2),base(0,-hz-2),'fortress footing stays on its original ground');
    const deck=getChapterFiveKitPlacements(e).find(p=>p.component==='landing_deck');
    assert.equal(deck.groundY,-1.4,'landing uses the water datum rather than a submerged bank corner');
    assert.ok(deck.groundY<-1.2,'mooring posts extend below the river surface');
    assert.ok(deck.groundY+.48>-1.2,'walking deck stays above the river on every board size');
  }
  const base=()=>.4;assert.equal(chapterFivePilotHeight(base,field('ch4-gate')),base);
});

test('The fallback is present, bounded and disposable on every graphics quality without model downloads',()=>{
  for(const quality of ['performance','balanced','high']){
    const e=field('ch5-mine'),before=JSON.stringify(e),scene=new T.Scene();
    const world=createEnvironment(scene,e,{quality,loadTextures:false,chapter:5}),root=world.group;
    assert.equal(root.userData.chapterFivePilot.materialFamilies,4);
    assert.equal(root.userData.chapterFivePilot.components,getChapterFiveKitPlacements(e).length);
    assert.ok(root.getObjectByName('Euphrates river beyond siege bluff'));
    assert.equal(root.getObjectByName('Euphrates siege benchmark'),undefined,'old overlapping siege frontage is replaced');
    for(const p of getChapterFiveKitPlacements(e)){
      const g=root.getObjectByName(p.fallbackName);assert.ok(g?.visible,p.component+' fallback survives batching');
      g.traverse(o=>{if(o.isMesh){assert.ok(o.userData.environmentDynamic);assert.equal(o.raycast(),undefined);}});
    }
    assert.ok(world.stats().meshes<150,`${quality}: fallback uses independent material batches`);
    const geometries=new Set();root.traverse(o=>{if(o.isMesh)geometries.add(o.geometry);});
    let disposed=0;for(const g of geometries)g.addEventListener('dispose',()=>disposed++);
    world.update(0);world.update(12);assert.equal(JSON.stringify(e),before);
    world.dispose();world.dispose();assert.equal(scene.children.length,0);assert.equal(disposed,geometries.size);
  }
});

test('The shipped Blender kit has sixteen local-origin components, textured surfaces and honest footprint bounds',async()=>{
  const bytes=await readFile(new URL('../assets/models/scenery/ch5-fortress-kit.glb',import.meta.url));
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
  const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const materials=new Set(),geometries=new Set();
  for(const [id,[w,h,d]]of Object.entries(CH5_KIT_COMPONENTS)){
    const component=scene.getObjectByName(id);assert.ok(component,id+' exported as a reusable named root');
    const b=new T.Box3().setFromObject(component,true),size=b.getSize(new T.Vector3());
    assert.ok(size.x<=w+.03&&size.y<=h+.03&&size.z<=d+.03,id+' fits conservative runtime bounds');
    assert.ok(Math.max(Math.abs(b.min.x),Math.abs(b.max.x))<=w/2+.03&&Math.max(Math.abs(b.min.z),Math.abs(b.max.z))<=d/2+.03,id+' asymmetric details fit clearance envelope');
    assert.ok(Math.abs(b.min.y)<.03,id+' rests at local ground origin');
    component.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);for(const mat of [o.material].flat()){materials.add(mat);assert.ok(mat.map&&mat.roughnessMap,'original colour and roughness bakes are embedded');}}});
  }
  assert.equal(materials.size,4);
  assert.ok(bytes.length<1_700_000&&gzipSync(bytes).length<500_000,'reusable textured kit fits its raw and delivered chapter budgets');
  const report=JSON.parse(await readFile(new URL('../art-source/models/processed/ch5-fortress-kit.json',import.meta.url),'utf8'));
  assert.equal(report.components.length,16);assert.equal(report.materials.length,4);
  assert.ok(report.components.every(c=>c.triangles>0&&c.triangles<14_000));
  for(const g of geometries)g.dispose();for(const m of materials){m.map?.dispose();m.roughnessMap?.dispose();m.dispose();}
});

test('Courtyard shelters clear walking height, service props fill only authored pockets, and visible objects match interaction anchors',async()=>{
  const fixture=JSON.parse(await readFile(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
  const state=G.deserialize(JSON.stringify(fixture.scenes.find(s=>s.id==='camp-5').state));
  const world=G.createCampWorld(state),e={id:'ch5-camp',width:world.map.width,height:world.map.height,terrain:world.map.terrain,campPresentation:world.campPresentation};
  const before=JSON.stringify(world),geometries=new Set(),root=new T.Group(),profile=getSceneProfile(e),library=createEnvironmentMaterials({profile,loadTextures:false});
  const p=createPropFactory(library.materials,geometries,{quality:'performance'});root.userData.environmentLandmarks=[];
  addChapterFivePilot({root,e,p,m:library.materials,profile,height:()=>0,tileSize:2.5,geometries});root.updateMatrixWorld(true);
  const services=root.userData.chapterFivePilot.services;assert.equal(services.shelters.length,3);assert.equal(services.pads.length,3);
  const roofs=services.shelters.map(s=>root.getObjectByName(s.name));
  for(let z=-19.7;z<19.8;z+=.65)for(let x=-24.7;x<24.8;x+=.65){
    const gx=Math.floor((x+25)/2.5),gy=Math.floor((z+20)/2.5),tile=e.terrain[gy]?.[gx];if(tile==='wall'||tile==='rock')continue;
    const ray=new T.Raycaster(new T.Vector3(x,2.15,z),new T.Vector3(0,-1,0),0,2.15);
    assert.equal(ray.intersectObjects(roofs,true).length,0,`shelter keeps walking clearance at ${x},${z}`);
  }
  for(const pad of chapterFiveServicePads(e)){
    const object=root.getObjectByName(pad.fallbackName),b=new T.Box3().setFromObject(object,true);assert.ok(object.visible);
    assert.ok(b.min.x>=pad.x-pad.width/2+.2&&b.max.x<=pad.x+pad.width/2-.2&&b.min.z>=pad.z-pad.depth/2+.2&&b.max.z<=pad.z+pad.depth/2-.2,pad.id+' fallback fits its blocked service pocket');
  }
  for(const interaction of services.interactions){
    const target=e.campPresentation.interactions.find(t=>t.id===interaction.id),object=root.getObjectByName(`courtyard interaction ${interaction.id}`);
    assert.equal(object.position.x,target.x);assert.equal(object.position.z,target.z);
  }
  const stale={...e,terrain:e.terrain.map(row=>row.map(t=>t==='rock'?'stone':t))};
  assert.deepEqual(chapterFiveServicePads(stale),[],'stale metadata never suppresses a walkable surface');
  assert.equal(JSON.stringify(world),before);for(const g of geometries)g.dispose();library.dispose();
});

test('Committed courtyard outcomes remain visible beside loaded props and inside their blocked service pockets',async()=>{
  const fixture=JSON.parse(await readFile(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
  const state=G.deserialize(JSON.stringify(fixture.scenes.find(s=>s.id==='camp-5').state)),camp=G.createCampWorld(state);
  for(const decision of ['pending','civilians','countermine']){
    const committed=decision!=='pending',data={...camp.campPresentation,decision,civilianOutcome:decision==='civilians'?'departing':committed?'delayed':'waiting',stores:decision==='civilians'?'transport':committed?'secured':'unassigned',waterDetail:committed,engineeringRecovered:committed};
    const e={id:'ch5-camp',width:camp.map.width,height:camp.map.height,terrain:camp.map.terrain,campPresentation:data},before=JSON.stringify(e);
    const root=new T.Group(),geometries=new Set(),profile=getSceneProfile(e),library=createEnvironmentMaterials({profile,loadTextures:false}),p=createPropFactory(library.materials,geometries,{quality:'performance'});root.userData.environmentLandmarks=[];
    addChapterFivePilot({root,e,p,m:library.materials,profile,height:()=>0,tileSize:2.5,geometries});root.updateMatrixWorld(true);
    const outcomes=root.userData.chapterFivePilot.services.outcomes;
    assert.deepEqual(outcomes,committed?decision==='civilians'?['recovered-engineering-tools','filled-water-pails','civilian-transport']:['secured-stores','recovered-engineering-tools','filled-water-pails']:[]);
    for(const pad of chapterFiveServicePads(e)){
      const fallback=root.getObjectByName(pad.fallbackName),details=root.getObjectByName(`courtyard outcomes ${pad.id}`);fallback.visible=false;
      if(!details)continue;assert.ok(details.visible);assert.notEqual(details.parent,fallback);
      const b=new T.Box3().setFromObject(details,true);
      assert.ok(b.min.x>=pad.x-pad.width/2+.2&&b.max.x<=pad.x+pad.width/2-.2&&b.min.z>=pad.z-pad.depth/2+.2&&b.max.z<=pad.z+pad.depth/2-.2,'outcome geometry never leaves its blocked pad');
      details.traverse(o=>{if(o.isMesh)assert.ok(o.userData.environmentDynamic);});
    }
    assert.equal(JSON.stringify(e),before);for(const geometry of geometries)geometry.dispose();library.dispose();
  }
});

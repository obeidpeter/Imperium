import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/three/addons/libs/meshopt_decoder.module.js';
import * as Game from '../src/core/game.js';
import {CAMPS,campFor} from '../src/data/camps.js';
import {CAMP_TENT_PITCHES,tentCells} from '../src/data/camp-regions.js';
import {CHAPTERS} from '../src/data/campaign.js';
import {campExitFor,campPoint} from '../src/core/realtime/camp-world.js';
import {layoutFor} from '../src/core/realtime/campaign-encounter.js';
import {routePreview} from '../src/core/realtime/simulation.js';
import {navGrid,walkable} from '../src/core/realtime/navigation.js';
import {regionalTentPitches,TENT_MODEL,TENT_FALLBACK} from '../src/showcase/environment-regional-world.js';
import {createSceneryModels,sceneryPlacements} from '../src/showcase/scenery-models.js';
import {createSceneryModelCache} from '../src/showcase/scenery-cache.js';
import {createCampGroundSampler} from '../src/showcase/camp-composition.js';
import {WORLD_CATALOG,TENT_LINE_CHAPTERS,chapterWorldFiles,worldModelUrl} from '../src/ui/world-catalog.js';

// The tent lines (graphics plan, G3): a contubernium's tent pitched on tent-line ground, solid for
// walking, drawn from one model in one instanced draw for each of its meshes.
const root=new URL('../',import.meta.url);
const fixtures=JSON.parse(await readFile(new URL('tests/fixtures/graphics-scenes.json',root),'utf8'));
const base=chapter=>Game.deserialize(JSON.stringify(fixtures.scenes.find(s=>s.id===`camp-${chapter}`).state));
// Legally earned chapter starts, with explicitly injected variants: both comrades and mentors, every
// encounter's way out, and every veteran recovering at the valetudinarium.
function variants(chapter){
  const list=[],encounters=CHAPTERS.find(c=>c.id===chapter).encounters.length;
  for(const comrade of ['carry','leave'])for(const mentor of ['save','obey'])for(let i=0;i<encounters;i++)for(const hurt of [false,true]){
    const state=base(chapter);state.decisions.ch2=comrade;state.decisions.ch6=mentor;state.encounterIndex=i;
    if(hurt)for(const v of state.company??[])v.recovery=Math.max(1,v.recovery??0);
    list.push(state);
  }
  return list;
}
const TILE=2.5,stageOf=world=>({...world.map,id:world.map.id,campPresentation:world.campPresentation});

test('each tent is pitched on two cells of its camp’s tent-line ground, inside the board and clear of the pockets',()=>{
  assert.deepEqual(TENT_LINE_CHAPTERS,[1,2,3,4,6,7,8,9,12]);
  for(const [chapter,camp]of Object.entries(CAMPS)){
    const world=Game.createCampWorld(base(Number(chapter))),{terrain,width,height}=world.map,taken=new Set();
    assert.deepEqual(camp.tentPitches,CAMP_TENT_PITCHES[chapter]??[]);
    const pads=new Set(camp.sceneryPads.flatMap(p=>p.cells.map(c=>c.join(','))));
    for(const pitch of camp.tentPitches){
      assert.ok(['x','z'].includes(pitch[2])&&[1,-1].includes(pitch[3]),`chapter ${chapter}: ${pitch}`);
      for(const [x,y]of tentCells(pitch)){
        assert.ok(x>=0&&y>=0&&x<width&&y<height,`chapter ${chapter}: ${pitch} inside the board`);
        assert.equal(terrain[y][x],'camp',`chapter ${chapter}: ${pitch} stands on tent-line ground`);
        assert.ok(!pads.has(`${x},${y}`)&&!taken.has(`${x},${y}`),`chapter ${chapter}: ${pitch} shares no cell`);taken.add(`${x},${y}`);
      }
    }
    assert.deepEqual(world.map.blocked??[],camp.tentPitches.flatMap(tentCells),`chapter ${chapter}: the world blocks exactly the pitched cells`);
  }
});

test('every tent keeps two metres from any spot a person, object, place, arrival or way out can take',()=>{
  for(const chapter of TENT_LINE_CHAPTERS){
    const camp=campFor(chapter),layout=layoutFor(camp.terrain[0].length,camp.terrain.length,camp.scale),at=(place,offset)=>campPoint(layout,camp.places[place],offset);
    const spots=[at(camp.entry,[0,-3])];
    for(const p of camp.people){spots.push({id:p.id,...at(p.place,p.at??[0,0])});if(p.ward)spots.push({id:`${p.id} recovering`,...at('valetudinarium',p.ward)});}
    for(const o of camp.objects)spots.push({id:o.id,...at(o.place,o.at??[0,0])});
    for(const id of Object.keys(camp.places)){const c=at(id);spots.push({id,...c},{id:`${id} approach`,x:c.x,z:c.z+2});}
    for(const state of variants(chapter)){
      const exit=campExitFor(state);if(exit)spots.push({id:`way out ${state.encounterIndex}`,...at(exit.place,exit.at)});
      const world=Game.createCampWorld(state),hx=world.map.width*TILE/2,hz=world.map.height*TILE/2,forge=world.campPresentation.smithy;
      if(forge)spots.push({id:'forge',x:forge.x+hx,z:forge.z+hz});
      for(const a of world.actors)spots.push(a);for(const o of world.objects)spots.push(o);
    }
    for(const pitch of camp.tentPitches){
      const cells=tentCells(pitch),xs=cells.map(c=>c[0]),ys=cells.map(c=>c[1]);
      const minX=Math.min(...xs)*TILE,maxX=(Math.max(...xs)+1)*TILE,minZ=Math.min(...ys)*TILE,maxZ=(Math.max(...ys)+1)*TILE;
      for(const p of spots)assert.ok(Math.hypot(Math.max(0,minX-p.x,p.x-maxX),Math.max(0,minZ-p.z,p.z-maxZ))>=2-1e-9,`chapter ${chapter}: ${pitch} clears ${p.id??p.name??'a spot'}`);
    }
  }
});

test('with the tents pitched, every person, object and place stays reachable in every variant, and no tent is walked through',()=>{
  for(const chapter of TENT_LINE_CHAPTERS)for(const state of variants(chapter)){
    const before=JSON.stringify(state),world=Game.createCampWorld(state),grid=navGrid(world.map);
    for(const [x,y]of world.map.blocked){
      assert.equal(world.map.terrain[y][x],'camp','the ground keeps its own name');
      for(const [dx,dz]of [[.5,.5],[1.25,1.25],[2,2]])assert.equal(walkable(grid,x*TILE+dx,y*TILE+dz),false,`chapter ${chapter}: tent cell ${x},${y}`);
    }
    const targets=[...world.actors.filter(a=>a.id!=='hero'),...world.objects,...Object.values(world.places),...Object.values(world.places).map(p=>({...p,z:p.z+2}))];
    for(const target of targets){
      const route=routePreview(world,'hero',target),end=route.points.at(-1);
      assert.ok(end&&Math.hypot(end.x-target.x,end.z-target.z)<=1.8,`chapter ${chapter} (${state.decisions.ch2}, ${state.decisions.ch6}, encounter ${state.encounterIndex}): ${target.id??target.name} reachable`);
      for(const p of route.points){const cx=Math.floor(p.x/TILE),cy=Math.floor(p.z/TILE);assert.ok(!world.map.blocked.some(([x,y])=>x===cx&&y===cy),'a route never crosses a tent');}
    }
    assert.equal(JSON.stringify(state),before,'pitching the tents saves nothing and spends no gameplay randomness');
  }
});

test('a map’s blocked tiles are solid whatever their ground, and the grid is cached apart from the open map',()=>{
  const terrain=Array.from({length:4},()=>Array(4).fill('camp')),open={width:4,height:4,terrain},pitched={width:4,height:4,terrain,blocked:[[1,1],[1,2]]};
  const a=navGrid(open),b=navGrid(pitched);
  assert.notEqual(a,b);assert.equal(walkable(a,1.25*TILE,1.25*TILE),true);assert.equal(walkable(b,1.25*TILE,1.25*TILE),false);assert.equal(walkable(b,1.25*TILE,2.25*TILE),false);
  assert.equal(walkable(b,3.5*TILE,.5*TILE),true,'the rest of the ground stays open');
  assert.equal(navGrid({width:4,height:4,terrain,blocked:[[1,1],[1,2]]}),b,'the same pitches share one grid');
  const world=Game.createCampWorld(base(1)),copy=JSON.parse(JSON.stringify(world.map));
  assert.deepEqual(copy.blocked,world.map.blocked,'a camp world’s tents survive its snapshot');
});

test('the camp’s view lists each pitch in centred metres, and the scenery draws only a whole pitch on tent-line ground',()=>{
  const world=Game.createCampWorld(base(1)),e=stageOf(world),pitches=world.campPresentation.tentPitches,hx=world.map.width*TILE/2,hz=world.map.height*TILE/2;
  assert.equal(pitches.length,CAMP_TENT_PITCHES[1].length);
  for(const [i,pitch]of pitches.entries()){
    const [x,y,ridge,door]=CAMP_TENT_PITCHES[1][i],cells=tentCells(CAMP_TENT_PITCHES[1][i]);
    assert.deepEqual(pitch.cells,cells.map(([cx,cy])=>({x:cx,y:cy})));assert.equal(pitch.ridge,ridge);assert.equal(pitch.door,door);
    assert.equal(pitch.x,(x+(ridge==='x'?1:.5))*TILE-hx);assert.equal(pitch.z,(y+(ridge==='z'?1:.5))*TILE-hz);
  }
  const drawn=regionalTentPitches(e);assert.equal(drawn.length,pitches.length);
  for(const t of drawn){
    const pitch=pitches.find(p=>p.id===t.id),facing=pitch.ridge==='z'?-pitch.door*Math.PI/2:pitch.door>0?0:Math.PI;
    assert.ok(Math.abs(t.yaw-facing)<=.035+1e-9,'a tent turns its door along its ridge, a little askew');assert.ok(t.scale>=1.08&&t.scale<=1.14);
  }
  assert.deepEqual(regionalTentPitches(e),drawn,'the same tents every time, from their cells');
  const stale=structuredClone(e);stale.terrain[pitches[0].cells[1].y][pitches[0].cells[1].x]='road';
  assert.equal(regionalTentPitches(stale).length,pitches.length-1,'a pitch off tent-line ground stays bare');
  assert.deepEqual(regionalTentPitches({...e,id:'ch1-road'}),[],'no tents outside a camp');
  // The worn ways from the gate go round the tents.
  const ground=createCampGroundSampler(e),tents=new Set(pitches.flatMap(p=>p.cells.map(c=>`${c.x},${c.y}`)));
  for(const route of ground.routes)for(const p of route.points.slice(1,-1))assert.ok(!tents.has(`${Math.floor((p.x+hx)/TILE)},${Math.floor((p.z+hz)/TILE)}`),`${route.id}: a worn way avoids the tents`);
});

// Node has no image decoder: geometry loads in full with placeholder textures.
async function loadFile(url){
  const bytes=await readFile(new URL(url,root)),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}

test('one placement draws every tent from the leather tent, an instanced draw a mesh, grounded under each and hiding the code-built tents',async()=>{
  const world=Game.createCampWorld(base(1)),e=stageOf(world),pitches=regionalTentPitches(e);
  const [lines]=sceneryPlacements(e,{chapter:1}).filter(p=>p.instances);
  assert.equal(lines.id,TENT_MODEL);assert.equal(lines.url,worldModelUrl(TENT_MODEL));assert.equal(lines.fallbackName,TENT_FALLBACK);
  assert.deepEqual(lines.instances,pitches.map(p=>({x:p.x,z:p.z,yaw:p.yaw,scale:p.scale})));
  const scene=new T.Scene(),fallback=new T.Group();fallback.name=TENT_FALLBACK;scene.add(fallback);
  const slope=(x,z)=>.04*x-.03*z,cache=createSceneryModelCache({load:url=>url===lines.url?loadFile(url):Promise.resolve(new T.Group())});
  const models=createSceneryModels(scene,e,{chapter:1,heightAt:slope,cache});await models.ready;
  const group=models.group.getObjectByName('tent-lines'),batches=group.children.filter(o=>o.isInstancedMesh);
  assert.ok(batches.length>=1);for(const b of batches)assert.equal(b.count,pitches.length);
  assert.equal(fallback.visible,false,'the model hides the code-built tents');
  // Each tent's footprint is centred on its pitch, inside it, and stands on its lowest corner.
  const [batch]=batches,matrix=new T.Matrix4(),box=new T.Box3();batch.geometry.computeBoundingBox();
  for(const [i,pitch]of pitches.entries()){
    const spot=e.campPresentation.tentPitches.find(p=>p.id===pitch.id);
    batch.getMatrixAt(i,matrix);box.copy(batch.geometry.boundingBox).applyMatrix4(matrix);
    const centre=box.getCenter(new T.Vector3());
    assert.ok(Math.abs(centre.x-pitch.x)<.06&&Math.abs(centre.z-pitch.z)<.06,`${pitch.id} centred`);
    assert.ok(box.min.x>=spot.x-spot.width/2-.05&&box.max.x<=spot.x+spot.width/2+.05&&box.min.z>=spot.z-spot.depth/2-.05&&box.max.z<=spot.z+spot.depth/2+.05,`${pitch.id} within its pitch`);
    const lowest=Math.min(...[[box.min.x,box.min.z],[box.min.x,box.max.z],[box.max.x,box.min.z],[box.max.x,box.max.z]].map(([x,z])=>slope(x,z)));
    assert.ok(box.min.y<=lowest+.05&&box.min.y>=lowest-.4,`${pitch.id} grounded`);
  }
  models.dispose();assert.equal(fallback.visible,true);cache.clear();
  // Performance draws the code-built tents only.
  assert.deepEqual(createSceneryModels(new T.Scene(),e,{chapter:1,quality:'performance',cache:createSceneryModelCache({load:async()=>new T.Group()})}).placements,[]);
});

test('the leather tent downloads with every chapter whose tent lines pitch it',()=>{
  const file=WORLD_CATALOG[TENT_MODEL].files[0];
  for(let chapter=1;chapter<=12;chapter++){
    const pitched=(CAMP_TENT_PITCHES[chapter]??[]).length>0;
    if(pitched)assert.ok(chapterWorldFiles(chapter).includes(file),`Chapter ${chapter}`);
    if(pitched){const world=Game.createCampWorld(base(chapter));assert.ok(sceneryPlacements(stageOf(world),{chapter}).some(p=>p.key==='tent-lines'),`Chapter ${chapter} draws its tents`);}
  }
  assert.deepEqual(WORLD_CATALOG[TENT_MODEL].chapters,[1,2,3,4,5,6,7,8,9,12]);
});

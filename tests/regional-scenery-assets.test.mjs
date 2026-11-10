import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/three/addons/libs/meshopt_decoder.module.js';
import * as G from '../src/core/game.js';
import {createSceneryModels,sceneryPlacements} from '../src/showcase/scenery-models.js';
import {createSceneryModelCache} from '../src/showcase/scenery-cache.js';
import {REGIONAL_PROP_CHAPTERS,regionalServicePads,regionalTentPitches,TENT_VARIANTS} from '../src/showcase/environment-regional-world.js';
import {CAMP_PROP_CHAPTERS,CAMP_WALL_CHAPTERS,FINALE_STANDARD_MODELS,LIFE_PROP_CHAPTERS} from '../src/ui/world-catalog.js';
import {finaleLayout,finaleStandardSpot} from '../src/showcase/environment-finale.js';
import {campWallSections,campTowerSpots,campGateways} from '../src/showcase/camp-walls.js';
import {terrainAt} from '../src/showcase/environment-layout.js';
const root=new URL('../',import.meta.url);
const campaign=JSON.parse(await readFile(new URL('tests/fixtures/campaign-3d.json',root),'utf8'));
const graphics=JSON.parse(await readFile(new URL('tests/fixtures/graphics-scenes.json',root),'utf8'));
async function load(url){
  const bytes=await readFile(new URL(url,root)),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}

test('All shipped regional models load completely and keep their true geometry off playable ground or inside their reserved service footprint',async()=>{
  const cache=createSceneryModelCache({load}),used=new Set();
  const scenes=campaign.scenes.filter(s=>s.chapter!==5).flatMap(s=>[s.state.encounter,{...s.state.encounter,width:24,height:24}]);
  for(let chapter=1;chapter<=12;chapter++)if(chapter!==5){
    const checkpoint=graphics.scenes.find(s=>s.id===`camp-${chapter}`),world=G.createCampWorld(G.deserialize(JSON.stringify(checkpoint.state)));scenes.push({...world.map,campPresentation:world.campPresentation});
  }
  // The web's placements and the desktop app's, which carries every chapter's models (world-catalog.js).
  for(const desktop of [false,true])for(const e of scenes){
    const chapter=Number(/^ch(\d+)-/.exec(e.id)[1]),before=JSON.stringify(e),scene=new T.Scene(),models=createSceneryModels(scene,e,{chapter,cache,desktop}),pads=regionalServicePads(e),hx=e.width*1.25,hz=e.height*1.25;
    assert.equal((await models.ready).length,models.placements.length,`${e.id} loads every named component and prop`);
    for(const p of models.placements){
      used.add(p.id);const model=models.group.getObjectByName(p.key??p.id);assert.ok(model,p.key??p.id);
      if(LIFE_PROP_CHAPTERS[p.id]||CAMP_PROP_CHAPTERS[p.id])assert.ok(!p.pad,`${e.id}/${p.id}: life and the camps' furniture stand beyond the board, off the service pads`);
      const b=new T.Box3().setFromObject(model,true);assert.ok(!b.isEmpty(),p.id+' contains visible geometry');
      if(p.pad){
        const pad=pads.find(pad=>pad.id===p.padId);assert.ok(pad);
        assert.ok(b.min.x>=pad.x-1.401&&b.max.x<=pad.x+2.201&&b.min.z>=pad.z-2.201&&b.max.z<=pad.z+2.201,`${e.id}/${p.id} leaves the left strip clear for visible outcomes`);
      }else if(p.instances&&CAMP_WALL_CHAPTERS[p.id]){
        // A camp's wall and towers stand on its wall cells, solid for the rules already; its gates over its gateways,
        // whose cells stay open for the rules, the passage clear beneath them (graphics-g3.test.mjs).
        const gate=p.key==='camp-gates',spots=gate?campGateways(e):p.key==='camp-towers'?campTowerSpots(e):campWallSections(e);
        assert.equal(p.instances.length,spots.length);
        for(const item of p.instances){
          const x=Math.floor(item.x/2.5+e.width/2),y=Math.floor(item.z/2.5+e.height/2);
          if(gate)assert.ok(campGateways(e).some(g=>g.cells.some(c=>c.x===x&&c.y===y)),`${e.id}/${p.key} spans its gateway`);
          else assert.equal(terrainAt(e,x,y),'wall',`${e.id}/${p.key} stands on the wall`);
        }
      }else if(p.instances&&Object.values(FINALE_STANDARD_MODELS).includes(p.id)){
        // The finale's vexilla (G2) stand at their side's blocks' vexillum spots, beyond the board's east and west edges.
        const side=Object.entries(FINALE_STANDARD_MODELS).find(([,id])=>id===p.id)[0];
        assert.deepEqual(p.instances,finaleLayout(e).blocks.map(finaleStandardSpot).filter(s=>s.side===side).map(({x,z,yaw})=>({x,z,yaw})),`${e.id}/${p.key} at its blocks`);
        assert.ok(b.max.x < -hx||b.min.x > hx,`${e.id}/${p.key} actual silhouette stays outside the full board`);
      }else if(p.instances){
        // The tent lines stand on their pitches, which the camp world blocks for walking (camp-tents.test.mjs), each
        // model on its own.
        const pitches=e.campPresentation?.tentPitches??[];assert.equal(p.instances.length,regionalTentPitches(e,2.5,{desktop}).filter(t=>t.model===p.id).length);
        for(const item of p.instances)assert.ok(pitches.some(t=>Math.abs(t.x-item.x)<1e-9&&Math.abs(t.z-item.z)<1e-9),`${e.id}/${p.key} stands on its pitches`);
      }else if(p.floor){
        // The Curia's floor lies flat under the board, below the board's own floor (0.018 m).
        assert.ok(b.max.y<=.03&&b.min.y>=-.001,`${e.id}/${p.key} is a flat floor (${b.min.y}–${b.max.y} m)`);
      }else assert.ok(b.max.x < -hx||b.min.x > hx||b.max.z < -hz||b.min.z > hz,`${e.id}/${p.key??p.id} actual silhouette stays outside the full board`);
      model.traverse(o=>{if(o.isMesh)assert.equal(o.raycast(),undefined,'decorative models never take movement or target picks');});
    }
    assert.equal(JSON.stringify(e),before);models.dispose();assert.equal(scene.children.length,0);
  }
  for(const id of [...Object.keys(REGIONAL_PROP_CHAPTERS),...Object.keys(LIFE_PROP_CHAPTERS),...Object.keys(CAMP_PROP_CHAPTERS),...Object.keys(CAMP_WALL_CHAPTERS),...TENT_VARIANTS])assert.ok(used.has(id),`${id} has an authored scene`);
  cache.clear();assert.equal(cache.stats().entries,0);
});

test('Performance quality requests no regional model, keeping every architecture and service fallback usable offline',async()=>{
  for(let chapter=1;chapter<=12;chapter++)if(chapter!==5){
    const checkpoint=graphics.scenes.find(s=>s.id===`camp-${chapter}`),world=G.createCampWorld(G.deserialize(JSON.stringify(checkpoint.state))),e={...world.map,campPresentation:world.campPresentation};
    assert.ok(sceneryPlacements(e,{chapter}).length>5);let requests=0;
    const models=createSceneryModels(new T.Scene(),e,{chapter,quality:'performance',load:async()=>{requests++;throw new Error('must not download');}});
    assert.deepEqual(await models.ready,[]);assert.equal(requests,0);models.dispose();
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {canopyRadius,treeClearsApproaches,createArchitecturalGroundSampler} from '../src/showcase/environment-composition.js';
import {regionalTreePlacements,regionalTreeSpecies} from '../src/showcase/world-weather.js';
import {createVegetationFactory} from '../src/showcase/environment-foliage.js';
import {authoredPavingSlabs} from '../src/showcase/environment-campaign-terrain.js';
import {REGIONAL_COMPOSITIONS} from '../src/ui/world-layouts.js';
import {getRegionalKitPlacements} from '../src/showcase/environment-regional-world.js';
import {buildTerrainSplat,splatWeights} from '../src/showcase/terrain-splat.js';
import {groundBiome} from '../src/ui/ground-layers.js';
import {runSteps} from '../src/showcase/build-steps.js';

test('a trunk outside the board cannot put its crown across either default low camera approach',()=>{
  assert.equal(treeClearsApproaches({x:-14,z:16,height:7,kind:'umbrella'},{halfX:10,halfZ:10}),false,'former foreground framing location is rejected');
  assert.equal(treeClearsApproaches({x:14,z:16,height:7,kind:'oak'},{halfX:10,halfZ:10}),false,'live camera approaches from the other side');
  assert.equal(treeClearsApproaches({x:0,z:-24,height:7,kind:'oak'},{halfX:10,halfZ:10}),true,'distant framing remains available');
  for(let chapter=1;chapter<=12;chapter++)for(const [width,height]of [[8,8],[30,24]]){
    const encounter={id:`ch${chapter}-camp`,width,height},before=JSON.stringify(encounter),trees=regionalTreePlacements({encounter,chapter});
    assert.ok(trees.length>=4,'clearance must not empty the regional habitat');
    for(const t of trees)assert.ok(treeClearsApproaches(t,{halfX:width*1.25,halfZ:height*1.25,yaws:[-.55,.32,.62,.82]}),`${chapter}:${t.kind} leaves the full default approach clear`);
    assert.equal(JSON.stringify(encounter),before);
  }
});

test('canopy clearance encloses the actual curved leaf vertices and branches for every regional species',()=>{
  const species=new Set(Array.from({length:12},(_,i)=>regionalTreeSpecies(i+1)).flat()),geometry=[];
  const factory=createVegetationFactory({p:{geo:g=>(geometry.push(g),g)},m:{foliage:{},bark:{}},quality:'high',height:()=>0,
    instance:(name,g,m,position,scale,rotation)=>{
      const matrix=new T.Matrix4().compose(new T.Vector3(...position),new T.Quaternion().setFromEuler(new T.Euler(...rotation)),new T.Vector3(...scale)),v=new T.Vector3();
      for(let i=0;i<g.attributes.position.count;i++){
        v.fromBufferAttribute(g.attributes.position,i).applyMatrix4(matrix);
        assert.ok(Math.hypot(v.x,v.z)<=radius+.001,`${kind}: actual geometry exceeds placement clearance`);
      }
    }});
  let kind,radius;
  for(kind of species){radius=canopyRadius(kind,8);factory.tree(kind,0,0,8,31);}
  for(const g of geometry)g.dispose();
});

test('building contacts follow rotated footprints and entrances, with bounded runoff only in wet regions',()=>{
  const placements=[{component:'storehouse_raised',x:10,z:-15,yaw:0,width:8,depth:4}],before=JSON.stringify(placements);
  const dry=createArchitecturalGroundSampler(placements),wet=createArchitecturalGroundSampler(placements,{wet:true});
  assert.ok(dry(10,-11).wear>dry(10,-19).wear+.2,'entrance traffic wears a threshold, not a generic rectangle');
  assert.ok(dry(14.2,-15).footing>.6,'aggregate meets the building foot');
  assert.equal(dry(14.65,-15).damp,0);assert.ok(wet(14.65,-15).damp>.5,'side drainage retains damp soil in wet regions');
  assert.deepEqual(dry(30,30),{footing:0,wear:0,damp:0});
  const turned=createArchitecturalGroundSampler([{...placements[0],x:0,z:0,yaw:Math.PI/2}]);
  assert.ok(turned(4,0).wear>turned(-4,0).wear+.2,'the threshold turns with the asset front');
  assert.equal(JSON.stringify(placements),before);
});

test('contact dressing changes existing ground weights without adding layers or changing remote ground',()=>{
  const e={width:8,height:8,terrain:Array.from({length:8},()=>Array(8).fill('grass'))},before=JSON.stringify(e),bounds={minX:-24,minZ:-24,maxX:24,maxZ:24};
  const options={e,height:()=>0,biome:groundBiome(1),bounds};
  const plain=runSteps(buildTerrainSplat(options)),dressed=runSteps(buildTerrainSplat({...options,architecture:createArchitecturalGroundSampler([{component:'stone_store',x:14,z:0,width:5,depth:6}])}));
  assert.equal(dressed.data.length,plain.data.length);assert.deepEqual(splatWeights(dressed,-15,0),splatWeights(plain,-15,0));
  assert.ok(splatWeights(dressed,17,0).gravel>splatWeights(plain,17,0).gravel+.1);
  assert.equal(JSON.stringify(e),before);
});

test('paving courses cross internal tile boundaries but never cross a missing floor cell',()=>{
  const e={width:5,height:3,terrain:[['stone','stone','stone','grass','stone'],Array(5).fill('stone'),Array(5).fill('stone')]},before=JSON.stringify(e),slabs=authoredPavingSlabs(e);
  assert.ok(slabs.some(s=>s.z< -1.25&&s.x-s.width/2< -3.75&&s.x+s.width/2> -3.75),'an internal grid edge is crossed by a complete slab');
  for(const s of slabs){
    assert.ok(s.width>0&&s.depth>0&&Math.abs(s.yaw)<.005);
    if(s.z< -1.25)assert.ok(s.x+s.width/2<=1.25||s.x-s.width/2>=3.75,'the unpaved cell remains unpaved');
  }
  assert.ok(slabs.length<15*10,'continuous courses use fewer slabs than resetting small stones at every tile');
  assert.deepEqual(authoredPavingSlabs(e),slabs);assert.equal(JSON.stringify(e),before);
});

test('regional working arrangements differ spatially while reusing the same eight kit slots',()=>{
  const shapes=new Set();
  for(const [chapter,composition]of Object.entries(REGIONAL_COMPOSITIONS)){
    assert.ok(Object.isFrozen(composition.entries));assert.equal(composition.entries.length,10);
    assert.equal(new Set(composition.entries.map(p=>p.slot)).size,8);
    shapes.add(JSON.stringify(composition.entries.map(p=>[p.edge,p.along,p.gap])));
    const e={id:`ch${chapter}-camp`,width:24,height:24,terrain:Array.from({length:24},()=>Array(24).fill('grass'))};
    assert.ok(getRegionalKitPlacements(e).length<=12,'no extra models are introduced');
  }
  assert.equal(shapes.size,11,'spatial variation is more than a different kit or colour');
});

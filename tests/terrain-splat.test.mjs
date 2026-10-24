import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {buildTerrainSplat,splatWeights,splatGrid,SPLAT_MAX_SIDE,SPLAT_CHANNELS} from '../src/showcase/terrain-splat.js';
import {createGroundHeight,gridToWorld,roadSegments} from '../src/showcase/environment-layout.js';
import {createRoadSurfaceSampler} from '../src/showcase/environment-road-surface.js';
import {runSteps} from '../src/showcase/build-steps.js';
import {GROUND_LAYERS,GROUND_BIOMES,GROUND_LAYER_INDEX,groundBiome,groundBiomeKey} from '../src/ui/ground-layers.js';
import {createTerrainUniforms,installTerrainMaterial,setTerrainSplat,refreshTerrainTextures} from '../src/showcase/terrain-material.js';
import {groundTextures,warmGroundTextures,groundTexturesLoaded} from '../src/showcase/ground-textures.js';

const freeze=v=>{if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}return v;};
// Every role its own layer, so a test can tell which role a texel shows.
const TELLING=freeze({turf:[['grass',1]],worn:[['soil',1]],road:[['paving',1]],bank:[['rock',1]],rock:[['rock',1]],wet:[['mud',1]],bed:[['gravel',1]],
  sand:[['sand',1]],rubble:[['aridSoil',1]],camp:[['cracked',1]],joints:[['dryGrass',1]],slabs:[['slabs',1]]});
const KEY={'.':'grass','^':'high','=':'road',s:'sand',m:'marsh','#':'wall',o:'stone',c:'camp',X:'rock',f:'floor'};
const board=rows=>freeze({width:rows[0].length,height:rows.length,terrain:rows.map(row=>[...row].map(t=>KEY[t]))});
const E=board(['........','.^^.....','........','========','...^....','.ss.mm..','.#o.cX..','..f.....']);
function splatOf(e=E,options={}){
  const height=createGroundHeight(e),road=createRoadSurfaceSampler(roadSegments(e),2.5),half=Math.max(e.width,e.height)*2.5/2+20;
  return runSteps(buildTerrainSplat({e,biome:TELLING,height,road,bounds:{minX:-half,minZ:-half,maxX:half,maxZ:half},...options}));
}

test('the splat map: every texel\'s weights sum to 255, the same encounter gives the same bytes, and the encounter is untouched',()=>{
  const before=JSON.stringify(E),a=splatOf(),b=splatOf();
  assert.equal(JSON.stringify(E),before);assert.deepEqual(a.data,b.data);
  assert.equal(a.data.length,a.nx*a.nz*SPLAT_CHANNELS);
  for(let i=0;i<a.nx*a.nz;i++){let sum=0;for(let k=0;k<GROUND_LAYERS.length;k++)sum+=a.data[(Math.floor(k/4)*a.nx*a.nz+i)*4+k%4];assert.equal(sum,255,`texel ${i}`);
    assert.equal(a.data[(2*a.nx*a.nz+i)*4+3],0,'the twelfth channel is unused');}
});

test('each cell shows its own ground, the road its tread, and a bank its bare stone',()=>{
  const splat=splatOf(),centre=(x,y)=>gridToWorld({x,y},E),at=(x,y)=>{const p=centre(x,y);return splatWeights(splat,p.x,p.z);};
  for(const [x,y,layer]of [[1,5,'sand'],[4,5,'mud'],[1,6,'aridSoil'],[2,6,'dryGrass'],[4,6,'cracked'],[5,6,'rock'],[2,7,'slabs'],[6,0,'grass']])
    assert.ok(at(x,y)[layer]>.6,`${layer} at ${x},${y}: ${JSON.stringify(at(x,y))}`);
  for(let x=0;x<8;x++)if(x!==3)assert.ok(at(x,3).paving>.6,`the road's tread at ${x},3`);
  // The plateau beside the road: its top is turf, never road, and its bank is stone.
  const height=createGroundHeight(E),high=centre(3,4);
  assert.ok(at(3,4).paving<.05&&at(3,4).grass>.5,'no road climbs onto the plateau');
  let bank=0;for(let d=1;d<=1.6;d+=.1){const z=high.z+d,slope=Math.abs(height(high.x,z+.25)-height(high.x,z-.25))/.5;if(slope>1)bank=Math.max(bank,splatWeights(splat,high.x,z).rock);}
  assert.ok(bank>.4,`the plateau's steep bank shows stone (${bank})`);
});

test('the splat grid is capped, and wear, the river\'s bank and the fort\'s yard add worn and wet ground',()=>{
  const huge=splatGrid({minX:-500,minZ:-400,maxX:500,maxZ:400});assert.ok(huge.nx<=SPLAT_MAX_SIDE&&huge.nz<=SPLAT_MAX_SIDE);
  const plain=board(['........','........','........','........','........','........','........','........']);
  const dry=splatOf(plain),damp=splatOf(plain,{damp:()=>1}),yard=splatOf(plain,{training:true});
  assert.ok(splatWeights(damp,0,0).mud>.25&&splatWeights(dry,0,0).mud===0);
  assert.ok(splatWeights(yard,0,0).soil>.35,'the yard is worn');
});

test('every region names real layers for every role, and every chapter has a region',()=>{
  const roles=['turf','worn','road','bank','wet','bed','sand','rock','rubble','camp','joints','slabs'];
  for(const [key,biome]of Object.entries(GROUND_BIOMES))for(const role of roles){
    assert.ok(biome[role]?.length,`${key} ${role}`);for(const [layer,share]of biome[role]){assert.ok(layer in GROUND_LAYER_INDEX,`${key} ${role} ${layer}`);assert.ok(share>0);}
    assert.ok(Math.abs(biome[role].reduce((n,[,s])=>n+s,0)-1)<1e-9,`${key} ${role} sums to 1`);
  }
  for(let chapter=1;chapter<=12;chapter++)assert.equal(groundBiome(chapter),GROUND_BIOMES[groundBiomeKey(chapter)]);
  assert.equal(groundBiomeKey(7),'italy');assert.equal(groundBiome(9).road[0][0],'paving');assert.equal(groundBiomeKey(5),'arid');
});

test('the terrain material: one program per quality, the stand-in layers at once, and later arrays without a recompile',async()=>{
  const compile=material=>{const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);return shader;};
  const uniforms=createTerrainUniforms(GROUND_BIOMES.danube),balanced=installTerrainMaterial(new T.MeshStandardMaterial({vertexColors:true}),uniforms);
  const performance=installTerrainMaterial(new T.MeshStandardMaterial({vertexColors:true}),uniforms,{normals:false});
  assert.notEqual(balanced.customProgramCacheKey(),performance.customProgramCacheKey());
  const shader=compile(balanced);
  assert.ok(shader.fragmentShader.includes('textureGrad(groundAlbedoMap'));assert.ok(shader.fragmentShader.includes('roughnessFactor*=groundRough;'));
  assert.ok(shader.vertexShader.includes('vGroundSoil=soilMix;'));assert.equal(shader.uniforms.groundOutside.value[GROUND_LAYER_INDEX.grass],.72);
  assert.equal(balanced.map,null);assert.equal(balanced.normalMap,null);
  assert.equal(shader.uniforms.groundAlbedoMap.value,groundTextures().albedo);assert.equal(groundTextures().source,'stand-in');
  // A splat map sets its bounds; replacing it frees the previous texture.
  const previous=uniforms.groundSplatMap.value;let freed=false;previous.addEventListener('dispose',()=>freed=true);
  setTerrainSplat(uniforms,{data:new Uint8Array(4*4*12),nx:4,nz:4,minX:-2,minZ:-2,maxX:2,maxZ:2});
  assert.equal(freed,true);assert.deepEqual(uniforms.groundSplatBounds.value.toArray(),[-2,-2,.25,.25]);
  // A failed download leaves the stand-in and is tried again; arrays of every layer replace it.
  assert.equal(await warmGroundTextures({load:()=>Promise.reject(new Error('offline'))}),false);assert.equal(groundTexturesLoaded(),false);
  const array=()=>{const t=new T.DataArrayTexture(new Uint8Array(4*4*4*GROUND_LAYERS.length),4,4,GROUND_LAYERS.length);return Promise.resolve(t);};
  const short=()=>Promise.resolve(new T.DataArrayTexture(new Uint8Array(4*4*4*2),4,4,2));
  assert.equal(await warmGroundTextures({load:short}),false,'arrays without every layer are refused');
  const key=balanced.customProgramCacheKey();
  assert.equal(await warmGroundTextures({load:array}),true);assert.equal(groundTexturesLoaded(),true);
  assert.equal(refreshTerrainTextures(uniforms),'ktx2');assert.equal(uniforms.groundAlbedoMap.value,groundTextures().albedo);
  assert.equal(balanced.customProgramCacheKey(),key,'the same program draws the photographed layers');
});

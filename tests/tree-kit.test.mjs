import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import {TREE_KIT_CHAPTERS,TREE_KIT_LEVELS,createTreeKitPlanter,sceneTreeKitUrl,treeKitFor,treeKitTransform,treeKitUrl} from '../src/showcase/tree-kit.js';
import {TREE_KIT_COMPONENTS} from '../src/showcase/tree-kit-components.js';
import {canopyRadius} from '../src/showcase/environment-composition.js';
import {regionalTreeSpecies} from '../src/showcase/world-weather.js';
import {createEnvironment} from '../src/showcase/environment.js';
import {createEnvironmentMaterials} from '../src/showcase/environment-materials.js';
import {WORLD_CATALOG,chapterWorldFiles} from '../src/ui/world-catalog.js';

// The regional tree kits (worlds and gameplay plan, release 5): which kit each chapter
// plants, the room each tree is given, its levels of detail, and the one shader program
// the kit shares with the code-built leaf sprays. Presentation only.

// A stand-in kit: each species' three levels as one small mesh, in a material with a map.
function standInKit(kit){
  const master=new T.Group(),map=new T.DataTexture(new Uint8Array([90,120,60,255]),1,1);map.needsUpdate=true;
  const material=new T.MeshStandardMaterial({map});
  for(const kind of Object.keys(TREE_KIT_COMPONENTS[kit]))for(const suffix of ['','_mid','_far']){
    const root=new T.Group();root.name=kind+suffix;const mesh=new T.Mesh(new T.BoxGeometry(.2,.5,.2).translate(0,.25,0),material);mesh.name=`${kind}${suffix}_tree`;root.add(mesh);master.add(root);
  }
  return master;
}
const field=(id,width=16,height=12)=>({id,kind:'battle',width,height,terrain:Array.from({length:height},()=>Array(width).fill('grass'))});

test('every chapter plants only species its region\'s kit holds, and each kit is in its chapters\' packs alone', () => {
  for(let chapter=1;chapter<=12;chapter++){
    const kit=treeKitFor(chapter);assert.ok(kit,`chapter ${chapter} has a tree kit`);
    for(const kind of regionalTreeSpecies(chapter))assert.ok(TREE_KIT_COMPONENTS[kit][kind],`${kind} (chapter ${chapter}) is in the ${kit} kit`);
    assert.ok(chapterWorldFiles(chapter).includes(treeKitUrl(chapter)),`chapter ${chapter}'s pack holds its kit`);
  }
  for(const [kit,chapters]of Object.entries(TREE_KIT_CHAPTERS))assert.deepEqual([...WORLD_CATALOG[`trees-${kit}`].chapters],[...chapters]);
  assert.equal(sceneTreeKitUrl({id:'ch7-council',kind:'contest'},7),null,'no kit indoors');
  assert.equal(sceneTreeKitUrl({id:'ch7-camp'},7),treeKitUrl(7));
});

test('a kit tree stays inside the clearance its plan kept, at every height the plans use', () => {
  for(const [kit,species]of Object.entries(TREE_KIT_COMPONENTS))for(const kind of Object.keys(species))for(let h=3.8;h<=8.71;h+=.1){
    const t=treeKitTransform(kit,kind,{x:0,y:0,z:0,height:h,seed:3});
    assert.ok(t.crown<=canopyRadius(kind,h)+1e-9,`${kit} ${kind} at ${h.toFixed(1)} m: crown ${t.crown.toFixed(2)} within ${canopyRadius(kind,h).toFixed(2)}`);
    assert.equal(t.scale[1],h/.5,'its height is the plan\'s');
  }
});

test('each kit model holds every species at three levels, as its components record', () => {
  for(const kit of Object.keys(TREE_KIT_CHAPTERS)){
    const bytes=readFileSync(new URL(`../${treeKitUrl(TREE_KIT_CHAPTERS[kit][0])}`,import.meta.url)),length=bytes.readUInt32LE(12);
    const gltf=JSON.parse(bytes.subarray(20,20+length).toString('utf8')),names=new Set(gltf.nodes.map(n=>n.name));
    for(const kind of Object.keys(TREE_KIT_COMPONENTS[kit]))for(const suffix of ['','_mid','_far'])assert.ok(names.has(kind+suffix),`${kit}: ${kind+suffix}`);
    assert.equal(gltf.materials.length,1,`${kit}: one material, bark and leaves in one atlas`);
    const report=JSON.parse(readFileSync(new URL(`../art-source/models/processed/trees-${kit}.json`,import.meta.url),'utf8'));
    for(const s of report.species)assert.equal(TREE_KIT_COMPONENTS[kit][s.species].crownRadius,s.crownRadius,`${kit} ${s.species}: components match the build`);
  }
});

test('trees take the level their distance from the camera asks for, one draw a species and level', () => {
  const kit='temperate',planter=createTreeKitPlanter(standInKit(kit),kit,new T.MeshStandardMaterial()),group=new T.Group();
  const spots=[[0,0],[TREE_KIT_LEVELS.near+10,0],[TREE_KIT_LEVELS.mid+20,0]];
  for(const [i,[x,z]]of spots.entries())assert.ok(planter.plant('oak',{x,y:0,z,height:6,seed:i}));
  assert.equal(planter.plant('palm',{x:0,y:0,z:0,height:6}),false,'a species the kit lacks stays code-built');
  planter.build(group);
  const meshes=Object.fromEntries(group.children.map(m=>[m.userData.treeKit.level,m]));
  assert.deepEqual(Object.keys(meshes).sort(),['far','mid','near']);
  assert.equal(meshes.mid.count,3,'built for the bake at the mid level');
  assert.ok(planter.update({x:0,z:0}));
  assert.deepEqual([meshes.near.count,meshes.mid.count,meshes.far.count],[1,1,1]);
  assert.equal(planter.update({x:1,z:0}),false,'a small step re-levels nothing');
  assert.ok(planter.update({x:TREE_KIT_LEVELS.mid*3,z:0}));assert.equal(meshes.far.count,3);
  assert.ok(group.children.every(m=>m.raycast()===undefined&&m.instanceColor),'no picks; every tree tinted');
  planter.dispose();assert.equal(group.children.length,0);
});

test('the kit\'s trees sway in the leaf sprays\' shader program and replace the code-built trees', () => {
  const e=field('ch3-ridge'),scene=new T.Scene(),before=JSON.stringify(e);
  const code=createEnvironment(new T.Scene(),e,{chapter:3,quality:'balanced',loadTextures:false});
  const world=createEnvironment(scene,e,{chapter:3,quality:'balanced',loadTextures:false,treeKit:standInKit('temperate')});
  assert.equal(JSON.stringify(e),before,'the encounter is untouched');
  const planted=world.group.userData.treeKit,trees=[];world.group.traverse(o=>{if(o.isInstancedMesh&&o.userData.treeKit)trees.push(o);});
  assert.equal(planted.trees,code.group.userData.regionalTrees.length,'every planned tree is a kit tree');
  const sprays=[];code.group.traverse(o=>{if(o.isMesh&&o.material?.name==='cutout leaf sprays')sprays.push(o.material);});
  const leaves=trees[0].material;
  assert.equal(leaves.customProgramCacheKey(),sprays[0].customProgramCacheKey(),'the same program key as the code-built sprays');
  for(const key of ['side','alphaTest','transparent','vertexColors','flatShading'])assert.equal(leaves[key],sprays[0][key],key);
  for(const key of ['map','normalMap','roughnessMap','aoMap'])assert.equal(!!leaves[key],!!sprays[0][key],key);
  assert.ok(leaves.userData.environmentVegetation&&leaves.userData.sceneryCutaway!==false);
  // Performance keeps the code-built trees.
  const low=createEnvironment(new T.Scene(),e,{chapter:3,quality:'performance',loadTextures:false,treeKit:standInKit('temperate')});
  assert.equal(low.group.userData.treeKit,undefined);
  world.update(1,new T.Vector3(0,20,30));assert.ok(world.stats().trees.drawn>=1);
  code.dispose();world.dispose();low.dispose();
});

test('a kit surface is made as the environment\'s own: foliage or stone, nothing else', () => {
  const library=createEnvironmentMaterials({loadTextures:false}),map=new T.DataTexture(new Uint8Array(4),1,1);
  const leaves=library.kitMaterial('foliage',{map}),stone=library.kitMaterial('stone',{map});
  assert.equal(leaves.customProgramCacheKey(),library.materials.foliage.customProgramCacheKey());
  assert.equal(stone.customProgramCacheKey(),library.materials.stone.customProgramCacheKey());
  assert.ok(stone.normalMap,'a neutral normal map where the rock has none');
  assert.throws(()=>library.kitMaterial('water',{map}),/foliage or stone/);
  library.dispose();
});

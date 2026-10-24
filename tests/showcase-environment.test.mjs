import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import {createEnvironment,gridToWorld} from '../src/showcase/environment.js';
import {createGroundHeight,roadSegments,terrainAt,isTrainingGround,HIGH_GROUND_HEIGHT} from '../src/showcase/environment-layout.js';
import {splatWeights} from '../src/showcase/terrain-splat.js';
import {GROUND_LAYERS} from '../src/ui/ground-layers.js';
import {BATTLE_SCENARIOS} from '../src/data/encounters.js';
import * as Game from '../src/core/game.js';

const freeze=v=>{if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}return v;};
const scenario=()=>({width:8,height:8,terrain:BATTLE_SCENARIOS['ch1-road'].map.map(row=>[...row].map(t=>({'.':'grass','X':'rock','^':'high','=':'road'}[t])))});

test('3D environment keeps centered coordinates, authored elevation and road adjacency',()=>{
  const e=freeze(scenario()),height=createGroundHeight(e);
  assert.deepEqual(gridToWorld({x:0,y:0},e),{x:-8.75,y:0,z:-8.75});assert.deepEqual(gridToWorld({x:7,y:7},e),{x:8.75,y:0,z:8.75});
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){const p=gridToWorld({x,y},e),v=height(p.x,p.z);assert.ok(Math.abs(v-(terrainAt(e,x,y)==='high'?HIGH_GROUND_HEIGHT:0))<1e-9);}
  for(const [a,b]of roadSegments(e)){const distance=Math.hypot(a.x-b.x,a.z-b.z);assert.ok(Math.abs(distance-2.5)<1e-9||distance===18);assert.equal(a.x===b.x||a.z===b.z,true);}
});

test('Real Three environment builds finite geometry and a road in its ground without changing encounter input',()=>{
  const e=freeze(scenario()),before=JSON.stringify(e),scene=new THREE.Scene();
  // Three itself allocates UUIDs using Math.random; gameplay-independent layout
  // is checked by coordinates below, rather than forbidding library UUIDs.
  const world=createEnvironment(scene,e,{quality:'performance',loadTextures:false});
  assert.equal(scene.children.length,1);assert.equal(JSON.stringify(e),before);
  let count=0,disposed=0;const unique=new Set();
  world.group.traverse(o=>{if(!o.geometry)return;count++;unique.add(o.geometry);for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));if(o.isInstancedMesh)for(const n of o.instanceMatrix.array)assert.ok(Number.isFinite(n));});
  assert.ok(count>0&&count<60,'Static batching keeps the complete environment below sixty draw objects');assert.ok(world.stats().batching.savedDrawObjects>50);
  // The road is drawn in the ground itself: Chapter I's tread is gravel and soil, with no overlay mesh.
  assert.equal(world.group.getObjectByName('authored boundary road'),undefined);
  const roads=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(terrainAt(e,x,y)==='road'&&['grass','road'].includes(terrainAt(e,x,y-1)??'grass'))roads.push(gridToWorld({x,y},e));
  assert.ok(roads.length>0);for(const p of roads){const w=splatWeights(world.terrain.splat,p.x,p.z);assert.ok(w.gravel+w.soil>.85,`road at ${p.x},${p.z}`);}
  world.group.traverse(o=>{if(o.isMesh&&o.material.vertexColors)assert.ok(o.geometry.attributes.color,`${o.name} requires vertex colours when the material enables them`);});
  for(const name of ['limestone','oak leaves','meadow grass']){const batch=world.group.getObjectByName(name);assert.equal(batch.material.vertexColors,false);assert.ok(batch.instanceColor);}
  for(const geometry of unique)geometry.addEventListener('dispose',()=>disposed++);
  for(const t of [0,.016,4,Number.NaN,12])world.update(t);assert.equal(JSON.stringify(e),before);
  world.dispose();world.dispose();assert.equal(scene.children.length,0);assert.equal(disposed,unique.size);assert.equal(world.stats().disposed,true);
});

test('Quality changes only optional presentation density and all batches stay bounded',()=>{
  const e=freeze(scenario()),scenes=[new THREE.Scene(),new THREE.Scene()];
  const low=createEnvironment(scenes[0],e,{quality:'performance',loadTextures:false}),balanced=createEnvironment(scenes[1],e,{quality:'balanced',loadTextures:false});
  assert.ok(balanced.stats().instances>low.stats().instances);assert.ok(balanced.stats().instances<16000);for(const [x,z]of [[0,0],[5,5],[-4,7],[12,-13]])assert.equal(low.groundHeight(x,z),balanced.groundHeight(x,z));
  low.dispose();balanced.dispose();
});

test('A legally opened drill gets a quiet training yard without props or duplicate trainers in playable spaces',()=>{
  const state=Game.newGame('Yard check',275);assert.equal(Game.choose(state,'report').ok,true);assert.equal(Game.startEncounter(state,{}).ok,true);
  const before=Game.serialize(state),e=freeze(state.encounter),scene=new THREE.Scene(),world=createEnvironment(scene,e,{loadTextures:false});
  assert.equal(e.id,'ch1-training');assert.equal(world.stats().mode,'training');assert.equal(world.group.getObjectByName('frontier supply wagon'),undefined);
  let lights=0;world.group.traverse(o=>{if(o.isPointLight)lights++;});assert.equal(lights,0,'Drill has no burning-wagon or campfire lights');
  assert.equal(world.group.userData.trainingProps.length,4);
  for(const bounds of world.group.userData.trainingProps)assert.ok(bounds.max[0]<-10||bounds.min[0]>10||bounds.max[2]<-10||bounds.min[2]>10,`${bounds.name} is fully outside the playable yard`);
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){const p=gridToWorld({x,y},e);assert.ok(Math.abs(world.groundHeight(p.x,p.z)-(terrainAt(e,x,y)==='high'?HIGH_GROUND_HEIGHT:0))<1e-9);}
  const g=world.ground.geometry,soil=g.attributes.soilMix,position=g.attributes.position;assert.equal(soil.count,position.count);
  for(let i=0;i<position.count;i++)if(Math.abs(position.getX(i))<8&&Math.abs(position.getZ(i))<8)assert.ok(soil.getX(i)>.8,'Packed yard covers the interior without replacing terrain');
  world.update(0);world.update(2);assert.equal(Game.serialize(state),before);world.dispose();assert.equal(scene.children.length,0);
  for(const shape of [{id:'ch1-training'},{id:'ch1-drill'},{type:'training'},{mode:'training'},{mission:{mode:'training'}}])assert.equal(isTrainingGround(shape),true);
  assert.equal(isTrainingGround({id:'ch1-road',type:'battle'}),false);
});

test('Mixed soil shader has complete bounded inputs and all three quality levels stay within a geometric budget',()=>{
  for(const quality of ['performance','balanced','high']){
    const world=createEnvironment(new THREE.Scene(),freeze(scenario()),{quality,loadTextures:false}),g=world.ground.geometry;
    assert.equal(g.attributes.soilMix.count,g.attributes.position.count);for(const n of g.attributes.soilMix.array)assert.ok(n>=0&&n<=1);
    const material=world.ground.material,shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);
    for(const name of ['groundAlbedoMap','groundNormalMap','groundSplatMap'])assert.equal(shader.uniforms[name],material.userData.terrain.uniforms[name],name);
    assert.equal(shader.uniforms.groundAlbedoMap.value.isDataArrayTexture,true,'The stand-in layers are there before any download');assert.equal(shader.uniforms.groundAlbedoMap.value.image.depth,GROUND_LAYERS.length);
    assert.equal('GROUND_NORMALS' in material.defines,quality!=='performance','Performance draws the layers without normal maps');
    let triangles=0;world.group.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);});
    assert.ok(triangles<650000,`${quality} environment stays below 650k submitted surface triangles`);assert.ok(world.stats().meshes<150);assert.ok(world.stats().instances<20000);
    world.dispose();
  }
});

test('Standard animation pins the hanging edge, is reversible by time and is disabled at Performance quality',()=>{
  for(const quality of ['balanced','performance']){
    const e=freeze(scenario()),before=JSON.stringify(e),world=createEnvironment(new THREE.Scene(),e,{quality,loadTextures:false}),flag=world.group.getObjectByName('hanging standard'),a=flag.geometry.attributes.position,original=Float32Array.from(a.array);
    world.update(.7);const atFirst=Float32Array.from(a.array);world.update(2.1);const atSecond=Float32Array.from(a.array);world.update(.7);assert.deepEqual(a.array,atFirst);
    if(quality==='performance')assert.deepEqual(a.array,original);else{assert.notDeepEqual(atFirst,atSecond);for(let i=0;i<a.count;i++)if(original[i*3+1]>.899)assert.ok(Math.abs(a.getZ(i)-original[i*3+2])<1e-7);}
    assert.equal(JSON.stringify(e),before);world.dispose();
  }
});

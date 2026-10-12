import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import {createEnvironment,gridToWorld} from '../src/showcase/environment.js';
import {createGroundHeight,roadSegments,terrainAt} from '../src/showcase/environment-layout.js';
import {BATTLE_SCENARIOS} from '../src/data/encounters.js';

const freeze=v=>{if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}return v;};
const scenario=()=>({width:8,height:8,terrain:BATTLE_SCENARIOS['ch1-road'].map.map(row=>[...row].map(t=>({'.':'grass','X':'rock','^':'high','=':'road'}[t])))});

test('3D environment keeps centered coordinates, authored elevation and road adjacency',()=>{
  const e=freeze(scenario()),height=createGroundHeight(e);
  assert.deepEqual(gridToWorld({x:0,y:0},e),{x:-8.75,y:0,z:-8.75});assert.deepEqual(gridToWorld({x:7,y:7},e),{x:8.75,y:0,z:8.75});
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){const p=gridToWorld({x,y},e),v=height(p.x,p.z);assert.ok(Math.abs(v-(terrainAt(e,x,y)==='high'?.45:0))<1e-9);}
  for(const [a,b]of roadSegments(e)){const distance=Math.hypot(a.x-b.x,a.z-b.z);assert.ok(Math.abs(distance-2.5)<1e-9||distance===18);assert.equal(a.x===b.x||a.z===b.z,true);}
});

test('Real Three environment builds finite geometry and upward roads without changing encounter input',()=>{
  const e=freeze(scenario()),before=JSON.stringify(e),scene=new THREE.Scene();
  // Three itself allocates UUIDs using Math.random; gameplay-independent layout
  // is checked by coordinates below, rather than forbidding library UUIDs.
  const world=createEnvironment(scene,e,{quality:'performance',loadTextures:false});
  assert.equal(scene.children.length,1);assert.equal(JSON.stringify(e),before);
  let count=0,disposed=0;const unique=new Set();
  world.group.traverse(o=>{if(!o.geometry)return;count++;unique.add(o.geometry);for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));if(o.isInstancedMesh)for(const n of o.instanceMatrix.array)assert.ok(Number.isFinite(n));});
  assert.ok(count>60&&count<400);const road=world.group.getObjectByName('authored boundary road');assert.ok(road.geometry.attributes.normal.count>0);
  // The feathered verge spans authored rises, so its normals need not be flat.
  // Every triangle still faces upward instead of culling the road from above.
  for(let i=0;i<road.geometry.attributes.normal.count;i++)assert.ok(road.geometry.attributes.normal.getY(i)>.85);
  const roadColor=road.geometry.attributes.color;assert.equal(roadColor.itemSize,4);assert.ok([...roadColor.array].some((v,i)=>i%4===3&&v===0));assert.ok([...roadColor.array].some((v,i)=>i%4===3&&v>.2&&v<.8));assert.equal(road.material.transparent,true);
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

import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {CUTAWAY_UNIFORMS,createSceneryOcclusion,sceneryCutawayWeight} from '../src/showcase/environment-occlusion.js';

test('Cutaway covers the camera-to-figure corridor, never scenery beside or behind the figure',()=>{
  const camera={x:0,y:2,z:10},target={x:0,y:2,z:0};
  assert.equal(sceneryCutawayWeight({x:0,y:2,z:5},camera,target),1);
  assert.equal(sceneryCutawayWeight({x:4,y:2,z:5},camera,target),0);
  assert.equal(sceneryCutawayWeight({x:0,y:2,z:-2},camera,target),0);
  assert.equal(sceneryCutawayWeight({x:0,y:2,z:11},camera,target),0);
  assert.equal(sceneryCutawayWeight(target,camera,target),0);
  const edge=sceneryCutawayWeight({x:.65,y:2,z:5},camera,target);assert.ok(edge>0&&edge<1);
  assert.equal(sceneryCutawayWeight({x:NaN,y:2,z:0},camera,target),0);
  assert.equal(sceneryCutawayWeight(target,target,target),0);
});

test('The cutaway is compiled into scenery materials from the start and switched by uniforms only',()=>{
  const root=new T.Group(),geometry=new T.BoxGeometry(),texture=new T.Texture(),material=new T.MeshStandardMaterial({map:texture,alphaTest:.42,side:T.DoubleSide});
  material.userData.environmentVegetation=true;material.onBeforeCompile=shader=>{shader.uniforms.wind={value:2};shader.vertexShader+='\n// original wind';};material.customProgramCacheKey=()=> 'wind-original';
  const wall=new T.Mesh(geometry,material),leaves=new T.InstancedMesh(geometry,material,2);root.add(wall,leaves);
  const groundMaterial=new T.MeshStandardMaterial(),ground=new T.Mesh(geometry,groundMaterial),bank=new T.Mesh(geometry,groundMaterial);ground.userData.environmentGround=true;root.add(ground,bank);
  const waterMaterial=new T.MeshStandardMaterial({transparent:true}),water=new T.Mesh(geometry,waterMaterial);root.add(water);
  let disposals=0;material.addEventListener('dispose',()=>disposals++);
  const helper=createSceneryOcclusion(root),camera=new T.PerspectiveCamera();camera.position.set(0,2,10);
  assert.equal(wall.material,material,'no material is swapped');assert.equal(leaves.material,material);
  assert.equal(material.userData.sceneryCutaway,true);assert.equal(groundMaterial.userData.sceneryCutaway,undefined,'a material the ground also uses is left as it is');assert.equal(waterMaterial.userData.sceneryCutaway,undefined);
  assert.match(material.customProgramCacheKey(),/^wind-original:scenery-cutaway/);
  const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <alphatest_fragment>'};material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.wind.value,2);assert.match(shader.vertexShader,/instanceMatrix\*cutawayPosition/);assert.match(shader.vertexShader,/original wind/);
  assert.match(shader.fragmentShader,/if\(cutawayAmount>0\.0\)\{[\s\S]*discard/,'the cut costs nothing while it is off');
  assert.equal(shader.uniforms.cutawayAmount,CUTAWAY_UNIFORMS.cutawayAmount,'every patched program reads the same uniforms');
  assert.deepEqual(helper.stats(),{active:false,targets:0,materials:1,meshes:2,amount:0,disposed:false});
  helper.update(camera,{targets:[{position:{x:0,y:1.2,z:0},radius:1.4}],reducedMotion:true});
  assert.equal(wall.material,material);assert.equal(CUTAWAY_UNIFORMS.cutawayAmount.value,1);assert.deepEqual(CUTAWAY_UNIFORMS.cutawayTargets.value[0].toArray(),[0,1.2,0,1.4]);assert.equal(helper.stats().active,true);
  helper.reset();assert.equal(CUTAWAY_UNIFORMS.cutawayAmount.value,0);assert.equal(helper.stats().active,false);
  helper.update(camera,{targets:[{position:{x:0,y:1,z:0}}],delta:.05});assert.ok(CUTAWAY_UNIFORMS.cutawayAmount.value>0&&CUTAWAY_UNIFORMS.cutawayAmount.value<1,'the cut eases in');
  helper.update(camera,{enabled:false});assert.equal(CUTAWAY_UNIFORMS.cutawayAmount.value,0);
  helper.update(camera,{targets:[{position:{x:NaN,y:0,z:0}}]});assert.equal(helper.stats().active,false);
  // A second helper over the same scenery (after models arrive) never patches twice.
  const again=createSceneryOcclusion(root),twice={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <alphatest_fragment>'};material.onBeforeCompile(twice);
  assert.equal(twice.fragmentShader.match(/cutawayAmount>0\.0/g).length,1);assert.equal(again.stats().materials,1);again.dispose();
  helper.dispose();helper.dispose();helper.update(camera,{targets:[{position:{x:0,y:1,z:0}}]});assert.equal(CUTAWAY_UNIFORMS.cutawayAmount.value,0);
  assert.equal(disposals,0,'the scenery owns its materials');
  geometry.dispose();material.dispose();groundMaterial.dispose();waterMaterial.dispose();texture.dispose();
});

test('Models that arrive later join the cutaway before they are drawn; mixed meshes keep their water',()=>{
  const group=new T.Group(),a=new T.MeshStandardMaterial(),b=new T.MeshStandardMaterial({transparent:true}),g=new T.BoxGeometry(),mesh=new T.Mesh(g,[a,b]);group.add(mesh);
  const helper=createSceneryOcclusion(group),camera=new T.PerspectiveCamera();camera.position.z=10;
  assert.equal(a.userData.sceneryCutaway,true);assert.equal(b.userData.sceneryCutaway,undefined);
  const late=new T.Group(),c=new T.MeshStandardMaterial();late.add(new T.Mesh(g,c));
  assert.equal(helper.add(late),1);assert.equal(c.userData.sceneryCutaway,true);assert.equal(helper.stats().meshes,2);
  helper.update(camera,{targets:Array.from({length:6},()=>({position:{x:0,y:1,z:0},radius:99})),delta:99});
  assert.deepEqual(mesh.material,[a,b]);assert.equal(helper.stats().targets,2);assert.ok(helper.stats().amount<=1);
  helper.dispose();assert.equal(helper.add(new T.Group()),0);a.dispose();b.dispose();c.dispose();g.dispose();
});

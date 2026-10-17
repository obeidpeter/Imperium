import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {createSceneryOcclusion,sceneryCutawayWeight} from '../src/showcase/environment-occlusion.js';

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

test('Camera fading owns cloned materials, preserves foliage shaders, restores originals and disposes exactly once',()=>{
  const root=new T.Group(),geometry=new T.BoxGeometry(),texture=new T.Texture(),material=new T.MeshStandardMaterial({map:texture,alphaTest:.42,side:T.DoubleSide});
  material.userData.environmentVegetation=true;material.onBeforeCompile=shader=>{shader.uniforms.wind={value:2};shader.vertexShader+='\n// original wind';};material.customProgramCacheKey=()=> 'wind-original';
  const wall=new T.Mesh(geometry,material),leaves=new T.InstancedMesh(geometry,material,2),external=new T.Mesh(geometry,material);root.add(wall,leaves);
  const ground=new T.Mesh(geometry,material);ground.userData.environmentGround=true;root.add(ground);
  const waterMaterial=new T.MeshStandardMaterial({transparent:true}),water=new T.Mesh(geometry,waterMaterial);root.add(water);
  let originalDisposals=0,cloneDisposals=0,textureDisposals=0;material.addEventListener('dispose',()=>originalDisposals++);texture.addEventListener('dispose',()=>textureDisposals++);
  const helper=createSceneryOcclusion(root),camera=new T.PerspectiveCamera();camera.position.set(0,2,10);
  helper.update(camera,{targets:[{position:{x:0,y:1.2,z:0},radius:1.4}],reducedMotion:true});
  assert.notEqual(wall.material,material);assert.equal(leaves.material,wall.material,'one private clone per source material, including instances');assert.equal(external.material,material);assert.equal(ground.material,material);assert.equal(water.material,waterMaterial);
  const clone=wall.material;clone.addEventListener('dispose',()=>cloneDisposals++);
  const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <alphatest_fragment>'};clone.onBeforeCompile(shader);
  assert.equal(shader.uniforms.wind.value,2);assert.match(shader.vertexShader,/instanceMatrix\*cutawayPosition/);assert.match(shader.vertexShader,/original wind/);assert.match(shader.fragmentShader,/discard/);assert.equal(shader.uniforms.cutawayAmount.value,1);assert.match(clone.customProgramCacheKey(),/^wind-original:/);
  helper.reset();assert.equal(wall.material,material);assert.equal(leaves.material,material);assert.equal(helper.stats().active,false);
  const loadedTexture=new T.Texture();material.map=loadedTexture;
  helper.update(camera,{targets:[{position:{x:0,y:1,z:0}}]});assert.equal(wall.material,clone,'view changes reuse bounded clones');assert.equal(clone.map,loadedTexture,'async atlas replacement must reach private shaders instead of retaining a released fallback');
  helper.update(camera,{enabled:false});assert.equal(wall.material,material);
  helper.update(camera,{targets:[{position:{x:NaN,y:0,z:0}}]});assert.equal(helper.stats().active,false);
  helper.dispose();helper.dispose();helper.update(camera,{targets:[{position:{x:0,y:1,z:0}}]});
  assert.equal(wall.material,material);assert.equal(originalDisposals,0);assert.equal(textureDisposals,0);assert.equal(cloneDisposals,1);
  geometry.dispose();material.dispose();waterMaterial.dispose();texture.dispose();loadedTexture.dispose();
});

test('Mixed material meshes retain water and material swaps owned by another system',()=>{
  const group=new T.Group(),a=new T.MeshStandardMaterial(),b=new T.MeshStandardMaterial({transparent:true}),g=new T.BoxGeometry(),mesh=new T.Mesh(g,[a,b]);group.add(mesh);
  const helper=createSceneryOcclusion(group),camera=new T.PerspectiveCamera();camera.position.z=10;
  helper.update(camera,{targets:Array.from({length:6},()=>({position:{x:0,y:1,z:0},radius:99})),delta:99});
  assert.notEqual(mesh.material[0],a);assert.equal(mesh.material[1],b);assert.equal(helper.stats().targets,2);assert.ok(helper.stats().amount<=1);
  const next=[a];mesh.material=next;helper.reset();assert.equal(mesh.material,next,'reset must not undo a newer owner’s material replacement');helper.dispose();a.dispose();b.dispose();g.dispose();
});

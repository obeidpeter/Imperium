import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {staticImportClosure} from '../scripts/module-closure.mjs';
import {compileUnits,drawableShape,sceneTextures} from '../src/showcase/scene-compositor.js';
import {createInkOverlay} from '../src/showcase/ink-overlay.js';
import {rayToUpright} from '../src/showcase/stage.js';

const root=new URL('../',import.meta.url),rootPath=root.pathname;

test('the offline shell carries every module the page loads before it runs, the board readout included',async()=>{
  const closure=await staticImportClosure(rootPath,'src/ui/app.js');
  assert.ok(closure.includes('./src/ui/app.js')&&closure.includes('./src/showcase/stage-readout.js'));
  assert.ok(closure.every(path=>/^\.\/src\//.test(path)),'the shell needs no vendor or asset files');
  assert.ok(!closure.includes('./src/showcase/stage.js'),'the 3D stage arrives with a chapter, through a dynamic import');
  const build=await readFile(new URL('scripts/build.mjs',root),'utf8');
  assert.match(build,/staticImportClosure\(dist,'src\/ui\/app\.js'\)/);
  assert.match(build,/const initial=assets\.filter\(url=>shellModules\.has\(url\)\|\|/);
});

test('one compile unit stands for each material and program shape; instancing is a shape of its own',()=>{
  const scene=new T.Scene(),shared=new T.MeshStandardMaterial(),other=new T.MeshBasicMaterial(),box=new T.BoxGeometry();
  const plain=[new T.Mesh(box,shared),new T.Mesh(box,shared)],instanced=new T.InstancedMesh(box,shared,4),coloured=new T.InstancedMesh(box,shared,4);
  coloured.setColorAt(0,new T.Color('red'));
  const hidden=new T.Group();hidden.visible=false;hidden.add(new T.Mesh(box,other));
  scene.add(...plain,instanced,coloured,hidden);
  assert.equal(instanced.type,'Mesh','an InstancedMesh reports the type "Mesh", so types alone would merge them');
  assert.notEqual(drawableShape(instanced),drawableShape(plain[0]));assert.notEqual(drawableShape(coloured),drawableShape(instanced));
  const units=compileUnits(scene);
  assert.deepEqual(units,[plain[0],instanced,coloured,hidden.children[0]],'hidden drawables compile too (they appear later)');
  assert.ok(drawableShape(plain[0]).split(':')[0].split('').every(c=>c==='0'||c==='1'),'flags are 0 or 1');
});

test('textures are collected from materials, their uniforms and their compiled hooks, never render targets',()=>{
  const map=new T.Texture(),hooked=new T.Texture(),uniform=new T.Texture(),target=new T.WebGLRenderTarget(4,4);
  const standard=new T.MeshStandardMaterial({map}),shader=new T.ShaderMaterial({uniforms:{a:{value:uniform},b:{value:target.texture}}});
  const scene=new T.Scene();scene.add(new T.Mesh(new T.BoxGeometry(),standard),new T.Mesh(new T.BoxGeometry(),shader));
  const properties={get:m=>m===standard?{uniforms:{baked:{value:hooked}}}:{}};
  assert.deepEqual(new Set(sceneTextures(scene,properties)),new Set([map,hooked,uniform]));
  target.dispose();
});

test('a throttled ink overlay uploads its first paint at once and a sweep of later paints at most every 50 ms',()=>{
  const scene=new T.Scene(),encounter={width:4,height:4},canvas={getContext:()=>({clearRect(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fill(){},arc(){},save(){},restore(){},rect(){},clip(){},setLineDash(){},closePath(){},quadraticCurveTo(){},bezierCurveTo(){},createLinearGradient:()=>({addColorStop(){}}),set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set globalAlpha(v){},set lineCap(v){},set lineJoin(v){}}),width:0,height:0};
  const prior=globalThis.OffscreenCanvas;globalThis.OffscreenCanvas=function(){return canvas;};
  try{
    const ink=createInkOverlay(scene,encounter,()=>0,{throttle:true}),texture=ink.mesh.material.map;let uploads=texture.version;
    const uploaded=()=>{const changed=texture.version!==uploads;uploads=texture.version;return changed;};
    assert.equal(ink.paint({targets:[{x:1,y:1}]}),true);assert.equal(uploaded(),true,'the first paint shows at once');
    assert.equal(ink.paint({targets:[{x:2,y:1}]}),true);assert.equal(uploaded(),false,'a paint within 50 ms waits');
    const start=performance.now();
    assert.equal(ink.flush(start+10),false);assert.equal(ink.flush(start+60),true);assert.equal(uploaded(),true,'the newest paint lands on a later frame');
    assert.equal(ink.flush(start+200),false,'nothing pending, nothing uploaded');
    const eager=createInkOverlay(scene,encounter,()=>0);const t=eager.mesh.material.map,before=t.version;
    eager.paint({targets:[{x:1,y:1}]});eager.paint({targets:[{x:2,y:2}]});assert.equal(t.version-before,2,'an unthrottled overlay uploads every paint');
    ink.dispose();eager.dispose();
  }finally{if(prior)globalThis.OffscreenCanvas=prior;else delete globalThis.OffscreenCanvas;}
});

test('the pick prefilter measures the true distance from a ray to a standing figure',()=>{
  const brute=(ray,x,y,z,h)=>{let best=Infinity;for(let i=0;i<=4000;i++){const t=i*.02,p=ray.at(t,new T.Vector3());const s=Math.min(h,Math.max(0,p.y-y));best=Math.min(best,Math.hypot(p.x-x,p.y-(y+s),p.z-z));}return best;};
  const cases=[[new T.Vector3(0,20,20),new T.Vector3(0,-1,-1)],[new T.Vector3(-10,2,0),new T.Vector3(1,0,0)],[new T.Vector3(3,30,-4),new T.Vector3(0,-1,0)],[new T.Vector3(5,1,5),new T.Vector3(1,.2,1)]];
  for(const [origin,direction]of cases){const ray=new T.Ray(origin,direction.normalize());
    for(const [x,y,z]of [[0,0,0],[2,.5,-1],[-3,0,4]]){const d=rayToUpright(ray,x,y,z,2.2);assert.ok(Math.abs(d-brute(ray,x,y,z,2.2))<.03,`${d} vs brute force`);}}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {runSliced,runSteps} from '../src/showcase/build-steps.js';
import {buildEnvironment,createEnvironment} from '../src/showcase/environment.js';
import {stagePreparation} from '../src/showcase/stage-preparation.js';

const fixture=JSON.parse(await readFile(new URL('./fixtures/campaign-3d.json',import.meta.url),'utf8'));

test('a stepped build runs to its result at once or in slices, and stops at a pause once it is no longer wanted',async()=>{
  const log=[];function* steps(){for(let i=0;i<5;i++){log.push(i);yield;}return 'built';}
  assert.equal(runSteps(steps()),'built');assert.deepEqual(log,[0,1,2,3,4]);
  let pauses=0;log.length=0;
  assert.equal(await runSliced(steps(),{budget:0,pause:async()=>{pauses++;}}),'built');assert.equal(pauses,5,'With no time to spare it pauses at every step');
  pauses=0;assert.equal(await runSliced(steps(),{budget:1e9,pause:async()=>{pauses++;}}),'built');assert.equal(pauses,0,'Within its budget it never pauses');
  let closed=false;function* cancelled(){try{for(let i=0;;i++){log.push(i);yield;}}finally{closed=true;}}
  let wanted=true;log.length=0;
  assert.equal(await runSliced(cancelled(),{budget:0,pause:async()=>{if(log.length===3)wanted=false;},current:()=>wanted}),undefined);
  assert.deepEqual(log,[0,1,2],'Nothing runs after the pause where it stopped being wanted');assert.equal(closed,true,'and the build is closed');
});

// Everything the GPU would draw: every mesh, its geometry and where each instance stands.
function snapshot(world){
  const parts=[];world.group.updateMatrixWorld(true);
  world.group.traverse(o=>{
    if(!o.isMesh&&!o.isPoints&&!o.isLine)return;
    const g=o.geometry,sum=a=>a?Array.from(a.array).reduce((t,v,i)=>t+v*((i%7)+1),0).toFixed(3):'';
    parts.push([o.name,o.type,o.visible,o.matrixWorld.elements.map(v=>v.toFixed(4)).join(),Object.keys(g.attributes).sort().map(k=>`${k}:${sum(g.attributes[k])}`).join(),sum(g.index),
      o.isInstancedMesh?`${o.count}:${sum(o.instanceMatrix)}:${sum(o.instanceColor)}`:''].join('|'));
  });
  return parts;
}

test('the environment built step by step behind the veil is exactly the one built at once',async()=>{
  for(const id of ['ch1-road','ch5-mine','ch12-confrontation']){
    const s=fixture.scenes.find(v=>v.id===id),options={chapter:s.chapter,quality:'balanced',loadTextures:false};
    const atOnce=createEnvironment(new T.Scene(),s.state.encounter,options);let pauses=0;
    const stepped=await runSliced(buildEnvironment(new T.Scene(),s.state.encounter,options),{budget:0,pause:async()=>{pauses++;}});
    assert.ok(pauses>40,`${id}: the world is made in many short steps (${pauses})`);
    assert.deepEqual(snapshot(stepped),snapshot(atOnce),id);
    atOnce.dispose();stepped.dispose();
  }
});

test('geometry goes to the GPU a batch at a time, hidden meshes too, and the scene is left as it was',async()=>{
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(40,1,.1,800),material=new T.MeshStandardMaterial(),hiddenGroup=new T.Group();
  camera.position.set(3,9,12);camera.lookAt(0,0,0);camera.updateMatrixWorld();hiddenGroup.visible=false;scene.add(hiddenGroup);
  const big=new T.Mesh(new T.BoxGeometry(1,1,1,120,120,1),material),shared=new T.BoxGeometry(),twins=[new T.Mesh(shared,material),new T.Mesh(shared,material)];
  const hidden=new T.Mesh(new T.SphereGeometry(1,24,16),material),instanced=new T.InstancedMesh(new T.ConeGeometry(),material,40);instanced.count=0;
  scene.add(big,...twins,instanced);hiddenGroup.add(hidden);
  const meshes=[big,...twins,hidden,instanced],drawn=new Map(),probes=[];
  const stage={scene,camera,renderer:{shadowMap:{needsUpdate:true}},drawOnce:stagePreparation.drawOnce,
    compositor:{probe(target){
      // What three would draw in this probe: what is visible all the way up and not culled (the view is turned away).
      const now=meshes.filter(m=>{for(let p=m;p;p=p.parent)if(!p.visible)return false;return !m.frustumCulled;});
      probes.push({count:now.length,override:target.overrideMaterial,shadows:stage.renderer.shadowMap.needsUpdate,autoUpdate:target.matrixWorldAutoUpdate,
        lookingAway:camera.getWorldDirection(new T.Vector3()).y>.99});
      for(const m of now)drawn.set(m,(drawn.get(m)??0)+1);
    }}};
  const before={camera:camera.matrixWorld.clone(),culled:meshes.map(m=>m.frustumCulled)};
  const bytes=await stagePreparation.uploadGeometry.call(stage);
  assert.ok(probes.length>=2,'More than one batch');
  for(const m of [big,twins[0],hidden,instanced])assert.equal(drawn.get(m),1,`${m.geometry.type} is drawn exactly once`);
  assert.equal(drawn.has(twins[1]),false,'A geometry another mesh already sent is not sent again');
  for(const probe of probes){
    assert.equal(probe.override?.isShaderMaterial,true,'Through the material that clips every vertex');
    assert.equal(probe.shadows,false,'with no shadow pass');assert.equal(probe.autoUpdate,false);assert.equal(probe.lookingAway,true,'and the view turned away');
  }
  const expected=[big.geometry,shared,hidden.geometry,instanced.geometry].reduce((t,g)=>t+Object.values(g.attributes).reduce((a,v)=>a+v.array.byteLength,0)+(g.index?.array.byteLength??0),0)+instanced.instanceMatrix.array.byteLength;
  assert.equal(bytes,expected,'Every buffer is counted once');
  assert.equal(scene.overrideMaterial,null);assert.equal(scene.matrixWorldAutoUpdate,true);assert.equal(stage.renderer.shadowMap.needsUpdate,true);
  assert.equal(hiddenGroup.visible,false,'What was hidden stays hidden');assert.deepEqual(meshes.map(m=>m.frustumCulled),before.culled);
  assert.ok(camera.matrixWorld.equals(before.camera),'The camera is back where it was');
  let calls=0;stage.compositor.probe=()=>{calls++;};
  assert.equal(await stagePreparation.uploadGeometry.call(stage,()=>false),0,'A battle no longer wanted sends nothing');assert.equal(calls,0);
});

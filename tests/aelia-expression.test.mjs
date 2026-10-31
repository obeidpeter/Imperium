import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/three/addons/libs/meshopt_decoder.module.js';
import {actorBodyUrl} from '../src/ui/actor-body-catalog.js';
import {createActorBodyLibrary} from '../src/showcase/actor-bodies.js';
import {createActor,actorKit} from '../src/showcase/actors.js';
import {AELIA_FACE,aeliaFaceGeometry,aeliaFaceMaterial} from '../src/showcase/generated-own-face.js';
import {updateActorExpressionMorphs} from '../src/showcase/actor-expression-mesh.js';

// Full shipped geometry, with placeholders only for textures Node cannot decode.
async function parse(id){
  const bytes=await readFile(new URL(`../${actorBodyUrl(id)}`,import.meta.url)),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
const unit=Object.freeze({id:'aelia',name:'Aelia Dacia',side:'ally',role:'escort',faction:'Civilian'});
const library=createActorBodyLibrary(parse);
const bytes=g=>[...Object.values(g.attributes),...Object.values(g.morphAttributes).flat(),g.index].reduce((sum,a)=>sum+a.array.byteLength,0);

test('Aelia expression geometry preserves the shipped neutral surface, paint and skinning at both detail levels',async()=>{
  assert.ok(await library.warm('cast-aelia'));const body=library.body('cast-aelia');let totalBytes=0;
  for(const level of ['near','overview']){
    const source=body[level].geometry,snapshots=Object.fromEntries(Object.entries(source.attributes).map(([key,a])=>[key,a.array.slice()]));
    const geometry=aeliaFaceGeometry(source),p=geometry.attributes.position;
    assert.notEqual(geometry,source);assert.equal(geometry.userData.headSource,'cast-aelia');assert.equal(geometry.userData.expressionMorphs,'aelia-own-face-v1');
    assert.equal(p.count,source.attributes.position.count,'No added or reshaped neutral vertices');assert.deepEqual(geometry.index.array,source.index.array,'Original triangles remain intact');
    for(const [key,original]of Object.entries(source.attributes)){
      assert.deepEqual(original.array,snapshots[key],`${level} master ${key} is untouched`);
      const copy=geometry.attributes[key];for(let i=0;i<original.count;i++)for(let c=0;c<original.itemSize;c++)assert.equal(copy.getComponent(i,c),original.getComponent(i,c),`${level} original ${key} ${i}:${c}`);
    }
    assert.deepEqual(source.morphAttributes,{},'No expressions are attached to the shared master');
    assert.deepEqual(geometry.morphAttributes.position.map(a=>a.name),['jaw','focus','concern','blink']);assert.equal(geometry.morphTargetsRelative,true);
    for(const morph of geometry.morphAttributes.position){let moved=0;
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),y=p.getY(i),z=p.getZ(i),d=new T.Vector3().fromBufferAttribute(morph,i);
        assert.ok(Number.isFinite(d.length())&&d.length()<.006,'Facial offsets stay bounded in metres');
        if(y<1.525||y>1.662||Math.abs(x-AELIA_FACE.centre)>.071||z<.05)assert.equal(d.length(),0,'Hair, neck, ears and clothing stay still');
        if(d.length()>1e-6)moved++;
      }
      assert.ok(moved>(morph.name==='blink'?4:12),`${level} ${morph.name} moves the actual generated face`);
    }
    const blink=geometry.morphAttributes.position[3];assert.ok(Array.from(blink.array).every(n=>Math.abs(n)<=.00081),'Blink settles lids less than a millimetre instead of flattening her eye sockets');
    const lidUv=geometry.attributes.aeliaLidUv;assert.equal(lidUv.count,p.count);assert.ok(Array.from(lidUv.array).every(v=>Number.isFinite(v)&&v>=0&&v<=1),'Skin sampling stays within the original atlas');
    totalBytes+=bytes(geometry);geometry.dispose();
  }
  assert.ok(totalBytes<2*1024*1024,`Two owned detail levels stay below 2 MiB including all four morphs (${totalBytes} bytes)`);
});

test('Aelia uses her own face for deterministic blinking, speech, concern, LOD changes and reduced motion',async()=>{
  const actor=createActor(unit,{chapter:8,bodyLibrary:library});assert.equal(await actor.ready,true);
  const near=actor.group.getObjectByName('generated-body'),far=actor.group.getObjectByName('generated-body-overview'),master=library.body('cast-aelia');
  assert.equal(actor.group.userData.actor.headSource,'cast-aelia');assert.equal(actor.group.getObjectByName('identity-head-near'),undefined);
  for(const [mesh,level]of [[near,'near'],[far,'overview']]){
    assert.notEqual(mesh.material,master[level].material,'Blink uniforms are actor-owned');
    for(const map of ['map','normalMap','roughnessMap','metalnessMap'])assert.equal(mesh.material[map],master[level].material[map],`The original ${map} stays shared`);
    assert.equal(master[level].material.userData.aeliaBlink,undefined,'No uniforms leak into shared material');
  }
  const blinkTime=4.58-(actorKit(unit,{chapter:8}).identity%13)*.13;
  for(const input of [{motion:'idle',time:blinkTime},{motion:'speak',phase:.4,time:0},{motion:'hurt',phase:.4,time:0}]){
    actor.update({...input,resetPose:true});assert.deepEqual(near.morphTargetInfluences,far.morphTargetInfluences,'Both LODs receive the same expression');
    assert.equal(near.material.userData.aeliaBlink.value,near.morphTargetInfluences[3]);assert.equal(far.material.userData.aeliaBlink.value,near.morphTargetInfluences[3]);
    assert.ok(near.morphTargetInfluences.some(v=>v>0));
    if(input.motion==='idle')assert.ok(near.morphTargetInfluences[3]>.999);
    if(input.motion==='speak')assert.ok(near.morphTargetInfluences[0]>.9);
    if(input.motion==='hurt')assert.equal(near.morphTargetInfluences[2],.65);
  }
  actor.update({motion:'idle',time:blinkTime,detailDistance:40,resetPose:true});assert.ok(!near.visible&&far.visible);assert.ok(far.morphTargetInfluences[3]>.999);
  actor.update({motion:'speak',time:blinkTime,phase:.4,reducedMotion:true,resetPose:true});assert.deepEqual(near.morphTargetInfluences,[0,0,0,0]);assert.deepEqual(far.morphTargetInfluences,[0,0,0,0]);
  assert.equal(near.material.userData.aeliaBlink.value,0);assert.equal(far.material.userData.aeliaBlink.value,0);
  actor.update({motion:'idle',time:0,detailDistance:2,resetPose:true});assert.ok(near.visible&&!far.visible);assert.deepEqual(near.morphTargetInfluences,[0,0,0,0]);actor.dispose();
});

test('each Aelia owns and releases only her facial geometry; another figure and the cached master survive',async()=>{
  const first=createActor(unit,{chapter:8,bodyLibrary:library}),second=createActor(unit,{chapter:9,bodyLibrary:library});await Promise.all([first.ready,second.ready]);
  const master=library.body('cast-aelia');let released=0,sharedReleased=0;
  for(const [level,name]of [['near','generated-body'],['overview','generated-body-overview']]){
    const a=first.group.getObjectByName(name),b=second.group.getObjectByName(name);assert.notEqual(a.geometry,b.geometry);assert.notEqual(a.geometry,master[level].geometry);
    assert.notEqual(a.material,b.material);assert.notEqual(a.material.userData.aeliaBlink,b.material.userData.aeliaBlink);
    for(const resource of [a.geometry,a.material])resource.addEventListener('dispose',()=>released++);
    for(const resource of [b.geometry,b.material,master[level].geometry,master[level].material,master[level].material.map])resource?.addEventListener('dispose',()=>sharedReleased++);
  }
  first.dispose();first.dispose();assert.equal(released,4);assert.equal(sharedReleased,0);
  second.update({motion:'speak',phase:.4,time:0});assert.ok(second.group.getObjectByName('generated-body').morphTargetInfluences[0]>.9);second.dispose();assert.equal(sharedReleased,4);
  const unavailable=createActorBodyLibrary(async()=>{throw Error('offline');}),fallback=createActor(unit,{chapter:8,bodyLibrary:unavailable});assert.equal(await fallback.ready,false);assert.equal(fallback.group.getObjectByName('generated-body'),undefined);fallback.dispose();
});

test('the shared driver recognizes named blink targets and clears all expressions for reduced motion',()=>{
  const geometry=new T.BufferGeometry();geometry.userData.expressionMorphs='generated-head-correctives-v041';
  const mesh={geometry,morphTargetDictionary:{jaw:0,focus:1,concern:2,blink:3},morphTargetInfluences:[0,0,0,0]};
  updateActorExpressionMorphs([mesh],{jawOpen:2,lidFocus:.3},{motion:'hurt',blink:2});assert.deepEqual(mesh.morphTargetInfluences,[1,.6,.65,1]);
  updateActorExpressionMorphs([mesh],{jawOpen:1,lidFocus:.3},{motion:'hurt',blink:1,reducedMotion:true});assert.deepEqual(mesh.morphTargetInfluences,[0,0,0,0]);geometry.dispose();
});

test('Aelia material extends the existing shader without changing its shared source or its zero-blink samples',()=>{
  const source=new T.MeshStandardMaterial(),prior=function(shader){shader.uniforms.priorHook={value:1};};source.onBeforeCompile=prior;source.customProgramCacheKey=()=> 'cloud-shadow-source';
  const material=aeliaFaceMaterial(source),shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader,{});
  assert.equal(source.onBeforeCompile,prior);assert.equal(source.customProgramCacheKey(),'cloud-shadow-source');assert.equal(source.userData.aeliaBlink,undefined);
  assert.equal(shader.uniforms.priorHook.value,1);assert.equal(shader.uniforms.aeliaBlink,material.userData.aeliaBlink);assert.equal(shader.uniforms.aeliaBlink.value,0);
  assert.match(shader.fragmentShader,/if \(aeliaBlink <= 0\.0\) return 0\.0/,'Neutral yields exactly zero coverage for colour and all PBR maps');
  for(const map of ['normalMap','roughnessMap','metalnessMap'])assert.ok(shader.fragmentShader.includes(`texture2D(${map}, vAeliaLidUv), aeliaCoverage()`),`${map} follows closure without changing its neutral sample`);
  assert.ok(!shader.fragmentShader.includes('pow(')||!shader.fragmentShader.includes('pow(y'),'Signed coordinates never enter undefined GLSL pow');
  assert.equal(material.customProgramCacheKey(),'cloud-shadow-source|aelia-own-face-v1');material.dispose();source.dispose();
});


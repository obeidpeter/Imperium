import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/three/addons/libs/meshopt_decoder.module.js';
import {inspectModel,budgetProblems} from '../scripts/assets/check-model.mjs';
import {REGIONAL_KIT_COMPONENTS} from '../src/showcase/regional-kit-components.js';

const root=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('art-source/models/processed/regional-kits.json',root),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('regional architecture supplies sixty individually addressable original components',()=>{
  assert.equal(catalog.kits.length,5);
  assert.equal(catalog.componentCount,60);
  assert.equal(new Set(catalog.kits.flatMap(kit=>kit.components.map(component=>component.name))).size,60);
  assert.deepEqual(catalog.kits.flatMap(kit=>kit.chapters).sort((a,b)=>a-b),[1,2,3,4,6,7,8,10,11,12]);
  // Chapter IX deliberately reuses the approved Euphrates kit.
  assert.equal(catalog.materialFamilies.length,7);
  for(const kit of catalog.kits){
    assert.equal(kit.components.length,12);
    assert.match(kit.authorship,/Original Blender-authored geometry/);
    assert.match(kit.licence,/no third-party source assets/);
    assert.deepEqual(Object.keys(REGIONAL_KIT_COMPONENTS[`${kit.id}-kit`]).sort(),kit.components.map(c=>c.name).sort());
  }
});

for(const kit of catalog.kits)test(`${kit.id}: decoded silhouettes match conservative placement bounds and packed budgets`,async()=>{
  const bytes=await readFile(new URL(kit.runtimePath,root));
  const compression=JSON.parse(await readFile(new URL(`art-source/models/reports/${kit.id}-kit-compress.json`,root),'utf8'));
  const info=await inspectModel(bytes);
  assert.deepEqual(budgetProblems(info,{bytes:800000,triangles:12000,texture:512,materials:4,minHeight:2,maxHeight:8}),[]);
  assert.equal(info.triangles,kit.output.triangles);
  assert.equal(info.triangles,compression.triangles);
  assert.equal(compression.geometryUnchanged,true);
  assert.equal(sha(bytes),compression.after.sha256);
  assert.equal(bytes.length,compression.after.bytes);
  assert.ok(info.textures.every(texture=>texture.mimeType==='image/ktx2'&&texture.width===512&&texture.height===512));
  assert.ok(info.extensionsRequired.includes('KHR_texture_basisu'));
  assert.ok(info.extensionsRequired.includes('EXT_meshopt_compression'));

  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));
  loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
  const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  try{
    assert.equal(gltf.scene.children.length,12);
    gltf.scene.updateMatrixWorld(true);
    for(const entry of kit.components){
      const component=gltf.scene.getObjectByName(entry.name);
      assert.ok(component,entry.name);
      assert.equal(component.parent,gltf.scene,`${entry.name} must be a directly addressable root`);
      assert.deepEqual(component.position.toArray(),[0,0,0]);
      assert.deepEqual(component.quaternion.toArray(),[0,0,0,1]);
      assert.deepEqual(component.scale.toArray(),[1,1,1]);
      const bounds=new T.Box3().setFromObject(component,true);
      const size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
      assert.ok(Math.abs(bounds.min.y)<.00001,`${entry.name} ground origin ${bounds.min.y}`);
      assert.ok(Math.abs(center.x)<.00001&&Math.abs(center.z)<.00001,`${entry.name} silhouette must be centred, including accessories`);
      const declared=REGIONAL_KIT_COMPONENTS[`${kit.id}-kit`][entry.name];
      size.toArray().forEach((dimension,axis)=>{
        assert.ok(dimension<=declared[axis]+.00001,`${entry.name} axis${axis} geometry exceeds placement bounds`);
        assert.ok(declared[axis]-dimension<.0011,`${entry.name} axis${axis} stale dimensions`);
      });
      let primitives=0;
      component.traverse(object=>{
        if(!object.isMesh)return;
        primitives++;
        const positions=object.geometry.getAttribute('position');
        for(const value of positions.array)assert.ok(Number.isFinite(value),'finite mesh vertices');
      });
      assert.equal(primitives,entry.materials);
      assert.ok(primitives>=1&&primitives<=4);
    }
  }finally{
    const geometries=new Set(),materials=new Set(),textures=new Set();
    gltf.scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
    for(const resource of [...geometries,...materials,...textures])resource.dispose();
  }
});

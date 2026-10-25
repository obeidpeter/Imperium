import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {createTerrainUniforms,installTerrainMaterial,setTerrainSplat} from '../src/showcase/terrain-material.js';
import {SCENE_MEMORY_METHOD,sceneTextureResources,textureGpuBytes,estimateSceneGpuMemory} from '../src/showcase/scene-memory.js';

const data=(width=2,height=2)=>new T.DataTexture(new Uint8Array(width*height*4),width,height);
const mesh=(material,geometry=new T.BufferGeometry())=>new T.Mesh(geometry,material);

test('terrain ground arrays and splat maps count once across patched materials before and after compilation',()=>{
  const uniforms=createTerrainUniforms(),a=installTerrainMaterial(new T.MeshStandardMaterial(),uniforms),b=installTerrainMaterial(new T.MeshStandardMaterial(),uniforms,{normals:false});
  setTerrainSplat(uniforms,{data:new Uint8Array(4*8*12),nx:4,nz:8,minX:0,minZ:0,maxX:4,maxZ:8});
  const scene=new T.Scene();scene.add(mesh(a),mesh(a),mesh(b));
  const expected=[uniforms.groundAlbedoMap.value,uniforms.groundNormalMap.value,uniforms.groundSplatMap.value];
  assert.equal(a.map,null,'the ground layers have no ordinary material map field');
  assert.deepEqual(new Set(sceneTextureResources(scene)),new Set(expected));
  const bytes=expected.reduce((n,texture)=>n+texture.image.data.byteLength,0);
  assert.deepEqual(estimateSceneGpuMemory(scene),{textures:bytes,geometry:0,total:bytes});
  const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};a.onBeforeCompile(shader);
  const properties={get:material=>material===a?{uniforms:shader.uniforms}:{}};
  assert.deepEqual(estimateSceneGpuMemory(scene,properties),{textures:bytes,geometry:0,total:bytes},'compiled uniforms and their userData references are the same textures');
  uniforms.groundSplatMap.value.dispose();a.dispose();b.dispose();
});

test('material arrays, nested uniform values, compiled hooks and cyclic userData are traversed without counting targets',()=>{
  const direct=data(),custom=data(),compiled=data(),background=data(),bone=data(),target=new T.WebGLRenderTarget(8,8);
  const standard=new T.MeshStandardMaterial({map:direct}),shader=new T.ShaderMaterial({uniforms:{layers:new T.Uniform([custom,{map:direct}]),target:new T.Uniform(target.texture)}});
  standard.userData.effect={uniforms:{nested:{value:[custom]}}};standard.userData.effect.cycle=standard.userData;
  const scene=new T.Scene(),object=mesh([standard,shader]);object.skeleton={boneTexture:bone};scene.add(object);
  standard.userData.owner=scene; // Never walk class instances back into the scene.
  scene.background=background;scene.environment=background;
  const properties={get:material=>material===standard?{uniforms:{patched:{value:{map:compiled}},target:{value:target.texture}}}:{}};
  assert.deepEqual(new Set(sceneTextureResources(scene,properties)),new Set([direct,custom,compiled,background,bone]));
  assert.equal(estimateSceneGpuMemory(scene,properties).textures,5*16);
  assert.equal(textureGpuBytes(target.texture),0);target.dispose();
});

test('textures sharing an uploaded GPU handle count once; distinct handles remain distinct',()=>{
  const original=data(4,4),clone=original.clone(),scene=new T.Scene();scene.add(mesh(new T.MeshStandardMaterial({map:original,normalMap:clone})));
  const shared={},separate={},properties={get:texture=>({__webglTexture:texture.isTexture?shared:undefined})};
  assert.equal(estimateSceneGpuMemory(scene,properties).textures,64);
  assert.equal(estimateSceneGpuMemory(scene,{get:texture=>({__webglTexture:texture===clone?separate:texture===original?shared:undefined})}).textures,128);
});

test('compressed terrain arrays and cube faces count all supplied mip payloads without multiplying layers twice',()=>{
  const mipmaps=[{width:8,height:8,data:new Uint8Array(64*3)},{width:4,height:4,data:new Uint8Array(16*3)},{width:2,height:2,data:new Uint8Array(16*3)}];
  const array=new T.CompressedArrayTexture(mipmaps,8,8,3,T.RGBA_S3TC_DXT5_Format);
  assert.equal(textureGpuBytes(array),288);
  const faces=Array.from({length:6},()=>({width:8,height:8,mipmaps:[{width:8,height:8,data:new Uint8Array(32)},{width:4,height:4,data:new Uint8Array(8)}]}));
  assert.equal(textureGpuBytes(new T.CompressedCubeTexture(faces,T.RGB_S3TC_DXT1_Format)),240);
});

test('uncompressed formats, exact rectangular mip chains, array layers and explicit mips have their storage counted',()=>{
  const rectangular=data(8,2);rectangular.generateMipmaps=true;rectangular.minFilter=T.LinearMipmapLinearFilter;
  assert.equal(textureGpuBytes(rectangular),(8*2+4+2+1)*4,'a 4/3 multiplier would underestimate a narrow texture');
  rectangular.minFilter=T.LinearFilter;assert.equal(textureGpuBytes(rectangular),92,'generated mip storage exists even with a non-mip filter');
  const array=new T.DataArrayTexture(new Uint8Array(8*2*4*3),8,2,3);array.generateMipmaps=true;array.minFilter=T.LinearMipmapLinearFilter;
  assert.equal(textureGpuBytes(array),(8*2+4+2+1)*4*3,'array layer count stays fixed through mips');
  const half=new T.DataTexture(new Uint16Array(2*2*2),2,2,T.RGFormat,T.HalfFloatType);
  assert.equal(textureGpuBytes(half),16);
  const explicit=data(4,4);explicit.mipmaps=[{width:4,height:4,data:new Uint8Array(64)},{width:2,height:2,data:new Uint8Array(16)},{width:1,height:1,data:new Uint8Array(4)}];
  assert.equal(textureGpuBytes(explicit),84,'explicit mips include the base and replace automatic estimates');
  const cube=new T.CubeTexture(Array.from({length:6},()=>({width:4,height:4})));cube.generateMipmaps=false;
  cube.mipmaps=[{image:Array.from({length:6},()=>({width:2,height:2}))}];
  assert.equal(textureGpuBytes(cube),(4*4+2*2)*4*6,'uncompressed cube mip lists exclude the base');
});

test('shared geometry and interleaved attributes count once, with index, morph and instance buffers included',()=>{
  const scene=new T.Scene(),geometry=new T.BufferGeometry(),interleaved=new T.InterleavedBuffer(new Float32Array(18),6);
  geometry.setAttribute('position',new T.InterleavedBufferAttribute(interleaved,3,0));geometry.setAttribute('normal',new T.InterleavedBufferAttribute(interleaved,3,3));
  geometry.setIndex(new T.BufferAttribute(new Uint16Array([0,1,2]),1));
  geometry.morphAttributes.position=[new T.BufferAttribute(new Float32Array(9),3)];
  const material=new T.MeshBasicMaterial(),instance=new T.InstancedMesh(geometry,material,2);instance.instanceColor=new T.InstancedBufferAttribute(new Float32Array(6),3);
  scene.add(mesh(material,geometry),mesh(material,geometry),instance);
  assert.equal(estimateSceneGpuMemory(scene).geometry,72+6+36+128+24);
  const second=new T.BufferGeometry();second.setAttribute('position',geometry.attributes.position);scene.add(mesh(material,second));
  assert.equal(estimateSceneGpuMemory(scene).geometry,72+6+36+128+24,'shared attribute across geometries is one buffer');
  const independent=new T.BufferGeometry();independent.setAttribute('position',new T.BufferAttribute(interleaved.array,3));scene.add(mesh(material,independent));
  assert.equal(estimateSceneGpuMemory(scene).geometry,72+6+36+128+24+72,'distinct attributes over one CPU array allocate separately');
});

test('memory reports version the corrected method and disclose excluded allocations',()=>{
  assert.equal(SCENE_MEMORY_METHOD.version,2);
  assert.match(SCENE_MEMORY_METHOD.description,/injected shader uniforms/);
  assert.ok(SCENE_MEMORY_METHOD.excludes.some(text=>/shadow maps.*compositor/.test(text)));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as T from '../vendor/three/three.module.js';
import {KTX2_WORKER,ktx2WorkerSource} from '../scripts/assets/ktx2-worker.mjs';
import {basisArguments,textureClass} from '../scripts/assets/compress.mjs';
import {serveRequest} from '../scripts/serve.mjs';
import {SameOriginKTX2Loader,createModelLoader,detectTextureSupport} from '../src/showcase/model-loader.js';
import {useNodeWorkers} from './node-workers.mjs';

// Fixtures: a 16 px code-drawn checker on a quad, as a WebP model and after
// scripts/assets/compress.mjs (KTX2 ETC1S texture, meshopt geometry).
const root=new URL('../',import.meta.url),file=path=>readFile(new URL(path,root));
const arrayBuffer=bytes=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
const webpQuad=await file('tests/models/webp-quad.glb'),compressedQuad=await file('tests/models/compressed-quad.glb');
const policy=page=>Object.fromEntries(/http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(page)[1].split(';').map(d=>d.trim().split(/\s+/)).map(([name,...values])=>[name,values]));
const meshes=scene=>{const list=[];scene.traverse(o=>{if(o.isMesh)list.push(o);});return list;};
// A canvas whose WebGL 2 context offers the named extensions.
const canvasWith=names=>{const lost=[];return {lost,getContext:kind=>kind==='webgl2'?{getExtension:name=>name==='WEBGL_lose_context'?{loseContext:()=>lost.push(true)}:names.includes(name)?{getSupportedProfiles:()=>['ldr']}:null}:null};};

test('the transcoder worker file is the script KTX2Loader would assemble', async()=>{
  assert.equal((await file(KTX2_WORKER)).toString('utf8'),await ktx2WorkerSource(),'Run node scripts/assets/ktx2-worker.mjs after updating the vendored KTX2Loader or transcoder.');
});

test('the vendored addons are three.js r186 as published, with local three imports and LF or CRLF text', async()=>{
  const rows=[...(await file('vendor/three/addons/PROVENANCE.md')).toString('utf8').matchAll(/^\| `([^`]+)` \| `([0-9a-f]{64})` \|/gm)];
  assert.ok(rows.length>=12,'every vendored addon is listed');
  const publishedHash=(path,bytes)=>{
    // Git may convert text to CRLF on Windows; binary decoders must remain byte-for-byte identical.
    if(!path.endsWith('.wasm'))bytes=Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n').replaceAll("from '../../three.module.js'","from 'three'"));
    return createHash('sha256').update(bytes).digest('hex');
  };
  for(const [,path,sha256]of rows){
    const bytes=await file('vendor/three/addons/'+path);
    assert.equal(publishedHash(path,bytes),sha256,path);
    if(!path.endsWith('.wasm')){
      // Exercise both checkout formats even when CI itself uses LF.
      const lf=bytes.toString('utf8').replaceAll('\r\n','\n');
      for(const eol of ['\n','\r\n'])assert.equal(publishedHash(path,Buffer.from(lf.replaceAll('\n',eol))),sha256,`${path}: ${eol==='\n'?'LF':'CRLF'}`);
    }
    const changed=Buffer.from(bytes);changed[0]^=1;
    assert.notEqual(publishedHash(path,changed),sha256,`${path}: changed content is still rejected`);
  }
});

test('the page policies add WebAssembly compilation and nothing else', async()=>{
  const pages=await Promise.all(['index.html','showcase/arena.html'].map(async path=>policy((await file(path)).toString('utf8'))));
  for(const directives of pages){
    // Decoders compile WebAssembly; no other script may be evaluated, and workers come from the page's origin only.
    assert.deepEqual(directives['script-src'],["'self'","'wasm-unsafe-eval'"]);
    assert.deepEqual(directives['worker-src'],["'self'"]);assert.deepEqual(directives['connect-src'],["'self'"]);
    assert.ok(Object.values(directives).flat().every(value=>!["'unsafe-eval'","blob:"].includes(value)||value==='blob:'&&directives['img-src'].includes(value)),'no eval, and blob: for images only');
  }
  assert.deepEqual(pages[1],pages[0],'the arena keeps the game page policy');
});

test('the local server names model, texture and WebAssembly types', async t=>{
  const folder=await mkdtemp(join(tmpdir(),'imperium-types-'));t.after(()=>rm(folder,{recursive:true,force:true}));
  const types={};
  for(const name of ['model.glb','texture.ktx2','decoder.wasm']){
    await writeFile(join(folder,name),'x');
    const res={writeHead:(status,headers)=>{types[name]={status,type:headers['Content-Type']};},end(){}};
    await serveRequest({url:'/'+name},res,folder);
  }
  assert.deepEqual(types,{'model.glb':{status:200,type:'model/gltf-binary'},'texture.ktx2':{status:200,type:'image/ktx2'},'decoder.wasm':{status:200,type:'application/wasm'}});
});

test('texture formats come from a throwaway WebGL 2 context, and S3TC only with its sRGB variant', ()=>{
  const config=names=>{const canvas=canvasWith(names),loader=detectTextureSupport(new SameOriginKTX2Loader(),canvas);assert.deepEqual(canvas.lost,[true],'the context is released');return loader.workerConfig;};
  assert.equal(config(['WEBGL_compressed_texture_s3tc']).dxtSupported,false,'colour maps need sRGB S3TC');
  assert.equal(config(['WEBGL_compressed_texture_s3tc','WEBGL_compressed_texture_s3tc_srgb']).dxtSupported,true);
  assert.equal(config(['WEBGL_compressed_texture_etc']).etc2Supported,true);
  const none=detectTextureSupport(new SameOriginKTX2Loader(),null).workerConfig;
  assert.ok(Object.values(none).every(value=>value===false),'without WebGL 2 every texture is transcoded to plain pixels');
});

test('a compressed model loads through the page’s own worker: textures stay compressed, geometry decodes exactly', async t=>{
  const node=useNodeWorkers();t.after(()=>node.restore());
  const ktx2=detectTextureSupport(new SameOriginKTX2Loader(),canvasWith(['WEBGL_compressed_texture_s3tc','WEBGL_compressed_texture_s3tc_srgb']));
  const loaded=(await createModelLoader({ktx2:()=>ktx2,decode:async()=>{throw Error('a KTX2 model decodes no image');}}).parseAsync(arrayBuffer(compressedQuad),'')).scene;
  const [mesh]=meshes(loaded),map=mesh.material.map;
  assert.ok(map.isCompressedTexture&&map.format===T.RGBA_S3TC_DXT1_Format,'transcoded to the GPU format the device offers');
  assert.deepEqual(map.mipmaps.map(level=>level.width),[16,8,4,2,1],'with its mipmaps');
  assert.equal(map.colorSpace,T.SRGBColorSpace);assert.equal(map.flipY,false);assert.equal(map.userData.mimeType,'image/ktx2');assert.ok(map.userData.decodedOffThread);
  assert.deepEqual(node.workers.map(url=>url.slice(url.indexOf('vendor/'))),['vendor/three/addons/libs/basis/basis_worker.js'],'the worker is the page’s own file');
  assert.deepEqual(node.requests.map(url=>url.slice(url.indexOf('vendor/'))),['vendor/three/addons/libs/basis/basis_transcoder.wasm'],'the transcoder is the only request');
  // meshopt keeps every stored value; only the order may change.
  const plain=meshes((await createModelLoader({decode:async()=>({width:16,height:16,close(){}})}).parseAsync(arrayBuffer(webpQuad),'')).scene)[0];
  const corners=geometry=>{const p=geometry.attributes.position,uv=geometry.attributes.uv,index=geometry.index.array;return [...index].map(i=>[p.getX(i),p.getY(i),p.getZ(i),uv.getX(i),uv.getY(i)].join()).sort();};
  assert.deepEqual(corners(mesh.geometry),corners(plain.geometry));
  ktx2.dispose();
});

test('a KTX2 image that cannot be transcoded fails the whole model, not just its texture', async t=>{
  const node=useNodeWorkers();t.after(()=>node.restore());
  const bytes=Buffer.from(compressedQuad),jsonLength=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+jsonLength)),view=doc.bufferViews[doc.images[0].bufferView];
  // Corrupt the image's KTX2 identifier, inside the binary chunk.
  bytes.fill(0,20+jsonLength+8+(view.byteOffset??0),20+jsonLength+8+(view.byteOffset??0)+12);
  const ktx2=detectTextureSupport(new SameOriginKTX2Loader(),null);
  await assert.rejects(createModelLoader({ktx2:()=>ktx2}).parseAsync(arrayBuffer(bytes),''),/Missing KTX 2\.0 identifier/);
  ktx2.dispose();
});

test('the transcoder starts only for a model with KTX2 images; WebP images still decode from the model’s bytes', async t=>{
  const node=useNodeWorkers();t.after(()=>node.restore());
  let started=0;const ktx2=()=>{started++;return detectTextureSupport(new SameOriginKTX2Loader(),null);};
  const decoded=[],decode=async(blob,options)=>{assert.ok(blob instanceof Blob&&blob.size>0);decoded.push({type:blob.type,options});return {width:16,height:16,close(){}};};
  const scene=(await createModelLoader({decode,ktx2}).parseAsync(arrayBuffer(webpQuad),'')).scene,map=meshes(scene)[0].material.map;
  assert.equal(started,0,'no transcoder for a WebP model');assert.deepEqual(node.workers,[]);assert.deepEqual(node.requests,[],'nothing is fetched');
  assert.deepEqual(decoded.map(d=>d.type),['image/webp']);assert.ok(map.userData.decodedOffThread&&map.flipY===false&&!map.isCompressedTexture);
});

test('the compressor encodes colour maps as sRGB, normal and data maps as linear, each with mipmaps', ()=>{
  assert.equal(textureClass(['baseColorTexture']),'srgb');assert.equal(textureClass(['emissiveTexture']),'srgb');
  assert.equal(textureClass(['normalTexture']),'normal');
  assert.equal(textureClass(['metallicRoughnessTexture','occlusionTexture']),'linear');
  assert.throws(()=>textureClass(['baseColorTexture','metallicRoughnessTexture']),/give each use its own image/);
  const args=kind=>basisArguments(kind,{input:'in.png',output:'out.ktx2'});
  for(const kind of ['srgb','normal','linear'])assert.ok(['-ktx2','-mipmap'].every(flag=>args(kind).includes(flag))&&args(kind).includes('128'));
  assert.ok(args('normal').includes('-normal_map')&&args('linear').includes('-linear')&&args('linear').includes('-mip_linear'));
  assert.ok(!args('srgb').includes('-linear')&&!args('srgb').includes('-normal_map'));
});

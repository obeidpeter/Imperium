import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/three/addons/libs/meshopt_decoder.module.js';
import {triangleDigest} from '../scripts/assets/repack-prop.mjs';

const file=path=>readFile(new URL('../'+path,import.meta.url));
const manifest=JSON.parse(await file('docs/asset-manifest.json'));
const repacked=manifest.assets.filter(e=>e.source?.geometryRepack);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

test('repacked Chapter VII props retain their original position triangles and texture bytes in the game loader', async () => {
  assert.equal(repacked.length,11);
  let saved=0;
  for(const entry of repacked){
    const bytes=await file(entry.path),report=JSON.parse(await file(entry.source.geometryRepack.report));
    assert.equal(digest(bytes),report.sha256,entry.id);assert.equal(report.sha256,entry.export.sha256);
    assert.equal(bytes.length,entry.export.bytes);assert.equal(gzipSync(bytes).length,entry.export.gzipBytes);
    assert.ok(report.maxNormalAngleDegrees<.4);assert.ok(report.maxUvError<=1/131070+1e-7);
    for(const property of ['positionsAndTopologyUnchanged','texturesUnchanged','sceneUnchanged','materialsUnchanged','meshoptStoredValuesUnchanged'])assert.equal(report[property],true,entry.id+' '+property);
    saved+=report.gzipBytesBefore-report.gzipBytes;
    const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12))),bin=bytes.subarray(28+bytes.readUInt32LE(12));
    assert.ok(doc.extensionsRequired.includes('KHR_mesh_quantization'));
    const textures=doc.images.map(i=>{const v=doc.bufferViews[i.bufferView],b=bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);return {mimeType:i.mimeType,bytes:b.length,sha256:digest(b)};});
    assert.deepEqual(textures,report.textures,entry.id+' keeps its existing texture images byte for byte');
    const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
    const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const triangles=[];
    for(const mesh of doc.meshes)for(const [primitive,p]of mesh.primitives.entries()){
      const position=await gltf.parser.getDependency('accessor',p.attributes.POSITION),index=p.indices===undefined?null:await gltf.parser.getDependency('accessor',p.indices),count=index?.count??position.count;
      assert.equal(doc.accessors[p.attributes.POSITION].componentType,5126,'Positions retain float precision');
      triangles.push({mesh:mesh.name??'',primitive,material:p.material??-1,triangles:count/3,attributes:['POSITION'],sha256:triangleDigest(index?.array,count,i=>[position.getX(i),position.getY(i),position.getZ(i)].join(','))});
    }
    assert.deepEqual(triangles,report.positionTriangles,entry.id+' retains every original triangle and its winding');
    gltf.scene.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])m.dispose();});
  }
  assert.ok(saved>=490000,'Recover meaningful chapter headroom without removing any scenery or reducing texture detail');
});

test('triangle validation allows vertex reindexing but catches a reversed face or changed position', () => {
  const vertices=['0,0,0','1,0,0','0,1,0'],hash=indices=>triangleDigest(indices,3,i=>vertices[i]);
  assert.equal(hash([0,1,2]),hash([2,0,1]));assert.notEqual(hash([0,1,2]),hash([0,2,1]));
  const before=hash([0,1,2]);vertices[1]='1.001,0,0';assert.notEqual(hash([0,1,2]),before);
});

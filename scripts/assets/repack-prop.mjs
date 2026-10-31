// Repack an already-compressed static prop without re-encoding any texture.
// Uses the character pipeline's bounded normal/UV quantization, retaining
// float positions, triangle winding, materials and node transforms. Requires
// the existing ASSET_MODULES toolchain, not a runtime dependency or network.
// node scripts/assets/repack-prop.mjs input.glb output.glb --report report.json
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';
import {quantizeModel} from './quantize-model.mjs';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
/** Vertex-order independent, but winding-sensitive, digest of rendered triangles. */
export function triangleDigest(indices,count,vertex){
  const triangles=[];
  for(let i=0;i<count;i+=3){
    const v=[0,1,2].map(k=>vertex(indices?indices[i+k]:i+k)),first=v.indexOf([...v].sort()[0]);
    triangles.push([v[first],v[(first+1)%3],v[(first+2)%3]].join(' / '));
  }
  return sha256(triangles.sort().join('\n'));
}
function geometry(document,positionsOnly=false){
  return document.getRoot().listMeshes().flatMap(mesh=>mesh.listPrimitives().map((p,primitive)=>{
    assert.equal(p.getMode(),4,'Only triangle props can be repacked');
    const names=positionsOnly?['POSITION']:p.listSemantics().sort(),attributes=names.map(n=>p.getAttribute(n)),indices=p.getIndices()?.getArray();
    const count=indices?.length??p.getAttribute('POSITION').getCount();
    return {mesh:mesh.getName(),primitive,material:document.getRoot().listMaterials().indexOf(p.getMaterial()),triangles:count/3,attributes:names,
      sha256:triangleDigest(indices,count,i=>attributes.map(a=>a.getElement(i,[]).join(',')).join('|'))};
  }));
}
function textures(document){return document.getRoot().listTextures().map(t=>({mimeType:t.getMimeType(),bytes:t.getImage().byteLength,sha256:sha256(t.getImage())}));}
function scene(document){
  const r=document.getRoot(),nodes=r.listNodes(),meshes=r.listMeshes();
  return nodes.map(n=>({name:n.getName(),translation:n.getTranslation(),rotation:n.getRotation(),scale:n.getScale(),mesh:meshes.indexOf(n.getMesh()),children:n.listChildren().map(c=>nodes.indexOf(c))}));
}
function precision(before,after){
  let maxNormalAngleDegrees=0,maxUvError=0;
  const a=before.getRoot().listMeshes().flatMap(m=>m.listPrimitives()),b=after.getRoot().listMeshes().flatMap(m=>m.listPrimitives());
  a.forEach((p,j)=>{
    for(const semantic of ['NORMAL','TEXCOORD_0']){
      const x=p.getAttribute(semantic),y=b[j].getAttribute(semantic);if(!x)continue;
      assert.equal(y.getCount(),x.getCount());
      for(let i=0;i<x.getCount();i++){
        const v=x.getElement(i,[]),w=y.getElement(i,[]);
        if(semantic==='NORMAL'){
          const lengths=Math.hypot(...v)*Math.hypot(...w);
          if(lengths)maxNormalAngleDegrees=Math.max(maxNormalAngleDegrees,Math.acos(Math.max(-1,Math.min(1,v.reduce((n,k,c)=>n+k*w[c],0)/lengths)))*180/Math.PI);
        }else for(let k=0;k<v.length;k++)maxUvError=Math.max(maxUvError,Math.abs(v[k]-w[k]));
      }
    }
  });
  assert.ok(maxNormalAngleDegrees<.4,`Normal drift ${maxNormalAngleDegrees}° exceeds 0.4°`);
  assert.ok(maxUvError<=1/131070+1e-7,`UV drift ${maxUvError} exceeds half a 16-bit step`);
  return {maxNormalAngleDegrees,maxUvError};
}
export async function repackProp(bytes){
  const require=createRequire(process.env.ASSET_MODULES?resolve(process.env.ASSET_MODULES,'_'):import.meta.url);
  const [core,extensions,meshopt]=await Promise.all(['@gltf-transform/core','@gltf-transform/extensions','meshoptimizer'].map(name=>import(pathToFileURL(require.resolve(name)).href)));
  const {MeshoptEncoder,MeshoptDecoder}=meshopt;await MeshoptEncoder.ready;await MeshoptDecoder.ready;
  const io=new core.NodeIO().registerExtensions(extensions.ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
  const before=await io.readBinary(bytes),root=before.getRoot();
  assert.equal(root.listSkins().length,0,'Use the character binding pipeline for skins');
  assert.equal(root.listAnimations().length,0,'Animated assets are outside this static-prop pass');
  for(const m of root.listMeshes())for(const p of m.listPrimitives())assert.equal(p.listTargets().length,0,'Morph targets must remain in their own pipeline');
  const originalPositions=geometry(before,true),originalTextures=textures(before),originalScene=scene(before);
  const materialState=async d=>{const {json}=await io.writeJSON(d);return {materials:json.materials,textures:json.textures,samplers:json.samplers};};
  const originalMaterials=await materialState(before);
  root.listExtensionsUsed().find(e=>e.extensionName==='EXT_meshopt_compression')?.dispose();
  const quantized=quantizeModel(Buffer.from(await io.writeBinary(before))),after=await io.readBinary(quantized.bytes);
  assert.ok(Object.keys(quantized.changed).every(name=>['NORMAL','TEXCOORD_0'].includes(name)),'Other attribute quantization needs its own error validation');
  const error=precision(before,after);
  assert.deepEqual(geometry(after,true),originalPositions,'Every position and triangle winding must be unchanged');
  const storedGeometry=geometry(after);
  after.createExtension(extensions.EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:extensions.EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  const output=Buffer.from(await io.writeBinary(after)),checked=await io.readBinary(output);
  assert.deepEqual(geometry(checked),storedGeometry,'Meshopt must preserve every quantized attribute');
  assert.deepEqual(textures(checked),originalTextures,'Texture bytes must remain identical');
  assert.deepEqual(scene(checked),originalScene,'Node placement and hierarchy must remain identical');
  assert.deepEqual(await materialState(checked),originalMaterials,'Material properties and texture sampling must remain identical');
  assert.ok(gzipSync(output).length<gzipSync(bytes).length,'Repacking must reduce the download');
  return {bytes:output,report:{tool:'scripts/assets/repack-prop.mjs',inputSha256:sha256(bytes),sha256:sha256(output),bytesBefore:bytes.length,bytes:output.length,
    gzipBytesBefore:gzipSync(bytes).length,gzipBytes:gzipSync(output).length,quantizedVertices:quantized.changed,...error,
    positionsAndTopologyUnchanged:true,texturesUnchanged:true,sceneUnchanged:true,materialsUnchanged:true,meshoptStoredValuesUnchanged:true,
    positionTriangles:originalPositions,textures:originalTextures}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [input,output,...args]=process.argv.slice(2),reportAt=args.indexOf('--report'),reportPath=reportAt<0?null:args[reportAt+1];
  if(!input||!output)throw Error('Usage: node scripts/assets/repack-prop.mjs input.glb output.glb --report report.json');
  const result=await repackProp(await readFile(input));await writeFile(output,result.bytes);
  if(reportPath)await writeFile(reportPath,JSON.stringify(result.report,null,2)+'\n');
  console.log(JSON.stringify({input,output,gzipBytesBefore:result.report.gzipBytesBefore,gzipBytes:result.report.gzipBytes,...Object.fromEntries(['maxNormalAngleDegrees','maxUvError'].map(k=>[k,result.report[k]]))}));
}

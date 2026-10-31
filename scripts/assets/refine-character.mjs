// Offline character refinement bridge. Blender edits only the bounded face
// relief and skin weights. Hero/Aelia near faces get conforming local edge
// splits; glTF-Transform preserves original paint samples, texture payloads,
// materials, skeleton and bind transforms without a texture bake.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';
import {quantizeModel} from './quantize-model.mjs';

export const digest=value=>createHash('sha256').update(typeof value==='string'||ArrayBuffer.isView(value)?value:JSON.stringify(value)).digest('hex');
const values=a=>Array.from({length:a.getCount()},(_,i)=>a.getElement(i,[]));
const primitives=d=>d.getRoot().listMeshes().flatMap(m=>m.listPrimitives().map((p,i)=>({mesh:m.getName(),primitive:i,p})));
const textures=d=>d.getRoot().listTextures().map(t=>({mimeType:t.getMimeType(),bytes:t.getImage().length,sha256:digest(t.getImage())}));
const protectedContact=([x,y])=>y<.12||(Math.abs(x)>.16&&y<1.11);
const inFace=([x,y,z])=>y>1.53&&y<1.69&&Math.abs(x)<.13&&z>.035;
/** Conforming midpoint split, preserving every source triangle's winding. */
export function splitFaceTriangles(indices,sourceCount,edges){
  const key=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`,mid=new Map(edges.map(([a,b],i)=>[key(a,b),sourceCount+i])),out=[];
  assert.equal(mid.size,edges.length,'Every split edge is unique');
  for(let i=0;i<indices.length;i+=3){
    let face=Array.from(indices.slice(i,i+3)),m=face.map((a,j)=>mid.get(key(a,face[(j+1)%3]))),count=m.filter(x=>x!==undefined).length;
    if(!count){out.push(...face);continue;}
    if(count===3){const [a,b,c]=face,[x,y,z]=m;out.push(a,x,z,x,b,y,z,y,c,x,y,z);continue;}
    while(m[0]===undefined||count===2&&m[1]===undefined){face=[...face.slice(1),face[0]];m=[...m.slice(1),m[0]];}
    const [a,b,c]=face,[x,y]=m;
    out.push(...(count===1?[a,x,c,x,b,c]:[b,y,x,a,x,c,x,y,c]));
  }
  return out;
}
function signature(d){
  const root=d.getRoot(),nodes=root.listNodes(),meshes=root.listMeshes();
  return {
    nodes:nodes.map(n=>({name:n.getName(),translation:n.getTranslation(),rotation:n.getRotation(),scale:n.getScale(),mesh:meshes.indexOf(n.getMesh()),children:n.listChildren().map(c=>nodes.indexOf(c))})),
    skins:root.listSkins().map(s=>({joints:s.listJoints().map(n=>nodes.indexOf(n)),inverseBindMatrices:values(s.getInverseBindMatrices())})),
    textures:textures(d),
    geometry:primitives(d).map(({mesh,primitive,p})=>({mesh,primitive,vertices:p.getAttribute('POSITION').getCount(),indices:digest(p.getIndices().getArray()),uv:digest(p.getAttribute('TEXCOORD_0').getArray()),
      identityPlane:digest(values(p.getAttribute('POSITION')).map(([x,y])=>[x,y])),
      nonFacePositions:digest(values(p.getAttribute('POSITION')).flatMap((v,i)=>!inFace(v)?[[i,v]]:[])),
      colours:p.listSemantics().filter(n=>n.startsWith('COLOR_')).map(n=>[n,digest(p.getAttribute(n).getArray())]),
      contacts:digest(values(p.getAttribute('POSITION')).flatMap((v,i)=>protectedContact(v)?[[i,v,p.getAttribute('JOINTS_0').getElement(i,[]),p.getAttribute('WEIGHTS_0').getElement(i,[])]]:[]))}))
  };
}
async function setup(){
  const require=createRequire(process.env.ASSET_MODULES?resolve(process.env.ASSET_MODULES,'_'):import.meta.url);
  const [core,extensions,meshopt]=await Promise.all(['@gltf-transform/core','@gltf-transform/extensions','meshoptimizer'].map(n=>import(pathToFileURL(require.resolve(n)).href)));
  await meshopt.MeshoptEncoder.ready;await meshopt.MeshoptDecoder.ready;
  const io=new core.NodeIO().registerExtensions(extensions.ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':meshopt.MeshoptEncoder,'meshopt.decoder':meshopt.MeshoptDecoder});
  return {io,extensions};
}
export async function exportCharacter(bytes,id){
  const {io}=await setup(),d=await io.readBinary(bytes);
  assert.equal(d.getRoot().listSkins().length,1,'One game skeleton required');
  assert.equal(d.getRoot().listAnimations().length,0,'Authored clips stay in the runtime');
  const joints=d.getRoot().listSkins()[0].listJoints().map(n=>n.getName());
  return {version:1,id,inputSha256:digest(bytes),joints,meshes:primitives(d).map(({mesh,primitive,p})=>{
    assert.equal(p.listTargets().length,0,'The runtime owns expression morphs');
    return {mesh,primitive,positions:values(p.getAttribute('POSITION')),normals:values(p.getAttribute('NORMAL')),joints:values(p.getAttribute('JOINTS_0')),weights:values(p.getAttribute('WEIGHTS_0')),indices:Array.from(p.getIndices().getArray()),attributes:Object.fromEntries(p.listSemantics().filter(n=>n.startsWith('TEXCOORD_')||n.startsWith('COLOR_')).map(n=>[n,values(p.getAttribute(n))]))};
  })};
}
export async function importCharacter(bytes,refined){
  const {io,extensions}=await setup(),d=await io.readBinary(bytes),original=signature(d);
  assert.equal(refined.inputSha256,digest(bytes),'Refinement must match its source asset');
  assert.equal(refined.version,1);assert.equal(refined.meshes.length,primitives(d).length);
  const changes=[];
  for(const [i,{mesh,primitive,p}]of primitives(d).entries()){
    const q=refined.meshes[i],pos=p.getAttribute('POSITION'),normal=p.getAttribute('NORMAL'),joints=p.getAttribute('JOINTS_0'),weight=p.getAttribute('WEIGHTS_0');
    assert.equal(q.mesh,mesh);assert.equal(q.primitive,primitive);assert.ok(q.positions.length>=pos.getCount());
    const sourceCount=pos.getCount(),subdivision=q.subdivision??[];
    assert.equal(q.positions.length-sourceCount,subdivision.length);
    if(!subdivision.length)assert.deepEqual(q.indices,Array.from(p.getIndices().getArray()),'Unrefined topology must be unchanged');
    else {
      assert.ok(['roman-recruit','cast-aelia'].includes(refined.id)&&mesh==='body','Subdivision is restricted to reviewed near faces');
      assert.ok(q.indices.length/3<=(refined.id==='roman-recruit'?12000:12500),'Near-body triangle ceiling');
      assert.ok(q.positions.length<65536,'Retain 16-bit index width');
      assert.deepEqual(q.indices,splitFaceTriangles(p.getIndices().getArray(),sourceCount,subdivision),'Every original triangle must have a conforming, winding-preserving split');
      for(const [k,[a,b]]of subdivision.entries()){
        assert.ok(a<sourceCount&&b<sourceCount&&a>=0&&b>=0);
        const v=pos.getElement(a,[]).map((v,n)=>(v+pos.getElement(b,[])[n])/2),after=q.positions[sourceCount+k];
        assert.ok(v[1]>1.53&&v[1]<1.69&&Math.abs(v[0])<.13&&v[2]>.035);
        assert.equal(after[0],v[0]);assert.equal(after[1],v[1]);assert.ok(Math.abs(after[2]-v[2])<=.00301);
        assert.ok(after.every(Number.isFinite)&&q.normals[sourceCount+k].every(Number.isFinite));
        const js=q.joints[sourceCount+k],ws=q.weights[sourceCount+k];
        assert.equal(js.length,4);assert.equal(ws.length,4);assert.ok(js.every(j=>Number.isInteger(j)&&j>=0&&j<15));
        assert.ok(ws.every(w=>Number.isFinite(w)&&w>=0));assert.ok(Math.abs(ws.reduce((a,b)=>a+b,0)-1)<1e-6);
        for(const [name,rows]of Object.entries(q.attributes)){
          const attr=p.getAttribute(name),expected=attr.getElement(a,[]).map((v,n)=>(v+attr.getElement(b,[])[n])/2);
          assert.deepEqual(rows[sourceCount+k],expected,'New paint coordinates/colours are barycentric edge samples');
        }
      }
    }
    let maxDisplacement=0,changedPositions=0,changedWeights=0;
    for(let k=0;k<pos.getCount();k++){
      const before=pos.getElement(k,[]),after=q.positions[k],delta=Math.hypot(...before.map((v,n)=>v-after[n]));
      assert.ok(after.every(Number.isFinite)&&q.normals[k].every(Number.isFinite));
      assert.ok(delta<=(subdivision.length?.00301:.00151),'Source sculpt has a millimetre bound');
      assert.equal(after[0],before[0],'Painted feature width must not move');assert.equal(after[1],before[1],'Painted feature height must not move');
      if(delta>1e-9){changedPositions++;assert.ok(before[1]>1.53&&before[1]<1.69&&Math.abs(before[0])<.13&&before[2]>.035,'Only frontal facial relief can change');}
      const oldJ=joints.getElement(k,[]),oldW=weight.getElement(k,[]),newJ=q.joints[k],newW=q.weights[k];
      assert.equal(newJ.length,4);assert.equal(newW.length,4);assert.ok(newJ.every(j=>Number.isInteger(j)&&j>=0&&j<15));
      assert.ok(newW.every(w=>Number.isFinite(w)&&w>=0));assert.ok(Math.abs(newW.reduce((a,b)=>a+b,0)-1)<1e-6);
      if(protectedContact(before)){assert.deepEqual(after,before);assert.deepEqual(newJ,oldJ);assert.deepEqual(newW,oldW);}
      if(JSON.stringify(oldJ)!==JSON.stringify(newJ)||JSON.stringify(oldW)!==JSON.stringify(newW))changedWeights++;
      maxDisplacement=Math.max(maxDisplacement,delta);
    }
    pos.setArray(new Float32Array(q.positions.flat()));
    normal.setArray(new Float32Array(q.normals.flat())).setNormalized(false);
    joints.setArray(new Uint8Array(q.joints.flat())).setNormalized(false);
    weight.setArray(new Float32Array(q.weights.flat())).setNormalized(false);
    if(subdivision.length){
      p.getIndices().setArray(new Uint16Array(q.indices));
      for(const [name,rows]of Object.entries(q.attributes)){
        const attr=p.getAttribute(name);for(let k=0;k<sourceCount;k++)assert.deepEqual(rows[k],attr.getElement(k,[]),'Original paint samples must be exact');
        // Preserve normalized source precision, rounding only new edge samples.
        const Source=attr.getArray().constructor,max=Source===Uint16Array?65535:Source===Uint8Array?255:1;
        attr.setArray(new Source(rows.flat().map(v=>max===1?v:Math.round(v*max))));
      }
    }
    changes.push({mesh,primitive,sourceVertices:sourceCount,vertices:q.positions.length,sourceTriangles:original.geometry[i].vertices===sourceCount?refined.meshes[i].sourceTriangles??q.indices.length/3:null,triangles:q.indices.length/3,addedVertices:subdivision.length,changedPositions,changedWeights,maxDisplacement,...q.metrics});
  }
  d.getRoot().listExtensionsUsed().find(e=>e.extensionName==='EXT_meshopt_compression')?.dispose();
  const quantized=quantizeModel(Buffer.from(await io.writeBinary(d))),out=await io.readBinary(quantized.bytes);
  out.createExtension(extensions.EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:extensions.EXTMeshoptCompression.EncoderMethod.QUANTIZE});
  const output=Buffer.from(await io.writeBinary(out)),checked=await io.readBinary(output);
  const checkedSignature=signature(checked);
  for(const key of ['textures','nodes','skins'])assert.deepEqual(checkedSignature[key],original[key],`${key} must be unchanged`);
  for(const [i,{p}]of primitives(checked).entries()){
    assert.equal(checkedSignature.geometry[i].contacts,original.geometry[i].contacts,'Hand and sole contacts must be exact');
    if(!refined.meshes[i].subdivision?.length)assert.deepEqual(checkedSignature.geometry[i],original.geometry[i],'Conservative meshes preserve topology and paint');
    else {
      const count=changes[i].sourceVertices;
      assert.equal(digest(values(p.getAttribute('POSITION')).slice(0,count).map(([x,y])=>[x,y])),original.geometry[i].identityPlane,'Identity plane is unchanged');
      assert.equal(checkedSignature.geometry[i].nonFacePositions,original.geometry[i].nonFacePositions,'Only the near face may be subdivided or sculpted');
      assert.equal(digest(p.getAttribute('TEXCOORD_0').getArray().subarray(0,count*2)),original.geometry[i].uv,'Original UV coordinates are unchanged');
      for(const [name,hash]of original.geometry[i].colours)assert.equal(digest(p.getAttribute(name).getArray().subarray(0,count*p.getAttribute(name).getElementSize())),hash);
    }
  }
  const materialState=async doc=>{const {json}=await io.writeJSON(doc);return {materials:json.materials,textures:json.textures,samplers:json.samplers};};
  assert.deepEqual(await materialState(checked),await materialState(await io.readBinary(bytes)),'No material/texture sampling changes');
  return {bytes:output,report:{version:1,id:refined.id,method:'Blender local near-face subdivision and bounded relief fairing, anatomical skin-weight refinement; original UV samples and KTX2 payloads retained',
    tool:'scripts/assets/refine-character.mjs',blenderTool:'scripts/assets/refine-character.py',blenderVersion:refined.blenderVersion,inputSha256:digest(bytes),sha256:digest(output),bytesBefore:bytes.length,bytes:output.length,gzipBytesBefore:gzipSync(bytes).length,gzipBytes:gzipSync(output).length,
    textures:original.textures,protectedGeometry:original.geometry,unchanged:{textures:true,originalUvs:true,originalColours:true,identityPlane:true,nonFacePositions:true,bindPose:true,nodeHierarchy:true,materials:true,handsAndSoles:true},meshes:changes}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [mode,input,output,idOrRefinement,report]=process.argv.slice(2),bytes=await readFile(input);
  if(mode==='export')await writeFile(output,JSON.stringify(await exportCharacter(bytes,idOrRefinement)));
  else if(mode==='import'){
    const result=await importCharacter(bytes,JSON.parse(await readFile(idOrRefinement,'utf8')));
    await writeFile(output,result.bytes);if(report)await writeFile(report,JSON.stringify(result.report,null,2)+'\n');
    console.log(JSON.stringify({id:result.report.id,bytesBefore:bytes.length,bytes:result.bytes.length,meshes:result.report.meshes}));
  }else throw Error('Use: refine-character.mjs export source.glb intermediate.json id | import source.glb output.glb refined.json report.json');
}

// Checks a processed model before it joins the game: a self-contained binary
// glTF 2.0 file of triangle meshes that the vendored three.js GLTFLoader can
// read without extra decoders, within a triangle, byte, texture and material
// budget, at a plausible size in metres. Development tool; no rendering.
//
//   node scripts/assets/check-model.mjs model.glb [--bytes N] [--triangles N]
//     [--texture N] [--materials N] [--min-height M] [--max-height M]
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as T from '../../vendor/three/three.module.js';
import {GLTFLoader} from '../../vendor/three/addons/loaders/GLTFLoader.js';

// The game loads models with a bare GLTFLoader: no Draco, meshopt or KTX2 decoder.
const NEEDS_DECODER=['KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_texture_basisu'];

/** Pixel size from a PNG, JPEG or WebP header; zero when unreadable. */
export function imageSize(b){
  if(b.length>24&&b.readUInt32BE(0)===0x89504e47)return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)};
  if(b.length>30&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'){
    const chunk=b.toString('ascii',12,16);
    if(chunk==='VP8 ')return {width:b.readUInt16LE(26)&0x3fff,height:b.readUInt16LE(28)&0x3fff};
    if(chunk==='VP8L'){const bits=b.readUInt32LE(21);return {width:(bits&0x3fff)+1,height:((bits>>14)&0x3fff)+1};}
    if(chunk==='VP8X')return {width:b.readUIntLE(24,3)+1,height:b.readUIntLE(27,3)+1};
  }
  if(b.length>4&&b[0]===0xff&&b[1]===0xd8){
    for(let i=2;i+9<b.length;){
      if(b[i]!==0xff){i++;continue;}
      const marker=b[i+1],length=b.readUInt16BE(i+2);
      if(marker>=0xc0&&marker<=0xcf&&![0xc4,0xc8,0xcc].includes(marker))return {width:b.readUInt16BE(i+7),height:b.readUInt16BE(i+5)};
      i+=2+length;
    }
  }
  return {width:0,height:0};
}

/** Reads a GLB and reports what the game would load. Throws on a malformed file. */
export async function inspectModel(bytes){
  const fail=message=>{throw new Error(message);};
  if(bytes.length<28||bytes.readUInt32LE(0)!==0x46546c67)fail('Not a binary glTF (GLB) file.');
  if(bytes.readUInt32LE(4)!==2)fail('Only glTF 2.0 is supported.');
  if(bytes.readUInt32LE(8)!==bytes.length)fail('The GLB length header does not match the file.');
  const jsonLength=bytes.readUInt32LE(12);
  if(bytes.readUInt32LE(16)!==0x4e4f534a)fail('The first GLB chunk is not JSON.');
  const doc=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8')),at=20+jsonLength;
  const binary=at+8<=bytes.length&&bytes.readUInt32LE(at+4)===0x004e4942?bytes.subarray(at+8,at+8+bytes.readUInt32LE(at)):Buffer.alloc(0);
  if(doc.asset?.version!=='2.0')fail('The asset is not glTF 2.0.');
  if((doc.buffers??[]).some(b=>b.uri!==undefined))fail('A buffer refers to an external file; the model must be self-contained.');
  const view=i=>{const v=doc.bufferViews[i];return binary.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);};
  const textures=(doc.images??[]).map((image,i)=>{
    if(image.uri!==undefined||image.bufferView===undefined)fail(`Image ${i} is not embedded.`);
    const data=view(image.bufferView);return {mimeType:image.mimeType,bytes:data.length,...imageSize(data)};
  });
  // Triangles drawn: every primitive, once for each node that places its mesh.
  const meshUse=new Map();for(const node of doc.nodes??[])if(node.mesh!==undefined)meshUse.set(node.mesh,(meshUse.get(node.mesh)??0)+1);
  let triangles=0,primitives=0;
  for(const [index,uses]of meshUse)for(const p of doc.meshes[index].primitives){
    if((p.mode??4)!==4)fail('Only triangle lists are supported.');
    const count=doc.accessors[p.indices??p.attributes.POSITION].count;triangles+=uses*count/3;primitives+=uses;
  }
  const loader=new GLTFLoader();
  // Node has no image decoder; geometry, skins and clips still load in full.
  // First in line, so it also stands in for the built-in WebP texture extension.
  loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));
  loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
  const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  gltf.scene.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(gltf.scene,true),size=box.getSize(new T.Vector3());
  gltf.scene.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])m.dispose();});
  return {bytes:bytes.length,triangles,primitives,meshes:meshUse.size,materials:(doc.materials??[]).length,textures,
    skins:(doc.skins??[]).length,animations:(doc.animations??[]).map(a=>a.name??''),
    morphTargets:Math.max(0,...(doc.meshes??[]).flatMap(m=>m.primitives.map(p=>p.targets?.length??0))),
    extensionsRequired:doc.extensionsRequired??[],
    sizeMetres:{width:+size.x.toFixed(4),height:+size.y.toFixed(4),depth:+size.z.toFixed(4)},
    base:+box.min.y.toFixed(4)};
}

/** Every way the model exceeds its budget; empty when it fits. */
export function budgetProblems(info,budget={}){
  const problems=[],{bytes,triangles,texture,materials,minHeight,maxHeight}=budget;
  if(bytes!==undefined&&info.bytes>bytes)problems.push(`${info.bytes} bytes exceeds ${bytes}.`);
  if(triangles!==undefined&&info.triangles>triangles)problems.push(`${info.triangles} triangles exceeds ${triangles}.`);
  if(texture!==undefined)for(const t of info.textures)if(Math.max(t.width,t.height)>texture)problems.push(`A ${t.width} × ${t.height} texture exceeds ${texture} pixels.`);
  if(materials!==undefined&&info.materials>materials)problems.push(`${info.materials} materials exceeds ${materials}.`);
  for(const name of info.extensionsRequired.filter(n=>NEEDS_DECODER.includes(n)))problems.push(`${name} needs a decoder the game does not ship.`);
  for(const t of info.textures)if(!t.width||!t.height)problems.push(`An embedded ${t.mimeType??'image'} has no readable size.`);
  const {width,height,depth}=info.sizeMetres;
  if(![width,height,depth].every(Number.isFinite)||height<=0)problems.push('The model has no finite size.');
  if(minHeight!==undefined&&height<minHeight)problems.push(`${height} m tall is below ${minHeight} m.`);
  if(maxHeight!==undefined&&height>maxHeight)problems.push(`${height} m tall is above ${maxHeight} m.`);
  return problems;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [file,...rest]=process.argv.slice(2),budget={},flags={'--bytes':'bytes','--triangles':'triangles','--texture':'texture','--materials':'materials','--min-height':'minHeight','--max-height':'maxHeight'};
  if(!file){console.error('Usage: node scripts/assets/check-model.mjs model.glb [--bytes N] [--triangles N] [--texture N] [--materials N] [--min-height M] [--max-height M]');process.exit(2);}
  for(let i=0;i<rest.length;i+=2){const key=flags[rest[i]],value=Number(rest[i+1]);if(!key||!Number.isFinite(value)){console.error(`Unknown or invalid option ${rest[i]}`);process.exit(2);}budget[key]=value;}
  const info=await inspectModel(await readFile(file)),problems=budgetProblems(info,budget);
  console.log(JSON.stringify({file,...info,budget,problems},null,2));
  process.exit(problems.length?1:0);
}

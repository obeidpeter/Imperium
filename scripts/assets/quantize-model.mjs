// Shrinks a GLB's vertex data with KHR_mesh_quantization, which the vendored
// three.js GLTFLoader reads natively (no decoder): normals become signed bytes,
// texture coordinates and colours normalized integers, and skin weights bytes
// that sum exactly to 255. Positions stay floats, so skinned meshes keep their
// inverse bind matrices unchanged. Textures, indices and joints are untouched.
//
//   node scripts/assets/quantize-model.mjs model.glb [out.glb]
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const FLOAT=5126,BYTE=5120,UNSIGNED_BYTE=5121,UNSIGNED_SHORT=5123;
const SIZE={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},COUNT={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};

function parse(bytes){
  if(bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2)throw Error('Not a glTF 2.0 binary file.');
  const jsonLength=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8')),at=20+jsonLength;
  const bin=at<bytes.length?bytes.subarray(at+8,at+8+bytes.readUInt32LE(at)):Buffer.alloc(0);
  return {doc,bin};
}
function read(doc,bin,index){
  const a=doc.accessors[index],view=doc.bufferViews[a.bufferView],n=COUNT[a.type],stride=view.byteStride??n*SIZE[a.componentType];
  if(a.componentType!==FLOAT||a.sparse)return null;
  const out=new Float32Array(a.count*n),base=(view.byteOffset??0)+(a.byteOffset??0);
  for(let i=0;i<a.count;i++)for(let k=0;k<n;k++)out[i*n+k]=bin.readFloatLE(base+i*stride+k*4);
  return out;
}
const quantizers={
  // Signed bytes, padded to four per vertex as glTF's attribute alignment requires.
  NORMAL:(v,count)=>{const out=Buffer.alloc(count*4);for(let i=0;i<count;i++){let x=v[i*3],y=v[i*3+1],z=v[i*3+2];const l=Math.hypot(x,y,z)||1;out.writeInt8(Math.round(x/l*127),i*4);out.writeInt8(Math.round(y/l*127),i*4+1);out.writeInt8(Math.round(z/l*127),i*4+2);}return {data:out,componentType:BYTE,byteStride:4};},
  TEXCOORD_0:(v,count)=>{if(v.some(x=>x<0||x>1))return null;const out=Buffer.alloc(count*4);for(let i=0;i<count*2;i++)out.writeUInt16LE(Math.round(v[i]*65535),i*2);return {data:out,componentType:UNSIGNED_SHORT};},
  COLOR_0:(v,count,n)=>{if(n!==4||v.some(x=>x<0||x>1))return null;const out=Buffer.alloc(count*4);for(let i=0;i<count*4;i++)out.writeUInt8(Math.round(v[i]*255),i);return {data:out,componentType:UNSIGNED_BYTE};},
  WEIGHTS_0:(v,count)=>{
    const out=Buffer.alloc(count*4);
    for(let i=0;i<count;i++){
      const w=[0,1,2,3].map(k=>Math.max(0,v[i*4+k])),sum=w.reduce((a,b)=>a+b,0)||1,q=w.map(x=>Math.floor(x/sum*255));
      // Give the rounding remainder to the largest weights so every vertex sums to exactly 255.
      let rest=255-q.reduce((a,b)=>a+b,0);const order=[0,1,2,3].sort((a,b)=>w[b]/sum*255-q[b]-(w[a]/sum*255-q[a]));for(const k of order){if(!rest)break;q[k]++;rest--;}
      q.forEach((x,k)=>out.writeUInt8(x,i*4+k));
    }
    return {data:out,componentType:UNSIGNED_BYTE};
  }
};

/** Returns a quantized copy of the GLB and what changed. */
export function quantizeModel(bytes){
  const {doc,bin}=parse(bytes),views=[],changed={};
  const keep=new Map();// old bufferView index -> new index
  const push=(data,extra={})=>{views.push({data,...extra});return views.length-1;};
  // Accessors replaced by new data get their own views; every other view is copied once.
  const replaced=new Map();
  for(const mesh of doc.meshes??[])for(const primitive of mesh.primitives){
    for(const [name,index]of Object.entries(primitive.attributes)){
      const make=quantizers[name];if(!make||replaced.has(index))continue;
      const a=doc.accessors[index],values=read(doc,bin,index);if(!values)continue;
      const q=make(values,a.count,COUNT[a.type]);if(!q)continue;
      replaced.set(index,q);changed[name]=(changed[name]??0)+a.count;
    }
  }
  for(const [index,a]of doc.accessors.entries()){
    if(replaced.has(index)){
      const q=replaced.get(index);a.bufferView=push(q.data,{target:34962,byteStride:q.byteStride});a.byteOffset=0;a.componentType=q.componentType;a.normalized=true;delete a.min;delete a.max;
    }else if(a.bufferView!==undefined){
      if(!keep.has(a.bufferView)){const v=doc.bufferViews[a.bufferView];keep.set(a.bufferView,push(bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength),{target:v.target,byteStride:v.byteStride}));}
      a.bufferView=keep.get(a.bufferView);
    }
  }
  for(const image of doc.images??[])if(image.bufferView!==undefined){
    if(!keep.has(image.bufferView)){const v=doc.bufferViews[image.bufferView];keep.set(image.bufferView,push(bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength)));}
    image.bufferView=keep.get(image.bufferView);
  }
  let offset=0;const parts=[];
  doc.bufferViews=views.map(({data,target,byteStride})=>{const pad=(4-offset%4)%4;if(pad){parts.push(Buffer.alloc(pad));offset+=pad;}const view={buffer:0,byteOffset:offset,byteLength:data.length,...(target?{target}:{}),...(byteStride?{byteStride}:{})};parts.push(data);offset+=data.length;return view;});
  const tail=(4-offset%4)%4;if(tail)parts.push(Buffer.alloc(tail));
  const body=Buffer.concat(parts);doc.buffers=[{byteLength:body.length}];
  if(Object.keys(changed).length){for(const list of ['extensionsUsed','extensionsRequired'])doc[list]=[...new Set([...(doc[list]??[]),'KHR_mesh_quantization'])];}
  const json=Buffer.from(JSON.stringify(doc),'utf8'),jsonPad=Buffer.alloc((4-json.length%4)%4,0x20),jsonChunk=Buffer.concat([json,jsonPad]);
  const header=Buffer.alloc(12),jsonHeader=Buffer.alloc(8),binHeader=Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+jsonChunk.length+8+body.length,8);
  jsonHeader.writeUInt32LE(jsonChunk.length,0);jsonHeader.writeUInt32LE(0x4e4f534a,4);binHeader.writeUInt32LE(body.length,0);binHeader.writeUInt32LE(0x004e4942,4);
  return {bytes:Buffer.concat([header,jsonHeader,jsonChunk,binHeader,body]),changed};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [input,output=input]=process.argv.slice(2);
  if(!input){console.error('Usage: node scripts/assets/quantize-model.mjs model.glb [out.glb]');process.exit(2);}
  const before=await readFile(input),{bytes,changed}=quantizeModel(before);
  await writeFile(output,bytes);
  console.log(JSON.stringify({input,output,bytesBefore:before.length,bytes:bytes.length,quantizedVertices:changed}));
}

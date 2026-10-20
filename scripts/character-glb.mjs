// Offline, self-contained glTF 2.0 handoff. Runtime shaders remain code-authored;
// exported PBR maps, skin joints, UVs and morph targets are editable in a DCC.
import {deflateSync} from 'node:zlib';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export async function characterSourceDigest(){
  const root=new URL('../src/showcase/',import.meta.url),names=(await readdir(root)).filter(n=>/^(actor-|actors\.|character-detail|paired-contact|skin-response)/.test(n)&&n.endsWith('.js')&&n!=='actor-replacement.js').sort(),hash=createHash('sha256');
  for(const name of names){hash.update(name);hash.update((await readFile(new URL(name,root),'utf8')).replaceAll('\r\n','\n'));}
  return hash.digest('hex');
}
const align=b=>Buffer.concat([b,Buffer.alloc((4-b.length%4)%4)]);
const crc=b=>{let n=0xffffffff;for(const c of b){n^=c;for(let k=0;k<8;k++)n=n&1?(n>>>1)^0xedb88320:n>>>1;}return (n^0xffffffff)>>>0;};
function png(data,width,height,{flip=false,roughness=false}={}){
  const scan=Buffer.alloc(height*(1+width*4));
  for(let y=0;y<height;y++){const row=y*(1+width*4);for(let x=0;x<width;x++){const src=((flip?height-1-y:y)*width+x)*4,dst=row+1+x*4;for(let c=0;c<4;c++)scan[dst+c]=roughness&&c===2?255:data[src+c];}}
  const chunk=(name,body)=>{const key=Buffer.from(name),b=Buffer.alloc(12+body.length);b.writeUInt32BE(body.length);key.copy(b,4);body.copy(b,8);b.writeUInt32BE(crc(Buffer.concat([key,body])),8+body.length);return b;};
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);
}
export function exportCharacterGlb(actor,{name='Imperium character',motions=['idle','walk','attack','block'],frames=25}={}){
  actor.update({motion:'idle',time:0,phase:0,resetPose:true,detailDistance:2});actor.group.updateMatrixWorld(true);
  const doc={asset:{version:'2.0',generator:'Imperium original character handoff v0.35',copyright:'Original Imperium costume and animation; MakeHuman CC0 anatomy. See art-source/characters/README.md.'},scene:0,scenes:[{name,nodes:[0]}],nodes:[],meshes:[],skins:[],materials:[],accessors:[],bufferViews:[],buffers:[],images:[],textures:[],samplers:[],animations:[],extensionsUsed:['KHR_texture_transform']};
  const chunks=[],nodes=[],index=new Map(),matIndex=new Map(),texIndex=new Map();let bytes=0;
  const view=b=>{const padded=align(b),i=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:bytes,byteLength:b.length});chunks.push(padded);bytes+=padded.length;return i;};
  function accessor(array,size,type){
    const componentType=array instanceof Float32Array?5126:array instanceof Uint32Array?5125:array instanceof Uint16Array?5123:5121;
    const d={bufferView:view(Buffer.from(array.buffer,array.byteOffset,array.byteLength)),componentType,count:array.length/size,type:type??({1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4',16:'MAT4'}[size])};
    if(componentType===5126){d.min=Array.from({length:size},(_,c)=>{let n=Infinity;for(let i=c;i<array.length;i+=size)n=Math.min(n,array[i]);return n;});d.max=Array.from({length:size},(_,c)=>{let n=-Infinity;for(let i=c;i<array.length;i+=size)n=Math.max(n,array[i]);return n;});}
    doc.accessors.push(d);return doc.accessors.length-1;
  }
  function texture(t,roughness=false){
    if(!t?.image?.data)return undefined;
    const key=t.uuid+(roughness?':roughness':'');let i=texIndex.get(key);
    if(i===undefined){
      const {data,width,height}=t.image,image=doc.images.length;doc.images.push({bufferView:view(png(data,width,height,{flip:t.flipY,roughness})),mimeType:'image/png',name:t.userData.source??'Original material field'});
      const sampler=doc.samplers.length;doc.samplers.push({magFilter:9729,minFilter:9987,wrapS:t.wrapS===1000?10497:33071,wrapT:t.wrapT===1000?10497:33071});
      i=doc.textures.length;doc.textures.push({source:image,sampler});texIndex.set(key,i);
    }
    return {index:i,extensions:{KHR_texture_transform:{offset:t.offset.toArray(),scale:t.repeat.toArray(),rotation:t.rotation}}};
  }
  function material(m){
    if(matIndex.has(m))return matIndex.get(m);
    const pbr={baseColorFactor:[...m.color.toArray(),m.opacity],metallicFactor:m.metalness??0,roughnessFactor:m.roughness??1};
    const map=texture(m.map),rough=texture(m.roughnessMap,true),normal=texture(m.normalMap);
    if(map)pbr.baseColorTexture=map;if(rough)pbr.metallicRoughnessTexture=rough;
    const d={name:m.name||m.userData.actorFinish||'Original surface',pbrMetallicRoughness:pbr,doubleSided:m.side===2};
    if(normal)d.normalTexture={...normal,scale:m.normalScale?.x??1};
    if(m.transparent)d.alphaMode='BLEND';else if(m.alphaTest){d.alphaMode='MASK';d.alphaCutoff=m.alphaTest;}
    const i=doc.materials.length;doc.materials.push(d);matIndex.set(m,i);return i;
  }
  actor.group.traverse(o=>{index.set(o,nodes.length);nodes.push(o);doc.nodes.push({name:o.name||`part-${nodes.length}`,translation:o.position.toArray(),rotation:o.quaternion.toArray(),scale:o.scale.toArray()});});
  for(const o of nodes){
    const d=doc.nodes[index.get(o)];if(o.children.length)d.children=o.children.map(c=>index.get(c));
    let visible=true;for(let p=o;p;p=p.parent)visible&&=p.visible;
    if(!o.isMesh||!visible)continue;
    const g=o.geometry,attributes={},names={position:'POSITION',normal:'NORMAL',uv:'TEXCOORD_0',color:'COLOR_0',skinIndex:'JOINTS_0',skinWeight:'WEIGHTS_0'};
    for(const [key,semantic]of Object.entries(names)){
      const a=g.attributes[key];if(!a)continue;
      const array=key==='skinIndex'?new Uint16Array(a.count*a.itemSize):new Float32Array(a.count*a.itemSize);
      for(let i=0;i<a.count;i++)for(let c=0;c<a.itemSize;c++)array[i*a.itemSize+c]=a.getComponent(i,c);
      attributes[semantic]=accessor(array,a.itemSize);
    }
    const targets=[];
    for(let i=0;i<(g.morphAttributes.position?.length??0);i++){
      const a=g.morphAttributes.position[i],base=g.attributes.position,values=new Float32Array(a.count*3);
      for(let j=0;j<a.count;j++)for(let c=0;c<3;c++)values[j*3+c]=a.getComponent(j,c)-(g.morphTargetsRelative?0:base.getComponent(j,c));
      targets.push({POSITION:accessor(values,3)});
    }
    const groups=Array.isArray(o.material)?g.groups:[{start:0,count:g.index?.count??g.attributes.position.count,materialIndex:0}],primitives=[];
    for(const group of groups){
      const primitive={attributes,material:material(Array.isArray(o.material)?o.material[group.materialIndex]:o.material),mode:4};
      if(g.index){const indices=new Uint32Array(group.count);for(let i=0;i<group.count;i++)indices[i]=g.index.getX(group.start+i);primitive.indices=accessor(indices,1);}
      if(targets.length)primitive.targets=targets;
      primitives.push(primitive);
    }
    d.mesh=doc.meshes.length;doc.meshes.push({name:o.name,primitives,...(targets.length?{weights:[...(o.morphTargetInfluences??targets.map(()=>0))],extras:{targetNames:Object.keys(o.morphTargetDictionary??{})}}:{})});
    if(o.isSkinnedMesh){
      const inverses=new Float32Array(o.skeleton.bones.length*16);
      o.skeleton.boneInverses.forEach((m,i)=>m.clone().multiply(o.bindMatrix).toArray(inverses,i*16));
      d.skin=doc.skins.length;doc.skins.push({joints:o.skeleton.bones.map(b=>{if(!index.has(b))throw Error('Joint outside character');return index.get(b);}),inverseBindMatrices:accessor(inverses,16,'MAT4')});
    }
  }
  const joints=nodes.filter(o=>o.isBone),duration={idle:4,walk:1.4,attack:1.023,block:.7};
  for(const motion of motions){
    const time=Float32Array.from({length:frames},(_,i)=>i/(frames-1)*(duration[motion]??1)),tracks=new Map(joints.map(b=>[b,{translation:[],rotation:[]}]));
    for(let i=0;i<frames;i++){
      actor.update({motion,time:time[i],phase:i/(frames-1),resetPose:true,detailDistance:2});
      for(const b of joints){const t=tracks.get(b);t.translation.push(...b.position.toArray());t.rotation.push(...b.quaternion.toArray());}
    }
    const animation={name:motion,samplers:[],channels:[]},input=accessor(time,1);
    for(const [bone,track]of tracks)for(const [path,values]of Object.entries(track)){
      const sampler=animation.samplers.length;animation.samplers.push({input,output:accessor(new Float32Array(values),path==='rotation'?4:3),interpolation:'LINEAR'});animation.channels.push({sampler,target:{node:index.get(bone),path}});
    }
    doc.animations.push(animation);
  }
  actor.update({motion:'idle',time:0,phase:0,resetPose:true,detailDistance:2});
  doc.buffers.push({byteLength:bytes});const json=Buffer.from(JSON.stringify(doc)),jsonPadded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),binary=Buffer.concat(chunks),header=Buffer.alloc(12),jhead=Buffer.alloc(8),bhead=Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+jsonPadded.length+binary.length,8);jhead.writeUInt32LE(jsonPadded.length);jhead.writeUInt32LE(0x4e4f534a,4);bhead.writeUInt32LE(binary.length);bhead.writeUInt32LE(0x004e4942,4);
  return {bytes:Buffer.concat([header,jhead,jsonPadded,bhead,binary]),document:doc};
}

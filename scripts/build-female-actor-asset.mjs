// Reproducible adaptation of the pinned CC0 MakeHuman base, not application code.
// Usage: node scripts/build-female-actor-asset.mjs /path/to/downloaded/CC0/sources
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import * as T from '../vendor/three/three.module.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const input=path.resolve(process.argv[2]??path.join(root,'../../work/v018/makehuman-female'));
const provenance=JSON.parse(await fs.readFile(path.join(root,'vendor/makehuman/female-source.json'),'utf8'));
const source={};for(const item of provenance.files){const bytes=await fs.readFile(path.join(input,item.file));if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error(`Unverified source: ${item.file}`);source[item.file]=bytes.toString('utf8');}
const vertices=[],uvs=[],faces=[],groups=new Map();let group='';
for(const line of source['base.obj'].split(/\r?\n/)){const [kind,...v]=line.trim().split(/\s+/);if(kind==='v')vertices.push(v.map(Number));if(kind==='vt')uvs.push(v.map(Number));if(kind==='g')group=v[0];if(kind==='f'){const face=v.map(s=>s.split('/').map(n=>Number(n)-1));if(group==='body')faces.push(face);const bucket=groups.get(group)??new Set();for(const [i]of face)bucket.add(i);groups.set(group,bucket);}}
for(const [file,weight]of [['caucasian-female-young.target',1]])for(const line of source[file].split(/\r?\n/)){if(!/^\d+\s/.test(line))continue;const[i,...delta]=line.trim().split(/\s+/).map(Number);for(let k=0;k<3;k++)vertices[i][k]+=delta[k]*weight;}
const joint=name=>{const indices=[...groups.get(`joint-${name}`)];return new T.Vector3(...indices.reduce((p,i)=>p.map((n,k)=>n+vertices[i][k]/indices.length),[0,0,0]));};
const bones=[['torso',[0,.91,0]],['head',[0,1.485,0]],['right-shoulder',[-.24,1.329,0]],['right-elbow',[-.24,1.029,0]],['left-shoulder',[.24,1.329,0]],['left-elbow',[.24,1.029,0]]];
const arms=[-1,1].map(side=>{const s=side<0?'r':'l',a=joint(`${s}-shoulder`),b=joint(`${s}-elbow`),c=joint(`${s}-hand`);return {side,a,b,c};});
function basis(a,b){const axis=b.clone().sub(a),length=axis.length();axis.normalize();const front=new T.Vector3(0,0,1).addScaledVector(axis,-axis.z).normalize(),right=new T.Vector3().crossVectors(axis,front).negate().normalize();return {axis,front,right,length};}
function mapSegment(v,a,b,length,origin){const f=basis(a,b),d=v.clone().sub(a);return new T.Vector3(origin[0]+d.dot(f.right)*.105,origin[1]-d.dot(f.axis)/f.length*length,origin[2]+d.dot(f.front)*.105);}
function armPoint(v,arm){const {a,b,c,side}=arm,ba=c.clone().sub(b),t=v.clone().sub(b).dot(ba)/ba.lengthSq(),blend=T.MathUtils.smoothstep(t,-.08,.12),upper=mapSegment(v,a,b,.30,[side*.24,1.329,0]),lower=mapSegment(v,b,c,.258,[side*.24,1.029,0]);return {point:upper.lerp(lower,blend),weight:blend};}
// Anchor the actual female target, whose eye height differs from the male source.
const eyeL=joint('l-eye'),eyeR=joint('r-eye'),eyeY=(eyeL.y+eyeR.y)/2,eyeZ=(eyeL.z+eyeR.z)/2,headScaleX=.072/Math.abs(eyeL.x-eyeR.x),neckCutoff=eyeY-1.4364;
const positions=[],uv=[],skinIndices=[],skinWeights=[],indices=[],lookup=new Map(),regions={head:0,rightArm:0,leftArm:0};
function map(v,region){if(region==='head')return {point:new T.Vector3(v[0]*headScaleX,1.485+(v[1]-eyeY)*.11717+.096,(v[2]-eyeZ)*.10+.066),joints:[1,0],weight:T.MathUtils.smoothstep(v[1],neckCutoff,neckCutoff+.42)};const arm=arms[region==='rightArm'?0:1],r=armPoint(new T.Vector3(...v),arm),j=region==='rightArm'?2:4;return {...r,joints:[j+1,j]};}
for(const face of faces){const center=face.reduce((a,[i])=>a.map((n,k)=>n+vertices[i][k]/face.length),[0,0,0]);let region=null;
  if(center[1]>neckCutoff&&Math.abs(center[0])<1.5)region='head';
  else if(Math.abs(center[0])>Math.abs(arms[0].a.x)+.75&&center[1]>arms[0].c.y-.3){const arm=arms[center[0]<0?0:1],v=new T.Vector3(...center),axis=arm.c.clone().sub(arm.b),t=v.sub(arm.b).dot(axis)/axis.lengthSq();if(t<.98)region=center[0]<0?'rightArm':'leftArm';}
  if(!region)continue;const out=[];
  for(const [vi,ti]of face){const key=`${region}/${vi}/${ti}`;if(!lookup.has(key)){const {point,joints,weight}=map(vertices[vi],region);lookup.set(key,positions.length/3);positions.push(...point.toArray().map(n=>Math.round(n*1e6)/1e6));uv.push(...(uvs[ti]??[0,0]));skinIndices.push(...joints,0,0);const w=Math.round(weight*255);skinWeights.push(w,255-w,0,0);}out.push(lookup.get(key));}
  for(let i=1;i<out.length-1;i++){indices.push(out[0],out[i],out[i+1]);regions[region]++;}
}
const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
const normal=Int16Array.from(g.attributes.normal.array,n=>Math.round(n*32767)),packedUV=Uint16Array.from(uv,n=>Math.round(T.MathUtils.clamp(n,0,1)*65535));
const buffers=[],views=[],accessors=[];let offset=0;
function accessor(array,type,componentType,normalized=false,bounds=false){while(offset%4){buffers.push(Buffer.alloc(1));offset++;}const data=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=views.length;views.push({buffer:0,byteOffset:offset,byteLength:data.length});buffers.push(data);offset+=data.length;const size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[type],a={bufferView:view,componentType,count:array.length/size,type};if(normalized)a.normalized=true;if(bounds){a.min=Array.from({length:size},(_,k)=>Math.min(...Array.from(array).filter((_,i)=>i%size===k)));a.max=Array.from({length:size},(_,k)=>Math.max(...Array.from(array).filter((_,i)=>i%size===k)));}accessors.push(a);return accessors.length-1;}
const attributes={POSITION:accessor(Float32Array.from(positions),'VEC3',5126,false,true),NORMAL:accessor(normal,'VEC3',5122,true),TEXCOORD_0:accessor(packedUV,'VEC2',5123,true),JOINTS_0:accessor(Uint8Array.from(skinIndices),'VEC4',5121),WEIGHTS_0:accessor(Uint8Array.from(skinWeights),'VEC4',5121,true)};
const index=accessor(Uint16Array.from(indices),'SCALAR',5123),inverse=Float32Array.from(bones.flatMap(([,p])=>new T.Matrix4().makeTranslation(...p.map(n=>-n)).elements)),inverseBindMatrices=accessor(inverse,'MAT4',5126);
while(offset%4){buffers.push(Buffer.alloc(1));offset++;}
const gltf={asset:{version:'2.0',generator:'Imperium CC0 female anatomy adaptation v018',copyright:'MakeHuman Community / Data Collection AB / Joel Palmius / Jonas Hauquier — CC0'},extensionsUsed:['KHR_mesh_quantization'],extensionsRequired:['KHR_mesh_quantization'],scene:0,scenes:[{nodes:[0,...bones.map((_,i)=>i+1)]}],nodes:[{name:'imported-human-anatomy',mesh:0,skin:0},...bones.map(([name,translation])=>({name,translation}))],meshes:[{name:'CC0 authored female head and arms',primitives:[{attributes,indices:index,material:0}]}],materials:[{name:'skin',pbrMetallicRoughness:{baseColorFactor:[.52,.31,.20,1],metallicFactor:0,roughnessFactor:.8}}],skins:[{joints:bones.map((_,i)=>i+1),inverseBindMatrices}],buffers:[{byteLength:offset}],bufferViews:views,accessors,extras:{source:provenance.commit,sex:'female',sourceEyes:[eyeL.toArray(),eyeR.toArray()],regions,adaptation:'Female-young target at full weight, fitted using female eye and arm joints; no male or muscle target. Head and exposed arm topology only. Hidden body, helper geometry, application code and source textures excluded.',bindNames:bones.map(([name])=>name),eyeCenters:[[-.036,.096,.066],[.036,.096,.066]]}};
let json=Buffer.from(JSON.stringify(gltf));while(json.length%4)json=Buffer.concat([json,Buffer.from(' ')]);const binary=Buffer.concat(buffers),header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+json.length+8+binary.length,8);jh.writeUInt32LE(json.length,0);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(binary.length,0);bh.writeUInt32LE(0x004e4942,4);
const output=Buffer.concat([header,jh,json,bh,binary]);await fs.mkdir(path.join(root,'assets/models'),{recursive:true});await fs.writeFile(path.join(root,'assets/models/roman-woman-v018.glb'),output);
console.log(JSON.stringify({vertices:positions.length/3,triangles:indices.length/3,regions,bytes:output.length,gzip:gzipSync(output,{level:9}).length,sha256:createHash('sha256').update(output).digest('hex')}));

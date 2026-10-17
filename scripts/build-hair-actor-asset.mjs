// Usage: node scripts/build-hair-actor-asset.mjs <pinned-base-and-targets> <CC0-short04>
// Downloads are deliberately separate; every source is hash checked first.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import * as T from '../vendor/three/three.module.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),baseDir=path.resolve(process.argv[2]??path.join(root,'../../work/v017/makehuman')),hairDir=path.resolve(process.argv[3]??path.join(root,'../../work/v018/cc0-hair-short04'));
const baseRecord=JSON.parse(await fs.readFile(path.join(root,'vendor/makehuman/source.json'),'utf8')),hairRecord=JSON.parse(await fs.readFile(path.join(root,'vendor/makehuman/hair-source.json'),'utf8')),sources={};
for(const [dir,files]of [[baseDir,baseRecord.files],[hairDir,hairRecord.files]])for(const item of files){const bytes=await fs.readFile(path.join(dir,item.file));if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error('Unverified source: '+item.file);sources[item.file]=bytes.toString('utf8');}
const base=sources['base.obj'].split(/\r?\n/).filter(l=>l.startsWith('v ')).map(l=>l.split(/\s+/).slice(1).map(Number));
for(const [file,weight]of [['caucasian-male-young.target',1],['universal-male-young-maxmuscle-averageweight.target',.35]])for(const line of sources[file].split(/\r?\n/)){if(!/^\d+\s/.test(line))continue;const[i,...delta]=line.trim().split(/\s+/).map(Number);for(let k=0;k<3;k++)base[i][k]+=delta[k]*weight;}
const scale=[1,1,1],bindings=[];let parsing=false;
for(const line of sources['short04.mhclo'].split(/\r?\n/)){
  const words=line.trim().split(/\s+/),axis=['x_scale','y_scale','z_scale'].indexOf(words[0]);
  if(axis>=0){const[a,b,nominal]=words.slice(1).map(Number);scale[axis]=Math.abs(base[a][axis]-base[b][axis])/nominal;}
  if(words[0]==='verts'){parsing=true;continue;}
  if(parsing&&/^\d/.test(words[0])){const a=words.map(Number);if(a.length!==9)throw Error('Unexpected hair binding');bindings.push(a);}
}
const sourceVertices=[],uvs=[],faces=[];
for(const line of sources['short04.obj'].split(/\r?\n/)){const [kind,...v]=line.trim().split(/\s+/);if(kind==='v')sourceVertices.push(v.map(Number));if(kind==='vt')uvs.push(v.map(Number));if(kind==='f')faces.push(v.map(s=>s.split('/').slice(0,2).map(n=>Number(n)-1)));}
if(bindings.length!==sourceVertices.length)throw Error('Incomplete source binding');
const fitted=bindings.map(a=>{const v=[0,1,2].map(k=>base[a[0]][k]*a[3]+base[a[1]][k]*a[4]+base[a[2]][k]*a[5]+a[6+k]*scale[k]);return [v[0]*.12281,1.485+(v[1]-8.2164)*.11717+.096,v[2]*.10-.064435];});
const p=[],uv=[],indices=[],lookup=new Map();
for(const face of faces){const out=[];for(const [vi,ti]of face){const key=vi+'/'+ti;if(!lookup.has(key)){lookup.set(key,p.length/3);p.push(...fitted[vi]);uv.push(...uvs[ti]);}out.push(lookup.get(key));}for(let j=1;j<out.length-1;j++)indices.push(out[0],out[j],out[j+1]);}
const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setIndex(indices);geometry.computeVertexNormals();
const count=p.length/3,min=[0,1,2].map(k=>Math.min(...p.filter((_,i)=>i%3===k))),max=[0,1,2].map(k=>Math.max(...p.filter((_,i)=>i%3===k)));
// IHR1: 40-byte LE header, then grouped u16 XYZ, i8 normals, u16 UV, u16 indices.
const output=Buffer.alloc(40+count*13+indices.length*2);output.write('IHR1');output.writeUInt32LE(count,4);output.writeUInt32LE(indices.length,8);for(let k=0;k<3;k++){output.writeFloatLE(min[k],12+k*4);output.writeFloatLE(max[k],24+k*4);}output.writeUInt32LE(0,36);
let offset=40;for(let i=0;i<p.length;i++){const k=i%3;output.writeUInt16LE(Math.round((p[i]-min[k])/(max[k]-min[k])*65535),offset);offset+=2;}
for(const n of geometry.attributes.normal.array)output.writeInt8(Math.round(T.MathUtils.clamp(n,-1,1)*127),offset++);
for(const value of uv){output.writeUInt16LE(Math.round(T.MathUtils.clamp(value,0,1)*65535),offset);offset+=2;}for(const i of indices){output.writeUInt16LE(i,offset);offset+=2;}
const target=path.join(root,'assets/models/short-hair-v018.bin');await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,output);geometry.dispose();
console.log(JSON.stringify({path:'assets/models/short-hair-v018.bin',vertices:count,triangles:indices.length/3,scale,bounds:{min,max},bytes:output.length,gzipLevel9Bytes:gzipSync(output,{level:9}).length,sha256:createHash('sha256').update(output).digest('hex')}));

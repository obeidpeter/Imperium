import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {fitActorNeck} from '../src/showcase/actor-neck.js';

const models=[];
for(const name of ['roman-human-v017.glb','roman-woman-v018.glb']){const bytes=await readFile(new URL('../assets/models/'+name,import.meta.url)),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');models.push({name,source:gltf.scene.getObjectByName('imported-human-anatomy').geometry});}
function boundaryIndices(g){
  const p=g.attributes.position,bones=g.attributes.skinIndex,keys=[],edges=new Map();
  for(let i=0;i<p.count;i++)keys[i]=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');
  const index=g.index.array;for(let i=0;i<index.length;i+=3){const tri=[index[i],index[i+1],index[i+2]];if(!tri.every(v=>bones.getX(v)===1))continue;for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],key=[keys[a],keys[b]].sort().join('|'),old=edges.get(key);edges.set(key,{a,b,count:(old?.count??0)+1});}}
  const found=new Set();for(const {a,b,count}of edges.values())if(count===1){found.add(keys[a]);found.add(keys[b]);}return keys.flatMap((key,i)=>found.has(key)?[i]:[]);
}

test('Both imported neck rims fit one closed collar ellipse below y1.40 while retaining original UVs, topology, bindings and upper head',()=>{
  for(const {name,source}of models){
    const original=source.attributes.position.array.slice(),g=fitActorNeck(source,source.clone()),p=g.attributes.position,boundary=boundaryIndices(source);
    assert.ok(boundary.length>=50);
    for(const i of boundary){assert.ok(Math.abs(p.getY(i)-1.394)<1e-6,`${name}: no jagged open edge remains above the collar`);assert.ok(Math.abs(Math.hypot(p.getX(i)/.069,p.getZ(i)/.060)-1)<2e-6);}
    for(let i=0;i<p.count;i++)if(source.attributes.position.getY(i)>=1.462||source.attributes.skinIndex.getX(i)!==1)for(let k=0;k<3;k++)assert.equal(p.getComponent(i,k),source.attributes.position.getComponent(i,k));
    for(const name of ['uv','skinIndex','skinWeight'])assert.deepEqual(g.attributes[name].array,source.attributes[name].array);assert.deepEqual(g.index.array,source.index.array);assert.deepEqual(source.attributes.position.array,original);
    const again=fitActorNeck(source,source.clone());assert.deepEqual(again.attributes.position.array,p.array);again.dispose();g.dispose();
  }
});

test('The fitted neck remains finite with no collapsed triangles or inverted visible lower-neck faces',()=>{
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3(),outward=new T.Vector3();
  for(const {name,source}of models){const g=fitActorNeck(source,source.clone()),p=g.attributes.position,index=g.index.array;let checked=0;
    for(const value of p.array)assert.ok(Number.isFinite(value));
    for(let i=0;i<index.length;i+=3){const ids=[index[i],index[i+1],index[i+2]];if(!ids.every(v=>source.attributes.skinIndex.getX(v)===1&&p.getY(v)<1.442))continue;
      a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);outward.copy(a).add(b).add(c);outward.y=0;normal.subVectors(b,a).cross(c.sub(a));
      assert.ok(normal.lengthSq()>1e-15,`${name}: no collapsed fitted triangle`);
      // A few source triangles join three crop-rim vertices. Fitting the rim
      // makes those tiny underside faces horizontal, entirely below the collar.
      if(!ids.every(v=>p.getY(v)<1.394001))assert.ok(normal.dot(outward)>0,`${name}: visible neck faces retain their outside`);checked++;
    }
    assert.ok(checked>50);g.dispose();
  }
});

test('Actual fitted triangles cover the full neck circumference above the garment without an extra untextured bridge',()=>{
  for(const {name,source}of models){const g=fitActorNeck(source,source.clone()),material=new T.MeshBasicMaterial({side:T.DoubleSide}),mesh=new T.Mesh(g,material),ray=new T.Raycaster();mesh.updateMatrixWorld(true);
    for(const y of [1.400,1.405,1.415,1.430,1.440])for(let step=0;step<24;step++){
      const angle=step/24*Math.PI*2,outward=new T.Vector3(Math.sin(angle),0,Math.cos(angle));ray.set(outward.clone().multiplyScalar(.25).setY(y),outward.clone().negate());ray.far=.25;
      const hits=ray.intersectObject(mesh,false);assert.ok(hits.length>0,`${name} y=${y} angle=${step}: actual neck surface covers the collar seam`);
    }
    g.dispose();material.dispose();
  }
});

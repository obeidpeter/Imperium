import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import {batchStaticEnvironment} from '../src/showcase/environment-batching.js';

function vertices(root){
  root.updateWorldMatrix(true,true);const result=[],p=new THREE.Vector3(),matrix=new THREE.Matrix4();
  root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,a=g.attributes.position,count=g.index?.count??a.count;
    for(let instance=0;instance<(o.isInstancedMesh?o.count:1);instance++){
      if(o.isInstancedMesh){o.getMatrixAt(instance,matrix);matrix.premultiply(o.matrixWorld);}else matrix.copy(o.matrixWorld);
      for(let i=0;i<count;i++){p.fromBufferAttribute(a,g.index?g.index.getX(i):i).applyMatrix4(matrix);result.push(p.toArray().map(n=>Math.round(n*1e5)).join(','));}
    }
  });return result.sort();
}

test('Static batching preserves nested world-space surfaces and mirrored winding without changing original geometry',()=>{
  const scene=new THREE.Scene(),root=new THREE.Group();root.position.set(7,2,-4);root.rotation.y=.7;scene.add(root);
  const material=new THREE.MeshStandardMaterial(),geometries=new Set(),originals=[];
  for(let i=0;i<5;i++){
    const parent=new THREE.Group();parent.rotation.set(.1*i,.4*i,.03);parent.position.set(i*2,i*.2,-i);root.add(parent);
    const geometry=i%2?new THREE.BoxGeometry(1,2,1):new THREE.CylinderGeometry(.4,.7,2,8);originals.push([geometry,Float32Array.from(geometry.attributes.position.array)]);
    const mesh=new THREE.Mesh(geometry,material);mesh.scale.set(i===4?-1.2:1.2,.8,1.3);mesh.position.set(.2,.6,.5);mesh.castShadow=false;mesh.receiveShadow=true;parent.add(mesh);
  }
  const before=vertices(root),stats=batchStaticEnvironment(root,{geometries});
  assert.equal(stats.before,5);assert.equal(stats.after,1);assert.equal(stats.mergedSources,5);assert.deepEqual(vertices(root),before);
  const batch=root.getObjectByName('merged static environment');assert.equal(batch.castShadow,false);assert.equal(batch.receiveShadow,true);assert.ok(geometries.has(batch.geometry));
  const position=batch.geometry.attributes.position,normal=batch.geometry.attributes.normal,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),n=new THREE.Vector3();
  for(let i=0;i<position.count;i+=3){a.fromBufferAttribute(position,i);b.fromBufferAttribute(position,i+1).sub(a);c.fromBufferAttribute(position,i+2).sub(a);n.fromBufferAttribute(normal,i);assert.ok(b.cross(c).dot(n)>-1e-7,'Baked reflected surfaces retain outward winding');}
  for(const [geometry,positions]of originals)assert.deepEqual(geometry.attributes.position.array,positions,'Original source geometry is not baked in place');
  for(const geometry of geometries)geometry.dispose();for(const [geometry]of originals)geometry.dispose();material.dispose();
});

test('Repeated props keep instancing; shadow flags, transparent sorting and live cloth remain separate',()=>{
  const root=new THREE.Group(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial(),transparent=material.clone();transparent.transparent=true;
  const meshes=[];for(let i=0;i<9;i++){const mesh=new THREE.Mesh(geometry,material);mesh.position.x=i;mesh.castShadow=i<6;mesh.receiveShadow=true;root.add(mesh);meshes.push(mesh);}
  const cloth=new THREE.Mesh(geometry,material);cloth.userData.windCloth=true;root.add(cloth);
  const water=new THREE.Mesh(geometry,transparent);root.add(water);
  const hidden=new THREE.Group();hidden.visible=false;root.add(hidden);const hiddenMesh=new THREE.Mesh(geometry,material);hidden.add(hiddenMesh);
  const stats=batchStaticEnvironment(root,{geometries:new Set()});
  assert.equal(stats.instancedSources,9);assert.equal(stats.instancedBatches,2);assert.equal(stats.after,5);
  const batches=root.children.filter(o=>o.isInstancedMesh);assert.deepEqual(batches.map(o=>[o.castShadow,o.count]),[[true,6],[false,3]]);
  assert.equal(cloth.parent,root);assert.equal(water.parent,root);assert.equal(hiddenMesh.parent,hidden);
  const before=cloth.geometry.attributes.position.getY(0);cloth.geometry.attributes.position.setY(0,before+.2);assert.equal(root.children.includes(cloth),true);
  geometry.dispose();material.dispose();transparent.dispose();
});

test('Baked static geometry retains transformed normals, UVs and vertex attributes and disposes exactly once',()=>{
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial({vertexColors:true}),owned=new Set(),source=[];
  for(let i=0;i<2;i++){
    const geometry=new THREE.PlaneGeometry(2,2);geometry.setAttribute('color',new THREE.Float32BufferAttribute(Array(geometry.attributes.position.count).fill([.2,.6,.8]).flat(),3));
    const mesh=new THREE.Mesh(geometry,material);mesh.rotation.x=i?Math.PI/2:0;mesh.position.x=i*4;source.push(geometry);root.add(mesh);
  }
  batchStaticEnvironment(root,{geometries:owned});const mesh=root.getObjectByName('merged static environment'),a=mesh.geometry.attributes;
  assert.equal(a.position.count,12);assert.equal(a.normal.count,12);assert.equal(a.uv.count,12);assert.equal(a.color.count,12);
  assert.ok(Math.abs(a.normal.getZ(0)-1)<1e-7);assert.ok(Math.abs(a.normal.getY(6)+1)<1e-7);assert.ok(Math.abs(a.color.getY(7)-.6)<1e-6);
  let count=0;mesh.geometry.addEventListener('dispose',()=>count++);for(const g of owned)g.dispose();assert.equal(count,1);
  for(const g of source)g.dispose();material.dispose();
});

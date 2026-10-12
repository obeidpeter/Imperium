import * as THREE from '../../vendor/three/three.module.js';

// Static presentation only. Keep transparent surfaces independently sortable,
// animated geometry live, and existing foliage instances in their GPU batches.
// The caller owns all geometries, including the merged buffers returned here.
export function batchStaticEnvironment(root,{geometries,exclude=new Set()}={}){
  root.updateWorldMatrix(true,true);
  const inverse=root.matrixWorld.clone().invert(),groups=new Map();let before=0;
  root.traverse(o=>{
    if(o.isMesh)before++;
    if(!o.isMesh||o.isInstancedMesh||o.isSkinnedMesh||Array.isArray(o.material)||exclude.has(o)
      ||o.material.transparent||o.userData.windCloth||o.userData.environmentDynamic
      ||o.geometry.morphAttributes.position?.length||o.geometry.drawRange.count!==Infinity)return;
    // Vertex layouts and all per-object rendering flags must agree. Material
    // identity preserves maps, shader hooks, clipping and texture transforms.
    for(let ancestor=o.parent;ancestor&&ancestor!==root;ancestor=ancestor.parent)if(!ancestor.visible)return;
    const attributes=Object.keys(o.geometry.attributes).sort();
    if(attributes.some(k=>o.geometry.attributes[k].isInterleavedBufferAttribute))return;
    const signature=attributes.map(k=>{
      const a=o.geometry.attributes[k];return `${k}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`;
    }).join('|');
    const key=[o.material.uuid,signature,o.castShadow,o.receiveShadow,o.renderOrder,o.layers.mask,o.visible].join(':');
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);
  });
  let mergedSources=0,mergedBatches=0,instancedSources=0,instancedBatches=0;
  const configure=(batch,source,parts)=>{
    batch.castShadow=source.castShadow;batch.receiveShadow=source.receiveShadow;batch.renderOrder=source.renderOrder;
    batch.layers.mask=source.layers.mask;batch.visible=source.visible;
    batch.userData.environmentBatch=true;batch.userData.sourceNames=[...new Set(parts.map(p=>p.name).filter(Boolean))];
    for(const part of parts)part.removeFromParent();root.add(batch);
  };
  for(const parts of groups.values()){
    // Repeated boxes/columns remain instanced rather than copying their vertex
    // buffers. Unique shapes sharing a material are merged in the next pass.
    const repeated=new Map();for(const part of parts){const key=part.geometry.uuid;if(!repeated.has(key))repeated.set(key,[]);repeated.get(key).push(part);}
    const remaining=[];
    for(const instances of repeated.values()){
      if(instances.length<3||instances.some(o=>inverse.clone().multiply(o.matrixWorld).determinant()<0)){remaining.push(...instances);continue;}
      const first=instances[0],batch=new THREE.InstancedMesh(first.geometry,first.material,instances.length);batch.name='static repeated environment';
      for(let i=0;i<instances.length;i++)batch.setMatrixAt(i,inverse.clone().multiply(instances[i].matrixWorld));
      batch.instanceMatrix.needsUpdate=true;batch.computeBoundingBox();batch.computeBoundingSphere();configure(batch,first,instances);
      instancedSources+=instances.length;instancedBatches++;
    }
    if(remaining.length<2)continue;
    const source=remaining[0],attributes=Object.keys(source.geometry.attributes),arrays=Object.fromEntries(attributes.map(k=>[k,[]]));
    for(const part of remaining){
      const matrix=inverse.clone().multiply(part.matrixWorld),copy=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();copy.applyMatrix4(matrix);
      // Mirrored transforms require winding correction after baking, because
      // their original renderer-side front-face flip is no longer present.
      if(matrix.determinant()<0)for(const a of Object.values(copy.attributes))for(let i=0;i<a.count;i+=3)for(let k=0;k<a.itemSize;k++){
        const first=(i+1)*a.itemSize+k,second=(i+2)*a.itemSize+k,value=a.array[first];a.array[first]=a.array[second];a.array[second]=value;
      }
      for(const key of attributes)arrays[key].push(copy.attributes[key].array);copy.dispose();
    }
    const geometry=new THREE.BufferGeometry();
    for(const key of attributes){const original=source.geometry.attributes[key],data=new original.array.constructor(arrays[key].reduce((n,a)=>n+a.length,0));let offset=0;
      for(const array of arrays[key]){data.set(array,offset);offset+=array.length;}geometry.setAttribute(key,new THREE.BufferAttribute(data,original.itemSize,original.normalized));
    }
    geometry.computeBoundingBox();geometry.computeBoundingSphere();geometries?.add(geometry);
    const batch=new THREE.Mesh(geometry,source.material);batch.name='merged static environment';configure(batch,source,remaining);mergedSources+=remaining.length;mergedBatches++;
  }
  let after=0;root.traverse(o=>{if(o.isMesh)after++;});
  return Object.freeze({before,after,savedDrawObjects:before-after,mergedSources,mergedBatches,instancedSources,instancedBatches});
}

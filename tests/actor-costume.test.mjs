import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {costumeGeometry,mountActorCostume} from '../src/showcase/actor-costume.js';

function topology(g){
  const edges=new Map(),neighbors=new Map(),index=g.index.array;
  for(let i=0;i<index.length;i+=3)for(let k=0;k<3;k++){
    const a=index[i+k],b=index[i+(k+1)%3],key=`${Math.min(a,b)}:${Math.max(a,b)}`;
    const edge=edges.get(key)??[];edge.push([a,b]);edges.set(key,edge);
    if(!neighbors.has(a))neighbors.set(a,new Set());neighbors.get(a).add(b);
    if(!neighbors.has(b))neighbors.set(b,new Set());neighbors.get(b).add(a);
  }
  const visited=new Set(),visit=start=>{const pending=[start];while(pending.length){const v=pending.pop();if(visited.has(v))continue;visited.add(v);pending.push(...neighbors.get(v));}};
  let components=0;for(const i of neighbors.keys())if(!visited.has(i)){components++;visit(i);}
  const boundary=new Map();for(const edge of edges.values())if(edge.length===1){const[a,b]=edge[0];if(!boundary.has(a))boundary.set(a,[]);if(!boundary.has(b))boundary.set(b,[]);boundary.get(a).push(b);boundary.get(b).push(a);}
  let openings=0;const seen=new Set();for(const v of boundary.keys())if(!seen.has(v)){openings++;const pending=[v];while(pending.length){const i=pending.pop();if(seen.has(i))continue;seen.add(i);pending.push(...boundary.get(i));}}
  return {edges,boundary,components,openings,referenced:visited.size};
}

function rig(){
  const group=new T.Group(),hips=new T.Bone(),torso=new T.Bone(),right=new T.Bone(),left=new T.Bone();
  hips.name='hips';hips.position.y=.91;torso.name='torso';right.name='right-shoulder';left.name='left-shoulder';right.position.set(-.24,.419,0);left.position.set(.24,.419,0);
  group.add(hips);hips.add(torso);torso.add(right,left);group.updateMatrixWorld(true);
  return {group,hips,torso,right,left};
}
function install(kind='tunic',quality='balanced'){
  const r=rig(),resources={geometries:new Set(),materials:new Set(),skeletons:new Set()},cloth=new T.MeshStandardMaterial({color:0xbaa986}),armor=new T.MeshStandardMaterial({color:0x91958a,metalness:.5});
  const kit=Object.freeze({armored:kind!=='tunic',armor:kind});
  const costume=mountActorCostume(r.group,{kit,cloth,armor,quality,...resources});
  return {...r,...costume,resources,cloth,armor,dispose(){for(const set of Object.values(resources))for(const value of set)value.dispose();cloth.dispose();armor.dispose();}};
}

test('Tunic and armor are one sewn surface with only neck, waist and two cuff openings',()=>{
  for(const kind of ['tunic','mail','scale'])for(const detail of ['near','overview'])for(const quality of ['performance','balanced','high']){
    const g=costumeGeometry({kind,detail,quality}),t=topology(g);
    assert.equal(t.components,1,`${kind}/${detail}/${quality} has connected sleeve seams`);
    assert.equal(t.referenced,g.attributes.position.count,'No unused construction points remain.');
    assert.equal(t.openings,4,'Sleeves are sewn into the torso; their roots are not extra holes.');
    assert.ok([...t.boundary.values()].every(neighbors=>neighbors.length===2),'Every opening is a simple closed loop.');
    assert.ok([...t.edges.values()].every(edge=>edge.length<=2),'No non-manifold junctions.');
    assert.ok([...t.edges.values()].every(edge=>edge.length!==2||edge[0][0]===edge[1][1]),'Adjacent faces agree about their outside.');
    assert.equal(g.attributes.position.count-t.edges.size+g.index.count/3,-2,'A genus-zero garment with four openings.');
    g.dispose();
  }
});

test('Sewn folds, rolled edges and armored silhouette are finite, nondegenerate and bounded',()=>{
  const measurements={};
  for(const kind of ['tunic','mail','scale']){
    const g=costumeGeometry({kind}),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,index=g.index.array;
    const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),cross=new T.Vector3();
    for(let i=0;i<index.length;i+=3){a.fromBufferAttribute(p,index[i]);b.fromBufferAttribute(p,index[i+1]);c.fromBufferAttribute(p,index[i+2]);cross.crossVectors(b.sub(a),c.sub(a));assert.ok(cross.lengthSq()>1e-15,'No zero-area triangles hide broken sleeve stitching.');}
    for(let i=0;i<p.count;i++){assert.ok([p.getX(i),p.getY(i),p.getZ(i),uv.getX(i),uv.getY(i)].every(Number.isFinite));assert.ok(Math.abs(new T.Vector3().fromBufferAttribute(n,i).length()-1)<1e-5);}
    const size=g.boundingBox.getSize(new T.Vector3());assert.ok(size.x>.62&&size.x<.70);assert.ok(size.z>.30&&size.z<.40);
    measurements[kind]={depth:size.z,hem:g.boundingBox.min.y,triangles:index.length/3};
    assert.ok(index.length/3<=3100,'Geometry has an explicit per-shell budget, independent of actor count.');g.dispose();
  }
  assert.ok(measurements.mail.depth>measurements.tunic.depth+.025,'Armor changes volume, not just the surface color.');
  assert.ok(measurements.mail.hem<measurements.tunic.hem-.14,'Armor has a weighted protective hem below the belt.');
});

test('Actual sleeve vertices follow both torso and arm and cannot split when the shoulder rises',()=>{
  const a=install(),skin=a.nearMeshes[0],g=skin.geometry,weights=g.attributes.skinWeight,ids=g.attributes.skinIndex,p=g.attributes.position;
  const seam=g.userData.seamLoops[1],sample=seam.find(i=>weights.getZ(i)>.2&&weights.getZ(i)<.6);
  assert.notEqual(sample,undefined);assert.equal(ids.getZ(sample),2,'Right sleeve uses the existing right shoulder.');
  const initial=skin.getVertexPosition(sample,new T.Vector3());a.right.rotation.set(-1.1,0,.15);a.group.updateMatrixWorld(true);skin.skeleton.update();
  const bent=skin.getVertexPosition(sample,new T.Vector3());assert.ok(initial.distanceTo(bent)>.02,'A real rendered seam vertex responds to the joint.');
  const source=new T.Vector3().fromBufferAttribute(p,sample).applyMatrix4(skin.bindMatrix),rigid=source.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(a.right.matrixWorld,skin.skeleton.boneInverses[2])).applyMatrix4(skin.bindMatrixInverse);
  assert.ok(bent.distanceTo(rigid)>.02,'The seam flexes with the torso rather than swinging as a separate cap.');
  for(const rotation of [-1.7,-.8,0,.4]){
    a.right.rotation.x=rotation;a.left.rotation.x=-rotation*.7;a.group.updateMatrixWorld(true);skin.skeleton.update();
    for(const mesh of [...a.nearMeshes,...a.farMeshes])for(let i=0;i<mesh.geometry.attributes.position.count;i+=11){const v=mesh.getVertexPosition(i,new T.Vector3());assert.ok(v.toArray().every(Number.isFinite));assert.ok(v.length()<2,'Pose remains in the declared picking bound.');}
  }
  a.right.rotation.set(0,0,0);a.left.rotation.set(0,0,0);a.group.updateMatrixWorld(true);skin.skeleton.update();assert.ok(initial.distanceTo(skin.getVertexPosition(sample,new T.Vector3()))<1e-7);a.dispose();
});

test('Costume LOD is one draw, retains its outline and disposes through the existing owner exactly once',()=>{
  for(const kind of ['tunic','mail','scale']){
    const a=install(kind),near=a.nearMeshes[0],far=a.farMeshes[0];assert.equal(a.nearMeshes.length,1);assert.equal(a.farMeshes.length,1);assert.equal(near.visible,true);assert.equal(far.visible,false);
    assert.equal(near.skeleton,far.skeleton);assert.equal(near.skeleton.bones[0],a.torso);assert.equal(near.skeleton.bones[2],a.right);
    assert.ok(a.stats.farTriangles<a.stats.nearTriangles*.3,'Overview reduces actual submitted geometry.');
    near.geometry.computeBoundingBox();far.geometry.computeBoundingBox();assert.ok(near.geometry.boundingBox.min.distanceTo(far.geometry.boundingBox.min)<.01);assert.ok(near.geometry.boundingBox.max.distanceTo(far.geometry.boundingBox.max)<.01);
    let disposed=0;for(const set of [a.resources.geometries,a.resources.materials])for(const item of set)item.addEventListener('dispose',()=>disposed++);
    near.skeleton.computeBoneTexture();near.skeleton.boneTexture.addEventListener('dispose',()=>disposed++);a.dispose();assert.equal(disposed,5,'Two geometries, two cloned materials and one shared bone texture.');
  }
});

test('Geometry construction is deterministic and material/rig inputs remain unchanged',()=>{
  for(const kind of ['tunic','mail','scale']){
    const first=costumeGeometry({kind}),second=costumeGeometry({kind});for(const key of Object.keys(first.attributes))assert.deepEqual(first.attributes[key].array,second.attributes[key].array);assert.deepEqual(first.index.array,second.index.array);first.dispose();second.dispose();
    const a=install(kind),joints=a.group.children[0];assert.equal(joints.children.length,1);assert.equal(a.cloth.vertexColors,false);assert.equal(a.armor.vertexColors,false);assert.equal(a.right.position.x,-.24);assert.equal(a.left.position.x,.24);a.dispose();
  }
  assert.throws(()=>costumeGeometry({kind:'plate'}),/Unknown costume/);assert.throws(()=>mountActorCostume(new T.Group()),/existing torso/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {bindActorSurfaces} from '../src/showcase/actor-skin.js';
import {createActor} from '../src/showcase/actors.js';

// The triangles as drawn: each corner's position in the group's space.
const corners=(geometry,matrix=new T.Matrix4())=>{
  const flat=geometry.index?geometry.toNonIndexed():geometry,p=flat.attributes.position,v=new T.Vector3(),out=[];
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);out.push(v.x,v.y,v.z);}
  return out;
};

test('bound figure surfaces draw the same triangles, in order, from each part’s shared vertices', () => {
  const group=new T.Group(),bone=new T.Bone();bone.name='head';group.add(bone);
  const material=new T.MeshStandardMaterial(),geometries=new Set(),materials=new Set([material]),skeletons=new Set();
  const parts=[new T.SphereGeometry(.1,12,8),new T.BoxGeometry(.2,.1,.1),new T.PlaneGeometry(.1,.1).toNonIndexed()].map((geometry,i)=>{
    geometries.add(geometry);const mesh=new T.Mesh(geometry,material);mesh.position.set(i*.3,.2,0);mesh.rotation.y=i*.4;bone.add(mesh);return mesh;});
  group.updateMatrixWorld(true);
  const expected=parts.flatMap(mesh=>corners(mesh.geometry,mesh.matrixWorld)),vertices=parts.reduce((n,m)=>n+m.geometry.attributes.position.count,0);
  const [skin]=bindActorSurfaces(group,parts,{geometries,materials,skeletons});
  assert.ok(skin.isSkinnedMesh);
  assert.equal(skin.geometry.attributes.position.count,vertices,'Each part brings its own vertices, shared as before');
  assert.equal(skin.geometry.index.count,expected.length/3,'and every one of its triangles');
  const drawn=corners(skin.geometry);assert.equal(drawn.length,expected.length);
  drawn.forEach((value,i)=>assert.ok(Math.abs(value-expected[i])<1e-6,`corner value ${i}`));
  for(const s of skeletons)s.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
});

test('a figure’s weighted surfaces keep their shared vertices: fewer to store, upload and skin than corners drawn', () => {
  for(const quality of ['performance','balanced']){
    const actor=createActor({id:'hero',name:'Aurelius Marcellus',side:'player',role:'infantry'},{chapter:5,rank:'Centurio',quality});
    let surfaces=0,vertices=0,cornersDrawn=0;
    actor.group.traverse(o=>{if(!o.isSkinnedMesh||!/weighted-character-surface/.test(o.name))return;surfaces++;
      assert.ok(o.geometry.index,`${o.name} is indexed`);vertices+=o.geometry.attributes.position.count;cornersDrawn+=o.geometry.index.count;});
    assert.ok(surfaces>=4,quality);
    assert.ok(vertices<cornersDrawn*.6,`${quality}: ${vertices} vertices for ${cornersDrawn} corners`);
    actor.dispose();
  }
});

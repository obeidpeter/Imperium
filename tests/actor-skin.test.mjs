import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {createActor} from '../src/showcase/actors.js';

const skins=a=>{const result=[];a.group.traverse(o=>{if(o.isSkinnedMesh)result.push(o);});return result;};
const vertex=(mesh,i)=>mesh.getVertexPosition(i,new T.Vector3());
const signature=a=>skins(a).map(m=>Array.from(m.skeleton.boneMatrices));

test('Human, civic and mounted surfaces are genuinely weighted across joints, not renamed rigid meshes',()=>{
  for(const [unit,chapter] of [[{id:'hero',side:'player'},1],[{id:'hero',side:'player',role:'speaker'},11],[{id:'horse',name:'Persian cavalry',role:'cavalry',side:'enemy'},6]]){
    const a=createActor(Object.freeze(unit),{chapter}),meshes=skins(a);assert.ok(meshes.length>1);
    let blended=0,shoulders=0,cloth=0,horseNeck=0;
    for(const mesh of meshes){
      assert.ok(mesh.skeleton.bones.every(b=>b.isBone));
      const index=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
      assert.equal(index.count,mesh.geometry.attributes.position.count);
      for(let i=0;i<weights.count;i++){
        const sum=weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i);assert.ok(Math.abs(sum-1)<1e-6);
        for(let j=0;j<4;j++)assert.ok(index.getComponent(i,j)<mesh.skeleton.bones.length);
        if(weights.getY(i)>0&&weights.getY(i)<1){blended++;const names=[index.getX(i),index.getY(i)].map(n=>mesh.skeleton.bones[n].name).join('/');if(names.includes('shoulder'))shoulders++;if(/fold|edge/.test(names))cloth++;if(names.includes('horse-neck'))horseNeck++;}
      }
    }
    assert.ok(blended>200&&shoulders>20&&cloth>20,'Connected limb and cloth seams have nontrivial blend regions.');
    if(unit.role==='cavalry')assert.ok(horseNeck>20,'Horse neck blends into its body.');a.dispose();
  }
});

test('Weighted sleeve vertices bend continuously instead of rotating as one disconnected shoulder block',()=>{
  const a=createActor({id:'hero',side:'player'},{chapter:1}),mesh=skins(a).find(m=>m.userData.costume&&!m.userData.overview);
  assert.ok(mesh,'The actual connected tunic supplies the rendered sleeve seam.');
  const ids=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight;
  const i=mesh.geometry.userData.seamLoops.flat().find(i=>w.getZ(i)>.2&&w.getZ(i)<.8&&mesh.skeleton.bones[ids.getZ(i)].name==='right-shoulder');
  assert.notEqual(i,undefined);const before=vertex(mesh,i);
  a.update({motion:'attack',phase:.25,resetPose:true});const bent=vertex(mesh,i);
  assert.ok(before.distanceTo(bent)>.005,'Actual rendered skin vertex responds to the action.');
  const source=new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(mesh.bindMatrix),expected=new T.Vector3(),matrix=new T.Matrix4();
  for(let slot=0;slot<4;slot++){const bone=ids.getComponent(i,slot);matrix.multiplyMatrices(mesh.skeleton.bones[bone].matrixWorld,mesh.skeleton.boneInverses[bone]);expected.addScaledVector(source.clone().applyMatrix4(matrix),w.getComponent(i,slot));}
  expected.applyMatrix4(mesh.bindMatrixInverse);const shoulder=ids.getZ(i),rigid=source.clone().applyMatrix4(matrix.multiplyMatrices(mesh.skeleton.bones[shoulder].matrixWorld,mesh.skeleton.boneInverses[shoulder])).applyMatrix4(mesh.bindMatrixInverse);
  assert.ok(bent.distanceTo(rigid)>.001,'The seam is blended, not rigidly assigned to one joint.');assert.ok(bent.distanceTo(expected)<1e-6);
  a.update({motion:'idle',resetPose:true});assert.ok(vertex(mesh,i).distanceTo(before)<1e-7);a.dispose();
});

test('Batched trousers retain their dark tint beside the separately weighted connected ivory tunic',()=>{
  const a=createActor({id:'hero',side:'player'},{chapter:1}),legs=[],torso=[];
  for(const mesh of skins(a).filter(m=>!m.userData.overview&&m.material.map)){
    const ids=mesh.geometry.attributes.skinIndex,color=mesh.geometry.attributes.color,tint=mesh.material.color;
    for(let i=0;i<ids.count;i++){const name=mesh.skeleton.bones[ids.getX(i)].name,value=(tint.r*color.getX(i)+tint.g*color.getY(i)+tint.b*color.getZ(i))/3;if(name==='right-thigh')legs.push(value);if(mesh.userData.costume&&name==='torso')torso.push(value);}
  }
  assert.ok(legs.length>100&&torso.length>100,'Test samples actual trouser and connected tunic vertices.');const mean=v=>v.reduce((a,b)=>a+b,0)/v.length;
  assert.ok(mean(legs)<mean(torso)*.8,'Material color multiplied by batched vertex color preserves the visible distinction.');a.dispose();
});

test('Cloth has bounded secondary deformation and exact seek/reduced-motion behavior without moving contacts',()=>{
  const a=createActor({id:'hero',side:'player'},{chapter:7}),input={motion:'walk',phase:.31,locomotionDistance:.5,time:2,resetPose:true};
  a.update(input);const walking=signature(a),edge=a.group.getObjectByName('command-cloak-edge');assert.ok(Math.abs(edge.rotation.z)>.001);
  a.update({motion:'attack',phase:.37});a.update(input);assert.deepEqual(signature(a),walking,'Explicit seek has no retained spring momentum.');
  a.update({...input,reducedMotion:true});assert.equal(edge.rotation.z,0);
  const anchor=a.contacts.weapon.getWorldPosition(new T.Vector3());a.update({...input,reducedMotion:false});assert.ok(a.contacts.weapon.getWorldPosition(new T.Vector3()).distanceTo(anchor)<1e-8,'Cloth cannot move held equipment.');
  for(const motion of ['idle','walk','run','attack','throw','brace','block','hit','speak','withdrawn'])for(const phase of [0,.2,.5,1]){a.update({motion,phase,time:phase,resetPose:true});for(const rigName of ['command-cloak-edge','tunic-hem-edge']){const rig=a.group.getObjectByName(rigName);assert.ok(rig.rotation.toArray().slice(0,3).every(n=>Number.isFinite(n)&&Math.abs(n)<.2));}}
  a.dispose();
});

test('Skinned surfaces remain bounded and pickable after placement; GPU skeleton resources dispose exactly once',()=>{
  const a=createActor({id:'horse',name:'Palmyrene cavalry',role:'cavalry',side:'enemy'},{chapter:9}),meshes=skins(a);a.group.position.set(7,2,-4);
  for(const phase of [0,.2,.37,.7,1]){
    a.update({motion:'attack',phase,direction:.4,aimHeight:3.2,resetPose:true});
    for(const mesh of meshes)for(let i=0;i<mesh.geometry.attributes.position.count;i+=91){const v=vertex(mesh,i);assert.ok(v.toArray().every(Number.isFinite));assert.ok(v.distanceTo(new T.Vector3(0,1.25,0))<3,'Declared conservative picking bound covers deformed vertices.');}
  }
  a.update({motion:'idle',direction:0,resetPose:true});const ray=new T.Raycaster(new T.Vector3(7,3.2,2),new T.Vector3(0,0,-1));assert.ok(ray.intersectObjects(meshes.filter(m=>m.visible),false).length);
  const skeletons=new Set(meshes.map(m=>m.skeleton));let disposed=0;for(const s of skeletons){s.computeBoneTexture();s.boneTexture.addEventListener('dispose',()=>disposed++);}a.dispose();assert.equal(disposed,skeletons.size);a.dispose();assert.equal(disposed,skeletons.size);
});

test('Contact footprints expose grounded human soles or horse hooves, never a mounted rider boot',()=>{
  for(const mounted of [false,true]){
    const a=createActor(mounted?{id:'horse',name:'Persian cavalry',role:'cavalry',side:'enemy'}:{id:'hero',side:'player'},{chapter:6}),ground=(x,z)=>x*.07+z*.1;
    a.group.position.set(2,ground(2,3),3);a.update({motion:'idle',direction:.7,groundHeight:ground,resetPose:true});
    assert.equal(a.contacts.feet.length,mounted?4:2);assert.equal(new Set(a.contacts.feet).size,a.contacts.feet.length);
    for(const foot of a.contacts.feet){assert.equal(foot.name,mounted?'horse-fetlock':'ankle');const world=foot.getWorldPosition(new T.Vector3());assert.ok(Math.abs(world.y-a.contacts.footClearance-ground(world.x,world.z))<1e-6);}
    a.dispose();
  }
});

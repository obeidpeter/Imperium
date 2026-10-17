import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {handGeometry,bootGeometry} from '../src/showcase/actor-extremities.js';
import {createActor} from '../src/showcase/actors.js';

function validGeometry(g){
  const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,color=g.attributes.color,a=new T.Vector3(),b=a.clone(),c=a.clone();
  assert.equal(uv.count,p.count);assert.equal(color.count,p.count);
  for(let i=0;i<p.count;i++){
    assert.ok([p.getX(i),p.getY(i),p.getZ(i),uv.getX(i),uv.getY(i),color.getX(i),color.getY(i),color.getZ(i)].every(Number.isFinite));
    assert.ok(Math.abs(new T.Vector3().fromBufferAttribute(n,i).length()-1)<1e-5,'All visible vertices have usable normals.');
  }
  for(let i=0;i<g.index.count;i+=3){a.fromBufferAttribute(p,g.index.getX(i));b.fromBufferAttribute(p,g.index.getX(i+1));c.fromBufferAttribute(p,g.index.getX(i+2));assert.ok(b.sub(a).cross(c.sub(a)).lengthSq()>1e-16,'No collapsed stitches, nails or end caps.');}
}

test('Hands have finite tapered volumes and relaxed/open versus cupped silhouettes at both quality levels',()=>{
  for(const side of [-1,1])for(const quality of ['performance','balanced']){
    const closed=handGeometry({side,quality}),open=handGeometry({side,quality,open:true});validGeometry(closed);validGeometry(open);
    assert.ok(open.boundingBox.min.y<closed.boundingBox.min.y-.03,'Open fingers visibly extend beyond the curled grip.');
    assert.ok(open.boundingBox.getSize(new T.Vector3()).x>.09,'Palm and opposing thumb have adult hand breadth.');
    assert.ok(closed.boundingBox.max.z>.05,'Fingers wrap forward, instead of lying as flat parallel rods.');
    assert.ok(open.index.count/3<=2250);assert.ok(closed.index.count/3<=2250);closed.dispose();open.dispose();
  }
});

test('Cupped hands leave the actual held-weapon axis clear without changing the contact frame',()=>{
  const material=new T.MeshBasicMaterial({side:T.DoubleSide});
  for(const side of [-1,1])for(const detail of ['near','overview']){
    const g=handGeometry({side,detail}),mesh=new T.Mesh(g,material);mesh.updateMatrixWorld(true);
    // Existing spatha/javelin grip runs through x=0,z=.018 in the hand frame.
    // Sampling its center and ±5 mm avoids a false pass from an accidental gap.
    for(const x of [-.005,0,.005]){
      const ray=new T.Raycaster(new T.Vector3(x,-.02,.018),new T.Vector3(0,-1,0),0,.05);
      assert.equal(ray.intersectObject(mesh,false).length,0,'The handle does not pass through the palm or curled fingers.');
    }
    const visible=new T.Raycaster(new T.Vector3(.008,-.075,.2),new T.Vector3(0,0,-1),0,.3).intersectObject(mesh,false);
    assert.ok(visible.length>=2,'Actual geometry encloses the fingers, rather than leaving a missing front surface.');g.dispose();
  }material.dispose();
});

test('Boot sole retains the grounding plane while the upper has distinct heel, instep and toe volume',()=>{
  for(const quality of ['performance','balanced'])for(const side of [-1,1]){
    const {upper,sole}=bootGeometry({quality,side});validGeometry(upper);validGeometry(sole);
    assert.ok(Math.abs(sole.boundingBox.min.y+.07)<1e-8);assert.ok(upper.boundingBox.min.y>sole.boundingBox.max.y,'Leather remains above the sole.');
    assert.ok(upper.boundingBox.max.y>.14&&upper.boundingBox.max.y<.15,'Ankle height stays compatible with the calf.');
    const p=upper.attributes.position,instep=[],toe=[];
    for(let i=0;i<p.count;i++){if(p.getZ(i)>.01&&p.getZ(i)<.05)instep.push(p.getY(i));if(p.getZ(i)>.15)toe.push(p.getY(i));}
    assert.ok(Math.max(...instep)>Math.max(...toe)+.04,'Shaped instep is higher than the toe box.');
    const material=new T.MeshBasicMaterial(),mesh=new T.Mesh(sole,material);mesh.updateMatrixWorld(true);
    const top=new T.Raycaster(new T.Vector3(0,.1,.1),new T.Vector3(0,-1,0)).intersectObject(mesh,false),bottom=new T.Raycaster(new T.Vector3(0,-.2,.1),new T.Vector3(0,1,0)).intersectObject(mesh,false);
    assert.ok(top.length&&bottom.length,'Both sole surfaces have correct outward winding.');
    assert.ok(Math.abs(bottom[0].point.y+.07)<1e-8,'Ray-tested contact equals the existing foot clearance.');
    assert.ok(upper.index.count/3<=1600&&sole.index.count/3<=64);upper.dispose();sole.dispose();material.dispose();
  }
});

test('Performance quality reduces geometry without changing grips or visible silhouette, and construction is repeatable',()=>{
  for(const make of [quality=>handGeometry({quality}),quality=>{const boot=bootGeometry({quality});boot.sole.dispose();return boot.upper;}]){
    const fine=make('balanced'),simple=make('performance'),again=make('balanced');
    assert.ok(simple.index.count<fine.index.count*.5);assert.ok(fine.boundingBox.min.distanceTo(simple.boundingBox.min)<.003);assert.ok(fine.boundingBox.max.distanceTo(simple.boundingBox.max)<.003);
    for(const key of Object.keys(fine.attributes))assert.deepEqual(fine.attributes[key].array,again.attributes[key].array);
    fine.dispose();simple.dispose();again.dispose();
  }
});

test('Overview hands and boots have explicit small budgets while preserving their silhouette and grounded sole',()=>{
  for(const side of [-1,1])for(const open of [false,true]){
    const near=handGeometry({side,open}),far=handGeometry({side,open,detail:'overview'});validGeometry(far);
    assert.ok(far.index.count/3<=350);assert.ok(near.boundingBox.min.distanceTo(far.boundingBox.min)<.005);assert.ok(near.boundingBox.max.distanceTo(far.boundingBox.max)<.005);near.dispose();far.dispose();
  }
  for(const side of [-1,1]){
    const near=bootGeometry({side}),far=bootGeometry({side,detail:'overview'});validGeometry(far.upper);validGeometry(far.sole);
    assert.ok((far.upper.index.count+far.sole.index.count)/3<=250);
    assert.ok(near.upper.boundingBox.min.distanceTo(far.upper.boundingBox.min)<.003);assert.ok(near.upper.boundingBox.max.distanceTo(far.upper.boundingBox.max)<.003);
    assert.ok(Math.abs(far.sole.boundingBox.min.y+.07)<1e-8);for(const g of [...Object.values(near),...Object.values(far)])g.dispose();
  }
});

test('Actual actor overview uses the reduced hand and boot meshes, retaining contact positions and tints',()=>{
  const a=createActor({id:'hero',side:'player'},{chapter:1});a.group.position.y=2;a.update({motion:'idle',detailDistance:5,resetPose:true});
  const feet=a.contacts.feet.map(b=>b.getWorldPosition(new T.Vector3()));a.update({motion:'idle',detailDistance:30,resetPose:true});
  let hands=0,boots=0;const soleWorld=new T.Vector3();
  a.group.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.visible||!mesh.userData.overview)return;
    const g=mesh.geometry;
    if(mesh.isSkinnedMesh){const indices=g.attributes.skinIndex;for(let i=0;i<indices.count;i++)if(mesh.skeleton.bones[indices.getX(i)].name==='hand')hands++;}
    else if(mesh.parent.name==='ankle'){
      boots++;assert.equal(g.attributes.position.count/3,244);let min=Infinity;
      for(let i=0;i<g.attributes.position.count;i++){soleWorld.fromBufferAttribute(g.attributes.position,i).applyMatrix4(mesh.matrixWorld);min=Math.min(min,soleWorld.y);}
      assert.ok(Math.abs(min-2)<1e-7,'The visible overview sole reaches the same flat ground.');
      const c=g.attributes.color;let minTint=Infinity,maxTint=-Infinity;for(let i=0;i<c.count;i++){const value=c.getX(i)+c.getY(i)+c.getZ(i);minTint=Math.min(minTint,value);maxTint=Math.max(maxTint,value);}assert.ok(maxTint-minTint>.02,'Dark sole and leather upper colors survive merging.');
    }
  });
  assert.equal(hands,2*340*3,'Actual submitted hand vertices use overview geometry.');assert.equal(boots,2);
  a.contacts.feet.forEach((b,i)=>assert.ok(b.getWorldPosition(new T.Vector3()).distanceTo(feet[i])<1e-8));a.dispose();
});

test('Temporary overview source geometry is consumed and disposed once before actor lifetime disposal',()=>{
  const dispose=T.BufferGeometry.prototype.dispose,counts=new Map();
  T.BufferGeometry.prototype.dispose=function(){if(this.userData.detail==='overview'&&['sculpted-adult-hand','fitted-leather-boot','stitched-boot-sole'].includes(this.userData.originalModel))counts.set(this,(counts.get(this)??0)+1);return dispose.call(this);};
  let actor;
  try{actor=createActor({id:'hero',side:'player'},{chapter:1});assert.equal(counts.size,6);assert.ok([...counts.values()].every(n=>n===1));actor.dispose();assert.ok([...counts.values()].every(n=>n===1),'Consumed source meshes are removed from the long-lived disposal set.');}
  finally{actor?.dispose();T.BufferGeometry.prototype.dispose=dispose;}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {actorIdentity} from '../src/showcase/actor-identity.js';
import {createHeadGeometry,createHairGeometry,headPoint,faceSurfacePoint} from '../src/showcase/actor-head.js';
import {garmentGeometry,smoothSection} from '../src/showcase/actor-geometry.js';
import {sculptActorGeometry} from '../src/showcase/actor-anatomy.js';
import {createActor,actorKit} from '../src/showcase/actors.js';

const identity=name=>actorIdentity({id:name==='hero'?'hero':name,name},actorKit({id:name,name,side:'ally'},{chapter:6}));
test('Face and hair remain outward-facing with seamless normals and an anatomical tapered jaw in both quality levels',()=>{
  for(const name of ['hero','Varro','Lucan','Aelia','Sabinus'])for(const detail of [true,false]){
    const id=identity(name),jaw=headPoint(Math.PI/2,-.025,id)[0],temple=headPoint(Math.PI/2,.13,id)[0];
    assert.ok(jaw<temple*.8,'Jaw tapers into chin instead of forming a square skull.');
    for(const geometry of [createHeadGeometry(id,{detail}),createHairGeometry(id,{detail})]){
      const p=geometry.attributes.position,n=geometry.attributes.normal;let count=0;
      for(let i=0;i<p.count;i++)if(p.getY(i)>.025&&p.getY(i)<.16){assert.ok(p.getX(i)*n.getX(i)+p.getZ(i)*n.getZ(i)>0,'Face/hair front-side normals point outwards.');count++;}
      assert.ok(count>40);assert.ok([...n.array].every(Number.isFinite));geometry.dispose();
    }
    // Independent ray intersection checks the fitted facial details against
    // actual rendered triangles, not just their analytic construction helper.
    const g=createHeadGeometry(id,{detail}),m=new T.Mesh(g,new T.MeshBasicMaterial());m.updateMatrixWorld();
    for(const [x,y]of [[.036,.096],[-.036,.096],[0,.003]]){
      const fit=faceSurfacePoint(x,y,id,.003),hit=new T.Raycaster(new T.Vector3(x,y,.3),new T.Vector3(0,0,-1)).intersectObject(m)[0];
      assert.ok(hit,'Frontal face triangles are visible with front-side culling.');
      assert.ok(Math.abs(fit[2]-hit.point.z)<.008,'Eyes and lips fit each character skin without floating apart.');
    }
    g.dispose();m.material.dispose();
  }
});

test('Tailored section interpolation stays bounded, has smooth slopes, and closes sculpted front normals',()=>{
  const rings=[[0,.17,.12],[.1,.18,.13],[.3,.23,.16],[.43,.20,.13],[.49,.066,.06]];
  for(let i=0;i<rings.length-1;i++)for(let q=0;q<=20;q++)for(const c of [1,2]){
    const value=smoothSection(rings,rings[i][0]+(rings[i+1][0]-rings[i][0])*q/20,c);
    assert.ok(value>=Math.min(rings[i][c],rings[i+1][c])-1e-8&&value<=Math.max(rings[i][c],rings[i+1][c])+1e-8,'No spline overshoot or inverted garment section.');
  }
  const eps=1e-5;
  for(const [y]of rings.slice(1,-1)){
    const left=(smoothSection(rings,y,1)-smoothSection(rings,y-eps,1))/eps,right=(smoothSection(rings,y+eps,1)-smoothSection(rings,y,1))/eps;
    assert.ok(Math.abs(left-right)<.002,'Shoulder/waist contour has no angular slope break.');
  }
  const g=sculptActorGeometry(garmentGeometry(rings,{segments:20}),'torso',identity('hero')),n=g.attributes.normal;
  for(let row=0;row<g.userData.radialRows;row++){const first=row*21,last=first+20;assert.ok(new T.Vector3().fromBufferAttribute(n,first).distanceTo(new T.Vector3().fromBufferAttribute(n,last))<1e-7,'Sculpting does not reintroduce a lit front seam.');}
  g.dispose();
});

test('Neck-guard arc keeps the face open instead of forming a metal or mail mask',()=>{
  const g=garmentGeometry([[.073,.121,.115,-.013],[.094,.113,.103,-.012]],{segments:20,from:.85,to:Math.PI*2-.85}),m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.updateMatrixWorld();
  assert.equal(new T.Raycaster(new T.Vector3(0,.084,.3),new T.Vector3(0,0,-1),0,.25).intersectObject(m).length,0,'Front eye/cheek opening is not capped by a full radial band.');
  assert.ok(new T.Raycaster(new T.Vector3(.2,.084,0),new T.Vector3(-1,0,0),0,.15).intersectObject(m).length,'The side guard remains real protective geometry.');g.dispose();m.material.dispose();
});

test('Revised human surfaces remain a finite skinned silhouette through extreme legal poses with invariant contacts',()=>{
  for(const [unit,chapter]of [[{id:'hero',side:'player'},1],[{id:'aelia',name:'Aelia',side:'neutral',role:'speaker'},11],[{id:'horse',name:'Persian cavalry',role:'cavalry',side:'enemy'},6]]){
    const a=createActor(unit,{chapter}),contacts=a.contacts.feet.map(f=>f.name);
    for(const motion of ['idle','attack','throw','block','walk','speak'])for(const phase of [0,.37,.5,1]){
      a.update({motion,phase,resetPose:true});a.group.traverseVisible(m=>{
        if(!m.isSkinnedMesh)return;
        for(let i=0;i<m.geometry.attributes.position.count;i+=193){const p=m.getVertexPosition(i,new T.Vector3());assert.ok(p.toArray().every(Number.isFinite));assert.ok(p.length()<3.7);}
      });assert.deepEqual(a.contacts.feet.map(f=>f.name),contacts);
    }
    a.dispose();
  }
});

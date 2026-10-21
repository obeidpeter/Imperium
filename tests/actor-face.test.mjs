import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/addons/loaders/GLTFLoader.js';
import {createActorAssetCatalog,ACTOR_MODEL_URL,FEMALE_ACTOR_MODEL_URL} from '../src/showcase/actor-assets.js';
import {actorIdentity} from '../src/showcase/actor-identity.js';
import {actorKit} from '../src/showcase/actor-kit.js';
import {actorEye,actorBrow,actorExpression} from '../src/showcase/actor-face.js';
import {createActor} from '../src/showcase/actors.js';

const bytes=await Promise.all([ACTOR_MODEL_URL,FEMALE_ACTOR_MODEL_URL].map(path=>readFile(new URL('../'+path,import.meta.url))));
const parse=i=>new GLTFLoader().parseAsync(bytes[i].buffer.slice(bytes[i].byteOffset,bytes[i].byteOffset+bytes[i].byteLength),'');
const catalog=createActorAssetCatalog({maleLoad:()=>parse(0),femaleLoad:()=>parse(1)});
const units=[{id:'hero'},{id:'aelia',name:'Aelia',role:'voter'}],identity=u=>actorIdentity(u,actorKit(u));
await Promise.all(units.map(u=>catalog.warm(identity(u))));
const release=model=>{for(const key of ['geometry','hair','beard'])model[key]?.dispose();};

test('Indexed face lookup returns the exact frontmost depth and UV of exhaustive triangle sampling',()=>{
  for(const unit of units){const model=catalog.anatomy(identity(unit)),g=model.geometry,p=g.attributes.position,tex=g.attributes.uv,ix=g.index.array;
    for(let row=0;row<20;row++)for(let col=0;col<20;col++){
      const x=-.12+col*.012,y=-.04+row*.012,py=y+1.485;let front=-Infinity,uv=null;
      for(let i=0;i<ix.length;i+=3){const ia=ix[i],ib=ix[i+1],ic=ix[i+2];if(g.attributes.skinIndex.getX(ia)!==1)continue;const ax=p.getX(ia),ay=p.getY(ia),bx=p.getX(ib),by=p.getY(ib),cx=p.getX(ic),cy=p.getY(ic),den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<1e-12)continue;const u=((by-cy)*(x-cx)+(cx-bx)*(py-cy))/den,v=((cy-ay)*(x-cx)+(ax-cx)*(py-cy))/den,w=1-u-v;if(u>=0&&v>=0&&w>=0){const depth=u*p.getZ(ia)+v*p.getZ(ib)+w*p.getZ(ic);if(depth>front){front=depth;uv=[u*tex.getX(ia)+v*tex.getX(ib)+w*tex.getX(ic),u*tex.getY(ia)+v*tex.getY(ib)+w*tex.getY(ic)];}}}
      const result=model.facePoint(x,y,.001);assert.equal(result[2],Number.isFinite(front)?front+.001:.066);assert.deepEqual(result.uv,uv);
    }release(model);
  }
});

test('Fitted eyes keep front-facing iris triangles within the almond opening for both anatomy masters',()=>{
  for(const unit of units){const model=catalog.anatomy(identity(unit));for(const side of [-1,1]){
    const eye=actorEye({side,facePoint:model.facePoint}),p=eye.iris.attributes.position,ix=eye.iris.index;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i)-side*.036,y=p.getY(i)-.094,arch=Math.max(0,1-(x/.0133)**2)**.7;
      assert.ok(y<=.0036*arch+side*x*.035-.00014&&y>=-.0034*arch+side*x*.035+.00014,'Iris stays behind the actual relaxed curved aperture.');
    }
    const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();let visible=0;
    for(let i=0;i<ix.count;i+=3){a.fromBufferAttribute(p,ix.getX(i));b.fromBufferAttribute(p,ix.getX(i+1));c.fromBufferAttribute(p,ix.getX(i+2));const cross=b.sub(a).cross(c.sub(a));if(cross.lengthSq()<1e-22)continue;assert.ok(cross.z>0);visible++;}
    assert.ok(visible>200);for(const g of [eye.iris,eye.sclera,eye.upperLid,eye.lowerLid])g.dispose();
  }release(model);}
});

test('Eyelid UVs follow the front skin and corner weights keep the lid anchored to the socket',()=>{
  for(const unit of units){const model=catalog.anatomy(identity(unit)),eye=actorEye({facePoint:model.facePoint}),p=eye.upperLid.attributes.position,uv=eye.upperLid.attributes.uv,w=eye.upperLid.attributes.lidWeight;
    for(let i=0;i<p.count;i++){
      const sampled=model.facePoint(p.getX(i),Math.max(p.getY(i),.106));assert.ok(sampled.uv?.every(v=>v>=0&&v<=1));
      assert.ok(Math.abs(uv.getX(i)-sampled.uv[0])<1e-5&&Math.abs(uv.getY(i)-sampled.uv[1])<1e-5);
      assert.ok(w.getX(i)>=0&&w.getX(i)<=1);
    }
    assert.equal(w.getX(0),0);assert.equal(w.getX(28),0);assert.equal(w.getX(14),1);
    assert.ok(Array.from(w.array).slice(-29).every(v=>v===0),'Outer rim is fixed to the head.');
    for(const g of [eye.iris,eye.sclera,eye.upperLid,eye.lowerLid])g.dispose();release(model);
  }
});

test('Actual production eyelid vertices close through skinning while the outer rim stays fixed; seeking and reduced motion reset exactly',()=>{
  for(const unit of units){const actor=createActor(unit,{assetLibrary:catalog}),head=actor.group.getObjectByName('head'),entries=[];
    actor.group.traverse(mesh=>{if(!mesh.isSkinnedMesh||mesh.userData.overview)return;const ids=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight;for(let i=0;i<ids.count;i++)if(mesh.skeleton.bones[ids.getX(i)].name==='left-eyelid')entries.push({mesh,i,weight:w.getX(i)});});
    assert.ok(entries.length>300);assert.ok(entries.some(v=>v.weight===0)&&entries.some(v=>v.weight===1));
    const positions=()=>entries.map(({mesh,i})=>mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(head.matrixWorld.clone().invert()));
    actor.update({time:0,motion:'idle',resetPose:true});const open=positions(),peak=4.58-(actorKit(unit).identity%13)*.13;
    actor.update({time:peak,motion:'idle',resetPose:true});const closed=positions();
    for(let i=0;i<entries.length;i++){
      assert.ok(Math.abs((closed[i].y-open[i].y)+entries[i].weight*.0067)<2e-6,'Rendered vertex follows its authored relaxed-lid/head blend.');
      if(entries[i].weight===0)assert.ok(open[i].distanceTo(closed[i])<2e-6);
    }
    actor.update({time:peak,motion:'idle',resetPose:true,reducedMotion:true});positions().forEach((v,i)=>assert.ok(v.distanceTo(open[i])<2e-6));
    actor.update({time:0,motion:'idle',resetPose:true});positions().forEach((v,i)=>assert.ok(v.distanceTo(open[i])<2e-6));actor.dispose();
  }
});

test('Tapered brow strands follow the fitted skin and preserve forward winding on both sides',()=>{
  for(const unit of units){const id=identity(unit),model=catalog.anatomy(id);for(const side of [-1,1]){
    const g=actorBrow({side,identity:id,facePoint:model.facePoint}),p=g.attributes.position,ix=g.index;
    for(let i=0;i<p.count;i++){const surface=model.facePoint(p.getX(i),p.getY(i));assert.ok(Math.abs(p.getZ(i)-surface[2]-.00055)<2e-6);}
    const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();for(let i=0;i<ix.count;i+=3){a.fromBufferAttribute(p,ix.getX(i));b.fromBufferAttribute(p,ix.getX(i+1));c.fromBufferAttribute(p,ix.getX(i+2));assert.ok(b.sub(a).cross(c.sub(a)).z>0);}g.dispose();
  }release(model);}
});

test('Age refinement is bounded, leaves UVs and bone weights exact, and never modifies the reusable anatomy master',()=>{
  const id=identity(units[0]),young=catalog.anatomy({...id,age:20}),old=catalog.anatomy({...id,age:63}),again=catalog.anatomy({...id,age:20});
  for(const key of ['uv','skinIndex','skinWeight'])assert.deepEqual(old.geometry.attributes[key].array,young.geometry.attributes[key].array);
  assert.deepEqual(again.geometry.attributes.position.array,young.geometry.attributes.position.array);
  const p=young.geometry.attributes.position,q=old.geometry.attributes.position;let peak=0,changed=0;
  for(let i=0;i<p.count;i++){assert.equal(q.getX(i),p.getX(i));assert.equal(q.getY(i),p.getY(i));const d=Math.abs(q.getZ(i)-p.getZ(i));peak=Math.max(peak,d);if(d>1e-6)changed++;}
  assert.ok(peak>.001&&peak<.003);assert.ok(changed>100);[young,old,again].forEach(release);
});

test('Beards and bound hair feather at the skin boundary and mature beards include an upper-lip moustache',()=>{
  for(const unit of [{name:'Varro'},units[1]]){
    const model=catalog.anatomy(identity(unit));for(const key of ['hair','beard']){const g=model[key];if(!g)continue;const c=g.attributes.color,p=g.attributes.position;assert.equal(c.itemSize,4);let feather=0,solid=0,moustache=0;
      for(let i=0;i<c.count;i++){const a=c.getW(i);assert.ok(a>=0&&a<=1);if(a>0&&a<1)feather++;if(a===1)solid++;if(key==='beard'&&Math.abs(p.getX(i))<.036&&p.getY(i)>1.501&&p.getY(i)<1.514&&p.getZ(i)>.06&&a>.3)moustache++;}
      assert.ok(feather>50&&solid>100);if(key==='beard')assert.ok(moustache>30);
    }release(model);
  }
});

test('Weighted brow strands deform with expression posture, syllabic jaw cadence varies during speech, and head gaze stays bounded',()=>{
  assert.deepEqual(actorExpression({motion:'idle'}),{jawOpen:0,browY:0,browTilt:0,lidFocus:0,headYawOffset:0,headPitchOffset:0});
  const rally=actorExpression({motion:'rally',phase:.45,time:1.2,seed:3}),attack=actorExpression({motion:'attack',phase:.45,time:1.2}),strained=actorExpression({motion:'hit',phase:.3});
  assert.ok(rally.browY>0&&rally.jawOpen>0);assert.ok(attack.browY<0&&attack.lidFocus>0);assert.ok(strained.browY<0&&strained.browTilt>0);
  const gaze=actorExpression({gazeYaw:.9,gazePitch:-.8});assert.equal(gaze.headYawOffset,.32);assert.equal(gaze.headPitchOffset,-.18);
  const actor=createActor(units[0],{assetLibrary:catalog}),head=actor.group.getObjectByName('head'),browEntries=[];
  actor.group.traverse(mesh=>{if(!mesh.isSkinnedMesh||mesh.userData.overview)return;const ids=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight;for(let i=0;i<ids.count;i++)if(mesh.skeleton.bones[ids.getX(i)].name==='left-brow')browEntries.push({mesh,i,weight:w.getX(i)});});
  assert.ok(browEntries.length>200&&browEntries.some(e=>e.weight===1)&&browEntries.some(e=>e.weight<.5));
  const sampleBrow=()=>browEntries.map(({mesh,i})=>mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(head.matrixWorld.clone().invert()));
  actor.update({time:0,motion:'idle',resetPose:true});const rest=sampleBrow();
  actor.update({time:.4,motion:'rally',phase:.5,resetPose:true});const baseHeadY=head.rotation.y;
  actor.update({time:.4,motion:'rally',phase:.5,gazeYaw:.22,gazePitch:-.08,resetPose:true});const lifted=sampleBrow();
  assert.ok(lifted.some((v,i)=>v.y>rest[i].y+.0008));assert.ok(Math.abs(head.rotation.y-(baseHeadY+.22))<1e-6);
  actor.dispose();
});


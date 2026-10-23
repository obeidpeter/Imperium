import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {findFocusCamera} from '../src/showcase/stage-focus-camera.js';
import {stageCamera} from '../src/showcase/stage-camera.js';
import {followRealtimeCamera} from '../src/showcase/realtime-field.js';
import {beginLiveCloseUp,sampleLiveCloseUp} from '../src/showcase/live-figures.js';
import {createEnvironment,gridToWorld} from '../src/showcase/environment.js';

const fixtures=JSON.parse(await readFile(new URL('./fixtures/campaign-3d.json',import.meta.url),'utf8'));
function view(position,mounted,pose){const target=new T.Vector3(position.x,position.y+(mounted?1.2:.85),position.z),camera=target.clone().add(new T.Vector3(Math.sin(pose.yaw)*Math.cos(pose.pitch)*pose.distance,Math.sin(pose.pitch)*pose.distance,Math.cos(pose.yaw)*Math.cos(pose.pitch)*pose.distance));return {target,camera};}
function assertSightlines(world,position,mounted,pose,sceneryGroups=[]){
  const {camera}=view(position,mounted,pose),ray=new T.Raycaster(),solids=[];
  for(const group of [world.group,...sceneryGroups]){
    group.updateWorldMatrix(true,true);
    group.traverse(o=>{
      if(!o.isMesh||o===world.ground||o.userData.environmentGround)return;
      for(let ancestor=o;ancestor;ancestor=ancestor.parent)if(!ancestor.visible)return;
      const materials=Array.isArray(o.material)?o.material:[o.material];
      if(materials.some(m=>m.visible&&!m.userData.environmentVegetation&&!m.transparent))solids.push(o);
    });
  }
  function intersections(){
    return solids.flatMap(o=>{
      const hits=[],type=o.isBatchedMesh?T.BatchedMesh:o.isInstancedMesh?T.InstancedMesh:o.isSkinnedMesh?T.SkinnedMesh:T.Mesh;
      type.prototype.raycast.call(o,ray,hits);
      return hits.filter(hit=>{const m=Array.isArray(o.material)?o.material[hit.face.materialIndex]:o.material;return m.visible&&!m.userData.environmentVegetation&&!m.transparent;});
    });
  }
  for(const height of mounted?[.95,2.05,3.05]:[.65,1.35,2.13]){
    const target=new T.Vector3(position.x,position.y+height,position.z),length=target.distanceTo(camera);
    ray.set(camera,target.clone().sub(camera).normalize());ray.near=.015;ray.far=length-.18;assert.equal(intersections().length,0,`Clear camera-to-body sightline at ${height}m`);
    ray.set(target,camera.clone().sub(target).normalize());assert.equal(intersections().length,0,`Camera is outside solid geometry at ${height}m`);
  }
}

test('Cavalry Follow avoids the current Chapter IX gate architecture at its original ten-metre distance',()=>{
  const s=fixtures.scenes.find(s=>s.id==='ch9-wing'),e=s.state.encounter,before=JSON.stringify(s.state),world=createEnvironment(new T.Scene(),e,{chapter:9,quality:'performance',loadTextures:false}),unit=e.units.find(u=>u.id==='enemy0');
  assert.ok(unit);const position=gridToWorld(unit,e);position.y=world.groundHeight(position.x,position.z);
  // The old colonnade lintel moved, but the current regional gate arch still
  // obstructs this old pose. Its disabled picking hook must not hide that fact.
  assert.throws(()=>assertSightlines(world,position,true,{yaw:1.1,pitch:.36,distance:10}),/sightline/);
  const pose=findFocusCamera(world,{position,mounted:true,distance:10});assert.ok(pose);assert.equal(pose.distance,10);assertSightlines(world,position,true,pose);
  assert.deepEqual(findFocusCamera(world,{position,mounted:true,distance:10}),pose);assert.equal(JSON.stringify(s.state),before);world.dispose();
});

for(const meshType of ['Mesh','InstancedMesh','BatchedMesh'])test(`Follow avoids opaque ${meshType} geometry with movement picking disabled`,()=>{
  const group=new T.Group(),geometry=new T.BoxGeometry(2,3,1),material=new T.MeshStandardMaterial({side:T.DoubleSide}),matrix=new T.Matrix4().makeTranslation(0,2,3.5);
  let mesh;
  if(meshType==='InstancedMesh'){mesh=new T.InstancedMesh(geometry,material,1);mesh.setMatrixAt(0,matrix);}
  else if(meshType==='BatchedMesh'){mesh=new T.BatchedMesh(1,geometry.attributes.position.count,geometry.index.count,material);const id=mesh.addInstance(mesh.addGeometry(geometry));mesh.setMatrixAt(id,matrix);}
  else{mesh=new T.Mesh(geometry,material);mesh.position.set(0,2,3.5);}
  const ignoreMovement=()=>{};mesh.raycast=ignoreMovement;group.add(mesh);group.updateMatrixWorld(true);
  const position={x:0,y:0,z:0},preferred={yaw:0,pitch:.36,distance:7.5},{camera,target}=view(position,false,preferred),ray=new T.Raycaster(camera,target.clone().sub(camera).normalize());
  assert.equal(ray.intersectObject(mesh).length,0,'Structural props must not intercept movement picking');
  assert.throws(()=>assertSightlines({group},position,false,preferred),/sightline/,'The preferred camera is genuinely obstructed');
  const pose=findFocusCamera({group},{position,preferredYaw:0});assert.ok(pose);assert.notDeepEqual(pose,preferred);assertSightlines({group},position,false,pose);
  assert.equal(mesh.raycast,ignoreMovement,'Camera queries preserve the object picking hook');assert.equal(ray.intersectObject(mesh).length,0);
  mesh.dispose?.();geometry.dispose();material.dispose();
});

test('Loaded generated scenery replaces a hidden fallback and is included by the stage Follow integration',()=>{
  const group=new T.Group(),loaded=new T.Group(),geometry=new T.BoxGeometry(2,3,1),material=new T.MeshStandardMaterial(),position=new T.Vector3(),preferred={yaw:0,pitch:.36,distance:7.5};
  const fallback=new T.Mesh(geometry,material);fallback.position.set(0,2,3.5);fallback.visible=false;group.add(fallback);
  const prop=fallback.clone();prop.visible=true;prop.raycast=()=>{};loaded.add(prop);
  assert.deepEqual(findFocusCamera({group},{position,preferredYaw:0}),preferred,'Hidden fallback no longer protects the camera');
  const pose=findFocusCamera({group},{position,preferredYaw:0,sceneryGroups:[loaded]});assert.ok(pose);assert.notDeepEqual(pose,preferred);assertSightlines({group},position,false,pose,[loaded]);
  // The stage selects inward yaw 1.1 at the origin, so rotate the prop into it.
  loaded.rotation.y=1.1;
  const stage={encounter:{units:[{id:'hero',role:'soldier'}]},selected:'hero',world:()=>position.clone(),environment:{group},sceneryModels:{group:loaded},orbit:{},baseTarget:new T.Vector3(),home(){assert.fail('A clear angle exists');}};
  stageCamera.focusSelected.call(stage);assert.equal(stage.cameraView,'follow');assertSightlines({group},position,false,stage.orbit,[loaded]);
  assert.notDeepEqual(stage.orbit,{yaw:1.1,pitch:.36,distance:7.5},'The generated obstacle changes the chosen camera');
  loaded.visible=false;assert.deepEqual(findFocusCamera({group},{position,preferredYaw:0,sceneryGroups:[loaded]}),preferred,'Hidden generated scenery is ignored');
  geometry.dispose();material.dispose();
});

test('Real-time Follow tests the moved actor against loaded scenery and retains flat-view controls',()=>{
  const group=new T.Group(),loaded=new T.Group(),geometry=new T.BoxGeometry(2,5,1),material=new T.MeshStandardMaterial(),prop=new T.Mesh(geometry,material);
  prop.position.set(0,3,2.4);prop.raycast=()=>{};loaded.add(prop);
  const actor={id:'hero',x:10,z:10},encounter={units:[{id:'hero',role:'soldier',x:0,y:0}]},before=JSON.stringify({actor,encounter}),stage=Object.create(stageCamera);
  let wakes=0;Object.assign(stage,{encounter,environment:{group},sceneryModels:{group:loaded},orbit:{yaw:0,pitch:.36,distance:9},baseTarget:new T.Vector3(),
    world:tile=>new T.Vector3((tile.x+.5)*2.5-10,0,(tile.y+.5)*2.5-10),wake(){wakes++;},home(){assert.fail('A clear angle exists');}});
  followRealtimeCamera(stage,actor);
  assert.equal(stage.selected,'hero');assert.equal(stage.cameraView,'follow');assert.equal(wakes,1);assert.equal(stage.orbit.distance,9);
  assert.deepEqual(stage.followCollision.position.toArray(),[0,0,0],'Uses live metres instead of the original encounter tile');
  assert.notDeepEqual(stage.orbit,{yaw:0,pitch:.87,distance:9});assertSightlines({group},{x:0,y:0,z:0},false,stage.orbit,[loaded]);
  assert.equal(JSON.stringify({actor,encounter}),before);
  const flat={orbit:{yaw:.5,pitch:.5,distance:12},wake(){wakes++;}};followRealtimeCamera(flat,actor,'chamber');
  assert.equal(flat.cameraView,'follow');assert.equal(flat.selected,'hero');assert.deepEqual(flat.orbit,{yaw:.5,pitch:.98,distance:13});assert.equal(wakes,2);
  geometry.dispose();material.dispose();
});

test('Follow rechecks only meaningful movement or loaded scenery and preserves manual camera choices',()=>{
  const group=new T.Group(),loaded=new T.Group(),stage=Object.create(stageCamera),position=new T.Vector3();let traversals=0;
  const traverse=group.traverse;group.traverse=function(visit){traversals++;return traverse.call(this,visit);};
  Object.assign(stage,{encounter:{units:[{id:'hero',role:'soldier'}]},selected:'hero',world:()=>position.clone(),environment:{group},sceneryModels:{group:loaded},orbit:{},baseTarget:new T.Vector3(),home(){assert.fail('A clear angle exists');}});
  stage.focusSelected({preferredYaw:0});assert.equal(traversals,1);
  for(let frame=0;frame<120;frame++)assert.equal(stage.refreshFollowCamera(position),false);
  assert.equal(stage.refreshFollowCamera(new T.Vector3(1,0,0)),false);assert.equal(traversals,1,'Idle frames and small movement never traverse the scene');
  position.x=2.1;assert.equal(stage.refreshFollowCamera(position),true);assert.equal(traversals,2);
  const geometry=new T.BoxGeometry(2,3,1),material=new T.MeshStandardMaterial(),prop=new T.Mesh(geometry,material);prop.position.set(2.1,2,3.5);prop.raycast=()=>{};loaded.add(prop);
  stage.followGeometryDirty=true;assert.equal(stage.refreshFollowCamera(position),true);assert.equal(traversals,3);assert.equal(stage.followGeometryDirty,false);
  assertSightlines({group},position,false,stage.orbit,[loaded]);const afterAssertion=traversals;
  assert.equal(stage.refreshFollowCamera(position),false);assert.equal(traversals,afterAssertion,'Asset completion causes one query, not polling');
  stage.orbit.yaw+=.15;const manual={...stage.orbit};stage.followGeometryDirty=true;
  assert.equal(stage.refreshFollowCamera(new T.Vector3(5,0,0)),false);assert.deepEqual(stage.orbit,manual);assert.equal(stage.followCollision,null);assert.equal(traversals,afterAssertion);
  stage.focusSelected({preferredYaw:0});assert.ok(stage.followCollision,'Choosing Follow again restores automatic clearance');
  stage.drag={};stage.followGeometryDirty=true;const beforeDrag=traversals;assert.equal(stage.refreshFollowCamera(position),false);assert.equal(traversals,beforeDrag);
  geometry.dispose();material.dispose();
});

test('A critical-hit close-up suspends clearance temporarily and resumes it after restoring the Follow distance',()=>{
  const group=new T.Group(),loaded=new T.Group(),stage=Object.create(stageCamera),position=new T.Vector3();
  Object.assign(stage,{encounter:{units:[{id:'hero',role:'soldier'}]},selected:'hero',world:()=>position.clone(),environment:{group},sceneryModels:{group:loaded},orbit:{},baseTarget:new T.Vector3(),home(){assert.fail('A clear angle exists');}});
  stage.focusSelected({preferredYaw:0,distance:9});const follow=stage.followCollision;let closeUp=beginLiveCloseUp(stage,0);
  closeUp=sampleLiveCloseUp(stage,closeUp,450);assert.equal(stage.followFramingActive,true);assert.ok(stage.orbit.distance<9);
  position.x=2.1;assert.equal(stage.refreshFollowCamera(position),false);assert.equal(stage.followCollision,follow,'Automatic zoom must not be treated as manual input');
  const geometry=new T.BoxGeometry(2,3,1),material=new T.MeshStandardMaterial(),prop=new T.Mesh(geometry,material);prop.position.set(2.1,2,3.5);prop.raycast=()=>{};loaded.add(prop);stage.followGeometryDirty=true;
  closeUp=sampleLiveCloseUp(stage,closeUp,901);assert.equal(closeUp,null);assert.equal(stage.followFramingActive,false);assert.equal(stage.orbit.distance,9);
  assert.equal(stage.refreshFollowCamera(position),true);assert.equal(stage.followCollision,follow);assertSightlines({group},position,false,stage.orbit,[loaded]);
  geometry.dispose();material.dispose();
});

test('A new camera choice or manual input cancels a close-up without restoring stale framing',()=>{
  for(const action of ['zoom','follow','overview','rotate','reduced-motion','dispose']){
    const stage=Object.create(stageCamera);Object.assign(stage,{encounter:{units:[{id:'hero',role:'soldier'}]},selected:'hero',world:()=>new T.Vector3(),environment:{group:new T.Group()},orbit:{},baseTarget:new T.Vector3(),overviewDistance:()=>20});
    stage.focusSelected({preferredYaw:0,distance:9});let closeUp=sampleLiveCloseUp(stage,beginLiveCloseUp(stage,0),450);
    if(action==='zoom')stage.zoom(2);
    else if(action==='follow')stage.focusSelected({preferredYaw:.8,distance:12});
    else if(action==='overview'){stage.cameraView='overview';stage.followCollision=null;stage.orbit.distance=22;}
    else if(action==='rotate')stage.orbit.yaw+=.2;
    else if(action==='reduced-motion')stage.reducedMotion=true;
    const chosen={...stage.orbit};closeUp=sampleLiveCloseUp(stage,closeUp,action==='dispose'?Infinity:500);
    assert.equal(closeUp,null,action);assert.equal(stage.followFramingActive,false,action);
    if(['zoom','follow','overview'].includes(action))assert.deepEqual(stage.orbit,chosen,'A fresh camera command retains its complete framing');
    else assert.equal(stage.orbit.distance,9,'Cancellation removes only the temporary automatic zoom');
    if(action==='zoom')assert.equal(stage.followCollision,null,'Manual zoom opts out immediately, including during automatic framing');
    if(action==='rotate'){assert.equal(stage.orbit.yaw,.2);assert.equal(stage.refreshFollowCamera(new T.Vector3(3,0,0)),false);assert.equal(stage.followCollision,null);}
    assert.equal(sampleLiveCloseUp(stage,null,600),null);assert.equal(stage.followFramingActive,false,'No stale flag remains');
  }
});

test('Roman chamber Follow retains three clear body sightlines for every legal near-wall speaker and delegate',()=>{
  for(const id of ['ch11-accounts','ch11-adlection','ch12-legitimacy']){
    const s=fixtures.scenes.find(s=>s.id===id),e=s.state.encounter,before=JSON.stringify(e),world=createEnvironment(new T.Scene(),e,{chapter:s.chapter,quality:'performance',loadTextures:false});
    for(const unit of e.units.filter(u=>!u.hidden)){
      const position=gridToWorld(unit,e);position.y=world.groundHeight(position.x,position.z);const pose=findFocusCamera(world,{position});assert.ok(pose,`${id}/${unit.id} has a clear focus angle`);assertSightlines(world,position,false,pose);
    }
    assert.equal(JSON.stringify(e),before);world.dispose();
  }
});

test('Focus returns null for enclosed candidates and ignores nonblocking foliage, transparent water and hidden geometry',()=>{
  const group=new T.Group(),scene=new T.Scene();scene.add(group);const position={x:0,y:0,z:0};
  const foliage=new T.Mesh(new T.BoxGeometry(20,20,20),new T.MeshStandardMaterial({side:T.DoubleSide}));foliage.material.userData.environmentVegetation=true;group.add(foliage);
  const water=new T.Mesh(new T.BoxGeometry(20,20,20),new T.MeshBasicMaterial({transparent:true}));group.add(water);
  const hidden=new T.Group();hidden.visible=false;const geometry=new T.BoxGeometry(20,20,20),material=new T.MeshStandardMaterial(),wall=new T.Mesh(geometry,material);hidden.add(wall);group.add(hidden);
  assert.deepEqual(findFocusCamera({group},{position}),{yaw:1.1,pitch:.36,distance:7.5});
  // An opaque shell contains both camera and subject; reverse rays correctly
  // handle embedded candidates when geometry has both visible sides.
  const shell=new T.Mesh(new T.BoxGeometry(4,7,4),new T.MeshStandardMaterial({side:T.DoubleSide,map:new T.Texture()}));group.add(shell);
  assert.equal(findFocusCamera({group},{position}),null);assert.equal(findFocusCamera({group},{position:{x:NaN,y:0,z:0}}),null);
  group.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});
});

test('Textured alpha foliage does not steer Follow, while the same opaque architectural shell still blocks it',()=>{
  const group=new T.Group(),map=new T.DataTexture(new Uint8Array([91,121,57,255]),1,1),material=new T.MeshStandardMaterial({map,side:T.DoubleSide,alphaTest:.42}),geometry=new T.BoxGeometry(4,7,4),mesh=new T.Mesh(geometry,material);group.add(mesh);
  material.userData.environmentVegetation=true;
  assert.deepEqual(findFocusCamera({group},{position:{x:0,y:0,z:0}}),{yaw:1.1,pitch:.36,distance:7.5});
  delete material.userData.environmentVegetation;
  assert.equal(findFocusCamera({group},{position:{x:0,y:0,z:0}}),null,'Textured tent or opaque bark surfaces do not inherit the foliage exemption');
  geometry.dispose();material.dispose();map.dispose();
});

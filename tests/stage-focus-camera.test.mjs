import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three/three.module.js';
import {findFocusCamera} from '../src/showcase/stage-focus-camera.js';
import {createEnvironment,gridToWorld} from '../src/showcase/environment.js';

const fixtures=JSON.parse(await readFile(new URL('./fixtures/campaign-3d.json',import.meta.url),'utf8'));
function view(position,mounted,pose){const target=new T.Vector3(position.x,position.y+(mounted?1.2:.85),position.z),camera=target.clone().add(new T.Vector3(Math.sin(pose.yaw)*Math.cos(pose.pitch)*pose.distance,Math.sin(pose.pitch)*pose.distance,Math.cos(pose.yaw)*Math.cos(pose.pitch)*pose.distance));return {target,camera};}
function assertSightlines(world,position,mounted,pose){
  const {camera}=view(position,mounted,pose),ray=new T.Raycaster(),solids=[];world.group.updateMatrixWorld(true);
  world.group.traverse(o=>{if(o.isMesh&&o!==world.ground&&!o.material.transparent&&!(o.material.side===T.DoubleSide&&!o.material.map))solids.push(o);});
  for(const height of mounted?[.95,2.05,3.05]:[.65,1.35,2.13]){
    const target=new T.Vector3(position.x,position.y+height,position.z),length=target.distanceTo(camera);
    ray.set(camera,target.clone().sub(camera).normalize());ray.near=.015;ray.far=length-.18;assert.equal(ray.intersectObjects(solids,false).length,0,`Clear camera-to-body sightline at ${height}m`);
    ray.set(target,camera.clone().sub(target).normalize());assert.equal(ray.intersectObjects(solids,false).length,0,`Camera is outside solid geometry at ${height}m`);
  }
}

test('Cavalry Follow avoids the real Chapter IX colonnade lintel at the original ten-metre focus distance',()=>{
  const s=fixtures.scenes.find(s=>s.id==='ch9-wing'),e=s.state.encounter,before=JSON.stringify(s.state),world=createEnvironment(new T.Scene(),e,{chapter:9,quality:'performance',loadTextures:false}),unit=e.units.find(u=>u.id==='enemy0');
  assert.ok(unit);const position=gridToWorld(unit,e);position.y=world.groundHeight(position.x,position.z);
  // Browser-reproduced former camera: fixed yaw 1.1, pitch .36, distance10.
  assert.throws(()=>assertSightlines(world,position,true,{yaw:1.1,pitch:.36,distance:10}));
  const pose=findFocusCamera(world,{position,mounted:true,distance:10});assert.ok(pose);assert.equal(pose.distance,10);assertSightlines(world,position,true,pose);
  assert.deepEqual(findFocusCamera(world,{position,mounted:true,distance:10}),pose);assert.equal(JSON.stringify(s.state),before);world.dispose();
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
  const foliage=new T.Mesh(new T.BoxGeometry(20,20,20),new T.MeshStandardMaterial({side:T.DoubleSide}));group.add(foliage);
  const water=new T.Mesh(new T.BoxGeometry(20,20,20),new T.MeshBasicMaterial({transparent:true}));group.add(water);
  const hidden=new T.Group();hidden.visible=false;const geometry=new T.BoxGeometry(20,20,20),material=new T.MeshStandardMaterial(),wall=new T.Mesh(geometry,material);hidden.add(wall);group.add(hidden);
  assert.deepEqual(findFocusCamera({group},{position}),{yaw:1.1,pitch:.36,distance:7.5});
  // An opaque shell contains both camera and subject; reverse rays correctly
  // handle embedded candidates when geometry has both visible sides.
  const shell=new T.Mesh(new T.BoxGeometry(4,7,4),new T.MeshStandardMaterial({side:T.DoubleSide,map:new T.Texture()}));group.add(shell);
  assert.equal(findFocusCamera({group},{position}),null);assert.equal(findFocusCamera({group},{position:{x:NaN,y:0,z:0}}),null);
  group.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});
});

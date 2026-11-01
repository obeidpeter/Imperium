import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {stageCamera} from '../src/showcase/stage-camera.js';
import {FlatStage} from '../src/showcase/flat-stage.js';
import {FIELD_PITCH,FIELD_YAW,bearingToward,boundedOffset,screenRight,screenUp} from '../src/showcase/camera-bearing.js';
import {DEFAULT_KEYMAP,KEY_GROUPS,keymapFrom} from '../src/ui/action-map.js';

// Release 12: the real-time field's one camera. It keeps the 2D view's bearing, never turns, slides over the
// ground when dragged and springs back, glances at the horizon while H is held, and cuts scenery away.

const near=(a,b,e=1e-9)=>Math.abs(a-b)<=e;
// A 3D stage with the field's camera: a 40 × 30 metre board (16 × 12 tiles) round the origin, the soldier at (2, 0, 1).
function fieldStage(extra={}){
  const stage=Object.create(stageCamera),hero={group:{visible:true,position:new T.Vector3(2,0,1)}};
  Object.assign(stage,{fixedCamera:true,encounter:{id:'ch5-mine',kind:'battle',width:16,height:12,units:[{id:'hero',role:'soldier',x:8.3,y:6.1}]},selected:'hero',
    orbit:{yaw:-1.05,pitch:.87,distance:16},baseTarget:new T.Vector3(),lookOffset:new T.Vector3(),camera:new T.PerspectiveCamera(40,16/9,.1,800),viewportHeight:720,
    actors:new Map([['hero',hero]]),world:tile=>new T.Vector3((tile.x+.5)*2.5-20,0,(tile.y+.5)*2.5-15),wakes:0,wake(){this.wakes++;},
    hoverRing:{visible:false,position:new T.Vector3()},profile:{staging:{camera:{yaw:-1.05,pitch:.65}}},
    environment:{horizon:{stats:{landmarks:[{x:-100,z:0},{x:60,z:110},{x:30,z:-150}]}}},
    live:{cameraTarget:()=>hero.group.position.clone().add(new T.Vector3(0,1.4,0))},...extra});
  return stage;
}
// Where the stage's camera stands and looks this frame (stage.js): its target plus any look away.
function frameCamera(stage){
  const anchor=stage.focusMode?stage.actors.get(stage.selected).group.position.clone().add(new T.Vector3(0,.85,0)):stage.baseTarget.clone();
  const target=anchor.add(stage.lookOffset),{yaw,pitch,distance}=stage.orbit,camera=stage.camera.clone();
  camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,target.y+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*Math.cos(pitch)*distance);
  camera.lookAt(target);camera.updateMatrixWorld();return {camera,target};
}
const pixels=(camera,point)=>{const p=point.clone().project(camera);return {x:(p.x+1)/2*1280,y:(1-p.y)/2*720};};

test('one bearing in both views: from the south-east toward the north-west, so up on the screen is north-west on the board',()=>{
  assert.equal(FIELD_YAW,Math.PI/4);assert.ok(near(FIELD_PITCH,35.26*Math.PI/180,1e-3),'a true isometric elevation');
  const right=screenRight(FIELD_YAW),up=screenUp(FIELD_YAW);
  assert.ok(right.x>0&&right.z<0&&near(right.x,-right.z),'screen right is north-east');
  assert.ok(up.x<0&&up.z<0&&near(up.x,up.z),'screen up is north-west');
  // The 2D view draws east as down-right and north as up-right (flat-stage.js screen()).
  const flat=flatStage(fieldWorld()),v=flat.view(fieldWorld()),origin=flat.screen(v,50,40),east=flat.screen(v,52.5,40),north=flat.screen(v,50,37.5);
  assert.ok(east.x>origin.x&&east.y>origin.y);assert.ok(north.x>origin.x&&north.y<origin.y);assert.equal(flat.orbit.yaw,FIELD_YAW);
  flat.orbit.yaw=1;assert.equal(flat.orbit.yaw,FIELD_YAW,'the 2D view never turns');
  assert.ok(near(bearingToward({x:0,z:0},{x:-10,z:-10}),FIELD_YAW),'looking north-west is the field bearing');
});

test('the field camera never turns: the overview, Follow and the performance check\'s tour keep its bearing, while the turns\' board keeps its scenes\' bearings',()=>{
  const stage=fieldStage();stage.lookOffset.set(4,0,4);
  stage.home();assert.equal(stage.cameraView,'overview');assert.equal(stage.orbit.yaw,FIELD_YAW);assert.equal(stage.orbit.pitch,FIELD_PITCH);
  assert.deepEqual(stage.lookOffset.toArray(),[0,0,0],'the overview starts over the field\'s centre');assert.ok(stage.orbit.distance>=20,'the whole field');
  stage.orbit.yaw=2;stage.focusSelected({distance:12});assert.equal(stage.cameraView,'follow');assert.deepEqual({...stage.orbit},{yaw:FIELD_YAW,pitch:FIELD_PITCH,distance:12});
  stage.focusSelected();assert.equal(stage.orbit.distance,12,'Follow with no distance keeps the zoom');
  assert.equal(stage.refreshFollowCamera(new T.Vector3(9,0,9)),false,'no clearance turn as he walks');
  const turns=fieldStage({fixedCamera:undefined});turns.home();assert.equal(turns.orbit.yaw,-1.05,'the turns\' board keeps its scene\'s bearing');assert.equal(turns.orbit.pitch,.65);
});

test('a drag slides the view over the ground as the pointer moves it, never off the board, and springs back when he moves or F is pressed',()=>{
  const stage=fieldStage();stage.focusSelected({distance:16});
  const before=frameCamera(stage),grip=before.target.clone();
  assert.equal(stage.pan(120,0),true);const after=frameCamera(stage),moved=pixels(after.camera,grip),was=pixels(before.camera,grip);
  assert.ok(Math.abs(moved.x-was.x-120)<6&&Math.abs(moved.y-was.y)<6,`the ground under the pointer follows it (${(moved.x-was.x).toFixed(1)} px)`);
  const right=screenRight(FIELD_YAW);assert.ok(stage.lookOffset.x*right.x+stage.lookOffset.z*right.z<0,'dragging right looks further left');
  // Perspective: the ground nearer the camera moves faster than the scale at the target, by about a tenth over 80 pixels at once.
  stage.lookOffset.set(0,0,0);const top=frameCamera(stage);stage.pan(0,80);const down=frameCamera(stage),drop=pixels(down.camera,top.target),from=pixels(top.camera,top.target);
  assert.ok(drop.y-from.y>72&&drop.y-from.y<92&&Math.abs(drop.x-from.x)<4,`dragging down brings the far ground nearer (${(drop.y-from.y).toFixed(1)} px)`);
  for(let i=0;i<60;i++)stage.pan(-400,-400);
  const bounds=stage.boardBounds(),look=stage.lookAnchor().clone().add(stage.lookOffset);
  assert.ok(look.x>=bounds.minX-1e-9&&look.x<=bounds.maxX+1e-9&&look.z>=bounds.minZ-1e-9&&look.z<=bounds.maxZ+1e-9,'the view stays over the board');
  assert.equal(stage.springBack(),true,'moving springs back');assert.deepEqual(stage.lookOffset.toArray(),[0,0,0]);assert.equal(stage.springBack(),false,'nothing to spring back from');
  stage.pan(50,50);stage.focusSelected({distance:16});assert.deepEqual(stage.lookOffset.toArray(),[0,0,0],'F springs back');
  stage.home();stage.pan(-200,0);assert.equal(stage.springBack(),false,'the overview stays where it was moved when he moves');
  assert.ok(stage.lookOffset.length()>0);assert.equal(stage.springBack({overview:true}),true);
  stage.cameraView='horizon';assert.equal(stage.pan(10,10),false,'the glance cannot be dragged');
  const turns=fieldStage({fixedCamera:undefined});turns.focusMode=true;turns.cameraView='follow';assert.equal(turns.pan(10,10),false,'the turns\' board has no look away');
});

test('a log entry or a wayfinder looks there as a drag would, and springs back the same way',()=>{
  const stage=fieldStage();stage.focusSelected({distance:16});const point={x:3,y:2},spot=stage.world(point);
  stage.focusPoint(point);assert.equal(stage.cameraView,'follow');assert.equal(stage.focusMode,true,'the view still follows him, looking away');
  const look=stage.lookAnchor().clone().add(stage.lookOffset);assert.ok(near(look.x,spot.x)&&near(look.z,spot.z));assert.equal(stage.hoverRing.visible,true);
  assert.equal(stage.springBack(),true);assert.deepEqual(stage.lookOffset.toArray(),[0,0,0]);
  assert.deepEqual(boundedOffset({x:0,z:0},{x:50,z:-50},{minX:-20,maxX:20,minZ:-15,maxZ:15}),{x:20,z:-15});
});

test('holding H glances from the soldier toward the nearest landmark and gives the view back as it was',()=>{
  const stage=fieldStage();stage.focusSelected({distance:14});stage.pan(60,-30);const offset=stage.lookOffset.clone(),orbit={...stage.orbit};
  assert.equal(stage.glance(true),true);assert.equal(stage.cameraView,'horizon');assert.equal(stage.orbit.pitch,.14);
  const from=stage.live.cameraTarget(),nearest={x:-100,z:0};assert.ok(near(stage.orbit.yaw,bearingToward(from,nearest)),'toward the nearest of the three landmarks');
  const camera=new T.Vector3(Math.sin(stage.orbit.yaw),0,Math.cos(stage.orbit.yaw)),toward=new T.Vector3(nearest.x-from.x,0,nearest.z-from.z).normalize();
  assert.ok(camera.dot(toward)<-.999,'the camera stands on the far side of the soldier from the landmark, looking at it');
  assert.equal(stage.glance(true),false,'a held key does not glance again');
  assert.equal(stage.glance(false),true);assert.equal(stage.cameraView,'follow');assert.deepEqual({...stage.orbit},orbit);assert.deepEqual(stage.lookOffset.toArray(),offset.toArray());
  stage.glance(true);assert.equal(stage.springBack(),true,'moving during a glance springs back the view it gives back');stage.glance(false);
  assert.deepEqual(stage.lookOffset.toArray(),[0,0,0]);
  stage.glance(true);stage.home();assert.equal(stage.glance(false),false,'a view chosen meanwhile stands');assert.equal(stage.cameraView,'overview');
  const bare=fieldStage({environment:{horizon:{stats:{landmarks:[]}}}});assert.equal(bare.glanceYaw({x:0,z:0}),FIELD_YAW,'no landmarks: the field bearing');
  const none=fieldStage({live:null});assert.equal(none.glance(true),false,'only a live field glances');
});

test('the 2D view slides, bounds and springs back the same way',()=>{
  const world=fieldWorld(),flat=flatStage(world);flat.lastView=flat.view(world);
  const grip={x:40,z:35},was=flat.screen(flat.lastView,grip.x,grip.z);
  assert.equal(flat.pan(90,-40),true);const v=flat.view(world),now=flat.screen(v,grip.x,grip.z);
  assert.ok(near(now.x-was.x,90,1e-6)&&near(now.y-was.y,-40,1e-6),'the ground under the pointer follows it exactly');
  for(let i=0;i<50;i++){flat.lastView=flat.view(world);flat.pan(900,900);}
  const anchor=flat.lookAnchor();assert.ok(anchor.x+flat.lookOffset.x>=0&&anchor.z+flat.lookOffset.z<=world.map.height*2.5+1e-9,'over the map');
  assert.equal(flat.springBack(),true);assert.deepEqual(flat.lookOffset,{x:0,z:0});
  flat.focusPoint({x:4,y:6});const look=flat.lookAnchor();assert.ok(near(look.x+flat.lookOffset.x,11.25)&&near(look.z+flat.lookOffset.z,16.25),'a log entry looks there');
  flat.home();assert.deepEqual(flat.lookOffset,{x:0,z:0});flat.lastView=flat.view(world);flat.pan(30,0);assert.equal(flat.springBack(),false,'the overview stays put');
  assert.equal(flat.glance(true),false,'the 2D view has no horizon');
});

test('the keys: F, Z, a held H, X and zoom; the turn keys are gone, and a player\'s old turn key is dropped without losing his others',()=>{
  assert.equal(DEFAULT_KEYMAP.camera_rotate_left,undefined);assert.equal(DEFAULT_KEYMAP.camera_rotate_right,undefined);
  const camera=KEY_GROUPS.find(([title])=>title==='Camera')[1].map(([action])=>action);
  assert.deepEqual(camera,['camera_follow','camera_overview','camera_horizon','zoom_in','zoom_out','see_through','show_ranges']);
  assert.deepEqual([DEFAULT_KEYMAP.camera_follow,DEFAULT_KEYMAP.camera_overview,DEFAULT_KEYMAP.camera_horizon,DEFAULT_KEYMAP.see_through],[['KeyF'],['KeyZ'],['KeyH'],['KeyX']]);
  const map=keymapFrom({camera_rotate_left:['KeyK'],pause:['KeyO']});
  assert.equal(map.camera_rotate_left,undefined);assert.deepEqual(map.pause,['KeyO'],'the player\'s other change stands');
  assert.ok(!Object.values(map).flat().includes('Comma'),'the comma is free again');
});

function fieldWorld(){return {kind:'field',map:{width:40,height:30},controlled:'hero',actors:[{id:'hero',x:50,z:40,px:50,pz:40,alive:true}]};}
function flatStage(world){
  globalThis.ResizeObserver??=class{observe(){}disconnect(){}};globalThis.requestAnimationFrame??=()=>0;globalThis.cancelAnimationFrame??=()=>{};
  const canvas={getContext:()=>({}),getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720})},stage=new FlatStage(canvas);
  stage.disposed=true;stage.setLive({world:()=>world,alpha:()=>1});return stage;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/core/game.js';
import {createShowcaseSession,ARRIVAL,facingYaw} from '../src/showcase/session.js';
import {BattleStage,stageActorPose,intersectGround,positionProjectileTip} from '../src/showcase/stage.js';
import * as T from '../vendor/three/three.module.js';
import {createGroundHeight,gridToWorld} from '../src/showcase/environment-layout.js';
import {buildEncounterTimeline,sampleEncounterTimeline} from '../src/ui/animation-timeline.js';
import {readFile} from 'node:fs/promises';

test('Picking follows raised cells at close camera angles instead of the flat map plane',()=>{
  const e=createShowcaseSession().encounter,height=createGroundHeight(e,2.5);
  for(const tile of [{x:4,y:1},{x:4,y:4},{x:2,y:3}])for(const yaw of [0,.7,1.8,3.5,5]){
    const p=gridToWorld(tile,e,2.5),point=new T.Vector3(p.x,height(p.x,p.z),p.z),origin=point.clone().add(new T.Vector3(Math.sin(yaw)*7,2.6,Math.cos(yaw)*7));
    const ray=new T.Ray(origin,point.clone().sub(origin).normalize()),hit=intersectGround(ray,height);
    assert.ok(hit&&hit.distanceTo(point)<.025,`Elevated tile ${tile.x},${tile.y} at yaw ${yaw}`);
    assert.equal(Math.round(hit.x/2.5+(e.width-1)/2),tile.x);assert.equal(Math.round(hit.z/2.5+(e.height-1)/2),tile.y);
  }
});

test('A legal world move uses actual traveled distance for gait, turns continuously, and leaves rule state untouched',()=>{
  const state=createShowcaseSession(),before=structuredClone(state.encounter),target=Game.getTargets(state,'hero','move').find(t=>t.x!==before.units.find(u=>u.id==='hero').x);
  assert.ok(target);const command={unitId:'hero',action:'move',x:target.x,y:target.y};assert.ok(Game.act(state,command).ok);
  const after=state.encounter,serialized=Game.serialize(state),timeline=buildEncounterTimeline(before,after,{command}),move=timeline.tracks.find(t=>t.unitId==='hero'&&t.path),hero=after.units.find(u=>u.id==='hero');
  for(const fraction of [.02,.2,.5,.8]){
    const frame=sampleEncounterTimeline(timeline,move.start+move.duration*fraction),pose=stageActorPose(hero,frame,timeline),distance=fraction*fraction*(3-2*fraction)*(move.path.length-1)*2.5;
    assert.ok(Math.abs(pose.phase-distance/.72)<1e-10);
    assert.ok(Number.isFinite(pose.direction));assert.equal(pose.selected,false,'The stage owns the sole selection ring.');
  }
  assert.equal(Game.serialize(state),serialized);
});

test('Facing interpolation takes the short angular route and a resting braced unit holds its shield',()=>{
  const unit={id:'u',hp:10,maxHp:10,facing:'west',braced:true},frame={unitOverrides:{u:{pose:'turn',progress:.4,previousFacing:'north',facing:'west',turnProgress:.5,alpha:1}}};
  const pose=stageActorPose(unit,frame,null);assert.ok(Math.abs(pose.direction-(Math.PI+Math.PI/4))<1e-9);assert.equal(pose.motion,'brace');
  const rest=stageActorPose(unit,null,null,{time:23,reducedMotion:true});assert.equal(rest.motion,'brace');assert.equal(rest.phase,.45);assert.equal(rest.time,0);
});

test('A committed withdrawal remains standing before impact, then uses a fall pose rather than a backwards walk',()=>{
  const before={id:'withdrawal-fixture',kind:'battle',width:3,height:3,terrain:Array.from({length:3},()=>Array(3).fill('earth')),units:[{id:'victim',name:'Victim',x:1,y:1,hp:4,maxHp:10,side:'enemy',facing:'north'}],log:[]},after=structuredClone(before);after.units[0].hp=0;
  const timeline=buildEncounterTimeline(before,after),track=timeline.tracks.find(t=>t.withdrawn),unit=after.units[0];assert.ok(track);
  const waiting=stageActorPose(unit,sampleEncounterTimeline(timeline,0),timeline);assert.equal(waiting.motion,'idle');assert.equal(waiting.health,.4);
  const falling=stageActorPose(unit,sampleEncounterTimeline(timeline,track.start+track.duration*.5),timeline);assert.equal(falling.motion,'withdrawn');assert.equal(falling.phase,.5);assert.equal(falling.health,1,'The rig must use action progress for this fall rather than snap to zero-health pose.');
  assert.equal(sampleEncounterTimeline(timeline,track.start+track.duration).unitOverrides.victim.alpha,0);
});

test('A paused or reduced-motion stage accepts committed state without queuing animation or unlocking sound',async()=>{
  const state=createShowcaseSession(),before=structuredClone(state.encounter),target=Game.getTargets(state,'hero','move')[0],command={unitId:'hero',action:'move',x:target.x,y:target.y};
  assert.ok(Game.act(state,command).ok);const after=state.encounter,save=Game.serialize(state);
  for(const mode of ['paused','reducedMotion']){
    const calls=[],stage=Object.create(BattleStage.prototype);
    Object.assign(stage,{[mode]:true,finishMotion:()=>calls.push('finish'),sync:value=>{stage.encounter=value;calls.push('sync');},sound:{unlock:()=>calls.push('unlock')}});
    await stage.play(before,after,command);
    assert.deepEqual(calls,['finish','sync']);assert.equal(stage.encounter,after);assert.ok(!stage.animation);assert.equal(Game.serialize(state),save);
  }
});

function cameraStage(encounter,width,height){
  const stage=Object.create(BattleStage.prototype),heightAt=createGroundHeight(encounter,2.5);
  Object.assign(stage,{encounter,camera:new T.PerspectiveCamera(40,width/height,.1,220),orbit:{},baseTarget:new T.Vector3(),world:tile=>{const p=gridToWorld(tile,encounter,2.5);return new T.Vector3(p.x,heightAt(p.x,p.z),p.z);}});
  return stage;
}
test('The real overview distance keeps legal drill and road soldiers inside wide and portrait camera frustums',()=>{
  const drill=Game.newGame('Aurelius Marcellus',275);for(const [method,arg] of ARRIVAL.slice(0,2))assert.ok(Game[method](drill,arg).ok);
  for(const state of [drill,createShowcaseSession()])for(const [width,height] of [[1440,600],[360,384],[360,640],[640,280]]){
    const stage=cameraStage(state.encounter,width,height);stage.home();
    const {yaw,pitch,distance}=stage.orbit,target=stage.baseTarget;
    stage.camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,target.y+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*Math.cos(pitch)*distance);
    stage.camera.lookAt(target);stage.camera.updateMatrixWorld();
    for(const unit of state.encounter.units.filter(u=>!u.hidden&&u.hp>0))for(const y of [0,2.2]){
      const projected=stage.world(unit).add(new T.Vector3(0,y,0)).project(stage.camera);
      assert.ok(Math.abs(projected.x)<.9&&Math.abs(projected.y)<.9&&projected.z>-1&&projected.z<1,`${state.encounter.id} ${unit.id} at${width}x${height}: ${projected.toArray()}`);
    }
  }
});

test('Resize widens overview framing for portrait, preserves intentional focus, and ignores collapsed layout',()=>{
  const stage=cameraStage(createShowcaseSession().encounter,1440,600);stage.home();const wideDistance=stage.orbit.distance,calls=[];
  let rect={width:360,height:384};stage.canvas={getBoundingClientRect:()=>rect};stage.renderer={setSize:(...args)=>calls.push(args)};
  stage.resize();assert.ok(stage.orbit.distance>wideDistance);assert.equal(stage.camera.aspect,360/384);assert.deepEqual(calls.at(-1),[360,384,false]);
  stage.focusMode=true;stage.orbit.distance=7.5;rect={width:640,height:280};stage.resize();assert.equal(stage.orbit.distance,7.5);
  const matrix=stage.camera.projectionMatrix.toArray(),count=calls.length;rect={width:0,height:0};stage.resize();assert.equal(calls.length,count);assert.deepEqual(stage.camera.projectionMatrix.toArray(),matrix);
});

test('All campaign scenes frame every visible figure including mounted troops at desktop and portrait sizes',async()=>{
  const fixture=JSON.parse(await readFile(new URL('./fixtures/campaign-3d.json',import.meta.url),'utf8'));
  for(const scene of fixture.scenes)for(const [width,height] of [[1440,600],[360,384],[360,640],[844,420]]){
    const e=scene.state.encounter,stage=cameraStage(e,width,height);stage.home();
    const {yaw,pitch,distance}=stage.orbit,target=stage.baseTarget;
    stage.camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,target.y+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*Math.cos(pitch)*distance);stage.camera.lookAt(target);stage.camera.updateMatrixWorld();
    for(const unit of e.units.filter(u=>!u.hidden))for(const height of [0,['cavalry','heavy'].includes(unit.role)?3.1:2.55]){
      const projected=stage.world(unit).add(new T.Vector3(0,height,0)).project(stage.camera);
      assert.ok(Math.abs(projected.x)<.9&&Math.abs(projected.y)<.9&&Math.abs(projected.z)<1,`${scene.id} ${unit.id} at ${width} × ${stage.camera.aspect}: ${projected.toArray()}`);
    }
  }
});

test('Civic Resolve, gestures and withdrawal remain finite and never become combat death poses',()=>{
  const speaker={id:'speaker',role:'speaker',side:'enemy',resolve:6,maxResolve:12,hp:6,maxHp:6,facing:'west'};
  assert.equal(stageActorPose(speaker,null,null).health,.5);
  const yieldPose=stageActorPose({...speaker,resolve:0,hp:0},null,null,{reducedMotion:true});
  assert.equal(yieldPose.motion,'yield');assert.equal(yieldPose.phase,1);assert.equal(yieldPose.health,0);assert.equal(yieldPose.time,0);
  assert.ok(Number.isFinite(stageActorPose({id:'member',role:'voter',hp:1},null,null).health));
  const before={id:'civic-withdrawal',kind:'contest',width:3,height:3,terrain:Array.from({length:3},()=>Array(3).fill('chamber')),units:[{...speaker,x:1,y:1}],log:[]},after=structuredClone(before);after.units[0].hp=0;after.units[0].resolve=0;
  const timeline=buildEncounterTimeline(before,after),track=timeline.tracks.find(t=>t.withdrawn),unit=after.units[0];
  const standing=stageActorPose(unit,sampleEncounterTimeline(timeline,0),timeline);assert.equal(standing.motion,'idle');assert.equal(standing.health,.5);
  const lowering=stageActorPose(unit,sampleEncounterTimeline(timeline,track.start+track.duration*.5),timeline);assert.equal(lowering.motion,'yield');assert.equal(lowering.phase,.5);
  const finished=stageActorPose(unit,sampleEncounterTimeline(timeline,timeline.duration),timeline);assert.equal(finished.motion,'yield');assert.equal(finished.phase,1);
});

test('Zoom remains monotonic beyond desktop limits and withdrawn civic figures do not intercept live picks',()=>{
  const stage=Object.create(BattleStage.prototype);Object.assign(stage,{orbit:{distance:96},overviewDistance:()=>100});
  stage.zoom(2);assert.equal(stage.orbit.distance,98);stage.zoom(-2);assert.equal(stage.orbit.distance,96);stage.zoom(20);assert.equal(stage.orbit.distance,100);stage.zoom(2);assert.equal(stage.orbit.distance,100);
  const live={id:'live',x:2,y:3,resolve:6,role:'speaker'},withdrawn={id:'withdrawn',x:1,y:3,resolve:0,role:'speaker'},liveMesh=new T.Group(),withdrawnMesh=new T.Group();liveMesh.userData.unitId='live';withdrawnMesh.userData.unitId='withdrawn';
  Object.assign(stage,{canvas:{getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})},ndc:new T.Vector2(),camera:{},encounter:{units:[withdrawn,live]},actors:new Map([['withdrawn',{group:withdrawnMesh}],['live',{group:liveMesh}]]),ray:{setFromCamera(){},intersectObjects(groups){assert.deepEqual(groups,[liveMesh]);return [{object:liveMesh}];}}});
  assert.deepEqual(stage.pick({clientX:400,clientY:300}),{x:2,y:3,unitId:'live'});
});

test('Directed actions face their exact recipient, including diagonal civic gestures',()=>{
  const unit={id:'hero',x:1,y:1,hp:10,maxHp:10,facing:'north'};
  for(const motion of ['attack','cavalry-attack','throw','speak','order','rally']){
    const target={x:3,y:2},frame={unitOverrides:{hero:{x:1,y:1,pose:motion,progress:.4,facing:'north'}}},timeline={units:{},tracks:[{unitId:'hero',pose:motion,target}]};
    const before=JSON.stringify({unit,frame,timeline}),pose=stageActorPose(unit,frame,timeline);
    assert.equal(pose.direction,Math.atan2(2,1));
    assert.equal(JSON.stringify({unit,frame,timeline}),before);
  }
});

test('The visible javelin and arrow tip meet their actual release and target anchors without a mesh-origin jump',()=>{
  const from=new T.Vector3(1,1.9,2),to=new T.Vector3(6,2.05,-4),saved=[from.toArray(),to.toArray()];
  for(const scale of [1,.52])for(const phase of [0,.25,.5,.75,1]){
    const missile=new T.Group();missile.scale.setScalar(scale);positionProjectileTip(missile,from,to,phase);missile.updateMatrixWorld(true);
    const actual=missile.localToWorld(new T.Vector3(0,0,1.01)),expected=from.clone().lerp(to,phase);expected.y+=Math.sin(phase*Math.PI)*1.8;
    assert.ok(actual.distanceTo(expected)<1e-10);
  }
  assert.deepEqual([from.toArray(),to.toArray()],saved);
});

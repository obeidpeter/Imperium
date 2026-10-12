import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/core/game.js';
import {createShowcaseSession,ARRIVAL,facingYaw} from '../src/showcase/session.js';
import {BattleStage,stageActorPose,intersectGround} from '../src/showcase/stage.js';
import * as T from '../vendor/three/three.module.js';
import {createGroundHeight,gridToWorld} from '../src/showcase/environment-layout.js';
import {buildEncounterTimeline,sampleEncounterTimeline} from '../src/ui/animation-timeline.js';

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

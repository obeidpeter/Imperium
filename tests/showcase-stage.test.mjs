import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/core/game.js';
import {createShowcaseSession,facingYaw} from '../src/showcase/session.js';
import {stageActorPose,intersectGround} from '../src/showcase/stage.js';
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

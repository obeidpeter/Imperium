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
    assert.ok(Math.abs(pose.locomotionDistance-distance)<1e-10);
    assert.ok(Math.abs(pose.phase-distance/(pose.motion==='run'?1.5:1.15))<1e-10);
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

test('Horizon view exposes sky while framing campaign figures, and resizes without losing its low viewing angle',async()=>{
  const fixture=JSON.parse(await readFile(new URL('./fixtures/campaign-3d.json',import.meta.url),'utf8'));
  for(const scene of fixture.scenes)for(const [width,height] of [[1233,468],[360,420],[844,300]]){
    const e=scene.state.encounter,saved=JSON.stringify(e),stage=cameraStage(e,width,height);stage.horizon();
    const {yaw,pitch,distance}=stage.orbit,target=stage.baseTarget;
    assert.equal(stage.cameraView,'horizon');assert.equal(stage.focusMode,false);assert.ok(distance>=28);
    stage.camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,target.y+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*Math.cos(pitch)*distance);stage.camera.lookAt(target);stage.camera.updateMatrixWorld();
    const horizon=stage.camera.position.clone().add(new T.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)).multiplyScalar(500)).project(stage.camera);
    assert.ok(horizon.y>.2&&horizon.y<.4,'Clear sky fills roughly the upper third.');
    for(const unit of e.units.filter(u=>!u.hidden))for(const height of [0,['cavalry','heavy'].includes(unit.role)?3.1:2.55]){
      const p=stage.world(unit).add(new T.Vector3(0,height,0)).project(stage.camera);
      assert.ok(Math.abs(p.x)<.9&&Math.abs(p.y)<.9,`${scene.id}:${unit.id} remains in the ${width}px field of view.`);
    }
    stage.canvas={getBoundingClientRect:()=>({width:320,height:540})};stage.renderer={setSize(){}};stage.resize();
    assert.equal(stage.orbit.pitch,pitch);assert.equal(stage.baseTarget.y,2.7);assert.ok(stage.orbit.distance>=28);
    stage.home();assert.equal(stage.cameraView,'overview');assert.ok(stage.orbit.pitch>.5);assert.equal(JSON.stringify(e),saved);
  }
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
  const live={id:'live',x:2,y:3,resolve:6,role:'speaker'},withdrawn={id:'withdrawn',x:1,y:3,resolve:0,role:'speaker'},liveMesh=new T.Group(),withdrawnMesh=new T.Group(),surface=new T.Mesh(new T.BoxGeometry(1,1,1));liveMesh.userData.unitId='live';withdrawnMesh.userData.unitId='withdrawn';liveMesh.add(surface);
  Object.assign(stage,{canvas:{getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})},ndc:new T.Vector2(),camera:{},encounter:{units:[withdrawn,live]},actors:new Map([['withdrawn',{group:withdrawnMesh}],['live',{group:liveMesh}]]),ray:{setFromCamera(){},intersectObjects(meshes,recursive){assert.deepEqual(meshes,[surface]);assert.equal(recursive,false);return [{object:surface}];}}});
  assert.deepEqual(stage.pick({clientX:400,clientY:300}),{x:2,y:3,unitId:'live'});
  surface.geometry.dispose();surface.material.dispose();
});

test('Actual weighted actor picking skips hidden skin detail before raycasting while visible bodies remain selectable',async()=>{
  const {createActor}=await import('../src/showcase/actors.js'),unit={id:'hero',side:'player',role:'soldier',x:3,y:3,hp:10},actor=createActor(unit,{chapter:1}),stage=Object.create(BattleStage.prototype),camera=new T.PerspectiveCamera(40,800/600,.1,100);
  actor.group.userData.unitId=unit.id;actor.update({motion:'idle',detailDistance:30});actor.group.updateMatrixWorld(true);camera.position.set(0,1,5);camera.lookAt(0,1,0);camera.updateMatrixWorld(true);
  let hidden=0,visible=0,calls=0;
  actor.group.traverse(o=>{if(!o.isSkinnedMesh)return;if(!o.visible){hidden++;o.raycast=()=>assert.fail('Hidden near-detail skin must not transform vertices during an overview pick.');}else{visible++;const raycast=o.raycast;o.raycast=function(...args){calls++;return raycast.apply(this,args);};}});
  Object.assign(stage,{canvas:{getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})},ndc:new T.Vector2(),camera,ray:new T.Raycaster(),encounter:{units:[unit]},actors:new Map([[unit.id,actor]])});
  assert.ok(hidden>0&&visible>0);assert.deepEqual(stage.pick({clientX:400,clientY:300}),{x:3,y:3,unitId:'hero'});assert.ok(calls>0,'Selection intersects the actual deformed visible body, not a replacement box.');actor.dispose();
});

test('Reused cells attach effects to the reinforcement or current dying victim, never an old defeated token',()=>{
  const old={id:'enemy0',x:2,y:4,hp:0,role:'soldier'},reinforcement={id:'reinforce0',x:2,y:4,hp:6,role:'cavalry'},stage=Object.create(BattleStage.prototype);
  Object.assign(stage,{visibleUnits:[old,reinforcement],world:tile=>new T.Vector3(tile.x,0,tile.y)});
  const saved=JSON.stringify(stage.visibleUnits);
  assert.equal(stage.unitAt({x:2,y:4}),reinforcement,'The live body owns projectile release, impact and label lookup despite the earlier corpse.');
  assert.equal(stage.bodyPoint({x:2,y:4}).y,2.05,'Missiles aim at the actual mounted recipient.');
  assert.equal(stage.unitAt({x:7,y:7}),undefined);
  assert.equal(stage.unitAt(null),undefined);
  assert.equal(JSON.stringify(stage.visibleUnits),saved);

  const dying={...reinforcement,hp:0},timeline={units:{enemy0:{before:{...old}},reinforce0:{before:{...reinforcement}}}};
  stage.visibleUnits=[old,dying];stage.animation={timeline};const frozen=JSON.stringify({units:stage.visibleUnits,timeline});
  assert.equal(stage.unitAt({x:2,y:4}),dying,'A victim alive before this action retains its contact anchor through the withdrawal.');
  assert.equal(stage.bodyPoint({x:2,y:4}).y,2.05);
  assert.equal(JSON.stringify({units:stage.visibleUnits,timeline}),frozen);
  stage.animation=null;assert.equal(stage.unitAt({x:2,y:4}),undefined,'Completed defeats cannot capture a later tile effect.');

  const withdrawn={id:'speaker',role:'speaker',x:2,y:4,hp:6,resolve:0};stage.visibleUnits=[old,withdrawn];
  assert.equal(stage.unitAt({x:2,y:4}),undefined,'Civic Resolve takes precedence over a legacy HP field.');
  stage.animation={timeline:{units:{speaker:{before:{...withdrawn,resolve:3}}}}};
  assert.equal(stage.unitAt({x:2,y:4}),withdrawn,'A currently yielding speaker retains the visible Resolve result.');
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

test('Stage renders 3D tactical guard/aim arcs, records floating preview targets and re-frames overview camera when an operation phase advances',async()=>{
  const stage=Object.create(BattleStage.prototype),overlay=new T.Group();
  const encounter={kind:'battle',units:[{id:'hero',side:'player',hp:10,maxHp:10,x:1,y:1},{id:'ally0',side:'ally',hp:10,maxHp:10,x:1,y:2,specialization:'protector',guardTargetId:'hero'}]};
  Object.assign(stage,{overlay,encounter,visibleUnits:encounter.units,selected:'hero',matrix:new T.Matrix4(),legalTargets:{count:0,instanceMatrix:{count:8,needsUpdate:false},setMatrixAt(){}},hoverRing:new T.Object3D(),world:tile=>new T.Vector3(tile.x*2.5,0,tile.y*2.5)});
  stage.setSelection('hero',[{x:1,y:2,unitId:'ally0'}],{x:1,y:2,unitId:'ally0',previewBadge:{text:'Ward −2 dmg',color:'#edcf7c'}});
  assert.deepEqual(stage.previewTarget,{unitId:'ally0',text:'Ward −2 dmg',color:'#edcf7c'});
  stage.updateTacticalLinks({x:4,y:1});
  assert.equal(stage.tacticalArcs.filter(l=>l.visible).length,2);
  assert.deepEqual(stage.tacticalArcs.filter(l=>l.visible).map(l=>l.userData.linkKind),['guard','aim']);
  stage.updateTacticalLinks(null);
  assert.equal(stage.tacticalArcs.filter(l=>l.visible).length,1);
  for(const line of stage.tacticalArcs){line.geometry.dispose();line.material.dispose();}
  let homed=0;
  Object.assign(stage,{paused:true,focusMode:false,cameraView:'overview',finishMotion(){},sync(after){stage.encounter=after;},home(){homed++;}});
  await stage.play({operation:{index:0}},{operation:{index:1}});
  assert.equal(homed,1);
});


import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import * as Game from '../src/core/game.js';
import {createShowcaseSession} from '../src/showcase/session.js';
import {playEncounter,runCampaign} from '../scripts/autoplay.mjs';
import {buildEncounterTimeline,sampleEncounterTimeline} from '../src/ui/animation-timeline.js';
import {actorPose,horsePose,actionEnvelope,locomotionPhase,locomotionStride,groundHumanPose,groundHorsePose} from '../src/showcase/actor-pose.js';
import {createActor} from '../src/showcase/actors.js';
import {retimeStageTimeline,combatReaction,combatCues,meleeOffset} from '../src/showcase/combat-presentation.js';
import {BattleStage} from '../src/showcase/stage.js';

const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;};
const near=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ≠ ${b}`);
const point=o=>o.getWorldPosition(new T.Vector3());

test('Real legal opening commands keep contact, projectile, move dependencies and exact completion after 3D retiming',()=>{
  const run=createShowcaseSession(),trace=[];playEncounter(run,{style:'tactical',trace});const state=createShowcaseSession();let movement=0,shots=0,reactions=0;
  for(const step of trace){
    const before=structuredClone(state.encounter),result=step.kind==='act'?Game.act(state,step.payload):Game.endTurn(state);assert.ok(result.ok);
    const after=structuredClone(state.encounter),saved=Game.serialize(state),original=freeze(buildEncounterTimeline(before,after,{command:step.kind==='act'?step.payload:{action:'endTurn'}})),encoded=JSON.stringify(original),timeline=retimeStageTimeline(original);
    assert.equal(JSON.stringify(original),encoded);assert.notEqual(timeline,original);assert.ok(timeline.duration>=0&&timeline.duration<6000);assert.deepEqual(retimeStageTimeline(timeline),timeline,'Repeated presentation mounting must not stretch a timeline twice.');
    for(const track of timeline.tracks){
      if(track.path?.length>1){movement++;assert.ok(track.duration>original.tracks.find(t=>t.unitId===track.unitId&&t.path).duration*1.65,'Real travel has time to read.');assert.ok(track.duration<=2400);}
      if(track.target&&!track.path){const move=timeline.tracks.find(t=>t.unitId===track.unitId&&t.path);if(move)assert.ok(track.start>=move.start+move.duration,'An actor does not attack while its own walk is unfinished.');}
      if(track.pose==='hit'||track.pose==='retreat'){
        const effect=timeline.effects.find(e=>['impact','shield'].includes(e.type)&&e.at.x===timeline.units[track.unitId].after.x&&e.at.y===timeline.units[track.unitId].after.y&&Math.abs(e.start-track.start)<1e-6);assert.ok(effect,'Reaction and committed impact share a clock.');reactions++;
      }
    }
    for(const effect of timeline.effects.filter(e=>e.type==='projectile')){
      const source=Object.entries(timeline.units).find(([,p])=>p.after.x===effect.from.x&&p.after.y===effect.from.y)?.[0],track=timeline.tracks.find(t=>t.unitId===source&&t.pose==='throw');assert.ok(track);near(effect.start,track.start+track.duration*.5);shots++;
      const hit=timeline.effects.find(e=>['impact','shield'].includes(e.type)&&e.at.x===effect.to.x&&e.at.y===effect.to.y&&Math.abs(e.start-(effect.start+effect.duration))<1e-6);assert.ok(hit,'Visible projectile arrives exactly when recorded damage reacts.');
    }
    const complete=sampleEncounterTimeline(timeline,timeline.duration);assert.equal(complete.complete,true);assert.equal(complete.effects.length,0);
    for(const [id,pair]of Object.entries(timeline.units)){near(complete.unitOverrides[id].x,pair.after.x);near(complete.unitOverrides[id].y,pair.after.y);}
    for(const cue of combatCues(timeline,{encounter:after}))assert.ok(cue.time>=0&&cue.time<=timeline.duration);
    assert.equal(Game.serialize(state),saved);
  }
  assert.ok(movement>0&&shots>0&&reactions>0);assert.equal(state.encounter.status,'won');
});

test('Independent units stay concurrent while an attack waits for a moving target to reach contact',()=>{
  const unit=(id,x,y)=>({id,x,y,hp:10,maxHp:10,side:'enemy',name:id}),units={a:{before:unit('a',0,0),after:unit('a',1,0)},b:{before:unit('b',4,0),after:unit('b',2,0)}};
  const original=freeze({units,tracks:[{unitId:'a',pose:'walk',start:0,duration:330,path:[{x:0,y:0},{x:1,y:0}],from:{x:0,y:0},to:{x:1,y:0}},{unitId:'b',pose:'walk',start:0,duration:480,path:[{x:4,y:0},{x:3,y:0},{x:2,y:0}],from:{x:4,y:0},to:{x:2,y:0}},{unitId:'a',pose:'attack',start:370,duration:620,target:{x:2,y:0}},{unitId:'b',pose:'hit',start:600,duration:360,source:{x:1,y:0}}],effects:[{type:'impact',at:{x:2,y:0},source:{x:1,y:0},start:600,duration:230}],duration:990});
  const t=retimeStageTimeline(original),[a,b,attack,hit]=t.tracks;
  assert.equal(a.start,b.start);assert.ok(a.duration>1000&&b.duration<=2400);near(hit.start,attack.start+230*1.65);assert.ok(hit.start>=b.start+b.duration);near(t.effects[0].start,hit.start);
});

test('The complete legal New Game route retimes every encounter without early effects or changed saves',async()=>{
  const run=await runCampaign(),state=Game.newGame('Aurelius Marcellus',275),seen=new Set();let shots=0,reactions=0;
  for(const step of run.trace){
    const before=state.encounter&&structuredClone(state.encounter),arg=step.payload??step.option??step.options??step.value,result=Game[step.kind](state,arg);assert.ok(result.ok,`${step.kind}: ${result.message}`);
    if(!['act','endTurn'].includes(step.kind))continue;
    const saved=Game.serialize(state),original=buildEncounterTimeline(before,state.encounter,{command:step.kind==='act'?step.payload:{action:'endTurn'}}),t=retimeStageTimeline(original);seen.add(state.encounter.id);
    for(const track of original.tracks.filter(t=>['attack','cavalry-attack','throw'].includes(t.pose))){const prior=original.units[track.unitId].before;assert.ok((prior.resolve??prior.hp??1)>0,'An already-withdrawn namesake never attacks again.');}
    assert.ok(t.duration>=0&&t.duration<=6000,`${state.encounter.id}: ${t.duration}`);
    for(const [i,old]of original.effects.entries()){
      const effect=t.effects[i];assert.ok(effect.start>=0&&effect.start+effect.duration<=t.duration+1e-7);
      if(old.type==='projectile'){
        shots++;const source=Object.entries(original.units).find(([,p])=>p.after.x===old.from.x&&p.after.y===old.from.y)?.[0],track=t.tracks.find(track=>track.unitId===source&&track.pose==='throw');assert.ok(track);near(effect.start,track.start+track.duration*.5);
        const priorHit=original.effects.findIndex(e=>['shield','impact'].includes(e.type)&&e.at.x===old.to.x&&e.at.y===old.to.y&&Math.abs(e.start-old.start-old.duration)<1e-6);
        if(priorHit>=0)near(t.effects[priorHit].start,effect.start+effect.duration);
      }
    }
    for(const [i,old]of original.tracks.entries())if(['hit','retreat'].includes(old.pose)){
      const unit=original.units[old.unitId].after,j=original.effects.findIndex(e=>['shield','impact'].includes(e.type)&&e.at.x===unit.x&&e.at.y===unit.y&&Math.abs(e.start-old.start)<1e-6);if(j>=0){near(t.tracks[i].start,t.effects[j].start);reactions++;}
    }
    for(const cue of combatCues(t,{encounter:state.encounter}))assert.ok(cue.time>=0&&cue.time<=t.duration+1e-7);
    assert.equal(Game.serialize(state),saved);
  }
  assert.equal(seen.size,25);assert.ok(shots>10&&reactions>30);assert.equal(state.phase,'epilogue');assert.equal(Game.serialize(state),Game.serialize(run.state));
});

test('A named movement disambiguates living raiders and a withdrawn namesake never steals the animation',()=>{
  const unit=(id,x,y,hp,name)=>({id,x,y,hp,maxHp:10,name,role:'raider',facing:'south'}),before={id:'same-names',kind:'battle',width:8,height:8,terrain:Array.from({length:8},()=>Array(8).fill('grass')),log:[],units:[unit('dead',3,4,0,'Gothic raider'),unit('first',3,3,7,'Gothic raider'),unit('second',5,4,7,'Gothic raider'),unit('ally',3,5,10,'Lucan')]},after=structuredClone(before);
  Object.assign(after.units[1],{x:3,y:4});after.units[3].hp=7;after.log=['Gothic raider moves to 4E.','Gothic raider strikes Lucan for 3.'];
  const t=buildEncounterTimeline(before,after,{command:{action:'endTurn'}}),attacks=t.tracks.filter(t=>t.pose==='attack');assert.deepEqual(attacks.map(t=>t.unitId),['first']);assert.deepEqual(attacks[0].target,{x:3,y:5});
  after.log=['Gothic raider strikes Lucan for 3.'];const ambiguous=buildEncounterTimeline(before,after,{command:{action:'endTurn'}});assert.equal(ambiguous.tracks.filter(t=>t.pose==='attack').length,0);assert.ok(ambiguous.effects.some(e=>e.type==='impact'),'An ambiguous name retains the actual result without inventing a source.');
});

test('Footfall cues follow physical planted steps through eased travel rather than evenly spaced time',()=>{
  for(const pose of ['walk','run','cavalry-move']){
    const t=retimeStageTimeline({duration:660,units:{hero:{before:{id:'hero',side:'player',x:0,y:0},after:{id:'hero',side:'player',x:2,y:0}}},tracks:[{unitId:'hero',pose,start:0,duration:630,path:[{x:0,y:0},{x:1,y:0},{x:2,y:0}],from:{x:0,y:0},to:{x:2,y:0}}],effects:[]}),track=t.tracks[0],cues=combatCues(t,{encounter:{terrain:[['grass','stone','grass']]}}),stride=locomotionStride(pose,pose==='cavalry-move');
    assert.ok(cues.length>=4&&cues.length<=14);
    for(const [i,cue]of cues.entries()){
      const frame=sampleEncounterTimeline(t,cue.time),distance=frame.unitOverrides.hero.x*2.5;near(distance,(i+1)*stride/2,1e-5);
      const p=pose==='cavalry-move'?horsePose({motion:'run',locomotionDistance:distance}):actorPose({motion:pose,locomotionDistance:distance});assert.ok(p.feet.some(f=>Math.abs(f.y-(pose==='cavalry-move'?.075:.07))<1e-6),'At least one real foot/hoof is planted at every emitted landing.');
    }
    assert.ok(cues.some(c=>c.surface==='stone'));assert.ok(Math.abs((cues[1].time-cues[0].time)-(cues[2].time-cues[1].time))>2,'Acceleration makes landing intervals nonuniform.');
  }
});

test('Guarded reaction requires a real shield event, recoils away from source and never rotates the victim',()=>{
  const unit={id:'victim',x:2,y:2,facing:'south'},frame={time:140,unitOverrides:{victim:{pose:'hit',facing:'south'}}},track={unitId:'victim',pose:'hit',start:100,duration:360,source:{x:3,y:2}},timeline={tracks:[track],effects:[{type:'shield',at:{x:2,y:2},start:100,defended:true}]},saved=JSON.stringify({unit,frame,timeline});
  const reaction=combatReaction(unit,frame,timeline,0);assert.equal(reaction.motion,'block');assert.equal(reaction.defended,true);near(reaction.impactDirection,Math.PI/2);
  const block=actorPose({motion:'block',phase:.12,...reaction}),bare=actorPose({motion:'hit',phase:.12,impactDirection:reaction.impactDirection});assert.ok(block.hipX<0&&bare.hipX<0,'Right-side contact transfers weight to the left.');assert.equal(block.yaw,0);assert.ok(Math.abs(block.bodyZ)<Math.abs(bare.bodyZ));
  assert.equal(combatReaction(unit,frame,{...timeline,effects:[{...timeline.effects[0],political:true}]}).motion,undefined,'A political reaction never invents a shield block.');assert.deepEqual(combatReaction(unit,{...frame,time:900},timeline),{});assert.equal(JSON.stringify({unit,frame,timeline}),saved);
  const peak=actorPose({motion:'hit',phase:.12}),late=actorPose({motion:'hit',phase:.6});assert.ok(peak.bodyX>late.bodyX,'Contact compresses promptly, then recovers rather than winding up after the hit.');
  assert.equal(JSON.stringify(actorPose({motion:'block',phase:1})),JSON.stringify(actorPose({braced:true})));
});

test('Strike loads before moving forward, reaches at the committed instant and recovers without a drifting foot',()=>{
  const actor=createActor({id:'hero',side:'player'}),initial=point(actor.contacts.weapon),track={tracks:[{unitId:'hero',pose:'attack',target:{x:0,y:1}}]},at=p=>meleeOffset({id:'hero'},{x:0,y:0,pose:'attack',progress:p},track);
  assert.ok(at(.20).z<0,'Anticipation transfers weight backward instead of sliding toward the victim.');near(at(230/620).z,.85);
  actor.update({motion:'attack',phase:.25,resetPose:true,groundHeight:()=>0});const loaded=point(actor.contacts.weapon);actor.update({motion:'attack',phase:230/620,resetPose:true,groundHeight:()=>0});const contact=point(actor.contacts.weapon);assert.ok(contact.z>loaded.z+.5);assert.ok(contact.y>1&&contact.y<1.6,'Contact remains on a human torso-height line.');
  for(const name of ['right-thigh','left-thigh']){const ankle=point(actor.group.getObjectByName(name).getObjectByName('ankle'));near(ankle.y,.07*actor.group.scale.y,1e-5);}
  actor.update({motion:'attack',phase:1,resetPose:true,groundHeight:()=>0});assert.ok(point(actor.contacts.weapon).distanceTo(initial)<1e-6);assert.equal(at(1).z,0);actor.dispose();
  for(const motion of ['attack','throw']){const phase=motion==='throw'?.5:230/620;near(actionEnvelope(motion,phase).reach,1);near(actionEnvelope(motion,0).reach,0);near(actionEnvelope(motion,1).reach,0);}
});

test('Physical gait increases travel per stride while grounded IK keeps supported feet reachable on slopes',()=>{
  for(const motion of ['walk','run']){
    const stride=locomotionStride(motion),start=.12*stride,end=.45*stride,a=actorPose({motion,locomotionDistance:start}),b=actorPose({motion,locomotionDistance:end});near(end-start+b.feet[0].z-a.feet[0].z,0);near(locomotionPhase(end,motion),.45);
    for(let i=0;i<=40;i++){const p=groundHumanPose(actorPose({motion,locomotionDistance:i/40*stride}),[{height:.13,pitch:.10},{height:-.09,pitch:.1}]);
      for(const [j,foot]of p.feet.entries()){const l=p.legs[j],y=p.hipY+(-.43*Math.cos(l.thigh)-.43*Math.cos(l.thigh+l.knee))*Math.cos(l.splay),z=p.hipZ-.43*Math.sin(l.thigh)-.43*Math.sin(l.thigh+l.knee);near(y,foot.y);near(z,foot.z);}
    }
  }
  for(let i=0;i<=40;i++){const p=groundHorsePose(horsePose({motion:'run',locomotionDistance:i/40*1.8}),Array.from({length:4},(_,j)=>({height:j<2?.12:-.06})));assert.ok(p.legs.every(l=>Object.values(l).every(Number.isFinite)));}
});

test('Reduced motion and cancellation settle the committed state without delaying or resolving a play twice',async()=>{
  const state=createShowcaseSession(),before=structuredClone(state.encounter),target=Game.getTargets(state,'hero','move')[0],command={unitId:'hero',action:'move',x:target.x,y:target.y};assert.ok(Game.act(state,command).ok);const after=structuredClone(state.encounter),saved=Game.serialize(state);
  const stage=Object.create(BattleStage.prototype);Object.assign(stage,{reducedMotion:true,paused:false,actors:new Map(),projectiles:[],sparkClouds:[],effectRings:[],sound:{unlock(){}},sync(e){this.encounter=e;}});
  await stage.play(before,after,command);assert.equal(stage.animation,undefined);assert.equal(stage.encounter,after);
  stage.reducedMotion=false;let settled=0;const playing=stage.play(before,after,command).then(()=>settled++);assert.equal(stage.animation.timeline.stageTiming,true);assert.equal(stage.animation.scale,1);stage.finishMotion();stage.finishMotion();await playing;assert.equal(settled,1);assert.equal(Game.serialize(state),saved);
});

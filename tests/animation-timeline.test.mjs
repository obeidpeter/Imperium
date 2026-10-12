import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEncounterTimeline,sampleEncounterTimeline,idlePose,MOTION_BUDGETS} from '../src/ui/animation-timeline.js';
import {snapshotEncounter,playEncounterMotion} from '../src/ui/motion.js';
import {sampleSpritePose} from '../src/ui/sprite-poses.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const unit=(id,x,y,extra={})=>({id,name:id,side:id==='hero'?'player':'enemy',role:'infantry',x,y,hp:12,maxHp:12,morale:80,facing:'east',...extra});
const encounter=units=>({id:'test-field',kind:'battle',width:8,height:8,turn:1,status:'active',terrain:Array.from({length:8},()=>Array(8).fill('grass')),units,log:[],turnEvents:[]});
const frameAt=(timeline,pose,progress=.5)=>{const track=timeline.tracks.find(t=>t.pose===pose);assert.ok(track,pose);return sampleEncounterTimeline(timeline,track.start+track.duration*progress);};

test('Timeline is detached and deterministic and movement follows passable orthogonal terrain',()=>{
  const before=encounter([unit('hero',0,1),unit('blocker',1,1)]);before.terrain[1][2]='rock';const after=clone(before);after.units[0].x=4;const frozen=JSON.stringify({before,after});
  const first=buildEncounterTimeline(before,after,{command:{unitId:'hero',action:'move',x:4,y:1}}),second=buildEncounterTimeline(before,after,{command:{unitId:'hero',action:'move',x:4,y:1}});assert.deepEqual(first,second);
  const path=first.tracks.find(t=>t.path).path;assert.deepEqual(path[0],{x:0,y:1});assert.deepEqual(path.at(-1),{x:4,y:1});for(let i=1;i<path.length;i++){assert.equal(Math.abs(path[i].x-path[i-1].x)+Math.abs(path[i].y-path[i-1].y),1);assert.notEqual(before.terrain[path[i].y][path[i].x],'rock');assert.notDeepEqual(path[i],{x:1,y:1});}
  const mid=sampleEncounterTimeline(first,first.duration*.4);assert.notEqual(mid.unitOverrides.hero.x,4);assert.deepEqual(sampleEncounterTimeline(first,first.duration).unitOverrides.hero.x,4);assert.equal(JSON.stringify({before,after}),frozen);
  first.units.hero.after.x=99;assert.equal(after.units[0].x,4);
});

test('Attack has distinct anticipation, impact and recovery, followed by a matching hit reaction',()=>{
  const before=encounter([unit('hero',2,3),unit('enemy',3,3)]),after=clone(before);after.units[1].hp=8;
  const timeline=buildEncounterTimeline(before,after,{command:{unitId:'hero',action:'strike',targetId:'enemy',x:3,y:3}});
  const a=frameAt(timeline,'attack',.1).unitOverrides.hero,i=frameAt(timeline,'attack',.4).unitOverrides.hero,r=frameAt(timeline,'attack',.8).unitOverrides.hero;
  assert.equal(a.phase,'anticipation');assert.equal(i.phase,'impact');assert.equal(r.phase,'recovery');assert.ok(a.weapon<0);assert.ok(i.weapon>a.weapon);assert.ok(r.weapon<i.weapon);assert.ok(timeline.tracks.some(t=>t.unitId==='enemy'&&t.pose==='hit'));assert.ok(timeline.effects.some(e=>e.type==='impact'&&e.delta===-4));
});

test('Javelin leaves the thrower after wind-up and arrives before target recovery',()=>{
  const before=encounter([unit('hero',1,3),unit('enemy',4,3)]),after=clone(before);after.units[1].hp=9;
  const timeline=buildEncounterTimeline(before,after,{command:{unitId:'hero',action:'throw',targetId:'enemy',x:4,y:3}}),projectile=timeline.effects.find(e=>e.type==='projectile'),hit=timeline.tracks.find(t=>t.pose==='hit');
  assert.ok(projectile.start>timeline.tracks.find(t=>t.pose==='throw').start);assert.equal(projectile.start+projectile.duration,hit.start);const effect=sampleEncounterTimeline(timeline,projectile.start+projectile.duration/2).effects.find(e=>e.type==='projectile');assert.equal(effect.progress,.5);assert.ok(effect.height>0);assert.deepEqual(effect.from,{x:1,y:3});assert.deepEqual(effect.to,{x:4,y:3});
  const release=sampleSpritePose(sampleEncounterTimeline(timeline,projectile.start).unitOverrides.hero);
  assert.ok(release.arm>0&&release.reach>7,'projectile releases from the extended throwing pose, after wind-up');
});

test('Brace, shield impacts, rally and formation cues render from committed visual changes',()=>{
  const before=encounter([unit('hero',1,3),unit('ally',2,3,{side:'ally'})]),after=clone(before);after.units[0].braced=true;
  assert.ok(buildEncounterTimeline(before,after,{command:{unitId:'hero',action:'brace'}}).tracks.some(t=>t.pose==='brace'));
  const struck=clone(after);struck.units[0].hp=10;assert.ok(buildEncounterTimeline(after,struck).effects.some(e=>e.type==='shield'&&e.defended));
  after.units[1].morale=100;assert.ok(buildEncounterTimeline(before,after,{command:{unitId:'hero',action:'rally'}}).tracks.some(t=>t.pose==='rally'));
  after.units[1].formation='wedge';after.units[1].ordered=true;const formation=buildEncounterTimeline(before,after,{command:{unitId:'hero',action:'formation',targetId:'ally',formation:'wedge'}});assert.ok(formation.tracks.some(t=>t.unitId==='ally'&&t.pose==='formation'));assert.ok(formation.tracks.some(t=>t.unitId==='hero'&&t.pose==='order'));
});

test('Cavalry has mounted movement and attack poses, turning retains its prior direction',()=>{
  const before=encounter([unit('horse',1,1,{role:'cavalry',side:'ally',facing:'south'}),unit('enemy',4,1)]),after=clone(before);Object.assign(after.units[0],{x:3,facing:'east'});after.units[1].hp=7;
  const timeline=buildEncounterTimeline(before,after,{command:{unitId:'horse',action:'strike',targetId:'enemy'}});assert.ok(timeline.tracks.some(t=>t.pose==='cavalry-move'));assert.ok(timeline.tracks.some(t=>t.pose==='cavalry-attack'));const frame=sampleEncounterTimeline(timeline,0).unitOverrides.horse;assert.equal(frame.previousFacing,'south');assert.equal(frame.turnProgress,0);
  const turned=clone(before);turned.units[0].facing='north';assert.ok(buildEncounterTimeline(before,turned).tracks.some(t=>t.pose==='turn'));assert.notEqual(idlePose(before.units[0],0).bob,idlePose(before.units[0],200).bob);
});

test('Withdrawal animates a visible survivor into retreat before removing it',()=>{
  const before=encounter([unit('hero',1,3),unit('enemy',2,3)]),after=clone(before);after.units[1].hp=0;after.status='won';
  const timeline=buildEncounterTimeline(before,after,{command:{unitId:'hero',action:'strike',targetId:'enemy'}}),track=timeline.tracks.find(t=>t.pose==='retreat');
  assert.ok(track);assert.equal(sampleEncounterTimeline(timeline,0).unitOverrides.enemy.alpha,1);const mid=sampleEncounterTimeline(timeline,track.start+track.duration/2).unitOverrides.enemy;assert.ok(mid.alpha>0&&mid.alpha<1);assert.equal(sampleEncounterTimeline(timeline,timeline.duration).unitOverrides.enemy.alpha,0);assert.ok(timeline.effects.some(e=>e.type==='victory'));
});

test('Political speech, changed stance and Resolve withdrawal share the same timeline vocabulary',()=>{
  const before=encounter([unit('hero',1,3,{role:'speaker',resolve:12}),unit('delegate',2,3,{side:'neutral',role:'voter',stance:0}),unit('rival',3,3,{role:'speaker',resolve:3})]);before.kind='contest';const after=clone(before);after.units[1].stance=4;
  const speech=buildEncounterTimeline(before,after,{command:{unitId:'hero',action:'persuade',targetId:'delegate'}});assert.ok(speech.tracks.some(t=>t.pose==='speak'));assert.ok(speech.effects.some(e=>e.type==='speech'&&e.action==='persuade'));assert.ok(speech.effects.some(e=>e.type==='stance'&&e.delta===4));
  after.units[2].resolve=after.units[2].hp=0;const denounce=buildEncounterTimeline(before,after,{command:{unitId:'hero',action:'denounce',targetId:'rival'}});assert.ok(denounce.tracks.some(t=>t.unitId==='rival'&&t.pose==='retreat'));assert.equal(denounce.effects.filter(e=>e.type==='impact'&&e.at.x===3).length,1);
});

test('Recorded NPC attacks animate their named actor, including an ordered ally acting inside a player command',()=>{
  const before=encounter([unit('hero',0,3),unit('Lucan',2,3,{side:'ally'}),unit('Goth',3,3)]),after=clone(before);before.log=Array(70).fill('old');after.log=[...before.log.slice(2),'Lucan strikes Goth for 3.','Order executed.'];after.units[2].hp=9;
  const timeline=buildEncounterTimeline(before,after,{command:{unitId:'hero',action:'order',targetId:'Lucan'}});assert.ok(timeline.tracks.some(t=>t.unitId==='Lucan'&&t.pose==='attack'));assert.ok(timeline.tracks.some(t=>t.unitId==='hero'&&t.pose==='order'));
});

test('Hidden units and unrelated encounters cannot leak into animation tracks or effects',()=>{
  const before=encounter([unit('hidden',6,6,{hidden:true}),unit('hero',0,0)]),after=clone(before);Object.assign(after.units[0],{x:5,hp:0,side:'ally'});
  const timeline=buildEncounterTimeline(before,after,{command:{unitId:'hidden',action:'strike',targetId:'hero'}});assert.equal(timeline.duration,0);assert.deepEqual(timeline.tracks,[]);assert.deepEqual(timeline.effects,[]);assert.equal(buildEncounterTimeline(before,{...after,id:'other'}).duration,0);
});

test('Every quality tier keeps essential movement and outcomes while bounding effect and time cost',()=>{
  const before=encounter(Array.from({length:30},(_,i)=>unit('u'+i,i%8,Math.floor(i/8)))),after=clone(before);for(const u of after.units){u.x=(u.x+1)%8;u.hp-=2;u.morale-=5;}
  for(const quality of Object.keys(MOTION_BUDGETS)){const timeline=buildEncounterTimeline(before,after,{quality});assert.ok(timeline.duration<=1100);assert.ok(timeline.effects.length<=MOTION_BUDGETS[quality].effects);assert.ok(timeline.tracks.length<=96);assert.equal(Object.keys(timeline.units).length,30);assert.ok(timeline.effects.every(e=>e.essential));for(const t of [0,timeline.duration/2,timeline.duration])for(const pose of Object.values(sampleEncounterTimeline(timeline,t).unitOverrides))for(const key of ['x','y','alpha','bob','lean','weapon','shield'])assert.ok(Number.isFinite(pose[key]),key);}
});

function browser(){
  const callbacks=new Map(),listeners=new Map(),layers=[];let next=0,clock=0;
  const node=()=>({style:{},children:[],setAttribute(){},append(child){this.children.push(child);},remove(){this.removed=true;},animate(){return {cancel(){}};}});
  const win={performance:{now:()=>clock},requestAnimationFrame(fn){callbacks.set(++next,fn);return next;},cancelAnimationFrame(id){callbacks.delete(id);},addEventListener(){},removeEventListener(){}};
  const doc={hidden:false,defaultView:win,body:{append(layer){layers.push(layer);}},createElement:node,createElementNS:node,addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type){listeners.delete(type);}};
  const canvas={isConnected:true,ownerDocument:doc,getBoundingClientRect:()=>({left:0,top:0,width:360,height:196})};
  return {canvas,doc,layers,callbacks,listeners,tick(time){clock=time;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(fn=>fn(time));}};
}

test('Frame player renders real unit positions then restores final state once, without lingering RAF work',()=>{
  const b=browser(),before=encounter([unit('hero',0,3)]),after=clone(before);after.units[0].x=3;const frames=[],cancel=playEncounterMotion(b.canvas,before,after,{command:{unitId:'hero',action:'move'},renderFrame:frame=>frames.push(frame)});
  assert.equal(frames[0].unitOverrides.hero.x,0);b.tick(180);assert.ok(frames.at(-1).unitOverrides.hero.x>0&&frames.at(-1).unitOverrides.hero.x<3);b.tick(2000);assert.equal(frames.at(-1),null);assert.equal(frames.filter(f=>f===null).length,1);assert.equal(b.callbacks.size,0);assert.equal(b.layers[0].removed,true);cancel();assert.equal(frames.filter(f=>f===null).length,1);
});

test('Rapid commands, page hiding, detachment and reduced motion cancel all animation work',()=>{
  const b=browser(),before=encounter([unit('hero',0,3)]),after=clone(before);after.units[0].x=2;const first=[],second=[];
  const cancel=playEncounterMotion(b.canvas,before,after,{renderFrame:f=>first.push(f)});playEncounterMotion(b.canvas,before,after,{renderFrame:f=>second.push(f)});assert.equal(first.at(-1),null);assert.equal(b.callbacks.size,1);b.doc.hidden=true;b.listeners.get('visibilitychange')();assert.equal(second.at(-1),null);assert.equal(b.callbacks.size,0);cancel();
  b.doc.hidden=false;const reduced=[];playEncounterMotion(b.canvas,before,after,{reducedMotion:true,renderFrame:f=>reduced.push(f)});assert.deepEqual(reduced,[null]);assert.equal(b.callbacks.size,0);
  const detached=[];playEncounterMotion(b.canvas,before,after,{renderFrame:f=>detached.push(f)});b.canvas.isConnected=false;b.tick(20);assert.equal(detached.at(-1),null);assert.equal(b.callbacks.size,0);
});

test('Visual snapshots retain pose data while keeping terrain, logs and units detached',()=>{const source=encounter([unit('hero',1,3,{formation:'line',braced:true,ammo:2,ordered:true})]),snapshot=snapshotEncounter(source);source.terrain[0][0]='river';source.log.push('Changed');source.units[0].facing='south';assert.equal(snapshot.terrain[0][0],'grass');assert.equal(snapshot.log.length,0);assert.equal(snapshot.units[0].facing,'east');assert.equal(snapshot.units[0].formation,'line');assert.equal(snapshot.units[0].ammo,2);});


test('Performance quality throttles repaint work while delivering the same final position',()=>{
  const counts={};for(const quality of ['performance','balanced']){
    const b=browser(),before=encounter([unit('hero',0,3)]),after=clone(before),frames=[];after.units[0].x=3;
    playEncounterMotion(b.canvas,before,after,{quality,command:{unitId:'hero',action:'move'},renderFrame:f=>frames.push(f)});
    for(let ms=8;ms<=1200;ms+=8)b.tick(ms);
    const painted=frames.filter(Boolean);counts[quality]=painted.length;assert.equal(painted.at(-1).unitOverrides.hero.x,3);assert.equal(frames.at(-1),null);assert.equal(b.callbacks.size,0);
  }
  assert.ok(counts.performance<counts.balanced);assert.ok(counts.performance>=8);
});

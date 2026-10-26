import test from 'node:test';
import assert from 'node:assert/strict';
import {acousticSpace,createWorldAcoustics} from '../src/showcase/world-acoustics.js';
const world=()=>({kind:'camp',chapter:8,tick:0,controlled:'hero',places:{principia:{x:20,z:20},quartermaster:{x:12,z:12}},map:{width:20,height:20,terrain:Array.from({length:20},()=>Array(20).fill('stone'))},actors:[{id:'hero',x:1,z:1,alive:true,moving:true}]});
test('Local sound reads real service positions and makes no campaign changes',()=>{
  const w=world(),before=JSON.stringify(w);assert.deepEqual(acousticSpace(w,w.actors[0]),{enclosed:false,place:null,ambience:'river'});
  assert.equal(acousticSpace(w,{x:20,z:20}).enclosed,true);assert.equal(acousticSpace(w,{x:12,z:12}).ambience,'workshop');
  assert.equal(acousticSpace({...w,kind:'chamber'},w.actors[0]).enclosed,true);assert.equal(JSON.stringify(w),before);
});
test('Footsteps follow travelled distance and the actual surface; pause, Retry and teleports cannot burst cues',()=>{
  const w=world(),s=createWorldAcoustics();assert.equal(s.sample(w).cues.length,0);
  w.tick++;w.actors[0].x+=.8;assert.deepEqual(s.sample(w,{now:200}).cues,[{kind:'footstep',surface:'stone',intensity:.32}]);
  assert.equal(s.sample(w,{now:400}).cues.length,0);
  w.tick++;w.actors[0].x+=1;assert.equal(s.sample(w,{now:600,paused:true}).cues.length,0);
  w.tick=0;w.actors[0].x=30;assert.equal(s.sample(w,{now:800}).cues.length,0);
  w.tick++;w.actors[0].x+=.8;w.map.terrain[0][12]='ford';assert.equal(s.sample(w,{now:1000}).cues[0].kind,'wade');
  w.tick++;w.actors[0].x+=1;assert.equal(s.sample(w,{now:10000}).cues.length,0);
});
test('An idle render cannot consume a due ambience cue, and object-form terrain retains wet footsteps',()=>{
  const w=world(),s=createWorldAcoustics();w.actors[0].moving=false;
  s.sample(w,{now:5990});assert.deepEqual(s.sample(w,{now:6001}).cues,[]);
  w.tick++;assert.equal(s.sample(w,{now:6050}).cues.filter(c=>c.environment).length,1);
  w.tick++;assert.deepEqual(s.sample(w,{now:6100}).cues,[]);
  w.map.terrain[0][0]={type:'ford'};w.actors[0].moving=true;w.actors[0].x+=.8;w.tick++;
  assert.equal(s.sample(w,{now:6300}).cues[0].kind,'wade');
});
test('Environmental sound is bounded, silent in battles and during paused simulation, with no catch-up on resume',()=>{
  const w=world(),s=createWorldAcoustics();w.actors[0].moving=false;s.sample(w,{now:5900});w.tick++;
  assert.equal(s.sample(w,{now:6100}).cues.filter(c=>c.environment).length,1);
  w.tick++;assert.equal(s.sample(w,{now:6200}).cues.length,0);
  w.tick++;assert.equal(s.sample(w,{now:12100,paused:true}).cues.length,0);
  w.tick++;assert.equal(s.sample(w,{now:12200}).cues.length,0);
  w.tick++;w.kind='battle';assert.equal(s.sample(w,{now:18100}).cues.length,0);
});

test('A nearby cavalry company adds one quiet panned hoof cue, without revealing hidden enemies or accumulating at pause',()=>{
  const w=world(),s=createWorldAcoustics();w.kind='battle';w.actors[0].moving=false;
  const cavalry={id:'escort',side:'player',role:'cavalry',x:5,z:1,alive:true,moving:true};
  w.actors.push(cavalry,{...cavalry,id:'hidden-foe',side:'enemy',x:2,hidden:true});s.sample(w,{now:0});w.tick++;
  assert.deepEqual(s.sample(w,{now:200}).cues,[{kind:'hoof',surface:'stone',intensity:.12,pan:.4}]);
  w.tick++;assert.equal(s.sample(w,{now:250}).cues.length,0);w.tick++;assert.equal(s.sample(w,{now:2000,paused:true}).cues.length,0);
  cavalry.alive=false;w.tick++;assert.equal(s.sample(w,{now:2050}).cues.length,0);s.reset();
  w.actors=w.actors.filter(a=>a.id!=='escort');s.sample(w,{now:2100});w.tick++;assert.equal(s.sample(w,{now:2800}).cues.length,0);
});

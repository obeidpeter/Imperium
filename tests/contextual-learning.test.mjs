import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Game from '../src/core/game.js';
import * as Chamber from '../src/core/chamber.js';
import {createWorld,queueCommand,step,snapshotWorld} from '../src/core/realtime/simulation.js';
import {deploy,soundTheAdvance} from '../src/core/realtime/deployment.js';
import {ROMAN_SQUADS} from '../src/data/realtime-squads.js';
import {realtimeLesson,lessonProgress,rememberLesson} from '../src/ui/realtime-lessons.js';
import {loadSettings} from '../src/ui/settings.js';

// Small authored teaching scenarios, not campaign-completion fixtures. Every
// progress transition uses the same public command that a player can issue.
const world=over=>createWorld({seed:7,map:{width:24,height:20,terrain:Array.from({length:20},()=>Array(24).fill('grass'))},
  actors:[{id:'hero',name:'Learner',side:'player',at:[5,5],kit:['tunic','gladius'],ai:false},
    {id:'opposition',name:'Distant observer',side:'enemy',at:[55,45],kit:['tunic','gladius'],ai:false}],...over});
const lesson=(w,over={})=>{const before=snapshotWorld(w),l=realtimeLesson({state:{chapter:5},world:w,...over});assert.equal(snapshotWorld(w),before);return l;};

test('deployment exercise advances only after accepted placement and the public advance command',()=>{
  const w=world();w.deployment={zone:{x0:0,x1:12,z0:0,z1:40},done:false,placed:0};
  assert.equal(lesson(w).id,'deployment');assert.match(lesson(w).step,/1 \/ 3/);
  assert.equal(deploy(w,{id:'hero',x:20,z:10}).ok,false);assert.match(lesson(w).step,/1 \/ 3/);
  assert.equal(deploy(w,{id:'hero',x:8,z:10}).ok,true);assert.match(lesson(w).step,/2 \/ 3/);
  assert.equal(w.tick,0);assert.equal(soundTheAdvance(w).ok,true);assert.equal(lesson(w).complete,true);assert.equal(w.tick,0);
});

test('order exercise distinguishes selection, reservation and an order that actually reached the squad',()=>{
  const w=world({command:2,squads:[{id:'a',name:'First squad',side:'ally',role:'infantry',strength:16,maxStrength:16,damage:3,at:[20,20],face:[1,0],member:{name:'Legionary',...ROMAN_SQUADS.infantry},standing:[['hold_line',null]]}]});
  assert.equal(lesson(w).id,'orders');assert.equal(lesson(w).complete,false);
  assert.equal(queueCommand(w,{actorId:'hero',kind:'order',payload:{squads:['missing'],order:{kind:'hold'}}}).ok,false);
  assert.match(lesson(w).step,/1 \/ 3/);
  assert.equal(queueCommand(w,{actorId:'hero',kind:'order',payload:{squads:['a'],order:{kind:'hold'}}}).ok,true);
  assert.match(lesson(w).step,/2 \/ 3/);assert.equal(lesson(w).complete,false);
  for(let i=0;i<30;i++)step(w);
  assert.ok(w.used.includes('order'));assert.equal(lesson(w).complete,true);
});

test('engineering exercise follows uninterrupted public work and observes the completed object',()=>{
  const w=world({objects:[{id:'work',field:true,kind:'countermine',name:'Timbering',x:6,z:5,state:'active',progress:0,required:2,work_s:4}]});
  assert.equal(lesson(w).id,'engineering');assert.match(lesson(w).step,/1 \/ 3/);
  const work=()=>queueCommand(w,{actorId:'hero',kind:'interact',payload:{objectId:'work'}});
  assert.equal(work().ok,true);for(let i=0;i<83;i++)step(w);
  assert.equal(w.objects[0].progress,1);assert.match(lesson(w).step,/2 \/ 3/);
  assert.equal(work().ok,true);for(let i=0;i<83;i++)step(w);
  assert.equal(w.objects[0].done,true);assert.equal(lesson(w).complete,true);
});

test('political exercise accepts a free argument without demanding a promise and never mutates the save',()=>{
  const fixtures=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
  const state=Game.deserialize(JSON.stringify(fixtures.scenes.find(s=>s.id==='board-ch7-council').state));
  assert.equal(Game.retry(state).ok,true);
  const read=seen=>{const before=Game.serialize(state),l=realtimeLesson({state,world:{},kind:'chamber',seen});assert.equal(Game.serialize(state),before);return l;};
  assert.equal(read({}).title,'Talk before you commit');assert.equal(read({talked:true}).title,'Weigh the commitment');
  const hero=Chamber.speakers(state)[0];let spoken=false;
  for(const voter of state.encounter.units.filter(u=>u.role==='voter')){
    const tile=Chamber.walkBeside(state,hero.id,'persuade',voter);if(!tile)continue;
    const cmd={unitId:hero.id,action:'persuade',targetId:voter.id,x:voter.x,y:voter.y};
    if(!Chamber.forecastFrom(state,cmd,tile).ok)continue;
    assert.equal(Chamber.walk(state,hero.id,tile).ok,true);assert.equal(Chamber.speak(state,cmd).ok,true);spoken=true;break;
  }
  assert.equal(spoken,true);assert.equal(read({talked:true}).complete,true);
  assert.equal(state.encounter.promises.length,0);assert.match(read({}).body,/without a grain promise/);
});

test('skip, completion and replay only store bounded presentation preferences',()=>{
  const w=world({objects:[{id:'work',kind:'countermine',progress:0,required:2}]}),before=snapshotWorld(w);
  let progress=rememberLesson(null,'engineering',false);assert.equal(lesson(w,{progress}),null);
  progress=lessonProgress();assert.equal(lesson(w,{progress}).id,'engineering');
  assert.deepEqual(rememberLesson(progress,'unknown',true),progress);
  assert.deepEqual(loadSettings(JSON.stringify({lessonProgress:{completed:['orders','orders','bad'],dismissed:['engineering',false]}})).lessonProgress,{completed:['orders'],dismissed:['engineering']});
  assert.equal(snapshotWorld(w),before);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {realtimeLesson} from '../src/ui/realtime-lessons.js';
import {keymapFrom} from '../src/ui/action-map.js';
import {runCommandCampaign} from '../scripts/command-autoplay.mjs';

// The guided opening in real time (build brief Phase 4): the drill's lessons, pause and
// slow time included, then the first patrol's and the opening chamber hours'. Reading a
// lesson changes nothing.

function drill(){
  const state=G.newGame('Aurelius Marcellus',275,{featureEdition:35,progression:true}),chapter=G.getChapter(state);
  assert.ok(G.choose(state,chapter.decision.options[0].id).ok);assert.ok(G.startEncounter(state,{controls:'realtime'}).ok);return state;
}

test('the drill teaches in order, pause and slow time among its lessons, in the player’s keys, and changes nothing',()=>{
  const state=drill(),world=G.realtimeWorld(state),seen={paused:false,slowed:false},before=G.serialize(state);
  const lesson=()=>realtimeLesson({state,world,seen});
  assert.deepEqual([lesson().step,lesson().title],['1 / 7','Find your footing']);
  world.used.push('move');assert.equal(lesson().title,'Pause to think');assert.match(lesson().body,/Press P,/);
  assert.match(realtimeLesson({state,world,seen,keymap:keymapFrom({pause:['KeyK','Pause']})}).body,/Press K,/,'in the player’s keys');
  seen.paused=true;assert.equal(lesson().title,'Slow time');seen.slowed=true;assert.equal(lesson().title,'Draw your weapon');
  world.actors.find(a=>a.id===world.heroId).drawn=true;assert.equal(lesson().title,'Strike the drill partner');
  world.used.push('strike','brace');assert.equal(lesson().title,'Throw a pilum');world.used.push('throw');assert.equal(lesson().title,'The drill is complete');
  assert.equal(G.serialize(state),before,'lessons read the world and never write the chronicle');
});

test('the first patrol and the opening chamber hours have their lessons; later chapters none',()=>{
  const camps=new Map(),stop=new Error('reached');
  try{runCommandCampaign({featureEdition:35,onCheckpoint(s){const id=G.getChapter(s).encounters[s.encounterIndex]?.id;if(!camps.has(id))camps.set(id,G.serialize(s));if(id==='ch8-ferry')throw stop;}});}
  catch(error){if(error!==stop)throw error;}
  const road=G.deserialize(camps.get('ch1-road'));assert.ok(G.startEncounter(road,{controls:'realtime'}).ok);const w=G.realtimeWorld(road);
  assert.equal(realtimeLesson({state:road,world:w,seen:{}}).title,'Keep the objective in view');
  assert.equal(realtimeLesson({state:road,world:w,seen:{paused:true}}).title,'Read before you strike');
  const council=G.deserialize(camps.get('ch7-council'));assert.ok(G.startEncounter(council,{}).ok);
  assert.equal(realtimeLesson({state:council,world:{},kind:'chamber'}).title,'Talk before you speak');
  council.encounter.turn=2;assert.equal(realtimeLesson({state:council,world:{},kind:'chamber'}).title,'The rivals answer each hour');
  council.encounter.turn=3;assert.equal(realtimeLesson({state:council,world:{},kind:'chamber'}),null);
  const ferry=G.deserialize(camps.get('ch8-ferry'));assert.ok(G.startEncounter(ferry,{controls:'realtime'}).ok);
  assert.equal(realtimeLesson({state:ferry,world:G.realtimeWorld(ferry),seen:{}}),null);
});

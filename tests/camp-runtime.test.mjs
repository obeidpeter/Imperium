import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Game from '../src/core/game.js';
import {campRuntimeKey} from '../src/ui/camp-runtime.js';
import {stageUnit} from '../src/showcase/live-figures.js';

const fixtures=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
const camp=chapter=>Game.deserialize(JSON.stringify(fixtures.scenes.find(s=>s.id===`camp-${chapter}`).state));
const hero=state=>Game.createCampWorld(state).actors.find(a=>a.id==='hero');

test('Every camp refreshes its runtime after an equipment command, without mutating the chronicle or old world',()=>{
  for(let chapter=1;chapter<=12;chapter++){
    const state=camp(chapter),before=Game.serialize(state),key=campRuntimeKey(state),old=hero(state),oldText=JSON.stringify(old);
    assert.equal(Game.serialize(state),before,'Reading runtime identity and creating its world are pure');
    assert.ok(Game.soldierCommand(state,{kind:'takeOff',place:'shield:0'}).ok);
    const equipped=Game.serialize(state),nextKey=campRuntimeKey(state),next=hero(state);
    assert.notEqual(nextKey,key,`chapter ${chapter}: the mounted camp will take its existing reload branch`);
    assert.notDeepEqual(next.kit,old.kit);assert.ok(!next.kit.includes('training_shield'));
    assert.equal(JSON.stringify(old),oldText,'No stale runtime actor is modified behind the simulation');
    assert.equal(campRuntimeKey(state),nextKey);assert.equal(Game.serialize(state),equipped);
  }
});

test('Legacy adoption and appearance refresh the camp hero, while inspecting the legacy fallback never adopts it',()=>{
  const state=camp(5);delete state.soldier;
  const legacy=Game.serialize(state),key=campRuntimeKey(state),old=hero(state);
  assert.equal(state.soldier,undefined);assert.equal(Game.serialize(state),legacy);
  assert.ok(Game.soldierCommand(state,{kind:'adopt',path:'librarius',appearance:{hair:2,beard:1,tunic:2,cloak:1}}).ok);
  const adopted=Game.serialize(state),nextKey=campRuntimeKey(state),next=hero(state);
  assert.notEqual(nextKey,key);assert.notDeepEqual(next.attributes,old.attributes);assert.equal(state.soldier.path,'librarius');
  assert.deepEqual(stageUnit(next,{appearance:state.soldier.appearance}).appearance,{hair:2,beard:1,tunic:2,cloak:1});
  assert.equal(Game.serialize(state),adopted);
  // A pure appearance revision must refresh the presenter even when the
  // simulation attributes and kit are identical.
  state.soldier.appearance.hair=1;const revised=Game.serialize(state);
  assert.notEqual(campRuntimeKey(state),nextKey);assert.deepEqual(hero(state),next);assert.equal(Game.serialize(state),revised);
});

test('Attribute and course commands refresh live stats, effects and techniques without restarting for bookkeeping',()=>{
  const state=camp(5);let key=campRuntimeKey(state),previous=hero(state);
  assert.ok(Game.soldierCommand(state,{kind:'raise',attribute:'agi'}).ok);
  assert.notEqual(campRuntimeKey(state),key);assert.equal(hero(state).attributes.agi,previous.attributes.agi+1);
  key=campRuntimeKey(state);assert.ok(Game.soldierCommand(state,{kind:'course',courseId:'long_march'}).ok);
  assert.notEqual(campRuntimeKey(state),key);assert.equal(hero(state).effects.restriction,-5);
  key=campRuntimeKey(state);assert.ok(Game.soldierCommand(state,{kind:'course',courseId:'shield_bash'}).ok);
  assert.notEqual(campRuntimeKey(state),key);assert.ok(hero(state).abilities.includes('shield_bash'));
  key=campRuntimeKey(state);previous=hero(state);
  assert.ok(Game.soldierCommand(state,{kind:'pay'}).ok);assert.ok(Game.soldierCommand(state,{kind:'sort'}).ok);assert.ok(Game.campVisit(state,'barracks').ok);
  const bookkeeping=Game.serialize(state);assert.equal(campRuntimeKey(state),key);assert.deepEqual(hero(state),previous);assert.equal(Game.serialize(state),bookkeeping);
});

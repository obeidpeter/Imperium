import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as Game from '../src/core/game.js';
import {encounterView} from '../src/ui/encounter-view.js';
import {fieldIntel,coalitionPanel} from '../src/ui/tactical-intel.js';
import {audioLevel} from '../src/ui/audio.js';
const fixtures=JSON.parse(await readFile(new URL('./compatibility/v06-ui-checkpoints.json',import.meta.url),'utf8'));

test('Suspended v0.6 battle and Contest saves retain their rules on a full checkpoint retry',()=>{
  for(const id of ['board-ch1-road','board-ch6-wells','board-ch11-adlection']){
    const scene=fixtures.scenes.find(s=>s.id===id);assert.ok(scene,id);
    const state=Game.deserialize(JSON.stringify(scene.state)),key=state.encounter.kind==='battle'?'combatVersion':'politicsVersion';
    assert.equal(state.encounter[key],undefined,'Historical fixture must remain the original version.');
    assert.equal(state.encounterOptions[key],1);assert.equal(state.snapshot.encounterOptions[key],1);
    const checkpoint=structuredClone(state.snapshot);assert.ok(Game.retry(state).ok);
    assert.equal(state.encounter[key],undefined);assert.equal(state.rng,Game.deserialize(Game.serialize(state)).rng);
    assert.deepEqual(state.decisions,checkpoint.decisions);assert.deepEqual(state.obligations,checkpoint.obligations);
  }
});

test('Losing a suspended v0.6 Contest keeps its rules on a patron rerun and retry pays no duplicate debt',()=>{
  const scene=fixtures.scenes.find(s=>s.id==='board-ch11-adlection');
  const state=Game.deserialize(JSON.stringify(scene.state));
  const supplies=state.snapshot.supplies,rank=state.rank,completed=[...state.completed];
  for(let i=0;i<30&&state.encounter.status==='active';i++)assert.ok(Game.endTurn(state).ok);
  assert.equal(state.encounter.status,'lost','The unassisted historical vote must actually be lost through legal end turns.');
  assert.ok(Game.acceptFallback(state).ok);
  assert.equal(state.encounter.politicsVersion,undefined);
  assert.equal(state.encounterOptions.politicsVersion,1);
  assert.equal(state.snapshot.encounterOptions.politicsVersion,1);
  assert.equal(state.encounter.fallback,true);
  assert.equal(state.supplies,Math.max(0,supplies-2));
  assert.equal(state.rank,rank);assert.deepEqual(state.completed,completed);
  const debtId=`fallback:${state.encounter.id}`;
  assert.equal(state.obligations.filter(o=>o.id===debtId).length,1);
  const backed=Game.serialize(state);
  assert.ok(Game.retry(state).ok);
  assert.equal(Game.serialize(state),backed,'Retry restores the backed vote exactly, including its old rules and already-paid costs.');
  assert.equal(state.obligations.filter(o=>o.id===debtId).length,1);
});

test('New encounters use current rules, reject unknown rule markers, and present without changing outcomes',()=>{
  const state=Game.newGame('<Commander>');Game.choose(state,Game.getChapter(state).decision.options[0].id);assert.ok(Game.startEncounter(state).ok);
  assert.equal(state.encounter.combatVersion,2);
  const saved=Game.serialize(state),target=Game.getTargets(state,'hero','move')[0];
  const html=encounterView({state,selected:'hero',action:'move',target,header:()=>'',footer:()=>'',requirements:()=>''});
  assert.ok(html.includes('Current tactical objective'));assert.ok(!html.includes('<Commander>'));assert.equal(Game.serialize(state),saved);
  const invalid=JSON.parse(saved);invalid.encounter.combatVersion=3;assert.throws(()=>Game.deserialize(JSON.stringify(invalid)),/rules version/);
});

test('Intelligence never exposes hidden units; vote track includes permanent speaker votes',()=>{
  const battle=structuredClone(fixtures.scenes.find(s=>s.id==='board-ch1-road').state.encounter);
  const enemy=battle.units.find(u=>u.side==='enemy');enemy.hidden=true;enemy.name='A hidden attacker';
  assert.ok(!fieldIntel(battle).includes('A hidden attacker'));
  const state=Game.deserialize(JSON.stringify(fixtures.scenes.find(s=>s.id==='board-ch11-adlection').state));
  const vote=Game.voteCount(state),html=coalitionPanel(state.encounter,vote);
  assert.equal((html.match(/class="vote-seat /g)||[]).length,vote.total);
  assert.ok(html.includes('withdrawn speaker keeps their vote'));
});

test('Optional effects volume clamps invalid and imported settings without changing gameplay',()=>{
  assert.equal(audioLevel(undefined),.5);assert.equal(audioLevel(NaN),.5);assert.equal(audioLevel(-10),0);assert.equal(audioLevel(20),1);assert.equal(audioLevel(.3),.3);
});

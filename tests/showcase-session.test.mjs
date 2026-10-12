import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../src/core/game.js';
import {createShowcaseSession,ARRIVAL,commandFor} from '../src/showcase/session.js';
import {playEncounter} from '../scripts/autoplay.mjs';
test('Frontier study is reached through legal commands and never shares campaign state',()=>{
  const s=createShowcaseSession(),other=createShowcaseSession();
  assert.equal(s.encounter.id,'ch1-road');assert.equal(s.encounter.status,'active');assert.equal(s.oath,true);
  assert.equal(s.history.length,1);assert.equal(s.completed.length,0);assert.equal(ARRIVAL.length,11);
  const pristine=Game.serialize(other),target=Game.getTargets(s,'hero','move')[0],command=commandFor('hero','move',target);
  assert.equal(Game.preview(s,command).ok,true);assert.equal(Game.serialize(s),pristine);
  assert.equal(Game.act(s,command).ok,true);assert.equal(Game.serialize(other),pristine);
  assert.equal(commandFor('hero','move',null),null);
});

test('The complete frontier battle can be won by legal autoplay and replayed exactly from a fresh session',()=>{
  const state=createShowcaseSession(),trace=[],summary=playEncounter(state,{style:'tactical',trace});
  assert.equal(summary.id,'ch1-road');assert.equal(summary.status,'won');assert.ok(summary.turns>0&&summary.turns<=state.encounter.turnLimit);assert.ok(summary.heroHealth>0);assert.ok(trace.some(step=>step.kind==='act'));assert.ok(trace.some(step=>step.kind==='endTurn'));
  const replay=createShowcaseSession();let acted=0;
  for(const step of trace){
    assert.equal(replay.encounter.id,step.encounter);assert.equal(replay.encounter.turn,step.turn);
    if(step.kind==='act'){
      const before=Game.serialize(replay);assert.equal(Game.preview(replay,step.payload).ok,true);assert.equal(Game.serialize(replay),before,'Every replay preview is pure');assert.equal(Game.act(replay,step.payload).ok,true);acted++;
    }else{assert.equal(step.kind,'endTurn');assert.equal(Game.endTurn(replay).ok,true);}
  }
  assert.ok(acted>=3);assert.equal(Game.serialize(replay),Game.serialize(state),'Same legal commands reproduce random state, health, reinforcements and logs exactly');
  assert.equal(replay.history.length,1,'Winning the study does not commit another campaign milestone');assert.equal(replay.completed.length,0);
});

test('Illegal and already-spent commands leave the isolated session byte-for-byte unchanged',()=>{
  const state=createShowcaseSession(),hero=state.encounter.units.find(u=>u.id==='hero'),foe=state.encounter.units.find(u=>u.side==='enemy');
  const invalid=[
    {unitId:'hero',action:'move',x:-1,y:3},
    {unitId:'hero',action:'move',x:7,y:7},
    {unitId:'hero',action:'move',x:2,y:0},
    {unitId:'hero',action:'strike',x:7,y:7,targetId:'missing'},
    {unitId:foe.id,action:'move',x:0,y:0},
    {unitId:'hero',action:'formation',x:hero.x,y:hero.y,formation:'shield-wall'},
    {unitId:'missing',action:'brace',x:0,y:0}
  ];
  for(const command of invalid){const before=Game.serialize(state);assert.equal(Game.preview(state,command).ok,false);assert.equal(Game.serialize(state),before);assert.equal(Game.act(state,command).ok,false);assert.equal(Game.serialize(state),before);}
  const target=Game.getTargets(state,'hero','move')[0],valid=commandFor('hero','move',target);assert.equal(Game.act(state,valid).ok,true);
  const spent=Game.serialize(state);assert.equal(Game.preview(state,valid).ok,false);assert.equal(Game.act(state,valid).ok,false);assert.equal(Game.serialize(state),spent);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as Game from '../src/core/game.js';
import {CHAPTERS} from '../src/data/campaign.js';

const fixture=JSON.parse(await readFile(new URL('./fixtures/campaign-3d.json',import.meta.url),'utf8'));
test('3D browser review covers every real encounter with valid complete start checkpoints and actual late-chapter locks',()=>{
  assert.equal(fixture.format,'sacramentum-campaign-3d-v1');assert.equal(fixture.finalRank,'Augustus');
  assert.deepEqual(fixture.scenes.map(scene=>scene.id),CHAPTERS.flatMap(chapter=>chapter.encounters.map(e=>e.id)));
  assert.equal(fixture.scenes.filter(scene=>scene.kind==='contest').length,6);
  for(const scene of fixture.scenes){
    const state=Game.deserialize(Game.serialize(scene.state)),e=state.encounter;
    assert.equal(state.phase,'encounter');assert.equal(e.status,'active');assert.equal(e.turn,1);assert.equal(e.id,scene.id);assert.equal(state.chapter,scene.chapter);
    assert.ok(Game.canAccess(state,state.chapter),scene.id+' must have earned access');
    assert.equal(e.width,8);assert.equal(e.height,8);
    assert.equal(new Set(e.units.map(u=>`${u.x},${u.y}`)).size,e.units.length,'Occupied rule cells cannot overlap');
    if(e.kind==='contest'){assert.equal(e.units.filter(u=>u.role==='voter').length,9);assert.equal(e.units.filter(u=>u.role==='speaker').length,4);assert.equal(e.electorate,13);}
  }
});
test('Every browser-review action sequence previews legally and reaches its recorded victory without injected outcomes',()=>{
  for(const scene of fixture.scenes){
    const state=Game.deserialize(Game.serialize(scene.state));
    for(const step of scene.commands){
      const before=Game.serialize(state);
      if(step.kind==='act'){assert.equal(Game.preview(state,step.payload).ok,true,scene.id);assert.equal(Game.serialize(state),before,'Preview mutated fixture state');}
      const result=step.kind==='act'?Game.act(state,step.payload):Game.endTurn(state);
      assert.equal(result.ok,true,`${scene.id} ${step.kind}: ${result.message}`);
    }
    assert.equal(state.encounter.status,scene.result.status);assert.equal(state.encounter.status,'won');assert.equal(state.encounter.turn,scene.result.turn);
    assert.deepEqual(state.encounter.usedAbilities,scene.result.usedAbilities);
  }
});

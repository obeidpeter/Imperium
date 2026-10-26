import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {WORLD_VERSION,step,worldHash} from '../src/core/realtime/simulation.js';

// Saves across a change of the real-time rules (worlds and gameplay plan,
// "Saves"): a fight saved under an earlier WORLD_VERSION restarts from its
// checkpoint when the chronicle loads, exactly as Retry would; a newer one is
// refused without touching anything.

function midFight(){
  const state=G.newGame('Aurelius Marcellus',275,{featureEdition:35,progression:true});G.choose(state,G.getChapter(state).decision.options[0].id);
  assert.ok(G.startEncounter(state,{controls:'realtime'}).ok);const start=worldHash(G.realtimeWorld(state));
  const w=G.realtimeWorld(state);for(let i=0;i<150;i++)step(w);assert.ok(G.saveRealtime(state,w).ok);
  return {state,start};
}

test('a fight saved by an earlier version of the real-time rules restarts from its checkpoint when the chronicle loads',()=>{
  assert.equal(WORLD_VERSION,4);
  const {state,start}=midFight(),older=JSON.parse(G.serialize(state));
  older.encounter.realtime.world.version=2;older.encounter.realtime.resume.version=2;
  const loaded=G.deserialize(JSON.stringify(older)),w=G.realtimeWorld(loaded);
  assert.equal(loaded.phase,'encounter');assert.equal(loaded.encounter.id,state.encounter.id);
  assert.equal(w.version,WORLD_VERSION);assert.equal(w.tick,0,'the fight starts again');assert.equal(loaded.encounter.realtime.resume,undefined);
  assert.equal(worldHash(w),start,'exactly the encounter’s start, as Retry gives');
  assert.deepEqual(loaded.snapshot,state.snapshot,'the checkpoint is kept');
});

test('a fight from a newer version is refused, and a current one loads as it was saved',()=>{
  const {state}=midFight(),newer=JSON.parse(G.serialize(state));newer.encounter.realtime.world.version=WORLD_VERSION+1;
  assert.throws(()=>G.deserialize(JSON.stringify(newer)),/real-time world version/);
  const same=G.deserialize(G.serialize(state));assert.equal(G.realtimeWorld(same).tick,150);
});

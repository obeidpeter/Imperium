import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {battleOnSeed,battleSeeds,PLAYERS} from '../scripts/battle-seeds.mjs';

// The development tool behind the 8 November follow-up (docs/chests-release11-report.md): it must play a battle's
// first try exactly as the release sweep's first pass does, or seeds beyond the sweep's would not compare with them.
const sweep=JSON.parse(readFileSync(new URL('../docs/evidence/realtime-release11-recheck-sweep-story-issued.json',import.meta.url),'utf8'));
const recorded=(id,seed)=>sweep.runs.find(r=>r.realtime&&r.id===id&&r.seed===seed&&r.tries===1);

test('battle-seeds plays a battle\'s first try as the release sweep\'s first pass recorded it',()=>{
  for(const seed of [1,2]){
    const mine=battleOnSeed('ch1-road',seed,'story','issued'),theirs=recorded('ch1-road',seed);
    assert.ok(theirs,'the sweep recorded the battle');
    assert.deepEqual({status:mine.status,rounds:mine.rounds,heroHealth:mine.heroHealth},{status:theirs.status,rounds:theirs.rounds,heroHealth:theirs.heroHealth},`seed ${seed}`);
  }
});

test('battle-seeds summarises the won first tries and names a battle it cannot reach',()=>{
  const r=battleSeeds('ch1-road',{from:1,to:2,difficulty:'story',kit:'issued'});
  assert.equal(r.played,2);assert.equal(r.won,2);assert.equal(r.stopped.length,0);
  assert.equal(r.rounds,(recorded('ch1-road',1).rounds+recorded('ch1-road',2).rounds)/2);
  assert.match(battleOnSeed('ch1-nowhere',1,'story','issued').stopped,/not reached/);
  assert.throws(()=>battleOnSeed('nowhere',1,'story','issued'),/Not a battle id/);
  assert.deepEqual(PLAYERS.map(p=>p.split(':')[0]),['story','story','standard','standard','veteran','veteran']);
});

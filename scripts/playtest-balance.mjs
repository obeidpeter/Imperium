// Targeted sensitivity probe, not human balance evidence. The campaign camp
// is earned legally; the three meter profiles are explicitly injected before
// departure. Every deployment, action and result then uses the public rules.
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import * as Game from '../src/core/game.js';
import {runCommandCampaign} from './command-autoplay.mjs';
import {playRealtime} from './realtime-autoplay.mjs';

let checkpoint;const stop=new Error('checkpoint earned');
try{runCommandCampaign({featureEdition:35,onCheckpoint(state){
  if(Game.getChapter(state).encounters[state.encounterIndex]?.id==='ch12-confrontation'){checkpoint=Game.serialize(state);throw stop;}
}});}catch(error){if(error!==stop)throw error;}
assert.ok(checkpoint);
const report={method:'Legal Chapter XII checkpoint; injected weak/mixed/strong campaign meters; deterministic command bot; not a human playtest',cases:[]};
for(const [profile,meters] of [['weak',{army:20,political:20,public:20}],['mixed',{army:55,political:45,public:45}],['strong',{army:100,political:90,public:90}]]){
  for(const route of ['backer','battle','defection','settlement','surrender']){
    const state=Game.deserialize(checkpoint);Object.assign(state.meters,meters);
    const available=Game.finaleForecast(state).routes.some(r=>r.id===route);
    if(!available){report.cases.push({profile,route,available});continue;}
    assert.equal(Game.chooseRoute(state,route).ok,true);assert.equal(Game.startEncounter(state,{controls:'realtime'}).ok,true);
    const world=Game.realtimeWorld(state),ours=world.squads.filter(q=>q.side!=='enemy').length,rivals=world.squads.length-ours;
    const result=playRealtime(state);assert.notEqual(result.status,'active','Every scenario reaches a result');
    const retry=Game.serialize(state.snapshot);assert.equal(Game.retry(state).ok,true);
    assert.equal(Game.serialize(state.snapshot),retry,'Retry preserves the complete campaign checkpoint');
    report.cases.push({profile,route,available,alliedFormations:ours,rivalFormations:rivals,status:result.status,rounds:result.rounds,reason:result.reason,pledges:result.world.mission.defections});
  }
}
const fights=report.cases.filter(c=>c.route==='battle');
assert.ok(fights[0].alliedFormations<fights[1].alliedFormations&&fights[1].alliedFormations<fights[2].alliedFormations,'Campaign strength retains its reward');
assert.ok(fights[0].rivalFormations>fights[2].rivalFormations);
assert.equal(fights[2].status,'won','The strong campaign remains effective');
const dir=new URL('../tests/visual-results/playtest-overhaul/',import.meta.url);await mkdir(dir,{recursive:true});
await writeFile(new URL('balance.json',dir),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));

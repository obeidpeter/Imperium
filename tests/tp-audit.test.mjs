import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as G from '../src/core/game.js';
import {attributeCost} from '../src/core/soldier.js';
import {tpAuditChapter,tpAuditTotal} from '../src/core/tp-audit.js';
import {playRealtime,runRealtimeCampaign} from '../scripts/realtime-autoplay.mjs';
import {TP} from '../src/data/soldier.js';

const root=fileURLToPath(new URL('..',import.meta.url));

test('G33: raising an attribute costs 4 TP below 20, 5 from 20, 6 from 30, on the base value',()=>{
  assert.deepEqual([5,19,20,29,30,39,40].map(attributeCost),[4,4,5,5,6,6,7]);
});

test('G33: the TP audit document is current, and no Chapter I–III run can earn more than it allows',()=>{
  assert.doesNotThrow(()=>execFileSync(process.execPath,['scripts/tp-audit.mjs','--check'],{cwd:root,stdio:'pipe'}),'docs/tp-audit.md matches the data');
  assert.doesNotThrow(()=>execFileSync(process.execPath,['scripts/realtime-encounters.mjs','--check'],{cwd:root,stdio:'pipe'}),'docs/realtime-encounters.md matches the data');
  const {state}=runRealtimeCampaign({throughChapter:3,ready:[1,2,3]});
  assert.ok(state.soldier.tpEarned<=tpAuditTotal(3,state.soldier.path),`${state.soldier.tpEarned} earned of at most ${tpAuditTotal(3,state.soldier.path)}`);
  // Kill TP: once per enemy, never above the cap or the enemies who took the field.
  for(const c of [1,2,3])for(const r of tpAuditChapter(c).rows)assert.ok(r.kills<=TP.killCap);
  assert.equal(tpAuditTotal(0),0);assert.ok(tpAuditTotal(12)>tpAuditTotal(3));
});

test('G33: a fight grants its TP only when recorded, once: a retry or a second record never repeats it',()=>{
  const {state}=runRealtimeCampaign({throughChapter:1,ready:[1,2,3]});
  assert.equal(state.chapter,2);const before=state.soldier.tpEarned;
  G.choose(state,G.getChapter(state).decision.options[0].id);assert.ok(G.startEncounter(state,{controls:'realtime'}).ok);
  assert.equal(playRealtime(state).status??state.encounter.status,'won');assert.equal(state.soldier.tpEarned,before,'nothing is granted before the record');
  assert.ok(G.retry(state).ok);assert.equal(state.soldier.tpEarned,before,'a retry restores the checkpoint, TP included');
  assert.ok(G.isRealtime(state),'the retried fight begins again in real time');playRealtime(state);assert.equal(state.encounter.status,'won');
  assert.ok(G.commitEncounter(state).ok);const after=state.soldier.tpEarned;assert.ok(after>before,'the record grants the fight’s TP');
  assert.equal(G.commitEncounter(state).ok,false,'a second record is refused');assert.equal(state.soldier.tpEarned,after);
  assert.equal(G.deserialize(G.serialize(state)).soldier.tpEarned,after,'a reload keeps it, once');
});

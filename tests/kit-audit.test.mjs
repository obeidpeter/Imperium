import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {itemScore,kitAuditChapter,kitAuditProblems,referenceLoadouts} from '../src/core/kit-audit.js';
import {runRealtimeCampaign} from '../scripts/realtime-autoplay.mjs';

// Release 11's kit audit: the coin and kit a soldier can have by each chapter are fixed,
// the finer pieces are real upgrades, and the engaged reference player never wears more.
const root=fileURLToPath(new URL('..',import.meta.url));

test('the kit audit document is current and finds no problem',()=>{
  assert.deepEqual(kitAuditProblems(),[]);
  assert.doesNotThrow(()=>execFileSync(process.execPath,['scripts/kit-audit.mjs','--check'],{cwd:root,stdio:'pipe'}),'docs/kit-audit.md matches the data');
});

test('upgrades count: the engaged soldier fells a man faster and lasts longer than the issued one from Chapter III',()=>{
  for(const chapter of [3,6,9,12]){
    const r=kitAuditChapter(chapter),i=r.duels.issued.enemy,e=r.duels.engaged.enemy;
    assert.ok(e.kill<i.kill&&e.die>=i.die,`chapter ${chapter}: ${JSON.stringify(r.duels)}`);
    assert.ok(r.engagedScore>r.issuedScore);
  }
});

test('the engaged reference player, playing by legal commands, never wears more than the audit allows',()=>{
  const {state}=runRealtimeCampaign({throughChapter:3,ready:[1,2,3],kit:'engaged'});
  const worn=Object.values(state.soldier.worn).reduce((n,id)=>n+itemScore(id),0),ceiling=referenceLoadouts(state.chapter).engagedScore;
  assert.ok(worn<=ceiling+1e-9,`${worn.toFixed(1)} worn of at most ${ceiling.toFixed(1)}`);
  assert.ok(worn>referenceLoadouts(state.chapter).issuedScore,'and wears more than the issue');
});

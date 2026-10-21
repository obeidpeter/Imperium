import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import {runProgressionCampaign} from '../scripts/progression-autoplay.mjs';

test('Actual ledger settlement handlers retain storage-failure feedback after refreshing both debt types',async t=>{
  // A legally earned camp before the chapter XII decision resolves its debts.
  let checkpoint;runProgressionCampaign({beforeCamp:s=>{if(s.chapter===12&&s.encounterIndex===0)checkpoint=G.deserialize(G.serialize(s));}});
  const agreements=checkpoint.progression.agreements.filter(a=>a.status==='open'),obligation=checkpoint.obligations.find(a=>a.status==='open'&&checkpoint.chapter>=a.due);
  assert.ok(agreements.length>=2&&obligation);

  // The actual app, public rules and storage modules run on the page skeleton (inert-app.mjs).
  const {bootApp}=await import('./inert-app.mjs');
  const app=await bootApp(t,{name:'progression-ledger-feedback',save:checkpoint});
  const feedback=()=>app.modal().querySelector('.modal-feedback')?.textContent||'';
  const open=async cmd=>{if(!app.doc.querySelector(`[data-cmd="${cmd}"]`))await app.click('menu');await app.click(cmd);};
  const initial=app.raw();
  await app.click('continue');await open('ledger');assert.equal(app.modal().open,true);
  app.storage.reject=true;
  for(const [cmd,id]of [['agreement-break',agreements[0].id],['settle-break',obligation.id]]){
    await app.click(cmd,id);assert.equal(app.raw(),initial,'Failed persistence must retain the previous durable checkpoint');
    assert.match(feedback(),/Safe browser storage is unavailable/,'Refreshing the ledger must preserve the latest save failure');
    assert.match(app.modal().innerHTML,/broken/i,'The refreshed ledger must reflect the in-memory settlement');
  }
  // The refreshed ledger no longer offers the broken agreement; a stale page could still send it.
  assert.equal(app.doc.querySelector(`[data-cmd="agreement-break"][data-id="${agreements[0].id}"]`),null);
  await app.command('agreement-break',agreements[0].id);assert.match(feedback(),/Resolve an open agreement/,'Invalid duplicate settlement feedback also survives refresh');assert.equal(app.raw(),initial);
  app.storage.reject=false;await app.click('agreement-break',agreements[1].id);
  const saved=app.saved();assert.equal(saved.progression.agreements.find(a=>a.id===agreements[0].id).status,'broken');assert.equal(saved.progression.agreements.find(a=>a.id===agreements[1].id).status,'broken');assert.equal(saved.obligations.find(a=>a.id===obligation.id).status,'broken');
  assert.ok(feedback().includes(`${agreements[1].pledge} broken.`));assert.doesNotMatch(feedback(),/storage is unavailable/,'A later successful save replaces the stale error');
});

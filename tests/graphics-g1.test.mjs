import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));

// Release G1 of the graphics plan (docs/graphics-tripo-plan.md): the armies' bodies and horses, its credits task by task.
test('release G1 spends within its authorisation and its pilot\'s ceiling, and the balance moved by what the ledger records', async () => {
  const ledger=await read('art-source/models/graphics-g1-credits.json'),tasks=ledger.batches.flatMap(b=>b.tasks);
  const spent=tasks.reduce((sum,t)=>sum+t.accountedCredits,0);
  assert.equal(ledger.spentCredits,spent);assert.ok(spent<=ledger.authorization.credits,'Within the authorised credits');
  assert.equal(ledger.remainingAuthorization,ledger.authorization.credits-spent);
  for(const batch of ledger.batches){
    const own=batch.tasks.reduce((sum,t)=>sum+t.accountedCredits,0);assert.equal(batch.spentCredits,own,batch.batch);
    if(batch.ceilingCredits)assert.ok(own<=batch.ceilingCredits,`${batch.batch} stays within its ceiling`);
    if(batch.balance)assert.equal(batch.balance.before-batch.balance.after,own,`${batch.batch}: the account moved by what was recorded`);
    for(const t of batch.tasks){
      assert.equal(t.status,'success',`${t.id} ${t.operation}`);assert.equal(t.accountedCredits,t.creditsReported,`${t.id} ${t.operation}: as Tripo reported`);
      assert.equal(t.accountedCredits,t.expectedCredits,`${t.id} ${t.operation}: at the measured price`);
    }
  }
  // At most 20% of the release's generations rejected, or the release pauses (the plan's stop rule).
  const generations=tasks.filter(t=>t.operation==='text_to_model');
  assert.ok(generations.filter(t=>t.rejectedAtReview).length<=generations.length*.2,'Rejections within the stop rule');
});

test('every model G1 ships has its tasks in a ledger, and a rejected attempt is accounted but never shipped', async () => {
  const ledger=await read('art-source/models/graphics-g1-credits.json'),calibration=await read('art-source/models/graphics-calibration-credits.json');
  const manifest=await read('docs/asset-manifest.json'),tasks=ledger.batches.flatMap(b=>b.tasks),paidBefore=calibration.batches.flatMap(b=>b.tasks);
  const shipped=manifest.assets.filter(a=>a.source?.program==='graphics-g1');
  assert.ok(shipped.length>=8,'The pilot\'s seven bodies and its horse');
  for(const entry of shipped){
    const request=await read(entry.source.prompt),p=request.provenance;
    assert.match(request.status,/^bound/,`${entry.id} is bound and shipped`);
    // The calibration's skirmisher ships from its own request with the calibration's tasks, so G1 pays nothing for it.
    const paid=p.reusedFrom?paidBefore:tasks,id=p.reusedFrom??request.id;
    assert.equal(paid.find(t=>t.id===id&&t.operation==='text_to_model')?.taskId,p.taskId,`${entry.id}: its generation is in a ledger`);
    if(p.rig)assert.equal(paid.find(t=>t.id===id&&t.operation==='animate_rig')?.taskId,p.rig.taskId,`${entry.id}: its rig is in a ledger`);
    assert.equal(entry.source.credits,p.reusedFrom?0:tasks.filter(t=>t.id===request.id).reduce((sum,t)=>sum+t.accountedCredits,0),`${entry.id}: its credits`);
  }
  for(const t of tasks.filter(t=>t.rejectedAtReview)){
    assert.ok(!shipped.some(e=>e.source.taskId===t.taskId),`${t.id} is not shipped`);
    const request=await read(`art-source/models/requests/${t.id}.json`);assert.match(request.status,/^rejected/);assert.ok(!request.provenance.rig,'A rejected model is not rigged');
  }
});

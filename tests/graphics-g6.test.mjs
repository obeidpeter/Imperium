import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url),read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));

// Release G6 of the graphics plan (docs/graphics-tripo-plan.md): faces and people, its credits task by task.
test('release G6 spends within its authorisation and its pilot\'s ceiling, and the balance moved by what the ledger records', async () => {
  const ledger=await read('art-source/models/graphics-g6-credits.json'),tasks=ledger.batches.flatMap(b=>b.tasks);
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
  // A picture costs what the ledger's pricing says, and so does a prompt.
  for(const t of tasks.filter(t=>t.operation==='image_to_model'))assert.equal(t.accountedCredits,ledger.pricing.imageWithStandardTextures,t.id);
  for(const t of tasks.filter(t=>t.operation==='text_to_model'))assert.equal(t.accountedCredits,ledger.pricing.textWithStandardTextures,t.id);
  // At most 20% of the release's generations rejected, or the release pauses (the plan's stop rule).
  const generations=tasks.filter(t=>t.operation==='text_to_model'||t.operation==='image_to_model');
  assert.ok(generations.filter(t=>t.rejectedAtReview).length<=generations.length*.2,'Rejections within the stop rule');
});

test('every body G6 ships has its tasks in the ledger, and a rejected attempt is accounted but never shipped', async () => {
  const ledger=await read('art-source/models/graphics-g6-credits.json'),manifest=await read('docs/asset-manifest.json'),tasks=ledger.batches.flatMap(b=>b.tasks);
  const shipped=manifest.assets.filter(a=>a.source?.program==='graphics-g6');
  assert.ok(shipped.length>=3,'The pilot\'s three bodies');
  for(const entry of shipped){
    const request=await read(entry.source.prompt),p=request.provenance;
    assert.match(request.status,/^bound/,`${entry.id} is bound and shipped`);
    assert.equal(tasks.find(t=>t.id===request.id&&t.operation==='text_to_model')?.taskId,p.taskId,`${entry.id}: its generation is in the ledger`);
    assert.equal(tasks.find(t=>t.id===request.id&&t.operation==='animate_rig')?.taskId,p.rig.taskId,`${entry.id}: its rig is in the ledger`);
    assert.equal(entry.source.taskId,p.taskId);assert.equal(entry.source.rigTaskId,p.rig.taskId);
    assert.equal(entry.source.credits,tasks.filter(t=>t.id===request.id).reduce((sum,t)=>sum+t.accountedCredits,0),`${entry.id}: its credits`);
  }
  for(const t of tasks.filter(t=>t.rejectedAtReview)){
    assert.ok(!manifest.assets.some(e=>e.source?.taskId===t.taskId),`${t.id} is not shipped`);
    const request=await read(`art-source/models/requests/${t.id}.json`);assert.match(request.status,/rejected/);assert.ok(!request.provenance.rig,'A rejected model is not rigged');
  }
});

test('a face from a portrait records its picture, its task and its credits, and ships in its man\'s own body', async () => {
  const ledger=await read('art-source/models/graphics-g6-credits.json'),manifest=await read('docs/asset-manifest.json'),tasks=ledger.batches.flatMap(b=>b.tasks);
  const faces=manifest.assets.filter(a=>a.source?.face?.program==='graphics-g6');
  assert.ok(faces.length>=1,'Lucan\'s face');
  for(const entry of faces){
    const face=entry.source.face,request=await read(face.request),p=request.provenance;
    assert.equal(face.operation,'image_to_model');assert.equal(request.generator.task,'image_to_model');
    assert.equal(tasks.find(t=>t.id===request.id&&t.operation==='image_to_model')?.taskId,face.taskId,`${entry.id}: its face is in the ledger`);
    assert.equal(face.taskId,p.taskId);assert.equal(face.rawSha256,p.rawSha256);
    assert.equal(face.credits,tasks.filter(t=>t.id===request.id).reduce((sum,t)=>sum+t.accountedCredits,0),`${entry.id}: its face's credits`);
    // The picture is the game's own art, kept in the repository, and the request names it at the commit Tripo fetched.
    assert.match(face.input,/^art-source\/models\/inputs\/.+\.png$/);assert.ok(request.generator.input.endsWith(face.input),'The request\'s picture is the recorded one');
    await readFile(new URL(face.input,root));
    // The wrap that made the face records the bust it took it from.
    const wrap=await read(entry.source.headWrap.report);
    assert.equal(wrap.face?.sha256,p.rawSha256,`${entry.id}: the wrap took the face from that bust`);
    assert.equal(wrap.settings.eyes,'his','The portrait\'s face keeps its own eyes');
  }
});

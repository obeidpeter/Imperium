import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {CAPTURE_KINDS,CAPTURE_RECORD,imageDigest,writeScreenshot,recoverScreenshots,readScreenshotRecord,withCaptureLock,
  writeCapture,recoverCapture,readCaptureRecord} from '../scripts/steam-capture-records.mjs';

const entry={id:'01-test',file:'desktop/steam/screenshots/01-test.jpg',captured:{build:'test'}};
for(const phase of ['image','record'])test(`interrupted ${phase} replacement recovers matching image bytes and evidence`,async t=>{
  const root=await fs.mkdtemp(join(tmpdir(),'imperium-capture-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const original=await writeScreenshot(root,{screenshots:[]},entry,Buffer.from('old image'));
  let failed=false;
  const io={...fs,rename:async(from,to)=>{
    if(!failed&&to===join(root,phase==='image'?entry.file:CAPTURE_RECORD)){failed=true;throw Error('simulated interruption');}
    return fs.rename(from,to);
  }};
  const bytes=Buffer.from('new image');
  await assert.rejects(writeScreenshot(root,original,{...entry,captured:{build:'new'}},bytes,io),/interruption/);
  assert.equal(await recoverScreenshots(root),true);
  assert.equal(await recoverScreenshots(root),false,'recovery is idempotent');
  assert.deepEqual(await fs.readFile(join(root,entry.file)),bytes);
  const next=await readScreenshotRecord(root);assert.equal(next.screenshots[0].imageSha256,imageDigest(bytes));
  assert.equal(next.screenshots[0].captured.build,'new');
});
test('a failed later capture keeps earlier captures committed and refuses corrupt recovery bytes',async t=>{
  const root=await fs.mkdtemp(join(tmpdir(),'imperium-capture-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const first=await writeScreenshot(root,{screenshots:[]},entry,Buffer.from('first'));
  const second={id:'02-test',file:'desktop/steam/screenshots/02-test.jpg'};
  const io={...fs,rename:async(from,to)=>{if(to===join(root,second.file))throw Error('interrupted');return fs.rename(from,to);}};
  await assert.rejects(writeScreenshot(root,first,second,Buffer.from('second'),io));
  assert.deepEqual(await readScreenshotRecord(root),first);
  await fs.writeFile(join(root,second.file+'.pending'),'corrupt');
  await assert.rejects(recoverScreenshots(root),/hash mismatch/);
  assert.deepEqual(await readScreenshotRecord(root),first);
});
test('the capture lock refuses overlapping writers and is released after failure',async t=>{
  const root=await fs.mkdtemp(join(tmpdir(),'imperium-capture-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await assert.rejects(withCaptureLock(root,async()=>{
    await assert.rejects(withCaptureLock(root,()=>{}),/already running/);throw Error('failed run');
  }),/failed run/);
  assert.equal(await withCaptureLock(root,()=>42),42);
});

test('a dead process lock refuses entry and remains intact until inspected and removed',async t=>{
  const root=await fs.mkdtemp(join(tmpdir(),'imperium-capture-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const child=spawn(process.execPath,['-e',''],{stdio:'ignore'});await once(child,'exit');
  const path=join(root,CAPTURE_RECORD+'.lock'),pid=String(child.pid);
  await fs.mkdir(join(root,'docs/evidence'),{recursive:true});await fs.writeFile(path,pid);
  let entered=false;
  const attempts=await Promise.allSettled(Array.from({length:2},()=>withCaptureLock(root,()=>{entered=true;})));
  for(const result of attempts){
    assert.equal(result.status,'rejected');assert.match(result.reason.message,/Stale screenshot capture lock/);
    assert.ok(result.reason.message.includes(path));assert.match(result.reason.message,/Verify that no screenshot capture process is running/);
    assert.match(result.reason.message,/--recover/);
  }
  assert.equal(entered,false);assert.equal(await fs.readFile(path,'utf8'),pid,'neither starter removes or replaces the dead process lock');
  await fs.rm(path);assert.equal(await withCaptureLock(root,()=>42),42,'an inspected and explicitly removed lock allows a new run');
});

test('resuming with a stale in-memory record keeps the interrupted capture before adding the next',async t=>{
  const root=await fs.mkdtemp(join(tmpdir(),'imperium-capture-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const original=await writeScreenshot(root,{screenshots:[]},entry,Buffer.from('first'));
  const second={id:'02-test',file:'desktop/steam/screenshots/02-test.jpg'};
  const third={id:'03-test',file:'desktop/steam/screenshots/03-test.jpg'};
  const io={...fs,rename:async(from,to)=>{if(to===join(root,second.file))throw Error('interrupted');return fs.rename(from,to);}};
  await assert.rejects(writeScreenshot(root,original,second,Buffer.from('second'),io));
  const resumed=await writeScreenshot(root,original,third,Buffer.from('third'));
  assert.deepEqual(resumed.screenshots.map(s=>s.id),[entry.id,second.id,third.id]);
  for(const shot of resumed.screenshots)assert.equal(imageDigest(await fs.readFile(join(root,shot.file))),shot.imageSha256);
  assert.deepEqual(await readScreenshotRecord(root),resumed);
});

test('the trailer keeps a record and a lock of its own, and an interrupted video recovers as a screenshot does',async t=>{
  const root=await fs.mkdtemp(join(tmpdir(),'imperium-capture-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const kind=CAPTURE_KINDS.trailer,draft={id:'draft',file:'desktop/steam/trailer/draft.mp4'};
  const first=await writeCapture(root,kind,{trailers:[]},draft,Buffer.from('first cut'));
  let failed=false;
  const io={...fs,rename:async(from,to)=>{if(!failed&&to===join(root,kind.record)){failed=true;throw Error('simulated interruption');}return fs.rename(from,to);}};
  await assert.rejects(writeCapture(root,kind,first,draft,Buffer.from('second cut'),io),/interruption/);
  assert.equal(await recoverCapture(root,kind),true);
  const record=await readCaptureRecord(root,kind);
  assert.deepEqual(await fs.readFile(join(root,draft.file)),Buffer.from('second cut'));
  assert.equal(record.trailers[0].videoSha256,imageDigest(Buffer.from('second cut')));assert.equal(record.trailers[0].videoBytes,10);
  assert.equal(await readScreenshotRecord(root),null,'the screenshots’ record is not touched');
  await assert.rejects(writeCapture(root,kind,record,{id:'draft',file:'desktop/steam/screenshots/draft.jpg'},Buffer.from('x')),/Invalid trailer path/);
  assert.equal(await withCaptureLock(root,()=>withCaptureLock(root,()=>42,kind)),42,'a trailer and a screenshot capture hold separate locks');
  await assert.rejects(withCaptureLock(root,()=>withCaptureLock(root,()=>{},kind),kind),/Trailer capture is already running/);
});

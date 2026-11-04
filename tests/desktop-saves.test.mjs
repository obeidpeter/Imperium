import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
const {createSaveFiles}=createRequire(import.meta.url)('../desktop/saves.cjs');
async function fixture(run){const dir=await mkdtemp(join(tmpdir(),'imperium-saves-test-'));try{await run(createSaveFiles(()=>dir),dir);}finally{await rm(dir,{recursive:true,force:true});}}
test('desktop files are atomic, retain the previous copy, and compare the expected file',async()=>fixture(async(files,dir)=>{
  assert.equal(await files.read('campaign'),null);
  await files.write('campaign','first',{expected:null});await files.write('campaign','second',{expected:'first'});
  assert.equal(await files.read('campaign'),'second');assert.equal(await files.read('campaign',true),'first');
  await writeFile(join(dir,'campaign.json'),'cloud change');
  await assert.rejects(files.write('campaign','stale',{expected:'second'}),/changed/);
  assert.equal(await files.read('campaign'),'cloud change');assert.equal(await files.read('campaign',true),'first');
}));
test('desktop repair keeps the valid previous file instead of replacing it with corruption',async()=>fixture(async(files)=>{
  await files.write('campaign','good');await files.write('campaign','bad');
  await files.write('campaign','restored',{expected:'bad',keepPrevious:true});
  assert.equal(await files.read('campaign'),'restored');assert.equal(await files.read('campaign',true),'good');
}));
test('desktop file read errors abort writes; only missing files return null',async()=>fixture(async(files,dir)=>{
  await mkdir(join(dir,'campaign.json'));
  await assert.rejects(files.read('campaign'));await assert.rejects(files.write('campaign','new',{expected:null}));
}));
test('desktop overlapping writers cannot both replace the same revision',async()=>fixture(async(files)=>{
  await files.write('campaign','base');
  const results=await Promise.allSettled([files.write('campaign','a',{expected:'base'}),files.write('campaign','b',{expected:'base'})]);
  assert.deepEqual(results.map(r=>r.status),['fulfilled','rejected']);assert.equal(await files.read('campaign'),'a');
}));
test('desktop file names cannot escape the save directory',async()=>fixture(async(files)=>{
  await assert.rejects(files.write('../escape','no'));assert.throws(()=>files.read('../escape'));
}));

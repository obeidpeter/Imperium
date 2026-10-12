import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {recordProtectedFiles} from './graphics-protected.mjs';

test('Protected evidence detects changed, added and deleted core/data files without following presentation changes',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'sacramentum-hashes-')),baseline=join(directory,'baseline'),current=join(directory,'current');
  try{
    for(const root of [baseline,current]){
      for(const path of ['src/core','src/data','src/ui'])await mkdir(join(root,path),{recursive:true});
      for(const file of ['src/core/game.js','src/data/campaign.js','src/ui/storage.js','src/ui/session-gate.js'])await writeFile(join(root,file),'unchanged');
    }
    let report=await recordProtectedFiles(baseline,current);assert.equal(report.allUnchanged,true);assert.equal(report.count,4);
    await writeFile(join(current,'src/ui/renderer.js'),'Presentation intentionally changes');assert.equal((await recordProtectedFiles(baseline,current)).allUnchanged,true);
    await writeFile(join(current,'src/core/game.js'),'changed');await writeFile(join(current,'src/data/new.json'),'added');await rm(join(current,'src/data/campaign.js'));
    report=await recordProtectedFiles(baseline,current);assert.equal(report.allUnchanged,false);assert.equal(report.unchangedCount,2);assert.equal(report.count,5);
    assert.deepEqual(report.files.filter(file=>!file.unchanged).map(file=>file.path),['src/core/game.js','src/data/campaign.js','src/data/new.json']);
  }finally{assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));await rm(directory,{recursive:true,force:true});}
});

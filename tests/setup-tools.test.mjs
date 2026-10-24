import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {TOOL_VERSIONS} from '../scripts/assets/setup-tools.mjs';

const script=fileURLToPath(new URL('../scripts/assets/setup-tools.mjs',import.meta.url));

test('the tool setup check reports missing tools and installs nothing',()=>{
  const dir=mkdtempSync(join(tmpdir(),'imperium-tools-'));
  try{
    const run=spawnSync(process.execPath,[script,'--dir',dir,'--check','--only','gltf,playwright,basisu'],{encoding:'utf8'});
    assert.equal(run.status,1);
    assert.match(run.stdout,/gltf\s+missing/);assert.match(run.stdout,/playwright\s+missing/);assert.match(run.stdout,/basisu\s+missing/);
    assert.deepEqual(readdirSync(dir),[],'--check writes nothing, not even env.sh');
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('the tool versions match the pipeline\'s documented versions',()=>{
  assert.equal(TOOL_VERSIONS.bpy,'5.2.2');assert.equal(TOOL_VERSIONS.basisu,'1.16.4');assert.equal(TOOL_VERSIONS.playwright,'1.56.1');
});

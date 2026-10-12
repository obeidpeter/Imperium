import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const steps=[
  ['legal campaign checkpoints','scripts/autoplay.mjs',['--fixtures']],
  ['campaign graphics scenes','scripts/graphics-fixtures.mjs',[]],
  ['legal graphics action cases','tests/graphics-action-fixtures.mjs',[]],
  ['all-chapter 3D review checkpoints','scripts/campaign-3d-fixtures.mjs',[]],
];

for(const [label,script,args] of steps){
  const run=spawnSync(process.execPath,[join(root,script),...args],{
    cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024,
  });
  if(run.error||run.status!==0){
    console.error(`Test preparation failed: ${label} (${script}).`);
    if(run.error)console.error(run.error.message);
    if(run.signal)console.error(`Terminated by ${run.signal}.`);
    if(run.stdout?.trim())console.error(run.stdout.trim());
    if(run.stderr?.trim())console.error(run.stderr.trim());
    process.exit(run.status||1);
  }
  console.log(`Prepared ${label}.`);
}
console.log('Test fixtures are ready: generated sequentially through the legal gameplay API.');

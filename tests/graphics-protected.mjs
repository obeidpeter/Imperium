// Development-only file-integrity evidence. It does not read browser storage.
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const project=resolve(fileURLToPath(new URL('..',import.meta.url)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function paths(root,folder){
  const found=[];
  for(const entry of await readdir(resolve(root,folder),{withFileTypes:true})){
    const path=`${folder}/${entry.name}`;if(entry.isDirectory())found.push(...await paths(root,path));else if(entry.isFile())found.push(path);
  }
  return found;
}
export async function recordProtectedFiles(baseline,current=project){
  baseline=resolve(baseline);current=resolve(current);
  const selected=new Set(['src/ui/storage.js','src/ui/session-gate.js',...await paths(baseline,'src/core'),...await paths(baseline,'src/data'),...await paths(current,'src/core'),...await paths(current,'src/data')]);
  const files=[];
  for(const path of [...selected].sort()){
    const read=async root=>{try{return sha(await readFile(resolve(root,path)));}catch(error){if(error.code==='ENOENT')return null;throw error;}};
    const [baselineSha256,currentSha256]=await Promise.all([read(baseline),read(current)]);files.push({path,baselineSha256,currentSha256,unchanged:baselineSha256!==null&&baselineSha256===currentSha256});
  }
  return {format:'sacramentum-graphics-protected-v1',recordedAt:new Date().toISOString(),baseline:relative(project,baseline).split(sep).join('/'),scope:'Every file in src/core and src/data plus browser storage and session-gate modules. Added/deleted files are failures. Renderer/presentation files are intentionally outside this invariant.',count:files.length,unchangedCount:files.filter(file=>file.unchanged).length,allUnchanged:files.every(file=>file.unchanged),files};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(!process.argv[2])throw new Error('Usage: node tests/graphics-protected.mjs FROZEN_PROJECT [OUTPUT_JSON]');
  const report=await recordProtectedFiles(process.argv[2]);
  if(process.argv[3]){const output=resolve(process.argv[3]);await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify({count:report.count,unchangedCount:report.unchangedCount,allUnchanged:report.allUnchanged,changed:report.files.filter(file=>!file.unchanged).map(file=>file.path)},null,2));
  if(!report.allUnchanged)process.exitCode=1;
}

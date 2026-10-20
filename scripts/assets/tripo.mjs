// Generates a model with Tripo for a request in art-source/models/requests/,
// saves the raw GLB in art-source/models/raw/ (gitignored) and records the
// task, the parameters Tripo used, the date, the credits spent and the raw
// file's digest in the request file. Every generate run spends credits.
//
// Authentication comes from the cloud environment's network secret for
// api.tripo3d.ai: the agent proxy adds the Authorization header, so this
// script never sees the key. Elsewhere, TRIPO_API_KEY is sent instead.
//
//   node scripts/assets/tripo.mjs balance
//   node scripts/assets/tripo.mjs generate art-source/models/requests/<id>.json
//   node scripts/assets/tripo.mjs resume art-source/models/requests/<id>.json
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// Node's built-in fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY is set at start-up.
if((process.env.HTTPS_PROXY||process.env.https_proxy)&&process.env.NODE_USE_ENV_PROXY!=='1'){
  const run=spawnSync(process.execPath,[fileURLToPath(import.meta.url),...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,NODE_USE_ENV_PROXY:'1',NODE_NO_WARNINGS:'1'}});
  process.exit(run.status??1);
}

const API='https://api.tripo3d.ai/v2/openapi',root=new URL('../../',import.meta.url);
const key=process.env.TRIPO_API_KEY,FINAL=['success','failed','cancelled','banned','expired','unknown'];
async function call(path,{method='GET',body}={}){
  const response=await fetch(API+path,{method,headers:{'content-type':'application/json',...(key?{authorization:`Bearer ${key}`}:{})},body:body&&JSON.stringify(body)});
  const reply=await response.json().catch(()=>({}));
  if(!response.ok||reply.code!==0)throw new Error(`Tripo ${method} ${path}: HTTP ${response.status}, code ${reply.code??'?'}. ${reply.message??''} ${reply.suggestion??''}`.trim());
  return reply.data;
}
const balance=async()=>(await call('/user/balance')).balance;
const sleep=ms=>new Promise(done=>setTimeout(done,ms));

async function download(url,path){
  let response;
  try{response=await fetch(url);}catch(error){throw new Error(`Could not download from ${new URL(url).host} (${error.cause?.code??error.message}). If the network policy blocks that host, allow it in the environment's network settings.`);}
  if(!response.ok)throw new Error(`Download from ${new URL(url).host} failed: HTTP ${response.status}.`);
  const bytes=Buffer.from(await response.arrayBuffer());await writeFile(new URL(path,root),bytes);return bytes;
}

async function finish(file,request){
  const id=request.provenance.taskId,started=Date.now();let task;
  for(;;){
    task=await call(`/task/${id}`);
    process.stdout.write(`\r${request.id}: ${task.status} ${task.progress??0}%   `);
    if(FINAL.includes(task.status))break;
    if(Date.now()-started>20*60000)throw new Error(`Task ${id} is still ${task.status} after 20 minutes; run resume later.`);
    await sleep(5000);
  }
  process.stdout.write('\n');
  if(task.status!=='success')throw new Error(`Task ${id} ended ${task.status}.`);
  const output=task.output??{},field=['pbr_model','model','base_model'].find(k=>output[k]);
  if(!field)throw new Error(`Task ${id} succeeded without a model link: ${Object.keys(output).join(', ')}`);
  await mkdir(new URL('art-source/models/raw/',root),{recursive:true});
  const raw=`art-source/models/raw/${request.id}.glb`,bytes=await download(output[field],raw);
  let preview=null;
  if(output.rendered_image){preview=`art-source/models/raw/${request.id}-tripo-render${new URL(output.rendered_image).pathname.match(/\.\w+$/)?.[0]??'.png'}`;await download(output.rendered_image,preview).catch(()=>{preview=null;});}
  // Exact only when generate runs one task at a time; parallel runs share the balance.
  const spent=request.provenance.balanceBefore===undefined?null:request.provenance.balanceBefore-await balance();
  Object.assign(request.provenance,{status:task.status,generatedAt:new Date().toISOString(),output:field,raw,rawBytes:bytes.length,rawSha256:createHash('sha256').update(bytes).digest('hex'),
    tripoInput:task.input??null,modelVersion:task.input?.model_version??task.model_version??null,creditsSpent:spent,tripoRender:preview});
  request.status='generated: awaiting review';
  await writeFile(file,JSON.stringify(request,null,2)+'\n');
  console.log(JSON.stringify({id:request.id,task:id,raw,bytes:bytes.length,modelVersion:request.provenance.modelVersion,creditsSpent:spent},null,2));
}

const [command,path]=process.argv.slice(2);
if(command==='balance'){console.log(JSON.stringify(await call('/user/balance')));process.exit(0);}
if(!['generate','resume'].includes(command)||!path){console.error('Usage: node scripts/assets/tripo.mjs balance | generate <request.json> | resume <request.json>');process.exit(2);}
const file=new URL(path,`file://${process.cwd()}/`),request=JSON.parse(await readFile(file,'utf8'));
try{
  if(command==='generate'){
    if(request.provenance?.taskId)throw new Error(`${request.id} already has task ${request.provenance.taskId}; use resume, or clear taskId to pay for a new one.`);
    const before=await balance(),body={type:request.generator.task,prompt:request.generator.prompt,...(request.generator.options??{})};
    const {task_id}=await call('/task',{method:'POST',body});
    // Record the task at once, so an interrupted run resumes instead of paying again.
    request.provenance={...request.provenance,taskId:task_id,requestedAt:new Date().toISOString(),balanceBefore:before,requestBody:body};
    await writeFile(file,JSON.stringify(request,null,2)+'\n');
  }else if(!request.provenance?.taskId)throw new Error(`${request.id} has no task to resume.`);
  await finish(file,request);
}catch(error){console.error(error.message);process.exit(1);}

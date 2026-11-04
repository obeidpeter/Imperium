// Development-only Tripo workflow. No task creation is retried automatically.
// See docs/tripo-v3-migration.md for approvals, recovery and historical records.
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,open,readFile,rename,unlink} from 'node:fs/promises';
import {basename,dirname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTripoClient,generationRequest,rigRequest,modelOutput,taskCredits,taskId,TRIPO_API} from './tripo-client.mjs';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const usage='Usage: node scripts/assets/tripo.mjs balance | task <task-id> | generate <request.json> [--dry-run | --allow-paid] | resume <request.json> | rig <request.json> [--dry-run | --allow-paid] | rig-check <request.json> | resume-rig <request.json>';

async function optionalRead(file){
  try{return await readFile(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}
}

// A crash must leave old JSON or new JSON, never a truncated task record.
async function atomicWrite(file,bytes){
  const temp=`${file}.${randomUUID()}.tmp`;
  let handle;
  try{
    handle=await open(temp,'wx');await handle.writeFile(bytes);await handle.sync();await handle.close();handle=null;
    await rename(temp,file);
  }finally{if(handle)await handle.close();await unlink(temp).catch(error=>{if(error.code!=='ENOENT')throw error;});}
}
const save=(file,request)=>atomicWrite(file,JSON.stringify(request,null,2)+'\n');

async function withLock(file,operation){
  const lock=`${file}.tripo.lock`;let handle;
  try{handle=await open(lock,'wx');}
  catch(error){if(error.code==='EEXIST')throw new Error('This request is locked by another run or an interrupted run. Check the task record and stop any active run before manually removing its .tripo.lock file.');throw error;}
  try{await handle.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));await handle.sync();return await operation();}
  finally{await handle.close();await unlink(lock);}
}

function freshRecord(record,label){
  if(record?.taskId)throw new Error(`${label} already has task ${record.taskId}; use resume (or resume-rig). Never clear its task ID to generate again.`);
  if(record?.submission)throw new Error(`${label} has an unresolved submission. Reconcile it in Tripo and recover the existing task ID before continuing; it may already have been charged.`);
  if(record?.rawSha256||record?.rejectedAttempts?.length||record?.requestBody)throw new Error(`${label} has historical generation evidence. Preserve it and prepare a separately approved request with a new asset ID.`);
}

function rawPath(root,record,id,rigged=false){
  const relative=record.raw??`art-source/models/raw/${id}${rigged?'-rigged':''}.glb`;
  const dir=resolve(root,'art-source/models/raw'),file=resolve(root,relative);
  if(!file.startsWith(dir+sep)||!file.toLowerCase().endsWith('.glb'))throw new Error('Recorded raw model path must stay inside art-source/models/raw and end in .glb.');
  return {relative,file};
}

function checkGlb(bytes){
  if(bytes.length<12||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length){
    throw new Error('Tripo returned an invalid GLB. No raw asset or recorded hash was replaced; keep the task ID for recovery.');
  }
}

async function finish(file,request,record,{root,client,log,now,saveRequest},rigged=false){
  const raw=rawPath(root,record,request.id,rigged),existing=await optionalRead(raw.file);
  // Recovery of a finished asset is non-mutating and works offline.
  if(existing&&record.rawSha256){
    if(digest(existing)!==record.rawSha256)throw new Error('Existing raw model does not match its recorded SHA-256. Preserve both for investigation; no file was overwritten.');
    log({id:request.id,task:record.taskId,raw:raw.relative,sha256:record.rawSha256,recovery:'already verified locally'});return;
  }
  const task=await client.settle(taskId(record.taskId),`${request.id}${rigged?' rig':''}`);
  if(task.type&&task.type!==(rigged?'animate_rig':request.generator?.task))throw new Error('Recorded task has the wrong operation type. Verify the recovered ID; no model was downloaded.');
  const output=modelOutput(task),bytes=await client.download(output.url),hash=digest(bytes);
  checkGlb(bytes);
  if(record.rawSha256&&record.rawSha256!==hash)throw new Error('Downloaded model does not match the historical SHA-256. No asset or task record was overwritten.');
  if(existing&&digest(existing)!==hash)throw new Error('A different raw model already exists at the output path. No asset or task record was overwritten.');
  await mkdir(dirname(raw.file),{recursive:true});
  if(!existing)await atomicWrite(raw.file,bytes);
  // Old task downloads must not rewrite dates, charges, models or review status.
  if(record.rawSha256){
    log({id:request.id,task:record.taskId,raw:raw.relative,sha256:hash,recovery:'restored; historical record unchanged'});return;
  }
  let preview=null;
  if(output.preview&&!rigged){
    try{
      const ext=new URL(output.preview).pathname.match(/\.(png|jpe?g|webp)$/i)?.[0]??'.png';
      preview=`art-source/models/raw/${request.id}-tripo-render${ext}`;
      await atomicWrite(resolve(root,preview),await client.download(output.preview));
    }catch{preview=null;}
  }
  const reportedModel=task.model??task.model_version??task.input?.model??task.input?.model_version;
  const requestedModel=record.requestBody?.model??record.requestBody?.model_version;
  const credits=taskCredits(task);
  // Missing V3 metadata must not erase evidence recorded by an interrupted V2 run.
  Object.assign(record,{
    status:task.status,generatedAt:record.generatedAt??now(),output:output.field,raw:raw.relative,rawBytes:bytes.length,rawSha256:hash,
    tripoInput:record.tripoInput??task.input??null,
    modelVersion:record.modelVersion??reportedModel??requestedModel??null,
    modelVersionSource:record.modelVersion!=null?(record.modelVersionSource??'historical record'):reportedModel?'task response':requestedModel?'submitted request':'not reported',
    creditsSpent:record.creditsSpent??credits.creditsSpent,creditSource:record.creditsSpent!=null?(record.creditSource??'historical record'):credits.creditSource,
    tripoCreatedAt:task.created_at??null,tripoCompletedAt:task.completed_at??null,
    ...(rigged?{}:{tripoRender:record.tripoRender??preview})
  });
  if(!rigged)request.status='generated: awaiting review';
  await saveRequest(file,request);
  log({id:request.id,task:record.taskId,raw:raw.relative,sha256:hash,modelVersion:record.modelVersion,creditsSpent:record.creditsSpent});
}

async function submit(file,request,record,wire,{client,now,saveRequest},paid){
  freshRecord(record,request.id);
  const account=paid?await client.balance():null;
  Object.assign(record,{apiVersion:3,apiBase:TRIPO_API,endpoint:wire.endpoint,requestedAt:now(),requestBody:wire.body,
    ...(account?{balanceBefore:account.balance,balanceSnapshotBefore:account}:{}),
    submission:{id:randomUUID(),state:'pending',requestSha256:digest(JSON.stringify(wire.body))}});
  // Persist BEFORE the POST. A lost response or disk error blocks a second POST,
  // even if the service never returned a task ID.
  await saveRequest(file,request);
  let id;
  try{id=await client.create(wire);}
  catch(error){record.submission.state='uncertain';await saveRequest(file,request);throw error;}
  record.taskId=id;record.submission.state='accepted';
  try{await saveRequest(file,request);}
  catch{throw new Error(`Tripo accepted task ${id}, but saving its ID failed. Recover this exact ID into the pending record; do not generate again.`);}
  return id;
}

async function rigCheck(file,request,ctx){
  const p=request.provenance;
  if(!p?.taskId||!p.rawSha256)throw new Error('No generated, hashed model is available for rigging.');
  if(p.rig?.check?.riggable!==undefined)return p.rig.check;
  const record=p.rigCheck??={};
  if(!record.taskId)await submit(file,request,record,{endpoint:'/animations/rig-check',body:{input:taskId(p.taskId)}},ctx,false);
  if(record.status==='success'&&typeof record.output?.riggable==='boolean')return record.output;
  const task=await ctx.client.settle(record.taskId,`${request.id} rig check`);
  if(task.type&&task.type!=='animate_prerigcheck')throw new Error('Recorded rig-check task has the wrong operation type; no paid rig was submitted.');
  if(typeof task.output?.riggable!=='boolean')throw new Error('Tripo rig check omitted the riggable result; no paid rig was submitted.');
  Object.assign(record,{status:task.status,output:task.output,...taskCredits(task)});
  await ctx.saveRequest(file,request);return record.output;
}

export async function runTripo(args,{root=ROOT,client=createTripoClient(),log=value=>console.log(JSON.stringify(value,null,2)),now=()=>new Date().toISOString(),saveRequest=save}={}){
  const command=args[0],flags=args.filter(arg=>arg.startsWith('--')),positional=args.slice(1).filter(arg=>!arg.startsWith('--'));
  if(flags.some(flag=>!['--dry-run','--allow-paid'].includes(flag))||new Set(flags).size!==flags.length)throw new Error(usage);
  const dry=flags.includes('--dry-run'),paid=flags.includes('--allow-paid');
  if((flags.length&&!['generate','rig'].includes(command))||(dry&&paid))throw new Error(usage);
  const ctx={root,client,log,now,saveRequest};
  if(command==='balance'&&!positional.length){log(await client.balance());return;}
  if(command==='task'&&positional.length===1){
    const task=await client.task(taskId(positional[0]));
    log({taskId:task.task_id,status:task.status,progress:task.progress??null,type:task.type??null,...taskCredits(task),modelVersion:task.model??task.model_version??task.input?.model??task.input?.model_version??null,createdAt:task.created_at??null,completedAt:task.completed_at??null,hasModelUrl:!!(task.output?.model_url??task.output?.pbr_model??task.output?.model??task.output?.base_model),errorCode:task.error_code??null});return;
  }
  if(!['generate','resume','rig','rig-check','resume-rig'].includes(command)||positional.length!==1)throw new Error(usage);
  const file=resolve(positional[0]);
  const operate=async()=>{
    const request=JSON.parse(await readFile(file,'utf8'));
    if(typeof request.id!=='string'||!/^[a-z0-9][a-z0-9-]*$/.test(request.id)||basename(file)!==`${request.id}.json`)throw new Error('Request filename must match its lowercase, hyphenated asset ID.');
    if(request.provenance!==undefined&&(!request.provenance||typeof request.provenance!=='object'||Array.isArray(request.provenance)))throw new Error('provenance must be an object.');
    const p=request.provenance??={};
    if(command==='resume'||command==='resume-rig'){
      const record=command==='resume-rig'?p.rig:p;
      if(!record?.taskId)throw new Error('No recorded task to resume. If a submission is pending, reconcile it first; recovery never creates a replacement.');
      return finish(file,request,record,ctx,command==='resume-rig');
    }
    if(command==='rig-check'){log(await rigCheck(file,request,ctx));return;}
    if(command==='rig'&&p.rig?.taskId){
      if(dry){log({operation:'resume-rig',taskId:p.rig.taskId,paid:false});return;}
      return finish(file,request,p.rig,ctx,true);
    }
    freshRecord(command==='rig'?p.rig:p,request.id);
    const wire=command==='rig'?rigRequest(request):generationRequest(request);
    if(command==='rig'&&!p.rawSha256)throw new Error('No generated, hashed model is available for rigging.');
    if(dry){log({apiBase:TRIPO_API,...wire,paid:true,submitted:false});return;}
    if(!paid)throw new Error('Creating this task spends Tripo credits. Review --dry-run, obtain approval for this request, then pass --allow-paid. Nothing was submitted.');
    if(command==='generate'){
      await submit(file,request,p,wire,ctx,true);return finish(file,request,p,ctx);
    }
    const check=await rigCheck(file,request,ctx);
    if(!check.riggable)throw new Error('Tripo reports this model is not riggable; no paid rig was submitted.');
    if(check.rig_type&&check.rig_type!==wire.body.rig_type)throw new Error(`Rig check recommends ${check.rig_type}, but the request selects ${wire.body.rig_type}; review before paying.`);
    const record=p.rig??={};
    record.check=check;
    await submit(file,request,record,wire,ctx,true);return finish(file,request,record,ctx,true);
  };
  return dry?operate():withLock(file,operate);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  // Node's built-in fetch needs opt-in to use the environment's proxy.
  if((process.env.HTTPS_PROXY||process.env.https_proxy)&&process.env.NODE_USE_ENV_PROXY!=='1'){
    const child=spawnSync(process.execPath,[fileURLToPath(import.meta.url),...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,NODE_USE_ENV_PROXY:'1'}});
    process.exitCode=child.status??1;
  }else{
    try{await runTripo(process.argv.slice(2),{client:createTripoClient({onProgress:({label,status,progress})=>console.error(`${label}: ${status} ${progress}%`)})});}
    catch(error){console.error(error.message);process.exitCode=1;}
  }
}

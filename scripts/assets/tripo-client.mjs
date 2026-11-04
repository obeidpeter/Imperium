// Tripo V3 wire format. Keep this separate from the on-disk asset history.
// Contract: https://developers.tripo3d.ai/en/docs/migration-v2-to-v3
export const TRIPO_API='https://openapi.tripo3d.ai/v3';
export const GENERATION_MODEL='v3.1-20260211';
export const TEXTURE_MODEL='v3.0-20250812';
// The Blender binder was built against this still-supported biped skeleton.
// A newer rig model is an explicit art-pipeline choice, not an API migration.
export const RIG_MODEL='v1.0-20240301';
const GENERATION_MODELS=['v3.0-20250812',GENERATION_MODEL];
const TEXTURE_MODELS=[TEXTURE_MODEL,'v3.5-20260815'];
const RIG_MODELS=[RIG_MODEL,'v2.5-20260210','v3.0-20260909'];
const TERMINAL=new Set(['success','failed','cancelled','banned','expired']);
const UUID=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

export function taskId(value){
  if(typeof value!=='string'||!UUID.test(value))throw new Error('Expected a Tripo task UUID returned by the API.');
  return value;
}

function model(options,fallback,allowed){
  if(options.model!==undefined&&options.model_version!==undefined&&options.model!==options.model_version){
    throw new Error('Conflicting model and legacy model_version; choose one model explicitly.');
  }
  const value=options.model??options.model_version??fallback;
  if(!allowed.includes(value))throw new Error(`Unsupported or retiring Tripo model ${value}; choose ${allowed.join(' or ')} for a new request. Historical records must stay unchanged.`);
  return value;
}

function knownOptions(options,keys){
  if(!object(options))throw new Error('Generator options must be an object.');
  for(const key of Object.keys(options))if(!keys.includes(key))throw new Error(`Unsupported Tripo option ${key}; migrate it explicitly instead of silently dropping it.`);
}

function choice(body,key,values){
  if(body[key]!==undefined&&!values.includes(body[key]))throw new Error(`Invalid ${key}; choose ${values.join(', ')}.`);
}

export function generationRequest(request){
  const g=request.generator;
  if(!object(g)||!['text_to_model','image_to_model'].includes(g.task))throw new Error('This pipeline supports text_to_model and image_to_model generation only.');
  const common=['model','model_version','negative_prompt','model_seed','texture_seed','face_limit','texture','pbr','texture_quality','texture_version','delight','geometry_quality','auto_size','quad','smart_low_poly','generate_parts','compress','export_uv'];
  const options=g.options??{};
  knownOptions(options,[...common,...(g.task==='text_to_model'?['image_seed']:['input','enable_image_autofix','texture_alignment','orientation'])]);
  const body={...options,model:model(options,GENERATION_MODEL,GENERATION_MODELS)};
  delete body.model_version;
  body.texture_version??=TEXTURE_MODEL;
  if(!TEXTURE_MODELS.includes(body.texture_version))throw new Error('Retiring or unsupported texture_version; choose v3.0-20250812 or v3.5-20260815.');
  for(const key of ['texture','pbr','delight','auto_size','quad','smart_low_poly','generate_parts','export_uv','enable_image_autofix']){
    if(body[key]!==undefined&&typeof body[key]!=='boolean')throw new Error(`${key} must be a boolean.`);
  }
  // This pipeline saves one GLB and processes it in Blender. Do not silently
  // produce FBX, segmented outputs, or December's changing low-poly model.
  if(body.quad||body.generate_parts||body.smart_low_poly)throw new Error('quad, generate_parts and smart_low_poly are not supported by this single-GLB Blender pipeline.');
  for(const key of ['model_seed','texture_seed','image_seed','face_limit']){
    if(body[key]!==undefined&&(!Number.isSafeInteger(body[key])||body[key]<0||(key==='face_limit'&&body[key]===0)))throw new Error(`${key} must be a ${key==='face_limit'?'positive':'non-negative'} safe integer.`);
  }
  if(body.negative_prompt!==undefined&&(typeof body.negative_prompt!=='string'||body.negative_prompt.length>255))throw new Error('negative_prompt must be a string of at most 255 characters.');
  choice(body,'texture_quality',['fast','standard','detailed','extreme']);
  choice(body,'geometry_quality',['standard','detailed']);
  choice(body,'compress',['geometry']);
  choice(body,'texture_alignment',['original_image','geometry']);
  choice(body,'orientation',['default','align_image']);
  if(body.texture_quality==='fast'&&body.texture_version!=='v3.5-20260815')throw new Error('texture_quality fast requires texture_version v3.5-20260815.');
  if(g.task==='text_to_model'){
    if(typeof g.prompt!=='string'||!g.prompt.trim()||g.prompt.length>1024)throw new Error('Text-to-model needs a non-empty prompt of at most 1,024 characters.');
    body.prompt=g.prompt;
  }else{
    if(g.input!==undefined&&body.input!==undefined&&g.input!==body.input)throw new Error('Conflicting image inputs.');
    body.input=g.input??body.input;
    if(typeof body.input!=='string'||!body.input.trim())throw new Error('Image-to-model needs generator.input: a V3 file_token, image task UUID or HTTPS image URL.');
    if(!UUID.test(body.input)&&!/^file_[\w-]+$/.test(body.input)){
      let url;try{url=new URL(body.input);}catch{}
      if(!url||url.protocol!=='https:'||url.username||url.password)throw new Error('Image input must be a V3 file_token, task UUID or HTTPS URL. Upload local files separately; never put credentials in a URL.');
    }
  }
  return {endpoint:`/generation/${g.task.replaceAll('_','-')}`,body};
}

export function rigRequest(request){
  const options=request.generator?.rig??{};
  knownOptions(options,['model','model_version','rig_type','spec','out_format']);
  const body={input:taskId(request.provenance?.taskId),model:model(options,RIG_MODEL,RIG_MODELS),rig_type:'biped',spec:'tripo',out_format:'glb',...options};
  delete body.model_version;
  // Reapply the resolved value after spreading legacy options.
  body.model=model(options,RIG_MODEL,RIG_MODELS);
  choice(body,'rig_type',['biped','quadruped','hexapod','octopod','avian','serpentine','aquatic','others']);
  choice(body,'spec',['tripo','mixamo','actorcore','unity','unreal','vrm']);
  if(body.out_format!=='glb')throw new Error('The Blender pipeline requires out_format glb.');
  if(body.model===RIG_MODEL&&body.rig_type!=='biped')throw new Error('The v1.0 rig model supports bipeds only.');
  if(body.model!=='v3.0-20260909'&&(body.rig_type==='others'||!['tripo','mixamo'].includes(body.spec)))throw new Error('This rig type or skeleton convention requires rig model v3.0-20260909.');
  return {endpoint:'/animations/rig',body};
}

export function modelOutput(task){
  const output=task.output??{};
  const field=['model_url','pbr_model','model','base_model'].find(key=>typeof output[key]==='string'&&output[key]);
  if(!field)throw new Error('Successful Tripo task has no downloadable model URL. Keep its task ID and retry recovery; do not generate again.');
  return {field,url:output[field],preview:output.rendered_image_url??output.rendered_image??null};
}

export function taskCredits(task){
  for(const field of ['credits_consumed','consumed_credit']){
    if(Number.isFinite(task[field])&&task[field]>=0)return {creditsSpent:task[field],creditSource:`task.${field}`};
  }
  return {creditsSpent:null,creditSource:'not reported; reconcile task usage (never infer from a shared wallet)'};
}

export function createTripoClient({key=process.env.TRIPO_API_KEY,proxyAuth=process.env.TRIPO_PROXY_AUTH==='1',fetchImpl=globalThis.fetch,now=Date.now,sleep=pause,onProgress=()=>{}}={}){
  const safe=value=>String(value??'').replace(key?new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'):/$^/g,'[redacted]').replace(/\btsk_[\w-]+/g,'[redacted]').slice(0,300);
  async function call(path,{method='GET',body,timeoutMs=30000}={}){
    if(key!=null&&(typeof key!=='string'||!key.trim()||/\s/.test(key)))throw new Error('TRIPO_API_KEY must contain only the existing secret key, without whitespace or a Bearer prefix.');
    if(!key&&!proxyAuth)throw new Error('Tripo authentication is not configured. Supply the existing TRIPO_API_KEY, or set TRIPO_PROXY_AUTH=1 only for an approved proxy secret on openapi.tripo3d.ai.');
    let response;
    try{
      response=await fetchImpl(TRIPO_API+path,{method,redirect:'error',signal:AbortSignal.timeout(timeoutMs),headers:{'content-type':'application/json',...(key?{authorization:`Bearer ${key}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    }catch{
      const error=new Error(`Tripo ${method} ${path}: network, timeout or redirect failure.${method==='POST'?' Submission may have reached Tripo; do not submit again.':''}`);
      error.retryable=method==='GET';throw error;
    }
    let reply;try{reply=await response.json();}catch{}
    if(!response.ok||!object(reply)||reply.code!==0||!object(reply.data)){
      const error=new Error(`Tripo ${method} ${path}: HTTP ${response.status}, code ${Number.isInteger(reply?.code)?reply.code:'?'}. ${safe(reply?.message)}${reply?.request_id?` (request ${safe(reply.request_id)})`:''}`.trim());
      error.retryable=method==='GET'&&(response.status===429||response.status>=500);
      throw error;
    }
    return reply.data;
  }
  async function balance(){
    const data=await call('/account/balance');
    if(!Number.isFinite(data.balance)||!Number.isFinite(data.frozen)||data.balance<0||data.frozen<0)throw new Error('Tripo returned an invalid credit balance.');
    return {balance:data.balance,frozen:data.frozen};
  }
  async function task(id,options){
    taskId(id);
    const result=await call(`/tasks/${id}`,options);
    if(result.task_id!==id||typeof result.status!=='string')throw new Error('Tripo task response has a missing or mismatched task ID/status. Keep the existing task record.');
    return result;
  }
  async function settle(id,label,{timeoutMs=20*60000}={}){
    const end=now()+timeoutMs;let failures=0;
    while(now()<end){
      let data;
      try{data=await task(id,{timeoutMs:Math.max(1,Math.min(30000,end-now()))});failures=0;}
      catch(error){if(!error.retryable||++failures>5)throw error;await sleep(Math.min(5000*failures,Math.max(0,end-now())));continue;}
      onProgress({label,status:data.status,progress:data.progress??0});
      if(TERMINAL.has(data.status)){
        if(data.status!=='success')throw new Error(`Tripo task ${id} ended ${data.status}${data.error_code!==undefined?` (code ${safe(data.error_code)})`:''}: ${safe(data.error_message)}. Keep this task ID; no replacement was submitted.`);
        return data;
      }
      await sleep(Math.min(5000,Math.max(0,end-now())));
    }
    throw new Error(`Tripo task ${id} did not finish within the polling limit; resume this task later. No replacement was submitted.`);
  }
  async function create({endpoint,body}){
    // Intentionally ONE request: there is no documented creation idempotency key.
    if(!['/generation/text-to-model','/generation/image-to-model','/animations/rig-check','/animations/rig'].includes(endpoint))throw new Error('Unsupported Tripo creation endpoint.');
    const result=await call(endpoint,{method:'POST',body});
    return taskId(result.task_id);
  }
  async function download(url){
    let parsed;try{parsed=new URL(url);}catch{}
    if(!parsed||parsed.protocol!=='https:'||parsed.username||parsed.password)throw new Error('Tripo download URL must use HTTPS without credentials.');
    let response;try{response=await fetchImpl(parsed.href,{signal:AbortSignal.timeout(120000)});}catch{throw new Error('Tripo asset download failed; resume the recorded task later.');}
    if(!response.ok)throw new Error(`Tripo asset download failed: HTTP ${response.status}; resume the recorded task later.`);
    // No API headers are sent to model/preview hosts.
    return Buffer.from(await response.arrayBuffer());
  }
  return {balance,task,settle,create,download};
}

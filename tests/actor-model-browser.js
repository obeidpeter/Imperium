import * as T from '../vendor/three/three.module.js';
import {createActor,actorKit} from '../src/showcase/actors.js';
import {actorIdentity} from '../src/showcase/actor-identity.js';
import {warmActorAssets,actorAssetStatus} from '../src/showcase/actor-assets.js';
import {warmActorMaterials,warmPremiumActorMaterials,actorMaterialStatus,premiumActorMaterialStatus} from '../src/showcase/actor-materials.js';
import {PERFORMANCE_SOURCE_HASH,PERFORMANCE_CLIPS} from '../src/showcase/actor-performance-data.js';
import {getSceneProfile} from '../src/showcase/campaign-scene-profile.js';
import {createSceneLighting} from '../src/showcase/scene-lighting.js';
import {ACTOR_CASES,ACTOR_MOTIONS,actorCase,actorResources,sampleSummary,characterReviewStep} from './actor-model-cases.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),errors=[];
const condition=key=>params.has(key)&&Number.isFinite(Number(params.get(key)))?Math.max(0,Math.min(1,Number(params.get(key)))):1,health=condition('health'),morale=condition('morale');
let renderer,scene,camera,actor=null,lighting=null,lightGroup=null,floor=null,selection=actorCase(params.get('actor')),generation=0,disposed=false,raf=0,previous=0,elapsed=0,playUntil=0,sampling=null,resetPose=true,resourceStats=null;
let disposedActors=0,createdActors=0,loadMs=0,profile=null,frameCosts=[],frameIntervals=[],sampleResult=null,sampleTimer=0;
let sequencePlaying=false;
const canvas=$('canvas');
function error(message){errors.push(String(message));if(errors.length>12)errors.shift();$('errors').textContent=errors.join('\n');$('status').textContent='Diagnostic error — see the report below.';}
window.addEventListener('error',event=>error(event.message));window.addEventListener('unhandledrejection',event=>error(event.reason?.message??event.reason));
$('actor').innerHTML=ACTOR_CASES.map(item=>`<option value="${item.id}">${item.label}</option>`).join('');
$('motion').innerHTML=ACTOR_MOTIONS.map(motion=>`<option value="${motion}">${motion}</option>`).join('');
for(const id of ['actor','lighting','view','motion','quality','detail']){const value=params.get(id);if(value&&[...$(id).options].some(option=>option.value===value))$(id).value=value;}
for(const [id,min,max]of [['phase',0,1],['yaw',-180,180],['gaze',-18,18]])if(params.has(id)&&Number.isFinite(Number(params.get(id))))$(id).value=Math.max(min,Math.min(max,Number(params.get(id))));
const dpr=Math.max(.5,Math.min(2,Number(params.get('dpr'))||devicePixelRatio||1));
const neutral={sky:'#c2c8c9',fog:'#c2c8c9',sun:'#fff2de',ambient:'#e3eaf2',ambientGround:'#a6a49c',sunPosition:[-3,5,4],sunIntensity:2.2,ambientIntensity:1.6,exposure:1.1};
const timeout=(promise,ms)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(`Asset readiness exceeded ${ms/1000} seconds; reload to retry.`)),ms);promise.then(value=>{clearTimeout(timer);resolve(value);},cause=>{clearTimeout(timer);reject(cause);});});

function configuration(){return {actor:selection.id,lighting:$('lighting').value,view:$('view').value,motion:$('motion').value,quality:$('quality').value,detail:$('detail').value,phase:Number($('phase').value),yaw:Number($('yaw').value),gaze:Number($('gaze')?.value||0),health,morale,pixelRatio:dpr,closedEyelids:$('blink').checked,wireframe:$('wireframe').checked};}
const selectedIdentity=()=>actorIdentity(selection.unit,actorKit(selection.unit,selection.options));
function syncUrl(){const query=new URLSearchParams();for(const [key,value]of Object.entries(configuration()))query.set(key==='pixelRatio'?'dpr':key,value);history.replaceState(null,'',`${location.pathname}?${query}`);}
function report(){
  if(!renderer)return;
  const result={scope:'Development inspection of production actor modules; presentation specimens only. No campaign/save mutation, production compositor, battlefield or GPU timing.',url:location.href,selection:selection.label,configuration:configuration(),profile:profile?.title??$('lighting').value,asset:actorAssetStatus(selectedIdentity()),materials:actorMaterialStatus(),actor:actor?.group.userData.actor??null,resources:resourceStats,renderer:{drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs?.length??0,scope:'Whole inspection frame, including floor and shadow passes. Counts are not the campaign frame cost.'},viewport:{width:canvas.clientWidth,height:canvas.clientHeight,drawingWidth:canvas.width,drawingHeight:canvas.height,devicePixelRatio},samples:{synchronousUpdateAndRenderMs:sampleSummary(frameCosts),rafIntervalMs:sampleSummary(frameIntervals),status:sampling?'running':'idle',result:sampleResult,scope:'At most 120 actual desktop-browser frames. CPU submission duration and RAF spacing are not GPU time or a physical-phone claim.'},lifecycle:{createdActors,disposedActors,liveActors:actor?1:0,initialLoadMs:loadMs},errors:[...errors]};
  result.performanceSource={hash:PERFORMANCE_SOURCE_HASH,authoredJointClips:Object.keys(PERFORMANCE_CLIPS).length,method:'Original JSON joint keyframes; no new authored bitmap frames or motion capture'};
  result.premiumMaterials=premiumActorMaterialStatus();
  $('report').textContent=JSON.stringify(result,null,2);return result;
}
function resize(){const {width,height}=canvas.getBoundingClientRect();if(width<1||height<1)return;const w=Math.round(width),h=Math.round(height);if(canvas.width!==Math.floor(w*dpr)||canvas.height!==Math.floor(h*dpr))renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function frameCamera(){
  if(!actor)return;actor.group.updateMatrixWorld(true);
  if($('view').value==='head'){
    const head=actor.group.getObjectByName('head'),target=head?head.getWorldPosition(new T.Vector3()):new T.Vector3(0,1.55,0);target.y+=.07;
    const distance=.85/Math.min(1,camera.aspect);camera.position.set(0,target.y+.025,distance);camera.lookAt(target);
  }else if($('view').value==='equipment'){
    const height=actor.group.userData.actor.mounted?1.9:1.1;camera.position.set(.45,height+.14,2.45/Math.min(1,camera.aspect));camera.lookAt(0,height,.04);
  }else{
    const height=Math.max(1.8,actor.group.userData.actor.height??1.85),target=new T.Vector3(0,height*.49,0),distance=height*.66/Math.tan(camera.fov*Math.PI/360)/Math.min(1,camera.aspect);
    const tactical=$('view').value==='tactical';camera.position.set(tactical?-3.2:0,tactical?5.2:height*.59,tactical?8.5:distance);camera.lookAt(target);
  }
}
function disposeLighting(){lighting?.dispose();lighting=null;lightGroup?.traverse(object=>{object.shadow?.map?.dispose();object.shadow?.mapPass?.dispose();});lightGroup?.removeFromParent();lightGroup=null;}
function setLighting(){
  disposeLighting();lightGroup=new T.Group();scene.add(lightGroup);
  const civic=['voter','speaker'].includes(selection.unit.role);profile=$('lighting').value==='field'?getSceneProfile({id:`ch${selection.options.chapter}-actor-review`,kind:civic?'contest':'battle'},selection.options):neutral;
  scene.background=new T.Color(profile.sky);renderer.toneMappingExposure=profile.exposure;
  lightGroup.add(new T.HemisphereLight(profile.ambient,profile.ambientGround,profile.ambientIntensity));
  const key=new T.DirectionalLight(profile.sun,profile.sunIntensity);key.position.fromArray(profile.sunPosition);key.castShadow=$('quality').value!=='performance';key.shadow.mapSize.setScalar($('quality').value==='high'?2048:1024);key.shadow.camera.left=key.shadow.camera.bottom=-4;key.shadow.camera.right=key.shadow.camera.top=4;key.shadow.camera.near=.1;key.shadow.camera.far=70;key.shadow.normalBias=.025;key.target.position.set(0,1,0);lightGroup.add(key,key.target);
  if($('lighting').value==='neutral'){const fill=new T.DirectionalLight('#dce9ff',.55);fill.position.set(3,2,-2);lightGroup.add(fill);}
  lighting=createSceneLighting(renderer,scene,profile,{quality:$('quality').value});floor.material.color.set($('lighting').value==='neutral'?'#8f9491':profile.groundTint??'#8f9477');
}
function stop(reason='paused'){
  playUntil=0;previous=0;sequencePlaying=false;clearTimeout(sampleTimer);if(sampling){sampling=null;sampleResult={completed:false,reason,frames:frameCosts.length};$('status').textContent=`Measurement interrupted: ${reason}. ${frameCosts.length}/120 frames retained.`;report();}
  $('play').textContent='Play 12 seconds';$('sample').disabled=false;
}
function clearSamples(){frameCosts=[];frameIntervals=[];sampleResult=null;}
function requestFrame(){if(!disposed&&!raf&&!document.hidden)raf=requestAnimationFrame(draw);}
function draw(ms){
  raf=0;if(disposed||document.hidden||!actor)return;
  try{
    const moving=playUntil>ms||!!sampling,delta=previous?Math.max(0,Math.min(.05,(ms-previous)/1000)):0,interval=previous?ms-previous:null;previous=ms;
    if(moving){elapsed+=delta;$('phase').value=(elapsed%1.8)/1.8;}
    const step=sequencePlaying?characterReviewStep(elapsed):{motion:$('motion').value,phase:Number($('phase').value)},phase=step.phase,started=performance.now();resize();
    if(sequencePlaying){$('motion').value=step.motion;$('phase').value=phase;}
    actor.group.traverse(object=>{for(const material of Array.isArray(object.material)?object.material:[object.material])if(material?.isMeshStandardMaterial)material.wireframe=$('wireframe').checked;});
    actor.update({motion:step.motion,health,morale,time:$('blink').checked?4.58-(actorKit(selection.unit,selection.options).identity%13)*.13:elapsed,phase,movementProgress:['walk','run'].includes(step.motion)?phase:undefined,direction:Number($('yaw').value)*Math.PI/180,gazeYaw:Number($('gaze')?.value||0)*Math.PI/180,dt:moving?delta:0,resetPose,groundHeight:()=>0,detailDistance:$('detail').value==='overview'?40:2,active:false});resetPose=false;
    frameCamera();renderer.render(scene,camera);const cost=performance.now()-started;
    $('phase-label').textContent=`${Math.round(phase*100)}%`;$('yaw-label').textContent=`${$('yaw').value}°`;if($('gaze-label'))$('gaze-label').textContent=`${$('gaze').value}°`;$('caption').textContent=`${selection.label} · ${$('lighting').selectedOptions[0].textContent} · ${$('motion').value} ${Math.round(phase*100)}%`;
    if(sampling&&sampling.warmup--<=0){frameCosts.push(cost);if(interval!==null)frameIntervals.push(interval);if(frameCosts.length>=120){sampling=null;clearTimeout(sampleTimer);playUntil=0;sampleResult={completed:true,frames:120};$('sample').disabled=false;$('play').textContent='Play 12 seconds';$('status').textContent='Completed 120 actual render samples. See scope and timings below.';resourceStats=actorResources(actor.group);report();}}
    if(!moving||!sampling&&playUntil<=ms){$('play').textContent='Play 12 seconds';resourceStats=actorResources(actor.group);report();}else if(frameCosts.length&&frameCosts.length%30===0)report();
    if(playUntil>ms||sampling)requestFrame();
  }catch(cause){stop('render failure');error(cause.stack??cause.message);report();}
}
async function replaceActor(){
  if(!renderer)return;stop('selection changed');const ticket=++generation;actor?.dispose();if(actor)disposedActors++;actor=null;resourceStats=null;frameCosts=[];frameIntervals=[];sampleResult=null;renderer.renderLists.dispose();selection=actorCase($('actor').value);$('status').textContent=`Preparing ${selection.label}…`;
  const candidate=createActor(selection.unit,{...selection.options,quality:$('quality').value});createdActors++;
  try{await timeout(candidate.ready,15000);if(disposed||ticket!==generation){candidate.dispose();disposedActors++;return;}actor=candidate;scene.add(actor.group);elapsed=Number($('phase').value)*1.8;resetPose=true;setLighting();resourceStats=actorResources(actor.group);syncUrl();$('status').textContent=`Ready: ${selection.label}. Choose a pose or play a bounded 12-second loop.`;requestFrame();}
  catch(cause){candidate.dispose();disposedActors++;if(actor===candidate)actor=null;error(cause.stack??cause.message);report();}
}
function manualPose(){stop('manual pose');clearSamples();resetPose=true;elapsed=Number($('phase').value)*1.8;syncUrl();requestFrame();}
for(const id of ['actor','quality'])$(id).addEventListener('change',replaceActor);
$('lighting').addEventListener('change',()=>{stop('lighting changed');clearSamples();setLighting();syncUrl();requestFrame();});
for(const id of ['view','motion','detail','wireframe'])$(id).addEventListener('change',manualPose);
for(const id of ['phase','yaw','gaze'])$(id)?.addEventListener('input',manualPose);
$('blink').addEventListener('change',manualPose);
$('rotate').onclick=()=>{$('yaw').value=(Number($('yaw').value)+225)%360-180;manualPose();};
$('play').onclick=()=>{if(playUntil>performance.now()){stop();requestFrame();return;}if(!actor)return;previous=0;playUntil=performance.now()+12000;$('play').textContent='Pause';$('status').textContent='Playing a maximum of 12 seconds; hidden tabs stop immediately.';requestFrame();};
$('sequence').onclick=()=>{if(!actor)return;stop();sequencePlaying=true;elapsed=0;resetPose=true;playUntil=performance.now()+12000;$('play').textContent='Pause';$('status').textContent='Inspecting authored start, gait, stop, turn, guard, strike, block and order transitions.';requestFrame();};
$('sample').onclick=()=>{if(!actor)return;stop('new sample');frameCosts=[];frameIntervals=[];sampleResult=null;previous=0;sampling={warmup:12};$('sample').disabled=true;$('status').textContent='Measuring 120 actual frames after 12 warm-up frames; no FPS/GPU inference.';sampleTimer=setTimeout(()=>stop('30-second deadline'),30000);requestFrame();};
$('dispose').onclick=()=>{stop('actor disposed');generation++;actor?.dispose();if(actor)disposedActors++;actor=null;resourceStats=null;renderer.renderLists.dispose();renderer.render(scene,camera);$('status').textContent='Actor disposed. The floor, lighting and reusable imported master remain.';report();};
$('reload').onclick=replaceActor;
$('download').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report(),null,2)],{type:'application/json'})),anchor=document.createElement('a');anchor.href=url;anchor.download=`imperium-character-${selection.id}-${$('view').value}-${$('lighting').value}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),0);};
window.addEventListener('resize',()=>{stop('resize');requestFrame();});document.addEventListener('visibilitychange',()=>{if(document.hidden){stop('hidden');if(raf)cancelAnimationFrame(raf);raf=0;}else requestFrame();});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();stop('WebGL context lost');error('WebGL context lost. Reload this diagnostic page.');});
window.addEventListener('pagehide',()=>{disposed=true;generation++;clearTimeout(sampleTimer);if(raf)cancelAnimationFrame(raf);actor?.dispose();disposeLighting();floor?.geometry.dispose();floor?.material.dispose();renderer?.dispose();});
for(const control of document.querySelectorAll('button,select,input'))control.disabled=true;
try{
  renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(dpr);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  scene=new T.Scene();camera=new T.PerspectiveCamera(32,1,.01,80);floor=new T.Mesh(new T.CircleGeometry(8,64),new T.MeshStandardMaterial({color:'#8f9491',roughness:.98}));floor.rotation.x=-Math.PI/2;floor.position.y=-.005;floor.receiveShadow=true;scene.add(floor);
  const began=performance.now();await timeout(Promise.all([warmActorAssets(selectedIdentity()),warmActorMaterials().then(()=>warmPremiumActorMaterials())]),15000);loadMs=performance.now()-began;await replaceActor();
}catch(cause){error(cause.stack??cause.message);report();}
finally{for(const control of document.querySelectorAll('button,select,input'))control.disabled=false;}

import * as T from '../vendor/three/three.module.js';
import {createActor,actorKit} from '../src/showcase/actors.js';
import {actorIdentity} from '../src/showcase/actor-identity.js';
import {warmActorAssets,actorAssetStatus} from '../src/showcase/actor-assets.js';
import {warmActorMaterials,actorMaterialStatus} from '../src/showcase/actor-materials.js';
import {getSceneProfile} from '../src/showcase/campaign-scene-profile.js';
import {createSceneLighting} from '../src/showcase/scene-lighting.js';
import {ACTOR_CASES,ACTOR_MOTIONS,actorCase,actorResources,sampleSummary} from './actor-model-cases.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),errors=[];
let renderer,scene,camera,actor=null,lighting=null,lightGroup=null,floor=null,selection=actorCase(params.get('actor')),generation=0,disposed=false,raf=0,previous=0,elapsed=0,playUntil=0,sampling=null,resetPose=true,resourceStats=null;
let disposedActors=0,createdActors=0,loadMs=0,profile=null,frameCosts=[],frameIntervals=[],sampleResult=null,sampleTimer=0;
const canvas=$('canvas');
function error(message){errors.push(String(message));if(errors.length>12)errors.shift();$('errors').textContent=errors.join('\n');$('status').textContent='Diagnostic error â€” see the report below.';}
window.addEventListener('error',event=>error(event.message));window.addEventListener('unhandledrejection',event=>error(event.reason?.message??event.reason));
$('actor').innerHTML=ACTOR_CASES.map(item=>`<option value="${item.id}">${item.label}</option>`).join('');
$('motion').innerHTML=ACTOR_MOTIONS.map(motion=>`<option value="${motion}">${motion}</option>`).join('');
for(const id of ['actor','lighting','view','motion','quality']){const value=params.get(id);if(value&&[...$(id).options].some(option=>option.value===value))$(id).value=value;}
for(const [id,min,max]of [['phase',0,1],['yaw',-180,180]])if(params.has(id)&&Number.isFinite(Number(params.get(id))))$(id).value=Math.max(min,Math.min(max,Number(params.get(id))));
const dpr=Math.max(.5,Math.min(2,Number(params.get('dpr'))||devicePixelRatio||1));
const neutral={sky:'#c2c8c9',fog:'#c2c8c9',sun:'#fff2de',ambient:'#e3eaf2',ambientGround:'#a6a49c',sunPosition:[-3,5,4],sunIntensity:2.2,ambientIntensity:1.6,exposure:1.1};
const timeout=(promise,ms)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(`Asset readiness exceeded ${ms/1000} seconds; reload to retry.`)),ms);promise.then(value=>{clearTimeout(timer);resolve(value);},cause=>{clearTimeout(timer);reject(cause);});});

function configuration(){return {actor:selection.id,lighting:$('lighting').value,view:$('view').value,motion:$('motion').value,quality:$('quality').value,phase:Number($('phase').value),yaw:Number($('yaw').value),pixelRatio:dpr,closedEyelids:$('blink').checked};}
const selectedIdentity=()=>actorIdentity(selection.unit,actorKit(selection.unit,selection.options));
function syncUrl(){const query=new URLSearchParams();for(const [key,value]of Object.entries(configuration()))query.set(key==='pixelRatio'?'dpr':key,value);history.replaceState(null,'',`${location.pathname}?${query}`);}
function report(){
  if(!renderer)return;
  const result={scope:'Development inspection of production actor modules; presentation specimens only. No campaign/save mutation, production compositor, battlefield or GPU timing.',url:location.href,selection:selection.label,configuration:configuration(),profile:profile?.title??$('lighting').value,asset:actorAssetStatus(selectedIdentity()),materials:actorMaterialStatus(),actor:actor?.group.userData.actor??null,resources:resourceStats,renderer:{drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs?.length??0,scope:'Whole inspection frame, including floor and shadow passes. Counts are not the campaign frame cost.'},viewport:{width:canvas.clientWidth,height:canvas.clientHeight,drawingWidth:canvas.width,drawingHeight:canvas.height,devicePixelRatio},samples:{synchronousUpdateAndRenderMs:sampleSummary(frameCosts),rafIntervalMs:sampleSummary(frameIntervals),status:sampling?'running':'idle',result:sampleResult,scope:'At most 120 actual desktop-browser frames. CPU submission duration and RAF spacing are not GPU time or a physical-phone claim.'},lifecycle:{createdActors,disposedActors,liveActors:actor?1:0,initialLoadMs:loadMs},errors:[...errors]};
  $('report').textContent=JSON.stringify(result,null,2);return result;
}
function resize(){const {width,height}=canvas.getBoundingClientRect();if(width<1||height<1)return;const w=Math.round(width),h=Math.round(height);if(canvas.width!==Math.floor(w*dpr)||canvas.height!==Math.floor(h*dpr))renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function frameCamera(){
  if(!actor)return;actor.group.updateMatrixWorld(true);
  if($('view').value==='head'){
    const head=actor.group.getObjectByName('head'),target=head?head.getWorldPosition(new T.Vector3()):new T.Vector3(0,1.55,0);target.y+=.07;
    const distance=.85/Math.min(1,camera.aspect);camera.position.set(0,target.y+.025,distance);camera.lookAt(target);
  }else{
    const height=Math.max(1.8,actor.group.userData.actor.height??1.85),target=new T.Vector3(0,height*.49,0),distance=height*.66/Math.tan(camera.fov*Math.PI/360)/Math.min(1,camera.aspect);
    camera.position.set(0,height*.59,distance);camera.lookAt(target);
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
  playUntil=0;previous=0;clearTimeout(sampleTimer);if(sampling){sampling=null;sampleResult={completed:false,reason,frames:frameCosts.length};$('status').textContent=`Measurement interrupted: ${reason}. ${frameCosts.length}/120 frames retained.`;report();}
  $('play').textContent='Play 12 seconds';$('sample').disabled=false;
}
function clearSamples(){frameCosts=[];frameIntervals=[];sampleResult=null;}
function requestFrame(){if(!disposed&&!raf&&!document.hidden)raf=requestAnimationFrame(draw);}
function draw(ms){
  raf=0;if(disposed||document.hidden||!actor)return;
  try{
    const moving=playUntil>ms||!!sampling,delta=previous?Math.max(0,Math.min(.05,(ms-previous)/1000)):0,interval=previous?ms-previous:null;previous=ms;
    if(moving){elapsed+=delta;$('phase').value=(elapsed%1.8)/1.8;}
    const phase=Number($('phase').value),started=performance.now();resize();
    actor.update({motion:$('motion').value,time:$('blink').checked?4.58-(actorKit(selection.unit,selection.options).identity%13)*.13:elapsed,phase,direction:Number($('yaw').value)*Math.PI/180,dt:moving?delta:0,resetPose,groundHeight:()=>0,detailDistance:2,active:true});resetPose=false;
    frameCamera();renderer.render(scene,camera);const cost=performance.now()-started;
    $('phase-label').textContent=`${Math.round(phase*100)}%`;$('yaw-label').textContent=`${$('yaw').value}Â°`;$('caption').textContent=`${selection.label} Â· ${$('lighting').selectedOptions[0].textContent} Â· ${$('motion').value} ${Math.round(phase*100)}%`;
    if(sampling&&sampling.warmup--<=0){frameCosts.push(cost);if(interval!==null)frameIntervals.push(interval);if(frameCosts.length>=120){sampling=null;clearTimeout(sampleTimer);playUntil=0;sampleResult={completed:true,frames:120};$('sample').disabled=false;$('play').textContent='Play 12 seconds';$('status').textContent='Completed 120 actual render samples. See scope and timings below.';resourceStats=actorResources(actor.group);report();}}
    if(!moving||!sampling&&playUntil<=ms){$('play').textContent='Play 12 seconds';resourceStats=actorResources(actor.group);report();}else if(frameCosts.length&&frameCosts.length%30===0)report();
    if(playUntil>ms||sampling)requestFrame();
  }catch(cause){stop('render failure');error(cause.stack??cause.message);report();}
}
async function replaceActor(){
  if(!renderer)return;stop('selection changed');const ticket=++generation;actor?.dispose();if(actor)disposedActors++;actor=null;resourceStats=null;frameCosts=[];frameIntervals=[];sampleResult=null;renderer.renderLists.dispose();selection=actorCase($('actor').value);$('status').textContent=`Preparing ${selection.label}â€¦`;
  const candidate=createActor(selection.unit,{...selection.options,quality:$('quality').value});createdActors++;
  try{await timeout(candidate.ready,15000);if(disposed||ticket!==generation){candidate.dispose();disposedActors++;return;}actor=candidate;scene.add(actor.group);elapsed=Number($('phase').value)*1.8;resetPose=true;setLighting();resourceStats=actorResources(actor.group);syncUrl();$('status').textContent=`Ready: ${selection.label}. Choose a pose or play a bounded 12-second loop.`;requestFrame();}
  catch(cause){candidate.dispose();disposedActors++;if(actor===candidate)actor=null;error(cause.stack??cause.message);report();}
}
function manualPose(){stop('manual pose');clearSamples();resetPose=true;elapsed=Number($('phase').value)*1.8;syncUrl();requestFrame();}
for(const id of ['actor','quality'])$(id).addEventListener('change',replaceActor);
$('lighting').addEventListener('change',()=>{stop('lighting changed');clearSamples();setLighting();syncUrl();requestFrame();});
for(const id of ['view','motion'])$(id).addEventListener('change',manualPose);
for(const id of ['phase','yaw'])$(id).addEventListener('input',manualPose);
$('blink').addEventListener('change',manualPose);
$('rotate').onclick=()=>{$('yaw').value=(Number($('yaw').value)+225)%360-180;manualPose();};
$('play').onclick=()=>{if(playUntil>performance.now()){stop();requestFrame();return;}if(!actor)return;previous=0;playUntil=performance.now()+12000;$('play').textContent='Pause';$('status').textContent='Playing a maximum of 12 seconds; hidden tabs stop immediately.';requestFrame();};
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
  const began=performance.now();await timeout(Promise.all([warmActorAssets(selectedIdentity()),warmActorMaterials()]),15000);loadMs=performance.now()-began;await replaceActor();
}catch(cause){error(cause.stack??cause.message);report();}
finally{for(const control of document.querySelectorAll('button,select,input'))control.disabled=false;}

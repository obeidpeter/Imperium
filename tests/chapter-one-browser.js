import * as Game from '../src/core/game.js';
import {ARRIVAL,createShowcaseSession} from '../src/showcase/session.js';
import {createBattleStageController} from '../src/ui/battle-stage-controller.js';
import {createBattleSound} from '../src/showcase/battle-sound.js';
import {drawBattle} from '../src/ui/renderer.js';

const host=document.querySelector('#stage-host'),status=document.querySelector('#status'),output=document.querySelector('#result');
const buttons=['lifecycle','audio','measure'].map(id=>document.getElementById(id));
let controller=null,audio=null,runToken=0,busy=false;
const report={scope:'Local browser QA; production modules and legally reached Chapter I states. No saved campaign is read or written.',results:{}};
const write=()=>{output.textContent=JSON.stringify(report,null,2);};
const ensure=(condition,message)=>{if(!condition)throw new Error(message);};
const stats=values=>{const sorted=[...values].sort((a,b)=>a-b);return {count:sorted.length,medianMs:sorted.length?sorted[Math.floor(sorted.length/2)]:null,p95Ms:sorted.length?sorted[Math.ceil(sorted.length*.95)-1]:null,maxMs:sorted.at(-1)??null};};
const viewport=()=>({width:innerWidth,height:innerHeight,devicePixelRatio,expected1440x1000:innerWidth===1440&&innerHeight===1000});
const options=(state,extra={})=>({encounter:state.encounter,selected:'hero',targets:[],target:null,grid:false,quality:'balanced',reducedMotion:false,audio:false,audioVolume:.3,paused:false,...extra});
function board(){host.replaceChildren();delete host.dataset.ready;delete host.dataset.fallback;const canvas=document.createElement('canvas');canvas.tabIndex=0;canvas.setAttribute('aria-label','Chapter I verification battlefield');host.append(canvas);return canvas;}
function release(){controller?.release();controller=null;audio?.dispose();audio=null;}
function active(token){ensure(token===runToken,'Check cancelled.');ensure(!document.hidden,'Check interrupted because the page became hidden.');}
async function until(predicate,token,timeout=5000){const start=performance.now();while(!predicate()){active(token);ensure(performance.now()-start<timeout,'Timed out waiting for the real renderer.');await new Promise(requestAnimationFrame);}active(token);}
async function checksum(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');}
function drill(){const state=Game.newGame('Aurelius Marcellus',275);for(const [method,arg] of ARRIVAL.slice(0,2)){const result=Game[method](state,arg);ensure(result.ok,`${method}: ${result.message}`);}ensure(state.encounter.id==='ch1-training','Expected a legally reached drill.');return state;}
function move(state){const target=Game.getTargets(state,'hero','move')[0];ensure(target,'A legal move must exist.');const before=structuredClone(state.encounter),command={unitId:'hero',action:'move',x:target.x,y:target.y};const result=Game.act(state,command);ensure(result.ok,result.message);return {before,after:structuredClone(state.encounter),command};}
async function mount(state,token,extra={}){controller=createBattleStageController({onError:error=>{report.lastStageError=String(error);}});controller.mount(board(),options(state,extra));await until(()=>controller?.stage,token);return controller.stage;}
async function lifecycle(token){
  const checks=[],check=(name,pass,detail)=>{checks.push({name,pass,...(detail===undefined?{}:{detail})});write();ensure(pass,name);};
  const result=report.results.lifecycle={status:'running',viewport:viewport(),checks};write();
  const road=createShowcaseSession(),drillState=drill();result.legalScenes=[drillState.encounter.id,road.encounter.id];
  let resolveModule;const pending=new Promise(resolve=>{resolveModule=resolve;});
  const delayed=createBattleStageController({load:()=>pending});
  delayed.mount(board(),options(road));delayed.release();
  resolveModule(await import('../src/showcase/stage.js'));await new Promise(requestAnimationFrame);
  check('Released pending import cannot construct a renderer',delayed.stage===null&&host.querySelectorAll('.world-labels').length===0);
  const stage=await mount(road,token);check('Actual WebGL renderer initialized',stage.renderer.getContext().isContextLost()===false);
  const original=stage.canvas;controller.mount(board(),options(road));
  check('Rerender retains one canvas and one label layer',controller.stage===stage&&stage.canvas===original&&host.querySelectorAll('canvas').length===1&&host.querySelectorAll('.world-labels').length===1&&host.dataset.ready==='true');
  const motion=move(road),saved=Game.serialize(road),playing=stage.play(motion.before,motion.after,motion.command);
  check('Legal road movement produces an actual animation',Boolean(stage.animation));
  await until(()=>!stage.animation,token,6500);await playing;
  check('Finishing movement preserves the committed serialized campaign',Game.serialize(road)===saved);result.roadSaveSHA256=await checksum(saved);
  stage.setPaused(true);const pausedPlay=stage.play(motion.before,motion.after,motion.command);
  check('Playing while paused does not queue an animation',!stage.animation);await pausedPlay;stage.setPaused(false);
  stage.play(motion.before,motion.after,motion.command);stage.finishMotion();
  check('Cancelling movement preserves the committed serialized campaign',stage.animation===null&&Game.serialize(road)===saved);
  release();const training=await mount(drillState,token);const legalDrill=ARRIVAL[2][1],before=structuredClone(drillState.encounter);
  ensure(Game.act(drillState,legalDrill).ok,'The actual ARRIVAL drill move must remain legal.');const drillSave=Game.serialize(drillState);
  training.setReducedMotion(true);await training.play(before,structuredClone(drillState.encounter),legalDrill);
  check('Drill reduced motion commits instantly without rewriting the save',!training.animation&&Game.serialize(drillState)===drillSave);result.drillSaveSHA256=await checksum(drillSave);
  const extension=training.renderer.getContext().getExtension('WEBGL_lose_context');
  if(extension){
    const errors=[];release();controller=createBattleStageController({onError:error=>{errors.push(String(error));const c=board();drawBattle(c,drillState.encounter,'hero',[],null,1,{quality:'performance',maxPixelRatio:1});host.dataset.fallback='2d';}});
    controller.mount(board(),options(drillState));await until(()=>controller?.stage,token);const lost=controller.stage;
    const lose=lost.renderer.getContext().getExtension('WEBGL_lose_context');ensure(lose,'Context-loss extension changed availability.');lose.loseContext();
    await until(()=>errors.length>0,token);
    check('Actual context loss releases WebGL and invokes the 2D fallback path',controller.stage===null&&lost.disposed&&host.dataset.fallback==='2d'&&host.querySelectorAll('canvas').length===1&&host.querySelectorAll('.world-labels').length===0,errors[0]);
    result.contextLoss='verified through the production controller error callback; fallback is drawn by the production 2D renderer';
  }else result.contextLoss='unsupported: browser does not expose WEBGL_lose_context; no synthetic context-loss claim';
  result.status=checks.every(item=>item.pass)?'passed':'failed';write();
}
async function audioCheck(){
  // This function is called directly by the labelled button's click handler;
  // context resume happens before the first await and inside that user gesture.
  const sound=audio=createBattleSound();sound.setEnabled(true,.3);const unlocked=await sound.unlock();
  const accepted=sound.cue('shield',{intensity:.35}),result=report.results.audio={status:unlocked&&accepted?'passed':'unavailable',explicitUserGesture:true,unlocked,cueAccepted:accepted,listeningAssessment:'Not performed; API acceptance only.'};
  await new Promise(resolve=>setTimeout(resolve,450));
  sound.setEnabled(false,.3);result.disabledCueRejected=!sound.cue('impact');sound.dispose();if(audio===sound)audio=null;write();
}
async function measure(token){
  const result=report.results.measurement={status:'running',viewport:viewport(),measurement:'120 actual stage render callbacks per profile after 18 warm-up callbacks. CPU render duration and browser RAF intervals are separate; neither is reported as GPU time or synthetic FPS.',profiles:[]};write();
  for(const quality of ['balanced','high','performance']){
    active(token);release();status.textContent=`Measuring ${quality}: 18 warm-up frames, then 120 rendered frames…`;
    const state=createShowcaseSession(),costs=[],renderTimes=[],rafIntervals=[];let warm=0,record=false,raf=0,previousRAF=null;
    const stage=await mount(state,token,{quality,onFrame:cost=>{if(!record){warm++;return;}if(costs.length<120){costs.push(cost);renderTimes.push(performance.now());}}});
    await until(()=>warm>=18,token,10000);const motion=move(state),saved=Game.serialize(state),started=performance.now();record=true;
    const sampleRAF=now=>{if(previousRAF!==null)rafIntervals.push(now-previousRAF);previousRAF=now;raf=requestAnimationFrame(sampleRAF);};raf=requestAnimationFrame(sampleRAF);
    try{stage.play(motion.before,motion.after,motion.command);await until(()=>costs.length===120,token,20000);}finally{cancelAnimationFrame(raf);record=false;}
    const rect=stage.canvas.getBoundingClientRect();
    result.profiles.push({quality,scene:state.encounter.id,activity:'One legal hero move followed by idle scene',warmupFrames:warm,renderFrames:costs.length,elapsedMs:performance.now()-started,canvas:{cssWidth:rect.width,cssHeight:rect.height,pixelWidth:stage.canvas.width,pixelHeight:stage.canvas.height},cpuRender:stats(costs),stageRenderIntervals:stats(renderTimes.slice(1).map((time,i)=>time-renderTimes[i])),browserRAFIntervals:stats(rafIntervals),renderer:stage.stats(),saveUnchanged:Game.serialize(state)===saved,saveSHA256:await checksum(saved)});write();
  }
  result.status=result.profiles.every(p=>p.renderFrames===120&&p.saveUnchanged)?'passed':'failed';release();write();
}
async function run(name,fn){if(busy)return;busy=true;const token=++runToken;release();buttons.forEach(b=>b.disabled=true);status.textContent=`Running ${name}…`;report.startedAt=new Date().toISOString();report.browser=navigator.userAgent;write();
  try{await fn(token);active(token);status.textContent=`${name} complete. See JSON for measured results and unsupported checks.`;}
  catch(error){report.results[name]={...(report.results[name]||{}),status:'failed',error:error.message};status.textContent=`${name}: ${error.message}`;}
  finally{release();busy=false;buttons.forEach(b=>b.disabled=false);write();}
}
document.getElementById('lifecycle').addEventListener('click',()=>run('lifecycle',lifecycle));
document.getElementById('audio').addEventListener('click',()=>run('audio',audioCheck));
document.getElementById('measure').addEventListener('click',()=>run('measurement',measure));
document.getElementById('stop').addEventListener('click',()=>{runToken++;release();status.textContent='Stopped. Renderer and sound released.';});
document.addEventListener('visibilitychange',()=>{if(document.hidden){runToken++;release();}});
window.addEventListener('pagehide',release);

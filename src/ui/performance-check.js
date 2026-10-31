// Settings → Rendering measurements → Performance check. On the player's own
// device it rebuilds the current 3D battle at each quality tier, measures the
// build, then a fixed camera tour (overview, follow, horizon) with the camera
// always turning, and returns plain JSON for the player to save and share.
// Nothing is sent anywhere. Presentation only: the encounter, the rules and
// the random generator are never touched, the page takes no game input while
// it runs, and the player's own quality and resolution setting are restored.
import {isQuietStage} from '../showcase/frame-budget.js';

export const PERFORMANCE_CHECK_TOOL='imperium-performance-check';
export const PERFORMANCE_CHECK_VERSION=3;
export const CHECK_TIERS=Object.freeze(['performance','balanced','high']);
export const TIER_FPS=Object.freeze({performance:30,balanced:60,high:60});
// Each view of the tour and how long it turns (one full turn every 12 s).
export const CHECK_TOUR=Object.freeze([['home',5000],['focusSelected',3000],['horizon',3000]]);
const TURN_MS=12000,LONG_TASK_LIMIT_MS=100,WARMUP_FRAMES=36,WARMUP_MS=20000,FRAME_WAIT_MS=30000;

const round=n=>Number.isFinite(n)?Math.round(n*10)/10:null;
export function percentile(list,p){
  const sorted=list.filter(Number.isFinite).sort((a,b)=>a-b);if(!sorted.length)return null;
  return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*p)-1))];
}
const spread=list=>({p50:round(percentile(list,.5)),p95:round(percentile(list,.95)),max:round(list.length?Math.max(...list):null)});
// frames: [time, cpuMs, intervalMs] as the stage logs them.
export function summarizeFrames(frames,{fps=60,from=-Infinity,to=Infinity}={}){
  const window=frames.filter(([time])=>time>=from&&time<to),intervals=window.map(f=>f[2]).filter(ms=>Number.isFinite(ms)&&ms>0);
  const p50=percentile(intervals,.5),target=1000/fps;
  return {frames:window.length,intervalMs:spread(intervals),cpuMs:spread(window.map(f=>f[1]).filter(Number.isFinite)),
    fps:p50?round(1000/p50):null,slowFrames:intervals.filter(ms=>ms>target*1.5).length};
}
export const longTaskSummary=(entries,{from=-Infinity,to=Infinity}={})=>{
  const list=entries.filter(([start])=>start>=from&&start<to).map(([,duration])=>duration);
  return {count:list.length,maxMs:round(list.length?Math.max(...list):0)};
};
// A tier meets its target when the turning camera's 95th-percentile frame
// interval stays within a quarter of the target and nothing froze for long.
export function meetsTarget(tour,{fps,longTaskMaxMs=0}){
  return tour.frames>=10&&Number.isFinite(tour.intervalMs.p95)&&tour.intervalMs.p95<=1000/fps*1.25&&longTaskMaxMs<=LONG_TASK_LIMIT_MS;
}
export const recommendTier=results=>[...CHECK_TIERS].reverse().find(tier=>results.some(r=>r.tier===tier&&r.meetsTarget))??'performance';
// The player's own tier last, so the check ends where it began and every tier is a fresh build.
export const checkOrder=current=>[...CHECK_TIERS.filter(tier=>tier!==current),...(CHECK_TIERS.includes(current)?[current]:[])];

export function createLongTaskLog(Observer=globalThis.PerformanceObserver){
  const entries=[];let observer=null;
  try{if(Observer?.supportedEntryTypes?.includes('longtask')){observer=new Observer(list=>{for(const e of list.getEntries())entries.push([e.startTime,e.duration]);});observer.observe({type:'longtask'});}}catch{observer=null;}
  return {entries,supported:!!observer,dispose(){observer?.disconnect();}};
}

// While the check runs a status band covers the page. Keys are held back
// before the board sees them: Escape cancels, and Enter or Space still press
// Cancel, which stops the check after its current step.
export function createCheckBand({document:doc=globalThis.document,window:win=globalThis.window}={}){
  const band=doc.createElement('div'),status=doc.createElement('p'),cancel=doc.createElement('button');
  band.className='performance-check';
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='Preparing the performance check…';
  cancel.setAttribute('type','button');cancel.textContent='Cancel check';band.append(status,cancel);
  const check={cancelled:false,show(text){status.textContent=text;},close(){win.removeEventListener('keydown',keys,{capture:true});band.remove();}};
  const keys=event=>{
    if(event.target===cancel&&['Enter',' '].includes(event.key))return;
    event.stopImmediatePropagation();event.preventDefault();if(event.key==='Escape')check.cancelled=true;
  };
  cancel.addEventListener('click',()=>{check.cancelled=true;status.textContent='Stopping after this step…';});
  win.addEventListener('keydown',keys,{capture:true});doc.body.append(band);cancel.focus();
  return check;
}

function browserFacts(win=globalThis){
  const nav=win.navigator??{},data=nav.userAgentData;
  return {userAgent:data?{brands:(data.brands??[]).map(b=>`${b.brand} ${b.version}`),mobile:!!data.mobile,platform:data.platform??null}:nav.userAgent??null,
    hardwareConcurrency:nav.hardwareConcurrency??null,deviceMemoryGb:nav.deviceMemory??null,devicePixelRatio:win.devicePixelRatio??null,
    viewport:{width:win.innerWidth??null,height:win.innerHeight??null},screen:{width:win.screen?.width??null,height:win.screen?.height??null}};
}

// The real-time simulation's tick on this device (0.40, build brief §2.8),
// stepped headless: nothing is drawn and the encounter is not involved.
async function simulationTiming(now){const {measureTicks}=await import('../core/realtime/benchmark-worlds.js');return measureTicks({now});}
function visibilityWatch(listener){const doc=globalThis.document;doc?.addEventListener('visibilitychange',listener);return ()=>doc?.removeEventListener('visibilitychange',listener);}

/** Runs the check on the controller's live stage. Resolves to the report;
 * rejects only if there is no 3D battle to measure or the battle goes away. */
export async function runPerformanceCheck(controller,{current='balanced',adaptive=true,app={},onProgress=()=>{},isCancelled=()=>false,
  now=()=>performance.now(),nextFrame=()=>new Promise(done=>requestAnimationFrame(done)),longTasks=createLongTaskLog(),facts=browserFacts,
  simulation=simulationTiming,isVisible=()=>globalThis.document?.visibilityState!=='hidden',watchVisibility=visibilityWatch,steadyFrames=240}={}){
  const first=controller.stage;if(!first)throw Error('Open a 3D battle, then run the check.');
  const order=checkOrder(current),results=[];let cancelled=false,interrupted=false,interruptionReason=null;
  const interruption=new Error('Measurement interrupted');let stop;
  const stopped=new Promise(resolve=>{stop=resolve;}),interrupt=reason=>{if(!interrupted)interruptionReason=reason;interrupted=true;stop();};
  const unwatch=watchVisibility(()=>{if(!isVisible())interrupt('hidden');});
  // A hidden page can suspend rAF entirely. Latch its visibility event and
  // wake the pending measurement, even if it becomes visible before a frame.
  const active=async(promise,{timeout=120000,reason='build-timeout'}={})=>{
    if(!isVisible())interrupt('hidden');let timer;
    try{await Promise.race([promise,stopped.then(()=>{throw interruption;}),new Promise((_,reject)=>{timer=setTimeout(()=>{interrupt(reason);reject(interruption);},timeout);})]);}
    finally{clearTimeout(timer);}
    if(!isVisible())interrupt('hidden');if(interrupted)throw interruption;
  };
  const next=()=>active(nextFrame(),{timeout:FRAME_WAIT_MS,reason:'frame-timeout'});
  const live=own=>{if(controller.stage!==own)throw Error('The battle changed during the check.');};
  const warm=async({settleCamera=false}={})=>{
    const from=now();let frames=0;
    // Slow software rendering must not turn 36 frames into several minutes.
    // Stop requesting frames at the deadline; an in-flight frame can finish
    // later, so record elapsed time and never qualify an over-budget warm-up.
    while((frames<WARMUP_FRAMES||settleCamera&&first.cameraSettled!==true)&&now()-from<WARMUP_MS&&!isCancelled()){await next();live(first);frames++;}
    const elapsedMs=now()-from;
    return {frames,targetFrames:WARMUP_FRAMES,limitMs:WARMUP_MS,elapsedMs:round(elapsedMs),
      ...(settleCamera?{cameraSettled:first.cameraSettled===true}:{}),complete:frames>=WARMUP_FRAMES&&elapsedMs<=WARMUP_MS&&(!settleCamera||first.cameraSettled===true)};
  };
  controller.adaptive(false);
  try{
    for(const [index,tier]of order.entries()){
      if(isCancelled()){cancelled=true;break;}
      onProgress({tier,index,total:order.length,step:'build'});
      const before=controller.stage;live(first);const rebuilt=(before.worldQuality??before.quality)!==tier,started=now();
      controller.quality(tier,{world:true});await active(before.ready);live(first);const built=now();
      onProgress({tier,index,total:order.length,step:'tour'});
      // Shader/asset readiness does not guarantee the first painted frames
      // have settled. Keep these warm-up frames out of the measurements.
      const warmup={tour:await warm()};
      const log=before.startFrameLog(),views={},steady=[];
      try{
        for(const [view,ms]of CHECK_TOUR){
          before[view]?.();const from=now();let last=from;
          while(now()-from<ms&&!isCancelled()){await next();live(first);const t=now();before.orbit.yaw+=(t-last)/TURN_MS*Math.PI*2;last=t;}
          views[view]={from,to:now()};if(isCancelled())break;
        }
        if(tier===current&&!isCancelled()){
          before.home?.();warmup.steady=await warm({settleCamera:true});
          onProgress({tier,index,total:order.length,step:'steady'});
          // Two disjoint windows at the chosen quality, bounded even on a
          // software renderer. Incomplete windows never claim a target pass.
          for(let repeat=0;repeat<2&&!isCancelled();repeat++){
            const from=now(),offset=log.frames.length,quiet=isQuietStage(before,from),fps=quiet?Math.min(30,TIER_FPS[tier]):TIER_FPS[tier];
            let cameraSettled=before.cameraSettled===true,cadenceStable=true;
            while(log.frames.length-offset<steadyFrames&&now()-from<20000&&!isCancelled()){
              await next();live(first);cameraSettled&&=before.cameraSettled===true;cadenceStable&&=isQuietStage(before,now())===quiet;
            }
            const frames=log.frames.slice(offset,offset+steadyFrames),summary=summarizeFrames(frames,{fps}),to=now();
            steady.push({...summary,targetFps:fps,cadence:quiet?'quiet':'active',cameraSettled,cadenceStable,complete:frames.length===steadyFrames&&to-from<=20000,from,to});
          }
        }
      }finally{before.stopFrameLog();before.home?.();}
      if(isCancelled()){cancelled=true;break;}
      const fps=TIER_FPS[tier],from=views.home.from,to=Math.max(...Object.values(views).map(v=>v.to)),stats=before.stats();
      const tour={...summarizeFrames(log.frames,{fps,from,to}),gpuMs:spread(log.gpu),longTasks:longTasks.supported?longTaskSummary(longTasks.entries,{from,to}):null,
        views:Object.fromEntries(Object.entries(views).map(([view,w])=>[view,summarizeFrames(log.frames,{fps,from:w.from,to:w.to})]))};
      results.push({tier,targetFps:fps,rebuilt,buildMs:rebuilt?Math.round(built-started):null,
        buildLongTasks:longTasks.supported?longTaskSummary(longTasks.entries,{from:started,to:built}):null,
        firstFramePrograms:rebuilt?stats.firstFramePrograms??null:null,tour,
        scene:{calls:stats.calls,triangles:stats.triangles,programs:before.renderer?.info.programs?.length??null,textures:stats.textures,geometries:stats.geometries},
        warmup,steady,meetsTarget:!interrupted&&Object.values(warmup).every(window=>window.complete)&&meetsTarget(tour,{fps,longTaskMaxMs:tour.longTasks?.maxMs??0})&&steady.every(window=>window.complete&&window.cameraSettled&&window.cadenceStable&&meetsTarget(window,{fps:window.targetFps}))});
    }
  }catch(error){if(error!==interruption)throw error;}finally{
    unwatch?.();
    longTasks.dispose?.();
    if(controller.stage===first&&(first.worldQuality??first.quality)!==current)controller.quality(current,{world:true});
    controller.adaptive(adaptive);
  }
  cancelled=cancelled||isCancelled();
  let ticks=null;
  if(!cancelled&&!interrupted){onProgress({step:'simulation',index:order.length,total:order.length});try{ticks=await simulation(now);}catch{ticks=null;}}
  cancelled=cancelled||isCancelled();
  const device=first.deviceReport??{};
  const complete=!cancelled&&results.length===order.length;
  const knownRenderer=device.identity==='unmasked'&&!!device.renderer&&!/unknown|unavailable|webkit/i.test(device.renderer);
  const recommendationStatus=!complete||interrupted?'incomplete':device.software?'software':!knownRenderer?'unknown-renderer':results.some(r=>r.meetsTarget)?'measured':'below-target';
  return {tool:PERFORMANCE_CHECK_TOOL,version:PERFORMANCE_CHECK_VERSION,app,measuredAt:new Date().toISOString(),complete:!cancelled&&results.length===order.length,
    battle:{encounter:first.encounter?.id??null,chapter:first.chapter??null,figureStyle:first.figureStyle??null,units:first.encounter?.units?.length??null},
    device:{...device,...facts()},features:{parallelShaderCompile:!!first.renderer?.extensions?.has?.('KHR_parallel_shader_compile'),gpuTimer:!!first.gpuTimer?.stats?.().supported,longTasks:!!longTasks.supported},
    method:'Each tier is rebuilt and warmed for 36 display frames, stopping requests after 20 seconds, then the camera turns through overview (5 s), follow (3 s) and horizon (3 s). An in-flight frame may finish after the warm-up deadline; elapsed time and completion are recorded, and incomplete warm-ups cannot qualify a tier. Individual frame waits stop the check after 30 seconds; build waits stop after 120 seconds. Before the chosen quality’s two separate 240-rendered-frame windows, warm-up also waits for the camera to settle, within the same 20-second limit. Each window is bounded to 20 seconds and records its intended cadence: quiet non-live scenes target 30 fps, while live or active scenes retain the quality target. Moving-camera tours retain the quality target. Incomplete windows, camera movement or a cadence change cannot pass. Adaptive resolution is off. A tier meets its target when the 95th-percentile frame interval is within 125% of 1000/fps and no tour task blocks for more than 100 ms. Hidden-page measurements are marked interrupted. Software rendering is not device-performance evidence. The real-time simulation then times a 15-man, 82-man and six-squad fight against a 4 ms tick budget.',
    tiers:results,recommendation:recommendTier(results),recommendationStatus,cancelled,interrupted,interruptionReason,simulation:ticks};
}

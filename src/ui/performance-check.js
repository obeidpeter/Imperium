// Settings → Rendering measurements → Performance check. On the player's own
// device it rebuilds the current 3D battle at each quality tier, measures the
// build, then a fixed camera tour (overview, follow, horizon) with the camera
// always turning, and returns plain JSON for the player to save and share.
// Nothing is sent anywhere. Presentation only: the encounter, the rules and
// the random generator are never touched, the page takes no game input while
// it runs, and the player's own quality and resolution setting are restored.
export const PERFORMANCE_CHECK_TOOL='imperium-performance-check';
export const PERFORMANCE_CHECK_VERSION=2;
export const CHECK_TIERS=Object.freeze(['performance','balanced','high']);
export const TIER_FPS=Object.freeze({performance:30,balanced:60,high:60});
// Each view of the tour and how long it turns (one full turn every 12 s).
export const CHECK_TOUR=Object.freeze([['home',5000],['focusSelected',3000],['horizon',3000]]);
const TURN_MS=12000,LONG_TASK_LIMIT_MS=100;

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

/** Runs the check on the controller's live stage. Resolves to the report;
 * rejects only if there is no 3D battle to measure or the battle goes away. */
export async function runPerformanceCheck(controller,{current='balanced',adaptive=true,app={},onProgress=()=>{},isCancelled=()=>false,
  now=()=>performance.now(),nextFrame=()=>new Promise(done=>requestAnimationFrame(done)),longTasks=createLongTaskLog(),facts=browserFacts,
  simulation=simulationTiming}={}){
  const first=controller.stage;if(!first)throw Error('Open a 3D battle, then run the check.');
  const order=checkOrder(current),results=[];let cancelled=false;
  const live=own=>{if(controller.stage!==own)throw Error('The battle changed during the check.');};
  controller.adaptive(false);
  try{
    for(const [index,tier]of order.entries()){
      if(isCancelled()){cancelled=true;break;}
      onProgress({tier,index,total:order.length,step:'build'});
      const before=controller.stage;live(first);const rebuilt=(before.worldQuality??before.quality)!==tier,started=now();
      controller.quality(tier,{world:true});await before.ready;live(first);const built=now();
      onProgress({tier,index,total:order.length,step:'tour'});
      const log=before.startFrameLog(),views={};
      try{
        for(const [view,ms]of CHECK_TOUR){
          before[view]?.();const from=now();let last=from;
          while(now()-from<ms&&!isCancelled()){await nextFrame();live(first);const t=now();before.orbit.yaw+=(t-last)/TURN_MS*Math.PI*2;last=t;}
          views[view]={from,to:now()};if(isCancelled())break;
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
        meetsTarget:meetsTarget(tour,{fps,longTaskMaxMs:tour.longTasks?.maxMs??0})});
    }
  }finally{
    longTasks.dispose?.();
    if(controller.stage===first&&(first.worldQuality??first.quality)!==current)controller.quality(current,{world:true});
    controller.adaptive(adaptive);
  }
  let ticks=null;
  if(!cancelled&&!isCancelled()){onProgress({step:'simulation',index:order.length,total:order.length});try{ticks=await simulation(now);}catch{ticks=null;}}
  const device=first.deviceReport??{};
  return {tool:PERFORMANCE_CHECK_TOOL,version:PERFORMANCE_CHECK_VERSION,app,measuredAt:new Date().toISOString(),complete:!cancelled&&results.length===order.length,
    battle:{encounter:first.encounter?.id??null,chapter:first.chapter??null,figureStyle:first.figureStyle??null,units:first.encounter?.units?.length??null},
    device:{...device,...facts()},features:{parallelShaderCompile:!!first.renderer?.extensions?.has?.('KHR_parallel_shader_compile'),gpuTimer:!!first.gpuTimer?.stats?.().supported,longTasks:!!longTasks.supported},
    method:'Each tier is rebuilt behind the veil, then the camera turns through the overview (5 s), follow (3 s) and horizon (3 s) views. Adaptive resolution is off while measuring. A tier meets its target when the 95th-percentile frame interval is within 125% of 1000/fps and no task blocks the page for more than 100 ms. Then the real-time simulation (0.40, in development) steps a 15-man and an 82-man fight and a six-squad battle with the party headless, and its tick times are reported against the 4 ms budget.',
    tiers:results,recommendation:recommendTier(results),simulation:ticks};
}

// Shared by stage drawing and the device check: quiet legacy scenes may draw
// at half rate, but live worlds and moving cameras retain their tier target.
export const QUIET_AFTER_MS=1200;
export const isQuietStage=(stage,now)=>!!(!stage.live&&!stage.animation&&!stage.drag&&!stage.pendingHover&&
  !(stage.discessio&&!stage.discessio.done)&&stage.cameraSettled&&now-(stage.wokeAt??0)>QUIET_AFTER_MS);

// Asynchronous GPU measurements. No gl.finish(), readPixels(), or waiting on a
// query: unavailable/disjoint/context-lost results are simply discarded.
export function createGpuTimer(gl,{warmup=24,every=4,maxPending=4}={}){
  let extension=null,active=null,pending=[],frames=0,disposed=false,measured=0,lastMs=null;
  try{extension=gl?.getExtension?.('EXT_disjoint_timer_query_webgl2');}catch{}
  const remove=query=>{try{gl.deleteQuery(query);}catch{}};
  function clear(){if(active){try{gl.endQuery(extension.TIME_ELAPSED_EXT);}catch{}remove(active);active=null;}pending.forEach(remove);pending=[];}
  function poll(){
    if(disposed||!extension)return [];
    try{
      if(gl.isContextLost?.()||gl.getParameter(extension.GPU_DISJOINT_EXT)){clear();return [];}
      const results=[];
      while(pending.length&&gl.getQueryParameter(pending[0],gl.QUERY_RESULT_AVAILABLE)){
        const query=pending.shift(),ms=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;remove(query);
        if(Number.isFinite(ms)&&ms>=0&&ms<1000){lastMs=ms;measured++;results.push(ms);}
      }
      return results;
    }catch{clear();extension=null;return [];}
  }
  return {
    poll,
    begin(){
      frames++;
      if(disposed||!extension||active||frames<=warmup||frames%every||pending.length>=maxPending)return false;
      try{if(gl.isContextLost?.())return false;active=gl.createQuery();if(!active)return false;gl.beginQuery(extension.TIME_ELAPSED_EXT,active);return true;}catch{clear();extension=null;return false;}
    },
    end(){if(!active)return;try{gl.endQuery(extension.TIME_ELAPSED_EXT);pending.push(active);active=null;}catch{clear();extension=null;}},
    reset(){clear();frames=0;},
    stats(){return {supported:!!extension,measured,lastMs,pending:pending.length,measurement:'GPU elapsed query; excludes CPU simulation and display latency'};},
    dispose(){clear();disposed=true;}
  };
}

// Paint on whole display refreshes. A cap that does not divide the refresh rate
// (45 fps on 60 Hz) alternates one- and two-refresh frames and reads as judder.
export function createFrameCadence({fps=60}={}){
  let target=fps,last=null,count=0,deltas=[],refreshMs=1000/60,painted=0;
  const median=list=>{const sorted=[...list].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
  const every=()=>Math.max(1,Math.round(1000/target/refreshMs));
  return {
    shouldRender(now){
      if(!Number.isFinite(now))return false;
      if(last!==null){const delta=now-last;if(delta>2&&delta<100){deltas.push(delta);if(deltas.length>30)deltas.shift();if(deltas.length>=8)refreshMs=median(deltas);}}
      last=now;count++;if(count<every())return false;count=0;painted++;return true;
    },
    reset(nextFps=target){target=nextFps;count=0;},
    get expectedMs(){return every()*refreshMs;},
    stats(){return {targetFps:target,refreshHz:Math.round(1000/refreshMs),refreshesPerFrame:every(),painted};}
  };
}

// A change needs sustained evidence, then a cooling period. Resolution changes
// affect the WebGL drawing buffer only; DOM text, input and game state stay exact.
// Without a GPU timer, sustained late frames are the only evidence: the scale
// can drop on repeated misses and returns slowly after a long on-time run.
export function createResolutionBudget({fps=45,enabled=true,onChange=()=>{}}={}){
  let scale=1,samples=[],cooldown=0,total=0,changes=0,lastMs=null,intervals=[],onTime=0,intervalTotal=0;
  function reset(nextFps=fps){fps=nextFps;samples=[];intervals=[];onTime=0;cooldown=24;const changed=scale!==1;scale=1;if(changed)onChange(scale);}
  const apply=next=>{if(next===scale)return false;scale=next;samples=[];intervals=[];onTime=0;cooldown=36;changes++;onChange(scale);return true;};
  return {
    record(ms){
      if(!enabled||!Number.isFinite(ms)||ms<0)return false;
      total++;lastMs=ms;if(cooldown>0){cooldown--;return false;}
      samples.push(ms);if(samples.length>36)samples.shift();if(samples.length<24)return false;
      const budget=1000/fps*.82,slow=samples.filter(n=>n>budget).length,fast=samples.filter(n=>n<budget*.55).length;
      return apply(slow>=18?Math.max(.65,Math.round((scale-.1)*100)/100):samples.length===36&&fast>=32?Math.min(1,Math.round((scale+.05)*100)/100):scale);
    },
    recordInterval(ms,expectedMs){
      if(!enabled||!Number.isFinite(ms)||!Number.isFinite(expectedMs)||ms<=0||expectedMs<=0||ms>expectedMs*6)return false;
      intervalTotal++;if(cooldown>0){cooldown--;return false;}
      const late=ms>expectedMs*1.45;intervals.push(late);if(intervals.length>30)intervals.shift();onTime=late?0:onTime+1;
      if(intervals.length===30&&intervals.filter(Boolean).length>=18)return apply(Math.max(.65,Math.round((scale-.1)*100)/100));
      if(scale<1&&onTime>=240)return apply(Math.min(1,Math.round((scale+.05)*100)/100));
      return false;
    },
    reset,
    setEnabled(value){enabled=!!value;reset();},
    stats(){return {enabled,scale,targetFps:fps,acceptedGpuSamples:total,lastGpuMs:lastMs,acceptedFrameIntervals:intervalTotal,changes};},
    get scale(){return scale;}
  };
}

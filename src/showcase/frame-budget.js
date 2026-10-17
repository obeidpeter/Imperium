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

// A change needs sustained evidence, then a cooling period. Resolution changes
// affect the WebGL drawing buffer only; DOM text, input and game state stay exact.
export function createResolutionBudget({fps=45,enabled=true,onChange=()=>{}}={}){
  let scale=1,samples=[],cooldown=0,total=0,changes=0,lastMs=null;
  function reset(nextFps=fps){fps=nextFps;samples=[];cooldown=24;const changed=scale!==1;scale=1;if(changed)onChange(scale);}
  return {
    record(ms){
      if(!enabled||!Number.isFinite(ms)||ms<0)return false;
      total++;lastMs=ms;if(cooldown>0){cooldown--;return false;}
      samples.push(ms);if(samples.length>36)samples.shift();if(samples.length<24)return false;
      const budget=1000/fps*.82,slow=samples.filter(n=>n>budget).length,fast=samples.filter(n=>n<budget*.55).length;
      const next=slow>=18?Math.max(.65,Math.round((scale-.1)*100)/100):samples.length===36&&fast>=32?Math.min(1,Math.round((scale+.05)*100)/100):scale;
      if(next===scale)return false;
      scale=next;samples=[];cooldown=36;changes++;onChange(scale);return true;
    },
    reset,
    setEnabled(value){enabled=!!value;reset();},
    stats(){return {enabled,scale,targetFps:fps,acceptedGpuSamples:total,lastGpuMs:lastMs,changes};},
    get scale(){return scale;}
  };
}

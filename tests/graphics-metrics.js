// Development measurement only. It accepts the actual motion player/draw call,
// separating Canvas submission costs, renderer cadence and browser RAF cadence.
export function measureMotionTrial({play,draw,now=()=>performance.now(),requestFrame=callback=>requestAnimationFrame(callback),cancelFrame=id=>cancelAnimationFrame(id),setTimer=(callback,ms)=>setTimeout(callback,ms),clearTimer=id=>clearTimeout(id),isHidden=()=>document.hidden,timeoutMs=1500}){
  return new Promise((resolve,reject)=>{
    const cpu=[],rafIntervals=[],paintIntervals=[];let lastRaf,lastPaint,observer,timer,stop=()=>{},finished=false,cleanupCpuMs=null,completionEvidence=null;
    const began=now();
    function finish(reason,error){
      if(finished)return;finished=true;
      if(observer!==undefined)cancelFrame(observer);if(timer!==undefined)clearTimer(timer);stop();
      const result={supported:cpu.length>0,reason,completionEvidence,cpu,rafIntervals,paintIntervals,cleanupCpuMs,elapsedMs:now()-began};
      if(error)reject(error);else resolve(result);
    }
    function observe(timestamp){
      if(finished)return;if(isHidden()){finish('hidden',new Error('Tab became hidden during motion measurement.'));return;}
      if(lastRaf!==undefined)rafIntervals.push(timestamp-lastRaf);lastRaf=timestamp;observer=requestFrame(observe);
    }
    observer=requestFrame(observe);
    try{
      stop=play(frame=>{
        if(finished)return;
        if(isHidden()){finish('hidden',new Error('Tab became hidden during motion measurement.'));return;}
        const start=now();
        try{draw(frame);}catch(error){finish('draw-error',error);return;}
        const cost=now()-start;
        // The player's null callback also runs on scroll, resize, replacement
        // and cancellation. Only an actually drawn terminal frame proves a
        // completed trial; elapsed wall time alone cannot establish playback.
        if(frame===null){cleanupCpuMs=cost;finish(completionEvidence?'completed':cpu.length?'interrupted':'unsupported');return;}
        if(lastPaint!==undefined)paintIntervals.push(start-lastPaint);lastPaint=start;cpu.push(cost);
        if(frame?.complete===true)completionEvidence='frame.complete';
        else if(!completionEvidence&&Number.isFinite(frame?.time)&&Number.isFinite(frame?.duration)&&frame.duration>0&&frame.time>=frame.duration)completionEvidence='frame.duration';
      })??(()=>{});
      if(finished)stop();else timer=setTimer(()=>finish(cpu.length?'timeout':'unsupported'),timeoutMs);
    }catch(error){finish('player-error',error);}
  });
}

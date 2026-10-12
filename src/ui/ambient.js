// The default is a bounded arrival beat. The active command stage may opt into
// continuous atmosphere; hiding, detaching or replacing the scene cancels it.
// The caller owns rendering;
// this module has no campaign/rules imports and never reads or modifies a save.
export const AMBIENT_BUDGET=Object.freeze({durationMs:6000,balancedFps:12,highFps:20});
const active=new WeakMap();

export function playAmbientScene(canvas,{reducedMotion=false,quality='balanced',continuous=false,onFrame=()=>{}}={}){
  active.get(canvas)?.();
  const doc=canvas?.ownerDocument,win=doc?.defaultView;
  const box=canvas?.getBoundingClientRect?.();
  if(!canvas||!canvas.isConnected||!doc||doc.hidden||reducedMotion||quality==='performance'||!box||box.width<=34||box.height<=80||typeof win?.requestAnimationFrame!=='function'){
    onFrame(null);return ()=>{};
  }
  const fps=quality==='high'?AMBIENT_BUDGET.highFps:AMBIENT_BUDGET.balancedFps;
  const now=()=>win.performance?.now()??globalThis.performance?.now()??Date.now();
  const setTimer=win.setTimeout?.bind(win)??globalThis.setTimeout;
  const clearTimer=win.clearTimeout?.bind(win)??globalThis.clearTimeout;
  const started=now();let finished=false,frameId,timerId,last=0;
  function cancel(){
    if(finished)return;finished=true;
    if(frameId!==undefined)win.cancelAnimationFrame(frameId);
    if(timerId!==undefined)clearTimer(timerId);
    doc.removeEventListener('visibilitychange',visibility);
    win.removeEventListener('scroll',cancel,true);win.removeEventListener('resize',cancel);
    if(active.get(canvas)===cancel)active.delete(canvas);
    onFrame(null);
  }
  function visibility(){if(doc.hidden)cancel();}
  function tick(timestamp){
    if(finished)return;
    const elapsed=Math.max(0,timestamp-started);
    if(doc.hidden||!canvas.isConnected||(!continuous&&elapsed>=AMBIENT_BUDGET.durationMs)){cancel();return;}
    if(elapsed-last>=1000/fps){
      last=elapsed;
      try{onFrame(elapsed);}catch(error){cancel();throw error;}
    }
    if(!finished)frameId=win.requestAnimationFrame(tick);
  }
  doc.addEventListener('visibilitychange',visibility);
  win.addEventListener('scroll',cancel,{capture:true,passive:true});win.addEventListener('resize',cancel,{passive:true});
  active.set(canvas,cancel);
  try{onFrame(0);}catch(error){cancel();throw error;}
  if(!finished){
    const remaining=Math.max(0,AMBIENT_BUDGET.durationMs-(now()-started));
    if(!continuous&&!remaining)cancel();else{if(!continuous)timerId=setTimer(cancel,remaining);frameId=win.requestAnimationFrame(tick);}
  }
  return cancel;
}

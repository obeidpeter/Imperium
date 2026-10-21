// The scene's pointer in real time (build brief §2.7, §3.14). Pointer Events
// unify mouse, touch and pen. The left button acts where the pointer is and,
// held over ground, keeps steering (the page re-issues the move every 200 ms);
// the right button uses the current ability; the middle button turns the view
// and the wheel zooms. On a Mac, Ctrl+click is the right button. Touch: a tap
// is a left click, a still finger held for the hold delay inspects (lifting it
// then does nothing), two fingers pinch to zoom and twist to turn.
// The scene keeps its browser defaults to itself: no autoscroll, page zoom,
// context menu, long-press callout, pull-to-refresh or swipe navigation. There
// is no dblclick handler anywhere.

export const HOLD_REPEAT_MS=200,TAP_SLOP=10;
const isMac=nav=>/Mac|iPhone|iPad/.test(nav?.platform??nav?.userAgentData?.platform??'');

export function bindRealtimeInput(canvas,handlers,{holdDelay=()=>450,swapButtons=()=>false,timers=globalThis,nav=globalThis.navigator}={}){
  const listeners=[],on=(target,type,fn,options)=>{target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options));};
  const touches=new Map();let mouse=null,held=null,repeat=null,pinch=null,longPress=null,gesture=false;
  const point=e=>({clientX:e.clientX,clientY:e.clientY,shift:!!e.shiftKey,pointerType:e.pointerType,time:e.timeStamp});
  const stopRepeat=()=>{if(repeat){timers.clearInterval(repeat);repeat=null;}held=null;};
  const button=e=>{
    let b=e.button===2?'right':e.button===1?'middle':'left';
    if(b==='left'&&e.ctrlKey&&isMac(nav))b='right';
    if(swapButtons()&&b!=='middle')b=b==='left'?'right':'left';
    return b;
  };
  // §2.7: the scene's own browser defaults.
  canvas.style.touchAction='none';canvas.style.userSelect='none';canvas.style.webkitUserSelect='none';canvas.style.webkitTouchCallout='none';
  canvas.style.overscrollBehavior='none';
  on(canvas,'contextmenu',e=>e.preventDefault());
  on(canvas,'wheel',e=>{e.preventDefault();handlers.zoom?.(e.deltaY*(e.deltaMode===1?16:1)*.012);},{passive:false});
  for(const type of ['gesturestart','gesturechange','gestureend'])on(canvas,type,e=>e.preventDefault());

  on(canvas,'pointerdown',e=>{
    canvas.focus?.({preventScroll:true});
    if(e.pointerType==='touch'){
      e.preventDefault();touches.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false});
      if(touches.size===2){
        // Once two fingers are down the touch is a gesture: no finger lifted from it taps.
        gesture=true;timers.clearTimeout(longPress);longPress=null;const [a,b]=[...touches.values()];
        pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),angle:Math.atan2(b.y-a.y,b.x-a.x),y:(a.y+b.y)/2};
      }else if(touches.size===1){
        const start=point(e);timers.clearTimeout(longPress);
        longPress=timers.setTimeout(()=>{const t=touches.get(e.pointerId);if(t&&!t.moved&&touches.size===1){t.inspected=true;handlers.inspect?.(start);}},holdDelay());
      }
      return;
    }
    const b=button(e);if(b==='middle'){e.preventDefault();mouse={middle:true,x:e.clientX,y:e.clientY};canvas.setPointerCapture?.(e.pointerId);return;}
    canvas.setPointerCapture?.(e.pointerId);handlers.press?.({...point(e),button:b});
    if(b==='left'&&handlers.hold){
      stopRepeat();held=point(e);
      repeat=timers.setInterval(()=>{if(held)handlers.hold({...held,button:'left'});},HOLD_REPEAT_MS);
    }
  });
  on(canvas,'pointermove',e=>{
    if(e.pointerType==='touch'){
      const t=touches.get(e.pointerId);if(!t)return;t.x=e.clientX;t.y=e.clientY;
      if(Math.hypot(t.x-t.startX,t.y-t.startY)>TAP_SLOP){t.moved=true;timers.clearTimeout(longPress);longPress=null;}
      if(touches.size===2&&pinch){
        const [a,b]=[...touches.values()],distance=Math.hypot(a.x-b.x,a.y-b.y),angle=Math.atan2(b.y-a.y,b.x-a.x),y=(a.y+b.y)/2;
        handlers.zoom?.((pinch.distance-distance)*.06);handlers.rotate?.(Math.atan2(Math.sin(angle-pinch.angle),Math.cos(angle-pinch.angle)),(y-pinch.y)*.004);
        pinch={distance,angle,y};
      }
      return;
    }
    if(mouse?.middle){handlers.rotate?.(-(e.clientX-mouse.x)*.006,(e.clientY-mouse.y)*.004);mouse.x=e.clientX;mouse.y=e.clientY;return;}
    if(held)held=point(e);
    handlers.hover?.(point(e));
  });
  const end=e=>{
    if(e.pointerType==='touch'){
      const t=touches.get(e.pointerId);touches.delete(e.pointerId);if(touches.size<2)pinch=null;
      timers.clearTimeout(longPress);longPress=null;
      if(t&&!t.moved&&!t.inspected&&!gesture&&e.type==='pointerup'&&touches.size===0)handlers.press?.({...point(e),button:'left',touch:true});
      if(!touches.size)gesture=false;return;
    }
    if(mouse?.middle){mouse=null;return;}
    if(held&&e.type==='pointerup'){stopRepeat();handlers.release?.(point(e));}else stopRepeat();
  };
  on(canvas,'pointerup',end);on(canvas,'pointercancel',end);
  on(canvas,'pointerleave',e=>{if(e.pointerType!=='touch'&&!held)handlers.hover?.(null);});
  return {dispose(){stopRepeat();timers.clearTimeout(longPress);listeners.forEach(off=>off());},get holding(){return !!held;}};
}

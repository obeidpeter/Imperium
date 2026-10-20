// Touch has no hover. Holding a finger still on the board for a moment shows
// what a tap there would do (onHold gets the touch point), and the release that
// ends the hold is then swallowed so it commits nothing. Moving the finger
// further than the slop cancels the hold: that is a drag or a scroll.
// Presentation only: no game state, rules or gameplay randomness.
export const HOLD_MS=450,HOLD_SLOP=7;
export function createTouchHold(onHold,{delay=HOLD_MS,slop=HOLD_SLOP,timers=globalThis}={}){
  let timer=null,start=null,held=false;
  const cancel=()=>{if(timer!==null)timers.clearTimeout(timer);timer=null;};
  return {
    down(event){
      cancel();held=false;start=null;
      if(event.pointerType!=='touch')return;
      start={clientX:event.clientX,clientY:event.clientY};
      timer=timers.setTimeout(()=>{timer=null;held=true;onHold(start);},delay);
    },
    move(event){if(timer!==null&&Math.hypot(event.clientX-start.clientX,event.clientY-start.clientY)>slop)cancel();},
    up(){cancel();},
    configure(options={}){const next=Number(options.delay);if(Number.isFinite(next)&&next!==delay){cancel();held=false;start=null;delay=Math.max(250,Math.min(1200,next));}},
    // True once after a hold: the tap or pick that ends it should do nothing.
    consume(){const was=held;held=false;return was;},
    dispose(){cancel();held=false;start=null;},
  };
}

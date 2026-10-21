import {createTouchHold} from './touch-hold.js';

const ARROWS={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};

// Pointer and keyboard input on the battle board. The page decides what a point
// means; this turns events into board points and keeps the rules of the hand:
// - A click picks from where the pointer was pressed. A click reports whole
//   pixels, but the pointer that drew the route preview can sit between them,
//   so the tile that walks is the tile that was shown.
// - Touch has no hover: a finger held still shows the readout and route for its
//   tile (touch-hold.js), and the tap that ends a hold commits nothing.
// - A long press on a touch screen raises a context menu; it is not a cancel.
// - A mouse leaving the board clears the readout; a lifted finger keeps it.
// - The readout follows the mouse at most once a frame.
// In 3D the stage handles the pointer itself, so only the context menu and the
// keyboard cursor are bound.
//   pick(clientX,clientY) → the board point under the pointer ({x:-1,y:-1} off the grid)
//   inside(point) → whether the point is on the grid
//   current() → the tile the readout shows now (the keyboard and a held finger move it too)
//   hover(point|null), select(point), cancel(), step([dx,dy]), activate()
// The board outlives page updates, so configure({holdDelay}) takes a changed setting.
export function bindBoardInput(board,{threeD=false,pick,inside,current,hover,select,cancel,step,activate,holdDelay,frame=fn=>requestAnimationFrame(fn),timers}={}){
  const bound=[],on=(type,fn)=>{board.addEventListener(type,fn);bound.push([type,fn]);};
  const hovered=(x,y)=>{const point=pick(x,y);return inside(point)?point:null;};
  let pressed=null,pointer='mouse',next=null,queued=false;
  const hold=createTouchHold(at=>{if(!board.isConnected)return;const point=hovered(at.clientX,at.clientY);if(point)hover(point);},{delay:holdDelay,timers});
  on('pointerdown',event=>{pointer=event.pointerType;if(threeD)return;pressed={x:event.clientX,y:event.clientY};hold.down(event);});
  on('contextmenu',event=>{event.preventDefault();if(pointer!=='touch')cancel();});
  on('keydown',event=>{
    const delta=ARROWS[event.key];
    if(delta){event.preventDefault();step(delta);}
    else if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();}
  });
  if(!threeD){
    for(const type of ['pointerup','pointercancel'])on(type,()=>hold.up());
    on('click',event=>{
      if(hold.consume())return;
      const near=pressed&&Math.abs(pressed.x-event.clientX)<1&&Math.abs(pressed.y-event.clientY)<1,at=near?pressed:{x:event.clientX,y:event.clientY};
      pressed=null;select(pick(at.x,at.y));
    });
    on('pointermove',event=>{
      if(event.pointerType==='touch'){hold.move(event);return;}
      const point=hovered(event.clientX,event.clientY);
      if(samePoint(queued?next:current(),point))return;next=point;
      if(!queued){queued=true;frame(()=>{queued=false;if(board.isConnected)hover(next);});}
    });
    on('pointerleave',event=>{if(event.pointerType==='touch')return;next=null;hover(null);});
  }
  return {configure({holdDelay:delay}={}){hold.configure({delay});},dispose(){hold.dispose();for(const [type,fn] of bound)board.removeEventListener(type,fn);}};
}
const samePoint=(a,b)=>(!a&&!b)||Boolean(a&&b&&a.x===b.x&&a.y===b.y);

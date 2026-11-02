// The inventory's hands (release 13): drag a piece with the mouse, a pen or a
// finger, or carry it with the keyboard, and drop it where it should go. Every
// drop becomes one command through the page (inventory-views.js dropCommand),
// so a refusal changes nothing; dragging itself changes nothing but the screen.
//
// - Pointer: press on a piece and move it a few pixels to lift it; the places
//   it can go light up (a worn place it fits, the pack's cells under it, the
//   ground, a trader to sell to); let go to drop it. A press that does not move
//   is a click, which selects. The right button, or a finger held still, shows
//   the piece's details. A drag never starts in the list mode (narrow windows
//   and 200% text), where a finger scrolls.
// - Keyboard: in the pack the arrow keys move between pieces. "Move in pack"
//   lifts the selected piece; the arrows move it a place at a time, Enter puts
//   it down there, Escape puts it back. Each step is announced.
//
// Bound once to the dialog: the inventory inside it is patched in place, so the
// controller finds its parts again on every event rather than holding them.

const LIFT_PX={mouse:5,pen:6,touch:10};

// What a piece's data attributes name, as dropCommand takes it.
export function pieceOf(el){
  const d=el?.dataset;if(!d?.piece)return null;
  const base={id:d.item,w:Number(d.w)||1,h:Number(d.h)||1};
  switch(d.piece){
    case 'pack':return {...base,from:'pack',uid:d.uid,x:Number(d.x),y:Number(d.y)};
    case 'worn':return {...base,from:'worn',place:d.place};
    case 'ground':return {...base,from:'ground',uid:d.uid};
    case 'container':return {...base,from:'container',container:d.container,index:Number(d.index)};
    case 'shop':return {...base,from:'shop',shop:d.shop};
    case 'loot':return {...base,from:'loot',source:d.source,take:d.take};
    default:return null;
  }
}

// The pack place a held piece would take: where its picture is, its top left corner snapped to the nearest
// cell. `grab` is where the pointer holds it, in cells from that corner (its middle unless it came from the pack).
export function cellAt(rect,cell,{clientX,clientY},{w,h},grab={x:w/2,y:h/2},{cols=10,rows=6}={}){
  const x=Math.round((clientX-rect.left)/cell-grab.x),y=Math.round((clientY-rect.top)/cell-grab.y);
  return {x:Math.max(0,Math.min(cols-w,x)),y:Math.max(0,Math.min(rows-h,y))};
}

// The nearest piece from `from` in a direction, on the pack's grid (for the arrow keys).
export function nearestPiece(pieces,from,key){
  const dir={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[key];if(!dir||!from)return null;
  const c=p=>({x:p.x+p.w/2,y:p.y+p.h/2}),o=c(from);let best=null,score=Infinity;
  for(const p of pieces){
    if(p===from)continue;const q=c(p),dx=q.x-o.x,dy=q.y-o.y,along=dx*dir[0]+dy*dir[1];if(along<=0.01)continue;
    const across=Math.abs(dx*dir[1]+dy*dir[0]),s=along+across*2;if(s<score){score=s;best=p;}
  }
  return best;
}

export function bindInventory(modal,{preview,drop,select,announce,timers=globalThis,holdDelay=()=>450,doc=globalThis.document}){
  let press=null,drag=null,carry=null,suppressClick=false,hold=null,swallowed=false;
  // Escape that puts a piece back must not also close the dialog (its cancel event follows the key).
  const swallowEscape=e=>{e.preventDefault();e.stopPropagation();swallowed=true;timers.setTimeout(()=>{swallowed=false;},0);};
  const inventory=()=>modal.querySelector('.inventory');
  const grid=()=>modal.querySelector('.pack-grid');
  const listMode=()=>{const g=grid();return !g||getComputedStyle(g).display!=='grid';};
  const cellSize=()=>{const g=grid(),cols=Number(g?.style.getPropertyValue('--cols'))||10;return g?(g.getBoundingClientRect().width-4)/cols:40;};
  const status=text=>{const live=modal.querySelector('[data-inventory-status]');if(live){live.textContent=text;live.classList.remove('is-problem');}else announce?.(text);};
  const ghost=()=>modal.querySelector('.pack-ghost');

  function showGhost(at,piece,ok){
    const g=ghost();if(!g)return;
    if(!at){g.hidden=true;return;}
    g.hidden=false;g.style.gridColumn=`${at.x+1} / span ${piece.w}`;g.style.gridRow=`${at.y+1} / span ${piece.h}`;g.classList.toggle('is-blocked',!ok);
  }
  function clearHighlights(){
    const inv=inventory();inv?.classList.remove('is-dragging');
    for(const el of modal.querySelectorAll('.is-drop-ok,.is-drop-bad,.is-lifted'))el.classList.remove('is-drop-ok','is-drop-bad','is-lifted');
    for(const el of modal.querySelectorAll('[data-fits]'))delete el.dataset.fits;
    showGhost(null);
  }
  // Where a drop at this point would go: a worn place, the doll, the pack (and its cell), the ground or a trader.
  function targetAt(clientX,clientY,piece,grab){
    const el=doc.elementFromPoint(clientX,clientY)?.closest?.('[data-drop]');
    if(!el||!el.dataset.drop||!modal.contains(el))return null;
    const kind=el.dataset.drop;
    if(kind==='pack'){const r=el.getBoundingClientRect(),at=cellAt({left:r.left+2,top:r.top+2},cellSize(),{clientX,clientY},piece,grab);return {el,to:{to:'pack',...at}};}
    if(kind==='worn')return {el,to:{to:'worn',place:el.dataset.place}};
    if(kind==='shop')return {el,to:{to:'shop',shop:el.dataset.shop}};
    if(kind==='doll'||kind==='ground')return {el,to:{to:kind}};
    return null;
  }
  function lift(e){
    const {el,piece}=press;
    drag={...press,ghostEl:doc.createElement('div')};press=null;
    const cell=cellSize(),g=drag.ghostEl;g.className='inventory-drag';g.setAttribute('aria-hidden','true');
    g.style.inlineSize=`${Math.max(1,piece.w)*cell}px`;g.style.blockSize=`${Math.max(1,piece.h)*cell}px`;
    g.innerHTML=el.querySelector('.item-picture')?.innerHTML??'';modal.append(g);
    el.classList.add('is-lifted');inventory()?.classList.add('is-dragging');
    // The worn places this piece can take light up; the others dim.
    for(const socket of modal.querySelectorAll('.worn-socket[data-drop="worn"]')){
      const r=preview(piece,{to:'worn',place:socket.dataset.place});socket.dataset.fits=String(!!r?.command);
    }
    el.setPointerCapture?.(e.pointerId);move(e);
  }
  function move(e){
    if(!drag)return;
    const cell=cellSize();drag.ghostEl.style.left=`${e.clientX-drag.grab.x*cell}px`;drag.ghostEl.style.top=`${e.clientY-drag.grab.y*cell}px`;
    for(const el of modal.querySelectorAll('.is-drop-ok,.is-drop-bad'))el.classList.remove('is-drop-ok','is-drop-bad');
    const t=targetAt(e.clientX,e.clientY,drag.piece,drag.grab);drag.target=t;
    if(!t){showGhost(null);return;}
    const r=preview(drag.piece,t.to),ok=!!r?.command;
    if(t.to.to==='pack'){showGhost(t.to,drag.piece,ok||r===null);}else{showGhost(null);t.el.classList.add(ok?'is-drop-ok':'is-drop-bad');}
  }
  function finish(e,{cancel=false}={}){
    if(!drag)return;
    const d=drag;drag=null;d.ghostEl.remove();
    if(d.el.hasPointerCapture?.(d.pointerId))d.el.releasePointerCapture(d.pointerId);
    clearHighlights();suppressClick=true;timers.setTimeout(()=>{suppressClick=false;},0);
    if(cancel||!d.target){if(!cancel)status('Put back.');return;}
    drop(d.piece,d.target.to);
  }
  const onDown=e=>{
    if(drag||carry||e.button>0&&e.pointerType==='mouse')return;
    const el=e.target.closest?.('[data-piece]');if(!el||!modal.contains(el)||!inventory()?.contains(el))return;
    const piece=pieceOf(el);if(!piece)return;
    // Where the piece was taken hold of, in cells from its top left corner, so it stays under the pointer as it
    // moves: by its middle, unless it was lying in the pack.
    let grab={x:piece.w/2,y:piece.h/2};
    if(piece.from==='pack'&&!listMode()){const r=el.getBoundingClientRect(),cell=cellSize();
      grab={x:Math.max(0,Math.min(piece.w,(e.clientX-r.left)/cell)),y:Math.max(0,Math.min(piece.h,(e.clientY-r.top)/cell))};}
    press={el,piece,grab,pointerId:e.pointerId,x:e.clientX,y:e.clientY,type:e.pointerType||'mouse'};
    timers.clearTimeout(hold);
    if(e.pointerType==='touch')hold=timers.setTimeout(()=>{if(press?.el===el){const p=press;press=null;showDetails(p.el);}},holdDelay());
  };
  const onMove=e=>{
    if(drag&&e.pointerId===drag.pointerId){e.preventDefault();move(e);return;}
    if(!press||e.pointerId!==press.pointerId)return;
    if(Math.hypot(e.clientX-press.x,e.clientY-press.y)<(LIFT_PX[press.type]??6))return;
    timers.clearTimeout(hold);
    if(listMode()){press=null;return;}
    e.preventDefault();lift(e);
  };
  const onUp=e=>{
    timers.clearTimeout(hold);
    if(drag&&e.pointerId===drag.pointerId){e.preventDefault();finish(e,{cancel:e.type==='pointercancel'});return;}
    if(press&&e.pointerId===press.pointerId)press=null;
  };
  function showDetails(el){
    const id=el.dataset.id;if(!id)return;
    suppressClick=true;timers.setTimeout(()=>{suppressClick=false;},0);
    select(id,{details:true});
  }
  const onContext=e=>{
    const el=e.target.closest?.('[data-piece],.pack-item,.worn-socket,.ground-item,.goods-item');
    if(!el||!inventory()?.contains(el))return;e.preventDefault();showDetails(el);
  };
  const onClick=e=>{if(suppressClick&&inventory()?.contains(e.target)){e.preventDefault();e.stopPropagation();suppressClick=false;}};

  // The keyboard: arrows between pieces in the pack; a carried piece moves a place at a time.
  function packPieces(){return [...modal.querySelectorAll('.pack-grid .pack-item')].map(el=>({el,x:Number(el.dataset.x??el.style.gridColumnStart-1),
    y:Number(el.dataset.y??el.style.gridRowStart-1),w:Number(el.dataset.w)||1,h:Number(el.dataset.h)||1}));}
  function carryAnnounce(lead=''){
    const r=preview(carry.piece,{to:'pack',x:carry.at.x,y:carry.at.y}),ok=!!r?.command||r===null;
    showGhost(carry.at,carry.piece,ok);
    status(`${lead}Column ${carry.at.x+1}, row ${carry.at.y+1}: ${r===null?'where it lies':ok?'it fits':'it does not fit'}.`);
  }
  function startCarry(uid){
    const el=modal.querySelector(`.pack-grid .pack-item[data-uid="${CSS.escape(uid)}"]`),piece=pieceOf(el);
    if(!piece||listMode())return false;
    carry={piece,at:{x:piece.x,y:piece.y},uid};const g=grid();g.tabIndex=-1;g.focus({preventScroll:true});
    el.classList.add('is-lifted');inventory()?.classList.add('is-dragging');
    // One announcement: what is carried and how, then where it is.
    carryAnnounce(`Moving the ${el.querySelector('.pack-item-name')?.textContent??'piece'}: the arrow keys move it, Enter puts it down, Escape puts it back. `);return true;
  }
  function endCarry({focus=true}={}){
    if(!carry)return;const uid=carry.uid;carry=null;clearHighlights();
    if(focus)modal.querySelector(`.pack-grid .pack-item[data-uid="${CSS.escape(uid)}"]`)?.focus({preventScroll:true});
  }
  const onKey=e=>{
    if(drag&&e.key==='Escape'){swallowEscape(e);finish(e,{cancel:true});status('Put back.');return;}
    if(carry){
      const step={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
      if(step){e.preventDefault();e.stopPropagation();
        carry.at={x:Math.max(0,Math.min(10-carry.piece.w,carry.at.x+step[0])),y:Math.max(0,Math.min(6-carry.piece.h,carry.at.y+step[1]))};carryAnnounce();return;}
      if(e.key==='Escape'){swallowEscape(e);endCarry();status('Put back.');return;}
      if(e.key==='Enter'||e.key===' '){
        e.preventDefault();e.stopPropagation();const r=preview(carry.piece,{to:'pack',x:carry.at.x,y:carry.at.y});
        if(r?.refusal){status(r.refusal);return;}
        const {piece,at}=carry;endCarry({focus:false});if(r?.command)drop(piece,{to:'pack',...at});else status('Put back where it was.');return;
      }
      if(e.key==='Tab'){endCarry({focus:false});status('Put back.');}
      return;
    }
    const el=e.target.closest?.('.pack-grid .pack-item');
    if(el&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&!listMode()){
      const pieces=packPieces(),from=pieces.find(p=>p.el===el),next=nearestPiece(pieces,from,e.key);
      e.preventDefault();e.stopPropagation();next?.el.focus();
    }
  };
  const onCancel=e=>{if(drag||carry||swallowed)e.preventDefault();};
  const listeners=[['pointerdown',onDown],['pointermove',onMove],['pointerup',onUp],['pointercancel',onUp],['contextmenu',onContext],['click',onClick,true],
    ['keydown',onKey,true],['cancel',onCancel]];
  for(const [type,fn,capture]of listeners)modal.addEventListener(type,fn,capture??false);
  return {
    carry:startCarry,
    get busy(){return !!(drag||carry);},
    // After the page patched the inventory: a carried piece keeps its ghost; a piece no longer there ends the carry.
    refresh(){if(carry){if(!modal.querySelector(`.pack-grid .pack-item[data-uid="${CSS.escape(carry.uid)}"]`)){carry=null;clearHighlights();}else carryAnnounce();}},
    cancel(){if(drag){drag.ghostEl.remove();drag=null;}carry=null;press=null;clearHighlights();},
    dispose(){this.cancel();for(const [type,fn,capture]of listeners)modal.removeEventListener(type,fn,capture??false);}
  };
}

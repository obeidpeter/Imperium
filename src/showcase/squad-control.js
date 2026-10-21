import {cardButtons,cardOrder,commandPips,commandSquads,describeOrder,formationPreview,friendlyStandard,liveSelection,markerOrder,orderIntent,selectSquads,squadState}
  from '../core/realtime/order-intents.js';
import {actorById} from '../core/realtime/abilities.js';
import {squadById,squadCentre} from '../core/realtime/squads.js';
import {clampToMap,navGrid} from '../core/realtime/navigation.js';
import {deploying} from '../core/realtime/deployment.js';
import {actionLabel} from '../ui/action-map.js';

// The squads on the page (guide "Squads", "Command"; build brief §3.8,
// §3.16): the squad bar's standards, the Command pips beside the clock, the
// command card that replaces the ability bar while squads are selected, and
// the order marker the arrow keys move. The selection is the page's, never
// the world's; every order goes through the field's issue() and so through
// the rules' checks. Presentation and input only.

const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);

export function createSquadControl({world:getWorld,dom,issue,say,presenter,keymap,canvas,place=null}){
  let selection=[],marker=null,barKey='',cardKey='',pipsKey='',frameKey='',dragging=null;
  const world=()=>getWorld();
  const active=()=>liveSelection(world(),selection).length>0;
  function setSelection(next,{quiet=false}={}){
    const w=world();selection=liveSelection(w,next);if(!selection.length)marker=null;
    presenter()?.setSelection?.(selection);presenter()?.setMarker?.(marker);update(true);
    if(!quiet)say(selection.length?`Selected: ${selection.map(id=>squadById(w,id)?.name).join(', ')}. Right-click to order; 1 to 6 on the card.`:'Selection cleared.',{announce:true});
  }
  function build(){
    const w=world(),squads=commandSquads(w);
    if(dom.squadBar){
      dom.squadBar.hidden=!squads.length&&!(w.squads??[]).some(s=>s.side!=='enemy');
      dom.squadBar.replaceChildren(...(w.squads??[]).filter(s=>s.side!=='enemy').map((s,i)=>{
        const b=document.createElement('button');b.type='button';b.className='rt-standard';b.dataset.squad=s.id;
        const key=actionLabel(`select_squad_${i+1}`,keymap);if(i<6)b.setAttribute('aria-keyshortcuts',key);
        b.innerHTML=`<span class="rt-standard-flag" aria-hidden="true">${i+1}</span><span class="rt-standard-name">${esc(s.name)}</span>`+
          `<span class="bar strength"><i></i></span><span class="rt-standard-mark" aria-hidden="true"></span><span class="visually-hidden rt-standard-state"></span>`;
        b.addEventListener('click',event=>{setSelection(selectSquads(world(),selection,{squadId:s.id,shift:event.shiftKey,touch:event.pointerType==='touch'},{deployment:deploying(world())}));
          canvas.focus({preventScroll:true});});
        // While deploying, a standard can be dragged onto the field: it is placed where it is let go.
        b.addEventListener('pointerdown',event=>{
          if(!deploying(world())||!place)return;dragging={id:s.id,x:event.clientX,y:event.clientY};
          const up=e=>{window.removeEventListener('pointerup',up);const d=dragging;dragging=null;if(!d||Math.hypot(e.clientX-d.x,e.clientY-d.y)<8)return;
            const r=canvas.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;
            setSelection([d.id],{quiet:true});place({clientX:e.clientX,clientY:e.clientY},d.id);};
          window.addEventListener('pointerup',up);
        });
        return b;
      }));
    }
    if(dom.clearButton)dom.clearButton.onclick=()=>{setSelection([]);canvas.focus({preventScroll:true});};
  }
  // The HUD, written only when what it shows changes (it is asked every frame).
  function update(force=false){
    const w=world();if(!w.squads)return;
    // Selected squads' places count too: whether they can take a formation together depends on them.
    const c=w.command,near=s=>selection.includes(s.id)?`${Math.round(s.x/2)},${Math.round(s.z/2)}`:'';
    const key=[selection.join(','),deploying(w),c?`${c.capacity}/${c.left}/${c.round}/${w.queue.length}`:'',...w.squads.map(s=>`${s.id}:${s.members.filter(id=>actorById(w,id)?.alive).length}:${near(s)}:`+
      `${Math.round(s.morale)}:${Math.round(s.cohesion)}:${Math.floor(s.suppression)}:${s.broken}:${s.formation}:${s.braced}:${s.pending?.order.kind??''}:${s.pending?.round??''}`)].join('|');
    if(key===frameKey&&!force)return;frameKey=key;
    const bar=(w.squads??[]).filter(s=>s.side!=='enemy').map(s=>s.id).join(',');if(bar!==barKey){barKey=bar;build();}
    for(const b of dom.squadBar?.children??[]){
      const s=squadById(w,b.dataset.squad);if(!s)continue;const men=s.members.filter(id=>actorById(w,id)?.alive).length,on=selection.includes(s.id),down=men===0;
      b.querySelector('.strength i').style.inlineSize=`${men/s.maxMen*100}%`;b.setAttribute('aria-pressed',String(on));b.classList.toggle('selected',on);
      b.classList.toggle('shaken',!down&&!s.broken&&s.morale<=40);b.classList.toggle('broken',!down&&s.broken);b.classList.toggle('down',down);b.disabled=down;
      b.querySelector('.rt-standard-mark').textContent=down?'✕':s.broken?'⚠':s.morale<=40?'!':'';
      const text=down?`${s.name}: cut down.`:squadState(w,s);if(b.title!==text){b.title=text;b.querySelector('.rt-standard-state').textContent=text;}
    }
    const pips=commandPips(w);
    if(dom.commandPips&&pips){
      const key=`${pips.capacity}/${pips.left}/${pips.reserved}`;dom.commandPips.hidden=false;
      if(key!==pipsKey||force){pipsKey=key;dom.commandPips.setAttribute('aria-label',pips.text);dom.commandPips.title=pips.text;
        dom.commandPips.innerHTML=`<span class="eyebrow">Command</span>${Array.from({length:pips.capacity},(_,i)=>
          `<i class="${i<pips.left?'full':i<pips.left+pips.reserved?'reserved':'spent'}"></i>`).join('')}`;}
    }
    // While deploying no order is given: the card stays away.
    const on=active()&&!deploying(w);if(dom.commandCard)dom.commandCard.hidden=!on;if(dom.abilityBar)dom.abilityBar.hidden=on;if(dom.clearButton)dom.clearButton.hidden=!active();
    if(on&&dom.commandCard){
      const buttons=cardButtons(w,selection),key=buttons.map(b=>`${b.kind}:${b.ok}:${b.note}`).join('|')+`|${selection.join(',')}`;
      if(key!==cardKey||force){
        cardKey=key;
        dom.commandCard.replaceChildren(...buttons.map(c=>{
          const b=document.createElement('button');b.type='button';b.className='ability rt-card-order';b.dataset.order=c.kind;b.setAttribute('aria-keyshortcuts',String(c.key));
          b.innerHTML=`<kbd>${c.key}</kbd><span>${esc(c.name)}</span><small>${esc(c.note)}</small>`;b.title=c.ok?`${c.summary} ${c.message}`:c.message;
          b.classList.toggle('unavailable',!c.ok);b.addEventListener('click',()=>{card(c.key-1);canvas.focus({preventScroll:true});});return b;
        }));
      }
    }
  }
  function send(r){
    if(!r)return false;
    if(r.command){const outcome=issue(r.command);if(outcome.ok){say(r.message.replace(/ \(\d+ Command\)\.$/,'.'),{announce:true});update(true);}}
    else say(r.message,{warning:true});
    return true;
  }
  function card(index){return send(cardOrder(world(),selection,index));}
  return {
    get selection(){return liveSelection(world(),selection);},
    get active(){return active();},
    get marker(){return marker;},
    build,update,
    select(choice){setSelection(selectSquads(world(),selection,choice,{deployment:deploying(world())}));},
    clear(){if(!active())return false;setSelection([]);return true;},
    // A click on one of our men selects his squad (never attacks); true when it was ours.
    pickStandard(pick,{shift=false,touch=false}={}){
      const id=friendlyStandard(world(),pick);if(!id)return false;setSelection(selectSquads(world(),selection,{squadId:id,shift,touch},{deployment:deploying(world())}));return true;
    },
    // The right button (a tap on touch) while squads are selected: an order.
    order(pick){if(!active())return false;return send(orderIntent(world(),selection,pick));},
    intent(pick){return active()?orderIntent(world(),selection,pick):null;},
    card,
    // The arrow keys move the order marker; Enter sends the squads to it (or against the T target).
    // While deploying the marker also places the soldier or companion controlled when no standard is chosen.
    moveMarker(dx,dz){
      const w=world();if(!active()&&!deploying(w))return false;
      if(!marker){const lead=squadById(w,selection[0]),me=actorById(w,w.controlled);marker=lead?{...squadCentre(w,lead)}:me?{x:me.x,z:me.z}:{x:0,z:0};}
      marker=clampToMap(navGrid(w.map),{x:marker.x+dx,z:marker.z+dz},1);presenter()?.setMarker?.(marker);
      dom.announcer&&(dom.announcer.textContent=`Order marker moved. Enter sends ${selection.length===1?'the squad':'the squads'} there.`);return true;
    },
    sendMarker(targetId=null){
      if(deploying(world())){if(!marker||!place)return false;place(null,liveSelection(world(),selection)[0]??world().controlled,marker);return true;}
      if(!active())return false;return send(markerOrder(world(),selection,{marker,targetId}));
    },
    get marking(){return !!marker;},
    preview:()=>formationPreview(world(),selection),
    describe:(order)=>describeOrder(world(),order,selection),
    reset(){selection=[];marker=null;barKey='';cardKey='';pipsKey='';frameKey='';build();update(true);}
  };
}

import {ORDERS} from '../data/realtime-squads.js';
import {TIME} from '../data/realtime-rules.js';
import {commandable,orderDelayTicks,orderProblem,roundNow} from '../core/realtime/command.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const label=order=>ORDERS[order?.kind]?.name??order?.kind?.replaceAll('_',' ')??'Standing orders';
const formationLabel=formation=>ORDERS[formation]?.name??formation??'None';
const position=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.z)?`${Math.round(p.x)} m, ${Math.round(p.z)} m`:null;
function destination(world,order,squad){
  if(order?.targetId){
    const target=world.squads?.find(s=>s.id===order.targetId)??world.actors.find(a=>a.id===order.targetId);
    // An old target never discloses a hidden enemy's current position.
    return target?.name??'Previously ordered target';
  }
  const object=world.objects?.find(o=>o.id===order?.objectId);
  if(object)return object.name;
  if(position(order))return `Position ${position(order)}`;
  if(order?.kind==='withdraw')return 'Back toward your soldier';
  if(order?.kind==='feigned_retreat')return 'Away from the opposing horse';
  return `Current position ${position(squad)??''}`.trim();
}

// Read-only projection of the actual queued, travelling and active orders.
// An order in the queue can coexist with an older order still travelling.
export function squadOrderReview(world){
  const round=roundNow(world);
  return (world.squads??[]).filter(s=>s.side!=='enemy').map(s=>{
    const queue=(world.queue??[]).filter(q=>q.kind==='order'&&q.payload.squads.includes(s.id));
    const queued=queue.at(-1),pending=s.pending,order=queued?.payload.order??pending?.order??s.order;
    const state=!commandable(world,s)?'Unavailable':queued?'Queued':pending?'On its way':s.order?'In effect':'Standing orders';
    const reservations=[...queue.map(q=>({cost:q.payload.costs?.[s.id]??0,round:q.payload.reserved?.round})),...(pending?[pending]:[])];
    const cost=reservations.reduce((n,r)=>n+r.cost,0),current=reservations.filter(r=>r.round===round).reduce((n,r)=>n+r.cost,0);
    const delay=queued?orderDelayTicks(world):pending?Math.max(0,pending.at-world.tick):0;
    const shared=!!ORDERS[order?.kind]?.formation;
    return {id:s.id,name:s.name,state,order:order?label(order):s.plan?.intent??'Standing orders',destination:destination(world,order??s.plan,s),
      formation:ORDERS[order?.kind]?.formation?`${ORDERS[order.kind].name} planned; ${formationLabel(s.formation).toLowerCase()} now`:formationLabel(s.formation),
      timing:queued?`On resume, then ${(delay/TIME.ticksPerSecond).toFixed(2).replace(/0+$/,'').replace(/\.$/,'')}s`:pending?`${(delay/TIME.ticksPerSecond).toFixed(2).replace(/0+$/,'').replace(/\.$/,'')}s remaining`:'Already acting',
      cost:reservations.length?`${cost} Command reserved${shared?' · shared formation cost':''}${current<cost?' · earlier-round points cannot return':''}`:'No reservation',
      active:s.order?`${label(s.order)} · ${destination(world,s.order,s)}`:s.plan?.intent??'Standing orders',
      previousPending:queued&&pending?`${label(pending.order)} · ${destination(world,pending.order,s)}`:null,
      canReplace:commandable(world,s),canCancel:commandable(world,s)&&!!reservations.length,
      holdReason:orderProblem(world,{squads:[s.id],order:{kind:'hold'}})};
  });
}

export function orderReviewRows(rows){
  return rows.map(r=>`<article class="rt-order-row" data-review-squad="${esc(r.id)}"><header><h3>${esc(r.name)}</h3><span>${esc(r.state)}</span></header>
    <p class="rt-order-purpose"><strong>${esc(r.order)}</strong> · ${esc(r.destination)}</p>
    <dl><div><dt>Formation</dt><dd>${esc(r.formation)}</dd></div><div><dt>Starts</dt><dd>${esc(r.timing)}</dd></div><div><dt>Command</dt><dd>${esc(r.cost)}</dd></div></dl>
    ${r.canCancel?`<p class="rt-order-current">Until it arrives: ${esc(r.active)}${/[.!?]$/.test(r.active)?'':'.'}${r.previousPending?` Also travelling: ${esc(r.previousPending)}. Cancelling removes both unapplied orders.`:''}</p>`:''}
    <div class="rt-order-actions"><button type="button" data-review-action="replace" data-squad="${esc(r.id)}" ${r.canReplace?'':'disabled'} aria-label="Replace orders for ${esc(r.name)}">Replace…</button>
    ${r.canCancel?`<button type="button" data-review-action="cancel" data-squad="${esc(r.id)}" aria-label="Cancel unapplied orders for ${esc(r.name)}">Cancel unapplied</button>`:''}
    ${r.canReplace?`<button type="button" data-review-action="hold" data-squad="${esc(r.id)}" ${r.holdReason?'disabled':''} title="${r.holdReason?'Not enough available Command or this squad cannot be ordered.':'Replace with Hold; costs 1 Command.'}">Hold · 1 Command</button>`:''}</div></article>`).join('');
}

export function createOrderReview({dom,world,paused,issue,replace,say,changed=()=>{},opening=()=>{}}){
  let open=false,last='';
  const panel=dom.orderReview,button=dom.orderReviewButton,body=dom.orderReviewRows;
  const enabled=()=>paused()&&world().status==='active'&&!(world().deployment&&!world().deployment.done)&&(world().squads??[]).some(s=>s.side!=='enemy');
  function close({focus=true}={}){open=false;if(panel)panel.hidden=true;button?.setAttribute('aria-expanded','false');if(focus)button?.focus({preventScroll:true});}
  function update(){
    if(!panel||!button||!body)return;
    button.hidden=!enabled();
    if(button.hidden){const focused=panel.contains(document.activeElement)||button===document.activeElement;close({focus:false});if(focused)dom.canvas?.focus({preventScroll:true});return;}
    if(!open)return;
    const rows=squadOrderReview(world()),key=JSON.stringify(rows);if(key===last)return;last=key;
    const active=document.activeElement,focus=active?.dataset?.reviewAction?{action:active.dataset.reviewAction,id:active.dataset.squad}:null;
    body.innerHTML=orderReviewRows(rows);
    if(focus){const row=[...body.querySelectorAll('[data-review-squad]')].find(el=>el.dataset.reviewSquad===focus.id);
      (row?.querySelector(`[data-review-action="${focus.action}"]`)??row?.querySelector('button:not([disabled])')??dom.closeOrderReview)?.focus({preventScroll:true});}
  }
  function show(){if(!enabled())return;opening();open=true;last='';panel.hidden=false;button.setAttribute('aria-expanded','true');update();dom.orderReviewTitle?.focus({preventScroll:true});}
  if(button)button.onclick=()=>open?close():show();
  if(dom.closeOrderReview)dom.closeOrderReview.onclick=()=>close();
  if(body)body.onclick=event=>{
    const b=event.target.closest('[data-review-action]');if(!b||!body.contains(b)||!enabled())return;
    const id=b.dataset.squad,action=b.dataset.reviewAction,row=squadOrderReview(world()).find(r=>r.id===id);if(!row)return;
    if(action==='replace'){close({focus:false});replace(id);return;}
    if(!['cancel','hold'].includes(action))return;
    const command=action==='cancel'?{actorId:world().heroId,kind:'cancelOrder',payload:{squads:[id]}}:
      {actorId:world().heroId,kind:'order',payload:{squads:[id],order:{kind:'hold'}}};
    const outcome=issue(command);if(!outcome.ok)return;
    say(action==='cancel'?`${row.name}: unapplied orders cancelled. Current orders continue. ${outcome.refunded} Command returned.`:`${row.name}: Hold queued.`,{announce:true});
    changed();update();
  };
  return {update,show,close,get open(){return open;},dispose(){if(button)button.onclick=null;if(body)body.onclick=null;if(dom.closeOrderReview)dom.closeOrderReview.onclick=null;}};
}

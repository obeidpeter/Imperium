import {COMMAND,FORMATION_ORDER,ORDERS} from '../../data/realtime-squads.js';
import {TIME} from '../../data/realtime-rules.js';
import {actorById,hostile} from './abilities.js';
import {fielded,squadById,squadOf,squadsOf} from './squads.js';
import {span} from './navigation.js';

// Command (build brief §3.8, guide "Command" and "Orders"): the points the
// soldier spends to order his squads, refilled at every round boundary.
// Issuing an order sets its Command aside from this round's pool at once, so
// two orders never share a point; the order reaches its squad after a short
// delay and is charged then, even past the boundary, never from the refilled
// pool; replacing an order before it takes effect gives its point back (if it
// came from this round). Pure; the world's `command` record and each squad's
// `pending` order carry all of it.

const R=TIME.roundTicks;
const emit=(world,event)=>world.events.push({tick:world.tick,...event});
export const roundNow=world=>Math.floor(world.tick/R)+1;
const ours=squad=>squad.side==='player'||squad.side==='ally';
export const commandable=(world,squad)=>!!squad&&ours(squad)&&fielded(world,squad);

// The pool a world starts with: the chapter's capacity (0.38 counts a trained
// leader, the reserve plan and the reserve-officers opportunity in it).
export function createCommand(capacity){const c=Math.max(0,Math.min(COMMAND.max,capacity|0));return {capacity:c,left:c,round:1};}
// Seconds before a squad starts an order: 1, less 0.05 per point of Authority
// above 10, at least 0.25; none with the Clear orders course.
export function orderDelayTicks(world){
  const hero=actorById(world,world.heroId);if(hero?.effects?.orderDelay===0)return 0;
  const auth=hero?.attributes?.auth??10,d=COMMAND.delay;
  return Math.round(Math.max(d.min,d.base-Math.max(0,auth-10)*d.perAuthority)*TIME.ticksPerSecond);
}
// What an order costs, squad by squad: one each; a formation one for up to three.
export function orderCosts(order,squadIds){
  const formation=!!ORDERS[order?.kind]?.formation;
  return Object.fromEntries(squadIds.map((id,i)=>[id,formation?(i===0?FORMATION_ORDER.cost:0):ORDERS[order?.kind]?.cost??1]));
}
// Squads in a connected group, each within `join` metres of another (§3.8): who
// joins a formation order, and who is left out.
export function formationGroup(world,squadIds){
  const squads=squadIds.map(id=>squadById(world,id)).filter(s=>commandable(world,s));if(!squads.length)return {joins:[],left:squadIds};
  const joins=[squads[0]];let grew=true;
  while(grew&&joins.length<FORMATION_ORDER.maxSquads){
    grew=false;
    for(const s of squads)if(!joins.includes(s)&&joins.some(j=>span(j.x-s.x,j.z-s.z)<=FORMATION_ORDER.join)&&joins.length<FORMATION_ORDER.maxSquads){joins.push(s);grew=true;}
  }
  return {joins:joins.map(s=>s.id),left:squadIds.filter(id=>!joins.some(s=>s.id===id))};
}
// Command set aside and not yet charged: orders queued or on their way.
export function reservedCommand(world){
  const round=roundNow(world);let n=0;
  for(const q of world.queue)if(q.kind==='order'&&q.payload.reserved?.round===round)n+=Object.values(q.payload.costs).reduce((a,b)=>a+b,0);
  for(const s of squadsOf(world))if(s.pending&&s.pending.round===round)n+=s.pending.cost;
  return n;
}

// What replacing the orders of these squads would give back: a point returns
// only when its whole order is replaced, and only from this round's pool. A
// formation's single point passes to the squads of its group still waiting.
function replaced(world,ids){
  const round=roundNow(world),gone=new Set(ids);let back=0;
  for(const q of world.queue){
    if(q.kind!=='order'||!q.payload.squads.some(id=>gone.has(id)))continue;
    const left=q.payload.squads.filter(id=>!gone.has(id)),cost=q.payload.squads.filter(id=>gone.has(id)).reduce((n,id)=>n+(q.payload.costs[id]??0),0);
    if(!left.length||!ORDERS[q.payload.order.kind]?.formation)back+=q.payload.reserved?.round===round?cost:0;
  }
  const groups=new Map();
  for(const s of squadsOf(world))if(s.pending){const g=s.pending.group??s.id;(groups.get(g)??groups.set(g,[]).get(g)).push(s);}
  for(const list of groups.values()){
    const out=list.filter(s=>gone.has(s.id)),cost=out.reduce((n,s)=>n+s.pending.cost,0);if(!out.length||!cost)continue;
    if(out.length===list.length||!ORDERS[list[0].pending.order.kind]?.formation)back+=list[0].pending.round===round?cost:0;
  }
  return back;
}

// Whether an order may be given now: null, or its reason code. payload:
// { squads:[ids], order:{ kind, x?, z?, targetId? } }. Pure.
export function orderProblem(world,payload){
  if(!world.command)return 'NO_SQUAD_SELECTED';
  const ids=Array.isArray(payload?.squads)?[...new Set(payload.squads)]:[];
  if(!ids.length)return 'NO_SQUAD_SELECTED';
  if(ids.some(id=>!commandable(world,squadById(world,id))))return 'NO_TARGET';
  const order=payload.order,kind=order?.kind,def=ORDERS[kind];if(!def)return 'NO_TARGET';
  if(def.formation){if(ids.length>FORMATION_ORDER.maxSquads)return 'SQUADS_TOO_FAR_APART';if(formationGroup(world,ids).left.length)return 'SQUADS_TOO_FAR_APART';}
  if(kind==='advance'&&!(Number.isFinite(order.x)&&Number.isFinite(order.z)))return 'NO_TARGET';
  if(kind==='attack'){
    const t=squadById(world,order.targetId)??actorById(world,order.targetId),side=t?.side;
    if(!t||(t.members?!fielded(world,t):!t.alive||t.down))return 'NO_TARGET';
    if(!hostile({side:'ally'},{side}))return 'FRIENDLY';
  }
  const cost=Object.values(orderCosts(order,ids)).reduce((a,b)=>a+b,0);
  if(world.command.left+replaced(world,ids)<cost)return 'NO_COMMAND';
  return null;
}

// Issue (from queueCommand): set the Command aside now. An order queued
// earlier for the same squads gives its points back (the latest wins), and a
// formation's point stays with the rest of its group.
export function reserveOrder(world,command){
  const p=command.payload,ids=[...new Set(p.squads)],round=roundNow(world),gone=new Set(ids);
  for(const q of world.queue){
    if(q.kind!=='order'||!q.payload.squads.some(id=>gone.has(id)))continue;
    const cost=q.payload.squads.filter(id=>gone.has(id)).reduce((n,id)=>n+(q.payload.costs[id]??0),0);
    for(const id of ids)delete q.payload.costs[id];q.payload.squads=q.payload.squads.filter(id=>!gone.has(id));
    if(q.payload.squads.length&&ORDERS[q.payload.order.kind]?.formation)q.payload.costs[q.payload.squads[0]]=(q.payload.costs[q.payload.squads[0]]??0)+cost;
    else if(q.payload.reserved?.round===round)world.command.left+=cost;
  }
  world.queue=world.queue.filter(q=>q.kind!=='order'||q.payload.squads.length);
  p.squads=ids;p.costs=orderCosts(p.order,ids);p.reserved={round};
  world.command.left-=Object.values(p.costs).reduce((a,b)=>a+b,0);
}
// At the tick boundary: each squad receives the order, to start after the delay.
// One still on its way to the same squad is replaced: its point comes back (this
// round's only), or stays with the rest of its formation group.
export function giveOrder(world,command){
  const p=command.payload,delay=orderDelayTicks(world),round=p.reserved?.round??roundNow(world),group=`o${command.seq}`;
  for(const id of p.squads){
    const squad=squadById(world,id);
    if(!commandable(world,squad)){if(round===roundNow(world))world.command.left+=p.costs[id]??0;continue;}
    if(squad.pending)release(world,squad);
    squad.pending={order:{...p.order},at:world.tick+delay,cost:p.costs[id]??0,round,group};
    emit(world,{kind:'order-given',squadId:id,order:p.order.kind});
  }
  world.command.left=Math.min(world.command.capacity,world.command.left);
}
function release(world,squad){
  const p=squad.pending;squad.pending=null;if(!p.cost)return;
  const heir=ORDERS[p.order.kind]?.formation?squadsOf(world).find(s=>s.pending&&s.pending.group===p.group):null;
  if(heir)heir.pending.cost+=p.cost;else if(p.round===roundNow(world))world.command.left+=p.cost;
}
// Each tick: orders whose delay has passed take effect. Restore morale and the
// formations act at once and leave the squad's current order as it was.
export function orderEffects(world,{carryOut}){
  for(const squad of squadsOf(world)){
    const p=squad.pending;if(!p||p.at>world.tick)continue;squad.pending=null;
    if(!fielded(world,squad))continue;
    emit(world,{kind:'order',squadId:squad.id,order:p.order.kind});carryOut(world,squad,p.order);
  }
}
// The round boundary: refill to capacity (points never accumulate).
export function refillCommand(world){
  if(!world.command)return;world.command.left=world.command.capacity;world.command.round=roundNow(world)+1;
  emit(world,{kind:'command-refill',left:world.command.left});
}
export {squadOf};

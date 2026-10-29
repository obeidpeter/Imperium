import {CARD,FORMATION_ORDER,HORSE_ORDERS,ORDERS} from '../../data/realtime-squads.js';
import {REASONS} from '../../data/realtime-rules.js';
import {actorById,hostile} from './abilities.js';
import {commandable,formationGroup,orderCosts,orderProblem,reservedCommand} from './command.js';
import {fielded,membersOf,squadById,squadCentre,squadOf,squadsOf} from './squads.js';
import {objectById} from './motion.js';
import {span} from './navigation.js';

// The squad controls (build brief §3.8 "Selection model", guide "Squads"):
// what a click, a tap or a key does to the selection of squads and which
// order it gives. Pure over the world and the page's selection (a list of
// squad ids, which is the page's and never in the world): every order still
// goes through queueCommand and its checks.

// The squads the soldier commands, in the squad bar's order (Shift+1–6).
export const commandSquads=world=>squadsOf(world).filter(s=>commandable(world,s));
// Drop squads that have fallen from a selection.
export const liveSelection=(world,selection)=>selection.filter(id=>commandable(world,squadById(world,id)));

// The selection after a choice:
//   { squadId }               a click on a standard: that squad only
//   { squadId, shift:true }   Shift+click: add it
//   { squadId, touch:true }   a tap on touch: add it
//   { index }                 Shift+1–6: toggle that squad in or out
//   { clear:true }            Esc, the Clear button, or the soldier's portrait
// In deployment one thing is chosen at a time: choosing selects, never adds.
export function selectSquads(world,selection,choice={},{deployment=false}={}){
  const current=liveSelection(world,selection);
  if(choice.clear)return [];
  const id=choice.index!==undefined?commandSquads(world)[choice.index]?.id:choice.squadId;
  if(!id||!commandable(world,squadById(world,id)))return current;
  if(deployment)return [id];
  if(choice.index!==undefined)return current.includes(id)?current.filter(x=>x!==id):[...current,id];
  if(choice.shift||choice.touch)return current.includes(id)?current:[...current,id];
  return [id];
}

// The squad a picked man belongs to, if it is ours: a click on him always selects, never attacks.
export function friendlyStandard(world,pick){
  const a=pick?.actorId?actorById(world,pick.actorId):null,s=a?squadOf(world,a):squadById(world,pick?.actorId);
  return s&&commandable(world,s)?s.id:null;
}

// What the right button (a tap on touch) does while squads are selected:
// ground advances, an enemy is attacked, the soldier draws them back to brace,
// a field object is marched to and held. { command, cursor, message, reason, order }.
export function orderIntent(world,selection,pick){
  const squads=liveSelection(world,selection);if(!squads.length)return null;
  let order=null;
  const a=pick?.actorId?actorById(world,pick.actorId):null,targetSquad=a?squadOf(world,a):squadById(world,pick?.actorId);
  if(a&&a.id===world.heroId)order={kind:'withdraw'};
  else if(targetSquad&&hostile({side:'ally'},targetSquad))order={kind:'attack',targetId:targetSquad.id};
  else if(a&&a.alive&&!a.down&&hostile({side:'ally'},a))order={kind:'attack',targetId:a.id};
  else if(pick?.objectId){const o=objectById(world,pick.objectId);if(o)order={kind:'advance',x:o.x,z:o.z,objectId:o.id};}
  else if(Number.isFinite(pick?.x)&&Number.isFinite(pick?.z))order={kind:'advance',x:pick.x,z:pick.z};
  if(!order)return {command:null,cursor:'blocked',message:REASONS.NO_TARGET,reason:'NO_TARGET'};
  return orderCommand(world,squads,order);
}
function orderCommand(world,squads,order){
  const payload={squads,order},reason=orderProblem(world,payload),cost=Object.values(orderCosts(order,squads)).reduce((a,b)=>a+b,0);
  const what=describeOrder(world,order,squads);
  if(reason)return {command:null,cursor:'blocked',message:`${what}: ${REASONS[reason]??reason}`,reason,order};
  return {command:{actorId:world.heroId,kind:'order',payload},cursor:['attack','charge'].includes(order.kind)?'order_attack':'order_advance',
    message:`${what} (${cost} Command).`,reason:null,order};
}
export function describeOrder(world,order,squads){
  const names=squads.map(id=>squadById(world,id)?.name??id),who=names.length>2?`${names.length} squads`:names.join(' and ');
  switch(order.kind){
    case 'advance':return `${who}: advance${order.objectId?` to ${objectById(world,order.objectId)?.name??'the object'} and hold`:' here'}`;
    case 'attack':{const t=squadById(world,order.targetId)??actorById(world,order.targetId);return `${who}: attack ${t?.name??'him'}`;}
    case 'charge':{const t=squadById(world,order.targetId)??actorById(world,order.targetId);return `${who}: charge ${t?.name??'the nearest enemy'}`;}
    default:return `${who}: ${(ORDERS[order.kind]?.name??order.kind).toLowerCase()}`;
  }
}

// The command card (keys 1–7 while squads are selected): Hold, Restore morale,
// Withdraw and brace, Line, Shield wall, Wedge, Lie in wait; and for horse (release 7)
// 8 and 9, Charge the nearest enemy group in sight and Feigned retreat. 0 does nothing.
const horse=squad=>HORSE_ORDERS.roles.includes(squad?.role);
function nearestEnemyGroup(world,squad){
  if(!squad)return null;const c=squadCentre(world,squad);
  return squadsOf(world).filter(q=>q.side==='enemy'&&fielded(world,q)&&!q.broken&&membersOf(world,q).some(a=>!a.hidden))
    .map(q=>({q,d:span(squadCentre(world,q).x-c.x,squadCentre(world,q).z-c.z)})).sort((a,b)=>a.d-b.d||(a.q.id<b.q.id?-1:1))[0]?.q??null;
}
export function cardOrder(world,selection,index){
  const squads=liveSelection(world,selection),kind=CARD[index];
  if(!squads.length)return {command:null,message:REASONS.NO_SQUAD_SELECTED,reason:'NO_SQUAD_SELECTED'};
  if(!kind)return {command:null,message:`The command card has ${CARD.length} orders: 1 to ${CARD.length}.`,reason:'NO_TARGET'};
  if(kind==='charge'){const t=nearestEnemyGroup(world,squadById(world,squads[0]));
    if(!t)return {command:null,cursor:'blocked',message:`${describeOrder(world,{kind},squads)}: ${REASONS.NO_TARGET}`,reason:'NO_TARGET',order:{kind}};
    return orderCommand(world,squads,{kind,targetId:t.id});}
  return orderCommand(world,squads,{kind});
}
// Who joins a formation order and who is left out, before it is given (§3.8 "Formation preview").
export function formationPreview(world,selection){
  const squads=liveSelection(world,selection),group=formationGroup(world,squads);
  const names=ids=>ids.map(id=>squadById(world,id)?.name??id);
  return {joins:names(group.joins),left:names(group.left),max:FORMATION_ORDER.maxSquads,cost:FORMATION_ORDER.cost};
}
// The card's buttons as the HUD shows them.
export function cardButtons(world,selection){
  const squads=liveSelection(world,selection),preview=formationPreview(world,selection),mounted=squads.some(id=>horse(squadById(world,id)));
  // The horse's orders show only while a squad of horse is selected; their keys stay 8 and 9.
  return CARD.map((kind,i)=>[kind,i]).filter(([kind])=>!ORDERS[kind].horse||mounted).map(([kind,i])=>{
    const r=cardOrder(world,squads,i),def=ORDERS[kind];
    const note=def.formation?(preview.left.length?`${preview.joins.join(', ')} join; ${preview.left.join(', ')} left out`
      :preview.joins.length>1?`${preview.joins.length} squads, 1 Command`:'1 Command'):`${squads.length} Command`;
    return {kind,key:i+1,name:def.name,summary:def.summary,note,ok:!r.reason,reason:r.reason,message:r.message,command:r.command};
  });
}
// Command as the pips show it: capacity, what is left, and what is set aside on its way.
export function commandPips(world){
  const c=world.command;if(!c)return null;const reserved=reservedCommand(world);
  return {capacity:c.capacity,left:c.left,reserved,text:`Command ${c.left} of ${c.capacity}${reserved?`, ${reserved} on its way`:''}`};
}
// The order marker (arrow keys while squads are selected): Enter advances to it,
// or attacks the target chosen with T.
export function markerOrder(world,selection,{marker,targetId=null}){
  const squads=liveSelection(world,selection);if(!squads.length)return null;
  const t=targetId?actorById(world,targetId):null;
  if(t&&t.alive&&!t.down&&hostile({side:'ally'},t)){const sq=squadOf(world,t);return orderCommand(world,squads,{kind:'attack',targetId:sq?.id??t.id});}
  if(!marker)return {command:null,message:'Move the order marker with the arrow keys, then press Enter.',reason:'NO_TARGET'};
  return orderCommand(world,squads,{kind:'advance',x:marker.x,z:marker.z});
}
// A squad's state in words (the squad bar, the Command list and screen readers).
export function squadState(world,squad){
  const men=squad.members.filter(id=>{const m=actorById(world,id);return m?.alive;}).length;
  const morale=squad.broken?'broken':squad.morale<=40?'shaken':'steady';
  return `${squad.name}: ${men} of ${squad.maxMen} men, morale ${Math.round(squad.morale)} (${morale}), cohesion ${Math.round(squad.cohesion)}`+
    `${Math.floor(squad.suppression)?`, suppression ${Math.floor(squad.suppression)}`:''}${squad.formation?`, ${ORDERS[squad.formation].name.toLowerCase()}`:''}`+
    `${squad.braced?', braced':''}${squad.pending?`; ${ORDERS[squad.pending.order.kind]?.name.toLowerCase()} on its way`:''}.`;
}
// A squad's orders as the Command list gives them (guide "Command list": choose
// who acts, the order and the target, then Use): the card's six orders, a
// formation with the squads near it, an advance to the objective, a position or
// the soldier's side, and an attack on each enemy in sight, nearest first. The
// same options shape as commandOptions; every order is checked as a click's is.
export function squadOrderOptions(world,{squadId}={}){
  const squad=squadById(world,squadId),out=[];if(!squad||!commandable(world,squad))return out;
  const centre=squadCentre(world,squad),m=n=>`${Math.round(n)} m`,away=p=>span(p.x-centre.x,p.z-centre.z);
  const add=(group,label,ids,order,{detail='',subject=null}={})=>{
    const payload={squads:ids,order},reason=orderProblem(world,payload),cost=Object.values(orderCosts(order,ids)).reduce((a,b)=>a+b,0);
    out.push({group,label,subject,command:reason?null:{actorId:world.heroId,kind:'order',payload},reason,
      message:reason?REASONS[reason]??'That cannot be given now.':null,detail:`${cost} Command.${detail?` ${detail}`:''}`});
  };
  const group=formationGroup(world,[squad.id,...commandSquads(world).filter(s=>s.id!==squad.id).sort((a,b)=>away(a)-away(b)).map(s=>s.id)]).joins;
  for(const kind of CARD){
    const def=ORDERS[kind];if(def.horse&&!horse(squad))continue;
    if(def.formation&&group.length>1)add('Orders',`${def.name} with ${group.slice(1).map(id=>squadById(world,id).name).join(' and ')}`,group,{kind},{detail:def.summary});
    if(kind==='charge')continue;
    add('Orders',def.name,[squad.id],{kind},{detail:kind===CARD[0]?squadState(world,squad):def.summary});
  }
  // A feigned retreat toward the objective marker: where the enemy's horse is to be drawn.
  if(horse(squad)&&world.mission?.goal)add('Orders','Feigned retreat to the objective marker',[squad.id],{kind:'feigned_retreat',x:world.mission.goal.x,z:world.mission.goal.z},
    {detail:`${m(away(world.mission.goal))}. ${ORDERS.feigned_retreat.summary}`});
  const places=[];
  if(world.mission?.goal)places.push({name:'the objective marker',x:world.mission.goal.x,z:world.mission.goal.z});
  for(const p of world.mission?.points??[])if(!p.secured)places.push({name:'a position to secure',x:p.x,z:p.z});
  const hero=actorById(world,world.heroId);if(hero?.alive&&!hero.down)places.push({name:`beside ${hero.name}`,x:hero.x,z:hero.z});
  for(const o of (world.objects??[]).filter(o=>!o.done||o.toggle))places.push({name:o.name,x:o.x,z:o.z,objectId:o.id});
  for(const p of places)add('Advance',`Advance to ${p.name}`,[squad.id],{kind:'advance',x:p.x,z:p.z,...(p.objectId?{objectId:p.objectId}:{})},{detail:m(away(p))});
  const foes=[...squadsOf(world).filter(q=>q.side==='enemy'&&fielded(world,q)&&membersOf(world,q).some(a=>!a.hidden)).map(q=>({id:q.id,name:q.name,at:squadCentre(world,q)})),
    ...world.actors.filter(a=>!a.squadId&&a.alive&&!a.down&&!a.hidden&&hostile({side:'ally'},a)).map(a=>({id:a.id,name:a.name,at:a}))].sort((a,b)=>away(a.at)-away(b.at));
  for(const f of foes){add('Attack',`Attack ${f.name}`,[squad.id],{kind:'attack',targetId:f.id},{subject:f.id,detail:m(away(f.at))});
    if(horse(squad))add('Attack',`Charge ${f.name}`,[squad.id],{kind:'charge',targetId:f.id},{subject:f.id,detail:`${m(away(f.at))}. ${ORDERS.charge.summary}`});}
  return out;
}
export {fielded};

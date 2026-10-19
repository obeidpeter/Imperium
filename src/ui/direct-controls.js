import * as Game from '../core/game.js';
import {INTEREST_EFFECTS,BLOC_AFFINITIES} from '../data/contest-balance.js';
import {actionNames} from './view-helpers.js';

const alive=u=>(u.resolve??u.hp??0)>0;
const tile=p=>`${p.x+1}${String.fromCharCode(65+p.y)}`;
export const samePoint=(a,b)=>!!a&&!!b&&a.x===b.x&&a.y===b.y;
export function visibleUnitAt(encounter,point){
  return encounter?.units?.find(u=>!u.hidden&&alive(u)&&samePoint(u,point))??null;
}

// Intention only: clicking never bypasses the rules or spends anything an
// earlier preview did not show. Moving is the one command a single click
// commits: with no other command chosen, a click on ground walks there, or as
// far toward it as the rules allow this turn (`kind:'move'`), through the
// ordinary legal move command, and Undo Move takes it back until the unit
// acts. Every other command previews first and commits only on a second
// deliberate activation (or Confirm). `moveOnClick:false` previews moves too,
// far ground included: the preview is the stop, and the same stop confirms.
export function directIntent(state,{selected='hero',action=null,target=null,point,moveOnClick=true}={}){
  const e=state?.encounter;
  if(!e||e.status!=='active'||!point||point.x<0||point.y<0||point.x>=e.width||point.y>=e.height)return {kind:'none'};
  const unit=visibleUnitAt(e,point),actions=Game.getActions(state,selected);
  const legal=a=>actions.includes(a)?Game.getTargets(state,selected,a).find(t=>samePoint(t,point)&&(!t.unitId||!unit||t.unitId===unit.id)):null;
  const moving=!action||action==='move',walk=moveOnClick&&moving;
  const explicit=action&&legal(action);
  if(explicit&&action==='move'&&walk)return walkTo(state,selected,explicit);
  if(explicit)return {kind:samePoint(target,explicit)?'confirm':'preview',action,target:explicit};
  if(unit&&['player','ally'].includes(unit.side))return {kind:'select',unitId:unit.id};
  const preferred=unit
    ?e.kind==='contest'?(unit.role==='voter'?['persuade','record','address','promise']:['denounce','rebut']):['strike','throw']
    :['move'];
  for(const candidate of preferred){
    const t=legal(candidate);if(!t)continue;
    if(e.kind==='contest'&&unit?.role==='voter'){
      const preview=Game.preview(state,{unitId:selected,action:candidate,x:t.x,y:t.y,targetId:t.unitId});
      // Reinforcing an existing vote is useful; repeating a capped argument is
      // not. Historical saves lack forecasts, so retain their stance-cap guard.
      if(!preview.ok||(preview.forecast
        ?!preview.forecast.stanceChanges.some(change=>change.to>change.from)
        :unit.stance>=6))continue;
    }
    if(candidate==='move'&&walk)return walkTo(state,selected,t);
    return {kind:'preview',action:candidate,target:t};
  }
  // Ground beyond this turn's reach: walk as far toward it as the rules allow.
  if(!unit&&moving&&actions.includes('move')){
    const route=Game.moveRoute(state,selected,point),stop=route?.stop&&{x:route.stop.x,y:route.stop.y,cost:route.stop.cost};
    if(stop&&walk)return {kind:'move',action:'move',target:stop,goal:{x:point.x,y:point.y},route};
    if(stop)return {kind:action==='move'&&samePoint(target,stop)?'confirm':'preview',action:'move',target:stop};
  }
  return {kind:'inspect',unitId:unit?.id??null,point:{x:point.x,y:point.y}};
}
function walkTo(state,selected,t){return {kind:'move',action:'move',target:t,goal:{x:t.x,y:t.y},route:Game.moveRoute(state,selected,t)};}

// What walking to `point` would do, in words for the board readout and screen
// readers ('' when there is nothing to say, such as over a unit).
export function routeSummary(route){
  if(!route)return '';
  if(route.stop)return route.reachable?`Walk here · ${route.cost} movement`:`Beyond reach · stops at ${tile(route.stop)} this turn`;
  return {moved:'Movement already spent this turn',blocked:'Impassable ground',unreachable:'No route from here','no-closer':'No nearer ground this turn'}[route.reason]??'';
}

export function nextReadyUnit(state,selected='hero'){
  const units=(state?.encounter?.units||[]).filter(u=>!u.hidden&&alive(u)&&['player','ally'].includes(u.side)&&Game.getActions(state,u.id).length);
  if(!units.length)return selected;
  const i=units.findIndex(u=>u.id===selected);
  return units[(i+1)%units.length].id;
}

export function keyboardAction(key,actions){
  return /^[1-9]$/.test(key)?actions[Number(key)-1]??null:null;
}

export function actionCostLabel(state,unit,action){
  if(action==='move'||action==='deploy')return '1 move';
  if(action==='order'||action==='formation')return '1 order';
  if(['guard','inspire','volley'].includes(action))return '1 order · specialist';
  if(action==='throw')return `1 action · 1 javelin (${unit?.ammo??0} left)`;
  if(state?.encounter?.kind==='contest'){
    if(action==='promise')return `1 speech · promise (${Math.max(0,2-(state.encounter.promises?.length||0))} left)`;
    if(action==='threaten')return '1 speech · −3 Public';
    if(action==='address')return '1 speech · 3-turn cooldown';
    return '1 speech';
  }
  return '1 action';
}

export function explainActionTargetGap(state,unitId,action){
  const e=state?.encounter;
  if(!e||!action)return 'No target in reach. Move closer, choose another command, or end the turn.';
  const reasons={
    strike:'No target in reach: no visible enemy on an adjacent tile (range 1). Move closer, choose another command, or end the turn.',
    throw:'No target in reach: no visible enemy within 3 tiles with clear line of sight. Move closer, choose another command, or end the turn.',
    assist:'No target in reach: no allied or escort unit on an adjacent tile (range 1). Move beside them first, or choose another command.',
    order:'No target in reach: all living allies have already received an order this turn.',
    formation:'No target in reach: all living allies have already received an order this turn.',
    persuade:'No target in reach: no delegate on an adjacent tile (range 1). Move beside a delegate or choose a longer-range appeal.',
    promise:(e.promises?.length||0)>=2?'No target in reach: maximum 2 promises already used in this Contest. Choose another appeal.':'No target in reach: no unpromised delegate within 2 tiles. Move closer or choose another appeal.',
    threaten:'No target in reach: no delegate within 2 tiles. Move closer or choose another appeal.',
    record:'No target in reach: no eligible delegate within 3 tiles (each delegate can hear your Record once per Contest).',
    denounce:'No target in reach: no active rival speaker within 3 tiles.',
    rebut:'No target in reach: no speaker within 3 tiles.',
  };
  return reasons[action]||'No target in reach. Move closer, choose another command, or end the turn.';
}

export function explainUnavailableActions(state,unitId='hero'){
  const e=state?.encounter;
  if(state?.phase!=='encounter'||!e||e.status!=='active')return [];
  const unit=e.units.find(u=>u.id===unitId)||e.units.find(u=>u.id==='hero');
  if(!unit)return [];
  const available=Game.getActions(state,unit.id),items=[];
  if(e.kind==='battle'){
    if(unit.side==='ally'){
      if(state.chapter<4&&!available.length)items.push({id:'order',label:'Direct order',reason:'Unlocks in Chapter IV (companion acts on own orders)'});
      else if(unit.ordered)items.push({id:'order',label:'Order',reason:'Already received an order this turn'});
      else if((e.commandsLeft??0)<=0)items.push({id:'order',label:'Order',reason:`Requires 1 order (0 of ${e.commandCapacity||0} remaining)`});
      return items;
    }
    if(unit.moved)items.push({id:'move',label:'Move',reason:'Already moved this turn'});
    if(unit.acted)items.push({id:'strike',label:'Personal action',reason:'Already used personal action this turn'});
    else{
      if((unit.ammo??0)<=0)items.push({id:'throw',label:'Throw javelin',reason:'No javelins remaining (0 ammo)'});
      for(const a of ['strike','throw','assist']){
        if(available.includes(a)&&!Game.getTargets(state,unit.id,a).length){
          items.push({id:a,label:actionNames[a]||a,reason:a==='strike'?'No visible enemy within 1 tile':a==='throw'?'No visible enemy within 3 tiles in line of sight':'No comrade or escort within 1 tile'});
        }
      }
    }
    if(state.chapter>=4&&(e.commandsLeft??0)<=0)items.push({id:'order',label:state.chapter>=5?'Order / Formation':'Order',reason:`Requires 1 order (0 of ${e.commandCapacity||0} remaining)`});
    return items;
  }
  if(!alive(unit)){
    items.push({id:'speech',label:'Speech',reason:'Speaker has withdrawn (0 Resolve); their vote still counts'});
    return items;
  }
  if(unit.moved)items.push({id:'move',label:'Move',reason:'Already moved this turn'});
  if(unit.acted)items.push({id:'persuade',label:'Speech',reason:'Already spoke this turn'});
  else{
    const cd=e.cooldowns?.[`${unit.id}:address`];
    if(state.chapter>=10&&cd&&cd>e.turn)items.push({id:'address',label:'Address chamber',reason:`Cooldown: available again on turn ${cd}`});
    if(state.chapter>=8&&(e.promises?.length||0)>=2)items.push({id:'promise',label:'Promise',reason:'Promise limit reached (2 of 2 used this Contest)'});
    for(const a of available.filter(x=>x!=='move')){
      if(!Game.getTargets(state,unit.id,a).length&&(a!=='promise'||(e.promises?.length||0)<2)){
        items.push({id:a,label:actionNames[a]||a,reason:a==='persuade'?'No delegate within 1 tile':a==='promise'?'No unpromised delegate within 2 tiles':a==='threaten'?'No delegate within 2 tiles':a==='record'?'No eligible delegate within 3 tiles (1 per delegate)':a==='denounce'?'No rival speaker within 3 tiles':'No speaker within 3 tiles'});
      }
    }
  }
  return items;
}

export function formationRosterPreview(state,targetUnitId,formationKind='shield-wall'){
  const e=state?.encounter;
  if(!e||e.kind!=='battle')return null;
  const anchor=e.units.find(u=>u.id===targetUnitId&&u.side==='ally'&&alive(u));
  if(!anchor)return null;
  const adj=e.units.filter(u=>u.side==='ally'&&u.id!==anchor.id&&alive(u)&&Math.abs(u.x-anchor.x)+Math.abs(u.y-anchor.y)<=1&&!u.ordered);
  const participants=[anchor,...adj].slice(0,3);
  const participantIds=new Set(participants.map(u=>u.id));
  const excluded=e.units.filter(u=>u.side==='ally'&&alive(u)&&!participantIds.has(u.id)).map(u=>({
    id:u.id,
    name:u.name,
    x:u.x,
    y:u.y,
    reason:u.ordered?'already ordered this turn':Math.abs(u.x-anchor.x)+Math.abs(u.y-anchor.y)>1?'more than 1 tile from anchor unit':'3-unit formation cap reached',
  }));
  const joinedText=`Joining ${formationKind} (${participants.length}/3): ${participants.map(u=>`${u.name} (${tile(u)})`).join(', ')}.`;
  const excludedText=excluded.length?` Excluded: ${excluded.map(u=>`${u.name} (${u.reason})`).join('; ')}.`:'';
  return {anchor,participants,excluded,summary:joinedText+excludedText};
}

export function delegateAppealSummary(delegate,politicsVersion=2){
  if(!delegate||delegate.role!=='voter')return '';
  const interest=delegate.interest||'security',effects=INTEREST_EFFECTS[interest]||INTEREST_EFFECTS.security;
  const blocBonus=politicsVersion===2?(BLOC_AFFINITIES[delegate.bloc]||{}):{};
  const appeals=['persuade','promise','record','address','threaten'].map(action=>({
    action,
    label:actionNames[action]||action,
    score:Math.max(1,(effects[action]??2)+(blocBonus[action]??0)),
  })).sort((a,b)=>b.score-a.score);
  const top=appeals.slice(0,2).map(a=>`${a.label} (+${a.score})`).join(', ');
  return `Strongest appeals: ${top}`;
}

export function unusedTurnSummary(state){
  const e=state?.encounter;
  if(state?.phase!=='encounter'||!e||e.status!=='active')return {readyUnits:[],hasUnusedAction:false,hasUnusedOrder:false,message:'Encounter resolved'};
  const controllable=e.units.filter(u=>['player','ally'].includes(u.side)&&alive(u)&&!u.hidden);
  const readyUnits=controllable.filter(u=>{
    const acts=Game.getActions(state,u.id);
    if(!acts.length)return false;
    if(e.kind==='battle'&&u.side==='ally'&&state.chapter>=4&&!u.specialization)return false;
    return true;
  }).map(u=>{
    const acts=Game.getActions(state,u.id);
    const parts=[];
    if(acts.includes('move')||acts.includes('deploy'))parts.push('move');
    if(acts.some(a=>!['move','deploy','order','formation'].includes(a)))parts.push(e.kind==='contest'?'speech':'action');
    if(u.id==='hero'&&(e.commandsLeft??0)>0&&acts.some(a=>['order','formation'].includes(a)))parts.push(`${e.commandsLeft} order${e.commandsLeft===1?'':'s'}`);
    return {id:u.id,name:u.name,parts};
  }).filter(u=>u.parts.length>0);
  const hasUnusedAction=readyUnits.some(u=>u.parts.includes('action')||u.parts.includes('speech'));
  const hasUnusedOrder=(e.commandsLeft??0)>0&&e.units.some(u=>u.side==='ally'&&alive(u)&&!u.ordered);
  const message=readyUnits.length
    ?`Still available this turn: ${readyUnits.map(u=>`${u.name} (${u.parts.join(', ')})`).join('; ')}.`
    :'All personal moves and actions spent this turn.';
  return {readyUnits,hasUnusedAction,hasUnusedOrder,message};
}


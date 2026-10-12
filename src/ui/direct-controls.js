import * as Game from '../core/game.js';

const alive=u=>(u.resolve??u.hp??0)>0;
export const samePoint=(a,b)=>!!a&&!!b&&a.x===b.x&&a.y===b.y;
export function visibleUnitAt(encounter,point){
  return encounter?.units?.find(u=>!u.hidden&&alive(u)&&samePoint(u,point))??null;
}

// Intention only: clicking never bypasses the authoritative preview or spends
// an action. The UI commits only a second deliberate activation of a preview.
export function directIntent(state,{selected='hero',action=null,target=null,point}={}){
  const e=state?.encounter;
  if(!e||e.status!=='active'||!point||point.x<0||point.y<0||point.x>=e.width||point.y>=e.height)return {kind:'none'};
  const unit=visibleUnitAt(e,point),actions=Game.getActions(state,selected);
  const legal=a=>actions.includes(a)?Game.getTargets(state,selected,a).find(t=>samePoint(t,point)&&(!t.unitId||!unit||t.unitId===unit.id)):null;
  const explicit=action&&legal(action);
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
    return {kind:'preview',action:candidate,target:t};
  }
  return {kind:'inspect',unitId:unit?.id??null,point:{x:point.x,y:point.y}};
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

import {ABILITIES,COMBAT,MISSILES,REASONS} from '../../data/realtime-rules.js';
import {blowForecast,blowSetup,shieldOf} from './combat.js';
import {groundHeight,navGrid,span} from './navigation.js';

// Abilities (§3.6): validate() and forecast() are pure, for the UI and the
// simulation alike; neither ever changes the world or draws a random number.
// A target is {actorId} for a person, {x, z} for ground, or {} for none.

export const actorById=(world,id)=>world.actors.find(a=>a.id===id)??null;
export const hostile=(a,b)=>!!a&&!!b&&a.side!==b.side&&(a.side==='enemy'||b.side==='enemy');
export const staggered=(world,a)=>a.staggerUntil>world.tick;
export const busy=(world,a)=>!!a.action||a.readyAt>world.tick;
export const distanceBetween=(a,b)=>span(b.x-a.x,b.z-a.z);
// The range of a thrown missile: a fifth farther downhill (§3.5 step 8).
export function missileRange(world,actor,missile,point){
  const grid=navGrid(world.map),drop=groundHeight(grid,actor.x,actor.z)-groundHeight(grid,point.x,point.z);
  return MISSILES[missile].range*(drop>=COMBAT.heightStep?1.2:1);
}

export function validate(world,actorId,abilityId,target={}){
  const ability=ABILITIES[abilityId],actor=actorById(world,actorId);
  if(!ability)return 'NO_TARGET';
  if(world.status!=='active')return 'BATTLE_OVER';
  if(!actor?.alive)return 'ACTOR_DOWN';
  if(staggered(world,actor))return 'STAGGERED';
  const other=target.actorId?actorById(world,target.actorId):null;
  if(target.actorId&&!other)return 'NO_TARGET';
  if(other&&!other.alive)return 'TARGET_DOWN';
  if(abilityId==='strike'){
    if(!other)return 'NO_TARGET';if(!hostile(actor,other)&&!target.forced)return 'NOT_HOSTILE';return null;
  }
  if(abilityId==='brace'){
    if(!shieldOf(actor))return 'NO_SHIELD';if(actor.stamina<(ability.cost.stamina??0))return 'NOT_ENOUGH_STAMINA';return null;
  }
  if(ability.effects?.[0]?.type==='missile'){
    const missile=ability.effects[0].missile,kind=ability.cost.ammo;
    if(!((actor.ammo?.[kind]??0)>0))return 'NO_AMMO';
    const point=other??(Number.isFinite(target.x)&&Number.isFinite(target.z)?target:null);
    if(!point)return 'NO_TARGET';if(other&&!hostile(actor,other)&&!target.forced)return 'NOT_HOSTILE';
    if((actor.cooldowns?.[abilityId]??0)>world.tick)return 'RECOVERING';
    if(distanceBetween(actor,point)>missileRange(world,actor,missile,point))return 'OUT_OF_RANGE';
    return null;
  }
  return 'NO_TARGET';
}

// What using the ability would do: the cost, range, reason it cannot, and
// for a blow the full forecast (hit, block, damage and every modifier).
export function forecast(world,actorId,abilityId,target={}){
  const ability=ABILITIES[abilityId],actor=actorById(world,actorId),reason=validate(world,actorId,abilityId,target);
  const out={abilityId,name:ability?.name??abilityId,ok:!reason,reason,message:reason?REASONS[reason]:null,cost:ability?.cost??{},range:ability?.range_m??null};
  const other=target.actorId?actorById(world,target.actorId):null;
  if(!actor||!other||!other.alive||!['strike'].includes(abilityId)&&ability?.effects?.[0]?.type!=='missile')return out;
  const missile=abilityId==='strike'?null:ability.effects[0].missile;
  return {...out,distance:distanceBetween(actor,other),blow:blowForecast(blowSetup(world,actor,other,{missile}))};
}

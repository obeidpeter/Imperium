import {ABILITIES,COMBAT,MISSILES,REASONS} from '../../data/realtime-rules.js';
import {blowForecast,blowSetup,derivedValues,shieldOf} from './combat.js';
import {groundHeight,navGrid,span} from './navigation.js';
import {SPECIAL,validateSpecial} from './specialists.js';
import {onTower} from './fortifications.js';
import {STRUCTURES} from '../../data/structures.js';

// Abilities (§3.6): validate() and forecast() are pure, for the UI and the
// simulation alike; neither ever changes the world or draws a random number.
// A target is {actorId} for a person, {x, z} for ground, or {} for none.

// Actors by id, indexed once per actor list (rebuilt when a man joins; the dead stay listed).
const byId=new WeakMap();
export function actorById(world,id){
  const list=world.actors;let index=byId.get(list);
  if(!index||index.size!==list.length||index.get(list[list.length-1]?.id)!==list[list.length-1]){index=new Map(list.map(a=>[a.id,a]));byId.set(list,index);}
  return index.get(id)??null;
}
// A parley's envoy (the finale's settlement) is no one's enemy.
export const hostile=(a,b)=>!!a&&!!b&&a.side!==b.side&&(a.side==='enemy'||b.side==='enemy')&&!a.parley&&!b.parley;
export const staggered=(world,a)=>a.staggerUntil>world.tick;
export const busy=(world,a)=>!!a.action||a.readyAt>world.tick;
export const distanceBetween=(a,b)=>span(b.x-a.x,b.z-a.z);
// The range of a thrown missile: a fifth farther downhill (§3.5 step 8).
export function missileRange(world,actor,missile,point){
  const grid=navGrid(world.map),drop=groundHeight(grid,actor.x,actor.z)-groundHeight(grid,point.x,point.z);
  // From a tower's deck further than from any other rise (structures.js).
  return MISSILES[missile].range*(drop>=COMBAT.heightStep?onTower(world,actor)?STRUCTURES.tower.range:1.2:1);
}

const recovering=(world,actor,id)=>(actor.cooldowns?.[id]??0)>world.tick;
// A comrade who can be lifted: down, or a wounded man who cannot walk.
export const liftable=o=>o.alive&&!o.carriedBy&&(o.down||o.escort?.wounded&&!o.escort.escorted);
export const campCareAbility=id=>id==='bind_wounds'||id==='carry';

export function validate(world,actorId,abilityId,target={}){
  const ability=ABILITIES[abilityId],actor=actorById(world,actorId);
  if(!ability)return 'NO_TARGET';
  if(world.status!=='active')return 'BATTLE_OVER';
  if(!actor?.alive||actor.down)return 'ACTOR_DOWN';
  // Safe staging areas reject combat techniques and every forced
  // person target before costs or RNG are used. Even a self/ally technique
  // must not reach applyCommand's neutral-target provocation through a
  // forged target payload (for example Brace with forced: true).
  if(world.kind==='camp'&&world.peaceful===true&&(!campCareAbility(abilityId)||target.forced&&target.actorId))return 'PEACEFUL_CAMP';
  if(staggered(world,actor))return 'STAGGERED';
  if(actor.abilities&&!actor.abilities.includes(abilityId))return 'NOT_LEARNT';
  const other=target.actorId?actorById(world,target.actorId):null;
  if(target.actorId&&!other)return 'NO_TARGET';
  if(other&&!other.alive)return 'TARGET_DOWN';
  if(other?.hidden&&hostile(actor,other))return 'NO_TARGET';
  if(abilityId==='strike'){
    if(!other)return 'NO_TARGET';if(other.down)return 'TARGET_DOWN';if(!hostile(actor,other))return other.side!=='neutral'?'FRIENDLY':target.forced?null:'NOT_HOSTILE';return null;
  }
  if(actor.carrying&&abilityId!=='carry')return 'CARRYING';
  if(SPECIAL.has(abilityId))return validateSpecial(world,actor,abilityId,other);
  if(abilityId==='brace'){
    if(!shieldOf(actor))return 'NO_SHIELD';if(actor.stamina<(ability.cost.stamina??0))return 'NOT_ENOUGH_STAMINA';return null;
  }
  if(abilityId==='bind_wounds'){
    const patient=other??actor;
    if(hostile(actor,patient))return 'NOT_FRIENDLY';if(!patient.down&&patient.hp>=patient.maxHp)return 'NOT_WOUNDED';
    if((actor.bandages??0)<=0)return 'NO_BANDAGES';if(recovering(world,actor,abilityId))return 'RECOVERING';return null;
  }
  if(abilityId==='carry'){
    if(actor.carrying)return null;
    if(actor.drawn)return 'NEEDS_SHEATHED';if(!other||hostile(actor,other))return 'NO_TARGET';if(!liftable(other))return 'NOT_FALLEN';return null;
  }
  if(abilityId==='scout'){
    if(recovering(world,actor,abilityId))return 'RECOVERING';if(actor.stamina<(ability.cost.stamina??0))return 'NOT_ENOUGH_STAMINA';return null;
  }
  if(abilityId==='shield_bash'){
    if(!shieldOf(actor))return 'NO_SHIELD';if(!other)return 'NO_TARGET';if(!hostile(actor,other)&&(other.side!=='neutral'||!target.forced))return other.side!=='neutral'?'FRIENDLY':'NOT_HOSTILE';
    if(recovering(world,actor,abilityId))return 'RECOVERING';if(actor.stamina<(ability.cost.stamina??0))return 'NOT_ENOUGH_STAMINA';return null;
  }
  if(ability.effects?.[0]?.type==='missile'){
    const missile=ability.effects[0].missile,kind=ability.cost.ammo;
    if(!((actor.ammo?.[kind]??0)>0))return 'NO_AMMO';
    const point=other??(Number.isFinite(target.x)&&Number.isFinite(target.z)?target:null);
    if(!point)return 'NO_TARGET';if(other&&!hostile(actor,other)&&(other.side!=='neutral'||!target.forced))return other.side!=='neutral'?'FRIENDLY':'NOT_HOSTILE';
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
  const type=ability?.effects?.[0]?.type;
  if(abilityId==='bind_wounds'&&actor){
    const patient=other??actor,heal=Math.max(1,Math.floor(patient.maxHp*(actor.effects?.bindWounds??ability.effects[0].fraction)));
    return {...out,heal,patientId:patient.id,bandages:actor.bandages??0};
  }
  if(!actor||!other||!other.alive||!['strike'].includes(abilityId)&&type!=='missile'&&type!=='bash')return out;
  const ranged=abilityId==='strike'?derivedValues(actor).weapon.ranged:null;
  const missile=abilityId==='strike'?ranged&&(ranged.ammo===null||(actor.ammo?.[ranged.ammo]??0)>0)?ranged.missile:null:type==='missile'?ability.effects[0].missile:null;
  const profile=type==='bash'?ability.effects[0].damage:null;
  return {...out,distance:distanceBetween(actor,other),blow:blowForecast(blowSetup(world,actor,other,{missile,profile}))};
}

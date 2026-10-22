import {ABILITIES,COMBAT,MISSILES,TIME} from '../../data/realtime-rules.js';
import {clampToMap,navGrid,span} from './navigation.js';
import {derivedValues} from './combat.js';
import {actorById,distanceBetween,hostile,staggered,validate} from './abilities.js';
import {facingWithin,helpless,inReach,objectById,orderRange,reachOf,turnToward} from './motion.js';
import {useSpecial} from './specialists.js';
import {fieldProblem,useFieldObject} from './field-objects.js';

// System 4 (§3.1): swing timers (contact at half the swing), casts, shots and
// timed work (Bind wounds, objects), with recovery after each. Starting an
// action spends nothing; what it costs is spent when it takes effect.

const ticksOf=seconds=>Math.round(seconds*TIME.ticksPerSecond),DT=1/TIME.ticksPerSecond;
const emit=(world,event)=>{world.events.push({tick:world.tick,...event});};
export const used=(world,actor,capability)=>{if(actor.id===world.heroId&&!world.used.includes(capability))world.used.push(capability);};

export function cancelAction(world,actor){
  if(!actor.action)return;
  // An interrupted swing still owes its recovery; nothing it would have spent is spent.
  if(['swing','shot','bash'].includes(actor.action.kind))actor.readyAt=Math.max(actor.readyAt,world.tick+derivedValues(actor).recoveryTicks);
  if(actor.action.kind==='work')emit(world,{kind:'work-stopped',actorId:actor.id,what:actor.action.what});
  actor.action=null;
}
const rangedOf=actor=>{const r=derivedValues(actor).weapon.ranged;return r&&(r.ammo===null||(actor.ammo?.[r.ammo]??0)>0)?r:null;};

export function act(world){
  for(const actor of world.actors){
    if(helpless(actor)||staggered(world,actor))continue;
    const order=actor.order,action=actor.action;
    if(action){progress(world,actor,action);continue;}
    if(world.tick<actor.readyAt)continue;
    if(order?.kind==='attack'&&actor.drawn)startAttack(world,actor,order);
    else if(order?.kind==='ability')startAbility(world,actor,order);
    else if(order?.kind==='interact')startInteraction(world,actor,order);
  }
}

function startAttack(world,actor,order){
  const target=actorById(world,order.targetId);if(!target?.alive||target.down&&!order.forced)return;
  const ranged=rangedOf(actor),d=distanceBetween(actor,target);
  if(ranged?d>ranged.range:!inReach(actor,target))return;
  turnToward(actor,target.x-actor.x,target.z-actor.z);if(!facingWithin(actor,target,ranged?.7:.5))return;
  const swing=derivedValues(actor).swingTicks;actor.braceUntil=0;
  if(ranged){
    actor.action={kind:'shot',targetId:target.id,missile:ranged.missile,ammo:ranged.ammo,start:world.tick,release:world.tick+Math.round(swing*.7),end:world.tick+swing};
    emit(world,{kind:'draw-bow',actorId:actor.id,targetId:target.id});
  }else{
    actor.action={kind:'swing',targetId:target.id,start:world.tick,contact:world.tick+Math.round(swing*COMBAT.contact),end:world.tick+swing};
    emit(world,{kind:'swing',actorId:actor.id,targetId:target.id});
  }
  if(hostile(actor,target))used(world,actor,'strike');
}

function startAbility(world,actor,order){
  const ability=ABILITIES[order.abilityId],target=order.targetId?actorById(world,order.targetId):null,point=target??(Number.isFinite(order.x)?order:actor);
  const reason=validate(world,actor.id,order.abilityId,target?{actorId:target.id}:Number.isFinite(order.x)?{x:order.x,z:order.z}:{},{acting:true});
  if(reason){actor.order=actor.lock?{kind:'attack',targetId:actor.lock}:null;if(actor.side!=='enemy')emit(world,{kind:'rejected',actorId:actor.id,reason});return;}
  if(ability.approach&&target&&target!==actor&&distanceBetween(actor,target)>orderRange(world,actor,order,target))return;
  if(target!==actor&&point!==actor){turnToward(actor,point.x-actor.x,point.z-actor.z);if(!facingWithin(actor,point,.7))return;}
  const effect=ability.effects[0];
  switch(effect.type){
    case 'rally':case 'guard':case 'inspire':case 'volley':useSpecial(world,actor,ability.id,target);break;
    case 'missile':{
      const cast=ticksOf(ability.castTime_s);
      actor.action={kind:'throw',abilityId:ability.id,missile:effect.missile,targetId:target?.id??null,x:point.x,z:point.z,
        start:world.tick,release:world.tick+Math.round(cast*ability.release),end:world.tick+cast};
      emit(world,{kind:'cast',actorId:actor.id,abilityId:ability.id,targetId:target?.id??null});break;
    }
    case 'bash':{
      const cast=ticksOf(ability.castTime_s);
      actor.action={kind:'bash',abilityId:ability.id,targetId:target.id,start:world.tick,contact:world.tick+Math.round(cast*ability.release),end:world.tick+cast};
      emit(world,{kind:'bash',actorId:actor.id,targetId:target.id});break;
    }
    case 'heal':{
      const patient=target??actor;
      actor.action={kind:'work',what:'bind_wounds',abilityId:ability.id,targetId:patient.id,start:world.tick,end:world.tick+ticksOf(ability.castTime_s)};
      emit(world,{kind:'work',actorId:actor.id,targetId:patient.id,what:'bind_wounds'});break;
    }
    case 'carry':{
      actor.carrying=target.id;target.carriedBy=actor.id;target.path=[];target.order=null;actor.order=null;actor.lock=null;actor.path=[];actor.gait=null;
      emit(world,{kind:'lift',actorId:actor.id,targetId:target.id});used(world,actor,'assist');if(target.escort)target.escort.escorted=true;break;
    }
    case 'reveal':{
      actor.stamina-=ability.cost.stamina??0;actor.cooldowns={...actor.cooldowns,[ability.id]:world.tick+ticksOf(ability.recovery_s)};actor.order=null;
      world.reveals.push({x:actor.x,z:actor.z,radius:effect.radius,until:world.tick+ticksOf(effect.duration_s)});
      emit(world,{kind:'scout',actorId:actor.id,radius:effect.radius});used(world,actor,'scout');break;
    }
  }
}

function startInteraction(world,actor,order){
  const object=objectById(world,order.targetId);if(!object||object.done&&!object.toggle){actor.order=null;return;}
  const problem=fieldProblem(world,object);if(problem){emit(world,{kind:'rejected',actorId:actor.id,reason:problem});actor.order=null;return;}
  if(distanceBetween(actor,object)>orderRange(world,actor,order,object))return;
  turnToward(actor,object.x-actor.x,object.z-actor.z);
  actor.action={kind:'work',what:object.kind,objectId:object.id,start:world.tick,end:world.tick+ticksOf((object.work_s??3)*(order.force?2:1))};
  emit(world,{kind:'work',actorId:actor.id,objectId:object.id,what:object.kind});
}

function progress(world,actor,action){
  const target=action.targetId?actorById(world,action.targetId):null;
  if(target?.alive&&target!==actor&&action.kind!=='work')turnToward(actor,target.x-actor.x,target.z-actor.z);
  else if(action.kind==='throw'&&Number.isFinite(action.x))turnToward(actor,action.x-actor.x,action.z-actor.z);
  if((action.kind==='swing'||action.kind==='bash')&&world.tick===action.contact){
    // The bash spends its Stamina when it is delivered: one stopped before contact costs nothing.
    if(action.kind==='bash')actor.stamina=Math.max(0,actor.stamina-(ABILITIES.shield_bash.cost.stamina??0));
    const reach=action.kind==='bash'?ABILITIES.shield_bash.range_m+.35:reachOf(actor);
    if(target?.alive&&distanceBetween(actor,target)<=reach+COMBAT.reachSlack)
      world.blows.push({attackerId:actor.id,defenderId:target.id,...(action.kind==='bash'?{profile:ABILITIES.shield_bash.effects[0].damage,bash:true}:{})});
    else emit(world,{kind:'whiff',actorId:actor.id});
  }
  if(action.kind==='throw'&&world.tick===action.release)release(world,actor,action);
  if(action.kind==='shot'&&world.tick===action.release)shoot(world,actor,action);
  if(world.tick<action.end)return;
  actor.action=null;
  if(action.kind==='work'){finishWork(world,actor,action);return;}
  const recovery=action.kind==='swing'||action.kind==='shot'?derivedValues(actor).recoveryTicks:ticksOf(ABILITIES[action.abilityId]?.recovery_s??0);
  actor.readyAt=world.tick+recovery;
  if(action.abilityId&&ABILITIES[action.abilityId].recovery_s>2)actor.cooldowns={...actor.cooldowns,[action.abilityId]:world.tick+recovery};
  if((action.kind==='throw'||action.kind==='bash')&&actor.order?.kind==='ability')actor.order=actor.lock?{kind:'attack',targetId:actor.lock}:null;
}

function finishWork(world,actor,action){
  if(action.what==='bind_wounds'){
    const patient=actorById(world,action.targetId);if(!patient?.alive){actor.order=null;return;}
    if((actor.bandages??0)<=0){emit(world,{kind:'rejected',actorId:actor.id,reason:'NO_BANDAGES'});actor.order=null;return;}
    actor.bandages--;const fraction=actor.effects?.bindWounds??ABILITIES.bind_wounds.effects[0].fraction,heal=Math.max(1,Math.floor(patient.maxHp*fraction));
    const wasDown=patient.down;patient.hp=Math.min(patient.maxHp,(wasDown?0:patient.hp)+heal);
    if(wasDown){patient.down=false;patient.downAt=-1;}
    if(patient.escort&&!patient.escort.escorted){patient.escort.escorted=true;}
    actor.order=null;actor.readyAt=world.tick+ticksOf(ABILITIES.bind_wounds.recovery_s);
    emit(world,{kind:'heal',actorId:actor.id,targetId:patient.id,amount:heal,raised:wasDown});
    if(patient!==actor)used(world,actor,'assist');
    return;
  }
  const object=objectById(world,action.objectId);if(!object)return;
  // A field object changes state and the field with it (field-objects.js).
  if(object.field){actor.order=null;useFieldObject(world,actor,object);return;}
  actor.order=null;object.done=true;object.by=actor.id;object.at=world.tick;
  emit(world,{kind:'used-object',actorId:actor.id,objectId:object.id,what:object.kind});
}

// A thrown missile leaves the hand: aimed where the target will be when it arrives.
export function release(world,actor,action){
  const ability=ABILITIES[action.abilityId],kind=ability.cost.ammo;
  if(!((actor.ammo[kind]??0)>0))return;actor.ammo[kind]--;
  launch(world,actor,action.missile,action.targetId,{x:action.x,z:action.z});
  if(action.abilityId==='throw_pilum')used(world,actor,'throw');
}
function shoot(world,actor,action){
  if(action.ammo){if(!((actor.ammo[action.ammo]??0)>0))return;actor.ammo[action.ammo]--;}
  const target=actorById(world,action.targetId);if(!target?.alive)return;
  launch(world,actor,action.missile,target.id,{x:target.x,z:target.z});
}
function launch(world,actor,missileId,targetId,point){
  const target=targetId?actorById(world,targetId):null,missile=MISSILES[missileId];
  let aim={x:point.x,z:point.z};
  if(target?.alive){
    const flight=distanceBetween(actor,target)/missile.speed,vx=(target.x-target.px)/DT,vz=(target.z-target.pz)/DT;
    aim=clampToMap(navGrid(world.map),{x:target.x+vx*flight,z:target.z+vz*flight});
  }
  const ticks=Math.max(1,Math.ceil(span(aim.x-actor.x,aim.z-actor.z)/missile.speed*TIME.ticksPerSecond));
  world.projectiles.push({id:world.nextId++,missile:missileId,ownerId:actor.id,targetId:target?.id??null,fromX:actor.x,fromZ:actor.z,toX:aim.x,toZ:aim.z,
    start:world.tick,arrive:world.tick+ticks});
  emit(world,{kind:'throw',actorId:actor.id,targetId:target?.id??null,missile:missileId});
}

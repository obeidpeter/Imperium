import {COMBAT,MISSILES,TIME} from '../../data/realtime-rules.js';
import {span} from './navigation.js';
import {blowSetup,derivedValues,rollBlow,staggerTicks} from './combat.js';
import {actorById,distanceBetween,hostile} from './abilities.js';
import {cancelAction} from './actions.js';
import {struck} from './ai.js';
import {memberFell,squadOf,membersOf} from './squads.js';

// Systems 5 and 6 (§3.1): missiles land, then every blow released this tick
// resolves in the order released: hits, blocks, staggers, downs and deaths.
// A companion or a fellow soldier at 0 Health is down, not dead, until bound
// or carried; the soldier the player plays falls and the encounter is lost.

const ticksOf=seconds=>Math.round(seconds*TIME.ticksPerSecond);
const emit=(world,event)=>{world.events.push({tick:world.tick,...event});};

export function flyProjectiles(world){
  const kept=[];
  for(const p of world.projectiles){
    if(world.tick<p.arrive){kept.push(p);continue;}
    const owner=actorById(world,p.ownerId),intended=p.targetId?actorById(world,p.targetId):null;
    const standing=o=>o.alive&&!o.down&&!o.carriedBy;
    let struck=intended&&standing(intended)&&span(intended.x-p.toX,intended.z-p.toZ)<=COMBAT.missileSlack?intended:null;
    if(!struck)for(const o of world.actors)if(standing(o)&&o!==owner&&hostile(owner,o)&&span(o.x-p.toX,o.z-p.toZ)<=COMBAT.missileSlack){struck=o;break;}
    if(struck)world.blows.push({attackerId:p.ownerId,defenderId:struck.id,missile:p.missile,projectileId:p.id,from:{x:p.fromX,z:p.fromZ}});
    else emit(world,{kind:'landed',projectileId:p.id,missile:p.missile,x:p.toX,z:p.toZ});
  }
  world.projectiles=kept;
}

function fall(world,attacker,defender,base){
  defender.action=null;defender.order=null;defender.lock=null;defender.path=[];defender.gait=null;defender.braceUntil=0;
  if(defender.carrying){const carried=actorById(world,defender.carrying);if(carried)carried.carriedBy=null;defender.carrying=null;}
  if(defender.downs){defender.down=true;defender.downAt=world.tick;defender.hp=0;emit(world,{kind:'down',...base});return;}
  // Fire has no attacker: it is named as the cause.
  defender.alive=false;defender.diedAt=world.tick;defender.killedBy=attacker?.id??base.cause??null;if(attacker)attacker.kills++;
  emit(world,{kind:'fall',...base,...(defender.squadId?{squadId:defender.squadId}:{})});
  // A man of a squad: the squad loses his share and takes the 0.38 hit.
  if(defender.squadId)memberFell(world,defender,attacker,{arc:base.arc,missile:base.missile});
}

// A squad's exchange wounds a single man (squads.js): whole points of Health,
// with no roll (the exchange already counted his shield, brace and cover).
export function exchangeWound(world,attacker,defender,points,{missile=null,arc='front',squadId=null}={}){
  if(!defender.alive||defender.down||points<=0)return;
  defender.lastHitTick=world.tick;defender.lastHitBy=attacker.id;defender.calmSince=world.tick;
  if(defender.ai)struck(world,defender,attacker,false);
  const base={attackerId:attacker.id,defenderId:defender.id,missile,arc,roll:null,critical:false,ambush:false,projectileId:null,bash:false,exchange:true,squadId};
  const floor=defender.practice?1:0;defender.hp=Math.max(floor,defender.hp-points);emit(world,{kind:'hit',...base,damage:points});
  if(defender.action?.kind==='work'){cancelAction(world,defender);defender.order=null;}
  if(defender.hp<=0)fall(world,attacker,defender,base);
}
// The pitch fire burns a single man (field-objects.js): no attacker, no roll.
export function burnActor(world,defender,points){
  if(!defender.alive||defender.down||points<=0)return;
  defender.lastHitTick=world.tick;defender.calmSince=world.tick;
  const base={attackerId:null,defenderId:defender.id,cause:'fire'};
  defender.hp=Math.max(defender.practice?1:0,defender.hp-points);emit(world,{kind:'burn',...base,damage:points});
  if(defender.action?.kind==='work'){cancelAction(world,defender);defender.order=null;}
  if(defender.hp<=0)fall(world,null,defender,base);
}

export function resolveBlows(world){
  for(const blow of world.blows){
    const attacker=actorById(world,blow.attackerId),defender=actorById(world,blow.defenderId);if(!defender?.alive||defender.down)continue;
    const setup=blowSetup(world,attacker,defender,{missile:blow.missile??null,from:blow.from??null,profile:blow.profile??null}),r=rollBlow(world,setup);
    defender.lastHitTick=world.tick;defender.lastHitBy=attacker.id;defender.calmSince=world.tick;
    if(attacker.hidden){attacker.hidden=false;emit(world,{kind:'revealed',actorId:attacker.id});}
    if(defender.ai)struck(world,defender,attacker,setup.ambush);
    const base={attackerId:attacker.id,defenderId:defender.id,missile:blow.missile??null,arc:setup.arc,roll:r.roll,critical:r.critical,ambush:!!setup.ambush,
      projectileId:blow.projectileId??null,bash:!!blow.bash};
    if(!r.hit){emit(world,{kind:'miss',...base});continue;}
    if(r.blocked){
      emit(world,{kind:'block',...base});
      if(blow.missile&&MISSILES[blow.missile].sticks&&!defender.shieldStuck){defender.shieldStuck=true;emit(world,{kind:'stuck',...base});}
      continue;
    }
    // Practice blows sting and never fell anyone; the drill partner yields at 1.
    let damage=r.damage;if(attacker.practice)damage=Math.min(1,damage);
    const floor=attacker.practice||defender.practice?1:0;defender.hp=Math.max(floor,defender.hp-damage);
    emit(world,{kind:'hit',...base,damage});
    // Interruptible work stops on any blow that lands (§3.5 step 7).
    if(defender.action?.kind==='work'){cancelAction(world,defender);defender.order=null;}
    if(defender.hp<=0){fall(world,attacker,defender,base);continue;}
    if(r.stagger){
      cancelAction(world,defender);defender.staggerStart=world.tick;defender.staggerUntil=world.tick+staggerTicks(defender,r.stun);defender.path=[];defender.gait=null;
      emit(world,{kind:'stagger',...base});
    }
  }
  world.blows=[];
}

// After a target falls: stand ready, or (Keep fighting, for the soldier the
// player controls) take on whoever is attacking him.
export function settleLocks(world){
  for(const actor of world.actors){
    if(!actor.alive||actor.down||actor.side==='enemy'||!actor.lock)continue;const target=actorById(world,actor.lock);if(target?.alive&&!target.down)continue;
    // A man of a squad falls: the fight goes on against the next of his squad standing near.
    const squad=target?.squadId&&actor.order?.kind==='attack'?squadOf(world,target):null;
    const next=squad?membersOf(world,squad).filter(m=>distanceBetween(actor,m)<=6).sort((a,b)=>distanceBetween(actor,a)-distanceBetween(actor,b)||a.slot-b.slot)[0]:null;
    if(next){actor.lock=next.id;actor.order={...actor.order,targetId:next.id};continue;}
    actor.lock=null;if(actor.order?.kind==='attack')actor.order=null;
    if(world.options.keepFighting&&actor.id===world.controlled){
      const attacker=world.actors.filter(o=>o.alive&&!o.down&&hostile(actor,o)&&(o.order?.targetId===actor.id||o.action?.targetId===actor.id))
        .sort((a,b)=>distanceBetween(actor,a)-distanceBetween(actor,b))[0];
      if(attacker){actor.lock=attacker.id;actor.order={kind:'attack',targetId:attacker.id};}
    }
  }
}

// Stamina always; Health only out of combat (no hostile within 30 m for 10 s).
export function regenerate(world){
  const calm=ticksOf(COMBAT.regen.calmSeconds),DT=1/TIME.ticksPerSecond;
  for(const a of world.actors){
    if(!a.alive||a.down)continue;const d=derivedValues(a);
    if(a.stamina<a.maxStamina){a.staminaGain+=d.staminaPerSecond*DT;const whole=Math.floor(a.staminaGain);a.staminaGain-=whole;a.stamina=Math.min(a.maxStamina,a.stamina+whole);}
    else a.staminaGain=0;
    if(world.actors.some(o=>o.alive&&!o.down&&!o.hidden&&hostile(a,o)&&distanceBetween(a,o)<=COMBAT.regen.calmRange))a.calmSince=world.tick;
    if(a.hp<a.maxHp&&world.tick-a.calmSince>=calm){a.hpGain+=d.healthPerSecond*DT;const whole=Math.floor(a.hpGain);a.hpGain-=whole;a.hp=Math.min(a.maxHp,a.hp+whole);}
    else if(a.hp>=a.maxHp)a.hpGain=0;
  }
}

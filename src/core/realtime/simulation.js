import {ABILITIES,COMBAT,MISSILES,MOVEMENT,REASONS,TIME} from '../../data/realtime-rules.js';
import {splitStreams} from './rng-streams.js';
import {clampToMap,findRoute,navGrid,span,speedFactor,walkable} from './navigation.js';
import {arcOf,blowSetup,braced,derivedValues,rollBlow,startingAttributes,staggerTicks,weaponOf} from './combat.js';
import {actorById,distanceBetween,hostile,staggered,validate} from './abilities.js';
import {decideEnemy,decidesThisTick} from './ai.js';

// The real-time simulation (§3): a plain, JSON-serialisable world stepped at
// a fixed 20 Hz. Every input is a Command { tick, actorId, kind, payload }
// queued for the next tick boundary; while paused the queue keeps only the
// latest order per actor. No clock, frame delta, DOM or Math.random is read:
// the same seed and command log always give the same world, and the world's
// snapshot restores it exactly. All randomness comes from named streams split
// from the campaign's seeded generator (rng-streams.js).

export const WORLD_VERSION=1;
const ticksOf=seconds=>Math.round(seconds*TIME.ticksPerSecond),DT=1/TIME.ticksPerSecond,LOG_LIMIT=60;
// Orders share one queue place per actor; each other command kind has its own.
const ORDER_KINDS=new Set(['move','attack','ability','stop']);

function makeActor(spec){
  const attributes=startingAttributes({path:spec.path,attributes:spec.attributes});
  const actor={id:spec.id,name:spec.name,side:spec.side??'enemy',role:spec.role??'infantry',skirmisher:!!spec.skirmisher,attributes,kit:[...spec.kit],
    ammo:{...(spec.ammo??{})},x:spec.at[0],z:spec.at[1],px:spec.at[0],pz:spec.at[1],fx:spec.face?.[0]??1,fz:spec.face?.[1]??0,pfx:0,pfz:0,
    hp:0,maxHp:0,stamina:0,maxStamina:0,hpGain:0,staminaGain:0,alive:true,diedAt:-1,
    // Raiders come with their weapons out; the player's soldier draws his with Space.
    drawn:(spec.side??'enemy')==='enemy',walkMode:false,order:null,lock:null,path:[],
    gait:null,moving:false,walked:0,repathAt:0,action:null,readyAt:0,staggerUntil:0,staggerStart:-1,braceUntil:0,shieldStuck:false,
    lastHitTick:-1,lastHitBy:null,calmSince:0,cooldowns:{},kills:0,goal:null,
    ai:spec.side==='enemy'?{state:'idle',slot:-1,dx:0,dz:0}:null};
  const d=derivedValues(actor);actor.hp=actor.maxHp=d.health;actor.stamina=actor.maxStamina=d.stamina;actor.pfx=actor.fx;actor.pfz=actor.fz;
  return actor;
}

// map: the encounter's {id, width, height, terrain}. seed: the campaign
// generator's state. actors: specs with metres positions.
export function createWorld({map,seed,actors,controlled='hero',options={},weather=null}){
  if(!map?.terrain||!Number.isInteger(map.width)||!Number.isInteger(map.height))throw new Error('A real-time world needs a tile map.');
  return {version:WORLD_VERSION,tick:0,seed:seed>>>0,rng:splitStreams(seed>>>0),
    map:{id:map.id??'map',width:map.width,height:map.height,terrain:map.terrain.map(row=>row.map(t=>typeof t==='string'?t:t?.type??'grass'))},
    weather,heroId:controlled,controlled,options:{keepFighting:false,drawToAttack:true,...options},status:'active',actors:actors.map(makeActor),projectiles:[],
    queue:[],seq:0,nextId:1,blows:[],events:[],log:[]};
}

export const roundOf=world=>Math.floor(world.tick/TIME.roundTicks)+1;
export const battleSeconds=world=>world.tick/TIME.ticksPerSecond;
export const clockText=tick=>{const s=Math.floor(tick/TIME.ticksPerSecond);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};

// Exactly what a later load continues from, and its fingerprint.
export const snapshotWorld=world=>JSON.stringify(world);
export function restoreWorld(text){
  const world=JSON.parse(text);if(world?.version!==WORLD_VERSION)throw new Error('This fight was saved by an incompatible version.');return world;
}
// Two FNV-1a lanes over the snapshot: a 64-bit fingerprint as hex.
export function worldHash(world){
  const text=snapshotWorld(world);let a=0x811c9dc5,b=0xcbf29ce4;
  for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);a=Math.imul(a^c,0x01000193)>>>0;b=Math.imul(b^c^(i&255),0x01000193)>>>0;}
  return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0');
}

// Whether a command is legal now: null, or its reason code. Pure.
export function commandProblem(world,command){
  const actor=actorById(world,command?.actorId),p=command?.payload??{};
  if(world.status!=='active')return 'BATTLE_OVER';
  if(!actor||actor.side==='enemy')return 'NO_TARGET';
  if(!actor.alive)return 'ACTOR_DOWN';
  switch(command.kind){
    case 'move':return Number.isFinite(p.x)&&Number.isFinite(p.z)?null:'NO_TARGET';
    case 'attack':return validate(world,actor.id,'strike',{actorId:p.targetId,forced:!!p.forced});
    case 'ability':return ABILITIES[p.abilityId]&&!ABILITIES[p.abilityId].enemyOnly
      ?validate(world,actor.id,p.abilityId,{actorId:p.targetId,x:p.x,z:p.z,forced:!!p.forced}):'NO_TARGET';
    case 'stop':case 'setDrawn':case 'setWalk':return null;
    case 'setOptions':return null;
    default:return 'NO_TARGET';
  }
}
// Queue a command for the next tick boundary: { ok, reason }. An illegal one
// changes nothing. A newer order to the same actor replaces a queued one.
export function queueCommand(world,command){
  const reason=commandProblem(world,command);if(reason)return {ok:false,reason,message:REASONS[reason]};
  const order=ORDER_KINDS.has(command.kind);
  world.queue=world.queue.filter(q=>q.actorId!==command.actorId||(order?!ORDER_KINDS.has(q.kind):q.kind!==command.kind));
  world.queue.push({tick:world.tick,actorId:command.actorId,kind:command.kind,payload:{...(command.payload??{})},seq:world.seq++});
  return {ok:true,reason:null};
}

const emit=(world,event)=>{world.events.push({tick:world.tick,...event});};
function cancelAction(world,actor){
  if(!actor.action)return;
  // An interrupted swing or cast still owes its recovery; nothing it would have spent is spent.
  if(actor.action.kind==='swing')actor.readyAt=Math.max(actor.readyAt,world.tick+derivedValues(actor).recoveryTicks);
  actor.action=null;
}
function setRoute(world,actor,point,{run=null}={}){
  const grid=navGrid(world.map),route=findRoute(grid,actor,point);actor.path=route.points;
  actor.gait=route.points.length?(run??(route.length>MOVEMENT.runThreshold&&!actor.walkMode))?'run':'walk':null;
  actor.goal={x:route.stopPoint.x,z:route.stopPoint.z};actor.repathAt=world.tick+MOVEMENT.repathTicks;return route;
}
function endBrace(actor){actor.braceUntil=0;}

// System 1: commands become intents.
function applyCommand(world,command){
  const actor=actorById(world,command.actorId),p=command.payload,reason=commandProblem(world,command);
  if(reason){emit(world,{kind:'rejected',actorId:command.actorId,reason});return;}
  switch(command.kind){
    case 'move':{
      cancelAction(world,actor);endBrace(actor);actor.lock=null;actor.order={kind:'move'};
      const route=setRoute(world,actor,clampToMap(navGrid(world.map),p));
      if(route.reasonCode)emit(world,{kind:'blocked',actorId:actor.id,reason:route.reasonCode});
      if(!route.points.length)actor.order=null;break;
    }
    case 'attack':{
      endBrace(actor);
      if(!actor.drawn&&world.options.drawToAttack){actor.drawn=true;emit(world,{kind:'draw',actorId:actor.id});}
      // Draw to attack off: a sheathed soldier only walks to him (the SoA rule).
      if(!actor.drawn){actor.lock=null;actor.order={kind:'approach',targetId:p.targetId};}
      else{if(actor.lock!==p.targetId||actor.action?.kind!=='swing')cancelAction(world,actor);actor.lock=p.targetId;
        actor.order={kind:'attack',targetId:p.targetId,forced:!!p.forced};}
      actor.repathAt=world.tick;break;
    }
    case 'ability':{
      const ability=ABILITIES[p.abilityId];
      if(p.abilityId==='strike'){applyCommand(world,{...command,kind:'attack',payload:{targetId:p.targetId,forced:p.forced}});return;}
      if(p.abilityId==='brace'){
        cancelAction(world,actor);actor.stamina-=ability.cost.stamina;actor.braceUntil=world.tick+ticksOf(ability.duration_s);
        actor.order=null;actor.lock=null;actor.path=[];actor.gait=null;emit(world,{kind:'brace',actorId:actor.id});break;
      }
      actor.order={kind:'ability',abilityId:p.abilityId,targetId:p.targetId??null,x:p.x??null,z:p.z??null};actor.path=[];actor.gait=null;endBrace(actor);
      if(actor.action?.kind==='swing')cancelAction(world,actor);break;
    }
    case 'stop':cancelAction(world,actor);actor.order=null;actor.lock=null;actor.path=[];actor.gait=null;break;
    case 'setDrawn':{
      const drawn=!!p.drawn;
      for(const a of world.actors)if(a.alive&&a.side===actor.side&&a.drawn!==drawn){
        a.drawn=drawn;if(!drawn){a.lock=null;if(a.order?.kind==='attack')a.order=null;if(a.action?.kind==='swing')cancelAction(world,a);}
      }
      emit(world,{kind:drawn?'draw':'sheathe',actorId:actor.id});break;
    }
    case 'setWalk':actor.walkMode=!!p.walk;if(actor.gait==='run'&&actor.walkMode)actor.gait='walk';break;
    case 'setOptions':
      for(const key of ['keepFighting','drawToAttack'])if(typeof p[key]==='boolean')world.options[key]=p[key];break;
  }
}

// An enemy within 2 m who has this actor inside his front arc stops him running.
export function engaged(world,actor){
  return world.actors.some(o=>o.alive&&hostile(o,actor)&&distanceBetween(o,actor)<=MOVEMENT.engagedRange&&arcOf(o,actor)==='front');
}
// A blow reaches from the attacker's centre to the defender's body.
export const reachOf=attacker=>derivedValues(attacker).reach+MOVEMENT.radius;
const inReach=(a,t)=>distanceBetween(a,t)<=reachOf(a);
// Turn toward a direction by at most one step this tick.
function turnToward(actor,dx,dz){
  const d=span(dx,dz);if(d<1e-6)return;const tx=dx/d,tz=dz/d,dot=actor.fx*tx+actor.fz*tz,[c,s]=MOVEMENT.turnStep;
  if(dot>=c){actor.fx=tx;actor.fz=tz;return;}
  const sign=actor.fx*tz-actor.fz*tx>=0?1:-1,x=actor.fx*c-actor.fz*s*sign,z=actor.fx*s*sign+actor.fz*c,n=span(x,z);actor.fx=x/n;actor.fz=z/n;
}
const facingWithin=(actor,target,cos=.5)=>{const d=distanceBetween(actor,target)||1;return ((target.x-actor.x)*actor.fx+(target.z-actor.z)*actor.fz)/d>=cos;};

// Where a chasing actor heads: straight for the target, or, for an enemy
// still approaching, the side of the target its AI chose.
function chaseGoal(world,actor,target){
  const reach=reachOf(actor),d=distanceBetween(actor,target);
  if(actor.order?.slot&&actor.ai&&d>reach*2){
    const standoff=reach-.15,goal={x:target.x+actor.ai.dx*standoff,z:target.z+actor.ai.dz*standoff};
    if(walkable(navGrid(world.map),goal.x,goal.z))return goal;
  }
  return {x:target.x,z:target.z};
}

// System 3: movement, separation and terrain speed.
function moveActors(world){
  const grid=navGrid(world.map);
  for(const actor of world.actors){
    actor.moving=false;if(!actor.alive||staggered(world,actor)||braced(world,actor))continue;
    const order=actor.order,target=order?.targetId?actorById(world,order.targetId):null;
    if(order&&['attack','approach','advance'].includes(order.kind)){
      if(!target?.alive){actor.path=[];actor.gait=null;continue;}
      const close=order.kind==='advance'?distanceBetween(actor,target)<=order.stopAt:inReach(actor,target);
      if(close||actor.action){actor.path=[];actor.gait=null;continue;}
      if(world.tick>=actor.repathAt||!actor.path.length){
        setRoute(world,actor,chaseGoal(world,actor,target),{run:actor.walkMode?false:null});
      }
    }else if(order?.kind==='ability'||actor.action){actor.path=[];actor.gait=null;continue;}
    if(!actor.path.length){if(order?.kind==='move')actor.order=null;actor.gait=null;continue;}
    const derived=derivedValues(actor),run=actor.gait==='run'&&!engaged(world,actor)&&!actor.walkMode;
    let budget=(run?derived.run:MOVEMENT.walk)*speedFactor(grid,actor.x,actor.z)*DT,moved=0;
    while(budget>1e-9&&actor.path.length){
      const next=actor.path[0],dx=next.x-actor.x,dz=next.z-actor.z,d=span(dx,dz);
      if(d<=budget+MOVEMENT.arrive){actor.x=next.x;actor.z=next.z;budget-=d;moved+=d;actor.path.shift();if(d>1e-6)turnToward(actor,dx,dz);}
      else{actor.x+=dx/d*budget;actor.z+=dz/d*budget;moved+=budget;turnToward(actor,dx,dz);budget=0;}
    }
    actor.gait=run?'run':'walk';actor.moving=moved>0;actor.walked+=moved;
    if(!actor.path.length&&order?.kind==='move'){actor.order=null;actor.gait=null;}
  }
  // Separation: bodies never overlap; each of a close pair steps back half the
  // overlap, unless that would put him on blocked ground.
  const min=MOVEMENT.radius*2,list=world.actors.filter(a=>a.alive);
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
    const a=list[i],b=list[j],dx=b.x-a.x,dz=b.z-a.z,d=span(dx,dz);if(d>=min)continue;
    const nx=d>1e-6?dx/d:1,nz=d>1e-6?dz/d:0,push=(min-d)/2;
    for(const [who,sign]of [[a,-1],[b,1]]){
      const p=clampToMap(grid,{x:who.x+nx*push*sign,z:who.z+nz*push*sign});if(walkable(grid,p.x,p.z)){who.x=p.x;who.z=p.z;}
    }
  }
}

// System 4: swing timers (contact at half the swing), casts and recovery.
function act(world){
  for(const actor of world.actors){
    if(!actor.alive||staggered(world,actor))continue;
    const order=actor.order,action=actor.action;
    if(action){
      const target=action.targetId?actorById(world,action.targetId):null;
      if(target?.alive)turnToward(actor,target.x-actor.x,target.z-actor.z);
      else if(action.kind==='throw'&&Number.isFinite(action.x))turnToward(actor,action.x-actor.x,action.z-actor.z);
      if(action.kind==='swing'&&world.tick===action.contact){
        if(target?.alive&&distanceBetween(actor,target)<=reachOf(actor)+COMBAT.reachSlack)world.blows.push({attackerId:actor.id,defenderId:target.id});
        else emit(world,{kind:'whiff',actorId:actor.id});
      }
      if(action.kind==='throw'&&world.tick===action.release)release(world,actor,action);
      if(world.tick>=action.end){
        actor.action=null;actor.readyAt=world.tick+(action.kind==='swing'?derivedValues(actor).recoveryTicks:ticksOf(ABILITIES[action.abilityId].recovery_s));
        if(action.kind==='throw'&&actor.order?.kind==='ability')actor.order=actor.lock?{kind:'attack',targetId:actor.lock}:null;
      }
      continue;
    }
    if(world.tick<actor.readyAt)continue;
    if(order?.kind==='attack'&&actor.drawn){
      const target=actorById(world,order.targetId);if(!target?.alive||!inReach(actor,target))continue;
      turnToward(actor,target.x-actor.x,target.z-actor.z);if(!facingWithin(actor,target))continue;
      const swing=derivedValues(actor).swingTicks;endBrace(actor);
      actor.action={kind:'swing',targetId:target.id,start:world.tick,contact:world.tick+Math.round(swing*COMBAT.contact),end:world.tick+swing};
      emit(world,{kind:'swing',actorId:actor.id,targetId:target.id});
    }else if(order?.kind==='ability'){
      const ability=ABILITIES[order.abilityId],target=order.targetId?actorById(world,order.targetId):null,point=target??order;
      const reason=validate(world,actor.id,order.abilityId,target?{actorId:target.id}:{x:order.x,z:order.z});
      if(reason){actor.order=actor.lock?{kind:'attack',targetId:actor.lock}:null;if(actor.side!=='enemy')emit(world,{kind:'rejected',actorId:actor.id,reason});continue;}
      turnToward(actor,point.x-actor.x,point.z-actor.z);if(!facingWithin(actor,point,.7))continue;
      const cast=ticksOf(ability.castTime_s);
      actor.action={kind:'throw',abilityId:ability.id,missile:ability.effects[0].missile,targetId:target?.id??null,x:point.x,z:point.z,
        start:world.tick,release:world.tick+Math.round(cast*ability.release),end:world.tick+cast};
      emit(world,{kind:'cast',actorId:actor.id,abilityId:ability.id,targetId:target?.id??null});
    }
  }
}
// The missile leaves the hand: aimed where the target will be when it arrives.
function release(world,actor,action){
  const ability=ABILITIES[action.abilityId],kind=ability.cost.ammo;
  if(!((actor.ammo[kind]??0)>0))return;actor.ammo[kind]--;
  const target=action.targetId?actorById(world,action.targetId):null,missile=MISSILES[action.missile];
  let aim={x:action.x,z:action.z};
  if(target?.alive){
    const flight=distanceBetween(actor,target)/missile.speed,vx=(target.x-target.px)/DT,vz=(target.z-target.pz)/DT;
    aim=clampToMap(navGrid(world.map),{x:target.x+vx*flight,z:target.z+vz*flight});
  }
  const ticks=Math.max(1,Math.ceil(span(aim.x-actor.x,aim.z-actor.z)/missile.speed*TIME.ticksPerSecond));
  world.projectiles.push({id:world.nextId++,missile:action.missile,ownerId:actor.id,targetId:target?.id??null,fromX:actor.x,fromZ:actor.z,toX:aim.x,toZ:aim.z,
    start:world.tick,arrive:world.tick+ticks});
  emit(world,{kind:'throw',actorId:actor.id,targetId:target?.id??null,missile:action.missile});
}

// System 5: projectiles land; whoever stands at the aim point is struck.
function flyProjectiles(world){
  const kept=[];
  for(const p of world.projectiles){
    if(world.tick<p.arrive){kept.push(p);continue;}
    const owner=actorById(world,p.ownerId),intended=p.targetId?actorById(world,p.targetId):null;
    let struck=intended?.alive&&span(intended.x-p.toX,intended.z-p.toZ)<=COMBAT.missileSlack?intended:null;
    if(!struck)for(const o of world.actors)if(o.alive&&o!==owner&&hostile(owner,o)&&span(o.x-p.toX,o.z-p.toZ)<=COMBAT.missileSlack){struck=o;break;}
    if(struck)world.blows.push({attackerId:p.ownerId,defenderId:struck.id,missile:p.missile,projectileId:p.id,from:{x:p.fromX,z:p.fromZ}});
    else emit(world,{kind:'landed',projectileId:p.id,missile:p.missile,x:p.toX,z:p.toZ});
  }
  world.projectiles=kept;
}

// System 6: every blow released this tick resolves, in the order released.
function resolveBlows(world){
  for(const blow of world.blows){
    const attacker=actorById(world,blow.attackerId),defender=actorById(world,blow.defenderId);if(!defender?.alive)continue;
    const setup=blowSetup(world,attacker,defender,{missile:blow.missile??null,from:blow.from??null}),r=rollBlow(world,setup);
    defender.lastHitTick=world.tick;defender.lastHitBy=attacker.id;defender.calmSince=world.tick;
    if(defender.ai&&defender.ai.state==='idle')defender.ai.state='engage';
    const base={attackerId:attacker.id,defenderId:defender.id,missile:blow.missile??null,arc:setup.arc,roll:r.roll,critical:r.critical,
      projectileId:blow.projectileId??null};
    if(!r.hit){emit(world,{kind:'miss',...base});continue;}
    if(r.blocked){
      emit(world,{kind:'block',...base});
      if(blow.missile&&MISSILES[blow.missile].sticks&&!defender.shieldStuck){defender.shieldStuck=true;emit(world,{kind:'stuck',...base});}
      continue;
    }
    defender.hp=Math.max(0,defender.hp-r.damage);emit(world,{kind:'hit',...base,damage:r.damage});
    if(defender.hp<=0){
      defender.alive=false;defender.diedAt=world.tick;defender.action=null;defender.order=null;defender.lock=null;defender.path=[];defender.gait=null;
      defender.braceUntil=0;attacker.kills++;emit(world,{kind:'fall',...base});continue;
    }
    if(r.stagger){
      defender.action=null;defender.staggerStart=world.tick;defender.staggerUntil=world.tick+staggerTicks(defender,r.stun);defender.path=[];defender.gait=null;
      emit(world,{kind:'stagger',...base});
    }
  }
  world.blows=[];
}

// After a target falls: stand ready, or (Keep fighting, for the soldier the
// player controls) take on whoever is attacking him.
function settleLocks(world){
  for(const actor of world.actors){
    if(!actor.alive||actor.side==='enemy'||!actor.lock)continue;const target=actorById(world,actor.lock);if(target?.alive)continue;
    actor.lock=null;if(actor.order?.kind==='attack')actor.order=null;
    if(world.options.keepFighting&&actor.id===world.controlled){
      const attacker=world.actors.filter(o=>o.alive&&hostile(actor,o)&&(o.order?.targetId===actor.id||o.action?.targetId===actor.id))
        .sort((a,b)=>distanceBetween(actor,a)-distanceBetween(actor,b))[0];
      if(attacker){actor.lock=attacker.id;actor.order={kind:'attack',targetId:attacker.id};}
    }
  }
}

// Stamina always; Health only out of combat (no hostile within 30 m for 10 s).
function regenerate(world){
  const calm=ticksOf(COMBAT.regen.calmSeconds);
  for(const a of world.actors){
    if(!a.alive)continue;const d=derivedValues(a);
    if(a.stamina<a.maxStamina){a.staminaGain+=d.staminaPerSecond*DT;const whole=Math.floor(a.staminaGain);a.staminaGain-=whole;a.stamina=Math.min(a.maxStamina,a.stamina+whole);}
    else a.staminaGain=0;
    if(world.actors.some(o=>o.alive&&hostile(a,o)&&distanceBetween(a,o)<=COMBAT.regen.calmRange))a.calmSince=world.tick;
    if(a.hp<a.maxHp&&world.tick-a.calmSince>=calm){a.hpGain+=d.healthPerSecond*DT;const whole=Math.floor(a.hpGain);a.hpGain-=whole;a.hp=Math.min(a.maxHp,a.hp+whole);}
    else if(a.hp>=a.maxHp)a.hpGain=0;
  }
}

function checkObjectives(world){
  const hero=actorById(world,world.heroId);
  if(!hero?.alive){world.status='lost';emit(world,{kind:'defeat'});return;}
  if(!world.actors.some(a=>a.side==='enemy'&&a.alive)){world.status='won';emit(world,{kind:'victory'});}
}

// The battle log: the events worth reading, with their battle time and place.
const nameOf=(world,id)=>actorById(world,id)?.name??'Someone';
function logLine(world,e){
  const by=nameOf(world,e.attackerId??e.actorId),to=nameOf(world,e.defenderId??e.targetId),what=e.missile?MISSILES[e.missile].name.toLowerCase():'blow';
  switch(e.kind){
    case 'hit':return `${by} hits ${to}${e.missile?` with a ${what}`:''}: ${e.damage}${e.critical?' (critical)':''}${e.arc!=='front'?` from the ${e.arc==='rear'?'rear':'flank'}`:''}.`;
    case 'block':return `${to} blocks ${by}'s ${what}.`;
    case 'stuck':return `The pilum sticks in ${to}'s shield.`;
    case 'miss':return `${by} misses ${to}.`;
    case 'fall':return `${to} falls.`;
    case 'stagger':return `${to} staggers.`;
    case 'notice':return `${by} has seen ${to}.`;
    case 'brace':return `${by} braces behind his shield.`;
    case 'throw':return `${by} throws a ${what}.`;
    case 'victory':return 'The road is clear.';
    case 'defeat':return `${nameOf(world,world.heroId)} has fallen.`;
    default:return null;
  }
}
function writeLog(world){
  for(const e of world.events){
    const text=logLine(world,e);if(!text)continue;
    const where=actorById(world,e.defenderId??e.actorId);
    world.log.push({tick:e.tick,kind:e.kind,text,x:where?.x??e.x??null,z:where?.z??e.z??null});
  }
  if(world.log.length>LOG_LIMIT)world.log.splice(0,world.log.length-LOG_LIMIT);
}

// One tick, systems in the brief's order (§3.1).
export function step(world){
  world.events=[];
  for(const a of world.actors){a.px=a.x;a.pz=a.z;a.pfx=a.fx;a.pfz=a.fz;}
  const due=world.queue.filter(c=>c.tick<=world.tick).sort((a,b)=>a.seq-b.seq);world.queue=world.queue.filter(c=>c.tick>world.tick);
  for(const command of due)applyCommand(world,command);
  if(world.status==='active')world.actors.forEach((a,i)=>{if(a.ai&&decidesThisTick(world,i))decideEnemy(world,a,e=>emit(world,e));});
  if(world.status==='active'){moveActors(world);act(world);flyProjectiles(world);resolveBlows(world);settleLocks(world);regenerate(world);}
  else world.projectiles=[];
  if((world.tick+1)%TIME.roundTicks===0)emit(world,{kind:'round',round:(world.tick+1)/TIME.roundTicks+1});
  if(world.status==='active')checkObjectives(world);
  writeLog(world);world.tick++;
  return world.events;
}
export function run(world,ticks){for(let i=0;i<ticks;i++)step(world);return world;}

// The route a move to `point` would take: { points, stopPoint, length,
// reasonCode?, gait } with walk or run as the click would choose. Pure.
export function routePreview(world,actorId,point){
  const actor=actorById(world,actorId);if(!actor)return null;const grid=navGrid(world.map),route=findRoute(grid,actor,clampToMap(grid,point));
  const wantsRun=route.length>MOVEMENT.runThreshold&&!actor.walkMode,blockedRun=wantsRun&&engaged(world,actor);
  return {...route,gait:wantsRun&&!blockedRun?'run':'walk',...(blockedRun&&!route.reasonCode?{reasonCode:'ENGAGED_CANNOT_RUN'}:{})};
}
export {weaponOf};

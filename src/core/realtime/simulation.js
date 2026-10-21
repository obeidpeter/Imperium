import {ABILITIES,ITEMS,MISSILES,MOVEMENT,REASONS,TIME} from '../../data/realtime-rules.js';
import {splitStreams} from './rng-streams.js';
import {clampToMap,findRoute,navGrid} from './navigation.js';
import {weaponOf} from './combat.js';
import {actorById,distanceBetween,hostile,liftable,staggered,validate} from './abilities.js';
import {decideEnemy,decidesThisTick,perceive} from './ai.js';
import {decideFriend,slotProblem} from './party.js';
import {engaged,moveActors,objectById,reachOf,setDown,setRoute} from './motion.js';
import {act,cancelAction,used} from './actions.js';
import {flyProjectiles,resolveBlows,settleLocks,regenerate} from './damage.js';
import {missionTick,missionProgress} from './mission.js';
import {makeActor} from './actors.js';

// The real-time simulation (§3): a plain, JSON-serialisable world stepped at
// a fixed 20 Hz. Every input is a Command { tick, actorId, kind, payload }
// queued for the next tick boundary; while paused the queue keeps only the
// latest order per actor. No clock, frame delta, DOM or Math.random is read:
// the same seed and command log always give the same world, and the world's
// snapshot restores it exactly. All randomness comes from named streams split
// from the campaign's seeded generator (rng-streams.js). Each tick runs the
// systems in the brief's order (§3.1); they live in their own modules.

export const WORLD_VERSION=2;
const ticksOf=seconds=>Math.round(seconds*TIME.ticksPerSecond),LOG_LIMIT=80;
// Orders share one queue place per actor; each other command kind has its own.
const ORDER_KINDS=new Set(['move','attack','ability','stop','interact','talk','loot']);

// map: the encounter's {id, width, height, terrain}. seed: the campaign
// generator's state. actors: specs with metres positions.
export function createWorld({map,seed,actors,controlled='hero',options={},weather=null,timeOfDay='day',party=[],mission=null,objects=[],difficulty='standard',
  practice=false,kind='field',scale=null}){
  if(!map?.terrain||!Number.isInteger(map.width)||!Number.isInteger(map.height))throw new Error('A real-time world needs a tile map.');
  return {version:WORLD_VERSION,kind,tick:0,seed:seed>>>0,rng:splitStreams(seed>>>0),
    map:{id:map.id??'map',width:map.width,height:map.height,terrain:map.terrain.map(row=>row.map(t=>typeof t==='string'?t:t?.type??'grass'))},scale,
    weather,timeOfDay,difficulty,practice,heroId:'hero',controlled,options:{keepFighting:false,drawToAttack:true,...options},status:'active',
    actors:actors.map(makeActor),party:[...party],projectiles:[],objects:objects.map(o=>({...o,done:!!o.done})),mission,
    queue:[],seq:0,nextId:1,blows:[],events:[],log:[],used:[],reveals:[],spotting:{},spoils:[],provoked:[]};
}

export const roundOf=world=>Math.floor(world.tick/TIME.roundTicks)+1;
export const battleSeconds=world=>world.tick/TIME.ticksPerSecond;
export const clockText=tick=>{const s=Math.floor(tick/TIME.ticksPerSecond);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};

// Exactly what a later load continues from, and its fingerprint.
export const snapshotWorld=world=>JSON.stringify(world);
export function restoreWorld(text){
  const world=typeof text==='string'?JSON.parse(text):JSON.parse(JSON.stringify(text));
  if(world?.version!==WORLD_VERSION)throw new Error('This fight was saved by an incompatible version.');return world;
}
// Two FNV-1a lanes over the snapshot: a 64-bit fingerprint as hex.
export function worldHash(world){
  const text=snapshotWorld(world);let a=0x811c9dc5,b=0xcbf29ce4;
  for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);a=Math.imul(a^c,0x01000193)>>>0;b=Math.imul(b^c^(i&255),0x01000193)>>>0;}
  return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0');
}

// The actors the player may command: his soldier and the companions of his party.
export const commandable=(world,actor)=>!!actor&&(actor.id===world.heroId||world.party.includes(actor.id));
// Whether a command is legal now: null, or its reason code. Pure.
export function commandProblem(world,command){
  const actor=actorById(world,command?.actorId),p=command?.payload??{};
  if(world.status!=='active')return 'BATTLE_OVER';
  if(!commandable(world,actor))return 'NO_TARGET';
  if(!actor.alive||actor.down)return 'ACTOR_DOWN';
  if(actor.carriedBy)return 'ACTOR_DOWN';
  switch(command.kind){
    case 'move':return Number.isFinite(p.x)&&Number.isFinite(p.z)?null:'NO_TARGET';
    case 'attack':return actor.carrying?'CARRYING':validate(world,actor.id,'strike',{actorId:p.targetId,forced:!!p.forced});
    case 'ability':return ABILITIES[p.abilityId]&&!ABILITIES[p.abilityId].enemyOnly
      ?validate(world,actor.id,p.abilityId,{actorId:p.targetId,x:p.x,z:p.z,forced:!!p.forced}):'NO_TARGET';
    case 'interact':{const o=objectById(world,p.objectId);return !o?'NO_TARGET':o.done&&!o.toggle?'ALREADY_DONE':actor.carrying?'CARRYING':null;}
    case 'talk':{const o=actorById(world,p.targetId);return o?.alive&&!hostile(actor,o)&&o.talk?actor.drawn?'NEEDS_SHEATHED':null:'NO_TARGET';}
    case 'loot':{const o=actorById(world,p.targetId);return o&&!o.alive&&o.loot?.length?actor.drawn?'NEEDS_SHEATHED':null:'NO_TARGET';}
    // Taking from a body the soldier stands by: the items chosen so far (one queued take carries them all).
    case 'take':{
      const o=actorById(world,p.targetId);if(!o||o.alive||!Array.isArray(p.items)||!p.items.length||p.items.length>12)return 'NO_TARGET';
      const left=[...(o.loot??[])];for(const id of p.items){const i=left.indexOf(id);if(i<0)return 'NO_TARGET';left.splice(i,1);}
      return distanceBetween(actor,o)>MOVEMENT.talkRange+.5?'OUT_OF_RANGE':null;
    }
    case 'control':return actor.id===world.controlled?'ALREADY_CONTROLLED':null;
    case 'setStanding':return Array.isArray(p.slots)&&p.slots.length<=4&&p.slots.every(s=>!slotProblem(s))?null:'NO_TARGET';
    case 'setKit':return Array.isArray(p.kit)&&p.kit.length<=16&&p.kit.every(id=>ITEMS[id])?null:'NO_TARGET';
    case 'stop':case 'setDrawn':case 'setWalk':case 'warCry':return null;
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
  world.queue.push({tick:world.tick,actorId:command.actorId,kind:command.kind,payload:JSON.parse(JSON.stringify(command.payload??{})),seq:world.seq++});
  return {ok:true,reason:null};
}

const emit=(world,event)=>{world.events.push({tick:world.tick,...event});};
const endBrace=actor=>{actor.braceUntil=0;};

// Shift+click on a neutral (guide "Fighting"): he turns hostile at once, and the
// chronicle records it when the result is recorded (Public Confidence pays).
function provoke(world,actor,targetId){
  const other=actorById(world,targetId);if(!other||other.side!=='neutral')return;
  other.side='enemy';other.provokedBy=actor.id;if(other.ai){other.ai.state='engage';other.ai.focus=actor.id;other.ai.notice[actor.id]=100;}
  world.provoked.push({id:other.id,name:other.name,by:actor.id,tick:world.tick});emit(world,{kind:'provoked',actorId:actor.id,targetId:other.id});
}
// System 1: commands become intents.
function applyCommand(world,command){
  const actor=actorById(world,command.actorId),p=command.payload,reason=commandProblem(world,command);
  if(reason){emit(world,{kind:'rejected',actorId:command.actorId,reason});return;}
  if(p.forced&&p.targetId&&['attack','ability'].includes(command.kind))provoke(world,actor,p.targetId);
  switch(command.kind){
    case 'move':{
      cancelAction(world,actor);endBrace(actor);actor.lock=null;actor.order={kind:'move',...(actor.carrying?{setDown:true}:{})};
      const route=setRoute(world,actor,clampToMap(navGrid(world.map),p),{run:actor.carrying?false:null});
      if(route.reasonCode)emit(world,{kind:'blocked',actorId:actor.id,reason:route.reasonCode});
      if(!route.points.length){if(actor.carrying)setDown(world,actor);actor.order=null;}break;
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
        actor.order=null;actor.lock=null;actor.path=[];actor.gait=null;emit(world,{kind:'brace',actorId:actor.id});used(world,actor,'brace');break;
      }
      if(p.abilityId==='carry'&&actor.carrying){cancelAction(world,actor);actor.order=null;actor.path=[];setDown(world,actor);break;}
      actor.order={kind:'ability',abilityId:p.abilityId,targetId:p.targetId??null,x:p.x??null,z:p.z??null};actor.path=[];actor.gait=null;endBrace(actor);
      actor.repathAt=world.tick;if(actor.action?.kind==='swing'||actor.action?.kind==='work')cancelAction(world,actor);break;
    }
    case 'interact':cancelAction(world,actor);endBrace(actor);actor.lock=null;actor.order={kind:'interact',targetId:p.objectId};actor.path=[];actor.repathAt=world.tick;break;
    case 'talk':case 'loot':
      cancelAction(world,actor);endBrace(actor);actor.lock=null;actor.order={kind:command.kind,targetId:p.targetId,allowFallen:command.kind==='loot'};
      actor.path=[];actor.repathAt=world.tick;break;
    case 'stop':cancelAction(world,actor);actor.order=null;actor.lock=null;actor.path=[];actor.gait=null;break;
    case 'setDrawn':{
      // Combat mode is the party's: the soldier and every companion draw or sheathe together.
      const drawn=!!p.drawn;
      for(const a of world.actors)if(a.alive&&!a.down&&commandable(world,a)&&a.drawn!==drawn&&!(drawn&&a.carrying)){
        a.drawn=drawn;if(!drawn){a.lock=null;if(a.order?.kind==='attack')a.order=null;if(a.action?.kind==='swing'||a.action?.kind==='shot')cancelAction(world,a);}
      }
      emit(world,{kind:drawn?'draw':'sheathe',actorId:actor.id});break;
    }
    case 'setWalk':actor.walkMode=!!p.walk;if(actor.gait==='run'&&actor.walkMode)actor.gait='walk';break;
    case 'setOptions':
      for(const key of ['keepFighting','drawToAttack'])if(typeof p[key]==='boolean')world.options[key]=p[key];break;
    case 'control':{
      const before=actorById(world,world.controlled);world.controlled=actor.id;
      // The one left behind resumes his standing orders at his next decision.
      if(before&&before!==actor){before.order=null;before.lock=null;before.path=[];}
      emit(world,{kind:'control',actorId:actor.id});break;
    }
    case 'setStanding':actor.standing=p.slots.map(s=>[...s]);actor.standingSlot=-1;break;
    case 'setKit':actor.kit=[...p.kit];if(p.effects)actor.effects={...p.effects};break;
    case 'warCry':emit(world,{kind:'war-cry',actorId:actor.id});break;
    // Spoils are staged with the fight; the soldier's pack receives them only when the result is recorded.
    case 'take':{
      const body=actorById(world,p.targetId);
      for(const itemId of p.items){body.loot.splice(body.loot.indexOf(itemId),1);world.spoils.push({itemId,from:body.id});}
      emit(world,{kind:'taken',actorId:actor.id,targetId:body.id,items:[...p.items]});break;
    }
  }
}

// Talk and loot: walk to the person or the body, then the page opens the conversation or the loot window.
function arrivals(world){
  for(const actor of world.actors){
    const o=actor.order;if(!o||(o.kind!=='talk'&&o.kind!=='loot')||!actor.alive)continue;
    const other=actorById(world,o.targetId);if(!other){actor.order=null;continue;}
    if(distanceBetween(actor,other)<=MOVEMENT.talkRange){actor.order=null;actor.path=[];actor.gait=null;emit(world,{kind:o.kind,actorId:actor.id,targetId:other.id});}
  }
}

// The arena (no mission): the soldier falls, or the last enemy does.
function checkObjectives(world){
  const hero=actorById(world,world.heroId);
  if(!hero?.alive){world.status='lost';emit(world,{kind:'defeat'});return;}
  if(!world.actors.some(a=>a.side==='enemy'&&a.alive)){world.status='won';emit(world,{kind:'victory'});}
}

// The battle log: the events worth reading, with their battle time and place.
const nameOf=(world,id)=>actorById(world,id)?.name??objectById(world,id)?.name??'Someone';
function logLine(world,e){
  const by=nameOf(world,e.attackerId??e.actorId),to=nameOf(world,e.defenderId??e.targetId),what=e.missile?MISSILES[e.missile].name.toLowerCase():'blow';
  const a=/^[aeiou]/.test(what)?'an':'a';
  switch(e.kind){
    case 'hit':
      return `${by} hits ${to}${e.missile?` with ${a} ${what}`:''}: ${e.damage}${e.critical?e.ambush?' (ambush)':' (critical)':''}`+
        `${e.arc!=='front'?` from the ${e.arc==='rear'?'rear':'flank'}`:''}.`;
    case 'block':return `${to} blocks ${by}'s ${what}.`;
    case 'stuck':return `The pilum sticks in ${to}'s shield.`;
    case 'miss':return `${by} misses ${to}.`;
    case 'fall':return `${to} falls.`;
    case 'down':return `${to} is down. Bind his wounds or carry him.`;
    case 'stagger':return `${to} staggers.`;
    case 'notice':return actorById(world,e.actorId)?.practice?null:`${by} has seen ${to}.`;
    case 'brace':return `${by} braces behind his shield.`;
    case 'throw':return `${by} ${MISSILES[e.missile]?.shot?'shoots':'throws'} ${a} ${what}.`;
    case 'heal':return `${by} binds ${e.targetId===e.actorId?'his own wounds':`${to}’s wounds`}: +${e.amount}${e.raised?'; he is on his feet':''}.`;
    case 'lift':return `${by} lifts ${to}.`;
    case 'set-down':return `${by} sets ${to} down.`;
    case 'scout':return `${by} scouts the ground around him.`;
    case 'revealed':return `${by} is revealed${e.how==='scout'?' by scouting':''}.`;
    case 'reinforcements':return 'Enemy reinforcements arrive.';
    case 'secured':return 'A position is secured.';
    case 'pressure':return `Enemies hold the objective: the line weakens to ${e.defence}.`;
    case 'used-object':return `${by} finishes: ${nameOf(world,e.objectId)}.`;
    case 'work-stopped':return `${by}'s work is interrupted.`;
    case 'capability-needed':return `The objective is held, but you must still demonstrate: ${e.missing.join(', ')}.`;
    case 'war-cry':return `${by} raises the war cry. The companions answer.`;
    case 'provoked':return `${by} strikes ${to}, who was no enemy: he turns on the party.`;
    case 'taken':return `${by} takes ${e.items.map(id=>ITEMS[id]?.name.toLowerCase()??id).join(', ')} from ${to}.`;
    case 'victory':return world.mission?'The objective is secured.':'The road is clear.';
    case 'defeat':return world.mission?.reason??`${nameOf(world,world.heroId)} has fallen.`;
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
  if(world.status==='active'){
    // System 2: decisions at 4 Hz, staggered by actor: the party's standing orders, then enemy AI.
    world.actors.forEach((a,i)=>{
      if(!decidesThisTick(world,i))return;
      if(a.ai)decideEnemy(world,a);else if(a.standing&&a.id!==world.controlled)decideFriend(world,a);
    });
    moveActors(world);const hero=actorById(world,world.heroId);if(hero?.moving)used(world,hero,'move');
    act(world);arrivals(world);flyProjectiles(world);resolveBlows(world);settleLocks(world);regenerate(world);perceive(world);
    world.reveals=world.reveals.filter(r=>r.until>world.tick);
    if(world.mission)missionTick(world);else checkObjectives(world);
  }else world.projectiles=[];
  if((world.tick+1)%TIME.roundTicks===0)emit(world,{kind:'round',round:(world.tick+1)/TIME.roundTicks+1});
  writeLog(world);world.tick++;
  return world.events;
}
export function run(world,ticks){for(let i=0;i<ticks;i++)step(world);return world;}

// The route a move to `point` would take: { points, stopPoint, length,
// reasonCode?, gait } with walk or run as the click would choose. Pure.
export function routePreview(world,actorId,point){
  const actor=actorById(world,actorId);if(!actor)return null;const grid=navGrid(world.map),route=findRoute(grid,actor,clampToMap(grid,point));
  const wantsRun=route.length>MOVEMENT.runThreshold&&!actor.walkMode&&!actor.carrying,blockedRun=wantsRun&&engaged(world,actor);
  return {...route,gait:wantsRun&&!blockedRun?'run':'walk',...(blockedRun&&!route.reasonCode?{reasonCode:'ENGAGED_CANNOT_RUN'}:{})};
}
export {weaponOf,engaged,reachOf,missionProgress,liftable,staggered};

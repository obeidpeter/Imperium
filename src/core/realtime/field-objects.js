import {MORALE} from '../../data/realtime-squads.js';
import {MOVEMENT,TIME} from '../../data/realtime-rules.js';
import {actorById} from './abilities.js';
import {invalidateGrid,span} from './navigation.js';
import {alliedSides,fielded,membersOf,scorchSquad,squadsOf} from './squads.js';
import {burnActor} from './damage.js';

// The battlefield's objects in real time (guide "Field objects"; 0.38
// expanded-campaign.js and the edition-34 chapter opportunities): a side gate
// and a damaged footbridge on the wide maps, a timber barricade and a pitch
// brazier from Chapter III, and two opportunities (the stores and the signal,
// or their chapter's versions) of which only one can be taken, before the end
// of round 7. Each is used by working beside it while a ring fills (3 s); a
// blow stops the work. Pure and deterministic: the world's records hold every
// state, and nothing draws randomness.

const R=TIME.roundTicks;
const emit=(world,event)=>world.events.push({tick:world.tick,...event});
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const standing=o=>o.alive&&!o.down&&!o.carriedBy;
export const WORK_SECONDS=3,FIRE_RADIUS=3,FIRE_DAMAGE=2;
export {smokeBetween} from './sight.js';
export const OPPORTUNITIES=new Set(['stores','signal']);
// The default opportunities (before the edition-34 chapters relabel them).
export const DEFAULT_OPPORTUNITIES=Object.freeze({
  stores:Object.freeze({effect:'stores',description:'Recover 2 supplies on victory.'}),
  signal:Object.freeze({effect:'cohesion',description:'Raise friendly cohesion by 15 now and earn 2 Army Loyalty on victory.'})});
// What working at an object does, in its state; null when nothing is left to do.
export function fieldVerb(o){
  switch(o.kind){
    case 'gate':return o.state==='closed'?'Open gate':null;
    case 'bridge':return o.state==='damaged'?'Repair bridge':null;
    case 'barricade':return o.state==='intact'?'Dismantle':null;
    case 'brazier':return o.state==='unlit'?'Ignite':o.state==='burning'?'Extinguish':null;
    case 'stores':case 'signal':return o.state==='available'?'Secure objective':null;
    default:return null;
  }
}
export function fieldHint(world,o){
  switch(o.kind){
    case 'gate':return 'Opens the side route: the gate stops movement and sight while it is shut.';
    case 'bridge':return 'Repairs the footbridge: its crossing becomes a ford.';
    case 'barricade':return 'Dismantles it: defenders within 2 m lose its 1 extra protection.';
    case 'brazier':return o.state==='unlit'?`Lights the pitch: its smoke blocks sight, and it hurts both sides within 3 m at each round's end for ${world.weather==='rain'?'one round (rain)':'three rounds'}.`
      :'Puts the fire out.';
    default:{const opp=world.field?.opportunities?.[o.kind];return `${opp?.description??''} Only one opportunity can be taken; both close at the end of round ${world.field?.deadline}.`.trim();}
  }
}
// The current round (1-based) and whether an opportunity can still be taken.
const roundOf=world=>Math.floor(world.tick/R)+1;
export function fieldProblem(world,o){
  if(!o?.field)return null;
  if(!fieldVerb(o))return 'ALREADY_DONE';
  if(OPPORTUNITIES.has(o.kind)&&(world.field?.outcome!=='pending'||roundOf(world)>world.field.deadline))return 'OPPORTUNITY_CLOSED';
  return null;
}

// --- Terrain: a shut gate is a wall line across its opening; a repaired bridge a ford strip ----------
function setCells(world,o,type){
  const t=world.map.terrain;for(const [x,y]of o.cells)t[y][x]=type;invalidateGrid(world.map);world.map.rev=(world.map.rev??0)+1;
}
export function openGate(world,o,by=null){
  if(o.kind!=='gate'||o.state!=='closed')return false;o.state='open';o.done=true;setCells(world,o,o.under);
  emit(world,{kind:'field',objectId:o.id,what:'gate-open',actorId:by});return true;
}
export function repairBridge(world,o,by=null){
  if(o.kind!=='bridge'||o.state!=='damaged')return false;o.state='repaired';o.done=true;setCells(world,o,'ford');
  emit(world,{kind:'field',objectId:o.id,what:'bridge-repaired',actorId:by});return true;
}
const objectsOf=(world,kind)=>(world.objects??[]).filter(o=>o.field&&o.kind===kind);

// --- The opportunity's effect (0.38 applyChapterOpportunity, in the world) ---------------------------
const friendlySquads=world=>squadsOf(world).filter(q=>q.side!=='enemy'&&fielded(world,q));
const friendlySingles=world=>world.actors.filter(a=>standing(a)&&!a.squadId&&(a.id===world.heroId||world.party.includes(a.id)||world.mission?.escorts?.includes(a.id)));
function restore(world,points){
  for(const q of friendlySquads(world))q.strength=Math.min(q.maxStrength,q.strength+points,membersOf(world,q).length*q.perMan);
  for(const a of friendlySingles(world))a.hp=Math.min(a.maxHp,a.hp+points);
}
function applyOpportunity(world,effect){
  const f=world.field;
  switch(effect){
    case 'cohesion':for(const q of friendlySquads(world))q.cohesion=clamp(q.cohesion+15);break;
    case 'medicine':restore(world,3);break;
    case 'water':restore(world,2);for(const o of objectsOf(world,'brazier'))if(o.state==='burning'){o.state='spent';o.done=true;o.rounds=0;}break;
    // Protected columns move half as fast again (0.38: three tiles a round instead of two).
    case 'escort':f.escortPace=3;for(const id of world.mission?.escorts??[]){const e=actorById(world,id);if(e)e.pace=(e.pace??MOVEMENT.walk)*1.5;}break;
    case 'intelligence':
      for(const a of world.actors)if(a.hidden&&a.alive){a.hidden=false;emit(world,{kind:'revealed',actorId:a.id});}
      for(const w of world.mission?.waves??[])if(!w.arrived)w.round+=1;break;
    case 'disrupt':for(const q of squadsOf(world))if(q.side==='enemy'&&fielded(world,q)&&membersOf(world,q).some(m=>!m.hidden))q.cohesion=clamp(q.cohesion-15);break;
    case 'integrity':if(world.mission)world.mission.defence=Math.max(world.mission.defence,Math.min(100,world.mission.defence+20));break;
    case 'engineering':for(const o of objectsOf(world,'gate'))openGate(world,o);for(const o of objectsOf(world,'bridge'))repairBridge(world,o);break;
    case 'standard':for(const q of friendlySquads(world)){q.cohesion=clamp(q.cohesion+20);q.morale=clamp(q.morale+10);if(q.broken&&q.morale>MORALE.broken){q.broken=false;emit(world,{kind:'squad-rallied',squadId:q.id});}}break;
    case 'command':if(world.command){const before=world.command.capacity;world.command.capacity=Math.min(8,before+1);world.command.left+=world.command.capacity-before;}break;
    case 'anti-charge':f.cavalryDenied=true;break;
    // 'stores' and the Army half of 'cohesion' are paid on victory (campaign-encounter.js).
  }
}

// --- Using an object: the work has finished (actions.js) -----------------------------------------
export function useFieldObject(world,actor,o){
  const problem=fieldProblem(world,o);
  if(problem){emit(world,{kind:'rejected',actorId:actor.id,reason:problem});return false;}
  o.by=actor.id;o.at=world.tick;
  switch(o.kind){
    case 'gate':openGate(world,o,actor.id);break;
    case 'bridge':repairBridge(world,o,actor.id);break;
    case 'barricade':o.state='dismantled';o.done=true;emit(world,{kind:'field',objectId:o.id,what:'barricade-dismantled',actorId:actor.id});break;
    case 'brazier':
      if(o.state==='unlit'){o.state='burning';o.rounds=world.weather==='rain'?1:3;emit(world,{kind:'field',objectId:o.id,what:'brazier-lit',actorId:actor.id});}
      else{o.state='spent';o.done=true;o.rounds=0;emit(world,{kind:'field',objectId:o.id,what:'brazier-out',actorId:actor.id});}
      break;
    default:{
      const f=world.field;f.choice=o.kind;f.outcome='secured';o.state='secured';o.done=true;
      for(const other of world.objects.filter(x=>x.field&&OPPORTUNITIES.has(x.kind)&&x!==o)){other.state='forgone';other.done=true;}
      applyOpportunity(world,f.opportunities?.[o.kind]?.effect??DEFAULT_OPPORTUNITIES[o.kind].effect);
      emit(world,{kind:'field',objectId:o.id,what:'opportunity',actorId:actor.id,label:o.name});
    }
  }
  emit(world,{kind:'used-object',actorId:actor.id,objectId:o.id,what:o.kind});
  return true;
}

// --- The round's end: the fire burns those near it and burns down; the opportunities close --------
export function fieldRound(world){
  if(!world.field)return;
  for(const o of objectsOf(world,'brazier')){
    if(o.state!=='burning')continue;
    for(const q of squadsOf(world))if(fielded(world,q)&&membersOf(world,q).some(m=>span(m.x-o.x,m.z-o.z)<=FIRE_RADIUS))scorchSquad(world,q,FIRE_DAMAGE,o);
    for(const a of world.actors)if(standing(a)&&!a.squadId&&span(a.x-o.x,a.z-o.z)<=FIRE_RADIUS)burnActor(world,a,FIRE_DAMAGE);
    emit(world,{kind:'field',objectId:o.id,what:'brazier-burns'});
    if(--o.rounds<=0){o.state='spent';o.done=true;o.rounds=0;emit(world,{kind:'field',objectId:o.id,what:'brazier-out'});}
  }
  const f=world.field;
  if(f.outcome==='pending'&&roundOf(world)>=f.deadline){
    f.outcome='missed';for(const o of world.objects)if(o.field&&OPPORTUNITIES.has(o.kind)){o.state='missed';o.done=true;}
    emit(world,{kind:'field',what:'opportunities-closed'});
  }
}

export {actorById,alliedSides};

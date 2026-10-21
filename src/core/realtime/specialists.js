import {ABILITIES,TIME} from '../../data/realtime-rules.js';
import {COHESION,EXCHANGE,MORALE,RALLY,SPECIALISTS} from '../../data/realtime-squads.js';
import {actorById,distanceBetween,hostile} from './abilities.js';
import {crossesCover,navGrid,span} from './navigation.js';
import {alliedSides,fielded,squadCentre,squadOf,squadsOf,squadModifiers} from './squads.js';

// Rally and the specialists' actions (guide "Techniques", "Specialists"; build
// brief §3.6): what each needs (validate) and what it does (use). A
// specialist's action costs one Command and takes his attention for a round;
// in his standing orders it uses only Command left unspent at the round's end.
// Pure, deterministic and free of randomness.

const R=TIME.roundTicks;
const emit=(world,event)=>world.events.push({tick:world.tick,...event});
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const standing=o=>o.alive&&!o.down&&!o.carriedBy;
export const SPECIAL=new Set(['rally','guard','inspire','volley']);
export const rallyRadius=actor=>RALLY.radius+Math.max(0,(actor.attributes?.auth??10)-10)*RALLY.perAuthority+(actor.effects?.rallyRadius??0);
const busyWithSpecial=(world,actor)=>(actor.attentionUntil??0)>world.tick;

// Why it cannot be used now, or null. Called from abilities.validate.
export function validateSpecial(world,actor,abilityId,other){
  const ability=ABILITIES[abilityId];
  if(abilityId==='rally'){
    if((actor.cooldowns?.rally??0)>world.tick)return 'RECOVERING';if(actor.stamina<ability.cost.stamina)return 'NOT_ENOUGH_STAMINA';return null;
  }
  if(!world.command||world.command.left<(ability.cost.command??1))return 'NO_COMMAND';
  if(busyWithSpecial(world,actor))return 'RECOVERING';
  if(abilityId==='guard'){
    const friend=other;if(!friend||friend===actor||hostile(actor,friend))return 'NOT_FRIENDLY';
    if(!standing(friend))return 'TARGET_DOWN';
    if(distanceBetween(actor,friend)>SPECIALISTS.guard.range+.6)return 'OUT_OF_RANGE';return null;
  }
  if(abilityId==='inspire')return null;
  if(abilityId==='volley'){
    if((actor.volleys??0)<=0)return 'NO_VOLLEYS';if(!other||!standing(other))return 'NO_TARGET';if(!hostile(actor,other))return 'FRIENDLY';
    if(other.hidden)return 'NO_TARGET';if(distanceBetween(actor,other)>SPECIALISTS.volley.range)return 'OUT_OF_RANGE';
    if(crossesCover(navGrid(world.map),actor,other))return 'NO_LINE_OF_SIGHT';return null;
  }
  return 'NO_TARGET';
}

// The effect, at once (startAbility). Returns nothing; emits what happened.
export function useSpecial(world,actor,abilityId,target){
  const ability=ABILITIES[abilityId];actor.order=null;actor.path=[];actor.gait=null;
  if(abilityId==='rally'){
    actor.stamina-=ability.cost.stamina;actor.cooldowns={...actor.cooldowns,rally:world.tick+Math.round(ability.recovery_s*TIME.ticksPerSecond)};
    const radius=rallyRadius(actor),rallied=[];
    for(const squad of squadsOf(world)){
      if(!fielded(world,squad)||!alliedSides(squad.side,actor.side))continue;const c=squadCentre(world,squad);if(span(c.x-actor.x,c.z-actor.z)>radius)continue;
      squad.morale=clamp(squad.morale+RALLY.morale);squad.suppression=0;squad.cohesion=clamp(squad.cohesion+COHESION.rally);rallied.push(squad.id);
      if(squad.broken&&squad.morale>MORALE.broken){squad.broken=false;emit(world,{kind:'squad-rallied',squadId:squad.id});}
    }
    emit(world,{kind:'rally',actorId:actor.id,radius,squads:rallied});
    if(actor.id===world.heroId&&!world.used.includes('rally'))world.used.push('rally');
    return;
  }
  // A specialist's action: one Command now, and his attention for a round.
  world.command.left-=ability.cost.command??1;actor.attentionUntil=world.tick+R;
  if(abilityId==='guard'){
    const friend=target,until=world.tick+R*SPECIALISTS.guard.rounds;
    actor.braceUntil=until;actor.guarding={id:friend.id,until};
    friend.guardedBy={id:actor.id,until,reduction:SPECIALISTS.guard.reduction};
    const squad=squadOf(world,friend);if(squad)squad.guard={by:actor.id,until,reduction:SPECIALISTS.guard.reduction};
    emit(world,{kind:'guard',actorId:actor.id,targetId:friend.id});return;
  }
  if(abilityId==='inspire'){
    const inspired=[];
    for(const squad of squadsOf(world)){
      if(!fielded(world,squad)||!alliedSides(squad.side,actor.side))continue;const c=squadCentre(world,squad);if(span(c.x-actor.x,c.z-actor.z)>SPECIALISTS.inspire.radius)continue;
      squad.morale=clamp(squad.morale+SPECIALISTS.inspire.morale);squad.braced=true;inspired.push(squad.id);
      if(squad.broken&&squad.morale>MORALE.broken){squad.broken=false;emit(world,{kind:'squad-rallied',squadId:squad.id});}
    }
    for(const o of world.actors)if(standing(o)&&!o.squadId&&alliedSides(o.side,actor.side)&&distanceBetween(o,actor)<=SPECIALISTS.inspire.radius)o.braceUntil=Math.max(o.braceUntil,world.tick+R);
    emit(world,{kind:'inspire',actorId:actor.id,squads:inspired});return;
  }
  if(abilityId==='volley'){
    actor.volleys=(actor.volleys??0)-1;
    const squad=squadOf(world,target);
    if(squad){
      // Against a squad, a whole 0.38 ranged hit (veterans.js: a volley resolves as a ranged attack).
      // The volley's shooter stands in for a fresh squad of archers where he is.
      const setup=squadModifiers(world,{...squad,id:`volley:${actor.id}`,members:[],role:'archer',side:actor.side,damage:null,cohesion:100,suppression:0,morale:100,formation:null,runUp:0,
        x:actor.x,z:actor.z},squad,{ranged:true});
      volleyOnSquad(world,actor,squad,setup.damage);
    }else world.blows.push({attackerId:actor.id,defenderId:target.id,missile:'arrow',profile:SPECIALISTS.volley.damage,from:{x:actor.x,z:actor.z}});
    emit(world,{kind:'volley',actorId:actor.id,targetId:target.id,squadId:squad?.id??null});
  }
}
function volleyOnSquad(world,actor,squad,damage){
  const before=squad.members.filter(id=>{const m=actorById(world,id);return m&&standing(m);}).length;
  squad.strength=Math.max(0,squad.strength-damage);
  squad.morale=clamp(squad.morale-Math.max(1,MORALE.hit-(squad.formation==='line'?MORALE.line:0)-squad.moraleResistance));
  squad.cohesion=clamp(squad.cohesion-COHESION.ranged);squad.suppression=Math.min(3,squad.suppression+1);
  const keep=Math.max(0,Math.ceil(squad.strength/squad.perMan-1e-9));
  const men=squad.members.map(id=>actorById(world,id)).filter(m=>m&&standing(m)).sort((a,b)=>distanceBetween(actor,a)-distanceBetween(actor,b)||a.slot-b.slot);
  for(const m of men.slice(0,Math.max(0,before-keep))){
    m.alive=false;m.diedAt=world.tick;m.killedBy=actor.id;actor.kills++;
    emit(world,{kind:'fall',attackerId:actor.id,defenderId:m.id,squadId:squad.id,missile:'arrow',volley:true});
  }
  // Strength is already paid here: the men felled are not charged again as single blows would be.
  if(!fielded(world,squad)){squad.strength=0;emit(world,{kind:'squad-destroyed',squadId:squad.id,attackerId:actor.id});}
  else if(!squad.broken&&squad.morale<=MORALE.broken){squad.broken=true;squad.order=null;squad.path=[];emit(world,{kind:'squad-broken',squadId:squad.id});}
}

// Just before the round's Command refills, specialists whose standing orders
// name their action use what Command is left, in the party's order.
export function specialistStanding(world,{plan}){
  if(!world.command)return;
  for(const id of world.party){
    if(world.command.left<1)return;
    const actor=actorById(world,id);if(!actor||!standing(actor)||actor.id===world.controlled||busyWithSpecial(world,actor))continue;
    for(const slot of actor.standing??[]){
      const ability={protect:'guard',inspire:'inspire',volley:'volley'}[slot[0]];if(!ability||!actor.abilities?.includes(ability))continue;
      const target=plan(world,actor,slot);if(target===undefined)continue;
      if(validateSpecial(world,actor,ability,target))continue;
      useSpecial(world,actor,ability,target);break;
    }
  }
}
export {EXCHANGE};

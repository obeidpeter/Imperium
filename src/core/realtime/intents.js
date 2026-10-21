import {ABILITIES,REASONS} from '../../data/realtime-rules.js';
import {actorById,distanceBetween,forecast,hostile,validate} from './abilities.js';
import {routePreview} from './simulation.js';

// What the pointer would do where it is (§3.14): a cursor state, the message
// line's words and the Command a click there gives. Pure: pointing and
// reading spend nothing and change nothing.
// pick: {actorId} for a person under the pointer, and/or {x, z} for ground.

const pct=n=>`${Math.round(n*100)}%`;
const range=d=>d.min===d.max?`${d.min}`:`${d.min}–${d.max}`;
// One line for a blow's forecast: the chance it lands, its damage and the modifiers that apply.
export function blowSummary(f){
  if(!f?.blow)return f?.message??'';
  const b=f.blow,parts=[`${pct(b.hit)} to hit`];
  if(b.block>0)parts.push(`his shield blocks ${pct(b.block)}`);
  parts.push(`${pct(b.land)} lands`,`${range(b.damage)} damage`,`critical ${range(b.criticalDamage)}`);
  const mods=b.mods.map(m=>m.value?`${m.label} ${m.value>0?'+':''}${m.kind==='block'?pct(m.value):m.value}`:m.label);
  return `${parts.join(', ')}.${mods.length?` ${mods.join('; ')}.`:''}`;
}
const metres=n=>`${Math.round(n)} m`;

export function pointerIntent(world,{actorId=world.controlled,pick={},button='left',shift=false,abilityId='strike'}={}){
  const actor=actorById(world,actorId),none={cursor:'blocked',message:'',command:null,reason:null};
  if(world.status!=='active')return {...none,reason:'BATTLE_OVER',message:REASONS.BATTLE_OVER};
  if(!actor?.alive)return {...none,reason:'ACTOR_DOWN',message:REASONS.ACTOR_DOWN};
  const other=pick.actorId?actorById(world,pick.actorId):null,person=other?.alive&&other!==actor?other:null;
  if(button==='right'&&abilityId!=='strike'){
    const ability=ABILITIES[abilityId];if(!ability)return none;
    const target=ability.target==='self'?{}:person?{actorId:person.id,forced:shift}:ability.groundTarget&&Number.isFinite(pick.x)?{x:pick.x,z:pick.z}:{};
    const reason=validate(world,actor.id,abilityId,target),f=forecast(world,actor.id,abilityId,target);
    const where=person?` ${person.name}`:target.x!==undefined?` there (${metres(distanceBetween(actor,target))})`:'';
    return {cursor:reason?'ability_invalid':'ability_valid',reason,forecast:f,
      message:reason?`${ability.name}: ${REASONS[reason]}`:`${ability.name}${where}${f.blow?`: ${blowSummary(f)}`:`. ${ability.summary}`}`,
      command:reason?null:{actorId:actor.id,kind:'ability',payload:{abilityId,...(target.actorId?{targetId:target.actorId}:{}),
        ...(target.x!==undefined?{x:target.x,z:target.z}:{}),...(shift?{forced:true}:{})}}};
  }
  if(person&&(hostile(actor,person)||shift)){
    const reason=validate(world,actor.id,'strike',{actorId:person.id,forced:shift}),f=forecast(world,actor.id,'strike',{actorId:person.id,forced:shift});
    if(reason)return {...none,reason,message:REASONS[reason]};
    const draws=actor.drawn||world.options.drawToAttack;
    return {cursor:draws?'attack':'walk',reason:null,forecast:f,
      message:draws?`Attack ${person.name}: ${blowSummary(f)}`:`Walk to ${person.name}. Draw to attack is off: press Space to draw your weapon.`,
      command:{actorId:actor.id,kind:'attack',payload:{targetId:person.id,...(shift?{forced:true}:{})}}};
  }
  if(person)return {...none,cursor:'walk',message:person.name};
  if(!Number.isFinite(pick.x)||!Number.isFinite(pick.z))return none;
  const route=routePreview(world,actor.id,pick);
  if(route.reasonCode==='PATH_BLOCKED')return {cursor:'blocked',reason:'PATH_BLOCKED',route,message:REASONS.PATH_BLOCKED,
    command:route.points.length?{actorId:actor.id,kind:'move',payload:{x:pick.x,z:pick.z}}:null};
  return {cursor:route.gait,reason:route.reasonCode??null,route,
    message:route.reasonCode?REASONS[route.reasonCode]:`${route.gait==='run'?'Run':'Walk'} ${metres(route.length)}.`,
    command:route.points.length?{actorId:actor.id,kind:'move',payload:{x:pick.x,z:pick.z}}:null};
}

// T: the next target in one fixed order, visible enemies nearest first.
// Shift+T: the next friend. Returns an actor id or null.
export function nextTarget(world,{actorId=world.controlled,current=null,friends=false}={}){
  const actor=actorById(world,actorId);if(!actor)return null;
  const list=world.actors.filter(o=>o.alive&&o!==actor&&(friends?!hostile(actor,o):hostile(actor,o)))
    .sort((a,b)=>distanceBetween(actor,a)-distanceBetween(actor,b)||(a.id<b.id?-1:1));
  if(!list.length)return null;const at=list.findIndex(o=>o.id===current);return list[(at+1)%list.length].id;
}

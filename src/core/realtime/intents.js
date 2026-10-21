import {ABILITIES,REASONS} from '../../data/realtime-rules.js';
import {actorById,distanceBetween,forecast,hostile,liftable,validate} from './abilities.js';
import {routePreview} from './simulation.js';
import {objectById} from './motion.js';

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
  const other=pick.actorId?actorById(world,pick.actorId):null,person=other?.alive&&other!==actor&&!other.hidden?other:null;
  const object=pick.objectId?objectById(world,pick.objectId):null;
  const knows=id=>!actor.abilities||actor.abilities.includes(id);
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
  // Objects: walk over and use them (a chest, a gate, a bridge).
  if(object&&button==='left'){
    if(object.done&&!object.toggle)return {...none,cursor:'blocked',message:`${object.name}: done.`};
    return {cursor:'use',reason:null,message:`Use: ${object.name}. ${object.hint??'Your soldier walks over and works for a few seconds; a blow stops him.'}`,
      command:{actorId:actor.id,kind:'interact',payload:{objectId:object.id}}};
  }
  // A fallen enemy: search him. A fallen comrade: lift him (weapon sheathed).
  if(other&&!other.alive&&button==='left'){
    if(!other.loot?.length)return {...none,cursor:'blocked',message:`${other.name} carried nothing worth taking.`};
    return actor.drawn?{...none,cursor:'blocked',reason:'NEEDS_SHEATHED',message:`Search ${other.name}: ${REASONS.NEEDS_SHEATHED}`}
      :{cursor:'use',reason:null,message:`Search ${other.name}.`,command:{actorId:actor.id,kind:'loot',payload:{targetId:other.id}}};
  }
  if(person&&liftable(person)&&button==='left'&&!hostile(actor,person)&&!actor.carrying){
    if(!knows('carry'))return {...none,cursor:'blocked',reason:'NOT_LEARNT',message:`${person.name} is down. Bind his wounds (right button) or learn to carry.`};
    const reason=validate(world,actor.id,'carry',{actorId:person.id});
    return reason?{...none,cursor:'blocked',reason,message:`Lift ${person.name}: ${REASONS[reason]}`}
      :{cursor:'use',reason:null,message:`Lift ${person.name}. You can only walk while you carry him; click ground to set him down there.`,
        command:{actorId:actor.id,kind:'ability',payload:{abilityId:'carry',targetId:person.id}}};
  }
  if(person&&person.talk&&button==='left'&&!hostile(actor,person)&&!shift){
    return actor.drawn?{...none,cursor:'blocked',reason:'NEEDS_SHEATHED',message:`Talk to ${person.name}: ${REASONS.NEEDS_SHEATHED}`}
      :{cursor:'talk',reason:null,message:`Talk to ${person.name}.`,command:{actorId:actor.id,kind:'talk',payload:{targetId:person.id}}};
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
  if(actor.carrying&&route.points.length)return {cursor:'walk',reason:null,route,message:`Carry him there and set him down (${metres(route.length)}, walking).`,
    command:{actorId:actor.id,kind:'move',payload:{x:pick.x,z:pick.z}}};
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
  const near=(a,b)=>distanceBetween(actor,a)-distanceBetween(actor,b)||(a.id<b.id?-1:1);
  const list=friends?world.actors.filter(o=>o.alive&&o!==actor&&!hostile(actor,o)).sort(near)
    :[...world.actors.filter(o=>o.alive&&!o.down&&!o.hidden&&hostile(actor,o)).sort(near),
      ...world.actors.filter(o=>o.alive&&o!==actor&&!hostile(actor,o)&&(o.talk||liftable(o))).sort(near),
      ...(world.objects??[]).filter(o=>!o.done||o.toggle).sort(near),
      ...world.actors.filter(o=>!o.alive&&o.loot?.length).sort(near)];
  if(!list.length)return null;const at=list.findIndex(o=>o.id===current);return list[(at+1)%list.length].id;
}
// E: the nearest thing within 3 m to talk to, use, search or lift, as a pointer intent.
export function nearestUse(world,{actorId=world.controlled}={}){
  const actor=actorById(world,actorId);if(!actor)return null;
  const things=[...(world.objects??[]).filter(o=>!o.done||o.toggle).map(o=>({d:distanceBetween(actor,o),pick:{objectId:o.id}})),
    ...world.actors.filter(o=>o!==actor&&(o.alive&&!hostile(actor,o)&&(o.talk||liftable(o))||!o.alive&&o.loot?.length)).map(o=>({d:distanceBetween(actor,o),pick:{actorId:o.id}}))]
    .filter(t=>t.d<=3).sort((a,b)=>a.d-b.d);
  return things.length?pointerIntent(world,{actorId,pick:things[0].pick,button:'left'}):null;
}

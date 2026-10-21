import {ABILITIES,FIELD_BAR,FIELD_ORDER,REASONS} from '../../data/realtime-rules.js';
import {actorById,distanceBetween,forecast,hostile,liftable,validate} from './abilities.js';
import {commandProblem,commandable,routePreview} from './simulation.js';
import {objectById} from './motion.js';
import {fieldHint,fieldProblem,fieldVerb} from './field-objects.js';

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
    // A field object says what the work does, or why it cannot be done now (field-objects.js).
    const problem=fieldProblem(world,object);if(problem)return {...none,cursor:'blocked',reason:problem,message:`${object.name}: ${REASONS[problem]}`};
    // Shift forces an attack on a gate or a barricade: he hacks it open or apart, taking twice as long.
    if(shift&&object.field&&['gate','barricade'].includes(object.kind))return {cursor:'attack',reason:null,
      message:`Break ${object.kind==='gate'?'open':'down'}: ${object.name}. Twice as long as using it; a blow stops the work.`,
      command:{actorId:actor.id,kind:'interact',payload:{objectId:object.id,force:true}}};
    const verb=object.field?fieldVerb(object):'Use',hint=object.field?`${fieldHint(world,object)} A blow stops the work.`:object.hint??'Your soldier walks over and works for a few seconds; a blow stops him.';
    return {cursor:'use',reason:null,message:`${verb}: ${object.name}. ${hint}`,
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

// The Command list (guide "Command list", build brief §3.16): everything the
// chosen man can be told to do, grouped by what it acts on — himself, the
// enemies in sight, friends, objects, the fallen and places — each with the
// Command a Use gives, or the reason it cannot be given now. It reaches every
// action the scene's pointer and keys reach, and works while paused. Pure.
export function commandOptions(world,{actorId=world.controlled}={}){
  const actor=actorById(world,actorId),out=[];if(!actor||!commandable(world,actor))return out;
  const known=FIELD_ORDER.filter(id=>(actor.abilities??FIELD_BAR).includes(id)&&!ABILITIES[id].enemyOnly);
  const add=(group,label,command,{detail='',subject=null}={})=>{
    const reason=commandProblem(world,command);
    out.push({group,label,subject,command:reason?null:command,reason,message:reason?REASONS[reason]??'That cannot be done now.':null,detail});
  };
  const order=(kind,payload={})=>({actorId:actor.id,kind,payload});
  const near=(a,b)=>distanceBetween(actor,a)-distanceBetween(actor,b)||(a.id<b.id?-1:1),m=n=>`${Math.round(n)} m`;
  // Himself.
  add('Yourself',actor.drawn?'Sheathe weapons':'Draw weapons',order('setDrawn',{drawn:!actor.drawn}));
  add('Yourself',actor.walkMode?'Run on far orders':'Walk everywhere',order('setWalk',{walk:!actor.walkMode}));
  add('Yourself','Stop',order('stop'));
  for(const id of known.filter(id=>ABILITIES[id].target==='self'||ABILITIES[id].selfIfNoTarget))add('Yourself',ABILITIES[id].name,order('ability',{abilityId:id}));
  if(actor.carrying)add('Yourself','Set him down here',order('ability',{abilityId:'carry'}));
  add('Yourself','Raise the war cry',order('warCry'));
  // Enemies in sight: each man alone, and each enemy squad once (its nearest man).
  const enemies=world.actors.filter(o=>o.alive&&!o.down&&!o.hidden&&hostile(actor,o)).sort(near),seen=new Set();
  for(const e of enemies.filter(o=>!o.squadId||!seen.has(o.squadId)&&seen.add(o.squadId))){
    const f=forecast(world,actor.id,'strike',{actorId:e.id}),name=e.squadId?`${e.name} (${world.squads.find(q=>q.id===e.squadId)?.name??'a squad'})`:e.name;
    add('Enemies',`Attack ${name}`,order('attack',{targetId:e.id}),{subject:e.id,detail:`${m(distanceBetween(actor,e))}. ${f.blow?blowSummary(f):''}`});
    for(const id of known.filter(id=>id!=='strike'&&ABILITIES[id].target==='enemy'))add('Enemies',`${ABILITIES[id].name}: ${name}`,order('ability',{abilityId:id,targetId:e.id}),{subject:e.id});
  }
  // Friends and neutrals: tend, lift, guard, talk, take control, or force an attack on a neutral.
  // The men of our squads are ordered as squads (the squad's own list), not one by one.
  for(const o of world.actors.filter(o=>o.alive&&o!==actor&&!hostile(actor,o)&&!o.carriedBy&&!o.squadId).sort(near)){
    const where=m(distanceBetween(actor,o));
    for(const id of known.filter(id=>ABILITIES[id].target==='ally'&&!['bind_wounds','carry'].includes(id)))
      add('Friends',`${ABILITIES[id].name}: ${o.name}`,order('ability',{abilityId:id,targetId:o.id}),{subject:o.id,detail:where});
    if(known.includes('bind_wounds'))add('Friends',`Bind wounds: ${o.name}`,order('ability',{abilityId:'bind_wounds',targetId:o.id}),{subject:o.id,detail:`${where}, ${o.hp} of ${o.maxHp} Health${o.down?', down':''}.`});
    if(known.includes('carry')&&liftable(o))add('Friends',`Lift ${o.name}`,order('ability',{abilityId:'carry',targetId:o.id}),{subject:o.id,detail:where});
    if(o.talk)add('Friends',`Talk to ${o.name}`,order('talk',{targetId:o.id}),{subject:o.id,detail:where});
    if(commandable(world,o)&&o.id!==world.controlled)add('Friends',`Take control of ${o.name}`,{actorId:o.id,kind:'control',payload:{}},{subject:o.id});
    if(o.side==='neutral')add('Friends',`Force an attack on ${o.name}`,order('attack',{targetId:o.id,forced:true}),{subject:o.id,detail:'He is no enemy: striking him turns him hostile and costs Public Confidence.'});
  }
  // Objects, the fallen and places.
  for(const o of (world.objects??[]).filter(o=>!o.done||o.toggle).sort(near))add('Objects',`${o.field?fieldVerb(o):'Use'}: ${o.name}`,order('interact',{objectId:o.id}),
    {subject:o.id,detail:`${m(distanceBetween(actor,o))}.${o.field?` ${fieldHint(world,o)}`:''}`});
  for(const b of world.actors.filter(o=>!o.alive&&o.loot?.length).sort(near))add('The fallen',`Search ${b.name}`,order('loot',{targetId:b.id}),{subject:b.id,detail:m(distanceBetween(actor,b))});
  const places=[];
  if(world.mission?.goal)places.push({name:'The objective marker',x:world.mission.goal.x,z:world.mission.goal.z});
  for(const p of world.mission?.points??[])if(!p.secured)places.push({name:'A position to secure',x:p.x,z:p.z});
  if(actor.id!==world.heroId){const h=actorById(world,world.heroId);if(h?.alive)places.push({name:`Beside ${h.name}`,x:h.x,z:h.z});}
  for(const p of places)add('Places',`Move to ${p.name.toLowerCase().startsWith('beside')?p.name:p.name.toLowerCase()}`,order('move',{x:p.x,z:p.z}),{detail:m(distanceBetween(actor,p))});
  return out;
}

// A number key (guide "Abilities"): the first press chooses the ability for
// the right button; a second press uses it on the chosen target (T), or on
// yourself when there is none and the ability allows it. With quick-cast on,
// one press uses it at the pointer at once. Returns the ability now chosen,
// the Command to give (or null) and what to tell the player. Pure.
export function abilityKey(world,{actorId=world.controlled,abilityId,current='strike',keyTarget=null,pointer=null,quickCast=false}={}){
  const ability=ABILITIES[abilityId];if(!ability)return {current,command:null,message:'No ability in that place.',warning:false};
  if(quickCast&&pointer&&abilityId!=='strike'){
    const it=pointerIntent(world,{actorId,pick:pointer,button:'right',abilityId});
    return {current:abilityId,command:it.command,message:it.command?`${ability.name}.`:it.message||REASONS.NO_TARGET,warning:!it.command};
  }
  if(current!==abilityId)return {current:abilityId,command:null,message:`${ability.name} is ready: right-click the target, or press its number again.`,warning:false};
  if(abilityId==='strike')return keyTarget?{current,command:{actorId,kind:'attack',payload:{targetId:keyTarget}},message:'Strike.',warning:false}
    :{current,command:null,message:REASONS.NO_TARGET,warning:true};
  const self=ability.target==='self'||ability.selfIfNoTarget&&!keyTarget;
  const reason=validate(world,actorId,abilityId,self?{}:{actorId:keyTarget});
  if(reason)return {current,command:null,message:`${ability.name}: ${REASONS[reason]}`,warning:true};
  return {current,command:{actorId,kind:'ability',payload:{abilityId,...(keyTarget&&!self?{targetId:keyTarget}:{})}},message:`${ability.name}.`,warning:false};
}

// Auto-pause (guide "Time: pause, slow and step"): whether an event stops the
// world under the player's choices, and the reason the page announces, or
// null. An enemy coming into view, the soldier or a companion badly hurt or
// down, a new objective, an order that cannot be carried out, and (if chosen)
// every round. A drill partner's glance never pauses. Pure.
export function autoPauseReason(world,e,options={}){
  if(world.kind==='camp')return null;
  const party=new Set([world.heroId,...world.party]),mine=world.controlled,name=id=>actorById(world,id)?.name??'Someone';
  if(e.kind==='round'&&options.roundPause)return `Round ${e.round} begins.`;
  if(e.kind==='notice'&&options.pauseSighted&&party.has(e.targetId)&&!actorById(world,e.actorId)?.practice)
    return `${name(e.actorId)} has seen ${e.targetId===mine?'you':name(e.targetId)}.`;
  if(e.kind==='hit'&&options.pauseHurt&&party.has(e.defenderId)){
    const d=actorById(world,e.defenderId);if(d?.alive&&!d.down&&d.hp<d.maxHp*.25&&d.hp+e.damage>=d.maxHp*.25)return `${d.id===mine?'You are':`${d.name} is`} badly hurt.`;
  }
  // Enemies come into view another way too: an ambush revealed, reinforcements arriving.
  if(e.kind==='revealed'&&options.pauseSighted&&actorById(world,e.actorId)?.side==='enemy'){
    const a=actorById(world,e.actorId),q=a.squadId?world.squads?.find(x=>x.id===a.squadId):null;return `${q?q.name:a.name} ${q?'are':'is'} revealed.`;
  }
  if(e.kind==='reinforcements'&&options.pauseSighted)return 'Enemy reinforcements arrive.';
  if(e.kind==='down'&&options.pauseHurt&&party.has(e.defenderId))return `${name(e.defenderId)} is down.`;
  if(e.kind==='phase'&&options.pauseObjective)return `New objective: ${e.label}.`;
  if(e.kind==='rejected'&&options.pauseOrder&&party.has(e.actorId))return `${name(e.actorId)}: ${REASONS[e.reason]??'the order cannot be carried out.'}`;
  // One of our squads breaks (from Chapter IV).
  if(e.kind==='squad-broken'&&options.pauseSquad){const q=world.squads?.find(x=>x.id===e.squadId);if(q&&q.side!=='enemy')return `${q.name} breaks.`;}
  return null;
}

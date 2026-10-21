import {ABILITIES,STANDING} from '../../data/realtime-rules.js';
import {actorById,distanceBetween,hostile,staggered,validate} from './abilities.js';
import {derivedValues} from './combat.js';
import {helpless,setRoute} from './motion.js';
import {clampToMap,navGrid,nearestWalkable,cellCentre,walkable,span} from './navigation.js';

// Standing orders (§3.7), new work rather than a port: four slots of
// {action, target}, evaluated at 4 Hz; the first feasible slot wins and an
// infeasible one falls through. A slot is infeasible when it has no valid
// target, would leave the leash, its ability is recovering or unaffordable,
// or its condition fails. Target words are relative to the hero, never to
// the companion (a deliberate change from Siege of Avalon). Pure.

const standing=o=>o.alive&&!o.down&&!o.carriedBy;
const enemies=(world,actor)=>world.actors.filter(o=>standing(o)&&hostile(actor,o)&&!o.hidden);
const friendsOf=(world,actor)=>world.actors.filter(o=>o.alive&&o.side!=='enemy'&&!hostile(actor,o));
const nearestTo=(list,p)=>{let best=null,bd=Infinity;for(const o of list){const d=distanceBetween(o,p);if(d<bd||d===bd&&best&&o.id<best.id){bd=d;best=o;}}return best;};
const targets=(o,id)=>o.order?.targetId===id||o.action?.targetId===id||o.lock===id;
const isCompanion=(world,o)=>world.party.includes(o.id);
const fraction=o=>o.down?0:o.hp/o.maxHp;
const ranged=o=>!!derivedValues(o).weapon.ranged||o.role==='archer';

// The enemy a target word names, from the hero's point of view.
export function enemyFor(world,actor,word,hero=actorById(world,world.heroId)){
  if(!hero)return null;const list=enemies(world,actor);if(!list.length)return null;
  switch(word){
    case 'hero_target':{const id=hero.lock??hero.order?.targetId;const t=list.find(o=>o.id===id);return t??null;}
    case 'hero_attacker':return nearestTo(list.filter(o=>targets(o,hero.id)),hero);
    case 'nearest_enemy_to_hero':return nearestTo(list,hero);
    case 'strongest_enemy':return list.reduce((b,o)=>!b||o.hp*derivedValues(o).attack>b.hp*derivedValues(b).attack?o:b,null);
    case 'weakest_enemy':return list.reduce((b,o)=>!b||o.hp<b.hp||o.hp===b.hp&&distanceBetween(o,hero)<distanceBetween(b,hero)?o:b,null);
    case 'enemy_archers':return nearestTo(list.filter(ranged),hero);
    case 'enemy_officer':return nearestTo(list.filter(o=>o.officer),hero);
    default:return null;
  }
}
// The friend a word names for an action: the one guarded, or the one to bind.
export function friendFor(world,actor,word,action,hero=actorById(world,world.heroId)){
  const need=action==='bind_wounds'?o=>(o.down||fraction(o)<STANDING.bindBelow)&&!o.carriedBy:o=>standing(o);
  if(word==='hero')return hero&&need(hero)?hero:null;
  if(word.startsWith('companion:')){const o=actorById(world,word.slice(10));return o&&need(o)?o:null;}
  const pool=friendsOf(world,actor).filter(o=>word==='any_companion'?isCompanion(world,o)&&o!==actor:o.id!==actor.id||action==='bind_wounds');
  const list=pool.filter(need);if(!list.length)return null;
  if(action==='bind_wounds')return list.reduce((b,o)=>!b||fraction(o)<fraction(b)?o:b,null);
  return nearestTo(list,actor);
}
// The threat to a friend: someone striking at him, or very close to him.
function threatTo(world,actor,friend){
  const list=enemies(world,actor).filter(o=>distanceBetween(o,friend)<=STANDING.guardThreat&&(targets(o,friend.id)||distanceBetween(o,friend)<=3));
  return nearestTo(list,friend);
}
// Where a follower stands: behind the hero, spread by his place in the party.
function followPoint(world,actor,hero,far){
  const [lo,hi]=far?STANDING.follow.far:STANDING.follow.close,back=(lo+hi)/2,index=Math.max(0,world.party.indexOf(actor.id)),side=(index-1)*1.4;
  const grid=navGrid(world.map);let p=clampToMap(grid,{x:hero.x-hero.fx*back+hero.fz*side,z:hero.z-hero.fz*back-hero.fx*side});
  if(!walkable(grid,p.x,p.z)){const i=nearestWalkable(grid,p.x,p.z);if(i>=0)p=cellCentre(grid,i);}
  return p;
}

// What one slot would have him do now, or null if it is infeasible.
export function slotPlan(world,actor,[action,word],hero=actorById(world,world.heroId)){
  if(!hero)return null;
  const fromHero=t=>distanceBetween(hero,t),self=actor===hero;
  switch(action){
    case 'attack':{
      const t=enemyFor(world,actor,word,hero);if(!t||fromHero(t)>STANDING.leashExplicit)return null;return {kind:'attack',targetId:t.id};
    }
    case 'throw_pilum':{
      const t=enemyFor(world,actor,word,hero);if(!t||fromHero(t)>STANDING.leashExplicit)return null;
      return validate(world,actor.id,'throw_pilum',{actorId:t.id})?null:{kind:'ability',abilityId:'throw_pilum',targetId:t.id};
    }
    case 'guard':{
      const f=friendFor(world,actor,word,'guard',hero);if(!f||f===actor)return null;const threat=threatTo(world,actor,f);if(!threat)return null;
      return {kind:'attack',targetId:threat.id,guarding:f.id};
    }
    case 'bind_wounds':{
      const f=friendFor(world,actor,word,'bind_wounds',hero);if(!f||fromHero(f)>STANDING.leash)return null;
      const reason=validate(world,actor.id,'bind_wounds',f===actor?{}:{actorId:f.id});
      return reason?null:{kind:'ability',abilityId:'bind_wounds',targetId:f===actor?null:f.id};
    }
    case 'withdraw':{
      if(self||fraction(actor)>=STANDING.withdrawBelow)return null;
      return distanceBetween(actor,hero)<=2.5?{kind:'hold'}:{kind:'move',...followPoint(world,actor,hero,false),run:true};
    }
    case 'follow_close':case 'follow_far':{
      if(self)return null;const far=action==='follow_far',p=followPoint(world,actor,hero,far),slack=far?2.5:1.2;
      return span(actor.x-p.x,actor.z-p.z)<=slack?{kind:'hold'}:{kind:'move',x:p.x,z:p.z,run:span(actor.x-p.x,actor.z-p.z)>6};
    }
    case 'stay_hidden':return {kind:'hold',hidden:true};
    default:return null;
  }
}

// The plan for this decision: the first feasible slot, held to the leash.
export function standingPlan(world,actor){
  const hero=actorById(world,world.heroId),slots=actor.standing??STANDING.presets.shieldmate;
  for(const [index,slot]of slots.entries()){
    const plan=slotPlan(world,actor,slot,hero);if(!plan)continue;
    // Beyond the leash he falls back to following, unless an attack or throw names an enemy within the longer leash.
    if(hero&&actor!==hero&&distanceBetween(actor,hero)>STANDING.leash&&!(plan.kind==='attack'||plan.abilityId==='throw_pilum'))
      return {kind:'move',...followPoint(world,actor,hero,false),run:true,slot:-1};
    return {...plan,slot:index};
  }
  return {kind:'hold',slot:-1};
}

// Carry the plan out through the same orders a player's commands give.
export function decideFriend(world,actor){
  if(helpless(actor)||staggered(world,actor)||actor.action||actor.carrying||actor.id===world.controlled)return;
  const plan=standingPlan(world,actor);actor.standingSlot=plan.slot;
  switch(plan.kind){
    case 'attack':
      if(!actor.drawn)actor.drawn=true;
      if(actor.lock!==plan.targetId||actor.order?.kind!=='attack'){actor.lock=plan.targetId;actor.order={kind:'attack',targetId:plan.targetId};actor.repathAt=world.tick;}
      break;
    case 'ability':
      if(actor.order?.kind!=='ability'||actor.order.abilityId!==plan.abilityId||actor.order.targetId!==plan.targetId){
        actor.lock=null;actor.order={kind:'ability',abilityId:plan.abilityId,targetId:plan.targetId};actor.path=[];actor.repathAt=world.tick;
      }
      break;
    case 'move':{
      const goal=actor.goal;if(actor.order?.kind==='move'&&goal&&span(goal.x-plan.x,goal.z-plan.z)<1)break;
      actor.lock=null;actor.order={kind:'move'};setRoute(world,actor,{x:plan.x,z:plan.z},{run:plan.run?null:false});break;
    }
    case 'hold':
      if(actor.order){actor.order=null;actor.lock=null;actor.path=[];actor.gait=null;}
      if(plan.hidden&&actor.drawn)actor.drawn=false;break;
  }
}

// The company panel's summary sentence for four slots (§3.7).
const WORDS={hero:n=>n,any_companion:()=>'any companion',any_ally:()=>'any ally',hero_target:n=>`${n}’s target`,hero_attacker:n=>`whoever attacks ${n}`,
  nearest_enemy_to_hero:n=>`the enemy nearest ${n}`,strongest_enemy:()=>'the strongest enemy',weakest_enemy:()=>'the weakest enemy',
  enemy_archers:()=>'the enemy archers',enemy_officer:()=>'an enemy officer or standard-bearer'};
const word=(w,hero,names={})=>w?.startsWith('companion:')?names[w.slice(10)]??'a companion':(WORDS[w]??(()=>w))(hero);
export function summarizeOrders(slots,{hero='the soldier',names={}}={}){
  const parts=slots.map(([action,target])=>{
    switch(action){
      case 'guard':{const who=word(target,hero,names);return `guard ${who} against whoever attacks him`;}
      case 'attack':return target==='hero_target'?`strike ${word(target,hero,names)}`:`attack ${word(target,hero,names)}`;
      case 'throw_pilum':return `throw a pilum at ${word(target,hero,names)}`;
      case 'bind_wounds':return `bind the wounds of ${word(target,hero,names)} below half Health`;
      case 'follow_close':return 'follow close';
      case 'follow_far':return 'follow at a distance';
      case 'stay_hidden':return 'stay hidden and never strike first';
      case 'withdraw':return `withdraw to ${hero} when badly hurt`;
      default:return action;
    }
  });
  if(!parts.length)return 'No orders: he stands where he is.';
  const text=parts.map((p,i)=>i?`otherwise ${p}`:p).join('; ');return text[0].toUpperCase()+text.slice(1)+'.';
}
// Whether a slot's action and target belong together.
export function slotProblem([action,target]=[]){
  if(!STANDING.actions[action])return 'Choose an action.';
  if(STANDING.enemyActions.includes(action)&&!STANDING.enemyTargets.includes(target))return 'Choose an enemy as the target.';
  if(STANDING.friendActions.includes(action)&&!(STANDING.friendTargets.includes(target)||/^companion:[a-z]+$/.test(target??'')))return 'Choose a friend as the target.';
  if(STANDING.noTarget.includes(action)&&target!=='hero')return 'This order needs no target.';
  return null;
}
export {ABILITIES};

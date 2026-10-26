import {ENEMY_PLANS,EXCHANGE,SQUAD_STANDING} from '../../data/realtime-squads.js';
import {TEMPERAMENTS} from '../../data/realtime-variety.js';
import {MOVEMENT,TIME} from '../../data/realtime-rules.js';
import {FIELD_APPROACHES} from '../field-approaches.js';
import {actorById,distanceBetween,hostile} from './abilities.js';
import {derivedValues} from './combat.js';
import {fielded,membersOf,missileRangeOf,squadCentre,squadSpeed,squadsOf} from './squads.js';
import {fieldVerb} from './field-objects.js';
import {span} from './navigation.js';
import {summarizeOrders} from './party.js';

// What the soldier knows of the field (guide "Knowing the enemy", "Reading the
// battlefield"): the field intelligence panel (the enemy's doctrine, plan and focus,
// the approach chosen, the chapter's opportunities and the field's objects),
// Allied plans & visible threats in words, each visible enemy's intention as
// an arrow (hold U while paused), and the ground an enemy could strike within
// the next round (hatched in red). Pure: it reads the world and changes nothing.

const R=TIME.roundTicks,SECONDS=R/TIME.ticksPerSecond;
const standing=o=>o.alive&&!o.down&&!o.carriedBy;
const seenSquad=(world,q)=>q.side==='enemy'&&fielded(world,q)&&membersOf(world,q).some(m=>!m.hidden);
const seenMan=a=>a.side==='enemy'&&standing(a)&&!a.hidden&&!a.squadId;
const nameOf=(world,id)=>squadsOf(world).find(q=>q.id===id)?.name??actorById(world,id)?.name??null;

// The field intelligence panel's contents.
export function fieldIntelligence(world){
  const d=world.doctrine,f=world.field,approach=world.approach?FIELD_APPROACHES.find(p=>p.id===world.approach):null;
  return {
    doctrine:d?{label:d.label,purpose:d.purpose,focus:d.focusName,reserve:d.reserveId?nameOf(world,d.reserveId):null,
      plan:d.plan?ENEMY_PLANS.kinds[d.plan.id]?.label??null:null,planSummary:d.plan?[ENEMY_PLANS.kinds[d.plan.id]?.summary,d.plan.reason].filter(Boolean).join(' '):null,
      tacticalIdentity:d.identity?.label??null}:null,
    approach:approach?{label:approach.label,description:approach.description}:null,
    // A war band (Chapters I–III): its temperament and how it holds (bands.js).
    band:world.band?{temperament:TEMPERAMENTS.kinds[world.band.temperament]?.label??null,state:world.band.state}:null,
    opportunities:f?['stores','signal'].map(id=>{const o=(world.objects??[]).find(x=>x.field&&x.kind===id),opp=f.opportunities?.[id];
      return o&&{name:o.name,state:o.state,description:opp?.description??''};}).filter(Boolean):[],
    closes:f?.outcome==='pending'?f.deadline:null,outcome:f?.outcome??null,
    objects:(world.objects??[]).filter(o=>o.field&&!['stores','signal'].includes(o.kind)).map(o=>({name:o.name,state:o.state,action:fieldVerb(o)}))
  };
}

// Allied plans & visible threats, in words: our squads and companions, then each
// enemy in sight, nearest the soldier first.
export function alliedPlans(world){
  const hero=actorById(world,world.heroId),away=p=>hero?Math.round(span(p.x-hero.x,p.z-hero.z)):null,roles=world.doctrine?.roles??{};
  const ours=[
    ...squadsOf(world).filter(q=>q.side!=='enemy'&&fielded(world,q)).map(q=>({name:q.name,
      plan:q.pending?`${q.pending.order.kind} on its way`:q.order?`${q.order.kind} (your order)`:q.plan?.intent??'Standing orders.'})),
    ...world.party.map(id=>actorById(world,id)).filter(a=>a&&standing(a)).map(a=>({name:a.name,
      plan:a.id===world.controlled?'Under your control.':a.standingSlot>=0&&a.standing?.[a.standingSlot]?summarizeOrders([a.standing[a.standingSlot]],{hero:'you'}):'Holding: no standing order applies.'}))];
  const threats=[
    ...squadsOf(world).filter(q=>seenSquad(world,q)).map(q=>{const c=squadCentre(world,q);
      return {id:q.id,name:q.name,role:roles[q.id]??null,temperament:TEMPERAMENTS.kinds[q.temperament]?.label??null,intent:q.plan?.intent??'Holding.',
        target:q.plan?.targetId?nameOf(world,q.plan.targetId):null,distance:away(c)};}),
    ...world.actors.filter(seenMan).map(a=>({id:a.id,name:a.name,role:null,intent:a.order?.flee?'Fleeing the field.':a.order?.kind==='attack'?'Attacking.':a.ai?.state==='engage'?'Engaging.':a.ai?.state==='suspicious'?'Searching.':'Holding.',
      target:a.order?.targetId?nameOf(world,a.order.targetId):null,distance:away(a)}))
  ].sort((a,b)=>(a.distance??0)-(b.distance??0)||(a.id<b.id?-1:1));
  return {ours,threats};
}

// Each visible enemy's intention: from where he stands to where he is going, and
// whom he means to strike.
export function intentions(world){
  const out=[];
  for(const q of squadsOf(world)){
    if(!seenSquad(world,q))continue;const c=squadCentre(world,q),t=q.plan?.targetId?centreOf(world,q.plan.targetId):null;
    const to=t??(Number.isFinite(q.plan?.x)?{x:q.plan.x,z:q.plan.z}:q.path?.length?q.path[q.path.length-1]:null);
    if(to)out.push({id:q.id,from:{x:c.x,z:c.z},to:{x:to.x,z:to.z},strike:!!t,label:q.plan?.intent??''});
  }
  for(const a of world.actors){
    if(!seenMan(a))continue;const t=a.order?.targetId?actorById(world,a.order.targetId):null,goal=a.path?.length?a.path[a.path.length-1]:null;
    const to=t&&standing(t)?t:goal;if(to)out.push({id:a.id,from:{x:a.x,z:a.z},to:{x:to.x,z:to.z},strike:!!t,label:t?`Strike ${t.name}`:'Move'});
  }
  return out;
}
function centreOf(world,id){
  const q=squadsOf(world).find(s=>s.id===id);if(q)return fielded(world,q)?squadCentre(world,q):null;
  const a=actorById(world,id);return a&&standing(a)?{x:a.x,z:a.z}:null;
}

// The ground an enemy (a man, or a squad) could strike within the next round:
// as far as he can go in ten seconds, and his reach (or his missiles) beyond.
export function threatArea(world,id){
  const q=squadsOf(world).find(s=>s.id===id)??squadsOf(world).find(s=>s.id===actorById(world,id)?.squadId);
  if(q){
    if(!fielded(world,q)||q.side!=='enemy')return null;const c=squadCentre(world,q),men=membersOf(world,q);
    const pace=Math.max(squadSpeed(world,q),Math.min(...men.map(m=>derivedValues(m).run)));
    return {x:c.x,z:c.z,radius:pace*SECONDS+(missileRangeOf(q)||EXCHANGE.contact),squadId:q.id};
  }
  const a=actorById(world,id);if(!a||!standing(a)||a.side!=='enemy')return null;const d=derivedValues(a),ranged=d.weapon.ranged;
  const shots=ranged&&(ranged.ammo===null||(a.ammo?.[ranged.ammo]??0)>0)?ranged.range:0;
  return {x:a.x,z:a.z,radius:(a.pace??d.run??MOVEMENT.walk)*SECONDS+Math.max(d.reach??1.5,shots)};
}
export const standingWords=action=>SQUAD_STANDING.actions[action]??action;
export {hostile,distanceBetween};

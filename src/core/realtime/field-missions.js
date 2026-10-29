import {ESCORT_RULES,FAR_BANK} from '../../data/realtime-rules.js';
import {STRUCTURES} from '../../data/structures.js';
import {HORSE_ORDERS} from '../../data/realtime-squads.js';
import {actorById,distanceBetween} from './abilities.js';
import {setRoute} from './motion.js';
import {breakGate} from './fortifications.js';
import {fielded,membersOf,scorchSquad,squadCentre,squadsOf} from './squads.js';
import {burnActor} from './damage.js';
import {span,TILE} from './navigation.js';

// Release 7's missions in real time (data/mission-operations.js; worlds and gameplay plan):
// the enemy's siege works on a phase's capture points, each destroyed when its point is
// secured (a ram that batters its gate, a ladder whose climbers hold the wall walk); the
// enemy horse drawn onto a marker; a convoy that walks its road on its own; a line that
// falls back to the next; and the far bank's volleys over a crossing. Pure: the world's
// mission, objects, squads and men hold every state, and nothing draws randomness.

const emit=(world,event)=>world.events.push({tick:world.tick,...event});
const standing=o=>o.alive&&!o.down&&!o.carriedBy;
const ours=o=>o.side==='player'||o.side==='ally';
const tileOf=p=>({x:Math.floor(p.x/TILE),y:Math.floor(p.z/TILE)});

// The works of the mission's current phase, as objects: a ram on its point, a ladder against
// the wall beside its point. A work already on the field (or destroyed) is left as it is.
export function installWorks(world){
  for(const w of world.mission?.works??[]){
    if(world.objects.some(o=>o.id===w.id))continue;
    const ram=w.kind==='ram';
    world.objects.push({id:w.id,kind:w.kind,name:w.name,x:w.x,z:w.z,field:true,state:ram?'active':'raised',done:false,rounds:0,tile:tileOf(w),
      ...(ram&&w.gateId?{gateId:w.gateId}:{})});
  }
}
// A ladder whose climbers are beaten (destroyed, or broken and falling back) is thrown down too (mission.js).
export function climbersBeaten(world,index){
  const w=world.mission.works?.[index];if(w?.kind!=='ladder')return false;
  const climbers=squadsOf(world).find(q=>q.unitId===`${w.id}-climbers`);
  return !climbers||!fielded(world,climbers)||!!climbers.broken;
}
// A work's point secured (mission.js): the ram burns, the ladder is thrown down.
export function worksSecured(world,index){
  const w=world.mission.works?.[index],o=w&&world.objects.find(x=>x.id===w.id);
  if(!o||o.done)return;
  o.state=o.kind==='ram'?'burnt':'thrown';o.done=true;
  emit(world,{kind:'field',objectId:o.id,what:o.kind==='ram'?'ram-burnt':'ladder-thrown'});
}
// The round's end: while any work stands the defended line loses the battle's pressure, as in
// the turn-based rules; a ram batters its gate, twice the soldier's blow, as an engineers' ram does.
export function worksRound(world){
  const m=world.mission,standingWorks=(m.works??[]).filter((w,i)=>!m.points[i]?.secured);if(!standingWorks.length)return;
  for(const w of standingWorks){
    const ram=w.kind==='ram'?world.objects.find(o=>o.id===w.id):null,gate=ram?.gateId?world.objects.find(o=>o.id===ram.gateId):null;
    if(gate?.state==='closed')breakGate(world,gate,STRUCTURES.gate.batter*STRUCTURES.gate.ram,null);
  }
  if(m.pressure){m.defence-=m.pressure;emit(world,{kind:'pressure',amount:m.pressure,defence:m.defence,works:true});}
}

// The lure (mission.js objectiveMet): the named horse at the marker, or none of it left in the saddle unbroken
// (a broken band is beaten, as a ladder's climbers are).
export function lureMet(world){
  const m=world.mission,roles=m.lure==='cavalry'?HORSE_ORDERS.roles:[m.lure],near=a=>standing(a)&&span(a.x-m.goal.x,a.z-m.goal.z)<=m.radius;
  const horse=[...squadsOf(world).filter(q=>q.side==='enemy'&&roles.includes(q.role)&&fielded(world,q)&&!q.broken).map(q=>membersOf(world,q)),
    ...world.actors.filter(a=>a.side==='enemy'&&!a.squadId&&roles.includes(a.role)&&standing(a)).map(a=>[a])];
  return !horse.length||horse.some(men=>men.some(near));
}

// A convoy walks its road on its own, point by point (its `convoyLeg`), with no one beside it:
// a point within a tile of it is passed, as in the turn-based rules, and it stops at the last.
// Threatened, it halts where it is, and it waits for anyone who cannot walk.
export function moveConvoy(world){
  const m=world.mission,route=m.convoy,last=route.length-1,reach=m.radius*.6;
  for(const e of m.escorts.map(id=>actorById(world,id)).filter(Boolean)){
    if(!standing(e)||e.action)continue;
    const stop=()=>{if(e.order){e.order=null;e.path=[];e.gait=null;}};
    if(!e.escort.escorted||m.pauseEscorts){stop();continue;}
    e.convoyLeg=Math.min(e.convoyLeg??0,last);
    while(e.convoyLeg<last&&span(e.x-route[e.convoyLeg].x,e.z-route[e.convoyLeg].z)<=m.radius)e.convoyLeg++;
    const to=route[e.convoyLeg];
    if(span(e.x-to.x,e.z-to.z)<=reach||world.actors.some(o=>o.side==='enemy'&&standing(o)&&!o.hidden&&distanceBetween(o,e)<=ESCORT_RULES.halt)){stop();continue;}
    if(e.order?.kind!=='convoy'||e.order.leg!==e.convoyLeg||!e.path.length){e.order={kind:'convoy',leg:e.convoyLeg};setRoute(world,e,to,{run:false});}
  }
}

// A fallback line (mission.js advancePhase): our squads holding the line just left, by an order
// to hold or to advance there, fall back to the next phase's ground. Standing orders to hold
// the objective follow it on their own.
export function fallBack(world,from,to){
  const m=world.mission;
  for(const q of squadsOf(world)){
    if(!ours(q)||!fielded(world,q)||!['hold','advance'].includes(q.order?.kind))continue;
    const c=squadCentre(world,q),at=q.order.kind==='advance'?q.order:c;
    if(span(at.x-from.x,at.z-from.z)>2*m.radius)continue;
    q.order={kind:'advance',x:to.x,z:to.z,since:world.tick,from:'lines'};q.braced=false;
    emit(world,{kind:'fall-back',squadId:q.id});
  }
}

// The far bank's volley at the round's end, while the enemy's archers stand: it strikes the group of
// ours most exposed in the water or on the landing, the squad with the most men there (the first in
// the company's order on a tie), or else the man of ours there nearest the far bank.
export function farBankVolley(world){
  const m=world.mission;
  if(!squadsOf(world).some(q=>q.side==='enemy'&&q.role==='archer'&&fielded(world,q))&&
    !world.actors.some(a=>a.side==='enemy'&&!a.squadId&&a.role==='archer'&&standing(a)))return;
  const wet=a=>{const t=tileOf(a);return ['river','ford'].includes(world.map.terrain[t.y]?.[t.x]);};
  const exposed=a=>standing(a)&&(wet(a)||span(a.x-m.goal.x,a.z-m.goal.z)<=m.radius);
  // The archers shoot from the far bank: the men nearest it fall first.
  const bank={x:world.map.width*TILE,z:m.goal.z};
  const squad=squadsOf(world).filter(q=>ours(q)&&fielded(world,q)).map(q=>({q,n:membersOf(world,q).filter(exposed).length})).filter(x=>x.n>0)
    .reduce((b,x)=>!b||x.n>b.n?x:b,null)?.q;
  if(squad){scorchSquad(world,squad,FAR_BANK.squad,bank,'arrows');emit(world,{kind:'far-bank',squadId:squad.id});return;}
  const man=world.actors.filter(a=>ours(a)&&!a.squadId&&exposed(a)).reduce((b,a)=>!b||span(a.x-bank.x,a.z-bank.z)<span(b.x-bank.x,b.z-bank.z)?a:b,null);
  if(man){burnActor(world,man,FAR_BANK.single,'arrows');emit(world,{kind:'far-bank',actorId:man.id});}
}

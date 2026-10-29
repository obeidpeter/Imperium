import {COHESION,ENEMY_FACTIONS,ENEMY_PLANS,ENEMY_TECHNIQUES,EXCHANGE,HORSE_ORDERS,MORALE,SQUAD_STANDING,SUPPRESSION} from '../../data/realtime-squads.js';
import {COMMAND_CHAPTERS} from '../../data/command-campaign.js';
import {TIME} from '../../data/realtime-rules.js';
import {actorById,distanceBetween,hostile} from './abilities.js';
import {cellCentre,clampToMap,clearLine,navGrid,nearestWalkable,span,walkable} from './navigation.js';
import {alliedSides,fielded,membersOf,memberDecisions,missileRangeOf,routeSquad,shaken,squadById,squadCentre,squadOf,squadsOf} from './squads.js';
import {pickWeighted} from './rng-streams.js';
import {lying,noticeOf,unseen} from './squad-sight.js';
import {smokeBetween,terrainCover} from './sight.js';
import {HIDDEN_BANDS} from '../../data/realtime-variety.js';
import {ADAPTIVE_TACTICS,tacticalIdentity} from '../../data/realtime-tactics.js';
import {observeBattleSituation,scoreEnemyPlans} from './adaptive-doctrine.js';

// How squads decide (§3.7, §3.8, §3.10): ours carry out the soldier's order,
// else the first feasible of their four standing orders; the enemy's war bands
// follow the 0.38 doctrine planner, recomputed at each round boundary from
// what can be seen: one exposed target focused, archers suppressing it,
// mobile troops seeking its flank, the rest fixing it in place, and a reserve
// held until threatened. Within the chapter's doctrine the enemy draws a plan
// from the ai stream (ENEMY_PLANS: which flank, a feint, when the reserve
// commits) and keeps it at least two rounds; each band also has a preference
// of its own, drawn once. Every squad's plan is kept as `plan` ({ intent,
// targetId, x, z }) for the intentions on U and the Allied plans list. Pure.

const R=TIME.roundTicks;
const emit=(world,event)=>world.events.push({tick:world.tick,...event});
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const ours=s=>s.side==='player'||s.side==='ally';
const standingActor=o=>o.alive&&!o.down&&!o.carriedBy;
const nearestOf=(list,p)=>{let best=null,bd=Infinity;for(const o of list){const d=span(o.x-p.x,o.z-p.z);if(d<bd){bd=d;best=o;}}return best;};
const centreOf=(world,thing)=>thing?.members?squadCentre(world,thing):thing;

function goTo(world,squad,point,{run=false,stopAt=0}={}){
  const grid=navGrid(world.map);let p=clampToMap(grid,point,1);
  if(!walkable(grid,p.x,p.z)){const i=nearestWalkable(grid,p.x,p.z);if(i<0)return;p=cellCentre(grid,i);}
  if(stopAt>0){const c=squadCentre(world,squad),d=span(p.x-c.x,p.z-c.z);if(d<=stopAt){squad.path=[];return;}
    const k=(d-stopAt)/d;p={x:c.x+(p.x-c.x)*k,z:c.z+(p.z-c.z)*k};if(!walkable(grid,p.x,p.z)){const i=nearestWalkable(grid,p.x,p.z);if(i>=0)p=cellCentre(grid,i);}}
  if(squad.goal&&squad.path.length){
    const moved=span(squad.goal.x-p.x,squad.goal.z-p.z);if(moved<1)return;
    // A goal that has moved a little (a target walking on): the last leg is re-aimed while it stays
    // clear, rather than the whole route searched again; a goal gone farther, or round a corner, is.
    const from=squad.path.length>1?squad.path[squad.path.length-2]:squad;
    if(moved<4&&span(squad.x-p.x,squad.z-p.z)>=.75&&clearLine(grid,from,p)){squad.path[squad.path.length-1]={x:p.x,z:p.z};squad.goal={x:p.x,z:p.z};return;}
  }
  if(span(squad.x-p.x,squad.z-p.z)<.75){squad.path=[];return;}
  routeSquad(world,squad,p,{run});
}
const halt=squad=>{squad.path=[];squad.gait=null;};
const plan=(squad,intent,{targetId=null,x=null,z=null}={})=>{squad.plan={intent,targetId,x,z};};

// --- Our squads: orders ---------------------------------------------------------
// An order taking effect (command.js orderEffects).
export function carryOut(world,squad,order){
  // Any new order of its own brings a squad lying in wait to its feet (Restore morale and a formation do not).
  if(lying(squad)&&!['restore','line','shield-wall','wedge','lie_in_wait'].includes(order.kind))rise(world,squad);
  switch(order.kind){
    case 'restore':squad.morale=clamp(squad.morale+MORALE.restore);squad.suppression=Math.max(0,squad.suppression-1);
      if(squad.broken&&squad.morale>MORALE.broken){squad.broken=false;emit(world,{kind:'squad-rallied',squadId:squad.id});}return;
    case 'line':case 'shield-wall':case 'wedge':squad.formation=order.kind;emit(world,{kind:'formation',squadId:squad.id,formation:order.kind});return;
    case 'hold':halt(squad);squad.stillSince=Math.min(squad.stillSince,world.tick);squad.order={kind:'hold',since:world.tick};return;
    // Lie in wait: the men keep low and still, hidden until seen or until they strike (squad-sight.js).
    case 'lie_in_wait':halt(squad);squad.order={kind:'lie_in_wait',since:world.tick};
      for(const m of membersOf(world,squad))if(!m.hidden){m.hidden=true;}emit(world,{kind:'squad-lying',squadId:squad.id});return;
    default:squad.order={...order,since:world.tick};
  }
}
// A squad lying in wait stands up: its men are seen again.
function rise(world,squad){const hid=membersOf(world,squad).filter(m=>m.hidden);for(const m of hid)m.hidden=false;if(hid.length)emit(world,{kind:'squad-revealed',squadId:squad.id});}
// What the soldier ordered, carried out; false once it is done.
function followOrder(world,squad){
  const o=squad.order,hero=actorById(world,world.heroId);
  switch(o.kind){
    case 'lie_in_wait':{
      // In contact the exchange springs it (and shows the men); an enemy squad within reach is fallen upon.
      if(squad.contact){squad.order=null;rise(world,squad);return false;}
      const c=squadCentre(world,squad),prey=squadsOf(world).filter(t=>t.side==='enemy'&&fielded(world,t)&&!t.broken&&hostile(squad,t))
        .map(t=>({t,d:span(squadCentre(world,t).x-c.x,squadCentre(world,t).z-c.z)})).filter(x=>x.d<=EXCHANGE.ambush.spring+EXCHANGE.contact).sort((a,b)=>a.d-b.d||(a.t.id<b.t.id?-1:1))[0]?.t;
      // Fallen upon before it can turn: if it had not seen the squad, the first exchange is an ambush (squads.js).
      if(prey){squad.order={kind:'attack',targetId:prey.id,since:world.tick,from:'lie_in_wait',unseen:noticeOf(prey,squad.id)<100};return followOrder(world,squad);}
      halt(squad);plan(squad,'Lie in wait: fall on the first enemy to come near.');return true;
    }
    case 'hold':halt(squad);plan(squad,'Hold here; a whole round braces the line.');return true;
    case 'advance':{
      const c=squadCentre(world,squad);
      if(span(c.x-o.x,c.z-o.z)<=2.5&&!squad.path.length){squad.order={kind:'hold',since:world.tick,from:'advance'};plan(squad,'Hold the ground reached.');return true;}
      goTo(world,squad,o,{run:span(o.x-c.x,o.z-c.z)>25&&squad.formation!=='shield-wall'});plan(squad,'Advance to the marked ground.',{x:o.x,z:o.z});return true;
    }
    case 'attack':{
      const t=squadById(world,o.targetId)??actorById(world,o.targetId);
      if(!t||(t.members?!fielded(world,t)||t.broken:!standingActor(t))){squad.order=null;return false;}
      const p=centreOf(world,t);goTo(world,squad,p,{run:span(p.x-squad.x,p.z-squad.z)>12&&squad.formation!=='shield-wall',stopAt:1.5});
      plan(squad,`Engage ${t.name}.`,{targetId:t.id,x:p.x,z:p.z});return true;
    }
    // The horse's orders (release 7; HORSE_ORDERS). A charge from closer than its run-up wheels away first.
    case 'charge':{
      const t=squadById(world,o.targetId)??actorById(world,o.targetId);
      if(!t||(t.members?!fielded(world,t)||t.broken:!standingActor(t))){squad.order=null;return false;}
      const p=centreOf(world,t),c=squadCentre(world,squad),d=span(p.x-c.x,p.z-c.z);
      if(!o.wheeled&&!o.back&&d<EXCHANGE.chargeRun){const k=d||1,far=EXCHANGE.chargeRun-d+4;o.back=clampToMap(navGrid(world.map),{x:c.x+(c.x-p.x)/k*far,z:c.z+(c.z-p.z)/k*far},2);}
      if(!o.wheeled&&o.back&&span(c.x-o.back.x,c.z-o.back.z)>3&&d<EXCHANGE.chargeRun){goTo(world,squad,o.back,{run:true});plan(squad,`Wheel away for the run-up at ${t.name}.`,{targetId:t.id,x:o.back.x,z:o.back.z});return true;}
      o.wheeled=true;goTo(world,squad,p,{run:true,stopAt:1.5});plan(squad,`Charge ${t.name}.`,{targetId:t.id,x:p.x,z:p.z});return true;
    }
    // A feigned retreat: ride at the nearest enemy horse or raiders until they see it, then away as if routed; those
    // who see the flight give chase, and when it turns they are strung out and it charges the nearest.
    case 'feigned_retreat':{
      const F=HORSE_ORDERS.feint,c=squadCentre(world,squad);
      const chasers=squadsOf(world).filter(t=>t.side==='enemy'&&fielded(world,t)&&!t.broken&&HORSE_ORDERS.pursuers.includes(t.role)&&membersOf(world,t).some(m=>!m.hidden))
        .map(t=>({t,d:span(squadCentre(world,t).x-c.x,squadCentre(world,t).z-c.z)})).sort((a,b)=>a.d-b.d||(a.t.id<b.t.id?-1:1));
      if(!o.fleeing){
        if(!chasers.length){squad.order=null;return false;}
        const near=chasers[0];
        if(near.d>F.draw){const p=squadCentre(world,near.t);goTo(world,squad,p,{run:true,stopAt:F.draw*.8});plan(squad,`Ride at ${near.t.name} to draw it out.`,{targetId:near.t.id,x:p.x,z:p.z});return true;}
        o.fleeing=true;o.to=retreatPoint(world,squad,near.t,o);
      }
      for(const {t,d}of chasers)if(d<=F.draw&&!t.drawnBy){t.drawnBy=squad.id;emit(world,{kind:'drawn',squadId:t.id,by:squad.id});}
      if(span(c.x-o.to.x,c.z-o.to.z)<=3&&!squad.path.length){
        const drawn=squadsOf(world).filter(t=>t.drawnBy===squad.id);
        for(const t of drawn){t.drawnBy=null;if(!fielded(world,t))continue;t.cohesion=clamp(t.cohesion-F.strungOut);emit(world,{kind:'strung-out',squadId:t.id,cohesion:Math.round(t.cohesion)});}
        const prey=drawn.filter(t=>fielded(world,t)&&!t.broken).map(t=>({t,d:span(squadCentre(world,t).x-c.x,squadCentre(world,t).z-c.z)})).sort((a,b)=>a.d-b.d||(a.t.id<b.t.id?-1:1))[0]?.t;
        if(prey){squad.order={kind:'charge',targetId:prey.id,since:world.tick,from:'feigned_retreat',wheeled:true};return followOrder(world,squad);}
        squad.order={kind:'hold',since:world.tick,from:'feigned_retreat'};plan(squad,'Turned: no one followed.');return true;
      }
      goTo(world,squad,o.to,{run:true});plan(squad,'Ride away as if routed.',{x:o.to.x,z:o.to.z});return true;
    }
    case 'withdraw':{
      if(!hero){squad.order=null;return false;}
      const back=behind(world,hero,squad);
      if(span(squad.x-back.x,squad.z-back.z)<=3){halt(squad);squad.braced=true;squad.order={kind:'hold',since:world.tick,from:'withdraw'};
        emit(world,{kind:'squad-braced',squadId:squad.id});plan(squad,'Braced beside you.');return true;}
      goTo(world,squad,back,{run:true});plan(squad,'Fall back to you and brace.',{x:back.x,z:back.z});return true;
    }
  }
  return false;
}
// Where a feigned retreat rides: the place it was given, the marker where the enemy's horse is to be drawn,
// or straight away from the horse it drew out.
function retreatPoint(world,squad,from,o){
  if(Number.isFinite(o.x)&&Number.isFinite(o.z))return {x:o.x,z:o.z};
  if(world.mission?.lure&&world.mission.goal)return {x:world.mission.goal.x,z:world.mission.goal.z};
  const c=squadCentre(world,squad),f=squadCentre(world,from),k=span(c.x-f.x,c.z-f.z)||1,far=HORSE_ORDERS.feint.distance;
  return clampToMap(navGrid(world.map),{x:c.x+(c.x-f.x)/k*far,z:c.z+(c.z-f.z)/k*far},2);
}
// A place beside and a little behind the soldier, on the squad's own side of him.
function behind(world,hero,squad){
  const fx=hero.fx??1,fz=hero.fz??0,side=(squad.x-hero.x)*-fz+(squad.z-hero.z)*fx>=0?1:-1,index=squadsOf(world).filter(ours).indexOf(squad);
  return {x:hero.x-fx*3+-fz*side*(4+(index%3)*3),z:hero.z-fz*3+fx*side*(4+(index%3)*3)};
}

// --- Our squads: standing orders (§3.7 squad vocabulary) ---------------------------
// The defaults from 0.38's allied intentions: in a defence they hold the marked
// ground and brace between attacks; escorting, they screen the column; otherwise
// they advance with the soldier and strike what comes within reach.
export function defaultStanding(mode,role){
  const broken=['withdraw_when_broken','hero'];
  if(role==='cavalry'||role==='heavy')return [broken,['screen_flank','enemy_cavalry'],['attack_hero_target','hero'],['advance_with_hero','hero']];
  if(role==='engineer')return [broken,['guard_standard',mode==='extract'?'convoy':'hero'],['hold_line',null],['advance_with_hero','hero']];
  if(role==='archer')return [broken,['advance_with_hero','hero'],['hold_line',null],['attack_hero_target','hero']];
  if(mode==='hold'||mode==='supply')return [broken,['attack_hero_target','hero'],['hold_line','objective'],['advance_with_hero','hero']];
  if(mode==='extract')return [broken,['guard_standard','convoy'],['attack_hero_target','hero'],['advance_with_hero','hero']];
  return [broken,['attack_hero_target','hero'],['advance_with_hero','hero'],['hold_line',null]];
}
// The enemy bands a squad of ours knows of: in sight, or hidden but seen all the same.
const enemyGroups=(world,squad)=>squadsOf(world).filter(o=>o.side==='enemy'&&fielded(world,o)&&!o.broken&&hostile(squad,o)
  &&(membersOf(world,o).some(m=>!m.hidden)||noticeOf(squad,o.id)>=100));
function foeNear(world,squad,point,radius,filter=()=>true){
  const groups=enemyGroups(world,squad).filter(filter).map(g=>({g,c:squadCentre(world,g)})).filter(x=>span(x.c.x-point.x,x.c.z-point.z)<=radius);
  return groups.sort((a,b)=>span(a.c.x-point.x,a.c.z-point.z)-span(b.c.x-point.x,b.c.z-point.z))[0]?.g??null;
}
// One slot's plan, or null when it is infeasible (the next slot is tried).
export function squadSlotPlan(world,squad,[action,target]){
  const hero=actorById(world,world.heroId),st=SQUAD_STANDING.station,c=squadCentre(world,squad);
  switch(action){
    case 'withdraw_when_broken':
      if(!squad.broken)return null;return {kind:'fallback',to:hero&&standingActor(hero)?behind(world,hero,squad):rear(world,squad),intent:'Broken: fall back to regroup.'};
    case 'attack_hero_target':{
      const lock=hero?.lock?actorById(world,hero.lock):null;if(!lock||!standingActor(lock)||!hostile(squad,lock))return null;
      const t=lock.squadId?squadOf(world,lock):lock;if(t.members&&(!fielded(world,t)||t.broken))return null;
      const p=centreOf(world,t);if(span(p.x-c.x,p.z-c.z)>st.leash)return null;
      return {kind:'engage',target:t,intent:`Strike your target, ${t.name}.`};
    }
    case 'advance_with_hero':{
      if(!hero||!standingActor(hero))return null;
      const near=foeNear(world,squad,c,st.engage);if(near)return {kind:'engage',target:near,intent:`Meet ${near.name} as it closes.`};
      return {kind:'station',to:station(world,squad,hero),intent:'Advance with you, keeping station.'};
    }
    case 'hold_line':{
      const anchor=target==='objective'&&world.mission?.goal?world.mission.goal:squad.anchor??{x:c.x,z:c.z};
      if(target!=='objective'&&!squad.anchor)squad.anchor={x:c.x,z:c.z};
      return {kind:'hold',to:anchor,intent:target==='objective'?'Hold the marked ground; brace between attacks.':'Hold the line here.'};
    }
    case 'screen_flank':{
      if(!hero||!standingActor(hero))return null;
      const threat=target==='enemy_cavalry'?foeNear(world,squad,hero,st.screen*2,g=>['cavalry','heavy'].includes(g.role))
        :target==='enemy_archers'?foeNear(world,squad,hero,st.screen*2,g=>g.role==='archer'):foeNear(world,squad,hero,st.screen*2);
      if(!threat)return null;const t=squadCentre(world,threat),d=span(t.x-hero.x,t.z-hero.z)||1;
      if(span(t.x-c.x,t.z-c.z)<=st.keep*2)return {kind:'engage',target:threat,intent:`Screen your flank against ${threat.name}.`};
      return {kind:'station',to:{x:hero.x+(t.x-hero.x)/d*6,z:hero.z+(t.z-hero.z)/d*6},intent:`Screen your flank toward ${threat.name}.`};
    }
    case 'guard_standard':{
      const guarded=target==='convoy'?nearestOf((world.mission?.escorts??[]).map(id=>actorById(world,id)).filter(e=>e&&standingActor(e)),c)
        :target==='hero'?hero:squadById(world,String(target).replace(/^squad:/,''));
      if(!guarded||(guarded.members?!fielded(world,guarded):!standingActor(guarded)))return null;
      const g=centreOf(world,guarded),threat=foeNear(world,squad,g,st.guard+4);
      if(threat)return {kind:'engage',target:threat,intent:`Guard ${target==='convoy'?'the column':guarded.name} against ${threat.name}.`};
      return {kind:'station',to:g,keep:st.guard*.6,intent:`Guard ${target==='convoy'?'the column':guarded.name}.`};
    }
  }
  return null;
}
// The squad's station beside the soldier: ahead of him on its own side, spread by its place in the line.
function station(world,squad,hero){
  const index=squadsOf(world).filter(ours).indexOf(squad),fx=hero.fx??1,fz=hero.fz??0,st=SQUAD_STANDING.station;
  const lateral=((index%2?1:-1)*(st.flank-(Math.floor(index/2))*2))+(index===0?0:0),ahead=index<2?st.front:st.front-3;
  return {x:hero.x+fx*ahead-fz*lateral,z:hero.z+fz*ahead+fx*lateral};
}
// Where a broken squad falls back to: its own side of the field.
function rear(world,squad){const w=world.map.width*2.5;return {x:ours(squad)?Math.min(squad.x,6):Math.max(squad.x,w-6),z:squad.z};}

function act(world,squad,p){
  switch(p.kind){
    case 'fallback':goTo(world,squad,p.to,{run:true});plan(squad,p.intent,{x:p.to.x,z:p.to.z});return;
    case 'engage':{const c=centreOf(world,p.target);goTo(world,squad,c,{run:span(c.x-squad.x,c.z-squad.z)>12&&squad.formation!=='shield-wall',stopAt:1.5});
      plan(squad,p.intent,{targetId:p.target.id,x:c.x,z:c.z});return;}
    case 'station':{const keep=p.keep??SQUAD_STANDING.station.keep,c=squadCentre(world,squad);
      if(span(c.x-p.to.x,c.z-p.to.z)>keep)goTo(world,squad,p.to,{run:span(c.x-p.to.x,c.z-p.to.z)>14});else halt(squad);plan(squad,p.intent,{x:p.to.x,z:p.to.z});return;}
    case 'hold':{const c=squadCentre(world,squad);if(span(c.x-p.to.x,c.z-p.to.z)>3)goTo(world,squad,p.to,{run:span(c.x-p.to.x,c.z-p.to.z)>14});else halt(squad);
      plan(squad,p.intent,{x:p.to.x,z:p.to.z});return;}
  }
}

// --- The enemy: the doctrine planner (0.38 commandDoctrine, at round boundaries) ---------
const MOBILE=['cavalry','heavy','raider'];
// The round a plan made now is for: the first at the start, the next at a round's end.
const roundAhead=world=>Math.floor((world.tick+1)/R)+1;
export function planDoctrine(world){
  const def=COMMAND_CHAPTERS.find(c=>c.id===world.chapter),enemies=squadsOf(world).filter(s=>s.side==='enemy'&&fielded(world,s)).sort((a,b)=>a.id.localeCompare(b.id));
  if(!def||!enemies.length){world.doctrine=null;return;}
  const hero=actorById(world,world.heroId),friends=squadsOf(world).filter(s=>ours(s)&&fielded(world,s)&&!unseen(world,s));
  const escorts=(world.mission?.escorts??[]).map(id=>actorById(world,id)).filter(e=>e&&standingActor(e));
  const pursuing=['pursuit','interdiction'].includes(def.doctrine),round=Math.floor(world.tick/R)+1,next=roundAhead(world);
  const situation=observeBattleSituation(world,enemies,friends,escorts,hero),identity=tacticalIdentity(world.chapter);
  // The plan: drawn again once it has been kept its rounds (it may be drawn again); a reserve plan only at the start.
  const previous=world.doctrine?.plan??null,kinds=ENEMY_PLANS.kinds;let plan=previous;
  if(!previous||next-previous.since>=(kinds[previous.id]?.hold??ENEMY_PLANS.hold)){
    const favour=ENEMY_FACTIONS[enemies[0].faction]?.plans??{};
    const pool=(ENEMY_PLANS.weights[def.doctrine]??ENEMY_PLANS.weights.approach).filter(([id])=>!previous||!kinds[id].opening).map(([id,w])=>[id,w*(favour[id]??1)]);
    const candidates=scoreEnemyPlans(world,pool,situation),best=Math.max(...candidates.map(p=>p.score));
    const near=candidates.filter(p=>p.score>=best-ADAPTIVE_TACTICS.nearBest).map(p=>[p.id,p.weight*(p.score===best?ADAPTIVE_TACTICS.bestLean:1)]);
    const id=pickWeighted(world.rng,'ai',near);
    plan={id,since:next,reason:candidates.find(p=>p.id===id).reason};
    if(previous&&previous.id!==plan.id)emit(world,{kind:'enemy-plan',plan:plan.id});
  }
  // Each band's own preference, drawn once (a reinforcement's when it first stands in the plan).
  for(const s of enemies)if(!s.pref)s.pref=pickWeighted(world.rng,'ai',ENEMY_PLANS.preferences);
  // Focus the weakest exposed target (escorts first under pursuit); the soldier if no squad of ours stands.
  // A squad standing alone, wavering or broken is the more exposed.
  const ratio=s=>s.strength/s.maxStrength-(friends.some(o=>o!==s&&span(o.x-s.x,o.z-s.z)<=COHESION.supportRange)?0:.25)-(s.broken?.25:shaken(s)?.15:0);
  const visibleEscort=escorts.find(e=>situation.observed.includes(e.id)),observedTarget=squadById(world,situation.targetId)??actorById(world,situation.targetId);
  const focus=pursuing&&visibleEscort?visibleEscort:observedTarget??(friends.length?[...friends].sort((a,b)=>ratio(a)-ratio(b)||a.id.localeCompare(b.id))[0]:hero);
  const defensive=['screen','siege','reserve'].includes(def.doctrine),through=ENEMY_PLANS.reserveThrough[plan.id]??ENEMY_PLANS.reserveThrough.standard;
  const reserve=defensive&&!situation.objectiveThreat&&next<=through&&enemies.length>=3?enemies.find(s=>['infantry','guard'].includes(s.role))??null:null;
  // A feint: the band of foot nearest the focus closes and falls back; the plan's other sides are forced.
  const at=focus?centreOf(world,focus):null,foot=enemies.filter(s=>s!==reserve&&['infantry','guard'].includes(s.role));
  const feinter=plan.id==='feint'&&at?[...foot].sort((a,b)=>span(a.x-at.x,a.z-at.z)-span(b.x-at.x,b.z-at.z)||a.id.localeCompare(b.id))[0]??null:null;
  const forced=kinds[plan.id]?.side??null,footFlank=forced?foot.find(s=>s!==feinter)??null:null;
  const roles={},sides={};let flankers=0;
  enemies.forEach((s,i)=>{
    if(s===reserve){roles[s.id]='Reserve';return;}
    if(s===feinter){roles[s.id]='Feint';return;}
    if(s.role==='archer'){roles[s.id]='Suppress';return;}
    if(MOBILE.includes(s.role)||s===footFlank||(plan.id==='pincer'||def.doctrine==='pincer'&&plan.id==='fix')&&i%2===1){
      roles[s.id]='Flank';if(forced)sides[s.id]=forced;else if(plan.id==='pincer')sides[s.id]=flankers++%2?1:-1;return;}
    roles[s.id]=def.doctrine==='siege'&&['hold','supply'].includes(world.mission?.mode)?'Contest the approach':'Fix';
  });
  // A mission changes what the army contests. One band remains enough to
  // threaten a crossing, store or work site; the rest still fight the line.
  let pressureTargetId=null;
  if(situation.escort&&identity.pressure==='escort'){
    const column=escorts.find(e=>situation.observed.includes(e.id));
    const interceptor=enemies.find(s=>MOBILE.includes(s.role)&&roles[s.id]!=='Reserve')??enemies.find(s=>roles[s.id]==='Fix');
    if(column&&interceptor){roles[interceptor.id]='Intercept the column';pressureTargetId=column.id;}
  }else if(['objective','works'].includes(identity.pressure)&&situation.observed.length&&world.mission?.goal&&['capture','recover','hold','supply'].includes(world.mission.mode)){
    const defender=enemies.find(s=>['Fix','Contest the approach'].includes(roles[s.id]))??enemies.find(s=>['infantry','guard'].includes(s.role)&&roles[s.id]!=='Reserve');
    if(defender)roles[defender.id]='Contest the objective';
  }
  // Field approaches (0.38 edition 35): engineers draw the archers onto the soldier; a diversion draws one band
  // away until round two; against a defensive advance the horse turn the shield flank.
  const approach=world.approach??null;
  if(approach==='breach')for(const s of enemies)if(s.role==='archer')roles[s.id]='Suppress engineers';
  if(approach==='diversion'&&next<=2){const d=enemies.find(s=>roles[s.id]!=='Reserve');if(d)roles[d.id]='Investigate diversion';}
  if(approach==='advance')for(const s of enemies)if(['cavalry','heavy','raider'].includes(s.role))roles[s.id]='Turn the shield flank';
  world.doctrine={id:def.doctrine,label:def.label,purpose:def.purpose,round,focusId:focus?.id??null,focusName:focus?.name??null,reserveId:reserve?.id??null,roles,
    plan:{id:plan.id,since:plan.since,reason:plan.reason??kinds[plan.id]?.summary??''},sides,pressureTargetId,
    identity:{id:identity.id,label:identity.label}};
}
// What a band prefers to strike when its role leaves it free (ENEMY_PLANS.preferences), if near enough.
function preferredTarget(world,squad,friends,hero,c){
  const near=list=>nearestOf(list.map(f=>({...centreOf(world,f),ref:f})),c)?.ref??null,soldier=hero&&standingActor(hero)?hero:null;
  const pick=squad.pref==='nearest'?near([...friends,...(soldier?[soldier]:[])]):squad.pref==='archers'?near(friends.filter(f=>f.role==='archer')):squad.pref==='soldier'?soldier:null;
  if(!pick)return null;const p=centreOf(world,pick);return span(p.x-c.x,p.z-c.z)<=ENEMY_PLANS.preferenceRange?pick:null;
}
function enemyDecision(world,squad){
  const d=world.doctrine,role=d?.roles?.[squad.id]??'Fix',hero=actorById(world,world.heroId),c=squadCentre(world,squad);
  squad.pulledBack=false;
  if(squad.broken){const to=rear(world,squad);goTo(world,squad,to,{run:true});plan(squad,'Broken: fall back to regroup.',{x:to.x,z:to.z});return;}
  // Drawn after a feigned retreat (release 7): it rides the fleeing horse down until they turn.
  if(squad.drawnBy){const lure=squadById(world,squad.drawnBy);
    if(lure&&fielded(world,lure)&&lure.order?.kind==='feigned_retreat'){engageTarget(world,squad,lure,`Ride down ${lure.name} as it flees.`);return;}
    squad.drawnBy=null;}
  // A band lying in wait (variety.js) keeps still and hidden until one of ours comes near, then falls on him. It
  // rises and joins the plan once one of ours nears the objective (as Contest the approach measures it), or at the
  // end of round `patience`, so it never sits out the battle.
  if(squad.lying){
    const reach=EXCHANGE.ambush.spring+EXCHANGE.contact,prey=[...squadsOf(world).filter(s=>ours(s)&&fielded(world,s)&&hostile(squad,s)),
      ...world.actors.filter(a=>standingActor(a)&&!a.squadId&&hostile(squad,a))].map(t=>({t,d:span(centreOf(world,t).x-c.x,centreOf(world,t).z-c.z)}))
      .filter(x=>x.d<=reach).sort((a,b)=>a.d-b.d||(a.t.id<b.t.id?-1:1))[0]?.t;
    const goal=world.mission?.goal,waiting=Math.floor(world.tick/R)+1<=HIDDEN_BANDS.patience&&!(goal&&foeNearGoal(world,squad,goal));
    if(!prey&&!squad.contact&&waiting&&membersOf(world,squad).every(m=>m.hidden)){halt(squad);plan(squad,'Lie in wait.');return;}
    squad.lying=false;
    if(prey){squad.spring={targetId:prey.id,unseen:!prey.members||noticeOf(prey,squad.id)<100};engageTarget(world,squad,prey,`Fall on ${prey.name} from hiding.`);return;}
    rise(world,squad);
  }
  const friends=squadsOf(world).filter(s=>ours(s)&&fielded(world,s)&&!unseen(world,s)),foes=[...friends,...(hero&&standingActor(hero)?[hero]:[])];
  // Pull back a wavering band behind a steady one near it, away from our nearest squad (ENEMY_TECHNIQUES.pullBack).
  const P=ENEMY_TECHNIQUES.pullBack,near=nearestOf(friends.map(f=>({...squadCentre(world,f),ref:f})),c);
  const steady=shaken(squad)?nearestOf(squadsOf(world).filter(s=>s!==squad&&s.side===squad.side&&fielded(world,s)&&!s.broken&&s.morale>P.steady)
    .map(s=>({...squadCentre(world,s),ref:s})).filter(s=>span(s.x-c.x,s.z-c.z)<=P.range),c):null;
  if(steady&&near){
    const k=span(steady.x-near.x,steady.z-near.z)||1,to={x:steady.x+(steady.x-near.x)/k*P.behind,z:steady.z+(steady.z-near.z)/k*P.behind};
    squad.pulledBack=true;goTo(world,squad,to,{run:true});plan(squad,`Pull back behind ${steady.ref.name} to steady.`,{x:to.x,z:to.z});return;
  }
  const focus=squadById(world,d?.focusId)??actorById(world,d?.focusId)??nearestOf(foes.map(f=>({...centreOf(world,f),ref:f})),c)?.ref??hero;
  if(!focus)return;
  const threat=nearestOf(friends.map(f=>({...squadCentre(world,f),ref:f})),c);
  const threatened=threat&&span(threat.x-c.x,threat.z-c.z)<=12;
  if(role==='Reserve'&&!threatened){const a=squad.anchor??(squad.anchor={x:squad.x,z:squad.z});goTo(world,squad,a);braceStill(world,squad);plan(squad,'Held in reserve until threatened.',{x:a.x,z:a.z});return;}
  // A lure (release 7's missions): the horse it names keeps its ground, until drawn out or until one of ours comes close.
  const lure=world.mission?.lure;
  if(lure&&(lure==='cavalry'?HORSE_ORDERS.roles:[lure]).includes(squad.role)&&!threatened){const a=squad.anchor??(squad.anchor={x:squad.x,z:squad.z});
    goTo(world,squad,a);plan(squad,'Wait for an opening.',{x:a.x,z:a.z});return;}
  if(squad.role==='guard'&&!threatened&&span(c.x-(squad.anchor?.x??c.x),c.z-(squad.anchor?.z??c.z))<=15){
    squad.anchor??={x:squad.x,z:squad.z};const intruder=nearestOf(foes.map(f=>({...centreOf(world,f),ref:f})),squad.anchor);
    if(intruder&&span(intruder.x-squad.anchor.x,intruder.z-squad.anchor.z)<=15){engageTarget(world,squad,intruder.ref,'Guard the approach; strike the intruder.');return;}
    goTo(world,squad,squad.anchor);braceStill(world,squad);plan(squad,'Guard this approach.',{x:squad.anchor.x,z:squad.anchor.z});return;
  }
  // A band of foot near its archers meets the squad that presses them.
  if(['infantry','guard'].includes(squad.role)){
    const pressed=squadsOf(world).find(s=>s.side===squad.side&&s.role==='archer'&&fielded(world,s)&&s.contact&&span(s.x-c.x,s.z-c.z)<=ENEMY_TECHNIQUES.protect);
    const presser=pressed?squadById(world,pressed.contact):null;
    if(presser&&ours(presser)&&fielded(world,presser)){engageTarget(world,squad,presser,`Protect the archers from ${presser.name}.`);return;}
  }
  if(role==='Investigate diversion'){const p={x:squad.x,z:Math.max(4,Math.min(world.map.height*2.5-4,squad.z+(squad.z<world.map.height*1.25?-12:12)))};
    goTo(world,squad,p);plan(squad,'Investigate the false approach.',{x:p.x,z:p.z});return;}
  if(role==='Intercept the column'){
    const column=actorById(world,d.pressureTargetId);
    if(column&&standingActor(column)&&!column.hidden&&!smokeBetween(world,c,column)){
      engageTarget(world,squad,column,`Intercept ${column.name}; cut its route to safety.`);return;
    }
  }
  if(['Contest the approach','Contest the objective'].includes(role)&&world.mission?.goal){
    const targets=role==='Contest the objective'?(world.mission.points??[]).filter(p=>!p.secured):[],g=nearestOf(targets,c)??world.mission.goal,near=foeNearGoal(world,squad,g);
    const intent=role==='Contest the objective'?'Contest the mission ground.':'Contest the approach.';
    if(near){engageTarget(world,squad,near,intent);return;}goTo(world,squad,g,{stopAt:2});plan(squad,intent,{x:g.x,z:g.z});return;}
  // Raiders go for an exposed column first (0.38 objectiveFor).
  if(squad.role==='raider'){const col=nearestOf((world.mission?.escorts??[]).map(id=>actorById(world,id)).filter(e=>e&&standingActor(e)),c);
    if(col&&span(col.x-c.x,col.z-c.z)<=40){engageTarget(world,squad,col,'Seek the column.');return;}}
  const target=role==='Suppress engineers'&&hero&&standingActor(hero)?hero:role==='Fix'?preferredTarget(world,squad,friends,hero,c)??focus:focus;
  if(role==='Suppress'||role==='Suppress engineers'||squad.role==='archer'){
    const t=centreOf(world,target),range=missileRangeOf(squad)||20,d=span(t.x-c.x,t.z-c.z);
    if(d<8){const away={x:c.x+(c.x-t.x)/(d||1)*6,z:c.z+(c.z-t.z)/(d||1)*6};goTo(world,squad,away,{run:true});plan(squad,'Step back and keep shooting.',{x:away.x,z:away.z,targetId:target.id});return;}
    if(d>range*.85||terrainCover(world,c,t)||smokeBetween(world,c,t)){goTo(world,squad,t,{stopAt:range*.75});plan(squad,`Close to bow range of ${target.name}.`,{targetId:target.id,x:t.x,z:t.z});return;}
    halt(squad);plan(squad,`Suppress ${target.name}.`,{targetId:target.id,x:t.x,z:t.z});return;
  }
  const first=d?.plan&&Math.floor(world.tick/R)+1<=d.plan.since;
  if(role==='Feint'){
    // The plan's first round: close on the mark; then fall back a fixed way, once, to draw a squad out.
    const t=centreOf(world,target),f=ENEMY_PLANS.feint;
    if(first){squad.feint=null;goTo(world,squad,t,{stopAt:f.close});plan(squad,`Close on ${target.name}, then fall back.`,{targetId:target.id,x:t.x,z:t.z});return;}
    if(!squad.feint){const k=span(c.x-t.x,c.z-t.z)||1;squad.feint={x:c.x+(c.x-t.x)/k*f.back,z:c.z+(c.z-t.z)/k*f.back};}
    goTo(world,squad,squad.feint,{run:true});plan(squad,`Fall back to draw ${target.name} out.`,{x:squad.feint.x,z:squad.feint.z});return;
  }
  // Under a feint the others wait out its first round, then strike.
  if(role==='Fix'&&d?.plan?.id==='feint'&&first&&squadsOf(world).some(s=>d.roles[s.id]==='Feint')){halt(squad);plan(squad,'Wait for the feint to draw you out.');return;}
  if(role==='Flank'||role==='Turn the shield flank'){
    // A side approach: beside the focus, away from its front (horse avoid a braced shield front); the plan may name the side.
    const t=centreOf(world,target),fx=target.fx??-1,fz=target.fz??0,own=(c.x-t.x)*-fz+(c.z-t.z)*fx>=0?1:-1,side=role==='Flank'?d?.sides?.[squad.id]??own:own;
    const {wide,behind}=ENEMY_PLANS.flank,point={x:t.x-fz*side*wide-fx*behind,z:t.z+fx*side*wide-fz*behind};
    if(span(c.x-point.x,c.z-point.z)>4&&span(c.x-t.x,c.z-t.z)>6){goTo(world,squad,point,{run:true});plan(squad,`Seek ${target.name}’s ${side>0?'right':'left'} flank.`,{targetId:target.id,x:point.x,z:point.z});return;}
    engageTarget(world,squad,target,`Strike ${target.name} from the flank.`);return;
  }
  engageTarget(world,squad,target,`Fix ${target.name} in place.`);
}
// A band of a faction that braces (ENEMY_FACTIONS) braces once it has held its ground long enough.
function braceStill(world,squad){
  if(squad.braced||squad.moving||!ENEMY_FACTIONS[squad.faction]?.brace||world.tick-squad.stillSince<ENEMY_TECHNIQUES.braceTicks)return;
  squad.braced=true;emit(world,{kind:'squad-braced',squadId:squad.id});
}
function foeNearGoal(world,squad,g){
  const hero=actorById(world,world.heroId);const list=[...squadsOf(world).filter(s=>ours(s)&&fielded(world,s)),...(hero&&standingActor(hero)?[hero]:[])];
  return list.map(f=>({f,c:centreOf(world,f)})).filter(x=>span(x.c.x-g.x,x.c.z-g.z)<=12).sort((a,b)=>span(a.c.x-g.x,a.c.z-g.z)-span(b.c.x-g.x,b.c.z-g.z))[0]?.f??null;
}
function engageTarget(world,squad,target,intent){
  const p=centreOf(world,target);goTo(world,squad,p,{run:span(p.x-squad.x,p.z-squad.z)>12,stopAt:target.members?1.5:.5});
  plan(squad,intent,{targetId:target.id,x:p.x,z:p.z});
}

// --- Each decision (4 Hz, staggered by squad) ------------------------------------------
export function decideSquad(world,squad){
  if(!fielded(world,squad)||world.status!=='active')return;
  if(ours(squad)){
    let done=false;
    if(squad.order&&!(squad.broken&&squad.order.kind!=='hold'))done=followOrder(world,squad);
    if(!done){
      squad.order=null;const slots=squad.standing??[];let chosen=null;
      for(const [i,slot]of slots.entries()){const p=squadSlotPlan(world,squad,slot);if(p){chosen=p;squad.standingSlot=i;break;}}
      if(chosen)act(world,squad,chosen);else{halt(squad);squad.standingSlot=-1;plan(squad,'Stand and wait for orders.');}
    }
  }else enemyDecision(world,squad);
  memberDecisions(world,squad);
}
export {SUPPRESSION};

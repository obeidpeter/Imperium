import {ESCORT_RULES,TIME} from '../../data/realtime-rules.js';
import {actorById,distanceBetween,hostile} from './abilities.js';
import {helpless,setRoute} from './motion.js';
import {spawnActor} from './actors.js';
import {spawnSquad} from './squads.js';
import {span} from './navigation.js';

// A campaign encounter's objective in real time (§3.2 "Converting 0.38
// data"): turns become rounds of 200 ticks, tiles become metres, and the 0.38
// mission modes keep their meaning. Control of a place accumulates while a
// friend stands within its radius and no enemy does; reinforcements arrive at
// the round boundary their 0.38 turn named; the deadline closes at the end of
// its round. Pure; the world's `mission` record carries all of it.

const R=TIME.roundTicks;
const emit=(world,event)=>world.events.push({tick:world.tick,...event});
const standing=o=>o.alive&&!o.down&&!o.carriedBy;
export const roundEnd=world=>(world.tick+1)%R===0;
const friendly=o=>o.side==='player'||o.side==='ally';

// Who controls a place: friends near and no enemy near.
function control(world,point,radius){
  let friends=0,foes=0;
  for(const o of world.actors){
    if(!standing(o)||span(o.x-point.x,o.z-point.z)>radius)continue;
    if(o.side==='enemy')foes++;else if(friendly(o))friends++;
  }
  return {friends,foes};
}
const escortsOf=world=>world.mission.escorts.map(id=>actorById(world,id)).filter(Boolean);
const atGoal=(world,o)=>span(o.x-world.mission.goal.x,o.z-world.mission.goal.z)<=world.mission.radius;
const capable=world=>world.mission.required.every(a=>world.used.includes(a));

// Escorted columns walk toward the goal while the hero (or a companion) is
// near them; a wounded man waits for Bind wounds or to be carried.
function moveEscorts(world){
  const m=world.mission,leaders=world.actors.filter(o=>standing(o)&&(o.id===world.heroId||world.party.includes(o.id)));
  for(const e of escortsOf(world)){
    if(!standing(e)||e.action)continue;
    if(!e.escort.escorted||m.pauseEscorts){if(e.order){e.order=null;e.path=[];}continue;}
    const near=leaders.some(l=>distanceBetween(l,e)<=m.followRange),there=span(e.x-m.goal.x,e.z-m.goal.z)<=m.radius*.6;
    if(there||!near){if(e.order){e.order=null;e.path=[];e.gait=null;}continue;}
    // Threatened and uncovered, the column halts and draws back to its nearest protector.
    const threat=world.actors.some(o=>o.side==='enemy'&&standing(o)&&!o.hidden&&distanceBetween(o,e)<=ESCORT_RULES.halt);
    if(threat&&!leaders.some(l=>distanceBetween(l,e)<=ESCORT_RULES.cover)){
      const l=leaders.reduce((b,o)=>!b||distanceBetween(o,e)<distanceBetween(b,e)?o:b,null);
      if(l&&distanceBetween(l,e)>2){if(e.order?.kind!=='fallback'||!e.path.length){e.order={kind:'fallback'};setRoute(world,e,{x:l.x,z:l.z},{run:false});}}
      else if(e.order){e.order=null;e.path=[];e.gait=null;}
      continue;
    }
    if(e.order?.kind==='fallback'){e.order=null;e.path=[];}
    if(e.order?.kind!=='move'||!e.path.length){e.order={kind:'move'};setRoute(world,e,m.goal,{run:false});}
  }
}

function arrive(world,wave,index){
  wave.arrived=true;
  // From Chapter IV a reinforcement is a squad (squads.js); before, a single man.
  if(wave.squad){
    const squad=spawnSquad(world,{...wave.squad,id:`reinforce${index}`,unitId:`reinforce${index}`,at:[wave.x,wave.z],anchor:[wave.x,wave.z]});
    if(squad)squad.anchor={x:wave.x,z:wave.z};
    emit(world,{kind:'reinforcements',x:wave.x,z:wave.z,role:wave.squad.role,squadId:squad?.id??null});return;
  }
  const actor=spawnActor(world,wave.spec,{x:wave.x,z:wave.z},`reinforce${index}`);
  if(actor){actor.ai.state='engage';for(const o of world.actors)if(o.side!=='enemy'&&o.alive)actor.ai.notice[o.id]=100;}
  emit(world,{kind:'reinforcements',x:wave.x,z:wave.z,role:wave.spec.role,actorId:actor?.id??null});
}

// The centre of a 0.38 tile in this world's metres (its layout of 2.5 m tiles).
function tilePoint(world,tile){
  let x=0,z=0;for(let i=0;i<tile.x;i++)x+=world.layout.kx[i];for(let i=0;i<tile.y;i++)z+=world.layout.ky[i];
  return {x:(x+world.layout.kx[tile.x]/2)*2.5,z:(z+world.layout.ky[tile.y]/2)*2.5};
}
// An operation phase's gathering: the soldier and his companion near the place (0.38 operationGather).
function gathered(world){
  const m=world.mission,hero=actorById(world,world.heroId),friend=world.actors.find(o=>standing(o)&&o.id!==world.heroId&&(o.side==='ally'||world.party.includes(o.id)));
  const near=o=>span(o.x-m.goal.x,o.z-m.goal.z)<=m.gather;return !!hero&&near(hero)&&(!friend||near(friend));
}
// What the phase also asks before it counts (0.38 operationQualified).
function qualified(world){
  const m=world.mission,hero=actorById(world,world.heroId);
  if(m.commander&&(!hero||span(hero.x-m.goal.x,hero.z-m.goal.z)>m.radius))return false;
  if(m.rescue&&!escortsOf(world).every(e=>e.escort.escorted||e.carriedBy))return false;
  if(m.phaseWave&&m.mode==='hold'&&m.waves.some(w=>!w.arrived))return false;
  return true;
}
// The next operation phase: its objective, a party to protect, a wave to come.
function advancePhase(world){
  const m=world.mission;if(!m.phases||m.phase>=m.phases.length-1)return false;
  m.completed.push(m.phases[m.phase].id);m.phase++;const next=m.phaseMissions[m.phase],spec=m.phases[m.phase],round=Math.floor(world.tick/R)+1;
  Object.assign(m,{mode:next.mode,goal:next.goal,goalTile:next.goalTile,points:next.points.map(p=>({...p})),holdRequired:next.holdRequired,gather:next.gather,
    commander:next.commander,rescue:next.rescue,pauseEscorts:next.pauseEscorts,label:next.label,objective:next.objective,id:next.id,heldTicks:0,phaseWave:!!spec.wave});
  if(spec.escort&&!world.actors.some(a=>a.id===spec.escort.id)){
    const at=tilePoint(world,{x:spec.escort.at[0],y:spec.escort.at[1]});
    const actor=spawnActor(world,{name:spec.escort.name,side:'neutral',role:'escort',attributes:{str:10,agi:9,con:12,per:9,combat:2,field:4},kit:['tunic','paenula'],
      escort:{escorted:true,wounded:false},pace:1.6,drawn:false},at,spec.escort.id);
    if(actor)m.escorts.push(actor.id);
  }
  if(spec.wave){const w=spec.wave,at=tilePoint(world,{x:w.x,y:w.y}),template=m.squadTemplates?.[w.role]??m.squadTemplates?.infantry;
    m.waves.push({round:Math.min(30,round+Math.max(1,w.delay+m.waveDelay)),x:at.x,z:at.z,arrived:false,
      ...(template?{squad:template}:{spec:{...m.waves[0]?.spec??{name:'Raider',side:'enemy',role:w.role,attributes:{str:12,agi:12,con:10,per:10,combat:6,field:6},
        kit:['tunic','jerkin','axe']},role:w.role}})});}
  emit(world,{kind:'phase',index:m.phase,label:m.label});return true;
}

export function objectiveMet(world){
  const m=world.mission;
  if(m.gather)return gathered(world);
  switch(m.mode){
    case 'training':return ['move','strike','brace','throw'].every(a=>world.used.includes(a));
    case 'clear':return !world.actors.some(o=>o.side==='enemy'&&o.alive)&&m.waves.every(w=>w.arrived);
    case 'recover':return world.used.includes('scout')&&!!world.objects.find(o=>o.id===m.objectId)?.done;
    case 'extract':{
      const hero=actorById(world,world.heroId);
      return escortsOf(world).every(e=>e.alive&&(e.escort.escorted||e.carriedBy)&&atGoal(world,e))&&!!hero&&atGoal(world,hero)&&m.heldTicks>=m.holdRequired*R;
    }
    case 'hold':{const c=control(world,m.goal,m.radius);return m.heldTicks>=m.holdRequired*R&&c.foes===0;}
    case 'capture':case 'supply':return m.points.every(p=>p.secured)&&m.defence>0;
    default:return !world.actors.some(o=>o.side==='enemy'&&o.alive);
  }
}

export function missionTick(world){
  const m=world.mission;if(!m||world.status!=='active')return;
  if(world.tick%TIME.aiInterval===0)moveEscorts(world);
  const goal=control(world,m.goal,m.radius);
  if(m.holdRequired>0&&goal.friends>0&&goal.foes===0)m.heldTicks++;
  if(goal.foes>0&&goal.friends===0)m.occupiedTicks++;
  for(const p of m.points)if(!p.secured){const c=control(world,p,m.radius);if(c.friends>0&&c.foes===0){p.secured=true;emit(world,{kind:'secured',x:p.x,z:p.z});}}
  if(roundEnd(world)){
    const round=(world.tick+1)/R;
    m.waves.forEach((w,i)=>{if(!w.arrived&&round>=w.round)arrive(world,w,i);});
    if(['hold','supply'].includes(m.mode)&&m.pressure&&m.occupiedTicks>=R/2){m.defence-=m.pressure;emit(world,{kind:'pressure',amount:m.pressure,defence:m.defence});}
    m.occupiedTicks=0;
  }
  const hero=actorById(world,world.heroId);
  if(!hero?.alive||hero.down){world.status='lost';m.reason='The soldier falls.';emit(world,{kind:'defeat'});return;}
  if(escortsOf(world).some(e=>!e.alive)){world.status='lost';m.reason='A protected column was lost.';emit(world,{kind:'defeat'});return;}
  if(m.defence<=0){world.status='lost';m.reason='The defended line breaks.';emit(world,{kind:'defeat'});return;}
  if(objectiveMet(world)&&qualified(world)){
    if(advancePhase(world))return;
    if(capable(world)){world.status='won';emit(world,{kind:'victory'});return;}
    if(!m.toldMissing){m.toldMissing=true;emit(world,{kind:'capability-needed',missing:m.required.filter(a=>!world.used.includes(a))});}
  }
  if(roundEnd(world)&&(world.tick+1)/R>=m.deadline){
    world.status='lost';m.reason=!capable(world)?`Deadline: demonstrate ${m.required.filter(a=>!world.used.includes(a)).join(', ')}.`:'The deadline has passed.';
    emit(world,{kind:'defeat'});
  }
}

// The objective's progress in words, for the mission header.
export function missionProgress(world){
  const m=world.mission;if(!m)return '';const round=Math.floor(world.tick/R)+1,left=Math.max(0,m.deadline-round+1);
  const held=Math.min(m.holdRequired,Math.floor(m.heldTicks/R)),deadline=`Round ${round} of ${m.deadline}`;
  switch(m.mode){
    case 'training':return `Drill demonstrated: ${['move','strike','brace','throw'].filter(a=>world.used.includes(a)).length} of 4.`;
    case 'clear':{const n=world.actors.filter(o=>o.side==='enemy'&&o.alive&&!o.hidden).length,w=m.waves.filter(x=>!x.arrived).length;
      return `${n} ${n===1?'enemy':'enemies'} on the field${w?`; reinforcements due in round ${m.waves.find(x=>!x.arrived).round}`:''}. ${deadline}.`;}
    case 'recover':return `${world.used.includes('scout')?'Ground scouted':'Scout the ground'}; ${world.objects.find(o=>o.id===m.objectId)?.done?'chest recovered':'recover the chest'}. ${deadline}.`;
    case 'extract':{const e=escortsOf(world),there=e.filter(x=>atGoal(world,x)).length;
      return `Columns at the rally point ${there} of ${e.length}${m.holdRequired?`; held ${held} of ${m.holdRequired} rounds`:''}. ${deadline}.`;}
    case 'hold':return `Ground held ${held} of ${m.holdRequired} rounds; line ${m.defence}. ${deadline}.`;
    case 'capture':return `${m.gather?'Gather at the marker':`Positions secured ${m.points.filter(p=>p.secured).length} of ${m.points.length}`}`+
      `${m.commander?'; the soldier must stand at the marker':''}. ${deadline}.`;
    default:return `${deadline}; ${left} left.`;
  }
}
export {friendly,control};

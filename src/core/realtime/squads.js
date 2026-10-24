import {COHESION,ENEMY_FACTIONS,ENEMY_TECHNIQUES,EXCHANGE,FORMATIONS,HOLD_BRACE_TICKS,MIN_MEN,MORALE,REFERENCE_STRENGTH,SPACING,SQUAD_MEN,SUPPRESSION} from '../../data/realtime-squads.js';
import {MOVEMENT,TIME} from '../../data/realtime-rules.js';
import {actorById,distanceBetween,hostile} from './abilities.js';
import {makeActor} from './actors.js';
import {derivedValues} from './combat.js';
import {cellCentre,clampToMap,crossesCover,findRoute,groundHeight,navGrid,nearestWalkable,span,speedFactor,terrainAtPoint,walkable} from './navigation.js';
import {sightBlocked} from './sight.js';
import {pickWeighted} from './rng-streams.js';
import {knowAttacker,noticeOf} from './squad-sight.js';

// Squads (build brief §3.4, from Chapter IV): a squad is a record with one
// strength, morale, cohesion and suppression, a formation, its orders and
// standing orders; its men are ordinary actors that it drives (`squadId`).
// They hold their places in its formation and fall one by one. A squad fights
// as one body (guide "Formations"): against another squad, or a single man (the
// soldier, a companion, a protected column), nobody trades single blows; once a
// second it deals a tenth of a 0.38 turn's exchange (the 0.38 formula, its
// modifiers in metres), and the men nearest the front fall as strength drops.
// A single man's own blows strike its men one at a time. Pure and
// deterministic: every number is the rules data's, and the only randomness is
// each exchange's spread, one draw of the combat stream (EXCHANGE.spread).

const R=TIME.roundTicks,DT=1/TIME.ticksPerSecond;
const emit=(world,event)=>world.events.push({tick:world.tick,...event});
const standing=o=>o.alive&&!o.down&&!o.carriedBy;
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
export const squadsOf=world=>world.squads??[];
export const squadById=(world,id)=>squadsOf(world).find(s=>s.id===id)??null;
export const squadOf=(world,actor)=>actor?.squadId?squadById(world,actor.squadId):null;
export const membersOf=(world,squad)=>squad.members.map(id=>actorById(world,id)).filter(a=>a&&standing(a));
export const menOf=(world,squad)=>membersOf(world,squad).length;
export const shaken=squad=>squad.morale<=MORALE.shaken;
export const alliedSides=(a,b)=>a===b||(a==='player'||a==='ally')&&(b==='player'||b==='ally');
// A squad still on the field: men standing.
export const fielded=(world,squad)=>squad.strength>0&&squad.members.some(id=>{const a=actorById(world,id);return a&&standing(a);});
const ROLE_NAMES={infantry:'squad',guard:'guard',archer:'archers',raider:'band',cavalry:'horse',heavy:'horse',soldier:'squad'};

// --- Formation --------------------------------------------------------------
// The formation a squad stands in when no order names one.
export function shapeOf(squad,{marching=false}={}){
  if(squad.formation)return squad.formation;
  if(marching)return 'column';
  return ['archer','raider'].includes(squad.role)?'loose':squad.role==='cavalry'||squad.role==='heavy'?'mounted':'line';
}
// Places in a formation for `count` men, in the squad's own frame (x to its
// right, z forward, metres from the front centre), front rank and centre first.
export function formationSlots(shape,count){
  const out=[];if(count<=0)return out;
  const spacing=SPACING[shape]??(shape==='mounted'?1.8:SPACING.line);
  if(shape==='wedge'){
    for(let row=0;out.length<count;row++)for(let i=0;i<=row&&out.length<count;i++)out.push({x:(i-row/2)*spacing,z:-row*spacing*.85});
    return out;
  }
  if(shape==='column'){for(let i=0;i<count;i++)out.push({x:(i%2?.5:-.5)*spacing,z:-Math.floor(i/2)*spacing});return out;}
  const front=Math.max(1,Math.ceil(count/2)),ranks=Math.ceil(count/front);
  for(let rank=0;rank<ranks;rank++){
    const here=Math.min(front,count-rank*front),stagger=shape==='loose'&&rank%2?spacing/2:0;
    // Centre first, then outward: the files nearest the standard are kept longest.
    const order=Array.from({length:here},(_,i)=>i).sort((a,b)=>Math.abs(a-(here-1)/2)-Math.abs(b-(here-1)/2)||a-b);
    for(const i of order)out.push({x:(i-(here-1)/2)*spacing+stagger,z:-rank*spacing});
  }
  return out;
}
// A slot's place on the field, given the squad's front centre and facing.
export const slotPoint=(squad,slot)=>({x:squad.x+squad.fz*-slot.x+squad.fx*slot.z,z:squad.z+squad.fx*slot.x+squad.fz*slot.z});
export const frontageOf=(world,squad)=>{const slots=formationSlots(shapeOf(squad),menOf(world,squad));return slots.reduce((w,s)=>Math.max(w,Math.abs(s.x)),0)*2+1;};

// --- Creating a squad -----------------------------------------------------------
// spec: { id, name, side, role, faction, unitId, veteranId, strength, maxStrength,
// damage, at:[x,z], face:[fx,fz], member:{name, attributes, kit, ammo, mounted},
// formation, standing, morale, cohesion, braced, moraleResistance }. 0.38 has no
// men: a unit is one token with Health. Here that Health is the squad's
// strength and each man an equal share of it (a design of this port).
export function menFor(role,side,maxStrength){
  const full=SQUAD_MEN[role]??SQUAD_MEN.infantry,reference=REFERENCE_STRENGTH[side==='enemy'?'enemy':'ally'];
  return Math.max(MIN_MEN,Math.min(full,Math.round(full*Math.min(1,maxStrength/reference))));
}
export function spawnSquad(world,spec){
  if(squadById(world,spec.id))return null;
  const maxStrength=spec.maxStrength??spec.strength,maxMen=spec.men??menFor(spec.role,spec.side,maxStrength),perMan=maxStrength/maxMen;
  const strength=Math.min(maxStrength,spec.strength??maxStrength),men=Math.max(1,Math.min(maxMen,Math.ceil(strength/perMan-1e-9)));
  const [fx0,fz0]=spec.face??[1,0],n=span(fx0,fz0)||1;
  const squad={id:spec.id,name:spec.name,side:spec.side,role:spec.role??'infantry',faction:spec.faction??null,unitId:spec.unitId??null,veteranId:spec.veteranId??null,
    strength,maxStrength,maxMen,perMan,morale:clamp(spec.morale??MORALE.start),cohesion:clamp(spec.cohesion??COHESION.start),suppression:0,
    moraleResistance:spec.moraleResistance??0,damage:spec.damage??null,formation:spec.formation??null,braced:!!spec.braced,broken:false,
    x:spec.at[0],z:spec.at[1],fx:fx0/n,fz:fz0/n,path:[],goal:null,gait:null,moving:false,stillSince:world.tick,runUp:0,
    order:null,pending:null,standing:spec.standing?spec.standing.map(s=>[...s]):null,standingSlot:-1,plan:null,
    contact:null,counterRound:0,guard:null,members:[],...(spec.temperament?{temperament:spec.temperament}:{})};
  const slots=formationSlots(shapeOf(squad),men),grid=navGrid(world.map);
  for(let i=0;i<men;i++){
    let p=clampToMap(grid,slotPoint(squad,slots[i]));if(!walkable(grid,p.x,p.z)){const c=nearestWalkable(grid,p.x,p.z);if(c>=0)p=cellCentre(grid,c);}
    const id=`${squad.id}-${i+1}`,m=spec.member;
    const actor=makeActor({id,name:m.name,side:spec.side,role:squad.role,attributes:m.attributes,kit:m.kit,ammo:m.ammo,mounted:!!m.mounted,faction:spec.faction,
      at:[p.x,p.z],face:[squad.fx,squad.fz],drawn:true,ai:false,squadId:squad.id,slot:i,unitId:null,loot:m.loot});
    world.actors.push(actor);squad.members.push(id);
  }
  (world.squads??=[]).push(squad);
  return squad;
}

// --- A man of a squad falls to a single blow (damage.js) -----------------------
// The squad loses his share of strength and takes the 0.38 hit: 8 morale (4
// more from the flank, 5 less in line), cohesion 10 (6 to a missile), and a
// missile adds a point of suppression.
export function memberFell(world,member,attacker,{arc='front',missile=null}={}){
  const squad=squadOf(world,member);if(!squad)return;
  squad.strength=Math.max(0,squad.strength-squad.perMan);
  hitSquad(world,squad,{flank:arc!=='front',ranged:!!missile,scale:1});
  afterLoss(world,squad,attacker);
}
// The pitch fire scorches a squad (field-objects.js): strength lost as men
// fall, those nearest the fire first; the 0.38 fire also costs cohesion and
// adds suppression (as a missile hit does) but no morale.
export function scorchSquad(world,squad,points,fire){
  if(!fielded(world,squad))return;const before=menOf(world,squad);
  squad.strength=Math.max(0,squad.strength-points);squad.cohesion=clamp(squad.cohesion-COHESION.ranged);
  squad.suppression=Math.min(SUPPRESSION.max,squad.suppression+SUPPRESSION.ranged);
  const keep=Math.max(0,Math.ceil(squad.strength/squad.perMan-1e-9)),men=membersOf(world,squad).sort((a,b)=>span(a.x-fire.x,a.z-fire.z)-span(b.x-fire.x,b.z-fire.z)||a.slot-b.slot);
  for(const m of men.slice(0,Math.max(0,before-keep))){
    m.alive=false;m.diedAt=world.tick;m.killedBy='fire';m.order=null;m.lock=null;m.path=[];m.action=null;
    emit(world,{kind:'fall',attackerId:null,defenderId:m.id,squadId:squad.id,cause:'fire'});
  }
  emit(world,{kind:'scorch',squadId:squad.id,damage:points});afterLoss(world,squad,null);
}
// Morale, cohesion and suppression after a hit worth `scale` of a 0.38 hit.
function hitSquad(world,squad,{flank=false,ranged=false,scale=1,morale=1}){
  const loss=Math.max(1,MORALE.hit+(flank?MORALE.flank:0)-(squad.formation==='line'?MORALE.line:0)-squad.moraleResistance)*scale*morale;
  squad.morale=clamp(squad.morale-loss);squad.cohesion=clamp(squad.cohesion-(ranged?COHESION.ranged:COHESION.melee)*scale);
  if(ranged)squad.suppression=Math.min(SUPPRESSION.max,squad.suppression+SUPPRESSION.ranged*scale);
}
function afterLoss(world,squad,attacker){
  if(!fielded(world,squad)){
    squad.strength=0;emit(world,{kind:'squad-destroyed',squadId:squad.id,attackerId:attacker?.id??null});
    // The 0.38 withdrawal shock: friends near a squad that is cut down lose heart.
    const centre=squadCentre(world,squad,true);
    for(const other of squadsOf(world))if(other!==squad&&fielded(world,other)&&alliedSides(other.side,squad.side)&&span(other.x-centre.x,other.z-centre.z)<=MORALE.shockRange)
      other.morale=clamp(other.morale-MORALE.shock);
    return;
  }
  if(!squad.broken&&squad.morale<=MORALE.broken){
    squad.broken=true;squad.braced=false;squad.order=null;squad.path=[];
    emit(world,{kind:'squad-broken',squadId:squad.id});
  }
}
// Where a squad stands: the mean of its men (or its front centre if none stand).
export function squadCentre(world,squad,anyone=false){
  const men=anyone?squad.members.map(id=>actorById(world,id)).filter(Boolean):membersOf(world,squad);if(!men.length)return {x:squad.x,z:squad.z};
  let x=0,z=0;for(const m of men){x+=m.x;z+=m.z;}return {x:x/men.length,z:z/men.length};
}

// --- Movement ---------------------------------------------------------------------
// The squad's front centre follows its path at the pace of its slowest man,
// times its formation's march (a shield wall half); marsh slows all but a line.
export function squadSpeed(world,squad){
  const men=membersOf(world,squad);if(!men.length)return 0;
  const run=squad.gait==='run'&&!squad.formation?.includes?.('shield');
  const pace=Math.min(...men.map(m=>run?derivedValues(m).run:MOVEMENT.walk));
  const grid=navGrid(world.map),terrain=terrainAtPoint(world.map,squad.x,squad.z);
  const ground=terrain==='marsh'&&squad.formation==='line'?FORMATIONS.line.marsh:speedFactor(grid,squad.x,squad.z);
  return pace*(FORMATIONS[squad.formation]?.march??1)*ground;
}
export function routeSquad(world,squad,point,{run=false}={}){
  const grid=navGrid(world.map),route=findRoute(grid,squad,clampToMap(grid,point,1));
  squad.path=route.points;squad.goal={x:route.stopPoint.x,z:route.stopPoint.z};squad.gait=route.points.length?(run?'run':'walk'):null;
  return route;
}
const turn=(squad,dx,dz)=>{const d=span(dx,dz);if(d>1e-6){squad.fx=dx/d;squad.fz=dz/d;}};
// A standard waits for its men: it does not march on while most of them are
// this far from their places (held up behind a wall, or still catching up).
const STRAGGLE=12;
export function moveSquads(world){
  const grid=navGrid(world.map);
  for(const squad of squadsOf(world)){
    if(!fielded(world,squad)){squad.moving=false;continue;}
    let moved=0;
    if(squad.path.length&&!straggling(world,squad)){
      let budget=squadSpeed(world,squad)*DT;
      while(budget>1e-9&&squad.path.length){
        const next=squad.path[0],dx=next.x-squad.x,dz=next.z-squad.z,d=span(dx,dz);
        if(d<=budget+MOVEMENT.arrive){squad.x=next.x;squad.z=next.z;budget-=d;moved+=d;squad.path.shift();turn(squad,dx,dz);}
        else{squad.x+=dx/d*budget;squad.z+=dz/d*budget;moved+=budget;turn(squad,dx,dz);budget=0;}
      }
      if(!squad.path.length)squad.gait=null;
    }
    // A run-up for a charge: metres covered in a straight line on firm ground.
    const firm=!['marsh','ford'].includes(terrainAtPoint(world.map,squad.x,squad.z));
    squad.runUp=moved>0&&firm?squad.runUp+moved:moved>0?0:Math.max(0,squad.runUp-MOVEMENT.walk*DT*4);
    squad.moving=moved>0;
    if(moved>0){squad.stillSince=world.tick;if(squad.braced){squad.braced=false;emit(world,{kind:'squad-unbraced',squadId:squad.id});}}
    // A squad facing an enemy turns to meet him.
    if(!squad.moving&&squad.facing){const t=squad.facing;turn(squad,t.x-squad.x,t.z-squad.z);}
    // The men keep their places: each walks (or runs, to catch up) to his slot.
    const men=membersOf(world,squad),marching=squad.path.length>0&&span(squad.goal.x-squad.x,squad.goal.z-squad.z)>12&&!squad.contact;
    const slots=formationSlots(shapeOf(squad,{marching}),men.length);
    men.sort((a,b)=>a.slot-b.slot);
    men.forEach((m,i)=>{
      m.slotIndex=i;
      if(m.action||m.order||m.staggerUntil>world.tick)return;
      const target=slotPoint(squad,slots[i]),d=span(target.x-m.x,target.z-m.z);
      if(d<.05){m.moving=false;m.gait=null;m.slotPath=null;turnToward(m,squad.fx,squad.fz);return;}
      // Ground between a man and his place (a wall, a rock): he goes round by a route, found when the
      // straight way is blocked and dropped once his place has moved on from its end.
      let aim=target;
      if(m.slotPath){
        const end=m.slotPath[m.slotPath.length-1];
        if(span(end.x-target.x,end.z-target.z)>2.5)m.slotPath=null;
        else{while(m.slotPath.length>1&&span(m.slotPath[0].x-m.x,m.slotPath[0].z-m.z)<.3)m.slotPath.shift();aim=m.slotPath.length>1?m.slotPath[0]:target;}
      }
      const dx=aim.x-m.x,dz=aim.z-m.z,da=span(dx,dz)||1;
      const run=d>2.5,pace=(run?derivedValues(m).run:Math.max(MOVEMENT.walk,squadSpeed(world,squad)))*speedFactor(grid,m.x,m.z)*DT,step=Math.min(da,pace);
      const nx=m.x+dx/da*step,nz=m.z+dz/da*step;
      if(walkable(grid,nx,nz)){m.x=nx;m.z=nz;m.moving=step>1e-6;m.gait=run?'run':'walk';m.walked+=step;turnToward(m,dx,dz);}
      else{m.moving=false;m.gait=null;if(!m.slotPath){const route=findRoute(grid,m,target);m.slotPath=route.points.length?route.points:null;}}
    });
  }
}
// Most of the squad's men far from their places: the standard waits for them.
function straggling(world,squad){
  const men=membersOf(world,squad);if(men.length<2)return false;
  const marching=squad.path.length>0&&span(squad.goal.x-squad.x,squad.goal.z-squad.z)>12&&!squad.contact;
  const slots=formationSlots(shapeOf(squad,{marching}),men.length);let far=0;
  [...men].sort((a,b)=>a.slot-b.slot).forEach((m,i)=>{const p=slotPoint(squad,slots[i]);if(span(p.x-m.x,p.z-m.z)>STRAGGLE)far++;});
  return far*2>men.length;
}
function turnToward(actor,dx,dz){const d=span(dx,dz);if(d<1e-6)return;actor.fx=dx/d;actor.fz=dz/d;}

// --- The exchange between squads (once a second) ---------------------------------
// The 0.38 combatBreakdown (version 2) in metres: a squad's blows or missiles
// against another, with every modifier named, for the exchange and the forecast.
// An ambush (squad-sight.js) leaves out the target's Brace and cohesive shield wall.
export function squadModifiers(world,attacker,target,{ranged=false,ambush=false}={}){
  const grid=navGrid(world.map),a=squadCentre(world,attacker),t=squadCentre(world,target),mods=[],add=(label,value)=>{if(value)mods.push({label,value});};
  const dx=a.x-t.x,dz=a.z-t.z,d=span(dx,dz)||1,front=(dx*target.fx+dz*target.fz)/d>=.5;
  const ground=terrainAtPoint(world.map,t.x,t.z),source=terrainAtPoint(world.map,a.x,a.z),rough=g=>['marsh','ford'].includes(g);
  add('Frontal shield',front?-EXCHANGE.frontalShield:0);add('Brace',target.braced?-EXCHANGE.brace:0);
  const high=groundHeight(grid,t.x,t.z)>groundHeight(grid,a.x,a.z);
  add('Terrain protection',wallBetween(world.map,a,t)?-EXCHANGE.wall:high?-EXCHANGE.high:ranged&&crossesCover(grid,a,t)?-EXCHANGE.cover:0);
  add('Height advantage',ranged&&groundHeight(grid,a.x,a.z)>groundHeight(grid,t.x,t.z)?EXCHANGE.heightRanged:0);
  const neighbour=formation=>squadsOf(world).some(o=>o!==target&&fielded(world,o)&&alliedSides(o.side,target.side)&&o.formation===formation&&
    span(o.x-target.x,o.z-target.z)<=EXCHANGE.neighbour);
  add('Cohesive shield wall',target.formation==='shield-wall'&&front&&neighbour('shield-wall')?-EXCHANGE.cohesiveWall:0);
  add('Line ranged screen',target.formation==='line'&&ranged&&neighbour('line')?-EXCHANGE.lineScreen:0);
  add('Veteran protector',target.guard&&target.guard.until>world.tick?-target.guard.reduction:0);
  add('Wedge on firm ground',!ranged&&attacker.formation==='wedge'&&!rough(source)&&!wallBetween(world.map,a,t)?EXCHANGE.wedgeAttack:0);
  add('Wedge exposure',target.formation==='wedge'?EXCHANGE.wedgeExposure:0);
  // Staked approaches (the Chapter IX opportunity) take the enemy's charge away.
  add('Mounted charge',!ranged&&!(attacker.side==='enemy'&&world.field?.cavalryDenied)&&chargeReady(world,attacker,target,{rough:rough(source)||rough(ground)})?EXCHANGE.charge:0);
  if(world.chapter!==1){
    add('Disrupted cohesion',attacker.cohesion<COHESION.low?-EXCHANGE.lowCohesion:0);
    add('Suppressed',Math.floor(attacker.suppression)>=SUPPRESSION.penalty?-EXCHANGE.suppressed:0);
    add('Poor visibility',ranged&&d>EXCHANGE.poorSight&&['rain','mist','dust'].includes(world.weather)?-EXCHANGE.poorVisibility:0);
  }
  add('Timber cover',world.objects?.some(o=>o.kind==='barricade'&&!o.done&&membersOf(world,target).some(m=>span(m.x-o.x,m.z-o.z)<=EXCHANGE.barricadeRange))?-EXCHANGE.barricade:0);
  add('Shaken morale',shaken(attacker)?-EXCHANGE.shaken:0);
  // The unit's own 0.38 damage (drill, a flank march, night or a specialism change it), else its side's.
  const base=ranged?EXCHANGE.ranged:attacker.damage??EXCHANGE.melee[attacker.side]??EXCHANGE.melee.enemy;
  const kept=ambush?mods.filter(m=>!EXCHANGE.ambush.ignores.includes(m.label)):mods;
  return {base,modifiers:kept,damage:Math.max(1,base+kept.reduce((n,m)=>n+m.value,0)),aspect:front?'front':'flank',ranged,ambush};
}
// A wall between two points, within 3 m of the defender: he fights from behind it.
function wallBetween(map,a,t){
  const dx=a.x-t.x,dz=a.z-t.z,d=span(dx,dz);if(d<1e-6)return false;
  const near=Math.min(d,3),steps=Math.max(1,Math.ceil(near/.25));
  for(let s=1;s<=steps;s++){const k=near*s/steps/d;if(terrainAtPoint(map,t.x+dx*k,t.z+dz*k)==='wall')return true;}
  return false;
}
// Horse that has run at least 20 m on firm ground, at a front that is not braced (guide "Terrain and position").
export function chargeReady(world,attacker,target,{rough=false}={}){
  return ['cavalry','heavy'].includes(attacker.role)&&attacker.runUp>=EXCHANGE.chargeRun&&!rough&&!target.braced;
}
// One exchange's spread: a factor of EXCHANGE.spread by its weight, one draw of the combat stream.
export const exchangeSpread=world=>pickWeighted(world.rng,'combat',EXCHANGE.spread);
// Whether a squad knows of another: it is in sight, or its men keep hidden and it has seen them all the same.
const known=(world,watcher,squad)=>!membersOf(world,squad).every(m=>m.hidden)||noticeOf(watcher,squad.id)>=100;
// The nearest two men of two squads, and how far apart they stand.
export function closest(world,a,b){
  let best=Infinity,pa=null,pb=null;const ma=membersOf(world,a),mb=membersOf(world,b);
  for(const x of ma)for(const y of mb){const d=span(x.x-y.x,x.z-y.z);if(d<best){best=d;pa=x;pb=y;}}
  return {distance:best,a:pa,b:pb};
}
export const missileRangeOf=squad=>EXCHANGE.missileRange[squad.role]??0;
export function inContact(world,a,b){return closest(world,a,b).distance<=EXCHANGE.contact;}

// A single man as the exchange's target: his place and facing, his brace, a
// protector's guard and the cover at his feet count as they would for a squad.
function asTarget(world,actor){
  return {id:actor.id,side:actor.side,role:actor.role,x:actor.x,z:actor.z,fx:actor.fx??1,fz:actor.fz??0,formation:null,braced:actor.braceUntil>world.tick,
    guard:actor.guardedBy&&actor.guardedBy.until>world.tick?{until:actor.guardedBy.until,reduction:actor.guardedBy.reduction}:null,members:[actor.id]};
}
// The man of a squad nearest a point, and how far he stands from it.
function nearestMan(world,squad,p){
  let best=null,d=Infinity;for(const m of membersOf(world,squad)){const e=span(m.x-p.x,m.z-p.z);if(e<d){d=e;best=m;}}return {man:best,distance:d};
}
// Once a second: every pair of hostile squads in contact exchange blows, and
// archers (out of melee) loose at a squad in range with a clear line. A squad
// that meets no squad fights a single man within reach, or looses at one (the
// one its plan names first). Damage is applied all at once, so neither side
// strikes first; a single man's wounds go to `wound` (damage.js).
export function exchangeSquads(world,{wound=null}={}){
  if(world.tick%EXCHANGE.everyTicks!==0)return;
  // Contact and facing are judged once a second, with the exchange, and hold until the next.
  const squads=squadsOf(world).filter(s=>fielded(world,s));for(const s of squadsOf(world)){s.contact=null;s.facing=null;}
  if(!squads.length)return;
  const grid=navGrid(world.map),hits=[],singles=world.actors.filter(o=>standing(o)&&!o.squadId&&!o.hidden),shotAtSquad=new Set();
  for(let i=0;i<squads.length;i++)for(let j=i+1;j<squads.length;j++){
    const a=squads[i],b=squads[j];if(!hostile(a,b))continue;
    const near=closest(world,a,b);if(near.distance>EXCHANGE.contact)continue;
    a.contact=b.id;b.contact=a.id;a.facing=squadCentre(world,b);b.facing=squadCentre(world,a);
    // A squad that has not seen the other come, or that one springing on it from lying in wait, is ambushed (squad-sight.js).
    const sprung=(x,y)=>x.order?.from==='lie_in_wait'&&x.order.unseen&&x.order.targetId===y.id;
    const aUnseen=noticeOf(b,a.id)<100||sprung(a,b),bUnseen=noticeOf(a,b.id)<100||sprung(b,a);
    if(!a.broken||a.role!=='archer')hits.push({from:a,to:b,setup:squadModifiers(world,a,b,{ambush:aUnseen}),at:near});
    if(!b.broken||b.role!=='archer')hits.push({from:b,to:a,setup:squadModifiers(world,b,a,{ambush:bUnseen}),at:{...near,a:near.b,b:near.a}});
  }
  for(const a of squads){
    if(a.contact||a.broken||!missileRangeOf(a))continue;
    const range=missileRangeOf(a),centre=squadCentre(world,a);
    // A single man the plan names comes first (an escort, the soldier), then the nearest squad in range.
    const named=singles.find(o=>o.id===a.plan?.targetId&&hostile(a,o)&&span(o.x-centre.x,o.z-centre.z)<=range&&!sightBlocked(world,centre,o));
    if(named)continue;
    const target=squads.filter(b=>hostile(a,b)&&known(world,a,b)&&!sightBlocked(world,centre,squadCentre(world,b))&&span(b.x-centre.x,b.z-centre.z)<=range)
      .sort((x,y)=>(x.id===a.plan?.targetId?-1:0)-(y.id===a.plan?.targetId?-1:0)||span(x.x-centre.x,x.z-centre.z)-span(y.x-centre.x,y.z-centre.z))[0];
    if(target){a.facing=squadCentre(world,target);shotAtSquad.add(a);
      // The enemy's archers of a faction that volleys loose one aimed volley a round (ENEMY_TECHNIQUES.volley).
      const round=Math.floor(world.tick/R)+1,volley=a.side==='enemy'&&ENEMY_FACTIONS[a.faction]?.volley&&a.volleyRound!==round;if(volley)a.volleyRound=round;
      hits.push({from:a,to:target,setup:squadModifiers(world,a,target,{ranged:true}),at:closest(world,a,target),volley});}
  }
  // A squad that meets no squad, against a single man: one within reach of its
  // men (the plan's first), else (archers) one in range with a clear line.
  const struck=[];
  for(const a of squads){
    if(a.contact||shotAtSquad.has(a)||a.broken&&a.role==='archer')continue;
    const foes=singles.filter(o=>hostile(a,o));if(!foes.length)continue;
    const near=foes.map(o=>({o,...nearestMan(world,a,o)})).filter(x=>x.man&&x.distance<=EXCHANGE.contact)
      .sort((x,y)=>(x.o.id===a.plan?.targetId?-1:0)-(y.o.id===a.plan?.targetId?-1:0)||x.distance-y.distance)[0];
    let pick=near?{o:near.o,man:near.man,ranged:false}:null;
    if(!pick&&missileRangeOf(a)&&!a.broken){
      const centre=squadCentre(world,a),range=missileRangeOf(a);
      const far=foes.filter(o=>span(o.x-centre.x,o.z-centre.z)<=range&&!sightBlocked(world,centre,o))
        .sort((x,y)=>(x.id===a.plan?.targetId?-1:0)-(y.id===a.plan?.targetId?-1:0)||span(x.x-centre.x,x.z-centre.z)-span(y.x-centre.x,y.z-centre.z))[0];
      if(far)pick={o:far,man:nearestMan(world,a,far).man,ranged:true};
    }
    if(!pick)continue;
    a.facing={x:pick.o.x,z:pick.o.z};struck.push({from:a,to:pick.o,man:pick.man,ranged:pick.ranged,setup:squadModifiers(world,a,asTarget(world,pick.o),{ranged:pick.ranged})});
  }
  // A squad that strikes from hiding is seen at once, as a single man is (damage.js).
  for(const from of new Set([...hits,...struck].map(h=>h.from))){const hid=membersOf(world,from).filter(m=>m.hidden);
    for(const m of hid)m.hidden=false;if(hid.length)emit(world,{kind:'squad-revealed',squadId:from.id});}
  for(const hit of hits){
    // An ambush is a whole 0.38 hit at once, its morale loss doubled; any other exchange a tenth, by the spread.
    const {from,to,setup}=hit,before=menOf(world,to),ambush=setup.ambush&&!setup.ranged,A=EXCHANGE.ambush;
    const V=ENEMY_TECHNIQUES.volley,damage=ambush?setup.damage*A.scale:hit.volley?setup.damage*V.scale:setup.damage*EXCHANGE.scale*exchangeSpread(world);
    if(ambush){emit(world,{kind:'squad-ambush',squadId:from.id,targetSquadId:to.id});if(from.order?.unseen)from.order.unseen=false;}
    if(hit.volley){emit(world,{kind:'squad-volley',squadId:from.id,targetSquadId:to.id});to.suppression=Math.min(SUPPRESSION.max,to.suppression+V.suppression);}
    to.strength=Math.max(0,to.strength-damage);hitSquad(world,to,{flank:setup.aspect!=='front',ranged:setup.ranged,scale:ambush?A.scale:hit.volley?V.scale:EXCHANGE.scale,morale:ambush?A.morale:1});
    knowAttacker(to,from.id);
    emit(world,{kind:'exchange',squadId:from.id,targetSquadId:to.id,damage,ranged:setup.ranged,x:hit.at.b?.x??to.x,z:hit.at.b?.z??to.z,fromX:hit.at.a?.x??from.x,fromZ:hit.at.a?.z??from.z,
      ...(ambush?{ambush:true}:{})});
    // Strength lost becomes men lost: those nearest the front fall.
    const keep=Math.max(0,Math.ceil(to.strength/to.perMan-1e-9)),dying=Math.max(0,before-keep);
    if(dying){
      const front=hit.at.a??squadCentre(world,from),men=membersOf(world,to).sort((x,y)=>span(x.x-front.x,x.z-front.z)-span(y.x-front.x,y.z-front.z)||x.slot-y.slot);
      for(const m of men.slice(0,dying)){
        m.alive=false;m.diedAt=world.tick;m.killedBy=from.id;m.order=null;m.lock=null;m.path=[];m.action=null;
        emit(world,{kind:'fall',attackerId:hit.at.a?.id??null,defenderId:m.id,squadId:to.id,exchange:true,missile:setup.ranged?'arrow':null});
      }
    }
    afterLoss(world,to,null);
  }
  // The single men's wounds mount up in tenths of a 0.38 hit; whole points of Health come off.
  for(const hit of struck){
    const {from,to,man,setup,ranged}=hit,amount=setup.damage*EXCHANGE.scale*exchangeSpread(world);
    emit(world,{kind:'exchange',squadId:from.id,targetId:to.id,damage:amount,ranged,x:to.x,z:to.z,fromX:man.x,fromZ:man.z});
    to.wear=(to.wear??0)+amount;const whole=Math.floor(to.wear+1e-9);if(!whole)continue;
    to.wear=Math.max(0,to.wear-whole);wound?.(world,man,to,whole,{missile:ranged?(from.role==='raider'?'javelin':'arrow'):null,arc:setup.aspect,squadId:from.id});
  }
  // A braced front that survives a frontal mounted charge strikes back once a round.
  for(const hit of hits){
    const {from,to,setup}=hit;if(setup.ranged||!['cavalry','heavy'].includes(from.role)||!fielded(world,to)||!to.braced||setup.aspect!=='front')continue;
    const round=Math.floor(world.tick/R)+1;if(to.counterRound===round||!fielded(world,from))continue;to.counterRound=round;
    from.strength=Math.max(0,from.strength-EXCHANGE.counter);hitSquad(world,from,{scale:1});
    emit(world,{kind:'counter',squadId:to.id,targetSquadId:from.id,damage:EXCHANGE.counter});
    const keep=Math.max(0,Math.ceil(from.strength/from.perMan-1e-9)),men=membersOf(world,from);
    for(const m of men.slice(keep)){m.alive=false;m.diedAt=world.tick;m.killedBy=to.id;emit(world,{kind:'fall',defenderId:m.id,squadId:from.id,exchange:true});}
    afterLoss(world,from,null);
  }
  // A charge spends its run-up.
  for(const hit of [...hits,...struck])if(!hit.setup.ranged&&['cavalry','heavy'].includes(hit.from.role))hit.from.runUp=0;
}

// --- The round boundary (§3.1 system 8, after Command's refill) ---------------------
// Cohesion and suppression recover: a squad that held still all round restores
// 12 and braces if it was ordered to hold; one with a friendly squad within 10 m
// restores 6; either lifts a point of suppression. A broken squad out of contact
// regroups 15 morale, and stands again once above the broken line.
export function squadsRound(world){
  for(const squad of squadsOf(world)){
    if(!fielded(world,squad))continue;
    const held=world.tick+1-squad.stillSince>=HOLD_BRACE_TICKS;
    if(held&&squad.order?.kind==='hold'&&!squad.braced){squad.braced=true;emit(world,{kind:'squad-braced',squadId:squad.id});}
    const supported=squadsOf(world).some(o=>o!==squad&&fielded(world,o)&&alliedSides(o.side,squad.side)&&span(o.x-squad.x,o.z-squad.z)<=COHESION.supportRange);
    if(held||squad.braced)squad.cohesion=clamp(squad.cohesion+COHESION.braced);else if(supported)squad.cohesion=clamp(squad.cohesion+COHESION.supported);
    if(held||squad.braced||supported)squad.suppression=Math.max(0,squad.suppression-1);
    if(squad.broken&&!squad.contact){
      squad.morale=clamp(squad.morale+MORALE.regroup);
      if(squad.morale>MORALE.broken){squad.broken=false;emit(world,{kind:'squad-rallied',squadId:squad.id});}
    }
    // An enemy band pulled back behind a steady one is steadied (squad-ai.js, ENEMY_TECHNIQUES.pullBack).
    else if(squad.pulledBack&&!squad.contact)squad.morale=clamp(squad.morale+MORALE.restore);
  }
}

// --- The men ------------------------------------------------------------------------
// A squad fights as one body (the exchange above): its men hold their places,
// weapons drawn while it is engaged, and give no orders of their own.
export function memberDecisions(world,squad){
  if(!fielded(world,squad))return;const engaged=!!(squad.contact||squad.facing);
  for(const m of membersOf(world,squad)){
    if(m.order||m.lock||m.action?.kind==='swing'){m.order=null;m.lock=null;m.path=[];m.gait=null;}
    if(engaged&&!m.drawn)m.drawn=true;
  }
}
export const squadOfMember=squadOf;
export {standing as squadStanding};
export const roleName=squad=>ROLE_NAMES[squad.role]??'squad';

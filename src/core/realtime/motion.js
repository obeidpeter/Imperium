import {ABILITIES,MOVEMENT,TIME} from '../../data/realtime-rules.js';
import {clampToMap,findRoute,navGrid,span,speedFactor,walkable} from './navigation.js';
import {arcOf,braced,derivedValues} from './combat.js';
import {actorById,distanceBetween,hostile,staggered} from './abilities.js';
// Walking only: his own choice (W), or the soldier under a march penalty (the engineer
// train, or the opening of an Engineering approach or a defensive advance).
export const walksOnly=(world,actor)=>actor.walkMode||actor.id===world.heroId&&world.tick<(world.walkUntil??0);

// System 3 (§3.1): path following, separation and terrain speed, with the
// shared geometry of facing, reach and engagement. Pure and deterministic.

const DT=1/TIME.ticksPerSecond;

// An enemy within 2 m who has this actor inside his front arc stops him running.
export function engaged(world,actor){
  return world.actors.some(o=>o.alive&&!o.down&&!o.hidden&&hostile(o,actor)&&distanceBetween(o,actor)<=MOVEMENT.engagedRange&&arcOf(o,actor)==='front');
}
// A blow reaches from the attacker's centre to the defender's body.
export const reachOf=attacker=>derivedValues(attacker).reach+MOVEMENT.radius;
export const inReach=(a,t)=>distanceBetween(a,t)<=reachOf(a);
// Turn toward a direction by at most one step this tick.
export function turnToward(actor,dx,dz){
  const d=span(dx,dz);if(d<1e-6)return;const tx=dx/d,tz=dz/d,dot=actor.fx*tx+actor.fz*tz,[c,s]=MOVEMENT.turnStep;
  if(dot>=c){actor.fx=tx;actor.fz=tz;return;}
  const sign=actor.fx*tz-actor.fz*tx>=0?1:-1,x=actor.fx*c-actor.fz*s*sign,z=actor.fx*s*sign+actor.fz*c,n=span(x,z);actor.fx=x/n;actor.fz=z/n;
}
export const facingWithin=(actor,target,cos=.5)=>{const d=distanceBetween(actor,target)||1;return ((target.x-actor.x)*actor.fx+(target.z-actor.z)*actor.fz)/d>=cos;};
// Down, carried or lying: a man who cannot act this tick.
export const helpless=actor=>!actor.alive||actor.down||!!actor.carriedBy;

export function setRoute(world,actor,point,{run=null}={}){
  const grid=navGrid(world.map),route=findRoute(grid,actor,point);actor.path=route.points;
  actor.gait=route.points.length?(run??(route.length>MOVEMENT.runThreshold&&!walksOnly(world,actor)))?'run':'walk':null;
  actor.goal={x:route.stopPoint.x,z:route.stopPoint.z};actor.repathAt=world.tick+MOVEMENT.repathTicks;return route;
}

// Where a chasing actor heads: straight for the target, or, for an enemy
// still approaching, the side of the target its AI chose.
function chaseGoal(world,actor,target){
  const reach=reachOf(actor),d=distanceBetween(actor,target);
  if(actor.order?.slot&&actor.ai&&d>reach*2){
    const standoff=reach-.15,goal={x:target.x+actor.ai.dx*standoff,z:target.z+actor.ai.dz*standoff};
    if(walkable(navGrid(world.map),goal.x,goal.z))return goal;
  }
  return {x:target.x,z:target.z};
}
// The distance at which an order's target is close enough to act on.
export function orderRange(world,actor,order,target){
  if(order.kind==='advance')return order.stopAt;
  if(order.kind==='attack'){const ranged=derivedValues(actor).weapon.ranged;return ranged&&(actor.ammo?.[ranged.ammo]??1)>0?ranged.range*.92:reachOf(actor);}
  if(order.kind==='ability'||order.kind==='interact'){const ability=ABILITIES[order.abilityId];return (ability?.range_m??1.6)+MOVEMENT.radius;}
  if(order.kind==='approach')return reachOf(actor);
  if(order.kind==='guard')return order.distance??1.6;
  if(order.kind==='talk'||order.kind==='loot')return MOVEMENT.talkRange;
  return 0;
}
// Abilities used where the soldier stands walk him to their target first.
export const approaches=order=>order?.kind==='interact'||order?.kind==='ability'&&ABILITIES[order.abilityId]?.approach;

export function moveActors(world){
  const grid=navGrid(world.map);
  for(const actor of world.actors){
    // A man of a squad keeps his place in its formation (squads.js) unless he is fighting.
    if(actor.squadId&&!actor.order)continue;
    actor.moving=false;if(helpless(actor)||staggered(world,actor)||braced(world,actor))continue;
    const order=actor.order,target=order?.targetId?actorById(world,order.targetId)??objectById(world,order.targetId):null;
    if(order&&(['attack','approach','advance','guard','talk','loot'].includes(order.kind)||approaches(order))){
      const gone=!target||target.alive===false&&!target.down&&!order.allowFallen;
      if(gone){actor.path=[];actor.gait=null;continue;}
      const close=distanceBetween(actor,target)<=orderRange(world,actor,order,target);
      if(close||actor.action){actor.path=[];actor.gait=null;continue;}
      if(world.tick>=actor.repathAt||!actor.path.length){
        setRoute(world,actor,order.kind==='attack'?chaseGoal(world,actor,target):{x:target.x,z:target.z},{run:walksOnly(world,actor)||actor.carrying?false:null});
      }
    }else if(order?.kind==='ability'||actor.action&&actor.action.kind!=='work'){actor.path=[];actor.gait=null;continue;}
    if(actor.action?.kind==='work'){actor.path=[];actor.gait=null;continue;}
    if(!actor.path.length){if(order?.kind==='move')actor.order=null;actor.gait=null;continue;}
    const derived=derivedValues(actor),run=actor.gait==='run'&&!engaged(world,actor)&&!walksOnly(world,actor)&&!actor.carrying;
    let budget=(run?derived.run:actor.pace??MOVEMENT.walk)*speedFactor(grid,actor.x,actor.z)*DT,moved=0;
    while(budget>1e-9&&actor.path.length){
      const next=actor.path[0],dx=next.x-actor.x,dz=next.z-actor.z,d=span(dx,dz);
      if(d<=budget+MOVEMENT.arrive){actor.x=next.x;actor.z=next.z;budget-=d;moved+=d;actor.path.shift();if(d>1e-6)turnToward(actor,dx,dz);}
      else{actor.x+=dx/d*budget;actor.z+=dz/d*budget;moved+=budget;turnToward(actor,dx,dz);budget=0;}
    }
    actor.gait=run?'run':'walk';actor.moving=moved>0;actor.walked+=moved;
    if(!actor.path.length&&order?.kind==='move'){if(order.setDown)setDown(world,actor);actor.order=null;actor.gait=null;}
  }
  // A carried man goes where his bearer goes.
  for(const actor of world.actors)if(actor.carriedBy){const b=actorById(world,actor.carriedBy);if(b){actor.x=b.x-b.fx*.3;actor.z=b.z-b.fz*.3;actor.fx=b.fx;actor.fz=b.fz;}}
  // Separation: bodies never overlap; each of a close pair steps back half the
  // overlap, unless that would put him on blocked ground. The fallen and the
  // carried take no room.
  const min=MOVEMENT.radius*2,list=world.actors.filter(a=>a.alive&&!a.down&&!a.carriedBy);
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
    const a=list[i],b=list[j],dx=b.x-a.x,dz=b.z-a.z,d=span(dx,dz);if(d>=min)continue;
    const nx=d>1e-6?dx/d:1,nz=d>1e-6?dz/d:0,push=(min-d)/2;
    for(const [who,sign]of [[a,-1],[b,1]]){
      const p=clampToMap(grid,{x:who.x+nx*push*sign,z:who.z+nz*push*sign});if(walkable(grid,p.x,p.z)){who.x=p.x;who.z=p.z;}
    }
  }
}
export const objectById=(world,id)=>world.objects?.find(o=>o.id===id)??null;
// Set a carried comrade down at the bearer's feet.
export function setDown(world,actor){
  const carried=actorById(world,actor.carrying);actor.carrying=null;if(!carried)return;
  carried.carriedBy=null;carried.x=actor.x+actor.fz*.6;carried.z=actor.z-actor.fx*.6;
  const grid=navGrid(world.map);if(!walkable(grid,carried.x,carried.z)){carried.x=actor.x;carried.z=actor.z;}
  world.events.push({tick:world.tick,kind:'set-down',actorId:actor.id,targetId:carried.id});
}

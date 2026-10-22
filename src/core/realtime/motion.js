import {ABILITIES,MOVEMENT,TIME} from '../../data/realtime-rules.js';
import {clampToMap,clearLine,findRoute,navGrid,span,speedFactor,walkable} from './navigation.js';
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
// A waypoint another body stands on is reached as near as he lets you come: the
// walker goes on (to the next, if the way there is clear), so two men never wait on
// each other's ground and a squad guarding a column never blocks its road.
const taken=(world,actor,p)=>world.actors.some(o=>o!==actor&&o.alive&&!o.down&&!o.carriedBy&&span(o.x-p.x,o.z-p.z)<MOVEMENT.radius*2);
function passTaken(world,grid,actor){
  const next=actor.path[0];if(span(next.x-actor.x,next.z-actor.z)>=MOVEMENT.radius*2||!taken(world,actor,next))return false;
  if(actor.path.length>1&&!clearLine(grid,actor,actor.path[1],{fromBlocked:!walkable(grid,actor.x,actor.z)}))return false;
  actor.path.shift();return true;
}

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
      if(passTaken(world,grid,actor))continue;
      const next=actor.path[0],dx=next.x-actor.x,dz=next.z-actor.z,d=span(dx,dz);
      if(d<=budget+MOVEMENT.arrive){actor.x=next.x;actor.z=next.z;budget-=d;moved+=d;actor.path.shift();if(d>1e-6)turnToward(actor,dx,dz);}
      else{actor.x+=dx/d*budget;actor.z+=dz/d*budget;moved+=budget;turnToward(actor,dx,dz);budget=0;}
    }
    actor.gait=run?'run':'walk';actor.moving=moved>0;actor.walked+=moved;
    if(!actor.path.length&&order?.kind==='move'){if(order.setDown)setDown(world,actor);actor.order=null;actor.gait=null;}
  }
  separateBodies(world,grid);
  // Follow the bearer's final position, including any crowd correction this tick.
  for(const actor of world.actors)if(actor.carriedBy){const b=actorById(world,actor.carriedBy);if(b){actor.x=b.x-b.fx*.3;actor.z=b.z-b.fz*.3;actor.fx=b.fx;actor.fz=b.fz;}}
}
// Resolve crowded bodies after every formation has moved. A later pair can
// push an earlier one together again, so use a bounded relaxation rather than
// a single sweep. Alternating the sweep reduces the bias of actor list order;
// the fixed budget and ordering keep save/replay results deterministic. The
// passes work on copies of the centres in typed arrays, which are far cheaper to
// read than the actors themselves: the pairs, their order and every operation
// are those of the plain sweep over the actors, so each result is identical.
export function separateBodies(world,grid=navGrid(world.map)){
  const min=MOVEMENT.radius*2,list=world.actors.filter(a=>a.alive&&!a.down&&!a.carriedBy),n=list.length;
  const X=new Float64Array(n),Z=new Float64Array(n),pushed=new Uint8Array(n);for(let k=0;k<n;k++){X[k]=list[k].x;Z[k]=list[k].z;}
  const push=(k,nx,nz,amount)=>{
    const p=clampToMap(grid,{x:X[k]+nx*amount,z:Z[k]+nz*amount});
    if(!walkable(grid,p.x,p.z))return 0;
    const moved=Math.max(0,(p.x-X[k])*nx+(p.z-Z[k])*nz);X[k]=p.x;Z[k]=p.z;pushed[k]=1;return moved;
  };
  for(let pass=0;pass<4;pass++){
    let crowded=false;
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
      const a=pass%2?n-1-i:i,b=pass%2?n-1-j:j;
      // Bodies a body's width apart along x cannot overlap: the full test would skip them too.
      const dx=X[b]-X[a];if(dx>=min||dx<=-min)continue;
      const dz=Z[b]-Z[a],d2=dx*dx+dz*dz;if(d2>=min*min)continue;
      const d=Math.sqrt(d2),overlap=min-d;if(overlap<1e-4)continue;crowded=true;
      const nx=d>1e-6?dx/d:1,nz=d>1e-6?dz/d:0,half=overlap/2;
      const am=push(a,-nx,-nz,half),bm=push(b,nx,nz,half),left=overlap-am-bm;
      // At a wall or map edge the free body takes the blocked body's share.
      // Never move either centre onto blocked ground to satisfy separation.
      if(left>1e-4){if(am<half-1e-4)push(b,nx,nz,left);else if(bm<half-1e-4)push(a,-nx,-nz,left);}
    }
    if(!crowded)break;
  }
  for(let k=0;k<n;k++)if(pushed[k]){list[k].x=X[k];list[k].z=Z[k];}
}
export const objectById=(world,id)=>world.objects?.find(o=>o.id===id)??null;
// Set a carried comrade down at the bearer's feet.
export function setDown(world,actor){
  const carried=actorById(world,actor.carrying);actor.carrying=null;if(!carried)return;
  carried.carriedBy=null;carried.x=actor.x+actor.fz*.6;carried.z=actor.z-actor.fx*.6;
  const grid=navGrid(world.map);if(!walkable(grid,carried.x,carried.z)){carried.x=actor.x;carried.z=actor.z;}
  world.events.push({tick:world.tick,kind:'set-down',actorId:actor.id,targetId:carried.id});
}

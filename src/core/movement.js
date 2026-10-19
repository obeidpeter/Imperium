import {alive,blocked,movementPinned} from './shared.js';

// The rules record only where a move ends. These read-only helpers give the
// route it walks, so the preview, the 2D line and the 3D/2D animation all
// trace the same tiles. No mutation, clock or gameplay randomness.
const STEPS=[[1,0],[0,1],[-1,0],[0,-1]];
const key=p=>`${p.x},${p.y}`;
const manhattan=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
function groundAt(e,x,y){const raw=e.terrain?.[y]?.[x];return typeof raw==='string'?raw:raw?.type;}
// Entering marsh costs two, except for a unit in line formation (as reachable() counts it).
const entryCost=(e,unit,x,y)=>groundAt(e,x,y)==='marsh'&&unit.formation!=='line'?2:1;
const inside=(e,p)=>p.x>=0&&p.y>=0&&p.x<(e.width??8)&&p.y<(e.height??8);

// The cheapest orthogonal route from the unit to `goal` under the movement
// rules: never through rock or river or another living unit's tile, marsh by
// its cost, and (with pins) no further after stepping beside a hostile melee
// unit. Ties go to the tile nearer the goal, then to east, south, west, north.
// `ignore` lists units to leave out (units that moved in the same command);
// `visibleOnly` leaves hidden units out, for ground the player cannot see.
// Returns {path,cost} (path includes start and goal) or null.
export function movementRoute(e,unit,goal,{ignore=null,pins=true,visibleOnly=false}={}){
  if(!e||!unit||!goal||!Number.isInteger(goal.x)||!Number.isInteger(goal.y)||!inside(e,goal))return null;
  const start={x:unit.x,y:unit.y},end={x:goal.x,y:goal.y};
  const occupied=new Set((e.units??[]).filter(v=>v.id!==unit.id&&alive(v)&&!ignore?.has?.(v.id)&&!(visibleOnly&&v.hidden)).map(key));
  const costs=new Map([[key(start),0]]),parents=new Map(),queue=[{...start,cost:0}];
  while(queue.length){
    queue.sort((a,b)=>a.cost-b.cost||manhattan(a,end)-manhattan(b,end));const p=queue.shift();
    if(p.x===end.x&&p.y===end.y){const path=[end];let cursor=key(end);while(parents.has(cursor)){const back=parents.get(cursor);path.unshift(back);cursor=key(back);}return {path,cost:p.cost};}
    if(pins&&p.cost>0&&movementPinned(e,unit,p))continue;
    for(const[dx,dy]of STEPS){
      const cell={x:p.x+dx,y:p.y+dy},id=key(cell);
      if(!inside(e,cell)||blocked(groundAt(e,cell.x,cell.y))||occupied.has(id))continue;
      const cost=p.cost+entryCost(e,unit,cell.x,cell.y);
      if(costs.has(id)&&costs.get(id)<=cost)continue;costs.set(id,cost);parents.set(id,{x:p.x,y:p.y});queue.push({...cell,cost});
    }
  }
  return null;
}

// How much movement each tile still needs to reach `goal`, over ground the
// player can see: rock, river and visible units block; hidden units do not,
// so the measure never reveals them. Infinity where the goal cannot be reached.
export function distanceToGoal(e,unit,goal){
  const costs=new Map([[key(goal),0]]),queue=[{x:goal.x,y:goal.y,cost:0}];
  const occupied=new Set((e.units??[]).filter(v=>v.id!==unit.id&&alive(v)&&!v.hidden).map(key));
  while(queue.length){
    queue.sort((a,b)=>a.cost-b.cost);const p=queue.shift();if(costs.get(key(p))!==p.cost)continue;
    for(const[dx,dy]of STEPS){
      const cell={x:p.x+dx,y:p.y+dy},id=key(cell);
      if(!inside(e,cell)||blocked(groundAt(e,cell.x,cell.y))||occupied.has(id))continue;
      // Walking from `cell` onto `p` costs whatever entering `p` costs.
      const cost=p.cost+entryCost(e,unit,p.x,p.y);
      if(!costs.has(id)||cost<costs.get(id)){costs.set(id,cost);queue.push({...cell,cost});}
    }
  }
  return p=>costs.get(key(p))??Infinity;
}

// Where a move order to `goal` would take the unit this turn, given the tiles
// the rules allow (`legal`, from getTargets). In reach: the goal itself.
// Beyond reach: the legal tile that leaves the least way on, then the one in
// straightest line with the goal, then the cheapest (last ties by row, then
// column), but only if it gets closer at all. The rest of the way is returned
// for display, measured over visible ground.
export function planMove(e,unit,goal,legal=[]){
  const target={x:goal.x,y:goal.y},start={x:unit.x,y:unit.y};
  if(!legal.length)return {goal:target,stop:null,path:[],beyond:[],cost:0,reachable:false,reason:unit.moved?'moved':'none'};
  const here=legal.find(t=>t.x===target.x&&t.y===target.y);
  if(here){const route=movementRoute(e,unit,here);return {goal:target,stop:{x:here.x,y:here.y,cost:here.cost},path:route?.path??[start,target],beyond:[],cost:here.cost,reachable:true};}
  if(blocked(groundAt(e,target.x,target.y)))return {goal:target,stop:null,path:[],beyond:[],cost:0,reachable:false,reason:'blocked'};
  const rest=distanceToGoal(e,unit,target),now=rest(start);
  const line=t=>Math.hypot(t.x-target.x,t.y-target.y);
  const best=legal.map(t=>({...t,rest:rest(t)})).filter(t=>Number.isFinite(t.rest)).sort((a,b)=>a.rest-b.rest||line(a)-line(b)||a.cost-b.cost||a.y-b.y||a.x-b.x)[0];
  if(!best||!(best.rest<now))return {goal:target,stop:null,path:[],beyond:[],cost:0,reachable:false,reason:Number.isFinite(now)?'no-closer':'unreachable'};
  const route=movementRoute(e,unit,best),onward=movementRoute(e,{...unit,x:best.x,y:best.y},target,{pins:false,visibleOnly:true});
  return {goal:target,stop:{x:best.x,y:best.y,cost:best.cost},path:route?.path??[start,{x:best.x,y:best.y}],beyond:onward?onward.path.slice(1):[],cost:best.cost,reachable:false};
}

import {fieldBlocked,fieldSmoke,fieldMoveCost} from './field-geometry.js';
export const clone = value => JSON.parse(JSON.stringify(value));
export const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
export const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const alive = unit => (unit.resolve ?? unit.hp) > 0;
export const blocked = terrain => terrain==='rock'||terrain==='river';
export function faceToward(unit,target){const dx=target.x-unit.x,dy=target.y-unit.y;if(!dx&&!dy)return unit.facing;unit.facing=Math.abs(dx)>=Math.abs(dy)?(dx>0?'east':'west'):(dy>0?'south':'north');return unit.facing;}
export function lineOfSight(e,from,to){let x=from.x,y=from.y,dx=Math.abs(to.x-x),dy=Math.abs(to.y-y),sx=x<to.x?1:-1,sy=y<to.y?1:-1,err=dx-dy;while(x!==to.x||y!==to.y){const twice=err*2;if(twice>-dy){err-=dy;x+=sx;}if(twice<dx){err+=dx;y+=sy;}if(x===to.x&&y===to.y)return true;if(['rock','wall'].includes(e.terrain[y]?.[x])||fieldBlocked(e,x,y)||fieldSmoke(e,x,y))return false;}return true;}
export const result = (ok, message) => ({ok, message});
export function rng(state) { state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0; return state.rng / 4294967296; }
export function note(encounter, message) { encounter.log.push(message); if(encounter.collectTurnEvents)encounter.turnEvents.push(message); if(encounter.log.length > 70) encounter.log.shift(); }
export function unitAt(encounter, x, y, except) { return encounter.units.find(u => u.id !== except && alive(u) && u.x === x && u.y === y); }
export function movementPinned(e,unit,point){return e.combatVersion===2&&e.units.some(u=>alive(u)&&!u.hidden&&u.role!=='archer'&&u.role!=='escort'&&(unit.side==='enemy'?['player','ally'].includes(u.side):u.side==='enemy')&&distance(u,point)===1);}
export function reachable(encounter, unit, range = unit.move ?? 2) {
  if(encounter.combatVersion===2&&unit.formation==='shield-wall')range=Math.min(range,1);
  const found = new Map([[`${unit.x},${unit.y}`, {x:unit.x,y:unit.y,cost:0}]]), queue = [{x:unit.x,y:unit.y,cost:0}];
  while(queue.length) { const node=queue.shift();if(node.cost>0&&movementPinned(encounter,unit,node))continue; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const x=node.x+dx,y=node.y+dy; if(x<0||y<0||x>=encounter.width||y>=encounter.height) continue;
    const terrain=encounter.terrain[y][x]; if(blocked(terrain)||fieldBlocked(encounter,x,y)||unitAt(encounter,x,y,unit.id)) continue;
    const cost=node.cost+fieldMoveCost(encounter,unit,x,y), key=`${x},${y}`;
    if(cost>range || (found.has(key)&&found.get(key).cost<=cost)) continue;
    const item={x,y,cost}; found.set(key,item); queue.push(item);
  }}
  return [...found.values()].filter(p=>p.x!==unit.x||p.y!==unit.y);
}
export function stepToward(encounter, unit, target, range = unit.move ?? 2) {
  const places=reachable(encounter,unit,range).map(p=>({...p,path:pathDistance(encounter,p,target,unit.id)})).sort((a,b)=>a.path-b.path||a.cost-b.cost);
  if(places[0]&&places[0].path<pathDistance(encounter,unit,target,unit.id)) {faceToward(unit,places[0]);unit.x=places[0].x;unit.y=places[0].y;unit.moved=true;return true;} return false;
}
export function pathDistance(e,from,target,ignoreId){const costs=new Map([[`${from.x},${from.y}`,0]]),queue=[{x:from.x,y:from.y,cost:0}];while(queue.length){queue.sort((a,b)=>a.cost-b.cost);const p=queue.shift();if(p.x===target.x&&p.y===target.y)return p.cost;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy;if(x<0||y<0||x>=e.width||y>=e.height||blocked(e.terrain[y][x])||fieldBlocked(e,x,y))continue;if(unitAt(e,x,y,ignoreId)&&(x!==target.x||y!==target.y))continue;const cost=p.cost+fieldMoveCost(e,{formation:null},x,y),key=`${x},${y}`;if(!costs.has(key)||cost<costs.get(key)){costs.set(key,cost);queue.push({x,y,cost});}}}return 999;}
export function makeUnit(id,name,side,x,y,extra={}) { const hp=extra.hp??12; return {id,name,side,x,y,hp,maxHp:hp,role:'infantry',moved:false,acted:false,move:2,facing:'east',morale:80,intent:'Hold position',...extra}; }
// The ability credit before the first still-undoable move. Any other action
// clears every move origin, so outstanding moves form one chain sharing it.
// Kept non-enumerable: an internal record, not part of the move origin's shape.
export function withMoveCredit(origin,state,e){return Object.defineProperty(origin,'credit',{value:moveCredit(state,e),enumerable:false});}
export function moveCredit(state,e){const outstanding=e.units.find(u=>u.moveOrigin?.credit)?.moveOrigin.credit;if(outstanding)return outstanding;const list=state.chapterCapabilities?.[state.chapter];return {used:e.usedAbilities.includes('move'),capabilityUse:state.capabilityUse?.move===true,chapter:Array.isArray(list)&&list.includes('move'),chapterList:Array.isArray(list)};}

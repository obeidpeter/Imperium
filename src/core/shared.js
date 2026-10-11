export const clone = value => JSON.parse(JSON.stringify(value));
export const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
export const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const alive = unit => (unit.resolve ?? unit.hp) > 0;
export const result = (ok, message) => ({ok, message});
export function rng(state) { state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0; return state.rng / 4294967296; }
export function note(encounter, message) { encounter.log.push(message); if(encounter.log.length > 70) encounter.log.shift(); }
export function unitAt(encounter, x, y, except) { return encounter.units.find(u => u.id !== except && alive(u) && u.x === x && u.y === y); }
export function reachable(encounter, unit, range = unit.move ?? 2) {
  const found = new Map([[`${unit.x},${unit.y}`, {x:unit.x,y:unit.y,cost:0}]]), queue = [{x:unit.x,y:unit.y,cost:0}];
  while(queue.length) { const node=queue.shift(); for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const x=node.x+dx,y=node.y+dy; if(x<0||y<0||x>=encounter.width||y>=encounter.height) continue;
    const terrain=encounter.terrain[y][x]; if(terrain==='rock'||unitAt(encounter,x,y,unit.id)) continue;
    const cost=node.cost+(terrain==='marsh'?2:1), key=`${x},${y}`;
    if(cost>range || (found.has(key)&&found.get(key).cost<=cost)) continue;
    const item={x,y,cost}; found.set(key,item); queue.push(item);
  }}
  return [...found.values()].filter(p=>p.x!==unit.x||p.y!==unit.y);
}
export function stepToward(encounter, unit, target, range = unit.move ?? 2) {
  const places=reachable(encounter,unit,range).map(p=>({...p,path:pathDistance(encounter,p,target,unit.id)})).sort((a,b)=>a.path-b.path||a.cost-b.cost);
  if(places[0]&&places[0].path<pathDistance(encounter,unit,target,unit.id)) {unit.x=places[0].x;unit.y=places[0].y;unit.moved=true;return true;} return false;
}
export function pathDistance(e,from,target,ignoreId){const costs=new Map([[`${from.x},${from.y}`,0]]),queue=[{x:from.x,y:from.y,cost:0}];while(queue.length){queue.sort((a,b)=>a.cost-b.cost);const p=queue.shift();if(p.x===target.x&&p.y===target.y)return p.cost;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy;if(x<0||y<0||x>=e.width||y>=e.height||e.terrain[y][x]==='rock')continue;if(unitAt(e,x,y,ignoreId)&&(x!==target.x||y!==target.y))continue;const cost=p.cost+(e.terrain[y][x]==='marsh'?2:1),key=`${x},${y}`;if(!costs.has(key)||cost<costs.get(key)){costs.set(key,cost);queue.push({x,y,cost});}}}return 999;}
export function makeUnit(id,name,side,x,y,extra={}) { const hp=extra.hp??12; return {id,name,side,x,y,hp,maxHp:hp,role:'infantry',moved:false,acted:false,move:2,facing:'east',morale:80,intent:'Hold position',...extra}; }

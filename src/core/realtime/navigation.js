import {MOVEMENT} from '../../data/realtime-rules.js';

// Navigation for the real-time simulation (§3.3): a 0.5 m walkability grid
// built from an encounter's tile map, A* with an octile heuristic, and string
// pulling along clear lines. Positions are metres from the map's north-west
// corner: x east, z south, a tile TILE metres square. Pure and deterministic;
// the grid for a map is built once and shared.

export const TILE=2.5,HIGH_GROUND=1.6;
// Square roots are exactly rounded in every engine (Math.hypot is not), so the rules use them.
export const span=(dx,dz)=>Math.sqrt(dx*dx+dz*dz);
const SOLID=new Set(['rock','river','wall']),SQRT2=Math.SQRT2;
const grids=new Map();

export const terrainName=t=>typeof t==='string'?t:t?.type||'grass';
export function terrainAtPoint(map,x,z){
  const tx=Math.floor(x/TILE),tz=Math.floor(z/TILE);
  return tx<0||tz<0||tx>=map.width||tz>=map.height?null:terrainName(map.terrain[tz]?.[tx]);
}

// The grid for a map: `solid` where terrain stops a body or a missile, `walk`
// where a body's centre may stand (solid ground widened by the clearance),
// each cell's speed factor and the rules' ground height (high ground 1.6 m).
const byMap=new WeakMap();
export function navGrid(map){
  const known=byMap.get(map);if(known)return known;
  const key=`${map.width}x${map.height}:${map.terrain.map(row=>row.map(terrainName).join(',')).join(';')}`;
  if(grids.has(key)){byMap.set(map,grids.get(key));return grids.get(key);}
  const cell=MOVEMENT.cell,per=Math.round(TILE/cell),cols=map.width*per,rows=map.height*per,n=cols*rows;
  const solid=new Uint8Array(n),walk=new Uint8Array(n),speed=new Float64Array(n),height=new Float64Array(n);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const t=terrainName(map.terrain[Math.floor(r/per)][Math.floor(c/per)]),i=r*cols+c;
    solid[i]=SOLID.has(t)?1:0;speed[i]=MOVEMENT.terrain[t]??1;height[i]=t==='high'?HIGH_GROUND:0;
  }
  const reach=MOVEMENT.clearance;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    let open=1;
    for(let dr=-reach;dr<=reach&&open;dr++)for(let dc=-reach;dc<=reach;dc++){
      const rr=r+dr,cc=c+dc;if(rr>=0&&cc>=0&&rr<rows&&cc<cols&&solid[rr*cols+cc]){open=0;break;}
    }
    walk[r*cols+c]=open;
  }
  const grid={cell,cols,rows,width:cols*cell,depth:rows*cell,solid,walk,speed,height};
  grids.set(key,grid);byMap.set(map,grid);return grid;
}

export const cellIndex=(g,x,z)=>{const c=Math.floor(x/g.cell),r=Math.floor(z/g.cell);return c<0||r<0||c>=g.cols||r>=g.rows?-1:r*g.cols+c;};
export const cellCentre=(g,i)=>({x:(i%g.cols+.5)*g.cell,z:(Math.floor(i/g.cols)+.5)*g.cell});
export const walkable=(g,x,z)=>{const i=cellIndex(g,x,z);return i>=0&&g.walk[i]===1;};
export const groundHeight=(g,x,z)=>{const i=cellIndex(g,x,z);return i<0?0:g.height[i];};
export const speedFactor=(g,x,z)=>{const i=cellIndex(g,x,z);return i<0?1:g.speed[i];};
// Keep a centre inside the map, a body's radius from its edge.
export function clampToMap(g,p,radius=MOVEMENT.radius){
  return {x:Math.min(g.width-radius,Math.max(radius,p.x)),z:Math.min(g.depth-radius,Math.max(radius,p.z))};
}

// The walkable cell nearest a point (rings outward), for a start or goal
// that lies on blocked ground.
export function nearestWalkable(g,x,z){
  const c0=Math.floor(x/g.cell),r0=Math.floor(z/g.cell);
  for(let ring=0;ring<Math.max(g.cols,g.rows);ring++){
    let best=-1,bestD=Infinity;
    for(let r=r0-ring;r<=r0+ring;r++)for(let c=c0-ring;c<=c0+ring;c++){
      if(Math.max(Math.abs(r-r0),Math.abs(c-c0))!==ring||r<0||c<0||r>=g.rows||c>=g.cols)continue;
      const i=r*g.cols+c;if(!g.walk[i])continue;const p=cellCentre(g,i),d=(p.x-x)**2+(p.z-z)**2;if(d<bestD){bestD=d;best=i;}
    }
    if(best>=0)return best;
  }
  return -1;
}

// Whether a body can walk straight from a to b: every sample along the line
// lies on walkable ground no slower than both ends (so a smoothed route never
// cuts through marsh that the search went round). Samples near `a` are
// skipped when it starts on blocked ground (a body nudged against a rock can
// still step away from it).
export function clearLine(g,a,b,{fromBlocked=false}={}){
  const dx=b.x-a.x,dz=b.z-a.z,length=span(dx,dz),steps=Math.max(1,Math.ceil(length/(g.cell*.2)));
  const slowest=Math.min(speedFactor(g,a.x,a.z),speedFactor(g,b.x,b.z))-1e-9;
  for(let s=1;s<=steps;s++){
    const t=s/steps,x=a.x+dx*t,z=a.z+dz*t;
    if(fromBlocked&&t*length<g.cell*1.5)continue;if(!walkable(g,x,z)||speedFactor(g,x,z)<slowest)return false;
  }
  return true;
}
// Whether a missile's line crosses solid ground (rocks, walls): cover.
export function crossesCover(g,a,b){
  const dx=b.x-a.x,dz=b.z-a.z,length=span(dx,dz),steps=Math.max(1,Math.ceil(length/(g.cell*.5)));
  for(let s=1;s<steps;s++){const t=s/steps,i=cellIndex(g,a.x+dx*t,a.z+dz*t);if(i>=0&&g.solid[i])return true;}
  return false;
}

// A binary heap of cell indices by f-score.
function heap(capacity){
  const items=new Int32Array(capacity),keys=new Float64Array(capacity);let size=0;
  return {get size(){return size;},
    push(i,f){let k=size++;items[k]=i;keys[k]=f;while(k>0){const p=(k-1)>>1;if(keys[p]<=keys[k])break;
      [items[p],items[k]]=[items[k],items[p]];[keys[p],keys[k]]=[keys[k],keys[p]];k=p;}},
    pop(){const top=items[0];size--;if(size>0){items[0]=items[size];keys[0]=keys[size];let k=0;
      for(;;){const l=k*2+1,r=l+1;let m=k;if(l<size&&keys[l]<keys[m])m=l;if(r<size&&keys[r]<keys[m])m=r;if(m===k)break;
        [items[m],items[k]]=[items[k],items[m]];[keys[m],keys[k]]=[keys[k],keys[m]];k=m;}}
      return top;}};
}
const NEIGHBOURS=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,SQRT2],[1,-1,SQRT2],[-1,1,SQRT2],[-1,-1,SQRT2]];

// A route from `from` to `to`: { points, stopPoint, length, reasonCode? }.
// `points` are the waypoints after `from`, ending at the stop point. When the
// goal cannot be reached, the route ends at the nearest reachable point and
// carries PATH_BLOCKED.
export function findRoute(g,from,to){
  const goalPoint=clampToMap(g,to),startIndex=cellIndex(g,from.x,from.z),startBlocked=startIndex<0||!g.walk[startIndex];
  const start=startBlocked?nearestWalkable(g,from.x,from.z):startIndex;
  if(start<0)return {points:[],stopPoint:{x:from.x,z:from.z},length:0,reasonCode:'PATH_BLOCKED'};
  const goalIndex=cellIndex(g,goalPoint.x,goalPoint.z),goalOpen=goalIndex>=0&&g.walk[goalIndex]===1;
  // Already standing in the goal's cell, or a clear straight line: no search.
  if(goalOpen&&!startBlocked&&(goalIndex===start||clearLine(g,from,goalPoint)))
    return {points:[goalPoint],stopPoint:goalPoint,length:span(goalPoint.x-from.x,goalPoint.z-from.z)};
  const n=g.cols*g.rows,gScore=new Float64Array(n).fill(Infinity),parent=new Int32Array(n).fill(-1),closed=new Uint8Array(n),open=heap(n*8);
  const gc=goalPoint.x/g.cell-.5,gr=goalPoint.z/g.cell-.5,h=i=>{const dx=Math.abs(i%g.cols-gc),dz=Math.abs(Math.floor(i/g.cols)-gr);
    return (Math.max(dx,dz)+(SQRT2-1)*Math.min(dx,dz))*g.cell;};
  gScore[start]=0;open.push(start,h(start));let best=start,bestH=h(start),found=false;
  while(open.size){
    const i=open.pop();if(closed[i])continue;closed[i]=1;
    const hi=h(i);if(hi<bestH-1e-9||Math.abs(hi-bestH)<=1e-9&&gScore[i]<gScore[best]){best=i;bestH=hi;}
    if(goalOpen&&i===goalIndex){found=true;break;}
    const c=i%g.cols,r=(i-c)/g.cols;
    for(const [dc,dr,step]of NEIGHBOURS){
      const cc=c+dc,rr=r+dr;if(cc<0||rr<0||cc>=g.cols||rr>=g.rows)continue;const j=rr*g.cols+cc;if(!g.walk[j]||closed[j])continue;
      // No corner cutting: a diagonal needs both its orthogonal cells open.
      if(dc&&dr&&(!g.walk[r*g.cols+cc]||!g.walk[rr*g.cols+c]))continue;
      const cost=gScore[i]+step*g.cell/g.speed[j];if(cost<gScore[j]){gScore[j]=cost;parent[j]=i;open.push(j,cost+h(j));}
    }
  }
  const end=found?goalIndex:best,cells=[];for(let i=end;i>=0;i=parent[i]){cells.push(i);if(i===start)break;}cells.reverse();
  const stopPoint=found?goalPoint:cellCentre(g,end);
  const raw=[...cells.slice(1,-1).map(i=>cellCentre(g,i)),stopPoint];
  // String pulling: from each anchor, go straight to the farthest waypoint it can see.
  const points=[];let anchor={x:from.x,z:from.z},k=0,blocked=startBlocked;
  while(k<raw.length){
    let far=k;for(let j=raw.length-1;j>k;j--)if(clearLine(g,anchor,raw[j],{fromBlocked:blocked})){far=j;break;}
    points.push(raw[far]);anchor=raw[far];k=far+1;blocked=false;
  }
  let length=0,prev=from;for(const p of points){length+=span(p.x-prev.x,p.z-prev.z);prev=p;}
  return {points,stopPoint,length,...(found||goalOpen&&end===goalIndex?{}:{reasonCode:'PATH_BLOCKED'})};
}

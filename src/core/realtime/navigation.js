import {MOVEMENT} from '../../data/realtime-rules.js';

// Navigation for the real-time simulation (§3.3): a 0.5 m walkability grid
// built from an encounter's tile map, A* with an octile heuristic, and string
// pulling along clear lines. Positions are metres from the map's north-west
// corner: x east, z south, a tile TILE metres square. Pure and deterministic;
// the grid for a map is built once and shared.

export const TILE=2.5,HIGH_GROUND=1.6;
// Square roots are exactly rounded in every engine (Math.hypot is not), so the rules use them.
export const span=(dx,dz)=>Math.sqrt(dx*dx+dz*dz);
const SOLID=new Set(['rock','river','wall']),SQRT2=Math.SQRT2,RAIN_SLOPE=.5;
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
  const key=`${map.width}x${map.height}:${map.rain?'rain:':''}${map.terrain.map(row=>row.map(terrainName).join(',')).join(';')}`;
  if(grids.has(key)){byMap.set(map,grids.get(key));return grids.get(key);}
  const cell=MOVEMENT.cell,per=Math.round(TILE/cell),cols=map.width*per,rows=map.height*per,n=cols*rows;
  const solid=new Uint8Array(n),walk=new Uint8Array(n),speed=new Float64Array(n),height=new Float64Array(n);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const t=terrainName(map.terrain[Math.floor(r/per)][Math.floor(c/per)]),i=r*cols+c;
    solid[i]=SOLID.has(t)?1:0;speed[i]=MOVEMENT.terrain[t]??1;height[i]=t==='high'?HIGH_GROUND:0;
  }
  // In rain the slopes are slower to climb (0.38: a step onto high ground costs one more):
  // the high ground's edge, within a metre of the low, is crossed at half speed.
  if(map.rain){
    const edge=Math.round(1/cell),slow=[];
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const i=r*cols+c;if(!height[i])continue;let low=false;
      for(let dr=-edge;dr<=edge&&!low;dr++)for(let dc=-edge;dc<=edge;dc++){const rr=r+dr,cc=c+dc;if(rr>=0&&cc>=0&&rr<rows&&cc<cols&&!height[rr*cols+cc]&&!solid[rr*cols+cc]){low=true;break;}}
      if(low)slow.push(i);
    }
    for(const i of slow)speed[i]*=RAIN_SLOPE;
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

// A map whose terrain has changed (a gate opened, a bridge repaired) is read afresh.
export function invalidateGrid(map){byMap.delete(map);}
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

// A binary heap of cell indices by f-score. Sifting moves a hole rather than
// swapping pairs (the same order, and nothing allocated).
function heap(capacity){
  const items=new Int32Array(capacity),keys=new Float64Array(capacity);let size=0;
  return {get size(){return size;},clear(){size=0;},
    push(i,f){let k=size++;while(k>0){const p=(k-1)>>1;if(keys[p]<=f)break;items[k]=items[p];keys[k]=keys[p];k=p;}items[k]=i;keys[k]=f;},
    pop(){const top=items[0];size--;if(size>0){const item=items[size],key=keys[size];let k=0;
      for(;;){const l=k*2+1,r=l+1;let m=k,mk=key;if(l<size&&keys[l]<mk){m=l;mk=keys[l];}if(r<size&&keys[r]<mk)m=r;if(m===k)break;
        items[k]=items[m];keys[k]=keys[m];k=m;}
      items[k]=item;keys[k]=key;}
      return top;}};
}
const NEIGHBOURS=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,SQRT2],[1,-1,SQRT2],[-1,1,SQRT2],[-1,-1,SQRT2]];
const DC=Int8Array.from(NEIGHBOURS,n=>n[0]),DR=Int8Array.from(NEIGHBOURS,n=>n[1]),STEP=Float64Array.from(NEIGHBOURS,n=>n[2]);
// The grid's walkable regions, each one a body can cross (the search's own
// moves: eight ways, no corner cutting), labelled once per grid.
function regions(g){
  if(g.region)return g.region;
  const n=g.cols*g.rows,label=new Int32Array(n).fill(-1),stack=new Int32Array(n);let next=0;
  for(let s=0;s<n;s++){
    if(!g.walk[s]||label[s]>=0)continue;let top=0;stack[top++]=s;label[s]=next;
    while(top){
      const i=stack[--top],c=i%g.cols,r=(i-c)/g.cols;
      for(const [dc,dr]of NEIGHBOURS){
        const cc=c+dc,rr=r+dr;if(cc<0||rr<0||cc>=g.cols||rr>=g.rows)continue;const j=rr*g.cols+cc;
        if(!g.walk[j]||label[j]>=0||dc&&dr&&(!g.walk[r*g.cols+cc]||!g.walk[rr*g.cols+c]))continue;label[j]=next;stack[top++]=j;
      }
    }
    next++;
  }
  g.region=label;return label;
}
// The cell of a region nearest a point (rings outward from it), or -1.
function nearestInRegion(g,label,region,p){
  const c0=Math.floor(p.x/g.cell),r0=Math.floor(p.z/g.cell),limit=Math.max(g.cols,g.rows);let best=-1,bestD=Infinity,stop=limit;
  for(let d=0;d<=Math.min(stop,limit);d++){
    for(let r=r0-d;r<=r0+d;r++)for(let c=c0-d;c<=c0+d;c++){
      if(Math.max(Math.abs(r-r0),Math.abs(c-c0))!==d||c<0||r<0||c>=g.cols||r>=g.rows)continue;const i=r*g.cols+c;if(label[i]!==region)continue;
      const e=span((c+.5)*g.cell-p.x,(r+.5)*g.cell-p.z);if(e<bestD-1e-9||Math.abs(e-bestD)<=1e-9&&i<best){bestD=e;best=i;}
    }
    if(best>=0&&stop===limit)stop=Math.ceil(d*SQRT2)+1;
  }
  return best;
}
// The search's working arrays, kept with the grid and reused: `seen` marks the
// cells this search has touched, so nothing needs clearing between searches.
function scratch(g){
  if(g.scratch)return g.scratch;const n=g.cols*g.rows;
  g.scratch={gScore:new Float64Array(n),parent:new Int32Array(n),closed:new Uint8Array(n),seen:new Uint32Array(n),stamp:0,open:heap(n*8)};return g.scratch;
}

// A route from `from` to `to`: { points, stopPoint, length, reasonCode? }.
// `points` are the waypoints after `from`, ending at the stop point. When the
// goal cannot be reached, the route ends at the nearest reachable point and
// carries PATH_BLOCKED.
export function findRoute(g,from,to){
  const goalPoint=clampToMap(g,to),startIndex=cellIndex(g,from.x,from.z),startBlocked=startIndex<0||!g.walk[startIndex];
  const start=startBlocked?nearestWalkable(g,from.x,from.z):startIndex;
  if(start<0)return {points:[],stopPoint:{x:from.x,z:from.z},length:0,reasonCode:'PATH_BLOCKED'};
  const goalCell=cellIndex(g,goalPoint.x,goalPoint.z),label=regions(g);
  // A goal on blocked ground, or beyond what this body can reach, becomes the
  // reachable cell nearest it: the route stops there (PATH_BLOCKED), and the
  // search never has to exhaust the region to learn it.
  const reachable=goalCell>=0&&g.walk[goalCell]===1&&label[goalCell]===label[start];
  const goalIndex=reachable?goalCell:nearestInRegion(g,label,label[start],goalPoint);
  // Already standing in the goal's cell, or a clear straight line: no search.
  if(reachable&&!startBlocked&&(goalIndex===start||clearLine(g,from,goalPoint)))
    return {points:[goalPoint],stopPoint:goalPoint,length:span(goalPoint.x-from.x,goalPoint.z-from.z)};
  const w=scratch(g),{gScore,parent,closed,seen,open}=w;w.stamp=(w.stamp+1)>>>0||1;const stamp=w.stamp;open.clear();
  const touch=i=>{if(seen[i]!==stamp){seen[i]=stamp;gScore[i]=Infinity;parent[i]=-1;closed[i]=0;}};
  // The octile distance to the goal, in metres.
  const target=reachable?goalPoint:cellCentre(g,goalIndex),gc=target.x/g.cell-.5,gr=target.z/g.cell-.5,cols=g.cols,rows=g.rows,walk=g.walk,speed=g.speed,cell=g.cell,
    h=(c,r)=>{const dx=Math.abs(c-gc),dz=Math.abs(r-gr);return (Math.max(dx,dz)+(SQRT2-1)*Math.min(dx,dz))*cell;};
  touch(start);gScore[start]=0;open.push(start,h(start%cols,(start-start%cols)/cols));let found=false;
  while(open.size){
    const i=open.pop();if(closed[i])continue;closed[i]=1;
    if(i===goalIndex){found=true;break;}
    const c=i%cols,r=(i-c)/cols,gi=gScore[i];
    for(let n=0;n<8;n++){
      const dc=DC[n],dr=DR[n],cc=c+dc,rr=r+dr;if(cc<0||rr<0||cc>=cols||rr>=rows)continue;const j=rr*cols+cc;if(!walk[j])continue;
      if(seen[j]!==stamp){seen[j]=stamp;gScore[j]=Infinity;parent[j]=-1;closed[j]=0;}else if(closed[j])continue;
      // No corner cutting: a diagonal needs both its orthogonal cells open.
      if(n>3&&(!walk[r*cols+cc]||!walk[rr*cols+c]))continue;
      const cost=gi+STEP[n]*cell/speed[j];if(cost<gScore[j]){gScore[j]=cost;parent[j]=i;open.push(j,cost+h(cc,rr));}
    }
  }
  const end=found?goalIndex:start,cells=[];for(let i=end;i>=0;i=parent[i]){cells.push(i);if(i===start)break;}cells.reverse();
  const stopPoint=reachable?goalPoint:cellCentre(g,end);
  const raw=[...cells.slice(1,-1).map(i=>cellCentre(g,i)),stopPoint];
  // String pulling: from each anchor, go straight to the farthest waypoint it can see.
  const points=[];let anchor={x:from.x,z:from.z},k=0,blocked=startBlocked;
  while(k<raw.length){
    let far=k;for(let j=raw.length-1;j>k;j--)if(clearLine(g,anchor,raw[j],{fromBlocked:blocked})){far=j;break;}
    points.push(raw[far]);anchor=raw[far];k=far+1;blocked=false;
  }
  let length=0,prev=from;for(const p of points){length+=span(p.x-prev.x,p.z-prev.z);prev=p;}
  return {points,stopPoint,length,...(reachable&&found?{}:{reasonCode:'PATH_BLOCKED'})};
}

import {terrainAt,clamp,smooth} from './environment-layout.js';

// Camp dressing uses the same immutable placement description as the model
// loader. These are visual service courts, never new destinations or blockers.
export function campServiceForProp(id){
  if(/litter|laundry/.test(id))return 'valetudinarium';
  if(/table|cabinet|eagle|brazier|carriage/.test(id))return 'principia';
  if(/bread|cook|loom|market|pottery|amphora|beehive|household/.test(id))return 'canabae';
  if(/grindstone|woodpile|baskets|brick/.test(id))return 'drill';
  return 'quartermaster';
}
const overlaps=(a,b)=>a.maxX>b.minX&&a.minX<b.maxX&&a.maxZ>b.minZ&&a.minZ<b.maxZ;

/** Find a small working group beside its service, with a clear aisle between
 * it and the map. Building and prop footprints, not just their centres, are
 * excluded. Stable search order makes model/fallback/reload placements agree. */
export function campPropCourt(e,id,occupied,{tileSize=2.5}={}){
  if(!/-camp$/.test(e.id)||!e.campPresentation?.places?.length)return null;
  const service=campServiceForProp(id),target=e.campPresentation.places.find(p=>p.id===service);
  if(!target)return null;
  const hx=e.width*tileSize/2,hz=e.height*tileSize/2;
  // Leave the northern river and destination frontage intact. Work courts
  // open from the east, west and southern inhabited edge instead.
  const edges=[{side:'east',d:hx-target.x},{side:'west',d:hx+target.x},{side:'south',d:hz-target.z}].sort((a,b)=>a.d-b.d);
  for(const {side}of edges)for(let row=0;row<4;row++)for(const offset of [0,-5.2,5.2,-10.4,10.4,-15.6,15.6]){
    const east=side==='east',south=side==='south',edge=south?hz:hx;
    const along=clamp((south?target.x:target.z)+offset,-(south?hx:hz)+3,(south?hx:hz)-3);
    const across=edge+5.2+row*5.2,x=south?along:(east?across:-across),z=south?across:along;
    const bounds={minX:x-2.4,maxX:x+2.4,minZ:z-2.4,maxZ:z+2.4};
    if(occupied.some(b=>overlaps(bounds,b)))continue;
    const approach=south?{x,z:hz}:{x:east?hx:-hx,z};
    // The full mouth of the apron must meet a genuinely open perimeter cell.
    // Otherwise a decorative path would appear to lead through a solid wall.
    if([-.8,0,.8].some(offset=>{
      const cx=Math.floor(((south?x+offset:east?hx-.1:-hx+.1)+hx)/tileSize),cy=Math.floor(((south?hz-.1:z+offset)+hz)/tileSize);
      return !walkable.has(terrainAt(e,cx,cy));
    }))continue;
    const aisle={minX:Math.min(x,approach.x)-.8,maxX:Math.max(x,approach.x)+.8,minZ:Math.min(z,approach.z)-.8,maxZ:Math.max(z,approach.z)+.8};
    if(occupied.some(b=>overlaps(aisle,b)))continue;
    return {x,z,bounds,service,approach,yaw:Math.atan2(approach.x-x,approach.z-z)};
  }
  return null;
}

const walkable=new Set(['grass','road','sand','marsh','ford','high','hill','camp','stone','floor','chamber']);
/** A minimum-cost network from the gate to services. Following actual cells
 * keeps wear off water and collision pockets. The network is computed once;
 * per-texel sampling uses local buckets, avoiding a path scan for every pixel. */
export function createCampGroundSampler(e,{tileSize=2.5,props=[]}={}){
  if(!/-camp$/.test(e.id)||!e.campPresentation?.places?.length)return {sample:()=>0,routes:[],courts:[]};
  const {width,height}=e,hx=width*tileSize/2,hz=height*tileSize/2,places=e.campPresentation.places;
  const cell=p=>({x:Math.max(0,Math.min(width-1,Math.floor((p.x+hx)/tileSize))),y:Math.max(0,Math.min(height-1,Math.floor((p.z+hz)/tileSize)))});
  const point=i=>({x:(i%width+.5)*tileSize-hx,z:(Math.floor(i/width)+.5)*tileSize-hz});
  const gate=cell(places.find(p=>p.id==='gate')??places[0]),start=gate.y*width+gate.x,dist=new Float64Array(width*height).fill(Infinity),prev=new Int32Array(width*height).fill(-1),open=new Set([start]);dist[start]=0;
  while(open.size){
    let n=-1;for(const i of open)if(n<0||dist[i]<dist[n])n=i;open.delete(n);
    const x=n%width,y=Math.floor(n/width);
    for(const [dx,dy]of [[0,-1],[-1,0],[1,0],[0,1]]){
      const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=width||yy>=height)continue;
      const type=terrainAt(e,xx,yy);if(!walkable.has(type))continue;
      const j=yy*width+xx,d=dist[n]+(type==='road'?1:1.65);
      if(d<dist[j]){dist[j]=d;prev[j]=n;open.add(j);}
    }
  }
  const routes=[],segments=new Map(),courts=places.map(p=>({...p,radius:p.id==='drill'?3.6:2.5}));
  const add=(a,b)=>{const key=[`${a.x},${a.z}`,`${b.x},${b.z}`].sort().join(':');if(!segments.has(key))segments.set(key,[a,b]);};
  for(const place of places){
    const c=cell(place),end=c.y*width+c.x;if(!Number.isFinite(dist[end]))continue;
    const nodes=[];let i=end;while(i>=0){nodes.push(point(i));if(i===start)break;i=prev[i];}
    nodes.reverse();for(let j=1;j<nodes.length;j++)add(nodes[j-1],nodes[j]);
    routes.push({id:place.id,points:nodes});
  }
  // Ground extends to the furnishings only when its straight apron does not
  // pass through an architectural solid; the caller supplies checked courts.
  for(const p of props)if(p.court){add(p.court.approach,p);courts.push({id:p.id,x:p.x,z:p.z,radius:2.7});}
  const buckets=new Map(),size=5;
  const insert=(item,minX,minZ,maxX,maxZ)=>{for(let z=Math.floor(minZ/size);z<=Math.floor(maxZ/size);z++)for(let x=Math.floor(minX/size);x<=Math.floor(maxX/size);x++){const key=`${x},${z}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(item);}};
  for(const [a,b]of segments.values())insert({a,b},Math.min(a.x,b.x)-2,Math.min(a.z,b.z)-2,Math.max(a.x,b.x)+2,Math.max(a.z,b.z)+2);
  for(const c of courts)insert({c},c.x-c.radius,c.z-c.radius,c.x+c.radius,c.z+c.radius);
  const sample=(x,z)=>{
    if(Math.abs(x)<hx&&Math.abs(z)<hz){const c=cell({x,z});if(!walkable.has(terrainAt(e,c.x,c.y)))return 0;}
    let weight=0;
    for(const item of buckets.get(`${Math.floor(x/size)},${Math.floor(z/size)}`)??[]){
      if(item.c){const c=item.c;weight=Math.max(weight,(1-smooth(Math.hypot(x-c.x,z-c.z)/c.radius))*.76);continue;}
      const {a,b}=item,dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz,t=l?clamp(((x-a.x)*dx+(z-a.z)*dz)/l):0,d=Math.hypot(x-a.x-t*dx,z-a.z-t*dz);
      weight=Math.max(weight,(1-smooth((d-.35)/1.35))*.86);
    }
    return weight;
  };
  return {sample,routes,courts};
}

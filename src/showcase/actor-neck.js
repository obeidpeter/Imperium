// Fit the actual open crop rim, welding only for its topology lookup. UV seam
// vertices keep their original indices and coordinates in the shipped asset.
const fits=new WeakMap(),TAU=Math.PI*2;
const clamp=v=>Math.max(0,Math.min(1,v));
function neckFit(source){
  if(fits.has(source))return fits.get(source);
  const p=source.attributes.position,bones=source.attributes.skinIndex,index=source.index?.array;
  if(!index||!bones){fits.set(source,[]);return [];}
  const keys=[],points=new Map(),edges=new Map();
  for(let i=0;i<p.count;i++)if(bones.getX(i)===1){const point=[p.getX(i),p.getY(i),p.getZ(i)],key=point.map(v=>Math.round(v*1e5)).join(',');keys[i]=key;points.set(key,point);}
  for(let i=0;i<index.length;i+=3){const tri=[index[i],index[i+1],index[i+2]];if(!tri.every(v=>keys[v]))continue;for(let j=0;j<3;j++){const a=keys[tri[j]],b=keys[tri[(j+1)%3]],key=[a,b].sort().join('|'),old=edges.get(key);edges.set(key,{a,b,count:(old?.count??0)+1});}}
  const boundary=new Set();for(const edge of edges.values())if(edge.count===1&&points.get(edge.a)[1]<1.44&&points.get(edge.b)[1]<1.44){boundary.add(edge.a);boundary.add(edge.b);}
  if(boundary.size<8){fits.set(source,[]);return [];}
  const rim=[...boundary].map(key=>points.get(key)),centerX=(Math.min(...rim.map(p=>p[0]))+Math.max(...rim.map(p=>p[0])))/2,centerZ=(Math.min(...rim.map(p=>p[2]))+Math.max(...rim.map(p=>p[2])))/2;
  const angle=(x,z)=>(Math.atan2(x-centerX,z-centerZ)+TAU)%TAU;
  const ring=rim.map(point=>({angle:angle(point[0],point[2]),y:point[1]})).sort((a,b)=>a.angle-b.angle);
  const rimY=a=>{let next=ring.findIndex(v=>v.angle>a);if(next<0)next=0;const before=ring[(next+ring.length-1)%ring.length],after=ring[next],start=before.angle,end=after.angle+(next===0?TAU:0),at=a+(a<start?TAU:0);return before.y+(after.y-before.y)*(at-start)/(end-start);};
  const fitted=[];
  for(let i=0;i<p.count;i++)if(keys[i]&&p.getY(i)<1.462){
    const a=angle(p.getX(i),p.getZ(i)),base=boundary.has(keys[i])?p.getY(i):rimY(a),height=clamp((p.getY(i)-base)/(1.462-base)),weight=1-height*height*(3-2*height);
    fitted.push({i,weight,y:1.394+(1.462-1.394)*height,x:Math.sin(a)*.069,z:Math.cos(a)*.060});
  }
  fits.set(source,fitted);return fitted;
}

/** Change only a caller-owned adapted position array below the upper neck.
 * The terminal ellipse is inside the costume collar, below its visible rim. */
export function fitActorNeck(source,geometry){
  const p=geometry.attributes.position;
  for(const {i,weight,x,y,z}of neckFit(source))p.setXYZ(i,p.getX(i)*(1-weight)+x*weight,y,p.getZ(i)*(1-weight)+z*weight);
  return geometry;
}

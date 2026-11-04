import * as T from '../../vendor/three/three.module.js';
import {clipBodyAtNeck,fitGeneratedNeck} from './generated-identity.js';

// A real skinned strip joins the two independently generated necks. It uses the
// head's skin paint, the body's lower boundary and both boundaries' exact weights.
// No floating collar, added draw call or change to the face/shoulder silhouette.
const TOP=1.51,BOTTOM=1.49,CX=-.018,CZ=.008;
function boundary(g,height){
  const p=g.attributes.position,edges=[];
  for(let i=0;i<g.index.count;i+=3)for(let j=0;j<3;j++){
    const a=g.index.getX(i+j),b=g.index.getX(i+(j+1)%3);
    if(Math.abs(p.getY(a)-height)<1e-6&&Math.abs(p.getY(b)-height)<1e-6&&Math.hypot(p.getX(a)-p.getX(b),p.getZ(a)-p.getZ(b))>1e-7)edges.push([a,b]);
  }
  return edges;
}
function sample(g,edges,angle,withEdge=false){
  const p=g.attributes.position,dx=Math.cos(angle),dz=Math.sin(angle);let hit=null;
  for(const [a,b]of edges){
    const ax=p.getX(a)-CX,az=p.getZ(a)-CZ,bx=p.getX(b)-p.getX(a),bz=p.getZ(b)-p.getZ(a),det=dx*bz-dz*bx;
    if(Math.abs(det)<1e-9)continue;
    const radius=(ax*bz-az*bx)/det,t=(ax*dz-az*dx)/det;
    if(radius<.02||radius>.18||t<-.00001||t>1.00001||hit&&radius>=hit.radius)continue;
    hit={a,b,t:Math.max(0,Math.min(1,t)),radius};
  }
  if(!hit)return null;
  const {a,b,t}=hit,data=Object.fromEntries(Object.entries(g.attributes).map(([key,v])=>[key,Array.from({length:v.itemSize},(_,k)=>v.getComponent(a,k)*(1-t)+v.getComponent(b,k)*t)]));
  const weights=new Map();for(const [index,share]of [[a,1-t],[b,t]])for(let k=0;k<4;k++){
    const id=g.attributes.skinIndex.getComponent(index,k);weights.set(id,(weights.get(id)||0)+g.attributes.skinWeight.getComponent(index,k)*share);
  }
  const sorted=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=sorted.reduce((n,v)=>n+v[1],0);
  data.skinIndex=Array.from({length:4},(_,k)=>sorted[k]?.[0]??0);data.skinWeight=Array.from({length:4},(_,k)=>(sorted[k]?.[1]??0)/sum);
  return withEdge?{data,edge:[a,b]}:data;
}
export function joinGeneratedNeck(bodySource,headSource){
  const body=fitGeneratedNeck(clipBodyAtNeck(bodySource,{height:BOTTOM})),head=clipBodyAtNeck(headSource,{above:true,height:TOP});
  const upper=boundary(head,TOP),lower=boundary(body,BOTTOM),angles=new Set();
  for(const [g,edges]of [[head,upper],[body,lower]])for(const edge of edges)for(const i of edge){
    const p=g.attributes.position;angles.add(Math.atan2(p.getZ(i)-CZ,p.getX(i)-CX));
  }
  const ordered=[...angles].sort((a,b)=>a-b),ring=ordered.map(angle=>({upper:sample(head,upper,angle),lower:sample(body,lower,angle)}));
  if(ring.length<8||ring.some(p=>!p.upper||!p.lower)){body.dispose();head.dispose();return null;}
  const attributes=Object.entries(head.attributes),data=Object.fromEntries(attributes.map(([key,a])=>[key,Array.from({length:a.count*a.itemSize},(_,i)=>a.getComponent(Math.floor(i/a.itemSize),i%a.itemSize))]));
  const indices=Array.from(head.index.array),base=head.attributes.position.count;
  for(let i=0;i<ring.length;i++){
    const next=(i+1)%ring.length,angleA=ordered[i],angleB=next===0?ordered[0]+Math.PI*2:ordered[next];
    // Duplicate each segment's UV seam. Connecting two different atlas islands
    // across a shared ring vertex paints thin clothing streaks down the neck.
    const edge=sample(head,upper,(angleA+angleB)/2,true).edge;
    for(const [point,angle]of [[ring[i],angleA],[ring[next],angleB]]){
      const paint=sample(head,[edge],angle)??point.upper;
      for(const bottom of [false,true])for(const [key]of attributes){
        const values=['position','normal','skinIndex','skinWeight'].includes(key)?(bottom?point.lower[key]:point.upper[key]):paint[key];
        data[key].push(...values);
      }
    }
    const a=base+i*4,b=a+2;indices.push(a,b,a+1,b,b+1,a+1);
  }
  const stitched=new T.BufferGeometry();
  for(const [key,a]of attributes)stitched.setAttribute(key,key==='skinIndex'?new T.Uint16BufferAttribute(data[key],a.itemSize):new T.Float32BufferAttribute(data[key],a.itemSize));
  stitched.setIndex(indices);stitched.computeBoundingBox();stitched.computeBoundingSphere();
  stitched.userData={...head.userData,neckJoined:true,neckTriangles:ring.length*2};head.dispose();
  return {body,head:stitched};
}

import * as T from '../../vendor/three/three.module.js';

/** Deterministic vertex clustering for rigid overview parts, before skinning.
 * It retains material vertex colours and indexed silhouettes, and removes
 * collapsed/duplicate triangles. No shared source buffer is changed. */
export function simplifyActorOverview(source,{cell=.018}={}){
  if(!(cell>0&&cell<=.05))throw new RangeError('Invalid actor overview cell');
  const p=source.attributes.position,n=source.attributes.normal,c=source.attributes.color;
  const clusters=new Map(),map=new Uint32Array(p.count),values=[];
  for(let i=0;i<p.count;i++){
    const key=[Math.round(p.getX(i)/cell),Math.round(p.getY(i)/cell),Math.round(p.getZ(i)/cell)].join(',');
    let id=clusters.get(key);
    if(id===undefined){id=values.length;clusters.set(key,id);values.push({count:0,p:[0,0,0],n:[0,0,0],c:[0,0,0]});}
    map[i]=id;const v=values[id];v.count++;
    for(let j=0;j<3;j++){v.p[j]+=p.array[i*3+j];v.n[j]+=n?.array[i*3+j]??0;v.c[j]+=c?.array[i*3+j]??1;}
  }
  const index=source.index?.array??Array.from({length:p.count},(_,i)=>i),triangles=[],seen=new Set(),used=new Set();
  for(let i=0;i<index.length;i+=3){
    const a=map[index[i]],b=map[index[i+1]],d=map[index[i+2]];if(a===b||b===d||a===d)continue;
    const key=[a,b,d].slice().sort((x,y)=>x-y).join(':');if(seen.has(key))continue;
    seen.add(key);triangles.push(a,b,d);used.add(a);used.add(b);used.add(d);
  }
  if(!triangles.length)return source.clone();
  const ids=[...used],remap=new Map(ids.map((id,i)=>[id,i])),positions=[],normals=[],colors=[];
  for(const id of ids){
    const v=values[id],length=Math.hypot(...v.n);
    positions.push(...v.p.map(x=>x/v.count));normals.push(...(length>1e-8?v.n.map(x=>x/length):[0,1,0]));colors.push(...v.c.map(x=>x/v.count));
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  g.setIndex(triangles.map(id=>remap.get(id)));g.computeBoundingBox();g.computeBoundingSphere();g.userData={...source.userData,overviewReduction:{method:'vertex clustering before binding',cell,sourceTriangles:index.length/3,triangles:g.index.count/3}};return g;
}

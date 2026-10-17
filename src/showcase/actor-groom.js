import * as T from '../../vendor/three/three.module.js';

// Small opaque, sculpted locks follow the actual adapted scalp. The connected
// underlayer closes every viewing angle; no sorting-dependent alpha cards.
export function groomActorHair(surface,identity,{beard=false,quality='balanced',edgeDistance=null}={}){
  if(!surface?.attributes.position.count)return surface;
  const positions=[],normals=[],uvs=[],colors=[],joints=[],weights=[];
  const p=surface.attributes.position,n=surface.attributes.normal;
  const hash=(x,y,z)=>{const a=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return a-Math.floor(a);};
  function vertex(point,normal,tint){positions.push(...point.toArray());normals.push(...normal.toArray());uvs.push(Math.atan2(point.x,point.z+.02)/Math.PI*3,(point.y-1.4)*20);colors.push(tint,tint*.99,tint*.97);if(edgeDistance)colors.push(edgeDistance?Math.max(0,Math.min(1,(edgeDistance(point.x,point.y,point.z)-.0002)/.0045)):1);joints.push(1,0,0,0);weights.push(1,0,0,0);}
  const sculpt=(point,normal)=>{
    const a=Math.atan2(point.x,point.z+.02),height=point.y-1.4,wave=identity.hair==='curly'?Math.sin(a*22+height*165)*Math.cos(height*160-a*3):Math.sin(a*34+height*55);
    return {p:point.clone().addScaledVector(normal,(beard?.00025:.0011)*wave),n:normal,tint:.91+wave*.07};
  };
  for(let i=0;i<p.count;i+=3){
    const points=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,i+j)),ns=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(n,i+j));
    for(const [a,b]of [[0,1],[1,2],[2,0]]){points.push(points[a].clone().add(points[b]).multiplyScalar(.5));ns.push(ns[a].clone().add(ns[b]).normalize());}
    for(const ids of [[0,3,5],[3,1,4],[5,4,2],[3,4,5]]){
      const tri=ids.map(j=>sculpt(points[j],ns[j])),face=new T.Vector3().subVectors(tri[1].p,tri[0].p).cross(new T.Vector3().subVectors(tri[2].p,tri[0].p)),average=tri[0].n.clone().add(tri[1].n).add(tri[2].n);
      // Tiny clipped triangles at the hairline may invert under an offset.
      // Correct their winding locally; keep all vertices and the closed cover.
      if(face.dot(average)<0)[tri[1],tri[2]]=[tri[2],tri[1]];
      for(const v of tri)vertex(v.p,v.n,v.tint);
    }
  }
  const candidates=new Map(),cell=beard?.009:.012;
  for(let i=0;i<p.count;i+=3){
    const point=new T.Vector3(),normal=new T.Vector3();for(let j=0;j<3;j++){point.add(new T.Vector3().fromBufferAttribute(p,i+j));normal.add(new T.Vector3().fromBufferAttribute(n,i+j));}point.multiplyScalar(1/3);normal.normalize();
    const key=[point.x,point.y,point.z].map(v=>Math.round(v/cell)).join(',');
    if(!candidates.has(key))candidates.set(key,{point,normal,seed:hash(...point.toArray())});
  }
  const limit=identity.hair==='bound'?0:beard?(quality==='performance'?48:100):(quality==='performance'?75:140);
  const locks=[...candidates.values()].sort((a,b)=>a.seed-b.seed).slice(0,limit);
  const ringCount=6,ringSides=6;
  for(const {point,normal,seed}of locks){
    const curled=identity.hair==='curly'&&!beard,side=point.x<0?-1:1;
    const flow=beard?new T.Vector3(side*.15,-1,.08):identity.hair==='swept'?new T.Vector3(.8,-.30,.5):identity.hair==='bound'?new T.Vector3(side*.18,-.25,-1):new T.Vector3(side*.25,-.35,.8);
    const tangent=flow.addScaledVector(normal,-flow.dot(normal));if(tangent.lengthSq()<.001)tangent.set(1,0,0).addScaledVector(normal,-normal.x);tangent.normalize();
    const cross=new T.Vector3().crossVectors(tangent,normal).normalize(),length=(beard?.006:curled?.018:.024)*(.75+seed*.5),width=(beard?.0011:curled?.007:.0052)*(.8+seed*.35),lift=beard?.001:curled?.0025:.0018;
    const rings=[];
    for(let j=0;j<=ringCount;j++){
      const t=j/ringCount,center=point.clone().addScaledVector(tangent,length*t).addScaledVector(normal,Math.sin(t*Math.PI)*lift-length*length*t*t/.19);
      if(curled)center.addScaledVector(cross,Math.sin(t*Math.PI*1.5)*.003);
      const taper=Math.max(.09,Math.sin((.19+t*.79)*Math.PI));const row=[];
      for(let k=0;k<=ringSides;k++){const angle=k/ringSides*Math.PI*2,nn=cross.clone().multiplyScalar(Math.cos(angle)).addScaledVector(normal,Math.sin(angle)*2).normalize();row.push({p:center.clone().addScaledVector(cross,Math.cos(angle)*width*taper).addScaledVector(normal,Math.sin(angle)*width*.4*taper+.0013),n:nn});}
      rings.push(row);
    }
    for(let j=0;j<ringCount;j++)for(let k=0;k<ringSides;k++)for(const [r,c]of [[j,k],[j+1,k],[j,k+1],[j,k+1],[j+1,k],[j+1,k+1]])vertex(rings[r][c].p,rings[r][c].n,.84+seed*.25);
  }
  const geometry=new T.BufferGeometry();for(const [key,array,size]of [['position',positions,3],['normal',normals,3],['uv',uvs,2],['color',colors,edgeDistance?4:3],['skinWeight',weights,4]])geometry.setAttribute(key,new T.Float32BufferAttribute(array,size));geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));geometry.computeBoundingSphere();geometry.userData={groom:true,locks:locks.length,beard};surface.dispose();return geometry;
}

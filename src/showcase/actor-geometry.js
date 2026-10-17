import * as T from '../../vendor/three/three.module.js';

// Shape-preserving cubic through garment landmarks. Smooth silhouettes matter
// at play distance; an extra row of tiny rivets does not.
export function smoothSection(rows,y,column){
  let i=0;while(i<rows.length-2&&rows[i+1][0]<y)i++;
  const a=rows[i],b=rows[i+1],h=b[0]-a[0],t=Math.max(0,Math.min(1,(y-a[0])/h));
  const value=r=>r[column]??0,slope=(l,r)=>(value(r)-value(l))/(r[0]-l[0]);
  const d=slope(a,b),tangent=(left,right)=>left*right<=0?0:2*left*right/(left+right);
  const m0=i?tangent(slope(rows[i-1],a),d):d,m1=i+2<rows.length?tangent(d,slope(b,rows[i+2])):d;
  return (2*t**3-3*t*t+1)*value(a)+(t**3-2*t*t+t)*h*m0+(-2*t**3+3*t*t)*value(b)+(t**3-t*t)*h*m1;
}

export function closeRadialNormals(geometry,columns,rows){
  geometry.computeVertexNormals();const n=geometry.attributes.normal;
  for(let j=0;j<rows;j++){const a=j*columns,b=a+columns-1,x=n.getX(a)+n.getX(b),y=n.getY(a)+n.getY(b),z=n.getZ(a)+n.getZ(b),length=Math.hypot(x,y,z)||1;n.setXYZ(a,x/length,y/length,z/length);n.setXYZ(b,x/length,y/length,z/length);}
  return geometry;
}

export function garmentGeometry(input,{segments=20,folds=0,foldCount=7,subdivisions=3,from=0,to=Math.PI*2}={}){
  const rings=input[0][0]<input.at(-1)[0]?input:[...input].reverse(),sections=[];
  for(let j=0;j<rings.length-1;j++)for(let q=0;q<subdivisions;q++)sections.push(rings[j][0]+(rings[j+1][0]-rings[j][0])*q/subdivisions);
  sections.push(rings.at(-1)[0]);const p=[],uv=[],indices=[];
  for(let j=0;j<sections.length;j++){
    const y=sections[j],rx=smoothSection(rings,y,1),rz=smoothSection(rings,y,2),zc=smoothSection(rings,y,3);
    for(let i=0;i<=segments;i++){
      const a=from+i/segments*(to-from),f=1+folds*(.7*Math.sin(a*foldCount+y*4)+.3*Math.sin(a*(foldCount-2)-y*6+.8));
      p.push(Math.sin(a)*rx*f,y,Math.cos(a)*rz*f+zc);uv.push(i/segments,(y-sections[0])/(sections.at(-1)-sections[0]));
      if(j&&i){const n=j*(segments+1)+i;indices.push(n,n-1,n-segments-1,n-1,n-segments-2,n-segments-1);}
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);
  const closed=Math.abs(to-from-Math.PI*2)<1e-8;
  if(closed)closeRadialNormals(g,segments+1,sections.length);else g.computeVertexNormals();
  g.userData={originalModel:'smooth-tailored-profile',radialColumns:segments+1,radialRows:sections.length,radialClosed:closed};return g;
}

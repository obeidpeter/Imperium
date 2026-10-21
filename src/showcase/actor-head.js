import * as T from '../../vendor/three/three.module.js';
import {smoothSection,closeRadialNormals} from './actor-geometry.js';
const gaussian=(x,y,cx,cy,rx,ry)=>Math.exp(-(((x-cx)/rx)**2+((y-cy)/ry)**2)*2);
const mix=(a,b,t)=>a+(b-a)*t;
// Chin, mandible, cheek, temple and crown are separate anatomical landmarks.
// The jaw is narrower than the skull; it is not a rounded box.
const skull=[[-.049,.026,.033,.040],[-.035,.047,.045,.030],[-.018,.061,.055,.021],[.008,.071,.065,.010],[.035,.080,.075,0],[.067,.089,.081,-.006],[.100,.094,.084,-.010],[.131,.096,.086,-.013],[.162,.092,.084,-.014],[.190,.079,.075,-.015],[.211,.052,.051,-.016],[.223,.001,.001,-.016]];
export function headPoint(a,y,id){
  const rx=smoothSection(skull,y,1),rz=smoothSection(skull,y,2),zc=smoothSection(skull,y,3),front=Math.max(0,Math.cos(a))**4;
  let x=Math.sin(a)*rx,z=Math.cos(a)*rz+zc;
  const jaw=Math.exp(-(((y+.012)/.043)**2)),cheek=Math.exp(-(((y-.061)/.037)**2));
  x*=1+(id.jaw-1)*jaw+(id.cheek-1)*cheek;
  const g=(cx,cy,sx,sy)=>gaussian(x,y,cx,cy,sx,sy);
  z+=front*(.032*id.nose*g(0,.061,.017,.059)+.035*id.nose*g(0,.038,.023,.019)
    +.011*g(.052,.060,.032,.032)+.011*g(-.052,.060,.032,.032)
    -.010*g(.037,.096,.026,.017)-.010*g(-.037,.096,.026,.017)
    +.009*id.brow*g(.034,.115,.032,.012)+.009*id.brow*g(-.034,.115,.032,.012)
    +.013*g(0,-.027,.035,.020)+.007*g(0,.006,.035,.013)-.004*g(0,.019,.010,.012)
    -.004*g(.040,.017,.014,.031)-.004*g(-.040,.017,.014,.031));
  if(id.age>32)z-=front*Math.min(.004,(id.age-32)*.00013)*(g(.046,.028,.010,.039)+g(-.046,.028,.010,.039));
  return [x,y,z];
}
// Fit eyelids/lips to the actual identity's skin, including three-quarter views.
export function faceSurfacePoint(x,y,id,offset=0){
  let lo=0,hi=Math.PI/2;for(let n=0;n<20;n++){const a=(lo+hi)/2;if(headPoint(a,y,id)[0]<Math.abs(x))lo=a;else hi=a;}
  const p=headPoint((lo+hi)/2*(x<0?-1:1),y,id);return [x,y,p[2]+offset];
}
export function createHeadGeometry(id,{detail=true}={}){
  const sides=detail?36:24,rows=detail?28:18,p=[],uv=[],color=[],idx=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=sides;i++){
    const y=mix(skull[0][0],skull.at(-1)[0],j/rows),a=i/sides*Math.PI*2,[x,,z]=headPoint(a,y,id),front=Math.max(0,Math.cos(a));p.push(x,y,z);uv.push(i/sides,j/rows);
    const cheek=(gaussian(x,y,.052,.052,.031,.030)+gaussian(x,y,-.052,.052,.031,.030))*front,stubble=id.beard*.13*Math.exp(-(((y+.014)/.041)**2))*front;
    const orbit=(gaussian(x,y,.037,.099,.026,.020)+gaussian(x,y,-.037,.099,.026,.020))*front;
    const crease=Math.min(.07,Math.max(0,id.age-28)*.0018)*front*(gaussian(x,y,.054,.091,.010,.023)+gaussian(x,y,-.054,.091,.010,.023));
    color.push(1-stubble-crease-orbit*.05,.985-cheek*.10-stubble-crease-orbit*.065,.955-cheek*.12-stubble-crease-orbit*.07);
    if(j&&i){const n=j*(sides+1)+i;idx.push(n,n-1,n-sides-1,n-1,n-sides-2,n-sides-1);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(color,3));g.setIndex(idx);closeRadialNormals(g,sides+1,rows+1);g.userData={originalModel:'continuous-landmark-head',identity:id.key,age:id.age};return g;
}
export function createHairGeometry(id,{detail=true,beard=false}={}){
  const sides=detail?30:20,rows=detail?12:8,p=[],uv=[],idx=[],colors=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=sides;i++){
    const a=i/sides*Math.PI*2,front=Math.max(0,Math.cos(a)),q=j/rows;
    const recession=id.hair==='receding'?.026:0,line=.068+front*(.071+recession)+.006*Math.sin(a*3+.3);
    const y=beard?mix(-.053,.017+.035*(1-front),q):mix(line,.227,q);
    const sampleY=Math.max(-.049,Math.min(.223,y)),v=headPoint(a,sampleY,id),wave=Math.sin(a*9+q*10)*Math.sin(q*9);
    const curl=id.hair==='curly'?.0055:id.hair==='wavy'?.004:.0012,spread=beard?.0025+id.beard*.007:.005+curl*wave;
    v[0]+=Math.sin(a)*spread;v[1]=y;v[2]+=Math.cos(a)*spread;
    if(beard){v[0]*=1.015;v[2]+=.004*front;}
    else {
      v[1]+=.008*Math.sin(q*Math.PI)+front*.005*Math.sin(q*Math.PI);
      if(id.hair==='swept'||id.hair==='wavy')v[0]+=.009*Math.sin(q*Math.PI)*front;
      if(id.hair==='long'){v[1]-=(1-q)**3*(1-front)*.145;v[2]-=(1-q)**2*.020;}
    }
    const strand=.88+.12*(.5+.5*Math.sin(a*23+q*7));colors.push(strand,strand,strand);p.push(...v);uv.push(i/sides,q);
    if(j&&i){const n=j*(sides+1)+i;idx.push(n,n-1,n-sides-1,n-1,n-sides-2,n-sides-1);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(idx);closeRadialNormals(g,sides+1,rows+1);return g;
}

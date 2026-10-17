import * as T from '../../vendor/three/three.module.js';
const gaussian=(x,y,cx,cy,rx,ry)=>Math.exp(-(((x-cx)/rx)**2+((y-cy)/ry)**2)*2);
const mix=(a,b,t)=>a+(b-a)*t;
const skull=[[-.049,.040,.049,.031],[-.028,.073,.066,.020],[.004,.091,.074,.008],[.034,.099,.080,.003],[.066,.108,.086,-.005],[.100,.108,.084,-.008],[.131,.108,.088,-.012],[.162,.101,.088,-.014],[.190,.085,.077,-.015],[.211,.058,.053,-.015],[.221,.004,.004,-.015]];
function ring(y){let i=1;while(i<skull.length-1&&skull[i][0]<y)i++;const a=skull[i-1],b=skull[i],t=(y-a[0])/(b[0]-a[0]);return a.map((n,k)=>mix(n,b[k],t));}
// One continuous original facial surface. Features modify the same topology;
// a projecting nose is not a separate wedge glued to a sphere.
export function headPoint(a,y,id){
  const [,rx,rz,zc]=ring(y),front=Math.max(0,Math.cos(a))**5;
  let x=Math.sin(a)*rx,z=Math.cos(a)*rz+zc;
  const jaw=Math.exp(-(((y+.008)/.053)**2)),cheek=Math.exp(-(((y-.064)/.038)**2));
  x*=1+(id.jaw-1)*jaw+(id.cheek-1)*cheek;
  const g=(cx,cy,sx,sy)=>gaussian(x,y,cx,cy,sx,sy);
  z+=front*(.033*id.nose*g(0,.052,.020,.062)+.030*id.nose*g(0,.034,.026,.020)
    +.010*g(.057,.057,.037,.035)+.010*g(-.057,.057,.037,.035)
    -.012*g(.044,.094,.030,.020)-.012*g(-.044,.094,.030,.020)
    +.008*id.brow*g(.040,.117,.039,.013)+.008*id.brow*g(-.040,.117,.039,.013)
    +.010*g(0,-.024,.042,.023)+.008*g(0,.007,.042,.014)-.003*g(0,.015,.011,.016));
  if(id.age>32)z-=front*Math.min(.004,(id.age-32)*.00013)*(g(.052,.024,.011,.045)+g(-.052,.024,.011,.045));
  return [x,y,z];
}
export function createHeadGeometry(id,{detail=true}={}){
  const sides=detail?40:24,rows=detail?28:18,p=[],uv=[],color=[],idx=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=sides;i++){
    const y=mix(skull[0][0],skull.at(-1)[0],j/rows),a=i/sides*Math.PI*2,[x,,z]=headPoint(a,y,id),front=Math.max(0,Math.cos(a));p.push(x,y,z);uv.push(i/sides,j/rows);
    const cheek=(gaussian(x,y,.061,.046,.038,.032)+gaussian(x,y,-.061,.046,.038,.032))*front,stubble=id.beard*.18*Math.exp(-(((y+.011)/.044)**2))*front;
    const crease=Math.min(.075,Math.max(0,id.age-28)*.002)*front*(gaussian(x,y,.06,.092,.012,.028)+gaussian(x,y,-.06,.092,.012,.028));
    color.push(1-stubble-crease,.98-cheek*.09-stubble-crease,.94-cheek*.105-stubble-crease);
    if(j&&i){const n=j*(sides+1)+i;idx.push(n,n-1,n-sides-1,n-1,n-sides-2,n-sides-1);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(color,3));g.setIndex(idx);g.computeVertexNormals();g.userData={originalModel:'continuous-landmark-head',identity:id.key,age:id.age};return g;
}
export function createHairGeometry(id,{detail=true,beard=false}={}){
  const sides=detail?32:20,rows=detail?10:7,p=[],uv=[],idx=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=sides;i++){
    const a=i/sides*Math.PI*2,front=Math.max(0,Math.cos(a)),q=j/rows;
    let y;if(beard)y=mix(-.053,.014+.022*(1-front),q);else {const recession=id.hair==='receding'?.027:0,line=.088+front*(.055+recession)+.007*Math.sin(a*3+.3);y=mix(line,.224,q);}
    const sampleY=Math.max(-.049,Math.min(.221,y)),v=headPoint(a,sampleY,id),curl=(id.hair==='curly'?.004:id.hair==='wavy'?.0025:.0008)*Math.sin(a*13+q*17)*Math.sin(q*11);
    const spread=beard?.003+id.beard*.007:.003+curl;
    v[0]+=Math.sin(a)*spread;v[1]=y;v[2]+=Math.cos(a)*spread;
    if(beard){v[0]*=1.025;v[2]+=.005*front;}
    if(id.hair==='long'&&!beard){v[1]-=(1-q)**3*(1-front)*.13;v[2]-=(1-q)**2*.012;}
    p.push(...v);uv.push(i/sides,q);if(j&&i){const n=j*(sides+1)+i;idx.push(n,n-1,n-sides-1,n-1,n-sides-2,n-sides-1);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}

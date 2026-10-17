import * as T from '../../vendor/three/three.module.js';

const TAU=Math.PI*2;
function geometry(positions,uv,colors,indices){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  if(colors.length)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
/** Fitted almond aperture, restrained corneal relief and a skin-weighted lid.
 * Coordinates belong to the existing head joint; no new pose/contact frame. */
export function actorEye({side=1,seed=0,identity={},facePoint}){
  const cx=side*.036,cy=.094,w=.0148,upper=.0045,lower=.0035;
  const sample=(x,y,offset=0)=>facePoint(x,y,offset),z=sample(cx,.104)[2]-.0011;
  const edge=(x,top)=>cy+(top?upper:-lower)*Math.max(0,1-(x/w)**2)**.7+side*x*.035;
  const surface=(x,y)=>z-.0024*(x/w)**2-.0005*((y-cy)/.005)**2;
  const p=[],uv=[],color=[],index=[];
  // A closed patch fills the socket without exposing a complete spherical eye.
  const rings=4,n=40;
  for(let j=0;j<=rings;j++)for(let i=0;i<=n;i++){
    const a=i/n*TAU,t=j/rings,x=Math.cos(a)*w*t,y=cy+(edge(Math.cos(a)*w,Math.sin(a)>=0)-cy)*t;
    p.push(cx+x,y,surface(x,y));uv.push(i/n,t);
    const shade=.80+.20*(1-t*t);color.push(shade,shade*.97,shade*.94);
    if(j&&i){const k=j*(n+1)+i;index.push(k-n-1,k-1,k,k-n-1,k-n-2,k-1);}
  }
  const sclera=geometry(p,uv,color,index),ip=[],iu=[],ic=[],ii=[],radii=[0,.0021,.00235,.0048,.0055];
  const irisColor=new T.Color(seed%5===0?0x515138:0x665039),pupil=new T.Color(0x090806);
  for(let j=0;j<radii.length;j++)for(let i=0;i<=n;i++){
    const a=i/n*TAU,dx=Math.cos(a),dy=Math.sin(a);let lo=0,hi=.0055;
    // Radial clipping preserves nested ring order where the curved lid meets the iris.
    for(let k=0;k<16;k++){const r=(lo+hi)/2,x=dx*r,y=cy+dy*r;if(y>=edge(x,false)+.00015&&y<=edge(x,true)-.00015)lo=r;else hi=r;}
    const r=Math.min(radii[j],lo),x=dx*r,y=cy+dy*r;
    ip.push(cx+x,y,surface(x,y)+.00018);iu.push(x/.011+.5,(y-cy)/.011+.5);
    const c=j<2?pupil:irisColor.clone().multiplyScalar(j===4?.43:.8+.18*Math.sin(i*7.2+seed));ic.push(c.r,c.g,c.b);
    if(j&&i){const k=j*(n+1)+i;ii.push(k-n-1,k-1,k,k-n-1,k-n-2,k-1);}
  }
  const iris=geometry(ip,iu,ic,ii),lids=[];
  for(const top of [true,false]){
    const lp=[],lu=[],li=[],cols=28,rows=4;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const t=i/cols,a=(t*2-1),blend=j/rows,x=a*(w+blend*.004),innerY=edge(a*w,top),outerY=cy+(top?1:-1)*(.004+.010*Math.sin(t*Math.PI)**.7)+side*x*.035,y=innerY*(1-blend)+outerY*blend;
      const outer=sample(cx+x,outerY,.00015),innerZ=surface(a*w,innerY)+.0005,tex=sample(cx+x,top?Math.max(y,.106):Math.min(y,.0865));
      lp.push(cx+x,y,innerZ*(1-blend)+outer[2]*blend);lu.push(...(tex.uv??[t,blend]));
      if(j&&i){const k=j*(cols+1)+i;const tri=top?[k-cols-1,k,k-1,k-cols-1,k-1,k-cols-2]:[k-cols-1,k-1,k,k-cols-1,k-cols-2,k-1];li.push(...tri);}
    }
    const lid=geometry(lp,lu,[],li);lid.setAttribute('lidWeight',new T.Float32BufferAttribute(Array.from({length:(rows+1)*(cols+1)},(_,i)=>{const x=((i%(cols+1))/cols*2-1)*w;return (1-Math.floor(i/(cols+1))/rows)*(edge(x,true)-edge(x,false))/(upper+lower);}),1));lid.userData.upper=top;lids.push(lid);
  }
  return {sclera,iris,upperLid:lids[0],lowerLid:lids[1],closeDistance:upper+lower-.0003};
}

/** Individually tapered brow hairs follow the surface instead of a dark tube. */
export function actorBrow({side=1,identity={},facePoint}){
  const p=[],uv=[],colors=[],weights=[],indices=[],count=identity.female?34:46;
  for(let i=0;i<count;i++)for(let row=0;row<2;row++){
    const t=(i+.5)/count,x=side*(.018+.043*t),arch=Math.sin(t*Math.PI),y=.112+.0045*arch-.002*t;
    const length=(identity.female?.002:.003)*(identity.brow??1)*(.55+.45*arch),width=.00034*(.35+.65*Math.sin(t*Math.PI)**.4),start=p.length/3,w=Math.max(0,Math.min(1,1.15-.85*t));
    for(let j=0;j<3;j++)for(const s of [-1,1]){
      const a=j/2,point=facePoint(x+side*length*a*.45+s*width*(1-a*.88),y+length*a-row*.0012,.00055);
      p.push(...point);uv.push(t,a);const tint=.6+.35*Math.sin(i*2.8)**2;colors.push(tint,tint*.98,tint*.96);weights.push(w);
    }
    for(let j=0;j<2;j++){const k=start+j*2;indices.push(k,k+1,k+3,k,k+3,k+2);}
  }
  const g=geometry(p,uv,colors,indices);g.setAttribute('browWeight',new T.Float32BufferAttribute(weights,1));return g;
}

/** Deterministic facial expression and bounded gaze offsets for head/brow/jaw/lid joints. */
export function actorExpression({motion='idle',phase=0,time=0,braced=false,defended=false,health=1,gazeYaw=0,gazePitch=0,seed=0,reducedMotion=false}={}){
  const p=Math.max(0,Math.min(1,Number.isFinite(phase)?phase:0)),t=reducedMotion?0:Number.isFinite(time)?Math.max(0,time):0;
  const speaking=['speak','conversation','rally','order'].includes(motion),commanding=['rally','order'].includes(motion);
  const combative=['attack','strike','throw'].includes(motion),guarded=['brace','formation','block'].includes(motion)||((braced||defended)&&motion!=='idle');
  const strained=['hit','hurt','withdrawn','dead'].includes(motion)||(motion!=='idle'&&health<.45),yielding=motion==='yield';
  const envelope=Math.sin(p*Math.PI),syllable=.55+.45*Math.sin((p*14+t*5.2+(seed%7)*.45)*Math.PI);
  const jawOpen=reducedMotion?0:speaking?Math.max(0,envelope*syllable*(commanding?1.2:1)):combative&&p>.18&&p<.62?Math.sin((p-.18)/.44*Math.PI)*.42:0;
  const browY=commanding?.0016*envelope:speaking?.0011*envelope:combative?-.0015*envelope:guarded?-.0011:strained?-.0014:yielding?.0008:0;
  const browTilt=commanding?.045*envelope:speaking?.03*envelope:combative?-.065*envelope:guarded?-.045:strained?.055:yielding?.04:0;
  const lidFocus=reducedMotion||motion==='idle'?0:combative?.16*envelope:guarded?.12:strained?.20:0;
  const headYawOffset=Math.max(-.32,Math.min(.32,Number.isFinite(gazeYaw)?gazeYaw:0));
  const headPitchOffset=Math.max(-.18,Math.min(.18,Number.isFinite(gazePitch)?gazePitch:0));
  return {jawOpen,browY,browTilt,lidFocus,headYawOffset,headPitchOffset};
}


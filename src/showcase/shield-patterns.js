import * as T from '../../vendor/three/three.module.js';

// Shield designs (worlds and gameplay plan, release 6), each faction's from its own evidence
// (docs/historical-research.md): Roman victory iconography, simplified from the painted
// shields of mid-third-century Dura-Europos; Germanic boards marked out only in colours
// (Tacitus, Germania 6); Persian shields of wickerwork and raw hide (Ammianus 24.6.8); and the
// Palmyrene round shield. A unit's design follows its identity, so a line and the followers
// drawn with it carry one design. Presentation only: nothing here reads or changes the rules.

// The convex oval face makeShield draws (actors.js), in normalised coordinates: u across, v up,
// the rim at u²+v²=1. Decals lie just over it, cut small enough to follow its curve: a flat
// triangle STEP across sags under a millimetre below the face, less than the decal's lift.
const RX=.257,RY=.392,CY=.03,LIFT=.0022,STEP=.25;
export const shieldFaceZ=(u,v)=>.019+.045*(1-Math.min(1,u*u+v*v));
export const shieldPoint=(u,v,lift=LIFT)=>[u*RX,v*RY+CY,shieldFaceZ(u,v)+lift];

const TAU=Math.PI*2;
const ellipse=(r,a)=>[r*Math.sin(a),r*Math.cos(a)];
// A band between two radii, from angle a0 to a1 (clockwise from the top).
// The face's height depends on the radius alone, so a band follows it exactly round its circle.
function band(r0,r1,a0=0,a1=TAU){const tris=[],n=Math.max(4,Math.ceil((a1-a0)/TAU*32)),rows=Math.max(1,Math.ceil((r1-r0)/STEP));
  for(let i=0;i<n;i++)for(let j=0;j<rows;j++){const t0=a0+(a1-a0)*i/n,t1=a0+(a1-a0)*(i+1)/n,q0=r0+(r1-r0)*j/rows,q1=r0+(r1-r0)*(j+1)/rows;
    const a=ellipse(q0,t0),b=ellipse(q1,t0),c=ellipse(q1,t1),d=ellipse(q0,t1);tris.push([a,b,c]);if(q0)tris.push([a,c,d]);}
  return tris;}
// A lens: a leaf or petal from `from` to `to`, `width` across at its middle.
function lens([x0,y0],[x1,y1],width,steps=4){const dx=x1-x0,dy=y1-y0,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,pts=[];
  for(let i=0;i<=steps;i++){const t=i/steps,w=Math.sin(t*Math.PI)*width/2;pts.push([x0+dx*t+nx*w,y0+dy*t+ny*w]);}
  for(let i=steps-1;i>0;i--){const t=i/steps,w=Math.sin(t*Math.PI)*width/2;pts.push([x0+dx*t-nx*w,y0+dy*t-ny*w]);}
  return polygon(pts);}
// Any simple polygon, triangulated and its long edges halved until none is longer than STEP.
function polygon(points){const contour=points.map(([x,y])=>new T.Vector2(x,y));if(T.ShapeUtils.isClockWise(contour))contour.reverse();
  const tris=T.ShapeUtils.triangulateShape(contour,[]).map(t=>t.map(i=>[contour[i].x,contour[i].y]));return tris.flatMap(subdivide);}
function subdivide(t){
  const edge=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]),lengths=[edge(t[0],t[1]),edge(t[1],t[2]),edge(t[2],t[0])],k=lengths.indexOf(Math.max(...lengths));
  if(lengths[k]<=STEP)return [t];const a=t[k],b=t[(k+1)%3],c=t[(k+2)%3],m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  return [...subdivide([a,m,c]),...subdivide([m,b,c])];}
const mirror=tris=>tris.map(([a,b,c])=>[[-a[0],a[1]],[-c[0],c[1]],[-b[0],b[1]]]);
const both=tris=>[...tris,...mirror(tris)];
// The game's earlier emblems (metres from the face's centre), as halves mirrored about the boss.
const metres=points=>points.map(([x,y])=>[x/RX,y/RY]);
const WINGS=metres([[.025,.1],[.055,.21],[.08,.13],[.19,.25],[.12,.11],[.18,.08],[.07,.055]]);
const CHEVRON=metres([[.04,.09],[.18,.20],[.18,.25],[.04,.14]]);
const BARS=metres([[.045,.13],[.20,.13],[.20,.165],[.045,.165]]);

// Each design's parts: the paint each takes (motif, field or dark) and its triangles in
// normalised coordinates. `base` repaints the shield's own face.
const DESIGNS={
  // Roman: the laurel, Victory's rays and rosettes of the period's victory iconography.
  wreath:()=>[{paint:'motif',tris:[...Array.from({length:16},(_,i)=>{const a=(i+.5)/16*TAU,r=.58,lean=.09*(i%2?1:-1);
    return lens(ellipse(r,a-.15),ellipse(r+lean,a+.15),.09);}).flat(),...band(.9,.935)]}],
  rosette:()=>[{paint:'motif',tris:[...Array.from({length:8},(_,i)=>{const a=i/8*TAU;return lens(ellipse(.27,a),ellipse(.64,a),.2);}).flat(),...band(.88,.92)]}],
  rings:()=>[{paint:'motif',tris:[...band(.4,.47),...band(.78,.86)]}],
  rays:()=>[{paint:'motif',tris:Array.from({length:10},(_,i)=>{const a=i/10*TAU,s=.035/.6;return polygon([ellipse(.28,a-s*1.6),ellipse(.86,a-s*.6),ellipse(.86,a+s*.6),ellipse(.28,a+s*1.6)]);}).flat()}],
  wings:()=>[{paint:'motif',tris:both(polygon(WINGS))}],
  // The named men's own: Lucan's sun over the wings, Sabinus's chevron, Varro's bars.
  sun:()=>[{paint:'motif',tris:[...both(polygon(WINGS)),...both([1,2,3].flatMap(i=>{const a=i*Math.PI/4;return lens(ellipse(.42,a),ellipse(.74,a),.05);}))]}],
  chevron:()=>[{paint:'motif',tris:both(polygon(CHEVRON))}],
  bars:()=>[{paint:'motif',tris:both(polygon(BARS))}],
  // Germanic boards, marked out only in colours: halves, quarters, a broad band or a rim.
  halved:()=>[{paint:'field',tris:band(0,.97,Math.PI,TAU)}],
  quartered:()=>[{paint:'field',tris:[...band(0,.97,0,Math.PI/2),...band(0,.97,Math.PI,Math.PI*1.5)]}],
  ringed:()=>[{paint:'field',tris:band(.6,.97)}],
  rimmed:()=>[{paint:'field',tris:band(.86,.97)},{paint:'dark',tris:band(.3,.34)}],
  // Persian wickerwork under raw hide: the hide's colour, the withies' rings showing through.
  wicker:()=>[{paint:'field',tris:[.42,.64,.86].flatMap(r=>band(r,r+.04))}],
  // The Palmyrene round shield: a rosette or a ringed border.
  'round-rosette':()=>[{paint:'motif',tris:[...Array.from({length:6},(_,i)=>{const a=i/6*TAU;return lens(ellipse(.27,a),ellipse(.6,a),.24);}).flat(),...band(.84,.9)]}],
  'round-rings':()=>[{paint:'dark',tris:[...band(.5,.56),...band(.86,.93)]}]
};
export const SHIELD_DESIGNS=Object.freeze(Object.keys(DESIGNS));
const FACTION_DESIGNS={Roman:['wreath','rosette','rings','rays','wings'],Gothic:['halved','quartered','ringed','rimmed'],Persian:['wicker'],Palmyrene:['round-rosette','round-rings']};
const NAMED={lucan:'sun',sabinus:'chevron',varro:'bars'};
// Germanic field colours: red and yellow ochre, soot black, chalk and a woad blue-grey.
const FIELDS=[0x8a3b26,0xa8843c,0x2d2722,0xcdbf9c,0x4c5b66];
const HIDE=0x9a7d56,WITHY=0x6b5338;

/** The design a figure's shield carries: its id, and the colours it paints (field, and the
 * shield's own face where the design repaints it). Deterministic from the figure's kit. */
export function shieldDesign(kit={},identity={}){
  const seed=Number(kit.identity)>>>0;
  if(NAMED[identity.key])return {id:NAMED[identity.key]};
  if(kit.hero)return {id:'wreath'};
  const designs=FACTION_DESIGNS[kit.faction]??FACTION_DESIGNS.Roman,id=designs[(seed>>>3)%designs.length];
  if(kit.faction==='Persian')return {id,base:HIDE,field:WITHY};
  if(kit.faction==='Gothic'){const field=FIELDS[(seed>>>7)%FIELDS.length];return {id,field};}
  return {id};
}

/** A design's decals over the shield face, in the shield's own coordinates (metres), each
 * with the paint it takes. The caller owns the geometry. */
export function shieldDecals(id){
  const parts=(DESIGNS[id]??DESIGNS.wings)();
  return parts.map(({paint,tris})=>{
    const position=[],normal=[],uv=[],index=[],shared=new Map();
    const vertex=(u,v)=>{
      const r=Math.hypot(u,v),k=r>.985?.985/r:1,key=`${(u*k).toFixed(5)},${(v*k).toFixed(5)}`;
      if(shared.has(key))return shared.get(key);
      const [x,y,z]=shieldPoint(u*k,v*k),n=new T.Vector3(.09*x/(RX*RX),.09*(y-CY)/(RY*RY),1).normalize();
      position.push(x,y,z);normal.push(n.x,n.y,n.z);uv.push(.5+u*k*.5,.5+v*k*.5);shared.set(key,shared.size);return shared.size-1;
    };
    for(const tri of tris){
      const [a,b,c]=tri,area=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
      for(const [u,v]of area<0?[a,c,b]:tri)index.push(vertex(u,v));
    }
    // The face's own normal, so a decal shades with the curve it lies on.
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normal,3));
    geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(index);geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.shieldDesign=id;
    return {paint,geometry};
  });
}

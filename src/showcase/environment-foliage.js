import * as T from '../../vendor/three/three.module.js';
import {hash} from './environment-layout.js';

export const FOLIAGE_ATLAS_URL=new URL('../../assets/showcase/foliage-v016.webp',import.meta.url);
export const FOLIAGE_CELLS=Object.freeze({oak:0,willow:1,palm:2,meadow:3});

// The generated atlas is optional. This original, deterministic leaf/twig
// raster makes the same cutout geometry usable offline or after a failed load.
// Pixel rows are bottom-up to match the UVs of an ordinary TextureLoader map.
export function createFoliagePixels(size=512){
  const bytes=new Uint8Array(size*size*4),cell=size/2;let clip=[0,0,size,size];
  function oval(cx,cy,rx,ry,angle,color){
    const ca=Math.cos(angle),sa=Math.sin(angle),reach=Math.max(rx,ry)+1;
    for(let y=Math.max(clip[1],Math.floor(cy-reach));y<=Math.min(clip[3]-1,Math.ceil(cy+reach));y++)for(let x=Math.max(clip[0],Math.floor(cx-reach));x<=Math.min(clip[2]-1,Math.ceil(cx+reach));x++){
      const dx=x-cx,dy=y-cy,u=(dx*ca+dy*sa)/rx,v=(-dx*sa+dy*ca)/ry,d=u*u+v*v;if(d>1)continue;
      const i=((size-1-y)*size+x)*4,alpha=Math.min(255,(1-d)*1600);if(alpha<bytes[i+3])continue;
      const vein=1-Math.min(1,Math.abs(u)*8),shade=.84+(1-v)*.10+vein*.09;
      for(let c=0;c<3;c++)bytes[i+c]=Math.min(255,color[c]*shade);bytes[i+3]=alpha;
    }
  }
  function line(ax,ay,bx,by,r,color){const count=Math.ceil(Math.hypot(bx-ax,by-ay));for(let i=0;i<=count;i++){const t=i/Math.max(1,count);oval(ax+(bx-ax)*t,ay+(by-ay)*t,r,r,0,color);}}
  for(const [kind,index]of Object.entries(FOLIAGE_CELLS)){
    const ox=index%2*cell,oy=Math.floor(index/2)*cell,point=(x,y)=>[ox+x*cell,oy+y*cell];
    const margin=Math.ceil(cell*.035);clip=[ox+margin,oy+margin,ox+cell-margin,oy+cell-margin];
    const stem=(ax,ay,bx,by,r=.005)=>line(...point(ax,ay),...point(bx,by),cell*r,[107,102,66]);
    if(kind==='oak'){
      stem(.48,.89,.51,.16,.011);
      for(let b=0;b<9;b++){
        const side=b%2?1:-1,t=.20+b*.066,cx=.50+side*(.13+hash(b,1)*.18),cy=t-.09;
        stem(.50,t+.13,cx,cy,.006);
        for(let j=0;j<9;j++){const x=cx+(hash(j,b,2)-.5)*.23,y=cy+(hash(b,j,3)-.5)*.17;oval(...point(x,y),cell*(.024+hash(j,b)*.019),cell*(.045+hash(b,j)*.027),side*.45+(hash(j,b,4)-.5)*1.1,[93+hash(j,b)*45,117+hash(b,j)*41,52+hash(j,b,8)*31]);}
      }
    }else if(kind==='willow'){
      for(let b=0;b<7;b++){const x=.20+b*.095,top=.12+hash(b,7)*.15,end=.78+hash(b,8)*.12;stem(x,top,x+.10,end,.004);
        for(let j=0;j<13;j++){const t=j/13,side=j%2?1:-1;oval(...point(x+.10*t+side*.028,top+(end-top)*t),cell*.014,cell*.065,-side*.45,[99+hash(j,b)*35,128+hash(b,j)*30,66+hash(b,j,4)*27]);}
      }
    }else if(kind==='palm'){
      stem(.15,.80,.86,.19,.008);
      for(let j=0;j<20;j++)for(const side of [-1,1]){const t=(j+1)/22,x=.15+.71*t,y=.8-.61*t,w=Math.sin(t*Math.PI)*.20;stem(x,y,x+side*w*.75,y+side*w,.003);oval(...point(x+side*w*.43,y+side*w*.56),cell*.011,cell*w*.70,-.60,[88+hash(j,side)*27,119+hash(side,j)*27,53+hash(j,side,9)*24]);}
    }else{
      for(let b=0;b<7;b++){const a=(b-3)*.28,tx=.5+Math.sin(a)*.32,ty=.2+Math.abs(a)*.20;stem(.50,.88,tx,ty,.004);
        for(let j=1;j<10;j++)for(const side of [-1,1]){const t=j/11,x=.5+(tx-.5)*t,y=.88+(ty-.88)*t;oval(...point(x+side*(1-t)*.06,y),cell*(1-t)*.032,cell*(1-t)*.073,side*.9,[75+hash(b,j)*33,113+hash(j,b)*32,48+hash(j,b,4)*28]);}
      }
    }
  }
  return bytes;
}

// Curved sprays, not whole-tree billboards. Each instanced surface has several
// bent rows, lighting normals and UVs confined to one padded atlas cell.
export function createFoliageSprayGeometry(kind='oak'){
  const cell=FOLIAGE_CELLS[kind]??0,positions=[],uv=[],indices=[],rows=4,cols=3;
  const u0=cell%2*.5+.009,v0=1-Math.floor(cell/2)*.5-.009;
  for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){
    const u=x/cols,t=y/rows;
    if(kind==='palm'){
      // The atlas rachis runs from bottom-left to top-right. Rotate that
      // diagonal into a radial, arched 3D frond with its stem at the crown.
      const along=(u-.03+t-.02)*Math.SQRT1_2,across=(t-.02-u+.03)*Math.SQRT1_2;
      positions.push(along*.94,Math.sin(along*Math.PI*.75)*.19-along*along*.29,across*.72);
    }else positions.push(u-.5,t,Math.sin(t*Math.PI)*.16+Math.sin(u*Math.PI)*.10+(u-.5)*t*.11);
    uv.push(u0+u*.482,v0-(1-t)*.482);
    if(y<rows&&x<cols){const a=y*(cols+1)+x;indices.push(a,a+1,a+cols+1,a+1,a+cols+2,a+cols+1);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}

// Normalized rooted branch with an irregular cross-section, flare and taper.
// Reuse three shapes with instance transforms; no unique mesh for every twig.
export function createNaturalBranchGeometry(variant=0,radial=10){
  const positions=[],uv=[],indices=[],rings=9;
  for(let y=0;y<=rings;y++)for(let k=0;k<=radial;k++){
    const t=y/rings,a=k/radial*Math.PI*2,flare=1+Math.exp(-t*19)*.47,r=(1-t*.78)*flare*(1+Math.sin(a*5+variant)*.08),bend=.13*Math.sin(t*2.1+variant*.7)-.13*Math.sin(variant*.7);
    positions.push(Math.cos(a)*r+bend,t,Math.sin(a)*r+.065*Math.sin(t*3+variant)*t);uv.push(k/radial,t*4);
    if(y<rings&&k<radial){const j=y*(radial+1)+k;indices.push(j,j+radial+1,j+1,j+1,j+radial+1,j+radial+2);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}

// planter: a loaded tree kit (tree-kit.js). Trees of the species it holds are planted
// from it instead; the code-built forms below stay for the rest and for Performance.
export function createVegetationFactory({p,m,instance,height,quality,planter=null}){
  const perf=quality==='performance',high=quality==='high',sprays=Object.fromEntries(Object.keys(FOLIAGE_CELLS).map(k=>[k,p.geo(createFoliageSprayGeometry(k))])),limbs=[0,1,2].map(v=>p.geo(createNaturalBranchGeometry(v,perf?8:10)));
  const color=(seed,light=1)=>new T.Color().setRGB((.85+hash(seed,3)*.15)*light,(.88+hash(seed,4)*.12)*light,(.75+hash(seed,5)*.21)*light);
  function limb(a,b,r,seed){const av=new T.Vector3(...a),bv=new T.Vector3(...b),delta=bv.sub(av),rot=new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize()));instance(`natural bark ${seed%3}`,limbs[seed%3],m.bark,a,[r,delta.length(),r],[rot.x,rot.y,rot.z]);}
  function spray(kind,name,x,y,z,scale,rotation,seed){instance(name,sprays[kind],m.foliage,[x,y,z],scale,rotation,color(seed));}
  const planted=(kind,x,z,h,seed)=>planter?.has(kind)&&planter.plant(kind,{x,y:height(x,z)-.05,z,height:h,seed});
  function tree(kind,x,z,h,seed=0){
    if(planted(kind,x,z,h,seed))return;
    if(kind==='palm')return palm(x,z,h,seed);
    if(kind==='cypress')return cypress(x,z,h,seed);
    if(kind==='pine'||kind==='fir')return conifer(kind,x,z,h,seed);
    const form={beech:{width:1.1,crown:.94},alder:{width:.72,crown:1.02},poplar:{width:.48,crown:1.15},umbrella:{width:1.40,crown:.80},olive:{width:1.12,crown:.72},tamarisk:{width:1.05,crown:.69}}[kind]??{width:1,crown:1};
    const base=height(x,z),willow=kind==='willow',leafKind=willow||kind==='tamarisk'?'willow':'oak',lean=(hash(seed,8)-.5)*.9,stem=[x+lean,base+h*.68*form.crown,z+.20];
    limb([x,base-.08,z],stem,.28+hash(seed,10)*.09,seed,'natural tree trunk');
    for(let k=0;k<4;k++){const a=k*2.399+seed,xx=x+Math.cos(a)*1.15,zz=z+Math.sin(a)*1.15;limb([x,base+.38,z],[xx,height(xx,zz)-.05,zz],.16,seed+k,'root flare');}
    const branches=willow?7:kind==='poplar'?6:8;
    for(let k=0;k<branches;k++){
      const a=k*2.399+seed*.83,reach=h*(.19+hash(seed,k,51)*.13)*form.width,cy=base+h*(.70+hash(k,seed,54)*.21)*form.crown,cx=x+lean+Math.cos(a)*reach,cz=z+Math.sin(a)*reach;
      limb([stem[0],base+h*(.35+k*.032),stem[2]],[cx,cy,cz],.11+hash(k,seed)*.045,seed+k,'natural tree bough');
      // Readable branch clusters with air between sprays. Dense overlapping
      // cutouts made the foreground glitter and hid the branch silhouette.
      const count=perf?6:high?16:11;
      for(let j=0;j<count;j++){
        const angle=j*2.399+hash(seed,k)*3,r=Math.sqrt((j+.6)/count)*h*(willow?.16:.18),px=cx+Math.cos(angle)*r,pz=cz+Math.sin(angle)*r;
        const py=cy+(hash(j,k,seed)-.5)*h*.13,s=h*(willow?.20:.17)*(1+hash(j,k,19)*.25);
        spray(leafKind,leafKind==='willow'?'willow leaves':'oak leaves',px,willow?py-s:py-s*.3,pz,[s*(willow?.66:form.width),s*(kind==='umbrella'?.65:1),s],willow?[.12,angle,(hash(j,k)-.5)*.38]:[(hash(j,k,7)-.5)*1.2,angle,(hash(k,j,9)-.5)*1.15],seed+k*71+j);
      }
      if(!perf){const end=[cx+Math.cos(a+.6)*.7,cy+.35,cz+Math.sin(a+.6)*.7];limb([cx,cy,cz],end,.043,seed+k+2,'canopy twigs');}
    }
  }
  function palm(x,z,h=5.5,seed=0){
    if(planted('palm',x,z,h,seed))return;
    const base=height(x,z),lean=.30+hash(x,z)*.35;
    limb([x,base,z],[x+lean,base+h,z+.13],.22,seed,'date palm stem');
    const count=perf?12:high?24:19;
    for(let j=0;j<count;j++){const a=j*2.399+seed,scale=2.8+hash(j,seed)*.8,tier=j%3;
      spray('palm','palm fronds',x+lean,base+h-.18,z+.13,[scale,scale,scale],[(hash(j,seed,9)-.5)*.21,a,.16-tier*.16+(hash(j,seed,4)-.5)*.16],seed+j);
    }
  }
  function cypress(x,z,h=6,seed=0){
    if(planted('cypress',x,z,h,seed))return;
    const base=height(x,z);limb([x,base,z],[x+.12,base+h*.93,z],.13,seed,'cypress stem');
    for(let tier=0;tier<8;tier++)for(let j=0;j<(perf?3:high?7:5);j++){
      const a=j*2.399+tier*.8,r=(1-tier/9)*.45,s=(1-tier/10)*1.45;
      spray('oak','cypress foliage',x+Math.cos(a)*r,base+h*(.16+tier*.093),z+Math.sin(a)*r,[s*.67,s,s*.67],[.10,a,(hash(j,tier)-.5)*.35],seed+tier*9+j);
    }
  }
  function conifer(kind,x,z,h=7,seed=0){
    if(planted(kind,x,z,h,seed))return;
    const base=height(x,z),tiers=kind==='fir'?8:6;
    limb([x,base,z],[x+.10,base+h,z],.17,seed);
    for(let tier=0;tier<tiers;tier++){
      const t=tier/tiers,cy=base+h*(.23+t*.72),radius=h*(kind==='fir'?.24:.28)*(1-t*.83),count=perf?4:high?9:7;
      for(let j=0;j<count;j++){
        const a=j*Math.PI*2/count+tier*.72,xx=x+Math.cos(a)*radius*.7,zz=z+Math.sin(a)*radius*.7;
        if(j%2===0)limb([x,cy+.18,z],[xx,cy-radius*.12,zz],.045*(1-t*.5),seed+tier+j);
        spray('oak','oak leaves',xx,cy-radius*.25,zz,[radius*.95,radius*.72,radius*.95],[.65,a,.28],seed+tier*17+j);
      }
    }
  }
  return {tree,palm,cypress,conifer,sprays,spray,limb};
}

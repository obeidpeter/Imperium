import * as T from '../../vendor/three/three.module.js';
import {createMasonryBlockGeometry} from './environment-primitives.js';
import {finishEnvironmentMaterial} from './environment-surface-shaders.js';
import {regionalEnvironment} from './environment-regions.js';

/** Original small fieldwork. Opaque detail merges by material and never
 * participates in picking. World-space grain survives transformed batching. */
export function createFieldworkKit({chapter=1,quality='balanced',geometries=new Set(),materials=new Set(),finish=null}={}){
  const region=regionalEnvironment(chapter),segments=quality==='performance'?8:12;
  const own=g=>(geometries.add(g),g);
  // finish: the stage lights field objects as it lights the scenery around them.
  const material=(name,color,surface,metalness=0)=>{
    const m=new T.MeshStandardMaterial({color,roughness:metalness?.61:.88,metalness});
    m.name=`fieldwork ${name}`;finishEnvironmentMaterial(m,surface,{arid:[5,6,9].includes(chapter),wet:[2,8].includes(chapter)});finish?.(m);materials.add(m);return m;
  };
  const m={
    wood:material('wood',region.wood,'wood'),dark:material('end grain',region.darkWood,'wood'),
    stone:material('footings',region.stone,'stone'),cloth:material('canvas',region.cloth,'cloth'),
    masonry:material('fortified masonry',[5,6,9].includes(chapter)?'#987451':'#827b69','stone'),
    accent:material('standard',region.accent,'cloth'),rope:material('rope','#a99773','cloth'),
    iron:material('iron','#444943','stone',.65),bronze:material('bronze','#ad8d4e','stone',.72),
    coal:material('charcoal','#302d28','stone')
  };
  const box=own(createMasonryBlockGeometry()),cylinder=own(new T.CylinderGeometry(1,1,1,segments));
  const sphere=own(new T.SphereGeometry(1,segments,8)),wheel=own(new T.TorusGeometry(.31,.035,6,segments*2));
  const spike=own(new T.ConeGeometry(.045,.18,5));
  const sack=own(new T.LatheGeometry([[.08,0],[.20,.04],[.25,.17],[.24,.34],[.18,.45],[.06,.5],[.07,.55]].map(v=>new T.Vector2(...v)),segments));
  const bowl=own(new T.LatheGeometry([[.06,0],[.22,.04],[.35,.16],[.37,.22],[.32,.23],[.30,.17],[.19,.08],[.06,.06]].map(v=>new T.Vector2(...v)),segments*2));
  function mesh(parent,g,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1){
    const o=new T.Mesh(g,mat);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
  }
  const plank=(g,x,y,z,sx,sy,sz,mat=m.wood)=>mesh(g,box,mat,x,y,z,sx,sy,sz);
  // Cloth seen from both sides: a reversed copy keeps the shared materials single-sided.
  const reversed=g=>{const r=own(g.clone()),index=r.index.array,n=r.attributes.normal;for(let i=0;i<index.length;i+=3)[index[i+1],index[i+2]]=[index[i+2],index[i+1]];for(let i=0;i<n.count;i++)n.setXYZ(i,-n.getX(i),-n.getY(i),-n.getZ(i));return r;};
  function beam(g,a,b,r,mat=m.wood){
    const start=new T.Vector3(...a),end=new T.Vector3(...b),length=start.distanceTo(end);
    const o=mesh(g,cylinder,mat,...start.clone().add(end).multiplyScalar(.5).toArray(),r,length,r);
    o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.sub(start).normalize());return o;
  }
  const group=(parent,x=0,y=0,z=0)=>{const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;};
  function binding(g,x,y,z,axis='y',radius=.09){
    for(let i=-1;i<=1;i++){const ring=mesh(g,cylinder,m.rope,x,y,z,radius,.025,radius);ring.position[axis]+=i*.035;
      if(axis==='x')ring.rotation.z=Math.PI/2;else if(axis==='z')ring.rotation.x=Math.PI/2;}
  }
  function gate(g,state){
    for(const side of [-1,1]){
      const z=side*1.03;plank(g,0,.11,z,.32,.22,.34,m.stone);plank(g,0,1.06,z,.18,1.98,.18,m.dark);
      for(const y of [.48,1.47]){plank(g,.105,y,z,.045,.17,.25,m.iron);beam(g,[.13,y-.12,z],[.13,y+.12,z],.036,m.bronze);}
      const leaf=group(g,0,0,side*.95);leaf.name=`${side<0?'north':'south'} gate leaf`;leaf.rotation.y=state==='open'?side*Math.PI/2:0;
      for(let i=0;i<6;i++)plank(leaf,0,.96,-side*(i+.5)*.15,.105,1.62,.137);
      for(const y of [.43,1.42])plank(leaf,.068,y,-side*.45,.055,.13,.92,m.dark);
      beam(leaf,[.074,.45,-side*.08],[.074,1.38,-side*.84],.035,m.dark);
      for(const y of [.43,1.42])for(const z of [.12,.45,.78])mesh(leaf,sphere,m.iron,.103,y,-side*z,.024,.024,.024);
    }
    plank(g,0,2.05,0,.24,.18,2.35,m.dark);plank(g,0,2.17,0,.33,.075,2.43);
    if(state!=='open')plank(g,.12,.98,0,.10,.12,1.90,m.dark);
  }
  function bridge(g,state,{left=0,right=0}={}){
    const deck=x=>left+(right-left)*(x+1.35)/2.7+.08;
    for(const z of [-.65,.65])beam(g,[-1.38,deck(-1.35)-.13,z],[1.38,deck(1.35)-.13,z],.075,m.dark);
    for(let i=0;i<14;i++){
      const x=(i-6.5)*.195;if(state==='damaged'&&i>=5&&i<=8)continue;
      const board=plank(g,x,deck(x),0,.184,.10,1.52);board.rotation.z=Math.atan2(right-left,2.7);
      for(const z of [-.61,.61])mesh(g,cylinder,m.iron,x,deck(x)+.055,z,.016,.012,.016);
    }
    if(state==='damaged')for(const side of [-1,1]){
      const broken=plank(g,side*.40,deck(side*.4)-.13,side*.24,.46,.07,.60,m.dark);broken.rotation.z=-side*.44;broken.rotation.y=side*.2;
    }
    for(const z of [-.83,.83]){
      for(const x of [-1.16,1.16]){const y=deck(x);beam(g,[x,y-.2,z],[x,y+.76,z],.05,m.dark);binding(g,x,y+.63,z,'y',.065);}
      beam(g,[-1.16,deck(-1.16)+.65,z],[0,deck(0)+.56,z],.018,m.rope);
      beam(g,[0,deck(0)+.56,z],[1.16,deck(1.16)+.65,z],.018,m.rope);
    }
  }
  function barricade(g,state){
    if(state==='intact'){
      for(const x of [-.67,.67]){beam(g,[x,0,-.42],[x,.93,.30],.066,m.dark);beam(g,[x,0,.42],[x,.93,-.30],.066,m.dark);binding(g,x,.53,0,'x',.095);}
      beam(g,[-.98,.6,0],[.98,.6,0],.075);
      for(let i=0;i<7;i++){const x=(i-3)*.28;beam(g,[x,.14,.27],[x,.88,-.27],.045);mesh(g,spike,m.dark,x,.94,-.315).rotation.x=-.6;}
    }else for(let i=0;i<5;i++){const o=plank(g,(i-2)*.30,.06+(i%2)*.03,(i%2-.5)*.22,.9,.10,.13,i%2?m.wood:m.dark);o.rotation.y=(i-2)*.42;}
  }
  function stores(g,state){
    for(const x of [-.43,.43]){
      beam(g,[x,.34,-.64],[x,.34,.64],.045,m.iron);
      for(const z of [-.57,.57]){
        mesh(g,wheel,m.dark,x,.34,z);mesh(g,wheel,m.iron,x,.34,z,1.075,1.075,.78).name='forged wheel tyre';
        beam(g,[x,.34,z-.07],[x,.34,z+.07],.055,m.iron);
        for(let i=0;i<8;i++){const a=i*Math.PI/4;beam(g,[x,.34,z],[x+Math.cos(a)*.28,.34+Math.sin(a)*.28,z],.017);}
      }
    }
    for(let i=0;i<6;i++)plank(g,(i-2.5)*.205,.57,0,.194,.09,.94,m.dark);
    for(const z of [-.48,.48]){for(const x of [-.56,.56])plank(g,x,.79,z,.07,.58,.07,m.dark);for(const y of [.72,.91])plank(g,0,y,z,1.22,.105,.055);}
    for(const z of [-.29,.29])beam(g,[-.58,.54,z],[-1.14,.37,z],.035,m.dark);
    if(state==='available'){
      for(const [x,z,scale]of [[-.33,-.20,.8],[.16,.18,.9],[.37,-.22,.72]]){mesh(g,sack,m.cloth,x,.63,z,scale,scale,scale);binding(g,x,.63+.52*scale,z,'y',.065*scale);}
      plank(g,-.25,1.10,.18,.46,.045,.34,m.accent).rotation.z=-.16;
    }else for(const x of [-.34,.12,.39])plank(g,x,.64,.03,.23,.025,.19,m.cloth);
  }
  function signal(g,state){
    plank(g,0,.09,0,.44,.18,.44,m.stone);beam(g,[0,.1,0],[0,2.26,0],.035,m.dark);
    beam(g,[-.36,2.05,0],[.36,2.05,0],.025,m.bronze);mesh(g,sphere,m.bronze,0,2.29,0,.065,.10,.065);
    const cloth=own(new T.PlaneGeometry(.65,.66,6,8)),a=cloth.attributes.position;
    for(let i=0;i<a.count;i++){const y=a.getY(i),x=a.getX(i);a.setZ(i,.055*Math.sin(x*11+y*5)*(.34-y));a.setY(i,y-.035*Math.sin(x*9));}cloth.computeVertexNormals();
    for(const face of [cloth,reversed(cloth)])mesh(g,face,state==='secured'?m.bronze:m.accent,0,1.69,.02);
    for(const x of [-.22,0,.22])plank(g,x,1.31,.02,.075,.13,.035,state==='secured'?m.bronze:m.accent);
    mesh(g,cylinder,m.bronze,0,1.77,.055,.105,.024,.105).rotation.x=Math.PI/2;
  }
  function brazier(g,state){
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3,x=Math.cos(a),z=Math.sin(a);beam(g,[x*.26,0,z*.26],[x*.18,.65,z*.18],.033,m.iron);beam(g,[0,.30,0],[x*.22,.30,z*.22],.018,m.iron);}
    mesh(g,bowl,m.iron,0,.59,0);
    for(let i=0;i<7;i++)mesh(g,sphere,state==='spent'?m.stone:m.coal,Math.cos(i*2.4)*.18,.68,Math.sin(i*2.4)*.18,.09,.065,.075);
  }
  function breach(g,state,orientation){
    if(orientation==='horizontal')g.rotation.y=Math.PI/2;
    if(state==='breached'){
      // The centre is crossed on slow rubble; keep every fragment below boots.
      for(let i=0;i<12;i++){const b=plank(g,((i*7)%11-5)*.19,.05+(i%3)*.025,((i*5)%9-4)*.23,.27+(i%3)*.09,.10,.24,m.stone);b.rotation.y=i*1.71;}
      return;
    }
    plank(g,0,1.6,0,1.65,3.2,2.5,m.masonry);
    for(let row=0;row<8;row++)for(const side of [-1,1])plank(g,side*.835,.2+row*.4,0,.025,.025,2.5,m.dark);
    for(const z of [-.84,0,.84])plank(g,0,3.48,z,1.55,.56,.48,m.masonry);
    for(const z of [-.75,.75])beam(g,[-1.45,.1,z],[-.85,1.45,z],.075,m.wood);
    plank(g,-.91,.76,0,.08,.13,1.75,m.wood);
  }
  function siegeWork(g,object){
    const disabled=object.state==='disabled';
    if(object.kind==='countermine'){
      for(const z of [-.55,.55]){plank(g,-.45,.55,z,.15,1.1,.16,m.dark);plank(g,.45,.55,z,.15,1.1,.16,m.dark);plank(g,0,1.12,z,1.2,.16,.2);}
      for(let i=0;i<5;i++)plank(g,(i-2)*.23,1.23,0,.2,.08,1.4);
      for(let i=0;i<6;i++)mesh(g,sphere,m.stone,(i%3-.9)*.36,.08,Math.floor(i/3)*.35-.25,.23,.10,.2);
      if(disabled)for(const y of [.25,.5,.75])plank(g,-.56,y,0,.10,.2,1.12);
    }else{
      for(const z of [-.65,.65]){beam(g,[-1.1,.12,z],[1.1,1.2,z],.08,m.dark);plank(g,.95,.58,z,.15,1.16,.15,m.dark);}
      for(let i=0;i<12;i++){const x=-1.05+i*.19,b=plank(g,x,.15+(x+1.05)*.48,0,.18,.08,1.48,disabled?m.coal:m.wood);b.rotation.z=.45;if(disabled&&i%3===0)b.rotation.y=.35;}
      for(const z of [-.8,.8])beam(g,[-1.1,.45,z],[1.1,1.6,z],.025,m.rope);
      if(!disabled){plank(g,.85,1.65,0,.12,.9,1.5,m.wood);plank(g,.79,1.65,0,.02,.43,.62,m.accent);}
    }
    if(!disabled)for(let i=0;i<(object.progress??0);i++)plank(g,-.8,.12+i*.08,-.95,.6,.06,.12,m.wood);
  }
  function build(parent,object,ground){
    const g=group(parent,ground.x,ground.y,ground.z);g.name=`${object.kind} · ${object.state}`;
    if(object.kind==='gate')gate(g,object.state);
    else if(object.kind==='bridge')bridge(g,object.state,{left:ground.left-ground.y,right:ground.right-ground.y});
    else if(object.kind==='barricade')barricade(g,object.state);
    else if(object.kind==='stores')stores(g,object.state);
    else if(object.kind==='signal')signal(g,object.state);
    else if(object.kind==='brazier')brazier(g,object.state);
    else if(object.kind==='breach')breach(g,object.state,object.orientation);
    else if(object.kind==='countermine'||object.kind==='siege-engine')siegeWork(g,object);
    g.userData.fieldObject={id:object.id,kind:object.kind,state:object.state};return g;
  }
  function platform(parent,record,point,step){
    const g=group(parent,point.x,point.y,point.z);g.name='accessible wall fighting platform';
    const dx=(point.x-step.x)/2.5,dz=(point.z-step.z)/2.5;
    plank(g,0,record.height/2,0,2.44,record.height,2.44,m.masonry);
    plank(g,0,record.height+.025,0,2.5,.05,2.5,m.masonry);
    for(let row=0;row<6;row++)for(let block=0;block<3;block++)for(const side of [-1,1]){
      const along=(block-1)*.81,y=(row+.5)*record.height/6;
      plank(g,along,y,side*1.23,.78,record.height/6-.035,.085,m.masonry);
      plank(g,side*1.23,y,along,.085,record.height/6-.035,.78,m.masonry);
    }
    // A small fighting tower with a clear stair entrance, low parapets and
    // raised corner merlons. Its walkable deck is exactly the saved elevation.
    for(const side of [-1,1]){
      plank(g,-dz*side*1.12,record.height+.2,dx*side*1.12,dx?2.5:.25,.4,dz?2.5:.25,m.masonry);
      for(const along of [-.95,.95])plank(g,dx*along-dz*side*1.12,record.height+.55,dz*along+dx*side*1.12,.4,.3,.4,m.masonry);
    }
    plank(g,dx*1.12,record.height+.2,dz*1.12,dx?.25:2.5,.4,dz?.25:2.5,m.masonry);
    for(const y of [.55,1.1,1.65,2.2,2.75])plank(g,dx*1.255,y,dz*1.255,dx?.012:2.5,.025,dz?.012:2.5,m.dark);
    for(let i=0;i<10;i++){
      const distance=3.75-(i+.5)*.25,h=(i+1)*record.height/10;
      plank(g,-dx*distance,h/2,-dz*distance,dx?.25:2.4,h,dz?.25:2.4,m.masonry);
    }
    for(const side of [-1,1])for(const distance of [1.4,3.6]){
      const h=(3.75-distance)/2.5*record.height;
      beam(g,[-dx*distance-dz*side*1.16,h,-dz*distance+dx*side*1.16],[-dx*distance-dz*side*1.16,h+.8,-dz*distance+dx*side*1.16],.035,m.wood);
    }
    for(const side of [-1,1])beam(g,[-dx*3.6-dz*side*1.16,.99,-dz*3.6+dx*side*1.16],[-dx*1.4-dz*side*1.16,record.height+.61,-dz*1.4+dx*side*1.16],.025,m.rope);
    return {x:point.x,z:point.z,base:point.y,height:record.height,dx,dz};
  }
  return {build,platform,region};
}

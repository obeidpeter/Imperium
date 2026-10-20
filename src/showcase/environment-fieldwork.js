import * as T from '../../vendor/three/three.module.js';
import {createMasonryBlockGeometry} from './environment-primitives.js';
import {finishEnvironmentMaterial} from './environment-surface-shaders.js';
import {regionalEnvironment} from './environment-regions.js';

/** Original small fieldwork. Opaque detail merges by material and never
 * participates in picking. World-space grain survives transformed batching. */
export function createFieldworkKit({chapter=1,quality='balanced',geometries=new Set(),materials=new Set()}={}){
  const region=regionalEnvironment(chapter),segments=quality==='performance'?8:12;
  const own=g=>(geometries.add(g),g);
  const material=(name,color,finish,metalness=0)=>{
    const m=new T.MeshStandardMaterial({color,roughness:metalness?.61:.88,metalness});
    m.name=`fieldwork ${name}`;finishEnvironmentMaterial(m,finish,{arid:[5,6,9].includes(chapter),wet:[2,8].includes(chapter)});materials.add(m);return m;
  };
  const m={
    wood:material('wood',region.wood,'wood'),dark:material('end grain',region.darkWood,'wood'),
    stone:material('footings',region.stone,'stone'),cloth:material('canvas',region.cloth,'cloth'),
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
    const flag=mesh(g,cloth,state==='secured'?m.bronze:m.accent,0,1.69,.02);flag.material.side=T.DoubleSide;
    for(const x of [-.22,0,.22])plank(g,x,1.31,.02,.075,.13,.035,state==='secured'?m.bronze:m.accent);
    mesh(g,cylinder,m.bronze,0,1.77,.055,.105,.024,.105).rotation.x=Math.PI/2;
  }
  function brazier(g,state){
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3,x=Math.cos(a),z=Math.sin(a);beam(g,[x*.26,0,z*.26],[x*.18,.65,z*.18],.033,m.iron);beam(g,[0,.30,0],[x*.22,.30,z*.22],.018,m.iron);}
    mesh(g,bowl,m.iron,0,.59,0);
    for(let i=0;i<7;i++)mesh(g,sphere,state==='spent'?m.stone:m.coal,Math.cos(i*2.4)*.18,.68,Math.sin(i*2.4)*.18,.09,.065,.075);
  }
  function build(parent,object,ground){
    const g=group(parent,ground.x,ground.y,ground.z);g.name=`${object.kind} · ${object.state}`;
    if(object.kind==='gate')gate(g,object.state);
    else if(object.kind==='bridge')bridge(g,object.state,{left:ground.left-ground.y,right:ground.right-ground.y});
    else if(object.kind==='barricade')barricade(g,object.state);
    else if(object.kind==='stores')stores(g,object.state);
    else if(object.kind==='signal')signal(g,object.state);
    else if(object.kind==='brazier')brazier(g,object.state);
    g.userData.fieldObject={id:object.id,kind:object.kind,state:object.state};return g;
  }
  return {build,region};
}

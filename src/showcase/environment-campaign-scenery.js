import * as THREE from '../../vendor/three/three.module.js';
import {hash,terrainAt,gridToWorld,isPlayable} from './environment-layout.js';
import {createPalmFrondGeometry,createColumnGeometry} from './environment-primitives.js';

// Scene landmarks occupy the perimeter. The small reeds are soft vegetation,
// not collision objects; the game continues to own every legal destination.
export function addCampaignScenery(ctx){
  const {root,e,p,m,profile,height,tileSize,quality,instance,branch}=ctx,hx=e.width*tileSize/2,hz=e.height*tileSize/2,perf=quality==='performance';
  const landmarks=[];root.userData.environmentLandmarks=landmarks;
  const landmark=(name,group)=>{group.name=name;landmarks.push(name);return group;};
  const place=(name,x,z)=>landmark(name,p.group(root,x,height(x,z),z));
  const columnGeo=p.geo(createColumnGeometry());
  const column=(parent,x,z,scale=1)=>{const col=p.mesh(parent,columnGeo,m.marble,x,0,z,scale,scale,scale);p.plank(parent,x,4.50*scale,z,.96*scale,.13*scale,.96*scale,m.marble);return col;};
  function tiledRoof(g,w,d,y){
    for(const side of [-1,1])for(let row=0;row<4;row++)for(let col=0;col<Math.ceil(d/.8);col++){const f=(row+.5)/4,mesh=p.plank(g,side*f*w/2,y+(1-f)*1.15,(col-(Math.ceil(d/.8)-1)/2)*.8,w/8+.10,.10,.79,m.terra);mesh.rotation.z=-side*Math.atan(2.3/w);}
  }
  function building(name,x,z,w,d,{columns=false,roof=true,brick=false}={}){
    const g=place(name,x,z),mat=brick?m.brick:m.stone;p.plank(g,0,.20,0,w+.7,.4,d+.7,mat);
    for(const side of [-1,1])p.plank(g,side*(w/2-.14),2.0,0,.28,3.6,d,mat);
    p.plank(g,0,2.0,-d/2+.14,w,3.6,.28,mat);
    if(columns)for(let i=0;i<4;i++)column(g,(i-1.5)*w/4,d/2+.2,.85);
    if(roof)tiledRoof(g,w+1,d+1,3.8);return g;
  }
  function arch(g,x,y,z,w=3.0,h=4.2,depth=.55){
    const r=w/2,R=r+.42,segments=11;
    // Radial stone courses have real narrow joints and a slightly proud
    // keystone, rather than an unbroken extruded half-ring.
    for(let i=0;i<segments;i++){
      const a=i*Math.PI/segments+.005,b=(i+1)*Math.PI/segments-.005,outer=R+(i===5?.045:0),shape=new THREE.Shape();
      shape.moveTo(Math.cos(a)*outer,Math.sin(a)*outer);shape.absarc(0,0,outer,a,b,false);shape.lineTo(Math.cos(b)*r,Math.sin(b)*r);shape.absarc(0,0,r,b,a,true);shape.closePath();
      const geo=p.geo(new THREE.ExtrudeGeometry(shape,{depth:depth+(i===5?.045:0),bevelEnabled:false,curveSegments:2}));p.mesh(g,geo,m.stone,x,y+h-r,z-depth/2);
    }
    for(const side of [-1,1])for(let row=0;row<Math.ceil((h-r)/.53);row++){const rows=Math.ceil((h-r)/.53),blockH=(h-r)/rows;p.plank(g,x+side*(r+.21),y+(row+.5)*blockH,z,.42,blockH-.012,depth,m.stone);}
  }
  function perimeterWall(name,x,z,w,h=4.6){const g=place(name,x,z);for(let row=0;row<Math.ceil(h/.46);row++)for(let k=0;k<Math.ceil(w/.95);k++)p.plank(g,(k-(Math.ceil(w/.95)-1)/2)*.95+(row%2?.25:0),.23+row*.46,0,.93,.44,.64,profile.setting==='siege'?m.brick:m.stone);return g;}
  function pier(name,x,z,length=5){const g=place(name,x,z);for(let k=0;k<Math.ceil(length/.25);k++)p.plank(g,0,.13,(k-(Math.ceil(length/.25)-1)/2)*.25,2.1,.15,.23,m.wood);for(const xx of [-.95,.95])for(const zz of [-length/2,0,length/2])p.beam(g,[xx,-1.6,zz],[xx,.7,zz],.095);return g;}
  function boat(name,x,z,y=-1.18){const g=landmark(name,p.group(root,x,y,z,.18));const hull=p.geo(new THREE.SphereGeometry(1,20,10,0,Math.PI*2,Math.PI/2,Math.PI/2));p.mesh(g,hull,m.wood,0,0,0,1.03,.65,3.6);
    for(const side of [-1,1])p.beam(g,[side*.90,0,-2.6],[side*.9,0,2.6],.07);for(let k=-2;k<=2;k++)p.plank(g,0,-.08,k*.83,1.72,.1,.25,m.wood);p.beam(g,[.15,0,0],[.15,4.6,0],.05);p.beam(g,[.15,3.9,-1.9],[.15,3.9,1.9],.045);const sail=p.mesh(g,p.geo(new THREE.PlaneGeometry(3.6,2.8,8,8)),m.cloth,.16,2.45,0);sail.rotation.y=Math.PI/2;return g;}
  function well(x,z){const g=place('stone well and water jars',x,z);const ring=p.geo(new THREE.CylinderGeometry(.95,.95,.65,24,1,true));p.mesh(g,ring,m.stone,0,.35,0);p.mesh(g,p.geo(new THREE.CircleGeometry(.88,24)),m.charcoal,0,.06,0).rotation.x=-Math.PI/2;for(const side of [-1,1])p.beam(g,[side*1.1,0,0],[side*1.1,2.4,0],.085);p.beam(g,[-1.2,2.4,0],[1.2,2.4,0],.11);p.beam(g,[0,2.4,0],[0,.2,0],.014,m.rope);p.amphora(g,1.5,0,.8,.7);return g;}
  let palmLeaf=null;
  function palm(x,z,h=5.5){
    const y=height(x,z),lean=.32+hash(x,z,82)*.38,trunk=p.geo(new THREE.CylinderGeometry(.12,.24,h,12,12)),v=trunk.attributes.position,g=place('date palm',x,z);
    for(let i=0;i<v.count;i++){const t=(v.getY(i)+h/2)/h,ridge=1+Math.sin(t*h*19)*.035;v.setXYZ(i,v.getX(i)*ridge+lean*t*t,v.getY(i),v.getZ(i)*ridge+Math.sin(t*Math.PI)*.13);}trunk.computeVertexNormals();p.mesh(g,trunk,m.wood,0,h/2,0);
    if(!palmLeaf)palmLeaf=p.geo(createPalmFrondGeometry());
    for(let j=0;j<11;j++){const scale=.82+hash(j,x,z)*.30;instance('palm fronds',palmLeaf,m.leaves,[x+lean,y+h,z],[scale,scale,scale],[(hash(j,z)-.5)*.24,j*2.399,(hash(j,x)-.5)*.12],new THREE.Color(.77+hash(j,8)*.2,.85+hash(j,4)*.12,.63+hash(j,9)*.25));}
    return g;
  }
  function cypress(x,z,h=6){const g=place('Italian cypress',x,z);p.mesh(g,p.cylinder,m.wood,0,h*.25,0,.11,h*.5,.11);for(let k=0;k<6;k++)p.mesh(g,p.sphere,m.leaves,(hash(k,x)-.5)*.2,h*(.40+k*.085),0,.70-k*.07,.90,.62-k*.06);return g;}

  if(profile.architecture==='marsh'){
    pier('damaged marsh landing',hx+3,1,6);const boatGroup=boat('abandoned shallow-draft river boat',hx+4,7,-.02);boatGroup.scale.setScalar(.7);
    const rack=place('retreating column supplies',-hx-3,6);p.crate(rack,0,0,0,.75);p.amphora(rack,1.1,0,.5,.6);p.plank(rack,0,.1,-1.1,2.8,.12,.32,m.darkWood);
    const reed=p.geo(new THREE.CylinderGeometry(.007,.016,1,5)),head=p.geo(new THREE.CylinderGeometry(.033,.042,.22,6));
    for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++)if(terrainAt(e,x,y)==='marsh'){
      const point=gridToWorld({x,y},e,tileSize);for(let k=0;k<(perf?5:11);k++){const side=k%4,xx=point.x+(side<2?-.86:.86)+(hash(k,x,y)-.5)*.25,zz=point.z+(side%2?-.82:.82)+(hash(y,k,x)-.5)*.23,h=.44+hash(x,k,y)*.63;
        instance('marsh reed stems',reed,m.dryGrass,[xx,height(xx,zz)+h/2,zz],[1,h,1],[.04,0,.08]);if(k%3===0)instance('cattail heads',head,m.darkWood,[xx+.03,height(xx,zz)+h,zz],[1,1,1]);}
    }
    const willowLeaf=p.geo(new THREE.BufferGeometry());willowLeaf.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.05,-.12,.01,0,-.38,.035,.05,-.12,.01,0,-.13,.055],3));willowLeaf.setIndex([0,1,4,1,2,4,2,3,4,3,0,4]);willowLeaf.computeVertexNormals();
    for(const [index,[x,z,h]]of [[-14,-8,5.4],[15,-11,4.6],[-7,15,6.1],[15,10,4.7]].entries()){
      const y=height(x,z),leanX=.4+hash(index,21)*.7,leanZ=(hash(index,22)-.5)*1.1;
      branch([x,y,z],[x+leanX*.3,y+h*.48,z+leanZ*.3],.24,'willow trunks',m.darkWood);branch([x+leanX*.3,y+h*.48,z+leanZ*.3],[x+leanX,y+h*.86,z+leanZ],.16,'willow upper trunks',m.darkWood);
      for(let k=0;k<5;k++){const a=k*1.71+index*.91+hash(k,index)*.7,reach=1.3+hash(index,k,51)*2.0,cx=x+leanX+Math.cos(a)*reach,cz=z+leanZ+Math.sin(a)*reach,cy=y+h*(.67+hash(index,k)*.23);
        branch([x+leanX*.6,y+h*(.48+k*.045),z+leanZ*.6],[cx,cy,cz],.055+(k===0?.018:0),'willow boughs',m.darkWood);
        for(let j=0;j<(perf?8:15);j++){const xx=cx+(hash(j,k,index)-.5)*1.65,zz=cz+(hash(k,j,index)-.5)*1.65,length=.8+hash(j,k,6)*1.9;branch([xx,cy,zz],[xx+.18,cy-length,zz+.09],.007,'willow hanging twigs',m.darkWood);
          for(let n=0;n<7;n++){const t=n/7;instance('willow leaves',willowLeaf,m.leaves,[xx+.18*t+(hash(n,j,k)-.5)*.18,cy-length*t,zz+.09*t],[1.15,1.15,1.15],[.1,hash(n,k,index)*6.28,.15],new THREE.Color(.66+hash(n,j)*.20,.77+hash(n,k)*.17,.55+hash(j,k)*.18));}}
      }
      branch([x+leanX*.35,y+h*.50,z],[x-.55-index*.10,y+h*.63,z-.12],.065,'broken willow limb',m.darkWood);
    }landmarks.push('asymmetric willow canopy and flooded causeway');
  }else if(profile.architecture==='road-station'){
    building('plague-struck courier station',-hx-5,-2,7,7,{columns:true});const stores=building('sealed road-station archive',hx+4,-hz-3,5,4,{roof:false});p.crate(stores,0,.42,0,.9);p.amphora(stores,1.4,.42,0,.8);well(hx+3,5);
    const fence=place('station timber boundary',0,-hz-2);for(let x=-6;x<=6;x+=1.5){p.beam(fence,[x,0,0],[x,1.1,0],.055);if(x<6)p.beam(fence,[x,.7,0],[x+1.5,.7,0],.03);}p.banner(root,-hx-1.8,height(-hx-1.8,7),7);
  }else if(profile.architecture==='stone-fort'||profile.architecture==='eastern-fort'){
    const east=profile.architecture==='eastern-fort';perimeterWall(east?'Euphrates siege curtain':'Danube fortress curtain',0,-hz-3,27,east?5:4.3);
    for(const side of [-1,1]){const g=building(east?'mudbrick siege tower':'stone gate tower',side*(hx+2.7),-hz-2.8,4.2,4.2,{roof:false,brick:east});for(let j=0;j<4;j++)p.plank(g,(j-1.5)*1.04,4.3,2.0,.70,.85,.55,east?m.brick:m.stone);}
    const gate=place('fortress arched gate',-hx-3,2);gate.rotation.y=Math.PI/2;arch(gate,0,0,0,4.1,5.2);
    if(east){const mine=place('besiegers timber mine entrance',hx+4,5);for(const z of [-1,0,1]){p.beam(mine,[-.8,0,z],[-.8,1.65,z],.10);p.beam(mine,[.8,0,z],[.8,1.65,z],.10);p.beam(mine,[-.9,1.7,z],[.9,1.7,z],.12);}p.plank(mine,0,.8,1.2,1.5,1.6,.15,m.charcoal);p.crate(mine,1.8,0,0,.65);}else pier('ford watch landing',hx+3,5,5);
  }else if(profile.architecture==='desert-camp'){
    well(-hx-3,1);for(const [x,z,r]of [[hx+5,-5,.3],[-hx-6,-hz-2,-.2],[4,-hz-5,.1]])p.tent(root,x,height(x,z),z,.85,r);
    const st=place('abandoned eagle escort stores',hx+3,6);p.crate(st,0,0,0,.8);p.amphora(st,1.1,0,0,.8);p.amphora(st,-.6,0,.8,.6);p.beam(st,[-1,.2,-.5],[1.1,.4,.5],.035);for(const [x,z]of [[-15,-12],[15,10],[19,-9]])palm(x,z);
  }else if(profile.architecture==='legion-camp'){
    for(const side of [-1,1])for(let row=0;row<3;row++){const x=side*(hx+6),z=(row-1)*7;p.tent(root,x,height(x,z),z,.9,side*Math.PI/2);}landmarks.push('ordered legionary tent streets');
    for(const x of [-7,0,7]){cypress(x,-hz-6);p.banner(root,x,height(x,-hz-2),-hz-2);}const store=place('legion baggage park',hx+3,8);p.crate(store,0,0,0,1);p.crate(store,0,1.0,0,.6);
  }else if(profile.architecture==='ferry'){
    pier('Dacian evacuation quay',-hx-3,2,8);boat('evacuation river ferry',-3,-24);boat('grain and household boat',7,-25);for(const x of [-4,0,4]){const g=place('river crossing pier',x,-hz-3);p.plank(g,0,.25,0,.85,.5,2.2,m.stone);}
    const stores=place('household evacuation bundles',hx+3,5);for(let i=0;i<5;i++)p.crate(stores,(i%2)*1.2,0,Math.floor(i/2),.65);p.tent(root,-hx-6,height(-hx-6,-7),-7,.9,.3);
  }else if(profile.architecture==='colonnaded-city'){
    const gate=place('eastern city triumphal approach',0,-hz-5);for(const x of [-5,0,5])arch(gate,x,0,0,3.3,5.4);p.plank(gate,0,5.7,0,15.7,.60,.85,m.stone);
    for(const side of [-1,1]){const g=place('Palmyrene colonnade',side*(hx+2.8),0);for(let z=-8;z<=8;z+=4)column(g,0,z,1.05);p.plank(g,0,4.9,0,1.05,.45,18,m.marble);}
    for(const [x,z]of [[-16,-11],[17,-9],[16,10]])palm(x,z,6.2);
  }else if(profile.architecture==='granary'){
    const store=building('provincial raised granary',-hx-5,0,7,9,{columns:true});for(let i=0;i<7;i++)p.amphora(store,(i%3-1)*1.2,.45,(Math.floor(i/3)-1)*1.3,.65);well(hx+3,7);
    for(const side of [-1,1])for(let row=0;row<5;row++)for(let k=0;k<12;k++){const x=side*(hx+3+row*.6),z=-8+k*1.3,h=.45+hash(row,k)*.24;branch([x,height(x,z),z],[x,height(x,z)+h,z],.009,'provincial cereal rows',m.dryGrass);}landmarks.push('cultivated grain terraces');pier('provincial grain landing',hx+4,-4,6);
  }else if(profile.architecture==='imperial-road'){
    const gate=place('Aurelian wall and imperial road gate',0,-hz-5);for(const x of [-6,0,6])arch(gate,x,0,0,4,5.6);p.plank(gate,0,6,0,19,.7,.9,m.brick);
    for(const side of [-1,1]){building('rival army gatehouse',side*(hx+4),-hz-4,4.5,5,{roof:false,brick:true});for(const z of [-6,4])p.banner(root,side*(hx+2),height(side*(hx+2),z),z);}p.tent(root,-hx-7,height(-hx-7,5),5,1.1,.1);landmarks.push('opposed imperial standards');
  }

  if(profile.civic){
    const title=profile.architecture,g=landmark(title.replaceAll('-',' '),p.group(root,0,0,0));
    if(title==='command-council'){
      for(const side of [-1,1])p.tent(root,side*(hx+6),height(side*(hx+6),0),0,1.2,side*Math.PI/2);
      for(const x of [-7,0,7])p.banner(root,x,0,-hz-2.6);for(const side of [-1,1]){p.plank(g,side*(hx+1.9),.68,0,.70,.18,15,m.wood);for(const z of [-6,0,6])p.plank(g,side*(hx+1.9),.3,z,.20,.6,.5,m.wood);}landmarks.push('officers open-air council benches');
    }else if(title==='river-parley'){
      pier('negotiation landing',-hx-3,0,8);for(const side of [-1,1])p.tent(root,side*(hx+6),height(side*(hx+6),0),0,.8,side*Math.PI/2);boat('delegates river boat',3,-24);landmarks.push('opposed riverside delegations');
    }else{
      const imperial=title==='imperial-court',senate=title==='senate';
      for(const side of [-1,1]){for(const z of [-8,-4,0,4,8])column(g,side*(hx+1.9),z,1.25);p.plank(g,side*(hx+1.9),5.9,0,1.25,.48,e.height*tileSize+2,m.marble);}
      for(const x of [-7,-3.5,0,3.5,7])arch(g,x,0,-hz-2.65,2.5,4.6,.3);
      const daisZ=-hz-1.6;for(let k=0;k<3;k++)p.plank(g,0,.1+k*.13,daisZ-k*.4,7-k*.6,.2,1.0,m.marble);
      for(const side of [-1,1]){const banner=p.banner(root,side*7,0,-hz-2);banner.scale.setScalar(.85);}
      if(imperial){const chair=place('imperial curule seat',0,-hz-3.0);p.plank(chair,0,.7,0,1.15,.20,.85,m.brass);for(const s of [-1,1]){p.beam(chair,[s*.5,0,-.4],[-s*.5,.8,-.4],.045,m.brass);p.beam(chair,[s*.5,0,.4],[-s*.5,.8,.4],.045,m.brass);}landmarks.push('purple accession dais');}
      if(title==='provincial-tribunal'){const archive=place('governor archive shelves',-hx-4,-6);for(const y of [.4,1.1,1.8]){p.plank(archive,0,y,0,3,.12,.8,m.wood);for(let i=0;i<7;i++){const roll=p.mesh(archive,p.cylinder,m.cloth,(i-3)*.36,y+.17,0,.12,.55,.12);roll.rotation.x=Math.PI/2;}}landmarks.push('provincial civic audience');}
    }
  }
  return {landmarks};
}

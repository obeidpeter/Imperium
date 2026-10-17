import * as THREE from '../../vendor/three/three.module.js';
import {stagingEdge} from './environment-staging.js';
import {hash} from './environment-layout.js';

/** Connected precincts sit beyond the rule board. Repeated structural parts
 * use the existing material/geometry batches; nothing is a picking target. */
export function addEncounterPrecinct({root,e,p,m,profile,height,tileSize,quality}){
  const staging=profile.staging,perf=quality==='performance',high=quality==='high',landmarks=root.userData.environmentLandmarks;
  const precinct=p.group(root,0,0,0);precinct.name=staging.title;precinct.userData.encounterPrecinct=true;
  root.userData.encounterStaging=staging;landmarks.push(staging.title);
  const structures=[];
  const atEdge=(edge,offset=4.5)=>{const a=stagingEdge(e,edge,tileSize,offset),g=p.group(precinct,a.x,height(a.x,a.z),a.z,a.angle);g.userData.stagingEdge=edge;return g;};
  const solid=(name,g)=>{g.name=name;structures.push(g);return g;};
  const pillar=(g,x,z,h=3.7,mat=m.stone)=>{
    p.plank(g,x,.16,z,.94,.32,.94,mat);p.mesh(g,p.cylinder,mat,x,h*.5+.26,z,.29,h-.38,.29);p.plank(g,x,h,z,.91,.23,.91,mat);
  };
  // Curved masonry has an actual open aperture, rather than a painted doorway.
  const archGeo=p.geo(new THREE.RingGeometry(2.35,2.78,perf?10:18,1,0,Math.PI));
  const arch=(g,h=5.4,mat=m.stone)=>{
    const rise=h-2.78;for(const x of [-2.56,2.56]){p.plank(g,x,rise/2,0,.50,rise,.85,mat);p.plank(g,x,.15,0,.85,.30,1.1,mat);}
    // Ring is solid on both sides and has shallow depth at its outer rim.
    for(const dz of [-.32,.32]){const a=p.mesh(g,archGeo,mat,0,rise,dz);if(dz<0)a.rotation.y=Math.PI;}
    const n=perf?10:18;for(let i=0;i<n;i++){const a=(i+.5)/n*Math.PI,block=p.plank(g,Math.cos(a)*2.57,rise+Math.sin(a)*2.57,0,.46,.46,.66,mat);block.rotation.z=a-Math.PI/2;}
    p.plank(g,0,h+.10,0,6.4,.28,1.0,mat);
  };
  const porch=(parent,x,z,w=5,d=4,kind='stone')=>{
    const g=p.group(parent,x,0,z),mat=kind==='timber'?m.wood:m.stone;
    p.plank(g,0,.08,0,w,.16,d,mat);
    for(const xx of [-w/2+.35,w/2-.35])for(const zz of [-d/2+.35,d/2-.35])kind==='timber'?p.beam(g,[xx,0,zz],[xx,3.5,zz],.14,m.wood):pillar(g,xx,zz,3.5,mat);
    p.plank(g,0,3.72,0,w+.6,.28,d+.6,kind==='timber'?m.wood:m.terra);
    for(const side of [-1,1]){const roof=p.plank(g,0,4.05,side*d*.255,w+.9,.16,d*.57,kind==='timber'?m.wood:m.terra);roof.rotation.x=side*.24;}
    p.plank(g,0,1.45,d/2-.14,w,2.8,.28,kind==='timber'?m.darkWood:m.plaster);return g;
  };
  const wallBay=(parent,x,z,w,h=2.8,mat=m.stone)=>{p.plank(parent,x,h/2,z,w,h,.48,mat);p.plank(parent,x,h+.09,z,w+.10,.18,.72,mat);};
  const loading=(g,x,z,n=3)=>{for(let i=0;i<n;i++){p.crate(g,x+(i%2)*.88,0,z+Math.floor(i/2)*.92,.73);if(!perf&&i<2)p.amphora(g,x-1,0,z+i*.65,.58);}};
  const tiedPosts=(g,width=10,depth=3)=>{
    for(const side of [-1,1])for(let j=0;j<3;j++){const x=side*(width/2),z=(j-1)*depth;p.beam(g,[x,0,z],[x,1.25,z],.08,m.wood);if(j<2)p.beam(g,[x,1.05,z],[x,1.05,z+depth],.025,m.rope);}
  };
  const coveredCart=(g,x,z)=>{const wagon=p.wagon(g,x,0,z,Math.PI/2);for(const u of [-.8,.8])p.beam(wagon,[u,.8,-1],[u,2.1,-1],.045,m.wood);p.plank(wagon,0,2.12,-.1,2.0,.10,2.4,m.cloth);};
  const frieze=(g,style)=>{
    // An administrative display, not a new delegate, unit or objective.
    p.plank(g,0,3.25,.06,6.8,1.35,.18,m.redMarble);
    for(const x of [-2.5,0,2.5]){const roundel=p.mesh(g,p.cylinder,m.brass,x,3.25,-.08,.43,.08,.43);roundel.rotation.x=Math.PI/2;}
    for(let i=0;i<(style==='accounts'?6:3);i++){const x=(i-(style==='accounts'?2.5:1))*1.05;p.plank(g,x,.82,-.6,.85,.12,.8,m.wood);for(const side of [-1,1])p.plank(g,x+side*.31,.38,-.6,.10,.76,.52,m.wood);if(style==='accounts'||style==='tribunal')p.plank(g,x,.94,-.6,.55,.1,.40,m.ivory);}
    if(style==='recognition')for(const side of [-1,1]){const b=p.banner(g,side*3.9,0,0);b.scale.setScalar(.88);}
  };

  if(profile.civic&&profile.chapter>=10){
    // Kept between the existing dais and rear wall; the central speaking
    // floor and all delegate routes retain their original geometry.
    const g=solid(staging.form+' audience backdrop',atEdge('north',3.65));frieze(g,staging.form);
    if(staging.form==='admission')for(const x of [-3,3]){p.plank(g,x,.35,-.1,1.3,.7,1.3,m.marble);pillar(g,x,0,2.4,m.marble);}
    for(const side of [-1,1]){const sideG=atEdge(side<0?'west':'east',4.65);for(let j=-2;j<=2;j++){p.plank(sideG,j*2,.44,0,1.3,.18,.7,m.darkWood);p.plank(sideG,j*2,.20,0,.15,.4,.5,m.darkWood);}}
  }else if(['council','pavilion'].includes(staging.form)){
    const g=solid('open-sided council pavilion',atEdge('north',5.2));
    const portico=porch(g,0,0,9,4,'timber');p.plank(portico,0,1.05,-.6,5,.22,1.25,m.wood);for(const x of [-3.3,3.3])p.banner(g,x,0,-2.6);
    for(const side of [-1,1]){const a=atEdge(side<0?'west':'east',6.2);loading(a,-1.2,1,2);}
  }else if(['causeway','refuge','quay','bridgehead'].includes(staging.form)){
    const g=solid('timber landing approach',atEdge(staging.landmarkEdge,5.3));
    // Plank landing is entirely outside the authored map; no board river is
    // visually bridged unless the rules already provide its ford.
    for(let j=0;j<22;j++)p.plank(g,0,.15,(j-10.5)*.34,5.7,.22,.31,m.wood);
    tiedPosts(g,6.6,3);porch(g,-5.2,2.4,4.3,4.1,'timber');loading(g,-5.4,1.9,staging.form==='quay'?5:2);
    if(staging.form==='refuge')for(const side of [-1,1]){wallBay(g,side*5,4.4,4.1,1.2,m.darkWood);p.banner(g,side*4.5,0,3);}
    else for(const side of [-1,1])p.beam(g,[side*3.4,0,4],[side*3.4,2.8,4],.14,m.darkWood);
  }else if(['gate','sally','breach','city-gate','imperial-gate'].includes(staging.form)){
    const g=solid(staging.form+' destination portal',atEdge(staging.landmarkEdge,6.8)),h=staging.form==='breach'?4.2:6.4;
    arch(g,h,profile.chapter===12?m.brick:m.stone);
    for(const side of [-1,1]){const tower=p.group(g,side*5.6,0,1.6);wallBay(tower,0,0,4.6,h-.6);wallBay(tower,0,2.8,4.6,h-.6);for(const x of [-2,2]){wallBay(tower,x,1.4,.45,h-.6);for(const z of [.25,1.4,2.55])p.plank(tower,x,h-.25,z,.68,.75,.6,m.stone);}p.plank(tower,0,h-.54,1.4,4.8,.2,3.5,m.stone);}
    if(staging.form==='breach'){const shelter=porch(g,-7.2,-4,4,3.6,'timber');loading(shelter,-1,0,2);for(let i=0;i<8;i++)p.plank(g,4.7+hash(i)*2,.22+hash(i,8)*.3,-2-hash(i,3)*3,.8,.5,.7,m.stone);}
    else for(const side of [-1,1]){const b=p.banner(g,side*3.7,0,-.6);b.scale.setScalar(.9);}
  }else if(['courier','archive','well','convoy','granary'].includes(staging.form)){
    const g=solid(staging.form+' service court',atEdge(staging.landmarkEdge,6.8));
    for(const side of [-1,1]){porch(g,side*5.4,0,5.1,5,staging.form==='convoy'?'timber':'stone');wallBay(g,side*5.3,3.2,5.4,2.4,m.plaster);loading(g,side*5.1-.8,-1.1,staging.form==='granary'?6:3);}
    if(staging.form==='well'){
      const well=p.geo(new THREE.TorusGeometry(1.1,.2,8,perf?16:24)),ring=p.mesh(g,well,m.stone,0,.65,1.3);ring.rotation.x=Math.PI/2;for(const x of [-1.4,1.4])p.beam(g,[x,0,1.3],[x,3.1,1.3],.10,m.wood);p.beam(g,[-1.4,3.1,1.3],[1.4,3.1,1.3],.12,m.wood);p.beam(g,[0,3,1.3],[0,.4,1.3],.02,m.rope);
    }else coveredCart(g,staging.form==='archive'?-5.3:5.3,-4.1);
  }else if(staging.form==='avenue'){
    const g=solid('Palmyrene processional street',atEdge('east',9.5));
    // A broad open centre preserves the cavalry vista. Receding repeated
    // porticoes create depth without enclosing the mounted approach.
    for(const side of [-1,1]){for(let j=0;j<(perf?3:high?6:5);j++)pillar(g,side*6.6,j*3.9-3,4.2);p.plank(g,side*6.6,4.38,5,1.05,.28,19,m.marble);}
    for(const side of [-1,1])porch(g,side*8,17,5,5);
  }else{
    const edge=staging.form==='parade'?'east':staging.landmarkEdge,g=solid(staging.form+' camp street',atEdge(edge,6.3));
    for(const side of [-1,1]){porch(g,side*5.5,0,4.5,4.5,'timber');loading(g,side*5.4-.8,-.8,2);if(staging.form==='camp')p.tent(g,side*5.8,0,7,1.1,side*Math.PI/2);}
    if(staging.form==='parade'){for(const x of [-4,0,4])p.practicePost(g,x,0,3.5);}else{p.banner(g,-3,0,2);tiedPosts(g,9,2.4);}
  }

  // A connected, ground-following apron is outside the legal board. Avoids
  // the floating building pads of the former perimeter-only arrangement.
  if(!profile.civic&&['avenue','city-gate','imperial-gate','courier','granary','gate','sally'].includes(staging.form)){
    const positions=[],uv=[],indices=[],hx=e.width*tileSize/2,hz=e.height*tileSize/2;
    for(const edge of [staging.entranceEdge,staging.landmarkEdge]){
      const a=stagingEdge(e,edge,tileSize),side=edge==='west'||edge==='east',sign=edge==='west'||edge==='north'?-1:1;
      const paved=['avenue','city-gate','imperial-gate','courier','granary','gate','sally'].includes(staging.form),length=paved?14:11,width=paved?9:7,step=perf?1:.7,nx=Math.ceil(width/step),nz=Math.ceil(length/step),base=positions.length/3;
      for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const lateral=(i/nx-.5)*width,d=.12+j/nz*length,x=side?sign*(hx+d):a.x+lateral,z=side?a.z+lateral:sign*(hz+d);positions.push(x,height(x,z)+.027,z);uv.push(x*.28,z*.28);if(i<nx&&j<nz){const n=base+j*(nx+1)+i;indices.push(n,n+nx+1,n+1,n+1,n+nx+1,n+nx+2);}}
    }
    const geometry=p.geo(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    // Orient every top face upward even when a route changes compass edge.
    const normals=geometry.attributes.normal;for(let i=0;i<indices.length;i+=3){const n=indices[i];if(normals.getY(n)<0)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];}geometry.setIndex(indices);geometry.computeVertexNormals();
    const paved=['avenue','city-gate','imperial-gate','courier','granary','gate','sally'].includes(staging.form),apron=p.mesh(precinct,geometry,paved?m.stone:m.earth);apron.name='connected precinct apron';apron.castShadow=false;
  }
  precinct.updateWorldMatrix(true,true);
  root.userData.precinctStructures=structures.map(g=>{const b=new THREE.Box3().setFromObject(g);return {name:g.name,min:b.min.toArray(),max:b.max.toArray()};});
  return precinct;
}

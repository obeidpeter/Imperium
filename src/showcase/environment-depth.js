import * as THREE from '../../vendor/three/three.module.js';
import {hash,noise,isPlayable} from './environment-layout.js';

// Perimeter architecture frames the actual rules grid. Nothing in this module
// occupies an authored standing cell, changes terrain, or creates a blocker.
export function addEnvironmentDepth({root,e,p,m,profile,height,tileSize,quality,instance,branch,regionalWorld=false}){
  const hx=e.width*tileSize/2,hz=e.height*tileSize/2,perf=quality==='performance',landmarks=root.userData.environmentLandmarks;
  const mark=(name,g)=>{g.name=name;landmarks.push(name);return g;};
  const group=(name,x=0,z=0)=>mark(name,p.group(root,x,height(x,z),z));
  if(profile.civic&&profile.chapter>=10){
    const senate=profile.architecture==='senate',g=group('enclosed Roman audience hall'),wallX=hx+5.7,backZ=-hz-4.4,frontZ=hz+4;
    // Cutaway front and open central roof preserve the tactical camera. The
    // remaining three full-height walls, clerestory and ceiling coffers make
    // the chamber an interior rather than columns standing in a meadow.
    p.plank(g,0,-.13,-.2,wallX*2+.8,.26,frontZ-backZ,m.marble);
    const panel=(parent,x,z,w,rotation=0)=>{
      const bay=p.group(parent,x,0,z,rotation);
      p.plank(bay,0,1.65,0,w,3.3,.46,m.plaster);
      p.plank(bay,0,.52,.27,w-.18,.95,.075,m.redMarble);
      p.plank(bay,0,2.17,.25,w-.35,1.74,.07,m.ivory);
      for(const yy of [.06,1.10,3.31,7.62,8.15,8.7])p.plank(bay,0,yy,.08,w+.12,yy>7?.19:.11,.70,m.marble);
      // Piers leave actual high windows open; window grids are solid narrow
      // beams, not dark rectangles pasted onto an unbroken wall.
      for(const side of [-1,1]){
        p.plank(bay,side*(w/2-.21),5.45,0,.42,4.3,.55,m.plaster);
        p.plank(bay,side*(w/2-.37),2.10,.35,.26,4.2,.23,m.marble);
        p.plank(bay,side*(w/2-.37),4.25,.35,.50,.18,.42,m.marble);
      }
      p.plank(bay,0,8.02,0,w,.85,.52,m.plaster);
      for(const x of [-.36,.36])p.plank(bay,x,5.44,.02,.055,3.85,.07,m.darkWood);
      for(const y of [4.50,5.50,6.50])p.plank(bay,0,y,.02,w-.78,.055,.07,m.darkWood);
      return bay;
    };
    const sideBays=7,bayDepth=(frontZ-backZ)/sideBays;
    for(const side of [-1,1])for(let i=0;i<sideBays;i++)panel(g,side*wallX,backZ+(i+.5)*bayDepth,bayDepth,side*-Math.PI/2);
    const backBays=8,bayWidth=wallX*2/backBays;
    for(let i=0;i<backBays;i++){const x=-wallX+(i+.5)*bayWidth;if(Math.abs(x)>bayWidth)panel(g,x,backZ,bayWidth);}
    // A real recessed hemicycle gives the presiding end a recognisable civic
    // silhouette. It replaces the central flat back wall and is wholly beyond
    // the grid, rather than placing a decorative objective on a legal cell.
    const apse=p.group(g,0,0,backZ),radius=bayWidth,segments=perf?7:11;
    apse.name=senate?'Senate recessed hemicycle':'basilica apsidal audience recess';
    for(let i=0;i<segments;i++){
      const a=Math.PI+(i+.5)*Math.PI/segments,x=Math.cos(a)*radius,z=Math.sin(a)*radius;
      panel(apse,x,z,2*radius*Math.sin(Math.PI/(2*segments))+.025,Math.atan2(-Math.cos(a),-Math.sin(a)));
    }
    p.plank(apse,0,-.12,-radius/2,radius*2+.35,.24,radius+.4,m.marble);
    const shell=p.geo(new THREE.SphereGeometry(1,perf?18:28,perf?6:10,0,Math.PI,0,Math.PI/2));shell.rotateY(Math.PI);
    p.mesh(apse,shell,m.brick,0,8.2,0,radius+.20,1.85,radius+.20);
    // The underside has reversed winding and normals, so interior light reads
    // the coffered niche without a global DoubleSide material.
    const inner=p.geo(shell.clone());const idx=inner.index;for(let i=0;i<idx.count;i+=3){const b=idx.getX(i+1);idx.setX(i+1,idx.getX(i+2));idx.setX(i+2,b);}inner.computeVertexNormals();
    p.mesh(apse,inner,m.ivory,0,8.16,0,radius,1.65,radius);
    for(let i=0;i<=segments;i++){
      const a=Math.PI+i*Math.PI/segments,points=[];for(let k=0;k<=8;k++){const t=k/8*Math.PI/2;points.push(new THREE.Vector3(Math.cos(a)*radius*Math.cos(t),8.11+1.65*Math.sin(t),Math.sin(a)*radius*Math.cos(t)));}
      p.mesh(apse,p.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),8,.035,4,false)),m.brass);
    }
    mark(apse.name,apse);
    // Dark coffer recesses and projecting mouldings read as real roof depth.
    // Roof strips are wholly outside the playable board, even in tall views.
    for(const side of [-1,1])for(let i=0;i<sideBays;i++){
      const z=backZ+(i+.5)*bayDepth,x=side*(wallX-1.05);
      p.plank(g,x,8.60,z,2.2,.17,bayDepth,m.darkWood);
      p.plank(g,x,8.48,z,1.62,.07,bayDepth-.52,m.redMarble);
      for(const dx of [-1,1])p.plank(g,x+dx*.95,8.40,z,.14,.20,bayDepth,m.ivory);
      for(const dz of [-1,1])p.plank(g,x,8.40,z+dz*(bayDepth/2-.1),2.1,.20,.14,m.ivory);
    }
    for(const side of [-1,1])for(let tier=0;tier<4;tier++){
      const x=side*(hx+1.7+tier*.74),y=.28+tier*.36;
      p.plank(g,x,y,0,.78,.42,e.height*tileSize+1.7,m.marble);
      // Continuous bench cushions sit beyond the original grid perimeter.
      p.plank(g,x,y+.27,0,.62,.11,e.height*tileSize-1,senate?m.red:m.darkWood);
    }
    for(const side of [-1,1]){
      const door=p.group(g,side*9,0,backZ+.30);p.plank(door,0,1.9,0,2.5,3.8,.16,m.darkWood);
      for(const dx of [-.58,.58])for(const yy of [.65,1.88,3.10])p.plank(door,dx,yy,.12,.95,.97,.08,m.wood);
      for(const dx of [-.12,.12])p.mesh(door,p.sphere,m.brass,dx,1.60,.21,.065,.065,.035);
    }
    // A low entry threshold completes the cutaway foreground without blocking
    // the camera or pretending that off-grid seats are movable game objects.
    for(const z of [hz+1.1,hz+2.1,hz+3.1])p.plank(g,0,-.02,z,wallX*2,.10,.7,m.darkStone);
    root.userData.interiorEnvelope={kind:profile.architecture,wallX,backZ,frontZ,wallHeight:8.8,apseDepth:radius,openRoof:true};
    return;
  }
  if(profile.civic)return;

  // Connected earth banks replace the empty plane beyond the action area.
  // A faded geometric edge sits on the existing height field; outside only.
  if(profile.setting==='wetland'){
    const bankGeometry=p.geo(new THREE.SphereGeometry(1,18,8)),reed=p.geo(new THREE.CylinderGeometry(.009,.018,1,5));
    for(let i=0;i<(perf?19:32);i++){
      const side=i%2?-1:1,x=side*(hx+2.5+hash(i,23)*10),z=(hash(i,31)-.5)*38,s=1.3+hash(i,32)*2.3;
      instance('marsh raised silt banks',bankGeometry,m.mud,[x,height(x,z)-.22,z],[s,.34+hash(i,35)*.20,s*.66],[0,hash(i,38)*Math.PI,0]);
      for(let k=0;k<(perf?9:18);k++){
        const a=hash(i,k,31)*Math.PI*2,r=Math.sqrt(hash(i,k,29))*s*.8,xx=x+Math.cos(a)*r,zz=z+Math.sin(a)*r,h=.75+hash(i,k,32)*.65;
        instance('perimeter reed beds',reed,m.dryGrass,[xx,height(xx,zz)+h/2+.1,zz],[1,h,1],[.05,hash(i,k)*6.2,.08]);
      }
    }
    // Tangled fallen timber gives the rescue approach an interrupted human
    // route without placing invented obstacles on the playable causeway.
    for(const [x,z,a]of [[-hx-4,-1,.35],[hx+4,-7,-.55],[-hx-5,10,.7]]){
      const g=group('flood-carried willow trunk',x,z);g.rotation.y=a;
      p.beam(g,[-2,.20,0],[2.1,.40,.1],.19,m.darkWood);for(let j=0;j<4;j++)p.beam(g,[-1+j*.8,.30,0],[-.7+j*.7,.75,(j%2?1:-1)*.65],.045,m.wood);
    }
    mark('continuous muddy wetland banks',p.group(root,0,0,0));
  }
  if(profile.architecture==='colonnaded-city'&&!regionalWorld){
    const g=group('connected Palmyrene urban edge'),back=-hz-8;
    // The open porticoes connect to the proper courtyard houses authored in
    // environment-inhabited, rather than a row of sealed solid box facades.
    for(const side of [-1,1]){
      p.plank(g,side*(hx+3.1),-.05,0,4.4,.16,e.height*tileSize+9,m.stone);
      for(let row=0;row<3;row++)p.plank(g,side*(hx+1.45+row*.7),.055+row*.09,0,.75,.12,e.height*tileSize+4,m.marble);
    }
    for(const side of [-1,1]){
      const x=side*13;p.plank(g,x,4.9,back,6,9.8,4,m.brick);p.plank(g,x,9.9,back,6.4,.28,4.4,m.stone);
      for(let k=0;k<3;k++)p.plank(g,x+(k-1)*1.8,10.4,back,1.15,.9,4.2,m.stone);
    }
  }
  // Scatter low material variation on the unplayable verge, in clusters. These
  // bounded instances add depth cues at every region without per-prop draws.
  const pebble=p.geo(new THREE.IcosahedronGeometry(1,0));
  for(let i=0;i<(perf?130:240);i++){
    const x=(hash(i,171)-.5)*48,z=(hash(i,172)-.5)*40;
    if(isPlayable(x,z,e,tileSize,1.8)||noise(x*.28,z*.28,23)<.48)continue;
    const s=.06+hash(i,173)*.15;
    instance('weathered ground verge stones',pebble,profile.vegetation==='arid'?m.sand:m.darkStone,[x,height(x,z)+s*.24,z],[s,s*.45,s*.85],[hash(i)*.5,hash(i,176)*6.28,0]);
  }
}

import * as T from '../../vendor/three/three.module.js';
import {hash} from './environment-layout.js';

/** Chapter V's benchmark landmark. Asymmetric masonry, exposed wall courses,
 * timber support and a mine apron describe a siege without adding game cells.
 * The caller positions the entire work outside the playable rectangle. */
export function addSiegeLandmark({parent,p,m,quality='balanced'}){
  const perf=quality==='performance',g=p.group(parent,0,0,0);g.name='fractured Euphrates curtain and mine works';
  const brick=(x,y,z,w,h,d,mat=m.brick)=>p.plank(g,x,y,z,w,h,d,mat);
  // Two unequal tower masses leave the approach visibly open between them.
  for(const [cx,width,top,broken]of [[-5.1,3.8,6.4,false],[5.1,4.1,5.8,true]]){
    brick(cx,.17,1.4,width+.7,.34,4.5,m.darkStone);
    for(let row=0;row<Math.floor(top/.48);row++){
      const y=(row+.5)*.48,cols=perf?4:5,w=width/cols;
      for(let col=0;col<cols;col++){
        const x=cx-width/2+(col+.5)*w,damage=broken&&row>=7&&col<Math.max(0,row-7);
        if(damage)continue;
        // Narrow windows are actual apertures in the masonry face.
        if(row>=7&&row<=8&&col===Math.floor(cols/2)&&!broken)continue;
        brick(x,y,-.48,w-.025,.455,.54);
        if(row<top/.48-1)brick(x,y,3.22,w-.025,.455,.54);
      }
      for(const side of [-1,1])brick(cx+side*(width/2-.22),y,1.37,.45,.455,3.25);
    }
    brick(cx,top-.68,1.38,width,.19,3.4,m.darkWood);
    if(!broken){
      for(let i=0;i<4;i++)brick(cx+(i-1.5)*.94,top+.05,-.48,.55,.63,.66);
      for(const side of [-1,1])for(const z of [.30,1.3,2.3])brick(cx+side*(width/2-.2),top+.05,z,.65,.63,.55);
      // Roof drain, thin gypsum reveals and battered foundation reinforce scale.
      brick(cx+.9,top-.6,-.91,.20,.18,.65,m.stone);
      for(const side of [-1,1])brick(cx+side*.43,3.93,-.77,.11,1.08,.09,m.plaster);
    }else{
      for(let i=0;i<8;i++){
        const a=i*.9,x=cx-1.7+hash(i,4)*3.7,z=-1.0-hash(i,5)*2.0;
        const rubble=brick(x,.16+hash(i,6)*.4,z,.45+hash(i,7)*.35,.35,.60,m.darkStone);rubble.rotation.set(.12,a,.14);
      }
      for(const [x,y,length]of [[cx-.8,3.9,2.3],[cx+.4,4.7,2.2]]){
        const beam=p.plank(g,x,y,-.92,.16,.18,length,m.darkWood);beam.rotation.x=.36;beam.rotation.z=.18;
      }
    }
    // Broad buttresses lean inward in a graduated profile; no floating towers.
    for(const side of [-1,1])for(let step=0;step<4;step++)brick(cx+side*(width/2-.14),.32+step*.55,-.76+step*.075,.65-step*.07,.65,.80-step*.14,m.stone);
  }
  // Broken shoulders form a shallow V silhouette, not a perfect generic arch.
  for(const side of [-1,1])for(let col=0;col<3;col++){
    const x=side*(2.1+col*.72),rows=3+col*2;
    for(let row=0;row<rows;row++)brick(x,(row+.5)*.43,1.45,.69,.405,1.35,row===0?m.darkStone:m.brick);
  }
  // A mine roof with tightly spaced beams and soil above it, well to the side
  // of the open arrival line. Horizontal members join the posts physically.
  const mine=p.group(g,8.2,0,-2.3,-.14);mine.name='supported siege mine';
  for(const z of [-1.05,-.35,.35,1.05]){
    for(const x of [-.78,.78])p.beam(mine,[x,0,z],[x,1.72,z],.10,m.darkWood);
    p.beam(mine,[-.90,1.72,z],[.90,1.72,z],.11,m.wood);
  }
  for(let i=0;i<10;i++)p.plank(mine,(i-4.5)*.18,1.87,0,.17,.09,2.45,m.darkWood);
  p.plank(mine,0,2.0,.25,2.0,.20,2.0,m.earth);
  p.plank(mine,0,.8,1.17,1.52,1.6,.08,m.charcoal);
  for(const side of [-1,1])p.beam(mine,[side*.68,.12,-1.06],[side*.68,1.58,-.35],.055,m.wood);
  for(let i=0;i<(perf?7:14);i++){
    const x=7+hash(i,61)*3.1,z=-4.0+hash(i,64)*1.5;
    const spoil=brick(x,.10+hash(i,62)*.12,z,.30+hash(i,63)*.45,.20,.35,m.earth);spoil.rotation.y=hash(i,65)*6;
  }
  const hoist=p.group(g,-8.3,0,-2.4);hoist.name='siege wall repair hoist';
  for(const side of [-1,1])p.beam(hoist,[side*.85,0,0],[0,3.0,0],.10,m.darkWood);
  p.beam(hoist,[0,2.8,-.1],[0,3.55,1.5],.08,m.wood);p.beam(hoist,[0,3.5,1.4],[0,.55,1.4],.018,m.rope);
  p.plank(hoist,0,.39,1.4,.85,.16,.75,m.wood);p.plank(hoist,0,.61,1.4,.62,.28,.55,m.stone);
  // Sagging temporary cover gives a second, soft silhouette to the hard wall.
  const shade=p.geo(new T.PlaneGeometry(3.1,2.2,6,4));shade.rotateX(-Math.PI/2);
  const pos=shade.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,-.22*Math.cos(pos.getX(i)*Math.PI/3.1)*Math.cos(pos.getZ(i)*Math.PI/2.2));
  shade.computeVertexNormals();p.mesh(g,shade,m.cloth,-7.9,2.25,3.1);
  for(const x of [-9.4,-6.4])p.beam(g,[x,0,2.0],[x,2.3,2.0],.045,m.wood);
  g.userData.benchmarkComposition={chapter:5,layers:['mine apron','broken curtain','unequal towers'],openApproach:4.2};
  return g;
}

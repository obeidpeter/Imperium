import * as THREE from '../../vendor/three/three.module.js';
import {hash} from './environment-layout.js';
import {stagingEdge} from './environment-staging.js';

// The finale's approach to Rome. Aurelian's new brick curtain (begun AD 271,
// still rising in 275) runs north and south from the gate: finished stretches
// are crenellated, others stand part-built behind scaffolding, with a square
// tower about every thirty metres. The claimant's cohorts stand before it and
// the commander's own legions are drawn up behind the western edge.
// Presentation only: all of it stands outside the legal board, is instanced
// into a few shared batches and is never a picking target.
function merge(parts){
  const positions=[],normals=[];
  for(const g of parts){const s=g.index?g.toNonIndexed():g;positions.push(...s.attributes.position.array);normals.push(...s.attributes.normal.array);if(s!==g)s.dispose();g.dispose();}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));return geometry;
}
// A legionary at distance: legs and tunic, torso, helmeted head (about 1.75 m).
export function createMassedSoldierGeometry(){
  const legs=new THREE.CylinderGeometry(.19,.23,.86,7);legs.translate(0,.43,0);
  const torso=new THREE.CylinderGeometry(.22,.19,.62,7);torso.translate(0,1.17,0);
  const head=new THREE.SphereGeometry(.14,8,6);head.translate(0,1.6,0);
  const crest=new THREE.BoxGeometry(.05,.1,.26);crest.translate(0,1.76,0);
  return merge([legs,torso,head,crest]);
}
export function finaleLayout(e,tileSize=2.5,{quality='balanced'}={}){
  const hx=e.width*tileSize/2,gate=stagingEdge(e,'east',tileSize,6.8),wallX=gate.x+1.4,perf=quality==='performance';
  const files=perf?6:8,ranks=perf?4:5,blocks=[];
  // The commander's legions behind the western edge, facing the gate.
  for(const [i,z] of [-13.5,-4.5,4.5,13.5].entries())blocks.push({side:'commander',x:-hx-12-(i%2)*1.5,z,yaw:Math.PI/2,files,ranks});
  // The claimant's cohorts before the walls, either side of the gate road.
  for(const z of [gate.z-15,gate.z+15])blocks.push({side:'claimant',x:hx+4.4,z,yaw:-Math.PI/2,files:perf?5:6,ranks:perf?3:4});
  return {wallX,gateZ:gate.z,gateGap:8.2,reach:58,blocks};
}
export function addFinaleApproach({root,e,p,m,profile,height,tileSize,quality,instance,geometries}){
  if(profile.staging?.key!=='rome-approach')return null;
  const perf=quality==='performance',layout=finaleLayout(e,tileSize,{quality}),{wallX,gateZ,gateGap,reach}=layout;
  const tint=(hex,k)=>new THREE.Color(hex).multiplyScalar(.86+hash(k,17)*.24);
  const wall='squared mudbrick masonry';
  // The curtain, in four-metre stretches north and south of the gate towers.
  for(const sign of [-1,1])for(let along=gateGap;along<reach;along+=4){
    const z=gateZ+sign*(along+2),k=Math.round(along*sign),base=height(wallX,z),tower=Math.abs(((along-gateGap)%30)-15)<2.1;
    const finished=hash(k,5)>.42||along<gateGap+6,top=tower?9.2:finished?7.2:2.6+hash(k,9)*2.6;
    for(let row=0;row<(perf?2:4);row++){const h=top/(perf?2:4);instance(wall,p.masonryBlock,m.brick,[wallX,base+h*(row+.5),z],[tower?4.6:2.6,h-.04,3.96],[0,0,0],tint('#b9785a',k*7+row));}
    if(finished||tower)for(let u=-1.6;u<=1.6;u+=1.07)instance(wall,p.masonryBlock,m.brick,[wallX-(tower?2.1:1.1),base+top+.32,z+u],[.5,.64,.56],[0,0,0],tint('#c58566',k+u*3));
    else if(!perf){
      // Scaffold poles, ledgers and a brick stack where the course stops.
      for(const u of [-1.6,1.6])for(const dx of [-1.9,1.9])instance('finale timber',p.cylinder,m.wood,[wallX+dx,base+(top+2.2)/2,z+u],[.07,top+2.2,.07]);
      for(const y of [top*.5,top+.9])for(const dx of [-1.9,1.9])instance('finale timber',p.cylinder,m.wood,[wallX+dx,base+y,z],[.05,3.4,.05],[Math.PI/2,0,0]);
      instance(wall,p.masonryBlock,m.brick,[wallX-3.4,height(wallX-3.4,z)+.35,z+hash(k,3)-.5],[1.2,.7,.9],[0,hash(k,4),0],tint('#b06f52',k));
    }
  }
  // Massed legions: bodies, shields and (above Performance) spears, instanced.
  const body=p.geo(createMassedSoldierGeometry());
  const colors={commander:{tunic:'#9b3a2c',shield:'#8e2f28'},claimant:{tunic:'#7c6f5c',shield:'#4b5e7a'}};
  for(const [b,block] of layout.blocks.entries()){
    const c=Math.cos(block.yaw),s=Math.sin(block.yaw),palette=colors[block.side];
    for(let r=0;r<block.ranks;r++)for(let f=0;f<block.files;f++){
      const lx=(f-(block.files-1)/2)*.92+(hash(b,r,f)-.5)*.12,lz=-(r-(block.ranks-1)/2)*1.05,x=block.x+c*lx+s*lz,z=block.z-s*lx+c*lz,y=height(x,z),yaw=block.yaw+(hash(f,r,b)-.5)*.16,k=b*100+r*10+f;
      instance('massed legion figures',body,m.cloth,[x,y,z],[1,1,1],[0,yaw,0],tint(palette.tunic,k));
      instance('massed legion shields',p.box,m.cloth,[x+Math.sin(yaw)*.3-Math.cos(yaw)*.12,y+.95,z+Math.cos(yaw)*.3+Math.sin(yaw)*.12],[.56,.86,.07],[0,yaw,0],tint(palette.shield,k+3));
      if(!perf)instance('finale timber',p.cylinder,m.wood,[x+Math.cos(yaw)*.24,y+1.25,z-Math.sin(yaw)*.24],[.03,2.4,.03]);
    }
    // One vexillum per block, its cloth in the block's colours.
    const sx=block.x+s*((block.ranks-1)/2*1.05+.9),sz=block.z+c*((block.ranks-1)/2*1.05+.9),sy=height(sx,sz);
    instance('finale timber',p.cylinder,m.wood,[sx,sy+1.9,sz],[.05,3.8,.05]);
    instance('massed legion shields',p.box,m.cloth,[sx,sy+3.2,sz],[.07,.8,.9],[0,block.yaw,0],tint(palette.shield,b+40));
  }
  root.userData.environmentLandmarks?.push('the rising Aurelian Walls');
  return layout;
}

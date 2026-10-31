import * as T from '../../vendor/three/three.module.js';
import {chapterFiveServicePads} from './environment-ch5-pilot.js';
import {regionalServicePads} from './environment-regional-world.js';

// Furnishing is kept inside the already blocked service pockets. Its sides
// remain open to the existing actors and interaction anchors. Shared meshes
// join the ordinary environment batching and disposal lifecycle.
export function addCampWorkyards({root,e,p,m,height,tileSize,profile}){
  const pads=[...chapterFiveServicePads(e,tileSize),...regionalServicePads(e,tileSize)];
  if(!pads.length)return;
  const group=p.group(root,0,0,0);group.name='camp shaded work courts';
  const shades=[];
  for(const pad of pads){
    // Leave the water visible; its low surround and damp ground already form
    // a focal point. Supply and household bays get independent work canopies.
    if(/water|cistern/.test(pad.id))continue;
    const width=Math.min(3.05,pad.width-1.7),depth=Math.min(3.6,pad.depth-.7);
    if(width<1.2||depth<1.5)continue;
    const x=pad.x+.45,z=pad.z,g=p.group(group,x,height(x,z),z);
    g.name=`workcourt:${pad.id}`;
    const top=2.9,cloth=p.geo(new T.PlaneGeometry(width,depth,6,5));cloth.rotateX(-Math.PI/2);
    const a=cloth.attributes.position;
    for(let i=0;i<a.count;i++){const u=a.getX(i)/(width/2),v=a.getZ(i)/(depth/2);a.setY(i,top-.20*(1-u*u)*(1-v*v)+.035*Math.sin(u*8)*(1-v*v));}
    cloth.computeVertexNormals();p.mesh(g,cloth,m.cloth);
    for(const xx of [-width/2,width/2])for(const zz of [-depth/2,depth/2]){
      p.beam(g,[xx,0,zz],[xx,top+.06,zz],.045,m.darkWood);
      p.beam(g,[xx,top-.45,zz],[xx-Math.sign(xx)*.38,top,zz],.025,m.wood);
    }
    for(const zz of [-depth/2,depth/2])p.beam(g,[-width/2,top,zz],[width/2,top,zz],.035,m.wood);
    // Low timber edging and tied mats read as an occupied bay without adding
    // a wall, false doorway or detail outside the collision pocket.
    p.plank(g,0,.05,-depth/2,width,.10,.12,m.darkWood);
    const mat=p.plank(g,0,.025,depth/2-.33,width*.73,.035,.45,profile.vegetation==='arid'?m.rope:m.wood);mat.castShadow=false;
    shades.push({id:pad.id,x,z,width,depth,height:top});
  }
  root.userData.campWorkyards={shades};
  root.userData.environmentLandmarks.push('shaded supply and household work courts');
}

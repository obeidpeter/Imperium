import {crossesCover,groundHeight,navGrid,span,terrainAtPoint} from './navigation.js';

// Sight across the field: solid ground (rock, walls, a shut gate) and the smoke
// of a burning pitch brazier (within 2.5 m of the line) block it (guide "Field
// objects"). Pure.
export const SMOKE_RADIUS=2.5;
export function smokeBetween(world,a,b){
  for(const o of world.objects??[]){
    if(!o.field||o.kind!=='brazier'||o.state!=='burning')continue;
    const dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz,t=l2?Math.max(0,Math.min(1,((o.x-a.x)*dx+(o.z-a.z)*dz)/l2)):0;
    if(span(a.x+dx*t-o.x,a.z+dz*t-o.z)<=SMOKE_RADIUS)return true;
  }
  return false;
}
export function terrainCover(world,a,b){
  const grid=navGrid(world.map);
  if(!world.fortifications)return crossesCover(grid,a,b);
  // Eyes and missiles look down from a platform, but a lower soldier cannot
  // see through its curtain. Map elevations and wall materials are saved rules.
  const ah=groundHeight(grid,a.x,a.z)+1.5,bh=groundHeight(grid,b.x,b.z)+1.5;
  const dx=b.x-a.x,dz=b.z-a.z,steps=Math.max(1,Math.ceil(span(dx,dz)/.25));
  for(let i=1;i<steps;i++){
    const t=i/steps,x=a.x+dx*t,z=a.z+dz*t,type=terrainAtPoint(world.map,x,z);
    if(type==='rock'||type==='river')return true;
    if(type==='wall'&&ah+(bh-ah)*t<=(world.fortifications.material==='timber'?2.5:3.2))return true;
  }
  return false;
}
export const sightBlocked=(world,a,b)=>terrainCover(world,a,b)||smokeBetween(world,a,b);

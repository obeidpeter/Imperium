import {crossesCover,navGrid,span} from './navigation.js';

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
export const sightBlocked=(world,a,b)=>crossesCover(navGrid(world.map),a,b)||smokeBetween(world,a,b);

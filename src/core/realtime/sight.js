import {crossesCover,groundHeight,navGrid,span,terrainAtPoint} from './navigation.js';
import {STRUCTURES} from '../../data/structures.js';

// Sight across the field: solid ground (rock, walls, a shut gate) and the smoke
// of a burning pitch brazier (within 2.5 m of the line) block it (guide "Field
// objects"). Pure.
export const SMOKE_RADIUS=2.5;
// A tower's deck (walls are their own cells) hides what lies behind it below its height.
const STANDING=STRUCTURES.tower.deck;
export function smokeBetween(world,a,b){
  for(const o of world.objects??[]){
    if(!o.field||o.kind!=='brazier'||o.state!=='burning')continue;
    const dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz,t=l2?Math.max(0,Math.min(1,((o.x-a.x)*dx+(o.z-a.z)*dz)/l2)):0;
    if(span(a.x+dx*t-o.x,a.z+dz*t-o.z)<=SMOKE_RADIUS)return true;
  }
  return false;
}
// What blocks the line between two points: 'wall', 'tower', 'rock' or 'river' (the
// ground's own cover), or null. Forecasts name it (combat.js).
export function coverBetween(world,a,b){
  const grid=navGrid(world.map);
  if(!world.fortifications)return crossesCover(grid,a,b)?(terrainBetween(world,a,b)??'rock'):null;
  // Eyes and missiles look down from a platform, but a lower soldier cannot
  // see through its curtain or its tower. Map elevations and wall materials are saved rules.
  const ah=groundHeight(grid,a.x,a.z)+1.5,bh=groundHeight(grid,b.x,b.z)+1.5,curtain=world.fortifications.material==='timber'?2.5:3.2;
  const dx=b.x-a.x,dz=b.z-a.z,steps=Math.max(1,Math.ceil(span(dx,dz)/.25));
  for(let i=1;i<steps;i++){
    const t=i/steps,x=a.x+dx*t,z=a.z+dz*t,type=terrainAtPoint(world.map,x,z),line=ah+(bh-ah)*t;
    if(type==='rock'||type==='river')return type;
    if(type==='wall'&&line<=curtain)return 'wall';
    const ground=groundHeight(grid,x,z);if(ground>=STANDING&&line<=ground)return 'tower';
  }
  return null;
}
// The first solid terrain a line crosses (no fortifications: rocks, walls and water are all solid).
function terrainBetween(world,a,b){
  const dx=b.x-a.x,dz=b.z-a.z,steps=Math.max(1,Math.ceil(span(dx,dz)/.25));
  for(let i=1;i<steps;i++){const type=terrainAtPoint(world.map,a.x+dx*i/steps,a.z+dz*i/steps);if(['rock','river','wall'].includes(type))return type;}
  return null;
}
export const terrainCover=(world,a,b)=>coverBetween(world,a,b)!==null;
export const sightBlocked=(world,a,b)=>terrainCover(world,a,b)||smokeBetween(world,a,b);

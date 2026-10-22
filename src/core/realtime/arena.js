import {ARENA} from '../../data/realtime-rules.js';
import {createWorld} from './simulation.js';
import {nextRandom} from './rng-streams.js';
import {navGrid,walkable} from './navigation.js';

// The Phase 0 arena: a Legionary against three raiders on the frontier road's
// own map (the campaign's encounter supplies it, so the rules walk the ground
// the scene draws). Each fight's raiders stand a little differently, drawn
// from the world stream of its seed.
export function createArenaWorld(map,{seed,options}={}){
  if(map?.id&&map.id!==ARENA.map)throw new Error(`The arena is fought on ${ARENA.map}.`);
  const world=createWorld({map:{...map,id:ARENA.map},seed,options,controlled:ARENA.hero.id,
    actors:[{...ARENA.hero,side:'player'},...ARENA.enemies.map(e=>({...e,side:'enemy'}))]});
  const grid=navGrid(world.map);
  for(const a of world.actors)if(a.side==='enemy')for(let tries=0;tries<4;tries++){
    const x=a.x+(nextRandom(world.rng,'world')-.5)*3,z=a.z+(nextRandom(world.rng,'world')-.5)*3;
    if(walkable(grid,x,z)){a.x=a.px=x;a.z=a.pz=z;break;}
  }
  world.objective=ARENA.objective;
  return world;
}

import {campFor,CAMP_PLACES,PLACE_NAMES} from '../../data/camps.js';
import {createWorld} from './simulation.js';
import {FINE,layoutFor,upsampleTerrain,soldierSpec} from './campaign-encounter.js';
import {actorById,distanceBetween} from './abilities.js';

// A walkable camp (build brief §3.12): the chapter's camp map upsampled like a
// battle's, the soldier at the gate, the camp's people as neutral men to talk
// to and its objects to use. Nothing here fights and nothing is staged: the
// camp world is the page's, never the chronicle's; what the soldier does in
// it reaches the chronicle only through camp conversations and commands.

// Coarse camp coordinates (fractions of a 0.38 tile) to metres on the fine map.
export function campPoint(layout,[x,y],[dx,dz]=[0,0]){
  const along=(sizes,v)=>{const i=Math.max(0,Math.min(sizes.length-1,Math.floor(v)));let m=0;for(let j=0;j<i;j++)m+=sizes[j];return (m+sizes[i]*(v-i))*FINE;};
  return {x:along(layout.kx,x+.5)+dx,z:along(layout.ky,y+.5)+dz};
}
export function createCampWorld(state){
  const camp=campFor(state.chapter);if(!camp)return null;
  const layout=layoutFor(camp.terrain[0].length,camp.terrain.length,camp.scale),fine=upsampleTerrain(camp.terrain,layout,camp.ground);
  const place=(id,offset)=>campPoint(layout,camp.places[id],offset);
  const entry=place(camp.entry,[0,-3]),present=p=>(!p.requires||state.decisions?.[p.requires[0]]===p.requires[1])&&!(p.absentAfter&&state.decisions?.[p.absentAfter[0]]===p.absentAfter[1]);
  const actors=[{...soldierSpec(state,{at:[entry.x,entry.z],face:[0,-1]}),standingPreset:null}];
  for(const p of camp.people.filter(present)){
    const at=place(p.place,p.at);
    actors.push({id:p.id,name:p.name,side:'neutral',role:p.role,attributes:{str:10,agi:10,con:10,per:10,combat:5,field:5},kit:['tunic','caligae'],
      at:[at.x,at.z],face:[0,1],talk:{tree:p.talk},drawn:false,camp:true});
  }
  const objects=camp.objects.map(o=>{const at=place(o.place,o.at);return {id:o.id,kind:o.kind,name:o.name,x:at.x,z:at.z,work_s:.3,toggle:true,talk:o.talk};});
  const world=createWorld({map:{id:camp.id,...fine},seed:1000+state.chapter,actors,controlled:'hero',objects,kind:'camp',mission:null});
  world.layout={kx:[...layout.kx],ky:[...layout.ky],k:layout.k};world.title=camp.title;world.campId=camp.id;world.chapter=state.chapter;
  world.places=Object.fromEntries(CAMP_PLACES.map(id=>[id,{name:PLACE_NAMES[id],...place(id)}]));
  return world;
}
// The place the soldier stands in, if any (within 8 m of its centre).
export function placeAt(world,actorId=world.heroId){
  const a=actorById(world,actorId);if(!a||!world.places)return null;
  let best=null,bd=8;for(const [id,p]of Object.entries(world.places)){const d=distanceBetween(a,p);if(d<=bd){bd=d;best=id;}}return best;
}

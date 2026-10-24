import {BAND_MORALE,TIME} from '../../data/realtime-rules.js';
import {FACTION_NAMES} from '../../data/realtime-forces.js';
import {actorById,hostile} from './abilities.js';
import {cellCentre,clampToMap,navGrid,nearestWalkable,span,walkable} from './navigation.js';
import {setRoute} from './motion.js';

// War bands (Chapters I–III; worlds and gameplay plan, release 3): the single
// raiders of an early battle are one band with one morale, as the guide says
// of every group of fighters. It falls as men fall (more when one is struck
// down from ambush, more again for the leader) and when the band ends a round
// outnumbered two to one; it rises when reinforcements come and after a round
// out of contact. Shaken at 40 or less, the band's blows take one less (after
// Chapter I, as a squad's do); broken at 20 or less, every man runs for the
// band's own edge of the field and leaves it there. A man who escapes earns
// no training points and is gone for the objective; one cut down as he runs
// still counts. Pure: no clock and no random draw.

const B=BAND_MORALE,R=TIME.roundTicks;
const emit=(world,event)=>world.events.push({tick:world.tick,...event});
const standing=o=>o.alive&&!o.down&&!o.carriedBy;
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const stateOf=morale=>morale<=B.broken?'broken':morale<=B.shaken?'shaken':'steady';
const membersOf=world=>(world.band?.members??[]).map(id=>actorById(world,id)).filter(a=>a&&standing(a));
export const inBand=(world,actor)=>!!world.band&&!!actor&&world.band.members.includes(actor.id);
export const fleeing=(world,actor)=>world.band?.state==='broken'&&inBand(world,actor);
// The band's morale shakes its men's blows (combat.js), as a squad's does.
export const bandShaken=(world,actor)=>inBand(world,actor)&&world.band.state!=='steady';

// The encounter's raiders form their band: every enemy who fights alone. Its
// leader is the man with the most Health (the first by id among equals), and
// its own edge is the side of the field nearest where it stands.
export function formBand(world){
  const men=world.actors.filter(a=>a.side==='enemy'&&a.ai&&!a.practice&&!a.squadId&&a.alive).sort((a,b)=>a.id.localeCompare(b.id));
  if(!men.length)return null;
  const leader=[...men].sort((a,b)=>b.maxHp-a.maxHp||a.id.localeCompare(b.id))[0];
  leader.officer=true;leader.name=`${FACTION_NAMES[leader.faction]??'Enemy'} war leader`;
  const x=men.reduce((n,a)=>n+a.x,0)/men.length,z=men.reduce((n,a)=>n+a.z,0)/men.length,W=world.map.width*2.5,H=world.map.height*2.5;
  const edge=[['east',W-x],['west',x],['south',H-z],['north',z]].sort((a,b)=>a[1]-b[1])[0][0];
  world.band={morale:B.start,size:men.length,members:men.map(a=>a.id),leaderId:leader.id,state:'steady',edge,contactTick:0,fled:[]};
  return world.band;
}
function change(world,amount){
  const band=world.band,before=band.state;band.morale=clamp(band.morale+amount);
  const after=stateOf(band.morale);
  // A broken band stands again only when reinforcements lift it (bandReinforced).
  if(before==='broken'&&after==='broken')return;
  if(after===before)return;
  band.state=after;
  if(after==='broken'){
    for(const m of membersOf(world)){m.lock=null;m.order=null;m.path=[];m.gait=null;m.drawn=true;}
    emit(world,{kind:'band-broken'});
  }else if(before==='broken')emit(world,{kind:'band-rallied'});
  else if(after==='shaken')emit(world,{kind:'band-shaken'});
}
// A man of the band falls (damage.js): his share of its heart goes with him.
export function bandMemberFell(world,man,{ambush=false}={}){
  const band=world.band;if(!band||!band.members.includes(man.id))return;
  const leader=man.id===band.leaderId;
  if(leader)emit(world,{kind:'band-leader-fell',actorId:man.id});
  change(world,-(B.loss/band.size+(ambush?B.ambush:0)+(leader?B.leader:0)));
}
// A reinforcement joins the band (mission.js).
export function bandReinforced(world,man){
  const band=world.band;if(!band||!man||band.members.includes(man.id))return;
  band.members.push(man.id);band.size++;
  const before=band.state;band.morale=clamp(band.morale+B.reinforced);const after=stateOf(band.morale);
  if(after!==before){band.state=after;if(before==='broken')emit(world,{kind:'band-rallied'});}
  // Men still on the field turn back to fight when it stands again.
  if(before==='broken'&&after!=='broken')for(const m of membersOf(world)){m.order=null;m.path=[];if(m.ai&&m.ai.state!=='engage')m.ai.state='engage';}
}
// Every tick: who is in contact (once a second), and the men who reach the band's edge leave the field.
export function bandTick(world){
  const band=world.band;if(!band)return;
  if(world.tick%20===0){
    const men=membersOf(world);
    if(men.some(m=>world.actors.some(o=>standing(o)&&!o.hidden&&hostile(m,o)&&o.side!=='neutral'&&span(o.x-m.x,o.z-m.z)<=B.contact)))band.contactTick=world.tick;
  }
  if(band.state!=='broken')return;
  const W=world.map.width*2.5,H=world.map.height*2.5;
  for(const m of membersOf(world)){
    const out=band.edge==='east'?m.x>=W-B.edge:band.edge==='west'?m.x<=B.edge:band.edge==='south'?m.z>=H-B.edge:m.z<=B.edge;
    if(out)escape(world,m);
  }
}
function escape(world,man){
  world.band.fled.push({id:man.id,unitId:man.unitId??null,name:man.name,role:man.role,x:man.x,z:man.z});
  world.actors=world.actors.filter(a=>a!==man);delete world.spotting[man.id];
  for(const a of world.actors){if(a.lock===man.id)a.lock=null;if(a.order?.targetId===man.id)a.order=null;if(a.ai?.focus===man.id)a.ai.focus=null;}
  emit(world,{kind:'fled',actorId:null,name:man.name,x:man.x,z:man.z});
}
// The round's end (simulation.js): outnumbered, or a round out of contact.
export function bandRound(world){
  const band=world.band;if(!band||band.state==='broken')return;
  const men=membersOf(world).length;if(!men)return;
  const ours=world.actors.filter(o=>standing(o)&&(o.side==='player'||o.side==='ally')&&o.role!=='escort'&&!o.hidden).length;
  if(ours>=B.ratio*men)change(world,-B.outnumbered);
  if(world.tick-band.contactTick>=R-1&&band.morale<B.start)change(world,Math.min(B.rest,B.start-band.morale));
}
// A broken man's decision (ai.js): run for the band's edge.
export function flee(world,man){
  const band=world.band,W=world.map.width*2.5,H=world.map.height*2.5,grid=navGrid(world.map);
  let p=band.edge==='east'?{x:W-.5,z:man.z}:band.edge==='west'?{x:.5,z:man.z}:band.edge==='south'?{x:man.x,z:H-.5}:{x:man.x,z:.5};
  p=clampToMap(grid,p);if(!walkable(grid,p.x,p.z)){const i=nearestWalkable(grid,p.x,p.z);if(i<0)return;p=cellCentre(grid,i);}
  man.lock=null;
  if(man.order?.flee&&man.path?.length)return;
  man.order={kind:'move',flee:true};setRoute(world,man,p,{run:true});
}

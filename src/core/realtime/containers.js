import {MOVEMENT} from '../../data/realtime-rules.js';
import {HIDDEN_NOTICE_M} from '../../data/containers.js';
import {actorById,distanceBetween} from './abilities.js';
import {span} from './navigation.js';

// Containers in a world (release 11, data/containers.js): a chest, a strongbox
// or a cache to open. A hidden one shows itself to the soldier who comes close
// enough (Perception widens the distance) or, on a battlefield, to Scout. On a
// battlefield its lock opens with its key from the field's spoils, or by force,
// and what is taken from it is staged with the spoils of the fallen. A camp's
// containers open from the chronicle (core/soldier.js): the camp world only
// shows them and walks the soldier there.

const emit=(world,event)=>world.events.push({tick:world.tick,...event});
export const isContainer=o=>o?.kind==='container';
export const noticeRange=actor=>HIDDEN_NOTICE_M+Math.max(0,(actor?.attributes?.per??10)-10)/2;

// Each tick: a hidden container within the soldier's notice, or inside a Scout reveal, shows itself.
export function revealContainers(world){
  const hero=actorById(world,world.heroId);if(!hero?.alive)return;
  for(const o of world.objects){
    if(!isContainer(o)||!o.hidden)continue;
    const near=span(o.x-hero.x,o.z-hero.z)<=noticeRange(hero);
    const scouted=world.kind!=='camp'&&world.reveals.some(r=>r.until>world.tick&&span(o.x-r.x,o.z-r.z)<=r.radius);
    if(near||scouted){o.hidden=false;emit(world,{kind:'found',actorId:hero.id,objectId:o.id,how:near?'search':'scout'});}
  }
}
// What stops opening it, before the work starts: hidden, or (on a battlefield)
// locked with neither the key in the spoils nor, when forced, the strength.
export function containerProblem(world,actor,o,{force=false}={}){
  if(o.hidden)return 'NO_TARGET';
  if(world.kind==='camp')return null;
  if(!o.lock||o.unlocked)return force?'NOT_LOCKED':null;
  if(force){const need=Object.entries(o.lock.force??{});return need.length&&need.every(([k,v])=>(actor.attributes?.[k]??0)>=v)?null:'TOO_WEAK';}
  return world.spoils.some(s=>s.itemId===o.lock.key)?null:'LOCKED';
}
// The work is done: a lock opens (its key is used up), then the container stands open.
export function openContainer(world,actor,o,{force=false}={}){
  if(world.kind!=='camp'&&o.lock&&!o.unlocked){
    const problem=containerProblem(world,actor,o,{force});
    if(problem){emit(world,{kind:'rejected',actorId:actor.id,reason:problem});return;}
    if(!force)world.spoils.splice(world.spoils.findIndex(s=>s.itemId===o.lock.key),1);
    o.unlocked=true;emit(world,{kind:'unlocked',actorId:actor.id,objectId:o.id,how:force?'force':'key'});
  }
  o.opened=true;emit(world,{kind:'used-object',actorId:actor.id,objectId:o.id,what:'container'});
}
// Taking from an open battlefield container: the reason it is refused, if any.
export function takeProblem(world,actor,o,items){
  if(!isContainer(o)||world.kind==='camp'||o.hidden||!o.opened||!Array.isArray(items)||!items.length||items.length>12)return 'NO_TARGET';
  const left=[...o.contents];for(const id of items){const i=left.indexOf(id);if(i<0)return 'NO_TARGET';left.splice(i,1);}
  if(world.spoils.length+items.length>60)return 'NO_TARGET';
  return distanceBetween(actor,o)>MOVEMENT.talkRange+.5?'OUT_OF_RANGE':null;
}
export function takeFrom(world,actor,o,items){
  for(const itemId of items){o.contents.splice(o.contents.indexOf(itemId),1);world.spoils.push({itemId,from:o.id});}
  emit(world,{kind:'taken',actorId:actor.id,targetId:o.id,items:[...items]});
}

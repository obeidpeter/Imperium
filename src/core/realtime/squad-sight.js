import {PERCEPTION,TIME} from '../../data/realtime-rules.js';
import {hostile} from './abilities.js';
import {noticeRate} from './ai.js';
import {span} from './navigation.js';
import {fielded,membersOf,squadCentre,squadsOf} from './squads.js';

// What a squad has seen (worlds and gameplay plan, release 3): one notice meter
// for each hostile squad and each hostile man, shared by its men and kept four
// times a second by the same perception rules as a single man's (ai.js
// noticeRate), from the squad's man nearest the one he watches. A squad lying
// in wait is half as easy to see. A blow or an exchange makes a squad know its
// attacker at once. What it has not seen it cannot meet: an exchange it never
// saw coming is an ambush (squads.js), and so is the soldier's first blow on
// one of its men (combat.js). Pure: no clock and no random draw.

const STEP=TIME.aiInterval/TIME.ticksPerSecond;
const emit=(world,event)=>world.events.push({tick:world.tick,...event});
const standing=o=>o.alive&&!o.down&&!o.carriedBy;
const nearestTo=(list,p)=>{let best=null,bd=Infinity;if(!p)return null;for(const o of list){const d=span(o.x-p.x,o.z-p.z);if(d<bd){bd=d;best=o;}}return best;};

export const lying=squad=>squad?.order?.kind==='lie_in_wait';
// How far a squad has noticed a hostile squad or man (by id): 0 to 100.
export const noticeOf=(squad,id)=>squad?.notice?.[id]??0;
// A squad whose men all keep hidden and that no hostile squad has seen.
export const unseen=(world,squad)=>{
  const men=membersOf(world,squad);if(!men.length||!men.every(m=>m.hidden))return false;
  return !squadsOf(world).some(o=>o!==squad&&fielded(world,o)&&hostile(o,squad)&&noticeOf(o,squad.id)>=100);
};
// A squad learns who struck it.
export function knowAttacker(squad,id){if(squad&&id)(squad.notice??={})[id]=100;}

// System 7 for squads, at the AI's 4 Hz.
export function squadSight(world){
  if(world.tick%TIME.aiInterval!==0)return;
  const squads=squadsOf(world).filter(s=>fielded(world,s));if(!squads.length)return;
  const singles=world.actors.filter(a=>standing(a)&&!a.squadId);
  for(const s of squads){
    const men=membersOf(world,s),notice=s.notice??={},seen=new Set();
    for(const t of squads){
      if(t===s||!hostile(s,t))continue;seen.add(t.id);
      const watcher=nearestTo(men,squadCentre(world,t)),target=nearestTo(membersOf(world,t),watcher);
      watch(world,s,t.id,watcher&&target?noticeRate(world,watcher,target)*(lying(t)?PERCEPTION.lying:1):0,t);
    }
    for(const a of singles){if(!hostile(s,a))continue;seen.add(a.id);const watcher=nearestTo(men,a);watch(world,s,a.id,watcher?noticeRate(world,watcher,a):0,null);}
    // Those gone from the field are forgotten.
    for(const id of Object.keys(notice))if(!seen.has(id))delete notice[id];
  }
}
function watch(world,s,id,rate,target){
  const before=s.notice[id]??0,after=rate>0?Math.min(100,before+rate*STEP):Math.max(0,before-PERCEPTION.decay*STEP);
  if(after>0)s.notice[id]=after;else delete s.notice[id];
  // A squad keeping hidden is found out when a hostile squad's notice of it fills.
  if(target&&before<100&&after>=100){const hid=membersOf(world,target).filter(m=>m.hidden);
    if(hid.length){for(const m of hid)m.hidden=false;emit(world,{kind:'squad-seen',squadId:target.id,byId:s.id});}}
}

import {ENEMY_AI,TIME} from '../../data/realtime-rules.js';
import {distanceBetween,hostile,staggered,validate} from './abilities.js';
import {span} from './navigation.js';

// Phase 0 enemy AI. An enemy stands until a foe comes within its notice
// radius, it is struck or its band engages. Then it engages the nearest foe
// from its own side of him (§3.10's group planner and notice meters arrive in
// Phase 1). A skirmisher throws its javelins from range first. Decisions run
// at 4 Hz, staggered by actor (§3.1, system 2), and set orders only: the
// movement and action systems carry them out.

export const decidesThisTick=(world,index)=>(world.tick+index)%TIME.aiInterval===0;

export function decideEnemy(world,actor,emit){
  if(!actor.alive||staggered(world,actor)||world.status!=='active')return;
  const foes=world.actors.filter(o=>o.alive&&hostile(actor,o));
  if(!foes.length){actor.order=null;return;}
  let target=foes[0],near=distanceBetween(actor,target);
  for(const f of foes){const d=distanceBetween(actor,f);if(d<near){near=d;target=f;}}
  if(actor.ai.state==='idle'){
    const band=world.actors.some(o=>o!==actor&&o.side===actor.side&&o.alive&&o.ai?.state==='engage');
    if(near>ENEMY_AI.noticeRadius&&actor.lastHitTick<0&&!band)return;
    actor.ai.state='engage';emit({kind:'notice',actorId:actor.id,targetId:target.id});
  }
  if(actor.ai.slot<0){
    // Its own side of the target, fixed from where it stood when it engaged.
    const taken=world.actors.filter(o=>o.side===actor.side&&o.ai&&o.ai.slot>=0).length,slot=taken%ENEMY_AI.spread.length;
    const d=span(actor.x-target.x,actor.z-target.z)||1,bx=(actor.x-target.x)/d,bz=(actor.z-target.z)/d,[c,s]=ENEMY_AI.spread[slot];
    actor.ai.slot=slot;actor.ai.dx=bx*c-bz*s;actor.ai.dz=bx*s+bz*c;
  }
  const {close,far}=ENEMY_AI.skirmish,javelins=actor.ammo?.javelin??0;
  if(actor.skirmisher&&javelins>0&&near>=close){
    if(near<=far){
      if(actor.order?.kind!=='ability'&&!validate(world,actor.id,'throw_javelin',{actorId:target.id}))
        actor.order={kind:'ability',abilityId:'throw_javelin',targetId:target.id};
      return;
    }
    actor.order={kind:'advance',targetId:target.id,stopAt:far-2};return;
  }
  actor.drawn=true;
  if(actor.order?.kind!=='attack'||actor.order.targetId!==target.id)actor.order={kind:'attack',targetId:target.id,slot:true};
}

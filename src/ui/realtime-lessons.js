import {DEFAULT_KEYMAP,firstKeyLabel} from './action-map.js';
import {missionProgress} from '../core/realtime/simulation.js';

// The guided opening in real time (build brief Phase 4, guide "Settings
// reference": step-by-step lessons in the drill, including pause and slow time,
// the first patrol and the opening chamber hours). Each lesson follows from the
// world and from what the player has already done (`seen`: the field's own
// memory of a pause and a slowing, never the world's). Pure: reading or hiding a
// lesson changes nothing.
const DRILL=[
  {id:'move',done:(w)=>w.used.includes('move'),title:'Find your footing',body:k=>`Click open ground to walk there; a far click runs. The arrow keys walk too.`},
  {id:'pause',done:(w,seen)=>seen.paused,title:'Pause to think',body:k=>`Press ${k('pause')}, or the Pause button. While paused, point at anything for its forecast: every command still works. Press ${k('pause')} again to go on.`},
  {id:'slow',done:(w,seen)=>seen.slowed,title:'Slow time',body:k=>`${k('slow_time')} halves the pace of the fight; press it again for full speed. While paused, ${k('step_round')} plays one round.`},
  {id:'draw',done:(w,seen,hero)=>!!hero?.drawn||w.used.includes('strike'),title:'Draw your weapon',body:k=>`${k('combat_toggle')}, or the crossed swords, draws it: your weapon’s numbers count only while it is drawn.`},
  {id:'strike',done:w=>w.used.includes('strike'),title:'Strike the drill partner',body:k=>`Click him, or ${k('target_next_enemy')} and then Enter: your soldier closes in and keeps striking until you choose otherwise.`},
  {id:'brace',done:w=>w.used.includes('brace'),title:'Brace behind your shield',body:k=>`Choose Brace on the ability bar (or its number key), then press the same key again to brace where you stand.`},
  {id:'throw',done:w=>w.used.includes('throw'),title:'Throw a pilum',body:k=>`Choose Throw pilum, then right-click the partner, or press its number twice with him as your target.`}];

export function realtimeLesson({state,world,kind='field',seen={},keymap=DEFAULT_KEYMAP}){
  // Each action by its first key, as the player has set it.
  if(!state||!world)return null;const k=action=>firstKeyLabel(action,keymap);
  if(kind==='chamber'){
    // The opening chamber hours: the first Contest walked as a chamber.
    const e=state.encounter;if(!e||e.status!=='active'||state.chapter!==7)return null;
    if(e.turn===1)return {step:'1 / 2',title:'Talk before you speak',body:'Click a member to talk where you stand: asking about his interests is free. Walk beside him, choose a speech and read its forecast before you give it.'};
    if(e.turn===2)return {step:'2 / 2',title:'The rivals answer each hour',body:`Hold ${k('show_usable')} to see where each rival means to walk next. ${k('yield_floor')} yields the floor; only the vote at the deadline counts.`};
    return null;
  }
  if(kind!=='field'||state.chapter!==1||world.status!=='active')return null;
  const hero=world.actors.find(a=>a.id===world.heroId);
  if(world.mission?.mode==='training'){
    const i=DRILL.findIndex(l=>!l.done(world,seen,hero));
    if(i<0)return {step:`${DRILL.length} / ${DRILL.length}`,title:'The drill is complete',body:'Varro gives his assessment when the drill ends; record the result to march on with the first patrol.'};
    return {step:`${i+1} / ${DRILL.length}`,title:DRILL[i].title,body:DRILL[i].body(k)};
  }
  // The first patrol: the objective first, then reading a fight before joining it.
  if(!seen.paused)return {step:'1 / 2',title:'Keep the objective in view',body:`${missionProgress(world)} Press ${k('pause')} whenever the fight gets busy.`};
  return {step:'2 / 2',title:'Read before you strike',body:`Point at an enemy for the forecast: your chance to hit and the damage after his armour. ${k('show_ranges')} shows your ranges; ${k('panel_orders')} holds the orders.`};
}

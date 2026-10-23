import {DEFAULT_KEYMAP,firstKeyLabel} from './action-map.js';
import {missionReadout} from './realtime-mission-readout.js';
import {TIME} from '../data/realtime-rules.js';

// The guided opening in real time (build brief Phase 4, guide "Settings
// reference": step-by-step lessons in the drill, including pause and slow time,
// the first patrol and the opening chamber hours). Each lesson follows from the
// world and from what the player has already done (`seen`: the field's own
// memory of a pause and a slowing, never the world's). Pure: reading or hiding a
// lesson changes nothing.
const DRILL=[
  {id:'move',done:(w)=>w.used.includes('move'),title:'Find your footing',body:k=>`The drill starts paused. Click the ground to choose a destination, then ${k('pause')} resumes. Far clicks run; arrow keys walk.`},
  {id:'pause',done:(w,seen)=>seen.paused,title:'Pause to think',body:k=>`Press ${k('pause')}, or select Pause. You can still choose actions. Press it again to resume.`},
  {id:'slow',done:(w,seen)=>seen.slowed,title:'Slow time',body:k=>`${k('slow_time')} toggles half speed. Options → Time controls has the same button. While paused, ${k('step_round')} plays one round.`},
  {id:'draw',done:(w,seen,hero)=>!!hero?.drawn||w.used.includes('strike'),title:'Draw your weapon',body:k=>`Press ${k('combat_toggle')}, or choose Options → Draw weapon, to use your weapon’s full strength.`},
  {id:'strike',done:w=>w.used.includes('strike'),title:'Strike the drill partner',body:k=>`Click him to approach and attack. Keyboard: ${k('target_next_enemy')}, then Enter. Fighting continues until you give another order.`},
  {id:'brace',done:w=>w.used.includes('brace'),title:'Brace behind your shield',body:()=>`Click Brace or press its number once. Self abilities act immediately; while paused, they are queued for resume.`},
  {id:'throw',done:w=>w.used.includes('throw'),title:'Throw a pilum',body:()=>`Select Throw pilum, then right-click the partner. Keyboard: target him, choose Throw pilum, then Enter.`}];

export function realtimeLesson({state,world,kind='field',seen={},keymap=DEFAULT_KEYMAP}){
  // Each action by its first key, as the player has set it.
  if(!state||!world)return null;const k=action=>firstKeyLabel(action,keymap);
  if(kind==='chamber'){
    // The opening chamber hours: the first Contest walked as a chamber.
    const e=state.encounter;if(!e||e.status!=='active'||state.chapter!==7)return null;
    if(e.turn===1)return {step:'1 / 2',title:'Talk before you speak',body:'Click a member. Asking about interests is free. Move closer if needed, then check the speech’s forecast before using it.'};
    if(e.turn===2)return {step:'2 / 2',title:'The rivals answer each hour',body:`Hold ${k('show_usable')} to see rival plans. ${k('yield_floor')} ends the hour. Only the final vote counts.`};
    return null;
  }
  if(kind!=='field'||world.status!=='active')return null;
  // Rescue instruction follows the same live facts as the objective strip.
  // It remains useful after treatment: healing is not the extraction objective.
  if(world.mission?.mode==='extract'||world.mission?.rescue){
    const readout=missionReadout(world,{keymap}),party=(world.mission.escorts??[]).map(id=>world.actors.find(a=>a.id===id)).filter(Boolean);
    const treatment=world.actors.some(a=>a.action?.what==='bind_wounds'&&party.some(p=>p.id===a.action.targetId));
    const wounded=party.some(a=>a.alive&&!a.carriedBy&&(!a.escort?.escorted||a.down));
    const carried=party.some(a=>a.carriedBy);
    return {step:wounded||treatment?'1 / 3':carried?'2 / 3':'3 / 3',title:treatment?'Cover the treatment':wounded?'Protect before you treat':carried?'Clear the carrying route':'Leave together',
      body:`${readout.next}${wounded&&!treatment?` ${k('pause')} pauses while you plan; healing alone does not keep him safe.`:''}`};
  }
  // The same combination applies wherever the commander brings a company.
  // Once a command has been given, the persistent order-status strip takes over.
  if(state.chapter>=4&&(world.squads??[]).some(q=>q.side!=='enemy')&&world.tick<TIME.roundTicks&&!(world.log??[]).some(l=>l.kind==='order'))
    return {step:'COMMAND',title:'Screen, then flank',body:missionReadout(world,{keymap}).tactic};
  if(state.chapter!==1)return null;
  const hero=world.actors.find(a=>a.id===world.heroId);
  if(world.mission?.mode==='training'){
    const i=DRILL.findIndex(l=>!l.done(world,seen,hero));
    if(i<0)return {step:`${DRILL.length} / ${DRILL.length}`,title:'The drill is complete',body:'Record the result after Varro’s assessment to continue to the patrol.'};
    return {step:`${i+1} / ${DRILL.length}`,title:DRILL[i].title,body:DRILL[i].body(k)};
  }
  // The first patrol: the objective first, then reading a fight before joining it.
  if(!seen.paused)return {step:'1 / 2',title:'Keep the objective in view',body:`Follow the objective above the scene. Press ${k('pause')} whenever you need time to choose.`};
  return {step:'2 / 2',title:'Read before you strike',body:`Point at an enemy to see hit chance and damage. ${k('show_ranges')} shows ranges; Mission details explains the objective.`};
}

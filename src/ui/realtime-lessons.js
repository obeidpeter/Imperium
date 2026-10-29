import {DEFAULT_KEYMAP,firstKeyLabel} from './action-map.js';
import {missionReadout} from './realtime-mission-readout.js';
import {TIME} from '../data/realtime-rules.js';

export const CONTEXT_LESSONS=Object.freeze(['deployment','orders','engineering','commitments']);
export function lessonProgress(value){
  const clean=list=>Array.isArray(list)?[...new Set(list.filter(id=>CONTEXT_LESSONS.includes(id)))]:[];
  return {completed:clean(value?.completed),dismissed:clean(value?.dismissed)};
}
export function rememberLesson(progress,id,complete=false){
  const next=lessonProgress(progress);if(!CONTEXT_LESSONS.includes(id))return next;
  const key=complete?'completed':'dismissed';if(!next[key].includes(id))next[key].push(id);return next;
}
const exercise=(id,step,title,body,complete=false)=>({id,step:`Optional exercise · ${step}`,title,body,complete});

// Progress is derived from accepted simulation commands, never from opening a
// tip or clicking its completion button. Preferences remember acknowledgement;
// the encounter, its RNG and its exact Retry checkpoint stay untouched.
function contextualLesson(state,world,kind,seen,progress){
  const tried=lessonProgress(progress),offer=id=>!tried.completed.includes(id)&&!tried.dismissed.includes(id);
  if(kind==='chamber'&&offer('commitments')){
    const e=state.encounter;if(!e||e.status!=='active')return null;
    const spoke=!!(e.commandCampaign?.case||e.precedentUsed||e.policy?.motion)||(e.usedAbilities??[]).some(a=>['persuade','promise','threaten','address','rebut','record','denounce','agreement'].includes(a));
    if(spoke){const debts=(e.staged?.obligations??[]).length+(e.staged?.agreements??[]).length,promised=!!e.promises?.length;
      return exercise('commitments','3 / 3','Your argument is on the record',promised||debts
        ?'You made a commitment. Open Menu → Campaign → Obligations & alliances to review its cost and due chapter. It is recorded with this encounter’s result; Retry restores the starting checkpoint.'
        :'You used an argument without a grain promise. Watch the changed vote forecast; Persuade, evidence and political agreements have different costs. A promise is always your choice.',true);}
    return seen.talked?exercise('commitments','2 / 3','Weigh the commitment','Compare a speech’s forecast before choosing it. Promise can gain support but creates a later cost. Try Persuade, evidence or another available argument instead if you do not want that debt. A successful speech completes this exercise.')
      :exercise('commitments','1 / 3','Talk before you commit','Click a delegate and ask about interests for free, or use All actions to talk. Then compare the speech forecasts. This exercise never asks you to take on a debt.');
  }
  if(kind!=='field'||world.status!=='active')return null;
  const used=world.used??[],deployment=world.deployment;
  if(offer('deployment')&&deployment&&(!deployment.done||used.includes('deploy'))){
    if(deployment.done)return exercise('deployment','3 / 3','Your formation is ready','You placed a unit and sounded the advance. Your placement changed the starting formation without spending battle time.',true);
    return deployment.placed?exercise('deployment','2 / 3','Begin when you are ready','Your placement is recorded. Reposition another unit if useful, then choose Sound the advance. The battle stays paused until you begin.')
      :exercise('deployment','1 / 3','Place before advancing','Select a friendly unit or standard and click marked deployment ground. Keyboard: select a unit, use arrows and Enter. Try one placement; no battle time passes.');
  }
  if(offer('orders')&&(world.squads??[]).some(q=>q.side!=='enemy')){
    if(used.includes('order')||(world.log??[]).some(e=>e.kind==='order'))return exercise('orders','3 / 3','Your order reached the squad','The order is in effect. Watch its status above the field; Command refills each round. A held front gives your soldier room to flank.',true);
    const queued=(world.queue??[]).some(c=>c.kind==='order')||(world.squads??[]).some(q=>q.side!=='enemy'&&q.pending);
    return queued?exercise('orders','2 / 3','Let the order reach them','The order is queued or on its way. Resume time to let it arrive. The order strip confirms when the squad receives it.')
      :exercise('orders','1 / 3','Give one clear order','Select a friendly standard, then choose Hold or another available order. You can issue it while paused. Watch Command and the order strip; selection alone does not spend a point.');
  }
  const works=(world.objects??[]).filter(o=>['breach','countermine','siege-engine'].includes(o.kind));
  if(offer('engineering')&&works.length){
    if(works.some(o=>o.done))return exercise('engineering','3 / 3','The work changed the field','Completed work now opens the wall or disables the enemy works. The result persists in the saved battle; an unfinished work action does not open a passage.',true);
    const progress=works.some(o=>o.progress>0);
    return progress?exercise('engineering','2 / 3','Finish under cover','The work has started. Use the same structure again if work remains. A hit interrupts an action, so hold a squad nearby while your soldier finishes.')
      :exercise('engineering','1 / 3','Inspect the engineering option','Select weakened wall, countermine timbering or the siege ramp through All actions or the scene. Read its work requirement, move into reach and use it under cover. It is optional unless named in the mission objective.');
  }
  return null;
}

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

export function realtimeLesson({state,world,kind='field',seen={},keymap=DEFAULT_KEYMAP,progress}){
  // Each action by its first key, as the player has set it.
  if(!state||!world)return null;const k=action=>firstKeyLabel(action,keymap);
  if(kind==='chamber'){
    const contextual=contextualLesson(state,world,kind,seen,progress);if(contextual)return contextual;
    // The opening chamber hours after the optional commitment exercise.
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
  const contextual=contextualLesson(state,world,kind,seen,progress);if(contextual)return contextual;
  // Once the exercises are done or skipped, the battle's own tactic again opens each later
  // battle with a company, until its first order. The order-status strip then takes over.
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

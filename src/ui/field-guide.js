import * as Game from '../core/game.js';
import {esc,actionNames} from './view-helpers.js';

// Lessons are derived from the real encounter and legal targets. Reading,
// dismissing, or reopening the guide never writes to the campaign or RNG.
export function fieldLesson(state,{selected='hero',action,target}={}){
  const e=state?.encounter;if(!e||e.status!=='active')return null;
  const hero=e.units.find(u=>u.id==='hero'),unit=e.units.find(u=>u.id===selected)||hero;
  const drill=e.type==='training',opening=state.chapter===1&&!drill;
  if(!drill&&!opening&&!(e.kind==='contest'&&e.turn<=2))return null;
  const actions=Game.getActions(state,unit.id);
  if(target&&action){const command={unitId:unit.id,action,x:target.x,y:target.y,...(target.unitId?{targetId:target.unitId}:{})},preview=Game.preview(state,command);
    return {title:'Read the result before you commit',body:preview.message,detail:preview.ok?'Confirm spends the move or action shown. Cancel costs nothing. Opponents act when you end the turn.':'This order cannot be issued. Choose another target or action.',step:'Preview'};}
  if(drill){
    const used=e.usedAbilities||[],next=['move','throw','strike','brace'].find(a=>!used.includes(a));
    const lessons={move:['Find your footing','Select open ground to walk there. Pointing at it, holding a finger on it, or moving the cursor onto it shows the route first. Move and the target list give the same choices.','Movement and your personal action are separate. You may still act after moving, and Undo Move takes a walk back until you do.'],throw:['Strike from a distance','Select Throw javelin and inspect the training target’s preview. If no target is in reach, move closer first.','A javelin is limited ammunition. The preview shows the exact cost and expected hit.'],strike:['Close the distance','Select Strike when a target is beside you. A move can bring you into reach.','Watch facing and protection. The preview explains how they affect the blow.'],brace:['Prepare for the reply','Brace strengthens your defence for the next exchange. Select your own position as the target.','End turn gives the opposition its reply and restores your move and action.']};
    if(!next)return {title:'The drill is complete',body:'You have practised moving, throwing, striking and bracing. End the turn for Varro’s assessment.',detail:'The first road patrol introduces objectives and fighting beside a companion.',step:'4 / 4'};
    if(!actions.includes(next)&&(next==='move'?unit.moved:unit.acted))return {title:'End the turn to continue the drill',body:`Your ${next==='move'?'movement':'personal action'} is spent. End turn restores it so you can practise ${actionNames[next].toLowerCase()}.`,detail:'The remaining lesson stays in your record. You do not need to restart or repeat completed lessons.',step:`${['move','throw','strike','brace'].indexOf(next)+1} / 4`};
    const [title,body,detail]=lessons[next];
    return {title,body,detail,step:`${['move','throw','strike','brace'].indexOf(next)+1} / 4`,action:actions.includes(next)&&Game.getTargets(state,unit.id,next).length?next:null};
  }
  if(e.kind==='contest')return {title:'Win a majority, then keep it',body:'Inspect a delegate’s interest and stance. Move within reach, compare Persuade with your other appeals, and read the exact support forecast.',detail:'Support at the deadline decides the motion. An agreement adds a future obligation; review its terms before accepting.',step:'Chamber'};
  const phase=Game.operationPhase(e);
  if(hero?.acted&&hero?.moved)return {title:'Consider the company before ending the turn',body:'Your commander has used both move and action. Review the visible enemy plans and your companion’s position, then end the turn.',detail:'An uncommanded companion follows their current orders. Keep the company close enough to support each other.',step:'First patrol'};
  return {title:phase?.index>1?'Bring the company through':'Keep the objective in view',body:phase?.objective||e.objective,detail:'Select an enemy to inspect their next plan. Compare attacking with moving into protection or bracing. A successful patrol needs both sound positioning and the marked objective.',step:phase?`Phase ${phase.index} / ${phase.total}`:'First patrol'};
}

export function fieldGuide(state,options={}){
  if(options.enabled===false)return '';
  const lesson=fieldLesson(state,options);if(!lesson)return '';
  return `<aside class="field-guide" aria-label="Guided learning"><div><p class="eyebrow">FIELD GUIDE · ${esc(lesson.step)}</p><h2>${esc(lesson.title)}</h2><p>${esc(lesson.body)}</p><small>${esc(lesson.detail)}</small></div><div class="field-guide-controls">${lesson.action?`<button data-cmd="action" data-id="${lesson.action}">Choose ${esc(actionNames[lesson.action])}</button>`:''}<button class="ghost small" data-cmd="dismiss-guide">Hide guide</button></div></aside>`;
}

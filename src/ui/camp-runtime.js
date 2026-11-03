import {campPresentationFor,campExitFor} from '../core/realtime/camp-world.js';
import {soldierSpec} from '../core/realtime/campaign-encounter.js';
import {departureCheck} from '../core/game.js';
import {CHAPTERS} from '../data/campaign.js';
import {campPlaceName} from '../data/camps.js';

// Required progress is independent of discovery/fast travel. A new arrival can
// always find the person or table needed to leave, without unlocking any place.
export function campNextTask(state,world=null){
  if(state?.phase!=='camp')return null;
  const chapter=CHAPTERS.find(c=>c.id===state.chapter);if(!chapter)return null;
  let task;
  if(!state.decisions?.[chapter.decision.id])task={label:'Visit the commander’s table',detail:'Make the chapter decision',place:'principia',tree:'table',objectId:'table'};
  else if(state.chapter===1&&state.encounterIndex>=1&&!state.oath)task={label:'Speak to Signifer Quintus',detail:'Swear the military oath',place:'principia',tree:'ch1:signifer',actorId:'signifer'};
  else if(departureCheck(state))task={label:'Review departure preparations',detail:departureCheck(state),place:'principia',panel:'services'};
  else {const exit=world?.objects?.find(o=>o.kind==='exit'),way=campExitFor(state);task={label:exit?.name??way?.name??chapter.encounters[state.encounterIndex]?.title??'Review your progress',detail:'Ready to depart',place:way?.place??'principia',objectId:exit?.id??'exit'};}
  const target=task.actorId?world?.actors?.find(a=>a.id===task.actorId):task.objectId?world?.objects?.find(o=>o.id===task.objectId):world?.places?.[task.place];
  return {...task,location:campPlaceName(state.chapter,task.place),...(target?{x:target.x,z:target.z}:{})};
}

export function campTaskCommand(task,world){
  if(!task||world?.kind!=='camp'||task.panel)return null;
  if(task.actorId&&world.actors.some(a=>a.id===task.actorId))return {actorId:world.heroId,kind:'talk',payload:{targetId:task.actorId}};
  if(task.objectId&&world.objects.some(o=>o.id===task.objectId))return {actorId:world.heroId,kind:'interact',payload:{objectId:task.objectId}};
  return null;
}

// The camp's way out is marked like an objective once nothing keeps the column in camp (the departure check the
// way out itself runs), so it can be found from wherever the soldier stands: null while something is still to do.
export function campWayOut(state,world){
  const exit=world?.kind==='camp'?(world.objects??[]).find(o=>o.kind==='exit'):null;
  return exit&&state?.phase==='camp'&&!departureCheck(state)?{label:exit.name}:null;
}

// Refresh the walkable camp when the soldier it draws and simulates changes.
// Use the same derived inputs as world creation, so unused training points,
// purse changes, visited flags and pack sorting do not restart an idle camp.
// Legacy soldierSpec is a read-only fallback; inspecting it never adopts one.
// A chest opened or emptied (soldier.opened) refreshes the camp world, not its scenery.
export function campRuntimeKey(state){
  return `camp:${state.chapter}:${state.encounterIndex}:${JSON.stringify({presentation:campPresentationFor(state),
    hero:soldierSpec(state),appearance:state.soldier?.appearance??null,opened:state.soldier?.opened??[]})}`;
}

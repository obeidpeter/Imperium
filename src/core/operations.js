import {BATTLE_OPERATIONS} from '../data/battle-operations.js';
import {blocked,distance,makeUnit,note,unitAt} from './shared.js';
import {difficultyRule} from './campaign-options.js';

const point=([x,y])=>({x,y});
const definition=e=>e.operation?.version===1?BATTLE_OPERATIONS[e.operation.id]:null;
function applyPhase(e){
  const phase=definition(e).phases[e.operation.index],escort=e.units.find(u=>e.mission.escortIds.includes(u.id));
  e.goal=phase.goal==='escort'?{x:escort.x,y:escort.y}:point(phase.goal);
  Object.assign(e.mission,{mode:phase.mode,holdRequired:phase.hold??0,holdProgress:0,points:(phase.points==='escort'?[[escort.x,escort.y]]:phase.points??[]).map(p=>({...point(p),secured:false}))});
  if(phase.escort&&!e.units.some(u=>u.id===phase.escort.id)){
    const spawn=point(phase.escort.at),cells=[];
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(!blocked(e.terrain[y][x])&&!unitAt(e,x,y))cells.push({x,y});
    cells.sort((a,b)=>distance(a,spawn)-distance(b,spawn)||a.y-b.y||a.x-b.x);
    const place=cells[0];if(place){e.units.push(makeUnit(phase.escort.id,phase.escort.name,'neutral',place.x,place.y,{hp:phase.escort.hp,role:'escort',move:2,escorted:true,intent:'Follow the commander to the evacuation marker.'}));e.mission.escortIds.push(phase.escort.id);}
  }
  if(phase.wave)e.mission.waves.push({x:phase.wave.x,y:phase.wave.y,role:phase.wave.role,turn:Math.min(30,e.turn+Math.max(1,phase.wave.delay+difficultyRule(e).wave)),arrived:false});
  e.objective=`Phase ${e.operation.index+1}/${definition(e).phases.length}: ${phase.objective} Complete every phase before the encounter deadline.`;
  note(e,`${phase.label}. ${phase.objective}`);
}
export function initializeOperation(state,e){
  const spec=BATTLE_OPERATIONS[e.id];if(state.campaignRules!==2||!spec)return;
  e.operation={version:1,id:e.id,index:0,completed:[],startedTurn:1};e.turnLimit=Math.min(27,e.turnLimit+spec.extraTurns);applyPhase(e);
}
export function operationEscortsMove(e){return !definition(e)?.phases[e.operation.index].pauseEscorts;}
export function operationGather(e){
  const radius=definition(e)?.phases[e.operation.index].gather;if(!radius)return null;
  const hero=e.units.find(u=>u.id==='hero'),friend=e.units.find(u=>u.side==='ally'&&u.hp>0),commanderNear=distance(hero,e.goal)<=radius,companionNear=friend&&distance(friend,e.goal)<=radius;
  // A withdrawn companion must not permanently lock the operation: the surviving
  // commander can still screen the road and carry out the remaining battle.
  return {complete:commanderNear&&(!friend||companionNear),progress:`Road screen: commander ${commanderNear?'ready':'approaching'} · companion ${!friend?'withdrawn':companionNear?'ready':'approaching'}`};
}
export function operationQualified(e){
  const phase=definition(e)?.phases[e.operation.index];if(!phase)return true;
  if(phase.commander&&distance(e.units.find(u=>u.id==='hero'),e.goal)>1)return false;
  if(phase.rescue&&!e.mission.escortIds.every(id=>e.units.find(u=>u.id===id)?.escorted))return false;
  if(phase.wave&&phase.mode==='hold'&&e.mission.waves.some(w=>!w.arrived))return false;
  return true;
}
export function advanceOperation(e){
  const spec=definition(e);if(!spec||e.operation.index>=spec.phases.length-1)return false;
  e.operation.completed.push(spec.phases[e.operation.index].id);e.operation.index++;e.operation.startedTurn=e.turn;applyPhase(e);return true;
}
export function operationPhase(e){
  const spec=e&&definition(e);if(!spec)return null;const phase=spec.phases[e.operation.index];
  return {id:phase.id,label:phase.label,objective:phase.objective,index:e.operation.index+1,total:spec.phases.length,progress:e.objectiveProgress??'',next:spec.phases[e.operation.index+1]?.label??null,completed:e.operation.completed.map(id=>spec.phases.find(p=>p.id===id).label)};
}
export function validateOperation(e,fail){
  if(e.operation===undefined){if(e.campaignRules===2&&BATTLE_OPERATIONS[e.id])fail('missing operation phase.');return;}
  const o=e.operation,spec=BATTLE_OPERATIONS[e.id];
  if(e.campaignRules!==2||!o||o.version!==1||o.id!==e.id||!spec||!Number.isInteger(o.index)||o.index<0||o.index>=spec.phases.length||!Number.isInteger(o.startedTurn)||o.startedTurn<1||o.startedTurn>e.turn||!Array.isArray(o.completed)||o.completed.length!==o.index||o.completed.some((id,i)=>id!==spec.phases[i].id))fail('operation phase.');
  if(e.mission.mode!==spec.phases[o.index].mode)fail('operation objective.');
  const phase=spec.phases[o.index],goal=phase.goal==='escort'?e.units.find(u=>e.mission.escortIds.includes(u.id)):point(phase.goal);
  if(!goal||e.goal.x!==goal.x||e.goal.y!==goal.y||e.mission.holdRequired!==(phase.hold??0))fail('operation target.');
  const points=phase.points==='escort'?[[goal.x,goal.y]]:phase.points??[];
  if(e.mission.points.length!==points.length||points.some(([x,y],i)=>e.mission.points[i].x!==x||e.mission.points[i].y!==y))fail('operation positions.');
  if(phase.escort&&!e.mission.escortIds.includes(phase.escort.id))fail('operation protected party.');
}

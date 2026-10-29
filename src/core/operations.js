import {BATTLE_OPERATIONS} from '../data/battle-operations.js';
import {blocked,distance,makeUnit,note,unitAt} from './shared.js';
import {difficultyRule} from './campaign-options.js';
import {PROGRESSION_OPERATIONS,progressionOperationDefinition} from '../data/progression-operations.js';
import {MISSION_BRANCHES,MISSION_OPERATIONS,missionOperationDefinition} from '../data/mission-operations.js';

const point=([x,y])=>({x,y});
const definition=e=>e.operation?.version===3?missionOperationDefinition(e.operation.id,e.operation.branch??null):e.operation?.version===2?progressionOperationDefinition(e.operation.id,e.operation.branch):e.operation?.version===1?BATTLE_OPERATIONS[e.operation.id]:null;
// A campaign begun from release 7 plays version 3 of the operations (data/mission-operations.js),
// with its own camp choices; one begun earlier keeps versions 1 and 2.
export const operationTable=missions=>missions?MISSION_OPERATIONS:BATTLE_OPERATIONS;
export const operationBranches=state=>state?.missionsVersion===1?MISSION_BRANCHES:PROGRESSION_OPERATIONS;
/** The current phase's definition, or null outside an operation. */
export const operationPhaseSpec=e=>e?.operation?definition(e)?.phases[e.operation.index]??null:null;
function applyPhase(e){
  const phase=definition(e).phases[e.operation.index],escort=e.units.find(u=>e.mission.escortIds.includes(u.id));
  for(const u of e.units)delete u.convoyLeg;
  e.goal=phase.goal==='escort'?{x:escort.x,y:escort.y}:point(phase.goal);
  Object.assign(e.mission,{mode:phase.mode,holdRequired:phase.hold??0,holdProgress:0,points:(phase.points==='escort'?[[escort.x,escort.y]]:phase.points??[]).map(p=>({...point(p),secured:false}))});
  const nearestFree=at=>{const spawn=point(at),cells=[];
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(!blocked(e.terrain[y][x])&&!unitAt(e,x,y))cells.push({x,y});
    return cells.sort((a,b)=>distance(a,spawn)-distance(b,spawn)||a.y-b.y||a.x-b.x)[0];};
  // A ladder (release 7) has already put its first climber, lightly armed, on the wall walk at its point.
  for(const [i,w] of (phase.works??[]).entries())if(w.kind==='ladder'&&!e.units.some(u=>u.id===`${w.id}-climbers`)){
    const place=nearestFree(phase.points[i]);if(place)e.units.push(makeUnit(`${w.id}-climbers`,w.climber,'enemy',place.x,place.y,{hp:7,damage:3,role:'infantry',facing:'west',anchor:{x:place.x,y:place.y},
      works:w.id,intent:'Hold the ladder’s head for the climbers behind.'}));
  }
  if(phase.escort&&!e.units.some(u=>u.id===phase.escort.id)){
    const place=nearestFree(phase.escort.at);if(place){e.units.push(makeUnit(phase.escort.id,phase.escort.name,'neutral',place.x,place.y,{hp:phase.escort.hp,role:'escort',move:2,escorted:true,intent:phase.convoy?'Follow the road to the marker.':'Follow the commander to the evacuation marker.'}));e.mission.escortIds.push(phase.escort.id);}
  }
  if(phase.wave)e.mission.waves.push({x:phase.wave.x,y:phase.wave.y,role:phase.wave.role,turn:Math.min(30,e.turn+Math.max(1,phase.wave.delay+difficultyRule(e).wave)),arrived:false});
  e.objective=`Phase ${e.operation.index+1}/${definition(e).phases.length}: ${phase.objective} Complete every phase before the encounter deadline.`;
  note(e,`${phase.label}. ${phase.objective}`);
}
export function initializeOperation(state,e){
  const missions=state.missionsVersion===1,branches=operationBranches(state);
  const branch=state.progressionVersion===1?(state.progression.operationChoices[e.id]??branches[e.id]?.[0].id??null):null;
  const spec=missions?missionOperationDefinition(e.id,branch):branch?progressionOperationDefinition(e.id,branch):BATTLE_OPERATIONS[e.id];if(state.campaignRules!==2||!spec)return;
  e.operation={version:missions?3:branch?2:1,id:e.id,index:0,completed:[],startedTurn:1,...(branch?{branch}:{})};e.turnLimit=Math.min(27,e.turnLimit+spec.extraTurns);applyPhase(e);
}
// A convoy (release 7) walks its route on its own, two tiles a turn at most, toward the next
// point it has not yet reached (its `convoyLeg`). It goes around anyone in the road, halts beside
// an enemy and never steps next to one; when its point is taken it stops beside it.
export function convoyStep(e,escort,route){
  const points=route.map(point),last=points.length-1,enemies=e.units.filter(u=>u.side==='enemy'&&u.hp>0&&!u.hidden);
  const open=(x,y)=>x>=0&&y>=0&&x<e.width&&y<e.height&&!blocked(e.terrain[y][x])&&!unitAt(e,x,y,escort.id)&&!enemies.some(u=>distance(u,{x,y})<=1);
  escort.convoyLeg=Math.min(escort.convoyLeg??0,last);
  // Its pace: two tiles a round, three once its road is cleared (an opportunity's 'escort' effect).
  for(let step=0;step<(e.campaignEdition===34?e.commandCampaign.escortPace:escort.move??2);step++){
    while(escort.convoyLeg<last&&distance(points[escort.convoyLeg],escort)<=1)escort.convoyLeg++;
    const target=points[escort.convoyLeg];
    if(distance(escort,target)===0||enemies.some(u=>distance(u,escort)<=1))return;
    // Steps to the target over open ground, counted back from it.
    const steps=new Map([[`${target.x},${target.y}`,0]]),queue=[target];
    for(let i=0;i<queue.length;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=queue[i].x+dx,y=queue[i].y+dy,key=`${x},${y}`;if(steps.has(key)||!open(x,y))continue;steps.set(key,steps.get(`${queue[i].x},${queue[i].y}`)+1);queue.push({x,y});}
    const here=steps.get(`${escort.x},${escort.y}`)??Infinity,options=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:escort.x+dx,y:escort.y+dy}))
      .filter(p=>open(p.x,p.y)&&(steps.get(`${p.x},${p.y}`)??Infinity)<here);
    options.sort((a,b)=>steps.get(`${a.x},${a.y}`)-steps.get(`${b.x},${b.y}`)||a.y-b.y||a.x-b.x);
    const p=options[0];if(!p)return;escort.x=p.x;escort.y=p.y;escort.moved=true;
  }
  while(escort.convoyLeg<last&&distance(points[escort.convoyLeg],escort)<=1)escort.convoyLeg++;
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
  const missions=e.missionsVersion===1;
  if(e.operation===undefined){if(e.campaignRules===2&&operationTable(missions)[e.id])fail('missing operation phase.');return;}
  const o=e.operation,spec=definition(e),chosen=e.progressionVersion===1&&!!(missions?MISSION_BRANCHES:PROGRESSION_OPERATIONS)[e.id];
  const versioned=missions?o?.version===3&&(o.branch!==undefined)===chosen:[1,2].includes(o?.version)&&!(o.version===2&&e.progressionVersion!==1)&&!(e.progressionVersion===1&&o.version!==2);
  if(e.campaignRules!==2||!o||!versioned||o.id!==e.id||!spec||!Number.isInteger(o.index)||o.index<0||o.index>=spec.phases.length||!Number.isInteger(o.startedTurn)||o.startedTurn<1||o.startedTurn>e.turn||!Array.isArray(o.completed)||o.completed.length!==o.index||o.completed.some((id,i)=>id!==spec.phases[i].id))fail('operation phase.');
  if(e.mission.mode!==spec.phases[o.index].mode)fail('operation objective.');
  const route=spec.phases[o.index].convoy?.route;
  if(e.units.some(u=>u.convoyLeg!==undefined&&(!route||u.role!=='escort'||!Number.isInteger(u.convoyLeg)||u.convoyLeg<0||u.convoyLeg>=route.length)))fail('convoy progress.');
  const phase=spec.phases[o.index],goal=phase.goal==='escort'?e.units.find(u=>e.mission.escortIds.includes(u.id)):point(phase.goal);
  if(!goal||e.goal.x!==goal.x||e.goal.y!==goal.y||e.mission.holdRequired!==(phase.hold??0))fail('operation target.');
  const points=phase.points==='escort'?[[goal.x,goal.y]]:phase.points??[];
  if(e.mission.points.length!==points.length||points.some(([x,y],i)=>e.mission.points[i].x!==x||e.mission.points[i].y!==y))fail('operation positions.');
  if(phase.escort&&!e.mission.escortIds.includes(phase.escort.id))fail('operation protected party.');
}

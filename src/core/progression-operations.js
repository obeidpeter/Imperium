import {CHAPTERS} from '../data/campaign.js';
import {PROGRESSION_OPERATIONS} from '../data/progression-operations.js';
import {alive,clamp,result} from './shared.js';
import {operationImpactDescription} from './campaign-consequences.js';

export function operationChoices(state){
  const id=state.encounter?.id??CHAPTERS[state.chapter-1]?.encounters[state.encounterIndex]?.id,choices=PROGRESSION_OPERATIONS[id]??[];
  return {enabled:state.progressionVersion===1&&state.phase==='camp'&&choices.length>0,encounterId:id??null,selected:state.progression?.operationChoices[id]??choices[0]?.id??null,choices:choices.map(({id,label,description,reward,benefit})=>({id,label,description,reward:{...reward},benefit,consequence:(benefit==='reserve'?'Next field action: deployed veterans gain 2 starting health (up to their normal maximum).':benefit==='stores'?'Next field action: the commander carries one extra javelin.':'Next field action: its first announced reinforcement arrives one turn later; without one, the commander carries an extra javelin.')+' '+operationImpactDescription(benefit)+' A withdrawn veteran makes this a costly victory: no operation reward or next-field benefit.'}))};
}
export function chooseOperation(state,id){const plan=operationChoices(state);if(!plan.enabled||!plan.choices.some(x=>x.id===id))return result(false,'Choose an available operation before departure.');state.progression.operationChoices[plan.encounterId]=id;return result(true,`${plan.choices.find(x=>x.id===id).label} selected. The reward is earned only by completing the operation.`);}
export function applyOperationConsequences(state,e){
  if(state.progressionVersion!==1||e.type==='training')return;
  e.appliedOperations=[];
  for(const record of state.progression.operationResults.filter(x=>!x.consumedBy)){
    e.appliedOperations.push(record.encounterId);
    if(record.outcome==='costly')continue;
    if(record.benefit==='reserve')for(const u of e.units.filter(u=>u.side==='ally'&&u.veteranId))u.hp=Math.min(u.maxHp,u.hp+2);
    else if(record.benefit==='intelligence'&&e.mission.waves.length)e.mission.waves[0].turn=Math.min(30,e.mission.waves[0].turn+1);
    else e.units.find(u=>u.id==='hero').ammo++;
    e.log.push(`Previous operation: ${record.label}. ${record.benefit==='reserve'?'Rested veterans recover up to 2 starting health.':record.benefit==='intelligence'&&e.mission.waves.length?'Reconnaissance delays the first reinforcement by one turn.':'Recovered equipment adds one javelin.'}`);
  }
}
export function commitOperationResult(state,e){
  if(state.progressionVersion!==1||e.kind!=='battle')return;
  for(const id of e.appliedOperations??[]){const r=state.progression.operationResults.find(x=>x.encounterId===id);if(r)r.consumedBy=e.id;}
  if(e.operation?.version!==2)return;
  const branch=PROGRESSION_OPERATIONS[e.id]?.find(x=>x.id===e.operation.branch);if(!branch)return;
  const costly=e.units.some(u=>u.veteranId&&!alive(u)),reward=costly?{}:branch.reward;
  state.supplies=clamp(state.supplies+(reward.supplies??0),0,99);
  for(const key of ['army','public','political'])state.meters[key]=clamp(state.meters[key]+(reward[key]??0));
  state.progression.operationResults.push({encounterId:e.id,choice:branch.id,label:branch.label,outcome:costly?'costly':'clean',benefit:branch.benefit,consumedBy:null});
  state.log.push(`${branch.label}: ${costly?'The objective succeeded, but a veteran’s withdrawal used the spare stores and reserve. No operation bonus.':'The company returned intact; the promised resources and next-field advantage are secured.'}`);
  if(state.log.length>100)state.log.splice(0,state.log.length-100);
}

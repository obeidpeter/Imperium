import {CHAPTERS} from '../data/campaign.js';
import {PROGRESSION_OPERATIONS} from '../data/progression-operations.js';
import {NEGOTIATORS} from '../data/negotiators.js';
import {initialNegotiators} from './progression-politics.js';
import {VETERAN_PATHS} from './progression-veterans.js';
import {validateFieldReports} from './campaign-consequences.js';

export function initialProgression(enabled){return enabled?{progressionVersion:1,progression:{specializations:{},operationChoices:{},operationResults:[],negotiators:initialNegotiators(),agreements:[]}}:{};}
const record=x=>x&&typeof x==='object'&&!Array.isArray(x);
const bounded=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
const encounterChapter=id=>CHAPTERS.find(c=>c.encounters.some(e=>e.id===id))?.id;
function validateAgreement(a,fail){
  const p=NEGOTIATORS.find(x=>x.id===a?.personId),chapter=encounterChapter(a?.encounterId),full=a?.kind==='demand';
  if(!record(a)||!p||!chapter||!CHAPTERS[chapter-1].encounters.some(e=>e.id===a.encounterId&&e.kind==='contest')||a.id!==`${a.encounterId}:${a.personId}`||a.personName!==p.name||!['demand','counteroffer'].includes(a.kind)||a.pledge!==(full?p.demand:p.counter)||a.cost!==(full?3:1)||a.trustGain!==(full?2:1)||a.due!==Math.min(12,chapter+1)||!['open','honoured','broken'].includes(a.status))fail('negotiated agreement.');
}
export function validateProgression(state,fail){
  if(state.progressionVersion===undefined){if(state.progression!==undefined||state.encounter?.progressionVersion!==undefined)fail('unversioned progression.');return;}
  if(state.progressionVersion!==1||state.campaignRules!==2||!record(state.progression))fail('progression version.');
  const p=state.progression,ids=state.company?.map(v=>v.id)??[];
  validateFieldReports(state,fail);
  if(!record(p.specializations)||Object.keys(p.specializations).some(id=>!ids.includes(id)||!VETERAN_PATHS.some(x=>x.id===p.specializations[id])||state.chapter<3||state.company.find(v=>v.id===id).service<2))fail('veteran specialization.');
  if(!record(p.operationChoices)||Object.entries(p.operationChoices).some(([id,choice])=>!PROGRESSION_OPERATIONS[id]?.some(x=>x.id===choice)))fail('operation selection.');
  if(!Array.isArray(p.operationResults)||p.operationResults.length>11||new Set(p.operationResults.map(x=>x?.encounterId)).size!==p.operationResults.length)fail('operation result list.');
  for(const r of p.operationResults){const branch=PROGRESSION_OPERATIONS[r?.encounterId]?.find(x=>x.id===r.choice);if(!record(r)||!branch||r.label!==branch.label||r.benefit!==branch.benefit||!['clean','costly'].includes(r.outcome)||!state.history.some(x=>x.id===r.encounterId)||r.consumedBy!==null&&!state.history.some(x=>x.id===r.consumedBy&&x.kind==='battle'))fail('operation result.');}
  if(!record(p.negotiators)||Object.keys(p.negotiators).length!==NEGOTIATORS.length)fail('coalition identities.');
  for(const person of NEGOTIATORS){const n=p.negotiators[person.id];if(!record(n)||!bounded(n.trust,-3,3)||!bounded(n.fulfilled,0,6)||!bounded(n.broken,0,6))fail('coalition relationship.');}
  if(!Array.isArray(p.agreements)||p.agreements.length>12||new Set(p.agreements.map(a=>a?.id)).size!==p.agreements.length)fail('agreement list.');
  for(const a of p.agreements){validateAgreement(a,fail);if(!state.history.some(h=>h.id===a.encounterId))fail('uncommitted agreement.');}
  const open=p.agreements.filter(a=>a.status==='open');if(new Set(open.map(a=>a.personId)).size!==open.length)fail('duplicate open agreement.');
  if(state.phase!=='encounter')return;
  const e=state.encounter;if(e?.progressionVersion!==1||state.snapshot?.progressionVersion!==1)fail('encounter progression version.');
  for(const u of e.units){if(u.specialization!==undefined&&(!VETERAN_PATHS.some(x=>x.id===u.specialization)||u.specialization!==p.specializations[u.veteranId]||u.side!=='ally'))fail('deployed specialization.');if(u.specialistAmmo!==undefined&&(u.specialization!=='ranged'||!bounded(u.specialistAmmo,0,2)))fail('specialist ammunition.');if(u.guardTargetId!==undefined&&(u.specialization!=='protector'||!e.units.some(x=>x.id===u.guardTargetId&&x.side!=='enemy')))fail('protected unit.');}
  if(e.kind==='battle'){
    if(e.type!=='training'&&(!Array.isArray(e.appliedOperations)||new Set(e.appliedOperations).size!==e.appliedOperations.length||e.appliedOperations.some(id=>!p.operationResults.some(r=>r.encounterId===id&&r.consumedBy===null))))fail('operation consequence checkpoint.');
  }else{
    const members=e.units.filter(u=>u.role==='voter');if(members.length!==9||members.some((u,i)=>u.negotiatorId!==NEGOTIATORS[i].id||u.name!==NEGOTIATORS[i].name||u.bloc!==NEGOTIATORS[i].bloc||u.interest!==NEGOTIATORS[i].interest))fail('recurring delegates.');
    const staged=e.staged?.agreements;if(!Array.isArray(staged)||staged.length>2||new Set(staged.map(x=>x?.personId)).size!==staged.length)fail('staged agreements.');
    for(const a of staged){validateAgreement(a,fail);if(a.encounterId!==e.id||a.status!=='open'||open.some(x=>x.personId===a.personId))fail('agreement transaction.');}
  }
}

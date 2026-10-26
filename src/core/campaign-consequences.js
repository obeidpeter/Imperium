import {CHAPTERS} from '../data/campaign.js';

// Read the committed record, not the current battle's provisional rewards.
// Existing chronicles need no invented history or migration to use this.
export function careerEvidence(state){
  const results=state.progressionVersion===1?state.progression.operationResults:[];
  const clean=results.filter(r=>r.outcome==='clean');
  return {relief:clean.filter(r=>r.benefit==='reserve'),security:clean.filter(r=>r.benefit==='intelligence'),
    logistics:clean.filter(r=>r.benefit==='stores'),costly:results.filter(r=>r.outcome==='costly'),
    honoured:state.progressionVersion===1?state.progression.agreements.filter(a=>a.status==='honoured'):[]};
}
export function delegateRecordBonus(state,person){
  const evidence=careerEvidence(state),type=person.bloc==='Civic'?'relief':person.bloc==='Veterans'?'security':'logistics',records=evidence[type];
  return {amount:state.tacticsEdition===35?Math.min(2,Math.floor(records.length/2)):0,type,labels:records.map(r=>r.label)};
}
export function finaleCareerSupport(state){
  const evidence=careerEvidence(state),military=new Set(evidence.honoured.filter(a=>['faustus','valens','priscus'].includes(a.personId)).map(a=>a.personId));
  const intelligence=evidence.security.length>=2,pledges=military.size>=2;
  return {intelligence,pledges,reservesRemoved:Number(intelligence)+Number(pledges),
    reasons:[...(intelligence?['Two successful reconnaissance operations let your scouts intercept one rival reserve before it reaches the field.']:[]),
      ...(pledges?['Honoured agreements with two military representatives persuade another reserve to remain neutral.']:[])],
    description:intelligence||pledges?`${Number(intelligence)+Number(pledges)} rival reserve ${intelligence&&pledges?'cohorts will':'cohort will'} not reach the battle. ${intelligence?'Your reconnaissance network intercepts the first. ':''}${pledges?'Veteran representatives hold another neutral.':''}`.trim():
      'The rival’s reserves remain committed. Two clean reconnaissance operations or honoured agreements with two military representatives can each remove one reserve from the final battle.'};
}
export const operationImpactDescription=benefit=>benefit==='intelligence'?
  'In real time, scouts also open the next side gate, or reveal one concealed enemy position when there is no closed gate.':benefit==='stores'?
  'In real time, the next damaged bridge starts repaired; without one, the field opportunity remains available two rounds longer.':
  'In real time, protected columns gain 4 health and friendly formations gain 10 cohesion in the next field action.';

export function fieldReportText(report){
  const works=report.works?`${report.engineering}/${report.works} siege works secured. `:'';
  const outcome=report.withdrawals?'The objective is secure, but the company must recover before it can offer engineering support.':
    report.works&&report.engineering<report.works?'The objective is secure; unfinished siege works remain an enemy threat.':
      report.works?'The engineers return intact with the captured works’ plans. Their support completes each work action in the next field battle.':
        report.opportunity?'The field objective and its supplies or signal were secured.':'The main objective is secure. The field opportunity was left behind.';
  return `${works}${outcome}`;
}
export function commitFieldReport(state,e){
  if(state.progressionVersion!==1||e.kind!=='battle'||e.type==='training'||e.status!=='won')return;
  if(state.progression.fieldReports?.some(r=>r.id===e.id))return;
  for(const r of state.progression.fieldReports??[])if(r.consumedBy===null)r.consumedBy=e.id;
  const report=e.staged?.fieldReport;if(!report)return;
  state.progression.fieldReports??=[];
  if(!state.progression.fieldReports.some(r=>r.id===e.id))state.progression.fieldReports.push({...report,consumedBy:null});
}
export function campaignDispatches(state){
  const reports=state.progressionVersion===1?state.progression.fieldReports??[]:[];
  return reports.slice(-3).map(r=>({id:r.id,title:CHAPTERS.flatMap(c=>c.encounters).find(e=>e.id===r.id)?.title??r.id,text:fieldReportText(r)}));
}
export function validateFieldReports(state,fail){
  const reports=state.progression?.fieldReports;
  if(reports!==undefined){
    if(!Array.isArray(reports)||reports.length>25||new Set(reports.map(r=>r?.id)).size!==reports.length)fail('field report list.');
    for(const r of reports){validateReport(r,fail);if(!state.history.some(h=>h.id===r.id&&h.kind==='battle')||r.consumedBy!==null&&!state.history.some(h=>h.id===r.consumedBy&&h.kind==='battle'))fail('uncommitted field report.');}
  }
  const staged=state.encounter?.staged?.fieldReport;
  if(staged!==undefined){validateReport(staged,fail);if(staged.id!==state.encounter.id||state.encounter.controls!=='realtime')fail('field report checkpoint.');}
}
function validateReport(r,fail){
  const integer=(n,max)=>Number.isInteger(n)&&n>=0&&n<=max;
  if(!r||r.version!==1||!CHAPTERS.some(c=>c.encounters.some(e=>e.id===r.id&&e.kind==='battle'))||
    !integer(r.works,16)||!integer(r.engineering,r.works)||!integer(r.withdrawals,24)||typeof r.opportunity!=='boolean')fail('field report.');
}

import {CHAPTERS} from '../data/campaign.js';
import {alive,clamp,distance,result} from './shared.js';

const LEVELS=[
  {id:'story',label:'Story',description:'Three extra field turns, reinforcements two turns later, gentler objective pressure and rival speeches. The same objectives and earned promotions.'},
  {id:'standard',label:'Standard',description:'The established combat and political balance, with company planning and evolving field objectives.'},
  {id:'veteran',label:'Veteran',description:'Reinforcements one turn earlier (in real time at full strength from Chapter IV, with battle deadlines two rounds shorter), stronger objective pressure and rival speeches. No enemy is hardier or hits harder; evacuation travel time is preserved.'},
];
const PACKAGES=[
  {id:'none',label:'Keep supplies',cost:0,description:'Deploy with the company’s current condition.'},
  {id:'recovery',label:'Medical recovery',cost:2,description:'Clear existing recovery for the deployed veterans. Fresh wounds still count after this battle.'},
  {id:'rearm',label:'Rearm the commander',cost:2,description:'Carry two extra javelins into the next battle.'},
  {id:'support',label:'Supply support',cost:3,description:'All friendly troops and protected columns begin with 15 extra morale; guarded stores gain 15 integrity.'},
];
const SPECIALISTS={lucan:['Steady companion','infantry'],sabinus:['Relief veteran','infantry'],naso:['Shield infantry','infantry'],felix:['Bowman','archer'],firmus:['Marching infantry','infantry'],rufus:['Standard guard','infantry']};
export const difficultyOptions=()=>LEVELS.map(x=>({...x}));
export const modernCampaign=s=>s.campaignRules===2;
export const finaleCompanySize=state=>Math.min(7,3+Math.floor(state.meters.army/25));
export const difficultyRule=e=>e.campaignRules===2?(e.difficulty==='story'?{turns:3,wave:2,pressure:6,speech:-1}:e.difficulty==='veteran'?{turns:0,wave:-1,pressure:14,speech:1}:{turns:0,wave:0,pressure:10,speech:0}):{turns:0,wave:0,pressure:10,speech:0};
export function initialCampaignOptions(difficulty='standard'){
  if(!LEVELS.some(d=>d.id===difficulty))throw new Error('Choose Story, Standard or Veteran difficulty.');
  return {campaignRules:2,difficulty,companyOrders:{priority:['lucan','naso','felix','firmus','rufus'],package:'none'}};
}
export function campaignOptionsProblem(state,options){
  if(!options||typeof options!=='object'||Array.isArray(options))return 'Encounter options must be an object.';
  if(modernCampaign(state)&&((options.legacyLayout!==undefined&&options.legacyLayout!==false)||['combatVersion','politicsVersion'].some(k=>options[k]!==undefined&&options[k]!==2)))return 'New campaigns use their selected campaign rules. Legacy encounter rules belong to imported checkpoints.';
  return null;
}
function nextBattle(state){const data=CHAPTERS[state.chapter-1]?.encounters[state.encounterIndex];return data?.kind==='battle'&&data.type!=='training'?data:null;}
export function companyPlan(state){
  const data=nextBattle(state),enabled=modernCampaign(state)&&state.phase==='camp'&&!!data,slots=!data?0:state.chapter===12?Math.min(5,finaleCompanySize(state)):state.chapter<4?1:state.chapter===4?3:state.chapter<7?4:5;
  const excluded=data?.id==='ch2-marsh'&&state.decisions.ch2!=='leave'?'lucan':null;
  const priority=state.companyOrders?.priority??state.company.map(v=>v.id),available=state.company.map(v=>({...v,role:state.chapter>=3?SPECIALISTS[v.id][1]:'infantry',specialty:state.chapter>=3?SPECIALISTS[v.id][0]:'Legionary',available:v.id!==excluded,reason:v.id===excluded?'Lucan is the wounded man being rescued.':''}));
  const selectedIds=priority.filter(id=>available.some(v=>v.id===id&&v.available)).slice(0,slots),selectedPackage=state.companyOrders?.package??'none';
  const packages=PACKAGES.map(p=>({...p,available:enabled&&state.supplies>=p.cost&&(p.id!=='recovery'||selectedIds.some(id=>state.company.find(v=>v.id===id).recovery>0))}));
  return {enabled,legacy:!modernCampaign(state),encounterId:data?.id??null,slots:Math.min(slots,available.filter(v=>v.available).length),available,selectedIds,selectedPackage,packages,cost:PACKAGES.find(p=>p.id===selectedPackage)?.cost??0,description:'Choose the deployed veterans and their order in the line. Unselected veterans rest. One supply package is paid at departure; Retry restores the same paid deployment.'};
}
export function selectCompany(state,ids){
  const plan=companyPlan(state);
  if(!plan.enabled||!Array.isArray(ids)||ids.length!==plan.slots||new Set(ids).size!==ids.length||ids.some(id=>!plan.available.some(v=>v.id===id&&v.available)))return result(false,`Choose exactly ${plan.slots} available veterans in deployment order before this battle.`);
  state.companyOrders.priority=[...ids,...state.companyOrders.priority.filter(id=>!ids.includes(id))];
  if(state.companyOrders.package==='recovery'&&!ids.some(id=>state.company.find(v=>v.id===id).recovery>0))state.companyOrders.package='none';
  return result(true,'Company deployment order recorded. Supplies have not been spent.');
}
export function prepareCompany(state,id){
  const plan=companyPlan(state),option=plan.packages.find(p=>p.id===id);
  if(!option?.available)return result(false,'Choose an affordable supply package for the next battle; medical recovery requires a wounded deployed veteran.');
  state.companyOrders.package=id;return result(true,`${option.label} selected: ${option.cost} supplies at departure. This replaces the previous package.`);
}
export function departureProblem(state){const plan=companyPlan(state);if(!plan.enabled)return null;return plan.packages.find(p=>p.id===plan.selectedPackage)?.available?null:'The selected company package is no longer affordable or useful. Choose another package before departure.';}
export function departCompany(state){
  const plan=companyPlan(state);if(!plan.enabled)return;
  state.supplies-=plan.cost;
  if(plan.selectedPackage==='recovery')for(const v of state.company)if(plan.selectedIds.includes(v.id))v.recovery=0;
}
export function deploymentVeteran(state,index,dataId=nextBattle(state)?.id){
  if(!modernCampaign(state))return state.company?.[index];
  const excluded=dataId==='ch2-marsh'&&state.decisions.ch2!=='leave'?'lucan':null;
  const ids=state.companyOrders.priority.filter(id=>id!==excluded);return state.company.find(v=>v.id===ids[index]);
}
export function applyCompanyKit(state,e){
  if(!modernCampaign(state))return;e.campaignRules=2;e.difficulty=state.difficulty;
  if(e.type==='training')return;
  e.companyPackage=state.companyOrders.package;
  for(const u of e.units.filter(u=>u.side==='ally'&&u.veteranId))if(state.chapter>=3)u.role=SPECIALISTS[u.veteranId][1];
  if(e.companyPackage==='rearm')e.units.find(u=>u.id==='hero').ammo+=2;
  if(e.companyPackage==='support'){e.defence+=15;for(const u of e.units.filter(u=>u.side!=='enemy'))u.morale=clamp(u.morale+15);}
}
export function tacticalAdvice(state){
  const e=state.encounter;if(!e||e.status!=='active')return [];
  if(e.kind==='contest'){
    const support=e.units.filter(u=>u.vote==='for'||u.role==='voter'&&u.stance>=1).length,remaining=e.turnLimit-e.turn+1;
    const advice=[`${support}/${e.electorate} currently support you; ${e.majority} votes are needed after ${remaining} more end turn${remaining===1?'':'s'}. An early majority does not finish the vote.`];
    if(e.units.some(u=>['player','ally'].includes(u.side)&&u.role==='speaker'&&u.resolve>0&&u.resolve<=4)&&state.chapter>=10)advice.push('A friendly speaker has little Resolve left. Rebut can restore four Resolve to a friendly speaker in range; withdrawal removes their speeches, but their vote remains.');
    else advice.push('Members at stance +3 or higher resist reversal. Compare the preview’s actual vote gain before spending a speech on an already committed supporter.');
    if(state.chapter>=8&&e.promises.length<2)advice.push(`Promise can gain interest-specific support, but creates a two-supply obligation due at accession. ${2-e.promises.length} promise${e.promises.length===1?'':'s'} remain in this vote.`);
    else if(state.chapter>=11)advice.push('Invoke Record works once per recipient. An unused service-minded delegate may value it more than a delegate seeking an office or grain.');
    return advice.slice(0,3);
  }
  if(e.kind!=='battle')return [];
  const hero=e.units.find(u=>u.id==='hero'),allies=e.units.filter(u=>u.side==='ally'&&alive(u)),enemies=e.units.filter(u=>u.side==='enemy'&&alive(u)&&!u.hidden),advice=[];
  if(e.type==='training')return ['Move and action are separate: throw from safety, then move, or move into reach before striking. Brace spends the action; it does not deal damage.'];
  const close=enemies.filter(u=>distance(u,hero)<=2),support=allies.some(u=>distance(u,hero)<=2);
  if(close.length&& !support)advice.push('Your commander is exposed. Move back toward a companion before committing; a nearby friendly line can keep several enemies from reaching you.');
  if(close.length&&hero.braced)advice.push('Brace buys time but does not remove a threat. On your next turn, compare a finishing strike or a javelin with another defensive action.');
  if(enemies.some(u=>distance(u,hero)===2)&&!hero.acted&&hero.ammo>0)advice.push('A javelin can weaken a threat without entering its adjacent engagement zone. Read the frontal-shield modifier before committing.');
  if(e.mission?.escortIds.length)advice.push('Keep within four tiles of the protected column. A cleared route is useful only if the column can follow it.');
  if(e.operation)advice.push('The next phase changes your objective. Keep a reserve near the road instead of sending every ally after the last enemy.');
  if(state.chapter>=4&&e.commandsLeft>0)advice.push('Orders spend command capacity, not a second allied action. Give a threatened unit Hold or Withdraw before ending the turn.');
  return advice.slice(0,3);
}
export function validateCampaignOptions(state,fail){
  // Release 7's missions (data/mission-operations.js) belong to modern campaigns begun with them, and so do their battles.
  if(state.missionsVersion!==undefined&&(state.missionsVersion!==1||state.campaignRules!==2))fail('missions version.');
  if(state.phase==='encounter'&&state.encounter?.kind==='battle'&&state.encounter.missionsVersion!==state.missionsVersion)fail('encounter missions version.');
  if(state.campaignRules===undefined){if(state.difficulty!==undefined||state.companyOrders!==undefined)fail('campaign options require a rules version.');return;}
  if(state.campaignRules!==2||!LEVELS.some(d=>d.id===state.difficulty))fail('campaign difficulty or rules version.');
  if(campaignOptionsProblem(state,state.encounterOptions))fail('encounter checkpoint options.');
  const orders=state.companyOrders,ids=state.company?.map(v=>v.id)??[];
  if(!orders||Array.isArray(orders)||!Array.isArray(orders.priority)||orders.priority.length!==5||new Set(orders.priority).size!==5||orders.priority.some(id=>!ids.includes(id))||!PACKAGES.some(p=>p.id===orders.package))fail('company deployment plan.');
}

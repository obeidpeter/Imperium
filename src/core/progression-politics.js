import {NEGOTIATORS} from '../data/negotiators.js';
import {delegateRecordBonus} from './campaign-consequences.js';
import {alive,clamp,distance,note,result} from './shared.js';
const shift=(stance,delta)=>clamp(stance+((stance<=-3&&delta>0)||(stance>=3&&delta<0)?Math.sign(delta)*Math.max(1,Math.ceil(Math.abs(delta)/2)):delta),-6,6);
const person=id=>NEGOTIATORS.find(x=>x.id===id);
export function initialNegotiators(){return Object.fromEntries(NEGOTIATORS.map(x=>[x.id,{trust:0,fulfilled:0,broken:0}]));}
export function applyCoalition(state,e){
  if(state.progressionVersion!==1)return;e.progressionVersion=1;e.staged.agreements=[];
  const members=e.units.filter(u=>u.role==='voter');
  for(const [index,u]of members.entries()){
    const p=NEGOTIATORS[index];if(!p)continue;const record=state.progression.negotiators[p.id];
    const evidence=delegateRecordBonus(state,p);
    Object.assign(u,{negotiatorId:p.id,name:p.name,bloc:p.bloc,interest:p.interest,stance:clamp(u.stance+record.trust+evidence.amount,-6,6)});
    if(evidence.amount)e.log.push(`${p.name}: your ${evidence.type} record earns ${evidence.amount} starting support (${evidence.labels.join('; ')}).`);
  }
}
export function coalition(state){
  const enabled=state.progressionVersion===1;
  return {enabled,members:enabled?NEGOTIATORS.map(p=>({...p,...state.progression.negotiators[p.id]})):[],agreements:enabled?state.progression.agreements.map(a=>({...a,dueNow:state.chapter>=a.due&&a.status==='open',canHonour:state.phase==='camp'&&state.chapter>=a.due&&a.status==='open'&&state.supplies>=a.cost,consequence:`Honour: −${a.cost} supplies, trust +${a.trustGain}, ${a.kind==='demand'?'+2':' +1'} Political Backing. Break: trust −2, Public Confidence −3. Trust changes this named representative’s starting stance in every later Contest.`})):[]};
}
export function agreementOptions(state,targetId){
  const e=state.encounter,u=e?.units.find(x=>x.id===targetId),p=person(u?.negotiatorId),hero=e?.units.find(x=>x.id==='hero');
  const staged=e?.staged?.agreements??[],existing=p&&[...state.progression?.agreements??[],...staged].find(a=>a.personId===p.id&&a.status==='open');
  let reason='';if(state.progressionVersion!==1)reason='Agreements belong to a new progression campaign.';else if(state.phase!=='encounter'||e?.kind!=='contest'||e.status!=='active'||!p)reason='Choose a named representative in the current active Contest.';else if(!alive(hero)||hero.acted)reason='The commander must have a speech available.';else if(distance(hero,u)>2)reason='Move within two tiles of the representative.';else if(existing)reason='Resolve this representative’s existing agreement before offering another.';else if(staged.length>=2)reason='At most two negotiated agreements may be made in one Contest.';
  const due=Math.min(12,state.chapter+1),options=p?['demand','counteroffer'].map(kind=>{const full=kind==='demand',delta=full?3:2,cost=full?3:1;return {id:kind,label:full?'Accept the demand':'Offer a limited counterproposal',pledge:full?p.demand:p.counter,cost,due,trustGain:full?2:1,stanceFrom:u.stance,stanceTo:shift(u.stance,delta),description:`${full?p.demand:p.counter}. One speech now: stance ${u.stance} → ${shift(u.stance,delta)}. Pay ${cost} supplies in camp from Chapter ${due}. Honour: trust +${full?2:1}, Backing +${full?2:1}; break: trust −2, Public −3.`,available:!reason};}):[];
  return {enabled:!reason,reason,targetId:u?.id??null,personId:p?.id??null,name:p?.name??null,trust:p?state.progression?.negotiators[p.id]?.trust??0:0,options};
}
export function previewAgreement(state,targetId,kind){const plan=agreementOptions(state,targetId),option=plan.options.find(x=>x.id===kind);if(!plan.enabled||!option)return result(false,plan.reason||'Choose the demand or its limited counterproposal.');return {...result(true,option.description),agreement:{id:`${state.encounter.id}:${plan.personId}`,encounterId:state.encounter.id,personId:plan.personId,personName:plan.name,kind,pledge:option.pledge,cost:option.cost,due:option.due,trustGain:option.trustGain,status:'open'},stanceTo:option.stanceTo};}
export function negotiateAgreement(state,targetId,kind){
  const checked=previewAgreement(state,targetId,kind);if(!checked.ok)return checked;
  const e=state.encounter,hero=e.units.find(x=>x.id==='hero'),target=e.units.find(x=>x.id===targetId);hero.acted=true;target.stance=checked.stanceTo;e.staged.agreements.push({...checked.agreement});
  if(!e.usedAbilities.includes('agreement'))e.usedAbilities.push('agreement');note(e,`${target.name}: ${checked.message}`);return checked;
}
export function commitAgreements(state,e){if(state.progressionVersion!==1)return;for(const a of e.staged?.agreements??[])if(!state.progression.agreements.some(x=>x.id===a.id))state.progression.agreements.push({...a});}
export function settleAgreement(state,id,honour){
  const a=state.progressionVersion===1&&state.progression.agreements.find(x=>x.id===id);
  if(typeof honour!=='boolean'||state.phase!=='camp'||!a||a.status!=='open'||state.chapter<a.due)return result(false,'Resolve an open agreement in camp from its stated due chapter.');
  if(honour&&state.supplies<a.cost)return result(false,`This agreement requires ${a.cost} supplies. Keep it open or explicitly break it; no resources have been spent.`);
  const p=state.progression.negotiators[a.personId];a.status=honour?'honoured':'broken';p.trust=clamp(p.trust+(honour?a.trustGain:-2),-3,3);p[honour?'fulfilled':'broken']++;
  if(honour){state.supplies-=a.cost;state.meters.political=clamp(state.meters.political+a.trustGain);}else state.meters.public=clamp(state.meters.public-3);
  const message=`${a.personName}: ${a.pledge} ${a.status}. Trust is now ${p.trust}; this changes their stance in later Contests.`;state.log.push(message);if(state.log.length>100)state.log.splice(0,state.log.length-100);return result(true,message);
}

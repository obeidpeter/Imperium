import {fieldApproachCost,approachAssignment,fieldApproachSummary} from './field-approaches.js';
import {CHAPTERS} from '../data/campaign.js';
import {COMMAND_CHAPTERS,OPERATIONAL_PLANS,ISSUE_CASES} from '../data/command-campaign.js';
import {alive,clamp,distance,note,result} from './shared.js';

const enabled=s=>s?.campaignEdition===34;
const livingFriends=e=>e.units.filter(u=>alive(u)&&u.side!=='enemy');
const commandFriends=e=>livingFriends(e).filter(u=>u.side!=='neutral');
const definition=s=>COMMAND_CHAPTERS[(s.chapter??Number(s.id?.match(/^ch(\d+)/)?.[1]))-1];
const planById=id=>OPERATIONAL_PLANS.find(p=>p.id===id);
export const initialCommandCampaign=on=>on?{campaignEdition:34,commandCampaign:{plan:'balanced',records:[]}}:{};

export function enableCommandCampaign(state){
  if(state.phase!=='camp'||state.encounter||enabled(state))return result(false,'Enable command campaign systems once, at a camp checkpoint.');
  if(state.featureEdition!==31)Object.assign(state,{featureEdition:31,reforms:[],fieldRecords:[]});
  Object.assign(state,initialCommandCampaign(true));
  return result(true,'Command campaign systems begin with the next encounter. The current chronicle and its earned record are retained.');
}
export function operationalPlan(state){
  const next=CHAPTERS[state.chapter-1]?.encounters[state.encounterIndex];
  const available=enabled(state)&&state.phase==='camp'&&state.chapter>=3&&next?.kind==='battle'&&next.type!=='training';
  const packageCost=({none:0,recovery:2,rearm:2,support:3}[state.companyOrders?.package??'none']??0)+fieldApproachCost(state);
  return {enabled:available,edition:enabled(state),encounterId:next?.id??null,selected:state.commandCampaign?.plan??'balanced',description:'Choose the next field deployment. Its supply cost is paid at departure and restored by Retry.',options:OPERATIONAL_PLANS.map(p=>({...p,available:Boolean(available&&(p.id!=='reserve'||state.chapter>=4)&&(state.tacticsEdition===35&&p.id==='balanced'||state.supplies>=p.cost+packageCost)),reason:!available?'Operational planning opens in Chapter III before a battle.':p.id==='reserve'&&state.chapter<4?'A command reserve opens with your first command in Chapter IV.':state.supplies<p.cost+packageCost?'The operational plan and company supply package must both be affordable.':''}))};
}
export function chooseOperationalPlan(state,id){
  const view=operationalPlan(state),option=view.options.find(p=>p.id===id);
  if(!option?.available)return result(false,option?.reason||'Choose an available operational plan.');
  state.commandCampaign.plan=id;return result(true,`${option.label}. ${option.description}`);
}
export function operationalDepartureProblem(state){
  if(!enabled(state)||state.commandCampaign.plan==='balanced')return null;
  const view=operationalPlan(state),plan=view.options.find(p=>p.id===view.selected);
  return plan?.available?null:plan?.reason||'Choose a valid operational plan.';
}
// Called only after departure validation and the complete camp checkpoint.
// Both supply packages must be paid before the battle derives troop condition.
export function departCommandCampaign(state,data){
  if(enabled(state)&&data.kind==='battle'&&data.type!=='training')state.supplies-=planById(state.commandCampaign.plan).cost;
}
function repairRoutes(e){
  for(const o of e.field?.objects??[]){
    if(o.kind==='gate')o.state='open';
    if(o.kind==='bridge'){o.state='repaired';e.terrain[o.y][o.x]='ford';}
  }
}
function delayWaves(e){for(const w of e.mission?.waves??[])if(!w.arrived)w.turn=Math.min(30,w.turn+1);}
function companionWitness(state){
  if(state.chapter<3)return null;
  const id=state.decisions.ch2==='leave'?'sabinus':'lucan',member=state.company?.find(v=>v.id===id);
  return member&&member.service>=2?{id,name:member.name,description:state.decisions.ch2==='leave'?'Sabinus carries the survivors’ account; Lucan remains absent.':'Lucan can testify because you brought him out of the marsh.'}:null;
}
export function initializeCommandCampaign(state){
  if(!enabled(state))return;
  const e=state.encounter;e.campaignEdition=34;
  const witness=companionWitness(state);
  e.commandCampaign={plan:e.kind==='battle'&&e.type!=='training'?state.commandCampaign.plan:'balanced',opportunity:null,case:null,escortPace:2,cavalryDenied:false,witness:witness?.id??null};
  if(e.kind==='contest')return;
  const chapter=definition(state);
  for(const [i,id]of ['stores','signal'].entries()){const o=e.field?.objects.find(o=>o.id===id);if(o)o.label=chapter.opportunities[i].label;}
  if(e.type==='training')return;
  const plan=planById(e.commandCampaign.plan),hero=e.units.find(u=>u.id==='hero');
  if(plan.id==='recon'){for(const u of e.units)u.hidden=false;delayWaves(e);for(const u of commandFriends(e))u.cohesion=clamp(u.cohesion-10);}
  if(plan.id==='engineers'){repairRoutes(e);e.defence+=15;hero.move=Math.max(1,hero.move-1);}
  if(plan.id==='reserve'){e.commandCapacity=Math.min(8,e.commandCapacity+1);e.commandsLeft=e.commandCapacity;hero.ammo=Math.max(0,(hero.ammo??0)-1);for(const u of commandFriends(e))u.cohesion=clamp(u.cohesion+10);}
  note(e,`${chapter.label}: ${chapter.purpose}`);
  if(plan.id!=='balanced')note(e,`${plan.label}: ${plan.description}`);
  if(witness)note(e,`${witness.name}: ${witness.description}`);
}
export function chapterOpportunity(e,id){
  if(!enabled(e)||!['stores','signal'].includes(id))return null;
  return definition(e)?.opportunities[id==='stores'?0:1]??null;
}
export function applyChapterOpportunity(e,id){
  const opportunity=chapterOpportunity(e,id);if(!opportunity)return false;
  const effect=opportunity.effect;e.commandCampaign.opportunity=id;
  if(effect==='stores')e.staged.supplies+=2;
  if(effect==='cohesion'){e.staged.meters.army=(e.staged.meters.army??0)+2;for(const u of commandFriends(e))u.cohesion=clamp(u.cohesion+15);}
  if(effect==='medicine'||effect==='water')for(const u of livingFriends(e))u.hp=Math.min(u.maxHp,u.hp+(effect==='medicine'?3:2));
  if(effect==='water')for(const o of e.field.objects.filter(o=>o.state==='burning')){o.state='spent';delete o.rounds;}
  if(effect==='escort')e.commandCampaign.escortPace=3;
  if(effect==='intelligence'){for(const u of e.units)u.hidden=false;delayWaves(e);}
  if(effect==='disrupt')for(const u of e.units.filter(u=>u.side==='enemy'&&alive(u)&&!u.hidden))u.cohesion=clamp((u.cohesion??80)-15);
  if(effect==='integrity')e.defence=Math.max(e.defence,Math.min(100,e.defence+20));
  if(effect==='engineering')repairRoutes(e);
  if(effect==='standard')for(const u of commandFriends(e)){u.cohesion=clamp(u.cohesion+20);u.morale=clamp(u.morale+10);}
  if(effect==='command'){const before=e.commandCapacity;e.commandCapacity=Math.min(8,before+1);e.commandsLeft+=e.commandCapacity-before;}
  if(effect==='anti-charge')e.commandCampaign.cavalryDenied=true;
  return true;
}

// Side-level public plan. Recomputed from current visible state, with no RNG
// or mutable planner cache, so previews and interrupted turns remain exact.
export function commandDoctrine(e){
  if(!enabled(e)||e.kind!=='battle')return null;
  const chapter=definition(e),enemies=e.units.filter(u=>u.side==='enemy'&&alive(u)&&!u.hidden).sort((a,b)=>a.id.localeCompare(b.id));
  const targets=livingFriends(e).filter(u=>!u.hidden),escorts=targets.filter(u=>u.role==='escort');
  const pursuing=['pursuit','interdiction'].includes(chapter.doctrine);
  const focus=[...(pursuing&&escorts.length?escorts:targets.filter(u=>u.side!=='neutral'))].sort((a,b)=>a.hp-b.hp||a.id.localeCompare(b.id))[0];
  const defensive=['screen','siege','reserve'].includes(chapter.doctrine);
  const reserve=defensive&&e.turn<=2&&enemies.length>=3?enemies.find(u=>u.role==='infantry'||u.role==='guard'):null;
  return {id:chapter.doctrine,label:chapter.label,description:chapter.purpose,turn:e.turn,phase:!enemies.length?'No visible opposition':reserve?'Reserve held through round two':'Field formations committed',focusId:enemies.length?focus?.id??null:null,focusName:enemies.length?focus?.name??null:null,reserveId:reserve?.id??null,trigger:'Replans after each committed order using visible positions, surviving units and the current objective.'};
}
export function commandAssignment(e,unit){
  const doctrine=commandDoctrine(e);if(!doctrine||unit.side!=='enemy'||e.type==='training'||e.id==='ch1-road')return null;
  // The authored parley perimeter is a recovery route, not an assault target.
  if(e.mission?.mode==='settlement')return null;
  const approach=approachAssignment(e,unit);if(approach)return approach;
  const focus=e.units.find(u=>u.id===doctrine.focusId);if(!focus)return null;
  if(unit.id===doctrine.reserveId)return {role:'Reserve',targetId:null,goal:unit.anchor??unit,hold:true};
  if(unit.role==='archer')return {role:'Suppress',targetId:focus.id,goal:focus};
  const flank=unit.role==='cavalry'||unit.role==='raider'||doctrine.id==='pincer'&&Number(unit.id.replace(/\D/g,''))%2===1;
  const side=unit.y<=focus.y?-1:1;
  return {role:flank?'Flank':doctrine.id==='siege'?'Contest the approach':'Fix',targetId:focus.id,goal:flank?{x:clamp(focus.x+1,0,e.width-1),y:clamp(focus.y+side*2,0,e.height-1)}:doctrine.id==='siege'&&['hold','supply'].includes(e.mission?.mode)?e.goal:focus};
}
export function commandBriefing(state){
  if(!enabled(state))return {enabled:false};
  const chapter=definition(state),e=state.encounter,witness=companionWitness(state);
  return {enabled:true,chapter:state.chapter,title:chapter.label,purpose:chapter.purpose,approach:fieldApproachSummary(e),doctrine:e?commandDoctrine(e):{id:chapter.doctrine,label:chapter.label,description:chapter.purpose},witness,opportunities:chapter.opportunities.map((o,i)=>({...o,id:i?'signal':'stores'})),records:state.commandCampaign.records.map(r=>({...r})),reaction:'A surviving braced defender answers a frontal mounted charge with 1 damage, once per round. Flanks and ranged attacks avoid the reaction; the attack preview includes it.'};
}

function availableEvidence(state,requirement){
  if(requirement==='service')return state.history.filter(h=>h.kind==='battle'&&h.id!=='ch1-training').length>=4;
  if(requirement==='companion')return Boolean(companionWitness(state));
  if(requirement==='rescue')return state.decisions.ch2==='carry'||state.decisions.ch8==='families'||state.history.some(h=>h.id==='ch8-ferry');
  if(requirement==='records')return state.history.some(h=>h.id==='ch3-station');
  if(requirement==='judgment')return Boolean(state.judgment&&state.allocation);
  if(requirement==='provision')return Boolean(state.allocation)||state.commandCampaign.records.some(r=>r.opportunity==='stores');
  return false;
}
const shift=(stance,delta)=>clamp(stance+((stance<=-3&&delta>0)||(stance>=3&&delta<0)?Math.sign(delta)*Math.max(1,Math.ceil(Math.abs(delta)/2)):delta),-6,6);
export function previewCase(state,id){
  const e=state.encounter,c=ISSUE_CASES[e?.id]?.find(c=>c.id===id),hero=e?.units.find(u=>u.id==='hero');
  if(!enabled(state)||state.phase!=='encounter'||!enabled(e)||e.kind!=='contest'||e.status!=='active'||!c||!hero||!alive(hero)||hero.acted)return result(false,'Present a case with an unspent commander speech in an active Contest.');
  if(e.commandCampaign.case)return result(false,'One documented case may be presented in this hearing.');
  if(!availableEvidence(state,c.requirement))return result(false,'This case needs the earlier service, rescue or provincial record named in its description.');
  const changes=e.units.filter(u=>u.role==='voter').map(u=>({id:u.id,name:u.name,from:u.stance,to:shift(u.stance,u.interest===c.interest?2:u.interest===c.opposition?-1:0)})).filter(c=>c.from!==c.to);
  const votesBefore=e.units.filter(u=>u.role==='voter'&&u.stance>=1).length;
  const votesAfter=e.units.filter(u=>u.role==='voter'&&(changes.find(c=>c.id===u.id)?.to??u.stance)>=1).length;
  return {...result(true,`${c.label}. ${c.description} One speech; ${c.interest} interests +2 stance, ${c.opposition} interests −1 before commitment resistance. ${changes.map(c=>`${c.name} ${c.from} → ${c.to}`).join('; ')}. Net delegate votes ${votesAfter-votesBefore>=0?'+':''}${votesAfter-votesBefore}.`),changes,netVotes:votesAfter-votesBefore};
}
export function caseOptions(state){
  return !enabled(state)?[]:(ISSUE_CASES[state.encounter?.id]??[]).map(c=>({...c,earned:availableEvidence(state,c.requirement),preview:previewCase(state,c.id)}));
}
export function presentCase(state,id){
  const preview=previewCase(state,id);if(!preview.ok)return preview;
  const e=state.encounter;for(const u of e.units)delete u.moveOrigin;
  for(const c of preview.changes)e.units.find(u=>u.id===c.id).stance=c.to;
  e.units.find(u=>u.id==='hero').acted=true;e.commandCampaign.case=id;note(e,preview.message);return preview;
}
export function commitCommandCampaign(state,e){
  if(!enabled(e))return;
  state.commandCampaign.records.push({id:e.id,chapter:state.chapter,plan:e.commandCampaign.plan,opportunity:e.commandCampaign.opportunity,case:e.commandCampaign.case,witness:e.commandCampaign.witness});
  state.commandCampaign.plan='balanced';
}
export function validateCommandCampaign(state,fail){
  if(state.campaignEdition===undefined){if(state.commandCampaign!==undefined||state.encounter?.campaignEdition!==undefined)fail('unversioned command campaign.');return;}
  const c=state.commandCampaign;
  if(!enabled(state)||state.featureEdition!==31||!c||!planById(c.plan)||!Array.isArray(c.records)||c.records.length>25||new Set(c.records.map(r=>r?.id)).size!==c.records.length)fail('command campaign.');
  for(const r of c.records){
    const h=state.history.find(h=>h.id===r.id&&h.chapter===r.chapter);
    if(!h||!planById(r.plan)||![null,'stores','signal'].includes(r.opportunity)||![null,'lucan','sabinus'].includes(r.witness)||r.case!==null&&!ISSUE_CASES[r.id]?.some(c=>c.id===r.case)||h.kind==='contest'&&r.opportunity!==null||h.kind==='battle'&&r.case!==null)fail('command campaign record.');
  }
  const e=state.encounter;if(!e)return;
  const x=e.commandCampaign;
  if(!enabled(e)||state.snapshot?.campaignEdition!==34||!x||!planById(x.plan)||![null,'stores','signal'].includes(x.opportunity)||![null,'lucan','sabinus'].includes(x.witness)||![2,3].includes(x.escortPace)||typeof x.cavalryDenied!=='boolean'||x.case!==null&&!ISSUE_CASES[e.id]?.some(c=>c.id===x.case))fail('command campaign checkpoint.');
  if(e.kind==='battle'&&(x.case!==null||x.opportunity!==(e.field.choice??null))||e.kind==='contest'&&(x.opportunity!==null||x.plan!=='balanced'||x.escortPace!==2||x.cavalryDenied))fail('command campaign encounter.');
  const expectedPlan=e.kind==='battle'&&e.type!=='training'?state.snapshot.commandCampaign.plan:'balanced';
  if(x.plan!==expectedPlan||x.witness!==(companionWitness(state.snapshot)?.id??null))fail('command campaign departure.');
  if(x.case&&!availableEvidence(state,ISSUE_CASES[e.id].find(c=>c.id===x.case).requirement))fail('unearned documented case.');
  const opportunity=chapterOpportunity(e,x.opportunity);
  if(x.escortPace!==(opportunity?.effect==='escort'?3:2)||x.cavalryDenied!==(opportunity?.effect==='anti-charge'))fail('command opportunity effect.');
  for(const u of e.units)if(u.reactionTurn!==undefined&&(!Number.isInteger(u.reactionTurn)||u.reactionTurn<1||u.reactionTurn>e.turn))fail('formation reaction.');
}

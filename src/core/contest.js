import {advancePolicy} from './expanded-campaign.js';
import * as Legacy from './legacy-contest.js';
export const createLegacyContest=Legacy.createContest;
import {CHAMBER_SCENARIOS} from '../data/encounters.js';
import {INTEREST_EFFECTS,BLOC_AFFINITIES,POLITICAL_BALANCE as BALANCE,RIVAL_PRIORITIES} from '../data/contest-balance.js';
import {difficultyRule} from './campaign-options.js';
import {applyCoalition} from './progression-politics.js';
export {INTEREST_EFFECTS} from '../data/contest-balance.js';
import {alive, clamp, distance, faceToward, makeUnit, note, reachable, result, stepToward, unitAt, withMoveCredit} from './shared.js';
import {courseEffects,soldierAttributes} from './soldier.js';

export const CONTEST_RULES={stanceMin:-6,stanceMax:6,commitment:3,addressCooldown:3,denounce:4,rebut:4,promiseLimit:2,recordPerRecipient:1};
// The 0.40 speaker profile (build brief §3.11): the soldier's Eloquence and
// Authority add to his Resolve (half and a quarter of each point above 10) and
// to his Denounce and Rebut (a tenth of his Eloquence above 10); three
// decorations add one to his Invoke Record; the Rhetor's courses add 5 Resolve
// (Practised delivery) and bring Address back after 2 hours (The long period).
// Every value only adds to 0.38's, and the allied speaker keeps 0.38's. With
// Eloquence and Authority at 10 or below, no decorations and no courses the
// profile is neutral: the encounter carries none and is 0.38's exactly.
export const NEUTRAL_PROFILE=Object.freeze({resolve:0,denounce:0,rebut:0,record:0,addressRecovery:CONTEST_RULES.addressCooldown});
export function speakerProfile(state){
  const s=state.soldier;if(!s)return {...NEUTRAL_PROFILE};
  const a=soldierAttributes(s),fx=courseEffects(s.courses),above=v=>Math.max(0,(Number(v)||0)-10);
  return {resolve:Math.floor(above(a.elo)/2)+Math.floor(above(a.auth)/4)+(fx.resolve??0),denounce:Math.floor(above(a.elo)/10),rebut:Math.floor(above(a.elo)/10),
    record:(s.decorations?.length??0)>=3?1:0,addressRecovery:Math.min(CONTEST_RULES.addressCooldown,fx.addressRecovery??CONTEST_RULES.addressCooldown)};
}
const neutral=p=>Object.keys(NEUTRAL_PROFILE).every(k=>p[k]===NEUTRAL_PROFILE[k]);
// The profile a speaker speaks with: the soldier's own, everyone else 0.38's.
export const profileOf=(e,unit)=>unit?.id==='hero'&&e?.profile?e.profile:NEUTRAL_PROFILE;
export function createContest(state,data,options={}) {
  const c=state.chapter,scenario=CHAMBER_SCENARIOS[data.id]??CHAMBER_SCENARIOS['ch7-council'],e={issue:scenario.issue,rivalStyle:scenario.rival,recordUses:[],id:data.id,kind:'contest',title:data.title,objective:data.objective,type:data.type,width:8,height:8,terrain:Array.from({length:8},()=>Array(8).fill('chamber')),units:[],turn:1,turnLimit:data.turnLimit??(c===7?8:10),status:'active',commandsLeft:0,commandCapacity:0,log:[],usedAbilities:[],goal:{x:4,y:3},requiredAbility:data.requiredAbility,promises:[],hardened:[],cooldowns:{},staged:{meters:{army:0,political:0,public:0},supplies:0,obligations:[]},fallback:options.fallback??false};
  if(options.politicsVersion!==1)e.politicsVersion=2;if(state.campaignRules===2){e.campaignRules=2;e.difficulty=state.difficulty;}
  const profile=e.politicsVersion===2?speakerProfile(state):NEUTRAL_PROFILE;if(!neutral(profile))e.profile=profile;const resolve=12+profile.resolve;
  e.units.push(makeUnit('hero',state.name,'player',...scenario.hero,{hp:resolve,resolve,maxResolve:resolve,move:3,role:'speaker',vote:'for'}));
  e.units.push(makeUnit('speaker-ally',c===7?'Veteran quartermaster':state.decisions.ch8==='families'?'Dacian delegate':'Provincial advocate','ally',...scenario.ally,{hp:10,resolve:10,maxResolve:10,move:3,role:'speaker',vote:'for'}));
  e.units.push(makeUnit('rival-speaker',c>=11?'Crispus’s advocate':'Court opposition speaker','enemy',7,3,{hp:10,resolve:10,maxResolve:10,move:3,role:'speaker',vote:'against',intent:scenario.rival==='lobby'?'Lobby wavering members; attack speakers every third turn.':scenario.rival==='broker'?'Challenge promised votes; attack nearby speakers on even turns.':'Attack nearby speakers on even turns; otherwise lobby wavering members.'}));
  e.units.push(makeUnit('elder-speaker','Old-order spokesman','enemy',5,7,{hp:10,resolve:10,maxResolve:10,move:3,role:'speaker',vote:'against',intent:'Defend the old order and its wavering votes.'}));
  const blocs=['Veterans','Landholders','Civic'];
  for(let i=0;i<9;i++){const bloc=blocs[i%3];const value=bloc==='Veterans'?state.meters.army:bloc==='Landholders'?state.meters.political:state.meters.public;
    const interest=scenario.interests[(i+Math.floor(i/3))%scenario.interests.length],position=scenario.layout[i];let stance=Math.min(2,Math.floor(value/30))-(i===4?1:0);if(c===10){if(bloc==='Landholders'&&(state.allocation?.town??0)>=3)stance++;if(state.judgment==='shared'&&bloc==='Civic')stance++;if(state.judgment==='settlers')stance+=bloc==='Veterans'?1:bloc==='Landholders'?-1:0;}
    e.units.push(makeUnit(`member${i}`,`${bloc} delegate ${Math.floor(i/3)+1}`,'neutral',...position,{hp:1,role:'voter',bloc,interest,stance:clamp(stance,-6,6),vote:null}));
  }
  applyCoalition(state,e);if(options.fallback) e.units.filter(u=>u.bloc==='Landholders').forEach(u=>u.stance=3);
  e.electorate=e.units.length;e.majority=Math.floor(e.electorate/2)+1;
  e.objective+=` Issue: ${e.issue}. Interests change the value of each argument; check the preview.`;note(e,`${e.majority} of ${e.electorate} votes required at the end of turn ${e.turnLimit}. An early majority does not end the debate; a tie fails.`);
  if(e.politicsVersion===2)refreshIntents({...state,encounter:e});
  return e;
}
export function votes(e){return {for:e.units.filter(u=>u.vote==='for'||(u.role==='voter'&&u.stance>=1)).length,against:e.units.filter(u=>u.vote==='against'||(u.role==='voter'&&u.stance<1)).length,total:e.electorate,majority:e.majority};}
export function shiftedStance(member,delta){const opposed=member.stance<=-3&&delta>0,support=member.stance>=3&&delta<0;return clamp(member.stance+(opposed||support?Math.sign(delta)*Math.max(1,Math.ceil(Math.abs(delta)/2)):delta),-6,6);}
export function contestActions(state,unit){if(!state.encounter.issue)return Legacy.contestActions(state,unit);const e=state.encounter,c=state.chapter;if(!unit||!alive(unit)||!['player','ally'].includes(unit.side)||e.status!=='active')return [];
  const actions=[];if(!unit.moved)actions.push('move');if(!unit.acted){actions.push('persuade');if(c>=8)actions.push('promise','threaten');if(c>=10){if(!e.cooldowns[`${unit.id}:address`]||e.cooldowns[`${unit.id}:address`]<=e.turn)actions.push('address');actions.push('rebut');}if(c>=11)actions.push('record','denounce');}return actions;}
export function contestTargets(state,unit,action){if(!state.encounter.issue)return Legacy.contestTargets(state,unit,action);const e=state.encounter;if(action==='move')return reachable(e,unit,3);if(action==='address')return [{x:unit.x,y:unit.y,unitId:unit.id}];
  let targets=[];
  if(['persuade','promise','threaten','record'].includes(action)){const range=action==='persuade'?1:action==='record'?3:2;targets=e.units.filter(u=>u.role==='voter'&&distance(u,unit)<=range);if(action==='record')targets=targets.filter(u=>!(e.recordUses??[]).includes(u.id));if(action==='promise')targets=targets.filter(u=>!e.promises.includes(u.id)&&e.promises.length<2);}
  if(action==='denounce')targets=e.units.filter(u=>u.role==='speaker'&&u.side==='enemy'&&alive(u)&&distance(u,unit)<=3);
  if(action==='rebut')targets=e.units.filter(u=>u.role==='speaker'&&alive(u)&&distance(u,unit)<=3);
  return targets.map(u=>({x:u.x,y:u.y,unitId:u.id,label:u.name}));}
export function politicalPosition(state,unitId){
  const e=state.encounter,unit=e?.units.find(u=>u.id===unitId),cooperating=unit&&alive(unit)&&['player','ally'].includes(unit.side)?e.units.filter(u=>u.id!==unit.id&&u.role==='speaker'&&alive(u)&&['player','ally'].includes(u.side)&&distance(u,unit)<=BALANCE.cooperationRange).map(u=>({id:u.id,name:u.name})):[];
  const persuadeBonus=e?.politicsVersion===2&&cooperating.length?BALANCE.cooperationBonus:0;
  return {cooperating,persuadeBonus,message:persuadeBonus?`Cooperating with ${cooperating.map(u=>u.name).join(', ')}: Persuade +${persuadeBonus}.`:'An allied speaker within two tiles adds +1 Persuade in revised chambers.'};
}
export function speechStrength(state,action,target,speaker=state.encounter.units.find(u=>u.id==='hero')){if(!state.encounter.issue)return Legacy.speechStrength(state,action,target);const e=state.encounter,interest=target?.interest??'security',effects=INTEREST_EFFECTS[interest];let strength=effects?.[action]??2;
  if(e.politicsVersion===2){strength+=BLOC_AFFINITIES[target?.bloc]?.[action]??0;if(action==='persuade')strength+=politicalPosition(state,speaker?.id).persuadeBonus;}
  else if(action==='promise'&&['grain','office'].includes(interest))strength=6;
  if(action==='record'&&interest==='service'&&(state.company??[]).reduce((n,v)=>n+(v.commendations??0),0)>=12)strength++;if(action==='record')strength+=profileOf(e,speaker).record;
  if(action==='threaten'&&e.hardened.includes(target?.bloc))strength--;return Math.max(1,strength);}

function promiseTerms(e,target){const material=['grain','office'].includes(target.interest),cost=e.politicsVersion===2&&material?BALANCE.materialPromiseCost:BALANCE.ordinaryPromiseCost;
  return {id:`${e.id}:${target.id}`,to:target.bloc,promise:target.interest==='office'?'Endow a civic office for this delegation.':target.interest==='law'?'Fund a legal guarantee for this delegation.':'Provide two grain convoys for this bloc at accession.',due:12,cost,consequence:`Honour: −${cost} supplies. Break: −8 Public Confidence, −4 Political Backing.`,status:'open'};
}
export function argumentForecast(state,unit,action,target){
  const e=state.encounter,forecast={action,sourceId:unit.id,stanceChanges:[],resolveChanges:[],bluntedIds:[],speechCost:1,publicCost:action==='threaten'?3:0,promise:action==='promise'?promiseTerms(e,target):null,votesBefore:votes(e).for};
  const change=(member,delta)=>forecast.stanceChanges.push({id:member.id,name:member.name,bloc:member.bloc,interest:member.interest,from:member.stance,to:shiftedStance(member,delta),baseDelta:delta});
  if(action==='address')for(const member of e.units.filter(u=>u.role==='voter'&&distance(u,unit)<=3))change(member,speechStrength(state,action,member,unit));
  else if(['persuade','promise','threaten','record'].includes(action)){change(target,speechStrength(state,action,target,unit));if(action==='threaten')for(const member of e.units.filter(u=>u.role==='voter'&&u.bloc===target.bloc&&u.id!==target.id))change(member,-1);}
  else if(action==='denounce')forecast.resolveChanges.push({id:target.id,name:target.name,from:target.resolve,to:Math.max(0,target.resolve-CONTEST_RULES.denounce-profileOf(e,unit).denounce)});
  else if(action==='rebut'){if(target.side==='enemy')forecast.bluntedIds.push(target.id);else forecast.resolveChanges.push({id:target.id,name:target.name,from:target.resolve,to:Math.min(target.maxResolve,target.resolve+CONTEST_RULES.rebut+profileOf(e,unit).rebut)});}
  forecast.votesAfter=forecast.votesBefore+forecast.stanceChanges.reduce((n,c)=>n+Number(c.to>=1)-Number(c.from>=1),0);
  return forecast;
}
function forecastPreview(state,unit,action,target){
  const e=state.encounter,f=argumentForecast(state,unit,action,target),changes=f.stanceChanges.map(c=>`${c.name}: ${c.from} → ${c.to}`).join('; '),resolve=f.resolveChanges.map(c=>`${c.name}: Resolve ${c.from} → ${c.to}`).join('; ');
  let message=`${changes||resolve||`Blunt ${target.name}’s next speech to at most 1 stance or Resolve loss`}. One speech. Support ${f.votesBefore} → ${f.votesAfter}/${e.electorate}; ${e.majority} needed at turn ${e.turnLimit}.`;
  if(action==='promise')message+=` ${f.promise.promise} Due at accession (chapter 12). Honour: ${f.promise.cost} supplies; each missing supply costs 1 Public. Break: −8 Public, −4 Backing. Promise ${e.promises.length+1}/2; once per recipient. Brokers prioritize pledged supporters.`;
  if(action==='threaten')message+=' Costs 3 Public Confidence; shown bloc backlash applies now. Later threats against this bloc lose 1 strength.';
  if(action==='address')message+=` Available again on turn ${e.turn+profileOf(e,unit).addressRecovery}.`;
  if(action==='record')message+=' This member can hear your Record once per Contest.';
  if(action==='denounce')message+=' Withdrawing a speaker stops future speeches but preserves their vote.';
  if(target?.role==='voter')message+=` ${target.bloc}; interest: ${target.interest}.`;
  if(action==='persuade'&&politicalPosition(state,unit.id).persuadeBonus)message+=' '+politicalPosition(state,unit.id).message;
  return {...result(true,message),forecast:f};
}
export function previewContest(state,command){if(!state.encounter.issue)return Legacy.previewContest(state,command);const e=state.encounter,unit=e.units.find(u=>u.id===command.unitId),action=command.action;if(!contestActions(state,unit).includes(action))return result(false,'That speaker has spent this action, withdrawn, or has not learned that ability.');
  const point=contestTargets(state,unit,action).find(p=>p.x===command.x&&p.y===command.y&&(!command.targetId||command.targetId===p.unitId));if(!point)return result(false,'Choose a highlighted legal target. Promises are limited to two, once per recipient.');
  const target=e.units.find(u=>u.id===point.unitId),strength=speechStrength(state,action,target);
  if(action==='move')return result(true,`Move speaker to ${command.x+1}${String.fromCharCode(65+command.y)}; one movement, up to three tiles.`);
  if(e.politicsVersion===2)return forecastPreview(state,unit,action,target);
  if(action==='address'){const members=e.units.filter(u=>u.role==='voter'&&distance(u,unit)<=3);return result(true,`Address ${members.length} nearby members: ${members.map(m=>`${m.interest} +${speechStrength(state,'address',m)}`).join(', ')} stance (commitment resists reversal). Speech spent; available again on turn ${e.turn+3}.`);}
  if(action==='denounce')return result(true,`Denounce ${target.name}: −4 Resolve (${target.resolve} → ${Math.max(0,target.resolve-4)}). A withdrawn speaker keeps their vote.`);
  if(action==='rebut')return result(true,target.side==='enemy'?`Blunt ${target.name}’s next speech to 1 point of stance or Resolve loss.`:`Restore 4 Resolve to ${target.name} (${target.resolve} → ${Math.min(target.maxResolve,target.resolve+4)}).`);
  const next=shiftedStance(target,strength);if(action==='promise')return result(true,`${target.name}: stance ${target.stance} → ${next}. Promise ${target.interest==='office'?'a paid civic office':target.interest==='law'?'a funded legal guarantee':'2 grain convoys'} at accession. Honour: 2 supplies; break: −8 Public, −4 Backing. One speech; ${e.promises.length+1}/2 promises. Interest: ${target.interest}.`);
  const extra=action==='threaten'?` Costs 3 Public Confidence; other ${target.bloc} members lose 1 stance and the bloc resists later threats.`:'';
  return result(true,`${action==='record'?'Invoke your military record':action[0].toUpperCase()+action.slice(1)}: ${target.name} stance ${target.stance} → ${next}.${extra} Costs one speech.${action==='record'?' This member can hear your Record only once per Contest.':''} Interest: ${target.interest}.`);
}
export function applyContest(state,command){if(!state.encounter.issue)return Legacy.applyContest(state,command);const checked=previewContest(state,command);if(!checked.ok)return checked;const e=state.encounter,unit=e.units.find(u=>u.id===command.unitId),target=e.units.find(u=>u.id===command.targetId)||unitAt(e,command.x,command.y),action=command.action;
  if(action==='move'){Object.defineProperty(unit,'moveOrigin',{value:withMoveCredit({x:unit.x,y:unit.y,facing:unit.facing??'east'},state,e),writable:true,configurable:true,enumerable:false});faceToward(unit,command);unit.x=command.x;unit.y=command.y;unit.moved=true;}
  else if(e.politicsVersion===2){for(const u of e.units)delete u.moveOrigin;faceToward(unit,target);unit.acted=true;const f=checked.forecast;
    for(const change of f.stanceChanges)e.units.find(u=>u.id===change.id).stance=change.to;
    for(const change of f.resolveChanges){const member=e.units.find(u=>u.id===change.id);member.resolve=change.to;member.hp=change.to;}
    for(const id of f.bluntedIds)e.units.find(u=>u.id===id).blunted=true;
    if(action==='address')e.cooldowns[`${unit.id}:address`]=e.turn+profileOf(e,unit).addressRecovery;
    if(action==='record')e.recordUses.push(target.id);
    if(f.promise){e.promises.push(target.id);e.staged.obligations.push({...f.promise});}
    if(action==='threaten'){e.staged.meters.public-=f.publicCost;if(!e.hardened.includes(target.bloc))e.hardened.push(target.bloc);}
  }
  else {for(const u of e.units)delete u.moveOrigin;faceToward(unit,target);unit.acted=true;if(action==='address'){e.units.filter(u=>u.role==='voter'&&distance(u,unit)<=3).forEach(u=>u.stance=shiftedStance(u,speechStrength(state,'address',u)));e.cooldowns[`${unit.id}:address`]=e.turn+3;}
    else if(action==='denounce'){target.resolve=Math.max(0,target.resolve-4);target.hp=target.resolve;}
    else if(action==='rebut'){if(target.side==='enemy')target.blunted=true;else{target.resolve=Math.min(target.maxResolve,target.resolve+4);target.hp=target.resolve;}}
    else {target.stance=shiftedStance(target,speechStrength(state,action,target));if(action==='record')e.recordUses.push(target.id);if(action==='promise'){e.promises.push(target.id);e.staged.obligations.push({id:`${e.id}:${target.id}`,to:target.bloc,promise:target.interest==='office'?'Endow a civic office for this delegation.':target.interest==='law'?'Fund a legal guarantee for this delegation.':'Provide two grain convoys for this bloc at accession.',due:12,cost:2,consequence:'Honour: −2 supplies. Break: −8 Public Confidence, −4 Political Backing.',status:'open'});}if(action==='threaten'){e.staged.meters.public-=3;e.units.filter(u=>u.role==='voter'&&u.bloc===target.bloc&&u.id!==target.id).forEach(u=>u.stance=shiftedStance(u,-1));if(!e.hardened.includes(target.bloc))e.hardened.push(target.bloc);}}}
  if(!e.usedAbilities.includes(action))e.usedAbilities.push(action);state.capabilityUse[action]=true;note(e,checked.message);if(e.politicsVersion===2)refreshIntents(state);return checked;
}
function rivalPlan(state,enemy){
  const e=state.encounter,style=RIVAL_PRIORITIES[e.rivalStyle]??RIVAL_PRIORITIES.lobby,positions=[{x:enemy.x,y:enemy.y,cost:0},...reachable(e,enemy,BALANCE.rivalMove)],candidates=[];
  for(const target of e.units.filter(u=>u.role==='voter'||u.role==='speaker'&&['player','ally'].includes(u.side)&&alive(u))){
    const lobbying=target.role==='voter',promised=e.promises.includes(target.id),range=lobbying?1:3;
    const position=positions.filter(p=>distance(p,target)<=range).sort((a,b)=>a.cost-b.cost||distance(a,target)-distance(b,target)||a.y-b.y||a.x-b.x)[0];if(!position)continue;
    const adjustment=difficultyRule(e).speech;
    const amount=enemy.blunted?1:Math.max(1,(lobbying?BALANCE.rivalLobby+(e.rivalStyle==='broker'&&promised&&!e.precedentShield?BALANCE.brokerPromisePressure:0):BALANCE.rivalResolve)+(lobbying?adjustment:Math.min(0,adjustment)));
    const from=lobbying?target.stance:target.resolve,to=lobbying?shiftedStance(target,-amount):Math.max(0,from-amount),loss=from-to;
    const score=lobbying?Number(from>=1&&to<1)*style.vote+loss*.55+(from>=1?1.7:from>-3?.5:-3)+(promised&&from>=1?style.promise:0):loss*style.pressure+(to===0?style.withdraw:0);
    candidates.push({unitId:enemy.id,action:lobbying?'lobby':'pressure',targetId:target.id,destination:{x:position.x,y:position.y},amount,score:score-position.cost*.04,...(lobbying?{stanceBefore:from,stanceAfter:to}:{resolveBefore:from,resolveAfter:to})});
  }
  candidates.sort((a,b)=>b.score-a.score||a.targetId.localeCompare(b.targetId)||a.destination.y-b.destination.y||a.destination.x-b.destination.x);
  const plan=candidates[0];
  if(!plan)return {unitId:enemy.id,action:'wait',targetId:null,destination:{x:enemy.x,y:enemy.y},message:`${enemy.name} has no reachable audience this round.`};
  const target=e.units.find(u=>u.id===plan.targetId),moving=distance(enemy,plan.destination)>0?` moves to ${plan.destination.x+1}${String.fromCharCode(65+plan.destination.y)} and`:'';
  plan.message=`${enemy.name}${moving} ${plan.action==='lobby'?`challenges ${target.name} (${target.bloc}, ${target.interest}), stance ${plan.stanceBefore} → ${plan.stanceAfter}`:`attacks ${target.name}’s Resolve, ${plan.resolveBefore} → ${plan.resolveAfter}`}${enemy.blunted?' (Rebut limits this speech)':''}.`;
  delete plan.score;return plan;
}
function applyRivalPlan(e,plan){
  const enemy=e.units.find(u=>u.id===plan.unitId);if(!enemy||!alive(enemy)||plan.action==='wait')return;
  if(distance(enemy,plan.destination)>0){faceToward(enemy,plan.destination);enemy.x=plan.destination.x;enemy.y=plan.destination.y;enemy.moved=true;}
  const target=e.units.find(u=>u.id===plan.targetId);faceToward(enemy,target);
  if(plan.action==='lobby')target.stance=plan.stanceAfter;else{target.resolve=plan.resolveAfter;target.hp=target.resolve;}
  enemy.acted=true;enemy.blunted=false;
}
export function contestIntents(state){
  const e=state.encounter;if(!e||e.kind!=='contest'||e.status!=='active')return [];
  if(e.politicsVersion!==2)return e.units.filter(u=>u.side==='enemy'&&u.role==='speaker'&&alive(u)).map(u=>({unitId:u.id,action:'legacy',targetId:null,destination:{x:u.x,y:u.y},message:u.intent??'Opposition will reply under the saved rules.'}));
  // Plan the second rival against the first one's visible projected move and
  // speech. This exact sequence is used on End Turn, with no hidden-state input.
  const simulation={...state,encounter:{...e,units:e.units.map(u=>({...u}))}},plans=[];
  for(const enemy of simulation.encounter.units.filter(u=>u.side==='enemy'&&u.role==='speaker'&&alive(u))){const plan=rivalPlan(simulation,enemy);plans.push(plan);applyRivalPlan(simulation.encounter,plan);}
  return plans;
}
export function refreshIntents(state){for(const plan of contestIntents(state))state.encounter.units.find(u=>u.id===plan.unitId).intent=plan.message;}
export const PRECEDENT_MOTIONS=[
  {id:'frontier-roll',label:'Invoke the Frontier Roll',bloc:'Veterans',summary:'Veterans bloc +1 stance; allied speaker +2 Resolve. Requires 4+ company commendations or 35+ Army Loyalty.'},
  {id:'provincial-charter',label:'Cite the Provincial Charter',bloc:'Civic',summary:'Civic bloc +1 stance (plus +1 to the most doubtful Civic delegate after grain or shared-tenure rulings). Requires crossing terms, provincial judgment, or 35+ Public Confidence.'},
  {id:'fiscal-audit',label:'Table the Quartermaster’s Audit',bloc:'Landholders',summary:'Landholders bloc +1 stance and shields pledged supporters from broker pressure. Requires 6+ supplies or 35+ Political Backing.'},
  {id:'consular-privilege',label:'Assert Consular Privilege',bloc:'Chamber',summary:'Blunts the lead opposition speaker and restores +3 Resolve to the commander. Requires Chapter X+ or the Dux milestone.'},
];
export function precedentOptions(state){
  const e=state.encounter;
  if(state.phase!=='encounter'||!e||e.kind!=='contest'||e.politicsVersion!==2||e.status!=='active')return {enabled:false,used:e?.precedentUsed??null,motions:[]};
  const hero=e.units.find(u=>u.id==='hero'),commendations=(state.company??[]).reduce((n,v)=>n+(v.commendations??0),0);
  const canAct=Boolean(hero&&alive(hero)&&!hero.acted&&!e.precedentUsed);
  const unlocked={
    'frontier-roll':commendations>=4||(state.meters?.army??0)>=35,
    'provincial-charter':Boolean(state.negotiation||state.allocation||state.judgment||(state.meters?.public??0)>=35),
    'fiscal-audit':(state.supplies??0)>=6||(state.meters?.political??0)>=35,
    'consular-privilege':state.chapter>=10||Boolean(state.milestones?.includes('dux')),
  };
  const motions=PRECEDENT_MOTIONS.map(m=>({...m,unlocked:Boolean(unlocked[m.id]),available:Boolean(canAct&&unlocked[m.id])}));
  return {enabled:canAct&&motions.some(m=>m.available),used:e.precedentUsed??null,motions};
}
export function previewPrecedent(state,motionId){
  const plan=precedentOptions(state),motion=plan.motions.find(m=>m.id===motionId);
  if(!motion)return result(false,'Unknown career precedent motion.');
  if(plan.used)return result(false,'A career precedent motion has already been entered in this Contest.');
  if(!motion.unlocked)return result(false,`Career record required: ${motion.summary}`);
  if(!motion.available)return result(false,'The commander must be active and have an unspent speech to table a precedent motion.');
  const e=state.encounter,before=votes(e).for;
  let after=before,detail='';
  if(motionId==='frontier-roll'){
    const members=e.units.filter(u=>u.role==='voter'&&u.bloc==='Veterans');
    after+=members.reduce((n,u)=>n+Number(shiftedStance(u,1)>=1)-Number(u.stance>=1),0);
    detail=`${members.length} Veterans delegates shift +1 stance; allied speaker +2 Resolve.`;
  }else if(motionId==='provincial-charter'){
    const members=e.units.filter(u=>u.role==='voter'&&u.bloc==='Civic');
    const bonus=state.judgment==='shared'||state.negotiation==='grain'?[...members].sort((a,b)=>a.stance-b.stance)[0]?.id:null;
    after+=members.reduce((n,u)=>n+Number(shiftedStance(u,u.id===bonus?2:1)>=1)-Number(u.stance>=1),0);
    detail=`${members.length} Civic delegates shift +1 stance${bonus?' (+2 on the most doubtful Civic delegate)':''}.`;
  }else if(motionId==='fiscal-audit'){
    const members=e.units.filter(u=>u.role==='voter'&&u.bloc==='Landholders');
    after+=members.reduce((n,u)=>n+Number(shiftedStance(u,1)>=1)-Number(u.stance>=1),0);
    detail=`${members.length} Landholders delegates shift +1 stance; broker promise pressure is neutralized.`;
  }else{
    detail='Lead opposition speaker is blunted to 1 stance/Resolve loss; commander restores +3 Resolve.';
  }
  return result(true,`${motion.label}: ${detail} Support ${before} → ${after}/${e.electorate}. Costs the commander’s speech; once per Contest.`);
}
export function invokePrecedent(state,motionId){
  const checked=previewPrecedent(state,motionId);if(!checked.ok)return checked;
  const e=state.encounter,hero=e.units.find(u=>u.id==='hero');
  for(const u of e.units)delete u.moveOrigin;
  hero.acted=true;e.precedentUsed=motionId;
  if(motionId==='frontier-roll'){
    for(const u of e.units.filter(u=>u.role==='voter'&&u.bloc==='Veterans'))u.stance=shiftedStance(u,1);
    const ally=e.units.find(u=>u.id==='speaker-ally'&&alive(u));
    if(ally){ally.resolve=Math.min(ally.maxResolve,ally.resolve+2);ally.hp=ally.resolve;}
  }else if(motionId==='provincial-charter'){
    const members=e.units.filter(u=>u.role==='voter'&&u.bloc==='Civic');
    const bonus=state.judgment==='shared'||state.negotiation==='grain'?[...members].sort((a,b)=>a.stance-b.stance)[0]?.id:null;
    for(const u of members)u.stance=shiftedStance(u,u.id===bonus?2:1);
  }else if(motionId==='fiscal-audit'){
    for(const u of e.units.filter(u=>u.role==='voter'&&u.bloc==='Landholders'))u.stance=shiftedStance(u,1);
    e.precedentShield=true;
  }else if(motionId==='consular-privilege'){
    const rival=e.units.find(u=>u.id==='rival-speaker'&&alive(u))??e.units.find(u=>u.side==='enemy'&&u.role==='speaker'&&alive(u));
    if(rival)rival.blunted=true;
    hero.resolve=Math.min(hero.maxResolve,hero.resolve+3);hero.hp=hero.resolve;
  }
  note(e,checked.message);
  if(e.politicsVersion===2)refreshIntents(state);
  return checked;
}
export function endContestTurn(state){if(!state.encounter.issue)return Legacy.endContestTurn(state);const e=state.encounter;e.turnEvents=[];
  for(const u of e.units)delete u.moveOrigin;
  if(e.politicsVersion===2)for(const plan of contestIntents(state)){applyRivalPlan(e,plan);note(e,plan.message);e.turnEvents.push(plan.message);}
  else for(const enemy of e.units.filter(u=>u.side==='enemy'&&u.role==='speaker'&&alive(u))){const speakers=e.units.filter(u=>['player','ally'].includes(u.side)&&u.role==='speaker'&&alive(u)).sort((a,b)=>distance(enemy,a)-distance(enemy,b)||a.resolve-b.resolve),members=e.units.filter(u=>u.role==='voter').sort((a,b)=>Math.abs(a.stance-1)-Math.abs(b.stance-1)||distance(enemy,a)-distance(enemy,b));
    const attacking=(e.rivalStyle==='lobby'?e.turn%3===0:e.turn%2===0)&&speakers[0]&&distance(enemy,speakers[0])<=5,target=attacking?speakers[0]:(e.rivalStyle==='broker'?members.find(u=>e.promises.includes(u.id)&&u.stance>=1):null)??members.find(u=>u.stance>=0)??members[0];if(!target)continue;const range=attacking?3:1;if(distance(enemy,target)>range)stepToward(e,enemy,target,3);
    if(distance(enemy,target)<=range){faceToward(enemy,target);const strength=enemy.blunted?1:attacking?3:2;if(attacking){target.resolve=Math.max(0,target.resolve-strength);target.hp=target.resolve;const event=`${enemy.name} attacks ${target.name}’s Resolve (−${strength}).`;note(e,event);e.turnEvents.push(event);}else{target.stance=shiftedStance(target,-strength);const event=`${enemy.name} challenges ${target.name} on ${target.interest}: stance −${strength}.`;note(e,event);e.turnEvents.push(event);}enemy.blunted=false;}
  }
  advancePolicy(e);if(e.turn>=e.turnLimit){const tally=votes(e),required=e.requiredAbility,qualified=(!required||e.usedAbilities.includes(required)||(['negotiate','judge','allocate'].includes(required)&&state.chapterCapabilities[state.chapter]?.includes(required)))&&(e.requiredAbilities??[]).every(a=>e.usedAbilities.includes(a)||state.chapterCapabilities[state.chapter]?.includes(a));e.status=tally.for>=e.majority&&qualified?'won':'lost';note(e,`Deadline vote: ${tally.for} for, ${tally.against} against; ${e.majority} needed. ${!qualified?`A required chapter capability was not demonstrated: ${(e.requiredAbilities??[required]).join(', ')}.`:e.status==='won'?'The motion passes.':'The status quo prevails.'}`);}
  else{e.turn++;e.units.forEach(u=>{u.moved=false;u.acted=false;delete u.moveOrigin;});note(e,`Turn ${e.turn}. Vote in ${e.turnLimit-e.turn+1} turns. Current support: ${votes(e).for}/${e.electorate}.`);if(e.politicsVersion===2)refreshIntents(state);}
  return result(true,e.status==='active'?'Rival speakers have replied.':e.status==='won'?'The vote is won. Commit the result.':'The motion failed. Retry, or accept a patron-backed re-run with a major Obligation.');
}
export function delegateCallout(encounter,command){
  if(!encounter||encounter.kind!=='contest'||!command?.action||command.action==='move')return null;
  const actor=encounter.units?.find(u=>u.id===command.unitId);
  const target=command.action==='address'?encounter.units?.filter(u=>u.role==='voter'&&distance(u,actor??{x:4,y:3})<=3)[0]:(encounter.units?.find(u=>u.id===command.targetId)??unitAt(encounter,command.x,command.y));
  if(!target)return null;
  const action=command.action,bloc=target.bloc??(target.side==='enemy'?'Opposition':'Chamber');
  const lines={
    persuade:{
      Veterans:'We know the cost of the frontier road. Show us that the legions are not forgotten.',
      Landholders:'Order on the estates requires predictability. Your argument has weight.',
      Civic:'The municipia ask only for lawful administration and open granaries.',
    },
    promise:{
      Veterans:'Enter that undertaking on the military tablet; the cohorts will remember it at accession.',
      Landholders:'A binding guarantee! The curial estates will hold you to this pledge when the treasury settles.',
      Civic:'The towns accept your bond. Do not let the granaries stand empty when the reckoning arrives.',
    },
    threaten:{
      Veterans:'You speak with the edge of a camp prefect—careful lest the standards harden against you.',
      Landholders:'Coercion in the chamber? You win a reluctant vote today and earn our wariness tomorrow.',
      Civic:'The cities yield to necessity, commander, not to affection.',
    },
    record:{
      Veterans:'Those names on the roll marched beside us. None here can dispute that service.',
      Landholders:'Your field record is undeniable, even to those who guard the census.',
      Civic:'A commander who kept the roads open has earned a hearing from the benches.',
    },
    address:{
      Veterans:'The frontier benches hear you—hold the line in this chamber as you held the river.',
      Landholders:'The landed orders take note of your public undertaking before the house.',
      Civic:'Your voice carries across the rostra; the civic delegations weigh your words.',
    },
    denounce:'You challenge our standing before the house? The opposition will not yield the floor lightly!',
    rebut:target.side==='enemy'?'You cut across my argument before the benches—the house sees your manoeuvre.':'Thank you, colleague; my voice is steadied for the next exchange.',
  };
  const text=typeof lines[action]==='string'?lines[action]:(lines[action]?.[bloc]??lines.persuade.Civic);
  return {speaker:target.name,bloc,role:target.role,action,text};
}
export function coalitionWhipForecast(state){
  const e=state?.encounter??(state?.kind==='contest'?state:null);
  if(!e||e.kind!=='contest')return null;
  const fullState=state?.encounter?state:{chapter:10,meters:{army:30,political:30,public:30},company:[],capabilityUse:{},chapterCapabilities:{},encounter:e};
  const intents=contestIntents(fullState),atRisk=[];
  for(const plan of intents){
    if(plan.action==='lobby'&&plan.targetId){
      const member=e.units.find(u=>u.id===plan.targetId&&u.role==='voter');
      const rival=e.units.find(u=>u.id===plan.unitId);
      if(member){
        const stanceBefore=plan.stanceBefore??member.stance,stanceAfter=plan.stanceAfter??member.stance;
        atRisk.push({id:member.id,name:member.name,bloc:member.bloc,stanceBefore,stanceAfter,losesVote:stanceBefore>=1&&stanceAfter<1,rivalId:rival?.id??plan.unitId,rivalName:rival?.name??'Opposition speaker'});
      }
    }
  }
  const speakers=e.units.filter(u=>['player','ally'].includes(u.side)&&u.role==='speaker'&&alive(u)&&!u.acted);
  const oneSpeechFlips=[];
  for(const voter of e.units.filter(u=>u.role==='voter'&&u.stance<1)){
    let best=null;
    for(const speaker of speakers){
      const acts=contestActions(fullState,speaker).filter(a=>['persuade','record','address','promise'].includes(a));
      const positions=speaker.moved?[{x:speaker.x,y:speaker.y,cost:0}]:[{x:speaker.x,y:speaker.y,cost:0},...reachable(e,speaker,3)];
      for(const action of acts){
        if(action==='record'&&(e.recordUses??[]).includes(voter.id))continue;
        if(action==='promise'&&((e.promises??[]).includes(voter.id)||(e.promises?.length??0)>=2))continue;
        const range=action==='persuade'?1:action==='record'||action==='address'?3:2;
        const inReachNow=distance(speaker,voter)<=range;
        const pos=inReachNow?{x:speaker.x,y:speaker.y,cost:0}:positions.find(p=>distance(p,voter)<=range);
        if(!pos)continue;
        const simSpeaker=inReachNow?speaker:{...speaker,x:pos.x,y:pos.y};
        const simState={...fullState,encounter:{...e,units:e.units.map(u=>u.id===speaker.id?simSpeaker:u)}};
        const to=shiftedStance(voter,speechStrength(simState,action,voter,simSpeaker));
        if(to<1)continue;
        const score=(inReachNow?20:0)+(action==='promise'?0:10)+to;
        if(!best||score>best.score)best={action,to,speakerId:speaker.id,speakerName:speaker.name,requiresMove:!inReachNow,score};
      }
    }
    if(best)oneSpeechFlips.push({id:voter.id,name:voter.name,bloc:voter.bloc,interest:voter.interest,from:voter.stance,to:best.to,action:best.action,speakerId:best.speakerId,speakerName:best.speakerName,requiresMove:best.requiresMove});
  }
  const currentVotes=votes(e).for,projectedVotesAfterRivals=Math.max(0,currentVotes-atRisk.filter(r=>r.losesVote).length);
  return {currentVotes,majority:e.majority,projectedVotesAfterRivals,atRisk,oneSpeechFlips};
}



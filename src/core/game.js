import {initialFieldApproaches,departFieldApproach,initializeFieldApproach,validateFieldApproaches,fieldApproachProblem,commitFieldApproach} from './field-approaches.js';
export {enableFieldApproaches,chooseFieldApproach,fieldApproachView} from './field-approaches.js';
import {initialEdition,initializeExpanded,commitExpanded,validateExpanded,fieldAction as applyFieldAction,tablePolicy as applyPolicy} from './expanded-campaign.js';
export {enableExpandedCampaign,fieldOptions,previewFieldAction,weatherSummary,policyOptions,previewPolicy,POLICY_MOTIONS} from './expanded-campaign.js';
export function fieldAction(state,id){const r=applyFieldAction(state,id);if(r.ok){checkBattle(state);refreshBattleIntents(state.encounter);}return r;}
export function tablePolicy(state,id,terms){const r=applyPolicy(state,id,terms);if(r.ok)refreshContestIntents(state);return r;}
import {initialCommandCampaign,departCommandCampaign,initializeCommandCampaign,commitCommandCampaign,validateCommandCampaign,operationalDepartureProblem,presentCase as applyCase} from './command-campaign.js';
export {enableCommandCampaign,operationalPlan,chooseOperationalPlan,commandBriefing,caseOptions,previewCase} from './command-campaign.js';
export function presentCase(state,id){const response=applyCase(state,id);if(response.ok)refreshContestIntents(state);return response;}
import {CHAPTERS} from '../data/campaign.js';
import {stagedStoryLines,storyStageKey} from '../data/story-stages.js';
import {createCompany,normalizeCareer,replaceFallenComrade,recordCompanyService,companyRoster,leadershipSummary,provinceSummary,VETERAN_IDS} from './career.js';
export {storyStageKey,companyRoster,leadershipSummary,provinceSummary};export {cursusHonorum} from './career.js';
import {alive,clamp,clone,distance,note,result,unitAt} from './shared.js';
import {planMove} from './movement.js';
import {allyDestinations,applyBattle,battleActions,battleTargets,checkBattle,createBattle,createLegacyBattle,endBattleTurn,previewBattle,refreshBattleIntents,reinforcementBeacons,updateBattleProgress} from './battle.js';
export {allyDestinations,reinforcementBeacons};export {combatBreakdown,enemyFormationLinks,FIELDWORK_TYPES,fieldworkOptions,previewFieldwork,invokeFieldwork} from './battle.js';
import {applyContest,contestActions,contestTargets,createContest,createLegacyContest,endContestTurn,previewContest,votes,refreshIntents as refreshContestIntents} from './contest.js';
import {initialCampaignOptions,validateCampaignOptions,departureProblem,departCompany,finaleCompanySize,campaignOptionsProblem} from './campaign-options.js';
import {validateOperation} from './operations.js';
export {difficultyOptions,companyPlan,selectCompany,prepareCompany,tacticalAdvice} from './campaign-options.js';
export {operationPhase} from './operations.js';
import {initialProgression,validateProgression} from './progression.js';
import {createSoldier,validateSoldier,commitSoldierRewards,issuePromotions,rewardCapabilities,soldierCommand as soldierAct} from './soldier.js';
import {createEncounterWorld,applyRealtimeOutcome,realtimeMissionSupported} from './realtime/campaign-encounter.js';
import {snapshotWorld,restoreWorld} from './realtime/simulation.js';
import {validateWorld} from './realtime/validate.js';
import {ITEMS as REALTIME_ITEMS} from '../data/items.js';
import {dialogueNode,reply as dialogueReply,errandList,hasNews} from './dialogue.js';
import {campFor,CAMP_PLACES} from '../data/camps.js';
import {createCampWorld,placeAt as campPlaceAt} from './realtime/camp-world.js';
import {commitOperationResult} from './progression-operations.js';
import {commitAgreements,negotiateAgreement as makeAgreement} from './progression-politics.js';
export {veteranTraining,specializeVeteran,veteranRank,companionCallout,VETERAN_RANKS} from './progression-veterans.js';
export {precedentOptions,previewPrecedent,invokePrecedent,PRECEDENT_MOTIONS,delegateCallout,coalitionWhipForecast} from './contest.js';
export {operationChoices,chooseOperation} from './progression-operations.js';
export {coalition,agreementOptions,previewAgreement,settleAgreement} from './progression-politics.js';
export function negotiateAgreement(state,targetId,kind){const response=makeAgreement(state,targetId,kind);if(response.ok){for(const u of state.encounter?.units??[])delete u.moveOrigin;refreshContestIntents(state);}return response;}

const PREPARATIONS=['fortify','rest','drill','march'],STRATAGEMS=['night','feint','flank'];
const CHAPTER_CAPABILITIES={1:['move','strike','brace','throw','oath'],2:['assist'],3:['scout'],4:['order'],5:['formation'],6:['rally'],7:['prepare','deploy','persuade'],8:['negotiate'],9:['stratagem'],10:['allocate','judge','address','rebut'],11:['record','denounce']};
const RANKS=['Tiro','Miles','Immunis','Optio','Centurio','Primus pilus','Praefectus legionis','Praepositus','Acting commander','Praeses','Candidate for the Senate','Senator','Augustus'];
const mark=(state,ability)=>{state.capabilityUse[ability]=true;const list=state.chapterCapabilities[state.chapter]??=[];if(!list.includes(ability))list.push(ability);};
const addMilestone=(state,id)=>{if(!state.milestones.includes(id))state.milestones.push(id);};
export function newGame(name='Aurelius Marcellus',seed=275,options={}){return {version:1,...initialEdition([31,34,35].includes(options.featureEdition)),...initialCommandCampaign([34,35].includes(options.featureEdition)),...initialFieldApproaches(options.featureEdition===35),...initialCampaignOptions(options.difficulty),...initialProgression(options.progression===true),name:String(name).trim().slice(0,40)||'Aurelius Marcellus',seed:seed>>>0,rng:seed>>>0,chapter:1,phase:'camp',rank:'Tiro',completed:[],milestones:[],decisions:{},meters:{army:15,political:5,public:10},relationships:{mentor:10,comrade:10,rival:0,patron:0,settler:0,senator:0},obligations:[],inventory:['Plain tunic','Oval training shield','Three javelins','Spatha'],supplies:12,encounterIndex:0,encounter:null,snapshot:null,log:['A village recruit arrives at the Danube camp, holding neither influence nor command.'],history:[],capabilityUse:{},chapterCapabilities:{},encounterOptions:{},settings:{audio:false,reducedMotion:false},preparation:null,stratagem:null,route:null,allocation:null,judgment:null,negotiation:null,oath:false,company:createCompany(),storyProgress:{},
  soldier:createSoldier({path:options.path??'legionary',appearance:options.appearance})};}
export function getChapter(state){return CHAPTERS[state.chapter-1];}
export function storyLines(state){const lines=stagedStoryLines(state);if(state.phase==='promotion')lines.push({speaker:'The company roll',text:leadershipSummary(state)});if(state.chapter===10&&state.allocation&&(state.phase==='promotion'||storyStageKey(state).includes(':briefing:')))for(const text of provinceSummary(state))lines.push({speaker:'The provincial record',text});return lines;}
export function storyProgress(state){return Math.min(state.storyProgress?.[storyStageKey(state)]||0,Math.max(0,storyLines(state).length-1));}
export function setStoryProgress(state,index){if(!['camp','promotion','epilogue'].includes(state.phase)||!Number.isInteger(index)||index<0||index>=storyLines(state).length)return result(false,'Choose an available passage in the current scene.');state.storyProgress??={};state.storyProgress[storyStageKey(state)]=index;return result(true,'Passage retained in your chronicle.');}
export function canAccess(state,id){if(!Number.isInteger(id)||id<1||id>12)return false;if(id===1)return true;if(!Array.from({length:id-1},(_,i)=>i+1).every(ch=>state.completed.includes(ch)))return false;if(id>=11&&(!state.milestones.includes('dux')||!state.milestones.includes('governorship')))return false;if(id===12&&(!state.milestones.includes('senator')||!state.milestones.includes('senate-challenge')))return false;return true;}
export function chapterRequirements(state){return (CHAPTER_CAPABILITIES[state.chapter]??[]).map(id=>({id,done:(state.chapterCapabilities[state.chapter]??[]).includes(id)}));}
function campaignLog(state,message){state.log.push(message);if(state.log.length>100)state.log.shift();}
function applyEffects(state,effects={}){for(const meter of ['army','political','public'])state.meters[meter]=clamp(state.meters[meter]+(effects[meter]??0));state.supplies=clamp(state.supplies+(effects.supplies??0),0,99);if(effects.relationships)for(const [person,delta]of Object.entries(effects.relationships))state.relationships[person]=clamp((state.relationships[person]??0)+delta,-100,100);}
export function choose(state,optionId){if(state.phase!=='camp')return result(false,'Make this decision in camp before beginning the encounter.');const chapter=getChapter(state),decision=chapter.decision;if(state.decisions[decision.id])return result(false,'This decision is already part of your record.');const option=decision.options.find(o=>o.id===optionId);if(!option)return result(false,'Unknown decision.');state.decisions[decision.id]=option.id;applyEffects(state,option.effects);if(option.obligation&&!state.obligations.some(o=>o.id===option.obligation.id))state.obligations.push({...clone(option.obligation),status:'open'});
  const relationship={1:['comrade',optionId==='cover'?8:-5],2:['comrade',optionId==='carry'?12:-20],3:['rival',optionId==='share'?10:-12],4:['mentor',optionId==='withdraw'?5:-3],5:['patron',optionId==='countermine'?8:-4],6:['mentor',optionId==='save'?15:-30],7:['patron',optionId==='join'?10:-8],8:['settler',optionId==='families'?15:-8],9:['senator',optionId==='mercy'?8:-6],10:['settler',optionId==='shared'?7:12],11:['patron',optionId==='patron'?15:-5],12:['senator',optionId==='honour'?8:-8]}[state.chapter];if(relationship)state.relationships[relationship[0]]=clamp(state.relationships[relationship[0]]+relationship[1],-100,100);
  if(state.chapter===2&&optionId==='leave'){replaceFallenComrade(state);if(state.companyOrders)state.companyOrders.priority=state.companyOrders.priority.map(id=>id==='lucan'?'sabinus':id);if(state.progressionVersion===1)delete state.progression.specializations.lucan;}campaignLog(state,option.consequence??option.description);if(state.chapter===12)for(const obligation of [...state.obligations])if(obligation.status==='open')settleObligation(state,obligation.id,optionId==='honour');return result(true,option.consequence??option.description);}
export function swearOath(state){if(state.chapter!==1||state.phase!=='camp')return result(false,'The oath is sworn in the recruit camp.');if(state.oath)return result(false,'Your oath already stands.');if(state.encounterIndex<1)return result(false,'Complete training before swearing the oath.');state.oath=true;mark(state,'oath');state.inventory.push('Lead identity seal');campaignLog(state,'You swear the original military oath and receive a lead identity seal.');return result(true,'The oath is sworn. Your first field assignment awaits.');}
export function prepare(state,kind){if(state.chapter!==7||state.phase!=='camp'||!PREPARATIONS.includes(kind))return result(false,'Choose fortify, rest, drill, or march in Chapter 7 camp.');state.preparation=kind;mark(state,'prepare');campaignLog(state,`Preparation: ${kind}. ${kind==='fortify'?'A protected starting position.':kind==='rest'?'The commander begins with more health.':kind==='drill'?'Allied strikes gain one damage.':'The cohorts start one tile farther forward.'}`);return result(true,`The legion will ${kind} before the battle.`);}
export function selectStratagem(state,kind){if(state.chapter!==9||state.phase!=='camp'||!STRATAGEMS.includes(kind))return result(false,'Choose night, feint, or flank in Chapter 9 camp.');state.stratagem=kind;mark(state,'stratagem');return result(true,kind==='night'?'A night march weakens enemy attacks.':kind==='feint'?'The feigned retreat exhausts armoured cavalry.':'A flank march strengthens your cohorts’ attacks.');}
export function negotiate(state,approach){if(state.chapter!==8||state.phase!=='camp'||!['safe-passage','grain','hostages'].includes(approach))return result(false,'Choose safe-passage, grain, or hostages in Chapter 8 camp.');if(state.negotiation)return result(false,'The crossing agreement has already been made.');state.negotiation=approach;mark(state,'negotiate');if(approach==='grain'){state.supplies=Math.max(0,state.supplies-2);state.meters.public=clamp(state.meters.public+3);}else if(approach==='hostages'){state.meters.public=clamp(state.meters.public-3);state.meters.army=clamp(state.meters.army+3);}campaignLog(state,`Crossing negotiation: ${approach}. The escort still has to bring the settlers over the river.`);return result(true,'The crossing terms are agreed. The council and escort remain playable challenges.');}
// The confrontation approach is a campaign choice: it goes through the rules
// API and is validated against the same forecast that startEncounter enforces.
export function chooseRoute(state,route){if(state.phase!=='camp'||state.chapter!==12||getChapter(state).encounters[state.encounterIndex]?.type!=='confrontation')return result(false,'Choose the confrontation approach in the Chapter XII camp before the final field encounter.');if(!finaleForecast(state).routes.some(r=>r.id===route))return result(false,'That confrontation route is not available at your current standing.');state.route=route;return result(true,'Confrontation approach selected. Enter the field when ready.');}
export function allocate(state,allocation){if(state.chapter!==10||state.phase!=='camp')return result(false,'Allocation is available in the governor’s camp.');if(state.allocation)return result(false,'The six convoys have already been allocated.');const values=['river','farms','town'].map(k=>allocation?.[k]);if(values.some(v=>!Number.isInteger(v)||v<1)||values.reduce((a,b)=>a+b,0)!==6)return result(false,'Allocate exactly six convoys, at least one each to river, farms, and town.');state.allocation=clone(allocation);state.supplies=clamp(state.supplies+allocation.river,0,99);mark(state,'allocate');state.meters.army=clamp(state.meters.army+allocation.river);state.meters.public=clamp(state.meters.public+allocation.farms);state.meters.political=clamp(state.meters.political+allocation.town);campaignLog(state,`${allocation.river} river convoys, ${allocation.farms} farm convoys, ${allocation.town} town convoys. The province will remember who received relief.`);return result(true,'The six supply convoys are dispatched.');}
export function judge(state,verdict){if(state.chapter!==10||state.phase!=='camp'||!['shared','settlers'].includes(verdict))return result(false,'The governor can order shared tenure or settler priority.');if(state.judgment)return result(false,'The land judgment is already recorded.');if(verdict!==state.decisions.ch10)return result(false,'Enter the verdict selected in the chapter decision so the written judgment matches your public undertaking.');state.judgment=verdict;mark(state,'judge');state.relationships.settler+=verdict==='settlers'?5:2;campaignLog(state,verdict==='shared'?'Shared tenure protects established villages and grants settlers a harvest share.':'Priority allotments give settlers land; established villages carry the loss.');return result(true,'Judgment entered. Address the Chamber and Rebut are now available in the tribunal.');}
export function settleObligation(state,id,honour){if(state.phase!=='camp')return result(false,'Resolve obligations in camp.');const obligation=state.obligations.find(o=>o.id===id);if(obligation&&state.chapter<(obligation.due??12))return result(false,'This obligation has not yet been called in.');if(!obligation||obligation.status!=='open')return result(false,'That obligation has already been resolved or does not exist.');obligation.status=honour?'honoured':'broken';if(!honour){if(['transport-favour','nephew-office'].includes(id))state.relationships.patron=clamp(state.relationships.patron-25,-100,100);if(id==='settler-farms')state.relationships.settler=clamp(state.relationships.settler-20,-100,100);if(id==='ferry-wages')state.meters.army=clamp(state.meters.army-10);if(id==='milan-immunity')state.meters.political=clamp(state.meters.political-4);}if(honour){const cost=Number(obligation.cost)||2;const unpaid=Math.max(0,cost-state.supplies);state.supplies=Math.max(0,state.supplies-cost);state.meters.public=clamp(state.meters.public-unpaid);campaignLog(state,`Honoured: ${obligation.promise}${unpaid?' Scarce resources make the treasury carry the shortfall.':''}`);}else{state.meters.public=clamp(state.meters.public-8);state.meters.political=clamp(state.meters.political-4);campaignLog(state,`Broken: ${obligation.promise} Public Confidence −8; Political Backing −4.`);}return result(true,`${obligation.to}: obligation ${obligation.status}.`);}
function unmetPreparation(state,data,options={}){if(!state.decisions[getChapter(state).decision.id])return 'Resolve the chapter’s consequential decision first.';if(state.chapter===1&&data.type!=='training'&&!state.oath)return 'Swear the oath after training before entering the field.';if(state.chapter===7&&data.kind==='battle'&&!state.preparation&&!PREPARATIONS.includes(options.preparation))return 'Prepare the legion: fortify, rest, drill, or march.';if(state.chapter===8&&!state.negotiation)return 'Negotiate the crossing terms before setting out.';if(state.chapter===9&&!state.stratagem&&!STRATAGEMS.includes(options.stratagem))return 'Choose an operational stratagem before battle.';if(state.chapter===10&&(!state.allocation||!state.judgment))return 'Allocate six convoys and judge the land dispute before the provincial challenges.';return null;}
export function startEncounter(state,options={}){const optionProblem=campaignOptionsProblem(state,options);if(optionProblem)return result(false,optionProblem);if(state.phase!=='camp')return result(false,'Return to camp or finish the current encounter first.');if(!canAccess(state,state.chapter))return result(false,'This chapter remains sealed by incomplete career milestones.');const chapter=getChapter(state),data=chapter.encounters[state.encounterIndex];if(!data)return result(false,'No encounter remains. Complete the promotion requirements.');const unmet=unmetPreparation(state,data,options)||departureProblem(state)||operationalDepartureProblem(state)||fieldApproachProblem(state);if(unmet)return result(false,unmet);if(options.preparation&&!PREPARATIONS.includes(options.preparation))return result(false,"Unknown preparation.");if(options.stratagem&&!STRATAGEMS.includes(options.stratagem))return result(false,"Unknown stratagem.");
  if(state.chapter===12&&data.type==='confrontation'){const forecast=finaleForecast(state);options={...options,route:options.route??state.route??'backer',forecast};if(!forecast.routes.some(r=>r.id===options.route))return result(false,'That confrontation route is not available at your current standing.');state.route=options.route;}
  if(options.preparation&&state.chapter===7)prepare(state,options.preparation);if(options.stratagem&&state.chapter===9)selectStratagem(state,options.stratagem);state.encounterOptions=clone(options);state.snapshot=clone({...state,snapshot:null,encounter:null});departFieldApproach(state);departCompany(state);departCommandCampaign(state,data);const create=data.kind==='contest'?(options.legacyLayout===true?createLegacyContest:createContest):(options.legacyLayout===true?createLegacyBattle:createBattle);state.encounter=create(state,data,options);if(options.weather&&['clear','rain','embers','dust','mist'].includes(options.weather))state.encounter.weather=options.weather;if(options.timeOfDay&&['day','dawn','dusk','night'].includes(options.timeOfDay))state.encounter.timeOfDay=options.timeOfDay;state.encounter.requiredAbilities=state.encounterIndex===chapter.encounters.length-1?chapterRequirements(state).filter(r=>!r.done).map(r=>r.id):[];initializeExpanded(state);initializeCommandCampaign(state);initializeFieldApproach(state);if(state.campaignEdition===34&&state.encounter.kind==='battle'){updateBattleProgress(state.encounter);refreshBattleIntents(state.encounter);}if(options.controls==='realtime')initializeRealtime(state);state.phase='encounter';return result(true,`${data.title}. A complete checkpoint has been saved before any encounter effects.`);}
// Real-time encounters (0.40): the page runs the live world; the chronicle
// keeps its latest snapshot (on start, pause, hide and save) and learns the
// outcome when the fight ends. Turn commands do not apply to them.
function initializeRealtime(state){
  const e=state.encounter;if(!realtimeMissionSupported(e))return;
  const world=createEncounterWorld(state,{seed:state.rng});e.controls='realtime';e.realtime={version:1,scale:world.scale,world:JSON.parse(snapshotWorld(world))};
}
export const isRealtime=state=>state?.phase==='encounter'&&state.encounter?.controls==='realtime';
export function realtimeWorld(state){return isRealtime(state)?restoreWorld(state.encounter.realtime.world):null;}
export function saveRealtime(state,world){
  if(!isRealtime(state)||state.encounter.status!=='active')return result(false,'No real-time encounter is in progress.');
  if(world?.encounterId!==state.encounter.id)return result(false,'That fight belongs to another encounter.');
  try{validateWorld(world,message=>{throw new Error(message);});}catch(error){return result(false,`The fight could not be recorded: ${error.message}`);}
  state.encounter.realtime.world=JSON.parse(snapshotWorld(world));return result(true,'Fight recorded.');
}
export function resolveRealtime(state,world){
  const saved=saveRealtime(state,world);if(!saved.ok)return saved;
  if(world.status==='active')return result(false,'The fight is still in progress.');
  applyRealtimeOutcome(state,world);
  return result(true,state.encounter.status==='won'?'Objective secured. Record the result to keep its rewards.':'The mission failed. Retry restores the complete encounter-start checkpoint.');
}
// The soldier's kit, training, purse and companions' orders (soldier.js): camp commands, each legal or refused unchanged.
export function soldierCommand(state,command){if(state.archiveReplay)return result(false,'The archive replay keeps your chronicle unchanged.');return soldierAct(state,command);}
// ——— The walkable camp (build brief §3.12) ———
export {errandList,createCampWorld,campPlaceAt};
export const campHasNews=(state,treeId)=>treeId==='table'?!state.decisions[getChapter(state).decision.id]:treeId==='gate'?false:hasNews(state,treeId);
// Why the column cannot march out now, or null (the 0.38 departure rules, unchanged).
export function departureCheck(state){
  if(state.phase!=='camp')return 'Return to camp first.';const chapter=getChapter(state),data=chapter.encounters[state.encounterIndex];
  if(!data)return 'No encounter remains. Complete the promotion requirements.';
  return unmetPreparation(state,data,{})||departureProblem(state)||operationalDepartureProblem(state)||fieldApproachProblem(state)||null;
}
// A conversation node: the data trees (core/dialogue.js), and the two the chapter builds — the commander's table and the gate.
export function campConversation(state,treeId,nodeId=null){
  if(treeId==='table')return tableConversation(state);
  if(treeId==='gate')return gateConversation(state);
  return dialogueNode(state,treeId,nodeId);
}
function tableConversation(state){
  const d=getChapter(state).decision,picked=state.decisions[d.id],council={text:'Consult the War Council.',next:null,needs:[],preview:[],open:'council'};
  if(picked){const o=d.options.find(x=>x.id===picked);
    return {treeId:'table',nodeId:'decided',speaker:'The commander’s table',text:`${d.prompt} Your decision is recorded: ${o.label}. ${o.consequence??o.description}`,
      options:[{index:0,...council},{index:1,text:'Leave the table.',next:null,needs:[],preview:[]}]};}
  const meters=e=>Object.entries({army:'Army Loyalty',political:'Political Backing',public:'Public Confidence',supplies:'supplies'}).filter(([k])=>e?.[k])
    .map(([k,name])=>`${e[k]>0?'+':''}${e[k]} ${name}`);
  return {treeId:'table',nodeId:'decide',speaker:'The commander’s table',text:d.prompt,options:[
    ...d.options.map((o,index)=>({index,text:`${o.label}: ${o.description}`,next:null,needs:[],decision:o.id,
      preview:[...meters(o.effects),...(o.obligation?[`owed to ${o.obligation.to}, due Chapter ${o.obligation.due}`]:[])]})),
    {index:d.options.length,...council},{index:d.options.length+1,text:'Not yet.',next:null,needs:[],preview:[]}]};
}
function gateConversation(state){
  const data=getChapter(state).encounters[state.encounterIndex],problem=departureCheck(state);
  return {treeId:'gate',nodeId:'gate',speaker:'The camp gate',text:data?`${data.title}. ${data.objective}`:'The column waits for your promotion.',
    options:[...(data?[{index:0,text:`March out: ${data.title}`,next:null,needs:problem?[problem]:[],preview:[],open:'march'}]:[]),{index:1,text:'Not yet.',next:null,needs:[],preview:[]}]};
}
// Choose a reply in camp: { ok, message, next, open }. Refused replies change nothing.
export function campReply(state,{treeId,nodeId=null,index}={}){
  if(state.archiveReplay)return result(false,'The archive replay keeps your chronicle unchanged.');
  if(state.phase!=='camp')return result(false,'Conversations in camp wait until you are back in camp.');
  if(treeId==='table'||treeId==='gate'){
    const o=campConversation(state,treeId).options.find(x=>x.index===index);if(!o)return result(false,'That reply is not open now.');
    if(o.needs.length)return result(false,o.needs.join(' '));
    if(o.decision){const r=choose(state,o.decision);return r.ok?{...r,next:null,open:null}:r;}
    return {ok:true,message:'',next:null,open:o.open??null};
  }
  return dialogueReply(state,{treeId,nodeId,index},{choose,swearOath});
}
// The places of this chapter's camp the soldier has walked to (the map fast-travels to them).
export function campVisit(state,place){
  if(state.phase!=='camp'||!state.soldier||!campFor(state.chapter)||!CAMP_PLACES.includes(place))return result(false,'No such place in this camp.');
  const key=`visited:${state.chapter}:${place}`;if(state.soldier.flags[key])return result(false,'Already visited.');
  state.soldier.flags[key]=true;return result(true,`${place} visited.`);
}
export const campVisited=state=>CAMP_PLACES.filter(p=>state.soldier?.flags?.[`visited:${state.chapter}:${p}`]);
// After a won fight the field can still be searched: what the fallen carried
// joins the staged spoils, which the pack receives only when the result is recorded.
export function takeSpoils(state,{bodyId,items}={}){
  const e=state.encounter;if(!isRealtime(state)||e.status!=='won'||state.archiveReplay)return result(false,'Only a won field can be searched.');
  const world=e.realtime.world,body=world.actors.find(a=>a.id===bodyId);
  if(!body||body.alive||!Array.isArray(items)||!items.length||items.length>12)return result(false,'Nothing to take there.');
  const left=[...(body.loot??[])];for(const id of items){const i=left.indexOf(id);if(i<0)return result(false,'That is not there to take.');left.splice(i,1);}
  if(world.spoils.length+items.length>60)return result(false,'You cannot carry more from this field.');
  body.loot=left;for(const itemId of items)world.spoils.push({itemId,from:body.id});e.staged.spoils=world.spoils.map(s=>s.itemId);
  return result(true,`You take ${items.map(id=>REALTIME_ITEMS[id].name.toLowerCase()).join(', ')} from ${body.name}. It is yours when the result is recorded.`);
}
export function getActions(state,unitId){if(state.phase!=='encounter'||!state.encounter||state.encounter.controls==='realtime')return [];const unit=state.encounter.units.find(u=>u.id===unitId);return state.encounter.kind==='contest'?contestActions(state,unit):battleActions(state,unit);}
export function getTargets(state,unitId,action){if(!getActions(state,unitId).includes(action))return [];const unit=state.encounter.units.find(u=>u.id===unitId);return state.encounter.kind==='contest'?contestTargets(state,unit,action):battleTargets(state,unit,action);}
// What a click on ground would do with this unit's move this turn: where it
// stops, the route it walks and the rest of the way (movement.js planMove).
// Read-only; null when there is no ground to plan for.
export function moveRoute(state,unitId,point){
  const e=state?.encounter,unit=e?.units?.find(u=>u.id===unitId);
  if(state?.phase!=='encounter'||!e||e.status!=='active'||!unit||!alive(unit)||!point||!Number.isInteger(point.x)||!Number.isInteger(point.y)||point.x<0||point.y<0||point.x>=e.width||point.y>=e.height||point.x===unit.x&&point.y===unit.y)return null;
  return planMove(e,unit,point,getTargets(state,unitId,'move'));
}
export function preview(state,command){if(state.phase!=='encounter'||!state.encounter||state.encounter.status!=='active')return result(false,'No active encounter.');if(state.encounter.controls==='realtime')return result(false,'This encounter is played in real time.');if(!command||!Number.isInteger(command.x)||!Number.isInteger(command.y))return result(false,'A unit, action and grid target are required.');return state.encounter.kind==='contest'?previewContest(state,command):previewBattle(state,command);}
export function act(state,command){const checked=preview(state,command);if(!checked.ok)return checked;const response=state.encounter.kind==='contest'?applyContest(state,command):applyBattle(state,command);if(response.ok)mark(state,command.action);return response;}
export function canUndoMove(state,unitId='hero'){
  const e=state?.encounter,u=e?.units?.find(x=>x.id===unitId);
  if(state?.phase!=='encounter'||!e||e.status!=='active'||!u||!alive(u)||!['player','ally'].includes(u.side)||!u.moved||u.acted||!u.moveOrigin)return {available:false,unitId,origin:null,reason:'Move a unit or speaker before acting to undo that move.'};
  if(unitAt(e,u.moveOrigin.x,u.moveOrigin.y,u.id))return {available:false,unitId,origin:u.moveOrigin,reason:'The starting tile is now occupied.'};
  return {available:true,unitId:u.id,origin:{...u.moveOrigin},reason:`Undo ${u.name}’s move and return to ${u.moveOrigin.x+1}${String.fromCharCode(65+u.moveOrigin.y)}.`};
}
export function undoMove(state,unitId='hero'){
  const check=canUndoMove(state,unitId);if(!check.available)return result(false,check.reason);
  const e=state.encounter,u=e.units.find(x=>x.id===unitId),origin=u.moveOrigin;
  u.x=origin.x;u.y=origin.y;u.facing=origin.facing??u.facing??'east';
  if(e.kind==='battle'&&e.combatVersion===2)u.lastMoveDistance=origin.lastMoveDistance??0;
  u.moved=false;delete u.moveOrigin;
  // Once no move remains undoable, restore the credit from before the chain.
  const credit=origin.credit;
  if(credit&&!e.units.some(x=>x.id!==u.id&&x.moveOrigin)){
    if(!credit.used){const i=e.usedAbilities.indexOf('move');if(i>=0)e.usedAbilities.splice(i,1);}
    if(!credit.capabilityUse)delete state.capabilityUse.move;
    const list=state.chapterCapabilities[state.chapter];if(list&&!credit.chapter){const i=list.indexOf('move');if(i>=0)list.splice(i,1);if(!credit.chapterList&&!list.length)delete state.chapterCapabilities[state.chapter];}
  }
  const coord=`${u.x+1}${String.fromCharCode(65+u.y)}`;
  note(e,`${u.name} steps back to ${coord}; movement restored.`);
  if(e.kind==='battle'){checkBattle(state);refreshBattleIntents(e);}else if(e.politicsVersion===2)refreshContestIntents(state);
  return result(true,`${u.name} returned to ${coord}; movement restored.`);
}
export function endTurn(state){if(state.phase!=='encounter'||state.encounter?.status!=='active')return result(false,'No active encounter turn.');if(state.encounter.controls==='realtime')return result(false,'This encounter is played in real time.');return state.encounter.kind==='contest'?endContestTurn(state):endBattleTurn(state);}
export function retry(state){if(!state.snapshot||!state.encounter)return result(false,'There is no encounter checkpoint to retry.');const restored=clone(state.snapshot),options=clone(state.encounterOptions??{});restored.phase='camp';restored.encounter=null;restored.snapshot=null;const response=startEncounter(restored,options);if(!response.ok)return response;for(const key of Object.keys(state))delete state[key];Object.assign(state,restored);return result(true,'Restored the complete encounter-start campaign, RNG, inventory, decisions, meters and obligations.');}
export function acceptFallback(state){if(state.phase!=='encounter'||state.encounter?.status!=='lost'||state.encounter.kind!=='contest')return result(false,'A patron-backed re-run is available after a failed Contest.');if(state.encounter.fallback)return result(false,'The patron is already backing this vote. Retry its checkpoint.');const id=state.encounter.id,snapshot=clone(state.snapshot),options=clone(state.encounterOptions??{});for(const key of Object.keys(state))delete state[key];Object.assign(state,snapshot);state.phase='camp';state.encounter=null;state.snapshot=null;state.supplies=Math.max(0,state.supplies-2);const debt={id:`fallback:${id}`,to:'The grain syndicate',promise:'Give the syndicate first claim on the next two provincial harvests.',due:12,cost:5,consequence:'A re-run with three votes committed; the province bears a five-convoy debt.',status:'open'};if(!state.obligations.some(o=>o.id===debt.id))state.obligations.push(debt);campaignLog(state,`Accepted costly backing for ${id}. No rank or milestone has been granted. The next checkpoint is the re-run of this same vote.`);return startEncounter(state,{...options,fallback:true});}
export function commitEncounter(state){const e=state.encounter;if(state.phase!=='encounter'||!e||e.status!=='won')return result(false,'Win the encounter before committing its result.');if(state.archiveReplay)return result(false,'Archive replay complete. Sandbox encounters do not alter your committed chronicle.');if(state.history.some(h=>h.id===e.id))return result(false,'This encounter has already been committed.');applyEffects(state,e.staged?.meters);state.supplies=clamp(state.supplies+(e.staged?.supplies??0),0,99);for(const obligation of e.staged?.obligations??[])if(!state.obligations.some(o=>o.id===obligation.id))state.obligations.push(clone(obligation));
  commitOperationResult(state,e);commitAgreements(state,e);commitExpanded(state,e);commitCommandCampaign(state,e);commitFieldApproach(state);const veterans=recordCompanyService(state,e);if(state.soldier)commitSoldierRewards(state,e);if(e.kind==='battle'&&state.companyOrders)state.companyOrders.package='none';state.history.push({id:e.id,chapter:state.chapter,kind:e.kind,turns:e.turn,result:'won',route:e.route??null,losses:e.units.filter(u=>u.side==='ally'&&!alive(u)).length,veterans});addMilestone(state,`encounter:${e.id}`);state.meters.army=clamp(state.meters.army+(e.kind==='battle'?3:0));state.meters.political=clamp(state.meters.political+(e.kind==='contest'?3:0));state.encounterIndex++;state.encounter=null;state.snapshot=null;state.phase=state.encounterIndex>=getChapter(state).encounters.length?'promotion':'camp';if(state.chapter===11&&state.phase==='promotion')addMilestone(state,'senate-challenge');if(state.chapter===12&&state.phase==='promotion')addMilestone(state,'confrontation');campaignLog(state,`${e.title} completed in ${e.turn} turns. Rewards applied once.`);return result(true,state.phase==='promotion'?'The chapter’s encounters are complete. Review your earned advancement.':'Result saved. The next camp checkpoint is ready.');}
export function advanceChapter(state){if(state.phase!=='promotion')return result(false,'Complete every required encounter before advancement.');const missing=chapterRequirements(state).filter(r=>!r.done);if(missing.length)return result(false,`Demonstrate the chapter’s capabilities before advancing: ${missing.map(r=>r.id).join(', ')}.`);const chapter=getChapter(state);if(state.history.filter(h=>h.chapter===state.chapter).length!==chapter.encounters.length)return result(false,'A required challenge remains uncommitted.');if(!state.completed.includes(state.chapter))state.completed.push(state.chapter);addMilestone(state,`chapter:${state.chapter}`);if(state.soldier){rewardCapabilities(state);issuePromotions(state,state.chapter);}
  if(state.chapter===9)addMilestone(state,'dux');if(state.chapter===10)addMilestone(state,'governorship');if(state.chapter===11)addMilestone(state,'senator');if(state.chapter===12){if(!state.milestones.includes('senator')||!state.milestones.includes('confrontation'))return result(false,'Accession requires both Senate admission and the final confrontation.');addMilestone(state,'augustus');state.rank='Augustus';state.phase='epilogue';campaignLog(state,'The army acclaims you Augustus. The Senate confirms. The oath returns to the hand that first held the lead seal.');return result(true,'The campaign is complete. Read the accession and epilogue.');}
  const equipment={1:'Military belt and mail',3:'Optio’s staff',4:'Centurion’s vine stick',6:'Equestrian gold ring and narrow-striped tunic',9:'General’s cloak',11:'Senatorial broad stripe'}[state.chapter];if(equipment&&!state.inventory.includes(equipment))state.inventory.push(equipment);campaignLog(state,`${chapter.promotion}: ${chapter.reward}`);state.chapter++;state.rank=RANKS[state.chapter-1];state.encounterIndex=0;state.phase='camp';state.preparation=null;state.stratagem=null;state.route=null;return result(true,`Chapter ${state.chapter}: ${getChapter(state).title}.`);}
export function finaleForecast(state){const {army,political,public:confidence}=state.meters;const allies=finaleCompanySize(state),enemies=Math.max(3,6-Math.floor(confidence/30));const routes=[{id:'backer',label:'Accept costly backing',description:'A guaranteed relief force joins you. Defeat every rival field formation by turn 16; owe two years of revenue to the army’s creditors.'},{id:'battle',label:'Win the field',description:'Defeat every rival field formation by turn 16 through manoeuvre and command. No new accession debt.'}];if(army>=55)routes.push({id:'defection',label:'Win the legions',description:'Rally within three tiles of rival infantry to lower morale by 40. At 25 morale or less they pledge allegiance. Secure three pledges by turn 16; defeating the remaining rivals also wins.'});if(political>=50)routes.push({id:'settlement',label:'Negotiate a settlement',description:'Escort the Senate’s envoy within one tile of 7D. Bring the commander within two tiles, Rally, and sustain the meeting through two end turns by turn 16.'});if(confidence>=60&&political>=40)routes.push({id:'surrender',label:'Receive the surrender',description:'Secure both approaches at 5B and 5G: a friendly unit within one tile, with no enemy within one. Then bring the commander within one tile of the standard at 7D by turn 16.'});return {routes,allies,enemies,description:`${allies} loyal formations against ${enemies} rival formations. ${state.decisions.ch2==='leave'?'Sabinus commands the minimum relief legion in Lucan’s absence.':'Lucan brings the minimum relief legion.'} ${political>=50?'Senatorial backing lowers enemy morale and opens settlement.':'The rival retains senatorial cover.'} ${confidence>=60?'The gates stand open.':'The city watches behind its walls.'} The costly backer remains available even at zero standing. The commander must survive every route.`,enemyMorale:Math.max(20,80-Math.floor(political/2)),enemyDamage:Math.max(2,4-Math.floor(political/50)),enemyHealth:Math.max(8,12-Math.floor(confidence/30))};}
export function quartermasterForecast(state){
  const supplies=state?.supplies??0;
  const openObligations=(state?.obligations??[]).filter(o=>o.status==='open').map(o=>({...o,cost:Number(o.cost)||2,due:o.due??12,dueNow:(state?.chapter??1)>=(o.due??12)}));
  const openAgreements=state?.progressionVersion===1?(state?.progression?.agreements??[]).filter(a=>a.status==='open').map(a=>({...a,cost:Number(a.cost)||1,due:a.due??12,dueNow:(state?.chapter??1)>=(a.due??12)})):[];
  const obligationCost=openObligations.reduce((n,o)=>n+o.cost,0);
  const agreementCost=openAgreements.reduce((n,a)=>n+a.cost,0);
  const totalCommittedCost=obligationCost+agreementCost;
  const dueNowCost=openObligations.filter(o=>o.dueNow).reduce((n,o)=>n+o.cost,0)+openAgreements.filter(a=>a.dueNow).reduce((n,a)=>n+a.cost,0);
  const dueNowCount=openObligations.filter(o=>o.dueNow).length+openAgreements.filter(a=>a.dueNow).length;
  const netBalance=supplies-totalCommittedCost,solvent=netBalance>=0,shortfall=Math.max(0,-netBalance);
  const {army=0,political=0,public:confidence=0}=state?.meters??{};
  const finaleRoutes=[
    {id:'backer',label:'Accept costly backing',unlocked:true,requirement:'Always available (adds 6-supply debt)',progress:'Ready'},
    {id:'battle',label:'Win the field',unlocked:true,requirement:'Always available (tactical victory)',progress:'Ready'},
    {id:'defection',label:'Win the legions',unlocked:army>=55,requirement:'55+ Army Loyalty',progress:`Army ${army}/55`},
    {id:'settlement',label:'Negotiate a settlement',unlocked:political>=50,requirement:'50+ Political Backing',progress:`Political ${political}/50`},
    {id:'surrender',label:'Receive the surrender',unlocked:confidence>=60&&political>=40,requirement:'60+ Public & 40+ Political',progress:`Public ${confidence}/60 · Political ${political}/40`},
  ];
  return {supplies,openObligations,openAgreements,obligationCost,agreementCost,totalCommittedCost,dueNowCount,dueNowCost,netBalance,solvent,shortfall,finaleRoutes,unlockedRouteCount:finaleRoutes.filter(r=>r.unlocked).length};
}
export function legalCommands(state){if(state.phase!=='encounter')return [];return state.encounter.units.flatMap(unit=>getActions(state,unit.id).flatMap(action=>getTargets(state,unit.id,action).map(target=>({unitId:unit.id,action,x:target.x,y:target.y,...(target.unitId?{targetId:target.unitId}:{})}))));}
export function voteCount(state){return state.encounter?.kind==='contest'?votes(state.encounter):null;}
export function archiveEncounters(state){
  return (state?.history??[]).map(h=>{
    const ch=CHAPTERS[(h.chapter??1)-1],data=ch?.encounters.find(e=>e.id===h.id);
    if(!ch||!data)return null;
    return {id:h.id,chapter:ch.id,chapterTitle:ch.title,setting:ch.setting,title:data.title,kind:data.kind,type:data.type,objective:data.objective,recordedTurns:h.turns,recordedLosses:h.losses??0,recordedRoute:h.route??null,veterans:clone(h.veterans??[])};
  }).filter(Boolean);
}
export function createArchiveReplay(state,encounterId,options={}){
  const entries=archiveEncounters(state),entry=entries.find(e=>e.id===encounterId);
  if(!entry)return result(false,'Complete an encounter in your campaign chronicle before opening it in the Archive.');
  const ch=CHAPTERS[entry.chapter-1],idx=ch.encounters.findIndex(e=>e.id===encounterId),data=ch.encounters[idx];
  const sandbox=clone(state);if(sandbox.campaignEdition===34)sandbox.commandCampaign.plan='balanced';if(sandbox.tacticsEdition===35)sandbox.fieldApproach='balanced';
  sandbox.chapter=ch.id;sandbox.rank=RANKS[ch.id-1];sandbox.phase='camp';sandbox.encounterIndex=idx;sandbox.encounter=null;sandbox.snapshot=null;
  sandbox.completed=Array.from({length:ch.id-1},(_,i)=>i+1);
  sandbox.milestones=(sandbox.milestones??[]).filter(m=>{if(m.startsWith('chapter:'))return Number(m.slice(8))<ch.id;if(m==='dux')return ch.id>=10;if(m==='governorship')return ch.id>=11;if(m==='senator'||m==='senate-challenge')return ch.id>=12;if(m==='augustus'||m==='confrontation')return false;return true;});
  for(let i=1;i<ch.id;i++)addMilestone(sandbox,`chapter:${i}`);
  if(ch.id>=10)addMilestone(sandbox,'dux');
  if(ch.id>=11)addMilestone(sandbox,'governorship');
  if(ch.id>=12){addMilestone(sandbox,'senator');addMilestone(sandbox,'senate-challenge');}
  sandbox.decisions[ch.decision.id]??=ch.decision.options[0].id;
  if(ch.id===1&&data.type!=='training')sandbox.oath=true;
  if(ch.id===7&&data.kind==='battle')sandbox.preparation=options.preparation??sandbox.preparation??'drill';
  if(ch.id===8)sandbox.negotiation=options.negotiation??sandbox.negotiation??'safe-passage';
  if(ch.id===9)sandbox.stratagem=options.stratagem??sandbox.stratagem??'flank';
  if(ch.id===10){sandbox.allocation??={river:2,farms:2,town:2};sandbox.judgment??=sandbox.decisions.ch10;}
  for(const v of sandbox.company??[])v.recovery=0;
  if(options.difficulty&&['story','standard','veteran'].includes(options.difficulty)){sandbox.campaignRules=2;sandbox.difficulty=options.difficulty;sandbox.companyOrders??={priority:(sandbox.company??[]).map(v=>v.id),package:'none'};}
  if(ch.id===12&&data.type==='confrontation'&&options.route&&['backer','battle','defection','settlement','surrender'].includes(options.route)){if(options.route==='defection')sandbox.meters.army=Math.max(sandbox.meters.army,55);if(options.route==='settlement')sandbox.meters.political=Math.max(sandbox.meters.political,50);if(options.route==='surrender'){sandbox.meters.public=Math.max(sandbox.meters.public,60);sandbox.meters.political=Math.max(sandbox.meters.political,40);}}
  const startOpts=ch.id===12&&data.type==='confrontation'?{...options,route:options.route??entry.recordedRoute??sandbox.route??'backer'}:{...options};
  sandbox.archiveReplay={encounterId:entry.id,title:entry.title,chapter:entry.chapter,chapterTitle:entry.chapterTitle,recordedTurns:entry.recordedTurns,recordedLosses:entry.recordedLosses,recordedRoute:entry.recordedRoute,difficulty:sandbox.difficulty??'standard',weather:options.weather??null,timeOfDay:options.timeOfDay??null,route:startOpts.route??null,stratagem:sandbox.stratagem??null,preparation:sandbox.preparation??null};
  const started=startEncounter(sandbox,startOpts);if(!started.ok)return started;
  return {...result(true,`Archive replay opened: ${entry.title} (Chapter ${entry.chapter}). Your primary campaign save remains untouched.`),state:sandbox};
}

function validateEncounter(e,fail){
  if(e.campaignRules!==undefined&&(e.campaignRules!==2||!['story','standard','veteran'].includes(e.difficulty)))fail('encounter difficulty.');if(e.campaignRules===undefined&&(e.difficulty!==undefined||e.companyPackage!==undefined))fail('unversioned encounter options.');if(e.campaignRules===2&&(e.kind==='battle'?e.combatVersion:e.politicsVersion)!==2)fail('campaign encounter rules version.');
  if((e.companyPackage!==undefined||e.campaignRules===2&&e.kind==='battle'&&e.type!=='training')&&!['none','recovery','rearm','support'].includes(e.companyPackage))fail('company package.');
  const bounded=(n,min,max)=>Number.isFinite(n)&&Number.isInteger(n)&&n>=min&&n<=max;
  const point=p=>p&&typeof p==='object'&&bounded(p.x,0,e.width-1)&&bounded(p.y,0,e.height-1);
  for(const key of ['combatVersion','politicsVersion'])if(e[key]!==undefined&&![1,2].includes(e[key]))fail('encounter rules version.');
  if(!(e.width===8||e.featureEdition===31&&e.width===10)||e.height!==8||!Array.isArray(e.terrain)||e.terrain.length!==8||e.terrain.some(row=>!Array.isArray(row)||row.length!==e.width||row.some(t=>!['grass','marsh','sand','road','rock','ford','high','wall','chamber','river','stone'].includes(t))))fail('terrain grid.');
  if(e.units.some(u=>!u||typeof u!=='object'))fail('unit schema.');
  if(new Set(e.units.map(u=>u.id)).size!==e.units.length||e.units.filter(u=>u.id==='hero'&&u.side==='player').length!==1)fail('unit identities.');
  if(e.units.filter(u=>['player','ally'].includes(u.side)&&alive(u)).length>8)fail('force exceeds eight units.');
  for(const u of e.units){if(typeof u.id!=='string'||typeof u.name!=='string'||!['player','ally','enemy','neutral'].includes(u.side)||typeof u.moved!=='boolean'||typeof u.acted!=='boolean'||!bounded(u.maxHp,1,100)||!bounded(u.move,0,8))fail('unit schema.');if(e.kind==='contest'&&u.role==='speaker'&&(!bounded(u.resolve,0,u.maxResolve)||!bounded(u.maxResolve,1,100)))fail('speaker Resolve.');if(e.kind==='contest'&&u.role==='voter'&&!bounded(u.stance,-6,6))fail('member Stance.');}
  for(const u of e.units){if(u.lastMoveDistance!==undefined&&!bounded(u.lastMoveDistance,0,8))fail('last movement distance.');if(u.facing!==undefined&&!['north','east','south','west'].includes(u.facing))fail('unit facing.');if(u.formation!==undefined&&u.formation!==null&&!['line','shield-wall','wedge'].includes(u.formation))fail('unit formation.');if(u.veteranId!==undefined&&!VETERAN_IDS.includes(u.veteranId))fail('unit veteran identity.');if(u.anchor!==undefined&&!point(u.anchor))fail('unit anchor.');if(u.moveOrigin!==undefined&&(!point(u.moveOrigin)||(u.moveOrigin.facing!==undefined&&!['north','east','south','west'].includes(u.moveOrigin.facing))||(u.moveOrigin.lastMoveDistance!==undefined&&!bounded(u.moveOrigin.lastMoveDistance,0,8))))fail('unit move origin.');}
  if(e.turnEvents!==undefined&&(!Array.isArray(e.turnEvents)||e.turnEvents.length>160||e.turnEvents.some(message=>typeof message!=='string'||message.length>1000)))fail('turn events.');
  if(e.collectTurnEvents!==undefined&&typeof e.collectTurnEvents!=='boolean')fail('turn event capture.');
  if(e.kind==='battle'&&(e.mission!==undefined||e.scenario!==undefined)){
    const m=e.mission;
    if(e.scenario!==e.id||!m||typeof m!=='object'||Array.isArray(m)||!['training','clear','hold','recover','extract','capture','supply','defection','settlement','surrender'].includes(m.mode))fail('battle mission.');
    if(['holdRequired','holdProgress','rallyProgress','envoyProgress'].some(key=>!bounded(m[key],0,30)))fail('mission progress.');
    if(!Array.isArray(m.points)||m.points.length>16||m.points.some(p=>!point(p)||typeof p.secured!=='boolean'))fail('mission positions.');
    if(!Array.isArray(m.waves)||m.waves.length>30||m.waves.some(w=>!point(w)||!bounded(w.turn,1,30)||typeof w.role!=='string'||!w.role||w.role.length>40||typeof w.arrived!=='boolean'))fail('mission reinforcements.');
    if(!Array.isArray(m.escortIds)||m.escortIds.length>8||new Set(m.escortIds).size!==m.escortIds.length||m.escortIds.some(id=>typeof id!=='string'||!e.units.some(u=>u.id===id&&u.role==='escort')))fail('mission escorts.');
  }
  validateOperation(e,fail);
  if(e.kind==='contest'&&(e.issue!==undefined||e.rivalStyle!==undefined||e.recordUses!==undefined)){
    if(typeof e.issue!=='string'||!e.issue||e.issue.length>1000||!['lobby','broker','prosecutor'].includes(e.rivalStyle))fail('chamber issue.');
    if(!Array.isArray(e.recordUses)||e.recordUses.length>40||new Set(e.recordUses).size!==e.recordUses.length||e.recordUses.some(id=>typeof id!=='string'||!e.units.some(u=>u.id===id&&u.role==='voter')))fail('service record arguments.');
    if(e.units.some(u=>u.role==='voter'&&!['service','security','law','grain','office'].includes(u.interest)))fail('member interest.');
  }
  if(!Array.isArray(e.usedAbilities)||!Array.isArray(e.log)||!Array.isArray(e.requiredAbilities)||!e.staged||!e.staged.meters||!Array.isArray(e.staged.obligations)||!bounded(e.staged.supplies,-99,99)||Object.values(e.staged.meters).some(n=>!bounded(n,-100,100)))fail('staged transaction.');
  if(e.kind==='contest'&&(!Array.isArray(e.promises)||e.promises.length>2||!Array.isArray(e.hardened)||!e.cooldowns||!bounded(e.electorate,1,40)||!bounded(e.majority,1,40)||(e.precedentUsed!==undefined&&!['frontier-roll','provincial-charter','fiscal-audit','consular-privilege'].includes(e.precedentUsed))||(e.precedentShield!==undefined&&typeof e.precedentShield!=='boolean')))fail('Contest data.');
  if(e.kind==='battle'&&((e.fieldworks!==undefined&&(!Array.isArray(e.fieldworks)||e.fieldworks.length>8||e.fieldworks.some(f=>!point(f)||!['stakes','rampart','brazier'].includes(f.type))))||(e.fieldworkUsed!==undefined&&!['stakes','rampart','brazier'].includes(e.fieldworkUsed))))fail('fieldworks.');
  if(!e.goal||!bounded(e.goal.x,0,7)||!bounded(e.goal.y,0,7)||!bounded(e.turnLimit,1,30))fail('objective data.');
  if(e.controls!==undefined||e.realtime!==undefined){
    if(e.controls!=='realtime'||!e.realtime||e.realtime.version!==1||!(e.realtime.scale>=2&&e.realtime.scale<=4.5)||e.realtime.world?.encounterId!==e.id)fail('real-time encounter.');
    validateWorld(e.realtime.world,fail);
    // What a real-time result stages for its commit: bounded so a save cannot grant more than a fight could.
    const st=e.staged;
    if((st.killTP!==undefined&&!(Number.isInteger(st.killTP)&&st.killTP>=0&&st.killTP<=240))||(st.commendations!==undefined&&(!Array.isArray(st.commendations)
      ||st.commendations.length>3||st.commendations.some(c=>!c||typeof c.id!=='string'||c.id.length>40||!(Number.isInteger(c.tp)&&c.tp>=1&&c.tp<=3))))
      ||(st.spoils!==undefined&&(!Array.isArray(st.spoils)||st.spoils.length>60||st.spoils.some(id=>!REALTIME_ITEMS[id])))
      ||(st.journal!==undefined&&(!Array.isArray(st.journal)||st.journal.length>40||st.journal.some(l=>typeof l!=='string'||l.length>240))))fail('real-time staged rewards.');
  }
}
function validateCareerFields(state,fail){
  const bounded=(n,max)=>Number.isInteger(n)&&n>=0&&n<=max;
  if(state.company!==undefined){if(!Array.isArray(state.company)||state.company.length!==5||new Set(state.company.map(v=>v?.id)).size!==5)fail('company roll.');for(const v of state.company)if(!v||!VETERAN_IDS.includes(v.id)||typeof v.name!=='string'||v.name.length>80||!bounded(v.service,99)||!bounded(v.commendations,12)||!bounded(v.recovery,2))fail('veteran record.');const expected=createCompany(state).map(v=>v.id);if(state.company.some((v,index)=>v.id!==expected[index]))fail('identities on company roll.');}
  if(state.storyProgress!==undefined){if(!state.storyProgress||typeof state.storyProgress!=='object'||Array.isArray(state.storyProgress)||Object.keys(state.storyProgress).length>128)fail('reading progress.');for(const[key,index]of Object.entries(state.storyProgress))if(!/^ch(?:[1-9]|1[0-2]):[a-z0-9:-]{1,70}$/.test(key)||!bounded(index,80))fail('reading progress entry.');}
}
function validateState(state,allowSnapshot=true){const fail=message=>{throw new Error(`Invalid save: ${message}`);};if(!state||typeof state!=='object'||state.version!==1)fail('incompatible format.');if(typeof state.name!=='string'||state.name.length>40)fail('name.');if(!Number.isInteger(state.chapter)||state.chapter<1||state.chapter>12)fail('chapter.');if(!['camp','encounter','promotion','epilogue'].includes(state.phase))fail('phase.');if(!Number.isInteger(state.rng)||state.rng<0||state.rng>4294967295)fail('random generator.');if(!Array.isArray(state.completed)||!state.completed.every((c,i)=>c===i+1)||new Set(state.completed).size!==state.completed.length)fail('chapter history.');if(!Array.isArray(state.milestones)||!state.milestones.every(x=>typeof x==='string')||new Set(state.milestones).size!==state.milestones.length)fail('milestones.');if(!Array.isArray(state.history)||new Set(state.history.map(x=>x.id)).size!==state.history.length)fail('duplicate encounter commits.');if(!state.meters||['army','political','public'].some(k=>!Number.isFinite(state.meters[k])||state.meters[k]<0||state.meters[k]>100))fail('campaign meters.');if(!Number.isFinite(state.supplies)||state.supplies<0||state.supplies>99)fail('supplies.');if(!Array.isArray(state.obligations)||new Set(state.obligations.map(o=>o.id)).size!==state.obligations.length||state.obligations.some(o=>!['open','honoured','broken'].includes(o.status)))fail('obligations.');if(!state.decisions||Array.isArray(state.decisions))fail('decisions.');for(const[id,value]of Object.entries(state.decisions)){const chapter=CHAPTERS.find(c=>c.decision.id===id);if(!chapter||!chapter.decision.options.some(o=>o.id===value))fail('unknown narrative choice.');}if(!state.capabilityUse||!state.chapterCapabilities||!state.relationships||!Array.isArray(state.inventory)||!Array.isArray(state.log))fail('missing campaign data.');if(!canAccess(state,state.chapter))fail('chapter access requirements are unmet.');if(state.completed.length!==(state.phase==='epilogue'?12:state.chapter-1))fail('career sequence.');if(state.phase==='promotion'&&chapterRequirements(state).some(r=>!r.done))fail('unearned chapter capability.');if(state.completed.some(c=>!state.milestones.includes(`chapter:${c}`)))fail('missing completed chapter milestone.');if(state.milestones.includes('dux')&&!state.completed.includes(9))fail('unearned highest command.');if(state.milestones.includes('governorship')&&!state.completed.includes(10))fail('unearned governorship.');if(state.milestones.includes('senator')&&(!state.completed.includes(11)||!state.milestones.includes('senate-challenge')))fail('unearned Senate admission.');if(state.rank!==RANKS[state.chapter-1]&&!(state.phase==='epilogue'&&state.rank==='Augustus'))fail('rank does not match earned career.');if(!Number.isInteger(state.encounterIndex)||state.encounterIndex<0||state.encounterIndex>getChapter(state).encounters.length)fail('encounter index.');
  validateCareerFields(state,fail);validateSoldier(state,fail);validateCampaignOptions(state,fail);validateProgression(state,fail);validateExpanded(state,fail);validateCommandCampaign(state,fail);validateFieldApproaches(state,fail);if(state.phase==='encounter'){const e=state.encounter;if(!e||!['battle','contest'].includes(e.kind)||!['active','won','lost'].includes(e.status)||!Array.isArray(e.units)||e.units.length>40)fail('encounter.');if(!state.snapshot)fail('missing transaction checkpoint.');if(state.snapshot.chapter!==state.chapter||state.snapshot.encounterIndex!==state.encounterIndex||state.snapshot.phase!=='camp')fail('mismatched transaction checkpoint.');if(e.id!==getChapter(state).encounters[state.encounterIndex]?.id)fail('encounter identity.');if(!Number.isInteger(e.turn)||e.turn<1||e.turn>30)fail('turn.');if(!Number.isFinite(e.commandsLeft)||e.commandsLeft<0||e.commandsLeft>e.commandCapacity)fail('command budget.');for(const u of e.units)if(!Number.isInteger(u.x)||!Number.isInteger(u.y)||u.x<0||u.y<0||u.x>=e.width||u.y>=e.height||!Number.isFinite(u.hp)||u.hp<0||u.hp>u.maxHp)fail('unit position or health.');validateEncounter(e,fail);if(state.campaignRules===2&&(e.campaignRules!==2||e.difficulty!==state.difficulty||state.snapshot.campaignRules!==2||state.snapshot.difficulty!==state.difficulty))fail('encounter campaign rules.');if(state.campaignRules===undefined&&e.campaignRules!==undefined)fail('legacy encounter campaign rules.');if(allowSnapshot)validateState(state.snapshot,false);else fail('nested transaction.');}
  if(state.phase==='epilogue'&&(!state.completed.includes(12)||!state.milestones.includes('augustus')||!state.milestones.includes('confrontation')))fail('unearned accession.');return state;}
export function serialize(state){validateState(state);return JSON.stringify(state);}
export function deserialize(text){if(typeof text!=='string'||text.length>262144)throw new Error('Save data is missing or exceeds the 256 KB limit.');let state;try{state=JSON.parse(text);}catch{throw new Error('This is not a valid Imperium save.');}validateState(state);if(state.archiveReplay!==undefined)throw new Error('This code holds an Archive replay, not a chronicle. Export the chronicle itself instead.');normalizeCareer(state);if(state.snapshot)normalizeCareer(state.snapshot);const encounter=state.encounter,legacyEncounter=encounter?.kind==='contest'?!encounter.issue:encounter?.kind==='battle'&&!encounter.mission&&!encounter.scenario;if(state.phase==='encounter'&&legacyEncounter){state.encounterOptions={...state.encounterOptions,legacyLayout:true};state.snapshot.encounterOptions={...state.snapshot.encounterOptions,legacyLayout:true};}// Preserve suspended 0.6 encounters and their exact retry rules. New encounters adopt current rules.
for(const [kind,key,hasLayout]of [['battle','combatVersion',Boolean(encounter?.mission)],['contest','politicsVersion',Boolean(encounter?.issue)]])if(state.phase==='encounter'&&encounter.kind===kind&&hasLayout&&encounter[key]!==2){state.encounterOptions={...state.encounterOptions,[key]:1};state.snapshot.encounterOptions={...state.snapshot.encounterOptions,[key]:1};}
delete state.unlocked;delete state.unlocks;return state;}
export function encodeSave(state){const text=serialize(state);if(typeof Buffer!=='undefined')return `SAC1J.${Buffer.from(text,'utf8').toString('base64')}`;const bytes=new TextEncoder().encode(text);return `SAC1J.${btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''))}`;}
export function decodeSave(code){if(typeof code!=='string'||!code.trim().startsWith('SAC1J.'))throw new Error('A save code begins with SAC1J.');const encoded=code.trim().slice(6);try{const text=typeof Buffer!=='undefined'?Buffer.from(encoded,'base64').toString('utf8'):new TextDecoder().decode(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)));return deserialize(text);}catch(error){throw new Error(`Cannot restore save: ${error.message}`);}}









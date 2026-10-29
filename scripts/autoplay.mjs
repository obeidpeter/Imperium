import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {newGame,getChapter,choose,startEncounter,getActions,getTargets,act,endTurn,commitEncounter,advanceChapter,prepare,selectStratagem,negotiate,allocate,judge,swearOath,serialize,chapterRequirements,preview,acceptFallback} from '../src/core/game.js';
import {alive,distance,pathDistance,reachable} from '../src/core/shared.js';
import {damagePreview,planBattleUnit} from '../src/core/battle.js';
import {operationPhaseSpec} from '../src/core/operations.js';
import {shiftedStance,speechStrength} from '../src/core/contest.js';

let activeCommandTrace=null;
export function command(state,unit,action,target,extra={}) {const payload={unitId:unit.id,action,x:target.x,y:target.y,...(target.unitId?{targetId:target.unitId}:{}),...extra},checked=preview(state,payload);if(!checked.ok)throw new Error(`Illegal autoplay preview: ${checked.message}`);const response=act(state,payload);if(!response.ok)throw new Error(`Illegal autoplay command: ${response.message}`);activeCommandTrace?.push({kind:'act',chapter:state.chapter,encounter:state.encounter.id,turn:state.encounter.turn,payload});return payload;}
function issue(state,unit,action,sort,extra={}){if(!getActions(state,unit.id).includes(action))return false;let targets=getTargets(state,unit.id,action);if(sort)targets.sort(sort);if(!targets.length)return false;command(state,unit,action,targets[0],extra);return true;}
const capNeeded=(s,a)=>chapterRequirements(s).some(r=>r.id===a&&!r.done);
function closestTo(goal){return(a,b)=>distance(a,goal)-distance(b,goal);}
function battleTurn(state,style){const e=state.encounter,hero=e.units.find(u=>u.id==='hero'),m=e.mission??{},tactical=style!=='greedy',enemies=()=>e.units.filter(u=>u.side==='enemy'&&alive(u)&&!u.hidden),escorts=e.units.filter(u=>u.side==='neutral'&&u.role==='escort'&&alive(u));
 const move=(goal,limitEscort=false)=>issue(state,hero,'move',(a,b)=>{const danger=p=>enemies().filter(u=>distance(u,p)<=2).length,lag=p=>limitEscort&&escorts.some(u=>u.escorted&&distance(u,e.goal)>1&&distance(u,p)>4)?50:0;return pathDistance(e,a,goal,hero.id)-pathDistance(e,b,goal,hero.id)+lag(a)-lag(b)+(tactical?(danger(a)-danger(b))*(hero.hp<=12?2.5:.12):0);});
 if(capNeeded(state,'deploy'))issue(state,hero,'deploy',closestTo({x:2,y:3}));
 if(tactical&&state.chapter>=4){const objective=['capture','supply','surrender','hold'].includes(m.mode),order=objective?'advance':m.mode==='defection'?'hold':'attack';if(capNeeded(state,'formation'))issue(state,hero,'formation',null,{formation:'line',orderAction:order});if(capNeeded(state,'order'))issue(state,hero,'order',null,{orderAction:order});for(const ally of e.units.filter(u=>u.side==='ally'&&alive(u)&&!u.ordered)){const a=enemies().sort((a,b)=>distance(ally,a)-distance(ally,b))[0];if(ally.ordered)continue;if(!a&&['extract','settlement'].includes(m.mode)){const away=reachable(e,ally).filter(p=>distance(p,e.goal)>distance(ally,e.goal)).sort((a,b)=>distance(b,e.goal)-distance(a,e.goal))[0];if(away){issue(state,hero,'order',(a,b)=>(a.unitId===ally.id?-1:b.unitId===ally.id?1:0),{orderAction:'advance',destination:away});continue;}}const intent=ally.morale<=25?'rally':m.mode==='defection'?(distance(ally,e.goal)>2?'advance':'hold'):!a&&!objective?'hold':order;if(getActions(state,hero.id).includes('order')){const threatened=enemies().some(u=>distance(u,ally)<=3),form=threatened?(ally.hp>ally.maxHp*.7&&objective&&m.mode!=='hold'?'wedge':'shield-wall'):'line';if(state.chapter>=5&&m.mode!=='defection')issue(state,hero,'formation',(a,b)=>(a.unitId===ally.id?-1:b.unitId===ally.id?1:0),{formation:form,orderAction:m.mode==='hold'&&a?'attack':intent});else issue(state,hero,'order',(a,b)=>(a.unitId===ally.id?-1:b.unitId===ally.id?1:0),{orderAction:intent});}}}
 if(capNeeded(state,'scout'))issue(state,hero,'scout');
 if(e.combatVersion===2&&tactical&&m.mode==='clear'){
  const plan=planBattleUnit(e,hero);
  if(!hero.moved&&(plan.x!==hero.x||plan.y!==hero.y))issue(state,hero,'move',(a,b)=>distance(a,plan)-distance(b,plan));
  if(plan.targetId){const target=e.units.find(u=>u.id===plan.targetId);issue(state,hero,plan.action,(a,b)=>(a.unitId===target.id?-1:b.unitId===target.id?1:0));}
 }
 const unescorted=escorts.find(u=>!u.escorted);if(unescorted){if(distance(hero,unescorted)>1)move(unescorted);if(distance(hero,unescorted)<=1)issue(state,hero,'assist',(a,b)=>(a.unitId===unescorted.id?-1:b.unitId===unescorted.id?1:0));}
 const wounded=escorts.find(u=>u.hp<u.maxHp-3&&distance(hero,u)<=1);if(wounded&&tactical)issue(state,hero,'assist',(a,b)=>(a.unitId===wounded.id?-1:b.unitId===wounded.id?1:0));
 let goal=enemies().sort((a,b)=>pathDistance(e,hero,a,hero.id)-pathDistance(e,hero,b,hero.id))[0]??e.goal;
 if(['extract','settlement'].includes(m.mode)&&!unescorted){const lag=escorts.filter(u=>distance(u,e.goal)>1).sort((a,b)=>distance(hero,b)-distance(hero,a))[0],meeting=m.mode==='settlement'&&e.combatVersion===2?{x:e.goal.x-2,y:e.goal.y}:e.goal;goal=lag&&distance(hero,lag)>3?lag:meeting;}
 const threatenedEscort=escorts.find(u=>u.hp<u.maxHp*.7&&enemies().some(v=>distance(v,u)<=3));if(threatenedEscort&&tactical)goal=threatenedEscort;
 // A convoy (release 7's missions) walks on its own: clear the enemy nearest it, else meet it at the marker.
 const convoy=operationPhaseSpec(e)?.convoy&&m.mode==='extract'?escorts.find(u=>u.escorted):null;
 if(convoy&&tactical)goal=enemies().filter(v=>distance(v,convoy)<=3).sort((a,b)=>distance(a,convoy)-distance(b,convoy)||pathDistance(e,hero,a,hero.id)-pathDistance(e,hero,b,hero.id))[0]??e.goal;
 if(m.mode==='clear'&&state.chapter>=6&&tactical){const screen=e.units.filter(u=>u.side==='ally'&&alive(u)).sort((a,b)=>a.x-b.x)[0];if(screen&&enemies().some(u=>distance(u,hero)<=4))goal=screen;}
 if(m.mode==='recover')goal=e.goal;
 if(['capture','supply','surrender'].includes(m.mode)){const point=m.points?.filter(p=>!p.secured).sort((a,b)=>pathDistance(e,hero,a,hero.id)-pathDistance(e,hero,b,hero.id))[0];goal=point??e.goal;}
 if(m.mode==='hold')goal=tactical&&e.units.some(u=>u.side==='ally'&&alive(u)&&distance(u,e.goal)<=1)?{x:0,y:3}:e.goal;
 // Enhanced enemies contest the marker as a group. Clear its visible blocker
 // before sheltering; otherwise the policy can brace forever one tile short.
 if(e.featureEdition===31&&state.chapter<4&&m.mode==='hold')goal=enemies().filter(u=>distance(u,e.goal)<=1).sort((a,b)=>distance(hero,a)-distance(hero,b))[0]??goal;
 if(m.mode==='defection'){goal=enemies().sort((a,b)=>distance(hero,a)-distance(hero,b))[0]??e.goal;if(goal&&distance(hero,goal)>3)move(goal);issue(state,hero,'rally');}
 if(e.type==='training'){
   if(capNeeded(state,'move'))issue(state,hero,'move',closestTo({x:1,y:3}));
   if(capNeeded(state,'brace')&&e.turn>=3)issue(state,hero,'brace');
   if(capNeeded(state,'throw'))issue(state,hero,'throw');
   if(capNeeded(state,'strike')&&distance(hero,goal)>1)move(goal);
 }
 const travelling=['extract','recover','capture','supply','surrender','settlement','hold'].includes(m.mode);
 if(!unescorted&&m.mode!=='defection'&&getActions(state,hero.id).includes('move')&&distance(hero,goal)>(m.mode==='settlement'&&e.combatVersion===2?0:1)&&(travelling||!getTargets(state,hero.id,'strike').length||!tactical))move(goal,['extract','settlement'].includes(m.mode)&&!convoy);
 if(threatenedEscort&&distance(hero,threatenedEscort)<=1)issue(state,hero,'assist',(a,b)=>(a.unitId===threatenedEscort.id?-1:b.unitId===threatenedEscort.id?1:0));
 if(capNeeded(state,'assist'))issue(state,hero,'assist');
 if(e.featureEdition===31){const finish=getTargets(state,hero.id,'strike').find(p=>{const target=e.units.find(u=>u.id===p.unitId);return target&&damagePreview(e,hero,target)>=target.hp;});if(finish)command(state,hero,'strike',finish);}
 if(tactical&&hero.hp<=8&&enemies().some(u=>distance(u,hero)<=2))issue(state,hero,'brace');
 if(capNeeded(state,'rally')||m.mode==='settlement'||tactical&&(hero.hp<=hero.maxHp-5||e.units.some(u=>u.side==='ally'&&alive(u)&&u.morale<=40&&distance(hero,u)<=3)))issue(state,hero,'rally');
 if(m.mode!=='defection'){
  if(tactical&&hero.hp<=8&&enemies().some(u=>distance(hero,u)<=2))issue(state,hero,'brace');
  if(getTargets(state,hero.id,'strike').length)issue(state,hero,'strike',(a,b)=>e.units.find(u=>u.id===a.unitId).hp-e.units.find(u=>u.id===b.unitId).hp);
  else if(getTargets(state,hero.id,'throw').length)issue(state,hero,'throw');
  else if(tactical&&state.chapter>=6)issue(state,hero,'rally');else issue(state,hero,'brace');
 }
 if(!tactical){for(const ability of ['scout','assist','rally'])if(capNeeded(state,ability))issue(state,hero,ability);if(capNeeded(state,'order'))issue(state,hero,'order');if(capNeeded(state,'formation'))issue(state,hero,'formation');}
}
function contestActionScore(state,unit,action,target,approach){const e=state.encounter,member=e.units.find(u=>u.id===target.unitId),needed=capNeeded(state,action)?18:0;
  if(action==='address'){const members=e.units.filter(u=>u.role==='voter'&&distance(unit,u)<=3);return needed+members.reduce((sum,m)=>sum+(m.stance<1?5:m.stance<3?2:m.stance<6?.6:0),0)+(approach==='record'?4:0);}
  if(action==='denounce')return needed+(member.resolve>0?member.resolve<=4?13:7:0)+(approach==='record'?3:0);
  if(action==='rebut')return needed+(member.side==='enemy'?(member.blunted?-5:2):Math.min(4,member.maxResolve-member.resolve)*2.1+(member.resolve<=6?14:0));
  if(!member||member.role!=='voter')return -100;
  const delta=speechStrength(state,action,member),next=shiftedStance(member,delta),gain=next-member.stance;
  if(gain<=0&&!needed)return -100; // Do not repeat a record to an already committed delegate.
  return needed+(member.stance<1&&next>=1?9:0)+gain*(member.stance<3?1:.4)+(action==='promise'?(approach==='coalition'?3:-2):0)+(action==='threaten'?-5:0)+(action==='record'&&approach==='record'?2:0);
}
function contestTurn(state,approach){const e=state.encounter;
  for(const unit of e.units.filter(u=>['player','ally'].includes(u.side)&&alive(u))){
    const candidates=(atState=state)=>{const atUnit=atState.encounter.units.find(u=>u.id===unit.id);return getActions(atState,unit.id).filter(a=>a!=='move').filter(a=>capNeeded(state,a)||(approach==='coalition'?!['address','record','denounce'].includes(a):!['promise','threaten'].includes(a))).flatMap(action=>getTargets(atState,unit.id,action).map(target=>({action,target,score:contestActionScore(atState,atUnit,action,target,approach)}))).sort((a,b)=>b.score-a.score);};
    let best=candidates()[0];
    if(getActions(state,unit.id).includes('move')){const original={x:unit.x,y:unit.y},positions=getTargets(state,unit.id,'move');let bestPosition=null,bestPositionScore=best?.score??-100;
      // Policy analysis uses copies. The live campaign changes only through legal gameplay commands.
      for(const point of positions){const hypothetical={...state,encounter:{...e,units:e.units.map(u=>u.id===unit.id?{...u,x:point.x,y:point.y}:u)}};const option=candidates(hypothetical)[0];const score=(option?.score??-100)-distance(point,original)*.02;if(score>bestPositionScore+.25){bestPositionScore=score;bestPosition=point;}}
      if(bestPosition)command(state,unit,'move',bestPosition);best=candidates()[0];}
    if(best)command(state,unit,best.action,best.target);
  }
}
export function playEncounter(state,{style='tactical',approach='record',trace=[],beforeTurn=null}={}){const limit=35,previousTrace=activeCommandTrace;activeCommandTrace=trace;for(let i=0;i<limit&&state.encounter.status==='active';i++){const before=state.encounter.log.length;if(beforeTurn)beforeTurn(state);if(state.encounter.kind==='contest')contestTurn(state,approach);else battleTurn(state,style);const turn=state.encounter.turn;if(state.encounter.status==='active'){const ended=endTurn(state);if(!ended.ok)throw new Error(ended.message);trace.push({kind:'endTurn',chapter:state.chapter,encounter:state.encounter.id,turn,status:state.encounter.status,events:state.encounter.turnEvents??state.encounter.log.slice(before)});}}activeCommandTrace=previousTrace;const e=state.encounter;return {id:e.id,chapter:state.chapter,kind:e.kind,status:e.status,turns:e.turn,losses:e.units.filter(u=>u.side==='ally'&&!alive(u)).length,heroHealth:e.units.find(u=>u.id==='hero').hp,used:[...e.usedAbilities]};}
export async function runCampaign({seed=275,choices={},style='tactical',approach='record',fixtures=false,route='backer',negotiation='safe-passage',difficulty='standard',allowFallback=false}={}){const state=newGame('Aurelius Marcellus',seed,{difficulty}),encounters=[],attempts=[],trace=[],checkpoints={};let guard=0;while(state.phase!=='epilogue'&&guard++<100){const chapter=getChapter(state);if(state.phase==='camp'){
    if(fixtures&&[1,6,11,12].includes(state.chapter)&&state.encounterIndex===0&&!checkpoints[state.chapter])checkpoints[state.chapter]=serialize(state);
    if(!state.decisions[chapter.decision.id]){const option=choices[chapter.decision.id]??chapter.decision.options[0].id;const r=choose(state,option);if(!r.ok)throw new Error(r.message);trace.push({kind:'choose',chapter:state.chapter,option});}
    if(state.chapter===1&&state.encounterIndex>0&&!state.oath){swearOath(state);trace.push({kind:'swearOath',chapter:state.chapter});}
    if(state.chapter===7&&!state.preparation){prepare(state,'drill');trace.push({kind:'prepare',chapter:7,value:'drill'});}if(state.chapter===8&&!state.negotiation){negotiate(state,negotiation);trace.push({kind:'negotiate',chapter:8,value:negotiation});}if(state.chapter===9&&!state.stratagem){selectStratagem(state,'flank');trace.push({kind:'selectStratagem',chapter:9,value:'flank'});}if(state.chapter===10){if(!state.allocation){allocate(state,{river:2,farms:2,town:2});trace.push({kind:'allocate',chapter:10,value:{river:2,farms:2,town:2}});}if(!state.judgment){judge(state,state.decisions.ch10);trace.push({kind:'judge',chapter:10,value:state.decisions.ch10});}}
    const r=startEncounter(state,{...(state.chapter===12?{route}:{})});if(!r.ok)throw new Error(`Chapter ${state.chapter} start: ${r.message}`);trace.push({kind:'startEncounter',chapter:state.chapter,encounter:state.encounter.id,options:state.chapter===12?{route}:{}});
  }else if(state.phase==='encounter'){const summary=playEncounter(state,{style,approach,trace});if(summary.status!=='won'&&allowFallback&&state.encounter.kind==='contest'&&!state.encounter.fallback){attempts.push(summary);const backed=acceptFallback(state);if(!backed.ok)throw new Error(backed.message);trace.push({kind:'acceptFallback',chapter:state.chapter,encounter:state.encounter.id});continue;}encounters.push(summary);if(summary.status!=='won')throw new Error(`Autoplay failed: ${JSON.stringify(summary)}\n${state.encounter.log.slice(-12).join('\n')}`);const r=commitEncounter(state);if(!r.ok)throw new Error(r.message);trace.push({kind:'commitEncounter',chapter:state.chapter,encounter:summary.id});
  }else if(state.phase==='promotion'){const priorChapter=state.chapter,r=advanceChapter(state);if(!r.ok)throw new Error(`Chapter ${state.chapter}: ${r.message}`);trace.push({kind:'advanceChapter',chapter:priorChapter});}}
  if(state.phase!=='epilogue')throw new Error('Autoplay did not reach accession.');if(fixtures){const folder=new URL('../tests/fixtures/',import.meta.url);await mkdir(folder,{recursive:true});for(const[ch,json]of Object.entries(checkpoints))await writeFile(new URL(`chapter-${ch}-legal-checkpoint.json`,folder),json);await writeFile(new URL('legal-route-trace.json',folder),JSON.stringify(trace,null,2));await writeFile(new URL('ui-route-commands.json',folder),JSON.stringify(trace.filter(item=>[1,6,11,12].includes(item.chapter)),null,2));await writeFile(new URL('autoplay-result.json',folder),JSON.stringify({source:'New Game; only legal gameplay commands; no debug injection',seed,rank:state.rank,completed:state.completed,totalTurns:encounters.reduce((n,e)=>n+e.turns,0),encounters},null,2));}
  return {state,encounters,attempts,trace,checkpoints};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const result=await runCampaign({fixtures:process.argv.includes('--fixtures')});console.log(JSON.stringify({source:'New Game; legal gameplay API commands only',seed:result.state.seed,rank:result.state.rank,completed:result.state.completed,encounters:result.encounters,totalTurns:result.encounters.reduce((n,e)=>n+e.turns,0)},null,2));}



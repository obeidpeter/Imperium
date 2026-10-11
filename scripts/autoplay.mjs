import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {newGame,getChapter,choose,startEncounter,getActions,getTargets,act,endTurn,commitEncounter,advanceChapter,prepare,selectStratagem,negotiate,allocate,judge,swearOath,serialize,chapterRequirements,preview} from '../src/core/game.js';
import {alive,distance,pathDistance} from '../src/core/shared.js';
import {damagePreview} from '../src/core/battle.js';
import {shiftedStance} from '../src/core/contest.js';

let activeCommandTrace=null;
export function command(state,unit,action,target,extra={}) {const payload={unitId:unit.id,action,x:target.x,y:target.y,...(target.unitId?{targetId:target.unitId}:{}),...extra},checked=preview(state,payload);if(!checked.ok)throw new Error(`Illegal autoplay preview: ${checked.message}`);const response=act(state,payload);if(!response.ok)throw new Error(`Illegal autoplay command: ${response.message}`);activeCommandTrace?.push({kind:'act',chapter:state.chapter,encounter:state.encounter.id,turn:state.encounter.turn,payload});return payload;}
function issue(state,unit,action,sort,extra={}){if(!getActions(state,unit.id).includes(action))return false;let targets=getTargets(state,unit.id,action);if(sort)targets.sort(sort);if(!targets.length)return false;command(state,unit,action,targets[0],extra);return true;}
const capNeeded=(s,a)=>chapterRequirements(s).some(r=>r.id===a&&!r.done);
function closestTo(goal){return(a,b)=>distance(a,goal)-distance(b,goal);}
function battleTurn(state,style){const e=state.encounter,hero=e.units.find(u=>u.id==='hero'),tactical=style!=='greedy',enemies=()=>e.units.filter(u=>u.side==='enemy'&&alive(u)&&!u.hidden),escort=e.units.find(u=>u.role==='escort');
  if(capNeeded(state,'deploy'))issue(state,hero,'deploy',closestTo({x:2,y:3}));
  if(tactical&&state.chapter>=4){if(capNeeded(state,'formation'))issue(state,hero,'formation',null,{formation:'shield-wall',orderAction:'attack'});if(capNeeded(state,'order'))issue(state,hero,'order',null,{orderAction:'attack'});for(const ally of e.units.filter(u=>u.side==='ally'&&alive(u)))if(getActions(state,hero.id).includes('order'))issue(state,hero,'order',(a,b)=>(a.unitId===ally.id?-1:b.unitId===ally.id?1:0),{orderAction:'attack'});}
  if(capNeeded(state,'scout'))issue(state,hero,'scout');
  if((capNeeded(state,'rally')||e.type==='standoff'||hero.hp<hero.maxHp-3)&&tactical)issue(state,hero,'rally');
  let goal=enemies().sort((a,b)=>distance(hero,a)-distance(hero,b))[0]??e.goal;
  if(escort&&!escort.escorted)goal=escort;
  else if(['rescue','recover','retreat','escort'].includes(e.type))goal=e.goal;
  else if(['defend','siege','standoff'].includes(e.type)&&tactical)goal={x:1,y:2};
  if(e.type==='training'&&capNeeded(state,'move'))issue(state,hero,'move',closestTo({x:1,y:3}));
  if(escort&&!escort.escorted){if(distance(hero,escort)>1)issue(state,hero,'move',closestTo(escort));issue(state,hero,'assist',(a,b)=>(a.unitId==='escort'?-1:b.unitId==='escort'?1:0));}
  if(capNeeded(state,'brace')&&e.type==='training'&&e.turn>=3)issue(state,hero,'brace');
  if(capNeeded(state,'throw')&&e.type==='training')issue(state,hero,'throw');
  if(capNeeded(state,'strike')&&e.type==='training'&&distance(hero,goal)>1)issue(state,hero,'move',closestTo(goal));
  if(getActions(state,hero.id).includes('move')){
    const objectiveMove=['rescue','recover','retreat','escort'].includes(e.type)||(!getTargets(state,hero.id,'strike').length&&!getTargets(state,hero.id,'throw').length);
    if((objectiveMove||!tactical)&&distance(hero,goal)>1)issue(state,hero,'move',(a,b)=>{const danger=p=>enemies().filter(u=>distance(u,p)<=2).length;return (tactical?pathDistance(e,a,goal,hero.id)-pathDistance(e,b,goal,hero.id):distance(a,goal)-distance(b,goal))+(tactical?(danger(a)-danger(b))*.2:0);});
  }
  if(capNeeded(state,'assist'))issue(state,hero,'assist');
  const strikeTargets=getTargets(state,hero.id,'strike');
  if(strikeTargets.length)issue(state,hero,'strike',(a,b)=>e.units.find(u=>u.id===a.unitId).hp-e.units.find(u=>u.id===b.unitId).hp);
  else if(getTargets(state,hero.id,'throw').length)issue(state,hero,'throw');
  else if(tactical&&state.chapter>=6)issue(state,hero,'rally');
  else issue(state,hero,'brace');
  // Greedy understands requirements but ignores defensive positioning and command coordination.
  if(!tactical){for(const ability of ['scout','assist','rally'])if(capNeeded(state,ability))issue(state,hero,ability);if(capNeeded(state,'order'))issue(state,hero,'order');if(capNeeded(state,'formation'))issue(state,hero,'formation');}
}
function contestActionScore(state,unit,action,target,approach){const e=state.encounter,member=e.units.find(u=>u.id===target.unitId),needed=capNeeded(state,action)?18:0;
  if(action==='address'){const members=e.units.filter(u=>u.role==='voter'&&distance(unit,u)<=3);return needed+members.reduce((sum,m)=>sum+(m.stance<1?5:m.stance<3?2:m.stance<6?.6:0),0)+(approach==='record'?4:0);}
  if(action==='denounce')return needed+(member.resolve>0?member.resolve<=4?13:7:0)+(approach==='record'?3:0);
  if(action==='rebut')return needed+(member.side==='enemy'?(member.blunted?-5:2):Math.min(4,member.maxResolve-member.resolve)*2.1+(member.resolve<=6?14:0));
  if(!member||member.role!=='voter')return -100;
  const delta=action==='record'?Math.min(5,2+Math.floor(state.completed.filter(c=>c<=9).length/3)):action==='promise'?5:action==='threaten'?4:2,next=shiftedStance(member,delta),gain=next-member.stance;
  return needed+(member.stance<1&&next>=1?9:0)+gain*(member.stance<3?1:.4)+(action==='promise'?(approach==='coalition'?3:-2):0)+(action==='threaten'?-5:0)+(action==='record'&&approach==='record'?2:0);
}
function contestTurn(state,approach){const e=state.encounter;
  for(const unit of e.units.filter(u=>['player','ally'].includes(u.side)&&alive(u))){
    const candidates=(atState=state)=>{const atUnit=atState.encounter.units.find(u=>u.id===unit.id);return getActions(atState,unit.id).filter(a=>a!=='move').filter(a=>state.chapter<10||capNeeded(state,a)||(approach==='coalition'?!['address','record','denounce'].includes(a):!['promise','threaten'].includes(a))).flatMap(action=>getTargets(atState,unit.id,action).map(target=>({action,target,score:contestActionScore(atState,atUnit,action,target,approach)}))).sort((a,b)=>b.score-a.score);};
    let best=candidates()[0];
    if(getActions(state,unit.id).includes('move')){const original={x:unit.x,y:unit.y},positions=getTargets(state,unit.id,'move');let bestPosition=null,bestPositionScore=best?.score??-100;
      // Policy analysis uses copies. The live campaign changes only through legal gameplay commands.
      for(const point of positions){const hypothetical={...state,encounter:{...e,units:e.units.map(u=>u.id===unit.id?{...u,x:point.x,y:point.y}:u)}};const option=candidates(hypothetical)[0];const score=(option?.score??-100)-distance(point,original)*.02;if(score>bestPositionScore+.25){bestPositionScore=score;bestPosition=point;}}
      if(bestPosition)command(state,unit,'move',bestPosition);best=candidates()[0];}
    if(best)command(state,unit,best.action,best.target);
  }
}
export function playEncounter(state,{style='tactical',approach='record',trace=[]}={}){const limit=35,previousTrace=activeCommandTrace;activeCommandTrace=trace;for(let i=0;i<limit&&state.encounter.status==='active';i++){const before=state.encounter.log.length;if(state.encounter.kind==='contest')contestTurn(state,approach);else battleTurn(state,style);const turn=state.encounter.turn;endTurn(state);trace.push({kind:'endTurn',chapter:state.chapter,encounter:state.encounter.id,turn,status:state.encounter.status,events:state.encounter.log.slice(before)});}activeCommandTrace=previousTrace;const e=state.encounter;return {id:e.id,chapter:state.chapter,kind:e.kind,status:e.status,turns:e.turn,losses:e.units.filter(u=>u.side==='ally'&&!alive(u)).length,heroHealth:e.units.find(u=>u.id==='hero').hp,used:[...e.usedAbilities]};}
export async function runCampaign({seed=275,choices={},style='tactical',approach='record',fixtures=false,route='backer'}={}){const state=newGame('Aurelius Marcellus',seed),encounters=[],trace=[],checkpoints={};let guard=0;while(state.phase!=='epilogue'&&guard++<100){const chapter=getChapter(state);if(state.phase==='camp'){
    if(fixtures&&[1,6,11,12].includes(state.chapter)&&state.encounterIndex===0&&!checkpoints[state.chapter])checkpoints[state.chapter]=serialize(state);
    if(!state.decisions[chapter.decision.id]){const option=choices[chapter.decision.id]??chapter.decision.options[0].id;const r=choose(state,option);if(!r.ok)throw new Error(r.message);trace.push({kind:'choose',chapter:state.chapter,option});}
    if(state.chapter===1&&state.encounterIndex>0&&!state.oath){swearOath(state);trace.push({kind:'swearOath',chapter:state.chapter});}
    if(state.chapter===7&&!state.preparation){prepare(state,'drill');trace.push({kind:'prepare',chapter:7,value:'drill'});}if(state.chapter===8&&!state.negotiation){negotiate(state,'safe-passage');trace.push({kind:'negotiate',chapter:8,value:'safe-passage'});}if(state.chapter===9&&!state.stratagem){selectStratagem(state,'flank');trace.push({kind:'selectStratagem',chapter:9,value:'flank'});}if(state.chapter===10){if(!state.allocation){allocate(state,{river:2,farms:2,town:2});trace.push({kind:'allocate',chapter:10,value:{river:2,farms:2,town:2}});}if(!state.judgment){judge(state,state.decisions.ch10);trace.push({kind:'judge',chapter:10,value:state.decisions.ch10});}}
    const r=startEncounter(state,{...(state.chapter===12?{route}:{})});if(!r.ok)throw new Error(`Chapter ${state.chapter} start: ${r.message}`);trace.push({kind:'startEncounter',chapter:state.chapter,encounter:state.encounter.id,options:state.chapter===12?{route}:{}});
  }else if(state.phase==='encounter'){const summary=playEncounter(state,{style,approach,trace});encounters.push(summary);if(summary.status!=='won')throw new Error(`Autoplay failed: ${JSON.stringify(summary)}\n${state.encounter.log.slice(-12).join('\n')}`);const r=commitEncounter(state);if(!r.ok)throw new Error(r.message);trace.push({kind:'commitEncounter',chapter:state.chapter,encounter:summary.id});
  }else if(state.phase==='promotion'){const priorChapter=state.chapter,r=advanceChapter(state);if(!r.ok)throw new Error(`Chapter ${state.chapter}: ${r.message}`);trace.push({kind:'advanceChapter',chapter:priorChapter});}}
  if(state.phase!=='epilogue')throw new Error('Autoplay did not reach accession.');if(fixtures){const folder=new URL('../tests/fixtures/',import.meta.url);await mkdir(folder,{recursive:true});for(const[ch,json]of Object.entries(checkpoints))await writeFile(new URL(`chapter-${ch}-legal-checkpoint.json`,folder),json);await writeFile(new URL('legal-route-trace.json',folder),JSON.stringify(trace,null,2));await writeFile(new URL('ui-route-commands.json',folder),JSON.stringify(trace.filter(item=>[1,6,11,12].includes(item.chapter)),null,2));await writeFile(new URL('autoplay-result.json',folder),JSON.stringify({source:'New Game; only legal gameplay commands; no debug injection',seed,rank:state.rank,completed:state.completed,totalTurns:encounters.reduce((n,e)=>n+e.turns,0),encounters},null,2));}
  return {state,encounters,trace,checkpoints};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const result=await runCampaign({fixtures:process.argv.includes('--fixtures')});console.log(JSON.stringify({source:'New Game; legal gameplay API commands only',seed:result.state.seed,rank:result.state.rank,completed:result.state.completed,encounters:result.encounters,totalTurns:result.encounters.reduce((n,e)=>n+e.turns,0)},null,2));}


import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import * as G from '../src/core/game.js';
import {playEncounter,command} from './autoplay.mjs';
import {distance} from '../src/core/shared.js';
const hash=s=>createHash('sha256').update(G.serialize(s)).digest('hex');

// This policy begins at New Game and uses the same public commands as the UI.
// It neither grants wins nor injects progression, skills, supplies or positions.
export function runProgressionCampaign({alternate=false,difficulty='standard',seed=275,settlement='honour',featureEdition,beforeExpandedTurn=null,onCheckpoint=null,beforeCamp=null,onEncounter=null}={}){
  const state=G.newGame('Progression witness',seed,{difficulty,progression:true,featureEdition}),encounters=[],checks=[],choices=[],skills=[],agreements=[],specialistActions=new Set();
  const call=(name,...args)=>{const r=G[name](state,...args);if(!r.ok)throw new Error(`${name}: ${r.message}`);G.deserialize(G.serialize(state));return r;};
  let guard=0;
  while(state.phase!=='epilogue'&&guard++<100){
    if(state.phase==='camp'){
      beforeCamp?.(state);
      const ch=G.getChapter(state);
      if(!state.decisions[ch.decision.id])call('choose',ch.decision.options[0].id);
      if(state.chapter===1&&state.encounterIndex>0&&!state.oath)call('swearOath');
      if(state.chapter===7&&!state.preparation)call('prepare','drill');
      if(state.chapter===8&&!state.negotiation)call('negotiate','safe-passage');
      if(state.chapter===9&&!state.stratagem)call('selectStratagem','flank');
      if(state.chapter===10){if(!state.allocation)call('allocate',{river:2,farms:2,town:2});if(!state.judgment)call('judge',state.decisions.ch10);}
      for(const a of G.coalition(state).agreements.filter(a=>a.dueNow))call('settleAgreement',a.id,settlement==='honour'&&a.canHonour);
      for(const v of G.veteranTraining(state).veterans.filter(v=>v.eligible)){
        const path=({lucan:'protector',sabinus:'protector',naso:'leader',felix:'ranged',firmus:'protector',rufus:'leader'})[v.id];call('specializeVeteran',v.id,path);skills.push({chapter:state.chapter,id:v.id,path,service:v.service});
      }
      const plan=G.operationChoices(state);if(plan.enabled){const option=plan.choices[alternate?1:0];call('chooseOperation',option.id);choices.push({encounter:plan.encounterId,id:option.id});}
      onCheckpoint?.(state);
      call('startEncounter',state.chapter===12?{route:'backer'}:{});
      onEncounter?.(state);
      const started=hash(state);call('retry');if(hash(state)!==started)throw new Error(`Retry mismatch ${state.encounter.id}`);checks.push({id:state.encounter.id,exactRetry:true});
    }else if(state.phase==='promotion')call('advanceChapter');
    else{
      const beforeTurn=s=>{
        beforeExpandedTurn?.(s);
        const e=s.encounter;
        if(e.kind==='contest'){
          const hero=e.units.find(u=>u.id==='hero');
          const target=e.units.filter(u=>u.role==='voter').find(u=>G.agreementOptions(s,u.id).enabled);
          if(target&&(e.staged.agreements.length<1)){
            const terms=alternate?'counteroffer':'demand',before=hash(s),preview=G.previewAgreement(s,target.id,terms);if(!preview.ok||hash(s)!==before)throw new Error('Agreement preview mutation');
            call('negotiateAgreement',target.id,terms);agreements.push({encounter:e.id,personId:target.negotiatorId,terms});
          }else if(e.turn===1&&!hero.moved&&!hero.acted){
            const eligible=e.units.filter(u=>u.role==='voter'&&!s.progression.agreements.some(a=>a.personId===u.negotiatorId&&a.status==='open'));
            const move=G.getTargets(s,'hero','move').filter(p=>eligible.some(u=>distance(p,u)<=2)).sort((a,b)=>a.cost-b.cost)[0];
            if(move)command(s,hero,'move',move);
            const member=eligible.find(u=>G.agreementOptions(s,u.id).enabled);if(member){call('negotiateAgreement',member.id,alternate?'counteroffer':'demand');agreements.push({encounter:e.id,personId:member.negotiatorId,terms:alternate?'counteroffer':'demand'});}
          }
        }else if(e.turn===1||e.turn===2){
          // Demonstrate each specialization when legally available, then let the
          // ordinary tactical policy retain scarce commands for the objective.
          for(const u of e.units.filter(u=>u.side==='ally'))for(const action of G.getActions(s,u.id).filter(a=>['guard','inspire','volley'].includes(a))){if(specialistActions.has(action))continue;const t=G.getTargets(s,u.id,action)[0];if(t){const payload={unitId:u.id,action,x:t.x,y:t.y,targetId:t.unitId},before=hash(s);if(!G.preview(s,payload).ok||hash(s)!==before)throw new Error('Specialist preview mutation');command(s,u,action,t);specialistActions.add(action);}}
        }
      };
      const result=playEncounter(state,{beforeTurn});G.deserialize(G.serialize(state));
      if(result.status!=='won')throw new Error(`${result.id}: ${result.status} turn ${result.turns}\n${state.encounter.log.slice(-14).join('\n')}`);
      encounters.push(result);call('commitEncounter');
    }
  }
  if(state.rank!=='Augustus')throw new Error('The legal progression route did not reach accession.');
  return {source:'New Game with progression:true; public legal commands only; no debug state injection',seed,difficulty,alternate,settlement,rank:state.rank,encounters,turns:encounters.reduce((n,e)=>n+e.turns,0),checks,choices,skills,agreements,specialistActions:[...specialistActions],operationResults:state.progression.operationResults,coalition:G.coalition(state),state};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const r=runProgressionCampaign({alternate:process.argv.includes('--alternate'),settlement:process.argv.includes('--break')?'break':'honour'});delete r.state;console.log(JSON.stringify(r,null,2));}

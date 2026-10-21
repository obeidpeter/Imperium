import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
import * as G from '../src/core/game.js';
import {runProgressionCampaign} from './progression-autoplay.mjs';
import {alive,distance,pathDistance} from '../src/core/shared.js';
import {contestIntents,votes} from '../src/core/contest.js';

// Analyze public forecasts on copies. The selected movement and speech still
// go through the same API as a player; no simulated state is installed.
const missingAbilities=s=>new Set([...G.chapterRequirements(s).filter(r=>!r.done).map(r=>r.id),...[s.encounter.requiredAbility,...(s.encounter.requiredAbilities??[])].filter(id=>id&&!s.encounter.usedAbilities.includes(id))]);
function speechCandidates(s,speaker){
  const e=s.encounter;
    const needed=missingAbilities(s);
    const positions=[{x:speaker.x,y:speaker.y,cost:0},...G.getTargets(s,speaker.id,'move')],candidates=[];
    for(const p of positions){
      const hypothetical={...s,encounter:{...e,units:e.units.map(u=>u.id===speaker.id?{...u,x:p.x,y:p.y}:u)}};
      for(const action of G.getActions(hypothetical,speaker.id).filter(a=>a!=='move'&&a!=='threaten')){
        for(const t of G.getTargets(hypothetical,speaker.id,action)){
          const cmd={unitId:speaker.id,action,x:t.x,y:t.y,targetId:t.unitId},preview=G.preview(hypothetical,cmd),f=preview.forecast;
          if(!preview.ok||!f)continue;
          const after={...hypothetical,encounter:{...hypothetical.encounter,units:hypothetical.encounter.units.map(u=>({...u}))}};
          for(const c of f.stanceChanges)after.encounter.units.find(u=>u.id===c.id).stance=c.to;
          for(const c of f.resolveChanges){const u=after.encounter.units.find(u=>u.id===c.id);u.resolve=c.to;u.hp=c.to;}
          for(const id of f.bluntedIds)after.encounter.units.find(u=>u.id===id).blunted=true;
          if(action==='promise')after.encounter.promises=[...e.promises,t.unitId];
          if(action==='record')after.encounter.recordUses=[...e.recordUses,t.unitId];
          const acted=after.encounter.units.find(u=>u.id===speaker.id);acted.acted=true;if(distance(speaker,p)>0)acted.moved=true;
          after.chapterCapabilities={...s.chapterCapabilities,[s.chapter]:[...new Set([...(s.chapterCapabilities[s.chapter]??[]),action])]};
          after.encounter.usedAbilities=[...new Set([...e.usedAbilities,action])];
          const progress=f.stanceChanges.reduce((n,c)=>n+(Math.min(4,c.to)-Math.min(4,c.from)),0);
          const resolve=f.resolveChanges.reduce((n,c)=>n+(e.units.find(u=>u.id===c.id).side==='enemy'?c.from-c.to:c.to-c.from),0);
          const score=votes(after.encounter).for*20+progress*1.5+resolve*.8+(needed.has(action)?30:0)-(p.cost??0)*.01;
          candidates.push({p,cmd,after,score});
        }
      }
    }
  candidates.sort((a,b)=>b.score-a.score);
  // Retain distinct arguments, not sixteen nearly identical positions.
  const seen=new Set();return candidates.filter(c=>{const key=`${c.cmd.action}:${c.cmd.targetId}`;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,10);
}
export function protectCoalition(s,call){
  const speakers=s.encounter.units.filter(u=>['player','ally'].includes(u.side)&&alive(u)&&!u.acted);
  if(!speakers.length)return;
  const needed=missingAbilities(s);
  let best=null;
  for(const first of speechCandidates(s,speakers[0])){
    const secondSpeaker=first.after.encounter.units.find(u=>u.id===speakers[1]?.id);
    const seconds=secondSpeaker?speechCandidates(first.after,secondSpeaker):[null];
    for(const second of seconds){
      const pair=second?[first,second]:[first],source=second?.after??first.after,after={...source,encounter:{...source.encounter,units:source.encounter.units.map(u=>({...u}))}};
      for(const reply of contestIntents(after)){
        const u=after.encounter.units.find(u=>u.id===reply.targetId);
        if(reply.action==='lobby')u.stance=reply.stanceAfter;
        if(reply.action==='pressure'){u.resolve=reply.resolveAfter;u.hp=reply.resolveAfter;}
      }
      const backing=after.encounter.units.filter(u=>u.role==='voter').reduce((n,u)=>n+(u.stance>=1?Math.min(5,u.stance):u.stance*.2),0);
      const survival=after.encounter.units.filter(u=>u.role==='speaker'&&['player','ally'].includes(u.side)).reduce((n,u)=>n+u.resolve,0);
      const withdrawals=after.encounter.units.filter(u=>u.role==='speaker'&&['player','ally'].includes(u.side)&&!alive(u)).length;
      const opposition=after.encounter.units.filter(u=>u.role==='speaker'&&u.side==='enemy').reduce((n,u)=>n+u.resolve+(alive(u)?8:0),0);
      const demonstrated=new Set(pair.filter(c=>needed.has(c.cmd.action)).map(c=>c.cmd.action));
      const score=votes(after.encounter).for*80+backing*2+survival*2-withdrawals*160-opposition*2+demonstrated.size*45+pair.reduce((n,c)=>n+c.score*.03,0);
      if(!best||score>best.score)best={pair,score};
    }
  }
  for(const candidate of best?.pair??[]){
    const speaker=s.encounter.units.find(u=>u.id===candidate.cmd.unitId);
    if(distance(speaker,candidate.p)>0)call(s,'act',{unitId:speaker.id,action:'move',x:candidate.p.x,y:candidate.p.y});
    call(s,'act',candidate.cmd);
  }
}

// New Game and public commands throughout. The low-supply profile purchases
// real deployment packages; it does not inject an empty treasury or a victory.
export function runCommandCampaign({alternate=false,difficulty='standard',seed=275,lowSupply=false,caseVariant=0,featureEdition=34,onCheckpoint=null,onEncounter=null,beforeCamp=null}={}){
  const plans=[],cases=[],opportunities=[];
  let minimumSupplies=99;
  const call=(s,name,...args)=>{const r=G[name](s,...args);assert.ok(r.ok,`${name}: ${r.message}`);G.deserialize(G.serialize(s));return r;};
  const r=runProgressionCampaign({
    featureEdition,alternate,difficulty,seed,beforeCamp,
    onCheckpoint(s){
      const company=G.companyPlan(s);
      if(lowSupply&&company.enabled){
        const pack=company.packages.find(p=>p.id==='support'&&p.available)??company.packages.find(p=>p.id==='rearm'&&p.available);
        if(pack)call(s,'prepareCompany',pack.id);
      }
      const options=G.operationalPlan(s);
      if(options.enabled){
        const desired=s.chapter===5?'engineers':alternate?'recon':s.chapter>=6?'reserve':'balanced';
        const chosen=options.options.find(p=>p.id===desired&&p.available)??options.options.find(p=>p.id==='balanced');
        call(s,'chooseOperationalPlan',chosen.id);
        plans.push({encounter:options.encounterId,id:chosen.id,cost:chosen.cost});
      }
      minimumSupplies=Math.min(minimumSupplies,s.supplies);
      onCheckpoint?.(s);
    },
    onEncounter(s){minimumSupplies=Math.min(minimumSupplies,s.supplies);onEncounter?.(s);},
    beforeExpandedTurn(s){
      const e=s.encounter,hero=e.units.find(u=>u.id==='hero');
      minimumSupplies=Math.min(minimumSupplies,s.supplies);
      if(e.kind==='contest'){
        if(e.turn===2){
          // Build the durable service/civic coalition rather than maximizing
          // only this turn's flip count; rivals can immediately reverse swings.
          const available=G.caseOptions(s).filter(c=>c.preview.ok),c=available[caseVariant]??available[0];
          if(c){
            const before=G.serialize(s),preview=G.previewCase(s,c.id);assert.equal(G.serialize(s),before);assert.ok(preview.ok);
            call(s,'presentCase',c.id);cases.push({encounter:e.id,id:c.id,netVotes:preview.netVotes});
          }
        }
        // The old harness can leave its second speaker beside fully committed
        // delegates. Move that speaker toward a genuinely contestable vote.
        for(const speaker of e.units.filter(u=>u.side==='ally'&&alive(u)&&!u.moved&&!u.acted)){
          const targets=G.getTargets(s,speaker.id,'persuade').map(t=>e.units.find(u=>u.id===t.unitId));
          if(targets.some(u=>u.stance<3))continue;
          const goals=e.units.filter(u=>u.role==='voter'&&u.stance<3).sort((a,b)=>Math.abs(1-a.stance)-Math.abs(1-b.stance)+.2*(distance(speaker,a)-distance(speaker,b)));
          if(!goals[0])continue;
          const positions=G.getTargets(s,speaker.id,'move').sort((a,b)=>pathDistance(e,a,goals[0],speaker.id)-pathDistance(e,b,goals[0],speaker.id)||a.cost-b.cost);
          if(positions[0]&&pathDistance(e,positions[0],goals[0],speaker.id)<pathDistance(e,speaker,goals[0],speaker.id))call(s,'act',{unitId:speaker.id,action:'move',x:positions[0].x,y:positions[0].y});
        }
        if(difficulty==='veteran'&&e.turn>=2)protectCoalition(s,call);
        return;
      }
      // A threatened commander uses the already-earned Rally action before
      // spending it on a brace; company orders remain available afterward.
      if(hero.hp<=hero.maxHp-4&&G.getActions(s,'hero').includes('rally')){
        const t=G.getTargets(s,'hero','rally')[0];
        call(s,'act',{unitId:'hero',action:'rally',x:t.x,y:t.y,targetId:t.unitId});
      }
      if(s.chapter>=3&&!hero.acted){
        const authoredOpportunities=G.commandBriefing(s).opportunities;
        const useful=o=>{
          const effect=authoredOpportunities.find(p=>p.id===o.id)?.effect;
          return effect==='medicine'&&hero.hp<=hero.maxHp-4||effect==='standard'&&(hero.cohesion<60||hero.morale<50)||effect==='integrity'&&e.defence<60||effect==='command'&&e.commandsLeft===0;
        };
        const available=G.fieldOptions(s).filter(o=>['stores','signal'].includes(o.id)&&o.preview.ok&&useful(o)),o=available[alternate?available.length-1:0];
        if(o){const before=G.serialize(s);assert.ok(G.previewFieldAction(s,o.id).ok);assert.equal(G.serialize(s),before);call(s,'fieldAction',o.id);opportunities.push({encounter:e.id,id:o.id,label:o.label});}
      }
    },
  });
  assert.equal(r.rank,'Augustus');assert.equal(r.encounters.length,25);assert.equal(r.state.completed.length,12);
  assert.equal(cases.length,6,'Every authored Contest exercises a documented case');
  assert.ok(r.checks.every(c=>c.exactRetry));
  G.deserialize(G.serialize(r.state));
  return {...r,method:'Legal New Game; public commands only; exact Retry at all25 encounters; no state injection',plans,cases,opportunities,minimumSupplies,lowSupply,caseVariant};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const reports=[];
  for(const options of [{},{alternate:true},{caseVariant:1},{difficulty:'story',seed:137},{difficulty:'veteran',seed:831},{lowSupply:true}]){
    const {state,...r}=runCommandCampaign(options);reports.push(r);
    console.log(JSON.stringify({difficulty:r.difficulty,alternate:r.alternate,caseVariant:r.caseVariant,lowSupply:r.lowSupply,rank:r.rank,turns:r.turns,encounters:r.encounters.length,cases:r.cases.length,minimumSupplies:r.minimumSupplies}));
  }
  if(process.argv.includes('--write'))await writeFile(new URL('../docs/evidence/command-campaign-v034.json',import.meta.url),JSON.stringify({method:'Six legal full-campaign routes, including both documented cases in every hearing; no state injection',reports},null,2)+'\n');
}

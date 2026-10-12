import {pathToFileURL} from 'node:url';
import {CHAPTERS} from '../src/data/campaign.js';
import * as Game from '../src/core/game.js';
import {debugJump} from '../src/core/debug.js';
import {playEncounter} from './autoplay.mjs';

// Explicit scenario injection, followed exclusively by legal encounter commands.
// This is balance evidence, not a fresh campaign or a human playtest.
export function politicalFixture(chapter,id,{meters={army:45,political:45,public:45},version=2}={}){
  const state=debugJump(Game.newGame('Political balance scenario',275),chapter,true),data=CHAPTERS[chapter-1];
  Game.choose(state,data.decision.options[0].id);state.encounterIndex=data.encounters.findIndex(e=>e.id===id);
  if(state.encounterIndex<0)throw Error('Unknown political scenario');
  if(chapter===7)Game.prepare(state,'drill');if(chapter===8)Game.negotiate(state,'safe-passage');
  if(chapter===10){Game.allocate(state,{river:2,farms:2,town:2});Game.judge(state,'shared');}
  state.meters={...meters};const result=Game.startEncounter(state,{politicsVersion:version});if(!result.ok)throw Error(result.message);return state;
}
export function runPoliticalDiagnostics({versions=[1,2],trace=false}={}){
  const runs=[];
  for(const version of versions)for(const chapter of CHAPTERS)for(const data of chapter.encounters.filter(e=>e.kind==='contest'))for(const profile of ['moderate','zero-support'])for(const approach of ['record','coalition']){
    const state=politicalFixture(chapter.id,data.id,{version,meters:profile==='zero-support'?{army:0,political:0,public:0}:{army:45,political:45,public:45}}),commands=[],initialVotes=Game.voteCount(state).for;
    const outcome=playEncounter(state,{approach,trace:commands}),actions={};for(const row of commands)if(row.kind==='act')actions[row.payload.action]=(actions[row.payload.action]??0)+1;
    runs.push({version,profile,approach:approach==='record'?'debt-free arguments':'promised coalition',initialVotes,...outcome,votes:Game.voteCount(state),obligations:state.encounter.staged.obligations.map(o=>({to:o.to,cost:o.cost,due:o.due})),futureSupplyCost:state.encounter.staged.obligations.reduce((n,o)=>n+o.cost,0),speakers:state.encounter.units.filter(u=>u.role==='speaker').map(u=>({id:u.id,resolve:u.resolve})),actions,...(trace?{commands}:{})});
  }
  return {scope:'Injected chapter scenarios, identical seed275 and declared meters; every encounter command goes through preview/act/endTurn. Not a full-campaign or human-play result.',rules:'v1 is the saved v0.6 authored rules; v2 adds bloc affinity, cooperative lobbying, material Promise cost and public opportunity-based rival plans.',runs};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(runPoliticalDiagnostics({trace:process.argv.includes('--trace')}),null,2));

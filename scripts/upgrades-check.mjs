// The plan's "upgrades count" target (docs/worlds-and-gameplay-plan.md, adopted by the owner on
// 1 November 2026, in place of first-try wins, which both reference players all but saturate on Veteran).
// Better kit leaves the soldier less hurt and wins sooner, in Chapters I–III and the eleven champion
// battles (src/data/champions.js), as the release sweeps' reference players measure it
// (scripts/realtime-sweep.mjs --kit=bare|issued|engaged). Development only: it reads sweep evidence.
//
//   node scripts/upgrades-check.mjs --label=release11    # prints the measures; exits 1 if a target is not met
//   node scripts/upgrades-check.mjs --label=release11 --dir=docs/evidence
//
// It reads six sweeps of the label: Story bare and issued, Standard issued and engaged, Veteran issued and
// engaged (docs/evidence/realtime-<label>-sweep-<difficulty>[-<kit>].json). Passes 1 and 2 count (the first
// decisions and the others); Chapter XII's confrontation counts on its route of the day. Each interval is a
// 90% bootstrap range over seeds (whole seeds resampled, by a fixed generator: the same files give the same report).
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {CHAMPIONS} from '../src/data/champions.js';

export const UPGRADE_TARGETS=Object.freeze({veteranHealth:.03,veteranRounds:.3,storyChampionHealth:.10});
const SWEEPS=Object.freeze({storyBare:['story','bare'],storyIssued:['story','issued'],standardIssued:['standard','issued'],
  standardEngaged:['standard','engaged'],veteranIssued:['veteran','issued'],veteranEngaged:['veteran','engaged']});
export const sweepFile=(label,difficulty,kit)=>`realtime-${label}-sweep-${difficulty}${kit==='bare'?'':`-${kit}`}.json`;

const champion=r=>Object.hasOwn(CHAMPIONS,r.id);
const inScope=r=>Number(/^ch(\d+)/.exec(r.id)?.[1])<=3||champion(r);
const mean=list=>list.length?list.reduce((a,b)=>a+b,0)/list.length:null;
// The runs a sweep counts: passes 1 and 2, played in real time.
export const sweepRuns=report=>[...(report.runs??[]),...(report.variants??[])].filter(r=>r.realtime);

// The mean of a measure over won runs, the second player's minus the first's, with a 90% range over seeds.
function difference(first,second,measure,keep,{rounds=1000}={}){
  const bySeed=list=>{const m=new Map();for(const r of list)if(r.status==='won'&&keep(r)&&Number.isFinite(measure(r)))(m.get(r.seed)??m.set(r.seed,[]).get(r.seed)).push(measure(r));return m;};
  const A=bySeed(first),B=bySeed(second),seeds=[...A.keys()].filter(s=>B.has(s)).sort((a,b)=>a-b);
  const value=(M,picked)=>mean(picked.flatMap(s=>M.get(s)));
  let state=20261101;const next=()=>(state=(Math.imul(state,1103515245)+12345)>>>0)/2**32;
  const draws=[];for(let i=0;i<rounds;i++){const picked=seeds.map(()=>seeds[Math.floor(next()*seeds.length)]);draws.push(value(B,picked)-value(A,picked));}
  draws.sort((a,b)=>a-b);
  return {first:value(A,seeds),second:value(B,seeds),difference:value(B,seeds)-value(A,seeds),low:draws[Math.floor(rounds*.05)],high:draws[Math.floor(rounds*.95)],seeds:seeds.length};
}
const nearDeath=list=>list.filter(r=>r.status==='won'&&inScope(r)&&r.heroHealth<.5).length;

// The report from the six sweeps' runs ({storyBare,storyIssued,…}: arrays of runs).
export function upgradesReport(runs){
  const health=r=>r.heroHealth,length=r=>r.rounds;
  const measures={
    veteranHealth:difference(runs.veteranIssued,runs.veteranEngaged,health,inScope),
    veteranRounds:difference(runs.veteranIssued,runs.veteranEngaged,length,inScope),
    storyChampionHealth:difference(runs.storyBare,runs.storyIssued,health,champion),
    standardHealth:difference(runs.standardIssued,runs.standardEngaged,health,inScope),
    standardRounds:difference(runs.standardIssued,runs.standardEngaged,length,inScope)};
  const points=v=>`${(v*100).toFixed(1)} points`;
  const targets=[
    {target:`Veteran: engaged ends its wins with ≥ ${points(UPGRADE_TARGETS.veteranHealth)} more health than issued`,
      value:`${points(measures.veteranHealth.difference)} (${(measures.veteranHealth.first*100).toFixed(1)}% → ${(measures.veteranHealth.second*100).toFixed(1)}%; range ${points(measures.veteranHealth.low)} to ${points(measures.veteranHealth.high)})`,
      met:measures.veteranHealth.difference>=UPGRADE_TARGETS.veteranHealth},
    {target:`Veteran: engaged wins ≥ ${UPGRADE_TARGETS.veteranRounds} rounds sooner than issued`,
      value:`${(-measures.veteranRounds.difference).toFixed(2)} rounds sooner (${measures.veteranRounds.first.toFixed(2)} → ${measures.veteranRounds.second.toFixed(2)}; range ${(-measures.veteranRounds.high).toFixed(2)} to ${(-measures.veteranRounds.low).toFixed(2)})`,
      met:-measures.veteranRounds.difference>=UPGRADE_TARGETS.veteranRounds},
    {target:`Story: issued ends the champion battles with ≥ ${points(UPGRADE_TARGETS.storyChampionHealth)} more health than bare`,
      value:`${points(measures.storyChampionHealth.difference)} (${(measures.storyChampionHealth.first*100).toFixed(1)}% → ${(measures.storyChampionHealth.second*100).toFixed(1)}%; range ${points(measures.storyChampionHealth.low)} to ${points(measures.storyChampionHealth.high)})`,
      met:measures.storyChampionHealth.difference>=UPGRADE_TARGETS.storyChampionHealth}];
  // Reported, without a pass mark: wins that end with the soldier below half health.
  const below={story:[nearDeath(runs.storyBare),nearDeath(runs.storyIssued)],standard:[nearDeath(runs.standardIssued),nearDeath(runs.standardEngaged)],
    veteran:[nearDeath(runs.veteranIssued),nearDeath(runs.veteranEngaged)]};
  return {measures,targets,belowHalf:below,met:targets.every(t=>t.met)};
}

export function upgradesFromEvidence(label,dir=new URL('../docs/evidence/',import.meta.url)){
  const runs=Object.fromEntries(Object.entries(SWEEPS).map(([key,[difficulty,kit]])=>[key,sweepRuns(JSON.parse(readFileSync(new URL(sweepFile(label,difficulty,kit),dir),'utf8')))]));
  return upgradesReport(runs);
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const arg=(name,fallback)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')??fallback;
  const label=arg('label');if(!label){console.error('Usage: node scripts/upgrades-check.mjs --label=<sweep label> [--dir=docs/evidence]');process.exit(2);}
  const dirArg=arg('dir');const dir=dirArg?pathToFileURL(`${resolve(dirArg)}/`):undefined;
  const report=upgradesFromEvidence(label,dir);
  console.log(`Upgrades count, sweeps "${label}" (Chapters I–III and the eleven champion battles; passes 1–2):`);
  for(const t of report.targets)console.log(`${t.met?'ok':'NOT MET'} - ${t.target}: ${t.value}`);
  const b=report.belowHalf;console.log(`Wins ending below half health: Story bare → issued ${b.story[0]} → ${b.story[1]}; Standard issued → engaged ${b.standard[0]} → ${b.standard[1]}; Veteran issued → engaged ${b.veteran[0]} → ${b.veteran[1]}.`);
  const s=report.measures;console.log(`Standard, for reference: ${(s.standardHealth.difference*100).toFixed(1)} points more health, ${(-s.standardRounds.difference).toFixed(2)} rounds sooner.`);
  process.exit(report.met?0:1);
}

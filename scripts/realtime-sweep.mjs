// Gate 2's deadline sweep (build brief Phase 2): a scripted bot, the heuristic
// player of realtime-autoplay.mjs (it plays the soldier and commands his
// squads; companions follow their standing orders), plays the campaign from
// New Game in real time through Chapter IX on campaign seeds, every battle by
// legal Commands only and every Contest by the 0.38 autoplay.
//
// - Pass 1: each chapter's first decision. Seeds are added until every battle
//   of Chapters IV–IX has been played on 20 of them; a lost battle ends its
//   seed's campaign, so a later battle can need more than 20 seeds.
// - Pass 2: the decisions that change a field the other way (Varro left to his
//   orders in Chapter VI, the soldiers first in Chapter VIII), on 20 seeds.
//
// A battle lost on its deadline may be an impossible deadline: every loss is
// listed with what was left undone. The tick times are this machine's (Node,
// headless), not a phone's. Development only:
//   node scripts/realtime-sweep.mjs [--seeds=20] [--difficulty=standard] [--write]
// --write saves docs/evidence/realtime-gate2-sweep.json.
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import * as G from '../src/core/game.js';
import {commandDecision,heroDecision,companionWatch,runRealtimeCampaign} from './realtime-autoplay.mjs';
import {roundOf,step} from '../src/core/realtime/simulation.js';
import {deploy,deploying,soundTheAdvance} from '../src/core/realtime/deployment.js';
import {TIME} from '../src/data/realtime-rules.js';

const arg=(name,fallback)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.split('=')[1]??fallback;
const SEEDS=Number(arg('seeds',20)),DIFFICULTY=arg('difficulty','standard'),FIRST=4,LAST=9,R=TIME.roundTicks,MAX_SEEDS=60;
export const OTHER_DECISIONS=Object.freeze({ch6:'obey',ch8:'soldiers'});
const percentile=(list,p)=>{if(!list.length)return null;const s=[...list].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(p*s.length))];};
const lostOnDeadline=r=>r.status!=='won'&&/deadline/i.test(r.reason??'');

// Play a started real-time encounter to its end as the bot, timing every tick.
export function playBattle(state,{maxRounds=40}={}){
  const world=G.realtimeWorld(state),watch=companionWatch(),times=[],deadline=world.mission?.deadline??null,memo={};
  let actors=0,squads=0;
  // From Chapter VII the company deploys first: the soldier takes his place, then the advance is sounded.
  if(deploying(world)){const hero=world.actors.find(a=>a.id===world.heroId);deploy(world,{id:hero.id,x:hero.x,z:hero.z});soundTheAdvance(world);}
  for(let t=0;t<maxRounds*R&&world.status==='active';t++){
    if(world.tick%10===0){commandDecision(world,memo);heroDecision(world,memo);}
    const t0=performance.now();step(world);times.push(performance.now()-t0);watch(world);
    actors=Math.max(actors,world.actors.filter(a=>a.alive).length);squads=Math.max(squads,(world.squads??[]).length);
  }
  const m=world.mission,rounds=roundOf(world),resolved=G.resolveRealtime(state,world);
  return {realtime:true,id:state.encounter.id,chapter:state.chapter,status:world.status,rounds,deadline,slack:world.status==='won'&&deadline?deadline-rounds:null,
    reason:m?.reason??null,phase:m?.phases?`${m.phase+1}/${m.phases.length} ${m.label}`:m?.label??null,resolved:resolved.ok,
    actors,squads,orders:world.used.includes('order'),incidents:watch.incidents.length,tick:{p50:percentile(times,.5),p95:percentile(times,.95),max:Math.max(...times)}};
}

// One seed's campaign in real time through Chapter IX: the battles of IV–IX it played.
export function campaign(seed,{difficulty=DIFFICULTY,choices={}}={}){
  const runs=[],ready=Array.from({length:LAST},(_,i)=>i+1);let stopped=null;
  try{runRealtimeCampaign({seed,difficulty,throughChapter:LAST,ready,choices,play:playBattle,onEncounter(state,summary){
    if(!summary.realtime)return;
    if(state.chapter>=FIRST)runs.push({seed,decision:state.decisions[G.getChapter(state).decision.id],...summary});
    else if(summary.status!=='won')stopped={seed,id:summary.id,chapter:state.chapter,status:summary.status,reason:summary.reason,rounds:summary.rounds,deadline:summary.deadline};}});}
  catch(error){if(!stopped&&!runs.some(r=>r.status!=='won'))stopped={seed,id:null,status:'error',reason:error.message.split('\n')[0]};}
  return {runs,stopped};
}

export function sweep({seeds=SEEDS,difficulty=DIFFICULTY,onResult=null}={}){
  const runs=[],variants=[],stopped=[],count=new Map();let seed=0;
  // Pass 1: until every battle of IV–IX has `seeds` runs.
  while(seed<MAX_SEEDS&&(seed<seeds||[...count.values()].some(n=>n<seeds)||count.size<11)){
    seed++;const out=campaign(seed,{difficulty});if(out.stopped)stopped.push({pass:1,...out.stopped});
    for(const r of out.runs){if((count.get(r.id)??0)>=seeds)continue;count.set(r.id,(count.get(r.id)??0)+1);runs.push(r);onResult?.(r,1);}
  }
  // Pass 2: the other decisions.
  for(let s=1;s<=seeds;s++){const out=campaign(s,{difficulty,choices:OTHER_DECISIONS});if(out.stopped)stopped.push({pass:2,...out.stopped});for(const r of out.runs){variants.push(r);onResult?.(r,2);}}
  const battles=[...new Set(runs.map(r=>r.id))].map(id=>{
    const list=runs.filter(r=>r.id===id),won=list.filter(r=>r.status==='won'),other=variants.filter(r=>r.id===id);
    return {id,chapter:list[0].chapter,runs:list.length,won:won.length,deadlineLosses:list.filter(lostOnDeadline).length,
      otherLosses:list.filter(r=>r.status!=='won'&&!lostOnDeadline(r)).length,deadline:list[0].deadline,
      roundsMedian:percentile(won.map(r=>r.rounds),.5),roundsMax:won.length?Math.max(...won.map(r=>r.rounds)):null,slackMin:won.length?Math.min(...won.map(r=>r.slack)):null,
      otherDecision:other.length?{decision:other[0].decision,runs:other.length,won:other.filter(r=>r.status==='won').length,deadlineLosses:other.filter(lostOnDeadline).length,
        slackMin:other.some(r=>r.status==='won')?Math.min(...other.filter(r=>r.status==='won').map(r=>r.slack)):null}:null,
      actorsMax:Math.max(...list.map(r=>r.actors)),squadsMax:Math.max(...list.map(r=>r.squads)),
      tickP95:percentile(list.map(r=>r.tick.p95),.5),tickMax:Math.max(...list.map(r=>r.tick.max))};
  });
  return {source:'New Game; the campaign in real time through Chapter IX by legal commands (Contests by the 0.38 autoplay); each real-time battle played by the heuristic bot through legal Commands',
    difficulty,seeds,seedsUsed:seed,chapters:[FIRST,LAST],otherDecisions:OTHER_DECISIONS,battles,
    losses:[...runs,...variants].filter(r=>r.status!=='won'),stopped,runs,variants};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const report=sweep({onResult:(r,pass)=>console.log(`pass ${pass} seed ${String(r.seed).padStart(2)} ${String(r.id).padEnd(13)} ${r.status.padEnd(5)} round ${String(r.rounds).padStart(2)} of ${r.deadline}`+
    `${r.status==='won'?'':` — ${r.reason}${r.phase?` (${r.phase})`:''}`}`)});
  for(const s of report.stopped)console.log(`pass ${s.pass} seed ${s.seed} stopped${s.id?` at ${s.id}`:''}: ${s.reason}`);
  console.log(`\nSeeds used in pass 1: ${report.seedsUsed}\nBattle         won  deadline-losses  other  rounds(median/max)  slack(min)  other decision    actors  tick p95/max (ms)`);
  for(const b of report.battles)console.log(`${b.id.padEnd(14)} ${String(b.won).padStart(2)}/${b.runs}  ${String(b.deadlineLosses).padStart(15)}  ${String(b.otherLosses).padStart(5)}  ${String(b.roundsMedian).padStart(8)}/${b.roundsMax}  ${String(b.slackMin).padStart(10)}  `+
    `${b.otherDecision?`${b.otherDecision.decision} ${b.otherDecision.won}/${b.otherDecision.runs}`:'—'}`.padEnd(16)+`  ${String(b.actorsMax).padStart(6)}  ${b.tickP95.toFixed(2)}/${b.tickMax.toFixed(1)}`);
  if(process.argv.includes('--write')){
    const fixed=t=>t&&{p50:+t.p50.toFixed(3),p95:+t.p95.toFixed(3),max:+t.max.toFixed(2)};
    const out={...report,machine:'Node.js, headless, on the development container (not a phone)',runs:report.runs.map(r=>({...r,tick:fixed(r.tick)})),
      variants:report.variants.map(r=>({...r,tick:fixed(r.tick)})),losses:report.losses.map(r=>({...r,tick:fixed(r.tick)})),
      battles:report.battles.map(b=>({...b,tickP95:+b.tickP95.toFixed(3),tickMax:+b.tickMax.toFixed(2)}))};
    await writeFile(new URL('../docs/evidence/realtime-gate2-sweep.json',import.meta.url),`${JSON.stringify(out,null,1)}\n`);console.log('Wrote docs/evidence/realtime-gate2-sweep.json');
  }
  if(report.losses.some(lostOnDeadline))process.exitCode=1;
}

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
// - With --last=12 (Gate 4): Chapter X's road and the finale join the battles,
//   and pass 3 plays every finale route from each seed's Chapter XII camp. A
//   route the camp's meters do not open is entered with the meters the
//   archive's practice uses for it, and counted as injected.
//
// A battle lost on its deadline may be an impossible deadline: every loss is
// listed with what was left undone. The tick times are this machine's (Node,
// headless), not a phone's. Development only:
//   node scripts/realtime-sweep.mjs [--seeds=20] [--difficulty=standard] [--last=9|12] [--write]
// --write saves docs/evidence/realtime-gate2-sweep.json (realtime-gate4-sweep.json with --last=12), with
// the difficulty in its name when it is not Standard (realtime-gate4-sweep-story.json).
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import * as G from '../src/core/game.js';
import {commandDecision,heroDecision,companionWatch,runRealtimeCampaign} from './realtime-autoplay.mjs';
import {roundOf,step} from '../src/core/realtime/simulation.js';
import {deploy,deploying,soundTheAdvance} from '../src/core/realtime/deployment.js';
import {TIME} from '../src/data/realtime-rules.js';
import {CHAPTERS} from '../src/data/campaign.js';

const arg=(name,fallback)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.split('=')[1]??fallback;
const SEEDS=Number(arg('seeds',20)),DIFFICULTY=arg('difficulty','standard'),FIRST=4,LAST=Number(arg('last',9)),R=TIME.roundTicks,MAX_SEEDS=60;
// The battles the sweep plays (Chapter XII's confrontation counted once, on its route of the day).
const BATTLES=CHAPTERS.filter(c=>c.id>=FIRST&&c.id<=LAST).flatMap(c=>c.encounters.filter(e=>e.kind==='battle').map(e=>e.id));
export const ROUTES=Object.freeze(['backer','battle','defection','settlement','surrender']);
// The meters each standoff route needs, as the archive's practice opens it (game.js).
const ROUTE_METERS={defection:{army:55},settlement:{political:50},surrender:{public:60,political:40}};
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
export function campaign(seed,{difficulty=DIFFICULTY,choices={},camps=null}={}){
  const runs=[],ready=Array.from({length:LAST},(_,i)=>i+1);let stopped=null;
  try{runRealtimeCampaign({seed,difficulty,throughChapter:LAST,ready,choices,play:playBattle,onEncounter(state,summary){
    // Pass 3's Chapter XII camp, kept on the way: the Senate's recognition recorded, the confrontation ahead.
    if(camps&&state.encounter?.id==='ch12-legitimacy'&&!camps.has(seed)){const copy=G.deserialize(G.serialize(state));if(G.commitEncounter(copy).ok)camps.set(seed,G.serialize(copy));}
    if(!summary.realtime)return;
    if(state.chapter>=FIRST)runs.push({seed,decision:state.decisions[G.getChapter(state).decision.id],...summary});
    else if(summary.status!=='won')stopped={seed,id:summary.id,chapter:state.chapter,status:summary.status,reason:summary.reason,rounds:summary.rounds,deadline:summary.deadline};}});}
  catch(error){if(!stopped&&!runs.some(r=>r.status!=='won'))stopped={seed,id:null,status:'error',reason:error.message.split('\n')[0]};}
  return {runs,stopped};
}

// A seed's Chapter XII camp, the Senate's recognition recorded and the confrontation ahead (serialized).
export function finaleCamp(seed,{difficulty=DIFFICULTY}={}){
  let camp=null;const stop=new Error('camp');
  try{runRealtimeCampaign({seed,difficulty,throughChapter:12,ready:Array.from({length:12},(_,i)=>i+1),play:playBattle,onEncounter(state){
    if(state.encounter?.id!=='ch12-legitimacy')return;const copy=G.deserialize(G.serialize(state));if(G.commitEncounter(copy).ok)camp=G.serialize(copy);throw stop;}});}
  catch(error){if(error!==stop)return null;}
  return camp;
}

export function sweep({seeds=SEEDS,difficulty=DIFFICULTY,onResult=null}={}){
  const runs=[],variants=[],stopped=[],count=new Map(),camps=new Map();let seed=0;
  // Pass 1: until every battle of IV–IX has `seeds` runs.
  while(seed<MAX_SEEDS&&(seed<seeds||[...count.values()].some(n=>n<seeds)||count.size<BATTLES.length)){
    seed++;const out=campaign(seed,{difficulty,camps});if(out.stopped)stopped.push({pass:1,...out.stopped});
    for(const r of out.runs){if((count.get(r.id)??0)>=seeds)continue;count.set(r.id,(count.get(r.id)??0)+1);runs.push(r);onResult?.(r,1);}
  }
  // Pass 2: the other decisions.
  for(let s=1;s<=seeds;s++){const out=campaign(s,{difficulty,choices:OTHER_DECISIONS});if(out.stopped)stopped.push({pass:2,...out.stopped});for(const r of out.runs){variants.push(r);onResult?.(r,2);}}
  // Pass 3 (with the finale): every route from each seed's Chapter XII camp.
  const routes=[];
  if(LAST>=12)for(let s=1;s<=seeds;s++){
    const camp=camps.get(s)??finaleCamp(s,{difficulty});if(!camp){stopped.push({pass:3,seed:s,id:null,status:'error',reason:'The Chapter XII camp was not reached.'});continue;}
    for(const route of ROUTES){
      const state=G.deserialize(camp),open=G.finaleForecast(state).routes.some(r=>r.id===route);
      if(!open)for(const [k,v]of Object.entries(ROUTE_METERS[route]??{}))state.meters[k]=Math.max(state.meters[k],v);
      if(!G.chooseRoute(state,route).ok||!G.startEncounter(state,{controls:'realtime'}).ok||!G.isRealtime(state)){stopped.push({pass:3,seed:s,id:`route:${route}`,status:'error',reason:'Not started.'});continue;}
      const r={seed:s,route,injected:!open,...playBattle(state)};routes.push(r);onResult?.(r,3);
    }
  }
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
  const finale=ROUTES.map(route=>{const list=routes.filter(r=>r.route===route),won=list.filter(r=>r.status==='won');
    return {route,runs:list.length,won:won.length,injected:list.filter(r=>r.injected).length,deadlineLosses:list.filter(lostOnDeadline).length,
      roundsMedian:percentile(won.map(r=>r.rounds),.5),roundsMax:won.length?Math.max(...won.map(r=>r.rounds)):null,slackMin:won.length?Math.min(...won.map(r=>r.slack)):null};}).filter(f=>f.runs);
  return {source:`New Game; the campaign in real time through Chapter ${LAST===12?'XII':'IX'} by legal commands (Contests by the 0.38 autoplay); each real-time battle played by the heuristic bot through legal Commands`,
    difficulty,seeds,seedsUsed:seed,chapters:[FIRST,LAST],otherDecisions:OTHER_DECISIONS,battles,...(finale.length?{finale}:{}),
    losses:[...runs,...variants,...routes].filter(r=>r.status!=='won'),stopped,runs,variants,...(routes.length?{routes}:{})};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const report=sweep({onResult:(r,pass)=>console.log(`pass ${pass} seed ${String(r.seed).padStart(2)} ${String(r.route?`route:${r.route}`:r.id).padEnd(13)} ${r.status.padEnd(5)} round ${String(r.rounds).padStart(2)} of ${r.deadline}`+
    `${r.status==='won'?'':` — ${r.reason}${r.phase?` (${r.phase})`:''}`}`)});
  for(const s of report.stopped)console.log(`pass ${s.pass} seed ${s.seed} stopped${s.id?` at ${s.id}`:''}: ${s.reason}`);
  console.log(`\nSeeds used in pass 1: ${report.seedsUsed}\nBattle         won  deadline-losses  other  rounds(median/max)  slack(min)  other decision    actors  tick p95/max (ms)`);
  for(const f of report.finale??[])console.log(`route ${f.route.padEnd(10)} ${f.won}/${f.runs} won (${f.injected} injected), rounds ${f.roundsMedian}/${f.roundsMax}, slack ${f.slackMin}`);
  for(const b of report.battles)console.log(`${b.id.padEnd(14)} ${String(b.won).padStart(2)}/${b.runs}  ${String(b.deadlineLosses).padStart(15)}  ${String(b.otherLosses).padStart(5)}  ${String(b.roundsMedian).padStart(8)}/${b.roundsMax}  ${String(b.slackMin).padStart(10)}  `+
    `${b.otherDecision?`${b.otherDecision.decision} ${b.otherDecision.won}/${b.otherDecision.runs}`:'—'}`.padEnd(16)+`  ${String(b.actorsMax).padStart(6)}  ${b.tickP95.toFixed(2)}/${b.tickMax.toFixed(1)}`);
  if(process.argv.includes('--write')){
    const fixed=t=>t&&{p50:+t.p50.toFixed(3),p95:+t.p95.toFixed(3),max:+t.max.toFixed(2)};
    const out={...report,machine:'Node.js, headless, on the development container (not a phone)',runs:report.runs.map(r=>({...r,tick:fixed(r.tick)})),
      variants:report.variants.map(r=>({...r,tick:fixed(r.tick)})),losses:report.losses.map(r=>({...r,tick:fixed(r.tick)})),
      battles:report.battles.map(b=>({...b,tickP95:+b.tickP95.toFixed(3),tickMax:+b.tickMax.toFixed(2)}))};
    const file=`${LAST>=12?'realtime-gate4-sweep':'realtime-gate2-sweep'}${DIFFICULTY==='standard'?'':`-${DIFFICULTY}`}.json`;if(out.routes)out.routes=out.routes.map(r=>({...r,tick:fixed(r.tick)}));
    await writeFile(new URL(`../docs/evidence/${file}`,import.meta.url),`${JSON.stringify(out,null,1)}\n`);console.log(`Wrote docs/evidence/${file}`);
  }
  if(report.losses.some(lostOnDeadline))process.exitCode=1;
}

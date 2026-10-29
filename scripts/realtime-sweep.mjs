// The real-time campaign sweep (Gate 2, Gate 4 and the worlds and gameplay
// plan's release 3 calibration): a scripted bot, the heuristic player of
// realtime-autoplay.mjs (it plays the soldier and commands his squads;
// companions follow their standing orders), plays the campaign from New Game in
// real time on campaign seeds, every battle by legal Commands only and every
// Contest by the 0.38 autoplay. A lost battle is retried from its checkpoint
// (Retry, a legal command) up to --retries times; the retry restores the same
// battle, so the bot plays it more carefully, as a player would (heroDecision).
// A battle still lost ends its seed's campaign.
//
// - Pass 1: each chapter's first decision. Seeds are added until every battle
//   of Chapters IV–IX (to XII with --last=12) has been played on --seeds of them.
// - Pass 2: the decisions that change a field the other way (Varro left to his
//   orders in Chapter VI, the soldiers first in Chapter VIII).
// - With --last=12: Chapter X's road and the finale join the battles, and pass 3
//   plays every finale route from each seed's Chapter XII camp. A route the
//   camp's meters do not open is entered with the meters the archive's practice
//   uses for it, and counted as injected.
//
// Each battle reports its tries (won first time, within two, within three), the
// enemy plans seen across seeds, its rounds and slack, the share of our squads'
// strength lost, and the tick times on this machine (Node, headless, not a
// phone). Release 3's targets are checked at the end. Development only:
//   node scripts/realtime-sweep.mjs [--seeds=20] [--difficulty=standard] [--last=9|12] [--retries=2] [--baseline=FILE] [--label=release4] [--missions=0] [--operations=other] [--write]
// New Game's campaigns play release 7's missions; --missions=0 plays a campaign begun before them.
// --baseline names an earlier sweep's report whose tick p95 each battle must not
// exceed by more than 0.3 ms (default: the Gate 4 sweep); it is fair only from the
// same machine, one sweep at a time. --write saves
// docs/evidence/realtime-<label>-sweep-<difficulty>.json.
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import * as G from '../src/core/game.js';
import {commandDecision,heroDecision,companionWatch,runRealtimeCampaign} from './realtime-autoplay.mjs';
import {roundOf,step} from '../src/core/realtime/simulation.js';
import {deploy,deploying,soundTheAdvance} from '../src/core/realtime/deployment.js';
import {TIME} from '../src/data/realtime-rules.js';
import {CHAPTERS} from '../src/data/campaign.js';
import {MISSION_BRANCHES} from '../src/data/mission-operations.js';
import {PROGRESSION_OPERATIONS} from '../src/data/progression-operations.js';

const arg=(name,fallback)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.split('=')[1]??fallback;
const SEEDS=Number(arg('seeds',20)),DIFFICULTY=arg('difficulty','standard'),FIRST=4,LAST=Number(arg('last',12)),R=TIME.roundTicks,MAX_SEEDS=60;
// Release 7's missions, as New Game plays them; --missions=0 plays the campaigns begun before them.
const MISSIONS=arg('missions','1')!=='0';
// Tries a player is given before a battle counts as failed: Story is won first time, Standard within two, Veteran within three.
export const TARGETS=Object.freeze({story:{first:1,within:1},standard:{first:.9,within:2},veteran:{first:.7,within:3}});
const RETRIES=Number(arg('retries',(TARGETS[DIFFICULTY]?.within??2)));
// The battles the sweep plays (Chapter XII's confrontation counted once, on its route of the day).
const BATTLES=CHAPTERS.filter(c=>c.id>=FIRST&&c.id<=LAST).flatMap(c=>c.encounters.filter(e=>e.kind==='battle').map(e=>e.id));
export const ROUTES=Object.freeze(['backer','battle','defection','settlement','surrender']);
// The meters each standoff route needs, as the archive's practice opens it (game.js).
const ROUTE_METERS={defection:{army:55},settlement:{political:50},surrender:{public:60,political:40}};
export const OTHER_DECISIONS=Object.freeze({ch6:'obey',ch8:'soldiers'});
// With --operations=other, pass 2 also takes each battle's second operation in camp (Chapter IV's hold for the
// baggage train, X's south road and the rest), so every operation is played in real time.
const OTHER=arg('operations','first')==='other';
export const otherOperations=missions=>Object.fromEntries(Object.entries(missions?MISSION_BRANCHES:PROGRESSION_OPERATIONS).filter(([,b])=>b.length>1).map(([id,b])=>[id,b[1].id]));
const percentile=(list,p)=>{if(!list.length)return null;const s=[...list].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(p*s.length))];};
const lostOnDeadline=r=>r.status!=='won'&&/deadline/i.test(r.reason??'');

// Play a started real-time encounter to its end as the bot, timing every tick.
export function playBattle(state,{maxRounds=40,attempt=1}={}){
  const world=G.realtimeWorld(state),watch=companionWatch(),times=[],deadline=world.mission?.deadline??null,memo={attempt},plans=new Set();
  let actors=0,squads=0;
  // From Chapter VII the company deploys first: the soldier takes his place, then the advance is sounded.
  if(deploying(world)){const hero=world.actors.find(a=>a.id===world.heroId);deploy(world,{id:hero.id,x:hero.x,z:hero.z});soundTheAdvance(world);}
  const ours=()=>(world.squads??[]).filter(q=>q.side!=='enemy');
  const full=ours().reduce((n,q)=>n+q.maxStrength,0),hidden=(world.squads??[]).filter(q=>q.lying).length,ambushes={enemy:0,ours:0};
  for(let t=0;t<maxRounds*R&&world.status==='active';t++){
    if(world.tick%10===0){commandDecision(world,memo);heroDecision(world,memo);}
    if(world.doctrine?.plan)plans.add(world.doctrine.plan.id);
    const t0=performance.now(),events=step(world);times.push(performance.now()-t0);watch(world);
    for(const e of events)if(e.kind==='squad-ambush')ambushes[(world.squads??[]).find(q=>q.id===e.squadId)?.side==='enemy'?'enemy':'ours']++;
    actors=Math.max(actors,world.actors.filter(a=>a.alive).length);squads=Math.max(squads,(world.squads??[]).length);
  }
  const m=world.mission,rounds=roundOf(world),left=ours().filter(q=>q.maxStrength>0).reduce((n,q)=>n+q.strength,0);
  const hero=world.actors.find(a=>a.id===world.heroId),resolved=G.resolveRealtime(state,world);
  return {realtime:true,id:state.encounter.id,chapter:state.chapter,status:world.status,rounds,deadline,slack:world.status==='won'&&deadline?deadline-rounds:null,
    reason:m?.reason??null,phase:m?.phases?`${m.phase+1}/${m.phases.length} ${m.label}`:m?.label??null,resolved:resolved.ok,
    plans:[...plans],weather:world.weather,hidden,ambushes,loss:full?+(1-left/full).toFixed(3):null,heroHealth:hero?+(hero.hp/hero.maxHp).toFixed(2):null,
    actors,squads,orders:world.used.includes('order'),incidents:watch.incidents.length,tick:{p50:percentile(times,.5),p95:percentile(times,.95),max:Math.max(...times)}};
}

// One seed's campaign in real time: every try of the battles of IV–XII it played.
export function campaign(seed,{difficulty=DIFFICULTY,choices={},operations={},camps=null,retries=RETRIES}={}){
  const runs=[],ready=Array.from({length:LAST},(_,i)=>i+1);let stopped=null;
  try{runRealtimeCampaign({seed,difficulty,throughChapter:LAST,ready,choices,operations,retries,missions:MISSIONS,play:playBattle,onEncounter(state,summary){
    // Pass 3's Chapter XII camp, kept on the way: the Senate's recognition recorded, the confrontation ahead.
    if(camps&&state.encounter?.id==='ch12-legitimacy'&&!camps.has(seed)&&state.encounter.status==='won'){
      const copy=G.deserialize(G.serialize(state));if(G.commitEncounter(copy).ok)camps.set(seed,G.serialize(copy));}
    if(!summary.realtime)return;
    if(state.chapter>=FIRST)runs.push({seed,decision:state.decisions[G.getChapter(state).decision.id],operation:state.encounter?.operation?.branch??null,...summary});
    else if(summary.status!=='won'&&summary.tries>retries)stopped={seed,id:summary.id,chapter:state.chapter,status:summary.status,reason:summary.reason,rounds:summary.rounds,deadline:summary.deadline};}});}
  catch(error){if(!stopped&&!runs.some(r=>r.status!=='won'&&r.tries>retries))stopped={seed,id:null,status:'error',reason:error.message.split('\n')[0]};}
  return {runs,stopped};
}

// A seed's Chapter XII camp, the Senate's recognition recorded and the confrontation ahead (serialized).
export function finaleCamp(seed,{difficulty=DIFFICULTY,retries=RETRIES}={}){
  let camp=null;const stop=new Error('camp');
  try{runRealtimeCampaign({seed,difficulty,throughChapter:12,ready:Array.from({length:12},(_,i)=>i+1),retries,missions:MISSIONS,play:playBattle,onEncounter(state){
    if(state.encounter?.id!=='ch12-legitimacy'||state.encounter.status!=='won')return;const copy=G.deserialize(G.serialize(state));if(G.commitEncounter(copy).ok)camp=G.serialize(copy);throw stop;}});}
  catch(error){if(error!==stop)return null;}
  return camp;
}

// A seed's battle, try by try: how many tries it took, or null if every try was lost.
const outcome=list=>{const won=list.find(r=>r.status==='won');return {first:list[0],won,tries:won?won.tries:null};};
const group=list=>{const out=new Map();for(const r of list){const key=`${r.seed}|${r.id}|${r.route??''}`;(out.get(key)??out.set(key,[]).get(key)).push(r);}
  return [...out.values()].map(l=>l.sort((a,b)=>a.tries-b.tries)).map(outcome);};

export function sweep({seeds=SEEDS,difficulty=DIFFICULTY,retries=RETRIES,onResult=null}={}){
  const runs=[],variants=[],stopped=[],count=new Map(),camps=new Map();let seed=0;
  // Pass 1: until every battle has `seeds` seeds.
  while(seed<MAX_SEEDS&&(seed<seeds||[...count.values()].some(n=>n<seeds)||count.size<BATTLES.length)){
    seed++;const out=campaign(seed,{difficulty,camps,retries});if(out.stopped)stopped.push({pass:1,...out.stopped});
    for(const id of new Set(out.runs.map(r=>r.id))){if((count.get(id)??0)>=seeds)continue;count.set(id,(count.get(id)??0)+1);
      for(const r of out.runs.filter(r=>r.id===id)){runs.push(r);onResult?.(r,1);}}
  }
  // Pass 2: the other decisions.
  for(let s=1;s<=seeds;s++){const out=campaign(s,{difficulty,choices:OTHER_DECISIONS,operations:OTHER?otherOperations(MISSIONS):{},retries});if(out.stopped)stopped.push({pass:2,...out.stopped});for(const r of out.runs){variants.push(r);onResult?.(r,2);}}
  // Pass 3 (with the finale): every route from each seed's Chapter XII camp, retried as a battle is.
  const routes=[];
  if(LAST>=12)for(let s=1;s<=seeds;s++){
    const camp=camps.get(s)??finaleCamp(s,{difficulty,retries});if(!camp){stopped.push({pass:3,seed:s,id:null,status:'error',reason:'The Chapter XII camp was not reached.'});continue;}
    for(const route of ROUTES){
      const state=G.deserialize(camp),open=G.finaleForecast(state).routes.some(r=>r.id===route);
      if(!open)for(const [k,v]of Object.entries(ROUTE_METERS[route]??{}))state.meters[k]=Math.max(state.meters[k],v);
      if(!G.chooseRoute(state,route).ok||!G.startEncounter(state,{controls:'realtime'}).ok||!G.isRealtime(state)){stopped.push({pass:3,seed:s,id:`route:${route}`,status:'error',reason:'Not started.'});continue;}
      for(let tries=1;;tries++){const r={seed:s,route,injected:!open,...playBattle(state,{attempt:tries}),tries};routes.push(r);onResult?.(r,3);
        if(r.status==='won'||tries>retries||!G.retry(state).ok)break;}
    }
  }
  const battles=[...new Set(runs.map(r=>r.id))].map(id=>{
    const list=runs.filter(r=>r.id===id),seen=group(list),other=group(variants.filter(r=>r.id===id)),firstWins=seen.filter(o=>o.first.status==='won');
    const within=n=>seen.filter(o=>o.tries!==null&&o.tries<=n).length;
    return {id,chapter:list[0].chapter,seeds:seen.length,firstTry:firstWins.length,within2:within(2),within3:within(3),
      deadlineLosses:list.filter(lostOnDeadline).length,otherLosses:list.filter(r=>r.status!=='won'&&!lostOnDeadline(r)).length,deadline:list[0].deadline,
      plans:[...new Set(list.flatMap(r=>r.plans??[]))].sort(),
      roundsMedian:percentile(firstWins.map(o=>o.first.rounds),.5),roundsMax:firstWins.length?Math.max(...firstWins.map(o=>o.first.rounds)):null,
      slackMin:firstWins.length?Math.min(...firstWins.map(o=>o.first.slack)):null,lossMedian:percentile(seen.map(o=>o.won?.loss).filter(n=>n!==null&&n!==undefined),.5),
      otherDecision:other.length?{decision:variants.find(r=>r.id===id).decision,operation:variants.find(r=>r.id===id).operation,seeds:other.length,firstTry:other.filter(o=>o.first.status==='won').length,
        within:other.filter(o=>o.tries!==null).length}:null,
      hidden:list.filter(r=>r.hidden>0).length,ambushes:{enemy:list.reduce((n,r)=>n+(r.ambushes?.enemy??0),0),ours:list.reduce((n,r)=>n+(r.ambushes?.ours??0),0)},
      actorsMax:Math.max(...list.map(r=>r.actors)),squadsMax:Math.max(...list.map(r=>r.squads)),
      tickP95:percentile(list.map(r=>r.tick.p95),.5),tickMax:Math.max(...list.map(r=>r.tick.max))};
  });
  const finale=ROUTES.map(route=>{const seen=group(routes.filter(r=>r.route===route)),firstWins=seen.filter(o=>o.first.status==='won');
    return {route,seeds:seen.length,firstTry:firstWins.length,within:seen.filter(o=>o.tries!==null).length,injected:seen.filter(o=>o.first.injected).length,
      roundsMedian:percentile(firstWins.map(o=>o.first.rounds),.5),roundsMin:firstWins.length?Math.min(...firstWins.map(o=>o.first.rounds)):null,
      roundsMax:firstWins.length?Math.max(...firstWins.map(o=>o.first.rounds)):null,plans:[...new Set(seen.flatMap(o=>o.first.plans??[]))].sort()};}).filter(f=>f.seeds);
  return {source:`New Game${MISSIONS?' with release 7\'s missions':' as campaigns begun before release 7\'s missions'}${OTHER?'; pass 2 with each battle\'s second operation':''}; the campaign in real time through Chapter ${LAST===12?'XII':'IX'} by legal commands (Contests by the 0.38 autoplay); each real-time battle played by the heuristic bot through legal Commands, a lost battle retried from its checkpoint up to ${retries} times`,
    difficulty,seeds,retries,seedsUsed:seed,chapters:[FIRST,LAST],otherDecisions:OTHER_DECISIONS,battles,...(finale.length?{finale}:{}),
    losses:[...runs,...variants,...routes].filter(r=>r.status!=='won'),stopped,runs,variants,...(routes.length?{routes}:{})};
}

// Release 3's targets (docs/worlds-and-gameplay-plan.md): what this run shows of each.
export function targets(report,{baseline=null}={}){
  const t=TARGETS[report.difficulty]??TARGETS.standard,out=[];
  const all=[...report.battles.map(b=>({name:b.id,seeds:b.seeds,first:b.firstTry,within:t.within===1?b.firstTry:t.within===2?b.within2:b.within3})),
    ...(report.finale??[]).map(f=>({name:`route ${f.route}`,seeds:f.seeds,first:f.firstTry,within:f.within}))];
  const first=all.reduce((n,b)=>n+b.first,0),seeds=all.reduce((n,b)=>n+b.seeds,0),within=all.reduce((n,b)=>n+b.within,0);
  out.push({target:`won on the first try ≥ ${t.first*100}%`,value:`${first}/${seeds} (${(first/seeds*100).toFixed(1)}%)`,met:first>=t.first*seeds});
  out.push({target:`won within ${t.within} ${t.within===1?'try':'tries'}: all`,value:`${within}/${seeds}`,met:within===seeds});
  const few=report.battles.filter(b=>b.plans.length<3);
  out.push({target:'at least 3 enemy plans in each battle across seeds',value:few.length?few.map(b=>`${b.id} ${b.plans.length}`).join(', '):'every battle',met:!few.length});
  const fin=(report.finale??[]).filter(f=>['battle','backer'].includes(f.route));
  if(fin.length)out.push({target:'the finale’s battle lasts 8–12 of its 16 rounds',value:fin.map(f=>`${f.route} ${f.roundsMin}–${f.roundsMax} (median ${f.roundsMedian})`).join('; '),
    met:fin.every(f=>f.roundsMin>=8&&f.roundsMax<=12)});
  if(baseline){const rises=report.battles.map(b=>{const was=baseline.battles?.find(x=>x.id===b.id)?.tickP95;return was===undefined?null:{id:b.id,rise:b.tickP95-was};}).filter(Boolean);
    const worst=rises.sort((a,b)=>b.rise-a.rise)[0];out.push({target:'tick p95 rises by at most 0.3 ms',value:worst?`${worst.id} ${worst.rise>=0?'+':''}${worst.rise.toFixed(3)} ms`:'n/a',met:!worst||worst.rise<=.3});}
  return out;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const report=sweep({onResult:(r,pass)=>console.log(`pass ${pass} seed ${String(r.seed).padStart(2)} ${String(r.route?`route:${r.route}`:r.id).padEnd(18)} try ${r.tries} ${r.status.padEnd(5)} round ${String(r.rounds).padStart(2)} of ${r.deadline}`+
    ` · ${r.weather??'—'} · ${(r.plans??[]).join(',')}${r.status==='won'?'':` — ${r.reason}${r.phase?` (${r.phase})`:''}`}`)});
  for(const s of report.stopped)console.log(`pass ${s.pass} seed ${s.seed} stopped${s.id?` at ${s.id}`:''}: ${s.reason}`);
  console.log(`\n${report.difficulty}, ${report.seeds} seeds (pass 1 used ${report.seedsUsed}), up to ${report.retries} retries`);
  console.log('Battle              first  ≤2  ≤3  rounds(med/max) deadline slack  loss  plans                               tick p95/max (ms)');
  for(const b of report.battles)console.log(`${b.id.padEnd(19)} ${String(b.firstTry).padStart(2)}/${b.seeds} ${String(b.within2).padStart(3)} ${String(b.within3).padStart(3)}  ${String(b.roundsMedian).padStart(6)}/${b.roundsMax}`+
    `       ${String(b.deadline).padStart(3)} ${String(b.slackMin).padStart(5)}  ${b.lossMedian===null?'  —  ':b.lossMedian.toFixed(2)}  ${b.plans.join(',').padEnd(34)}  ${b.tickP95.toFixed(2)}/${b.tickMax.toFixed(1)}  hidden ${b.hidden}, ambushes ${b.ambushes.enemy}:${b.ambushes.ours}`);
  for(const f of report.finale??[])console.log(`route ${f.route.padEnd(10)} ${f.firstTry}/${f.seeds} first try, ${f.within} won (${f.injected} injected), rounds ${f.roundsMin}–${f.roundsMax} (median ${f.roundsMedian}), plans ${f.plans.join(',')}`);
  const baselineFile=arg('baseline',null);let baseline=null;
  try{baseline=JSON.parse(await (await import('node:fs/promises')).readFile(baselineFile??new URL('../docs/evidence/realtime-gate4-sweep.json',import.meta.url),'utf8'));}
  catch(error){if(baselineFile)throw error;}
  const checks=targets(report,{baseline});console.log('\nTargets');for(const c of checks)console.log(`${c.met?'met    ':'NOT MET'} ${c.target}: ${c.value}`);
  if(process.argv.includes('--write')){
    const fixed=t=>t&&{p50:+t.p50.toFixed(3),p95:+t.p95.toFixed(3),max:+t.max.toFixed(2)};
    const out={...report,targets:checks,machine:'Node.js, headless, on the development container (not a phone)',runs:report.runs.map(r=>({...r,tick:fixed(r.tick)})),
      variants:report.variants.map(r=>({...r,tick:fixed(r.tick)})),losses:report.losses.map(r=>({...r,tick:fixed(r.tick)})),
      battles:report.battles.map(b=>({...b,tickP95:+b.tickP95.toFixed(3),tickMax:+b.tickMax.toFixed(2)}))};
    if(out.routes)out.routes=out.routes.map(r=>({...r,tick:fixed(r.tick)}));
    const file=`realtime-${arg('label','release4')}-sweep-${DIFFICULTY}.json`;
    await writeFile(new URL(`../docs/evidence/${file}`,import.meta.url),`${JSON.stringify(out,null,1)}\n`);console.log(`Wrote docs/evidence/${file}`);
  }
  if(checks.some(c=>!c.met))process.exitCode=1;
}

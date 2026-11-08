// One battle's first try for the release sweeps' reference players, seed by seed, as the sweep's first pass plays it
// (scripts/realtime-sweep.mjs): to measure a battle on seeds the sweeps never played, or to set two versions of the
// code side by side (run it in each). Development only; it writes nothing unless asked.
//
//   node scripts/battle-seeds.mjs --battle=ch9-wing --seeds=21-40
//   node scripts/battle-seeds.mjs --battle=ch4-wall --seeds=40 --players=veteran:issued,veteran:engaged --json=out.json
//
// For each player (difficulty:kit; by default the six of the release sweeps) it plays a campaign from New Game on each
// seed up to the battle, with the sweep's tries for that player, and records the battle's first try: won or lost, its
// rounds, the soldier's health and the squads' loss. A campaign that loses an earlier battle on every try stops there,
// and the seed is reported as stopped.
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runRealtimeCampaign} from './realtime-autoplay.mjs';
import {playBattle,TARGETS,PLAYER_TARGETS} from './realtime-sweep.mjs';

export const PLAYERS=Object.freeze(['story:bare','story:issued','standard:issued','standard:engaged','veteran:issued','veteran:engaged']);
// The retries the sweep gives a player (realtime-sweep.mjs RETRIES).
const retriesFor=(difficulty,kit)=>(PLAYER_TARGETS[difficulty]?.[kit]??TARGETS[difficulty])?.within??2;

// The battle's first try on one seed for one player, or the reason the campaign stopped before it.
export function battleOnSeed(battle,seed,difficulty,kit){
  const chapter=Number(/^ch(\d+)-/.exec(battle)?.[1]);if(!chapter)throw new Error(`Not a battle id: ${battle}`);
  const reached=new Error('reached');let first=null;
  try{
    runRealtimeCampaign({seed,difficulty,kit,throughChapter:chapter,ready:Array.from({length:chapter},(_,i)=>i+1),retries:retriesFor(difficulty,kit),missions:true,
      play:playBattle,onEncounter(state,summary){if(summary.id===battle&&summary.tries===1){first=summary;throw reached;}}});
  }catch(error){if(error!==reached)return {seed,stopped:error.message.split('\n')[0]};}
  if(!first)return {seed,stopped:`${battle} was not reached`};
  return {seed,status:first.status,rounds:first.rounds,deadline:first.deadline,slack:first.slack,heroHealth:first.heroHealth,loss:first.loss};
}

// Every seed of a range for one player, with the means over the won first tries.
export function battleSeeds(battle,{from=1,to=20,difficulty='standard',kit='issued'}={}){
  const records=[];for(let seed=from;seed<=to;seed++)records.push(battleOnSeed(battle,seed,difficulty,kit));
  const won=records.filter(r=>r.status==='won'),mean=key=>won.length?won.reduce((n,r)=>n+r[key],0)/won.length:null;
  return {battle,difficulty,kit,records,played:records.filter(r=>!r.stopped).length,won:won.length,rounds:mean('rounds'),heroHealth:mean('heroHealth'),loss:mean('loss'),
    minSlack:won.some(r=>Number.isFinite(r.slack))?Math.min(...won.filter(r=>Number.isFinite(r.slack)).map(r=>r.slack)):null,stopped:records.filter(r=>r.stopped)};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const arg=(name,fallback)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')??fallback;
  const battle=arg('battle');if(!battle){console.error('Usage: node scripts/battle-seeds.mjs --battle=<id> [--seeds=20|21-40] [--players=difficulty:kit,…] [--json=file]');process.exit(2);}
  const range=String(arg('seeds','20')),[from,to]=range.includes('-')?range.split('-').map(Number):[1,Number(range)];
  const players=String(arg('players',PLAYERS.join(','))).split(',').map(p=>p.split(':'));
  const out={battle,seeds:[from,to],players:{}};
  for(const [difficulty,kit] of players){
    const r=battleSeeds(battle,{from,to,difficulty,kit});out.players[`${difficulty}:${kit}`]=r.records;
    const pct=v=>v===null?'—':(v*100).toFixed(1);
    console.log(`${battle} ${difficulty} ${kit}: won ${r.won}/${r.played} at the first try; rounds ${r.rounds?.toFixed(2)??'—'}, soldier's health ${pct(r.heroHealth)}%, squads' loss ${pct(r.loss)}%, least slack ${r.minSlack??'—'}`);
    for(const s of r.stopped)console.log(`  seed ${s.seed} stopped: ${s.stopped}`);
  }
  const json=arg('json');if(json)writeFileSync(json,JSON.stringify(out,null,1));
}

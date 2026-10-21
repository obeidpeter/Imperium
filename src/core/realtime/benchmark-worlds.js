import {ARENA} from '../../data/realtime-rules.js';
import {createWorld,step} from './simulation.js';

// Worlds for measuring, never for play: a 15-actor skirmish on the arena's
// map (Gate 0's figure count), and a crowd at the size of the Phase 2 budget
// (§2.8: about 70 figures and 12 individuals) on an open field. Both sides
// run the simple AI, so the whole crowd moves and fights.
const LEGIONARY={side:'player',role:'infantry',path:'legionary',kit:ARENA.hero.kit,ammo:{pilum:2},ai:true,alert:true};
const RAIDER={side:'enemy',role:'raider',attributes:{str:13,agi:12,con:10,combat:8},kit:['tunic','jerkin','axe'],alert:true};

export function createSkirmishWorld(map,{seed=1,actors=15}={}){
  const friends=Math.floor(actors/2),list=[];
  for(let i=0;i<actors;i++){
    const friend=i<friends,k=friend?i:i-friends,rows=friend?friends:actors-friends,z=2+(k+.5)*16/Math.max(1,rows);
    list.push({...(friend?LEGIONARY:RAIDER),id:`${friend?'legionary':'raider'}-${k}`,name:friend?'Legionary':'Raider',at:[friend?2.2:17.8,z],face:[friend?1:-1,0]});
  }
  list[0]={...list[0],id:'hero',name:'Aurelius Marcellus',role:'soldier'};
  return createWorld({map:{...map,id:map.id??'skirmish'},seed,actors:list,controlled:'hero'});
}
export function createCrowdWorld({seed=1,actors=82}={}){
  const width=24,height=16,map={id:'crowd',width,height,terrain:Array.from({length:height},()=>Array(width).fill('grass'))},list=[],half=actors/2;
  for(let i=0;i<actors;i++){
    const friend=i<half,k=friend?i:i-half,col=k%6,row=Math.floor(k/6);
    list.push({...(friend?LEGIONARY:RAIDER),id:`${friend?'f':'e'}${k}`,name:friend?'Legionary':'Raider',at:[friend?6+col*1.2:54-col*1.2,4+row*2.4],
      face:[friend?1:-1,0]});
  }
  list[0]={...list[0],id:'hero'};
  return createWorld({map,seed,actors:list,controlled:'hero'});
}

// The tick's cost on this device (§2.8: ≤ 4 ms at p95 on a mid-range phone):
// a 15-man and an 82-man fight stepped headless until one side is gone.
const spread=times=>{const sorted=[...times].sort((a,b)=>a-b),at=p=>sorted.length?sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)]:null,
  round=n=>Number.isFinite(n)?Math.round(n*1000)/1000:null;return {ticks:sorted.length,p50:round(at(.5)),p95:round(at(.95)),max:round(sorted.at(-1))};};
export function measureTicks({now=()=>performance.now(),ticks=1200}={}){
  const time=world=>{const times=[];for(let i=0;i<ticks&&world.status==='active';i++){const t=now();step(world);times.push(now()-t);}return spread(times);};
  return {actors15:time(createCrowdWorld({seed:11,actors:15})),actors82:time(createCrowdWorld({seed:11,actors:82})),budgetMs:4};
}

import {ARENA} from '../../data/realtime-rules.js';
import {ROMAN_SQUADS} from '../../data/realtime-squads.js';
import {ARCHETYPES} from '../../data/realtime-forces.js';
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

// Gate 2's figure count (§2.8): six squads, three a side, with the soldier,
// two companions and nine single raiders, on an open field (about 60 figures).
export function createSquadWorld({seed=1}={}){
  const width=40,height=24,map={id:'squad-field',width,height,terrain:Array.from({length:height},()=>Array(width).fill('grass'))};
  const roman=(id,z,role='infantry')=>({id,name:`${id} squad`,side:'ally',role,strength:16,maxStrength:16,damage:3,at:[22,z],face:[1,0],
    member:{name:'Legionary',...ROMAN_SQUADS[role]},standing:[['advance_with_hero','hero'],['hold_line',null]]});
  const band=(id,z,role)=>{const a=ARCHETYPES.gothic[role][0];return {id,name:`${id} band`,side:'enemy',role,strength:10,maxStrength:10,damage:4,at:[70,z],face:[-1,0],
    anchor:[70,z],member:{name:`Gothic ${a.name}`,attributes:a.attributes,kit:a.kit,ammo:a.ammo??{}}};};
  const actors=[{...LEGIONARY,ai:false,id:'hero',name:'Aurelius Marcellus',role:'soldier',at:[16,30],face:[1,0]},
    {...LEGIONARY,ai:false,id:'c1',name:'Companion',role:'companion',at:[16,27],face:[1,0],standing:[['attack','nearest_enemy_to_hero'],['follow_close','hero']]},
    {...LEGIONARY,ai:false,id:'c2',name:'Companion',role:'companion',at:[16,33],face:[1,0],standing:[['throw_pilum','nearest_enemy_to_hero'],['attack','weakest_enemy'],['follow_far','hero']]},
    ...Array.from({length:9},(_,k)=>({...RAIDER,id:`r${k}`,name:'Raider',at:[78,10+k*5],face:[-1,0]}))];
  return createWorld({map,seed,actors,party:['c1','c2'],controlled:'hero',command:4,chapter:6,
    squads:[roman('s1',18),roman('s2',30),roman('s3',42),band('b1',18,'infantry'),band('b2',30,'infantry'),band('b3',42,'archer')]});
}

// The tick's cost on this device (§2.8: ≤ 4 ms at p95 on a mid-range phone):
// a 15-man and an 82-man fight, and Gate 2's six squads, stepped headless until one side is gone.
const spread=times=>{const sorted=[...times].sort((a,b)=>a-b),at=p=>sorted.length?sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)]:null,
  round=n=>Number.isFinite(n)?Math.round(n*1000)/1000:null;return {ticks:sorted.length,p50:round(at(.5)),p95:round(at(.95)),max:round(sorted.at(-1))};};
export function measureTicks({now=()=>performance.now(),ticks=1200}={}){
  const time=world=>{const times=[];for(let i=0;i<ticks&&world.status==='active';i++){const t=now();step(world);times.push(now()-t);}return spread(times);};
  return {actors15:time(createCrowdWorld({seed:11,actors:15})),actors82:time(createCrowdWorld({seed:11,actors:82})),squads6:time(createSquadWorld({seed:11})),budgetMs:4};
}

import {createWorld} from './simulation.js';
import {alive} from '../shared.js';

// The chamber as the page walks it (build brief §3.11). It is the Contest's
// 0.38 board, a place to a tile, drawn as the battlefield draws its tiles;
// its people are the Contest's (the soldier and his allied speaker, the rival
// speakers and the seated members), each carrying the 0.38 fields the stage
// reads: bloc, stance, Resolve and vote. Nothing here is a rule. The world
// only walks men to the places the 0.38 state puts them, and is rebuilt from
// that state whenever the page needs it (chamber.js says where they may go).

const TILE=2.5;
export const tilePoint=({x,y})=>({x:(x+.5)*TILE,z:(y+.5)*TILE});
export const pointTile=p=>({x:Math.floor(p.x/TILE),y:Math.floor(p.z/TILE)});
const FACING={north:[0,-1],south:[0,1],east:[1,0],west:[-1,0]};
const civic=u=>({role:u.role,bloc:u.bloc??null,stance:u.stance??null,interest:u.interest??null,vote:u.vote??null,resolve:u.resolve??null,
  maxResolve:u.maxResolve??null,blunted:!!u.blunted,withdrawn:u.role==='speaker'&&!alive(u),negotiatorId:u.negotiatorId??null,tile:{x:u.x,y:u.y}});

// A hearing's presiding magistrate stands on the tribunal at the chamber's north edge,
// facing the floor. He is no part of the Contest: he receives the evidence.
export const MAGISTRATE='magistrate';
const TRIBUNAL={height:.42};
export function createChamberWorld(state,{magistrate=false}={}){
  const e=state?.encounter;if(e?.kind!=='contest')return null;
  const spec=(id,name,side,role,at,face)=>({id,name,side,role,at,face,attributes:{str:10,agi:10,con:10,per:10,combat:2,field:4},kit:['tunic'],pace:1.6,drawn:false,ai:false});
  const specs=e.units.map(u=>{const at=tilePoint(u);return spec(u.id,u.name,u.side,u.role,[at.x,at.z],FACING[u.facing]??[u.side==='enemy'?-1:1,0]);});
  if(magistrate)specs.push(spec(MAGISTRATE,'Presiding magistrate','neutral','speaker',[e.width*TILE/2,.35],[0,1]));
  const world=createWorld({map:{id:`chamber-${e.id}`,width:e.width,height:e.height,terrain:e.terrain.map(row=>row.map(()=>'stone'))},seed:7000+state.chapter,actors:specs,
    party:e.units.some(u=>u.id==='speaker-ally')?['speaker-ally']:[],controlled:'hero',kind:'chamber',mission:null});
  for(const u of e.units)world.actors.find(a=>a.id===u.id).civic=civic(u);
  if(magistrate)Object.assign(world.actors.find(a=>a.id===MAGISTRATE),{civic:{role:MAGISTRATE,bloc:null,stance:null,withdrawn:false,tile:null},stand:TRIBUNAL.height});
  world.title=e.title;world.contestId=e.id;world.chapter=state.chapter;
  return world;
}

// A walk on the chamber floor from one place to another, round the people standing
// and sitting there (four ways, as 0.38 counts a move): the places' centres, or
// a straight line when nothing is in the way. The page previews it on hover.
export function walkRoute(e,from,to,id){
  const key=p=>`${p.x},${p.y}`,taken=new Set(e.units.filter(u=>u.id!==id&&alive(u)).map(key)),seen=new Map([[key(from),null]]),queue=[from];
  while(queue.length){
    const p=queue.shift();if(p.x===to.x&&p.y===to.y)break;
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
      const q={x:p.x+dx,y:p.y+dy};if(q.x<0||q.y<0||q.x>=e.width||q.y>=e.height||seen.has(key(q))||taken.has(key(q))&&!(q.x===to.x&&q.y===to.y))continue;
      seen.set(key(q),p);queue.push(q);
    }
  }
  if(!seen.has(key(to)))return [tilePoint(to)];
  const out=[];for(let p=to;p&&!(p.x===from.x&&p.y===from.y);p=seen.get(key(p)))out.unshift(tilePoint(p));return out;
}
// Bring the world to the 0.38 state: each man's bloc, stance and Resolve, and a walk
// for each whose place has changed. Returns who walks.
export function syncChamberWorld(world,state){
  const e=state?.encounter;if(!world||e?.kind!=='contest')return [];const walkers=[];
  for(const u of e.units){
    const a=world.actors.find(x=>x.id===u.id);if(!a)continue;const was=a.civic?.tile;a.civic=civic(u);
    if(was&&(was.x!==u.x||was.y!==u.y)){
      a.path=walkRoute(e,was,u,u.id);a.order={kind:'move'};a.goal={...tilePoint(u)};a.gait='walk';walkers.push(u.id);
    }
  }
  return walkers;
}
// Every man at once where the 0.38 state puts him (a skipped walk; a reload).
export function placeChamberWorld(world,state){
  for(const u of state.encounter.units){const a=world.actors.find(x=>x.id===u.id);if(!a)continue;const p=tilePoint(u);
    Object.assign(a,{x:p.x,z:p.z,px:p.x,pz:p.z,path:[],order:null,goal:null,gait:null,moving:false});a.civic=civic(u);}
}
// The members dividing at the vote (discessio): each walks to stand behind the
// speaker whose side he took; the speakers stay.
export function discessio(world,state){
  const e=state.encounter,hero=e.units.find(u=>u.id==='hero'),rival=e.units.find(u=>u.side==='enemy'&&u.role==='speaker');
  const sides={for:[],against:[]};for(const u of e.units.filter(u=>u.role==='voter'))sides[u.stance>=1?'for':'against'].push(u);
  for(const [side,members]of Object.entries(sides)){
    const lead=side==='for'?hero:rival;if(!lead)continue;const at=tilePoint(lead),back=side==='for'?-1:1;
    members.forEach((m,i)=>{const a=world.actors.find(x=>x.id===m.id);if(!a)return;const row=Math.floor(i/3)+1,col=i%3-1;
      const goal={x:Math.max(.6,Math.min(world.map.width*TILE-.6,at.x+back*row*1.2)),z:Math.max(.6,Math.min(world.map.height*TILE-.6,at.z+col*1.1))};
      Object.assign(a,{path:[goal],order:{kind:'move'},goal,gait:'walk'});});
  }
}

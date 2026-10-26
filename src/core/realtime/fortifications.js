import {invalidateGrid,navGrid,nearestWalkable,cellCentre,findRoute,span,TILE} from './navigation.js';
import {TIME} from '../../data/realtime-rules.js';

// Fortifications are simulation records. Their cells, elevation and work state
// are also the renderer's source: no decorative route can contradict this map.
const live=a=>a.alive&&!a.down&&!a.carriedBy;
const emit=(w,e)=>w.events.push({tick:w.tick,...e});
const cellKey=(x,y)=>`${x},${y}`;
const inside=(w,x,y)=>x>=0&&y>=0&&x<w.map.width&&y<w.map.height;
export const FORTIFICATION_WORK=Object.freeze({breach:2,countermine:2,'siege-engine':2});
export const fortifiedGate=o=>o.kind==='gate'&&o.fortified===true;

export function gateOccupied(world,gate){
  return (gate.cells??[]).some(([x,y])=>world.actors.some(a=>live(a)&&
    a.x>=(x*TILE-.45)&&a.x<=((x+1)*TILE+.45)&&a.z>=(y*TILE-.45)&&a.z<=((y+1)*TILE+.45)));
}
export function changeStructureCells(world,cells,type){
  for(const [x,y]of cells)world.map.terrain[y][x]=type;
  invalidateGrid(world.map);world.map.rev=(world.map.rev??0)+1;
  // Forget geometry, not intent: orders and destinations survive a closed
  // passage and resume if it opens again. Formation routes share that map.
  for(const a of world.actors){a.path=[];a.slotPath=null;a.gait=null;a.repathAt=world.tick;}
  for(const q of world.squads??[]){q.path=[];q.gait=null;q.moving=false;}
}
export function closeFortifiedGate(world,gate,actorId=null){
  if(!fortifiedGate(gate)||gate.state!=='open'||gateOccupied(world,gate))return false;
  gate.state='closed';gate.done=false;changeStructureCells(world,gate.cells,'wall');
  emit(world,{kind:'field',objectId:gate.id,what:'gate-closed',actorId});return true;
}
export function fortificationVerb(o){
  if(o.kind==='breach'&&o.state==='intact')return `Breach wall (${o.progress??0}/${o.required})`;
  if(o.kind==='countermine'&&o.state==='active')return `Shore the countermine (${o.progress??0}/${o.required})`;
  if(o.kind==='siege-engine'&&o.state==='active')return `Disable siege works (${o.progress??0}/${o.required})`;
  return null;
}
export function fortificationHint(world,o){
  if(o.kind==='breach')return 'Up to two uninterrupted work actions open a permanent rubble passage for both armies. Engineer support completes it in one.';
  if(o.kind==='countermine')return 'Up to two work actions stop the enemy mine and protect the line. Engineer support completes it in one. A hit interrupts work.';
  if(o.kind==='siege-engine')return 'Up to two work actions stop these works and can delay the next reserve. Engineer support completes it in one.';
  return null;
}
export function workFortification(world,actor,o){
  if(!fortificationVerb(o))return false;
  const detail=world.squads?.find(q=>q.side!=='enemy'&&q.role==='engineer'&&!q.broken&&q.strength>0&&
    world.actors.some(a=>q.members.includes(a.id)&&live(a)&&span(a.x-actor.x,a.z-actor.z)<=8));
  const engineer=actor.effects?.engineering||world.engineering||detail;
  o.progress=Math.min(o.required,(o.progress??0)+(engineer?2:1));
  if(o.progress<o.required){emit(world,{kind:'field',objectId:o.id,what:'works-progress',actorId:actor.id});return true;}
  o.done=true;o.state=o.kind==='breach'?'breached':'disabled';
  if(o.kind==='breach')changeStructureCells(world,o.cells,'rubble');
  if(o.kind==='siege-engine'){
    const wave=world.mission?.waves.find(w=>!w.arrived);
    if(wave)wave.round=Math.max(wave.round,Math.min(world.mission.deadline-1,wave.round+1));
  }
  if(world.fortifications){world.fortifications.secured.push(o.id);world.fortifications.revision++;}
  emit(world,{kind:'field',objectId:o.id,what:o.kind==='breach'?'wall-breached':'works-disabled',actorId:actor.id});return true;
}

// Build one meaningful engineering position from existing authored walls. It
// never removes an existing passage or places an object on a protected actor.
export function installFortifications(world,{chapter=world.chapter,encounterId=world.encounterId}={}){
  if(world.kind!=='field'||world.practice||chapter<4||!world.field)return;
  const gates=world.objects.filter(o=>o.field&&o.kind==='gate');
  for(const gate of gates){gate.fortified=true;gate.toggle=gate.state!=='breached';}
  const gateCells=new Set(gates.flatMap(g=>(g.cells??[]).map(([x,y])=>cellKey(x,y))));
  const wallCells=[];
  for(let y=1;y<world.map.height-1;y++)for(let x=1;x<world.map.width-1;x++)
    if(world.map.terrain[y][x]==='wall'&&!gateCells.has(cellKey(x,y)))wallCells.push([x,y]);
  if(!wallCells.length&&!gates.length)return;
  const material=[5,6,9].includes(chapter)?'mudbrick':chapter>=7?'stone':'timber';
  const record=world.fortifications={version:1,material,walls:wallCells.slice(0,512),platforms:[],secured:[],revision:0};
  const hero=world.actors.find(a=>a.id===world.heroId);
  const grid=navGrid(world.map),nearHero=([x,y])=>span((x+.5)*TILE-hero.x,(y+.5)*TILE-hero.z);
  const reachable=(x,y)=>!findRoute(navGrid(world.map),hero,{x:(x+.5)*TILE,z:(y+.5)*TILE}).reasonCode;
  const wallSet=new Set(wallCells.map(([x,y])=>cellKey(x,y)));
  const candidates=wallCells.filter(([x,y])=>
    [['west',x-1,y,x+1,y],['north',x,y-1,x,y+1]].some(([,ax,ay,bx,by])=>
      inside(world,ax,ay)&&inside(world,bx,by)&&!['wall','river','rock'].includes(world.map.terrain[ay][ax])&&!['wall','river','rock'].includes(world.map.terrain[by][bx])));
  candidates.sort((a,b)=>nearHero(a)-nearHero(b)||a[1]-b[1]||a[0]-b[0]);
  const target=candidates[0];
  if(target){
    const [x,y]=target,vertical=wallSet.has(cellKey(x,y-1))||wallSet.has(cellKey(x,y+1));
    const cells=[target,...(vertical?[[x,y-1],[x,y+1]]:[[x-1,y],[x+1,y]])].filter(([a,b])=>wallSet.has(cellKey(a,b)));
    const approach=[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>inside(world,a,b)&&!['wall','river','rock'].includes(world.map.terrain[b][a])&&reachable(a,b)).sort((a,b)=>nearHero(a)-nearHero(b))[0];
    const index=approach?nearestWalkable(grid,(approach[0]+.5)*TILE,(approach[1]+.5)*TILE):-1,point=index>=0?cellCentre(grid,index):null;
    if(point)world.objects.push({id:'fort-wall',kind:'breach',name:'Weakened curtain wall',...point,field:true,work_s:4,state:'intact',done:false,
      rounds:0,progress:0,required:2,cells,orientation:vertical?'vertical':'horizontal',tile:{x,y}});
    // One accessible fighting platform beside the wall, with an approach step.
    // Both levels are explicit in the saved grid; actors and missile forecasts
    // use the same heights as the stage.
    const free=(a,b)=>inside(world,a,b)&&['grass','sand','stone'].includes(world.map.terrain[b][a])&&
      !world.actors.some(o=>Math.floor(o.x/TILE)===a&&Math.floor(o.z/TILE)===b)&&
      !world.objects.some(o=>Math.floor(o.x/TILE)===a&&Math.floor(o.z/TILE)===b);
    const site=candidates.flatMap(([a,b])=>{
      const vertical=wallSet.has(cellKey(a,b-1))||wallSet.has(cellKey(a,b+1));
      return [-1,1].map(sign=>{const dx=vertical?sign:0,dy=vertical?0:sign;return {px:a+dx,py:b+dy,sx:a+dx*2,sy:b+dy*2,vertical};});
    }).find(p=>free(p.px,p.py)&&free(p.sx,p.sy)&&reachable(p.sx,p.sy));
    if(site){
      const {px,py,sx,sy}=site;
      world.map.terrain[py][px]='high';world.map.terrain[sy][sx]='stone';
      world.map.elevations=[[px,py,3.2],[sx,sy,1.6]];
      record.platforms.push({x:px,y:py,height:3.2,steps:[sx,sy],orientation:site.vertical?'vertical':'horizontal'});
      invalidateGrid(world.map);
    }
  }
  if(chapter===5&&/mine|wall|gate/.test(encounterId??'')){
    const enemy=world.actors.filter(a=>a.side==='enemy'&&!a.hidden).sort((a,b)=>span(a.x-hero.x,a.z-hero.z)-span(b.x-hero.x,b.z-hero.z))[0];
    for(const [i,kind,name]of [[0,'countermine','Countermine timbering'],[1,'siege-engine','Persian siege ramp']]){
      const reference=i&&enemy?{x:(hero.x+enemy.x)/2,z:(hero.z+enemy.z)/2}:hero;
      const g=navGrid(world.map),taken=new Set([...world.objects,...world.actors].map(o=>cellKey(Math.floor(o.x/TILE),Math.floor(o.z/TILE)))),sites=[];
      for(let y=1;y<world.map.height-1;y++)for(let x=1;x<world.map.width-1;x++)if(!taken.has(cellKey(x,y))&&['grass','sand','stone'].includes(world.map.terrain[y][x]))sites.push([x,y]);
      sites.sort((a,b)=>span((a[0]+.5)*TILE-reference.x,(a[1]+.5)*TILE-reference.z)-span((b[0]+.5)*TILE-reference.x,(b[1]+.5)*TILE-reference.z)||a[1]-b[1]||a[0]-b[0]);
      const site=sites.find(([x,y])=>reachable(x,y));if(!site)continue;
      const index=nearestWalkable(g,(site[0]+.5)*TILE,(site[1]+.5)*TILE);if(index<0)continue;
      const point=cellCentre(g,index);
      world.objects.push({id:`fort-${kind}`,kind,name,...point,field:true,work_s:4,state:'active',done:false,rounds:0,progress:0,required:2,
        pressure:0,tile:{x:Math.floor(point.x/TILE),y:Math.floor(point.z/TILE)}});
    }
  }
}

export function fortificationRound(world){
  if(!world.fortifications||world.status!=='active')return;
  const round=Math.floor((world.tick+1)/TIME.roundTicks);
  for(const o of world.objects)if(['countermine','siege-engine'].includes(o.kind)&&o.state==='active'){
    o.pressure=Math.min(100,(o.pressure??0)+(o.kind==='countermine'?20:15));
    if(round>=4&&o.pressure>=60&&world.mission){
      world.mission.defence=Math.max(0,world.mission.defence-4);
      emit(world,{kind:'field',objectId:o.id,what:'siege-pressure',amount:4});
    }
  }
}

export function validateFortifications(world,fail){
  const f=world.fortifications;if(f===undefined){if(world.objects.some(o=>Object.hasOwn(FORTIFICATION_WORK,o.kind))||world.map.elevations!==undefined)fail('unrecorded engineering work.');return;}
  const cell=c=>Array.isArray(c)&&c.length===2&&c.every(Number.isInteger)&&inside(world,c[0],c[1]);
  if(!f||f.version!==1||!['stone','mudbrick','timber'].includes(f.material)||!Array.isArray(f.walls)||f.walls.length>512||!f.walls.every(cell)||
    !Array.isArray(f.platforms)||f.platforms.length>16||f.platforms.some(p=>!p||!cell([p.x,p.y])||!cell(p.steps)||p.height!==3.2)||
    !Array.isArray(f.secured)||f.secured.length>16||new Set(f.secured).size!==f.secured.length||f.secured.some(id=>typeof id!=='string'||!world.objects.some(o=>o.id===id&&o.done&&Object.hasOwn(FORTIFICATION_WORK,o.kind)))||
    !Number.isInteger(f.revision)||f.revision<0||f.revision>100)fail('real-time fortifications.');
  for(const o of world.objects)if(Object.hasOwn(FORTIFICATION_WORK,o.kind)){
    if(!Number.isInteger(o.progress)||o.progress<0||o.progress>2||o.required!==2||
      (o.pressure!==undefined&&(!Number.isInteger(o.pressure)||o.pressure<0||o.pressure>100))||
      (o.kind==='breach'&&(!Array.isArray(o.cells)||!o.cells.length||!o.cells.every(cell)))||
      o.done!==(o.progress===2)||o.state!==(o.progress===2?(o.kind==='breach'?'breached':'disabled'):(o.kind==='breach'?'intact':'active'))||
      o.done!==f.secured.includes(o.id))fail('real-time engineering work.');
    if(o.kind==='breach'&&o.cells.some(([x,y])=>world.map.terrain[y][x]!== (o.done?'rubble':'wall')))fail('engineering passage disagrees with the map.');
  }
  for(const p of f.platforms)if(!world.map.elevations?.some(([x,y,h])=>x===p.x&&y===p.y&&h===p.height)||!world.map.elevations?.some(([x,y,h])=>x===p.steps[0]&&y===p.steps[1]&&h===1.6))fail('fortified platform disagrees with the map.');
}

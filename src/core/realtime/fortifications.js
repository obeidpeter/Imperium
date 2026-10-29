import {invalidateGrid,navGrid,nearestWalkable,cellCentre,findRoute,span,TILE} from './navigation.js';
import {TIME} from '../../data/realtime-rules.js';
import {STRUCTURES,STRUCTURE_HEIGHTS} from '../../data/structures.js';
import {BATTLE_STRUCTURES} from '../../data/battle-structures.js';

// Fortifications are simulation records. Their cells, elevation and work state
// are also the renderer's source: no decorative route can contradict this map.
const live=a=>a.alive&&!a.down&&!a.carriedBy;
const emit=(w,e)=>w.events.push({tick:w.tick,...e});
const cellKey=(x,y)=>`${x},${y}`;
const inside=(w,x,y)=>x>=0&&y>=0&&x<w.map.width&&y<w.map.height;
const DIRS=Object.freeze({east:[1,0],west:[-1,0],south:[0,1],north:[0,-1]});
// Ground a structure may be built on: no wall, water, rock or existing work.
const OPEN=new Set(['grass','sand','stone']);
export const FORTIFICATION_WORK=Object.freeze({breach:2,countermine:2,'siege-engine':2});
export const fortifiedGate=o=>o.kind==='gate'&&o.fortified===true;
// A fortified bridge, once repaired, can be demolished again (Shift: forced work).
export const demolishable=o=>o.kind==='bridge'&&o.fortified===true&&o.state==='repaired';
// Who holds a gate: the enemy, or the side of the soldier and his allies.
const sideOf=actor=>actor?.side==='enemy'?'enemy':'ally';
// A gate held by the other side is battered, never opened.
export const heldAgainst=(gate,actor=null)=>fortifiedGate(gate)&&gate.state==='closed'&&!!gate.holder&&gate.holder!==sideOf(actor);

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
// Closing a fortified gate bars it for the side that closes it.
export function closeFortifiedGate(world,gate,actorId=null){
  if(!fortifiedGate(gate)||gate.state!=='open'||gateOccupied(world,gate))return false;
  const actor=actorId?world.actors.find(a=>a.id===actorId):null;
  gate.state='closed';gate.done=false;changeStructureCells(world,gate.cells,'wall');
  if(actor){gate.holder=sideOf(actor);gate.integrity=STRUCTURES.gate.integrity+STRUCTURES.gate.bar;}
  emit(world,{kind:'field',objectId:gate.id,what:'gate-closed',actorId});return true;
}
// An engineer detail within 8 m, the company's engineering or the soldier's own:
// work goes twice as fast, and against a gate the detail's ram strikes twice as hard.
function engineerSupport(world,actor){
  return !!(actor.effects?.engineering||world.engineering||world.squads?.some(q=>q.side!=='enemy'&&q.role==='engineer'&&!q.broken&&q.strength>0&&
    world.actors.some(a=>q.members.includes(a.id)&&live(a)&&span(a.x-actor.x,a.z-actor.z)<=8)));
}
export function batterGate(world,actor,gate){
  if(!heldAgainst(gate,actor))return false;
  breakGate(world,gate,STRUCTURES.gate.batter*(engineerSupport(world,actor)?STRUCTURES.gate.ram:1),actor.id);return true;
}
// A blow on a closed gate: its integrity falls, and at 0 it is a breach for both armies (rubble).
// The soldier's battering above, or the enemy's ram (field-missions.js), whose blows have no actor.
export function breakGate(world,gate,amount,actorId=null){
  gate.integrity=Math.max(0,gate.integrity-amount);
  if(gate.integrity>0){emit(world,{kind:'field',objectId:gate.id,what:'gate-battered',actorId,integrity:gate.integrity});return;}
  gate.state='breached';gate.done=true;gate.toggle=false;gate.holder=null;changeStructureCells(world,gate.cells,'rubble');
  if(world.fortifications)world.fortifications.revision++;
  emit(world,{kind:'field',objectId:gate.id,what:'gate-breached',actorId});
}
export function demolishBridge(world,actor,bridge){
  if(!demolishable(bridge))return false;
  bridge.progress=Math.min(STRUCTURES.bridge.demolish,(bridge.progress??0)+(engineerSupport(world,actor)?2:1));
  if(bridge.progress<STRUCTURES.bridge.demolish){emit(world,{kind:'field',objectId:bridge.id,what:'works-progress',actorId:actor.id});return true;}
  bridge.state='demolished';bridge.done=true;bridge.toggle=false;changeStructureCells(world,bridge.cells,'river');
  if(world.fortifications)world.fortifications.revision++;
  emit(world,{kind:'field',objectId:bridge.id,what:'bridge-demolished',actorId:actor.id});return true;
}
export function fortificationVerb(o){
  if(o.kind==='breach'&&o.state==='intact')return `Breach wall (${o.progress??0}/${o.required})`;
  if(o.kind==='countermine'&&o.state==='active')return `Shore the countermine (${o.progress??0}/${o.required})`;
  if(o.kind==='siege-engine'&&o.state==='active')return `Disable the siege ramp (${o.progress??0}/${o.required})`;
  return null;
}
export function fortificationHint(world,o){
  if(o.kind==='breach')return 'Up to two uninterrupted work actions open a permanent rubble passage for both armies. Engineer support completes it in one.';
  if(o.kind==='countermine')return 'Up to two work actions stop the enemy mine and protect the line. Engineer support completes it in one. A hit interrupts work.';
  if(o.kind==='siege-engine')return 'Up to two work actions stop the ramp and can delay the next reserve. Engineer support completes it in one.';
  return null;
}
export function workFortification(world,actor,o){
  if(!fortificationVerb(o))return false;
  o.progress=Math.min(o.required,(o.progress??0)+(engineerSupport(world,actor)?2:1));
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

// --- Building the works --------------------------------------------------------
const offsets=list=>{const out=[0];for(const v of list)out.push(out.at(-1)+v);return out;};
// The cells of a 0.38 board tile on the battle's 2.5 m map.
function tileCells(world,[tx,ty]){
  const ox=offsets(world.layout.kx),oy=offsets(world.layout.ky),cells=[];
  if(!(tx>=0&&ty>=0&&tx<world.layout.kx.length&&ty<world.layout.ky.length))return cells;
  for(let y=oy[ty];y<oy[ty+1];y++)for(let x=ox[tx];x<ox[tx+1];x++)cells.push([x,y]);
  return cells;
}
const terrainOf=(world,x,y)=>world.map.terrain[y][x];
const occupied=(world,x,y)=>[...world.actors,...world.objects].some(o=>Math.floor(o.x/TILE)===x&&Math.floor(o.z/TILE)===y);
function addElevations(world,entries){
  const known=new Map((world.map.elevations??[]).map(e=>[cellKey(e[0],e[1]),e]));
  for(const e of entries)known.set(cellKey(e[0],e[1]),e);
  world.map.elevations=[...known.values()];
}
// A tower: the end of the tile's curtain toward `at`, its stair beside it toward `stair`.
function placeTower(world,record,{tile,at,stair}){
  const walls=tileCells(world,tile).filter(([x,y])=>terrainOf(world,x,y)==='wall');if(!walls.length)return false;
  const [dx,dy]=DIRS[stair],[ax,ay]=DIRS[at],reach=([x,y])=>x*ax+y*ay,toward=([x,y])=>x*dx+y*dy;
  const end=Math.max(...walls.map(reach)),[px,py]=walls.filter(c=>reach(c)===end).sort((a,b)=>toward(b)-toward(a))[0],sx=px+dx,sy=py+dy;
  if(!inside(world,sx,sy)||!OPEN.has(terrainOf(world,sx,sy))||occupied(world,sx,sy))return false;
  world.map.terrain[py][px]='high';world.map.terrain[sy][sx]='stone';
  addElevations(world,[[px,py,STRUCTURES.tower.deck],[sx,sy,STRUCTURES.tower.stair]]);
  record.walls=record.walls.filter(([x,y])=>x!==px||y!==py);
  record.platforms.push({x:px,y:py,height:STRUCTURES.tower.deck,steps:[sx,sy],orientation:dx?'vertical':'horizontal'});
  return true;
}
// A breach: the middle of the tile's curtain across its whole thickness, worked from `approach`.
function placeBreach(world,{tile,approach}){
  const walls=tileCells(world,tile).filter(([x,y])=>terrainOf(world,x,y)==='wall');if(!walls.length)return false;
  const [dx,dy]=DIRS[approach],along=dx?([,y])=>y:([x])=>x,values=[...new Set(walls.map(along))].sort((a,b)=>a-b);
  const count=Math.min(2,values.length),rows=values.slice(Math.floor((values.length-count)/2),Math.floor((values.length-count)/2)+count);
  const cells=walls.filter(c=>rows.includes(along(c)));
  // The work is done from the first open cell beyond the curtain on the approach side.
  const across=dx?([x])=>x:([,y])=>y,edge=(dx||dy)<0?Math.min(...cells.map(across))-1:Math.max(...cells.map(across))+1;
  const [wx,wy]=dx?[edge,rows[0]]:[rows[0],edge];
  if(!inside(world,wx,wy)||!OPEN.has(terrainOf(world,wx,wy)))return false;
  const grid=navGrid(world.map),index=nearestWalkable(grid,(wx+.5)*TILE,(wy+.5)*TILE);if(index<0)return false;
  world.objects.push({id:'fort-wall',kind:'breach',name:'Weakened curtain wall',...cellCentre(grid,index),field:true,work_s:4,state:'intact',done:false,
    rounds:0,progress:0,required:2,cells,orientation:dx?'vertical':'horizontal',tile:{x:wx,y:wy}});
  return true;
}
// A rampart along the tiles' face edge with its ditch beyond, or a ditch alone
// along that edge (the berm before a curtain); a road stays open as a causeway.
function placeEarthworks(world,record,{tiles,face},{rampart}){
  const [dx,dy]=DIRS[face],bank=[],ditch=[],open=(x,y)=>inside(world,x,y)&&OPEN.has(terrainOf(world,x,y))&&!occupied(world,x,y);
  for(const tile of tiles){
    const cells=tileCells(world,tile);if(!cells.length)continue;
    const edge=Math.max(...cells.map(([x,y])=>x*dx+y*dy));
    for(const [x,y]of cells.filter(c=>c[0]*dx+c[1]*dy===edge)){
      if(!open(x,y))continue;
      if(!rampart){ditch.push([x,y]);continue;}
      bank.push([x,y]);if(open(x+dx,y+dy))ditch.push([x+dx,y+dy]);
    }
  }
  for(const [x,y]of bank)world.map.terrain[y][x]='high';
  for(const [x,y]of ditch)world.map.terrain[y][x]='ditch';
  addElevations(world,[...bank.map(([x,y])=>[x,y,STRUCTURES.rampart.height]),...ditch.map(([x,y])=>[x,y,STRUCTURES.ditch.depth])]);
  if(bank.length)record.ramparts.push({cells:bank,face});
  record.ditches.push(...ditch);
}

// Build the battle's works: authored where battle-structures.js lists the battle,
// else one meaningful engineering position from existing authored walls. Neither
// removes an existing passage or places an object on a protected actor.
export function installFortifications(world,{chapter=world.chapter,encounterId=world.encounterId}={}){
  if(world.kind!=='field'||world.practice||chapter<4||!world.field)return;
  const gates=world.objects.filter(o=>o.field&&o.kind==='gate'),bridges=world.objects.filter(o=>o.field&&o.kind==='bridge');
  const authored=world.layout?BATTLE_STRUCTURES[encounterId]:undefined;
  for(const gate of gates){gate.fortified=true;gate.toggle=gate.state!=='breached';gate.holder=null;gate.integrity=STRUCTURES.gate.integrity;
    if(authored?.gates?.holder==='enemy'&&gate.state==='closed'){gate.holder='enemy';gate.integrity+=STRUCTURES.gate.bar;}}
  const gateCells=new Set(gates.flatMap(g=>(g.cells??[]).map(([x,y])=>cellKey(x,y))));
  const wallCells=[];
  for(let y=1;y<world.map.height-1;y++)for(let x=1;x<world.map.width-1;x++)
    if(world.map.terrain[y][x]==='wall'&&!gateCells.has(cellKey(x,y)))wallCells.push([x,y]);
  if(!wallCells.length&&!gates.length&&!bridges.length&&!authored)return;
  for(const bridge of bridges){bridge.fortified=true;bridge.toggle=bridge.state==='repaired';}
  const material=[5,6,9].includes(chapter)?'mudbrick':chapter>=7?'stone':'timber';
  const record=world.fortifications={version:2,material,walls:wallCells.slice(0,512),platforms:[],ramparts:[],ditches:[],secured:[],revision:0};
  if(authored){
    for(const tower of authored.towers??[])placeTower(world,record,tower);
    if(authored.breach)placeBreach(world,authored.breach);
    for(const r of authored.ramparts??[])placeEarthworks(world,record,r,{rampart:true});
    for(const d of authored.ditches??[])placeEarthworks(world,record,d,{rampart:false});
    invalidateGrid(world.map);
  }else genericPosition(world,record,wallCells);
  const hero=world.actors.find(a=>a.id===world.heroId);
  const reachable=(x,y)=>!findRoute(navGrid(world.map),hero,{x:(x+.5)*TILE,z:(y+.5)*TILE}).reasonCode;
  if(chapter===5&&/mine|wall|gate/.test(encounterId??'')){
    const enemy=world.actors.filter(a=>a.side==='enemy'&&!a.hidden).sort((a,b)=>span(a.x-hero.x,a.z-hero.z)-span(b.x-hero.x,b.z-hero.z))[0];
    for(const [i,kind,name]of [[0,'countermine','Countermine timbering'],[1,'siege-engine','Persian siege ramp']]){
      const reference=i&&enemy?{x:(hero.x+enemy.x)/2,z:(hero.z+enemy.z)/2}:hero;
      const g=navGrid(world.map),taken=new Set([...world.objects,...world.actors].map(o=>cellKey(Math.floor(o.x/TILE),Math.floor(o.z/TILE)))),sites=[];
      for(let y=1;y<world.map.height-1;y++)for(let x=1;x<world.map.width-1;x++)if(!taken.has(cellKey(x,y))&&OPEN.has(world.map.terrain[y][x]))sites.push([x,y]);
      sites.sort((a,b)=>span((a[0]+.5)*TILE-reference.x,(a[1]+.5)*TILE-reference.z)-span((b[0]+.5)*TILE-reference.x,(b[1]+.5)*TILE-reference.z)||a[1]-b[1]||a[0]-b[0]);
      const site=sites.find(([x,y])=>reachable(x,y));if(!site)continue;
      const index=nearestWalkable(g,(site[0]+.5)*TILE,(site[1]+.5)*TILE);if(index<0)continue;
      const point=cellCentre(g,index);
      world.objects.push({id:`fort-${kind}`,kind,name,...point,field:true,work_s:4,state:'active',done:false,rounds:0,progress:0,required:2,
        pressure:0,tile:{x:Math.floor(point.x/TILE),y:Math.floor(point.z/TILE)}});
    }
  }
}
// The generic position for a field with walls but no authored works: a breach
// in the curtain nearest the soldier and one fighting platform beside it.
function genericPosition(world,record,wallCells){
  const hero=world.actors.find(a=>a.id===world.heroId);
  const grid=navGrid(world.map),nearHero=([x,y])=>span((x+.5)*TILE-hero.x,(y+.5)*TILE-hero.z);
  const reachable=(x,y)=>!findRoute(navGrid(world.map),hero,{x:(x+.5)*TILE,z:(y+.5)*TILE}).reasonCode;
  const wallSet=new Set(wallCells.map(([x,y])=>cellKey(x,y)));
  const candidates=wallCells.filter(([x,y])=>
    [['west',x-1,y,x+1,y],['north',x,y-1,x,y+1]].some(([,ax,ay,bx,by])=>
      inside(world,ax,ay)&&inside(world,bx,by)&&!['wall','river','rock'].includes(world.map.terrain[ay][ax])&&!['wall','river','rock'].includes(world.map.terrain[by][bx])));
  candidates.sort((a,b)=>nearHero(a)-nearHero(b)||a[1]-b[1]||a[0]-b[0]);
  const target=candidates[0];if(!target)return;
  const [x,y]=target,vertical=wallSet.has(cellKey(x,y-1))||wallSet.has(cellKey(x,y+1));
  const cells=[target,...(vertical?[[x,y-1],[x,y+1]]:[[x-1,y],[x+1,y]])].filter(([a,b])=>wallSet.has(cellKey(a,b)));
  const approach=[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>inside(world,a,b)&&!['wall','river','rock'].includes(world.map.terrain[b][a])&&reachable(a,b)).sort((a,b)=>nearHero(a)-nearHero(b))[0];
  const index=approach?nearestWalkable(grid,(approach[0]+.5)*TILE,(approach[1]+.5)*TILE):-1,point=index>=0?cellCentre(grid,index):null;
  if(point)world.objects.push({id:'fort-wall',kind:'breach',name:'Weakened curtain wall',...point,field:true,work_s:4,state:'intact',done:false,
    rounds:0,progress:0,required:2,cells,orientation:vertical?'vertical':'horizontal',tile:{x,y}});
  // One accessible fighting platform beside the wall, with an approach step.
  // Both levels are explicit in the saved grid; actors and missile forecasts
  // use the same heights as the stage.
  const free=(a,b)=>inside(world,a,b)&&OPEN.has(world.map.terrain[b][a])&&!occupied(world,a,b);
  const site=candidates.flatMap(([a,b])=>{
    const vertical=wallSet.has(cellKey(a,b-1))||wallSet.has(cellKey(a,b+1));
    return [-1,1].map(sign=>{const dx=vertical?sign:0,dy=vertical?0:sign;return {px:a+dx,py:b+dy,sx:a+dx*2,sy:b+dy*2,vertical};});
  }).find(p=>free(p.px,p.py)&&free(p.sx,p.sy)&&reachable(p.sx,p.sy));
  if(site){
    const {px,py,sx,sy}=site;
    world.map.terrain[py][px]='high';world.map.terrain[sy][sx]='stone';
    addElevations(world,[[px,py,STRUCTURES.tower.deck],[sx,sy,STRUCTURES.tower.stair]]);
    record.platforms.push({x:px,y:py,height:STRUCTURES.tower.deck,steps:[sx,sy],orientation:site.vertical?'vertical':'horizontal'});
    invalidateGrid(world.map);
  }
}

// --- What the works give: a tower's deck and a rampart's breastwork --------------
const deckAt=(world,x,z)=>(world.fortifications?.platforms??[]).find(p=>p.x===Math.floor(x/TILE)&&p.y===Math.floor(z/TILE))??null;
// Whether a man stands on a tower's deck.
export const onTower=(world,p)=>!!deckAt(world,p.x,p.z);
// The rampart under a point, or null.
export function rampartAt(world,p){
  const x=Math.floor(p.x/TILE),y=Math.floor(p.z/TILE);
  return (world.fortifications?.ramparts??[]).find(r=>r.cells.some(c=>c[0]===x&&c[1]===y))??null;
}
// Whether `from` lies beyond the face of the rampart under `p`: the breastwork stands between them.
export function behindBreastwork(world,p,from){
  const r=rampartAt(world,p);if(!r)return false;
  const [dx,dy]=DIRS[r.face],x=Math.floor(p.x/TILE),y=Math.floor(p.z/TILE);
  return dx?(from.x-(x+(dx>0?1:0))*TILE)*dx>0:(from.z-(y+(dy>0?1:0))*TILE)*dy>0;
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

const GATE_STATES=new Set(['open','closed','breached']);
export function validateFortifications(world,fail){
  const f=world.fortifications;
  if(f===undefined){if(world.objects.some(o=>Object.hasOwn(FORTIFICATION_WORK,o.kind)||o.fortified!==undefined)||world.map.elevations!==undefined)fail('unrecorded engineering work.');return;}
  const cell=c=>Array.isArray(c)&&c.length===2&&c.every(Number.isInteger)&&inside(world,c[0],c[1]);
  if(!f||f.version!==2||!['stone','mudbrick','timber'].includes(f.material)||!Array.isArray(f.walls)||f.walls.length>512||!f.walls.every(cell)||
    !Array.isArray(f.platforms)||f.platforms.length>16||f.platforms.some(p=>!p||!cell([p.x,p.y])||!cell(p.steps)||p.height!==STRUCTURES.tower.deck)||
    !Array.isArray(f.ramparts)||f.ramparts.length>8||f.ramparts.some(r=>!r||!DIRS[r.face]||!Array.isArray(r.cells)||!r.cells.length||r.cells.length>48||!r.cells.every(cell))||
    !Array.isArray(f.ditches)||f.ditches.length>128||!f.ditches.every(cell)||
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
  const most=STRUCTURES.gate.integrity+STRUCTURES.gate.bar;
  for(const o of world.objects)if(o.fortified!==undefined){
    if(o.fortified!==true||!['gate','bridge'].includes(o.kind))fail('real-time fortified object.');
    if(o.kind==='gate'&&(!GATE_STATES.has(o.state)||![null,'ally','enemy'].includes(o.holder)||!Number.isInteger(o.integrity)||o.integrity<0||o.integrity>most||
      (o.state==='breached')!==(o.integrity===0)||o.state!=='closed'&&o.holder!==null||
      (o.state==='breached'&&(o.cells??[]).some(([x,y])=>world.map.terrain[y][x]!=='rubble'))))fail('real-time fortified gate.');
    if(o.kind==='bridge'&&(o.progress!==undefined&&(!Number.isInteger(o.progress)||o.progress<0||o.progress>=STRUCTURES.bridge.demolish&&o.state!=='demolished')||
      (o.state==='demolished'&&(o.cells??[]).some(([x,y])=>world.map.terrain[y][x]!=='river'))))fail('real-time fortified bridge.');
  }
  const elevation=new Map((world.map.elevations??[]).map(([x,y,h])=>[cellKey(x,y),h]));
  for(const p of f.platforms)if(elevation.get(cellKey(p.x,p.y))!==p.height||elevation.get(cellKey(p.steps[0],p.steps[1]))!==STRUCTURES.tower.stair)fail('fortified platform disagrees with the map.');
  for(const r of f.ramparts)if(r.cells.some(([x,y])=>elevation.get(cellKey(x,y))!==STRUCTURES.rampart.height||world.map.terrain[y][x]!=='high'))fail('rampart disagrees with the map.');
  for(const [x,y]of f.ditches)if(elevation.get(cellKey(x,y))!==STRUCTURES.ditch.depth||world.map.terrain[y][x]!=='ditch')fail('ditch disagrees with the map.');
  if([...elevation.values()].some(h=>!STRUCTURE_HEIGHTS.includes(h)))fail('real-time structure elevation.');
}

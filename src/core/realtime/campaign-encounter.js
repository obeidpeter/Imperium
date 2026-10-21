import {BANDAGES_PER_ENCOUNTER,MOVEMENT,STANDING,TIME} from '../../data/realtime-rules.js';
import {ARCHETYPES,ESCORTS,FACTION_NAMES,TRAINER,factionFor,tierFor} from '../../data/realtime-forces.js';
import {BATTLE_OPERATIONS} from '../../data/battle-operations.js';
import {progressionOperationDefinition} from '../../data/progression-operations.js';
import {COMPANIONS} from '../../data/soldier.js';
import {soldierOf,soldierAttributes,wornIds,courseEffects,knownAbilities,companionAttributes,companionWorn} from '../soldier.js';
import {difficultyRule} from '../campaign-options.js';
import {advanceOperation} from '../operations.js';
import {fieldMoveCost} from '../field-geometry.js';
import {clamp,distance} from '../shared.js';
import {createWorld,roundOf} from './simulation.js';
import {findRoute,navGrid,span,speedFactor,cellCentre,nearestWalkable,walkable} from './navigation.js';
import {ITEMS} from '../../data/items.js';
import {CHAPTERS} from '../../data/campaign.js';
import {DEPLOYMENT,ROMAN_SQUADS} from '../../data/realtime-squads.js';
import {deploymentZone} from './deployment.js';
import {defaultStanding} from './squad-ai.js';
import {fielded,squadCentre} from './squads.js';
import {chapterOpportunity} from '../command-campaign.js';
import {DEFAULT_OPPORTUNITIES,WORK_SECONDS,fieldVerb} from './field-objects.js';

// A campaign battle in real time (build brief §3.2 "Converting 0.38 data",
// §3.4). The 0.38 encounter stays the record the campaign commits: its map,
// units, mission and operation phases are converted into a real-time world,
// and the world's outcome is written back into it. Tiles become metres at a
// scale chosen per encounter by travel time; turns become rounds. Pure.

export const FINE=2.5;
// Public Confidence lost for each neutral the party struck first (guide "Fighting").
export const PROVOKED_COST=3;
// Modes the real-time mission runs in Phase 1 (the others arrive with their phase).
export const REALTIME_MODES=Object.freeze(['training','clear','extract','hold','recover','capture']);
const LINEAR=new Set(['road','wall','river','ford']);
const LINKS={road:['road','ford','stone'],wall:['wall'],river:['river','ford'],ford:['river','ford','road']};
const EDGE_LINKS=new Set(['road','river','ford']);

// --- Map scale by travel time -------------------------------------------------
// Each coarse 0.38 tile becomes a block of 2.5 m tiles. A scale of k tiles a
// side may be fractional: columns and rows then take ⌊k⌋ or ⌈k⌉ tiles, spread
// evenly, so the average is k. The k chosen keeps the rounds needed to walk the
// encounter's defining route (the column's road for an evacuation, the
// soldier's road to the farthest objective otherwise) within ±10% of the turns
// 0.38 needed at two tiles a turn.
export function layoutFor(width,height,k){
  const spread=n=>{const total=Math.round(n*k),cells=[];let acc=0;for(let i=0;i<n;i++){const next=Math.round((i+1)*total/n);cells.push(next-acc);acc=next;}return cells;};
  return {k,kx:spread(width),ky:spread(height)};
}
const offsets=list=>{const out=[0];for(const v of list)out.push(out.at(-1)+v);return out;};
export function upsampleTerrain(coarse,layout,ground='grass'){
  const height=coarse.length,width=coarse[0].length,{kx,ky}=typeof layout==='number'?layoutFor(width,height,layout):layout,ox=offsets(kx),oy=offsets(ky);
  const thick=(typeof layout==='number'?layout:layout.k)>=3.75?2:1;
  const at=(x,y)=>x<0||y<0||x>=width||y>=height?null:coarse[y][x];
  const colOf=[],rowOf=[];kx.forEach((n,i)=>{for(let j=0;j<n;j++)colOf.push(i);});ky.forEach((n,i)=>{for(let j=0;j<n;j++)rowOf.push(i);});
  const rows=[];
  for(let fy=0;fy<rowOf.length;fy++){
    const row=[];
    for(let fx=0;fx<colOf.length;fx++){
      const cx=colOf[fx],cy=rowOf[fy],lx=fx-ox[cx],ly=fy-oy[cy],t=coarse[cy][cx];
      if(!LINEAR.has(t)){row.push(t);continue;}
      const link=(dx,dy)=>{const n=at(cx+dx,cy+dy);return n===null?EDGE_LINKS.has(t):LINKS[t].includes(n)||t==='ford'&&n==='road';};
      const n=link(0,-1),s=link(0,1),w=link(-1,0),e=link(1,0);
      if(!n&&!s&&!w&&!e){row.push(t);continue;}
      const c=Math.floor((kx[cx]-1)/2),r=Math.floor((ky[cy]-1)/2);
      const onV=lx>=c&&lx<c+thick,onH=ly>=r&&ly<r+thick,centre=onV&&onH;
      const vertical=onV&&(centre||ly<r&&n||ly>=r+thick&&s),horizontal=onH&&(centre||lx<c&&w||lx>=c+thick&&e);
      if(t==='ford'){
        // A ford carries the river's line as fordable water, and the road's across it.
        const riverV=link(0,-1)&&['river','ford'].includes(at(cx,cy-1))||link(0,1)&&['river','ford'].includes(at(cx,cy+1));
        row.push(vertical||horizontal?'ford':riverV&&onV?'ford':ground);continue;
      }
      row.push(vertical||horizontal?t:ground);
    }
    rows.push(row);
  }
  return {width:colOf.length,height:rowOf.length,terrain:rows};
}
export function tileCentre(tile,layout){
  const ox=offsets(layout.kx),oy=offsets(layout.ky);return {x:(ox[tile.x]+layout.kx[tile.x]/2)*FINE,z:(oy[tile.y]+layout.ky[tile.y]/2)*FINE};
}
export function metresToTile(p,layout,e){
  const find=(m,list)=>{const o=offsets(list),cell=m/FINE;let i=0;while(i<list.length-1&&o[i+1]<=cell)i++;return i;};
  return {x:clamp(find(p.x,layout.kx),0,e.width-1),y:clamp(find(p.z,layout.ky),0,e.height-1)};
}

// 0.38's turns to walk a route: its movement cost at two tiles a turn.
function turns038(e,from,to){
  const costs=new Map([[`${from.x},${from.y}`,0]]),queue=[{...from,cost:0}];
  while(queue.length){
    queue.sort((a,b)=>a.cost-b.cost);const p=queue.shift();if(p.x===to.x&&p.y===to.y)return p.cost/2;
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy;if(x<0||y<0||x>=e.width||y>=e.height||['rock','river'].includes(e.terrain[y][x]))continue;
      const cost=p.cost+fieldMoveCost(e,{formation:null},x,y),key=`${x},${y}`;if(!costs.has(key)||cost<costs.get(key)){costs.set(key,cost);queue.push({x,y,cost});}}
  }
  return null;
}
// Rounds to walk the same route in real time at walking pace, terrain included.
function roundsRealtime(e,k,from,to,ground){
  const layout=layoutFor(e.width,e.height,k),fine=upsampleTerrain(e.terrain,layout,ground),grid=navGrid({id:`${e.id}:${k}`,...fine});
  const a=tileCentre(from,layout),b=tileCentre(to,layout),route=findRoute(grid,a,b);
  let seconds=0,prev=a;
  for(const p of route.points){const mid={x:(prev.x+p.x)/2,z:(prev.z+p.z)/2};seconds+=span(p.x-prev.x,p.z-prev.z)/(MOVEMENT.walk*speedFactor(grid,mid.x,mid.z));prev=p;}
  return seconds/(TIME.roundTicks/TIME.ticksPerSecond);
}
// The encounter's defining route: the protected column's road to safety in an
// evacuation, otherwise the soldier's road to the farthest objective of any
// operation phase (the whole of the encounter's travel, not its first leg).
export function defineRoute(e){
  const hero=e.units.find(u=>u.id==='hero'),escort=e.units.find(u=>u.role==='escort'&&u.side==='neutral'),ally=e.units.find(u=>u.side==='ally');
  const from=e.mission?.mode==='extract'&&escort?escort:['hold','capture','supply'].includes(e.mission?.mode)&&ally?ally:hero;
  const goals=[{x:e.goal.x,y:e.goal.y},...(operationOf(e)?.phases??[]).filter(p=>Array.isArray(p.goal)).map(p=>({x:p.goal[0],y:p.goal[1]}))];
  const to=goals.reduce((b,g)=>distance(from,g)>distance(from,b)?g:b,goals[0]);
  return {from:{x:from.x,y:from.y},to};
}
// The encounter's regional ground under its roads, walls and rivers (0.38 createBattle's '.').
const groundOf=e=>{const t=CHAPTERS.flatMap(c=>c.encounters).find(x=>x.id===e.id)?.terrain;return ['marsh','sand','stone'].includes(t)?t:'grass';};
export function calibrate(e){
  if(e.type==='training'||e.mission?.mode==='training')return {k:3,turns:null,rounds:null,error:null,route:null};
  const route=defineRoute(e),turns=turns038(e,route.from,route.to);
  if(!turns)return {k:3,turns:0,rounds:0,error:null,route};
  // From 2 to 4.5 tiles a side in eighths; the first scale within ±10% nearest 3, else the closest.
  let best=null;
  for(const k of Array.from({length:21},(_,i)=>2+i/8).sort((a,b)=>Math.abs(a-3)-Math.abs(b-3)||a-b)){
    const rounds=roundsRealtime(e,k,route.from,route.to,groundOf(e)),error=rounds/turns-1;
    if(!best||Math.abs(error)<Math.abs(best.error))best={k,turns,rounds,error,route};if(Math.abs(error)<=.06)break;
  }
  return best;
}

// --- People -------------------------------------------------------------------
const SPREAD=[[0,0],[-1.2,1.1],[-1.2,-1.1],[-2.4,0]];
function enemySpec(state,e,unit,index,k){
  const faction=factionFor(state.chapter),tier=tierFor(state.chapter),role=unit.role==='trainer'?'trainer':ARCHETYPES[faction][unit.role]?unit.role:'infantry';
  if(role==='trainer')return {...TRAINER,id:unit.id,name:TRAINER.name,side:'enemy',role:'trainer',practice:true,at:pos(unit,k),face:[-1,0],unitId:unit.id,faction};
  const variants=ARCHETYPES[faction][role],a=variants[index%variants.length],attrs={...a.attributes};
  for(const [k,v]of Object.entries(tier.mods))attrs[k]=Math.max(k==='combat'?1:4,(attrs[k]??10)+v);
  return {id:unit.id,name:`${FACTION_NAMES[faction]} ${a.name}`,side:'enemy',role,attributes:attrs,kit:[...a.kit],ammo:{...(a.ammo??{})},skirmisher:!!a.skirmisher,
    mounted:!!a.mounted,officer:role==='guard',guard:role==='guard',hidden:!!unit.hidden,at:pos(unit,k),face:[-1,0],unitId:unit.id,faction,
    loot:lootFor(role,index,state.chapter)};
}
const pos=(unit,layout)=>{const p=tileCentre(unit,layout);return [p.x,p.z];};
// What a fallen enemy carries: his worn pieces are left to the field; the
// purse, trophies and a spare weapon can be taken.
function lootFor(role,index,chapter){
  const out=[];if(index%2===0)out.push(chapter>=5&&chapter<=6||chapter===9?'persian_dagger':'coin_purse');if(index%3===1)out.push(chapter<5?'gothic_torc':'silver_brooch');
  if(role==='raider'&&index%2===1)out.push('axe');if(role==='archer')out.push('quiver');
  return out;
}
// The 0.38 hero's javelins over or under three (rearmed, or the command reserve's
// one fewer) are pila more or fewer; Chapter VII's rest adds 4 Health.
function heroSpec(state,unit,k){
  return {...soldierSpec(state,{at:pos(unit,k),extraPila:(unit.ammo??3)-3}),unitId:'hero',...(state.chapter===7&&state.preparation==='rest'?{extraHp:4}:{})};
}
// The soldier as the rules see him in any world (a battle or a camp): his attributes, worn kit, courses and techniques.
export function soldierSpec(state,{at,face=[1,0],extraPila=0}={}){
  const s=soldierOf(state),belt=wornIds(s).map(id=>ITEMS[id]?.belt).find(Boolean)??{};
  return {id:'hero',name:state.name,side:'player',role:'soldier',path:s.path,attributes:soldierAttributes(s),kit:wornIds(s),effects:courseEffects(s.courses),
    abilities:knownAbilities(state),ammo:{...Object.fromEntries(Object.entries(belt).map(([kind,n])=>[kind,Math.max(0,n+(kind==='pilum'?extraPila:0))]))},bandages:BANDAGES_PER_ENCOUNTER,
    at,face,standingPreset:'soldier',drawn:false};
}
// A veteran's specialism (from Chapter III's training; usable with Command from Chapter IV): its action.
const SPECIAL_ACTIONS={protector:'guard',leader:'inspire',ranged:'volley'};
function companionSpec(state,id,at,{side='ally',unitId=null,preset=null}={}){
  const profile=COMPANIONS[id],worn=companionWorn(state,id),kit=Object.keys(worn).sort().map(p=>worn[p]),belt=kit.map(i=>ITEMS[i]?.belt).find(Boolean)??{};
  const veteran=state.company?.find(v=>v.id===id),orders=state.soldier?.orders?.[id];
  const specialist=state.chapter>=4?state.progression?.specializations?.[id]??null:null;
  return {id,name:veteran?.name??profile.name,side,role:'companion',attributes:companionAttributes(state,id),kit,ammo:{...belt},bandages:id==='firmus'?3:1,
    at,face:[1,0],downs:true,veteranId:id,unitId,standing:orders??null,standingPreset:orders?null:preset??profile.preset,drawn:false,
    abilities:['strike','brace','throw_pilum','bind_wounds',...(specialist?[SPECIAL_ACTIONS[specialist]]:[])],
    ...(specialist?{specialist,...(specialist==='ranged'?{volleys:2}:{})}:{})};
}
// The companions who march with the soldier (from Chapter III): his chosen
// party, or the first three fit veterans of the company roll.
export function partyFor(state){
  if(state.chapter<3)return [];
  const fit=v=>v&&(v.recovery??0)===0,company=state.company??[],chosen=state.soldier?.party;
  const order=chosen??state.companyOrders?.priority??company.map(v=>v.id);
  return order.map(id=>company.find(v=>v.id===id)).filter(fit).slice(0,3).map(v=>v.id);
}

// --- Missions and operations ------------------------------------------------
const operationOf=e=>e.operation?.version===2?progressionOperationDefinition(e.operation.id,e.operation.branch):e.operation?.version===1?BATTLE_OPERATIONS[e.operation.id]:null;
function phaseMission(e,phase,layout,{escortPoint=null}={}){
  const goalTile=phase.goal==='escort'?escortPoint:{x:phase.goal[0],y:phase.goal[1]},points=phase.points==='escort'?[[goalTile.x,goalTile.y]]:phase.points??[];
  return {mode:phase.mode,goal:tileCentre(goalTile,layout),goalTile,points:points.map(([x,y])=>({...tileCentre({x,y},layout),secured:false})),holdRequired:phase.hold??0,
    gather:phase.gather?phase.gather*layout.k*FINE:0,commander:!!phase.commander,rescue:!!phase.rescue,pauseEscorts:!!phase.pauseEscorts,label:phase.label,
    objective:phase.objective,id:phase.id};
}
const CAMP_CAPABILITIES=new Set(['oath','prepare','persuade','negotiate','stratagem','allocate','judge','address','rebut','record','denounce']);

// --- Squads (from Chapter IV, §3.4) ----------------------------------------------
// Each 0.38 military unit becomes a squad: its Health the squad's strength, its
// morale, cohesion, damage, bracing and formation carried over, its men drawn
// from the faction's archetype (ours: legionaries, or Felix's archers). A
// veteran who marches with the soldier leaves his squad to another officer.
export const squadsFrom=state=>state.chapter>=4&&state.encounter?.type!=='training';
const ORDINALS=['First','Second','Third','Fourth','Fifth','Sixth'];
const ENEMY_SQUAD_NAMES={infantry:'warriors',guard:'shield guard',archer:'archers',raider:'raiders',cavalry:'horse',heavy:'horse'};
function memberOf(state,role,faction){
  if(faction==='roman'){const r=ROMAN_SQUADS[role==='archer'?'archer':'infantry'];return {name:r.name==='legionary'?'Legionary':'Auxiliary archer',attributes:{...r.attributes},kit:[...r.kit],ammo:{...r.ammo}};}
  const tier=tierFor(state.chapter),a=ARCHETYPES[faction][ARCHETYPES[faction][role]?role:'infantry'][0],attrs={...a.attributes};
  for(const [k,v]of Object.entries(tier.mods))attrs[k]=Math.max(k==='combat'?1:4,(attrs[k]??10)+v);
  return {name:`${FACTION_NAMES[faction]} ${a.name}`,attributes:attrs,kit:[...a.kit],ammo:{...(a.ammo??{})},mounted:!!a.mounted};
}
function squadSpec(state,e,unit,k,{party=[],index=0}={}){
  const enemy=unit.side==='enemy',faction=enemy?factionFor(state.chapter):'roman',role=unit.role==='heavy'?'heavy':unit.role;
  const led=!enemy&&unit.veteranId&&!party.includes(unit.veteranId),veteran=led?state.company?.find(v=>v.id===unit.veteranId):null;
  const name=enemy?`${FACTION_NAMES[faction]} ${ENEMY_SQUAD_NAMES[role]??'band'}`:veteran?`${veteran.name.split(' ').at(-1)}’s ${role==='archer'?'archers':'squad'}`
    :`${ORDINALS[index]??'Reserve'} ${role==='archer'?'archers':'squad'}`;
  return {id:unit.id,name,side:enemy?'enemy':'ally',role,faction,unitId:unit.id,veteranId:led?unit.veteranId:null,strength:Math.max(.5,unit.hp),maxStrength:unit.maxHp,
    damage:unit.damage??null,morale:unit.morale??80,cohesion:unit.cohesion??80,braced:!!unit.braced,formation:['line','shield-wall','wedge'].includes(unit.formation)?unit.formation:null,
    moraleResistance:unit.moraleResistance??0,at:pos(unit,k),face:enemy?[-1,0]:[1,0],anchor:enemy?pos(unit,k):null,member:memberOf(state,role,faction),
    standing:enemy?null:squadStanding(state,e,unit,role)};
}
// The squad's standing orders: those set in camp for its veteran's squad (a
// named squad found among this battle's, or the soldier if it is not here), or
// the battle's own defaults.
function squadStanding(state,e,unit,role){
  const custom=unit.veteranId?state.soldier?.squadOrders?.[unit.veteranId]:null;if(!custom)return defaultStanding(e.mission?.mode,role);
  const tokenOf=id=>e.units.find(u=>u.side==='ally'&&u.veteranId===id)?.id;
  return custom.map(([a,t])=>[a,typeof t==='string'&&t.startsWith('squad:')?(tokenOf(t.slice(6))?`squad:${tokenOf(t.slice(6))}`:'hero'):t]);
}

// --- The field objects (0.38 expanded-campaign.js) ------------------------------
// Each stands at its tile's centre. A side gate is a wall line across its
// opening while it is shut (one fine tile thick, so the ground beside it is the
// ground the stage draws); a damaged footbridge's crossing is a strip of the
// river that becomes a ford once repaired. The opportunities carry the chapter's
// own versions (edition 34) or the defaults.
function fieldFor(e,layout,fine){
  if(!e.field||e.type==='training'||!Array.isArray(e.field.objects)||!e.field.objects.length)return null;
  const ox=offsets(layout.kx),oy=offsets(layout.ky),objects=[];
  const passable=(x,y)=>x>=0&&y>=0&&x<e.width&&y<e.height&&!['rock','river','wall'].includes(e.terrain[y][x]);
  for(const o of e.field.objects){
    const c=tileCentre(o,layout),object={id:o.id,kind:o.kind,name:o.label,x:c.x,z:c.z,work_s:WORK_SECONDS,field:true,state:o.state,rounds:o.rounds??0,tile:{x:o.x,y:o.y}};
    if(o.kind==='gate'||o.kind==='bridge'){
      // Its passage runs east-west when the tiles either side can be crossed.
      const eastWest=passable(o.x-1,o.y)||passable(o.x+1,o.y),column=o.kind==='gate'?eastWest:!eastWest,cells=[];
      if(column){const fx=ox[o.x]+Math.floor(layout.kx[o.x]/2);for(let fy=oy[o.y];fy<oy[o.y]+layout.ky[o.y];fy++)cells.push([fx,fy]);}
      else{const fy=oy[o.y]+Math.floor(layout.ky[o.y]/2);for(let fx=ox[o.x];fx<ox[o.x]+layout.kx[o.x];fx++)cells.push([fx,fy]);}
      object.cells=o.kind==='bridge'?cells.filter(([x,y])=>['river','ford'].includes(fine.terrain[y][x])):cells;
      if(o.kind==='gate'){object.under=fine.terrain[cells[0][1]][cells[0][0]];if(o.state==='closed')for(const [x,y]of cells)fine.terrain[y][x]='wall';}
    }
    object.done=!fieldVerb(object)||['stores','signal'].includes(o.kind)&&e.field.outcome!=='pending';
    objects.push(object);
  }
  const opportunity=id=>{const authored=chapterOpportunity(e,id),label=e.field.objects.find(o=>o.id===id)?.label??id;
    return authored?{label,effect:authored.effect,description:authored.description}:{label,...DEFAULT_OPPORTUNITIES[id]};};
  return {objects,field:{landmark:e.field.landmark,deadline:e.field.deadline,choice:e.field.choice,outcome:e.field.outcome,
    escortPace:e.commandCampaign?.escortPace??2,cavalryDenied:!!e.commandCampaign?.cavalryDenied,opportunities:{stores:opportunity('stores'),signal:opportunity('signal')}}};
}

export function createEncounterWorld(state,{seed=state.rng}={}){
  const e=state.encounter,cal=calibrate(e),layout=layoutFor(e.width,e.height,cal.k),k=layout,S=cal.k*FINE,difficulty=e.difficulty??state.difficulty??'standard';
  // Rain makes slopes slower to climb (navigation.js reads the map's rain).
  const fine=upsampleTerrain(e.terrain,layout,groundOf(e)),map={id:e.id,...fine,...(e.weather==='rain'?{rain:true}:{})};
  const actors=[],party=partyFor(state),hero=e.units.find(u=>u.id==='hero'),squads=squadsFrom(state),squadSpecs=[];
  actors.push(heroSpec(state,hero,k));
  let enemyIndex=0,allyIndex=0;
  for(const u of e.units){
    if(u.id==='hero'||u.hp<=0)continue;
    if(squads&&(u.side==='enemy'||u.side==='ally')&&u.role!=='escort'){squadSpecs.push(squadSpec(state,e,u,k,{party,index:u.side==='ally'?allyIndex++:0}));continue;}
    if(u.side==='enemy')actors.push(enemySpec(state,e,u,enemyIndex++,k));
    else if(u.side==='ally'&&state.chapter<3&&u.veteranId&&COMPANIONS[u.veteranId])actors.push(companionSpec(state,u.veteranId,pos(u,k),{unitId:u.id,preset:'shieldmate'}));
    else if(u.side==='neutral'&&u.role==='escort'){
      const wounded=!u.escorted;
      actors.push({id:u.id,name:u.name,side:'neutral',role:'escort',attributes:{...ESCORTS.attributes},kit:[...ESCORTS.kit],at:pos(u,k),face:[1,0],unitId:u.id,
        veteranId:u.veteranId??null,escort:{escorted:!!u.escorted,wounded},hp:wounded?8:undefined,pace:MOVEMENT.walk,drawn:false});
    }
  }
  const heroAt=tileCentre(hero,k);
  party.forEach((id,i)=>actors.push(companionSpec(state,id,[heroAt.x+SPREAD[i+1][0],heroAt.z+SPREAD[i+1][1]],{side:'player'})));
  const op=operationOf(e),index=e.operation?.index??0,escortUnit=e.units.find(u=>e.mission?.escortIds?.includes(u.id));
  const phases=op?op.phases.map(p=>phaseMission(e,p,k,{escortPoint:escortUnit?{x:escortUnit.x,y:escortUnit.y}:null})):[phaseMission(e,{mode:e.mission.mode,goal:[e.goal.x,e.goal.y],
    points:e.mission.points.map(p=>[p.x,p.y]),hold:e.mission.holdRequired},k)];
  // Reinforcements: a single man before Chapter IV, after it a squad of the 0.38 reinforcement's strength (7, damage 3).
  const templates=squads?Object.fromEntries(['infantry','guard','archer','raider','cavalry'].map(role=>{
    const t=squadSpec(state,e,{id:'wave',side:'enemy',role,hp:7,maxHp:7,damage:3,x:0,y:0},k);delete t.at;delete t.anchor;delete t.unitId;return [role,t];})):null;
  const current=phases[index],wave=w=>({round:w.turn,...tileCentre(w,k),arrived:!!w.arrived,
    ...(squads?{squad:templates[w.role]??templates.infantry}:{spec:waveSpec(state,w.role,enemyIndex++)})});
  const mission={...current,phase:index,phases:op?op.phases.map(p=>({id:p.id,label:p.label,escort:p.escort??null,wave:p.wave??null})):null,phaseMissions:phases,
    radius:S,followRange:4*S,heldTicks:0,occupiedTicks:0,deadline:e.turnLimit,
    waves:(e.mission.waves??[]).map(wave),escorts:[...(e.mission.escortIds??[])],
    required:(e.requiredAbilities??[]).filter(a=>!CAMP_CAPABILITIES.has(a)),defence:e.defence??100,pressure:difficultyRule(e).pressure,objectId:null,
    waveDelay:difficultyRule(e).wave,completed:[...(e.operation?.completed??[])],...(templates?{squadTemplates:templates}:{})};
  const objects=[],field=fieldFor(e,layout,fine);if(field)objects.push(...field.objects);
  if(phases.some(p=>p.mode==='recover')){const p=phases.find(x=>x.mode==='recover');objects.push({id:'chest',kind:'chest',name:'The legion’s records',x:p.goal.x,z:p.goal.z,work_s:3});
    mission.objectId='chest';}
  const world=createWorld({map,seed,actors,controlled:'hero',party,mission,objects,difficulty,weather:e.weather??null,timeOfDay:e.timeOfDay??'day',
    practice:e.type==='training',scale:cal.k,...(squads?{squads:squadSpecs,command:e.commandCapacity??0,chapter:state.chapter}:{})});
  world.layout={kx:[...layout.kx],ky:[...layout.ky],k:layout.k};if(field)world.field=field.field;
  preparations(state,e,world);
  // From Chapter VII the battle opens with the company to deploy (deployment.js).
  if(squads&&state.chapter>=DEPLOYMENT.fromChapter&&e.type!=='training')world.deployment={zone:deploymentZone(layout,Math.min(DEPLOYMENT.tiles,e.width)),done:false,placed:0};
  world.title=e.title;world.encounterId=e.id;world.chapter=state.chapter;
  return world;
}
// The camp's preparations as the world plays them (0.38 field-approaches.js,
// the operational plans and Chapter VII and IX): the approach the enemy
// answers (squad-ai.js, ai.js); Engineering's works, worth 10 Defence to the
// company's squads' men (never the soldier's own); a march penalty, which in
// real time means the soldier only walks (rounds one and two after Engineering
// or a defensive advance, the whole battle with the engineer train); a
// fortified start braced; and the night march.
function preparations(state,e,world){
  const approach=e.tacticsEdition===35&&e.fieldApproach&&e.fieldApproach!=='balanced'?e.fieldApproach:null;
  if(approach)world.approach=approach;if(approach==='breach')world.engineering=true;
  const train=e.commandCampaign?.plan==='engineers'&&e.type!=='training';
  if(train||e.approachMarchPenalty)world.walkUntil=train?WALK_ALL_BATTLE:2*TIME.roundTicks;
  const hero=world.actors.find(a=>a.id===world.heroId);
  if(hero&&e.units.find(u=>u.id==='hero')?.braced)hero.braceUntil=TIME.roundTicks;
  if(state.chapter===9&&state.stratagem==='night')world.timeOfDay='night';
}
export const WALK_ALL_BATTLE=1e7;
function waveSpec(state,role,index){
  const spec=enemySpec(state,null,{id:'wave',role,x:0,y:0},index,layoutFor(1,1,3));delete spec.at;delete spec.unitId;delete spec.hidden;return {...spec,group:'wave'};
}
export const realtimeMissionSupported=e=>e?.kind==='battle'&&!!e.mission&&(operationOf(e)?.phases??[{mode:e.mission.mode}]).every(p=>REALTIME_MODES.includes(p.mode));

// --- The outcome, written back --------------------------------------------------
// The 0.38 encounter learns what happened: status and rounds, capabilities,
// operation phases (stepped with 0.38's own advanceOperation, so its record
// stays valid), every unit's state, arrived reinforcements, the TP its kills
// earned and the commendations the After-Action Chronicle names.
export function applyRealtimeOutcome(state,world){
  const e=state.encounter,k=world.layout,m=world.mission;
  e.turn=clamp(roundOf(world),1,30);
  const mark=a=>{if(!e.usedAbilities.includes(a))e.usedAbilities.push(a);state.capabilityUse[a]=true;const list=state.chapterCapabilities[state.chapter]??=[];if(!list.includes(a))list.push(a);};
  for(const a of world.used)if(['move','strike','brace','throw','assist','scout','order','formation','rally','deploy'].includes(a))mark(a);
  if(e.operation)while(e.operation.index<m.phase&&advanceOperation(e));
  // Units: the soldier, the 0.38 ally, the escorts and the enemies by their unit ids.
  const scaled=(actor,unit)=>actor.alive&&!actor.down?Math.max(1,Math.round(actor.hp/actor.maxHp*unit.maxHp)):0;
  for(const unit of e.units){
    const actor=world.actors.find(a=>a.unitId===unit.id);if(!actor)continue;
    unit.hp=scaled(actor,unit);const t=metresToTile(actor,k,e);unit.x=t.x;unit.y=t.y;if(unit.escorted!==undefined)unit.escorted=!!actor.escort?.escorted||!!actor.carriedBy;
  }
  // Squads (from Chapter IV): each 0.38 unit learns its squad's strength, place, morale, cohesion and suppression.
  for(const squad of world.squads??[]){
    const unit=e.units.find(u=>u.id===squad.unitId);if(!unit)continue;
    const t=metresToTile(squadCentre(world,squad,true),k,e);
    Object.assign(unit,{hp:fielded(world,squad)?clamp(Math.round(squad.strength),1,unit.maxHp):0,x:t.x,y:t.y,morale:clamp(Math.round(squad.morale),0,100),
      cohesion:clamp(Math.round(squad.cohesion),0,100),suppression:clamp(Math.floor(squad.suppression),0,3)});
  }
  // The party marches as the company's deployed veterans: a veteran's own unit, if he has one, records his fate.
  const fate=(a,maxHp)=>a.alive&&!a.down?Math.max(1,Math.round(a.hp/a.maxHp*maxHp)):0;
  const partyUnits=world.party.flatMap((id,i)=>{
    const a=world.actors.find(x=>x.id===id),t=metresToTile(a,k,e),own=world.squads?e.units.find(u=>u.side==='ally'&&u.veteranId===id):null;
    if(own){own.hp=fate(a,own.maxHp);own.x=t.x;own.y=t.y;return [];}
    return [{id:`party${i}`,name:a.name,side:'ally',x:t.x,y:t.y,hp:fate(a,16),maxHp:16,role:'infantry',moved:false,acted:false,
      move:2,facing:'east',morale:80,intent:'Standing orders.',veteranId:id}];});
  if(world.squads)e.units.push(...partyUnits);else if(partyUnits.length)e.units=[...e.units.filter(u=>u.side!=='ally'),...partyUnits];
  m.waves.forEach((w,i)=>{const record=e.mission.waves[i];if(record&&w.arrived)record.arrived=true;});
  const arrivals=world.squads?world.squads.filter(q=>q.id.startsWith('reinforce')).map(q=>({id:q.id,name:q.name,role:q.role,at:squadCentre(world,q,true),alive:fielded(world,q)}))
    :world.actors.filter(a=>a.id.startsWith('reinforce')).map(a=>({id:a.id,name:a.name,role:a.role,at:a,alive:a.alive}));
  for(const a of arrivals)if(!e.units.some(u=>u.id===a.id)){const t=metresToTile(a.at,k,e);
    e.units.push({id:a.id,name:a.name,side:'enemy',x:t.x,y:t.y,hp:a.alive?7:0,maxHp:7,role:a.role,moved:false,acted:false,move:2,facing:'west',morale:80,intent:'Reinforce.'});}
  if(e.defence!==undefined)e.defence=Math.max(0,m.defence);
  writeField(e,world);
  for(const p of m.points)if(p.secured){const t=metresToTile(p,k,e),record=e.mission.points.find(q=>q.x===t.x&&q.y===t.y);if(record)record.secured=true;}
  if(m.mode==='hold'||m.holdRequired)e.mission.holdProgress=Math.min(30,Math.floor(m.heldTicks/TIME.roundTicks));
  // TP for the enemies the soldier or a companion struck down, each once, at most ten (§3.5).
  const ours=new Set(['hero',...world.party]),kills=world.actors.filter(a=>a.side==='enemy'&&!a.alive&&ours.has(a.killedBy)).length;
  e.staged.killTP=kills;e.staged.commendations=commendations(world);e.staged.spoils=world.spoils.map(s=>s.itemId);
  // Neutrals struck without cause: each costs Public Confidence, and the journal names them, when the result is recorded.
  if(world.provoked.length){e.staged.meters.public=Math.max(-100,(e.staged.meters.public??0)-PROVOKED_COST*world.provoked.length);
    e.staged.journal=world.provoked.map(p=>`You struck ${p.name}, who was no enemy, in ${e.title}.`);}
  e.status=world.status==='active'?'active':world.status;
  e.log.push(...world.log.slice(-10).map(l=>l.text));if(e.log.length>70)e.log.splice(0,e.log.length-70);
  return e;
}
// The field objects as 0.38 records them: their states, the opportunity taken
// (or missed) and what it pays on victory, the bridge's ford and the edition-34
// record (commitExpanded and the chronicle read these).
function writeField(e,world){
  const f=world.field;if(!f||!e.field)return;
  for(const o of world.objects??[]){
    if(!o.field)continue;const record=e.field.objects.find(r=>r.id===o.id);if(!record)continue;
    record.state=o.state;if(o.state==='burning')record.rounds=Math.max(1,Math.min(3,o.rounds));else delete record.rounds;
    if(o.kind==='bridge'&&o.state==='repaired')e.terrain[o.tile.y][o.tile.x]='ford';
  }
  if(f.choice&&!e.field.choice){
    const effect=f.opportunities?.[f.choice]?.effect;
    if(effect==='stores')e.staged.supplies=(e.staged.supplies??0)+2;
    if(effect==='cohesion')e.staged.meters.army=(e.staged.meters.army??0)+2;
    if(e.commandCampaign)e.commandCampaign.opportunity=f.choice;
  }
  e.field.choice=f.choice;e.field.outcome=f.outcome;
  if(e.commandCampaign){e.commandCampaign.escortPace=f.escortPace;e.commandCampaign.cavalryDenied=f.cavalryDenied;}
}
// Distinguished service the After-Action Chronicle names, each worth 1–3 TP.
export function commendations(world){
  if(world.status!=='won')return [];
  const out=[],hero=world.actors.find(a=>a.id===world.heroId),party=world.actors.filter(a=>world.party.includes(a.id));
  if(party.length&&party.every(a=>a.alive&&!a.down))out.push({id:'all-home',label:'Every companion came home on his feet',tp:2});
  if(hero&&hero.hp>=hero.maxHp/2)out.push({id:'steady',label:'You kept your feet and your strength',tp:1});
  if(world.log.some(l=>l.kind==='hit'&&/\(ambush\)/.test(l.text)))out.push({id:'ambush',label:'You struck from cover',tp:1});
  return out.slice(0,3);
}
export {walkable,cellCentre,nearestWalkable};

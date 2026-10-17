// Presentation-only timelines. Pure movement predicates; no mutation, RNG, DOM or clock.
import {movementPinned} from '../core/shared.js';
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const position=u=>({x:u.x,y:u.y});
const living=u=>(u.resolve??u.hp??1)>0;
const cavalry=u=>['cavalry','heavy'].includes(u.role);
const visible=u=>u&&!u.hidden;
const directions=['north','east','south','west'];
const facing=(from,to,fallback='east')=>Math.abs(to.x-from.x)>=Math.abs(to.y-from.y)?to.x===from.x?fallback:to.x>from.x?'east':'west':to.y>from.y?'south':'north';
const neutralPose=()=>({pose:'idle',phase:'recovery',progress:1,bob:0,lean:0,weapon:0,shield:0,alpha:1});
export const MOTION_BUDGETS=Object.freeze({performance:{effects:6,fps:30},balanced:{effects:14,fps:60},high:{effects:22,fps:60}});

// The engine records destinations, not animation paths. Reconstruct a passable
// orthogonal route; ignore cells vacated by other units during the same turn.
function movementPath(before,after,unit,next){
  const width=before.width??8,height=before.height??8,terrain=before.terrain??after.terrain;
  const changed=new Set(after.units.filter(v=>{const old=before.units.find(o=>o.id===v.id);return old&&(old.x!==v.x||old.y!==v.y||!living(v));}).map(v=>v.id));
  const occupied=new Set(before.units.filter(v=>v.id!==unit.id&&living(v)&&!changed.has(v.id)).map(v=>`${v.x},${v.y}`));
  const start=position(unit),end=position(next),key=p=>`${p.x},${p.y}`,costs=new Map([[key(start),0]]),parents=new Map(),queue=[{...start,cost:0}];
  while(queue.length){
    queue.sort((a,b)=>a.cost-b.cost||distance(a,end)-distance(b,end));const p=queue.shift();
    if(p.x===end.x&&p.y===end.y){const path=[end];let cursor=key(end);while(parents.has(cursor)){const old=parents.get(cursor);path.unshift(old);cursor=key(old);}return path;}
    if(p.cost>0&&movementPinned(before,unit,p))continue;
    for(const[dx,dy]of[[1,0],[0,1],[-1,0],[0,-1]]){
      const cell={x:p.x+dx,y:p.y+dy},id=key(cell),raw=terrain?.[cell.y]?.[cell.x],ground=typeof raw==='string'?raw:raw?.type;
      if(cell.x<0||cell.y<0||cell.x>=width||cell.y>=height||['rock','river'].includes(ground)||occupied.has(id)&&id!==key(end))continue;
      const cost=p.cost+(ground==='marsh'&&unit.formation!=='line'?2:1);
      if(costs.has(id)&&costs.get(id)<=cost)continue;costs.set(id,cost);parents.set(id,position(p));queue.push({...cell,cost});
    }
  }
  // A malformed or irrecoverably ambiguous visual path fades in place rather
  // than depicting travel through a rule obstacle. Final state remains exact.
  return [start];
}

export function idlePose(unit,time=0){
  let seed=0;for(const ch of String(unit.id))seed=(seed*31+ch.charCodeAt(0))%997;
  const wave=Math.sin(time/780+seed);return {...neutralPose(),bob:wave*(cavalry(unit)?.55:.35),lean:wave*.009};
}

export function buildEncounterTimeline(before,after,{command=null,quality='balanced'}={}){
  const tracks=[],effects=[],units={},budget=MOTION_BUDGETS[quality]??MOTION_BUDGETS.balanced;
  if(!before||!after||before.id!==after.id)return {duration:0,tracks,effects,units,quality};
  const previous=new Map(before.units.map(u=>[u.id,u])),current=new Map(after.units.map(u=>[u.id,u]));
  const addEffect=effect=>effects.push(effect);
  const addTrack=(unit,pose,start=0,duration=420,extra={})=>{
    const old=previous.get(unit.id);if(!visible(unit)||!visible(old))return null;
    units[unit.id]={before:{...old},after:{...unit}};
    const track={unitId:unit.id,pose,start,duration,...extra};tracks.push(track);return track;
  };
  let stagger=0;
  for(const unit of after.units.filter(visible).slice(0,40)){
    const old=previous.get(unit.id);if(!visible(old))continue;
    if(old.x!==unit.x||old.y!==unit.y){
      const path=movementPath(before,after,old,unit),steps=Math.max(1,path.length-1),start=command?.unitId===unit.id?0:Math.min(100,stagger++*18);
      addTrack(unit,cavalry(unit)?'cavalry-move':steps>=3?'run':'walk',start,Math.min(750,180+steps*150),{path,from:position(old),to:position(unit)});
      addEffect({type:'dust',at:position(old),to:position(unit),path,surfaces:path.map(p=>before.terrain?.[p.y]?.[p.x]??'earth'),start,duration:Math.min(750,180+steps*150),essential:false});
    }else if(old.facing!==unit.facing&&directions.includes(unit.facing))addTrack(unit,'turn',0,260);
    if(!old.braced&&unit.braced)addTrack(unit,'brace',0,420);
    if(unit.formation&&unit.formation!==old.formation){addTrack(unit,'formation',30,460,{formation:unit.formation});addEffect({type:'ring',at:position(unit),start:90,duration:330,formation:unit.formation,essential:true});}
  }
  const endOfMove=id=>tracks.filter(t=>t.unitId===id&&t.path).reduce((n,t)=>Math.max(n,t.start+t.duration),0);
  const actionEvents=[];
  const actor=command?.unitId&&current.get(command.unitId),target=current.get(command?.targetId)??after.units.find(u=>u.x===command?.x&&u.y===command?.y);
  if(visible(actor)&&visible(previous.get(actor.id))&&command.action&&!['move','deploy','endTurn'].includes(command.action))actionEvents.push({actor,target,action:command.action});
  // End-turn prose comes from the committed engine. Only explicitly named actors
  // get an attack pose; no nearest-enemy guess fabricates an unrecorded attack.
  const oldLog=before.log??[],newLog=after.log??[];let overlap=Math.min(oldLog.length,newLog.length);
  while(overlap&&!oldLog.slice(-overlap).every((line,i)=>line===newLog[i]))overlap--;
  const recordedEvents=newLog.length?newLog.slice(overlap):(!command||command.action==='endTurn'?after.turnEvents??[]:[]);
  const namedPositions=new Map();
  for(const line of recordedEvents){
    // Reused troop names cannot resurrect an already-withdrawn token. A move
    // explicitly naming a destination can disambiguate subsequent prose; when
    // several living names remain ambiguous, leave the result effect alone.
    let candidates=after.units.filter(u=>visible(u)&&visible(previous.get(u.id))&&living(previous.get(u.id))&&u.name&&line.startsWith(u.name+' ')).sort((a,b)=>b.name.length-a.name.length);
    if(!candidates.length)continue;const name=candidates[0].name;candidates=candidates.filter(u=>u.name===name);
    const destination=/ moves to (\d+)([A-Z])\b/.exec(line);if(destination){namedPositions.set(name,{x:Number(destination[1])-1,y:destination[2].charCodeAt(0)-65});continue;}
    const named=namedPositions.get(name);if(named&&candidates.length>1)candidates=candidates.filter(u=>u.x===named.x&&u.y===named.y);
    if(candidates.length!==1)continue;const match=candidates[0];
    const consequence=line.slice(name.length+1);
    let victims=after.units.filter(u=>visible(u)&&visible(previous.get(u.id))&&living(previous.get(u.id))&&u.id!==match.id&&u.name&&consequence.includes(u.name)).sort((a,b)=>b.name.length-a.name.length);
    if(victims.length){victims=victims.filter(u=>u.name===victims[0].name);if(victims.length>1){const changed=victims.filter(u=>(u.resolve??u.hp??0)<(previous.get(u.id).resolve??previous.get(u.id).hp??0));if(changed.length===1)victims=changed;}}
    const victim=victims.length===1?victims[0]:null;
    if(actionEvents.some(e=>e.actor.id===match.id&&['strike','throw','volley'].includes(e.action)))continue;
    if(/ (hits|strikes) /.test(line)&&victim)actionEvents.push({actor:match,target:victim,action:match.role==='archer'?'throw':'strike'});
    else if(/ (attacks|challenges) /.test(line)&&victim)actionEvents.push({actor:match,target:victim,action:line.includes('Resolve')?'denounce':'persuade'});
  }
  const impactTimes=new Map(),impactSources=new Map();
  for(const event of actionEvents.slice(0,12)){
    const {actor,target,action}=event,start=Math.min(800,endOfMove(actor.id)+40),political=after.kind==='contest',ranged=['throw','volley'].includes(action),guard=['brace','guard'].includes(action);
    let pose=political?'speak':action==='strike'?cavalry(actor)?'cavalry-attack':'attack':ranged?'throw':guard?'brace':['rally','inspire'].includes(action)?'rally':action==='order'?'order':action==='formation'?'order':action==='assist'?'rally':'order';
    const t=addTrack(actor,pose,start,guard?460:620,{action,target:target&&position(target),formation:command?.formation});if(!t)continue;
    // Six authored poses: anticipation, contact and follow-through have time
    // to read. The throw's fourth frame releases at 50%, then the missile flies.
    const release=310,flight=230,impact=start+(ranged?release+flight:230);
    if(target&&target.id!==actor.id&&impact>=(impactTimes.get(target.id)??0)){impactTimes.set(target.id,impact);impactSources.set(target.id,position(actor));}
    if(!political&&action==='strike'&&target)addEffect({type:'slash',from:position(actor),to:position(target),start:start+190,duration:160,essential:false});
    if(ranged&&target)addEffect({type:'projectile',projectile:actor.role==='archer'?'arrow':'javelin',from:position(actor),to:position(target),start:start+release,duration:flight,essential:true});
    if(political)addEffect({type:'speech',at:position(actor),to:target&&position(target),action,start:start+70,duration:310,essential:true});
    else if(['rally','inspire','guard','order','formation','assist','scout'].includes(action))addEffect({type:'ring',at:position(actor),action,start:start+90,duration:330,essential:true});
    if(command?.action==='formation'||command?.action==='order')for(const unit of after.units.filter(u=>visible(u)&&u.side==='ally'&&u.ordered&&!previous.get(u.id)?.ordered&&!actionEvents.some(a=>a.actor.id===u.id&&['strike','throw'].includes(a.action))))addTrack(unit,command.action==='formation'?'formation':'order',Math.min(endOfMove(unit.id)+20,800),460,{formation:unit.formation,action:command.orderAction});
  }
  for(const unit of after.units.filter(visible).slice(0,40)){
    const old=previous.get(unit.id);if(!visible(old))continue;const delta=(unit.resolve??unit.hp??0)-(old.resolve??old.hp??0),start=impactTimes.get(unit.id)??Math.min(650,endOfMove(unit.id)+180);
    if(delta<0){addTrack(unit,living(unit)?'hit':'retreat',start,living(unit)?360:480,{withdrawn:!living(unit),source:impactSources.get(unit.id)});addEffect({type:old.braced?'shield':'impact',at:position(unit),source:impactSources.get(unit.id),start,duration:230,essential:true,defended:!!old.braced,political:after.kind==='contest',delta});}
    else if(delta>0)addEffect({type:'ring',at:position(unit),start,duration:300,essential:true,healing:true});
    for(const stat of ['morale','stance'])if(Number.isFinite(old[stat])&&Number.isFinite(unit[stat])&&old[stat]!==unit[stat])addEffect({type:stat,at:position(unit),delta:unit[stat]-old[stat],start,duration:310,essential:true});
    if(unit.side!==old.side)addEffect({type:'allegiance',at:position(unit),start:180,duration:420,essential:true});
  }
  if(after.status!==before.status&&['won','lost'].includes(after.status))addEffect({type:after.status==='won'?'victory':'defeat',at:{x:3.5,y:3.5},start:350,duration:500,essential:true});
  const boundedEffects=effects.sort((a,b)=>Number(b.essential)-Number(a.essential)||a.start-b.start).slice(0,budget.effects);
  const duration=Math.min(1700,Math.max(0,...tracks.map(t=>t.start+t.duration),...boundedEffects.map(t=>t.start+t.duration)));
  return {duration,tracks:tracks.slice(0,96),effects:boundedEffects,units,quality:quality in MOTION_BUDGETS?quality:'balanced'};
}

function samplePath(path,progress){
  if(path.length<2)return {...path[0],segment:0};const p=clamp(progress)*(path.length-1),index=Math.min(path.length-2,Math.floor(p));return {x:lerp(path[index].x,path[index+1].x,p-index),y:lerp(path[index].y,path[index+1].y,p-index),segment:index};
}
function actionPose(track,progress){
  const phase=progress<.24?'anticipation':progress<.52?'impact':'recovery',strike=progress<.24?-Math.sin(progress/.24*Math.PI/2)*.25:progress<.52?Math.sin((progress-.24)/.28*Math.PI)*1.1:Math.sin((1-progress)/.48*Math.PI/2)*.3;
  const pose={...neutralPose(),pose:track.pose,phase,progress,action:track.action};
  if(['attack','cavalry-attack','throw'].includes(track.pose)){pose.weapon=strike;pose.lean=strike*.17;pose.bob=track.pose==='cavalry-attack'?-Math.max(0,strike)*1.2:0;}
  if(['brace','formation'].includes(track.pose)){pose.shield=Math.sin(Math.PI*clamp(progress/.85));pose.lean=-pose.shield*.06;}
  if(track.pose==='hit'){pose.lean=-Math.sin(progress*Math.PI)*.19;pose.shield=.3;}
  if(track.pose==='retreat'){pose.alpha=1-smooth(progress);pose.lean=-progress*.25;pose.bob=progress*4;}
  if(['rally','order','speak'].includes(track.pose)){pose.weapon=Math.sin(progress*Math.PI)*.7;pose.lean=Math.sin(progress*Math.PI)*.07;}
  return pose;
}

export function sampleEncounterTimeline(timeline,elapsed=0){
  const time=clamp(Number.isFinite(elapsed)?elapsed:0,0,timeline.duration),unitOverrides={};
  for(const[id,pair]of Object.entries(timeline.units)){
    const {before,after}=pair,moves=timeline.tracks.filter(t=>t.unitId===id&&t.path),move=moves[0];
    let pose={...idlePose(after,time),x:after.x,y:after.y,facing:after.facing??before.facing??'east',previousFacing:before.facing??'east',turnProgress:clamp(time/220)};
    if(move){const p=clamp((time-move.start)/move.duration),sample=samplePath(move.path,smooth(p));pose.x=sample.x;pose.y=sample.y;if(time<move.start+move.duration){const next=move.path[Math.min(move.path.length-1,sample.segment+1)];pose={...pose,pose:move.pose,phase:p<.12?'anticipation':p>.88?'recovery':'impact',progress:p,stridePhase:smooth(p)*Math.max(1,move.path.length-1)*Math.PI,facing:facing(sample,next,pose.facing),bob:Math.sin(p*Math.PI*Math.max(2,move.path.length-1)*2)*(move.pose==='cavalry-move'?1.6:1.1),lean:move.pose==='run'?.06:0};}else{pose.x=after.x;pose.y=after.y;}}
    const actions=timeline.tracks.filter(t=>t.unitId===id&&!t.path&&time>=t.start&&time<t.start+t.duration);
    for(const track of actions){const progress=clamp((time-track.start)/track.duration);pose={...pose,...actionPose(track,progress)};if(track.target)pose.facing=facing(pose,track.target,pose.facing);
      const anchor=track.pose==='hit'?track.source:['attack','cavalry-attack'].includes(track.pose)?track.target:null;
      if(anchor){const dx=anchor.x-after.x,dy=anchor.y-after.y,d=Math.max(1,Math.abs(dx)+Math.abs(dy)),weight=Math.sin(Math.PI*progress)**2*(track.pose==='hit'?-.075:.09);pose.x+=dx/d*weight;pose.y+=dy/d*weight;}}
    if(!living(after)&&timeline.tracks.some(t=>t.unitId===id&&t.withdrawn&&time>=t.start+t.duration))pose.alpha=0;
    unitOverrides[id]=pose;
  }
  const effects=timeline.effects.filter(e=>time>=e.start&&time<e.start+e.duration).map(e=>{const progress=clamp((time-e.start)/e.duration);return {...e,progress,alpha:Math.sin(Math.PI*progress),height:e.type==='projectile'?Math.sin(Math.PI*progress)*.65:0};});
  return {time,duration:timeline.duration,unitOverrides,effects,complete:time>=timeline.duration};
}

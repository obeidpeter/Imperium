import {actionEnvelope,locomotionStride} from './actor-pose.js';
export {locomotionPhase} from './actor-pose.js';
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{const x=clamp(n);return x*x*(3-2*x);};
const same=(a,b)=>a&&b&&Math.abs(a.x-b.x)<1e-7&&Math.abs(a.y-b.y)<1e-7;
const inverseSmooth=value=>{let a=0,b=1;for(let i=0;i<24;i++){const mid=(a+b)/2;if(smooth(mid)<value)a=mid;else b=mid;}return (a+b)/2;};

/** Clone the shared fast 2D timeline into readable real-time 3D milliseconds.
 * Each unit still moves concurrently. Follow-up attacks wait for their own
 * movement and a moving recipient's arrival; impacts retain their source clock.
 * Callers use scale1, and may cancel/seek exactly as with the original timeline. */
export function retimeStageTimeline(timeline){
  if(!timeline)return {duration:0,tracks:[],effects:[],units:{}};
  if(timeline.stageTiming)return structuredClone(timeline);
  const result=structuredClone(timeline),scale=1.65,moves=new Map(),pairs=timeline.tracks.map((old,i)=>({old,next:result.tracks[i]}));
  for(const {old,next}of pairs){next.start=old.start*scale;next.duration=old.duration*scale;if(old.path?.length>1){
    const metres=(old.path.length-1)*2.5,speed=old.pose==='cavalry-move'?4.2:old.pose==='run'?3.2:1.9;
    // The cubic ease reaches 1.5 times average speed. Account for that peak
    // instead of forcing a long route into 2.4 seconds and making feet skate.
    next.duration=Math.max(650,metres/speed*1500);moves.set(old.unitId,{old,next});
  }}
  const unitTime=(time,id)=>{const move=moves.get(id);return move&&time>=move.old.start+move.old.duration?move.next.start+move.next.duration+(time-move.old.start-move.old.duration)*scale:time*scale;};
  const unitAt=point=>Object.entries(timeline.units??{}).find(([,p])=>same(p.after,point))?.[0];
  const actions=pairs.filter(({old})=>!old.path&&!['hit','retreat'].includes(old.pose));
  for(const {old,next}of actions){next.start=unitTime(old.start,old.unitId);if(old.target){
    const recipient=moves.get(unitAt(old.target)),impact=(old.pose==='throw'?540:230)*scale;
    if(recipient)next.start=Math.max(next.start,recipient.next.start+recipient.next.duration-impact);
  }}
  const anchors=actions.filter(({old})=>old.target).map(({old,next})=>({oldTime:old.start+(old.pose==='throw'?540:230),time:next.start+(old.pose==='throw'?540:230)*scale,at:old.target,source:timeline.units?.[old.unitId]?.after}));
  const impactTime=(time,point,source)=>anchors.find(a=>Math.abs(a.oldTime-time)<1e-5&&same(a.at,point)&&(!source||same(a.source,source)))?.time;
  for(const {old,next}of pairs.filter(({old})=>['hit','retreat'].includes(old.pose)))next.start=impactTime(old.start,timeline.units?.[old.unitId]?.after,old.source)??unitTime(old.start,old.unitId);
  for(let i=0;i<timeline.effects.length;i++){
    const old=timeline.effects[i],next=result.effects[i];next.start=old.start*scale;next.duration=old.duration*scale;
    if(old.type==='dust'&&old.path){const move=[...moves.values()].find(m=>same(m.old.from,old.at)&&same(m.old.to,old.to));if(move){next.start=move.next.start;next.duration=move.next.duration;}continue;}
    const reaction=old.at&&pairs.find(({old:t})=>['hit','retreat'].includes(t.pose)&&Math.abs(t.start-old.start)<1e-5&&same(timeline.units?.[t.unitId]?.after,old.at));
    if(reaction){next.start=reaction.next.start;continue;}
    const exact=impactTime(old.start,old.at,old.source);if(exact!==undefined){next.start=exact;continue;}
    const source=old.from??old.at,action=actions.find(({old:t})=>same(timeline.units?.[t.unitId]?.after,source)&&old.start>=t.start&&old.start<t.start+t.duration&&(!old.to||same(t.target,old.to)));
    if(action)next.start=action.next.start+(old.start-action.old.start)*scale;
    else if(old.at)next.start=unitTime(old.start,unitAt(old.at));
    if(['victory','defeat'].includes(old.type))next.start=Math.max(next.start,...anchors.map(a=>a.time));
  }
  result.duration=Math.max(0,...result.tracks.map(t=>t.start+t.duration),...result.effects.map(e=>e.start+e.duration));result.stageTiming=true;
  return result;
}

/** A reaction is justified only by a committed hit track. Local source angle
 * bends the torso away from contact without changing the defender's facing. */
export function combatReaction(unit,frame,timeline,direction){
  if(!frame||!timeline)return {};
  const override=frame?.unitOverrides?.[unit.id];
  if(override?.pose!=='hit'){
    const incoming=timeline?.tracks.find(t=>t.unitId===unit.id&&t.pose==='hit'&&frame.time<t.start&&frame.time>=t.start-170);
    const defended=incoming&&timeline.effects.some(e=>e.type==='shield'&&!e.political&&e.defended!==false&&Math.abs(e.start-incoming.start)<1e-5&&same(e.at,unit));
    return defended&&!['attack','cavalry-attack','throw'].includes(override?.pose)?{motion:'block',phase:.12+.22*(1-(incoming.start-frame.time)/170),defended:true}:{};
  }
  const track=timeline?.tracks.find(t=>t.unitId===unit.id&&t.pose==='hit'&&frame.time>=t.start&&frame.time<t.start+t.duration);if(!track)return {};
  const yaw=Number.isFinite(direction)?direction:({north:Math.PI,east:Math.PI/2,south:0,west:-Math.PI/2}[override.facing??unit.facing]??0),source=track.source;
  const impactDirection=source?Math.atan2(Math.sin(Math.atan2(source.x-unit.x,source.y-unit.y)-yaw),Math.cos(Math.atan2(source.x-unit.x,source.y-unit.y)-yaw)):0;
  const defended=timeline.effects.some(e=>e.type==='shield'&&!e.political&&e.defended!==false&&Math.abs(e.start-track.start)<1e-5&&same(e.at,unit));
  return {impactDirection,defended,...(defended?{motion:'block'}:{})};
}
// Visual contact between tile centres; never changes collision or combat state.
export function meleeOffset(unit,override,timeline){
  if(!override||!['attack','cavalry-attack'].includes(override.pose))return {x:0,z:0};
  const track=timeline?.tracks.find(t=>t.unitId===unit.id&&t.pose===override.pose&&t.target);
  if(!track)return {x:0,z:0};
  const dx=track.target.x-override.x,dz=track.target.y-override.y,d=Math.hypot(dx,dz);
  if(!d||d>1.5)return {x:0,z:0};
  const {anticipation,reach:weight}=actionEnvelope('attack',override.progress);
  const reach=Math.min(.85,Math.max(0,d*2.5-1.6))*weight-.055*anticipation;
  return {x:dx/d*reach,z:dz/d*reach};
}

// Cue times share the committed animation timeline. No RNG or outcome inference.
export function combatCues(timeline,{encounter}={}){
  const cues=[];
  const unit=id=>timeline.units?.[id]?.after??encounter?.units?.find(u=>u.id===id),at=point=>Object.values(timeline.units??{}).find(p=>same(p.after,point))?.after;
  for(const track of timeline.tracks){
    if(track.path?.length>1){
      const distance=(track.path.length-1)*2.5,step=locomotionStride(track.pose,track.pose==='cavalry-move')/2,steps=Math.min(64,Math.floor(distance/step));
      for(let i=0;i<steps;i++){
        const progress=inverseSmooth((i+1)*step/distance),point=track.path[Math.min(track.path.length-1,Math.floor((i+1)*step/2.5))],raw=encounter?.terrain?.[point.y]?.[point.x],surface=typeof raw==='string'?raw:raw?.type;
        const kind=['marsh','ford'].includes(surface)?'wade':track.pose==='cavalry-move'?'hoof':'footstep';
        cues.push({time:track.start+progress*track.duration,kind,intensity:.32+Math.sin(progress*Math.PI)*.16,surface,at:point,side:unit(track.unitId)?.side,unitId:track.unitId});
      }
    }else if(track.pose==='brace')cues.push({time:track.start+track.duration*.3,kind:track.action==='guard'?'guard':'cloth',intensity:track.action==='guard'?.65:.45,side:unit(track.unitId)?.side});
    else if(track.action==='formation')cues.push({time:track.start+track.duration*.18,kind:'cornu',intensity:.68,side:unit(track.unitId)?.side});
    else if(track.action==='inspire'||track.pose==='rally')cues.push({time:track.start+track.duration*.22,kind:'inspire',intensity:.6,side:unit(track.unitId)?.side});
    else if(['attack','cavalry-attack','throw'].includes(track.pose))cues.push({time:track.start+track.duration*.10,kind:'cloth',intensity:.25,side:unit(track.unitId)?.side});
  }
  for(const effect of timeline.effects){
    const side=at(effect.from??effect.at)?.side;
    if(effect.type==='projectile')cues.push({time:effect.start,kind:effect.projectile==='arrow'?'bow':'javelin',intensity:.8,side,at:effect.from??effect.at});
    if(['shield','impact'].includes(effect.type))cues.push({time:effect.start,kind:effect.political?'cloth':effect.type==='shield'?'block':'impact',intensity:effect.political?.4:.9,side,at:effect.at});
    if(effect.type==='slash')cues.push({time:effect.start,kind:'swing',intensity:.5,side,at:effect.at});
    if(effect.type==='speech')cues.push({time:effect.start,kind:'speech',intensity:.45,side});
    if(effect.type==='stance')cues.push({time:effect.start,kind:'vote',intensity:.5,side,at:effect.at});
  }
  // Footfalls cannot evict an impact, order or voice cue on a busy enemy turn.
  const step=c=>['footstep','hoof','wade'].includes(c.kind),events=cues.filter(c=>!step(c)).sort((a,b)=>a.time-b.time).slice(0,100);
  return [...events,...cues.filter(step).slice(0,100-events.length)].sort((a,b)=>a.time-b.time);
}

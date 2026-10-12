const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{const x=clamp(n);return x*x*(3-2*x);};
// Visual contact between tile centres; never changes collision or combat state.
export function meleeOffset(unit,override,timeline){
  if(!override||!['attack','cavalry-attack'].includes(override.pose))return {x:0,z:0};
  const track=timeline?.tracks.find(t=>t.unitId===unit.id&&t.pose===override.pose&&t.target);
  if(!track)return {x:0,z:0};
  const dx=track.target.x-override.x,dz=track.target.y-override.y,d=Math.hypot(dx,dz);
  if(!d||d>1.5)return {x:0,z:0};
  const p=override.progress,contact=230/620;
  const weight=p<contact?smooth(p/contact):1-smooth((p-contact)/(1-contact));
  const reach=Math.min(.85,Math.max(0,d*2.5-1.6))*weight;
  return {x:dx/d*reach,z:dz/d*reach};
}

// Cue times share the committed animation timeline. No RNG or outcome inference.
export function combatCues(timeline){
  const cues=[];
  for(const track of timeline.tracks){
    if(track.path?.length>1){
      const steps=Math.min(14,(track.path.length-1)*4);
      for(let i=0;i<steps;i++)cues.push({time:track.start+(i+.5)/steps*track.duration,kind:'footstep',intensity:.45});
    }else if(track.pose==='brace')cues.push({time:track.start+track.duration*.3,kind:'cloth',intensity:.45});
  }
  for(const effect of timeline.effects){
    if(effect.type==='projectile')cues.push({time:effect.start,kind:effect.projectile==='arrow'?'bow':'javelin',intensity:.8});
    if(['shield','impact'].includes(effect.type))cues.push({time:effect.start,kind:effect.type==='shield'?'block':'impact',intensity:.9});
    if(effect.type==='slash')cues.push({time:effect.start+40,kind:'clash',intensity:.6});
  }
  return cues.sort((a,b)=>a.time-b.time).slice(0,100);
}

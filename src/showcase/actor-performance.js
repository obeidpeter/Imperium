import {PERFORMANCE_CLIPS} from './actor-performance-data.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const CLIP_FIELDS=new Map(Object.entries(PERFORMANCE_CLIPS).map(([name,clip])=>[name,[...new Set(clip.frames.flatMap(frame=>Object.keys(frame[1])))]]));

/** Bounded cubic interpolation. Slopes pass through the walking cycle boundary;
 * limiting each sampled channel to its neighboring authored values prevents
 * an elbow or garment from overshooting during an abrupt action. */
export function samplePerformance(name,phase=0){
  const clip=PERFORMANCE_CLIPS[name];if(!clip)return {};
  const frames=clip.frames,p=clamp(phase);let i=1;while(i<frames.length-1&&frames[i][0]<p)i++;
  const a=frames[i-1],b=frames[i],span=b[0]-a[0],t=(p-a[0])/span;
  const previous=i>1?frames[i-2]:clip.loop?[frames.at(-2)[0]-1,frames.at(-2)[1]]:a;
  const next=i<frames.length-1?frames[i+1]:clip.loop?[frames[1][0]+1,frames[1][1]]:b;
  const result={};
  for(const field of CLIP_FIELDS.get(name)){
    const x=a[1][field]??0,y=b[1][field]??0;
    const m0=(y-(previous[1][field]??0))/Math.max(.0001,b[0]-previous[0]);
    const m1=((next[1][field]??0)-x)/Math.max(.0001,next[0]-a[0]);
    const value=(2*t**3-3*t*t+1)*x+(t**3-2*t*t+t)*span*m0+(-2*t**3+3*t*t)*y+(t**3-t*t)*span*m1;
    result[field]=clamp(value,Math.min(x,y),Math.max(x,y));
  }
  return result;
}
export function applyPerformance(pose,name,phase,weight=1){
  for(const [field,value]of Object.entries(samplePerformance(name,phase))){
    const arm=/^(left|right)Arm([XYZ])$/.exec(field),foot=/^(left|right)Foot([XYZ]|Roll)$/.exec(field);
    if(arm)pose[arm[1]+'Arm']['XYZ'.indexOf(arm[2])]+=value*clamp(weight);
    else if(foot){const i=foot[1]==='right'?0:1,key=foot[2].toLowerCase();pose.feet[i][key]=(pose.feet[i][key]??(key==='x'?(i?1:-1)*.104:0))+value*clamp(weight);}
    else if(typeof pose[field]==='number')pose[field]+=value*clamp(weight);
  }return pose;
}

export function applyTurnPerformance(pose,phase,side=1,weight=1){
  const before={hipX:pose.hipX,bodyY:pose.bodyY,headY:pose.headY,bodyZ:pose.bodyZ,feet:pose.feet.map(f=>({...f}))};
  applyPerformance(pose,'turn',phase,weight);
  if(side<0){
    for(const key of ['hipX','bodyY','headY','bodyZ'])pose[key]=2*before[key]-pose[key];
    const deltas=pose.feet.map((f,i)=>Object.fromEntries(['x','y','z','roll'].map(k=>[k,(f[k]??(i?1:-1)*.104)-(before.feet[i][k]??(i?1:-1)*.104)])));
    pose.feet=before.feet.map((f,i)=>({...f,...Object.fromEntries(['x','y','z','roll'].map(k=>[k,(f[k]??(i?1:-1)*.104)+deltas[1-i][k]*(k==='x'?-1:1)]))}));
  }
  return pose;
}

/** Identity appears in posture as well as a face texture. It never changes
 * unit scale, sole locations, contact anchors or authoritative movement. */
export function applyCharacterPresence(pose,identity,kit,input={}){
  const motion=input.motion??'idle',still=['idle','conversation','speak','assent','dissent','yield'].includes(motion);
  const p=clamp(input.phase),recovery=Number.isFinite(input.phase)?1-smooth(p/.14)+smooth((p-.80)/.20):0;
  if(!still&&!['attack','strike','throw','rally','order','start','stop','turn'].includes(motion))return pose;
  const maturity=clamp(((identity.age??25)-25)/45),authority=kit.officer||kit.civic?1:0,calm=motion==='idle'?1:still?.32:recovery;
  const signatures={marcellus:[.012,-.018],varro:[-.018,.024],lucan:[.018,-.012],crispus:[-.013,.03],severianus:[.022,-.027],paullus:[-.014,.018],aelia:[.009,-.018],sabinus:[-.022,.009]};
  const [shift,turn]=signatures[identity.key]??[(((kit.identity??0)%7)-3)*.003,0];
  pose.hipX+=shift*calm;pose.bodyY+=turn*calm;
  pose.bodyX+=(maturity*.032-authority*.018)*calm;pose.headX-=maturity*.022*calm;
  if(motion==='idle'&&!input.reducedMotion&&kit.civic)applyPerformance(pose,'listen',((input.time??0)/7+(kit.identity%11)/11)%1,.65);
  return pose;
}

/** Transition duration is semantic: the defending arm becomes ready quickly,
 * while a gait settles into an idle stance with a longer weight transfer. */
export function performanceTransition(from,to){
  if(['hit','hurt','block'].includes(to))return .055;
  if(['attack','strike','throw'].includes(to))return .085;
  if(to==='idle'&&['walk','run','retreat'].includes(from))return .24;
  if(['walk','run','retreat'].includes(to)&&from==='idle')return .22;
  if(['speak','rally','order','conversation'].includes(to))return .18;
  return .12;
}
export function applyLocomotionEntry(pose,input={}){
  if(input.reducedMotion)return pose;
  const progress=Number.isFinite(input.movementProgress)?clamp(input.movementProgress):null;
  if(progress!==null){
    if(progress<.16)applyPerformance(pose,'start',progress/.16);
    else if(progress>.80)applyPerformance(pose,'stop',(progress-.80)/.20);
  }
  return pose;
}
export {PERFORMANCE_CLIPS};

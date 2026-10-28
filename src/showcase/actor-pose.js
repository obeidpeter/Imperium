import {applyActorClip,sampleActorClip} from './actor-clips.js';
import {applyPerformance,applyLocomotionEntry,applyTurnPerformance} from './actor-performance.js';
import {sampleHumanGait,sampleHorseGait} from './actor-gait.js';
import {CODE_HORSE_FRAME,HORSE_ANKLE,HORSE_BODY_Y} from './horse-frame.js';
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=n=>{const t=clamp(n,0,1);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;

export const ACTOR_TIMING=Object.freeze({contact:230/620,release:310/620});
export const locomotionStride=(motion,mounted=false)=>mounted?1.8:['run','cavalry-move'].includes(motion)?1.5:1.15;
export const locomotionPhase=(distance,motion='walk',mounted=false)=>Math.max(0,finite(distance))/locomotionStride(motion,mounted);

/** One asymmetric load / drive / recovery envelope shared by pose, aiming and
 * root contact. The exact contact and release instants remain authoritative. */
export function actionEnvelope(motion,phase){
  const p=clamp(finite(phase),0,1),throwing=motion==='throw',strike=throwing?ACTOR_TIMING.release:ACTOR_TIMING.contact;
  const load=smooth(p/(throwing?.32:.25)),drive=smooth((p-(throwing?.32:.25))/(strike-(throwing?.32:.25))),recovery=smooth((p-(throwing?.60:.46))/(throwing?.40:.54));
  return {anticipation:load*(1-drive),drive,recovery,reach:drive*(1-recovery),preparation:load*(1-recovery)};
}

/** Local articulated pose only. No clocks, RNG, unit mutations or world movement. */
export function actorPose({time=0,motion='idle',phase,direction=0,turnSign=1,health=1,morale=1,variant=0,braced=false,defended=false,impactDirection=0,locomotionWeight=1,locomotionDistance,movementProgress,reducedMotion=false,weapon='sword',mounted=false}={}){
  time=reducedMotion?0:finite(time);direction=finite(direction);health=clamp(finite(health,1),0,1);
  const p=clamp(finite(phase),0,1),breath=Math.sin(time*2.1)*.003;
  const pose={yaw:direction,hipX:0,hipY:.91+breath,hipZ:0,bodyX:0,bodyY:0,bodyZ:0,headX:0,headY:0,
    leftArm:[-.2,0,-.1],rightArm:[-.1,0,.08],leftElbow:-.55,rightElbow:-.35,
    leftWrist:0,rightWrist:0,shieldTilt:0,skirt:0,feet:[{x:-.104,y:.07,z:.05,roll:0},{x:.104,y:.07,z:-.05,roll:0}],opacity:1};
  const guard=()=>{pose.hipY-=.075;pose.bodyX=-.075;pose.leftArm[0]=-.7;pose.leftElbow=-1;pose.shieldTilt=-.08;pose.feet[0].z=.19;pose.feet[1].z=-.16;pose.rightElbow=-.75;};
  if((braced||defended||motion==='block')&&!['walk','run','retreat','attack','strike','throw','brace','formation','withdrawn','dead'].includes(motion))guard();
  if(['walk','run','retreat'].includes(motion)){
    const physical=Number.isFinite(locomotionDistance),cycle=physical?locomotionPhase(locomotionDistance,motion):phase===undefined?time*(motion==='run'?2.1:1.4):finite(phase),stride=physical?locomotionStride(motion):.72;
    Object.assign(pose,sampleHumanGait({cycle,stride,running:motion==='run',retreat:motion==='retreat',injury:mounted?0:clamp((.55-health)/.55,0,1)}));
    pose.bodyX=motion==='retreat'?.07:-.05;
    pose.skirt=Math.sin(cycle*Math.PI*2)*.04;
    const weight=clamp(finite(locomotionWeight,1),0,1);
    pose.feet.forEach((foot,i)=>{foot.x=mix((i?1:-1)*.104,foot.x,weight);foot.y=mix(.07,foot.y,weight);foot.z=mix(i?-.05:.05,foot.z,weight);foot.roll*=weight;});
    pose.hipY=mix(.91+breath,pose.hipY,weight);pose.hipX*=weight;pose.bodyX*=weight;pose.bodyY*=weight;pose.bodyZ*=weight;pose.skirt*=weight;pose.rightArm[0]=mix(-.1,pose.rightArm[0],weight);pose.leftArm[0]=mix(-.2,pose.leftArm[0],weight);
    applyActorClip(pose,'walk',((cycle%1)+1)%1,weight);
    applyPerformance(pose,motion==='run'?'run':'walk',((cycle%1)+1)%1,weight);
    applyLocomotionEntry(pose,{movementProgress,reducedMotion});
  }else if(['attack','strike','throw'].includes(motion)){
    // Clips keep exact230/620 contact and310/620 release poses; foot grounding
    // and held-equipment aiming still solve after sampling.
    applyActorClip(pose,motion==='throw'?'throw':weapon==='spear'?'spearAttack':mounted?'mountedAttack':'attack',p);
    if(motion!=='throw'){applyPerformance(pose,'strike',p);if(p>.48)applyPerformance(pose,'recover',(p-.48)/.52);}
    if(mounted&&weapon==='spear'){const reach=actionEnvelope(motion,p).reach;pose.bodyZ+=.045*reach;pose.headY-=.04*reach;}
    // Three presentation accents share the exact contact/release pose and
    // endpoints. Variation cannot change reach, the hit clock or the result.
    const contact=motion==='throw'?ACTOR_TIMING.release:ACTOR_TIMING.contact;
    const accent=p<=0||p>=1||p===contact?0:Math.sin(Math.PI*p)**2*Math.sin(Math.PI*(p-contact))**2;
    const style=((Math.abs(Math.trunc(finite(variant)))%3)-1);
    pose.rightArm[2]+=style*.19*accent;pose.bodyY+=style*.12*accent;pose.rightElbow-=Math.abs(style)*.16*accent;
  }else if(['brace','formation'].includes(motion)){
    applyActorClip(pose,'brace',phase===undefined?1:p);
    if(phase!==undefined)applyPerformance(pose,'guard',p);
  }else if(['hit','hurt','block'].includes(motion)){
    const blocked=braced||defended||motion==='block',hit=sampleActorClip(blocked?'block':'hurt',p).weight,angle=finite(impactDirection),front=Math.cos(angle),side=Math.sin(angle);
    // A quick compression lands with the committed impact, followed by a
    // slower recovery. The defender keeps facing instead of snapping to a hit.
    pose.bodyX+=(blocked?.065:.20)*front*hit;pose.bodyZ-=(blocked?.035:.13)*side*hit;pose.headX=.07*front*hit;pose.headY=-.07*side*hit;
    if(!blocked)applyPerformance(pose,'recoil',p);
    pose.hipY-=(blocked?.028:.065)*hit;pose.hipZ-=.055*front*hit;pose.hipX-=.035*side*hit;
    pose.leftArm[0]-=(blocked?.18:.28)*hit;pose.leftElbow-=(blocked?.20:.36)*hit;pose.shieldTilt+=(blocked?.17:.08)*hit;
    pose.rightElbow-=.1*hit;
  }else if(['speak','conversation'].includes(motion)){
    if(motion==='speak')applyPerformance(pose,'speech',p);else applyActorClip(pose,'conversation',p);
  }else if(['rally','order'].includes(motion)){
    applyPerformance(pose,motion,p);
  }else if(motion==='turn'){
    applyTurnPerformance(pose,p,turnSign);
  }else if(motion==='start'||motion==='stop'){
    applyPerformance(pose,motion,p);
  }else if(motion==='assent'){
    // Support: a nod and an open hand toward the speaker, scaled by commitment.
    const w=smooth(phase===undefined?1:p);pose.headX=.09*w;pose.bodyX=-.025*w;pose.rightArm=[-.1-.42*w,0,.08+.1*w];pose.rightElbow=-.35-.55*w;pose.rightWrist=-.25*w;
  }else if(motion==='dissent'){
    // Opposition: arms folded high across the chest, chin up, weight back.
    const w=smooth(phase===undefined?1:p);pose.headX=-.07*w;pose.bodyX=.035*w;pose.leftArm=[-.2-.46*w,0,-.1+.3*w];pose.rightArm=[-.1-.5*w,0,.08-.3*w];pose.leftElbow=-.55-1.4*w;pose.rightElbow=-.35-1.55*w;
  }else if(motion==='yield'){
    const close=smooth(phase===undefined?1:p);pose.headX=.18*close;pose.bodyX=.035*close;pose.leftArm=[-.2-.34*close,0,-.1+.16*close];pose.rightArm=[-.1-.36*close,0,.08-.16*close];pose.leftElbow=-.55-.9*close;pose.rightElbow=-.35-1.05*close;
  }else if(motion==='camp-watch'){
    pose.headY=(p-.5)*.34;pose.bodyY=(p-.5)*.06;pose.rightElbow=-.6;
  }else if(motion==='camp-work'){
    pose.bodyX=.07;pose.headX=.18;pose.leftArm=[-.4,0,-.16];pose.leftElbow=-1.1;
    pose.rightArm=[-.40-.08*p,0,.13];pose.rightElbow=-1.1-.13*p;pose.rightWrist=-.10+.12*p;
  }else if(motion==='camp-carry'){
    pose.bodyZ=-.025;pose.rightArm=[-.12,0,.18];pose.rightElbow=-.48-.06*p;pose.leftArm=[-.3,0,-.08];
    pose.headY=-.10;pose.hipY-=.008*p;
  }else if(motion==='camp-rest'){
    pose.bodyX=.09;pose.headX=.12;pose.hipY-=.035;pose.leftArm=[-.25,0,-.08];pose.rightArm=[-.3,0,.08];
    pose.leftElbow=-.8;pose.rightElbow=-.8;pose.headY=(p-.5)*.06;
  }else if(['dead','withdrawn'].includes(motion)||health<=0){
    const fall=health<=0?1:smooth(p);pose.hipY-=.6*fall;pose.hipX=-.025*fall;pose.bodyX=.8*fall;pose.bodyZ=.09*fall;pose.headX=.35*fall;pose.rightArm[0]=-.7*fall;pose.opacity=1;
  }
  if(motion==='idle'&&!reducedMotion)applyActorClip(pose,'idle',(time%4.8)/4.8);
  // Injury changes gait support as well as bearing; distance remains caller-
  // owned. Only non-contact poses receive these offsets, so the authoritative
  // attack, blocking and throwing anchors remain unchanged.
  if(['idle','walk','run','retreat','start','stop','camp-watch','camp-rest'].includes(motion)&&health>0){
    const injury=clamp((.55-health)/.55,0,1),shaken=clamp((.5-finite(morale,1))/.5,0,1),moving=['walk','run','retreat'].includes(motion);
    pose.bodyX+=injury*.065+shaken*.035;if(!moving)pose.bodyZ+=injury*.035;pose.headX+=injury*.035+shaken*.06;
    pose.leftArm[0]-=injury*.13;pose.leftElbow-=injury*.20;pose.rightArm[0]-=shaken*.10;
  }
  // Two-bone sagittal IK keeps the soles on the requested ground plane even
  // while hips settle, and avoids straight-knee singularities.
  pose.legs=pose.feet.map((foot,i)=>{
    const x=(foot.x??(i?1:-1)*.104)-(i?1:-1)*.104-pose.hipX,y=foot.y-pose.hipY,z=foot.z-pose.hipZ,d=clamp(Math.hypot(x,y,z),.12,.858),upper=.43,lower=.43;
    const thigh=Math.atan2(-z,Math.hypot(x,y))-Math.acos(clamp((upper*upper+d*d-lower*lower)/(2*upper*d),-1,1));
    const knee=Math.PI-Math.acos(clamp((upper*upper+lower*lower-d*d)/(2*upper*lower),-1,1));
    return {thigh,knee,splay:Math.atan2(x,-y),ankle:-thigh-knee+foot.roll};
  });
  return pose;
}

/** Fit already-authored feet to terrain samples. Heights are actor-local and
 * relative to its caller-owned root. This does not decide where to move. */
export function groundHumanPose(pose,targets){
  if(!targets?.length)return pose;
  const heights=targets.map(t=>clamp(finite(t.height),-.32,.32));
  pose.hipY+=(Math.min(...heights)+Math.max(...heights))*.5;
  pose.feet=pose.feet.map((foot,i)=>({...foot,x:finite(targets[i]?.x,(i?1:-1)*.104),z:finite(targets[i]?.z,foot.z),y:foot.y+heights[i],pitch:clamp(finite(targets[i]?.pitch),-.32,.32),bank:clamp(finite(targets[i]?.bank),-.25,.25)}));
  // Lower the pelvis only when necessary to keep both ankles reachable. A
  // supported bent knee is preferable to a stretched limb or a floating sole.
  for(const [i,foot] of pose.feet.entries())pose.hipY=Math.min(pose.hipY,foot.y+Math.sqrt(Math.max(.12,.854**2-(foot.z-pose.hipZ)**2-(foot.x-(i?1:-1)*.104-(pose.hipX??0))**2)));
  pose.legs=pose.feet.map((foot,i)=>{
    const x=foot.x-(i?1:-1)*.104-(pose.hipX??0),y=foot.y-pose.hipY,z=foot.z-pose.hipZ,d=clamp(Math.hypot(x,y,z),.12,.858),vertical=-Math.hypot(x,y);
    const thigh=Math.atan2(-z,-vertical)-Math.acos(clamp(d/.86,-1,1)),knee=Math.PI-Math.acos(clamp((.43**2*2-d*d)/(.43**2*2),-1,1));
    return {thigh,knee,splay:Math.atan2(x,-y),ankle:-thigh-knee+foot.roll+foot.pitch,bank:foot.bank};
  });
  return pose;
}

/** Authored joint blend for interrupted actions; yaw remains stage-authoritative.
 * Feet are blended before grounding and IK, never by interpolating knee angles. */
export function blendActorPose(from,to,weight){
  const t=smooth(weight),result={...to};
  for(const key of ['hipX','hipY','hipZ','bodyX','bodyY','bodyZ','headX','headY','leftElbow','rightElbow','leftWrist','rightWrist','shieldTilt','skirt'])result[key]=mix(from[key]??0,to[key]??0,t);
  for(const key of ['leftArm','rightArm'])result[key]=to[key].map((n,i)=>mix(from[key][i],n,t));
  result.feet=to.feet.map((foot,i)=>({...foot,x:mix(from.feet[i].x??(i?1:-1)*.104,foot.x??(i?1:-1)*.104,t),y:mix(from.feet[i].y,foot.y,t),z:mix(from.feet[i].z,foot.z,t),roll:mix(from.feet[i].roll,foot.roll,t)}));
  return result;
}

/** Four-beat walk, diagonal trot and asymmetric canter share distance-driven
 * hoof contacts. The rider counterbalances this same sampled performance. */
// A horse's gait by its speed in metres a second, as the field moves it: a walk, a trot, a
// canter and, fastest, a gallop; a running horse at least trots. From its current gait a
// horse changes only a little past each threshold, so one near it keeps its stride.
export const HORSE_GAIT_SPEEDS=Object.freeze([['walk',0],['trot',2.6],['canter',4],['gallop',5.6]]);
export function horseGaitForSpeed(speed,{current=null}={}){
  if(!Number.isFinite(speed))return null;
  let index=1;for(let i=1;i<HORSE_GAIT_SPEEDS.length;i++)if(speed>=HORSE_GAIT_SPEEDS[i][1])index=i;
  const at=HORSE_GAIT_SPEEDS.findIndex(([name])=>name===current);
  if(at>=1&&speed>=HORSE_GAIT_SPEEDS[at][1]-.3&&speed<(HORSE_GAIT_SPEEDS[at+1]?.[1]??Infinity)+.3)index=at;
  return HORSE_GAIT_SPEEDS[index][0];
}

/** frame: the horse's legs at rest and its own gaits (horse-frame.js), the code-built horse's
 * when absent. gait: the gait to draw, else one by speed (horseGaitForSpeed) or by the blend
 * of a run. cycle: the stride's phase when the caller carries it across a change of gait. */
export function horsePose({time=0,motion='idle',phase,locomotionWeight=1,locomotionDistance,gait,speed,cycle:carried,frame=null,reducedMotion=false}={}){
  time=reducedMotion?0:finite(time);const physical=Number.isFinite(locomotionDistance),moving=['walk','run','retreat','cavalry-move'].includes(motion),weight=moving?clamp(finite(locomotionWeight,1),0,1):0;
  const p=clamp(finite(phase),0,1),fall=['withdrawn','dead'].includes(motion)?smooth(p):0,attack=['attack','strike','cavalry-attack'].includes(motion)?sampleActorClip('horseStrike',p):{},idle=sampleActorClip('horseIdle',((time/6.4)%1+1)%1);
  const fast=['run','cavalry-move'].includes(motion),selected=gait??(fast?horseGaitForSpeed(speed)??(weight<.72?'trot':'canter'):'walk');
  const stride=physical?frame?.motion?.gaits?.[selected]?.stride??locomotionStride(motion,true):1.35;
  const cycle=Number.isFinite(carried)?carried:physical?Math.max(0,finite(locomotionDistance))/stride:phase===undefined?time*1.2:finite(phase)*.72/1.35;
  const pose=sampleHorseGait({cycle,stride,gait:selected,weight,retreat:motion==='retreat',frame});
  pose.bodyPitch+=attack.bodyPitch??0;pose.neckPitch+=(idle.neckPitch??0)+(attack.neckPitch??0);
  pose.tail=(idle.tail??0)+(attack.tail??0)+.08*Math.sin(cycle*Math.PI*2)*weight;
  pose.fall=fall;pose.gait=selected;pose.riderBob=pose.bodyY-1.04;
  return groundHorsePose(pose,pose.feet.map((f,i)=>({height:0,x:frame?frame.legs[i].rest[0]:(i%2?-1:1)*.235,z:f.z})),frame);
}

export function blendHorsePose(from,to,weight){
  const t=smooth(weight),pose={...to};
  for(const key of ['bodyY','bodyPitch','bodyRoll','neckPitch','tail','riderPitch','riderRoll','riderHeave','fall'])pose[key]=mix(finite(from[key]),finite(to[key]),t);
  pose.feet=to.feet.map((foot,i)=>({...foot,...Object.fromEntries(['y','z','roll'].map(key=>[key,mix(from.feet[i][key],foot[key],t)]))}));
  pose.riderBob=pose.bodyY-1.04;return pose;
}

/** Stand the horse's legs on the ground under its hooves (targets: each hoof's ground height,
 * place and slope). Each leg is two bones from its top, turned from the rest pose its frame
 * (horse-frame.js) records: a generated horse stands as it was made. A leg's top may sink a
 * little below the body (its shoulder or stifle) to reach, then the whole body lowers. */
export function groundHorsePose(pose,targets,frame=CODE_HORSE_FRAME){
  if(!targets?.length)return pose;
  frame??=CODE_HORSE_FRAME;const legs=frame.legs;
  const heights=targets.map(t=>clamp(finite(t.height),-.38,.38));
  pose.bodyY+=(Math.min(...heights)+Math.max(...heights))*.5;
  pose.feet=pose.feet.map((foot,i)=>({...foot,x:finite(targets[i]?.x,legs[i].rest[0]),z:finite(targets[i]?.z,foot.z),y:foot.y+heights[i],pitch:clamp(finite(targets[i]?.pitch),-.32,.32),bank:clamp(finite(targets[i]?.bank),-.25,.25)}));
  // What each leg reaches for: its fetlock joint, turned with the hoof about where the hoof stands.
  const joints=pose.feet.map((foot,i)=>{
    const pastern=legs[i].pastern;if(!pastern)return foot;
    const tilt=foot.roll+foot.pitch,c=Math.cos(tilt),s=Math.sin(tilt),cb=Math.cos(foot.bank),sb=Math.sin(foot.bank);
    const y=pastern[1]*c-pastern[2]*s,z=pastern[1]*s+pastern[2]*c;
    return {x:foot.x+pastern[0]*cb-y*sb,y:foot.y-HORSE_ANKLE+pastern[0]*sb+y*cb,z:foot.z+z};
  });
  for(const [i,joint]of joints.entries()){const leg=legs[i],top=leg.pivot;pose.bodyY=Math.min(pose.bodyY,joint.y+Math.sqrt(Math.max(.2,leg.support**2-(joint.z-top[2])**2-(joint.x-top[0])**2))-(top[1]-HORSE_BODY_Y)+leg.sling);}
  pose.legs=joints.map((joint,i)=>{
    const leg=legs[i],top=leg.pivot,foot=pose.feet[i],stand=pose.bodyY+(top[1]-HORSE_BODY_Y);
    const y0=leg.sling?Math.max(stand-leg.sling,Math.min(stand,joint.y+Math.sqrt(Math.max(.05,leg.reach**2-(joint.z-top[2])**2-(joint.x-top[0])**2)))):stand;
    const x=joint.x-top[0],y=joint.y-y0,z=joint.z-top[2],d=clamp(Math.hypot(x,y,z),.12,leg.reach),bend=leg.bend,a=leg.a,b=leg.b;
    const reach=a===b?Math.acos(clamp(d/(2*a),-1,1)):Math.acos(clamp((a**2+d*d-b**2)/(2*a*d),-1,1));
    const fold=a===b?Math.acos(clamp((2*a**2-d*d)/(2*a**2),-1,1)):Math.acos(clamp((a**2+b**2-d*d)/(2*a*b),-1,1));
    const upper=Math.atan2(-z,Math.hypot(x,y))-bend*reach-leg.upper0,knee=bend*(Math.PI-fold)-leg.knee0;
    return {upper,knee,splay:Math.atan2(x,-y)-leg.splay0,ankle:-upper-knee+foot.roll+foot.pitch,bank:foot.bank,y:y0};
  });
  const front=(heights[0]+heights[1])*.5,rear=(heights[2]+heights[3])*.5;
  pose.bodyPitch-=clamp(Math.atan2(front-rear,frame.spacing),-.18,.18)*.55;
  pose.riderBob=pose.bodyY-1.04;
  return pose;
}

/** Per-rig visual stance memory. Keeps a planted ankle at its world location
 * through a stride/gradual turn; a lift, teleport or excessive turn releases it.
 * Sampling is read-only, and callers can reset after a seek/retry. */
export function createFootPlanting(){
  let plants=[],previous=null;
  return {reset(){plants=[];previous=null;},sample({pose,mounted=false,position,direction=0,motion='idle',phase,groundHeight,scaleY=1,reset=false}){
    if(typeof groundHeight!=='function'){plants=[];previous=null;return null;}
    const x=finite(position?.x),y=finite(position?.y),z=finite(position?.z),yaw=finite(direction),sy=Math.max(.1,finite(scaleY,1)),c=Math.cos(yaw),s=Math.sin(yaw),base=mounted?.075:.07;
    const walking=['walk','run','retreat','cavalry-move'].includes(motion),supported=m=>['walk','run','retreat','cavalry-move','idle','start','stop','turn','brace','formation','yield'].includes(m),canPlant=supported(motion);
    const turn=previous?Math.atan2(Math.sin(yaw-previous.yaw),Math.cos(yaw-previous.yaw)):0;
    const changed=previous&&previous.motion!==motion,continuous=changed&&supported(previous.motion)&&canPlant;
    if(reset||!previous||changed&&!continuous||Math.hypot(x-previous.x,z-previous.z)>.8||Math.abs(turn)>.45||!walking&&!continuous&&Number.isFinite(phase)&&phase<(previous.phase??phase)-.1)plants=[];
    const sample=(wx,wz)=>{const h=groundHeight(wx,wz);return Number.isFinite(h)?h:y;};
    const targets=pose.feet.map((foot,i)=>{
      const localX=foot.x??(mounted?(i%2?-1:1)*.235:(i?1:-1)*.104);
      let wx=x+c*localX+s*foot.z,wz=z-s*localX+c*foot.z;
      const contact=foot.y<=base+.001,old=plants[i];
      if(!canPlant||!contact)plants[i]=null;
      else if(!old)plants[i]={x:wx,z:wz};
      else {
        const dx=old.x-x,dz=old.z-z,lx=c*dx-s*dz,lz=s*dx+c*dz;
        // A small pivot can keep its planted foot. A larger direction change
        // intentionally replants rather than twisting a knee through the body.
        if(Math.abs(lx-localX)>.13||Math.abs(lz-foot.z)>(mounted?.24:.18))plants[i]={x:wx,z:wz};
        else {wx=old.x;wz=old.z;}
      }
      const dx=wx-x,dz=wz-z,span=mounted?.09:.07;
      return {x:c*dx-s*dz,z:s*dx+c*dz,height:(sample(wx,wz)-y)/sy,
        pitch:-Math.atan2(sample(wx+s*span,wz+c*span)-sample(wx-s*span,wz-c*span),span*2*sy),
        bank:Math.atan2(sample(wx+c*span,wz-s*span)-sample(wx-c*span,wz+s*span),span*2*sy)};
    });
    previous={x,z,yaw,motion,phase};return targets;
  }};
}

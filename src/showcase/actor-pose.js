import {applyActorClip,sampleActorClip} from './actor-clips.js';
import {applyPerformance,applyLocomotionEntry} from './actor-performance.js';
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
export function actorPose({time=0,motion='idle',phase,direction=0,turnSign=1,health=1,braced=false,defended=false,impactDirection=0,locomotionWeight=1,locomotionDistance,movementProgress,reducedMotion=false,weapon='sword',mounted=false}={}){
  time=reducedMotion?0:finite(time);direction=finite(direction);health=clamp(finite(health,1),0,1);
  const p=clamp(finite(phase),0,1),breath=Math.sin(time*2.1)*.003;
  const pose={yaw:direction,hipX:0,hipY:.91+breath,hipZ:0,bodyX:0,bodyY:0,bodyZ:0,headX:0,headY:0,
    leftArm:[-.2,0,-.1],rightArm:[-.1,0,.08],leftElbow:-.55,rightElbow:-.35,
    leftWrist:0,rightWrist:0,shieldTilt:0,skirt:0,feet:[{y:.07,z:.05,roll:0},{y:.07,z:-.05,roll:0}],opacity:1};
  const guard=()=>{pose.hipY-=.075;pose.bodyX=-.075;pose.leftArm[0]=-.7;pose.leftElbow=-1;pose.shieldTilt=-.08;pose.feet[0].z=.19;pose.feet[1].z=-.16;pose.rightElbow=-.75;};
  if((braced||defended||motion==='block')&&!['walk','run','retreat','attack','strike','throw','brace','formation','withdrawn','dead'].includes(motion))guard();
  if(['walk','run','retreat'].includes(motion)){
    const physical=Number.isFinite(locomotionDistance),cycle=physical?locomotionPhase(locomotionDistance,motion):phase===undefined?time*(motion==='run'?2.1:1.4):finite(phase),speed=motion==='run'?1.25:1,sign=motion==='retreat'?-1:1,stride=physical?locomotionStride(motion):.72,reach=stride*.3;
    pose.feet=[0,.5].map(offset=>{
      const q=((cycle+offset)%1+1)%1,stance=q<.6,s=stance?q/.6:(q-.6)/.4;
      return {y:.07+(stance?0:Math.sin(s*Math.PI)*.105*speed),z:(stance?mix(reach,-reach,s):mix(-reach,reach,smooth(s)))*sign,roll:stance?0:Math.sin(s*Math.PI)*-.15};
    });
    pose.hipY=.885+Math.cos(cycle*Math.PI*4)*.009;pose.hipX=-Math.sin(cycle*Math.PI*2)*.023;pose.bodyX=motion==='retreat'?.07:-.05;
    pose.skirt=Math.sin(cycle*Math.PI*2)*.04;
    const weight=clamp(finite(locomotionWeight,1),0,1);
    pose.feet.forEach((foot,i)=>{foot.y=mix(.07,foot.y,weight);foot.z=mix(i?-.05:.05,foot.z,weight);foot.roll*=weight;});
    pose.hipY=mix(.91+breath,pose.hipY,weight);pose.hipX*=weight;pose.bodyX*=weight;pose.bodyY*=weight;pose.bodyZ*=weight;pose.skirt*=weight;pose.rightArm[0]=mix(-.1,pose.rightArm[0],weight);pose.leftArm[0]=mix(-.2,pose.leftArm[0],weight);
    applyActorClip(pose,'walk',((cycle%1)+1)%1,weight);
    applyPerformance(pose,motion==='run'?'run':'walk',((cycle%1)+1)%1,weight);
    applyLocomotionEntry(pose,{movementProgress,reducedMotion});
  }else if(['attack','strike','throw'].includes(motion)){
    // Clips keep exact230/620 contact and310/620 release poses; foot grounding
    // and held-equipment aiming still solve after sampling.
    applyActorClip(pose,motion==='throw'?'throw':weapon==='spear'?'spearAttack':mounted?'mountedAttack':'attack',p);
    if(motion!=='throw')applyPerformance(pose,'strike',p);
    if(mounted&&weapon==='spear'){const reach=actionEnvelope(motion,p).reach;pose.bodyZ+=.045*reach;pose.headY-=.04*reach;}
  }else if(['brace','formation'].includes(motion)){
    applyActorClip(pose,'brace',phase===undefined?1:p);
    if(phase!==undefined)applyPerformance(pose,'guard',p);
  }else if(['hit','hurt','block'].includes(motion)){
    const blocked=braced||defended||motion==='block',hit=sampleActorClip(blocked?'block':'hurt',p).weight,angle=finite(impactDirection),front=Math.cos(angle),side=Math.sin(angle);
    // A quick compression lands with the committed impact, followed by a
    // slower recovery. The defender keeps facing instead of snapping to a hit.
    pose.bodyX+=(blocked?.065:.20)*front*hit;pose.bodyZ-=(blocked?.035:.13)*side*hit;pose.headX=.07*front*hit;pose.headY=-.07*side*hit;
    pose.hipY-=(blocked?.028:.065)*hit;pose.hipZ-=.055*front*hit;pose.hipX-=.035*side*hit;
    pose.leftArm[0]-=(blocked?.18:.28)*hit;pose.leftElbow-=(blocked?.20:.36)*hit;pose.shieldTilt+=(blocked?.17:.08)*hit;
    pose.rightElbow-=.1*hit;
  }else if(['speak','conversation'].includes(motion)){
    if(motion==='speak')applyPerformance(pose,'speech',p);else applyActorClip(pose,'conversation',p);
  }else if(['rally','order'].includes(motion)){
    applyPerformance(pose,motion,p);
  }else if(motion==='turn'){
    applyPerformance(pose,'turn',p);
    const side=Number.isFinite(turnSign)&&turnSign<0?-1:1;pose.bodyY*=side;pose.headY*=side;pose.bodyZ*=side;
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
  }else if(['dead','withdrawn'].includes(motion)||health<=0){
    const fall=health<=0?1:smooth(p);pose.hipY-=.6*fall;pose.hipX=-.025*fall;pose.bodyX=.8*fall;pose.bodyZ=.09*fall;pose.headX=.35*fall;pose.rightArm[0]=-.7*fall;pose.opacity=1;
  }
  if(motion==='idle'&&!reducedMotion)applyActorClip(pose,'idle',(time%4.8)/4.8);
  // Two-bone sagittal IK keeps the soles on the requested ground plane even
  // while hips settle, and avoids straight-knee singularities.
  pose.legs=pose.feet.map(foot=>{
    const y=foot.y-pose.hipY,z=foot.z-pose.hipZ,d=clamp(Math.hypot(y,z),.12,.858),upper=.43,lower=.43;
    const thigh=Math.atan2(-z,-y)-Math.acos(clamp((upper*upper+d*d-lower*lower)/(2*upper*d),-1,1));
    const knee=Math.PI-Math.acos(clamp((upper*upper+lower*lower-d*d)/(2*upper*lower),-1,1));
    return {thigh,knee,ankle:-thigh-knee+foot.roll};
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
  result.feet=to.feet.map((foot,i)=>({...foot,y:mix(from.feet[i].y,foot.y,t),z:mix(from.feet[i].z,foot.z,t),roll:mix(from.feet[i].roll,foot.roll,t)}));
  return result;
}

/** Horse gait converts the stage's human .72m distance phase to a1.35m stride.
 * Four hoof targets and sagittal IK retain planted feet during each stance.
 */
export function horsePose({time=0,motion='idle',phase,locomotionWeight=1,locomotionDistance,reducedMotion=false}={}){
  time=reducedMotion?0:finite(time);const physical=Number.isFinite(locomotionDistance),stride=physical?locomotionStride(motion,true):1.35,moving=['walk','run','retreat','cavalry-move'].includes(motion),cycle=physical?locomotionPhase(locomotionDistance,motion,true):phase===undefined?time*1.2:finite(phase)*.72/1.35,weight=moving?clamp(finite(locomotionWeight,1),0,1):0;
  const p=clamp(finite(phase),0,1),fall=['withdrawn','dead'].includes(motion)?smooth(p):0,attack=['attack','strike','cavalry-attack'].includes(motion)?sampleActorClip('horseStrike',p):{},idle=sampleActorClip('horseIdle',((time/6.4)%1+1)%1);
  const bodyY=1.04+Math.cos(cycle*Math.PI*4)*.014*weight,bodyPitch=attack.bodyPitch??0,neckPitch=(idle.neckPitch??0)+(attack.neckPitch??0),tail=(idle.tail??0)+(attack.tail??0)+.08*Math.sin(cycle*Math.PI*2)*weight;
  const offsets=motion==='run'?[0,.5,.5,0]:[0,.5,.75,.25];
  const feet=offsets.map((offset,i)=>{const q=((cycle+offset)%1+1)%1,stance=q<.55,s=stance?q/.55:(q-.55)/.45,reach=stride*.275,z=stance?mix(reach,-reach,s):mix(-reach,reach,smooth(s));return {y:.075+(stance?0:Math.sin(s*Math.PI)*.14)*weight,z:z*weight+(i<2?.54:-.54),roll:stance?0:-.16*Math.sin(s*Math.PI)*weight};});
  const legs=feet.map((foot,i)=>{const y=foot.y-bodyY,z=foot.z-(i<2?.54:-.54),d=clamp(Math.hypot(y,z),.12,1.059),length=.53,bend=i<2?1:-1;const upper=Math.atan2(-z,-y)-bend*Math.acos(clamp(d/(2*length),-1,1)),knee=bend*(Math.PI-Math.acos(clamp((2*length*length-d*d)/(2*length*length),-1,1)));return {upper,knee,ankle:-upper-knee+foot.roll};});
  return {bodyY,bodyPitch,neckPitch,tail,feet,legs,fall,riderBob:bodyY-1.04};
}

export function groundHorsePose(pose,targets){
  if(!targets?.length)return pose;
  const heights=targets.map(t=>clamp(finite(t.height),-.38,.38));
  pose.bodyY+=(Math.min(...heights)+Math.max(...heights))*.5;
  pose.feet=pose.feet.map((foot,i)=>({...foot,x:finite(targets[i]?.x,(i%2?-1:1)*.235),z:finite(targets[i]?.z,foot.z),y:foot.y+heights[i],pitch:clamp(finite(targets[i]?.pitch),-.32,.32),bank:clamp(finite(targets[i]?.bank),-.25,.25)}));
  for(const [i,foot]of pose.feet.entries())pose.bodyY=Math.min(pose.bodyY,foot.y+Math.sqrt(Math.max(.2,1.052**2-(foot.z-(i<2?.54:-.54))**2-(foot.x-(i%2?-1:1)*.235)**2)));
  pose.legs=pose.feet.map((foot,i)=>{const x=foot.x-(i%2?-1:1)*.235,y=foot.y-pose.bodyY,z=foot.z-(i<2?.54:-.54),d=clamp(Math.hypot(x,y,z),.12,1.059),bend=i<2?1:-1,upper=Math.atan2(-z,Math.hypot(x,y))-bend*Math.acos(clamp(d/1.06,-1,1)),knee=bend*(Math.PI-Math.acos(clamp((2*.53**2-d*d)/(2*.53**2),-1,1)));return {upper,knee,splay:Math.atan2(x,-y),ankle:-upper-knee+foot.roll+foot.pitch,bank:foot.bank};});
  const front=(heights[0]+heights[1])*.5,rear=(heights[2]+heights[3])*.5;
  pose.bodyPitch-=clamp(Math.atan2(front-rear,1.08),-.18,.18)*.55;
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
    const walking=['walk','run','retreat','cavalry-move'].includes(motion),canPlant=walking||['idle','brace','formation','yield'].includes(motion);
    const turn=previous?Math.atan2(Math.sin(yaw-previous.yaw),Math.cos(yaw-previous.yaw)):0;
    if(reset||!previous||previous.motion!==motion||Math.hypot(x-previous.x,z-previous.z)>.8||Math.abs(turn)>.45||Number.isFinite(phase)&&phase<(previous.phase??phase)-.1)plants=[];
    const sample=(wx,wz)=>{const h=groundHeight(wx,wz);return Number.isFinite(h)?h:y;};
    const targets=pose.feet.map((foot,i)=>{
      const localX=mounted?(i%2?-1:1)*.235:(i?1:-1)*.104;
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

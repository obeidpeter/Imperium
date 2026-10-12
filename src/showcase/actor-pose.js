const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=n=>{const t=clamp(n,0,1);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;

/** Local articulated pose only. No clocks, RNG, unit mutations or world movement. */
export function actorPose({time=0,motion='idle',phase,direction=0,health=1,braced=false,locomotionWeight=1}={}){
  time=finite(time);direction=finite(direction);health=clamp(finite(health,1),0,1);
  const p=clamp(finite(phase),0,1),breath=Math.sin(time*2.1)*.003;
  const pose={yaw:direction,hipY:.91+breath,hipZ:0,bodyX:0,bodyY:0,bodyZ:0,headX:0,headY:0,
    leftArm:[-.2,0,-.1],rightArm:[-.1,0,.08],leftElbow:-.55,rightElbow:-.35,
    leftWrist:0,rightWrist:0,shieldTilt:0,skirt:0,feet:[{y:.07,z:.05,roll:0},{y:.07,z:-.05,roll:0}],opacity:1};
  const guard=()=>{pose.hipY-=.075;pose.bodyX=-.075;pose.leftArm[0]=-.7;pose.leftElbow=-1;pose.shieldTilt=-.08;pose.feet[0].z=.19;pose.feet[1].z=-.16;pose.rightElbow=-.75;};
  if(braced&&!['walk','run','retreat','attack','strike','throw','brace','formation','withdrawn','dead'].includes(motion))guard();
  if(['walk','run','retreat'].includes(motion)){
    const cycle=phase===undefined?time*(motion==='run'?2.1:1.4):finite(phase),speed=motion==='run'?1.25:1,sign=motion==='retreat'?-1:1;
    pose.feet=[0,.5].map(offset=>{
      const q=((cycle+offset)%1+1)%1,stance=q<.6,s=stance?q/.6:(q-.6)/.4;
      return {y:.07+(stance?0:Math.sin(s*Math.PI)*.105*speed),z:(stance?mix(.216,-.216,s):mix(-.216,.216,smooth(s)))*sign,roll:stance?0:Math.sin(s*Math.PI)*-.15};
    });
    pose.hipY=.885+Math.cos(cycle*Math.PI*4)*.009;pose.bodyX=motion==='retreat'?.07:-.05;
    pose.bodyY=Math.sin(cycle*Math.PI*2)*.055;pose.bodyZ=Math.cos(cycle*Math.PI*2)*.025;
    pose.rightArm[0]+=.24*Math.sin(cycle*Math.PI*2);pose.leftArm[0]-=.12*Math.sin(cycle*Math.PI*2);pose.skirt=Math.sin(cycle*Math.PI*2)*.04;
    const weight=clamp(finite(locomotionWeight,1),0,1);
    pose.feet.forEach((foot,i)=>{foot.y=mix(.07,foot.y,weight);foot.z=mix(i?-.05:.05,foot.z,weight);foot.roll*=weight;});
    pose.hipY=mix(.91+breath,pose.hipY,weight);pose.bodyX*=weight;pose.bodyY*=weight;pose.bodyZ*=weight;pose.skirt*=weight;pose.rightArm[0]=mix(-.1,pose.rightArm[0],weight);pose.leftArm[0]=mix(-.2,pose.leftArm[0],weight);
  }else if(['attack','strike','throw'].includes(motion)){
    // Physical contact agrees with the shared timeline: sword at230/620,
    // thrown weapon release at310/620. Both clips return to identical guard.
    const throwing=motion==='throw',load=smooth(p/(throwing?.30:.22)),drive=smooth((p-(throwing?.30:.22))/(throwing?.20:.15)),recover=smooth((p-(throwing?.66:.54))/(throwing?.34:.46));
    const wind=load*(1-drive),contact=drive*(1-recover);
    pose.bodyY=-.32*wind+.2*contact;pose.bodyX=.06*wind-.12*contact;pose.hipZ=.12*contact;
    pose.rightArm=[-.1-2.05*wind-1.6*contact,-.22*wind,.08+.18*wind];
    pose.rightElbow=-.35-.85*wind+.28*contact;pose.rightWrist=-.12*contact;
    const preparation=load*(1-recover);
    pose.leftArm[0]=-.2-.25*preparation;pose.leftElbow=-.55-.15*preparation;pose.shieldTilt=-.12*contact;
    pose.feet[1].z=-.05-.095*preparation;pose.feet[0].z=.05+.19*contact;
    // Lift the leading foot briefly during the forward step, then plant before
    // contact. Lift again during recovery instead of dragging a locked boot.
    pose.feet[0].y+=Math.sin(Math.PI*drive)*.045*(1-recover)+Math.sin(Math.PI*recover)*.035;
    pose.hipY-=.042*contact;
    if(motion==='throw'){pose.rightArm[0]-=.18*wind;pose.rightArm[1]=-.4*wind+.13*contact;}
  }else if(['brace','formation'].includes(motion)){
    const hold=phase===undefined?1:smooth(p/.28);
    pose.hipY-=.075*hold;pose.bodyX=-.075*hold;pose.leftArm[0]=-.2-.5*hold;pose.leftElbow=-.55-.45*hold;pose.shieldTilt=-.08*hold;
    pose.feet[0].z=.05+.14*hold;pose.feet[1].z=-.05-.11*hold;pose.rightElbow=-.35-.4*hold;
  }else if(['hit','hurt'].includes(motion)){
    const hit=Math.sin(Math.PI*clamp(p/.75,0,1))*(1-smooth((p-.55)/.45));
    pose.bodyX+=(braced?.065:.2)*hit;pose.bodyZ+=(braced?-.035:-.09)*hit;pose.headX=.08*hit;pose.hipY-=(braced?.025:.06)*hit;pose.hipZ=-.045*hit;
    pose.leftArm[0]-=.28*hit;pose.leftElbow-=.36*hit;pose.shieldTilt+=.12*hit;
  }else if(['rally','speak','order'].includes(motion)){
    const raise=Math.sin(Math.PI*p);pose.rightArm=[-.1-2*raise,0,.08+.04*raise];pose.rightElbow=-.35;pose.headX=-.09*raise;pose.bodyY=.08*raise;
  }else if(motion==='yield'){
    const close=smooth(phase===undefined?1:p);pose.headX=.18*close;pose.bodyX=.035*close;pose.leftArm=[-.2-.34*close,0,-.1+.16*close];pose.rightArm=[-.1-.36*close,0,.08-.16*close];pose.leftElbow=-.55-.9*close;pose.rightElbow=-.35-1.05*close;
  }else if(['dead','withdrawn'].includes(motion)||health<=0){
    const fall=health<=0?1:smooth(p);pose.hipY-=.6*fall;pose.bodyX=.8*fall;pose.headX=.35*fall;pose.rightArm[0]=-.7*fall;pose.opacity=1;
  }
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

/** Horse gait converts the stage's human .72m distance phase to a1.35m stride.
 * Four hoof targets and sagittal IK retain planted feet during each stance.
 */
export function horsePose({time=0,motion='idle',phase,locomotionWeight=1}={}){
  time=finite(time);const moving=['walk','run','retreat','cavalry-move'].includes(motion),cycle=phase===undefined?time*1.2:finite(phase)*.72/1.35,weight=moving?clamp(finite(locomotionWeight,1),0,1):0;
  const p=clamp(finite(phase),0,1),fall=['withdrawn','dead'].includes(motion)?smooth(p):0,attack=['attack','strike','cavalry-attack'].includes(motion)?Math.sin(Math.PI*p):0;
  const bodyY=1.04+Math.cos(cycle*Math.PI*4)*.014*weight,bodyPitch=-.028*attack,neckPitch=.018*Math.sin(time*1.3)+.07*attack,tail=.07*Math.sin(time*1.7)+.08*Math.sin(cycle*Math.PI*2)*weight;
  const offsets=motion==='run'?[0,.5,.5,0]:[0,.5,.75,.25];
  const feet=offsets.map((offset,i)=>{const q=((cycle+offset)%1+1)%1,stance=q<.55,s=stance?q/.55:(q-.55)/.45,z=stance?mix(.37125,-.37125,s):mix(-.37125,.37125,smooth(s));return {y:.075+(stance?0:Math.sin(s*Math.PI)*.14)*weight,z:z*weight+(i<2?.54:-.54),roll:stance?0:-.16*Math.sin(s*Math.PI)*weight};});
  const legs=feet.map((foot,i)=>{const y=foot.y-bodyY,z=foot.z-(i<2?.54:-.54),d=clamp(Math.hypot(y,z),.12,1.059),length=.53,bend=i<2?1:-1;const upper=Math.atan2(-z,-y)-bend*Math.acos(clamp(d/(2*length),-1,1)),knee=bend*(Math.PI-Math.acos(clamp((2*length*length-d*d)/(2*length*length),-1,1)));return {upper,knee,ankle:-upper-knee+foot.roll};});
  return {bodyY,bodyPitch,neckPitch,tail,feet,legs,fall,riderBob:bodyY-1.04};
}

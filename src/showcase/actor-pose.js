const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=n=>{const t=clamp(n,0,1);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;

/** Local articulated pose only. No clocks, RNG, unit mutations or world movement. */
export function actorPose({time=0,motion='idle',phase,direction=0,health=1}={}){
  time=finite(time);direction=finite(direction);health=clamp(finite(health,1),0,1);
  const p=clamp(finite(phase),0,1),breath=Math.sin(time*2.1)*.003;
  const pose={yaw:direction,hipY:.91+breath,hipZ:0,bodyX:0,bodyY:0,bodyZ:0,headX:0,headY:0,
    leftArm:[-.2,0,-.1],rightArm:[-.1,0,.08],leftElbow:-.55,rightElbow:-.35,
    leftWrist:0,rightWrist:0,shieldTilt:0,skirt:0,feet:[{y:.07,z:.05,roll:0},{y:.07,z:-.05,roll:0}],opacity:1};
  if(['walk','run','retreat'].includes(motion)){
    const cycle=phase===undefined?time*(motion==='run'?2.1:1.4):finite(phase),speed=motion==='run'?1.25:1,sign=motion==='retreat'?-1:1;
    pose.feet=[0,.5].map(offset=>{
      const q=((cycle+offset)%1+1)%1,stance=q<.6,s=stance?q/.6:(q-.6)/.4;
      return {y:.07+(stance?0:Math.sin(s*Math.PI)*.105*speed),z:(stance?mix(.216,-.216,s):mix(-.216,.216,smooth(s)))*sign,roll:stance?0:Math.sin(s*Math.PI)*-.15};
    });
    pose.hipY=.885+Math.cos(cycle*Math.PI*4)*.009;pose.bodyX=motion==='retreat'?.07:-.05;
    pose.bodyY=Math.sin(cycle*Math.PI*2)*.055;pose.bodyZ=Math.cos(cycle*Math.PI*2)*.025;
    pose.rightArm[0]+=.24*Math.sin(cycle*Math.PI*2);pose.leftArm[0]-=.12*Math.sin(cycle*Math.PI*2);pose.skirt=Math.sin(cycle*Math.PI*2)*.04;
  }else if(['attack','strike','throw'].includes(motion)){
    const load=smooth(p/.28),drive=smooth((p-.28)/.2),recover=smooth((p-.62)/.38);
    const wind=load*(1-drive),contact=drive*(1-recover);
    pose.bodyY=-.32*wind+.2*contact;pose.bodyX=.06*wind-.12*contact;pose.hipZ=.1*contact;
    pose.rightArm=[-.1-2.05*wind-1.6*contact,-.22*wind,.08+.18*wind];
    pose.rightElbow=-.35-.85*wind+.28*contact;pose.rightWrist=-.12*contact;
    pose.leftArm[0]=-.25-.2*contact;pose.leftElbow=-.7;pose.shieldTilt=-.12*contact;
    pose.feet[1].z=-.16;pose.feet[0].z=.12+.12*contact;pose.hipY-=.035*contact;
    if(motion==='throw'){pose.rightArm[0]-=.18*wind;pose.rightArm[1]=-.4*wind+.13*contact;}
  }else if(['brace','formation'].includes(motion)){
    const hold=phase===undefined?1:Math.sin(Math.min(1,p*3)*Math.PI/2)*(1-.2*smooth((p-.8)/.2));
    pose.hipY-=.09*hold;pose.bodyX=-.08*hold;pose.leftArm[0]=-.75*hold;pose.leftElbow=-1.0;pose.shieldTilt=-.08;
    pose.feet[0].z=.05+.15*hold;pose.feet[1].z=-.05-.13*hold;pose.rightElbow=-.85;
  }else if(['hit','hurt'].includes(motion)){
    const hit=Math.sin(Math.PI*clamp(p/.75,0,1))*(1-smooth((p-.55)/.45));
    pose.bodyX=.2*hit;pose.bodyZ=-.09*hit;pose.headX=.15*hit;pose.hipY-=.06*hit;pose.hipZ=-.06*hit;pose.leftArm[0]=-.6;pose.leftElbow=-.95;
  }else if(['rally','speak','order'].includes(motion)){
    const raise=Math.sin(Math.PI*p);pose.rightArm=[-2.1*raise,0,.12];pose.rightElbow=-.35;pose.headX=-.09*raise;pose.bodyY=.08*raise;
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

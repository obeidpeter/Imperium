// Original, distance-driven sole trajectories. This is a presentation sampler;
// it never changes a unit's path, speed, injury state or action clock.
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:0));
const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
const mix=(a,b,t)=>a+(b-a)*t;
const wrap=n=>((n%1)+1)%1;

export function sampleHumanGait({cycle=0,stride=1.15,running=false,retreat=false,injury=0}={}){
  cycle=wrap(Number.isFinite(cycle)?cycle:0);
  const hurt=clamp(injury),sign=retreat?-1:1;
  const feet=[0,.5].map((offset,i)=>{
    // The right leg (negative local X) is favoured: it accepts weight briefly,
    // while the left leg
    // carries it longer. Reach changes with stance duration so each supported
    // sole still travels backwards at exactly the root's distance per cycle.
    const stance=.6+(i?1:-1)*.095*hurt,q=wrap(cycle+offset),contact=q<stance,s=contact?q/stance:(q-stance)/(1-stance),reach=stride*stance*.5;
    const lift=contact?0:Math.sin(s*Math.PI)**1.35*(running?.132:.105)*(i?1:1-.45*hurt);
    const z=contact?reach-stride*q:mix(-reach,reach,smooth(s));
    return {x:(i?1:-1)*(.104+.012*hurt),y:.07+lift,z:z*sign,roll:contact?0:-Math.sin(s*Math.PI)*(.15-.055*hurt)};
  });
  const load=Math.sin(wrap(cycle)*Math.PI*2),transfer=Math.cos(wrap(cycle)*Math.PI*4);
  return {feet,hipY:.885+transfer*.009-hurt*(.013+.012*Math.max(0,load)),hipX:-load*.023+hurt*(.018+.012*load),bodyZ:hurt*(.035+.025*load)};
}

/** Turn into the new direction through the pelvis and free foot. Supported
 * soles remain available to the world-space planting solver. */
export function applyGaitTurn(pose,turnRate,{mounted=false}={}){
  const lean=clamp(turnRate*.028,-.18,.18);
  pose.bodyY-=lean;pose.headY+=lean*.6;pose.bodyZ-=lean*.22;
  pose.hipX-=lean*(mounted?.055:.14);
  if(!mounted)for(const [i,foot]of pose.feet.entries()){
    const swing=smooth((foot.y-.071)/.05);
    foot.x=(foot.x??(i?1:-1)*.104)+lean*.23*swing;
    foot.z-=lean*(i?1:-1)*.10*swing;
  }
  return pose;
}

export const HORSE_GAITS=Object.freeze({
  walk:Object.freeze({offsets:Object.freeze([0,.5,.75,.25]),stance:.60,lift:.12}),
  trot:Object.freeze({offsets:Object.freeze([0,.5,.5,0]),stance:.52,lift:.16}),
  canter:Object.freeze({offsets:Object.freeze([.10,0,.56,.68]),stance:.46,lift:.19})
});

export function sampleHorseGait({cycle=0,stride=1.8,gait='walk',weight=1,retreat=false}={}){
  cycle=wrap(Number.isFinite(cycle)?cycle:0);
  const clip=HORSE_GAITS[gait]??HORSE_GAITS.walk,w=clamp(weight),sign=retreat?-1:1;
  const feet=clip.offsets.map((offset,i)=>{
    const q=wrap(cycle+offset),contact=q<clip.stance,s=contact?q/clip.stance:(q-clip.stance)/(1-clip.stance),reach=stride*clip.stance*.5;
    return {y:.075+(contact?0:Math.sin(s*Math.PI)**1.3*clip.lift)*w,
      z:(contact?reach-stride*q:mix(-reach,reach,smooth(s)))*w*sign+(i<2?.54:-.54),
      roll:contact?0:-.20*Math.sin(s*Math.PI)*w};
  });
  const a=cycle*Math.PI*2,canter=gait==='canter',trot=gait==='trot';
  return {feet,bodyY:1.04+(canter?Math.sin(a)*.027:trot?Math.cos(a*2)*.022:Math.cos(a*2)*.009)*w,
    bodyPitch:(canter?Math.sin(a-.45)*.042:Math.sin(a)*.012)*w,
    bodyRoll:(canter?Math.sin(a)*.012:Math.sin(a)*.019)*w,
    neckPitch:(canter?-.025+Math.sin(a+.6)*.022:Math.sin(a+.4)*.014)*w,
    riderPitch:(canter?-Math.sin(a-.15)*.018:-Math.sin(a)*.009)*w,
    riderRoll:-Math.sin(a)*.011*w,riderHeave:(canter?Math.sin(a-.3)*.012:trot?Math.cos(a*2-.4)*.009:0)*w};
}
